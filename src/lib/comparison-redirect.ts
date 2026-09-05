import {getChallenge} from "@/data/challenges";
import {reversedComparisonSlug} from "@/lib/comparison-slug";

/**
 * Sync redirect onto a published editorial slug. No catalog, DB, or artwork I/O.
 * `/lion-vs-tiger` → `tiger-vs-lion` because only the latter is a static challenge.
 */
export function publishedStaticComparisonRedirectSlug(slug: string): string | null {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;
    if (getChallenge(normalized)) return null;

    const reversed = reversedComparisonSlug(normalized);
    if (reversed && getChallenge(reversed)) return reversed;
    return null;
}
