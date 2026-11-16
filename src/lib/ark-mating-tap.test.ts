import assert from "node:assert/strict";
import test from "node:test";

import type {ActPose} from "@/ark-scene/acts";
import {LiveMatings, MATING_AFTER_SECONDS, MATING_WALK_MAX, matingPose, matingScript, type LiveMatingsHost, type MatingBody} from "@/ark-scene/live-matings";
import {easeToward, framePair, PAIR_FRAME_MAX_APART} from "@/ark-scene/pair-frame";

// Owner 2026-11-16, on the live Ark: "when i click a mating log, i don't see 2 of its kind next to each other".

const FOV = 38;
const view = {fovDeg: FOV, aspect: 16 / 9, single: 1.5, max: 60};

test("two in one picture: the middle between them, far enough back for both, never closer than the one alone", () => {
    const a = {x: 0, y: 0.1, z: 0, length: 0.2};
    const b = {x: 6, y: 0.3, z: 8, length: 0.25};
    const f = framePair(a, b, view)!;
    assert.deepEqual([f.x, f.y, f.z], [3, 0.2, 4]);
    assert.equal(f.apart, Math.hypot(6, 0.2, 8));
    // Each body, seen square on from the middle, is inside the view's narrower half-width (with room to spare).
    const half = Math.tan((FOV * Math.PI) / 360) * Math.min(view.aspect, 1);
    for (const p of [a, b]) {
        const off = Math.hypot(p.x - f.x, p.y - f.y, p.z - f.z) + p.length / 2;
        assert.ok(off < f.distance * half * 0.75, `${off.toFixed(2)} m from the middle fits at ${f.distance.toFixed(1)} m`);
    }
    // Side by side (a mount, resting together): the one alone's close-up is already right.
    const close = framePair(a, {x: 0.1, y: 0.1, z: 0, length: 0.2}, view)!;
    assert.equal(close.distance, view.single);
    // An upright phone (narrow) stands further back than a wide screen.
    assert.ok(framePair(a, b, {...view, aspect: 9 / 19.5})!.distance > f.distance);
    // Never past the view's farthest.
    assert.equal(framePair(a, {x: 39, y: 0, z: 0, length: 1}, {...view, max: 20})!.distance, 20);
    // Too far apart to make either out: none (the first alone, as before).
    assert.equal(framePair(a, {x: PAIR_FRAME_MAX_APART + 1, y: 0, z: 0, length: 1}, view), null);
});

test("the view eases to the pair the same at any frame rate", () => {
    const once = easeToward(0, 10, 0.1);
    const twice = easeToward(easeToward(0, 10, 0.05), 10, 0.05);
    assert.ok(Math.abs(once - twice) < 1e-9);
    assert.ok(once > 0 && once < 10);
    assert.equal(easeToward(4, 10, 0), 4);
});

type E = {id: string; x: number; z: number; world: string; act: ActPose | null};

function host(animals: E[]): LiveMatingsHost<E> {
    const byId = new Map(animals.map((a) => [a.id, a]));
    return {
        find: (id) => byId.get(id) ?? null,
        scheduleAt: (e) => ({x: e.x, z: e.z, y: 0, yaw: 0, doing: "graze", aloft: false}),
        ground: () => 0,
        walk: () => 0.3,
        length: () => 0.2,
        height: () => 0.1,
        plan: () => "arthropod",
        courtship: () => null,
        male: () => null,
        together: (a, b) => a.world === b.world,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: () => false
    };
}

test("the tap's window: the partner while their mating is acted (walk, mount, rest, parting), none before or after", () => {
    const a: E = {id: "a", x: 0, z: 0, world: "town", act: null};
    const b: E = {id: "b", x: 9, z: 0, world: "town", act: null};
    const town: E = {id: "t", x: 2, z: 0, world: "wild", act: null};
    const layer = new LiveMatings(host([a, b, town]));
    layer.add([{key: "m1", a: "a", b: "b", t0: 1000}, {key: "m2", a: "a", b: "t", t0: 1000}], 1000);
    layer.step(999);
    assert.equal(layer.partnerOf("a"), null, "not started");
    layer.step(1003);
    assert.equal(layer.partnerOf("a"), "b", "walking to each other");
    assert.equal(layer.partnerOf("b"), "a");
    assert.equal(layer.partnerOf("t"), null, "a pair in two worlds is never acted");
    layer.step(1060);
    assert.equal(layer.partnerOf("a"), "b", "together a minute on");
    // Long over: none (the tap then frames the first alone, and nothing says they mate now).
    for (let t = 1060; t < 1000 + 1200; t += 5) layer.step(t);
    assert.equal(layer.partnerOf("a"), null);
});

test("together while the line is read: met within half a minute, side by side for two minutes after the mount", () => {
    // The log's line reaches a viewer 3 to 55 s after the mating's time (measured live 2026-11-16) and stays 15 s.
    assert.equal(MATING_WALK_MAX, 30);
    assert.equal(MATING_AFTER_SECONDS, 120);
    const body = (x: number): MatingBody => ({x, z: 0, pace: 0.3, length: 0.2, height: 0.1, plan: "arthropod", courtship: null, male: null});
    for (const apart of [1, 10, 40, 100, 160]) {
        const sc = matingScript(body(0), body(apart), `k${apart}`)!;
        assert.ok(sc.walk <= MATING_WALK_MAX, `${apart} m apart: met after ${sc.walk.toFixed(0)} s`);
        // From the meeting (and its courtship) to the parting they are never more than a few bodies apart.
        const met = sc.courted;
        for (let s = met; s < sc.paired; s += 1) {
            const p = matingPose(sc, true, s, () => 0, "b")!;
            const q = matingPose(sc, false, s, () => 0, "a")!;
            assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 1.5, `${apart} m pair together at ${s} s`);
        }
        assert.ok(met <= 55, `${apart} m pair court by ${met.toFixed(0)} s`);
        assert.ok(sc.paired >= 55 + 15 + 60, `${apart} m pair together until ${sc.paired.toFixed(0)} s`);
    }
});
