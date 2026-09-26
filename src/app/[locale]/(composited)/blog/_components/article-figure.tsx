import Image from "next/image";
import type {ContentImage} from "@/data/content-schema";
import {figureAspect, hasImage, imageFit} from "@/app/[locale]/(composited)/blog/_components/article-media";

type ArticleFigureProps = {
    image: ContentImage;
    /** `wide` breaks out of the prose measure; `prose` stays inside it. */
    width?: "prose" | "wide";
    priority?: boolean;
};

/**
 * An article photograph.
 *
 * Breaking out of the measure is the point: an image the same width as the text
 * column reads as an attachment, one that runs wider reads as art direction and
 * gives the page the narrow → wide → narrow rhythm it was missing.
 */
export default function ArticleFigure({image, width = "wide", priority = false}: ArticleFigureProps) {
    if (!hasImage(image)) return null;

    return (
        <figure className={width === "wide" ? "span-wide my-10 md:my-14" : "my-8"}>
            <div
                className="relative w-full overflow-hidden rounded-sm bg-[color:var(--paper-850)]"
                style={{aspectRatio: figureAspect(image, "3 / 2")}}
            >
                <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    priority={priority}
                    loading={priority ? undefined : "lazy"}
                    sizes={width === "wide" ? "(min-width: 1280px) 58rem, (min-width: 768px) 90vw, 100vw" : "(min-width: 768px) 44rem, 100vw"}
                    className={imageFit(image)}
                />
            </div>
            {image.caption ? (
                <figcaption className="editorial-caption mt-3 max-w-[52ch]">{image.caption}</figcaption>
            ) : null}
        </figure>
    );
}

/**
 * Two images side by side, falling back to a single column on small screens and
 * to a lone figure when only one of the pair is real photography.
 */
export function ArticleFigurePair({images}: {images: ContentImage[]}) {
    const usable = images.filter(hasImage);
    if (!usable.length) return null;
    if (usable.length === 1) return <ArticleFigure image={usable[0]} />;

    return (
        <figure className="span-wide my-10 md:my-14">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {usable.slice(0, 2).map((image) => (
                    <div
                        key={image.src}
                        className="relative w-full overflow-hidden rounded-sm bg-[color:var(--paper-850)]"
                        style={{aspectRatio: "4 / 5"}}
                    >
                        <Image
                            src={image.src}
                            alt={image.alt}
                            fill
                            loading="lazy"
                            sizes="(min-width: 640px) 29rem, 100vw"
                            className={imageFit(image)}
                        />
                    </div>
                ))}
            </div>
            {usable[0].caption ? (
                <figcaption className="editorial-caption mt-3 max-w-[52ch]">{usable[0].caption}</figcaption>
            ) : null}
        </figure>
    );
}
