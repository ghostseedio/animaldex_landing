import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import type {GuideBought, GuideCard, GuideDetail, GuideEarnings, GuideSale, MyWildlifeGuides} from "@/lib/virtual-wildlife-guides";
import type {GuideLocationQuery} from "@/data/wildlife-guide-locations";

export type PublicGuideQuery = {
    userId?: string | null;
    speciesProfileId?: string | null;
    countryCode?: string | null;
    near?: {lat: number; lng: number; radiusM?: number} | null;
    limit?: number;
    /** Seconds; animal pages refresh daily and pass 86400 so guides don't refresh them sooner. */
    revalidate?: number;
};

/** Public wild sightings of one species by town-level place (get_public_species_sightings). */
export type SpeciesSightings = {
    threatened: boolean;
    sightingCount: number;
    explorerCount: number;
    monthCounts: number[];
    places: {place?: string; countryCode?: string; sightings: number; explorers: number; months?: number[]; lastSeenMonth?: string}[];
};

/**
 * The profile Shop's guides. The owner gets every guide (all states), the
 * places still growing into one and their sharing settings; anyone else gets
 * the person's public guides. Null when the owner's list could not be read.
 */
export type VirtualGuideProfile =
    | {kind: "owner"; mine: MyWildlifeGuides | null}
    | {kind: "public"; guides: GuideCard[]};

export async function getVirtualGuideProfile(userId: string, isOwner: boolean): Promise<VirtualGuideProfile> {
    if (isOwner) {
        const supabase = createSupabaseServerClient();
        if (!supabase) return {kind: "owner", mine: null};
        const {data, error} = await supabase.rpc("get_my_wildlife_guides");
        if (error || !data || typeof data !== "object") return {kind: "owner", mine: null};
        return {kind: "owner", mine: normalizeMyGuides(data as Record<string, unknown>)};
    }
    return {kind: "public", guides: await getPublicWildlifeGuides({userId, limit: 50})};
}

export function normalizeMyGuides(payload: Record<string, unknown>): MyWildlifeGuides {
    const settings = (payload.settings ?? {}) as Record<string, unknown>;
    return {
        settings: {
            autoPublish: typeof settings.autoPublish === "boolean" ? settings.autoPublish : true,
            ...(typeof settings.noticeAcknowledgedAt === "string" ? {noticeAcknowledgedAt: settings.noticeAcknowledgedAt} : {}),
            ...(typeof settings.locationVisibility === "string" ? {locationVisibility: settings.locationVisibility} : {}),
            ...(typeof settings.termsAccepted === "boolean" ? {termsAccepted: settings.termsAccepted} : {}),
            ...(typeof settings.termsVersion === "string" ? {termsVersion: settings.termsVersion} : {})
        },
        publicEnabled: payload.publicEnabled === true,
        minSpecies: typeof payload.minSpecies === "number" ? payload.minSpecies : 3,
        guides: Array.isArray(payload.guides) ? payload.guides as GuideCard[] : [],
        growing: Array.isArray(payload.growing) ? payload.growing as MyWildlifeGuides["growing"] : [],
        sales: Array.isArray(payload.sales) ? payload.sales as GuideSale[] : [],
        ...(payload.earnings && typeof payload.earnings === "object" ? {earnings: payload.earnings as GuideEarnings} : {})
    };
}

async function publicRpc<T>(name: string, body: Record<string, unknown>, revalidate: number, tags: string[]): Promise<T | null> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return null;
    try {
        const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
            body: JSON.stringify(body),
            next: {revalidate, tags}
        });
        if (!response.ok) return null;
        return await response.json() as T;
    } catch {
        return null;
    }
}

/**
 * Published, public virtual guides. Empty until the owner turns on
 * `virtual_guide_config.public_enabled`, so every caller must handle [].
 */
