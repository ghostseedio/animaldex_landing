import "server-only";

import {
    getAppCaptures,
    getAppJournalEntries,
    getAppProgression
} from "@/data/authenticated-app";
import {buildPowerSetAlbums, getCatalogPowerSetCount, summarizePowerSets} from "@/data/power-sets";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type QueryRow = Record<string, any>;

export type TrainModuleId = "dailyCompanion" | "wildProfile" | "packs" | "missions" | "sets";

export type TrainModuleDefinition = {
    id: TrainModuleId;
    href: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    thumbnailUrl: string;
    accentClass: string;
    statusLabel: string | null;
};

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

const TRAIN_THUMBNAILS = {
    dailyCompanion: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/batfish-journal-thumbnail.webp",
    wildProfile: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/lion-identity-thumbnail.webp",
    packs: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/create-a-pack-2-thumbnail.webp",
    missions: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/animaldex-missions-thumbnail.webp",
    sets: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/sets-thumbnail.webp"
};

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
        imageSrc: `/api/species-images/capture?captureId=${encodeURIComponent(captureId)}`,
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

export async function getTrainModules(localePrefix: string): Promise<TrainModuleDefinition[]> {
    const [captures, progression, dailyCompanion, wildProfile, packs, totalSetCount, eligiblePackCaptures] = await Promise.all([
        getAppCaptures(),
        getAppProgression(),
        getTrainDailyCompanionState(),
        getTrainWildProfileState(),
        getTrainAnimalPacks(),
        getCatalogPowerSetCount(),
        getTrainPackEligibleCaptures()
    ]);
    const powerSetAlbums = await buildPowerSetAlbums(captures);
    const powerSetSummary = summarizePowerSets(powerSetAlbums);
    const inProgressSetCount = powerSetSummary.inProgressCount;
    const startedSetCount = powerSetAlbums.filter((album) => album.found > 0).length;
    const activeMissionCount = progression.missions.filter((mission) => !mission.isLocked && mission.completedCount === 0).length;
    const unopenedPackCount = packs.filter((pack) => pack.isBuyer && pack.status === "sold" && !pack.openedAt).length;
    const modules: TrainModuleDefinition[] = [
        {
            id: "dailyCompanion",
            href: `${localePrefix}/app/train/daily-companion`,
            eyebrow: "Daily",
            title: "Daily Companion",
            subtitle: "Companion tasks, proofs, and stat growth.",
            thumbnailUrl: TRAIN_THUMBNAILS.dailyCompanion,
            accentClass: "text-primary-200",
            statusLabel: dailyCompanion.completedToday ? "Done today" : null
        },
        {
            id: "wildProfile",
            href: `${localePrefix}/app/train/wild-profile`,
            eyebrow: "Identity",
            title: "Wild Profile",
            subtitle: "Origin, Apex, and Active animal roles.",
            thumbnailUrl: TRAIN_THUMBNAILS.wildProfile,
            accentClass: "text-violet-300",
            statusLabel: wildProfile.hasInProgressInterview ? "In progress" : wildProfile.hasProfile ? "Complete" : null
        },
        {
            id: "packs",
            href: `${localePrefix}/app/train/packs`,
            eyebrow: "Sealed",
            title: "Your Packs",
            subtitle: "Open purchased packs or build a sealed listing.",
            thumbnailUrl: TRAIN_THUMBNAILS.packs,
            accentClass: "text-orange-300",
            statusLabel: unopenedPackCount > 0
                ? unopenedPackCount === 1 ? "1 unopened" : `${unopenedPackCount} unopened`
                : eligiblePackCaptures.length >= 10 ? "Ready" : null
        },
        {
            id: "missions",
            href: `${localePrefix}/app/missions`,
            eyebrow: "Progress",
            title: "Missions",
            subtitle: "Earn credits through progression milestones.",
            thumbnailUrl: TRAIN_THUMBNAILS.missions,
            accentClass: "text-primary-200",
            statusLabel: activeMissionCount > 0 ? `${activeMissionCount} active` : null
        },
        {
            id: "sets",
            href: `${localePrefix}/app/sets`,
            eyebrow: "Collect",
            title: "Sets",
            subtitle: "Track tailored set progress from your captures.",
            thumbnailUrl: TRAIN_THUMBNAILS.sets,
            accentClass: "text-primary-200",
            statusLabel: inProgressSetCount > 0
                ? totalSetCount > 0 ? `${inProgressSetCount}/${totalSetCount} in progress` : `${inProgressSetCount} in progress`
                : startedSetCount > 0 ? `${startedSetCount} started` : null
        }
    ];

    return modules;
}
