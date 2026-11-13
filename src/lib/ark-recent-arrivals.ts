/**
 * /ark's "Latest aboard" (CC 3, 2026-11-13): the species that most recently
 * came aboard, from the event log's `arrival` rows joined to the species'
 * names and page slugs. One row per species, the newest first; species and
 * time only, never who brought an animal. Pure; the read is
 * `src/data/ark-recent-arrivals.ts`.
 */

export type ArkArrivalEventRow = {at?: unknown; species_profile_id?: unknown};
export type ArkSpeciesNameRow = {id?: unknown; display_name?: unknown; landing_page_slug?: unknown};

export type ArkRecentArrival = {
    speciesProfileId: string;
    name: string;
    /** The species page's slug, when it has one. */
    slug: string | null;
    /** When the newest one of its kind came aboard (ISO). */
    at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idText(value: unknown): string | null {
    return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The distinct species of the newest arrivals (rows newest first), at most `limit`, in that order. */
export function recentArrivalSpeciesIds(rows: ArkArrivalEventRow[], limit = 20): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        const id = idText(row.species_profile_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        if (ids.length >= limit) break;
    }
    return ids;
}

/** The arrivals in words: each species once (its newest arrival's time), named from `names`, unnamed species left out. */
export function arkRecentArrivals(rows: ArkArrivalEventRow[], names: ArkSpeciesNameRow[], limit = 20): ArkRecentArrival[] {
    const named = new Map<string, {name: string; slug: string | null}>();
    for (const row of names) {
        const id = idText(row.id);
        const name = text(row.display_name);
        if (id && name) named.set(id, {name, slug: text(row.landing_page_slug)});
    }
    const out: ArkRecentArrival[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        const id = idText(row.species_profile_id);
        const at = text(row.at);
        if (!id || !at || seen.has(id)) continue;
        seen.add(id);
        const species = named.get(id);
        if (!species) continue;
        out.push({speciesProfileId: id, name: species.name, slug: species.slug, at});
        if (out.length >= limit) break;
    }
    return out;
}
