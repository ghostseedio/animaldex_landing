import type {ArkSnapshot} from "@/ark-scene/types";

/**
 * The SEO lane's Ark pages (S3, 2026-11-12): their paths, the date their text
 * last changed (the sitemap's lastmod and the schema's dateModified), their
 * share image, and the live-count line they share.
 */

export const ARK_PATH = "/ark";
export const ARK_HOW_IT_WORKS_PATH = "/ark/how-it-works";
export const ARK_FOOD_CHAIN_PATH = "/ark/food-chain";
export const ABOUT_PATH = "/about";

/** When the pages' words last changed. */
export const ARK_PAGES_UPDATED = "2026-11-12";

/**
 * A real render of the live Ark (the 3D world, read from production on
 * 2026-11-12; `docs/seo/ark-share-render.md`), 1200×630: the share image of
 * the Ark's text pages and the site's default card.
 */
export const ARK_RENDER_IMAGE = "/images/og/ark-world-2026-11-12.jpg";

export function arkPageImage(): string {
    return ARK_RENDER_IMAGE;
}

export type ArkCountWords = {animalsOne: string; animalsOther: string; speciesOne: string; speciesOther: string};

function counted(count: number, one: string, other: string, locale: string): string {
    return count === 1 ? one : other.replace("{count}", count.toLocaleString(locale === "id" ? "id-ID" : "en-US"));
}

/** "Right now 3,152 animals of 953 species live aboard." (the template's {animals} and {species}), or `unavailable`. */
export function arkCountsLine(snapshot: ArkSnapshot | null, template: string, unavailable: string, words: ArkCountWords, locale: string): string {
    if (!snapshot || !snapshot.counts.animals) return unavailable;
    return template
        .replace("{animals}", counted(snapshot.counts.animals, words.animalsOne, words.animalsOther, locale))
        .replace("{species}", counted(snapshot.counts.species, words.speciesOne, words.speciesOther, locale));
}
