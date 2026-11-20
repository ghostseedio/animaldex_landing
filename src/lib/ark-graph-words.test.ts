import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ARK_GRAPH_ENGLISH, arkGraphWords} from "@/lib/ark-graph-words";
import {ARK_LANGUAGES} from "@/lib/ark-languages";

const LOCALES = path.join(__dirname, "..", "data", "locales");
const read = (language: string) =>
    (JSON.parse(readFileSync(language === "en" || language === "id" ? path.join(LOCALES, `${language}.json`) : path.join(LOCALES, "ark", `${language}.json`), "utf8")) as {ark: {graph: Record<string, unknown>}}).ark.graph;

/** `{periods: {"24h": "x"}}` as `{"periods.24h": "x"}`. */
function flat(value: Record<string, unknown>, prefix = ""): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, one] of Object.entries(value)) {
        if (one && typeof one === "object") Object.assign(out, flat(one as Record<string, unknown>, `${prefix}${key}.`));
        else out[`${prefix}${key}`] = String(one);
    }
    return out;
}

const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

test("the graphs' words: the site's English file IS the module's English (the fallback and the file cannot drift)", () => {
    assert.deepEqual(read("en"), ARK_GRAPH_ENGLISH);
});

test("the graphs' words: every one of the 45 Ark languages has every key, filled the same way as English, in its own words", () => {
    const english = flat(ARK_GRAPH_ENGLISH);
    assert.equal(ARK_LANGUAGES.length, 45);
    assert.equal(Object.keys(english).length, 33, "25 lines, 4 periods and their 4 short forms");
    for (const language of ARK_LANGUAGES) {
        const own = flat(read(language));
        assert.deepEqual(Object.keys(own).sort(), Object.keys(english).sort(), language);
        for (const [key, text] of Object.entries(english)) {
            assert.ok(own[key]?.trim(), `${language}.${key} is empty`);
            assert.deepEqual(holes(own[key]), holes(text), `${language}.${key}: placeholders differ`);
            assert.ok(!/[—]/.test(own[key]), `${language}.${key}: a dash as punctuation`);
            if (!/[–]/.test(text)) assert.ok(!/[–]/.test(own[key]), `${language}.${key}: a dash as punctuation`);
            // "24 h" and "7 d" read the same in a few languages; nothing else may be left in English.
            if (language !== "en" && !key.startsWith("periods")) assert.notEqual(own[key], text, `${language}.${key} is still English`);
        }
        // The count sits in its line, so a language can put it where its grammar wants it.
        for (const key of ["arrived", "born", "revived", "died", "eaten"]) assert.ok(own[key].includes("{count}"), `${language}.${key}`);
        // One word for one thing: no two switches, orders or periods read the same.
        const distinct = (keys: string[]) => new Set(keys.map((key) => own[key])).size === keys.length;
        assert.ok(distinct(["periods.24h", "periods.7d", "periods.30d", "periods.all"]), `${language}: periods repeat`);
        assert.ok(distinct(["periodsShort.24h", "periodsShort.7d", "periodsShort.30d", "periodsShort.all"]), `${language}: short periods repeat`);
        assert.ok(distinct(["biggest", "thriving", "declining"]), `${language}: orders repeat`);
        assert.ok(distinct(["now", "change", "peak", "low"]), `${language}: the four figures repeat`);
    }
});

test("the graphs' words: English key by key where a bundle lacks one, a blank or a wrong type", () => {
    assert.deepEqual(arkGraphWords(null), ARK_GRAPH_ENGLISH);
    assert.deepEqual(arkGraphWords(undefined), ARK_GRAPH_ENGLISH);
    const mixed = arkGraphWords({born: "{count} geboren", biggest: "   ", back: 7, periods: {"7d": "7 Tage", all: ""}});
    assert.equal(mixed.born, "{count} geboren");
    assert.equal(mixed.biggest, "Biggest");
    assert.equal(mixed.back, "All species");
    assert.equal(mixed.periods["7d"], "7 Tage");
    assert.equal(mixed.periods.all, "All");
    assert.equal(mixed.periodsShort["7d"], "7d");
});

test("the graphs' words: /ark's HUD holds only the provider; the English and the graph pieces load with the lazy import", () => {
    const root = path.join(__dirname, "..");
    const hud = readFileSync(path.join(root, "app/[locale]/(composited)/ark/ark-population-hud.tsx"), "utf8");
    const staticImport = /^import (?!type)[^;]*from "@\/(lib\/ark-graph-words|lib\/ark-population-history|app\/\[locale\]\/\(composited\)\/ark\/ark-population-graph)";/m;
    assert.ok(!staticImport.test(hud), "the HUD imports the graph's code or English statically");
    assert.match(hud, /import\("@\/app\/\[locale\]\/\(composited\)\/ark\/ark-population-graph"\)/);
    assert.match(hud, /ArkGraphWordsContext\.Provider value=\{words\.graph\}/);
    const context = readFileSync(path.join(root, "app/[locale]/(composited)/ark/ark-graph-context.ts"), "utf8");
    assert.ok(!/ARK_GRAPH_ENGLISH|ark-graph-words"/.test(context.replace(/import type[^;]*;/g, "")), "the context module carries no English");
});
