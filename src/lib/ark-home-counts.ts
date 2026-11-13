/**
 * The home page's Ark band (CC 3, 2026-11-13): how many animals are aboard
 * and how many people brought them, read from `voyage_public_cache` (the
 * public read's cached body: its `counts` only, never the 4 MB of animals) at
 * ISR time. When the table cannot be read the band shows the last numbers
 * known, so the page never shows a dash. Pure, so the parse is tested; the
 * read is `src/data/ark-home-counts.ts`.
 */

export type ArkHomeCounts = {
    /** Animals aboard now. */
    animals: number;
    /** Distinct people whose captures brought them (the public read's `founders`). */
    bringers: number;
    /** Read from the Ark now; false when these are the fallback numbers. */
    live: boolean;
    /** When the public read was computed, when known. */
    computedAt: string | null;
};

/** The numbers shown when the Ark cannot be read: the count on 2026-11-13. */
export const ARK_HOME_COUNTS_FALLBACK: ArkHomeCounts = {animals: 3225, bringers: 647, live: false, computedAt: null};

function count(value: unknown): number | null {
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isInteger(number) && number >= 0 ? number : null;
}

/** `voyage_public_cache` rows (`select=counts:body->counts,computed_at`) as the band's numbers, else the fallback. */
export function arkHomeCountsFrom(rows: unknown, fallback: ArkHomeCounts = ARK_HOME_COUNTS_FALLBACK): ArkHomeCounts {
    const row = Array.isArray(rows) ? rows[0] : rows;
    const counts = row && typeof row === "object" ? (row as {counts?: unknown}).counts : null;
    if (!counts || typeof counts !== "object") return fallback;
    const animals = count((counts as {animals?: unknown}).animals);
    const bringers = count((counts as {founders?: unknown}).founders);
    if (animals === null || bringers === null || animals === 0) return fallback;
    const computedAt = row && typeof row === "object" && typeof (row as {computed_at?: unknown}).computed_at === "string" ? (row as {computed_at: string}).computed_at : null;
    return {animals, bringers, live: true, computedAt};
}
