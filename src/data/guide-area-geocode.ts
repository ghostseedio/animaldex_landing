import "server-only";
import {getSiteUrl} from "@/lib/site";
import {guideAreaServedName, type PublicGuideListing} from "@/lib/guide-marketplace-core";

export type GuideAreaLocation = {
    /** The area name that was looked up, not Nominatim's verbose display name. */
    label: string;
    latitude: number;
    longitude: number;
    /** Radius in metres covering the matched area, for the approximate-area circle. */
    radiusMeters: number;
};

/** A listed area is a locality or district, so anything tighter than this is noise. */
const MIN_RADIUS_METERS = 1200;
const MAX_RADIUS_METERS = 30000;
const FALLBACK_RADIUS_METERS = 4000;

function radiusFromBoundingBox(box: unknown) {
    if (!Array.isArray(box) || box.length < 4) return FALLBACK_RADIUS_METERS;
    const [south, north, west, east] = box.map(Number);
    if (![south, north, west, east].every(Number.isFinite)) return FALLBACK_RADIUS_METERS;

    // Half the diagonal of the matched box, in metres. Longitude degrees shrink
    // with latitude, so scale them by cos(lat) rather than treating a degree as
    // a fixed distance everywhere.
    const midLatitude = ((south + north) / 2) * (Math.PI / 180);
    const northSouth = Math.abs(north - south) * 111_320;
    const eastWest = Math.abs(east - west) * 111_320 * Math.cos(midLatitude);
    const radius = Math.sqrt(northSouth ** 2 + eastWest ** 2) / 2;

    if (!Number.isFinite(radius) || radius <= 0) return FALLBACK_RADIUS_METERS;
    return Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, Math.round(radius)));
}

/**
 * Where to centre the map for a published listing.
 *
 * Guide listings carry no coordinates by design — the seller picks a structured
 * public area and the exact meeting point stays private until a request is
 * accepted. So this geocodes the public area name and returns a radius, and the
 * map draws a circle rather than a pin: showing a point would claim a precision
 * the data does not have and the marketplace rules explicitly disclaim.
 *
 * Uses OpenStreetMap Nominatim, whose policy requires an identifying User-Agent
 * and discourages heavy traffic — cached for a day, and a failure returns null
 * so the page simply renders without a map.
 */
export async function getGuideAreaLocation(listing: PublicGuideListing): Promise<GuideAreaLocation | null> {
    const label = guideAreaServedName(listing).trim();
    if (!label) return null;

    const query = [label, listing.country_code].filter(Boolean).join(", ");
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    try {
        const response = await fetch(url, {
            headers: {"User-Agent": `AnimalDex/1.0 (${getSiteUrl()})`, Accept: "application/json"},
            next: {revalidate: 86400}
        });
        if (!response.ok) return null;

        const rows = await response.json();
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return null;

        const latitude = Number(row.lat);
        const longitude = Number(row.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        return {label, latitude, longitude, radiusMeters: radiusFromBoundingBox(row.boundingbox)};
    } catch {
        return null;
    }
}
