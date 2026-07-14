import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import TierBadge from "@/app/[locale]/(composited)/rankings/_components/tier-badge";

type TierListSummaryProps = {
    title: string;
    answer: string;
    clarification: string;
    readSpeciesLabel: string;
    items: Array<{
        rank: number;
        tier: string;
        speciesSlug: string;
        speciesName: string;
        iconSrc: string;
        primaryMetric: string;
    }>;
};

export default function TierListSummary({title, answer, clarification, readSpeciesLabel, items}: TierListSummaryProps) {
    return (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1fr)]" aria-labelledby="quick-answer">
            <div className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
                <h2 id="quick-answer" className="font-display text-3xl font-bold text-white">{title}</h2>
                <p className="mt-4 text-lg leading-8 text-white">{answer}</p>
                <p className="mt-4 text-base leading-7 text-ink-300">{clarification}</p>
            </div>
            <div className="rounded-lg border border-line-300 bg-surface-900/75 p-4">
                <div className="flex flex-col gap-3">
                    {items.map((item) => (
                        <article key={`${item.rank}-${item.speciesSlug}`} className="grid grid-cols-[auto_1fr] gap-3 rounded-md border border-line-400 bg-canvas-900/45 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-line-300 bg-surface-800 text-sm font-bold text-white">
                                #{item.rank}
                            </span>
                            <div className="min-w-0">
                                <Link href={`/animals/${item.speciesSlug}`} className="flex items-center gap-3 font-semibold text-white transition-colors hover:text-primary-100 focus-visible:text-primary-100">
                                    <SpeciesArtworkImage
                                        slug={item.speciesSlug}
                                        alt={`${item.speciesName} animal icon`}
                                        src={item.iconSrc}
                                        className="h-12 w-12 shrink-0 rounded-md border border-line-300"
                                        sizes="48px"
                                    />
                                    <span>{item.speciesName}</span>
                                </Link>
                                <p className="mt-1 text-sm leading-6 text-ink-300">{item.primaryMetric}</p>
                            </div>
                            <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
                                <TierBadge tier={item.tier} />
                                <Link href={`/animals/${item.speciesSlug}`} className="text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100">
                                    {readSpeciesLabel}
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
