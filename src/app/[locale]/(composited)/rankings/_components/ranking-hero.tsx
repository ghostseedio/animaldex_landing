type RankingHeroProps = {
    title: string;
    description: string;
    categoryLabel: string;
    updatedLabel: string;
    updatedValue: string;
    rankedSpeciesLabel: string;
    rankedSpeciesValue: string;
    readingTimeLabel: string;
    readingTimeValue: string;
    methodologyHref: string;
    methodologyLabel: string;
};

export default function RankingHero({
    title,
    description,
    categoryLabel,
    updatedLabel,
    updatedValue,
    rankedSpeciesLabel,
    rankedSpeciesValue,
    readingTimeLabel,
    readingTimeValue,
    methodologyHref,
    methodologyLabel
}: RankingHeroProps) {
    return (
        <section className="w-[calc(100vw-2rem)] min-w-0 max-w-full border-b border-line-300 pb-8 md:w-auto md:pb-10">
            <div className="flex max-w-5xl flex-col gap-5">
                <span className="w-fit rounded-md border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">
                    {categoryLabel}
                </span>
                <h1 className="max-w-full break-words font-display text-3xl font-bold leading-[1.05] text-white md:text-5xl lg:text-6xl">{title}</h1>
                <p className="max-w-full text-base leading-8 text-ink-200 md:max-w-3xl md:text-lg">{description}</p>
            </div>
            <div className="mt-6 grid gap-3 text-sm text-ink-300 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-line-400 bg-surface-900/55 p-3">
                    <span className="block text-ink-400">{updatedLabel}</span>
                    <span className="mt-1 block font-semibold text-white">{updatedValue}</span>
                </div>
                <div className="rounded-md border border-line-400 bg-surface-900/55 p-3">
                    <span className="block text-ink-400">{rankedSpeciesLabel}</span>
                    <span className="mt-1 block font-semibold text-white">{rankedSpeciesValue}</span>
                </div>
                <div className="rounded-md border border-line-400 bg-surface-900/55 p-3">
                    <span className="block text-ink-400">{readingTimeLabel}</span>
                    <span className="mt-1 block font-semibold text-white">{readingTimeValue}</span>
                </div>
                <a
                    href={methodologyHref}
                    className="rounded-md border border-line-400 bg-surface-900/55 p-3 font-semibold text-primary-200 transition-colors hover:border-primary-500/60 hover:text-primary-100 focus-visible:text-primary-100"
                >
                    {methodologyLabel}
                </a>
            </div>
        </section>
    );
}
