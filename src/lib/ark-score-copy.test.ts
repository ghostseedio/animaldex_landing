import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {ARK_COPY} from "./companion-bond";
import en from "../data/locales/en.json";

/**
 * The Ark Score's words are true with `ark_score_v4` off (today's score, which only
 * goes up) and on (a kind over its limit costs its bringers a point a day): no line
 * says the score never goes down, in English or in any language.
 */
const LOCALES = join(__dirname, "..", "data", "locales");

type Words = Record<string, any>;

/** The six lines, by where each one lives in a locale file. */
const lines = (words: Words) => ({
    scoreAbout: words.companions.ark.scoreAbout as string,
    scoreAboutTheirs: words.companions.ark.scoreAboutTheirs as string,
    scoreHint: words.companions.ark.scoreHint as string,
    explainBody: words.companions.ark.explainBody as string,
    personAbout: words.ark.person.scoreAbout as string,
    personAboutSelf: words.ark.person.scoreAboutSelf as string
});

const PROMISE = /never goes down|only ever goes up|never lower|can only go up/i;

test("English: no Ark Score line promises it never goes down, and the app's defaults match the locale file", () => {
    const english = lines(en as Words);
    for (const [name, text] of Object.entries(english)) {
        assert.doesNotMatch(text, PROMISE, name);
    }
    assert.equal(ARK_COPY.scoreAbout, english.scoreAbout);
    assert.equal(ARK_COPY.scoreAboutTheirs, english.scoreAboutTheirs);
    assert.equal(ARK_COPY.scoreHint, english.scoreHint);
    assert.equal(ARK_COPY.explainBody, english.explainBody);
    assert.equal(english.personAboutSelf, english.scoreAbout);
    assert.equal(english.personAbout, english.scoreAboutTheirs);
    assert.equal(english.scoreAbout, "Your Ark Score grows when the kinds you helped bring aboard do well.");
    assert.ok(english.explainBody.startsWith(english.scoreAbout));
});

test("every language has the new lines, in its own words, with the explainer opening on the first", () => {
    const english = lines(en as Words);
    const files = ["id.json", ...readdirSync(join(LOCALES, "ark")).map((file) => join("ark", file))];
    assert.equal(files.length, 44);
    for (const file of files) {
        const words = JSON.parse(readFileSync(join(LOCALES, file), "utf8")) as Words;
        const own = lines(words);
        for (const [name, text] of Object.entries(own)) {
            assert.equal(typeof text, "string", `${file} ${name}`);
            assert.notEqual(text, (english as Record<string, string>)[name], `${file} ${name} is still English`);
        }
        assert.ok(own.explainBody.startsWith(own.scoreAbout), `${file}: the explainer opens on the first line`);
        assert.equal(own.personAboutSelf, own.scoreAbout, file);
        assert.equal(own.personAbout, own.scoreAboutTheirs, file);
    }
});
