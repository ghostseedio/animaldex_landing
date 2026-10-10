import "server-only";

import {
    type AppProgression
} from "@/data/authenticated-app";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import type {PublicProfileCapture, ProfilePowerSetCompletion} from "@/data/public-profiles";
import {getAuthenticatedUserProfile} from "@/data/user-captures";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

type QueryRow = Record<string, any>;

export type ProfileViewerState = {
    isLoggedIn: boolean;
    isOwner: boolean;
    viewerUsername: string | null;
    viewerDisplayName: string | null;
    viewerAvatarUrl: string | null;
};

export type ProfileCreditsSummary = {
    balance: number;
    hasProAccess: boolean;
    isLow: boolean;
};

export type ProfileEndorsedCapture = PublicProfileCapture & {
    endorsedStat: string;
};

export type ProfileCompletedSet = {
    key: string;
    title: string;
    found: number;
    total: number;
    tier: "Gold" | "Silver" | "Bronze";
};

export type ProfileListedPack = {
    id: string;
    themeTitle: string;
    packSize: number;
    listedPrice: number;
    qualityBand: string | null;
    guaranteesSummary: string | null;
};

function toSpeciesSlug(identityKey: string | null | undefined) {
    const value = identityKey?.trim().toLowerCase().replace(/_/g, "-");
    return value || null;
}

function getContextLabel(row: {zoo_or_wild?: string | null; human_context?: string | null}) {
    const setting = row.zoo_or_wild?.trim();
    if (setting && setting !== "Unknown") return setting;

    switch (row.human_context?.trim()) {
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

function toCaptureFromFeedRow(
    row: QueryRow,
    speciesByIdentity: Map<string, string>
): PublicProfileCapture {
    const identitySlug = toSpeciesSlug(row.normalized_identity_key);
    const speciesSlug = identitySlug ? speciesByIdentity.get(identitySlug) ?? null : null;
    const stats = row.game_stats && typeof row.game_stats === "object" ? row.game_stats : {};

    return {
        id: row.capture_id,
        animalName: row.animal_name?.trim() || "AnimalDex capture",
        speciesSlug,
        score: Number(row.score ?? 0),
        capturedAt: row.capture_created_at ?? null,
        contextLabel: getContextLabel(row),
        href: speciesSlug ? `/animals/${speciesSlug}` : `/animals?q=${encodeURIComponent(row.animal_name?.trim() || "")}`,
        imageSrc: getCaptureImageRoute(row.capture_id),
        dominance: Number(stats.dominance ?? 0) + Number(row.dominance_boost ?? 0),
        speed: Number(stats.speed ?? 0) + Number(row.speed_boost ?? 0),
        size: Number(stats.size ?? 0),
        intelligence: Number(stats.intelligence ?? 0) + Number(row.intelligence_boost ?? 0),
        rarity: Number(stats.rarity ?? 0),
        isIndexed: Boolean(row.species_profile_id?.trim()),
        identityKind: row.identity_kind?.trim() || null,
        animalDexNumber: null,
        speciesProfileId: row.species_profile_id?.trim().toLowerCase() || null,
        isMovingMedia: false
    };
}

export async function getProfileViewerState(profileUserId: string): Promise<ProfileViewerState> {
    const viewer = await getAuthenticatedUserProfile();

    return {
        isLoggedIn: Boolean(viewer),
        isOwner: viewer?.id === profileUserId,
        viewerUsername: viewer?.username ?? null,
        viewerDisplayName: viewer?.displayName ?? null,
        viewerAvatarUrl: viewer?.avatarUrl ?? null
    };
}

export type ProfileFollowCounts = {followers: number; following: number};

export type ProfileViewStats = {thisWeek: number; previousWeek: number; allTime: number};

export type ProfileSocialState = {
    followCounts: ProfileFollowCounts | null;
    /** Owner only, as on iOS: the server omits it for anyone else. */
    profileViews: ProfileViewStats | null;
    isFollowing: boolean;
    isFriend: boolean;
    notificationPreference: "all" | "off";
};

const toCount = (value: unknown) => Math.max(0, Number(value) || 0);

/** Public counts for a signed-out visitor; the RPC is closed to anon, so the server reads it. */
async function fetchFollowCountsAsServer(profileUserId: string): Promise<ProfileFollowCounts | null> {
    const url = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!url || !key) return null;
    try {
        const response = await fetch(`${url}/rest/v1/rpc/get_profile_follow_counts`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({p_user_id: profileUserId}),
            cache: "no-store"
        });
        if (!response.ok) return null;
        const data = await response.json() as QueryRow | null;
        return data ? {followers: toCount(data.followers), following: toCount(data.following)} : null;
    } catch {
        return null;
    }
}

