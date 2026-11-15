import assert from "node:assert/strict";
import test from "node:test";

import type {ActPose} from "@/ark-scene/acts";
import {
    failedTries,
    LiveMatings,
    MATING_LIVE_SECONDS,
    MATING_MAX_APART,
    matingPose,
    matingScript,
    mountKind,
    mountSeconds,
    type Courtship,
    type LiveMatingsHost,
    type MatingBody
} from "@/ark-scene/live-matings";

type E = {id: string; x: number; z: number; world: string; act: ActPose | null; busy?: boolean; male?: boolean | null; plan?: string; court?: Courtship | null; length?: number};

function host(animals: E[]): LiveMatingsHost<E> {
    const byId = new Map(animals.map((a) => [a.id, a]));
    return {
        find: (id) => byId.get(id) ?? null,
        // Each one's day keeps it at home.
        scheduleAt: (e) => ({x: e.x, z: e.z, y: 0, yaw: 0, doing: "graze", aloft: false}),
        ground: () => 0,
        walk: () => 1,
        length: (e) => e.length ?? 2,
        height: () => 1.4,
        plan: (e) => e.plan ?? "quadruped",
        courtship: (e) => e.court ?? null,
        male: (e) => e.male ?? null,
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
const body = (x: number, over: Partial<MatingBody> = {}): MatingBody => ({x, z: 0, pace: 1, length: 2, height: 1.4, plan: "quadruped", courtship: null, male: null, ...over});
/** A key whose mating has this many failed tries. */
const keyWith = (tries: number) => {
    for (let i = 0; ; i++) if (failedTries(`k${i}`) === tries) return `k${i}`;
};

test("a mammal mating: they meet, he chases her, mounts her from behind (reared up, lifted), it lasts, they rest, then part", () => {
    const key = keyWith(0);
    const female: E = {id: "f", x: 0, z: 0, world: "wild", act: null, male: false};
    const male: E = {id: "m", x: 20, z: 0, world: "wild", act: null, male: true};
    const layer = new LiveMatings(host([female, male]));
    // The record's first is the female: the male still mounts.
    layer.add([{key, a: "f", b: "m", t0: 1000}], 1000);
    const sc = matingScript(body(0, {male: false}), body(20, {male: true}), key)!;
    assert.equal(sc.firstMounts, false);
    assert.equal(sc.court, "chase");
    assert.equal(sc.mount, "mount");
    layer.step(999);
    assert.equal(now(female), null);
    // Walking to each other.
    layer.step(1003);
    assert.equal(now(male)?.state, "walk");
    assert.ok(dist(now(male)!, now(female)!) < 20);
    // The chase: both moving, he behind her the way she goes.
    layer.step(1000 + sc.walk + 5);
    assert.equal(now(female)?.state, "walk");
    assert.equal(now(male)?.state, "walk");
    const f = now(female)!;
    const m = now(male)!;
    const ahead = (m.x - f.x) * Math.sin(f.yaw) + (m.z - f.z) * Math.cos(f.yaw);
    assert.ok(ahead < 0, "he follows behind her");
    // On her: reared up (nose up), lifted, behind her centre, the same way; she stands.
    const last = sc.attempts[sc.attempts.length - 1];
    assert.ok(last.took);
    layer.step(1000 + last.on + 3);
    const on = now(male)!;
    const her = now(female)!;
    assert.ok(on.pitch < -0.4, "reared up");
    assert.ok(on.base > 0.3, "lifted onto her");
    assert.equal(on.yaw, her.yaw);
    assert.ok(dist(on, her) < 2, "over her back");
    assert.equal(her.state, "scan");
    assert.equal(on.with, "f");
    // It lasts with the body (a 2 m animal: 16 s).
    assert.ok(Math.abs(last.off - last.on - mountSeconds("mount", 2)) < 1e-9);
    assert.equal(mountSeconds("mount", 2), 16);
    // Resting together, then parting back to their day.
    layer.step(1000 + sc.mounted + 4);
    assert.equal(now(male)?.state, "rest");
    assert.equal(now(female)?.state, "rest");
    assert.equal(now(male)?.pitch, 0);
    layer.step(1000 + sc.paired + 60);
    assert.equal(now(male), null);
    assert.equal(now(female), null);
    assert.deepEqual(layer.pins(), []);
});

test("a try can fail: she walks on from under him, he slides off and follows, then mounts again", () => {
    const sc = matingScript(body(0, {male: true}), body(12, {male: false}), keyWith(1))!;
    assert.equal(sc.attempts.length, 2);
    const [miss, hit] = sc.attempts;
    assert.equal(miss.took, false);
    assert.ok(hit.took);
    assert.ok(dist(miss.spot, hit.spot) > 1.5, "she moved on a body length");
    // During the miss she is already moving off; he is still up.
    const she = matingPose(sc, false, miss.on + 1.5, () => 0, "a")!;
    const he = matingPose(sc, true, miss.on + 0.5, () => 0, "b")!;
    assert.equal(she.state, "walk");
    assert.ok(he.base > 0.3);
    // Off between the two.
    const between = matingPose(sc, true, miss.end + 0.5, () => 0, "b")!;
    assert.equal(between.base, 0);
    assert.ok(hit.off - hit.on > miss.off - miss.on, "the one that takes lasts longer");
    // Never more than two misses, the same for every viewer.
    for (let i = 0; i < 50; i++) assert.ok(failedTries(`x${i}`) <= 2);
    assert.equal(failedTries("same"), failedTries("same"));
});

test("courtship from the species: a peacock displays (she watches), cranes dance together; birds step onto her back", () => {
    const peafowl = matingScript(body(0, {male: true, plan: "walking_bird", courtship: "display", length: 1.1}), body(8, {male: false, plan: "walking_bird", length: 0.9}), keyWith(0))!;
    assert.equal(peafowl.court, "display");
    assert.equal(peafowl.mount, "perch");
    const s = peafowl.walk + 3;
    assert.equal(matingPose(peafowl, true, s, () => 0, "b")?.state, "display");
    assert.equal(matingPose(peafowl, false, s, () => 0, "a")?.state, "scan");
    // On her back, level, and she crouches.
    const hit = peafowl.attempts[0];
    const he = matingPose(peafowl, true, hit.on + 1, () => 0, "b")!;
    const she = matingPose(peafowl, false, hit.on + 1, () => 0, "a")!;
    assert.ok(Math.abs(he.pitch) < 0.1);
    assert.ok(he.base > 0.7, "standing on her back");
    assert.equal(she.state, "rest");
    assert.ok(hit.off - hit.on <= 8, "a bird's is brief");

    const cranes = matingScript(body(0, {plan: "walking_bird", courtship: "dance"}), body(8, {plan: "walking_bird"}), keyWith(0))!;
    assert.equal(cranes.court, "dance");
    assert.equal(matingPose(cranes, true, cranes.walk + 2, () => 0, "b")?.state, "dance");
    assert.equal(matingPose(cranes, false, cranes.walk + 2, () => 0, "a")?.state, "dance");
    // Body plans.
    assert.equal(mountKind("flying_bird"), "perch");
    assert.equal(mountKind("turtle"), "low");
    assert.equal(mountKind("fish"), "alongside");
    assert.equal(mountKind(null), "mount");
    // A big animal's lasts longer than a small one's.
    assert.ok(mountSeconds("mount", 5) > mountSeconds("mount", 0.5));
});

test("the same for every viewer: a pose is pure in the time; a viewer arriving mid-way sees it where it is now", () => {
    const sc = matingScript(body(3, {male: true}), body(-10, {male: false, length: 1}), keyWith(2))!;
    for (const s of [0, 3.3, sc.walk, sc.courted - 0.1, sc.attempts[1].on + 0.5, sc.paired - 0.1]) {
        assert.deepEqual(matingPose(sc, true, s, () => 0, "b"), matingPose(sc, true, s, () => 0, "b"));
    }
    assert.equal(matingPose(sc, true, -1, () => 0, "b"), null);
    assert.equal(matingPose(sc, false, sc.paired, () => 0, "a"), null);

    const a: E = {id: "a", x: 0, z: 0, world: "wild", act: null, male: true};
    const b: E = {id: "b", x: 8, z: 0, world: "wild", act: null, male: false};
    const layer = new LiveMatings(host([a, b]));
    const key = keyWith(0);
    const live = matingScript(body(0, {male: true}), body(8, {male: false}), key)!;
    const at = 500 + live.attempts[0].on + 2;
    layer.add([{key, a: "a", b: "b", t0: 500}], at);
    layer.step(at);
    assert.ok(now(a)!.pitch < -0.4, "mounted already");
});

test("not walked across the Ark: different worlds, too far apart, or long over; a busy animal is left alone; no doubles", () => {
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

    const x: E = {id: "x", x: 0, z: 0, world: "wild", act: null, busy: true};
    const y: E = {id: "y", x: 10, z: 0, world: "wild", act: null};
    const busy = new LiveMatings(host([x, y]));
    busy.add([{key: "m", a: "x", b: "y", t0: 0}], 0);
    busy.add([{key: "m", a: "x", b: "y", t0: 0}], 0);
    assert.equal(busy.size, 1);
    busy.step(3);
    assert.equal(now(x), null);
    assert.equal(now(y)?.state, "walk");
});
