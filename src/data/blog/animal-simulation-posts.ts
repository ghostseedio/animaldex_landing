import type {BlogPost} from "@/data/blog/types";

/**
 * The two articles that support /animal-simulation and /ecosystem-simulation
 * (docs/seo/animal-simulation-audit-2026-11-27.md, "Still to do" 4). The
 * search words live here and on those two pages, never on the home page or
 * /ark, which stay visual (owner, 2026-11-27).
 *
 * Every figure is the Ark's own: the counts are the public snapshot of
 * 27 November 2026 (02:38 UTC), and the hunts, escapes, births and deaths are
 * the first 1,000 rows of the public event log from 26 November 2026, 02:47
 * to 17:12 UTC (`/api/ark/events`). Each is dated in the text, so it stays
 * true after the Ark moves on.
 */

const ARK_ISLAND_SHARE = {
    src: "/images/og/ark-island-2026-11-12.jpg",
    alt: "The wild island of the AnimalDex Ark, rendered from the live simulation",
    width: 1200,
    height: 630,
    caption: "The Ark's wild island, rendered from the live world on 12 November 2026."
};

const ARK_WORLD_SHARE = {
    src: "/images/og/ark-world-2026-11-12.jpg",
    alt: "The two islands of the AnimalDex Ark, rendered from the live simulation",
    width: 1200,
    height: 630,
    caption: "The Ark's two islands, rendered from the live world on 12 November 2026."
};

