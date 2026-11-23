import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {ARK_RECIPE_STATES, BLOCKS} from "@/ark-scene/behaviour-blocks";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {nestStageAt, speciesRecipes} from "@/ark-scene/behaviour-recipes";
import {sleepStyle} from "@/ark-scene/sleep";
import {signatureLineOf} from "@/ark-scene/live/signature-lines";
import {isHeld, putHeldRowsBack} from "@/lib/ark-signature-held-rows";

// (Rows held after their frames were looked at: their mechanism is checked with them put back, `ark-signature-held-rows.ts`.)
putHeldRowsBack();

type Row = {slug: string; recipe: string; was?: string; nest?: string; field?: string; quote?: string};
const rows = (JSON.parse(readFileSync(path.join(__dirname, "..", "..", "data", "ark", "signature-recipes.json"), "utf8")) as {additions: Row[]}).additions;
// The mammals' held rows (sig2): the 23 species the wave-1 script held back for their body plan (quadruped, primate, bat).
const HELD = new Set(["barbary-macaque", "bolivian-squirrel-monkey", "capybara", "collared-peccary", "common-marmoset", "coppery-titi-monkey", "desert-cottontail", "domestic-pig", "domestic-sheep", "eastern-gray-squirrel", "guinea-pig", "javan-ferret-badger", "kuhls-pipistrelle-bat", "long-tailed-macaque", "malaysian-field-rat", "platypus", "red-river-hog", "red-squirrel", "ring-tailed-lemur", "stump-tailed-macaque", "sugar-glider", "tufted-capuchin", "zebu"]);
const WAS = new Set(["cluster", "nest_build", "worm_pull", "shell_tool", "incubate_sit"]);
const mammals = rows.filter((r) => HELD.has(r.slug) && (r.was ? WAS.has(r.was) : r.recipe === "nest_build"));

test("sig2 mammals: the stone hammer and the worm dig are templates of blocks the engine has, and the pound reuses a clip state", () => {
    for (const id of ["stone_hammer", "worm_dig"]) {
        const t = TEMPLATES[id];
        assert.ok(t, id);
        assert.equal(t.kind, "stay");
        for (const step of [...t.steps, ...(t.tail ?? [])]) assert.ok(BLOCKS[step.b], `${id}: ${step.b}`);
    }
    assert.equal(BLOCKS.pound.motion, "hold");
    for (const state of BLOCKS.pound.states) assert.ok(ARK_RECIPE_STATES.includes(state));
    // (The stone is picked up, carried in the hands against the chest, pounded and put down.)
    const hammer = TEMPLATES.stone_hammer.steps;
    assert.ok(hammer.some((s) => s.pick === "stone" && s.carry === "chest"));
    assert.ok(hammer.some((s) => s.b === "pound") && hammer.some((s) => s.drop));
    assert.ok(TEMPLATES.worm_dig.steps.some((s) => s.catch === "worm"));
});

test("sig2 mammals: every held mammal row is shown by something the scene has: a recipe of the table, or how the kind sleeps", () => {
    assert.ok(mammals.length >= 25, `${mammals.length} rows`);
    const table = (JSON.parse(readFileSync(path.join(__dirname, "..", "ark-scene", "recipes.json"), "utf8")) as {species: Record<string, string>}).species;
    for (const r of mammals) {
        // (Held after its frames were looked at, `data/ark/signature-holds.json`: not in the table, nothing to show.)
        if (isHeld(r.slug, r.recipe)) continue;
        if (r.recipe.startsWith("sleep:")) {
            // How it sleeps with its kind: from the row's own sentence, and the sleep layer has it.
            assert.equal(sleepStyle(r.slug).social, r.recipe.slice("sleep:".length), `${r.slug} sleeps ${r.recipe}`);
            assert.ok(r.quote && r.field, `${r.slug}: its sentence`);
        } else {
            const has = new Set((table[r.slug] ?? "").split("|")[0].split(",").map((x) => x.slice(0, x.lastIndexOf("."))));
            assert.ok(has.has(r.recipe), `${r.slug} has ${r.recipe}`);
            assert.ok(TEMPLATES[r.recipe], `${r.slug}: ${r.recipe} is a template`);
        }
    }
});

test("sig2 mammals: the huddles are the sleep layer's (a recipe `cluster` is the insects' crawling cluster), and no mammal row asks for it", () => {
    assert.ok(!mammals.some((r) => r.recipe === "cluster"));
    for (const slug of ["zebu", "capybara", "domestic-sheep"]) assert.equal(sleepStyle(slug).social, "huddle", slug);
    // (SIG3: a huddling group sleeps at its leader's roost, so the tree sleepers' and the guinea pigs' frames read; the
    // sugar glider's text names no sleeping together, the marmosets sit inside the wood, the bat's colony is not seen.)
    // (SIG3 tranche 3: the long-tailed macaques, side by side across their branch now that a huddle faces one way.)
    for (const slug of ["ring-tailed-lemur", "tufted-capuchin", "guinea-pig", "collared-peccary", "long-tailed-macaque"]) {
        assert.ok(!isHeld(slug, "sleep:huddle"), slug);
        assert.equal(sleepStyle(slug).social, "huddle", slug);
    }
    for (const slug of ["sugar-glider", "common-marmoset", "barbary-macaque"]) assert.ok(isHeld(slug, "sleep:huddle"), slug);
    // (A held huddle is switched off in the sleep layer too: each sleeps a little apart until it reads.)
    for (const slug of ["common-marmoset", "barbary-macaque"]) assert.equal(sleepStyle(slug).social, "apart", slug);
    assert.ok(isHeld("kuhls-pipistrelle-bat", "sleep:cluster"));
    assert.equal(sleepStyle("domestic-pig").social, "pile");
    // (A kind with no word for it keeps sleeping a little apart.)
    assert.equal(sleepStyle("red-deer").social, "apart");
});

test("sig2 mammals: a nest of their own: all five held after their frames (no episode, or no nest that reads); a bird's nest the props draw is unchanged", () => {
    for (const slug of ["eastern-gray-squirrel", "red-squirrel", "desert-cottontail", "malaysian-field-rat", "red-river-hog"]) {
        assert.ok(isHeld(slug, "nest_build"), slug);
        assert.ok(!signatureLineOf(slug, "nest_build"), `${slug}: no sentence`);
    }
    assert.equal(speciesRecipes("house-sparrow").ownNest, false);
    void nestStageAt;
});

test("sig2 mammals: their own sentences in the log, for the recipes the scene shows (not the night nests)", () => {
    // (All four held after their frames: the log keeps quiet until they are shown.)
    for (const [slug, recipe] of [["tufted-capuchin", "stone_hammer"], ["long-tailed-macaque", "stone_hammer"], ["javan-ferret-badger", "worm_dig"], ["eastern-gray-squirrel", "nest_build"]]) {
        assert.ok(isHeld(slug, recipe), `${slug} ${recipe}`);
        assert.ok(!signatureLineOf(slug, recipe), `${slug} ${recipe}`);
    }
});
