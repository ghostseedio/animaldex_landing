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
 * Real renders of the live Ark (its 3D world with the animals aboard on
 * 2026-11-12, read from the public snapshot; `scripts/ark-share-render.mjs`,
 * `docs/seo/ark-share-render.md`), 1200×630. Nothing is staged: the camera and
 * the light only.
 *
 * - `ARK_RENDER_IMAGE`: both islands across the strait. The share image of the
 *   Ark's text pages, the home page and the site's default card.
 * - `ARK_ISLAND_RENDER_IMAGE`: the wild island from the sea, with open water on
 *   the right for the words: the background of `/api/og/ark.png`.
 */
export const ARK_RENDER_IMAGE = "/images/og/ark-world-2026-11-12.jpg";
export const ARK_ISLAND_RENDER_IMAGE = "/images/og/ark-island-2026-11-12.jpg";

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
