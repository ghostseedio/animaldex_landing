/**
 * Habitat zone specs for the generated location maps.
 *
 * One entry per location guide (Bali stays hand-drawn in src/data/location-maps.ts).
 * Zones describe the real sub-regions a visitor would work: `area` polygons are rough
 * catchments drawn behind the pins, and `classes` say which kinds of animal belong there,
 * so each location page's own animal list sorts itself onto the map.
 *
 * Consumed by scripts/generateLocationHabitatMaps.ts.
 */

import type {HabitatClass} from "./species-habitat-classes";

export type GeoPoint = {lat: number; lng: number};
export type GeoBox = {north: number; south: number; east: number; west: number};

export type HabitatZoneSpec = {
    id: string;
    name: string;
    habitat: string;
    /** Where the zone name is drawn. */
    label: GeoPoint;
    /** Rough catchment for the zone, drawn as a soft blob behind its pins. */
    area: GeoPoint[];
    /** Habitat classes this zone takes; see scripts/species-habitat-classes.ts. */
    classes?: HabitatClass[];
    /** Species pinned here whatever their habitat class says. */
    species?: string[];
    labelHalfWidth?: number;
    labelHalfHeight?: number;
};

export type OutlineSource =
    | {kind: "country"; names: string[]; box?: GeoBox; mainlandPoints?: number; maxIslands?: number; minIslandRatio?: number}
    | {kind: "admin1"; country: string; names: string[]; box?: GeoBox; mainlandPoints?: number; maxIslands?: number; minIslandRatio?: number}
    | {kind: "land"; box: GeoBox; mainlandPoints?: number; maxIslands?: number; minIslandRatio?: number}
    | {kind: "manual"; outline: GeoPoint[]; islands?: Array<{name: string; outline: GeoPoint[]}>};

export type LocationHabitatMapSpec = {
    slug: string;
    /** Overrides the location name in the section title. */
    mapName?: string;
    description: string;
    footnote?: string;
    source: OutlineSource;
    zones: HabitatZoneSpec[];
    /** Zone for species whose class no zone claims. */
    defaultZoneId: string;
    /** Caps how far zones grow to fit their pins; small maps need a tighter cap. */
    maxZoneScale?: number;
    /** Half-size of the label's keep-clear box, in degrees. */
    labelHalfWidth?: number;
    labelHalfHeight?: number;
};

/** Builds a quad catchment around a point; most zones are this shape. */
function around(label: GeoPoint, latSpan: number, lngSpan: number): GeoPoint[] {
    return [
        {lat: Number((label.lat + latSpan).toFixed(3)), lng: Number((label.lng - lngSpan).toFixed(3))},
        {lat: Number((label.lat + latSpan).toFixed(3)), lng: Number((label.lng + lngSpan).toFixed(3))},
        {lat: Number((label.lat - latSpan).toFixed(3)), lng: Number((label.lng + lngSpan).toFixed(3))},
        {lat: Number((label.lat - latSpan).toFixed(3)), lng: Number((label.lng - lngSpan).toFixed(3))}
    ];
}

const ZOO_FOOTNOTE = "Zones follow the park's own themed areas, drawn to scale but not to survey accuracy. Use them to plan a route, not to navigate the site.";

