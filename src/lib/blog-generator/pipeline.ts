import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {ARTICLE_JSON_SHAPE, fromWire, KEEP_PREFIX, normalizeUrl, type ArticleSpec, type ArticleWire} from "@/lib/blog-generator/article-spec";
import type {LoadedMaterials} from "@/lib/blog-generator/materials";
import {describeCatalog, searchCatalog, type CatalogItem, type CatalogKind, type SiteCatalog} from "@/lib/blog-generator/catalog";
import {claudeClient, CLAUDE_MODEL} from "@/lib/blog-generator/claude-client";
import {recordUsage} from "@/lib/blog-generator/cost-meter";

// Topic discovery → research → writing, all on Claude. Research may only use
// what it actually finds (web search / fetch) and our own catalog; the writer
// sees nothing but that dossier, so every claim and link traces back to it.

export type GeneratorMode = "news" | "catalog" | "custom";

/**
 * How hard research digs. Cost grows faster than the counts suggest: every
 * page read is re-read on each later turn of the research loop, so pages and
 * page size multiply.
 */
export type ResearchDepth = "light" | "standard" | "deep";

export const RESEARCH_DEPTHS: Record<ResearchDepth, {searches: number; fetches: number; pageTokens: number; effort: "medium" | "high"; method: string}> = {
    light: {searches: 5, fetches: 3, pageTokens: 6000, effort: "medium", method: "Search 2–4 times with precise queries, then open (web_fetch) only the 2–3 best primary sources and read them."},
    standard: {searches: 8, fetches: 5, pageTokens: 9000, effort: "medium", method: "Search with precise queries, then open (web_fetch) the 3–5 best sources and read them."},
    deep: {searches: 12, fetches: 8, pageTokens: 14000, effort: "high", method: "Search widely, then open (web_fetch) the 4–8 best sources and read them."}
};

export function isResearchDepth(value: unknown): value is ResearchDepth {
    return value === "light" || value === "standard" || value === "deep";
}

export type TopicIdea = {
    title: string;
    angle: string;
    hook: string;
    primaryKeyword: string;
    format: string;
    whyNow: string;
    sources: Array<{label: string; url: string}>;
    shareLine?: string;
    viralLever?: string;
    viralScore?: number;
};

export type Brief = {mode: GeneratorMode; title: string; angle: string; primaryKeyword?: string; sources?: Array<{label: string; url: string}>; notes?: string};

type Log = (line: string) => void;

const FALLBACK = {betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const};
const MAX_CONTINUATIONS = 12;

const BRAND_CONTEXT = `AnimalDex (animaldex.app) is a mobile app and website about real animals. In the app you photograph real animals live, it identifies the species and adds it to your personal AnimalDex collection as a card with stats; there are species comparisons ("who would win"), tier lists, an Animal Hybrid Lab, location guides for where to see animals, quizzes and Trials. The website hosts an encyclopedia of species pages, comparisons, hybrids, tier lists, location guides and this blog.

Product facts you must never contradict:
- Only live, in-app camera captures count toward a collection. Uploaded or imported photos never count as captures.
- Credits are in-app only and are not cash. Never promise money, income or payouts.
- Creator Rewards is currently paused. Do not mention it unless the topic requires, and then say it is paused.
- Wildlife Guides is in beta. Sponsored challenges award achievements, not money.`;

