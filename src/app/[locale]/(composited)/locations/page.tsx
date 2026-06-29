import {getLocale, getTranslations} from "next-intl/server";
import {Metadata} from "next";
import LocationsHubClient, {
    LocationHubItem,
    LocationPlaceGuideLink,
    LocationHubRegion,
    LocationHubType
} from "@/app/[locale]/(composited)/locations/locations-hub-client";
import {locationPages} from "@/data/locations";
import {getPlaceGuideLocationName, isPlaceCollectionIndexable} from "@/data/location-places";
import {getSpeciesBySlug, speciesEntries} from "@/data/species";
import {loadLocaleMessages} from "@/loaders/locale";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

const locationRegions: Record<string, LocationHubRegion> = {
    indonesia: "asia", bali: "asia", jakarta: "asia", "west-java": "asia", "komodo-national-park": "asia", "ujung-kulon": "asia", borneo: "asia",
    "singapore-zoo": "asia", china: "asia", india: "asia", japan: "asia", thailand: "asia", "sri-lanka": "asia", singapore: "asia",
    afghanistan: "asia", israel: "asia", dubai: "asia", pakistan: "asia",
    "london-zoo": "europe", germany: "europe", norway: "europe", "united-kingdom": "europe", spain: "europe", iceland: "europe", russia: "europe",
    "african-safari": "africa", kenya: "africa", madagascar: "africa", "south-africa": "africa", tanzania: "africa",
    canada: "north-america", "united-states": "north-america", mexico: "north-america", "costa-rica": "north-america", jamaica: "north-america",
    brazil: "south-america", peru: "south-america", ecuador: "south-america", colombia: "south-america",
    australia: "oceania"
};

function inferLocationTypes(page: typeof locationPages[number]): LocationHubType[] {
    const content = [page.slug, page.name, page.regionType, page.description, page.quickAnswer, ...page.bestFor, ...page.spottingTips].join(" ").toLowerCase();
    const inferred = new Set<LocationHubType>();

    if (page.regionType === "zoo" || /\bzoo\b/.test(content)) inferred.add("zoo");
    if (page.regionType === "park" || /national park|protected park|reserve/.test(content)) inferred.add("park");
    if (/wetland|mangrove|marsh|river|waterway/.test(content)) inferred.add("wetland");
    if (/forest|rainforest|woodland|jungle|canopy/.test(content)) inferred.add("forest");
    if (/beach|coast|coastal|reef|marine|shore|snorkel/.test(content)) inferred.add("beach");
    if (page.regionType === "island" || /island/.test(content)) inferred.add("island");
    if (page.regionType === "city" || /city|urban/.test(content)) inferred.add("city");
    if (page.regionType === "safari" || /safari|savannah|big five/.test(content)) inferred.add("safari");
    if (/backyard|garden|everyday wildlife|neighborhood/.test(content) || page.regionType === "city") inferred.add("backyard");
    if (/farm|farmland|rice field|agricultur/.test(content)) inferred.add("farm");

    if (inferred.size === 0) inferred.add(page.regionType === "country" ? "forest" : "park");
    return Array.from(inferred);
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const messages = await loadLocaleMessages(locale);
    const baseKeywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];
    const locationKeywords = Array.from(new Set(locationPages.flatMap((page) => page.searchIntents)));
    const title = messages.locations?.metaTitle || "Wildlife Location Guides | AnimalDex";
    const description = messages.locations?.metaDescription || "Explore AnimalDex wildlife location guides for zoos, parks, forests, wetlands, beaches, islands, cities, and safari regions.";

    return {
        title,
        description,
        keywords: [...baseKeywords, ...locationKeywords],
        alternates: {
            canonical: getLocalePath(locale, "/locations"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = getLocalePath(localeItem, "/locations");
                return acc;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, "/locations")} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title,
            description,
            url: getLocalePath(locale, "/locations"),
            images: [{url: "/images/placeholders/more-discovery.svg", width: 1200, height: 675, alt: title}]
        },
        twitter: {card: "summary_large_image", title, description, images: ["/images/placeholders/more-discovery.svg"]}
    };
}

