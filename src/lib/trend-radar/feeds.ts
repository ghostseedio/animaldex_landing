// Pure half of the trend radar's sources: parsing what each one returns and
// keeping only what is about animals. No fetch here, so node:test imports it.

export type RadarCandidate = {
    /** feed: a news story; trend: a trending search; wiki: a Wikipedia page spiking; ask: what people type; search: our own rising query. */
    source: "feed" | "trend" | "wiki" | "ask" | "search";
    /** Where it came from: "Mongabay", "Google Trends US", "Wikipedia", … */
    origin: string;
    title: string;
    url: string | null;
    summary: string;
    publishedAt: string | null;
    /** A rough size: trend traffic ("20K+"), wiki views, impressions. */
    weight: string | null;
};

const ENTITIES: Record<string, string> = {amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", "#39": "'", nbsp: " "};

export function decodeXml(text: string) {
    return text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&([a-z#0-9]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(text: string) {
    return decodeXml(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
    return match ? stripTags(match[1]) : "";
}

/** RSS <item>s or Atom <entry>s: title, link, date, summary. */
export function parseFeed(xml: string, origin: string, limit = 40): RadarCandidate[] {
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
    return blocks.slice(0, limit).flatMap((block): RadarCandidate[] => {
        const title = tag(block, "title");
        if (!title) return [];
        const link = tag(block, "link") || block.match(/<link[^>]*href="([^"]+)"/i)?.[1] || null;
        const date = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date");
        const parsed = date ? Date.parse(date) : NaN;
        return [{
            source: "feed",
            origin,
            title,
            url: link,
            summary: (tag(block, "description") || tag(block, "summary") || tag(block, "content")).slice(0, 280),
            publishedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null,
            weight: null
        }];
    });
}

/** Google's daily trending-searches RSS: the search, its rough volume and the news behind it. */
export function parseGoogleTrends(xml: string, origin: string): RadarCandidate[] {
    return (xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []).flatMap((block): RadarCandidate[] => {
        const title = tag(block, "title");
        if (!title) return [];
        const news = (block.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/gi) ?? []).map((item) => stripTags(item.replace(/<\/?ht:news_item_title>/gi, ""))).slice(0, 3);
        const url = block.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/i)?.[1]?.trim() ?? null;
        const date = tag(block, "pubDate");
        return [{
            source: "trend",
            origin,
            title,
            url: url ? decodeXml(url) : null,
            summary: news.join(" | "),
            publishedAt: date && Number.isFinite(Date.parse(date)) ? new Date(Date.parse(date)).toISOString() : null,
            weight: tag(block, "ht:approx_traffic") || null
        }];
    });
}

/** Wikimedia's top-viewed list for a day: [{article, views}]. */
/** Wikipedia titles that name an animal but are about something else (films, people, teams…). */
const NOT_AN_ANIMAL = /\((film|\d{4} film|tv series|miniseries|album|song|band|video game|novel|book|comics|musician|rapper|singer|actor|actress|footballer|wrestler|character|franchise)\)|spider-man|batman|catwoman|wolverine \(|^the_|_vs\._/i;

export function parseWikipediaTop(body: any): Array<{article: string; views: number}> {
    const articles: any[] = body?.items?.[0]?.articles ?? [];
    return articles
        .filter((entry) => typeof entry?.article === "string" && !/^(Main_Page|Special:|Wikipedia:|Portal:|File:|Help:|Talk:)/.test(entry.article) && !NOT_AN_ANIMAL.test(entry.article))
        .map((entry) => ({article: entry.article as string, views: Number(entry.views) || 0}));
}

/** Google autocomplete (client=firefox): ["query", ["suggestion", …]]. */
export function parseAutocomplete(body: unknown): string[] {
    return Array.isArray(body) && Array.isArray(body[1]) ? (body[1] as unknown[]).filter((item): item is string => typeof item === "string") : [];
}

/** Words that make a story about animals even when it names no species we know. */
const ANIMAL_WORDS = [
    "animal", "animals", "wildlife", "species", "zoo", "predator", "prey", "mammal", "bird", "birds", "fish", "reptile", "amphibian", "insect", "insects",
    "shark", "sharks", "whale", "whales", "dolphin", "orca", "seal", "bear", "bears", "wolf", "wolves", "lion", "tiger", "leopard", "jaguar", "cheetah",
    "elephant", "rhino", "hippo", "gorilla", "chimp", "monkey", "ape", "orangutan", "snake", "python", "cobra", "crocodile", "alligator", "lizard",
    "frog", "turtle", "tortoise", "spider", "bee", "bees", "ant", "ants", "butterfly", "moth", "beetle", "coral", "octopus", "squid", "jellyfish",
    "eagle", "owl", "hawk", "penguin", "parrot", "crow", "raven", "deer", "moose", "bison", "horse", "dog", "dogs", "cat", "cats", "rat", "bat", "bats",
    "dinosaur", "fossil", "extinct", "extinction", "endangered", "poaching", "migration", "hatchling", "cub", "cubs", "pup", "pups", "venom", "venomous"
];

export function animalMatcher(speciesNames: string[]) {
    const words = new Set(ANIMAL_WORDS);
    const names = speciesNames.map((name) => name.toLowerCase()).filter((name) => name.length >= 4);
    const multi = names.filter((name) => name.includes(" "));
    const single = new Set(names.filter((name) => !name.includes(" ")));
    return (text: string) => {
        const lower = ` ${text.toLowerCase().replace(/[_\-–—]/g, " ").replace(/[^a-z0-9 ]/g, " ")} `;
        const tokens = lower.split(/\s+/).filter(Boolean);
        // "spiders" → "spider", "foxes" → "fox".
        const forms = (token: string) => [token, token.replace(/s$/, ""), token.replace(/es$/, "")];
        if (tokens.some((token) => forms(token).some((form) => words.has(form) || single.has(form)))) return true;
        return multi.some((name) => lower.includes(` ${name} `));
    };
}

/** A candidate per day: drop exact repeats of the same title. */
export function dedupeCandidates(candidates: RadarCandidate[]) {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
        const key = candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
