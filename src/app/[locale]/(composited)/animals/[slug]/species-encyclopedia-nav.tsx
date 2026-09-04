type SpeciesEncyclopediaNavProps = {
    items: Array<{id: string; label: string}>;
};

export default function SpeciesEncyclopediaNav({items}: SpeciesEncyclopediaNavProps) {
    if (items.length === 0) return null;

    return (
        <nav
            aria-label="On this page"
            className="hidden lg:flex flex-wrap gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2"
        >
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-200 transition hover:bg-white/5 hover:text-white"
                >
                    {item.label}
                </a>
            ))}
        </nav>
    );
}
