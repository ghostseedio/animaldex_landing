import type {ChallengeComparisonType} from "@/data/challenges";

export const COMPARISON_TYPE_SUFFIXES: ChallengeComparisonType[] = [
    "speed",
    "strength",
    "intelligence",
    "stealth",
    "durability",
    "agility"
];

export function parseComparisonSlug(slug: string): {
    animalASlug: string;
    animalBSlug: string;
    comparisonType: ChallengeComparisonType;
} | null {
    const normalized = slug.trim().toLowerCase();
    if (!normalized.includes("-vs-")) return null;

    for (const type of COMPARISON_TYPE_SUFFIXES) {
        const suffix = `-${type}`;
        if (normalized.endsWith(suffix)) {
            const base = normalized.slice(0, -suffix.length);
            const [animalASlug, animalBSlug] = base.split("-vs-");
            if (!animalASlug || !animalBSlug) return null;
            return {animalASlug, animalBSlug, comparisonType: type};
        }
    }

    const [animalASlug, animalBSlug] = normalized.split("-vs-");
    if (!animalASlug || !animalBSlug) return null;
    return {animalASlug, animalBSlug, comparisonType: "battle"};
}

export function buildComparisonSlug(
    animalASlug: string,
    animalBSlug: string,
    comparisonType: ChallengeComparisonType = "battle"
) {
    const base = `${animalASlug.trim().toLowerCase()}-vs-${animalBSlug.trim().toLowerCase()}`;
    return comparisonType === "battle" ? base : `${base}-${comparisonType}`;
}

export function reversedComparisonSlug(slug: string) {
    const parsed = parseComparisonSlug(slug);
    if (!parsed) return null;
    return buildComparisonSlug(parsed.animalBSlug, parsed.animalASlug, parsed.comparisonType);
}

/**
 * Unpublished pair order is alphabetical by slug so `/lion-vs-tiger` and
 * `/tiger-vs-lion` cannot both be generated. A published reverse slug still
 * wins and should be redirected to instead of this helper.
 */
export function canonicalUnpublishedComparisonSlug(slug: string) {
    const parsed = parseComparisonSlug(slug);
    if (!parsed || parsed.animalASlug === parsed.animalBSlug) return null;
    const [first, second] = [parsed.animalASlug, parsed.animalBSlug].sort((left, right) => left.localeCompare(right));
    return buildComparisonSlug(first, second, parsed.comparisonType);
}
