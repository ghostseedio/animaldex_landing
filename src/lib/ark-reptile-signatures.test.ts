import assert from "node:assert/strict";
import test from "node:test";
import data from "../../data/ark/signature-recipes-reptiles.json";
import lines from "@/ark-scene/signature-lines.json";
import table from "@/ark-scene/recipes.json";
import micro from "@/ark-scene/micro-ambush.json";
import base from "@/ark-scene/grounding/model-base.json";
import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetRecipes, sexLook, speciesRecipes, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {poseOnTrip, scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {AMBUSH_RECIPE, DASH, EAT, STRIKE, TURN, ambushBouts, ambushHours, ambushNow, boutOf, inAmbushHours, type AmbushPoint} from "@/ark-scene/micro-ambush";
import {REPTILE_TEMPLATES, recipeBase} from "@/ark-scene/recipe-templates-reptiles";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {isHeld, putHeldRowsBack} from "@/lib/ark-signature-held-rows";

// (Rows held after their frames were looked at: their mechanism is checked with them put back, `ark-signature-held-rows.ts`.)
putHeldRowsBack();

type Addition = {slug: string; name: string; recipe: string; behaviour: string; field: string; quote: string; nest?: string; micro?: "night" | "day"};
const ADDITIONS = (data as unknown as {additions: Addition[]}).additions;
const HELD = (data as unknown as {held: Array<{slug: string; recipe: string; reason: string}>}).held;
const ROWS = (table as {species: Record<string, string>}).species;
const LINES = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
const PLAN_OF = (slug: string) => {
    const row = (base as unknown as {models: Record<string, Array<unknown>>}).models[slug];
    return row ? (row[row.length - 1] as string) : null;
};
const recipesOf = (slug: string) => (ROWS[slug] ?? "").split("|")[0].split(",").map((r) => r.slice(0, r.lastIndexOf(".")));

test("the variants: every block they use the engine has, each named for a plain recipe the card knows", () => {
    assert.equal(REPTILE_TEMPLATES.length, 7);
    for (const t of REPTILE_TEMPLATES) {
        assert.ok(TEMPLATES[t.id] === t, `${t.id} is in the table`);
        assert.ok(t.id.includes("~"), `${t.id} is a variant`);
        assert.ok(TEMPLATES[recipeBase(t.id)], `${t.id}: its plain recipe ${recipeBase(t.id)} exists`);
        for (const step of [...t.steps, ...(t.tail ?? [])]) assert.ok(BLOCKS[step.b], `${t.id}: block ${step.b}`);
    }
    assert.equal(recipeBase("pounce~lizard"), "pounce");
    assert.equal(recipeBase("pounce"), "pounce");
    // A nest the text names no month for is dug and guarded a little all year; the others never out of season.
    assert.equal(TEMPLATES["dig_burrow~nest"].unstored, 0.3);
    assert.equal(TEMPLATES["incubate_sit~reptile"].unstored, 0.3);
    assert.equal(TEMPLATES["beach_nest~bank"].unstored, undefined);
});

test("each row: a species whose model is a reptile or a turtle, the catalogue's own quote, the recipe in its row, its sentence", () => {
    assert.ok(ADDITIONS.length >= 20, `${ADDITIONS.length} rows`);
    for (const a of ADDITIONS) {
        assert.ok(["reptile", "turtle"].includes(PLAN_OF(a.slug) ?? ""), `${a.slug}: model plan ${PLAN_OF(a.slug)}`);
        assert.ok(a.quote.length > 10 && a.behaviour.length > 5 && a.field, `${a.slug}: sourced`);
        assert.ok(TEMPLATES[a.recipe], `${a.slug}: template ${a.recipe}`);
        assert.ok(recipesOf(a.slug).includes(a.recipe), `${a.slug}: its row has ${a.recipe}`);
        if (isHeld(a.slug, a.recipe)) {
            // (Held after its frames were looked at: the log never tells it.)
            assert.equal(LINES[a.slug]?.[a.recipe], undefined, `${a.slug}: held, no sentence`);
            continue;
        }
        const line = LINES[a.slug]?.[a.recipe];
        assert.ok(line && line.startsWith("{aAnimal} is "), `${a.slug}: sentence ${line}`);
        // The log's table names no sex.
        assert.ok(!/\b(her|his|she|he)\b/i.test(line), `${a.slug}: no sex in "${line}"`);
        // (A nest guard's site: its row's nest field.)
        if (a.nest) assert.equal((ROWS[a.slug] ?? "").split("|")[4], a.nest, `${a.slug}: nest field`);
    }
    // Two rows stay held, each with its reason.
    assert.deepEqual(HELD.map((h) => h.slug).sort(), ["southeastern-five-lined-skink", "tokay-gecko"]);
    for (const h of HELD) assert.ok(h.reason.length > 40 && !recipesOf(h.slug).includes(h.recipe), `${h.slug}: held`);
});

test("nest variants are a female's, in her season, and the plans they were written for", () => {
    for (const id of ["dig_burrow~nest", "beach_nest~bank", "incubate_sit~reptile"]) {
        assert.equal(TEMPLATES[id].sex, "female", id);
        assert.equal(TEMPLATES[id].season, "nesting", id);
    }
    for (const a of ADDITIONS.filter((x) => x.recipe === "dig_burrow~nest" || x.recipe === "wallow~turtle" || x.recipe === "probe_feed~turtle")) assert.equal(PLAN_OF(a.slug), "turtle", a.slug);
    for (const a of ADDITIONS.filter((x) => x.recipe === "beach_nest~bank" || x.recipe === "incubate_sit~reptile" || x.recipe === "pounce~lizard")) assert.equal(PLAN_OF(a.slug), "reptile", a.slug);
});

test("a nest guarded: a female with no months stored for it still guards one a little all year; a male never does", () => {
    forgetRecipes();
    const sampler = sceneSampler();
    const world = scheduleWorld(sampler);
    const slug = "siamese-crocodile";
    const profile = behaviourProfile(slug, "reptile");
    assert.ok(speciesRecipes(slug).recipes.some((r) => r.id === "incubate_sit~reptile"));
    assert.equal(speciesRecipes(slug).nesting.length, 0, "no months stored");
    const home = {x: 20, y: 0, z: -8};
    const found = new Map<string, number>();
    let episodes = 0;
    let lying = 0;
    for (let n = 0; n < 24; n++) {
        const id = `0000feed-0000-4000-8000-${(0x700 + n).toString(16).padStart(12, "0")}`;
        const animal: ScheduleAnimal = {id, zone: "river_lake", home: {...home, y: sampler.heightAt(home.x, home.z)}, length: 3, sea: false} as ScheduleAnimal;
        const sex = sexLook(id, slug).sex ?? "none";
        for (let k = 0; k < 120; k++) {
            const trip = tripAt(world, profile, animal, 1_795_000_000 + k * SLOT_SECONDS, () => 11, "diurnal");
            if (trip.recipe !== "incubate_sit~reptile") continue;
            found.set(sex, (found.get(sex) ?? 0) + 1);
            const ep = tripEpisode(world, trip);
            if (!ep) continue;
            episodes++;
            // (A slot is 80 s and it walks to the nest first: most episodes have all of it, a late arrival only its start.)
            if (ep.keys.some((key) => key.block.id === "incubate") && ep.keys.some((key) => key.block.id === "mound_up")) lying++;
            const pose = poseOnTrip(world, trip, (ep.t0 + ep.t1) / 2) as RecipePose;
            assert.equal(pose.act ? recipeBase(pose.act.recipe) : null, "incubate_sit");
        }
    }
    assert.ok(episodes > 20 && lying / episodes > 0.6, `${lying} of ${episodes} guards lie over a heaped mound`);
    assert.ok((found.get("female") ?? 0) > 0, "a female guards");
    assert.equal(found.get("male") ?? 0, 0, "never a male");
});

// MARK: The small clingers' sit-and-wait (`micro-ambush.ts`)

const FLAT = (along: number): AmbushPoint => ({x: along, y: 1, z: 0, nx: 0, ny: 0, nz: 1, tx: 1, ty: 0, tz: 0});

test("the small clingers that hunt by sit-and-wait: the gecko's hours are night, the lizard's day; each is a catalogue row of a micro-habitat species", () => {
    const species = (micro as {species: Record<string, "night" | "day">}).species;
    assert.equal(Object.keys(species).length, 7);
    for (const [slug, hours] of Object.entries(species)) {
        assert.equal(ambushHours(slug), hours);
        assert.equal(/gecko/.test(slug) ? "night" : "day", hours, slug);
        assert.ok(recipesOf(slug).includes(AMBUSH_RECIPE), `${slug}: row`);
        assert.ok(ADDITIONS.some((a) => a.slug === slug && a.recipe === AMBUSH_RECIPE && a.micro === hours), `${slug}: row in the data`);
    }
    assert.equal(ambushHours("plains-zebra"), null);
    assert.ok(inAmbushHours("night", 22) && inAmbushHours("night", 3) && !inAmbushHours("night", 12));
    assert.ok(inAmbushHours("day", 11) && !inAmbushHours("day", 22) && !inAmbushHours("day", 6));
});

test("a bout: pure in the animal and the clock; the insect there before the dash, a dash, a snap, the insect gone, back where it began", () => {
    const id = "0000feed-0000-4000-8000-000000000042";
    const length = 0.1;
    const bouts = ambushBouts(id, length, 1_795_000_000, 1_795_000_600);
    assert.ok(bouts.length >= 12 && bouts.length <= 28, `${bouts.length} bouts in ten minutes`);
    assert.deepEqual(ambushBouts(id, length, 1_795_000_000, 1_795_000_600), bouts, "pure");
    for (const b of bouts) {
        assert.ok(b.tv < b.td && b.td < b.te);
        assert.ok(b.te - b.tv < 20, `a bout is ${(b.te - b.tv).toFixed(1)} s`);
        assert.ok(b.reach >= 0.08 && b.reach <= 0.45);
    }
    const bout = bouts[2];
    assert.deepEqual(boutOf(id, length, bout.k), bout);
    const sample = (t: number) => ambushNow(id, "Gecko", length, t, FLAT);
    // Before it: still, no act.
    const before = sample(bout.tv - 1);
    assert.equal(before.act, null);
    assert.equal(before.along, 0);
    // The insect is there from its landing, waiting, the gecko freezing.
    const waiting = sample(bout.td - 0.5);
    assert.equal(waiting.act!.block, "freeze");
    assert.equal(waiting.along, 0);
    assert.equal(waiting.act!.quarry!.phase, "idle");
    assert.equal(waiting.act!.quarry!.look, "flier");
    // The dash: running, along its heading, further each moment.
    const early = sample(bout.td + DASH * 0.3);
    const late = sample(bout.td + DASH * 0.9);
    assert.equal(early.act!.state, "run");
    assert.ok(early.along > 0 && late.along > early.along && late.along <= bout.reach + 1e-9);
    // The snap: where the dash ended (a little on), the strike state; the insect caught (gone) or got away, as the bout says.
    const snap = sample(bout.td + DASH + STRIKE * 0.5);
    assert.equal(snap.act!.state, "strike");
    assert.ok(snap.along >= bout.reach - 1e-9);
    const after = sample(bout.td + DASH + STRIKE + 0.3);
    assert.equal(after.act!.state, "eat");
    if (bout.ok) assert.equal(after.act!.quarry ?? null, null, "caught: gone");
    // The insect is on the surface ahead of its mouth, never inside it.
    assert.ok(waiting.act!.quarry!.z > 0, "out from the surface (its normal +z)");
    // The turn, the walk back facing home, the turn round again, home.
    const turning = sample(bout.td + DASH + STRIKE + EAT + TURN * 0.5);
    assert.ok(turning.turn > 0.5 && turning.turn < Math.PI - 0.5);
    const back = sample(bout.te - TURN - 0.05);
    assert.ok(back.turn > Math.PI - 0.05, "walking back facing it");
    const home = sample(bout.te + 0.01);
    assert.equal(home.act, null);
    assert.equal(home.turn, 0);
    // Along never jumps: a tenth of a second moves it no further than a body length and a half.
    let last = 0;
    for (let t = bout.tv; t < bout.te; t += 0.05) {
        const now = sample(t).along;
        assert.ok(Math.abs(now - last) < length * 1.5, `jump at ${(t - bout.td).toFixed(2)}`);
        last = now;
    }
});
