import "server-only";

import {getSpeciesBySlug, speciesEntries} from "@/data/species";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {getSpeciesImageRoute} from "@/data/species-images";
import {getAuthenticatedUserProfile, getUserCaptures, UserCaptureSummary} from "@/data/user-captures";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type AppProfile = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUserProfile>>>;

export type AppCapture = UserCaptureSummary & {
    scientificName: string | null;
    category: string | null;
    href: string;
    imageSrc: string;
};

export type AppMission = {
    slug: string;
    tier: string;
    title: string;
    detail: string;
    rewardCredits: number;
    targetCount: number;
    progressCount: number;
    completedCount: number;
    isRepeatable: boolean;
    isLocked: boolean;
};

export type AppProgression = {
    overallScore: number;
    tradeUnlockScore: number;
    tradeUnlocked: boolean;
    referralCode: string | null;
    qualifiedReferrals: number;
    missions: AppMission[];
};

export type AppNotification = {
    id: string;
    captureId: string;
    tradeOfferId: string | null;
    creditOfferId: string | null;
    eventType: string;
    likeCount: number | null;
    endorsedStat: string | null;
    createdAt: string;
    readAt: string | null;
};

export type AppTrade = {
    id: string;
    offererUserId: string;
    receiverUserId: string;
    offererCaptureId: string;
    receiverCaptureId: string;
    offererName: string;
    receiverName: string;
    offererValue: number;
    receiverValue: number;
    status: string;
    createdAt: string;
    expiresAt: string;
    offererSlug: string | null;
    receiverSlug: string | null;
};

export type AppAlbum = {
    id: string;
    name: string;
    captureIds: string[];
};

export type AppPowerSet = {
    key: string;
    title: string;
    total: number;
    found: number;
    captureIds: string[];
};

function findSpeciesForCaptureIdentity(identity: string | null | undefined) {
    if (!identity) {
        return null;
    }

    const normalized = identity.trim().toLowerCase();

    return speciesEntries.find((entry) => entry.slug === normalized
        || entry.slug === normalized.replace(/_/g, "-")
        || entry.normalizedIdentityKey?.toLowerCase() === normalized
        || entry.speciesProfileId?.toLowerCase() === normalized) ?? null;
}

async function findSpeciesForCaptureIdentityAsync(identity: string | null | undefined) {
    if (!identity) {
        return null;
    }

    const normalized = identity.trim().toLowerCase();
    const staticMatch = findSpeciesForCaptureIdentity(normalized);

    if (staticMatch) {
        return staticMatch;
    }

    const unified = await getUnifiedSpeciesEntries();

    return unified.find((entry) => entry.slug === normalized
        || entry.slug === normalized.replace(/_/g, "-")
        || entry.normalizedIdentityKey?.toLowerCase() === normalized
        || entry.speciesProfileId?.toLowerCase() === normalized) ?? null;
}

export type AppJournalEntry = {
    id: string;
    date: string;
    problem: string;
    insight: string | null;
    score: number | null;
    tier: string | null;
    state: string;
};

export type AppDiscoverItem = {
    captureId: string;
    animalName: string;
    speciesSlug: string | null;
    score: number;
    createdAt: string | null;
    contextLabel: string | null;
    locationLabel: string | null;
    collectorName: string;
    collectorUsername: string | null;
    ownerUserId: string;
    likeCount: number;
    href: string;
    imageSrc: string;
};

export type AppCaptureDetail = {
    id: string;
    status: string;
    createdAt: string;
    locationLabel: string | null;
    animalName: string;
    scientificName: string | null;
    speciesSlug: string | null;
    breed: string | null;
    context: string | null;
    conservationTier: string | null;
    confidence: number | null;
    typeTags: string[];
    gameStats: Record<string, number>;
    premiumDetails: Record<string, any> | null;
    imageSrc: string;
};

type QueryRow = Record<string, any>;

export function decorateCapture(capture: UserCaptureSummary): AppCapture {
    const species = findSpeciesForCaptureIdentity(capture.speciesSlug);
    return {
        ...capture,
        scientificName: species?.analysis.scientificName ?? null,
        category: species?.analysis.category ?? null,
        href: species ? `/animals/${species.slug}` : "/animals",
        imageSrc: species
            ? getSpeciesImageRoute(species.slug, capture.captureId)
            : "/images/placeholders/species-no-image.svg"
    };
}

