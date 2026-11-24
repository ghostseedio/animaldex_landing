/**
 * ARK-MATING-SHOWN (AnimalDex docs/ark/DECISIONS.md 416): every mating is drawn where it can be seen, a pouch birth
 * shows its joey, and an adult looking for a mate roams. The pictures' own check is `scripts/ark-seen-shots.mjs`
 * (READABLE per kind, on saved real reads); these are the pure parts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {matingPose, matingScript, meetingSpot, type MatingBody} from "@/ark-scene/live-matings";
import {LiveSeeking, seekLive, seekNear, seekPose, SEEK_FAR, SEEK_LOOK, SEEK_NEAR, SEEK_WALK} from "@/ark-scene/live-seeking";
import type {ActPose} from "@/ark-scene/acts";

const body = (x: number, z: number, o: Partial<MatingBody> = {}): MatingBody => ({x, z, pace: 1, length: 1, height: 0.5, plan: "mammal", courtship: null, male: null, ...o});
const flat = () => 0;

test("a pair meets at its midpoint when nothing is over it", () => {
    const sc = matingScript(body(0, 0), body(10, 0), "k", {clear: () => true})!;
    assert.ok(Math.abs((sc.to.m.x + sc.to.f.x) / 2 - 5) < 1e-6);
});

test("a pair whose midpoint is under a bridge meets beside it, where the mount can be seen", () => {
    // A bridge over x in [3, 7]: the midpoint (5) is under it.
    const under = (p: {x: number; z: number}) => p.x >= 3 && p.x <= 7;
    const sc = matingScript(body(0, 0), body(10, 0), "bridge", {clear: (p) => !under(p)})!;
    for (const t of [sc.walk + 0.1, ...sc.attempts.map((a) => (a.on + a.off) / 2), sc.mounted + 5]) {
        for (const first of [true, false]) {
            const pose = matingPose(sc, first, t, flat, "x")!;
            assert.ok(!under(pose), `${first ? "first" : "second"} at ${t.toFixed(1)} s is clear (x ${pose.x.toFixed(2)})`);
        }
    }
});

test("both walk from where they were (no jump), to each other", () => {
    const sc = matingScript(body(0, 0), body(12, 4), "walk", {clear: (p) => p.x < 4 || p.x > 8})!;
    for (const first of [true, false]) {
        let last: ActPose | null = null;
        for (let t = 0; t < sc.paired; t += 0.1) {
            const pose = matingPose(sc, first, t, flat, "x")!;
            if (last) assert.ok(Math.hypot(pose.x - last.x, pose.z - last.z) < 1.5, `no jump at ${t.toFixed(1)} s`);
            last = pose;
        }
        const start = matingPose(sc, first, 0, flat, "x")!;
        assert.deepEqual([Math.round(start.x), Math.round(start.z)], first ? [0, 0] : [12, 4], "starts where its day had it");
    }
    const m = matingPose(sc, true, sc.mounted - 1, flat, "x")!;
    const f = matingPose(sc, false, sc.mounted - 1, flat, "x")!;
    assert.ok(Math.hypot(m.x - f.x, m.z - f.z) < 1.2, "together at the mount");
});

test("a chase that would end in the water is a display in place", () => {
    // Water everywhere but a strip round the line between them.
    const sc = matingScript(body(0, 0), body(4, 0), "chase", {clear: (p) => Math.abs(p.z) < 0.5})!;
    assert.equal(sc.chase, null);
    assert.equal(sc.court, "display");
});

test("the meeting spot: nearest clear on the line, then round the middle; null when nothing is", () => {
    assert.deepEqual(meetingSpot({x: 0, z: 0}, {x: 10, z: 0}, 1, (p) => p.x <= 4), {x: 4, z: 0});
    const ring = meetingSpot({x: 0, z: 0}, {x: 2, z: 0}, 1, (p) => p.z > 1.5)!;
    assert.ok(ring.z > 1.5);
    assert.equal(meetingSpot({x: 0, z: 0}, {x: 2, z: 0}, 1, () => false), null);
});

test("an adult looking for a mate roams a loop through its day's place, walks, then stops and looks about", () => {
    const at = {x: 5, z: 5, yaw: 0};
    const still = seekPose("a1", at, 100, 1, 1, 0, flat);
    assert.deepEqual([still.x, still.z], [5, 5], "with no reach: where its day has it");
    let walking = 0;
    let looking = 0;
    let far = 0;
    for (let t = 0; t < (SEEK_WALK + SEEK_LOOK) * 3; t += 0.25) {
        const p = seekPose("a1", at, t, 1, 1, 1, flat);
        if (p.state === "walk") walking++;
        else looking++;
        far = Math.max(far, Math.hypot(p.x - at.x, p.z - at.z));
        assert.ok(Math.hypot(p.x - at.x, p.z - at.z) <= 6.01, "within its loop");
    }
    assert.ok(walking > looking && looking > 0, "mostly walking, with stops to look");
    assert.ok(far > 1.5, "it goes somewhere");
});

test("the seeking layer: only while its day has it about on the ground, never over another act", () => {
    type E = {id: string; doing: string; busy: boolean; act: ActPose | null};
    const es: E[] = [{id: "a", doing: "wander", busy: false, act: null}, {id: "b", doing: "sleep", busy: false, act: null}, {id: "c", doing: "graze", busy: true, act: null}];
    const layer = new LiveSeeking<E>({
        find: (id) => es.find((e) => e.id === id) ?? null,
        scheduleAt: (e) => ({x: 0, z: 0, yaw: 0, doing: e.doing, aloft: false}),
        ground: flat,
        walk: () => 1,
        length: () => 1,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: (e) => e.busy
    });
    layer.set(["a", "b", "c"], 0);
    layer.step(10);
    assert.ok(es[0].act, "a roams");
    assert.equal(es[1].act, null, "b sleeps");
    assert.equal(es[2].act, null, "c is in another act");
    layer.set([], 10);
    layer.step(20);
    assert.equal(es[0].act, null, "let go once the state has gone");
    assert.equal(layer.size, 0);
});

/**
 * ZOOGLITCH (the owner, 2026-11-24: zoo enclosures "glitch when I get close"): the scene's loop in small. Each frame the
 * seeking layer steps, then the scene poses every animal in range (`posedAt`) and draws the ones whose pose is in view.
 * The live Ark's mate-seeking eland: its day has it in view, its loop (three lengths out) takes it out of view.
 */
