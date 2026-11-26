/**
 * p3 (solid): an enclosure's raised pool is solid to its walkers (`islands/town/raised-pool.ts`). The seat audit (#115's
 * CI, 2026-11-24): a black giant squirrel slept and drank inside small_mammals-3's raised pool, its body in the pool's bed:
 * the pool was in neither the town's solids nor its colliders, and its side step off its spot took it in. Every enclosure
 * with a raised pool (penguins and seals, bears and wolves, small mammals, primates), not just that one; its own swimmers
 * still float on its water.
 */

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import test from "node:test";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {zooLayout} from "@/ark-scene/islands/town/areas";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townSolids} from "@/ark-scene/islands/town/solids";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {raisedPool, raisedPoolDistance, RAISED_POOL_WATER} from "@/ark-scene/islands/town/raised-pool";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {spansCollider} from "@/ark-scene/collide/colliders";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {arkBody} from "@/ark-scene/stats";
import {modelBase} from "@/ark-scene/grounding/base";

/** Every zoo plot open: each enclosure that could hold a raised pool. */
const ALL = townPlan().zoo.slots.map((s) => s.id);

test("every enclosure with a raised pool has it as a solid and a collider over its rim, under its water", () => {
    const layout = zooLayout(ALL);
    const withPools = layout.enclosures.filter((e) => !e.shared && raisedPool(e));
    const types = new Set(withPools.map((e) => e.type));
    for (const type of ["penguin_seal_pools", "bears_wolves", "small_mammals"]) assert.ok(types.has(type as never), `no ${type} pool`);
    const solids = new Map(townSolids(ALL).map((s) => [s.id, s]));
    const set = townColliderSet(ALL, {x: 0, z: 0});
    for (const e of withPools) {
        const pool = raisedPool(e)!;
        assert.deepEqual(solids.get(pool.id), pool, `${e.id}: its pool among the town's solids`);
        const collider = set.list.find((c) => c.id === `town:${pool.id}`);
        assert.ok(collider, `${e.id}: its pool a collider`);
        // (The water's corners a rim's half thickness inside the box: the rim as drawn, `render/scenery.ts`.)
        for (const q of e.pool!) assert.ok(raisedPoolDistance(pool, q.x, q.z) <= -0.17, `${e.id}: its water inside its rim's box`);
        const ground = Math.max(...e.pool!.map((q) => townHeight(q.x, q.z)));
        const c = e.pool!.reduce((t, q) => ({x: t.x + q.x / 4, z: t.z + q.z / 4}), {x: 0, z: 0});
        assert.ok(set.blocked(c.x, c.z, 0.1), `${e.id}: a walker blocked in its middle`);
        // A walker on the ground meets it; a swimmer floating on its water passes over it.
        assert.ok(spansCollider(collider!, ground, 0.3), `${e.id}: a walker's body spans it`);
        assert.ok(!spansCollider(collider!, ground + RAISED_POOL_WATER, 0.3), `${e.id}: a swimmer on its water does not`);
    }
});

test("no walker placed in a raised pool (the seat audit's black giant squirrel among them); its swimmers on its water", () => {
    const raw = JSON.parse(gunzipSync(readFileSync("tests/ark-seat/snapshot.json.gz")).toString());
    const town = arkIslandSnapshot(decodeArkSnapshot(raw)!, "town");
    const placed = placeTownAnimals(town.animals);
    let walkers = 0;
    let swimmers = 0;
    const bad: string[] = [];
    const dry: string[] = [];
    for (const animal of town.animals) {
        const info = placed.town.get(animal.id);
        const at = placed.places.get(animal.id);
        const pool = info?.enclosure ? raisedPool(info.enclosure) : null;
        if (!info || !at || !pool || info.tank) continue;
        const d = raisedPoolDistance(pool, at.x, at.z);
        if (info.where === "pool") {
            swimmers++;
            const ground = Math.max(...info.enclosure!.pool!.map((q) => townHeight(q.x, q.z)));
            if (d >= 0) dry.push(`${animal.model_slug} ${animal.id} in ${info.enclosure!.id}: ${d.toFixed(2)} m out`);
            assert.ok(Math.abs(at.ground - (ground + RAISED_POOL_WATER)) < 1e-9, `${animal.model_slug} on its pool's water`);
            continue;
        }
        walkers++;
        // (Its body as drawn clear: half its drawn length, its middle off the rim's outside. Held indoors (a primate house's
        // climbers on its frames) is the house's own.)
        if (info.enclosure!.indoor) continue;
        const length = arkBody(animal, modelBase(animal.model_slug)?.plan ?? null).display;
        if (d < length * 0.5) bad.push(`${animal.model_slug} ${animal.id} in ${info.enclosure!.id}: ${d.toFixed(2)} m`);
    }
    const squirrel = placed.places.get("6cb25d14-773f-43b7-b43d-36db2e792fc7");
    assert.ok(squirrel, "the seat audit's black giant squirrel is placed");
    const host = placed.town.get("6cb25d14-773f-43b7-b43d-36db2e792fc7")!.enclosure!;
    assert.equal(host.id, "small_mammals-3");
    assert.ok(raisedPoolDistance(raisedPool(host)!, squirrel.x, squirrel.z) > 0.3, "the squirrel's drawn body out of small_mammals-3's pool");
    console.log(`raised pools: ${walkers} walkers, ${swimmers} swimmers in enclosures with one`);
    assert.ok(walkers > 10, `${walkers} walkers measured`);
    assert.deepEqual(bad, []);
    assert.deepEqual(dry, [], "every swimmer in its pool");
});
