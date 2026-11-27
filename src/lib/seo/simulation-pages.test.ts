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
