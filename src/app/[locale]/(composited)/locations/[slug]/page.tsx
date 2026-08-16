import {Metadata} from "next";
import {notFound} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import IntentCtaCard from "@/app/[locale]/(composited)/_components/intent-cta-card";
import LocationBreadcrumbs from "@/app/[locale]/(composited)/locations/_components/location-breadcrumbs";
import LocationHero from "@/app/[locale]/(composited)/locations/_components/location-hero";
import LocationAnimalsList from "@/app/[locale]/(composited)/locations/_components/location-animals-list";
import LocationBestFor from "@/app/[locale]/(composited)/locations/_components/location-best-for";
import LocationSpottingTips from "@/app/[locale]/(composited)/locations/_components/location-spotting-tips";
import RelatedLocationsSection from "@/app/[locale]/(composited)/locations/_components/related-locations-section";
import RelatedChallengesSection from "@/app/[locale]/(composited)/challenges/_components/related-challenges-section";
import RelatedRankingsSection from "@/app/[locale]/(composited)/rankings/_components/related-rankings-section";
import {getBlogPost} from "@/data/blog";
import {getChallenge} from "@/data/challenges";
import {DATABASE_BACKED_LOCATION_SPECIES, getLocationPage, getRelatedLocations, locationPages} from "@/data/locations";
import {getLocationMap, getLocationMapSpeciesSlugs} from "@/data/location-maps";
import {getLocationCoordinate, getPlaceCoordinate} from "@/data/location-coordinates";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {getSpeciesTier} from "@/lib/species-tier";
import LocationHabitatMap, {type HabitatMapSpecies} from "@/app/[locale]/(composited)/locations/_components/location-habitat-map";
import LocationWildlifeMap, {type WildlifeMapPlace} from "@/app/[locale]/(composited)/locations/_components/location-wildlife-map";
import {getPlaceGuideLocationName, isPlaceCollectionIndexable} from "@/data/location-places";
import {getRankingPage, getRankingTierListTitle} from "@/data/rankings";
import {getSpeciesBySlug, getSpeciesRarityStatusKey} from "@/data/species";
import {getSpeciesImageAltText} from "@/data/species-images";
import {buildSpeciesArtworkSrc, getResolvedSpeciesArtworkUrl, resolveSpeciesArtworkFiles} from "@/data/species-artwork-index";
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
            .filter((animal) => (
                !getSpeciesBySlug(animal.speciesSlug)
                && !DATABASE_BACKED_LOCATION_SPECIES.has(animal.speciesSlug)
            ))
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

