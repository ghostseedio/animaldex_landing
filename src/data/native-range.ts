import type {SpeciesEntry} from "@/data/species";

export type NativeRangeTier = "specific_land" | "marine" | "broad_land";

export type NativeRangeRegionKey =
    | "north_america"
    | "south_america"
    | "europe"
    | "north_africa_middle_east"
    | "sub_saharan_africa"
    | "central_asia"
    | "south_asia"
    | "southeast_asia"
    | "east_asia"
    | "australia_oceania"
    | "arctic_antarctic"
    | "domestic_global"
    | "west_java"
    | "east_java"
    | "java"
    | "bali"
    | "sumatra"
    | "borneo"
    | "scotland"
    | "northern_thailand"
    | "southern_thailand"
    | "tasmania"
    | "north_atlantic"
    | "south_atlantic"
    | "north_pacific"
    | "south_pacific"
    | "indian_ocean"
    | "southern_ocean"
    | "mediterranean"
    | "red_sea"
    | "coral_triangle"
    | "arctic_ocean"
    | "southeast_asia_coastal"
    | "australia_coastal";

export type NativeRangeDescriptor = {
    regions: NativeRangeRegionKey[];
    rangeTier: NativeRangeTier;
    usesCombinedLandAndMarineOverlays: boolean;
    labelOverride: string | null;
    habitatText: string | null;
};

export type NativeRangePresentation =
    | {kind: "hidden"}
    | {kind: "textOnly"; title: string; body: string | null}
    | {kind: "mapped"; descriptor: NativeRangeDescriptor};

type NativeRangeMapping = {
    specificLandRegions: NativeRangeRegionKey[];
    marineRegions: NativeRangeRegionKey[];
    broadLandRegions: NativeRangeRegionKey[];
    combineLandAndMarine: boolean;
    labelOverride: string | null;
};

const REGION_LABELS: Record<NativeRangeRegionKey, string> = {
    north_america: "North America",
    south_america: "South America",
    europe: "Europe",
    north_africa_middle_east: "North Africa & Middle East",
    sub_saharan_africa: "Sub-Saharan Africa",
    central_asia: "Central Asia",
    south_asia: "South Asia",
    southeast_asia: "Southeast Asia",
    east_asia: "East Asia",
    australia_oceania: "Australia & Oceania",
    arctic_antarctic: "Arctic & Antarctic",
    domestic_global: "Domesticated worldwide",
    west_java: "West Java",
    east_java: "East Java",
    java: "Java",
    bali: "Bali",
    sumatra: "Sumatra",
    borneo: "Borneo",
    scotland: "Scotland",
    northern_thailand: "Northern Thailand",
    southern_thailand: "Southern Thailand",
    tasmania: "Tasmania",
    north_atlantic: "North Atlantic",
    south_atlantic: "South Atlantic",
    north_pacific: "North Pacific",
    south_pacific: "South Pacific",
    indian_ocean: "Indian Ocean",
    southern_ocean: "Southern Ocean",
    mediterranean: "Mediterranean",
    red_sea: "Red Sea",
    coral_triangle: "Coral Triangle",
    arctic_ocean: "Arctic Ocean",
    southeast_asia_coastal: "Southeast Asia Coastal",
    australia_coastal: "Australia Coastal"
};

const REGION_TIERS: Record<NativeRangeRegionKey, NativeRangeTier> = {
    north_america: "broad_land",
    south_america: "broad_land",
    europe: "broad_land",
    north_africa_middle_east: "broad_land",
    sub_saharan_africa: "broad_land",
    central_asia: "broad_land",
    south_asia: "broad_land",
    southeast_asia: "broad_land",
    east_asia: "broad_land",
    australia_oceania: "broad_land",
    arctic_antarctic: "broad_land",
    domestic_global: "broad_land",
    west_java: "specific_land",
    east_java: "specific_land",
    java: "specific_land",
    bali: "specific_land",
    sumatra: "specific_land",
    borneo: "specific_land",
    scotland: "specific_land",
    northern_thailand: "specific_land",
    southern_thailand: "specific_land",
    tasmania: "specific_land",
    north_atlantic: "marine",
    south_atlantic: "marine",
    north_pacific: "marine",
    south_pacific: "marine",
    indian_ocean: "marine",
    southern_ocean: "marine",
    mediterranean: "marine",
    red_sea: "marine",
    coral_triangle: "marine",
    arctic_ocean: "marine",
    southeast_asia_coastal: "marine",
    australia_coastal: "marine"
};

