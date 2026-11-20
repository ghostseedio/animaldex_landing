import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import table from "@/ark-scene/recipes.json";
import sleepTable from "@/ark-scene/sleep.json";
import lines from "@/ark-scene/signature-lines.json";
import birds from "../../data/ark/signature-birds.json";
import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {forgetRecipes, microRoost, quarriesOf, ROOST_AMBIENT, ROOST_HOURS, roostPoint, sexLook, speciesRecipes, type RecipePose} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, roostOf, scheduleWorld, tripAt, tripEpisode, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {sleepStyle} from "@/ark-scene/sleep";
import {propsPresence} from "@/ark-scene/props/presence";
import {waterSurfaceOf} from "@/ark-scene/behaviour-water";
import type {ArkAnimal} from "@/ark-scene/types";

const ROWS = (table as {species: Record<string, string>}).species;
type Row = {slug: string; name: string; was: string; recipe: string; behaviour: string; field: string; quote: string; catalogueId: string; line: string | null; nest?: string; sleep?: string; maleSits?: boolean; already?: boolean};
const rows = (birds as {rows: Row[]}).rows;

const world = scheduleWorld(sceneSampler());
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

test("wave 2, birds: every row is sourced (field, exact sentence, catalogue id) and its recipe is a template the bird recipes know", () => {
    assert.ok(rows.length >= 40);
    for (const r of rows) {
        assert.ok(r.field && r.quote && r.catalogueId && r.behaviour, r.slug);
        assert.ok(TEMPLATES[r.recipe], `${r.slug}: ${r.recipe}`);
        assert.ok(ROWS[r.slug], `${r.slug} has a recipes row`);
    }
    // Held, not shown: named with the reason, never silently dropped.
    const notShown = (birds as {notShown: Array<{slug: string; why: string}>}).notShown;
    assert.deepEqual(notShown.map((n) => n.slug).sort(), ["ostrich", "ring-billed-gull"]);
    for (const n of notShown) assert.ok(n.why.length > 40);
});

test("wave 2, birds: each row's recipe is on the species' row (or its flag, or its own hunt shows it), and the new templates' steps are real blocks", () => {
    for (const r of rows) {
        const species = speciesRecipes(r.slug);
        if (r.maleSits) assert.ok(species.maleSits, `${r.slug} male sits`);
        else if (r.already) assert.ok(species.has.has(r.recipe), `${r.slug} already has ${r.recipe}`);
        else assert.ok(species.has.has(r.recipe), `${r.slug} has ${r.recipe}`);
        if (r.nest) assert.ok(species.nest, `${r.slug} nest`);
    }
    for (const id of ["perch_drop", "perch_drop_insect", "perch_drop_insect_feet", "anvil_smash", "snail_extract", "bank_burrow", "burrow_dig", "roost_gather", "dummy_nests"]) {
        assert.ok(TEMPLATES[id], id);
        for (const step of TEMPLATES[id].steps) assert.ok(BLOCKS[step.b], `${id}: ${step.b}`);
    }
    // A swoop is a flying block that ends on the ground, and the quarry of an insect swoop is a hopper in the grass, not a moth in the air.
    assert.equal(BLOCKS.swoop.aloft, true);
    assert.equal(BLOCKS.swoop.curve, "plunge");
});

test("wave 2, birds: the log lines are the species' own and say only what the recipe shows (no sex, season or time of day)", () => {
    const words = /\b(male|female|he|she|his|her|winter|summer|spring|autumn|season|dusk|dawn|night|twilight|evening|morning)\b/i;
    const species = (lines as unknown as {species: Record<string, Record<string, string>>}).species;
    for (const r of rows) {
        if (!r.line) continue;
        assert.equal(species[r.slug]?.[r.recipe], r.line, `${r.slug} ${r.recipe}`);
        assert.ok(!words.test(r.line), `${r.slug}: ${r.line}`);
        assert.ok(r.line.startsWith("{aAnimal}") || r.line.startsWith("{animals}"), r.line);
    }
    // A flock-only roost has no episode of its own: no line (nothing could say it).
    for (const r of rows.filter((row) => row.recipe === "roost_gather")) assert.equal(r.line, null);
});

