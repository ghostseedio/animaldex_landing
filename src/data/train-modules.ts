import "server-only";

import type {AppIconName} from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {getAppJournalEntries} from "@/data/authenticated-app";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {getMatchupArena} from "@/data/matchups";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {APP_MODULE_THUMBNAILS, ARENA_MODULE_ACCENTS} from "@/lib/app-module-thumbnails";
import type {SupabaseClient} from "@supabase/supabase-js";

type QueryRow = Record<string, any>;

export type TrainModuleId = "dailyCompanion" | "wildProfile" | "packs" | "missions";

export type TrainModuleDefinition = {
    id: TrainModuleId;
    href: string;
    title: string;
    subtitle: string;
    icon: AppIconName;
    thumbnailUrl: string;
    accent: import("@/lib/app-module-thumbnails").ArenaModuleAccent;
    statusLabel: string | null;
};

export type TrainPageData = {
    modules: TrainModuleDefinition[];
};

export type ArenaPageData = TrainPageData & {
    opponentCount: number;
};

const TRAIN_MODULE_CATALOG: Array<Pick<TrainModuleDefinition, "id" | "title" | "subtitle" | "icon">> = [
    {
        id: "dailyCompanion",
        title: "Daily Companion",
        subtitle: "Journal alignment and companion proofs.",
        icon: "calendar"
    },
    {
        id: "wildProfile",
        title: "Wild Profile",
        subtitle: "Origin, Apex, and Active roles.",
        icon: "profile"
    },
    {
        id: "packs",
        title: "Sealed Packs",
        subtitle: "List, sell, and open ten-capture packs.",
        icon: "grid"
    },
    {
        id: "missions",
        title: "Missions",
        subtitle: "Progression milestones and credit rewards.",
        icon: "mission"
    }
];

export type TrainIdentityRole = {
    label: string;
    name: string;
    speciesSlug: string | null;
    confidence: number | null;
};

export type TrainWildProfileState = {
    hasProfile: boolean;
    hasInProgressInterview: boolean;
    headline: string | null;
    summary: string | null;
    origin: TrainIdentityRole | null;
    apex: TrainIdentityRole | null;
    active: TrainIdentityRole | null;
    generatedAt: string | null;
};

export type TrainAnimalPack = {
    id: string;
    status: string;
    themeTitle: string;
    themeReason: string | null;
    packSize: number;
    listedPrice: number | null;
    guaranteedMinimumTier: string | null;
    baseTheme: string | null;
    specialtyTheme: string | null;
    qualityBand: string | null;
    rarityBand: string | null;
    guaranteesSummary: string | null;
    platformFee: number | null;
    sellerProceeds: number | null;
    createdAt: string | null;
    purchasedAt: string | null;
    openedAt: string | null;
    sellerDisplayName: string;
    sellerUsername: string | null;
    sellerAvatarUrl: string | null;
    buyerDisplayName: string | null;
    buyerUsername: string | null;
    isSeller: boolean;
    isBuyer: boolean;
};

export type TrainPackCapture = {
    captureId: string;
    animalName: string;
    scientificName: string | null;
    speciesSlug: string | null;
    capturedAt: string | null;
    imageSrc: string;
    isDiscoverable: boolean;
    isChallengeReady: boolean;
    challengeHealth: number;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
    battlePower: number;
    battleTier: string;
    tradeValue: number;
    rarity: number;
    gameStats: Record<string, number>;
};

export type TrainDailyCompanionState = {
    completedToday: boolean;
    journalCount: number;
    recentJournalDate: string | null;
};

function trainModuleHref(localePrefix: string, id: TrainModuleId) {
    switch (id) {
        case "dailyCompanion":
            return `${localePrefix}/app/train/daily-companion`;
        case "wildProfile":
            return `${localePrefix}/app/train/wild-profile`;
        case "packs":
            return `${localePrefix}/app/train/packs`;
        case "missions":
            return `${localePrefix}/app/missions`;
    }
}

