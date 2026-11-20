import assert from "node:assert/strict";
import test from "node:test";

import type {ActPose} from "@/ark-scene/acts";
import {
    failedTries,
    LiveMatings,
    FAR_SPEED,
    MATING_LIVE_SECONDS,
    MATING_MAX_APART,
    MATING_WALK_MAX,
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

test("not walked across the Ark: different worlds, or long over; a busy animal is left alone; no doubles", () => {
    const a: E = {id: "a", x: 0, z: 0, world: "wild", act: null};
    const town: E = {id: "t", x: 5, z: 0, world: "town", act: null};
    const old: E = {id: "o", x: 3, z: 0, world: "wild", act: null};
    const layer = new LiveMatings(host([a, town, old]));
    layer.add([{key: "1", a: "a", b: "t", t0: 0}], 1);
    layer.step(2);
    assert.equal(now(a), null);
    assert.equal(now(town), null);
    assert.equal(layer.debug()[0].phase, "skipped");
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

test("ARK-MATING-SHOWN: a pair too far apart for half a minute's walk walks (hurries) the whole way, from where each was (no jump)", () => {
    const she: E = {id: "she", x: 0, z: 0, world: "wild", act: null, male: false};
    const he: E = {id: "he", x: MATING_MAX_APART + 240, z: 0, world: "wild", act: null, male: true};
    const layer = new LiveMatings(host([she, he]));
    layer.add([{key: "far", a: "she", b: "he", t0: 0}], 0);
    layer.step(0.05);
    assert.equal(layer.debug()[0].how, "far");
    assert.ok(dist(now(he)!, he) < 1, "he starts where his day had him");
    assert.ok(dist(now(she)!, she) < 0.5, "she starts where her day has her");
    const meet = layer.debug()[0].meet!;
    assert.ok(meet >= MATING_WALK_MAX - 0.01 && meet <= (MATING_MAX_APART + 240) / 2 / FAR_SPEED + MATING_WALK_MAX, "each walks half the way, hurrying");
    let last = {x: now(he)!.x, z: now(he)!.z};
    for (let t = 0.15; t < meet; t += 0.1) {
        layer.step(t);
        assert.ok(dist(now(he)!, last as E) < FAR_SPEED * 0.1 * 1.6 + 0.01, `no jump at ${t.toFixed(1)}`);
        last = {x: now(he)!.x, z: now(he)!.z};
    }
    layer.step(meet + 0.5);
    assert.ok(dist(now(he)!, now(she)!) < 3);
});

test("V1: a housed pair (no day to walk from) is acted in its enclosure: in place, on its own floor, no chase, one mount", () => {
    // Two in one zoo house, 4 m apart, on a floor 2.5 m up; neither has a schedule.
    const housed = (animals: E[], floor: Record<string, number>): LiveMatingsHost<E> => ({...host(animals), scheduleAt: () => null, ground: () => 0, placeOf: (e) => ({x: e.x, z: e.z, yaw: 0, base: floor[e.id]})});
    const she: E = {id: "she", x: 0, z: 0, world: "town", act: null, male: false};
    const he: E = {id: "he", x: 4, z: 0, world: "town", act: null, male: true};
    const layer = new LiveMatings(housed([she, he], {she: 2.5, he: 2.5}));
    layer.add([{key: keyWith(2), a: "she", b: "he", t0: 0}], 0);
    layer.step(0.05);
    const act = layer.debug()[0];
    assert.equal(act.how, "housed");
    assert.equal(act.court, "display", "a courtship in place: a chase would leave the enclosure");
    assert.equal(act.tries, 1, "one mount: she does not walk on through a wall");
    let reach = 0;
    for (let s = 0; s < act.end!; s += 0.5) {
        layer.step(s);
        for (const e of [she, he]) {
            const p = now(e)!;
            reach = Math.max(reach, Math.abs(p.x - 2), Math.abs(p.z));
            assert.ok(p.base >= 2.5 - 1e-9, `on the house's floor at ${s} s, never the ground under it`);
        }
    }
    assert.ok(reach < 2.6, `the two stay between their places (${reach.toFixed(1)} m from the middle)`);
    // Then each is back where it lives.
    layer.step(act.end! + 40);
    assert.equal(now(she), null);
    assert.equal(now(he), null);

    // Two enclosures (two homes' tanks, 70 m apart): he is brought beside her, on her floor, in from small.
    const far: E = {id: "far", x: 70, z: 0, world: "town", act: null, male: true};
    const two = new LiveMatings(housed([she, far], {she: 1.2, far: 6}));
    two.add([{key: "two", a: "she", b: "far", t0: 0}], 0);
    two.step(0.05);
    assert.equal(two.debug()[0].how, "brought");
    assert.ok(Math.abs(dist(now(far)!, she) - 0.28) < 1e-6 && Math.abs(now(far)!.z) < 1e-9, "at her side (she heads +z), a seventh of a body length off");
    assert.equal(now(far)!.yaw, 0, "heading as she does");
    let out = 0;
    const states = new Set<string>();
    for (let s = 0; s < two.debug()[0].end!; s += 0.5) {
        two.step(s);
        for (const e of [she, far]) out = Math.max(out, dist(now(e)!, she));
        states.add(`${now(far)!.state}/${now(she)!.state}`);
    }
    assert.ok(out < 0.29, `neither ever leaves her box: she stays where she lives, he at her side (${out.toFixed(2)} m)`);
    assert.deepEqual(Array.from(states), ["display/scan", "rest/rest"], "he displays to her, then the two rest together: no walk, no mount");
    two.step(0.05);
    assert.equal(now(far)!.base, 1.2, "on her floor");
    assert.ok(now(far)!.scale < 0.5, "in from small");
    assert.ok(dist(now(she)!, she) < 1e-9, "she stays where she lives");
    two.step(8);
    assert.equal(now(far)!.scale, 1);
    two.step(two.debug()[0].end! + 1);
    assert.equal(now(far), null, "and is simply back where he lives");
});

test("a contest first: where the species' males contest and a real rival is near, the two spar, the rival runs off, then the mating goes on", async () => {
    const {contestScript, contestPose} = await import("@/ark-scene/live-matings");
    const stag: E = {id: "stag", x: 0, z: 0, world: "wild", act: null, male: true};
    const hind: E = {id: "hind", x: 6, z: 0, world: "wild", act: null, male: false};
    const rival: E = {id: "rival", x: 0, z: 30, world: "wild", act: null, male: true};
    const h = {...host([stag, hind, rival]), contest: () => "clash" as const, rival: () => rival};
    const live = new LiveMatings<E>(h, (e) => e.id);
    live.add([{key: "m", a: "stag", b: "hind", t0: 100}], 100);
    live.step(101);
    assert.ok(stag.act && rival.act, "the two males are posed");
    assert.equal(hind.act, null, "she is left to her day while they contest");
    assert.deepEqual(live.pins().sort(), ["hind", "rival", "stag"]);
    const c = contestScript({x: 0, z: 0, length: 2, pace: 1}, {x: 0, z: 30, length: 2, pace: 1}, "clash", "m")!;
    // They meet on his ground, face each other, and come together again and again.
    const mid = c.walk + 2.2;
    const m = contestPose(c, true, mid, () => 0, "rival")!;
    const r = contestPose(c, false, mid, () => 0, "stag")!;
    assert.ok(Math.abs(Math.abs(m.yaw - r.yaw) - Math.PI) < 1e-6, "head to head");
    assert.ok(Math.hypot(m.x - r.x, m.z - r.z) < 2.6, "locked together at the clash");
    assert.equal(m.state, "clash");
    // The rival runs off; the male stays.
    const lost = contestPose(c, false, c.end - 0.01, () => 0, "stag")!;
    assert.equal(lost.state, "run");
    assert.ok(Math.hypot(lost.x - c.centre.x, lost.z - c.centre.z) > 9);
    // Then the mating, from where the contest left him.
    live.step(100 + c.end + 1);
    assert.equal(rival.act, null, "the rival is released");
    assert.ok(stag.act && hind.act, "the pair now acts the mating");
    assert.deepEqual(live.debug()[0].phase, "acting");
});

test("no rival near, or a species whose males do not contest: the mating as before", () => {
    const a: E = {id: "a", x: 0, z: 0, world: "wild", act: null, male: true};
    const b: E = {id: "b", x: 6, z: 0, world: "wild", act: null, male: false};
    const live = new LiveMatings<E>({...host([a, b]), contest: () => "clash" as const, rival: () => null}, (e) => e.id);
    live.add([{key: "m", a: "a", b: "b", t0: 0}], 0);
    live.step(1);
    assert.ok(a.act && b.act);
});

test("the mount by the model's plan (ark.json): a bird steps on, a lizard, frog or insect climbs on low, a snake or fish lies alongside", () => {
    assert.equal(mountKind("mammal"), "mount");
    assert.equal(mountKind("bird"), "perch");
    for (const plan of ["reptile", "frog", "arthropod", "turtle", "butterfly"]) assert.equal(mountKind(plan), "low", plan);
    for (const plan of ["snake", "fish", "eel", "cetacean"]) assert.equal(mountKind(plan), "alongside", plan);
});
