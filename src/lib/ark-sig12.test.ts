import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/recipes.json";
import lines from "@/ark-scene/signature-lines.json";
import afloat from "@/ark-scene/roost-afloat.json";
import holds from "../../data/ark/signature-holds.json";
import lane from "../../data/ark/signature-recipes-sig12.json";
import {crownPerches, ROOST_AMBIENT, roostPoint} from "@/ark-scene/behaviour-recipes";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {roostOf, scheduleWorld, type ScheduleAnimal, type ScheduleWorld} from "@/ark-scene/behaviour-schedule";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {AMBUSH_RECIPE} from "@/ark-scene/micro-ambush";

const ROWS = (table as {species: Record<string, string>}).species;
const recipesOf = (slug: string) => (ROWS[slug] ?? "").split("|")[0].split(",").map((r) => r.slice(0, r.lastIndexOf(".")));

test("SIG12: the grey parrot and blue-fronted amazon have roost_gather, each from its own sleep sentence; galah and eared dove dropped", () => {
    const rows = (lane as {additions: Array<{slug: string; recipe: string; field: string; quote: string}>}).additions;
    for (const slug of ["galah", "eared-dove"]) assert.ok(!recipesOf(slug).includes("roost_gather"), `${slug}: dropped (did not read)`);
    for (const slug of ["african-grey-parrot", "blue-fronted-amazon"]) {
        assert.ok(recipesOf(slug).includes("roost_gather"), slug);
        const row = rows.find((r) => r.slug === slug && r.recipe === "roost_gather");
        assert.ok(row && row.field === "sleep" && /roost/i.test(row.quote), `${slug}: its own sleep sentence`);
    }
});

test("SIG12: the house gecko's sit-and-wait is released (row and sentence); the leopard gecko's stays held, with why", () => {
    assert.ok(recipesOf("common-house-gecko").includes(AMBUSH_RECIPE));
    assert.ok((lines as {species: Record<string, Record<string, string>>}).species["common-house-gecko"]?.[AMBUSH_RECIPE]?.startsWith("{aAnimal} is "));
    const held = (holds as {held: Array<{slug: string; recipe: string}>}).held;
    assert.ok(!held.some((h) => h.slug === "common-house-gecko" && h.recipe === AMBUSH_RECIPE));
    assert.ok(held.some((h) => h.slug === "leopard-gecko" && h.recipe === AMBUSH_RECIPE));
    assert.ok(!recipesOf("leopard-gecko").includes(AMBUSH_RECIPE));
});

/** A world whose crown is a dome 6 m high, 3 m across, over (0, 0); ground at 0. */
function domeWorld(): ScheduleWorld {
    const base = sceneSampler();
    const sampler = Object.create(base) as typeof base;
    Object.assign(sampler, {canopyTop: (x: number, z: number) => (Math.hypot(x, z) < 3 ? 6 - 0.3 * Math.hypot(x, z) : -Infinity)});
    return {sampler, nav: scheduleWorld(base).nav};
}

test("SIG12: a roost in a crown sits on the crown's top (seen), every roost-mate on one of its places; none under it", () => {
    const world = domeWorld();
    const centre = {x: 0.4, y: 4.2, z: -0.2};
    const perches = crownPerches(world, centre, 1234)!;
    assert.ok(perches && perches.length >= 6, "places on the crown");
    assert.deepEqual(crownPerches(world, centre, 1234), perches, "pure");
    for (const p of perches) {
        assert.ok(Math.hypot(p.x, p.z) < 3, "on the crown");
        assert.ok(Math.abs(p.y - (6 - 0.3 * Math.hypot(p.x, p.z))) < 1e-9, "at its top there");
    }
    const t0 = 1_795_000_000;
    let perched = 0;
    for (let i = 0; i < ROOST_AMBIENT; i++) {
        const p = roostPoint(centre, 99, i, t0 + 6 * 3600, t0, 2.1, perches);
        if (!p?.perched) continue;
        perched++;
        assert.ok(p.y > centre.y + 0.5, "above the roost point inside the crown");
    }
    assert.ok(perched > ROOST_AMBIENT * 0.9, `${perched} perched at night`);
    // No crown over the roost (a cliff, the town): round its point as before.
    assert.equal(crownPerches(world, {x: 10, y: 1, z: 10}, 1234), null);
    assert.equal(crownPerches(world, {x: 0, y: 7, z: 0}, 1234), null, "a roost above the crown");
});

test("SIG12: the black-headed gull roosts afloat on open water, from its own sentence; another water-roosting gull is unchanged", () => {
    const species = (afloat as {species: Record<string, {field: string; quote: string}>}).species;
    assert.deepEqual(Object.keys(species), ["black-headed-gull"]);
    assert.ok(/afloat/.test(species["black-headed-gull"].quote));
    const world = scheduleWorld(sceneSampler());
    const s = world.sampler;
    // A home on dry land some way from the water: the nearest water within the nav's reach.
    let home: {x: number; y: number; z: number} | null = null;
    for (let x = -120; x <= 120 && !home; x += 6) {
        for (let z = -120; z <= 120 && !home; z += 6) {
            if (s.isWater(x, z) || s.heightAt(x, z) < 0.5) continue;
            const water = world.nav.nearest(x, z, "swim", 0.4, 60);
            const d = water ? Math.hypot(water.x - x, water.z - z) : Infinity;
            if (d > 40 && d < 100) home = {x, y: s.heightAt(x, z), z};
        }
    }
    assert.ok(home, "a dry home 40-100 m from water (past the 12 rings the other water roosters look in)");
    const gull = {id: "sig12-gull", zone: "seashore", home, length: 0.38, sea: false} as ScheduleAnimal;
    const at = roostOf(world, behaviourProfile("black-headed-gull"), gull);
    assert.ok(s.isWater(at.x, at.z), "its roost is on the water");
    const herring = {id: "sig12-herring", zone: "seashore", home, length: 0.6, sea: false} as ScheduleAnimal;
    const other = roostOf(world, behaviourProfile("herring-gull"), herring);
    assert.ok(!s.isWater(other.x, other.z), "a herring gull's is not (its text says nothing of it)");
});
