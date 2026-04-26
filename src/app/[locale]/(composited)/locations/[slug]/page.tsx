import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import LocationHero from "@/app/[locale]/(composited)/locations/_components/location-hero";
import LocationAnimalsList from "@/app/[locale]/(composited)/locations/_components/location-animals-list";
import LocationBestFor from "@/app/[locale]/(composited)/locations/_components/location-best-for";
import LocationSpottingTips from "@/app/[locale]/(composited)/locations/_components/location-spotting-tips";
import RelatedLocationsSection from "@/app/[locale]/(composited)/locations/_components/related-locations-section";
import RelatedChallengesSection from "@/app/[locale]/(composited)/challenges/_components/related-challenges-section";
import RelatedRankingsSection from "@/app/[locale]/(composited)/rankings/_components/related-rankings-section";
import {getBlogPost} from "@/data/blog";
import {getChallenge} from "@/data/challenges";
import {getLocationPage, getRelatedLocations, locationPages} from "@/data/locations";
import {getRankingPage} from "@/data/rankings";
import {getSpeciesBySlug, getSpeciesRarityStatusKey} from "@/data/species";
import {getSpeciesImageAltText} from "@/data/species-images";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getAbsoluteUrl} from "@/lib/site";
import {getScopedTranslator} from "@/loaders/translation";

type LocationPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

type RelatedChallengeCard = {
    slug: string;
    title: string;
    quickVerdict: string;
    animalAName: string;
    animalBName: string;
    comparisonTypeLabel: string;
};

function assertLocationAnimalsHaveSpeciesPages() {
    const missingReferences = locationPages.flatMap((page) =>
        page.animalsToSpot
            .filter((animal) => !getSpeciesBySlug(animal.speciesSlug))
            .map((animal) => `${page.slug}:${animal.speciesSlug}`)
    );

    if (missingReferences.length > 0) {
        throw new Error(
            `Location pages reference missing species pages: ${missingReferences.join(", ")}`
        );
    }
}

assertLocationAnimalsHaveSpeciesPages();

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

export async function generateMetadata({params}: LocationPageProps): Promise<Metadata> {
    const {locale, slug} = params;
    const location = getLocationPage(slug);

    if (!location) {
        return {};
    }

    const keywords = [
        ...location.searchIntents,
        location.name,
        ...location.animalsToSpot.slice(0, 5).map((entry) => getSpeciesBySlug(entry.speciesSlug)?.name || entry.speciesSlug)
    ];

    return buildContentMetadata({
        locale,
        pathname: `/locations/${location.slug}`,
        title: location.title,
        description: location.description,
        keywords,
        featuredImage: location.featuredImage,
        publishedAt: location.publishedAt,
        updatedAt: location.updatedAt,
        tags: [location.regionType, ...location.animalsToSpot.slice(0, 3).map((entry) => entry.speciesSlug)]
    });
}

export function generateStaticParams() {
    return locationPages.map((page) => ({slug: page.slug}));
}

