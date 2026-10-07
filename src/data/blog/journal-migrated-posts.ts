import {BlogPost} from "@/data/blog/types";

function journalPhoto(slug: string, file: string, alt: string, width: number, height: number, caption: string) {
    return {src: `/images/blog/${slug}/${file}`, alt, width, height, caption};
}

export const journalMigratedPosts: BlogPost[] = [
    {
        slug: "zoo-safari-and-family-animal-spotting-guide",
        title: "Zoo, safari or nature walk: a family animal spotting guide",
        description: "How to plan zoo visits, safari drives and local nature walks so kids actually see animals: best times, distances, simple games and what to look for.",
        publishedAt: "2026-03-22",
        updatedAt: "2026-10-07",
        featuredImage: journalPhoto(
            "zoo-safari-and-family-animal-spotting-guide",
            "serengeti-lion.webp",
            "Male lion resting in the Serengeti",
            1400,
            934,
            "Photo: Giles Laurent, CC BY-SA 4.0, via Wikimedia Commons."
        ),
        readingMinutes: 7,
        author: "AnimalDex",
        tags: ["Family animal learning", "Zoo animal app", "Safari animal app", "Nature walk"],
        searchIntents: ["family-friendly animal learning app", "zoo animal app", "safari animal app", "educational animal app", "animal spotting with kids", "zoo tips for families"],
        speciesSlugs: ["lion", "giraffe", "meerkat", "elephant", "red-fox", "european-robin"],
        tableOfContents: [
            "Start with curiosity, not a lecture",
            "Three outings, three kinds of animal awareness",
            "Timing beats luck",
            "How close is too close",
            "Games that make the sighting stick",
            "Respect for animals should feel natural, not preachy",
            "Where AnimalDex fits"
        ],
        relatedSlugs: ["zoo-vs-wild-animals-whats-the-difference", "how-to-identify-animals-in-the-wild-2026-guide", "why-real-animal-collecting-feels-so-good"],
        sections: [
            {
                title: "Start with curiosity, not a lecture",
                paragraphs: [
                    "Families get more out of animal spotting when it feels like a shared game instead of a lesson plan. Rather than trying to teach everything at once, pick one or two memorable details per animal: the giraffe's 45 cm tongue, the lion that sleeps up to 20 hours a day, the meerkat standing guard while the rest of the group digs.",
                    "That approach works in a zoo, on a safari drive and on the footpath behind your house. People remember what they noticed for themselves. The job of an adult, or a family-friendly animal app, is to turn that curiosity into a question the child can answer by looking harder."
                ],
                speciesSlugs: ["giraffe", "lion", "meerkat"]
            },
            {
                title: "Three outings, three kinds of animal awareness",
                paragraphs: [
                    "Zoos are the easiest place to compare species side by side and learn visible traits: horn shape, ear size, stripe pattern, how a bird's bill is built. Safari drives make habitat, behaviour and distance matter, because the animal decides whether you see it. Local nature walks train the hardest skill of all: noticing small clues such as tracks, droppings, feathers, calls and movement in the undergrowth.",
                    "The variety is the point. A child who has watched a captive elephant up close, then a wild herd from 100 m away, then a fox trotting along a hedge at dusk, understands that spotting is not only about naming what is in front of you. It is about learning how animals live and why a place suits them."
                ],
                table: {
                    columns: ["Setting", "What you will reliably see", "Best time", "What kids learn"],
                    rows: [
                        {cells: ["Zoo or wildlife park", "Large mammals, big cats, primates, reptiles, aviary birds", "Opening hour and scheduled feeding times", "Comparing shapes, colours and sizes across species"]},
                        {cells: ["Safari drive", "Herbivore herds, elephants, giraffes; predators with luck and a good guide", "First two hours after sunrise and the last two before sunset", "Distance, patience, reading behaviour and habitat"]},
                        {cells: ["Local nature walk", "Garden birds, squirrels, insects, amphibians, foxes and deer at dawn or dusk", "Early morning, or an hour before dark", "Tracks, sounds, camouflage and slowing down"]}
                    ]
                },
                media: {
                    type: "image",
                    image: journalPhoto(
                        "zoo-safari-and-family-animal-spotting-guide",
                        "game-drive.webp",
                        "African elephant drinking at the water's edge in Uganda",
                        1400,
                        1050,
                        "On safari the animal sets the distance: an elephant drinking at the edge of a channel in Uganda. Photo: Bosco of Enchanted Uganda Safaris, CC BY-SA 4.0, via Wikimedia Commons."
                    )
                },
                speciesSlugs: ["elephant", "giraffe", "red-fox"]
            },
            {
                title: "Timing beats luck",
                paragraphs: [
                    "Most mammals are crepuscular: they move at dawn and dusk and rest through the heat of the day. On safari that is why game drives leave before sunrise and go out again late afternoon. Lions and leopards are mostly nocturnal hunters, so a midday drive often finds them flat in the shade and a dawn drive finds them walking.",
                    "Zoos follow a different clock. Animals are most active just after the gates open, before crowds build, and around scheduled feeds or keeper talks. Check the day's timetable at the entrance and plan the route backwards from the two or three talks your family cares about most. Reptile houses and nocturnal houses are good afternoon stops because the light inside does not change.",
                    "For a nature walk, the first hour of daylight is when garden birds sing most and the ground is still damp enough to hold tracks. Robins, blackbirds and wrens sing from exposed perches at that hour, which is the easiest time to match a sound to a bird."
                ],
                speciesSlugs: ["lion", "european-robin"]
            },
            {
                title: "How close is too close",
                paragraphs: [
                    "Distance is a safety rule and a spotting technique. Wildlife authorities such as the US National Park Service ask visitors to stay at least 25 m (about 25 yards) from most wildlife and 100 m from bears and wolves, and to back away if an animal changes its behaviour because of you. Those numbers are a useful family rule everywhere: if the animal stops feeding, stares, flattens its ears or moves off, you are too close.",
                    "The same logic applies behind glass. Tapping, shouting and flash photography make zoo animals retreat to the back of the enclosure, which is exactly where you cannot see them. Quiet families are the ones who get the long look."
                ],
                cards: [
                    {label: "Signs you are too close", body: "Feeding stops, head comes up, ears go back, an alarm call, a sudden freeze, or the animal walks away from you."},
                    {label: "A child-sized binocular", body: "8x magnification with a 30 mm to 32 mm objective is light enough for a seven-year-old and bright enough for dusk. Practise focusing on a sign before the first animal."},
                    {label: "The car as a hide", body: "On safari and on country lanes, animals tolerate a parked vehicle far better than a person on foot. Stay seated, keep arms inside and let the engine idle rather than restarting it."},
                    {label: "Let the animal leave first", body: "If you wait for the animal to move on rather than walking off while it is still watching, you usually get a second, calmer sighting."}
                ]
            },
            {
                title: "Games that make the sighting stick",
                paragraphs: [
                    "A collectible journal gives outings structure without turning them into homework. Try completing a habitat set (one water animal, one grassland animal, one forest animal), spotting five mammals before lunch, logging one surprising fact per sighting, or comparing two lookalike species before the day ends: zebra and okapi stripes, a jackal and a fox, a heron and an egret.",
                    "Collection mechanics work because they reward attention. A sighting becomes memorable when it enters an album, contributes to a set, or unlocks a better understanding of what makes that species unusual. Kids who are asked \"what did it do?\" rather than \"what was it called?\" tend to remember both."
                ],
                media: {
                    type: "image",
                    image: journalPhoto(
                        "zoo-safari-and-family-animal-spotting-guide",
                        "family-binoculars.webp",
                        "Children looking through binoculars on a woodland birdwatching walk",
                        1400,
                        929,
                        "A school group scanning the canopy on a spring birdwatching walk. Photo: Walton LaVonda, U.S. Fish and Wildlife Service, Public domain, via Wikimedia Commons."
                    )
                },
                inlineLinks: [
                    {text: "Family zoo and safari learning", slug: "family-zoo-safari-animal-learning-app", href: "/use-cases/family-zoo-safari-animal-learning-app"},
                    {text: "How to identify animals in the wild", slug: "how-to-identify-animals-in-the-wild-2026-guide", href: "/blog/how-to-identify-animals-in-the-wild-2026-guide"}
                ]
            },
            {
                title: "Respect for animals should feel natural, not preachy",
                paragraphs: [
                    "The best wildlife habits are simple. Keep a calm distance. Do not tap glass, shout, chase, crowd, feed, or treat animals like props. Notice body language and let the animal's comfort set the limit. Feeding wild animals is the one rule worth repeating: it changes their behaviour, draws them to roads and makes macaques, gulls and deer bold enough to be dangerous.",
                    "When respectful observation is built into the game itself, children absorb a healthier relationship with wildlife without a lecture. Curiosity over cruelty is not a slogan. It is a better way to spot, learn and remember."
                ],
                pullQuote: "Quiet families get the long look. The animal decides how much you see, and calm distance is what earns it."
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex is designed to make those outings feel playful and premium at the same time. You photograph the animal live in the app, it resolves to a species card, and that card joins your collection with the place and date attached. Captures are live in-app photos; a photo from the camera roll is not a capture. Zoo animals count as sightings in the collection and are a good way for children to build recognition before the same species turns up in the wild.",
                    "That combination suits parents, travellers, zoo visitors and safari guests who want animal learning to feel alive instead of textbook-stiff."
                ],
                inlineLinks: [
                    {text: "Zoo vs wild animals", slug: "zoo-vs-wild-animals-whats-the-difference", href: "/blog/zoo-vs-wild-animals-whats-the-difference"}
                ]
            }
        ],
        faq: [
            {
                question: "What is the best time of day to see animals at a zoo?",
                answer: "The first hour after opening and the scheduled feeding times are the most active periods. Animals have just been let into their outdoor enclosures, crowds are thin, and keepers often give talks at feeds. Hot afternoons are quietest outdoors, so save reptile houses, aquariums and nocturnal houses for then."
            },
            {
                question: "How far should you stay from wild animals with children?",
                answer: "A widely used rule from the US National Park Service is at least 25 m from most wildlife and 100 m from bears and wolves. Wherever you are, the behavioural test matters more than the number: if the animal stops feeding, stares at you or moves away, you are too close and should back off."
            },
            {
                question: "What binoculars work for kids?",
                answer: "An 8x30 or 8x32 binocular is the usual recommendation: 8x is steady enough for small hands and a 30 mm to 32 mm lens is bright at dusk without being heavy. Avoid toy binoculars and anything above 10x, which is hard to hold still. Practise focusing on a fixed object before the first animal appears."
            },
            {
                question: "Can you use a safari trip to learn animal identification?",
                answer: "Yes, and it is one of the best classrooms. Guides point out behaviour, tracks and habitat as well as names, and herbivores such as giraffes, zebras and elephants are visible for long periods. Ask the guide one question per sighting about what the animal is doing, not only what it is."
            },
            {
                question: "Do zoo sightings count toward an animal collection?",
                answer: "In AnimalDex they do. A live capture of a zoo animal becomes a species card in your collection, with the place recorded. Many families use zoo cards to learn a species before they look for it in the wild, where the same animal is harder to find and photograph."
            }
        ],
        sources: [
            {label: "National Park Service: 7 ways to safely watch wildlife", href: "https://www.nps.gov/subjects/watchingwildlife/7ways.htm"},
            {label: "Association of Zoos and Aquariums", href: "https://www.aza.org/"},
            {label: "Cornell Lab of Ornithology: All About Birds", href: "https://www.allaboutbirds.org/"}
        ]
    },
    {
        slug: "why-real-animal-collecting-feels-so-good",
        title: "Why real-animal collecting feels so good to card collectors",
        description: "Why card collectors and creature-game fans find real-animal collecting so satisfying: natural rarity, lifers, place memory and set completion.",
        publishedAt: "2026-03-11",
        updatedAt: "2026-10-07",
        featuredImage: journalPhoto(
            "why-real-animal-collecting-feels-so-good",
            "painted-lady-echinacea.webp",
            "Painted lady butterfly feeding on an echinacea flower",
            1400,
            1050,
            "Photo: Jean-Pol Grandmont, CC BY 3.0, via Wikimedia Commons."
        ),
        readingMinutes: 6,
        author: "AnimalDex",
        tags: ["Animal card app", "Species collecting game", "Collector psychology", "Top Trumps-like animal app"],
        searchIntents: ["animal card collecting app", "species collecting game", "Pokemon-like animal app", "Top Trumps-like animal app", "why is collecting satisfying", "birding life list"],
        speciesSlugs: ["common-kingfisher", "european-robin", "red-fox", "barn-owl", "arctic-tern"],
        tableOfContents: [
            "Real animals already have rarity, variety and surprise built in",
            "Five kinds of real-world rarity",
            "Birders worked this out a century ago",
            "The best collection memories come from where you found them",
            "Stats and battles can add fun without replacing learning",
            "AnimalDex is trying to bridge both sides"
        ],
        relatedSlugs: ["real-life-pokemon-animals-you-can-collect-in-the-wild", "what-makes-an-animal-rare", "how-to-create-custom-animal-card-decks"],
        sections: [
            {
                title: "Real animals already have rarity, variety and surprise built in",
                paragraphs: [
                    "Collectors love variation, and real animals provide it without any lore. Some species are common, some are elusive, some look dramatic, some are subtle, and many become more interesting the longer you study them. A card game has to invent a drop rate. Nature already has one: a robin visits most European gardens daily, a kingfisher lives on most clean rivers but shows itself for two seconds as a blue streak, and a barn owl hunts the same fields every night while most people never see it.",
                    "That is why a wildlife collection can feel as rich as any fantasy set. The world already contains habitats, lookalikes, regional sets, seasonal changes and one-off sightings. The loop is grounded in reality, which makes each card feel earned rather than opened."
                ],
                media: {
                    type: "image",
                    image: journalPhoto(
                        "why-real-animal-collecting-feels-so-good",
                        "common-kingfisher.webp",
                        "Common kingfisher perched on a post above water",
                        1400,
                        1400,
                        "A common kingfisher: widespread, not threatened, and still one of the most sought-after sightings in Europe because it is so hard to see well. Photo: Scarabinol, CC BY 4.0, via Wikimedia Commons."
                    )
                },
                speciesSlugs: ["european-robin", "common-kingfisher", "barn-owl"]
            },
            {
                title: "Five kinds of real-world rarity",
                paragraphs: [
                    "Card rarity is one number. Animal rarity has several independent axes, and the mix is what keeps a real collection interesting for years. The table below is the version most birders and herpers carry in their heads whether or not they name it."
                ],
                table: {
                    columns: ["Type of rarity", "What it means", "Example", "How you beat it"],
                    rows: [
                        {cells: ["Seasonal", "Present only part of the year", "Arctic tern passing through on migration in spring and autumn", "Know the dates; check the same spot in the right fortnight"]},
                        {cells: ["Nocturnal", "Common but active after dark", "Barn owl, hedgehog, most moths", "Go out at dusk; use a red torch; listen before you look"]},
                        {cells: ["Range-restricted", "Lives only in a small area", "Island endemics, mountain-top species", "Travel, or accept the card will stay empty for a while"]},
                        {cells: ["Elusive", "Widespread but shy or well camouflaged", "Kingfisher, red fox in daylight, most snakes", "Sit still at one good spot for 30 minutes instead of walking"]},
                        {cells: ["Weather-dependent", "Appears under specific conditions", "Amphibians on the first warm wet night of spring; seabirds blown inland by storms", "Watch the forecast, not the calendar"]}
                    ]
                },
                speciesSlugs: ["arctic-tern", "red-fox"]
            },
            {
                title: "Birders worked this out a century ago",
                paragraphs: [
                    "Birdwatchers have run the oldest real-animal collecting game there is. A life list is every species you have ever identified; a year list resets each January; a patch list covers one local site; and a \"lifer\" is a species seen for the first time, the exact feeling a card collector gets from a chase card. Cornell's eBird holds more than a billion of these records, submitted as checklists, and the same list logic now runs through iNaturalist for everything from beetles to whales.",
                    "The reason the hobby lasts decades is that completion is impossible and progress is constant. Roughly 11,000 bird species exist and the most travelled listers have seen about 10,000 of them, so even the leaders are still collecting. A beginner's first hundred species can be found within a few kilometres of home, which is where most people fall in love with it."
                ],
                media: {
                    type: "gallery",
                    title: "The oldest collecting game",
                    images: [
                        journalPhoto(
                            "why-real-animal-collecting-feels-so-good",
                            "birders-list.webp",
                            "Two birdwatchers with a spotting scope recording a count on paper",
                            1400,
                            933,
                            "Counting birds for a citizen-science checklist: scope, notebook, and the discipline of writing down what was actually seen. Photo: PJeganathan, CC BY 4.0, via Wikimedia Commons."
                        ),
                        journalPhoto(
                            "why-real-animal-collecting-feels-so-good",
                            "field-notebook.webp",
                            "Biologist taking notes in a winter meadow",
                            1400,
                            786,
                            "Field notes are the original collection card: date, place, species, behaviour. Photo: U.S. Fish and Wildlife Service Southeast Region, Public domain, via Wikimedia Commons."
                        )
                    ]
                },
                inlineLinks: [
                    {text: "Real-life Pokémon you can collect in the wild", slug: "real-life-pokemon-animals-you-can-collect-in-the-wild", href: "/blog/real-life-pokemon-animals-you-can-collect-in-the-wild"}
                ]
            },
            {
                title: "The best collection memories come from where you found them",
                paragraphs: [
                    "A real-world sighting carries context. You remember the zoo visit, the park at sunrise, the surprise bird on a city street, the safari drive, the aquarium tunnel, or the family trip where everybody finally spotted the animal together. Psychologists call this episodic memory: a fact tied to a place and a moment is far easier to recall than the fact alone.",
                    "That gives a real-animal card something a fantasy set cannot copy. The entry is tied to a place, a time, a photo you took and often a person you were with. Collections built that way feel lived-in instead of accumulated, and they are the ones people still open years later."
                ],
                pullQuote: "A card you opened is a card you own. A card you found is a day you remember."
            },
            {
                title: "Stats and battles can add fun without replacing learning",
                paragraphs: [
                    "Collectors who also enjoy games often want more than a static archive. Progress, grading, missions, trades and even battles can make a species collection feel alive. The test is whether the system deepens interest or reduces an animal to a disposable number.",
                    "The fix is to anchor every stat in a real trait. A peregrine's speed stat should come from its 300 km/h stoop, an elephant's size stat from its six tonnes, an octopus's intelligence stat from documented problem solving. When a battle is lost because a cheetah tires after 30 seconds of sprinting, the player has learned something true about cheetahs. Grading a capture on sharpness, light and framing teaches photography without saying so."
                ],
                cards: [
                    {label: "Stat that teaches", body: "Speed, size, dominance, intelligence and rarity, each traceable to a real measurement or a conservation status."},
                    {label: "Mission that teaches", body: "\"Find three animals that use water to hunt\" sends you to a heron, a kingfisher and an otter, and you come back knowing how each one fishes."},
                    {label: "Trade that teaches", body: "Swapping a common local species for one from another continent is a geography lesson disguised as a deal."},
                    {label: "Grade that teaches", body: "A score for the photo, not the animal, rewards patience, distance and light rather than getting closer."}
                ],
                inlineLinks: [
                    {text: "Species collecting game with battles and trading", slug: "species-collecting-game-battles-trading-app", href: "/use-cases/species-collecting-game-battles-trading-app"}
                ]
            },
            {
                title: "AnimalDex is trying to bridge both sides",
                paragraphs: [
                    "AnimalDex sits between wildlife learning and collectible play. It is for people who enjoy the energy of creature collecting, card albums and set completion but want that energy aimed at real animals, real sightings and real curiosity. A capture is a live photo taken in the app; it resolves to a species card with stats, a rarity tier and your location attached. Camera-roll uploads are not captures, so every card in the collection was found, not filed.",
                    "That is why the product needs both halves. It is a collectible experience with sets, grades and progress, and it is an animal-learning app built around respectful observation and a growing field guide."
                ],
                inlineLinks: [
                    {text: "Wildlife collection and animal card app", slug: "wildlife-collection-animal-card-app", href: "/use-cases/wildlife-collection-animal-card-app"},
                    {text: "What makes an animal rare", slug: "what-makes-an-animal-rare", href: "/blog/what-makes-an-animal-rare"}
                ]
            }
        ],
        faq: [
            {
                question: "What is a life list in birdwatching?",
                answer: "A life list is the running total of every bird species a person has identified in the wild, kept for a lifetime. Birders also keep year lists, country lists and patch lists for one local site. A species seen for the first time is called a lifer, and it is the birding equivalent of pulling a chase card."
            },
            {
                question: "Why is collecting so satisfying?",
                answer: "Collecting combines three things people find rewarding: visible progress toward a set, unpredictable rewards, and ownership of something with a story. Real-animal collecting adds a fourth, the memory of the place and moment the animal was found, which is why a sighting tends to be remembered longer than a card bought in a pack."
            },
            {
                question: "Can a common animal still be a rare sighting?",
                answer: "Yes. Rarity for a collector depends on how hard the animal is to see, not only on how many exist. Kingfishers, barn owls, foxes and most snakes are widespread but elusive, nocturnal or well camouflaged, so a clear view of one is genuinely uncommon even though the species is not threatened."
            },
            {
                question: "Do you need to travel to build a good animal collection?",
                answer: "No. Most people can find their first hundred species within a few kilometres of home by covering different habitats at different times of day and year. Travel adds range-restricted species later, but local lists reward attention and repetition, which is where most lasting collections begin."
            },
            {
                question: "How does AnimalDex decide what counts as a capture?",
                answer: "A capture is a live photo taken with the in-app camera that resolves to a species card. Photos uploaded from the camera roll are not captures. An optional Instagram import exists, but it reviews each post before anything becomes a capture, so the collection stays a record of animals you actually found."
            }
        ],
        sources: [
            {label: "eBird, Cornell Lab of Ornithology", href: "https://ebird.org/"},
            {label: "iNaturalist", href: "https://www.inaturalist.org/"},
            {label: "Cornell Lab of Ornithology: All About Birds", href: "https://www.allaboutbirds.org/"}
        ]
    },
    {
        slug: "wildlife-photography-without-disturbing-animals",
        title: "Wildlife photography for beginners without stressing animals",
        description: "Beginner wildlife photography tips that keep animals calm: distances, stress signals, camera and phone settings, hides and the ethics rules.",
        publishedAt: "2026-03-04",
        updatedAt: "2026-10-07",
        featuredImage: journalPhoto(
            "wildlife-photography-without-disturbing-animals",
            "grey-heron-fishing.webp",
            "Grey heron fishing in a river",
            1400,
            1049,
            "Photo: Giacomo Cimino, CC BY-SA 4.0, via Wikimedia Commons."
        ),
        readingMinutes: 7,
        author: "AnimalDex",
        tags: ["Wildlife photography", "Respectful observation", "Travel spotting", "Animal discovery"],
        searchIntents: ["wildlife photography app", "wildlife photography tips", "safari animal app", "respectful wildlife observation", "wildlife photography ethics", "how to photograph animals without disturbing them"],
        speciesSlugs: ["red-deer", "barn-owl", "european-robin", "red-fox", "peregrine-falcon"],
        tableOfContents: [
            "The first rule is simple: the animal comes first",
            "Read the stress signals before the shutter",
            "Good animal photos are usually built on shape and context",
            "Settings that work for beginners",
            "Hides, cars and the art of staying put",
            "Work with light, patience and repeat sightings",
            "Logging the moment after the photo makes you a better observer",
            "Why this matters for AnimalDex"
        ],
        relatedSlugs: ["how-to-identify-animals-in-the-wild-2026-guide", "wildlife-photography-life-list", "zoo-safari-and-family-animal-spotting-guide"],
        sections: [
            {
                title: "The first rule is simple: the animal comes first",
                paragraphs: [
                    "A better wildlife photo is never worth a worse day for the animal. Do not crowd nests or dens, block an escape route, separate parents from young, bait animals toward the lens, use recorded calls to pull birds in, or keep moving closer after the animal has already noticed you. Audubon's ethical photography guide and most national park rules say the same thing in different words: if your presence changes the animal's behaviour, you are too close.",
                    "Beginners sometimes assume respectful photography means missing the shot. Usually the opposite is true. Calm distance, stillness and patience produce natural behaviour, and natural behaviour is what makes a wildlife photograph worth looking at."
                ],
                media: {
                    type: "image",
                    image: journalPhoto(
                        "wildlife-photography-without-disturbing-animals",
                        "photographer-telephoto.webp",
                        "Photographer lying flat on the ground with a telephoto lens while a desert tortoise walks past",
                        1400,
                        900,
                        "Low, still and far enough away that the tortoise keeps walking: the whole method in one frame. Photo: Joshua Tree National Park, Public domain, via Wikimedia Commons."
                    )
                }
            },
            {
                title: "Read the stress signals before the shutter",
                paragraphs: [
                    "Animals tell you when you have crossed the line, and the signals are consistent within each group. Learning a handful of them turns a vague rule into a decision you can make in the field."
                ],
                table: {
                    columns: ["Animal group", "Early warning", "Clear stress", "What to do"],
                    rows: [
                        {cells: ["Birds", "Stops feeding, head up, body feathers sleeked", "Alarm calls, repeated short flights, feigned injury near a nest", "Lower the camera, step back along the way you came"]},
                        {cells: ["Deer and antelope", "Ears swivel toward you, chewing stops", "Foot stamp, snort, tail flag, bounding away", "Freeze, then retreat; never follow"]},
                        {cells: ["Foxes, otters, small mammals", "Freeze, stare", "Flattened ears, bolting for cover", "Stay seated and let it choose to return"]},
                        {cells: ["Reptiles basking", "Head lifts, body tenses", "Dash for cover; basking abandoned", "Give it ten minutes; it needs that warmth"]},
                        {cells: ["Seals and sea lions", "Heads up along the haul-out", "Stampede into the water", "Stay well back on the beach; 50 m is a common minimum"]}
                    ]
                },
                speciesSlugs: ["red-deer", "red-fox"]
            },
            {
                title: "Good animal photos are usually built on shape and context",
                paragraphs: [
                    "Sharp feather detail is nice, but identification often comes from the whole scene. Body shape, gait, bill or muzzle profile, tail use, horn direction, wing posture and the landscape around the animal can matter more than perfect texture. A robin on a spade handle in a garden tells you more than a frame-filling robin's eye.",
                    "That is why many of the strongest photos for identification are not extreme close-ups. They show enough of the environment to make the sighting make sense, and they are often the frames a longer lens would have cropped away."
                ],
                speciesSlugs: ["european-robin"]
            },
            {
                title: "Settings that work for beginners",
                paragraphs: [
                    "You do not need a professional kit, but you do need to stop blur. For birds and moving mammals, a shutter speed of 1/1000 s or faster freezes most action; 1/250 s is enough for a resting animal. Shutter-priority or a sports mode gets you there on any camera. Raise ISO before you drop shutter speed: a slightly grainy sharp photo beats a clean blurred one.",
                    "On a phone, use the longest optical lens you have (usually 2x, 3x or 5x) rather than pinching to zoom, which only crops. Tap the animal to focus and lock exposure, hold the phone with both hands or brace it against a post, and shoot bursts. A small clip-on phone adapter for binoculars or a spotting scope (digiscoping) is the cheapest route to a usable photo at 50 m without moving a step."
                ],
                cards: [
                    {label: "Shutter", body: "1/1000 s for birds in flight and running mammals, 1/500 s for walking animals, 1/250 s for anything still."},
                    {label: "Aperture", body: "Wide open (the smallest f-number) for a single animal; stop down two stops for a group so all faces are sharp."},
                    {label: "ISO", body: "Let it climb. Modern sensors and phones handle ISO 1600 to 3200 well at dusk, when most animals move."},
                    {label: "Focus", body: "Single-point or animal-eye autofocus on the eye. If the eye is sharp, the picture works; if not, little else saves it."},
                    {label: "Lens", body: "A 300 mm to 600 mm telephoto keeps you outside an animal's flight distance. On a phone, the longest optical camera plus a scope does the same job."},
                    {label: "Flash", body: "Off. Flash startles nocturnal animals and can temporarily blind them; a red-filtered torch and high ISO are the humane alternative."}
                ],
                speciesSlugs: ["peregrine-falcon"]
            },
            {
                title: "Hides, cars and the art of staying put",
                paragraphs: [
                    "The oldest trick in wildlife photography is to arrive before the animal and let it come to you. Nature reserves build hides for this reason: a wooden screen with a window, placed where birds already feed or drift past, takes the human shape out of the landscape. Thirty minutes in a hide usually produces closer, calmer behaviour than three hours of walking.",
                    "A parked car is a hide on wheels. Deer, foxes, raptors and most waterbirds tolerate a stationary vehicle far closer than they tolerate a person on foot. Switch the engine off, open the window slowly, rest the lens on a folded jacket and wait. On safari the same rule applies: the moment someone stands up in the vehicle, the sighting is usually over."
                ],
                media: {
                    type: "image",
                    image: journalPhoto(
                        "wildlife-photography-without-disturbing-animals",
                        "bird-hide.webp",
                        "Wooden bird hide with a Quiet Please sign at an RSPB reserve",
                        1400,
                        933,
                        "A hide at Fowlmere RSPB reserve in England: a window at the right height and a sign that sums up the method. Photo: Hugh Venables, CC BY-SA 2.0, via Wikimedia Commons."
                    )
                }
            },
            {
                title: "Work with light, patience and repeat sightings",
                paragraphs: [
                    "Early and late light helps colour and contrast and, more usefully, coincides with when most animals are active. Side light shows texture in fur and feathers; front light at midday flattens everything and sends mammals into the shade. If you wait instead of forcing the moment, animals often turn, pause, feed or move into a cleaner angle on their own.",
                    "Repeat sightings are valuable too. One frame might show the head pattern, another the way the animal moves, another its size against a fence post or a known plant. A journaled approach lets each sighting add evidence, which is how uncertain identifications get resolved later."
                ],
                pullQuote: "The animals that walk into a good photo are the ones that never noticed the photographer."
            },
            {
                title: "Logging the moment after the photo makes you a better observer",
                paragraphs: [
                    "The photo is only part of the record. Note where you were, what the habitat looked like, what the animal was doing and what first caught your eye. Those details help with identification later, separate lookalike species, and make the sighting more meaningful than a file name.",
                    "This is where a wildlife photography app and a field journal work together. The useful version does not just store pictures. It attaches species, place and date to each one, so a folder of JPEGs becomes a list of animals you have actually seen."
                ],
                inlineLinks: [
                    {text: "Wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"},
                    {text: "Build a wildlife photography life list", slug: "wildlife-photography-life-list", href: "/blog/wildlife-photography-life-list"}
                ]
            },
            {
                title: "Why this matters for AnimalDex",
                paragraphs: [
                    "AnimalDex is built for photographers because the camera is usually the bridge between noticing and understanding. A live capture in the app resolves to a species card, and the card carries the place and date. The grade on a capture scores the photo, not the animal: a sharp, well-lit frame taken from a respectful distance outranks a close blur, which rewards exactly the habits described above.",
                    "That is useful whether you are photographing birds near home, mammals on safari, reptiles at a zoo, or an unexpected species on a family trip."
                ],
                inlineLinks: [
                    {text: "How to identify animals in the wild", slug: "how-to-identify-animals-in-the-wild-2026-guide", href: "/blog/how-to-identify-animals-in-the-wild-2026-guide"}
                ]
            }
        ],
        faq: [
            {
                question: "How close can you get to wildlife for a photo?",
                answer: "Close enough that the animal keeps doing what it was doing, and no closer. US national parks set a minimum of 25 m for most wildlife and 100 m for bears and wolves; seal and sea-lion haul-outs usually ask for 50 m. If feeding stops or the animal stares, you have already crossed its comfort line and should back away."
            },
            {
                question: "What shutter speed do you need for wildlife photography?",
                answer: "Use 1/1000 s or faster for birds in flight and running mammals, around 1/500 s for walking animals, and 1/250 s for a resting subject. Raise ISO rather than slowing the shutter when light fades, because a slightly noisy sharp image is usable and a blurred one is not."
            },
            {
                question: "Can you take good wildlife photos with a phone?",
                answer: "Yes, within limits. Use the longest optical lens rather than digital zoom, tap to focus on the animal, brace the phone and shoot bursts. For anything beyond about 20 m, a clip-on adapter that holds the phone to binoculars or a spotting scope gives far better results than cropping and keeps you outside the animal's flight distance."
            },
            {
                question: "Is it okay to use bird call playback for photos?",
                answer: "Most ethical guidelines, including Audubon's, advise against it, and it is banned in many reserves. Playback pulls birds off nests and territories, costs them energy and can expose them to predators. Patience at a feeding spot or a hide gets natural behaviour without the harm."
            },
            {
                question: "Should you use flash on animals at night?",
                answer: "No. Flash startles nocturnal animals and can leave them temporarily dazzled and vulnerable. Use a red-filtered torch for finding animals, raise ISO, and accept that a night photo will be grainy. For owls, nightjars and frogs, a short red-light look is the humane limit."
            }
        ],
        sources: [
            {label: "Audubon's guide to ethical bird photography", href: "https://www.audubon.org/get-outside/audubons-guide-ethical-bird-photography"},
            {label: "National Park Service: 7 ways to safely watch wildlife", href: "https://www.nps.gov/subjects/watchingwildlife/7ways.htm"},
            {label: "North American Nature Photography Association: ethical field practices", href: "https://nanpa.org/"}
        ]
    }
];