export const animalSimulationVsSimulatorPost: BlogPost = {
    slug: "animal-simulation-vs-animal-simulator-games",
    title: "Animal Simulation vs Animal Simulator Games: The Difference",
    description: "An animal simulator game lets you play as an animal. An animal simulation runs by rules while you watch. How the two differ, and which one you are looking for.",
    publishedAt: "2026-11-27",
    updatedAt: "2026-11-27",
    featuredImage: ARK_ISLAND_SHARE,
    readingMinutes: 6,
    author: "AnimalDex",
    tags: ["Animal Simulation", "Animal Simulator", "Simulation Games", "The Ark", "Ecosystems", "AnimalDex"],
    searchIntents: [
        "animal simulation",
        "animal simulator",
        "animal simulation vs animal simulator",
        "animal simulation game",
        "realistic animal simulation",
        "animal simulation online",
        "animal simulation with real species",
        "wildlife simulation"
    ],
    speciesSlugs: [],
    relatedSlugs: ["food-web-simulation-real-species"],
    tableOfContents: [
        "Animal simulator games: you are the animal",
        "Animal simulations: the rules run it",
        "The kinds side by side",
        "Where the AnimalDex Ark fits",
        "Which one are you looking for?",
        "What the Ark is not"
    ],
    sections: [
        {
            kicker: "The short version",
            title: "Animal simulation or animal simulator?",
            paragraphs: [
                "The two phrases sound the same, and search results mix them together. They are different things.",
                "An animal simulator is a game in which you play as an animal. You steer a wolf, a cat or a goat, and the game gives you things to do.",
                "An animal simulation is a world that runs by rules. Nobody steers the animals. They eat, breed, grow old and die by what the rules say, and you watch what comes out.",
                "Most of what a search shows is the first kind. This page explains both, and the kinds in between, so you can tell which one you are looking for."
            ],
            pullQuote: "In a simulator you are the animal. In a simulation nobody is."
        },
        {
            title: "Animal simulator games: you are the animal",
            paragraphs: [
                "In an animal simulator you control one animal, or a family of them. You move it, choose what it hunts, and decide when it fights or runs. The game usually adds goals: raise cubs, claim a territory, finish quests, unlock the next animal.",
                "These games are good at one thing a simulation cannot do: they put you in the animal's place. You feel how far the next meal is and how exposed a small animal is in open ground.",
                "What they show is a designer's idea of an animal's life, shaped to be fun. The animal does what you decide, so nothing in the game tells you what the animal would have done by itself."
            ]
        },
        {
            title: "Animal simulations: the rules run it",
            paragraphs: [
                "A simulation starts from rules and lets them run. The best known is the predator and prey model taught in biology classes. It has two populations, often called rabbits and foxes. When prey are plentiful the predators multiply. Then they eat the prey down, go hungry and decline, the prey recover, and the cycle begins again.",
                "Larger simulations add more species, food for the plant eaters, seasons and space. Some give you sliders, so you can set how many of each animal there are and run it again. Others run once, for a long time, and you watch.",
                "What every simulation has in common is that the outcome is not chosen. Nobody decides that the foxes will crash in week six. It follows from the rules, which is why a simulation can surprise the people who built it."
            ]
        },
        {
            title: "The kinds side by side",
            paragraphs: ["Five kinds of thing are called an animal simulation or an animal simulator. They differ in what you do and in what runs the animals."],
            table: {
                columns: ["Kind", "What you do", "What runs the animals", "Good for"],
                rows: [
                    {cells: ["Animal simulator game", "Play as one animal", "You do", "Feeling what an animal's day is like"]},
                    {cells: ["Zoo or park builder", "Build and manage enclosures", "Needs you must keep met", "Planning and looking after animals"]},
                    {cells: ["Classroom predator and prey model", "Set the starting numbers, then run it", "Two or three equations", "Learning why populations rise and fall"]},
                    {cells: ["Ecosystem sandbox", "Add species and change the rules", "Rules you can edit", "Trying out what happens if"]},
                    {cells: ["Shared live simulation", "Watch, and add real animals", "Rules taken from each species", "Seeing real species share one world"]}
                ]
            }
        },
        {
            title: "Where the AnimalDex Ark fits",
            paragraphs: [
                "The AnimalDex Ark is the last kind: a simulation, not a simulator. Nobody plays as an animal, and nobody places one by hand.",
                "Every species in it is a real one. An animal comes aboard when someone photographs a real animal with the AnimalDex app and the capture identifies its species. On 27 November 2026 the Ark held 3,987 animals of 887 species, brought by 703 people.",
                "From then on rules built from each species' field guide run its life: what it eats, how many young it has, when it is awake and how long it lives. One Ark year passes every 14 real days.",
                "There is one run, shared by everyone, and it does not reset. It opens in a web browser on a phone or a computer, free and with nothing to download."
            ],
            inlineLinks: [
                {text: "The animal simulation, explained", slug: "animal-simulation", href: "/animal-simulation"},
                {text: "Open the Ark", slug: "ark", href: "/ark"},
                {text: "How the Ark works", slug: "ark-how-it-works", href: "/ark/how-it-works"}
            ],
            media: {type: "image", image: ARK_WORLD_SHARE}
        },
        {
            title: "Which one are you looking for?",
            paragraphs: ["The quickest way to choose is to ask what you want to do."],
            cards: [
                {label: "I want to play as an animal", body: "You want an animal simulator game. Look for one about the animal you care about, and check whether it is for one player or many."},
                {label: "I want to teach how populations rise and fall", body: "You want a classroom predator and prey model with sliders. A modelling tool built for lessons lets a class change one number and run it again."},
                {label: "I want to watch real species live by their own rules", body: "You want a simulation with real species, such as the Ark. You can follow one animal, read its life story, and see who eats whom."}
            ],
            inlineLinks: [
                {text: "The ecosystem simulation", slug: "ecosystem-simulation", href: "/ecosystem-simulation"},
                {text: "Who eats whom in the Ark", slug: "ark-food-chain", href: "/ark/food-chain"}
            ]
        },
        {
            title: "What the Ark is not",
            paragraphs: [
                "It is not a game you win. There are no levels, and you cannot speed up time or start again.",
                "It is not a scientific model either. Its rules are simplified so that one shared world can run for everyone, and the animals aboard are whichever ones people have photographed, so the mix is not nature's. Its numbers describe the Ark, not the wild."
            ]
        }
    ],
    faq: [
        {
            question: "What is the difference between an animal simulation and an animal simulator?",
            answer: "An animal simulator is a game in which you play as an animal. An animal simulation is a world that runs by rules, with nobody steering the animals, and you watch what happens."
        },
        {
            question: "Is there an animal simulation with real species?",
            answer: "Yes. The AnimalDex Ark is a live simulation in which every species is a real one, brought aboard when someone photographed a real animal. On 27 November 2026 it held 887 species."
        },
        {
            question: "Can I run an animal simulation in a browser?",
            answer: "Yes. The Ark opens in a web browser on a phone or a computer, free and with nothing to download. There is one run, shared by everyone, and it is already going."
        },
        {
            question: "Is an animal simulation scientifically accurate?",
            answer: "A classroom model is accurate about the one idea it teaches. The Ark is built from field guides with simplified rules, and it says so: its numbers describe the Ark, not the wild."
        }
    ]
};

