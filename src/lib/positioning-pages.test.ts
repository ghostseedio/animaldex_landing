import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    adviceFatigueWordCount,
    getAdviceFatigueContent,
    type AdviceFatigueContent
} from "@/data/advice-fatigue";
import {
    getAnimalsWorkPoints,
    getDisagreeExample,
    getPerspectiveFlow,
    ownPowerLine,
    PERSPECTIVE_FLOW_WIDTHS
} from "@/data/animal-perspective";
import {getHowItWorksContent} from "@/data/how-it-works";
import {getSupportContent} from "@/data/support-content";
import {countWords, parseInlineMarkup, plainInlineText} from "@/lib/inline-markup";
import {diagramRuns, drawFlow, drawGrid, textColumns, wrapText} from "@/lib/text-diagram";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

/** Every word of an article a reader can see, for the copy rules below. */
function articleCopy(content: AdviceFatigueContent): string[] {
    return [
        content.metaTitle,
        content.metaDescription,
        content.title,
        content.dek,
        ...content.lead,
        ...content.sections.flatMap((section) => [
            section.title,
            ...section.blocks.flatMap((block) => {
                if (block.kind === "p" || block.kind === "h3") return [block.text];
                if (block.kind === "ul" || block.kind === "ol") return block.items;
                if (block.kind === "stats") return [...block.items.map((item) => `${item.value} ${item.label}`), block.source];
                return [];
            })
        ]),
        ...content.paradox.rows.flat(),
        ...content.paradox.headers,
        content.example.question,
        ...content.example.animals.flatMap((animal) => [...animal.bubbles, animal.step]),
        content.example.caption,
        ...content.faq.flatMap((item) => [item.question, item.answer]),
        content.cta.title,
        content.cta.body
    ].map(plainInlineText);
}

function sentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+/);
}

const ALLOWED_REFERENCE_URLS = [
    "https://doi.org/10.1126/science.aec8352",
    "https://arxiv.org/abs/2510.01395",
    "https://news.stanford.edu/stories/2026/03/ai-advice-sycophantic-models-research",
    "https://arxiv.org/abs/2505.13995",
    "https://arxiv.org/abs/2310.13548",
    "https://openai.com/index/sycophancy-in-gpt-4o/"
];

test("a drawn grid is a closed box: every line is the same width and the columns line up", () => {
    const lines = drawGrid({
        headers: ["", "Standard", "AnimalDex"],
        widths: [6, 10, 12],
        rows: [["Starts", "What you want to hear", "Its kind's verdict, read from its Power"], ["Ends", "Comfort", "One step"]]
    });
    const width = textColumns(lines[0]);
    for (const line of lines) assert.equal(textColumns(line), width, line);
    const joints = (line: string) => Array.from(line).flatMap((character, index) => (/[│┬┼┴├┤┌┐└┘]/.test(character) ? [index] : []));
    for (const line of lines) assert.deepEqual(joints(line), joints(lines[0]), line);
    assert.match(lines[1], /STANDARD/);
    assert.ok(lines.every((line) => !/\t/.test(line)));
});

test("a drawn flow keeps its boxes aligned, its arrows under each box, and its branch to the right", () => {
    const flow = getPerspectiveFlow("en");
    const lines = drawFlow({steps: flow.steps, width: PERSPECTIVE_FLOW_WIDTHS.step, branch: {...flow.branch, width: PERSPECTIVE_FLOW_WIDTHS.branch}});
    const boxWidth = PERSPECTIVE_FLOW_WIDTHS.step + 4;
    const arrows = lines.filter((line) => line.trim() === "↓");
    assert.equal(arrows.length, flow.steps.length - 1);
    const arrowColumn = Array.from(arrows[0]).indexOf("↓");
    for (const line of lines) {
        if (line.trim() === "↓") {
            assert.equal(Array.from(line).indexOf("↓"), arrowColumn);
            continue;
        }
        if (/^└.*┬/.test(line)) assert.equal(Array.from(line).indexOf("┬"), arrowColumn, "the arrow sits under the box's join");
        const main = Array.from(line).slice(0, boxWidth).join("");
        if (main.trim()) assert.match(main, /^[┌│└].*[┐│┘├┤]$/, line);
    }
    const branchLine = lines.find((line) => line.includes("→"));
    assert.ok(branchLine?.includes("├") && branchLine.includes("DEBATES"), "the branch leaves the last step with an arrow");
    // The steps alone fit a phone's panel; only the branch scrolls into view.
    assert.ok(boxWidth <= 40);
});

test("diagram runs separate strokes, arrows and words", () => {
    assert.deepEqual(diagramRuns("│ ok ├─→│").map((run) => run.kind), ["stroke", "text", "stroke", "arrow", "stroke"]);
    assert.deepEqual(wrapText("one two three", 7), ["one two", "three"]);
    assert.deepEqual(wrapText("unbreakable", 4), ["unbr", "eaka", "ble"]);
});

