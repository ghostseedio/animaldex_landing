import assert from "node:assert/strict";
import test from "node:test";

import type {ActPose} from "@/ark-scene/acts";
import {LiveMatings, matingPose, matingScript, MATING_LIVE_SECONDS, MATING_MAX_APART, type LiveMatingsHost} from "@/ark-scene/live-matings";

type E = {id: string; x: number; z: number; world: string; act: ActPose | null; busy?: boolean};

function host(animals: E[]): LiveMatingsHost<E> {
    const byId = new Map(animals.map((a) => [a.id, a]));
    return {
        find: (id) => byId.get(id) ?? null,
        // Each one's day keeps it at home.
        scheduleAt: (e) => ({x: e.x, z: e.z, y: 0, yaw: 0, doing: "graze", aloft: false}),
        ground: () => 0,
        walk: () => 1,
        length: () => 1.2,
        together: (a, b) => a.world === b.world,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: (e) => Boolean(e.busy)
    };
}

/** Read through a call (an assert on `e.act` would narrow it for the rest of the test). */
const now = (e: E): ActPose | null => e.act;
const dist = (p: {x: number; z: number}, q: {x: number; z: number}) => Math.hypot(p.x - q.x, p.z - q.z);

test("a mating: the two walk to each other until they touch, court, nuzzle, lie together, then go back to their day", () => {
    const a: E = {id: "a", x: 0, z: 0, world: "wild", act: null};
    const b: E = {id: "b", x: 20, z: 0, world: "wild", act: null};
    const layer = new LiveMatings(host([a, b]));
    layer.add([{key: "m1", a: "a", b: "b", t0: 1000}], 1000);
    // Before its time: nothing.
    layer.step(999);
    assert.equal(now(a), null);
    // On the way: walking toward each other, closer than they started.
    layer.step(1005);
    assert.equal(now(a)?.state, "walk");
    assert.equal(now(b)?.state, "walk");
    assert.ok(dist(now(a)!, now(b)!) < 20);
    assert.ok(now(a)!.yaw > 0 && now(b)!.yaw < 0, "facing each other's way");
    const script = matingScript({x: 0, z: 0, pace: 1, length: 1.2}, {x: 20, z: 0, pace: 1, length: 1.2})!;
    // At the meeting: touching (within a body length), and named to each other (the collision lane closes them).
    layer.step(1000 + script.walk + 0.5);
    assert.ok(dist(now(a)!, now(b)!) < 1.2, "touching");
    assert.equal(now(a)?.with, "b");
    assert.equal(now(b)?.with, "a");
    // Courtship: the first displays, the other watches.
    layer.step(1000 + script.faced + 1);
    assert.equal(now(a)?.state, "display");
    assert.equal(now(b)?.state, "scan");
    // Heads together.
    layer.step(1000 + script.courted + 1);
    assert.equal(now(a)?.state, "groom_other");
    assert.equal(now(b)?.state, "groom_other");
    // Lying together, side by side, the same way.
    layer.step(1000 + script.nuzzled + 4);
    assert.equal(now(a)?.state, "rest");
    assert.equal(now(b)?.state, "rest");
    assert.equal(now(a)?.yaw, now(b)?.yaw);
    assert.ok(dist(now(a)!, now(b)!) < 1.2);
    assert.deepEqual(new Set(layer.pins()), new Set(["a", "b"]));
    // Parting: walking back home, then their own day again.
    layer.step(1000 + script.paired + 6);
    assert.equal(now(a)?.state, "walk");
    layer.step(1000 + script.paired + 60);
    assert.equal(now(a), null);
    assert.equal(now(b), null);
    assert.deepEqual(layer.pins(), []);
});

test("the same for every viewer: a pose is pure in the time", () => {
    const script = matingScript({x: 3, z: -4, pace: 1.4, length: 0.8}, {x: -10, z: 12, pace: 0.9, length: 1})!;
    for (const s of [0, 3.3, script.walk, script.faced + 2, script.nuzzled + 1, script.paired - 0.1]) {
        assert.deepEqual(matingPose(script, true, s, () => 0, "b"), matingPose(script, true, s, () => 0, "b"));
    }
    assert.equal(matingPose(script, true, -1, () => 0, "b"), null);
    assert.equal(matingPose(script, false, script.paired, () => 0, "a"), null);
});

test("a viewer arriving mid-way sees the mating where it is now, not from its start", () => {
    const a: E = {id: "a", x: 0, z: 0, world: "wild", act: null};
    const b: E = {id: "b", x: 8, z: 0, world: "wild", act: null};
    const layer = new LiveMatings(host([a, b]));
    const script = matingScript({x: 0, z: 0, pace: 1, length: 1.2}, {x: 8, z: 0, pace: 1, length: 1.2})!;
    layer.add([{key: "m", a: "a", b: "b", t0: 500}], 500 + script.courted + 1);
    layer.step(500 + script.courted + 1);
    assert.equal(now(a)?.state, "groom_other");
});

test("not walked across the Ark: different worlds, too far apart, or long over", () => {
    const a: E = {id: "a", x: 0, z: 0, world: "wild", act: null};
    const town: E = {id: "t", x: 5, z: 0, world: "town", act: null};
    const far: E = {id: "f", x: MATING_MAX_APART + 5, z: 0, world: "wild", act: null};
    const old: E = {id: "o", x: 3, z: 0, world: "wild", act: null};
    const layer = new LiveMatings(host([a, town, far, old]));
    layer.add([{key: "1", a: "a", b: "t", t0: 0}, {key: "2", a: "a", b: "f", t0: 0}], 1);
    layer.step(2);
    assert.equal(now(a), null);
    assert.equal(now(town), null);
    assert.equal(now(far), null);
    layer.add([{key: "3", a: "a", b: "o", t0: 0}], MATING_LIVE_SECONDS + 1);
    assert.equal(layer.debug().some((m) => m.key === "3"), false);
});

test("an animal held by something else (a meal, a replay) is left alone; the same mating is not added twice", () => {
    const a: E = {id: "a", x: 0, z: 0, world: "wild", act: null, busy: true};
    const b: E = {id: "b", x: 10, z: 0, world: "wild", act: null};
    const layer = new LiveMatings(host([a, b]));
    layer.add([{key: "m", a: "a", b: "b", t0: 0}], 0);
    layer.add([{key: "m", a: "a", b: "b", t0: 0}], 0);
    assert.equal(layer.size, 1);
    layer.step(3);
    assert.equal(now(a), null);
    assert.equal(now(b)?.state, "walk");
});
