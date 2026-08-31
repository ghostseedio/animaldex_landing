import {getSupportContent, type SupportFAQ, type SupportSection} from "@/data/support-content";

export type SupportArticleStatus = "draft" | "published" | "archived";

export type SupportArticle = {
    id: string;
    slug: string;
    categorySlug: string;
    categoryTitle: string;
    title: string;
    summary: string;
    body: string;
    tags: string[];
    keywords: string[];
    aliases: string[];
    status: SupportArticleStatus;
    sortOrder: number;
    linkHref?: string;
    linkLabel?: string;
    updatedAt: string;
    publishedAt: string;
};

export type SupportArticleSearchHit = {
    id: string;
    slug: string;
    categorySlug: string;
    categoryTitle: string;
    title: string;
    summary: string;
    snippet: string;
    score: number;
    href: string;
};

const ARTICLE_UPDATED_AT = "2026-08-30T00:00:00.000Z";

const CATEGORY_ALIASES: Record<string, string[]> = {
    "getting-started": ["basics", "start", "new user", "account"],
    "scanning-captures": ["scan", "camera", "capture", "photo", "processing", "upload"],
    identification: ["identify", "accuracy", "wrong", "confidence", "ai"],
    "animaldex-numbers": ["index", "number", "dex number", "catalog"],
    "collections-cards": ["collection", "cards", "album", "journal"],
    "credits-purchases": ["credits", "purchase", "pro", "restore", "billing", "subscription", "paddle", "web purchase", "payment pending"],
    earnings: ["earnings", "earn", "creator rewards", "payout", "cash", "money", "withdraw"],
    "wildlife-guides": ["wildlife guide", "guide", "booking", "cash on the day", "seller", "birding"],
    "sponsored-challenges": ["sponsored challenge", "sponsor", "campaign", "zoo", "aquarium", "tourism"],
    "instagram-import": ["instagram", "ig", "instagram import", "import posts", "old wildlife photos", "reels", "professional account", "instagram connect", "location import", "wrong species", "connected services", "wildlife photos", "import credits", "screening", "paddle"],
    "account-login": ["login", "password", "sign in", "account", "email"],
    "privacy-safety": ["privacy", "data", "location", "children", "safety"],
    troubleshooting: ["bug", "crash", "fix", "error", "stuck", "not working"]
};

let cachedArticles: SupportArticle[] | null = null;

export function slugifySupportText(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 96);
}

function tokenize(value: string) {
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length > 1);
}

function buildKeywords(section: SupportSection, faq: SupportFAQ) {
    const titleTokens = tokenize(faq.question);
    const categoryTokens = tokenize(`${section.title} ${section.id.replace(/-/g, " ")}`);
    const aliasTokens = (CATEGORY_ALIASES[section.id] ?? []).flatMap((alias) => tokenize(alias));
    return Array.from(new Set([...titleTokens, ...categoryTokens, ...aliasTokens]));
}

function compileArticle(section: SupportSection, faq: SupportFAQ, sortOrder: number): SupportArticle {
    const slug = slugifySupportText(faq.question);
    const id = `${section.id}/${slug}`;
    const keywords = buildKeywords(section, faq);

    return {
        id,
        slug,
        categorySlug: section.id,
        categoryTitle: section.title,
        title: faq.question,
        summary: faq.answer.split(/(?<=[.!?])\s+/)[0]?.slice(0, 180) ?? faq.answer.slice(0, 180),
        body: faq.answer,
        tags: [section.id, section.title.toLowerCase(), ...(CATEGORY_ALIASES[section.id] ?? []).slice(0, 8)],
        keywords,
        aliases: [...(CATEGORY_ALIASES[section.id] ?? []), ...(faq.searchAliases ?? [])],
        status: "published",
        sortOrder,
        linkHref: faq.linkHref,
        linkLabel: faq.linkLabel,
        updatedAt: ARTICLE_UPDATED_AT,
        publishedAt: ARTICLE_UPDATED_AT
    };
}

