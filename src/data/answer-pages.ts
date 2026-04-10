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
                title: "Challenges",
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
                title: "Challenges",
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
            "Progress through sets, rarity milestones, and challenge systems while improving your species recognition."
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
                title: "Challenges",
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
                title: "Challenges",
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
                title: "Challenges",
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
                title: "Challenges",
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