test("wave 2, birds: a communal roost's species sleep together in a row (its text says they roost together)", () => {
    const roosts = rows.filter((r) => r.recipe === "roost_gather");
    assert.equal(roosts.length, 16);
    for (const r of roosts) {
        assert.equal(sleepStyle(r.slug).social, "row", r.slug);
        assert.ok(/roost|settling for the night/i.test(r.quote), `${r.slug}: ${r.quote}`);
        assert.equal((sleepTable as {species: Record<string, string>}).species[r.slug].split("|")[2], "row");
    }
    // The styles' data keeps the source of the change.
    const styles = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/ark/sleep-styles.json"), "utf8")) as {species: Array<{slug: string; social: string; src: {social: {phrase?: string}}}>};
    for (const r of roosts) {
        const style = styles.species.find((s) => s.slug === r.slug)!;
        assert.equal(style.social, "row");
        assert.equal(style.src.social.phrase, r.quote);
    }
});

/** A bird of a slug at a spot, a day of its slots from the morning. */
function day(slug: string, home: {x: number; z: number}, length: number, hours = [6, 20]) {
    const a = {id: `${slug}-${home.x}`, zone: "grassland", home: {x: home.x, y: Math.max(world.sampler.heightAt(home.x, home.z), 0), z: home.z}, length, sea: false} as ScheduleAnimal;
    const profile = behaviourProfile(slug);
    const start = Math.floor(Date.UTC(2026, 3, 14, hours[0]) / 1000);
    const trips = [];
    for (let t = start; t < start + (hours[1] - hours[0]) * 3600; t += SLOT_SECONDS) trips.push(tripAt(world, profile, a, t, hoursAt, "any"));
    return {a, trips};
}

for (const [slug, recipe, length, drawn] of [["brown-shrike", "perch_drop_insect", 0.2, true], ["laughing-kookaburra", "perch_drop", 0.4, false], ["little-owl", "perch_drop", 0.25, false]] as const) {
    test(`wave 2, birds: a ${slug} waits on a perch and swoops down onto the ground, then flies back up${drawn ? " (an insect in the grass it drops on)" : ""}`, () => {
        forgetRecipes();
        let swoops = 0;
        let caught = 0;
        for (const home of [{x: -70, z: 22}, {x: 80, z: 60}, {x: 10, z: 10}]) {
            const {a, trips} = day(slug, home, length);
            for (const trip of trips.filter((t) => t.recipe === recipe)) {
                const episode = tripEpisode(world, trip);
                const swoop = episode?.keys.find((k) => k.block.id === "swoop");
                if (!episode || !swoop) continue;
                swoops++;
                // From a perch above the ground, onto dry ground a few metres off.
                const ground = Math.max(world.sampler.heightAt(swoop.to.x, swoop.to.z), waterSurfaceOf(world.sampler, swoop.to.x, swoop.to.z));
                assert.ok(swoop.from.y - ground > 0.25, `perch ${swoop.from.y} over ${ground}`);
                assert.ok(Math.abs(swoop.to.y - ground) < 0.05, "lands on the ground");
                assert.ok(world.sampler.heightAt(swoop.to.x, swoop.to.z) > waterSurfaceOf(world.sampler, swoop.to.x, swoop.to.z) + 0.02, "dry ground");
                // In the air on the way down, nose down; the act names it.
                const mid = poseOnTrip(world, trip, (swoop.t0 + swoop.t1) / 2) as RecipePose;
                assert.ok(mid.aloft && mid.act?.block === "swoop" && mid.act.pitch > 0.2, `${mid.act?.block} ${mid.act?.pitch} aloft ${mid.aloft} y ${mid.y} ground ${world.sampler.heightAt(mid.x, mid.z)} from ${swoop.from.y} to ${swoop.to.y}`);
                // It watches first (a long hold on the perch) and goes back up after: perch, scan, swoop, ..., back at its perch.
                assert.deepEqual(episode.keys.slice(0, 3).map((k) => k.block.id), ["perch", "scan", "swoop"]);
                assert.ok(episode.keys[0].t1 - episode.keys[0].t0 >= 9 - 1e-6, "a watch of nine seconds or more");
                const last = episode.keys[episode.keys.length - 1];
                assert.ok(last.block.id === "fly" || last.block.id === "walk", `ends ${last.block.id}`);
                // Quarry: only where the sentence names an insect, a hopper in the grass; never a catalogue animal.
                const quarry = quarriesOf(world, episode);
                if (drawn) {
                    for (const q of quarry) assert.equal(q.look, "hopper");
                    if (swoop.catch?.ok) caught++;
                } else assert.equal(quarry.length, 0);
                const end = poseOnTrip(world, trip, episode.t1 + 0.01);
                assert.ok(Math.hypot(end.x - trip.to.x, end.z - trip.to.z) < 0.5, "back on its perch");
            }
        }
        assert.ok(swoops >= 15, `${swoops} swoops`);
        if (drawn) assert.ok(caught >= 5, `${caught} catches`);
    });
}