const REGION_ACCENTS: Record<NativeRangeRegionKey, string> = {
    north_america: "rgba(34, 211, 238, 0.92)",
    south_america: "rgba(74, 222, 128, 0.92)",
    europe: "rgba(96, 165, 250, 0.92)",
    north_africa_middle_east: "rgba(251, 146, 60, 0.92)",
    sub_saharan_africa: "rgba(250, 204, 21, 0.92)",
    central_asia: "rgba(129, 140, 248, 0.92)",
    south_asia: "rgba(52, 211, 153, 0.92)",
    southeast_asia: "rgba(45, 212, 191, 0.92)",
    east_asia: "rgba(244, 114, 182, 0.88)",
    australia_oceania: "rgba(192, 132, 252, 0.88)",
    arctic_antarctic: "rgba(255, 255, 255, 0.82)",
    domestic_global: "rgba(56, 189, 248, 0.9)",
    west_java: "rgba(45, 212, 191, 0.92)",
    east_java: "rgba(45, 212, 191, 0.92)",
    java: "rgba(45, 212, 191, 0.92)",
    bali: "rgba(45, 212, 191, 0.92)",
    sumatra: "rgba(45, 212, 191, 0.92)",
    borneo: "rgba(45, 212, 191, 0.92)",
    scotland: "rgba(96, 165, 250, 0.9)",
    northern_thailand: "rgba(52, 211, 153, 0.9)",
    southern_thailand: "rgba(52, 211, 153, 0.9)",
    tasmania: "rgba(192, 132, 252, 0.9)",
    north_atlantic: "rgba(34, 211, 238, 0.85)",
    south_atlantic: "rgba(34, 211, 238, 0.85)",
    north_pacific: "rgba(129, 140, 248, 0.9)",
    south_pacific: "rgba(129, 140, 248, 0.9)",
    indian_ocean: "rgba(96, 165, 250, 0.88)",
    southern_ocean: "rgba(255, 255, 255, 0.8)",
    mediterranean: "rgba(251, 146, 60, 0.88)",
    red_sea: "rgba(248, 113, 113, 0.85)",
    coral_triangle: "rgba(244, 114, 182, 0.86)",
    arctic_ocean: "rgba(34, 211, 238, 0.7)",
    southeast_asia_coastal: "rgba(45, 212, 191, 0.82)",
    australia_coastal: "rgba(45, 212, 191, 0.82)"
};

const AVAILABLE_VECTOR_REGIONS = new Set<NativeRangeRegionKey>([
    "north_america",
    "south_america",
    "europe",
    "north_africa_middle_east",
    "sub_saharan_africa",
    "central_asia",
    "south_asia",
    "southeast_asia",
    "east_asia",
    "australia_oceania",
    "arctic_antarctic",
    "indian_ocean",
    "coral_triangle",
    "southeast_asia_coastal",
    "australia_coastal"
]);

export const DIRECTORY_NATIVE_RANGE_REGION_KEYS: NativeRangeRegionKey[] = [
    "north_america",
    "south_america",
    "europe",
    "north_africa_middle_east",
    "sub_saharan_africa",
    "central_asia",
    "south_asia",
    "southeast_asia",
    "east_asia",
    "australia_oceania",
    "arctic_antarctic"
];

const REGION_FILTER_ALIASES: Partial<Record<NativeRangeRegionKey, NativeRangeRegionKey[]>> = {
    europe: ["scotland"],
    north_africa_middle_east: ["red_sea", "mediterranean"],
    southeast_asia: [
        "west_java",
        "east_java",
        "java",
        "bali",
        "sumatra",
        "borneo",
        "northern_thailand",
        "southern_thailand",
        "southeast_asia_coastal",
        "coral_triangle"
    ],
    australia_oceania: ["tasmania", "australia_coastal", "coral_triangle"],
    arctic_antarctic: ["arctic_ocean", "southern_ocean"]
};