async function getTrainWildProfileIndexStatus(supabase: SupabaseClient, userId: string) {
    const [profileResult, sessionResult] = await Promise.all([
        supabase
            .from("user_identity_profiles")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "active")
            .limit(1)
            .maybeSingle(),
        supabase
            .from("identity_questionnaire_sessions")
            .select("id")
            .eq("user_id", userId)
            .in("status", ["in_progress", "ready_for_generation", "generating"])
            .limit(1)
    ]);

    return {
        hasProfile: Boolean(profileResult.data),
        hasInProgressInterview: Boolean((sessionResult.data ?? []).length)
    };
}

async function getTrainPackIndexStatus(supabase: SupabaseClient, userId: string) {
    const [unopenedResult, eligibleResult, lockedResult] = await Promise.all([
        supabase
            .from("animal_pack_marketplace_v1")
            .select("id", {count: "exact", head: true})
            .eq("buyer_user_id", userId)
            .eq("status", "sold")
            .is("opened_at", null),
        supabase
            .from("owned_capture_manifest_v1")
            .select("capture_id,battle_power")
            .eq("user_id", userId)
            .eq("is_discoverable", true)
            .not("game_stats", "is", null)
            .limit(12),
        supabase
            .from("my_sealed_pack_locked_capture_ids_v1")
            .select("capture_id")
    ]);

    const locked = new Set(((lockedResult.data ?? []) as QueryRow[]).map((row) => String(row.capture_id ?? "")));
    const eligibleCount = ((eligibleResult.data ?? []) as QueryRow[])
        .filter((row) => row.capture_id && !locked.has(String(row.capture_id)) && Number(row.battle_power ?? 0) > 0)
        .length;

    return {
        unopenedPacks: unopenedResult.count ?? 0,
        canList: eligibleCount >= 10
    };
}

async function getTrainMissionIndexStatus(supabase: SupabaseClient, userId: string) {
    const [summaryResult, missionsResult] = await Promise.all([
        supabase
            .from("user_progression_summary_v1")
            .select("verified_overall_score,trade_unlocked_at")
            .maybeSingle(),
        supabase
            .from("user_mission_status_v1")
            .select("unlock_score_min,requires_trade_unlocked,completed_count")
    ]);

    let overallScore = Number((summaryResult.data as QueryRow | null)?.verified_overall_score ?? 0);
    let tradeUnlocked = Boolean((summaryResult.data as QueryRow | null)?.trade_unlocked_at);
    let missionRows = (missionsResult.data ?? []) as QueryRow[];

    if (!summaryResult.data) {
        const {data: profile} = await supabase
            .from("profiles")
            .select("verified_overall_score,trade_unlocked_at")
            .eq("id", userId)
            .maybeSingle();
        overallScore = Number((profile as QueryRow | null)?.verified_overall_score ?? 0);
        tradeUnlocked = Boolean((profile as QueryRow | null)?.trade_unlocked_at);
    }

    if (!missionRows.length) {
        const [definitionsResult, progressResult] = await Promise.all([
            supabase
                .from("mission_definitions")
                .select("slug,unlock_score_min,requires_trade_unlocked"),
            supabase
                .from("user_mission_progress")
                .select("mission_slug,completed_count")
                .eq("user_id", userId)
        ]);
        const progressBySlug = new Map(
            ((progressResult.data ?? []) as QueryRow[]).map((row) => [String(row.mission_slug), row])
        );
        missionRows = ((definitionsResult.data ?? []) as QueryRow[]).map((row) => ({
            unlock_score_min: row.unlock_score_min,
            requires_trade_unlocked: row.requires_trade_unlocked,
            completed_count: Number(progressBySlug.get(String(row.slug))?.completed_count ?? 0)
        }));
    }

    return missionRows.filter((row) => {
        const locked = overallScore < Number(row.unlock_score_min ?? 0)
            || (Boolean(row.requires_trade_unlocked) && !tradeUnlocked);
        return !locked && Number(row.completed_count ?? 0) === 0;
    }).length;
}

