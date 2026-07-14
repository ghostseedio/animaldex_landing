type RankingMethodologyProps = {
    title: string;
    description: string;
    items: string[];
};

export default function RankingMethodology({title, description, items}: RankingMethodologyProps) {
    return (
        <section id="methodology" className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
            <ul className="mt-4 grid gap-3 text-base leading-7 text-ink-200 md:grid-cols-3">
                {items.map((item) => (
                    <li key={item} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">{item}</li>
                ))}
            </ul>
        </section>
    );
}
