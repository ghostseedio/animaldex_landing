import assert from "node:assert/strict";
import test from "node:test";
import type {ActPose} from "@/ark-scene/acts";
import {LiveBirths, birthScript, birthStyle, motherPose, newbornScale, youngPose, type LiveBirthsHost} from "@/ark-scene/live-births";

type E = {id: string; plan: string; care: "follow" | "carry" | "nest" | "guard" | "none"; male: boolean | null; h: number; pouch?: boolean; act: ActPose | null};

const ground = () => 0;
const mother = (o: Partial<Parameters<typeof birthScript>[0]> = {}) => ({x: 0, z: 0, yaw: 0, length: 2, height: 1.2, pace: 1, plan: "mammal", care: "follow" as const, pouch: false, ...o});

test("birth style: from the body plan and the species' care", () => {
    assert.equal(birthStyle("mammal", "follow", false), "open");
    assert.equal(birthStyle("mammal", "nest", false), "den");
    assert.equal(birthStyle("mammal", "carry", false), "cling");
    assert.equal(birthStyle("mammal", "carry", true), "pouch");
    assert.equal(birthStyle("arthropod", "carry", false), "back");
    assert.equal(birthStyle("snake", "none", false), "beside");
});

test("an open birth: she lies, the young are hidden until born one by one, are licked, rise, then suckle at her flank", () => {
    const sc = birthScript(mother(), 2, "k");
    assert.equal(sc.standing, false);
    assert.equal(motherPose(sc, 1, ground).state, "rest");
    assert.equal(motherPose(sc, 1, ground).meal, "birthing");
    assert.equal(youngPose(sc, 0, sc.first - 0.1, ground).hidden, true);
    assert.equal(youngPose(sc, 0, sc.first + 0.1, ground).hidden, false);
    assert.equal(youngPose(sc, 1, sc.first + 0.1, ground).hidden, true, "the second comes a little later");
    assert.equal(youngPose(sc, 1, sc.first + 3.1, ground).hidden, false);
    assert.ok(sc.riseEnd > sc.lickEnd, "calves get up");
    const nursing = youngPose(sc, 0, sc.end - 1, ground);
    assert.equal(nursing.state, "eat");
    assert.equal(nursing.meal, "resting");
    assert.equal(motherPose(sc, sc.end - 1, ground).meal, "resting");
});

test("a tall hoofed mother (a giraffe) gives birth standing", () => {
    assert.equal(birthScript(mother({height: 4.5}), 1, "g").standing, true);
    assert.equal(motherPose(birthScript(mother({height: 4.5}), 1, "g"), 1, ground).state, "scan");
});

test("a marsupial's newborn is never drawn on the ground (it is in the pouch)", () => {
    const sc = birthScript(mother({care: "carry", pouch: true}), 1, "w");
    for (const s of [0, sc.first, sc.first + 5, sc.end - 1]) assert.equal(youngPose(sc, 0, s, ground).hidden, true);
});

test("a scorpion's young ride on her back", () => {
    const sc = birthScript(mother({plan: "arthropod", care: "carry", height: 0.05, length: 0.12}), 3, "s");
    const y = youngPose(sc, 0, sc.first + 1, ground);
    assert.ok(y.base > 0.03, "up on her back");
});

/** Read through a call (an assert on `e.act` would narrow it for the rest of the test). */
const now = (e: E): ActPose | null => e.act;

const host = (entries: E[], place = {x: 0, z: 0, yaw: 0}): LiveBirthsHost<E> => ({
    find: (id) => entries.find((e) => e.id === id) ?? null,
    scheduleAt: () => place,
    ground,
    walk: () => 1,
    length: () => 2,
    height: (e) => e.h,
    plan: (e) => e.plan,
    care: (e) => e.care,
    pouch: (e) => Boolean(e.pouch),
    male: (e) => e.male,
    setAct: (e, p) => {
        e.act = p;
    },
    busy: () => false
});

test("the layer: the mother is the parent drawn female; the father is left alone; all are released at the end", () => {
    const dad: E = {id: "dad", plan: "mammal", care: "follow", male: true, h: 1.2, act: null};
    const mum: E = {id: "mum", plan: "mammal", care: "follow", male: false, h: 1.2, act: null};
    const calf: E = {id: "calf", plan: "mammal", care: "follow", male: null, h: 0.6, act: null};
    const births = new LiveBirths(host([dad, mum, calf]));
    births.add([{key: "b1", parents: ["dad", "mum"], young: ["calf"], t0: 1000}], 1000);
    births.step(1001);
    assert.equal(dad.act, null);
    assert.equal(mum.act?.meal, "birthing");
    assert.equal(calf.act?.hidden, true);
    assert.deepEqual(births.pins().sort(), ["calf", "mum"]);
    births.step(1000 + 400);
    assert.equal(mum.act, null);
    assert.equal(calf.act, null);
});

test("the layer: a birth long past is not acted", () => {
    const mum: E = {id: "mum", plan: "mammal", care: "follow", male: false, h: 1.2, act: null};
    const births = new LiveBirths(host([mum]));
    births.add([{key: "old", parents: ["mum"], young: ["x"], t0: 0}], 10_000);
    assert.equal(births.size, 0);
});

