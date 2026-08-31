import {blogHrefs, earnPaths, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogImage, earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";

export const creatorEarnBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-wildlife-photographers-can-build-a-digital-species-collection",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographerCollection}`,
        title: "How Wildlife Photographers Can Build a Digital Species Collection",
        description:
            "Turn field photos into a species-indexed AnimalDex collection. Live captures become cards you can search, compare, and keep building — without treating the camera roll as the archive.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/feature-collection-overview.svg",
            "AnimalDex collection overview showing wildlife cards organised by species"
        ),
        readingMinutes: 8,
        tags: ["wildlife photography", "species collection", "creators"],
        searchIntents: ["wildlife photography app", "organize wildlife photos by species", "wildlife collection app"],
        speciesSlugs: [],
        tableOfContents: ["Why a camera roll is not a collection", "What AnimalDex indexes", "A working field habit", "What this is not"],
        sections: [
            {
                title: "A folder of JPEGs is not a species record",
                paragraphs: [
                    "Most wildlife photographers already shoot more than they can name. The useful problem is not storage. It is recall: which warbler was that, on which morning, and have you actually photographed the species before?",
                    "AnimalDex is built as a live capture collection. You photograph an animal in the app, analysis resolves a catalog card, and that card becomes the unit you collect — species, lookalike group, or domestic base animal. The photo stays attached to a named index instead of sitting in a date-sorted camera roll."
                ]
            },
            {
                title: "What gets collected",
                paragraphs: [
                    "AnimalDex numbers belong to resolved catalog cards, not every nickname in the analysis text. A German Shepherd still indexes as Domestic Dog. A confident live heron can become its own species card. Some lookalike families share a group card because phone photos cannot fairly split them.",
                    "That is an advantage for photographers who want a honest list. You are not minting a new species every time the model mentions a subspecies. You are building the same public catalog other collectors use."
                ],
                inlineLinks: [
                    {text: "How AnimalDex indexes animals", slug: "how-animaldex-indexes-animals", href: "/blog/how-animaldex-indexes-animals"}
                ]
            },
            {
                title: "A field habit that actually sticks",
                paragraphs: [
                    "Use the in-app camera for animals you want in the collection. Gallery uploads are not how AnimalDex records a live sighting. Frame the animal clearly, keep enough body in the shot, and let the capture finish analysis before you walk on.",
                    "Grade scores that specific photo, not the animal’s power. A sharp, well-lit live bird with habitat context will outrank a distant blur. If you care about later Creator Rewards eligibility, quality and live originals matter more than volume.",
                    "When you travel, the same habit produces a species list you can open later: what you actually saw, not what the itinerary promised."
                ]
            },
            {
                title: "What this page is not promising",
                paragraphs: [
                    "A collection is not a payout. Credits you spend on scans stay Credits. Creator Rewards is currently paused. The reason to index species now is the record itself — and the option to apply as an AnimalDex Wildlife Guide once the wild-collection gates unlock."
                ],
                inlineLinks: [earnRelatedLinks.creator, earnRelatedLinks.guide, earnRelatedLinks.earn]
            }
        ],
        faq: [
            {
                question: "Can I upload my existing wildlife Lightroom catalog?",
                answer: "AnimalDex records live in-app captures. It is not a bulk importer for an existing photo archive."
            },
            {
                question: "Does every photo become its own AnimalDex number?",
                answer: "No. Separate captures can exist for the same species. The collectible number belongs to the resolved catalog card."
            }
        ]
    }),
    earnBlogPost({
        slug: "can-wildlife-photography-make-money",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographyIncome}`,
        title: "Can Wildlife Photography Make Money? Realistic Ways Photographers Earn",
        description:
            "Wildlife photography income is usually a mix of licensing, assignments, teaching, and guiding — not an app payout. Here is where AnimalDex fits without pretending it replaces a career.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-collector.svg",
            "Wildlife photographer reviewing a field collection rather than a payout dashboard"
        ),
        readingMinutes: 9,
        tags: ["wildlife photography", "creators", "earning"],
        searchIntents: ["can wildlife photography make money", "wildlife photography income", "earn from wildlife photography"],
        speciesSlugs: [],
        tableOfContents: ["The honest market", "Guiding as a side income", "What AnimalDex does and does not pay", "A practical mix"],
        sections: [
            {
                title: "Most photographers do not get paid per nice bird",
                paragraphs: [
                    "Stock licensing, editorial assignments, workshops, prints, and brand work still account for most wildlife photography income. Those markets are competitive and slow. Anyone selling a single app as a replacement for that stack is selling a story."
                ]
            },
            {
                title: "Guiding is the local path that actually uses your knowledge",
                paragraphs: [
                    "If you already know a wetland at first light, or which public trail is quiet after rain, other people will pay for that time. That is guiding, not licensing. AnimalDex Wildlife Guides is a live beta for exactly that: approved locals list a real-money experience, collectors request a date, and they pay cash on the day.",
                    "AnimalDex does not collect the cash. Completing the outing records seller net on Earnings. You still need permits where the law requires them, and you still cannot promise a sighting."
                ],
                inlineLinks: [earnRelatedLinks.guide]
            },
            {
                title: "Creator Rewards is not a salary",
                paragraphs: [
                    "Creator Rewards is designed as a company-funded allocation during open periods for eligible live contribution. It is currently paused. It will never be “Credits times a rate” or “Score times a rate.” Do not plan rent around it.",
                    "The useful move is still the same: original live captures, breadth, and quality. That work has value in the collection even when no period is paying."
                ],
                inlineLinks: [earnRelatedLinks.creator, earnRelatedLinks.earn]
            },
            {
                title: "A mix that stays honest",
                paragraphs: [
                    "Keep licensing and assignments if you have them. Use AnimalDex to keep a public species record and, if you qualify, to list guiding. Treat Creator Rewards as a possible later program, not income you can invoice against."
                ],
                inlineLinks: [
                    {text: "How to become a Wildlife Guide with AnimalDex", slug: "how-to-become-a-wildlife-guide-with-animaldex", href: blogHrefs.becomeGuideHowTo}
                ]
            }
        ],
        faq: [
            {
                question: "Does AnimalDex pay photographers for uploading photos?",
                answer: "No. Live captures build a collection. Credits are not cash. Creator Rewards is paused. Guide income is cash paid to you by the collector on the day."
            }
        ]
    }),
    earnBlogPost({
        slug: "how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income",
        canonicalUrl: `https://animaldex.app${blogHrefs.guidingSideIncome}`,
        title: "How to Turn Local Wildlife Knowledge Into a Guiding Side Income",
        description:
            "If you already know the public paths, seasons, and honest expectations for local wildlife, AnimalDex Wildlife Guides is the in-app way to list a cash-on-the-day experience.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/more-guide.svg",
            "Local wildlife outing listed as an AnimalDex Wildlife Guide experience"
        ),
        readingMinutes: 8,
        tags: ["wildlife-guides", "earning", "birding"],
        searchIntents: ["wildlife guiding side income", "become local nature guide", "earn money wildlife spotting"],
        speciesSlugs: [],
        sections: [
            {
                title: "Knowledge is the product. The animal is not.",
                paragraphs: [
                    "People pay for orientation: where to stand, how early to arrive, what “quiet” actually means on that trail, and how not to wreck the morning for the animal. They do not pay you to manufacture a sighting.",
                    "An AnimalDex Wildlife Guide listing is a public pitch for that orientation — area, duration, guest limit, and a real-money price per person. Exact meeting points stay private until you accept a request."
                ]
            },
            {
                title: "Eligibility is a collection problem first",
                paragraphs: [
                    "You apply after 45 qualifying wild captures, 20 wild species, and a 30-day-old account, plus an 18+ attestation and the current Guide Seller Terms. Meeting those numbers lets you apply. A person still reviews the application.",
                    "That gate exists so the marketplace is not an open classifieds board. It is not a promise that every birder who hits 45 captures is approved."
                ],
                inlineLinks: [earnRelatedLinks.guide]
            },
            {
                title: "Cash on the day, record after",
                paragraphs: [
                    "The collector pays you in person. AnimalDex does not process the payment. When you mark the outing complete, seller net is recorded on Earnings. Credits are never part of the booking."
                ],
                inlineLinks: [
                    {text: "How Guide bookings and payments work", slug: "how-do-wildlife-guide-bookings-and-payments-work", href: supportArticleHrefs.guidePayments}
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "why-every-wildlife-photographer-should-track-the-species-they-photograph",
        canonicalUrl: `https://animaldex.app${blogHrefs.trackSpecies}`,
        title: "Why Every Wildlife Photographer Should Track the Species They Photograph",
        description:
            "A species tracker changes what you go out to shoot. AnimalDex turns live captures into a checklist you can actually finish — birds, herps, insects, and the rest.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/feature-discovery-overview.svg",
            "Species checklist built from live AnimalDex wildlife captures"
        ),
        readingMinutes: 7,
        tags: ["wildlife photography", "species collection"],
        searchIntents: ["wildlife photography species tracker", "bird photography checklist app", "animal collection tracker"],
        speciesSlugs: [],
        sections: [
            {
                title: "Lists change behaviour",
                paragraphs: [
                    "Without a list, you reshoot the same easy bird. With a list, you notice the gap: no night herps, no insects, no second habitat. That is the difference between a hobby folder and a body of work."
                ]
            },
            {
                title: "Index, then fill the holes",
                paragraphs: [
                    "AnimalDex gives each resolved animal a catalog card. Repeat captures of the same species still have their own grades and context, but the collection progress is about unique identities.",
                    "First-time wild species captures also grant a Credit. That is a Credits grant, not Earnings. It exists to keep scanning going, not to imply the species is worth money."
                ],
                inlineLinks: [earnRelatedLinks.earn]
            },
            {
                title: "Birders already know this. Macro shooters should too.",
                paragraphs: [
                    "A bird checklist is normal. An insect or reptile checklist is rarer and often more useful, because those animals are easy to skip. AnimalDex treats them as collectible wildlife, not as junk detections."
                ],
                inlineLinks: [
                    {text: "From birding to herping", slug: "from-birding-to-herping-build-a-public-record-of-what-you-find", href: blogHrefs.birdingToHerping}
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "from-birding-to-herping-build-a-public-record-of-what-you-find",
        canonicalUrl: `https://animaldex.app${blogHrefs.birdingToHerping}`,
        title: "From Birding to Herping: Build a Public Record of What You Find",
        description:
            "Bird lists are common. Reptile, frog, and insect lists are not. AnimalDex lets you keep one public wild record across those habits — without promising sightings.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-curious.svg",
            "Field notebook style record covering birds, frogs, and insects in one collection"
        ),
        readingMinutes: 7,
        tags: ["birding", "herping", "species collection"],
        searchIntents: ["herping checklist", "birding species list app", "public wildlife record"],
        speciesSlugs: [],
        sections: [
            {
                title: "One list, several tempos",
                paragraphs: [
                    "Dawn birding is fast and optical. Herping is slow and often after dark. Macro is crouch-and-wait. The animals do not share a schedule, but they can share a collection if the app does not treat reptiles as second-class detections."
                ]
            },
            {
                title: "Keep the record honest",
                paragraphs: [
                    "Live captures only. No luring, no handling, no turning logs to manufacture a frog. AnimalDex Wildlife Guide terms forbid baiting and disturbance for the same reason a personal list should: the record is worthless if you coerced the animal."
                ]
            },
            {
                title: "If you later guide",
                paragraphs: [
                    "The same public wild record is what collectors see as aggregate credentials on a listing. It is not a capture-ID dump. It is a count of wild species and qualifying wild captures — enough to show you have been out, not enough to dox a den."
                ],
                inlineLinks: [earnRelatedLinks.guide, earnRelatedLinks.marketplace]
            }
        ]
    }),
    earnBlogPost({
        slug: "wildlife-photography-challenges-that-make-you-better-in-the-field",
        canonicalUrl: `https://animaldex.app${blogHrefs.fieldChallenges}`,
        title: "Wildlife Photography Challenges That Make You Better in the Field",
        description:
            "Personal field challenges — new species, new habitats, stricter framing — improve the work. They are not the same thing as an AnimalDex Sponsored Challenge.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/phone-scan-card.svg",
            "Photographer using a live AnimalDex capture as a field challenge, not a sponsored campaign"
        ),
        readingMinutes: 7,
        tags: ["wildlife photography", "fieldcraft"],
        searchIntents: ["wildlife photography challenges", "photography field practice", "improve wildlife photos"],
        speciesSlugs: [],
        sections: [
            {
                title: "Give yourself constraints",
                paragraphs: [
                    "A useful personal challenge is narrow: only insects this week, only Grade-worthy framing, only a habitat you usually skip. Constraints produce better files than “go shoot nature.”"
                ]
            },
            {
                title: "Use AnimalDex as the scoreboard, not the prize",
                paragraphs: [
                    "Unique species, distinct locations, and capture Grade are already in the product. Missions also grant Credits for some of those loops. Credits are not cash. The improvement is the point."
                ],
                inlineLinks: [earnRelatedLinks.earn]
            },
            {
                title: "Do not confuse this with a Sponsored Challenge",
                paragraphs: [
                    "A Sponsored Challenge is a time-boxed campaign a business can enquire to run — free to join, published rules, achievement rewards today. It is not Arena PvP, and it is not a personal homework list. If a zoo or park invites you into one, the objective will be written on the campaign. Until then, set your own."
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-animaldex-rewards-genuine-wildlife-contribution",
        canonicalUrl: `https://animaldex.app${blogHrefs.genuineContribution}`,
        title: "How AnimalDex Rewards Genuine Wildlife Contribution",
        description:
            "Creator Rewards is designed to recognise live, diverse, high-quality wildlife contribution during open periods. It is currently paused. Credits, Score, and Gift prices do not become cash.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/more-analysis.svg",
            "AnimalDex Earnings view reserved for genuine wildlife contribution, not Credit balances"
        ),
        readingMinutes: 8,
        tags: ["creator-rewards", "earning"],
        searchIntents: ["AnimalDex creator rewards", "wildlife creator platform", "how AnimalDex rewards photographers"],
        speciesSlugs: [],
        sections: [
            {
                title: "Contribution is not a tip jar",
                paragraphs: [
                    "Creator Rewards is a company-funded program. When a period is open, eligible accounts can receive an allocation from that pool. There is no “pay me $X per capture” rate, and there is no conversion from Credits.",
                    "The program is currently paused. You can still do the work it is designed to recognise."
                ],
                inlineLinks: [earnRelatedLinks.creator]
            },
            {
                title: "What “genuine” means in practice",
                paragraphs: [
                    "Live originals over imports. Breadth over repeating one easy species. Capture quality over a pile of low-grade frames. Consistency over a single spike. Community Gifts, if counted later, are event signals — not the Credit price of the Gift."
                ]
            },
            {
                title: "What never becomes Earnings",
                paragraphs: [
                    "Credits, AnimalDex Score, Capture XP, Gift spend, PvP wins, and Pack sales stay on the Credits side of the firewall. If someone tells you otherwise, they have the product wrong."
                ],
                inlineLinks: [
                    earnRelatedLinks.earn,
                    {text: "What are Creator Rewards?", slug: "what-are-creator-rewards", href: supportArticleHrefs.whatCreatorRewards}
                ]
            }
        ],
        faq: [
            {
                question: "When do Creator Rewards open?",
                answer: "There is no published reopen date. Periods can be paused. Do not treat the program as current income."
            }
        ]
    })
];
