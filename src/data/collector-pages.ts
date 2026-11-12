export type CollectorPageSection = {
    title: string;
    paragraphs: string[];
};

export type CollectorPageEntry = {
    slug: string;
    title: string;
    /** The <title> (SEO lane S3, decision 246): the search phrase first, under 50 characters. */
    metaTitle: string;
    heroTitle: string;
    description: string;
    searchIntents: string[];
    sections: CollectorPageSection[];
};

const collectorPageData: CollectorPageEntry[] = [
    {
        slug: "animal-collection-game",
        title: "Animal collection game with real-world sightings",
        metaTitle: "Animal Collection Game With Real Animals",
        heroTitle: "An Animal Collection Game Where the Animals Are Real",
        // SEO lane S3, decision 246 (2026-11-12): the intro says what AnimalDex is now; the search phrase stays.
        description: "An animal collection game with real animals: photograph one, talk to it as an AI companion, and watch its kind join the Ark, a shared 3D world.",
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
        metaTitle: "Animal Card Collection From Real Sightings",
        heroTitle: "An Animal Card Collection Made From Real Sightings",
        // SEO lane S3, decision 246 (2026-11-12): the intro says what AnimalDex is now; the search phrase stays.
        description: "Every animal you photograph becomes a card in your AnimalDex collection, an AI companion you can talk to, and one of its kind aboard the Ark, a shared 3D world.",
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
        metaTitle: "Pokemon-Like Animal Game? Meet Real Animals",
        heroTitle: "Pokemon-Like Animal Game? Meet Real Animals That Talk Back",
        // SEO lane S3, decision 246 (2026-11-12): the intro says what AnimalDex is now; the search phrase stays.
        description: "Want a Pokemon-like game with real animals? Catch real ones with your camera, talk to them as AI companions, and watch their kind live in a shared 3D world.",
        searchIntents: [
            "Pokemon-like animal game",
            "Pokemon-like animal app",
            "Pokémon-like animal app",
            "collect real animals game",
            "species collecting app"
        ],
        sections: [
            {
                title: "Real animals, and every one of them talks",
                paragraphs: [
                    "AnimalDex keeps the thrill of finding an animal and keeping it, with real ones: you photograph the animals you meet, and AnimalDex identifies them.",
                    "Then you can take any idea to one of them. Each answers from a real behaviour of its kind, so you hear an angle you would not get anywhere else."
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
        metaTitle: "Top Trumps Animal Game? Real Animals, Real Stats",
        heroTitle: "Top Trumps-Style Animal Stats, From Real Animals",
        // SEO lane S3, decision 246 (2026-11-12): the intro says what AnimalDex is now; the search phrase stays.
        description: "AnimalDex gives every real animal its stats, from size to speed. Meet them by photographing them: each becomes an AI companion, and its kind joins the Ark.",
        searchIntents: [
            "Top Trumps animal game",
            "Top Trumps-like animal app",
            "animal grading app"
        ],
        sections: [
            {
                title: "Card-strategy energy without losing educational value",
                paragraphs: [
                    "AnimalDex gives each species stats such as size, speed and strength, drawn from its field guide.",
                    "At the same time, each entry stays connected to real species data and field-guide context."
                ]
            },
            {
                title: "For people who like to compare animals",
                paragraphs: [
                    "If you like comparing animals by their stats, AnimalDex lets you set any two species side by side.",
                    "Every number comes with the field guide behind it, so a comparison teaches you something about how each animal really lives."
                ]
            }
        ]
    },
    {
        slug: "collect-real-animals-app",
        title: "Collect real animals app for scanning, sets, and discovery",
        metaTitle: "Collect Real Animals and Meet Them in a 3D World",
        heroTitle: "Collect Real Animals, Then Meet Them in a 3D World",
        // SEO lane S3, decision 246 (2026-11-12): the intro says what AnimalDex is now; the search phrase stays.
        description: "Collect real animals by photographing them: AnimalDex identifies each one, turns it into an AI companion and brings its kind aboard the Ark, a shared 3D world.",
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
        metaTitle: "Custom Animal Cards From Your Own Photos",
        heroTitle: "Custom Animal Cards From Your Own Photos",
        // SEO lane S3, decision 246 (2026-11-12): the intro says what AnimalDex is now; the search phrase stays.
        description: "Each animal you photograph, from your pet to a wild bird, becomes a card in your AnimalDex collection with its field guide, its stats and an AI companion to talk to.",
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
        metaTitle: "Animal Card Creator: Cards From Real Animals",
        heroTitle: "Make Animal Cards From the Real Animals You Meet",
        // SEO lane S3, decision 246 (2026-11-12): the intro says what AnimalDex is now; the search phrase stays.
        description: "Photograph an animal and AnimalDex makes its card: the species, its field guide and its stats. The animal becomes an AI companion, and its kind joins the Ark.",
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
                title: "Cards with a living animal behind them",
                paragraphs: [
                    "Each card is more than a picture: the animal on it becomes an AI companion that talks from its own kind's point of view.",
                    "And one of its kind comes aboard the Ark, a shared 3D world where animals live, eat and raise young by rules built from each animal's field guide."
                ]
            }
        ]
    }
];

export const collectorPages: CollectorPageEntry[] = [...collectorPageData];

export function getCollectorPage(slug: string) {
    return collectorPages.find((entry) => entry.slug === slug);
}