test("inline markup: bold, site links and anchors; plain text and word counts drop the marks", () => {
    assert.deepEqual(parseInlineMarkup("A **bold** word and [a link](/talk)."), [
        {type: "text", text: "A "},
        {type: "bold", text: "bold"},
        {type: "text", text: " word and "},
        {type: "link", text: "a link", href: "/talk"},
        {type: "text", text: "."}
    ]);
    assert.equal(plainInlineText("See [Cheng et al.](#ref-cheng-2026)."), "See Cheng et al..");
    assert.equal(countWords("Take it — **10 times** out of 10."), 7);
});

test("the article is in depth, and English and Indonesian share every section, anchor, panel and reference", () => {
    const en = getAdviceFatigueContent("en");
    const id = getAdviceFatigueContent("id");
    const words = adviceFatigueWordCount(en, getPerspectiveFlow("en"));
    assert.ok(words >= 2500 && words <= 3500, `${words} words`);

    const shape = (content: AdviceFatigueContent) => content.sections.map((section) => ({
        id: section.id,
        blocks: section.blocks.map((block) => block.kind === "h3" ? `h3:${block.id}` : block.kind === "panel" ? `panel:${block.panel}` : block.kind)
    }));
    assert.deepEqual(shape(id), shape(en));
    assert.equal(id.faq.length, en.faq.length);
    assert.equal(id.paradox.rows.length, en.paradox.rows.length);
    assert.deepEqual(id.references, en.references);
    assert.equal(getAdviceFatigueContent("fr"), en, "other locales read the English");
    // The table of contents is long enough for the blog's rail to draw.
    assert.ok(en.sections.length >= 6);
});

