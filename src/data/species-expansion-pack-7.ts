import {SystemsIntelligenceEntry} from "@/data/content-schema";

type SpeciesSeedSeven = {
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

type SpeciesSeedSevenRow = [
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

function buildSubtitleStory(seed: SpeciesSeedSeven) {
    return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
}

function buildStrategicInsight(seed: SpeciesSeedSeven) {
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

const speciesSeedRowsSeven: SpeciesSeedSevenRow[] = [
    ["lesser-kudu", "Lesser Kudu", "Tragelaphus imberbis", "Mammal", ["slender spiral horns", "thin white side stripes", "stealthy thornbush movement"], "thorn scrub, dry bushland, and acacia woodland", "East Africa", 72, "The striped thornbrush antelope animal"],
    ["black-lechwe", "Black Lechwe", "Kobus leche smithemani", "Mammal", ["dark marsh-adapted coat", "elongated wet-ground hooves", "floodplain herd movement"], "floodplain marsh, shallow lagoon, and wet grassland", "Zambia", 86, "The black-coated marsh antelope animal"],
    ["blesbok", "Blesbok", "Damaliscus pygargus phillipsi", "Mammal", ["white facial blaze", "lyre-shaped ringed horns", "tight open-country herding"], "grassland, open plain, and lightly rolling veld", "South Africa", 63, "The white-blazed plain antelope animal"],
    ["steenbok", "Steenbok", "Raphicerus campestris", "Mammal", ["tiny upright antelope frame", "very large ears", "sudden cover-dashing escape"], "savannah, dry scrub, and open bush country", "Eastern and southern Africa", 46, "The pocket-sized bush antelope animal"],
    ["klipspringer", "Klipspringer", "Oreotragus oreotragus", "Mammal", ["rubbery cliff-gripping hooves", "compact rock-hopping body", "paired lookout behavior"], "rocky outcrop, cliff, and steep scrub slope", "Africa", 59, "The cliff-hopping tiny antelope animal"],
    ["chiru", "Chiru", "Pantholops hodgsonii", "Mammal", ["pale high-altitude coat", "slender black horns", "long-distance plateau running"], "cold alpine steppe and high plateau grassland", "Tibetan Plateau", 89, "The cold-plateau antelope animal"],
    ["wild-yak", "Wild Yak", "Bos mutus", "Mammal", ["massive shaggy mountain body", "deep sweeping horns", "cold-thin-air endurance"], "alpine steppe, upland meadow, and high plateau", "Tibetan Plateau", 84, "The high-plateau shaggy giant animal"],
    ["goitered-gazelle", "Goitered Gazelle", "Gazella subgutturosa", "Mammal", ["light tan desert coat", "slender ringed horns", "fast open-steppe sprinting"], "semi-desert, dry steppe, and sandy plain", "Central Asia and the Middle East", 71, "The pale-steppe gazelle animal"],
    ["nilgiri-tahr", "Nilgiri Tahr", "Nilgiritragus hylocrius", "Mammal", ["stocky mountain goat body", "curving heavy horns", "grass-slope sure-footing"], "montane grassland, cliff edge, and shola habitat", "Western Ghats of India", 88, "The shola-cliff tahr animal"],
    ["onager", "Onager", "Equus hemionus", "Mammal", ["lean desert equid build", "large alert ears", "high-speed dryland movement"], "desert plain, dry steppe, and salt-flat edge", "Middle East and Central Asia", 78, "The desert-running wild ass animal"],
    ["kiang", "Kiang", "Equus kiang", "Mammal", ["tall chestnut wild ass frame", "white underbody", "plateau herd roaming"], "high plateau meadow, steppe, and cold desert", "Tibet and western China", 62, "The highland wild ass animal"],
    ["takhi", "Takhi", "Equus ferus przewalskii", "Mammal", ["upright dark mane", "stocky dun horse body", "wind-swept grassland herding"], "steppe, semi-desert, and open grassland", "Mongolia and reintroduced Asian ranges", 83, "The wild-steppe horse animal"],
    ["small-indian-civet", "Small Indian Civet", "Viverricula indica", "Mammal", ["striped spotted civet coat", "musk-producing scent glands", "night ground-foraging routes"], "scrub, forest edge, and farmland fringe", "South and Southeast Asia", 52, "The striped night civet animal"],
    ["banded-palm-civet", "Banded Palm Civet", "Hemigalus derbyanus", "Mammal", ["dark coat with pale bands", "large night-adapted eyes", "tree-and-ground foraging"], "rainforest, peat swamp forest, and dense tropical woodland", "Southeast Asia", 82, "The banded canopy civet animal"],
    ["marsh-mongoose", "Marsh Mongoose", "Atilax paludinosus", "Mammal", ["water-loving low-bodied frame", "dense dark fur", "wetland crab-hunting behavior"], "marsh, riverbank, and reedbed edge", "Sub-Saharan Africa", 47, "The wetland crab hunter animal"],
    ["bushy-tailed-mongoose", "Bushy-tailed Mongoose", "Bdeogale crassicauda", "Mammal", ["long shaggy tail", "low dark mongoose body", "quiet forest-floor hunting"], "forest, thicket, and moist woodland", "Eastern Africa", 69, "The shaggy-tailed forest mongoose animal"],
    ["woylie", "Woylie", "Bettongia penicillata", "Mammal", ["long pointed digging snout", "brush-tipped tail", "fungus-finding nocturnal hopping"], "dry woodland, mallee, and scrub habitat", "Australia", 95, "The brush-tailed digging marsupial animal"],
    ["quenda", "Quenda", "Isoodon fusciventer", "Mammal", ["short rounded ears", "powerful digging foreclaws", "leaf-litter rooting behavior"], "coastal scrub, woodland, and wet shrubland", "Western Australia", 58, "The root-snuffling bandicoot animal"],
    ["agile-wallaby", "Agile Wallaby", "Notamacropus agilis", "Mammal", ["slender long-legged hopper build", "pale cheek stripe", "open-woodland grazing"], "savannah woodland, grassland, and monsoon forest edge", "Northern Australia and New Guinea", 44, "The fast tropical wallaby animal"],
    ["parma-wallaby", "Parma Wallaby", "Notamacropus parma", "Mammal", ["small forest wallaby frame", "white cheek stripe", "dense-understory daytime sheltering"], "wet forest, eucalypt woodland, and thick undergrowth", "Eastern Australia", 73, "The shy forest wallaby animal"],
    ["dusky-pademelon", "Dusky Pademelon", "Thylogale brunii", "Mammal", ["compact rainforest hopper body", "short thick tail", "understory fruit-and-leaf feeding"], "rainforest, montane forest, and dense tropical cover", "New Guinea", 64, "The dusk-forest pademelon animal"],
    ["brush-tailed-bettong", "Eastern Bettong", "Bettongia gaimardi", "Mammal", ["light hopping marsupial frame", "brushy balancing tail", "underground fungus-digging"], "grassland, open woodland, and coastal scrub", "Tasmania", 71, "The mushroom-digging bettong animal"],
    ["greater-bamboo-lemur", "Greater Bamboo Lemur", "Prolemur simus", "Mammal", ["powerful bamboo-chewing jaws", "gray-brown lemur coat", "tall-culm climbing"], "bamboo forest and humid montane woodland", "Madagascar", 96, "The bamboo-chewing lemur animal"],
    ["potto", "Potto", "Perodicticus potto", "Mammal", ["slow grasping nocturnal body", "dense woolly fur", "branch-hugging stealth"], "rainforest canopy and dense tropical woodland", "Central and West Africa", 68, "The slow branch-hugger animal"],
    ["mantled-guereza", "Mantled Guereza", "Colobus guereza", "Mammal", ["black-and-white mantle coat", "long flowing tail tuft", "leaf-focused canopy feeding"], "montane forest, riverine woodland, and tropical canopy", "Central and East Africa", 57, "The mantle-cloaked colobus animal"],
    ["white-faced-saki", "White-faced Saki", "Pithecia pithecia", "Mammal", ["male white face mask", "long bushy tail", "seed-cracking canopy foraging"], "rainforest canopy and river-edge forest", "Northern South America", 63, "The mask-faced canopy monkey animal"],
    ["cotton-top-tamarin", "Cotton-top Tamarin", "Saguinus oedipus", "Mammal", ["wild white crest hair", "tiny agile monkey body", "cooperative troop life"], "dry forest, secondary woodland, and forest edge", "Colombia", 94, "The white-crested tamarin animal"],
    ["golden-headed-lion-tamarin", "Golden-headed Lion Tamarin", "Leontopithecus chrysomelas", "Mammal", ["golden mane around dark face", "claw-like gripping fingers", "fruit-and-insect canopy hunting"], "Atlantic forest and humid lowland woodland", "Brazil", 88, "The golden-maned tiny hunter animal"],
    ["pygmy-marmoset", "Pygmy Marmoset", "Cebuella pygmaea", "Mammal", ["tiny fingertip-sized primate body", "long ringed tail", "tree-sap gouging behavior"], "riverine rainforest and dense tropical canopy", "Amazon Basin", 67, "The tiny sap-drinking monkey animal"],
    ["silky-anteater", "Silky Anteater", "Cyclopes didactylus", "Mammal", ["golden woolly coat", "hooked climbing claws", "slow tree-living ant feeding"], "rainforest canopy, mangrove edge, and tropical woodland", "Central and South America", 72, "The golden tree anteater animal"],
    ["painted-stork", "Painted Stork", "Mycteria leucocephala", "Bird", ["pink tertial feathers", "yellow downcurved bill", "shallow-water sweeping hunt"], "marsh, floodplain, and wetland edge", "South and Southeast Asia", 74, "The pink-winged marsh stork animal"],
    ["black-headed-ibis", "Black-headed Ibis", "Threskiornis melanocephalus", "Bird", ["bare black head", "clean white body", "wetland probing feeding"], "marsh, rice plain, and shallow wetland", "South and Southeast Asia", 71, "The black-headed white ibis animal"],
    ["glossy-ibis", "Glossy Ibis", "Plegadis falcinellus", "Bird", ["bronze-iridescent body sheen", "long curved probing bill", "wetland flock movement"], "marsh, lagoon, and floodplain habitat", "Worldwide warm wetlands", 43, "The bronze-sheen wetland ibis animal"],
    ["northern-shoveler", "Northern Shoveler", "Spatula clypeata", "Bird", ["broad spoon-shaped bill", "surface-filter feeding behavior", "marsh-dabbling body"], "marsh, pond, and shallow wetland", "Northern Hemisphere", 39, "The broad-bill dabbler animal"],
    ["smew", "Smew", "Mergellus albellus", "Bird", ["crisp black-and-white winter plumage", "fine serrated fish-catching bill", "cold-water diving"], "taiga lake, river, and winter coastal inlet", "Northern Eurasia", 66, "The black-and-white sawbill animal"],
    ["ruddy-shelduck", "Ruddy Shelduck", "Tadorna ferruginea", "Bird", ["rich orange body", "pale head", "strong pair-bonding wetland life"], "lake, riverbank, and open wetland edge", "Europe, Asia, and North Africa", 47, "The orange-waterfowl sentinel animal"],
    ["red-crested-pochard", "Red-crested Pochard", "Netta rufina", "Bird", ["rounded orange-red head", "bright red bill", "deep-water diving habit"], "lake, reservoir, and sheltered marsh", "Europe and Asia", 52, "The red-headed diving duck animal"],
    ["crested-serpent-eagle", "Crested Serpent Eagle", "Spilornis cheela", "Bird of prey", ["short crest feathers", "yellow facial skin", "forest snake-hunting flights"], "forest, mangrove, and wooded wetland edge", "South and Southeast Asia", 58, "The yellow-faced serpent eagle animal"],
    ["black-shouldered-kite", "Black-shouldered Kite", "Elanus axillaris", "Bird of prey", ["pale body with black shoulders", "hovering rodent-hunt posture", "red eye glow"], "open grassland, farmland, and woodland edge", "Australia", 44, "The hovering pale kite animal"],
    ["mississippi-kite", "Mississippi Kite", "Ictinia mississippiensis", "Bird of prey", ["slender pointed wings", "soft gray plumage", "aerial insect hunting"], "river woodland, open forest, and warm sky corridors", "North and South America", 42, "The gray sky-hawker animal"],
    ["swamp-harrier", "Swamp Harrier", "Circus approximans", "Bird of prey", ["long wings and tail", "low marsh quartering flight", "reedbed hunting behavior"], "wetland, pasture, and estuary edge", "Australia, New Zealand, and Pacific regions", 49, "The low-flying marsh hunter animal"],
    ["collared-falconet", "Collared Falconet", "Microhierax caerulescens", "Bird of prey", ["tiny falcon body", "short hooked bill", "fast perch-and-dart attacks"], "forest edge, open woodland, and village tree lines", "South and Southeast Asia", 61, "The pocket-sized falcon animal"],
    ["nacunda-nighthawk", "Nacunda Nighthawk", "Chordeiles nacunda", "Bird", ["very wide gaping mouth", "long pointed wings", "crepuscular insect-chasing flight"], "open grassland, marsh edge, and sandy plain", "South America", 53, "The dusk-skimming nighthawk animal"],
    ["sri-lanka-frogmouth", "Sri Lanka Frogmouth", "Batrachostomus moniliger", "Bird", ["huge frog-like bill", "leaf-brown camouflage", "still branch-roosting posture"], "rainforest understory and dense evergreen woodland", "India and Sri Lanka", 76, "The leaf-brown frogmouth animal"],
    ["bearded-reedling", "Bearded Reedling", "Panurus biarmicus", "Bird", ["mustache-like black facial streaks", "long balancing tail", "reed-stem acrobatics"], "reedbed, marsh, and lakeside wetland", "Europe and Asia", 48, "The mustached reed acrobat animal"],
    ["wallcreeper", "Wallcreeper", "Tichodroma muraria", "Bird", ["crimson-patched broad wings", "thin downcurved bill", "cliff-face climbing behavior"], "mountain cliff, gorge wall, and rocky escarpment", "Europe and Asia", 69, "The cliff-clinging crimson wing animal"],
    ["carmine-bee-eater", "Carmine Bee-eater", "Merops nubicus", "Bird", ["bright carmine body", "slender black bill", "aerial insect hawking"], "riverbank colony, open savannah, and floodplain edge", "Sub-Saharan Africa", 46, "The carmine sky-darter animal"],
    ["green-jay", "Green Jay", "Cyanocorax yncas", "Bird", ["green-blue-yellow patchwork plumage", "bold social intelligence", "fruit-and-insect woodland foraging"], "woodland, thorn scrub, and forest edge", "The Americas", 38, "The patchwork jungle jay animal"],
    ["verdin", "Verdin", "Auriparus flaviceps", "Bird", ["tiny yellow head", "needle-thin probing bill", "desert shrub weaving nests"], "desert scrub, thorny wash, and arid woodland", "Southwestern United States and Mexico", 41, "The yellow-headed desert sprite animal"],
    ["palm-warbler", "Palm Warbler", "Setophaga palmarum", "Bird", ["constant tail-bobbing behavior", "warm brown streaked plumage", "low ground-and-shrub feeding"], "bog edge, scrub, and migratory woodland stopovers", "North America and Caribbean wintering grounds", 36, "The tail-bobbing warbler animal"],
    ["sedge-wren", "Sedge Wren", "Cistothorus stellaris", "Bird", ["tiny streaked marsh body", "short rounded tail", "grass-stem nest weaving"], "wet meadow, sedge marsh, and grassy wetland edge", "North America", 54, "The grass-thread nest bird animal"],
    ["trumpeter-hornbill", "Trumpeter Hornbill", "Bycanistes bucinator", "Bird", ["large casque-topped bill", "white outer tail feathers", "rolling forest calls"], "forest, woodland, and riverine canopy", "Southern Africa", 58, "The trumpeting canopy hornbill animal"],
    ["northern-bald-ibis", "Northern Bald Ibis", "Geronticus eremita", "Bird", ["bare red wrinkled head", "shaggy black body sheen", "cliff-colony nesting"], "rocky steppe, coastal cliff, and open dry plain", "Morocco and reintroduced Eurasian sites", 95, "The red-headed cliff ibis animal"],
    ["red-knobbed-coot", "Red-knobbed Coot", "Fulica cristata", "Bird", ["red frontal shield knobs", "dark paddling wetland body", "aggressive territorial swimming"], "lake, marsh, and open wetland", "Africa and southern Europe", 67, "The red-knob wetland coot animal"],
    ["bronze-winged-jacana", "Bronze-winged Jacana", "Metopidius indicus", "Bird", ["metallic bronze wing sheen", "extremely long toes", "floating-plant walking"], "marsh, lotus pond, and slow wetland", "South and Southeast Asia", 57, "The bronze-wing lily walker animal"],
    ["indochinese-box-turtle", "Indochinese Box Turtle", "Cuora galbinifrons", "Reptile", ["hinged closing shell", "striped yellow head", "leaf-litter forest hiding"], "forest floor, moist woodland, and streamside thicket", "Southeast Asia", 94, "The closing-shell forest turtle animal"],
    ["tent-tortoise", "Tent Tortoise", "Psammobates tentorius", "Reptile", ["high tented shell profile", "starred scute markings", "dry scrub grazing"], "semi-arid scrub, karoo plain, and rocky grassland", "Southern Africa", 63, "The tent-domed tortoise animal"],
    ["elongated-tortoise", "Elongated Tortoise", "Indotestudo elongata", "Reptile", ["stretched yellow-brown shell", "strong forest-floor legs", "leaf-and-fruit browsing"], "forest, bamboo thicket, and monsoon woodland", "South and Southeast Asia", 86, "The long-shelled forest tortoise animal"],
    ["indian-rock-python", "Indian Rock Python", "Python molurus", "Reptile", ["very large blotched body", "heat-sensing facial pits", "quiet ambush constriction"], "grassland, forest edge, and wetland margin", "Indian subcontinent", 61, "The blotched giant python animal"],
    ["sunbeam-snake", "Sunbeam Snake", "Xenopeltis unicolor", "Reptile", ["iridescent rainbow sheen scales", "smooth burrowing body", "night soil-and-swamp hunting"], "swamp, wet rice field, and soft forest soil", "Southeast Asia", 55, "The rainbow-sheen burrow snake animal"],
    ["mole-viper", "Mole Viper", "Atractaspis microlepidota", "Reptile", ["side-stabbing long fangs", "cylindrical burrowing body", "loose-soil tunneling"], "savannah soil, scrub, and dry woodland ground", "Africa", 68, "The side-stabbing soil viper animal"],
    ["arabian-sand-boa", "Arabian Sand Boa", "Eryx jayakari", "Reptile", ["blunt short tail", "sand-burrowing ambush body", "hidden dune hunting"], "sand desert, rocky wadis, and arid scrub", "Arabian Peninsula", 77, "The buried dune boa animal"],
    ["ocellated-lizard", "Ocellated Lizard", "Timon lepidus", "Reptile", ["blue eye-like flank spots", "large powerful lizard frame", "sunny stonewall basking"], "Mediterranean scrub, rocky slope, and open woodland", "Iberian Peninsula and southern France", 52, "The blue-spotted wall lizard animal"],
    ["cuban-rock-iguana", "Cuban Rock Iguana", "Cyclura nubila", "Reptile", ["heavy gray basking body", "short horned facial scales", "rocky coastal territorial movement"], "dry forest, rocky shore, and scrub habitat", "Cuba and surrounding islands", 79, "The rock-basking island iguana animal"],
    ["ackie-monitor", "Ackie Monitor", "Varanus acanthurus", "Reptile", ["spiny defensive tail", "compact muscular monitor body", "rock-crevice basking life"], "rocky desert, spinifex plain, and arid scrub", "Australia", 56, "The spiny-tail rock monitor animal"],
    ["gidgee-skink", "Gidgee Skink", "Egernia stokesii", "Reptile", ["heavily armored rough scales", "deep crevice colony life", "short stout body"], "rocky outcrop, arid woodland, and dry shrubland", "Australia", 58, "The rough-scaled crevice skink animal"],
    ["spotted-turtle", "Spotted Turtle", "Clemmys guttata", "Reptile", ["black shell with bright yellow spots", "small semi-aquatic body", "marsh-edge wandering"], "bog, marsh, and shallow wet meadow", "Eastern North America", 87, "The yellow-speckled marsh turtle animal"],
    ["geometric-tortoise", "Geometric Tortoise", "Psammobates geometricus", "Reptile", ["bold yellow geometric shell lines", "high-domed small body", "fynbos browsing"], "lowland fynbos and renosterveld shrubland", "South Africa", 98, "The geometric shell jewel animal"],
    ["blue-tree-monitor", "Blue Tree Monitor", "Varanus macraei", "Reptile", ["electric blue body pattern", "long prehensile tail", "canopy climbing agility"], "island rainforest canopy and humid woodland", "West Papua", 94, "The electric-blue tree monitor animal"],
    ["madagascar-hognose-snake", "Madagascar Hognose Snake", "Leioheterodon madagascariensis", "Reptile", ["upturned digging snout", "yellow-brown blotched body", "sand-and-leaf-litter hunting"], "dry forest, scrub, and sandy woodland", "Madagascar", 71, "The shovel-snouted island snake animal"],
    ["marsh-frog", "Marsh Frog", "Pelophylax ridibundus", "Amphibian", ["large green water-frog body", "strong jumping hind legs", "loud reedside croaking"], "marsh, pond, and slow river edge", "Europe and western Asia", 43, "The loud marsh jumper animal"],
    ["pool-frog", "Pool Frog", "Pelophylax lessonae", "Amphibian", ["bright green spotted skin", "small slender pond body", "sunny shallows breeding"], "pond, fen, and wet meadow edge", "Europe", 66, "The green pond caller animal"],
    ["common-mudpuppy", "Common Mudpuppy", "Necturus maculosus", "Amphibian", ["external feathery gills", "fully aquatic salamander body", "cold-water bottom crawling"], "lake, river, and rocky freshwater bottom", "North America", 57, "The feathery-gilled river salamander animal"],
    ["pyrenean-brook-newt", "Pyrenean Brook Newt", "Calotriton asper", "Amphibian", ["rough warty skin texture", "stream-clinging low body", "cold mountain-water life"], "mountain stream, brook, and wet rocky ravine", "Pyrenees", 71, "The mountain-stream newt animal"],
    ["monte-iberia-eleuth", "Monte Iberia Eleuth", "Eleutherodactylus iberia", "Amphibian", ["extremely tiny frog body", "leaf-litter camouflage", "high forest-floor moisture dependence"], "humid forest floor and dense leaf litter", "Cuba", 99, "The pinhead forest frog animal"],
    ["goliath-frog", "Goliath Frog", "Conraua goliath", "Amphibian", ["enormous frog body size", "powerful river-jumping legs", "boulder-stream habitat use"], "fast river, waterfall edge, and rocky rainforest stream", "Cameroon and Equatorial Guinea", 92, "The giant river frog animal"],
    ["lake-oku-clawed-frog", "Lake Oku Clawed Frog", "Xenopus longipes", "Amphibian", ["fully aquatic clawed feet", "smooth dark lake body", "high-altitude crater-lake life"], "deep crater lake habitat", "Cameroon", 94, "The crater-lake clawed frog animal"],
    ["common-tree-frog", "Common Tree Frog", "Hyla arborea", "Amphibian", ["adhesive toe pads", "bright green skin", "reed-climbing night calling"], "pond edge, wet meadow, and shrubby wetland", "Europe and western Asia", 42, "The leaf-green tree caller animal"],
    ["red-backed-poison-frog", "Red-backed Poison Frog", "Ranitomeya reticulata", "Amphibian", ["red back with dark limbs", "tiny poison-bearing body", "bromeliad-linked breeding"], "rainforest floor and low understory vegetation", "Amazon Basin", 76, "The red-backed poison frog animal"],
    ["surinam-horned-frog", "Surinam Horned Frog", "Ceratophrys cornuta", "Amphibian", ["horned eyelid projections", "immense ambush mouth", "leaf-litter camouflage"], "rainforest floor, swamp edge, and wet woodland", "Northern South America", 69, "The horn-eyed ambush frog animal"],
    ["electric-catfish", "Electric Catfish", "Malapterurus electricus", "Fish", ["electric discharge organs", "smooth scaleless body", "night river ambush"], "river, floodplain, and murky freshwater channel", "Africa", 61, "The shock-generating river fish animal"],
    ["barramundi", "Barramundi", "Lates calcarifer", "Fish", ["large silver predatory body", "salt-and-freshwater adaptability", "surface-striking ambush"], "estuary, mangrove creek, and tropical river", "Indo-Pacific and northern Australia", 47, "The estuary-striking silver fish animal"],
    ["atlantic-sailfish", "Atlantic Sailfish", "Istiophorus albicans", "Fish", ["towering sail-like dorsal fin", "bill-tipped hydrodynamic body", "high-speed pelagic hunting"], "open tropical ocean and bluewater current zones", "Atlantic Ocean", 64, "The sail-finned speed hunter animal"],
    ["wels-catfish", "Wels Catfish", "Silurus glanis", "Fish", ["huge whiskered freshwater body", "broad suction-feeding mouth", "slow river-bottom patrolling"], "river, lake, and deep freshwater channel", "Europe and western Asia", 55, "The giant whiskered river fish animal"],
    ["freshwater-butterflyfish", "Freshwater Butterflyfish", "Pantodon buchholzi", "Fish", ["wing-like pectoral fins", "surface-skimming mouth", "still-water hovering"], "quiet creek, pond, and swampy backwater", "West and Central Africa", 59, "The wing-finned surface fish animal"],
    ["squirrelfish", "Squirrelfish", "Sargocentron rubrum", "Fish", ["huge night-adapted eyes", "spiny bright-red reef body", "cave-and-crevice schooling"], "reef wall, cave, and rocky tropical seafloor", "Indo-Pacific", 45, "The red-eyed reef squirrelfish animal"],
    ["pinecone-fish", "Pinecone Fish", "Monocentris japonica", "Fish", ["armor-like scute plates", "glowing jaw photophores", "night reef sheltering"], "rocky reef, cave, and dim coastal sea", "Indo-Pacific", 73, "The lantern-jawed pinecone fish animal"],
    ["tripod-fish", "Tripod Fish", "Bathypterois grallator", "Fish", ["extra-long fin stilts", "deep-sea standing posture", "current-facing ambush waiting"], "deep ocean floor and abyssal plain", "Worldwide deep oceans", 91, "The stilt-legged abyss fish animal"],
    ["sarcastic-fringehead", "Sarcastic Fringehead", "Neoclinus blanchardi", "Fish", ["oversized gaping mouth display", "tube-dwelling reef body", "aggressive territorial lunges"], "rock crevice, shell, and coastal reef habitat", "Eastern Pacific", 52, "The gaping cave blenny animal"],
    ["frogfish", "Warty Frogfish", "Antennarius maculatus", "Fish", ["lure-tipped angling spine", "warty camouflage skin", "walking pectoral fins"], "coral reef, sponge garden, and lagoon habitat", "Indo-Pacific", 74, "The lure-casting reef ambusher animal"],
    ["atlas-beetle", "Atlas Beetle", "Chalcosoma atlas", "Insect", ["massive horned male body", "heavy armored shell", "forest-sap feeding"], "rainforest canopy and humid woodland edge", "Southeast Asia", 57, "The tri-horned beetle animal"],
    ["elephant-beetle", "Elephant Beetle", "Megasoma elephas", "Insect", ["velvety giant horned body", "powerful lifting strength", "rainforest night activity"], "rainforest, cloud forest, and tropical woodland", "Central and South America", 63, "The velvet giant beetle animal"],
    ["rosy-maple-moth", "Rosy Maple Moth", "Dryocampa rubicunda", "Insect", ["pink-and-yellow fluffy wings", "soft feathery body", "night maple-forest flight"], "deciduous woodland and suburban tree cover", "North America", 36, "The candy-colored silk moth animal"],
    ["polyphemus-moth", "Polyphemus Moth", "Antheraea polyphemus", "Insect", ["huge eye-spot wings", "thick silken body", "short-lived adult emergence"], "forest, orchard, and suburban woodland", "North America", 44, "The eye-spot giant moth animal"],
    ["sunset-moth", "Sunset Moth", "Chrysiridia rhipheus", "Insect", ["iridescent rainbow wing scales", "day-flying moth behavior", "streamlined tropical flight"], "forest edge, shrubland, and humid woodland", "Madagascar", 72, "The rainbow-day moth animal"],
    ["assassin-bug", "Milkweed Assassin Bug", "Zelus longipes", "Insect", ["raptorial sticky forelegs", "piercing predatory beak", "flower-stalk ambush posture"], "garden, field edge, and shrubby habitat", "The Americas", 41, "The beaked ambush bug animal"],
    ["water-scorpion", "Water Scorpion", "Nepa cinerea", "Insect", ["raptorial forelegs", "breathing tail siphon", "still-water ambush behavior"], "pond, ditch, and quiet wetland", "Europe and Asia", 48, "The siphon-tailed water hunter animal"],
    ["whirligig-beetle", "Whirligig Beetle", "Dineutus nigrior", "Insect", ["split above-and-below-water eyes", "rapid spinning surface movement", "slick oval body"], "pond, stream pool, and slow river surface", "North America", 39, "The spinning water beetle animal"],
    ["velvet-ant", "Velvet Ant", "Dasymutilla occidentalis", "Insect", ["fuzzy bright warning coat", "wingless female body", "painful defensive sting"], "sandy field, scrub, and dry woodland edge", "North America", 53, "The fuzzy warning wasp animal"],
    ["tailless-whip-spider", "Tailless Whip Spider", "Phrynus marginemaculatus", "Arachnid", ["flattened wall-hugging body", "whip-like sensory front legs", "cave-and-bark night stalking"], "cave entrance, tree bark, and rocky shelter", "Florida and Caribbean regions", 58, "The whip-armed night spider animal"]
];

const speciesSeedsSeven: SpeciesSeedSeven[] = speciesSeedRowsSeven.map(([
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

export const additionalSpeciesEntriesInputSeven = speciesSeedsSeven.map((seed) => ({
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

export const additionalSpeciesSystemsIntelligenceSeven = Object.fromEntries(
    speciesSeedsSeven.map((seed) => [
        seed.slug,
        {
            roleTitle: buildRoleTitle(seed.descriptor),
            specializedHardware: `${seed.traits[0]}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} give the ${seed.name} a body plan tuned for its niche.`,
            systemsScript: `${seed.name}s operate through ${lowerFirst(seed.habitat)}. Their design links movement, feeding, shelter, and timing into one workable survival system.`,
            strategicInsight: buildStrategicInsight(seed)
        } satisfies SystemsIntelligenceEntry
    ])
) as Record<string, SystemsIntelligenceEntry>;

export const additionalSpeciesDescriptorsSeven = Object.fromEntries(
    speciesSeedsSeven.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesSeven = Object.fromEntries(
    speciesSeedsSeven.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;

export const additionalSpeciesMiniSystemsSeven = Object.fromEntries(
    speciesSeedsSeven.map((seed) => [seed.slug, `${seed.name} thrives by using ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} in ${lowerFirst(seed.habitat)}.`])
) as Record<string, string>;
