import assert from "node:assert/strict";
import test from "node:test";
import type {ActPose} from "@/ark-scene/acts";
import moves from "@/ark-scene/bird-moves.json";
import {BrokenWing, LURE_FLY, LURE_HOLD, LURE_LEAD, LURE_REACH, LURE_ROLL, LURE_RUN, LURE_SECONDS, lureAlong, lurePose, lureScript, type LureHost} from "@/ark-scene/broken-wing";
import {canEat, hasIntelProfile, intelProfile} from "@/ark-scene/intelligence-profile";

const flat = () => 0.5;
const nest = {x: 10, z: 20};
const home = {x: 10, y: 0.5, z: 20, yaw: 1};

test("the lure leads away from the nest, never back, and never nearer the predator than where it began", () => {
    for (const [tx, tz] of [[16, 20], [10, 12], [3, 26], [14, 25]]) {
        for (const key of ["a", "b", "c", "d"]) {
            const threat = {x: tx, z: tz};
            const sc = lureScript(nest, threat, key, 0.26, flat)!;
            assert.ok(sc && sc.reach >= 5 && sc.reach <= 9);
            const began = Math.hypot(threat.x - nest.x, threat.z - nest.z);
            let last = -1;
            for (let s = 0; s < LURE_RUN + LURE_LEAD + LURE_HOLD; s += 0.02) {
                const p = lurePose(sc, s, flat, home)!.pose;
                const fromNest = Math.hypot(p.x - nest.x, p.z - nest.z);
                assert.ok(fromNest >= last - 1e-9, `never back toward the nest (${s.toFixed(2)})`);
                last = fromNest;
                assert.ok(Math.hypot(p.x - threat.x, p.z - threat.z) >= began - 1e-6, "never nearer the predator");
                assert.ok(p.base >= 0.5 - 1e-9 && p.base < 0.5 + 0.3, "on the ground: a low flutter at most");
            }
            assert.ok(Math.abs(last - sc.reach) < 1e-6, "it gets all the way");
        }
    }
});

test("how it reads: a run, then hops rolled onto one wing with pauses to drag, then it stands whole and flies back to the nest", () => {
    const sc = lureScript(nest, {x: 16, z: 20}, "k", 0.26, flat)!;
    assert.equal(lurePose(sc, 0.5, flat, home)!.pose.state, "run");
    assert.equal(lurePose(sc, 0.5, flat, home)!.pose.roll, 0);
    let hops = 0, drags = 0, up = 0;
    for (let s = LURE_RUN + 0.01; s < LURE_RUN + LURE_LEAD; s += 0.01) {
        const {pose, aloft} = lurePose(sc, s, flat, home)!;
        assert.equal(aloft, false);
        assert.ok(Math.abs(pose.roll) > LURE_ROLL - 0.2 && Math.sign(pose.roll) === sc.side, "rolled onto the same wing throughout");
        if (lureAlong(sc, s).dragging) drags++;
        else hops++;
        up = Math.max(up, pose.base - 0.5);
    }
    assert.ok(hops > 300 && drags > 300, "both hops and drags");
    assert.ok(up > 0.05 && up < 0.3, `the hops leave the ground a little (${up.toFixed(2)})`);
    const stood = lurePose(sc, LURE_RUN + LURE_LEAD + LURE_HOLD - 0.1, flat, home)!.pose;
    assert.ok(Math.abs(stood.roll) < 0.01, "whole again");
    let high = 0;
    for (let s = LURE_RUN + LURE_LEAD + LURE_HOLD; s < LURE_SECONDS; s += 0.02) {
        const {pose} = lurePose(sc, s, flat, home)!;
        assert.ok(pose.base >= 0.5 - 1e-9, "never under the ground");
        high = Math.max(high, pose.base - 0.5);
    }
    assert.ok(high > 1 && high < 2, "a low flight");
    const landing = lurePose(sc, LURE_SECONDS - 0.01, flat, home)!.pose;
    assert.ok(Math.hypot(landing.x - home.x, landing.z - home.z) < 0.05 && Math.abs(landing.base - home.y) < 0.05, "back at the nest");
    assert.equal(lurePose(sc, LURE_SECONDS + 0.1, flat, home), null);
    assert.ok(LURE_FLY > 2);
});

