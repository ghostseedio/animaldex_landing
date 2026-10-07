import {normalizeSlug, type PublicGuideListing} from "./guide-marketplace-core";

/**
 * Which published Guide listings belong on a `/locations/<slug>` field-guide page.
 *
 * Matching is deliberately conservative and explicit: a listing matches only when
 * its ISO `country_code` equals the rule's country AND (for sub-national rules) one
 * of its structured area fields equals a listed area name exactly (after slug
 * normalization). No substring, distance, or title matching — the seller title is
 * marketing copy and never geography (see `guideAreaServedName`). A location with
 * no rule (zoos, the African safari overview) never shows a listing; its page says
 * that no AnimalDex Guide lists it yet, which stays true.
 */
export type GuideLocationMatchRule = {
    countryCode: string;
    /** Omit for a whole-country page. Otherwise exact administrative/place names. */
    areaNames?: string[];
};

const JAKARTA_CITIES = [
    "Jakarta",
    "DKI Jakarta",
    "Daerah Khusus Ibukota Jakarta",
    "Special Capital Region of Jakarta",
    "Central Jakarta",
    "North Jakarta",
    "South Jakarta",
    "East Jakarta",
    "West Jakarta",
    "Jakarta Pusat",
    "Jakarta Utara",
    "Jakarta Selatan",
    "Jakarta Timur",
    "Jakarta Barat"
];

export const LOCATION_GUIDE_MATCH_RULES: Record<string, GuideLocationMatchRule[]> = {
    indonesia: [{countryCode: "ID"}],
    bali: [{countryCode: "ID", areaNames: ["Bali"]}],
    jakarta: [{countryCode: "ID", areaNames: JAKARTA_CITIES}],
    "west-java": [{countryCode: "ID", areaNames: ["West Java", "Jawa Barat"]}],
    "komodo-national-park": [{countryCode: "ID", areaNames: ["Komodo National Park", "Taman Nasional Komodo"]}],
    "ujung-kulon": [{countryCode: "ID", areaNames: ["Ujung Kulon", "Ujung Kulon National Park", "Taman Nasional Ujung Kulon"]}],
    borneo: [
        {countryCode: "ID", areaNames: ["Kalimantan", "West Kalimantan", "Central Kalimantan", "South Kalimantan", "East Kalimantan", "North Kalimantan", "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara"]},
        {countryCode: "MY", areaNames: ["Sabah", "Sarawak", "Labuan"]},
        {countryCode: "BN"}
    ],
    china: [{countryCode: "CN"}],
    germany: [{countryCode: "DE"}],
    india: [{countryCode: "IN"}],
    japan: [{countryCode: "JP"}],
    australia: [{countryCode: "AU"}],
    brazil: [{countryCode: "BR"}],
    canada: [{countryCode: "CA"}],
    "united-states": [{countryCode: "US"}],
    thailand: [{countryCode: "TH"}],
    mexico: [{countryCode: "MX"}],
    peru: [{countryCode: "PE"}],
    kenya: [{countryCode: "KE"}],
    madagascar: [{countryCode: "MG"}],
    "sri-lanka": [{countryCode: "LK"}],
    ecuador: [{countryCode: "EC"}],
    "costa-rica": [{countryCode: "CR"}],
    norway: [{countryCode: "NO"}],
    "south-africa": [{countryCode: "ZA"}],
    singapore: [{countryCode: "SG"}],
    tanzania: [{countryCode: "TZ"}],
    "united-kingdom": [{countryCode: "GB"}],
    spain: [{countryCode: "ES"}],
    jamaica: [{countryCode: "JM"}],
    afghanistan: [{countryCode: "AF"}],
    israel: [{countryCode: "IL"}],
    colombia: [{countryCode: "CO"}],
    iceland: [{countryCode: "IS"}],
    dubai: [{countryCode: "AE", areaNames: ["Dubai"]}],
    russia: [{countryCode: "RU"}],
    pakistan: [{countryCode: "PK"}]
};

type MatchableListing = Pick<
    PublicGuideListing,
    "country_code" | "region_code" | "public_area_label" | "public_locality" | "public_admin_area" | "public_place_name"
>;

/** The structured area names a listing declares, normalized. Never the title. */
export function listingAreaKeys(listing: MatchableListing) {
    const values = [
        listing.public_locality,
        listing.public_admin_area,
        listing.public_place_name,
        listing.region_code,
        ...(listing.public_area_label || "").split(",")
    ];
    return new Set(values.map((value) => normalizeSlug(value || "")).filter(Boolean));
}

export function listingMatchesRule(listing: MatchableListing, rule: GuideLocationMatchRule) {
    if ((listing.country_code || "").trim().toUpperCase() !== rule.countryCode) return false;
    if (!rule.areaNames) return true;
    const keys = listingAreaKeys(listing);
    return rule.areaNames.some((name) => keys.has(normalizeSlug(name)));
}

export function matchGuideListingsToLocation<T extends MatchableListing>(listings: T[], locationSlug: string) {
    const rules = LOCATION_GUIDE_MATCH_RULES[locationSlug];
    if (!rules) return [] as T[];
    return listings.filter((listing) => rules.some((rule) => listingMatchesRule(listing, rule)));
}

/** `/locations/<slug>` pages whose rules match a listing — for linking from the Guide hub. */
export function locationSlugsForListing(listing: MatchableListing) {
    return Object.keys(LOCATION_GUIDE_MATCH_RULES).filter((slug) =>
        LOCATION_GUIDE_MATCH_RULES[slug].some((rule) => listingMatchesRule(listing, rule))
    );
}
