import {CanonicalContentMetadata, ContentImage} from "@/data/content-schema";

export const LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH = "/legendary-earth-beasts";
export const LEGENDARY_EARTH_BEASTS_PILLAR_PATH = LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH;

export const legendaryEarthBeastsHubTitle =
    "Legendary Earth Beasts: Real Animal-Shaped Rocks, Mythic Places & S-Tier AnimalDex Captures";

export const legendaryEarthBeastsHubDescription =
    "Explore AnimalDex Legendary Earth Beasts: real animals inspired by Naga Cave, Sinai Dragon Head Mountain, Elephant Rock, Sigiriya, Devils Tower, and other mythic animal-shaped places.";

export type LegendaryEarthBeastHubFilterId =
    | "all"
    | "mythic"
    | "geo"
    | "cultural"
    | "sacred"
    | "dragon-serpent"
    | "mammal-titans"
    | "ocean-beasts";

export const legendaryEarthBeastHubFilters: Array<{id: LegendaryEarthBeastHubFilterId; label: string}> = [
    {id: "all", label: "All beasts"},
    {id: "mythic", label: "Mythic Legendary"},
    {id: "geo", label: "Geo-Legendary"},
    {id: "cultural", label: "Cultural Legendary"},
    {id: "sacred", label: "Sacred / Respectful Capture"},
    {id: "dragon-serpent", label: "Dragon & Serpent"},
    {id: "mammal-titans", label: "Mammal Titans"},
    {id: "ocean-beasts", label: "Ocean Beasts"}
];

const dragonSerpentSlugs = new Set([
    "sinai-dragon",
    "naga-snake",
    "jeju-dragon-head",
    "stone-dragon",
    "dragons-back-ridge-serpent"
]);

const mammalTitanSlugs = new Set([
    "great-bear-claw-guardian",
    "royal-lion-rock",
    "sky-tigress",
    "troll-rhino-beast",
    "alula-sand-elephant",
    "fairy-tomb-elephant",
    "monkey-pillar",
    "desert-camel-sentinel"
]);

const oceanBeastSlugs = new Set([
    "stone-whale-pod",
    "sleeping-sea-lion",
    "stone-shark-fin",
    "coastal-seal-stone",
    "troll-rhino-beast"
]);

export const legendaryEarthBeastsHubFaq: LegendaryEarthBeastFAQ[] = [
    {
        question: "What is a Legendary Earth Beast?",
        answer: "A Legendary Earth Beast is a real animal species anchored to a real place where rock, mountain, cliff, cave, or coastline resembles that creature or carries a strong animal story."
    },
    {
        question: "Are Legendary Earth Beasts real animals?",
        answer: "Yes. Each legendary form is tied to a real species with a scientific name. The mythic style comes from the landform and story, not from inventing a fantasy-only creature."
    },
    {
        question: "Are these rocks actual fossilized animals?",
        answer: "No. Most are natural formations shaped by erosion, volcanic activity, wind, waves, or pareidolia—not literal petrified animals."
    },
    {
        question: "Which Legendary Earth Beast should launch first?",
        answer: "Naga Snake at Naka Cave is the strongest first candidate because of its serpent-scale visual identity and deep Naga mythology. Sinai Dragon, AlUla Sand Elephant, and Great Bear Claw Guardian are also top launch picks."
    },
    {
        question: "How does AnimalDex handle sacred sites?",
        answer: "For places like Devils Tower and the Den of Nargun, AnimalDex uses respectful capture language, public-viewpoint requirements, and educational copy that does not treat sacred stories like loot or challenges."
    },
    {
        question: "Can I capture Legendary Earth Beasts in AnimalDex?",
        answer: "That is the product direction: visit the real formation, capture respectfully from a safe public viewpoint, and unlock the real species with its legendary form."
    }
];

export function beastMatchesHubFilter(beast: LegendaryEarthBeast, filterId: LegendaryEarthBeastHubFilterId) {
    switch (filterId) {
        case "all":
            return true;
        case "mythic":
            return beast.legendaryType.includes("Mythic");
        case "geo":
            return beast.legendaryType.includes("Geo-Legendary");
        case "cultural":
            return beast.legendaryType.includes("Cultural");
        case "sacred":
            return Boolean(beast.respectfulCaptureNote);
        case "dragon-serpent":
            return dragonSerpentSlugs.has(beast.slug);
        case "mammal-titans":
            return mammalTitanSlugs.has(beast.slug);
        case "ocean-beasts":
            return oceanBeastSlugs.has(beast.slug);
        default:
            return true;
    }
}

export type LegendaryEarthBeastType =
    | "Mythic Legendary"
    | "Cultural Legendary"
    | "Geo-Legendary"
    | "Mythic / Geo-Legendary"
    | "Cultural / Geo-Legendary";

export type LegendaryEarthBeastFAQ = {
    question: string;
    answer: string;
};

export type LegendaryEarthBeastSource = {
    label: string;
    href: string;
};

export type LegendaryEarthBeast = CanonicalContentMetadata & {
    slug: string;
    legendaryFormName: string;
    displayName: string;
    scientificName: string;
    speciesSlug?: string;
    captureSite: string;
    region: string;
    legendaryType: LegendaryEarthBeastType;
    tier: "S";
    power: string;
    lesson: string;
    bestFor: string[];
    imageDirection: string;
    searchIntents: string[];
    quickAnswer: string;
    placeStory: string[];
    biologyAnchor: string[];
    respectfulCaptureNote?: string;
    launchPriority?: number;
    faq: LegendaryEarthBeastFAQ[];
    sources: LegendaryEarthBeastSource[];
};

const placeholderSrc = "/images/placeholders/blog-image-slot.svg";
const publishedAt = "2026-07-06";

function beastImage(alt: string, caption: string): ContentImage {
    return {
        src: placeholderSrc,
        alt,
        width: 1600,
        height: 900,
        caption: `Image slot: ${caption}`
    };
}

type BeastInput = Omit<
    LegendaryEarthBeast,
    "title" | "description" | "publishedAt" | "updatedAt" | "featuredImage"
> & {
    imageAlt: string;
    imageCaption: string;
};

function createBeast(input: BeastInput): LegendaryEarthBeast {
    const title = `${input.legendaryFormName}: ${input.displayName} at ${input.captureSite.split(",")[0]}`;
    const description = `${input.legendaryFormName} is a Legendary Earth Beast inspired by ${input.captureSite}. Anchored to the real ${input.displayName} (${input.scientificName}), this ${input.legendaryType.toLowerCase()} entry explores the place, the species, and the lesson behind the formation.`;

    return {
        ...input,
        title,
        description,
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: beastImage(input.imageAlt, input.imageCaption)
    };
}

