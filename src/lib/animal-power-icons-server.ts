import "server-only";

import {
    ANIMAL_POWER_ICON_BATCH_LIMIT,
    ANIMAL_POWER_ICON_TABLE,
    decodeAnimalPowerIconRows,
    isAnimalPowerIconId
} from "@/lib/animal-power-icon";
import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

export const ANIMAL_POWER_ICON_REVALIDATE_SECONDS = 3600;
const ANIMAL_POWER_ICON_TIMEOUT_MS = 6_000;

/**
 * Stored icon SVGs for these species, keyed by lower-cased species id. Species
 * without an icon are simply absent.
 *
 * Icons are an enhancement: any failure resolves to "no icons", so a page never
 * breaks over one. `revalidate` is the ISR window of the fetch; on a static page
 * it also lowers the route's own window, so callers there pass the page's.
 */
export async function fetchAnimalPowerIcons(
    speciesProfileIds: readonly (string | null | undefined)[],
    {revalidate = ANIMAL_POWER_ICON_REVALIDATE_SECONDS}: {revalidate?: number} = {}
): Promise<Record<string, string>> {
    const ids = Array.from(new Set(
        speciesProfileIds.filter(isAnimalPowerIconId).map((id) => id.toLowerCase())
    )).sort();
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!ids.length || !supabaseUrl || !key) return {};

    const batches: string[][] = [];
    for (let index = 0; index < ids.length; index += ANIMAL_POWER_ICON_BATCH_LIMIT) {
        batches.push(ids.slice(index, index + ANIMAL_POWER_ICON_BATCH_LIMIT));
    }

    const results = await Promise.all(batches.map(async (batch) => {
        const search = new URLSearchParams({
            select: "species_profile_id,svg",
            species_profile_id: `in.(${batch.join(",")})`
        });
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/${ANIMAL_POWER_ICON_TABLE}?${search.toString()}`, {
                headers: getSupabaseHeaders(key, {Accept: "application/json"}),
                next: {revalidate},
                signal: AbortSignal.timeout(ANIMAL_POWER_ICON_TIMEOUT_MS)
            });
            if (!response.ok) return {};
            return decodeAnimalPowerIconRows(await response.json());
        } catch {
            return {};
        }
    }));

    return Object.assign({}, ...results) as Record<string, string>;
}

/** One species' icon SVG, or null. */
export async function fetchAnimalPowerIcon(
    speciesProfileId: string | null | undefined,
    options?: {revalidate?: number}
): Promise<string | null> {
    if (!isAnimalPowerIconId(speciesProfileId)) return null;
    const icons = await fetchAnimalPowerIcons([speciesProfileId], options);
    return icons[speciesProfileId.toLowerCase()] ?? null;
}

/** Every stored icon, by species id and by the Power name it was drawn for. */
export type AnimalPowerIconIndex = {
    byId: Record<string, string>;
    byName: Record<string, string>;
};

const INDEX_PAGE_SIZE = 1000; // PostgREST's row cap per read.
const INDEX_MAX_PAGES = 10;

function powerNameKey(name: string): string {
    return name.trim().toLowerCase();
}

/**
 * The whole icon table, for static pages built from the published snapshots.
 *
 * Those snapshots (published-seo-lesson-pages.json) carry the Power's NAME but
 * not always its species id, and can lag a rename. Power names are unique, so
 * a lookup by the displayed name returns exactly the icon drawn for that name;
 * the species id is the fallback. Each page of rows stays well under Next's
 * 2 MB data-cache entry limit; the in-process memo below makes it one read per window.
 */
export function fetchAnimalPowerIconIndex(
    {revalidate = ANIMAL_POWER_ICON_REVALIDATE_SECONDS}: {revalidate?: number} = {}
): Promise<AnimalPowerIconIndex> {
    // One read per process per window, whatever Next's data cache does. The table's pages
    // (~2,600 SVGs) were failing to write to the fetch cache during `next build`
    // ("Failed to set fetch cache", EPIPE), so every one of thousands of static pages
    // re-downloaded the whole table and CI page generation went from ~8 min past the 2 h
    // job limit. An empty result (Supabase unreachable) is not kept, so the next call retries.
    const now = Date.now();
    const hit = iconIndexMemo.get(revalidate);
    if (hit && now - hit.at < revalidate * 1000) return hit.promise;
    const promise = loadAnimalPowerIconIndex(revalidate).then((index) => {
        if (!Object.keys(index.byId).length) iconIndexMemo.delete(revalidate);
        return index;
    });
    iconIndexMemo.set(revalidate, {at: now, promise});
    return promise;
}

const iconIndexMemo = new Map<number, {at: number; promise: Promise<AnimalPowerIconIndex>}>();

async function loadAnimalPowerIconIndex(revalidate: number): Promise<AnimalPowerIconIndex> {
    const index: AnimalPowerIconIndex = {byId: {}, byName: {}};
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!supabaseUrl || !key) return index;

    for (let page = 0; page < INDEX_MAX_PAGES; page++) {
        const search = new URLSearchParams({
            select: "species_profile_id,principle_name_at_authoring,svg",
            order: "species_profile_id",
            limit: String(INDEX_PAGE_SIZE),
            offset: String(page * INDEX_PAGE_SIZE)
        });
        let rows: unknown;
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/${ANIMAL_POWER_ICON_TABLE}?${search.toString()}`, {
                headers: getSupabaseHeaders(key, {Accept: "application/json"}),
                next: {revalidate},
                signal: AbortSignal.timeout(ANIMAL_POWER_ICON_TIMEOUT_MS)
            });
            if (!response.ok) break;
            rows = await response.json();
        } catch {
            break;
        }
        if (!Array.isArray(rows)) break;
        Object.assign(index.byId, decodeAnimalPowerIconRows(rows));
        for (const row of rows as Array<{species_profile_id?: unknown; principle_name_at_authoring?: unknown}>) {
            const id = typeof row.species_profile_id === "string" ? row.species_profile_id.toLowerCase() : null;
            const name = typeof row.principle_name_at_authoring === "string" ? powerNameKey(row.principle_name_at_authoring) : null;
            const svg = id ? index.byId[id] : undefined;
            if (name && svg) index.byName[name] = svg;
        }
        if (rows.length < INDEX_PAGE_SIZE) break;
    }
    return index;
}

/** The icon for a Power as a page shows it: by its name first, then its species. */
export function resolveAnimalPowerIcon(
    index: AnimalPowerIconIndex,
    {principleName, speciesProfileId}: {principleName?: string | null; speciesProfileId?: string | null}
): string | null {
    if (principleName) {
        const byName = index.byName[powerNameKey(principleName)];
        if (byName) return byName;
    }
    return isAnimalPowerIconId(speciesProfileId) ? index.byId[speciesProfileId.toLowerCase()] ?? null : null;
}