export const locationHabitatMapSpecs: LocationHabitatMapSpec[] = [
    {
        slug: "indonesia",
        description: "Indonesia spans two biogeographic worlds across a 5,000km arc. The zones below split it the way a trip does: Sumatra's rainforest, Kalimantan's peat swamp and rivers, the dry islands of Wallacea, the coral triangle water that connects everything, and Java's farmland and cities where most everyday sightings happen.",
        source: {kind: "country", names: ["Indonesia"], mainlandPoints: 90, maxIslands: 8},
        defaultZoneId: "java-lowlands",
        labelHalfWidth: 3.4,
        labelHalfHeight: 1.1,
        zones: [
            {
                id: "sumatra-forest",
                name: "Sumatran rainforest",
                habitat: "Lowland and hill rainforest along the Bukit Barisan range — the last stronghold for the island's big forest mammals.",
                label: {lat: 0.35, lng: 101.35},
                area: [
                    {lat: 4.35, lng: 96.85},
                    {lat: 2.35, lng: 100.35},
                    {lat: -2.65, lng: 104.35},
                    {lat: -4.85, lng: 103.35},
                    {lat: -1.35, lng: 98.35},
                    {lat: 3.35, lng: 95.85}
                ],
                classes: ["forest"]
            },
            {
                id: "kalimantan-rivers",
                name: "Kalimantan peat forest & rivers",
                habitat: "Blackwater rivers, peat swamp and dipterocarp forest across Indonesian Borneo.",
                label: {lat: 0.85, lng: 113.35},
                species: ["bornean-orangutan"],
                area: [
                    {lat: 3.35, lng: 109.85},
                    {lat: 2.85, lng: 117.35},
                    {lat: -2.35, lng: 116.35},
                    {lat: -3.35, lng: 111.35},
                    {lat: 0.35, lng: 108.85}
                ],
                classes: ["wetland"]
            },
            {
                id: "wallacea-dry",
                name: "Bali, Nusa Tenggara & the dry islands",
                habitat: "Savanna, monsoon scrub and limestone hills from West Bali east through Nusa Tenggara — Komodo country.",
                label: {lat: -8.85, lng: 120.35},
                species: ["bali-myna"],
                area: [
                    {lat: -7.85, lng: 114.75},
                    {lat: -7.95, lng: 125.35},
                    {lat: -10.35, lng: 124.35},
                    {lat: -9.85, lng: 116.85}
                ],
                classes: ["arid", "grassland"]
            },
            {
                id: "coral-triangle",
                name: "Coral Triangle water",
                habitat: "Raja Ampat, the Banda Sea and the reef systems that make this the richest marine region on earth.",
                label: {lat: -4.35, lng: 129.35},
                area: [
                    {lat: -2.35, lng: 125.35},
                    {lat: -2.85, lng: 133.35},
                    {lat: -6.35, lng: 132.35},
                    {lat: -5.85, lng: 125.85}
                ],
                classes: ["marine", "coast"]
            },
            {
                id: "java-lowlands",
                name: "Java's farmland, cities & volcanoes",
                habitat: "Rice terraces, volcano slopes and the most densely settled countryside in Southeast Asia.",
                label: {lat: -7.85, lng: 109.35},
                area: [
                    {lat: -5.85, lng: 105.35},
                    {lat: -6.35, lng: 114.35},
                    {lat: -8.65, lng: 114.35},
                    {lat: -7.85, lng: 105.35}
                ],
                classes: ["urban", "montane", "cold"]
            }
        ]
    },
    {
        slug: "jakarta",
        description: "Jakarta's wildlife lives in the gaps the city left: mangrove and fishpond edge along the north coast, canal and reservoir water through the middle, the old zoo and botanical forest in the south, and the Thousand Islands reefs an hour offshore.",
        source: {kind: "admin1", country: "Indonesia", names: ["Jakarta Raya"], mainlandPoints: 44, maxIslands: 5},
        defaultZoneId: "city-streets",
        labelHalfWidth: 0.085,
        labelHalfHeight: 0.02,
        zones: [
            {
                id: "thousand-islands",
                name: "Thousand Islands reefs",
                habitat: "Coral cays north of the bay, the only clear water within reach of the city.",
                label: {lat: -5.72, lng: 106.58},
                area: around({lat: -5.72, lng: 106.58}, 0.16, 0.12),
                classes: ["marine"]
            },
            {
                id: "muara-angke",
                name: "Muara Angke mangroves & north coast",
                habitat: "Mangrove reserve, fishponds and the harbour edge where the waterbirds and sea eagles work.",
                label: {lat: -6.105, lng: 106.76},
                area: around({lat: -6.105, lng: 106.76}, 0.035, 0.075),
                classes: ["coast", "wetland"]
            },
            {
                id: "ragunan-forest",
                name: "Ragunan & the southern green belt",
                habitat: "Zoo grounds, botanical planting and the last closed canopy inside the city limits.",
                label: {lat: -6.31, lng: 106.83},
                species: ["elephant", "giraffe"],
                area: around({lat: -6.31, lng: 106.83}, 0.04, 0.075),
                classes: ["forest"]
            },
            {
                id: "city-streets",
                name: "Kampung streets, parks & canals",
                habitat: "Monas, the kampung lanes and roadside trees — where the city's everyday species actually are.",
                label: {lat: -6.19, lng: 106.85},
                area: around({lat: -6.19, lng: 106.85}, 0.045, 0.085),
                classes: ["urban", "grassland", "montane"]
            }
        ]
    },
    {
        slug: "west-java",
        description: "West Java stacks its habitats by altitude: mangrove and paddy on the north coast, tea and farmland across the middle, montane rainforest on Halimun-Salak and Gede, and surf-hit reef along the south coast.",
        source: {kind: "admin1", country: "Indonesia", names: ["Jawa Barat"], mainlandPoints: 56, maxIslands: 3},
        defaultZoneId: "bandung-farmland",
        labelHalfWidth: 0.42,
        labelHalfHeight: 0.09,
        zones: [
            {
                id: "halimun-salak",
                name: "Halimun-Salak montane forest",
                habitat: "Cloud forest and steep river valleys in the west of the province, the province's richest forest block.",
                label: {lat: -6.75, lng: 106.5},
                area: around({lat: -6.75, lng: 106.5}, 0.28, 0.3),
                classes: ["forest", "montane"]
            },
            {
                id: "north-coast-paddy",
                name: "North coast paddy & mangrove",
                habitat: "Flat rice country, fishponds and mangrove fringe along the Java Sea.",
                label: {lat: -6.25, lng: 107.95},
                area: around({lat: -6.25, lng: 107.95}, 0.16, 0.5),
                classes: ["wetland", "coast"]
            },
            {
                id: "south-coast-reef",
                name: "South coast & Pelabuhan Ratu water",
                habitat: "Open Indian Ocean swell, headland reef and turtle beaches on the province's wild side.",
                label: {lat: -7.5, lng: 107.2},
                area: around({lat: -7.5, lng: 107.2}, 0.2, 0.7),
                classes: ["marine"]
            },
            {
                id: "bandung-farmland",
                name: "Bandung, tea terraces & kampung",
                habitat: "Highland farmland, tea estates and the towns strung between them.",
                label: {lat: -7.0, lng: 107.65},
                area: around({lat: -7.0, lng: 107.65}, 0.22, 0.32),
                classes: ["urban", "grassland", "arid", "cold"]
            }
        ]
    },
    {
        slug: "komodo-national-park",
        description: "The park is a set of dry islands in fast, cold water. Savanna and lontar palm cover the ridges, monsoon forest fills the valleys, mangrove lines the sheltered bays, and the channels between islands hold some of the best reef diving in Indonesia.",
        source: {kind: "land", box: {north: -8.24, south: -8.92, west: 119.19, east: 120.05}, mainlandPoints: 40, maxIslands: 9, minIslandRatio: 0.002},
        defaultZoneId: "ranger-camps",
        labelHalfWidth: 0.1,
        labelHalfHeight: 0.025,
        zones: [
            {
                id: "komodo-savanna",
                name: "Komodo island savanna",
                habitat: "Dry grass ridges and lontar palm — the dragons' own ground, walked with a ranger.",
                label: {lat: -8.55, lng: 119.42},
                area: around({lat: -8.55, lng: 119.42}, 0.07, 0.07),
                classes: ["arid", "grassland"]
            },
            {
                id: "rinca-forest",
                name: "Rinca monsoon forest",
                habitat: "Deciduous valley forest and gully cover on Rinca, greener than Komodo through the wet season.",
                label: {lat: -8.7, lng: 119.72},
                area: around({lat: -8.7, lng: 119.72}, 0.06, 0.07),
                classes: ["forest"]
            },
            {
                id: "mangrove-bays",
                name: "Mangrove bays & tidal flats",
                habitat: "Sheltered inlets where mangrove monitors, crocodile country and wading birds overlap.",
                label: {lat: -8.42, lng: 119.55},
                area: around({lat: -8.42, lng: 119.55}, 0.05, 0.09),
                classes: ["coast", "wetland"]
            },
            {
                id: "channel-reefs",
                name: "Channel reefs & manta points",
                habitat: "Cold upwelling through the straits, feeding the manta stations and reef walls the park is known for.",
                label: {lat: -8.32, lng: 119.85},
                area: around({lat: -8.32, lng: 119.85}, 0.07, 0.12),
                classes: ["marine"]
            },
            {
                id: "ranger-camps",
                name: "Ranger camps & village edge",
                habitat: "Loh Liang, Loh Buaya and Komodo village, where the everyday commensal species live.",
                label: {lat: -8.63, lng: 119.6},
                area: around({lat: -8.63, lng: 119.6}, 0.045, 0.06),
                classes: ["urban", "montane", "cold"]
            }
        ]
    },
    {
        slug: "ujung-kulon",
        description: "Ujung Kulon is a peninsula that went back to forest. Rhino country sits in the interior, grazing lawns open along the old plantation clearings, rivers and swamp drain to the coast, and Panaitan's reefs sit offshore.",
        source: {kind: "land", box: {north: -6.4, south: -7.0, west: 105.05, east: 105.9}, mainlandPoints: 44, maxIslands: 5, minIslandRatio: 0.002},
        defaultZoneId: "park-posts",
        labelHalfWidth: 0.1,
        labelHalfHeight: 0.022,
        zones: [
            {
                id: "peninsula-forest",
                name: "Peninsula rainforest",
                habitat: "Closed lowland rainforest across the peninsula's interior — the Javan rhino's last ground.",
                label: {lat: -6.77, lng: 105.35},
                area: around({lat: -6.77, lng: 105.35}, 0.09, 0.13),
                classes: ["forest"]
            },
            {
                id: "grazing-lawns",
                name: "Cidaon grazing lawns",
                habitat: "Open grazing clearings kept short by banteng and deer, watched from the platform at dawn.",
                label: {lat: -6.62, lng: 105.44},
                area: around({lat: -6.62, lng: 105.44}, 0.05, 0.08),
                classes: ["grassland", "arid"]
            },
            {
                id: "cigenter-river",
                name: "Cigenter river & swamp",
                habitat: "Slow forest river and freshwater swamp, worked by canoe for kingfishers and monitors.",
                label: {lat: -6.72, lng: 105.62},
                area: around({lat: -6.72, lng: 105.62}, 0.06, 0.09),
                classes: ["wetland", "coast"]
            },
            {
                id: "panaitan-water",
                name: "Panaitan & offshore water",
                habitat: "Reef and open Sunda Strait water off the park's western islands.",
                label: {lat: -6.56, lng: 105.2},
                area: around({lat: -6.56, lng: 105.2}, 0.06, 0.1),
                classes: ["marine"]
            },
            {
                id: "park-posts",
                name: "Park posts & Tamanjaya",
                habitat: "Ranger posts, homestays and the village edge at the park gate.",
                label: {lat: -6.86, lng: 105.68},
                area: around({lat: -6.86, lng: 105.68}, 0.05, 0.08),
                classes: ["urban", "montane", "cold"]
            }
        ]
    },
    {
        slug: "borneo",
        description: "Borneo reads as one green island but works as three habitats: dipterocarp forest in the interior highlands, wildlife-dense river corridors like the Kinabatangan, mangrove and peat along the coast, and the towns where the island's adaptable species live.",
        source: {kind: "land", box: {north: 7.6, south: -4.6, west: 108.5, east: 119.6}, mainlandPoints: 70, maxIslands: 4},
        defaultZoneId: "coastal-towns",
        labelHalfWidth: 2.1,
        labelHalfHeight: 0.55,
        zones: [
            {
                id: "interior-forest",
                name: "Interior dipterocarp forest",
                habitat: "The Heart of Borneo highlands — tall, unbroken forest holding the orangutans and hornbills.",
                label: {lat: 1.6, lng: 114.2},
                area: around({lat: 1.6, lng: 114.2}, 2.0, 2.4),
                classes: ["forest", "montane"]
            },
            {
                id: "kinabatangan-rivers",
                name: "Kinabatangan & river corridors",
                habitat: "Oxbow lakes and riverside forest strips where the wildlife concentrates into a thin, workable band.",
                label: {lat: 5.3, lng: 117.6},
                area: around({lat: 5.3, lng: 117.6}, 0.85, 1.2),
                classes: ["wetland"]
            },
            {
                id: "mangrove-coast",
                name: "Mangrove & peat coast",
                habitat: "Tidal mangrove, nipa and peat swamp fringing the island's long, flat coastline.",
                label: {lat: 3.3, lng: 110.5},
                area: around({lat: 3.3, lng: 110.5}, 1.1, 1.4),
                classes: ["coast", "marine"]
            },
            {
                id: "coastal-towns",
                name: "Towns, plantations & kampung",
                habitat: "Kuching, Kota Kinabalu and the plantation belt in between.",
                label: {lat: -1.6, lng: 113.4},
                area: around({lat: -1.6, lng: 113.4}, 1.5, 2.2),
                classes: ["urban", "grassland", "arid", "cold"]
            }
        ]
    },
    {
        slug: "singapore",
        description: "Singapore fits every habitat into 730km²: primary forest in the Central Catchment, mangrove and mudflat at Sungei Buloh, reef around the southern islands, and a city that a surprising amount of wildlife has learned to use.",
        source: {kind: "land", box: {north: 1.51, south: 1.13, west: 103.58, east: 104.12}, mainlandPoints: 46, maxIslands: 6, minIslandRatio: 0.002},
        defaultZoneId: "city-estates",
        labelHalfWidth: 0.075,
        labelHalfHeight: 0.016,
        zones: [
            {
                id: "central-catchment",
                name: "Central Catchment & Bukit Timah",
                habitat: "The island's last primary rainforest, plus the secondary forest that grew back around the reservoirs.",
                label: {lat: 1.365, lng: 103.79},
                area: around({lat: 1.365, lng: 103.79}, 0.035, 0.045),
                classes: ["forest", "montane"]
            },
            {
                id: "sungei-buloh",
                name: "Sungei Buloh wetlands",
                habitat: "Mangrove boardwalks and tidal mudflat on the north-west shore, best on a falling tide.",
                label: {lat: 1.445, lng: 103.72},
                area: around({lat: 1.445, lng: 103.72}, 0.03, 0.05),
                classes: ["wetland", "coast"]
            },
            {
                id: "southern-islands",
                name: "Southern Islands water",
                habitat: "Sisters' Islands and the reef patches that survive in the shipping lane's shadow.",
                label: {lat: 1.21, lng: 103.83},
                area: around({lat: 1.21, lng: 103.83}, 0.035, 0.07),
                classes: ["marine"]
            },
            {
                id: "city-estates",
                name: "HDB estates, parks & park connectors",
                habitat: "Void decks, roadside rain trees and the park connector network — the city's own ecosystem.",
                label: {lat: 1.315, lng: 103.88},
                area: around({lat: 1.315, lng: 103.88}, 0.04, 0.075),
                classes: ["urban", "grassland", "arid", "cold"]
            }
        ]
    },
    {
        slug: "singapore-zoo",
        mapName: "Singapore Zoo",
        description: "The zoo is laid out as open habitat enclosures rather than cages, so it maps cleanly: rainforest exhibits through the middle, African plains along the south, river habitats on the east side, and the grounds themselves — where a good number of wild species have moved in.",
        footnote: ZOO_FOOTNOTE,
        source: {
            kind: "manual",
            outline: [
                {lat: 1.4082, lng: 103.7878},
                {lat: 1.4079, lng: 103.7996},
                {lat: 1.4041, lng: 103.8012},
                {lat: 1.3995, lng: 103.7986},
                {lat: 1.3988, lng: 103.7902},
                {lat: 1.4029, lng: 103.7862}
            ]
        },
        defaultZoneId: "zoo-grounds",
        maxZoneScale: 1.15,
        labelHalfWidth: 0.0026,
        labelHalfHeight: 0.0004,
        zones: [
            {
                id: "fragile-forest",
                name: "Fragile Forest & Primate Kingdom",
                habitat: "Walk-through rainforest biome and the island enclosures — the zoo's canopy species.",
                label: {lat: 1.4059, lng: 103.7902},
                area: around({lat: 1.4059, lng: 103.7902}, 0.0016, 0.0028),
                classes: ["forest", "montane"]
            },
            {
                id: "wild-africa",
                name: "Wild Africa",
                habitat: "Open savanna paddocks for the plains grazers and the big cats that share the sightline.",
                label: {lat: 1.4009, lng: 103.7908},
                area: around({lat: 1.4009, lng: 103.7908}, 0.0016, 0.003),
                classes: ["grassland", "arid", "cold"]
            },
            {
                id: "river-habitats",
                name: "River habitats & otter pools",
                habitat: "Freshwater exhibits along the reservoir side, where the otters and water monitors sit.",
                label: {lat: 1.4058, lng: 103.7972},
                area: around({lat: 1.4058, lng: 103.7972}, 0.0016, 0.0026),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "zoo-grounds",
                name: "Grounds, paths & Mandai edge",
                habitat: "The planted grounds and forest boundary, where wild mynas, skinks and geckos work the visitors.",
                label: {lat: 1.4017, lng: 103.7966},
                area: around({lat: 1.4017, lng: 103.7966}, 0.0016, 0.0028),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "london-zoo",
        mapName: "London Zoo",
        description: "London Zoo is compact and themed, so a visit is really four habitats in one walk: the big-cat and savanna side, the rainforest and mountain houses, the penguin and aquarium water, and the gardens and canal edge where wild London turns up uninvited.",
        footnote: ZOO_FOOTNOTE,
        source: {
            kind: "manual",
            outline: [
                {lat: 51.5378, lng: -0.1596},
                {lat: 51.5381, lng: -0.1496},
                {lat: 51.5356, lng: -0.1466},
                {lat: 51.5322, lng: -0.1482},
                {lat: 51.5316, lng: -0.1562},
                {lat: 51.5344, lng: -0.1608}
            ]
        },
        defaultZoneId: "zoo-gardens",
        maxZoneScale: 1.15,
        labelHalfWidth: 0.0024,
        labelHalfHeight: 0.0004,
        zones: [
            {
                id: "land-of-lions",
                name: "Land of the Lions & savanna",
                habitat: "The open paddocks and big-cat ground on the western side of the park.",
                label: {lat: 51.5333, lng: -0.1573},
                area: around({lat: 51.5333, lng: -0.1573}, 0.001, 0.0026),
                classes: ["grassland", "arid"]
            },
            {
                id: "rainforest-life",
                name: "Rainforest Life & Gorilla Kingdom",
                habitat: "Indoor rainforest, the gorilla island and the mountain-species houses beside it.",
                label: {lat: 51.5366, lng: -0.1576},
                area: around({lat: 51.5366, lng: -0.1576}, 0.001, 0.0026),
                classes: ["forest", "montane", "cold"]
            },
            {
                id: "penguin-beach",
                name: "Penguin Beach & the aquarium",
                habitat: "The pool, the aquarium and the wetland-bird enclosures on the canal side.",
                label: {lat: 51.5366, lng: -0.1504},
                area: around({lat: 51.5366, lng: -0.1504}, 0.001, 0.0024),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "zoo-gardens",
                name: "Gardens, canal & Regent's Park edge",
                habitat: "Planting, bins and the canal towpath — where London's own foxes, magpies and hedgehogs live.",
                label: {lat: 51.5333, lng: -0.1504},
                area: around({lat: 51.5333, lng: -0.1504}, 0.001, 0.0026),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "african-safari",
        mapName: "East Africa",
        description: "A classic safari route works four habitats in a week: the short-grass plains of the Serengeti-Mara, the dry acacia country north and east of them, the rivers and swamps that hold game through the dry season, and the riverine forest strips where the primates and hornbills sit.",
        source: {kind: "land", box: {north: 5.5, south: -12.0, west: 28.5, east: 42.0}, mainlandPoints: 50, maxIslands: 3},
        defaultZoneId: "serengeti-mara",
        labelHalfWidth: 2.4,
        labelHalfHeight: 0.7,
        zones: [
            {
                id: "serengeti-mara",
                name: "Serengeti & Maasai Mara plains",
                habitat: "Short-grass savanna carrying the migration herds and the predators that live off them.",
                label: {lat: -2.4, lng: 34.6},
                area: around({lat: -2.4, lng: 34.6}, 2.0, 2.2),
                classes: ["grassland"]
            },
            {
                id: "northern-drylands",
                name: "Northern acacia drylands",
                habitat: "Thorn bush, red soil and dry riverbeds — harder country, and where the dry-country specialists live.",
                label: {lat: 1.8, lng: 38.2},
                area: around({lat: 1.8, lng: 38.2}, 2.2, 2.4),
                classes: ["arid"]
            },
            {
                id: "riverine-forest",
                name: "Riverine forest & escarpment",
                habitat: "Fig and fever-tree galleries along permanent water, plus the forested Rift escarpment above them.",
                label: {lat: -4.6, lng: 30.4},
                area: around({lat: -4.6, lng: 30.4}, 2.0, 1.6),
                classes: ["forest", "montane"]
            },
            {
                id: "rivers-swamps",
                name: "Rivers, swamps & flood plains",
                habitat: "Hippo pools, papyrus swamp and seasonal flood plains that concentrate game as the land dries.",
                label: {lat: -8.2, lng: 36.4},
                area: around({lat: -8.2, lng: 36.4}, 2.0, 2.2),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "camps-and-towns",
                name: "Camps, lodges & town edges",
                habitat: "Tented camps, park gates and the towns you stage from, where the commensal species live.",
                label: {lat: -5.6, lng: 33.2},
                area: around({lat: -5.6, lng: 33.2}, 1.6, 1.8),
                classes: ["urban", "cold"]
            }
        ]
    },
    {
        slug: "china",
        description: "China's wildlife splits by geography as much as by climate: bamboo mountains in Sichuan, the Tibetan plateau in the west, the Yangtze's lakes and wetlands through the middle, grassland and desert in Inner Mongolia, and the dense eastern cities where the adaptable species thrive.",
        source: {kind: "country", names: ["China"], mainlandPoints: 74, maxIslands: 3},
        defaultZoneId: "eastern-cities",
        labelHalfWidth: 4.0,
        labelHalfHeight: 1.1,
        zones: [
            {
                id: "sichuan-bamboo",
                name: "Sichuan bamboo mountains",
                habitat: "Wet montane bamboo forest on the eastern edge of the plateau — panda and red panda country.",
                label: {lat: 30.8, lng: 103.0},
                area: around({lat: 30.8, lng: 103.0}, 2.6, 2.6),
                classes: ["forest"]
            },
            {
                id: "tibetan-plateau",
                name: "Tibetan plateau & the high west",
                habitat: "Cold, thin-aired rangeland and rock above 4,000m, where the high-altitude specialists live.",
                label: {lat: 32.6, lng: 87.5},
                area: around({lat: 32.6, lng: 87.5}, 3.0, 5.0),
                classes: ["montane", "cold"]
            },
            {
                id: "yangtze-wetlands",
                name: "Yangtze lakes & wetlands",
                habitat: "Floodplain lakes, reed beds and rice country along the river — the country's waterbird engine.",
                label: {lat: 30.0, lng: 114.5},
                area: around({lat: 30.0, lng: 114.5}, 2.4, 3.4),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "inner-mongolia",
                name: "Inner Mongolian grassland & desert",
                habitat: "Open steppe running into the Gobi, grazed hard and hunted over by raptors.",
                label: {lat: 43.6, lng: 113.5},
                area: around({lat: 43.6, lng: 113.5}, 2.6, 5.0),
                classes: ["grassland", "arid"]
            },
            {
                id: "eastern-cities",
                name: "Eastern cities, parks & farmland",
                habitat: "The dense eastern plain: canal towns, park trees and farmland between the megacities.",
                label: {lat: 35.4, lng: 118.5},
                area: around({lat: 35.4, lng: 118.5}, 2.4, 2.6),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "germany",
        description: "Germany is a worked landscape with wild edges: managed forest across the middle and south, the Alps along the Austrian border, Wadden Sea mudflats in the north, farmland everywhere between, and cities where foxes and martens have moved in for good.",
        source: {kind: "country", names: ["Germany"], mainlandPoints: 60, maxIslands: 3},
        defaultZoneId: "cities-and-suburbs",
        labelHalfWidth: 1.3,
        labelHalfHeight: 0.28,
        zones: [
            {
                id: "bavarian-alps",
                name: "Bavarian Alps & foothills",
                habitat: "Limestone peaks, spruce slopes and alpine pasture along the southern border.",
                label: {lat: 47.75, lng: 11.4},
                area: around({lat: 47.75, lng: 11.4}, 0.45, 1.4),
                classes: ["montane", "cold"]
            },
            {
                id: "mixed-forests",
                name: "Mixed forest — Harz to the Black Forest",
                habitat: "Beech and spruce forest across the central uplands, where the returning large mammals sit.",
                label: {lat: 49.9, lng: 9.4},
                area: around({lat: 49.9, lng: 9.4}, 1.1, 1.6),
                classes: ["forest"]
            },
            {
                id: "north-wetlands",
                name: "Wadden Sea & northern wetlands",
                habitat: "Tidal mudflat, marsh and shallow coast — the migration stopover the whole flyway depends on.",
                label: {lat: 53.7, lng: 8.6},
                area: around({lat: 53.7, lng: 8.6}, 0.7, 1.4),
                classes: ["wetland", "coast", "marine"]
            },
            {
                id: "farmland-belt",
                name: "Farmland & open country",
                habitat: "Arable plains and hedgerow country across the north-east, hunted over by owls and buzzards.",
                label: {lat: 52.4, lng: 12.6},
                area: around({lat: 52.4, lng: 12.6}, 0.85, 1.7),
                classes: ["grassland", "arid"]
            },
            {
                id: "cities-and-suburbs",
                name: "Cities, gardens & suburbs",
                habitat: "The Ruhr, Berlin and every garden in between — Germany's most reliable wildlife habitat.",
                label: {lat: 51.0, lng: 7.2},
                area: around({lat: 51.0, lng: 7.2}, 0.8, 1.2),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "india",
        description: "India's wildlife maps onto its rainfall: rainforest down the Western Ghats, desert in the Thar, tall grassland along the Terai belt under the Himalaya, river and delta wetlands in the east, and cities that hold more wildlife than most visitors expect.",
        source: {kind: "country", names: ["India"], mainlandPoints: 66, maxIslands: 0},
        defaultZoneId: "cities-and-farmland",
        labelHalfWidth: 2.6,
        labelHalfHeight: 0.7,
        zones: [
            {
                id: "western-ghats",
                name: "Western Ghats rainforest",
                habitat: "Wet evergreen forest and shola-grassland down the west coast range — India's endemism hotspot.",
                label: {lat: 12.6, lng: 75.9},
                area: around({lat: 12.6, lng: 75.9}, 2.6, 1.5),
                classes: ["forest", "montane"]
            },
            {
                id: "thar-desert",
                name: "Thar desert & dry Rajasthan",
                habitat: "Sand, thorn scrub and salt flat in the north-west, worked in the cool hours only.",
                label: {lat: 27.0, lng: 71.6},
                area: around({lat: 27.0, lng: 71.6}, 2.0, 2.0),
                classes: ["arid"]
            },
            {
                id: "terai-grassland",
                name: "Terai grassland & sal forest",
                habitat: "Elephant grass and sal woodland under the Himalayan foothills — tiger and rhino ground.",
                label: {lat: 27.4, lng: 82.5},
                area: around({lat: 27.4, lng: 82.5}, 1.3, 3.0),
                classes: ["grassland"]
            },
            {
                id: "ganges-wetlands",
                name: "Ganges rivers & delta",
                habitat: "Braided river channels, oxbows and the Sundarbans delta in the east.",
                label: {lat: 24.0, lng: 87.6},
                area: around({lat: 24.0, lng: 87.6}, 1.8, 1.9),
                classes: ["wetland", "coast", "marine"]
            },
            {
                id: "cities-and-farmland",
                name: "Cities, temples & farmland",
                habitat: "Rooftops, temple tanks and field edges — where most Indian wildlife encounters actually happen.",
                label: {lat: 19.2, lng: 77.0},
                area: around({lat: 19.2, lng: 77.0}, 1.8, 2.2),
                classes: ["urban", "cold"]
            }
        ]
    },
    {
        slug: "japan",
        description: "Japan is a long archipelago, so its wildlife changes with latitude: subarctic forest and drift ice in Hokkaido, high alpine ridges through central Honshu, wetlands and paddy across the plains, warm current water offshore, and dense cities that keep their own wild residents.",
        source: {kind: "country", names: ["Japan"], mainlandPoints: 70, maxIslands: 5},
        defaultZoneId: "cities-and-paddy",
        labelHalfWidth: 1.6,
        labelHalfHeight: 0.42,
        zones: [
            {
                id: "hokkaido-forest",
                name: "Hokkaido forest & Shiretoko",
                habitat: "Subarctic forest, drift-ice coast and the country's least-settled wild ground.",
                label: {lat: 43.7, lng: 142.6},
                area: around({lat: 43.7, lng: 142.6}, 1.1, 1.4),
                classes: ["forest", "cold"]
            },
            {
                id: "japan-alps",
                name: "Japanese Alps",
                habitat: "Steep 3,000m ridges and snow country through central Honshu — serow and macaque ground.",
                label: {lat: 36.3, lng: 137.6},
                area: around({lat: 36.3, lng: 137.6}, 0.9, 0.95),
                classes: ["montane"]
            },
            {
                id: "paddy-wetlands",
                name: "Kushiro & lowland wetlands",
                habitat: "Marsh, reed bed and flooded paddy — cranes, herons and the country's freshwater life.",
                label: {lat: 37.1, lng: 140.4},
                area: around({lat: 37.1, lng: 140.4}, 0.9, 1.2),
                classes: ["wetland"]
            },
            {
                id: "kuroshio-water",
                name: "Kuroshio current water",
                habitat: "The warm current running up the Pacific side, and the cold water meeting it offshore.",
                label: {lat: 33.4, lng: 136.4},
                area: around({lat: 33.4, lng: 136.4}, 1.1, 1.8),
                classes: ["marine", "coast"]
            },
            {
                id: "cities-and-paddy",
                name: "Cities, shrines & farmland",
                habitat: "Tokyo's parks, shrine woodland and the rice country between the conurbations.",
                label: {lat: 35.2, lng: 139.5},
                area: around({lat: 35.2, lng: 139.5}, 0.7, 0.9),
                classes: ["urban", "grassland", "arid"]
            }
        ]
    },
    {
        slug: "australia",
        description: "Australia's wildlife is organised by water: the arid red centre across most of the continent, wet forest down the east coast and Tasmania, the Great Barrier Reef offshore, Top End wetlands in the north, and the farmland and cities in the south-east corner.",
        source: {kind: "country", names: ["Australia"], mainlandPoints: 74, maxIslands: 3},
        defaultZoneId: "southeast-cities",
        labelHalfWidth: 5.0,
        labelHalfHeight: 1.3,
        zones: [
            {
                id: "red-centre",
                name: "The red centre & spinifex country",
                habitat: "Sand plain, spinifex and gibber desert across the continental interior.",
                label: {lat: -24.5, lng: 132.5},
                area: around({lat: -24.5, lng: 132.5}, 4.5, 6.5),
                classes: ["arid"]
            },
            {
                id: "east-forests",
                name: "Eastern forests & Tasmania",
                habitat: "Wet eucalypt and rainforest down the Great Dividing Range and across Tasmania.",
                label: {lat: -33.0, lng: 149.8},
                area: around({lat: -33.0, lng: 149.8}, 4.5, 2.3),
                classes: ["forest", "montane"]
            },
            {
                id: "barrier-reef",
                name: "Great Barrier Reef",
                habitat: "2,300km of reef and lagoon along the Queensland coast.",
                label: {lat: -17.5, lng: 147.5},
                area: around({lat: -17.5, lng: 147.5}, 3.5, 1.9),
                classes: ["marine", "coast"]
            },
            {
                id: "top-end-wetlands",
                name: "Top End wetlands",
                habitat: "Kakadu's flood plains and billabongs, transformed by each wet season.",
                label: {lat: -13.4, lng: 132.0},
                area: around({lat: -13.4, lng: 132.0}, 1.9, 3.5),
                classes: ["wetland"]
            },
            {
                id: "southeast-cities",
                name: "South-east farmland & cities",
                habitat: "The settled corner: paddocks, suburbs and the bush blocks between them.",
                label: {lat: -36.0, lng: 144.0},
                area: around({lat: -36.0, lng: 144.0}, 2.0, 3.0),
                classes: ["urban", "grassland", "cold"]
            }
        ]
    },
    {
        slug: "brazil",
        description: "Brazil holds three of the world's great wildlife systems at once: Amazon rainforest in the north, the Cerrado savanna through the middle, and the Pantanal's seasonal wetland in the south-west — plus an Atlantic coast and the cities on it.",
        source: {kind: "country", names: ["Brazil"], mainlandPoints: 70, maxIslands: 2},
        defaultZoneId: "coastal-cities",
        labelHalfWidth: 4.4,
        labelHalfHeight: 1.2,
        zones: [
            {
                id: "amazon",
                name: "Amazon rainforest",
                habitat: "Terra firme and várzea forest across the basin — the densest canopy life on the continent.",
                label: {lat: -3.5, lng: -62.5},
                area: around({lat: -3.5, lng: -62.5}, 4.0, 7.0),
                classes: ["forest"]
            },
            {
                id: "cerrado",
                name: "Cerrado savanna",
                habitat: "Twisted savanna woodland and grassland across the central plateau.",
                label: {lat: -14.5, lng: -47.5},
                area: around({lat: -14.5, lng: -47.5}, 3.5, 5.0),
                classes: ["grassland", "arid"]
            },
            {
                id: "pantanal",
                name: "Pantanal wetland",
                habitat: "The world's biggest freshwater wetland, which floods and drains on an annual clock.",
                label: {lat: -17.5, lng: -56.5},
                area: around({lat: -17.5, lng: -56.5}, 2.5, 2.5),
                classes: ["wetland"]
            },
            {
                id: "atlantic-water",
                name: "Atlantic coast water",
                habitat: "Warm coastal water, turtle beaches and the reef patches off the north-east.",
                label: {lat: -20.0, lng: -39.0},
                area: around({lat: -20.0, lng: -39.0}, 4.0, 1.8),
                classes: ["marine", "coast"]
            },
            {
                id: "coastal-cities",
                name: "Coastal cities & Atlantic forest edge",
                habitat: "Rio, São Paulo and the fragmented Mata Atlântica behind them.",
                label: {lat: -23.4, lng: -46.5},
                area: around({lat: -23.4, lng: -46.5}, 2.0, 2.5),
                classes: ["urban", "montane", "cold"]
            }
        ]
    },
    {
        slug: "canada",
        description: "Canada is mapped by its biomes: boreal forest across the middle, Arctic tundra and sea ice in the north, the Rockies down the west, prairie in between, Great Lakes wetlands in the south-east, and an Atlantic coast with seabird colonies and whale water.",
        source: {kind: "country", names: ["Canada"], box: {north: 75.0, south: 41.0, west: -141.0, east: -52.0}, mainlandPoints: 76, maxIslands: 6},
        defaultZoneId: "southern-cities",
        labelHalfWidth: 7.0,
        labelHalfHeight: 1.4,
        zones: [
            {
                id: "boreal-forest",
                name: "Boreal forest",
                habitat: "Spruce, muskeg and lake country running coast to coast — the continent's largest intact forest.",
                label: {lat: 55.0, lng: -93.0},
                area: around({lat: 55.0, lng: -93.0}, 3.8, 9.0),
                classes: ["forest"]
            },
            {
                id: "arctic-north",
                name: "Arctic tundra & sea ice",
                habitat: "Treeless tundra, coastal ice and the islands north of the mainland.",
                label: {lat: 68.5, lng: -98.0},
                area: around({lat: 68.5, lng: -98.0}, 3.2, 12.0),
                classes: ["cold"]
            },
            {
                id: "rockies",
                name: "Rocky Mountains",
                habitat: "Alpine ridges, avalanche chutes and montane valleys down the western cordillera.",
                label: {lat: 52.5, lng: -119.5},
                area: around({lat: 52.5, lng: -119.5}, 4.0, 3.6),
                classes: ["montane"]
            },
            {
                id: "prairies",
                name: "Prairies",
                habitat: "Grain country and remnant short-grass prairie across the middle provinces.",
                label: {lat: 50.5, lng: -106.0},
                area: around({lat: 50.5, lng: -106.0}, 2.0, 4.6),
                classes: ["grassland", "arid"]
            },
            {
                id: "great-lakes",
                name: "Great Lakes & wetlands",
                habitat: "Marsh, beaver pond and shoreline wetland through the southern lake country.",
                label: {lat: 46.5, lng: -82.0},
                area: around({lat: 46.5, lng: -82.0}, 2.2, 4.5),
                classes: ["wetland"]
            },
            {
                id: "atlantic-coast",
                name: "Atlantic coast & whale water",
                habitat: "Seabird cliffs, cold shelf water and the St Lawrence estuary the belugas use.",
                label: {lat: 48.5, lng: -60.0},
                area: around({lat: 48.5, lng: -60.0}, 2.8, 4.0),
                classes: ["coast", "marine"]
            },
            {
                id: "southern-cities",
                name: "Southern cities & suburbs",
                habitat: "Toronto, Montreal and the ravine and garden habitat that comes with them.",
                label: {lat: 44.0, lng: -76.5},
                area: around({lat: 44.0, lng: -76.5}, 1.5, 3.4),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "united-states",
        description: "The lower 48 divide cleanly for wildlife: eastern hardwood forest, the Great Plains through the middle, the Rockies down the west, Gulf and Everglades wetlands in the south-east, cold Pacific water offshore, and the metro corridors where raccoons and hawks have adapted.",
        source: {kind: "country", names: ["United States of America"], box: {north: 49.5, south: 24.4, west: -125.0, east: -66.5}, mainlandPoints: 70, maxIslands: 3},
        defaultZoneId: "metro-corridor",
        labelHalfWidth: 4.6,
        labelHalfHeight: 1.1,
        zones: [
            {
                id: "eastern-woodlands",
                name: "Eastern woodlands",
                habitat: "Oak, hickory and second-growth forest from the Appalachians to the coastal plain.",
                label: {lat: 38.0, lng: -80.5},
                area: around({lat: 38.0, lng: -80.5}, 3.4, 4.0),
                classes: ["forest"]
            },
            {
                id: "great-plains",
                name: "Great Plains",
                habitat: "Short and tall-grass prairie, wheat country and the remnant bison range in it.",
                label: {lat: 42.0, lng: -100.0},
                area: around({lat: 42.0, lng: -100.0}, 3.6, 4.0),
                classes: ["grassland", "arid"]
            },
            {
                id: "rockies",
                name: "Rocky Mountains & the interior west",
                habitat: "Alpine ridges, sage basins and canyon country through the western states.",
                label: {lat: 40.0, lng: -110.0},
                area: around({lat: 40.0, lng: -110.0}, 3.8, 3.0),
                classes: ["montane", "cold"]
            },
            {
                id: "gulf-wetlands",
                name: "Gulf coast & Everglades wetlands",
                habitat: "Cypress swamp, sawgrass and bayou across the warm south-east.",
                label: {lat: 29.6, lng: -84.5},
                area: around({lat: 29.6, lng: -84.5}, 2.2, 5.0),
                classes: ["wetland", "coast"]
            },
            {
                id: "pacific-water",
                name: "Pacific coast water",
                habitat: "Cold upwelling, kelp forest and the migration lane running along the west coast.",
                label: {lat: 36.5, lng: -122.5},
                area: around({lat: 36.5, lng: -122.5}, 3.4, 1.4),
                classes: ["marine"]
            },
            {
                id: "metro-corridor",
                name: "Cities, suburbs & parks",
                habitat: "The north-east corridor and every green strip in it — the country's most-watched wildlife.",
                label: {lat: 41.4, lng: -74.5},
                area: around({lat: 41.4, lng: -74.5}, 1.5, 2.4),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "thailand",
        description: "Thailand runs from montane forest in the north to reef in the south. The zones below follow that line: northern hill forest, the central rice plains, the Chao Phraya's wetlands, mangrove along the gulf, Andaman reefs on the west coast, and Bangkok itself.",
        source: {kind: "country", names: ["Thailand"], mainlandPoints: 62, maxIslands: 3},
        defaultZoneId: "bangkok",
        labelHalfWidth: 1.5,
        labelHalfHeight: 0.4,
        zones: [
            {
                id: "northern-forests",
                name: "Northern hill forest",
                habitat: "Evergreen and teak forest over the northern ranges, cooler and wetter than the plains.",
                label: {lat: 18.7, lng: 99.2},
                area: around({lat: 18.7, lng: 99.2}, 1.4, 1.3),
                classes: ["forest", "montane"]
            },
            {
                id: "central-plains",
                name: "Central rice plains",
                habitat: "Open paddy country and field edges across the middle of the country.",
                label: {lat: 16.4, lng: 100.3},
                area: around({lat: 16.4, lng: 100.3}, 1.0, 1.2),
                classes: ["grassland", "arid"]
            },
            {
                id: "chao-phraya-wetlands",
                name: "Chao Phraya wetlands",
                habitat: "Canals, freshwater marsh and the delta's fish-rich water.",
                label: {lat: 13.3, lng: 100.4},
                area: around({lat: 13.3, lng: 100.4}, 0.75, 0.85),
                classes: ["wetland"]
            },
            {
                id: "gulf-mangroves",
                name: "Gulf mangrove coast",
                habitat: "Tidal mangrove and mudflat down the gulf shoreline.",
                label: {lat: 11.4, lng: 99.6},
                area: around({lat: 11.4, lng: 99.6}, 1.0, 0.7),
                classes: ["coast"]
            },
            {
                id: "andaman-reefs",
                name: "Andaman Sea reefs",
                habitat: "Limestone islands and coral walls off the west coast — Thailand's clear water.",
                label: {lat: 8.4, lng: 98.2},
                area: around({lat: 8.4, lng: 98.2}, 1.2, 0.85),
                classes: ["marine"]
            },
            {
                id: "bangkok",
                name: "Bangkok, temples & towns",
                habitat: "Temple grounds, klongs and market streets, which hold more wildlife than they look like they do.",
                label: {lat: 14.6, lng: 101.8},
                area: around({lat: 14.6, lng: 101.8}, 0.85, 1.0),
                classes: ["urban", "cold"]
            }
        ]
    },
    {
        slug: "mexico",
        description: "Mexico stacks deserts, cloud forest and reef into one country: Sonoran desert in the north, Yucatán jungle in the south-east, Sierra Madre cloud forest above it, highland lakes in the centre, Caribbean reef offshore, and Mexico City's own resident wildlife.",
        source: {kind: "country", names: ["Mexico"], mainlandPoints: 66, maxIslands: 3},
        defaultZoneId: "mexico-city",
        labelHalfWidth: 2.4,
        labelHalfHeight: 0.65,
        zones: [
            {
                id: "sonoran-desert",
                name: "Sonoran & Chihuahuan desert",
                habitat: "Cactus desert and dry sierra across the northern states.",
                label: {lat: 29.3, lng: -110.8},
                area: around({lat: 29.3, lng: -110.8}, 2.2, 2.5),
                classes: ["arid"]
            },
            {
                id: "yucatan-jungle",
                name: "Yucatán jungle & cenotes",
                habitat: "Flat limestone forest, ruins and cenote water in the south-east.",
                label: {lat: 19.2, lng: -89.6},
                area: around({lat: 19.2, lng: -89.6}, 1.7, 1.9),
                classes: ["forest"]
            },
            {
                id: "sierra-madre",
                name: "Sierra Madre cloud forest",
                habitat: "Wet oak and pine cloud forest on the southern ranges — quetzal country.",
                label: {lat: 17.0, lng: -96.6},
                area: around({lat: 17.0, lng: -96.6}, 1.2, 1.6),
                classes: ["montane"]
            },
            {
                id: "central-lakes",
                name: "Central highland lakes",
                habitat: "Volcanic lakes and canals on the central plateau, including the axolotl's last water.",
                label: {lat: 20.6, lng: -102.0},
                area: around({lat: 20.6, lng: -102.0}, 1.4, 1.8),
                classes: ["wetland"]
            },
            {
                id: "caribbean-water",
                name: "Caribbean reef",
                habitat: "The Mesoamerican reef running south from Cancún — turtle and reef-fish water.",
                label: {lat: 20.6, lng: -86.4},
                area: around({lat: 20.6, lng: -86.4}, 1.6, 0.85),
                classes: ["marine", "coast"]
            },
            {
                id: "monarch-country",
                name: "Monarch country & open range",
                habitat: "Grazing land and the fir stands the monarchs overwinter in.",
                label: {lat: 23.8, lng: -99.5},
                area: around({lat: 23.8, lng: -99.5}, 1.8, 1.8),
                classes: ["grassland"]
            },
            {
                id: "mexico-city",
                name: "Mexico City & town edges",
                habitat: "Plazas, park trees and market streets across the valley of Mexico.",
                label: {lat: 19.3, lng: -99.4},
                area: around({lat: 19.3, lng: -99.4}, 0.9, 1.1),
                classes: ["urban", "cold"]
            }
        ]
    },
    {
        slug: "peru",
        description: "Peru is three countries in one: Amazon rainforest in the east, the Andes down the spine, and a desert coast on cold Pacific water. The zones below follow that split, plus the flooded forest of Pacaya-Samiria and the cities on the coast.",
        source: {kind: "country", names: ["Peru"], mainlandPoints: 60, maxIslands: 2},
        defaultZoneId: "coastal-cities",
        labelHalfWidth: 2.2,
        labelHalfHeight: 0.6,
        zones: [
            {
                id: "amazon",
                name: "Amazon rainforest",
                habitat: "Lowland rainforest east of the Andes, with clay licks and oxbow lakes through it.",
                label: {lat: -7.0, lng: -74.8},
                area: around({lat: -7.0, lng: -74.8}, 2.8, 2.8),
                classes: ["forest"]
            },
            {
                id: "andes",
                name: "Andean highlands",
                habitat: "Puna grassland, cloud forest edge and the 4,000m passes between them.",
                label: {lat: -13.2, lng: -72.2},
                area: around({lat: -13.2, lng: -72.2}, 2.4, 2.0),
                classes: ["montane", "cold"]
            },
            {
                id: "pacaya-wetlands",
                name: "Pacaya-Samiria flooded forest",
                habitat: "Seasonally flooded forest and blackwater channels in the northern Amazon.",
                label: {lat: -4.4, lng: -73.6},
                area: around({lat: -4.4, lng: -73.6}, 1.2, 1.4),
                classes: ["wetland"]
            },
            {
                id: "pampas-savanna",
                name: "Madre de Dios savanna",
                habitat: "Open pampas pockets inside the forest, worked by anteaters and open-country birds.",
                label: {lat: -11.8, lng: -69.9},
                area: around({lat: -11.8, lng: -69.9}, 1.4, 1.2),
                classes: ["grassland", "arid"]
            },
            {
                id: "humboldt-water",
                name: "Humboldt current water",
                habitat: "Cold, plankton-rich water off the desert coast — seabird and marine mammal territory.",
                label: {lat: -15.0, lng: -76.4},
                area: around({lat: -15.0, lng: -76.4}, 2.2, 1.1),
                classes: ["marine", "coast"]
            },
            {
                id: "coastal-cities",
                name: "Lima & the coastal strip",
                habitat: "Desert cities, irrigated valleys and the parks that hold their wildlife.",
                label: {lat: -11.9, lng: -77.1},
                area: around({lat: -11.9, lng: -77.1}, 0.85, 0.85),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "kenya",
        description: "Kenya sorts by altitude and rainfall: short-grass plains in the south-west, hot thorn bush through Samburu and the north, alkaline lakes down the Rift Valley, montane forest on the central highlands, and the towns and farmland where the everyday species live.",
        source: {kind: "country", names: ["Kenya"], mainlandPoints: 56, maxIslands: 0},
        defaultZoneId: "mara-plains",
        labelHalfWidth: 1.3,
        labelHalfHeight: 0.4,
        zones: [
            {
                id: "mara-plains",
                name: "Maasai Mara & southern plains",
                habitat: "Short-grass savanna and acacia country carrying the migration herds and their predators.",
                label: {lat: -1.75, lng: 35.05},
                area: around({lat: -1.75, lng: 35.05}, 1.1, 1.0),
                classes: ["grassland"]
            },
            {
                id: "northern-drylands",
                name: "Samburu & the northern drylands",
                habitat: "Thorn bush, lava rock and dry riverbeds north of the highlands — gerenuk and dry-country specialists.",
                label: {lat: 1.9, lng: 37.9},
                area: around({lat: 1.9, lng: 37.9}, 1.5, 1.6),
                classes: ["arid"]
            },
            {
                id: "rift-lakes",
                name: "Rift Valley lakes",
                habitat: "Alkaline and freshwater lakes down the Rift — flamingo flats, hippo pools and waterbird cover.",
                label: {lat: 0.45, lng: 35.9},
                area: around({lat: 0.45, lng: 35.9}, 1.0, 0.55),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "highland-forest",
                name: "Aberdares & Mount Kenya forest",
                habitat: "Montane forest, bamboo belt and moorland on the central highlands.",
                label: {lat: -0.4, lng: 37.4},
                area: around({lat: -0.4, lng: 37.4}, 0.85, 0.7),
                classes: ["forest", "montane", "cold"]
            },
            {
                id: "nairobi-farmland",
                name: "Nairobi, towns & farmland",
                habitat: "City edges, smallholdings and lodge gardens — where the commensal species actually live.",
                label: {lat: -2.6, lng: 37.9},
                area: around({lat: -2.6, lng: 37.9}, 0.8, 0.8),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "madagascar",
        description: "Madagascar's wildlife changes completely from east to west: rainforest down the eastern escarpment, dry deciduous forest on the west, spiny forest in the arid south, lakes and marsh inland, and whale water off the north-east coast.",
        source: {kind: "country", names: ["Madagascar"], mainlandPoints: 56, maxIslands: 2},
        defaultZoneId: "antananarivo",
        labelHalfWidth: 1.5,
        labelHalfHeight: 0.45,
        zones: [
            {
                id: "eastern-rainforest",
                name: "Eastern rainforest",
                habitat: "Wet escarpment forest from Masoala to Ranomafana — the island's lemur strongholds.",
                label: {lat: -18.9, lng: 48.8},
                area: around({lat: -18.9, lng: 48.8}, 3.0, 0.85),
                classes: ["forest"]
            },
            {
                id: "spiny-forest",
                name: "Southern spiny forest",
                habitat: "Octopus trees and drought scrub in the arid south, unlike anything else on earth.",
                label: {lat: -24.0, lng: 45.2},
                area: around({lat: -24.0, lng: 45.2}, 1.4, 1.5),
                classes: ["arid"]
            },
            {
                id: "western-dry",
                name: "Western dry forest & grassland",
                habitat: "Deciduous forest, baobab country and burnt grassland on the western plains.",
                label: {lat: -20.2, lng: 44.4},
                area: around({lat: -20.2, lng: 44.4}, 1.9, 0.9),
                classes: ["grassland"]
            },
            {
                id: "inland-lakes",
                name: "Inland lakes & marsh",
                habitat: "Lake Alaotra and the marsh systems that hold the island's freshwater birds.",
                label: {lat: -16.6, lng: 46.9},
                area: around({lat: -16.6, lng: 46.9}, 1.1, 1.1),
                classes: ["wetland"]
            },
            {
                id: "nosy-be-water",
                name: "North-west coast & whale water",
                habitat: "Nosy Be's reefs and the channel humpbacks pass through between July and September.",
                label: {lat: -14.2, lng: 48.4},
                area: around({lat: -14.2, lng: 48.4}, 1.1, 1.1),
                classes: ["marine", "coast"]
            },
            {
                id: "antananarivo",
                name: "Antananarivo & highland towns",
                habitat: "Terraced hills, rice paddy and the capital's own rooftops.",
                label: {lat: -19.4, lng: 46.7},
                area: around({lat: -19.4, lng: 46.7}, 0.85, 0.65),
                classes: ["urban", "montane", "cold"]
            }
        ]
    },
    {
        slug: "sri-lanka",
        description: "Sri Lanka packs a leopard-holding dry zone, a cloud-forest hill country, tank wetlands and blue whale water into an island you can cross in a day. The zones below follow that split.",
        source: {kind: "country", names: ["Sri Lanka"], mainlandPoints: 48, maxIslands: 2},
        defaultZoneId: "colombo",
        labelHalfWidth: 0.55,
        labelHalfHeight: 0.16,
        zones: [
            {
                id: "central-highlands",
                name: "Central highlands & cloud forest",
                habitat: "Horton Plains, tea country and the wet montane forest above it.",
                label: {lat: 6.85, lng: 80.75},
                area: around({lat: 6.85, lng: 80.75}, 0.42, 0.32),
                classes: ["forest", "montane", "cold"]
            },
            {
                id: "dry-zone",
                name: "Dry zone — Yala & Wilpattu",
                habitat: "Thorn scrub, open park country and rock outcrops holding leopard and elephant.",
                label: {lat: 7.95, lng: 81.25},
                area: around({lat: 7.95, lng: 81.25}, 0.65, 0.45),
                classes: ["grassland", "arid"]
            },
            {
                id: "tank-wetlands",
                name: "Ancient tanks & wetlands",
                habitat: "Reservoirs built two thousand years ago, now the island's best waterbird habitat.",
                label: {lat: 8.35, lng: 80.35},
                area: around({lat: 8.35, lng: 80.35}, 0.42, 0.42),
                classes: ["wetland"]
            },
            {
                id: "south-coast-water",
                name: "South coast & whale water",
                habitat: "The shelf edge off Mirissa, where blue whales pass close to shore.",
                label: {lat: 5.95, lng: 80.55},
                area: around({lat: 5.95, lng: 80.55}, 0.3, 0.65),
                classes: ["marine", "coast"]
            },
            {
                id: "colombo",
                name: "Colombo, temples & home gardens",
                habitat: "The wet-zone towns and their layered home gardens, full of everyday birds and reptiles.",
                label: {lat: 6.95, lng: 79.95},
                area: around({lat: 6.95, lng: 79.95}, 0.38, 0.25),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "ecuador",
        description: "Ecuador puts Amazon rainforest, high Andes, a Pacific coast and the Galápagos inside one small country. The zones below cover all four, including the islands 900km offshore.",
        source: {kind: "country", names: ["Ecuador"], box: {north: 2.2, south: -5.2, west: -92.2, east: -75.2}, mainlandPoints: 54, maxIslands: 6, minIslandRatio: 0.002},
        defaultZoneId: "quito-guayaquil",
        labelHalfWidth: 1.6,
        labelHalfHeight: 0.35,
        zones: [
            {
                id: "galapagos",
                name: "Galápagos islands",
                habitat: "Lava, cactus scrub and the shoreline where the archipelago's endemics live.",
                label: {lat: -0.55, lng: -90.6},
                area: around({lat: -0.55, lng: -90.6}, 0.75, 0.85),
                classes: ["arid", "coast"]
            },
            {
                id: "galapagos-water",
                name: "Galápagos & Pacific water",
                habitat: "Cold, nutrient-rich current around the islands and along the mainland shelf.",
                label: {lat: 0.75, lng: -89.6},
                area: around({lat: 0.75, lng: -89.6}, 0.85, 0.9),
                classes: ["marine"]
            },
            {
                id: "andes",
                name: "Andean volcanoes & páramo",
                habitat: "The avenue of volcanoes and the wet páramo grassland between them.",
                label: {lat: -1.4, lng: -78.6},
                area: around({lat: -1.4, lng: -78.6}, 1.6, 0.6),
                classes: ["montane", "cold"]
            },
            {
                id: "amazon",
                name: "Amazon lowlands — Yasuní",
                habitat: "Some of the most species-dense rainforest on the planet, east of the Andes.",
                label: {lat: -1.4, lng: -76.4},
                area: around({lat: -1.4, lng: -76.4}, 1.8, 0.95),
                classes: ["forest"]
            },
            {
                id: "coastal-lowlands",
                name: "Coastal lowlands & mangrove",
                habitat: "River deltas, mangrove and wet lowland forest between the Andes and the sea.",
                label: {lat: -0.6, lng: -79.7},
                area: around({lat: -0.6, lng: -79.7}, 1.1, 0.65),
                classes: ["wetland"]
            },
            {
                id: "quito-guayaquil",
                name: "Quito, Guayaquil & town edges",
                habitat: "Highland and coastal cities, their parks and the farmland around them.",
                label: {lat: -3.1, lng: -79.4},
                area: around({lat: -3.1, lng: -79.4}, 0.7, 0.7),
                classes: ["urban", "grassland"]
            }
        ]
    },
    {
        slug: "costa-rica",
        description: "Costa Rica fits a dozen life zones into a country the size of Denmark. The zones below are the ones a wildlife trip actually uses: Caribbean lowland rainforest, Monteverde's cloud forest, Guanacaste's dry forest, the Tortuguero canals and the Pacific reef.",
        source: {kind: "country", names: ["Costa Rica"], mainlandPoints: 50, maxIslands: 2},
        defaultZoneId: "san-jose",
        labelHalfWidth: 0.5,
        labelHalfHeight: 0.13,
        zones: [
            {
                id: "caribbean-lowlands",
                name: "Caribbean lowland rainforest",
                habitat: "Hot, wet lowland forest on the Atlantic slope — the country's densest canopy life.",
                label: {lat: 10.15, lng: -83.5},
                area: around({lat: 10.15, lng: -83.5}, 0.45, 0.4),
                classes: ["forest"]
            },
            {
                id: "monteverde",
                name: "Monteverde cloud forest",
                habitat: "Wind-blown cloud forest on the continental divide, wet all year.",
                label: {lat: 10.3, lng: -84.95},
                area: around({lat: 10.3, lng: -84.95}, 0.32, 0.32),
                classes: ["montane", "cold"]
            },
            {
                id: "guanacaste-dry",
                name: "Guanacaste dry forest",
                habitat: "Deciduous forest and open pasture in the north-west, which drops its leaves in the dry season.",
                label: {lat: 10.75, lng: -85.5},
                area: around({lat: 10.75, lng: -85.5}, 0.35, 0.4),
                classes: ["arid", "grassland"]
            },
            {
                id: "tortuguero",
                name: "Tortuguero canals & turtle beach",
                habitat: "Freshwater canals behind a nesting beach, worked by boat.",
                label: {lat: 10.72, lng: -83.6},
                area: around({lat: 10.72, lng: -83.6}, 0.28, 0.32),
                classes: ["wetland", "coast"]
            },
            {
                id: "pacific-water",
                name: "Pacific coast water",
                habitat: "Warm gulf water, rocky points and the reef patches along the southern Pacific coast.",
                label: {lat: 9.15, lng: -84.6},
                area: around({lat: 9.15, lng: -84.6}, 0.45, 0.7),
                classes: ["marine"]
            },
            {
                id: "san-jose",
                name: "San José & the central valley",
                habitat: "Coffee farms, town gardens and the valley's built-up middle.",
                label: {lat: 9.85, lng: -84.15},
                area: around({lat: 9.85, lng: -84.15}, 0.28, 0.28),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "norway",
        description: "Norway is a coast with a country behind it: seabird islands and whale water in the north, Finnmark's tundra above the tree line, boreal forest and lake country inland, fjord mountains down the west, and the farmland and towns of the south-east.",
        source: {kind: "country", names: ["Norway"], box: {north: 71.5, south: 57.5, west: 4.0, east: 31.5}, mainlandPoints: 72, maxIslands: 6},
        defaultZoneId: "southern-towns",
        labelHalfWidth: 2.0,
        labelHalfHeight: 0.32,
        zones: [
            {
                id: "lofoten-coast",
                name: "Lofoten & the seabird coast",
                habitat: "Steep island cliffs and skerries holding puffin, guillemot and tern colonies.",
                label: {lat: 68.2, lng: 14.5},
                area: around({lat: 68.2, lng: 14.5}, 0.95, 1.6),
                classes: ["coast"]
            },
            {
                id: "barents-water",
                name: "Barents & Norwegian Sea",
                habitat: "Cold shelf water off the north coast, where the whales and orca follow the herring.",
                label: {lat: 70.7, lng: 21.5},
                area: around({lat: 70.7, lng: 21.5}, 0.6, 3.0),
                classes: ["marine"]
            },
            {
                id: "finnmark-tundra",
                name: "Finnmark tundra",
                habitat: "Open tundra and reindeer pasture above the tree line in the far north-east.",
                label: {lat: 69.4, lng: 25.8},
                area: around({lat: 69.4, lng: 25.8}, 0.85, 2.4),
                classes: ["cold"]
            },
            {
                id: "boreal-forest",
                name: "Boreal forest",
                habitat: "Pine and spruce forest across the inland east, with lynx and pine marten in it.",
                label: {lat: 62.0, lng: 11.8},
                area: around({lat: 62.0, lng: 11.8}, 1.5, 1.5),
                classes: ["forest"]
            },
            {
                id: "fjord-mountains",
                name: "Fjord mountains",
                habitat: "Plateau and peak country between the western fjords, snow-held into summer.",
                label: {lat: 61.4, lng: 7.2},
                area: around({lat: 61.4, lng: 7.2}, 1.3, 1.3),
                classes: ["montane"]
            },
            {
                id: "inland-lakes",
                name: "Inland lakes & marsh",
                habitat: "Bog, lake and river systems through the central valleys.",
                label: {lat: 64.4, lng: 13.8},
                area: around({lat: 64.4, lng: 13.8}, 1.2, 1.5),
                classes: ["wetland"]
            },
            {
                id: "farmland-south",
                name: "Southern farmland",
                habitat: "Grazed lowland and hedgerow country around the Oslofjord and the south coast.",
                label: {lat: 58.6, lng: 8.3},
                area: around({lat: 58.6, lng: 8.3}, 0.5, 1.2),
                classes: ["grassland", "arid"]
            },
            {
                id: "southern-towns",
                name: "Oslo, towns & gardens",
                habitat: "City parks, allotments and the suburban edge where the adaptable species live.",
                label: {lat: 59.7, lng: 10.4},
                area: around({lat: 59.7, lng: 10.4}, 0.55, 0.9),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "south-africa",
        description: "South Africa's wildlife splits between the bushveld of the north-east, the Kalahari's red dunes in the west, the forest and fynbos of the southern Cape, and the cities in between.",
        source: {kind: "country", names: ["South Africa"], box: {north: -21.5, south: -35.2, west: 16.0, east: 33.2}, mainlandPoints: 56, maxIslands: 0},
        defaultZoneId: "cities-and-towns",
        labelHalfWidth: 1.6,
        labelHalfHeight: 0.4,
        zones: [
            {
                id: "kruger-bushveld",
                name: "Kruger & the lowveld bushveld",
                habitat: "Mopane and acacia bushveld in the north-east — the country's classic big-game ground.",
                label: {lat: -24.2, lng: 31.2},
                area: around({lat: -24.2, lng: 31.2}, 1.4, 0.85),
                classes: ["grassland"]
            },
            {
                id: "kalahari",
                name: "Kalahari & the arid west",
                habitat: "Red dunes, dry riverbeds and camelthorn in the Northern Cape.",
                label: {lat: -27.6, lng: 21.4},
                area: around({lat: -27.6, lng: 21.4}, 1.8, 2.0),
                classes: ["arid"]
            },
            {
                id: "cape-forest",
                name: "Cape forest & fynbos",
                habitat: "Knysna's afromontane forest and the fynbos belt along the southern coast.",
                label: {lat: -33.6, lng: 23.4},
                area: around({lat: -33.6, lng: 23.4}, 0.85, 1.6),
                classes: ["forest", "montane", "cold", "wetland", "marine", "coast"]
            },
            {
                id: "cities-and-towns",
                name: "Cities, farms & town edges",
                habitat: "Johannesburg, the Highveld farms and the suburbs that back onto them.",
                label: {lat: -29.4, lng: 27.6},
                area: around({lat: -29.4, lng: 27.6}, 1.3, 1.8),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "tanzania",
        description: "Tanzania holds the southern half of the Serengeti system plus a great deal more: Maasai steppe drylands, the Eastern Arc's forest islands, the Rufiji's flood plains, and the towns you stage a safari from.",
        source: {kind: "country", names: ["Tanzania", "United Republic of Tanzania"], mainlandPoints: 56, maxIslands: 3},
        defaultZoneId: "towns-and-camps",
        labelHalfWidth: 1.4,
        labelHalfHeight: 0.4,
        zones: [
            {
                id: "serengeti",
                name: "Serengeti & Ngorongoro plains",
                habitat: "Short-grass plains and crater floor carrying the migration and its predators.",
                label: {lat: -2.9, lng: 34.6},
                area: around({lat: -2.9, lng: 34.6}, 1.2, 1.2),
                classes: ["grassland"]
            },
            {
                id: "masai-steppe",
                name: "Maasai steppe drylands",
                habitat: "Acacia thorn and open steppe east of the rift, grazed by cattle and wildlife together.",
                label: {lat: -4.9, lng: 36.7},
                area: around({lat: -4.9, lng: 36.7}, 1.1, 1.1),
                classes: ["arid"]
            },
            {
                id: "eastern-arc",
                name: "Eastern Arc forest",
                habitat: "Ancient forest islands on the Udzungwa and Uluguru mountains, full of endemics.",
                label: {lat: -7.7, lng: 36.2},
                area: around({lat: -7.7, lng: 36.2}, 1.0, 1.0),
                classes: ["forest", "montane", "cold"]
            },
            {
                id: "rufiji-wetlands",
                name: "Rufiji rivers & flood plains",
                habitat: "Nyerere's river channels, sandbanks and lakes — hippo and waterbird country.",
                label: {lat: -8.4, lng: 38.6},
                area: around({lat: -8.4, lng: 38.6}, 1.0, 1.0),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "towns-and-camps",
                name: "Arusha, camps & town edges",
                habitat: "Safari towns, lodge gardens and the roadside strip between parks.",
                label: {lat: -5.6, lng: 38.9},
                area: around({lat: -5.6, lng: 38.9}, 0.95, 0.75),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "united-kingdom",
        description: "British wildlife works in small, well-watched habitats: Highland glens and moor in the north, seabird cliffs on the northern coast, broadleaf woodland through the middle, farmland everywhere, fen and broads in the east, and cities that have become genuinely good habitat.",
        source: {kind: "country", names: ["United Kingdom"], box: {north: 61.0, south: 49.8, west: -8.5, east: 2.0}, mainlandPoints: 68, maxIslands: 6},
        defaultZoneId: "cities-and-gardens",
        labelHalfWidth: 1.2,
        labelHalfHeight: 0.24,
        zones: [
            {
                id: "highlands",
                name: "Scottish Highlands",
                habitat: "Glens, heather moor and remnant Caledonian pine in the north.",
                label: {lat: 57.3, lng: -4.6},
                area: around({lat: 57.3, lng: -4.6}, 0.85, 1.2),
                classes: ["montane", "cold"]
            },
            {
                id: "seabird-coast",
                name: "Northern seabird coast",
                habitat: "Orkney, Shetland and the cliff colonies of the far north.",
                label: {lat: 58.9, lng: -3.2},
                area: around({lat: 58.9, lng: -3.2}, 0.5, 1.4),
                classes: ["coast", "marine"]
            },
            {
                id: "woodlands",
                name: "Broadleaf woodland",
                habitat: "Oak and beech woodland through the Welsh borders and the west.",
                label: {lat: 52.3, lng: -2.7},
                area: around({lat: 52.3, lng: -2.7}, 0.8, 0.85),
                classes: ["forest"]
            },
            {
                id: "farmland",
                name: "Farmland & hedgerows",
                habitat: "Arable East Anglia and the Midlands — barn owl and buzzard country.",
                label: {lat: 53.4, lng: -0.6},
                area: around({lat: 53.4, lng: -0.6}, 0.75, 0.75),
                classes: ["grassland", "arid"]
            },
            {
                id: "fens-and-broads",
                name: "Fens, broads & rivers",
                habitat: "Reed bed, dyke and slow river across the eastern lowlands.",
                label: {lat: 52.55, lng: 0.95},
                area: around({lat: 52.55, lng: 0.95}, 0.5, 0.55),
                classes: ["wetland"]
            },
            {
                id: "cities-and-gardens",
                name: "Cities, parks & gardens",
                habitat: "London and the southern conurbations, where foxes and hedgehogs do better than in the countryside.",
                label: {lat: 51.4, lng: -0.7},
                area: around({lat: 51.4, lng: -0.7}, 0.5, 0.85),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "spain",
        description: "Spain is drier and wilder than most of Europe: Pyrenean forest along the French border, the meseta's farmland in the middle, Andalusian scrub in the south, Doñana's marshes on the Atlantic corner, and Mediterranean water on the east coast.",
        source: {kind: "country", names: ["Spain"], box: {north: 43.9, south: 35.9, west: -9.4, east: 3.4}, mainlandPoints: 60, maxIslands: 3},
        defaultZoneId: "cities-and-plazas",
        labelHalfWidth: 1.2,
        labelHalfHeight: 0.28,
        zones: [
            {
                id: "pyrenees",
                name: "Pyrenees & northern forest",
                habitat: "Beech and fir forest rising into alpine pasture along the northern border.",
                label: {lat: 42.7, lng: -0.6},
                area: around({lat: 42.7, lng: -0.6}, 0.55, 1.4),
                classes: ["forest", "montane", "cold"]
            },
            {
                id: "meseta-farmland",
                name: "Meseta farmland & steppe",
                habitat: "Cereal plains and dehesa oak pasture across the central plateau.",
                label: {lat: 41.8, lng: -5.2},
                area: around({lat: 41.8, lng: -5.2}, 0.8, 1.3),
                classes: ["grassland"]
            },
            {
                id: "andalusian-scrub",
                name: "Andalusian scrub & sierra",
                habitat: "Mediterranean maquis and olive country — the Iberian lynx's ground.",
                label: {lat: 38.0, lng: -3.2},
                area: around({lat: 38.0, lng: -3.2}, 0.85, 1.4),
                classes: ["arid"]
            },
            {
                id: "donana",
                name: "Doñana marshes",
                habitat: "Seasonal marsh, dune and pine on the Guadalquivir delta — Europe's flamingo corner.",
                label: {lat: 37.1, lng: -6.4},
                area: around({lat: 37.1, lng: -6.4}, 0.55, 0.7),
                classes: ["wetland"]
            },
            {
                id: "mediterranean",
                name: "Mediterranean water",
                habitat: "Warm coastal water and posidonia meadow off the eastern seaboard.",
                label: {lat: 39.2, lng: 1.0},
                area: around({lat: 39.2, lng: 1.0}, 1.3, 0.9),
                classes: ["marine", "coast"]
            },
            {
                id: "cities-and-plazas",
                name: "Cities, plazas & village roofs",
                habitat: "Madrid's parks and the village rooftops where swifts and storks nest.",
                label: {lat: 40.2, lng: -3.4},
                area: around({lat: 40.2, lng: -3.4}, 0.55, 0.75),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "jamaica",
        description: "Jamaica's wildlife is coastal and mountainous at once: reef along the north shore, manatee and mangrove on the south, the Black River morass in the west, limestone Cockpit Country inland, and the Blue Mountains above Kingston.",
        source: {kind: "country", names: ["Jamaica"], mainlandPoints: 44, maxIslands: 2},
        defaultZoneId: "kingston",
        labelHalfWidth: 0.4,
        labelHalfHeight: 0.06,
        zones: [
            {
                id: "blue-mountains",
                name: "Blue Mountains",
                habitat: "Cloud-wrapped ridge forest and coffee slopes east of Kingston.",
                label: {lat: 18.1, lng: -76.5},
                area: around({lat: 18.1, lng: -76.5}, 0.12, 0.22),
                classes: ["forest", "montane", "cold"]
            },
            {
                id: "cockpit-country",
                name: "Cockpit Country",
                habitat: "Sinkhole limestone and dry hill forest in the island's roadless middle.",
                label: {lat: 18.3, lng: -77.6},
                area: around({lat: 18.3, lng: -77.6}, 0.13, 0.28),
                classes: ["grassland", "arid"]
            },
            {
                id: "black-river-morass",
                name: "Black River morass",
                habitat: "The island's biggest freshwater wetland, worked by boat for crocodiles and waterbirds.",
                label: {lat: 18.05, lng: -77.88},
                area: around({lat: 18.05, lng: -77.88}, 0.11, 0.18),
                classes: ["wetland"]
            },
            {
                id: "north-coast-reefs",
                name: "North coast reefs",
                habitat: "Fringing reef and drop-offs along the Montego Bay to Ocho Rios shore.",
                label: {lat: 18.55, lng: -77.2},
                area: around({lat: 18.55, lng: -77.2}, 0.12, 0.45),
                classes: ["marine"]
            },
            {
                id: "south-coast",
                name: "South coast & mangrove",
                habitat: "Shallow bays, mangrove and seagrass — manatee and pelican water.",
                label: {lat: 17.86, lng: -77.2},
                area: around({lat: 17.86, lng: -77.2}, 0.1, 0.35),
                classes: ["coast"]
            },
            {
                id: "kingston",
                name: "Kingston & town yards",
                habitat: "Yard trees, gullies and the city's edge against the hills.",
                label: {lat: 17.99, lng: -76.92},
                area: around({lat: 17.99, lng: -76.92}, 0.08, 0.12),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "afghanistan",
        description: "Afghanistan is a mountain country with deserts at its edges: the Hindu Kush across the middle, Nuristan's forest on the eastern slopes, northern plains along the Amu Darya, the Registan desert in the south, and Kabul in its valley.",
        source: {kind: "country", names: ["Afghanistan"], mainlandPoints: 52, maxIslands: 0},
        defaultZoneId: "kabul",
        labelHalfWidth: 1.4,
        labelHalfHeight: 0.32,
        zones: [
            {
                id: "hindu-kush",
                name: "Hindu Kush & the Wakhan",
                habitat: "High rock, glacier and summer pasture above 3,500m — snow leopard and ibex ground.",
                label: {lat: 36.2, lng: 71.2},
                area: around({lat: 36.2, lng: 71.2}, 0.85, 1.3),
                classes: ["montane", "cold"]
            },
            {
                id: "nuristan-forest",
                name: "Nuristan & Kunar forest",
                habitat: "Cedar and oak forest on the wet eastern slopes, the country's last real woodland.",
                label: {lat: 34.8, lng: 70.6},
                area: around({lat: 34.8, lng: 70.6}, 0.6, 0.8),
                classes: ["forest"]
            },
            {
                id: "northern-plains",
                name: "Northern plains & steppe",
                habitat: "Loess steppe and irrigated valley along the Amu Darya in the north.",
                label: {lat: 36.7, lng: 66.0},
                area: around({lat: 36.7, lng: 66.0}, 0.9, 1.8),
                classes: ["grassland", "wetland"]
            },
            {
                id: "registan-desert",
                name: "Registan desert",
                habitat: "Sand and gravel desert across the south, worked at dawn and dusk only.",
                label: {lat: 31.2, lng: 64.6},
                area: around({lat: 31.2, lng: 64.6}, 1.1, 2.0),
                classes: ["arid", "marine", "coast"]
            },
            {
                id: "kabul",
                name: "Kabul & valley towns",
                habitat: "Compound gardens, poplar lines and market streets in the valley towns.",
                label: {lat: 34.4, lng: 68.7},
                area: around({lat: 34.4, lng: 68.7}, 0.65, 0.85),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "israel",
        description: "Israel sits on the migration bottleneck between three continents, and its habitats stack up fast: Negev desert in the south, Galilee woodland in the north, the Hula valley's rebuilt wetland, a farmed coastal plain, and Mediterranean water offshore.",
        source: {kind: "country", names: ["Israel"], mainlandPoints: 46, maxIslands: 0},
        defaultZoneId: "cities-and-towns",
        labelHalfWidth: 0.45,
        labelHalfHeight: 0.08,
        zones: [
            {
                id: "negev",
                name: "Negev desert",
                habitat: "Rock desert, wadi and crater country across the southern half of the country.",
                label: {lat: 30.7, lng: 34.9},
                area: around({lat: 30.7, lng: 34.9}, 0.55, 0.38),
                classes: ["arid"]
            },
            {
                id: "galilee-forest",
                name: "Galilee & Carmel woodland",
                habitat: "Mediterranean oak and pine woodland on the northern hills.",
                label: {lat: 32.85, lng: 35.28},
                area: around({lat: 32.85, lng: 35.28}, 0.2, 0.18),
                classes: ["forest", "montane", "cold"]
            },
            {
                id: "hula-wetlands",
                name: "Hula valley wetlands",
                habitat: "Re-flooded marsh and fish ponds that hold hundreds of thousands of migrating birds.",
                label: {lat: 33.13, lng: 35.63},
                area: around({lat: 33.13, lng: 35.63}, 0.13, 0.13),
                classes: ["wetland"]
            },
            {
                id: "coastal-plain",
                name: "Coastal plain & farmland",
                habitat: "Citrus groves, fields and open country between the sea and the hills.",
                label: {lat: 31.75, lng: 34.8},
                area: around({lat: 31.75, lng: 34.8}, 0.4, 0.22),
                classes: ["grassland"]
            },
            {
                id: "mediterranean",
                name: "Mediterranean water",
                habitat: "Warm shelf water off the coast, with turtle nesting beaches along it.",
                label: {lat: 32.6, lng: 34.45},
                area: around({lat: 32.6, lng: 34.45}, 0.5, 0.22),
                classes: ["marine", "coast"]
            },
            {
                id: "cities-and-towns",
                name: "Tel Aviv, Jerusalem & town edges",
                habitat: "Rooftops, stone walls and park trees, worked by swifts, geckos and hedgehogs.",
                label: {lat: 31.78, lng: 35.32},
                area: around({lat: 31.78, lng: 35.32}, 0.28, 0.2),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "colombia",
        description: "Colombia has more bird species than any other country, and its geography explains why: Amazon forest in the south-east, three Andean ranges through the middle, the Llanos grassland to the east, and the Magdalena's wetlands running north to the Caribbean.",
        source: {kind: "country", names: ["Colombia"], mainlandPoints: 58, maxIslands: 2},
        defaultZoneId: "cities-and-coffee",
        labelHalfWidth: 1.6,
        labelHalfHeight: 0.42,
        zones: [
            {
                id: "amazon",
                name: "Amazon & Chocó rainforest",
                habitat: "Lowland rainforest in the south-east and the wettest forest on earth on the Pacific side.",
                label: {lat: -1.0, lng: -71.6},
                area: around({lat: -1.0, lng: -71.6}, 1.8, 2.0),
                classes: ["forest"]
            },
            {
                id: "andes",
                name: "Andean cordilleras",
                habitat: "Three mountain ranges, cloud forest and páramo above them.",
                label: {lat: 5.4, lng: -75.8},
                area: around({lat: 5.4, lng: -75.8}, 1.8, 0.8),
                classes: ["montane", "cold"]
            },
            {
                id: "llanos",
                name: "Llanos grassland",
                habitat: "Seasonally flooded savanna running east toward the Orinoco.",
                label: {lat: 4.6, lng: -71.0},
                area: around({lat: 4.6, lng: -71.0}, 1.4, 1.8),
                classes: ["grassland", "arid"]
            },
            {
                id: "magdalena-wetlands",
                name: "Magdalena wetlands & Caribbean coast",
                habitat: "River marsh, ciénagas and mangrove on the run north to the sea.",
                label: {lat: 8.7, lng: -74.6},
                area: around({lat: 8.7, lng: -74.6}, 1.2, 1.2),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "cities-and-coffee",
                name: "Cities & the coffee belt",
                habitat: "Bogotá, Medellín and the farm country on the slopes between them.",
                label: {lat: 4.7, lng: -73.5},
                area: around({lat: 4.7, lng: -73.5}, 0.7, 0.7),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "iceland",
        description: "Iceland's wildlife is a coast-and-cold story: seabird cliffs around the edge, whale water off the north and west, glacial rivers and lakes inland, tundra and ice in the highland interior, and a thin band of farmland and towns holding everything else.",
        source: {kind: "country", names: ["Iceland"], mainlandPoints: 64, maxIslands: 3},
        defaultZoneId: "farmland-towns",
        labelHalfWidth: 1.4,
        labelHalfHeight: 0.18,
        zones: [
            {
                id: "seabird-cliffs",
                name: "Seabird cliffs & shoreline",
                habitat: "Basalt cliffs, skerries and black-sand shores holding the breeding colonies and hauled-out seals.",
                label: {lat: 63.5, lng: -19.4},
                area: around({lat: 63.5, lng: -19.4}, 0.35, 3.2),
                classes: ["coast"]
            },
            {
                id: "whale-water",
                name: "Whale water — Skjálfandi & Faxaflói",
                habitat: "Cold, productive bays off the north and west coast where the whales and orca feed through summer.",
                label: {lat: 66.4, lng: -18.2},
                area: around({lat: 66.4, lng: -18.2}, 0.45, 2.4),
                classes: ["marine"]
            },
            {
                id: "highland-interior",
                name: "Highland interior & tundra",
                habitat: "Glacier margins, lava desert and open tundra in the uninhabited middle of the island.",
                label: {lat: 64.9, lng: -18.6},
                area: around({lat: 64.9, lng: -18.6}, 0.5, 2.0),
                classes: ["cold", "montane"]
            },
            {
                id: "rivers-lakes",
                name: "Glacial rivers & lakes",
                habitat: "Braided glacial rivers and Mývatn's shallow lake system, which pull in the ducks and swans.",
                label: {lat: 65.6, lng: -16.4},
                area: around({lat: 65.6, lng: -16.4}, 0.35, 1.3),
                classes: ["wetland"]
            },
            {
                id: "farmland-towns",
                name: "Farmland, gardens & towns",
                habitat: "Reykjavík, the coastal towns and the grazed lowland belt behind them.",
                label: {lat: 64.3, lng: -21.6},
                area: around({lat: 64.3, lng: -21.6}, 0.4, 1.4),
                classes: ["urban", "grassland", "forest", "arid"]
            }
        ]
    },
    {
        slug: "dubai",
        description: "Dubai's wildlife sits at the edges of the built city: the desert conservation reserve inland, Hatta's mountains on the Oman border, Ras Al Khor's flamingo lagoon in the middle of town, and Gulf water offshore.",
        source: {kind: "admin1", country: "United Arab Emirates", names: ["Dubay"], mainlandPoints: 44, maxIslands: 3},
        defaultZoneId: "city-and-parks",
        labelHalfWidth: 0.11,
        labelHalfHeight: 0.022,
        zones: [
            {
                id: "desert-reserve",
                name: "Dubai Desert Conservation Reserve",
                habitat: "Protected dune and ghaf woodland inland, where the oryx and gazelle were reintroduced.",
                label: {lat: 24.85, lng: 55.62},
                area: around({lat: 24.85, lng: 55.62}, 0.14, 0.24),
                classes: ["arid"]
            },
            {
                id: "hatta-mountains",
                name: "Hatta mountains",
                habitat: "Bare Hajar rock, wadi pools and the falcon cliffs above them.",
                label: {lat: 24.82, lng: 56.08},
                area: around({lat: 24.82, lng: 56.08}, 0.09, 0.1),
                classes: ["montane", "cold"]
            },
            {
                id: "creek-wetlands",
                name: "Ras Al Khor & the creek",
                habitat: "Tidal lagoon and mangrove in the middle of the city — the flamingo hide is on the ring road.",
                label: {lat: 25.19, lng: 55.37},
                area: around({lat: 25.19, lng: 55.37}, 0.05, 0.06),
                classes: ["wetland"]
            },
            {
                id: "gulf-water",
                name: "Gulf water & reefs",
                habitat: "Warm, shallow Gulf water with artificial reef and seagrass beds along the coast.",
                label: {lat: 25.02, lng: 54.95},
                area: around({lat: 25.02, lng: 54.95}, 0.14, 0.14),
                classes: ["marine", "coast"]
            },
            {
                id: "city-and-parks",
                name: "City, parks & villa gardens",
                habitat: "Irrigated parks, villa gardens and the mall landscaping the city's birds have taken over.",
                label: {lat: 25.27, lng: 55.2},
                area: around({lat: 25.27, lng: 55.2}, 0.07, 0.09),
                classes: ["urban", "grassland", "forest"]
            }
        ]
    },
    {
        slug: "russia",
        description: "Russia crosses eleven time zones and most of the northern biomes with them: taiga through the middle, Arctic tundra along the top, the Altai and Caucasus in the south, steppe on the Volga, and the White Sea's cold water in the north-west.",
        source: {kind: "country", names: ["Russia"], box: {north: 78.0, south: 41.0, west: 19.5, east: 179.0}, mainlandPoints: 84, maxIslands: 6},
        defaultZoneId: "western-cities",
        labelHalfWidth: 14.0,
        labelHalfHeight: 1.6,
        zones: [
            {
                id: "siberian-taiga",
                name: "Siberian taiga",
                habitat: "The largest forest on earth: larch, pine and bog running from the Urals to the Pacific.",
                label: {lat: 59.5, lng: 95.0},
                area: around({lat: 59.5, lng: 95.0}, 5.5, 22.0),
                classes: ["forest"]
            },
            {
                id: "arctic-coast",
                name: "Arctic tundra & coast",
                habitat: "Permafrost tundra and sea ice along the northern seaboard.",
                label: {lat: 71.5, lng: 105.0},
                area: around({lat: 71.5, lng: 105.0}, 2.8, 25.0),
                classes: ["cold"]
            },
            {
                id: "altai-mountains",
                name: "Altai & southern mountains",
                habitat: "Alpine ridges and larch valleys along the Mongolian border.",
                label: {lat: 50.5, lng: 88.0},
                area: around({lat: 50.5, lng: 88.0}, 2.8, 6.0),
                classes: ["montane"]
            },
            {
                id: "southern-steppe",
                name: "Southern steppe",
                habitat: "Open grassland and grain country north of the Caucasus.",
                label: {lat: 51.5, lng: 46.0},
                area: around({lat: 51.5, lng: 46.0}, 2.6, 6.0),
                classes: ["grassland", "arid"]
            },
            {
                id: "volga-wetlands",
                name: "Volga delta & wetlands",
                habitat: "Reed bed, lake and delta channel on the run down to the Caspian.",
                label: {lat: 45.8, lng: 47.5},
                area: around({lat: 45.8, lng: 47.5}, 1.7, 3.0),
                classes: ["wetland"]
            },
            {
                id: "white-sea",
                name: "White Sea & northern coast",
                habitat: "Cold northern water and rocky shore, with beluga pods working the bays.",
                label: {lat: 66.0, lng: 40.0},
                area: around({lat: 66.0, lng: 40.0}, 2.4, 6.0),
                classes: ["marine", "coast"]
            },
            {
                id: "western-cities",
                name: "Western cities & dachas",
                habitat: "Moscow, St Petersburg and the dacha belt of gardens and birch scrub around them.",
                label: {lat: 57.0, lng: 36.0},
                area: around({lat: 57.0, lng: 36.0}, 2.2, 4.5),
                classes: ["urban"]
            }
        ]
    },
    {
        slug: "pakistan",
        description: "Pakistan runs from 8,000m peaks to mangrove in about 1,500km: the Karakoram and Himalaya in the north, conifer forest below them, Punjab's irrigated farmland, Balochistan's desert, and the Indus delta on the Arabian Sea.",
        source: {kind: "country", names: ["Pakistan"], mainlandPoints: 54, maxIslands: 0},
        defaultZoneId: "cities-and-canals",
        labelHalfWidth: 1.5,
        labelHalfHeight: 0.4,
        zones: [
            {
                id: "karakoram",
                name: "Karakoram & the northern peaks",
                habitat: "Glacier, scree and summer pasture in the highest concentration of big mountains on earth.",
                label: {lat: 35.9, lng: 75.3},
                area: around({lat: 35.9, lng: 75.3}, 0.9, 1.5),
                classes: ["montane", "cold"]
            },
            {
                id: "northern-forest",
                name: "Northern conifer forest",
                habitat: "Deodar and pine forest on the Swat and Hazara slopes.",
                label: {lat: 34.6, lng: 72.4},
                area: around({lat: 34.6, lng: 72.4}, 0.75, 0.85),
                classes: ["forest"]
            },
            {
                id: "punjab-farmland",
                name: "Punjab farmland",
                habitat: "Canal-irrigated fields and shisham groves across the plains.",
                label: {lat: 31.2, lng: 73.2},
                area: around({lat: 31.2, lng: 73.2}, 1.2, 1.2),
                classes: ["grassland"]
            },
            {
                id: "balochistan-desert",
                name: "Balochistan desert",
                habitat: "Stone desert, sand and dry range across the west.",
                label: {lat: 28.0, lng: 65.8},
                area: around({lat: 28.0, lng: 65.8}, 1.9, 2.2),
                classes: ["arid"]
            },
            {
                id: "indus-wetlands",
                name: "Indus river & delta",
                habitat: "River channel, barrage lakes and the mangrove delta south of Thatta.",
                label: {lat: 26.0, lng: 68.4},
                area: around({lat: 26.0, lng: 68.4}, 1.2, 0.85),
                classes: ["wetland", "marine", "coast"]
            },
            {
                id: "cities-and-canals",
                name: "Cities, bazaars & canal towns",
                habitat: "Lahore and Karachi's rooftops, canal banks and shade trees.",
                label: {lat: 30.5, lng: 70.4},
                area: around({lat: 30.5, lng: 70.4}, 1.0, 1.0),
                classes: ["urban"]
            }
        ]
    }
];
