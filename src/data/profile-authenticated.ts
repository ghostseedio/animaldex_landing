import "server-only";

import {
    getAppCaptures,
    getAppProgression,
    type AppProgression
} from "@/data/authenticated-app";
import {buildPowerSetAlbums} from "@/data/power-sets";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import type {PublicProfileCapture} from "@/data/public-profiles";
import {getAuthenticatedUserProfile} from "@/data/user-captures";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type QueryRow = Record<string, any>;

export type ProfileViewerState = {
    isLoggedIn: boolean;
    isOwner: boolean;
    viewerUsername: string | null;
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
        isIndexed: Boolean(row.species_profile_id?.trim())
    };
}

export async function getProfileViewerState(profileUserId: string): Promise<ProfileViewerState> {
    const viewer = await getAuthenticatedUserProfile();

    return {
        isLoggedIn: Boolean(viewer),
        isOwner: viewer?.id === profileUserId,
        viewerUsername: viewer?.username ?? null
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
    return getAppProgression();
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
        .select("capture_id,animal_name,normalized_identity_key,species_profile_id,score,capture_created_at,human_context,zoo_or_wild,game_stats,dominance_boost,speed_boost,intelligence_boost")
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

export async function getOwnerCompletedSets(): Promise<ProfileCompletedSet[]> {
    const captures = await getAppCaptures();
    const albums = await buildPowerSetAlbums(captures);

    return albums
        .map((album) => {
            const tier = album.isGoldMastered ? "Gold" : album.isCompleted ? "Silver" : null;

            if (!tier) {
                return null;
            }

            return {
                key: album.key,
                title: album.title,
                found: album.found,
                total: album.catalogLinkedCount || album.activeTier?.targetCount || album.found,
                tier
            };
        })
        .filter((set): set is ProfileCompletedSet => Boolean(set));
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