import assert from "node:assert/strict";
import test from "node:test";
import {deflateRawSync} from "node:zlib";
import {CostMeter, recordUsage, withCostMeter} from "@/lib/blog-generator/cost-meter";
import {extractDocxText} from "@/lib/blog-generator/docx-text";
import {materialBatchProblem} from "@/lib/blog-generator/material-types";
import {assembleBlogPost, fromWire, isNewImageSlot, normalizeUrl, toEditable, sectionImageKey, slugify, uniqueSlug, type ArticleSection, type ArticleSpec} from "@/lib/blog-generator/article-spec";
import {embedProblem, readEmbedSpec, renderEmbed} from "@/lib/blog-generator/embeds";
import type {BlogPost} from "@/data/blog/types";

const words = (count: number) => Array.from({length: count}, (_, index) => `word${index}`).join(" ");

function section(overrides: Partial<ArticleSection> = {}): ArticleSection {
    return {title: "How fast is a cheetah?", kicker: "", paragraphs: [`The cheetah is quick. ${words(120)}`], pullQuote: "", links: [], image: null, table: null, cards: [], embed: null, ...overrides};
}

function spec(overrides: Partial<ArticleSpec> = {}): ArticleSpec {
    return {
        title: "Cheetah speed: how fast can it really run?",
        slug: "cheetah-speed",
        metaDescription: "The real top speed of a cheetah.",
        quickAnswer: "About 100 km/h in short bursts.",
        tags: ["cheetah"],
        searchIntents: ["how fast is a cheetah"],
        heroImage: {query: "cheetah", mustShow: "a cheetah", alt: "A cheetah running"},
        sections: Array.from({length: 8}, (_, index) => section({title: `Section ${index}`})),
        faq: [],
        sources: [{label: "A: one", url: "https://example.org/a"}, {label: "B: two", url: "https://example.org/b?utm_source=x"}],
        speciesSlugs: ["cheetah", "made-up-animal"],
        ...overrides
    };
}

const hero = {src: "https://cdn.example/hero.webp", alt: "A cheetah", width: 1400, height: 933};

function context(overrides: Partial<Parameters<typeof assembleBlogPost>[1]> = {}): Parameters<typeof assembleBlogPost>[1] {
    return {
        slug: "cheetah-speed",
        images: new Map([["hero", hero]]),
        knownHrefs: new Set(["/animals/cheetah", "/tier-list/fastest-animals"]),
        knownSpecies: new Set(["cheetah"]),
        researchedUrls: new Set(["https://example.org/a", "https://example.org/b"]),
        reachableUrls: new Set(["https://example.org/a", "https://example.org/b"]),
        today: "2026-10-10",
        ...overrides
    };
}

test("a clean spec assembles into a publishable post", () => {
    const result = assembleBlogPost(spec(), context());
    assert.deepEqual(result.problems, []);
    assert.equal(result.post.featuredImage.src, hero.src);
    assert.equal(result.post.sections[0].kicker, "Quick answer");
    assert.deepEqual(result.post.speciesSlugs, ["cheetah"]);
    assert.equal(result.post.sources?.length, 2);
});

test("sources research never opened, or that no longer load, are dropped and can block publishing", () => {
    const result = assembleBlogPost(spec(), context({researchedUrls: new Set(["https://example.org/a"])}));
    assert.equal(result.post.sources?.length, 1);
    assert.ok(result.problems.some((problem) => problem.includes("verifiable source")));
});

test("internal links must point at a known page and appear in the section text", () => {
    const result = assembleBlogPost(spec({
        sections: [
            section({links: [
                {text: "cheetah", href: "/animals/cheetah"},
                {text: "cheetah", href: "/animals/not-a-page"},
                {text: "fastest animals", href: "https://animaldex.app/tier-list/fastest-animals"}
            ]}),
            section({title: "Rankings", paragraphs: [`See the fastest animals ranked. ${words(50)}`], links: [{text: "fastest animals", href: "https://animaldex.app/tier-list/fastest-animals"}]}),
            ...Array.from({length: 6}, (_, index) => section({title: `More ${index}`}))
        ]
    }), context());
    // The species link moves to speciesSlugs (the page links species names itself).
    assert.equal(result.post.sections[1].inlineLinks, undefined);
    assert.ok(result.post.speciesSlugs.includes("cheetah"));
    assert.equal(result.warnings.length, 2);
    assert.deepEqual(result.post.sections[2].inlineLinks?.map((link) => link.href), ["/tier-list/fastest-animals"]);
});

