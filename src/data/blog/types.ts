import {BlogMediaBlock, CanonicalContentMetadata} from "@/data/content-schema";

export type BlogLink = {
    text: string;
    slug: string;
    href?: string;
    kind?: "species" | "challenge";
};

export type BlogSectionCard = {
    label: string;
    body: string;
    links?: BlogLink[];
    image?: {
        src: string;
        alt: string;
        width: number;
        height: number;
    };
};

export type BlogSectionTable = {
    columns: string[];
    rows: Array<{
        cells: string[];
    }>;
};

export type BlogSource = {
    label: string;
    href: string;
};

export type BlogSubsection = {
    title: string;
    paragraphs: string[];
    media?: BlogMediaBlock;
    pullQuote?: string;
};

export type BlogSection = {
    kicker?: string;
    headingLevel?: 2 | 3;
    html?: string;
    title: string;
    paragraphs: string[];
    cards?: BlogSectionCard[];
    table?: BlogSectionTable;
    inlineLinks?: BlogLink[];
    speciesSlugs?: string[];
    media?: BlogMediaBlock;
    pullQuote?: string;
    codeBlocks?: Array<{
        language?: string;
        code: string;
        caption?: string;
        render?: boolean;
    }>;
    subsections?: BlogSubsection[];
};

export type BlogFAQ = {
    question: string;
    answer: string;
};

export type BlogPost = CanonicalContentMetadata & {
    slug: string;
    headerHtml?: string;
    canonicalUrl?: string;
    originalPublicationUrl?: string;
    originalPublicationLabel?: string;
    readingMinutes: number;
    author?: string;
    tags: string[];
    searchIntents: string[];
    speciesSlugs: string[];
    systemsSpeciesSlugs?: string[];
    relatedChallengeSlugs?: string[];
    tableOfContents?: string[];
    sections: BlogSection[];
    faq?: BlogFAQ[];
    sources?: BlogSource[];
};

export type AnimalSystemsPostInput = Omit<BlogPost, "publishedAt" | "updatedAt" | "author" | "speciesSlugs" | "systemsSpeciesSlugs"> & {
    speciesSlug: string;
    author?: string;
};

export function createAnimalSystemsPost({
    speciesSlug,
    author = "AnimalDex Systems Desk",
    ...post
}: AnimalSystemsPostInput): BlogPost {
    return {
        ...post,
        publishedAt: "2026-04-10",
        updatedAt: "2026-04-10",
        author,
        speciesSlugs: [speciesSlug],
        systemsSpeciesSlugs: [speciesSlug]
    };
}