export const legendaryEarthBeastEntries: LegendaryEarthBeast[] = [
    createBeast({
        slug: "sinai-dragon",
        legendaryFormName: "Sinai Dragon",
        displayName: "Egyptian Spiny-tailed Lizard",
        scientificName: "Uromastyx aegyptia",
        speciesSlug: "spiny-tailed-lizard",
        captureSite: "Dragon Head Mountain / Dragon Eye Rock, South Sinai, Egypt",
        region: "South Sinai, Egypt",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Desert Ember Eye",
        lesson: "Conserve energy before the desert tests you.",
        bestFor: ["Resilience", "Self-Regulation", "Long-Term Endurance"],
        imageDirection: "tan sandstone lizard-dragon, spiny tail, glowing cave eye, dry desert wind, ancient mountain silhouette.",
        imageAlt: "Sinai Dragon — a sandstone desert dragon-lizard with a glowing cave-like eye, wind-carved scales, and a South Sinai desert background",
        imageCaption: "Sinai Dragon",
        launchPriority: 2,
        searchIntents: [
            "dragon head mountain egypt",
            "dragon eye rock sinai",
            "rocks that look like dragons",
            "sinai dragon rock formation",
            "egyptian spiny tailed lizard"
        ],
        quickAnswer: "Sinai Dragon is a Geo-Legendary Earth Beast inspired by Dragon Head Mountain in South Sinai, Egypt, where wind-carved sandstone resembles a dragon's head with a glowing cave \"eye.\" The real species anchor is the Egyptian Spiny-tailed Lizard.",
        placeStory: [
            "Dragon Head Mountain in South Sinai became famous because its natural rock shape resembles a dragon's head. The glowing eye effect is commonly explained as firelight or campfire light shining from a cave inside the formation, which makes the mountain look alive at night.",
            "One Sinai hiking guide identifies the formation as Mount El-Makharom, locally called Dragon Head Mountain because a natural opening near the summit resembles a dragon's mouth rather than because of an ancient dragon legend."
        ],
        biologyAnchor: [
            "For AnimalDex, the best real-species anchor is the Egyptian Spiny-tailed Lizard. It is desert-adapted, armored-looking, and naturally dragon-like without inventing a fictional species.",
            "Its spiny tail, burrow habits, and heat-tolerant body make it a strong biological match for a desert formation that looks mythic but remains grounded in real ecology."
        ],
        faq: [
            {
                question: "Is Dragon Head Mountain a real fossilized dragon?",
                answer: "No. It is a natural sandstone formation shaped by erosion. The dragon resemblance comes from pareidolia and local naming, not from a literal fossilized animal."
            },
            {
                question: "What animal anchors the Sinai Dragon in AnimalDex?",
                answer: "The Egyptian Spiny-tailed Lizard (Uromastyx aegyptia), a desert reptile with armored scales and a spiny tail."
            },
            {
                question: "Why is Sinai Dragon Geo-Legendary rather than Mythic Legendary?",
                answer: "The dragon connection is mainly visual. Local guides emphasize the rock shape and cave opening more than an ancient dragon folklore tradition."
            }
        ],
        sources: [
            {label: "The Times of India — Dragon Head Mountain, South Sinai", href: "https://timesofindia.indiatimes.com/travel/destinations/dragon-head-mountain-in-south-sinai-egypt/articleshow/"}
        ]
    }),
    createBeast({
        slug: "naga-snake",
        legendaryFormName: "Naga Snake",
        displayName: "King Cobra",
        scientificName: "Ophiophagus hannah",
        speciesSlug: "king-cobra",
        captureSite: "Naka Cave, Phu Langka National Park, Bueng Kan, Thailand",
        region: "Bueng Kan, Thailand",
        legendaryType: "Mythic Legendary",
        tier: "S",
        power: "River Guardian",
        lesson: "Give a clear warning before force becomes necessary.",
        bestFor: ["Boundaries", "Presence", "Protective Strength"],
        imageDirection: "giant hooded cobra, Naga crown, stone-scale body, cave shrine atmosphere, sacred water energy.",
        imageAlt: "Naga Snake — a crowned king cobra/Naga serpent with emerald-gold scales, sacred cave texture, and serpent-scale rock patterns",
        imageCaption: "Naga Snake",
        launchPriority: 1,
        searchIntents: [
            "naga snake rock",
            "naka cave thailand",
            "naga cave bueng kan",
            "serpent scale cave thailand",
            "king cobra naga"
        ],
        quickAnswer: "Naga Snake is a Mythic Legendary Earth Beast inspired by Naka Cave in Bueng Kan, Thailand, where rock patterns resemble serpent scales and Naga mythology is central. The real species anchor is the King Cobra.",
        placeStory: [
            "Naka Cave is one of the strongest Legendary Earth Beast inspirations in the world. Thailand's government tourism portal describes it as the legendary Naga realm of Bueng Kan and notes its rock patterns resembling serpent scales.",
            "The cave's visual identity is unusually clear: scale-like stone texture, serpentine curves, and a strong regional Naga tradition make this one of the best launch candidates for AnimalDex."
        ],
        biologyAnchor: [
            "The King Cobra is the perfect biological anchor. It is the world's longest venomous snake, famous for its hooded warning display and rare nest-guarding behavior among snakes.",
            "Its presence feels naturally royal, which fits the Naga imagery while keeping the catalog grounded in a real, searchable species."
        ],
        faq: [
            {
                question: "Is Naka Cave a petrified snake?",
                answer: "No. The serpent appearance comes from natural rock texture and erosion patterns, amplified by Naga folklore and strong visual resemblance."
            },
            {
                question: "Why is Naga Snake the top launch candidate?",
                answer: "Naka Cave combines an unmistakable serpent-scale visual, strong regional mythology, and a species anchor—the King Cobra—that already reads as regal and warning-oriented."
            },
            {
                question: "What is the Naga connection?",
                answer: "In Southeast Asian tradition, Nagas are serpent beings associated with water, protection, and sacred places. Naka Cave is widely framed through that lens in regional tourism and local storytelling."
            }
        ],
        sources: [
            {label: "SAWASDEE THAILAND — Naka Cave, Bueng Kan", href: "https://www.tourismthailand.org/Attraction/naka-cave"}
        ]
    }),
    createBeast({
        slug: "jeju-dragon-head",
        legendaryFormName: "Jeju Dragon Head",
        displayName: "Korean Rat Snake",
        scientificName: "Elaphe anomala",
        speciesSlug: "korean-rat-snake",
        captureSite: "Yongduam Rock, Jeju Island, South Korea",
        region: "Jeju Island, South Korea",
        legendaryType: "Mythic Legendary",
        tier: "S",
        power: "Tide Breath",
        lesson: "Adapt your route to the terrain.",
        bestFor: ["Adaptability", "Agility", "Sharp Observation"],
        imageDirection: "volcanic black serpent, wave-splashed head, glowing blue sea mist, jagged Jeju coastline.",
        imageAlt: "Jeju Dragon Head — a black volcanic sea-serpent rising from ocean waves with a dragon-head profile",
        imageCaption: "Jeju Dragon Head",
        launchPriority: 3,
        searchIntents: [
            "yongduam rock jeju",
            "dragon head rock korea",
            "jeju dragon head rock",
            "korean rat snake",
            "volcanic dragon rock korea"
        ],
        quickAnswer: "Jeju Dragon Head is a Mythic Legendary Earth Beast inspired by Yongduam Rock on Jeju Island, a volcanic coastal formation said to resemble a dragon's head. The real species anchor is the Korean Rat Snake.",
        placeStory: [
            "Yongduam means Dragon Head Rock. It is a volcanic coastal rock formation on Jeju Island that resembles a dragon's head, and local versions of the story describe a dragon or serpent-like being frozen into rock near the sea.",
            "Travel sources describe the myth as a dragon struck down while trying to take a sacred jade stone from Mount Halla."
        ],
        biologyAnchor: [
            "The Korean Rat Snake gives the entry a real regional serpent base while leaving room for dragon-inspired artwork.",
            "As a native Jeju-area reptile, it keeps the legendary form tied to the landscape's actual fauna rather than a generic fantasy serpent."
        ],
        faq: [
            {
                question: "What does Yongduam mean?",
                answer: "Yongduam translates to Dragon Head Rock, referring to the formation's profile above the sea."
            },
            {
                question: "Is Yongduam a fossilized dragon?",
                answer: "No. It is volcanic rock shaped by coastal erosion. The dragon story is mythic interpretation layered onto a dramatic natural silhouette."
            }
        ],
        sources: [
            {label: "Klook Travel — Yongduam Dragon Head Rock, Jeju", href: "https://www.klook.com/activity/"}
        ]
    }),
    createBeast({
        slug: "stone-dragon",
        legendaryFormName: "Stone Dragon",
        displayName: "Komodo Dragon",
        scientificName: "Varanus komodoensis",
        speciesSlug: "komodo-dragon",
        captureSite: "Dragon-like desert, canyon, and volcanic rock formations worldwide",
        region: "Worldwide",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Apex Patience",
        lesson: "Wait until the moment gives strength its full weight.",
        bestFor: ["Right Timing", "Dominance", "Discipline"],
        imageDirection: "huge monitor lizard with cracked stone scales, volcanic cliffs, canyon dust, sleeping-dragon posture.",
        imageAlt: "Stone Dragon — a massive Komodo dragon made of basalt and desert stone, lying like a sleeping mountain",
        imageCaption: "Stone Dragon",
        searchIntents: [
            "dragon shaped rocks",
            "stone dragon formation",
            "rocks that look like dragons",
            "komodo dragon legendary",
            "reptile shaped mountains"
        ],
        quickAnswer: "Stone Dragon is a Geo-Legendary Earth Beast for dramatic dragon-like rock formations worldwide, anchored to the Komodo Dragon—the largest living lizard and the strongest real-species match for stone-dragon imagery.",
        placeStory: [
            "Not every dragon-shaped rock has a documented ancient dragon myth. Some are simply huge, dramatic formations where the land looks reptilian.",
            "That still works for AnimalDex if the entry is honest: Geo-Legendary, not myth-backed. The power comes from shape, scale, and the way erosion turns cliffs into sleeping reptiles."
        ],
        biologyAnchor: [
            "The Komodo Dragon is the strongest real-species anchor for any general stone dragon entry. It is the largest living lizard and already carries the word dragon in its common name.",
            "Its patient ambush ecology—waiting, watching, striking only when leverage is real—maps cleanly onto a sleeping-mountain dragon form."
        ],
        faq: [
            {
                question: "Does Stone Dragon refer to one specific place?",
                answer: "No. It is a template entry for visually dragon-like formations across deserts, canyons, and volcanic landscapes where no single myth dominates."
            },
            {
                question: "Why use Komodo Dragon instead of a fictional dragon species?",
                answer: "AnimalDex anchors legendary forms to real animals with scientific names. Komodo dragons already look and behave like living dragons."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "monkey-pillar",
        legendaryFormName: "Monkey Pillar",
        displayName: "Japanese Macaque",
        scientificName: "Macaca fuscata",
        speciesSlug: "japanese-macaque",
        captureSite: "Saruiwa / Monkey Rock, Iki Island, Nagasaki, Japan",
        region: "Iki Island, Japan",
        legendaryType: "Mythic Legendary",
        tier: "S",
        power: "Island Anchor",
        lesson: "Read the group before choosing your move.",
        bestFor: ["Teamwork", "Sharp Observation", "Adaptability"],
        imageDirection: "weathered stone macaque, island sunset, sea cliffs, guardian-pillar pose.",
        imageAlt: "Monkey Pillar — a stone Japanese macaque guardian sitting by the sea, shaped like a natural rock pillar",
        imageCaption: "Monkey Pillar",
        launchPriority: 4,
        searchIntents: [
            "saruiwa monkey rock",
            "monkey rock iki island",
            "japanese macaque rock formation",
            "monkey pillar japan",
            "rocks that look like monkeys"
        ],
        quickAnswer: "Monkey Pillar is a Mythic Legendary Earth Beast inspired by Saruiwa on Iki Island, Japan—a natural rock that looks like a monkey and appears in local legend as a divine island anchor. The species anchor is the Japanese Macaque.",
        placeStory: [
            "Saruiwa, or Monkey Rock, is a naturally formed rock on Iki Island that looks like a monkey facing away.",
            "Discover Nagasaki says it appears in legend and is said to be a pillar built by the gods so Iki Island would not be washed away."
        ],
        biologyAnchor: [
            "The Japanese Macaque is the best species anchor because it is native to Japan and has strong social intelligence, seasonal adaptability, and expressive behavior.",
            "Macaque social reading—watching the group before acting—maps directly onto the pillar guardian lesson."
        ],
        faq: [
            {
                question: "Where is Monkey Rock located?",
                answer: "On Iki Island in Nagasaki Prefecture, Japan, where Saruiwa overlooks the sea."
            },
            {
                question: "Is Saruiwa a carved statue?",
                answer: "No. It is a natural rock formation. The monkey resemblance and guardian legend are layered onto an eroded coastal pillar."
            }
        ],
        sources: [
            {label: "Discover Nagasaki — Saruiwa Monkey Rock", href: "https://www.discover-nagasaki.com/"}
        ]
    }),
    createBeast({
        slug: "great-bear-claw-guardian",
        legendaryFormName: "Great Bear Claw Guardian",
        displayName: "Brown Bear",
        scientificName: "Ursus arctos",
        speciesSlug: "brown-bear",
        captureSite: "Devils Tower / Bear Lodge, Wyoming, USA",
        region: "Wyoming, USA",
        legendaryType: "Mythic Legendary",
        tier: "S",
        power: "Sky Bear Claw",
        lesson: "Protect the boundary without chasing every threat.",
        bestFor: ["Protective Strength", "Boundaries", "Presence"],
        imageDirection: "huge brown bear, vertical claw-mark stone armor, prairie sky, respectful sacred-ground tone.",
        imageAlt: "Great Bear Claw Guardian — a massive brown bear spirit with stone-claw markings rising beside a tall sacred tower",
        imageCaption: "Great Bear Claw Guardian",
        launchPriority: 5,
        respectfulCaptureNote: "Devils Tower is sacred to multiple Native nations and is widely known as Bear Lodge. AnimalDex should celebrate the story respectfully, avoid loot or defeat language, and never encourage climbing, trespassing, or disturbing ceremonies. Captures should come from public viewpoints only.",
        searchIntents: [
            "devils tower bear legend",
            "bear lodge wyoming",
            "devils tower native stories",
            "rocks that look like bear claws",
            "brown bear sacred site"
        ],
        quickAnswer: "Great Bear Claw Guardian is a Mythic Legendary Earth Beast inspired by Devils Tower / Bear Lodge in Wyoming, where Native traditions connect the tower's vertical marks to bear stories. The species anchor is the Brown Bear. This entry must be handled with cultural respect.",
        placeStory: [
            "Devils Tower is one of the most sensitive and powerful entries on this list. The National Park Service publishes Native stories connected to the site, including bear narratives explaining the tower's striking vertical marks.",
            "The site is also widely known as Bear Lodge in several Native traditions."
        ],
        biologyAnchor: [
            "The Brown Bear anchors the entry biologically: territorial boundary defense, protective presence, and the choice not to chase every provocation.",
            "Because this site has living cultural and sacred significance, AnimalDex should treat it respectfully. Do not frame it as a loot gimmick. Do not encourage climbing, trespassing, or disturbing ceremonies."
        ],
        faq: [
            {
                question: "Is Devils Tower called Bear Lodge?",
                answer: "Yes, in several Native traditions. Bear stories are part of how the tower's striking vertical marks are understood and taught."
            },
            {
                question: "Should visitors climb Devils Tower for an AnimalDex capture?",
                answer: "No. AnimalDex should require respectful captures from public paths and viewpoints, and should not encourage climbing or disturbing sacred ground."
            },
            {
                question: "Why is this a sensitive Legendary Earth Beast?",
                answer: "The site carries living cultural meaning for multiple Native nations. Educational copy should honor that context rather than treating the tower like a game objective."
            }
        ],
        sources: [
            {label: "National Park Service — Devils Tower stories and history", href: "https://www.nps.gov/deto/learn/historyculture/"}
        ]
    }),
    createBeast({
        slug: "royal-lion-rock",
        legendaryFormName: "Royal Lion Rock",
        displayName: "African Lion",
        scientificName: "Panthera leo",
        speciesSlug: "lion",
        captureSite: "Sigiriya / Lion Rock, Sri Lanka",
        region: "Sri Lanka",
        legendaryType: "Cultural Legendary",
        tier: "S",
        power: "Sky Fortress Roar",
        lesson: "Leadership is strongest when power protects the group.",
        bestFor: ["Leadership", "Courage", "Protective Strength"],
        imageDirection: "stone lion with golden mane, cliff fortress, ancient paws, royal jungle atmosphere.",
        imageAlt: "Royal Lion Rock — a golden lion fortress guardian with ancient stone paws and jungle cliffs",
        imageCaption: "Royal Lion Rock",
        launchPriority: 8,
        searchIntents: [
            "sigiriya lion rock",
            "lion rock sri lanka",
            "ancient lion fortress sri lanka",
            "african lion symbolism rock",
            "cultural legendary earth beast"
        ],
        quickAnswer: "Royal Lion Rock is a Cultural Legendary Earth Beast inspired by Sigiriya in Sri Lanka, an ancient fortress associated with a monumental lion gateway. The species anchor is the African Lion.",
        placeStory: [
            "Sigiriya is an ancient rock fortress in Sri Lanka. Its name is associated with Lion Rock, and historical descriptions explain that a gateway in the form of a huge lion once marked the ascent, with the famous lion paws still surviving.",
            "The site is also recognized as a UNESCO World Heritage site."
        ],
        biologyAnchor: [
            "The African Lion is the strongest global lion anchor for AnimalDex because its biology naturally supports dominance, leadership, pride structure, and territorial power.",
            "Here the lion is cultural and architectural as much as geological—the paws remain even where the full body once stood."
        ],
        faq: [
            {
                question: "Are the Sigiriya lion paws still visible?",
                answer: "Yes. The famous stone lion paws remain at the base of the ascent, even though the full lion gateway no longer survives intact."
            },
            {
                question: "Why is this Cultural Legendary rather than Geo-Legendary?",
                answer: "The lion identity comes from deliberate ancient architecture and historical naming, not only from a naturally lion-shaped cliff."
            }
        ],
        sources: [
            {label: "UNESCO World Heritage Centre — Ancient City of Sigiriya", href: "https://whc.unesco.org/en/list/202"}
        ]
    }),
    createBeast({
        slug: "sky-tigress",
        legendaryFormName: "Sky Tigress",
        displayName: "Bengal Tiger",
        scientificName: "Panthera tigris",
        speciesSlug: "bengal-tiger",
        captureSite: "Paro Taktsang / Tiger's Nest, Bhutan",
        region: "Bhutan",
        legendaryType: "Mythic Legendary",
        tier: "S",
        power: "Silent Ascent",
        lesson: "Solitude becomes power when every step serves the same aim.",
        bestFor: ["Focus", "Courage", "Healthy Independence"],
        imageDirection: "cliff-shadow tiger, high mountain monastery, mist, orange-black stripes, sacred ascent.",
        imageAlt: "Sky Tigress — a tiger spirit climbing a cliffside monastery path through mist and prayer flags",
        imageCaption: "Sky Tigress",
        searchIntents: [
            "tigers nest bhutan",
            "paro taktsang tiger legend",
            "tiger monastery bhutan",
            "bengal tiger symbolism",
            "mythic legendary earth beast"
        ],
        quickAnswer: "Sky Tigress is a Mythic Legendary Earth Beast inspired by Tiger's Nest in Bhutan, where Guru Rinpoche is said to have arrived on a tigress. The species anchor is the Bengal Tiger.",
        placeStory: [
            "Tiger's Nest is not a tiger-shaped rock in the same way Naka Cave is serpent-like, but it is one of the best myth-backed animal place entries.",
            "The site is associated with the story of Guru Rinpoche arriving on the back of a tigress, making the tiger symbolism central to the place's identity."
        ],
        biologyAnchor: [
            "The Bengal Tiger is the best species anchor: solitary, powerful, stealthy, and strongly tied to South Asian landscapes.",
            "Its lesson here is focus under elevation—each step on a difficult path must serve one aim."
        ],
        faq: [
            {
                question: "Is Tiger's Nest shaped like a tiger?",
                answer: "Not in the same visual way as serpent-scale caves or elephant rocks. The tiger connection is mythic and symbolic, centered on the tigress story."
            },
            {
                question: "Why include a place that is not obviously animal-shaped?",
                answer: "AnimalDex Legendary Earth Beasts can be myth-backed when the animal identity is central to how people understand and remember the place."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "troll-rhino-beast",
        legendaryFormName: "Troll Rhino Beast",
        displayName: "Indian Rhinoceros",
        scientificName: "Rhinoceros unicornis",
        speciesSlug: "indian-rhinoceros",
        captureSite: "Hvítserkur, Vatnsnes Peninsula, Iceland",
        region: "Iceland",
        legendaryType: "Mythic / Geo-Legendary",
        tier: "S",
        power: "Dawn Curse",
        lesson: "Direction matters more than speed when your presence has weight.",
        bestFor: ["Presence", "Defense", "Resilience"],
        imageDirection: "basalt rhino, sea spray, troll-stone skin, northern light, frozen dawn.",
        imageAlt: "Troll Rhino Beast — a basalt rhino-like sea creature standing in cold Icelandic water under a pale sky",
        imageCaption: "Troll Rhino Beast",
        searchIntents: [
            "hvítserkur iceland",
            "rhino rock iceland",
            "troll rock iceland",
            "sea stack looks like animal",
            "indian rhinoceros legendary"
        ],
        quickAnswer: "Troll Rhino Beast is a Mythic / Geo-Legendary Earth Beast inspired by Hvítserkur in Iceland, a basalt sea stack often compared to a rhino and wrapped in troll-turned-to-stone folklore. The species anchor is the Indian Rhinoceros.",
        placeStory: [
            "Hvítserkur is a sea stack in Iceland often compared to a rhino, dragon, elephant, or drinking beast.",
            "It is also wrapped in Icelandic troll folklore: one popular story says it was a troll turned to stone by sunrise."
        ],
        biologyAnchor: [
            "The Indian Rhinoceros is a strong visual anchor because the sea stack's stance often reads like a horned, heavy-bodied creature drinking from the ocean.",
            "Its lesson emphasizes presence and direction over speed—useful for a formation that stands still while the sea moves around it."
        ],
        faq: [
            {
                question: "What does Hvítserkur look like?",
                answer: "Visitors often read it as a rhino, dragon, elephant, or drinking beast depending on angle and tide."
            },
            {
                question: "What is the troll story?",
                answer: "A common Icelandic folk version says the stack was a troll caught by sunrise and frozen into stone."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "stone-whale-pod",
        legendaryFormName: "Stone Whale Pod",
        displayName: "Sperm Whale",
        scientificName: "Physeter macrocephalus",
        speciesSlug: "sperm-whale",
        captureSite: "Three Whale Rock / Hin Sam Wan, Bueng Kan, Thailand",
        region: "Bueng Kan, Thailand",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Forest Ocean",
        lesson: "Send a clear signal before entering deep pressure.",
        bestFor: ["Clear Communication", "Long-Term Endurance", "Focus"],
        imageDirection: "mossy whale backs, forest canopy as green ocean, ancient sandstone, pod formation.",
        imageAlt: "Stone Whale Pod — three mossy sandstone whales swimming through a green forest canopy",
        imageCaption: "Stone Whale Pod",
        launchPriority: 9,
        searchIntents: [
            "three whale rock thailand",
            "hin sam wan",
            "whale shaped rocks",
            "forest whale rock formation",
            "sperm whale legendary"
        ],
        quickAnswer: "Stone Whale Pod is a Geo-Legendary Earth Beast inspired by Three Whale Rock in Bueng Kan, Thailand, where three sandstone ridges resemble whales moving through forest. The species anchor is the Sperm Whale.",
        placeStory: [
            "Three Whale Rock, or Hin Sam Wan, is a formation in Thailand where three large sandstone ridges resemble a family of whales moving through the forest.",
            "It is not strongly myth-backed, but visually it is one of the best animal-shaped landscapes for a Legendary Earth Beast."
        ],
        biologyAnchor: [
            "The Sperm Whale gives the entry huge size, intelligence, depth, sound, and ancient-ocean energy.",
            "Its deep-diving ecology maps onto the lesson of signaling before entering pressure—whether that pressure is ocean depth or a hard decision."
        ],
        faq: [
            {
                question: "Where is Three Whale Rock?",
                answer: "In Bueng Kan Province, Thailand—the same region as Naka Cave, making it a strong regional Legendary Earth Beast pair."
            },
            {
                question: "Are the whales fossilized?",
                answer: "No. They are sandstone ridges shaped by erosion, with a remarkably clear pod silhouette above the forest."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "alula-sand-elephant",
        legendaryFormName: "AlUla Sand Elephant",
        displayName: "African Bush Elephant",
        scientificName: "Loxodonta africana",
        speciesSlug: "african-bush-elephant",
        captureSite: "Elephant Rock / Jabal AlFil, AlUla, Saudi Arabia",
        region: "AlUla, Saudi Arabia",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Desert Memory",
        lesson: "Carry experience like a map, not a weight.",
        bestFor: ["Long-Term Endurance", "Leadership", "Teamwork"],
        imageDirection: "sandstone elephant, desert stars, golden sunset, ancient travel route energy.",
        imageAlt: "AlUla Sand Elephant — a giant sandstone elephant walking through golden desert at sunset",
        imageCaption: "AlUla Sand Elephant",
        launchPriority: 7,
        searchIntents: [
            "elephant rock alula",
            "jabal alfil",
            "sandstone elephant saudi arabia",
            "animal shaped desert rocks",
            "african bush elephant legendary"
        ],
        quickAnswer: "AlUla Sand Elephant is a Geo-Legendary Earth Beast inspired by Elephant Rock in AlUla, Saudi Arabia—one of the cleanest animal-rock silhouettes in the world. The species anchor is the African Bush Elephant.",
        placeStory: [
            "Elephant Rock in AlUla is one of the cleanest animal-rock formations in the world.",
            "Experience AlUla describes it as a 52-metre natural monument rising from the desert, sculpted by time and the elements."
        ],
        biologyAnchor: [
            "The African Bush Elephant fits because it is the largest living land animal and carries powerful associations with memory, family leadership, and long-distance movement.",
            "Desert memory here is not mysticism—it is the strategic value of remembering routes, water, and seasonal patterns."
        ],
        faq: [
            {
                question: "How tall is Elephant Rock in AlUla?",
                answer: "Experience AlUla describes it as about 52 metres high, making it one of the most dramatic animal-shaped monuments on the list."
            },
            {
                question: "Why is this one of the best launch beasts?",
                answer: "The silhouette is unusually clean, the species anchor is instantly recognizable, and the desert setting makes for strong generated art."
            }
        ],
        sources: [
            {label: "Experience AlUla — Elephant Rock (Jabal AlFil)", href: "https://www.experiencealula.com/en/places-to-visit/elephant-rock"}
        ]
    }),
    createBeast({
        slug: "fairy-tomb-elephant",
        legendaryFormName: "Fairy-Tomb Elephant",
        displayName: "Asian Elephant",
        scientificName: "Elephas maximus",
        speciesSlug: "asian-elephant",
        captureSite: "Elephant Rock / Roccia dell'Elefante, Castelsardo, Sardinia, Italy",
        region: "Sardinia, Italy",
        legendaryType: "Cultural / Geo-Legendary",
        tier: "S",
        power: "Fairy House Memory",
        lesson: "Strength becomes easier to trust when it knows how to be gentle.",
        bestFor: ["Protective Strength", "Balance", "Leadership"],
        imageDirection: "weathered elephant boulder, Mediterranean light, ancient doorway carvings, soft but powerful expression.",
        imageAlt: "Fairy-Tomb Elephant — an ancient stone elephant beside Mediterranean cliffs, with subtle carved tomb-door motifs",
        imageCaption: "Fairy-Tomb Elephant",
        searchIntents: [
            "elephant rock sardinia",
            "roccia dell elefante",
            "domus de janas elephant rock",
            "asian elephant legendary",
            "mediterranean animal rock"
        ],
        quickAnswer: "Fairy-Tomb Elephant is a Cultural / Geo-Legendary Earth Beast inspired by Sardinia's Elephant Rock, a natural elephant-shaped formation that also contains ancient domus de janas tombs. The species anchor is the Asian Elephant.",
        placeStory: [
            "Sardinia's Elephant Rock is a natural rock formation shaped like an elephant, and it is especially useful for AnimalDex because it also carries archaeological atmosphere.",
            "The rock contains ancient tombs known as domus de janas, often translated as fairy houses."
        ],
        biologyAnchor: [
            "The Asian Elephant works well here because its field-guide lesson can emphasize gentle strength, memory, and careful power.",
            "This is a rare entry where geology, archaeology, and animal form overlap in one capture site."
        ],
        faq: [
            {
                question: "What are domus de janas?",
                answer: "They are ancient rock-cut tombs in Sardinia, often called fairy houses in folk translation."
            },
            {
                question: "Is the elephant shape natural or carved?",
                answer: "The overall elephant silhouette is natural, while the site also contains human-carved tomb elements."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "steppe-turtle",
        legendaryFormName: "Steppe Turtle",
        displayName: "Russian Tortoise",
        scientificName: "Testudo horsfieldii",
        speciesSlug: "russian-tortoise",
        captureSite: "Turtle Rock / Melkhii Khad, Gorkhi-Terelj National Park, Mongolia",
        region: "Mongolia",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Moving Shelter",
        lesson: "Carry your boundary into every open place.",
        bestFor: ["Patient Progress", "Defense", "Long-Term Endurance"],
        imageDirection: "giant granite turtle, grassland shell, Mongolian sky, slow guardian energy.",
        imageAlt: "Steppe Turtle — a granite tortoise with grassland on its shell, watching over Mongolian steppe",
        imageCaption: "Steppe Turtle",
        launchPriority: 10,
        searchIntents: [
            "turtle rock mongolia",
            "melkhii khad",
            "gorkhi terelj turtle rock",
            "russian tortoise legendary",
            "animal shaped granite rocks"
        ],
        quickAnswer: "Steppe Turtle is a Geo-Legendary Earth Beast inspired by Turtle Rock in Mongolia's Gorkhi-Terelj National Park. The species anchor is the Russian Tortoise.",
        placeStory: [
            "Turtle Rock, also called Melkhii Khad, is a famous turtle-shaped granite formation in Mongolia's Gorkhi-Terelj National Park.",
            "Travel sources describe it as a large rock formation shaped like a turtle and one of the most photographed natural attractions near Ulaanbaatar."
        ],
        biologyAnchor: [
            "The Russian Tortoise is a strong real-species anchor because it is a Central Asian tortoise adapted to dry steppe and semi-desert conditions.",
            "Its lesson—carrying your boundary into open country—fits both the tortoise shell and the granite turtle watching over grassland."
        ],
        faq: [
            {
                question: "Where is Turtle Rock in Mongolia?",
                answer: "In Gorkhi-Terelj National Park, northeast of Ulaanbaatar, where Melkhii Khad is a well-known photo stop."
            },
            {
                question: "Why Russian Tortoise for a Mongolian rock?",
                answer: "Testudo horsfieldii is a Central Asian steppe tortoise, making it the closest real-species anchor for the region's dry grassland ecology."
            }
        ],
        sources: [
            {label: "Steppe Mongolia — Turtle Rock, Gorkhi-Terelj", href: "https://www.steppe-mongolia.com/"}
        ]
    }),
    createBeast({
        slug: "nargun-stone-beast",
        legendaryFormName: "Nargun Stone Beast",
        displayName: "Lace Monitor",
        scientificName: "Varanus varius",
        speciesSlug: "lace-monitor",
        captureSite: "Den of Nargun, Mitchell River National Park, Victoria, Australia",
        region: "Victoria, Australia",
        legendaryType: "Mythic Legendary",
        tier: "S",
        power: "Stone-Skin Fear",
        lesson: "Follow evidence before impulse chooses the path.",
        bestFor: ["Sharp Observation", "Strategic Camouflage", "Focus"],
        imageDirection: "lace monitor with stone-scale armor, rainforest gully, cave seen from respectful distance, quiet intensity.",
        imageAlt: "Nargun Stone Beast — a respectful stone-scaled monitor lizard emerging from a rainforest gully, not entering the sacred cave",
        imageCaption: "Nargun Stone Beast",
        launchPriority: 6,
        respectfulCaptureNote: "Parks Victoria and the Gunaikurnai people ask visitors to respect the Den of Nargun and not enter the cave. AnimalDex should keep the Nargun connection educational, use a Lace Monitor as the biological anchor, and require captures from a safe, respectful distance.",
        searchIntents: [
            "den of nargun",
            "nargun victoria australia",
            "lace monitor australia",
            "sacred cave australia animal legend",
            "mythic legendary earth beast"
        ],
        quickAnswer: "Nargun Stone Beast is a Mythic Legendary Earth Beast inspired by the Den of Nargun in Victoria, Australia, where tradition holds that the Nargun—a fierce half-human, half-stone being—lives. The biological anchor is the Lace Monitor. Visitors are asked not to enter the cave.",
        placeStory: [
            "The Den of Nargun is one of the most powerful myth-linked entries here.",
            "Parks Victoria says tradition has it that the Nargun, a fierce half-human, half-stone being, lives there. Parks Victoria and the Gunaikurnai people ask visitors to respect the place and not enter the cave."
        ],
        biologyAnchor: [
            "AnimalDex should treat this entry carefully. The best approach is to use a real Australian reptile, the Lace Monitor, as the biological anchor while keeping the Nargun connection educational and respectful.",
            "Monitor lizards already carry stone-like patterning, alert observation, and camouflage—useful traits for a rainforest gully guardian."
        ],
        faq: [
            {
                question: "Can visitors enter the Den of Nargun?",
                answer: "No. Parks Victoria asks visitors to respect the place and not enter the cave."
            },
            {
                question: "What is the Nargun?",
                answer: "In Gunaikurnai tradition, the Nargun is described as a fierce being associated with the cave. AnimalDex should present this as cultural context, not entertainment loot."
            },
            {
                question: "Why use Lace Monitor as the species anchor?",
                answer: "It keeps the entry grounded in a real Australian reptile while honoring the site's living cultural meaning."
            }
        ],
        sources: [
            {label: "Parks Victoria — Den of Nargun, Mitchell River National Park", href: "https://www.parks.vic.gov.au/places-to-see/parks/mitchell-river-national-park/things-to-do/den-of-nargun"}
        ]
    }),
    createBeast({
        slug: "dragons-back-ridge-serpent",
        legendaryFormName: "Dragon's Back Ridge Serpent",
        displayName: "Chinese Cobra",
        scientificName: "Naja atra",
        speciesSlug: "chinese-cobra",
        captureSite: "Dragon's Back, Hong Kong",
        region: "Hong Kong",
        legendaryType: "Cultural / Geo-Legendary",
        tier: "S",
        power: "Ridge Serpent",
        lesson: "Make the line visible before pressure crosses it.",
        bestFor: ["Boundaries", "Defense", "Presence"],
        imageDirection: "cobra-dragon ridge, green mountains, sea haze, hood shape echoing hill contours.",
        imageAlt: "Dragon's Back Ridge Serpent — a cobra-like dragon flowing along a green mountain ridge above the sea",
        imageCaption: "Dragon's Back Ridge Serpent",
        searchIntents: [
            "dragons back hong kong",
            "dragon's back hike",
            "chinese cobra",
            "serpent ridge landscape",
            "cultural legendary earth beast"
        ],
        quickAnswer: "Dragon's Back Ridge Serpent is a Cultural / Geo-Legendary Earth Beast inspired by Dragon's Back in Hong Kong, a ridge trail whose serpentine name gives the landscape its animal identity. The species anchor is the Chinese Cobra.",
        placeStory: [
            "Dragon's Back in Hong Kong is a ridge trail whose name already gives the landscape a serpentine, dragon-like identity.",
            "This is better treated as a cultural and visual landscape entry rather than a single ancient dragon myth."
        ],
        biologyAnchor: [
            "The Chinese Cobra gives the entry a real regional serpent base with hood display, warning posture, and defensive presence.",
            "Its lesson—make the line visible before pressure crosses it—fits both cobra warning behavior and a ridge that announces itself above the sea."
        ],
        faq: [
            {
                question: "Is Dragon's Back shaped like a cobra?",
                answer: "The ridge reads as serpentine from many viewpoints, and the place name reinforces a dragon-serpent identity even without a single ancient myth dominating the site."
            },
            {
                question: "Why is this Cultural / Geo-Legendary?",
                answer: "The animal identity comes from naming, trail culture, and landscape reading as much as from one fixed folklore story."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "sleeping-sea-lion",
        legendaryFormName: "Sleeping Sea Lion",
        displayName: "Galápagos Sea Lion",
        scientificName: "Zalophus wollebaeki",
        speciesSlug: "galapagos-sea-lion",
        captureSite: "Kicker Rock / León Dormido, Galápagos, Ecuador",
        region: "Galápagos, Ecuador",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Reef Gate",
        lesson: "Rest is stored movement.",
        bestFor: ["Recovery", "Agility", "Balance"],
        imageDirection: "stone sea lion, blue Galápagos water, reef gate, calm surface with hidden speed.",
        imageAlt: "Sleeping Sea Lion — a stone sea lion resting as a split ocean rock, surrounded by blue water and reef life",
        imageCaption: "Sleeping Sea Lion",
        searchIntents: [
            "kicker rock galapagos",
            "leon dormido",
            "sleeping lion rock galapagos",
            "sea lion shaped rock",
            "galapagos animal landmarks"
        ],
        quickAnswer: "Sleeping Sea Lion is a Geo-Legendary Earth Beast inspired by Kicker Rock / León Dormido in the Galápagos, named for a sleeping lion silhouette. The species anchor is the Galápagos Sea Lion.",
        placeStory: [
            "Kicker Rock is also known as León Dormido, meaning Sleeping Lion.",
            "The name makes it a strong AnimalDex fit even though the rock is more of a landmark silhouette than a traditional mythic animal."
        ],
        biologyAnchor: [
            "The Galápagos Sea Lion is the best real-species anchor because it belongs to the Galápagos world and connects the sea-stack idea to real local wildlife.",
            "Sea lions embody stored movement: long rests on rock, then sudden agility in water."
        ],
        faq: [
            {
                question: "Why is it called Sleeping Lion if the anchor is a sea lion?",
                answer: "The local Spanish name León Dormido means Sleeping Lion, but the Galápagos Sea Lion is the stronger biological anchor for AnimalDex because it belongs to the archipelago's real fauna."
            },
            {
                question: "Is Kicker Rock one rock or two?",
                answer: "It is a split sea stack formation rising from the water, which helps create the resting animal silhouette from certain angles."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "stone-shark-fin",
        legendaryFormName: "Stone Shark Fin",
        displayName: "Great White Shark",
        scientificName: "Carcharodon carcharias",
        speciesSlug: "great-white-shark",
        captureSite: "Shark Fin Cove, Davenport, California, USA",
        region: "California, USA",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Apex Signal",
        lesson: "Presence can move first, even before the body does.",
        bestFor: ["Presence", "Precision", "Courage"],
        imageDirection: "dorsal-fin rock, great white spirit, crashing California waves, sharp shadow.",
        imageAlt: "Stone Shark Fin — a great white shark spirit emerging from a sharp coastal rock fin",
        imageCaption: "Stone Shark Fin",
        searchIntents: [
            "shark fin cove california",
            "shark fin rock davenport",
            "coastal rocks that look like sharks",
            "great white shark legendary",
            "dorsal fin rock formation"
        ],
        quickAnswer: "Stone Shark Fin is a Geo-Legendary Earth Beast inspired by Shark Fin Cove in California, where a coastal rock resembles a shark fin. The species anchor is the Great White Shark.",
        placeStory: [
            "Shark Fin Cove is named for a coastal rock that resembles a shark fin.",
            "It does not need an ancient myth to work; the shape is clear, memorable, and instantly image-generatable."
        ],
        biologyAnchor: [
            "The Great White Shark gives the entry dominance, speed, sensory precision, and one of the most recognizable animal silhouettes in the world.",
            "A dorsal fin often signals presence before the body arrives—hence the lesson and the power name Apex Signal."
        ],
        faq: [
            {
                question: "Where is Shark Fin Cove?",
                answer: "Near Davenport on the California coast, where the fin-shaped rock gives the cove its name."
            },
            {
                question: "Is the rock an actual fossilized shark?",
                answer: "No. It is a coastal rock formation whose silhouette reads as a dorsal fin."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "desert-camel-sentinel",
        legendaryFormName: "Desert Camel Sentinel",
        displayName: "Bactrian Camel",
        scientificName: "Camelus bactrianus",
        speciesSlug: "bactrian-camel",
        captureSite: "Camel Rock formations, including Devrent Valley in Cappadocia and Camel Rock in New Mexico",
        region: "Worldwide deserts",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Reserve March",
        lesson: "Build reserves before the road becomes empty.",
        bestFor: ["Preparation", "Long-Term Endurance", "Resilience"],
        imageDirection: "two-humped sandstone camel, desert caravan mood, stars, dry wind, ancient route.",
        imageAlt: "Desert Camel Sentinel — a two-humped camel made of wind-carved sandstone, carrying stars and dunes on its back",
        imageCaption: "Desert Camel Sentinel",
        searchIntents: [
            "camel rock formation",
            "devrent valley camel rock",
            "rocks that look like camels",
            "bactrian camel legendary",
            "desert animal shaped rocks"
        ],
        quickAnswer: "Desert Camel Sentinel is a Geo-Legendary Earth Beast for camel-shaped desert rocks worldwide, anchored to the Bactrian Camel and its two-humped silhouette built for reserves and distance.",
        placeStory: [
            "Camel-shaped rocks appear in several desert landscapes, including Devrent Valley in Cappadocia and Camel Rock in New Mexico.",
            "They are usually visual rather than myth-backed, but camels are perfect Legendary Earth Beast material because the animal itself is built around endurance, reserves, heat, and distance."
        ],
        biologyAnchor: [
            "The Bactrian Camel, with its two humps and cold-desert adaptations, gives the design a stronger silhouette than a one-humped camel.",
            "Its lesson is preparation: reserves before the road empties."
        ],
        faq: [
            {
                question: "Does this entry refer to one camel rock?",
                answer: "No. It is a template for multiple camel-shaped desert formations where the silhouette is visual rather than myth-backed."
            },
            {
                question: "Why Bactrian Camel instead of dromedary?",
                answer: "The two-humped silhouette reads more clearly on wind-carved sandstone and strengthens the visual identity of the legendary form."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "coastal-seal-stone",
        legendaryFormName: "Coastal Seal Stone",
        displayName: "New Zealand Fur Seal",
        scientificName: "Arctocephalus forsteri",
        speciesSlug: "new-zealand-fur-seal",
        captureSite: "Seal-shaped coastal rocks, including Jialeshui animal formations in Taiwan",
        region: "Coastal worldwide",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Element Switch",
        lesson: "Know which environment unlocks your best movement.",
        bestFor: ["Adaptability", "Agility", "Balance"],
        imageDirection: "sleek seal made of dark wet stone, tide pools, moonlit water, transition from rock to motion.",
        imageAlt: "Coastal Seal Stone — a wet basalt seal guardian half on land, half in waves",
        imageCaption: "Coastal Seal Stone",
        searchIntents: [
            "seal shaped rocks",
            "jialeshui taiwan animal rocks",
            "coastal rocks that look like seals",
            "new zealand fur seal",
            "animal rock formations coast"
        ],
        quickAnswer: "Coastal Seal Stone is a Geo-Legendary Earth Beast for seal-shaped coastal rocks worldwide, anchored to the New Zealand Fur Seal and the contrast between awkward land rest and elegant water movement.",
        placeStory: [
            "Many coastlines have seal-shaped rocks because seals already look like smooth, wave-polished stone when resting.",
            "This works well as a Geo-Legendary entry that celebrates the way the same animal can seem awkward on land and elegant in water."
        ],
        biologyAnchor: [
            "The New Zealand Fur Seal gives the entry a real species with strong land-water contrast.",
            "Its lesson—know which environment unlocks your best movement—maps onto tide pools, haul-outs, and sudden dives."
        ],
        faq: [
            {
                question: "Why are seal-shaped rocks common?",
                answer: "Seals naturally resemble smooth coastal boulders when hauled out, so erosion and pareidolia often meet an animal that already looks like stone."
            },
            {
                question: "Is this tied to one location?",
                answer: "The entry can include examples such as Jialeshui in Taiwan, but it is designed for seal-shaped coastal rocks more broadly."
            }
        ],
        sources: []
    }),
    createBeast({
        slug: "rain-frog-stone",
        legendaryFormName: "Rain Frog Stone",
        displayName: "Australian Green Tree Frog",
        scientificName: "Ranoidea caerulea",
        speciesSlug: "australian-green-tree-frog",
        captureSite: "Frog Rock formations, including Frog Rock near Mudgee, New South Wales, Australia",
        region: "Australia",
        legendaryType: "Geo-Legendary",
        tier: "S",
        power: "Rain Timing",
        lesson: "Wait for the conditions that make action natural.",
        bestFor: ["Right Timing", "Stillness", "Adaptability"],
        imageDirection: "plump green frog, stone flecks, wet rainforest rock, glowing rain eyes, patient crouch.",
        imageAlt: "Rain Frog Stone — a giant green frog with stone markings, wet eyes, and rain-polished rock skin",
        imageCaption: "Rain Frog Stone",
        searchIntents: [
            "frog rock australia",
            "frog rock mudgee",
            "rocks that look like frogs",
            "australian green tree frog",
            "rain frog legendary"
        ],
        quickAnswer: "Rain Frog Stone is a Geo-Legendary Earth Beast inspired by frog-shaped rocks such as Frog Rock near Mudgee, Australia. The species anchor is the Australian Green Tree Frog.",
        placeStory: [
            "Frog-shaped rocks are common because a crouching frog has a simple, recognizable silhouette: low body, raised eyes, folded legs.",
            "Frog Rock near Mudgee, New South Wales, is one well-known example in Australia."
        ],
        biologyAnchor: [
            "For AnimalDex, the Australian Green Tree Frog is a better anchor than a generic frog because it gives the entry a specific species, strong visual appeal, and a clear lesson around rain, timing, and stillness.",
            "Tree frogs often wait for humidity and rain before moving with full confidence—matching the Rain Timing power."
        ],
        faq: [
            {
                question: "Why are frog rocks common?",
                answer: "A crouching frog has a simple, readable silhouette that erosion and pareidolia easily echo in boulders and outcrops."
            },
            {
                question: "What is the Rain Timing lesson?",
                answer: "Action works best when conditions support it—stillness until the rain, then natural movement."
            }
        ],
        sources: []
    })
];

export function getLegendaryEarthBeast(slug: string) {
    return legendaryEarthBeastEntries.find((entry) => entry.slug === slug);
}

export function getRelatedLegendaryEarthBeasts(slug: string, limit = 3) {
    const current = getLegendaryEarthBeast(slug);

    if (!current) {
        return [];
    }

    return legendaryEarthBeastEntries
        .filter((entry) => entry.slug !== slug)
        .map((entry) => {
            const sharedRegion = entry.region === current.region ? 3 : 0;
            const sharedType = entry.legendaryType === current.legendaryType ? 2 : 0;
            const launchNeighbor = current.launchPriority && entry.launchPriority
                ? Math.max(0, 2 - Math.abs(current.launchPriority - entry.launchPriority))
                : 0;

            return {
                entry,
                score: sharedRegion + sharedType + launchNeighbor
            };
        })
        .sort((a, b) => b.score - a.score || a.entry.legendaryFormName.localeCompare(b.entry.legendaryFormName))
        .slice(0, limit)
        .map(({entry}) => entry);
}

export function getLaunchPriorityLegendaryEarthBeasts(limit = 10) {
    return legendaryEarthBeastEntries
        .filter((entry) => entry.launchPriority)
        .sort((a, b) => (a.launchPriority || 99) - (b.launchPriority || 99))
        .slice(0, limit);
}

const legendaryEarthBeastSlugs = new Set(legendaryEarthBeastEntries.map((entry) => entry.slug));

export function isLegendaryEarthBeastSpeciesSlug(slug: string | null | undefined) {
    if (!slug) {
        return false;
    }

    return legendaryEarthBeastSlugs.has(slug.trim().toLowerCase());
}

/** @deprecated Use getLegendaryEarthBeast(slug) — legendary beasts are catalog species keyed by beast slug. */
export function getLegendaryEarthBeastForSpeciesSlug(slug: string | null | undefined) {
    if (!slug) {
        return null;
    }

    return getLegendaryEarthBeast(slug);
}

export const LEGENDARY_EARTH_BEAST_SPECIES_COUNT = legendaryEarthBeastEntries.length;

export type LegendaryEarthBeastCollectionCard = {
    slug: string;
    legendaryFormName: string;
    displayName: string;
    captureSite: string;
    region: string;
    tier: "S";
    power: string;
    speciesSlug: string | null;
    speciesCaptured: boolean;
    speciesInCatalog: boolean;
    beastHref: string;
    speciesHref: string | null;
};

export function buildLegendaryEarthBeastCollectionCards(
    capturedSlugs: Set<string>,
    catalogSlugs: Set<string>
): LegendaryEarthBeastCollectionCard[] {
    return legendaryEarthBeastEntries.map((beast) => ({
        slug: beast.slug,
        legendaryFormName: beast.legendaryFormName,
        displayName: beast.displayName,
        captureSite: beast.captureSite.split(",")[0]?.trim() || beast.captureSite,
        region: beast.region,
        tier: beast.tier,
        power: beast.power,
        speciesSlug: beast.slug,
        speciesCaptured: capturedSlugs.has(beast.slug),
        speciesInCatalog: catalogSlugs.has(beast.slug),
        beastHref: `${LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH}/${beast.slug}`,
        speciesHref: catalogSlugs.has(beast.slug) ? `/animals/${beast.slug}` : null
    }));
}
