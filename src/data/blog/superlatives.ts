import type {BlogPost, BlogSectionTable} from "@/data/blog/types";
import {getExpandedRankingEntries, getRankingPage, type RankingEntry} from "@/data/rankings";
import {getSpeciesBySlug} from "@/data/species";

/*
 * "Most X animal" articles that sit next to the tier lists of the same name.
 * The ranked sections are built from the tier list data in rankings.ts so the
 * article and /tier-list/<slug> can never disagree about order or reasons.
 */

const DATE = "2026-10-07";

/** Top ten exactly as the tier list table shows it (stat lists are computed). */
function tierListTopTen(rankingSlug: string): RankingEntry[] {
    const page = getRankingPage(rankingSlug);

    if (!page) {
        return [];
    }

    return page.statRankingKey ? getExpandedRankingEntries(page).slice(0, 10) : page.entries.slice(0, 10);
}

/** The editorial entries curated on the tier list page. */
function curatedEntries(rankingSlug: string): RankingEntry[] {
    return getRankingPage(rankingSlug)?.entries.slice(0, 10) ?? [];
}

function speciesName(slug: string) {
    return getSpeciesBySlug(slug)?.name
        ?? slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function nameList(entries: RankingEntry[], count = 3) {
    const names = entries.slice(0, count).map((entry) => speciesName(entry.speciesSlug));

    if (names.length < 2) {
        return names.join("");
    }

    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function rankingTable(entries: RankingEntry[], strengthLabel = "Strength"): BlogSectionTable {
    return {
        columns: ["Rank", "Animal", strengthLabel, "Why it ranks"],
        rows: entries.map((entry) => ({
            cells: [`#${entry.rank}`, speciesName(entry.speciesSlug), entry.primaryMetric, entry.shortReason]
        }))
    };
}

function slugsOf(entries: RankingEntry[]) {
    return entries.map((entry) => entry.speciesSlug);
}

function tierLink(rankingSlug: string, text: string) {
    return {text, slug: rankingSlug, href: `/tier-list/${rankingSlug}`};
}

function postLink(slug: string, text: string) {
    return {text, slug, href: `/blog/${slug}`};
}

const agile = tierListTopTen("most-agile-animals");
const adaptable = tierListTopTen("most-adaptable-animals");
const resilient = tierListTopTen("most-resilient-animals");
// Rows 11–20 of the tier list: the curated ten lead the table, then species
// follow by the catalog intelligence stat.
const smartestTable = (() => {
    const page = getRankingPage("smartest-animals");
    return page ? getExpandedRankingEntries(page).slice(10, 20) : [];
})();
const smartestCurated = curatedEntries("smartest-animals");
const dangerous = tierListTopTen("most-dangerous-animals");

const agilePost: BlogPost = {
    slug: "what-is-the-most-agile-animal",
    canonicalUrl: "https://animaldex.app/blog/what-is-the-most-agile-animal",
    title: "What Is the Most Agile Animal? 10 Most Agile Animals",
    description: "The octopus is the most agile animal; peregrine falcons, dragonflies and cheetahs lead in the air and on land. The 10 most agile animals, explained.",
    publishedAt: DATE,
    updatedAt: DATE,
    author: "AnimalDex",
    featuredImage: {
        src: "/images/blog/what-is-the-most-agile-animal/dragonfly-in-flight.webp",
        alt: "Blue-faced darner dragonfly (Coryphaeschna adnexa) in flight with all four wings spread",
        width: 1400,
        height: 933,
        caption: "A blue-faced darner in flight; each of a dragonfly's four wings is driven by its own muscles. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
    },
    readingMinutes: 11,
    tags: ["Animal rankings", "Agility", "Animal movement", "Biomechanics"],
    searchIntents: ["most agile animal", "agile animals", "most agile animal in the world", "most agile land animal", "most agile bird", "agility vs speed animals"],
    speciesSlugs: slugsOf(agile),
    relatedSlugs: ["what-is-the-most-adaptable-animal", "what-is-the-most-resilient-animal", "what-is-the-most-dangerous-animal"],
    tableOfContents: [
        "Quick answer: the most agile animal",
        "The 10 most agile animals, ranked",
        "Why the top five are so agile",
        "Most agile animals by category: air, land and water",
        "How agility is measured, and the common myths",
        "Where to watch agile animals yourself"
    ],
    sections: [
        {
            title: "Quick answer: the most agile animal",
            paragraphs: [
                "The octopus is the most agile animal in the world when agility means changing shape, speed and direction quickly while staying in control. It has no skeleton, so any part of its body can bend, twist or flatten; the only rigid part is its parrot-like beak, which means an octopus can pour itself through a gap not much wider than that beak. It walks on its arms, swims by jet propulsion, and switches between the two in a fraction of a second.",
                "Other environments have their own winners. The peregrine falcon is the most agile bird at speed, correcting its line during dives faster than 300 km/h. The dragonfly is the most agile flier for its size: it hovers, flies backwards and intercepts prey in mid-air. The cheetah is the most agile land animal, because its hunts are won by acceleration, braking and turning rather than top speed. Dolphins lead among fast swimmers.",
                "Agility is not the same thing as speed. A fast animal covers ground quickly in a straight line; an agile animal changes what it is doing quickly and still lands where it meant to. That is why the AnimalDex tier list puts a boneless mollusc above the cheetah, and why the fastest animal on Earth, the diving peregrine, earns its place here for what it does at the end of the dive rather than for the dive itself."
            ],
            inlineLinks: [
                tierLink("most-agile-animals", "Most agile animals tier list (top 100)"),
                postLink("fastest-animal-in-the-world", "Fastest animal in the world"),
                postLink("what-is-the-most-adaptable-animal", "What is the most adaptable animal?"),
                {text: "Octopus species page", slug: "octopus"}
            ]
        },
        {
            title: "The 10 most agile animals, ranked",
            paragraphs: [
                `This is the same top ten as the AnimalDex most agile animals tier list, in the same order, led by the ${nameList(agile)}. Each entry names the kind of agility the animal shows, because a falcon's agility and a jumping spider's are different skills: one corrects a path at extreme speed, the other places its whole body on a target a few centimetres away.`,
                "The list mixes air, land and water on purpose. Ranking only land mammals would hand the title to the cheetah by default and hide the animals that do the hardest manoeuvring: the ones that turn in three dimensions, change body shape, or strike in thousandths of a second."
            ],
            table: rankingTable(agile, "Type of agility"),
            speciesSlugs: slugsOf(agile),
            inlineLinks: [tierLink("most-agile-animals", "See all 100 on the most agile animals tier list")]
        },
        {
            title: "Why the top five are so agile",
            paragraphs: [
                "Each of the top five solves a different movement problem, and each has been measured closely enough that the ranking rests on more than reputation."
            ],
            media: {
                type: "image",
                image: {
                    src: "/images/blog/what-is-the-most-agile-animal/common-octopus.webp",
                    alt: "Common octopus (Octopus vulgaris) spread across algae-covered rock on the seabed in Portugal",
                    width: 1400,
                    height: 933,
                    caption: "A common octopus moulding its body to rock and algae in Arrábida Natural Park, Portugal. Photo: Diego Delso, CC BY-SA 4.0, via Wikimedia Commons."
                }
            },
            subsections: [
                {
                    title: "Octopus: a body that can go anywhere",
                    paragraphs: [
                        "A common octopus has around 500 million neurons, and about two-thirds of them sit in its arms rather than its central brain. Each arm can sense, grip and adjust its own movement while the brain sets the goal, so eight limbs with hundreds of independently controlled suckers work at once without tangling.",
                        "For escapes it switches to jet propulsion: water drawn into the mantle cavity is forced out through the siphon, and because the siphon can be aimed, the octopus steers the jet. It can go from motionless to a burst of speed, change direction, release ink, and flatten into a crevice that would stop any vertebrate of the same weight."
                    ]
                },
                {
                    title: "Peregrine falcon: control at extreme speed",
                    paragraphs: [
                        "Peregrines hunt other birds in the air, usually by stooping from height, and dives above 320 km/h (200 mph) have been measured. Speed alone would make them miss. A 2017 study in PNAS by Brighton, Thomas and Taylor tracked attacking falcons with onboard cameras and GPS and found that their flight paths follow proportional navigation, the guidance law used by many homing missiles: the falcon turns at a rate proportional to how fast its line of sight to the target is rotating.",
                        "That lets a peregrine keep correcting during the stoop and still connect with a pigeon that dodges at the last moment, then pull out of the dive under heavy g-forces."
                    ],
                    media: {
                        type: "image",
                        image: {
                            src: "/images/blog/what-is-the-most-agile-animal/peregrine-falcon-flight.webp",
                            alt: "Peregrine falcon (Falco peregrinus) gliding with wings spread against a pale blue sky",
                            width: 1400,
                            height: 934,
                            caption: "A peregrine falcon in Yellowstone; its attack paths follow the same guidance law as a homing missile. Photo: Yellowstone National Park, Public domain, via Wikimedia Commons."
                        }
                    }
                },
                {
                    title: "Dolphin: turning in three dimensions",
                    paragraphs: [
                        "Dolphins combine bursts of more than 30 km/h with tight turns. They steer with the pectoral flippers, stabilise with the dorsal fin, and flex the body hard in the vertical plane, which is why they can leap, twist and re-enter the water cleanly. Spinner dolphins make several full rotations in a single leap. Bottlenose dolphins hunting in shallow water chase fish across mud banks and turn on their sides to follow them through channels barely deeper than their bodies."
                    ]
                },
                {
                    title: "Dragonfly: four wings, four controllers",
                    paragraphs: [
                        "A dragonfly drives each of its four wings with its own flight muscles, so it can change the angle and timing of each wing separately. The result is an insect that hovers, flies sideways and backwards, and turns sharply within a few wingbeats. A 2014 study in Nature by Mischiati and colleagues showed that dragonflies steer to intercept prey by predicting where it will be, using internal models of their own body and the target's motion, and lab studies of some species record capture success rates above 90 percent."
                    ]
                },
                {
                    title: "Cheetah: braking and turning, not just top speed",
                    paragraphs: [
                        "In 2013 Alan Wilson's team published the first detailed tracking of wild cheetahs in Nature, using GPS and motion-sensor collars on cheetahs in Botswana across 367 runs. The fastest run reached 25.9 m/s, about 93 km/h, but most hunts happened well below top speed. What decided them was how hard the cat could accelerate, brake and turn as the prey cut away. The long tail swings as a counterweight in turns, and the semi-retractable claws grip the ground like running spikes."
                    ]
                }
            ],
            cards: [
                {label: "Jumping spider", body: "Leaps many times its own body length with a hydraulic push: it raises its blood pressure to straighten its back legs, because spider legs lack extensor muscles at two joints. Large forward eyes judge distance, and it fixes a silk safety line before it jumps."},
                {label: "Cuttlefish", body: "A fin running around the whole body lets it hover, drift and reverse with fine control, while the jet handles escapes. Its two feeding tentacles shoot out to grab prey in a fraction of a second."},
                {label: "Mantis shrimp", body: "The peacock mantis shrimp's club accelerates at more than 10,000 g and reaches about 23 m/s, fast enough to form cavitation bubbles in the water (Patek and colleagues, Nature, 2004)."},
                {label: "Leopard", body: "Climbs with kills heavier than itself, moves along branches, and comes down trunks head first. Few large predators are this precise in cluttered, vertical terrain."},
                {label: "Secretarybird", body: "Kills snakes by stamping on them. Measurements published in 2016 found a kick force of about five times the bird's body weight, delivered in roughly 15 milliseconds and aimed at the snake's head."}
            ]
        },
        {
            title: "Most agile animals by category: air, land and water",
            paragraphs: [
                "Ask which animal is the most agile and the honest answer depends on where it moves. These are the category winners most biologists would recognise, with the reason each one leads."
            ],
            table: {
                columns: ["Category", "Most agile", "Why it leads"],
                rows: [
                    {cells: ["Air, at speed", "Peregrine falcon", "Keeps correcting its line during dives above 300 km/h and intercepts birds that dodge"]},
                    {cells: ["Air, close manoeuvring", "Dragonfly", "Four independently driven wings: hovers, flies backwards, predicts the prey's path"]},
                    {cells: ["Hovering bird", "Hummingbirds", "The only birds that sustain hovering and can fly backwards"]},
                    {cells: ["Land, open ground", "Cheetah", "Hunts are won by acceleration, braking and turning at speed"]},
                    {cells: ["Land, trees", "Gibbons", "Swing arm over arm through the canopy, letting go between handholds"]},
                    {cells: ["Land, cliffs", "Alpine ibex and mountain goat", "Split, flexible hooves grip ledges on near-vertical rock"]},
                    {cells: ["Water, open sea", "Dolphins", "Tight turns at speed, leaps and spins"]},
                    {cells: ["Water, close quarters", "Octopus", "No skeleton: squeezes, jets and changes shape on the move"]},
                    {cells: ["Pets", "Cat", "The righting reflex turns a falling cat feet-down in a fraction of a second"]}
                ]
            },
            inlineLinks: [
                {text: "Peregrine falcon", slug: "peregrine-falcon"},
                {text: "Ruby-throated hummingbird", slug: "ruby-throated-hummingbird"},
                {text: "Alpine ibex", slug: "alpine-ibex"},
                {text: "Mountain goat", slug: "mountain-goat"},
                {text: "Domestic cat", slug: "domestic-cat"}
            ],
            speciesSlugs: ["peregrine-falcon", "ruby-throated-hummingbird", "alpine-ibex", "cat"]
        },
        {
            title: "How agility is measured, and the common myths",
            paragraphs: [
                "In biomechanics, agility is the rate at which an animal can change its velocity: speeding up, slowing down and changing direction. Researchers measure it as peak acceleration and deceleration, turning radius, how fast the body rotates, and how long the animal takes to respond to a target that moves. The tools are high-speed video for small animals such as dragonflies and mantis shrimp, motion-sensor collars for cheetahs, and onboard cameras and GPS for falcons.",
                "Size matters. As animals get smaller, the force their muscles produce shrinks more slowly than their mass and inertia, so small animals can turn and accelerate faster relative to their size. Fruit flies can bank away from a looming threat in well under a tenth of a second. That is one reason insects, spiders and small birds dominate the manoeuvring end of any agility list, and why a large animal that is still agile, such as a leopard, is impressive."
            ],
            cards: [
                {label: "Myth: the fastest animal is the most agile", body: "Top speed and agility are separate measurements. Many fast animals are poor at turning, and the cheetah's own hunts are decided by braking and cornering, not by the straight-line record."},
                {label: "Myth: the cat is the most agile animal", body: "Cats are among the most agile mammals, with a righting reflex that rotates them in mid-air, but they do not out-turn a dragonfly or out-manoeuvre an octopus in a confined space."},
                {label: "Myth: flexibility is agility", body: "Flexibility helps only when it is controlled. The octopus ranks first because it pairs an unlimited range of motion with fine control of every arm."},
                {label: "Myth: big animals can't be agile", body: "Leopards, gibbons and dolphins weigh tens to hundreds of kilograms and still move with precision. Big animals have to work harder for it, which is why they are rarer on the list."}
            ]
        },
        {
            title: "Where to watch agile animals yourself",
            paragraphs: [
                "Several animals on this list are easy to see. Dragonflies patrol ponds and slow rivers on warm, sunny days from late spring to early autumn, and their hunting flights are easiest to follow along a stretch of bank. Jumping spiders hunt on sunlit walls, fences and window frames. Peregrines nest on cathedrals, bridges and office towers in many cities, and local nest cameras often show where to look. Dolphins can be watched from headlands and ferries in many coastal regions.",
                "If you want to keep a record, AnimalDex captures are live photos taken in the app, not gallery uploads, so the moment you log is the moment you saw the animal. Keep your distance from nesting falcons and never chase marine mammals for a closer shot."
            ],
            inlineLinks: [
                postLink("wildlife-photography-without-disturbing-animals", "Wildlife photography without disturbing animals"),
                postLink("why-jumping-spiders-are-so-precise", "Why jumping spiders are so precise"),
                {text: "Wildlife photography companion app", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}
            ]
        }
    ],
    faq: [
        {
            question: "What is the most agile animal in the world?",
            answer: "The octopus is the most agile animal overall. It has no skeleton, controls each arm semi-independently, and switches between crawling, jetting and squeezing through gaps in a fraction of a second. In the air the peregrine falcon and the dragonfly lead, on land the cheetah leads, and among fast swimmers dolphins are the most agile."
        },
        {
            question: "What is the most agile land animal?",
            answer: "The cheetah is the most agile land animal. Collar studies of wild cheetahs in Botswana showed that hunts are won by acceleration, braking and sharp turns rather than top speed, with the tail acting as a counterweight. In trees, gibbons and leopards are the most agile; on cliffs, ibex and mountain goats are."
        },
        {
            question: "What is the most agile bird?",
            answer: "The peregrine falcon is the most agile bird at high speed: it keeps correcting its course during dives above 300 km/h and catches birds that dodge at the last moment. For close manoeuvring, hummingbirds are the most agile birds, because they can hover in place and fly backwards, which no other bird group sustains."
        },
        {
            question: "What is the most agile insect?",
            answer: "The dragonfly is the most agile insect. Each of its four wings is driven by its own muscles, so it can hover, fly sideways and backwards, and turn within a few wingbeats. Dragonflies also predict where their prey is going and steer to intercept it, and some species catch prey in more than nine of every ten attempts in lab studies."
        },
        {
            question: "Is a cat the most agile animal?",
            answer: "No, but cats are among the most agile mammals. Their flexible spine and righting reflex let them turn feet-down in mid-air and land from falls that would injure other animals. On a full ranking across air, land and water, the octopus, peregrine falcon, dragonfly, dolphin and cheetah all rank higher."
        },
        {
            question: "Is agility the same as speed?",
            answer: "No. Speed is how fast an animal can travel; agility is how quickly it can change speed and direction while staying in control. The peregrine falcon is both the fastest animal and highly agile, but many fast animals turn poorly. Small animals are often more agile than large ones because they carry less inertia."
        }
    ],
    sources: [
        {label: "Brighton, Thomas and Taylor, Terminal attack trajectories of peregrine falcons are described by the proportional navigation guidance law of missiles, PNAS (2017)", href: "https://doi.org/10.1073/pnas.1714532114"},
        {label: "Wilson et al., Locomotion dynamics of hunting in wild cheetahs, Nature (2013)", href: "https://doi.org/10.1038/nature12295"},
        {label: "Mischiati et al., Internal models direct dragonfly interception steering, Nature (2014)", href: "https://doi.org/10.1038/nature14045"},
        {label: "Patek, Korff and Caldwell, Deadly strike mechanism of a mantis shrimp, Nature (2004)", href: "https://doi.org/10.1038/428819a"},
        {label: "Portugal et al., The fast and forceful kicking strike of the secretary bird, Current Biology (2016)", href: "https://doi.org/10.1016/j.cub.2015.12.004"}
    ]
};

const adaptablePost: BlogPost = {
    slug: "what-is-the-most-adaptable-animal",
    canonicalUrl: "https://animaldex.app/blog/what-is-the-most-adaptable-animal",
    title: "What Is the Most Adaptable Animal? 10 Most Adaptable Animals",
    description: "The red fox is the most adaptable wild animal, from Arctic tundra to city streets. The 10 most adaptable animals, why they thrive and how it's measured.",
    publishedAt: DATE,
    updatedAt: DATE,
    author: "AnimalDex",
    featuredImage: {
        src: "/images/blog/what-is-the-most-adaptable-animal/urban-red-fox.webp",
        alt: "Red fox (Vulpes vulpes) stretching on the ground beside a wooden post in Sapporo, Japan",
        width: 1400,
        height: 788,
        caption: "A red fox in Sapporo, Japan, photographed for an urban wildlife series. Photo: MIKI Yoshihito from Sapporo City, Hokkaido, Japan, CC BY 2.0, via Wikimedia Commons."
    },
    readingMinutes: 9,
    tags: ["Animal rankings", "Adaptability", "Urban wildlife", "Invasive species"],
    searchIntents: ["most adaptable animal", "most adaptable animals", "what animal can adapt to any environment", "most adaptable animal in the world", "adaptable animals examples", "most adaptable mammal"],
    speciesSlugs: slugsOf(adaptable),
    relatedSlugs: ["what-is-the-most-resilient-animal", "what-is-the-smartest-animal", "what-is-the-most-agile-animal"],
    tableOfContents: [
        "Quick answer: the most adaptable animal",
        "The 10 most adaptable animals, ranked",
        "Why the top five adapt so well",
        "Other famous adapters: rats, pigeons, coyotes and cockroaches",
        "Most adaptable animals by category",
        "How adaptability is measured, and the common myths"
    ],
    sections: [
        {
            title: "Quick answer: the most adaptable animal",
            paragraphs: [
                "The red fox is the most adaptable wild animal in the world. It has the largest natural range of any wild member of the carnivore order, spread across North America, Europe, Asia and North Africa, and it lives on Arctic tundra, farmland, forest, desert edges, mountains and in the middle of cities such as London, Zurich and Tokyo. It eats rodents, rabbits, birds, insects, earthworms, fruit, carrion and food waste, and it shifts between them with the season.",
                "Humans are more adaptable still, and a handful of animals that live alongside us, such as brown rats, rock pigeons and some cockroaches, rival the fox in cities. Among wild animals that make a living on their own terms, though, nothing matches the fox's mix of climate range, habitat range and diet. Crows, wolves, peregrine falcons and leopards follow on the AnimalDex tier list.",
                "Adaptability here means how well a species copes with conditions that change or differ from place to place, whether by changing its behaviour, its diet or its habitat. It is not the same as being tough. An animal that survives extremes by shutting down, such as a tardigrade, is resilient; an animal that keeps working by changing what it does is adaptable."
            ],
            inlineLinks: [
                tierLink("most-adaptable-animals", "Most adaptable animals tier list (top 100)"),
                postLink("what-is-the-most-resilient-animal", "What is the most resilient animal?"),
                postLink("what-is-the-smartest-animal", "What is the smartest animal?"),
                {text: "Red fox species page", slug: "red-fox"}
            ]
        },
        {
            title: "The 10 most adaptable animals, ranked",
            paragraphs: [
                `This is the same top ten as the AnimalDex most adaptable animals tier list, in the same order, led by the ${nameList(adaptable)}. The list rewards three different routes to adaptability: flexible behaviour and learning (crow, octopus, dolphin), a broad range and diet (red fox, wolf, leopard), and the ability to take over new places, including places humans built (peregrine falcon, American bullfrog, lionfish).`,
                "Two entries are there for uncomfortable reasons. The bullfrog and the lionfish rank because they are invasive: their success in ecosystems they never evolved in is hard proof of how flexible they are, even though it is bad news for the native species around them."
            ],
            table: rankingTable(adaptable, "Type of adaptability"),
            speciesSlugs: slugsOf(adaptable),
            inlineLinks: [tierLink("most-adaptable-animals", "See all 100 on the most adaptable animals tier list")]
        },
        {
            title: "Why the top five adapt so well",
            paragraphs: [
                "The top five have little in common physically. What they share is a broad menu and the behavioural flexibility to change it."
            ],
            subsections: [
                {
                    title: "Red fox: one species, almost every habitat",
                    paragraphs: [
                        "Red foxes weigh only a few kilograms, but they are true generalists: they hunt voles by hearing them under snow and pouncing, cache surplus food, eat fruit and beetles in late summer, and raid bins in cities. Foxes moved into British suburbs in the 20th century and now live in most large towns there. People introduced red foxes to Australia in the 19th century for hunting, and within decades they had spread across most of the mainland, where they have contributed to the decline of many small native mammals."
                    ]
                },
                {
                    title: "Crow: learning as a survival tool",
                    paragraphs: [
                        "Crows eat almost anything and learn fast. Carrion crows in Sendai, Japan, learned to drop walnuts at road crossings so passing cars would crack them, then wait for the lights before collecting the pieces. American crows remember dangerous people for years and teach other crows to avoid them, and they gather in winter roosts of thousands where information about food sources spreads."
                    ],
                    media: {
                        type: "image",
                        image: {
                            src: "/images/blog/what-is-the-most-adaptable-animal/american-crow.webp",
                            alt: "American crow (Corvus brachyrhynchos) standing on a pebble shoreline with seaweed",
                            width: 1400,
                            height: 933,
                            caption: "An American crow foraging on a shoreline; the species eats almost anything from carrion to grain. Photo: TRinaud, CC BY 4.0, via Wikimedia Commons."
                        }
                    }
                },
                {
                    title: "Wolf: the same predator from Arctic to desert",
                    paragraphs: [
                        "Before centuries of persecution, the gray wolf had one of the largest ranges of any land mammal, from Arctic islands to the deserts of the Arabian Peninsula and India. Packs adjust their hunting to what is available, from moose and bison to deer, beavers and hares, and coastal wolves in British Columbia swim between islands and catch salmon."
                    ]
                },
                {
                    title: "Peregrine falcon: cities as cliffs",
                    paragraphs: [
                        "Peregrines breed on every continent except Antarctica. They naturally nest on cliff ledges, and tall buildings, bridges and cathedrals offer the same thing, with a ready supply of pigeons. After DDT poisoning wiped out much of the population in the mid-20th century, the species recovered so well, helped by city nest sites, that it was removed from the US endangered species list in 1999."
                    ]
                },
                {
                    title: "Leopard: the most widespread big cat",
                    paragraphs: [
                        "The leopard has the widest distribution of any wild cat, from rainforest and savanna in Africa to mountains, scrub and temperate forest in Asia as far as the Russian Far East. It eats anything from dung beetles to antelope, hunts mostly at night near people, and survives on the edge of cities: leopards live in Sanjay Gandhi National Park inside the city limits of Mumbai."
                    ]
                }
            ],
            speciesSlugs: ["red-fox", "crow", "wolf", "peregrine-falcon", "leopard"]
        },
        {
            title: "Other famous adapters: rats, pigeons, coyotes and cockroaches",
            paragraphs: [
                "Some of the most adaptable animals on Earth do not make the top ten because their success depends on us. They are still worth knowing, because they are the animals most people see every day."
            ],
            media: {
                type: "image",
                image: {
                    src: "/images/blog/what-is-the-most-adaptable-animal/brown-rat.webp",
                    alt: "Brown rat (Rattus norvegicus) walking along the edge of still water with a nut in its mouth",
                    width: 1400,
                    height: 933,
                    caption: "A brown rat carrying food at a pond edge in Drenthe, the Netherlands. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
                }
            },
            cards: [
                {label: "Brown rat", body: "Has followed people to every continent except Antarctica. It eats almost anything, breeds year-round, and lives in sewers, farms, docks and riverbanks. A female can produce several litters a year."},
                {label: "Rock pigeon", body: "A cliff-nesting bird by origin, it treats building ledges as cliffs and city squares as open feeding ground. Feral pigeons now live in towns on every inhabited continent."},
                {label: "Coyote", body: "Once mostly an animal of the western plains and deserts, the coyote spread across nearly all of North America in the 20th century as wolves were removed, and it now lives in Chicago, Los Angeles and New York."},
                {label: "Cockroaches", body: "A few of the roughly 4,600 cockroach species, such as the German and American cockroach, live almost entirely with people, tolerate starvation for weeks and eat nearly any organic matter."}
            ],
            inlineLinks: [
                {text: "Brown rat", slug: "brown-rat"},
                {text: "Coyote", slug: "coyote"},
                {text: "Cockroach", slug: "cockroach"},
                {text: "House sparrow", slug: "house-sparrow"}
            ],
            speciesSlugs: ["coyote", "cockroach"]
        },
        {
            title: "Most adaptable animals by category",
            paragraphs: [
                "Adaptability comes in different forms, and the best example changes with the question being asked."
            ],
            table: {
                columns: ["Question", "Best answer", "Why"],
                rows: [
                    {cells: ["Most adaptable wild mammal", "Red fox", "Largest natural range of any wild carnivore, very broad diet and habitat range"]},
                    {cells: ["Most adaptable bird", "Crows", "Generalist diet plus learning, memory and social spreading of new tricks"]},
                    {cells: ["Best adapted to cities", "Peregrine falcon, red fox, brown rat, rock pigeon", "Treat buildings as cliffs or dens and human food as a resource"]},
                    {cells: ["Best at invading new places", "Lionfish, American bullfrog", "Few predators where introduced, broad diet, fast breeding"]},
                    {cells: ["Most adaptable marine animal", "Bottlenose dolphin", "Local hunting cultures, from sponge tools to cooperating with fishers"]},
                    {cells: ["Survives the widest conditions", "Tardigrade", "Endures extremes by shutting down, which is resilience rather than adaptability"]},
                    {cells: ["Most adaptable animal overall", "Humans", "Live on every continent by changing tools and culture, not bodies"]}
                ]
            },
            inlineLinks: [
                {text: "Lionfish", slug: "lionfish"},
                {text: "American bullfrog", slug: "american-bullfrog"},
                {text: "Water bear (tardigrade)", slug: "water-bear"},
                postLink("how-dolphin-intelligence-works-in-the-wild", "How dolphin intelligence works in the wild")
            ]
        },
        {
            title: "How adaptability is measured, and the common myths",
            paragraphs: [
                "Biologists do not have a single adaptability score, but they measure its parts. Range size and the number of habitat types a species uses show ecological breadth. Diet breadth counts how many kinds of food it eats. Behavioural flexibility is measured by innovations: Louis Lefebvre and colleagues counted reports of birds feeding in new ways in ornithology journals, and crows, ravens and parrots topped the counts. A 2005 PNAS study by Daniel Sol and colleagues found that bird species with larger brains relative to body size were more likely to establish themselves when introduced to new regions.",
                "The tier list combines these ideas: range and habitat breadth, behavioural flexibility, and the record of thriving in new or human-made places."
            ],
            cards: [
                {label: "Myth: adaptable means evolving fast", body: "Adaptation is genetic change across generations. Adaptability is what one animal can do in its own lifetime. The red fox did not evolve to live in cities; individual foxes learned to."},
                {label: "Myth: adaptable means invasive", body: "Many adaptable species stay in their native range, and some invaders succeed mainly because they left their predators and diseases behind."},
                {label: "Myth: the toughest animal is the most adaptable", body: "Surviving extremes by going dormant, as tardigrades do, is a different skill from staying active and changing behaviour as conditions change."},
                {label: "Myth: only smart animals adapt", body: "Learning helps, but the American bullfrog and the lionfish succeed through broad diets, fast breeding and wide physical tolerance."}
            ],
            inlineLinks: [
                postLink("what-makes-crows-so-intelligent", "What makes crows so intelligent"),
                postLink("how-wolves-hunt-survive-and-shape-ecosystems", "How wolves hunt, survive and shape ecosystems")
            ]
        }
    ],
    faq: [
        {
            question: "What is the most adaptable animal in the world?",
            answer: "The red fox is the most adaptable wild animal. It has the largest natural range of any wild carnivore, lives from Arctic tundra to desert edges and city centres, and eats everything from voles to fruit and food waste. Humans are more adaptable overall, and crows, wolves, peregrine falcons and leopards follow the fox on the AnimalDex tier list."
        },
        {
            question: "What animal can adapt to any environment?",
            answer: "No animal can adapt to every environment, but humans come closest, followed by species that live alongside us such as brown rats, rock pigeons and house sparrows. Among wild animals the red fox covers the widest range of climates and habitats. Tardigrades survive the widest range of extremes, but they do it by going dormant rather than adapting."
        },
        {
            question: "What is the most adaptable mammal?",
            answer: "Humans are the most adaptable mammal. Among wild mammals the red fox is the strongest answer, with the largest natural range of any wild carnivore and a diet that changes with the season and the place. The brown rat, the leopard and the coyote are close behind, each thriving in landscapes that changed rapidly around them."
        },
        {
            question: "What is the most adaptable bird?",
            answer: "Crows are the most adaptable birds. They eat almost anything, learn new feeding tricks quickly, remember threats for years and pass information through their social groups. Peregrine falcons, house sparrows and rock pigeons are also highly adaptable and have all moved successfully into cities."
        },
        {
            question: "Are humans the most adaptable animal?",
            answer: "Yes. Humans live on every continent and in almost every climate, from the Arctic to deserts, because tools, clothing, shelter and culture let us change our surroundings instead of our bodies. Rankings of adaptable animals usually leave humans out so that the comparison between wild species stays meaningful."
        },
        {
            question: "What is the difference between adaptable and resilient?",
            answer: "An adaptable animal copes with change by changing what it does: its diet, habitat or behaviour. A resilient animal survives hardship and recovers from it, often by enduring rather than changing. The red fox is the classic adaptable animal; the tardigrade, which survives extremes by drying out and shutting down, is the classic resilient one."
        }
    ],
    sources: [
        {label: "National Geographic: Red fox", href: "https://www.nationalgeographic.com/animals/mammals/facts/red-fox"},
        {label: "Sol et al., Big brains, enhanced cognition, and response of birds to novel environments, PNAS (2005)", href: "https://doi.org/10.1073/pnas.0408145102"},
        {label: "NOAA National Ocean Service: Why are lionfish a growing problem in the Atlantic Ocean?", href: "https://oceanservice.noaa.gov/facts/lionfish.html"},
        {label: "Cornell Lab of Ornithology, All About Birds: Peregrine Falcon", href: "https://www.allaboutbirds.org/guide/Peregrine_Falcon/overview"}
    ]
};

const resilientPost: BlogPost = {
    slug: "what-is-the-most-resilient-animal",
    canonicalUrl: "https://animaldex.app/blog/what-is-the-most-resilient-animal",
    title: "What Is the Most Resilient Animal? 10 Toughest Survivors",
    description: "The tardigrade is the most resilient animal known, surviving space, radiation and near absolute zero. The 10 toughest animals, and resilience vs strength.",
    publishedAt: DATE,
    updatedAt: DATE,
    author: "AnimalDex",
    featuredImage: {
        src: "/images/blog/what-is-the-most-resilient-animal/tardigrade.webp",
        alt: "Scanning electron microscope image of the tardigrade Milnesium tardigradum in its active state",
        width: 1400,
        height: 1073,
        caption: "Milnesium tardigradum under a scanning electron microscope; tardigrades are usually under a millimetre long. Photo: Schokraie E, Warnken U, Hotz-Wagenblatt A, Grohme MA, Hengherr S, et al. (2012), CC BY 2.5, via Wikimedia Commons."
    },
    readingMinutes: 10,
    tags: ["Animal rankings", "Resilience", "Extremophiles", "Regeneration"],
    searchIntents: ["most resilient animal", "most resilient animal in the world", "toughest animal", "what animal can survive anything", "tardigrade survival", "resilience vs strength animals"],
    speciesSlugs: slugsOf(resilient),
    relatedSlugs: ["what-is-the-most-adaptable-animal", "what-is-the-most-dangerous-animal", "what-is-the-smartest-animal"],
    tableOfContents: [
        "Quick answer: the most resilient animal",
        "Tardigrades: how the toughest animal survives",
        "The 10 most resilient animals, ranked",
        "Why the top picks are so hard to kill",
        "Other extreme survivors",
        "Resilience is not strength",
        "How resilience is measured, and the common myths"
    ],
    sections: [
        {
            title: "Quick answer: the most resilient animal",
            paragraphs: [
                "The tardigrade, or water bear, is the most resilient animal known. Dried out into a dormant state called a tun, tardigrades have survived temperatures close to absolute zero in the lab, pressures around six times those at the bottom of the deepest ocean trench, radiation doses hundreds of times higher than what would kill a person, and ten days exposed to open space in low Earth orbit.",
                `The AnimalDex tier list answers a slightly different question: which animals in its catalog are toughest across a whole life in the wild, through cold, drought, hunger and injury. On that list the ${nameList(resilient, 1)} ranks first, followed by the ${nameList(resilient.slice(1), 2)}. The tardigrade is a microscopic invertebrate that sits outside that ranked catalog, so this article covers both answers.`,
                "Resilience means surviving hardship and coming back from it. It is not strength, which is about how much force an animal can produce. A tardigrade has almost no strength at all and survives conditions that would destroy an elephant."
            ],
            inlineLinks: [
                tierLink("most-resilient-animals", "Most resilient animals tier list (top 100)"),
                postLink("strongest-animal-in-the-world", "Strongest animal in the world"),
                postLink("what-is-the-most-adaptable-animal", "What is the most adaptable animal?"),
                {text: "Water bear (tardigrade) species page", slug: "water-bear"}
            ]
        },
        {
            title: "Tardigrades: how the toughest animal survives",
            paragraphs: [
                "Tardigrades are eight-legged micro-animals, usually 0.3 to 0.5 mm long, with more than 1,000 described species. They live in moss, lichen, leaf litter, soil, fresh water and ocean sediment, and they need a film of water to be active.",
                "Their trick is anhydrobiosis, life without water. As their surroundings dry out, they pull in their legs, curl into a barrel-shaped tun and lose almost all of their body water. Metabolism falls to levels that are hard to detect. Tardigrade-specific proteins help hold cell contents together as they dry, and in the species Ramazzottius varieornatus a protein called Dsup binds to DNA and protects it: in a 2016 Nature Communications study, human cells engineered to make Dsup suffered about 40 percent less X-ray damage. Add water and a tun can be walking again within minutes to hours.",
                "In 2007 the European FOTON-M3 mission carried dried tardigrades into low Earth orbit and exposed them to space vacuum and cosmic radiation for ten days. Many survived and reproduced afterwards, though the unfiltered solar ultraviolet killed most of those exposed to it (Jönsson and colleagues, Current Biology, 2008).",
                "There is an important limit. Tardigrades tolerate extremes; they do not thrive in them. A 2020 study in Scientific Reports found that a day at about 37 °C killed half of active Ramazzottius varieornatus. Their record-breaking survival happens only in the dormant tun state."
            ],
            pullQuote: "Tardigrades do not beat extreme conditions by being strong. They survive by switching life almost off and waiting."
        },
        {
            title: "The 10 most resilient animals, ranked",
            paragraphs: [
                `This is the same top ten as the AnimalDex most resilient animals tier list, in the same order. The ${nameList(resilient)} lead. The list rewards two kinds of resilience: tolerance, which is enduring cold, heat, drought or hunger (crocodile, polar bear, wolverine, red kangaroo), and recovery, which is regrowing or repairing what is lost (sea cucumber, axolotl, octopus).`,
                "Resilience can also be social. Elephants and wolves get through hard seasons because the group holds knowledge and shares food, not only because each body is tough."
            ],
            table: rankingTable(resilient, "Type of resilience"),
            speciesSlugs: slugsOf(resilient),
            inlineLinks: [tierLink("most-resilient-animals", "See all 100 on the most resilient animals tier list")],
            media: {
                type: "image",
                image: {
                    src: "/images/blog/what-is-the-most-resilient-animal/saltwater-crocodile.webp",
                    alt: "Juvenile saltwater crocodile (Crocodylus porosus) resting on limestone rock in Palau",
                    width: 1400,
                    height: 700,
                    caption: "A juvenile saltwater crocodile in Palau's Rock Islands; adults can live in fresh water, mangroves and the open sea. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
                }
            }
        },
        {
            title: "Why the top picks are so hard to kill",
            paragraphs: [
                "The leaders on the tier list each survive a different kind of pressure."
            ],
            subsections: [
                {
                    title: "Crocodile: built to outlast",
                    paragraphs: [
                        "Crocodilians come from a lineage that survived the mass extinction 66 million years ago that ended the non-avian dinosaurs. Their slow, cold-blooded metabolism lets large adults go months without feeding, their bony armour absorbs bites from rivals, and they recover from serious wounds in muddy water that would infect most animals. The saltwater crocodile, the largest living reptile, moves between rivers, mangroves and the open sea, removing excess salt through glands on its tongue."
                    ]
                },
                {
                    title: "Polar bear and wolverine: cold-country endurance",
                    paragraphs: [
                        "Polar bears are insulated by dense fur and a fat layer that can be around 10 cm thick. In Hudson Bay they spend about four ice-free months onshore eating little or nothing, and pregnant females den and fast for up to eight months while giving birth and nursing. Wolverines weigh only about 10 to 18 kg but cover huge territories in deep snow, scavenge frozen carcasses, and cache food in snow to eat weeks later."
                    ]
                },
                {
                    title: "Elephant and red kangaroo: getting through drought",
                    paragraphs: [
                        "Elephants dig for water in dry riverbeds and travel to remembered water sources. In a severe drought in Tanzania's Tarangire National Park in 1993, families led by older matriarchs lost fewer calves, a result published in Biology Letters in 2008. Red kangaroos rest in shade through the heat of the day, lick their forearms to cool down, and get much of their water from plants. Females can pause the development of an embryo, so breeding slows in drought and restarts when rain returns."
                    ]
                },
                {
                    title: "Sea cucumber and axolotl: coming back from damage",
                    paragraphs: [
                        "Many sea cucumbers expel part of their internal organs when attacked, leaving a predator with a mouthful while they crawl away and regrow the lost organs over the following weeks. Axolotls regrow lost limbs, the tail, parts of the spinal cord and heart, and tissue in the eye and brain, usually without scarring."
                    ],
                    media: {
                        type: "image",
                        image: {
                            src: "/images/blog/what-is-the-most-resilient-animal/axolotl.webp",
                            alt: "Close-up of a dark wild-type axolotl (Ambystoma mexicanum) with feathery external gills resting on stones",
                            width: 1400,
                            height: 933,
                            caption: "An axolotl at Aquarium Finisterrae, Spain; the species can regrow limbs and parts of its spinal cord. Photo: Fernando Losada Rodríguez, CC BY-SA 4.0, via Wikimedia Commons."
                        }
                    }
                }
            ],
            pullQuote: "The axolotl can regrow a leg, yet it is critically endangered in the wild. Resilience in one animal does not make a species safe."
        },
        {
            title: "Other extreme survivors",
            paragraphs: [
                "Several animals outside the top ten hold specific survival records. Most are small, and most survive by slowing their bodies down rather than fighting the conditions."
            ],
            cards: [
                {label: "Bdelloid rotifers", body: "Microscopic animals revived from Siberian permafrost about 24,000 years old, which then fed and reproduced (Shmakova and colleagues, Current Biology, 2021)."},
                {label: "Wood frog", body: "Freezes solid in winter. Its heart and breathing stop, ice forms in its body cavity, and glucose protects its cells until it thaws in spring.", links: [{text: "Wood frog", slug: "wood-frog"}]},
                {label: "Arctic ground squirrel", body: "Lets its body temperature fall below 0 °C during hibernation, the lowest recorded for a mammal, and rewarms every few weeks.", links: [{text: "Arctic ground squirrel", slug: "arctic-ground-squirrel"}]},
                {label: "Naked mole-rat", body: "Survived 18 minutes with no oxygen in lab tests (Park and colleagues, Science, 2017), very rarely develops cancer, and lives more than 30 years.", links: [{text: "Naked mole-rat", slug: "naked-mole-rat"}]},
                {label: "Cockroaches", body: "Tolerate radiation several times better than humans and can survive weeks without food, but they are far less tolerant than tardigrades.", links: [{text: "Cockroach", slug: "cockroach"}]}
            ],
            speciesSlugs: ["wood-frog", "naked-mole-rat", "cockroach"]
        },
        {
            title: "Resilience is not strength",
            paragraphs: [
                "The two words get mixed up because both describe something an animal can endure. They measure different things, and the best animals for each barely overlap."
            ],
            table: {
                columns: ["Quality", "The question it answers", "Best examples"],
                rows: [
                    {cells: ["Strength", "How much force can it produce?", "African elephant, gorilla, dung beetle (for its size)"]},
                    {cells: ["Toughness", "How much damage can its body absorb?", "Crocodile, honey badger, armadillo"]},
                    {cells: ["Tolerance", "How extreme can conditions get before it dies?", "Tardigrade, wood frog, Arctic ground squirrel"]},
                    {cells: ["Recovery", "How completely does it repair damage?", "Axolotl, sea cucumber, octopus"]},
                    {cells: ["Population resilience", "How fast do numbers bounce back after a crash?", "Brown rat, wolf after legal protection"]}
                ]
            },
            inlineLinks: [
                tierLink("strongest-animals", "Strongest animals tier list"),
                postLink("how-crocodiles-dominate-the-water-edge", "How crocodiles dominate the water's edge")
            ]
        },
        {
            title: "How resilience is measured, and the common myths",
            paragraphs: [
                "In the lab, tolerance is measured as the dose or temperature at which half of the test animals die, and how long they survive at a given level. In the field, resilience shows up in survival through droughts and hard winters, in how long animals live, and in how quickly they recover from injury or a population crash. Regeneration is measured by what grows back and how closely the new tissue matches the old.",
                "The tier list blends these with what is known about each animal's survival in the wild, which is why large, long-lived species with a record of getting through hard conditions rank above animals with one extreme trick."
            ],
            cards: [
                {label: "Myth: cockroaches would survive a nuclear war", body: "They tolerate more radiation than people, but not the blast or heat, and many insects, such as some fruit flies and parasitic wasps, tolerate more radiation than cockroaches do."},
                {label: "Myth: tardigrades are indestructible", body: "Active tardigrades die from heat that people survive easily. Their records are set in the dormant tun state, and even then exposure time matters."},
                {label: "Myth: tardigrades live in space", body: "They survived ten days of exposure in a dried, dormant state. Nothing lives and reproduces in open space."},
                {label: "Myth: the strongest animal is the toughest", body: "Large, powerful animals often need the most food and water, which makes them vulnerable in a drought. Small animals that can shut down often outlast them."}
            ]
        }
    ],
    faq: [
        {
            question: "What is the most resilient animal in the world?",
            answer: "The tardigrade is the most resilient animal known. In its dried, dormant tun state it has survived near absolute zero, crushing pressure, intense radiation and ten days exposed to space. Among larger animals, the AnimalDex tier list ranks the crocodile first, ahead of the polar bear and wolverine, for toughness across a whole life in the wild."
        },
        {
            question: "Can tardigrades survive in space?",
            answer: "Yes, in a dormant state. In 2007 dried tardigrades spent ten days exposed to vacuum and cosmic radiation on the FOTON-M3 mission, and many revived and reproduced on return. Most of those also exposed to unfiltered solar ultraviolet died. They survive space; they cannot live, feed or breed there."
        },
        {
            question: "What animal can survive anything?",
            answer: "No animal can survive anything, but the tardigrade comes closest. Dried into a tun it withstands extreme cold, pressure, radiation and vacuum. Active tardigrades are fragile, though: a day at around 37 °C kills about half of them in one studied species, so their toughness depends on drying out first."
        },
        {
            question: "Is a cockroach the most resilient animal?",
            answer: "No. Cockroaches are tough for insects, surviving weeks without food and tolerating several times the radiation dose that would kill a person, but tardigrades tolerate far higher doses and far harsher conditions. Some fruit flies and parasitic wasps also tolerate more radiation than cockroaches."
        },
        {
            question: "What is the most resilient mammal?",
            answer: "The polar bear is the highest-ranked mammal on the AnimalDex resilience tier list, fasting for months in the Arctic. For physiological records, the naked mole-rat survives 18 minutes without oxygen and rarely gets cancer, and the Arctic ground squirrel lets its body temperature drop below freezing during hibernation."
        },
        {
            question: "What is the difference between resilience and strength in animals?",
            answer: "Strength is how much force an animal can produce; resilience is how well it survives and recovers from hardship such as cold, drought, starvation or injury. An elephant is one of the strongest animals but needs large amounts of food and water every day, while a tardigrade has almost no strength and survives conditions that would kill an elephant."
        }
    ],
    sources: [
        {label: "Jönsson et al., Tardigrades survive exposure to space in low Earth orbit, Current Biology (2008)", href: "https://doi.org/10.1016/j.cub.2008.06.048"},
        {label: "Hashimoto et al., Extremotolerant tardigrade genome and improved radiotolerance of human cultured cells by tardigrade-unique protein, Nature Communications (2016)", href: "https://doi.org/10.1038/ncomms12808"},
        {label: "Neves et al., Thermotolerance experiments on active and desiccated states of Ramazzottius varieornatus, Scientific Reports (2020)", href: "https://doi.org/10.1038/s41598-019-56965-z"},
        {label: "Shmakova et al., A living bdelloid rotifer from 24,000-year-old Arctic permafrost, Current Biology (2021)", href: "https://doi.org/10.1016/j.cub.2021.04.077"},
        {label: "Foley, Pettorelli and Foley, Severe drought and calf survival in elephants, Biology Letters (2008)", href: "https://doi.org/10.1098/rsbl.2008.0370"},
        {label: "Park et al., Fructose-driven glycolysis supports anoxia resistance in the naked mole-rat, Science (2017)", href: "https://doi.org/10.1126/science.aab3896"}
    ]
};

const smartestPost: BlogPost = {
    slug: "what-is-the-smartest-animal",
    canonicalUrl: "https://animaldex.app/blog/what-is-the-smartest-animal",
    title: "What Is the Smartest Animal? The 10 Smartest Animals",
    description: "Chimpanzees and dolphins are the smartest animals after humans, with orcas, octopuses and crows close behind. The evidence, the rankings and the myths.",
    publishedAt: DATE,
    updatedAt: DATE,
    author: "AnimalDex",
    featuredImage: {
        src: "/images/blog/what-is-the-smartest-animal/chimpanzee.webp",
        alt: "Adult male chimpanzee (Pan troglodytes) sitting on the forest floor in Kibale Forest National Park, Uganda",
        width: 1400,
        height: 933,
        caption: "An alpha male chimpanzee in Kibale Forest National Park, Uganda. Photo: Giles Laurent, CC BY-SA 4.0, via Wikimedia Commons."
    },
    readingMinutes: 11,
    tags: ["Animal rankings", "Animal intelligence", "Cognition", "Tool use"],
    searchIntents: ["smartest animal", "smartest animals", "smartest animal in the world", "most intelligent animal", "second smartest animal", "smartest bird"],
    speciesSlugs: slugsOf(smartestCurated),
    relatedSlugs: ["what-is-the-most-adaptable-animal", "what-is-the-most-agile-animal", "what-is-the-most-resilient-animal"],
    tableOfContents: [
        "Quick answer: the smartest animal",
        "The 10 smartest animals by kind of intelligence",
        "The evidence behind the top picks",
        "Beyond the top ten: the next smartest animals",
        "Smartest animals by category",
        "How animal intelligence is measured, and the common myths"
    ],
    sections: [
        {
            title: "Quick answer: the smartest animal",
            paragraphs: [
                "Chimpanzees and bottlenose dolphins are the smartest animals after humans, and the evidence for each is strong enough that scientists rarely try to separate them. Chimpanzees make and use tools, pass local traditions between generations and outperform people on some short-term memory tests. Dolphins recognise themselves in mirrors, use signature whistles that work like names, and learn hunting techniques from their mothers.",
                `Orcas, octopuses, ravens, crows and elephants complete the top tier. The editorial ranking on the AnimalDex smartest animals tier list puts the ${nameList(smartestCurated)} first, ordered by kind of intelligence rather than a single score.`,
                "There is no IQ test that works across species. A crow, an octopus and a chimpanzee solve different problems with very different brains, so the most useful answer names the leader for each kind of intelligence: social reasoning, tool use, memory, communication and solitary problem solving."
            ],
            inlineLinks: [
                tierLink("smartest-animals", "Smartest animals tier list (top 100)"),
                postLink("what-makes-crows-so-intelligent", "What makes crows so intelligent"),
                postLink("how-octopus-intelligence-works", "How octopus intelligence works"),
                {text: "Chimpanzee species page", slug: "chimpanzee"}
            ]
        },
        {
            title: "The 10 smartest animals by kind of intelligence",
            paragraphs: [
                "This is the editorial top ten from the AnimalDex smartest animals tier list, in the same order. It mixes mammals, birds and molluscs because intelligence evolved several times independently: in primates, in whales and dolphins, in corvids and parrots, and in octopuses and cuttlefish, whose last common ancestor with us was a simple worm-like animal more than 500 million years ago."
            ],
            table: rankingTable(smartestCurated, "Kind of intelligence"),
            speciesSlugs: slugsOf(smartestCurated),
            inlineLinks: [tierLink("smartest-animals", "See the full smartest animals tier list")]
        },
        {
            title: "The evidence behind the top picks",
            paragraphs: [
                "Each top-tier animal has a body of published research behind its place, not just a viral video."
            ],
            subsections: [
                {
                    title: "Dolphin: self-recognition and names",
                    paragraphs: [
                        "In 2001 Diana Reiss and Lori Marino showed in PNAS that bottlenose dolphins use a mirror to inspect marks placed on their bodies, passing the mirror self-recognition test once thought to be limited to great apes. Each dolphin develops a signature whistle early in life, and other dolphins copy it to call that individual. In Shark Bay, Western Australia, some bottlenose dolphins carry marine sponges on their beaks to protect them while they forage on the seabed, a technique passed mostly from mother to daughter."
                    ],
                    media: {
                        type: "image",
                        image: {
                            src: "/images/blog/what-is-the-smartest-animal/bottlenose-dolphin.webp",
                            alt: "Common bottlenose dolphin (Tursiops truncatus) breathing at the surface of clear blue-green water",
                            width: 1400,
                            height: 932,
                            caption: "A bottlenose dolphin surfacing to breathe; the species passes the mirror self-recognition test. Photo: Cloudette-90, CC BY-SA 4.0, via Wikimedia Commons."
                        }
                    }
                },
                {
                    title: "Chimpanzee: tools and culture",
                    paragraphs: [
                        "Jane Goodall's 1960 observation of chimpanzees at Gombe fishing for termites with stripped twigs changed the definition of tool use. Chimpanzees in West Africa crack nuts with stone hammers on wooden or stone anvils, and young chimpanzees take years to learn it. A 1999 Nature paper by Andrew Whiten and colleagues compared long-term field sites and identified 39 behaviours, from tool use to grooming styles, that differ between communities in ways best explained by culture. In memory tests in Kyoto, a young chimpanzee named Ayumu recalled the positions of briefly flashed numbers faster and more accurately than the university students tested."
                    ]
                },
                {
                    title: "Orca and octopus: two opposite kinds of smart",
                    paragraphs: [
                        "Orcas live in stable family pods with their own call dialects and hunting traditions: some pods in Antarctica make waves to wash seals off ice floes, and some in Patagonia deliberately strand themselves to grab sea lion pups from the beach. Octopuses show what a solitary, short-lived animal can do. They open jars, escape tanks, and veined octopuses in Indonesia carry coconut shell halves across the seabed to use later as a shelter, which a 2009 Current Biology study described as tool use."
                    ]
                },
                {
                    title: "Ravens and crows: primate-level reasoning in a small brain",
                    paragraphs: [
                        "New Caledonian crows make hooked tools from twigs and cut stepped tools from leaves, reported in Nature in 1996. Ravens in a 2017 Science study chose a tool or a token they would need the next day over an immediate small reward, a level of planning previously shown only in great apes. Bird brains are small, but a 2016 PNAS study found that corvids and parrots pack about twice as many neurons into their forebrains as primates with brains of the same mass."
                    ],
                    media: {
                        type: "image",
                        image: {
                            src: "/images/blog/what-is-the-smartest-animal/common-raven.webp",
                            alt: "Common raven (Corvus corax) perched on a boulder with food in its bill in Yellowstone",
                            width: 1400,
                            height: 933,
                            caption: "A common raven scavenging in Yellowstone; ravens plan for future tool use. Photo: Jacob W. Frank, Public domain, via Wikimedia Commons."
                        }
                    }
                },
                {
                    title: "Elephant: memory and social knowledge",
                    paragraphs: [
                        "Elephants have the largest brain of any land animal, around 5 kg. An Asian elephant named Happy passed the mirror self-recognition test at the Bronx Zoo (Plotnik and colleagues, PNAS, 2006). In the wild, older matriarchs remember distant water sources and recognise the calls of dozens of other families, and their groups survive droughts better."
                    ]
                }
            ]
        },
        {
            title: "Beyond the top ten: the next smartest animals",
            paragraphs: [
                `The tier list opens with the editorial top ten above. Below them, the table continues by the AnimalDex intelligence stat, a catalog profile score used across every species in the app. It is not a published IQ test. Because that score weighs social group life, problem solving and grasping hands heavily, primates dominate the next rows: the ${nameList(smartestTable)} come right after the top ten.`,
                "Monkeys such as capuchins really are strong problem solvers, and some capuchin populations crack nuts and shellfish with stones in the wild. Read the lower rows as the catalog's intelligence stat, and the editorial top ten as the answer to the everyday question of which animal is smartest."
            ],
            table: rankingTable(smartestTable, "Intelligence stat"),
            speciesSlugs: slugsOf(smartestTable),
            inlineLinks: [
                tierLink("smartest-animals", "Smartest animals tier list"),
                postLink("how-orangutans-think-and-survive-in-the-canopy", "How orangutans think and survive in the canopy")
            ]
        },
        {
            title: "Smartest animals by category",
            paragraphs: [
                "When people ask for the smartest animal they usually mean within a group they know. These are the best-supported answers."
            ],
            table: {
                columns: ["Category", "Smartest", "Best evidence"],
                rows: [
                    {cells: ["Primate (after humans)", "Chimpanzee", "Tool making, cultural traditions, strong short-term memory"]},
                    {cells: ["Marine animal", "Bottlenose dolphin", "Mirror self-recognition, signature whistles, socially learned tool use"]},
                    {cells: ["Bird, tool use", "New Caledonian crow", "Makes hooked and stepped tools in the wild"]},
                    {cells: ["Bird, planning", "Common raven", "Saves tools and tokens for future use"]},
                    {cells: ["Bird, vocal labels", "African grey parrot", "Alex learned names for dozens of objects, colours and shapes"]},
                    {cells: ["Invertebrate", "Octopus", "Opens containers, escapes enclosures, carries shelters"]},
                    {cells: ["Land mammal (non-primate)", "Elephant", "Mirror self-recognition, long social memory"]},
                    {cells: ["Insect", "Honey bee", "The waggle dance tells nestmates the direction and distance of food"]},
                    {cells: ["Farm animal", "Pig", "Learns to use a mirror to find hidden food"]}
                ]
            },
            inlineLinks: [
                {text: "New Caledonian crow", slug: "new-caledonian-crow"},
                {text: "African grey parrot", slug: "african-grey-parrot"},
                {text: "Honey bee", slug: "honey-bee"},
                {text: "Pig", slug: "pig"},
                postLink("how-dolphin-intelligence-works-in-the-wild", "How dolphin intelligence works in the wild")
            ],
            speciesSlugs: ["african-grey-parrot", "honey-bee", "pig", "common-raven"]
        },
        {
            title: "How animal intelligence is measured, and the common myths",
            paragraphs: [
                "Researchers test pieces of intelligence rather than the whole. The mirror test, introduced by Gordon Gallup in 1970, checks whether an animal uses a mirror to investigate a mark on its own body; great apes, bottlenose dolphins, Asian elephants and Eurasian magpies have passed versions of it. Other tests look at tool use, causal reasoning (such as dropping stones into a tube to raise the water level), planning, delayed gratification, numbers, and social learning.",
                "Brain measures help but do not decide the question. The encephalisation quotient compares brain size with what would be expected for an animal's body size; neuron counts, especially in the forebrain, turn out to predict ability better than brain weight alone."
            ],
            cards: [
                {label: "Myth: the biggest brain is the smartest", body: "The sperm whale has the largest brain of any animal, about 8 kg, but body size, brain structure and neuron density matter more than raw weight. A raven's brain weighs around 15 grams."},
                {label: "Myth: dogs are the smartest animals", body: "Dogs are specialists at reading human gestures, better than chimpanzees at following a pointing finger, but they do not lead on tool use, planning or self-recognition."},
                {label: "Myth: goldfish have a three-second memory", body: "Goldfish can be trained to respond to cues and remember them for months."},
                {label: "Myth: one ranking can settle it", body: "Different tests favour different animals. That is why the tier list gives a top tier and explains which kind of intelligence each animal shows."}
            ]
        }
    ],
    faq: [
        {
            question: "What is the smartest animal in the world?",
            answer: "After humans, chimpanzees and bottlenose dolphins are the smartest animals. Chimpanzees make tools and keep cultural traditions; dolphins recognise themselves in mirrors and use whistles like names. Orcas, octopuses, ravens, crows and elephants complete the top tier, each excelling at a different kind of intelligence."
        },
        {
            question: "What is the second smartest animal?",
            answer: "If humans count as first, the chimpanzee is usually named second smartest, with the bottlenose dolphin a close rival. Chimpanzees share about 98 to 99 percent of their DNA with us and show tool making, culture and planning; dolphins match them on self-recognition and social learning. Orangutans and bonobos are close behind among apes."
        },
        {
            question: "What is the smartest bird?",
            answer: "Corvids and parrots are the smartest birds. The New Caledonian crow makes hooked tools in the wild, the common raven plans for future tool use, and the African grey parrot learned to name objects, colours and shapes. Their forebrains hold about twice as many neurons as primate brains of the same mass."
        },
        {
            question: "Are dolphins smarter than chimpanzees?",
            answer: "Neither is clearly smarter; they lead in different areas. Chimpanzees are stronger at tool use and manipulating objects, which their hands allow. Dolphins match them on mirror self-recognition and social learning and have complex vocal communication. The AnimalDex editorial ranking places the dolphin first and the chimpanzee second."
        },
        {
            question: "Is an octopus smarter than a dog?",
            answer: "They are smart in different ways. Octopuses are better solitary problem solvers: they open jars, escape tanks and use coconut shells as shelters. Dogs are better at social cognition with people, reading gestures and cues that octopuses never encounter. On the AnimalDex editorial ranking the octopus is in the top tier."
        },
        {
            question: "What is the smartest pet?",
            answer: "Among common pets, parrots such as the African grey are the strongest problem solvers and vocal learners, and dogs are the best at understanding people. Pigs, often kept on farms rather than as pets, perform well on mirror and memory tasks. Rats are also quick learners that solve mazes and remember routes."
        }
    ],
    sources: [
        {label: "Reiss and Marino, Mirror self-recognition in the bottlenose dolphin, PNAS (2001)", href: "https://doi.org/10.1073/pnas.101086398"},
        {label: "Whiten et al., Cultures in chimpanzees, Nature (1999)", href: "https://doi.org/10.1038/21415"},
        {label: "Kabadayi and Osvath, Ravens parallel great apes in flexible planning for tool-use and bartering, Science (2017)", href: "https://doi.org/10.1126/science.aam8138"},
        {label: "Olkowicz et al., Birds have primate-like numbers of neurons in the forebrain, PNAS (2016)", href: "https://doi.org/10.1073/pnas.1517131113"},
        {label: "Plotnik, de Waal and Reiss, Self-recognition in an Asian elephant, PNAS (2006)", href: "https://doi.org/10.1073/pnas.0608062103"},
        {label: "Hunt, Manufacture and use of hook-tools by New Caledonian crows, Nature (1996)", href: "https://doi.org/10.1038/379249a0"}
    ]
};

const dangerousPost: BlogPost = {
    slug: "what-is-the-most-dangerous-animal",
    canonicalUrl: "https://animaldex.app/blog/what-is-the-most-dangerous-animal",
    title: "What Is the Most Dangerous Animal? Deadliest Animals Ranked",
    description: "The mosquito is the most dangerous animal, linked to over 600,000 malaria deaths a year. The deadliest animals by deaths and by encounter, explained.",
    publishedAt: DATE,
    updatedAt: DATE,
    author: "AnimalDex",
    featuredImage: {
        src: "/images/blog/what-is-the-most-dangerous-animal/anopheles-albimanus.webp",
        alt: "Anopheles albimanus mosquito, abdomen swollen with blood, feeding on human skin",
        width: 1400,
        height: 925,
        caption: "A female Anopheles albimanus mosquito taking a blood meal; Anopheles species carry the parasites that cause malaria. Photo: CDC/James Gathany, Public domain, via Wikimedia Commons."
    },
    readingMinutes: 10,
    tags: ["Animal rankings", "Dangerous animals", "Venomous animals", "Wildlife safety"],
    searchIntents: ["most dangerous animal", "deadliest animal", "most dangerous animal in the world", "deadliest animal in the world", "what animal kills the most humans", "most dangerous animal in africa"],
    speciesSlugs: slugsOf(dangerous),
    relatedSlugs: ["what-is-the-most-resilient-animal", "what-is-the-most-agile-animal", "what-is-the-smartest-animal"],
    tableOfContents: [
        "Quick answer: the most dangerous animal",
        "Deadliest animals by human deaths per year",
        "The 10 most dangerous animals to meet in the wild",
        "Why the top picks are so dangerous",
        "Venomous vs dangerous vs aggressive",
        "Most dangerous animals by category",
        "How danger is measured, and how to stay safe"
    ],
    sections: [
        {
            title: "Quick answer: the most dangerous animal",
            paragraphs: [
                "The mosquito is the most dangerous animal in the world. By spreading malaria, dengue, yellow fever, Zika and other diseases, mosquitoes are linked to more human deaths than any other animal. Malaria alone, carried by Anopheles mosquitoes, caused an estimated 610,000 deaths in 2024 according to the World Health Organization, about 95 percent of them in Africa and most of them children under five.",
                `Measured by what happens if you meet one, the answer changes. The AnimalDex tier list ranks the danger of a wild encounter turning lethal, leaves disease carriers out, and puts the ${nameList(dangerous, 1)} first, followed by the ${nameList(dangerous.slice(1), 2)}. Both answers are right; they answer different questions.`,
                "Dangerous is also not the same as venomous or aggressive. The inland taipan has the most toxic venom of any land snake in lab tests but has caused very few deaths; the saw-scaled viper is far less toxic and kills many more people, because it lives where people farm and walk barefoot."
            ],
            inlineLinks: [
                tierLink("most-dangerous-animals", "Most dangerous animals tier list (top 100)"),
                tierLink("deadliest-animals-to-humans-in-the-wild", "Deadliest animals to humans in the wild"),
                postLink("what-is-the-most-resilient-animal", "What is the most resilient animal?"),
                {text: "Mosquito species page", slug: "mosquito"}
            ]
        },
        {
            title: "Deadliest animals by human deaths per year",
            paragraphs: [
                "Counting deaths puts small animals that carry disease far above the predators people fear. These figures are estimates, and the ones for large wild animals are rough, because many deaths happen in rural areas where they are never formally recorded."
            ],
            table: {
                columns: ["Animal", "Estimated deaths per year", "How it kills"],
                rows: [
                    {cells: ["Mosquitoes", "More than 600,000 from malaria alone (WHO, 2024), plus dengue and other diseases", "Transmits parasites and viruses while feeding"]},
                    {cells: ["Humans", "About 458,000 homicides (UNODC, 2021)", "Violence"]},
                    {cells: ["Snakes", "81,410 to 137,880 (WHO)", "Venomous bites, mostly in rural Asia and Africa"]},
                    {cells: ["Dogs", "Tens of thousands (WHO)", "Rabies: dogs cause up to 99 percent of human cases"]},
                    {cells: ["Kissing bugs", "More than 10,000 (WHO)", "Spread Chagas disease"]},
                    {cells: ["Crocodiles", "Hundreds to about 1,000 (rough estimates)", "Ambush attacks, mainly Nile and saltwater crocodiles"]},
                    {cells: ["Elephants", "About 500 in India alone (government figures)", "Trampling during crop raiding and chance encounters"]},
                    {cells: ["Hippopotamuses", "Often quoted as about 500 (poorly documented)", "Attacks on boats and people near water"]},
                    {cells: ["Sharks", "Usually under 10 unprovoked deaths (International Shark Attack File)", "Bites, mostly by great white, tiger and bull sharks"]}
                ]
            },
            media: {
                type: "image",
                image: {
                    src: "/images/blog/what-is-the-most-dangerous-animal/saw-scaled-viper.webp",
                    alt: "Saw-scaled viper (Echis) coiled on sandy ground with its tongue out",
                    width: 1400,
                    height: 1050,
                    caption: "A saw-scaled viper near Termez, Uzbekistan; Echis vipers cause more snakebite deaths than almost any other snakes. Photo: Alexander A. Fomichev, CC BY-SA 4.0, via Wikimedia Commons."
                }
            },
            inlineLinks: [{text: "Domestic dog", slug: "domestic-dog"}]
        },
        {
            title: "The 10 most dangerous animals to meet in the wild",
            paragraphs: [
                `This is the editorial top ten from the AnimalDex most dangerous animals tier list, in the same order: ${nameList(dangerous, 10)}. It ranks the risk that a close encounter ends in death or serious injury, combining lethality, temperament, speed and how often the animal is met.`,
                "The mosquito is not on it because the tier list deliberately leaves out disease carriers. That is a different question, covered by the deaths-per-year table above."
            ],
            table: rankingTable(dangerous, "Danger profile"),
            speciesSlugs: slugsOf(dangerous),
            inlineLinks: [tierLink("most-dangerous-animals", "See all 100 on the most dangerous animals tier list")]
        },
        {
            title: "Why the top picks are so dangerous",
            paragraphs: [
                "Most of the animals on the list are not hunting people. They are defending space, young or food, or they mistake a person for ordinary prey."
            ],
            media: {
                type: "image",
                image: {
                    src: "/images/blog/what-is-the-most-dangerous-animal/hippopotamus.webp",
                    alt: "Hippopotamus (Hippopotamus amphibius) in water with its mouth wide open showing its long lower tusks",
                    width: 1400,
                    height: 933,
                    caption: "A hippopotamus gaping, a threat display that shows off its tusk-like lower canines. Photo: Bernard DUPONT, CC BY-SA 2.0, via Wikimedia Commons."
                }
            },
            subsections: [
                {
                    title: "Crocodile: the ambush predator that does hunt people",
                    paragraphs: [
                        "Nile and saltwater crocodiles are the large predators most likely to treat a person as prey. They wait submerged at places people use every day, such as water points, fords and washing spots, and an attack is usually a single lunge and a drag into deep water. Saltwater crocodiles can exceed 6 m, and both species account for most of the hundreds of fatal crocodile attacks each year."
                    ]
                },
                {
                    title: "Hippopotamus: the herbivore with a short temper",
                    paragraphs: [
                        "Hippos eat grass, but males defend stretches of river and females defend calves, and both will charge people and capsize boats. An adult can weigh 1,500 kg or more, run faster than a person over short distances, and bite with lower canines up to about 50 cm long. Many attacks happen at night when hippos leave the water to graze and someone walks between a hippo and the river."
                    ]
                },
                {
                    title: "Elephant: danger from sheer size",
                    paragraphs: [
                        "Elephants are usually calm, but conflict over crops, roads and water brings them into close contact with people, especially in India and parts of Africa. A charging elephant weighs several tonnes, and Indian government figures put deaths from elephant encounters at around 500 people a year."
                    ]
                },
                {
                    title: "King cobra and black mamba: venom delivered fast",
                    paragraphs: [
                        "The king cobra is the longest venomous snake, sometimes over 5 m, and injects a large volume of neurotoxic venom; bites are rare because it usually avoids people. The black mamba is fast for a snake, can raise the front of its body high off the ground, and an untreated bite was historically almost always fatal. Antivenom changed that, where it is available."
                    ]
                }
            ],
            cards: [
                {label: "Great white shark", body: "Responsible for the most recorded unprovoked shark bites of any species, though total shark fatalities are usually under ten a year worldwide."},
                {label: "Lion and tiger", body: "Man-eating is rare and usually tied to injury, old age or prey loss, but the Tsavo lions of 1898 and the tigers of the Sundarbans mangroves show how lethal it can be."},
                {label: "White rhinoceros", body: "Generally the calmer of the two African rhinos; the black rhino charges more readily. Either can kill with a charge."},
                {label: "Honey badger", body: "Ranked for its escalation profile: it fights animals many times its size and does not back down, which makes it dangerous to underestimate."}
            ],
            inlineLinks: [
                postLink("how-crocodiles-dominate-the-water-edge", "How crocodiles dominate the water's edge"),
                postLink("how-king-cobras-survive-and-hunt-other-snakes", "How king cobras survive and hunt other snakes"),
                postLink("how-tigers-survive-as-solo-apex-hunters", "How tigers survive as solo apex hunters")
            ]
        },
        {
            title: "Venomous vs dangerous vs aggressive",
            paragraphs: [
                "These words are often used as if they mean the same thing. They do not, and mixing them up is behind most confusing rankings of dangerous animals."
            ],
            table: {
                columns: ["Term", "What it means", "Best example", "Why it is not the same thing"],
                rows: [
                    {cells: ["Venomous", "Injects toxin through a bite or sting", "Inland taipan: the most toxic land snake venom in lab tests", "Shy and remote, with very few recorded deaths"]},
                    {cells: ["Poisonous", "Toxic to eat or touch", "Golden poison frog: enough toxin on its skin to kill several people", "Only harmful if handled or eaten"]},
                    {cells: ["Aggressive", "Quick to attack or defend", "Hippopotamus, Cape buffalo, honey badger", "Aggression only matters if people are nearby"]},
                    {cells: ["Dangerous", "Actually causes deaths or serious injury", "Mosquito by deaths; crocodile by encounter", "Depends on how often people meet the animal"]}
                ]
            },
            inlineLinks: [
                {text: "Golden poison frog", slug: "golden-poison-frog"},
                {text: "Cape buffalo", slug: "cape-buffalo"},
                {text: "Australian box jellyfish", slug: "australian-box-jellyfish"},
                {text: "Blue-ringed octopus", slug: "blue-ringed-octopus"}
            ],
            speciesSlugs: ["golden-poison-frog", "blue-ringed-octopus"]
        },
        {
            title: "Most dangerous animals by category",
            paragraphs: [
                "The deadliest animal in each setting is rarely the one in the films."
            ],
            table: {
                columns: ["Category", "Most dangerous", "Why"],
                rows: [
                    {cells: ["Overall, by deaths", "Mosquito", "Hundreds of thousands of deaths a year from malaria and other diseases"]},
                    {cells: ["Large land animal", "Hippopotamus", "Territorial, fast over short distances, often near people at water"]},
                    {cells: ["Freshwater and estuaries", "Nile and saltwater crocodiles", "The large predators most likely to hunt people"]},
                    {cells: ["Sea", "Box jellyfish", "Chironex fleckeri venom can kill a person within minutes"]},
                    {cells: ["Snake, by deaths", "Saw-scaled vipers", "Common, well camouflaged, often around farmland"]},
                    {cells: ["Snake, by venom", "Inland taipan", "Most toxic venom of any land snake in lab tests"]},
                    {cells: ["United States", "Deer", "Vehicle collisions with deer kill more people each year than bears, sharks and snakes combined"]},
                    {cells: ["Africa, wild animals", "Hippopotamus and Nile crocodile", "Both kill people every year along rivers and lakes"]}
                ]
            }
        },
        {
            title: "How danger is measured, and how to stay safe",
            paragraphs: [
                "There are three common ways to rank dangerous animals, and they give different winners. Deaths per year favours common animals that carry disease. Risk per encounter favours large predators and short-tempered herbivores. Venom potency, usually measured as the dose that kills half of lab mice, favours snakes, jellyfish and cone snails that may rarely meet a person. A good ranking says which of these it uses, which is why the tier list states that disease vectors are excluded.",
                "For most people the practical risks are mosquitoes, dogs and traffic collisions with wildlife, not sharks or lions. Sleeping under insecticide-treated nets and using repellent in malaria areas, getting rabies treatment quickly after any dog bite in a country where rabies is present, and keeping well back from water edges in crocodile and hippo country prevent far more deaths than any fear of big predators."
            ],
            cards: [
                {label: "Myth: sharks are among the deadliest animals", body: "Unprovoked shark bites kill fewer than ten people in most years worldwide."},
                {label: "Myth: plant eaters are harmless", body: "Hippos, elephants, Cape buffalo and rhinos kill more people than most predators."},
                {label: "Myth: the most venomous snake is the deadliest", body: "Deaths depend on how often snakes and people meet and on access to antivenom, not venom strength alone."},
                {label: "Myth: wolves are a major danger", body: "Fatal wolf attacks on people are rare, and most recorded cases involve rabies or wolves habituated to human food."}
            ],
            inlineLinks: [
                postLink("wildlife-photography-without-disturbing-animals", "Wildlife photography without disturbing animals"),
                tierLink("deadliest-animals-to-humans-in-the-wild", "Deadliest animals to humans in the wild tier list")
            ]
        }
    ],
    faq: [
        {
            question: "What is the most dangerous animal in the world?",
            answer: "The mosquito is the most dangerous animal in the world. It spreads malaria, dengue, yellow fever and Zika, and malaria alone caused an estimated 610,000 deaths in 2024. Ranked by the danger of a wild encounter instead, the AnimalDex tier list puts the crocodile first, followed by the hippopotamus and elephant."
        },
        {
            question: "What animal kills the most humans each year?",
            answer: "Mosquitoes kill the most humans each year, through the diseases they spread. After mosquitoes come humans themselves, with roughly 458,000 homicides a year, then snakes at about 81,000 to 138,000 deaths, and dogs, mostly through rabies. Large predators such as lions, tigers and sharks kill far fewer people."
        },
        {
            question: "What is the deadliest animal to humans in the wild?",
            answer: "Among wild animals that attack directly, crocodiles kill the most people, mainly Nile and saltwater crocodiles that ambush people at the water's edge. Hippos and elephants follow. The saw-scaled viper causes more snakebite deaths than almost any other snake because it is common near farms and villages."
        },
        {
            question: "What is the most dangerous animal in Africa?",
            answer: "The mosquito is the most dangerous animal in Africa, where about 95 percent of the world's malaria deaths happen. Among large animals, the hippopotamus and the Nile crocodile kill the most people, followed by elephants, Cape buffalo and venomous snakes such as puff adders and saw-scaled vipers."
        },
        {
            question: "What is the most venomous animal in the world?",
            answer: "The Australian box jellyfish is often called the most venomous animal, because its stings can kill an adult within minutes. On land, the inland taipan has the most toxic venom of any snake in lab tests. Neither is the deadliest snake or animal overall, because both rarely encounter people."
        },
        {
            question: "Is the hippo the most dangerous animal?",
            answer: "The hippo is one of the most dangerous large land animals, often said to kill around 500 people a year in Africa, though that figure is poorly documented. It is not the most dangerous animal overall: mosquitoes kill hundreds of times more people. On the AnimalDex tier list the hippopotamus ranks second, behind the crocodile."
        }
    ],
    sources: [
        {label: "World Health Organization: Malaria fact sheet", href: "https://www.who.int/news-room/fact-sheets/detail/malaria"},
        {label: "World Health Organization: Snakebite envenoming fact sheet", href: "https://www.who.int/news-room/fact-sheets/detail/snakebite-envenoming"},
        {label: "World Health Organization: Rabies fact sheet", href: "https://www.who.int/news-room/fact-sheets/detail/rabies"},
        {label: "World Health Organization: Chagas disease fact sheet", href: "https://www.who.int/news-room/fact-sheets/detail/chagas-disease-(american-trypanosomiasis)"},
        {label: "Florida Museum of Natural History: International Shark Attack File", href: "https://www.floridamuseum.ufl.edu/shark-attacks/"}
    ]
};

export const superlativeBlogPosts: BlogPost[] = [
    agilePost,
    adaptablePost,
    resilientPost,
    smartestPost,
    dangerousPost
];
