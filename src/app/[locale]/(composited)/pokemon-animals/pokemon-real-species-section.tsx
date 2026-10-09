import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import type {PokemonRealSpecies} from "@/app/[locale]/(composited)/pokemon-animals/pokemon-entry-content";

/** "Meet the real <animal>": database facts for one species a Pokémon is paired with. */
export default function PokemonRealSpeciesSection({species}: {species: PokemonRealSpecies}) {
    return (
        <section className="  border border-line-300 bg-surface-900/80 px-6 py-8 md:px-10 md:py-10 flex flex-col gap-5">
            <div className="flex items-center gap-5">
                <Link href={species.animalHref} aria-label={`${species.name} field guide`} className="shrink-0">
                    <SpeciesArtworkImage
                        slug={species.slug}
                        alt={species.name}
                        fit="contain"
                        className="h-24 w-24 md:h-32 md:w-32 rounded-full border border-line-300"
                        sizes="128px"
                    />
                </Link>
                <div className="flex flex-col gap-1">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Meet the real {species.name}</h2>
                    {species.scientificName ? <p className="text-ink-300 italic">{species.scientificName}</p> : null}
                </div>
            </div>

            {species.summary ? <p className="text-ink-200 text-lg md:text-xl leading-8">{species.summary}</p> : null}

            {species.identification.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <h3 className="font-display text-xl md:text-2xl text-white">How to recognize it</h3>
                    <ul className="list-disc pl-6 text-ink-200 text-base md:text-lg leading-7">
                        {species.identification.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {species.facts.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <h3 className="font-display text-xl md:text-2xl text-white">Real {species.name} facts</h3>
                    <ul className="list-disc pl-6 text-ink-200 text-base md:text-lg leading-7">
                        {species.facts.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {species.diet || species.lifespan || species.predators ? (
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {species.diet ? (
                        <div>
                            <dt className="text-sm uppercase tracking-[0.2em] text-ink-400">Diet</dt>
                            <dd className="text-ink-200 text-base md:text-lg leading-7 mt-1">{species.diet}</dd>
                        </div>
                    ) : null}
                    {species.lifespan ? (
                        <div>
                            <dt className="text-sm uppercase tracking-[0.2em] text-ink-400">Lifespan</dt>
                            <dd className="text-ink-200 text-base md:text-lg leading-7 mt-1">{species.lifespan}</dd>
                        </div>
                    ) : null}
                    {species.predators ? (
                        <div className="md:col-span-2">
                            <dt className="text-sm uppercase tracking-[0.2em] text-ink-400">Predators and threats</dt>
                            <dd className="text-ink-200 text-base md:text-lg leading-7 mt-1">{species.predators}</dd>
                        </div>
                    ) : null}
                </dl>
            ) : null}

            {species.stats.length > 0 ? (
                <div className="overflow-x-auto border border-line-300">
                    <table className="w-full border-collapse text-left">
                        <caption className="sr-only">AnimalDex stats for the {species.name}, out of 100</caption>
                        <thead className="bg-surface-800/80 text-xs uppercase tracking-[0.2em] text-ink-300">
                            <tr>
                                {species.stats.map((stat) => (
                                    <th key={stat.label} scope="col" className="px-4 py-3 font-semibold">{stat.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="text-white font-display text-2xl">
                                {species.stats.map((stat) => (
                                    <td key={stat.label} className="px-4 py-3">
                                        {stat.value}<span className="text-ink-400 text-sm">/100</span>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Link href={species.animalHref} className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                    {species.name} field guide
                </Link>
                {species.lessonHref ? (
                    <Link href={species.lessonHref} className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                        What the {species.name} teaches
                    </Link>
                ) : null}
            </div>
        </section>
    );
}
