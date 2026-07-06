import type {SpeciesEntry} from "@/data/species";

export type LegendaryEarthBeastCatalogSeed = {
    beastSlug: string;
    animaldexNumber: number;
    normalizedIdentityKey: string;
    biologyIdentityKey: string;
    biologyLandingSlug: string;
    biologyDisplayName: string;
    displayName: string;
    scientificName: string;
    captureSite: string;
    canonicalGameStats: {
        dominance: number;
        speed: number;
        size: number;
        intelligence: number;
        rarity: number;
    };
    sizeScaleScore: number;
    principleName: string;
    principleExpression: string;
    coreLesson: string;
    biologicalBasis: string;
    shortMotto: string;
    bestUseCases: string[];
    subtitleDescriptor: string;
    subtitleStory: string;
    speciesSpotlight: string;
    signatureTraits: string[];
    interestingFacts: string[];
    dietSummary: string;
    predatorsSummary: string;
    sleepPattern: string;
    lifespanEstimate: string;
    femaleOffspringNotes: string;
    sexDifferenceNotes: string;
    fieldGuideVersion: string;
    legendaryTier: string;
    legendarySource: string;
    legendaryNotes?: string;
    respectNote?: string;
};

function seed(input: LegendaryEarthBeastCatalogSeed): LegendaryEarthBeastCatalogSeed {
    return input;
}

