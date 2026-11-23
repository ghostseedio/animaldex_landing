import assert from "node:assert/strict";
import test from "node:test";
import data from "../../data/ark/signature-recipes-other.json";
import lines from "@/ark-scene/signature-lines.json";
import table from "@/ark-scene/recipes.json";
import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetRecipes, sexLook, speciesRecipes} from "@/ark-scene/behaviour-recipes";
import {scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {sceneSampler} from "@/ark-scene/world-sampler";
import type {ArkZone} from "@/ark-scene/types";
import {isHeld, putHeldRowsBack} from "@/lib/ark-signature-held-rows";

// (Rows held after their frames were looked at: their mechanism is checked with them put back, `ark-signature-held-rows.ts`.)
putHeldRowsBack();

type Add = {slug: string; name: string; recipe: string; behaviour: string; quote: string; id: string};
const ADDITIONS = (data as unknown as {additions: Add[]}).additions;
const ROWS = (table as {species: Record<string, string>}).species;
const LINES = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
const recipesOf = (slug: string) => (ROWS[slug] ?? "").split("|")[0].split(",").map((r) => r.slice(0, r.lastIndexOf(".")));

test("the data: each species has the recipe its own catalogue row says, with the row's quote and a sentence of what is drawn", () => {
    assert.equal(ADDITIONS.length, 19);
    const by = (recipe: string) => ADDITIONS.filter((a) => a.recipe === recipe).map((a) => a.slug);
    assert.equal(by("sally_chase").length, 12);
    assert.equal(by("patrol_low").length, 4);
    assert.deepEqual(by("display_flight").sort(), ["common-wood-pigeon", "eurasian-collared-dove", "spotted-dove"]);
    for (const a of ADDITIONS) {
        assert.match(a.id, /^[0-9a-f-]{36}$/, a.slug);
        assert.ok(a.quote.length > 20, a.slug);
        assert.ok(recipesOf(a.slug).includes(a.recipe), `${a.slug} has ${a.recipe}`);
        const line = LINES[a.slug]?.[a.recipe];
        if (isHeld(a.slug, a.recipe)) assert.equal(line, undefined, `${a.slug}: held, no sentence`);
        else assert.ok(line && /^\{aAnimal\} /.test(line), `${a.slug}: its sentence`);
    }
    // No other species has any of the three.
    for (const slug of Object.keys(ROWS)) for (const recipe of ["sally_chase", "patrol_low", "display_flight"]) if (recipesOf(slug).includes(recipe)) assert.ok(ADDITIONS.some((a) => a.slug === slug && a.recipe === recipe), `${slug} ${recipe}`);
    // The rows held back are named, with why.
    const held = (data as unknown as {held: Record<string, string>}).held;
    assert.ok(Object.keys(held).length >= 5);
    for (const why of Object.values(held)) assert.ok(why.length > 20);
});

test("the templates: a male's, by day, made of blocks the scene has; a display only in the breeding months", () => {
    for (const id of ["sally_chase", "patrol_low", "display_flight"]) {
        const t = TEMPLATES[id];
        assert.equal(t.sex, "male", id);
        assert.equal(t.hours, "day", id);
        for (const step of t.steps) assert.ok(BLOCKS[step.b], `${id}: ${step.b}`);
    }
    assert.equal(TEMPLATES.display_flight.season, "mating");
    assert.deepEqual(TEMPLATES.sally_chase.steps.map((s) => s.b), ["perch", "take_off", "fly", "fly", "fly"]);
    assert.equal(TEMPLATES.sally_chase.steps[1].h, 0.5);
    // (SIG3: the climb and the glide over the treetops, `sky`: from a perch in a wood, open air under the crowns was never in reach.)
    assert.deepEqual(TEMPLATES.display_flight.steps.map((s) => s.b), ["perch", "take_off", "fly", "fly", "fly"]);
    assert.deepEqual(TEMPLATES.display_flight.steps.map((s) => s.to), [undefined, "up", "sky", "sky", "anchor"]);
    assert.ok((TEMPLATES.display_flight.steps[2].h ?? 0) >= 6, "a steep climb over the crowns");
    assert.ok(TEMPLATES.display_flight.airTurns);
    for (const slug of ["common-wood-pigeon", "eurasian-collared-dove", "spotted-dove"]) assert.ok(!isHeld(slug, "display_flight"), slug);
    assert.ok(BLOCKS.take_off.aloft && BLOCKS.take_off.curve === "rise");
});

test("on the schedule: a male of each kind takes its recipe now and then and flies out and back; a female never", () => {
    forgetRecipes();
    const world = scheduleWorld(sceneSampler());
    const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    const check = (slug: string, recipe: string, zone: ArkZone, month: number, length: number) => {
        const profile = behaviourProfile(slug);
        assert.ok(speciesRecipes(slug).recipes.some((r) => r.id === recipe), `${slug} has ${recipe}`);
        const ids = Array.from({length: 40}, (_, i) => `${slug}-${i}`);
        const males = ids.filter((id) => sexLook(id, slug).sex === "male");
        const females = ids.filter((id) => sexLook(id, slug).sex === "female");
        assert.ok(males.length >= 5 && females.length >= 5, `${slug}: sexes`);
        const homes = [{x: -70, z: 22}, {x: -62, z: 30}, {x: -76, z: 14}, {x: 10, z: 10}, {x: 30, z: -20}];
        const from = Math.floor(Date.UTC(2026, month, 14, 6) / 1000);
        const tripsOf = (id: string, i: number) => {
            const home = homes[i % homes.length];
            const animal: ScheduleAnimal = {id, zone, home: {x: home.x, y: Math.max(world.sampler.heightAt(home.x, home.z), 0), z: home.z}, length, sea: false};
            const out = [];
            for (let t = from; t < from + 14 * 3600; t += SLOT_SECONDS) out.push(tripAt(world, profile, animal, t, hoursAt, "diurnal"));
            return out;
        };
        let taken = 0;
        let flown = 0;
        males.forEach((id, i) => {
            for (const trip of tripsOf(id, i)) {
                // (A recipe with a goal of its own is chosen for the trip; a "here" one is laid over a stay where it already is.)
                const episode = tripEpisode(world, trip);
                if (episode?.recipe !== recipe) continue;
                taken++;
                const blocks = episode.keys.map((k) => k.block.id);
                if (blocks.includes("fly") && (recipe === "patrol_low" || blocks.includes("take_off"))) flown++;
            }
        });
        for (const [i, id] of Array.from(females.entries())) assert.ok(tripsOf(id, i).every((t) => tripEpisode(world, t)?.recipe !== recipe), `${slug}: a female never ${recipe}`);
        return {taken, flown};
    };
    const sally = check("scarlet-skimmer", "sally_chase", "river_lake", 5, 0.05);
    assert.ok(sally.taken >= 3 && sally.flown >= 1, `sally ${JSON.stringify(sally)}`);
    const patrol = check("fox-moth", "patrol_low", "grassland", 5, 0.04);
    assert.ok(patrol.taken >= 3 && patrol.flown >= 3, `patrol ${JSON.stringify(patrol)}`);
    // (The pigeon's display is in its breeding months only; with none stored, a little all year.)
    const display = check("common-wood-pigeon", "display_flight", "woodland", 4, 0.4);
    assert.ok(display.taken >= 1, `display ${JSON.stringify(display)}`);
});
