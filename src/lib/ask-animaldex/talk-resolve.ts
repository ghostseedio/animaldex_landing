/**
 * Which chat /talk/<slug> opens (UX pass WEB-1). The Talk catalog keys its
 * animals by the catalog's landing slug (`african-lion`, `red-fox`), while
 * the species pages Google sends people to are often the generic page
 * (`/animals/lion`, `/animals/fox`, `/animals/honey-bee`), resolved through
 * the same alias and redirect table the species pages use. A chat link made
 * from a species page must never land on a 404, so:
 *
 *   1. a slug the catalog has is its chat;
 *   2. else the species page's own resolution: when it is a catalog animal
 *      (by its species profile, its identity key and that key's aliases, or
 *      its own slug), a permanent redirect to that animal's chat;
 *   3. else, when the species page exists, its own chat: the animal the
 *      drawer on that page already talks as, under the same thread key;
 *   4. else nothing (404).
 *
 * Pure: the server half (`data/talk-animals.ts`) supplies the catalog and
 * the species page's resolution. Kept out of `talk.ts`, which the client
 * bundles.
 */

export type TalkCatalogIndex = {
    /** Every catalog slug. */
    slugs: ReadonlySet<string>;
    /** Catalog slug by species profile id (the catalog's own and its canonical). */
    bySpeciesProfileId: ReadonlyMap<string, string>;
    /** Catalog slug by normalized identity key (`african_lion`). */
    byIdentity: ReadonlyMap<string, string>;
};

/** What the species page at /animals/<slug> resolved to (`getResolvedSpeciesBySlug`). */
export type TalkSpeciesEntry = {
    slug: string;
    name: string;
    speciesProfileId?: string | null;
    normalizedIdentityKey?: string | null;
};

export type TalkResolution =
    | {kind: "catalog"; slug: string}
    | {kind: "redirect"; slug: string}
    | {kind: "species"; slug: string; name: string}
    | {kind: "none"};

/**
 * The catalog animal a species page is, if any: its species profile, then
 * its identity key with that key's aliases (`lion` → `african_lion`), then
 * its own slug.
 */
export function talkCatalogSlugForEntry(
    entry: TalkSpeciesEntry,
    index: TalkCatalogIndex,
    identityKeys: (token: string) => readonly string[]
): string | null {
    const profile = entry.speciesProfileId?.trim().toLowerCase();
    if (profile) {
        const bySpecies = index.bySpeciesProfileId.get(profile);
        if (bySpecies) return bySpecies;
    }
    if (index.slugs.has(entry.slug)) return entry.slug;
    const token = (entry.normalizedIdentityKey?.trim() || entry.slug).toLowerCase().replace(/-/g, "_");
    for (const key of identityKeys(token)) {
        const byIdentity = index.byIdentity.get(key);
        if (byIdentity) return byIdentity;
        const asSlug = key.replace(/_/g, "-");
        if (index.slugs.has(asSlug)) return asSlug;
    }
    return null;
}

export function resolveTalkSlug(params: {
    slug: string;
    index: TalkCatalogIndex;
    entry: TalkSpeciesEntry | null;
    identityKeys: (token: string) => readonly string[];
}): TalkResolution {
    const slug = params.slug.trim().toLowerCase();
    if (!slug) return {kind: "none"};
    if (params.index.slugs.has(slug)) return {kind: "catalog", slug};
    const entry = params.entry;
    if (!entry) return {kind: "none"};
    const target = talkCatalogSlugForEntry(entry, params.index, params.identityKeys);
    if (target && target !== slug) return {kind: "redirect", slug: target};
    // A species page with no catalog animal: its own chat, at its own slug.
    if (entry.slug !== slug) return {kind: "redirect", slug: entry.slug};
    return {kind: "species", slug, name: entry.name};
}
