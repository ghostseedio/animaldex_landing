import Link from "@/app/[locale]/_components/link";

type RelatedRankingsSectionProps = {
    title: string;
    description: string;
    readRankingLabel: string;
    items: Array<{
        slug: string;
        title: string;
        description: string;
        categoryLabel: string;
    }>;
};

export default function RelatedRankingsSection({
    title,
    description,
    readRankingLabel,
    items
}: RelatedRankingsSectionProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{title}</h2>
                <p className="max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {items.map((item) => (
                    <article
                        key={item.slug}
                        className="flex flex-col gap-3 rounded-lg border border-line-300 bg-surface-900/75 p-5"
                    >
                        <span className="w-fit text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">
                            {item.categoryLabel}
                        </span>
                        <h3 className="font-display text-2xl font-bold leading-tight text-white">
                            <Link href={`/tier-list/${item.slug}`} className="hover:text-primary-100 transition-colors">
                                {item.title}
                            </Link>
                        </h3>
                        <p className="text-sm leading-6 text-ink-200">{item.description}</p>
                        <Link
                            href={`/tier-list/${item.slug}`}
                            className="mt-auto w-fit text-sm font-semibold text-primary-200 hover:text-primary-100 transition-colors"
                            underline
                        >
                            {readRankingLabel}
                        </Link>
                    </article>
                ))}
            </div>
        </section>
    );
}
