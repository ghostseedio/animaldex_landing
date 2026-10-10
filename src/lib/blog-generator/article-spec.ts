import type {BlogPost, BlogSection} from "@/data/blog/types";
import type {BlogMediaBlock, ContentImage} from "@/data/content-schema";
import {embedProblem, readEmbedSpec, renderEmbed, type EmbedSpec} from "@/lib/blog-generator/embeds";

// What the writer returns (ArticleSpec) and how it becomes a live BlogPost.
// Pure: no I/O, so the checks here are covered by unit tests.

export type ImageSlot = {query: string; mustShow: string; alt: string};

export type ArticleSection = {
    title: string;
    kicker: string;
    paragraphs: string[];
    pullQuote: string;
    /** Internal links: `text` must appear verbatim in one of the paragraphs. */
    links: Array<{text: string; href: string}>;
    image: ImageSlot | null;
    table: {columns: string[]; rows: string[][]} | null;
    cards: Array<{label: string; body: string}>;
    embed: EmbedSpec | null;
};

export type ArticleSpec = {
    title: string;
    slug: string;
    metaDescription: string;
    quickAnswer: string;
    tags: string[];
    searchIntents: string[];
    heroImage: ImageSlot;
    sections: ArticleSection[];
    faq: Array<{question: string; answer: string}>;
    sources: Array<{label: string; url: string}>;
    speciesSlugs: string[];
};

// The writer replies with plain JSON in this shape. Structured outputs can't
// carry it: even flattened, the article schema compiles to a grammar the API
// rejects as too large. So the shape is described in the prompt and fromWire()
// below tolerates gaps, with the assemble checks catching anything that matters.
// The shape is flat: one generic embed object (kind "none" for no embed), and
// empty strings/arrays mean "absent".
export const ARTICLE_JSON_SHAPE = `{
  "title": string,
  "slug": string,
  "metaDescription": string,
  "quickAnswer": string,
  "tags": string[],
  "searchIntents": string[],
  "heroImage": {"query": string, "mustShow": string, "alt": string},
  "sections": [{
    "title": string,
    "kicker": string,
    "paragraphs": string[],
    "pullQuote": string,
    "links": [{"text": string, "href": string}],
    "image": {"query": string, "mustShow": string, "alt": string},
    "tableColumns": string[],
    "tableRows": string[][],
    "cards": [{"label": string, "body": string}],
    "embed": {
      "kind": "none" | "bar" | "duel" | "timeline" | "quiz" | "flipcards",
      "title": string, "unit": string, "caption": string, "left": string, "right": string,
      "items": [{"label": string, "value": number, "highlight": boolean, "note": string, "left": number, "right": number, "leftLabel": string, "rightLabel": string, "when": string, "body": string}],
      "questions": [{"question": string, "options": string[], "answer": number, "explanation": string}]
    }
  }],
  "faq": [{"question": string, "answer": string}],
  "sources": [{"label": string, "url": string}],
  "speciesSlugs": string[]
}`;

type WireEmbedItem = {label: string; value: number; highlight: boolean; note: string; left: number; right: number; leftLabel: string; rightLabel: string; when: string; body: string};
type WireEmbed = {kind: "none" | EmbedSpec["kind"]; title: string; unit: string; caption: string; left: string; right: string; items: WireEmbedItem[]; questions: Array<{question: string; options: string[]; answer: number; explanation: string}>};
type WireSection = Omit<ArticleSection, "image" | "table" | "embed"> & {image: ImageSlot; tableColumns: string[]; tableRows: string[][]; embed: WireEmbed};
export type ArticleWire = Omit<ArticleSpec, "sections"> & {sections: WireSection[]};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);
const slot = (value: unknown): ImageSlot => {
    const image = (value ?? {}) as Partial<ImageSlot>;
    return {query: text(image.query), mustShow: text(image.mustShow), alt: text(image.alt)};
};

