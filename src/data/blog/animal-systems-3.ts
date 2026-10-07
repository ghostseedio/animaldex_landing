import {createAnimalSystemsPost, type BlogPost} from "@/data/blog/types";

export const animalSystemsPosts3: BlogPost[] = [
    createAnimalSystemsPost({
        speciesSlug: "dolphin",
        updatedAt: "2026-10-07",
        slug: "how-dolphin-intelligence-works-in-the-wild",
        title: "How Dolphin Intelligence Works in the Wild",
        description: "How dolphin intelligence works: signature whistles, echolocation clicks, mirror self-recognition and cooperative hunts like mud-ring feeding.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/dolphin-intelligence-a-pack-of-dolphins.jpg",
            alt: "A pod of dolphins illustrating social intelligence, echolocation, and coordinated survival strategy for AnimalDex",
            width: 2048,
            height: 1152,
            caption: "A pack of dolphins captures the social coordination and real-time sensing that make dolphin intelligence so effective in the wild."
        },
        readingMinutes: 7,
        tags: ["Dolphin intelligence", "Marine behavior", "Animal behavior"],
        searchIntents: ["dolphin intelligence", "dolphin behavior", "how do dolphins echolocate", "dolphin signature whistles", "do dolphins recognize themselves in a mirror", "how dolphins hunt together"],
        relatedSlugs: ["how-octopus-intelligence-works", "what-makes-crows-so-intelligent", "how-whale-sharks-feed-at-ocean-scale"],
        tableOfContents: [
            "Why dolphins are more than just charismatic animals",
            "What makes a dolphin unique?",
            "How dolphins survive and hunt",
            "The ecosystem role of dolphins",
            "How to spot and photograph dolphins",
            "What humans can learn from dolphins"
        ],
        sections: [
            {
                title: "Why dolphins are more than just charismatic animals",
                paragraphs: [
                    "The common bottlenose dolphin (Tursiops truncatus) is 2 to 4 metres long, weighs 150 to 650 kilograms, lives 40 to 60 years and carries a brain of roughly 1,500 grams. Relative to body size, that brain is second only to the human brain among mammals. The interesting part is not the size but what the animal does with it in an environment where sight often fails within a few metres.",
                    "Dolphins have to sense, coordinate and hunt in murky estuaries, at night and at depth. They do it with sound, with memory of individuals and with hunting techniques that are learned and passed between animals rather than fixed by instinct. That is what makes dolphin intelligence operational rather than decorative."
                ],
                inlineLinks: [
                    {text: "bottlenose dolphin", slug: "dolphin"},
                    {text: "orca", slug: "orca"}
                ]
            },
            {
                title: "What makes a dolphin unique?",
                paragraphs: [
                    "Echolocation is the headline. A dolphin produces broadband clicks in the phonic lips inside its nasal passages, focuses them through the fatty melon on its forehead and receives the returning echoes through fat channels in the lower jaw that lead to the inner ear. The clicks peak between roughly 40 and 130 kilohertz, far above human hearing. In open water a bottlenose can detect a 2.5-centimetre steel sphere from about 70 metres away.",
                    "Click timing is tied to distance. Searching dolphins space clicks so that each echo returns before the next click leaves. As they close on a fish, the interval shrinks until the clicks blur into a buzz of several hundred per second, giving a near-continuous picture in the last metres before capture.",
                    "The second system is social. Each dolphin develops a signature whistle in its first year that stays stable for life. Dolphins use these whistles to announce themselves, and they copy another animal's whistle to address that specific individual, which is the closest thing to a name found outside humans. In 2001 Diana Reiss and Lori Marino showed that two bottlenose dolphins marked with ink twisted to inspect the marks in a mirror, passing the mirror self-recognition test that only great apes, elephants and a handful of other species have passed. Later work found dolphins pass it from about seven months of age."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-dolphin-intelligence-works-in-the-wild/bottlenose-dolphin-pod.webp",
                        alt: "A pod of common bottlenose dolphins (Tursiops truncatus) surfacing together in open water",
                        width: 1400,
                        height: 672,
                        caption: "Atlantic bottlenose dolphins surfacing together in Pine Island Sound, Florida. Photo: James St. John, CC BY 2.0, via Wikimedia Commons."
                    }
                },
                table: {
                    columns: ["Ability", "What it does", "Numbers to know"],
                    rows: [
                        {cells: ["Echolocation clicks", "Builds a sound image of prey, seabed and other animals", "Peak 40–130 kHz; terminal buzz of several hundred clicks per second"]},
                        {cells: ["Signature whistle", "Identifies the individual; copied by others to address it", "Learned in year one, stable for life"]},
                        {cells: ["Mirror self-recognition", "Inspects marks on its own body using a mirror", "Demonstrated in 2001; passed from about 7 months old"]},
                        {cells: ["Unihemispheric sleep", "Rests one brain half while the other keeps surfacing to breathe", "Each half sleeps in turn, around 4 hours at a time"]}
                    ]
                }
            },
            {
                title: "How dolphins survive and hunt",
                paragraphs: [
                    "A bottlenose eats about 4 to 6 percent of its body weight in fish and squid each day, so hunting efficiency matters. Pods use tactics that fit the local water. In the shallows of Florida Bay one dolphin circles a school of mullet while beating its tail flukes to stir up a ring of silt. The fish panic at the rising wall of mud and leap over it, straight into the open mouths of the dolphins waiting on the outside. This mud-ring feeding is a learned, cooperative routine with a distinct role for the circling animal.",
                    "On the salt-marsh creeks of South Carolina and Georgia, dolphins drive fish onto exposed mudbanks and slide out of the water on their right sides to grab them, a technique called strand feeding. In Shark Bay, Western Australia, some females carry a marine sponge on the rostrum to protect it while probing the seabed for fish, and daughters learn the habit from their mothers. In Laguna, Brazil, dolphins herd mullet toward fishermen's nets and take the fish that scatter.",
                    "Social structure supports all of this. Bottlenose societies are fission–fusion: groups form, split and re-form over hours, while long-term bonds persist. Males in Shark Bay form alliances of two to three animals that nest inside larger second-order alliances of up to 14, a layered social system rarely seen outside primates."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-dolphin-intelligence-works-in-the-wild/bottlenose-dolphin-leaping.webp",
                        alt: "A common bottlenose dolphin surfacing at speed beside a ferry, showing the streamlined body and dorsal fin",
                        width: 1400,
                        height: 791,
                        caption: "A bottlenose dolphin porpoising beside a ferry in the Azores. Short bursts of 30 km/h or more are typical. Photo: Jules Verne Times Two, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                pullQuote: "Dolphins sense while moving and update while committing. They do not pause the world while they think."
            },
            {
                title: "The ecosystem role of dolphins",
                paragraphs: [
                    "Dolphins are top predators of fish and squid in coastal and open water, and their pressure shapes how prey schools behave and where they gather. Because they sit high in the food web and live for decades in the same bays, they accumulate pollutants and reflect the health of their habitat; NOAA treats coastal bottlenose populations as sentinels of ocean health and runs long-term health assessments on resident groups such as those in Sarasota Bay, where individuals have been tracked since 1970.",
                    "Their own predators are few: large sharks such as tiger and bull sharks take calves, and in some regions orcas hunt adults. Threats from people are larger, including gillnet bycatch, boat strikes, noise that interferes with echolocation and prey depletion."
                ],
                speciesSlugs: ["dolphin", "orca"]
            },
            {
                title: "How to spot and photograph dolphins",
                paragraphs: [
                    "Bottlenose dolphins live in every tropical and temperate sea, often within sight of shore. The clues below improve your odds of a clear sighting and a usable photo."
                ],
                cards: [
                    {label: "Watch the birds", body: "Diving terns and gannets mark baitfish schools. Dolphins feeding underneath often surface in the same patch within minutes."},
                    {label: "Flat water, early light", body: "Calm mornings make dorsal fins and blows visible from far off. Look for a dark triangular fin that rolls forward rather than the fixed fin of a shark."},
                    {label: "Bow waves and ferries", body: "Dolphins ride the pressure wave at the bow of moving boats. Stand forward, keep a fast shutter ready and expect them to surface for less than a second."},
                    {label: "Shoot the fin", body: "Researchers identify individuals by notches on the dorsal fin's trailing edge. A sharp side-on fin photo is the one worth keeping, and it is what a live in-app capture records best."}
                ],
                inlineLinks: [
                    {text: "wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}
                ]
            },
            {
                title: "What humans can learn from dolphins",
                paragraphs: [
                    "Dolphins are a lesson in live feedback. Waiting for perfect visibility is too slow in their world, so they built sensing into motion: the click rate rises as the target gets closer, and the plan updates with every echo.",
                    "The second lesson is that technique travels socially. Mud-ring feeding, sponging and strand feeding are not in the genome; they are kept alive by animals watching each other. Strong systems do not pause the world while they think, and they make it easy for the next generation to copy what works."
                ],
                inlineLinks: [
                    {text: "how octopus intelligence works", slug: "how-octopus-intelligence-works", href: "/blog/how-octopus-intelligence-works"},
                    {text: "what makes crows so intelligent", slug: "what-makes-crows-so-intelligent", href: "/blog/what-makes-crows-so-intelligent"}
                ]
            }
        ],
        faq: [
            {
                question: "How intelligent are dolphins compared to other animals?",
                answer: "Dolphins rank with great apes, elephants and corvids among the most cognitively capable non-human animals. Bottlenose dolphins pass the mirror self-recognition test, use individually distinct signature whistles that work like names, learn hunting techniques from each other and form layered male alliances. Their brain-to-body ratio is the second highest among mammals after humans."
            },
            {
                question: "How does dolphin echolocation work?",
                answer: "A dolphin makes rapid clicks in its nasal passages, focuses them through the melon on its forehead and listens for echoes through its lower jaw. The clicks peak at 40 to 130 kilohertz. Echo timing gives distance, and the dolphin speeds up its clicks as it closes in, ending in a buzz of several hundred clicks per second just before it seizes a fish."
            },
            {
                question: "Do dolphins have names?",
                answer: "In a practical sense, yes. Each bottlenose dolphin develops a unique signature whistle during its first year and uses it for life. Other dolphins copy that whistle to call the specific individual, and experiments show dolphins respond to playback of their own whistle even when voice features are removed. It is the clearest example of learned, name-like labels outside humans."
            },
            {
                question: "How do dolphins hunt together?",
                answer: "Dolphins use cooperative tactics matched to local conditions. In Florida Bay one dolphin stirs a ring of mud around a fish school so the fish leap into the mouths of waiting pod members. In the Carolinas they drive fish onto mudbanks and slide out to grab them. Pods also herd schools into tight balls and take turns passing through."
            },
            {
                question: "Where is the best place to see wild dolphins?",
                answer: "Bottlenose dolphins live in nearly all temperate and tropical coastal waters, so estuaries, bays and harbour mouths near you are the first place to look. Known resident populations include Sarasota Bay in Florida, Shark Bay in Western Australia, the Moray Firth in Scotland and the Azores. Calm mornings and feeding seabirds are the best cues."
            }
        ],
        sources: [
            {label: "NOAA Fisheries: Common Bottlenose Dolphin", href: "https://www.fisheries.noaa.gov/species/common-bottlenose-dolphin"},
            {label: "Britannica: Bottlenose dolphin", href: "https://www.britannica.com/animal/bottlenose-dolphin"},
            {label: "Reiss & Marino (2001), Mirror self-recognition in the bottlenose dolphin, PNAS", href: "https://www.pnas.org/doi/10.1073/pnas.101086398"}
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "eagle",
        updatedAt: "2026-10-07",
        slug: "how-eagles-use-height-vision-and-timing",
        title: "How Eagles Use Height, Vision, and Timing to Survive",
        description: "How eagles hunt: visual acuity 4–8 times ours, two foveae per eye, 2-metre wingspans, thermal soaring and stoops over 240 km/h, with a species comparison.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/how-eagles-use-height-vision-and-timing-to-survive.webp",
            alt: "Eagle featured image for the AnimalDex article on height, vision, and timing",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 7,
        tags: ["Eagle behavior", "Animal vision", "Predator ecology"],
        searchIntents: ["eagle behavior", "how good is eagle vision", "how eagles hunt", "bald eagle vs golden eagle", "eagle wingspan", "how fast can an eagle dive"],
        relatedSlugs: ["how-barn-owls-hunt-in-the-dark", "how-tigers-survive-as-solo-apex-hunters", "how-wolves-hunt-survive-and-shape-ecosystems"],
        tableOfContents: [
            "Why eagles still feel like the benchmark for aerial predators",
            "What makes an eagle unique?",
            "How eagles survive",
            "Eagle species compared",
            "The ecosystem role of eagles",
            "How to spot and photograph eagles",
            "What humans can learn from eagles"
        ],
        sections: [
            {
                title: "Why eagles still feel like the benchmark for aerial predators",
                paragraphs: [
                    "Eagles convert vertical space into information. From 300 metres up, a golden eagle can survey several square kilometres of hillside and pick out a hare moving in the grass, then choose whether the chase is worth the energy. Height gives them a view, the view gives them options, and the options let them strike only when the odds are good.",
                    "Around 60 species carry the name eagle, from the 2-kilogram booted eagle to the harpy and Steller's sea eagle at up to 9 kilograms. What they share is a hooked bill, powerful feet with long talons and large eyes that take up much of the skull. That package makes eagles useful for understanding animal behaviour that depends less on raw speed and more on a premium view of the hunting ground."
                ],
                inlineLinks: [
                    {text: "eagle", slug: "eagle"},
                    {text: "harpy eagle", slug: "harpy-eagle"}
                ]
            },
            {
                title: "What makes an eagle unique?",
                paragraphs: [
                    "An eagle's eye is about the same size as a human eye in a head a fraction of the size, and it is packed with far more cone cells. Estimates put eagle visual acuity at four to eight times ours, which is why a bald eagle is said to pick out a rabbit from roughly 3 kilometres. Each eye has two foveae, the pits of sharpest vision: a deep central fovea that looks sideways for scanning the ground, and a shallower temporal fovea that looks forward and pairs with the other eye for binocular depth judgement in the final approach.",
                    "The eyes are fixed in their sockets, so the bird aims them by moving its head. A bony brow ridge shades the eye from glare, and a transparent third eyelid, the nictitating membrane, sweeps across to clear dust without blocking the view. Eagles also see into the ultraviolet range that humans miss.",
                    "The capture end is the feet. A bald eagle's talons are about 5 centimetres long and are closed by tendons that ratchet and lock, so the bird can hold a struggling fish without continuous muscular effort. Its grip is many times stronger than a human hand."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-eagles-use-height-vision-and-timing/golden-eagle-portrait.webp",
                        alt: "Close portrait of a golden eagle (Aquila chrysaetos) showing the hooked bill, brow ridge and forward-facing eye",
                        width: 1400,
                        height: 930,
                        caption: "A golden eagle's eye sits under a bony brow that cuts glare; each eye holds two foveae. Photo: Böhringer Friedrich, CC BY-SA 2.5, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "How eagles survive",
                paragraphs: [
                    "Flapping a 2-metre wing is expensive, so eagles let the air do the work. Broad wings with slotted primary feathers let them circle inside rising columns of warm air called thermals, gaining hundreds of metres without a wingbeat, then glide to the next thermal. Migrating golden eagles ride ridge lift along mountain chains such as the Appalachians, which is why hawk-watch sites on ridges count thousands of raptors in autumn.",
                    "Cruising flight runs at about 50 to 65 kilometres per hour. When a golden eagle folds its wings into a stoop it can exceed 240 kilometres per hour, and a bald eagle diving on a fish reaches around 160. The strike itself is brief: a bald eagle skims the surface and lifts a fish in its talons without stopping, while a golden eagle hits a hare or ground squirrel from a low, fast glide along a slope.",
                    "Timing extends to the calendar. Bald eagles in the Pacific Northwest gather in their thousands on rivers such as the Chilkat in late autumn to feed on spent salmon, and pairs return to the same nest for years, adding sticks each season. The largest recorded bald eagle nest, in Florida, measured 2.9 metres across and 6 metres deep and weighed about 2 tonnes."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-eagles-use-height-vision-and-timing/bald-eagle-flight.webp",
                        alt: "A bald eagle (Haliaeetus leucocephalus) in flight with wings fully spread, white head and tail against conifers",
                        width: 1400,
                        height: 933,
                        caption: "A bald eagle soaring near Tofino, British Columbia, with the slotted primary feathers that cut drag while circling in thermals. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                pullQuote: "Better vantage often beats faster reaction. Eagles let the environment subsidise the search."
            },
            {
                title: "Eagle species compared",
                paragraphs: [
                    "The two North American eagles are often confused in the air. Adult bald eagles are unmistakable with white heads and tails, but immatures are mottled brown for four to five years and look like golden eagles. Golden eagles show a golden nape, feathered legs and hold their wings in a slight V when soaring."
                ],
                table: {
                    columns: ["Species", "Wingspan", "Weight", "Main prey", "Range"],
                    rows: [
                        {cells: ["Bald eagle (Haliaeetus leucocephalus)", "1.8–2.3 m", "3–6.3 kg", "Fish, waterfowl, carrion", "North America"]},
                        {cells: ["Golden eagle (Aquila chrysaetos)", "1.8–2.3 m", "3–6 kg", "Hares, ground squirrels, marmots", "Northern Hemisphere"]},
                        {cells: ["Harpy eagle (Harpia harpyja)", "1.8–2.2 m", "4–9 kg", "Sloths, monkeys", "Central and South America"]},
                        {cells: ["Steller's sea eagle (Haliaeetus pelagicus)", "2.0–2.5 m", "5–9 kg", "Salmon, seabirds", "Coastal north-east Asia"]},
                        {cells: ["Wedge-tailed eagle (Aquila audax)", "1.8–2.3 m", "3–5.5 kg", "Rabbits, wallabies, carrion", "Australia, New Guinea"]}
                    ]
                },
                speciesSlugs: ["bald-eagle", "golden-eagle", "harpy-eagle"]
            },
            {
                title: "The ecosystem role of eagles",
                paragraphs: [
                    "Eagles sit at the top of their food webs, taking fish, birds and medium-sized mammals and cleaning up carrion. Because they eat high on the chain and nest near water, they concentrate whatever pollutants the system carries. The pesticide DDT thinned bald eagle eggshells so badly that only about 417 nesting pairs remained in the lower 48 US states in 1963. After the 1972 DDT ban and legal protection, the population reached an estimated 71,400 nesting pairs by 2019, and the species was removed from the US endangered list in 2007.",
                    "Bald eagles also steal fish from ospreys, a habit called kleptoparasitism, and their abandoned nests house owls and other raptors. Golden eagles regulate rabbit and ground-squirrel numbers across open country, and their persistence signals that a landscape still holds enough prey and undisturbed cliffs or trees for nesting."
                ],
                inlineLinks: [
                    {text: "osprey", slug: "osprey"},
                    {text: "peregrine falcon", slug: "peregrine-falcon"}
                ]
            },
            {
                title: "How to spot and photograph eagles",
                paragraphs: [
                    "Eagles are large enough to find without special gear if you read the landscape. The cues below work for both bald and golden eagles."
                ],
                cards: [
                    {label: "Follow the water", body: "Bald eagles perch on tall dead trees beside lakes, rivers and estuaries. Scan the top third of shoreline snags; the white head shows from a long way off."},
                    {label: "Ridges on windy days", body: "Golden eagles work slopes and ridgelines where wind deflects upward. Hawk-watch sites count the most birds in October and November on days with a north-west wind."},
                    {label: "Midday thermals", body: "Soaring starts once the sun has warmed the ground, usually mid-morning. Look for a flat-winged silhouette circling without flapping, far higher than vultures."},
                    {label: "Winter concentrations", body: "Dams, fish runs and open water in frozen country pull dozens of bald eagles together. A live in-app capture from a car window at a known winter roost beats hours of walking."}
                ]
            },
            {
                title: "What humans can learn from eagles",
                paragraphs: [
                    "Eagles show the value of stepping back far enough to see the real pattern before committing scarce energy. A thermal costs nothing to ride, and the view from the top turns a search into a selection.",
                    "That is the systems lesson: a better vantage point beats a faster reaction, and patience spent gaining height is repaid in the strike. Barn owls solve the same problem with sound instead of sight, which makes a useful comparison."
                ],
                inlineLinks: [
                    {text: "how barn owls hunt in the dark", slug: "how-barn-owls-hunt-in-the-dark", href: "/blog/how-barn-owls-hunt-in-the-dark"}
                ]
            }
        ],
        faq: [
            {
                question: "How good is an eagle's eyesight?",
                answer: "Eagle vision is estimated at four to eight times sharper than human vision. Each eye has two foveae, one for scanning sideways and one for binocular judgement straight ahead, and the retina is densely packed with cone cells. A bald eagle is reported to spot a rabbit from about 3 kilometres, and eagles can also see ultraviolet light that humans cannot."
            },
            {
                question: "How fast can an eagle dive?",
                answer: "A golden eagle in a full stoop can exceed 240 kilometres per hour, which makes it one of the fastest animals on Earth behind the peregrine falcon. Bald eagles dive more shallowly on fish at around 160 kilometres per hour. In level cruising flight both species travel at a more modest 50 to 65 kilometres per hour."
            },
            {
                question: "What is the difference between a bald eagle and a golden eagle?",
                answer: "Adult bald eagles have a white head and tail, a yellow bill and bare lower legs, and they hunt mainly fish near water. Golden eagles are dark brown with a golden nape, feathered legs and a slight V to their soaring wings, and they hunt hares and ground squirrels over open country. Immature bald eagles are brown and are the usual source of confusion."
            },
            {
                question: "How big is an eagle's wingspan?",
                answer: "Most large eagles span 1.8 to 2.3 metres. Bald and golden eagles both fall in that range, with females larger than males. Steller's sea eagle reaches 2.5 metres, among the widest of any eagle. The harpy eagle has a shorter span of about 2 metres but is heavier, with females up to 9 kilograms."
            },
            {
                question: "Where can I see a bald eagle in the wild?",
                answer: "Look along rivers, lakes and coasts across North America, especially where fish gather. Winter concentrations form below dams and on open water in frozen regions, and Alaska's Chilkat River hosts thousands in November. Bald eagles have recovered to more than 70,000 nesting pairs in the lower 48 states, so most large waterways now have a resident pair."
            }
        ],
        sources: [
            {label: "Cornell Lab of Ornithology: Bald Eagle", href: "https://www.allaboutbirds.org/guide/Bald_Eagle/overview"},
            {label: "Cornell Lab of Ornithology: Golden Eagle", href: "https://www.allaboutbirds.org/guide/Golden_Eagle/overview"},
            {label: "Britannica: Eagle", href: "https://www.britannica.com/animal/eagle"}
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "termite",
        updatedAt: "2026-10-07",
        slug: "how-termites-build-living-infrastructure",
        title: "How Termites Build Living Infrastructure",
        description: "How termite mounds work: Macrotermes ventilation and temperature control, fungus farming, million-strong colonies and why mounds make savannas fertile.",
        featuredImage: {
            src: "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/termites-close-up.webp",
            alt: "Termites close-up featured image for the AnimalDex article on living infrastructure and mound engineering",
            width: 1200,
            height: 675,
            caption: "Featured image source: AnimalDex CDN."
        },
        readingMinutes: 8,
        tags: ["Termite behavior", "Ecosystem engineering", "Animal systems"],
        searchIntents: ["how termite mounds work", "termite mound ventilation", "termite behavior", "fungus farming termites", "how big is a termite colony", "termite ecosystem role"],
        relatedSlugs: ["how-honey-bees-keep-ecosystems-running", "why-elephants-never-stop-reshaping-landscapes", "why-jumping-spiders-are-so-precise"],
        tableOfContents: [
            "Why termites deserve more respect than they usually get",
            "What makes a termite unique?",
            "How termites survive",
            "Inside a Macrotermes mound",
            "The ecosystem role of termites",
            "How to find and photograph termites",
            "What humans can learn from termites"
        ],
        sections: [
            {
                title: "Why termites deserve more respect than they usually get",
                paragraphs: [
                    "Around 3,000 termite species are known, and only a few dozen damage buildings. The rest are the main recyclers of dead wood and grass in the tropics and the architects of some of the largest animal-built structures on land. Mounds of the African genus Macrotermes typically stand 2 to 3 metres tall, and the tallest recorded reach about 9 metres, built grain by grain by insects 5 millimetres long.",
                    "Termites are not ants. They are social cockroaches, placed within the order Blattodea, and unlike ants they have workers of both sexes, a long-lived king alongside the queen, and soft-bodied nymphs that work from an early age. The colony processes material almost nothing else can eat and regulates its own climate, which makes it an infrastructure system rather than a pest story."
                ],
                inlineLinks: [
                    {text: "termite", slug: "termite"},
                    {text: "leafcutter ant", slug: "leafcutter-ant"}
                ]
            },
            {
                title: "What makes a termite unique?",
                paragraphs: [
                    "Three things set termites apart: caste specialisation, microbe-assisted digestion and climate-controlled architecture. A mature Macrotermes colony holds one to two million individuals. Workers forage, build and feed the others; soldiers with heavy mandibles or glue-squirting snouts guard the tunnels; and the queen, swollen to around 10 centimetres, can lay 20,000 to 30,000 eggs a day for a reign of 15 to 20 years or more.",
                    "Digestion is outsourced. Lower termites carry protists in the hindgut that break down cellulose, and higher termites rely on bacteria. The fungus-growing termites of the subfamily Macrotermitinae went further about 30 million years ago: workers chew plant litter, pass it quickly through the gut and build it into sponge-like combs on which a fungus, Termitomyces, grows. The fungus breaks down lignin the termites cannot, and the colony then eats the aged comb and the fungal nodules. The relationship is obligate on both sides, and each new colony is seeded with spores the founders carry in.",
                    "Leafcutter ants farm fungus the same way in the Americas, which is one of the clearest cases of the same solution evolving twice."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-termites-build-living-infrastructure/termite-workers.webp",
                        alt: "Macrotermes bellicosus soldiers with orange heads and dark mandibles beside pale workers inside the nest",
                        width: 1400,
                        height: 1041,
                        caption: "Macrotermes bellicosus soldiers, with the large orange head capsules, guard pale workers inside the nest. Photo: ETF89, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "How termites survive",
                paragraphs: [
                    "Termite survival is a maintenance problem. A colony of a million termites plus its fungus garden burns oxygen at a rate comparable to a cow, and the fungus only thrives in a narrow band of warmth and humidity. Macrotermes bellicosus nests in the Ivory Coast hold their core within a degree or two of 30 °C and near saturation humidity while the air outside swings by 20 degrees between night and day. The mound is what makes that possible.",
                    "Workers build with soil cemented by saliva and faeces, and they rebuild constantly. Breach a mound wall and workers seal it within hours. They also keep the colony dark and sealed because their soft bodies dry out fast in open air; foraging trips run inside covered tunnels and mud sheeting that they extend across the ground and up tree trunks.",
                    "Defence is layered: soldiers block tunnels with their heads, and in Nasutitermes the soldiers spray a sticky terpene glue from a nozzle on the head at raiding ants. When a colony matures, it releases thousands of winged alates on a single humid evening; a tiny fraction survive to pair, shed their wings and found a new nest."
                ],
                pullQuote: "The colony survives because the internal environment is kept within workable limits, every hour, by a million small repairs."
            },
            {
                title: "Inside a Macrotermes mound",
                paragraphs: [
                    "The mound is not where the termites live. The nest sits at or below ground level with the fungus combs and brood around it, and the mound above acts as a ventilation and heat-management structure. A tall central chimney runs up the core, surrounded by a web of radial conduits that open into thin outer walls full of pores too small for a termite to pass. In 2015 a Harvard team led by Hunter King measured air movement in Macrotermes michaelseni mounds in Namibia and showed that the daily temperature cycle drives it: by day the thin outer flutes warm faster than the core, so air rises in the periphery and sinks through the chimney; at night the flow reverses. Carbon dioxide drains out and oxygen comes in on a 24-hour rhythm, with wind gusts adding extra mixing.",
                    "The table summarises how the main parts work together."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-termites-build-living-infrastructure/termite-mound.webp",
                        alt: "A tall red termite mound rising above savanna grass under a blue sky in Botswana",
                        width: 1400,
                        height: 933,
                        caption: "A termite mound in savanna near Boatle, Botswana. The nest itself lies at the base; the tower above is ventilation. Photo: Oratile Leipego, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                table: {
                    columns: ["Part of the mound", "What it does", "Detail"],
                    rows: [
                        {cells: ["Outer wall and flutes", "Gas exchange and heat capture", "Porous soil; warms by day, cools by night, driving the flow"]},
                        {cells: ["Central chimney", "Main vertical air channel", "Air sinks through it by day and rises at night"]},
                        {cells: ["Radial conduits", "Link chimney to outer surface", "Carry stale air outward and fresh air inward"]},
                        {cells: ["Nest and fungus combs", "Brood, queen and food processing", "Held near 30 °C and high humidity at ground level"]},
                        {cells: ["Foraging tunnels", "Covered routes to food", "Extend tens of metres from the mound, sheeted in mud"]}
                    ]
                },
                inlineLinks: [
                    {text: "honey bee", slug: "honey-bee"}
                ]
            },
            {
                title: "The ecosystem role of termites",
                paragraphs: [
                    "In tropical savannas and forests termites consume a large share of all dead plant material, moving nutrients from litter into soil and into the food chain. Their tunnelling lets rain soak in rather than run off, and the soil they bring up from depth is richer in nitrogen, phosphorus and clay than the surface around it. In the Kenyan savanna, evenly spaced Macrotermes mounds raise plant growth and insect and lizard abundance for metres around each mound, so the whole landscape is patterned by them.",
                    "Termites are also food on a vast scale. An aardvark or aardwolf can eat a quarter of a million termites in a night, pangolins and chimpanzees dig and fish for them, and the seasonal flights of alates feed birds, bats, frogs and people. Remove termites from a savanna and you lose not only its decomposers but much of its soil engineering and a base layer of its food web."
                ],
                speciesSlugs: ["termite"],
                inlineLinks: [
                    {text: "why elephants never stop reshaping landscapes", slug: "why-elephants-never-stop-reshaping-landscapes", href: "/blog/why-elephants-never-stop-reshaping-landscapes"}
                ]
            },
            {
                title: "How to find and photograph termites",
                paragraphs: [
                    "Termites are everywhere in warm climates but rarely in the open. These cues turn a walk into a sighting."
                ],
                cards: [
                    {label: "Read the mud sheeting", body: "Thin mud tubes running up tree trunks, fence posts and rock faces are active foraging galleries. Open a small section and workers will be inside; it will be resealed by morning."},
                    {label: "Mound after rain", body: "Workers extend and repair mound surfaces when the soil is damp. Fresh, darker patches of wet earth on a mound mean construction is under way."},
                    {label: "Flight nights", body: "The first warm, humid evening after the rains break brings alates swarming around lights. It is the easiest time to see winged termites and the predators that gather for them."},
                    {label: "Shoot the soldiers", body: "Soldiers are the most distinctive caste: big orange heads in Macrotermes, pointed snouts in Nasutitermes. A macro shot of one at a tunnel mouth makes a clear in-app capture."}
                ],
                inlineLinks: [
                    {text: "AI animal scanner", slug: "ai-animal-scanner-identification-app", href: "/use-cases/ai-animal-scanner-identification-app"}
                ]
            },
            {
                title: "What humans can learn from termites",
                paragraphs: [
                    "Termites work on the material everyone else ignores. Dead grass and wood are waste only until something can process them, and a fungus partnership turned that waste into fuel for a million-strong city.",
                    "The architectural lesson is the one engineers have borrowed. The Eastgate Centre in Harare, Zimbabwe, was designed in the 1990s with passive ventilation modelled on termite mounds and uses a fraction of the cooling energy of a conventional building its size. When the structure itself regulates the environment, the whole operation becomes cheaper to sustain."
                ],
                inlineLinks: [
                    {text: "how honey bees keep ecosystems running", slug: "how-honey-bees-keep-ecosystems-running", href: "/blog/how-honey-bees-keep-ecosystems-running"}
                ]
            }
        ],
        faq: [
            {
                question: "How do termite mounds stay cool?",
                answer: "Termite mounds ventilate themselves using the daily temperature cycle. Thin outer walls warm faster than the core by day, so air rises in the periphery and sinks through the central chimney; at night the flow reverses. This exchange flushes carbon dioxide and holds the nest near 30 °C and high humidity, even where outside air swings by 20 degrees between day and night."
            },
            {
                question: "How many termites live in a mound?",
                answer: "A mature Macrotermes mound holds one to two million termites, all descended from a single queen and king. The queen grows to around 10 centimetres and can lay 20,000 to 30,000 eggs a day. Smaller species and young colonies number in the thousands. The mound itself is mostly ventilation; the living quarters and fungus gardens sit at its base."
            },
            {
                question: "Do termites farm fungus?",
                answer: "Yes. Fungus-growing termites of the subfamily Macrotermitinae, including Macrotermes, build combs of chewed plant litter and grow the fungus Termitomyces on them. The fungus digests lignin the termites cannot, and the colony eats the mature comb and fungal nodules. The partnership is about 30 million years old and neither partner can live without the other."
            },
            {
                question: "Are termites related to ants?",
                answer: "No. Termites are social cockroaches in the order Blattodea, while ants are wasps' relatives in the order Hymenoptera. Unlike ants, termites have workers of both sexes, a long-lived king that stays with the queen, and no pupal stage. Their similar colony life is a case of convergent evolution, as is fungus farming in termites and leafcutter ants."
            },
            {
                question: "Why are termites good for the environment?",
                answer: "Termites recycle most dead wood and grass in the tropics, returning nutrients to the soil. Their tunnels let rain soak in, and the soil they bring up is richer in nitrogen and phosphorus, so plants grow better around mounds. They also feed aardvarks, pangolins, birds and many other animals. Only a few dozen of roughly 3,000 species damage buildings."
            }
        ],
        sources: [
            {label: "Britannica: Termite", href: "https://www.britannica.com/animal/termite"},
            {label: "King, Ocko & Mahadevan (2015), Termite mounds harness diurnal temperature oscillations for ventilation, PNAS", href: "https://www.pnas.org/doi/10.1073/pnas.1423242112"},
            {label: "Smithsonian BugInfo: Termites", href: "https://www.si.edu/spotlight/buginfo/termites"}
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "chameleon",
        updatedAt: "2026-10-07",
        slug: "how-chameleons-see-and-strike",
        title: "How Chameleons See and Strike: Vision and Tongue Mechanics",
        description: "How chameleon vision and tongue strikes work: independent eyes, tongues that reach two body lengths in hundredths of a second, and why colour changes.",
        featuredImage: {
            src: "https://chameleons101.com/wp-content/uploads/2023/04/Panther_Chameleons101_Eyes-1080x675.jpg",
            alt: "Chameleon featured image for the AnimalDex article on vision, strike behavior, and survival strategy",
            width: 1080,
            height: 675,
            caption: "Featured image source: Chameleons101."
        },
        readingMinutes: 7,
        tags: ["Chameleon behavior", "Animal vision", "Reptile survival"],
        searchIntents: ["how do chameleons see", "chameleon tongue speed", "why do chameleons change color", "chameleon behavior", "how chameleons catch prey", "chameleon eyes independent"],
        relatedSlugs: ["mantis-shrimp-superpower-vision-and-strike", "why-jumping-spiders-are-so-precise", "how-barn-owls-hunt-in-the-dark"],
        tableOfContents: [
            "Why chameleons are more than just color-change curiosities",
            "What makes a chameleon unique?",
            "How chameleons survive",
            "What colour change is really for",
            "The ecosystem role of chameleons",
            "How to spot and photograph chameleons",
            "What humans can learn from chameleons"
        ],
        sections: [
            {
                title: "Why chameleons are more than just color-change curiosities",
                paragraphs: [
                    "There are more than 200 chameleon species, and roughly half live only on Madagascar. They range from Brookesia nana, a leaf chameleon whose males measure about 22 millimetres, to Parson's and Oustalet's chameleons at nearly 70 centimetres. All of them share the same hunting platform: turret eyes that scan independently, feet and tail that lock onto a twig, and a tongue that is launched rather than flicked.",
                    "Colour change is the famous trait, but it is mostly a signalling and temperature tool. The real design story is how a slow, cold-blooded lizard that cannot chase anything still catches fast insects at a distance, branch by branch."
                ],
                inlineLinks: [
                    {text: "chameleon", slug: "chameleon"},
                    {text: "panther chameleon", slug: "panther-chameleon"}
                ]
            },
            {
                title: "What makes a chameleon unique?",
                paragraphs: [
                    "Each chameleon eye sits in a cone of fused eyelid with only a pinhole for the pupil, and each turret swings on its own through about 180 degrees horizontally and 90 degrees vertically. One eye can watch a fly behind while the other checks the branch ahead, giving nearly full coverage around the body. The moment a target is chosen, both eyes swing forward and lock on, and the lizard switches from monocular scanning to binocular aim. Chameleons can also judge distance with one eye by reading how far the lens must focus, which is unusual among vertebrates.",
                    "The tongue is a stored-energy weapon. A ring of accelerator muscle squeezes the tongue skeleton, stretching coiled collagen sheaths like a compressed spring. When they release, the tongue shoots out faster than muscle alone could drive it. Small species are the extreme case: in Rhampholeon spinosus the tongue tip accelerates at about 2,590 metres per second squared, 264 times gravity, and reaches the prey in a few hundredths of a second. Most species project the tongue one and a half to two body lengths; some small ones exceed two and a half. The club-shaped tip hits with suction and mucus roughly 400 times more viscous than human saliva, then the hyoglossus muscle reels the prey back in.",
                    "Everything else is grip. The toes are fused into two opposing bundles, two on one side and three on the other, and the prehensile tail acts as a fifth limb, so the body stays rigid while the tongue does the moving."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-chameleons-see-and-strike/veiled-chameleon.webp",
                        alt: "A veiled chameleon (Chamaeleo calyptratus) with its tall casque and one turret eye swung back toward the camera",
                        width: 1400,
                        height: 933,
                        caption: "A veiled chameleon (Chamaeleo calyptratus), native to Yemen and Saudi Arabia, with one turret eye swung back toward the camera. Photo: Σ64, CC BY 4.0, via Wikimedia Commons."
                    }
                },
                table: {
                    columns: ["Trait", "How it works", "Numbers"],
                    rows: [
                        {cells: ["Independent eyes", "Each turret scans alone, then both converge on a target", "~180° horizontal and 90° vertical per eye"]},
                        {cells: ["Tongue projection", "Elastic collagen recoil, not muscle, launches the tongue", "1.5–2 body lengths; up to 264 g acceleration in small species"]},
                        {cells: ["Tongue tip", "Suction cup plus thick mucus holds the prey", "Mucus about 400× more viscous than human saliva"]},
                        {cells: ["Feet and tail", "Opposed toe bundles and a prehensile tail lock the body in place", "Toes fused 2 + 3; tail acts as a fifth limb"]}
                    ]
                }
            },
            {
                title: "How chameleons survive",
                paragraphs: [
                    "Chameleons are ambush hunters that barely move. A panther chameleon spends the day creeping along branches with a rocking, leaf-in-the-wind gait, pausing for long stretches while its eyes do the searching. When an insect lands within range it turns its head, converges both eyes and fires. Movement is rationed because it costs energy for an ectotherm and because stillness is the best defence against the birds and snakes that eat them.",
                    "Diet is mostly insects: crickets, grasshoppers, flies, mantises and caterpillars. The largest species also take small lizards, nestlings and even small birds. Water comes from licking dew and rain off leaves rather than drinking from pools.",
                    "Life is short. Panther chameleons live two to five years in the wild. Labord's chameleon (Furcifer labordi) of south-west Madagascar hatches, grows, mates and dies in four to five months, spending more of its life inside the egg than out, which is the shortest adult lifespan known for any four-legged vertebrate."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-chameleons-see-and-strike/panther-chameleon.webp",
                        alt: "A green and striped male panther chameleon (Furcifer pardalis) stretched along a branch in Madagascar",
                        width: 1400,
                        height: 672,
                        caption: "A male panther chameleon (Furcifer pardalis) at Montagne d'Ambre, Madagascar. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                pullQuote: "Better surveillance creates more value than busier execution. The chameleon holds still and lets its eyes do the work."
            },
            {
                title: "What colour change is really for",
                paragraphs: [
                    "Chameleons do not change colour mainly to match backgrounds. Their resting greens and browns already blend with foliage. Rapid change is used to signal: a male panther chameleon brightens to reds and yellows to challenge a rival or court a female, a losing male turns dull and dark, and a gravid female shows a specific rejection pattern. Darkening also lets a cold lizard absorb more morning sun, and paling reflects heat at midday.",
                    "The mechanism was worked out in panther chameleons in 2015. Beneath the pigment cells lies a layer of iridophores containing a lattice of guanine nanocrystals. Relaxed, the crystals sit close together and reflect blue and green; excited, the lizard stretches the lattice so it reflects yellow, orange and red. A deeper layer of larger crystals reflects near-infrared and helps with heat. Pigment-bearing melanophores and xanthophores then tune the final colour."
                ],
                speciesSlugs: ["chameleon", "panther-chameleon"]
            },
            {
                title: "The ecosystem role of chameleons",
                paragraphs: [
                    "Chameleons regulate insect numbers in shrubs, trees and forest edges, taking large numbers of grasshoppers and other herbivorous insects. They are in turn prey for snakes such as the boomslang, for shrikes, hornbills and other birds, and for small mammals. Their eggs, buried in soil, feed many more.",
                    "Because most species are tied to particular forest types on Madagascar and in East Africa, chameleons are sensitive indicators of habitat loss, and a large share of Madagascan species are assessed as threatened by the IUCN. Finding one on a night walk says something about the state of the surrounding forest."
                ]
            },
            {
                title: "How to spot and photograph chameleons",
                paragraphs: [
                    "Chameleons are hard to see by day and easy at night. The cues below are what guides in Madagascar and Kenya use."
                ],
                cards: [
                    {label: "Walk at night with a torch", body: "Sleeping chameleons pale to a whitish green and glow in a headlamp beam against dark leaves, usually at the tips of thin branches 1 to 3 metres up."},
                    {label: "Check the outermost twigs", body: "They sleep on branches too thin for predators to climb. Scan the edges of bushes beside paths and streams rather than the centre."},
                    {label: "Look for the silhouette", body: "By day, look for a leaf that rocks against the breeze. The casque, curled tail and separate eye turrets break the leaf outline."},
                    {label: "Keep your distance", body: "A chameleon that turns its body away and flattens is stressed. Shoot from the side so both the eye and the curled tail are in frame, then move on; a live in-app capture needs only a few seconds."}
                ],
                inlineLinks: [
                    {text: "herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}
                ]
            },
            {
                title: "What humans can learn from chameleons",
                paragraphs: [
                    "Chameleons are the case for patient sensing. Constant activity is unnecessary if observation quality is high enough to make the one important move count, and a stored spring beats a fast muscle when timing matters more than endurance.",
                    "Mantis shrimp and jumping spiders solve the same see-then-strike problem with very different hardware, and the comparison shows how many routes lead to the same outcome."
                ],
                inlineLinks: [
                    {text: "mantis shrimp vision and strike", slug: "mantis-shrimp-superpower-vision-and-strike", href: "/blog/mantis-shrimp-superpower-vision-and-strike"},
                    {text: "why jumping spiders are so precise", slug: "why-jumping-spiders-are-so-precise", href: "/blog/why-jumping-spiders-are-so-precise"}
                ]
            }
        ],
        faq: [
            {
                question: "How do chameleon eyes work?",
                answer: "Each chameleon eye moves independently in a turret of fused eyelid, covering about 180 degrees horizontally and 90 degrees vertically, so the lizard can watch two directions at once. When it picks a target, both eyes swing forward for binocular aim. Chameleons can also judge distance with a single eye by reading how far the lens has to focus."
            },
            {
                question: "How fast is a chameleon's tongue?",
                answer: "A chameleon's tongue reaches its prey in a few hundredths of a second. The tongue is launched by elastic recoil of collagen sheaths loaded by a ring of accelerator muscle, so it goes faster than muscle alone could manage. In small species such as Rhampholeon spinosus the tip accelerates at 264 times gravity. Most species reach 1.5 to 2 body lengths."
            },
            {
                question: "Why do chameleons change colour?",
                answer: "Chameleons change colour mainly to communicate and to control body temperature, not to match their background. Males brighten to challenge rivals or court females and darken when they lose; darker skin also absorbs more sun on cool mornings. The change comes from a lattice of guanine nanocrystals in skin cells called iridophores that the lizard stretches or relaxes to shift the reflected colour."
            },
            {
                question: "What do chameleons eat?",
                answer: "Chameleons eat mostly insects, including crickets, grasshoppers, flies, mantises and caterpillars, caught with their projectile tongue. Large species such as Parson's and Oustalet's chameleons also take small lizards, nestlings and occasionally small birds. They drink by licking dew and rain from leaves rather than from standing water."
            },
            {
                question: "Where do chameleons live in the wild?",
                answer: "About half of all chameleon species live only on Madagascar, and most of the rest are in mainland Africa, with a few species in the Middle East, southern Europe, India and Sri Lanka. They live in forests, scrub and gardens from sea level to mountain slopes. Veiled chameleons come from Yemen and Saudi Arabia, panther chameleons from northern Madagascar."
            }
        ],
        sources: [
            {label: "Britannica: Chameleon", href: "https://www.britannica.com/animal/chameleon"},
            {label: "Anderson (2016), Off like a shot: scaling of ballistic tongue projection in chameleons, Scientific Reports", href: "https://www.nature.com/articles/srep18625"},
            {label: "Teyssier et al. (2015), Photonic crystals cause active colour change in chameleons, Nature Communications", href: "https://www.nature.com/articles/ncomms7368"}
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "firefly",
        updatedAt: "2026-10-07",
        slug: "why-fireflies-use-light-so-well",
        title: "Why Fireflies Use Light So Well: Flash Codes Explained",
        description: "How fireflies make light with luciferin and luciferase, why each species flashes its own code, and how Photuris females fake replies to eat rivals.",
        featuredImage: {
            src: "https://plunketts.net/uploads/blog/279a65cf-c701-422b-93f5-a428a926b59a/firefly-glow.jpg",
            alt: "Firefly featured image for the AnimalDex article on signaling, behavior, and survival strategy",
            width: 1200,
            height: 675,
            caption: "Featured image source: Plunkett's Pest Control."
        },
        readingMinutes: 7,
        tags: ["Firefly behavior", "Animal signaling", "Insect ecology"],
        searchIntents: ["how do fireflies glow", "why do fireflies light up", "firefly flash patterns", "firefly bioluminescence chemistry", "firefly behavior", "where to see fireflies"],
        relatedSlugs: ["how-honey-bees-keep-ecosystems-running", "why-jumping-spiders-are-so-precise", "how-barn-owls-hunt-in-the-dark"],
        tableOfContents: [
            "Why fireflies are a better systems story than a nostalgia story",
            "What makes a firefly unique?",
            "Firefly flash patterns compared",
            "How fireflies survive",
            "The ecosystem role of fireflies",
            "How to find and photograph fireflies",
            "What humans can learn from fireflies"
        ],
        sections: [
            {
                title: "Why fireflies are a better systems story than a nostalgia story",
                paragraphs: [
                    "Fireflies are beetles, not flies: around 2,000 species in the family Lampyridae, found on every continent except Antarctica. Most are 5 to 25 millimetres long with soft wing covers, and the adults of many species live only two to four weeks, long enough to find a mate. What they are famous for is a communication system that works in the dark at almost no energy cost and tells each species apart from the rest.",
                    "The light is not scenery. It is a species-specific code, timed to the second and shaped in flight, that males broadcast and females answer. Understanding the code explains the summer display and the predators that have learned to hack it."
                ],
                inlineLinks: [
                    {text: "firefly", slug: "firefly"}
                ]
            },
            {
                title: "What makes a firefly unique?",
                paragraphs: [
                    "The light is made in a lantern on the underside of the last abdominal segments. Inside, cells called photocytes hold the molecule luciferin and the enzyme luciferase. When oxygen, ATP and magnesium reach the luciferin, luciferase drives a reaction that releases a photon of yellow-green light at around 560 nanometres and leaves oxyluciferin and carbon dioxide behind. A layer of uric acid crystals beneath the photocytes reflects the glow outward.",
                    "The reaction is cold light: nearly all the energy leaves as photons rather than heat, which is why a firefly can glow against your skin without warmth, while an incandescent bulb loses about 90 percent of its energy as heat. Classic measurements put the quantum yield near 90 percent, and a 2008 study revised it to about 41 percent, still remarkable for a chemical light source.",
                    "Flash control is the clever part. The firefly cannot switch the enzyme on and off quickly enough, so it gates the oxygen instead. Nerve signals release nitric oxide, which briefly stops the cell's mitochondria from consuming oxygen, letting oxygen flood the photocytes and trigger the flash. When the nitric oxide clears, the mitochondria soak up the oxygen again and the light goes out. The same chemistry now runs in laboratories worldwide: the luciferase gene is a standard reporter for tracking gene activity in living cells."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/why-fireflies-use-light-so-well/photinus-pyralis.webp",
                        alt: "A common eastern firefly (Photinus pyralis) on a leaf, showing the pale lantern segments at the tip of the abdomen",
                        width: 1400,
                        height: 933,
                        caption: "An eastern firefly (Photinus pyralis) in Virginia. The pale segments at the abdomen tip are the lantern. Photo: Celari817, CC BY 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Firefly flash patterns compared",
                paragraphs: [
                    "Each species flashes a distinct pattern of duration, interval, colour and flight path, and the female of the same species answers after a species-specific delay. Temperature matters: the same male flashes faster on a warm night than a cool one, and the female's reply delay shortens to match. The table lists some well-studied codes."
                ],
                table: {
                    columns: ["Species", "Male signal", "Where and when"],
                    rows: [
                        {cells: ["Photinus pyralis (Big Dipper firefly)", "Single J-shaped flash of about half a second, repeated every ~6 s while flying upward; female answers ~2 s later from the grass", "Eastern North America, dusk in early summer"]},
                        {cells: ["Photinus carolinus (synchronous firefly)", "Bursts of 5–8 flashes, then 6–8 s of darkness, synchronised across thousands of males", "Great Smoky Mountains, late May to June"]},
                        {cells: ["Photuris species", "Fast, erratic flickers and multiple flashes; females also mimic Photinus female replies", "North America, later in the night and higher up"]},
                        {cells: ["Pteroptyx malaccae", "Males gather in mangrove trees and flash in near-perfect unison, about once per second, all night", "Southeast Asian estuaries"]},
                        {cells: ["Lampyris noctiluca (common glow-worm)", "Flightless female glows continuously; male flies in to find her", "Europe, June to July"]}
                    ]
                },
                speciesSlugs: ["firefly"]
            },
            {
                title: "How fireflies survive",
                paragraphs: [
                    "Most of a firefly's life is spent as a larva. Larvae live one to two years in damp soil and leaf litter and are predators of snails, slugs and earthworms, which they paralyse with digestive enzymes injected through their jaws. Larvae of all species glow, and so do the eggs of some; the glow warns ground predators that the animal is distasteful. Adults of many species do not feed at all, living on reserves while they signal.",
                    "The chemical defence is a group of steroids called lucibufagins, which make Photinus fireflies toxic to birds, lizards and spiders. Photuris fireflies cannot make lucibufagins, and their females get them by predation: a Photuris female watches a male Photinus flash, imitates the reply of a Photinus female, and eats the male when he lands. Entomologist James Lloyd documented these femme fatale fireflies in 1965, and Thomas Eisner later showed the stolen steroids make the Photuris female and her eggs unpalatable in turn."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/why-fireflies-use-light-so-well/photuris-firefly.webp",
                        alt: "A Photuris firefly seen from the side on a rusty surface, with the red-marked pronotum and long antennae",
                        width: 1400,
                        height: 806,
                        caption: "A Photuris firefly. Females of this genus mimic Photinus replies to lure and eat Photinus males. Photo: xpda, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                pullQuote: "A strong signal does not have to be loud or expensive. It has to be legible, efficient and correctly timed, and even then someone will try to forge it."
            },
            {
                title: "The ecosystem role of fireflies",
                paragraphs: [
                    "Firefly larvae are among the main predators of snails and slugs in damp meadows, woodland floors and marsh edges, and the adults feed a few predators that can tolerate their chemistry, including some spiders and frogs. Because the larvae need moist soil for one to two years and the adults need dark nights to signal, fireflies disappear early when a landscape is drained, paved or lit.",
                    "That sensitivity makes them an indicator. The first IUCN assessment of North American fireflies, published in 2021, found about 14 percent of the 132 species evaluated are threatened with extinction, with habitat loss, light pollution and pesticides as the main causes. Artificial light at night is a direct attack on the signal: females cannot see male flashes against a bright background, and lit areas go quiet."
                ],
                inlineLinks: [
                    {text: "how honey bees keep ecosystems running", slug: "how-honey-bees-keep-ecosystems-running", href: "/blog/how-honey-bees-keep-ecosystems-running"}
                ]
            },
            {
                title: "How to find and photograph fireflies",
                paragraphs: [
                    "Fireflies are easy to see and hard to photograph. These cues cover both."
                ],
                cards: [
                    {label: "Go at dusk in early summer", body: "Photinus pyralis starts flashing about 20 minutes after sunset in June and July. Warm, humid, windless evenings after rain are best."},
                    {label: "Find damp edges", body: "Look where long grass meets woodland or water: meadow margins, stream banks, marsh edges. Mown lawns and lit streets hold few."},
                    {label: "Read the flash", body: "A rising J-shaped flash every six seconds is Photinus pyralis; fast flickers higher in the trees later at night are usually Photuris. Count the interval to separate species."},
                    {label: "Let your eyes adapt", body: "Turn off every light, including your phone screen, and wait 10 minutes. For a photo, a tripod and a 15 to 30 second exposure records the flash tracks; a live in-app capture works best on a resting firefly on a leaf before full dark."}
                ],
                inlineLinks: [
                    {text: "wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}
                ]
            },
            {
                title: "What humans can learn from fireflies",
                paragraphs: [
                    "Fireflies show that a good signal is defined by its receiver. The flash is cheap, it is unmistakable to the one audience that matters, and it is timed so the reply can be checked against a known delay.",
                    "They also show the cost of a legible code: anything that can be read can be forged. Photuris built a career on that. Any system that depends on a clear signal needs a way to verify who is sending it."
                ],
                inlineLinks: [
                    {text: "why jumping spiders are so precise", slug: "why-jumping-spiders-are-so-precise", href: "/blog/why-jumping-spiders-are-so-precise"}
                ]
            }
        ],
        faq: [
            {
                question: "How do fireflies make light?",
                answer: "Fireflies make light in a lantern at the tip of the abdomen, where the enzyme luciferase combines the molecule luciferin with oxygen, ATP and magnesium. The reaction releases a photon of yellow-green light and leaves oxyluciferin and carbon dioxide. Almost no energy is lost as heat, which is why the glow is called cold light. The insect times each flash by controlling the oxygen supply with nitric oxide."
            },
            {
                question: "Why do fireflies flash in different patterns?",
                answer: "Each firefly species has its own flash code so males and females can find the right partner in the dark among other species. The code combines flash length, interval, colour and flight path, and the female answers after a species-specific delay. Photinus pyralis males give a single J-shaped flash every six seconds; Photinus carolinus males flash in synchronised bursts of five to eight."
            },
            {
                question: "Are fireflies dangerous or poisonous?",
                answer: "Fireflies are harmless to handle but poisonous to eat. Photinus fireflies contain steroids called lucibufagins that make them toxic to birds, lizards and spiders, and pet lizards have died after eating them. Larvae advertise the same defence by glowing. Predatory Photuris females steal these chemicals by eating Photinus males."
            },
            {
                question: "Where is the best place to see fireflies?",
                answer: "Damp meadow edges, stream banks and woodland margins on warm, humid June and July evenings are the best places across eastern North America, Europe and East Asia. Famous displays include the synchronous Photinus carolinus in Great Smoky Mountains National Park in late May and June, and the flashing mangrove trees of Pteroptyx fireflies in Malaysia and Thailand."
            },
            {
                question: "Why are fireflies disappearing?",
                answer: "Fireflies are declining because of habitat loss, light pollution and pesticides. Larvae need one to two years in moist soil, so drainage, paving and mowing remove them, while artificial light at night drowns out the flashes females use to find males. A 2021 IUCN assessment found about 14 percent of North American firefly species threatened with extinction."
            }
        ],
        sources: [
            {label: "Britannica: Firefly", href: "https://www.britannica.com/animal/firefly"},
            {label: "Smithsonian BugInfo: Fireflies", href: "https://www.si.edu/spotlight/buginfo/fireflies"},
            {label: "Xerces Society: Fireflies", href: "https://xerces.org/endangered-species/fireflies"}
        ]
    }),
    createAnimalSystemsPost({
        speciesSlug: "whale-shark",
        updatedAt: "2026-10-07",
        slug: "how-whale-sharks-feed-at-ocean-scale",
        title: "How Whale Sharks Feed at Ocean Scale",
        description: "How whale sharks feed: 12-metre filter feeders that sieve plankton through 20 gill pads, carry unique spot patterns and gather at Ningaloo and Mexico.",
        featuredImage: {
            src: "https://cdn.britannica.com/33/151933-050-E7E77CA0/Whale-shark-swimming-trevallies-front-predators-filter-feeding.jpg",
            alt: "Whale shark featured image for the AnimalDex article on ocean-scale filter feeding",
            width: 1600,
            height: 900,
            caption: "Featured image source: Britannica."
        },
        readingMinutes: 8,
        tags: ["Whale shark", "Marine biology", "Ecosystem role"],
        searchIntents: ["how do whale sharks feed", "how big is a whale shark", "whale shark behavior", "whale shark spots identification", "where to see whale sharks", "whale shark ecosystem role"],
        relatedSlugs: ["why-jellyfish-thrive-in-changing-oceans", "how-dolphin-intelligence-works-in-the-wild", "how-crocodiles-dominate-the-water-edge"],
        tableOfContents: [
            "Why the whale shark feels like a contradiction",
            "What makes a whale shark unique?",
            "How whale sharks survive",
            "Where whale sharks gather",
            "The ecosystem role of a whale shark",
            "How to see and photograph whale sharks",
            "What humans can learn from whale sharks"
        ],
        sections: [
            {
                title: "Why the whale shark feels like a contradiction",
                paragraphs: [
                    "The whale shark (Rhincodon typus) is the largest fish alive. Adults commonly reach 8 to 12 metres and around 15 to 20 tonnes, and the largest reliably measured individual, a female in the Indian Ocean, was 18.8 metres long. Yet an animal that size eats some of the smallest prey in the sea: plankton, krill, fish eggs and larvae, and small schooling fish such as anchovies and sardines.",
                    "That contrast is the point. The whale shark proves that scale can come from processing water efficiently rather than from winning fights. It cruises at about 5 kilometres per hour, has 3,000 teeth it never uses to feed, and grows for decades on a diet it strains from the sea."
                ],
                inlineLinks: [
                    {text: "whale shark", slug: "whale-shark"},
                    {text: "basking shark", slug: "basking-shark"}
                ]
            },
            {
                title: "What makes a whale shark unique?",
                paragraphs: [
                    "The mouth is at the front of the head rather than underneath, up to 1.5 metres wide, and lined with about 300 rows of tiny teeth that are an evolutionary leftover. Behind it sit 20 filter pads, sieve-like plates derived from the gill arches, with a mesh of about 1 millimetre. Water enters the mouth, passes across the pads and out through five huge gill slits, while particles are concentrated and swallowed. The filtering works by cross-flow: water sweeps along the pads rather than straight through, so the mesh clogs far less than a simple strainer would.",
                    "Whale sharks feed in three ways. Ram filter feeding is swimming forward with the mouth open. Active surface feeding is faster swimming with the head partly out of the water through a dense slick. Suction feeding is hanging vertically in the water and gulping, pumping prey-rich water across the pads while stationary. A single shark can process thousands of litres of water an hour.",
                    "The skin is up to about 10 centimetres thick, and every individual carries a unique pattern of white spots and stripes. Researchers photograph the patch behind the left gill slits and match it with software adapted from an astronomy algorithm written to match star fields. Public photo libraries built on that method now hold tens of thousands of encounters with thousands of named individuals, and many of the photos come from snorkellers."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-whale-sharks-feed-at-ocean-scale/whale-shark-filter-feeding.webp",
                        alt: "A whale shark (Rhincodon typus) near the surface with its wide mouth open, filter feeding beside small fish",
                        width: 1400,
                        height: 1050,
                        caption: "A whale shark ram filter feeding at the surface near La Paz, Mexico. Photo: Matthew T Rader, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                table: {
                    columns: ["Feature", "Detail"],
                    rows: [
                        {cells: ["Length", "Commonly 8–12 m; largest reliably measured 18.8 m"]},
                        {cells: ["Weight", "About 15–20 tonnes in large adults"]},
                        {cells: ["Mouth", "Up to 1.5 m wide, terminal, with ~300 rows of vestigial teeth"]},
                        {cells: ["Filter", "20 filter pads with ~1 mm mesh; cross-flow filtration"]},
                        {cells: ["Cruising speed", "About 5 km/h"]},
                        {cells: ["Deepest recorded dive", "Nearly 2,000 m"]},
                        {cells: ["Reproduction", "Live-bearing; one female carried about 300 embryos"]},
                        {cells: ["Lifespan", "Estimated 80–130 years; slow to mature"]},
                        {cells: ["IUCN status", "Endangered (2016); CITES Appendix II since 2003"]}
                    ]
                }
            },
            {
                title: "How whale sharks survive",
                paragraphs: [
                    "Whale shark survival depends on being in the right water at the right time. Plankton is thin across most of the ocean, so the sharks track seasonal pulses: coral spawning at Ningaloo Reef in March and April, the spawning of little tunny off Isla Mujeres in summer, and upwellings and krill blooms elsewhere. They range across whole ocean basins between these events, and satellite tags show dives to nearly 2,000 metres, probably to feed in deep plankton layers and to navigate.",
                    "Growth is slow and reproduction is rare. A female caught off Taiwan in 1995 carried about 300 embryos at different stages, which showed that whale sharks give birth to live young from eggs retained inside the body. Pups are 40 to 60 centimetres at birth and are almost never seen. The sharks may not mature until their late twenties or thirties and are thought to live 80 to 130 years.",
                    "That life history is the weakness. The IUCN listed the whale shark as Endangered in 2016 after population declines of more than 50 percent over three generations, driven by targeted fishing in parts of Asia, accidental capture in tuna nets, ship strikes along busy lanes and disturbance at tourism sites."
                ],
                pullQuote: "The whale shark does not need every part of the ocean to be good. It needs to find the parts where the flow becomes worth processing."
            },
            {
                title: "Where whale sharks gather",
                paragraphs: [
                    "Around 20 coastal sites host predictable seasonal aggregations, almost all dominated by immature males 4 to 8 metres long; where the adult females go is still largely unknown. The best-studied sites are below."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-whale-sharks-feed-at-ocean-scale/whale-shark-spots.webp",
                        alt: "A whale shark seen from the side in blue water, showing the white spot pattern used to identify individuals",
                        width: 1400,
                        height: 933,
                        caption: "Each whale shark's spot pattern is unique; the area behind the left gills is the standard identification patch. Photo: Sylke Rohrlach from Sydney, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                },
                cards: [
                    {label: "Ningaloo Reef, Western Australia", body: "March to July, after the mass coral spawning. Spotter planes guide boats, and the long-running photo-ID programme here was one of the first."},
                    {label: "Isla Mujeres and Holbox, Mexico", body: "May to September, feeding on fish eggs. A 2009 aerial survey counted 420 sharks in one patch, the largest aggregation ever recorded."},
                    {label: "Donsol, Philippines", body: "November to June in plankton-rich coastal water. Community-run tourism replaced hunting here in the late 1990s."},
                    {label: "Mafia Island, Tanzania and Gulf of Tadjoura, Djibouti", body: "October to February. Small juveniles feed close to shore, often within a few hundred metres of the beach."}
                ],
                speciesSlugs: ["whale-shark", "manta-ray"]
            },
            {
                title: "The ecosystem role of a whale shark",
                paragraphs: [
                    "Whale sharks move energy from the base of the food web to the top in one step, turning plankton and fish eggs into tonnes of long-lived biomass, and they carry nutrients between distant seas as they migrate. Where they gather, they mark water that is unusually productive, which is why their arrival is a reliable sign of a spawning event or bloom.",
                    "They also host travellers: remoras, pilot fish and schools of juvenile trevally shelter around them. Economically, their aggregations support tourism worth millions of dollars a year at sites such as Ningaloo and Isla Mujeres, which has given coastal communities a reason to protect rather than hunt them."
                ],
                inlineLinks: [
                    {text: "manta ray", slug: "manta-ray"},
                    {text: "why jellyfish thrive in changing oceans", slug: "why-jellyfish-thrive-in-changing-oceans", href: "/blog/why-jellyfish-thrive-in-changing-oceans"}
                ]
            },
            {
                title: "How to see and photograph whale sharks",
                paragraphs: [
                    "Swimming with a whale shark is a snorkel, not a dive, and the sharks set the pace. The tips below keep the encounter safe for both sides and produce a photo scientists can use."
                ],
                cards: [
                    {label: "Pick the season, not the site", body: "Each aggregation has a window of a few months. Book for the middle of the season and allow two or three days, since sightings depend on plankton and weather."},
                    {label: "Keep 3 metres from the body and 4 from the tail", body: "Most sites use these rules. Never touch, chase or block the shark; a shark that dives or changes course is telling you to back off."},
                    {label: "Shoot the left side behind the gills", body: "A clear photo of the spot patch behind the left gill slits, taken side-on, can be matched to a known individual. Submit it to a photo-ID library after your trip."},
                    {label: "Avoid provisioned sharks", body: "Sites that hand-feed sharks change their behaviour and migration. Choose operators that follow natural aggregations. A live in-app capture from the boat or the water counts the same either way; a gallery upload does not."}
                ],
                inlineLinks: [
                    {text: "wildlife photography companion", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}
                ]
            },
            {
                title: "What humans can learn from whale sharks",
                paragraphs: [
                    "Whale sharks are a lesson in scale through process efficiency. They do not chase targets one at a time; they get very good at handling the concentrated flow when it arrives, and they travel between the places where that happens.",
                    "That is the strategic insight: throughput can be a better growth engine than force. The cost is fragility, because an animal that takes 30 years to mature cannot recover quickly from losses. Dolphins show the opposite strategy in the same water."
                ],
                inlineLinks: [
                    {text: "how dolphin intelligence works in the wild", slug: "how-dolphin-intelligence-works-in-the-wild", href: "/blog/how-dolphin-intelligence-works-in-the-wild"}
                ]
            }
        ],
        faq: [
            {
                question: "How big is a whale shark?",
                answer: "Whale sharks commonly reach 8 to 12 metres and 15 to 20 tonnes, and the largest reliably measured individual was 18.8 metres long. They are the largest fish on Earth, although far smaller than blue whales, which are mammals. Pups are only 40 to 60 centimetres at birth, and the sharks grow slowly for decades."
            },
            {
                question: "What do whale sharks eat?",
                answer: "Whale sharks eat plankton, krill, fish eggs and larvae, crab larvae and small schooling fish such as anchovies and sardines. They strain these from the water through 20 filter pads behind the mouth, either by swimming forward with the mouth open or by hanging vertically and gulping. Their 3,000 tiny teeth play no part in feeding."
            },
            {
                question: "Are whale sharks dangerous to humans?",
                answer: "No. Whale sharks are filter feeders with no interest in large prey and are placid around swimmers. The only real hazard is the tail, which can knock a snorkeller who gets too close, so most sites require a gap of 3 metres from the body and 4 from the tail. The danger runs the other way, from boat propellers and harassment."
            },
            {
                question: "Where can you swim with whale sharks?",
                answer: "The most reliable sites are Ningaloo Reef in Western Australia from March to July, Isla Mujeres and Holbox in Mexico from May to September, Donsol in the Philippines from November to June, and Mafia Island in Tanzania and Djibouti from October to February. All are snorkelling encounters with natural aggregations of mostly juvenile males."
            },
            {
                question: "How do scientists identify individual whale sharks?",
                answer: "Each whale shark has a unique pattern of white spots, and researchers photograph the patch behind the left gill slits and match it with pattern-recognition software originally developed for star fields. Photos from tourists feed large public identification libraries, which have tracked individual sharks for years and revealed movements between distant aggregation sites."
            }
        ],
        sources: [
            {label: "NOAA Fisheries: Whale Shark", href: "https://www.fisheries.noaa.gov/species/whale-shark"},
            {label: "IUCN Red List: Rhincodon typus", href: "https://www.iucnredlist.org/species/19488/2365291"},
            {label: "Britannica: Whale shark", href: "https://www.britannica.com/animal/whale-shark"}
        ]
    })
];