// The bar every stage is held to. "Viral" here means the reader feels a jolt
// and wants to tell someone, earned by true facts, never by invented outrage.
const VIRAL_STANDARD = `The AnimalDex blog only publishes stories people cannot resist sharing. Boring, basic, textbook content is a failure even if it is accurate.

Every story must pull at least one of these levers, hard:
- CURIOSITY: a question the reader can't leave unanswered ("Why do wombats poop cubes?").
- STRANGENESS: biology that sounds made up (animals that breathe through their bums, regrow brains, live without oxygen).
- WILDNESS: extreme numbers, abilities and records (the fastest, loudest, oldest, deadliest, smallest, strongest).
- DANGER: venom, predators, survival, "could it kill you?", animals that beat humans at something.
- COOLNESS: superpowers, biomimicry that changed technology, animals smarter than they look.
- CONTROVERSY: real fights among scientists, myths that turn out to be true (or false), uncomfortable truths about familiar animals, ethical debates like de-extinction, with both sides given fairly.
- CRAZINESS: bizarre behaviour, weird mating, gross-out facts told with a grin, never with cruelty.

Test: if a smart 16-year-old would scroll past it, or it reads like an encyclopedia entry ("The habitat and diet of the red fox"), reject it. If a reader would screenshot a line and send it to a friend with "wait, WHAT?", that's the bar.

Limits: it must all be true and sourced. Never invent drama, exaggerate a study, or write a headline the article doesn't pay off; a surprising truth beats a sensational lie. No graphic cruelty, no encouraging anyone to harm, handle or provoke wild animals.`;

function textOf(content: Anthropic.Beta.BetaContentBlock[]) {
    return content.map((block) => (block.type === "text" ? block.text : "")).join("");
}

/** Every URL that web search returned or web fetch opened in a response. */
function collectUrls(content: Anthropic.Beta.BetaContentBlock[], into: Set<string>) {
    for (const block of content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
            for (const result of block.content) if ("url" in result && typeof result.url === "string") into.add(normalizeUrl(result.url));
        }
        if (block.type === "web_fetch_tool_result") {
            const result = block.content as {type?: string; url?: unknown};
            if (result.type === "web_fetch_result" && typeof result.url === "string") into.add(normalizeUrl(result.url));
        }
    }
    into.delete("");
}

function extractJson<T>(text: string): T {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    return JSON.parse(candidate) as T;
}

const SEARCH_SITE_TOOL: Anthropic.Beta.BetaTool = {
    name: "search_site",
    description: "Search the AnimalDex website for pages to link to: species pages, comparisons (X vs Y), animal hybrids, tier lists/rankings, location guides and existing blog posts. Returns titles and paths. Use it for every animal, place and comparison the article will mention; only paths it returns can be linked.",
    input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
            query: {type: "string", description: "A species name, place, or topic, e.g. \"snow leopard\" or \"fastest animals\"."},
            kinds: {type: "array", items: {type: "string", enum: ["species", "comparison", "hybrid", "ranking", "location", "blog", "hub"]}, description: "Optional filter."}
        }
    },
    strict: true
};

type AgentResult = {text: string; urls: Set<string>; siteHits: Map<string, CatalogItem>};

