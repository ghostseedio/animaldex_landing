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
    },
    {
        slug: "animal-breed-pricing-grading-app",
        shortLabel: "Breed Pricing",
        title: "Animal breed pricing and grading app for clearer market context",
        description: "AnimalDex helps breed-focused users document traits, compare likely breed signals, and build clearer pricing context before making breeder, buyer, or seller decisions.",
        audience: "Breeders, buyers, sellers, rescues, and serious pet owners",
        updatedAt: "2026-04-24",
        searchIntents: [
            "animal breed price estimator",
            "animal breed grading app",
            "breeder pricing tool",
            "average breed cost by area",
            "pet breed valuation",
            "animal breed identifier"
        ],
        keyActions: [
            "Scan and document likely breed traits from photos",
            "Track condition, age, rarity, and profile completeness",
            "Compare local pricing factors before setting expectations",
            "Keep structured notes that support breeder and buyer conversations"
        ],
        whyDifferent: [
            "AnimalDex frames breed pricing as evidence-backed context rather than a single unsupported number.",
            "Breed identification, collection history, and grading signals live in one workflow.",
            "The app can support both casual breed curiosity and more serious breeder-facing valuation habits."
        ],
        sections: [
            {
                title: "Better pricing starts with better breed evidence",
                paragraphs: [
                    "Breed value is shaped by more than a name. Location, age, documentation, health signals, rarity, temperament, profile quality, and buyer demand can all change the expected range.",
                    "AnimalDex can help users gather the structured evidence behind those decisions instead of relying on a quick guess from one photo."
                ]
            },
            {
                title: "Useful for breeders, buyers, and careful sellers",
                paragraphs: [
                    "A breeder may want cleaner records for a litter, while a buyer may want to understand whether a listed price makes sense for a local area.",
                    "AnimalDex gives this audience a place to organize breed clues, grading notes, and comparison context without pretending that every animal can be priced perfectly from an image."
                ]
            }
        ],
        faq: [
            {
                question: "Can AnimalDex give an exact price for every breed?",
                answer: "No. Breed pricing depends on local demand, documentation, health, age, training, and seller context. AnimalDex is best positioned as a pricing and grading support tool."
            },
            {
                question: "How could breeders use AnimalDex?",
                answer: "Breeders can use AnimalDex to document breed traits, organize animal profiles, compare grading signals, and keep clearer context for pricing conversations."
            }
        ]
    },
    {
        slug: "custom-animal-card-deck-creator",
        shortLabel: "Custom Decks",
        title: "Custom animal card deck creator for collectors, educators, and sellers",
        description: "AnimalDex helps users turn pets, sightings, and curated species lists into custom animal cards and decks that can support collecting, teaching, gifting, and creator sales.",
        audience: "Collectors, creators, pet owners, educators, photographers, and small sellers",
        updatedAt: "2026-04-24",
        searchIntents: [
            "custom animal card deck",
            "animal card creator",
            "create animal cards",
            "make animal trading cards",
            "sell custom animal cards",
            "pet trading cards"
        ],
        keyActions: [
            "Create animal cards from pets, sightings, or species profiles",
            "Group cards into themed decks and collectible sets",
            "Use rarity, stats, stories, and visuals to make cards feel premium",
            "Prepare decks for sharing, classroom use, gifts, or creator storefronts"
        ],
        whyDifferent: [
            "AnimalDex already treats animals as collectible cards, so custom deck creation fits the product naturally.",
            "Cards can blend real animal context with creator-friendly presentation.",
            "The same workflow can serve personal collections, education packs, photography projects, and small commercial ideas."
        ],
        sections: [
            {
                title: "Custom cards from real animal stories",
                paragraphs: [
                    "A good animal card is more than a picture. It needs a name, traits, stats, rarity, story, and a reason to belong in a deck.",
                    "AnimalDex is already built around that card logic, which makes custom animal decks a strong extension for creators and collectors."
                ]
            },
            {
                title: "From personal collection to sellable deck concept",
                paragraphs: [
                    "Users may want pet cards for gifts, classroom decks for learning, wildlife photography cards, or themed packs for niche audiences.",
                    "AnimalDex can support that funnel by helping users organize the animals, polish the card content, and prepare deck concepts with clearer structure."
                ]
            }
        ],
        faq: [
            {
                question: "Can AnimalDex support custom animal cards?",
                answer: "Yes. The product already uses collectible animal card logic, making custom cards and decks a natural SEO and product direction."
            },
            {
                question: "Can users sell custom animal decks?",
                answer: "AnimalDex can be positioned around creator-ready card and deck workflows. Direct marketplace claims should only be made once those features exist in the product."
            }
        ]
    },
    {
        slug: "animal-inspired-self-improvement-app",
        shortLabel: "Animal Growth",
        title: "Animal-inspired self-improvement app for learning from real animal traits",
        description: "AnimalDex can help users learn from animals by turning species behavior, traits, and observation into practical prompts for focus, patience, resilience, and personal growth.",
        audience: "Animal lovers, journalers, students, coaches, and self-improvement readers",
        updatedAt: "2026-04-24",
        searchIntents: [
            "learn from animals",
            "self improvement from animals",
            "animal lessons for life",
            "what animals teach us",
            "animal traits personal growth",
            "animal behavior learning app"
        ],
        keyActions: [
            "Study animal traits as memorable personal-growth prompts",
            "Use sightings and species cards as reflection anchors",
            "Connect behavior patterns to habits like patience and adaptability",
            "Build a learning journal around attention, curiosity, and respect"
        ],
        whyDifferent: [
            "AnimalDex can connect real species learning with human reflection without becoming generic motivational content.",
            "Collection and journaling loops make self-improvement prompts easier to revisit.",
            "The angle broadens AnimalDex beyond identification into personal meaning and habit formation."
        ],
        sections: [
            {
                title: "Animals make abstract habits easier to remember",
                paragraphs: [
                    "People often remember behavior through examples. An animal trait can become a practical anchor for focus, patience, teamwork, independence, or adaptation.",
                    "AnimalDex can turn species cards into reflection prompts so learning about animals also helps users think about how they move through the world."
                ]
            },
            {
                title: "Observation as a self-improvement habit",
                paragraphs: [
                    "Wildlife learning rewards patience, attention, and context. Those same habits transfer into better decision-making and stronger awareness in daily life.",
                    "This gives AnimalDex a credible self-improvement lane grounded in real observation instead of vague inspiration."
                ]
            }
        ],
        faq: [
            {
                question: "Can learning about animals support self-improvement?",
                answer: "Yes. Animal behavior can provide concrete prompts for patience, focus, resilience, cooperation, boundaries, and adaptability."
            },
            {
                question: "Is this separate from animal identification?",
                answer: "No. It builds on the same species cards and sightings, then adds a reflection layer for users who want personal meaning from what they learn."
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
