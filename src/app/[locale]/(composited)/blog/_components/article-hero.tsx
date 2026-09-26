import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import type {ContentImage} from "@/data/content-schema";
import {figureAspect, hasImage, imageFit, isProductRender} from "@/app/[locale]/(composited)/blog/_components/article-media";

type ArticleHeroProps = {
    title: string;
    description: string;
    image: ContentImage;
    tags: string[];
    author?: string;
    publishedLabel: string;
    updatedLabel?: string;
    readingLabel: string;
    backLabel: string;
    originalPublication?: {href: string; label: string} | null;
};

/**
 * The article masthead.
 *
 * The featured image always renders — the slot stays visible so swapping the
 * asset in the content studio is the only step needed — but it is framed by
 * what it is:
 *
 * - A photograph runs full-bleed under the headline, so the subject is the
 *   first thing on screen, as a nature title page would.
 * - A product render is contained and capped at 24rem. Left at photograph
 *   scale, the near-square placeholder most posts carry filled the opening
 *   screen before a single sentence, which is what made the article read as an
 *   advertisement.
 *
 * Either way the h1 is the strongest element on the page.
 */
export default function ArticleHero({
    title,
    description,
    image,
    tags,
    author,
    publishedLabel,
    updatedLabel,
    readingLabel,
    backLabel,
    originalPublication
}: ArticleHeroProps) {
    const showsImage = hasImage(image);
    // A product render is capped well below a photograph's height so the
    // placeholder currently in most posts cannot dominate the opening screen.
    const isRender = isProductRender(image);

    const meta = (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[color:var(--text-300)]">
            {author ? (
                <>
                    <span className="font-semibold text-[color:var(--text-100)]">{author}</span>
                    <span aria-hidden="true" className="text-[color:var(--rule-strong)]">·</span>
                </>
            ) : null}
            <span>{publishedLabel}</span>
            <span aria-hidden="true" className="text-[color:var(--rule-strong)]">·</span>
            <span>{readingLabel}</span>
            {updatedLabel ? (
                <>
                    <span aria-hidden="true" className="text-[color:var(--rule-strong)]">·</span>
                    <span>{updatedLabel}</span>
                </>
            ) : null}
        </div>
    );

    return (
        <header className="editorial-grid pt-10 md:pt-14">
            <div className="span-wide flex flex-col gap-6">
                <Link
                    href="/blog"
                    className="group inline-flex w-fit items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-400)] transition-colors hover:text-[color:var(--lime)]"
                >
                    <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">←</span>
                    {backLabel}
                </Link>

                {tags.length ? (
                    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--lime)]">
                        {tags.slice(0, 3).map((tag, index) => (
                            <span key={tag} className="inline-flex items-center gap-2.5">
                                {index > 0 ? <span aria-hidden="true" className="text-[color:var(--rule-strong)]">/</span> : null}
                                {tag}
                            </span>
                        ))}
                    </p>
                ) : null}

                {/* The single largest thing on the page, and deliberately tight:
                    display type at this scale needs negative tracking and a
                    line-height near 1 to read as a title rather than a banner. */}
                <h1 className="max-w-[18ch] font-display text-[2.5rem] font-bold leading-[1.02] tracking-[-0.025em] text-[color:var(--text-100)] [text-wrap:balance] sm:text-[3.25rem] md:text-[4rem] lg:text-[4.5rem]">
                    {title}
                </h1>

                {description ? (
                    <p className="max-w-[44ch] text-lg leading-[1.55] text-[color:var(--text-200)] [text-wrap:pretty] md:text-xl">
                        {description}
                    </p>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-[color:var(--rule)] pt-5">
                    {meta}
                    {originalPublication ? (
                        <p className="text-[13px] text-[color:var(--text-400)]">
                            Originally published on{" "}
                            <a
                                href={originalPublication.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[color:var(--text-200)] underline decoration-[rgba(167,244,50,0.45)] underline-offset-4 transition-colors hover:decoration-[color:var(--lime)]"
                            >
                                {originalPublication.label}
                            </a>
                        </p>
                    ) : null}
                </div>
            </div>

            {showsImage ? (
                <figure className="span-full mt-10 md:mt-14">
                    <div
                        // A product render carries its own background, so the frame stays
                        // transparent and the artwork sits on the page rather than
                        // inside a visible panel. A photograph gets a fill to load against.
                        className={`relative w-full overflow-hidden ${isRender ? "mx-auto max-w-[64rem] px-[var(--gutter)]" : "bg-[color:var(--paper-850)]"}`}
                        style={{
                            aspectRatio: figureAspect(image),
                            maxHeight: isRender ? "min(42vh, 24rem)" : "min(78vh, 46rem)"
                        }}
                    >
                        <Image
                            src={image.src}
                            alt={image.alt}
                            fill
                            priority
                            sizes="100vw"
                            className={imageFit(image)}
                        />
                        {/* Seats the photograph on the page instead of letting it
                            end on a hard edge against the body background. */}
                        {isRender ? null : (
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[color:var(--paper-950)] to-transparent"
                            />
                        )}
                    </div>
                    {image.caption ? (
                        <figcaption className="editorial-caption mx-auto mt-3 w-full max-w-[72rem] px-[var(--gutter)]">
                            {image.caption}
                        </figcaption>
                    ) : null}
                </figure>
            ) : null}
        </header>
    );
}
