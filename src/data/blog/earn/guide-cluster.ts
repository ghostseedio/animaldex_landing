import {blogHrefs, earnFacts, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import {contentThumb} from "@/data/content-thumbnails";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";
const updatedAt = "2026-10-07";

const guidePaymentsLink = {
    text: "How buying a Wildlife Guide works",
    slug: "how-do-wildlife-guide-bookings-and-payments-work",
    href: supportArticleHrefs.guidePayments
};

const sideIncomeLink = {
    text: "Turning local wildlife knowledge into a guiding side income",
    slug: "how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income",
    href: blogHrefs.guidingSideIncome
};

export const guideEarnBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-to-become-a-wildlife-guide-with-animaldex",
        canonicalUrl: `https://animaldex.app${blogHrefs.becomeGuideHowTo}`,
        title: "How to Become a Wildlife Guide With AnimalDex",
        description:
            `There is no application. Each place where you log ${earnFacts.guideMinSpecies} or more wild species, with a public photo, becomes a virtual guide you can check, price and share.`,
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-to-become-a-wildlife-guide-with-animaldex"),
        readingMinutes: 6,
        tags: ["wildlife-guides", "earning"],
        searchIntents: [
            "become wildlife guide",
            "AnimalDex wildlife guide",
            "how to become a wildlife guide",
            "virtual wildlife guide",
            "sell a wildlife guide to a place"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "can-birders-make-money-as-local-guides",
            "what-makes-a-great-ethical-wildlife-guide",
            "how-to-start-offering-local-birding-experiences"
        ],
        tableOfContents: [
            "A guide made from your sightings, not a tour",
            "How a place becomes a guide",
            "Check what AnimalDex wrote",
            "Price, sharing and privacy",
            "When someone buys your guide",
            "What to expect from the money"
        ],
        sections: [
            {
                title: "A guide made from your sightings, not a tour",
                paragraphs: [
                    "AnimalDex Wildlife Guides are virtual. Each place where you have logged wild animals can become a guide that other explorers pay a small fee for: your notes on every animal, a direct chat with you to ask anything, and introductions to local people you met, where they can help. You are not hired, you do not lead anyone anywhere, and nobody is promised an animal.",
                    "A virtual guide is advice from someone who has been there, not a tour. The author is not with the buyer, and wildlife is never guaranteed. Buying is coming soon; until then your guides are ready for you to check and edit, and explorers will be able to find them when guides launch."
                ],
                inlineLinks: [earnRelatedLinks.guide, earnRelatedLinks.marketplace]
            },
            {
                title: "How a place becomes a guide",
                paragraphs: [
                    "There is no application form and no review queue to join. Capture wild animals with location on, and AnimalDex groups your sightings by place. Pets, farm animals and zoo or aquarium animals are not part of a guide; it is built from wild animals you found yourself.",
                    `A place with ${earnFacts.guideMinSpecies} or more wild species, and a public photo, becomes a guide automatically. Places that are not there yet show on your profile as growing into guides, with how many more species each one needs.`
                ],
                table: {
                    columns: ["What you need", "Details"],
                    rows: [
                        {cells: ["Wild animals logged with location on", "Each wild capture with a location counts toward the place it was taken."]},
                        {cells: [`${earnFacts.guideMinSpecies} or more species at one place`, "Different species, not repeat sightings of the same animal."]},
                        {cells: ["A public photo", "A guide's photos and videos come from your public captures, so a place needs at least one."]},
                        {cells: ["Your location visible to others", "If your location is not public, nobody else can see your guides. Change who sees your locations in Settings to share them."]}
                    ]
                },
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-become-a-wildlife-guide-with-animaldex/guided-bird-walk-group.webp",
                        alt: "A small group of birdwatchers with binoculars looking up into trees on a guided walk",
                        width: 1400,
                        height: 941,
                        caption: "Birdwatchers on a morning walk. A virtual guide helps a visitor plan a morning like this; the author is not there with them. Photo: Department of the Interior. U.S. Fish and Wildlife Service. National Conservation Training Center. 10/1997-8888, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [earnRelatedLinks.guide]
            },
            {
                title: "Check what AnimalDex wrote",
                paragraphs: [
                    "AnimalDex writes the page from your sightings: a title, the place, a search summary, an about-this-place section, the best time to go, and every animal you found there with how rare it is. Each animal gets a draft note. Check the draft note for each animal, then add your own tips and the local people you met.",
                    "A good note says where in the area, what time of day, and anything that helped you find the animal. Only buyers read it. Threatened animals are different: don't share an exact spot or time for them; point buyers to a licensed local guide instead. Anything you write yourself is kept, and you can hide any animal or photo you would rather leave out."
                ],
                table: {
                    columns: ["Part of the guide", "Write this", "Not this"],
                    rows: [
                        {cells: ["Animal note", "Where in the area, what time of day, what helped you find it", "A promise the animal will be there"]},
                        {cells: ["About this place", "What the place is like and what a visitor should expect", "Superlatives and sighting guarantees"]},
                        {cells: ["Best time", "The months and hours you actually found animals", "Every month, just in case"]},
                        {cells: ["Local contacts", "People you met who are happy to be contacted: a boat captain, a ranger, a guesthouse", "Anyone who has not agreed to it"]},
                        {cells: ["Notes for buyers", "Getting there, best spots to start, what to bring", "A nest, den or roost of a threatened animal"]}
                    ]
                },
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-become-a-wildlife-guide-with-animaldex/bird-guide-scope.webp",
                        alt: "A local bird guide walking with a spotting scope on a tripod over his shoulder and binoculars round his neck",
                        width: 751,
                        height: 1400,
                        caption: "A local bird guide with a spotting scope. Someone like this can be one of your guide's local contacts, but only if they are happy to be contacted. Photo: PJeganathan, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["common-kingfisher", "mallard", "great-egret"]
            },
            {
                title: "Price, sharing and privacy",
                paragraphs: [
                    "Keep the automatic price or choose your own. The automatic price is set from how many animals the guide has and how rare they are. Either way it is a small real-money fee for your notes, your answers and any introductions you make. Credits are not used.",
                    "One switch on your profile shares all your guides. With it on, new places become guides automatically; with it off, every guide is hidden and new ones start hidden. You can also hide a single guide, edit any of it, or delete it. A deleted guide disappears for everyone, and AnimalDex won't make a new guide for that place. Exact spots stay private."
                ]
            },
            {
                title: "When someone buys your guide",
                paragraphs: [
                    "The buyer gets your notes on every animal, a direct chat with you, and introductions to the local people in your guide. Reply to them within 48 hours. Buyers can ask for a refund within 7 days.",
                    "Any local guide or operator you introduce is independent of AnimalDex, and the buyer agrees terms with them directly. AnimalDex does not arrange outings, and your guide never promises a sighting."
                ],
                cards: [
                    {
                        label: "Before you share",
                        body: "Read every draft note. Rewrite the ones that are vague, hide animals or photos you would rather leave out, and check the threatened animals give no spot or timing."
                    },
                    {
                        label: "When a buyer writes",
                        body: "Answer within 48 hours. The questions people ask are the best guide to what your notes are missing, so add the answer to the guide as well."
                    },
                    {
                        label: "After the sale",
                        body: "Your share of the sale is released to Earnings 8 days after the purchase, in real money."
                    }
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-become-a-wildlife-guide-with-animaldex/ranger-leads-walk.webp",
                        alt: "A park ranger leads a line of visitors along a gravel trail across open tundra",
                        width: 1400,
                        height: 948,
                        caption: "A ranger-led walk on a marked trail. Local guides a buyer meets through your introductions are independent of AnimalDex. Photo: NPS Photo / Emily Mesner, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [guidePaymentsLink]
            },
            {
                title: "What to expect from the money",
                paragraphs: [
                    "Your share of each sale is released to Earnings 8 days after the purchase, in real money. Credits are never part of it, and buying Credits never turns into Earnings.",
                    "Nobody at AnimalDex will tell you what you will earn, because nobody knows. A guide to a place people want to visit, with honest notes and quick answers, is more useful than one that is not. The rest depends on the place and on you."
                ],
                inlineLinks: [sideIncomeLink, earnRelatedLinks.earn]
            }
        ],
        faq: [
            {
                question: "Do I have to apply to become an AnimalDex Wildlife Guide?",
                answer: `No. Each place where you log ${earnFacts.guideMinSpecies} or more wild species with location on, with a public photo, becomes a virtual guide automatically. You can check it, edit it, price it, hide it or delete it, and one switch turns sharing off for all your guides.`
            },
            {
                question: "Do I have to meet buyers or lead a tour?",
                answer: "No. A Wildlife Guide on AnimalDex is virtual: your notes on every animal, a direct chat with you, and introductions to local people you met. It is advice from someone who has been there, not a tour, and the author is not with the buyer."
            },
            {
                question: "How does AnimalDex pay me for a guide?",
                answer: "Buying is coming soon. When someone buys your guide, your share of the sale is released to Earnings 8 days after the purchase, in real money. Buyers can ask for a refund within 7 days, and Credits are not used."
            },
            {
                question: "Can buyers find my exact spots?",
                answer: "Exact spots stay private. Your notes say where in the area and when, and only buyers read them. For threatened animals, no spot or timing is shared; point buyers to a licensed local guide instead."
            },
            {
                question: "How much can a Wildlife Guide earn through AnimalDex?",
                answer: "There is no figure to quote. It depends on the place, how many people want to visit it, the price and how helpful your notes and answers are. Treat it as a small return on wildlife you were going to find anyway, not as a salary."
            }
        ],
        sources: [
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"},
            {label: "U.S. National Park Service: Watching Wildlife", href: "https://www.nps.gov/subjects/watchingwildlife/index.htm"},
            {label: "Cornell Lab of Ornithology", href: "https://www.birds.cornell.edu/"}
        ]
    }),
    earnBlogPost({
        slug: "can-birders-make-money-as-local-guides",
        canonicalUrl: `https://animaldex.app${blogHrefs.birdersGuideIncome}`,
        title: "Can Birders Make Money as Local Guides?",
        description:
            "Yes, if people will pay for local knowledge and you stay legal. How local birding guides actually earn, how to price a walk, and where AnimalDex fits.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("can-birders-make-money-as-local-guides"),
        readingMinutes: 6,
        tags: ["wildlife-guides", "birding"],
        searchIntents: [
            "can birders make money",
            "local birding guide income",
            "bird watching guide jobs",
            "how much do birding guides charge",
            "become a bird guide",
            "birding side income"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "how-to-start-offering-local-birding-experiences",
            "how-to-become-a-wildlife-guide-with-animaldex",
            "birding-guide-vs-going-alone"
        ],
        tableOfContents: [
            "The short answer",
            "The market is already there",
            "How local birding guides actually earn",
            "Pricing a walk",
            "Where AnimalDex helps, and where it stops",
            "Start smaller than a tour company",
            "Staying legal and insured"
        ],
        sections: [
            {
                title: "The short answer",
                paragraphs: [
                    "Yes, some birders earn money guiding, and most of them do it part-time and seasonally. The ones who do it well are selling three things: they know where birds are at a given hour in a given month, they can put a name to a call most people would walk past, and they are reliable enough to meet strangers at 05:30. None of that requires a tour company, a vehicle or a website.",
                    "What it does require is honesty about what you can offer. A two-hour walk on public paths with a cap of six guests is a product. A guaranteed eagle is a lie, and the guests who paid for it will say so in public."
                ]
            },
            {
                title: "The market is already there",
                paragraphs: [
                    "Dawn-chorus walks, wetland mornings, shorebird high tides and migration weekends are established products in most countries with a birding culture. Spring migration on the Great Lakes draws tens of thousands of visitors to a single boardwalk in May. Crane stopovers on the Platte River and in New Mexico fill hotels in March and November. Reserves in the UK, India, Spain and Costa Rica all have local guides who earn from the same walks they would do unpaid.",
                    "The hard part was never inventing birding. It is trust and discovery: a visitor with two free mornings has no way to tell a careful local from a stranger with binoculars. That gap is filled by reputation: reserve event lists, local clubs, past guests and the advice of people who have already been."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/can-birders-make-money-as-local-guides/birders-magee-marsh.webp",
                        alt: "A crowd of birdwatchers with binoculars on a wooden boardwalk through spring woodland at Magee Marsh",
                        width: 1400,
                        height: 957,
                        caption: "Spring migration at Magee Marsh, Ohio. Demand for local knowledge peaks in a few weeks each year. Photo: Unknown authorUnknown author or not provided, Public domain, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["sandhill-crane", "red-winged-blackbird", "osprey"]
            },
            {
                title: "How local birding guides actually earn",
                paragraphs: [
                    "Earnings come from a small number of formats, and each has a natural ceiling. The table is a frame for thinking, not a promise. Your numbers depend on your area, your season and how often anyone asks.",
                    "Whatever the format, the money is per person, per outing, with a group minimum. Most part-time guides run between one and four outings a week in season and none at all for months. Treat it as being paid for mornings you would have spent outside anyway."
                ],
                table: {
                    columns: ["Format", "Typical group", "Time cost", "Earnings logic"],
                    rows: [
                        {cells: ["Dawn walk, public paths", "2 to 6", "2 to 3 hours plus travel", "Price per person × guests, minus fuel and your early start"]},
                        {cells: ["Half-day wetland or coast", "2 to 6", "4 to 5 hours", "Higher price per person; weather cancellations hurt more"]},
                        {cells: ["Private one-to-one", "1 or 2", "Flexible", "Highest per-person price, lowest total; often target-species driven"]},
                        {cells: ["Repeat local regulars", "4 to 8", "Monthly", "Lower price, reliable; the base of most part-time guide income"]},
                        {cells: ["Migration weekend", "6 to 8", "Two or three mornings", "Your best weekend of the year; also everyone else's"]}
                    ]
                }
            },
            {
                title: "Pricing a walk",
                paragraphs: [
                    "Start from costs, not from what feels polite. Add your travel, any parking or reserve entry you pay on the guests' behalf, the cost of a cancelled morning, and the hours including the briefing emails. Divide by a realistic group, not the maximum. Then check that figure against what a local guided activity of similar length costs in your area, such as a kayak session or a heritage walk. Guests compare against those, not against other birders.",
                    "Set a minimum group or a minimum charge. A single guest at a per-person price that assumed four will not cover your morning."
                ],
                table: {
                    columns: ["Factor", "How it shows up in the price"],
                    rows: [
                        {cells: ["Your time, including planning and messages", "The largest line. Count the early alarm as part of it."]},
                        {cells: ["Travel and parking", "Fixed per outing, so it argues for a group minimum"]},
                        {cells: ["Weather cancellations", "Spread across the season; a coastal walk in autumn loses more days than a woodland one"]},
                        {cells: ["Kit guests use", "A scope on a tripod, loaner binoculars, a laminated list"]},
                        {cells: ["Insurance and permits", "An annual cost divided across expected outings"]},
                        {cells: ["Local comparison", "A sanity check against other guided activities of similar length"]}
                    ]
                }
            },
            {
                title: "Where AnimalDex helps, and where it stops",
                paragraphs: [
                    "AnimalDex does not list or book guided walks. Its Wildlife Guides are virtual: each place where you log 3 or more wild species, with a public photo, becomes a guide that visitors will be able to buy for a small fee. They get your notes on every bird you found there, a direct chat with you, and introductions to local people you met, where they can help.",
                    "That is advice, not a tour. If you also lead walks, the guided walk itself is your own business, arranged and paid directly with your guests. AnimalDex does not organise outings, collect payment for them, verify your permits, insure you, or promise birds. Buying a virtual guide is coming soon.",
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/can-birders-make-money-as-local-guides/bird-watching-with-ranger.webp",
                        alt: "A ranger points upward while a young guest beside her looks through binoculars during a bird walk",
                        width: 1400,
                        height: 933,
                        caption: "Pointing someone at a bird they would have missed is the whole product. Photo: NPS, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [earnRelatedLinks.guide, earnRelatedLinks.marketplace, guidePaymentsLink]
            },
            {
                title: "Start smaller than a tour company",
                paragraphs: [
                    "A two-hour public-path walk for a handful of guests is a product. A minibus, a packed lunch and a guaranteed eagle is a different business with vehicle insurance, food hygiene and a refund policy, and it is a bad promise on top. Start with the walk you already do, at the time you already do it, and let the guest cap stay low until you have run it with strangers a few times.",
                    "Small groups are also better birding. Six people can stop on a path without blocking it, stay quiet at a reedbed and all get on a scope within a minute. Twelve cannot."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/can-birders-make-money-as-local-guides/birders-wetland-binoculars.webp",
                        alt: "Three birders in sun hats scanning a wetland with binoculars and a spotting scope on a tripod",
                        width: 1280,
                        height: 838,
                        caption: "A scope, two pairs of binoculars and a wetland edge. Nothing about this needs a vehicle fleet. Photo: Unknown authorUnknown author or not provided, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    {text: "How to start offering local birding experiences", slug: "how-to-start-offering-local-birding-experiences", href: blogHrefs.startBirdingExperiences},
                    {text: "Birding guide vs going alone", slug: "birding-guide-vs-going-alone", href: blogHrefs.birdingGuideVsAlone}
                ]
            },
            {
                title: "Staying legal and insured",
                paragraphs: [
                    "Paid guiding is a commercial activity, and land managers treat it as one. National parks and many reserves require a commercial-use permit for guided groups even on public trails. Some countries license nature guides outright. Private land needs the owner's permission whether or not money changes hands. Public liability insurance is normal practice and is sometimes a permit condition.",
                    "Income is taxable where you live, and it is your job to record it. Keep your own record of what each walk brought in; nobody else will do it for you."
                ]
            }
        ],
        faq: [
            {
                question: "How much do birding guides charge for a walk?",
                answer: "It varies by country and format, and there is no standard rate. Most part-time guides price per person with a group minimum, starting from their real costs (travel, time, cancellations, insurance) and checking the figure against other guided activities of similar length nearby. A private one-to-one costs more per person than a six-person dawn walk."
            },
            {
                question: "Can you make a living as a bird guide?",
                answer: "A few people do, usually by combining international tours, writing and a strong reputation built over years. For most birders guiding is part-time and seasonal: a few outings a week in spring and autumn and nothing in between. Plan for it as a side income tied to the months when birds and visitors are both present."
            },
            {
                question: "Do I need a licence to lead paid birding walks?",
                answer: "Often, yes. National parks and many reserves require a commercial-use permit for paid groups, some countries license nature guides, and private land needs the owner's permission. Rules differ by site, so ask the land manager before you take paying guests."
            },
            {
                question: "What does an AnimalDex Wildlife Guide give a birder?",
                answer: "A way to share what you know about a place without leading anyone there. Each place where you log 3 or more wild species, with a public photo, becomes a virtual guide: your notes on every bird, a chat with you, and introductions to local people you met. Buying is coming soon, the fee is a small real-money amount, and Credits are not used. AnimalDex does not list or book in-person walks."
            }
        ],
        sources: [
            {label: "Cornell Lab of Ornithology", href: "https://www.birds.cornell.edu/"},
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"},
            {label: "National Audubon Society", href: "https://www.audubon.org/"}
        ]
    }),
    earnBlogPost({
        slug: "how-to-start-offering-local-birding-experiences",
        canonicalUrl: `https://animaldex.app${blogHrefs.startBirdingExperiences}`,
        title: "How to Start Offering Local Birding Experiences",
        description:
            "Pick a public route, a duration, a guest cap and an honest price. How to scout, time a walk by season and tide, brief guests and run your first walk.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-to-start-offering-local-birding-experiences"),
        readingMinutes: 7,
        tags: ["wildlife-guides", "birding"],
        searchIntents: [
            "start birding tours",
            "offer birdwatching walks",
            "local birding experience",
            "how to lead a bird walk",
            "plan a guided birding walk",
            "birding walk group size"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "can-birders-make-money-as-local-guides",
            "how-to-become-a-wildlife-guide-with-animaldex",
            "what-makes-a-great-ethical-wildlife-guide"
        ],
        tableOfContents: [
            "Write the outing you already do",
            "Scout the route three times before you sell it",
            "Timing: dawn, season and tide",
            "Group size, pace and the briefing",
            "Weather, cancellation and safety",
            "Keep meeting points private",
            "Where AnimalDex fits",
            "Your first three walks"
        ],
        sections: [
            {
                title: "Write the outing you already do",
                paragraphs: [
                    "If you already walk a reedbed edge at first light on Saturdays, that is the listing. Title, one-line pitch, what you actually do, the public area, the duration, the maximum guests and a price per person. Resist inventing a grander version for strangers. The walk you have done fifty times is the one you can run with three people asking questions, a late arrival and a squall at 07:10.",
                    "Describe the attention guests get, not the birds. Two hours on a known loop where you stop at four points, put birds on a scope and explain calls is a product. A list of species is a hope."
                ]
            },
            {
                title: "Scout the route three times before you sell it",
                paragraphs: [
                    "Walk it once at the listed start time to measure the real duration with stops. Walk it once in bad weather to learn where the mud, the wind and the shelter are. Walk it once with a friend who is not a birder and time how long it takes them to get on a bird in a scope. The listing's duration and guest cap should come from those three walks, not from your solo pace.",
                    "Note the practical details guests will ask about: the nearest toilets, where cars can park without blocking a farm gate, whether the path floods on a spring tide, and where you can stand eight people without trampling the verge."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-start-offering-local-birding-experiences/dawn-wetland-mist.webp",
                        alt: "Golden mist rising off a wetland at sunrise with trees and reeds in silhouette",
                        width: 1400,
                        height: 788,
                        caption: "A wetland at first light. The half hour either side of sunrise is when song and movement peak, and when most dawn walks are listed to start. Photo: Ed Dunens, CC BY 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Timing: dawn, season and tide",
                paragraphs: [
                    "Birds keep schedules, and a listing that ignores them sells disappointment. In spring, songbirds sing most intensely from before sunrise to an hour or two after, which is why dawn walks exist. On estuaries, waders are pushed toward the shore as the tide rises, so the two hours before high water usually give the closest views, and at high water the birds gather on roosts. Raptors need thermals and are easier from mid-morning. Owls and nightjars are a dusk product.",
                    "Seasons matter as much as hours. Migration peaks in spring and autumn in temperate regions, winter brings wildfowl and roosts, and the breeding season brings song but also sensitivity around nests. Build one listing per season rather than one listing that claims everything."
                ],
                table: {
                    columns: ["Habitat", "Best window", "Why"],
                    rows: [
                        {cells: ["Woodland and hedgerow, spring", "30 minutes before sunrise to about two hours after", "Peak song; birds are vocal and visible before leaves close in"]},
                        {cells: ["Estuary and mudflat", "The two hours before high tide", "Rising water pushes waders closer; roosts form at high water"]},
                        {cells: ["Reedbed and marsh", "Dawn and dusk", "Rails and warblers call most at the edges of the day"]},
                        {cells: ["Open country and ridges", "Mid-morning to afternoon", "Thermals form and raptors soar"]},
                        {cells: ["Heath and clearing, summer", "Dusk into dark", "Nightjars and owls become active"]},
                        {cells: ["Wetlands, winter", "Late afternoon", "Wildfowl and roost flights gather before dark"]}
                    ]
                },
                speciesSlugs: ["northern-lapwing", "pied-avocet", "european-nightjar"]
            },
            {
                title: "Group size, pace and the briefing",
                paragraphs: [
                    "Six is a good cap for a walking birding group and eight is the practical maximum on a path. Beyond that, people at the back cannot hear you, the group spreads out across the trail, and the time to get everyone on a scope view goes past the bird's patience. Smaller groups are also what collectors expect from a local rather than a coach tour.",
                    "Send a short briefing the evening before: meeting point and time, how long you will be out, footwear, layers, whether there is a toilet, and your weather decision. On the morning, spend two minutes on how the walk works: stay behind the person pointing, keep voices low near water, ask anything. A group that knows the rules is easier to keep still."
                ]
            },
            {
                title: "Weather, cancellation and safety",
                paragraphs: [
                    "Birding in rain is possible; birding in a gale on an exposed sea wall is not, and a wet group with no birds is a bad review. Decide your cancellation rule before you list: for example, you call the walk by 20:00 the night before if the forecast shows sustained heavy rain or wind above a set speed, and you offer another date. If guests pay on the day, a cancelled walk simply does not happen; if they paid ahead, say how you refund or rebook. Put the rule in the listing so nobody has to argue about it.",
                    "You are meeting strangers outdoors, often before daylight. Tell someone where you will be, carry a phone and a small first-aid kit, know where the nearest road access is on the route, and keep the group together on the walk back. If a guest is struggling, shorten the route rather than split the group."
                ]
            },
            {
                title: "Keep meeting points private",
                paragraphs: [
                    "Advertise a general area, such as a town or a reserve, and share the exact meeting point only with people you have agreed to take. That protects you from being met by someone you did not expect, and it protects the site: a published pin at a roost or a nest draws people who are not with a guide."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-start-offering-local-birding-experiences/birders-boardwalk.webp",
                        alt: "A wooden boardwalk curving through a marsh of tall reeds and open water under a cloudy sky",
                        width: 1400,
                        height: 1050,
                        caption: "Marsh boardwalk at Point Pelee, Ontario. A route like this is easy to describe once a guest is confirmed and hard to overcrowd. Photo: Ken Lund from Reno, Nevada, USA, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex does not list or book guided walks, so the walk itself stays your own business, arranged and paid directly with your guests. What AnimalDex does is turn your sightings into a virtual guide. Each place where you log 3 or more wild species, with a public photo, becomes a guide that visitors will be able to buy for a small fee: your notes on every bird, a direct chat with you, and introductions to local people you met.",
                    "It is advice, not a tour, and it never promises a bird. Buying is coming soon, and Credits are not used."
                ],
                inlineLinks: [
                    earnRelatedLinks.guide,
                    earnRelatedLinks.marketplace,
                    {text: "How to become a Wildlife Guide with AnimalDex", slug: "how-to-become-a-wildlife-guide-with-animaldex", href: blogHrefs.becomeGuideHowTo}
                ]
            },
            {
                title: "Your first three walks",
                paragraphs: [
                    "Three outings turn a draft listing into a real one."
                ],
                cards: [
                    {
                        label: "Walk one: your patch, friends of friends",
                        body: "Run the exact listed route at the listed time with two or three people who will tell you the truth. Time it with stops. Note which points worked and where everyone got cold."
                    },
                    {
                        label: "Walk two: first strangers",
                        body: "First strangers. Send the briefing the night before, arrive ten minutes early, start with the two-minute rules talk. Afterwards write down every question you could not answer."
                    },
                    {
                        label: "Walk three: the corrected listing",
                        body: "Adjust the duration, guest cap, start time and price to match walks one and two. Add the cancellation rule and the kit list to the listing text. Now it is a product."
                    }
                ]
            }
        ],
        faq: [
            {
                question: "How many people should be on a guided bird walk?",
                answer: "Six is a comfortable cap and eight is the practical maximum for a walking group on a path. Larger groups spread out, cannot hear the guide, and take too long to share a scope view before the bird moves. Smaller groups are quieter at water and easier to keep safe on the walk back."
            },
            {
                question: "What time should a birding walk start?",
                answer: "For songbirds in spring, about 30 minutes before sunrise, because song peaks around dawn and fades through the morning. On estuaries the best window is the two hours before high tide, when rising water pushes waders closer. Raptors are easier mid-morning once thermals form, and owls and nightjars are a dusk walk."
            },
            {
                question: "What should I do if the weather is bad on the day of a walk?",
                answer: "Decide a cancellation rule before you list and put it in the listing: for example, you call the walk by the evening before if the forecast shows sustained heavy rain or strong wind, and you offer a new date. If guests pay on the day, a cancelled walk involves no refund; if they paid ahead, refund or rebook them. Light rain is usually fine; exposed coast in a gale is not."
            },
            {
                question: "Can I list a birding walk on AnimalDex?",
                answer: "No. AnimalDex does not list or book in-person walks. Your sightings can become a virtual guide instead: each place where you log 3 or more wild species, with a public photo, becomes a guide with your notes on every bird, a chat with you, and introductions to local people you met. Buying is coming soon."
            }
        ],
        sources: [
            {label: "Cornell Lab of Ornithology: All About Birds", href: "https://www.allaboutbirds.org/"},
            {label: "NOAA Tides and Currents", href: "https://tidesandcurrents.noaa.gov/"},
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"}
        ]
    }),
    earnBlogPost({
        slug: "how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences",
        canonicalUrl: `https://animaldex.app${blogHrefs.herpersGuide}`,
        title: "How Herpers Can Turn Local Knowledge Into Guided Walks",
        description:
            "Night herping walks can be offered if you stay legal, skip handling and never promise a snake. Scouting, lights, chytrid hygiene, group size and pricing.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences"),
        readingMinutes: 8,
        tags: ["wildlife-guides", "herping"],
        searchIntents: [
            "herping guide",
            "night herping tour",
            "reptile walking guide",
            "how to lead a herping walk",
            "guided amphibian walk",
            "herping ethics no handling"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "what-makes-a-great-ethical-wildlife-guide",
            "what-to-expect-on-a-guided-herping-trip",
            "what-happens-on-a-night-wildlife-walk"
        ],
        tableOfContents: [
            "Herping is easy to do badly",
            "What a good night walk looks like",
            "Timing by season and weather",
            "Lights, hygiene and the chytrid rule",
            "Safety: venomous species, terrain and the group",
            "Pricing a night walk",
            "Where AnimalDex fits",
            "Your first three walks"
        ],
        sections: [
            {
                title: "Herping is easy to do badly",
                paragraphs: [
                    "Flipping cover boards for a crowd, pinning a snake for a photo, or shining a frog in the face for ten minutes so everyone gets the shot is not a walk worth selling, and it is not what careful herpers do on their own time either. Hold yourself to a simple rule: no baiting, luring, calling in, cornering or handling of wild animals, and nothing that disturbs dens, nests or protected habitat.",
                    "The reason is not squeamishness. Amphibians breathe and drink through skin that absorbs whatever is on your hands. Reptiles under cover are there for temperature and moisture, and a board left askew is a refuge lost. A guided walk multiplies whatever the guide does by the number of guests and the number of nights, so the standard has to be higher than for a solo outing."
                ]
            },
            {
                title: "What a good night walk looks like",
                paragraphs: [
                    "Public trails, a group of four to six, lights used to look rather than to lure, and identification talk that does not depend on finding anything. You walk slowly, you stop at the pond edge and the warm path and the stone wall, you explain what lives here and why tonight is or is not a good night, and when a toad crosses the path everyone watches it finish crossing. No collection, no bags, no cover flipping on a paid walk, and no promise of a snake.",
                    "The product is the guide's attention and the night itself. Guests who have never stood at a breeding pond in March with a chorus going do not need a handled animal to have a good evening."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences/headlamp-night-walk.webp",
                        alt: "A long-exposure of a hiker's red headlamp tracing a desert trail under a starry sky",
                        width: 1400,
                        height: 934,
                        caption: "A headlamp on a marked trail at night in Joshua Tree. Lights are for finding your feet and spotting eyeshine, not for holding an animal in a beam. Photo: Joshua Tree National Park, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    {text: "What makes a great ethical Wildlife Guide", slug: "what-makes-a-great-ethical-wildlife-guide", href: blogHrefs.ethicalGuide},
                    {text: "What happens on a night wildlife walk", slug: "what-happens-on-a-night-wildlife-walk", href: blogHrefs.nightWildlifeWalk}
                ]
            },
            {
                title: "Timing by season and weather",
                paragraphs: [
                    "Herps are the most weather-dependent wildlife you can guide for, and that is the honest core of the listing. Amphibian movement is driven by mild temperatures and rain: common and American toads move to breeding ponds on the first wet nights above roughly 5 °C in late winter and early spring, wood frogs chorus in flooded woodland pools within days of thaw, and fire salamanders in Europe come out on damp autumn and spring nights. Snakes and lizards bask in morning sun on cool days and shift to evenings when daytime heat is extreme.",
                    "So a herping listing is really a weather window with a route attached. Say so. A night that turns cold and dry is a short walk with good talk, and your guests should know that before they book."
                ],
                table: {
                    columns: ["Target", "Conditions that work", "Window"],
                    rows: [
                        {cells: ["Toads and frogs moving to ponds", "Mild (above about 5 °C), wet or humid, little wind", "Late winter to spring, first two hours after dark"]},
                        {cells: ["Frog chorus at a pool", "Mild evening after rain", "Spring; dusk onward"]},
                        {cells: ["Salamanders and newts on land", "Rain or heavy dew, mild", "Spring and autumn nights"]},
                        {cells: ["Snakes and lizards basking", "Cool morning after a cold night, sun on banks and walls", "Spring and autumn, mid-morning"]},
                        {cells: ["Nocturnal reptiles in hot regions", "Warm, humid night after a hot day", "Summer; first hours after dark"]},
                        {cells: ["Anything in a cold, dry spell", "Nothing works well", "Reschedule or shorten"]}
                    ]
                },
                speciesSlugs: ["american-toad", "wood-frog", "fire-salamander"]
            },
            {
                title: "Lights, hygiene and the chytrid rule",
                paragraphs: [
                    "A headlamp with a wide beam for walking and a hand torch for pointing is enough. Keep light on an animal for seconds, not minutes, and never aim at a frog's eyes at close range while a group leans in. Red light helps you keep your own night vision but does not make shining an animal acceptable.",
                    "The chytrid fungus Batrachochytrium dendrobatidis has driven amphibian declines on several continents, and it travels on wet boots and nets. Clean and dry footwear between sites, and do not move water, mud or animals between ponds. On a guided walk that means a boot brush at the car and a flat rule that nobody touches an amphibian. Hand sanitiser and sunscreen on skin make the rule stricter, not looser."
                ]
            },
            {
                title: "Safety: venomous species, terrain and the group",
                paragraphs: [
                    "Know which venomous species occur on your route and what they look like at night in a torch beam. Most bites happen to people who reached toward a snake, which a no-handling rule already prevents; the rest happen to feet, so closed boots are a listing condition. Keep the group on the path, keep a two-metre gap from any snake, and let it leave. A black rat snake on a trail is harmless and still gets the same distance, because the rule has to be the same for every animal or guests will not follow it.",
                    "Night terrain is the bigger risk. Pond edges are slick, ditches are invisible, and a group walking in a beam tends to look at the ground where the light is rather than at the branch at head height. Walk the route in daylight first, cap the group at six, keep everyone behind you on narrow sections, and carry a first-aid kit, a spare light and a charged phone."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences/snake-on-path-2.webp",
                        alt: "A black rat snake stretched across a sandy forest trail",
                        width: 1400,
                        height: 739,
                        caption: "A black rat snake crossing a trail. Harmless, and still given room to finish crossing. Photo: Chuck Homler, Focus On Wildlife, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Pricing a night walk",
                paragraphs: [
                    "Night walks are shorter than dawn birding walks and cancel more often, so price per person needs to cover a two-hour outing with a small group and a lost night or two per month. Start from your costs and compare with other guided evening activities nearby, such as a bat walk or a stargazing session, which is what guests will compare you to."
                ],
                table: {
                    columns: ["Factor", "How it shows up in the price"],
                    rows: [
                        {cells: ["Two to three hours including the briefing", "Your main cost; night work is tiring and starts after a full day"]},
                        {cells: ["Weather cancellations", "Higher than for birding; spread the lost nights across the season"]},
                        {cells: ["Group cap of six", "Fixed costs divide over fewer people, so set a minimum group or charge"]},
                        {cells: ["Kit", "Spare torches for guests, boot-cleaning gear, first-aid kit"]},
                        {cells: ["Permits and insurance", "Night access to reserves often needs explicit permission"]},
                        {cells: ["Local comparison", "Check against bat walks and night sky events in your area"]}
                    ]
                }
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex does not list or book night walks; a walk you lead is your own business, arranged and paid directly with your guests, under whatever permits your site needs. What AnimalDex does is turn your sightings into a virtual guide. Each place where you log 3 or more wild species, with a public photo, becomes a guide visitors will be able to buy for a small fee: your notes on every animal, a direct chat with you, and introductions to local people you met.",
                    "For threatened species, no spot or timing is shared in a guide; point buyers to a licensed local guide instead. A guide is advice, not a tour, and it never promises anyone a snake. Buying is coming soon."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences/frog-on-path-night.webp",
                        alt: "A pair of common toads in amplexus crossing a painted road line at night in torchlight",
                        width: 1400,
                        height: 1049,
                        caption: "Common toads crossing a road at night on their way to a breeding pond, the kind of event a spring walk is built around. Photo: Syrio, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    earnRelatedLinks.guide,
                    earnRelatedLinks.marketplace,
                    {text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"}
                ]
            },
            {
                title: "Your first three walks",
                paragraphs: [
                    "Run the route before you sell it, then run it for strangers, then fix the listing."
                ],
                cards: [
                    {
                        label: "Walk one: a daylight recce and a solo night",
                        body: "Walk the route in daylight to find the ditches, the slick edges and the head-height branches. Then do it alone on a listed-type night and time it. Note where you would stand a group of six."
                    },
                    {
                        label: "Walk two: first strangers",
                        body: "Brief the night before: boots, a torch each, no touching anything, the weather call. Start with the rules at the car. Afterwards, write down what guests wanted to know about species you did not see."
                    },
                    {
                        label: "Walk three: the honest listing",
                        body: "Rewrite the pitch around the season window and the talk, with sightings described as possible. Fix the cap, the duration and the price from the first two nights. Add the cancellation rule."
                    }
                ]
            }
        ],
        faq: [
            {
                question: "Can you touch frogs or snakes on a guided herping walk?",
                answer: "No. Careful herping practice rules out handling, cornering, baiting and luring wild animals. Amphibian skin absorbs whatever is on your hands, and chytrid fungus spreads on wet gear. Guests watch animals in place, lights stay on them for seconds, and nobody picks anything up."
            },
            {
                question: "What is the best time of year for a herping walk?",
                answer: "Late winter to spring for amphibians, on mild wet nights above roughly 5 °C when toads and frogs move to breeding ponds. Spring and autumn mornings for basking snakes and lizards. In hot regions, warm humid summer nights after a hot day. A cold, dry spell is poor for everything, so a herping listing is really a weather window."
            },
            {
                question: "How do I stop spreading chytrid fungus between ponds?",
                answer: "Clean mud off boots and let them dry fully between sites, do not carry water, nets or animals from one pond to another, and do not let anyone handle amphibians. Batrachochytrium dendrobatidis spreads on damp equipment and has caused declines worldwide. On a guided walk, a boot brush at the car and a no-touching rule cover most of the risk."
            },
            {
                question: "Can I sell a night herping walk on AnimalDex?",
                answer: "No. AnimalDex does not list or book in-person walks. Your sightings can become a virtual guide instead: notes on every animal, a chat with you, and introductions to local people you met, for a small fee once buying opens. Threatened species get no spot or timing, and sightings are never promised."
            }
        ],
        sources: [
            {label: "Partners in Amphibian and Reptile Conservation", href: "https://parcplace.org/"},
            {label: "USGS National Wildlife Health Center", href: "https://www.usgs.gov/centers/nwhc"},
            {label: "Amphibian and Reptile Conservation Trust", href: "https://www.arc-trust.org/"},
            {label: "Britannica: Herpetology", href: "https://www.britannica.com/science/herpetology"}
        ]
    }),
    earnBlogPost({
        slug: "what-makes-a-great-ethical-wildlife-guide",
        canonicalUrl: `https://animaldex.app${blogHrefs.ethicalGuide}`,
        title: "What Makes a Great Ethical Wildlife Guide?",
        description:
            "An ethical wildlife guide sells orientation, not a guaranteed animal. Distance rules, no baiting or handling, honest pitches, safety and permits.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("what-makes-a-great-ethical-wildlife-guide"),
        readingMinutes: 6,
        tags: ["wildlife-guides"],
        searchIntents: [
            "ethical wildlife guide",
            "responsible wildlife tourism",
            "wildlife guiding ethics",
            "how close is too close to wildlife",
            "wildlife viewing distance rules",
            "no baiting wildlife photography"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "how-to-choose-a-local-wildlife-guide",
            "how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences",
            "how-wildlife-photography-guides-can-find-new-clients"
        ],
        tableOfContents: [
            "The animal does not owe the guest a photo",
            "Distance, noise and when to walk away",
            "No baiting, luring, calling in, cornering or handling",
            "Honesty in the pitch",
            "Safety is yours",
            "Permits, land access and insurance",
            "A short ethics checklist"
        ],
        sections: [
            {
                title: "The animal does not owe the guest a photo",
                paragraphs: [
                    "A great guide briefs distance, noise and the moment to walk away before anyone lifts binoculars. A poor guide manufactures the moment: a bait pile, a recording on loop, a snake lifted off the path. The difference is not subtle to the animal, and increasingly it is not subtle to guests either. The rule fits in one line: no baiting, luring, calling in, cornering or handling, and nests, dens and protected habitats stay alone.",
                    "What you sell instead is orientation. Where to stand, which way the light falls, what that call was, why the heron is standing like that, when to stop and let the animal finish what it is doing. Guests remember the explanation long after they forget the photo they did not get."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-makes-a-great-ethical-wildlife-guide/tortoise-photographer-distance.webp",
                        alt: "A desert tortoise walks across sand in the foreground while a photographer lies flat with a long lens well behind it",
                        width: 1400,
                        height: 929,
                        caption: "A desert tortoise keeps walking while the photographer stays low and far back. Distance plus a long lens is the whole technique. Photo: Joshua Tree National Park, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Distance, noise and when to walk away",
                paragraphs: [
                    "The working rule is that the animal sets the distance. If it stops feeding, raises its head, changes direction, calls in alarm or moves away, the group is too close, whatever the number on the sign says. Park services publish minimums for a reason, and they are minimums: the U.S. National Park Service, for example, asks visitors to keep at least 25 yards (23 m) from most wildlife and 100 yards (91 m) from bears and wolves. Nesting birds and animals with young need more, and a heron colony or an owl roost can be abandoned by repeated close approach.",
                    "Noise is the second lever. A group of six talking at normal volume at a reedbed edge will hear nothing and see less. Brief it once at the start and model it yourself."
                ],
                table: {
                    columns: ["Situation", "What a good guide does"],
                    rows: [
                        {cells: ["Animal stops what it was doing and looks at the group", "Stops, waits, and backs off if the animal does not settle within a minute"]},
                        {cells: ["Nest, den, roost or colony found", "Notes it for the walk's commentary from a distance; never marks it on a map, a post or a pin"]},
                        {cells: ["Animal with young", "Doubles the usual distance; leaves if the adult shows alarm"]},
                        {cells: ["Guest wants to get closer for a photo", "Puts the bird on a scope or explains the lens choice; the answer is still no"]},
                        {cells: ["Animal on the path", "The group waits for it to finish crossing"]},
                        {cells: ["Rare species reported nearby", "Does not run the group to it; a stakeout crowd is the thing that drives rarities off"]}
                    ]
                },
                speciesSlugs: ["great-blue-heron", "tawny-owl"]
            },
            {
                title: "No baiting, luring, calling in, cornering or handling",
                paragraphs: [
                    "Each word in the terms covers a specific bad habit. Baiting is food put out so an animal appears on cue, which habituates it and often ends with it hit on a road or shot as a nuisance. Luring covers mimicked calls, squeaking and decoys. Calling in means playback of a recorded song to pull a territorial bird into view; it costs the bird energy and time during the season it can least afford it. Cornering is positioning a group so an animal has no exit, which is how most defensive bites and most abandoned nests happen. Handling is picking anything up.",
                    "Some of these are legal in some places and common on some tours. A careful guide skips them regardless, because guests cannot tell a careful user of playback from a careless one, and neither can the next guide who copies you."
                ]
            },
            {
                title: "Honesty in the pitch",
                paragraphs: [
                    "The public area, the duration, the group size and the price should match the day. Wildlife sightings cannot be promised, so the pitch describes what you do rather than what will appear. A pitch that says you will spend two hours on a known loop, put birds on a scope and explain calls is honest on a day when the reedbed is quiet. A pitch that names a bird is not.",
                    "If your route needs a licence, a commercial-use permit or a landowner's permission, you hold it. Nobody else can hold it for you. If you write a virtual guide on AnimalDex, the same honesty applies: say what you found and when, never promise an animal, and give no spot or timing for threatened species."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-makes-a-great-ethical-wildlife-guide/scope-and-binoculars-distance.webp",
                        alt: "Three people in winter coats watch wildlife across a field through a spotting scope and binoculars",
                        width: 1400,
                        height: 919,
                        caption: "A scope at the edge of a field. Everyone gets a close view and the animal never knows they were there. Photo: Walton LaVonda, U.S. Fish and Wildlife Service, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [earnRelatedLinks.guide]
            },
            {
                title: "Safety is yours",
                paragraphs: [
                    "You are meeting people from the internet outdoors, sometimes before dawn or after dark. Assess the route in advance for terrain, water, traffic and weather exposure. Brief guests on footwear, the pace and what happens if the weather turns. Carry a first-aid kit and a charged phone, tell someone where you will be, and keep the group together on narrow or wet sections. Stop the walk if conditions fail; a shortened outing is a better story than an injury.",
                    "The same duty runs the other way. Treat guests with respect, and never put a guest or an animal at risk for a sighting."
                ]
            },
            {
                title: "Permits, land access and insurance",
                paragraphs: [
                    "Leading a paid group is a commercial activity on any land. National parks and many reserves require a commercial-use permit even on public trails, some countries license nature guides, and private land needs the owner's permission regardless of money. Public liability insurance is normal practice and sometimes a permit condition. These are general patterns; the specifics belong to your site, and the land manager will tell you in one email."
                ]
            },
            {
                title: "A short ethics checklist",
                paragraphs: [
                    "Before you advertise a walk, read it against these three cards."
                ],
                cards: [
                    {
                        label: "Before the walk",
                        body: "Route scouted in daylight. Permits and permission in hand. The pitch describes the attention guests get, not a guaranteed animal. Cancellation rule written down. Meeting point shared only with confirmed guests."
                    },
                    {
                        label: "During the walk",
                        body: "Distance set by the animal, not the guest. No food, playback, calls, decoys or handling. Nests, dens and roosts left alone and unmarked. Group briefed on noise once and reminded quietly."
                    },
                    {
                        label: "After the walk",
                        body: "Sensitive locations kept out of captures, captions and messages. Anything that went wrong noted and fixed in the pitch before the next walk."
                    }
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-makes-a-great-ethical-wildlife-guide/birders-spotting-scope.webp",
                        alt: "Local bird guides with a spotting scope and binoculars walk a track beside cycle rickshaws in Keoladeo National Park",
                        width: 1400,
                        height: 928,
                        caption: "Guides at Keoladeo National Park, India, where local naturalists lead visitors on foot and by rickshaw along fixed tracks. Photo: PJeganathan, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    {text: "How to choose a local wildlife guide", slug: "how-to-choose-a-local-wildlife-guide", href: blogHrefs.chooseLocalGuide}
                ]
            }
        ],
        faq: [
            {
                question: "How close is too close to wild animals on a guided walk?",
                answer: "Too close is any distance at which the animal changes its behaviour: stops feeding, raises its head, calls in alarm or moves off. Published minimums are a floor, not a target; the U.S. National Park Service asks for at least 25 yards from most wildlife and 100 yards from bears and wolves. Nesting birds and animals with young need more."
            },
            {
                question: "Is using bird call playback on a tour unethical?",
                answer: "Many birding codes discourage it and some reserves ban it, because playback pulls territorial birds off nests and feeding and costs them energy in the breeding season. An ethical guide leaves it out under the no calling in rule, along with baiting, luring, cornering and handling, whatever the local law allows."
            },
            {
                question: "What does an ethical wildlife guide actually sell?",
                answer: "Orientation: where to stand, when to arrive, what the call was, why the animal is behaving that way, and when to walk away. A good guide gets guests close views through a scope or a long lens without the animal knowing, and explains what they are seeing. The animal itself is never part of the deal."
            },
            {
                question: "Does AnimalDex check a guide's permits or insurance?",
                answer: "No. AnimalDex does not list, book or vet in-person guides. Its Wildlife Guides are virtual: advice from someone who has been to a place, not a tour. Any local guide or operator a guide's author introduces is independent of AnimalDex, so check their permits, landowner permission and insurance yourself, and agree terms with them directly."
            }
        ],
        sources: [
            {label: "U.S. National Park Service: Watching Wildlife", href: "https://www.nps.gov/subjects/watchingwildlife/index.htm"},
            {label: "American Birding Association: Code of Birding Ethics", href: "https://www.aba.org/aba-code-of-birding-ethics/"},
            {label: "Leave No Trace", href: "https://lnt.org/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"}
        ]
    }),
    earnBlogPost({
        slug: "how-wildlife-photography-guides-can-find-new-clients",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographyGuideClients}`,
        title: "How Wildlife Photography Guides Can Find New Clients",
        description:
            "Photo clients pay for field time and identification context, not a baited perch. How to shape an ethical session, price it and reach new clients.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-wildlife-photography-guides-can-find-new-clients"),
        readingMinutes: 6,
        tags: ["wildlife-guides", "wildlife photography"],
        searchIntents: [
            "wildlife photography guide clients",
            "photo tour clients",
            "wildlife photo workshop",
            "how to market wildlife photography tours",
            "wildlife photography guide pricing",
            "ethical wildlife photography tour"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "wildlife-photography-tours-what-to-look-for",
            "what-makes-a-great-ethical-wildlife-guide",
            "how-to-become-a-wildlife-guide-with-animaldex"
        ],
        tableOfContents: [
            "Your wild record is a portfolio",
            "Sell the session you can keep ethical",
            "What photography clients actually want",
            "Shaping a session: light, distance, pace",
            "Pricing a photography session",
            "Where else clients come from",
            "Where AnimalDex fits",
            "Your first three sessions"
        ],
        sections: [
            {
                title: "Your wild record is a portfolio",
                paragraphs: [
                    "The first thing a prospective photography client asks is whether you actually find animals where you say you do. A dated record of wild captures, species by species and place by place, answers that before you have said a word, and a public AnimalDex collection is one way to keep that record.",
                    "Keep it honest. A record of animals photographed in place, at a distance, with no bait in the frame, is the portfolio of a guide people can trust with their own morning."
                ],
                inlineLinks: [earnRelatedLinks.marketplace]
            },
            {
                title: "Sell the session you can keep ethical",
                paragraphs: [
                    "A slow public-path morning with identification talk is a session worth selling. A baited owl perch, a kingfisher pool with a stocked fish tank, or a fox fed at a fixed spot is not: no baiting, luring, calling in, cornering or handling. If your current photo-tour product depends on disturbance, consider whether it is the product you want your name on anywhere.",
                    "The ethical session is also the better teaching session. Fieldcraft, light, position and patience are what a client takes home. A set of identical photographs from a hide with a bait log is what they could have bought anywhere."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-wildlife-photography-guides-can-find-new-clients/photographer-telephoto-tortoise.webp",
                        alt: "A desert tortoise walks past in sharp focus while a photographer with a telephoto lens lies on the ground far behind it",
                        width: 1400,
                        height: 900,
                        caption: "Low angle, long lens, and the tortoise going about its business. This is the session you can sell with a clear conscience. Photo: Joshua Tree National Park, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    {text: "What makes a great ethical Wildlife Guide", slug: "what-makes-a-great-ethical-wildlife-guide", href: blogHrefs.ethicalGuide}
                ]
            },
            {
                title: "What photography clients actually want",
                paragraphs: [
                    "Ask people who book photo guides what they paid for and the answers are consistent: a place they would not have found, a time of day they would not have chosen, help with settings in the moment, and someone to tell them what the bird was. Guaranteed subjects come far down the list, and the clients who demand them are the ones who leave the worst reviews when the weather wins."
                ],
                table: {
                    columns: ["What they ask for", "What to offer"],
                    rows: [
                        {cells: ["Good light", "Start times built around sunrise and the hour after, or the last two hours before sunset"]},
                        {cells: ["A subject that stays", "Habitats where animals feed or rest in the open at that hour, approached from a distance and downwind"]},
                        {cells: ["Help with the camera", "Shutter speed, focus mode and exposure advice in the field, not a classroom"]},
                        {cells: ["Knowing what it was", "Identification and behaviour context for every frame they take"]},
                        {cells: ["A clean background", "Positions chosen for angle and distance rather than closeness"]},
                        {cells: ["A promise", "An honest no, and a description of what the morning actually involves"]}
                    ]
                }
            },
            {
                title: "Shaping a session: light, distance, pace",
                paragraphs: [
                    "Plan the session around light first. The hour after sunrise and the two before sunset give low, warm light and the most animal activity; midday is for scouting and lunch. Choose two or three stops where the subject is likely to be in the open and the group can set up without approaching, such as a field edge for deer and foxes at dusk, a tide line for waders, or a rough grassland where owls hunt in the last hour of daylight.",
                    "Keep the pace slow and the group small. Four photographers with tripods take a lot of space on a path and a lot of time to set up, and a fifth person moving while the others are shooting costs everyone the frame. Brief distance before the first stop: the animal sets it, long lenses close it, and nobody steps forward."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-wildlife-photography-guides-can-find-new-clients/photographers-jasper.webp",
                        alt: "Two wildlife photographers with long telephoto lenses crouch at the edge of a gravel road beside bare aspens",
                        width: 1400,
                        height: 933,
                        caption: "Two photographers working from a road edge in Jasper, Alberta. Long lenses, low position, no approach. Photo: Dwayne Reilander, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["red-fox", "roe-deer", "short-eared-owl"]
            },
            {
                title: "Pricing a photography session",
                paragraphs: [
                    "Photography sessions cost more to run than a birding walk: they are longer, earlier, slower, and clients expect one-to-one time with their camera. Price per person with a small cap and a minimum charge, and compare against what a local photography workshop or a private lesson costs rather than against a nature walk."
                ],
                table: {
                    columns: ["Factor", "How it shows up in the price"],
                    rows: [
                        {cells: ["Three to five hours including scouting", "The largest line; a dawn session starts well before dawn for you"]},
                        {cells: ["Cap of three or four", "Fewer people to divide fixed costs over, so per-person is higher"]},
                        {cells: ["One-to-one camera help", "Justifies the step up from a walking tour price"]},
                        {cells: ["Weather and no-show mornings", "Spread across the season; flat light cancels fewer sessions than rain"]},
                        {cells: ["Permits and insurance", "Commercial photography permits exist in many parks and are separate from guiding permits"]},
                        {cells: ["Local comparison", "A half-day photography workshop or a private lesson in your area"]}
                    ]
                }
            },
            {
                title: "Where else clients come from",
                paragraphs: [
                    "Most photography clients come from the same few places: your own published work with honest captions, a camera club talk, a reserve's events list, and past clients who had a good morning. Your AnimalDex wild collection is itself a portfolio with dates and species attached, which answers the question every prospective client asks first: does this person actually find animals here.",
                    "Keep sensitive locations out of all of it. A caption that names the roost is a caption that empties it."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-wildlife-photography-guides-can-find-new-clients/owl-photographer-park.webp",
                        alt: "A photographer in a pink cap holds a camera with a large 200-400mm telephoto lens up toward trees at sunset",
                        width: 788,
                        height: 1400,
                        caption: "A photographer working an owl at last light with a 200-400mm lens. The lens does the approaching. Photo: Siarhei V, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    {text: "Wildlife photography tours: what to look for", slug: "wildlife-photography-tours-what-to-look-for", href: blogHrefs.photographyToursLookFor},
                    {text: "Wildlife photography companion app", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}
                ]
            },
            {
                title: "Where AnimalDex fits",
                paragraphs: [
                    "AnimalDex does not list or book photography sessions; a session you lead is your own business, arranged and paid directly with your client. What AnimalDex does is turn your sightings into a virtual guide. Each place where you log 3 or more wild species, with a public photo, becomes a guide visitors will be able to buy for a small fee: your notes on every animal, a direct chat with you, and introductions to local people you met. It is advice, not a tour, buying is coming soon, and Credits are not used."
                ],
                inlineLinks: [earnRelatedLinks.guide, guidePaymentsLink]
            },
            {
                title: "Your first three sessions",
                paragraphs: [
                    "Run the session before you sell it, then sell it small."
                ],
                cards: [
                    {
                        label: "Session one: your own dawn",
                        body: "Shoot your listed route at the listed time with the kit a client would carry, not your best lens. Time the stops, note where the light actually falls, and check the background at each position."
                    },
                    {
                        label: "Session two: one client",
                        body: "Take your first paying client alone, or two at most. Spend the morning on their camera, not yours. Write down every settings question and every moment you wanted to step closer and did not."
                    },
                    {
                        label: "Session three: the corrected listing",
                        body: "Set the cap, the duration, the start time and the price from the first two mornings. Rewrite the pitch around light, distance and teaching. Leave the species list out."
                    }
                ]
            }
        ],
        faq: [
            {
                question: "How do wildlife photography guides find clients?",
                answer: "Mostly through reputation: published work with honest captions, camera club talks, reserve event listings and past clients who had a good morning. A dated public record of the wild animals you have photographed, place by place, helps a new client trust that you find animals where you say you do."
            },
            {
                question: "What is wrong with baited photography hides?",
                answer: "Food put out on a schedule habituates wild animals to people and to a place, which ends with roadkill, nuisance shootings and abandoned natural feeding. It also produces identical photographs. An ethical session skips baiting, luring, calling in, cornering and handling, even where a baited hide is legal."
            },
            {
                question: "How much should a wildlife photography guide charge?",
                answer: "There is no standard rate. Start from real costs: three to five hours including scouting, a cap of three or four people, weather cancellations, permits and insurance. Compare the result with a local half-day photography workshop or private lesson rather than a nature walk, because the one-to-one camera help is what clients are paying for."
            },
            {
                question: "Can a photography guide get paid through AnimalDex?",
                answer: "Not for sessions: AnimalDex does not list or book in-person photography sessions. What it can pay for is a virtual guide built from your sightings. Once buying opens, your share of each sale is released to Earnings 8 days after the purchase, in real money. Credits are not used."
            }
        ],
        sources: [
            {label: "North American Nature Photography Association", href: "https://nanpa.org/"},
            {label: "U.S. National Park Service: Watching Wildlife", href: "https://www.nps.gov/subjects/watchingwildlife/index.htm"},
            {label: "Cornell Lab of Ornithology", href: "https://www.birds.cornell.edu/"}
        ]
    })
];
