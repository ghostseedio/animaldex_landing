export type UseCaseFAQ = {
    question: string;
    answer: string;
};

export type UseCaseSection = {
    title: string;
    paragraphs: string[];
};

export type UseCaseStep = {
    title: string;
    body: string;
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
    heroEyebrow?: string;
    heroTitle?: string;
    limitationNote?: string;
    steps?: UseCaseStep[];
    productCta?: {
        label: string;
        path: string;
        event?: string;
    };
    secondaryCta?: {
        label: string;
        path: string;
        event?: string;
    };
    experienceCta?: {
        label: string;
        href: string;
        event?: string;
    };
    audiences?: Array<{title: string; body: string}>;
    relatedSlugs?: string[];
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
        updatedAt: "2026-08-30",
        searchIntents: [
            "animal collection app",
            "wildlife collection app",
            "animal card app",
            "animal card game",
            "animal card collecting app",
            "species collecting game",
            "animal set collection game",
            "keep track of animals I have seen",
            "wildlife life list"
        ],
        productCta: {
            label: "Open your Dex",
            path: "/app/collection",
            event: "collection_start_dex"
        },
        secondaryCta: {
            label: "Import past encounters",
            path: "/use-cases/import-instagram-wildlife-photos",
            event: "collection_to_import"
        },
        relatedSlugs: ["import-instagram-wildlife-photos", "wildlife-photography-companion-app"],
        keyActions: [
            "Collect real-animal cards from your sightings",
            "Complete habitat or region-led sets",
            "Track progression through albums and missions",
            "Bring eligible older Instagram wildlife posts into the same Dex"
        ],
        whyDifferent: [
            "The collection loop is grounded in real animals and real sightings, not purely fictional entries.",
            "Set completion and progression are paired with species context and observation habits.",
            "The tone is premium and playful without losing educational value.",
            "Install day does not have to be day one: eligible past wildlife posts can join after review."
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
                title: "New encounters and past encounters",
                paragraphs: [
                    "New encounters: capture them with AnimalDex in the field. Past encounters: if you already posted wildlife on Instagram, eligible posts can become unique AnimalDex entries after you review identity and a historical place.",
                    "Imported posts build the collection. They do not add qualifying live-capture wildlife signals for Creator Rewards. Some animals stay at group level when that is the honest catalog result."
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
                title: "Bring older trip photos into the same journal",
                paragraphs: [
                    "If a zoo day or safari already lives on Instagram, a compatible professional account can import eligible animal posts after you review species and a historical location.",
                    "That keeps the family journal in one Dex instead of starting from zero on the next trip."
                ]
            },
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
        title: "Wildlife photography companion app",
        description: "Turn a stream of wildlife photos into a species archive: identity, historical place, setting, and a collection you can keep public.",
        audience: "Wildlife photographers, travel photographers, and field spotters",
        updatedAt: "2026-08-30",
        searchIntents: [
            "wildlife photography app",
            "wildlife photography tips",
            "animal scanner app for photos",
            "safari animal app",
            "respectful wildlife observation",
            "import wildlife photos from Instagram"
        ],
        productCta: {
            label: "Import your Instagram wildlife photos",
            path: "/use-cases/import-instagram-wildlife-photos",
            event: "photography_to_import"
        },
        secondaryCta: {
            label: "Open your Dex",
            path: "/app/collection",
            event: "photography_to_collection"
        },
        experienceCta: {
            label: "Find a wildlife photography Guide",
            href: "/wildlife-experiences?category=wildlife_photography#experiences",
            event: "photography_to_wildlife_experiences"
        },
        relatedSlugs: ["import-instagram-wildlife-photos", "herping-field-journal"],
        keyActions: [
            "Scan sightings captured during photography sessions",
            "Import eligible animal posts from a compatible Instagram professional account",
            "Log behavior and habitat context beside photos",
            "Build a photo-led species journal"
        ],
        whyDifferent: [
            "A camera roll is a stream. A Dex is a species archive you can search, compare, and keep public.",
            "Identification stays attached to the picture instead of living in a caption you will not trust in five years.",
            "Respectful distance is treated as technique: better photographs, fewer disturbed animals.",
            "Years of existing wildlife photos can enter the same Dex instead of starting from zero."
        ],
        sections: [
            {
                title: "The problem is not more folders",
                paragraphs: [
                    "Instagram and the camera roll are good at showing what you shot last. They are bad at answering which hornbills, which vipers, which coasts you have actually documented.",
                    "AnimalDex keeps the photograph with an identity, a historical place, and a setting (wild, zoo, farm, domestic). That is a body of work, not a feed."
                ]
            },
            {
                title: "Already have years of wildlife photos?",
                paragraphs: [
                    "Do not start from zero. Connect a compatible Instagram professional account and bring eligible wildlife posts into AnimalDex.",
                    "New encounters still belong to live capture. Past encounters — old trips, zoo visits, walks you already photographed — can join the same Dex after you review identity and a historical place. Imported posts help build your collection. Creator Rewards eligibility still relies on qualifying live contribution, not Instagram imports."
                ]
            },
            {
                title: "Identification stays attached to the picture",
                paragraphs: [
                    "A caption is not an ID. Scan a new shot, or confirm the suggestion on an imported post. When the catalog indexes a lookalike group, that group is the honest result — not a species-level name invented for the grid.",
                    "You can still shoot with whatever camera you already use. AnimalDex is the species record, not a replacement for Lightroom."
                ]
            },
            {
                title: "Location and setting are part of the photograph",
                paragraphs: [
                    "Where the animal actually was, and whether it was wild, zoo, farm, or domestic, is what makes a picture a record. Current GPS is where you are standing now. Caption place names are what you typed then. Neither is automatically the capture location of a historical photo.",
                    "If you do not know, say so. Unknown is allowed. It does not unlock import."
                ]
            },
            {
                title: "Collection progression without turning the archive into a prize",
                paragraphs: [
                    "Each confirmed species is a card in the Dex. That is collection progression: a body of work you can browse, not a scoreboard of imports.",
                    "Creator Rewards, if you later pursue them, stay tied to qualifying live contribution. A public species portfolio is still worth building without being a payout event."
                ]
            },
        ],
        faq: [
            {
                question: "Can I use AnimalDex if I mainly shoot with a phone camera?",
                answer: "Yes. The workflow is designed for both phone-first and camera-assisted spotting habits."
            },
            {
                question: "Does the app replace a full photography workflow?",
                answer: "No. It complements your workflow by improving identification and observation context."
            },
            {
                question: "Can I import wildlife photos I already posted on Instagram?",
                answer: "Yes, from a compatible Instagram professional account. AnimalDex looks for animal posts, you review species and location, and original eligible media can become AnimalDex captures."
            },
            {
                question: "Do imported Instagram posts count toward Creator Rewards?",
                answer: "No. Imported posts help build your collection, but Creator Rewards eligibility relies on qualifying live contribution."
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
            "The same app supports breed curiosity and broader wildlife learning.",
            "Links to pet identification and broader animal identification resources for complete coverage."
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
    },
    {
        slug: "import-instagram-wildlife-photos",
        shortLabel: "Instagram Wildlife Archive",
        title: "Import Your Instagram Wildlife Photos into AnimalDex",
        heroEyebrow: "You've probably already started your AnimalDex.",
        heroTitle: "How many animals have you already seen?",
        description: "Connect a compatible Instagram account and AnimalDex can scan your past wildlife posts, find animals, and help build a record of what you have already encountered. Review what it finds, confirm the details, and add eligible encounters to your AnimalDex.",
        audience: "Anyone who has already photographed wildlife — casual fans, travelers, zoo visitors, birders, herpers, and photographers",
        updatedAt: "2026-08-30",
        searchIntents: [
            "import wildlife photos from Instagram",
            "wildlife Instagram archive",
            "organize wildlife photos from Instagram",
            "animals I have seen",
            "keep track of animals I have seen",
            "animal life list app",
            "wildlife life list",
            "track animals from past trips",
            "old wildlife photos",
            "wildlife photography collection app"
        ],
        productCta: {
            label: "Check my Instagram",
            path: "/app/import/instagram",
            event: "instagram_import_cta"
        },
        relatedSlugs: ["wildlife-collection-animal-card-app", "wildlife-photography-companion-app", "herping-field-journal"],
        limitationNote: "Needs a compatible Instagram professional account. Not every post will import. Some animals stay at group-level identity when that is the honest catalog result. Your Dex becomes a clearer record after you review — AnimalDex will not invent a species count from unreviewed posts.",
        audiences: [
            {title: "Casual wildlife fans", body: "You’ve photographed animals over the years and want a record of what you’ve actually encountered — not a new feed to maintain."},
            {title: "Travelers", body: "Wildlife from old trips, safaris, and holidays can join one collection instead of staying in a year-named album."},
            {title: "Zoo and aquarium visitors", body: "Eligible animals from previous visits can become unique AnimalDex entries after you confirm what the post shows and where it was."},
            {title: "Birders", body: "Recover bird encounters you already shared rather than starting a life list from install day."},
            {title: "Herpers", body: "Bring older snake, lizard, frog, and amphibian finds into the same collection as new field captures."},
            {title: "Wildlife photographers", body: "Turn a social archive into a species-oriented body of work you can search and keep honest."},
            {title: "Marine and dive", body: "Eligible wildlife from dives and coastal trips still needs a historical place — not the harbour you are sitting in now."}
        ],
        steps: [
            {title: "Connect", body: "Connect your Instagram professional account."},
            {title: "Find", body: "AnimalDex looks through your posts for animals."},
            {title: "Review", body: "Confirm identity, location and capture details."},
            {title: "Import", body: "Add the original photos and videos to your AnimalDex."}
        ],
        keyActions: [
            "Start a wildlife life list from animals you have already encountered",
            "Connect a compatible Instagram professional account",
            "Review detected animal posts instead of re-shooting your archive",
            "Confirm a historical capture location — not today's GPS"
        ],
        whyDifferent: [
            "Most collections start today. Yours doesn’t have to.",
            "Wildlife memories often pre-date the app you eventually choose to track them in.",
            "You stay in control: AnimalDex finds candidates, you confirm what becomes a capture.",
            "Imported posts can appear in Discover, so accuracy attestation is part of the flow.",
            "Creator Rewards stay tied to qualifying live contribution, not imported archives."
        ],
        sections: [
            {
                title: "Most collections start today. Yours doesn’t have to.",
                paragraphs: [
                    "A new wildlife app usually means starting a new collection. AnimalDex is designed so eligible wildlife encounters from your existing Instagram archive can become part of your collection after review.",
                    "Your collection can start with your history — not just what you photograph tomorrow. Don’t let install day become day one."
                ]
            },
            {
                title: "How many animals have you actually encountered?",
                paragraphs: [
                    "A zoo visit five years ago. A snake you found on holiday. Birds from a morning walk. Fish from a dive. Animals from a safari. If you posted them, AnimalDex can help turn those scattered memories into a structured collection.",
                    "After review, your Dex becomes a clearer record of the different animals you have encountered over time — unique AnimalDex entries for species and supported animal groups. Some identifications stay at group level on purpose. AnimalDex will not invent a species-level name, or a species count, from posts you have not reviewed."
                ]
            },
            {
                title: "Accuracy is the point of review",
                paragraphs: [
                    "Location is a historical claim about where the animal was when you photographed it. AnimalDex does not fill that from your current GPS or from a caption guess.",
                    "Identity confirmation keeps group-level names when the catalog indexes that way. You are not forced into a species-level name the index does not support.",
                    "Imported posts become real AnimalDex captures and may publish to Discover. False or misleading details can result in an account strike."
                ]
            },
            {
                title: "Past encounters and new encounters",
                paragraphs: [
                    "Past: Instagram import. Historical encounter. You review location, identity, and setting. Eligible existing media builds the collection.",
                    "New: AnimalDex mobile capture. Live encounter. Camera and location pipeline for animals you find from now on. The two paths are not identical for every downstream system — imported content does not become qualifying live Creator Rewards contribution, and historical location is what you confirm, not current GPS."
                ]
            },
            {
                title: "What actually gets imported",
                paragraphs: [
                    "Eligible original photos and videos — not a screenshot of a grid, not a generated thumbnail as the capture file. AnimalDex downloads the original media after you approve a post.",
                    "You still review animal identity, a historical location, and setting. Candidates without a confirmed location stay out of the import queue."
                ]
            },
            {
                title: "Videos, including Reels",
                paragraphs: [
                    "Still posts are checked first. Videos are sampled when the device can play them. If a Reel cannot be sampled, that item is skipped so the rest of the archive can still be reviewed.",
                    "The iOS app can extract frames from more video cases. Import does not invent a different identification algorithm for video."
                ]
            },
            {
                title: "Imported vs live captures",
                paragraphs: [
                    "Imports build your Dex. They do not add qualifying live-capture wildlife signals. Creator Rewards stay tied to live contribution.",
                    "It is not an official Instagram or Meta product. AnimalDex is not claiming a partnership endorsement. Not every post will import."
                ]
            }
        ],
        faq: [
            {
                question: "Can I start a collection from animals I have already seen?",
                answer: "Yes. If eligible wildlife posts are already on a compatible Instagram professional account, you can review them into unique AnimalDex entries instead of starting from zero. The Dex is a clearer record after review — not a guessed species count from the feed."
            },
            {
                question: "What Instagram accounts can connect?",
                answer: "A compatible Instagram professional account is required. Personal accounts cannot always connect. If connect fails, try converting the account type Instagram supports for this login, then reconnect."
            },
            {
                question: "Can I import Instagram Reels?",
                answer: "Often yes. AnimalDex samples video frames when the device can play them, then you review the same identity and location details as still posts. If a Reel cannot be sampled on your device, that video is skipped without failing the rest of the import. You can retry later or use the iOS app."
            },
            {
                question: "Do imported posts earn Creator Rewards?",
                answer: "No. Imported content does not add qualifying live-capture wildlife signals. Creator Rewards eligibility relies on qualifying live contribution."
            }
        ]
    },
    {
        slug: "herping-field-journal",
        shortLabel: "Herping Field Journal",
        title: "Herping Field Journal & Reptile Collection App",
        heroEyebrow: "Turn every herp find",
        heroTitle: "Into part of your Dex.",
        description: "Photograph snakes, lizards, frogs and other herps, identify what you found, track your collection and bring eligible past Instagram finds with you.",
        audience: "Snake herpers, reptile hunters, amphibian watchers, and field photographers",
        updatedAt: "2026-08-30",
        searchIntents: [
            "herping app",
            "reptile tracking app",
            "snake identification journal",
            "herping field journal",
            "reptile photography app",
            "snake spotting app",
            "amphibian tracking app",
            "reptile life list",
            "herp logging app"
        ],
        productCta: {
            label: "Start your herp Dex",
            path: "/app/collection",
            event: "herping_start_dex"
        },
        secondaryCta: {
            label: "Import old Instagram finds",
            path: "/use-cases/import-instagram-wildlife-photos",
            event: "herping_to_import"
        },
        experienceCta: {
            label: "Find a herping experience",
            href: "/wildlife-experiences?category=herping#experiences",
            event: "herping_to_wildlife_experiences"
        },
        relatedSlugs: ["import-instagram-wildlife-photos", "wildlife-photography-companion-app", "identify-reptiles"],
        limitationNote: "Some herps are indexed at group level when a species-level card is not the honest catalog result. AnimalDex will not invent a species name to look more precise.",
        keyActions: [
            "Log field finds as real captures, not throwaway IDs",
            "Build a reptile and amphibian life list inside one Dex",
            "Review identity when several animals or lookalikes are in shot",
            "Import eligible Instagram wildlife posts from past trips"
        ],
        whyDifferent: [
            "A herping journal should keep location history without treating GPS as a substitute for where the animal actually was.",
            "Ethical field behaviour is framed as technique: distance, no harassment, no baiting for a photo.",
            "Instagram archives from years of night herps can enter the same collection after review."
        ],
        sections: [
            {
                title: "Log field finds without flattening them",
                paragraphs: [
                    "A snake on a warm road, a gecko on a guesthouse wall, a frog after rain — those are different records. AnimalDex keeps identification, setting, and a confirmed location with the original photo or clip.",
                    "When the catalog indexes a lookalike group instead of a species, that is preserved. Precision you cannot support is not added for the sake of a cleaner card."
                ]
            },
            {
                title: "Build a reptile and amphibian life list",
                paragraphs: [
                    "Herpers already think in lists. AnimalDex turns that herp life list into a Dex you can browse, compare, and keep public on a profile if you choose.",
                    "Snakes, lizards, frogs, and other amphibians sit in one collection. Past Instagram posts can join the same list after you confirm species and the historical place of the find."
                ]
            },
            {
                title: "Night herping and photo-first notes",
                paragraphs: [
                    "A lot of herping happens after dark, on roads, or in short windows after rain. Get a record from a safe distance, then move on. The journal is for the find, not for crowding the animal until it poses.",
                    "Field context that AnimalDex stores with a capture includes setting (wild, zoo, farm, domestic) and a location you confirm as historical — not the GPS of the kitchen table where you finally upload. Captions and trip names are hints, not coordinates."
                ]
            },
            {
                title: "Bring old Instagram finds into the same Dex",
                paragraphs: [
                    "New finds still start with a live capture. Past encounters live on Instagram until you review them in. Years of night herps often live as Instagram posts. Connect a compatible professional account, review the snake, lizard, or frog, and confirm the historical place of the find. Original eligible media becomes part of the same herp life list as tonight’s live captures.",
                    "Imported posts help build the collection. They do not add qualifying live-capture wildlife signals for Creator Rewards."
                ]
            },
            {
                title: "Document finds without disturbing wildlife",
                paragraphs: [
                    "Do not pin, flip, or bait an animal for a cleaner angle. Road cruising still means the animal's safety first, including when you stop the car.",
                    "A structured journal makes it easier to remember what you already found so you are not repeating pressure on the same stretch of road or the same individual."
                ]
            }
        ],
        faq: [
            {
                question: "Is AnimalDex a snake identification authority?",
                answer: "No. It is an educational collection app. Never handle wildlife based on an app result, and treat venomous species with full field caution."
            },
            {
                question: "Can I bring old herping Instagram posts into AnimalDex?",
                answer: "Yes, from a compatible Instagram professional account. You still confirm species and a historical location before import."
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

    const pinned = (current.relatedSlugs ?? [])
        .map((relatedSlug) => getUseCase(relatedSlug))
        .filter((entry): entry is UseCaseLanding => Boolean(entry && entry.slug !== slug));
    const pinnedSlugs = new Set(pinned.map((entry) => entry.slug));
    const scored = useCases
        .filter((entry) => entry.slug !== slug && !pinnedSlugs.has(entry.slug))
        .map((entry) => {
            const sharedIntents = entry.searchIntents.filter((intent) => current.searchIntents.includes(intent)).length;
            const sharedAudience = entry.audience === current.audience ? 1 : 0;

            return {
                entry,
                score: sharedIntents * 3 + sharedAudience
            };
        })
        .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
        .map(({entry}) => entry);

    return [...pinned, ...scored].slice(0, limit);
}
