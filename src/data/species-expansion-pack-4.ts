import {SystemsIntelligenceEntry} from "@/data/content-schema";

type SpeciesSeedFour = {
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

type SpeciesSeedFourRow = [
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

function buildSubtitleStory(seed: SpeciesSeedFour) {
    return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
}

function buildStrategicInsight(seed: SpeciesSeedFour) {
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

const speciesSeedRowsFour: SpeciesSeedFourRow[] = [
    ["jaguarundi", "Jaguarundi", "Herpailurus yagouaroundi", "Mammal", ["slender long-bodied cat frame", "short rounded ears", "low fast hunting through cover"], "dense scrub, forest edge, and riverine thicket", "Central and South America from Mexico to northern Argentina", 62, "The brushline sprint cat animal"],
    ["clouded-leopard", "Clouded Leopard", "Neofelis nebulosa", "Mammal", ["cloud-shaped coat markings", "large gripping paws", "powerful tree-climbing body"], "tropical forest, hill forest, and humid canopy cover", "South and Southeast Asia", 81, "The cloud-marked canopy cat animal"],
    ["amur-leopard", "Amur Leopard", "Panthera pardus orientalis", "Mammal", ["thick winter rosette coat", "long cold-ready limbs", "solitary forest stalking behavior"], "temperate forest, snowy hillside, and mixed woodland edge", "Russian Far East and northeastern China", 96, "The frost-forest rosette cat animal"],
    ["eurasian-lynx", "Eurasian Lynx", "Lynx lynx", "Mammal", ["tufted ears for focused listening", "long-legged snow travel", "short-tail ambush body"], "boreal forest, mountain woodland, and rocky mixed forest", "Europe and northern Asia", 67, "The tuft-eared forest stalker animal"],
    ["bobcat", "Bobcat", "Lynx rufus", "Mammal", ["short tail and spotted coat", "quiet edge-country movement", "adaptable ambush hunting"], "scrubland, forest edge, canyon country, and semi-open woodland", "North America", 38, "The short-tail edge hunter animal"],
    ["bongo", "Bongo", "Tragelaphus eurycerus", "Mammal", ["chestnut coat with pale stripes", "spiraled horns", "forest-ready powerful frame"], "lowland rainforest, montane forest, and dense woodland", "Central and East Africa", 78, "The striped rainforest antelope animal"],
    ["hirola", "Hirola", "Beatragus hunteri", "Mammal", ["long alert face", "lyre-shaped horns", "dry grassland herd vigilance"], "dry grassland, open bushland, and lightly wooded savannah", "Kenya and Somalia", 96, "The rare grassland sentinel animal"],
    ["giant-eland", "Giant Eland", "Taurotragus derbianus", "Mammal", ["very large antelope build", "spiraled horns", "deep forest and savannah movement"], "savannah woodland, forest edge, and lightly wooded grassland", "West and Central Africa", 79, "The spiral-horn forest giant animal"],
    ["topi", "Topi", "Damaliscus lunatus", "Mammal", ["sleek reddish-brown runner body", "long-faced open-country alertness", "mound-top scanning behavior"], "open savannah, floodplain grassland, and lightly wooded plain", "Eastern and southern Africa", 52, "The fast plain lookout animal"],
    ["red-river-hog", "Red River Hog", "Potamochoerus porcus", "Mammal", ["bright rusty coat", "white facial markings", "rooting power in damp cover"], "swamp forest, dense thicket, and river-edge woodland", "Central and West Africa", 58, "The red-thicket rooting animal"],
    ["sunda-flying-lemur", "Sunda Flying Lemur", "Galeopterus variegatus", "Mammal", ["full-body gliding membrane", "large night-adapted eyes", "tree-trunk clinging feet"], "rainforest canopy, plantation edge, and tropical woodland", "Southeast Asia", 63, "The gliding leaf-shadow animal"],
    ["indri", "Indri", "Indri indri", "Mammal", ["black-and-white upright body", "long carrying forest calls", "vertical trunk-clinging leaps"], "humid rainforest and montane forest", "Madagascar", 87, "The singing vertical forest animal"],
    ["coquerels-sifaka", "Coquerel's Sifaka", "Propithecus coquereli", "Mammal", ["sideways ground bounding", "long balancing tail", "powerful vertical leaps"], "dry deciduous forest and woodland", "Northwestern Madagascar", 83, "The sideways dancing lemur animal"],
    ["de-brazzas-monkey", "De Brazza's Monkey", "Cercopithecus neglectus", "Mammal", ["white beard and orange brow", "quiet river-edge movement", "branch-hopping forest body"], "swamp forest, riverine woodland, and dense tropical thicket", "Central Africa", 61, "The white-bearded river monkey animal"],
    ["golden-snub-nosed-monkey", "Golden Snub-nosed Monkey", "Rhinopithecus roxellana", "Mammal", ["blue face with upturned nose", "thick cold-mountain fur", "large social troop behavior"], "temperate mountain forest and snowy highland woodland", "Central China", 79, "The frost-faced mountain monkey animal"],
    ["francois-langur", "Francois' Langur", "Trachypithecus francoisi", "Mammal", ["black coat with pale sideburns", "cliff-and-karst agility", "leaf-focused browsing"], "limestone forest, cliffside woodland, and subtropical thicket", "China and Vietnam", 84, "The cliff-forest leaf monkey animal"],
    ["lion-tailed-macaque", "Lion-tailed Macaque", "Macaca silenus", "Mammal", ["silver mane around dark face", "small canopy troop life", "rainforest fruit foraging"], "evergreen rainforest canopy and wet forest edge", "Western Ghats of India", 86, "The silver-maned canopy monkey animal"],
    ["eastern-quoll", "Eastern Quoll", "Dasyurus viverrinus", "Mammal", ["spotted dark coat", "low night-hunting body", "quick pouncing movement"], "grassland, woodland, and cool scrub country", "Tasmania", 71, "The spotted night pouncer animal"],
    ["greater-bilby", "Greater Bilby", "Macrotis lagotis", "Mammal", ["very long rabbit-like ears", "powerful digging claws", "desert-night burrowing"], "arid grassland, dune field, and dry shrubland", "Australia", 82, "The long-eared burrower animal"],
    ["striped-hyena", "Striped Hyena", "Hyaena hyaena", "Mammal", ["bristling striped coat", "tough bone-cracking jaws", "solitary scavenging routes"], "dry scrub, rocky semi-desert, and open woodland", "North Africa, the Middle East, and South Asia", 68, "The rough-maned scavenger animal"],
    ["mainland-serow", "Mainland Serow", "Capricornis sumatraensis", "Mammal", ["stocky cliff-ready body", "short backward horns", "sure-footed steep terrain movement"], "mountain forest, rocky slope, and steep subtropical woodland", "South and Southeast Asia", 72, "The cliff-brush hoof animal"],
    ["jaguar", "Jaguar", "Panthera onca", "Mammal", ["heavy rosette-marked body", "crushing bite strength", "river-and-forest ambush movement"], "rainforest, wetland, and dense river corridor habitat", "Central and South America", 76, "The heavy rosette river cat animal"],
    ["black-footed-ferret", "Black-footed Ferret", "Mustela nigripes", "Mammal", ["long prairie-tunnel body", "dark facial mask", "burrow-chasing hunting style"], "shortgrass prairie and prairie dog colony habitat", "North America", 88, "The prairie-tunnel hunter animal"],
    ["fishing-cat", "Fishing Cat", "Prionailurus viverrinus", "Mammal", ["partially webbed feet", "stocky marsh-ready cat build", "water-edge stalking behavior"], "wetland, reedbed, mangrove, and river margin habitat", "South and Southeast Asia", 83, "The wetland stalking cat animal"],
    ["pallas-cat", "Pallas's Cat", "Otocolobus manul", "Mammal", ["flat wide face", "dense cold-steppe fur", "low stalking movement over rock"], "cold steppe, rocky grassland, and high plateau scrub", "Central Asia", 66, "The round-faced steppe cat animal"],
    ["margay", "Margay", "Leopardus wiedii", "Mammal", ["huge climbing eyes", "long balancing tail", "branch-running cat agility"], "tropical forest canopy and dense woodland edge", "Central and South America", 73, "The branch-climbing spotted cat animal"],
    ["zebra-mongoose", "Zebra Mongoose", "Mungos mungo", "Mammal", ["dark body crossed with pale stripes", "busy group foraging", "quick ground communication"], "savannah, woodland, and rocky scrub country", "Sub-Saharan Africa", 44, "The striped teamwork mongoose animal"],
    ["matschies-tree-kangaroo", "Matschie's Tree Kangaroo", "Dendrolagus matschiei", "Mammal", ["strong branch-climbing limbs", "dense mountain-forest fur", "tail-balanced canopy movement"], "montane rainforest and mossy cloud forest", "Papua New Guinea", 88, "The canopy hopping pouch animal"],
    ["black-and-rufous-elephant-shrew", "Black-and-rufous Elephant Shrew", "Rhynchocyon petersi", "Mammal", ["long flexible probing snout", "bright black-and-rufous coat", "quick leaf-litter running"], "coastal forest and dense understory woodland", "Eastern Africa", 74, "The long-snout leaf runner animal"],
    ["southern-tamandua", "Southern Tamandua", "Tamandua tetradactyla", "Mammal", ["hooked claws for tearing nests", "long sticky tongue", "tree-and-ground insect hunting"], "forest edge, savannah woodland, and tropical scrub", "South America", 57, "The hooked-claw insect hunter animal"],
    ["eurasian-spoonbill", "Eurasian Spoonbill", "Platalea leucorodia", "Bird", ["spoon-shaped probing bill", "all-white wetland body", "slow sweeping shallows feeding"], "marsh, lagoon, estuary, and floodplain wetland", "Europe, Africa, and Asia", 58, "The spoon-billed wading animal"],
    ["saddle-billed-stork", "Saddle-billed Stork", "Ephippiorhynchus senegalensis", "Bird", ["towering black-and-white body", "bright red and yellow bill", "long wetland stalking stride"], "marsh, floodplain, and shallow wetland edge", "Sub-Saharan Africa", 64, "The bright-billed marsh giant animal"],
    ["grey-crowned-crane", "Grey Crowned Crane", "Balearica regulorum", "Bird", ["golden spiky head crown", "long-legged dancing posture", "wet-meadow pair displays"], "wet grassland, marsh edge, and open savannah", "Eastern and southern Africa", 69, "The golden-crowned dance animal"],
    ["great-gray-owl", "Great Gray Owl", "Strix nebulosa", "Bird of prey", ["huge facial disc", "silent forest flight", "deep-snow listening hunt"], "boreal forest, bog edge, and cold conifer woodland", "North America and Eurasia", 59, "The giant listening forest animal"],
    ["philippine-eagle", "Philippine Eagle", "Pithecophaga jefferyi", "Bird of prey", ["massive hooked bill", "long crest feathers", "broad rainforest hunting wings"], "primary rainforest and steep forested mountain slope", "The Philippines", 97, "The storm-canopy talon animal"],
    ["palm-cockatoo", "Palm Cockatoo", "Probosciger aterrimus", "Bird", ["sooty black body", "huge curved bill", "branch-drumming display behavior"], "rainforest, savannah woodland, and tall tropical forest edge", "New Guinea and far northern Australia", 71, "The black-crested drum animal"],
    ["hyacinth-macaw", "Hyacinth Macaw", "Anodorhynchus hyacinthinus", "Bird", ["giant cobalt-blue body", "immense nut-cracking beak", "strong pair-bonded flight"], "palm savannah, seasonally flooded grassland, and woodland edge", "Central South America", 80, "The cobalt nut-cracker animal"],
    ["keel-billed-toucan", "Keel-billed Toucan", "Ramphastos sulfuratus", "Bird", ["rainbow-striped giant bill", "short rounded wings", "fruit-carrying canopy movement"], "rainforest canopy and humid forest edge", "Southern Mexico through northern South America", 46, "The rainbow-beaked fruit animal"],
    ["guianan-cock-of-the-rock", "Guianan Cock-of-the-rock", "Rupicola rupicola", "Bird", ["bright orange fan-shaped crest", "courtship dancing on display grounds", "cliff-and-forest lek behavior"], "humid rainforest, rocky outcrop, and forest ravine habitat", "Northern South America", 63, "The orange cliff dancer animal"],
    ["lammergeier", "Lammergeier", "Gypaetus barbatus", "Bird of prey", ["huge mountain wingspan", "bone-dropping feeding strategy", "beard-like facial bristles"], "high mountain cliff, alpine valley, and rocky upland", "Southern Europe, Africa, and Central Asia", 74, "The bone-dropping mountain animal"],
    ["inca-tern", "Inca Tern", "Larosterna inca", "Bird", ["white mustache-like facial plumes", "dark ocean-going body", "rocky-coast colony nesting"], "rocky coast, cold upwelling sea, and cliff edge", "Pacific coast of Peru and Chile", 68, "The mustached sea flier animal"],
    ["kori-bustard", "Kori Bustard", "Ardeotis kori", "Bird", ["heavy long-legged frame", "broad low flight", "open-savannah display strutting"], "savannah, dry grassland, and lightly wooded plain", "Eastern and southern Africa", 61, "The heavyweight grassland bird animal"],
    ["great-argus", "Great Argus", "Argusianus argus", "Bird", ["extremely long patterned wing feathers", "forest-floor courtship display", "brown leaf-litter camouflage"], "lowland rainforest and dense tropical forest floor", "Southeast Asia", 70, "The eye-feather forest animal"],
    ["superb-bird-of-paradise", "Superb Bird-of-paradise", "Lophorina superba", "Bird", ["velvet-black display plumage", "iridescent shield-like breast", "shape-changing dance posture"], "montane forest and humid rainforest display grounds", "New Guinea", 72, "The shape-shifting display animal"],
    ["african-fish-eagle", "African Fish Eagle", "Haliaeetus vocifer", "Bird of prey", ["striking white head and chest", "powerful fish-lifting talons", "far-carrying lake calls"], "lake shore, river corridor, and reservoir edge", "Sub-Saharan Africa", 48, "The lake-call hunter animal"],
    ["belted-kingfisher", "Belted Kingfisher", "Megaceryle alcyon", "Bird", ["shaggy crest and heavy bill", "loud rattling flight call", "plunge-diving fish capture"], "riverbank, marsh, estuary, and lakeshore", "North America and parts of Central America", 35, "The shaggy river rattler animal"],
    ["malachite-kingfisher", "Malachite Kingfisher", "Corythornis cristatus", "Bird", ["emerald back and orange belly", "needle-like fishing bill", "reed-perch ambush style"], "marsh, reedbed, and quiet stream edge", "Sub-Saharan Africa", 46, "The emerald reed-dart animal"],
    ["sun-conure", "Sun Conure", "Aratinga solstitialis", "Bird", ["sun-bright orange and yellow plumage", "fast noisy flock flight", "strong curved seed-cracking bill"], "savannah woodland, palm groves, and dry forest edge", "Northeastern South America", 79, "The sun-bright flock animal"],
    ["sarus-crane", "Sarus Crane", "Antigone antigone", "Bird", ["very tall gray body", "bare red head and neck", "paired wetland display dances"], "wet grassland, rice plain, and marsh edge", "South Asia, Southeast Asia, and northern Australia", 73, "The tall wetland partner animal"],
    ["american-dipper", "American Dipper", "Cinclus mexicanus", "Bird", ["stream-running songbird body", "underwater walking ability", "bold cold-river foraging"], "fast mountain stream, rocky river, and cold watercourse", "Western North America and Central America", 41, "The underwater songbird animal"],
    ["great-curassow", "Great Curassow", "Crax rubra", "Bird", ["large ground-dwelling forest body", "curly black crest", "heavy fruit-foraging stride"], "lowland rainforest and humid forest edge", "Central America and northwestern South America", 71, "The curly-crested jungle animal"],
    ["southern-ground-hornbill", "Southern Ground Hornbill", "Bucorvus leadbeateri", "Bird", ["long-lashed facial skin", "huge downward-curved bill", "ground-hunting stride"], "savannah, open woodland, and lightly wooded plain", "Eastern and southern Africa", 83, "The long-lashed ground hunter animal"],
    ["tawny-owl", "Tawny Owl", "Strix aluco", "Bird of prey", ["rounded head without ear tufts", "soft barred brown plumage", "calm woodland perch hunting"], "mixed woodland, parkland, and old forest edge", "Europe and western Asia", 37, "The dusk-wood watcher animal"],
    ["black-crowned-night-heron", "Black-crowned Night Heron", "Nycticorax nycticorax", "Bird", ["stocky night-fishing body", "black crown and back", "still twilight hunting posture"], "marsh, mangrove, pond edge, and riverbank roost habitat", "Worldwide in temperate and tropical wetlands", 42, "The night-marsh croucher animal"],
    ["blue-footed-booby", "Blue-footed Booby", "Sula nebouxii", "Bird", ["bright blue feet", "aerodynamic plunge-diving body", "cliff and island colony life"], "coastal sea, rocky island, and warm upwelling water", "Eastern Pacific coasts and islands", 55, "The blue-toed plunge animal"],
    ["red-billed-tropicbird", "Red-billed Tropicbird", "Phaethon aethereus", "Bird", ["long white tail streamers", "slender pointed red bill", "graceful open-sea flight"], "tropical ocean, cliff island, and warm coastal sea", "Tropical Atlantic, eastern Pacific, and Indian Ocean regions", 60, "The ribbon-tailed sea animal"],
    ["red-legged-honeycreeper", "Red-legged Honeycreeper", "Cyanerpes cyaneus", "Bird", ["electric blue body in males", "bright red legs", "flower-and-fruit canopy feeding"], "rainforest edge, second growth, and humid woodland", "Central America and northern South America", 36, "The candy-colored nectar animal"],
    ["white-bellied-sea-eagle", "White-bellied Sea Eagle", "Haliaeetus leucogaster", "Bird of prey", ["broad white underbody", "strong coastal soaring wings", "fish-snatching talons"], "coastline, estuary, river mouth, and offshore island habitat", "South Asia, Southeast Asia, and Australia", 52, "The surf-edge ruler animal"],
    ["pied-kingfisher", "Pied Kingfisher", "Ceryle rudis", "Bird", ["black-and-white hovering body", "straight spear-like bill", "head-first fish plunge"], "riverbank, lake shore, estuary, and marsh edge", "Africa and Asia", 39, "The hovering fish-pointer animal"],
    ["atlantic-yellow-nosed-albatross", "Atlantic Yellow-nosed Albatross", "Thalassarche chlororhynchos", "Bird", ["long gliding ocean wings", "yellow stripe along the bill", "remote island breeding life"], "open ocean, wind-rich pelagic water, and remote islands", "South Atlantic Ocean", 78, "The ocean-arc glider animal"],
    ["perentie", "Perentie", "Varanus giganteus", "Reptile", ["huge desert monitor body", "forked scent-reading tongue", "long powerful tail"], "desert, rocky outcrop, and arid scrubland", "Australia", 58, "The giant desert monitor animal"],
    ["argus-monitor", "Argus Monitor", "Varanus panoptes", "Reptile", ["long muscular wetland body", "sharp digging claws", "opportunistic raiding behavior"], "riverbank, floodplain, and tropical wetland edge", "Northern Australia and southern New Guinea", 49, "The wetland raider lizard animal"],
    ["black-caiman", "Black Caiman", "Melanosuchus niger", "Reptile", ["dark armored crocodilian body", "heavy river-holding jaws", "night-surface ambush posture"], "slow river, oxbow lake, and flooded forest", "Amazon Basin", 73, "The dark river armor animal"],
    ["yellow-anaconda", "Yellow Anaconda", "Eunectes notaeus", "Reptile", ["heavy marsh-ready coil body", "broad blotched pattern", "water-edge constricting power"], "swamp, marsh, and seasonally flooded grassland", "South America", 59, "The marsh coil hunter animal"],
    ["rhinoceros-viper", "Rhinoceros Viper", "Bitis nasicornis", "Reptile", ["horn-like nasal scales", "bold mosaic camouflage", "still leaf-litter ambush"], "rainforest floor, swamp forest, and dense humid cover", "Central and West Africa", 76, "The horn-nosed leaf viper animal"],
    ["tentacled-snake", "Tentacled Snake", "Erpeton tentaculatum", "Reptile", ["sensory tentacles on the snout", "fully aquatic body", "sideways fish ambush strike"], "still freshwater, rice-field canal, and flooded wetland", "Southeast Asia", 67, "The whiskered water ambusher animal"],
    ["paradise-flying-snake", "Paradise Flying Snake", "Chrysopelea paradisi", "Reptile", ["flattening rib-supported glide body", "tree-trunk climbing agility", "bright banded pattern"], "rainforest, mangrove edge, and tropical woodland", "Southeast Asia", 61, "The ribbon-glide tree snake animal"],
    ["radiated-tortoise", "Radiated Tortoise", "Astrochelys radiata", "Reptile", ["starburst shell pattern", "domed dryland shell", "slow thorn-scrub grazing"], "dry scrub, thorn forest, and semi-arid grassland", "Southern Madagascar", 92, "The star-shell dryland animal"],
    ["gopher-tortoise", "Gopher Tortoise", "Gopherus polyphemus", "Reptile", ["shovel-like forelimbs", "deep burrow-building shell body", "dry sandy-ground grazing"], "pine flatwood, scrub, and sandy longleaf habitat", "Southeastern United States", 75, "The burrow-digging shell animal"],
    ["red-eyed-crocodile-skink", "Red-eyed Crocodile Skink", "Tribolonotus gracilis", "Reptile", ["red-orange eye rings", "armor-like ridged scales", "low damp-forest movement"], "humid forest floor and streamside tropical cover", "New Guinea", 64, "The dragon-faced bark lizard animal"],
    ["green-mamba", "Green Mamba", "Dendroaspis angusticeps", "Reptile", ["slender bright-green body", "tree-focused fast movement", "high-alert visual posture"], "coastal forest, evergreen woodland, and dense tree cover", "Eastern and southern Africa", 69, "The branch-lightning serpent animal"],
    ["monocled-cobra", "Monocled Cobra", "Naja kaouthia", "Reptile", ["single round hood mark", "broad threat display", "ground-and-water edge hunting"], "wet grassland, agricultural edge, and low forest country", "South and Southeast Asia", 65, "The hood-marked warning snake animal"],
    ["rhinoceros-iguana", "Rhinoceros Iguana", "Cyclura cornuta", "Reptile", ["horn-like snout scales", "heavy basking body", "rocky-island territorial movement"], "dry forest, rocky scrub, and coastal island habitat", "Hispaniola", 80, "The horn-faced island lizard animal"],
    ["ploughshare-tortoise", "Ploughshare Tortoise", "Astrochelys yniphora", "Reptile", ["high-domed golden shell", "front shell projection", "slow dry-forest grazing"], "dry forest and bamboo scrub", "Northwestern Madagascar", 99, "The rare-domed treasure animal"],
    ["marbled-salamander", "Marbled Salamander", "Ambystoma opacum", "Amphibian", ["bold silver crossbands", "stout forest-floor body", "seasonal pool breeding"], "moist woodland, leaf litter, and vernal pool habitat", "Eastern United States", 48, "The silver-banded forest amphibian animal"],
    ["alpine-newt", "Alpine Newt", "Ichthyosaura alpestris", "Amphibian", ["orange belly in breeding season", "smooth pond-ready body", "dual land-and-water life cycle"], "pond, marsh edge, and cool mountain woodland", "Europe", 44, "The mountain-pond bright animal"],
    ["red-salamander", "Red Salamander", "Pseudotriton ruber", "Amphibian", ["bright red body", "dark scattered spots", "spring and seep dwelling habit"], "cool forest, spring run, and shaded stream bank", "Eastern United States", 55, "The red spring-shadow animal"],
    ["amazon-milk-frog", "Amazon Milk Frog", "Trachycephalus resinifictrix", "Amphibian", ["big silver-rimmed eyes", "banded brown-and-blue body", "tree-hole breeding habit"], "rainforest canopy, flooded forest, and humid tropical woodland", "Amazon Basin", 57, "The big-eyed canopy frog animal"],
    ["mossy-frog", "Mossy Frog", "Theloderma corticale", "Amphibian", ["bumpy green-and-black camouflage", "rock-pool clinging body", "still-water forest hiding"], "humid forest, rocky stream, and moss-covered cliff habitat", "Vietnam and southern China", 77, "The stone-and-moss mimic animal"],
    ["false-gharial", "False Gharial", "Tomistoma schlegelii", "Reptile", ["long narrow fish-catching snout", "river-specialist crocodilian body", "quiet blackwater ambush"], "swamp forest, peatland river, and flooded lowland wetland", "Southeast Asia", 88, "The long-snouted swamp crocodile animal"],
    ["shortfin-mako", "Shortfin Mako", "Isurus oxyrinchus", "Fish", ["torpedo-fast open-water body", "crescent tail for speed", "sharp conical teeth"], "bluewater ocean and offshore pelagic hunting routes", "Temperate and tropical oceans worldwide", 79, "The bluewater speed blade animal"],
    ["nurse-shark", "Nurse Shark", "Ginglymostoma cirratum", "Fish", ["broad bottom-cruising body", "barbel-framed mouth", "slow reef and sand patrol"], "reef, seagrass flat, and warm coastal seabed", "Atlantic and eastern Pacific warm waters", 42, "The bottom-cruising reef shark animal"],
    ["tasselled-wobbegong", "Tasselled Wobbegong", "Eucrossorhinus dasypogon", "Fish", ["fringed camouflaging head lobes", "flat carpet-like body", "reef-floor ambush stillness"], "coral reef and rocky tropical seafloor", "Northern Australia and nearby waters", 66, "The carpet-camouflage shark animal"],
    ["giant-freshwater-stingray", "Giant Freshwater Stingray", "Urogymnus polylepis", "Fish", ["huge river-floor disc body", "long whip-like tail", "bottom-hugging camouflage"], "large muddy river, estuary, and deep tropical freshwater channel", "South and Southeast Asia", 89, "The river-floor disc animal"],
    ["mandarinfish", "Mandarinfish", "Synchiropus splendidus", "Fish", ["electric blue and orange pattern", "hovering reef glide", "tiny mouth for small prey"], "coral reef rubble and sheltered lagoon habitat", "Western Pacific", 53, "The reef-jewel hover animal"],
    ["giant-trevally", "Giant Trevally", "Caranx ignobilis", "Fish", ["deep silver predator body", "explosive burst speed", "reef-edge schooling attack runs"], "reef edge, lagoon, estuary, and tropical coastal sea", "Indian and Pacific Oceans", 51, "The silver ambush surge animal"],
    ["pygmy-seahorse", "Pygmy Seahorse", "Hippocampus bargibanti", "Fish", ["coral-matching body bumps", "upright drifting posture", "tiny grasping tail"], "gorgonian coral reef and tropical seafan habitat", "Western Pacific", 74, "The tiny coral hitch animal"],
    ["mimic-octopus", "Mimic Octopus", "Thaumoctopus mimicus", "Marine animal", ["shape-shifting arm displays", "sand-flat camouflage", "copying multiple dangerous animals"], "shallow soft-bottom sea floor and muddy reef edge", "Southeast Asia", 72, "The disguise-switching cephalopod animal"],
    ["vaquita", "Vaquita", "Phocoena sinus", "Marine mammal", ["small dark-ringed eye patch", "compact coastal porpoise body", "quiet shallow-water movement"], "shallow coastal sea in the northern Gulf", "Northern Gulf of California", 100, "The hidden gulf porpoise animal"],
    ["bowhead-whale", "Bowhead Whale", "Balaena mysticetus", "Marine mammal", ["massive arched skull", "thick cold-ocean blubber", "ice-edge filter-feeding life"], "Arctic sea ice, cold coastal water, and polar migration route", "Arctic Ocean", 72, "The ice-browed polar giant animal"],
    ["hercules-beetle", "Hercules Beetle", "Dynastes hercules", "Insect", ["enormous horned male body", "heavy lifting strength", "rainforest night activity"], "rainforest canopy, humid forest floor, and tropical woodland", "Central and South America", 58, "The horn-lifting beetle animal"],
    ["goliath-beetle", "Goliath Beetle", "Goliathus goliatus", "Insect", ["massive armored body", "bold black-and-white pattern", "flower and sap feeding"], "tropical forest canopy and woodland edge", "Africa", 63, "The heavyweight flower beetle animal"],
    ["glasswing-butterfly", "Glasswing Butterfly", "Greta oto", "Insect", ["transparent wing panels", "slow floating forest flight", "thin dark wing borders"], "cloud forest, rainforest edge, and humid understory", "Central and South America", 54, "The transparent wing drift animal"],
    ["owl-butterfly", "Owl Butterfly", "Caligo memnon", "Insect", ["giant eye-spot wings", "dusky twilight flight", "broad leaf-like brown wings"], "rainforest edge, orchard, and humid woodland", "Central and South America", 46, "The giant eye-spot butterfly animal"],
    ["deaths-head-hawkmoth", "Death's-head Hawkmoth", "Acherontia atropos", "Insect", ["skull-like thorax marking", "powerful night flight", "deep humming wingbeat"], "woodland edge, scrub, and cultivated landscape", "Africa, Europe, and western Asia", 57, "The skull-marked night moth animal"],
    ["hummingbird-hawk-moth", "Hummingbird Hawk-Moth", "Macroglossum stellatarum", "Insect", ["hovering nectar-feeding flight", "long thin proboscis", "fast darting daytime movement"], "garden, meadow, and flower-rich woodland edge", "Europe, Asia, and North Africa", 34, "The hovering nectar moth animal"],
    ["jewel-wasp", "Jewel Wasp", "Ampulex compressa", "Insect", ["metallic green-and-red body", "precise cockroach-stinging behavior", "slender long-legged wasp frame"], "tropical woodland, garden edge, and warm urban habitat", "Africa, Asia, and Pacific regions", 48, "The mind-hacking emerald wasp animal"],
    ["trapdoor-spider", "Trapdoor Spider", "Cteniza sauvagesi", "Arachnid", ["silk-hinged burrow door", "stout digging legs", "instant strike from cover"], "scrub, rocky soil, and dry woodland ground layer", "Mediterranean region", 56, "The silk-door ambush spider animal"],
    ["vinegaroon", "Vinegaroon", "Mastigoproctus giganteus", "Arachnid", ["whip-like tail flagellum", "acidic defensive spray", "armored night-running body"], "desert scrub, rocky ground, and dry woodland", "North America", 43, "The whip-tailed acid sprayer animal"],
    ["wheel-bug", "Wheel Bug", "Arilus cristatus", "Insect", ["gear-like crest on the thorax", "piercing predatory beak", "stealthy branch-and-stem hunting"], "woodland edge, garden, and shrub-filled field margin", "North America", 39, "The cog-backed hunter insect animal"]
];

const speciesSeedsFour: SpeciesSeedFour[] = speciesSeedRowsFour.map(([
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

export const additionalSpeciesEntriesInputFour = speciesSeedsFour.map((seed) => ({
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

export const additionalSpeciesSystemsIntelligenceFour = Object.fromEntries(
    speciesSeedsFour.map((seed) => [
        seed.slug,
        {
            roleTitle: buildRoleTitle(seed.descriptor),
            specializedHardware: `${seed.traits[0]}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} give the ${seed.name} a body plan tuned for its niche.`,
            systemsScript: `${seed.name}s operate through ${lowerFirst(seed.habitat)}. Their design links movement, feeding, shelter, and timing into one workable survival system.`,
            strategicInsight: buildStrategicInsight(seed)
        } satisfies SystemsIntelligenceEntry
    ])
) as Record<string, SystemsIntelligenceEntry>;

export const additionalSpeciesDescriptorsFour = Object.fromEntries(
    speciesSeedsFour.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesFour = Object.fromEntries(
    speciesSeedsFour.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;

export const additionalSpeciesMiniSystemsFour = Object.fromEntries(
    speciesSeedsFour.map((seed) => [seed.slug, buildStrategicInsight(seed)])
) as Record<string, string>;
