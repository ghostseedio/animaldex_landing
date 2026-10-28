import "server-only";
import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {loadRisingQueries} from "@/app/api/admin/growth/_lib/search-console";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";
import {animalMatcher, dedupeCandidates, parseAutocomplete, parseFeed, parseGoogleTrends, parseWikipediaTop, type RadarCandidate} from "@/lib/trend-radar/feeds";

// Where the trend radar looks. Each source is best-effort: one failing (a feed
// down, a rate limit) is noted and the rest still count.
//   news       science and wildlife feeds (what just happened)
//   trend      Google's daily trending searches in our biggest countries (what people search today)
//   wiki       Wikipedia's 1,000 most-viewed pages yesterday that are animals (what people read about)
//   ask        Google autocomplete for animal questions (what people keep asking)
//   search     queries our own pages are gaining impressions on (Search Console)

const USER_AGENT = "AnimalDexTrendRadar/1.0 (+https://animaldex.app)";

export const NEWS_FEEDS = [
    {origin: "ScienceDaily", url: "https://www.sciencedaily.com/rss/plants_animals/animals.xml"},
    {origin: "Phys.org", url: "https://phys.org/rss-feed/biology-news/plants-animals/"},
    {origin: "Mongabay", url: "https://news.mongabay.com/feed/"},
    {origin: "Guardian Wildlife", url: "https://www.theguardian.com/environment/wildlife/rss"},
    {origin: "BBC Science & Environment", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"},
    {origin: "Live Science", url: "https://www.livescience.com/feeds.xml"},
    {origin: "IUCN", url: "https://iucn.org/rss.xml"}
];

const TREND_GEOS = ["US", "GB", "IN", "AU", "CA"];

/** What people type: question starters around animals and the talk-to-animals feature. */
export const AUTOCOMPLETE_SEEDS = [
    "why do dogs", "why do cats", "what does it mean when a cat", "what does it mean when a dog",
    "can animals", "do animals", "which animal", "what animal", "how to talk to",
    "animal that can", "strongest animal", "smartest animal", "most dangerous animal", "animal translator"
];

/** Freshness window for news items. */
const NEWS_MAX_AGE_MS = 72 * 3_600_000;

async function get(url: string, accept = "*/*") {
    const response = await fetch(url, {headers: {"User-Agent": USER_AGENT, Accept: accept}, cache: "no-store", signal: AbortSignal.timeout(20_000)});
    if (!response.ok) throw new Error(`${response.status}`);
    return response;
}

let namesCache: string[] | null = null;
function speciesNames() {
    namesCache ??= publishedSeoSlugs.animals.map((slug) => getPublishedSpeciesForContent(slug)?.name ?? "").filter(Boolean);
    return namesCache;
}

export type CollectResult = {candidates: RadarCandidate[]; notes: Record<string, string>};

export async function collectCandidates(): Promise<CollectResult> {
    const notes: Record<string, string> = {};
    const isAnimal = animalMatcher(speciesNames());
    const now = Date.now();
    const out: RadarCandidate[] = [];

    await Promise.all(NEWS_FEEDS.map(async (feed) => {
        try {
            const items = parseFeed(await (await get(feed.url, "application/rss+xml, application/xml")).text(), feed.origin)
                .filter((item) => !item.publishedAt || now - Date.parse(item.publishedAt) <= NEWS_MAX_AGE_MS)
                // Mixed feeds (BBC, Live Science) carry space and physics too.
                .filter((item) => isAnimal(`${item.title} ${item.summary}`));
            out.push(...items);
            notes[feed.origin] = `${items.length} animal stories`;
        } catch (error) {
            notes[feed.origin] = `failed (${error instanceof Error ? error.message : error})`;
        }
    }));

    await Promise.all(TREND_GEOS.map(async (geo) => {
        try {
            const items = parseGoogleTrends(await (await get(`https://trends.google.com/trending/rss?geo=${geo}`, "application/rss+xml")).text(), `Google Trends ${geo}`)
                .filter((item) => isAnimal(`${item.title} ${item.summary}`));
            out.push(...items);
            notes[`Google Trends ${geo}`] = `${items.length} animal trends`;
        } catch (error) {
            notes[`Google Trends ${geo}`] = `failed (${error instanceof Error ? error.message : error})`;
        }
    }));

    try {
        // Yesterday's list can lag; fall back a day.
        let top: Array<{article: string; views: number}> = [];
        for (const back of [1, 2]) {
            const day = new Date(now - back * 86_400_000);
            const path = `${day.getUTCFullYear()}/${String(day.getUTCMonth() + 1).padStart(2, "0")}/${String(day.getUTCDate()).padStart(2, "0")}`;
            try {
                top = parseWikipediaTop(await (await get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${path}`, "application/json")).json());
                if (top.length) break;
            } catch {
                // Try the day before.
            }
        }
        const animals = top.filter((entry) => isAnimal(entry.article)).slice(0, 25);
        out.push(...animals.map((entry): RadarCandidate => ({
            source: "wiki",
            origin: "Wikipedia",
            title: entry.article.replace(/_/g, " "),
            url: `https://en.wikipedia.org/wiki/${entry.article}`,
            summary: `${entry.views.toLocaleString("en")} views yesterday (top 1,000 on English Wikipedia)`,
            publishedAt: null,
            weight: String(entry.views)
        })));
        notes.Wikipedia = `${animals.length} animal pages in the top 1,000`;
    } catch (error) {
        notes.Wikipedia = `failed (${error instanceof Error ? error.message : error})`;
    }

    const asked: string[] = [];
    await Promise.all(AUTOCOMPLETE_SEEDS.map(async (seed) => {
        try {
            asked.push(...parseAutocomplete(await (await get(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`, "application/json")).json()));
        } catch {
            // One seed missing is fine.
        }
    }));
    out.push(...Array.from(new Set(asked)).slice(0, 120).map((query): RadarCandidate => ({source: "ask", origin: "Google autocomplete", title: query, url: null, summary: "", publishedAt: null, weight: null})));
    notes["Google autocomplete"] = `${asked.length} suggestions`;

    try {
        const rising = await loadRisingQueries();
        out.push(...rising.map((row): RadarCandidate => ({
            source: "search",
            origin: "Search Console",
            title: row.query,
            url: null,
            summary: `${row.impressions} impressions last week (was ${row.previous}), position ${row.position}, ${row.clicks} clicks`,
            publishedAt: null,
            weight: String(row.impressions)
        })));
        notes["Search Console"] = rising.length ? `${rising.length} rising queries` : "not connected or nothing rising";
    } catch (error) {
        notes["Search Console"] = `failed (${error instanceof Error ? error.message : error})`;
    }

    return {candidates: dedupeCandidates(out), notes};
}
