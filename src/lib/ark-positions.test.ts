/**
 * The Ark's shared position module (src/ark-scene/positions/, a pinned copy of AnimalDex
 * supabase/functions/_shared/ark-positions/): the copy is the pinned one, it answers every contract case as the server's
 * does, and the homes it gives are where this scene draws the animals (within 2.6 m, the atlas's verified bound).
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import * as P from "@/ark-scene/positions/positions";
import {placeAnimals} from "@/ark-scene/placement";
import {setArkWorld} from "@/ark-scene/world";
import type {ArkAnimal, ArkZone} from "@/ark-scene/types";

const DIR = join(process.cwd(), "src/ark-scene/positions");
const read = (name: string) => readFileSync(join(DIR, name));
const sha = (name: string) => createHash("sha256").update(read(name)).digest("hex");
const pin = JSON.parse(read("PIN.json").toString("utf8"));
const contract = JSON.parse(read("contract.json").toString("utf8"));
const atlasJson = JSON.parse(read("atlas.json").toString("utf8")) as {world?: string};
const atlas = P.decodeAtlas(atlasJson as never);
const species = JSON.parse(read("test-species.json").toString("utf8")).species as Array<[string, string, ArkZone, string]>;

function near(a: unknown, b: unknown, msg: string): void {
    if (typeof a === "number" && typeof b === "number") {
        assert.ok(Math.abs(a - b) <= 1e-9, `${msg}: ${a} vs ${b}`);
        return;
    }
    if (a && b && typeof a === "object") {
        for (const k of Object.keys(b as object)) near((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${msg}.${k}`);
        return;
    }
    assert.deepEqual(a, b, msg);
}

test("positions: the pinned copy (positions.ts, atlas.json, contract.json) and the contract's own hashes", () => {
    for (const name of ["positions.ts", "atlas.json", "contract.json"]) assert.equal(sha(name), pin.sha256[name], `${name} is not the pinned one: copy it from AnimalDex and re-pin`);
    assert.equal(contract.positionsSha256, pin.sha256["positions.ts"]);
    assert.equal(contract.atlasSha256, pin.sha256["atlas.json"]);
    assert.equal(P.POSITIONS_VERSION, contract.version);
    assert.equal(P.POSITIONS_VERSION, pin.positionsVersion);
});

test("positions: every contract case answers as on the server", () => {
    const c = contract.cases;
    for (const [s, h] of c.hash) assert.equal(P.hashString(s), h);
    for (const [d, k, day] of c.step) {
        assert.equal(P.stepIndex(d), k);
        assert.equal(P.stepDay(k), day);
    }
    for (const [act, start, d, v] of c.awake) assert.equal(P.awakeAt(act, start, d, 0), v);
    for (const [act, start, a, b, v] of c.awakeDays) near(P.awakeArkDays(act, start, a, b, 0), v, "awakeDays");
    for (const [act, start, a, need, v] of c.afterAwake) near(P.arkDayAfterAwake(act, start, a, need, 0), v, "afterAwake");
    for (const [ref, want] of c.home) {
        const h = P.homeOf(atlas, ref);
        near(h ? {x: h.x, z: h.z, r: h.r, island: h.island} : null, want, `home ${ref.slug} ${ref.slot}`);
    }
    for (const [ref, id, step, want] of c.foray) near(P.forayAt(atlas, P.homeOf(atlas, ref)!, id, step), want, `foray ${ref.slug} ${step}`);
    for (const [slug, sheet, det, fr] of c.sheet) {
        near(P.sheetOf(atlas, slug), sheet, `sheet ${slug}`);
        near(P.detectionRange(P.sheetOf(atlas, slug)!), det, "detection");
        near(P.forayRadius(P.sheetOf(atlas, slug)!), fr, "foray radius");
    }
    for (const [a, b, asleep, v] of c.reach) assert.equal(P.reachable(P.sheetOf(atlas, a)!, P.sheetOf(atlas, b)!, asleep), v, `${a} ${b} ${asleep}`);
    for (const [x, z, m] of c.medium) assert.equal(P.mediumAt(atlas, "wild", x, z), m);
    for (const [living, zone, sp, social, parents, want] of c.place) assert.deepEqual(P.placeYoung(living, zone, sp, social, parents), want);
});

test("positions: homes are where the scene draws them (every recipe type, overrides included), within 2.6 m", () => {
    // The atlas is made on one world (`world`: v2, the bigger wild island the page shows in islands mode): placed on it.
    assert.equal(atlasJson.world, "v2");
    setArkWorld("v2");
    const isl = atlas.islands.wild;
    const types = new Set<string>();
    let checked = 0;
    let worst = 0;
    for (const [id, slug, zone, type] of species) {
        const row = isl.species[slug];
        assert.ok(row, `${slug} has no atlas row`);
        types.add(type);
        const overrides = row[3] >= 0 ? isl.overrides[row[3]].slots.slice(0, 2) : [];
        const slots = [0, 7, 31, ...overrides];
        const animals = slots.map((slot) => ({
            id: `atlas-${slug}-${zone}-${slot}`, species_profile_id: id, name: slug, scientific_name: null, model_slug: slug, zone,
            arrived_at: "2026-01-01T00:00:00Z", brought_by: {label: "atlas", named: false}, mine: false, slot, slot_rank: 0
        }) as ArkAnimal);
        const placed = placeAnimals(animals);
        animals.forEach((a, i) => {
            const c = P.homeCentre(atlas, {zone, slug, speciesId: id, slot: slots[i]});
            assert.ok(c, `${slug} slot ${slots[i]}: no home`);
            const p = placed.get(a.id)!;
            const d = Math.hypot(c!.x - p.x, c!.z - p.z);
            worst = Math.max(worst, d);
            assert.ok(d <= 2.6 + 1e-6, `${slug} (${type}) slot ${slots[i]}: the module's home is ${d.toFixed(2)} m from the scene's`);
            checked++;
        });
    }
    for (const t of ["P", "P-rare", "I", "W", "L", "C", "X"]) assert.ok(types.has(t), `no ${t} recipe in the sample`);
    assert.ok(checked >= 450, `checked ${checked}`);
    assert.ok(worst <= 2.6 + 1e-6);
});
