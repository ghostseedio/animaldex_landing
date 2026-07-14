import Image from "next/image";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";

type SpeciesArtworkImageProps = {
    slug: string;
    alt: string;
    src?: string;
    imageFile?: string | null;
    priority?: boolean;
    className?: string;
    sizes?: string;
};

export default function SpeciesArtworkImage({
    slug,
    alt,
    src,
    imageFile,
    priority = false,
    className = "",
    sizes = "(min-width: 1536px) 27vw, (min-width: 768px) 42vw, 100vw"
}: SpeciesArtworkImageProps) {
    return (
        <div className={`relative overflow-hidden bg-surface-800/60 ${className}`}>
            <Image
                src={src ?? getSpeciesArtworkUrl(slug, imageFile)}
                alt={alt}
                fill
                unoptimized
                priority={priority}
                sizes={sizes}
                className="object-cover"
            />
        </div>
    );
}
