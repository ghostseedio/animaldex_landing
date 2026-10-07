import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import PokemonAnimalTable from "@/app/[locale]/(composited)/pokemon-animals/pokemon-animal-table";
import PokemonRealSpeciesSection from "@/app/[locale]/(composited)/pokemon-animals/pokemon-real-species-section";
import {
    buildPokemonEntryContent,
    buildPokemonEntryDescription,
    buildPokemonEntryTitle,
    withArticle
} from "@/app/[locale]/(composited)/pokemon-animals/pokemon-entry-content";
import {
    POKEMON_ANIMAL_CANONICAL_BASE_PATH,
    getPokemonAnimalEntriesByGeneration,
    getPokemonAnimalEntry,
    getPokemonAnimalGeneration,
    pokemonAnimalEntries,
    pokemonAnimalGenerations
} from "@/data/pokemon-animal-counterparts";
import {englishOnlyLanguageAlternates} from "@/lib/content-metadata";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

type PokemonAnimalDetailPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
    return [
        ...pokemonAnimalGenerations.map((generation) => ({locale: "en", slug: generation.slug})),
        ...pokemonAnimalEntries.map((entry) => ({locale: "en", slug: entry.slug}))
    ];
}

export async function generateMetadata({params}: PokemonAnimalDetailPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const generation = getPokemonAnimalGeneration(slug);

    if (generation) {
        const entries = getPokemonAnimalEntriesByGeneration(generation.id);
        const title = `${generation.label} Pokemon Animal Counterparts`;
        const description = `Every ${generation.label} Pokemon categorized by closest real-animal counterpart, including ${entries.slice(0, 4).map((entry) => entry.name).join(", ")}, and more.`;

        return {
            title,
            description,
            keywords: [`${generation.label} Pokemon animals`, "what animal is each Pokemon based on", "Pokemon animal counterparts"],
            alternates: englishOnlyLanguageAlternates(`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`),
            openGraph: {
                type: "website",
                locale: getMetadataLocale(locale),
                title: `${title} | AnimalDex`,
                description,
                url: getLocalePath(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`)
            },
            twitter: {
                card: "summary",
                title: `${title} | AnimalDex`,
                description
            }
        };
    }

    const entry = getPokemonAnimalEntry(slug);

    if (!entry) {
        return {};
    }

    const title = buildPokemonEntryTitle(entry);
    const description = buildPokemonEntryDescription(entry);

    return {
        title,
        description,
        keywords: [
            `what animal is ${entry.name} based on`,
            `${entry.name} real animal`,
            `${entry.name} animal counterpart`,
            `${entry.name} based on`,
            `what animal is ${entry.name}`
        ],
        alternates: englishOnlyLanguageAlternates(`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`),
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${title} | AnimalDex`,
            description,
            url: getLocalePath(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`)
        },
        twitter: {
            card: "summary",
            title: `${title} | AnimalDex`,
            description
        }
    };
}

function confidenceCopy(confidence: string) {
    if (confidence === "strong") {
        return "Strong animal match";
    }

    if (confidence === "medium") {
        return "Reasonable animal match";
    }

    if (confidence === "broad") {
        return "Broad or mixed-animal match";
    }

    return "No single real animal";
}

function PokemonGenerationPage({locale, slug}: {locale: string; slug: string}) {
    const generation = getPokemonAnimalGeneration(slug);

    if (!generation) {
        notFound();
    }

    const entries = getPokemonAnimalEntriesByGeneration(generation.id);
    const pageUrl = getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${generation.slug}`);
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${generation.label} Pokemon Animal Counterparts`,
            description: `Every ${generation.label} Pokemon categorized by closest real-animal counterpart.`,
            url: pageUrl,
            inLanguage: locale
        },
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: entries.map((entry, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: entry.name,
                url: getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`)
            }))
        }
    ];

    return (
        <article className="w-full max-w-[88rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />
            <Link href={POKEMON_ANIMAL_CANONICAL_BASE_PATH} className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                Back to Pokemon animal counterparts
            </Link>

            <section className="flex flex-col gap-5 text-center items-center">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{generation.region}</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white max-w-5xl">
                    {generation.label} Pokemon Animal Counterparts
                </h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">
                    Every {generation.label} Pokemon listed in National Dex order with the closest real-animal resemblance and confidence label.
                </p>
            </section>

            <PokemonAnimalTable entries={entries} />
        </article>
    );
}

