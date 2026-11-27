import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {ANIMAL_SIMULATION_PATH, ECOSYSTEM_SIMULATION_PATH} from "@/lib/seo/ark-pages";
import {META_DESCRIPTION_MAX} from "@/lib/seo/page-metadata";
import {SIMULATION_FAQ_COUNT, SIMULATION_PAGES, simulationFaq, type SimulationPageId} from "@/lib/seo/simulation-pages";
import {sitemapSectionOf} from "@/lib/sitemap-sections";

const repoRoot = process.cwd();
type Tree = {[key: string]: string | Tree};
const words = (locale: string) => (JSON.parse(readFileSync(join(repoRoot, `src/data/locales/${locale}.json`), "utf8")) as {pages: Record<string, Tree>}).pages;
const IDS = Object.keys(SIMULATION_PAGES) as SimulationPageId[];

function leaves(tree: Tree, prefix = ""): string[] {
    return Object.entries(tree).flatMap(([key, value]) => (typeof value === "string" ? [`${prefix}${key}`] : leaves(value, `${prefix}${key}.`)));
}

test("the simulation pages say the phrase people search, in the title, the h1 and the description", () => {
    const en = words("en");
    for (const [id, phrase] of [["animalSimulation", "animal simulation"], ["ecosystemSimulation", "ecosystem simulation"]] as const) {
        const page = en[id] as Record<string, string>;
        for (const field of ["metaTitle", "title", "metaDescription", "intro"]) assert.match(page[field].toLowerCase(), new RegExp(phrase), `${id}.${field}`);
    }
    // "Animal simulator" is the App Store listing's own name; the page answers it too.
    assert.match(JSON.stringify(en.animalSimulation).toLowerCase(), /animal simulator/);
    assert.match(JSON.stringify(en.ecosystemSimulation).toLowerCase(), /ecosystem simulator/);
});

test("titles and descriptions fit a search result, in both languages", () => {
    for (const locale of ["en", "id"]) {
        for (const id of IDS) {
            const page = words(locale)[id] as Record<string, string>;
            assert.ok(`${page.metaTitle} | AnimalDex`.length <= 62, `${locale} ${id} title is ${page.metaTitle.length + 12}`);
            assert.ok(page.metaDescription.length <= META_DESCRIPTION_MAX, `${locale} ${id} description is ${page.metaDescription.length}`);
        }
        assert.ok((words(locale).howItWorks as Record<string, string>).metaDescription.length <= META_DESCRIPTION_MAX);
    }
});

test("Indonesian carries every string the English pages have, and every section and question exists", () => {
    const en = words("en");
    const id = words("id");
    for (const page of IDS) {
        assert.deepEqual(leaves(id[page] as Tree).sort(), leaves(en[page] as Tree).sort());
        const sections = (en[page] as Tree).sections as Tree;
        assert.deepEqual(Object.keys(sections), [...SIMULATION_PAGES[page].sections]);
        const faq = (en[page] as Tree).faq as Record<string, string>;
        assert.equal(simulationFaq((key) => faq[key] ?? "").length, SIMULATION_FAQ_COUNT);
    }
});

test("the pages are honest about what the Ark is: never a scientific model, never a game to control", () => {
    const en = words("en");
    for (const page of IDS) {
        const text = JSON.stringify(en[page]);
        assert.match(text, /not a scientific model|Not a scientific model/);
        assert.doesNotMatch(text, /scientifically accurate simulation|you control|you play/i);
    }
});

test("both pages are in the Ark's sitemap, in English and Indonesian", () => {
    assert.equal(sitemapSectionOf(`https://animaldex.app${ANIMAL_SIMULATION_PATH}`), "ark");
    assert.equal(sitemapSectionOf(`https://animaldex.app${ECOSYSTEM_SIMULATION_PATH}`), "ark");
    assert.equal(sitemapSectionOf(`https://animaldex.app/id${ANIMAL_SIMULATION_PATH}`), "id");
    const source = readFileSync(join(repoRoot, "src/lib/build-sitemap.ts"), "utf8");
    const split = source.indexOf("const staticEntries");
    for (const part of [source.slice(source.indexOf("if (locale !== localeConfig.defaultLocale)"), split), source.slice(split)]) {
        assert.match(part, /ANIMAL_SIMULATION_PATH/);
        assert.match(part, /ECOSYSTEM_SIMULATION_PATH/);
    }
});

