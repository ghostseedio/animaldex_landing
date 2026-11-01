import speciesPowers from "@/data/published-species-powers.json";

export type CatalogSpeciesPower = {
    name: string;
    expression: string | null;
    lesson: string | null;
    motto: string | null;
};

const powers = speciesPowers.powers as Record<string, CatalogSpeciesPower>;

/**
 * The catalog's authored Power for a hand-coded species page: the same row
 * Talk and the chat answer from (WEB-7). Null when the page has no catalog
 * profile (group pages such as /animals/fox), where the page and the chat
 * both fall back to the local profile. Build-time data, no network.
 */
export function getCatalogSpeciesPower(slug: string): CatalogSpeciesPower | null {
    return powers[slug.trim().toLowerCase()] ?? null;
}