export async function decorateCaptureAsync(capture: UserCaptureSummary): Promise<AppCapture> {
    const species = await findSpeciesForCaptureIdentityAsync(capture.speciesSlug);

    return {
        ...capture,
        scientificName: species?.analysis.scientificName ?? null,
        category: species?.analysis.category ?? null,
        href: species ? `/animals/${species.slug}` : "/animals",
        imageSrc: species
            ? getSpeciesImageRoute(species.slug, capture.captureId)
            : "/images/placeholders/species-no-image.svg"
    };
}

export async function getAuthenticatedAppContext() {
    const profile = await getAuthenticatedUserProfile();
    if (!profile) return null;
    return {profile};
}

export async function getAppCaptures(limit = 160) {
    const captures = await getUserCaptures(limit);

    return Promise.all(captures.map(decorateCaptureAsync));
}

export function getCaptureStats(captures: AppCapture[]) {
    const uniqueSpecies = new Set(captures.map((capture) => capture.speciesSlug || capture.animalName.toLowerCase())).size;
    return {
        captureCount: captures.length,
        uniqueSpecies,
        collectorScore: captures.reduce((sum, capture) => sum + capture.score, 0),
        wild: captures.filter((capture) => capture.contextLabel === "Wild").length,
        zoo: captures.filter((capture) => capture.contextLabel === "Zoo").length,
        domestic: captures.filter((capture) => capture.contextLabel === "Domestic" || capture.contextLabel === "Farm").length,
        catalogSize: speciesEntries.length
    };
}

export async function getAppProgression(): Promise<AppProgression> {
    const supabase = createSupabaseServerClient();
    const fallback: AppProgression = {overallScore: 0, tradeUnlockScore: 1000, tradeUnlocked: false, referralCode: null, qualifiedReferrals: 0, missions: []};
    if (!supabase) return fallback;

    await supabase.rpc("refresh_user_progression", {});
    const [summaryResult, missionsResult] = await Promise.all([
        supabase.from("user_progression_summary_v1").select("verified_overall_score,trade_unlock_score,trade_unlocked_at,referral_code,qualified_referral_count").limit(1).maybeSingle(),
        supabase.from("user_mission_status_v1").select("slug,tier,sort_order,title,detail,reward_credits,target_count,progress_count,unlock_score_min,requires_trade_unlocked,is_repeatable,completed_count").order("sort_order", {ascending: true})
    ]);
    const summary = summaryResult.data as QueryRow | null;
    const rows = (missionsResult.data ?? []) as QueryRow[];
    const overallScore = Number(summary?.verified_overall_score ?? 0);
    const tradeUnlocked = Boolean(summary?.trade_unlocked_at);

    return {
        overallScore,
        tradeUnlockScore: Number(summary?.trade_unlock_score ?? 1000),
        tradeUnlocked,
        referralCode: summary?.referral_code ?? null,
        qualifiedReferrals: Number(summary?.qualified_referral_count ?? 0),
        missions: rows.map((row) => ({
            slug: row.slug,
            tier: row.tier,
            title: row.title,
            detail: row.detail,
            rewardCredits: Number(row.reward_credits ?? 0),
            targetCount: Number(row.target_count ?? 1),
            progressCount: Number(row.progress_count ?? 0),
            completedCount: Number(row.completed_count ?? 0),
            isRepeatable: Boolean(row.is_repeatable),
            isLocked: overallScore < Number(row.unlock_score_min ?? 0) || (Boolean(row.requires_trade_unlocked) && !tradeUnlocked)
        }))
    };
}

export async function getAppNotifications(limit = 40): Promise<AppNotification[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("user_notifications")
        .select("id,capture_id,trade_offer_id,credit_offer_id,event_type,like_count,endorsed_stat,created_at,read_at")
        .order("created_at", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        captureId: row.capture_id,
        tradeOfferId: row.trade_offer_id ?? null,
        creditOfferId: row.credit_offer_id ?? null,
        eventType: row.event_type,
        likeCount: row.like_count ?? null,
        endorsedStat: row.endorsed_stat ?? null,
        createdAt: row.created_at,
        readAt: row.read_at ?? null
    }));
}