test("product claims the app cannot make block publishing", () => {
    for (const paragraph of [
        "Capture animals and earn real money every week.",
        "Credits can be converted to cash.",
        "Creator Rewards pays you for every capture."
    ]) {
        const result = assembleBlogPost(spec({sections: [section({paragraphs: [paragraph, words(1000)]})]}), context());
        assert.ok(result.problems.some((problem) => problem.startsWith("product claim")), paragraph);
    }
    const ok = assembleBlogPost(spec({sections: [section({paragraphs: ["Creator Rewards is currently paused.", words(1000)]})]}), context());
    assert.ok(!ok.problems.some((problem) => problem.startsWith("product claim")));
});

test("short articles and missing hero photos are blocked", () => {
    const result = assembleBlogPost(spec({sections: [section()]}), context({images: new Map()}));
    assert.ok(result.problems.some((problem) => problem.includes("words")));
    assert.ok(result.problems.some((problem) => problem.includes("hero")));
});

test("section photos and valid embeds land beside their section; invalid embeds are left out", () => {
    const image = {src: "https://cdn.example/s1.webp", alt: "x", width: 10, height: 10};
    const result = assembleBlogPost(spec({
        sections: [
            section({embed: {kind: "bar", title: "Top speeds", unit: "km/h", caption: "", bars: [{label: "Cheetah", value: 100, highlight: true, note: ""}, {label: "Pronghorn", value: 88, highlight: false, note: ""}, {label: "Lion", value: 80, highlight: false, note: ""}]}}),
            section({title: "Second", embed: {kind: "quiz", title: "Quiz", questions: []}}),
            ...Array.from({length: 6}, (_, index) => section({title: `S${index}`}))
        ]
    }), context({images: new Map([["hero", hero], [sectionImageKey(0), image]])}));
    const titles = result.post.sections.map((entry) => entry.title);
    assert.equal(titles[1], "How fast is a cheetah?");
    assert.equal(result.post.sections[1].media?.type, "image");
    assert.ok(result.post.sections[2].html?.includes("Top speeds"));
    assert.equal(result.post.sections[3].title, "Second");
    assert.equal(result.post.sections[4].html, undefined);
    assert.ok(!result.post.tableOfContents?.some((title) => title.startsWith("bar:")));
});

test("embeds escape model text so it cannot inject markup or script", () => {
    const html = renderEmbed({kind: "flipcards", title: "<script>alert(1)</script>", cards: [{front: "<img src=x onerror=alert(1)>", back: "a"}, {front: "b", back: "c"}, {front: "d", back: "e"}]});
    assert.ok(!html.includes("<script>alert"));
    assert.ok(!html.includes("<img src=x"));
    assert.ok(html.includes("&lt;script&gt;"));
});

test("embed validation rejects thin data", () => {
    assert.equal(embedProblem({kind: "bar", title: "", unit: "", caption: "", bars: [{label: "a", value: 1}]}), "bar chart needs at least 3 numeric bars");
    assert.equal(embedProblem({kind: "quiz", title: "", questions: [{question: "q", options: ["a", "b"], answer: 5, explanation: ""}]}), "quiz needs at least 3 valid questions");
    assert.equal(embedProblem({kind: "timeline", title: "", caption: "", events: [1, 2, 3].map((n) => ({when: `${n}`, title: "t", body: "b"}))}), null);
});

test("slugs are clean and never collide with an existing post", () => {
    assert.equal(slugify("Why Octopuses Are Basically Aliens — Explained!"), "why-octopuses-are-basically-aliens-explained");
    assert.equal(uniqueSlug("cheetah speed", new Set(["cheetah-speed", "cheetah-speed-2"])), "cheetah-speed-3");
    assert.ok(slugify("a ".repeat(100)).length <= 80);
});

