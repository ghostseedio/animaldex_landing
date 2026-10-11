import Image from "next/image";
import {getSpeciesArtworkRoute, getSpeciesArtworkUrl} from "@/data/species-artwork";

type SpeciesArtworkImageProps = {
    slug: string;
    alt: string;
    src?: string;
    imageFile?: string | null;
    priority?: boolean;
    className?: string;
    sizes?: string;
    /**
     * "padded" (default): the whole animal, with breathing room that scales with
     * the box. Species artwork is a cut-out on a transparent background, so
     * cropping it to fill ("cover") cuts off heads, tails and wings.
     * "contain": the whole animal with a small fixed inset, for callers that pad
     * the box themselves. "cover": fill and crop; only for true photos.
     */
    fit?: "padded" | "contain" | "cover";
    /**
     * Replaces the fit's own classes on the image, for boxes with text laid
     * over one edge: e.g. extra bottom padding so the animal sits above a title.
     */
    imageClassName?: string;
};

const FIT_CLASS: Record<NonNullable<SpeciesArtworkImageProps["fit"]>, string> = {
    padded: "object-contain p-[8%]",
    contain: "object-contain p-2",
    cover: "object-cover"
};

export default function SpeciesArtworkImage({
    slug,
    alt,
    src,
    imageFile,
    priority = false,
    className = "",
    sizes = "(min-width: 1536px) 27vw, (min-width: 768px) 42vw, 100vw",
    fit = "padded",
    imageClassName
}: SpeciesArtworkImageProps) {
    return (
        <div className={`relative overflow-hidden bg-surface-800/60 ${className}`}>
            <Image
                // Without a known file the slug may have no artwork of its own,
                // so go through the route that falls back to a close relative.
                src={src ?? (imageFile ? getSpeciesArtworkUrl(slug, imageFile) : getSpeciesArtworkRoute(slug))}
                alt={alt}
                fill
                unoptimized
                priority={priority}
                sizes={sizes}
                className={imageClassName ?? FIT_CLASS[fit]}
            />
        </div>
    );
}
