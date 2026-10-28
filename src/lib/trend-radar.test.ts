import {test} from "node:test";
import assert from "node:assert/strict";
import {animalMatcher, dedupeCandidates, parseAutocomplete, parseFeed, parseGoogleTrends, parseWikipediaTop, type RadarCandidate} from "./trend-radar/feeds";
import {buildRadarUserPrompt, normalizeRadarIdeas} from "./trend-radar/score";
import {GUIDE_TOPICS, guideMaterials, nextGuideTopic} from "./blog-generator/guide-topics";
import {nextSeoTopic, SEO_TOPICS} from "./blog-generator/seo-topics";

// The trend radar's pure parts: parsing each source, keeping what is about
// animals, holding Claude's ranking to cited sources, and the guide queue's
// reference material (product claims come from our own docs).

const rss = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Jumping spiders &amp; REM sleep]]></title><link>https://phys.org/a</link><pubDate>Tue, 27 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Spiders twitch in their sleep.</p>]]></description></item>
<item><title>New exoplanet found</title><link>https://bbc.co.uk/b</link><pubDate>Tue, 27 Oct 2026 11:00:00 GMT</pubDate><description>Astronomers…</description></item>
</channel></rss>`;

const atom = `<feed><entry><title>Bonobo females hunt</title><link href="https://example.org/c"/><updated>2026-10-27T09:00:00Z</updated><summary>A decade of data.</summary></entry></feed>`;

const trends = `<rss><channel><item><title>shark attack hawaii</title><ht:approx_traffic>20K+</ht:approx_traffic><pubDate>Wed, 28 Oct 2026 05:20:00 -0700</pubDate>
<ht:news_item><ht:news_item_title>Surfer bitten off Maui</ht:news_item_title><ht:news_item_url>https://news.example/maui</ht:news_item_url></ht:news_item></item></channel></rss>`;

test("feeds parse RSS and Atom, decode entities, and Google Trends keeps traffic and news", () => {
    const items = parseFeed(rss, "Phys.org");
    assert.equal(items.length, 2);
    assert.equal(items[0].title, "Jumping spiders & REM sleep");
    assert.equal(items[0].summary, "Spiders twitch in their sleep.");
    assert.equal(items[0].publishedAt, "2026-10-27T10:00:00.000Z");
    assert.equal(parseFeed(atom, "X")[0].url, "https://example.org/c");
    const [trend] = parseGoogleTrends(trends, "Google Trends US");
    assert.equal(trend.weight, "20K+");
    assert.equal(trend.url, "https://news.example/maui");
    assert.match(trend.summary, /Surfer bitten off Maui/);
    assert.deepEqual(parseAutocomplete(["why do cats", ["why do cats purr", "why do cats loaf"], []]), ["why do cats purr", "why do cats loaf"]);
});

test("only animal stories pass; films named after animals do not", () => {
    const isAnimal = animalMatcher(["Honey Badger", "Axolotl", "Peregrine Falcon"]);
    assert.ok(isAnimal("Jumping spiders and REM sleep"));
    assert.ok(isAnimal("Peregrine falcon nests on a skyscraper"));
    assert.ok(isAnimal("Axolotl regrows a heart"));
    assert.ok(!isAnimal("New exoplanet found by JWST"));
    const top = parseWikipediaTop({items: [{articles: [{article: "Main_Page", views: 9}, {article: "Spider-Man:_Brand_New_Day", views: 8}, {article: "The_Dog_Stars_(film)", views: 7}, {article: "Axolotl", views: 6}]}]});
    assert.deepEqual(top.map((entry) => entry.article), ["Axolotl"]);
    assert.equal(dedupeCandidates([{title: "A b"}, {title: "a  B!"}] as RadarCandidate[]).length, 1);
});

const candidates = [{source: "feed", origin: "Phys.org", title: "Jumping spiders", url: "https://phys.org/a", summary: "", publishedAt: null, weight: null}] as RadarCandidate[];

test("radar ideas: news must cite a signal URL, scores are clamped, duplicates dropped", () => {
    const idea = (overrides: Record<string, unknown>) => ({kind: "news", title: "Do Spiders Dream?", angle: "a", hook: "h", primary_keyword: "Do Spiders Dream", format: "news", why_now: "w", score: 8, signals: ["Phys.org"], sources: [{label: "Phys.org", url: "https://phys.org/a"}], ...overrides});
    const ideas = normalizeRadarIdeas({ideas: [
        idea({}),
        idea({title: "Do spiders dream?!"}),
        idea({title: "Made-up story", sources: [{label: "Fake", url: "https://invented.example"}]}),
        idea({kind: "evergreen", title: "Why do cats knead", primary_keyword: "why do cats knead", score: 14, sources: []})
    ]}, candidates);
    assert.deepEqual(ideas.map((entry) => [entry.kind, entry.idea.title, entry.score]), [["news", "Do Spiders Dream?", 8], ["evergreen", "Why do cats knead", 10]]);
    assert.equal(ideas[0].idea.primaryKeyword, "do spiders dream");
    const prompt = buildRadarUserPrompt(candidates, ["Old post"], ["Queued idea"], new Date("2026-10-28T12:00:00Z"), ["100 Strongest Animals in the World"]);
    assert.match(prompt, /NEWS FEEDS[\s\S]*Jumping spiders[\s\S]*OUR CORE PAGES[\s\S]*100 Strongest Animals[\s\S]*RECENT ARTICLES[\s\S]*Old post[\s\S]*OPEN IDEAS[\s\S]*Queued idea/);
});

test("guide and search-led queues go in order; guides carry our own docs as reference", () => {
    assert.equal(nextGuideTopic(new Set())?.id, GUIDE_TOPICS[0].id);
    assert.equal(nextGuideTopic(new Set(GUIDE_TOPICS.map((topic) => topic.id))), null);
    assert.equal(nextSeoTopic(new Set([SEO_TOPICS[0].id]))?.id, SEO_TOPICS[1].id);
    const files = guideMaterials(GUIDE_TOPICS.find((topic) => topic.id === "identify-animal-from-photo")!);
    assert.ok(files.some((file) => file.name === "animaldex-animal-identifier-app.md"));
    const help = files.find((file) => file.name === "animaldex-help-centre.md")!.data.toString("utf8");
    assert.match(help, /How do I scan an animal\?/);
    for (const topic of GUIDE_TOPICS) assert.match(topic.idea.angle, /use ONLY the attached AnimalDex documentation/);
});
