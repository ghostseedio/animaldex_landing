import {BlogFAQ, BlogPost, BlogSection, BlogSource} from "@/data/blog/types";

export type SymbolismThemeSection = {
    title: string;
    paragraphs: string[];
    imageFile?: string;
    imageAlt?: string;
    pullQuote?: string;
};

export type SymbolismPostInput = {
    speciesSlug: string;
    displayName: string;
    principleCluster: string;
    title: string;
    description: string;
    readingMinutes?: number;
    tags?: string[];
    searchIntents?: string[];
    quickAnswer: string[];
    whatIs: string[];
    biologicalBasis: string[];
    themes: SymbolismThemeSection[];
    teaches: string[];
    finalMeaning: string[];
    summaryRows: Array<[string, string]>;
    relatedSymbolismSlugs: string[];
    faq: BlogFAQ[];
    sources: BlogSource[];
    tableOfContentsExtra?: string[];
    publishedAt?: string;
    updatedAt?: string;
    pullQuote?: string;
};

const SITE = "https://animaldex.app";

export function symbolismImage(speciesSlug: string, src: string, alt: string, width = 1536, height = 1024, caption?: string) {
    return {
        src: `/images/blog/${speciesSlug}-symbolism/${src}`,
        alt,
        width,
        height,
        caption
    };
}

function exploreLinks(speciesSlug: string, principleCluster: string) {
    const principleSlug = principleCluster.toLowerCase();
    return [
        {text: `${speciesSlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} species page`, slug: speciesSlug, href: `${SITE}/animals/${speciesSlug}`},
        {text: "Animal lesson", slug: speciesSlug, href: `${SITE}/animal-lessons/${speciesSlug}`},
        {text: `${principleCluster} animal quality`, slug: principleSlug, href: `${SITE}/qualities/${principleSlug}`},
        {text: "Animal Symbolism hub", slug: "animal-symbolism", href: `${SITE}/animal-symbolism`}
    ];
}

function relatedLinks(slugs: string[]) {
    return slugs.map((slug) => ({
        text: slug.replace(/-symbolism$/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") + " Symbolism",
        slug,
        href: `${SITE}/blog/${slug}`
    }));
}

export function buildSymbolismSections(input: SymbolismPostInput): BlogSection[] {
    const {speciesSlug, displayName, principleCluster, themes} = input;
    const img = (file: string, alt: string) => symbolismImage(speciesSlug, file, alt);

    const sections: BlogSection[] = [
        {
            kicker: "Quick answer",
            title: "Quick Answer",
            paragraphs: input.quickAnswer,
            pullQuote: input.pullQuote
        },
        {
            title: `What Is a ${displayName}?`,
            paragraphs: input.whatIs,
            media: {
                type: "image",
                image: img(`what-is-a-${speciesSlug.split("-").pop()}.webp`, `${displayName} in its natural habitat`)
            },
            speciesSlugs: [speciesSlug]
        },
        {
            title: "Biological Basis of the Symbol",
            paragraphs: input.biologicalBasis,
            media: {
                type: "image",
                image: img(`${speciesSlug.split("-").pop()}-biology-symbolism.webp`, `${displayName} biological traits that shape its symbolism`)
            },
            speciesSlugs: [speciesSlug]
        }
    ];

    for (const theme of themes) {
        sections.push({
            title: theme.title,
            paragraphs: theme.paragraphs,
            pullQuote: theme.pullQuote,
            media: theme.imageFile
                ? {type: "image", image: img(theme.imageFile, theme.imageAlt || theme.title)}
                : undefined
        });
    }

    sections.push(
        {
            title: `What the ${displayName} Teaches`,
            paragraphs: input.teaches,
            media: {
                type: "image",
                image: img(`${speciesSlug}-symbolism-lesson.webp`, `${displayName} symbolism lesson`)
            }
        },
        {
            title: `Final Meaning of ${displayName} Symbolism`,
            paragraphs: input.finalMeaning,
            media: {
                type: "image",
                image: img(`${speciesSlug}-symbolism-final.webp`, `Final ${displayName} symbolism meaning`)
            }
        },
        {
            title: `${displayName} Symbolism Quick Summary`,
            paragraphs: [],
            table: {
                columns: [`${displayName} Trait`, "Symbolic Meaning"],
                rows: input.summaryRows.map(([trait, meaning]) => ({cells: [trait, meaning]}))
            }
        },
        {
            title: "Explore on AnimalDex",
            paragraphs: [
                `Continue learning about the ${displayName} through species facts, behavior lessons, and related survival strategies on AnimalDex.`
            ],
            inlineLinks: exploreLinks(speciesSlug, principleCluster)
        },
        {
            title: "Related Animal Symbolism",
            paragraphs: ["Explore more AnimalDex symbolism guides connected by theme, biology, or principle cluster."],
            inlineLinks: relatedLinks(input.relatedSymbolismSlugs)
        }
    );

    return sections;
}

export function createSymbolismPost(input: SymbolismPostInput): BlogPost {
    const slug = `${input.speciesSlug}-symbolism`;
    const displayLower = input.displayName.toLowerCase();
    const themeTitles = input.themes.map((t) => t.title);
    const tableOfContents = [
        "Quick Answer",
        `What Is a ${input.displayName}?`,
        "Biological Basis of the Symbol",
        ...themeTitles,
        `What the ${input.displayName} Teaches`,
        `Final Meaning of ${input.displayName} Symbolism`,
        `${input.displayName} Symbolism Quick Summary`,
        "Explore on AnimalDex",
        "Related Animal Symbolism",
        ...(input.tableOfContentsExtra || [])
    ];

    return {
        slug,
        canonicalUrl: `${SITE}/blog/${slug}`,
        title: input.title,
        description: input.description,
        publishedAt: input.publishedAt || "2026-06-14",
        updatedAt: input.updatedAt || "2026-06-14",
        featuredImage: symbolismImage(
            input.speciesSlug,
            `${input.speciesSlug}-symbolism-hero.webp`,
            `${input.displayName} symbolism hero image`,
            1536,
            1024,
            input.description.slice(0, 120)
        ),
        readingMinutes: input.readingMinutes || 9,
        author: "AnimalDex",
        tags: input.tags || [`${input.displayName} Symbolism`, "Animal Symbolism", "Animal Archetypes", input.principleCluster, "AnimalDex"],
        searchIntents: input.searchIntents || [
            `${displayLower} symbolism`,
            `what does a ${displayLower} symbolize`,
            `${displayLower} spiritual meaning`,
            `${displayLower} meaning`,
            `${displayLower} animal meaning`
        ],
        speciesSlugs: [input.speciesSlug],
        systemsSpeciesSlugs: [input.speciesSlug],
        tableOfContents,
        sections: buildSymbolismSections(input),
        faq: input.faq,
        sources: input.sources
    };
}