function buildTrainModules(
    localePrefix: string,
    status: Record<TrainModuleId, string | null>
): TrainModuleDefinition[] {
    return TRAIN_MODULE_CATALOG.map((module) => ({
        ...module,
        href: trainModuleHref(localePrefix, module.id),
        thumbnailUrl: APP_MODULE_THUMBNAILS[module.id],
        accent: ARENA_MODULE_ACCENTS[module.id],
        statusLabel: status[module.id]
    }));
}

function emptyTrainPageData(localePrefix: string): TrainPageData {
    return {
        modules: buildTrainModules(localePrefix, {
            dailyCompanion: null,
            wildProfile: null,
            packs: null,
            missions: null
        })
    };
}

function readNumber(row: QueryRow, key: string, fallback = 0) {
    const value = Number(row[key] ?? fallback);
    return Number.isFinite(value) ? value : fallback;
}

function readableContext(row: QueryRow) {
    const zooOrWild = typeof row.zoo_or_wild === "string" ? row.zoo_or_wild.trim() : "";
    if (zooOrWild && zooOrWild !== "Unknown") return zooOrWild;

    switch (typeof row.human_context === "string" ? row.human_context.trim() : "") {
        case "Pet":
            return "Domestic";
        case "Livestock":
            return "Farm";
        case "Captive":
            return "Zoo";
        case "Free-ranging":
            return "Wild";
        default:
            return null;
    }
}

function battlePower(stats: Record<string, number>) {
    return Math.round(
        (stats.dominance ?? 0) * 0.22
        + (stats.speed ?? 0) * 0.14
        + (stats.size ?? 0) * 0.10
        + (stats.intelligence ?? 0) * 0.14
        + (stats.rarity ?? 0) * 0.40
    );
}

function tradeValue(stats: Record<string, number>) {
    return Math.min(100, Math.max(0, Math.round(
        (stats.dominance ?? 0) * 0.18
        + (stats.speed ?? 0) * 0.10
        + (stats.size ?? 0) * 0.14
        + (stats.intelligence ?? 0) * 0.13
        + (stats.rarity ?? 0) * 0.45
    )));
}

function battleTier(power: number) {
    if (power < 25) return "E";
    if (power < 40) return "D";
    if (power < 52) return "C";
    if (power < 62) return "B";
    if (power < 80) return "A";
    return "S";
}

function tierRank(tier: string) {
    return ({E: 0, D: 1, C: 2, B: 3, A: 4, S: 5} as Record<string, number>)[tier] ?? 0;
}

function toGameStats(row: QueryRow) {
    const stored = row.game_stats && typeof row.game_stats === "object" ? row.game_stats as QueryRow : {};
    const stats = {
        dominance: readNumber(stored, "dominance") + readNumber(row, "dominance_boost") + readNumber(row, "comparison_dominance_boost"),
        speed: readNumber(stored, "speed") + readNumber(row, "speed_boost") + readNumber(row, "comparison_speed_boost"),
        size: readNumber(stored, "size") + readNumber(row, "comparison_size_boost"),
        intelligence: readNumber(stored, "intelligence") + readNumber(row, "intelligence_boost") + readNumber(row, "comparison_intelligence_boost"),
        rarity: readNumber(stored, "rarity") + readNumber(row, "comparison_rarity_boost")
    };

    return Object.fromEntries(
        Object.entries(stats).map(([key, value]) => [key, Math.min(100, Math.max(0, value))])
    ) as Record<string, number>;
}

function toTrainPackCapture(row: QueryRow): TrainPackCapture | null {
    const captureId = typeof row.capture_id === "string" ? row.capture_id.trim() : "";
    if (!captureId) return null;
    if (!row.game_stats || typeof row.game_stats !== "object") return null;

    const stats = toGameStats(row);
    const power = battlePower(stats);

    return {
        captureId,
        animalName: typeof row.animal_name === "string" && row.animal_name.trim() ? row.animal_name.trim() : "Animal",
        scientificName: typeof row.scientific_name === "string" && row.scientific_name.trim() ? row.scientific_name.trim() : null,
        speciesSlug: typeof row.normalized_identity_key === "string" && row.normalized_identity_key.trim() ? row.normalized_identity_key.trim().replace(/_/g, "-") : null,
        capturedAt: row.capture_created_at ?? null,
        imageSrc: getCaptureImageRoute(captureId),
        isDiscoverable: row.is_discoverable === true,
        isChallengeReady: row.is_challenge_ready === true,
        challengeHealth: readNumber(row, "challenge_health", 0),
        contextLabel: readableContext(row),
        locationDisplayLabel: typeof row.location_display_label === "string" && row.location_display_label.trim() ? row.location_display_label.trim() : null,
        battlePower: power,
        battleTier: battleTier(power),
        tradeValue: tradeValue(stats),
        rarity: stats.rarity ?? 0,
        gameStats: stats
    };
}