function embedFromWire(embed: Partial<WireEmbed> | undefined): EmbedSpec | null {
    if (!embed || !embed.kind || embed.kind === "none") return null;
    const items = list<Partial<WireEmbedItem>>(embed.items);
    const title = text(embed.title);
    const caption = text(embed.caption);
    switch (embed.kind) {
        case "bar":
            return {kind: "bar", title, caption, unit: text(embed.unit), bars: items.map((item) => ({label: text(item.label), value: number(item.value), highlight: item.highlight === true, note: text(item.note)}))};
        case "duel":
            return {kind: "duel", title, caption, left: text(embed.left), right: text(embed.right), metrics: items.map((item) => ({label: text(item.label), left: number(item.left), right: number(item.right), leftLabel: text(item.leftLabel), rightLabel: text(item.rightLabel)}))};
        case "timeline":
            return {kind: "timeline", title, caption, events: items.map((item) => ({when: text(item.when), title: text(item.label), body: text(item.body)}))};
        case "quiz":
            return {kind: "quiz", title, questions: list<{question?: unknown; options?: unknown; answer?: unknown; explanation?: unknown}>(embed.questions).map((question) => ({question: text(question.question), options: list<unknown>(question.options).map(text).filter(Boolean), answer: Math.trunc(number(question.answer)), explanation: text(question.explanation)}))};
        case "flipcards":
            return {kind: "flipcards", title, cards: items.map((item) => ({front: text(item.label), back: text(item.body)}))};
        default:
            return null;
    }
}

/** The writer's JSON → ArticleSpec, defaulting anything missing or mistyped. */
export function fromWire(raw: unknown): ArticleSpec {
    const wire = (raw ?? {}) as Partial<ArticleWire>;
    return {
        title: text(wire.title),
        slug: text(wire.slug),
        metaDescription: text(wire.metaDescription),
        quickAnswer: text(wire.quickAnswer),
        tags: list<unknown>(wire.tags).map(text).filter(Boolean),
        searchIntents: list<unknown>(wire.searchIntents).map(text).filter(Boolean),
        heroImage: slot(wire.heroImage),
        sections: list<Partial<WireSection>>(wire.sections).map((section) => {
            const image = slot(section.image);
            const columns = list<unknown>(section.tableColumns).map(text);
            const rows = list<unknown>(section.tableRows).map((row) => list<unknown>(row).map(text));
            return {
                title: text(section.title),
                kicker: text(section.kicker),
                paragraphs: list<unknown>(section.paragraphs).map(text).filter(Boolean),
                pullQuote: text(section.pullQuote),
                links: list<{text?: unknown; href?: unknown}>(section.links).map((link) => ({text: text(link.text), href: text(link.href)})).filter((link) => link.text && link.href),
                image: image.query.trim() ? image : null,
                table: columns.length >= 2 && rows.length ? {columns, rows} : null,
                cards: list<{label?: unknown; body?: unknown}>(section.cards).map((card) => ({label: text(card.label), body: text(card.body)})).filter((card) => card.label && card.body),
                embed: embedFromWire(section.embed)
            };
        }).filter((section) => section.title && section.paragraphs.length),
        faq: list<{question?: unknown; answer?: unknown}>(wire.faq).map((item) => ({question: text(item.question), answer: text(item.answer)})).filter((item) => item.question && item.answer),
        sources: list<{label?: unknown; url?: unknown}>(wire.sources).map((source) => ({label: text(source.label), url: text(source.url)})).filter((source) => source.url),
        speciesSlugs: list<unknown>(wire.speciesSlugs).map(text).filter(Boolean)
    };
}

export function slugify(value: string) {
    const slug = value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug.length <= 80 ? slug : slug.slice(0, 80).replace(/-[^-]*$/, "");
}