function seekingScene(rule: "drawn" | "posed") {
    type E = {id: string; held?: boolean; visitor?: boolean; act: ActPose | null; posedAt?: number; drawn: boolean; drawnAt: {x: number; z: number} | null};
    const eland: E = {id: "eland", act: null, drawn: false, drawnAt: null};
    // (The camera close on its day's place: a metre and a half of the loop out, it is off the screen.)
    const inView = (x: number) => x < 1.5;
    let now = 0;
    const layer = new LiveSeeking<E>({
        // The rule before: drawn this frame (`middle`). After: posed by the scene in the last second (`seekLive`).
        find: () => (rule === "drawn" ? (eland.drawn ? eland : null) : seekLive(eland, now) ? eland : null),
        scheduleAt: () => ({x: 0, z: 0, yaw: 0, doing: "wander", aloft: false}),
        ground: flat,
        walk: () => 1.2,
        length: () => 2.5,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: () => false
    });
    layer.set(["eland"], -100);
    const frames: Array<{acting: boolean; at: {x: number; z: number} | null}> = [];
    for (let i = 0; i < 1800; i++) {
        layer.step(now);
        // The scene: its pose (the act's, else its day's), posed whether or not in view; drawn only in view.
        const at = eland.act ? {x: eland.act.x, z: eland.act.z} : {x: 0, z: 0};
        eland.posedAt = now;
        eland.drawn = inView(at.x);
        eland.drawnAt = eland.drawn ? at : null;
        frames.push({acting: Boolean(eland.act), at: eland.drawnAt});
        now += 1 / 60;
    }
    let flips = 0;
    let jump = 0;
    for (let i = 1; i < frames.length; i++) {
        if (frames[i].acting !== frames[i - 1].acting) flips++;
        const a = frames[i - 1].at;
        const b = frames[i].at;
        if (a && b) jump = Math.max(jump, Math.hypot(b.x - a.x, b.z - a.z));
    }
    return {flips, jump, drawnFlips: frames.slice(1).filter((f, i) => Boolean(f.at) !== Boolean(frames[i].at)).length};
}

test("zoo close-up: taken only while drawn, the seeking act flickered (the eland's 13 m blink)", () => {
    const before = seekingScene("drawn");
    assert.ok(before.flips > 6, `the act came and went: ${before.flips} times in 30 s`);
});

