import {blogHrefs, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogImage, earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";

export const businessEarnBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-zoos-can-turn-visitors-into-active-wildlife-explorers",
        canonicalUrl: `https://animaldex.app${blogHrefs.zooExplorers}`,
        title: "How Zoos Can Turn Visitors Into Active Wildlife Explorers",
        description:
            "A zoo visit ends at the gate unless visitors have something to finish. A free-to-join AnimalDex Challenge gives them a published objective — not a raffle.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-family.svg",
            "Zoo visitors using a free-to-join wildlife challenge after they leave a habitat"
        ),
        readingMinutes: 8,
        tags: ["sponsored-challenges", "zoos"],
        searchIntents: ["zoo visitor engagement", "zoo marketing campaign", "interactive zoo activity"],
        speciesSlugs: [],
        sections: [
            {
                title: "The visit is shorter than you think",
                paragraphs: [
                    "Most guests walk a loop, photograph the same three animals, and leave. Discount tickets bring them in. They do not make the afternoon more careful.",
                    "A Sponsored Challenge is a time-boxed objective guests can join free in AnimalDex: unique indexed animals, a qualifying capture count, or active days. Achievement rewards are live. Cash prizes are not."
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            },
            {
                title: "Keep it on the grounds, or let it travel",
                paragraphs: [
                    "A campaign can bind to a venue and a discovery radius, require live camera captures, and ignore imports. That is useful if you want the Challenge to happen at the zoo, not from someone’s old camera roll.",
                    "You can also run a wider window if the goal is “notice animals after the visit.” Say which one you want when you enquire. AnimalDex configures the campaign with you. There is no self-serve portal."
                ]
            },
            {
                title: "What we will not claim",
                paragraphs: [
                    "This is not a dwell-time analytics product we can promise on a slide. After a window closes, we can talk about participation. We will not invent a live sponsor dashboard that is not in the product."
                ],
                inlineLinks: [
                    {text: "How to sponsor a Challenge", slug: "how-can-a-business-sponsor-an-animaldex-challenge", href: supportArticleHrefs.howSponsor}
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets",
        canonicalUrl: `https://animaldex.app${blogHrefs.zooMarketing}`,
        title: "Interactive Zoo Marketing Ideas That Go Beyond Discount Tickets",
        description:
            "Price promotions fill the car park. They do not change what people do inside. Here are interactive zoo ideas that stay honest — including a sponsored AnimalDex Challenge.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/more-challenges.svg",
            "Zoo marketing planned around a participation challenge instead of a ticket discount"
        ),
        readingMinutes: 7,
        tags: ["sponsored-challenges", "zoos"],
        searchIntents: ["interactive zoo marketing", "zoo engagement ideas", "zoo campaign ideas"],
        speciesSlugs: [],
        sections: [
            {
                title: "Discounts are not a program",
                paragraphs: [
                    "A cheaper ticket is a transaction. An interactive program is a reason to look at the next habitat instead of the gift shop. Keeper talks already do this well. Digital layers fail when they become scavenger hunts that crowd the glass."
                ]
            },
            {
                title: "A Challenge is a rule set, not a coupon",
                paragraphs: [
                    "If you sponsor an AnimalDex Challenge, guests join free and complete a published objective. No paid entry. No random winner. No prize pool. That keeps the activity on the right side of a sweepstake.",
                    "Pair it with what you already run: an exhibition month, a new habitat opening, or a school-holiday window. The Challenge should name the behaviour you want — more different animals noticed, or more days people come back — not “win cash.”"
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            },
            {
                title: "Other ideas that do not need AnimalDex",
                paragraphs: [
                    "Quiet hours, sketching stools, and species ID cards at the viewing line still work. Use a Challenge when you want a shared, time-boxed objective guests can finish on their phone without buying a second ticket."
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-aquariums-can-use-digital-wildlife-challenges-to-increase-engagement",
        canonicalUrl: `https://animaldex.app${blogHrefs.aquariumChallenges}`,
        title: "How Aquariums Can Use Digital Wildlife Challenges to Increase Engagement",
        description:
            "Aquarium guests already photograph tanks. A free-to-join Sponsored Challenge can turn that habit into a finished objective — with live-capture rules if you want the work done on site.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/phone-discovery-card.svg",
            "Aquarium visitor completing a live wildlife capture challenge at a tank"
        ),
        readingMinutes: 7,
        tags: ["sponsored-challenges", "aquariums"],
        searchIntents: ["aquarium visitor engagement", "aquarium marketing campaign", "digital aquarium challenge"],
        speciesSlugs: [],
        sections: [
            {
                title: "The tank is already a camera trap",
                paragraphs: [
                    "Guests photograph jellyfish, then leave. A Challenge gives the visit a finish line: a set of different indexed animals, or a qualifying capture count during the exhibition window."
                ]
            },
            {
                title: "Live-only is the useful switch",
                paragraphs: [
                    "If imports are blocked and live camera captures are required, people cannot complete the Challenge from a screensaver. That is the difference between engagement and a screenshot contest.",
                    "Achievement rewards can mark completion. Do not advertise cash. Cash posting is not live."
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            },
            {
                title: "Who to talk to",
                paragraphs: [
                    "Education and marketing usually share this brief. Send AnimalDex the venue, dates, objective, and whether the Challenge should stay inside the building. We configure it. There is no sponsor login."
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "gamification-ideas-for-wildlife-parks-and-nature-attractions",
        canonicalUrl: `https://animaldex.app${blogHrefs.parkGamification}`,
        title: "Gamification Ideas for Wildlife Parks and Nature Attractions",
        description:
            "Gamification at a wildlife park should make people look longer, not run. Free-to-join objectives beat leaderboards that crowd a hide.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-traveler.svg",
            "Wildlife park trail used for a quiet discovery challenge rather than a race"
        ),
        readingMinutes: 7,
        tags: ["sponsored-challenges", "wildlife parks"],
        searchIntents: ["wildlife park gamification", "nature attraction engagement", "safari park marketing"],
        speciesSlugs: [],
        sections: [
            {
                title: "If it makes people sprint, it is the wrong game",
                paragraphs: [
                    "Points for speed turn a hide into a queue. A better loop is slower: unique animals, active days, or a Grade floor that rewards a careful photo."
                ]
            },
            {
                title: "What AnimalDex can run",
                paragraphs: [
                    "A Sponsored Challenge can require a setting tag, a type tag, a minimum Grade, a venue radius, and live-only captures. It cannot, today, pay cash or run a prize pool. Join is free.",
                    "That is enough for a half-term program or a seasonal trail without inventing a park-branded mini-game you have to maintain."
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            },
            {
                title: "Ideas that stay offline",
                paragraphs: [
                    "Stamp cards, dawn-only walks, and “phones down at the hide” hours still belong. Use a digital Challenge when you want a shared rule set guests already understand from the app."
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-tourism-boards-can-build-wildlife-discovery-campaigns",
        canonicalUrl: `https://animaldex.app${blogHrefs.tourismCampaigns}`,
        title: "How Tourism Boards Can Build Wildlife Discovery Campaigns",
        description:
            "Destination wildlife campaigns fail when they promise animals on cue. A Sponsored Challenge can ask travelers to look — with dates, a region, and a free join — without guaranteeing a sighting.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/feature-scan-overview.svg",
            "Tourism campaign framed around wildlife discovery rather than a guaranteed sighting"
        ),
        readingMinutes: 8,
        tags: ["sponsored-challenges", "tourism"],
        searchIntents: ["tourism wildlife campaign", "destination wildlife marketing", "wildlife tourism campaign"],
        speciesSlugs: [],
        sections: [
            {
                title: "Do not sell a tiger you cannot schedule",
                paragraphs: [
                    "Wildlife tourism copy often over-promises. A Challenge should never say “see X.” It should say “look for qualifying animals in this window, under these rules.” Sightings stay uncertain. That is the honest product."
                ]
            },
            {
                title: "Region, dates, objective",
                paragraphs: [
                    "Send AnimalDex the destination, the campaign window, and whether you want unique indexed animals, capture count, or active days. A radius or venue list can keep the activity in the places you actually want visitors.",
                    "Achievement rewards can mark completion. Cash is not live. There is no self-serve portal."
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            },
            {
                title: "Pair it with people who already know the ground",
                paragraphs: [
                    "If approved AnimalDex Wildlife Guides already list in the area, travelers can book a cash-on-the-day outing separately. That marketplace is not the Challenge, and AnimalDex does not collect the Guide’s cash."
                ],
                inlineLinks: [earnRelatedLinks.marketplace, earnRelatedLinks.guide]
            }
        ]
    }),
    earnBlogPost({
        slug: "what-is-a-sponsored-wildlife-challenge",
        canonicalUrl: `https://animaldex.app${blogHrefs.whatSponsoredChallenge}`,
        title: "What Is a Sponsored Wildlife Challenge?",
        description:
            "A sponsored wildlife challenge on AnimalDex is a free-to-join, time-boxed campaign with published objectives and achievement rewards. It is not a sweepstake, not PvP, and not cash-live.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/phone-challenge-card.svg",
            "Sponsored Challenge card in AnimalDex showing a free-to-join wildlife objective"
        ),
        readingMinutes: 6,
        tags: ["sponsored-challenges"],
        searchIntents: ["sponsored wildlife challenge", "what is a wildlife challenge", "animal challenge campaign"],
        speciesSlugs: [],
        sections: [
            {
                title: "A campaign, not a battle",
                paragraphs: [
                    "In the AnimalDex app, Challenges means sponsored campaigns. Collectors join at no cost, accept the rules, and work toward an objective. Apple is not a sponsor of those Challenges.",
                    "The public website’s /challenges URL is different: it redirects to animal-versus-animal comparison pages. Do not treat those SEO pages as this product."
                ]
            },
            {
                title: "What you can require",
                paragraphs: [
                    "Unique indexed animals, qualifying capture count, or active capture days. Optional live-only captures, import blocks, Grade floors, type or setting tags, and a venue radius."
                ]
            },
            {
                title: "What you cannot run today",
                paragraphs: [
                    "Paid entry, random winners, prize pools, or live cash grants. Those are out of scope. Achievement rewards are the live completion mark."
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            }
        ],
        faq: [
            {
                question: "Is a Sponsored Challenge a lottery?",
                answer: "No. Completion is deterministic against published rules. There is no random draw."
            }
        ]
    }),
    earnBlogPost({
        slug: "how-animaldex-sponsored-challenges-work-for-businesses",
        canonicalUrl: `https://animaldex.app${blogHrefs.sponsoredForBusiness}`,
        title: "How AnimalDex Sponsored Challenges Work for Businesses",
        description:
            "How a zoo, aquarium, park, or tourism board actually gets a Challenge live: enquiry, configuration with AnimalDex, free collector join, achievement rewards. No sponsor dashboard.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/more-discovery.svg",
            "Business briefing for an AnimalDex Sponsored Challenge configured with the team"
        ),
        readingMinutes: 7,
        tags: ["sponsored-challenges"],
        searchIntents: ["wildlife app sponsorship", "sponsor animal challenge", "AnimalDex for businesses"],
        speciesSlugs: [],
        sections: [
            {
                title: "You enquire. We configure.",
                paragraphs: [
                    "There is no self-serve sponsor portal. Send the organisation, purpose, venue or region, dates, objective, and intended reward type. AnimalDex sets up the campaign."
                ],
                inlineLinks: [earnRelatedLinks.sponsor]
            },
            {
                title: "Collectors join free",
                paragraphs: [
                    "No Credit entry. No ticket inside AnimalDex. They accept the rules version and progress against the objective. When they finish, an achievement can be granted."
                ]
            },
            {
                title: "What to send in the first email",
                paragraphs: [
                    "Organisation and website. Campaign purpose in one paragraph. Place. Dates and timezone. Objective preference. Whether live-only captures matter. Whether you want an achievement now and a later conversation about cash — knowing cash is not live."
                ],
                inlineLinks: [
                    {text: "How can a business sponsor an AnimalDex Challenge?", slug: "how-can-a-business-sponsor-an-animaldex-challenge", href: supportArticleHrefs.howSponsor}
                ]
            }
        ]
    })
];
