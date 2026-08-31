import {blogHrefs, earnPaths, supportArticleHrefs} from "@/data/earn-economy";
import {earnBlogImage, earnBlogPost, earnRelatedLinks} from "@/data/blog/earn/_shared";
import type {BlogPost} from "@/data/blog/types";

const publishedAt = "2026-08-30";

export const experienceDiscoveryBlogPosts: BlogPost[] = [
    earnBlogPost({
        slug: "how-to-find-ethical-herping-tours-and-local-reptile-guides",
        canonicalUrl: `https://animaldex.app${blogHrefs.ethicalHerpingTours}`,
        title: "How to Find Ethical Herping Tours and Local Reptile Guides",
        description:
            "A herping tour should be observation, not a guaranteed snake. Here is how to read a local reptile guide listing before you book.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/more-guide.svg",
            "Ethical herping walk focused on observation rather than handling"
        ),
        readingMinutes: 7,
        tags: ["wildlife-experiences", "herping"],
        searchIntents: ["herping tour", "herping trip", "reptile tour", "snake tour", "local reptile guide"],
        speciesSlugs: [],
        sections: [
            {
                title: "A good herping trip is still a walk",
                paragraphs: [
                    "If a listing promises a snake, a catch, or a posed photo, keep walking. Ethical herping is looking along public paths, after rain, or at night, with lights used to see — not to pin an animal in place.",
                    "On AnimalDex, herping is a Guide category for approved local sellers. The listing shows a public area, duration, guest cap, and a per-person cash price. It does not sell a specific animal."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            },
            {
                title: "What to read on the listing",
                paragraphs: [
                    "Look for a realistic public area, a small group, and copy that says sightings are not guaranteed. Ask how the Guide handles roads, private land, and protected species. If the answer is vague, do not go.",
                    "This is different from keeping a herping field journal in the app. One is an outing you request. The other is how you log what you find yourself."
                ],
                inlineLinks: [
                    {text: "Herping field journal", slug: "herping-field-journal", href: "/use-cases/herping-field-journal"},
                    {text: "What to expect on a guided herping trip", slug: "what-to-expect-on-a-guided-herping-trip", href: blogHrefs.guidedHerpingTrip}
                ]
            },
            {
                title: "How booking actually works",
                paragraphs: [
                    "You request a date in AnimalDex. The Guide accepts. You pay cash on the day. AnimalDex does not collect that payment and does not operate the walk."
                ],
                inlineLinks: [
                    {text: "How Guide bookings and payments work", slug: "how-do-wildlife-guide-bookings-and-payments-work", href: supportArticleHrefs.guidePayments}
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "what-to-expect-on-a-guided-herping-trip",
        canonicalUrl: `https://animaldex.app${blogHrefs.guidedHerpingTrip}`,
        title: "What to Expect on a Guided Herping Trip",
        description:
            "A guided herping trip is a small, slow look for reptiles and amphibians. Expect field craft and honesty, not a guaranteed encounter.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-curious.svg",
            "Small group looking for frogs and reptiles along a public path"
        ),
        readingMinutes: 6,
        tags: ["wildlife-experiences", "herping"],
        searchIntents: ["guided herping trip", "what happens on a herping tour", "night herping walk"],
        speciesSlugs: [],
        sections: [
            {
                title: "Pace, not a checklist",
                paragraphs: [
                    "Most herping time is walking, listening, and checking edges. You may see a gecko on a wall and nothing else. That is still a successful outing if the Guide taught you where and why to look.",
                    "Bring closed shoes, a light if it is a night walk, and the expectation that you will not handle anything."
                ]
            },
            {
                title: "What the Guide should refuse",
                paragraphs: [
                    "Baiting, flipping every rock, pulling animals from cover, or lining up a photo that stresses the animal. If that is the product, it is not an AnimalDex Wildlife Guide experience worth taking."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-to-choose-a-local-wildlife-guide",
        canonicalUrl: `https://animaldex.app${blogHrefs.chooseLocalGuide}`,
        title: "How to Choose a Local Wildlife Guide",
        description:
            "Choose a local wildlife guide by public area, group size, honesty about sightings, and how payment works — not by invented ratings.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/phone-guide-card.svg",
            "AnimalDex Wildlife Guide listing showing area, duration and per-person price"
        ),
        readingMinutes: 7,
        tags: ["wildlife-experiences"],
        searchIntents: ["how to choose a wildlife guide", "local nature guide", "wildlife guide near me"],
        speciesSlugs: [],
        sections: [
            {
                title: "Read the public facts",
                paragraphs: [
                    "On AnimalDex a published listing shows the category, a general public area, duration, guest cap, and a cash-on-the-day price. That is enough to decide whether the outing fits you. It is not a hotel-style review page.",
                    "Approved AnimalDex Wildlife Guides have passed a human review after meeting wild-collection gates. Approval is not a promise of sightings or of a perfect host."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            },
            {
                title: "Questions worth asking in the app",
                paragraphs: [
                    "What is the meeting area, in general terms? What happens if it rains? What is off-limits? Do you need your own transport? A Guide who answers those plainly is easier to trust than one who only talks about rare animals."
                ],
                inlineLinks: [
                    {text: "How Guide bookings and payments work", slug: "how-do-wildlife-guide-bookings-and-payments-work", href: supportArticleHrefs.guidePayments}
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "birding-guide-vs-going-alone",
        canonicalUrl: `https://animaldex.app${blogHrefs.birdingGuideVsAlone}`,
        title: "Birding Guide vs Going Alone: When a Local Guide Helps",
        description:
            "Go alone when you already know the site. Book a birding guide when you need local timing, habitat, and a second pair of ears.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-traveler.svg",
            "Birder with binoculars deciding whether to walk alone or with a local guide"
        ),
        readingMinutes: 6,
        tags: ["wildlife-experiences", "birding"],
        searchIntents: ["birding guide", "birdwatching tour", "local birding guide"],
        speciesSlugs: [],
        sections: [
            {
                title: "Alone is often enough",
                paragraphs: [
                    "If you already know a wetland or a dawn chorus route, a listing will not make you a better birder by itself. Use AnimalDex to identify and keep the species you photograph."
                ]
            },
            {
                title: "When a Guide earns the fee",
                paragraphs: [
                    "A new city, a short travel window, or a habitat you have never walked — that is when a local birding Guide helps. You are paying for timing and place knowledge, not for a guaranteed species list.",
                    "AnimalDex birding listings are small-group experiences with a public area and a cash price. Request them in the app."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            }
        ]
    }),
    earnBlogPost({
        slug: "what-happens-on-a-night-wildlife-walk",
        canonicalUrl: `https://animaldex.app${blogHrefs.nightWildlifeWalk}`,
        title: "What Happens on a Night Wildlife Walk?",
        description:
            "A night wildlife walk is a slow, lit look at frogs, insects, and whatever else is active after dark. It is not a spotlight safari.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/feature-discovery-overview.svg",
            "Night wildlife walk with a small group using lights to look, not to lure"
        ),
        readingMinutes: 6,
        tags: ["wildlife-experiences", "night wildlife"],
        searchIntents: ["night wildlife walk", "night wildlife tour", "night herping walk"],
        speciesSlugs: [],
        sections: [
            {
                title: "Dark, slow, and quieter than you think",
                paragraphs: [
                    "You meet at a public area, walk a known path, and use lights in short bursts. Frogs, moths, geckos, and night birds are the usual possibilities — never a promise.",
                    "If a walk is sold as a guaranteed civet, owl, or snake, treat that as a warning, not a feature."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            },
            {
                title: "What to bring",
                paragraphs: [
                    "Closed shoes, a spare light, and clothes you can stand still in. Leave the idea that you will leave with a trophy photo."
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "wildlife-photography-tours-what-to-look-for",
        canonicalUrl: `https://animaldex.app${blogHrefs.photographyToursLookFor}`,
        title: "Wildlife Photography Tours: What to Look For",
        description:
            "A wildlife photography tour should buy field time and identification context, not a staged animal. Read the listing before you pack the long lens.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-collector.svg",
            "Wildlife photographer joining a local field outing rather than a staged set"
        ),
        readingMinutes: 6,
        tags: ["wildlife-experiences", "wildlife photography"],
        searchIntents: ["wildlife photography tour", "wildlife photography guide", "animal photography tour"],
        speciesSlugs: [],
        sections: [
            {
                title: "Field time, not a studio",
                paragraphs: [
                    "The useful listing tells you the public area, how long you will be out, and how many people share the path. It will not promise a leopard or a perfect perched kingfisher.",
                    "AnimalDex photography experiences are led by approved Wildlife Guides. Booking and payment stay in the app and cash-on-the-day flow."
                ],
                inlineLinks: [
                    earnRelatedLinks.experiences,
                    {text: "Wildlife photography companion app", slug: "wildlife-photography-companion-app", href: "/use-cases/wildlife-photography-companion-app"}
                ]
            },
            {
                title: "After the outing",
                paragraphs: [
                    "Use the same app to identify and keep the species you actually photographed. That is a collection, not a proof of a paid sighting."
                ]
            }
        ]
    }),
    earnBlogPost({
        slug: "how-to-find-ethical-wildlife-experiences-while-traveling",
        canonicalUrl: `https://animaldex.app${blogHrefs.ethicalTravelExperiences}`,
        title: "How to Find Ethical Wildlife Experiences While Traveling",
        description:
            "Skip baited photo ops. Look for small-group, public-area wildlife experiences with honest sighting language and cash paid to the Guide.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/persona-family.svg",
            "Travelers choosing a small local wildlife walk instead of a staged encounter"
        ),
        readingMinutes: 7,
        tags: ["wildlife-experiences", "travel"],
        searchIntents: ["ethical wildlife experiences", "wildlife activities while traveling", "local wildlife tour"],
        speciesSlugs: [],
        sections: [
            {
                title: "Refuse the staged encounter",
                paragraphs: [
                    "If the animal is called in, fed, or held for the camera, it is not an ethical wildlife experience. Distance and patience are the product.",
                    "AnimalDex listings are limited to approved Guides, public areas, and cash paid directly to the host. That still does not make every outing perfect. Read the copy."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            },
            {
                title: "Do not invent a city page in your head",
                paragraphs: [
                    "If no experience is published for the place you are visiting, there is not a hidden AnimalDex tour there. Use the app for your own sightings, or wait until a Guide lists one."
                ],
                inlineLinks: [earnRelatedLinks.marketplace]
            }
        ]
    }),
    earnBlogPost({
        slug: "best-types-of-wildlife-activities-for-animal-lovers",
        canonicalUrl: `https://animaldex.app${blogHrefs.wildlifeActivities}`,
        title: "Best Types of Wildlife Activities for Animal Lovers",
        description:
            "Birding, herping, night walks, macro, marine shore time, and photography outings — how those wildlife activities differ, and which AnimalDex listings match.",
        publishedAt,
        updatedAt: publishedAt,
        featuredImage: earnBlogImage(
            "/images/placeholders/feature-discovery-overview.svg",
            "Different wildlife activities from birding to night walks shown as field outings"
        ),
        readingMinutes: 8,
        tags: ["wildlife-experiences"],
        searchIntents: ["wildlife activities", "wildlife trips", "animal spotting tour", "nature guide"],
        speciesSlugs: [],
        sections: [
            {
                title: "Pick the activity, then the listing",
                paragraphs: [
                    "Animal lovers do not all want the same morning. Birding is ears and sky. Herping is edges and patience. Night walks are frogs and insects. Macro is the path you already walked. Marine listings on AnimalDex are shore and tide line, not a boat AnimalDex operates."
                ],
                inlineLinks: [earnRelatedLinks.experiences]
            },
            {
                title: "What AnimalDex can and cannot show you",
                paragraphs: [
                    "The live directory only shows published, approved experiences. Empty categories stay empty until a Guide lists one. That is better than a fake ‘best of’ city list.",
                    "If you want to lead the outing instead of joining one, that is a different page."
                ],
                inlineLinks: [
                    {text: "Become an AnimalDex Wildlife Guide", slug: "become-a-wildlife-guide", href: earnPaths.becomeGuide}
                ]
            }
        ]
    })
];
