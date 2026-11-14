export type PublicNavLink = {
    href: string;
    labelKey: string;
    /**
     * The scene a desktop dropdown shows in its preview pane while this row is
     * hovered or focused (see header-nav-preview). Decorative: the row label
     * names the page.
     */
    preview?: NavPreviewId;
};

export type NavPreviewId =
    | "browse" | "compare" | "tiers" | "hybrid" | "locations" | "experiences"
    | "ask" | "lessons" | "powers" | "behaviours" | "challenge" | "whatAmI"
    | "symbolism" | "support" | "contact" | "sponsor" | "brand";

export type PublicNavSection = {
    id: string;
    titleKey: string;
    links: PublicNavLink[];
    /**
     * Presentational only: the dropdown draws a hairline after this href so a
     * long list reads as two deliberate groups instead of one undifferentiated
     * column. It never changes which links a section contains.
     */
    ruleAfterHref?: string;
};

export const START_COLLECTION_HREF = "/#download";
/**
 * The full-screen chat (docs/rich-chat/SPEC.md §4): the header's primary
 * button on every page, and the home hero's. Anyone can talk there, with no
 * account and no capture.
 */
export const TALK_HREF = "/talk";
export const HOW_IT_WORKS_HREF = "/how-it-works";
export const ADVICE_FATIGUE_HREF = "/advice-fatigue";
export const BLOG_HREF = "/blog";
export const LOCATIONS_HREF = "/locations";
export const INSTAGRAM_WILDLIFE_ARCHIVE_HREF = "/use-cases/import-instagram-wildlife-photos";
export const EARN_ON_ANIMALDEX_HREF = "/earn-on-animaldex";
export const ANIMAL_FREQUENCIES_HREF = "/animal-frequencies";
export const ANIMAL_TRIALS_HREF = "/animal-trials";
export const WILDLIFE_GUIDES_HREF = "/wildlife-guides";
/** The questionnaire that finds the animals who see the world like you. */
export const FIND_YOUR_ANIMALS_HREF = "/what-animal-am-i";
/** AI disclosure, crisis protocol, teen mode and what reaches AI providers (SPEC 3.1). */
export const AI_AND_SAFETY_HREF = "/legal/ai-and-safety";
/** The shared 3D world, and the pages that explain it (SEO lane S3, 2026-11-12). */
export const ARK_HREF = "/ark";
export const ARK_HOW_IT_WORKS_HREF = "/ark/how-it-works";
export const ARK_FOOD_CHAIN_HREF = "/ark/food-chain";
export const ABOUT_HREF = "/about";

/**
 * 01 — AnimalDex: what the product is, and the ways in. Talking comes first
 * (the 2026-10-31 repositioning): the Talk page, how the animals work and the
 * article on advice fatigue, then the app.
 */
export const productLinks: PublicNavLink[] = [
    {href: TALK_HREF, labelKey: "talkToAnAnimal"},
    {href: HOW_IT_WORKS_HREF, labelKey: "howItWorks"},
    {href: ADVICE_FATIGUE_HREF, labelKey: "adviceFatigue"},
    {href: "/use-cases", labelKey: "whosItFor"},
    {href: START_COLLECTION_HREF, labelKey: "getTheApp"},
    {href: INSTAGRAM_WILDLIFE_ARCHIVE_HREF, labelKey: "instagramWildlifeArchive"},
    {href: EARN_ON_ANIMALDEX_HREF, labelKey: "earnOnAnimalDex"}
];

/**
 * 02 — Explore Animals: the catalog and the places to use it. The footer
 * carries the whole column, including the search-traffic hubs (side by side,
 * tier lists, hybrids); the header's Animals menu keeps only the pages a
 * newcomer to the talking animals needs (DECISIONS §8, JRN-35).
 */
export const exploreAnimalLinks: PublicNavLink[] = [
    {href: "/animals", labelKey: "browseAnimals", preview: "browse"},
    {href: "/comparisons", labelKey: "compareAnimals", preview: "compare"},
    {href: "/tier-list", labelKey: "animalTierLists", preview: "tiers"},
    {href: "/animal-hybrids", labelKey: "animalHybrids", preview: "hybrid"},
    {href: LOCATIONS_HREF, labelKey: "locations", preview: "locations"},
    // Oct 2026: back in navigation now that guides are virtual and the list page is public.
    {href: WILDLIFE_GUIDES_HREF, labelKey: "wildlifeGuides", preview: "experiences"}
];

/**
 * 03 — Animal Wisdom: what an animal teaches, rather than what it is.
 *
 * The Oct 2026 rename (Lessons → Powers, Traits → Qualities, Behaviours →
 * Frequencies, Challenge Yourself → Trials) moved every URL here;
 * next.config.js 301s the old ones. `/talk-to-animals` (a search landing that
 * points to /talk) is no longer listed beside the real Talk page, and
 * `/what-animal-am-i` keeps its URL under its new name.
 */