function PokemonEntryPage({locale, slug}: {locale: string; slug: string}) {
    const entry = getPokemonAnimalEntry(slug);

    if (!entry) {
        notFound();
    }

    const relatedEntries = getPokemonAnimalEntriesByGeneration(entry.generation)
        .filter((item) => item.slug !== entry.slug && item.animal === entry.animal)
        .slice(0, 8);
    const pageUrl = getAbsoluteUrl(locale, `${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.slug}`);
    const {answer, noteParagraphs, species, comparison, faqs} = buildPokemonEntryContent(entry);
    const primarySpecies = species[0] ?? null;
    const comparisonHeading = primarySpecies
        ? `How ${entry.name} compares to the real ${primarySpecies.name}`
        : entry.confidence === "none"
            ? `Why ${entry.name} has no single real animal`
            : `How ${entry.name} compares to ${withArticle(entry.animal)}`;
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `What Animal Is ${entry.name} Based On?`,
            description: answer,
            url: pageUrl,
            inLanguage: locale,
            author: {"@type": "Organization", name: "AnimalDex"},
            publisher: {"@type": "Organization", name: "AnimalDex"},
            ...(species.length > 0
                ? {about: species.map((item) => ({"@type": "Thing", name: item.name, url: getAbsoluteUrl(locale, item.animalHref)}))}
                : {})
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                    "@type": "Answer",
                    text: faq.answer
                }
            }))
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: "AnimalDex", item: getAbsoluteUrl(locale)},
                {"@type": "ListItem", position: 2, name: "Pokemon Animal Counterparts", item: getAbsoluteUrl(locale, POKEMON_ANIMAL_CANONICAL_BASE_PATH)},
                {"@type": "ListItem", position: 3, name: entry.name, item: pageUrl}
            ]
        }
    ];

    return (
        <article className="w-full max-w-[76rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />
            <Link href={`${POKEMON_ANIMAL_CANONICAL_BASE_PATH}/${entry.generationSlug}`} className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                Back to {entry.generationLabel}
            </Link>

            <section className="flex flex-col gap-5">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">
                    #{String(entry.id).padStart(4, "0")} · {entry.generationLabel}
                </p>
                <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white">
                    What Animal Is {entry.name} Based On?
                </h1>
                <p className="text-lg md:text-xl xl:text-2xl text-ink-200 max-w-4xl">{answer}</p>
                {noteParagraphs.length > 0 ? (
                    <div className="flex flex-col gap-4 max-w-4xl">
                        {noteParagraphs.map((paragraph) => (
                            <p key={paragraph} className="text-ink-200 text-lg leading-8">{paragraph}</p>
                        ))}
                    </div>
                ) : null}
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="  border border-line-300 bg-surface-900/80 px-6 py-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-ink-400">Closest animal</p>
                    <p className="font-display text-4xl text-white mt-2">{entry.animal}</p>
                </div>
                <div className="  border border-line-300 bg-surface-900/80 px-6 py-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-ink-400">Confidence</p>
                    <p className="font-display text-4xl text-white mt-2">{confidenceCopy(entry.confidence)}</p>
                </div>
            </section>

            <section className="  border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{comparisonHeading}</h2>
                {comparison.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">{paragraph}</p>
                ))}
                <p className="text-ink-300 text-base md:text-lg leading-7">
                    Official category: <span className="text-white">{entry.genus}</span>. This page is an AnimalDex comparison for real-animal resemblance, not an official design-origin claim.
                </p>
            </section>

            {species.map((item) => (
                <PokemonRealSpeciesSection key={item.slug} species={item} />
            ))}

            <section className="flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{entry.name} animal FAQ</h2>
                <dl className="flex flex-col gap-4">
                    {faqs.map((faq) => (
                        <div key={faq.question} className="  border border-line-300 bg-surface-900/80 px-6 py-5">
                            <dt className="font-display text-xl md:text-2xl text-white">{faq.question}</dt>
                            <dd className="text-ink-200 text-base md:text-lg leading-7 mt-2">{faq.answer}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            {relatedEntries.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">More {entry.animal} comparisons in {entry.generationLabel}</h2>
                    <PokemonAnimalTable entries={relatedEntries} />
                </section>
            ) : null}
        </article>
    );
}

export default async function PokemonAnimalSlugPage({params}: PokemonAnimalDetailPageProps) {
    const {locale, slug} = params;

    if (getPokemonAnimalGeneration(slug)) {
        return <PokemonGenerationPage locale={locale} slug={slug} />;
    }

    return <PokemonEntryPage locale={locale} slug={slug} />;
}
