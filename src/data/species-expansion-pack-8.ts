import {SystemsIntelligenceEntry} from "@/data/content-schema";

type SpeciesSeedEight = {
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

type SpeciesSeedEightRow = [
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

function toTitleCase(value: string) {
    return value
        .split(" ")
        .map((word) => word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word)
        .join(" ");
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

function buildRoleTitle(descriptor: string) {
    return toTitleCase(descriptor.replace(/^The /, "The ").replace(/ animal$/, ""));
}

function buildSubtitleStory(seed: SpeciesSeedEight) {
    return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
}

function buildStrategicInsight(seed: SpeciesSeedEight) {
    const habitat = seed.habitat.toLowerCase();
    const category = seed.category.toLowerCase();

    if (/(desert|arid|dry|dune|steppe)/.test(habitat)) {
        return "Harsh places reward efficiency, timing, and bodies that waste very little.";
    }

    if (/(mountain|cliff|alpine|highland|ridge)/.test(habitat)) {
        return "In steep terrain, balance and route control matter more than brute force.";
    }

    if (/(forest|canopy|woodland|thicket|jungle)/.test(habitat)) {
        return "Dense environments reward precision, patience, and the ability to read layered cover.";
    }

    if (/(river|wetland|swamp|mangrove|estuary|marsh|floodplain)/.test(habitat)) {
        return "Where water controls movement, position and timing often matter more than speed.";
    }

    if (/(ocean|reef|coastal|sea|pelagic|bluewater)/.test(habitat) || category.includes("marine")) {
        return "In moving water, the best systems use flow, visibility, and depth instead of fighting every current.";
    }

    if (category.includes("insect") || category.includes("arachnid")) {
        return "Small systems become powerful when signal, timing, and specialization stay tightly linked.";
    }

    if (/(grassland|plain|savannah|open country|prairie)/.test(habitat)) {
        return "Open landscapes reward early detection, clean movement, and fast decisions once the space opens up.";
    }

    return "Good design turns a difficult habitat into usable ground.";
}

const speciesSeedRowsEight: SpeciesSeedEightRow[] = [
    ["xantus-hummingbird", "Xantus's Hummingbird", "Basilinna xantusii", "Bird", ["emerald-green upperparts", "slender curved nectar bill", "rapid flower-to-flower hovering"], "oasis thicket, dry scrub, and flowering desert woodland", "Baja California Sur, Mexico", 73, "The emerald oasis hummingbird animal"],
    ["xantus-murrelet", "Xantus's Murrelet", "Synthliboramphus hypoleucus", "Bird", ["small black-and-white seabird body", "fast low skimming flight", "night colony return to islands"], "rocky island coast, offshore sea, and marine cliff habitat", "Pacific coast of Baja California and southern California", 86, "The night-returning murrelet animal"],
    ["xeme", "Xeme", "Xema sabini", "Bird", ["forked tail in flight", "sharp black hood in breeding season", "buoyant ocean-edge gliding"], "Arctic tundra coast, estuary, and open pelagic sea", "Arctic regions and global ocean migration routes", 68, "The fork-tailed polar gull animal"],
    ["x-ray-tetra", "X-ray Tetra", "Pristella maxillaris", "Fish", ["semi-transparent silver body", "yellow-and-black fin tips", "tight schooling freshwater movement"], "slow river, floodplain pool, and planted freshwater habitat", "Amazon and coastal river systems of South America", 34, "The glass-bodied schooling fish animal"],
    ["uakari", "Uakari", "Cacajao calvus", "Mammal", ["bare bright-red face", "short tail", "high-canopy seed-cracking troop life"], "flooded forest, riverine canopy, and humid lowland woodland", "Western Amazon Basin", 84, "The red-faced canopy monkey animal"],
    ["uinta-ground-squirrel", "Uinta Ground Squirrel", "Urocitellus armatus", "Mammal", ["short upright sentinel posture", "tan alpine-meadow coat", "burrow-linked colony behavior"], "mountain meadow, sagebrush flat, and alpine grassland edge", "Western United States", 46, "The meadow sentinel squirrel animal"],
    ["upland-goose", "Upland Goose", "Chloephaga picta", "Bird", ["bold white male plumage", "barred brown female coat", "windswept grassland pair life"], "coastal grassland, upland plain, and open Patagonian scrub", "Southern South America and Falkland Islands", 58, "The windswept grassland goose animal"],
    ["ultramarine-lorikeet", "Ultramarine Lorikeet", "Vini ultramarina", "Bird", ["deep ultramarine-blue plumage", "brush-tipped nectar tongue", "flowering-canopy flock movement"], "island forest, coconut grove, and flowering tropical woodland", "French Polynesia", 95, "The ultramarine island lorikeet animal"],
    ["ugandan-kob", "Ugandan Kob", "Kobus kob thomasi", "Mammal", ["sleek chestnut antelope body", "lyre-curved horns", "lek-based open-grassland display"], "savannah grassland, floodplain edge, and open woodland", "Uganda and neighboring East African regions", 57, "The lek-dancing kob animal"],
    ["zebra-finch", "Zebra Finch", "Taeniopygia guttata", "Bird", ["barred tail and chest patterning", "bright orange beak", "constant social chirping"], "arid grassland, scrub, and dry woodland", "Australia and Lesser Sunda Islands", 36, "The striped song finch animal"],
    ["zebra-longwing", "Zebra Longwing", "Heliconius charithonia", "Insect", ["long narrow black-and-yellow wings", "slow floating forest flight", "pollen-feeding butterfly behavior"], "forest edge, garden, and humid tropical scrub", "The Americas", 41, "The ribbon-striped butterfly animal"],
    ["zander", "Zander", "Sander lucioperca", "Fish", ["elongated predatory body", "spiny dorsal fins", "dim-water ambush hunting"], "river, reservoir, and deep freshwater lake habitat", "Europe and western Asia", 49, "The twilight ambush pikeperch animal"],
    ["zokor", "Zokor", "Myospalax baileyi", "Mammal", ["mole-like powerful digging limbs", "tiny hidden eyes", "subterranean tunnel engineering"], "alpine meadow soil, steppe, and upland grassland", "China and Tibetan Plateau regions", 64, "The tunnel-forging zokor animal"],
    ["zone-tailed-hawk", "Zone-tailed Hawk", "Buteo albonotatus", "Bird of prey", ["vulture-mimicking dark soaring silhouette", "broad banded tail", "stealth approach over open country"], "canyon, woodland, and open scrubland edge", "The Americas", 61, "The mimic-soaring hawk animal"]
];

const speciesSeedsEight: SpeciesSeedEight[] = speciesSeedRowsEight.map(([
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

export const additionalSpeciesEntriesInputEight = speciesSeedsEight.map((seed) => ({
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

export const additionalSpeciesSystemsIntelligenceEight = Object.fromEntries(
    speciesSeedsEight.map((seed) => [
        seed.slug,
        {
            roleTitle: buildRoleTitle(seed.descriptor),
            specializedHardware: `${seed.traits[0]}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} give the ${seed.name} a body plan tuned for its niche.`,
            systemsScript: `${seed.name}s operate through ${lowerFirst(seed.habitat)}. Their design links movement, feeding, shelter, and timing into one workable survival system.`,
            strategicInsight: buildStrategicInsight(seed)
        } satisfies SystemsIntelligenceEntry
    ])
) as Record<string, SystemsIntelligenceEntry>;

export const additionalSpeciesDescriptorsEight = Object.fromEntries(
    speciesSeedsEight.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesEight = Object.fromEntries(
    speciesSeedsEight.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;

export const additionalSpeciesMiniSystemsEight = Object.fromEntries(
    speciesSeedsEight.map((seed) => [seed.slug, `${seed.name} thrives by using ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} in ${lowerFirst(seed.habitat)}.`])
) as Record<string, string>;