test("wave 2, birds: a roost fills at dusk and empties at dawn, the same for every viewer", () => {
    const centre = {x: 9, y: 20, z: -45};
    const t0 = Date.UTC(2026, 10, 12, 17) / 1000;
    const seed = 777;
    const at = (rel: number) => Array.from({length: ROOST_AMBIENT}, (_, i) => roostPoint(centre, seed, i, t0 + rel, t0));
    // Nobody before the first wave; birds arriving then settling; all perched through the night; leaving at dawn; none after.
    assert.equal(at(0).filter(Boolean).length, 0);
    assert.ok(at(1500).filter((p) => p?.perched).length > 10);
    assert.equal(at(7200).filter((p) => p?.perched).length, ROOST_AMBIENT);
    assert.equal(at(7200).filter((p) => p && !p.perched).length, 0);
    assert.equal(at(47500).filter(Boolean).length, 0);
    // In flight at some moment of the busiest hour, and in the air they are never on a branch (above the roost, away from it).
    let busiest = 0;
    for (let rel = 360; rel < 5400; rel += 3) busiest = Math.max(busiest, at(rel).filter((p) => p && !p.perched).length);
    assert.ok(busiest >= 3, `${busiest} at once`);
    // Perched birds are in the crown (a few metres of the roost point), never far off.
    for (const p of at(20000)) assert.ok(p && Math.hypot(p.x - centre.x, p.z - centre.z) < 2.6 && Math.abs(p.y - centre.y) < 1.2);
    // Pure: the same answer twice.
    assert.deepEqual(at(3000), at(3000));
    assert.ok(ROOST_HOURS[0] > 16 && ROOST_HOURS[1] < 7);
});

test("wave 2, birds: a house bird (a small animal at its microhabitat, off the schedule) has its kind's roost round the spot it is drawn at, one a 40 m cell, only at dusk and by night", () => {
    const at = {x: 12, y: 3.1, z: -8};
    const t = Date.UTC(2026, 10, 12, 0) / 1000;
    for (const slug of ["house-sparrow", "european-starling", "welcome-swallow", "javan-myna", "eurasian-tree-sparrow"]) {
        assert.equal(microRoost(slug, at, t + 12 * 3600, 12, 0.15), null, `${slug} by day`);
        const f = microRoost(slug, at, t + 18.5 * 3600, 18.5, 0.15)!;
        assert.equal(f.kind, "roost");
        assert.deepEqual(f.centre, at);
        assert.ok(f.spread! < 1.5, "a house eave's, not a crown's");
        // The same crowd for a neighbour in the same 40 m cell, another for a cell away.
        assert.equal(microRoost(slug, {x: 20, y: 3, z: -2}, t + 18.5 * 3600, 18.5, 0.15)!.seed, f.seed);
        assert.notEqual(microRoost(slug, {x: 120, y: 3, z: -2}, t + 18.5 * 3600, 18.5, 0.15)!.seed, f.seed);
    }
    // A bird with no roost recipe: none.
    assert.equal(microRoost("mallard", at, t + 18.5 * 3600, 18.5, 0.5), null);
});

test("wave 2, birds: the members of a roosting flock sleep together on their leader's perch (they roosted apart before)", () => {
    for (const slug of ["rook", "house-sparrow", "european-starling", "welcome-swallow"]) {
        const profile = behaviourProfile(slug);
        const s = world.sampler;
        const home = {x: 30, y: Math.max(s.heightAt(30, -40), 0), z: -40};
        const leader = {id: `${slug}-L`, zone: "woodland", home, length: 0.3, sea: false} as ScheduleAnimal;
        const lead = roostOf(world, profile, leader);
        for (const rank of [1, 2, 3, 4]) {
            const member = {id: `${slug}-${rank}`, zone: "woodland", home: {x: home.x + rank * 9, y: home.y, z: home.z - rank * 7}, length: 0.3, sea: false, group: {leader, profile, activity: "diurnal", rank, size: 5}} as unknown as ScheduleAnimal;
            const at = roostOf(world, profile, member);
            assert.ok(Math.hypot(at.x - lead.x, at.y - lead.y, at.z - lead.z) < 2.5, `${slug} ${rank}`);
        }
    }
});

