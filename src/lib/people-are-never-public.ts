/**
 * People are never public (DECISIONS §11, owner approved 2026-11-01). A photo
 * of a person can be captured as "Human" (Homo sapiens); on 2026-11-01 the
 * server hid the 114 public ones, and a server lane makes it permanent. Until
 * then every public surface drops them as a stopgap: species pages, the
 * catalog hub and its API, the sitemap, side-by-side pages, rankings,
 * collectors, public profiles, shared posts and the home page's captures.
 */

const HUMAN_SLUGS = new Set(["human", "humans", "homo-sapiens", "homo-sapiens-sapiens"]);

function normalized(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase();
}

/** True for the human species page slug. */
export function isHumanSlug(slug: string | null | undefined): boolean {
    return HUMAN_SLUGS.has(normalized(slug));
}

/** True when a species (or a capture of one) is a person: the "human" slug or Homo sapiens. */
export function isHumanSpecies(species: {
    slug?: string | null;
    scientificName?: string | null;
    identityKey?: string | null;
} | null | undefined): boolean {
    if (!species) return false;
    if (isHumanSlug(species.slug)) return true;
    if (isHumanSlug(normalized(species.identityKey).replace(/_/g, "-"))) return true;
    return /^homo sapiens\b/.test(normalized(species.scientificName));
}

/** A side-by-side slug ("x-vs-human") with a person on either side. */
export function involvesHuman(slugs: Array<string | null | undefined>): boolean {
    return slugs.some((slug) => isHumanSlug(slug));
}

/** A comparison page slug with a person on either side. */
export function isHumanComparisonSlug(slug: string): boolean {
    return normalized(slug).split("-vs-").some((side) => isHumanSlug(side));
}