/**
 * Follow state, follow counts and (for the owner) profile views, read the way
 * iOS reads them. A signed-in visitor who is not the owner also records a view
 * here (`record_profile_view`: one per viewer per profile per UTC day, deduped
 * server-side), so web visits count exactly like app visits.
 */
export async function getProfileSocialState(profileUserId: string): Promise<ProfileSocialState> {
    const empty: ProfileSocialState = {followCounts: null, profileViews: null, isFollowing: false, isFriend: false, notificationPreference: "all"};
    const supabase = createSupabaseServerClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;

    if (!supabase || !user) {
        return {...empty, followCounts: await fetchFollowCountsAsServer(profileUserId)};
    }

    const isOwner = user.id === profileUserId;
    if (!isOwner) {
        // Counted before the overview is read is not required; failures never block the page.
        void Promise.resolve(supabase.rpc("record_profile_view", {p_profile_id: profileUserId, p_source: "profile_link"})).catch(() => undefined);
    }

    const [overview, follow, friend, preference] = await Promise.all([
        supabase.rpc("get_profile_stats_overview", {p_user_id: profileUserId, p_time_zone: "UTC"}),
        isOwner ? null : supabase.from("user_follows").select("followed_id").eq("follower_id", user.id).eq("followed_id", profileUserId).maybeSingle(),
        isOwner ? null : supabase.from("user_friendships_v1").select("friend_id").eq("friend_id", profileUserId).maybeSingle(),
        isOwner ? null : supabase.from("user_follow_notification_preferences").select("preference").eq("follower_id", user.id).eq("followed_id", profileUserId).maybeSingle()
    ]);

    const data = (overview.data ?? null) as QueryRow | null;
    const counts = data?.follow_counts as QueryRow | undefined;
    const views = data?.profile_views as QueryRow | undefined;

    return {
        followCounts: counts
            ? {followers: toCount(counts.followers), following: toCount(counts.following)}
            : await fetchFollowCountsAsServer(profileUserId),
        profileViews: isOwner && views
            ? {thisWeek: toCount(views.this_week), previousWeek: toCount(views.previous_week), allTime: toCount(views.all_time)}
            : null,
        isFollowing: Boolean(follow?.data),
        isFriend: Boolean(friend?.data),
        notificationPreference: (preference?.data as QueryRow | null)?.preference === "off" ? "off" : "all"
    };
}

export async function getProfileCreditsSummary(): Promise<ProfileCreditsSummary | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;

    const [balanceResult, profileResult] = await Promise.all([
        supabase.from("credit_balances").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("is_pro").eq("id", user.id).maybeSingle()
    ]);

    const balance = Number((balanceResult.data as QueryRow | null)?.balance ?? 0);
    const hasProAccess = Boolean((profileResult.data as QueryRow | null)?.is_pro);

    return {
        balance,
        hasProAccess,
        isLow: !hasProAccess && balance > 0 && balance <= 3
    };
}

export async function getOwnerProfileProgression(): Promise<AppProgression | null> {
    const viewer = await getAuthenticatedUserProfile();
    if (!viewer) return null;

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: summary} = await supabase
        .from("user_progression_summary_v1")
        .select("verified_overall_score,trade_unlock_score,trade_unlocked_at")
        .maybeSingle();

    let row = summary as QueryRow | null;
    if (!row) {
        const {data: profile} = await supabase
            .from("profiles")
            .select("verified_overall_score,trade_unlocked_at")
            .eq("id", viewer.id)
            .maybeSingle();
        row = profile as QueryRow | null;
    }

    const overallScore = Number(row?.verified_overall_score ?? 0);

    return {
        overallScore,
        tradeUnlockScore: Number(row?.trade_unlock_score ?? 1000),
        tradeUnlocked: Boolean(row?.trade_unlocked_at),
        referralCode: null,
        qualifiedReferrals: 0,
        missions: []
    };
}