function getReadingMinutes(paragraphs: string[], animalsCount: number) {
    const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length + animalsCount * 18;

    return Math.max(3, Math.ceil(words / 225));
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

export default async function LocationDetailPage({params}: LocationPageProps) {
    const {locale, slug} = params;
    const t = await getScopedTranslator(locale, "locations");
    const animalsT = await getScopedTranslator(locale, "animals");
    const rankingsT = await getScopedTranslator(locale, "rankings");
    const location = getLocationPage(slug);

    if (!location) {
        notFound();
    }
    const hasZooGuide = isPlaceCollectionIndexable(location.zoosAndParks);
    const hasReserveGuide = isPlaceCollectionIndexable(location.wildlifeReserves);
    const placeGuideLocationName = getPlaceGuideLocationName(location.slug, location.name);

    // Location rosters mix the local species file with the indexed catalog, so each
    // animal is resolved the same way the species page resolves it.
    const resolvedAnimals = await Promise.all(location.animalsToSpot.map(async (animal) => {
        const species = await getResolvedSpeciesBySlug(animal.speciesSlug) ?? getSpeciesBySlug(animal.speciesSlug);

        if (!species) {
            return null;
        }

        return {
            ...animal,
            species
        };
    }));

    if (resolvedAnimals.some((entry) => !entry)) {
        notFound();
    }

    const animals = resolvedAnimals.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const habitatMap = getLocationMap(location.slug);
    const locationCoordinate = getLocationCoordinate(location.slug);
    // Real pins only: a curated place appears when it has a resolved coordinate.
    const mapPlaces: WildlifeMapPlace[] = [
        ...(location.zoosAndParks ?? []),
        ...(location.wildlifeReserves ?? [])
    ].flatMap((place) => {
        const coordinate = place.coordinates ?? getPlaceCoordinate(location.slug, place.name);
        if (!coordinate) return [];
        return [{
            name: place.name,
            kind: place.type,
            lat: coordinate.lat,
            lng: coordinate.lng,
            animals: place.animalsToSpot.slice(0, 6)
        }];
    });
    const listArtworkFiles = await resolveSpeciesArtworkFiles(animals.map((animal) => animal.species.slug));
    const habitatMapSpecies = new Map<string, HabitatMapSpecies>();

    if (habitatMap) {
        const animalsBySlug = new Map(animals.map((animal) => [animal.species.slug, animal.species]));

        for (const speciesSlug of getLocationMapSpeciesSlugs(habitatMap)) {
            const entry = animalsBySlug.get(speciesSlug) ?? await getResolvedSpeciesBySlug(speciesSlug) ?? getSpeciesBySlug(speciesSlug);

            if (entry) {
                habitatMapSpecies.set(speciesSlug, {
                    slug: entry.slug,
                    name: entry.name,
                    tier: getSpeciesTier(entry),
                    artworkSrc: await getResolvedSpeciesArtworkUrl(entry.slug)
                });
            }
        }
    }
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
            title: getRankingTierListTitle(page),
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
    const readingMinutes = getReadingMinutes([
        location.quickAnswer,
        ...location.introduction,
        ...location.whyItMatters,
        ...location.bestFor,
        ...location.spottingTips,
        ...(location.faq || []).flatMap((item) => [item.question, item.answer])
    ], animals.length);
    const topAnimals = animals.slice(0, 3);

    return (
        <article className="mx-auto flex w-full max-w-[86rem] flex-col gap-8 overflow-hidden px-4 py-10 md:px-8 md:py-14">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schemas)}} />

            <LocationBreadcrumbs
                items={[
                    {href: "/locations", label: t("title")},
                    {label: t(`types.${location.regionType}`)},
                    {label: location.name}
                ]}
            />

            <LocationHero
                title={location.title}
                description={location.description}
                regionTypeLabel={t(`types.${location.regionType}`)}
                featuredImage={location.featuredImage}
                nameLabel={t("nameLabel")}
                nameValue={location.name}
                updatedLabel={t("updated")}
                updatedValue={formatDate(locale, location.updatedAt || location.publishedAt)}
                animalCountLabel={t("animalCountLabel")}
                animalCountValue={String(animals.length)}
                placeTypeLabel={t("readingTime")}
                placeTypeValue={t("readingTimeValue", {minutes: readingMinutes})}
            />

            <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.75fr)]" aria-labelledby="location-quick-answer">
                <div className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
                    <h2 id="location-quick-answer" className="font-display text-3xl font-bold text-white">{t("quickAnswerTitle")}</h2>
                    <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("quickAnswerDescription")}</p>
                    <p className="mt-4 text-lg leading-8 text-white">{location.quickAnswer}</p>
                    <div className="mt-5 grid gap-3">
                        {location.introduction.map((paragraph) => (
                            <p key={paragraph} className="text-base leading-7 text-ink-200">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                </div>
                <div className="rounded-lg border border-line-300 bg-surface-900/75 p-5">
                    <h3 className="font-display text-2xl font-bold text-white">{t("topAnimalsTitle")}</h3>
                    <div className="mt-4 grid gap-3">
                        {topAnimals.map((animal, index) => (
                            <Link
                                key={animal.species.slug}
                                href={`/animals/${animal.species.slug}`}
                                className="rounded-md border border-line-400 bg-canvas-900/40 p-3 transition-colors hover:border-primary-500/50 focus-visible:border-primary-500/50"
                            >
                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">0{index + 1}</span>
                                <span className="mt-1 block font-display text-xl font-bold text-white">{animal.species.name}</span>
                                <span className="mt-1 block text-sm leading-6 text-ink-300">{animal.rarityHint || animal.whyItFits}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {(hasZooGuide || hasReserveGuide) && (
                <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("exploreAnimalPlacesTitle", {location: placeGuideLocationName})}</h2>
                    <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("exploreAnimalPlacesDescription")}</p>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {hasZooGuide && (
                            <Link href={`/locations/${location.slug}/zoos`} className="rounded-lg border border-line-400 bg-canvas-900/40 p-5 transition hover:border-primary-500/50 hover:bg-surface-800">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">{t("zoosAndParks")}</p>
                                <h3 className="mt-2 break-words font-display text-2xl font-bold text-white">{t("zoosIn", {location: placeGuideLocationName})}</h3>
                                <p className="mt-2 text-sm leading-6 text-ink-200 md:text-base">{t("zoosLinkDescription")}</p>
                            </Link>
                        )}
                        {hasReserveGuide && (
                            <Link href={`/locations/${location.slug}/wildlife-reserves`} className="rounded-lg border border-line-400 bg-canvas-900/40 p-5 transition hover:border-primary-500/50 hover:bg-surface-800">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">{t("wildlifeReserves")}</p>
                                <h3 className="mt-2 break-words font-display text-2xl font-bold text-white">{t("reservesIn", {location: placeGuideLocationName})}</h3>
                                <p className="mt-2 text-sm leading-6 text-ink-200 md:text-base">{t("reservesLinkDescription")}</p>
                            </Link>
                        )}
                    </div>
                </section>
            )}

            <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
                <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("whyItMattersTitle")}</h2>
                <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("whyItMattersDescription")}</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {location.whyItMatters.map((paragraph) => (
                        <p key={paragraph} className="text-base leading-7 text-ink-200">
                            {paragraph}
                        </p>
                    ))}
                </div>
            </section>

            {habitatMap ? (
                <LocationHabitatMap
                    map={habitatMap}
                    species={habitatMapSpecies}
                    zoneLabel={t("habitatZoneLabel")}
                    speciesCountLabel={(count) => t("habitatZoneSpeciesCount", {count: String(count)})}
                />
            ) : null}

            {/* The habitat map answers "which part of the region"; this one pins the real
                places you can book, so both sections earn their space. */}
            {locationCoordinate ? (
                <section className="space-y-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{t("mapEyebrow")}</p>
                        <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
                            {t("mapTitle", {location: location.name})}
                        </h2>
                        <p className="mt-2 max-w-3xl text-base leading-7 text-ink-200">
                            {mapPlaces.length ? t("mapDescription") : t("mapDescriptionRegion")}
                        </p>
                    </div>
                    <LocationWildlifeMap
                        center={{lat: locationCoordinate.lat, lng: locationCoordinate.lng}}
                        zoom={locationCoordinate.zoom}
                        locationName={location.name}
                        places={mapPlaces}
                    />
                    <p className="text-xs text-ink-500">{t("mapFootnote")}</p>
                </section>
            ) : null}

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
                    rarityHint: animal.rarityHint,
                    tier: getSpeciesTier(animal.species),
                    artworkSrc: buildSpeciesArtworkSrc(animal.species.slug, listArtworkFiles.get(animal.species.slug))
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
                        <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("relatedBlogTitle")}</h2>
                        <p className="max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("relatedBlogDescription")}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedBlogPosts.map((post) => (
                            <article
                                key={post.slug}
                                className="flex flex-col gap-3 rounded-lg border border-line-300 bg-surface-900/75 p-5"
                            >
                                <h3 className="break-words font-display text-2xl font-bold leading-tight text-white">
                                    <Link href={`/blog/${post.slug}`} className="hover:text-primary-100 transition-colors">
                                        {post.title}
                                    </Link>
                                </h3>
                                <p className="text-sm leading-6 text-ink-200">{post.description}</p>
                                <Link
                                    href={`/blog/${post.slug}`}
                                    className="mt-auto w-fit text-sm font-semibold text-primary-200 hover:text-primary-100 transition-colors"
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
                <section className="rounded-lg border border-line-300 bg-surface-900/75 p-5 md:p-6">
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t("faqTitle")}</h2>
                    <p className="mt-3 max-w-4xl text-base leading-7 text-ink-300 md:text-lg">{t("faqDescription")}</p>
                    <div className="mt-5 grid gap-3">
                        {location.faq.map((item) => (
                            <div key={item.question} className="rounded-md border border-line-400 bg-canvas-900/40 p-4">
                                <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                                <p className="mt-2 text-base leading-7 text-ink-200">{item.answer}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <Link href="/locations" className="w-fit text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100 focus-visible:text-primary-100" underline>
                {t("back")}
            </Link>
        </article>
    );
}
