import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import type {ContentImage} from "@/data/content-schema";
import {hasImage, imageFit} from "@/app/[locale]/(composited)/blog/_components/article-media";

export type EditorialCardProps = {
    href: string;
    title: string;
    description?: string;
    kicker?: string;
    meta?: string;
    image?: ContentImage | null;
    /** `feature` is the lead recommendation; `standard` the ones beside it. */
    variant?: "feature" | "standard" | "row";
};

/**
 * One recommendation.
 *
 * The whole card is the link — the old markup put a "Read article →" anchor at
 * the bottom of a static box, which gave a large clickable-looking object a
 * small click target. Hover moves the image and the arrow, not the surface, so
 * a grid of these stays calm while still responding.
 *
 * With no image at all the card becomes typographic, so a catalogue entry that
 * has none still looks deliberate.
 */
export default function EditorialCard({
    href,
    title,
    description,
    kicker,
    meta,
    image,
    variant = "standard"
}: EditorialCardProps) {
    const photograph = hasImage(image) ? image : null;
    const isFeature = variant === "feature";
    const isRow = variant === "row";

    const label = (
        <div className={isRow ? "flex min-w-0 flex-1 flex-col gap-1.5" : "flex flex-col gap-2"}>
            {kicker ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--lime)]">{kicker}</p>
            ) : null}
            <h3
                className={`font-display font-bold tracking-[-0.015em] text-[color:var(--text-100)] [text-wrap:balance] ${
                    isFeature ? "text-2xl leading-[1.12] md:text-[2rem]" : isRow ? "text-base leading-snug" : "text-xl leading-[1.18]"
                }`}
            >
                {title}
            </h3>
            {description ? (
                <p
                    className={`text-[color:var(--text-300)] [text-wrap:pretty] ${
                        isFeature ? "line-clamp-3 text-[15px] leading-relaxed md:text-base" : "line-clamp-2 text-[13px] leading-relaxed"
                    }`}
                >
                    {description}
                </p>
            ) : null}
            {meta ? (
                <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[color:var(--text-400)]">{meta}</p>
            ) : null}
        </div>
    );

    if (isRow) {
        return (
            <Link
                href={href}
                className="group flex items-center gap-4 border-b border-[color:var(--rule)] py-4 transition-colors last:border-b-0 hover:border-[color:var(--rule-strong)]"
            >
                {photograph ? (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-[color:var(--paper-850)]">
                        <Image src={photograph.src} alt="" fill loading="lazy" sizes="56px" className={`editorial-zoom ${imageFit(photograph)}`} />
                    </div>
                ) : null}
                {label}
                <span
                    aria-hidden="true"
                    className="shrink-0 text-[color:var(--text-400)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--lime)]"
                >
                    →
                </span>
            </Link>
        );
    }

    return (
        <Link href={href} className="group flex h-full flex-col gap-4">
            {photograph ? (
                <div
                    className="relative w-full overflow-hidden rounded-sm bg-[color:var(--paper-850)]"
                    style={{aspectRatio: isFeature ? "16 / 10" : "3 / 2"}}
                >
                    <Image
                        src={photograph.src}
                        alt=""
                        fill
                        loading="lazy"
                        sizes={isFeature ? "(min-width: 1024px) 40rem, 100vw" : "(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 100vw"}
                        className={`editorial-zoom ${imageFit(photograph)}`}
                    />
                </div>
            ) : (
                // A rule instead of a picture: still a card, no filler graphic.
                <div aria-hidden="true" className="h-px w-full bg-[color:var(--rule-strong)] transition-colors group-hover:bg-[color:var(--lime)]" />
            )}
            {label}
            <span
                aria-hidden="true"
                className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--text-400)] transition-colors group-hover:text-[color:var(--lime)]"
            >
                Read
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
        </Link>
    );
}

/** Section heading used across every recirculation block. */
export function EditorialSectionHeading({title, description}: {title: string; description?: string}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
                <h2 className="font-display text-xl font-bold tracking-[-0.015em] text-[color:var(--text-100)] md:text-2xl">
                    {title}
                </h2>
                <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--rule)]" />
            </div>
            {description ? (
                <p className="max-w-[56ch] text-[14px] leading-relaxed text-[color:var(--text-300)]">{description}</p>
            ) : null}
        </div>
    );
}
