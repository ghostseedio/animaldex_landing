type SpeciesSeedTwelve = {
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

type SpeciesSeedTwelveRow = [
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

function buildSubtitleStory(seed: SpeciesSeedTwelve) {
    switch (seed.slug) {
        case "white-backed-vulture":
            return "The White-backed Vulture is a broad-winged scavenger with a pale back, bare head, and efficient soaring flight over open country. It survives by finding carcasses early and turning distance into food access.";
        case "hooded-vulture":
            return "The Hooded Vulture is a smaller scavenger with a slim bill, bare face, and a strong tolerance for human-shaped landscapes. It stays effective by finding feeding opportunities other larger vultures may overlook.";
        case "water-monitor":
            return "The Water Monitor is a large lizard with a long neck, muscular tail, and strong swimming ability that lets it use riverbanks, mangroves, and urban edges. It succeeds by combining scavenging, hunting, and movement across both land and water.";
        case "norwegian-forest-cat":
            return "The Norwegian Forest Cat is a large longhaired cat with a thick coat, strong frame, and climbing-focused build shaped by cold northern conditions. It stays effective by pairing insulation, balance, and patience in rough weather.";
        case "siberian-cat":
            return "The Siberian Cat is a powerful longhaired cat with dense triple-layer fur, sturdy paws, and winter-ready movement. It is built to stay capable in cold environments where insulation and footing both matter.";
        case "raven":
            return "The Raven is a large black corvid with a thick bill, wedge-shaped tail, and deep carrying voice. It survives by mixing intelligence, aerial control, and opportunistic feeding across harsh and variable landscapes.";
        case "rook":
            return "The Rook is a social black corvid with a pale bare face at the bill base and a strong habit of feeding in open ground. It succeeds by turning flock behavior and repeated foraging routes into reliable access to food.";
        case "jackdaw":
            return "The Jackdaw is a small nimble corvid with pale eyes, quick flocking movement, and a habit of using cliffs, buildings, and cavities. It stays effective by being socially alert and structurally flexible in where it lives.";
        case "short-eared-owl":
            return "The Short-eared Owl is a ground-nesting owl with long wings, open-country flight, and low coursing hunting behavior over grassland. It survives by turning wide visibility and patient listening into prey interception.";
        case "masked-owl":
            return "The Masked Owl is a pale forest-edge owl with a large facial disc, strong low-light hearing, and quiet flight through dark cover. It remains effective by pairing silence with precise night-time sensing.";
        case "asian-elephant":
            return "The Asian Elephant is a large herbivore with a dexterous trunk, smaller ears than African elephants, and deep memory for routes and resources. It survives by linking social knowledge, movement, and habitat familiarity across changing seasons.";
        case "african-bush-elephant":
            return "The African Bush Elephant is a massive grazer-browser with broad ears, long movement range, and landscape-changing feeding behavior. It succeeds by turning size, memory, and group coordination into access across open country.";
        case "coyote":
            return "The Coyote is a lean canid with keen hearing, adaptable diet, and the ability to live across wild, rural, and urban edges. It remains effective by adjusting behavior quickly instead of relying on one narrow habitat rule.";
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

const speciesSeedRowsTwelve: SpeciesSeedTwelveRow[] = [
    ["white-backed-vulture", "White-backed Vulture", "Gyps africanus", "Bird", ["pale-backed soaring body", "bare scavenger head", "carcass-searching thermal flight"], "savannah, open woodland, and dry plain", "Sub-Saharan Africa", 84, "The pale-backed thermal scavenger animal"],
    ["hooded-vulture", "Hooded Vulture", "Necrosyrtes monachus", "Bird", ["slim scavenger bill", "small bare-headed body", "human-edge carrion foraging"], "savannah, town edge, dump site, and open dry country", "Sub-Saharan Africa", 86, "The small scavenging cleanup bird animal"],
    ["water-monitor", "Water Monitor", "Varanus salvator", "Reptile", ["long-necked monitor frame", "powerful swimming tail", "wetland-edge opportunistic feeding"], "mangrove, riverbank, swamp edge, and urban canal", "South and Southeast Asia", 51, "The riverbank swimming monitor animal"],
    ["norwegian-forest-cat", "Norwegian Forest Cat", "Felis catus", "Domestic breed", ["dense weatherproof coat", "strong climbing body", "large tufted ears"], "domestic home, forest-edge farm, and cold-climate settlement", "Domestic breed developed in northern Europe", 28, "The cold-forest longhair cat animal"],
    ["siberian-cat", "Siberian Cat", "Felis catus", "Domestic breed", ["triple-layer winter coat", "broad sturdy paws", "muscular compact body"], "domestic home, cold-climate settlement, and managed household environment", "Domestic breed associated with Russia", 27, "The frost-built domestic forest cat animal"],
    ["raven", "Raven", "Corvus corax", "Bird", ["heavy black bill", "wedge-shaped tail", "deep resonant calls"], "mountain, moor, cliff, forest edge, and open country", "Northern Hemisphere", 43, "The deep-voiced black trickster animal"],
    ["rook", "Rook", "Corvus frugilegus", "Bird", ["pale bill-base face", "flock-foraging black body", "colony nesting in treetops"], "farmland, grassland, parkland, and village edge", "Europe and Asia", 35, "The colony-field foraging corvid animal"],
    ["jackdaw", "Jackdaw", "Coloeus monedula", "Bird", ["pale alert eyes", "small agile corvid frame", "cavity-nesting flock behavior"], "cliff, farmland, town, and old building edge", "Europe, North Africa, and western Asia", 33, "The pale-eyed cavity corvid animal"],
    ["short-eared-owl", "Short-eared Owl", "Asio flammeus", "Bird of prey", ["long open-country wings", "low grassland hunting flight", "small ear tufts"], "grassland, marsh, tundra, and open field", "Worldwide in open-country regions", 57, "The open-country low-flight owl animal"],
    ["masked-owl", "Masked Owl", "Tyto novaehollandiae", "Bird of prey", ["large pale facial mask", "dark deep-set eyes", "silent low-light forest-edge flight"], "forest edge, farmland, woodland, and open night-hunting ground", "Australia and New Guinea", 69, "The pale-faced silent night owl animal"],
    ["asian-elephant", "Asian Elephant", "Elephas maximus", "Mammal", ["smaller rounded ears", "high-domed head", "dexterous trunk tip"], "forest, grassland edge, floodplain, and scrub woodland", "South and Southeast Asia", 88, "The memory-led trunk strategist animal"],
    ["african-bush-elephant", "African Bush Elephant", "Loxodonta africana", "Mammal", ["huge fan-shaped ears", "long open-country stride", "landscape-shaping feeding strength"], "savannah, woodland, floodplain, and open dry country", "Sub-Saharan Africa", 79, "The open-country landscape giant animal"],
    ["coyote", "Coyote", "Canis latrans", "Mammal", ["narrow canid muzzle", "adaptable edge-habitat movement", "high-pitched social calls"], "grassland, scrub, woodland edge, farmland, and suburb fringe", "North America", 31, "The edge-country adaptable hunter animal"]
];

const speciesSeedsTwelve: SpeciesSeedTwelve[] = speciesSeedRowsTwelve.map(([
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

export const additionalSpeciesEntriesInputTwelve = speciesSeedsTwelve.map((seed) => ({
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

export const additionalSpeciesDescriptorsTwelve = Object.fromEntries(
    speciesSeedsTwelve.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesTwelve = Object.fromEntries(
    speciesSeedsTwelve.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;
