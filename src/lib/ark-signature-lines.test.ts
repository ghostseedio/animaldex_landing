import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {signatureItems, signatureLineOf, signatureText} from "@/ark-scene/live/signature-lines";
import {ArkSeenMemory, arkSeenItems, type ArkLiveText, type ArkSeenAct} from "./ark-live-log";
import lines from "@/ark-scene/signature-lines.json";
import recipes from "@/ark-scene/recipes.json";

const english = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "en.json"), "utf8")).ark as ArkLiveText;
const act = (over: Partial<ArkSeenAct>): ArkSeenAct => ({id: "a1", name: "Grey Heron", speciesId: "heron", zone: "wetland", recipe: "wade_spear", episode: "ep1", block: "strike", fish: false, ...over});

test("a species' own sentence is said once per episode, once the recipe is past the way there, never the generic line too", () => {
    const line = signatureLineOf("grey-heron", "wade_spear")!;
    assert.ok(line.startsWith("{aAnimal} "));
    const memory = new ArkSeenMemory();
    assert.equal(signatureItems([act({line, block: "wade"})], memory).length, 0, "still on its way");
    const items = signatureItems([act({line})], memory);
    assert.equal(items.length, 1);
    assert.equal(signatureText(items[0], english), `A Grey Heron ${line.slice("{aAnimal} ".length)}`);
    assert.equal(signatureItems([act({line})], memory).length, 0, "once");
    assert.equal(arkSeenItems({acts: [act({fish: true})], alarms: []}, memory).length, 0, "the generic fishing line is not said for that episode");
    assert.equal(signatureText({animal: "Grey Heron"}, english), null);
});

test("several of a kind: the plural name", () => {
    assert.equal(signatureText({animal: "House Sparrow", line: "{animals} are bathing together in the dust"}, english), "House Sparrows are bathing together in the dust");
});

test("the table: every line is for a recipe its species has, starts with its placeholder once, and names no sex, life stage or season", () => {
    const table = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
    const rows = (recipes as unknown as {species: Record<string, string>}).species;
    let n = 0;
    for (const [slug, own] of Object.entries(table)) {
        const has = new Set((rows[slug] ?? "").split("|")[0].split(",").map((r) => r.slice(0, r.lastIndexOf("."))));
        for (const [recipe, line] of Object.entries(own)) {
            n++;
            assert.ok(has.has(recipe), `${slug} has no ${recipe}`);
            assert.match(line, /^\{(aAnimal|animals)\} [^{}]+$/, `${slug} ${recipe}`);
            assert.ok(!line.endsWith("."), `${slug} ${recipe}`);
            assert.doesNotMatch(line, /\b(male|female|his|her|cub|chick|tadpole|caterpillar|winter|spring|summer|autumn)\b/i, `${slug} ${recipe}: ${line}`);
        }
    }
    assert.ok(n >= 150, `${n} lines`);
});
