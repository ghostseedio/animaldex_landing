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
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

const speciesSeedRowsFifteen: SpeciesSeedFifteenRow[] = [
    ["grizzly-bear", "Grizzly Bear", "Ursus arctos horribilis", "Mammal", ["heavy shoulder-hump build", "long clawed digging forelimbs", "explosive close-range power"], "mountain forest, river valley, alpine meadow, and northern scrub", "Western North America, especially Alaska, western Canada, and parts of the northwestern United States", 58, "The hump-backed mountain force animal"]
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
