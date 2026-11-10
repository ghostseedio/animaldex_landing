import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {parse, TYPE, type MessageFormatElement} from "@formatjs/icu-messageformat-parser";
import {ARK_BUNDLE_LANGUAGES, ARK_LANGUAGES, arkDirection, arkLanguage, arkMessagesOf, mergeArkMessages} from "./ark-languages";

const LOCALES = path.join(__dirname, "..", "data", "locales");

type Messages = Record<string, unknown>;

function readJson(file: string): Messages {
    return JSON.parse(readFileSync(file, "utf8")) as Messages;
}

function flatten(messages: Messages, prefix = ""): Map<string, unknown> {
    const out = new Map<string, unknown>();
    for (const [key, value] of Object.entries(messages)) {
        if (value && typeof value === "object") flatten(value as Messages, `${prefix}${key}.`).forEach((v, k) => out.set(k, v));
        else out.set(`${prefix}${key}`, value);
    }
    return out;
}

/** Every argument an ICU message names, plural and select ones included. */
function argumentsOf(elements: MessageFormatElement[], into = new Set<string>()): Set<string> {
    for (const element of elements) {
        if (element.type === TYPE.argument || element.type === TYPE.number || element.type === TYPE.date || element.type === TYPE.time) into.add(element.value);
        if (element.type === TYPE.plural || element.type === TYPE.select) {
            into.add(element.value);
            for (const option of Object.values(element.options)) argumentsOf(option.value, into);
        }
        if (element.type === TYPE.tag) argumentsOf(element.children, into);
    }
    return into;
}

/** `{name}` placeholders, counted (the Ark fills them with `fillArkWords`). */
function placeholders(text: string): string[] {
    return (text.match(/\{\w+\}/g) ?? []).map((match) => match.slice(1, -1)).sort();
}

const english = flatten(arkMessagesOf(readJson(path.join(LOCALES, "en.json"))));

function arkMessagesFor(language: string): Map<string, unknown> {
    const file = language === "en" || language === "id" ? path.join(LOCALES, `${language}.json`) : path.join(LOCALES, "ark", `${language}.json`);
    const messages = readJson(file);
    return flatten(language === "en" || language === "id" ? arkMessagesOf(messages) : messages);
}

test("the Ark's English: the ark namespace plus the Talk pages' Ark keys", () => {
    assert.ok(english.size >= 200, `only ${english.size} English Ark keys`);
    assert.ok(english.has("ark.replay.summary"));
    assert.ok(english.has("talkPage.arkOpen"));
    assert.ok(english.has("talkPage.animalTitleA"));
});

test("one Ark-only bundle per app language, and nothing else in the folder", () => {
    const files = readdirSync(path.join(LOCALES, "ark")).filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, "")).sort();
    assert.deepEqual(files, [...ARK_BUNDLE_LANGUAGES].sort());
    assert.equal(ARK_LANGUAGES.length, 45, "en + the apps' 44 languages");
    assert.equal(new Set(ARK_LANGUAGES).size, ARK_LANGUAGES.length);
});

for (const language of ARK_LANGUAGES.filter((code) => code !== "en")) {
    test(`${language}: every Ark key, the same placeholders as English, and ICU that parses`, () => {
        const local = arkMessagesFor(language);
        const missing = Array.from(english.keys()).filter((key) => !local.has(key));
        const extra = Array.from(local.keys()).filter((key) => !english.has(key));
        assert.deepEqual(missing, [], `${language} lacks keys`);
        assert.deepEqual(extra, [], `${language} has keys English doesn't`);
        for (const [key, source] of Array.from(english)) {
            const text = local.get(key);
            assert.equal(typeof text, "string", `${language} ${key} is not a string`);
            assert.ok((text as string).trim(), `${language} ${key} is empty`);
            assert.deepEqual(placeholders(text as string), placeholders(String(source)), `${language} ${key}: placeholders differ from English`);
            const parsedEnglish = argumentsOf(parse(String(source), {ignoreTag: true}));
            let parsed: Set<string>;
            try {
                parsed = argumentsOf(parse(text as string, {ignoreTag: true}));
            } catch (error) {
                throw new Error(`${language} ${key}: ICU does not parse (${(error as Error).message}): ${text}`);
            }
            assert.deepEqual(Array.from(parsed).sort(), Array.from(parsedEnglish).sort(), `${language} ${key}: ICU arguments differ from English`);
        }
    });
}

test("app language codes: exact, regional, script and old codes", () => {
    assert.equal(arkLanguage("ja"), "ja");
    assert.equal(arkLanguage("pt-BR"), "pt");
    assert.equal(arkLanguage("de_DE"), "de");
    assert.equal(arkLanguage("zh-Hans"), "zh-Hans");
    assert.equal(arkLanguage("zh-hant"), "zh-Hant");
    assert.equal(arkLanguage("zh-Hant-TW"), "zh-Hant");
    assert.equal(arkLanguage("zh-TW"), "zh-Hant");
    assert.equal(arkLanguage("zh_HK"), "zh-Hant");
    assert.equal(arkLanguage("zh-CN"), "zh-Hans");
    assert.equal(arkLanguage("zh"), "zh-Hans");
    assert.equal(arkLanguage("iw"), "he");
    assert.equal(arkLanguage("in-ID"), "id");
    assert.equal(arkLanguage("no"), "nb");
    assert.equal(arkLanguage("nb-NO"), "nb");
    assert.equal(arkLanguage("tl"), "fil");
    assert.equal(arkLanguage("fil-PH"), "fil");
    assert.equal(arkLanguage("en-GB"), "en");
    assert.equal(arkLanguage("xx"), null);
    assert.equal(arkLanguage(""), null);
    assert.equal(arkLanguage(null), null);
    assert.equal(arkLanguage("../../en"), null);
});

test("right to left: Arabic, Hebrew, Persian and Urdu only", () => {
    assert.deepEqual(ARK_LANGUAGES.filter((code) => arkDirection(code) === "rtl").sort(), ["ar", "fa", "he", "ur"]);
});

test("a missing or empty key falls back to English, at every depth; only English's keys come out", () => {
    const merged = mergeArkMessages(
        {ark: {title: "The Ark", hud: {show: "Who is aboard", hide: "Hide"}}, talkPage: {arkOpen: "Ark"}},
        {ark: {title: "Die Ark", hud: {show: "", stray: "x"}}, talkPage: {}}
    );
    assert.deepEqual(merged, {ark: {title: "Die Ark", hud: {show: "Who is aboard", hide: "Hide"}}, talkPage: {arkOpen: "Ark"}});
    assert.deepEqual(mergeArkMessages({ark: {title: "The Ark"}}, null), {ark: {title: "The Ark"}});
});