test("source URLs are normalised before comparison", () => {
    assert.equal(normalizeUrl("https://example.org/b/?utm_source=x#top"), "https://example.org/b");
    assert.equal(normalizeUrl("not a url"), "");
});

test("the writer's flat JSON maps onto embeds, tables and optional photos, tolerating gaps", () => {
    const parsed = fromWire({
        title: "T",
        sections: [
            {
                title: "A", paragraphs: ["p"], image: {query: "", mustShow: "", alt: ""},
                tableColumns: ["Animal", "Speed"], tableRows: [["Cheetah", "100"]],
                embed: {kind: "bar", title: "Speeds", unit: "km/h", items: [{label: "Cheetah", value: "100", highlight: true}]}
            },
            {title: "B", paragraphs: ["p"], image: {query: "lion", mustShow: "a lion", alt: "Lion"}, embed: {kind: "flipcards", items: [{label: "Myth", body: "Truth"}]}},
            {title: "C", paragraphs: ["p"], embed: {kind: "none"}},
            {title: "", paragraphs: []}
        ],
        sources: [{label: "x", url: ""}]
    });
    assert.equal(parsed.sections.length, 3);
    assert.equal(parsed.sections[0].image, null);
    assert.deepEqual(parsed.sections[0].table, {columns: ["Animal", "Speed"], rows: [["Cheetah", "100"]]});
    assert.deepEqual(parsed.sections[0].embed, {kind: "bar", title: "Speeds", caption: "", unit: "km/h", bars: [{label: "Cheetah", value: 100, highlight: true, note: ""}]});
    assert.equal(parsed.sections[1].image?.query, "lion");
    assert.deepEqual(parsed.sections[1].embed, {kind: "flipcards", title: "", cards: [{front: "Myth", back: "Truth"}]});
    assert.equal(parsed.sections[2].embed, null);
    assert.deepEqual(parsed.sources, []);
    assert.deepEqual(parsed.tags, []);
});

/** A minimal ZIP with one entry, stored (0) or deflated (8), the way Word writes them. */
function zipWith(name: string, content: string, method: 0 | 8) {
    const raw = Buffer.from(content, "utf8");
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(0, 42);
    const centralOffset = local.length + nameBytes.length + data.length;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + nameBytes.length, 12);
    end.writeUInt32LE(centralOffset, 16);
    return Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
}

