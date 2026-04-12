type RankingHeroProps = {
    title: string;
    description: string;
    categoryLabel: string;
    publishedLabel: string;
    publishedValue: string;
    updatedLabel: string;
    updatedValue: string;
};

export default function RankingHero({
    title,
    description,
    categoryLabel,
    publishedLabel,
    publishedValue,
    updatedLabel,
    updatedValue
}: RankingHeroProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                    {categoryLabel}
                </span>
            </div>
            <div className="flex flex-col gap-4">
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">{title}</h1>
                <p className="text-ink-200 text-lg md:text-xl xl:text-2xl leading-8">{description}</p>
            </div>
            <div className="text-ink-300 text-sm md:text-base flex flex-wrap gap-x-6 gap-y-3">
                <span>
                    <span className="text-white">{publishedLabel}: </span>
                    {publishedValue}
                </span>
                <span>
                    <span className="text-white">{updatedLabel}: </span>
                    {updatedValue}
                </span>
            </div>
        </section>
    );
}
