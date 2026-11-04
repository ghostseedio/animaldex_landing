import type {TopicIdea} from "@/lib/blog-generator/pipeline";
import {CONTENT_POLICY_RULES, policyProblems} from "@/lib/content-policy";
import type {RadarCandidate} from "@/lib/trend-radar/feeds";

// The radar's editor, pure half: the prompt that turns raw signals into ranked
// article ideas, the schema, and the check that holds the reply to them (every
// news idea must cite a URL that was actually in the signals, and nothing
// breaks the content policy). Since Nov 2026 the radar looks for culture,
// ideas and everyday-life trends that one animal's real behaviour reframes;
// nature news is a low-priority lane the blog does not write by itself.

export const MAX_IDEAS = 10;

/** A nature news idea never scores above this: the blog has no news lane, so news only waits for a person to pick it. */
export const NATURE_NEWS_MAX_SCORE = 5;

export const RADAR_SYSTEM_PROMPT = `You are the trends editor of AnimalDex: an app and website where you take any idea, plan or decision to an animal, and the animal answers from a real behaviour of its species instead of the usual answer ("Every animal has a lesson."). The blog writes ideas seen through animals and "lesson for a human" pieces; the social accounts post "the usual answer vs the lion's take" and "5 animals, 1 idea".

From the signals below, pick up to ${MAX_IDEAS} article ideas worth writing, best first. Two kinds:
- "evergreen" (nearly all ideas): a culture, idea or everyday-life trend people are searching or talking about (resolutions and seasons, a work or money habit everyone is trying, a big decision people are weighing, a question people keep typing), seen through ONE real animal behaviour that reframes it: the animal's take is the article. Or a searched animal question that becomes a lesson for a human ("why do lions roar": the roar is an honest count). primary_keyword is the exact phrase people type. It must still read well in a month.
- "news" (low priority, at most 2): a fresh animal or nature story from the last 72 hours that people will search this week. Cite at least one of the signal URLs. Score news ${NATURE_NEWS_MAX_SCORE} or lower: we rarely write it.

Score 1–10: how many people search or talk about it × how well one animal's real behaviour reframes it × how shareable the take is. 9–10 only for a trend that is clearly big right now (Google Trends AND autocomplete or Search Console) with a take nobody else has. Most trending searches are news, names and sport: use one only when an everyday idea inside it is what people discuss, never the event or the person. No politics, no tragedies. Never repeat or near-repeat an idea in OUR CORE PAGES, RECENT ARTICLES or OPEN IDEAS. Merge the same trend across sources into one idea and list every source that carried it. Never invent a trend, a number, a source or an animal behaviour.

${CONTENT_POLICY_RULES}

For each idea:
- title: max 60 characters, curiosity-driven but true.
- angle: the trend or question, the one real animal behaviour that reframes it, and the take (2–3 sentences).
- hook: the single most surprising true fact or question.
- primary_keyword: the search phrase it targets.
- format: explainer | listicle | guide | myth-buster | comparison | news.
- why_now: the signal that makes it timely (e.g. "autocomplete 'should i quit my job', Search Console rising").
- score: 1–10 as above.
- signals: the signal origins that point at it (e.g. "Google autocomplete", "Search Console", "Google Trends US", "Wikipedia", "Mongabay").
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
        ...group("ask", "GOOGLE AUTOCOMPLETE (what people type: ideas, decisions, everyday questions)", 120),
        ...group("search", "OUR RISING SEARCH CONSOLE QUERIES (last 7 days vs the 7 before)", 30),
        ...group("trend", "GOOGLE TRENDING SEARCHES (today; mostly news and names)", 50),
        ...group("wiki", "WIKIPEDIA TOP 1,000 YESTERDAY (animal pages)", 25),
        ...group("feed", "NATURE NEWS FEEDS (last 72 hours; low priority)", 40),
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
        // Another AI product, a clinical word or a label anywhere in the idea: never queued.
        if (policyProblems(title, keyword, text(idea.angle, 900), text(idea.hook, 300)).length) return [];
        const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seen.has(key)) return [];
        seen.add(key);
        const sources = (Array.isArray(idea.sources) ? idea.sources : [])
            .map((source) => source as Record<string, unknown>)
            .filter((source) => typeof source.url === "string" && knownUrls.has(source.url))
            .map((source) => ({label: text(source.label, 160) || "Source", url: source.url as string}))
            .slice(0, 6);
        if (kind === "news" && !sources.length) return [];
        const score = Math.min(Math.max(Number(idea.score) || 0, 1), kind === "news" ? NATURE_NEWS_MAX_SCORE : 10);
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