export default async function LocationsIndexPage() {
    const t = await getTranslations("locations");
    const locale = await getLocale();
    const pageUrl = getAbsoluteUrl(locale, "/locations");
    const safeText = (key: string, fallback: string, values?: Record<string, string | number>) => {
        try {
            const translated = t(key, values);
            return !translated || translated === key || translated.endsWith(`.${key}`) ? fallback : translated;
        } catch {
            return fallback;
        }
    };
    const items: LocationHubItem[] = locationPages.map((page) => ({
        slug: page.slug,
        name: page.name,
        title: page.title,
        description: page.description,
        image: page.featuredImage,
        region: locationRegions[page.slug] ?? "asia",
        types: inferLocationTypes(page),
        animalNames: page.animalsToSpot
            .slice(0, 3)
            .map((animal) => getSpeciesBySlug(animal.speciesSlug)?.name)
            .filter((name): name is string => Boolean(name)),
        placeGuides: {
            zoos: isPlaceCollectionIndexable(page.zoosAndParks),
            reserves: isPlaceCollectionIndexable(page.wildlifeReserves)
        },
        placeGuideTitles: {
            zoos: isPlaceCollectionIndexable(page.zoosAndParks)
                ? safeText("zoosIn", `Zoos in ${getPlaceGuideLocationName(page.slug, page.name)}`, {location: getPlaceGuideLocationName(page.slug, page.name)})
                : undefined,
            reserves: isPlaceCollectionIndexable(page.wildlifeReserves)
                ? safeText("reservesIn", `Wildlife reserves in ${getPlaceGuideLocationName(page.slug, page.name)}`, {location: getPlaceGuideLocationName(page.slug, page.name)})
                : undefined
        }
    }));
    const placeGuideLinks: LocationPlaceGuideLink[] = locationPages.flatMap((page) => {
        const region = locationRegions[page.slug] ?? "asia";
        const locationName = getPlaceGuideLocationName(page.slug, page.name);

        return ([
            {kind: "zoos" as const, places: page.zoosAndParks || []},
            {kind: "wildlife-reserves" as const, places: page.wildlifeReserves || []}
        ]).flatMap(({kind, places}) => {
            if (!isPlaceCollectionIndexable(places)) return [];
            const relatedSpeciesNames = Array.from(new Set(places.flatMap((place) => place.relatedSpeciesSlugs)
                .map((slug) => getSpeciesBySlug(slug)?.name)
                .filter((name): name is string => Boolean(name))));
            const associatedAnimals = Array.from(new Set(places.flatMap((place) => place.animalsToSpot)));
            const animalsPreview = relatedSpeciesNames.length ? relatedSpeciesNames.slice(0, 4) : associatedAnimals.slice(0, 4);
            const isZooGuide = kind === "zoos";
            const title = isZooGuide
                ? safeText("zoosIn", `Zoos in ${locationName}`, {location: locationName})
                : safeText("reservesIn", `Wildlife reserves in ${locationName}`, {location: locationName});
            const description = isZooGuide
                ? safeText("zooGuideDescription", `Explore animal parks, zoos, and wildlife experiences connected to ${locationName} species guides.`, {location: locationName})
                : safeText("reserveGuideDescription", `Find protected habitats, forests, wetlands, and wild places linked to animals you may spot around ${locationName}.`, {location: locationName});

            return [{
                href: `/locations/${page.slug}/${kind}`,
                kind,
                title,
                region,
                locationName,
                description,
                placeCount: places.length,
                animalCount: relatedSpeciesNames.length || associatedAnimals.length,
                animalsPreview,
                image: page.featuredImage.src,
                country: places[0]?.country,
                searchTerms: [
                    page.title, page.description, page.name, locationName, region,
                    ...places.flatMap((place) => [place.name, place.type, place.region, place.country || "", ...place.bestFor, ...place.animalsToSpot]),
                    ...relatedSpeciesNames
                ]
            }];
        });
    });

    const collectionSchema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("heroTitle"),
        description: t("heroDescription"),
        url: pageUrl,
        inLanguage: locale
    };
    const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: locationPages.map((page, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: getAbsoluteUrl(locale, `/locations/${page.slug}`),
            name: page.name
        }))
    };

    return (
        <main className="w-full max-w-[88rem] mx-auto px-4 py-10 md:px-8 md:py-16">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify([collectionSchema, itemListSchema])}} />
            <LocationsHubClient
                items={items}
                placeGuideLinks={placeGuideLinks}
                animalProfileCount={speciesEntries.length}
                labels={{
                    eyebrow: t("eyebrow"),
                    heroTitle: t("heroTitle"),
                    heroDescription: t("heroDescription"),
                    heroTrust: t("heroTrust"),
                    exploreMap: t("exploreMap"),
                    browseLocations: t("browseLocations"),
                    locationGuidesStat: t("locationGuidesStat"),
                    animalProfilesStat: t("animalProfilesStat"),
                    spottingIdeasStat: t("spottingIdeasStat"),
                    mapTitle: t("mapTitle"),
                    mapDescription: t("mapDescription"),
                    chooseRegion: t("chooseRegion"),
                    chooseRegionDescription: t("chooseRegionDescription"),
                    locationGuidesCount: t("locationGuidesCount"),
                    popularAnimals: t("popularAnimals"),
                    viewRegionGuides: t("viewRegionGuides"),
                    featuredTitle: t("featuredTitle"),
                    featuredDescription: t("featuredDescription"),
                    browseTypeTitle: t("browseTypeTitle"),
                    browseTypeDescription: t("browseTypeDescription"),
                    allTitle: t("allTitle"),
                    allDescription: t("allDescription"),
                    searchPlaceholder: t("searchPlaceholder"),
                    animalsToSpot: t("animalsToSpotTitle"),
                    openGuide: t("openGuide"),
                    noGuidesTitle: t("noGuidesTitle"),
                    noGuidesDescription: t("noGuidesDescription"),
                    showAll: t("showAll"),
                    ctaTitle: t("hubCtaTitle"),
                    ctaDescription: t("hubCtaDescription"),
                    browseAnimals: t("browseAnimals"),
                    relatedTitle: t("relatedExplorationTitle"),
                    relatedDescription: t("relatedExplorationDescription"),
                    animalWisdom: t("animalWisdom"),
                    animalStories: t("animalStories"),
                    animalEncyclopedia: t("animalEncyclopedia"),
                    allRegions: t("allRegions"),
                    regions: {
                        africa: t("regions.africa"), asia: t("regions.asia"), europe: t("regions.europe"),
                        "north-america": t("regions.northAmerica"), "south-america": t("regions.southAmerica"), oceania: t("regions.oceania")
                    },
                    types: {
                        zoo: t("hubTypes.zoo"), park: t("hubTypes.park"), wetland: t("hubTypes.wetland"), forest: t("hubTypes.forest"),
                        beach: t("hubTypes.beach"), island: t("hubTypes.island"), city: t("hubTypes.city"), safari: t("hubTypes.safari"),
                        backyard: t("hubTypes.backyard"), farm: t("hubTypes.farm")
                    },
                    findPlacesTitle: safeText("findPlacesTitle", "Find zoos and wildlife reserves"),
                    findPlacesDescription: safeText("findPlacesDescription", "Search curated AnimalDex place guides by location, region, habitat, or animals to spot."),
                    findPlacesPlaceholder: safeText("findPlacesPlaceholder", "Search Bali, London, Singapore, orangutans, wetlands..."),
                    allPlaceGuides: safeText("allPlaceGuides", "All"),
                    zoosAndParks: safeText("zoosAndParks", "Zoos & parks"),
                    wildlifeReserves: safeText("wildlifeReserves", "Wildlife reserves"),
                    findPlacesBenefits: [
                        safeText("findPlacesBenefits.plan", "Plan animal-focused days out"),
                        safeText("findPlacesBenefits.species", "Discover species linked to each place"),
                        safeText("findPlacesBenefits.capture", "Turn trips into AnimalDex captures")
                    ],
                    guidesFound: safeText("guidesFound", "guides found"),
                    placesStat: safeText("placesStat", "places"),
                    animalsStat: safeText("animalsStat", "animals"),
                    showMoreGuides: safeText("showMoreGuides", "Show more guides"),
                    viewAllGuides: safeText("viewAllGuides", "View all animal place guides"),
                    noPlaceGuidesTitle: safeText("noPlaceGuidesTitle", "No animal place guides found"),
                    noPlaceGuidesBody: safeText("noPlaceGuidesBody", "Try another location, region, or animal name."),
                    showAllGuides: safeText("showAllGuides", "Show all guides")
                }}
            />
        </main>
    );
}
