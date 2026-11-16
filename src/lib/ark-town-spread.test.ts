/**
 * Kept town animals sharing a place stand apart (the owner, 2026-11-16: dogs and chickens "overlaying each other"):
 * `islands/town/spread.ts` and its pass in `placeTownAnimals`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {overlapsOf, spreadApart, type SpreadMember} from "@/ark-scene/islands/town/spread";
import {arkBody} from "@/ark-scene/stats";
import {inPoly} from "@/ark-scene/islands/town/geom";

test("members on one spot are pushed apart to their bodies' room, the same way every time", () => {
    const make = (): SpreadMember[] => ["d", "a", "c", "b", "e"].map((id) => ({id, x: 0, z: 0, radius: 0.5}));
    const one = make();
    spreadApart(one, (_m, x, z) => ({x, z}));
    assert.equal(overlapsOf(one), 0);
    const two = make().reverse();
    spreadApart(two, (_m, x, z) => ({x, z}));
    assert.deepEqual(one.map((m) => [m.id, m.x.toFixed(6), m.z.toFixed(6)]), two.map((m) => [m.id, m.x.toFixed(6), m.z.toFixed(6)]));
});

test("a bound holds: members pushed against it stay inside", () => {
    const pen = (x: number, z: number) => ({x: Math.min(Math.max(x, -1.5), 1.5), z: Math.min(Math.max(z, -1.5), 1.5)});
    const hens = Array.from({length: 6}, (_, i) => ({id: `hen-${i}`, x: 0.01 * i, z: 0, radius: 0.25}));
    spreadApart(hens, (_m, x, z) => pen(x, z));
    assert.equal(overlapsOf(hens), 0);
    for (const h of hens) assert.ok(Math.abs(h.x) <= 1.5 && Math.abs(h.z) <= 1.5);
});

test("the town's kept animals on the ground: no two of one place inside each other (the fixture town)", () => {
    const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
    const placed = placeTownAnimals(town.animals);
    const groups = new Map<string, SpreadMember[]>();
    let kept = 0;
    for (const animal of town.animals) {
        const info = placed.town.get(animal.id);
        const at = placed.places.get(animal.id);
        if (!info || !at || !animal.area || info.tank || info.display || info.where === "pool" || ["roof", "eave", "ledge", "tall", "belfry", "balcony", "window", "lamp_wall"].includes(info.where)) continue;
        if (info.still && info.where !== "indoor") continue;
        const body = arkBody(animal);
        const key = `${info.area}|${info.place}|${info.where === "indoor" ? "floor" : "ground"}`;
        const list = groups.get(key) ?? [];
        list.push({id: animal.id, x: at.x, z: at.z, radius: Math.min(Math.max(Math.max(body.metres, body.display) * 0.5, 0.12), 1.6)});
        groups.set(key, list);
        kept++;
        // And still inside its enclosure's mask.
        if (info.enclosure && info.where !== "indoor") assert.ok(inPoly(info.enclosure.mask, at.x, at.z), `${animal.model_slug} out of its enclosure`);
    }
    let overlaps = 0;
    let crowded = 0;
    groups.forEach((list) => {
        const o = overlapsOf(list);
        overlaps += o;
        if (o) crowded++;
    });
    assert.ok(kept > 20, `${kept} kept animals on the ground`);
    // (A place too small for its members leaves some touching: at most a few of the town's places.)
    console.log(`kept on the ground ${kept}, overlapping pairs ${overlaps}`);
    assert.ok(overlaps <= Math.floor(kept * 0.01), `${overlaps} overlapping pairs in ${crowded} places of ${groups.size}, ${kept} animals`);
});
