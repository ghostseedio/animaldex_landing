import Image from "next/image";
import {getSpeciesImageRoute} from "@/data/species-images";

type SpeciesImageProps = {
    slug: string;
    alt: string;
    priority?: boolean;
    className?: string;
    sizes?: string;
    /** `contain` keeps cut-out artwork whole; `cover` fills the frame. */
    fit?: "cover" | "contain";
    /** Applied to the image itself, so padding insets `contain` artwork. */
    imageClassName?: string;
    /** Replaces the default plinth behind the artwork. */
    surfaceClassName?: string;
};

export default function SpeciesImage({
    slug,
    alt,
    priority = false,
    className = "",
    sizes = "(min-width: 1280px) 960px, (min-width: 768px) 80vw, 100vw",
    fit = "cover",
    imageClassName = "",
    surfaceClassName = "bg-surface-800/60"
}: SpeciesImageProps) {
    return (
        <div className={`relative overflow-hidden ${surfaceClassName} ${className}`}>
            <Image
                src={getSpeciesImageRoute(slug)}
                alt={alt}
                fill
                unoptimized
                priority={priority}
                sizes={sizes}
                className={`${fit === "contain" ? "object-contain" : "object-cover"} ${imageClassName}`}
            />
        </div>
    );
}