export const NATIVE_RANGE_WORLD_BASE_ASSET = "/images/native-range/world_base.svg";

function nativeRangeMapping({
    specific = [],
    marine = [],
    broad = [],
    combineLandAndMarine = false,
    labelOverride = null
}: {
    specific?: NativeRangeRegionKey[];
    marine?: NativeRangeRegionKey[];
    broad?: NativeRangeRegionKey[];
    combineLandAndMarine?: boolean;
    labelOverride?: string | null;
}): NativeRangeMapping {
    return {
        specificLandRegions: specific,
        marineRegions: marine,
        broadLandRegions: broad,
        combineLandAndMarine,
        labelOverride
    };
}

function dedupeRegions(regions: NativeRangeRegionKey[]) {
    return regions.reduce<NativeRangeRegionKey[]>((result, region) => {
        if (!result.includes(region)) {
            result.push(region);
        }

        return result;
    }, []);
}

function resolveRegionsFromMapping(mapping: NativeRangeMapping) {
    if (mapping.combineLandAndMarine) {
        const landRegions = mapping.specificLandRegions.length > 0 ? mapping.specificLandRegions : mapping.broadLandRegions;

        if (landRegions.length > 0 && mapping.marineRegions.length > 0) {
            return {
                regions: dedupeRegions([...landRegions, ...mapping.marineRegions]),
                rangeTier: mapping.specificLandRegions.length > 0 ? "specific_land" : "broad_land" as NativeRangeTier,
                usesCombinedLandAndMarineOverlays: true
            };
        }
    }

    if (mapping.specificLandRegions.length > 0) {
        return {
            regions: dedupeRegions(mapping.specificLandRegions),
            rangeTier: "specific_land" as NativeRangeTier,
            usesCombinedLandAndMarineOverlays: false
        };
    }

    if (mapping.marineRegions.length > 0) {
        return {
            regions: dedupeRegions(mapping.marineRegions),
            rangeTier: "marine" as NativeRangeTier,
            usesCombinedLandAndMarineOverlays: false
        };
    }

    if (mapping.broadLandRegions.length > 0) {
        return {
            regions: dedupeRegions(mapping.broadLandRegions),
            rangeTier: "broad_land" as NativeRangeTier,
            usesCombinedLandAndMarineOverlays: false
        };
    }

    return null;
}

function descriptorFromMapping(mapping: NativeRangeMapping, habitatText: string | null): NativeRangeDescriptor | null {
    const resolved = resolveRegionsFromMapping(mapping);

    if (!resolved) {
        return null;
    }

    return {
        regions: resolved.regions,
        rangeTier: resolved.rangeTier,
        usesCombinedLandAndMarineOverlays: resolved.usesCombinedLandAndMarineOverlays,
        labelOverride: mapping.labelOverride,
        habitatText
    };
}

function getCandidateTokens(entry: SpeciesEntry) {
    return [
        entry.normalizedIdentityKey,
        entry.analysis.scientificName,
        entry.name,
        entry.slug
    ]
        .map((token) => token?.trim().toLowerCase())
        .filter((token): token is string => Boolean(token));
}

function shouldTreatAsDomesticated(entry: SpeciesEntry, descriptor: NativeRangeDescriptor | null) {
    const tokens = getCandidateTokens(entry);
    const domesticatedFragments = [
        "canis lupus familiaris",
        "canis familiaris",
        "felis catus",
        "dog",
        "cat",
        "dachshund",
        "samoyed",
        "golden retriever",
        "labrador",
        "poodle",
        "bulldog",
        "persian cat",
        "siamese",
        "maine coon"
    ];

    const explicitDomesticIdentity = tokens.some((token) => domesticatedFragments.some((fragment) => token.includes(fragment)));

    if (explicitDomesticIdentity) {
        return true;
    }

    return descriptor === null && entry.analysis.category.toLowerCase().includes("domestic");
}