export const legendaryEarthBeastCatalogSeeds: LegendaryEarthBeastCatalogSeed[] = [
    seed({
        beastSlug: "sinai-dragon",
        animaldexNumber: 1800,
        normalizedIdentityKey: "sinai_dragon",
        biologyIdentityKey: "egyptian_spiny_tailed_lizard",
        biologyLandingSlug: "egyptian-spiny-tailed-lizard",
        biologyDisplayName: "Egyptian Spiny-tailed Lizard",
        displayName: "Sinai Dragon",
        scientificName: "Uromastyx aegyptia",
        captureSite: "Dragon Head Mountain / Dragon Eye Rock, South Sinai, Egypt",
        canonicalGameStats: {dominance: 82, speed: 42, size: 50, intelligence: 48, rarity: 96},
        sizeScaleScore: 54,
        principleName: "Heat Stillness",
        principleExpression: "Use stillness as a shield before spending energy.",
        coreLesson: "In hostile conditions, survival starts by conserving strength instead of proving it.",
        biologicalBasis: "Egyptian spiny-tailed lizards use burrows, tough bodies, and desert timing to manage extreme heat and exposure.",
        shortMotto: "Burn less. Last longer.",
        bestUseCases: ["Resilience", "Self-Regulation", "Long-Term Endurance"],
        subtitleDescriptor: "The Desert Ember Dragon",
        subtitleStory: "This desert lizard endures heat, stone, and open ground with a body built for dry survival. It shows that power can come from holding still until the harshest moment passes.",
        speciesSpotlight: "Sinai Dragon teaches Heat Stillness through desert endurance, burrow safety, armored scales, and careful energy use. Its legendary form turns a wind-carved dragon-head mountain into a living lesson in surviving heat without wasting motion.",
        signatureTraits: [
            "Biological Superpower: desert heat endurance",
            "Spiny tail used in defense",
            "Burrow-based survival in dry terrain",
            "Heavy-bodied lizard with dragon-like posture"
        ],
        interestingFacts: [
            "It is one of the largest spiny-tailed lizards.",
            "It relies heavily on burrows to avoid extreme surface temperatures.",
            "Its rugged scales make it visually ideal for dragon-inspired artwork."
        ],
        dietSummary: "Mostly herbivorous, feeding on desert plants, seeds, and vegetation when available.",
        predatorsSummary: "Threats include raptors, carnivorous mammals, snakes, and humans; its spiny tail and burrow help reduce risk.",
        sleepPattern: "Primarily diurnal, active when temperatures allow and retreating during harsher heat.",
        lifespanEstimate: "Large spiny-tailed lizards can live for many years, especially when protected from hunting and habitat pressure.",
        femaleOffspringNotes: "Females lay eggs in protected burrow sites where warmth supports development.",
        sexDifferenceNotes: "Males are often larger and more robust, though appearance varies by age and region.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for Dragon Head Mountain / Sinai Dragon capture art: sandstone scales, glowing cave-eye, desert dragon silhouette."
    }),
    seed({
        beastSlug: "naga-snake",
        animaldexNumber: 1801,
        normalizedIdentityKey: "naga_snake",
        biologyIdentityKey: "king_cobra",
        biologyLandingSlug: "king-cobra",
        biologyDisplayName: "King Cobra",
        displayName: "Naga Snake",
        scientificName: "Ophiophagus hannah",
        captureSite: "Naka Cave, Phu Langka National Park, Bueng Kan, Thailand",
        canonicalGameStats: {dominance: 95, speed: 62, size: 72, intelligence: 66, rarity: 96},
        sizeScaleScore: 72,
        principleName: "Crowned Warning",
        principleExpression: "Signal clearly before conflict becomes force.",
        coreLesson: "The strongest boundary is the one others understand before they cross it.",
        biologicalBasis: "King cobras can rear high, spread a hood, hiss deeply, hunt other snakes, and guard nests.",
        shortMotto: "Warn first. Rule second.",
        bestUseCases: ["Boundaries", "Presence", "Protective Strength"],
        subtitleDescriptor: "The Serpent Crown Guardian",
        subtitleStory: "The King Cobra rises with controlled warning, not wasted attack. It shows that true authority gives a signal before it strikes.",
        speciesSpotlight: "Naga Snake teaches Crowned Warning through height, hood display, nest defense, and snake-hunting specialization. Its form is ideal for serpent-scale cave formations where local myth turns stone texture into sacred presence.",
        signatureTraits: [
            "Biological Superpower: snake-hunting specialization",
            "Tall defensive hood display",
            "Rare nest-building behavior among snakes",
            "Long venomous body with regal posture"
        ],
        interestingFacts: [
            "Its genus name means snake-eater.",
            "Females build and guard nests for their eggs.",
            "It is the world's longest venomous snake."
        ],
        dietSummary: "Specializes in eating other snakes, including venomous species, while also taking lizards when available.",
        predatorsSummary: "Adults have few natural predators, but eggs and young may be taken by monitor lizards, mongooses, and birds of prey.",
        sleepPattern: "Mostly diurnal, moving and hunting during daylight or warm active periods.",
        lifespanEstimate: "Wild lifespan is often estimated around two decades, with longer survival possible under protection.",
        femaleOffspringNotes: "Females gather vegetation into a nest mound and guard eggs with unusual intensity for a snake.",
        sexDifferenceNotes: "Males are generally larger than females and may compete during breeding season.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "mythic_legendary",
        legendaryNotes: "Best flagship match for Naka Cave / Naga serpent rock. Generate as crowned cobra/Naga with scale-stone motifs."
    }),
    seed({
        beastSlug: "jeju-dragon-head",
        animaldexNumber: 1802,
        normalizedIdentityKey: "jeju_dragon_head",
        biologyIdentityKey: "korean_rat_snake",
        biologyLandingSlug: "korean-rat-snake",
        biologyDisplayName: "Korean Rat Snake",
        displayName: "Jeju Dragon Head",
        scientificName: "Elaphe anomala",
        captureSite: "Yongduam Rock, Jeju Island, South Korea",
        canonicalGameStats: {dominance: 72, speed: 70, size: 45, intelligence: 62, rarity: 95},
        sizeScaleScore: 48,
        principleName: "Route Flex",
        principleExpression: "Find the path that bends without breaking.",
        coreLesson: "When the terrain is uneven, flexibility becomes a kind of intelligence.",
        biologicalBasis: "Korean rat snakes are non-venomous constrictors that move through grassland, scrub, rocky areas, and waterside habitats.",
        shortMotto: "Bend into the route.",
        bestUseCases: ["Adaptability", "Agility", "Sharp Observation"],
        subtitleDescriptor: "The Wave-Carved Serpent",
        subtitleStory: "The Korean Rat Snake climbs and threads through mixed terrain with quiet control. It shows that flexible movement can turn rough edges into routes.",
        speciesSpotlight: "Jeju Dragon Head teaches Route Flex through climbing, constriction, habitat variety, and quiet movement. Its form connects a real Korean serpent to Yongduam's dragon-shaped volcanic coast.",
        signatureTraits: [
            "Biological Superpower: terrain flexibility",
            "Non-venomous constrictor strategy",
            "Semi-arboreal movement",
            "Serpentine body suited to dragon imagery"
        ],
        interestingFacts: [
            "It is known from Korea and parts of China.",
            "It can use rocky, scrubby, and waterside habitats.",
            "Its long body makes it a strong real-species anchor for Korean dragon forms."
        ],
        dietSummary: "Feeds on small mammals, birds, eggs, and other small vertebrates using constriction.",
        predatorsSummary: "Threats include birds of prey, carnivorous mammals, larger snakes, and human persecution.",
        sleepPattern: "Mostly diurnal to crepuscular depending on weather and temperature.",
        lifespanEstimate: "Large rat snakes can live for many years in the wild when habitat and prey remain stable.",
        femaleOffspringNotes: "Females lay eggs in protected warm sites where the young hatch independently.",
        sexDifferenceNotes: "Sex differences are subtle, though mature males may be longer-tailed and more active in breeding periods.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "mythic_legendary",
        legendaryNotes: "Use for Yongduam Dragon Head Rock scans; generate as a black volcanic sea-serpent with wave-carved contours."
    }),
    seed({
        beastSlug: "stone-dragon",
        animaldexNumber: 1803,
        normalizedIdentityKey: "stone_dragon",
        biologyIdentityKey: "komodo_dragon",
        biologyLandingSlug: "komodo-dragon",
        biologyDisplayName: "Komodo Dragon",
        displayName: "Stone Dragon",
        scientificName: "Varanus komodoensis",
        captureSite: "Dragon-like desert, canyon, or volcanic rock formations",
        canonicalGameStats: {dominance: 98, speed: 48, size: 86, intelligence: 58, rarity: 94},
        sizeScaleScore: 86,
        principleName: "Apex Patience",
        principleExpression: "Let timing carry the weight of strength.",
        coreLesson: "Force lands harder when patience chooses the moment.",
        biologicalBasis: "Komodo dragons are large island monitor lizards that ambush prey and dominate their ecosystems as apex predators.",
        shortMotto: "Wait heavy. Strike hard.",
        bestUseCases: ["Right Timing", "Dominance", "Discipline"],
        subtitleDescriptor: "The Island Apex Dragon",
        subtitleStory: "The Komodo Dragon wins through patience, mass, and a brutal finishing bite. It shows that dominance often begins long before contact.",
        speciesSpotlight: "Stone Dragon teaches Apex Patience through ambush hunting, immense size, serrated teeth, and island dominance. Its form represents dragon-like landforms where rock seems to hold a sleeping reptile shape.",
        signatureTraits: [
            "Biological Superpower: apex island predation",
            "Massive monitor lizard body",
            "Serrated teeth and powerful bite",
            "Camouflage-based ambush movement"
        ],
        interestingFacts: [
            "It is the largest living lizard.",
            "Adults can take large prey such as deer and pigs.",
            "Young Komodo dragons may climb trees to avoid cannibalistic adults."
        ],
        dietSummary: "Carnivorous, feeding on carrion and live prey including deer, pigs, birds, and smaller dragons.",
        predatorsSummary: "Adults are apex predators, while juveniles face danger from birds, snakes, and larger Komodo dragons.",
        sleepPattern: "Mostly diurnal, using daylight warmth for activity and sheltering during cooler or harsher periods.",
        lifespanEstimate: "Often estimated at several decades in the wild, with maturity taking many years.",
        femaleOffspringNotes: "Females lay eggs in nesting burrows or mound nests, and hatchlings survive independently.",
        sexDifferenceNotes: "Males are usually larger and heavier than females.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Useful universal dragon anchor when a formation is dragon-like but no local species is better."
    }),
    seed({
        beastSlug: "monkey-pillar",
        animaldexNumber: 1804,
        normalizedIdentityKey: "monkey_pillar",
        biologyIdentityKey: "japanese_macaque",
        biologyLandingSlug: "japanese-macaque",
        biologyDisplayName: "Japanese Macaque",
        displayName: "Monkey Pillar",
        scientificName: "Macaca fuscata",
        captureSite: "Saruiwa / Monkey Rock, Iki Island, Nagasaki, Japan",
        canonicalGameStats: {dominance: 78, speed: 68, size: 42, intelligence: 88, rarity: 94},
        sizeScaleScore: 46,
        principleName: "Social Compass",
        principleExpression: "Read the group before choosing the move.",
        coreLesson: "Good timing begins with noticing where everyone else stands.",
        biologicalBasis: "Japanese macaques live in complex troops, use social rank, and adapt to seasonal forests and cold climates.",
        shortMotto: "Read before you leap.",
        bestUseCases: ["Teamwork", "Sharp Observation", "Adaptability"],
        subtitleDescriptor: "The Island Anchor Monkey",
        subtitleStory: "The Japanese Macaque survives by watching groups, weather, food, and rank at once. It shows that intelligence is often social before it is solitary.",
        speciesSpotlight: "Monkey Pillar teaches Social Compass through troop structure, seasonal adaptation, alert faces, and social learning. Its form fits Saruiwa, where the monkey-shaped rock is tied to a legend of gods anchoring Iki Island.",
        signatureTraits: [
            "Biological Superpower: social intelligence",
            "Expressive face and troop signals",
            "Cold-tolerant primate behavior",
            "Agile movement through forest and rock"
        ],
        interestingFacts: [
            "Japanese macaques are among the northernmost wild non-human primates.",
            "Some groups are famous for bathing in hot springs.",
            "They learn food-handling behaviors socially."
        ],
        dietSummary: "Omnivorous, eating fruits, leaves, seeds, bark, insects, and seasonal foods.",
        predatorsSummary: "Threats include large raptors, carnivores, harsh winters, habitat conflict, and human pressure.",
        sleepPattern: "Diurnal, moving and feeding by day while resting in groups at night.",
        lifespanEstimate: "Can live for two decades or more in the wild, with longer lives under protection.",
        femaleOffspringNotes: "Females usually raise single infants with strong mother-infant bonds and troop social learning.",
        sexDifferenceNotes: "Males are larger, while females remain central to troop continuity and kin groups.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "mythic_legendary",
        legendaryNotes: "Generate as a stone-backed island guardian monkey facing the sea."
    }),
    seed({
        beastSlug: "great-bear-claw-guardian",
        animaldexNumber: 1805,
        normalizedIdentityKey: "great_bear_claw_guardian",
        biologyIdentityKey: "brown_bear",
        biologyLandingSlug: "brown-bear",
        biologyDisplayName: "Brown Bear",
        displayName: "Great Bear Claw Guardian",
        scientificName: "Ursus arctos",
        captureSite: "Devils Tower / Bear Lodge, Wyoming, USA",
        canonicalGameStats: {dominance: 96, speed: 52, size: 92, intelligence: 68, rarity: 92},
        sizeScaleScore: 90,
        principleName: "Claw Boundary",
        principleExpression: "Protect what matters without chasing every threat.",
        coreLesson: "A clear boundary can be stronger than a constant fight.",
        biologicalBasis: "Brown bears are powerful omnivores with large ranges, strong maternal defense, and seasonal feeding strategies.",
        shortMotto: "Guard the line.",
        bestUseCases: ["Protective Strength", "Boundaries", "Presence"],
        subtitleDescriptor: "The Sky-Claw Guardian",
        subtitleStory: "The Brown Bear carries strength, memory, and territory in every step. It shows that protection is not noise; it is presence with weight behind it.",
        speciesSpotlight: "Great Bear Claw Guardian teaches Claw Boundary through power, range awareness, maternal defense, and seasonal patience. Its form should be handled respectfully because Devils Tower / Bear Lodge carries living Indigenous significance.",
        signatureTraits: [
            "Biological Superpower: territorial strength",
            "Massive shoulders and digging claws",
            "Seasonal fat-building strategy",
            "Powerful maternal defense"
        ],
        interestingFacts: [
            "Brown bears can eat plants, insects, fish, carrion, and mammals.",
            "They build seasonal reserves before winter dormancy.",
            "Their claws are strong tools for digging and foraging."
        ],
        dietSummary: "Omnivorous, with diet shifting between roots, berries, salmon, insects, carrion, and mammals.",
        predatorsSummary: "Adult brown bears have few natural predators; cubs face risk from other bears, wolves, and accidents.",
        sleepPattern: "Mostly crepuscular or diurnal depending on region and human pressure, with winter dormancy in cold climates.",
        lifespanEstimate: "Often lives 20–30 years in the wild when protected from conflict and habitat loss.",
        femaleOffspringNotes: "Females usually give birth in winter dens and protect cubs for multiple years.",
        sexDifferenceNotes: "Males are much larger than females and range more widely.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "sacred_mythic_legendary",
        respectNote: "Use educational framing and do not encourage entering restricted or sacred areas.",
        legendaryNotes: "Use for Bear Lodge / Devils Tower only with respectful copy and non-intrusive capture logic."
    }),
    seed({
        beastSlug: "royal-lion-rock",
        animaldexNumber: 1806,
        normalizedIdentityKey: "royal_lion_rock",
        biologyIdentityKey: "african_lion",
        biologyLandingSlug: "african-lion",
        biologyDisplayName: "African Lion",
        displayName: "Royal Lion Rock",
        scientificName: "Panthera leo",
        captureSite: "Sigiriya / Lion Rock, Sri Lanka",
        canonicalGameStats: {dominance: 98, speed: 72, size: 84, intelligence: 66, rarity: 93},
        sizeScaleScore: 84,
        principleName: "Pride Command",
        principleExpression: "Lead by anchoring the group, not outrunning it.",
        coreLesson: "Authority lasts longer when it protects the circle that gives it power.",
        biologicalBasis: "Lions are social big cats that hunt, defend territory, and raise young within pride structures.",
        shortMotto: "Lead the circle.",
        bestUseCases: ["Leadership", "Courage", "Protective Strength"],
        subtitleDescriptor: "The Fortress Roar King",
        subtitleStory: "The African Lion rules through presence, coalition, and timing. It shows that leadership is strongest when power and group trust move together.",
        speciesSpotlight: "Royal Lion Rock teaches Pride Command through social hunting, territorial roaring, coalition power, and cub defense. Its form connects lion symbolism to Sigiriya's monumental lion gateway and sky-fortress presence.",
        signatureTraits: [
            "Biological Superpower: social apex coordination",
            "Mane and roar as dominance signals",
            "Pride-based territorial life",
            "Ambush speed and group hunting"
        ],
        interestingFacts: [
            "Lion roars can carry across long distances.",
            "Females often coordinate hunts and cub care.",
            "Male coalitions can defend prides and territories."
        ],
        dietSummary: "Carnivorous, hunting ungulates and scavenging when opportunities arise.",
        predatorsSummary: "Adult lions are apex predators, though cubs face danger from hyenas, leopards, rival lions, and starvation.",
        sleepPattern: "Mostly crepuscular and nocturnal, resting through heat and becoming active in cooler hours.",
        lifespanEstimate: "Wild lions often live around 10–15 years, with females sometimes living longer.",
        femaleOffspringNotes: "Lionesses give birth to litters and often raise cubs within a pride nursery system.",
        sexDifferenceNotes: "Males are larger and usually maned; females are more central to hunting and cub-rearing.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "cultural_legendary",
        legendaryNotes: "Use for Sigiriya capture; image form can be a stone lion fortress guardian."
    }),
    seed({
        beastSlug: "sky-tigress",
        animaldexNumber: 1807,
        normalizedIdentityKey: "sky_tigress",
        biologyIdentityKey: "bengal_tiger",
        biologyLandingSlug: "bengal-tiger",
        biologyDisplayName: "Bengal Tiger",
        displayName: "Sky Tigress",
        scientificName: "Panthera tigris",
        captureSite: "Paro Taktsang / Tiger's Nest, Bhutan",
        canonicalGameStats: {dominance: 97, speed: 78, size: 88, intelligence: 70, rarity: 94},
        sizeScaleScore: 88,
        principleName: "Silent Ascent",
        principleExpression: "Climb quietly until the moment is yours.",
        coreLesson: "Solitude becomes power when every step serves the same aim.",
        biologicalBasis: "Tigers are solitary ambush predators that use cover, strength, and short bursts of speed to take prey.",
        shortMotto: "Climb in silence.",
        bestUseCases: ["Focus", "Courage", "Healthy Independence"],
        subtitleDescriptor: "The Cliff-Shadow Tigress",
        subtitleStory: "The Bengal Tiger moves alone with patience, silence, and explosive finish. It shows that focus can make one path stronger than many options.",
        speciesSpotlight: "Sky Tigress teaches Silent Ascent through solitary range control, striped camouflage, patient stalking, and decisive attack. Its form fits cliffside legend and sacred ascent imagery.",
        signatureTraits: [
            "Biological Superpower: solitary ambush power",
            "Striped camouflage in broken cover",
            "Explosive short-distance attack",
            "Large territorial range"
        ],
        interestingFacts: [
            "Every tiger has a unique stripe pattern.",
            "Tigers are strong swimmers compared with many cats.",
            "They often drag prey to cover after a kill."
        ],
        dietSummary: "Carnivorous, feeding on deer, wild pigs, buffalo calves, and other medium to large prey.",
        predatorsSummary: "Adult tigers are apex predators, but cubs may be killed by rival males, leopards, dholes, or accidents.",
        sleepPattern: "Mostly crepuscular and nocturnal, resting in cover during heat.",
        lifespanEstimate: "Wild tigers often live around 10–15 years, with longer lives possible under protection.",
        femaleOffspringNotes: "Females raise cubs alone, teaching them to hunt before independence.",
        sexDifferenceNotes: "Males are larger and hold wider territories than females.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "mythic_legendary",
        legendaryNotes: "Use for Tiger's Nest-style capture; generate as a cliff-shadow tiger with prayer-flag wind and mountain aura."
    }),
    seed({
        beastSlug: "troll-rhino-beast",
        animaldexNumber: 1808,
        normalizedIdentityKey: "troll_rhino_beast",
        biologyIdentityKey: "indian_rhinoceros",
        biologyLandingSlug: "indian-rhinoceros",
        biologyDisplayName: "Indian Rhinoceros",
        displayName: "Troll Rhino Beast",
        scientificName: "Rhinoceros unicornis",
        captureSite: "Hvítserkur, Vatnsnes Peninsula, Iceland",
        canonicalGameStats: {dominance: 94, speed: 48, size: 96, intelligence: 54, rarity: 94},
        sizeScaleScore: 95,
        principleName: "Living Monolith",
        principleExpression: "Move with enough weight that distraction has to step aside.",
        coreLesson: "You do not need speed when your direction is impossible to ignore.",
        biologicalBasis: "Indian rhinoceroses are huge grazing mammals with thick folded skin, strong bodies, and a single horn.",
        shortMotto: "Be the weight.",
        bestUseCases: ["Presence", "Defense", "Resilience"],
        subtitleDescriptor: "The Armor-Plated Monolith",
        subtitleStory: "The Indian Rhinoceros carries weight like a moving fortress. It shows that a slow force can still reshape the space around it.",
        speciesSpotlight: "Troll Rhino Beast teaches Living Monolith through armor-like skin, mass, grazing endurance, and territorial force. Its form fits Hvítserkur because the sea stack is often seen as a rhino-like creature and is wrapped in troll-stone folklore.",
        signatureTraits: [
            "Biological Superpower: armored bulk",
            "Single horn and folded skin",
            "Heavy grazing body",
            "Powerful territorial presence"
        ],
        interestingFacts: [
            "Its skin folds give it an armor-plated appearance.",
            "It is a strong swimmer despite its size.",
            "Its horn is made of keratin."
        ],
        dietSummary: "Mostly grazes on grasses while also eating leaves, fruit, and aquatic plants.",
        predatorsSummary: "Adults have few natural predators, while calves may be threatened by tigers in some landscapes.",
        sleepPattern: "Active across day and night with resting periods, often using wallows to cool and protect skin.",
        lifespanEstimate: "Can live several decades in the wild under good protection.",
        femaleOffspringNotes: "Females give birth to a single calf after a long gestation and protect it closely.",
        sexDifferenceNotes: "Males are generally larger and more territorial than females.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "mythic_geo_legendary",
        legendaryNotes: "Use for rhino-shaped Icelandic sea stacks; generated form can blend basalt, horn, and troll-stone texture."
    }),
    seed({
        beastSlug: "stone-whale-pod",
        animaldexNumber: 1809,
        normalizedIdentityKey: "stone_whale_pod",
        biologyIdentityKey: "sperm_whale",
        biologyLandingSlug: "sperm-whale",
        biologyDisplayName: "Sperm Whale",
        displayName: "Stone Whale Pod",
        scientificName: "Physeter macrocephalus",
        captureSite: "Three Whale Rock / Hin Sam Wan, Bueng Kan, Thailand",
        canonicalGameStats: {dominance: 86, speed: 44, size: 100, intelligence: 90, rarity: 93},
        sizeScaleScore: 100,
        principleName: "Deep Signal",
        principleExpression: "Send a clear signal before entering deep pressure.",
        coreLesson: "Depth becomes less frightening when your signal can still find the way back.",
        biologicalBasis: "Sperm whales use powerful echolocation clicks and deep dives to hunt squid far below the surface.",
        shortMotto: "Sound the depth.",
        bestUseCases: ["Clear Communication", "Long-Term Endurance", "Focus"],
        subtitleDescriptor: "The Deep-World Click Giant",
        subtitleStory: "The Sperm Whale dives into pressure and darkness guided by sound. It shows that deep work needs a signal strong enough to travel where eyes cannot.",
        speciesSpotlight: "Stone Whale Pod teaches Deep Signal through echolocation, deep diving, social pods, and pressure endurance. Its form fits Three Whale Rock, where sandstone ridges appear like whales swimming through forest canopy.",
        signatureTraits: [
            "Biological Superpower: deep echolocation",
            "Massive square head",
            "Long deep-diving ability",
            "Pod-based social structure"
        ],
        interestingFacts: [
            "Sperm whales are among the deepest diving mammals.",
            "They hunt squid using sound in dark water.",
            "Their clicks are among the loudest biological sounds."
        ],
        dietSummary: "Feeds mainly on squid, including large deep-sea species, plus fish when available.",
        predatorsSummary: "Adults face few predators, though calves may be threatened by orcas.",
        sleepPattern: "Sleeps in short vertical resting periods between deep foraging cycles.",
        lifespanEstimate: "Can live for many decades, often estimated around 60 years or more.",
        femaleOffspringNotes: "Females nurse calves for years and live in social groups that help protect young.",
        sexDifferenceNotes: "Males grow much larger than females and often range more widely.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Generate as mossy sandstone whales surfacing from forest, with subtle ocean-memory motifs."
    }),
    seed({
        beastSlug: "alula-sand-elephant",
        animaldexNumber: 1810,
        normalizedIdentityKey: "alula_sand_elephant",
        biologyIdentityKey: "african_bush_elephant",
        biologyLandingSlug: "african-bush-elephant",
        biologyDisplayName: "African Bush Elephant",
        displayName: "AlUla Sand Elephant",
        scientificName: "Loxodonta africana",
        captureSite: "Jabal AlFil / Elephant Rock, AlUla, Saudi Arabia",
        canonicalGameStats: {dominance: 92, speed: 40, size: 100, intelligence: 88, rarity: 94},
        sizeScaleScore: 100,
        principleName: "Memory Path",
        principleExpression: "Carry experience like a map, not a weight.",
        coreLesson: "The strongest route is often the one memory has tested before.",
        biologicalBasis: "African bush elephants use social memory, matriarch leadership, long movement routes, and powerful bodies to survive.",
        shortMotto: "Remember the route.",
        bestUseCases: ["Long-Term Endurance", "Leadership", "Teamwork"],
        subtitleDescriptor: "The Desert Memory Titan",
        subtitleStory: "The African Bush Elephant moves with memory, family, and landscape knowledge. It shows that strength becomes wiser when it remembers the path.",
        speciesSpotlight: "AlUla Sand Elephant teaches Memory Path through matriarchal groups, long-range movement, water knowledge, and immense strength. Its form turns a desert sandstone landmark into a living symbol of patience and ancient routes.",
        signatureTraits: [
            "Biological Superpower: landscape memory",
            "Largest living land animal",
            "Trunk used for touch, smell, food, and water",
            "Matriarch-led social herds"
        ],
        interestingFacts: [
            "Elephants can detect distant low-frequency sounds.",
            "They dig for water and can shape habitat for other species.",
            "Older females often guide herds through drought decisions."
        ],
        dietSummary: "Herbivorous, eating grasses, leaves, bark, fruit, roots, and branches.",
        predatorsSummary: "Adults have few predators; calves may be threatened by lions, hyenas, or drought stress.",
        sleepPattern: "Sleeps in short periods, often resting less than many mammals because feeding demands are high.",
        lifespanEstimate: "Can live around 60–70 years in the wild under good conditions.",
        femaleOffspringNotes: "Females carry calves through a long pregnancy and raise them with help from the herd.",
        sexDifferenceNotes: "Males are larger and often leave natal herds, while females remain in family groups.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for AlUla Elephant Rock; generate with sandstone skin, desert horizon, and route-memory motifs."
    }),
    seed({
        beastSlug: "fairy-tomb-elephant",
        animaldexNumber: 1811,
        normalizedIdentityKey: "fairy_tomb_elephant",
        biologyIdentityKey: "asian_elephant",
        biologyLandingSlug: "asian-elephant",
        biologyDisplayName: "Asian Elephant",
        displayName: "Fairy-Tomb Elephant",
        scientificName: "Elephas maximus",
        captureSite: "Elephant Rock / Roccia dell'Elefante, Castelsardo, Sardinia, Italy",
        canonicalGameStats: {dominance: 89, speed: 38, size: 96, intelligence: 88, rarity: 95},
        sizeScaleScore: 96,
        principleName: "Gentle Weight",
        principleExpression: "Let strength stay calm until care requires force.",
        coreLesson: "Power is easier to trust when it knows how to be gentle.",
        biologicalBasis: "Asian elephants are intelligent social herbivores with strong family bonds and complex communication.",
        shortMotto: "Strong, not loud.",
        bestUseCases: ["Protective Strength", "Balance", "Leadership"],
        subtitleDescriptor: "The Quiet Forest Colossus",
        subtitleStory: "The Asian Elephant is powerful without needing constant display. It shows that gentleness and strength can belong to the same body.",
        speciesSpotlight: "Fairy-Tomb Elephant teaches Gentle Weight through family bonds, quiet strength, trunk skill, and long memory. Its form suits Sardinia's elephant-shaped rock and nearby ancient tomb atmosphere without claiming an elephant myth where none is confirmed.",
        signatureTraits: [
            "Biological Superpower: careful strength",
            "Sensitive trunk control",
            "Strong social bonds",
            "Large forest-moving body"
        ],
        interestingFacts: [
            "Asian elephants have smaller ears than African bush elephants.",
            "They use rumbles and touch to communicate.",
            "Their trunks can lift heavy objects or pick up small items."
        ],
        dietSummary: "Herbivorous, eating grasses, leaves, bark, fruit, palms, and cultivated plants near human edges.",
        predatorsSummary: "Adults have few natural predators, while calves may be vulnerable to tigers in some regions.",
        sleepPattern: "Sleeps in short periods, often with alternating rest and feeding through the day and night.",
        lifespanEstimate: "Can live for many decades, often around 60 years under favorable conditions.",
        femaleOffspringNotes: "Females give birth to single calves after long gestation and raise them within social groups.",
        sexDifferenceNotes: "Males are larger; tusk size varies by sex and population.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "cultural_geo_legendary",
        legendaryNotes: "Use for elephant-shaped ancient-rock sites where the cultural link is archaeological rather than mythic."
    }),
    seed({
        beastSlug: "steppe-turtle",
        animaldexNumber: 1812,
        normalizedIdentityKey: "steppe_turtle",
        biologyIdentityKey: "russian_tortoise",
        biologyLandingSlug: "russian-tortoise",
        biologyDisplayName: "Russian Tortoise",
        displayName: "Steppe Turtle",
        scientificName: "Testudo horsfieldii",
        captureSite: "Turtle Rock / Melkhii Khad, Gorkhi-Terelj National Park, Mongolia",
        canonicalGameStats: {dominance: 62, speed: 18, size: 30, intelligence: 52, rarity: 98},
        sizeScaleScore: 30,
        principleName: "Moving Shelter",
        principleExpression: "Carry your boundary into every open place.",
        coreLesson: "A slow pace is not weakness when the shield never leaves.",
        biologicalBasis: "Russian tortoises are hardy burrowing reptiles adapted to dry steppe and semi-desert conditions.",
        shortMotto: "Bring your shelter.",
        bestUseCases: ["Patient Progress", "Defense", "Long-Term Endurance"],
        subtitleDescriptor: "The Steppe Shell Sentinel",
        subtitleStory: "The Russian Tortoise survives exposed landscapes by carrying protection everywhere. It shows that patience is easier when your boundary moves with you.",
        speciesSpotlight: "Steppe Turtle teaches Moving Shelter through burrowing, drought tolerance, compact armor, and patient movement. Its form turns Mongolia's Turtle Rock into a living guardian of open grassland.",
        signatureTraits: [
            "Biological Superpower: portable defense",
            "Hard domed shell",
            "Burrowing survival strategy",
            "Dry steppe endurance"
        ],
        interestingFacts: [
            "It can survive harsh seasonal conditions by retreating underground.",
            "Its compact body is built for digging.",
            "It is also known as Horsfield's tortoise."
        ],
        dietSummary: "Herbivorous, feeding on grasses, weeds, flowers, and tough seasonal plants.",
        predatorsSummary: "Eggs and young are vulnerable to foxes, birds, and reptiles, while adults rely on shell defense.",
        sleepPattern: "Diurnal when temperatures are suitable, with seasonal dormancy during extremes.",
        lifespanEstimate: "Can live for several decades, especially when habitat remains stable.",
        femaleOffspringNotes: "Females lay small clutches of eggs in soil, with hatchlings independent from birth.",
        sexDifferenceNotes: "Males are usually smaller with longer tails, while females are larger for egg production.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for Turtle Rock captures; generate as a granite turtle with grassland shell."
    }),
    seed({
        beastSlug: "nargun-stone-beast",
        animaldexNumber: 1813,
        normalizedIdentityKey: "nargun_stone_beast",
        biologyIdentityKey: "lace_monitor",
        biologyLandingSlug: "lace-monitor",
        biologyDisplayName: "Lace Monitor",
        displayName: "Nargun Stone Beast",
        scientificName: "Varanus varius",
        captureSite: "Den of Nargun, Mitchell River National Park, Victoria, Australia",
        canonicalGameStats: {dominance: 84, speed: 62, size: 68, intelligence: 64, rarity: 94},
        sizeScaleScore: 68,
        principleName: "Scent Trail",
        principleExpression: "Follow evidence before impulse chooses the path.",
        coreLesson: "Good judgment often begins with noticing what others step over.",
        biologicalBasis: "Lace monitors are large Australian lizards that climb well, scavenge, hunt, and use scent to locate food.",
        shortMotto: "Track the clue.",
        bestUseCases: ["Sharp Observation", "Strategic Camouflage", "Focus"],
        subtitleDescriptor: "The Eucalypt Shadow Monitor",
        subtitleStory: "The Lace Monitor reads trees, scent, carrion, and danger with reptile patience. It shows that awareness grows when you follow quiet evidence.",
        speciesSpotlight: "Nargun Stone Beast teaches Scent Trail through climbing, scavenging, forked-tongue investigation, and forest-edge alertness. Its form should be respectful, using a real Australian reptile as the biological anchor for a powerful stone-being site.",
        signatureTraits: [
            "Biological Superpower: scent-led tracking",
            "Large climbing monitor body",
            "Patterned camouflage scales",
            "Carrion and nest-raiding flexibility"
        ],
        interestingFacts: [
            "Lace monitors are among Australia's largest lizards.",
            "They climb trees well despite their size.",
            "They use forked tongues to sample chemical traces."
        ],
        dietSummary: "Carnivorous and opportunistic, eating carrion, eggs, insects, reptiles, birds, and small mammals.",
        predatorsSummary: "Adults face limited predation, while young can be taken by birds, snakes, larger monitors, and mammals.",
        sleepPattern: "Diurnal, basking for warmth and retreating to hollows or shelter at night.",
        lifespanEstimate: "Large monitors can live for many years, with survival tied to shelter and food availability.",
        femaleOffspringNotes: "Females lay eggs in protected sites such as termite mounds or soil chambers.",
        sexDifferenceNotes: "Males are usually larger and may compete during breeding periods.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "sacred_mythic_legendary",
        respectNote: "Do not encourage entering the cave; scan logic should validate respectful distance.",
        legendaryNotes: "Use carefully for Den of Nargun; generated form can be stone-scaled monitor, not a caricature of sacred tradition."
    }),
    seed({
        beastSlug: "dragons-back-ridge-serpent",
        animaldexNumber: 1814,
        normalizedIdentityKey: "dragons_back_ridge_serpent",
        biologyIdentityKey: "chinese_cobra",
        biologyLandingSlug: "chinese-cobra",
        biologyDisplayName: "Chinese Cobra",
        displayName: "Dragon's Back Ridge Serpent",
        scientificName: "Naja atra",
        captureSite: "Dragon's Back, Hong Kong",
        canonicalGameStats: {dominance: 86, speed: 66, size: 50, intelligence: 58, rarity: 95},
        sizeScaleScore: 50,
        principleName: "Visible Boundary",
        principleExpression: "Make the line visible before pressure crosses it.",
        coreLesson: "A clear signal prevents many fights from becoming necessary.",
        biologicalBasis: "Chinese cobras use hood displays, defensive posture, venom, and quick escape in warm Asian habitats.",
        shortMotto: "Show the line.",
        bestUseCases: ["Boundaries", "Defense", "Presence"],
        subtitleDescriptor: "The Ridge-Hood Serpent",
        subtitleStory: "The Chinese Cobra turns warning into space. It shows that a boundary can be both visible and controlled.",
        speciesSpotlight: "Dragon's Back Ridge Serpent teaches Visible Boundary through hood display, fast warning, venom defense, and ridge-like body movement. Its form links Chinese dragon symbolism with a real regional cobra anchor.",
        signatureTraits: [
            "Biological Superpower: warning display",
            "Expandable hood",
            "Venomous defensive bite",
            "Agile ground movement"
        ],
        interestingFacts: [
            "It often raises the front body when threatened.",
            "Its hood makes its warning easy to read.",
            "It can live near farms, forests, and edges where prey is available."
        ],
        dietSummary: "Feeds on rodents, frogs, lizards, snakes, and other small vertebrates.",
        predatorsSummary: "Threats include raptors, mongooses, larger snakes, and humans.",
        sleepPattern: "Often active at dusk or night in warm seasons, with activity shifting by temperature.",
        lifespanEstimate: "Wild lifespan varies, but cobras can survive many years when not persecuted.",
        femaleOffspringNotes: "Females lay eggs in protected warm places; young are independent after hatching.",
        sexDifferenceNotes: "Sex differences are modest, though males may be larger in some populations.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "cultural_geo_legendary",
        legendaryNotes: "Use for Hong Kong Dragon's Back as a ridge-serpent variant, not an ancient-site claim."
    }),
    seed({
        beastSlug: "sleeping-sea-lion",
        animaldexNumber: 1815,
        normalizedIdentityKey: "sleeping_sea_lion",
        biologyIdentityKey: "galapagos_sea_lion",
        biologyLandingSlug: "galapagos-sea-lion",
        biologyDisplayName: "Galápagos Sea Lion",
        displayName: "Sleeping Sea Lion",
        scientificName: "Zalophus wollebaeki",
        captureSite: "Kicker Rock / León Dormido, San Cristóbal, Galápagos, Ecuador",
        canonicalGameStats: {dominance: 82, speed: 78, size: 70, intelligence: 72, rarity: 96},
        sizeScaleScore: 70,
        principleName: "Rested Surge",
        principleExpression: "Recover fully so your next burst has teeth.",
        coreLesson: "Rest is not absence; it is stored movement.",
        biologicalBasis: "Galápagos sea lions rest on shore and hunt fish underwater with agility, social awareness, and breath control.",
        shortMotto: "Rest, then surge.",
        bestUseCases: ["Recovery", "Agility", "Balance"],
        subtitleDescriptor: "The Reef-Gate Sleeper",
        subtitleStory: "The Galápagos Sea Lion moves between rest and sudden underwater agility. It shows that recovery can hide explosive capability.",
        speciesSpotlight: "Sleeping Sea Lion teaches Rested Surge through shore resting, underwater speed, social calls, and reef hunting. Its form fits León Dormido, a sea-stack landmark whose name means sleeping lion.",
        signatureTraits: [
            "Biological Superpower: amphibious agility",
            "Streamlined swimming body",
            "Social shoreline colonies",
            "Breath-held underwater hunting"
        ],
        interestingFacts: [
            "It is endemic to the Galápagos region.",
            "Young sea lions are playful and highly curious.",
            "Males defend territories during breeding season."
        ],
        dietSummary: "Feeds mainly on fish and squid caught during agile dives.",
        predatorsSummary: "Threats include sharks, orcas, disease, food shortages, and human disturbance.",
        sleepPattern: "Rests on shore between feeding trips and is active around water throughout the day.",
        lifespanEstimate: "Can live into the teens or longer, with survival affected by food cycles and ocean conditions.",
        femaleOffspringNotes: "Females nurse pups on shore and recognize them by smell and vocal calls.",
        sexDifferenceNotes: "Males are larger, heavier, and develop stronger necks and territorial behavior.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for Kicker Rock / León Dormido; generated form can be a sleeping stone sea lion guarding a reef gate."
    }),
    seed({
        beastSlug: "stone-shark-fin",
        animaldexNumber: 1816,
        normalizedIdentityKey: "stone_shark_fin",
        biologyIdentityKey: "great_white_shark",
        biologyLandingSlug: "great-white-shark",
        biologyDisplayName: "Great White Shark",
        displayName: "Stone Shark Fin",
        scientificName: "Carcharodon carcharias",
        captureSite: "Shark Fin Cove, Davenport, California, USA",
        canonicalGameStats: {dominance: 98, speed: 86, size: 90, intelligence: 62, rarity: 94},
        sizeScaleScore: 90,
        principleName: "Apex Signal",
        principleExpression: "Make the signal sharp enough to shift the room.",
        coreLesson: "Presence can move first, even before the body does.",
        biologicalBasis: "Great white sharks are large predatory fish with powerful senses, burst speed, and a visible dorsal fin profile.",
        shortMotto: "Let presence arrive.",
        bestUseCases: ["Presence", "Precision", "Courage"],
        subtitleDescriptor: "The Apex Signal Fin",
        subtitleStory: "The Great White Shark is recognized before it arrives. It shows that a single clear signal can change the whole field.",
        speciesSpotlight: "Stone Shark Fin teaches Apex Signal through dorsal silhouette, sensory range, ambush speed, and ocean dominance. Its form is a clean match for coastal fin-shaped rock landmarks.",
        signatureTraits: [
            "Biological Superpower: apex sensory tracking",
            "Iconic dorsal fin",
            "Countershaded body",
            "Burst attack speed"
        ],
        interestingFacts: [
            "Great whites can breach when attacking prey from below.",
            "They use electroreception to sense animals.",
            "They travel long distances across ocean regions."
        ],
        dietSummary: "Feeds on fish, rays, seals, sea lions, carrion, and other marine prey depending on age and size.",
        predatorsSummary: "Adults have few predators, though orcas can kill them in some regions.",
        sleepPattern: "Does not sleep like land mammals; it alternates active swimming with lower-activity periods.",
        lifespanEstimate: "Can live for several decades, with some estimates exceeding 50 years.",
        femaleOffspringNotes: "Females give birth to live young after internal development; pups are independent at birth.",
        sexDifferenceNotes: "Females often grow larger than males.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for Shark Fin Cove and similar fin-shaped coastal rocks."
    }),
    seed({
        beastSlug: "desert-camel-sentinel",
        animaldexNumber: 1817,
        normalizedIdentityKey: "desert_camel_sentinel",
        biologyIdentityKey: "bactrian_camel",
        biologyLandingSlug: "bactrian-camel",
        biologyDisplayName: "Bactrian Camel",
        displayName: "Desert Camel Sentinel",
        scientificName: "Camelus bactrianus",
        captureSite: "Camel Rock sites, including Devrent Valley, Cappadocia, Turkey and Camel Rock, New Mexico, USA",
        canonicalGameStats: {dominance: 78, speed: 45, size: 82, intelligence: 62, rarity: 96},
        sizeScaleScore: 82,
        principleName: "Reserve March",
        principleExpression: "Build reserves before the road becomes empty.",
        coreLesson: "Endurance is easier when preparation travels with you.",
        biologicalBasis: "Bactrian camels are large two-humped desert animals adapted to harsh dry climates, sparse food, and long travel.",
        shortMotto: "Carry the reserve.",
        bestUseCases: ["Preparation", "Long-Term Endurance", "Resilience"],
        subtitleDescriptor: "The Drought-Walker Sentinel",
        subtitleStory: "The Bactrian Camel carries reserves through empty distance. It shows that preparation is what makes endurance look calm.",
        speciesSpotlight: "Desert Camel Sentinel teaches Reserve March through fat-storing humps, tough feet, dryland endurance, and steady movement. Its form fits camel-shaped rocks where erosion turns stone into a pack animal of ancient routes.",
        signatureTraits: [
            "Biological Superpower: reserve-based endurance",
            "Two fat-storing humps",
            "Broad feet for soft ground",
            "Thick coat for temperature extremes"
        ],
        interestingFacts: [
            "Its humps store fat, not water.",
            "It can tolerate wide temperature swings.",
            "It has nostrils and eyelashes suited to dusty conditions."
        ],
        dietSummary: "Herbivorous, feeding on dry grasses, shrubs, thorny plants, and sparse desert vegetation.",
        predatorsSummary: "Young may be threatened by wolves or large predators; adults rely on size, herd awareness, and human protection in domestic settings.",
        sleepPattern: "Diurnal to flexible, resting and feeding according to heat, travel, and herd rhythm.",
        lifespanEstimate: "Can live for several decades under managed or favorable wild conditions.",
        femaleOffspringNotes: "Females give birth to a single calf after long gestation and nurse it for many months.",
        sexDifferenceNotes: "Males are typically larger and may show stronger breeding-season behavior.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for camel-shaped desert formations; strong for SEO because many locations have Camel Rock names."
    }),
    seed({
        beastSlug: "coastal-seal-stone",
        animaldexNumber: 1818,
        normalizedIdentityKey: "coastal_seal_stone",
        biologyIdentityKey: "new_zealand_fur_seal",
        biologyLandingSlug: "new-zealand-fur-seal",
        biologyDisplayName: "New Zealand Fur Seal",
        displayName: "Coastal Seal Stone",
        scientificName: "Arctocephalus forsteri",
        captureSite: "Seal-shaped coastal rocks, including Jialeshui, Kenting, Taiwan",
        canonicalGameStats: {dominance: 78, speed: 78, size: 60, intelligence: 72, rarity: 96},
        sizeScaleScore: 60,
        principleName: "Element Switch",
        principleExpression: "Know which environment unlocks your best movement.",
        coreLesson: "You do not need to be graceful everywhere; you need to know where you are built to move.",
        biologicalBasis: "New Zealand fur seals breed on rocky coasts and forage at sea with agile swimming and diving.",
        shortMotto: "Switch your element.",
        bestUseCases: ["Adaptability", "Agility", "Balance"],
        subtitleDescriptor: "The Tide-Slick Acrobat",
        subtitleStory: "The New Zealand Fur Seal rests on harsh rock and becomes fluid in water. It shows that the right environment can reveal a hidden skill.",
        speciesSpotlight: "Coastal Seal Stone teaches Element Switch through rocky hauling grounds, agile swimming, social breeding colonies, and marine hunting. Its form fits seal-shaped rocks where land stiffness and water grace meet.",
        signatureTraits: [
            "Biological Superpower: land-water transition",
            "Dense insulating fur",
            "Agile swimming body",
            "Rocky coast breeding behavior"
        ],
        interestingFacts: [
            "Fur seals use strong front flippers for swimming.",
            "They can forage far from breeding colonies.",
            "Pups learn on exposed rocky shores."
        ],
        dietSummary: "Feeds on fish, squid, octopus, and other marine prey.",
        predatorsSummary: "Threats include sharks, orcas, disease, entanglement, and disturbance at breeding colonies.",
        sleepPattern: "Rests on shore between sea trips and can sleep at sea during longer foraging periods.",
        lifespanEstimate: "Often lives into the teens or longer, with females sometimes living longer than males.",
        femaleOffspringNotes: "Females give birth to a single pup and alternate nursing visits with foraging trips.",
        sexDifferenceNotes: "Males are much larger and defend breeding territories.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for seal-shaped coastal formations; generate as a wet basalt seal guardian."
    }),
    seed({
        beastSlug: "rain-frog-stone",
        animaldexNumber: 1819,
        normalizedIdentityKey: "rain_frog_stone",
        biologyIdentityKey: "australian_green_tree_frog",
        biologyLandingSlug: "australian-green-tree-frog",
        biologyDisplayName: "Australian Green Tree Frog",
        displayName: "Rain Frog Stone",
        scientificName: "Ranoidea caerulea",
        captureSite: "Frog Rock sites, including Mudgee, New South Wales, Australia",
        canonicalGameStats: {dominance: 58, speed: 52, size: 22, intelligence: 50, rarity: 99},
        sizeScaleScore: 22,
        principleName: "Rain Timing",
        principleExpression: "Wait for the conditions that make action natural.",
        coreLesson: "The right moment can make a small leap travel farther.",
        biologicalBasis: "Australian green tree frogs use moisture, shelter, sticky toe pads, and nocturnal activity to survive hot variable habitats.",
        shortMotto: "Leap with the rain.",
        bestUseCases: ["Right Timing", "Stillness", "Adaptability"],
        subtitleDescriptor: "The Rain-Call Stillheart",
        subtitleStory: "The Australian Green Tree Frog waits through dryness and wakes with rain. It shows that timing is sometimes about knowing when not to move.",
        speciesSpotlight: "Rain Frog Stone teaches Rain Timing through moisture awareness, still waiting, nocturnal calling, and sudden climbing movement. Its form fits frog-shaped rock formations without needing a false ancient myth.",
        signatureTraits: [
            "Biological Superpower: moisture-timed activity",
            "Sticky toe pads for climbing",
            "Bright rounded body",
            "Nocturnal calling after rain"
        ],
        interestingFacts: [
            "It often shelters in cool damp places during dry heat.",
            "Its toe pads help it climb smooth surfaces.",
            "It is one of Australia's most recognizable frogs."
        ],
        dietSummary: "Feeds on insects, spiders, and other small invertebrates caught by sudden strikes.",
        predatorsSummary: "Threats include snakes, birds, larger frogs, mammals, dehydration, and habitat loss.",
        sleepPattern: "Mostly nocturnal, resting by day and becoming active at night or after rain.",
        lifespanEstimate: "Can live many years, with long lives especially recorded in protected conditions.",
        femaleOffspringNotes: "Females lay eggs in water after rain, and tadpoles develop in ponds or temporary pools.",
        sexDifferenceNotes: "Females are often larger, while males call to attract mates.",
        fieldGuideVersion: "v1_editorial_legendary_2026",
        legendaryTier: "S",
        legendarySource: "geo_legendary",
        legendaryNotes: "Use for Frog Rock captures; generate as a rain-polished stone frog with glowing wet eyes."
    })
];

