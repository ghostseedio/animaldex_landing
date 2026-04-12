type SpeciesSeedTen = {
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

type SpeciesSeedTenRow = [
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

function buildSubtitleStory(seed: SpeciesSeedTen) {
    switch (seed.slug) {
        case "pika":
            return "The Pika is a small mountain mammal with rounded ears and a compact body that lives among cool broken rocks. It gathers mouthfuls of plants into haypiles before winter, showing how preparation matters when the hard season is coming.";
        case "snake":
            return "The Snake is a limbless reptile that uses its tongue to read scent in the air and its scales to move through grass, soil, and water. It survives in many different habitats because its whole body is built for efficient motion without wasted parts.";
        case "carp":
            return "The Carp is a sturdy freshwater fish that searches the bottom with a barbel-fringed mouth for edible bits in mud and weeds. It turns ponds and slow rivers into reliable feeding ground by staying patient and close to the substrate.";
        case "owl":
            return "The Owl is a bird with forward-facing eyes, soft flight feathers, and hearing tuned for the dark. It can locate small movement at night by listening carefully and flying with almost no sound.";
        case "domestic-chicken":
            return "The Chicken is a familiar ground bird that scratches for seeds and insects with its feet while staying close to the flock. It does best when quick signals, shared awareness, and simple routines keep the group moving together.";
        case "shark":
            return "The Shark is a fish built with a flexible cartilaginous frame, exposed gill slits, and teeth that are replaced again and again. Its design stays effective because nearly every part of the body is tuned for sensing, swimming, and biting in moving water.";
        case "seal":
            return "The Seal is a marine mammal with a streamlined body, thick blubber, and strong flippers for cold-water swimming. It moves easily between shore and sea because insulation, shape, and propulsion all work as one system.";
        case "penguin":
            return "The Penguin is a seabird that stands upright on land but turns into a fast underwater hunter once it enters the sea. Its flipper-like wings and dense waterproof feathers make cold water a place it can use instead of fear.";
        case "otter":
            return "The Otter is a sleek waterside mammal with dense fur and a flexible body that helps it twist, dive, and chase through rivers and wetlands. It looks playful, but that movement is also a precise way of hunting in a fast-changing edge habitat.";
        case "deer":
            return "The Deer is a long-legged grazer with alert ears and quick reactions that help it read open edges before danger gets too close. It survives by noticing change early and turning speed into distance at the right moment.";
        case "robin":
            return "The Robin is a compact songbird that watches the ground closely before hopping in to grab worms, insects, and other small food. It makes ordinary gardens and woodland edges useful by staying observant and moving with quick precision.";
        case "finch":
            return "The Finch is a small bird with a short conical bill made for cracking seeds that many other animals leave behind. It succeeds by matching a specialized tool to a common resource and using it again and again.";
        case "lizard":
            return "The Lizard is a scaled reptile that depends on warmth, quick stop-start movement, and sharp timing to stay effective. It uses heat, cover, and sudden bursts of motion to make a small body feel much harder to catch.";
        case "crab":
            return "The Crab is a hard-shelled animal with a sideways body plan and strong front claws for feeding and defense. Its shape looks unusual, but every part helps it move through tight shorelines, muddy banks, and reef cracks with control.";
        case "fox":
            return "The Fox is a narrow-faced hunter with a bushy tail and flexible habits that let it live at the edge of wild and human spaces. It stays successful by adjusting its tactics to whatever food, cover, and opportunity the landscape offers.";
        case "cormorant":
            return "The Cormorant is a dark waterbird with a hooked bill and a low-riding posture that helps it dive after fish. It turns coastline, lakes, and estuaries into hunting lanes by pursuing prey underwater instead of waiting above it.";
        case "cat":
            return "The Cat is a soft-footed predator with retractable claws, forward-facing eyes, and a body made for stalking and pouncing. It shows how patience, quiet movement, and short explosive action can work better than constant effort.";
        case "grasshopper":
            return "The Grasshopper is an insect with powerful hind legs and body colors that blend into stems, leaves, and dry ground. It survives by staying hard to notice until one sudden jump creates the space it needs.";
        default:
            return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
    }
}

const speciesSeedRowsTen: SpeciesSeedTenRow[] = [
    ["pika", "Pika", "Ochotona spp.", "Mammal", ["rounded ears", "compact alpine body", "high-pitched warning calls"], "talus slope, alpine meadow, and cool mountain rock field", "Asia and western North America", 66, "The alpine stone-cache squeaker animal"],
    ["snake", "Snake", "Serpentes", "Reptile", ["elongated limbless body", "forked scenting tongue", "overlapping protective scales"], "forest, grassland, wetland, desert, and agricultural edge", "Worldwide except Antarctica", 34, "The limbless scent-tracking survivor animal"],
    ["carp", "Carp", "Cyprinus carpio", "Fish", ["deep-bodied freshwater frame", "barbel-fringed mouth", "bottom-feeding river and pond movement"], "pond, lake, reservoir, and slow river", "Native to Eurasia and introduced worldwide", 28, "The bottom-feeding freshwater forager animal"],
    ["owl", "Owl", "Strigiformes", "Bird", ["forward-facing eyes", "soft silent flight feathers", "night-adapted hearing"], "forest, farmland, scrub, grassland, and urban edge", "Worldwide except Antarctica", 49, "The silent night-listening hunter animal"],
    ["domestic-chicken", "Chicken", "Gallus gallus domesticus", "Bird", ["short rounded bill", "ground-scratching feet", "dense barnyard flock behavior"], "farmyard, village edge, garden, and managed grass run", "Domestic worldwide", 12, "The ground-scratching flock signaler animal"],
    ["shark", "Shark", "Selachimorpha", "Fish", ["cartilaginous body structure", "multiple gill slits", "continuous tooth replacement"], "coastal sea, reef edge, open ocean, and estuary", "Oceans worldwide", 52, "The sensing open-water predator animal"],
    ["seal", "Seal", "Pinnipedia", "Mammal", ["streamlined marine body", "thick insulating blubber", "flipper-driven swimming"], "coastline, ice edge, estuary, and offshore sea", "Polar, temperate, and some tropical coasts worldwide", 58, "The blubber-built coastal diver animal"],
    ["penguin", "Penguin", "Spheniscidae", "Bird", ["upright seabird posture", "flipper-like wings", "dense waterproof plumage"], "southern ocean coast, island colony, and cold marine feeding ground", "Southern Hemisphere", 63, "The cold-current torpedo bird animal"],
    ["otter", "Otter", "Lutrinae", "Mammal", ["elongated flexible body", "dense water-shedding fur", "playful but efficient swimming"], "river, lake, wetland, estuary, and coastal kelp edge", "Multiple species across the Americas, Europe, Asia, and Africa", 57, "The playful river-rolling hunter animal"],
    ["deer", "Deer", "Cervidae", "Mammal", ["long-legged grazing build", "alert mobile ears", "seasonal antlers in many species"], "forest, meadow, wetland edge, and scrubland", "Worldwide except Antarctica and Australia without introductions", 39, "The alert edge-grazing runner animal"],
    ["robin", "Robin", "Erithacus and Turdus relatives", "Bird", ["compact songbird body", "upright perch posture", "quick ground-hopping foraging"], "garden, woodland edge, hedgerow, and parkland", "Europe, Asia, Australasia, and the Americas depending on species", 31, "The red-breasted garden song scout animal"],
    ["finch", "Finch", "Fringillidae and related finch groups", "Bird", ["short conical seed bill", "rapid flock movement", "musical contact calls"], "grassland, scrub, woodland edge, and garden", "Worldwide in many habitats", 29, "The seed-cracking flock songbird animal"],
    ["lizard", "Lizard", "Lacertilia", "Reptile", ["scaled four-limbed body", "heat-driven activity rhythm", "quick stop-start movement"], "desert, forest, scrub, grassland, rock face, and urban wall", "Worldwide except Antarctica", 33, "The sun-warmed quick-dart reptile animal"],
    ["crab", "Crab", "Brachyura", "Crustacean", ["sideways-walking body plan", "hard protective carapace", "front claws for feeding and defense"], "reef, shore, estuary, mangrove, riverbank, and seabed", "Marine and freshwater systems worldwide", 37, "The hard-shelled sideways walker animal"],
    ["fox", "Fox", "Vulpes and related canids", "Mammal", ["narrow muzzle", "bushy balancing tail", "quiet opportunistic hunting"], "forest edge, grassland, farmland, tundra, and suburban fringe", "Europe, Asia, Africa, North America, and introduced regions", 36, "The quiet edge-country opportunist animal"],
    ["cormorant", "Cormorant", "Phalacrocoracidae", "Bird", ["long hooked bill", "low-riding water posture", "pursuit-diving fish hunt"], "coastline, estuary, lake, river mouth, and offshore rock", "Worldwide on coasts and inland waters", 42, "The hooked-bill fish-diving hunter animal"],
    ["cat", "Cat", "Felis catus", "Mammal", ["retractable claws", "forward-facing predator eyes", "stalking and pouncing movement"], "home, garden, farmyard, alley, and urban edge", "Domestic worldwide", 14, "The soft-footed ambush pouncer animal"],
    ["grasshopper", "Grasshopper", "Caelifera", "Insect", ["powerful jumping hind legs", "straight narrow antennae", "grassland camouflage coloration"], "grassland, meadow, cropland, scrub, and open field edge", "Worldwide in warm and temperate regions", 27, "The spring-legged grassland jumper animal"]
];

const speciesSeedsTen: SpeciesSeedTen[] = speciesSeedRowsTen.map(([
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

export const additionalSpeciesEntriesInputTen = speciesSeedsTen.map((seed) => ({
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

export const additionalSpeciesDescriptorsTen = Object.fromEntries(
    speciesSeedsTen.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesTen = Object.fromEntries(
    speciesSeedsTen.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;
