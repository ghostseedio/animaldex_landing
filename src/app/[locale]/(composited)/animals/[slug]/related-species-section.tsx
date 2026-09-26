import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {getSpeciesImageAltText} from "@/data/species-images";
import type {SpeciesEntry} from "@/data/species";

function truncatePlain(text: string, max = 88) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= max) return normalized;
    const clipped = normalized.slice(0, max).replace(/\s+\S*$/, "").trim();
    return `${clipped}…`;
}

function RelatedSpeciesTile({item, openLabel}: {item: SpeciesEntry; openLabel: string}) {
    return (
        <Link
            href={`/animals/${item.slug}`}
            className="group relative flex h-full flex-col overflow-hidden bg-surface-900 transition-colors duration-300 hover:bg-surface-800/70 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-200"
        >
            <div className="relative flex aspect-square items-center justify-center bg-[radial-gradient(58%_54%_at_50%_44%,rgba(167,244,50,0.10),transparent_70%)] transition-opacity duration-500 group-hover:opacity-100">
                <span className="relative h-[78%] w-[78%]">
                    <SpeciesArtworkImage
                        slug={item.slug}
                        alt={getSpeciesImageAltText(item, "thumbnail")}
                        className="h-full w-full !bg-transparent transition duration-300 group-hover:scale-[1.04] motion-reduce:transform-none"
                        sizes="(min-width: 1280px) 16vw, (min-width: 640px) 28vw, 70vw"
                        fit="contain"
                    />
                </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 border-t border-line-300 px-4 pb-4 pt-3.5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 font-display text-base font-bold leading-tight tracking-tight text-white sm:text-lg">
                        {item.name}
                    </h3>
                    <span
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-sm font-bold text-ink-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary-200"
                    >
                        →
                    </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-ink-300 sm:text-sm">
                    {truncatePlain(item.analysis.summary)}
                </p>
                <span className="sr-only">{openLabel}</span>
            </div>
        </Link>
    );
}

export default function RelatedSpeciesSection({
    title,
    hubHref,
    hubLabel,
    openLabel,
    items
}: {
    title: string;
    hubHref?: string | null;
    hubLabel?: string | null;
    openLabel: string;
    items: SpeciesEntry[];
}) {
    if (items.length === 0) return null;

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                <div className="flex flex-col gap-3">
                    <span aria-hidden="true" className="h-[3px] w-10 rounded-full bg-gradient-to-r from-primary-400 to-primary-500/20" />
                    <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
                </div>
                {hubHref && hubLabel ? (
                    <Link
                        href={hubHref}
                        className="shrink-0 text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100"
                        underline
                    >
                        {hubLabel}
                    </Link>
                ) : null}
            </div>
            <div className="grid grid-cols-1 gap-px overflow-hidden bg-line-300 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                    <RelatedSpeciesTile key={item.slug} item={item} openLabel={openLabel} />
                ))}
            </div>
        </section>
    );
}
