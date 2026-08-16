import Link from "@/app/[locale]/_components/link";
import TierBadge from "@/app/[locale]/(composited)/rankings/_components/tier-badge";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";

export type PlaceSpecies = {
    slug: string;
    name: string;
    scientificName: string;
    tier: string;
    /** Resolved by the route so a species without its own icon can borrow a relative's. */
    artworkSrc?: string;
};

export default function AnimalsToSpot({species, title, description, readSpecies, captiveNote}: {
    species: PlaceSpecies[];
    title: string;
    description: string;
    readSpecies: string;
    /** Shown where the animals are held rather than wild. */
    captiveNote?: string;
}) {
    return (
        <section id="animals-to-spot" className="scroll-mt-24">
            <div className="max-w-3xl">
                <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{title}</h2>
                <p className="mt-3 text-lg leading-8 text-ink-200">{description}</p>
                {captiveNote ? (
                    <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                        {captiveNote}
                    </p>
                ) : null}
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {species.map((entry) => (
                    <Link key={entry.slug} href={`/animals/${entry.slug}`} className="group rounded-2xl bg-white/[0.055] p-4 hover:bg-white/[0.09]">
                        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-xl font-bold text-white group-hover:text-primary-100">
                            <img
                                src={entry.artworkSrc ?? getSpeciesArtworkUrl(entry.slug)}
                                alt=""
                                width={26}
                                height={26}
                                loading="lazy"
                                decoding="async"
                                className="h-8 w-8 shrink-0 rounded-full bg-surface-800 object-contain ring-1 ring-white/15"
                            />
                            {entry.name}
                            <TierBadge tier={entry.tier} size="sm" />
                        </p>
                        <p className="mt-1 text-sm italic text-ink-300">{entry.scientificName}</p>
                        <p className="mt-3 text-sm font-semibold text-primary-200">{readSpecies} →</p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