test("zoo close-up: taken while the scene poses it, the act holds and nothing jumps", () => {
    const after = seekingScene("posed");
    assert.equal(after.flips, 1, "taken once and held: it never comes and goes");
    assert.ok(after.drawnFlips <= 2, `drawn in and out at most once each way as it walks its loop (${after.drawnFlips})`);
    assert.ok(after.jump < 0.1, `no jump between frames (${after.jump.toFixed(3)} m)`);
});

test("seekLive: posed in the last second, never whether drawn", () => {
    assert.equal(seekLive({posedAt: 10}, 10.5), true);
    assert.equal(seekLive({posedAt: 10}, 11.5), false, "out of range a second: let go");
    assert.equal(seekLive({}, 10), false, "never posed");
    assert.equal(seekLive({posedAt: 10, held: true}, 10), false);
    assert.equal(seekLive({posedAt: 10, visitor: true}, 10), false);
});

test("the seeking act eases out from its day's place when it starts, however long the state has been on", () => {
    type E = {act: ActPose | null};
    const e: E = {act: null};
    let found = false;
    const layer = new LiveSeeking<E>({find: () => (found ? e : null), scheduleAt: () => ({x: 5, z: 5, yaw: 0, doing: "wander", aloft: false}), ground: flat, walk: () => 1, length: () => 2, setAct: (x, pose) => (x.act = pose), busy: () => false});
    layer.set(["a"], 0);
    layer.step(500);
    assert.equal(e.act, null, "not posed by the scene: nothing");
    found = true;
    layer.step(1000);
    assert.deepEqual([e.act!.x, e.act!.z], [5, 5], "its first frame: where its day has it (it came into range: no jump onto its loop)");
    let most = 0;
    let last = {x: 5, z: 5};
    for (let t = 1000; t < 1006; t += 1 / 60) {
        layer.step(t);
        most = Math.max(most, Math.hypot(e.act!.x - last.x, e.act!.z - last.z));
        last = {x: e.act!.x, z: e.act!.z};
    }
    assert.ok(Math.hypot(last.x - 5, last.z - 5) > 1, "then out on its loop");
    assert.ok(most < 0.15, `walking there, never a jump (${most.toFixed(3)} m a frame)`);
});

test("the seeking loop keeps inside its enclosure (its bound), on the ground there", () => {
    type E = {act: ActPose | null};
    const e: E = {act: null};
    const fence = 5.5;
    const layer = new LiveSeeking<E>({
        find: () => e,
        scheduleAt: () => ({x: 5, z: 5, yaw: 0, doing: "wander", aloft: false}),
        ground: (x) => x * 0.01,
        walk: () => 1,
        length: () => 4,
        setAct: (x, pose) => (x.act = pose),
        busy: () => false,
        bound: (_, pose) => {
            pose.x = Math.min(pose.x, fence);
        }
    });
    layer.set(["a"], 0);
    let outside = 0;
    let off = 0;
    for (let t = 0; t < 60; t += 0.1) {
        layer.step(t);
        if (e.act!.x > fence + 1e-9) outside++;
        off = Math.max(off, Math.abs(e.act!.base - e.act!.x * 0.01));
    }
    assert.equal(outside, 0, "never past its fence");
    assert.ok(off < 1e-9, "on the ground where the bound put it");
});

test("a clutch's countdown: the bar from the laying to the hatching, about how long in words, gone once due", async () => {
    const {arkEggCountdown} = await import("@/ark-scene/seen/hooks");
    const H = 3_600_000;
    const c = arkEggCountdown(0, 10 * H, 5 * H)!;
    assert.equal(c.share, 0.5);
    assert.equal(c.text, "Hatches in about 5 h · if all goes well");
    assert.equal(arkEggCountdown(0, H, 0.5 * H)!.left, "30 min");
    assert.equal(arkEggCountdown(0, 100 * H, 0)!.left, "4 days");
    assert.equal(arkEggCountdown(0, H, H), null, "due: none");
    assert.equal(arkEggCountdown(0, 10 * H, 5 * H, {hatchesIn: "Éclosion dans environ {time}", ifAllGoesWell: "si tout va bien", hours: "{n} h"})!.text, "Éclosion dans environ 5 h · si tout va bien");
});