/** A manual loop: server tools (search/fetch) pause and resume, search_site runs here. */
async function runAgent(params: {
    system: string;
    prompt: string | Anthropic.Beta.BetaContentBlockParam[];
    catalog: SiteCatalog;
    searchUses: number;
    fetchUses: number;
    pageTokens?: number;
    effort: "low" | "medium" | "high";
    log: Log;
    label: string;
}): Promise<AgentResult> {
    const client = claudeClient();
    const urls = new Set<string>();
    const siteHits = new Map<string, CatalogItem>();
    const tools: Anthropic.Beta.BetaToolUnion[] = [
        {type: "web_search_20260209", name: "web_search", max_uses: params.searchUses},
        ...(params.fetchUses > 0 ? [{type: "web_fetch_20260209" as const, name: "web_fetch" as const, max_uses: params.fetchUses, max_content_tokens: params.pageTokens ?? 8000}] : []),
        SEARCH_SITE_TOOL
    ];
    const messages: Anthropic.Beta.BetaMessageParam[] = [{role: "user", content: params.prompt}];

    for (let turn = 0; turn < MAX_CONTINUATIONS; turn += 1) {
        const stream = client.beta.messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: 32000,
            ...FALLBACK,
            output_config: {effort: params.effort},
            // Each turn resends everything (attachments, fetched pages), so cache the prefix.
            cache_control: {type: "ephemeral"},
            system: params.system,
            tools,
            messages
        });
        const response = await stream.finalMessage();
        recordUsage(params.label, response.usage);
        collectUrls(response.content, urls);
        for (const block of response.content) {
            // Other server tool calls (the search tool's own result filtering) aren't worth a log line.
            if (block.type === "server_tool_use" && (block.name === "web_search" || block.name === "web_fetch")) {
                const input = block.input as {query?: string; url?: string};
                params.log(`${params.label}: ${block.name === "web_fetch" ? `reading ${input.url}` : `searching "${input.query}"`}`);
            }
        }

        if (response.stop_reason === "refusal") throw new Error(`${params.label} was declined by the model`);
        if (response.stop_reason === "pause_turn") {
            messages.push({role: "assistant", content: response.content});
            continue;
        }
        if (response.stop_reason === "tool_use") {
            messages.push({role: "assistant", content: response.content});
            const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
            for (const block of response.content) {
                if (block.type !== "tool_use") continue;
                const input = block.input as {query?: unknown; kinds?: unknown};
                if (block.name !== "search_site" || typeof input.query !== "string") {
                    results.push({type: "tool_result", tool_use_id: block.id, is_error: true, content: "Unknown tool or missing query."});
                    continue;
                }
                const kinds = Array.isArray(input.kinds) ? input.kinds.filter((kind): kind is CatalogKind => typeof kind === "string") : undefined;
                const hits = searchCatalog(params.catalog, input.query, kinds);
                hits.forEach((hit) => siteHits.set(hit.href, hit));
                params.log(`${params.label}: site search "${input.query}" → ${hits.length} page(s)`);
                results.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: hits.length ? hits.map((hit) => `${hit.kind}\t${hit.title}\t${hit.href}`).join("\n") : "No AnimalDex pages match. Do not link this."
                });
            }
            messages.push({role: "user", content: results});
            continue;
        }
        if (response.stop_reason === "max_tokens") throw new Error(`${params.label} ran out of output tokens`);
        return {text: textOf(response.content), urls, siteHits};
    }
    throw new Error(`${params.label} did not finish within ${MAX_CONTINUATIONS} turns`);
}

const TOPIC_SYSTEM = `You are the editor-in-chief of the AnimalDex blog, a wildlife publication that competes for Google traffic and social shares with National Geographic, IFLScience and BBC Wildlife. You pick stories that make people stop scrolling: surprising animal abilities, fresh discoveries, records, myths busted, "X vs Y" debates, real-world places to see animals, and nature-inspired engineering (biomimicry).

${BRAND_CONTEXT}

${VIRAL_STANDARD}

A good pick has (1) a lever from the list above, pulled hard, (2) real search demand or a clear news peg, (3) enough verifiable facts for 1,200+ words, (4) natural links into AnimalDex pages (species, comparisons, tier lists, locations, hybrids). Avoid topics already covered by an existing post title, pet-care advice, and anything medical or legal.

Brainstorm at least 12 candidates, score each honestly, and return only the 6 strongest. A routine news item (a survey count, a policy update, "new reserve opens") only makes the cut if you can find the genuinely wild angle in it.`;

const IDEAS_FORMAT = `Reply with only a JSON object in a \`\`\`json fence:
{"ideas":[{"title":"working headline, max 60 characters","angle":"the specific story and what makes it different","hook":"the one surprising fact or question that sells it","shareLine":"the exact sentence a reader would text a friend","viralLever":"curiosity | strangeness | wildness | danger | coolness | controversy | craziness","viralScore":8,"primaryKeyword":"the search phrase it targets","format":"news | explainer | listicle | comparison | guide | myth-buster","whyNow":"news peg or search demand","sources":[{"label":"publisher: headline","url":"https://..."}]}]}
viralScore is 1–10 for how irresistible it is to click and share; only return ideas scoring 7 or more, best first. Only list source URLs that appeared in your search results.`;

