export const earnPaths = {
    earn: "/earn-on-animaldex",
    becomeGuide: "/become-a-wildlife-guide",
    creatorRewards: "/creator-rewards",
    sponsor: "/sponsor-a-challenge",
    wildlifeGuidesMarketplace: "/wildlife-guides",
    wildlifeExperiences: "/wildlife-experiences",
    contact: "/contact",
    support: "/support",
    download: "/#download"
} as const;

export const earnCanonicalRoutes = [
    earnPaths.earn,
    earnPaths.becomeGuide,
    earnPaths.creatorRewards,
    earnPaths.sponsor
] as const;

export const earnStatus = {
    guides: "BETA — AVAILABLE",
    creatorRewards: "CURRENTLY PAUSED",
    sponsoredChallenges: "AVAILABLE",
    challengeAchievements: "Achievement rewards available today",
    challengeCash: "Cash rewards are not currently live"
} as const;

export const earnFacts = {
    wildCaptures: 45,
    wildSpecies: 20,
    accountAgeDays: 30,
    payoutSlaDays: 14,
    starterCredits: 10,
    referralInviterCredits: 5,
    referralInviteeCredits: 3,
    firstWildSpeciesCredits: 1,
    packPlatformFeePercent: 10
} as const;

export const guideCategories = [
    {id: "general-wildlife", title: "General wildlife", detail: "Local walks for birds, mammals, reptiles, and whatever is active that day."},
    {id: "birding", title: "Birding", detail: "Dawn choruses, wetlands, and countryside edges for people who already carry binoculars."},
    {id: "herping", title: "Herping", detail: "Evening and night walks for frogs, snakes, and other reptiles — without handling."},
    {id: "insects-macro", title: "Insects / macro", detail: "Slow looks at butterflies, bees, and smaller wildlife along public paths."},
    {id: "marine-wildlife", title: "Marine wildlife", detail: "Shorelines, tide lines, and publicly accessible coast — not boat charters AnimalDex operates."},
    {id: "wildlife-photography", title: "Wildlife photography", detail: "Field time for people who want identification context while they shoot."},
    {id: "night-wildlife", title: "Night wildlife", detail: "After-dark watching with lights used to look, not to lure."}
] as const;

export const challengeObjectives = [
    {id: "unique-indexed", title: "Unique indexed animals", detail: "Capture a set number of different animals that AnimalDex can index."},
    {id: "eligible-captures", title: "Qualifying capture count", detail: "Make a set number of captures that meet the campaign rules."},
    {id: "active-days", title: "Active capture days", detail: "Be out collecting on a set number of different days during the window."}
] as const;

export const sponsorAudiences = [
    {title: "Zoos", detail: "Give visitors something to do after they leave the gate: keep noticing animals."},
    {title: "Aquariums", detail: "Extend an exhibition into a free-to-join Challenge people can finish on site or nearby."},
    {title: "Wildlife parks", detail: "Turn a visit into a short, rule-based discovery loop without paid entry."},
    {title: "Tourism boards", detail: "Point travelers at real local wildlife instead of a generic city checklist."},
    {title: "Conservation organisations", detail: "Invite people to look carefully, not to handle or disturb animals."},
    {title: "Outdoor and wildlife brands", detail: "Sponsor a time-boxed Challenge tied to a place, season, or species theme."}
] as const;

export const supportArticleHrefs = {
    howEarn: "/support/earnings/how-do-i-earn-on-animaldex",
    whatCredits: "/support/earnings/what-are-animaldex-credits",
    whatEarnings: "/support/earnings/what-are-animaldex-earnings",
    becomeGuide: "/support/wildlife-guides/how-do-i-become-a-wildlife-guide",
    guidePayments: "/support/wildlife-guides/how-do-wildlife-guide-bookings-and-payments-work",
    whatCreatorRewards: "/support/earnings/what-are-creator-rewards",
    whyCreatorPaused: "/support/earnings/why-are-creator-rewards-unavailable",
    whatSponsored: "/support/sponsored-challenges/what-are-sponsored-challenges",
    howSponsor: "/support/sponsored-challenges/how-can-a-business-sponsor-an-animaldex-challenge",
    creditsWorthMoney: "/support/earnings/are-animaldex-credits-worth-real-money"
} as const;

