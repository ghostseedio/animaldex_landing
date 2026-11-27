import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {parse, TYPE, type MessageFormatElement} from "@formatjs/icu-messageformat-parser";
import {APP_SHELL_WORDS_EN} from "./app-shell-words";
import {SETTINGS_WORDS_EN} from "./settings-words";

/**
 * The site's two locale files stay in step: every English string has an
 * Indonesian one, non-empty, naming the same ICU arguments. Arrays (meta
 * keywords) are lists of their own per language, so only their presence is
 * checked. The Ark's 43 other languages have their own test (ark-languages).
 */

const LOCALES = path.join(__dirname, "..", "data", "locales");
type Messages = Record<string, unknown>;

function readJson(file: string): Messages {
    return JSON.parse(readFileSync(path.join(LOCALES, file), "utf8")) as Messages;
}

function flatten(messages: Messages, prefix = "", out = new Map<string, unknown>()): Map<string, unknown> {
    for (const [key, value] of Object.entries(messages)) {
        if (value && typeof value === "object" && !Array.isArray(value)) flatten(value as Messages, `${prefix}${key}.`, out);
        else out.set(`${prefix}${key}`, value);
    }
    return out;
}

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

function icuArguments(text: string): string[] | null {
    try {
        return Array.from(argumentsOf(parse(text, {ignoreTag: true}))).sort();
    } catch {
        return null;
    }
}

const english = flatten(readJson("en.json"));
const indonesian = flatten(readJson("id.json"));

test("id.json has every key en.json has", () => {
    const missing = Array.from(english.keys()).filter((key) => !indonesian.has(key));
    assert.deepEqual(missing, [], `id.json lacks ${missing.length} keys`);
});

test("every Indonesian string is a non-empty string where English has one, with the same ICU arguments", () => {
    const problems: string[] = [];
    for (const [key, source] of Array.from(english)) {
        const text = indonesian.get(key);
        if (Array.isArray(source)) {
            if (!Array.isArray(text)) problems.push(`${key}: not a list`);
            continue;
        }
        // An empty English string is a deliberate blank (a line switched off); Indonesian may stay blank too.
        if (typeof source !== "string" || !source.trim()) continue;
        if (typeof text !== "string" || !text.trim()) {
            problems.push(`${key}: empty or not a string`);
            continue;
        }
        const want = icuArguments(source);
        if (!want) continue;
        const got = icuArguments(text);
        if (!got) problems.push(`${key}: ICU does not parse: ${text}`);
        else if (want.join(",") !== got.join(",")) problems.push(`${key}: arguments {${got.join(", ")}} differ from English {${want.join(", ")}}`);
    }
    assert.deepEqual(problems, []);
});

test("the app shell's and Settings' English live in code and en.json alike", () => {
    const shell = (readJson("en.json").appShell ?? {}) as Messages;
    assert.deepEqual(Object.keys(APP_SHELL_WORDS_EN).filter((key) => !(key in shell)), [], "en.json appShell lacks keys");
    for (const [key, value] of Object.entries(APP_SHELL_WORDS_EN)) assert.equal(shell[key], value, `appShell.${key}`);
    const settings = (readJson("en.json").appSettings ?? {}) as Messages;
    assert.deepEqual(settings, SETTINGS_WORDS_EN);
});

test("each Ark bundle is translated, not English carried over (a few cognates and brand names may match)", () => {
    const ark = (messages: Messages) => {
        const talk = (messages.talkPage ?? {}) as Messages;
        return flatten({
            ark: messages.ark ?? {},
            talkPage: Object.fromEntries(Object.entries(talk).filter(([key]) => key.startsWith("ark") || key === "animalTitleA" || key === "animalTitleAn")),
            companions: {ark: ((messages.companions ?? {}) as Messages).ark ?? {}},
            home: {ark: ((messages.home ?? {}) as Messages).ark ?? {}}
        });
    };
    const source = ark(readJson("en.json"));
    const wordy = (value: unknown) => typeof value === "string" && /[A-Za-z]{4,}/.test(value.replace(/\{[^}]*\}/g, ""));
    for (const file of readdirSync(path.join(LOCALES, "ark")).filter((name) => name.endsWith(".json"))) {
        const local = ark(readJson(path.join("ark", file)));
        const same = Array.from(source).filter(([key, value]) => wordy(value) && local.get(key) === value).map(([key]) => key);
        assert.ok(same.length <= 25, `${file}: ${same.length} Ark strings are still the English: ${same.slice(0, 10).join(", ")}`);
    }
});