function buildDescriptor(entry: SpeciesEntry, habitatText: string | null): NativeRangeDescriptor | null {
    const tokens = getCandidateTokens(entry);
    const habitatTokens = [
        habitatText,
        entry.analysis.nativeRange?.trim() ? entry.analysis.nativeRange.trim() : null
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const matches = (fragments: string[]) => tokens.some((token) => fragments.some((fragment) => token.includes(fragment)));
    const containsFragment = (fragment: string) => habitatTokens.includes(fragment);
    const isNegatedFragment = (fragment: string) => [
        `except ${fragment}`,
        `excluding ${fragment}`,
        `not ${fragment}`,
        `outside ${fragment}`
    ].some((pattern) => habitatTokens.includes(pattern));
    const habitatMatches = (fragments: string[]) => fragments.some((fragment) => containsFragment(fragment) && !isNegatedFragment(fragment));

    const combinedIdentityMappings: Array<[string[], NativeRangeMapping]> = [
        [
            ["crocodylus porosus", "saltwater crocodile"],
            nativeRangeMapping({
                marine: ["southeast_asia_coastal", "australia_coastal"],
                broad: ["southeast_asia", "australia_oceania"],
                combineLandAndMarine: true
            })
        ],
        [
            ["enhydra lutris", "sea otter"],
            nativeRangeMapping({
                marine: ["north_pacific"],
                broad: ["north_america"],
                combineLandAndMarine: true
            })
        ]
    ];

    const specificIdentityMappings: Array<[string[], NativeRangeMapping]> = [
        [["rhinoceros sondaicus", "javan rhinoceros"], nativeRangeMapping({specific: ["west_java"]})],
        [["leucopsar rothschildi", "bali myna"], nativeRangeMapping({specific: ["bali"]})],
        [["sarcophilus harrisii", "tasmanian devil"], nativeRangeMapping({specific: ["tasmania"]})],
        [["pongo pygmaeus", "bornean orangutan", "borneo orangutan"], nativeRangeMapping({specific: ["borneo"]})],
        [["pongo abelii", "sumatran orangutan"], nativeRangeMapping({specific: ["sumatra"]})],
        [["felis silvestris grampia", "scottish wildcat"], nativeRangeMapping({specific: ["scotland"]})]
    ];

    const marineIdentityMappings: Array<[string[], NativeRangeMapping]> = [
        [["amphiprion", "clownfish", "anemonefish"], nativeRangeMapping({marine: ["coral_triangle"]})],
        [["dugong dugon", "dugong"], nativeRangeMapping({marine: ["indian_ocean", "coral_triangle", "australia_coastal"]})],
        [
            ["chelonia mydas", "eretmochelys imbricata", "green sea turtle", "hawksbill turtle", "sea turtle"],
            nativeRangeMapping({marine: ["indian_ocean", "coral_triangle", "southeast_asia_coastal", "australia_coastal"]})
        ],
        [
            ["carcharodon carcharias", "great white shark"],
            nativeRangeMapping({marine: ["north_pacific", "south_pacific", "north_atlantic", "south_atlantic", "indian_ocean", "southern_ocean"]})
        ],
        [["penguin", "aptenodytes", "pygoscelis"], nativeRangeMapping({marine: ["southern_ocean"]})]
    ];

    const broadIdentityMappings: Array<[string[], NativeRangeMapping]> = [
        [[
            "tyto alba",
            "barn owl",
            "cosmopolitan owl",
            "widely distributed owl"
        ], nativeRangeMapping({
            broad: [
                "north_america",
                "south_america",
                "europe",
                "north_africa_middle_east",
                "sub_saharan_africa",
                "central_asia",
                "south_asia",
                "southeast_asia",
                "east_asia",
                "australia_oceania"
            ],
            labelOverride: "Near-global land range"
        })],
        [["panthera leo", "lion"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [["giraffa", "giraffe"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [["african elephant", "loxodonta africana"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [["white rhinoceros", "black rhinoceros", "ceratotherium", "diceros"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [["zebra", "equus quagga"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [["gorilla", "pan troglodytes", "chimpanzee", "okapia"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [["meerkat", "suricata suricatta", "suricata"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [["panthera tigris", "tiger"], nativeRangeMapping({broad: ["south_asia", "southeast_asia", "east_asia"]})],
        [["elephas maximus", "asian elephant"], nativeRangeMapping({broad: ["south_asia", "southeast_asia"]})],
        [["orangutan", "pongo"], nativeRangeMapping({broad: ["southeast_asia"]})],
        [["komodo", "varanus komodoensis"], nativeRangeMapping({broad: ["southeast_asia"]})],
        [["tapirus indicus", "malayan tapir"], nativeRangeMapping({broad: ["southeast_asia"]})],
        [["ailuropoda melanoleuca", "giant panda", "panda"], nativeRangeMapping({broad: ["east_asia"]})],
        [["red-crowned crane"], nativeRangeMapping({broad: ["east_asia"]})],
        [["amur leopard", "panthera pardus orientalis"], nativeRangeMapping({broad: ["east_asia"]})],
        [["canis lupus", "gray wolf", "grey wolf", "wolf"], nativeRangeMapping({broad: ["north_america", "europe", "central_asia"]})],
        [["vulpes vulpes", "red fox"], nativeRangeMapping({broad: ["north_america", "europe", "central_asia"]})],
        [["moose", "alces alces"], nativeRangeMapping({broad: ["north_america", "europe", "central_asia"]})],
        [["ursus arctos", "brown bear"], nativeRangeMapping({broad: ["north_america", "europe", "central_asia"]})],
        [["bison", "bison bison"], nativeRangeMapping({broad: ["north_america"]})],
        [["raccoon", "procyon lotor"], nativeRangeMapping({broad: ["north_america"]})],
        [["lynx canadensis", "canada lynx", "american black bear"], nativeRangeMapping({broad: ["north_america"]})],
        [["panthera onca", "jaguar"], nativeRangeMapping({broad: ["south_america"]})],
        [["capybara", "hydrochoerus"], nativeRangeMapping({broad: ["south_america"]})],
        [["alpaca", "vicugna pacos", "llama", "guanaco", "vicuna", "vicuña", "andean condor"], nativeRangeMapping({broad: ["south_america"]})],
        [["kangaroo", "macropus"], nativeRangeMapping({broad: ["australia_oceania"]})],
        [["koala", "phascolarctos"], nativeRangeMapping({broad: ["australia_oceania"]})],
        [["wombat", "echidna"], nativeRangeMapping({broad: ["australia_oceania"]})],
        [["polar bear", "ursus maritimus", "walrus", "narwhal", "arctic fox"], nativeRangeMapping({broad: ["arctic_antarctic"]})],
        [["dromedary", "camelus dromedarius"], nativeRangeMapping({broad: ["north_africa_middle_east"]})],
        [["arabian oryx", "fennec fox"], nativeRangeMapping({broad: ["north_africa_middle_east"]})],
        [["snow leopard", "uncia uncia"], nativeRangeMapping({broad: ["central_asia"]})],
        [["saiga", "camelus bactrianus", "bactrian camel"], nativeRangeMapping({broad: ["central_asia"]})],
        [["european badger", "meles meles", "roe deer"], nativeRangeMapping({broad: ["europe"]})]
    ];

    const combinedHabitatMappings: Array<[string[], NativeRangeMapping]> = [
        [
            ["mangrove coast", "estuary coast", "coastal mangrove"],
            nativeRangeMapping({
                marine: ["southeast_asia_coastal"],
                broad: ["southeast_asia"],
                combineLandAndMarine: true
            })
        ],
        [
            ["temperate kelp coast", "rocky temperate coast"],
            nativeRangeMapping({
                marine: ["north_pacific"],
                broad: ["north_america"],
                combineLandAndMarine: true
            })
        ]
    ];

    const specificHabitatMappings: Array<[string[], NativeRangeMapping]> = [
        [["west java"], nativeRangeMapping({specific: ["west_java"]})],
        [["east java"], nativeRangeMapping({specific: ["east_java"]})],
        [["northern thailand"], nativeRangeMapping({specific: ["northern_thailand"]})],
        [["southern thailand"], nativeRangeMapping({specific: ["southern_thailand"]})],
        [["scotland"], nativeRangeMapping({specific: ["scotland"]})],
        [["tasmania"], nativeRangeMapping({specific: ["tasmania"]})],
        [["sumatra"], nativeRangeMapping({specific: ["sumatra"]})],
        [["borneo"], nativeRangeMapping({specific: ["borneo"]})],
        [["bali"], nativeRangeMapping({specific: ["bali"]})],
        [["java island", "on java", " java "], nativeRangeMapping({specific: ["java"]})]
    ];

    const marineHabitatMappings: Array<[string[], NativeRangeMapping]> = [
        [["indian ocean"], nativeRangeMapping({marine: ["indian_ocean"]})],
        [["coral triangle"], nativeRangeMapping({marine: ["coral_triangle"]})],
        [["southern ocean"], nativeRangeMapping({marine: ["southern_ocean"]})],
        [["north atlantic"], nativeRangeMapping({marine: ["north_atlantic"]})],
        [["south atlantic"], nativeRangeMapping({marine: ["south_atlantic"]})],
        [["north pacific"], nativeRangeMapping({marine: ["north_pacific"]})],
        [["south pacific"], nativeRangeMapping({marine: ["south_pacific"]})],
        [["mediterranean sea", "mediterranean"], nativeRangeMapping({marine: ["mediterranean"]})],
        [["red sea"], nativeRangeMapping({marine: ["red_sea"]})],
        [["arctic ocean"], nativeRangeMapping({marine: ["arctic_ocean"]})],
        [["southeast asia coastal"], nativeRangeMapping({marine: ["southeast_asia_coastal"]})],
        [["australia coastal"], nativeRangeMapping({marine: ["australia_coastal"]})]
    ];

    const broadHabitatMappings: Array<[string[], NativeRangeMapping]> = [
        [[
            "every continent except antarctica",
            "all continents except antarctica",
            "found on every continent except antarctica",
            "worldwide except antarctica",
            "worldwide except antarctic"
        ], nativeRangeMapping({
            broad: [
                "north_america",
                "south_america",
                "europe",
                "north_africa_middle_east",
                "sub_saharan_africa",
                "central_asia",
                "south_asia",
                "southeast_asia",
                "east_asia",
                "australia_oceania"
            ],
            labelOverride: "Near-global land range"
        })],
        [["north america", "canada", "united states", "alaska"], nativeRangeMapping({broad: ["north_america"]})],
        [["south america", "amazon", "andes", "patagonia"], nativeRangeMapping({broad: ["south_america"]})],
        [["europe", "scandinavia", "iberian", "mediterranean europe"], nativeRangeMapping({broad: ["europe"]})],
        [["north africa", "middle east", "arabian peninsula", "sahara"], nativeRangeMapping({broad: ["north_africa_middle_east"]})],
        [["sub-saharan africa", "savanna", "serengeti", "congo basin", "southern africa", "kalahari", "namib"], nativeRangeMapping({broad: ["sub_saharan_africa"]})],
        [
            ["tropical rainforest", "tropical rainforests", "lowland forest", "lowland forests"],
            nativeRangeMapping({
                broad: ["south_america", "sub_saharan_africa", "southeast_asia"],
                labelOverride: "Tropical rainforest belt"
            })
        ],
        [["central asia", "steppe", "mongolia", "kazakhstan", "tian shan"], nativeRangeMapping({broad: ["central_asia"]})],
        [["south asia", "india", "nepal", "bangladesh", "sri lanka"], nativeRangeMapping({broad: ["south_asia"]})],
        [["southeast asia", "indochina", "mekong"], nativeRangeMapping({broad: ["southeast_asia"]})],
        [["east asia", "china", "japan", "korea", "manchuria"], nativeRangeMapping({broad: ["east_asia"]})],
        [["australia", "oceania", "new guinea"], nativeRangeMapping({broad: ["australia_oceania"]})],
        [["arctic", "antarctic", "polar", "tundra"], nativeRangeMapping({broad: ["arctic_antarctic"]})]
    ];

    for (const mappings of [combinedIdentityMappings, specificIdentityMappings, marineIdentityMappings, broadIdentityMappings]) {
        const matched = mappings.find(([fragments]) => matches(fragments));

        if (matched) {
            const descriptor = descriptorFromMapping(matched[1], habitatText);

            if (descriptor) {
                return descriptor;
            }
        }
    }

    for (const mappings of [combinedHabitatMappings, specificHabitatMappings, marineHabitatMappings, broadHabitatMappings]) {
        const matched = mappings.find(([fragments]) => habitatMatches(fragments));

        if (matched) {
            const descriptor = descriptorFromMapping(matched[1], habitatText);

            if (descriptor) {
                return descriptor;
            }
        }
    }

    return null;
}

export function resolveNativeRangePresentation(entry: SpeciesEntry): NativeRangePresentation {
    const habitatText = entry.analysis.habitat.trim() ? entry.analysis.habitat.trim() : null;
    const descriptor = buildDescriptor(entry, habitatText);

    if (shouldTreatAsDomesticated(entry, descriptor)) {
        return {
            kind: "textOnly",
            title: REGION_LABELS.domestic_global,
            body: habitatText
        };
    }

    if (!descriptor) {
        return {kind: "hidden"};
    }

    return {
        kind: "mapped",
        descriptor
    };
}

export function getNativeRangeTierLabel(descriptor: NativeRangeDescriptor) {
    if (descriptor.usesCombinedLandAndMarineOverlays) {
        switch (descriptor.rangeTier) {
            case "specific_land":
                return "Specific land + marine range";
            case "marine":
                return "Marine range";
            default:
                return "Broad land + marine range";
        }
    }

    switch (descriptor.rangeTier) {
        case "specific_land":
            return "Specific land range";
        case "marine":
            return "Marine range";
        default:
            return "Broad land range";
    }
}

export function getNativeRangeRegionLabel(region: NativeRangeRegionKey) {
    return REGION_LABELS[region];
}

export function getNativeRangeAccent(region: NativeRangeRegionKey) {
    return REGION_ACCENTS[region];
}

export function getNativeRangeOverlayAssetPath(region: NativeRangeRegionKey) {
    if (!AVAILABLE_VECTOR_REGIONS.has(region)) {
        return null;
    }

    return `/images/native-range/range_${region}.svg`;
}

export function getAvailableNativeRangeRegions(regions: NativeRangeRegionKey[]) {
    return regions.filter((region) => Boolean(getNativeRangeOverlayAssetPath(region)));
}

export function getNativeRangeDisplayLabel(descriptor: NativeRangeDescriptor) {
    if (descriptor.labelOverride) {
        return descriptor.labelOverride;
    }

    return descriptor.regions.map((region) => getNativeRangeRegionLabel(region)).join(", ");
}

export function getNativeRangeRegionTier(region: NativeRangeRegionKey) {
    return REGION_TIERS[region];
}

export function getDirectoryNativeRangeRegions() {
    return DIRECTORY_NATIVE_RANGE_REGION_KEYS;
}

export function isNativeRangeRegionKey(value: string): value is NativeRangeRegionKey {
    return (DIRECTORY_NATIVE_RANGE_REGION_KEYS as string[]).includes(value);
}

export function speciesMatchesNativeRangeRegion(entry: SpeciesEntry, region: NativeRangeRegionKey) {
    const presentation = resolveNativeRangePresentation(entry);

    if (presentation.kind !== "mapped") {
        return false;
    }

    const acceptedRegions = new Set<NativeRangeRegionKey>([
        region,
        ...(REGION_FILTER_ALIASES[region] ?? [])
    ]);

    return presentation.descriptor.regions.some((descriptorRegion) => acceptedRegions.has(descriptorRegion));
}