export const animalWisdomLinks: PublicNavLink[] = [
    {href: "/animal-wisdom", labelKey: "discoverAnimalWisdom", preview: "ask"},
    {href: "/animal-powers", labelKey: "animalPowers", preview: "lessons"},
    {href: "/qualities", labelKey: "animalQualities", preview: "powers"},
    {href: ANIMAL_FREQUENCIES_HREF, labelKey: "animalFrequencies", preview: "behaviours"},
    {href: ANIMAL_TRIALS_HREF, labelKey: "animalTrials", preview: "challenge"},
    {href: "/what-animal-am-i", labelKey: "whatAnimalAmI", preview: "whatAmI"}
];

/** 04 — Resources: reading, help, and the things partners ask for. */
export const resourceLinks: PublicNavLink[] = [
    {href: BLOG_HREF, labelKey: "blog"},
    {href: "/animal-symbolism", labelKey: "animalSymbolism", preview: "symbolism"},
    {href: "/support", labelKey: "support", preview: "support"},
    {href: "/contact", labelKey: "contact", preview: "contact"},
    {href: "/sponsor-a-challenge", labelKey: "sponsorAChallenge", preview: "sponsor"},
    {href: "/branding", labelKey: "brandAssets", preview: "brand"}
];

/**
 * The header (Nov 2026 front door): Talk · Find your animals · Get the app.
 * Talk to an animal is the lime button and Get the app the outline beside it;
 * Find your animals is the one link in the nav. Every other page stays live,
 * in the sitemap, search and internal links, just not in the header.
 */
export const findYourAnimalsNavLink: PublicNavLink = {href: FIND_YOUR_ANIMALS_HREF, labelKey: "findYourAnimals"};
/** The Ark leads the header's links (S1's audit, 2026-11-12: the world the product is about was in no navigation). */
export const arkNavLink: PublicNavLink = {href: ARK_HREF, labelKey: "theArk"};
export const headerNavLinks: PublicNavLink[] = [arkNavLink, findYourAnimalsNavLink];

/** Kept for older callers: How it works' own link (it is in the footer now). */
export const howItWorksNavLink: PublicNavLink = {href: HOW_IT_WORKS_HREF, labelKey: "howItWorks"};

/** The drawer keeps its accordion for sections; the slim header has none. */
export const DEFAULT_MOBILE_ACCORDION_ID = "explore";

/** The drawer pins these at its foot: Talk to an animal, then Get the app beside the account. */
export const PINNED_DRAWER_HREFS = [TALK_HREF, START_COLLECTION_HREF];

/** Kept for the footer and older callers: Articles' own link. */
export const blogNavLink: PublicNavLink = {href: BLOG_HREF, labelKey: "blog"};

/**
 * The footer, cut to essentials (Nov 2026): the product's three ways in and
 * How it works; the search hubs most people arrive through; and help. The
 * legal row under it carries Privacy, Terms, Refunds and AI & safety.
 */
export const footerProductLinks: PublicNavLink[] = [
    {href: TALK_HREF, labelKey: "talkToAnAnimal"},
    findYourAnimalsNavLink,
    {href: START_COLLECTION_HREF, labelKey: "getTheApp"},
    howItWorksNavLink
];

/** The Ark: the world, how it works, who eats whom, and what AnimalDex is (SEO lane S3). */
export const footerArkLinks: PublicNavLink[] = [
    // The full name in the footer (2026-11-14): the crawlable anchor for people searching "AnimalDex Ark"; the header keeps "The Ark".
    {href: ARK_HREF, labelKey: "animalDexArk"},
    {href: ARK_HOW_IT_WORKS_HREF, labelKey: "howTheArkWorks"},
    {href: ARK_FOOD_CHAIN_HREF, labelKey: "arkFoodChain"},
    {href: ABOUT_HREF, labelKey: "aboutAnimalDex"}
];

export const footerExploreLinks: PublicNavLink[] = [
    {href: "/animals", labelKey: "browseAnimals"},
    {href: "/comparisons", labelKey: "compareAnimals"},
    {href: "/tier-list", labelKey: "animalTierLists"},
    {href: "/animal-hybrids", labelKey: "animalHybrids"}
];

export const footerHelpLinks: PublicNavLink[] = [
    {href: "/support", labelKey: "support"},
    {href: "/contact", labelKey: "contact"},
    blogNavLink
];

export const footerColumns: Array<{
    titleKey: string;
    links?: PublicNavLink[];
    groups?: PublicNavLink[][];
}> = [
    {titleKey: "footerGroups.product", links: footerProductLinks},
    {titleKey: "footerGroups.ark", links: footerArkLinks},
    {titleKey: "footerGroups.explore", links: footerExploreLinks},
    {titleKey: "footerGroups.help", links: footerHelpLinks}
];

export const footerLegalLinks: PublicNavLink[] = [
    {href: "/legal/privacy", labelKey: "privacy"},
    {href: "/legal/terms", labelKey: "terms"},
    {href: "/legal/refunds", labelKey: "refunds"},
    {href: AI_AND_SAFETY_HREF, labelKey: "aiAndSafety"}
];
