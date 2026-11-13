import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";

/**
 * The species in an Ark answer with no icon art of their own: no `<slug>.webp` in the `animals` bucket's listing
 * (`artwork`, by slug: `species-artwork-index.ts`). Species icons are hand-made files with no database column, so the
 * listing is the only record of which exist. `/api/ark/voyage` sends these beside the snapshot (`noIcon`) and the page
 * draws them as the generic figure without asking the bucket for a file it does not hold (a 400 and a console error
 * each). Placeholders never ask; each slug once, sorted.
 */
export function arkIconlessSlugs(animals: ReadonlyArray<{model_slug: string}>, artwork: {has: (slug: string) => boolean}): string[] {
    const missing = new Set<string>();
    for (const {model_slug: slug} of animals) {
        if (slug && !isArkPlaceholderSlug(slug) && !artwork.has(slug)) missing.add(slug);
    }
    return Array.from(missing).sort();
}
