import Image from "next/image";
import {ContentImage} from "@/data/content-schema";

type ContentImageFigureProps = {
    image: ContentImage;
    priority?: boolean;
    sizes?: string;
};

export default function ContentImageFigure({
    image,
    priority = false,
    sizes = "(min-width: 1280px) 960px, (min-width: 768px) 80vw, 100vw"
}: ContentImageFigureProps) {
    return (
        <figure className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-3xl border border-line-300 bg-surface-800/60 shadow-[0_24px_80px_-48px_rgba(8,15,26,0.95)]">
                <Image
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    priority={priority}
                    sizes={sizes}
                    className="h-auto w-full object-cover"
                />
            </div>
            {image.caption && (
                <figcaption className="text-sm md:text-base text-ink-300">
                    {image.caption}
                </figcaption>
            )}
        </figure>
    );
}
