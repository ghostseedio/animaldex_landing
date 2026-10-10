import type {Metadata} from "next";
import type {ContentImage} from "@/data/content-schema";

/** Path of the generated share card for a page, e.g. `ogImagePath("lesson", "aardvark")`. */
export function ogImagePath(kind: string, ...slug: string[]) {
    const parts = [kind, ...slug].flatMap((part) => part.split("/")).filter(Boolean);
    return `/api/og/${parts.map((part) => encodeURIComponent(part)).join("/")}.png`;
}

/** The generated share card as a `ContentImage` for `buildContentMetadata`. */
export function ogContentImage(alt: string, kind: string, ...slug: string[]): ContentImage {
    return {src: ogImagePath(kind, ...slug), alt, width: 1200, height: 630};
}

/** `openGraph.images` / `twitter.images` entries for the generated share card. */
export function ogMetadataImages(alt: string, kind: string, ...slug: string[]) {
    const url = ogImagePath(kind, ...slug);
    return {
        openGraph: [{url, width: 1200, height: 630, alt}],
        twitter: [{url, alt}]
    };
}

/**
 * Points a page's Open Graph and Twitter images at its generated share card.
 * Sets `twitter` too: a page that leaves it out inherits the layout's generic
 * card, which is what X shows even when `og:image` is right.
 */
export function withOgCard(metadata: Metadata, alt: string, kind: string, ...slug: string[]): Metadata {
    const images = ogMetadataImages(alt, kind, ...slug);
    const openGraph = metadata.openGraph ?? {};
    const twitter = metadata.twitter ?? {};
    return {
        ...metadata,
        openGraph: {...openGraph, images: images.openGraph},
        twitter: {
            title: openGraph.title ?? metadata.title ?? undefined,
            description: openGraph.description ?? metadata.description ?? undefined,
            ...twitter,
            card: "summary_large_image",
            images: images.twitter
        }
    };
}
