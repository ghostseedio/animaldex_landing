type SpeciesSeedEleven = {
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

type SpeciesSeedElevenRow = [
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

function buildSubtitleStory(seed: SpeciesSeedEleven) {
    switch (seed.slug) {
        case "bengal-tiger":
            return "The Bengal Tiger is a large striped cat with a heavy forequarter build, strong orange coat, and ambush-focused hunting style. It succeeds in forest and grassland mosaics by staying hidden until the last decisive movement matters.";
        case "sumatran-tiger":
            return "The Sumatran Tiger is the smallest living tiger form, with dense striping, a compact build, and movement tuned for thick forest cover. It survives by turning tight vegetation and short-range surprise into hunting advantage.";
        case "bornean-orangutan":
            return "The Bornean Orangutan is a large reddish ape with powerful arms, deliberate canopy travel, and deep reliance on forest memory. It uses patience, route knowledge, and branch judgment to stay effective high above the ground.";
        case "sumatran-orangutan":
            return "The Sumatran Orangutan is a slimmer forest ape with long arms, refined canopy movement, and strong dependence on complex treetop routes. It survives by pairing careful planning with the ability to move through layered forest without wasting energy.";
        case "tapanuli-orangutan":
            return "The Tapanuli Orangutan is a rare orangutan from the Batang Toru ecosystem with shaggy hair, isolated range, and specialized forest adaptation. Its survival depends on maintaining continuity across a fragile mountain forest system.";
        case "sea-turtle":
            return "The Sea Turtle is a marine reptile with flipper-shaped limbs, a streamlined shell, and long-distance ocean navigation ability. It turns currents, coastlines, and feeding grounds into one connected migration system.";
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

const speciesSeedRowsEleven: SpeciesSeedElevenRow[] = [
    ["bengal-tiger", "Bengal Tiger", "Panthera tigris tigris", "Mammal", ["broad-shouldered striped body", "rich orange coat", "close-range ambush power"], "forest, riverine grassland, mangrove, and woodland edge", "India, Bangladesh, Nepal, and Bhutan", 82, "The broad-framed striped ambush cat animal"],
    ["sumatran-tiger", "Sumatran Tiger", "Panthera tigris sumatrae", "Mammal", ["dense dark striping", "compact forest-hunting build", "thick-cover stealth movement"], "tropical rainforest, peat swamp forest, and montane woodland", "Sumatra, Indonesia", 94, "The dense-forest striped stealth cat animal"],
    ["bornean-orangutan", "Bornean Orangutan", "Pongo pygmaeus", "Primate", ["heavy arboreal frame", "long grasping arms", "deliberate canopy travel"], "lowland rainforest, peat swamp forest, and riverine forest", "Borneo", 88, "The heavy-canopy memory ape animal"],
    ["sumatran-orangutan", "Sumatran Orangutan", "Pongo abelii", "Primate", ["slimmer canopy build", "long flexible reach", "fine-scale branch navigation"], "lowland rainforest, hill forest, and riverine canopy", "Northern Sumatra, Indonesia", 91, "The high-canopy route-planning ape animal"],
    ["tapanuli-orangutan", "Tapanuli Orangutan", "Pongo tapanuliensis", "Primate", ["shaggy mountain coat", "isolated forest adaptation", "careful branch and ridge travel"], "montane rainforest, steep valley forest, and fragmented upland canopy", "Batang Toru, North Sumatra", 99, "The rare ridge-forest orangutan animal"],
    ["sea-turtle", "Sea Turtle", "Chelonioidea", "Reptile", ["flipper-shaped limbs", "streamlined marine shell", "long-distance ocean navigation"], "open ocean, seagrass meadow, coral reef, and nesting beach", "Tropical and temperate oceans worldwide", 68, "The long-route ocean grazer animal"]
];

const speciesSeedsEleven: SpeciesSeedEleven[] = speciesSeedRowsEleven.map(([
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

export const additionalSpeciesEntriesInputEleven = speciesSeedsEleven.map((seed) => ({
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

export const additionalSpeciesDescriptorsEleven = Object.fromEntries(
    speciesSeedsEleven.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesEleven = Object.fromEntries(
    speciesSeedsEleven.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;
