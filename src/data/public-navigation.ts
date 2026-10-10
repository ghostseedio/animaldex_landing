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
export const BLOG_HREF = "/blog";
export const LOCATIONS_HREF = "/locations";
export const INSTAGRAM_WILDLIFE_ARCHIVE_HREF = "/use-cases/import-instagram-wildlife-photos";
export const WILDLIFE_EXPERIENCES_HREF = "/wildlife-experiences";
export const EARN_ON_ANIMALDEX_HREF = "/earn-on-animaldex";
export const ANIMAL_FREQUENCIES_HREF = "/animal-frequencies";
export const ANIMAL_TRIALS_HREF = "/animal-trials";

/** 01 — AnimalDex: what the product is, and the two ways in. */
export const productLinks: PublicNavLink[] = [
    {href: "/#more", labelKey: "howAnimalDexWorks"},
    {href: "/#features", labelKey: "appFeatures"},
    {href: "/use-cases", labelKey: "whosItFor"},
    {href: START_COLLECTION_HREF, labelKey: "startYourCollection"},
    {href: INSTAGRAM_WILDLIFE_ARCHIVE_HREF, labelKey: "instagramWildlifeArchive"},
    {href: EARN_ON_ANIMALDEX_HREF, labelKey: "earnOnAnimalDex"}
];

/** 02 — Explore Animals: the catalogue and the places to use it. */
export const exploreAnimalLinks: PublicNavLink[] = [
    {href: "/animals", labelKey: "browseAnimals", preview: "browse"},
    {href: "/comparisons", labelKey: "compareAnimals", preview: "compare"},
    {href: "/tier-list", labelKey: "animalTierLists", preview: "tiers"},
    {href: "/animal-hybrids", labelKey: "animalHybrids", preview: "hybrid"},
    {href: LOCATIONS_HREF, labelKey: "locations", preview: "locations"},
    {href: WILDLIFE_EXPERIENCES_HREF, labelKey: "wildlifeExperiences", preview: "experiences"}
];

/**
 * 03 — Animal Wisdom: what an animal teaches, rather than what it is.
 *
 * `/what-animal-am-i` lives here rather than in Explore Animals: it answers a
 * question about the reader, not a question about the catalogue. The Oct 2026
 * rename (Lessons → Powers, Traits → Qualities, Behaviours → Frequencies,
 * Challenge Yourself → Trials) moved every URL here; next.config.js 301s the old ones.
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
 * Articles keeps its own top-level slot in the header, as it always has, so the
 * Resources dropdown must not repeat it — the mobile drawer renders both and a
 * link appearing twice is a duplicate tap target, not a shortcut. The footer
 * column is unfiltered, since it has no standalone Articles entry.
 */
export const headerResourceLinks: PublicNavLink[] = resourceLinks.filter(
    (link) => link.href !== BLOG_HREF
);

export const headerDropdowns: PublicNavSection[] = [
    // Catalogue above the rule, the places to go and use it below.
    {id: "explore", titleKey: "exploreAnimals", links: exploreAnimalLinks, ruleAfterHref: "/animal-hybrids"},
    // Reading above the rule, the interactive pages below.
    {id: "lessons", titleKey: "animalWisdom", links: animalWisdomLinks, ruleAfterHref: "/qualities"},
    {id: "resources", titleKey: "footerGroups.resources", links: headerResourceLinks, ruleAfterHref: "/support"}
];

export const DEFAULT_MOBILE_ACCORDION_ID = "explore";

export const mobileAccordionSections: PublicNavSection[] = headerDropdowns;

/**
 * The mobile drawer's "More" group: everything the accordions do not already
 * carry. Start Your Collection is excluded because the drawer pins it as a CTA,
 * and the resource links are excluded because they are now an accordion of
 * their own — leaving the product links, minus that CTA.
 */
export const moreNavGroups: PublicNavLink[][] = [
    productLinks.filter((link) => link.href !== START_COLLECTION_HREF)
];

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
