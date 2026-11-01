/**
 * People are never public (UX pass, DECISIONS section 11; P0 IOS-01). On
 * 2026-11-01 the server hid every public "Human" capture; until its lane
 * makes that permanent, the website drops any feed, featured, collectors,
 * catalog or public-profile item whose species is Homo sapiens, by its
 * scientific name (any case) or the "human" slug. Pure, so it is tested.
 */

const HUMAN_TOKENS = new Set(["human", "humans", "homo-sapiens", "person", "people"]);

export function isHomoSapiens(input: {
    scientificName?: string | null;
    slug?: string | null;
    identityKey?: string | null;
    animalName?: string | null;
}): boolean {
    const scientific = input.scientificName?.trim().toLowerCase() ?? "";
    if (/^homo\s+sapiens\b/.test(scientific)) return true;
    for (const raw of [input.slug, input.identityKey]) {
        const token = raw?.trim().toLowerCase().replace(/[\s_]+/g, "-") ?? "";
        if (token && HUMAN_TOKENS.has(token)) return true;
    }
    const name = input.animalName?.trim().toLowerCase() ?? "";
    return name === "human" || name === "humans" || name === "homo sapiens";
}

/** A row as the feed's views return it. */
export function rowIsHomoSapiens(row: Record<string, unknown>): boolean {
    const text = (key: string) => (typeof row[key] === "string" ? row[key] as string : null);
    return isHomoSapiens({
        scientificName: text("scientific_name"),
        slug: text("landing_page_slug") ?? text("species_slug"),
        identityKey: text("normalized_identity_key"),
        animalName: text("animal_name")
    });
}
