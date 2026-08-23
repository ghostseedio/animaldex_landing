import "server-only";
import {getSupabaseHeaders, getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";
import type {PublicGuideListing} from "@/lib/guide-marketplace-core";

const PAGE_SIZE = 50;
const MAX_PAGES = 100;

function configuration() {
    const url = getSupabaseUrl();
    const key = getSupabasePublicKey();
    if (!url || !key) throw new Error("Public Guide data is not configured.");
    return {url, key};
}

async function fetchPage(cursor: string | null, userId: string | null = null): Promise<PublicGuideListing[]> {
    const {url, key} = configuration();
    const response = await fetch(`${url}/rest/v1/rpc/get_public_guide_listings`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
        body: JSON.stringify({p_user_id: userId, p_cursor: cursor, p_limit: PAGE_SIZE}),
        next: {revalidate: 300, tags: ["public-guide-listings"]}
    });
    if (!response.ok) throw new Error(`Public Guide service returned ${response.status}.`);
    const value = await response.json();
    if (!Array.isArray(value)) throw new Error("Public Guide service returned an invalid response.");
    return value as PublicGuideListing[];
}

export async function getPublicGuideListings() {
    const listings: PublicGuideListing[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
        const rows: PublicGuideListing[] = await fetchPage(cursor);
        listings.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        const nextCursor: string | undefined = rows[rows.length - 1]?.published_at;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
    }
    return Array.from(new Map(listings.map((listing) => [listing.id, listing])).values());
}

export async function getPublicGuideListing(listingId: string) {
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
        const rows: PublicGuideListing[] = await fetchPage(cursor);
        const listing = rows.find((item: PublicGuideListing) => item.id.toLowerCase() === listingId.toLowerCase());
        if (listing) return listing;
        if (rows.length < PAGE_SIZE) return null;
        const nextCursor: string | undefined = rows[rows.length - 1]?.published_at;
        if (!nextCursor || nextCursor === cursor) return null;
        cursor = nextCursor;
    }
    return null;
}
