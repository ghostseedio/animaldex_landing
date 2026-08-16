import Link from "@/app/[locale]/_components/link";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";
import TierBadge from "@/app/[locale]/(composited)/rankings/_components/tier-badge";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";

type LocationAnimalsListProps = {
    title: string;
    description: string;
    rarityLabel: string;
    readSpeciesLabel: string;
    items: Array<{
        speciesSlug: string;
        speciesName: string;
        imageAlt: string;
        rarityStatus: string;
        whyItFits: string;
        rarityHint?: string;
        tier?: string;
        /** Resolved by the page so a species without its own icon can borrow a relative's. */
        artworkSrc?: string;
    }>;
};

export default function LocationAnimalsList({
    title,
    description,
    rarityLabel,
    readSpeciesLabel,
    items
}: LocationAnimalsListProps) {
    return (
        <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
                <p className="max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                    <article
                        key={item.speciesSlug}
                        className="group flex h-full flex-col overflow-hidden rounded-lg border border-line-300 bg-surface-900/75 transition duration-200 hover:-translate-y-0.5 hover:border-primary-500/50 hover:bg-surface-800/85 motion-reduce:transform-none"
                    >
                        <Link
                            href={`/animals/${item.speciesSlug}`}
                            className="overflow-hidden border-b border-line-400 bg-canvas-900"
                        >
                            <SpeciesImage
                                slug={item.speciesSlug}
                                alt={item.imageAlt}
                                className="aspect-[4/3] transition duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
                                sizes="(min-width: 1280px) 28vw, (min-width: 768px) 44vw, 100vw"
                            />
                        </Link>
                        <div className="flex flex-1 flex-col gap-3 p-5">
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-md border border-white/12 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-100">
                                    {item.rarityStatus}
                                </span>
                            </div>
                            <h3 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 break-words font-display text-2xl font-bold leading-tight text-white">
                                <img
                                    src={item.artworkSrc ?? getSpeciesArtworkUrl(item.speciesSlug)}
                                    alt=""
                                    width={28}
                                    height={28}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-8 w-8 shrink-0 rounded-full bg-surface-800 object-contain ring-1 ring-white/15"
                                />
                                <Link href={`/animals/${item.speciesSlug}`} className="hover:text-primary-100 transition-colors">
                                    {item.speciesName}
                                </Link>
                                {item.tier ? <TierBadge tier={item.tier} size="sm" /> : null}
                            </h3>
                            <p className="text-sm leading-6 text-ink-200 md:text-base">{item.whyItFits}</p>
                            {item.rarityHint ? (
                                <p className="text-sm leading-6 text-ink-300">
                                    <span className="font-semibold text-white">{rarityLabel}: </span>
                                    {item.rarityHint}
                                </p>
                            ) : null}
                            <Link
                                href={`/animals/${item.speciesSlug}`}
                                className="mt-auto w-fit text-sm font-semibold text-primary-200 hover:text-primary-100 transition-colors"
                                underline
                            >
                                {readSpeciesLabel}
                            </Link>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
