import {SystemsIntelligenceEntry} from "@/data/content-schema";

type SpeciesSeedSix = {
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

type SpeciesSeedSixRow = [
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

function buildSubtitleStory(seed: SpeciesSeedSix) {
    return `The ${seed.name} is a ${seed.category.toLowerCase()} with ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])}. It belongs to ${lowerFirst(seed.habitat)} where those traits help it stay effective.`;
}

function buildStrategicInsight(seed: SpeciesSeedSix) {
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

    if (category.includes("insect") || category.includes("arachnid") || category.includes("arthropod")) {
        return "Small systems become powerful when signal, timing, and specialization stay tightly linked.";
    }

    if (/(grassland|plain|savannah|open country|prairie)/.test(habitat)) {
        return "Open landscapes reward early detection, clean movement, and fast decisions once the space opens up.";
    }

    return "Good design turns a difficult habitat into usable ground.";
}

const speciesSeedRowsSix: SpeciesSeedSixRow[] = [
    ["bushbuck", "Bushbuck", "Tragelaphus scriptus", "Mammal", ["striped chestnut woodland coat", "curving spiral horns in males", "quiet edge-cover browsing"], "riverine thicket, woodland edge, and dense bush", "Sub-Saharan Africa", 52, "The striped thicket antelope animal"],
    ["nile-lechwe", "Nile Lechwe", "Kobus megaceros", "Mammal", ["elongated marsh-running hooves", "golden-brown wetland coat", "shallow-water herd movement"], "floodplain marsh, papyrus swamp, and wet grassland", "South Sudan and Ethiopia", 91, "The floodplain marsh antelope animal"],
    ["red-hartebeest", "Red Hartebeest", "Alcelaphus caama", "Mammal", ["long narrow face", "lyre-curved horns", "endurance running on open plains"], "dry savannah, open grassland, and semi-arid plain", "Southern Africa", 54, "The long-faced plain runner animal"],
    ["bontebok", "Bontebok", "Damaliscus pygargus", "Mammal", ["purple-brown body with white blaze", "ringed ridged horns", "open-country herd vigilance"], "fynbos plain, renosterveld, and grassy coastal flat", "South Africa", 82, "The white-faced cape antelope animal"],
    ["roan-antelope", "Roan Antelope", "Hippotragus equinus", "Mammal", ["upright scimitar-curved horns", "black-and-white facial mask", "tall grassland scanning posture"], "savannah woodland, tall grassland, and open bush country", "Sub-Saharan Africa", 66, "The black-masked savannah antelope animal"],
    ["beira", "Beira", "Dorcatragus megalotis", "Mammal", ["oversized alert ears", "tiny gray-tan body", "rocky scrub sure-footing"], "stony hillside, arid scrub, and thorny slope", "Djibouti, Ethiopia, and Somalia", 94, "The big-eared rock gazelle animal"],
    ["mountain-nyala", "Mountain Nyala", "Tragelaphus buxtoni", "Mammal", ["white body stripes", "spiraled horns", "misty highland browsing"], "montane forest, heathland, and highland woodland edge", "Ethiopia", 89, "The highland spiral antelope animal"],
    ["kirk-dik-dik", "Kirk's Dik-dik", "Madoqua kirkii", "Mammal", ["tiny pointed muzzle", "large dark eyes", "quick zigzag cover dashes"], "thorn scrub, dry bushland, and open acacia country", "Eastern and southern Africa", 58, "The tiny thorn-scrub antelope animal"],
    ["urial", "Urial", "Ovis vignei", "Mammal", ["sweeping corkscrew horns", "sandy mountain coat", "steep-slope flock movement"], "dry mountain slope, steppe, and scrubby ravine", "Central and South Asia", 74, "The spiral-horn mountain sheep animal"],
    ["indian-muntjac", "Indian Muntjac", "Muntiacus muntjak", "Mammal", ["short antlers with long pedicles", "fang-like upper canines", "barking alarm calls"], "forest edge, dense scrub, and humid woodland", "South and Southeast Asia", 49, "The barking forest deer animal"],
    ["java-mouse-deer", "Java Mouse-deer", "Tragulus javanicus", "Mammal", ["tiny delicate hoofed frame", "slender pointed snout", "leaf-litter quickstep movement"], "lowland forest, mangrove edge, and dense understory", "Java and nearby Indonesian islands", 77, "The leaf-litter pocket deer animal"],
    ["american-marten", "American Marten", "Martes americana", "Mammal", ["slender climbing mustelid body", "bushy balancing tail", "snowy forest stealth hunting"], "conifer forest, mixed woodland, and snowy boreal cover", "North America", 53, "The spruce-shadow hunter animal"],
    ["rock-hyrax", "Rock Hyrax", "Procavia capensis", "Mammal", ["rubbery gripping foot pads", "stout rock-loving body", "sun-basking colony life"], "rocky outcrop, cliff, and dry scrub slope", "Africa and the Middle East", 43, "The sun-basking rock grazer animal"],
    ["ringed-seal", "Ringed Seal", "Pusa hispida", "Mammal", ["small ice-adapted seal body", "dark coat with pale rings", "breathing-hole sea-ice life"], "Arctic sea ice, cold coastal water, and frozen leads", "Arctic Ocean", 68, "The ring-marked ice seal animal"],
    ["bearded-seal", "Bearded Seal", "Erignathus barbatus", "Mammal", ["long whiskers for seafloor sensing", "heavy blubber-rich body", "deep diving under pack ice"], "Arctic shelf sea, drifting ice, and cold coast", "Arctic regions", 63, "The whiskered ice diver animal"],
    ["harbor-porpoise", "Harbor Porpoise", "Phocoena phocoena", "Marine mammal", ["compact blunt-snouted body", "triangular dorsal fin", "quiet coastal echolocation"], "cold coastal sea, estuary mouth, and continental shelf water", "Northern Hemisphere coastal waters", 59, "The quiet coastal porpoise animal"],
    ["paca", "Paca", "Cuniculus paca", "Mammal", ["spotted barrel-shaped body", "strong rodent digging feet", "night riverbank foraging"], "rainforest, riverbank thicket, and humid woodland", "Central and South America", 46, "The spotted riverbank rodent animal"],
    ["jerboa", "Jerboa", "Jaculus jaculus", "Mammal", ["very long springing hind legs", "long tufted balancing tail", "night desert hopping"], "sand desert, semi-arid steppe, and rocky plain", "North Africa and the Middle East", 61, "The moon-hopping desert rodent animal"],
    ["degu", "Degu", "Octodon degus", "Mammal", ["whiskered social rodent body", "brush-tipped tail", "day-active burrow colony life"], "dry scrub, rocky foothill, and Mediterranean shrubland", "Chile", 44, "The daylight burrow rodent animal"],
    ["lesser-hedgehog-tenrec", "Lesser Hedgehog Tenrec", "Echinops telfairi", "Mammal", ["short protective spines", "long probing snout", "night insect foraging"], "dry forest, scrubland, and spiny thicket", "Madagascar", 67, "The prickled insect snuffler animal"],
    ["white-nosed-coati", "White-nosed Coati", "Nasua narica", "Mammal", ["long flexible snout", "ringed tail", "busy troop foraging"], "dry forest, rainforest edge, and woodland", "Central America and Mexico", 45, "The ring-tailed nose scout animal"],
    ["cacomistle", "Cacomistle", "Bassariscus sumichrasti", "Mammal", ["long ringed balancing tail", "catlike climbing agility", "large night-adapted eyes"], "cloud forest, tropical woodland, and rocky ravine", "Central America", 69, "The ring-tailed cliff climber animal"],
    ["mouflon", "Mouflon", "Ovis gmelini musimon", "Mammal", ["heavy curling horns", "stocky hill-grazing body", "rocky slope flocking"], "rocky grassland, mountain scrub, and Mediterranean slope", "Europe and western Asia", 57, "The horn-curled hillside sheep animal"],
    ["bay-duiker", "Bay Duiker", "Cephalophus dorsalis", "Mammal", ["chestnut forest-floor coat", "arched back posture", "secretive understory browsing"], "lowland rainforest, dense thicket, and swamp forest edge", "West and Central Africa", 72, "The chestnut shadow duiker animal"],
    ["long-tailed-chinchilla", "Long-tailed Chinchilla", "Chinchilla lanigera", "Mammal", ["extremely soft dense fur", "large heat-shedding ears", "rock-crevice highland hopping"], "dry rocky slope and Andean shrubland", "Chile", 88, "The velvet-furred cliff rodent animal"],
    ["spotted-tailed-quoll", "Spotted-tailed Quoll", "Dasyurus maculatus", "Mammal", ["white-spotted predator coat", "long muscular tail", "tree-and-ground hunting"], "forest, wet sclerophyll woodland, and rocky gully", "Australia", 76, "The spotted forest quoll animal"],
    ["hog-badger", "Hog Badger", "Arctonyx collaris", "Mammal", ["piglike digging snout", "heavy low-set body", "powerful clawed foraging"], "forest edge, hill woodland, and agricultural fringe", "South and Southeast Asia", 58, "The snout-plow badger animal"],
    ["springhare", "Springhare", "Pedetes capensis", "Mammal", ["kangaroo-like hopping legs", "big reflective night eyes", "burrow-based open-ground life"], "savannah, dry grassland, and scrub plain", "Southern Africa", 54, "The moonlit hopper rodent animal"],
    ["mountain-beaver", "Mountain Beaver", "Aplodontia rufa", "Mammal", ["short sturdy digging limbs", "primitive rodent build", "damp fern-thicket tunneling"], "wet forest, fern understory, and mossy hillside", "Pacific Northwest", 64, "The fern-tunnel relic rodent animal"],
    ["bawean-deer", "Bawean Deer", "Axis kuhlii", "Mammal", ["small island deer frame", "short upright antlers", "low-cover forest browsing"], "island forest, shrubland, and teak woodland edge", "Bawean Island, Indonesia", 96, "The island-hidden deer animal"],
    ["great-frigatebird", "Great Frigatebird", "Fregata minor", "Bird", ["forked tail and giant wings", "red inflatable throat pouch", "effortless ocean soaring"], "tropical ocean, island coast, and nesting scrub", "Tropical oceans worldwide", 56, "The fork-tailed sky pirate animal"],
    ["african-jacana", "African Jacana", "Actophilornis africanus", "Bird", ["extremely long spreading toes", "chestnut and black wetland body", "lily-pad walking balance"], "marsh, floating wetland, and shallow pond edge", "Sub-Saharan Africa", 47, "The lily-walker marsh bird animal"],
    ["great-cormorant", "Great Cormorant", "Phalacrocorax carbo", "Bird", ["hook-tipped fish-catching bill", "black water-slick plumage", "wing-spreading drying posture"], "coastline, estuary, lake, and riverbank", "Worldwide", 37, "The black water fisher animal"],
    ["eurasian-bittern", "Eurasian Bittern", "Botaurus stellaris", "Bird", ["reed-striped camouflage body", "upward freezing posture", "booming marsh calls"], "reedbed, marsh, and flooded wetland", "Europe, Asia, and North Africa", 74, "The reed-mimic marsh heron animal"],
    ["helmeted-guineafowl", "Helmeted Guineafowl", "Numida meleagris", "Bird", ["speckled dark body", "bare blue head with casque", "fast ground-running flock movement"], "savannah, scrub, and open woodland", "Africa", 42, "The speckled ground runner animal"],
    ["turquoise-browed-motmot", "Turquoise-browed Motmot", "Eumomota superciliosa", "Bird", ["brilliant turquoise eyebrow stripe", "racket-tipped tail feathers", "perch-and-sally insect hunting"], "dry forest, scrub, and open woodland edge", "Central America", 39, "The racket-tailed branch watcher animal"],
    ["red-capped-manakin", "Red-capped Manakin", "Ceratopipra mentalis", "Bird", ["glossy black body", "bright red cap", "moonwalk-style courtship dance"], "rainforest understory and humid woodland", "Central America and northwestern South America", 53, "The red-capped dance bird animal"],
    ["scarlet-rumped-cacique", "Scarlet-rumped Cacique", "Cacicus uropygialis", "Bird", ["black hanging-nest body", "scarlet rump patch", "loud colony calling"], "rainforest edge, river corridor, and humid forest", "Central America", 48, "The scarlet-rumped nest weaver animal"],
    ["crested-oropendola", "Crested Oropendola", "Psarocolius decumanus", "Bird", ["long wedge-shaped bill", "golden tail plumes", "swaying woven nest colonies"], "rainforest canopy, river forest, and woodland edge", "South America", 46, "The golden-tailed canopy weaver animal"],
    ["great-blue-turaco", "Great Blue Turaco", "Corythaeola cristata", "Bird", ["towering blue canopy body", "yellow bill and crest", "heavy fruit-carrying flight"], "rainforest canopy and dense tropical forest", "Central and West Africa", 61, "The blue canopy fruit bird animal"],
    ["northern-lapwing", "Northern Lapwing", "Vanellus vanellus", "Bird", ["wispy crest plume", "broad rounded wings", "rolling display flight"], "wet meadow, pasture, and open farmland", "Europe and Asia", 44, "The crested meadow tumbler animal"],
    ["marbled-godwit", "Marbled Godwit", "Limosa fedoa", "Bird", ["long slightly upturned bill", "warm marbled shore plumage", "probing tidal-flat feeding"], "tidal mudflat, prairie wetland, and coastal marsh", "North America", 51, "The marbled long-bill wader animal"],
    ["short-billed-dowitcher", "Short-billed Dowitcher", "Limnodromus griseus", "Bird", ["straight probing bill", "sewing-machine feeding rhythm", "long migratory shorebird routes"], "mudflat, estuary, and salt marsh", "The Americas", 48, "The stitch-feeding shorebird animal"],
    ["sooty-shearwater", "Sooty Shearwater", "Ardenna grisea", "Bird", ["slender ocean-gliding wings", "dark pelagic body", "long-distance migration"], "open ocean and windswept coastal sea", "Pacific and Atlantic oceans", 58, "The globe-roving shearwater animal"],
    ["southern-screamer", "Southern Screamer", "Chauna torquata", "Bird", ["goose-like marsh body", "spur-bearing wings", "far-carrying bugle calls"], "marsh, flooded grassland, and lake edge", "South America", 57, "The bugle-voice marsh bird animal"],
    ["king-eider", "King Eider", "Somateria spectabilis", "Bird", ["multicolored knobbed bill", "thick polar diving body", "sea-ice coastal flocking"], "Arctic coast, tundra pond, and cold sea", "Arctic regions", 63, "The crown-billed sea duck animal"],
    ["kagu", "Kagu", "Rhynochetos jubatus", "Bird", ["ash-gray crested body", "broad barred wings for display", "ground-living forest patrol"], "humid mountain forest and dense island woodland", "New Caledonia", 92, "The ghost-gray island bird animal"],
    ["black-faced-ibis", "Black-faced Ibis", "Theristicus melanopis", "Bird", ["long downcurved probing bill", "dark bare facial skin", "meadow and marsh walking"], "wet pasture, marsh, and open plain", "South America", 49, "The black-faced meadow ibis animal"],
    ["rufous-tailed-jacamar", "Rufous-tailed Jacamar", "Galbula ruficauda", "Bird", ["long needle-like bill", "metallic green body", "hawking insect flight"], "forest edge, second growth, and riverine woodland", "Central and South America", 43, "The metallic insect dart animal"],
    ["horned-grebe", "Horned Grebe", "Podiceps auritus", "Bird", ["gold hornlike breeding plumes", "compact diving body", "feet-set-back underwater pursuit"], "pond, lake, and coastal inlet", "Northern Hemisphere", 46, "The gold-horn diving bird animal"],
    ["black-naped-tern", "Black-naped Tern", "Sterna sumatrana", "Bird", ["clean white seabird body", "thin black eye stripe", "knife-light plunge feeding"], "coral island, reef lagoon, and tropical coast", "Indian and Pacific oceans", 52, "The black-naped reef tern animal"],
    ["white-faced-whistling-duck", "White-faced Whistling-duck", "Dendrocygna viduata", "Bird", ["white face and chest", "long-necked duck silhouette", "flock whistling over wetlands"], "marsh, lagoon, and flooded grassland", "Africa and South America", 45, "The whistling wetland duck animal"],
    ["andean-cock-of-the-rock", "Andean Cock-of-the-rock", "Rupicola peruvianus", "Bird", ["brilliant orange fan crest", "lek-court dancing display", "cloud-forest cliff nesting"], "cloud forest, ravine, and humid montane woodland", "Andes of South America", 68, "The orange cloud-forest dancer animal"],
    ["yellow-billed-stork", "Yellow-billed Stork", "Mycteria ibis", "Bird", ["long yellow probing bill", "pink-flushed white wings", "slow shallows sweeping"], "marsh, floodplain, and lake edge", "Africa", 48, "The yellow-billed marsh stork animal"],
    ["piping-plover", "Piping Plover", "Charadrius melodus", "Bird", ["small sand-colored shorebird body", "thin black neck band", "stop-start beach running"], "sandy beach, alkali flat, and open shore", "North America", 93, "The pale beach runner animal"],
    ["common-basilisk", "Common Basilisk", "Basiliscus basiliscus", "Reptile", ["crest-topped green-brown body", "long balancing tail", "water-running escape bursts"], "riverbank forest, humid woodland, and stream edge", "Central America", 58, "The river-running lizard animal"],
    ["red-sided-garter-snake", "Red-sided Garter Snake", "Thamnophis sirtalis parietalis", "Reptile", ["red flank stripes", "cold-climate emergence swarms", "quick grass-and-marsh hunting"], "prairie wetland, meadow, and woodland edge", "North America", 41, "The ribbon-striped marsh snake animal"],
    ["diamondback-terrapin", "Diamondback Terrapin", "Malaclemys terrapin", "Reptile", ["diamond-patterned shell scutes", "webbed estuary feet", "brackish marsh swimming"], "salt marsh, estuary creek, and tidal lagoon", "Eastern United States", 77, "The diamond-shelled marsh turtle animal"],
    ["common-snapping-turtle", "Common Snapping Turtle", "Chelydra serpentina", "Reptile", ["heavy ridged shell", "hooked beak and long neck", "bottom-resting ambush"], "pond, river backwater, and marsh", "North America", 50, "The heavy-jawed pond tank animal"],
    ["leopard-tortoise", "Leopard Tortoise", "Stigmochelys pardalis", "Reptile", ["spotted domed shell", "long dryland legs", "slow open-country grazing"], "savannah, scrubland, and semi-arid grassland", "Eastern and southern Africa", 55, "The spotted shell grazer animal"],
    ["green-iguana", "Green Iguana", "Iguana iguana", "Reptile", ["dewlap and tall dorsal spines", "long arboreal tail", "sun-basking riverside climbing"], "river forest, mangrove edge, and tropical woodland", "Central and South America", 39, "The dewlap-backed tree lizard animal"],
    ["madagascar-ground-boa", "Madagascar Ground Boa", "Acrantophis madagascariensis", "Reptile", ["heavy blotched constrictor body", "triangular broad head", "night ambush on dry forest floor"], "dry forest, scrubland, and sandy woodland", "Madagascar", 79, "The blotched island constrictor animal"],
    ["boelens-python", "Boelen's Python", "Simalia boeleni", "Reptile", ["iridescent dark scales", "pale banding across body", "cool-mountain forest climbing"], "montane forest, mossy ridge, and highland scrub", "New Guinea", 89, "The iridescent mountain python animal"],
    ["spiny-tailed-lizard", "Spiny-tailed Lizard", "Uromastyx aegyptia", "Reptile", ["clubby spined tail", "stocky desert body", "burrow-based basking life"], "rocky desert, arid plain, and semi-desert scrub", "North Africa and the Middle East", 64, "The spined-tail desert grazer animal"],
    ["desert-horned-viper", "Desert Horned Viper", "Cerastes cerastes", "Reptile", ["horns above the eyes", "sidewinding sand travel", "buried ambush posture"], "sand desert, dune slope, and arid plain", "North Africa and the Middle East", 63, "The horn-eyed dune viper animal"],
    ["philippine-sailfin-lizard", "Philippine Sailfin Lizard", "Hydrosaurus pustulatus", "Reptile", ["tall sail-like tail crest", "strong clawed riverbank limbs", "water-edge diving escapes"], "river forest, swamp edge, and tropical stream corridor", "Philippines", 84, "The sail-backed river dragon animal"],
    ["false-water-cobra", "False Water Cobra", "Hydrodynastes gigas", "Reptile", ["broad neck-flaring display", "olive blotched body", "wetland-active predatory roaming"], "swamp, marsh, and flooded grassland", "South America", 57, "The hood-flaring marsh snake animal"],
    ["ornate-box-turtle", "Ornate Box Turtle", "Terrapene ornata", "Reptile", ["hinged domed shell", "yellow starburst markings", "dry grassland wandering"], "prairie, scrub, and sandy grassland", "Central United States and Mexico", 69, "The star-marked box turtle animal"],
    ["african-rock-python", "African Rock Python", "Python sebae", "Reptile", ["very large heavy body", "brown blotched camouflage", "water-edge ambush strength"], "savannah, marsh, and rocky woodland edge", "Sub-Saharan Africa", 62, "The rock-blotched giant python animal"],
    ["yellow-spotted-river-turtle", "Yellow-spotted River Turtle", "Podocnemis unifilis", "Reptile", ["yellow facial spotting", "flat river-adapted shell", "sandbank nesting migrations"], "large river, oxbow lake, and flooded forest", "Amazon and Orinoco basins", 81, "The yellow-spotted river turtle animal"],
    ["spotted-salamander", "Spotted Salamander", "Ambystoma maculatum", "Amphibian", ["bold yellow body spots", "stout moist forest frame", "vernal-pool breeding migrations"], "damp woodland, leaf litter, and seasonal pool", "Eastern North America", 52, "The yellow-spotted woodland salamander animal"],
    ["wood-frog", "Wood Frog", "Lithobates sylvaticus", "Amphibian", ["dark facial mask", "freeze-tolerant cold-season body", "early spring pond breeding"], "forest floor, bog edge, and temporary pond", "North America", 47, "The freeze-hardy forest frog animal"],
    ["paradoxical-frog", "Paradoxical Frog", "Pseudis paradoxa", "Amphibian", ["tadpoles larger than adults", "long-legged pond body", "aquatic weed-cover living"], "pond, marsh, and slow tropical wetland", "South America", 71, "The giant-tadpole paradox frog animal"],
    ["caecilian", "Yellow-banded Caecilian", "Ichthyophis glutinosus", "Amphibian", ["limbless burrowing body", "annulated skin rings", "soil-and-streambank tunneling"], "rainforest soil, stream margin, and wet leaf litter", "South and Southeast Asia", 73, "The hidden tunnel amphibian animal"],
    ["midwife-toad", "Common Midwife Toad", "Alytes obstetricans", "Amphibian", ["male egg-carrying behavior", "warty small toad body", "stone-crevice sheltering"], "rocky meadow, woodland edge, and garden wall habitat", "Western Europe", 58, "The egg-carrying little toad animal"],
    ["smooth-newt", "Smooth Newt", "Lissotriton vulgaris", "Amphibian", ["smooth olive breeding skin", "orange belly with spots", "pond-to-land seasonal cycle"], "pond, ditch, and damp grassland edge", "Europe and western Asia", 43, "The pond-to-land newt animal"],
    ["fire-bellied-toad", "Oriental Fire-bellied Toad", "Bombina orientalis", "Amphibian", ["bright orange warning belly", "small warty semi-aquatic body", "arching defensive display"], "pond edge, marsh, and wet woodland", "East Asia", 56, "The warning-belly pond toad animal"],
    ["eastern-red-backed-salamander", "Eastern Red-backed Salamander", "Plethodon cinereus", "Amphibian", ["red dorsal stripe", "lungless moist-skin breathing", "log-and-stone forest hiding"], "humid forest floor and mossy woodland", "Eastern North America", 42, "The red-striped forest salamander animal"],
    ["ornate-horned-frog", "Ornate Horned Frog", "Ceratophrys ornata", "Amphibian", ["huge mouth and broad head", "leaf-litter camouflage", "still ambush sitting"], "wet grassland, marsh edge, and seasonal floodplain", "Argentina, Uruguay, and Brazil", 60, "The leaf-mimic ambush frog animal"],
    ["spadefoot-toad", "Couch's Spadefoot", "Scaphiopus couchii", "Amphibian", ["hardened digging spade on hind feet", "explosive rain-pool breeding", "buried desert dormancy"], "arid grassland, desert flat, and monsoon pool habitat", "Southwestern United States and Mexico", 68, "The rain-burst burrow toad animal"],
    ["atlantic-tarpon", "Atlantic Tarpon", "Megalops atlanticus", "Fish", ["huge silver armored scales", "air-gulping surface rolls", "powerful estuary leaps"], "coastal sea, estuary, lagoon, and river mouth", "Atlantic tropics and subtropics", 62, "The silver-roll tarpon animal"],
    ["senegal-bichir", "Senegal Bichir", "Polypterus senegalus", "Fish", ["primitive armored scales", "row of dorsal finlets", "air-breathing bottom cruising"], "slow river, floodplain pool, and swamp channel", "West and Central Africa", 55, "The finlet-backed relic fish animal"],
    ["american-paddlefish", "American Paddlefish", "Polyodon spathula", "Fish", ["long paddle-like snout", "gill-raker plankton filtering", "broad river cruising"], "large river channel, reservoir, and backwater", "United States", 83, "The paddle-snouted river filter animal"],
    ["longnose-gar", "Longnose Gar", "Lepisosteus osseus", "Fish", ["very long tooth-lined snout", "ganoid armor scales", "surface-cruising ambush"], "river, lake, and estuary backwater", "North America", 49, "The needle-snout armor fish animal"],
    ["silver-arowana", "Silver Arowana", "Osteoglossum bicirrhosum", "Fish", ["upturned surface-feeding mouth", "long metallic body", "high leap for prey capture"], "flooded forest, slow river, and oxbow lake", "Amazon Basin", 58, "The silver leaping river fish animal"],
    ["roosterfish", "Roosterfish", "Nematistius pectoralis", "Fish", ["dramatic comb-like dorsal rays", "sleek blue-gray body", "surf-zone burst hunting"], "rocky coast, sandy bay, and warm inshore sea", "Eastern Pacific", 57, "The comb-finned surf hunter animal"],
    ["mahi-mahi", "Mahi-mahi", "Coryphaena hippurus", "Fish", ["electric blue-green open-water body", "blunt high forehead", "fast floating-debris hunting"], "tropical ocean and open pelagic water", "Warm seas worldwide", 41, "The neon bluewater hunter animal"],
    ["clown-loach", "Clown Loach", "Chromobotia macracanthus", "Fish", ["orange body with bold black bands", "downturned barbels", "social river-bottom shoaling"], "forest stream, floodplain river, and submerged root habitat", "Borneo and Sumatra", 66, "The banded river loach animal"],
    ["moorish-idol", "Moorish Idol", "Zanclus cornutus", "Fish", ["long trailing dorsal filament", "bold black-yellow-white pattern", "reef-face grazing behavior"], "coral reef, lagoon, and tropical rocky coast", "Indo-Pacific", 54, "The banner-finned reef icon animal"],
    ["bowmouth-guitarfish", "Bowmouth Guitarfish", "Rhina ancylostoma", "Fish", ["broad shark-ray body", "white-spotted armored back", "bottom-resting reef patrol"], "reef flat, sandy channel, and coastal sea floor", "Indo-West Pacific", 92, "The spotted shark-ray giant animal"],
    ["walking-stick", "Northern Walkingstick", "Diapheromera femorata", "Insect", ["twig-mimicking long body", "slow rocking branch movement", "leaf-chewing camouflage"], "woodland canopy, shrub layer, and deciduous forest edge", "North America", 37, "The twig-mimic leaf eater animal"],
    ["mantidfly", "Mantidfly", "Climaciella brunnea", "Insect", ["mantis-like raptorial forelegs", "lacewing-style wings", "wasp-mimicking body pattern"], "meadow edge, garden, and woodland margin", "North America", 44, "The mantis-wing mimic animal"],
    ["green-lacewing", "Green Lacewing", "Chrysoperla carnea", "Insect", ["delicate green body", "golden eyes", "aphid-hunting larval jaws"], "garden, meadow, and woodland edge", "Europe, Asia, and North America", 34, "The golden-eyed lace hunter animal"],
    ["mayfly", "Giant Burrowing Mayfly", "Hexagenia limbata", "Insect", ["sail-like upright wings", "long tail filaments", "brief adult swarming life"], "lake, river, and freshwater margin habitat", "North America", 39, "The one-night river hatch animal"],
    ["stonefly", "Giant Stonefly", "Pteronarcys californica", "Insect", ["flattened stream-clinging body", "strong folded wings", "cold-water nymph development"], "cold river, stream riffle, and rocky bank", "Western North America", 46, "The cold-river stone insect animal"],
    ["cicada-killer-wasp", "Cicada Killer Wasp", "Sphecius speciosus", "Insect", ["large amber-winged body", "powerful cicada-hauling flight", "burrow-provisioning hunting"], "sandy soil, meadow, and open woodland edge", "North America", 38, "The cicada-hauling giant wasp animal"],
    ["robber-fly", "Red-footed Cannibalfly", "Promachus rufipes", "Insect", ["bearded predatory face", "spiny prey-grabbing legs", "midair interception hunting"], "field margin, scrub, and dry grassland", "North America", 42, "The midair ambush fly animal"],
    ["antlion", "Spotted-winged Antlion", "Myrmeleon immaculatus", "Insect", ["delicate net-veined wings", "pit-building larval traps", "night-active adult flight"], "sandy soil, woodland edge, and dry bank", "North America", 41, "The sand-pit trap insect animal"],
    ["camel-spider", "Camel Spider", "Galeodes arabs", "Arachnid", ["huge forward chelicerae", "fast desert sprinting legs", "night-active open-ground hunting"], "desert, rocky plain, and arid scrub", "Middle East and North Africa", 52, "The fast-jawed desert hunter animal"],
    ["harvestman", "Common Harvestman", "Phalangium opilio", "Arachnid", ["tiny body with very long legs", "single fused body shape", "slow scavenging night walk"], "meadow, garden, and woodland edge", "Europe and North America", 33, "The long-legged dusk walker animal"]
];

const speciesSeedsSix: SpeciesSeedSix[] = speciesSeedRowsSix.map(([
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

export const additionalSpeciesEntriesInputSix = speciesSeedsSix.map((seed) => ({
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

export const additionalSpeciesSystemsIntelligenceSix = Object.fromEntries(
    speciesSeedsSix.map((seed) => [
        seed.slug,
        {
            roleTitle: buildRoleTitle(seed.descriptor),
            specializedHardware: `${seed.traits[0]}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} give the ${seed.name} a body plan tuned for its niche.`,
            systemsScript: `${seed.name}s operate through ${lowerFirst(seed.habitat)}. Their design links movement, feeding, shelter, and timing into one workable survival system.`,
            strategicInsight: buildStrategicInsight(seed)
        } satisfies SystemsIntelligenceEntry
    ])
) as Record<string, SystemsIntelligenceEntry>;

export const additionalSpeciesDescriptorsSix = Object.fromEntries(
    speciesSeedsSix.map((seed) => [seed.slug, seed.descriptor])
) as Record<string, string>;

export const additionalSpeciesSubtitleStoriesSix = Object.fromEntries(
    speciesSeedsSix.map((seed) => [seed.slug, buildSubtitleStory(seed)])
) as Record<string, string>;

export const additionalSpeciesMiniSystemsSix = Object.fromEntries(
    speciesSeedsSix.map((seed) => [seed.slug, `${seed.name} thrives by using ${lowerFirst(seed.traits[0])}, ${lowerFirst(seed.traits[1])}, and ${lowerFirst(seed.traits[2])} in ${lowerFirst(seed.habitat)}.`])
) as Record<string, string>;