test("the article cites only the spec's sources, with the spec's numbers", () => {
    for (const locale of ["en", "id"]) {
        const content = getAdviceFatigueContent(locale);
        const urls = content.references.flatMap((reference) => reference.links.map((link) => link.href));
        assert.deepEqual([...urls].sort(), [...ALLOWED_REFERENCE_URLS].sort());
        const copy = articleCopy(content).join("\n");
        for (const href of copy.match(/https?:\/\/\S+/g) ?? []) assert.ok(ALLOWED_REFERENCE_URLS.includes(href), href);
        // In-text citations point at the references list.
        const anchors = content.sections.flatMap((section) => section.blocks.flatMap((block) => block.kind === "p" ? parseInlineMarkup(block.text) : []))
            .flatMap((token) => token.type === "link" && token.href.startsWith("#") ? [token.href.slice(1)] : []);
        for (const anchor of anchors) assert.ok(content.references.some((reference) => reference.id === anchor), anchor);
    }

    const en = articleCopy(getAdviceFatigueContent("en")).join("\n");
    assert.match(en, /Across 11 AI models, AI affirmed users' actions about 49% more often than humans did, including when the queries described deception or harm\./);
    assert.match(en, /In three preregistered experiments with 2,405 participants, even one interaction with sycophantic AI made people more convinced they were right and less willing to take responsibility or repair the conflict\./);
    assert.match(en, /"the very feature that causes harm also drives engagement\."/);
    assert.match(en, /about 45 percentage points more on average/);
    assert.match(en, /said take it 10 times out of 10/);
    assert.match(en, /said stay 9 times out of 10/);
    assert.match(en, /declined in every full reply/);
    assert.match(en, /fell from 9 of 20 to 1/);
    assert.match(en, /In AnimalDex's own tests/);

    const id = articleCopy(getAdviceFatigueContent("id")).join("\n");
    for (const number of ["49%", "2.405", "11 model AI", "45 poin persentase", "10 dari 10", "9 dari 10", "9 dari 20 menjadi 1"]) {
        assert.ok(id.includes(number), number);
    }
});

test("copy rules: advice fatigue is ours, never 'deterministic', no competitor products, OpenAI only for its own post", () => {
    const pages = [
        ...["en", "id"].flatMap((locale) => articleCopy(getAdviceFatigueContent(locale))),
        ...["en", "id"].flatMap((locale) => {
            const how = getHowItWorksContent(locale);
            return [how.title, how.intro, how.pointsDescription, how.loopDescription, how.safetyBody, how.collectionBody, how.ctaBody,
                ...how.details.flatMap((detail) => detail.paragraphs), ...how.debateModes.map((mode) => mode.body)];
        }),
        ...["en", "id"].flatMap((locale) => getAnimalsWorkPoints(locale).map((point) => point.text)),
        readRepo("public/llms.txt")
    ];
    for (const text of pages) {
        assert.doesNotMatch(text, /determinis/i, text);
        assert.doesNotMatch(text, /\b(ChatGPT|Gemini|Claude|Copilot|Grok|Perplexity|Replika|Character\.AI|Llama|Mistral)\b/, text);
        for (const sentence of sentences(text)) {
            if (/Stanford/.test(sentence)) assert.doesNotMatch(sentence, /advice fatigue|lelah nasihat/i, sentence);
            if (/OpenAI/.test(sentence)) assert.match(sentence, /GPT-4o/, sentence);
        }
    }
    // The article says outright that the term is AnimalDex's.
    assert.match(articleCopy(getAdviceFatigueContent("en")).join("\n"), /"Advice fatigue" is our name for it, not a term from the research/);
});

test("the six points are the spec's words, on Help and How it works, in English and Indonesian", () => {
    assert.deepEqual(getAnimalsWorkPoints("en").map((point) => point.text), [
        "Every animal has a Power: a lesson from how its kind survives.",
        "It answers from its own life. It takes a side and keeps it, even when it isn't what you hoped to hear.",
        "Different animals disagree. That's the point: ask two, and you see your problem from two sides.",
        "Your step: bring it a real problem and it gives you one step to try. Do it, and its Power is yours.",
        "Debates: once its Power is yours, it can bring other animals in to argue your problem, privately or in public.",
        "Trials: each animal's own challenges, one more way to get a step."
    ]);
    assert.deepEqual(getAnimalsWorkPoints("id").map((point) => point.id), getAnimalsWorkPoints("en").map((point) => point.id));
    assert.notEqual(getAnimalsWorkPoints("id")[0].text, getAnimalsWorkPoints("en")[0].text);
    assert.equal(getSupportContent("en").animalsWorkTitle, "How the animals work");
    assert.equal(getSupportContent("id").animalsWorkTitle, "Cara kerja hewan-hewannya");
    const support = readRepo("src/app/[locale]/(composited)/support/page.tsx");
    assert.match(support, /getAnimalsWorkPoints\(locale\)/);
    assert.match(support, /id="how-the-animals-work"/);
    assert.match(support, /HOW_IT_WORKS_HREF/);
    assert.equal(ownPowerLine("en", "Groundhog"), "Groundhog answers from its own Power. Another animal may tell you the opposite.");
});

test("every animal is different: the owl says not yet and the cheetah says take it, as the spec's copy", () => {
    const example = getDisagreeExample("en", (slug) => `/art/${slug}.webp`);
    assert.equal(example.question, "Should I take the promotion?");
    assert.equal(example.animals[0].reply, "Not yet. I watch a whole night before I move. Learn the team first.");
    assert.equal(example.animals[1].reply, "Take it. I win by going all in, fast, before the chance is gone.");
    assert.equal(example.animals[1].image, "/art/cheetah.webp");
    assert.equal(getHowItWorksContent("en").title, "Every animal sees it **differently**.");
});

test("Talk is the way in everywhere: the home hero, the article, How it works, the sitemap and llms.txt", () => {
    const home = readRepo("src/app/[locale]/(composited)/(home)/page.tsx");
    assert.match(home, /href=\{TALK_HREF\}/);
    assert.match(home, /ADVICE_FATIGUE_HREF/);
    assert.match(home, /HOW_IT_WORKS_HREF/);
    assert.doesNotMatch(home, /heroTryTalking/);
    for (const page of ["advice-fatigue", "how-it-works"]) {
        const source = readRepo(`src/app/[locale]/(composited)/${page}/page.tsx`);
        assert.match(source, /href=\{TALK_HREF\}/, page);
        assert.match(source, /application\/ld\+json/, page);
        assert.match(source, /generateStaticParams/, page);
    }
    const article = readRepo("src/app/[locale]/(composited)/advice-fatigue/page.tsx");
    assert.match(article, /"@type": "Article"/);
    assert.match(article, /"@type": "FAQPage"/);

    const sitemap = readRepo("src/lib/build-sitemap.ts");
    for (const path of ["/advice-fatigue", "/how-it-works", "/talk"]) assert.ok(sitemap.includes(`"${path}"`), path);
    assert.doesNotMatch(sitemap, /"\/talk\//, "chat pages per animal are noindex and stay out of the sitemap");

    const llms = readRepo("public/llms.txt");
    assert.match(llms, /^# AnimalDex\n\n> /);
    for (const url of ["https://animaldex.app/talk", "https://animaldex.app/advice-fatigue", "https://animaldex.app/how-it-works"]) {
        assert.ok(llms.includes(`(${url})`), url);
    }
    for (const point of getAnimalsWorkPoints("en")) assert.ok(llms.includes(point.text), point.text);

    const en = JSON.parse(readRepo("src/data/locales/en.json"));
    const id = JSON.parse(readRepo("src/data/locales/id.json"));
    assert.equal(en.meta.fullTitle, "AnimalDex: Talk to Animals That Don't Just Agree With You");
    assert.equal(en.home.heroTalkLead, "Talk to animals.");
    assert.equal(en.home.heroTalkAccent, "They won't just agree with you.");
    for (const key of ["heroCta", "heroGetApp", "heroHowItWorks"]) assert.equal(typeof id.home[key], "string", key);
    assert.deepEqual(Object.keys(id.home.fatigue).sort(), Object.keys(en.home.fatigue).sort());
    assert.deepEqual(Object.keys(id.home.different).sort(), Object.keys(en.home.different).sort());
});
