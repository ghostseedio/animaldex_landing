import type {LocationCaptureArea} from "@/data/location-types";

/**
 * Capture-matching areas for the hand-written location pages in
 * `src/data/locations.ts`. Pages in `src/data/locations/*` carry their own
 * `captureArea`; this map exists so the original forty did not have to be
 * edited one by one. `scripts/refreshLocationCaptures.mts` reads both.
 */
export const legacyLocationCaptureAreas: Record<string, LocationCaptureArea> = {
    "indonesia": {countryCodes: ["ID"]},
    "bali": {bbox: {north: -8.05, south: -8.95, east: 115.75, west: 114.4}},
    "jakarta": {bbox: {north: -5.95, south: -6.45, east: 107.05, west: 106.6}},
    "west-java": {bbox: {north: -5.9, south: -7.85, east: 108.9, west: 106.35}, excludeBboxes: [{north: -6.05, south: -6.4, east: 107.0, west: 106.65}]},
    "komodo-national-park": {bbox: {north: -8.35, south: -8.9, east: 119.85, west: 119.3}},
    "ujung-kulon": {bbox: {north: -6.55, south: -7.0, east: 105.75, west: 105.1}},
    "borneo": {bbox: {north: 7.5, south: -4.5, east: 119.5, west: 108.5}, countryCodes: ["BN"]},
    "singapore-zoo": {bbox: {north: 1.43, south: 1.37, east: 103.82, west: 103.77}},
    "london-zoo": {bbox: {north: 51.55, south: 51.52, east: -0.13, west: -0.18}},
    "african-safari": {countryCodes: ["KE", "TZ", "ZA", "BW", "NA", "UG", "RW", "ZM", "ZW"]},
    "china": {countryCodes: ["CN"]},
    "germany": {countryCodes: ["DE"]},
    "india": {countryCodes: ["IN"]},
    "japan": {countryCodes: ["JP"]},
    "australia": {countryCodes: ["AU"]},
    "brazil": {countryCodes: ["BR"]},
    "canada": {countryCodes: ["CA"]},
    "united-states": {countryCodes: ["US"]},
    "thailand": {countryCodes: ["TH"]},
    "mexico": {countryCodes: ["MX"]},
    "peru": {countryCodes: ["PE"]},
    "kenya": {countryCodes: ["KE"]},
    "madagascar": {countryCodes: ["MG"]},
    "sri-lanka": {countryCodes: ["LK"]},
    "ecuador": {countryCodes: ["EC"]},
    "costa-rica": {countryCodes: ["CR"]},
    "norway": {countryCodes: ["NO"]},
    "south-africa": {countryCodes: ["ZA"]},
    "singapore": {countryCodes: ["SG"]},
    "tanzania": {countryCodes: ["TZ"]},
    "united-kingdom": {countryCodes: ["GB"]},
    "spain": {countryCodes: ["ES"]},
    "jamaica": {countryCodes: ["JM"]},
    "afghanistan": {countryCodes: ["AF"]},
    "israel": {countryCodes: ["IL"]},
    "colombia": {countryCodes: ["CO"]},
    "iceland": {countryCodes: ["IS"]},
    "dubai": {bbox: {north: 25.4, south: 24.8, east: 55.65, west: 54.9}},
    "russia": {countryCodes: ["RU"]},
    "pakistan": {countryCodes: ["PK"]}
};
