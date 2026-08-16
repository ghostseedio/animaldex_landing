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
    fit?: "cover" | "contain";
};

export default function SpeciesArtworkImage({
    slug,
    alt,
    src,
    imageFile,
    priority = false,
    className = "",
    sizes = "(min-width: 1536px) 27vw, (min-width: 768px) 42vw, 100vw",
    fit = "cover"
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
                className={fit === "contain" ? "object-contain p-2" : "object-cover"}
            />
        </div>
    );
}