test("no dry ground to lead across: the other side, a shorter way, or nothing", () => {
    // Water everywhere east of x = 11: it leads the other way whatever its first side was.
    const shore = (x: number) => (x > 11 ? -0.5 : 0.5);
    for (const key of ["a", "b", "c", "d", "e"]) {
        const sc = lureScript(nest, {x: 10, z: 28}, key, 0.26, shore);
        assert.ok(sc && sc.dir.x < 0, key);
    }
    assert.equal(lureScript(nest, {x: 10, z: 28}, "k", 0.26, () => -1), null, "an islet awash: none");
});

type E = {id: string; slug: string; x: number; y: number; z: number; act: ActPose | null; free: boolean; nest: {x: number; z: number} | null};
const mk = (id: string, slug: string, x: number, z: number, o: Partial<E> = {}): E => ({id, slug, x, y: 0.2, z, act: null, free: true, nest: null, ...o});
const host = (): LureHost<E> => ({
    id: (e) => e.id,
    slug: (e) => e.slug,
    mobs: (e) => e.slug in moves.lure,
    free: (e) => e.free && !e.act,
    place: (e) => ({x: e.x, y: e.y, z: e.z, yaw: 0}),
    home: (e) => ({x: e.x, y: e.y, z: e.z, yaw: 0}),
    length: () => 0.26,
    height: () => 0.2,
    threatens: (t, b) => canEat(intelProfile(t.slug), intelProfile(b.slug), 50, 20),
    ground: () => 0.2,
    act: (e) => e.act,
    setAct: (e, pose) => {
        e.act = pose;
    },
    nest: (e) => e.nest
});

test("near the camera: a killdeer with a fox near does the display and is back on its day after; the fox is not moved", () => {
    const fox = mk("f", "red-fox", 6, 0);
    const bird = mk("k", "killdeer", 0, 0, {nest: {x: 0.5, z: 0.5}});
    const far = mk("k2", "killdeer", 0, LURE_REACH + 40);
    const up = mk("k3", "killdeer", 2, 2, {y: 3});
    const sparrow = mk("s", "house-sparrow", 1, 1);
    const all = [fox, bird, far, up, sparrow];
    const lure = new BrokenWing<E>(host());
    lure.step(100, all);
    assert.ok(bird.act, "it starts");
    assert.equal(far.act, null);
    assert.equal(up.act, null, "a bird up on a perch has no nest under it");
    assert.equal(sparrow.act, null);
    let seen: Array<{nested: boolean}> = [];
    for (let t = 100; t < 100 + LURE_SECONDS + 1; t += 0.05) {
        lure.step(t, all);
        if (lure.seen(t).length) seen = lure.seen(t);
        assert.equal(fox.act, null);
    }
    assert.equal(seen.length, 1);
    assert.equal(seen[0].nested, true, "the record has it a nest there: the sentence may speak of it");
    assert.equal(bird.act, null);
    assert.equal(lure.active, false);
    lure.step(100 + LURE_SECONDS + 5, all);
    assert.equal(lure.active, false, "not again at once");
    // Without a nest of the record the display still happens, from where it stands; the log is told so.
    const lone = mk("k4", "killdeer", 0, 0);
    const lure2 = new BrokenWing<E>(host());
    lure2.step(100, [fox, lone]);
    lure2.step(100 + LURE_RUN + 1, [fox, lone]);
    assert.equal(lure2.seen(100 + LURE_RUN + 1)[0].nested, false);
    // A bird the record takes is left to it.
    const meal = {...lone.act!, state: "eat"};
    lone.act = meal;
    lure2.step(100 + LURE_RUN + 2, [fox, lone]);
    assert.equal(lone.act, meal);
    assert.equal(lure2.active, false);
});

test("the data: the four species of the catalogue, real models with a predator; only a sentence that says the display is kept", () => {
    const table = moves.lure as Record<string, {line: string | null; quote: string}>;
    assert.deepEqual(Object.keys(table).sort(), ["black-winged-stilt", "blue-crane", "killdeer", "southern-lapwing"]);
    for (const [slug, row] of Object.entries(table)) {
        assert.ok(hasIntelProfile(slug) && canEat(intelProfile("red-fox"), intelProfile(slug), 50, 20), slug);
        assert.ok(row.line === null || /broken wing/.test(row.line), slug);
        assert.ok(/distraction|broken|feign|injur/i.test(row.quote), `${slug}: its own text says it`);
    }
    assert.ok(table.killdeer.line && table["southern-lapwing"].line);
    assert.equal(table["blue-crane"].line, null);
});
