import assert from "node:assert/strict";
import test from "node:test";
import type {ActPose} from "@/ark-scene/acts";
import moves from "@/ark-scene/bird-moves.json";
import {DROP_LIVE_SECONDS, LiveDuckDrops, dropMotherPose, dropScript, dropYoungPose, type DuckDropHost, type Hollow} from "@/ark-scene/duckling-drop";

// A trunk at the origin; its hole 3 m up on its +x side, facing out along +x; the ground slopes a little.
const hole: Hollow = {x: 0.25, y: 3.4, z: 0, nx: 1, nz: 0};
const ground = (x: number, z: number) => 0.4 + 0.02 * x + 0.01 * z;
const mother = {x: 6, z: 4, yaw: 0, length: 0.75};

test("each young: hidden in the hole until its turn, one by one; out and down, never back into the trunk or under the ground; a bounce; then at her side", () => {
    const sc = dropScript(mother, hole, 5, "k", ground);
    for (let k = 0; k < 5; k++) {
        assert.equal(dropYoungPose(sc, k, sc.leave[k] - 1, ground).hidden, true, "in the hole before its turn");
        if (k > 0) assert.ok(sc.leave[k] > sc.leave[k - 1] + 1, "one by one");
        let out = -Infinity;
        let lowest = Infinity;
        for (let s = sc.leave[k]; s < sc.leave[k] + sc.fall[k]; s += 0.01) {
            const p = dropYoungPose(sc, k, s, ground);
            assert.equal(p.hidden, false);
            const along = (p.x - hole.x) * hole.nx + (p.z - hole.z) * hole.nz;
            assert.ok(along >= out - 1e-9, "only ever away from the trunk");
            out = along;
            assert.ok(p.base >= ground(p.x, p.z) - 1e-9, "never under the ground");
            lowest = Math.min(lowest, p.base - ground(p.x, p.z));
        }
        assert.ok(out >= 0.7, "clear of the trunk when it lands");
        assert.ok(lowest < 0.1, "it comes all the way down");
        const touch = dropYoungPose(sc, k, sc.leave[k] + sc.fall[k], ground);
        assert.ok(Math.abs(touch.base - ground(touch.x, touch.z)) < 1e-6, "on the ground as the bounce starts");
        const landed = dropYoungPose(sc, k, sc.leave[k] + sc.fall[k] + 0.2, ground);
        assert.ok(landed.base > ground(landed.x, landed.z), "the bounce");
        const sat = dropYoungPose(sc, k, sc.gatheredEnd - 0.1, ground);
        assert.ok(Math.hypot(sat.x - sc.foot.x, sat.z - sc.foot.z) < mother.length * 1.2, "gathered at her");
    }
    assert.equal(dropYoungPose(sc, 7, 1000, ground).hidden, true, "young beyond the shown ones stay out of sight");
});

test("the mother walks to the foot of the tree, out in front of the hole, and waits looking up", () => {
    const sc = dropScript(mother, hole, 3, "k", ground);
    assert.equal(dropMotherPose(sc, 0.5, ground).state, "walk");
    const waiting = dropMotherPose(sc, sc.leave[0], ground);
    assert.ok(Math.abs(waiting.x - sc.foot.x) < 1e-9 && sc.foot.x > hole.x + 0.7, "in front of the hole, off the trunk");
    assert.ok(Math.abs(Math.atan2(hole.x - sc.foot.x, hole.z - sc.foot.z) - waiting.yaw) < 1e-9, "facing the tree");
    assert.ok(waiting.pitch < 0, "looking up");
});

type E = {id: string; slug: string; act: ActPose | null; male: boolean | null; x: number; z: number};
const mk = (id: string, slug: string, male: boolean | null = null): E => ({id, slug, act: null, male, x: 6, z: 4});
const host = (entries: E[], hollow: Hollow | null = hole): DuckDropHost<E> => ({
    find: (id) => entries.find((e) => e.id === id) ?? null,
    scheduleAt: (e) => ({x: e.x, z: e.z, yaw: 0}),
    drops: (e) => e.slug in moves.drop,
    hollow: () => hollow,
    ground,
    length: () => 0.75,
    walk: () => 0.6,
    male: (e) => e.male,
    setAct: (e, pose) => {
        e.act = pose;
    },
    busy: () => false
});

test("from the record's hatching: the mother is the female parent, the young are its young; all back on their day after", () => {
    const he = mk("m", "muscovy-duck", true);
    const she = mk("f", "muscovy-duck", false);
    const young = [mk("y1", "muscovy-duck"), mk("y2", "muscovy-duck"), mk("y3", "muscovy-duck")];
    const all = [he, she, ...young];
    const drops = new LiveDuckDrops<E>(host(all));
    drops.add([{key: "hatch:1", parents: ["m", "f"], young: ["y1", "y2", "y3"], t0: 1000}], 1000);
    drops.step(1001);
    assert.ok(she.act && !he.act, "she goes to the tree; he is left to his day");
    assert.deepEqual(young.map((y) => y.act?.hidden), [true, true, true]);
    const jumped = new Set<string>();
    for (let t = 1000; t < 1200; t += 0.1) {
        drops.step(t);
        for (const j of drops.jumping(t)) jumped.add(j.id);
    }
    assert.deepEqual(Array.from(jumped).sort(), ["y1", "y2", "y3"]);
    assert.deepEqual(all.map((e) => e.act), [null, null, null, null, null], "all back on their schedules");
    assert.deepEqual(drops.pins(), []);
});

test("nothing is acted without a hole near, for a kind whose text does not say it, or long after the hatch", () => {
    const she = mk("f", "muscovy-duck", false);
    const y = mk("y", "muscovy-duck");
    const none = new LiveDuckDrops<E>(host([she, y], null));
    none.add([{key: "h", parents: ["f"], young: ["y"], t0: 10}], 10);
    none.step(12);
    assert.equal(she.act, null);
    assert.equal(y.act, null);
    const hen = mk("c", "domestic-chicken", false);
    const chick = mk("cy", "domestic-chicken");
    const other = new LiveDuckDrops<E>(host([hen, chick]));
    other.add([{key: "h", parents: ["c"], young: ["cy"], t0: 10}], 10);
    other.step(12);
    assert.equal(hen.act, null);
    const late = new LiveDuckDrops<E>(host([she, y]));
    late.add([{key: "h", parents: ["f"], young: ["y"], t0: 10}], 10 + DROP_LIVE_SECONDS + 1);
    assert.equal(late.size, 0);
});

test("the data: the tree-hole ducks of the catalogue; the killdeer's roof-edge chicks are not among them; no sentence about water", () => {
    const table = moves.drop as Record<string, {line: string | null; quote: string}>;
    assert.ok(["australian-wood-duck", "bufflehead", "lesser-whistling-duck", "muscovy-duck"].every((s) => s in table));
    assert.equal("killdeer" in table, false);
    for (const [slug, row] of Object.entries(table)) {
        assert.ok(/hole|hollow|cavity|tree/i.test(row.quote), slug);
        assert.ok(row.line === null || !/water|lily/.test(row.line), slug);
    }
});
