type RankingMethodologyProps = {
    title: string;
    description: string;
    items: string[];
    factorsTitle?: string;
    factors?: string[];
};

export default function RankingMethodology({
    title,
    description,
    items,
    factorsTitle,
    factors
}: RankingMethodologyProps) {
    return (
        <section id="methodology" className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
            {factors && factors.length > 0 ? (
                <div className="mt-4">
                    {factorsTitle ? (
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-400">{factorsTitle}</p>
                    ) : null}
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {factors.map((factor) => (
                            <li key={factor} className="rounded-md border border-primary-500/25 bg-primary-500/10 px-3 py-2 text-sm text-primary-100">
                                {factor}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <ul className="mt-4 grid gap-3 text-base leading-7 text-ink-200 md:grid-cols-3">
                {items.map((item) => (
                    <li key={item} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">{item}</li>
                ))}
            </ul>
        </section>
    );
}