const PACK_CAPTURE_SELECT = [
    "capture_id",
    "capture_created_at",
    "is_discoverable",
    "is_challenge_ready",
    "challenge_health",
    "location_display_label",
    "image_bucket",
    "image_path",
    "animal_name",
    "scientific_name",
    "human_context",
    "zoo_or_wild",
    "game_stats",
    "normalized_identity_key",
    "dominance_boost",
    "speed_boost",
    "intelligence_boost",
    "comparison_dominance_boost",
    "comparison_speed_boost",
    "comparison_size_boost",
    "comparison_intelligence_boost",
    "comparison_rarity_boost",
    "completed_at",
    "error_message"
].join(",");

function isEligiblePackCapture(capture: TrainPackCapture) {
    return capture.isDiscoverable && capture.battlePower > 0;
}

export async function getTrainPackEligibleCaptures(limit = 160): Promise<TrainPackCapture[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return [];

    const [capturesResult, lockedResult] = await Promise.all([
        supabase
            .from("owned_capture_manifest_v1")
            .select(PACK_CAPTURE_SELECT)
            .eq("user_id", user.id)
            .eq("is_discoverable", true)
            .not("game_stats", "is", null)
            .order("capture_created_at", {ascending: false})
            .limit(limit),
        supabase
            .from("my_sealed_pack_locked_capture_ids_v1")
            .select("capture_id")
    ]);

    const locked = new Set(((lockedResult.data ?? []) as QueryRow[]).map((row) => String(row.capture_id ?? "")));

    return ((capturesResult.data ?? []) as QueryRow[])
        .map(toTrainPackCapture)
        .filter((capture): capture is TrainPackCapture => Boolean(capture))
        .filter((capture) => !locked.has(capture.captureId) && isEligiblePackCapture(capture))
        .sort((left, right) => {
            const tierDelta = tierRank(right.battleTier) - tierRank(left.battleTier);
            if (tierDelta !== 0) return tierDelta;
            const valueDelta = right.tradeValue - left.tradeValue;
            if (valueDelta !== 0) return valueDelta;
            return (right.capturedAt ?? "").localeCompare(left.capturedAt ?? "");
        });
}

export async function getTrainDailyCompanionState(): Promise<TrainDailyCompanionState> {
    const supabase = createSupabaseServerClient();
    const journals = await getAppJournalEntries(1);
    if (!supabase) {
        return {completedToday: false, journalCount: 0, recentJournalDate: journals[0]?.date ?? null};
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return {completedToday: false, journalCount: 0, recentJournalDate: null};
    }

    const today = new Date().toISOString().slice(0, 10);
    const [{count: journalCount}, challengeResult] = await Promise.all([
        supabase.from("daily_journal_logs").select("id", {count: "exact", head: true}).eq("user_id", user.id),
        supabase
            .from("apex_growth_challenges")
            .select("id")
            .eq("user_id", user.id)
            .eq("source", "daily_companion")
            .eq("challenge_date", today)
            .eq("status", "approved")
            .limit(1)
    ]);

    const completedToday = Boolean((challengeResult.data ?? []).length > 0);
    const todayJournal = journals.find((entry) => entry.date === today);

    return {
        completedToday: completedToday || Boolean(todayJournal),
        journalCount: journalCount ?? 0,
        recentJournalDate: journals[0]?.date ?? null
    };
}

