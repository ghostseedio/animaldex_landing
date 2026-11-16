/**
 * p3 (solid): the owner, 2026-11-16, on the live Ark: "I just saw a horse go through a bush." Every walker routes and
 * stands round the solid scenery: the zoo habitats' rockwork, logs, posts, climbing trees, shelters, racks, troughs,
 * mounds and waterholes, the halls' the same, the greens' dead wood and brambles, the flower beds, the garden rooms and
 * ponds, the shrubs (`islands/town/solids.ts`, `islands/town/colliders.ts`); on the wild island its shrubs
 * (`collide/colliders.ts`). A body narrower than a bush's gaps (a mouse, a lizard, a beetle) still goes in.
 */

import assert from "node:assert/strict";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {placeTownAnimals, keepInPen, clearWithin} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townSolids, solidDistance, BUSH_GAP, type SolidKind} from "@/ark-scene/islands/town/solids";
import {townWorldOrigin} from "@/ark-scene/islands";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {buildColliders} from "@/ark-scene/collide/colliders";
import {townSolidAudit} from "@/lib/ark-collide/solid-audit";

const origin = townWorldOrigin();
const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
const placed = placeTownAnimals(town.animals);

test("every kind of solid prop on the town is a collider, from what draws it, the same every build", () => {
    const solids = townSolids(placed.open);
    const set = townColliderSet(placed.open, origin);
    const kinds = new Set(solids.map((s) => s.kind));
    for (const kind of ["rock", "log", "stump", "post", "trunk", "shelter", "hay", "mound", "pond", "bush", "bramble", "bed", "garden_room"] as SolidKind[]) assert.ok(kinds.has(kind), `no ${kind} on the town`);
    const ids = new Set(set.list.map((c) => c.id));
    for (const s of solids) assert.ok(ids.has(`town:${s.id}`), `${s.id} is no collider`);
    // (The farms' troughs, bales and hay shelters were colliders already: `obstacles.ts` props.)
    assert.ok(set.list.some((c) => c.id.startsWith("town:") && c.kind === "building" && /trough/.test(c.id)), "the farms' troughs");
    assert.deepEqual(townSolids(placed.open, {...townPlan()}), solids, "a pure function of the plan and the open enclosures");
    // (The shrubs are solid now, with their gaps; none soft.)
    assert.ok(set.list.every((c) => !c.soft || c.kind !== "shrub"), "no shrub is soft");
});

test("size decides: a body wider than a bush's gaps is blocked at it, a mouse goes in; rock and wood block everyone", () => {
    const set = townColliderSet(placed.open, origin);
    const solids = townSolids(placed.open);
    const at = (kind: SolidKind) => {
        const s = solids.find((q) => q.kind === kind)!;
        return s.shape === "segment" ? {x: (s.ax + s.bx) / 2 + origin.x, z: (s.az + s.bz) / 2 + origin.z} : {x: s.x + origin.x, z: s.z + origin.z};
    };
    for (const kind of ["bush", "bramble", "bed"] as SolidKind[]) {
        const p = at(kind);
        assert.ok(set.blocked(p.x, p.z, 0.2), `a dog in a ${kind}`);
        assert.ok(!set.blocked(p.x, p.z, BUSH_GAP / 2 - 0.02) || solids.some((s) => s.gap === 0 && solidDistance(s, p.x - origin.x, p.z - origin.z) < BUSH_GAP), `a mouse into a ${kind}`);
    }
    for (const kind of ["rock", "log", "stump", "post", "shelter", "garden_room"] as SolidKind[]) {
        const p = at(kind);
        assert.ok(set.blocked(p.x, p.z, 0.03), `a beetle in a ${kind}`);
    }
});

test("the bound: a pose its pen's rails or its enclosure's mask pull back onto a solid thing goes on to a clear point inside", () => {
    const set = townColliderSet(placed.open, origin);
    const room = townSolids(placed.open).find((s) => s.kind === "garden_room" && s.shape === "box")!;
    assert.ok(room.shape === "box");
    // A pen whose edge runs through the room: from far outside, the rails put it in the room; the clearance takes it out.
    const pen = {x: room.x + room.hw + 2, z: room.z, w: 4 + room.hw * 2, d: 8, rot: 0};
    const pose = {x: room.x - 30 + origin.x, z: room.z + origin.z};
    keepInPen(pen, 0.3, pose, origin.x, origin.z, set);
    assert.ok(!set.blocked(pose.x, pose.z, 0.15), "clear of the room");
    const plain = {x: room.x - 30 + origin.x, z: room.z + origin.z};
    keepInPen(pen, 0.3, plain, origin.x, origin.z);
    assert.ok(set.blocked(plain.x, plain.z, 0.15), "without the colliders the rails alone put it in the room (the bug)");
    // Clear already: left alone.
    const free = {x: pose.x, z: pose.z};
    clearWithin(free, 0.15, set, () => true);
    assert.deepEqual(free, pose);
});

test("over a day of the shared schedule, no town walker's body centre stands inside a solid prop, of any kind", (t) => {
    const after = townSolidAudit({hours: 24, step: 90});
    t.diagnostic(`${after.items} walkers, ${after.samples} samples over ${after.props} props (${after.kinds.join(", ")}), ${after.ms} ms`);
    assert.ok(after.items > 60 && after.samples > 60000, `${after.items} walkers, ${after.samples} samples`);
    assert.deepEqual(after.byKind, {}, `inside: ${JSON.stringify(after.pairs)} ${after.examples.join("; ")}`);
    // (And the run measures something: before, with the colliders as they were, bodies stood in them.)
    const before = townSolidAudit({hours: 3, step: 60, before: true});
    t.diagnostic(`before: ${JSON.stringify(before.byKind)}`);
    assert.ok(Object.values(before.byKind).reduce((a, b) => a + b, 0) > 100, "the old colliders let bodies into the props");
});

test("the wild island: its shrubs are solid with their gaps", () => {
    const list = buildColliders(null);
    const shrubs = list.filter((c) => c.kind === "shrub");
    assert.ok(shrubs.length > 0 && shrubs.every((c) => !c.soft && c.gap === BUSH_GAP), "every shrub solid, a mouse's gap");
});
