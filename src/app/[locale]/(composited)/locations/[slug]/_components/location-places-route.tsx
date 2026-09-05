import {Metadata} from "next";
import {notFound} from "next/navigation";
import {localeConfig} from "@/i18n";
import {getLocationPage} from "@/data/locations";
import {getPlaceGuideLocationName, getUniquePlaceSpeciesSlugs, isPlaceCollectionIndexable, WildlifePlace} from "@/data/location-places";
import {buildContentMetadata} from "@/lib/content-metadata";
import {getScopedTranslator} from "@/loaders/translation";
import LocationPlacesPage, {LocationPlacesKind, LocationPlacesLabels} from "./location-places-page";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {buildSpeciesArtworkSrc} from "@/data/species-artwork-index";
import {getSpeciesBySlug} from "@/data/species";
import {getSpeciesTier} from "@/lib/species-tier";

export type LocationPlacesRouteProps = {params: {locale: string; slug: string}};

function getPlaces(slug: string, kind: LocationPlacesKind): WildlifePlace[] {
    const location = getLocationPage(slug);
    if (!location) return [];
    return kind === "zoos" ? location.zoosAndParks || [] : location.wildlifeReserves || [];
}

export async function buildLocationPlacesMetadata({params}: LocationPlacesRouteProps, kind: LocationPlacesKind): Promise<Metadata> {
    const location = getLocationPage(params.slug);
    if (!location) return {};
    const places = getPlaces(params.slug, kind);
    const isZooPage = kind === "zoos";
    const guideLocationName = getPlaceGuideLocationName(location.slug, location.name);
    const title = isZooPage
        ? `Zoos in ${guideLocationName} | AnimalDex Wildlife Travel Guide`
        : `Wildlife Reserves in ${guideLocationName} | AnimalDex Location Guide`;
    const description = isZooPage
        ? `Explore zoos, wildlife parks, aquariums, safari parks, and animal places in ${guideLocationName}. Find animals to spot, related species guides, and AnimalDex capture ideas.`
        : `Explore wildlife reserves, national parks, wetlands, forests, and conservation areas in ${guideLocationName}. Discover animals to spot and related AnimalDex species guides.`;
    const indexable = params.locale === localeConfig.defaultLocale && isPlaceCollectionIndexable(places);

    const metadata = buildContentMetadata({
            locale: params.locale,
            pathname: `/locations/${location.slug}/${kind}`,
            title,
            description,
            keywords: [isZooPage ? `zoos in ${guideLocationName}` : `wildlife reserves in ${guideLocationName}`, ...places.map((entry) => entry.name)],
            featuredImage: location.featuredImage,
            publishedAt: location.publishedAt,
            updatedAt: location.updatedAt,
            tags: [location.name, kind]
        });

    return {
        ...metadata,
        title: {absolute: title},
        robots: {index: indexable, follow: true}
    };
}

export async function renderLocationPlacesPage({params}: LocationPlacesRouteProps, kind: LocationPlacesKind) {
    const location = getLocationPage(params.slug);
    if (!location) notFound();
    const places = getPlaces(params.slug, kind);
    // Place rosters mix the local species file with the indexed catalog, so tiers are
    // resolved the same way the species pages resolve them.
    const placeSpecies = (await Promise.all(
        getUniquePlaceSpeciesSlugs(places).map(async (speciesSlug) => (
            await getResolvedSpeciesBySlug(speciesSlug) ?? getSpeciesBySlug(speciesSlug)
        ))
    )).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const species = placeSpecies
        .map((entry) => ({
            slug: entry.slug,
            name: entry.name,
            scientificName: entry.analysis.scientificName,
            tier: getSpeciesTier(entry),
            artworkSrc: buildSpeciesArtworkSrc(entry.slug, null)
        }));
    const t = await getScopedTranslator(params.locale, "locationPlaces");
    const isZooPage = kind === "zoos";
    const values = {location: getPlaceGuideLocationName(location.slug, location.name)};
    const labels: LocationPlacesLabels = {
        locations: t("locations"),
        pageCrumb: t(isZooPage ? "zoosCrumb" : "reservesCrumb"),
        eyebrow: t(isZooPage ? "zoosEyebrow" : "reservesEyebrow"),
        title: t(isZooPage ? "zoosTitle" : "reservesTitle", values),
        subtitle: t(isZooPage ? "zoosSubtitle" : "reservesSubtitle", values),
        heroCopy: t(isZooPage ? "zoosHeroCopy" : "reservesHeroCopy", values),
        placesCount: t("placesCount"),
        animalsCount: t("animalsCount"),
        quickSummaryTitle: t("quickSummaryTitle"),
        quickSummary: t(isZooPage ? "zoosQuickSummary" : "reservesQuickSummary", {...values, count: places.length}),
        searchTitle: t("searchTitle"),
        searchDescription: t("searchDescription"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder", values),
        allTypes: t("allTypes"), allAnimals: t("allAnimals"), allBestFor: t("allBestFor"),
        resultCount: t("resultCount"), noResults: t("noResults"), reset: t("reset"),
        featuredPlacesTitle: t("featuredPlacesTitle"),
        bestFor: t("bestFor"), animalsPreview: t("animalsPreview"), relatedSpecies: t("relatedSpecies"), viewAnimals: t("viewAnimals"),
        animalsTitle: t("animalsTitle", values),
        animalsDescription: t("animalsDescription", values),
        readSpecies: t("readSpecies"), relatedSpeciesTitle: t("relatedSpeciesTitle"),
        tipsTitle: t(isZooPage ? "zooTipsTitle" : "reserveTipsTitle", values),
        tips: [1, 2, 3, 4, 5].map((index) => t(`${isZooPage ? "zooTips" : "reserveTips"}.${index}`)),
        backToLocation: t("backToLocation", values), browseLocations: t("browseLocations"), browseAnimals: t("browseAnimals"),
        emptyTitle: t("emptyTitle"), emptyDescription: t(isZooPage ? "emptyZoosDescription" : "emptyReservesDescription", values),
        ctaTitle: t("ctaTitle"), ctaDescription: t("ctaDescription"), getAnimalDex: t("getAnimalDex"),
        captiveNote: t("captiveNote"),
        typeLabels: {
            zoo: t("types.zoo"), aquarium: t("types.aquarium"), safari_park: t("types.safariPark"), wildlife_park: t("types.wildlifePark"),
            animal_sanctuary: t("types.animalSanctuary"), wildlife_reserve: t("types.wildlifeReserve"), national_park: t("types.nationalPark"),
            nature_reserve: t("types.natureReserve"), wetland: t("types.wetland"), forest: t("types.forest"), conservation_area: t("types.conservationArea"), birding_site: t("types.birdingSite")
        }
    };

    return <LocationPlacesPage locale={params.locale} location={location} places={places} kind={kind} labels={labels} species={species} />;
}
