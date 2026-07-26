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
            className="group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[#121512] transition duration-200 hover:-translate-y-0.5 hover:border-primary-300/35 hover:bg-[#161b16] motion-reduce:transform-none"
        >
            <div className="relative flex aspect-[5/4] items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(56,250,71,0.12),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]">
                <span className="relative h-[72%] w-[72%]">
                    <SpeciesArtworkImage
                        slug={item.slug}
                        alt={getSpeciesImageAltText(item, "thumbnail")}
                        className="h-full w-full !bg-transparent transition duration-300 group-hover:scale-[1.04] motion-reduce:transform-none"
                        sizes="(min-width: 1280px) 16vw, (min-width: 640px) 28vw, 70vw"
                        fit="contain"
                    />
                </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 font-display text-xl font-bold leading-tight text-white transition-colors group-hover:text-primary-100">
                        {item.name}
                    </h3>
                    <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 text-sm font-bold text-primary-200/80 transition group-hover:translate-x-0.5 group-hover:text-primary-100"
                    >
                        →
                    </span>
                </div>
                <p className="line-clamp-2 text-sm leading-6 text-white/45">
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
        <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                    <RelatedSpeciesTile key={item.slug} item={item} openLabel={openLabel} />
                ))}
            </div>
        </section>
    );
}