export async function getAppDiscoverFeed(limit = 18): Promise<AppDiscoverItem[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("discover_feed_v1")
        .select("capture_id,user_id,animal_name,normalized_identity_key,score,capture_created_at,human_context,zoo_or_wild,location_display_label,profile_display_name,profile_username")
        .order("capture_created_at", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => {
        const slug = row.normalized_identity_key?.trim() || null;
        const species = slug ? getSpeciesBySlug(slug) : null;
        return {
            captureId: row.capture_id,
            animalName: row.animal_name || "Animal",
            speciesSlug: slug,
            score: Number(row.score ?? 0),
            createdAt: row.capture_created_at ?? null,
            contextLabel: row.zoo_or_wild && row.zoo_or_wild !== "Unknown" ? row.zoo_or_wild : row.human_context ?? null,
            locationLabel: row.location_display_label ?? null,
            collectorName: row.profile_display_name || (row.profile_username ? `@${row.profile_username}` : "AnimalDex collector"),
            collectorUsername: row.profile_username?.trim() ?? null,
            ownerUserId: row.user_id,
            likeCount: 0,
            href: species ? `/animals/${species.slug}` : "/animals",
            imageSrc: species ? getSpeciesImageRoute(species.slug, row.capture_id) : "/images/placeholders/species-no-image.svg"
        };
    });
}

export async function getAppCaptureDetail(id: string): Promise<AppCaptureDetail | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;
    const {data} = await supabase.from("captures")
        .select("id,status,created_at,location_display_label,analysis_results(animal_name,scientific_name,normalized_identity_key,breed_guess,human_context,zoo_or_wild,conservation_tier,confidence,type_tags,game_stats,premium_details,error_message,completed_at)")
        .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!data) return null;
    const row = data as QueryRow;
    const analysis = Array.isArray(row.analysis_results) ? row.analysis_results[0] : row.analysis_results;
    if (!analysis || analysis.error_message || !analysis.completed_at) return null;
    const slug = analysis.normalized_identity_key ?? null;
    const species = slug ? getSpeciesBySlug(slug) : null;
    const stats = analysis.game_stats && typeof analysis.game_stats === "object" ? analysis.game_stats : {};
    return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        locationLabel: row.location_display_label ?? null,
        animalName: analysis.animal_name || "Animal",
        scientificName: analysis.scientific_name ?? null,
        speciesSlug: slug,
        breed: analysis.breed_guess ?? null,
        context: analysis.zoo_or_wild && analysis.zoo_or_wild !== "Unknown" ? analysis.zoo_or_wild : analysis.human_context ?? null,
        conservationTier: analysis.conservation_tier ?? null,
        confidence: analysis.confidence ?? null,
        typeTags: Array.isArray(analysis.type_tags) ? analysis.type_tags : [],
        gameStats: stats,
        premiumDetails: analysis.premium_details ?? null,
        imageSrc: species ? getSpeciesImageRoute(species.slug, id) : "/images/placeholders/species-no-image.svg"
    };
}

export async function getAppTrades(limit = 40): Promise<AppTrade[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("trade_offer_detail_v1")
        .select("id,offerer_user_id,receiver_user_id,offerer_capture_id,receiver_capture_id,offerer_trade_value,receiver_trade_value,status,created_at,expires_at,offerer_animal_name,receiver_animal_name")
        .order("created_at", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        offererUserId: row.offerer_user_id,
        receiverUserId: row.receiver_user_id,
        offererCaptureId: row.offerer_capture_id,
        receiverCaptureId: row.receiver_capture_id,
        offererName: row.offerer_animal_name || "Animal",
        receiverName: row.receiver_animal_name || "Animal",
        offererValue: Number(row.offerer_trade_value ?? 0),
        receiverValue: Number(row.receiver_trade_value ?? 0),
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        offererSlug: speciesEntries.find((entry) => entry.name.toLowerCase() === String(row.offerer_animal_name || "").toLowerCase())?.slug ?? null,
        receiverSlug: speciesEntries.find((entry) => entry.name.toLowerCase() === String(row.receiver_animal_name || "").toLowerCase())?.slug ?? null
    }));
}

export async function getAppAlbums(): Promise<AppAlbum[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("albums").select("id,name,sort_order,album_items(capture_id,sort_order)").order("sort_order", {ascending: true});
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        captureIds: (row.album_items ?? []).sort((a: QueryRow, b: QueryRow) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)).map((item: QueryRow) => item.capture_id)
    }));
}

export {getAppPowerSets} from "@/data/power-sets";

export async function getAppJournalEntries(limit = 20): Promise<AppJournalEntry[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data} = await supabase.from("daily_journal_logs")
        .select("id,log_date,user_problem,generated_insight,alignment_score,alignment_tier,completion_state")
        .order("log_date", {ascending: false}).limit(limit);
    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        date: row.log_date,
        problem: row.user_problem,
        insight: row.generated_insight ?? null,
        score: row.alignment_score ?? null,
        tier: row.alignment_tier ?? null,
        state: row.completion_state
    }));
}