export function listSupportArticles(locale = "en"): SupportArticle[] {
    if (locale === "en" && cachedArticles) return cachedArticles;

    const content = getSupportContent(locale);
    let sortOrder = 0;
    const articles = content.sections.flatMap((section) =>
        section.items.map((item) => compileArticle(section, item, sortOrder++))
    );

    if (locale === "en") cachedArticles = articles;
    return articles;
}

export function getSupportArticlePath(article: Pick<SupportArticle, "categorySlug" | "slug">) {
    return `/support/${article.categorySlug}/${article.slug}`;
}

export function getSupportArticleBySlugs(categorySlug: string, articleSlug: string, locale = "en") {
    return listSupportArticles(locale).find(
        (article) => article.categorySlug === categorySlug && article.slug === articleSlug && article.status === "published"
    ) ?? null;
}

export function getSupportArticleById(articleId: string, locale = "en") {
    return listSupportArticles(locale).find((article) => article.id === articleId && article.status === "published") ?? null;
}

export function getRelatedSupportArticles(article: SupportArticle, limit = 3, locale = "en") {
    return listSupportArticles(locale)
        .filter((candidate) => candidate.id !== article.id && candidate.categorySlug === article.categorySlug)
        .slice(0, limit);
}

function highlightSnippet(body: string, tokens: string[]) {
    const lowerBody = body.toLowerCase();
    const matchToken = tokens.find((token) => lowerBody.includes(token));
    if (!matchToken) return body.slice(0, 160) + (body.length > 160 ? "…" : "");

    const index = lowerBody.indexOf(matchToken);
    const start = Math.max(0, index - 60);
    const end = Math.min(body.length, index + 120);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < body.length ? "…" : "";
    return `${prefix}${body.slice(start, end).trim()}${suffix}`;
}

function scoreArticle(article: SupportArticle, tokens: string[]) {
    if (!tokens.length) return 0;

    const haystacks = [
        article.title,
        article.summary,
        article.body,
        article.categoryTitle,
        article.keywords.join(" "),
        article.aliases.join(" ")
    ].map((value) => value.toLowerCase());

    const titleLower = article.title.toLowerCase();
    const joinedQuery = tokens.join(" ");
    let score = 0;

    if (titleLower === joinedQuery) score += 120;
    if (titleLower.includes(joinedQuery)) score += 80;

    for (const token of tokens) {
        if (titleLower.includes(token)) score += 28;
        if (article.keywords.some((keyword) => keyword.includes(token))) score += 16;
        if (article.aliases.some((alias) => alias.includes(token))) score += 12;
        if (haystacks.some((haystack) => haystack.includes(token))) score += 8;
    }

    return score;
}

export function searchSupportArticles(query: string, limit = 8, locale = "en"): SupportArticleSearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const tokens = tokenize(trimmed);
    const articles = listSupportArticles(locale).filter((article) => article.status === "published");

    return articles
        .map((article) => {
            const score = scoreArticle(article, tokens);
            if (score <= 0) return null;

            return {
                id: article.id,
                slug: article.slug,
                categorySlug: article.categorySlug,
                categoryTitle: article.categoryTitle,
                title: article.title,
                summary: article.summary,
                snippet: highlightSnippet(article.body, tokens),
                score,
                href: getSupportArticlePath(article)
            };
        })
        .filter((hit): hit is SupportArticleSearchHit => Boolean(hit))
        .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
        .slice(0, Math.max(1, Math.min(limit, 20)));
}

/**
 * Future AI / RAG boundary: query published articles through this function (or a DB-backed
 * successor with identical return shape) rather than duplicating search logic in assistants.
 */
export function searchSupportArticlesForRetrieval(query: string, limit = 6, locale = "en") {
    return searchSupportArticles(query, limit, locale).map((hit) => ({
        articleId: hit.id,
        title: hit.title,
        summary: hit.summary,
        snippet: hit.snippet,
        category: hit.categoryTitle,
        categorySlug: hit.categorySlug,
        slug: hit.slug,
        canonicalUrl: hit.href,
        updatedAt: getSupportArticleById(hit.id, locale)?.updatedAt ?? ARTICLE_UPDATED_AT,
        status: "published" as const
    }));
}
