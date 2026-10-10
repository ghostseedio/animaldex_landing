import type {OgCardSpec, OgTile} from "@/lib/og/og-card";

function art(slug: string, label: string, caption?: string): OgTile {
    return {image: {artwork: slug}, label, caption};
}

/**
 * Share cards for pages that have no per-page photo of their own. Keys are the
 * page path without the leading slash (`use-cases/<slug>` for use cases, the
 * bare slug for collector landing pages). Every slug here must have artwork in
 * the `animals` bucket or its tile is dropped.
 */
export const STATIC_OG_CARDS: Record<string, OgCardSpec> = {
    // Hubs
    "animals": {
        kicker: "Animal encyclopedia",
        title: "Explore 2,500+ real animals",
        tiles: [art("snow-leopard", "Snow Leopard"), art("red-panda", "Red Panda"), art("scarlet-macaw", "Scarlet Macaw")]
    },
    "blog": {
        kicker: "AnimalDex blog",
        title: "How animals survive, think and win",
        tiles: [art("common-octopus", "Octopus"), art("peregrine-falcon", "Peregrine Falcon"), art("chameleon", "Chameleon")]
    },
    "animal-lessons": {
        kicker: "Animal lessons",
        title: "What every animal can teach you",
        tiles: [art("african-bush-elephant", "Elephant"), art("common-raven", "Raven"), art("honey-badger", "Honey Badger")]
    },
    "powers": {
        kicker: "Animal powers",
        title: "Biology-backed powers from real animals",
        tiles: [art("cheetah", "Speed"), art("mantis-shrimp", "Precision"), art("arctic-tern", "Endurance")]
    },
    "animal-symbolism": {
        kicker: "Animal symbolism",
        title: "What animals mean, grounded in real biology",
        tiles: [art("snowy-owl", "Snowy Owl"), art("red-fox", "Red Fox"), art("gray-wolf", "Gray Wolf")]
    },
    "animal-wisdom": {
        kicker: "Animal wisdom",
        title: "Survival wisdom from the natural world",
        tiles: [art("bornean-orangutan", "Orangutan"), art("barn-owl", "Barn Owl"), art("green-sea-turtle", "Sea Turtle")]
    },
    "animal-behaviours": {
        kicker: "Animal behaviours",
        title: "How animals hunt, hide, migrate and survive",
        tiles: [art("humpback-whale", "Humpback Whale"), art("leafcutter-ant", "Leafcutter Ant"), art("meerkat", "Meerkat")]
    },
    "challenge-yourself": {
        kicker: "Challenge yourself",
        title: "Could you survive like these animals?",
        tiles: [art("emperor-penguin", "Emperor Penguin"), art("wolverine", "Wolverine"), art("komodo-dragon", "Komodo Dragon")]
    },
    "animal-hybrids": {
        kicker: "Animal hybrids",
        title: "What if two animals became one?",
        joiner: "+",
        tiles: [art("plains-zebra", "Plains Zebra"), art("white-rhinoceros", "White Rhinoceros")]
    },
    "pokemon-animals": {
        kicker: "Pokémon animals",
        title: "The real animal behind every Pokémon",
        tiles: [
            {image: {publicPath: "/images/pokemon-animals/art/squirtle.webp"}, label: "Squirtle", caption: "Sea turtle"},
            {image: {publicPath: "/images/pokemon-animals/art/vulpix.webp"}, label: "Vulpix", caption: "Fox"},
            {image: {publicPath: "/images/pokemon-animals/art/zubat.webp"}, label: "Zubat", caption: "Bat"}
        ]
    },
    "use-cases": {
        kicker: "Use cases",
        title: "Everything you can do with AnimalDex",
        tiles: [art("golden-retriever", "Pets"), art("giraffe", "Safaris"), art("ball-python", "Herping")]
    },
    "wildlife-guides": {
        kicker: "Wildlife guides",
        title: "Book local experts to find wild animals",
        tiles: [art("african-lion", "Safari"), art("atlantic-puffin", "Birding"), art("red-eyed-tree-frog", "Night walks")]
    },
    "support": {
        kicker: "Help Center",
        title: "AnimalDex support and answers"
    },
    "contact": {
        kicker: "Contact",
        title: "Get in touch with the AnimalDex team"
    },
    "branding": {
        kicker: "Brand",
        title: "AnimalDex brand identity and assets"
    },

    // Earn
    "earn-on-animaldex": {
        kicker: "Earn on AnimalDex",
        title: "Turn your wildlife knowledge into income",
        tiles: [art("bengal-tiger", "Guide"), art("scarlet-macaw", "Create"), art("grizzly-bear", "Sponsor")]
    },
    "become-a-wildlife-guide": {
        kicker: "Become a wildlife guide",
        title: "Share your local wildlife with travellers",
        tiles: [art("giraffe", "Giraffe"), art("common-kingfisher", "Kingfisher"), art("green-iguana", "Iguana")]
    },
    "creator-rewards": {
        kicker: "Creator Rewards",
        title: "Rewards for great wildlife content",
        tiles: [art("snow-leopard", "Snow Leopard"), art("atlantic-puffin", "Puffin"), art("jaguar", "Jaguar")]
    },
    "sponsor-a-challenge": {
        kicker: "Sponsor a challenge",
        title: "Put your brand behind a real animal challenge",
        tiles: [art("polar-bear", "Polar Bear"), art("monarch-butterfly", "Monarch"), art("koala", "Koala")]
    },
    "wildlife-experiences": {
        kicker: "Wildlife experiences",
        title: "Guided trips to see animals in the wild",
        tiles: [art("hippopotamus", "Hippo"), art("humpback-whale", "Whale"), art("three-toed-sloth", "Sloth")]
    },

    // Legal
    "legal/privacy": {kicker: "Legal", title: "AnimalDex Privacy Policy"},
    "legal/terms": {kicker: "Legal", title: "AnimalDex Terms of Service"},
    "legal/refunds": {kicker: "Legal", title: "AnimalDex Refund Policy"},

    // Use cases (/use-cases/<slug>)
    "use-cases/ai-animal-scanner-identification-app": {
        kicker: "Use case · Identify",
        title: "Scan any animal and know what it is",
        tiles: [art("red-fox", "Red Fox")]
    },
    "use-cases/wildlife-collection-animal-card-app": {
        kicker: "Use case · Collect",
        title: "Collect real animals as cards, sets and albums",
        tiles: [art("snow-leopard", "Snow Leopard"), art("axolotl", "Axolotl"), art("bald-eagle", "Bald Eagle")]
    },
    "use-cases/family-zoo-safari-animal-learning-app": {
        kicker: "Use case · Families",
        title: "Zoo and safari animal spotting for families",
        tiles: [art("giraffe", "Giraffe"), art("giant-panda", "Giant Panda"), art("plains-zebra", "Zebra")]
    },
    "use-cases/wildlife-photography-companion-app": {
        kicker: "Use case · Photography",
        title: "A companion app for wildlife photographers",
        tiles: [art("common-kingfisher", "Kingfisher")]
    },
    "use-cases/animal-breed-identifier-lookalike-guide-app": {
        kicker: "Use case · Breeds",
        title: "Identify breeds and their lookalikes",
        tiles: [art("german-shepherd", "German Shepherd"), art("siamese-cat", "Siamese Cat"), art("border-collie", "Border Collie")]
    },
    "use-cases/species-collecting-game-battles-trading-app": {
        kicker: "Use case · Battles",
        title: "Collect species, battle and trade",
        joiner: "vs",
        tiles: [art("african-lion", "Lion"), art("bengal-tiger", "Tiger")]
    },
    "use-cases/animal-breed-pricing-grading-app": {
        kicker: "Use case · Pricing",
        title: "Breed pricing and grading with real context",
        tiles: [art("golden-retriever", "Golden Retriever"), art("persian-cat", "Persian Cat")]
    },
    "use-cases/custom-animal-card-deck-creator": {
        kicker: "Use case · Card decks",
        title: "Create custom animal card decks",
        tiles: [art("jaguar", "Jaguar"), art("great-white-shark", "Great White"), art("komodo-dragon", "Komodo Dragon")]
    },
    "use-cases/animal-inspired-self-improvement-app": {
        kicker: "Use case · Self-improvement",
        title: "Grow with traits borrowed from real animals",
        tiles: [art("honey-badger", "Grit"), art("common-octopus", "Adaptability"), art("gray-wolf", "Teamwork")]
    },
    "use-cases/import-instagram-wildlife-photos": {
        kicker: "Use case · Instagram import",
        title: "Turn your Instagram wildlife photos into a collection",
        tiles: [art("atlantic-puffin", "Puffin"), art("red-panda", "Red Panda"), art("humpback-whale", "Whale")]
    },
    "use-cases/herping-field-journal": {
        kicker: "Use case · Herping",
        title: "A field journal for reptiles and amphibians",
        tiles: [art("ball-python", "Ball Python"), art("red-eyed-tree-frog", "Tree Frog"), art("green-iguana", "Iguana")]
    },

    // Collector landing pages (/<slug>)
    "animal-collection-game": {
        kicker: "Animal collection game",
        title: "Collect real species, not fantasy creatures",
        tiles: [art("red-panda", "Red Panda"), art("platypus", "Platypus"), art("fennec-fox", "Fennec Fox")]
    },
    "animal-card-collection": {
        kicker: "Animal card collection",
        title: "Premium species cards from real sightings",
        tiles: [art("bengal-tiger", "Bengal Tiger"), art("scarlet-macaw", "Scarlet Macaw"), art("great-white-shark", "Great White")]
    },
    "pokemon-like-animal-game": {
        kicker: "Pokémon-like animal game",
        title: "Catch real wildlife with collection energy",
        tiles: [art("fennec-fox", "Fennec Fox"), art("axolotl", "Axolotl"), art("capybara", "Capybara")]
    },
    "top-trumps-animal-game": {
        kicker: "Top Trumps animal game",
        title: "Real stats. Real species. Who wins?",
        joiner: "vs",
        tiles: [art("grizzly-bear", "Grizzly Bear"), art("african-lion", "Lion")]
    },
    "collect-real-animals-app": {
        kicker: "Collect real animals",
        title: "Scan, discover and build a living collection",
        tiles: [art("meerkat", "Meerkat"), art("koala", "Koala"), art("bald-eagle", "Bald Eagle")]
    },
    "custom-animal-card-deck": {
        kicker: "Custom animal card deck",
        title: "Build premium decks from real animals",
        tiles: [art("snow-leopard", "Snow Leopard"), art("american-bison", "Bison"), art("great-white-shark", "Great White")]
    },
    "animal-card-deck-creator": {
        kicker: "Animal card deck creator",
        title: "Make animal cards people want to collect",
        tiles: [art("cheetah", "Cheetah"), art("polar-bear", "Polar Bear"), art("chameleon", "Chameleon")]
    }
};
