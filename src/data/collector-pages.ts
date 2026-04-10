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
    }
];

export const collectorPages: CollectorPageEntry[] = [...collectorPageData];

export function getCollectorPage(slug: string) {
    return collectorPages.find((entry) => entry.slug === slug);
}