/** A slug no other post uses: the writer's choice, else -2, -3… */
export function uniqueSlug(preferred: string, taken: Set<string>) {
    const base = slugify(preferred) || "wildlife-story";
    if (!taken.has(base)) return base;
    for (let index = 2; index < 100; index += 1) {
        const candidate = `${base}-${index}`;
        if (!taken.has(candidate)) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
}

export function countWords(spec: ArticleSpec) {
    const text = [
        spec.quickAnswer,
        ...spec.sections.flatMap((section) => [...section.paragraphs, ...section.cards.map((card) => card.body)]),
        ...spec.faq.map((item) => item.answer)
    ].join(" ");
    return text.split(/\s+/).filter(Boolean).length;
}

// Claims the product cannot make. Kept in step with the content tests that pin
// this phrasing on hand-written posts (see blog-expansion-workflow notes).
const PRODUCT_CLAIM_RULES: Array<{pattern: RegExp; problem: string}> = [
    {pattern: /\b(earn|make|win|get paid)\b[^.]{0,40}\b(money|cash|dollars|income|\$\d)/i, problem: "promises users money"},
    {pattern: /\bcredits?\b[^.]{0,30}\b(cash|money|withdraw|payout)/i, problem: "treats Credits as cash"},
    {pattern: /creator rewards\b(?![^.]{0,60}\bpaused\b)/i, problem: "mentions Creator Rewards without saying it is paused"},
    {pattern: /\b(upload|import)\b[^.]{0,40}\b(camera roll|gallery|old photos?)\b[^.]{0,40}\b(capture|count|qualif)/i, problem: "suggests uploaded photos count as captures"}
];

export type AssembleResult = {
    post: BlogPost;
    problems: string[];
    warnings: string[];
    wordCount: number;
};

type AssembleContext = {
    slug: string;
    images: Map<string, ContentImage>;
    knownHrefs: Set<string>;
    knownSpecies: Set<string>;
    /** URLs the research step actually saw; only these may be cited. */
    researchedUrls: Set<string>;
    reachableUrls: Set<string>;
    /** Web sources required to publish; fewer when the editor supplied material. */
    minSources?: number;
    today: string;
    author?: string;
    /** Editing: photos/videos the live post already has, by "keep:<id>" id. */
    keptMedia?: Map<string, BlogMediaBlock>;
    /** Editing: the post's original date stays; only updatedAt moves. */
    publishedAt?: string;
};

export const KEEP_PREFIX = "keep:";

function keptMediaFor(slot: ImageSlot | null, kept: Map<string, BlogMediaBlock> | undefined) {
    const query = slot?.query.trim() ?? "";
    return query.startsWith(KEEP_PREFIX) ? kept?.get(query.slice(KEEP_PREFIX.length)) : undefined;
}

/** Image requests that need a new photo (kept ones are already in place). */
export function isNewImageSlot(slot: ImageSlot | null): slot is ImageSlot {
    return Boolean(slot?.query.trim()) && !slot!.query.trim().startsWith(KEEP_PREFIX);
}

export function normalizeUrl(value: string) {
    try {
        const url = new URL(value.trim());
        url.hash = "";
        for (const key of Array.from(url.searchParams.keys())) if (/^utm_|^fbclid$|^gclid$/.test(key)) url.searchParams.delete(key);
        return url.toString().replace(/\/$/, "");
    } catch {
        return "";
    }
}

function internalPath(href: string) {
    const trimmed = href.trim();
    if (trimmed.startsWith("/")) return trimmed.replace(/[?#].*$/, "").replace(/\/$/, "") || "/";
    try {
        const url = new URL(trimmed);
        if (/(^|\.)animaldex\.app$/.test(url.hostname)) return url.pathname.replace(/\/$/, "") || "/";
    } catch {
        // not a URL
    }
    return null;
}

export function sectionImageKey(index: number) {
    return `section-${index + 1}`;
}

/** Turns the writer's spec into the BlogPost shape the blog page renders natively. */
export function assembleBlogPost(spec: ArticleSpec, context: AssembleContext): AssembleResult {
    const problems: string[] = [];
    const warnings: string[] = [];

    const keptHero = keptMediaFor(spec.heroImage, context.keptMedia);
    const hero = context.images.get("hero") ?? (keptHero?.type === "image" ? keptHero.image : undefined);
    if (!hero) problems.push("no hero photo passed the image check");

    const sources = spec.sources
        .map((source) => ({label: source.label.trim(), href: normalizeUrl(source.url)}))
        .filter((source, index, list) => source.href && list.findIndex((other) => other.href === source.href) === index)
        .filter((source) => {
            if (!context.researchedUrls.has(source.href)) {
                warnings.push(`dropped a source the research never opened: ${source.href}`);
                return false;
            }
            if (!context.reachableUrls.has(source.href)) {
                warnings.push(`dropped an unreachable source: ${source.href}`);
                return false;
            }
            return true;
        });
    const minSources = context.minSources ?? 2;
    if (sources.length < minSources) problems.push(`only ${sources.length} verifiable source(s); at least ${minSources} required`);

    // Species pages are linked by the blog page itself wherever a species in
    // post.speciesSlugs is named, so those links go there rather than into a
    // section's inlineLinks, which would also print a duplicate row of links.
    const linkedSpecies = new Set<string>();
    const sections: BlogSection[] = [];
    if (spec.quickAnswer.trim()) {
        sections.push({kicker: "Quick answer", title: "The short answer", paragraphs: [spec.quickAnswer.trim()]});
    }

    spec.sections.forEach((section, index) => {
        const paragraphs = section.paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean);
        const prose = paragraphs.join(" ").toLowerCase();
        const inlineLinks = section.links
            .map((link) => ({text: link.text.trim(), path: internalPath(link.href)}))
            .filter((link): link is {text: string; path: string} => {
                if (!link.path || !context.knownHrefs.has(link.path)) {
                    warnings.push(`dropped an internal link to a page we don't have: ${link.path ?? "external"} ("${link.text}")`);
                    return false;
                }
                if (!prose.includes(link.text.toLowerCase())) {
                    warnings.push(`dropped a link whose text isn't in its section: "${link.text}"`);
                    return false;
                }
                return true;
            })
            .filter((link) => {
                const species = link.path.match(/^\/animals\/([a-z0-9-]+)$/)?.[1];
                if (species && context.knownSpecies.has(species)) {
                    linkedSpecies.add(species);
                    return false;
                }
                return true;
            })
            .map((link) => ({text: link.text, slug: link.path.split("/").pop() || link.path, href: link.path}));

        const image = context.images.get(sectionImageKey(index));
        const keptMedia = keptMediaFor(section.image, context.keptMedia);
        const built: BlogSection = {
            title: section.title.trim(),
            paragraphs,
            ...(section.kicker.trim() ? {kicker: section.kicker.trim()} : {}),
            ...(section.pullQuote.trim() ? {pullQuote: section.pullQuote.trim()} : {}),
            ...(inlineLinks.length ? {inlineLinks} : {}),
            ...(image ? {media: {type: "image" as const, image}} : keptMedia ? {media: keptMedia} : {}),
            ...(section.table && section.table.columns.length >= 2 && section.table.rows.length >= 2
                ? {table: {columns: section.table.columns, rows: section.table.rows.map((cells) => ({cells: section.table!.columns.map((_, cellIndex) => cells[cellIndex] ?? "")}))}}
                : {}),
            ...(section.cards.length >= 2 ? {cards: section.cards.map((card) => ({label: card.label, body: card.body}))} : {})
        };
        sections.push(built);

        if (section.embed) {
            const problem = embedProblem(section.embed);
            if (problem) warnings.push(`left out a ${section.embed.kind}: ${problem}`);
            // An html section renders as its own sandboxed frame right after the prose
            // it illustrates; its title only names the frame and stays out of the TOC.
            else sections.push({title: `${section.embed.kind}: ${section.embed.title}`, paragraphs: [], html: renderEmbed(section.embed)});
        }
    });

    const allText = [spec.title, spec.metaDescription, spec.quickAnswer, ...spec.sections.flatMap((section) => [...section.paragraphs, section.pullQuote]), ...spec.faq.flatMap((item) => [item.question, item.answer])].join("\n");
    for (const rule of PRODUCT_CLAIM_RULES) {
        if (rule.pattern.test(allText)) problems.push(`product claim check: ${rule.problem}`);
    }

    const wordCount = countWords(spec);
    if (wordCount < 900) problems.push(`only ${wordCount} words; at least 900 are required`);
    if (spec.title.length > 75) warnings.push(`title is ${spec.title.length} characters; search results cut off around 60`);

    const description = spec.metaDescription.trim().length > 165 ? `${spec.metaDescription.trim().slice(0, 160).replace(/\s+\S*$/, "")}…` : spec.metaDescription.trim();
    const speciesSlugs = Array.from(new Set([...spec.speciesSlugs, ...Array.from(linkedSpecies)].filter((slug) => context.knownSpecies.has(slug))));
    const proseSections = sections.filter((section) => section.html === undefined);

    const post: BlogPost = {
        slug: context.slug,
        title: spec.title.trim(),
        description,
        publishedAt: context.publishedAt ?? context.today,
        updatedAt: context.today,
        author: context.author ?? "AnimalDex Field Desk",
        readingMinutes: Math.max(3, Math.round(wordCount / 230)),
        featuredImage: hero ?? {src: "/images/blog/default-hero.webp", alt: spec.heroImage.alt, width: 1400, height: 933},
        tags: spec.tags.slice(0, 6),
        searchIntents: spec.searchIntents.slice(0, 8),
        speciesSlugs,
        tableOfContents: proseSections.slice(1).map((section) => section.title),
        sections,
        ...(spec.faq.length ? {faq: spec.faq.map((item) => ({question: item.question.trim(), answer: item.answer.trim()}))} : {}),
        ...(sources.length ? {sources} : {})
    };

    return {post, problems, warnings, wordCount};
}

function embedToWire(spec: EmbedSpec | null): WireEmbed {
    const empty = {label: "", value: 0, highlight: false, note: "", left: 0, right: 0, leftLabel: "", rightLabel: "", when: "", body: ""};
    const base: WireEmbed = {kind: "none", title: "", unit: "", caption: "", left: "", right: "", items: [], questions: []};
    if (!spec) return base;
    switch (spec.kind) {
        case "bar":
            return {...base, kind: "bar", title: spec.title, unit: spec.unit, caption: spec.caption, items: spec.bars.map((bar) => ({...empty, label: bar.label, value: bar.value, highlight: Boolean(bar.highlight), note: bar.note ?? ""}))};
        case "duel":
            return {...base, kind: "duel", title: spec.title, caption: spec.caption, left: spec.left, right: spec.right, items: spec.metrics.map((metric) => ({...empty, label: metric.label, left: metric.left, right: metric.right, leftLabel: metric.leftLabel ?? "", rightLabel: metric.rightLabel ?? ""}))};
        case "timeline":
            return {...base, kind: "timeline", title: spec.title, caption: spec.caption, items: spec.events.map((event) => ({...empty, when: event.when, label: event.title, body: event.body}))};
        case "quiz":
            return {...base, kind: "quiz", title: spec.title, questions: spec.questions};
        case "flipcards":
            return {...base, kind: "flipcards", title: spec.title, items: spec.cards.map((card) => ({...empty, label: card.front, body: card.back}))};
    }
}

function htmlText(html: string) {
    return html
        .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|figcaption)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
        .split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export type EditableArticle = {
    wire: ArticleWire;
    keptMedia: Map<string, BlogMediaBlock>;
    sourceUrls: string[];
};

/**
 * A live post as the writer's JSON, so an edit can revise it in the same shape
 * it generates. Existing photos and videos become "keep:<id>" slots; embeds
 * this pipeline rendered come back as data; any other custom HTML (Content
 * Studio sections) comes back as its text, and the edit rewrites it as native,
 * crawlable sections.
 */
export function toEditable(post: BlogPost): EditableArticle {
    const keptMedia = new Map<string, BlogMediaBlock>([["hero", {type: "image", image: post.featuredImage}]]);
    const blankImage: ImageSlot = {query: "", mustShow: "", alt: ""};
    const keep = (media: BlogMediaBlock | undefined): ImageSlot => {
        if (!media) return blankImage;
        const id = `media-${keptMedia.size}`;
        keptMedia.set(id, media);
        const alt = media.type === "image" ? media.image.alt : media.type === "gallery" ? media.images[0]?.alt ?? "" : media.title ?? "video";
        return {query: `${KEEP_PREFIX}${id}`, mustShow: `existing ${media.type}`, alt};
    };

    let quickAnswer = "";
    const sections: WireSection[] = [];
    post.sections.forEach((section, index) => {
        if (section.html !== undefined) {
            const embed = readEmbedSpec(section.html);
            if (embed && sections.length) {
                sections[sections.length - 1].embed = embedToWire(embed);
                return;
            }
            const lines = htmlText(section.html);
            if (lines.length) sections.push({title: section.title || lines[0], kicker: "", paragraphs: lines, pullQuote: "", links: [], image: blankImage, tableColumns: [], tableRows: [], cards: [], embed: embedToWire(null)});
            return;
        }
        if (index === 0 && section.kicker?.toLowerCase().includes("answer") && section.paragraphs.length) {
            quickAnswer = section.paragraphs.join(" ");
            return;
        }
        sections.push({
            title: section.title,
            kicker: section.kicker ?? "",
            paragraphs: [
                ...section.paragraphs,
                ...(section.subsections ?? []).flatMap((subsection) => [`${subsection.title}:`, ...subsection.paragraphs])
            ],
            pullQuote: section.pullQuote ?? "",
            links: (section.inlineLinks ?? []).map((link) => ({text: link.text, href: link.href ?? (link.kind === "challenge" ? `/comparisons/${link.slug}` : `/animals/${link.slug}`)})),
            image: keep(section.media),
            tableColumns: section.table?.columns ?? [],
            tableRows: section.table?.rows.map((row) => row.cells) ?? [],
            cards: (section.cards ?? []).map((card) => ({label: card.label, body: card.body})),
            embed: embedToWire(null)
        });
    });

    return {
        wire: {
            title: post.title,
            slug: post.slug,
            metaDescription: post.description,
            quickAnswer,
            tags: post.tags,
            searchIntents: post.searchIntents,
            heroImage: {query: `${KEEP_PREFIX}hero`, mustShow: "existing hero photo", alt: post.featuredImage.alt},
            sections,
            faq: post.faq ?? [],
            sources: (post.sources ?? []).map((source) => ({label: source.label, url: source.href})),
            speciesSlugs: post.speciesSlugs
        },
        keptMedia,
        sourceUrls: (post.sources ?? []).map((source) => normalizeUrl(source.href)).filter(Boolean)
    };
}
