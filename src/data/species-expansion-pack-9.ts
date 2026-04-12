import {SystemsIntelligenceEntry} from "@/data/content-schema";

type SpeciesSeedNine = {
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

type SpeciesSeedNineRow = [
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

function buildSubtitleStory(seed: SpeciesSeedNine) {
    return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
}

function buildStrategicInsight(seed: SpeciesSeedNine) {
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

    if (/(river|wetland|swamp|mangrove|estuary|marsh|floodplain|lake)/.test(habitat)) {
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

export const speciesSeedRowsNine: SpeciesSeedNineRow[] = [
    ["saimaa-ringed-seal", "Saimaa Ringed Seal", "Phoca hispida saimensis", "Mammal", ["ringed gray coat", "thick freshwater seal body", "snow-lair breeding on lake ice"], "freshwater lake, winter ice sheet, and reed-fringed shoreline", "Lake Saimaa, Finland", 98, "The lake-locked ringed seal animal"],
    ["visayan-warty-pig", "Visayan Warty Pig", "Sus cebifrons", "Mammal", ["bristled dark island coat", "facial wart bumps", "forest-rooting herd behavior"], "rainforest, grassland edge, and island thicket", "Visayan Islands, Philippines", 97, "The warty island pig animal"],
    ["red-wolf", "Red Wolf", "Canis rufus", "Mammal", ["slim reddish canid frame", "long-legged wetland stride", "pair-and-pack territory calling"], "coastal prairie, pine savannah, and marsh edge", "Reintroduced southeastern United States populations", 96, "The red ghost wolf animal"],
    ["pacarana", "Pacarana", "Dinomys branickii", "Mammal", ["heavy spotted rodent body", "blunt broad muzzle", "slow cliffside climbing"], "cloud forest, rocky ravine, and humid mountain slope", "Andean regions of South America", 78, "The spotted mountain rodent animal"],
    ["javan-slow-loris", "Javan Slow Loris", "Nycticebus javanicus", "Mammal", ["huge forward-facing eyes", "toxic defensive bite", "slow branch-crawling grip"], "rainforest canopy, bamboo grove, and secondary woodland", "Java, Indonesia", 95, "The slow-eyed night primate animal"],
    ["bush-hyrax", "Bush Hyrax", "Heterohyrax brucei", "Mammal", ["rounded ears", "rubbery climbing feet", "sunning rock-perch posture"], "rocky kopje, cliff, and dry woodland edge", "Eastern and southern Africa", 55, "The rock-perched hyrax animal"],
    ["tree-hyrax", "Tree Hyrax", "Dendrohyrax arboreus", "Mammal", ["dense woolly coat", "bark-brown camouflage", "night canopy climbing"], "montane forest, dense woodland, and ravine thicket", "Central and East Africa", 70, "The bark-camouflage hyrax animal"],
    ["naked-mole-rat", "Naked Mole-rat", "Heterocephalus glaber", "Mammal", ["hairless wrinkled body", "protruding digging incisors", "eusocial tunnel-colony life"], "arid soil, underground burrow network, and dry grassland", "East Africa", 88, "The tunnel-colony mole-rat animal"],
    ["blue-duiker", "Blue Duiker", "Philantomba monticola", "Mammal", ["tiny blue-gray antelope frame", "short spike horns", "leaf-litter darting escape"], "lowland rainforest, forest edge, and dense undergrowth", "Central and West Africa", 67, "The tiny blue forest antelope animal"],
    ["mountain-zebra", "Mountain Zebra", "Equus zebra", "Mammal", ["black-and-white striping", "gridiron rump pattern", "steep-slope sure-footing"], "mountain grassland, rocky escarpment, and semi-arid plateau", "Southern Africa", 76, "The cliff-striped zebra animal"],
    ["suni", "Suni", "Neotragus moschatus", "Mammal", ["tiny chestnut antelope body", "huge alert ears", "thorn-thicket zigzag hiding"], "coastal forest, scrub, and thornbush", "East Africa", 65, "The thorn-shadow antelope animal"],
    ["hartebeest", "Hartebeest", "Alcelaphus buselaphus", "Mammal", ["elongated narrow face", "high-shouldered running build", "sweeping open-plain vigilance"], "savannah, open grassland, and lightly wooded plain", "Africa", 58, "The long-faced plain antelope animal"],
    ["black-and-white-ruffed-lemur", "Black-and-white Ruffed Lemur", "Varecia variegata", "Mammal", ["black-and-white shaggy coat", "loud carrying calls", "fruit-heavy canopy feeding"], "rainforest canopy, river valley forest, and humid hillside woodland", "Madagascar", 90, "The ruffed canopy lemur animal"],
    ["common-gundi", "Common Gundi", "Ctenodactylus gundi", "Mammal", ["flattened rock-hugging body", "comb-like grooming claws", "communal sun-basking"], "desert cliff, rocky outcrop, and dry wadi slope", "North Africa", 54, "The rock-hugging gundi animal"],
    ["hog-deer", "Hog Deer", "Axis porcinus", "Mammal", ["low-slung deer body", "hog-like head carriage", "reedbed dashing movement"], "grassland, river floodplain, and tall reed cover", "South and Southeast Asia", 82, "The reed-dashing deer animal"],
    ["japanese-serow", "Japanese Serow", "Capricornis crispus", "Mammal", ["shaggy goat-antelope coat", "short black horns", "steep forest browsing"], "mountain forest, snowy woodland, and rocky ravine", "Japan", 63, "The forest-slope serow animal"],
    ["barbary-macaque", "Barbary Macaque", "Macaca sylvanus", "Mammal", ["tailless monkey build", "thick mountain fur", "troop-based cliff and cedar movement"], "cedar forest, oak woodland, and mountain grassland", "North Africa and Gibraltar", 79, "The tailless mountain macaque animal"],
    ["common-warthog", "Common Warthog", "Phacochoerus africanus", "Mammal", ["upcurved facial tusks", "kneeling grazing posture", "burrow-backward defense"], "savannah, open scrub, and dry grassland", "Sub-Saharan Africa", 43, "The tusked kneeling grazer animal"],
    ["patagonian-hog-nosed-skunk", "Patagonian Hog-nosed Skunk", "Conepatus humboldtii", "Mammal", ["pig-like rooting snout", "bold black-and-white coat", "chemical defense spray"], "steppe, scrubland, and open Patagonian plain", "South America", 56, "The striped root-snout skunk animal"],
    ["ringtail", "Ringtail", "Bassariscus astutus", "Mammal", ["oversized night-adapted eyes", "long black-and-white tail rings", "nimble cliff climbing"], "canyon, oak woodland, and rocky desert scrub", "Southwestern United States and Mexico", 49, "The ring-tailed night climber animal"],
    ["puku", "Puku", "Kobus vardonii", "Mammal", ["golden marshland coat", "heavy hindquarters", "wet grass sprinting"], "floodplain grassland, marsh edge, and river valley", "Central and southern Africa", 68, "The marsh-golden antelope animal"],
    ["greater-bulldog-bat", "Greater Bulldog Bat", "Noctilio leporinus", "Mammal", ["oversized fish-grabbing feet", "cheek-pouch scent glands", "water-skimming hunt"], "mangrove, estuary, and tropical river margin", "Central and South America", 61, "The fish-skimming bat animal"],
    ["royal-antelope", "Royal Antelope", "Neotragus pygmaeus", "Mammal", ["pinhead-sized antelope frame", "delicate spindle legs", "leaf-litter hiding"], "rainforest edge, dense thicket, and low woodland", "West Africa", 84, "The pocket antelope animal"],
    ["gray-four-eyed-opossum", "Gray Four-eyed Opossum", "Philander opossum", "Mammal", ["pale eyebrow eye-spots", "prehensile tail", "night fruit-and-insect foraging"], "rainforest, secondary woodland, and streamside forest", "Central and South America", 52, "The four-eyed climbing opossum animal"],
    ["dusky-dolphin", "Dusky Dolphin", "Lagenorhynchus obscurus", "Mammal", ["hourglass flank pattern", "acrobatic spinning leaps", "tightly schooling surf movement"], "cold coastal sea, upwelling current, and offshore shelf water", "Southern Hemisphere coasts", 57, "The acrobatic surf dolphin animal"],
    ["tufted-puffin", "Tufted Puffin", "Fratercula cirrhata", "Bird", ["tall blond head tufts", "huge orange bill", "cliff-colony diving"], "rocky sea cliff, offshore island, and cold coastal water", "North Pacific", 64, "The tufted sea-cliff puffin animal"],
    ["american-avocet", "American Avocet", "Recurvirostra americana", "Bird", ["upcurved needle bill", "long blue-gray legs", "side-sweeping shallows feeding"], "alkali flat, lagoon, and shallow wetland", "North America", 50, "The upcurved-bill avocet animal"],
    ["roseate-tern", "Roseate Tern", "Sterna dougallii", "Bird", ["blush-white plumage", "black cap", "graceful plunge-dive fishing"], "tropical beach, island colony, and coastal sea", "Atlantic, Indian, and Pacific tropical coasts", 76, "The rose-lit tern animal"],
    ["black-necked-swan", "Black-necked Swan", "Cygnus melancoryphus", "Bird", ["black velvet neck", "white lake body", "scarlet bill knob"], "lake, marsh, and Patagonian wetland", "Southern South America", 55, "The black-necked swan animal"],
    ["coscoroba-swan", "Coscoroba Swan", "Coscoroba coscoroba", "Bird", ["pure white body", "coral-red bill", "high bugling calls"], "lagoon, marsh, and grassy wetland", "Southern South America", 59, "The coral-billed swan animal"],
    ["great-hornbill", "Great Hornbill", "Buceros bicornis", "Bird", ["massive yellow casque bill", "black-and-white wings", "fruit-carrying canopy flight"], "evergreen forest, riverine woodland, and tall tropical canopy", "Indian subcontinent and Southeast Asia", 88, "The casque-billed giant hornbill animal"],
    ["emerald-toucanet", "Emerald Toucanet", "Aulacorhynchus prasinus", "Bird", ["bright emerald body", "rainbow-tipped bill", "quiet branch-hopping fruit forage"], "cloud forest, humid woodland, and montane canopy", "Central and South America", 60, "The emerald fruit toucan animal"],
    ["oilbird", "Oilbird", "Steatornis caripensis", "Bird", ["huge night-adapted eyes", "echolocating cave flight", "oil-rich fruit feeding"], "cave, cloud forest, and steep ravine woodland", "Northern South America", 81, "The cave-flying fruit bird animal"],
    ["dwarf-cassowary", "Dwarf Cassowary", "Casuarius bennetti", "Bird", ["glossy black body", "blue throat skin", "forest-floor fruit stomping"], "montane rainforest, dense hill forest, and mossy understory", "New Guinea", 86, "The mountain cassowary animal"],
    ["red-kite", "Red Kite", "Milvus milvus", "Bird of prey", ["forked tail", "russet body sheen", "effortless scavenging and mouse-hunting glide"], "farmland, meadow, and open woodland", "Europe and western Asia", 62, "The fork-tailed kite animal"],
    ["long-eared-owl", "Long-eared Owl", "Asio otus", "Bird", ["tall ear tufts", "vertical bark-like roost posture", "silent vole-hunting flight"], "conifer grove, hedgerow, and meadow edge", "Europe, Asia, and North America", 58, "The long-eared dusk owl animal"],
    ["great-kiskadee", "Great Kiskadee", "Pitangus sulphuratus", "Bird", ["bold black-and-white head stripes", "sulfur-yellow belly", "loud flycatcher calls"], "river edge, scrub, and tropical garden woodland", "The Americas", 38, "The shouting yellow flycatcher animal"],
    ["painted-bunting", "Painted Bunting", "Passerina ciris", "Bird", ["rainbow-painted male plumage", "thick seed bill", "dense shrub skulking"], "brushland, thicket, and woodland edge", "North and Central America", 65, "The rainbow song bunting animal"],
    ["lappet-faced-vulture", "Lappet-faced Vulture", "Torgos tracheliotos", "Bird", ["huge bald head", "dangling neck lappets", "bone-tough carcass-opening bill"], "savannah, semi-desert, and open dry plain", "Africa and the Arabian Peninsula", 87, "The lappet-faced scavenger giant animal"],
    ["martial-eagle", "Martial Eagle", "Polemaetus bellicosus", "Bird of prey", ["long broad wings", "massive prey-gripping talons", "treetop strike dive"], "savannah, open woodland, and rocky escarpment", "Sub-Saharan Africa", 83, "The giant talon eagle animal"],
    ["crowned-eagle", "Crowned Eagle", "Stephanoaetus coronatus", "Bird of prey", ["barred underparts", "towering crest", "forest-ambush raptor build"], "rainforest, riverine woodland, and dense forest edge", "Sub-Saharan Africa", 82, "The forest-crown eagle animal"],
    ["andean-goose", "Andean Goose", "Chloephaga melanoptera", "Bird", ["white body with black flight feathers", "pink legs", "high-altitude grazing"], "altiplano lake, puna grassland, and mountain wetland", "Andes", 53, "The highland goose animal"],
    ["andean-lapwing", "Andean Lapwing", "Vanellus resplendens", "Bird", ["smoky gray body", "pink legs", "sharp upland alarm calls"], "high plateau meadow, bog edge, and alpine wetland", "Andes", 57, "The pink-legged lapwing animal"],
    ["snowy-sheathbill", "Snowy Sheathbill", "Chionis albus", "Bird", ["all-white scavenger body", "sheath-covered bill base", "fearless polar shoreline foraging"], "penguin colony, rocky coast, and subantarctic island", "Antarctic and subantarctic regions", 71, "The white scavenger sheathbill animal"],
    ["boobook-owl", "Boobook Owl", "Ninox boobook", "Bird", ["rounded head", "yellow eyes", "repeated two-note calls"], "open woodland, eucalyptus forest, and scrub edge", "Australia and nearby islands", 48, "The two-note night owl animal"],
    ["eurasian-jay", "Eurasian Jay", "Garrulus glandarius", "Bird", ["pale blue wing patch", "black moustache stripes", "acorn-caching woodland behavior"], "oak forest, mixed woodland, and parkland", "Europe and western Asia", 44, "The acorn-caching jay animal"],
    ["sacred-kingfisher", "Sacred Kingfisher", "Todiramphus sanctus", "Bird", ["turquoise wings", "buff underparts", "patient perch-and-pounce hunting"], "mangrove, woodland edge, and coastal scrub", "Australia, New Zealand, Pacific islands, and Southeast Asia", 47, "The turquoise perch kingfisher animal"],
    ["magpie-goose", "Magpie Goose", "Anseranas semipalmata", "Bird", ["long pink legs", "half-webbed feet", "noisy wetland flocking"], "floodplain, swamp, and monsoon wetland", "Northern Australia and southern New Guinea", 69, "The half-webbed wetland goose animal"],
    ["crested-pigeon", "Crested Pigeon", "Ocyphaps lophotes", "Bird", ["pointed head crest", "iridescent wing patch", "whistling takeoff flight"], "grassland, farmland, and dry woodland", "Australia", 35, "The whistling crest pigeon animal"],
    ["white-tailed-tropicbird", "White-tailed Tropicbird", "Phaethon lepturus", "Bird", ["white ribbon tail streamers", "black eye stripe", "plunge-diving ocean flight"], "tropical island cliff, offshore sea, and coral coast", "Tropical oceans worldwide", 63, "The ribbon-tailed tropicbird animal"],
    ["nene", "Nene", "Branta sandvicensis", "Bird", ["buff-barred neck", "reduced webbing", "lava-field grazing"], "volcanic shrubland, grass slope, and wet pasture", "Hawaii", 92, "The island goose animal"],
    ["gouldian-finch", "Gouldian Finch", "Erythrura gouldiae", "Bird", ["purple chest and green back", "bright tri-color face", "grass-seed flocking"], "tropical savannah, open woodland, and grassland waterhole", "Northern Australia", 90, "The painted grass finch animal"],
    ["black-browed-albatross", "Black-browed Albatross", "Thalassarche melanophris", "Bird", ["dark eyebrow line", "long narrow gliding wings", "cliff-colony ocean soaring"], "subantarctic island, shelf edge, and open ocean", "Southern Ocean", 75, "The black-browed ocean glider animal"],
    ["black-necked-crane", "Black-necked Crane", "Grus nigricollis", "Bird", ["black head and neck", "red crown patch", "high-altitude bugling"], "plateau wetland, alpine meadow, and river marsh", "Tibetan Plateau and Himalayas", 84, "The plateau bugling crane animal"],
    ["burrowing-parakeet", "Burrowing Parakeet", "Cyanoliseus patagonus", "Bird", ["long tail", "olive-brown parrot body", "cliff-tunnel colony nesting"], "dry scrub, canyon wall, and Patagonian steppe", "South America", 67, "The cliff-colony parakeet animal"],
    ["great-skua", "Great Skua", "Stercorarius skua", "Bird", ["heavy pirate-like seabird body", "hooked bill", "aggressive aerial chasing"], "island moorland, sea cliff, and cold pelagic water", "North Atlantic", 61, "The pirate skua animal"],
    ["razorbill", "Razorbill", "Alca torda", "Bird", ["black-and-white auk body", "deep grooved bill", "wing-propelled diving"], "sea cliff, offshore ledge, and North Atlantic water", "North Atlantic", 57, "The groove-billed auk animal"],
    ["least-bittern", "Least Bittern", "Ixobrychus exilis", "Bird", ["tiny heron frame", "reed-mimic posture", "chestnut-and-buff wetland plumage"], "reedbed, marsh, and pond edge", "The Americas", 66, "The reed-stalking tiny bittern animal"],
    ["purple-gallinule", "Purple Gallinule", "Porphyrio martinica", "Bird", ["violet-blue body", "bright yellow legs", "long toes on floating plants"], "marsh, lily pond, and swamp edge", "The Americas", 51, "The lily-walking gallinule animal"],
    ["regent-bowerbird", "Regent Bowerbird", "Sericulus chrysocephalus", "Bird", ["black-and-gold male plumage", "avenue bower display", "fruit-and-insect canopy feeding"], "rainforest edge, subtropical woodland, and mountain forest", "Eastern Australia", 74, "The gold-flashed bowerbird animal"],
    ["siamese-crocodile", "Siamese Crocodile", "Crocodylus siamensis", "Reptile", ["narrow armored snout", "olive ridged body", "freshwater ambush stillness"], "river, marsh, and forest swamp", "Southeast Asia", 96, "The freshwater swamp crocodile animal"],
    ["philippine-crocodile", "Philippine Crocodile", "Crocodylus mindorensis", "Reptile", ["short broad snout", "heavy armored scales", "shy riverbank basking"], "river, pond, and marshy wetland", "Philippines", 98, "The island river crocodile animal"],
    ["emerald-tree-skink", "Emerald Tree Skink", "Lamprolepis smaragdina", "Reptile", ["glossy green scales", "communal branch basking", "smooth arboreal sprint"], "coastal forest, coconut grove, and island woodland", "Pacific islands and Southeast Asia", 46, "The emerald branch skink animal"],
    ["western-hognose-snake", "Western Hognose Snake", "Heterodon nasicus", "Reptile", ["upturned shovel snout", "dramatic hooding bluff", "sand-burrowing body"], "prairie, sandy scrub, and dry grassland", "North America", 49, "The bluffing shovel-snout snake animal"],
    ["boomslang", "Boomslang", "Dispholidus typus", "Reptile", ["enormous emerald eyes", "slender branch body", "front-fanged arboreal strike"], "savannah woodland, forest edge, and shrub canopy", "Sub-Saharan Africa", 72, "The long-eyed tree snake animal"],
    ["yellow-footed-tortoise", "Yellow-footed Tortoise", "Chelonoidis denticulatus", "Reptile", ["yellow-scaled forelegs", "domed rainforest shell", "fruit-finding forest wandering"], "rainforest floor, humid woodland, and streamside forest", "Amazon Basin and Guiana Shield", 60, "The yellow-footed forest tortoise animal"],
    ["african-clawed-frog", "African Clawed Frog", "Xenopus laevis", "Amphibian", ["clawed hind feet", "fully aquatic flat body", "murky-water suction feeding"], "pond, lake, and slow river", "Sub-Saharan Africa", 42, "The claw-footed pond frog animal"],
    ["golden-mantella", "Golden Mantella", "Mantella aurantiaca", "Amphibian", ["bright orange warning skin", "tiny leaf-litter body", "mossy wet-forest hopping"], "rainforest floor, marsh edge, and damp leaf litter", "Madagascar", 94, "The golden warning frog animal"],
    ["emperor-newt", "Emperor Newt", "Tylototriton shanjing", "Amphibian", ["bright orange dorsal ridge", "rough black skin", "streamside forest life"], "mountain forest, shaded pond, and clear brook edge", "China and northern Myanmar", 86, "The orange-ridged emperor newt animal"],
    ["blue-spotted-salamander", "Blue-spotted Salamander", "Ambystoma laterale", "Amphibian", ["blue-flecked dark body", "secretive log hiding", "spring pool breeding"], "moist woodland, vernal pool, and leaf litter", "North America", 55, "The blue-speckled woodland salamander animal"],
    ["dusky-gopher-frog", "Dusky Gopher Frog", "Lithobates sevosus", "Amphibian", ["squat dark-spotted body", "deep burrow sheltering", "explosive rain breeding"], "longleaf pine flatwood, ephemeral pond, and sandy upland", "Southeastern United States", 97, "The burrow-hiding gopher frog animal"],
    ["eastern-glass-lizard", "Eastern Glass Lizard", "Ophisaurus ventralis", "Reptile", ["legless lizard body", "movable eyelids", "brittle autotomizing tail"], "sandhill, grassland, and pine scrub", "Southeastern United States", 62, "The glass-tailed legless lizard animal"],
    ["mangrove-monitor", "Mangrove Monitor", "Varanus indicus", "Reptile", ["saltwater-ready monitor body", "forked scent tongue", "mangrove creek swimming"], "mangrove, estuary, and tropical shoreline forest", "New Guinea, northern Australia, and nearby islands", 58, "The mangrove-swimming monitor animal"],
    ["southern-alligator-lizard", "Southern Alligator Lizard", "Elgaria multicarinata", "Reptile", ["plated scales", "side-folded body", "cool-climate rock hiding"], "chaparral, oak woodland, and rocky hillside", "Western North America", 45, "The plated hillside lizard animal"],
    ["panamanian-golden-frog", "Panamanian Golden Frog", "Atelopus zeteki", "Amphibian", ["bright yellow body", "semaphore foot-waving signals", "fast mountain-stream life"], "cloud forest, spray zone, and mountain stream", "Panama", 99, "The signal-waving golden frog animal"],
    ["chinese-alligator", "Chinese Alligator", "Alligator sinensis", "Reptile", ["short broad snout", "armored dark body", "burrowed winter dormancy"], "marsh, pond, and lowland river wetland", "China", 97, "The armored river alligator animal"],
    ["monkey-tailed-skink", "Monkey-tailed Skink", "Corucia zebrata", "Reptile", ["prehensile tail grip", "heavy olive scales", "slow canopy leaf browsing"], "rainforest canopy, mangrove edge, and island woodland", "Solomon Islands", 83, "The prehensile-tailed skink animal"],
    ["yacare-caiman", "Yacare Caiman", "Caiman yacare", "Reptile", ["dark armored body", "bony eye ridges", "river-edge night hunting"], "river, marsh, and seasonally flooded wetland", "South America", 64, "The ridge-eyed caiman animal"],
    ["argentine-horned-frog", "Argentine Horned Frog", "Ceratophrys ornata", "Amphibian", ["enormous mouth", "horned brows", "leaf-litter ambush body"], "grassland, marsh edge, and seasonal wetland", "South America", 59, "The wide-mouthed horned frog animal"],
    ["black-breasted-leaf-turtle", "Black-breasted Leaf Turtle", "Geoemyda spengleri", "Reptile", ["sharply keeled shell", "leaf-litter camouflage", "steep-forest walking"], "hill forest, bamboo thicket, and moist ravine", "China and northern Vietnam", 89, "The leaf-litter turtle animal"],
    ["basking-shark", "Basking Shark", "Cetorhinus maximus", "Fish", ["gigantic filter-feeding mouth", "towering dorsal fin", "slow plankton cruise"], "temperate open ocean, coastal shelf, and surface feeding zone", "Global temperate seas", 77, "The giant plankton shark animal"],
    ["thresher-shark", "Thresher Shark", "Alopias vulpinus", "Fish", ["whip-like upper tail lobe", "sleek blue-gray body", "tail-slap hunting"], "open ocean, continental shelf edge, and bluewater current", "Temperate and tropical seas worldwide", 71, "The whip-tailed shark animal"],
    ["porcupinefish", "Porcupinefish", "Diodon hystrix", "Fish", ["inflatable spiny body", "beak-like crushing jaws", "reef-crevice sheltering"], "coral reef, seagrass flat, and rocky coastal sea", "Tropical and subtropical oceans", 48, "The inflatable spiny fish animal"],
    ["red-bellied-piranha", "Red-bellied Piranha", "Pygocentrus nattereri", "Fish", ["silver body with red belly", "triangular serrated teeth", "shoaling river feeding"], "river channel, floodplain lagoon, and backwater", "South America", 54, "The red-bellied piranha animal"],
    ["discus-fish", "Discus Fish", "Symphysodon aequifasciatus", "Fish", ["round disc-shaped body", "neon banded patterning", "slow drift among roots"], "blackwater creek, flooded forest, and planted river edge", "Amazon Basin", 63, "The disc-bodied river fish animal"],
    ["wahoo", "Wahoo", "Acanthocybium solandri", "Fish", ["torpedo-shaped blue body", "tiger-like flank bars", "blistering open-water chase"], "bluewater current, offshore reef edge, and pelagic sea", "Tropical and subtropical oceans", 46, "The striped speed mackerel animal"],
    ["beluga-sturgeon", "Beluga Sturgeon", "Huso huso", "Fish", ["armored scute rows", "protrusible bottom-feeding mouth", "immense migratory river size"], "large river, estuary, and inland sea", "Caspian and Black Sea basins", 95, "The armored giant sturgeon animal"],
    ["goliath-tigerfish", "Goliath Tigerfish", "Hydrocynus goliath", "Fish", ["oversized dagger teeth", "muscular river body", "violent current-water strikes"], "large river channel, rocky rapid, and deep freshwater pool", "Congo Basin", 74, "The dagger-toothed river fish animal"],
    ["lumpfish", "Lumpfish", "Cyclopterus lumpus", "Fish", ["round lumpy body", "suction-cup pelvic disc", "cold-sea drifting"], "cold coastal sea, kelp forest, and rocky seafloor", "North Atlantic and Arctic waters", 58, "The suction-bellied lumpfish animal"],
    ["rainbow-runner", "Rainbow Runner", "Elagatis bipinnulata", "Fish", ["electric blue and yellow stripes", "narrow fast-swimming body", "schooling pursuit"], "reef edge, offshore current, and tropical bluewater", "Tropical seas worldwide", 44, "The rainbow-striped runner fish animal"],
    ["blue-morpho", "Blue Morpho", "Morpho menelaus", "Insect", ["iridescent blue wings", "broad slow gliding flight", "eyespot brown undersides"], "rainforest edge, river trail, and humid understory", "Central and South America", 52, "The neon-wing morpho animal"],
    ["zebra-swallowtail", "Zebra Swallowtail", "Eurytides marcellus", "Insect", ["long tail streamers", "black-and-white striping", "pawpaw-linked breeding"], "woodland edge, riverbank, and open glade", "Eastern North America", 43, "The striped swallowtail animal"],
    ["walking-leaf", "Walking Leaf", "Phyllium philippinicum", "Insect", ["flat leaf-like body", "ragged camouflage edges", "slow swaying disguise"], "rainforest shrub, understory foliage, and humid garden canopy", "Southeast Asia", 67, "The leaf-disguise insect animal"],
    ["giant-stick-insect", "Giant Stick Insect", "Dryococelus australis", "Insect", ["extra-long twig body", "bark-brown camouflage", "nocturnal branch climbing"], "forest canopy, shrubland, and island woodland", "Lord Howe Island", 93, "The twig-bodied giant insect animal"],
    ["bullet-ant", "Bullet Ant", "Paraponera clavata", "Insect", ["massive black ant body", "tree-root colony life", "famously painful sting"], "rainforest floor, tree base, and humid woodland", "Central and South America", 69, "The thunder-sting ant animal"],
    ["trap-jaw-ant", "Trap-jaw Ant", "Odontomachus bauri", "Insect", ["spring-loaded snapping mandibles", "fast backward escape jumps", "leaf-litter hunting"], "forest floor, rotting wood, and tropical understory", "Tropical Americas", 57, "The spring-jaw ant animal"],
    ["golden-silk-orb-weaver", "Golden Silk Orb-weaver", "Trichonephila clavipes", "Arachnid", ["giant golden web silk", "elongated banded legs", "sunlit forest web suspension"], "forest edge, garden canopy, and riverside thicket", "The Americas", 49, "The golden-web weaver animal"],
    ["joro-spider", "Joro Spider", "Trichonephila clavata", "Arachnid", ["vivid yellow-and-blue body", "huge orb web", "ballooning young dispersal"], "woodland edge, garden, and suburban tree cover", "East Asia and introduced southeastern United States", 41, "The golden giant orb spider animal"],
    ["devils-flower-mantis", "Devil's Flower Mantis", "Idolomantis diabolica", "Insect", ["petal-like lobed body", "pink-and-white camouflage", "sudden ambush grab"], "dry scrub, thorn bush, and flowering shrubland", "East Africa", 73, "The flower-phantom mantis animal"],
    ["red-kneed-tarantula", "Red-kneed Tarantula", "Brachypelma hamorii", "Arachnid", ["black velvet body", "orange-red knee bands", "burrow-front threat display"], "dry forest, thorn scrub, and semi-arid grassland", "Mexico", 62, "The red-kneed tarantula animal"]
];

const speciesSeedsNine: SpeciesSeedNine[] = speciesSeedRowsNine.map(([
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

export const additionalSpeciesEntriesInputNine = speciesSeedsNine.map((seed) => ({
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

export const additionalSpeciesSystemsIntelligenceNine = Object.fromEntries(
    speciesSeedsNine.map((seed) => [
        seed.slug,
        {
            roleTitle: buildRoleTitle(seed.descriptor),
            specializedHardware: `${seed.traits[0]}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} give the ${seed.name} a body plan tuned for its niche.`,
            systemsScript: `${seed.name}s operate through ${lowerFirst(seed.habitat)}. Their design links movement, feeding, shelter, and timing into one workable survival system.`,
            strategicInsight: buildStrategicInsight(seed)
        } satisfies SystemsIntelligenceEntry
    ])
) as Record<string, SystemsIntelligenceEntry>;

export const additionalSpeciesDescriptorsNine = Object.fromEntries(
    speciesSeedsNine.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesNine = Object.fromEntries(
    speciesSeedsNine.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;

export const additionalSpeciesMiniSystemsNine = Object.fromEntries(
    speciesSeedsNine.map((seed) => [seed.slug, `${seed.name} thrives by using ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} in ${lowerFirst(seed.habitat)}.`])
) as Record<string, string>;
