import Image from "next/image";
import {getSpeciesImageRoute} from "@/data/species-images";

type SpeciesImageProps = {
    slug: string;
    alt: string;
    priority?: boolean;
    className?: string;
    sizes?: string;
};

export default function SpeciesImage({
    slug,
    alt,
    priority = false,
    className = "",
    sizes = "(min-width: 1280px) 960px, (min-width: 768px) 80vw, 100vw"
}: SpeciesImageProps) {
    return (
        <div className={`relative overflow-hidden bg-surface-800/60 ${className}`}>
            <Image
                src={getSpeciesImageRoute(slug)}
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