export async function suggestTopics(mode: Exclude<GeneratorMode, "custom">, focus: string, catalog: SiteCatalog, log: Log): Promise<TopicIdea[]> {
    const summary = describeCatalog(catalog);
    const today = new Date().toISOString().slice(0, 10);
    const focusLine = focus.trim() ? `\nThe editor asked to focus on: ${focus.trim()}` : "";
    const prompt = mode === "news"
        ? `Today is ${today}. Use web search to find the wildest, strangest, most shareable wildlife and animal stories from the last 14 days: bizarre new species, behaviour studies with jaw-dropping results, record-breaking animals, scientific fights, myths overturned, animals doing things nobody thought they could, viral animal moments with a real science angle, and biomimicry breakthroughs. Skip routine stories unless they hide a wild angle. Prefer primary or reputable outlets (journals, universities, Mongabay, BBC, Smithsonian, ScienceDaily, Phys.org, New Scientist).${focusLine}

Propose 6 distinct article ideas. Each must be about a real, dated development you found, explained for curious non-experts, and linkable to animals we cover (use search_site to check).

Existing post titles (do not repeat these):
${summary.existingBlogTitles.join("\n")}

${IDEAS_FORMAT}`
        : `Today is ${today}. Propose 6 evergreen articles that would rank in Google and get shared like crazy, built around the AnimalDex catalog so each one links deeply into our pages. Think: "animals that shouldn't exist" listicles, brutal "X vs Y: who actually wins" deep dives, "the most dangerous animals in Y" guides, absurd records, myths everyone believes, animals with real superpowers, and biomimicry that changed the world. You may use web search to check what people are asking and to confirm facts exist to support each idea.${focusLine}

Our catalog: ${JSON.stringify(summary.counts)} pages.
Hubs: ${summary.hubs.join("; ")}
Location guides: ${summary.locations.join(", ")}
Tier lists: ${summary.rankings.join("; ")}

Existing post titles (do not repeat these):
${summary.existingBlogTitles.join("\n")}

Use search_site to confirm the pages each idea would link to. ${IDEAS_FORMAT}`;

    const result = await runAgent({system: TOPIC_SYSTEM, prompt, catalog, searchUses: mode === "news" ? 10 : 4, fetchUses: 0, effort: "medium", log, label: "Topics"});
    const parsed = extractJson<{ideas?: TopicIdea[]}>(result.text);
    return (parsed.ideas ?? [])
        .filter((idea) => idea && typeof idea.title === "string" && typeof idea.angle === "string")
        .map((idea) => ({
            ...idea,
            viralScore: typeof idea.viralScore === "number" ? idea.viralScore : Number(idea.viralScore) || 0,
            sources: (idea.sources ?? []).filter((source) => result.urls.has(normalizeUrl(source.url)))
        }))
        // Auto-pick takes the first idea, so the most shareable one leads.
        .sort((a, b) => (b.viralScore ?? 0) - (a.viralScore ?? 0));
}

const RESEARCH_SYSTEM = `You are a wildlife research editor preparing a fact dossier for a feature writer. Accuracy is everything: the writer may use nothing that is not in your dossier. Your other job is to find the wildest true material on the topic, because the writer can only be as surprising as your dossier.

${VIRAL_STANDARD}

Hunt specifically for: the single most jaw-dropping fact; numbers that sound fake but aren't; the strangest anatomical or behavioural detail; anything gross, creepy or absurd; where scientists disagree, and who says what; popular myths, and whether they are true; how this animal beats humans or technology at something; recent findings that overturned what textbooks said.

Method:
1. Follow the search budget in the request. Prefer primary sources: the study, the university or agency release, IUCN, museum or zoo scientists, then reputable outlets. Note publication dates.
2. Gather specific, surprising, verifiable facts: numbers with units, names of researchers and institutions, places, dates, comparisons.
3. Gather numbers that could become a chart: the same measure for 3+ animals (speed, weight, lifespan, bite force, range, population over time), or two animals compared on 3+ measures. Only figures you actually found.
4. Use search_site for every animal, place, comparison or ranking you might mention, to find AnimalDex pages to link.

${BRAND_CONTEXT}

Write the dossier in plain text:
- ANGLE: the sharpest, most shareable framing; the single most jaw-dropping fact; and the "wait, WHAT?" line a reader would screenshot.
- WILD FACTS: the 5–10 most surprising, strange or extreme facts, ranked, each with [source URL].
- FACTS: numbered, one fact per line, each ending with [source URL]. Mark anything contested as contested.
- CHART DATA: tables of figures with units and [source URL], or "none".
- TIMELINE: dated events if the story has a sequence, or "none".
- MYTHS: common misconceptions this topic can correct, with the correction and [source URL], or "none".
- QUESTIONS PEOPLE ASK: 5–8 real questions searchers have about this topic.
- ANIMALDEX PAGES: every relevant path from search_site, with what it is.
- SOURCES: every URL you used, with publisher and title.

When the editor attaches reference material, treat it as a primary source: read all of it, cite its facts as [attached: file name], and add an ATTACHED MATERIAL section that captures its key facts, figures, names, dates and any direct quotes word for word. Still search the web to confirm, update and add context to it, and say where the web disagrees with it.`;

