/**
 * A card's stars are the server's (GRADING-4, capture_star_ratings): how rare
 * the species is, the photo grade, wild or zoo, and community votes once a few
 * people have rated. Rows carry them as `capture_stars` (1-5) and `star_score`.
 * Nothing is computed here: a row without stored stars shows no stars.
 */

export const MIN_STARS = 1;
export const MAX_STARS = 5;

/** The stored star count, or null when the row has none (an old server, not yet backfilled). */
export function captureStars(raw: unknown): number | null {
    const value = typeof raw === "string" && raw.trim() ? Number(raw) : raw;
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const stars = Math.round(value);
    return stars >= MIN_STARS && stars <= MAX_STARS ? stars : null;
}

/** The stored star score (numeric, may arrive as a string), or null. */
export function captureStarScore(raw: unknown): number | null {
    const value = typeof raw === "string" && raw.trim() ? Number(raw) : raw;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
