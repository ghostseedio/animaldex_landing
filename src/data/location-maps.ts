/**
 * Habitat maps for location guides.
 *
 * Outlines are stylised — simplified from real coastal coordinates so the island reads
 * correctly at a glance, but they are not survey-accurate and must not be used for
 * navigation. Zone and pin coordinates are real, so pins land in the right part of the map.
 */

export type GeoPoint = {lat: number; lng: number};

export type LocationMapZone = {
    id: string;
    name: string;
    /** Short line describing the habitat, shown in the legend. */
    habitat: string;
    /** Where the zone label sits. */
    label: GeoPoint;
    /** Stylised catchment for the zone, drawn as a soft blob behind its pins. */
    area: GeoPoint[];
    /** Species pinned to this zone, in the order they should be listed. */
    pins: Array<{speciesSlug: string; at: GeoPoint}>;
};

export type LocationMap = {
    locationSlug: string;
    /** Rendered above the map. */
    title: string;
    description: string;
    /** Simplified coastline, drawn clockwise. */
    outline: GeoPoint[];
    /** Offshore islands, drawn after the mainland. */
    islands?: Array<{name: string; outline: GeoPoint[]}>;
    zones: LocationMapZone[];
    /** Shown under the map. */
    footnote: string;
};

const baliMap: LocationMap = {
    locationSlug: "bali",
    title: "Where to find each animal in Bali",
    description: "Bali's wildlife splits cleanly by habitat: a dry national park in the northwest, volcanic forest and rice terraces through the middle, coral walls along the east coast, and cool open water off Nusa Penida. Each zone below lists the animals you can realistically work for there.",
    outline: [
        {lat: -8.132, lng: 114.452},
        {lat: -8.168, lng: 114.432},
        {lat: -8.267, lng: 114.520},
        {lat: -8.359, lng: 114.618},
        {lat: -8.472, lng: 114.790},
        {lat: -8.585, lng: 114.937},
        {lat: -8.641, lng: 115.058},
        {lat: -8.679, lng: 115.135},
        {lat: -8.748, lng: 115.168},
        {lat: -8.796, lng: 115.088},
        {lat: -8.848, lng: 115.104},
        {lat: -8.836, lng: 115.176},
        {lat: -8.792, lng: 115.232},
        {lat: -8.723, lng: 115.213},
        {lat: -8.677, lng: 115.262},
        {lat: -8.600, lng: 115.386},
        {lat: -8.541, lng: 115.470},
        {lat: -8.428, lng: 115.588},
        {lat: -8.336, lng: 115.649},
        {lat: -8.272, lng: 115.617},
        {lat: -8.183, lng: 115.542},
        {lat: -8.131, lng: 115.395},
        {lat: -8.101, lng: 115.216},
        {lat: -8.108, lng: 115.088},
        {lat: -8.152, lng: 114.938},
        {lat: -8.129, lng: 114.788},
        {lat: -8.140, lng: 114.652},
        {lat: -8.117, lng: 114.545}
    ],
    islands: [
        {
            name: "Menjangan",
            outline: [
                {lat: -8.092, lng: 114.503},
                {lat: -8.086, lng: 114.523},
                {lat: -8.101, lng: 114.531},
                {lat: -8.109, lng: 114.512}
            ]
        },
        {
            name: "Nusa Lembongan",
            outline: [
                {lat: -8.669, lng: 115.436},
                {lat: -8.663, lng: 115.462},
                {lat: -8.690, lng: 115.470},
                {lat: -8.695, lng: 115.443}
            ]
        },
        {
            name: "Nusa Penida",
            outline: [
                {lat: -8.673, lng: 115.487},
                {lat: -8.665, lng: 115.567},
                {lat: -8.702, lng: 115.639},
                {lat: -8.769, lng: 115.617},
                {lat: -8.788, lng: 115.535},
                {lat: -8.735, lng: 115.478}
            ]
        }
    ],
    zones: [
        {
            id: "west-bali",
            name: "West Bali National Park",
            habitat: "Dry monsoon forest, savanna and mangrove in the island's least-developed corner.",
            label: {lat: -8.185, lng: 114.560},
            area: [
                {lat: -8.100, lng: 114.450},
                {lat: -8.110, lng: 114.700},
                {lat: -8.290, lng: 114.700},
                {lat: -8.330, lng: 114.520},
                {lat: -8.170, lng: 114.420}
            ],
            pins: [
                {speciesSlug: "bali-myna", at: {lat: -8.152, lng: 114.532}},
                {speciesSlug: "oriental-pied-hornbill", at: {lat: -8.176, lng: 114.596}},
                {speciesSlug: "crested-serpent-eagle", at: {lat: -8.208, lng: 114.502}},
                {speciesSlug: "reticulated-python", at: {lat: -8.232, lng: 114.612}},
                {speciesSlug: "water-monitor", at: {lat: -8.188, lng: 114.66}},
                {speciesSlug: "wild-boar", at: {lat: -8.262, lng: 114.56}},
                {speciesSlug: "black-giant-squirrel", at: {lat: -8.144, lng: 114.618}},
                {speciesSlug: "asian-palm-civet", at: {lat: -8.212, lng: 114.66}},
                {speciesSlug: "javan-pond-heron", at: {lat: -8.286, lng: 114.64}},
                {speciesSlug: "atlas-moth", at: {lat: -8.262, lng: 114.52}}
            ]
        },
        {
            id: "north-coast",
            name: "North coast & Lovina",
            habitat: "Calm black-sand shoreline with deep water close in, and the island's dolphin runs.",
            label: {lat: -8.135, lng: 115.030},
            area: [
                {lat: -8.095, lng: 114.850},
                {lat: -8.100, lng: 115.230},
                {lat: -8.200, lng: 115.200},
                {lat: -8.205, lng: 114.880}
            ],
            pins: [
                {speciesSlug: "spinner-dolphin", at: {lat: -8.118, lng: 114.93}},
                {speciesSlug: "white-bellied-sea-eagle", at: {lat: -8.112, lng: 115.082}},
                {speciesSlug: "barn-swallow", at: {lat: -8.15, lng: 115.115}},
                {speciesSlug: "little-egret", at: {lat: -8.172, lng: 114.902}},
                {speciesSlug: "jellyfish", at: {lat: -8.108, lng: 115.19}}
            ]
        },
        {
            id: "central-highlands",
            name: "Central highlands & rice terraces",
            habitat: "Volcanic ridges, crater lakes and terraced paddies — the richest insect and small-bird habitat on the island.",
            label: {lat: -8.400, lng: 115.170},
            area: [
                {lat: -8.230, lng: 115.020},
                {lat: -8.250, lng: 115.400},
                {lat: -8.520, lng: 115.360},
                {lat: -8.560, lng: 115.080},
                {lat: -8.380, lng: 114.980}
            ],
            pins: [
                {speciesSlug: "long-tailed-macaque", at: {lat: -8.518, lng: 115.259}},
                {speciesSlug: "common-kingfisher", at: {lat: -8.432, lng: 115.098}},
                {speciesSlug: "cattle-egret", at: {lat: -8.352, lng: 115.222}},
                {speciesSlug: "great-egret", at: {lat: -8.3, lng: 115.196}},
                {speciesSlug: "javan-myna", at: {lat: -8.478, lng: 115.198}},
                {speciesSlug: "zebra-dove", at: {lat: -8.412, lng: 115.142}},
                {speciesSlug: "spotted-dove", at: {lat: -8.386, lng: 115.286}},
                {speciesSlug: "house-sparrow", at: {lat: -8.502, lng: 115.302}},
                {speciesSlug: "barn-owl", at: {lat: -8.286, lng: 115.108}},
                {speciesSlug: "large-flying-fox", at: {lat: -8.252, lng: 115.244}},
                {speciesSlug: "tokay-gecko", at: {lat: -8.508, lng: 115.14}},
                {speciesSlug: "common-house-gecko", at: {lat: -8.462, lng: 115.062}},
                {speciesSlug: "asian-common-toad", at: {lat: -8.542, lng: 115.212}},
                {speciesSlug: "dragonfly", at: {lat: -8.33, lng: 115.155}},
                {speciesSlug: "firefly", at: {lat: -8.286, lng: 115.29}},
                {speciesSlug: "cicada", at: {lat: -8.47, lng: 115.32}},
                {speciesSlug: "honey-bee", at: {lat: -8.386, lng: 115.362}},
                {speciesSlug: "mosquito", at: {lat: -8.418, lng: 115.242}},
                {speciesSlug: "house-fly", at: {lat: -8.532, lng: 115.078}},
                {speciesSlug: "termite", at: {lat: -8.356, lng: 115.33}},
                {speciesSlug: "praying-mantis", at: {lat: -8.268, lng: 115.078}},
                {speciesSlug: "rhinoceros-beetle", at: {lat: -8.352, lng: 115.048}},
                {speciesSlug: "giant-african-land-snail", at: {lat: -8.492, lng: 115.36}},
                {speciesSlug: "millipede", at: {lat: -8.308, lng: 115.348}},
                {speciesSlug: "centipede", at: {lat: -8.238, lng: 115.19}}
            ]
        },
        {
            id: "east-reefs",
            name: "East coast reefs — Amed & Tulamben",
            habitat: "Volcanic black sand dropping onto coral walls and a wreck, reachable straight off the beach.",
            label: {lat: -8.330, lng: 115.560},
            area: [
                {lat: -8.190, lng: 115.480},
                {lat: -8.250, lng: 115.680},
                {lat: -8.470, lng: 115.640},
                {lat: -8.430, lng: 115.470}
            ],
            pins: [
                {speciesSlug: "clownfish", at: {lat: -8.276, lng: 115.594}},
                {speciesSlug: "octopus", at: {lat: -8.348, lng: 115.63}},
                {speciesSlug: "cuttlefish", at: {lat: -8.398, lng: 115.578}},
                {speciesSlug: "lionfish", at: {lat: -8.232, lng: 115.556}},
                {speciesSlug: "mantis-shrimp", at: {lat: -8.412, lng: 115.66}},
                {speciesSlug: "pygmy-seahorse", at: {lat: -8.258, lng: 115.628}},
                {speciesSlug: "moray-eel", at: {lat: -8.372, lng: 115.516}},
                {speciesSlug: "warty-frogfish", at: {lat: -8.33, lng: 115.668}},
                {speciesSlug: "pufferfish", at: {lat: -8.212, lng: 115.52}},
                {speciesSlug: "giant-trevally", at: {lat: -8.436, lng: 115.612}},
                {speciesSlug: "blacktip-reef-shark", at: {lat: -8.292, lng: 115.688}}
            ]
        },
        {
            id: "nusa-penida",
            name: "Nusa Penida & Lembongan",
            habitat: "Cold upwelling and cleaning stations off limestone cliffs — Bali's best big-animal water.",
            label: {lat: -8.760, lng: 115.560},
            area: [
                {lat: -8.630, lng: 115.410},
                {lat: -8.640, lng: 115.690},
                {lat: -8.830, lng: 115.670},
                {lat: -8.820, lng: 115.430}
            ],
            pins: [
                {speciesSlug: "manta-ray", at: {lat: -8.812, lng: 115.532}},
                {speciesSlug: "ocean-sunfish", at: {lat: -8.756, lng: 115.612}},
                {speciesSlug: "green-sea-turtle", at: {lat: -8.688, lng: 115.588}},
                {speciesSlug: "hawksbill-sea-turtle", at: {lat: -8.716, lng: 115.652}},
                {speciesSlug: "olive-ridley-sea-turtle", at: {lat: -8.66, lng: 115.502}},
                {speciesSlug: "sea-cucumber", at: {lat: -8.742, lng: 115.652}}
            ]
        },
        {
            id: "south-coast",
            name: "South coast & Bukit peninsula",
            habitat: "Limestone cliffs, temple headlands and reef flats at the busiest end of the island.",
            label: {lat: -8.800, lng: 115.130},
            area: [
                {lat: -8.700, lng: 115.040},
                {lat: -8.700, lng: 115.270},
                {lat: -8.870, lng: 115.250},
                {lat: -8.870, lng: 115.060}
            ],
            pins: [
                {speciesSlug: "jumping-spider", at: {lat: -8.742, lng: 115.098}},
                {speciesSlug: "orchid-mantis", at: {lat: -8.786, lng: 115.148}},
                {speciesSlug: "hermit-crab", at: {lat: -8.812, lng: 115.118}}
            ]
        }
    ],
    footnote: "Zones are habitat guidance, not guarantees. Pin positions mark the part of the island each animal is realistically worked for; the coastline is simplified for legibility."
};

const locationMaps: Record<string, LocationMap> = {
    bali: baliMap
};

export function getLocationMap(locationSlug: string) {
    return locationMaps[locationSlug] ?? null;
}

/** Every species slug the map references, in zone order, de-duplicated. */
export function getLocationMapSpeciesSlugs(map: LocationMap) {
    const seen = new Set<string>();

    for (const zone of map.zones) {
        for (const pin of zone.pins) {
            seen.add(pin.speciesSlug);
        }
    }

    return Array.from(seen);
}
