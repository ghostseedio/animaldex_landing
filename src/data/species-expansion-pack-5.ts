import {SystemsIntelligenceEntry} from "@/data/content-schema";

type SpeciesSeedFive = {
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

type SpeciesSeedFiveRow = [
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

function buildSubtitleStory(seed: SpeciesSeedFive) {
    return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
}

function buildStrategicInsight(seed: SpeciesSeedFive) {
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

const speciesSeedRowsFive: SpeciesSeedFiveRow[] = [
    ["dibatag", "Dibatag", "Ammodorcas clarkei", "Mammal", ["very long thin neck", "slender pointed face", "light desert step running"], "arid bushland, open scrub, and sandy plain", "Horn of Africa", 88, "The pencil-faced desert gazelle animal"],
    ["four-horned-antelope", "Four-horned Antelope", "Tetracerus quadricornis", "Mammal", ["small body with four short horns", "chestnut forest coat", "quiet understory browsing"], "dry deciduous forest, scrub hill, and grassy woodland", "India and Nepal", 82, "The four-horn forest antelope animal"],
    ["golden-jackal", "Golden Jackal", "Canis aureus", "Mammal", ["gold-tawny canid coat", "adaptable omnivorous feeding", "dusk-and-dawn calling behavior"], "grassland, scrub, wetland edge, and farmland", "Europe, North Africa, the Middle East, and South Asia", 36, "The dusk-chorus scavenger animal"],
    ["crab-eating-fox", "Crab-eating Fox", "Cerdocyon thous", "Mammal", ["gray-and-russet fox body", "wetland-edge scavenging", "night-active open-country movement"], "savannah, marsh edge, and seasonally flooded grassland", "South America", 42, "The marsh-edge omnivore animal"],
    ["rusty-spotted-cat", "Rusty-spotted Cat", "Prionailurus rubiginosus", "Mammal", ["tiny spotted cat frame", "large night-focused eyes", "quiet thorn-scrub stalking"], "dry forest, scrubland, and rocky grassland", "India, Sri Lanka, and Nepal", 84, "The tiny spotted prowler animal"],
    ["sand-cat", "Sand Cat", "Felis margarita", "Mammal", ["furred foot pads", "broad low-set ears", "desert-night hunting"], "sand desert, stony plain, and arid scrub", "North Africa, the Middle East, and Central Asia", 79, "The dune-padded ghost cat animal"],
    ["greater-grison", "Greater Grison", "Galictis vittata", "Mammal", ["silver-backed mustelid body", "short powerful legs", "quick aggressive ground chase"], "forest edge, savannah, and wet grassland", "Central and South America", 49, "The silver-striped mustelid animal"],
    ["olingo", "Olingo", "Bassaricyon gabbii", "Mammal", ["long balancing tail", "woolly brown canopy body", "fruit-and-insect night foraging"], "cloud forest, rainforest, and humid woodland", "Central America and northwestern South America", 62, "The caramel canopy forager animal"],
    ["kipunji", "Kipunji", "Rungwecebus kipunji", "Mammal", ["upright crest of head hair", "loud honking contact calls", "montane forest troop movement"], "highland forest and mountain woodland", "Tanzania", 95, "The crest-haired mountain monkey animal"],
    ["hoolock-gibbon", "Hoolock Gibbon", "Hoolock hoolock", "Mammal", ["long arm-over-arm swinging limbs", "white brow markings", "duet-calling pair bonds"], "rainforest canopy and hill forest", "Northeast India, Bangladesh, Myanmar, and China", 83, "The whooping branch-swinger animal"],
    ["drill-monkey", "Drill Monkey", "Mandrillus leucophaeus", "Mammal", ["dark muscular monkey build", "short tail", "powerful forest-floor troop movement"], "lowland rainforest, riverine forest, and dense tropical cover", "Nigeria, Cameroon, and Bioko", 86, "The dark forest drill animal"],
    ["black-howler-monkey", "Black Howler Monkey", "Alouatta caraya", "Mammal", ["booming long-distance calls", "prehensile tail", "slow canopy leaf feeding"], "gallery forest, wet woodland, and river-edge forest", "South America", 52, "The thunder-voice canopy monkey animal"],
    ["silvery-lutung", "Silvery Lutung", "Trachypithecus cristatus", "Mammal", ["silvery-gray coat", "leaf-digesting stomach", "mangrove-and-riverine troop life"], "mangrove, coastal forest, and riverine woodland", "Java, Borneo, and Sumatra", 64, "The silver-mantled leaf monkey animal"],
    ["dusky-leaf-monkey", "Dusky Leaf Monkey", "Trachypithecus obscurus", "Mammal", ["spectacled pale eye rings", "leaf-digesting stomach", "graceful branch-running body"], "rainforest, mangrove edge, and limestone woodland", "Thailand, Malaysia, and Myanmar", 61, "The ring-eyed leaf monkey animal"],
    ["zorilla", "Zorilla", "Ictonyx striatus", "Mammal", ["bold black-and-white stripes", "pungent defensive spray", "night-active rodent hunting"], "grassland, rocky scrub, and open savannah", "Sub-Saharan Africa", 47, "The striped spray hunter animal"],
    ["giant-armadillo", "Giant Armadillo", "Priodontes maximus", "Mammal", ["massive armored digging body", "huge front claws", "night-active burrow engineering"], "savannah woodland, tropical forest, and seasonally flooded plain", "South America", 84, "The giant armor digger animal"],
    ["himalayan-tahr", "Himalayan Tahr", "Hemitragus jemlahicus", "Mammal", ["thick reddish mane", "rubber-grip mountain hooves", "steep-slope herd movement"], "alpine meadow, cliff face, and mountain shrubland", "Himalaya", 74, "The cliff-maned mountain goat animal"],
    ["sitatunga", "Sitatunga", "Tragelaphus spekii", "Mammal", ["elongated splayed hooves", "shaggy water-resistant coat", "reedbed hiding behavior"], "swamp, papyrus marsh, and flooded woodland", "Central and East Africa", 68, "The swamp-splayed antelope animal"],
    ["himalayan-goral", "Himalayan Goral", "Naemorhedus goral", "Mammal", ["compact gray mountain body", "short backward horns", "nimble rock-slope movement"], "rocky forest slope and steep mountain scrub", "Himalaya and parts of East Asia", 71, "The small cliff antelope animal"],
    ["walia-ibex", "Walia Ibex", "Capra walie", "Mammal", ["heavy ridged scimitar horns", "tan cliff-running body", "high escarpment grazing"], "steep alpine cliff and Ethiopian highland grassland", "Ethiopian Highlands", 92, "The basalt-horn highland goat animal"],
    ["lowland-anoa", "Lowland Anoa", "Bubalus depressicornis", "Mammal", ["small buffalo body", "straight pointed horns", "forest-shadow browsing"], "lowland rainforest, swamp forest, and dense thicket", "Sulawesi", 88, "The dwarf forest buffalo animal"],
    ["tufted-deer", "Tufted Deer", "Elaphodus cephalophus", "Mammal", ["dark head tuft", "small antlers in males", "fang-like upper canines"], "montane forest, bamboo understory, and misty woodland", "China and Myanmar", 73, "The fanged forest deer animal"],
    ["water-deer", "Water Deer", "Hydropotes inermis", "Mammal", ["small antlerless deer frame", "long tusk-like canines", "reedbed edge stalking"], "marsh, river meadow, and wet grassland", "China and Korea", 63, "The fang-faced marsh deer animal"],
    ["southern-viscacha", "Southern Viscacha", "Lagidium viscacia", "Mammal", ["long-plumed tail", "soft dense mountain fur", "colony life among rocks"], "rocky highland, dry slope, and Andean scrub", "Andes of South America", 54, "The whiskered rock hopper animal"],
    ["long-nosed-potoroo", "Long-nosed Potoroo", "Potorous tridactylus", "Mammal", ["pointed scenting snout", "strong hind-leg hopping", "fungus-digging forest foraging"], "heath, woodland, and dense ground cover", "Southeastern Australia and Tasmania", 77, "The root-sniffing forest hopper animal"],
    ["kowari", "Kowari", "Dasyuroides byrnei", "Mammal", ["brush-tipped tail", "big insect-hunting eyes", "sand-burrow desert sprint"], "stony desert, gibber plain, and arid grassland", "Australia", 82, "The brush-tailed desert hunter animal"],
    ["banded-linsang", "Banded Linsang", "Prionodon linsang", "Mammal", ["long ribbon-striped body", "short catlike legs", "silent branch stalking"], "rainforest canopy and dense tropical woodland", "Southeast Asia", 75, "The ribbon-striped tree hunter animal"],
    ["spotted-cuscus", "Spotted Cuscus", "Spilocuscus maculatus", "Mammal", ["slow-gripping arboreal body", "patchy spotted coat", "strong night canopy climbing"], "rainforest canopy, mangrove edge, and tropical woodland", "New Guinea and nearby islands", 59, "The spotted branch sleeper animal"],
    ["southern-hairy-nosed-wombat", "Southern Hairy-nosed Wombat", "Lasiorhinus latifrons", "Mammal", ["powerful burrowing limbs", "broad blunt muzzle", "cool-day underground sheltering"], "semi-arid scrub, grassland, and sandy plain", "South Australia", 77, "The sand-burrowing marsupial animal"],
    ["yellow-throated-marten", "Yellow-throated Marten", "Martes flavigula", "Mammal", ["gold throat and dark body", "fast climbing mustelid frame", "bold daylight hunting"], "mountain forest, mixed woodland, and rocky ravine", "South and East Asia", 58, "The gold-throated forest runner animal"],
    ["splendid-fairywren", "Splendid Fairywren", "Malurus splendens", "Bird", ["electric blue breeding plumage", "long cocked tail", "busy shrub-skirting movement"], "scrub, heath, and dry woodland", "Australia", 36, "The cobalt tail-fan bird animal"],
    ["long-wattled-umbrellabird", "Long-wattled Umbrellabird", "Cephalopterus penduliger", "Bird", ["umbrella-like head crest", "long chest wattle", "deep booming display calls"], "Choco rainforest and humid foothill forest", "Colombia and Ecuador", 90, "The umbrella-crested forest caller animal"],
    ["cinereous-vulture", "Cinereous Vulture", "Aegypius monachus", "Bird of prey", ["massive dark soaring wings", "bare blue-gray head", "high cliff nesting"], "mountain, steppe, and dry open country", "Europe and Asia", 79, "The dark mountain scavenger animal"],
    ["stellers-sea-eagle", "Steller's Sea Eagle", "Haliaeetus pelagicus", "Bird of prey", ["huge yellow bill", "white shoulder flashes", "coastal fish-lifting talons"], "icy coast, estuary, and river mouth habitat", "Russian Far East, Japan, and Korea", 83, "The ice-coast fish eagle animal"],
    ["lilac-breasted-roller", "Lilac-breasted Roller", "Coracias caudatus", "Bird", ["lilac chest and turquoise wings", "broad rolling display flight", "perch-hunting open-country style"], "savannah woodland, thornveld, and open grass country", "Eastern and southern Africa", 38, "The rainbow aerial roller animal"],
    ["helmeted-hornbill", "Helmeted Hornbill", "Rhinoplax vigil", "Bird", ["solid casque-topped bill", "long central tail feathers", "far-carrying forest calls"], "lowland rainforest and tall dipterocarp forest", "Southeast Asia", 96, "The casque-headed forest herald animal"],
    ["western-crowned-pigeon", "Western Crowned Pigeon", "Goura cristata", "Bird", ["blue lace-like crest", "deep maroon chest", "slow forest-floor strut"], "lowland rainforest and swamp forest", "New Guinea", 70, "The blue-lace crowned pigeon animal"],
    ["pink-pigeon", "Pink Pigeon", "Nesoenas mayeri", "Bird", ["soft pink body", "red bill", "island woodland flock life"], "upland forest and scrub habitat", "Mauritius", 91, "The blush island pigeon animal"],
    ["sword-billed-hummingbird", "Sword-billed Hummingbird", "Ensifera ensifera", "Bird", ["bill longer than the body", "hovering highland nectar feeding", "long narrow tail"], "cloud forest and montane woodland", "Andes of South America", 67, "The sword-beaked nectar flier animal"],
    ["guira-cuckoo", "Guira Cuckoo", "Guira guira", "Bird", ["shaggy orange crest", "long loose tail", "group hunting on open branches"], "scrub, savannah, and thorn country", "South America", 40, "The ragged-crested group hunter animal"],
    ["satin-bowerbird", "Satin Bowerbird", "Ptilonorhynchus violaceus", "Bird", ["glossy blue-black male plumage", "carefully built stick bower", "blue-object collecting behavior"], "rainforest edge, wet woodland, and mountain forest", "Eastern Australia", 49, "The blue-collector courtship bird animal"],
    ["wilsons-bird-of-paradise", "Wilson's Bird-of-paradise", "Cicinnurus respublica", "Bird", ["spiraled tail wires", "bright turquoise crown patch", "cleared-court dancing display"], "hill forest and humid island rainforest", "West Papua", 86, "The neon-crowned display bird animal"],
    ["spectacled-owl", "Spectacled Owl", "Pulsatrix perspicillata", "Bird of prey", ["white facial spectacles", "broad forest wings", "low-voiced night calls"], "rainforest and dense tropical woodland", "Central and South America", 64, "The white-faced jungle owl animal"],
    ["northern-hawk-owl", "Northern Hawk Owl", "Surnia ulula", "Bird of prey", ["long tail for an owl", "hawk-like daytime hunting", "boreal perch scanning"], "boreal forest and open taiga edge", "North America and Eurasia", 49, "The daylight boreal owl animal"],
    ["pied-avocet", "Pied Avocet", "Recurvirostra avosetta", "Bird", ["upcurved needle-thin bill", "black-and-white wading body", "side-sweeping shallows feeding"], "estuary, salt pan, and lagoon shallows", "Europe, Africa, and Asia", 47, "The upcurved-bill lagoon sweeper animal"],
    ["african-openbill", "African Openbill", "Anastomus lamelligerus", "Bird", ["gap between upper and lower mandibles", "black-and-white stork body", "snail-specialist wetland feeding"], "marsh, lake edge, and floodplain habitat", "Sub-Saharan Africa", 51, "The gap-billed snail hunter animal"],
    ["hammerkop", "Hammerkop", "Scopus umbretta", "Bird", ["hammer-shaped head crest", "huge stick nest building", "wading edge hunting"], "wetland, riverbank, and savannah pond", "Africa and Madagascar", 45, "The hammer-headed nest builder animal"],
    ["king-vulture", "King Vulture", "Sarcoramphus papa", "Bird", ["multicolored bare head", "broad high-soaring wings", "heavy carrion-opening bill"], "lowland forest, woodland edge, and tropical clearings", "Central and South America", 62, "The painted carrion king animal"],
    ["bateleur", "Bateleur", "Terathopius ecaudatus", "Bird of prey", ["very short tail", "rocking aerial posture", "bright red face and legs"], "savannah, open woodland, and dry bush country", "Sub-Saharan Africa", 73, "The rocking sky acrobat animal"],
    ["abyssinian-ground-hornbill", "Abyssinian Ground Hornbill", "Bucorvus abyssinicus", "Bird", ["bare red facial skin", "huge downward-curved bill", "long-striding ground hunt"], "dry savannah, thorn scrub, and open woodland", "Northern Sub-Saharan Africa", 72, "The red-faced ground hornbill animal"],
    ["horned-puffin", "Horned Puffin", "Fratercula corniculata", "Bird", ["small yellow eye horns", "thick bright bill", "cliff colony diving life"], "rocky sea cliff, cold offshore water, and island nesting ledge", "North Pacific", 59, "The horn-faced sea clown animal"],
    ["takahe", "Takahe", "Porphyrio hochstetteri", "Bird", ["heavy cobalt flightless body", "thick red bill", "alpine tussock grazing"], "alpine grassland and wet mountain valley", "New Zealand", 97, "The heavy blue grass rail animal"],
    ["ibisbill", "Ibisbill", "Ibidorhyncha struthersii", "Bird", ["downcurved coral-red bill", "gray river-stone plumage", "swift braided-river running"], "shingle riverbed, alpine stream, and mountain valley", "Himalaya and Central Asia", 72, "The curved-bill river stonebird animal"],
    ["anhinga", "Anhinga", "Anhinga anhinga", "Bird", ["spear-straight bill", "snake-like swimming neck", "wing-spreading drying posture"], "swamp, slow river, and marsh edge", "The Americas", 41, "The snake-necked water spear animal"],
    ["spoon-billed-sandpiper", "Spoon-billed Sandpiper", "Calidris pygmaea", "Bird", ["tiny spoon-shaped bill tip", "small shorebird running gait", "long-distance migratory route"], "coastal mudflat, estuary, and Arctic breeding tundra", "Northeastern Russia and Asian flyway coasts", 98, "The tiny spoon-billed shore runner animal"],
    ["harlequin-duck", "Harlequin Duck", "Histrionicus histrionicus", "Bird", ["bold slate-and-white pattern", "white face crescents", "torrent-riding river dives"], "fast cold river, rocky coast, and mountain stream", "Northern Hemisphere coasts and rivers", 56, "The painted whitewater duck animal"],
    ["greater-adjutant", "Greater Adjutant", "Leptoptilos dubius", "Bird", ["massive bald-headed stork frame", "dangling neck pouch", "slow scavenging wetland stride"], "wetland, floodplain, and urban dump edge", "India and Cambodia", 91, "The giant pouch-throated stork animal"],
    ["great-potoo", "Great Potoo", "Nyctibius grandis", "Bird", ["huge mouth and tiny bill", "bark-mimicking perch posture", "giant night-adapted eyes"], "lowland forest, riverine woodland, and tropical edge habitat", "Central and South America", 52, "The ghost-log night bird animal"],
    ["bare-throated-bellbird", "Bare-throated Bellbird", "Procnias nudicollis", "Bird", ["bare green throat skin", "metal-loud ringing call", "fruit-carrying forest flight"], "Atlantic forest, canopy edge, and humid woodland", "Brazil, Paraguay, and Argentina", 77, "The bell-voice canopy bird animal"],
    ["southern-rockhopper-penguin", "Southern Rockhopper Penguin", "Eudyptes chrysocome", "Bird", ["spiky yellow eyebrow plumes", "red eyes", "cliff-hopping colony life"], "windy subantarctic island coast and rocky surf edge", "Southern Ocean islands", 83, "The yellow-brow cliff penguin animal"],
    ["earless-monitor-lizard", "Earless Monitor Lizard", "Lanthanotus borneensis", "Reptile", ["bead-scaled dark brown body", "small external-earless head", "secretive streamside burrowing"], "humid riverbank forest and mossy lowland stream habitat", "Borneo", 97, "The hidden Bornean monitor animal"],
    ["pig-nosed-turtle", "Pig-nosed Turtle", "Carettochelys insculpta", "Reptile", ["flipper-like forelimbs", "piglike snorkel snout", "strong river-swimming body"], "river channel, lagoon, and freshwater swamp", "New Guinea and northern Australia", 82, "The flipper-faced river turtle animal"],
    ["mary-river-turtle", "Mary River Turtle", "Elusor macrurus", "Reptile", ["green algae-growing head hair", "large paddle feet", "river-bottom basking and grazing"], "clear river and submerged log habitat", "Queensland, Australia", 93, "The algae-crowned river turtle animal"],
    ["mangshan-pit-viper", "Mangshan Pit Viper", "Protobothrops mangshanensis", "Reptile", ["jade green patterned body", "heat-sensing pit organs", "heavy still ambush coils"], "mountain forest, bamboo thicket, and humid ravine", "China", 94, "The jade mountain viper animal"],
    ["gargoyle-gecko", "Gargoyle Gecko", "Rhacodactylus auriculatus", "Reptile", ["hornlike cranial bumps", "prehensile tail grip", "night arboreal hopping"], "humid forest and shrubland", "New Caledonia", 66, "The horned night gecko animal"],
    ["shingleback-skink", "Shingleback Skink", "Tiliqua rugosa", "Reptile", ["short stump tail", "pinecone-like heavy scales", "slow bluffing movement"], "dry scrub, open woodland, and arid grass edge", "Australia", 50, "The pinecone-tailed skink animal"],
    ["rhinoceros-rat-snake", "Rhinoceros Rat Snake", "Gonyosoma boulengeri", "Reptile", ["horn-like nasal scales", "green arboreal body", "branch-to-branch climbing agility"], "subtropical forest and limestone woodland", "Vietnam and southern China", 79, "The horn-nosed vine snake animal"],
    ["panther-chameleon", "Panther Chameleon", "Furcifer pardalis", "Reptile", ["brilliant shifting color bands", "turreted independent eyes", "gripping zygodactyl feet"], "coastal forest, scrub, and planted woodland", "Madagascar", 59, "The color-flare branch watcher animal"],
    ["crocodile-monitor", "Crocodile Monitor", "Varanus salvadorii", "Reptile", ["very long muscular tail", "powerful climbing claws", "big riverbank monitor frame"], "mangrove, river forest, and lowland rainforest", "New Guinea", 76, "The river-claw giant monitor animal"],
    ["chinese-water-dragon", "Chinese Water Dragon", "Physignathus cocincinus", "Reptile", ["bright green streamside body", "long balancing tail", "water-diving escape behavior"], "riverbank forest, humid ravine, and subtropical woodland", "Southeast Asia", 51, "The green river dragon animal"],
    ["giant-leaf-tailed-gecko", "Giant Leaf-tailed Gecko", "Uroplatus fimbriatus", "Reptile", ["bark-textured flattened body", "fringed camouflage skin", "tree-trunk hugging posture"], "humid rainforest and mossy forest trunk habitat", "Madagascar", 79, "The bark-shadow gecko animal"],
    ["greater-siren", "Greater Siren", "Siren lacertina", "Amphibian", ["eel-like body without hind limbs", "external gills", "muddy swamp hiding"], "pond, marsh, and blackwater wetland", "Southeastern United States", 55, "The eel-bodied swamp salamander animal"],
    ["titicaca-water-frog", "Titicaca Water Frog", "Telmatobius culeus", "Amphibian", ["deeply wrinkled water-breathing skin", "large lake-dwelling body", "cold high-altitude aquatic life"], "high-altitude lake and reedbed shallows", "Lake Titicaca basin", 95, "The wrinkled lake giant frog animal"],
    ["malayan-horned-frog", "Malayan Horned Frog", "Megophrys nasuta", "Amphibian", ["horn-like eyelid points", "leaf-litter camouflage body", "wide ambush mouth"], "rainforest floor and shaded streamside leaf litter", "Southeast Asia", 69, "The leaf-horn ambush frog animal"],
    ["marbled-newt", "Marbled Newt", "Triturus marmoratus", "Amphibian", ["green-and-black marbled pattern", "orange dorsal stripe in breeding season", "pond-to-woodland seasonal movement"], "pond edge, cork oak woodland, and damp meadow", "Iberia and France", 57, "The green-mosaic newt animal"],
    ["golden-poison-frog", "Golden Poison Frog", "Phyllobates terribilis", "Amphibian", ["intense yellow warning skin", "tiny agile body", "powerful skin toxins"], "humid rainforest floor and streamside tropical cover", "Colombia", 85, "The gold warning dart animal"],
    ["giant-waxy-monkey-tree-frog", "Giant Waxy Monkey Tree Frog", "Phyllomedusa bicolor", "Amphibian", ["thick waxy skin", "gripping handlike feet", "slow branch-walking posture"], "Amazonian rainforest canopy and humid woodland edge", "Amazon Basin", 72, "The wax-skinned branch frog animal"],
    ["alpine-salamander", "Alpine Salamander", "Salamandra atra", "Amphibian", ["glossy black mountain body", "live-bearing alpine reproduction", "slow wet-weather ridge movement"], "alpine meadow, rocky slope, and mountain forest edge", "Central and southern Europe", 69, "The black mountain salamander animal"],
    ["budgetts-frog", "Budgett's Frog", "Lepidobatrachus laevis", "Amphibian", ["wide flat head", "huge mouth", "defensive screaming inflation"], "seasonal marsh, pond, and flooded grassland", "Paraguay, Argentina, and Bolivia", 60, "The grumpy dinner-plate frog animal"],
    ["spanish-ribbed-newt", "Spanish Ribbed Newt", "Pleurodeles waltl", "Amphibian", ["rib-pushing defensive spines", "olive aquatic body", "pond-breeding flexibility"], "pond, irrigation ditch, and seasonal wetland", "Iberian Peninsula and Morocco", 53, "The rib-spined defense newt animal"],
    ["opah", "Opah", "Lampris guttatus", "Fish", ["round metallic body", "warm-blooded deep-water muscles", "long cruising fin beats"], "open ocean and deep pelagic water", "Worldwide tropical and temperate seas", 63, "The warm-blooded open-ocean disc animal"],
    ["ribbon-eel", "Ribbon Eel", "Rhinomuraena quaesita", "Fish", ["electric blue ribbon body", "wide gaping yellow mouth", "burrow-peeking reef behavior"], "coral sand flat and lagoon reef", "Indo-Pacific", 71, "The neon ribbon reef animal"],
    ["wolf-eel", "Wolf Eel", "Anarrhichthys ocellatus", "Fish", ["long wrinkled eel-like body", "huge blunt jaws", "rock-crevice pair bonding"], "cold rocky reef and kelp coast", "North Pacific", 52, "The cave-faced coastal fish animal"],
    ["napoleon-wrasse", "Napoleon Wrasse", "Cheilinus undulatus", "Fish", ["large hump-headed reef body", "thick lips", "crushing shellfish jaws"], "coral reef slope, lagoon, and clear tropical sea", "Indo-Pacific", 90, "The hump-headed reef giant animal"],
    ["humphead-parrotfish", "Humphead Parrotfish", "Bolbometopon muricatum", "Fish", ["bulging forehead", "beaklike coral-crushing mouth", "schooling reef grazing"], "coral reef slope and lagoon habitat", "Indo-Pacific", 87, "The coral-crushing reef grazer animal"],
    ["alligator-gar", "Alligator Gar", "Atractosteus spatula", "Fish", ["long armored gar body", "broad toothy snout", "surface-cruising ambush style"], "slow river, backwater, and brackish estuary habitat", "Southern United States and Mexico", 64, "The armor-snouted river predator animal"],
    ["clown-triggerfish", "Clown Triggerfish", "Balistoides conspicillum", "Fish", ["bold black body with white spots", "yellow snout pattern", "trigger-spine reef defense"], "coral reef, lagoon, and tropical drop-off", "Indo-Pacific", 50, "The spotted reef trigger animal"],
    ["giant-grouper", "Giant Grouper", "Epinephelus lanceolatus", "Fish", ["massive heavy reef body", "huge suction-feeding mouth", "slow ambush cave patrol"], "coral reef, wreck, and tropical rocky seafloor", "Indo-Pacific", 73, "The cave-mouth reef giant animal"],
    ["largetooth-sawfish", "Largetooth Sawfish", "Pristis pristis", "Fish", ["long tooth-lined saw rostrum", "broad estuary-moving body", "muddy-water bottom cruising"], "river mouth, estuary, and large tropical river", "Tropical Atlantic, Pacific, and Indian Ocean regions", 98, "The saw-snouted estuary ghost animal"],
    ["oarfish", "Oarfish", "Regalecus glesne", "Fish", ["extremely long ribbon body", "crimson dorsal crest", "deep open-water drifting"], "deep pelagic ocean", "Worldwide seas", 80, "The ribbon-bodied deep drifter animal"],
    ["dobsonfly", "Dobsonfly", "Corydalus cornutus", "Insect", ["huge veined wings", "antler-like male mandibles", "aquatic larval life"], "streamside forest and river margin", "North America", 48, "The antler-jawed river insect animal"],
    ["orchid-bee", "Orchid Bee", "Euglossa dilemma", "Insect", ["metallic jewel-green body", "long nectar tongue", "fragrance-collecting male behavior"], "tropical forest, garden edge, and flowering woodland", "Central America and the Caribbean", 47, "The perfume-collecting jewel bee animal"],
    ["cecropia-moth", "Cecropia Moth", "Hyalophora cecropia", "Insect", ["giant russet wings with pale crescents", "fuzzy red-and-white body", "short-lived adult emergence"], "deciduous woodland and suburban tree cover", "North America", 41, "The giant red-ring silk animal"],
    ["comet-moth", "Comet Moth", "Argema mittrei", "Insect", ["golden yellow silk-moth wings", "very long ribbon tails", "brief breeding-focused adult life"], "rainforest and humid woodland edge", "Madagascar", 72, "The ribbon-tailed night silk animal"],
    ["giant-african-millipede", "Giant African Millipede", "Archispirostreptus gigas", "Arthropod", ["many ringed body segments", "slow armored crawling", "coiling detritus-feeding behavior"], "forest floor, moist savannah edge, and leaf litter", "East Africa", 40, "The coiling forest recycler animal"],
    ["ogre-faced-spider", "Ogre-faced Spider", "Deinopis spinosa", "Arachnid", ["oversized forward eyes", "handheld net-like silk web", "nighttime net-casting strike"], "forest edge and leafy understory", "Southeastern North America and the Caribbean", 58, "The net-casting moon hunter animal"],
    ["giant-forest-scorpion", "Giant Forest Scorpion", "Heterometrus swammerdami", "Arachnid", ["massive black clawed body", "thick defensive pincers", "night burrow waiting"], "humid forest floor, plantation edge, and tropical scrub", "India and Sri Lanka", 61, "The black iron scorpion animal"],
    ["tailless-whip-scorpion", "Tailless Whip Scorpion", "Damon diadema", "Arachnid", ["whip-like sensory front legs", "flattened wall-clinging body", "cave-and-bark night stalking"], "rock crevice, cave entrance, and dry woodland shelter", "East Africa", 58, "The whip-armed wall hunter animal"],
    ["spiny-devil-katydid", "Spiny Devil Katydid", "Panacanthus cuspidatus", "Insect", ["thorn-covered bright green body", "huge leaf-mimicking wings", "canopy chewing stillness"], "cloud forest and humid mountain woodland", "Central America", 65, "The thorn-armored canopy katydid animal"],
    ["giraffe-weevil", "Giraffe Weevil", "Trachelophorus giraffa", "Insect", ["extra-long neck in males", "red wing covers", "rolled-leaf nesting behavior"], "forest, shrubland, and leaf-rich woodland edge", "Madagascar", 70, "The long-necked leaf roller animal"]
];

const speciesSeedsFive: SpeciesSeedFive[] = speciesSeedRowsFive.map(([
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

export const additionalSpeciesEntriesInputFive = speciesSeedsFive.map((seed) => ({
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

export const additionalSpeciesSystemsIntelligenceFive = Object.fromEntries(
    speciesSeedsFive.map((seed) => [
        seed.slug,
        {
            roleTitle: buildRoleTitle(seed.descriptor),
            specializedHardware: `${seed.traits[0]}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} give the ${seed.name} a body plan tuned for its niche.`,
            systemsScript: `${seed.name}s operate through ${lowerFirst(seed.habitat)}. Their design links movement, feeding, shelter, and timing into one workable survival system.`,
            strategicInsight: buildStrategicInsight(seed)
        } satisfies SystemsIntelligenceEntry
    ])
) as Record<string, SystemsIntelligenceEntry>;

export const additionalSpeciesDescriptorsFive = Object.fromEntries(
    speciesSeedsFive.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesFive = Object.fromEntries(
    speciesSeedsFive.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;

export const additionalSpeciesMiniSystemsFive = Object.fromEntries(
    speciesSeedsFive.map((seed) => [seed.slug, `${seed.name} thrives by using ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} in ${lowerFirst(seed.habitat)}.`])
) as Record<string, string>;
