import "server-only";

import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * Web clients for the two edge functions behind the app's Locations tab:
 * `nearby-wildlife-guide` (what lives around a point) and
 * `animal-location-lookup` (nearest credible place to find one animal).
 * Both are called with the service role so public visitors need no account.
 */

export type NearbyBandKey = "0_5m" | "5_20m" | "20_50m" | "uncommon";

export type NearbyAnimal = {
    commonName: string;
    scientificName: string | null;
    notes: string | null;
    likelihood: string;
    bandKey: NearbyBandKey;
    bandLabel: string;
    displayName: string | null;
    normalizedIdentityKey: string | null;
    animalDexNumber: number | null;
    battleTier: string | null;
    lookPlaceName: string | null;
    latitude: number | null;
    longitude: number | null;
};

export type NearbyVenue = {
    name: string;
    kind: string;
    notes: string | null;
    approxDistanceLabel: string | null;
    googleMapsUri: string | null;
    googlePhotoUri: string | null;
    websiteUri: string | null;
    latitude: number | null;
    longitude: number | null;
    notableAnimals: string[];
    openNow: boolean | null;
};

export type NearbyGuide = {
    placeSummary: string;
    placeLabel: string | null;
    animals: NearbyAnimal[];
    venues: NearbyVenue[];
    cached: boolean;
};

export type AnimalLocationResult = {
    animalName: string;
    scientificName: string | null;
    placeName: string;
    latitude: number;
    longitude: number;
    likelihood: string;
    distanceScope: string;
    reason: string;
    safetyNote: string | null;
    cached: boolean;
};

const BAND_KEYS: NearbyBandKey[] = ["0_5m", "5_20m", "20_50m", "uncommon"];

function getConfig() {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) return null;
    return {supabaseUrl, serviceKey};
}

async function callFunction(name: string, body: Record<string, unknown>, timeoutMs: number) {
    const config = getConfig();
    if (!config) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${config.supabaseUrl}/functions/v1/${name}`, {
            method: "POST",
            headers: {
                ...getSupabaseHeaders(config.serviceKey),
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: controller.signal
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function asText(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBandKey(value: unknown): NearbyBandKey {
    const raw = String(value ?? "");
    return (BAND_KEYS as string[]).includes(raw) ? (raw as NearbyBandKey) : "uncommon";
}

export async function fetchNearbyGuide(params: {
    latitude: number;
    longitude: number;
    placeLabel?: string | null;
    countryCode?: string | null;
    locale?: string;
}): Promise<NearbyGuide | null> {
    const payload = await callFunction(
        "nearby-wildlife-guide",
        {
            latitude: params.latitude,
            longitude: params.longitude,
            place_label: params.placeLabel ?? null,
            country_code: params.countryCode ?? null,
            locale: params.locale ?? "en",
            force_refresh: false
        },
        90_000
    );

    if (!payload || typeof payload !== "object") return null;
    const raw = payload as Record<string, unknown>;

    const animals = Array.isArray(raw.animals) ? raw.animals : [];
    const venues = Array.isArray(raw.venues) ? raw.venues : [];

    return {
        placeSummary: asText(raw.place_summary) ?? "",
        placeLabel: asText(raw.place_label),
        cached: raw.cached === true,
        animals: animals.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            const commonName = asText(row.common_name);
            if (!commonName) return [];
            return [{
                commonName,
                scientificName: asText(row.scientific_name),
                notes: asText(row.notes),
                likelihood: asText(row.likelihood) ?? "possible",
                bandKey: asBandKey(row.band_key),
                bandLabel: asText(row.band_label) ?? "",
                displayName: asText(row.display_name),
                normalizedIdentityKey: asText(row.normalized_identity_key),
                animalDexNumber: asNumber(row.animaldex_number),
                battleTier: asText(row.battle_tier),
                lookPlaceName: asText(row.look_place_name),
                latitude: asNumber(row.absolute_latitude),
                longitude: asNumber(row.absolute_longitude)
            }];
        }),
        venues: venues.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            const name = asText(row.name);
            if (!name) return [];
            const hours = row.opening_hours as Record<string, unknown> | null | undefined;
            return [{
                name,
                kind: asText(row.kind) ?? "place",
                notes: asText(row.notes),
                approxDistanceLabel: asText(row.approx_distance_label),
                googleMapsUri: asText(row.google_maps_uri),
                googlePhotoUri: asText(row.google_photo_uri),
                websiteUri: asText(row.website_uri),
                latitude: asNumber(row.latitude),
                longitude: asNumber(row.longitude),
                notableAnimals: Array.isArray(row.notable_animals)
                    ? row.notable_animals.map((value) => String(value)).filter(Boolean)
                    : [],
                openNow: typeof hours?.open_now === "boolean" ? (hours.open_now as boolean) : null
            }];
        })
    };
}

export async function lookupAnimalLocation(params: {
    latitude: number;
    longitude: number;
    animalName: string;
    scientificName?: string | null;
    identityKey?: string | null;
    placeLabel?: string | null;
    locale?: string;
}): Promise<AnimalLocationResult | null> {
    const payload = await callFunction(
        "animal-location-lookup",
        {
            latitude: params.latitude,
            longitude: params.longitude,
            animal_name: params.animalName,
            scientific_name: params.scientificName ?? null,
            identity_key: params.identityKey ?? null,
            place_label: params.placeLabel ?? null,
            locale: params.locale ?? "en",
            force_refresh: false
        },
        90_000
    );

    if (!payload || typeof payload !== "object") return null;
    const raw = payload as Record<string, unknown>;

    const latitude = asNumber(raw.latitude);
    const longitude = asNumber(raw.longitude);
    const placeName = asText(raw.place_name);
    if (latitude == null || longitude == null || !placeName) return null;

    return {
        animalName: asText(raw.animal_name) ?? params.animalName,
        scientificName: asText(raw.scientific_name),
        placeName,
        latitude,
        longitude,
        likelihood: asText(raw.likelihood) ?? "moderate",
        distanceScope: asText(raw.distance_scope) ?? "regional",
        reason: asText(raw.reason) ?? "",
        safetyNote: asText(raw.safety_note),
        cached: raw.cached === true
    };
}

/** Great-circle distance in kilometres, for the "how far" readout. */
export function haversineKm(
    origin: {latitude: number; longitude: number},
    destination: {latitude: number; longitude: number}
) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(destination.latitude - origin.latitude);
    const dLon = toRad(destination.longitude - origin.longitude);
    const lat1 = toRad(origin.latitude);
    const lat2 = toRad(destination.latitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return earthRadiusKm * 2 * Math.asin(Math.sqrt(a));
}

export function compassBearing(
    origin: {latitude: number; longitude: number},
    destination: {latitude: number; longitude: number}
) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = toRad(origin.latitude);
    const lat2 = toRad(destination.latitude);
    const dLon = toRad(destination.longitude - origin.longitude);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const degrees = (Math.atan2(y, x) * 180) / Math.PI;
    const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return points[Math.round(((degrees + 360) % 360) / 45) % 8];
}
