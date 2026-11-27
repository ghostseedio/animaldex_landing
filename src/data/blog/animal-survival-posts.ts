import type {BlogPost} from "@/data/blog/types";

/**
 * The article that supports /animal-survival (docs/seo/animal-survival-audit-2026-11-27.md). Searches for animal
 * survival rates, "which animals survive best" and "what kills animals" returned thin listicles with no figures; the
 * Ark has real ones.
 *
 * Every figure is the survival ranking's own (/tier-list/ark-survival), read on 27 November 2026 at 05:45 UTC: the
 * seven days before it, place by place and cause by cause, and the record's totals since it began. Each is dated in
 * the text, so it stays true after the Ark moves on. The rules quoted are the ones /ark/how-it-works states.
 */

const ARK_WILD_ISLAND = {
    src: "/ark/poster/wild-wide.webp",
    alt: "The Ark's wild island, with the town island behind it, rendered from the live world",
    width: 1600,
    height: 900,
    caption: "The Ark's wild island, with the town island behind it, rendered from the live world in November 2026."
};

export const animalSurvivalRatesPost: BlogPost = {
    slug: "animal-survival-rates-real-species",
    title: "Animal Survival Rates: A Week of Live Data on Real Species",
    description: "Which animals survive best, and what kills the rest? A week of the AnimalDex Ark's live record: 4,825 animals of real species, by place and by cause.",
    publishedAt: "2026-11-27",
    updatedAt: "2026-11-27",
    featuredImage: ARK_WILD_ISLAND,
    readingMinutes: 6,
    author: "AnimalDex",
    tags: ["Animal Survival", "Survival Rate", "Predators and Prey", "Lifespan", "The Ark", "AnimalDex"],
    searchIntents: [
        "animal survival rate",
        "animal survival rates",
        "what animals have the best survival rate",
        "which animals survive best",
        "what kills animals",
        "animal survival data",
        "animal survival",
        "animal survival simulation"
    ],
    speciesSlugs: [],
    relatedSlugs: ["food-web-simulation-real-species", "what-is-the-most-resilient-animal"],
    tableOfContents: [
        "Survival by place",
        "Why kept animals survive",
        "What kills animals",
        "Hunting had only just begun",
        "A death is not always the end",
        "Short lives, fast replacement",
        "What this says about the wild, and what it does not"
    ],
    sections: [
        {
            kicker: "The short version",
            title: "How many animals survive a week?",
            paragraphs: [
                "A survival rate is the share of a group still alive after a stretch of time. The AnimalDex Ark is a live, shared world in which every animal is a real species, so it can measure one for every animal aboard.",
                "In the seven days to 27 November 2026, 4,825 animals spent time in the Ark. At the end of the week 83.5% of them were alive or recovering.",
                "Animals that people keep did best: 100% of farm animals, 98.6% of the zoo's animals and 98% of pets survived the week. On the wild island 79.2% survived, and among the wild animals living around the town, only 63.7%.",
                "Old age caused 94% of the deaths. Predators caused 6%, and hunger less than half of one percent."
            ],
            pullQuote: "Nearly every kept animal survived the week. More than one in three of the town's wild animals did not.",
            inlineLinks: [
                {text: "Animal survival, live", slug: "animal-survival", href: "/animal-survival"},
                {text: "The survival ranking, updated hourly", slug: "ark-survival", href: "/tier-list/ark-survival"}
            ]
        },
        {
            title: "Survival by place",
            paragraphs: [
                "Every animal in the Ark lives in one of five places. Pets, farm animals and zoo animals live where their real ones were photographed. Wild animals live on the wild island, except those that live around people, such as house geckos and sparrows, which live in the town.",
                "Still alive counts the animals that recovered or are recovering, because they come back. Lost for good counts the ones that did not."
            ],
            table: {
                columns: ["Place", "Still alive", "Lost for good", "Aboard now"],
                rows: [
                    {cells: ["Farms", "100%", "0", "169"]},
                    {cells: ["Zoo", "98.6%", "9", "641"]},
                    {cells: ["Homes", "98%", "28", "1,362"]},
                    {cells: ["Wild island", "79.2%", "253", "945"]},
                    {cells: ["Town wildlife", "63.7%", "505", "860"]}
                ]
            }
        },
        {
            title: "Why kept animals survive",
            paragraphs: [
                "Pets, farm animals and the zoo's animals are fed by their keepers. They do not hunt and are never hunted. Old age is almost the only thing that takes them, so almost all of them were alive at the end of the week.",
                "Wild animals have to find food in their own region and keep away from the predators that share it. The town's wildlife, such as house geckos, sparrows, flies and ants, lives by the same rules: it finds its own food and can be hunted. More of it is short-lived."
            ]
        },
        {
            title: "What kills animals",
            paragraphs: ["The Ark records every death and its cause. This is the week to 27 November 2026."],
            table: {
                columns: ["Cause", "Deaths", "Lost for good"],
                rows: [
                    {cells: ["Old age", "1,318", "778"]},
                    {cells: ["Predators", "81", "15"]},
                    {cells: ["Hunger", "6", "2"]}
                ]
            },
            subsections: [
                {
                    title: "Why old age comes first",
                    paragraphs: [
                        "Every species with a known wild lifespan grows old and dies when it reaches it. Lifespans run on the Ark's clock: one Ark year passes every 14 real days, so a fly that lives a month in the wild lives about a day aboard.",
                        "The Ark holds many insects, from fruit flies to honey bees, and their lives are short, so most of the deaths are theirs."
                    ]
                }
            ]
        },
        {
            title: "Hunting had only just begun",
            paragraphs: [
                "For its first two weeks, until about 25 November 2026, the Ark gave every animal a head start: nothing that came aboard could be hunted. All 81 deaths to predators in the record came after that, in the last days of this week.",
                "So this week shows only a few days of hunting. A week from now the share taken by predators may look different, and the survival ranking will show it as it happens."
            ],
            inlineLinks: [{text: "Who eats whom in the Ark", slug: "ark-food-chain", href: "/ark/food-chain"}]
        },
        {
            title: "A death is not always the end",
            paragraphs: [
                "Of the week's 1,405 deaths, 795 were final. In the other 610 the animal had a heart left, so it recovered and came back, or is still recovering.",
                "When the last animal of a species is lost for good, that species is gone from the Ark until someone photographs a real one with AnimalDex and one of its kind comes aboard."
            ]
        },
        {
            title: "Short lives, fast replacement",
            paragraphs: [
                "The species at the top of this week's risk ranking were all short-lived: butterflies and moths whose lives aboard last a few real days, and small rodents such as the Malaysian field rat and the house mouse, whose lives last a few real weeks. Each had one or two aboard.",
                "A short-lived species survives as a kind only by breeding faster than it dies. Births have not kept up: since the Ark's record began it has counted 1,677 births and 2,190 deaths, 81 of them to predators. New captures of real animals bring the rest aboard."
            ]
        },
        {
            title: "What this says about the wild, and what it does not",
            paragraphs: [
                "These are the Ark's survival rates, not the wild's. Its rules are simplified from field guides so that one shared world can run for everyone, and who is aboard is whoever people have photographed, so the mix is not nature's.",
                "The record also leaves out the hardest part of most wild lives. In the wild, many species lose most of their eggs and young before they grow up, and the Ark does not count lost eggs yet.",
                "What it does show is the shape of survival: cared-for animals outlive wild ones, age takes the short-lived first, and a species with one or two left is close to the end."
            ],
            inlineLinks: [
                {text: "Open the Ark", slug: "ark", href: "/ark"},
                {text: "Animal survival, live", slug: "animal-survival", href: "/animal-survival"},
                {text: "The ecosystem simulation", slug: "ecosystem-simulation", href: "/ecosystem-simulation"}
            ]
        }
    ],
    faq: [
        {
            question: "What is an animal survival rate?",
            answer: "The share of a group of animals still alive after a stretch of time. In the AnimalDex Ark, 83.5% of the animals there in the week to 27 November 2026 were alive or recovering at the end of it."
        },
        {
            question: "Which animals have the best survival rate in the Ark?",
            answer: "Animals people keep. In the week to 27 November 2026, 100% of farm animals, 98.6% of zoo animals and 98% of pets survived, because their keepers feed them and nothing hunts them."
        },
        {
            question: "What kills most animals in the Ark?",
            answer: "Old age: 94% of the deaths in the week to 27 November 2026. Short-lived species such as insects reach the end of their lives within days on the Ark's clock."
        },
        {
            question: "Are these real-world survival rates?",
            answer: "No. They describe the Ark, a simulation built from field guides with simplified rules, in which the animals aboard are whichever ones people have photographed."
        }
    ]
};

export const animalSurvivalPosts: BlogPost[] = [animalSurvivalRatesPost];
