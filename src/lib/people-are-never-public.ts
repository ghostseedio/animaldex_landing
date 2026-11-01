/**
 * People are never public (DECISIONS §11, owner approved 2026-11-01). A photo
 * of a person can be captured as "Human" (Homo sapiens); on 2026-11-01 the
 * server hid the 114 public ones, and a server lane makes it permanent. Until
 * then every public surface drops them as a stopgap: species pages, the
 * catalog hub and its API, the sitemap, side-by-side pages, rankings,
 * collectors, public profiles, shared posts and the home page's captures.
 */

import {isHomoSapiens} from "@/lib/people-never-public";

/** True for the human species page slug. One rule for the whole site: src/lib/people-never-public.ts. */
export function isHumanSlug(slug: string | null | undefined): boolean {
    return isHomoSapiens({slug});
}

/** True when a species (or a capture of one) is a person: the "human" slug or Homo sapiens. */
export function isHumanSpecies(species: {
    slug?: string | null;
    scientificName?: string | null;
    identityKey?: string | null;
} | null | undefined): boolean {
    return Boolean(species) && isHomoSapiens({slug: species!.slug, scientificName: species!.scientificName, identityKey: species!.identityKey});
}

/** A side-by-side slug ("x-vs-human") with a person on either side. */
export function involvesHuman(slugs: Array<string | null | undefined>): boolean {
    return slugs.some((slug) => isHumanSlug(slug));
}

/** A comparison page slug with a person on either side. */
export function isHumanComparisonSlug(slug: string): boolean {
    return slug.trim().toLowerCase().split("-vs-").some((side) => isHumanSlug(side));
}
