type LocationSpottingTipsProps = {
    title: string;
    description: string;
    items: string[];
};

export default function LocationSpottingTips({
    title,
    description,
    items
}: LocationSpottingTipsProps) {
    return (
        <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
            <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
            <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
            <ol className="mt-5 grid gap-3 text-base leading-7 text-ink-200 md:grid-cols-2">
                {items.map((item, index) => (
                    <li key={item} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">
                        <span className="mb-2 block text-sm font-semibold text-primary-200">0{index + 1}</span>
                        {item}
                    </li>
                ))}
            </ol>
        </section>
    );
}
