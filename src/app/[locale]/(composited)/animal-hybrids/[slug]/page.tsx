import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import {
    ANIMAL_HYBRID_CANONICAL_BASE_PATH,
    animalHybridEntries,
    getAnimalHybrid,
    getRelatedAnimalHybrids
} from "@/data/animal-hybrids";
import {getSpeciesBySlug} from "@/data/species";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

type AnimalHybridDetailPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

export function generateStaticParams() {
    return animalHybridEntries.map((entry) => ({slug: entry.slug}));
}

export async function generateMetadata({params}: AnimalHybridDetailPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const entry = getAnimalHybrid(slug);

    if (!entry) {
        return {};
    }

    return {
        title: `${entry.title}: How It Might Look and Behave`,
        description: entry.quickAnswer,
        keywords: entry.searchIntents,
        alternates: {
            canonical: getLocalePath(locale, `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`)
        },
        openGraph: {
            type: "article",
            locale: getMetadataLocale(locale),
            title: `${entry.title} | AnimalDex`,
            description: entry.quickAnswer,
            url: getLocalePath(locale, `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`)
        },
        twitter: {
            card: "summary",
            title: `${entry.title} | AnimalDex`,
            description: entry.quickAnswer
        }
    };
}

export default async function AnimalHybridDetailPage({params}: AnimalHybridDetailPageProps) {
    const {locale, slug} = params;
    const entry = getAnimalHybrid(slug);

    if (!entry) {
        notFound();
    }

    const parentSpecies = entry.parents.map((parent) => getSpeciesBySlug(parent.slug));
    const relatedEntries = getRelatedAnimalHybrids(entry.slug);
    const pageUrl = getAbsoluteUrl(locale, `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`);
    const schema = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${entry.title}: How It Might Look and Behave`,
            description: entry.quickAnswer,
            url: pageUrl,
            dateModified: entry.updatedAt,
            inLanguage: locale,
            author: {"@type": "Organization", name: "AnimalDex"},
            publisher: {"@type": "Organization", name: "AnimalDex"},
            keywords: entry.searchIntents.join(", ")
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
                {
                    "@type": "Question",
                    name: entry.seoQuestion,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: entry.quickAnswer
                    }
                },
                {
                    "@type": "Question",
                    name: `Could a ${entry.parents[0].name} and ${entry.parents[1].name} really hybridize?`,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: entry.viability
                    }
                }
            ]
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {"@type": "ListItem", position: 1, name: "AnimalDex", item: getAbsoluteUrl(locale)},
                {"@type": "ListItem", position: 2, name: "Animal Hybrid Lab", item: getAbsoluteUrl(locale, ANIMAL_HYBRID_CANONICAL_BASE_PATH)},
                {"@type": "ListItem", position: 3, name: entry.title, item: pageUrl}
            ]
        }
    ];

    return (
        <article className="w-full max-w-[82rem] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <Link href={ANIMAL_HYBRID_CANONICAL_BASE_PATH} className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                Back to Animal Hybrid Lab
            </Link>

            <section className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
                <div className="flex flex-col gap-5">
                    <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{entry.hybridName}</p>
                    <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-white">{entry.title}</h1>
                    <p className="text-lg md:text-xl xl:text-2xl text-ink-200 leading-9">{entry.quickAnswer}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {parentSpecies.map((species, index) => species ? (
                        <SpeciesArtworkImage
                            key={species.slug}
                            slug={species.slug}
                            alt={`${species.name} artwork for ${entry.title}`}
                            priority={index === 0}
                            className="aspect-[4/5] rounded-3xl border border-line-300"
                            sizes="(min-width: 1024px) 20vw, 45vw"
                        />
                    ) : null)}
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entry.parents.map((parent) => (
                    <div key={parent.slug} className="rounded-3xl border border-line-300 bg-surface-900/80 px-6 py-6 flex flex-col gap-3">
                        <p className="text-sm uppercase tracking-[0.2em] text-ink-400">Parent behavior</p>
                        <h2 className="font-display text-3xl font-bold text-white">{parent.name}</h2>
                        <p className="text-ink-200 text-lg leading-8">{parent.behavior}</p>
                        <Link href={`/animals/${parent.slug}`} className="text-primary-200 hover:text-primary-100 w-fit" underline>
                            View animal guide
                        </Link>
                    </div>
                ))}
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Could this hybrid really exist?</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{entry.viability}</p>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">How it might look</h2>
                    <p className="text-ink-200 text-lg md:text-xl leading-8">{entry.appearance}</p>
                </div>
                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">How it might behave</h2>
                    <p className="text-ink-200 text-lg md:text-xl leading-8">{entry.behaviorBlend}</p>
                </div>
            </section>

            <section className="rounded-4xl border border-primary-500/40 bg-primary-900/10 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">Ultimate ability</p>
                <h2 className="font-display font-bold text-4xl md:text-5xl text-white">{entry.ultimateAbility.name}</h2>
                <p className="text-ink-100 text-lg md:text-xl leading-8">{entry.ultimateAbility.description}</p>
                <p className="text-ink-300 text-lg md:text-xl leading-8">
                    <span className="text-white">Trigger:</span> {entry.ultimateAbility.trigger}
                </p>
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Hybrid ecological role</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{entry.habitatRole}</p>
            </section>

            {relatedEntries.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">Related animal hybrids</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {relatedEntries.map((related) => (
                            <Link
                                key={related.slug}
                                href={`${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${related.slug}`}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 px-5 py-5 hover:border-primary-500/60 transition-colors"
                            >
                                <span className="block text-primary-200 text-sm uppercase tracking-[0.2em]">{related.hybridName}</span>
                                <span className="block font-display text-3xl font-bold text-white">{related.title}</span>
                                <span className="block text-ink-300 mt-2">{related.ultimateAbility.name}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}
        </article>
    );
}
