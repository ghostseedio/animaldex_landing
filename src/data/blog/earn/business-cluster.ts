import {blogHrefs, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import {contentThumb} from "@/data/content-thumbnails";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";
const updatedAt = "2026-10-07";

const howSponsorLink = {
    text: "How can a business sponsor an AnimalDex Challenge?",
    slug: "how-can-a-business-sponsor-an-animaldex-challenge",
    href: supportArticleHrefs.howSponsor
};

const whatSponsoredLink = {
    text: "What are Sponsored Challenges?",
    slug: "what-are-sponsored-challenges",
    href: supportArticleHrefs.whatSponsored
};

const familyZooUseCase = {
    text: "Family zoo and safari learning app",
    slug: "family-zoo-safari-animal-learning-app",
    href: "/use-cases/family-zoo-safari-animal-learning-app"
};

const post = (href: string, text: string) => ({text, slug: href.replace("/blog/", ""), href});

export const businessEarnBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-zoos-can-turn-visitors-into-active-wildlife-explorers",
        canonicalUrl: `https://animaldex.app${blogHrefs.zooExplorers}`,
        title: "How Zoos Can Turn Visitors Into Active Wildlife Explorers",
        description:
            "Most zoo visits end at the gate. Here is how a free-to-join species-spotting challenge works end to end, how to measure dwell time, and what to avoid.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-zoos-can-turn-visitors-into-active-wildlife-explorers"),
        readingMinutes: 8,
        tags: ["sponsored-challenges", "zoos"],
        searchIntents: [
            "zoo visitor engagement",
            "zoo marketing campaign",
            "interactive zoo activity",
            "how to measure zoo dwell time",
            "zoo species spotting challenge",
            "zoo education program ideas"
        ],
        speciesSlugs: ["tiger", "western-lowland-gorilla", "meerkat", "red-panda"],
        relatedSlugs: [
            "interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets",
            "what-is-a-sponsored-wildlife-challenge",
            "how-animaldex-sponsored-challenges-work-for-businesses"
        ],
        tableOfContents: [
            "The visit is shorter than you think",
            "How engagement and dwell time are actually measured",
            "A species-spotting challenge, end to end",
            "Three challenge designs for a zoo",
            "Briefing keepers, hosts and the front desk",
            "Pitfalls: crowding, welfare optics and privacy",
            "What we will not claim"
        ],
        sections: [
            {
                title: "The visit is shorter than you think",
                paragraphs: [
                    "Most guests walk a loop, photograph the same three animals, and leave. Timing-and-tracking studies in zoos and museums keep finding the same pattern: the average stop at an enclosure is well under a minute, and a large share of visitors never read the interpretation panel at all. Discount tickets bring people through the gate. They do not change what happens in the two hours after it.",
                    "The gap is not interest. People who pay to see a tiger want to see the tiger. The gap is that nothing asks them to look closely, compare, or come back to a habitat they walked past. A Sponsored Challenge in AnimalDex is one way to add that ask without building an app of your own: a time-boxed objective guests join free, work towards with their own phone, and finish with an achievement. Cash prizes are not part of it."
                ],
                inlineLinks: [earnRelatedLinks.sponsor, familyZooUseCase],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-zoos-can-turn-visitors-into-active-wildlife-explorers/visitors-watching-enclosure.webp",
                        alt: "Zoo visitors standing at a viewing window watching a tiger walk through its enclosure",
                        width: 1400,
                        height: 933,
                        caption: "A full viewing window and a tiger in the open: the moment most visits are built around, and usually over in under a minute. Photo: Postdlf, CC BY-SA 3.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "How engagement and dwell time are actually measured",
                paragraphs: [
                    "Before you run anything, agree what you will count. Zoo evaluators usually combine four kinds of evidence, and each one answers a different question. None of them needs a sponsor dashboard; most need a clipboard, your ticketing export, and a short survey.",
                    "Observation is the honest baseline. An evaluator stands at a habitat for set periods and records how many passers-by stop (attracting power) and for how long (holding power). Do it for the same habitats before and during a campaign and you have a comparison that does not depend on anyone's app."
                ],
                table: {
                    columns: ["Metric", "How it is measured", "What it tells you"],
                    rows: [
                        {cells: ["Stop rate at a habitat", "Observer counts passers-by who pause for 3 seconds or more", "Whether a habitat attracts attention at all"]},
                        {cells: ["Hold time", "Stopwatch per stopping visitor, sampled across the day", "Whether people look, or glance and move on"]},
                        {cells: ["Total dwell time", "Timed entry versus exit scan, or exit survey estimate", "Whether the whole visit got longer"]},
                        {cells: ["Route coverage", "Exit survey: which zones did you visit; map tick-sheet", "Whether people reached the quiet corners"]},
                        {cells: ["Return visits", "Membership scans and repeat ticket purchases in the window", "Whether the campaign changed behaviour after day one"]},
                        {cells: ["Challenge participation", "Joins and completions reported by AnimalDex after the window", "How many visitors took the objective seriously"]}
                    ]
                }
            },
            {
                title: "A species-spotting challenge, end to end",
                paragraphs: [
                    "Here is the whole lifecycle of a venue Challenge, so education and marketing can see what they are committing to. First, the objective. The three AnimalDex objective types are unique indexed animals (capture a set number of different animals the app can index), a qualifying capture count, or active capture days. For a zoo, unique indexed animals is the natural choice because it rewards walking the whole site.",
                    "Second, the scope. A venue campaign can be bound to your site and a discovery radius, so captures only count when they are recorded at the zoo. It can require live camera captures and ignore Instagram imports, which keeps the work on the grounds rather than in an old camera roll. It can require a Zoo setting tag, a minimum capture Grade, or a type tag such as Bird if you want to steer attention to the aviary.",
                    "Third, what counts as a capture. A capture is a live photo taken in the app and identified against the AnimalDex catalog. A screenshot of the signage is not a capture. A gallery upload is not a capture. If live-only is on, nothing imported counts, and the Challenge rules say so when a guest joins.",
                    "Fourth, the window and the finish. A common starting point is 15 different animals in 30 days, which fits a school holiday or an exhibition month. Guests see the Challenge in the app with its sponsor disclosure, join free, accept the rules version, and watch a progress bar fill. When they reach the target, an achievement named for your campaign is granted to their account. That is the reward that is live today. There is no prize draw, no paid entry and no cash."
                ],
                inlineLinks: [whatSponsoredLink, post(blogHrefs.whatSponsoredChallenge, "What is a Sponsored Wildlife Challenge?")],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-zoos-can-turn-visitors-into-active-wildlife-explorers/family-viewing-window.webp",
                        alt: "A visitor at a glass viewing window watching a western lowland gorilla sitting in its enclosure",
                        width: 1050,
                        height: 1400,
                        caption: "A gorilla habitat with a single visitor at the glass. A Challenge that asks for fifteen different animals sends people to the habitats they would otherwise skip. Photo: Marylinalcyonova, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Three challenge designs for a zoo",
                paragraphs: [
                    "The right design depends on what you want people to do differently. These three cover most briefs we hear from zoos."
                ],
                cards: [
                    {
                        label: "Whole-site explorer",
                        body: "Objective: 15 unique indexed animals. Scope: venue-bound, live-only, Zoo setting tag. Window: 30 days across a holiday period. Goal: route coverage. Measure with stop rates at your three least-visited habitats."
                    },
                    {
                        label: "New habitat opening",
                        body: "Objective: 5 qualifying captures with a minimum Grade. Scope: venue-bound, live-only. Window: the first two weeks after opening. Goal: careful looking at one place. Measure with hold time at the new habitat versus a control habitat."
                    },
                    {
                        label: "Member comeback",
                        body: "Objective: 5 active capture days. Scope: venue-bound. Window: a 14-day half-term. Goal: repeat visits by members. Measure with membership scans in the window versus the same window last year."
                    }
                ],
                speciesSlugs: ["tiger", "western-lowland-gorilla", "meerkat", "red-panda"]
            },
            {
                title: "Briefing keepers, hosts and the front desk",
                paragraphs: [
                    "A Challenge fails quietly if the front desk has never heard of it. Keep the brief to one page. It should say what the objective is, where people join (in the AnimalDex app, free), what counts (live photos at the zoo), what the reward is (an achievement, not a prize), and the one rule that matters for welfare: no tapping on glass, no flash, no calling to animals to get a better shot.",
                    "Keeper talks are the best place to mention it, because a keeper can say which animal is active when, and that turns a checklist into a reason to wait. Add one line to the visitor map and one sign at the exit of the first habitat on your loop. Do not plaster every enclosure; people stop reading repeated signage after the second one."
                ],
                inlineLinks: [post(blogHrefs.zooMarketing, "Interactive zoo marketing ideas that go beyond discount tickets")]
            },
            {
                title: "Pitfalls: crowding, welfare optics and privacy",
                paragraphs: [
                    "Over-gamifying is the first risk. Points for speed turn a viewing window into a queue of phones held high. Unique animals and active days reward slower looking; a leaderboard rewards sprinting. Ask for the former.",
                    "Welfare optics are the second. Anything that pushes guests to provoke a reaction is a bad idea even if your animals are unbothered, because the photos will circulate. Say it in the rules, say it on the signage, and brief hosts to intervene early.",
                    "Privacy is the third. Guests use their own AnimalDex account. You do not need to collect names or emails to run a Challenge, and you should not. After the window, the conversation with AnimalDex is about participation in aggregate, not about individual visitors."
                ]
            },
            {
                title: "What we will not claim",
                paragraphs: [
                    "This is not a dwell-time analytics product we can promise on a slide. The measurement in this article is yours: observation, ticketing, surveys. After a window closes, we can talk about joins and completions. We will not invent a live sponsor dashboard that is not in the product, and there is no self-serve portal; you enquire, and AnimalDex configures the campaign with you."
                ],
                inlineLinks: [howSponsorLink, earnRelatedLinks.sponsor],
                pullQuote: "A cheaper ticket changes who comes through the gate. A published objective changes what they do after it."
            }
        ],
        faq: [
            {
                question: "How do zoos measure visitor engagement?",
                answer: "Mostly by observation and surveys. Evaluators record how many passers-by stop at a habitat and for how long, time whole visits with entry and exit scans, and ask exit-survey questions about which zones people reached. Membership scans show repeat visits. A Sponsored Challenge adds joins and completions after the window, but it does not replace the observation work."
            },
            {
                question: "What is a species-spotting challenge at a zoo?",
                answer: "It is a time-boxed objective visitors join free in the AnimalDex app, usually to capture a set number of different animals on site with live photos. Captures can be limited to the venue, to live camera shots, and to a Zoo setting tag. When the target is reached, an achievement named for the campaign is granted. There is no cash prize and no draw."
            },
            {
                question: "Can a zoo run a challenge without a prize?",
                answer: "Yes, and it is the only version that is live. Achievement rewards are available today; cash rewards are not. Because there is no paid entry, no random winner and no prize pool, the Challenge is not a sweepstake, which keeps marketing and legal happy and keeps the focus on looking at animals rather than on winning something."
            },
            {
                question: "Does a wildlife challenge disturb the animals?",
                answer: "It should not, if it is designed around slow objectives and the rules say so. Unique animals and active days reward careful looking. Speed leaderboards do the opposite. Put no-flash, no-tapping and no-calling rules in the Challenge text and on signage, and brief hosts to step in early. Welfare optics matter as much as welfare itself because photos travel."
            },
            {
                question: "How long should a zoo challenge run?",
                answer: "Match it to a visit pattern. A 30-day window suits a school holiday or exhibition month and gives families time for more than one trip. A 14-day active-days campaign suits a half-term and member comebacks. A one-day window rarely works because most people only discover the Challenge once they are already inside."
            }
        ],
        sources: [
            {label: "Association of Zoos and Aquariums (AZA)", href: "https://www.aza.org/"},
            {label: "Moss, Jensen and Gusset (2015), Evaluating the contribution of zoos and aquariums to Aichi Biodiversity Target 1, Conservation Biology", href: "https://doi.org/10.1111/cobi.12383"},
            {label: "World Association of Zoos and Aquariums (WAZA)", href: "https://www.waza.org/"},
            {label: "Britannica: Zoo", href: "https://www.britannica.com/science/zoo"}
        ]
    }),
    earnBlogPost({
        slug: "interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets",
        canonicalUrl: `https://animaldex.app${blogHrefs.zooMarketing}`,
        title: "Interactive Zoo Marketing Ideas That Go Beyond Discount Tickets",
        description:
            "Price promotions fill the car park but do not change the visit. Eight interactive zoo ideas, what each costs in staff time, and how to measure them.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets"),
        readingMinutes: 6,
        tags: ["sponsored-challenges", "zoos"],
        searchIntents: [
            "interactive zoo marketing",
            "zoo engagement ideas",
            "zoo campaign ideas",
            "zoo marketing ideas beyond discounts",
            "zoo visitor experience ideas",
            "zoo membership retention ideas"
        ],
        speciesSlugs: ["giraffe", "giant-panda", "meerkat", "ring-tailed-lemur"],
        relatedSlugs: [
            "how-zoos-can-turn-visitors-into-active-wildlife-explorers",
            "gamification-ideas-for-wildlife-parks-and-nature-attractions",
            "what-is-a-sponsored-wildlife-challenge"
        ],
        tableOfContents: [
            "Discounts are not a program",
            "Eight ideas, compared",
            "Ideas that need nothing but staff",
            "Ideas that use a phone without crowding the glass",
            "A Challenge is a rule set, not a coupon",
            "Budgeting in staff hours, not prize money",
            "Measuring whether any of it worked"
        ],
        sections: [
            {
                title: "Discounts are not a program",
                paragraphs: [
                    "A cheaper ticket is a transaction. An interactive program is a reason to look at the next habitat instead of the gift shop. Zoos already run the best version of this: the keeper talk, where a person who knows the animal tells a crowd what to look for in the next ten minutes. Most of the ideas below are variations on that principle, with and without a phone.",
                    "The ideas that fail are the ones that put the activity between the visitor and the animal. Scavenger hunts that reward speed crowd the glass. QR codes that open a video make people watch a screen in front of a live giraffe. The test for any idea is simple: does it make someone look longer at an animal, or does it make them look at something else?"
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets/giraffe-feeding-visitors.webp",
                        alt: "A visitor on a raised platform holding a leafy branch out to two giraffes at a zoo",
                        width: 1400,
                        height: 1050,
                        caption: "A giraffe encounter is the oldest interactive idea in the book: a timed, staffed moment with one animal, and it still outperforms most digital layers. Photo: Dave Hogg, CC BY 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Eight ideas, compared",
                paragraphs: [
                    "Costs here are phrased in staff time rather than money, because that is where the real budget goes. None of these needs a prize pool."
                ],
                table: {
                    columns: ["Idea", "What it changes", "Staff cost", "How to measure"],
                    rows: [
                        {cells: ["Keeper talk schedule on the map", "Visitors plan around animals, not food", "Low: keepers already talk", "Crowd counts at talks; exit survey recall"]},
                        {cells: ["Quiet hour before opening", "Slow looking, members and photographers", "Low: one host, no extra keepers", "Member uptake; repeat bookings"]},
                        {cells: ["Species ID cards at the viewing line", "People compare individuals, not just species", "Low: print once, replace monthly", "Hold time at the habitat"]},
                        {cells: ["Sketching stools and clipboards", "Ten-minute stops instead of ten-second ones", "Low: stools and paper", "Hold time; drawings left behind"]},
                        {cells: ["Timed feeding encounters", "A reason to be somewhere at a set time", "Medium: keeper plus host per slot", "Slot sell-through; dwell on the route to it"]},
                        {cells: ["Sponsored AnimalDex Challenge", "A published objective across the whole site", "Low-medium: one-page brief, signage", "Joins and completions after the window; stop rates"]},
                        {cells: ["Family trail with a finish stamp", "Route coverage for under-tens", "Medium: trail design, restock", "Stamps handed out; route survey"]},
                        {cells: ["Member-only dawn walk", "Repeat visits from existing members", "Medium: keeper time at dawn", "Attendance; renewals in the cohort"]}
                    ]
                }
            },
            {
                title: "Ideas that need nothing but staff",
                paragraphs: [
                    "Quiet hours, sketching stools and species ID cards at the viewing line still work, and they work because they lower the pace. A card that says how to tell the two meerkat sentinels apart turns a glance into a comparison. A stool says you are allowed to stay. None of this is new, and none of it needs a vendor.",
                    "The keeper talk deserves a specific mention. Printing the talk schedule on the map, and saying at each talk what the next one is and where, is the cheapest route-coverage tool a zoo has. Visitors who attend two talks have, by definition, walked between them."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets/panda-enclosure-visitors.webp",
                        alt: "Families crouched at a long glass wall watching a giant panda eat bamboo in an indoor enclosure",
                        width: 1400,
                        height: 1050,
                        caption: "An indoor panda habitat with families settled at the glass. Low stools and a card that explains what the animal is doing extend a stop like this from seconds to minutes. Photo: KQuhen, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["giant-panda", "meerkat"]
            },
            {
                title: "Ideas that use a phone without crowding the glass",
                paragraphs: [
                    "A phone is fine if the task is to look at the animal through it and then put it away. The task should be an identification, a comparison or a count, not a video. That is the design logic behind a species-spotting Challenge: the capture is a live photo of an animal, the app identifies it, and the visitor moves on to find the next one. A gallery upload does not count, and if the campaign is live-only neither does an Instagram import.",
                    "Pair digital tasks with the slow ideas above rather than running them against each other. A Challenge that asks for 15 different animals and a keeper-talk schedule that tells people where the animals are active will send the same families to the same quiet habitats."
                ],
                inlineLinks: [familyZooUseCase, post(blogHrefs.zooExplorers, "How zoos can turn visitors into active wildlife explorers")]
            },
            {
                title: "A Challenge is a rule set, not a coupon",
                paragraphs: [
                    "If you sponsor an AnimalDex Challenge, guests join free and complete a published objective. No paid entry. No random winner. No prize pool. That keeps the activity on the right side of a sweepstake, and it means the reward is an achievement on the visitor's account rather than something you have to fund, insure or post.",
                    "Pair it with what you already run: an exhibition month, a new habitat opening, or a school-holiday window. The Challenge should name the behaviour you want, more different animals noticed or more days people come back, not a prize. Say which objective you want when you enquire; AnimalDex configures the campaign with you, and there is no self-serve portal."
                ],
                inlineLinks: [earnRelatedLinks.sponsor, howSponsorLink],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets/paris-zoo-visitors.webp",
                        alt: "Visitors lined along the glass of a sea lion pool at a zoo as a sea lion swims past underwater",
                        width: 1400,
                        height: 933,
                        caption: "Visitors along the underwater glass of a sea lion pool. An objective that counts different animals, not speed, keeps a crowd like this spread across the site. Photo: Guilhem Vellut from Paris, France, CC BY 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Budgeting in staff hours, not prize money",
                paragraphs: [
                    "The honest budget for an interactive program is time. A keeper talk schedule costs an afternoon of planning and a line on the map. A quiet hour costs one host. A Challenge costs a one-page brief, two signs, a mention in the pre-visit email and whatever AnimalDex agrees with you for the campaign; ask about that in the enquiry rather than assuming. What none of them costs is a prize pool, because none of them has one.",
                    "If a proposal arrives with a prize budget attached, ask what behaviour the prize buys. Usually it buys entries, not looking."
                ]
            },
            {
                title: "Measuring whether any of it worked",
                paragraphs: [
                    "Pick one measure per idea before you launch, from the table above. Stop rates and hold times at two or three habitats, sampled by an evaluator on the same weekdays before and during the program, are enough for most decisions. Add one exit-survey question about which zones people reached. For a Challenge, AnimalDex can talk about joins and completions after the window; it is not a live analytics suite and we will not pretend otherwise."
                ],
                pullQuote: "The test for any interactive idea: does it make someone look longer at an animal, or at something else?",
                speciesSlugs: ["giraffe", "ring-tailed-lemur"]
            }
        ],
        faq: [
            {
                question: "What are good interactive zoo marketing ideas?",
                answer: "The ones that make people look at animals longer. Keeper-talk schedules printed on the map, quiet hours before opening, species ID cards at the viewing line, sketching stools, timed feeding encounters and a free-to-join species-spotting Challenge all do that. Ideas that reward speed, or that replace the animal with a screen, tend to crowd the glass and shorten stops."
            },
            {
                question: "How do I increase dwell time at a zoo?",
                answer: "Lower the pace at a few habitats and give people a reason to reach the quiet ones. Stools, comparison cards and keeper talks lengthen individual stops. A whole-site objective, such as capturing 15 different animals during a visit, improves route coverage. Measure with observed stop rates and hold times before and during the program, not with guesswork."
            },
            {
                question: "Is a zoo challenge with prizes a sweepstake?",
                answer: "It can be, which is why an AnimalDex Sponsored Challenge has no prize pool. Guests join free, there is no random draw, and completion is deterministic against published rules. The reward is an achievement on the visitor's account. Cash rewards are not live and should not be advertised to visitors."
            },
            {
                question: "How much does an interactive zoo program cost?",
                answer: "Mostly staff time. A keeper-talk schedule or quiet hour costs a few hours of planning and one host. Printed cards and stools are a one-off. A Challenge needs a one-page brief, signage and a pre-visit mention; ask AnimalDex about campaign costs when you enquire. Nothing in this list needs a prize budget."
            }
        ],
        sources: [
            {label: "Association of Zoos and Aquariums (AZA)", href: "https://www.aza.org/"},
            {label: "British and Irish Association of Zoos and Aquariums (BIAZA)", href: "https://biaza.org.uk/"},
            {label: "Smithsonian's National Zoo and Conservation Biology Institute", href: "https://nationalzoo.si.edu/"}
        ]
    }),
    earnBlogPost({
        slug: "how-aquariums-can-use-digital-wildlife-challenges-to-increase-engagement",
        canonicalUrl: `https://animaldex.app${blogHrefs.aquariumChallenges}`,
        title: "How Aquariums Can Use Digital Wildlife Challenges",
        description:
            "Aquarium guests already photograph tanks. How to turn that into a finished objective: challenge designs, live-only rules, and metrics that work indoors.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-aquariums-can-use-digital-wildlife-challenges-to-increase-engagement"),
        readingMinutes: 6,
        tags: ["sponsored-challenges", "aquariums"],
        searchIntents: [
            "aquarium visitor engagement",
            "aquarium marketing campaign",
            "digital aquarium challenge",
            "aquarium gamification ideas",
            "aquarium exhibition engagement",
            "how to increase aquarium dwell time"
        ],
        speciesSlugs: ["moon-jellyfish", "clownfish", "green-sea-turtle", "nurse-shark", "sea-otter"],
        relatedSlugs: [
            "how-zoos-can-turn-visitors-into-active-wildlife-explorers",
            "what-is-a-sponsored-wildlife-challenge",
            "how-animaldex-sponsored-challenges-work-for-businesses"
        ],
        tableOfContents: [
            "The tank is already a camera trap",
            "What is different about an aquarium",
            "Challenge designs for an aquarium",
            "Live-only is the useful switch",
            "What a visitor actually sees",
            "Metrics that survive a dark building",
            "Pitfalls: flash, touch pools and privacy",
            "Who to talk to"
        ],
        sections: [
            {
                title: "The tank is already a camera trap",
                paragraphs: [
                    "Guests photograph jellyfish, then leave. The jellyfish gallery is the most photographed room in almost every aquarium because it is dark, blue and slow, and the photos look good without effort. The rest of the building gets a fraction of that attention. A Challenge gives the visit a finish line: a set of different indexed animals across the whole building, or a qualifying capture count during an exhibition window.",
                    "That matters because aquariums are, per square metre, the densest species collections in the visitor-attraction world. A single reef tank can hold more identifiable species than an entire zoo zone. An objective that counts different animals rewards reading the tank rather than glancing at it."
                ],
                inlineLinks: [earnRelatedLinks.sponsor],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-aquariums-can-use-digital-wildlife-challenges-to-increase-engagement/jellyfish-tank-visitors.webp",
                        alt: "Silhouetted visitors holding up phones in front of a blue-lit jellyfish tank",
                        width: 1400,
                        height: 928,
                        caption: "Visitors photographing a jellyfish tank. The habit is already there; a Challenge gives it a target beyond this one room. Photo: shankar s. from Dubai, united arab emirates, CC BY 2.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["moon-jellyfish"]
            },
            {
                title: "What is different about an aquarium",
                paragraphs: [
                    "Three things. The building is dark, so capture quality is lower and a strict Grade floor will frustrate people. Many animals are small and fast, so species-level identification is harder than at a zoo, and a group-level identity is often the honest answer. And the whole visit happens indoors within a small footprint, so a venue radius is tight and a GPS fix can be unreliable in the middle of the building.",
                    "Design around those. Prefer unique indexed animals over a Grade-based objective. Set the target so that the big, slow, well-lit animals (turtle, rays, the shark in the tunnel) get people started and the small reef fish get them finishing. Bind the campaign to the venue, but expect AnimalDex to confirm with you how the indoor radius should behave before launch."
                ]
            },
            {
                title: "Challenge designs for an aquarium",
                paragraphs: [
                    "These three designs map to the three objective types AnimalDex supports: unique indexed animals, qualifying capture count, and active capture days."
                ],
                cards: [
                    {
                        label: "Whole-building collector",
                        body: "Objective: 12 unique indexed animals. Scope: venue-bound, live-only, imports blocked. Window: 30 days over an exhibition. Starts easy in the tunnel, finishes in the reef galleries. Measure with stop rates in the galleries after the tunnel."
                    },
                    {
                        label: "Exhibition opener",
                        body: "Objective: 5 qualifying captures. Scope: venue-bound, live-only, type tag matched to the exhibition theme where the catalog supports it. Window: the first two weeks of the exhibition. Measure with hold time at the exhibition tanks."
                    },
                    {
                        label: "Annual pass comeback",
                        body: "Objective: 4 active capture days. Scope: venue-bound. Window: 14 days over a half-term. Aimed at pass holders who visit once and lapse. Measure with pass scans in the window against the same window last year."
                    }
                ],
                speciesSlugs: ["green-sea-turtle", "nurse-shark", "clownfish"]
            },
            {
                title: "Live-only is the useful switch",
                paragraphs: [
                    "If imports are blocked and live camera captures are required, people cannot complete the Challenge from a screensaver or an old holiday album. That is the difference between engagement and a screenshot contest. The rule is published when a guest joins, so nobody is surprised at the end.",
                    "A capture is a live photo taken in the AnimalDex app and identified against the catalog. Gallery uploads are never captures. Instagram imports can become captures after the visitor reviews species and historical location, but a live-only campaign ignores them for the objective. Achievement rewards mark completion. Do not advertise cash; cash rewards are not live."
                ],
                inlineLinks: [whatSponsoredLink, post(blogHrefs.whatSponsoredChallenge, "What is a Sponsored Wildlife Challenge?")]
            },
            {
                title: "What a visitor actually sees",
                paragraphs: [
                    "In the app, the Challenge appears with your name as sponsor, the objective in one sentence (for example, capture 12 different qualifying entries at the aquarium), the window, and the rules: must be recorded at the venue, live captures only. The visitor joins free and accepts the rules version. As they capture, a progress bar shows how many entries count towards the target. When they finish, an achievement named for your campaign is granted to their account.",
                    "That is the whole experience. There is no separate sponsor app, no code to type in, and nothing for your front desk to redeem."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-aquariums-can-use-digital-wildlife-challenges-to-increase-engagement/aquarium-tunnel.webp",
                        alt: "Visitors standing and sitting inside a curved underwater aquarium tunnel with light rippling through the water above",
                        width: 1400,
                        height: 932,
                        caption: "An acrylic tunnel is where most whole-building Challenges start: large, slow animals that are easy to capture, before the harder reef galleries. Photo: Sander van der Wel from Netherlands, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Metrics that survive a dark building",
                paragraphs: [
                    "Observation still works indoors; it is just harder to do unobtrusively. Pick two galleries past the tunnel and sample stop rates and hold times before and during the window. Ticketing gives you total dwell if you scan on exit. Pass scans give you repeat visits."
                ],
                table: {
                    columns: ["Metric", "Source", "Before / during comparison"],
                    rows: [
                        {cells: ["Stop rate in post-tunnel galleries", "Observer sample, same weekdays and hours", "Did the Challenge move people past the tunnel?"]},
                        {cells: ["Hold time at exhibition tanks", "Observer stopwatch sample", "Did people look, or glance?"]},
                        {cells: ["Total visit length", "Entry and exit scans", "Did the whole visit get longer?"]},
                        {cells: ["Pass-holder repeat visits", "Membership scans in window vs last year", "Did lapsed holders come back?"]},
                        {cells: ["Joins and completions", "AnimalDex, after the window", "How many took the objective seriously?"]}
                    ]
                }
            },
            {
                title: "Pitfalls: flash, touch pools and privacy",
                paragraphs: [
                    "Flash is the aquarium-specific welfare and optics problem. Most aquariums already ban it; put it in the Challenge rules too, because a visitor who joins a photo objective will reach for it. Touch pools are not capture opportunities, and the rules should say captures are of animals in tanks, not in hands.",
                    "Over-gamifying looks like a leaderboard in a corridor that is already too narrow. Prefer objectives that spread people out. On privacy: the visitor uses their own AnimalDex account, you collect nothing, and the post-window conversation with AnimalDex is about aggregate participation, not individuals."
                ]
            },
            {
                title: "Who to talk to",
                paragraphs: [
                    "Education and marketing usually share this brief. Send AnimalDex the venue, dates, the objective you prefer, and whether the Challenge should stay inside the building. We configure it with you. There is no sponsor login and no self-serve portal."
                ],
                inlineLinks: [howSponsorLink, post(blogHrefs.sponsoredForBusiness, "How AnimalDex Sponsored Challenges work for businesses")],
                pullQuote: "The jellyfish room gets the photos. The objective is to get the rest of the building the attention.",
                speciesSlugs: ["sea-otter"]
            }
        ],
        faq: [
            {
                question: "How can an aquarium increase visitor engagement?",
                answer: "Give the visit a finish line that spreads people past the jellyfish room and the tunnel. A free-to-join species-spotting Challenge that counts different animals across the building does that without staff at every tank. Pair it with keeper talks and no-flash rules, and measure with observed stop rates in the galleries people usually skip."
            },
            {
                question: "What is a digital wildlife challenge for an aquarium?",
                answer: "A time-boxed objective in the AnimalDex app, sponsored by the aquarium, that visitors join free. Typical objectives are a set number of different indexed animals or a qualifying capture count during an exhibition window. Captures are live photos taken in the app; a live-only rule ignores imports. Completion grants an achievement, not cash."
            },
            {
                question: "Can visitors complete an aquarium challenge from old photos?",
                answer: "Not if the campaign is live-only and venue-bound. Gallery uploads are never captures in AnimalDex. Instagram imports can become captures after review, but a live-only Challenge ignores them for the objective, and a venue rule requires captures to be recorded at the aquarium during the window."
            },
            {
                question: "Does flash photography harm aquarium animals?",
                answer: "Most aquariums ban flash as a precaution, and a photo-based Challenge should repeat that ban in its rules. Whatever the evidence for a given species, the optics of a crowd firing flashes at a tank are bad for the venue. AnimalDex captures work in low light, and the identification does not need a flash."
            }
        ],
        sources: [
            {label: "Monterey Bay Aquarium", href: "https://www.montereybayaquarium.org/"},
            {label: "Britannica: Aquarium", href: "https://www.britannica.com/science/aquarium"},
            {label: "Association of Zoos and Aquariums (AZA)", href: "https://www.aza.org/"}
        ]
    }),
    earnBlogPost({
        slug: "gamification-ideas-for-wildlife-parks-and-nature-attractions",
        canonicalUrl: `https://animaldex.app${blogHrefs.parkGamification}`,
        title: "Gamification Ideas for Wildlife Parks and Nature Attractions",
        description:
            "Gamification at a wildlife park should make people look longer, not run. Slow game loops, challenge designs for reserves and safari parks, and metrics.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("gamification-ideas-for-wildlife-parks-and-nature-attractions"),
        readingMinutes: 6,
        tags: ["sponsored-challenges", "wildlife parks"],
        searchIntents: [
            "wildlife park gamification",
            "nature attraction engagement",
            "safari park marketing",
            "nature reserve visitor engagement ideas",
            "gamification for nature reserves",
            "wildlife trail ideas for families"
        ],
        speciesSlugs: ["red-deer", "fallow-deer", "barn-owl", "red-fox", "mallard"],
        relatedSlugs: [
            "interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets",
            "how-tourism-boards-can-build-wildlife-discovery-campaigns",
            "what-is-a-sponsored-wildlife-challenge"
        ],
        tableOfContents: [
            "If it makes people sprint, it is the wrong game",
            "Slow loops versus fast loops",
            "Challenge designs by venue type",
            "What AnimalDex can run",
            "Ideas that stay offline",
            "Briefing rangers and volunteers",
            "Measuring a park without turnstiles",
            "Pitfalls: disturbance, access and privacy"
        ],
        sections: [
            {
                title: "If it makes people sprint, it is the wrong game",
                paragraphs: [
                    "Points for speed turn a hide into a queue. A leaderboard that rewards the most sightings in an hour sends people pounding down a boardwalk, flushing the very birds the hide was built to watch. A better loop is slower: unique animals, active days, or a Grade floor that rewards a careful photo over a hurried one.",
                    "Wild animals also do not keep zoo hours. A park Challenge has to be honest that a red deer, a barn owl or a kingfisher may not show up on a given afternoon. That is the whole point of a window measured in weeks rather than hours."
                ],
                inlineLinks: [earnRelatedLinks.sponsor],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/gamification-ideas-for-wildlife-parks-and-nature-attractions/boardwalk-nature-park.webp",
                        alt: "A wooden boardwalk with rope handrails crossing a saltmarsh at a nature reserve under a grey sky",
                        width: 1400,
                        height: 1050,
                        caption: "A saltmarsh boardwalk at a nature reserve. Slow objectives keep people on it at a walking pace; speed objectives turn it into a running track. Photo: PAUL FARMER, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["red-deer", "barn-owl"]
            },
            {
                title: "Slow loops versus fast loops",
                paragraphs: [
                    "Game designers talk about loops: the thing a player does, the feedback they get, and the reason they do it again. At a wildlife park the loop should be look, identify, record, move on. The feedback is the identification and the progress bar. The reason to do it again is the next different animal. Every design below is judged on whether it keeps that loop slow."
                ],
                table: {
                    columns: ["Mechanic", "Loop speed", "Effect on a hide or trail", "Verdict"],
                    rows: [
                        {cells: ["Most sightings per hour leaderboard", "Fast", "Crowds hides, flushes birds", "Avoid"]},
                        {cells: ["Unique species over 30 days", "Slow", "Spreads visits across habitats and weeks", "Use"]},
                        {cells: ["Active days over two weeks", "Slow", "Rewards coming back, not rushing", "Use"]},
                        {cells: ["Minimum capture Grade", "Slow", "Rewards a steady, well-framed photo", "Use with a modest floor"]},
                        {cells: ["Timed checkpoints with a countdown", "Fast", "People run between points", "Avoid"]},
                        {cells: ["Season-specific themes (fungi, dragonflies)", "Slow", "Sends people to the right place at the right time", "Use"]},
                        {cells: ["Dawn-only or dusk-only windows", "Slow", "Fewer people, better sightings", "Use for members"]}
                    ]
                }
            },
            {
                title: "Challenge designs by venue type",
                paragraphs: [
                    "A wetland reserve, a deer park and a drive-through safari park want different things from a Challenge. The objective types are the same; the scope and the target change."
                ],
                cards: [
                    {
                        label: "Wetland or woodland reserve",
                        body: "Objective: 10 unique indexed animals. Scope: venue radius, live-only, Bird type tag if the brief is about the hides. Window: 30 days in a migration month. Measure with hide visitor-book entries and observed boardwalk pace."
                    },
                    {
                        label: "Deer park or estate",
                        body: "Objective: 6 active capture days. Scope: venue radius. Window: four weeks across the autumn rut, when red and fallow deer are most visible. Rules insist on distance from the herd. Measure with car-park counts on weekdays."
                    },
                    {
                        label: "Drive-through safari park",
                        body: "Objective: 8 unique indexed animals. Scope: venue radius, live-only. Window: a school holiday. Captures from inside the vehicle only, windows up where the park requires it. Measure with time on the drive-through loop from gate timestamps."
                    }
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/gamification-ideas-for-wildlife-parks-and-nature-attractions/boardwalk-nature-park-b.webp",
                        alt: "A lone walker photographing from a narrow wooden boardwalk crossing tall grass in front of a forest wall",
                        width: 1400,
                        height: 933,
                        caption: "A boardwalk through forest-edge grassland. A unique-animals objective rewards the person who stops here, not the one who reaches the end first. Photo: Pearl Aketch, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["fallow-deer", "mallard"]
            },
            {
                title: "What AnimalDex can run",
                paragraphs: [
                    "A Sponsored Challenge can require a setting tag, a type tag, a minimum Grade, a venue radius, and live-only captures. It can block imports so the objective has to be completed on site during the window. The objective is one of three: unique indexed animals, a qualifying capture count, or active capture days. Join is free. It cannot, today, pay cash or run a prize pool; the reward is an achievement on the visitor's account.",
                    "That is enough for a half-term program or a seasonal trail without inventing a park-branded mini-game you then have to maintain. AnimalDex configures the campaign with you after an enquiry. There is no self-serve portal."
                ],
                inlineLinks: [whatSponsoredLink, post(blogHrefs.fieldChallenges, "Wildlife photography challenges that make you better in the field")]
            },
            {
                title: "Ideas that stay offline",
                paragraphs: [
                    "Stamp cards, dawn-only walks, and phones-down hours at the hide still belong. A chalkboard at the visitor centre listing what was seen yesterday is the oldest gamification a reserve has, and it works because it sets expectations honestly. Use a digital Challenge when you want a shared rule set guests already understand from the app, and keep the hide quiet with a sign rather than a feature."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/gamification-ideas-for-wildlife-parks-and-nature-attractions/young-birdwatchers.webp",
                        alt: "Two young children lying back on a boardwalk looking up through binoculars at a nature reserve",
                        width: 1000,
                        height: 750,
                        caption: "Young birdwatchers with binoculars on a reserve boardwalk. The best park games end with the phone in a pocket and the eyes on the sky. Photo: Nick Moyes, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Briefing rangers and volunteers",
                paragraphs: [
                    "Rangers and hide volunteers are the people visitors will ask. Give them one card: the objective, where to join (free, in the AnimalDex app), what counts (live photos inside the reserve during the window), the reward (an achievement, no prize), and the distance and disturbance rules you already enforce. Ask them to mention what has been active that week; that single sentence converts a checklist into a plan."
                ],
                inlineLinks: [post(blogHrefs.ethicalGuide, "What makes a great ethical wildlife guide")]
            },
            {
                title: "Measuring a park without turnstiles",
                paragraphs: [
                    "Most reserves have no entry scan. Use what you have: car-park counts on fixed weekdays, hide visitor books, visitor-centre footfall counters, and a two-question exit survey at the café. Sample before the window and during it. After the window, AnimalDex can talk about joins and completions in aggregate. That combination is enough to decide whether to run the Challenge again next season."
                ]
            },
            {
                title: "Pitfalls: disturbance, access and privacy",
                paragraphs: [
                    "Disturbance is the big one. Rules should say: stay on paths, keep your distance, no calls or lures, no flash at dusk. Over-gamifying looks like people leaving the path for a better angle, and the Challenge should never reward that. Access is the second: a venue radius should match the public parts of the site, not the sensitive areas you close in the breeding season. Privacy is the third: visitors use their own account, you collect nothing, and no individual data comes back to the park."
                ],
                pullQuote: "The loop should be look, identify, record, move on. Anything that speeds it up is working against the hide."
            }
        ],
        faq: [
            {
                question: "What is gamification for a wildlife park?",
                answer: "It is adding a game loop, usually a published objective with progress and a reward, to a visit. At a wildlife park the loop should be slow: look, identify, record, move on. Objectives such as different animals over a month or active days over a fortnight do that. Speed leaderboards and timed checkpoints do the opposite and crowd hides."
            },
            {
                question: "How do you gamify a nature reserve without disturbing wildlife?",
                answer: "Reward looking, not rushing. Use objectives based on unique animals, active days or a modest capture Grade floor, over windows measured in weeks. Put path, distance, no-lure and no-flash rules in the Challenge text. Match the venue radius to the public areas. Brief rangers to mention what is active rather than where to run."
            },
            {
                question: "Can a safari park run a species-spotting challenge?",
                answer: "Yes. A drive-through park suits a unique-animals objective with a venue radius and live-only captures from inside the vehicle. A school-holiday window works well. The reward in AnimalDex is an achievement, not cash, and there is no prize draw, so the park avoids sweepstake rules and keeps the focus on the animals on the loop."
            },
            {
                question: "How do you measure visitor engagement at a nature reserve?",
                answer: "With the counters you already have. Car-park counts on fixed weekdays, hide visitor books, footfall counters at the visitor centre and a short exit survey give a before-and-during comparison. Add aggregate joins and completions from AnimalDex after a Challenge window. None of it requires a sponsor dashboard, and none exists."
            }
        ],
        sources: [
            {label: "RSPB (Royal Society for the Protection of Birds)", href: "https://www.rspb.org.uk/"},
            {label: "The Wildlife Trusts", href: "https://www.wildlifetrusts.org/"},
            {label: "US National Park Service: Watching Wildlife", href: "https://www.nps.gov/subjects/watchingwildlife/index.htm"},
            {label: "Leave No Trace Center for Outdoor Ethics", href: "https://lnt.org/"}
        ]
    }),
    earnBlogPost({
        slug: "how-tourism-boards-can-build-wildlife-discovery-campaigns",
        canonicalUrl: `https://animaldex.app${blogHrefs.tourismCampaigns}`,
        title: "How Tourism Boards Can Build Wildlife Discovery Campaigns",
        description:
            "Destination wildlife campaigns fail when they promise animals on cue. How to brief a region-wide spotting challenge, pick dates and scope, and measure it.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-tourism-boards-can-build-wildlife-discovery-campaigns"),
        readingMinutes: 6,
        tags: ["sponsored-challenges", "tourism"],
        searchIntents: [
            "tourism wildlife campaign",
            "destination wildlife marketing",
            "wildlife tourism campaign",
            "destination marketing wildlife ideas",
            "regional wildlife trail campaign",
            "responsible wildlife tourism campaign"
        ],
        speciesSlugs: ["atlantic-puffin", "red-deer", "european-robin", "peregrine-falcon"],
        relatedSlugs: [
            "gamification-ideas-for-wildlife-parks-and-nature-attractions",
            "how-to-find-ethical-wildlife-experiences-while-traveling",
            "what-is-a-sponsored-wildlife-challenge"
        ],
        tableOfContents: [
            "Do not sell a tiger you cannot schedule",
            "Region, dates, objective",
            "Three campaign designs for a destination",
            "Signage, partners and the people who already know the ground",
            "Measuring a campaign across a whole region",
            "Pitfalls: honeypots, wildlife crime and privacy",
            "What to send in the first email"
        ],
        sections: [
            {
                title: "Do not sell a tiger you cannot schedule",
                paragraphs: [
                    "Wildlife tourism copy often over-promises. A brochure that says see puffins is writing a cheque the cliffs cash only between April and August, and only if the weather allows a boat. A Challenge should never say see X. It should say look for qualifying animals in this window, under these rules. Sightings stay uncertain. That is the honest product, and it is also the one travellers trust after the first trip.",
                    "The upside of honesty is that a region can sell what it actually has in abundance: common birds, deer, seals on a known haul-out, insects in a meadow. An objective that counts different animals makes a robin on a hotel wall worth the same as a rarity, which is exactly how a first-time wildlife tourist experiences it."
                ],
                inlineLinks: [earnRelatedLinks.sponsor, post(blogHrefs.ethicalTravelExperiences, "How to find ethical wildlife experiences while traveling")],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-tourism-boards-can-build-wildlife-discovery-campaigns/tourists-watching-elephants.webp",
                        alt: "A large crowd of tourists with cameras and phones watching elephants at a wildlife sanctuary in Nairobi, Kenya",
                        width: 1400,
                        height: 934,
                        caption: "Tourists at a scheduled viewing at an elephant sanctuary in Nairobi. A destination campaign can point people at moments like this; it should not promise what the animals will do. Photo: Daniel Case, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "Region, dates, objective",
                paragraphs: [
                    "A destination campaign has three settings. The region: a radius around a town, or a list of venues and reserves that count. The dates: a season that matches what is visible, usually four to six weeks. The objective: unique indexed animals, a qualifying capture count, or active capture days. For a tourism board, unique animals over a season is the usual pick, because it rewards exploring more than one site.",
                    "Send AnimalDex the destination, the campaign window, and which objective you want. A radius or venue list keeps the activity in the places you actually want visitors. Live-only captures keep the work in the region rather than in an archive. Achievement rewards mark completion. Cash is not live. There is no self-serve portal; AnimalDex configures the campaign with you."
                ],
                table: {
                    columns: ["Setting", "Options", "Advice for a tourism board"],
                    rows: [
                        {cells: ["Scope", "Radius around a point, or a venue list", "Use a venue list if you have partner reserves; a radius if the draw is a coastline or valley"]},
                        {cells: ["Window", "Days to weeks", "Four to six weeks in the season the animals are actually visible"]},
                        {cells: ["Objective", "Unique animals, capture count, active days", "Unique animals for exploration; active days for longer stays"]},
                        {cells: ["Capture rules", "Live-only, imports blocked, Grade floor, type or setting tag", "Live-only and imports blocked; skip the Grade floor for a general audience"]},
                        {cells: ["Reward", "Achievement on the collector's account", "Name it for the region and season; do not promise cash"]}
                    ]
                }
            },
            {
                title: "Three campaign designs for a destination",
                paragraphs: [
                    "The same mechanics, aimed at three different tourism problems: spreading visitors, lengthening stays, and selling the shoulder season."
                ],
                cards: [
                    {
                        label: "Spread the visitors",
                        body: "Objective: 10 unique indexed animals. Scope: a venue list of six partner reserves spread across the region, live-only. Window: six weeks in late spring. Goal: move people off the one honeypot site. Measure with partner footfall and car-park counts."
                    },
                    {
                        label: "Lengthen the stay",
                        body: "Objective: 4 active capture days. Scope: a radius around the main town. Window: a school holiday. Goal: three-night stays instead of day trips. Measure with accommodation occupancy and bed-nights reported by partners."
                    },
                    {
                        label: "Sell the shoulder season",
                        body: "Objective: 8 unique indexed animals. Scope: the coast radius, live-only. Window: October, when migration is on and hotels are empty. Goal: a reason to come in autumn. Measure with October occupancy against the prior year."
                    }
                ],
                speciesSlugs: ["atlantic-puffin", "red-deer", "peregrine-falcon"]
            },
            {
                title: "Signage, partners and the people who already know the ground",
                paragraphs: [
                    "A regional Challenge lives or dies on partners. Visitor centres, reserves, hotels and cafés need the same one-paragraph brief: the objective, that it is free to join in the AnimalDex app, that captures are live photos taken in the region during the window, and that the reward is an achievement. An information board at a trailhead that lists the species people are likely to see is worth more than a poster of the campaign logo.",
                    "If approved AnimalDex Wildlife Guides already list in the area, travellers can book a cash-on-the-day outing separately. That marketplace is not the Challenge, AnimalDex does not collect the Guide's cash, and the Guides program is in beta. But a Guide who knows which bay the seals use this month is the best conversion tool a wildlife campaign has."
                ],
                inlineLinks: [earnRelatedLinks.marketplace, earnRelatedLinks.guide, post(blogHrefs.chooseLocalGuide, "How to choose a local wildlife guide")],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-tourism-boards-can-build-wildlife-discovery-campaigns/nature-reserve-information-board.webp",
                        alt: "An information board at a Norwegian nature reserve showing photographs and drawings of the wetland birds found there",
                        width: 1400,
                        height: 933,
                        caption: "A reserve information board listing the wetland birds visitors can expect. Signage like this sets honest expectations and doubles as a species list for a Challenge. Photo: Frankemann, CC BY-SA 4.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["european-robin"]
            },
            {
                title: "Measuring a campaign across a whole region",
                paragraphs: [
                    "You will not get a single number. Combine partner footfall at the reserves on your venue list, occupancy and bed-nights from accommodation partners, car-park counts at trailheads on fixed weekdays, and a short visitor survey asking what brought you here and which sites you visited. After the window, AnimalDex can talk about joins and completions in aggregate. Compare everything to the same weeks the previous year, because season swamps everything else in wildlife tourism."
                ]
            },
            {
                title: "Pitfalls: honeypots, wildlife crime and privacy",
                paragraphs: [
                    "Over-gamifying at a regional scale looks like a crowd at one nest site. Never build an objective around a single rare animal at a single location; use venue lists and unique-animal targets that spread people out. Say nothing about nest, roost or den locations in campaign copy, and ask partners to do the same.",
                    "Welfare optics apply to the whole region: drones over seal haul-outs, cars stopping on verges, people on cliff edges. Put the rules in the Challenge text. On privacy, visitors use their own AnimalDex account, the board collects nothing, and no individual traveller data comes back to you."
                ]
            },
            {
                title: "What to send in the first email",
                paragraphs: [
                    "Organisation and website. The season and why. The region as a radius or a venue list. Which objective you want and roughly what target. Whether live-only matters (it usually does). Whether you want an achievement now, knowing cash rewards are not live and should not be promised to travellers. AnimalDex replies with a configuration to review."
                ],
                inlineLinks: [howSponsorLink, post(blogHrefs.sponsoredForBusiness, "How AnimalDex Sponsored Challenges work for businesses")],
                pullQuote: "Sell what the region has in abundance. Let the rarities be a surprise."
            }
        ],
        faq: [
            {
                question: "How do tourism boards promote wildlife without over-promising?",
                answer: "By selling the looking rather than the sighting. A campaign should say which animals are likely in which season, under which rules, and never guarantee a specific species. An objective that counts different animals makes common wildlife worth finding and keeps rarities a bonus. Honest expectations are what bring wildlife tourists back for a second trip."
            },
            {
                question: "What is a wildlife discovery campaign?",
                answer: "A time-boxed, region-wide invitation to look for local wildlife, usually with a published objective and a way to record what you find. In AnimalDex it is a Sponsored Challenge: travellers join free, capture live photos inside the region during the window, and earn an achievement when they reach the target. There is no cash prize and no draw."
            },
            {
                question: "How long should a destination wildlife campaign run?",
                answer: "Four to six weeks in the season the animals are actually visible. Shorter windows punish people who get bad weather; longer ones lose urgency. Match the window to a migration, a rut, a breeding season or a school holiday, and make the objective achievable across several sites so a single washed-out day does not end the trip."
            },
            {
                question: "Can a tourism board measure the results of a wildlife campaign?",
                answer: "Partly. Partner footfall, accommodation occupancy, trailhead car-park counts and a short visitor survey, all compared with the same weeks last year, show whether visitors moved or stayed longer. AnimalDex can report aggregate joins and completions after the window. There is no live sponsor dashboard, and individual traveller data is not shared."
            }
        ],
        sources: [
            {label: "UN Tourism (formerly UNWTO)", href: "https://www.unwto.org/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"},
            {label: "RSPB (Royal Society for the Protection of Birds)", href: "https://www.rspb.org.uk/"},
            {label: "Kenya Wildlife Service", href: "https://www.kws.go.ke/"}
        ]
    }),
    earnBlogPost({
        slug: "what-is-a-sponsored-wildlife-challenge",
        canonicalUrl: `https://animaldex.app${blogHrefs.whatSponsoredChallenge}`,
        title: "What Is a Sponsored Wildlife Challenge?",
        description:
            "A sponsored wildlife challenge is a free-to-join, time-boxed campaign with a published objective and an achievement reward. What it is and what counts.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("what-is-a-sponsored-wildlife-challenge"),
        readingMinutes: 6,
        tags: ["sponsored-challenges"],
        searchIntents: [
            "sponsored wildlife challenge",
            "what is a wildlife challenge",
            "animal challenge campaign",
            "wildlife spotting challenge app",
            "species spotting challenge rules",
            "sponsored challenge vs sweepstake"
        ],
        speciesSlugs: ["humboldt-penguin", "red-deer", "european-robin", "mallard"],
        relatedSlugs: [
            "how-animaldex-sponsored-challenges-work-for-businesses",
            "how-zoos-can-turn-visitors-into-active-wildlife-explorers",
            "how-tourism-boards-can-build-wildlife-discovery-campaigns"
        ],
        tableOfContents: [
            "A campaign, not a battle",
            "The anatomy of a Challenge",
            "What counts as a capture",
            "What you can require",
            "What the collector sees",
            "What you cannot run today",
            "Who sponsors one, and why"
        ],
        sections: [
            {
                title: "A campaign, not a battle",
                paragraphs: [
                    "In the AnimalDex app, Challenges means sponsored campaigns. Collectors join at no cost, accept the rules, and work toward an objective during a window. A sponsor, a zoo, an aquarium, a park, a tourism board, a conservation group or an outdoor brand, puts its name on the campaign and on the achievement at the end. Apple is not a sponsor of those Challenges.",
                    "The public website's /challenges URL is different: it redirects to animal-versus-animal comparison pages. Those SEO pages are not this product, and neither is Arena PvP inside the app. A Sponsored Challenge has no opponent. The only thing a collector is up against is the objective."
                ],
                inlineLinks: [whatSponsoredLink, earnRelatedLinks.sponsor],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-is-a-sponsored-wildlife-challenge/hikers-photographing-red-deer.webp",
                        alt: "Four hikers on a green mountain trail photographing a red deer stag standing a few metres from them",
                        width: 1400,
                        height: 1050,
                        caption: "Hikers photographing a red deer beside a mountain trail. A live photo of an animal, taken in the app, is the unit a Challenge counts. Photo: Cybularny, CC0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["red-deer"]
            },
            {
                title: "The anatomy of a Challenge",
                paragraphs: [
                    "Every Sponsored Challenge is built from the same parts. Knowing them makes it much easier to brief one."
                ],
                table: {
                    columns: ["Part", "What it is", "Example"],
                    rows: [
                        {cells: ["Sponsor", "The organisation named on the campaign and the achievement", "A city aquarium"]},
                        {cells: ["Objective", "One of three types: unique indexed animals, qualifying capture count, active capture days", "12 different animals"]},
                        {cells: ["Target", "The number that completes the objective", "12"]},
                        {cells: ["Window", "Start and end, in the sponsor's timezone", "1 to 30 August"]},
                        {cells: ["Scope", "A venue, a radius, or none", "Must be recorded at the aquarium"]},
                        {cells: ["Capture rules", "Live-only, imports blocked, Grade floor, type or setting tag", "Live captures only; imports do not count"]},
                        {cells: ["Rules version", "The text a collector accepts when joining", "Shown in the app before join"]},
                        {cells: ["Reward", "An achievement granted on completion", "Summer Reef Collector achievement"]}
                    ]
                }
            },
            {
                title: "What counts as a capture",
                paragraphs: [
                    "A capture is a live photo taken in the AnimalDex app and identified against the catalog. That identification can be a species or, where the catalog indexes a group, a group-level identity. A gallery upload is not a capture; it never has been. An Instagram import can become a capture after the collector reviews species and historical location, but a Challenge with imports blocked ignores it for the objective.",
                    "Unique means different indexed animals, so three photos of the same mallard count once toward a unique-animals objective. Qualifying means the capture meets every rule on the campaign: inside the venue or radius, inside the window, live if live-only is set, at or above the Grade floor if one is set, and carrying the required tag if one is set."
                ],
                inlineLinks: [post("/blog/how-animaldex-indexes-animals", "How AnimalDex indexes animals"), {text: "AI animal scanner identification app", slug: "ai-animal-scanner-identification-app", href: "/use-cases/ai-animal-scanner-identification-app"}],
                speciesSlugs: ["mallard", "european-robin"]
            },
            {
                title: "What you can require",
                paragraphs: [
                    "Unique indexed animals, qualifying capture count, or active capture days. Optional live-only captures, import blocks, Grade floors, type or setting tags, and a venue or discovery radius. Common starting points are a venue collector (15 different animals in 30 days, live-only, Zoo setting tag), a bird challenge (20 different birds in 30 days), a photography-quality challenge (5 captures at a minimum Grade in 30 days) and an activity streak (5 active days in 14).",
                    "Those are starting points, not a menu. AnimalDex configures the campaign with you after an enquiry, and the rules text is generated from the settings and reviewed before anything is published."
                ],
                cards: [
                    {
                        label: "Venue collector",
                        body: "15 different animals in 30 days, recorded at the venue, live captures only. The default for a zoo, aquarium, wildlife park or sanctuary."
                    },
                    {
                        label: "Bird challenge",
                        body: "20 different qualifying bird entries in 30 days, live captures only. Suits a reserve, a coast or a city-wide birding month."
                    },
                    {
                        label: "Activity streak",
                        body: "Qualifying captures on 5 different days inside a 14-day window. Suits membership comebacks and half-term programs."
                    }
                ]
            },
            {
                title: "What the collector sees",
                paragraphs: [
                    "In the app, the Challenge appears in Missions with the sponsor named, the objective in one sentence, the window, the rules as short bullets, and the reward. The collector joins free, accepts the rules version, and sees a progress count against the target as qualifying captures come in. On completion, the achievement is granted to their account. There is no code to redeem and nothing to show at a front desk."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/what-is-a-sponsored-wildlife-challenge/penguin-exhibit-visitors.webp",
                        alt: "Visitors at a wooden fence watching Humboldt penguins and two keepers at feeding time beside a pool at a wildlife park",
                        width: 1400,
                        height: 1050,
                        caption: "Penguin feeding time at a wildlife park. For a venue collector Challenge, each different animal a visitor captures here counts once toward the target. Photo: Joseph French, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["humboldt-penguin"]
            },
            {
                title: "What you cannot run today",
                paragraphs: [
                    "Paid entry, random winners, prize pools, or live cash grants. Those are out of scope. Achievement rewards are the live completion mark. Deterministic cash rewards may exist later; they are not live and must not be promised to visitors. Because join is free and completion is deterministic, a Sponsored Challenge is not a sweepstake or a lottery.",
                    "There is also no self-serve sponsor portal and no live sponsor dashboard. After the window, AnimalDex can discuss aggregate participation with the sponsor. Individual collector data is not shared."
                ],
                inlineLinks: [howSponsorLink]
            },
            {
                title: "Who sponsors one, and why",
                paragraphs: [
                    "Zoos, to give visitors something to do after they leave the gate. Aquariums, to extend an exhibition into something people can finish on site. Wildlife parks, to turn a visit into a short, rule-based discovery loop without paid entry. Tourism boards, to point travellers at real local wildlife instead of a generic city checklist. Conservation organisations, to invite people to look carefully rather than handle or disturb animals. Outdoor and wildlife brands, to tie a time-boxed Challenge to a place, season or species theme."
                ],
                inlineLinks: [
                    post(blogHrefs.zooExplorers, "How zoos can turn visitors into active wildlife explorers"),
                    post(blogHrefs.aquariumChallenges, "How aquariums can use digital wildlife challenges"),
                    post(blogHrefs.tourismCampaigns, "How tourism boards can build wildlife discovery campaigns")
                ],
                pullQuote: "No opponent, no draw, no prize pool. The only thing a collector is up against is the objective."
            }
        ],
        faq: [
            {
                question: "Is a Sponsored Challenge a lottery?",
                answer: "No. Completion is deterministic against published rules, join is free, and there is no random draw and no prize pool. Everyone who meets the objective inside the window earns the achievement. That is what keeps a Sponsored Challenge outside sweepstake and lottery rules, and it is why cash prizes are not part of the product today."
            },
            {
                question: "What is a sponsored wildlife challenge?",
                answer: "A free-to-join, time-boxed campaign in the AnimalDex app with a sponsor's name on it. Collectors accept the rules and work toward an objective: a number of different indexed animals, a qualifying capture count, or active capture days. Captures are live photos taken in the app. Completing the objective grants an achievement. Cash rewards are not live."
            },
            {
                question: "What counts as a capture in a wildlife challenge?",
                answer: "A live photo taken in the AnimalDex app and identified against the catalog, meeting every rule on the campaign: inside the venue or radius, inside the window, live if live-only is set, at or above any Grade floor, and carrying any required tag. Gallery uploads never count. Instagram imports are ignored when imports are blocked."
            },
            {
                question: "How do I join a Sponsored Challenge?",
                answer: "Open Missions in the AnimalDex app, find the campaign, read the rules and join. It is free, with no Credit entry and no ticket. From then on, qualifying captures count toward the target automatically and a progress count shows how far you are. When you reach the target inside the window, the achievement is granted to your account."
            },
            {
                question: "Can a challenge require photos taken at a specific place?",
                answer: "Yes. A campaign can be bound to a venue or a discovery radius, so only captures recorded there count. Combined with live-only captures and blocked imports, that keeps the objective on site and inside the window. The rules say so before a collector joins, so nobody completes it from an old camera roll by mistake."
            }
        ],
        sources: [
            {label: "World Association of Zoos and Aquariums (WAZA)", href: "https://www.waza.org/"},
            {label: "IUCN Red List of Threatened Species", href: "https://www.iucnredlist.org/"},
            {label: "iNaturalist", href: "https://www.inaturalist.org/"}
        ]
    }),
    earnBlogPost({
        slug: "how-animaldex-sponsored-challenges-work-for-businesses",
        canonicalUrl: `https://animaldex.app${blogHrefs.sponsoredForBusiness}`,
        title: "How AnimalDex Sponsored Challenges Work for Businesses",
        description:
            "How a zoo, aquarium, park or tourism board gets a Challenge live: enquiry, configuration, free collector join, achievement rewards, and the first email.",
        publishedAt,
        updatedAt,
        featuredImage: contentThumb("how-animaldex-sponsored-challenges-work-for-businesses"),
        readingMinutes: 6,
        tags: ["sponsored-challenges"],
        searchIntents: [
            "wildlife app sponsorship",
            "sponsor animal challenge",
            "AnimalDex for businesses",
            "how to sponsor a wildlife challenge",
            "zoo app partnership",
            "sponsored challenge brief template"
        ],
        speciesSlugs: ["giraffe", "white-rhinoceros", "lion", "fallow-deer"],
        relatedSlugs: [
            "what-is-a-sponsored-wildlife-challenge",
            "how-zoos-can-turn-visitors-into-active-wildlife-explorers",
            "interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets"
        ],
        tableOfContents: [
            "You enquire. We configure.",
            "The five steps, in order",
            "Collectors join free",
            "Choosing the objective and scope",
            "Briefing your own staff",
            "Costs, in plain terms",
            "After the window",
            "What to send in the first email"
        ],
        sections: [
            {
                title: "You enquire. We configure.",
                paragraphs: [
                    "There is no self-serve sponsor portal. Send the organisation, purpose, venue or region, dates, objective, and intended reward type. AnimalDex sets up the campaign: objective, target, window, scope, capture rules, the rules text collectors accept, and the achievement. You review it before anything is published. Nothing goes live without your sign-off on the rules and the sponsor name.",
                    "That is deliberate. A Challenge carries your name in front of your visitors, and the rules are what keep it on the right side of sweepstake law and animal-welfare optics. A wizard would let a campaign slip out with a Grade floor nobody can meet or a radius that excludes half the site."
                ],
                inlineLinks: [earnRelatedLinks.sponsor, howSponsorLink],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-animaldex-sponsored-challenges-work-for-businesses/zoo-entrance-visitors.webp",
                        alt: "Families queuing along a stone wall at the entrance gate of a zoo on a sunny day",
                        width: 1400,
                        height: 972,
                        caption: "A queue at a zoo entrance. A Challenge is configured before the window opens so these visitors find it in the app the moment they are inside. Photo: Anthony O'Neil, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                }
            },
            {
                title: "The five steps, in order",
                paragraphs: [
                    "The process is short, and most of the time goes into agreeing the objective."
                ],
                table: {
                    columns: ["Step", "Who does it", "What happens", "Typical lead time"],
                    rows: [
                        {cells: ["1. Tell us the goal", "You", "A zoo launch, an exhibition, a destination season, a conservation week: what should people actually do?", "One email"]},
                        {cells: ["2. Define place, dates, objective", "You, with AnimalDex", "Venue or radius, start and end, unique animals, capture count or active days", "A short call or two emails"]},
                        {cells: ["3. AnimalDex configures the Challenge", "AnimalDex", "Rules, eligibility, presentation and the achievement are set and sent for review", "Days"]},
                        {cells: ["4. Collectors participate free", "Visitors", "They join in AnimalDex, capture under the rules, and earn the achievement when they finish", "The window"]},
                        {cells: ["5. Review what happened", "You, with AnimalDex", "Aggregate participation after the window; no live sponsor analytics suite", "After close"]}
                    ]
                }
            },
            {
                title: "Collectors join free",
                paragraphs: [
                    "No Credit entry. No ticket inside AnimalDex. Visitors find the Challenge in Missions, read the sponsor disclosure and the rules, and join. They accept the rules version and progress against the objective as qualifying captures come in. When they finish, an achievement named for your campaign is granted to their account.",
                    "A capture is a live photo taken in the app and identified against the catalog. Gallery uploads are not captures. If the campaign is live-only with imports blocked, Instagram imports do not count either. That is what makes the objective something that happens at your venue rather than in an archive."
                ],
                inlineLinks: [whatSponsoredLink, post(blogHrefs.whatSponsoredChallenge, "What is a Sponsored Wildlife Challenge?")],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-animaldex-sponsored-challenges-work-for-businesses/safari-park-giraffes-cars.webp",
                        alt: "Giraffes feeding from a tall browse post while a queue of visitor cars winds along the drive-through route of a safari park",
                        width: 1400,
                        height: 1050,
                        caption: "Giraffes and queuing cars on a safari-park drive-through. A venue-bound, live-only Challenge counts captures made on this loop during the window and nothing else. Photo: Gareth James, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["giraffe", "white-rhinoceros"]
            },
            {
                title: "Choosing the objective and scope",
                paragraphs: [
                    "Pick the objective by the behaviour you want. Unique indexed animals for route coverage and exploration. Qualifying capture count with a modest Grade floor for careful looking at one new habitat. Active capture days for repeat visits from members and pass holders. Then pick the scope: a venue for a zoo, aquarium or park; a radius or venue list for a region; none at all only if the goal is to keep people noticing animals after they go home.",
                    "Targets should be reachable by a family in one or two visits. Fifteen different animals at a zoo is a full afternoon. Twenty at an aquarium is a lot of tank reading. Five active days in two weeks is a members-only ask. If in doubt, go lower; a Challenge most people finish does more for you than one most people abandon."
                ],
                cards: [
                    {
                        label: "Venue, one visit",
                        body: "Unique indexed animals, venue-bound, live-only, 30-day window. The most common first campaign for a zoo, aquarium or wildlife park."
                    },
                    {
                        label: "Venue, repeat visits",
                        body: "Active capture days, venue-bound, 14-day window. Aimed at members and annual pass holders who visit once and lapse."
                    },
                    {
                        label: "Region, season",
                        body: "Unique indexed animals across a venue list or radius, live-only, four to six weeks. The tourism-board and conservation-week pattern."
                    }
                ]
            },
            {
                title: "Briefing your own staff",
                paragraphs: [
                    "The front desk, hosts, keepers or rangers need one card: what the objective is, where to join (free, in the AnimalDex app), what counts (live photos at the venue during the window), what the reward is (an achievement, not a prize), and the welfare rules you already enforce. The most useful thing a staff member can add is which animals are active today. Put a line on the map, a sign at the first habitat, and a sentence in the pre-visit email. Do not sign every enclosure."
                ],
                inlineLinks: [post(blogHrefs.zooExplorers, "How zoos can turn visitors into active wildlife explorers"), familyZooUseCase]
            },
            {
                title: "Costs, in plain terms",
                paragraphs: [
                    "There is no prize pool to fund, because there are no prizes; the reward is an achievement on the collector's account. Your internal costs are a one-page brief, signage, and a few hours of staff time. Ask AnimalDex about campaign costs in the enquiry rather than assuming either way. Cash rewards for collectors are not live, so do not budget for them and do not promise them to visitors."
                ],
                media: {
                    type: "image",
                    image: {
                        src: "/images/blog/how-animaldex-sponsored-challenges-work-for-businesses/safari-park-ostriches-cars.webp",
                        alt: "Two ostriches standing between visitor cars on the drive-through road of a safari park",
                        width: 1400,
                        height: 1039,
                        caption: "Ostriches between cars at a safari park. Captures from inside the vehicle count; the rules say so, and the park's own safety rules still apply. Photo: Neil Theasby, CC BY-SA 2.0, via Wikimedia Commons."
                    }
                },
                speciesSlugs: ["lion", "fallow-deer"]
            },
            {
                title: "After the window",
                paragraphs: [
                    "When the Challenge closes, AnimalDex can talk through participation in aggregate: how many joined and how many completed. We do not claim a live sponsor analytics suite that is not in the product, and we do not share individual collector data. Combine the aggregate with your own observation, ticketing and survey work to decide whether to run the next one."
                ]
            },
            {
                title: "What to send in the first email",
                paragraphs: [
                    "Organisation and website. Campaign purpose in one paragraph. Place: a venue, a radius or a venue list. Dates and timezone. Objective preference and a rough target. Whether live-only captures matter. Whether you want an achievement now and a later conversation about cash, knowing cash is not live. That is enough for AnimalDex to send back a configuration to review."
                ],
                inlineLinks: [howSponsorLink, earnRelatedLinks.sponsor],
                pullQuote: "Nothing goes live without your sign-off on the rules and the sponsor name."
            }
        ],
        faq: [
            {
                question: "How can a business sponsor an AnimalDex Challenge?",
                answer: "Email AnimalDex with the organisation name, campaign purpose, venue or region, dates, intended objective and intended reward type. There is no self-serve portal; AnimalDex configures the campaign with you and sends the rules and achievement for review before publishing. Zoos, aquariums, wildlife parks, tourism boards, conservation groups and outdoor brands can enquire."
            },
            {
                question: "Can we launch a Challenge from a dashboard today?",
                answer: "No. There is no self-serve sponsor portal and no live sponsor analytics suite. AnimalDex configures the Challenge after an enquiry, you review the rules and achievement, and after the window closes AnimalDex discusses aggregate participation with you. Individual collector data is not shared."
            },
            {
                question: "Do visitors win cash in a Sponsored Challenge?",
                answer: "Not today. Achievement rewards are available and are granted when a collector completes the objective. Deterministic cash rewards may exist later; they are not live and should not be promised to visitors or appear on signage. Because join is free and there is no draw, the Challenge is not a sweepstake."
            },
            {
                question: "What should a business include in a sponsored challenge brief?",
                answer: "Organisation and website, the campaign purpose in a paragraph, the place as a venue, radius or venue list, dates with timezone, the preferred objective and rough target, whether live-only captures matter, and the intended reward type. With that, AnimalDex can return a draft configuration, usually within days, for you to review."
            },
            {
                question: "How long does it take to set up a Sponsored Challenge?",
                answer: "Usually days once the objective is agreed, and most of the time goes into agreeing it. Allow a couple of weeks before the window opens so staff can be briefed, signage printed and the pre-visit email updated. The Challenge should be live in the app before the first visitor of the window arrives."
            }
        ],
        sources: [
            {label: "Association of Zoos and Aquariums (AZA)", href: "https://www.aza.org/"},
            {label: "European Association of Zoos and Aquaria (EAZA)", href: "https://www.eaza.net/"},
            {label: "UK Information Commissioner's Office (ICO)", href: "https://ico.org.uk/"}
        ]
    })
];
