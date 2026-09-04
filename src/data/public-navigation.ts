export type PublicNavLink = {
    href: string;
    labelKey: string;
};

export type PublicNavSection = {
    id: string;
    titleKey: string;
    links: PublicNavLink[];
};

export const START_COLLECTION_HREF = "/#download";
export const BLOG_HREF = "/blog";
export const LOCATIONS_HREF = "/locations";
export const INSTAGRAM_WILDLIFE_ARCHIVE_HREF = "/use-cases/import-instagram-wildlife-photos";

export const exploreAnimalLinks: PublicNavLink[] = [
    {href: "/animals", labelKey: "browseAnimals"},
    {href: "/comparisons", labelKey: "compareAnimals"},
    {href: "/tier-list", labelKey: "animalTierLists"},
    {href: LOCATIONS_HREF, labelKey: "locations"},
    {href: INSTAGRAM_WILDLIFE_ARCHIVE_HREF, labelKey: "instagramWildlifeArchive"},
    {href: "/what-animal-am-i", labelKey: "whatAnimalAmI"}
];

export const animalWisdomLinks: PublicNavLink[] = [
    {href: "/animal-wisdom", labelKey: "discoverAnimalWisdom"},
    {href: "/powers", labelKey: "animalAbilities"},
    {href: "/animal-lessons", labelKey: "animalLessons"},
    {href: "/animal-symbolism", labelKey: "animalSymbolism"}
];

export const experienceLinks: PublicNavLink[] = [
    {href: "/wildlife-experiences", labelKey: "wildlifeExperiences"},
    {href: "/wildlife-guides", labelKey: "findAWildlifeGuide"},
    {href: LOCATIONS_HREF, labelKey: "locations"}
];

export const earnLinks: PublicNavLink[] = [
    {href: "/earn-on-animaldex", labelKey: "earnOnAnimalDex"},
    {href: "/become-a-wildlife-guide", labelKey: "becomeAWildlifeGuide"},
    {href: "/creator-rewards", labelKey: "creatorRewards"}
];

export const productLinks: PublicNavLink[] = [
    {href: "/#more", labelKey: "howAnimalDexWorks"},
    {href: "/#features", labelKey: "appFeatures"},
    {href: "/use-cases", labelKey: "whosItFor"},
    {href: START_COLLECTION_HREF, labelKey: "startYourCollection"}
];

export const experienceEarnFooterGroups: PublicNavLink[][] = [
    [
        {href: "/wildlife-experiences", labelKey: "wildlifeExperiences"},
        {href: "/wildlife-guides", labelKey: "findAWildlifeGuide"}
    ],
    earnLinks
];

export const resourceLinks: PublicNavLink[] = [
    {href: BLOG_HREF, labelKey: "blog"},
    {href: "/support", labelKey: "support"},
    {href: "/contact", labelKey: "contact"},
    {href: "/sponsor-a-challenge", labelKey: "sponsorAChallenge"},
    {href: "/branding", labelKey: "brandAssets"}
];

export const headerDropdowns: PublicNavSection[] = [
    {id: "explore", titleKey: "exploreAnimals", links: exploreAnimalLinks},
    {id: "wisdom", titleKey: "animalWisdom", links: animalWisdomLinks},
    {id: "experiences", titleKey: "experiences", links: experienceLinks},
    {id: "earn", titleKey: "earn", links: earnLinks}
];

export const DEFAULT_MOBILE_ACCORDION_ID = "explore";

/** Desktop keeps Wildlife Locations in Experiences; mobile shows it once under Explore Animals. */
export const mobileExperienceLinks: PublicNavLink[] = experienceLinks.filter(
    (link) => link.href !== LOCATIONS_HREF
);

export const mobileAccordionSections: PublicNavSection[] = headerDropdowns.map((section) => (
    section.id === "experiences"
        ? {...section, links: mobileExperienceLinks}
        : section
));

export const moreNavGroups: PublicNavLink[][] = [
    productLinks.filter((link) => link.href !== START_COLLECTION_HREF),
    resourceLinks.filter((link) => link.href !== BLOG_HREF)
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
    {titleKey: "footerGroups.experienceAndEarn", groups: experienceEarnFooterGroups},
    {titleKey: "footerGroups.resources", links: resourceLinks}
];
