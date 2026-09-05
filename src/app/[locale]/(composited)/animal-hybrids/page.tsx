import {Metadata} from "next";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {getSpeciesBySlug} from "@/data/species";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

export const revalidate = 86400;

export function generateStaticParams() {
    return [{locale: "en"}, {locale: "id"}];
}

const title = "Animal Hybrid Lab";
const description = "Speculative animal hybrid pages that answer how a cross like zebra + rhino might look, behave, and use an ultimate ability.";

type AnimalHybridsIndexPageProps = {
    params: {
        locale: string;
    };
};

export async function generateMetadata({params}: AnimalHybridsIndexPageProps): Promise<Metadata> {
    const {locale} = params;

    return {
        title,
        description,
        keywords: [
            "animal hybrids",
            "hypothetical animal hybrids",
            "zebra rhino hybrid",
            "animal cross ideas",
            "what would animal hybrids look like"
        ],
        alternates: {
            canonical: getLocalePath(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, ANIMAL_HYBRID_CANONICAL_BASE_PATH);
                return acc;
            }, {
                "x-default": getLocalePath(localeConfig.defaultLocale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)
        },
        twitter: {
            card: "summary",
            title: `${title} | AnimalDex`,
            description
        }
    };
}

export default async function AnimalHybridsIndexPage({params}: AnimalHybridsIndexPageProps) {
    const {locale} = params;
    const pageUrl = getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH);
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
        itemListElement: animalHybridEntries.map((entry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: entry.title,
            url: getAbsoluteUrl(locale, `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`)
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

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Fictional crosses, biology-first answers</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">
                    These pages are speculative creature-design answers for search questions. Each one separates real-world viability from the fun design question: what would the hybrid look like, how would it behave, and what ultimate ability would emerge from both animals?
                </p>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {animalHybridEntries.map((entry, index) => {
                    const firstSpecies = getSpeciesBySlug(entry.parents[0].slug);
                    const secondSpecies = getSpeciesBySlug(entry.parents[1].slug);
                    const showImages = index < 24;

                    return (
                        <article
                            key={entry.slug}
                            className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 md:p-6 flex flex-col gap-5"
                        >
                            {showImages ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {firstSpecies ? (
                                        <SpeciesArtworkImage
                                            slug={firstSpecies.slug}
                                            alt={`${firstSpecies.name} artwork`}
                                            className="aspect-[4/3] rounded-3xl border border-line-300"
                                            sizes="(min-width: 1024px) 20vw, 45vw"
                                        />
                                    ) : null}
                                    {secondSpecies ? (
                                        <SpeciesArtworkImage
                                            slug={secondSpecies.slug}
                                            alt={`${secondSpecies.name} artwork`}
                                            className="aspect-[4/3] rounded-3xl border border-line-300"
                                            sizes="(min-width: 1024px) 20vw, 45vw"
                                        />
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {firstSpecies ? (
                                        <Link href={`/animals/${firstSpecies.slug}`} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                                            {firstSpecies.name}
                                        </Link>
                                    ) : null}
                                    {secondSpecies ? (
                                        <Link href={`/animals/${secondSpecies.slug}`} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 hover:text-primary-100">
                                            {secondSpecies.name}
                                        </Link>
                                    ) : null}
                                </div>
                            )}
                            <div className="flex flex-col gap-3">
                                <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">{entry.hybridName}</p>
                                <h2 className="font-display font-bold text-3xl text-white">{entry.title}</h2>
                                <p className="text-ink-200 text-lg leading-8">{entry.quickAnswer}</p>
                                <div className="rounded-3xl border border-primary-500/30 bg-primary-900/10 px-4 py-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-primary-200">Ultimate ability</p>
                                    <p className="font-display text-2xl font-bold text-white">{entry.ultimateAbility.name}</p>
                                    <p className="text-ink-200 mt-2">{entry.ultimateAbility.description}</p>
                                </div>
                            </div>
                            <Link
                                href={`${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`}
                                className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                                underline
                            >
                                Read the hybrid profile
                            </Link>
                        </article>
                    );
                })}
            </section>
        </article>
    );
}