test("words: ark.eggs in every one of the 45 languages, translated, with its placeholders", async () => {
    const {readdirSync, readFileSync} = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(__dirname, "..", "data", "locales");
    const files = ["en.json", "id.json", ...readdirSync(path.join(dir, "ark")).filter((f) => f.endsWith(".json")).map((f) => path.join("ark", f))];
    assert.equal(files.length, 45);
    const keys = ["eggsInNest", "hatchesIn", "ifAllGoesWell", "minutes", "hours", "days"];
    const en = JSON.parse(readFileSync(path.join(dir, "en.json"), "utf8")).ark.eggs;
    const {ARK_SEEN_ENGLISH} = await import("@/ark-scene/seen/hooks");
    for (const key of keys) assert.equal(en[key], (ARK_SEEN_ENGLISH as Record<string, string>)[key], `en ${key} is the fallback's`);
    for (const file of files) {
        const eggs = JSON.parse(readFileSync(path.join(dir, file), "utf8")).ark.eggs;
        assert.deepEqual(Object.keys(eggs), keys, file);
        for (const key of keys) {
            const text = eggs[key] as string;
            assert.ok(text.trim() === text && text.length > 0 && text.length <= 48, `${file} ${key}`);
            assert.equal((text.match(/\{[a-z]+\}/g) ?? []).join(), key === "hatchesIn" ? "{time}" : ["minutes", "hours", "days"].includes(key) ? "{n}" : "", `${file} ${key} placeholders`);
        }
        if (file !== "en.json") for (const key of ["eggsInNest", "hatchesIn", "ifAllGoesWell"]) assert.notEqual(eggs[key], en[key], `${file} ${key} untranslated`);
    }
});

test("laying: after the mating, she walks to her spot, settles, the clutch is laid there and stays until it hatches; the young come out of it", async () => {
    const {LiveClutches, LAY_AT, LAY_WALK} = await import("@/ark-scene/live-clutches");
    type E = {id: string; female: boolean; act: ActPose | null; at: {x: number; z: number}};
    const es: E[] = [{id: "m", female: false, act: null, at: {x: 0, z: 0}}, {id: "f", female: true, act: null, at: {x: 10, z: 0}}, {id: "y1", female: false, act: null, at: {x: 30, z: 30}}, {id: "y2", female: false, act: null, at: {x: 31, z: 30}}];
    const nests = new Map<string, {x: number; z: number; hatched: boolean}>();
    const layer = new LiveClutches<E>({
        find: (id) => es.find((e) => e.id === id) ?? null,
        female: (e) => e.female,
        scheduleAt: (e) => ({x: e.at.x, z: e.at.z, yaw: 0}),
        ground: flat,
        length: () => 1,
        walk: () => 1,
        spawns: () => false,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: () => false,
        matingEnd: () => 100,
        clutchSpot: () => ({x: 5, z: 0}),
        lay: (key, at) => nests.set(key, {x: at.x, z: at.z, hatched: false}),
        hatch: (key) => {
            nests.get(key)!.hatched = true;
        },
        where: (key) => (nests.has(key) ? {...nests.get(key)!, y: 0, size: 0.5} : null),
        remove: (key) => nests.delete(key)
    });
    layer.addLaid([{key: "laid:1", parents: ["m", "f"], eggs: 3, t0: 50, hatchAt: 5000}]);
    layer.step(60);
    assert.equal(es[1].act, null, "nothing before the mating is over");
    layer.step(100 + LAY_WALK / 2);
    const walking = es[1].act as ActPose | null;
    assert.ok(walking && walking.state === "walk" && walking.x > 5 && walking.x < 10, "the mother (the female) walks from where she was to her spot");
    assert.equal(es[0].act, null, "not the father");
    layer.step(100 + LAY_AT + 0.1);
    assert.deepEqual(nests.get("laid:1"), {x: 5, z: 0, hatched: false}, "laid where she stood for the mount");
    layer.step(1000);
    assert.equal(es[1].act, null, "back to her day");
    assert.ok(nests.has("laid:1"), "the clutch stays");
    layer.addHatched([{key: "hatch:1", parents: ["f", "m"], young: ["y1", "y2"], t0: 2000}]);
    layer.step(1990);
    assert.equal(es[2].act?.hidden, true, "out of sight in the egg until it begins");
    layer.step(2003);
    assert.equal(nests.get("laid:1")!.hatched, true, "her clutch hatches");
    const out = es[2].act as ActPose | null;
    assert.ok(out && !out.hidden && Math.hypot(out.x - 5, out.z) < 1, "the young are out at the clutch");
    layer.step(2100);
    assert.equal(es[2].act, null, "then their own day");
});