test("wave 2, birds: a roost flock is reported at dusk and through the night, not by day, drawn round the leader's roost", () => {
    forgetRecipes();
    const profile = behaviourProfile("rook");
    const a = {id: "rook-1", zone: "woodland", home: {x: 30, y: Math.max(world.sampler.heightAt(30, -40), 0), z: -40}, length: 0.45, sea: false} as ScheduleAnimal;
    const date = Math.floor(Date.UTC(2026, 10, 12, 0) / 1000);
    const flockAt = (h: number) => {
        const t = date + h * 3600;
        return (poseOnTrip(world, tripAt(world, profile, a, t, hoursAt, "diurnal"), t) as RecipePose).flock;
    };
    assert.equal(flockAt(12), undefined);
    assert.equal(flockAt(16.9), undefined);
    for (const h of [17.2, 19, 23, 3, 5.9]) {
        const f = flockAt(h)!;
        assert.equal(f.kind, "roost", `${h}`);
        assert.equal(f.tone, "dark");
        assert.ok(f.length! > 0.1);
    }
    assert.equal(flockAt(6.5), undefined);
    // The same crowd seed all night (it is the leader's), the window one night long.
    const f1 = flockAt(18)!;
    const f2 = flockAt(26)!;
    assert.equal(f1.seed, f2.seed);
    assert.equal(f1.t0, f2.t0);
    assert.equal((f1.t1 - f1.t0) / 3600, 24 - ROOST_HOURS[0] + ROOST_HOURS[1]);
});

test("wave 2, birds: a kingfisher digs its tunnel at the water's edge, a penguin digs at its burrow, a thrush smashes snails on a stone, a limpkin snips snails out of their shells", () => {
    forgetRecipes();
    const checks: Array<[string, string, string, number, string]> = [["common-kingfisher", "bank_burrow", "dig", 0.17, "river_lake"], ["african-penguin", "burrow_dig", "dig", 0.65, "seashore"], ["song-thrush", "anvil_smash", "beat_prey", 0.23, "farm_garden"], ["limpkin", "snail_extract", "tool", 0.65, "wetland"]];
    for (const [slug, recipe, block, length] of checks) {
        let n = 0;
        for (const home of [{x: -70, z: 22}, {x: 10, z: 10}, {x: 80, z: 60}, {x: -40, z: 50}]) {
            const {trips} = day(slug, home, length);
            for (const trip of trips) {
                // (A recipe the schedule sent it to, or one on the spot where it already is: the penguin at its burrow.)
                if (trip.recipe && trip.recipe !== recipe) continue;
                const episode = tripEpisode(world, trip);
                if (episode?.recipe === recipe && episode.keys.some((k) => k.block.id === block)) n++;
            }
        }
        assert.ok(n >= 3, `${slug} ${recipe}: ${n} episodes with ${block}`);
    }
});

test("wave 2, birds: the male alone sits an emu's, a cassowary's and a rhea's eggs; another bird's first adult does", () => {
    const bird = (slug: string, i: number): ArkAnimal => ({id: `${slug}-${i}`, species_profile_id: slug, name: slug, scientific_name: null, model_slug: slug, zone: "grassland", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false});
    const clutch = (slug: string) => ({species_profile_id: slug, zone: "grassland", status: "egg", eggs: 4});
    for (const slug of ["emu", "southern-cassowary", "greater-rhea"]) {
        const animals = Array.from({length: 8}, (_, i) => bird(slug, i));
        const presence = propsPresence({animals, ark_day: 100, nests: [clutch(slug)]} as never);
        const nest = presence.nests.find((n) => n.slug === slug);
        assert.ok(nest?.sitter, `${slug} has a sitter`);
        assert.equal(sexLook(nest!.sitter!, slug).sex, "male", `${slug}'s sitter`);
    }
    // None of its males aboard: nobody sits, never a female.
    let alone = 0;
    for (let i = 0; i < 40; i++) {
        const only = [bird("emu", 100 + i)];
        if (sexLook(only[0].id, "emu").sex === "male") continue;
        const presence = propsPresence({animals: only, ark_day: 100, nests: [clutch("emu")]} as never);
        assert.equal(presence.nests.find((n) => n.slug === "emu")?.sitter, null);
        alone++;
    }
    assert.ok(alone > 5);
    // An ordinary bird: its first adult sits it, as before.
    const sparrows = Array.from({length: 4}, (_, i) => bird("house-sparrow", i));
    const presence = propsPresence({animals: sparrows, ark_day: 100, nests: [clutch("house-sparrow")]} as never);
    assert.equal(presence.nests.find((n) => n.slug === "house-sparrow")?.sitter, "house-sparrow-0");
});

test("wave 2, birds: the black swan's preening leads its row (long periods of it)", () => {
    const swan = speciesRecipes("black-swan");
    assert.equal(swan.recipes[0].id, "groom_self");
    assert.ok(swan.recipes[0].weight >= 0.9);
});