export async function getTrainWildProfileState(): Promise<TrainWildProfileState> {
    const supabase = createSupabaseServerClient();
    const empty: TrainWildProfileState = {
        hasProfile: false,
        hasInProgressInterview: false,
        headline: null,
        summary: null,
        origin: null,
        apex: null,
        active: null,
        generatedAt: null
    };

    if (!supabase) return empty;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return empty;

    const [profileResult, sessionResult, speciesEntriesList] = await Promise.all([
        supabase
            .from("user_identity_profiles")
            .select("origin_species_profile_id,apex_species_profile_id,active_species_profile_id,origin_confidence,apex_confidence,active_confidence,public_summary,generated_at,status")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("generated_at", {ascending: false})
            .limit(1)
            .maybeSingle(),
        supabase
            .from("identity_questionnaire_sessions")
            .select("id,status")
            .eq("user_id", user.id)
            .in("status", ["in_progress", "ready_for_generation", "generating"])
            .order("created_at", {ascending: false})
            .limit(1),
        getUnifiedSpeciesEntries()
    ]);

    const speciesById = new Map<string, {name: string; slug: string | null}>();
    for (const entry of speciesEntriesList) {
        if (entry.speciesProfileId) {
            speciesById.set(entry.speciesProfileId, {name: entry.name, slug: entry.slug});
        }
    }

    const profile = profileResult.data as QueryRow | null;
    const hasInProgressInterview = Boolean((sessionResult.data ?? []).length > 0);

    if (!profile) {
        return {...empty, hasInProgressInterview};
    }

    const publicSummary = profile.public_summary && typeof profile.public_summary === "object" ? profile.public_summary : {};
    const role = (label: string, speciesId: string | null | undefined, confidence: number | null | undefined): TrainIdentityRole | null => {
        const resolved = speciesId ? speciesById.get(speciesId) : null;
        if (!resolved && !speciesId) return null;
        return {
            label,
            name: resolved?.name ?? "Unknown animal",
            speciesSlug: resolved?.slug ?? null,
            confidence: confidence != null ? Number(confidence) : null
        };
    };

    const [origin, apex, active] = [
        role("Origin", profile.origin_species_profile_id, profile.origin_confidence),
        role("Apex", profile.apex_species_profile_id, profile.apex_confidence),
        role("Active", profile.active_species_profile_id, profile.active_confidence)
    ];

    return {
        hasProfile: true,
        hasInProgressInterview,
        headline: publicSummary.headline?.trim() || "Wild Profile",
        summary: publicSummary.summary?.trim() || null,
        origin,
        apex,
        active,
        generatedAt: profile.generated_at ?? null
    };
}

export async function getTrainAnimalPacks(): Promise<TrainAnimalPack[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return [];

    const {data} = await supabase
        .from("animal_pack_marketplace_v1")
        .select("id,status,theme_title,theme_reason,pack_size,listed_price,guaranteed_minimum_tier,base_theme,specialty_theme,quality_band,rarity_band,guarantees_summary,platform_fee,seller_proceeds,created_at,purchased_at,opened_at,seller_user_id,buyer_user_id,seller_display_name,seller_username,seller_avatar_url,buyer_display_name,buyer_username")
        .or(`seller_user_id.eq.${user.id},buyer_user_id.eq.${user.id}`)
        .order("created_at", {ascending: false})
        .limit(24);

    return mapTrainAnimalPackRows((data ?? []) as QueryRow[], user.id);
}

export async function getTrainAnimalPackById(packId: string): Promise<TrainAnimalPack | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;

    const {data} = await supabase
        .from("animal_pack_marketplace_v1")
        .select("id,status,theme_title,theme_reason,pack_size,listed_price,guaranteed_minimum_tier,base_theme,specialty_theme,quality_band,rarity_band,guarantees_summary,platform_fee,seller_proceeds,created_at,purchased_at,opened_at,seller_user_id,buyer_user_id,seller_display_name,seller_username,seller_avatar_url,buyer_display_name,buyer_username")
        .eq("id", packId)
        .limit(1);

    return mapTrainAnimalPackRows((data ?? []) as QueryRow[], user.id)[0] ?? null;
}

