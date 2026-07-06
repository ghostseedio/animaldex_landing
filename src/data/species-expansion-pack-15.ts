type SpeciesSeedFifteen = {
    slug: string;
    name: string;
    scientificName: string;
    category: string;
    traits: [string, string, string];
    habitat: string;
    nativeRange: string;
    rarityScore: number;
    descriptor: string;
};

type SpeciesSeedFifteenRow = [
    slug: string,
    name: string,
    scientificName: string,
    category: string,
    traits: [string, string, string],
    habitat: string,
    nativeRange: string,
    rarityScore: number,
    descriptor: string
];

function joinTraits(traits: [string, string, string]) {
    return `${traits[0].toLowerCase()}, ${traits[1].toLowerCase()}, and ${traits[2].toLowerCase()}`;
}

function lowerFirst(value: string) {
    return value.charAt(0).toLowerCase() + value.slice(1);
}

function rarityReason(name: string, habitat: string, rarityScore: number) {
    if (rarityScore >= 85) {
        return `${name} depends on a narrow or fragile habitat base, so pressure on ${lowerFirst(habitat)} can affect it quickly.`;
    }

    if (rarityScore >= 70) {
        return `${name} is never easy to find and becomes less secure when ${lowerFirst(habitat)} is reduced or broken apart.`;
    }

    if (rarityScore >= 50) {
        return `${name} can still be found in good habitat, but local numbers shift when ${lowerFirst(habitat)} changes.`;
    }

    return `${name} remains fairly widespread where ${lowerFirst(habitat)} is still available.`;
}

function buildSubtitleStory(seed: SpeciesSeedFifteen) {
    switch (seed.slug) {
        case "grizzly-bear":
            return "The Grizzly Bear is a huge brown bear with a shoulder hump, long claws, and a life built around strength, digging, and explosive short-range force. It feels calm until it does not, which is why distance and respect matter so much around it.";
        case "common-brush-tailed-possum":
            return "The Common Brushtail Possum turns night branches into a second home — a marsupial that reads suburb edges and forest canopy with the same confident grip.";
        case "indian-rhinoceros":
            return "The Indian Rhinoceros is a heavy one-horned grazer with folded armor-like skin and a life built around wetland routes and patient presence. Its horn and bulk read like living stone long before any sea stack does.";
        case "bactrian-camel":
            return "The Bactrian Camel is a two-humped cold-desert carrier built for reserves, distance, and harsh dry wind. Its silhouette is one of the clearest animal shapes erosion can echo in stone.";
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

const speciesSeedRowsFifteen: SpeciesSeedFifteenRow[] = [
    ["grizzly-bear", "Grizzly Bear", "Ursus arctos horribilis", "Mammal", ["heavy shoulder-hump build", "long clawed digging forelimbs", "explosive close-range power"], "mountain forest, river valley, alpine meadow, and northern scrub", "Western North America, especially Alaska, western Canada, and parts of the northwestern United States", 58, "The hump-backed mountain force animal"],
    ["cockroach", "Cockroach", "Blattodea", "Insect", ["flattened fast-moving body", "durable exoskeleton", "high environmental tolerance"], "urban edge, forest floor litter, sewer systems, and warm shelter pockets", "Worldwide except polar regions, with major concentrations in warm and humid environments", 40, "The resilient scavenger systems test animal"],
    ["anglerfish", "Anglerfish", "Lophiiformes", "Fish", ["bioluminescent lure appendage", "wide expandable jaw", "ambush sit-and-wait hunting style"], "deep sea benthic zones, continental slopes, and dark pelagic layers", "Global oceans, especially deep Atlantic, Pacific, and Southern Ocean systems", 68, "The deep-ocean lure strategist animal"],
    ["pigeon", "Pigeon", "Columba livia domestica", "Bird", ["fast homing flight memory", "compact urban-adapted body", "strong flock navigation behavior"], "city architecture, farmland edges, cliffs, and mixed suburban corridors", "Worldwide across cities and agricultural regions on every inhabited continent", 32, "The urban navigation memory animal"],
    ["goose", "Goose", "Anserini", "Bird", ["long-distance migratory V-form flight", "strong social call coordination", "grazing wetland adaptation"], "wetland, grassland, river floodplain, and agricultural open country", "Northern Hemisphere breeding ranges with global migratory and resident populations", 36, "The migration teamwork pattern animal"],
    ["common-brush-tailed-possum", "Common Brushtail Possum", "Trichosurus vulpecula", "Mammal", ["prehensile tail grip", "nocturnal canopy movement", "marsupial pouch rearing"], "eucalypt woodland, suburban gardens, and forest edge", "Australia and introduced parts of New Zealand", 38, "The night-branch marsupial navigator animal"],
    ["indian-rhinoceros", "Indian Rhinoceros", "Rhinoceros unicornis", "Mammal", ["single shoulder horn", "plate-folded grey-brown skin", "heavy wetland browsing build"], "riverine grassland, swamp forest, and floodplain", "Nepal and northeastern India", 88, "The armor-plated one-horned grazer animal"],
    ["bactrian-camel", "Bactrian Camel", "Camelus bactrianus", "Mammal", ["two heavy winter humps", "thick cold-desert coat", "broad padded desert feet"], "cold desert, rocky steppe, and arid mountain basin", "Central Asia, especially Mongolia and northwestern China", 72, "The two-humped cold-desert carrier animal"]
];

const speciesSeedsFifteen: SpeciesSeedFifteen[] = speciesSeedRowsFifteen.map(([
    slug,
    name,
    scientificName,
    category,
    traits,
    habitat,
    nativeRange,
    rarityScore,
    descriptor
]) => ({
    slug,
    name,
    scientificName,
    category,
    traits,
    habitat,
    nativeRange,
    rarityScore,
    descriptor
}));

export const additionalSpeciesEntriesInputFifteen = speciesSeedsFifteen.map((seed) => ({
    slug: seed.slug,
    name: seed.name,
    analysis: {
        summary: `${seed.name} is a ${seed.category.toLowerCase()} known for ${joinTraits(seed.traits)}.`,
        scientificName: seed.scientificName,
        category: seed.category,
        identification: [
            seed.traits[0],
            seed.traits[1],
            seed.traits[2],
            `Often associated with ${lowerFirst(seed.habitat)}`
        ],
        habitat: seed.habitat,
        nativeRange: seed.nativeRange,
        rarityScore: seed.rarityScore,
        rarityReason: rarityReason(seed.name, seed.habitat, seed.rarityScore)
    }
}));

export const additionalSpeciesDescriptorsFifteen = Object.fromEntries(
    speciesSeedsFifteen.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesFifteen = Object.fromEntries(
    speciesSeedsFifteen.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;
