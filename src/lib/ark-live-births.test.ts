import assert from "node:assert/strict";
import test from "node:test";
import type {ActPose} from "@/ark-scene/acts";
import {LiveBirths, birthScript, birthStyle, motherPose, youngPose, type LiveBirthsHost} from "@/ark-scene/live-births";

type E = {id: string; plan: string; care: "follow" | "carry" | "nest" | "guard" | "none"; male: boolean | null; h: number; pouch?: boolean; act: ActPose | null};

const ground = () => 0;
const mother = (o: Partial<Parameters<typeof birthScript>[0]> = {}) => ({x: 0, z: 0, yaw: 0, length: 2, height: 1.2, pace: 1, plan: "quadruped", care: "follow" as const, pouch: false, ...o});

test("birth style: from the body plan and the species' care", () => {
    assert.equal(birthStyle("quadruped", "follow", false), "open");
    assert.equal(birthStyle("quadruped", "nest", false), "den");
    assert.equal(birthStyle("primate", "carry", false), "cling");
    assert.equal(birthStyle("quadruped", "carry", true), "pouch");
    assert.equal(birthStyle("arachnid", "carry", false), "back");
    assert.equal(birthStyle("legless", "none", false), "beside");
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
    assert.equal(nursing.meal, "nursing");
    assert.equal(motherPose(sc, sc.end - 1, ground).meal, "nursing");
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
    const sc = birthScript(mother({plan: "arachnid", care: "carry", height: 0.05, length: 0.12}), 3, "s");
    const y = youngPose(sc, 0, sc.first + 1, ground);
    assert.ok(y.base > 0.03, "up on her back");
});

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
    const dad: E = {id: "dad", plan: "quadruped", care: "follow", male: true, h: 1.2, act: null};
    const mum: E = {id: "mum", plan: "quadruped", care: "follow", male: false, h: 1.2, act: null};
    const calf: E = {id: "calf", plan: "quadruped", care: "follow", male: null, h: 0.6, act: null};
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
    const mum: E = {id: "mum", plan: "quadruped", care: "follow", male: false, h: 1.2, act: null};
    const births = new LiveBirths(host([mum]));
    births.add([{key: "old", parents: ["mum"], young: ["x"], t0: 0}], 10_000);
    assert.equal(births.size, 0);
});