export async function getTrainPackCapturesByIds(captureIds: string[]): Promise<TrainPackCapture[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase || captureIds.length === 0) return [];

    const {data} = await supabase
        .from("owned_capture_manifest_v1")
        .select(PACK_CAPTURE_SELECT)
        .in("capture_id", captureIds);

    const byId = new Map(
        ((data ?? []) as QueryRow[])
            .map(toTrainPackCapture)
            .filter((capture): capture is TrainPackCapture => Boolean(capture))
            .map((capture) => [capture.captureId, capture])
    );

    return captureIds.map((id) => byId.get(id)).filter((capture): capture is TrainPackCapture => Boolean(capture));
}

function mapTrainAnimalPackRows(rows: QueryRow[], userId: string): TrainAnimalPack[] {
    return rows.map((row) => ({
        id: row.id,
        status: row.status,
        themeTitle: row.theme_title?.trim() || "Sealed animal pack",
        themeReason: row.theme_reason?.trim() ?? null,
        packSize: Number(row.pack_size ?? 0),
        listedPrice: row.listed_price != null ? Number(row.listed_price) : null,
        guaranteedMinimumTier: row.guaranteed_minimum_tier?.trim() ?? null,
        baseTheme: row.base_theme?.trim() ?? null,
        specialtyTheme: row.specialty_theme?.trim() ?? null,
        qualityBand: row.quality_band?.trim() ?? null,
        rarityBand: row.rarity_band?.trim() ?? null,
        guaranteesSummary: row.guarantees_summary?.trim() ?? null,
        platformFee: row.platform_fee != null ? Number(row.platform_fee) : null,
        sellerProceeds: row.seller_proceeds != null ? Number(row.seller_proceeds) : null,
        createdAt: row.created_at ?? null,
        purchasedAt: row.purchased_at ?? null,
        openedAt: row.opened_at ?? null,
        sellerDisplayName: row.seller_display_name?.trim() || "Collector",
        sellerUsername: row.seller_username?.trim() || null,
        sellerAvatarUrl: row.seller_avatar_url?.trim() || null,
        buyerDisplayName: row.buyer_display_name?.trim() || null,
        buyerUsername: row.buyer_username?.trim() || null,
        isSeller: row.seller_user_id === userId,
        isBuyer: row.buyer_user_id === userId
    }));
}

export async function getArenaPageData(localePrefix: string): Promise<ArenaPageData> {
    const supabase = createSupabaseServerClient();
    const pagePromise = getTrainPageData(localePrefix);

    if (!supabase) {
        const page = await pagePromise;
        return {...page, opponentCount: 0};
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        const page = await pagePromise;
        return {...page, opponentCount: 0};
    }

    const [page, arena] = await Promise.all([
        pagePromise,
        getMatchupArena(user.id, 48).catch(() => [])
    ]);
    return {...page, opponentCount: arena.length};
}

/** @deprecated Use getArenaPageData */
export async function getTrainPageData(localePrefix: string): Promise<TrainPageData> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return emptyTrainPageData(localePrefix);

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return emptyTrainPageData(localePrefix);

    const [dailyCompanion, wildProfile, packs, activeMissions] = await Promise.all([
        getTrainDailyCompanionState(),
        getTrainWildProfileIndexStatus(supabase, user.id),
        getTrainPackIndexStatus(supabase, user.id),
        getTrainMissionIndexStatus(supabase, user.id)
    ]);

    return {
        modules: buildTrainModules(localePrefix, {
            dailyCompanion: dailyCompanion.completedToday ? "Complete today" : null,
            wildProfile: wildProfile.hasInProgressInterview
                ? "In progress"
                : wildProfile.hasProfile
                    ? "Profile ready"
                    : null,
            packs: packs.unopenedPacks > 0
                ? packs.unopenedPacks === 1 ? "1 ready to open" : `${packs.unopenedPacks} ready to open`
                : packs.canList ? "Ready to list" : null,
            missions: activeMissions > 0 ? `${activeMissions} active` : null
        })
    };
}

/** @deprecated Use getTrainPageData */
export async function getTrainModules(localePrefix: string): Promise<TrainModuleDefinition[]> {
    const {modules} = await getTrainPageData(localePrefix);
    return modules;
}