const byBeastSlug = new Map(legendaryEarthBeastCatalogSeeds.map((seed) => [seed.beastSlug, seed]));
const byIdentityKey = new Map(legendaryEarthBeastCatalogSeeds.map((seed) => [seed.normalizedIdentityKey, seed]));
const byBiologyIdentityKey = new Map(legendaryEarthBeastCatalogSeeds.map((seed) => [seed.biologyIdentityKey, seed]));
const byBiologyLandingSlug = new Map(legendaryEarthBeastCatalogSeeds.map((seed) => [seed.biologyLandingSlug, seed]));
const byFormName = new Map(legendaryEarthBeastCatalogSeeds.map((seed) => [seed.displayName.toLowerCase(), seed]));

export function getLegendaryCatalogSeedByBeastSlug(slug: string) {
    return byBeastSlug.get(slug.trim().toLowerCase()) ?? null;
}

export function getLegendaryCatalogSeedByIdentityKey(identityKey: string) {
    return byIdentityKey.get(identityKey.trim().toLowerCase()) ?? null;
}

export function getLegendaryCatalogSeedByBiologyIdentityKey(identityKey: string) {
    return byBiologyIdentityKey.get(identityKey.trim().toLowerCase()) ?? null;
}

export function getLegendaryCatalogSeedByBiologyLandingSlug(slug: string) {
    return byBiologyLandingSlug.get(slug.trim().toLowerCase()) ?? null;
}

