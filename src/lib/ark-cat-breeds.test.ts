/**
 * The cat breeds aboard as species of their own take the domestic cat's row, sleep row and sentences, less the acts on
 * clips their rigs lack (SPECIES-ANIM-B2, 2026-11-24: `coats` in data/ark/signature-recipes-species-anim-b2.json, as
 * SIG7's coat variants). Fails when the cat's row moves on and the script was not re-run.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), f), "utf8"));
const coats = read("data/ark/signature-recipes-species-anim-b2.json").coats as {of: string; without: string[]; slugs: string[]; over: boolean};
const recipes = read("src/ark-scene/recipes.json").species as Record<string, string>;
const sleep = read("src/ark-scene/sleep.json").species as Record<string, string>;
const lines = read("src/ark-scene/signature-lines.json").species as Record<string, Record<string, unknown>>;

test("cat breeds: each takes the domestic cat's row less the scrape, the knead and the stretch; the loaf comes in", () => {
    assert.equal(coats.slugs.length, 18);
    const [acts, ...rest] = recipes[coats.of].split("|");
    const want = [acts.split(",").filter((r) => !coats.without.includes(r.slice(0, r.lastIndexOf(".")))).join(","), ...rest].join("|");
    assert.match(want, /bask_sun~loaf\./);
    for (const slug of coats.slugs) {
        assert.equal(recipes[slug], want, slug);
        for (const gone of coats.without) assert.ok(!recipes[slug].includes(`${gone}.`), `${slug} has no ${gone}`);
    }
});

test("cat breeds: the cat's sleep row and its sentences, less the left-out acts'", () => {
    const own = Object.keys(lines[coats.of] ?? {}).filter((r) => !coats.without.includes(r)).sort();
    for (const slug of coats.slugs) {
        assert.equal(sleep[slug], sleep[coats.of], slug);
        assert.deepEqual(Object.keys(lines[slug] ?? {}).sort(), own, slug);
    }
});
