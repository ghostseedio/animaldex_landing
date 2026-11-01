import speciesPowers from "@/data/published-species-powers.json";
import lessonSnapshot from "@/data/published-seo-lesson-pages.json";
import {resolveCollectionIdentityToken} from "@/lib/collection-identity-aliases";
import {resolveCanonicalSlugFromIdentity} from "@/lib/species-life-stage-policy";

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
    const normalized = slug.trim().toLowerCase();
    return powers[normalized] ?? aliasPowers().get(normalized) ?? null;
}

type LessonRow = {slug: string; principleName?: string | null; principleExpression?: string | null; coreLesson?: string | null; shortMotto?: string | null};
let aliasPowerCache: Map<string, CatalogSpeciesPower> | null = null;

/**
 * Hand-coded pages that stand for a catalog animal under another slug: the
 * catalog's "african-lion" is the site's /animals/lion (it 308s there), and
 * the chat for either must answer as Pride Command, not the Lion page's local
 * cluster "Teamwork". Built from the catalog lesson snapshot through the same
 * identity aliases the species resolver uses.
 */
function aliasPowers(): Map<string, CatalogSpeciesPower> {
    if (aliasPowerCache) return aliasPowerCache;
    const map = new Map<string, CatalogSpeciesPower>();
    for (const row of (lessonSnapshot as {entries: LessonRow[]}).entries) {
        const name = row.principleName?.trim();
        if (!name || !row.slug) continue;
        const token = resolveCollectionIdentityToken(row.slug.replace(/-/g, "_"));
        const canonical = resolveCanonicalSlugFromIdentity(token) ?? token.replace(/_/g, "-");
        if (!canonical || canonical === row.slug || powers[canonical] || map.has(canonical)) continue;
        map.set(canonical, {
            name,
            expression: row.principleExpression?.trim() || null,
            lesson: row.coreLesson?.trim() || null,
            motto: row.shortMotto?.trim() || null
        });
    }
    aliasPowerCache = map;
    return map;
}
