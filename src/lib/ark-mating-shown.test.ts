/**
 * ARK-MATING-SHOWN (AnimalDex docs/ark/DECISIONS.md 416): every mating is drawn where it can be seen, a pouch birth
 * shows its joey, and an adult looking for a mate roams. The pictures' own check is `scripts/ark-seen-shots.mjs`
 * (READABLE per kind, on saved real reads); these are the pure parts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {matingPose, matingScript, meetingSpot, type MatingBody} from "@/ark-scene/live-matings";
import {LiveSeeking, seekPose, SEEK_LOOK, SEEK_WALK} from "@/ark-scene/live-seeking";
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