test("a clutch laid before the page read its log is put where the young are, then hatches; an overdue one is taken away", async () => {
    const {LiveClutches} = await import("@/ark-scene/live-clutches");
    type E = {id: string; act: ActPose | null};
    const es: E[] = [{id: "f", act: null}, {id: "y", act: null}];
    const nests = new Map<string, boolean>();
    const layer = new LiveClutches<E>({
        find: (id) => es.find((e) => e.id === id) ?? null,
        female: () => true,
        scheduleAt: () => ({x: 2, z: 2, yaw: 0}),
        ground: flat,
        length: () => 1,
        walk: () => 1,
        spawns: () => false,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: () => false,
        matingEnd: () => null,
        clutchSpot: () => null,
        lay: (key) => nests.set(key, false),
        hatch: (key) => nests.set(key, true),
        where: (key) => (nests.has(key) ? {x: 2, z: 2, y: 0, size: 0.4} : null),
        remove: (key) => nests.delete(key)
    });
    layer.addHatched([{key: "h", parents: ["f"], young: ["y"], t0: 10}]);
    layer.step(5);
    assert.equal(nests.get("hatch:h"), false, "there already");
    layer.step(12);
    assert.equal(nests.get("hatch:h"), true);
    layer.addLaid([{key: "laid:9", parents: ["f"], eggs: 2, t0: 100, hatchAt: 200}]);
    layer.step(130);
    assert.ok(nests.has("laid:9"));
    layer.step(200 + 11 * 60);
    assert.equal(nests.has("laid:9"), false, "overdue: gone");
});

test("two small animals off any day (on a wall, on a flower) are acted, not skipped: he goes to her surface, by the ground or flying", async () => {
    const {LiveMatings} = await import("@/ark-scene/live-matings");
    type E = {id: string; x: number; z: number; base: number; act: ActPose | null; male: boolean | null; fly: boolean};
    for (const fly of [false, true]) {
        const she: E = {id: "she", x: 0, z: 0, base: 1.5, act: null, male: false, fly};
        const he: E = {id: "he", x: 8, z: 0, base: 0.4, act: null, male: true, fly};
        const layer = new LiveMatings<E>({
            find: (id) => [she, he].find((e) => e.id === id) ?? null,
            scheduleAt: () => null,
            ground: () => 0,
            walk: () => 0.3,
            length: () => 0.02,
            height: () => 0.01,
            plan: () => (fly ? "flying_insect" : "arthropod"),
            courtship: () => null,
            male: (e) => e.male,
            together: () => true,
            setAct: (e, pose) => {
                e.act = pose;
            },
            busy: () => false,
            placeOf: (e) => ({x: e.x, z: e.z, yaw: 0, base: e.base, free: true}),
            flies: (e) => e.fly
        });
        layer.add([{key: `free${fly}`, a: "she", b: "he", t0: 0}], 0);
        layer.step(0.05);
        const d = layer.debug()[0];
        assert.equal(d.phase, "acting");
        assert.equal(d.how, "free");
        assert.ok(Math.abs(he.act!.x - 8) < 0.1 && Math.abs(he.act!.base - 0.4) < 0.05, "he starts on his own surface");
        layer.step(d.meet! / 2);
        const mid = he.act!.base;
        assert.ok(fly ? mid > 0.9 : mid < 0.05, fly ? "flying over" : "down on the ground between");
        layer.step((d.courted! + d.mounted!) / 2);
        assert.ok(Math.abs(she.act!.base - 1.5) < 0.05 && Math.hypot(he.act!.x - she.act!.x, he.act!.z - she.act!.z) < 0.1, "together on her surface");
    }
});

test("seekNear: a seeker walks its loop only near the camera (its day's place), with room either side so it never flickers", () => {
    assert.equal(seekNear(SEEK_NEAR - 1, false), true);
    assert.equal(seekNear(SEEK_NEAR + 1, false), false, "the island view's hundreds far off: none walk (no cost)");
    assert.equal(seekNear(SEEK_NEAR + 1, true), true, "once walking, kept till well past");
    assert.equal(seekNear(SEEK_FAR + 1, true), false);
});