test("the home page and /ark carry none of these pages' words (they stay visual)", () => {
    for (const file of ["src/app/[locale]/(composited)/(home)/page.tsx", "src/app/[locale]/(composited)/ark/page.tsx"]) {
        assert.doesNotMatch(readFileSync(join(repoRoot, file), "utf8"), /pages\.(animalSimulation|ecosystemSimulation)|simulation-page/);
    }
});

test("simulationFaq skips a pair a locale lacks", () => {
    const faq = simulationFaq((key) => ({q1: "A?", a1: "Yes.", q2: "B?", a2: " "} as Record<string, string>)[key] ?? "");
    assert.deepEqual(faq, [{question: "A?", answer: "Yes."}]);
});

test("the Ark's search description says what it is, in both languages, and keeps the slogan", () => {
    const seo = (locale: string) => (JSON.parse(readFileSync(join(repoRoot, `src/data/locales/${locale}.json`), "utf8")) as {ark: {seo: {metaDescription: string}}}).ark.seo.metaDescription;
    assert.match(seo("en"), /^Every animal has a lesson\. .*animal simulation/);
    assert.match(seo("id"), /^Setiap hewan punya pelajaran\. .*simulasi hewan/);
    for (const locale of ["en", "id"]) assert.ok(seo(locale).length <= META_DESCRIPTION_MAX, `${locale} is ${seo(locale).length}`);
});

test("species pages carry one small link to the animal simulation page, and no more words than that", () => {
    const section = readFileSync(join(repoRoot, "src/app/[locale]/(composited)/animals/[slug]/species-ark-section.tsx"), "utf8");
    assert.equal(section.split("href={ANIMAL_SIMULATION_PATH}").length - 1, 1);
    const label = (JSON.parse(readFileSync(join(repoRoot, "src/data/locales/en.json"), "utf8")) as {species: {inTheArk: {simulation: string}}}).species.inTheArk.simulation;
    assert.match(label, /animal simulation/);
    assert.ok(label.length <= 32, `the link is ${label.length} characters`);
});

test("the two supporting articles link to the pages they support, and say when their figures were read", async () => {
    const {animalSimulationPosts} = await import("@/data/blog/animal-simulation-posts");
    const {blogPosts} = await import("@/data/blog");
    assert.equal(animalSimulationPosts.length, 2);
    for (const post of animalSimulationPosts) {
        assert.ok(blogPosts.some((entry) => entry.slug === post.slug), `${post.slug} is published`);
        const hrefs = post.sections.flatMap((section) => (section.inlineLinks ?? []).map((link) => link.href));
        for (const path of [ANIMAL_SIMULATION_PATH, ECOSYSTEM_SIMULATION_PATH, "/ark"]) assert.ok(hrefs.includes(path), `${post.slug} links to ${path}`);
        assert.ok(`${post.title} | AnimalDex`.length <= 72, `${post.slug} title`);
        assert.ok(post.description.length <= META_DESCRIPTION_MAX, `${post.slug} description is ${post.description.length}`);
        const text = JSON.stringify(post);
        // A figure from the live Ark is dated, so it stays true after the Ark moves on.
        assert.match(text, /2[67] November 2026/);
        assert.match(text, /not nature's/);
        assert.doesNotMatch(text, /—/);
        for (const title of post.tableOfContents ?? []) assert.ok(post.sections.some((section) => section.title === title), `${post.slug} contents: ${title}`);
        for (const slug of post.relatedSlugs ?? []) assert.ok(blogPosts.some((entry) => entry.slug === slug), `${post.slug} related: ${slug}`);
    }
});