export type Research = {dossier: string; urls: Set<string>; siteHits: Map<string, CatalogItem>};

export async function researchBrief(brief: Brief, catalog: SiteCatalog, log: Log, materials?: LoadedMaterials, depth: ResearchDepth = "light"): Promise<Research> {
    const settings = RESEARCH_DEPTHS[depth];
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Today is ${today}. Prepare the dossier for this article.

Search budget: ${settings.method} Use search_site for AnimalDex pages as often as you need (it is free). Keep the dossier dense: facts, not prose.

Working title: ${brief.title}
Angle: ${brief.angle}
${brief.primaryKeyword ? `Target search phrase: ${brief.primaryKeyword}\n` : ""}${brief.notes ? `Editor notes: ${brief.notes}\n` : ""}${brief.sources?.length ? `Leads to start from:\n${brief.sources.map((source) => `- ${source.label}: ${source.url}`).join("\n")}\n` : ""}${brief.mode === "news" ? "This is a news story: establish exactly what was found or announced, by whom, when, and why it matters, then the background a reader needs.\n" : ""}`;
    const content: string | Anthropic.Beta.BetaContentBlockParam[] = materials?.blocks.length
        ? [
            {type: "text", text: `The editor attached ${materials.names.length} reference file(s): ${materials.names.join(", ")}.`},
            ...materials.blocks,
            {type: "text", text: prompt}
        ]
        : prompt;
    log(`Research depth: ${depth} (up to ${settings.searches} searches, ${settings.fetches} pages)`);
    const result = await runAgent({system: RESEARCH_SYSTEM, prompt: content, catalog, searchUses: settings.searches, fetchUses: settings.fetches, pageTokens: settings.pageTokens, effort: settings.effort, log, label: "Research"});
    return {dossier: result.text, urls: result.urls, siteHits: result.siteHits};
}

const WRITER_SYSTEM = `You write feature articles for the AnimalDex blog. Your pieces get shared because they are genuinely astonishing, and they rank because they answer exactly what people search, better than anyone else.

${BRAND_CONTEXT}

${VIRAL_STANDARD}

How that shows up in the writing:
- The headline promises something the reader can't ignore (a shocking number, a "this shouldn't be possible", a myth about to be busted, a fight) and the article pays it off in full.
- The first sentence is a jolt: the wildest fact or image in the dossier, stated plainly. Never open with background, definitions or "Have you ever wondered".
- Every section contains at least one "wait, what?" fact, and builds toward its most surprising detail instead of front-loading context.
- No filler sections. "Habitat", "Diet", "Conservation status" or "Physical description" only appear if they carry a genuine surprise, and then their title says what the surprise is.
- Cut anything a curious reader already knows. Escalate: keep the best reveal for late in the piece so readers scroll.
- Where scientists disagree, say so and give both sides with names. Where a myth is half-true, say exactly which half.
- Humour is welcome: dry, specific, never at the expense of accuracy or the animal.

Voice: vivid, confident, warm, curious. Write to "you". Short paragraphs (2–4 sentences). Concrete images over adjectives. Specific numbers, names and places. No clichés ("in the vast tapestry", "nature never ceases to amaze", "delve", "fascinating world of"), no filler, no exclamation marks, no emojis. British-neutral spelling is fine; be consistent.

Structure and SEO:
- title: max 60 characters, contains the primary search phrase near the start, plus a curiosity gap, shocking number, or provocation. No clickbait that the article does not pay off.
- metaDescription: 140–158 characters, the payoff plus a reason to click.
- quickAnswer: 40–60 words that directly answer the main query (this targets the featured snippet).
- 6–9 sections. Section titles are the questions and phrases people search ("How fast can a cheetah really run?"), not vague labels. kicker: a 1–3 word label or "".
- Open the first section with the most surprising fact, not background.
- pullQuotes are the most screenshot-able lines in the piece: short, specific, a little outrageous.
- Total 1,300–2,000 words of prose. Every section earns its place.
- One pullQuote in 2–3 sections: a short, quotable line a reader would screenshot. "" elsewhere.
- cards: 2–6 short label/body pairs only when a list reads better as cards (e.g. "5 animals that..."); otherwise [].
- faq: 4–6 questions from the dossier's QUESTIONS PEOPLE ASK, each answered in 2–3 sentences.
- The last section connects to the reader's own life: how to see, spot or learn about these animals, naturally mentioning that AnimalDex lets you capture the real animal with your phone camera to add it to your collection. One mention, no hard sell, and never recite the product facts above as a disclaimer: they limit what you claim, they are not copy.

Embeds (rendered for you; you supply data only). Every section has an embed object: set kind "none" (and leave the rest empty) except in 1–3 sections where an embed genuinely adds something. Unused fields are "" / 0 / false / [].
- bar: items are the same, directly comparable measure (same unit, same method) for 3–12 animals/items. Never chart estimates that the article says are not comparable: label, value (a plain number in the stated unit), highlight true for the article's subject, optional note. Set unit.
- duel: left and right name two animals; items are 3–8 metrics: label, left and right scored 0–10 (relative), the real figures in leftLabel/rightLabel.
- timeline: items are 3–10 dated events from the dossier: when, label (event title), body.
- quiz: questions holds 3–6 multiple-choice questions on facts from the article; answer is the 0-based index of the correct option; each explanation is one sentence. Great near the end.
- flipcards: items are 3–8 cards: label is the myth or question on the front, body the surprising truth on the back.
Every number in an embed must come from the dossier's facts or chart data, and the key figures must also appear in the prose.

Tables: tableColumns + tableRows (each row has one cell per column) where readers compare options; otherwise both [].

Images: heroImage and 2–4 section images. query is Wikimedia Commons search terms (common name plus scientific name works best, e.g. "snow leopard Panthera uncia"); mustShow says exactly what a correct photo shows; alt describes the photo for screen readers. For sections without a photo, set image to {"query": "", "mustShow": "", "alt": ""}. Only request photos of real animals or places, not of researchers, logos or diagrams.

Links: in each section's links, list internal AnimalDex paths from the dossier's ANIMALDEX PAGES whose anchor text appears verbatim in that section's paragraphs (use a natural phrase like "snow leopard" or "fastest land animals", never "click here"). Aim for 6–15 internal links across the article. Never invent a path. speciesSlugs: the slugs from /animals/<slug> paths you used.

Truth: use only facts in the dossier. If the dossier marks something contested, say so. Never invent quotes, numbers, studies or dates. Name the researchers and institutions behind findings. sources: 3–10 URLs from the dossier's SOURCES that the article relies on, label as "Publisher: Title". Facts marked [attached: …] come from material the editor supplied: you may use them, but sources only lists web URLs.

slug: lowercase-hyphenated, 3–7 words, built from the primary search phrase. tags: 3–6 short topic tags. searchIntents: 4–8 search phrases this article should rank for.`;

/** A second pass over an article: the editor's fixes, or an edit of a live post. */
export type Revision =
    | {kind: "fixes"; draft: ArticleSpec | ArticleWire; fixes: string[]}
    | {kind: "edit"; live: ArticleWire; instructions: string};

export type WrittenArticle = ArticleSpec & {changeSummary: string[]};

function revisionPrompt(revision: Revision) {
    if (revision.kind === "fixes") {
        return `

You already wrote the draft below, and the editor sent it back. Rewrite the whole article applying every fix, keeping what works, staying inside the dossier's facts, and returning the complete article in the same JSON shape.

EDITOR'S FIXES
${revision.fixes.map((fix, index) => `${index + 1}. ${fix}`).join("\n")}

YOUR DRAFT
${JSON.stringify(revision.draft)}`;
    }
    return `

This is an EDIT of an article that is already live. The live version is below in the same JSON shape. Apply the instructions and return the complete revised article.
- Keep "slug" exactly as it is (the URL must not change).
- An image whose query starts with "${KEEP_PREFIX}" is a photo or video already on the page: leave that slot unchanged to keep it, set it to empty strings to drop it, or replace it with a Commons query to swap in a new photo.
- Keep what already works. Fix anything the dossier shows is wrong or out of date. Do not drop correct facts or sources unless the instructions ask.
- Add one extra top-level field, "changeSummary": a list of 3–10 short lines saying what you changed and why.

INSTRUCTIONS
${revision.instructions}

LIVE ARTICLE
${JSON.stringify(revision.live)}`;
}

export async function writeArticle(brief: Brief, research: Research, log: Log, revision?: Revision): Promise<WrittenArticle> {
    const today = new Date().toISOString().slice(0, 10);
    const pages = Array.from(research.siteHits.values()).map((hit) => `${hit.kind}\t${hit.title}\t${hit.href}`).join("\n");
    log(revision?.kind === "edit" ? "Editing the article" : revision ? "Rewriting the article" : "Writing the article");
    const messages: Anthropic.Beta.BetaMessageParam[] = [{
        role: "user",
        content: `Today is ${today}.

Working title: ${brief.title}
Angle: ${brief.angle}
${brief.primaryKeyword ? `Primary search phrase: ${brief.primaryKeyword}\n` : ""}${brief.notes ? `Editor notes: ${brief.notes}\n` : ""}
DOSSIER
${research.dossier}

AnimalDex pages confirmed by site search (the only internal paths you may link):
${pages || "(none)"}

Reply with only the article as one JSON object in a \`\`\`json fence, in exactly this shape:
${ARTICLE_JSON_SHAPE}${revision ? revisionPrompt(revision) : ""}`
    }];

    // One repair turn if the JSON doesn't parse; the article itself is kept.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await claudeClient().beta.messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: 64000,
            ...FALLBACK,
            output_config: {effort: "high"},
            system: WRITER_SYSTEM,
            messages
        }).finalMessage();
        recordUsage(revision?.kind === "edit" ? "Editing" : revision ? "Rewrite" : "Writing", response.usage);
        if (response.stop_reason === "refusal") throw new Error("The writer declined this topic");
        if (response.stop_reason === "max_tokens") throw new Error("The article ran past the output limit");
        const reply = textOf(response.content);
        try {
            const raw = extractJson<{changeSummary?: unknown}>(reply);
            const changeSummary = Array.isArray(raw.changeSummary) ? raw.changeSummary.filter((line): line is string => typeof line === "string") : [];
            return {...fromWire(raw), changeSummary};
        } catch (error) {
            if (attempt > 0) throw new Error(`The writer's JSON did not parse: ${error instanceof Error ? error.message : error}`);
            log("Article JSON did not parse, asking for a fix");
            messages.push({role: "assistant", content: response.content});
            messages.push({role: "user", content: `That JSON does not parse (${error instanceof Error ? error.message : error}). Reply with the same article as valid JSON only, in a \`\`\`json fence.`});
        }
    }
    throw new Error("The writer did not return an article");
}