export default async function LocationDetailPage({params}: LocationPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "locations");
    const animalsT = await getScopedTranslator(locale, "animals");
    const rankingsT = await getScopedTranslator(locale, "rankings");
    const location = getLocationPage(slug);

    if (!location) {
        notFound();
    }

    const resolvedAnimals = location.animalsToSpot.map((animal) => {
        const species = getSpeciesBySlug(animal.speciesSlug);

        if (!species) {
            return null;
        }

        return {
            ...animal,
            species
        };
    });

    if (resolvedAnimals.some((entry) => !entry)) {
        notFound();
    }

    const animals = resolvedAnimals.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const relatedChallenges = (location.challengeSlugs || [])
        .map((challengeSlug) => getChallenge(challengeSlug))
        .filter((challenge): challenge is NonNullable<ReturnType<typeof getChallenge>> => Boolean(challenge))
        .map((challenge) => {
            const animalA = getSpeciesBySlug(challenge.animalASlug);
            const animalB = getSpeciesBySlug(challenge.animalBSlug);

            if (!animalA || !animalB) {
                return null;
            }

            return {
                slug: challenge.slug,
                title: challenge.title,
                quickVerdict: challenge.quickVerdict,
                animalAName: animalA.name,
                animalBName: animalB.name,
                comparisonTypeLabel: rankingsT(`challengeCategories.${challenge.comparisonType}`)
            };
        })
        .filter((entry): entry is RelatedChallengeCard => Boolean(entry));
    const relatedRankings = (location.rankingSlugs || [])
        .map((rankingSlug) => getRankingPage(rankingSlug))
        .filter((page): page is NonNullable<ReturnType<typeof getRankingPage>> => Boolean(page))
        .map((page) => ({
            slug: page.slug,
            title: page.title,
            description: page.description,
            categoryLabel: rankingsT(`categories.${page.category}`)
        }));
    const relatedBlogPosts = (location.blogSlugs || [])
        .map((blogSlug) => getBlogPost(blogSlug))
        .filter((post): post is NonNullable<ReturnType<typeof getBlogPost>> => Boolean(post));
    const relatedLocations = getRelatedLocations(location.slug, 3).map((page) => ({
        slug: page.slug,
        title: page.title,
        description: page.description,
        regionTypeLabel: t(`types.${page.regionType}`)
    }));
    const ctaSupportItems = [
        t("ctaSupportOne"),
        t("ctaSupportTwo"),
        t("ctaSupportThree")
    ];
    const pageUrl = getAbsoluteUrl(locale, `/locations/${location.slug}`);
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: location.title,
        description: location.description,
        datePublished: location.publishedAt,
        dateModified: location.updatedAt,
        inLanguage: locale,
        url: pageUrl,
        image: getAbsoluteUrl(locale, location.featuredImage.src),
        keywords: location.searchIntents.join(", "),
        author: {"@type": "Organization", name: "AnimalDex"},
        publisher: {"@type": "Organization", name: "AnimalDex"}
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: animals.map((animal, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: animal.species.name,
            url: getAbsoluteUrl(locale, `/animals/${animal.species.slug}`)
        }))
    };
    const faqSchema = location.faq && location.faq.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: location.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer
            }
        }))
    } : null;
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "AnimalDex",
                item: getAbsoluteUrl(locale)
            },
            {
                "@type": "ListItem",
                position: 2,
                name: t("title"),
                item: getAbsoluteUrl(locale, "/locations")
            },
            {
                "@type": "ListItem",
                position: 3,
                name: location.title,
                item: pageUrl
            }
        ]
    };
    const schemas = faqSchema
        ? [articleSchema, itemListSchema, faqSchema, breadcrumbSchema]
        : [articleSchema, itemListSchema, breadcrumbSchema];

    return (
        <article className="w-full max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            <Link href="/locations" className="text-primary-200 hover:text-primary-100 transition-colors w-fit" underline>
                {t("back")}
            </Link>

            <LocationHero
                title={location.title}
                description={location.description}
                regionTypeLabel={t(`types.${location.regionType}`)}
                featuredImage={location.featuredImage}
                nameLabel={t("nameLabel")}
                nameValue={location.name}
                publishedLabel={t("published")}
                publishedValue={formatDate(locale, location.publishedAt)}
                updatedLabel={t("updated")}
                updatedValue={formatDate(locale, location.updatedAt || location.publishedAt)}
            />

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("quickAnswerTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("quickAnswerDescription")}</p>
                <p className="text-white text-lg md:text-xl leading-8">{location.quickAnswer}</p>
                {location.introduction.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("whyItMattersTitle")}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{t("whyItMattersDescription")}</p>
                {location.whyItMatters.map((paragraph) => (
                    <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                        {paragraph}
                    </p>
                ))}
            </section>

            <LocationAnimalsList
                title={t("animalsToSpotTitle")}
                description={t("animalsToSpotDescription")}
                rarityLabel={t("rarityHintLabel")}
                readSpeciesLabel={t("readSpecies")}
                items={animals.map((animal) => ({
                    speciesSlug: animal.species.slug,
                    speciesName: animal.species.name,
                    imageAlt: getSpeciesImageAltText(animal.species, "thumbnail"),
                    rarityStatus: animalsT(`rarityStatuses.${getSpeciesRarityStatusKey(animal.species.analysis.rarityScore).replace(/-([a-z])/g, (_, char) => char.toUpperCase())}`),
                    whyItFits: animal.whyItFits,
                    rarityHint: animal.rarityHint
                }))}
            />

            <LocationBestFor
                title={t("bestForTitle")}
                description={t("bestForDescription")}
                items={location.bestFor}
            />

            <LocationSpottingTips
                title={t("spottingTipsTitle")}
                description={t("spottingTipsDescription")}
                items={location.spottingTips}
            />

            <IntentCtaCard
                title={t("ctaTitle", {location: location.name})}
                description={t("ctaDescription", {location: location.name})}
                buttonLabel={t("ctaButton")}
                supportItems={ctaSupportItems}
            />

            <RelatedChallengesSection
                title={t("relatedChallengesTitle")}
                description={t("relatedChallengesDescription")}
                readChallengeLabel={t("readChallenge")}
                items={relatedChallenges}
            />

            <RelatedRankingsSection
                title={t("relatedRankingsTitle")}
                description={t("relatedRankingsDescription")}
                readRankingLabel={t("readRanking")}
                items={relatedRankings}
            />

            {relatedBlogPosts.length > 0 && (
                <section className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-display font-bold text-4xl text-white">{t("relatedBlogTitle")}</h2>
                        <p className="text-ink-200 text-lg md:text-xl">{t("relatedBlogDescription")}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedBlogPosts.map((post) => (
                            <article
                                key={post.slug}
                                className="rounded-3xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 flex flex-col gap-3"
                            >
                                <h3 className="font-display font-bold text-2xl text-white">
                                    <Link href={`/blog/${post.slug}`} className="hover:text-primary-100 transition-colors">
                                        {post.title}
                                    </Link>
                                </h3>
                                <p className="text-ink-200 text-base">{post.description}</p>
                                <Link
                                    href={`/blog/${post.slug}`}
                                    className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                                    underline
                                >
                                    {t("readBlog")}
                                </Link>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            <RelatedLocationsSection
                title={t("relatedLocationsTitle")}
                description={t("relatedLocationsDescription")}
                readLocationLabel={t("readLocation")}
                items={relatedLocations}
            />

            {location.faq && location.faq.length > 0 && (
                <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{t("faqTitle")}</h2>
                    <p className="text-ink-200 text-lg md:text-xl">{t("faqDescription")}</p>
                    {location.faq.map((item) => (
                        <div key={item.question} className="rounded-2xl border border-line-300/80 bg-surface-800/60 p-5">
                            <h3 className="text-white text-xl font-semibold">{item.question}</h3>
                            <p className="text-ink-200 text-base md:text-lg mt-2">{item.answer}</p>
                        </div>
                    ))}
                </section>
            )}
        </article>
    );
}
