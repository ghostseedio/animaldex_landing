export type CollectorPageSection = {
    title: string;
    paragraphs: string[];
};

export type CollectorPageEntry = {
    slug: string;
    title: string;
    heroTitle: string;
    description: string;
    searchIntents: string[];
    sections: CollectorPageSection[];
};

const collectorPageData: CollectorPageEntry[] = [
    {
        slug: "animal-collection-game",
        title: "Animal collection game with real-world sightings",
        heroTitle: "Animal Collection Game — Collect Real Species, Not Fantasy Placeholders",
        description: "AnimalDex is an animal collection game where real sightings become collectible progress, field-guide learning, and set-completion goals.",
        searchIntents: [
            "animal collection game",
            "species collecting game",
            "collect real animals app",
            "animal set collection game"
        ],
        sections: [
            {
                title: "What makes AnimalDex an animal collection game",
                paragraphs: [
                    "AnimalDex uses the same rewarding loop players expect from collection games: find, log, complete, compare, and progress.",
                    "The difference is that your collection is built from real-world species and sightings, which makes each entry more memorable and educational."
                ]
            },
            {
                title: "Collecting that improves your animal awareness",
                paragraphs: [
                    "Instead of treating collection as pure accumulation, AnimalDex links each entry to identification clues, habitat context, and rarity signals.",
                    "That blend keeps the game loop fun while making users better at noticing and understanding real animals."
                ]
            }
        ]
    },
    {
        slug: "animal-card-collection",
        title: "Animal card collection app for species sets and progression",
        heroTitle: "Animal Card Collection — Build Premium Species Cards From Real Sightings",
        description: "AnimalDex turns each sighting into an animal card collection entry, helping users build albums, complete sets, and keep a richer species journal.",
        searchIntents: [
            "animal card collection",
            "animal card collecting app",
            "animal card game",
            "wildlife card app",
            "animal journal app"
        ],
        sections: [
            {
                title: "A premium animal card collection experience",
                paragraphs: [
                    "AnimalDex is designed for card-collection fans who care about polish, progression, and set depth.",
                    "Every card represents a real species encounter, adding emotional context that generic card systems usually lack."
                ]
            },
            {
                title: "From one card to long-term collection loops",
                paragraphs: [
                    "Users can organize cards into albums, compare rarity and completion status, and revisit entries as their knowledge grows.",
                    "The result is a card collection app that is both game-like and genuinely useful for species learning."
                ]
            }
        ]
    },
    {
        slug: "pokemon-like-animal-game",
        title: "Pokemon-like animal game centered on real species",
        heroTitle: "Pokemon-Like Animal Game — Real Wildlife Discovery With Collection Energy",
        description: "AnimalDex gives creature-collection fans a Pokemon-like animal game loop, but grounded in real species, real sightings, and field-guide learning.",
        searchIntents: [
            "Pokemon-like animal game",
            "Pokemon-like animal app",
            "Pokémon-like animal app",
            "collect real animals game",
            "species collecting app"
        ],
        sections: [
            {
                title: "Pokemon-like progression with real-world grounding",
                paragraphs: [
                    "AnimalDex keeps the thrill of discovery and set-building that creature-collection players love.",
                    "Instead of fantasy creatures, progression comes from finding, identifying, and collecting real animals."
                ]
            },
            {
                title: "Why real species can feel even more rewarding",
                paragraphs: [
                    "Real sightings carry context: location, habitat, and personal memory. That gives each entry weight beyond a random unlock.",
                    "AnimalDex uses that reality-based depth to create a collection loop that feels both exciting and meaningful."
                ]
            }
        ]
    },
    {
        slug: "top-trumps-animal-game",
        title: "Top Trumps-style animal game with rarity and strategy",
        heroTitle: "Top Trumps Animal Game — Strategy, Rarity, and Real Species Context",
        description: "AnimalDex is a Top Trumps-style animal game experience with card-style comparison energy, progression mechanics, and real species insight.",
        searchIntents: [
            "Top Trumps animal game",
            "Top Trumps-like animal app",
            "animal battle app",
            "animal grading app"
        ],
        sections: [
            {
                title: "Card-strategy energy without losing educational value",
                paragraphs: [
                    "AnimalDex supports stat-minded players with progression and comparison loops that feel strategic and collectible.",
                    "At the same time, each entry stays connected to real species data and field-guide context."
                ]
            },
            {
                title: "For collectors and competitive players",
                paragraphs: [
                    "If you like card games with ranking logic, rarity tension, and completion goals, AnimalDex fits that profile.",
                    "It adds a learning layer so competition still grows your species awareness over time."
                ]
            }
        ]
    },
    {
        slug: "collect-real-animals-app",
        title: "Collect real animals app for scanning, sets, and discovery",
        heroTitle: "Collect Real Animals App — Scan, Discover, and Build Living Species Collections",
        description: "AnimalDex is a collect real animals app that combines AI scanning, collectible progression, social discovery, and field-guide depth.",
        searchIntents: [
            "collect real animals app",
            "wildlife collection app",
            "animal discovery app",
            "animal scanner AI"
        ],
        sections: [
            {
                title: "Designed for people who want real-animal collection loops",
                paragraphs: [
                    "AnimalDex is built for users who love collecting behavior but want it tied to real animals and sightings.",
                    "That makes the app useful for travelers, families, photographers, and collectors in one shared system."
                ]
            },
            {
                title: "Scan, collect, discover, and progress",
                paragraphs: [
                    "The core loop is simple: scan what you find, save it as a collectible card, discover related species, and progress through sets and goals.",
                    "Because each step adds context, users gain knowledge while still getting the excitement of progression."
                ]
            }
        ]
    },
    {
        slug: "custom-animal-card-deck",
        title: "Custom animal card deck for pets, wildlife, and collections",
        heroTitle: "Custom Animal Card Deck - Build Premium Decks From Real Animals",
        description: "AnimalDex helps users turn pets, sightings, and curated species lists into custom animal card decks with collectible structure, stats, rarity, and story.",
        searchIntents: [
            "custom animal card deck",
            "animal card deck",
            "pet trading cards",
            "wildlife card deck",
            "custom animal cards",
            "animal card creator"
        ],
        sections: [
            {
                title: "A custom animal deck needs more than images",
                paragraphs: [
                    "The strongest animal cards combine visuals with traits, stats, rarity, and a reason each animal belongs in the set.",
                    "AnimalDex already organizes animals as collectible entries, so deck creation can build on a structure users understand immediately."
                ]
            },
            {
                title: "For pet owners, educators, photographers, and collectors",
                paragraphs: [
                    "A custom deck can become a pet keepsake, a classroom learning pack, a wildlife photography project, or a collector set built around a trip or theme.",
                    "AnimalDex makes that easier by connecting card presentation with real species context and collection progress."
                ]
            }
        ]
    },
    {
        slug: "animal-card-deck-creator",
        title: "Animal card deck creator for making and sharing collectible cards",
        heroTitle: "Animal Card Deck Creator - Make Cards People Want to Collect",
        description: "AnimalDex is positioned for animal card creation workflows where users can build themed decks from pets, wildlife sightings, species profiles, and creator ideas.",
        searchIntents: [
            "animal card deck creator",
            "create animal cards",
            "make animal trading cards",
            "animal card creator",
            "sell custom animal cards",
            "custom pet cards"
        ],
        sections: [
            {
                title: "Create animal cards with collectible logic",
                paragraphs: [
                    "Animal cards work best when they feel like part of a complete system: card identity, set theme, rarity, traits, stats, and progression.",
                    "AnimalDex can support that system by turning real animal data and user-created context into cards that feel organized instead of random."
                ]
            },
            {
                title: "A foundation for creator and seller use cases",
                paragraphs: [
                    "Creators may want to sell pet decks, regional wildlife packs, classroom sets, photography cards, or themed animal collections.",
                    "AnimalDex should be careful not to claim a live marketplace before it exists, but the SEO path can already target deck creation and creator-ready selling workflows."
                ]
            }
        ]
    }
];

export const collectorPages: CollectorPageEntry[] = [...collectorPageData];

export function getCollectorPage(slug: string) {
    return collectorPages.find((entry) => entry.slug === slug);
}
