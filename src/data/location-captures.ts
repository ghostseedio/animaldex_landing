import snapshot from "@/data/published-location-captures.json";

export type LocationCaptureSetting = "wild" | "zoo" | "farm" | "unknown";

export type LocationFeaturedCapture = {
    captureId: string;
    speciesSlug: string;
    animalName: string;
    capturedAt: string;
    setting: LocationCaptureSetting;
    /** Region and country only; the exact spot is never published. */
    area: string;
    collectorName: string;
    collectorHandle: string | null;
    /** Rounded to two decimals, about a kilometre. */
    lat: number;
    lng: number;
};

export type LocationCaptureProof = {
    captureCount: number;
    speciesCount: number;
    collectorCount: number;
    wildCount: number;
    zooCount: number;
    latestCapturedAt: string;
    species: Array<{slug: string; name: string; count: number}>;
    featured: LocationFeaturedCapture[];
};

type Snapshot = {generatedAt: string; locations: Record<string, LocationCaptureProof>};

const locations = (snapshot as unknown as Snapshot).locations;

/**
 * Public captures logged inside a location page's area, snapshotted at build
 * time by `scripts/refreshLocationCaptures.mts`. Null when nobody has logged
 * an animal there yet, so the page simply leaves the section out.
 */
export function getLocationCaptureProof(slug: string): LocationCaptureProof | null {
    const entry = locations[slug];
    return entry && entry.captureCount > 0 ? entry : null;
}

export function getLocationCaptureProofSlugs() {
    return Object.keys(locations);
}
