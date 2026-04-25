import Link from "@/app/[locale]/_components/link";

type RelatedLocationsSectionProps = {
    title: string;
    description: string;
    readLocationLabel: string;
    items: Array<{
        slug: string;
        title: string;
        description: string;
        regionTypeLabel: string;
    }>;
};

export default function RelatedLocationsSection({
    title,
    description,
    readLocationLabel,
    items
}: RelatedLocationsSectionProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-4xl text-white">{title}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {items.map((item) => (
                    <article
                        key={item.slug}
                        className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                    >
                        <span className="rounded-full border border-primary-500/30 px-3 py-1 w-fit text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                            {item.regionTypeLabel}
                        </span>
                        <h3 className="font-display font-bold text-2xl text-white">
                            <Link href={`/locations/${item.slug}`} className="hover:text-primary-100 transition-colors">
                                {item.title}
                            </Link>
                        </h3>
                        <p className="text-ink-200 text-base">{item.description}</p>
                        <Link
                            href={`/locations/${item.slug}`}
                            className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                            underline
                        >
                            {readLocationLabel}
                        </Link>
                    </article>
                ))}
            </div>
        </section>
    );
}
