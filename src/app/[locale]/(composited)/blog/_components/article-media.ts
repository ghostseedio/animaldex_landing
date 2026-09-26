import type {ContentImage} from "@/data/content-schema";

/**
 * Whether an image is a product render rather than photography.
 *
 * Most posts currently carry one of the `/images/placeholders/*.svg` AnimalDex
 * product graphics as their featured image, pending real photography swapped in
 * from the content studio. These are never hidden — the slot stays visible so
 * replacing the asset is the only step needed — but they are *framed*
 * differently: vector product art is contained inside the frame, while a
 * photograph fills it.
 */
export function isProductRender(image: {src?: string} | null | undefined) {
    const src = image?.src ?? "";
    return src.includes("/images/placeholders/") || src.endsWith(".svg");
}

export function hasImage(image: ContentImage | null | undefined): image is ContentImage {
    return Boolean(image?.src);
}

/** `contain` keeps a product render whole; `cover` lets a photograph fill the crop. */
export function imageFit(image: ContentImage) {
    return isProductRender(image) ? "object-contain" : "object-cover";
}

/**
 * Aspect ratio for an editorial frame.
 *
 * A photograph keeps its own shape. A product render is given an editorial
 * ratio instead of its native near-square one, which is what made a placeholder
 * fill the screen above the article's first sentence.
 */
export function figureAspect(image: ContentImage, fallback = "16 / 9") {
    if (isProductRender(image)) return fallback;
    if (!image.width || !image.height) return fallback;
    return `${image.width} / ${image.height}`;
}
