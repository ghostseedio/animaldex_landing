import {getLocationCoordinate} from "@/data/location-coordinates";
import {getLocationPage, locationPages} from "@/data/locations";
import type {LocationGeoBox, LocationPage} from "@/data/location-types";
import type {GuideCard} from "@/lib/virtual-wildlife-guides";

/**
 * Which virtual guides belong on a location page. Countries match on the
 * guide's country code; everything else (islands, parks, cities, regions)
 * matches guides whose public point is near the place's centre, within a
 * radius taken from its capture box or map zoom.
 */
export type GuideLocationQuery =
    | {kind: "country"; countryCode: string}
    | {kind: "near"; lat: number; lng: number; radiusM: number};

const MIN_RADIUS_M = 5_000;
const MAX_RADIUS_M = 500_000;
const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function clampRadius(value: number) {
    return Math.round(Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, value)));
}

function radiusFromBox(box: LocationGeoBox, lat: number, lng: number) {
    const corners: [number, number][] = [[box.north, box.east], [box.north, box.west], [box.south, box.east], [box.south, box.west]];
    return Math.max(...corners.map(([cornerLat, cornerLng]) => distanceMeters(lat, lng, cornerLat, cornerLng)));
}

function pageCountryCode(page: LocationPage) {
    if (page.countryCode) return page.countryCode.toUpperCase();
    const codes = page.captureArea?.countryCodes ?? [];
    return codes.length === 1 ? codes[0].toUpperCase() : null;
}

export function guideQueryForLocationPage(page: LocationPage): GuideLocationQuery | null {
    const countryCode = pageCountryCode(page);
    if (page.regionType === "country" && countryCode) return {kind: "country", countryCode};
    const coordinate = page.coordinate ?? getLocationCoordinate(page.slug);
    if (coordinate && Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng)) {
        const box = page.captureArea?.bbox;
        const radius = box
            ? radiusFromBox(box, coordinate.lat, coordinate.lng)
            : typeof coordinate.zoom === "number" ? 40_075_000 / 2 ** coordinate.zoom : 50_000;
        return {kind: "near", lat: coordinate.lat, lng: coordinate.lng, radiusM: clampRadius(radius)};
    }
    return countryCode ? {kind: "country", countryCode} : null;
}

export function getGuideLocation(slug: string) {
    const page = getLocationPage(slug);
    if (!page) return null;
    const query = guideQueryForLocationPage(page);
    return query ? {page, query} : null;
}

/** The same rule the RPC applies, run over an already-fetched list (index page, sitemap). */
export function guideMatchesLocation(guide: Pick<GuideCard, "countryCode" | "latitude" | "longitude">, query: GuideLocationQuery) {
    if (query.kind === "country") return (guide.countryCode ?? "").toUpperCase() === query.countryCode;
    if (typeof guide.latitude !== "number" || typeof guide.longitude !== "number") return false;
    return distanceMeters(query.lat, query.lng, guide.latitude, guide.longitude) <= query.radiusM;
}

/** Location pages with at least `min` of the given guides, most guides first. */
export function locationsWithGuides(guides: GuideCard[], min: number) {
    if (guides.length < min) return [];
    return locationPages
        .map((page) => {
            const query = guideQueryForLocationPage(page);
            const count = query ? guides.filter((guide) => guideMatchesLocation(guide, query)).length : 0;
            return {slug: page.slug, name: page.name, count};
        })
        .filter((row) => row.count >= min)
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}
