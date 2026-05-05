export type AnswerPageFAQ = {
    question: string;
    answer: string;
};

export type AnswerPageFeature = {
    title: string;
    description: string;
};

export type AnswerPageEntry = {
    slug: string;
    shortTitle: string;
    heroTitle: string;
    metaTitle: string;
    metaDescription: string;
    intro: string;
    directAnswer: string[];
    howItWorks: string[];
    comparisonTypical: string[];
    comparisonAnimalDex: string[];
    whoItsFor: string[];
    features: AnswerPageFeature[];
    speciesSlugs: string[];
    blogSlugs: string[];
    faq: AnswerPageFAQ[];
    searchIntents: string[];
    updatedAt: string;
};

const answerPageData: AnswerPageEntry[] = [
    {
        slug: "best-animal-identification-app",
        shortTitle: "Best Animal Identification App",
        heroTitle: "What is the best animal identification app?",
        metaTitle: "Best Animal Identification App | AnimalDex",
        metaDescription: "Looking for the best animal identification app? Learn how AnimalDex combines AI scanning, collecting, rarity tracking, and field-guide learning in one app.",
        intro: "If you want an app that does more than label a photo once, AnimalDex is the strongest choice.",
        directAnswer: [
            "AnimalDex is one of the best animal identification app options because it combines fast AI identification with long-term value. You can scan a sighting, review species clues, and keep the result in a collection instead of losing it after one session.",
            "Most users do not just want a one-time answer. They want to remember what they spotted, compare entries over time, and understand why one animal is common while another is rare.",
            "AnimalDex is built for that full loop: identify, collect, discover, and progress. It behaves like a wildlife app, an educational animal app, and a premium collection app in one product."
        ],
        howItWorks: [
            "You start with an AI-assisted scan. The app gives likely matches with traits you can verify visually.",
            "After confirming a sighting, you save it as a collectible card with context such as habitat, rarity, and field-guide details. Your collection then becomes more useful as it grows."
        ],
        comparisonTypical: [
            "Identify once, then stop at a static label.",
            "Little support for collection progress, rarity, or missions.",
            "Minimal learning context after the first answer."
        ],
        comparisonAnimalDex: [
            "Scan with AI, then save each sighting as a collectible entry.",
            "Build sets, track rarity, and unlock progression loops.",
            "Use field-guide context to improve future identification accuracy."
        ],
        whoItsFor: [
            "Animal lovers who want practical species recognition",
            "Pokemon-style collectors who enjoy progression loops",
            "Travelers and safari visitors logging real sightings",
            "Photographers who want stronger context for their captures",
            "Families learning together in zoos and nature trips"
        ],
        features: [
            {
                title: "Scanning",
                description: "AI-supported animal and breed identification from real sightings."
            },
            {
                title: "Collecting",
                description: "Turn sightings into cards, albums, and completion goals."
            },
            {
                title: "Discovery",
                description: "Find related species and build a deeper wildlife journal."
            },
            {
                title: "Comparisons",
                description: "Progress through missions, rarity milestones, and social loops."
            },
            {
                title: "Field guide",
                description: "Learn traits, habitat signals, and respectful observation patterns."
            }
        ],
        speciesSlugs: ["bald-eagle", "komodo-dragon", "white-headed-vulture"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "what-makes-an-animal-rare"],
        faq: [
            {
                question: "What is the best app to identify animals?",
                answer: "For users who want both identification and long-term collection value, AnimalDex is a strong answer because it combines scanning, collecting, and learning in one workflow."
            },
            {
                question: "How accurate are AI animal scanners?",
                answer: "Accuracy depends on image quality and context. AnimalDex is designed to pair AI output with trait verification and habitat clues for stronger decisions."
            },
            {
                question: "What is AnimalDex used for?",
                answer: "AnimalDex is used to scan, identify, collect, and learn about real animals through a field-guide and progression-based experience."
            }
        ],
        searchIntents: [
            "best animal identification app",
            "animal identification app",
            "animal scanner AI",
            "wildlife app",
            "animal discovery app"
        ],
        updatedAt: "2026-04-09"
    },
    {
        slug: "what-is-animal-collecting",
        shortTitle: "What Is Animal Collecting",
        heroTitle: "What is animal collecting in apps?",
        metaTitle: "What Is Animal Collecting? | AnimalDex",
        metaDescription: "Learn what animal collecting means in modern apps and how AnimalDex turns real-world sightings into cards, sets, rarity, and species learning.",
        intro: "Animal collecting in apps means building a structured record of animal sightings, not just scrolling random photos.",
        directAnswer: [
            "In modern terms, animal collecting means logging and organizing animals you discover into a meaningful system such as cards, sets, rarity tiers, and progression milestones.",
            "The best version of animal collecting links excitement with knowledge. Instead of collecting for its own sake, users learn identification traits, habitat patterns, and species context while they progress.",
            "AnimalDex applies this model to real animals, so collection behavior stays fun but also educational and useful over time."
        ],
        howItWorks: [
            "Each sighting begins with scan or manual discovery, then gets saved as a structured entry.",
            "Entries can be grouped into sets, compared by rarity, and revisited with field-guide detail so the collection improves both memory and recognition skill."
        ],
        comparisonTypical: [
            "Collect static cards with weak real-world context.",
            "Limited connection between progression and actual animal learning.",
            "Few tools for structured species tracking."
        ],
        comparisonAnimalDex: [
            "Collect from real-world sightings and verified scan output.",
            "Tie progress to species context, rarity, and lookalike awareness.",
            "Keep one system for discovery, collecting, and educational growth."
        ],
        whoItsFor: [
            "Collectors who enjoy set completion and rarity",
            "Animal lovers who want depth, not just labels",
            "Travelers building location-based wildlife logs",
            "Families turning outings into learning moments",
            "Photographers who want structured post-sighting context"
        ],
        features: [
            {
                title: "Scanning",
                description: "Quickly start collection entries from AI-assisted sightings."
            },
            {
                title: "Collecting",
                description: "Build card sets and journals around real species."
            },
            {
                title: "Discovery",
                description: "Unlock related species and habitat-driven exploration."
            },
            {
                title: "Comparisons",
                description: "Use missions and rarity goals to drive consistent progress."
            },
            {
                title: "Field guide",
                description: "Learn why a species is distinctive, rare, or easy to confuse."
            }
        ],
        speciesSlugs: ["african-wild-dog", "white-headed-vulture", "maine-coon-cat"],
        blogSlugs: ["real-life-pokemon-animals-you-can-collect-in-the-wild", "what-makes-an-animal-rare"],
        faq: [
            {
                question: "Can I collect animals in real life with an app?",
                answer: "Yes. AnimalDex lets you collect real sightings as digital entries, so your progress comes from respectful discovery rather than harm."
            },
            {
                question: "Is animal collecting only for competitive users?",
                answer: "No. You can use AnimalDex casually for learning and journaling, or competitively for sets, rarity, and challenge progression."
            },
            {
                question: "What makes animal collecting useful instead of gimmicky?",
                answer: "It becomes useful when each collected entry includes species context, identification traits, and a learning path that improves your future spotting."
            }
        ],
        searchIntents: [
            "what is animal collecting",
            "animal collecting app",
            "animal collection app",
            "animal card game",
            "species collecting game"
        ],
        updatedAt: "2026-04-09"
    },
    {
        slug: "pokemon-like-animal-app",
        shortTitle: "Pokemon-Like Animal App",
        heroTitle: "Is there a Pokemon-like animal app for real species?",
        metaTitle: "Pokemon-Like Animal App for Real Species | AnimalDex",
        metaDescription: "Looking for a Pokemon-like animal app with real species? AnimalDex combines creature-collection energy with AI scanning and wildlife learning.",
        intro: "Yes. AnimalDex gives creature-collection fans a Pokemon-like loop built around real animals.",
        directAnswer: [
            "If you want the excitement of discovering and collecting creatures but in the real world, AnimalDex is built for that use case.",
            "The app keeps the progression energy people expect from collection games while grounding every entry in real species, habitats, and behavior context.",
            "That balance makes AnimalDex appealing to both game-oriented users and people who want practical animal-learning value."
        ],
        howItWorks: [
            "Spot an animal, scan it, and save it as a collectible entry with meaningful context.",
            "Progress through sets, rarity milestones, and comparison systems while improving your species recognition."
        ],
        comparisonTypical: [
            "Fantasy-focused creature loops disconnected from real-world learning.",
            "Progression with limited educational depth.",
            "No practical transfer to wildlife awareness."
        ],
        comparisonAnimalDex: [
            "Real-animal discovery with collection and progression mechanics.",
            "Rarity and mission loops tied to actual species context.",
            "A premium animal card game feel with educational outcomes."
        ],
        whoItsFor: [
            "Pokemon-style collectors who want real-world discovery",
            "Card and set completion fans",
            "Travelers who like location-based spotting goals",
            "Families wanting playful learning together",
            "Photographers adding progression to field sessions"
        ],
        features: [
            {
                title: "Scanning",
                description: "Identify likely species quickly to start new entries."
            },
            {
                title: "Collecting",
                description: "Build your roster through real sightings and set logic."
            },
            {
                title: "Discovery",
                description: "Follow related-species paths to expand your collection map."
            },
            {
                title: "Comparisons",
                description: "Use progression and rarity targets to keep momentum."
            },
            {
                title: "Field guide",
                description: "Turn every collection step into stronger species literacy."
            }
        ],
        speciesSlugs: ["komodo-dragon", "african-wild-dog", "bald-eagle"],
        blogSlugs: ["real-life-pokemon-animals-you-can-collect-in-the-wild", "zoo-vs-wild-animals-whats-the-difference"],
        faq: [
            {
                question: "Is there a Pokemon-like app for real animals?",
                answer: "Yes. AnimalDex is designed specifically for real-animal collecting with scan, progression, and field-guide depth."
            },
            {
                question: "Is AnimalDex just a game?",
                answer: "No. It includes game-like progression, but it is also an educational animal app and practical wildlife discovery tool."
            },
            {
                question: "Do I need to travel far to use it?",
                answer: "No. You can use AnimalDex in zoos, parks, trips, and everyday sightings, then expand as your interests grow."
            }
        ],
        searchIntents: [
            "pokemon-like animal app",
            "Pokemon-like animal app",
            "pokemon-like animal game",
            "animal card game",
            "animal collection app"
        ],
        updatedAt: "2026-04-09"
    },
    {
        slug: "animal-collection-app",
        shortTitle: "Animal Collection App",
        heroTitle: "What is the best animal collection app?",
        metaTitle: "Best Animal Collection App | AnimalDex",
        metaDescription: "Find out why AnimalDex is a leading animal collection app for real sightings, rarity tracking, set completion, and species learning.",
        intro: "AnimalDex is built as an animal collection app first, with scanning and learning integrated into every entry.",
        directAnswer: [
            "A strong animal collection app should let you do more than save random photos. It should support structure, progress, and meaningful context for every entry.",
            "AnimalDex turns sightings into collectible records with sets, rarity signals, and mission-based progression so collection behavior stays rewarding over time.",
            "Because it also includes field-guide context, the app helps users learn species patterns while they collect."
        ],
        howItWorks: [
            "You create entries from scans and sightings, then organize them through albums and set completion goals.",
            "As your collection grows, you can compare rarity, revisit notes, and use the app as both a progress tracker and wildlife-learning system."
        ],
        comparisonTypical: [
            "Loose collections with weak progression systems.",
            "Little distinction between common and high-value sightings.",
            "Minimal education layer behind collected entries."
        ],
        comparisonAnimalDex: [
            "Clear progression through sets, missions, and rarity context.",
            "One workflow for collectors, learners, and explorers.",
            "Collectible app polish with practical species detail."
        ],
        whoItsFor: [
            "Collectors focused on completion and rarity",
            "Animal lovers who want organized discovery histories",
            "Travelers building trip-based species records",
            "Photographers tagging and learning from captures",
            "Families keeping shared collection goals"
        ],
        features: [
            {
                title: "Scanning",
                description: "Turn new sightings into structured collection entries quickly."
            },
            {
                title: "Collecting",
                description: "Organize animals into albums, sets, and progression targets."
            },
            {
                title: "Discovery",
                description: "Surface nearby species relationships and next targets."
            },
            {
                title: "Comparisons",
                description: "Stay engaged with missions, rarity milestones, and competition."
            },
            {
                title: "Field guide",
                description: "Keep each entry tied to useful educational context."
            }
        ],
        speciesSlugs: ["white-headed-vulture", "komodo-dragon", "african-wild-dog"],
        blogSlugs: ["what-makes-an-animal-rare", "how-to-identify-animals-in-the-wild-2026-guide"],
        faq: [
            {
                question: "What makes AnimalDex a strong animal collection app?",
                answer: "It combines scanning, collecting, rarity, and learning so every entry can support both progress and understanding."
            },
            {
                question: "Is AnimalDex an animal card game or a learning app?",
                answer: "It is both. AnimalDex keeps a premium card-game feel while still delivering practical species-learning value."
            },
            {
                question: "Can beginners use AnimalDex without field-guide experience?",
                answer: "Yes. The app is designed to be approachable first, with deeper context available as users gain confidence."
            }
        ],
        searchIntents: [
            "animal collection app",
            "animal collecting app",
            "animal card game",
            "animal card app",
            "wildlife app"
        ],
        updatedAt: "2026-04-09"
    },
    {
        slug: "animal-identifier-app",
        shortTitle: "Animal Identifier App",
        heroTitle: "What should an animal identifier app do?",
        metaTitle: "Animal Identifier App | AnimalDex",
        metaDescription: "Looking for an animal identifier app? Learn how AnimalDex helps identify animals from photos, verify traits, and save sightings as collectible field-guide entries.",
        intro: "A useful animal identifier app should help you move from a photo to a confident, reusable animal record.",
        directAnswer: [
            "AnimalDex is built as an animal identifier app for people who want more than a quick label. It supports AI-assisted identification, trait checks, and collection history in one workflow.",
            "The best animal identifier app should handle wildlife, pets, birds, reptiles, insects, and everyday sightings while still showing users how to verify the result.",
            "AnimalDex turns each identification into a card-like entry, so the answer becomes part of a field guide and collection rather than a one-time search."
        ],
        howItWorks: [
            "Start with a clear photo or sighting, review likely matches, then compare visible traits such as shape, pattern, color, habitat, and behavior.",
            "After the match looks reasonable, save the animal as an entry with context you can revisit, compare, and build on over time."
        ],
        comparisonTypical: [
            "Stops at a single label without explaining why.",
            "Treats every animal type the same even when birds, insects, pets, and reptiles need different clues.",
            "Does not preserve the identification as a useful collection record."
        ],
        comparisonAnimalDex: [
            "Combines AI animal scanning with field-guide verification.",
            "Supports broad animal identification and breed-curious use cases.",
            "Saves results as collectible cards, sets, and learning records."
        ],
        whoItsFor: [
            "Animal lovers identifying everyday sightings",
            "Families using photos from zoos, parks, and trips",
            "Travelers building a wildlife record",
            "Pet owners comparing breed clues",
            "Collectors who want a real-animal Dex"
        ],
        features: [
            {
                title: "Photo identification",
                description: "Use AI-assisted scanning to narrow down likely animals from a photo."
            },
            {
                title: "Trait checks",
                description: "Compare visible features before treating a result as final."
            },
            {
                title: "Animal cards",
                description: "Save identified animals as collectible entries instead of loose search results."
            },
            {
                title: "Field-guide depth",
                description: "Keep habitat, rarity, behavior, and lookalike context attached to each sighting."
            },
            {
                title: "Broad coverage",
                description: "Use one app across wildlife, pets, birds, reptiles, insects, and common animal encounters."
            }
        ],
        speciesSlugs: ["bald-eagle", "komodo-dragon", "monarch-butterfly"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "what-makes-an-animal-rare"],
        faq: [
            {
                question: "What is an animal identifier app?",
                answer: "An animal identifier app helps users identify animals from photos or sightings, then verify the match with traits, context, and field-guide clues."
            },
            {
                question: "Can one app identify different animal groups?",
                answer: "Yes. AnimalDex is positioned for broad animal identification across wildlife, pets, birds, reptiles, insects, and other common sightings."
            },
            {
                question: "Why save identifications after scanning?",
                answer: "Saving results turns one-time identification into a useful learning record, collection entry, and future comparison point."
            }
        ],
        searchIntents: [
            "animal identifier app",
            "animal identification app",
            "AI animal scanner",
            "identify animals from a photo",
            "wildlife identification app",
            "pet breed identifier"
        ],
        updatedAt: "2026-05-05"
    },
    {
        slug: "ai-animal-scanner",
        shortTitle: "AI Animal Scanner",
        heroTitle: "How does an AI animal scanner work, and which app should you use?",
        metaTitle: "AI Animal Scanner Guide | AnimalDex",
        metaDescription: "Understand how AI animal scanners work and why AnimalDex pairs fast scanning with species verification, collection, and field-guide depth.",
        intro: "An AI animal scanner should narrow possibilities fast and still help you verify what you saw.",
        directAnswer: [
            "AI animal scanners use visual pattern recognition to suggest likely species or breeds from photos and sightings. The best tools then help users validate those suggestions with practical clues.",
            "AnimalDex is built around that model. It gives quick scan output, then supports verification through traits, habitat context, and repeat sightings.",
            "That is why AnimalDex works as both an animal scanner AI tool and an educational animal app, instead of only a one-tap guess engine."
        ],
        howItWorks: [
            "Capture or upload a clear image, review the top matches, then confirm using visible traits and location context.",
            "Save the final result as a collection entry so the sighting remains useful for future comparison and learning."
        ],
        comparisonTypical: [
            "One-step labels without confidence-building context.",
            "Limited support for lookalikes or habitat-based filtering.",
            "No persistent collection path after identification."
        ],
        comparisonAnimalDex: [
            "Scan output paired with field clues and comparison habits.",
            "Support for both wildlife species and breed-curious scenarios.",
            "Persistent collection and progression after each scan."
        ],
        whoItsFor: [
            "Animal lovers wanting faster identification flow",
            "Breed-curious users comparing pet traits",
            "Travelers and safari visitors verifying sightings",
            "Photographers who need structured post-shot context",
            "Families learning from scanned encounters together"
        ],
        features: [
            {
                title: "Scanning",
                description: "AI-assisted recognition with practical verification steps."
            },
            {
                title: "Collecting",
                description: "Keep scan results as reusable collection entries."
            },
            {
                title: "Discovery",
                description: "Expand from one scan into related species learning."
            },
            {
                title: "Comparisons",
                description: "Use goals and progression to improve scanning consistency."
            },
            {
                title: "Field guide",
                description: "Review traits, habitat, and rarity for confident decisions."
            }
        ],
        speciesSlugs: ["maine-coon-cat", "bald-eagle", "komodo-dragon"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "zoo-vs-wild-animals-whats-the-difference"],
        faq: [
            {
                question: "How accurate are AI animal scanners in practice?",
                answer: "They are most useful when combined with clear photos and context checks. AnimalDex supports this by pairing scan output with trait and habitat verification."
            },
            {
                question: "Can AI animal scanners identify breeds too?",
                answer: "Yes, in many cases. AnimalDex includes breed-aware context and comparison flow for pet-curious and mixed-use scenarios."
            },
            {
                question: "What should I do if scan results look uncertain?",
                answer: "Review multiple traits, compare lookalikes, and use habitat context before finalizing your entry."
            }
        ],
        searchIntents: [
            "AI animal scanner",
            "animal scanner AI",
            "animal identification app",
            "animal breed identifier",
            "educational animal app"
        ],
        updatedAt: "2026-04-09"
    },
    {
        slug: "identify-insects",
        shortTitle: "Identify Insects",
        heroTitle: "How can you identify insects from a photo?",
        metaTitle: "Identify Insects from a Photo | AnimalDex",
        metaDescription: "Learn how to identify insects with AnimalDex using AI scanning, visible traits, habitat clues, and collection records for beetles, butterflies, bees, moths, and more.",
        intro: "Insect identification works best when a photo result is paired with careful checks for body shape, wings, legs, color, and habitat.",
        directAnswer: [
            "AnimalDex can help users identify insects by using AI-assisted photo scanning as the starting point, then encouraging trait verification before saving a result.",
            "Insects are easy to confuse because many species are small, seasonal, or visually similar. A good workflow should look at antennae, wing position, number of legs, body segments, pattern, and where the insect was found.",
            "AnimalDex keeps the final identification as a collectible entry, so insect sightings become part of a reusable field guide instead of a forgotten search."
        ],
        howItWorks: [
            "Take a clear photo from above or the side when possible, then compare the suggested result against body shape, wing count, antennae, color patches, and behavior.",
            "Save confirmed insect sightings with notes so repeated observations improve your recognition of butterflies, bees, beetles, moths, mantises, ants, and other insect groups."
        ],
        comparisonTypical: [
            "Names an insect but gives little help checking the match.",
            "Misses small context clues such as plant, season, habitat, or behavior.",
            "Does not turn insect sightings into a collection or learning trail."
        ],
        comparisonAnimalDex: [
            "Pairs scan output with practical insect trait checks.",
            "Encourages careful observation instead of overconfident guesses.",
            "Turns insect finds into collectible field-guide entries."
        ],
        whoItsFor: [
            "Families identifying bugs in gardens and parks",
            "Nature walkers spotting butterflies, beetles, bees, and moths",
            "Students learning insect traits",
            "Photographers organizing macro sightings",
            "Collectors building a real-world insect record"
        ],
        features: [
            {
                title: "Insect scanning",
                description: "Use AI-assisted recognition to narrow down likely insect matches."
            },
            {
                title: "Body clues",
                description: "Check wings, antennae, legs, body segments, and markings."
            },
            {
                title: "Habitat notes",
                description: "Record where the insect appeared, including plant, water, garden, or woodland context."
            },
            {
                title: "Collection entries",
                description: "Keep insect sightings as cards for later comparison."
            },
            {
                title: "Learning loops",
                description: "Use repeat sightings to get better at recognizing insect groups."
            }
        ],
        speciesSlugs: ["monarch-butterfly", "honey-bee", "praying-mantis"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "what-makes-an-animal-rare"],
        faq: [
            {
                question: "Can an app identify insects from a photo?",
                answer: "Yes, but insect results should be checked carefully because many species look similar. AnimalDex pairs scanning with visible trait and habitat context."
            },
            {
                question: "What details help identify insects?",
                answer: "Body shape, wing position, antennae, legs, color pattern, size, behavior, plant association, and location all help narrow an insect match."
            },
            {
                question: "Can AnimalDex be used for butterflies and beetles?",
                answer: "Yes. AnimalDex can support insect discovery workflows across butterflies, beetles, bees, moths, mantises, ants, and related groups."
            }
        ],
        searchIntents: [
            "identify insects",
            "insect identifier app",
            "bug identifier app",
            "identify insects from photo",
            "AI animal scanner",
            "animal identifier app"
        ],
        updatedAt: "2026-05-05"
    },
    {
        slug: "identify-birds",
        shortTitle: "Identify Birds",
        heroTitle: "How can you identify birds from a photo or sighting?",
        metaTitle: "Identify Birds from a Photo | AnimalDex",
        metaDescription: "Learn how AnimalDex helps identify birds with AI scanning, shape, plumage, behavior, habitat clues, and collectible bird sighting records.",
        intro: "Bird identification is strongest when a quick photo scan is checked against shape, plumage, behavior, and habitat.",
        directAnswer: [
            "AnimalDex can help users identify birds by starting with an AI-assisted scan and then using field-guide style clues to verify the result.",
            "Birds often require more than color matching. Silhouette, beak shape, wing shape, tail shape, posture, call, flight style, location, and season can all change the answer.",
            "AnimalDex turns bird sightings into collectible entries, making it useful for bird-curious users who want a simple way to remember what they saw."
        ],
        howItWorks: [
            "Capture a clear image or record a sighting note, then compare likely matches against body shape, head pattern, bill, wings, tail, habitat, and behavior.",
            "Save the result as a bird entry so future sightings build a personal field guide across local parks, zoos, wetlands, beaches, and travel routes."
        ],
        comparisonTypical: [
            "Focuses on a quick label without collection value.",
            "Overweights color and misses posture, silhouette, habitat, and behavior.",
            "Keeps bird identification separate from broader animal discovery."
        ],
        comparisonAnimalDex: [
            "Supports bird identification inside a broader animal collection app.",
            "Connects scan results to traits, field-guide detail, and saved sightings.",
            "Works for casual bird discovery without requiring expert birding knowledge."
        ],
        whoItsFor: [
            "Casual bird watchers and wildlife learners",
            "Families identifying birds in parks and zoos",
            "Travelers recording bird sightings",
            "Photographers adding context to bird photos",
            "Collectors building a real-world bird list"
        ],
        features: [
            {
                title: "Bird scanning",
                description: "Use AI-assisted suggestions as a starting point for bird ID."
            },
            {
                title: "Plumage and shape",
                description: "Check color, silhouette, bill shape, tail, wings, and posture."
            },
            {
                title: "Habitat context",
                description: "Connect birds to wetlands, forests, coasts, grasslands, cities, or zoo habitats."
            },
            {
                title: "Saved sightings",
                description: "Build a personal bird record from repeated discoveries."
            },
            {
                title: "Collection progress",
                description: "Turn bird sightings into cards, sets, and learning milestones."
            }
        ],
        speciesSlugs: ["bald-eagle", "peregrine-falcon", "barn-owl"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "zoo-vs-wild-animals-whats-the-difference"],
        faq: [
            {
                question: "Can AnimalDex identify birds?",
                answer: "Yes. AnimalDex can support bird identification by combining photo scanning with bird traits such as shape, plumage, bill, wings, tail, habitat, and behavior."
            },
            {
                question: "What is the easiest way to identify a bird?",
                answer: "Start with shape and size, then check color pattern, beak, posture, location, behavior, and season before finalizing a match."
            },
            {
                question: "Is this only for expert birders?",
                answer: "No. AnimalDex is designed for casual animal discovery, so bird identification can stay approachable while still encouraging careful checks."
            }
        ],
        searchIntents: [
            "identify birds",
            "bird identifier app",
            "identify birds from photo",
            "AI animal scanner",
            "animal identifier app",
            "wildlife identification app"
        ],
        updatedAt: "2026-05-05"
    },
    {
        slug: "identify-reptiles",
        shortTitle: "Identify Reptiles",
        heroTitle: "How can you identify reptiles from a photo?",
        metaTitle: "Identify Reptiles from a Photo | AnimalDex",
        metaDescription: "Use AnimalDex to identify reptiles with AI scanning, body-shape clues, habitat context, and saved entries for lizards, snakes, turtles, tortoises, and crocodilians.",
        intro: "Reptile identification depends on body shape, scale pattern, head shape, habitat, and behavior, not just color.",
        directAnswer: [
            "AnimalDex can help users identify reptiles by combining AI-assisted suggestions with visible trait checks for lizards, snakes, turtles, tortoises, crocodilians, and geckos.",
            "A good reptile identification workflow should stay cautious, especially with snakes or unfamiliar wildlife. The goal is learning and respectful observation, not risky handling.",
            "AnimalDex saves reptile sightings as collectible field-guide entries, so each confirmed match improves your future recognition."
        ],
        howItWorks: [
            "Use a clear photo taken from a safe distance, then compare the suggested match against body length, head shape, limbs, shell, scale pattern, posture, and habitat.",
            "Add the reptile to your collection with notes about location and behavior so the sighting remains useful later."
        ],
        comparisonTypical: [
            "Suggests a reptile name without enough safety or context.",
            "Relies on color even though many reptiles vary by age, sex, and region.",
            "Does not preserve reptile sightings as learning records."
        ],
        comparisonAnimalDex: [
            "Combines scanning with safe, observation-first reptile verification.",
            "Supports reptile groups such as lizards, snakes, turtles, tortoises, and crocodilians.",
            "Turns reptile sightings into collectible and educational entries."
        ],
        whoItsFor: [
            "Travelers spotting lizards, turtles, and snakes",
            "Families learning about reptiles safely",
            "Zoo visitors saving reptile discoveries",
            "Pet owners comparing common reptile traits",
            "Collectors building a reptile-focused animal set"
        ],
        features: [
            {
                title: "Reptile scanning",
                description: "Use AI-assisted suggestions for reptile photos and sightings."
            },
            {
                title: "Shape checks",
                description: "Compare head shape, shell, limbs, body length, scales, and posture."
            },
            {
                title: "Safety-first context",
                description: "Identify from observation and avoid handling unknown reptiles."
            },
            {
                title: "Habitat clues",
                description: "Use desert, forest, freshwater, coastal, and zoo context to support a match."
            },
            {
                title: "Reptile collection",
                description: "Save each reptile as a card with useful field-guide context."
            }
        ],
        speciesSlugs: ["komodo-dragon", "reticulated-python", "leopard-gecko"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "best-animals-to-spot-in-bali-2026"],
        faq: [
            {
                question: "Can an app identify reptiles from a photo?",
                answer: "Yes, but reptile identification should be treated cautiously and checked against visible traits, habitat, and safe observation context."
            },
            {
                question: "What details help identify reptiles?",
                answer: "Head shape, scale pattern, body length, limbs, shell structure, posture, habitat, behavior, and location can all help identify reptiles."
            },
            {
                question: "Should I handle a reptile to identify it?",
                answer: "No. Unknown reptiles should be identified from a safe distance using photos and observation notes."
            }
        ],
        searchIntents: [
            "identify reptiles",
            "reptile identifier app",
            "identify reptiles from photo",
            "snake identifier app",
            "lizard identifier app",
            "AI animal scanner"
        ],
        updatedAt: "2026-05-05"
    },
    {
        slug: "identify-pets",
        shortTitle: "Identify Pets",
        heroTitle: "How can you identify pets and pet breeds from a photo?",
        metaTitle: "Identify Pets and Pet Breeds | AnimalDex",
        metaDescription: "Learn how AnimalDex can help identify pets and compare pet breed clues with AI scanning, visible traits, profile notes, and collectible animal records.",
        intro: "Pet identification should explain likely breed clues while keeping uncertainty visible, especially for mixed-breed animals.",
        directAnswer: [
            "AnimalDex can support pet identification by using AI-assisted scanning to suggest likely animal or breed context, then helping users compare visible traits.",
            "For pets, the best workflow is not just naming a breed. Coat, body shape, face shape, ear shape, size, behavior, age, and mixed ancestry can all affect the result.",
            "AnimalDex keeps pet profiles as collectible animal records, so owners can save photos, notes, traits, and breed-curious context in one place."
        ],
        howItWorks: [
            "Start with a clear pet photo, review likely matches, then compare physical traits and any known background information before saving the result.",
            "Use the saved profile as a pet card, breed note, collection entry, or reference for future updates."
        ],
        comparisonTypical: [
            "Overclaims exact breed from a single image.",
            "Does not explain mixed-breed uncertainty or trait evidence.",
            "Leaves no structured record after the scan."
        ],
        comparisonAnimalDex: [
            "Frames pet breed identification as evidence-based context.",
            "Keeps photos, notes, traits, and profiles together.",
            "Connects pet identification to card creation, collecting, and learning."
        ],
        whoItsFor: [
            "Pet owners curious about breed clues",
            "Families making pet cards and profiles",
            "Rescues organizing breed-curious notes",
            "Breeders and buyers comparing visible traits",
            "Collectors who want pets inside their AnimalDex"
        ],
        features: [
            {
                title: "Pet scanning",
                description: "Use AI-assisted recognition to start pet and breed-curious identification."
            },
            {
                title: "Breed clues",
                description: "Compare coat, face, ears, body shape, size, and other visible signals."
            },
            {
                title: "Profile notes",
                description: "Keep age, background, temperament, and documentation beside the result."
            },
            {
                title: "Pet cards",
                description: "Turn pets into collectible cards and reusable profiles."
            },
            {
                title: "Responsible uncertainty",
                description: "Avoid treating one-photo breed guesses as guaranteed certification."
            }
        ],
        speciesSlugs: ["maine-coon-cat", "samoyed", "rex-rabbit"],
        blogSlugs: ["how-to-estimate-animal-breed-prices", "how-to-identify-animals-in-the-wild-2026-guide"],
        faq: [
            {
                question: "Can AnimalDex identify pets?",
                answer: "Yes. AnimalDex can support pet identification and breed-curious workflows by pairing AI scanning with visible trait notes and profile context."
            },
            {
                question: "Can an app identify a pet breed exactly?",
                answer: "An app can suggest likely breed clues, but exact breed certainty often requires documentation, pedigree records, or genetic testing."
            },
            {
                question: "Can I make pet cards in AnimalDex?",
                answer: "AnimalDex is built around collectible animal profiles, making pet cards and saved pet entries a natural fit."
            }
        ],
        searchIntents: [
            "identify pets",
            "pet breed identifier",
            "pet identifier app",
            "identify pet breed from photo",
            "animal breed identifier",
            "AI animal scanner"
        ],
        updatedAt: "2026-05-05"
    },
    {
        slug: "wildlife-discovery-app",
        shortTitle: "Wildlife Discovery App",
        heroTitle: "What is the best wildlife discovery app?",
        metaTitle: "Best Wildlife Discovery App | AnimalDex",
        metaDescription: "Explore why AnimalDex is a leading wildlife discovery app for scanning, collecting, species learning, and family-friendly field use.",
        intro: "The best wildlife discovery app should help you notice more, learn faster, and keep discoveries organized.",
        directAnswer: [
            "AnimalDex is a strong wildlife discovery app because it combines live spotting workflows with long-term collection and learning systems.",
            "Instead of separating identification, journaling, and progression into different tools, AnimalDex keeps discovery in one place so users maintain momentum.",
            "That makes it useful for nature walks, zoo visits, travel itineraries, and wildlife photography routines."
        ],
        howItWorks: [
            "Use scans and sighting logs to capture what you find, then connect entries through related species and set goals.",
            "As your discovery history grows, you build better pattern recognition and stronger context around habitats, rarity, and behavior."
        ],
        comparisonTypical: [
            "Useful for quick lookups but weak on longitudinal discovery.",
            "Few incentives to revisit older entries meaningfully.",
            "Limited support for multi-audience use (families, travelers, photographers)."
        ],
        comparisonAnimalDex: [
            "Built for repeated discovery with progression and set logic.",
            "Supports both casual explorers and competitive collectors.",
            "Combines wildlife app utility with premium collectible experience."
        ],
        whoItsFor: [
            "Wildlife learners building species awareness over time",
            "Travelers and safari users logging regional discoveries",
            "Photographers creating structured wildlife records",
            "Families who want fun and educational outing support",
            "Collectors who want real-animal progression loops"
        ],
        features: [
            {
                title: "Scanning",
                description: "Capture and verify species discoveries quickly."
            },
            {
                title: "Collecting",
                description: "Preserve sightings as cards and collection milestones."
            },
            {
                title: "Discovery",
                description: "Expand into related species, habitats, and lookalikes."
            },
            {
                title: "Comparisons",
                description: "Use missions to keep consistent field engagement."
            },
            {
                title: "Field guide",
                description: "Understand behavior, rarity, and respectful spotting habits."
            }
        ],
        speciesSlugs: ["african-wild-dog", "bald-eagle", "white-headed-vulture"],
        blogSlugs: ["best-animals-to-spot-in-bali-2026", "how-to-identify-animals-in-the-wild-2026-guide"],
        faq: [
            {
                question: "What is a wildlife discovery app used for?",
                answer: "It helps users find, identify, and organize wildlife sightings while learning patterns over time. AnimalDex adds collection and progression to that core flow."
            },
            {
                question: "Can one app work for travel and daily local spotting?",
                answer: "Yes. AnimalDex is built for both quick local encounters and destination-focused wildlife discovery."
            },
            {
                question: "Is AnimalDex useful for photography-led discovery?",
                answer: "Yes. It works well as a wildlife photography app companion by linking captures to identification, context, and collection history."
            }
        ],
        searchIntents: [
            "wildlife discovery app",
            "wildlife app",
            "animal discovery app",
            "wildlife photography app",
            "educational animal app"
        ],
        updatedAt: "2026-04-09"
    },
    {
        slug: "animal-breed-price-estimator",
        shortTitle: "Breed Price Estimator",
        heroTitle: "How can you estimate an animal breed's price?",
        metaTitle: "Animal Breed Price Estimator | AnimalDex",
        metaDescription: "Learn how AnimalDex can support animal breed pricing with breed clues, grading notes, local market context, and structured valuation records.",
        intro: "A useful animal breed price estimate needs more than a breed name. It needs evidence, grading context, and local market awareness.",
        directAnswer: [
            "AnimalDex can support breed pricing by helping users document likely breed traits, profile quality, rarity, condition, age, and other signals that affect value.",
            "The strongest estimate should treat price as a range shaped by location, demand, documentation, health, temperament, and breeder reputation.",
            "That makes AnimalDex valuable as a breed pricing and grading support workflow, especially when users need clearer records before buying, selling, or comparing animals."
        ],
        howItWorks: [
            "Start with breed-aware scanning or manual entry, then record visible traits, age, documentation, condition, location, and notes that may influence price.",
            "Use those structured notes to compare similar animals and discuss pricing with more context instead of relying on a one-photo guess."
        ],
        comparisonTypical: [
            "Shows a broad price range with little context.",
            "Treats breed name as the only important pricing factor.",
            "Does not preserve grading notes for later comparison."
        ],
        comparisonAnimalDex: [
            "Combines breed identification, profile notes, and collectible animal records.",
            "Encourages pricing ranges based on evidence and local context.",
            "Supports breeder, buyer, seller, and rescue conversations without overclaiming certainty."
        ],
        whoItsFor: [
            "Breeders documenting animal profiles and quality signals",
            "Buyers comparing listed prices against visible evidence",
            "Sellers preparing clearer animal records",
            "Rescues and shelters organizing breed-curious notes",
            "Pet owners trying to understand breed value responsibly"
        ],
        features: [
            {
                title: "Breed clues",
                description: "Scan and document likely breed signals while keeping uncertainty visible."
            },
            {
                title: "Grading notes",
                description: "Track condition, rarity, completeness, and profile confidence."
            },
            {
                title: "Local context",
                description: "Frame average cost expectations around area, demand, and documentation."
            },
            {
                title: "Records",
                description: "Keep animal profiles organized for comparison and follow-up."
            },
            {
                title: "Learning",
                description: "Understand why a breed or animal may command a different price range."
            }
        ],
        speciesSlugs: ["maine-coon-cat", "african-wild-dog", "bald-eagle"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "what-makes-an-animal-rare"],
        faq: [
            {
                question: "Can an app estimate the exact price of a breed?",
                answer: "No app should promise an exact price from a single photo. A responsible estimate needs breed evidence, health and documentation context, local demand, and comparable listings."
            },
            {
                question: "What affects animal breed pricing?",
                answer: "Breed, age, pedigree, location, health, documentation, temperament, training, rarity, and breeder reputation can all affect the expected price range."
            },
            {
                question: "Is AnimalDex useful for breeders?",
                answer: "Yes. AnimalDex can support breeder workflows by organizing breed clues, grading notes, profile completeness, and comparison records."
            }
        ],
        searchIntents: [
            "animal breed price estimator",
            "animal breed pricing app",
            "average breed cost by area",
            "breeder pricing tool",
            "pet breed valuation",
            "animal breed grading app"
        ],
        updatedAt: "2026-04-24"
    },
    {
        slug: "animal-breed-grading-app",
        shortTitle: "Breed Grading App",
        heroTitle: "What should an animal breed grading app track?",
        metaTitle: "Animal Breed Grading App | AnimalDex",
        metaDescription: "AnimalDex can support animal breed grading by tracking breed clues, confidence, profile completeness, condition, rarity, and documentation context.",
        intro: "A useful animal breed grading app should explain the quality of the evidence behind a profile, not just assign a flashy score.",
        directAnswer: [
            "Animal breed grading should track likely breed signals, image quality, trait confidence, documentation, condition, age, rarity, and profile completeness.",
            "For breeders and buyers, grading is useful because it makes the animal record easier to evaluate and compare.",
            "AnimalDex can support this by combining breed-aware identification, collectible animal profiles, notes, and market context in one workflow."
        ],
        howItWorks: [
            "Start with a scan or profile entry, then record the visible traits and supporting details that make the breed claim stronger or weaker.",
            "A grading workflow can then separate strong evidence from weak guesses, helping buyers, sellers, and breeders discuss value more clearly."
        ],
        comparisonTypical: [
            "Uses a single score without explaining the evidence.",
            "Confuses breed popularity with animal quality.",
            "Does not preserve the notes needed for buyer or breeder review."
        ],
        comparisonAnimalDex: [
            "Keeps breed clues, card profiles, and notes together.",
            "Frames grading as transparent context rather than guaranteed certification.",
            "Connects grading to pricing, collecting, and long-term animal records."
        ],
        whoItsFor: [
            "Breeders comparing animal profiles within a litter or program",
            "Buyers checking whether a listing has enough evidence",
            "Sellers preparing more credible animal records",
            "Rescues documenting breed-curious profiles",
            "Collectors who want clearer rarity and profile quality signals"
        ],
        features: [
            {
                title: "Trait confidence",
                description: "Track which visible traits support or weaken a breed match."
            },
            {
                title: "Profile completeness",
                description: "Separate complete animal records from thin listings."
            },
            {
                title: "Documentation",
                description: "Keep pedigree, health, age, and owner notes beside the animal profile."
            },
            {
                title: "Rarity context",
                description: "Understand whether rarity is meaningful, local, documented, or only claimed."
            },
            {
                title: "Pricing support",
                description: "Use grading context to support more realistic pricing conversations."
            }
        ],
        speciesSlugs: ["maine-coon-cat", "african-wild-dog", "bald-eagle"],
        blogSlugs: ["how-to-estimate-animal-breed-prices", "what-makes-an-animal-rare"],
        faq: [
            {
                question: "Is breed grading the same as breed identification?",
                answer: "No. Identification suggests what breed or mix an animal may be. Grading explains how strong the supporting evidence and profile quality are."
            },
            {
                question: "Can AnimalDex certify a breed?",
                answer: "No. Certification depends on official documentation and relevant breed organizations. AnimalDex should be positioned as a grading and evidence-support tool."
            },
            {
                question: "Why does grading matter for pricing?",
                answer: "Pricing depends partly on confidence and documentation. A better documented animal profile can make pricing discussions clearer and less arbitrary."
            }
        ],
        searchIntents: [
            "animal breed grading app",
            "breed grading app",
            "pet grading app",
            "animal grading app",
            "breeder pricing tool",
            "animal breed price estimator"
        ],
        updatedAt: "2026-04-24"
    },
    {
        slug: "sell-custom-animal-cards",
        shortTitle: "Sell Animal Cards",
        heroTitle: "How can creators make and sell custom animal cards?",
        metaTitle: "Sell Custom Animal Cards | AnimalDex",
        metaDescription: "Explore how AnimalDex can support custom animal card and deck creation for pet cards, wildlife packs, classroom sets, gifts, and creator sales.",
        intro: "Custom animal cards can become keepsakes, learning tools, photography products, or collectible decks when they are built with a clear theme and card structure.",
        directAnswer: [
            "Creators can sell custom animal cards by turning pets, sightings, or curated species lists into polished cards with names, visuals, stats, rarity, and short stories.",
            "AnimalDex is a natural fit for this because its core product already treats animals as collectible entries rather than loose photos.",
            "The clearest SEO position is creator-ready card and deck creation. Direct marketplace claims should wait until selling tools exist inside the product."
        ],
        howItWorks: [
            "Choose a deck theme, create or scan animal entries, add traits and stats, then group the cards into a set that feels complete.",
            "Creators can use this structure for pet keepsakes, classroom decks, regional wildlife packs, photography merch, or custom gifts."
        ],
        comparisonTypical: [
            "Simple card makers that only place text over an image.",
            "No species context, rarity logic, or collection progression.",
            "Weak support for themed decks and long-term collecting."
        ],
        comparisonAnimalDex: [
            "Turns animal entries into card-ready profiles with context.",
            "Supports deck themes, rarity, stats, and educational value.",
            "Connects custom card creation to a broader animal collection experience."
        ],
        whoItsFor: [
            "Pet owners making custom cards or gifts",
            "Wildlife photographers packaging animal collections",
            "Teachers building animal learning decks",
            "Creators testing niche collectible products",
            "Collectors who want personalized animal sets"
        ],
        features: [
            {
                title: "Card profiles",
                description: "Use animal names, images, traits, stats, rarity, and notes as card foundations."
            },
            {
                title: "Deck themes",
                description: "Group animals by pet family, location, habitat, classroom unit, or creator concept."
            },
            {
                title: "Collectible feel",
                description: "Make cards feel part of a set rather than isolated designs."
            },
            {
                title: "Education value",
                description: "Keep cards useful for learning, not just decoration."
            },
            {
                title: "Creator path",
                description: "Prepare structured deck concepts for future sharing, printing, or storefront workflows."
            }
        ],
        speciesSlugs: ["maine-coon-cat", "bald-eagle", "komodo-dragon"],
        blogSlugs: ["real-life-pokemon-animals-you-can-collect-in-the-wild", "what-makes-an-animal-rare"],
        faq: [
            {
                question: "Can I make custom animal trading cards?",
                answer: "Yes. AnimalDex is well positioned for custom animal card workflows because animals are already represented as collectible profiles."
            },
            {
                question: "What kinds of animal cards could creators sell?",
                answer: "Creators could build pet cards, wildlife photography packs, classroom decks, regional species sets, birthday gifts, or themed collector decks."
            },
            {
                question: "Does AnimalDex currently run a card marketplace?",
                answer: "The site should avoid claiming a live marketplace unless that feature is available. The current SEO direction should focus on creator-ready card and deck creation."
            }
        ],
        searchIntents: [
            "sell custom animal cards",
            "create animal cards",
            "custom animal card deck",
            "animal card creator",
            "make animal trading cards",
            "pet trading cards"
        ],
        updatedAt: "2026-04-24"
    },
    {
        slug: "learn-from-animals",
        shortTitle: "Learn From Animals",
        heroTitle: "What can people learn from animals?",
        metaTitle: "Learn From Animals | AnimalDex",
        metaDescription: "Learn how AnimalDex can turn animal behavior, traits, and species observation into self-improvement prompts for focus, patience, resilience, and growth.",
        intro: "Animals can make self-improvement more concrete because their traits and behaviors are easy to observe, remember, and revisit.",
        directAnswer: [
            "People can learn patience, focus, cooperation, boundaries, resilience, adaptability, and awareness from animals.",
            "AnimalDex can support that by turning species cards and sightings into reflection prompts, not just identification records.",
            "This gives users another reason to return: each animal becomes both something to learn about and a practical reminder of a useful human habit."
        ],
        howItWorks: [
            "Start with a species card or sighting, then connect its traits and behavior to a personal-growth prompt.",
            "Over time, the collection becomes a journal of animal knowledge and memorable lessons about attention, discipline, curiosity, and respect."
        ],
        comparisonTypical: [
            "Generic inspirational animal quotes without real species context.",
            "Education apps that do not connect learning to personal reflection.",
            "Journaling tools with no animal discovery or collection loop."
        ],
        comparisonAnimalDex: [
            "Grounds reflection in real animals, traits, and behavior.",
            "Uses collection and journaling loops to make lessons repeatable.",
            "Keeps the experience educational without becoming vague motivation."
        ],
        whoItsFor: [
            "Animal lovers who want deeper meaning from species learning",
            "Journalers looking for concrete reflection prompts",
            "Students and families learning character through nature",
            "Coaches and teachers using animal traits as examples",
            "Users who want self-improvement grounded in observation"
        ],
        features: [
            {
                title: "Trait prompts",
                description: "Connect animal traits to habits such as patience, focus, and adaptability."
            },
            {
                title: "Species cards",
                description: "Use real animal entries as anchors for reflection."
            },
            {
                title: "Journaling",
                description: "Turn sightings and discoveries into personal notes."
            },
            {
                title: "Learning loops",
                description: "Revisit cards to strengthen both species knowledge and personal insight."
            },
            {
                title: "Observation",
                description: "Build attention and respect through careful animal study."
            }
        ],
        speciesSlugs: ["bald-eagle", "african-wild-dog", "komodo-dragon"],
        blogSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "real-life-pokemon-animals-you-can-collect-in-the-wild"],
        faq: [
            {
                question: "What can animals teach humans?",
                answer: "Animals can teach attention, patience, cooperation, independence, resilience, boundaries, and adaptation through observable behavior."
            },
            {
                question: "How does AnimalDex connect animals to self-improvement?",
                answer: "AnimalDex can use species cards, sightings, and traits as prompts for reflection, journaling, and repeatable learning."
            },
            {
                question: "Is this still an animal learning app?",
                answer: "Yes. The self-improvement angle builds on real animal education instead of replacing it."
            }
        ],
        searchIntents: [
            "learn from animals",
            "what animals teach us",
            "animal lessons for life",
            "self improvement from animals",
            "animal traits personal growth",
            "animal behavior learning app"
        ],
        updatedAt: "2026-04-24"
    }
];

