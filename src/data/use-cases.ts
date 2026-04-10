export type UseCaseFAQ = {
    question: string;
    answer: string;
};

export type UseCaseSection = {
    title: string;
    paragraphs: string[];
};

export type UseCaseLanding = {
    slug: string;
    title: string;
    description: string;
    shortLabel: string;
    audience: string;
    updatedAt: string;
    searchIntents: string[];
    keyActions: string[];
    whyDifferent: string[];
    sections: UseCaseSection[];
    faq: UseCaseFAQ[];
};

const useCaseData: UseCaseLanding[] = [
    {
        slug: "ai-animal-scanner-identification-app",
        shortLabel: "AI Animal Scanner",
        title: "AI animal scanner and identification app for real-world sightings",
        description: "AnimalDex helps you scan real animals, identify likely species or breeds, and keep each sighting in a collectible journal with useful field-guide context.",
        audience: "Animal lovers, wildlife learners, travelers, and everyday spotters",
        updatedAt: "2026-04-09",
        searchIntents: [
            "AI animal scanner",
            "animal identification app",
            "wildlife app",
            "animal discovery app",
            "AI animal analysis",
            "animal scanner AI",
            "identify animals from a photo"
        ],
        keyActions: [
            "Scan and analyze animals from sightings and photos",
            "Review species or breed clues before saving",
            "Store each result as a card in your personal journal",
            "Revisit field-guide context for better recognition over time"
        ],
        whyDifferent: [
            "Most scanner tools stop at one label. AnimalDex turns identification into a repeatable learning loop.",
            "Each result is saved as part of your ongoing collection rather than a one-time lookup.",
            "The app is designed for respectful observation and practical, non-preachy wildlife learning."
        ],
        sections: [
            {
                title: "Use AnimalDex as an identification app you actually return to",
                paragraphs: [
                    "AnimalDex starts with AI-assisted scanning but does not end with a throwaway answer. Each sighting can be saved as a collectible card with context that helps you learn what you saw and why it matters.",
                    "That makes it useful for people who want more than a one-off species guess. The app is built to improve recognition habits through repeated discovery."
                ]
            },
            {
                title: "Built for real contexts: parks, zoos, safaris, and travel",
                paragraphs: [
                    "AnimalDex is designed for mixed environments where spotting happens naturally: family days at the zoo, wildlife travel, nature walks, and photography outings.",
                    "Because sightings are kept in one journal, users can compare patterns and improve confidence without losing the fun."
                ]
            }
        ],
        faq: [
            {
                question: "Is AnimalDex only for wild animals?",
                answer: "No. AnimalDex supports both wildlife and breed-curious usage while keeping a strong focus on real-animal learning."
            },
            {
                question: "Can I use it as a simple scan-and-save tool?",
                answer: "Yes. You can scan quickly, but the app also gives deeper context when you want to learn more."
            }
        ]
    },
    {
        slug: "wildlife-collection-animal-card-app",
        shortLabel: "Collection App",
        title: "Wildlife collection and animal card app with sets, albums, and progression",
        description: "AnimalDex turns real sightings into collectible cards so you can build albums, complete sets, and grow a premium animal journal with meaningful progression.",
        audience: "Collectors, card fans, creature-collection players, and completionists",
        updatedAt: "2026-04-09",
        searchIntents: [
            "animal collection app",
            "wildlife collection app",
            "animal card app",
            "animal card game",
            "animal card collecting app",
            "species collecting game",
            "animal set collection game"
        ],
        keyActions: [
            "Collect real-animal cards from your sightings",
            "Complete habitat or region-led sets",
            "Track progression through albums and missions",
            "Balance collecting goals with field-guide learning"
        ],
        whyDifferent: [
            "The collection loop is grounded in real animals and real sightings, not purely fictional entries.",
            "Set completion and progression are paired with species context and observation habits.",
            "The tone is premium and playful without losing educational value."
        ],
        sections: [
            {
                title: "A species collecting game with real-world grounding",
                paragraphs: [
                    "AnimalDex offers the satisfaction of card collecting and set completion while tying every entry to a real animal encounter.",
                    "That gives the progression loop emotional weight and better memory retention than pure abstraction."
                ]
            },
            {
                title: "For players who want collecting and learning together",
                paragraphs: [
                    "Collectors can chase rarity and completion, while learners can keep using the same entries for species and habitat understanding.",
                    "This dual value is what makes the loop stick for both game-oriented and education-oriented users."
                ]
            }
        ],
        faq: [
            {
                question: "Is this like a Pokemon-style collecting app?",
                answer: "It delivers a similar sense of progression and collecting energy, but focused on real animals and real sightings."
            },
            {
                question: "Do I need to be competitive to enjoy it?",
                answer: "No. Completion and journal building work well for casual collectors too."
            }
        ]
    },
    {
        slug: "family-zoo-safari-animal-learning-app",
        shortLabel: "Family Zoo & Safari",
        title: "Family-friendly zoo and safari animal learning app",
        description: "AnimalDex helps families turn zoo visits, safari drives, and nature walks into playful species discovery with respectful wildlife observation habits.",
        audience: "Families, parents, kids, teachers, and group travelers",
        updatedAt: "2026-04-09",
        searchIntents: [
            "family-friendly animal learning app",
            "zoo animal app",
            "safari animal app",
            "educational animal app",
            "wild animal learning app"
        ],
        keyActions: [
            "Spot and log animals during trips and outings",
            "Use discovery prompts to keep kids engaged",
            "Collect sightings into shared family goals",
            "Reinforce curiosity-over-cruelty observation habits"
        ],
        whyDifferent: [
            "AnimalDex makes educational moments feel game-like, not textbook-heavy.",
            "The app works across zoos, safaris, and everyday nature walks.",
            "Respectful observation is integrated into the experience without preachy language."
        ],
        sections: [
            {
                title: "Animal learning that feels active, not lecture-based",
                paragraphs: [
                    "Families get better outcomes when discovery feels like a shared challenge. AnimalDex uses collecting and spotting loops to make learning practical and memorable.",
                    "Instead of passive reading, users build their own record of real encounters over time."
                ]
            },
            {
                title: "Designed for parents and children learning together",
                paragraphs: [
                    "The app works for mixed ages by combining simple scanning with optional depth when adults want more context.",
                    "That flexibility helps families keep outings fun while building stronger species awareness."
                ]
            }
        ],
        faq: [
            {
                question: "Is AnimalDex suitable for younger kids?",
                answer: "Yes. The app is designed to be family-friendly and usable in guided parent-child contexts."
            },
            {
                question: "Does it only work in the wild?",
                answer: "No. Zoo and travel contexts are core use cases alongside wild sightings."
            }
        ]
    },
    {
        slug: "wildlife-photography-companion-app",
        shortLabel: "Photography Companion",
        title: "Wildlife photography companion app for cleaner IDs and better observation",
        description: "AnimalDex supports wildlife photographers with scan-to-journal workflows, species context, and habits that improve both photo quality and respectful animal observation.",
        audience: "Wildlife photographers, travel photographers, and field spotters",
        updatedAt: "2026-04-09",
        searchIntents: [
            "wildlife photography app",
            "wildlife photography tips",
            "animal scanner app for photos",
            "safari animal app",
            "respectful wildlife observation"
        ],
        keyActions: [
            "Scan sightings captured during photography sessions",
            "Log behavior and habitat context beside photos",
            "Build a photo-led species journal",
            "Use field-guide details to improve future captures"
        ],
        whyDifferent: [
            "The app treats photography as part of the learning loop, not a separate activity.",
            "Species context and journal records help photographers improve pattern recognition over time.",
            "Respectful observation principles are positioned as practical technique, not moral messaging."
        ],
        sections: [
            {
                title: "From shot to structured wildlife memory",
                paragraphs: [
                    "AnimalDex helps convert photography moments into reusable entries that combine visual evidence, likely identification, and contextual notes.",
                    "This turns your photo archive into a stronger field-learning asset."
                ]
            },
            {
                title: "Better spotting habits produce better photos",
                paragraphs: [
                    "Respectful distance, behavior awareness, and habitat reading improve both welfare and image quality.",
                    "AnimalDex supports this by framing each sighting as a learning event, not just a capture."
                ]
            }
        ],
        faq: [
            {
                question: "Can I use AnimalDex if I mainly shoot with a phone camera?",
                answer: "Yes. The workflow is designed for both phone-first and camera-assisted spotting habits."
            },
            {
                question: "Does the app replace a full photography workflow?",
                answer: "No. It complements your workflow by improving identification and observation context."
            }
        ]
    },
    {
        slug: "animal-breed-identifier-lookalike-guide-app",
        shortLabel: "Breed Identifier",
        title: "Animal breed identifier and lookalike guide app",
        description: "AnimalDex supports breed-curious users with scan-based clues, lookalike awareness, and structured notes that make breed discovery more informed.",
        audience: "Pet-curious users, families, and breed learners",
        updatedAt: "2026-04-09",
        searchIntents: [
            "animal breed identifier",
            "animal breed detector",
            "identify pet breeds",
            "animal identification app",
            "AI animal analysis"
        ],
        keyActions: [
            "Scan likely breeds from photos and sightings",
            "Compare lookalike possibilities",
            "Track repeated observations for better confidence",
            "Build a personal animal-learning reference"
        ],
        whyDifferent: [
            "AnimalDex emphasizes clues and context, not false certainty from one image.",
            "Users can revisit and compare results over time inside a collection structure.",
            "The same app supports breed curiosity and broader wildlife learning."
        ],
        sections: [
            {
                title: "Better breed discovery starts with better context",
                paragraphs: [
                    "Breed identification is often ambiguous from a single image. AnimalDex helps users inspect meaningful clues and keep notes rather than relying on one hard label.",
                    "This encourages healthier expectations and stronger understanding."
                ]
            },
            {
                title: "Useful for pet curiosity and lookalike learning",
                paragraphs: [
                    "Whether users are comparing common breeds or exploring mixed-trait animals, the app provides a structured way to learn and revisit findings.",
                    "That makes it practical for ongoing curiosity instead of one-off checks."
                ]
            }
        ],
        faq: [
            {
                question: "Can AnimalDex guarantee exact breed matches?",
                answer: "No app can guarantee exact matches from every image. AnimalDex focuses on useful clues and informed comparison."
            },
            {
                question: "Is this only for pet breeds?",
                answer: "No. AnimalDex also supports broader species discovery and wildlife collection use cases."
            }
        ]
    },
    {
        slug: "species-collecting-game-battles-trading-app",
        shortLabel: "Battles & Trading",
        title: "Species collecting game with battles and trading loops",
        description: "AnimalDex combines real-animal collection with challenge, progression, and trading mechanics for users who want competitive energy without leaving the educational core.",
        audience: "Competitive players, collectors, and strategy-oriented users",
        updatedAt: "2026-04-09",
        searchIntents: [
            "animal battle app",
            "animal trading app",
            "species collecting game",
            "animal grading app",
            "Top Trumps-like animal app"
        ],
        keyActions: [
            "Train collection depth through missions and progression",
            "Use stats and rarity to support challenge play",
            "Trade fairly while improving set completion",
            "Keep real species learning inside competitive loops"
        ],
        whyDifferent: [
            "AnimalDex gives competitive users game depth while preserving real-world animal context.",
            "Trading and challenge mechanics are tied to collectible progress and knowledge retention.",
            "The model supports excitement without reducing animals to empty tokens."
        ],
        sections: [
            {
                title: "Competition with educational grounding",
                paragraphs: [
                    "AnimalDex introduces battle and trading energy for players who enjoy progression systems, but keeps species context and field-guide depth in the loop.",
                    "This creates a rarer blend of meaningful competition and practical learning."
                ]
            },
            {
                title: "For strategy-minded collectors",
                paragraphs: [
                    "Users can pursue rarity, set value, and mission progression while continuing to build recognition and animal-awareness skills.",
                    "That balance helps AnimalDex appeal to both competitive and curiosity-driven audiences."
                ]
            }
        ],
        faq: [
            {
                question: "Is AnimalDex only for competitive players?",
                answer: "No. Competitive features are optional layers on top of scanning, collecting, and learning."
            },
            {
                question: "Is this a fantasy creature game?",
                answer: "No. The collection and progression loops are built around real animals and real-world sightings."
            }
        ]
    }
];

export const useCases: UseCaseLanding[] = [...useCaseData]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));

export function getUseCase(slug: string) {
    return useCases.find((entry) => entry.slug === slug);
}

export function getRelatedUseCases(slug: string, limit = 3) {
    const current = getUseCase(slug);

    if (!current) {
        return [];
    }

    return useCases
        .filter((entry) => entry.slug !== slug)
        .map((entry) => {
            const sharedIntents = entry.searchIntents.filter((intent) => current.searchIntents.includes(intent)).length;
            const sharedAudience = entry.audience === current.audience ? 1 : 0;

            return {
                entry,
                score: sharedIntents * 3 + sharedAudience
            };
        })
        .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
        .slice(0, limit)
        .map(({entry}) => entry);
}
