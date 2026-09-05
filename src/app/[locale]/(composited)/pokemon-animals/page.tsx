import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import PokemonAnimalTable from "@/app/[locale]/(composited)/pokemon-animals/pokemon-animal-table";
import {
    POKEMON_ANIMAL_CANONICAL_BASE_PATH,
    getPokemonAnimalEntriesByGeneration,
    getPokemonAnimalSummary,
    pokemonAnimalEntries,
    pokemonAnimalGenerations
} from "@/data/pokemon-animal-counterparts";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

export const revalidate = 86400;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

const title = "Pokemon Animal Counterparts";
const description = "A generation-by-generation directory showing the real animal each Pokemon most closely resembles, with direct answers for search queries like what animal is Pikachu based on.";

type PokemonAnimalsIndexPageProps = {
    params: {
        locale: string;
    };
};

export async function generateMetadata({params}: PokemonAnimalsIndexPageProps): Promise<Metadata> {
    const {locale} = params;

    return {
        title,
        description,
        keywords: [
            "what animal is each Pokemon based on",
            "Pokemon animal counterparts",
            "real animals Pokemon are based on",
            "Pokemon by generation animals"
        ],
        alternates: {
            canonical: getLocalePath(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, POKEMON_ANIMAL_CANONICAL_BASE_PATH);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, POKEMON_ANIMAL_CANONICAL_BASE_PATH)
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH)
        },
        twitter: {
            card: "summary",
            title: `${title} | AnimalDex`,
            description
        }
    };
}

export default async function PokemonAnimalsIndexPage({params}: PokemonAnimalsIndexPageProps) {
    const {locale} = params;
    const summary = getPokemonAnimalSummary();
    const pageUrl = getAbsoluteUrl(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH);
    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        url: pageUrl,
        inLanguage: locale
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: pokemonAnimalGenerations.map((generation, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: generation.label,
            url: getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`)
        }))
    };

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />

            <section className="flex flex-col gap-5 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">Explore</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-5xl">{title}</h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{description}</p>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Pokemon animal counterpart summary">
                <div className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-ink-400">Total</p>
                    <p className="font-display text-4xl text-white">{summary.total}</p>
                </div>
                <div className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-ink-400">Strong</p>
                    <p className="font-display text-4xl text-white">{summary.strongCount}</p>
                </div>
                <div className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-ink-400">Broad</p>
                    <p className="font-display text-4xl text-white">{summary.mediumCount + summary.broadCount}</p>
                </div>
                <div className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-ink-400">No single animal</p>
                    <p className="font-display text-4xl text-white">{summary.noSingleAnimalCount}</p>
                </div>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">How to read this directory</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    Each row gives the closest real-animal counterpart, not a claim that the Pokemon was officially designed from only that animal. Many designs mix animals with mythology, objects, plants, machines, fossils, or original fantasy traits.
                </p>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    The directory uses English names, National Dex order, generation data, and official category text from PokeAPI data, then adds AnimalDex editorial comparison labels for animal resemblance.
                </p>
            </section>

            <nav className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Pokemon generations">
                {pokemonAnimalGenerations.map((generation) => {
                    const entries = getPokemonAnimalEntriesByGeneration(generation.id);
                    return (
                        <Link
                            key={generation.slug}
                            href={`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`}
                            className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5 hover:border-primary-500/60 transition-colors"
                        >
                            <span className="block text-primary-200 text-sm uppercase tracking-[0.2em]">{generation.region}</span>
                            <span className="block font-display text-3xl font-bold text-white">{generation.label}</span>
                            <span className="block text-ink-300 mt-2">{entries.length} Pokemon</span>
                        </Link>
                    );
                })}
            </nav>

            <section className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">All Pokemon Animal Counterparts by Generation</h2>
                    <p className="text-ink-200 text-lg md:text-xl">
                        Browse the full list here, or open a generation page for a cleaner table.
                    </p>
                </div>
                {pokemonAnimalGenerations.map((generation) => (
                    <section key={generation.slug} className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                            <div>
                                <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">{generation.region}</p>
                                <h3 className="font-display font-bold text-3xl text-white">{generation.label}</h3>
                            </div>
                            <Link href={`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`} className="text-primary-200 hover:text-primary-100" underline>
                                Open generation page
                            </Link>
                        </div>
                        <PokemonAnimalTable entries={getPokemonAnimalEntriesByGeneration(generation.id)} />
                    </section>
                ))}
            </section>
        </article>
    );
}