test("V1: a den's young crawl out from under her, lie clear of her flank while she licks them, then go back to suckle", () => {
    const sc = birthScript(mother({care: "nest", length: 0.3, height: 0.12}), 3, "den", 0.4, 0.1);
    assert.equal(sc.style, "den");
    const clear = (p: {x: number; z: number}) => Math.abs(p.x - sc.spot.x);
    for (let k = 0; k < 3; k++) {
        const bornAt = sc.first + 3 * k;
        assert.equal(youngPose(sc, k, bornAt - 0.1, ground).hidden, true);
        assert.ok(clear(youngPose(sc, k, bornAt + 0.5, ground)) < 0.3 * 0.35, "born tucked at her belly");
        const out = youngPose(sc, k, bornAt + 6, ground);
        assert.ok(clear(out) > 0.3 * 0.5 + 0.03, `the ${k}th lies clear of her body (${clear(out).toFixed(3)} m off her middle line)`);
        assert.equal(out.state, "rest");
    }
    assert.ok(sc.seenBy >= sc.first + 6 + 5 && sc.seenBy < sc.lickEnd, "the still waits for the last of them to be out");
    // (No two of them on one spot.)
    const outs = [0, 1, 2].map((k) => youngPose(sc, k, sc.seenBy + 0.5, ground));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(outs[i].x - outs[j].x, outs[i].z - outs[j].z) > 0.05);
    assert.ok(clear(youngPose(sc, 0, sc.lickEnd + 4, ground)) < 0.3 * 0.35, "back at her belly to suckle");
});

test("V1: young far smaller than their mother are drawn larger for their first moments, then their own size; never more than three times", () => {
    const fry = birthScript(mother({plan: "fish", care: "none", length: 0.4, height: 0.12}), 2, "fry", 0.4, 0.02);
    assert.equal(fry.style, "beside");
    assert.equal(fry.pop, 3, "a fry of 2 cm beside a mother of 40: three times its size, not eight");
    assert.ok(Math.abs(youngPose(fry, 0, fry.first + 3, ground).scale - 3) < 1e-6);
    assert.ok(youngPose(fry, 0, fry.first + 0.1, ground).scale < 1, "in from small");
    assert.equal(newbornScale(3, 40), 1, "and its own size again");
    const calf = birthScript(mother(), 1, "calf", 0.4, 0.9);
    assert.equal(calf.pop, 1, "a calf is not enlarged");
    assert.equal(youngPose(calf, 0, calf.first + 3, ground).scale, 1);
    assert.equal(birthScript(mother({care: "carry", pouch: true}), 1, "w", 0.4, 0.02).pop, 1);
});

test("V1: a mother with no day to settle from (a tank's): the same act where the scene draws her, in her own water, the brood close by her; then each young comes in where it lives", () => {
    const mum: E = {id: "mum", plan: "fish", care: "none", male: false, h: 0.1, act: null};
    const a: E = {id: "a", plan: "fish", care: "none", male: null, h: 0.02, act: null};
    const b: E = {id: "b", plan: "fish", care: "none", male: null, h: 0.02, act: null};
    const appeared: string[] = [];
    const births = new LiveBirths({...host([mum, a, b]), scheduleAt: () => null, placeOf: (e) => (e === mum ? {x: 3, z: 4, yaw: 0, base: 1.1} : {x: 9, z: 9, yaw: 0, base: 1.3}), appear: (e) => appeared.push(e.id)});
    births.add([{key: "tank", parents: ["mum"], young: ["a", "b"], t0: 1000}], 900);
    births.step(990);
    assert.equal(a.act?.hidden, true, "held until the record is out: not born yet");
    assert.equal(mum.act, null);
    births.step(1001);
    const act = births.debug()[0];
    assert.equal(act.phase, "acting");
    assert.equal(act.style, "beside");
    assert.equal(act.housed, true);
    assert.deepEqual([now(mum)?.x, now(mum)?.z, now(mum)?.base], [3, 4, 1.1], "where the scene draws her, at her own depth");
    assert.equal(now(a)?.hidden, true);
    births.step(1000 + 13);
    for (const young of [a, b]) {
        assert.equal(now(young)?.hidden, false);
        assert.equal(now(young)?.base, 1.1, "in her water, never on the ground under the tank");
        assert.ok(Math.hypot(now(young)!.x - 3, now(young)!.z - 4) <= 2 * 0.5 + 1e-9, "within half her length of her: nothing through the glass");
    }
    assert.deepEqual(appeared, []);
    births.step(1000 + act.end! + 0.1);
    assert.deepEqual([now(mum), now(a), now(b)], [null, null, null], "over: each as the scene draws it");
    assert.deepEqual(appeared, ["a", "b"], "each young comes in where it lives");
    assert.equal(births.debug()[0].phase, "over");
    // One with no day that the scene does not hold (its schedule not made yet): not acted, as before.
    const none = new LiveBirths({...host([mum, a]), scheduleAt: () => null, placeOf: () => null});
    none.add([{key: "none", parents: ["mum"], young: ["a"], t0: 1000}], 1000);
    none.step(1001);
    assert.equal(none.debug()[0].phase, "skipped");
});
