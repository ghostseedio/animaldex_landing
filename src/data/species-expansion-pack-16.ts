type SpeciesSeedSixteen = {
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

type SpeciesSeedSixteenRow = [
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

function buildSubtitleStory(seed: SpeciesSeedSixteen) {
    switch (seed.slug) {
        case "brown-bear":
            return "The Brown Bear is a wide-ranging northern predator built around patience, digging strength, and explosive short-range force. It can look calm for long stretches, then remind everything nearby why distance matters.";
        case "japanese-macaque":
            return "The Japanese Macaque reads the troop before it moves — a snow-country primate that turns social awareness into survival on cold islands and mountain forests.";
        case "korean-rat-snake":
            return "The Korean Rat Snake is a regional climber that favors edges, cover, and quick reading of terrain — a real Jeju-area serpent anchor rather than a fantasy dragon.";
        case "russian-tortoise":
            return "The Russian Tortoise carries its boundary into open steppe — a Central Asian grazer that wins with patience, burrows, and dry-season timing.";
        case "lace-monitor":
            return "The Lace Monitor moves through rainforest with stone-pattern camouflage and alert observation — a real Australian reptile anchor for mythic gully places.";
        case "chinese-cobra":
            return "The Chinese Cobra makes the warning line visible before force arrives — hood, posture, and restraint before strike.";
        case "galapagos-sea-lion":
            return "The Galápagos Sea Lion stores movement in long rests on rock, then turns awkward land lounging into sudden water agility.";
        case "new-zealand-fur-seal":
            return "The New Zealand Fur Seal shows how the same body can look clumsy on rock and elegant in surf — a lesson in choosing the right element.";
        case "australian-green-tree-frog":
            return "The Australian Green Tree Frog waits for the right wet moment, then moves with bright patience when rain makes action natural.";
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

/** Legendary Earth Beast anchor species missing from earlier expansion packs. */
const speciesSeedRowsSixteen: SpeciesSeedSixteenRow[] = [
    ["brown-bear", "Brown Bear", "Ursus arctos", "Mammal", ["heavy forequarters", "long digging claws", "territorial boundary defense"], "boreal forest, mountain valley, tundra edge, and river corridor", "Northern Eurasia and North America", 58, "The boundary-guarding northern force animal"],
    ["japanese-macaque", "Japanese Macaque", "Macaca fuscata", "Primate", ["thick seasonal coat", "troop social reading", "cold-island adaptability"], "temperate forest, mountain woodland, and snowy park edge", "Japan, especially Honshu and nearby islands", 62, "The snow-troop social reader animal"],
    ["korean-rat-snake", "Korean Rat Snake", "Elaphe anomala", "Reptile", ["slender climbing body", "regional forest edge habits", "quick terrain-route shifts"], "woodland edge, rocky coastal scrub, and low mountain trail", "Korean Peninsula and nearby East Asia", 54, "The Jeju-edge climbing serpent animal"],
    ["russian-tortoise", "Russian Tortoise", "Testudo horsfieldii", "Reptile", ["high-domed dry-country shell", "burrow heat timing", "steppe grazing patience"], "semi-desert steppe, rocky scrub, and dry grass basin", "Central Asia from Iran to Mongolia and northwestern China", 48, "The steppe-boundary carrier animal"],
    ["lace-monitor", "Lace Monitor", "Varanus varius", "Reptile", ["stone-pattern camouflage", "tree-and-gully ambush", "alert long-distance scanning"], "temperate rainforest, coastal gully, and woodland creek", "Eastern Australia", 52, "The patterned rainforest watcher animal"],
    ["chinese-cobra", "Chinese Cobra", "Naja atra", "Reptile", ["raised hood warning", "defensive boundary posture", "ridge-and-edge hunting"], "forest edge, farmland margin, and subtropical hillside", "Southern China and nearby Southeast Asia", 56, "The ridge-line warning serpent animal"],
    ["galapagos-sea-lion", "Galápagos Sea Lion", "Zalophus wollebaeki", "Mammal", ["stored resting power", "surf agility bursts", "island haul-out balance"], "rocky Galápagos coast, reef channel, and sandy cove", "Galápagos Islands, Ecuador", 74, "The reef-gate rest-and-burst animal"],
    ["new-zealand-fur-seal", "New Zealand Fur Seal", "Arctocephalus forsteri", "Mammal", ["land-water movement contrast", "coastal rock haul-out", "tide-pool edge timing"], "rocky coastline, kelp forest margin, and offshore islet", "New Zealand and southern Australia", 50, "The tide-line element-switch animal"],
    ["australian-green-tree-frog", "Australian Green Tree Frog", "Ranoidea caerulea", "Amphibian", ["plump wet-season body", "rain-triggered activity", "patient perch waiting"], "woodland pond edge, rocky outcrop, and rainy savanna fringe", "Australia and southern New Guinea", 42, "The rain-timing perch frog animal"]
];

const speciesSeedsSixteen: SpeciesSeedSixteen[] = speciesSeedRowsSixteen.map(([
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

export const additionalSpeciesEntriesInputSixteen = speciesSeedsSixteen.map((seed) => ({
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

export const additionalSpeciesDescriptorsSixteen = Object.fromEntries(
    speciesSeedsSixteen.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesSixteen = Object.fromEntries(
    speciesSeedsSixteen.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;
