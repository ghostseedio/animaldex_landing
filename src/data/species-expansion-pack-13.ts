type SpeciesSeedThirteen = {
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

type SpeciesSeedThirteenRow = [
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

function buildSubtitleStory(seed: SpeciesSeedThirteen) {
    switch (seed.slug) {
        case "yangtze-finless-porpoise":
            return "The Yangtze Finless Porpoise is a smooth-backed river porpoise with a rounded forehead, quick surfacing habit, and a life tied to busy freshwater corridors. It survives only where enough river health remains for sound, food, and movement to keep working together.";
        case "siberian-crane":
            return "The Siberian Crane is a tall white wetland bird with black flight feathers, a red face, and one of the most delicate migration stories in the world. It depends on a chain of safe marshes staying connected across huge distance.";
        case "javan-rhinoceros":
            return "The Javan Rhinoceros is a shy forest rhino with a single horn, armor-like skin folds, and a life built around dense tropical cover. It survives only because a tiny remaining habitat still holds enough space for it to move and feed.";
        case "sumatran-rhinoceros":
            return "The Sumatran Rhinoceros is a small hairy rhino with a prehensile lip, deep forest habits, and one of the oldest-looking body plans among living mammals. It depends on intact rainforest and enough quiet distance to keep breeding possible.";
        case "tooth-billed-pigeon":
            return "The Tooth-billed Pigeon is a heavy dark forest pigeon with a primitive-looking bill and a life tied to humid island woodland. It feels like an old branch of bird history still holding on in a very small space.";
        case "madagascar-pochard":
            return "The Madagascar Pochard is a chestnut diving duck with a pale eye, compact freshwater build, and one of the narrowest recovery stories in the bird world. It depends on a tiny set of suitable lakes staying good enough to support breeding.";
        case "indus-river-dolphin":
            return "The Indus River Dolphin is a long-snouted freshwater dolphin with tiny eyes and a life tuned to muddy river channels. It navigates more by sound than sight, which makes healthy flowing river structure especially important.";
        case "northern-hairy-nosed-wombat":
            return "The Northern Hairy-nosed Wombat is a heavy burrowing marsupial with a blunt face, strong digging body, and a life built around dry grass and secure tunnel systems. Its whole future depends on a tiny number of protected survivors holding on.";
        case "giant-ibis":
            return "The Giant Ibis is a huge dark wetland bird with a long curved bill and a slow searching walk through seasonal pools and forest clearings. It rewards quiet observation because its rarity is tied to habitats that disappear easily.";
        case "malayan-tiger":
            return "The Malayan Tiger is a compact striped forest cat with a tight tropical range and a life built around dense cover and quiet movement. It remains powerful in body design, but extremely fragile in numbers.";
        case "hamiltons-frog":
            return "Hamilton's Frog is a tiny ancient frog with a squat body, no eardrum, and a life hidden in damp ground shelter. It survives by staying small, quiet, and close to stable cover in one of the narrowest ranges of any frog.";
        case "iberian-lynx":
            return "The Iberian Lynx is a short-tailed spotted cat with long ear tufts, powerful legs, and a hunting strategy built around Mediterranean scrubland. It shows how specialist predators rise or fall with the prey base beneath them.";
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

const speciesSeedRowsThirteen: SpeciesSeedThirteenRow[] = [
    ["yangtze-finless-porpoise", "Yangtze Finless Porpoise", "Neophocaena asiaeorientalis asiaeorientalis", "Freshwater mammal", ["finless smooth-backed body", "rounded echo-focused forehead", "turbid river-surface rolling"], "broad river channel, oxbow edge, and freshwater floodplain corridor", "Yangtze River system, China", 96, "The smooth-backed river echo animal"],
    ["siberian-crane", "Siberian Crane", "Leucogeranus leucogeranus", "Bird", ["tall white marsh body", "red bare face", "long-distance wetland migration"], "marsh, sedge wetland, shallow lake edge, and migratory stopover plain", "Arctic Russia with wintering strongholds in Asia", 96, "The red-faced migration marsh giant animal"],
    ["javan-rhinoceros", "Javan Rhinoceros", "Rhinoceros sondaicus", "Mammal", ["single short horn", "plate-folded grey skin", "dense lowland forest browsing"], "lowland rainforest, swamp forest, and thick riverine thicket", "Java, Indonesia", 99, "The one-horned jungle remnant animal"],
    ["sumatran-rhinoceros", "Sumatran Rhinoceros", "Dicerorhinus sumatrensis", "Mammal", ["hairy compact rhino build", "prehensile browsing lip", "steep rainforest movement"], "mountain rainforest, lowland forest, and muddy mineral lick corridor", "Sumatra and Borneo in highly fragmented remnants", 99, "The shaggy rainforest rhino animal"],
    ["tooth-billed-pigeon", "Tooth-billed Pigeon", "Didunculus strigirostris", "Bird", ["heavy curved bill", "dark island-forest body", "ground-and-branch fruit foraging"], "humid tropical forest, mountain woodland, and island valley canopy", "Samoa", 97, "The ancient-billed island pigeon animal"],
    ["madagascar-pochard", "Madagascar Pochard", "Aythya innotata", "Bird", ["chestnut diving-duck body", "pale alert eyes", "deep freshwater diving"], "freshwater lake, reed-fringed marsh, and quiet highland wetland", "Madagascar", 98, "The deep-lake survival duck animal"],
    ["indus-river-dolphin", "Indus River Dolphin", "Platanista gangetica minor", "Freshwater mammal", ["long narrow beak", "tiny vision-reduced eyes", "muddy-channel sonar movement"], "slow river channel, meander bend, and silty freshwater basin", "Indus River system, Pakistan", 96, "The blind-river sonar swimmer animal"],
    ["northern-hairy-nosed-wombat", "Northern Hairy-nosed Wombat", "Lasiorhinus krefftii", "Mammal", ["broad blunt muzzle", "strong burrowing forelimbs", "night-grazing dryland movement"], "dry grassland, sandy soil, and burrow-friendly open scrub", "Queensland, Australia", 98, "The burrow-built grassland survivor animal"],
    ["giant-ibis", "Giant Ibis", "Thaumatibis gigantea", "Bird", ["long down-curved bill", "deep dark body", "seasonal wetland probing walk"], "seasonal wetland, forest pool, and open riverine plain", "Cambodia with small neighboring populations", 96, "The long-billed disappearing wetland giant animal"],
    ["malayan-tiger", "Malayan Tiger", "Panthera tigris jacksoni", "Mammal", ["tight striped forest coat", "compact tropical-cat frame", "dense-cover ambush movement"], "tropical rainforest, riverine forest, and lowland woodland edge", "Peninsular Malaysia", 95, "The shrinking-range striped forest cat animal"],
    ["hamiltons-frog", "Hamilton's Frog", "Leiopelma hamiltoni", "Amphibian", ["tiny ancient frog body", "earless low-sound anatomy", "rock-shelter moisture dependence"], "cool damp forest floor, boulder cover, and sheltered coastal scrub", "New Zealand in one tiny island refuge", 95, "The ancient rock-shadow frog animal"],
    ["iberian-lynx", "Iberian Lynx", "Lynx pardinus", "Mammal", ["tufted ears and beard", "short powerful tail", "rabbit-focused scrub hunting"], "Mediterranean scrub, open woodland, and rocky brush mosaic", "Spain and Portugal", 89, "The rabbit-tracking brush cat animal"]
];

const speciesSeedsThirteen: SpeciesSeedThirteen[] = speciesSeedRowsThirteen.map(([
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

export const additionalSpeciesEntriesInputThirteen = speciesSeedsThirteen.map((seed) => ({
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

export const additionalSpeciesDescriptorsThirteen = Object.fromEntries(
    speciesSeedsThirteen.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesThirteen = Object.fromEntries(
    speciesSeedsThirteen.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;