export type EditorVerdict = {score: number; verdict: string; fixes: string[]};

const EDITOR_SYSTEM = `You are the AnimalDex blog's toughest editor. You decide whether a draft is shareable enough to publish.

${VIRAL_STANDARD}

Score the draft 1–10 for how irresistible it is to click, finish and share (10 = people send it to friends; 5 = accurate but forgettable; 1 = encyclopedia filler). Judge the headline, the first sentence, whether every section has a "wait, what?" moment, whether the best reveals are held back to keep people scrolling, and the pull quotes. Flag any line that overclaims beyond its evidence: that costs points too.

Reply with only JSON in a \`\`\`json fence: {"score": number, "verdict": "one sentence", "fixes": ["specific, actionable instruction naming the section or line", ...]} with at most 8 fixes, most important first.`;

async function reviewArticle(spec: ArticleSpec): Promise<EditorVerdict> {
    const response = await claudeClient().beta.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        ...FALLBACK,
        output_config: {effort: "medium"},
        system: EDITOR_SYSTEM,
        messages: [{role: "user", content: `Draft:\n${JSON.stringify({title: spec.title, quickAnswer: spec.quickAnswer, sections: spec.sections.map((section) => ({title: section.title, paragraphs: section.paragraphs, pullQuote: section.pullQuote}))}, null, 1)}`}]
    }).finalMessage();
    recordUsage("Editor", response.usage);
    const parsed = extractJson<Partial<EditorVerdict>>(textOf(response.content));
    return {
        score: Number(parsed.score) || 0,
        verdict: typeof parsed.verdict === "string" ? parsed.verdict : "",
        fixes: Array.isArray(parsed.fixes) ? parsed.fixes.filter((fix): fix is string => typeof fix === "string").slice(0, 8) : []
    };
}

