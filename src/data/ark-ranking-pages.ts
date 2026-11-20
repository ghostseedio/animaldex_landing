import type {ContentImage} from "@/data/content-schema";
import {ARK_ISLAND_RENDER_IMAGE, ARK_RENDER_IMAGE} from "@/lib/seo/ark-pages";

/**
 * The two Ark ranking pages in the Rankings category (they live at /tier-list/<slug> beside the animal tier lists, and
 * /rankings 308s there). Unlike the tier lists they are not rows in `rankings.ts`: their numbers are the live Ark's
 * (`lib/ark-rankings.ts`), their words are the Ark's (`ark.rankings`, 45 languages), and each row goes into /ark.
 * This module is what the hub, the sitemap and the related-rankings lists need to know of them, and nothing heavy.
 */

export const ARK_RANKING_SLUGS = ["ark-survival", "ark-fastest-breeders"] as const;
export type ArkRankingSlug = (typeof ARK_RANKING_SLUGS)[number];

export const ARK_RANKING_BASE_PATH = "/tier-list";

export function isArkRankingSlug(slug: string): slug is ArkRankingSlug {
    return (ARK_RANKING_SLUGS as readonly string[]).includes(slug);
}

export function arkRankingPath(slug: ArkRankingSlug): string {
    return `${ARK_RANKING_BASE_PATH}/${slug}`;
}

/** When the pages were first published. */
export const ARK_RANKING_PUBLISHED = "2026-11-20";
/** When their text last changed (the sitemap's lastmod floor: their numbers change by the hour). */
export const ARK_RANKING_UPDATED = "2026-11-20";

/** The share images: real renders of the live Ark (`lib/seo/ark-pages.ts`), the two islands for survival and the wild island for breeders. */
export function arkRankingImage(slug: ArkRankingSlug): ContentImage {
    return slug === "ark-survival"
        ? {src: ARK_RENDER_IMAGE, alt: "The Ark: the wild island and the town across the strait", width: 1200, height: 630}
        : {src: ARK_ISLAND_RENDER_IMAGE, alt: "The Ark's wild island seen from the sea", width: 1200, height: 630};
}

/**
 * The existing tier lists that name an Ark page among their related lists, by category: survival beside the lists of
 * animals that endure, breeding beside the lists of animals that multiply.
 */
export const ARK_RANKING_RELATED: Record<string, ArkRankingSlug> = {
    resilience: "ark-survival",
    endurance: "ark-survival",
    danger: "ark-survival",
    reproduction: "ark-fastest-breeders",
    invasive: "ark-fastest-breeders",
    adaptability: "ark-fastest-breeders"
};
