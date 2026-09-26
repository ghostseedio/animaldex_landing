type SpeciesEncyclopediaNavProps = {
    items: Array<{id: string; label: string}>;
};

export default function SpeciesEncyclopediaNav({items}: SpeciesEncyclopediaNavProps) {
    if (items.length === 0) return null;

    return (
        <nav
            aria-label="On this page"
            className="hidden border-y border-line-300 lg:flex lg:flex-wrap"
        >
            {items.map((item) => (
                <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="border-b-2 border-transparent px-4 py-3.5 text-sm font-semibold text-ink-300 transition-colors hover:border-primary-400/60 hover:text-white"
                >
                    {item.label}
                </a>
            ))}
        </nav>
    );
}