export type OwnerTradeUnlockSummary = {
    verifiedOverallScore: number;
    requiredScore: number;
    tradeUnlocked: boolean;
};

export async function getOwnerTradeUnlockSummary(overallScore: number): Promise<OwnerTradeUnlockSummary | null> {
    const viewer = await getAuthenticatedUserProfile();
    if (!viewer) return null;

    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data: summary} = await supabase
        .from("user_progression_summary_v1")
        .select("trade_unlock_score,trade_unlocked_at")
        .maybeSingle();

    let row = summary as QueryRow | null;
    if (!row) {
        const {data: profile} = await supabase
            .from("profiles")
            .select("trade_unlocked_at")
            .eq("id", viewer.id)
            .maybeSingle();
        row = profile as QueryRow | null;
    }

    return {
        verifiedOverallScore: overallScore,
        requiredScore: Number(row?.trade_unlock_score ?? 1000),
        tradeUnlocked: Boolean(row?.trade_unlocked_at)
    };
}

function normalizeCompletedSetTier(tier: string): ProfileCompletedSet["tier"] {
    switch (tier.trim().toLowerCase()) {
        case "gold":
            return "Gold";
        case "silver":
            return "Silver";
        default:
            return "Bronze";
    }
}

export function buildOwnerCompletedSets(completions: ProfilePowerSetCompletion[]): ProfileCompletedSet[] {
    return completions.map((completion) => ({
        key: completion.powerKey,
        title: completion.powerLabel,
        found: completion.speciesCount,
        total: completion.catalogLinkedCount ?? completion.speciesCount,
        tier: normalizeCompletedSetTier(completion.tier)
    }));
}

export async function getOwnerEndorsedCaptures(limit = 12): Promise<ProfileEndorsedCapture[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return [];

    const {data: endorsementRows} = await supabase
        .from("capture_endorsements")
        .select("capture_id,endorsed_stat,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", {ascending: false})
        .limit(limit);

    const endorsements = (endorsementRows ?? []) as QueryRow[];
    const captureIds = endorsements.map((row) => row.capture_id).filter(Boolean);
    if (captureIds.length === 0) return [];

    const {data: feedRows} = await supabase
        .from("discover_feed_v1")
        .select("capture_id,animal_name,normalized_identity_key,species_profile_id,score,capture_created_at,human_context,zoo_or_wild,game_stats,dominance_boost,speed_boost,intelligence_boost,identity_kind")
        .in("capture_id", captureIds);

    const speciesEntries = await getUnifiedSpeciesEntries();
    const speciesByIdentity = new Map<string, string>();
    for (const entry of speciesEntries) {
        speciesByIdentity.set(entry.slug, entry.slug);
        if (entry.normalizedIdentityKey) {
            speciesByIdentity.set(toSpeciesSlug(entry.normalizedIdentityKey) ?? entry.slug, entry.slug);
        }
    }

    const capturesById = new Map(
        ((feedRows ?? []) as QueryRow[]).map((row) => [row.capture_id, toCaptureFromFeedRow(row, speciesByIdentity)])
    );

    return endorsements
        .map((row) => {
            const capture = capturesById.get(row.capture_id);
            if (!capture || !row.endorsed_stat) return null;
            return {...capture, endorsedStat: String(row.endorsed_stat)};
        })
        .filter((item): item is ProfileEndorsedCapture => Boolean(item));
}

export async function getMemberListedPacks(sellerUserId: string, limit = 12): Promise<ProfileListedPack[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const {data} = await supabase
        .from("animal_pack_marketplace_v1")
        .select("id,theme_title,pack_size,listed_price,quality_band,guarantees_summary")
        .eq("seller_user_id", sellerUserId)
        .eq("status", "listed")
        .order("created_at", {ascending: false})
        .limit(limit);

    return ((data ?? []) as QueryRow[]).map((row) => ({
        id: row.id,
        themeTitle: row.theme_title?.trim() || "Sealed animal pack",
        packSize: Number(row.pack_size ?? 0),
        listedPrice: Number(row.listed_price ?? 0),
        qualityBand: row.quality_band?.trim() ?? null,
        guaranteesSummary: row.guarantees_summary?.trim() ?? null
    }));
}