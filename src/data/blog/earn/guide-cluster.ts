import {blogHrefs, earnFacts, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogImage, earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";

export const guideEarnBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-to-become-a-wildlife-guide-with-animaldex",
        canonicalUrl: `https://animaldex.app${blogHrefs.becomeGuideHowTo}`,
        title: "How to Become a Wildlife Guide With AnimalDex",
        description:
            `Apply to become an AnimalDex Wildlife Guide after ${earnFacts.wildCaptures} qualifying wild captures, ${earnFacts.wildSpecies} wild species, and a ${earnFacts.accountAgeDays}-day account. Meeting the numbers lets you apply. A person still reviews you.`,
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/phone-guide-card.svg",
            "AnimalDex Wildlife Guide listing on a phone with public area and per-person price"
        ),
        readingMinutes: 8,
        tags: ["wildlife-guides", "earning"],
        searchIntents: ["become wildlife guide", "AnimalDex wildlife guide", "how to become a wildlife guide"],
        speciesSlugs: [],
        sections: [
            {
                title: "This is a seller application, not a job listing",
                paragraphs: [
                    "AnimalDex Wildlife Guides is a marketplace for approved locals. You list an experience. Collectors request a date. You are not hired by AnimalDex, and AnimalDex is not the organiser of the outing."
                ]
            },
            {
                title: "The gates",
                paragraphs: [
                    `${earnFacts.wildCaptures} qualifying wild captures. ${earnFacts.wildSpecies} canonical wild species. A ${earnFacts.accountAgeDays}-day-old account. An 18+ attestation. Current Guide Seller Terms. Human review.`,
                    "Meeting the requirements lets you apply. It does not make you a Guide."
                ],
                inlineLinks: [earnRelatedLinks.guide]
            },
            {
                title: "Then you list, accept, and complete",
                paragraphs: [
                    "Write a honest public area, duration, guest limit, and real-money price. Submit the listing for review. When a collector books, they pay cash on the day. You mark complete. Seller net is recorded on Earnings. Credits are never used."
                ],
                inlineLinks: [
                    {text: "How Guide bookings and payments work", slug: "how-do-wildlife-guide-bookings-and-payments-work", href: supportArticleHrefs.guidePayments}
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "can-birders-make-money-as-local-guides",
        canonicalUrl: `https://animaldex.app${blogHrefs.birdersGuideIncome}`,
        title: "Can Birders Make Money as Local Guides?",
        description:
            "Yes — if people will pay for your local knowledge and you stay legal. AnimalDex Wildlife Guides is one cash-on-the-day listing path. It is not a salary and not automatic approval.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-competitor.svg",
            "Local birder leading a small-group dawn walk as an AnimalDex Wildlife Guide"
        ),
        readingMinutes: 7,
        tags: ["wildlife-guides", "birding"],
        searchIntents: ["can birders make money", "local birding guide income", "bird watching guide jobs"],
        speciesSlugs: [],
        sections: [
            {
                title: "The market is already there",
                paragraphs: [
                    "Dawn walks, wetland mornings, and migration weekends are established products. The hard part is trust and discovery, not inventing birding."
                ]
            },
            {
                title: "Where AnimalDex helps — and stops",
                paragraphs: [
                    "The app can list you after approval, pass booking requests, and record seller net when you complete. It does not collect the cash, verify your permits, or promise birds.",
                    "You still need whatever licence or land access your place requires."
                ],
                inlineLinks: [earnRelatedLinks.guide]
            },
            {
                title: "Start smaller than a tour company",
                paragraphs: [
                    "A two-hour public-path walk for a handful of guests is a listing. A minibus and a guaranteed eagle is a different business — and a bad promise."
                ],
                inlineLinks: [
                    {text: "How to start offering local birding experiences", slug: "how-to-start-offering-local-birding-experiences", href: blogHrefs.startBirdingExperiences}
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-to-start-offering-local-birding-experiences",
        canonicalUrl: `https://animaldex.app${blogHrefs.startBirdingExperiences}`,
        title: "How to Start Offering Local Birding Experiences",
        description:
            "Pick a public area, a duration, a guest cap, and a honest price. List it as an AnimalDex Wildlife Guide experience only after you are approved — and never guarantee the bird.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/more-collection.svg",
            "Dawn birding experience described by public area and duration, not a guaranteed species"
        ),
        readingMinutes: 7,
        tags: ["wildlife-guides", "birding"],
        searchIntents: ["start birding tours", "offer birdwatching walks", "local birding experience"],
        speciesSlugs: [],
        sections: [
            {
                title: "Write the outing you already do",
                paragraphs: [
                    "If you already walk a rice-field edge at first light, that is the listing. Title, one-line pitch, what you actually do, public area, duration, max guests, price per person."
                ]
            },
            {
                title: "Keep meeting points private",
                paragraphs: [
                    "AnimalDex listings show a general area. Exact meeting details wait until you accept. That is safer for you and for the site."
                ]
            },
            {
                title: "Apply first",
                paragraphs: [
                    "You cannot skip the wild-collection gates or the human review. Build the captures, then apply, then list."
                ],
                inlineLinks: [earnRelatedLinks.guide, earnRelatedLinks.experiences]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences",
        canonicalUrl: `https://animaldex.app${blogHrefs.herpersGuide}`,
        title: "How Herpers Can Turn Local Knowledge Into Guided Wildlife Experiences",
        description:
            "Night herping can be listed as an AnimalDex Wildlife Guide experience if you stay legal, skip handling, and never promise a snake. Eligibility and human review still apply.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/blog-image-slot.svg",
            "Night herping walk listed as a small-group AnimalDex Wildlife Guide experience"
        ),
        readingMinutes: 7,
        tags: ["wildlife-guides", "herping"],
        searchIntents: ["herping guide", "night herping tour", "reptile walking guide"],
        speciesSlugs: [],
        sections: [
            {
                title: "Herping is easy to do badly",
                paragraphs: [
                    "Flipping cover, handling snakes, or shining animals for a guaranteed photo is not a listing AnimalDex wants. The Guide Seller Terms forbid baiting, luring, calling in, cornering, and handling wild animals."
                ]
            },
            {
                title: "What a good night walk looks like",
                paragraphs: [
                    "Public trails, small groups, lights used to look, no collection, no disturbance of dens or protected habitat. Sightings optional. Identification talk required."
                ],
                inlineLinks: [
                    {text: "What makes a great ethical Wildlife Guide", slug: "what-makes-a-great-ethical-wildlife-guide", href: blogHrefs.ethicalGuide}
                ]
            },
            {
                title: "Same marketplace, same cash rule",
                paragraphs: [
                    "Apply after the wild-collection gates. Price in real money. Collect cash on the day. AnimalDex records seller net when you complete."
                ],
                inlineLinks: [earnRelatedLinks.guide, earnRelatedLinks.experiences]
            }
        ]
    }),
    earnBlogPost({
        slug: "what-makes-a-great-ethical-wildlife-guide",
        canonicalUrl: `https://animaldex.app${blogHrefs.ethicalGuide}`,
        title: "What Makes a Great Ethical Wildlife Guide?",
        description:
            "An ethical wildlife guide sells orientation, not a guaranteed animal. AnimalDex Wildlife Guide terms ban baiting, handling, and promised sightings — and put permits on you.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-curious.svg",
            "Ethical wildlife guide keeping distance and not guaranteeing a sighting"
        ),
        readingMinutes: 8,
        tags: ["wildlife-guides"],
        searchIntents: ["ethical wildlife guide", "responsible wildlife tourism", "wildlife guiding ethics"],
        speciesSlugs: [],
        sections: [
            {
                title: "The animal does not owe the guest a photo",
                paragraphs: [
                    "A great Guide briefs distance, noise, and when to walk away. A poor Guide manufactures the moment. AnimalDex Wildlife Guide terms are explicit: no baiting, luring, calling in, cornering, or handling. Nests, dens, and protected habitats stay alone."
                ]
            },
            {
                title: "Honesty in the listing",
                paragraphs: [
                    "Public area, duration, group size, and price should match the day. Wildlife sightings cannot be promised. If you need a licence, you hold it. AnimalDex does not verify permits for you."
                ],
                inlineLinks: [earnRelatedLinks.guide]
            },
            {
                title: "Safety is yours",
                paragraphs: [
                    "You are meeting people from the internet outdoors. Assess risk, brief guests, and stop if conditions fail. Harassment or harm to a guest or an animal ends access to Wildlife Guides."
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-wildlife-photography-guides-can-find-new-clients",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographyGuideClients}`,
        title: "How Wildlife Photography Guides Can Find New Clients",
        description:
            "Photography guests want field time and identification context, not a rented hide with a bait pile. An AnimalDex Wildlife Guide listing can reach collectors already in the app.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/phone-collection-card.svg",
            "Wildlife photography guide listing reaching AnimalDex collectors"
        ),
        readingMinutes: 7,
        tags: ["wildlife-guides", "wildlife photography"],
        searchIntents: ["wildlife photography guide clients", "photo tour clients", "wildlife photo workshop"],
        speciesSlugs: [],
        sections: [
            {
                title: "Collectors are already looking",
                paragraphs: [
                    "AnimalDex users open published Guide listings by area and category, including wildlife photography. They see your public pitch and aggregate wild credentials — not your private capture map."
                ],
                inlineLinks: [earnRelatedLinks.marketplace]
            },
            {
                title: "Sell the session you can keep ethical",
                paragraphs: [
                    "A slow public-path morning with ID talk is listable. A baited owl perch is not. If your current photo-tour product depends on disturbance, do not bring it to AnimalDex."
                ],
                inlineLinks: [
                    {text: "Ethical Wildlife Guide standard", slug: "what-makes-a-great-ethical-wildlife-guide", href: blogHrefs.ethicalGuide}
                ]
            },
            {
                title: "The booking is still cash on the day",
                paragraphs: [
                    "Requests come through the app. Payment does not. You take cash when you meet. Completing the outing records seller net."
                ],
                inlineLinks: [earnRelatedLinks.guide]
            }
        ]
    })
];
