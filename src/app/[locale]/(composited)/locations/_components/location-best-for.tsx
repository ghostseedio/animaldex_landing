type LocationBestForProps = {
    title: string;
    description: string;
    items: string[];
};

export default function LocationBestFor({
    title,
    description,
    items
}: LocationBestForProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
            <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            <ul className="flex flex-col gap-3 text-ink-200 text-lg md:text-xl list-disc pl-5">
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </section>
    );
}
