type SpeciesSeedFourteen = {
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

type SpeciesSeedFourteenRow = [
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

function buildSubtitleStory(seed: SpeciesSeedFourteen) {
    switch (seed.slug) {
        case "pig":
            return "The Pig is a sturdy social mammal with a sensitive snout, flexible diet, and a surprising ability to learn patterns quickly. It shows that intelligence can grow out of curiosity, memory, and constant contact with the world right in front of it.";
        case "black-vulture":
            return "The Black Vulture is a dark broad-winged scavenger with a bare black head, tight social groups, and a confident habit of riding warm air over open country. It succeeds by watching carefully, following information fast, and arriving where the opportunity opens first.";
        case "kangal":
            return "The Kangal is a massive guardian dog with a broad head, calm watchfulness, and a body built for protecting livestock in open country. It works best when patience, confidence, and sudden defensive force all belong to the same system.";
        case "giant-tortoise":
            return "The Giant Tortoise is a huge slow-moving reptile with a domed shell, pillar-like legs, and a life measured in decades. It turns protection, patience, and steady movement into a survival strategy that feels older than hurry itself.";
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

const speciesSeedRowsFourteen: SpeciesSeedFourteenRow[] = [
    ["pig", "Pig", "Sus scrofa domesticus", "Mammal", ["sensitive rooting snout", "social learning behavior", "adaptable omnivore feeding"], "farmyard, wet pasture, woodland edge, and managed grassland", "Domesticated worldwide from Eurasian wild boar ancestry", 18, "The curious root-and-learn animal"],
    ["black-vulture", "Black Vulture", "Coragyps atratus", "Bird", ["dark broad-winged soaring", "bare black scavenger head", "social roosting and carcass-search behavior"], "open country, town edge, wetland margin, and warm-air soaring terrain", "The Americas from the southern United States through South America", 33, "The black-wing cleanup scout animal"],
    ["kangal", "Kangal", "Canis lupus familiaris", "Domestic dog", ["massive guardian frame", "broad heavy head and neck", "calm territorial livestock defense"], "dry steppe pasture, village edge, and working rangeland", "Anatolia in Turkey with domestic working populations elsewhere", 24, "The calm pasture guardian animal"],
    ["giant-tortoise", "Giant Tortoise", "Chelonoidis spp. and Aldabrachelys gigantea", "Reptile", ["immense domed shell", "long-lived slow grazing", "heavy columnar island-walking legs"], "island scrub, grassland, dry lowland, and coastal woodland", "Galapagos Islands, Aldabra Atoll, and managed island populations elsewhere", 84, "The ancient island shell giant animal"]
];

const speciesSeedsFourteen: SpeciesSeedFourteen[] = speciesSeedRowsFourteen.map(([
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

export const additionalSpeciesEntriesInputFourteen = speciesSeedsFourteen.map((seed) => ({
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

export const additionalSpeciesDescriptorsFourteen = Object.fromEntries(
    speciesSeedsFourteen.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesFourteen = Object.fromEntries(
    speciesSeedsFourteen.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;