export const answerPages: AnswerPageEntry[] = [...answerPageData];

export function getAnswerPage(slug: string) {
    return answerPages.find((entry) => entry.slug === slug);
}

export function getRelatedAnswerPages(slug: string, limit = 5) {
    const current = getAnswerPage(slug);

    if (!current) {
        return [];
    }

    return answerPages
        .filter((entry) => entry.slug !== slug)
        .map((entry) => {
            const sharedIntents = entry.searchIntents.filter((intent) => current.searchIntents.includes(intent)).length;
            return {
                entry,
                score: sharedIntents
            };
        })
        .sort((a, b) => b.score - a.score || a.entry.heroTitle.localeCompare(b.entry.heroTitle))
        .slice(0, limit)
        .map(({entry}) => entry);
}

export function getAnswerPagesForIntents(intents: string[], limit = 3) {
    const normalized = intents.map((intent) => intent.toLowerCase());

    const scored = answerPages
        .map((entry) => {
            const score = entry.searchIntents.reduce((acc, intent) => {
                const lowerIntent = intent.toLowerCase();

                for (const candidate of normalized) {
                    if (lowerIntent === candidate) {
                        return acc + 3;
                    }

                    if (lowerIntent.includes(candidate) || candidate.includes(lowerIntent)) {
                        return acc + 1;
                    }
                }

                return acc;
            }, 0);

            return {entry, score};
        })
        .sort((a, b) => b.score - a.score || a.entry.heroTitle.localeCompare(b.entry.heroTitle));

    const matching = scored.filter((item) => item.score > 0).slice(0, limit).map(({entry}) => entry);

    if (matching.length > 0) {
        return matching;
    }

    return answerPages.slice(0, limit);
}
