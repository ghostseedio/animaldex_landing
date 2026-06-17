export const ANIMAL_HYBRID_CANONICAL_BASE_PATH = "/animal-hybrids";

export type AnimalHybridParent = {
    slug: string;
    name: string;
    behavior: string;
};

export type AnimalHybridAbility = {
    name: string;
    description: string;
    trigger: string;
};

export type AnimalHybridEntry = {
    slug: string;
    title: string;
    hybridName: string;
    parents: [AnimalHybridParent, AnimalHybridParent];
    seoQuestion: string;
    quickAnswer: string;
    appearance: string;
    behaviorBlend: string;
    ultimateAbility: AnimalHybridAbility;
    viability: string;
    habitatRole: string;
    searchIntents: string[];
    updatedAt: string;
};

const curatedAnimalHybridEntries: AnimalHybridEntry[] = [
    {
        slug: "zebra-rhino-hybrid",
        title: "Zebra + Rhino Hybrid",
        hybridName: "Stripehorn Rhino",
        parents: [
            {slug: "plains-zebra", name: "Plains Zebra", behavior: "herd vigilance, burst running, and confusion striping"},
            {slug: "white-rhinoceros", name: "White Rhinoceros", behavior: "heavy grazing, territorial presence, armor, and short explosive charges"}
        ],
        seoQuestion: "How might a zebra and rhino cross look?",
        quickAnswer: "A zebra and rhino hybrid would not be a real viable cross, but as a speculative creature it would look like a compact armored grazer with zebra striping, a rhino horn, herd-alert posture, and a heavy charge.",
        appearance: "The Stripehorn Rhino would have the barrel chest and horned head of a rhino, a shorter zebra-like mane, bold striping across the shoulders and flanks, and dense folded skin that breaks the stripe pattern into armor plates.",
        behaviorBlend: "It would graze in open country like a rhino but stay tuned to herd signals like a zebra. When threatened, it would first confuse predators with moving stripes, then pivot into a short armored charge.",
        ultimateAbility: {
            name: "Dazzle Charge",
            description: "A sudden burst where herd-style zigzag movement turns into a rhino-weight impact, making the hybrid hard to read and dangerous to block.",
            trigger: "Activated when a predator fixes on one target in open grassland."
        },
        viability: "This is a fictional AnimalDex hybrid. Zebras and rhinos are too distantly related for a real biological hybrid.",
        habitatRole: "Open savannah grazer that protects herd edges and pushes predators away from water crossings.",
        searchIntents: ["zebra rhino hybrid", "zebra and rhino cross", "zerba rhino", "what would a zebra rhino look like"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "lion-eagle-hybrid",
        title: "Lion + Eagle Hybrid",
        hybridName: "Suncrest Gryphon",
        parents: [
            {slug: "lion", name: "Lion", behavior: "pride pressure, territorial defense, and close-range power"},
            {slug: "eagle", name: "Eagle", behavior: "high vantage scanning, talon strikes, and energy-saving soaring"}
        ],
        seoQuestion: "How might a lion and eagle hybrid look?",
        quickAnswer: "A lion and eagle hybrid would be a gryphon-like predator with a lion body, eagle head and forelimbs, broad wings, and a hunting style built around aerial scouting followed by pride-level pressure.",
        appearance: "The Suncrest Gryphon would carry a lion's muscular hindquarters and tail, an eagle's hooked beak and talons, and a mane that turns into crest feathers along the neck and shoulders.",
        behaviorBlend: "It would scan from cliffs or thermals, mark territory with visible display, and use short dives to scatter prey toward a waiting pride or den group.",
        ultimateAbility: {
            name: "Solar Pounce",
            description: "A high-angle dive that converts eagle vision and lion mass into one decisive pinning strike.",
            trigger: "Activated after the hybrid identifies a weak point from above."
        },
        viability: "This is a mythic-style fictional hybrid, not a real possible cross between mammals and birds.",
        habitatRole: "Cliff-edge apex guardian that controls open valleys and watches migration routes.",
        searchIntents: ["lion eagle hybrid", "lion and eagle cross", "what animal is a gryphon based on", "lion eagle animal"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "tiger-octopus-hybrid",
        title: "Tiger + Octopus Hybrid",
        hybridName: "Inkstripe Stalker",
        parents: [
            {slug: "tiger", name: "Tiger", behavior: "solitary ambush, silent stalking, and explosive close-range attack"},
            {slug: "octopus", name: "Octopus", behavior: "camouflage, flexible problem-solving, and escape through tight spaces"}
        ],
        seoQuestion: "How might a tiger and octopus hybrid look?",
        quickAnswer: "A tiger and octopus hybrid would be a fictional stealth predator with striped skin that can shift color, flexible limb control, and a hunting style based on ambush, concealment, and escape.",
        appearance: "The Inkstripe Stalker would have a low tiger frame, eight flexible secondary limbs along the shoulders and ribs, color-shifting stripes, and soft pads that let it move silently over wet forest ground.",
        behaviorBlend: "It would wait like a tiger but adapt like an octopus, changing pattern against roots, rocks, or water reflections before striking from cover.",
        ultimateAbility: {
            name: "Vanishing Ambush",
            description: "The hybrid drops its visual signal, releases an ink-like distraction, and reappears at a new attack angle.",
            trigger: "Activated when prey looks directly at the place where the hybrid used to be."
        },
        viability: "This is a fictional cross. A mammal and cephalopod cannot produce a real hybrid.",
        habitatRole: "Mangrove and swamp-forest ambusher that turns cover, water, and terrain complexity into control.",
        searchIntents: ["tiger octopus hybrid", "tiger and octopus cross", "octopus tiger animal", "what would a tiger octopus look like"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "cheetah-wolf-hybrid",
        title: "Cheetah + Wolf Hybrid",
        hybridName: "Pack Sprint Cheetah",
        parents: [
            {slug: "cheetah", name: "Cheetah", behavior: "acceleration, visual tracking, and high-speed turning"},
            {slug: "wolf", name: "Wolf", behavior: "pack coordination, endurance travel, and role-based pressure"}
        ],
        seoQuestion: "How might a cheetah and wolf hybrid look?",
        quickAnswer: "A cheetah and wolf hybrid would be a fictional cursorial predator with a cheetah's sprint mechanics and a wolf's pack coordination.",
        appearance: "The Pack Sprint Cheetah would have long cheetah legs, a wolf-like chest and muzzle, spotted shoulders that fade into a gray saddle, and a heavy balancing tail for coordinated turns.",
        behaviorBlend: "It would not waste maximum speed alone. The pack would rotate pursuit roles until one hybrid uses cheetah acceleration to close the final gap.",
        ultimateAbility: {
            name: "Relay Rush",
            description: "A pack maneuver where endurance pressure funnels prey into a final cheetah-speed interception.",
            trigger: "Activated when prey begins to tire but still has one escape lane open."
        },
        viability: "This is speculative. Cheetahs and wolves are both mammals but too genetically distant for a real hybrid.",
        habitatRole: "Open-country pursuit specialist that combines sprint finish with group strategy.",
        searchIntents: ["cheetah wolf hybrid", "cheetah and wolf cross", "wolf cheetah animal", "fastest pack predator hybrid"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "elephant-octopus-hybrid",
        title: "Elephant + Octopus Hybrid",
        hybridName: "Memory Kraken",
        parents: [
            {slug: "elephant", name: "Elephant", behavior: "long memory, social care, trunk dexterity, and landscape influence"},
            {slug: "octopus", name: "Octopus", behavior: "problem-solving, camouflage, flexible arms, and den defense"}
        ],
        seoQuestion: "How might an elephant and octopus hybrid look?",
        quickAnswer: "An elephant and octopus hybrid would be an impossible real cross, but as a fictional creature it would combine trunk intelligence, many-arm dexterity, camouflage, and long-term memory.",
        appearance: "The Memory Kraken would resemble a small elephant with soft mottled skin, a trunk that branches into flexible tendrils, and broad feet shaped for mud, reefs, or river shallows.",
        behaviorBlend: "It would remember routes like an elephant and solve obstacles like an octopus, using touch, water, and camouflage to protect a social group.",
        ultimateAbility: {
            name: "Eightfold Recall",
            description: "The hybrid maps every escape route, tool, and threat in reach, then coordinates all limbs at once to reshape the battlefield.",
            trigger: "Activated when the group is trapped by terrain or predators."
        },
        viability: "This is a fictional mammal-cephalopod hybrid and cannot exist biologically.",
        habitatRole: "River-delta engineer that opens channels, shelters young, and manipulates objects with unusual precision.",
        searchIntents: ["elephant octopus hybrid", "elephant and octopus cross", "smartest animal hybrid", "octopus elephant animal"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "gorilla-rhinoceros-hybrid",
        title: "Gorilla + Rhino Hybrid",
        hybridName: "Knucklehorn Guardian",
        parents: [
            {slug: "gorilla", name: "Gorilla", behavior: "social authority, strength display, and protective group leadership"},
            {slug: "white-rhinoceros", name: "White Rhinoceros", behavior: "armored bulk, territorial space control, and explosive charges"}
        ],
        seoQuestion: "How might a gorilla and rhino hybrid look?",
        quickAnswer: "A gorilla and rhino hybrid would be a fictional armored primate with a horned brow, huge shoulders, knuckle-walking power, and defensive group behavior.",
        appearance: "The Knucklehorn Guardian would have gorilla arms and chest mass, rhino-like skin folds over the shoulders, a blunt nasal horn, and a silverback-style ridge along the upper spine.",
        behaviorBlend: "It would prefer intimidation over constant fighting, using gorilla display and rhino mass to make a boundary obvious before charging.",
        ultimateAbility: {
            name: "Wallbreak Display",
            description: "A chest-beat display rolls into a ground-shaking horn charge that breaks the opponent's confidence before contact.",
            trigger: "Activated when a rival ignores repeated warning signals."
        },
        viability: "This is fictional. Gorillas and rhinos are unrelated mammal lineages and cannot form a real hybrid.",
        habitatRole: "Forest-edge protector that defends family routes and crushes barriers through dense vegetation.",
        searchIntents: ["gorilla rhino hybrid", "gorilla and rhino cross", "rhino gorilla animal", "armored gorilla hybrid"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "crocodile-eagle-hybrid",
        title: "Crocodile + Eagle Hybrid",
        hybridName: "River Talon Croc",
        parents: [
            {slug: "crocodile", name: "Crocodile", behavior: "edge ambush, pressure sensing, and patient bottleneck control"},
            {slug: "eagle", name: "Eagle", behavior: "long-distance vision, soaring, and talon-based capture"}
        ],
        seoQuestion: "How might a crocodile and eagle hybrid look?",
        quickAnswer: "A crocodile and eagle hybrid would be a fictional wetland predator with armored scales, hooked beak features, wing-like forelimbs, and an ambush style that begins from above or below the waterline.",
        appearance: "The River Talon Croc would keep a crocodile tail and armored back, but its forelimbs would carry broad feathered vanes and curved talons for gripping banks, logs, and prey.",
        behaviorBlend: "It would watch river crossings from high snags, then drop into water or surge from below depending on which angle traps prey best.",
        ultimateAbility: {
            name: "Sky-to-Swamp Clamp",
            description: "A two-stage strike that starts with eagle vision and ends with crocodile jaw pressure at the water's edge.",
            trigger: "Activated when prey enters a narrow river crossing."
        },
        viability: "This is fictional. Reptiles and birds share ancient ancestry, but a living crocodile and eagle cannot produce a real hybrid.",
        habitatRole: "Wetland chokepoint predator that controls banks, channels, and exposed branches.",
        searchIntents: ["crocodile eagle hybrid", "crocodile and eagle cross", "eagle crocodile animal", "flying crocodile hybrid"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "shark-tiger-hybrid",
        title: "Shark + Tiger Hybrid",
        hybridName: "Reefstripe Hunter",
        parents: [
            {slug: "great-white-shark", name: "Great White Shark", behavior: "sensory hunting, burst attacks, and ocean patrol"},
            {slug: "tiger", name: "Tiger", behavior: "striped stealth, solitary ambush, and close-range power"}
        ],
        seoQuestion: "How might a shark and tiger hybrid look?",
        quickAnswer: "A shark and tiger hybrid would be an impossible real cross, but a fictional version would combine a shark's torpedo body with tiger striping, stealth, and ambush timing.",
        appearance: "The Reefstripe Hunter would have a shark-like body with dark vertical stripes, stronger pectoral fins shaped like forelimbs, and a broad head marked by tiger-like facial patterning.",
        behaviorBlend: "It would patrol like a shark but use cover like a tiger, waiting near reef shadows or murky channels before accelerating upward.",
        ultimateAbility: {
            name: "Apex Breach",
            description: "A hidden approach turns into a vertical burst that hits with shark speed and tiger timing.",
            trigger: "Activated when prey crosses from cover into open water."
        },
        viability: "This is a fictional fish-mammal hybrid and cannot exist biologically.",
        habitatRole: "Reef-edge ambusher that controls the boundary between open water and cover.",
        searchIntents: ["shark tiger hybrid", "tiger and shark cross", "shark tiger animal", "what would a shark tiger look like"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "owl-wolf-hybrid",
        title: "Owl + Wolf Hybrid",
        hybridName: "Moonpack Owlwolf",
        parents: [
            {slug: "barn-owl", name: "Barn Owl", behavior: "silent flight, night hearing, and precision strikes"},
            {slug: "wolf", name: "Wolf", behavior: "pack communication, endurance movement, and territory mapping"}
        ],
        seoQuestion: "How might an owl and wolf hybrid look?",
        quickAnswer: "An owl and wolf hybrid would be a fictional nocturnal hunter with a wolf body, owl facial disk, feathered shoulders, silent movement, and pack-level night coordination.",
        appearance: "The Moonpack Owlwolf would have a lean wolf frame, pale owl-like face, feathered ruff, large forward-facing eyes, and soft foot pads edged with silent feathering.",
        behaviorBlend: "It would coordinate by low calls and body posture, using owl hearing to locate hidden prey while the pack controls the ground.",
        ultimateAbility: {
            name: "Silent Howl",
            description: "A sound-mapping call lets the pack triangulate prey without revealing exact positions.",
            trigger: "Activated in darkness, fog, or thick forest."
        },
        viability: "This is fictional. Birds and mammals cannot form real hybrids.",
        habitatRole: "Nocturnal forest patrol animal that reads sound, scent, and movement as one map.",
        searchIntents: ["owl wolf hybrid", "wolf and owl cross", "owlwolf animal", "night predator hybrid"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "mantis-shrimp-rhino-hybrid",
        title: "Mantis Shrimp + Rhino Hybrid",
        hybridName: "Hammerhorn Rhino",
        parents: [
            {slug: "mantis-shrimp", name: "Mantis Shrimp", behavior: "spring-loaded strikes, complex vision, and burrow defense"},
            {slug: "white-rhinoceros", name: "White Rhinoceros", behavior: "armored bulk, grazing pressure, and territorial charges"}
        ],
        seoQuestion: "How might a mantis shrimp and rhino hybrid look?",
        quickAnswer: "A mantis shrimp and rhino hybrid would be an impossible real cross, but fictionally it would combine armored rhino bulk with spring-loaded striking limbs and extreme visual targeting.",
        appearance: "The Hammerhorn Rhino would have a rhino-like body wrapped in segmented color plates, a forward horn, and folded club-limbs near the shoulders that snap out like mantis shrimp hammers.",
        behaviorBlend: "It would stand its ground like a rhino, but instead of charging first it would measure distance with sharp vision and release one precise impact.",
        ultimateAbility: {
            name: "Cavitation Hornbreak",
            description: "A spring-loaded blow lands with enough force to stun the target and clear space around the hybrid.",
            trigger: "Activated when a rival gets inside horn range."
        },
        viability: "This is fictional. A crustacean and mammal cannot form a real hybrid.",
        habitatRole: "Armored reef-flat defender that protects burrow entrances and shallow water channels.",
        searchIntents: ["mantis shrimp rhino hybrid", "rhino mantis shrimp cross", "strongest animal hybrid", "punching rhino hybrid"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "zebra-cheetah-hybrid",
        title: "Zebra + Cheetah Hybrid",
        hybridName: "Dashstripe Runner",
        parents: [
            {slug: "plains-zebra", name: "Plains Zebra", behavior: "herd alertness, evasive zigzags, and visual confusion"},
            {slug: "cheetah", name: "Cheetah", behavior: "rapid acceleration, visual lock-on, and high-speed turns"}
        ],
        seoQuestion: "How might a zebra and cheetah hybrid look?",
        quickAnswer: "A zebra and cheetah hybrid would be fictional, but it would likely look like a long-legged striped runner with cheetah-like flexibility and zebra-like herd awareness.",
        appearance: "The Dashstripe Runner would have a slim equid body, catlike shoulder flexibility, tear marks below the eyes, and broken stripes that stretch into spots along the legs.",
        behaviorBlend: "It would move with herd awareness but hunt or escape with cheetah-like acceleration, using stripes to make its speed harder to judge.",
        ultimateAbility: {
            name: "Mirage Sprint",
            description: "A high-speed zigzag where stripes blur the body outline and hide the final turn.",
            trigger: "Activated when chased across bright open grassland."
        },
        viability: "This is fictional. Zebras and cheetahs are too distantly related for a real hybrid.",
        habitatRole: "Open-plain scout that outruns danger and warns herd animals early.",
        searchIntents: ["zebra cheetah hybrid", "zebra and cheetah cross", "fast zebra hybrid", "cheetah zebra animal"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "elephant-eagle-hybrid",
        title: "Elephant + Eagle Hybrid",
        hybridName: "Thunderwing Elephant",
        parents: [
            {slug: "elephant", name: "Elephant", behavior: "memory, route knowledge, social care, and landscape engineering"},
            {slug: "eagle", name: "Eagle", behavior: "high vision, soaring, and precise talon control"}
        ],
        seoQuestion: "How might an elephant and eagle hybrid look?",
        quickAnswer: "An elephant and eagle hybrid would be impossible biologically, but as a fantasy animal it would be a huge memory-led guardian with wing-like ears, taloned feet, and sky-level awareness.",
        appearance: "The Thunderwing Elephant would have an elephant body, enormous feather-edged ears, a shorter trunk with hooked tip, and broad talon-like nails for gripping rocky ground.",
        behaviorBlend: "It would remember ground routes while watching from ridges, protecting herds by detecting danger before it reaches water or migration corridors.",
        ultimateAbility: {
            name: "Storm Memory",
            description: "The hybrid predicts a threat's route from past landscape memory and redirects the herd before danger arrives.",
            trigger: "Activated when distant movement appears along a known migration line."
        },
        viability: "This is fictional. Mammals and birds cannot produce real hybrids.",
        habitatRole: "Migration guardian that combines ground memory with aerial awareness.",
        searchIntents: ["elephant eagle hybrid", "elephant and eagle cross", "flying elephant animal", "eagle elephant hybrid"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "crocodile-hippo-hybrid",
        title: "Crocodile + Hippo Hybrid",
        hybridName: "Riverwall Hippo",
        parents: [
            {slug: "crocodile", name: "Crocodile", behavior: "ambush stillness, armored patience, and water-edge control"},
            {slug: "hippopotamus", name: "Hippopotamus", behavior: "river territory, huge body mass, and aggressive water defense"}
        ],
        seoQuestion: "How might a crocodile and hippo hybrid look?",
        quickAnswer: "A crocodile and hippo hybrid would be fictional, but it would look like a massive semi-aquatic defender with a hippo body, crocodile armor, and extreme control of river crossings.",
        appearance: "The Riverwall Hippo would have a hippo's barrel body and high nostrils, crocodile-like tail and dorsal armor, and a wide mouth lined with both tusk-like canines and conical teeth.",
        behaviorBlend: "It would spend long hours in water, blocking narrow channels with sheer size and using ambush patience when rivals mistake stillness for calm.",
        ultimateAbility: {
            name: "Channel Lock",
            description: "The hybrid turns a river crossing into a controlled gate, using bulk, bite threat, and tail force to deny passage.",
            trigger: "Activated when multiple animals converge at one water bottleneck."
        },
        viability: "This is fictional. Crocodiles are reptiles and hippos are mammals, so a real cross is impossible.",
        habitatRole: "River chokepoint controller that shapes where animals can drink, cross, or retreat.",
        searchIntents: ["crocodile hippo hybrid", "hippo and crocodile cross", "river monster animal hybrid", "hippo crocodile animal"],
        updatedAt: "2026-06-16"
    },
    {
        slug: "komodo-dragon-cobra-hybrid",
        title: "Komodo Dragon + Cobra Hybrid",
        hybridName: "Hooded Komodo",
        parents: [
            {slug: "komodo-dragon", name: "Komodo Dragon", behavior: "patient tracking, heavy reptile strength, and opportunistic predation"},
            {slug: "king-cobra", name: "King Cobra", behavior: "venom threat, raised warning display, and snake-specialist hunting"}
        ],
        seoQuestion: "How might a Komodo dragon and cobra hybrid look?",
        quickAnswer: "A Komodo dragon and cobra hybrid would be fictional, but it would combine a monitor lizard body with a cobra hood, warning display, and venom-backed bite threat.",
        appearance: "The Hooded Komodo would have a long monitor body, muscular tail, loose neck skin that flares into a hood, and dark banding that sharpens during threat displays.",
        behaviorBlend: "It would track patiently like a Komodo dragon but avoid unnecessary wrestling by raising its hood and forcing rivals to read the warning first.",
        ultimateAbility: {
            name: "Sovereign Warning",
            description: "A hood flare, low hiss, and forward rush create a choice: retreat immediately or face a bite designed to end the contest.",
            trigger: "Activated when a rival enters feeding range."
        },
        viability: "This is fictional. Even though both are reptiles, monitor lizards and cobras are too distant for a real hybrid.",
        habitatRole: "Dry island ambusher that controls carcasses, burrows, and sun-baked trails.",
        searchIntents: ["komodo dragon cobra hybrid", "cobra and komodo dragon cross", "venom lizard hybrid", "hooded komodo animal"],
        updatedAt: "2026-06-16"
    }
];

type HybridParentTemplate = AnimalHybridParent & {
    shortName: string;
    bodyCue: string;
    movementCue: string;
    habitatCue: string;
    powerCue: string;
    roleCue: string;
};

const generatedParentPool: HybridParentTemplate[] = [
    {slug: "plains-zebra", name: "Plains Zebra", shortName: "Zebra", behavior: "herd vigilance, evasive running, and visual confusion", bodyCue: "striped equid legs", movementCue: "zigzag herd sprinting", habitatCue: "open grassland", powerCue: "stripe-break evasion", roleCue: "herd-edge scout"},
    {slug: "white-rhinoceros", name: "White Rhinoceros", shortName: "Rhino", behavior: "armored grazing, territorial pressure, and short explosive charges", bodyCue: "horned armor and heavy shoulders", movementCue: "short bulldozing charges", habitatCue: "savannah grazing lanes", powerCue: "front-line impact", roleCue: "armored boundary holder"},
    {slug: "lion", name: "Lion", shortName: "Lion", behavior: "social pressure, pride defense, and close-range power", bodyCue: "mane-framed cat muscle", movementCue: "coordinated pouncing", habitatCue: "open woodland and grassland", powerCue: "pride-force pinning", roleCue: "territory commander"},
    {slug: "tiger", name: "Tiger", shortName: "Tiger", behavior: "solitary stealth, striped concealment, and ambush power", bodyCue: "striped big-cat shoulders", movementCue: "silent stalking bursts", habitatCue: "forest edge cover", powerCue: "hidden-angle strike", roleCue: "solitary ambusher"},
    {slug: "cheetah", name: "Cheetah", shortName: "Cheetah", behavior: "acceleration, visual tracking, and high-speed turning", bodyCue: "light sprinting frame", movementCue: "explosive open-ground acceleration", habitatCue: "short-grass plains", powerCue: "speed-lock interception", roleCue: "pursuit finisher"},
    {slug: "wolf", name: "Wolf", shortName: "Wolf", behavior: "pack coordination, endurance travel, and territory mapping", bodyCue: "long-legged canid frame", movementCue: "relay pursuit and pacing", habitatCue: "forest and tundra routes", powerCue: "pack-pressure coordination", roleCue: "route strategist"},
    {slug: "elephant", name: "Elephant", shortName: "Elephant", behavior: "memory, trunk dexterity, social care, and landscape influence", bodyCue: "massive trunk-led body", movementCue: "deliberate route-making", habitatCue: "migration corridors", powerCue: "memory-led terrain control", roleCue: "landscape engineer"},
    {slug: "gorilla", name: "Gorilla", shortName: "Gorilla", behavior: "protective authority, display strength, and group leadership", bodyCue: "huge arms and chest", movementCue: "knuckle-walking pressure", habitatCue: "forest clearings", powerCue: "warning display force", roleCue: "group guardian"},
    {slug: "crocodile", name: "Crocodile", shortName: "Crocodile", behavior: "water-edge ambush, armored patience, and bite pressure", bodyCue: "scaled back and heavy jaws", movementCue: "still-water surge", habitatCue: "river crossings", powerCue: "jaw-pressure clamp", roleCue: "bottleneck predator"},
    {slug: "eagle", name: "Eagle", shortName: "Eagle", behavior: "long-range vision, soaring, and talon capture", bodyCue: "hooked beak and broad wings", movementCue: "thermal-riding dives", habitatCue: "cliffs and open sky", powerCue: "high-angle talon strike", roleCue: "aerial scout"},
    {slug: "barn-owl", name: "Barn Owl", shortName: "Owl", behavior: "silent flight, night hearing, and precision strikes", bodyCue: "pale facial disk and soft feathers", movementCue: "silent low flight", habitatCue: "night fields and barns", powerCue: "sound-map targeting", roleCue: "nocturnal sensor"},
    {slug: "great-white-shark", name: "Great White Shark", shortName: "Shark", behavior: "sensory hunting, burst attacks, and ocean patrol", bodyCue: "torpedo body and cutting fins", movementCue: "vertical burst attacks", habitatCue: "coastal open water", powerCue: "apex breach force", roleCue: "marine patrol hunter"},
    {slug: "octopus", name: "Octopus", shortName: "Octopus", behavior: "camouflage, flexible problem-solving, and den escape", bodyCue: "soft flexible arms", movementCue: "shape-shifting crawl and jet escape", habitatCue: "reef dens and tide pools", powerCue: "camouflage problem-solving", roleCue: "adaptive escape artist"},
    {slug: "mantis-shrimp", name: "Mantis Shrimp", shortName: "Mantis Shrimp", behavior: "spring-loaded strikes, complex vision, and burrow defense", bodyCue: "segmented armor and striking clubs", movementCue: "snap-strike lunges", habitatCue: "reef burrows", powerCue: "spring-hammer impact", roleCue: "precision defender"},
    {slug: "king-cobra", name: "King Cobra", shortName: "Cobra", behavior: "venom threat, raised warning display, and snake hunting", bodyCue: "raised hood and long serpent body", movementCue: "controlled slithering threat", habitatCue: "forest floor and brush", powerCue: "venom-backed warning", roleCue: "danger signaler"},
    {slug: "komodo-dragon", name: "Komodo Dragon", shortName: "Komodo", behavior: "patient tracking, heavy reptile strength, and opportunistic predation", bodyCue: "monitor-lizard bulk and heavy claws", movementCue: "patient ground tracking", habitatCue: "dry island trails", powerCue: "tracking pressure bite", roleCue: "island apex scavenger"},
    {slug: "hippopotamus", name: "Hippopotamus", shortName: "Hippo", behavior: "river territory, huge body mass, and aggressive water defense", bodyCue: "barrel body and wide mouth", movementCue: "waterline lunges", habitatCue: "river channels", powerCue: "channel-blocking mass", roleCue: "river gatekeeper"},
    {slug: "giraffe", name: "Giraffe", shortName: "Giraffe", behavior: "height advantage, broad visibility, and powerful defensive kicks", bodyCue: "towering neck and long legs", movementCue: "high-stepping long strides", habitatCue: "acacia savannah", powerCue: "vertical lookout reach", roleCue: "canopy watcher"},
    {slug: "polar-bear", name: "Polar Bear", shortName: "Polar Bear", behavior: "ice-platform hunting, endurance swimming, and cold survival", bodyCue: "white heavy bear frame", movementCue: "slow ice stalking", habitatCue: "sea-ice edges", powerCue: "cold-endurance grappling", roleCue: "ice-edge hunter"},
    {slug: "red-kangaroo", name: "Red Kangaroo", shortName: "Kangaroo", behavior: "spring-loaded hopping, tail balance, and open-country stamina", bodyCue: "huge hind legs and balancing tail", movementCue: "bounding leaps", habitatCue: "dry open country", powerCue: "tail-braced kicking", roleCue: "desert distance mover"},
    {slug: "capybara", name: "Capybara", shortName: "Capybara", behavior: "calm group living, water refuge, and social tolerance", bodyCue: "rounded semi-aquatic body", movementCue: "quiet bank-to-water movement", habitatCue: "river margins", powerCue: "social calm field", roleCue: "peaceful water-edge anchor"},
    {slug: "dolphin", name: "Dolphin", shortName: "Dolphin", behavior: "echolocation, social learning, and coordinated movement", bodyCue: "sleek marine body and beaked face", movementCue: "arc-swimming bursts", habitatCue: "coastal and open sea", powerCue: "echo-guided teamwork", roleCue: "social sonar navigator"},
    {slug: "manta-ray", name: "Manta Ray", shortName: "Manta", behavior: "wide-wing gliding, filter feeding, and graceful turns", bodyCue: "broad ray wings", movementCue: "slow underwater flight", habitatCue: "blue-water cleaning stations", powerCue: "wide-field glide control", roleCue: "gentle ocean filter"},
    {slug: "scarlet-macaw", name: "Scarlet Macaw", shortName: "Macaw", behavior: "loud communication, bright display, and seed dispersal", bodyCue: "red-blue-yellow flight feathers", movementCue: "canopy flight bursts", habitatCue: "rainforest canopy", powerCue: "signal-color coordination", roleCue: "canopy messenger"},
    {slug: "axolotl", name: "Axolotl", shortName: "Axolotl", behavior: "regeneration, aquatic stillness, and gilled sensing", bodyCue: "feathery gills and soft amphibian body", movementCue: "gentle underwater walking", habitatCue: "cool freshwater channels", powerCue: "regenerative recovery", roleCue: "aquatic renewal specialist"},
    {slug: "chameleon", name: "Chameleon", shortName: "Chameleon", behavior: "color change, patient scanning, and precision tongue strikes", bodyCue: "turret eyes and curled tail", movementCue: "slow branch stalking", habitatCue: "layered branches", powerCue: "color-shift targeting", roleCue: "arboreal watcher"},
    {slug: "sunda-pangolin", name: "Sunda Pangolin", shortName: "Pangolin", behavior: "armored curling, termite feeding, and quiet digging", bodyCue: "overlapping scale armor", movementCue: "low nocturnal shuffle", habitatCue: "forest floor termite routes", powerCue: "full-body armor curl", roleCue: "ant-and-termite specialist"},
    {slug: "honey-bee", name: "Honey Bee", shortName: "Honey Bee", behavior: "hive coordination, flower routing, and pollination", bodyCue: "striped fuzzy insect body", movementCue: "flower-to-hive commuting", habitatCue: "flower fields and hives", powerCue: "swarm-route coordination", roleCue: "pollination networker"},
    {slug: "firefly", name: "Firefly", shortName: "Firefly", behavior: "bioluminescent signaling and dusk communication", bodyCue: "small lantern abdomen", movementCue: "floating dusk flight", habitatCue: "humid night grass", powerCue: "light-code signaling", roleCue: "night signaler"},
    {slug: "rhinoceros-beetle", name: "Rhinoceros Beetle", shortName: "Rhinoceros Beetle", behavior: "horn lifting, armor, and compact strength", bodyCue: "shiny shell and lifting horn", movementCue: "heavy climbing and pushing", habitatCue: "tropical forest wood", powerCue: "miniature leverage force", roleCue: "armored lifter"},
    {slug: "praying-mantis", name: "Praying Mantis", shortName: "Mantis", behavior: "ambush patience, rotating vision, and raptorial grabs", bodyCue: "folded grasping forelegs", movementCue: "stillness-to-snap strikes", habitatCue: "garden and shrub cover", powerCue: "instant grab timing", roleCue: "ambush blade"},
    {slug: "red-fox", name: "Red Fox", shortName: "Fox", behavior: "adaptable hunting, edge walking, and quick problem-solving", bodyCue: "orange coat and sharp ears", movementCue: "light-footed pouncing", habitatCue: "woodland and urban edges", powerCue: "adaptive trick movement", roleCue: "edge opportunist"},
    {slug: "snow-leopard", name: "Snow Leopard", shortName: "Snow Leopard", behavior: "mountain stealth, cliff balance, and cold ambush", bodyCue: "pale spotted coat and long tail", movementCue: "cliff-side leaping", habitatCue: "snowy mountain ledges", powerCue: "ghost-step ambush", roleCue: "alpine stalker"},
    {slug: "orangutan", name: "Orangutan", shortName: "Orangutan", behavior: "slow problem-solving, canopy memory, and tool use", bodyCue: "long arms and reddish fur", movementCue: "deliberate branch travel", habitatCue: "rainforest canopy", powerCue: "patient tool intelligence", roleCue: "canopy planner"},
    {slug: "harpy-eagle", name: "Harpy Eagle", shortName: "Harpy Eagle", behavior: "canopy ambush, huge talon grip, and short-wing forest control", bodyCue: "massive talons and crown feathers", movementCue: "forest-gap strikes", habitatCue: "tropical canopy", powerCue: "canopy-crushing grip", roleCue: "jungle raptor"},
    {slug: "black-rhinoceros", name: "Black Rhinoceros", shortName: "Black Rhino", behavior: "thorn browsing, hooked-lip feeding, and alert solitary defense", bodyCue: "hooked lip and twin horns", movementCue: "brush-breaking charges", habitatCue: "thorn scrub", powerCue: "browsing-tank pressure", roleCue: "thornland bulldozer"}
];

function slugifyHybridPart(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function makeHybridSlug(first: HybridParentTemplate, second: HybridParentTemplate) {
    return `${slugifyHybridPart(first.shortName)}-${slugifyHybridPart(second.shortName)}-hybrid`;
}

function makeHybridName(first: HybridParentTemplate, second: HybridParentTemplate, index: number) {
    const prefixes = ["Storm", "Shadow", "Iron", "Dawn", "Echo", "Frost", "Solar", "River", "Canopy", "Ember"];
    const firstPart = first.shortName.split(" ")[0];
    const secondPart = second.shortName.split(" ").slice(-1)[0];
    return `${prefixes[index % prefixes.length]} ${firstPart}${secondPart}`;
}

function titleCaseAbilityPart(value: string) {
    return value
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getViability(first: HybridParentTemplate, second: HybridParentTemplate) {
    return `This is a fictional AnimalDex hybrid. A real ${first.name} and ${second.name} cross is not treated as biologically viable here; the page is a speculative design exercise, not a breeding claim.`;
}

function makeGeneratedHybrid(first: HybridParentTemplate, second: HybridParentTemplate, index: number): AnimalHybridEntry {
    const hybridName = makeHybridName(first, second, index);
    const title = `${first.shortName} + ${second.shortName} Hybrid`;
    const lowerFirst = first.shortName.toLowerCase();
    const lowerSecond = second.shortName.toLowerCase();

    return {
        slug: makeHybridSlug(first, second),
        title,
        hybridName,
        parents: [
            {slug: first.slug, name: first.name, behavior: first.behavior},
            {slug: second.slug, name: second.name, behavior: second.behavior}
        ],
        seoQuestion: `How might a ${lowerFirst} and ${lowerSecond} hybrid look?`,
        quickAnswer: `A ${lowerFirst} and ${lowerSecond} hybrid would be fictional, but it would likely combine ${first.bodyCue} with ${second.bodyCue}, then blend ${first.behavior} with ${second.behavior}.`,
        appearance: `The ${hybridName} would show ${first.bodyCue} alongside ${second.bodyCue}. Its silhouette would borrow from both parents, with visible cues that make the ${lowerFirst} influence readable at first glance and the ${lowerSecond} influence obvious in the head, limbs, armor, wings, fins, or posture.`,
        behaviorBlend: `Behaviorally, it would combine ${first.behavior} with ${second.behavior}. In motion, it would shift between ${first.movementCue} and ${second.movementCue}, making it suited to ${first.habitatCue} as well as ${second.habitatCue}.`,
        ultimateAbility: {
            name: `${titleCaseAbilityPart(first.powerCue.split(" ")[0])} ${titleCaseAbilityPart(second.powerCue.split(" ")[0])} Surge`,
            description: `A hybrid ability that fuses ${first.powerCue} with ${second.powerCue}, letting the ${hybridName} control space through both parent strategies at once.`,
            trigger: `Activated when a threat enters the overlap between ${first.habitatCue} and ${second.habitatCue}.`
        },
        viability: getViability(first, second),
        habitatRole: `A speculative ${first.roleCue} and ${second.roleCue} that would operate where ${first.habitatCue} meets ${second.habitatCue}.`,
        searchIntents: [
            `${lowerFirst} ${lowerSecond} hybrid`,
            `${lowerFirst} and ${lowerSecond} cross`,
            `${lowerSecond} ${lowerFirst} hybrid`,
            `what would a ${lowerFirst} ${lowerSecond} look like`
        ],
        updatedAt: "2026-06-16"
    };
}

function buildGeneratedHybrids(limit: number) {
    const curatedSlugs = new Set(curatedAnimalHybridEntries.map((entry) => entry.slug));
    const generated: AnimalHybridEntry[] = [];

    for (let firstIndex = 0; firstIndex < generatedParentPool.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < generatedParentPool.length; secondIndex += 1) {
            const candidate = makeGeneratedHybrid(generatedParentPool[firstIndex], generatedParentPool[secondIndex], generated.length);

            if (curatedSlugs.has(candidate.slug)) {
                continue;
            }

            generated.push(candidate);

            if (generated.length === limit) {
                return generated;
            }
        }
    }

    return generated;
}

export const generatedAnimalHybridEntries: AnimalHybridEntry[] = buildGeneratedHybrids(500);
export const animalHybridEntries: AnimalHybridEntry[] = [...curatedAnimalHybridEntries, ...generatedAnimalHybridEntries];

export const animalHybridEntriesBySlug = new Map(animalHybridEntries.map((entry) => [entry.slug, entry]));

export function getAnimalHybrid(slug: string) {
    return animalHybridEntriesBySlug.get(slug) ?? null;
}

export function getRelatedAnimalHybrids(slug: string, limit = 4) {
    const current = getAnimalHybrid(slug);

    if (!current) {
        return [];
    }

    const parentSlugs = new Set(current.parents.map((parent) => parent.slug));

    return animalHybridEntries
        .filter((entry) => entry.slug !== slug && entry.parents.some((parent) => parentSlugs.has(parent.slug)))
        .slice(0, limit);
}
