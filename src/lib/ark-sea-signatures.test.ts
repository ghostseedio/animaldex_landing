import assert from "node:assert/strict";
import test from "node:test";
import data from "../../data/ark/signature-recipes-sea.json";
import lines from "@/ark-scene/signature-lines.json";
import table from "@/ark-scene/recipes.json";
import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetRecipes, speciesRecipes} from "@/ark-scene/behaviour-recipes";
import {scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {SEA_TEMPLATES} from "@/ark-scene/recipe-templates-sea";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {RECIPE_CLIPS} from "@/ark-scene/rig-player";
import {atHaulOut, haulOutKinds, haulOutLineOf} from "@/ark-scene/haul-out";
import {sceneSampler} from "@/ark-scene/world-sampler";

type Addition = {slug: string; name: string; recipe: string; field: string; quote: string; line: string};
const ADDITIONS = (data as unknown as {additions: Addition[]}).additions;
const ROWS = (table as {species: Record<string, string>}).species;
const LINES = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
const recipesOf = (slug: string) => (ROWS[slug] ?? "").split("|")[0].split(",").map((r) => r.slice(0, r.lastIndexOf(".")));

test("the sea's acts: only blocks the engine has, each with a state the rig player maps or its block's beat", () => {
    assert.equal(SEA_TEMPLATES.length, 1);
    for (const t of SEA_TEMPLATES) {
        assert.ok(TEMPLATES[t.id] === t, `${t.id} is in the table`);
        for (const step of [...t.steps, ...(t.tail ?? [])]) assert.ok(BLOCKS[step.b], `${t.id}: block ${step.b}`);
        // (Nothing is caught: the engine's meals are the server's.)
        for (const step of [...t.steps, ...(t.tail ?? [])]) assert.equal(step.catch, undefined, `${t.id}: ${step.b} catches nothing`);
    }
    // The turtle's bites play its rig's graze clip (`eat`), the same clip its schedule's own bites play.
    assert.ok(RECIPE_CLIPS.eat.clips.includes("graze"));
});

test("each row: its recipe in the table, its own line in the log's table, from its quote", () => {
    assert.equal(ADDITIONS.length, 1);
    for (const a of ADDITIONS) {
        assert.ok(recipesOf(a.slug).includes(a.recipe), `${a.slug} has ${a.recipe}`);
        assert.equal(LINES[a.slug]?.[a.recipe], a.line, `${a.slug}: its line`);
        assert.ok(a.quote.length > 20 && /^(traits|evidence|facts|story|sleep)$/.test(a.field), `${a.slug}: a quote and its field`);
    }
});

test("the engine plays them: a turtle's grazing comes up on its day, by day, with the act itself", () => {
    forgetRecipes();
    const sampler = sceneSampler();
    const world = scheduleWorld(sampler);
    // (A point of open sea off the island's coast, a few metres deep.)
    let home: {x: number; y: number; z: number} | null = null;
    for (let r = 60; r < 400 && !home; r += 8) {
        for (let a = 0; a < 32 && !home; a++) {
            const x = Math.cos((a / 32) * Math.PI * 2) * r;
            const z = Math.sin((a / 32) * Math.PI * 2) * r;
            const y = sampler.heightAt(x, z);
            if (y < -3 && y > -8) home = {x, y, z};
        }
    }
    assert.ok(home, "a stretch of sea");
    for (const [slug, recipe, block, plan] of [
        ["green-sea-turtle", "seagrass_graze", "eat", "turtle"]
    ] as const) {
        assert.ok(speciesRecipes(slug).recipes.some((r) => r.id === recipe), `${slug}: ${recipe}`);
        const profile = behaviourProfile(slug, plan);
        let episodes = 0;
        let acted = 0;
        for (let n = 0; n < 6; n++) {
            const id = `0000feed-5ea0-4000-8000-${(0x100 + n).toString(16).padStart(12, "0")}`;
            const animal: ScheduleAnimal = {id, zone: "coral_reef", home: home!, length: slug === "green-sea-turtle" ? 1 : 0.3, sea: true} as ScheduleAnimal;
            for (let k = 0; k < 120; k++) {
                const trip = tripAt(world, profile, animal, 1_795_000_000 + k * SLOT_SECONDS, () => 11, "diurnal");
                if (trip.recipe !== recipe) continue;
                const ep = tripEpisode(world, trip);
                if (!ep) continue;
                episodes++;
                if (ep.keys.some((key) => key.block.id === block)) acted++;
                // (One that found no time for it, its slot's turning budget spent on the way it sets off next, is only a
                // swim: nothing past the way there, so the log says nothing of it.)
                else assert.ok(ep.keys.every((key) => key.block.id === "swim" || key.block.id === "turn"), `${slug}: ${ep.keys.map((key) => key.block.id).join(" ")}`);
            }
        }
        assert.ok(episodes > 0, `${slug}: ${recipe} episodes`);
        assert.ok(acted / episodes > 0.5, `${slug}: ${acted} of ${episodes} episodes have the ${block} itself`);
        console.log(`${slug} ${recipe}: ${episodes} episodes in 720 day slots, ${acted} with the ${block}`);
    }
});

test("a seal's haul-out: only settled at its own roost, on dry ground, close to it; its line names no tide", () => {
    assert.deepEqual(haulOutKinds(), ["harbor-seal"]);
    const line = haulOutLineOf("harbor-seal")!;
    assert.match(line, /^\{aAnimal\} [^{}]+$/);
    assert.doesNotMatch(line, /\btide\b/i);
    assert.equal(haulOutLineOf("grey-heron"), null);
    const roost = {x: 10, z: 5};
    const dry = {x: 10.4, z: 5.2, moving: false, afloat: false, ground: 0.6, water: 0};
    assert.ok(atHaulOut(dry, roost, 1.6, "sleep"));
    assert.ok(atHaulOut(dry, roost, 1.6, "rest"));
    assert.ok(atHaulOut(dry, roost, 1.6, "bask"));
    assert.ok(atHaulOut({...dry, x: 12.3}, roost, 1.6, "bask"), "its usual spot, 2.3 m off its roost");
    assert.ok(!atHaulOut(dry, roost, 1.6, "forage"), "foraging is not hauled out");
    assert.ok(!atHaulOut({...dry, moving: true}, roost, 1.6, "rest"), "on its way");
    assert.ok(!atHaulOut({...dry, afloat: true}, roost, 1.6, "rest"), "afloat");
    assert.ok(!atHaulOut({...dry, ground: -0.2}, roost, 1.6, "rest"), "over the water");
    assert.ok(!atHaulOut({...dry, x: 14}, roost, 1.6, "rest"), "away from its own spot");
});
