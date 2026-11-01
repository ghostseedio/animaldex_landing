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
 * The header (JRN-35): How it works · Animals · Articles, then Talk to an
 * animal and Get the app. Animals holds the catalog and what each animal
 * teaches; Articles the reading and help. The search-traffic hubs live in
 * the footer.
 */
export const headerAnimalLinks: PublicNavLink[] = [
    {href: "/animals", labelKey: "browseAnimals", preview: "browse"},
    {href: "/animal-powers", labelKey: "animalPowers", preview: "lessons"},
    {href: ANIMAL_TRIALS_HREF, labelKey: "animalTrials", preview: "challenge"},
    {href: "/qualities", labelKey: "animalQualities", preview: "powers"},
    {href: ANIMAL_FREQUENCIES_HREF, labelKey: "animalFrequencies", preview: "behaviours"},
    {href: LOCATIONS_HREF, labelKey: "locations", preview: "locations"},
    {href: WILDLIFE_GUIDES_HREF, labelKey: "wildlifeGuides", preview: "experiences"}
];

export const headerArticleLinks: PublicNavLink[] = [
    {href: BLOG_HREF, labelKey: "allArticles", preview: "symbolism"},
    {href: ADVICE_FATIGUE_HREF, labelKey: "adviceFatigue", preview: "ask"},
    {href: "/animal-wisdom", labelKey: "discoverAnimalWisdom", preview: "lessons"},
    {href: "/animal-symbolism", labelKey: "animalSymbolism", preview: "symbolism"},
    {href: "/support", labelKey: "support", preview: "support"}
];

/** How it works is a page of its own in the header, before the two menus. */
export const howItWorksNavLink: PublicNavLink = {href: HOW_IT_WORKS_HREF, labelKey: "howItWorks"};

export const headerDropdowns: PublicNavSection[] = [
    // The catalog above the rule, the places to go and use it below.
    {id: "explore", titleKey: "animalsNav", links: headerAnimalLinks, ruleAfterHref: ANIMAL_FREQUENCIES_HREF},
    // Reading above the rule, help below.
    {id: "articles", titleKey: "blog", links: headerArticleLinks, ruleAfterHref: "/animal-symbolism"}
];

export const DEFAULT_MOBILE_ACCORDION_ID = "explore";

export const mobileAccordionSections: PublicNavSection[] = headerDropdowns;

/** The drawer pins these at its foot: Talk to an animal, then Get the app beside the account. */
export const PINNED_DRAWER_HREFS = [TALK_HREF, START_COLLECTION_HREF];

/**
 * The mobile drawer's "More" group: what neither the top-level How it works
 * nor the two accordions carry, and not the pinned actions at its foot.
 */
export const moreNavGroups: PublicNavLink[][] = [
    [
        ...productLinks.filter((link) => !PINNED_DRAWER_HREFS.includes(link.href)
            && link.href !== HOW_IT_WORKS_HREF
            && !headerDropdowns.some((section) => section.links.some((item) => item.href === link.href))),
        {href: "/contact", labelKey: "contact"}
    ]
];

/** Kept for the footer and older callers: Articles' own link. */
export const blogNavLink: PublicNavLink = {href: BLOG_HREF, labelKey: "blog"};

export const footerColumns: Array<{
    titleKey: string;
    links?: PublicNavLink[];
    groups?: PublicNavLink[][];
}> = [
    {titleKey: "footerGroups.product", links: productLinks},
    {titleKey: "footerGroups.explore", links: exploreAnimalLinks},
    {titleKey: "footerGroups.wisdom", links: animalWisdomLinks},
    {titleKey: "footerGroups.resources", links: resourceLinks}
];
