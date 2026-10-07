/**
 * Character-trait tier lists ("most patient animals", "most loyal animals"…)
 * ranked from AnimalDex lesson data instead of stat formulas.
 *
 * Every published animal carries three ordered "best for" qualities
 * (`resolveSpeciesBehaviorProfileForPage(slug).bestFor`, first = strongest).
 * Hand-coded species resolve to their local behavior profile, DB-only species
 * to the catalog lesson snapshot, so both are available at build time with no
 * network call.
 *
 * Scoring (deterministic):
 * - candidate = published animal (not a legendary earth beast) whose bestFor
 *   contains at least one of the list's mapped qualities;
 * - score = sum over matched qualities of the position weight
 *   (1st = 3, 2nd = 2, 3rd = 1, anything after = 0);
 * - ties: hand-coded species (the well-known animals in `speciesEntries`)
 *   before DB-only ones, then name A–Z;
 * - two slugs with the same display name keep only the higher-ranked one.
 */
import {isLegendaryEarthBeastSpeciesSlug} from "@/data/legendary-earth-beasts";
import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {speciesEntries} from "@/data/species";
import {resolveSpeciesBehaviorProfileForPage} from "@/data/species-behavior-lessons";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";

export type QualityRankingConfig = {
    /** bestFor strings that count for the list (exact, case-sensitive). */
    qualities: string[];
};

export type QualityRankingCandidate = {
    slug: string;
    name: string;
    score: number;
    /** The mapped quality in the highest bestFor position. */
    matchedQuality: string;
    bestFor: string[];
    coreLesson: string;
    handCoded: boolean;
};

const POSITION_WEIGHTS = [3, 2, 1];
const handCodedSlugs = new Set(speciesEntries.map((entry) => entry.slug));
const candidateCache = new Map<string, QualityRankingCandidate[]>();

export function getQualityPositionScore(bestFor: readonly string[], qualities: readonly string[]) {
    let score = 0;
    let matchedQuality: string | null = null;

    bestFor.forEach((quality, index) => {
        const weight = POSITION_WEIGHTS[index] ?? 0;
        if (weight > 0 && qualities.includes(quality)) {
            score += weight;
            matchedQuality ??= quality;
        }
    });

    return {score, matchedQuality};
}

/** Every published animal that qualifies for the list, best first. */
export function getQualityRankingCandidates(qualities: readonly string[]): QualityRankingCandidate[] {
    const cacheKey = qualities.join("|");
    const cached = candidateCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const candidates: QualityRankingCandidate[] = [];

    for (const slug of publishedSeoSlugs.animals) {
        if (isLegendaryEarthBeastSpeciesSlug(slug)) {
            continue;
        }

        const profile = resolveSpeciesBehaviorProfileForPage(slug);
        const bestFor = profile?.bestFor ?? [];
        const {score, matchedQuality} = getQualityPositionScore(bestFor, qualities);
        if (!profile || score <= 0 || !matchedQuality) {
            continue;
        }

        const species = getPublishedSpeciesForContent(slug);
        if (!species) {
            continue;
        }

        candidates.push({
            slug,
            name: species.name,
            score,
            matchedQuality,
            bestFor: [...bestFor],
            coreLesson: (profile.coreLesson || profile.motto || "").trim(),
            handCoded: handCodedSlugs.has(slug)
        });
    }

    candidates.sort((left, right) =>
        right.score - left.score
        || Number(right.handCoded) - Number(left.handCoded)
        || left.name.localeCompare(right.name)
        || left.slug.localeCompare(right.slug)
    );

    const seenNames = new Set<string>();
    const unique = candidates.filter((candidate) => {
        const key = candidate.name.trim().toLowerCase();
        if (seenNames.has(key)) {
            return false;
        }
        seenNames.add(key);
        return true;
    });

    candidateCache.set(cacheKey, unique);
    return unique;
}