export const blogHrefs = {
    photographerCollection: "/blog/how-wildlife-photographers-can-build-a-digital-species-collection",
    photographyIncome: "/blog/can-wildlife-photography-make-money",
    guidingSideIncome: "/blog/how-to-turn-local-wildlife-knowledge-into-a-guiding-side-income",
    trackSpecies: "/blog/why-every-wildlife-photographer-should-track-the-species-they-photograph",
    birdingToHerping: "/blog/from-birding-to-herping-build-a-public-record-of-what-you-find",
    fieldChallenges: "/blog/wildlife-photography-challenges-that-make-you-better-in-the-field",
    genuineContribution: "/blog/how-animaldex-rewards-genuine-wildlife-contribution",
    zooExplorers: "/blog/how-zoos-can-turn-visitors-into-active-wildlife-explorers",
    zooMarketing: "/blog/interactive-zoo-marketing-ideas-that-go-beyond-discount-tickets",
    aquariumChallenges: "/blog/how-aquariums-can-use-digital-wildlife-challenges-to-increase-engagement",
    parkGamification: "/blog/gamification-ideas-for-wildlife-parks-and-nature-attractions",
    tourismCampaigns: "/blog/how-tourism-boards-can-build-wildlife-discovery-campaigns",
    whatSponsoredChallenge: "/blog/what-is-a-sponsored-wildlife-challenge",
    sponsoredForBusiness: "/blog/how-animaldex-sponsored-challenges-work-for-businesses",
    becomeGuideHowTo: "/blog/how-to-become-a-wildlife-guide-with-animaldex",
    birdersGuideIncome: "/blog/can-birders-make-money-as-local-guides",
    startBirdingExperiences: "/blog/how-to-start-offering-local-birding-experiences",
    herpersGuide: "/blog/how-herpers-can-turn-local-knowledge-into-guided-wildlife-experiences",
    ethicalGuide: "/blog/what-makes-a-great-ethical-wildlife-guide",
    photographyGuideClients: "/blog/how-wildlife-photography-guides-can-find-new-clients",
    ethicalHerpingTours: "/blog/how-to-find-ethical-herping-tours-and-local-reptile-guides",
    guidedHerpingTrip: "/blog/what-to-expect-on-a-guided-herping-trip",
    chooseLocalGuide: "/blog/how-to-choose-a-local-wildlife-guide",
    birdingGuideVsAlone: "/blog/birding-guide-vs-going-alone",
    nightWildlifeWalk: "/blog/what-happens-on-a-night-wildlife-walk",
    photographyToursLookFor: "/blog/wildlife-photography-tours-what-to-look-for",
    ethicalTravelExperiences: "/blog/how-to-find-ethical-wildlife-experiences-while-traveling",
    wildlifeActivities: "/blog/best-types-of-wildlife-activities-for-animal-lovers"
} as const;

export const sponsorMailto =
    "mailto:support@animaldex.app?subject=" + encodeURIComponent("AnimalDex Sponsorship / Marketing Enquiry");

export const creditsAreNotCash =
    "AnimalDex Credits are not cash. They cannot be withdrawn or converted into Earnings.";

export const earnProductPageMeta = {
    earn: {
        title: "Ways to Earn on AnimalDex | Credits vs Real-Money Earnings",
        description:
            "See how AnimalDex Credits and real-money Earnings differ. Wildlife Guides are in live beta. Creator Rewards are paused. Sponsored Challenge cash is not live."
    },
    becomeGuide: {
        title: "Become an AnimalDex Wildlife Guide | Lead Local Wildlife Experiences",
        description:
            "Turn local wildlife knowledge into bookable AnimalDex Wildlife Guide experiences. Apply after 45 wild captures, 20 wild species, and a 30-day account. Cash on the day."
    },
    creatorRewards: {
        title: "AnimalDex Creator Rewards | Rewarding Wildlife Contribution",
        description:
            "Creator Rewards is a company-funded program for eligible live wildlife contribution during open reward periods. It is currently paused and not open for payouts."
    },
    wildlifeExperiences: {
        title: "Wildlife Experiences & Local Guides | AnimalDex",
        description:
            "Find local wildlife experiences with approved AnimalDex Guides — herping, birding, night walks, photography, and other guided time in the field. Requests are not instant bookings."
    },
    sponsor: {
        title: "Sponsor an AnimalDex Challenge | Wildlife Campaigns & Partnerships",
        description:
            "Sponsor a free-to-join AnimalDex Challenge for zoos, aquariums, parks, tourism boards, and wildlife brands. Achievement rewards are live. Cash rewards are not."
    }
} as const;
