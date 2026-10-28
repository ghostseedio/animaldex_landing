import type {TopicIdea} from "@/lib/blog-generator/pipeline";
import type {RadarCandidate} from "@/lib/trend-radar/feeds";

// The radar's editor, pure half: the prompt that turns raw signals into ranked
// article ideas, the schema, and the check that holds the reply to them (every
// news idea must cite a URL that was actually in the signals).

export const MAX_IDEAS = 10;

export const RADAR_SYSTEM_PROMPT = `You are the news and trends editor of AnimalDex: an app and website about animals (identify any animal from a photo, collect it, battle it, and talk to it with an AI that answers as the species), with animal pages, rankings, comparisons and a blog that wants viral, searchable, TRUE articles.

From the signals below, pick up to ${MAX_IDEAS} article ideas worth writing NOW, best first. Two kinds:
- "news": a fresh animal story from the last 72 hours (a discovery, study, attack, rescue, record, outbreak, sighting, policy) that people will search and share this week. Cite at least one of the signal URLs it comes from.
- "evergreen": steady search demand you can see in the signals (Google autocomplete questions, our rising Search Console queries, an animal spiking on Wikipedia): a question people keep asking that a great article can own for months. primary_keyword is the exact phrase people type.

Score 1–10: how many people will search for and share it in the next week × how fresh it is × how well an animal site can own it. 9–10 only for a story that is clearly blowing up (in Google Trends or Wikipedia's top pages AND the news). Animals and nature only: drop celebrity, sport, politics and product trends unless the story is genuinely about an animal. Never repeat or near-repeat an idea in OUR CORE PAGES, RECENT ARTICLES or OPEN IDEAS. Merge the same story across sources into one idea and list every source that carried it. Never invent a story, a number or a source.

For each idea:
- title: max 60 characters, curiosity-driven but true.
- angle: the specific story or answer and what makes our take different (2–3 sentences).
- hook: the single most surprising true fact or question.
- primary_keyword: the search phrase it targets.
- format: news | explainer | listicle | guide | myth-buster | comparison.
- why_now: the signal that makes it timely (e.g. "Mongabay + Guardian today, 50K+ US searches").
- score: 1–10 as above.
- signals: the signal origins that point at it (e.g. "Mongabay", "Google Trends US", "Wikipedia", "Google autocomplete", "Search Console").
- sources: [{label, url}] from the signal URLs only (empty for evergreen ideas without one).

Return only the JSON object.`;

export const RADAR_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["ideas"],
    properties: {
        ideas: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["kind", "title", "angle", "hook", "primary_keyword", "format", "why_now", "score", "signals", "sources"],
                properties: {
                    kind: {type: "string", enum: ["news", "evergreen"]},
                    title: {type: "string"},
                    angle: {type: "string"},
                    hook: {type: "string"},
                    primary_keyword: {type: "string"},
                    format: {type: "string"},
                    why_now: {type: "string"},
                    score: {type: "number"},
                    signals: {type: "array", items: {type: "string"}},
                    sources: {
                        type: "array",
                        items: {type: "object", additionalProperties: false, required: ["label", "url"], properties: {label: {type: "string"}, url: {type: "string"}}}
                    }
                }
            }
        }
    }
} as const;

function line(candidate: RadarCandidate) {
    const date = candidate.publishedAt ? ` (${candidate.publishedAt.slice(0, 16).replace("T", " ")} UTC)` : "";
    const weight = candidate.weight ? ` [${candidate.weight}]` : "";
    const summary = candidate.summary ? ` — ${candidate.summary.slice(0, 200)}` : "";
    const url = candidate.url ? ` <${candidate.url}>` : "";
    return `- [${candidate.origin}]${weight} ${candidate.title}${date}${summary}${url}`;
}

export function buildRadarUserPrompt(candidates: RadarCandidate[], recentTitles: string[], openTitles: string[], now = new Date(), corePages: string[] = []) {
    const group = (source: RadarCandidate["source"], heading: string, max: number) => {
        const items = candidates.filter((candidate) => candidate.source === source).slice(0, max);
        return items.length ? [`${heading}:`, ...items.map(line), ""] : [];
    };
    return [
        `Now: ${now.toISOString().slice(0, 16).replace("T", " ")} UTC.`,
        "",
        ...group("feed", "NEWS FEEDS (last 72 hours)", 90),
        ...group("trend", "GOOGLE TRENDING SEARCHES (animal-related, today)", 30),
        ...group("wiki", "WIKIPEDIA TOP 1,000 YESTERDAY (animal pages)", 25),
        ...group("search", "OUR RISING SEARCH CONSOLE QUERIES (last 7 days vs the 7 before)", 30),
        ...group("ask", "GOOGLE AUTOCOMPLETE (what people type)", 120),
        ...(corePages.length ? ["OUR CORE PAGES (already rank for these; never propose an article that duplicates one):", ...corePages.map((title) => `- ${title}`), ""] : []),
        "RECENT ARTICLES (do not repeat):",
        ...recentTitles.slice(0, 80).map((title) => `- ${title}`),
        "",
        "OPEN IDEAS (already queued, do not repeat):",
        ...(openTitles.length ? openTitles.map((title) => `- ${title}`) : ["- (none)"])
    ].join("\n");
}

export type ScoredIdea = {kind: "news" | "evergreen"; score: number; signals: string[]; idea: TopicIdea};

function text(value: unknown, max: number) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Holds the reply to the format: known URLs only, news must cite one, scores clamped, titles unique. */
export function normalizeRadarIdeas(value: unknown, candidates: RadarCandidate[]): ScoredIdea[] {
    const knownUrls = new Set(candidates.map((candidate) => candidate.url).filter((url): url is string => Boolean(url)));
    const ideas = Array.isArray((value as {ideas?: unknown})?.ideas) ? (value as {ideas: unknown[]}).ideas : [];
    const seen = new Set<string>();
    return ideas.slice(0, MAX_IDEAS).flatMap((entry): ScoredIdea[] => {
        const idea = entry as Record<string, unknown>;
        const kind = idea.kind === "news" ? "news" : idea.kind === "evergreen" ? "evergreen" : null;
        const title = text(idea.title, 90);
        const keyword = text(idea.primary_keyword, 120).toLowerCase();
        if (!kind || !title || !keyword) return [];
        const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seen.has(key)) return [];
        seen.add(key);
        const sources = (Array.isArray(idea.sources) ? idea.sources : [])
            .map((source) => source as Record<string, unknown>)
            .filter((source) => typeof source.url === "string" && knownUrls.has(source.url))
            .map((source) => ({label: text(source.label, 160) || "Source", url: source.url as string}))
            .slice(0, 6);
        if (kind === "news" && !sources.length) return [];
        const score = Math.min(Math.max(Number(idea.score) || 0, 1), 10);
        return [{
            kind,
            score: Math.round(score * 10) / 10,
            signals: (Array.isArray(idea.signals) ? idea.signals : []).filter((signal): signal is string => typeof signal === "string").map((signal) => signal.slice(0, 60)).slice(0, 8),
            idea: {
                title,
                angle: text(idea.angle, 900),
                hook: text(idea.hook, 300),
                primaryKeyword: keyword,
                format: text(idea.format, 30) || (kind === "news" ? "news" : "explainer"),
                whyNow: text(idea.why_now, 300),
                sources
            }
        }];
    });
}
