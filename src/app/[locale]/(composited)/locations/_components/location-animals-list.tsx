import Link from "@/app/[locale]/_components/link";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";

type LocationAnimalsListProps = {
    title: string;
    description: string;
    rarityLabel: string;
    readSpeciesLabel: string;
    items: Array<{
        speciesSlug: string;
        speciesName: string;
        imageAlt: string;
        rarityStatus: string;
        whyItFits: string;
        rarityHint?: string;
    }>;
};

export default function LocationAnimalsList({
    title,
    description,
    rarityLabel,
    readSpeciesLabel,
    items
}: LocationAnimalsListProps) {
    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-4xl text-white">{title}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                    <article
                        key={item.speciesSlug}
                        className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                    >
                        <Link
                            href={`/animals/${item.speciesSlug}`}
                            className="overflow-hidden rounded-3xl border border-line-300 bg-surface-800/60"
                        >
                            <SpeciesImage
                                slug={item.speciesSlug}
                                alt={item.imageAlt}
                                className="aspect-[4/3]"
                                sizes="(min-width: 768px) 42vw, 100vw"
                            />
                        </Link>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/12 px-3 py-1 text-ink-100 text-xs uppercase tracking-[0.18em] font-semibold bg-white/[0.03]">
                                {item.rarityStatus}
                            </span>
                        </div>
                        <h3 className="font-display font-bold text-2xl text-white">
                            <Link href={`/animals/${item.speciesSlug}`} className="hover:text-primary-100 transition-colors">
                                {item.speciesName}
                            </Link>
                        </h3>
                        <p className="text-ink-200 text-base md:text-lg">{item.whyItFits}</p>
                        {item.rarityHint ? (
                            <p className="text-ink-300 text-sm md:text-base">
                                <span className="text-white">{rarityLabel}: </span>
                                {item.rarityHint}
                            </p>
                        ) : null}
                        <Link
                            href={`/animals/${item.speciesSlug}`}
                            className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                            underline
                        >
                            {readSpeciesLabel}
                        </Link>
                    </article>
                ))}
            </div>
        </section>
    );
}
