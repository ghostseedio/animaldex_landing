/**
 * Encounter hunting in the scene: the meal's geometry through the events parse and onto the meal act; the hunting
 * read; a due predator's forays from the shared module (deterministic, continuous, off without a read).
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import fixtureEvents from "@/ark-scene/fixtures/events.json";
import {decodeArkEvents, decodeArkMealEncounter, planArkReplay} from "@/lib/ark-life";
import {decodeArkHunting, decodeArkHuntingResponse} from "@/lib/ark-hunting";
import {ENCOUNTER_AGREE} from "@/ark-scene/acts";
import {HUNT_STATION_AGREE, HuntingLayer, type HuntPose} from "@/ark-scene/hunting";
import {ARK_DAY_MS, decodeAtlas, forayAt, homeOf, sheetOf, stepIndex} from "@/ark-scene/positions/positions";
import type {ArkAnimal} from "@/ark-scene/types";

const ENCOUNTER = {t: 1794190925.81, step: 481, island: "wild", predator: {x: -3.74, z: 2.99}, prey: {x: -2.8, z: 5.4, r: 3}, d: 2.59};
const rows = (fixtureEvents as {events: Array<Record<string, unknown>>}).events;

test("meal geometry: the events read's `encounter` (or payload.encounter) rides on the event and the meal act; checked", () => {
    const meal = rows.find((r) => r.kind === "meal")!;
    const withTop = decodeArkEvents([{...meal, encounter: ENCOUNTER}], null).find((e) => e.kind === "meal")!;
    assert.deepEqual(withTop.encounter, ENCOUNTER);
    const withPayload = decodeArkEvents([{...meal, payload: {encounter: ENCOUNTER}}], null).find((e) => e.kind === "meal")!;
    assert.deepEqual(withPayload.encounter, ENCOUNTER);
    const act = planArkReplay([withTop]).acts.find((a) => a.kind === "meal");
    assert.ok(act && act.kind === "meal");
    assert.deepEqual(act.encounter, ENCOUNTER);
    // A pool meal: no `encounter` key at all (the act is exactly as before).
    const pool = decodeArkEvents([meal], null).find((e) => e.kind === "meal")!;
    assert.equal("encounter" in pool, false);
    const poolAct = planArkReplay([pool]).acts.find((a) => a.kind === "meal")!;
    assert.equal("encounter" in poolAct, false);
    // Only a meal carries it; malformed geometry is dropped, never thrown.
    const birth = rows.find((r) => r.kind === "birth");
    if (birth) assert.equal("encounter" in decodeArkEvents([{...birth, encounter: ENCOUNTER}], null)[0], false);
    assert.equal(decodeArkMealEncounter({predator: {x: 1, z: 2}, prey: {x: 3, z: "4", r: 1}}), undefined);
    assert.equal(decodeArkMealEncounter({predator: {x: Infinity, z: 2}, prey: {x: 3, z: 4, r: 1}}), undefined);
    assert.equal(decodeArkMealEncounter({predator: {x: 1, z: 2}, prey: {x: 3, z: 4, r: -1}}), undefined);
    assert.deepEqual(decodeArkMealEncounter({predator: {x: 1, z: 2}, prey: {x: 3, z: 4, r: 1}, step: 1.5, island: "Bad Island!", d: -2}), {predator: {x: 1, z: 2}, prey: {x: 3, z: 4, r: 1}});
});

test("the hunting read: decoded and checked; a missing read, the pool or nonsense is nothing", () => {
    const fox = "00000000-0000-4000-8000-000000000100";
    const raw = {hunting: "encounter", started_at: "2026-11-08T21:45:21.431391+00:00", ark_day: 80.5, ticked_to: 80.489583, predators: [[fox, 81.25], ["not an id!", 3], [fox.replace("100", "101"), "82"]], meals: [{id: 9, ark_day: 80.4, predator: fox, prey: fox.replace("100", "102"), encounter: ENCOUNTER}, {id: 10, predator: fox, prey: fox, encounter: {}}]};
    const h = decodeArkHunting(raw)!;
    assert.equal(h.hunting, "encounter");
    assert.equal(h.startedAtMs, Date.parse("2026-11-08T21:45:21.431Z"));
    assert.deepEqual(Array.from(h.predators), [[fox, 81.25], [fox.replace("100", "101"), 82]]);
    assert.equal(h.meals.length, 1);
    assert.deepEqual(h.meals[0].encounter, ENCOUNTER);
    assert.equal(decodeArkHuntingResponse({available: false}), null);
    assert.equal(decodeArkHuntingResponse({available: true, hunting: {hunting: "pool", predators: []}})!.hunting, "pool");
    assert.equal(decodeArkHunting({hunting: "maybe"}), null);
    assert.equal(decodeArkHunting(null), null);
});

const atlas = decodeAtlas(JSON.parse(readFileSync(join(process.cwd(), "src/ark-scene/positions/atlas.json"), "utf8")));
const START = Date.parse("2026-11-08T21:45:21.431Z");

function predator(): ArkAnimal {
    // A real atlas species that walks (its recipe and sheet from the atlas): the first walking mammal-sized one.
    const isl = atlas.islands.wild;
    const slug = Object.keys(isl.species).sort().find((s) => {
        const sh = sheetOf(atlas, s)!;
        return sh.move === "walk" && sh.len > 0.4 && sh.len < 2 && isl.species[s][1] !== 11;
    })!;
    const zone = atlas.zones[isl.species[slug][1]] as ArkAnimal["zone"];
    return {id: "00000000-0000-4000-8000-0000000000aa", species_profile_id: "00000000-0000-4000-8000-0000000000bb", name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, slot: 3, slot_rank: 0, activity: "any"};
}

test("forays: a due predator is at the module's waypoint at every step, walks between them, and the same for every viewer", () => {
    const animal = predator();
    const layer = new HuntingLayer();
    const sched = (): HuntPose => ({x: 0, y: 0, z: 0, yaw: 0, moving: false, aloft: false, nx: 0, ny: 1, nz: 0, beat: "rest", doing: "rest"});
    const ground = () => 0.5;
    // Off: no read, the pool, or a predator the read does not name.
    assert.equal(layer.pose(animal, START / 1000 + 86400, 1, ground, sched), null);
    layer.set({hunting: "pool", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 0]]), meals: []}, atlas, START);
    assert.equal(layer.active, false);
    layer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([["someone-else", 0]]), meals: []}, atlas, START);
    assert.equal(layer.pose(animal, START / 1000 + 86400, 1, ground, sched), null);
    // On: due from Ark day 80.
    layer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 80]]), meals: []}, atlas, START);
    const home = homeOf(atlas, {zone: animal.zone, slug: animal.model_slug, speciesId: animal.species_profile_id, slot: 3, rank: 0})!;
    const epochAt = (day: number) => (START + day * ARK_DAY_MS) / 1000;
    assert.equal(layer.pose(animal, epochAt(79.5), 1, ground, sched), null, "not before its next hunt");
    for (const k of [7700, 7701, 7750, 8000]) {
        const at = layer.pose(animal, epochAt(k / 96), 1, ground, sched)!;
        const w = forayAt(atlas, home, animal.id, k);
        // (At the waypoint, or one that waits at its waiting place for it: `HUNT_STATION_AGREE`, inside the chase's 5 m.)
        assert.ok(Math.hypot(at.x - w.x, at.z - w.z) <= HUNT_STATION_AGREE + 1e-6, `at step ${k} it is where the server has it`);
        assert.ok(HUNT_STATION_AGREE < ENCOUNTER_AGREE);
        // Half a step on: on its way to the next waypoint, never further from both than they are from each other.
        const mid = layer.pose(animal, epochAt((k + 0.5) / 96), 1, ground, sched)!;
        const w1 = forayAt(atlas, home, animal.id, k + 1);
        const leg = Math.hypot(w1.x - w.x, w1.z - w.z);
        assert.ok(Math.hypot(mid.x - w.x, mid.z - w.z) <= leg + 40 && Math.hypot(mid.x - w1.x, mid.z - w1.z) <= leg + 40);
        // Another viewer's layer (its own caches) answers the same.
        const other = new HuntingLayer();
        other.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 80]]), meals: []}, atlas, START);
        assert.deepEqual(other.pose(animal, epochAt((k + 0.5) / 96), 1, ground, sched), mid);
    }
    // Into the hunt (the steps before its first): on its schedule until it must leave, then to its first waypoint; no
    // jump at either end.
    const k0 = stepIndex(80) - 1;
    const start = layer.pose(animal, epochAt((k0 - 2) / 96 + 1e-9), 1, ground, sched);
    assert.ok(start === null || Math.hypot(start.x, start.z) < 0.01, "it sets off from where its schedule has it");
    const end = layer.pose(animal, epochAt((k0 + 1) / 96 - 1e-9), 1, ground, sched)!;
    const first = forayAt(atlas, home, animal.id, k0 + 1);
    assert.ok(Math.hypot(end.x - first.x, end.z - first.z) <= HUNT_STATION_AGREE + 0.01, "it arrives at its first waypoint");
    const begun = layer.pose(animal, epochAt((k0 + 1) / 96 + 1e-9), 1, ground, sched)!;
    assert.ok(Math.hypot(end.x - begun.x, end.z - begun.z) < 0.01, "and the hunt begins where it arrived");
    // Islands mode: the same animal on the town island has no home in the (wild island's) atlas: never a foray.
    for (const island of ["town", "wild"] as const) {
        const islandLayer = new HuntingLayer();
        islandLayer.set({hunting: "encounter", startedAtMs: START, arkDay: null, tickedTo: null, predators: new Map([[animal.id, 80]]), meals: []}, atlas, START);
        const pose = islandLayer.pose({...animal, island}, epochAt(7750 / 96), 1, ground, sched);
        assert.equal(pose === null, island === "town", `${island}: ${pose ? "a foray" : "no foray"}`);
    }
    // Off again: the read gone.
    layer.set(null, null, null);
    assert.equal(layer.active, false);
});