const DOCUMENT_XML = `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Axolotls &amp; regeneration</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">They regrow </w:t></w:r><w:r><w:t>limbs.</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>New line</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Lifespan</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10&#8211;15 years</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;

test("Word documents are read as plain text, stored or deflated", () => {
    for (const method of [0, 8] as const) {
        const text = extractDocxText(zipWith("word/document.xml", DOCUMENT_XML, method));
        assert.ok(text.startsWith("Axolotls & regeneration\nThey regrow limbs.\nNew line"), text);
        assert.ok(text.includes("Lifespan"));
        assert.ok(text.includes("10–15 years"));
    }
    assert.throws(() => extractDocxText(zipWith("word/other.xml", DOCUMENT_XML, 0)), /document\.xml/);
    assert.throws(() => extractDocxText(Buffer.from("not a zip at all, just text")), /ZIP/);
});

test("reference uploads are limited by type, size and count", () => {
    assert.equal(materialBatchProblem([{name: "study.pdf", size: 1000}, {name: "notes.DOCX", size: 10}, {name: "chart.png", size: 10}]), null);
    assert.match(materialBatchProblem([{name: "slides.pptx", size: 10}]) ?? "", /unsupported/);
    assert.match(materialBatchProblem([{name: "big.pdf", size: 16 * 1048576}]) ?? "", /over 15 MB/);
    assert.match(materialBatchProblem([{name: "a.pdf", size: 12 * 1048576}, {name: "b.pdf", size: 12 * 1048576}]) ?? "", /limit is 20 MB/);
    assert.match(materialBatchProblem(Array.from({length: 13}, (_, index) => ({name: `${index}.txt`, size: 1}))) ?? "", /at most 12/);
});

test("the cost meter prices each stage at Opus 5.5 list rates and keeps runs apart", async () => {
    const first = new CostMeter();
    const second = new CostMeter();
    await Promise.all([
        withCostMeter(first, async () => {
            recordUsage("Research", {input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 200_000, server_tool_use: {web_search_requests: 10, web_fetch_requests: 3}});
            await new Promise((resolve) => setTimeout(resolve, 5));
            recordUsage("Writing", {input_tokens: 0, output_tokens: 50_000});
        }),
        withCostMeter(second, async () => recordUsage("Writing", {input_tokens: 500_000, output_tokens: 0}))
    ]);
    const report = first.report();
    // 4 + 2 (output) + 0.2 (cache read) + 1 (cache write) + 0.1 (searches) = 7.3; writing 1.0
    assert.equal(report.stages.Research.usd, 7.3);
    assert.equal(report.stages.Research.webFetches, 3);
    assert.equal(report.stages.Writing.usd, 1);
    assert.equal(report.totalUsd, 8.3);
    assert.equal(second.report().totalUsd, 2);
    recordUsage("Ignored", {input_tokens: 1});
});

test("a live post survives the round trip into the writer's JSON and back", () => {
    const bar = {kind: "bar" as const, title: "Top speeds", unit: "km/h", caption: "c", bars: [{label: "Cheetah", value: 100, highlight: true, note: ""}, {label: "Lion", value: 80, highlight: false, note: ""}, {label: "Pronghorn", value: 88, highlight: false, note: ""}]};
    assert.deepEqual(readEmbedSpec(renderEmbed(bar)), bar);
    assert.equal(readEmbedSpec("<div>not ours</div>"), null);

    const video = {type: "video" as const, embedUrl: "https://www.youtube.com/embed/x", watchUrl: "https://youtu.be/x", title: "Clip"};
    const live: BlogPost = {
        slug: "cheetah-speed", title: "Cheetah speed", description: "d", publishedAt: "2025-01-02", updatedAt: "2025-01-02", author: "Someone",
        readingMinutes: 5, tags: ["cheetah"], searchIntents: ["cheetah speed"], speciesSlugs: ["cheetah"],
        featuredImage: hero,
        sections: [
            {kicker: "Quick answer", title: "The short answer", paragraphs: ["About 100 km/h."]},
            {title: "How fast?", paragraphs: [`Fast. ${words(1000)}`], media: {type: "image", image: {src: "/images/blog/a.webp", alt: "a", width: 10, height: 10}}},
            {title: "bar: Top speeds", paragraphs: [], html: renderEmbed(bar)},
            {title: "Watch", paragraphs: ["A clip."], media: video},
            {title: "Studio section", paragraphs: [], html: "<style>p{}</style><section><h2>Old studio copy</h2><p>Cheetahs &amp; gazelles.</p></section>"}
        ],
        sources: [{label: "A", href: "https://example.org/a"}, {label: "B", href: "https://example.org/b"}]
    };

    const editable = toEditable(live);
    assert.equal(editable.wire.quickAnswer, "About 100 km/h.");
    // The chart rides on the section before it, so three sections remain.
    assert.equal(editable.wire.sections.length, 3);
    assert.equal(editable.wire.sections[0].embed.kind, "bar");
    assert.deepEqual(editable.wire.sections[2].paragraphs, ["Old studio copy", "Cheetahs & gazelles."]);
    assert.ok(!isNewImageSlot(fromWire(editable.wire).sections[0].image));

    // Unchanged by the writer: everything comes back in place.
    const result = assembleBlogPost(fromWire(editable.wire), context({slug: live.slug, images: new Map(), keptMedia: editable.keptMedia, publishedAt: live.publishedAt}));
    assert.deepEqual(result.problems, []);
    assert.equal(result.post.featuredImage.src, hero.src);
    assert.equal(result.post.publishedAt, "2025-01-02");
    assert.equal(result.post.updatedAt, "2026-10-10");
    assert.equal(result.post.sections[1].media?.type, "image");
    assert.deepEqual(readEmbedSpec(result.post.sections[2].html), bar);
    assert.deepEqual(result.post.sections[3].media, video);
    assert.equal(result.post.sections[4].html, undefined);
});
