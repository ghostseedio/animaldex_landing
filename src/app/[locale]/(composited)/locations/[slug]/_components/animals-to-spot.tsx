import Link from "@/app/[locale]/_components/link";
import {getSpeciesBySlug} from "@/data/species";

export default function AnimalsToSpot({speciesSlugs, title, description, readSpecies}: {
    speciesSlugs: string[];
    title: string;
    description: string;
    readSpecies: string;
}) {
    const species = speciesSlugs.map((slug) => getSpeciesBySlug(slug)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return (
        <section id="animals-to-spot" className="scroll-mt-24">
            <div className="max-w-3xl">
                <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{title}</h2>
                <p className="mt-3 text-lg leading-8 text-ink-200">{description}</p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {species.map((entry) => (
                    <Link key={entry.slug} href={`/animals/${entry.slug}`} className="group rounded-2xl bg-white/[0.055] p-4 hover:bg-white/[0.09]">
                        <p className="font-display text-xl font-bold text-white group-hover:text-primary-100">{entry.name}</p>
                        <p className="mt-1 text-sm italic text-ink-300">{entry.analysis.scientificName}</p>
                        <p className="mt-3 text-sm font-semibold text-primary-200">{readSpecies} →</p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
