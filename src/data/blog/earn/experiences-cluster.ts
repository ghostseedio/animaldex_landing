import {blogHrefs, earnPaths, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import {contentThumb} from "@/data/content-thumbnails";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";
const updatedAt = "2026-10-07";

const guidePaymentsLink = {
    text: "How Guide bookings and payments work",
    slug: "how-do-wildlife-guide-bookings-and-payments-work",
    href: supportArticleHrefs.guidePayments
};
const herpingJournalLink = {text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"};
const photoCompanionLink = {
    text: "Wildlife photography companion app",
    slug: "wildlife-photography-companion-app",
    href: "/use-cases/wildlife-photography-companion-app"
};
const ethicalGuideLink = {text: "What makes a great ethical Wildlife Guide", slug: "what-makes-a-great-ethical-wildlife-guide", href: blogHrefs.ethicalGuide};

export const experienceDiscoveryBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-to-find-ethical-herping-tours-and-local-reptile-guides",
        canonicalUrl: `https://animaldex.app${blogHrefs.ethicalHerpingTours}`,
        title: "How to Find Ethical Herping Tours and Local Reptile Guides",
        description:
            "How to find an ethical herping tour: what a good reptile guide listing shows, red flags like guaranteed snakes or handling, and what to bring.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-to-find-ethical-herping-tours-and-local-reptile-guides"),
        readingMinutes: 8,
        tags: ["wildlife-experiences", "herping"],
        searchIntents: ["herping tour", "herping trip", "reptile tour", "snake tour", "local reptile guide", "ethical herping"],
        speciesSlugs: ["corn-snake", "red-eyed-tree-frog", "fire-salamander"],
        relatedSlugs: ["what-to-expect-on-a-guided-herping-trip", "what-happens-on-a-night-wildlife-walk", "how-to-choose-a-local-wildlife-guide"],
        tableOfContents: [
            "A good herping trip is still a walk",
            "What a trustworthy listing shows",
            "Questions to ask before you request",
            "Why sightings change with season and rain",
            "What to bring and what to leave behind",
            "How booking works on AnimalDex",
            "Log what you find, not what you were promised"
        ],
        sections: [
            {
                title: "A good herping trip is still a walk",
                paragraphs: [
                    "Herping is the hobby of looking for reptiles and amphibians in the field. Done well it is slow: a public path after rain, a stone wall at dusk, a pond edge with a torch held low. The animal decides whether it appears. If a listing promises a snake, a catch, or a posed photo, keep walking, because the only way to guarantee those things is to keep animals in a bag or bait them to a spot.",
                    "The ethics are simple and worth stating plainly. No handling, so the animal is not stressed and so nobody gets bitten. No baiting or playback. No pulling animals out of cover or flipping every rock on a hillside. Lights are used to see, not to pin an animal in place. And sightings are never guaranteed, because a garter snake on a trail is weather, luck, and knowledge, not a product.",
                    "On AnimalDex, herping is one of seven Wildlife Guide categories, defined in the app as evening and night walks for frogs, snakes and other reptiles without handling. Guides are approved local sellers who passed wild-collection gates and a human review. A listing shows a general public area, a duration, a guest cap and a per-person cash price. It does not sell a specific animal."
                ],
                inlineLinks: [earnRelatedLinks.experiences, ethicalGuideLink],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-find-ethical-herping-tours-and-local-reptile-guides/garter-snake-trail.webp",
                        alt: "Common garter snake in the open, photographed from a distance without being handled",
                        width: 1400,
                        height: 788,
                        caption: "A garter snake basking beside a path, photographed without being touched. That is the whole product. Photo: Casey Helton, CC BY 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What a trustworthy listing shows",
                paragraphs: [
                    "You can learn most of what you need from the copy before you message anyone. Read it the way you would read a job advert: what is stated, what is vague, and what is quietly promised.",
                    "The table below is the checklist we use when we look at herping listings, on AnimalDex or anywhere else."
                ],
                table: {
                    columns: ["Look for", "Red flag"],
                    rows: [
                        {cells: ["A named public area in general terms (a reserve, a river path, a coastal road)", "A secret spot, private land with no owner mentioned, or no area at all"]},
                        {cells: ["A duration and a start time tied to dusk, dawn, or rain", "A fixed daytime slot sold year-round regardless of weather"]},
                        {cells: ["A small guest cap, typically a handful of people", "Open numbers, minibus groups, or a price that drops as the group grows"]},
                        {cells: ["Copy that says sightings are not guaranteed", "Species named as if they were on a menu, or photos of people holding snakes"]},
                        {cells: ["A clear no-handling, no-baiting rule", "Handling offered as the highlight, or hooks and bags in the photos"]},
                        {cells: ["Mention of road safety, protected species, and local rules", "Silence on all three"]},
                        {cells: ["A cash-on-the-day price paid to the Guide", "Upfront transfers to a third party with no refund terms"]}
                    ]
                }
            },
            {
                title: "Questions to ask before you request",
                paragraphs: [
                    "A Guide who answers these plainly is easier to trust than one who talks only about rare animals. Ask in the app thread, so the answers are on record."
                ],
                cards: [
                    {label: "Where, roughly, do we meet and walk?", body: "You want a general public area and the distance you will cover. A Guide who refuses to name even the reserve is protecting a spot from you, not from poachers."},
                    {label: "What happens if it rains, or does not?", body: "For amphibians, rain is good news. For many lizards and snakes, a cold wet night means a short walk. A good answer explains the trade-off and names a fallback."},
                    {label: "What is off-limits?", body: "Expect to hear: no handling, no flipping cover without replacing it, no lights in eyes for long, no approaching protected species, no entering private land."},
                    {label: "How do you handle roads?", body: "Warm, wet nights put amphibians and snakes on tarmac. A responsible Guide walks the verge, wears a reflective layer, and never stops in a live lane for a photo."},
                    {label: "Do I need my own transport?", body: "Many good sites are a drive from town. Ask whether the meeting point is reachable by foot or public transport, and whether you will drive between stops."},
                    {label: "What do you do about disease hygiene?", body: "Amphibian chytrid fungus spreads on wet boots and nets. A Guide who asks you to arrive with clean footwear, or carries disinfectant, knows the subject."}
                ]
            },
            {
                title: "Why sightings change with season and rain",
                paragraphs: [
                    "Reptiles and amphibians are ectotherms: their activity tracks the temperature and moisture around them. That is why an honest Guide talks about conditions before species. In temperate regions, spring is the busiest window, when frogs and newts move to breeding ponds on mild wet nights and snakes emerge to bask. Hot midsummer afternoons push many species into cover; the same path can be empty at 2 pm and busy at 9 pm.",
                    "In the tropics the rhythm is wet season and darkness. A red-eyed tree frog, about 5 to 7 cm long, spends the day asleep under a leaf and only climbs out after dark, so a listing that offers tree frogs on a sunny afternoon walk is selling something it cannot deliver. A corn snake in the south-eastern United States, usually 60 to 120 cm long and harmless to people, is most often found on warm evenings crossing a trail or a quiet road.",
                    "Fire salamanders in Europe are the classic rain animals: they stay underground in dry weather and walk out onto forest floors and wet lanes after dark on mild, rainy nights. Their yellow-and-black warning colours advertise toxic skin secretions, which is another reason nobody should pick one up. Realistic expectations look like this: a two-hour spring walk might produce a few frogs, a newt, and if conditions line up, one snake. A dry cold night might produce a gecko on a wall and a lesson in where to look next time."
                ],
                speciesSlugs: ["red-eyed-tree-frog", "corn-snake", "fire-salamander"],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-find-ethical-herping-tours-and-local-reptile-guides/red-eyed-tree-frog-night.webp",
                        alt: "Red-eyed tree frog on a leaf at night, the kind of sighting a herping walk hopes for but cannot promise",
                        width: 1400,
                        height: 937,
                        caption: "A red-eyed tree frog found after dark. It sleeps under leaves by day, so a daytime tour cannot honestly promise one. Photo: Rodrigo Fernández, CC BY-SA 3.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What to bring and what to leave behind",
                paragraphs: [
                    "Pack for standing still in the dark, not for a hike. The list is short."
                ],
                cards: [
                    {label: "Bring", body: "Closed shoes or boots, long trousers, a headlamp with a red mode plus a spare torch, water, insect repellent, a phone with charge for photos and the app, and clean footwear if you are moving between wetlands."},
                    {label: "Leave behind", body: "Snake hooks, bags, nets, and any plan to pick something up. Also leave behind the expectation of a trophy photo. Your phone camera at a respectful distance is enough to identify most animals later."},
                    {label: "On the night", body: "Keep lights low and brief on any animal you find, step where the Guide steps, replace anything that is lifted, and let the Guide decide when to move on. If a road is involved, stay on the verge."}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-find-ethical-herping-tours-and-local-reptile-guides/corn-snake-wild.webp",
                        alt: "Corn snake in leaf litter in the wild",
                        width: 1400,
                        height: 1100,
                        caption: "A wild corn snake in leaf litter. A phone photo from a metre away is all a species log needs. Photo: Peter Paplanus from St. Louis, Missouri, CC BY 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "How booking works on AnimalDex",
                paragraphs: [
                    "You request a date in the app. A request is not an instant booking: the Guide accepts or declines, and you can ask questions in between. You pay the per-person price in cash on the day, directly to the Guide. AnimalDex does not collect that payment and does not operate the walk. Wildlife Guides is a beta programme, so the directory only shows experiences that approved Guides have actually published. If there is no herping listing in your area, there is no hidden one.",
                    "That design is deliberate. A listing with a public area, a guest cap, and cash on the day leaves little room for the bait-and-pose business model, but it still does not make every outing perfect. Read the copy and ask the questions above."
                ],
                inlineLinks: [guidePaymentsLink, earnRelatedLinks.marketplace]
            },
            {
                title: "Log what you find, not what you were promised",
                paragraphs: [
                    "A guided walk is different from keeping your own herping field journal in the app, but the two fit together. On the walk, take a live photo of each animal from a distance and let AnimalDex identify it; captures are live in-app photos, so a gallery upload later is not the same record. Note the time, the weather, and the general habitat, because those are what explain your next sighting. A log of three frogs and a newt on a wet April night is a real record. A guaranteed snake is not."
                ],
                inlineLinks: [
                    herpingJournalLink,
                    {text: "What to expect on a guided herping trip", slug: "what-to-expect-on-a-guided-herping-trip", href: blogHrefs.guidedHerpingTrip}
                ],
                pullQuote: "The only way to guarantee a snake is to keep one in a bag. Nobody should pay for that."
            }
        ],
        faq: [
            {
                question: "What is a herping tour?",
                answer: "A herping tour is a guided walk to look for reptiles and amphibians, usually at dusk or at night along public paths, pond edges, and quiet roads. A good one teaches you where and when to look and does not handle, bait, or guarantee animals. Sightings depend on temperature, rain, and season, so the honest version is described as a walk, not as a list of species."
            },
            {
                question: "Can you touch animals on an ethical herping trip?",
                answer: "No. Handling stresses reptiles and amphibians, spreads skin disease between amphibians, and is illegal for protected species in many places. Ethical Guides keep everyone at a distance, use lights briefly, replace any cover they lift, and let you photograph from where you stand. If handling is advertised as the highlight, the trip is built around disturbance."
            },
            {
                question: "How do I know if a reptile guide is legitimate?",
                answer: "Look for a named public area, a small guest cap, a duration tied to dusk or rain, and copy that says sightings are not guaranteed. Ask how they handle roads, private land, and protected species. On AnimalDex, Guides have passed wild-collection gates and a human review, listings show the facts above, and you pay cash on the day directly to the Guide."
            },
            {
                question: "What should I bring on a herping walk?",
                answer: "Closed shoes, long trousers, a headlamp with a red mode and a spare torch, water, insect repellent, and a charged phone for photos. Arrive with clean boots if you will visit wetlands, because amphibian chytrid fungus travels on mud. Leave hooks, bags, and nets at home; you will not be catching anything."
            },
            {
                question: "What is the best time of year for a herping tour?",
                answer: "In temperate regions, spring and early summer are best: mild wet nights bring frogs and newts to ponds and snakes out to bask. In the tropics, the wet season and the hours after dark are the productive window. Cold, dry, or very hot conditions reduce activity, so a good Guide will tell you when to come back rather than sell a poor night."
            }
        ],
        sources: [
            {label: "Partners in Amphibian and Reptile Conservation (PARC)", href: "https://parcplace.org/"},
            {label: "Britannica: Herpetology", href: "https://www.britannica.com/science/herpetology"},
            {label: "Amphibian Ark: Chytrid fungus and amphibian declines", href: "https://www.amphibianark.org/"},
            {label: "Leave No Trace: The 7 Principles", href: "https://lnt.org/why/7-principles/"}
        ]
    }),
    earnBlogPost({
        slug: "what-to-expect-on-a-guided-herping-trip",
        canonicalUrl: `https://animaldex.app${blogHrefs.guidedHerpingTrip}`,
        title: "What to Expect on a Guided Herping Trip",
        description:
            "What a guided herping trip is actually like: the pace, a typical evening hour by hour, what the Guide should refuse, what to bring, and how to log finds.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("what-to-expect-on-a-guided-herping-trip"),
        readingMinutes: 7,
        tags: ["wildlife-experiences", "herping"],
        searchIntents: ["guided herping trip", "what happens on a herping tour", "night herping walk", "herping for beginners", "herping trip what to bring"],
        speciesSlugs: ["common-frog", "fire-salamander", "mediterranean-house-gecko", "corn-snake"],
        relatedSlugs: ["how-to-find-ethical-herping-tours-and-local-reptile-guides", "what-happens-on-a-night-wildlife-walk", "how-to-choose-a-local-wildlife-guide"],
        tableOfContents: [
            "Pace, not a checklist",
            "A typical evening, hour by hour",
            "What the Guide should refuse",
            "The animals you are most likely to meet",
            "Rain, roads, and why the weather sets the night",
            "What to bring",
            "After the walk: how to log it"
        ],
        sections: [
            {
                title: "Pace, not a checklist",
                paragraphs: [
                    "Most herping time is walking, listening, and checking edges. You stop at a drystone wall, a culvert, the lit side of a building, the margin of a pond. The Guide points a torch low across the ground, you look for eyeshine or a shape that does not match the leaves, and then you move on. You may see a gecko on a wall and nothing else. That is still a successful outing if the Guide taught you where and why to look, because the knowledge transfers to every walk you take afterwards.",
                    "Expect a small group, usually a handful of people, and a Guide who sets the pace rather than the loudest guest. On AnimalDex the listing tells you the general public area, the duration, and the guest cap before you request. Herping is described in the app as evening and night walks for frogs, snakes and other reptiles without handling, and that last phrase is the one to hold the Guide to."
                ],
                inlineLinks: [earnRelatedLinks.experiences],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-to-expect-on-a-guided-herping-trip/common-frog-grass.webp",
                        alt: "Common frog sitting in wet leaf litter",
                        width: 1400,
                        height: 933,
                        caption: "A young common frog in beech leaf litter, the kind of find that rewards slow looking at the edge of a path. Photo: Stephan Sprinz, CC BY 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "A typical evening, hour by hour",
                paragraphs: [
                    "Trips differ by region and season, but a temperate spring evening tends to run like this. Treat the species as possibilities, never promises."
                ],
                table: {
                    columns: ["Time", "What usually happens", "What you might see"],
                    rows: [
                        {cells: ["Meet, last light", "Briefing: route, rules, lights, where the road is, what to do if someone finds something first", "Lizards or snakes basking on the last warm stone of the day"]},
                        {cells: ["First hour", "Slow walk along walls, hedges, and the lit side of buildings; the Guide shows how to sweep a torch low", "Geckos near lights in warm regions; toads starting to move"]},
                        {cells: ["Second hour", "Pond or stream edge, standing still; listening for calls before looking", "Frogs and newts in shallows; with rain, salamanders on the path"]},
                        {cells: ["Final stretch", "Return by a different edge; quick checks of culverts and verges", "A snake crossing, if the night is warm enough; moths and spiders either way"]},
                        {cells: ["Wrap-up", "Recap of what was found and why, in the app if you want it logged", "Nothing new, and that is normal"]}
                    ]
                }
            },
            {
                title: "What the Guide should refuse",
                paragraphs: [
                    "Baiting, flipping every rock, pulling animals from cover, or lining up a photo that stresses the animal. If that is the product, it is not an experience worth taking, on AnimalDex or anywhere else. The honest version is slower and leaves everything exactly where it was.",
                    "Here is how the two kinds of trip look in practice."
                ],
                table: {
                    columns: ["An ethical Guide", "A Guide to avoid"],
                    rows: [
                        {cells: ["Lifts a stone, looks, replaces it the same way up", "Flips every rock along a wall and leaves them upturned"]},
                        {cells: ["Keeps the torch beam off an animal's eyes after a few seconds", "Holds a bright light on a frog while six phones take photos"]},
                        {cells: ["Points, explains, keeps everyone at a distance", "Picks the animal up and passes it round for photos"]},
                        {cells: ["Says 'nothing tonight, here is why' when it is cold", "Produces an animal from a bag or a known hide-box"]},
                        {cells: ["Walks the verge, stops only where it is safe", "Stops the car in a live lane for a road-crossing snake"]},
                        {cells: ["Asks you to arrive with clean boots for wetlands", "Moves between ponds with muddy nets and no hygiene"]}
                    ]
                },
                inlineLinks: [ethicalGuideLink]
            },
            {
                title: "The animals you are most likely to meet",
                paragraphs: [
                    "The realistic cast depends on where you are, but a few groups turn up again and again. Common frogs are 6 to 9 cm long and move to ponds early in spring, often on the first mild wet nights of the year. Fire salamanders, 15 to 25 cm with bold yellow-and-black markings, stay hidden in dry weather and walk out onto forest floors and lanes on rainy nights; their skin secretions are toxic, so nobody should touch one. In warm regions the first find of the night is often a Mediterranean house gecko, 10 to 13 cm long, hunting insects on a wall beside a light.",
                    "Snakes are the least predictable. A corn snake, usually 60 to 120 cm and harmless to people, is most likely on a warm evening crossing a trail or a quiet road, and a cold snap will keep it underground. A good Guide tells you that in the briefing so that an evening of frogs and no snake lands as a normal night, not a failure."
                ],
                speciesSlugs: ["common-frog", "fire-salamander", "mediterranean-house-gecko", "corn-snake"]
            },
            {
                title: "Rain, roads, and why the weather sets the night",
                paragraphs: [
                    "Reptiles and amphibians are ectotherms, so a few degrees change everything. Mild and wet brings amphibians out; warm and dry suits lizards and snakes; cold shuts most activity down. Expect the Guide to check the forecast and to tell you honestly that a cold, dry night will be a short, quiet walk. That is not a reason to cancel, but it is a reason to reset expectations.",
                    "Rain also pushes animals onto roads, where warm tarmac and open space make them easy to see and easy to kill. Many herpers walk quiet lanes after rain for exactly that reason. The rule on a guided trip is simple: stay on the verge, wear something reflective, never stop in a live lane, and let the Guide move an animal off the road only if it is in immediate danger and local rules allow it."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-to-expect-on-a-guided-herping-trip/fire-salamander-forest-floor.webp",
                        alt: "Fire salamander crossing a wet forest road with a car waiting behind it",
                        width: 1400,
                        height: 933,
                        caption: "A fire salamander on a wet forest road. Rain nights bring amphibians onto tarmac, which is why road safety belongs in every briefing. Photo: BouketenCate, CC BY 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What to bring",
                paragraphs: [
                    "Bring closed shoes, a light if it is a night walk, and the expectation that you will not handle anything. The full list is short."
                ],
                cards: [
                    {label: "Footwear and clothing", body: "Boots or closed shoes that can get wet, long trousers, and a layer for standing still. Clean the mud off your boots before the trip if you are visiting wetlands; amphibian chytrid fungus travels on it."},
                    {label: "Light", body: "A headlamp with a red mode and a hand torch as backup. Red light keeps your own night vision and is less disturbing to animals. Point it low and keep it off eyes."},
                    {label: "Phone and app", body: "A charged phone for live photos from a distance. AnimalDex captures are live in-app photos, so take the shot on the night rather than planning to upload later."},
                    {label: "Not needed", body: "Hooks, bags, nets, a big flash, or a long lens. Phone photos from a metre or two away identify most finds."}
                ]
            },
            {
                title: "After the walk: how to log it",
                paragraphs: [
                    "Add each animal to your herping field journal in the app while the night is fresh: the live photo, the time, the weather, and the general habitat. Keep the Guide's area general in your notes too; publishing a precise location for a sensitive species helps collectors more than it helps you. Over a season the pattern in your own log, which nights produced which animals, becomes the field craft you paid the Guide to start.",
                    "Payment stays simple: you requested the date in AnimalDex, the Guide accepted, and you paid cash on the day. AnimalDex does not run the walk and does not collect that money."
                ],
                inlineLinks: [herpingJournalLink, guidePaymentsLink],
                pullQuote: "A gecko on a wall and a lesson in where to look is a good night. A snake pulled from a bag is not."
            }
        ],
        faq: [
            {
                question: "What happens on a herping tour?",
                answer: "You meet at dusk, get a short briefing on route and rules, then walk slowly along edges such as walls, hedges, verges, and pond margins while the Guide sweeps a torch low across the ground. Finds are photographed from a distance, never handled, and the Guide explains why each animal was where it was. Most trips last two to three hours."
            },
            {
                question: "How many animals will I see on a guided herping trip?",
                answer: "It varies with temperature, rain, and season. A mild wet spring night can produce several frogs, a newt or two, and sometimes a salamander or snake; a cold dry night may produce one gecko. Honest Guides say so in advance. The outing is a lesson in where and when to look, not a fixed species count."
            },
            {
                question: "Is a herping trip safe for beginners?",
                answer: "Yes, if the Guide keeps the group on public paths and verges, keeps everyone at a distance from animals, and handles nothing. Wear closed shoes and long trousers, keep your light low, and follow the Guide's instructions near roads and water. Venomous species are observed from where you stand, never approached."
            },
            {
                question: "Do I need special equipment for herping?",
                answer: "No. A headlamp with a red mode, a backup torch, closed shoes, long trousers, and a charged phone cover it. Clean boots matter if you visit wetlands, because amphibian chytrid fungus spreads in mud. Hooks, bags, and nets are not needed because an ethical trip does not catch anything."
            },
            {
                question: "Can I log what I see on a herping trip in AnimalDex?",
                answer: "Yes. Take a live photo in the app from a distance and let it identify the animal, then add the time, weather, and general habitat to your herping field journal. Captures are live in-app photos, so a gallery upload afterwards is not the same record. Keep sensitive locations general in anything you publish."
            }
        ],
        sources: [
            {label: "Partners in Amphibian and Reptile Conservation (PARC)", href: "https://parcplace.org/"},
            {label: "Amphibian Ark: Chytrid fungus", href: "https://www.amphibianark.org/"},
            {label: "Britannica: Salamander", href: "https://www.britannica.com/animal/salamander"},
            {label: "Leave No Trace: The 7 Principles", href: "https://lnt.org/why/7-principles/"}
        ]
    }),
    earnBlogPost({
        slug: "how-to-choose-a-local-wildlife-guide",
        canonicalUrl: `https://animaldex.app${blogHrefs.chooseLocalGuide}`,
        title: "How to Choose a Local Wildlife Guide",
        description:
            "How to choose a local wildlife guide: the facts a listing should show, questions to ask, group size, honesty about sightings, and how payment works.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-to-choose-a-local-wildlife-guide"),
        readingMinutes: 7,
        tags: ["wildlife-experiences"],
        searchIntents: ["how to choose a wildlife guide", "local nature guide", "wildlife guide near me", "wildlife tour guide questions", "nature walk guide"],
        speciesSlugs: [],
        relatedSlugs: ["birding-guide-vs-going-alone", "how-to-find-ethical-wildlife-experiences-while-traveling", "best-types-of-wildlife-activities-for-animal-lovers"],
        tableOfContents: [
            "Read the public facts",
            "What a listing shows and what it leaves out",
            "Questions worth asking in the app",
            "Group size and why small matters",
            "Honesty about sightings is the main signal",
            "How approval, booking, and payment work",
            "After you book: what to bring and how to log"
        ],
        sections: [
            {
                title: "Read the public facts",
                paragraphs: [
                    "On AnimalDex a published listing shows the category, a general public area, duration, guest cap, and a cash-on-the-day price. That is enough to decide whether the outing fits you. It is not a hotel-style review page, and that is deliberate: a short, factual listing is harder to game than a wall of five-star quotes.",
                    "Approved AnimalDex Wildlife Guides have passed a human review after meeting wild-collection gates: at least 45 wild captures, 20 wild species, and a 30-day-old account. That proves someone has spent real time in the field with the app. Approval is not a promise of sightings or of a perfect host, so the choosing is still yours.",
                    "The same test works for any local guide, on any platform. Can you see where you are going, for how long, with how many people, and for how much, before you commit? If any of those is missing, ask."
                ],
                inlineLinks: [earnRelatedLinks.experiences, earnRelatedLinks.marketplace],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-choose-a-local-wildlife-guide/birdwatchers-group-binoculars.webp",
                        alt: "A small group of birdwatchers with binoculars scanning the trees from a footbridge",
                        width: 1400,
                        height: 941,
                        caption: "A small group with binoculars on a public footbridge. This is what a good listing looks like once it leaves the screen. Photo: Department of the Interior. U.S. Fish and Wildlife Service. National Conservation Training Center. 10/1997-8888, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What a listing shows and what it leaves out",
                paragraphs: [
                    "Use this table against any listing. The right-hand column is not proof of a bad Guide, but each entry is a question you should get answered before you request."
                ],
                table: {
                    columns: ["Good sign", "Ask about it, or walk away"],
                    rows: [
                        {cells: ["One clear category (birding, herping, night, macro, shore, photography, general)", "Everything at once, with every charismatic species in the area named"]},
                        {cells: ["A general public area you can find on a map", "A secret location, or private land with no permission mentioned"]},
                        {cells: ["A duration that matches the activity (dawn for birds, dusk for herps, low tide for shore)", "A fixed slot that ignores light, tide, or season"]},
                        {cells: ["A small guest cap", "No cap, or a cheaper price for bigger groups"]},
                        {cells: ["Sightings described as possible, not promised", "'Guaranteed', 'you will see', or photos of handled animals"]},
                        {cells: ["Cash on the day to the Guide, with the price stated per person", "Deposits to a third party, hidden fees, or tips demanded"]},
                        {cells: ["A no-handling, no-baiting, no-playback rule", "Feeding, calling in, or touching offered as the highlight"]}
                    ]
                }
            },
            {
                title: "Questions worth asking in the app",
                paragraphs: [
                    "What is the meeting area, in general terms? What happens if it rains? What is off-limits? Do you need your own transport? A Guide who answers those plainly is easier to trust than one who only talks about rare animals. Ask in the request thread so the answers are in writing."
                ],
                cards: [
                    {label: "Where do we meet?", body: "A car park, a station, or a reserve entrance in general terms is fine. You do not need the exact owl tree; you do need to know how to get there and how far you will walk."},
                    {label: "What is the plan if the weather turns?", body: "Rain helps amphibians and ruins dawn birdsong. A good Guide says which it is for their category and whether they shorten, reschedule, or go anyway."},
                    {label: "What will you not do?", body: "You want to hear no handling, no feeding or baiting, no call playback, no lights held on animals, no leaving the path on sensitive ground."},
                    {label: "Who else is coming?", body: "The guest cap is on the listing; ask how many are already confirmed. Two people and a Guide is a different morning from six."},
                    {label: "Is this suitable for me?", body: "Say how far you can walk, whether you can stand still for twenty minutes, and whether children are coming. Honest Guides will say no when it does not fit."},
                    {label: "How do I pay?", body: "On AnimalDex the answer is cash on the day, per person, to the Guide. If someone asks for a transfer elsewhere first, stop."}
                ]
            },
            {
                title: "Group size and why small matters",
                paragraphs: [
                    "Wildlife is easier to see with fewer people. Six people walking a path make less noise than twenty, stop faster, and fit on a verge. A Guide can also keep a small group at a sensible distance from an animal, which is impossible when half the group is still arriving while the other half is already too close. Guest caps on AnimalDex listings exist for that reason, not as a luxury feature.",
                    "Small groups also change what the Guide can tell you. With four people, a Guide can explain why a heron is standing where it is and show each person the field marks through their own binoculars. With a coach party, the Guide is counting heads."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-choose-a-local-wildlife-guide/guided-walk-forest.webp",
                        alt: "Visitors on a guided walk through a flower-rich nature reserve meadow",
                        width: 1400,
                        height: 1050,
                        caption: "A guided walk through a reserve meadow. Small enough that everyone can hear the Guide and nobody is treading on the verge. Photo: Bob Harvey, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Honesty about sightings is the main signal",
                paragraphs: [
                    "Wild animals vary with season, weather, time of day, and luck. Shorebirds feed on a falling tide and roost at high water. Songbirds are loudest in the first hour after dawn in spring and go quiet by late morning. Amphibians move on mild wet nights and vanish in cold dry spells. Owls call most in autumn and late winter. A Guide who tells you this before you book is selling knowledge; one who promises a list is selling disappointment or disturbance.",
                    "The practical test is a single sentence. If the listing or the Guide's reply contains some version of sightings are not guaranteed, and then explains what you are likely to see in that season, you are talking to the right person."
                ],
                pullQuote: "A Guide who says 'probably not tonight, here is why' is worth more than one who says 'guaranteed'."
            },
            {
                title: "How approval, booking, and payment work",
                paragraphs: [
                    "Wildlife Guides is an AnimalDex beta. Guides apply after meeting the wild-collection gates, pass a human review, and publish listings in one of seven categories. You request a date in the app; the Guide accepts or declines; you pay cash on the day, per person, directly to them. AnimalDex does not take that payment and does not operate the outing, so if an experience is not published, it does not exist on the platform.",
                    "Approval tells you the Guide has real field time with the app and a reviewed listing. It does not rate their patience or their knowledge of a particular reserve, which is why the questions above still matter."
                ],
                inlineLinks: [guidePaymentsLink, ethicalGuideLink],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-choose-a-local-wildlife-guide/nature-guide-tour-group.webp",
                        alt: "A park ranger leading a group of visitors along a boardwalk",
                        width: 1400,
                        height: 933,
                        caption: "A ranger-led walk on public boardwalks. Public ground, a named leader, and a clear route are the baseline any listing should meet. Photo: Yellowstone National Park, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "After you book: what to bring and how to log",
                paragraphs: [
                    "Bring what the category needs: binoculars for birds, a red-mode headlamp for night and herping, tide times and grippy shoes for the shore, a charged phone for everything. Then use the same app to identify and keep what you actually see. Captures are live in-app photos taken on the day, which keeps your collection honest and separate from the Guide's promises. The best outcome of a good Guide is that your own log, a month later, shows you looking in the right places without them."
                ],
                inlineLinks: [
                    {text: "Birding guide vs going alone", slug: "birding-guide-vs-going-alone", href: blogHrefs.birdingGuideVsAlone},
                    {text: "Best types of wildlife activities", slug: "best-types-of-wildlife-activities-for-animal-lovers", href: blogHrefs.wildlifeActivities}
                ]
            }
        ],
        faq: [
            {
                question: "How do I choose a good wildlife guide?",
                answer: "Pick a Guide whose listing shows one clear category, a general public area, a duration that fits the activity, a small guest cap, and a stated per-person price, and whose copy says sightings are not guaranteed. Then ask about weather plans, off-limits behaviour, transport, and group size. Plain answers to those questions matter more than any rating."
            },
            {
                question: "What questions should I ask a wildlife tour guide?",
                answer: "Ask where you meet in general terms, what happens if the weather turns, what the Guide will not do (handling, feeding, playback, lights on animals), how many guests are already confirmed, whether the walk suits your fitness or children, and how payment works. On AnimalDex, ask in the request thread so the answers are in writing."
            },
            {
                question: "Are AnimalDex Wildlife Guides vetted?",
                answer: "Yes, to a point. Guides must have at least 45 wild captures, 20 wild species, and a 30-day-old account, then pass a human review before listings go live. That proves genuine field time. It does not guarantee sightings or a perfect host, so read the listing and ask questions before you request a date."
            },
            {
                question: "How do I pay a local wildlife guide on AnimalDex?",
                answer: "You request a date in the app, the Guide accepts, and you pay the per-person price in cash on the day, directly to the Guide. AnimalDex does not collect the payment, take a deposit, or operate the outing. If anyone asks for a transfer to a third party before the day, that is not how the programme works."
            },
            {
                question: "Is a small group better for a wildlife walk?",
                answer: "Almost always. Fewer people make less noise, stop faster, and can be kept at a safe distance from animals. The Guide can explain field marks to each person instead of counting heads. Listings on AnimalDex carry a guest cap for this reason; ask how many places are already taken before you request."
            }
        ],
        sources: [
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"},
            {label: "U.S. National Park Service: Watching wildlife safely", href: "https://www.nps.gov/subjects/watchingwildlife/7ways.htm"},
            {label: "Leave No Trace: The 7 Principles", href: "https://lnt.org/why/7-principles/"}
        ]
    }),
    earnBlogPost({
        slug: "birding-guide-vs-going-alone",
        canonicalUrl: `https://animaldex.app${blogHrefs.birdingGuideVsAlone}`,
        title: "Birding Guide vs Going Alone: When a Local Guide Helps",
        description:
            "Birding guide or go alone? When local timing and habitat knowledge are worth paying for, what a good birding Guide does on the day, and what to bring.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("birding-guide-vs-going-alone"),
        readingMinutes: 6,
        tags: ["wildlife-experiences", "birding"],
        searchIntents: ["birding guide", "birdwatching tour", "local birding guide", "is a birding guide worth it", "birding tour vs self-guided", "hire a bird guide"],
        speciesSlugs: ["common-kingfisher", "great-blue-heron", "sanderling", "tawny-owl"],
        relatedSlugs: ["how-to-choose-a-local-wildlife-guide", "best-types-of-wildlife-activities-for-animal-lovers", "wildlife-photography-tours-what-to-look-for"],
        tableOfContents: [
            "Alone is often enough",
            "When a Guide earns the fee",
            "Guide vs alone, side by side",
            "What a good birding Guide does on the day",
            "Timing: dawn, tide, and season",
            "Birding ethics apply whoever you walk with",
            "Keep the list either way"
        ],
        sections: [
            {
                title: "Alone is often enough",
                paragraphs: [
                    "If you already know a wetland or a dawn chorus route, a listing will not make you a better birder by itself. You know where the reedbed opens out, which gate the barn owl works along at dusk, and that the kingfisher uses the second post on the far bank. A Guide would be telling you what you already know. Spend the money on better binoculars, an 8x42 pair being the usual standard, and use AnimalDex to identify and keep the species you photograph.",
                    "Going alone also has a quality a guided morning cannot replicate: you learn by being wrong. You misjudge the call, check, correct, and remember. That loop is how local knowledge is built in the first place."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/birding-guide-vs-going-alone/birder-binoculars.webp",
                        alt: "A young birder scanning with binoculars",
                        width: 1400,
                        height: 933,
                        caption: "Binoculars, patience, and a patch you know. For a familiar site, that is all the guide you need. Photo: USFWS Headquarters, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "When a Guide earns the fee",
                paragraphs: [
                    "A new city, a short travel window, or a habitat you have never walked: that is when a local birding Guide helps. You are paying for timing and place knowledge, not for a guaranteed species list. A Guide who has walked the same estuary for ten winters knows which hour of the falling tide brings the waders onto the near mud, which hedge the migrants drop into after a night of south-westerlies, and which path is flooded in March. You could learn that yourself in three seasons. With two mornings in town, you cannot.",
                    "A second pair of ears is the other reason. Most birds are heard before they are seen, and in an unfamiliar region a Guide picks out the one call you would have walked past. AnimalDex birding listings are small-group experiences with a general public area, a duration, a guest cap, and a cash price; the category is written for people who already carry binoculars. Request them in the app."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            },
            {
                title: "Guide vs alone, side by side",
                paragraphs: [
                    "Neither option is better in the abstract. Match the choice to the morning."
                ],
                table: {
                    columns: ["Situation", "Go alone", "Book a Guide"],
                    rows: [
                        {cells: ["Your regular patch", "Yes. You know the timing and the spots.", "Only to learn a skill, such as calls or gull identification."]},
                        {cells: ["New region, one or two mornings", "You will spend most of it finding the car park.", "Yes. Local timing and habitat knowledge is exactly what you are short of."]},
                        {cells: ["Habitat you have never worked (estuary, high moor, rainforest edge)", "Possible, with a long learning curve.", "Yes. Tide, altitude, and canopy birding all have local rules."]},
                        {cells: ["Specific hard species", "Fine if you accept you may miss it.", "Helps with timing, but no honest Guide guarantees it."]},
                        {cells: ["You want quiet and no schedule", "Yes.", "No; even a small group is a group."]},
                        {cells: ["You want to learn calls fast", "Slow on your own.", "Yes. Hearing a call named in the field sticks."]}
                    ]
                }
            },
            {
                title: "What a good birding Guide does on the day",
                paragraphs: [
                    "A good Guide meets you before first light in spring, because the chorus is loudest in the hour after dawn and fades by mid-morning. They walk slowly, stop often, and name what they hear before they raise binoculars. They tell you what is likely and what is not, and they say which birds they have not seen for weeks. They keep the group at a distance that does not flush the bird, they do not use call playback to pull a bird out, and they do not approach nests.",
                    "They should also leave you better at birding alone. Expect to be shown how to scan a mudflat, how to pick a kingfisher out of a bank, and what a heron standing motionless in the margin is actually doing."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/birding-guide-vs-going-alone/common-kingfisher-perch.webp",
                        alt: "Common kingfisher perched on a post above water",
                        width: 1400,
                        height: 1400,
                        caption: "A common kingfisher on a favourite post. A local Guide knows which post; you would find it eventually. Photo: Scarabinol, CC BY 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Timing: dawn, tide, and season",
                paragraphs: [
                    "Birding is mostly timing, and timing is what a local sells. A common kingfisher, about 16 cm long, fishes from low perches over slow clear water and is easiest to find early, before the towpath fills with walkers. A great blue heron stands around 1.2 m tall and hunts shallow margins by standing still, so it is a bird of dawn and dusk edges. Sanderlings, 20 cm shorebirds that breed in the High Arctic, run the wave line on sandy beaches in winter and are pushed to roost at high tide; a Guide will have you on the beach as the water drops.",
                    "Season matters as much as the hour. Spring brings song and migrants, autumn brings passage and quiet plumages, winter brings wildfowl and waders to estuaries. A tawny owl, about 38 cm long, calls most in autumn and late winter while territories are being settled, which is when a dusk listing is honest and a midsummer one is a long shot. Ask the Guide what the week you are visiting usually produces, and expect a straight answer."
                ],
                speciesSlugs: ["common-kingfisher", "great-blue-heron", "sanderling", "tawny-owl"],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/birding-guide-vs-going-alone/great-blue-heron-wetland.webp",
                        alt: "Great blue heron standing among reeds in a wetland",
                        width: 1400,
                        height: 933,
                        caption: "A great blue heron hunting a wetland margin. Standing still is the method, for the bird and for you. Photo: USFWS Midwest Region, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Birding ethics apply whoever you walk with",
                paragraphs: [
                    "The rules do not change because you paid. Keep your distance, especially from nests and roosts. Do not use playback to lure birds, which disrupts territories and feeding. Stay on paths across sensitive ground. Keep groups small and quiet. If a Guide breaks these on the day, you are allowed to say so, and to leave a listing you would not book again."
                ],
                inlineLinks: [ethicalGuideLink, {text: "How to choose a local wildlife guide", slug: "how-to-choose-a-local-wildlife-guide", href: blogHrefs.chooseLocalGuide}],
                pullQuote: "You are paying for timing and place knowledge, not for a guaranteed species list."
            },
            {
                title: "Keep the list either way",
                paragraphs: [
                    "Whether you walked alone or with a Guide, the record is yours. Photograph what you see as a live capture in AnimalDex, let it identify the species, and keep the time and the general place. A guided morning that adds three species to your collection is a good deal; a guided morning that adds a story about what you nearly saw is still a morning out. Bring 8x42 binoculars, a charged phone, layers, and, for estuaries, the tide table."
                ],
                inlineLinks: [photoCompanionLink, guidePaymentsLink]
            }
        ],
        faq: [
            {
                question: "Is a birding guide worth it?",
                answer: "Yes when you are somewhere new with little time, or in a habitat you have never worked, because a local Guide sells timing and place knowledge you cannot build in a weekend. It is usually not worth it on a patch you already know. No honest Guide guarantees a species, so judge the fee against learning, not against a list."
            },
            {
                question: "What does a birding guide actually do?",
                answer: "A birding Guide picks the hour and the route, names birds by call before you see them, shows you how to scan habitat such as mudflats and reedbeds, and keeps the group at a distance that does not flush birds. A good one also explains what is unlikely that week, and leaves you better at birding on your own."
            },
            {
                question: "How much does a local birding guide cost on AnimalDex?",
                answer: "Each listing shows its own per-person price, paid in cash on the day directly to the Guide. AnimalDex does not collect the payment or take a deposit. Prices vary by region, duration, and guest cap, so compare the listing facts rather than looking for a single platform rate."
            },
            {
                question: "What time of day is best for birdwatching?",
                answer: "The first hour or two after dawn in spring, when song is loudest and birds feed before the day warms. Dusk is second best and is when owls and roost flights happen. For shorebirds, tide matters more than clock time: a falling tide brings waders onto feeding mud, and high tide pushes them to roosts."
            },
            {
                question: "Can I use playback to attract birds on a guided walk?",
                answer: "You should not, and a good Guide will not. Playback pulls birds off territories and feeding, and is banned in many reserves. Ethical guided birding relies on timing, habitat knowledge, and patience. If playback is part of the pitch, treat it as a reason to choose a different Guide."
            }
        ],
        sources: [
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"},
            {label: "Cornell Lab of Ornithology: Great Blue Heron", href: "https://www.allaboutbirds.org/guide/Great_Blue_Heron/overview"},
            {label: "Cornell Lab of Ornithology: Sanderling", href: "https://www.allaboutbirds.org/guide/Sanderling/overview"},
            {label: "Britannica: Tawny owl", href: "https://www.britannica.com/animal/tawny-owl"}
        ]
    }),
    earnBlogPost({
        slug: "what-happens-on-a-night-wildlife-walk",
        canonicalUrl: `https://animaldex.app${blogHrefs.nightWildlifeWalk}`,
        title: "What Happens on a Night Wildlife Walk?",
        description:
            "What a night wildlife walk is really like: how lights are used, who is active after dark, what to bring, how weather changes the night, and how to log it.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("what-happens-on-a-night-wildlife-walk"),
        readingMinutes: 7,
        tags: ["wildlife-experiences", "night wildlife"],
        searchIntents: ["night wildlife walk", "night wildlife tour", "night herping walk", "nocturnal animal walk", "night safari walk", "what to bring night walk"],
        speciesSlugs: ["tawny-owl", "european-hedgehog", "red-fox", "firefly"],
        relatedSlugs: ["what-to-expect-on-a-guided-herping-trip", "how-to-find-ethical-herping-tours-and-local-reptile-guides", "how-to-choose-a-local-wildlife-guide"],
        tableOfContents: [
            "Dark, slow, and quieter than you think",
            "A night walk, step by step",
            "Lights to look, not to lure",
            "Who is out after dark",
            "What to bring",
            "Weather, moon, and season",
            "Logging night sightings"
        ],
        sections: [
            {
                title: "Dark, slow, and quieter than you think",
                paragraphs: [
                    "You meet at a public area as the light goes, walk a known path, and use lights in short bursts. Frogs, moths, geckos, bats, foxes, and owls are the usual possibilities, never a promise. Most of the time you are standing still, letting your eyes adjust and listening, because at night the ears find more than the eyes.",
                    "If a walk is sold as a guaranteed civet, owl, or snake, treat that as a warning, not a feature. The only way to guarantee a nocturnal animal is to feed it at a fixed spot or keep it somewhere. On AnimalDex, night wildlife is a Guide category defined as after-dark watching with lights used to look, not to lure, led by approved local Guides on public ground with a small guest cap and a cash-on-the-day price."
                ],
                inlineLinks: [earnRelatedLinks.experiences],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-happens-on-a-night-wildlife-walk/headlamp-night-walk.webp",
                        alt: "Long exposure of a hiker's red headlamp tracing a desert trail under the stars",
                        width: 1400,
                        height: 934,
                        caption: "A long exposure of a hiker's red headlamp on a desert trail. Red light keeps your night vision and disturbs animals less. Photo: Joshua Tree National Park, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "A night walk, step by step",
                paragraphs: [
                    "The shape of the evening is similar almost everywhere; the cast changes with the habitat."
                ],
                table: {
                    columns: ["Stage", "What happens", "Why"],
                    rows: [
                        {cells: ["Dusk briefing", "Route, rules, how to hold a light, where the road and water are", "Everything is harder to explain once it is dark"]},
                        {cells: ["Last light", "Standing at an edge: woodland rim, hedge, pond, field gate", "Bats emerge, owls start calling, mammals move at the boundary"]},
                        {cells: ["First dark hour", "Slow walk with lights off where possible; brief low sweeps at walls and verges", "Your eyes take 20 to 30 minutes to adapt; sweeps catch eyeshine"]},
                        {cells: ["Water stop", "Standing still at a pond or stream, listening before looking", "Frogs call before they are seen; a torch too early silences them"]},
                        {cells: ["Return leg", "Different edge back to the meeting point; quick checks under lights near buildings", "Moths and geckos gather where there is light already"]},
                        {cells: ["Wrap-up", "Recap of what was found and why; log in the app if you want", "The pattern is the lesson, not the list"]}
                    ]
                }
            },
            {
                title: "Lights to look, not to lure",
                paragraphs: [
                    "A torch is for finding and confirming, not for holding an animal in place. The working rules on a good walk: use red light where you can, because it preserves your own night vision and most mammals and amphibians react less to it; keep white light brief and low; never hold a beam on an animal's eyes while people take photos; and never shine lights into nest holes, roosts, or across water where nesting birds sit.",
                    "Luring is different from looking. Running a bright lamp or a light trap to pull in moths is a survey technique that needs the landowner's permission and is not a walk; feeding foxes or badgers at a fixed spot to guarantee a show is baiting; playing owl calls to pull a bird in is playback. A night Guide who does any of those is selling disturbance. One who says the owl may or may not answer tonight is selling the real thing."
                ],
                inlineLinks: [ethicalGuideLink],
                pullQuote: "Lights are for finding animals, not for holding them in place while the phones come out."
            },
            {
                title: "Who is out after dark",
                paragraphs: [
                    "In temperate woodland and farmland, the reliable night voices are owls. The tawny owl, about 38 cm long, is the common woodland owl across much of Europe and calls most in autumn and late winter while pairs settle territories; the hoot carries a long way, and the bird is usually heard rather than seen. Hedgehogs forage along hedge bases and lawn edges on mild nights from spring to autumn, and a red fox crossing a field gate at the edge of a village is a normal sight on almost any night.",
                    "Near water, frogs and toads call on mild evenings, and a slow low sweep of a torch across the shallows picks up eyeshine. In warmer regions fireflies flash over damp grass in early summer, and tree frogs such as the American green tree frog call from vegetation after dark. Bats emerge at dusk everywhere; a Guide with a bat detector can let you hear them, and in many countries bats and their roosts are legally protected, so nobody approaches a roost."
                ],
                speciesSlugs: ["tawny-owl", "european-hedgehog", "red-fox", "firefly"],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-happens-on-a-night-wildlife-walk/tawny-owl-branch-2.webp",
                        alt: "Tawny owl perched on a branch at night",
                        width: 1400,
                        height: 1127,
                        caption: "A tawny owl on a branch after dark. Usually you hear it; seeing one like this is a bonus, not a booking. Photo: Dion Art, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What to bring",
                paragraphs: [
                    "Closed shoes, a spare light, and clothes you can stand still in. Leave the idea that you will leave with a trophy photo."
                ],
                cards: [
                    {label: "Light", body: "A headlamp with a red mode and a hand torch as backup. Fresh batteries. Point it at the ground and keep it off eyes."},
                    {label: "Clothing", body: "Closed shoes or boots, long trousers, a warm layer even in summer, because standing still at 11 pm is colder than walking at 9 pm. Dark, quiet fabrics."},
                    {label: "Phone", body: "Charged, screen brightness down, sound off. AnimalDex captures are live in-app photos, so take the shot on the night, from a distance, without flash on an animal's face."},
                    {label: "Useful extras", body: "Insect repellent, water, a small folding seat for the pond stop, and the tide or moon times if the Guide mentioned them."},
                    {label: "Leave at home", body: "A big flash, a laser pointer, speakers, and any food intended for animals."}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-happens-on-a-night-wildlife-walk/green-tree-frog-night.webp",
                        alt: "American green tree frog calling at night with its throat pouch inflated",
                        width: 1400,
                        height: 933,
                        caption: "An American green tree frog calling after dark. Listen first; the torch comes out once you know where the sound is. Photo: Judy Gallagher, CC BY 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Weather, moon, and season",
                paragraphs: [
                    "Night walks are weather walks. Mild, still, damp nights are the best all-rounders: amphibians move, insects fly, and the bats and owls that eat them follow. Cold, clear, windy nights are quiet. Rain itself is good for frogs and salamanders and poor for moths and bats. A bright full moon makes mammals warier and the sky lovely, so a Guide may prefer the darker half of the month for foxes and the brighter half for seeing a path.",
                    "Season sets the cast. Spring is amphibian movement and the first bats; early summer is fireflies, moths, and hedgehogs; autumn is owls calling and mammals feeding up; winter is thin but owls are vocal and the dark comes early. An honest listing says which of these it is for, and a cold dry night in March is a short, quiet walk however good the Guide is."
                ]
            },
            {
                title: "Logging night sightings",
                paragraphs: [
                    "Night photos are harder, so note more. Record the time, the weather, the moon, and what you heard as well as what you saw. A live capture in AnimalDex of a frog from a metre away, taken under a low red light with no flash on its face, identifies fine. For an owl you only heard, keep the note in your own journal rather than forcing a capture. Over a few walks the log shows you which nights work in your area, which is the point of going with a Guide in the first place.",
                    "Booking is the same as any AnimalDex experience: request a date, the Guide accepts, cash on the day to the Guide. AnimalDex does not run the walk."
                ],
                inlineLinks: [herpingJournalLink, guidePaymentsLink]
            }
        ],
        faq: [
            {
                question: "What do you see on a night wildlife walk?",
                answer: "Usually owls heard calling, bats at dusk, frogs and toads at water, moths and geckos near lights, and sometimes a fox, hedgehog, or deer at a field edge. In warm regions, tree frogs and fireflies. What appears depends on season, temperature, wind, and moon, so a good Guide describes possibilities rather than promising a species."
            },
            {
                question: "What should I bring on a night wildlife tour?",
                answer: "A headlamp with a red mode, a backup torch with fresh batteries, closed shoes, long trousers, a warm layer, insect repellent, water, and a charged phone with the screen dimmed. Leave big flashes, laser pointers, speakers, and food for animals at home. You will spend much of the walk standing still, so dress for that."
            },
            {
                question: "Why do night guides use red light?",
                answer: "Red light preserves your own night vision, which takes 20 to 30 minutes to develop and is lost in seconds under white light. Many mammals and amphibians also react less to red light. White light is kept brief and low for confirming an animal, and no light should be held on an animal's eyes while photos are taken."
            },
            {
                question: "Is a night wildlife walk safe?",
                answer: "On a known public path with a small group and a Guide who briefed the route, yes. The main hazards are footing, water edges, and roads, not animals. Wear closed shoes, stay with the group, keep your light on the ground, and follow the Guide near lanes. Venomous animals, where they exist, are watched from a distance."
            },
            {
                question: "Can you guarantee seeing an owl on a night walk?",
                answer: "No, and a listing that does is a warning sign. Owls are heard far more often than seen, call most in autumn and late winter, and go quiet in wind and rain. The only ways to guarantee one are playback or feeding at a fixed spot, both of which disturb the bird. Ethical Guides sell the chance, not the owl."
            }
        ],
        sources: [
            {label: "Britannica: Tawny owl", href: "https://www.britannica.com/animal/tawny-owl"},
            {label: "Bat Conservation Trust", href: "https://www.bats.org.uk/"},
            {label: "U.S. National Park Service: Night skies", href: "https://www.nps.gov/subjects/night/index.htm"},
            {label: "Leave No Trace: The 7 Principles", href: "https://lnt.org/why/7-principles/"}
        ]
    }),
    earnBlogPost({
        slug: "wildlife-photography-tours-what-to-look-for",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographyToursLookFor}`,
        title: "Wildlife Photography Tours: What to Look For",
        description:
            "What to look for in a wildlife photography tour: honest listings, questions to ask, ethics behind the lens, realistic subjects by season, and kit.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("wildlife-photography-tours-what-to-look-for"),
        readingMinutes: 7,
        tags: ["wildlife-experiences", "wildlife photography"],
        searchIntents: ["wildlife photography tour", "wildlife photography guide", "animal photography tour", "bird photography tour ethics", "wildlife photography workshop what to expect"],
        speciesSlugs: ["belted-kingfisher", "snowy-egret", "great-blue-heron"],
        relatedSlugs: ["birding-guide-vs-going-alone", "how-to-choose-a-local-wildlife-guide", "how-to-find-ethical-wildlife-experiences-while-traveling"],
        tableOfContents: [
            "Field time, not a studio",
            "What to look for and what to walk away from",
            "Questions to ask before you book",
            "Realistic subjects by season and light",
            "Ethics behind the lens",
            "What to bring",
            "After the outing"
        ],
        sections: [
            {
                title: "Field time, not a studio",
                paragraphs: [
                    "The useful listing tells you the public area, how long you will be out, and how many people share the path. It will not promise a leopard or a perfectly perched kingfisher. A wildlife photography tour should buy you two things: time in the right place at the right light, and someone who can tell you what you are looking at and what it will do next. That identification context is what separates a photo of a bird from a record of a species.",
                    "On AnimalDex, wildlife photography is a Guide category described as field time for people who want identification context while they shoot. Experiences are led by approved Wildlife Guides on public ground, with a guest cap and a per-person price paid in cash on the day. Booking and payment stay in the app and cash-on-the-day flow; AnimalDex does not operate the outing."
                ],
                inlineLinks: [earnRelatedLinks.experiences, photoCompanionLink],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/wildlife-photography-tours-what-to-look-for/wildlife-photographers-hide.webp",
                        alt: "Wildlife photographer aiming a long telephoto lens into the trees of a park",
                        width: 788,
                        height: 1400,
                        caption: "A long lens pointed up into the trees from a public park path. Distance is the ethic and the technique. Photo: Siarhei V, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What to look for and what to walk away from",
                paragraphs: [
                    "Photography tours attract the staged-encounter business model more than any other category, because a guaranteed frame sells. Read the listing against this table."
                ],
                table: {
                    columns: ["Look for", "Walk away from"],
                    rows: [
                        {cells: ["A named public area and a start time tied to light (dawn, golden hour, dusk)", "Midday slots sold year-round, or a hide on undisclosed private land"]},
                        {cells: ["'Sightings not guaranteed' and a realistic species list for the season", "'Guaranteed owl', 'kingfisher dive every time', or a portfolio of identical poses"]},
                        {cells: ["A small guest cap so everyone has a clean angle", "Eight tripods on one perch"]},
                        {cells: ["Natural perches, natural behaviour, distance", "Baited perches, live or dead animals placed for the shot, call playback"]},
                        {cells: ["A Guide who talks about identification and behaviour", "A Guide who talks only about settings and 'the shot'"]},
                        {cells: ["Cash on the day to the Guide, price per person", "Deposits elsewhere, or 'image fees' added later"]}
                    ]
                }
            },
            {
                title: "Questions to ask before you book",
                paragraphs: [
                    "Ask in the request thread so the answers are in writing. These six cover most of it."
                ],
                cards: [
                    {label: "How do you get the animals close?", body: "The honest answer is 'we don't; we get you to where they already are, at the right time'. Bait, lures, and playback are the wrong answers."},
                    {label: "What is likely this week, and what is not?", body: "You want a seasonal answer: who is nesting, who is migrating, what the light is doing. A Guide who names the same star species every month is reading from a brochure."},
                    {label: "How many photographers, and how do we share the angle?", body: "The guest cap is on the listing. Ask how the Guide positions a group so nobody has to step closer to get a clean frame."},
                    {label: "What do you refuse to do?", body: "Expect: no nests, no flushing for flight shots, no flash on nocturnal animals, no leaving the path on sensitive ground, no moving an animal."},
                    {label: "What lens is realistic here?", body: "An honest Guide says whether 300 mm will do or whether you will be cropping. That tells you how close you will really be, which tells you about ethics."},
                    {label: "What happens if the light or weather fails?", body: "Rain and flat light happen. Ask whether the plan changes, shortens, or reschedules."}
                ]
            },
            {
                title: "Realistic subjects by season and light",
                paragraphs: [
                    "Wetland birds are the bread and butter of ethical photography tours because they are large, visible, and predictable in habitat without being approached. A belted kingfisher, about 30 cm with a loud rattling call, hunts from exposed perches over water and is one of the few birds where the female is more colourful than the male, with a rusty belly band. A snowy egret hunts shallows by shuffling its bright yellow feet to stir prey, which is behaviour you can photograph from a bank without moving. A great blue heron, standing around 1.2 m, works dawn and dusk margins and will hold a pose for minutes if nobody walks closer.",
                    "The honest expectation: a two-hour dawn session on a good wetland might give you a heron, an egret, and a distant kingfisher, with one usable frame in twenty. Mammals are rarer and more dependent on season. Owls are mostly heard. Any listing that reads like a shot list has solved that problem with bait."
                ],
                speciesSlugs: ["belted-kingfisher", "snowy-egret", "great-blue-heron"],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/wildlife-photography-tours-what-to-look-for/belted-kingfisher-perch.webp",
                        alt: "Belted kingfisher perched on a wire against a blue sky",
                        width: 1400,
                        height: 933,
                        caption: "A belted kingfisher on a wire. Not the calendar shot, but a real bird on its own perch, which is what a tour can honestly offer. Photo: U.S. Fish and Wildlife Service - Midwest Region, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Ethics behind the lens",
                paragraphs: [
                    "The pressure to get the frame is the whole ethical problem with photography tours. The rules that keep an outing honest are the same ones birding and herping use, with a few additions for cameras: no baiting perches, no live bait for raptors or owls, no playback to pull a bird in, no flash on nocturnal animals, no approaching nests or dens, no flushing a bird for a flight shot, and no moving an animal to a better background. Distance plus patience is the product.",
                    "A slow public-path morning with identification talk is listable on AnimalDex. A baited owl perch is not. If the Guide's own portfolio shows the same owl on the same stump in twenty frames, you know how those frames were made."
                ],
                inlineLinks: [ethicalGuideLink],
                pullQuote: "A tour that can guarantee the frame has already decided to disturb the animal."
            },
            {
                title: "What to bring",
                paragraphs: [
                    "Pack for standing still in cold light, not for a hike."
                ],
                cards: [
                    {label: "Camera kit", body: "The longest lens you own, a spare battery and card, and a beanbag or monopod rather than a wide tripod footprint in a small group. Check with the Guide whether a hide is involved."},
                    {label: "Phone and app", body: "A charged phone for live AnimalDex captures of the species you actually photographed. Captures are live in-app photos, so take the record shot on the day as well as the camera frame."},
                    {label: "Clothing", body: "Muted colours, a warm layer, waterproof trousers for kneeling on wet ground, and shoes that cope with mud. Early light is cold light."},
                    {label: "Leave behind", body: "Flash for nocturnal animals, speakers, drones unless the Guide and the site allow them, and food intended for animals."}
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/wildlife-photography-tours-what-to-look-for/snowy-egret-hunting.webp",
                        alt: "Snowy egret wading in shallow water with its yellow feet visible",
                        width: 1400,
                        height: 932,
                        caption: "A snowy egret hunting shallows. Its yellow feet stir the prey; your job is to stay on the bank. Photo: Martin.oconnor, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "After the outing",
                paragraphs: [
                    "Use the same app to identify and keep the species you actually photographed. That is a collection, not a proof of a paid sighting. A live capture from the day, with the time and the general place, sits in your Dex next to the camera frame you will edit later. Keep the exact perch out of anything you publish for sensitive species. Payment was cash on the day to the Guide; AnimalDex did not take it and did not run the morning."
                ],
                inlineLinks: [
                    {text: "How wildlife photographers can build a species collection", slug: "how-wildlife-photographers-can-build-a-digital-species-collection", href: blogHrefs.photographerCollection},
                    guidePaymentsLink
                ]
            }
        ],
        faq: [
            {
                question: "What should I look for in a wildlife photography tour?",
                answer: "A named public area, a start time tied to light, a small guest cap, a seasonal and honest species outlook, and a Guide who talks about identification and behaviour rather than only settings. Avoid listings that guarantee a species, use baited perches, play calls, or show the same animal in the same pose across a whole portfolio."
            },
            {
                question: "Are baited wildlife photography hides ethical?",
                answer: "Baiting perches, using live prey for owls or raptors, and playing calls to pull birds in all alter behaviour and are not ethical, whatever the resulting frame looks like. An ethical tour sells distance, timing, and patience. On AnimalDex, a slow public-path morning is listable; a baited perch is not."
            },
            {
                question: "What lens do I need for a wildlife photography tour?",
                answer: "Bring the longest lens you own; 300 mm is a practical minimum for birds and you will often crop. Ask the Guide what is realistic at their site, because the answer tells you how close you will actually be. A beanbag or monopod is easier in a small group than a wide tripod."
            },
            {
                question: "Can a photography guide guarantee a kingfisher or an owl?",
                answer: "No. Kingfishers fish from favourite perches and owls are mostly heard, so a Guide can put you in the right place at the right light but cannot promise the bird. Guarantees are only possible with bait or playback. Expect a realistic outlook and one usable frame in many, not a shot list."
            },
            {
                question: "How do I record the species I photograph on a tour?",
                answer: "Take a live capture in AnimalDex of each species on the day, from where you stand, and let the app identify it. Captures are live in-app photos, so a camera file uploaded later is not the same record. Keep the general place and time, and leave precise perches out of anything you publish."
            }
        ],
        sources: [
            {label: "Audubon: Guide to Ethical Bird Photography", href: "https://www.audubon.org/get-outdoors/audubons-guide-ethical-bird-photography"},
            {label: "Cornell Lab of Ornithology: Belted Kingfisher", href: "https://www.allaboutbirds.org/guide/Belted_Kingfisher/overview"},
            {label: "Cornell Lab of Ornithology: Snowy Egret", href: "https://www.allaboutbirds.org/guide/Snowy_Egret/overview"},
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"}
        ]
    }),
    earnBlogPost({
        slug: "how-to-find-ethical-wildlife-experiences-while-traveling",
        canonicalUrl: `https://animaldex.app${blogHrefs.ethicalTravelExperiences}`,
        title: "How to Find Ethical Wildlife Experiences While Traveling",
        description:
            "How to find ethical wildlife experiences when you travel: the tells of a staged encounter, tourist traps that look harmless, and questions to ask.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-to-find-ethical-wildlife-experiences-while-traveling"),
        readingMinutes: 7,
        tags: ["wildlife-experiences", "travel"],
        searchIntents: ["ethical wildlife experiences", "wildlife activities while traveling", "local wildlife tour", "ethical wildlife tourism", "wildlife selfie ethics", "responsible animal encounters"],
        speciesSlugs: ["three-toed-sloth", "slow-loris", "green-sea-turtle"],
        relatedSlugs: ["how-to-choose-a-local-wildlife-guide", "best-types-of-wildlife-activities-for-animal-lovers", "wildlife-photography-tours-what-to-look-for"],
        tableOfContents: [
            "Refuse the staged encounter",
            "Ethical or exploitative: the tells",
            "The tourist traps that look harmless",
            "Questions to ask any operator",
            "What an AnimalDex listing does and does not guarantee",
            "Do not invent a city page in your head",
            "Log what you actually saw"
        ],
        sections: [
            {
                title: "Refuse the staged encounter",
                paragraphs: [
                    "If the animal is called in, fed, or held for the camera, it is not an ethical wildlife experience. Distance and patience are the product. That one sentence sorts most of what a resort desk or a street tout will offer you: the sloth you can hold, the turtle you can ride, the owl that waits on a stump, the monkeys that come to the balcony for fruit. Each is a wild animal whose behaviour has been bent to fit a schedule.",
                    "The ethical version is less convenient. It happens at the hour the animal chooses, in the place it already lives, with a Guide who keeps you far enough away that the animal does not change what it is doing. You may see less. What you see is real, and your photos will show an animal rather than a prop."
                ],
                inlineLinks: [earnRelatedLinks.experiences],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-find-ethical-wildlife-experiences-while-traveling/three-toed-sloth-wild.webp",
                        alt: "Brown-throated three-toed sloth hanging in a tree, photographed from the ground",
                        width: 1400,
                        height: 933,
                        caption: "A brown-throated sloth in a tree, seen from the ground. The one offered for a selfie on the roadside was taken from a tree like this. Photo: Charles J. Sharp, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Ethical or exploitative: the tells",
                paragraphs: [
                    "You rarely get to inspect an operator before you pay. You can read the offer, and the offer usually tells you."
                ],
                table: {
                    columns: ["Ethical experience", "Exploitative experience"],
                    rows: [
                        {cells: ["Animals seen at a distance in their own habitat", "Animals held, posed, ridden, or brought to you"]},
                        {cells: ["Timing set by the animal: dawn, dusk, tide, season", "Any time you like, every day of the year"]},
                        {cells: ["'We may see' and an honest seasonal outlook", "'Guaranteed', 'you will', 'photo with'"]},
                        {cells: ["Small groups on public paths or permitted areas", "Crowds at a feeding spot or a pen"]},
                        {cells: ["No feeding, no calling in, no touching", "Fruit, meat, or calls used to make the animal appear"]},
                        {cells: ["A named local Guide paid directly", "An anonymous agency with a deposit and a cancellation fee"]},
                        {cells: ["Knowledge as the product: what it is, why it is here", "The photo as the product"]}
                    ]
                }
            },
            {
                title: "The tourist traps that look harmless",
                paragraphs: [
                    "Some encounters feel gentle and are not. A brown-throated three-toed sloth is so slow that holding one seems kind; in reality the animal is removed from its tree, passed between strangers all day, and does not show stress the way a dog would, so people assume it is calm. Sloth selfies are a documented trade in parts of Central and South America, and the animals rarely survive it long.",
                    "The slow loris is worse. It is nocturnal, the only primate with a venomous bite, and the ones offered for photos on tourist streets typically have had their teeth clipped, which is why they can be handed to you. Every loris you hold on a beach road came out of the forest illegally. Sea turtles are a third case: a green sea turtle, with a shell up to about a metre and a weight that can exceed 150 kg, is listed as Endangered by the IUCN, and touching, riding, or crowding one at the surface or on a nesting beach is illegal in many countries and harmful everywhere. Watch from the water's edge or a boat at a respectful distance, with no flash and no white light on a nesting beach.",
                    "The common thread is handling. If any animal is in a human's hands, the experience has already failed, whether the operator is cruel or just careless."
                ],
                speciesSlugs: ["three-toed-sloth", "slow-loris", "green-sea-turtle"],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-find-ethical-wildlife-experiences-while-traveling/green-sea-turtle-reef-2.webp",
                        alt: "Green sea turtle swimming up towards the surface over a reef",
                        width: 1400,
                        height: 933,
                        caption: "A green turtle rising for a breath over a reef. Watch from a distance, never touch, never chase. Photo: Ppmh21, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Questions to ask any operator",
                paragraphs: [
                    "These work for a hotel desk, a street booth, or an app listing. Short, plain answers are the good sign."
                ],
                cards: [
                    {label: "Will anyone touch, feed, or call the animals?", body: "The only acceptable answer is no. Anything else, including 'only a little', is the staged model."},
                    {label: "Where does it happen, and is it public or permitted?", body: "A reserve, a beach, a river path, a forest trail with permission. A compound, a cage, or a 'sanctuary' that lets you hold animals is not it."},
                    {label: "What is likely at this time of year?", body: "You want a seasonal answer, including what is unlikely. Nesting, migration, and rain all change the cast."},
                    {label: "How big is the group and who leads it?", body: "A named local Guide and a small cap. A minibus and a rota of drivers is a different product."},
                    {label: "What do I pay, to whom, and when?", body: "Transparent per-person pricing paid to the person leading you. Deposits to a third party need refund terms in writing."},
                    {label: "What do you do if an animal is disturbed?", body: "A good operator has an answer: back off, stop, move on. A bad one has never thought about it."}
                ]
            },
            {
                title: "What an AnimalDex listing does and does not guarantee",
                paragraphs: [
                    "AnimalDex listings are limited to approved Guides, public areas, and cash paid directly to the host. Guides have met wild-collection gates and passed a human review; categories are defined in the app with the ethics built in, such as herping without handling and night walks with lights used to look, not to lure; every listing shows a general area, a duration, a guest cap, and a per-person price. Wildlife Guides is a beta programme.",
                    "That still does not make every outing perfect, and it does not promise sightings. Read the copy, ask the questions above in the request thread, and treat the answers as the real listing. Payment is cash on the day; AnimalDex does not collect it and does not operate the experience."
                ],
                inlineLinks: [guidePaymentsLink, ethicalGuideLink],
                pullQuote: "If the animal is in a human's hands, the experience has already failed."
            },
            {
                title: "Do not invent a city page in your head",
                paragraphs: [
                    "If no experience is published for the place you are visiting, there is not a hidden AnimalDex tour there. The directory only shows what approved Guides have actually listed, and empty regions stay empty until someone local lists one. Use the app for your own sightings, or wait until a Guide lists one. Outside the app, apply the table and the questions above to whatever is on offer, and be willing to walk away with no booking at all."
                ],
                inlineLinks: [earnRelatedLinks.marketplace]
            },
            {
                title: "Log what you actually saw",
                paragraphs: [
                    "A travel log of real sightings is the honest souvenir. Take live captures in AnimalDex from where you stood, let the app identify the species, and keep the time and the general place; captures are live in-app photos, so a gallery upload later is not the same record. A sloth seen high in a cecropia from a trail and a turtle seen surfacing from a boat are better entries than any held-animal selfie, and they are the only kind you will not regret."
                ],
                inlineLinks: [
                    {text: "Best types of wildlife activities", slug: "best-types-of-wildlife-activities-for-animal-lovers", href: blogHrefs.wildlifeActivities},
                    photoCompanionLink
                ]
            }
        ],
        faq: [
            {
                question: "What is an ethical wildlife experience?",
                answer: "One where wild animals are watched at a distance, in their own habitat, at the time they are naturally active, with no feeding, calling in, handling, or riding. The product is knowledge and patience, sightings are described as possible rather than guaranteed, and a small group is led by a named local guide on public or permitted ground."
            },
            {
                question: "Is it OK to hold a sloth for a photo?",
                answer: "No. Sloths offered for selfies are taken from the wild, passed between strangers all day, and show stress in ways people do not read, so they seem calm when they are not. Many do not survive the trade for long. See sloths in trees from a trail with a Guide, and leave if anyone offers to hand you one."
            },
            {
                question: "How do I know if a wildlife tour is ethical before booking?",
                answer: "Ask whether anyone will touch, feed, or call the animals; where it happens and whether that is public or permitted; what is realistic this season; how big the group is; and what you pay to whom. Guarantees, photo-with offers, and feeding spots are the tells of a staged encounter. Short plain answers are the good sign."
            },
            {
                question: "Can I touch or swim with sea turtles?",
                answer: "Watch, yes; touch or chase, no. Green sea turtles are listed as Endangered, and touching, riding, or crowding them is illegal in many places and harmful everywhere. Keep your distance in the water, never block a turtle's path to the surface, and use no white light or flash on a nesting beach."
            },
            {
                question: "Does AnimalDex have wildlife tours in every city?",
                answer: "No. The directory shows only experiences that approved Guides have actually published, so many places have none. There is no hidden listing for a city that shows nothing. Use the app for your own sightings there, and apply the same ethical checks to any operator you find elsewhere."
            }
        ],
        sources: [
            {label: "IUCN Red List: Green turtle (Chelonia mydas)", href: "https://www.iucnredlist.org/species/4615/11037468"},
            {label: "World Animal Protection: Wildlife selfies and the tourism trade", href: "https://www.worldanimalprotection.org/"},
            {label: "NOAA Fisheries: Marine life viewing guidelines", href: "https://www.fisheries.noaa.gov/topic/marine-life-viewing-guidelines"},
            {label: "Britannica: Slow loris", href: "https://www.britannica.com/animal/slow-loris"}
        ]
    }),
    earnBlogPost({
        slug: "best-types-of-wildlife-activities-for-animal-lovers",
        canonicalUrl: `https://animaldex.app${blogHrefs.wildlifeActivities}`,
        title: "Best Types of Wildlife Activities for Animal Lovers",
        description:
            "Birding, herping, night walks, macro, shore time, and photography outings compared: what each is like, when to go, what to bring, and which listings match.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("best-types-of-wildlife-activities-for-animal-lovers"),
        readingMinutes: 7,
        tags: ["wildlife-experiences"],
        searchIntents: ["wildlife activities", "wildlife trips", "animal spotting tour", "nature guide", "types of wildlife watching", "wildlife activities for animal lovers"],
        speciesSlugs: ["monarch-butterfly", "sanderling", "hermit-crab", "eurasian-oystercatcher"],
        relatedSlugs: ["how-to-choose-a-local-wildlife-guide", "birding-guide-vs-going-alone", "what-happens-on-a-night-wildlife-walk"],
        tableOfContents: [
            "Pick the activity, then the listing",
            "Seven kinds of outing compared",
            "Birding and general wildlife walks",
            "Herping and night walks",
            "Insects and macro",
            "Marine shore time",
            "Wildlife photography",
            "What AnimalDex can and cannot show you"
        ],
        sections: [
            {
                title: "Pick the activity, then the listing",
                paragraphs: [
                    "Animal lovers do not all want the same morning. Birding is ears and sky. Herping is edges and patience. Night walks are frogs and insects. Macro is the path you already walked, taken slowly. Marine listings on AnimalDex are shore and tide line, not a boat AnimalDex operates. Photography is any of the above with a longer lens and a stricter ethic.",
                    "Choosing the activity first makes the listing easy to judge, because each kind of outing has its own right time, right kit, and realistic cast. AnimalDex organises Wildlife Guide experiences into seven categories for exactly this reason, and a listing in the wrong category for what you want is a listing to skip."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            },
            {
                title: "Seven kinds of outing compared",
                paragraphs: [
                    "The seven AnimalDex Guide categories, with the plain version of what each one is."
                ],
                table: {
                    columns: ["Category", "Best time", "Bring", "Realistic cast"],
                    rows: [
                        {cells: ["General wildlife", "Early morning or late afternoon, any season", "Binoculars, walking shoes", "Birds, a mammal or two, whatever is active that day"]},
                        {cells: ["Birding", "First two hours after dawn; falling tide on estuaries", "8x42 binoculars, field guide or app", "Local songbirds, waders, wildfowl by season; migrants in spring and autumn"]},
                        {cells: ["Herping", "Dusk and night, mild wet evenings in spring and summer", "Red-mode headlamp, closed shoes, clean boots", "Frogs, newts, a lizard or gecko; a snake if it is warm enough"]},
                        {cells: ["Insects / macro", "Warm, still, sunny late mornings; dusk for moths", "Phone or macro lens, patience", "Butterflies, bees, hoverflies, dragonflies at water"]},
                        {cells: ["Marine wildlife", "Low tide, especially spring tides; dawn for shorebirds", "Grippy shoes, tide table, no bucket", "Crabs, anemones, shorebirds, seals or turtles at a distance where they occur"]},
                        {cells: ["Wildlife photography", "Golden hour, dawn or dusk", "Long lens, muted clothing", "Wetland birds mostly; mammals by season and luck"]},
                        {cells: ["Night wildlife", "Mild, still, dark nights", "Red-mode headlamp, warm layer", "Owls heard, bats, frogs, moths, a fox or hedgehog"]}
                    ]
                }
            },
            {
                title: "Birding and general wildlife walks",
                paragraphs: [
                    "The birding category is written for people who already carry binoculars: dawn choruses, wetlands, and countryside edges. It rewards early starts, because song peaks in the first hour after sunrise in spring, and it rewards tide tables on the coast. A general wildlife walk is the broad version, for birds, mammals, reptiles, and whatever is active that day; it suits families and first-timers who do not yet have a favourite group.",
                    "Both are mostly standing still and looking. Expect to learn calls, where to scan, and what the habitat is telling you. Neither can promise a species."
                ],
                inlineLinks: [
                    {text: "Birding guide vs going alone", slug: "birding-guide-vs-going-alone", href: blogHrefs.birdingGuideVsAlone},
                    {text: "How to choose a local wildlife guide", slug: "how-to-choose-a-local-wildlife-guide", href: blogHrefs.chooseLocalGuide}
                ]
            },
            {
                title: "Herping and night walks",
                paragraphs: [
                    "Herping is evening and night walks for frogs, snakes, and other reptiles, without handling. It is the most weather-dependent category: reptiles and amphibians are ectotherms, so a mild wet night in spring is busy and a cold dry one is quiet. Night wildlife is the broader after-dark version, where owls are heard, bats cross the last light, and lights are used to look, not to lure. Both need a red-mode headlamp, closed shoes, and the willingness to stand in the dark for twenty minutes while your eyes adapt."
                ],
                inlineLinks: [
                    {text: "What to expect on a guided herping trip", slug: "what-to-expect-on-a-guided-herping-trip", href: blogHrefs.guidedHerpingTrip},
                    {text: "What happens on a night wildlife walk", slug: "what-happens-on-a-night-wildlife-walk", href: blogHrefs.nightWildlifeWalk}
                ]
            },
            {
                title: "Insects and macro",
                paragraphs: [
                    "Insects and macro is the category for slow looks at butterflies, bees, and smaller wildlife along public paths. It is the cheapest activity in kit and the richest in species: a sunny bank in June holds more kinds of animal than a whole wetland holds birds. A monarch butterfly, with a wingspan of around 9 to 10 cm, is the showpiece in North America, and the eastern population's autumn migration to central Mexico covers up to roughly 4,000 km, so a late-summer macro walk on a flowering verge can catch migrants fuelling up. Dragonflies patrol water on hot afternoons; moths need a dusk walk or a licensed light trap, which is a survey, not a tour.",
                    "The ethic is the same as everywhere: no netting for photos, no chilling insects to pose them, and no trampling the flower bank to get closer."
                ],
                speciesSlugs: ["monarch-butterfly"],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/best-types-of-wildlife-activities-for-animal-lovers/monarch-butterfly-flower.webp",
                        alt: "Monarch butterfly with wings open on a purple flower",
                        width: 1400,
                        height: 1050,
                        caption: "A monarch feeding on verbena. A phone from arm's length is enough; nobody needs to net it. Photo: Shuvaev, CC BY 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Marine shore time",
                paragraphs: [
                    "Marine wildlife on AnimalDex means shorelines, tide lines, and publicly accessible coast, not boat charters AnimalDex operates. The whole activity runs on the tide table: the lowest tides, around new and full moon, expose rock pools and mud that are underwater most of the month. On rocky shores that means anemones, crabs, hermit crabs in borrowed shells, and small fish in pools. On sand and mud it means shorebirds: sanderlings running the wave line, oystercatchers working the mussel beds, and whatever waders the season brings.",
                    "Rules for the shore: turn a rock back the way you found it, keep nothing, do not move animals between pools, and give roosting shorebirds a wide berth, because every flush costs them energy they need for migration. Where seals or turtles occur, they are watched from a distance, never approached."
                ],
                speciesSlugs: ["sanderling", "hermit-crab", "eurasian-oystercatcher"],
                media: {
                    type: "gallery",
                    title: "Shore listings: pools at low water, birds at the tide line",
                    images: [
                        {
                            src: "/images/blog/best-types-of-wildlife-activities-for-animal-lovers/tide-pool-shore.webp",
                            alt: "A rock pool on a rocky shore at low tide",
                            width: 1024,
                            height: 680,
                            caption: "A rock pool exposed at low water. Photo: Philip Halling, CC BY-SA 2.0, via Wikimedia Commons."
                        },
                        {
                            src: "/images/blog/best-types-of-wildlife-activities-for-animal-lovers/sanderlings-shoreline.webp",
                            alt: "A flock of sanderlings feeding along the tide line",
                            width: 1400,
                            height: 933,
                            caption: "Sanderlings feeding at the wave line. Photo: Rudolphous, CC BY-SA 4.0, via Wikimedia Commons."
                        }
                    ]
                }
            },
            {
                title: "Wildlife photography",
                paragraphs: [
                    "Photography listings are field time for people who want identification context while they shoot. They overlap with every other category and add a stricter ethic, because the pressure to get the frame is what leads to baited perches and playback. Judge them by the same facts: public area, light-tied start time, small guest cap, honest seasonal outlook, and a Guide who talks about behaviour, not just settings."
                ],
                inlineLinks: [
                    {text: "Wildlife photography tours: what to look for", slug: "wildlife-photography-tours-what-to-look-for", href: blogHrefs.photographyToursLookFor},
                    photoCompanionLink
                ],
                pullQuote: "Pick the morning you want first. The right listing is then obvious, and the wrong one is easy to skip."
            },
            {
                title: "What AnimalDex can and cannot show you",
                paragraphs: [
                    "The live directory only shows published, approved experiences. Empty categories stay empty until a Guide lists one. That is better than a fake best-of city list, and it means the absence of a listing is information, not a bug. Every listing shows a general public area, duration, guest cap, and a per-person price paid in cash on the day to the Guide; requests are not instant bookings, and AnimalDex does not operate any outing. Wildlife Guides is a beta programme.",
                    "Whichever activity you pick, log what you actually see as live captures in the app, with the time and the general place. If you want to lead the outing instead of joining one, that is a different page."
                ],
                inlineLinks: [
                    {text: "Become an AnimalDex Wildlife Guide", slug: "become-a-wildlife-guide", href: earnPaths.becomeGuide},
                    guidePaymentsLink
                ]
            }
        ],
        faq: [
            {
                question: "What are the best wildlife activities for beginners?",
                answer: "A general wildlife walk or a shore walk at low tide are the easiest starts: no special kit, daylight, and plenty to see at close range. Birding at dawn is next, with a pair of 8x42 binoculars. Herping and night walks need a red-mode headlamp and more patience but are the most memorable once you have tried the others."
            },
            {
                question: "What is the difference between birding and a general wildlife walk?",
                answer: "Birding is focused: dawn starts, wetlands and edges, binoculars, and calls, written for people who already own binoculars. A general wildlife walk covers birds, mammals, reptiles, and whatever is active that day at a gentler pace, and suits families and first-timers. Neither can promise a particular species."
            },
            {
                question: "What time of day is best for wildlife watching?",
                answer: "The first two hours after dawn for birds and mammals, dusk and the first dark hours for owls, bats, frogs, and most reptiles, and low tide for the shore regardless of clock time. Warm sunny late mornings suit butterflies and dragonflies. A good listing's start time matches its category."
            },
            {
                question: "Does AnimalDex run boat trips or safaris?",
                answer: "No. AnimalDex does not operate any outing. Marine listings cover shorelines, tide lines, and publicly accessible coast led by approved local Guides, not boat charters. All experiences are on public ground with a guest cap, and you pay the Guide in cash on the day."
            },
            {
                question: "What should I bring on a wildlife activity?",
                answer: "It depends on the category: binoculars for birding, a red-mode headlamp and closed shoes for herping and night walks, grippy shoes and a tide table for the shore, a long lens for photography, and a charged phone for everything so you can log live captures. Muted clothing and a warm layer help on every outing."
            }
        ],
        sources: [
            {label: "Cornell Lab of Ornithology: Sanderling", href: "https://www.allaboutbirds.org/guide/Sanderling/overview"},
            {label: "Monarch Watch: Monarch biology and migration", href: "https://monarchwatch.org/"},
            {label: "NOAA Tides and Currents", href: "https://tidesandcurrents.noaa.gov/"},
            {label: "Leave No Trace: The 7 Principles", href: "https://lnt.org/why/7-principles/"}
        ]
    })
];
