import type {CanonicalContentMetadata} from "@/data/content-schema";
import type {WildlifePlace} from "@/data/location-places";

export type LocationRegionType =
    | "country"
    | "city"
    | "island"
    | "park"
    | "zoo"
    | "region"
    | "safari";

export type LocationHubRegion = "africa" | "asia" | "europe" | "north-america" | "south-america" | "oceania";

export type LocationAnimalSpot = {
    speciesSlug: string;
    whyItFits: string;
    rarityHint?: string;
};

export type LocationFAQ = {
    question: string;
    answer: string;
};

export type LocationGeoBox = {north: number; south: number; east: number; west: number};

/**
 * Which public captures count as "found here". A country page matches on the
 * capture's country code; a sub-national page matches coordinates inside its
 * box. A page may use both (an island group that is its own country).
 */
export type LocationCaptureArea = {
    countryCodes?: string[];
    bbox?: LocationGeoBox;
    /** Boxes carved out of `bbox`, e.g. a capital that has its own page. */
    excludeBboxes?: LocationGeoBox[];
    /**
     * Countries whose captures may match inside `bbox`. Defaults to the page's
     * own country, so a box drawn loosely over a border does not claim the
     * neighbour's sightings; regions that really span borders list them.
     */
    bboxCountryCodes?: string[];
};

export type LocationPage = CanonicalContentMetadata & {
    slug: string;
    name: string;
    regionType: LocationRegionType;
    searchIntents: string[];
    quickAnswer: string;
    introduction: string[];
    whyItMatters: string[];
    animalsToSpot: LocationAnimalSpot[];
    bestFor: string[];
    spottingTips: string[];
    challengeSlugs?: string[];
    rankingSlugs?: string[];
    relatedLocationSlugs?: string[];
    blogSlugs?: string[];
    faq?: LocationFAQ[];
    zoosAndParks?: WildlifePlace[];
    wildlifeReserves?: WildlifePlace[];
    /** Continent bucket for the /locations hub filters. */
    hubRegion?: LocationHubRegion;
    /** ISO 3166-1 alpha-2 of the country the place sits in. */
    countryCode?: string;
    /** The location page this one sits inside (a province's country, a park's island). */
    parentSlug?: string;
    /** Real map centre and a Leaflet zoom that frames the place. */
    coordinate?: {lat: number; lng: number; zoom: number};
    captureArea?: LocationCaptureArea;
};

export type LocationPageInput = Omit<LocationPage, "publishedAt" | "updatedAt" | "featuredImage"> & {
    featuredImage?: LocationPage["featuredImage"];
    publishedAt?: string;
    updatedAt?: string;
};
