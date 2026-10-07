import {blogHrefs, earnFacts, supportArticleHrefs} from "@/data/earn-economy";
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
            `Apply to be an AnimalDex Wildlife Guide after ${earnFacts.wildCaptures} wild captures, ${earnFacts.wildSpecies} wild species and a ${earnFacts.accountAgeDays}-day account. What review checks, how listings and bookings work.`,
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-to-become-a-wildlife-guide-with-animaldex"),
        readingMinutes: 7,
        tags: ["wildlife-guides", "earning"],
        searchIntents: [
            "become wildlife guide",
            "AnimalDex wildlife guide",
            "how to become a wildlife guide",
            "wildlife guide application requirements",
            "list a guided nature walk"
        ],
        speciesSlugs: [],
        relatedSlugs: [
            "can-birders-make-money-as-local-guides",
            "what-makes-a-great-ethical-wildlife-guide",
            "how-to-start-offering-local-birding-experiences"
        ],
        tableOfContents: [
            "This is a seller application, not a job listing",
            "The application gates",
            "What the human review looks at",
            "Writing a listing that passes review",
            "After approval: accept, meet, complete",
            "Your first three walks",
            "What to expect from the money"
        ],
        sections: [
            {
                title: "This is a seller application, not a job listing",
                paragraphs: [
                    "AnimalDex Wildlife Guides is a marketplace for approved locals. You list an experience with a real-money price. Collectors in the app request a date and a group size. You accept, meet them in the field, and get paid in cash on the day. AnimalDex is not your employer, does not set your hours, and is not the organiser of the outing. It is the place the listing lives and the record of what you completed.",
                    "The program is in live beta: listings, requests, acceptance and completion all work today, and the rules below are the current Guide Seller Terms. Nothing on this page is a guarantee that you will be approved or that anyone will book you."
                ],
                inlineLinks: [earnRelatedLinks.guide, earnRelatedLinks.marketplace]
            },
            {
                title: "The application gates",
                paragraphs: [
                    "Three numbers unlock the application form. They are earned inside the app, with live captures, and they cannot be bought with Credits or skipped by uploading an old photo library. Gallery uploads are not captures. Imported Instagram posts are reviewed one by one before any of them count as a capture, and they still have to be wild to count here.",
                    "Meeting the numbers lets you apply. It does not make you a Guide."
                ],
                table: {
                    columns: ["Gate", "What counts", "Why it exists"],
                    rows: [
                        {cells: [`${earnFacts.wildCaptures} qualifying wild captures`, "Live in-app photos of free-living animals that passed capture review. Zoo, aquarium and pet captures do not count.", "Shows you actually spend time in the field, not that you own a camera."]},
                        {cells: [`${earnFacts.wildSpecies} canonical wild species`, "Distinct species, resolved to a canonical name. Forty captures of one robin still count as one species.", "A guide who can tell guests what they are looking at needs breadth, not one lucky subject."]},
                        {cells: [`${earnFacts.accountAgeDays}-day account age`, "Counted from account creation to the day you apply.", "Slows down throwaway accounts and gives the capture record time to mean something."]},
                        {cells: ["18+ attestation", "You confirm you are an adult.", "You are meeting strangers outdoors and taking cash. That is an adult transaction."]},
                        {cells: ["Guide Seller Terms", "You accept the current version at application time.", "The terms carry the ethics rules: no baiting, luring, calling in, cornering or handling."]},
                        {cells: ["Human review", "A person reads your profile, your public wild record and your application.", "Numbers can be gamed. A reviewer looks for a credible local."]}
                    ]
                },
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-become-a-wildlife-guide-with-animaldex/guided-bird-walk-group.webp",
                        alt: "A small group of birdwatchers with binoculars looking up into trees on a guided walk",
                        width: 1400,
                        height: 941,
                        caption: "A guided bird walk is the kind of small-group, public-path outing the marketplace is built for. Photo: Department of the Interior. U.S. Fish and Wildlife Service. National Conservation Training Center. 10/1997-8888, Public domain, via Wikimedia Commons."
                    }
                },
                inlineLinks: [
                    {text: "How do I become a Wildlife Guide (support)", slug: "how-do-i-become-a-wildlife-guide", href: supportArticleHrefs.becomeGuide},
                    {text: "Import Instagram wildlife photos", slug: "import-instagram-wildlife-photos", href: "/use-cases/import-instagram-wildlife-photos"}
                ]
            },
            {
                title: "What the human review looks at",
                paragraphs: [
                    "The reviewer is answering one question: would a collector be safe and well served meeting this person at a trailhead. The public wild record is the main evidence. A cluster of captures across one region, spread over months and several habitats, reads as a local. A burst of captures from one holiday week reads as a visitor. Neither is a crime, but only one is a guide.",
                    "The application itself asks what you want to list, where, and what qualifies you. Plain answers work. If your area requires a licence to lead paid groups in a national park or a reserve, say that you hold it or that your route avoids that land. The reviewer does not verify permits for you, and approval does not stand in for one.",
                    "Approval can be withdrawn. A guest complaint about harassment, a report of a handled or baited animal, or a listing that misrepresents the outing are all grounds."
                ]
            },
            {
                title: "Writing a listing that passes review",
                paragraphs: [
                    "A listing is reviewed before it is published. The fields are simple, and the common failure is overpromising. Lead with the habitat, the time of day and the kind of attention you give guests. Do not lead with a species you cannot guarantee.",
                    "The public listing shows a general area, not a pin. The exact meeting point is shared only after you accept a request, which protects both you and the site."
                ],
                table: {
                    columns: ["Listing field", "Write this", "Not this"],
                    rows: [
                        {cells: ["Title", "Dawn reedbed walk, two hours", "Guaranteed kingfisher photo tour"]},
                        {cells: ["Pitch", "What you do, how far you walk, what guests should bring", "Superlatives and sighting promises"]},
                        {cells: ["Public area", "A town, valley or reserve name", "A trailhead, a nest site, a den"]},
                        {cells: ["Duration", "The real time from meeting to parting", "Two hours that is really four"]},
                        {cells: ["Guest limit", "The number you can brief and keep quiet", "Whatever fills a minibus"]},
                        {cells: ["Price per person", "A real-money figure you would say out loud", "Credits, discounts or tips-only"]}
                    ]
                },
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-become-a-wildlife-guide-with-animaldex/bird-guide-scope.webp",
                        alt: "A local bird guide walking with a spotting scope on a tripod over his shoulder and binoculars round his neck",
                        width: 751,
                        height: 1400,
                        caption: "A spotting scope on a tripod is the single piece of kit that lets a small group share a distant bird without approaching it. Photo: PJeganathan, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["common-kingfisher", "mallard", "great-egret"]
            },
            {
                title: "After approval: accept, meet, complete",
                paragraphs: [
                    "A collector sends a request for a date and a guest count. You accept or decline. Once accepted, you share the meeting point and any briefing notes. On the day, the collector pays you in cash. AnimalDex does not collect, hold or process that money, and Credits are never part of it.",
                    "When the outing is over you mark it complete, and the seller net is recorded on your Earnings ledger. That record is what the app can show about your history as a Guide. The listed price by itself is not money owed to you by anyone; the booking is between you and the guest."
                ],
                inlineLinks: [guidePaymentsLink, earnRelatedLinks.experiences]
            },
            {
                title: "Your first three walks",
                paragraphs: [
                    "Most new Guides try to launch with the walk they would most like to sell. Launch with the walk you can run in your sleep."
                ],
                cards: [
                    {
                        label: "Walk one: the route you already do",
                        body: "Your regular patch, at the time you already go, for two or three guests who are probably friends of friends. The purpose is to learn how long you actually take with people who stop to ask questions. Write down the real duration."
                    },
                    {
                        label: "Walk two: strangers from the app",
                        body: "Same route, same window, first request from a collector you have never met. Send a clear meeting point, a what-to-bring list and a weather call the evening before. Notice what they asked that you did not expect."
                    },
                    {
                        label: "Walk three: the adjusted listing",
                        body: "Change the duration, guest cap and price to match what walks one and two taught you. This is usually a shorter walk, a smaller cap and a slightly higher price than the first draft."
                    }
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-become-a-wildlife-guide-with-animaldex/ranger-leads-walk.webp",
                        alt: "A park ranger leads a line of visitors along a gravel trail across open tundra",
                        width: 1400,
                        height: 948,
                        caption: "A ranger-led walk on a marked trail. Keep your own first walks on public paths you could describe without a map. Photo: NPS Photo / Emily Mesner, Public domain, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "What to expect from the money",
                paragraphs: [
                    "Guiding is part-time and seasonal for almost everyone who does it. Dawn walks sell in spring and autumn. Night walks sell in the warm months. Weeks go by with no requests, then a long weekend brings three. Price so that a single walk with the minimum group covers your travel and your morning, and treat anything beyond that as the reward for the hours you were going to spend outside anyway.",
                    "Nobody at AnimalDex will tell you what you will earn, because nobody knows. The marketplace gives approved locals a place to be found by people who already care about wildlife. The rest is your route, your reliability and your reputation."
                ],
                inlineLinks: [sideIncomeLink, earnRelatedLinks.earn]
            }
        ],
        faq: [
            {
                question: "Do I become a Guide automatically when I reach the capture and species numbers?",
                answer: `No. Reaching ${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species and a ${earnFacts.accountAgeDays}-day account only unlocks the application form. A person then reviews your public wild record and your answers. Approval can be declined without a reason, and it can be withdrawn later if you break the Guide Seller Terms.`
            },
            {
                question: "Does AnimalDex pay me for bookings?",
                answer: "No. The collector pays you in cash when you meet. AnimalDex does not collect, hold or process that money, and Credits are never used for a booking. When you mark the outing complete, the seller net is recorded on your Earnings ledger as a record, not as a transfer from AnimalDex."
            },
            {
                question: "Can I use photos from my camera roll or Instagram to reach the capture gate?",
                answer: "Not directly. Captures are live photos taken inside the app. A camera-roll upload is a gallery image, not a capture. The Instagram import reviews each post before it can become a capture, and only wild subjects count toward the Guide gates. Zoo and pet captures are valid in your collection but do not qualify here."
            },
            {
                question: "What permits or insurance do I need to be an AnimalDex Wildlife Guide?",
                answer: "Whatever your location requires for leading paid groups, which varies by country, park and landowner. AnimalDex does not check permits or insurance and approval is not a licence. Many parks require a commercial-use permit for paid walks, and public liability insurance is normal practice. Find out before you list, not after a booking."
            },
            {
                question: "How much can a wildlife guide earn through AnimalDex?",
                answer: "There is no figure to quote. Guiding income is part-time, seasonal and set by your own price, group size and how often collectors request you. Some approved Guides may receive no requests. Treat it as a way to be paid for walks you already do, not as a salary."
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
            "Yes, if people will pay for local knowledge and you stay legal. How local birding guides actually earn, how to price a walk, and where a listing fits.",
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
                    "The hard part was never inventing birding. It is trust and discovery: a visitor with two free mornings has no way to tell a careful local from a stranger with binoculars. That gap is what a reviewed marketplace listing is for."
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
                    `AnimalDex Wildlife Guides is one listing path, currently in beta. After you reach the wild-collection gates (${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species, a ${earnFacts.accountAgeDays}-day account) and pass a human review, you can publish a listing in the Birding category. Collectors browse by area and category, see your pitch and your aggregate wild credentials, and send a request for a date and group size.`,
                    "The app passes the request, records your acceptance, and records the seller net when you mark the outing complete. It does not collect the cash, verify your permits, insure you, or promise birds. It is a reviewed place to be found, not a tour operator."
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
                    "A two-hour public-path walk for a handful of guests is a listing. A minibus, a packed lunch and a guaranteed eagle is a different business with vehicle insurance, food hygiene and a refund policy, and it is a bad promise on top. Start with the walk you already do, at the time you already do it, and let the guest cap stay low until you have run it with strangers a few times.",
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
                    "Income is taxable where you live, and it is your job to record it. AnimalDex's Earnings ledger shows seller net for completed outings, which is a useful record, but it is not an accountant."
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
                answer: "Often, yes. National parks and many reserves require a commercial-use permit for paid groups, some countries license nature guides, and private land needs the owner's permission. Rules differ by site, so ask the land manager before you list. AnimalDex does not verify permits, and approval as a Guide is not a licence."
            },
            {
                question: "What does an AnimalDex Wildlife Guide listing give a birder?",
                answer: `A reviewed place to be found by collectors already in the app. After ${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species, a ${earnFacts.accountAgeDays}-day account and a human review, you can list a birding experience with a real-money price. Requests arrive in the app; payment is cash on the day; completed outings record seller net on your Earnings.`
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
            "Pick a public route, a duration, a guest cap and an honest price. How to scout, time a walk by season and tide, brief guests and list your first walk.",
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
            "Apply first, then list",
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
                    "Birding in rain is possible; birding in a gale on an exposed sea wall is not, and a wet group with no birds is a bad review. Decide your cancellation rule before you list: for example, you call the walk by 20:00 the night before if the forecast shows sustained heavy rain or wind above a set speed, and you offer another date. Because payment is cash on the day, a cancelled walk simply does not happen. Put the rule in the listing so nobody has to argue about it.",
                    "You are meeting strangers outdoors, often before daylight. Tell someone where you will be, carry a phone and a small first-aid kit, know where the nearest road access is on the route, and keep the group together on the walk back. If a guest is struggling, shorten the route rather than split the group."
                ]
            },
            {
                title: "Keep meeting points private",
                paragraphs: [
                    "AnimalDex listings show a general area, such as a town or a reserve. The exact meeting point waits until you accept a request. That protects you from being met by someone you did not accept, and it protects the site: a published pin at a roost or a nest draws people who are not with a guide."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-to-start-offering-local-birding-experiences/birders-boardwalk.webp",
                        alt: "A wooden boardwalk curving through a marsh of tall reeds and open water under a cloudy sky",
                        width: 1400,
                        height: 1050,
                        caption: "Marsh boardwalk at Point Pelee, Ontario. A route like this is easy to describe once a request is accepted and hard to overcrowd. Photo: Ken Lund from Reno, Nevada, USA, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Apply first, then list",
                paragraphs: [
                    `You cannot skip the wild-collection gates or the human review. Build ${earnFacts.wildCaptures} qualifying wild captures across ${earnFacts.wildSpecies} species with live in-app photos, wait out the ${earnFacts.accountAgeDays}-day account age, apply, and list only after approval. Listings are reviewed too, so an honest pitch gets published faster than a grand one.`,
                    "Then price in real money, take cash on the day and mark the outing complete so the seller net is recorded on Earnings. Wildlife Guides is in beta, and nobody is promised bookings."
                ],
                inlineLinks: [
                    earnRelatedLinks.guide,
                    earnRelatedLinks.experiences,
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
                        label: "Walk two: a request from the app",
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
                answer: "Decide a cancellation rule before you list and put it in the listing: for example, you call the walk by the evening before if the forecast shows sustained heavy rain or strong wind, and you offer a new date. Because payment is cash on the day, a cancelled walk involves no refund. Light rain is usually fine; exposed coast in a gale is not."
            },
            {
                question: "Do I need to be approved before I can list a birding walk on AnimalDex?",
                answer: `Yes. You need ${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species, a ${earnFacts.accountAgeDays}-day account, an 18+ attestation and a human review before you can apply and list. Each listing is also reviewed before it is published. Wildlife Guides is in beta and approval does not guarantee requests.`
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
            "Night herping walks can be listed if you stay legal, skip handling and never promise a snake. Scouting, lights, chytrid hygiene, group size and pricing.",
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
            "Same marketplace, same cash rule",
            "Your first three walks"
        ],
        sections: [
            {
                title: "Herping is easy to do badly",
                paragraphs: [
                    "Flipping cover boards for a crowd, pinning a snake for a photo, or shining a frog in the face for ten minutes so everyone gets the shot is not a listing AnimalDex wants, and it is not what careful herpers do on their own time either. The Guide Seller Terms are explicit: no baiting, luring, calling in, cornering or handling of wild animals, and nothing that disturbs dens, nests or protected habitat.",
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
                title: "Same marketplace, same cash rule",
                paragraphs: [
                    `Apply after the wild-collection gates (${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species, ${earnFacts.accountAgeDays} days of account age) and a human review. Herping and Night wildlife are both listing categories. Price in real money, collect cash on the day, and mark the outing complete so the seller net is recorded on Earnings. AnimalDex does not handle the cash, verify your permits or promise anyone a snake.`,
                    "Your own herping captures are also the evidence a reviewer reads. A record of frogs, newts and snakes spread across local sites and seasons, photographed in place without handling, is the application."
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
                    earnRelatedLinks.experiences,
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
                        label: "Walk two: first request",
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
                answer: "No. The AnimalDex Guide Seller Terms ban handling, cornering, baiting and luring wild animals, and careful herping practice agrees. Amphibian skin absorbs whatever is on your hands, and chytrid fungus spreads on wet gear. Guests watch animals in place, lights stay on them for seconds, and nobody picks anything up."
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
                question: "Can I list a night herping walk on AnimalDex?",
                answer: `Yes, after approval. You need ${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species, a ${earnFacts.accountAgeDays}-day account and a human review, then your listing is reviewed too. Herping and Night wildlife are both categories. Payment is cash on the day and sightings can never be promised. You hold any permit for night access yourself.`
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
            "An ethical wildlife guide sells orientation, not a guaranteed animal. Distance rules, no baiting or handling, honest listings, safety and permits.",
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
            "Honesty in the listing",
            "Safety is yours",
            "Permits, land access and insurance",
            "A short ethics checklist"
        ],
        sections: [
            {
                title: "The animal does not owe the guest a photo",
                paragraphs: [
                    "A great guide briefs distance, noise and the moment to walk away before anyone lifts binoculars. A poor guide manufactures the moment: a bait pile, a recording on loop, a snake lifted off the path. The difference is not subtle to the animal, and increasingly it is not subtle to guests either. AnimalDex Wildlife Guide terms put it in one line: no baiting, luring, calling in, cornering or handling, and nests, dens and protected habitats stay alone.",
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
                        {cells: ["Nest, den, roost or colony found", "Notes it for the walk's commentary from a distance; never marks it on a listing or a pin"]},
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
                    "Some of these are legal in some places and common on some tours. The AnimalDex terms ban them on listed outings regardless, because the marketplace cannot tell a careful user of playback from a careless one and has no interest in trying."
                ]
            },
            {
                title: "Honesty in the listing",
                paragraphs: [
                    "The public area, the duration, the group size and the price should match the day. Wildlife sightings cannot be promised, so the listing describes what you do rather than what will appear. A pitch that says you will spend two hours on a known loop, put birds on a scope and explain calls is honest on a day when the reedbed is quiet. A pitch that names a bird is not.",
                    "If your route needs a licence, a commercial-use permit or a landowner's permission, you hold it. AnimalDex does not verify permits for you, and approval as a Guide does not substitute for one."
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
                    "The same duty runs the other way. Harassment of a guest, or harm to a guest or an animal, ends access to Wildlife Guides. Complaints are read by a person."
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
                    "Before you publish a listing, read it against these three cards."
                ],
                cards: [
                    {
                        label: "Before the walk",
                        body: "Route scouted in daylight. Permits and permission in hand. Listing describes the attention guests get, not a guaranteed animal. Cancellation rule written down. Meeting point shared only after acceptance."
                    },
                    {
                        label: "During the walk",
                        body: "Distance set by the animal, not the guest. No food, playback, calls, decoys or handling. Nests, dens and roosts left alone and unmarked. Group briefed on noise once and reminded quietly."
                    },
                    {
                        label: "After the walk",
                        body: "Outing marked complete. Sensitive locations kept out of captures, captions and messages. Anything that went wrong noted and fixed in the listing before the next request."
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
                answer: "Many birding codes discourage it and some reserves ban it, because playback pulls territorial birds off nests and feeding and costs them energy in the breeding season. On AnimalDex Wildlife Guide outings it is banned outright under the no calling in rule, along with baiting, luring, cornering and handling, whatever the local law allows."
            },
            {
                question: "What does an ethical wildlife guide actually sell?",
                answer: "Orientation: where to stand, when to arrive, what the call was, why the animal is behaving that way, and when to walk away. A good guide gets guests close views through a scope or a long lens without the animal knowing, and explains what they are seeing. The animal itself is never part of the deal."
            },
            {
                question: "Does AnimalDex check a guide's permits or insurance?",
                answer: "No. Approval as a Wildlife Guide follows a human review of your wild record and application, but it is not a licence. Permits, landowner permission and insurance are your responsibility and vary by country, park and site. The listing terms require that you hold whatever your location needs for leading paid groups."
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
            "Photo clients pay for field time and identification context, not a baited perch. How to shape an ethical session, price it and reach people who book.",
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
            "Collectors are already looking",
            "Sell the session you can keep ethical",
            "What photography clients actually want",
            "Shaping a session: light, distance, pace",
            "Pricing a photography session",
            "Where else clients come from",
            "The booking is still cash on the day",
            "Your first three sessions"
        ],
        sections: [
            {
                title: "Collectors are already looking",
                paragraphs: [
                    "AnimalDex users open published Guide listings by area and category, and Wildlife photography is one of the categories. They see your public pitch, your general area, your price and your aggregate wild credentials: how many wild captures and species sit behind the listing. They do not see your private capture map or where you found anything.",
                    "That audience is unusual. People who have built a wild collection in the app already carry a camera, already know what a good capture looks like and already understand that the animal might not turn up. They are the easiest photography clients to brief and the quickest to write a fair review."
                ],
                inlineLinks: [earnRelatedLinks.marketplace, earnRelatedLinks.experiences]
            },
            {
                title: "Sell the session you can keep ethical",
                paragraphs: [
                    "A slow public-path morning with identification talk is listable. A baited owl perch, a kingfisher pool with a stocked fish tank, or a fox fed at a fixed spot is not, and the Guide Seller Terms say so: no baiting, luring, calling in, cornering or handling. If your current photo-tour product depends on disturbance, do not bring it to AnimalDex, and consider whether it is the product you want your name on anywhere.",
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
                    "A marketplace listing works best alongside the things that already bring photography clients: your own published work with honest captions, a camera club talk, a reserve's events list, and past clients who had a good morning. Your AnimalDex wild collection is itself a portfolio with dates and species attached, which answers the question every prospective client asks first: does this person actually find animals here.",
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
                title: "The booking is still cash on the day",
                paragraphs: [
                    `Requests come through the app once you are an approved Guide, which takes ${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species, a ${earnFacts.accountAgeDays}-day account and a human review. Payment does not come through the app. You take cash when you meet, and when you mark the session complete the seller net is recorded on Earnings. Credits are never used, nobody is promised bookings, and Wildlife Guides is in beta.`
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
                        body: "Take the first request with a cap of one or two. Spend the morning on their camera, not yours. Write down every settings question and every moment you wanted to step closer and did not."
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
                answer: "Mostly through reputation: published work with honest captions, camera club talks, reserve event listings, past clients and a reviewed marketplace listing where people who already photograph wildlife are looking. An AnimalDex Wildlife Guide listing in the Wildlife photography category shows your pitch, area, price and aggregate wild credentials to collectors browsing by region."
            },
            {
                question: "What is wrong with baited photography hides?",
                answer: "Food put out on a schedule habituates wild animals to people and to a place, which ends with roadkill, nuisance shootings and abandoned natural feeding. It also produces identical photographs. AnimalDex Guide Seller Terms ban baiting, luring, calling in, cornering and handling on listed outings, so a baited hide cannot be listed even where it is legal."
            },
            {
                question: "How much should a wildlife photography guide charge?",
                answer: "There is no standard rate. Start from real costs: three to five hours including scouting, a cap of three or four people, weather cancellations, permits and insurance. Compare the result with a local half-day photography workshop or private lesson rather than a nature walk, because the one-to-one camera help is what clients are paying for."
            },
            {
                question: "Can a photography guide get paid through AnimalDex?",
                answer: "No. Requests arrive through the app once you are an approved Guide, but the client pays you in cash on the day. AnimalDex does not collect or process that money and Credits are never used. When you mark the session complete, the seller net is recorded on your Earnings ledger as a record of the outing."
            }
        ],
        sources: [
            {label: "North American Nature Photography Association", href: "https://nanpa.org/"},
            {label: "U.S. National Park Service: Watching Wildlife", href: "https://www.nps.gov/subjects/watchingwildlife/index.htm"},
            {label: "Cornell Lab of Ornithology", href: "https://www.birds.cornell.edu/"}
        ]
    })
];