/** Below this, the editor's fixes go back to the writer for one rewrite. */
const PUBLISH_SCORE = 9;

/** Writes, has the editor score it, and rewrites once if it isn't shareable enough. */
export async function writeAndEdit(brief: Brief, research: Research, log: Log, edit?: Extract<Revision, {kind: "edit"}>): Promise<{spec: WrittenArticle; review: EditorVerdict | null}> {
    const draft = await writeArticle(brief, research, log, edit);
    let review: EditorVerdict;
    try {
        review = await reviewArticle(draft);
    } catch (error) {
        log(`Editor check failed, keeping the draft: ${error instanceof Error ? error.message : error}`);
        return {spec: draft, review: null};
    }
    log(`Editor score ${review.score}/10: ${review.verdict}`);
    if (review.score >= PUBLISH_SCORE || !review.fixes.length) return {spec: draft, review};

    log("Rewriting with the editor's fixes");
    const rewritten = await writeArticle(brief, research, log, {kind: "fixes", draft, fixes: review.fixes});
    // An edit's change list describes the change from the live post, so it carries over.
    if (!rewritten.changeSummary.length) rewritten.changeSummary = draft.changeSummary;
    try {
        const second = await reviewArticle(rewritten);
        log(`Editor score after rewrite ${second.score}/10: ${second.verdict}`);
        // Keep whichever version the editor rated higher.
        return second.score >= review.score ? {spec: rewritten, review: second} : {spec: draft, review};
    } catch {
        return {spec: rewritten, review};
    }
}

/** Sources that answer: research already saw them, this checks they still load. */
export async function checkReachable(urls: string[]): Promise<Set<string>> {
    const reachable = new Set<string>();
    await Promise.all(urls.map(async (url) => {
        try {
            const response = await fetch(url, {
                method: "GET",
                redirect: "follow",
                headers: {"User-Agent": "Mozilla/5.0 (compatible; AnimalDexLinkCheck/1.0; +https://animaldex.app)", Accept: "text/html,*/*"},
                signal: AbortSignal.timeout(15_000)
            });
            // 401/403/429 are bot walls on pages research just read, not dead links.
            if (response.ok || [401, 403, 429].includes(response.status)) reachable.add(url);
            response.body?.cancel().catch(() => undefined);
        } catch {
            // unreachable
        }
    }));
    return reachable;
}