export const foodWebSimulationPost: BlogPost = {
    slug: "food-web-simulation-real-species",
    title: "Food Web Simulation: What One Day of Real Hunts Shows",
    description: "A food chain is a line and a food web is a net. Fourteen hours of the AnimalDex Ark's public log show what a food web simulation with real species looks like.",
    publishedAt: "2026-11-27",
    updatedAt: "2026-11-27",
    featuredImage: ARK_WORLD_SHARE,
    readingMinutes: 7,
    author: "AnimalDex",
    tags: ["Food Web", "Food Chain", "Ecosystem Simulation", "Predators and Prey", "The Ark", "AnimalDex"],
    searchIntents: [
        "food web simulation",
        "food chain simulation",
        "ecosystem simulation",
        "predator prey simulation",
        "food web vs food chain",
        "food web simulation online",
        "ecosystem simulation with real species",
        "who eats whom"
    ],
    speciesSlugs: ["great-blue-heron", "red-tailed-hawk", "crested-serpent-eagle", "eastern-gray-squirrel", "red-footed-tortoise", "mallard", "little-egret", "snowy-egret"],
    relatedSlugs: ["animal-simulation-vs-animal-simulator-games"],
    tableOfContents: [
        "How the Ark builds its food web",
        "Fourteen hours of the log",
        "It is a web, not a chain",
        "Hunts fail",
        "Most deaths are not hunts",
        "The mix is not nature's",
        "What a food web simulation cannot tell you"
    ],
    sections: [
        {
            kicker: "The short version",
            title: "Food chain or food web?",
            paragraphs: [
                "A food chain is a line: grass, rabbit, fox. It is easy to draw and easy to remember.",
                "A food web is what you get when you draw every line at once. Most hunters eat several kinds of prey, and most prey are eaten by several kinds of hunter, so the lines cross and join into a net.",
                "A food web simulation lets all of those links run at the same time and shows you what happens. This page looks at one day of one: the AnimalDex Ark, a live simulation in which every species is a real one."
            ],
            pullQuote: "A food chain is a line. A food web is every line at once."
        },
        {
            title: "How the Ark builds its food web",
            paragraphs: [
                "Nobody wrote the Ark's food web by hand. Each link comes from a predator's field guide in AnimalDex. The guide's diet names particular species, or groups such as birds, fish or reptiles.",
                "A named species becomes a food link. A group reaches every species of that group aboard, with three checks: an animal never eats its own species or genus, prey from a group must be no larger than the predator, and the two must share a realm: sea, fresh water, land or air.",
                "Every link keeps the exact words of the field guide it came from, so you can see why it exists. A hunter also has to be in the same region as its prey, and it has to be hungry."
            ],
            inlineLinks: [
                {text: "See every food link aboard", slug: "ark-food-chain", href: "/ark/food-chain"},
                {text: "The ecosystem simulation, explained", slug: "ecosystem-simulation", href: "/ecosystem-simulation"}
            ]
        },
        {
            title: "Fourteen hours of the log",
            paragraphs: [
                "The Ark keeps a public log of what happens in it. We read the part from 02:47 to 17:12 UTC on 26 November 2026, a little over fourteen hours.",
                "In those hours the log named 21 meals in which one animal aboard ate another, and 7 hunts in which the prey got away. Over the same hours 60 animals were born, 16 came aboard because someone photographed a real one, and 89 died of old age.",
                "These are the hunts that happened more than once, or that show something. The last column is the word in the hunter's field guide that made the link."
            ],
            table: {
                columns: ["Hunter", "Prey (times)", "Its guide says"],
                rows: [
                    {cells: ["Great blue heron", "Little egret (2)", "birds"]},
                    {cells: ["Great blue heron", "Little blue heron (2)", "birds"]},
                    {cells: ["Great blue heron", "Snowy egret (1)", "birds"]},
                    {cells: ["Great blue heron", "Black-bellied whistling duck (1)", "birds"]},
                    {cells: ["Red-tailed hawk", "Eastern gray squirrel (2)", "rodents"]},
                    {cells: ["Red-tailed hawk", "Dark-eyed junco (1)", "birds"]},
                    {cells: ["Crested serpent eagle", "Red-footed tortoise (2)", "reptiles"]},
                    {cells: ["Crested serpent eagle", "Malayan box turtle (1)", "reptiles"]},
                    {cells: ["Black-headed ibis", "Amazon sailfin catfish (2)", "fish"]},
                    {cells: ["Javan pond heron", "Amazon sailfin catfish (1)", "fish"]},
                    {cells: ["Asian water monitor", "Mallard (1)", "birds"]}
                ]
            }
        },
        {
            title: "It is a web, not a chain",
            paragraphs: [
                "One hunter, the great blue heron, took four kinds of prey in fourteen hours: two kinds of egret, a smaller heron and a duck. Its field guide says it eats birds, and all four are birds that share its wetland.",
                "The links cross the other way too. The Amazon sailfin catfish was eaten by two different hunters, a black-headed ibis and a Javan pond heron.",
                "Draw only these hunts and you already have a net. A chain could not hold them."
            ]
        },
        {
            title: "Hunts fail",
            paragraphs: [
                "Seven hunts in the log ended with the prey getting away. Little egrets escaped a great blue heron three times. Mallards escaped an Asian water monitor twice. An eastern gray squirrel got away from a red-tailed hawk, and a mute swan got away from a mugger crocodile.",
                "So for 21 meals there were 7 escapes that the log recorded. A simple model in which every meeting is a kill would empty the wetland faster than this one does."
            ]
        },
        {
            title: "Most deaths are not hunts",
            paragraphs: [
                "In the same hours 89 animals died of old age, about four times the number that were eaten. Almost all of them were insects, such as fruit flies, moths, ants and bees, whose real lives are measured in weeks.",
                "One Ark year passes every 14 real days, so a fly that lives a month in the wild lives about a day aboard. Its kind stays only if it breeds faster than it dies.",
                "Two species lost their last animal in those hours: the autumn leaf butterfly and the rove beetle. Each is gone from the Ark until someone photographs another."
            ],
            inlineLinks: [
                {text: "Who survives in the Ark", slug: "ark-survival", href: "/tier-list/ark-survival"},
                {text: "Fastest breeders", slug: "ark-fastest-breeders", href: "/tier-list/ark-fastest-breeders"}
            ]
        },
        {
            title: "The mix is not nature's",
            paragraphs: [
                "The crested serpent eagle lives in South and Southeast Asia. The red-footed tortoise lives in South America. In the wild they never meet.",
                "Aboard the Ark they share one rainforest, because people photographed both. The eagle's field guide says it eats reptiles, the tortoise is a reptile, and so the eagle ate two.",
                "That is the plainest difference between this simulation and nature. The rules come from real species, but who is aboard is whoever people have photographed. The Ark says so on every page that explains it."
            ]
        },
        {
            title: "What a food web simulation cannot tell you",
            paragraphs: [
                "It cannot tell you how many herons or egrets live in the wild, or what would happen to a real wetland. The Ark's rules are simplified so that one shared world can run for everyone, and plants, seeds and most small food are background food that is not counted.",
                "What it can show is how a food web behaves: that links cross, that hunts fail, that the short-lived die of age long before anything catches them, and that a species with one pair left is one bad day from gone.",
                "For a lesson with sliders, use a classroom predator and prey model. To watch real species' rules play out in one world, open the Ark."
            ],
            inlineLinks: [
                {text: "Open the Ark", slug: "ark", href: "/ark"},
                {text: "The ecosystem simulation", slug: "ecosystem-simulation", href: "/ecosystem-simulation"},
                {text: "The animal simulation", slug: "animal-simulation", href: "/animal-simulation"}
            ],
            media: {type: "image", image: ARK_ISLAND_SHARE}
        }
    ],
    faq: [
        {
            question: "What is a food web simulation?",
            answer: "A simulation in which many feeding links between species run at the same time, so you can watch how hunters, prey and their numbers affect each other."
        },
        {
            question: "What is the difference between a food chain and a food web?",
            answer: "A food chain is one line of who eats whom. A food web is all the lines together: most hunters eat several kinds of prey, and most prey have several hunters."
        },
        {
            question: "Can I watch a food web simulation online?",
            answer: "Yes. The AnimalDex Ark runs in a web browser, free and with nothing to download. Its food chain page shows what each species aboard eats and what eats it."
        },
        {
            question: "Where do the Ark's food links come from?",
            answer: "From each predator's field guide in AnimalDex. Every link keeps the words of the guide it came from, and a group such as birds reaches only species aboard that pass three checks."
        }
    ]
};

export const animalSimulationPosts: BlogPost[] = [animalSimulationVsSimulatorPost, foodWebSimulationPost];