export async function getPublicWildlifeGuides(query: PublicGuideQuery = {}): Promise<GuideCard[]> {
    const body = {
        p_user_id: query.userId ?? null,
        p_species_profile_id: query.speciesProfileId ?? null,
        p_country_code: query.countryCode ? query.countryCode.toUpperCase() : null,
        p_near_lat: query.near?.lat ?? null,
        p_near_lng: query.near?.lng ?? null,
        p_radius_m: query.near?.radiusM ?? 50000,
        p_cursor: null,
        p_limit: Math.min(Math.max(query.limit ?? 50, 1), 50)
    };
    const tags = ["public-wildlife-guides", ...(query.userId ? [`public-wildlife-guides-${query.userId}`] : [])];
    const value = await publicRpc<unknown>("get_public_wildlife_guides", body, query.revalidate ?? 300, tags);
    return Array.isArray(value) ? value as GuideCard[] : [];
}

/**
 * Where explorers saw a species in the wild. Threatened species only list
 * countries. Cached for a day, like the animal pages that show it.
 */
export async function getPublicSpeciesSightings(speciesProfileId: string): Promise<SpeciesSightings | null> {
    const value = await publicRpc<SpeciesSightings>(
        "get_public_species_sightings",
        {p_species_profile_id: speciesProfileId, p_limit: 8},
        86400,
        ["species-sightings"]
    );
    return value && Array.isArray(value.places) ? value : null;
}

/** Public guides for a location page: by country, or near the place's centre. */
export function getPublicWildlifeGuidesForLocation(query: GuideLocationQuery) {
    return getPublicWildlifeGuides(query.kind === "country"
        ? {countryCode: query.countryCode, limit: 50}
        : {near: {lat: query.lat, lng: query.lng, radiusM: query.radiusM}, limit: 50});
}

/** Every public guide, paged by publish date (sitemap and index page). */
export async function getAllPublicWildlifeGuides(maxPages = 40): Promise<GuideCard[]> {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) return [];
    const guides: GuideCard[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page += 1) {
        const rows: GuideCard[] = await publicRpc<unknown>(
            "get_public_wildlife_guides",
            {p_cursor: cursor, p_limit: 50},
            300,
            ["public-wildlife-guides"]
        ).then((value) => (Array.isArray(value) ? value as GuideCard[] : []));
        guides.push(...rows);
        const next: string | undefined = rows[rows.length - 1]?.publishedAt;
        if (rows.length < 50 || !next || next === cursor) break;
        cursor = next;
    }
    return Array.from(new Map(guides.map((guide) => [guide.id, guide])).values());
}

export async function getPublicWildlifeGuide(listingId: string): Promise<GuideDetail | null> {
    const value = await publicRpc<unknown>("get_public_wildlife_guide", {p_listing_id: listingId}, 300, [`public-wildlife-guide-${listingId}`]);
    return value && typeof value === "object" && !Array.isArray(value) && "id" in value ? value as GuideDetail : null;
}

export async function getMyWildlifeGuides(): Promise<MyWildlifeGuides | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data, error} = await supabase.rpc("get_my_wildlife_guides");
    if (error || !data || typeof data !== "object") return null;
    return normalizeMyGuides(data as Record<string, unknown>);
}

export async function getMyWildlifeGuide(listingId: string): Promise<GuideDetail | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data, error} = await supabase.rpc("get_my_wildlife_guide", {p_listing_id: listingId});
    if (error || !data || typeof data !== "object") return null;
    return data as GuideDetail;
}

/** Guides the signed-in person bought, newest first (refunded ones too). */
export async function getMyWildlifeGuidePurchases(): Promise<GuideBought[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    const {data, error} = await supabase.rpc("get_my_wildlife_guide_purchases");
    if (error || !Array.isArray(data)) return [];
    return data as GuideBought[];
}

/** A guide the signed-in person bought, even if the author has since paused it. */
export async function getBoughtWildlifeGuide(listingId: string): Promise<GuideDetail | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data, error} = await supabase.rpc("get_bought_wildlife_guide", {p_listing_id: listingId});
    if (error || !data || typeof data !== "object") return null;
    return data as GuideDetail;
}