export function getLegendaryCatalogSeedByFormName(formName: string) {
    return byFormName.get(formName.trim().toLowerCase()) ?? null;
}

export function getBiologyAnchorSlugsToExclude() {
    return new Set(legendaryEarthBeastCatalogSeeds.map((seed) => seed.biologyLandingSlug));
}

export function mergeLegendaryEarthBeastSpeciesEntry(
    staticEntry: SpeciesEntry,
    seed: LegendaryEarthBeastCatalogSeed,
    catalogEntry?: SpeciesEntry | null
): SpeciesEntry {
    const captureSite = seed.captureSite;
    const respectfulSpotting = [
        `Capture is only valid at ${captureSite}.`,
        "Observe from safe public viewpoints and do not disturb wildlife or sacred sites."
    ];

    if (seed.respectNote) {
        respectfulSpotting.unshift(seed.respectNote);
    }

    return {
        ...staticEntry,
        name: seed.displayName,
        speciesProfileId: catalogEntry?.speciesProfileId ?? staticEntry.speciesProfileId,
        normalizedIdentityKey: seed.normalizedIdentityKey,
        heroTitle: `${seed.displayName} — Legendary Earth Beast, Stats, Field Guide & Capture Site`,
        analysis: {
            ...staticEntry.analysis,
            summary: seed.speciesSpotlight,
            scientificName: seed.scientificName,
            identification: seed.signatureTraits,
            habitat: captureSite,
            nativeRange: captureSite,
            rarityScore: seed.canonicalGameStats.rarity,
            rarityReason: `${seed.displayName} is an S-tier Legendary Earth Beast that can only be captured at ${captureSite}.`
        },
        premiumDetails: {
            behaviorTraits: seed.signatureTraits,
            whyInteresting: seed.interestingFacts,
            respectfulSpotting,
            lookalikes: [`Biology inspired by ${seed.biologyDisplayName}`]
        },
        relatedSpecies: [],
        databaseSource: {
            animalDexNumber: seed.animaldexNumber,
            identityKind: "legendary_species",
            canonicalGameStats: seed.canonicalGameStats,
            seoIndexable: true,
            fieldGuideVersion: seed.fieldGuideVersion,
            fieldGuide: {
                dietSummary: seed.dietSummary,
                predatorsSummary: seed.predatorsSummary,
                sleepPattern: seed.sleepPattern,
                lifespanEstimate: seed.lifespanEstimate,
                femaleOffspringNotes: seed.femaleOffspringNotes,
                sexDifferenceNotes: seed.sexDifferenceNotes
            }
        }
    };
}

export function buildLegendaryBehaviorLessonFromSeed(seed: LegendaryEarthBeastCatalogSeed) {
    return {
        slug: seed.beastSlug,
        principleName: seed.principleName,
        principleExpression: seed.principleExpression,
        coreLesson: seed.coreLesson,
        biologicalBasis: seed.biologicalBasis,
        shortMotto: seed.shortMotto,
        bestUseCases: seed.bestUseCases,
        applicationExample: null as string | null
    };
}
