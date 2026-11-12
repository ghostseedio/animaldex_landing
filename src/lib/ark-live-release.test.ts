import assert from "node:assert/strict";
import test from "node:test";
import {abilitiesOf} from "@/ark-live/species";
import {findPath, planRelease, type ReleaseInput} from "@/ark-live/release";
import {evalPlan, planEnd} from "@/ark-live/plan-eval";
import {CELL} from "@/ark-live/terrain";
import {modeIndex} from "@/ark-live/protocol";
import {ARK_DAY_S} from "@/ark-live/session";
import {GridTerrain} from "@/lib/ark-live-fixtures";
import {readFileSync} from "node:fs";

const terrain = new GridTerrain();
const AT = 1_800_000_000_000;

function input(slug: string, x: number, z: number, extra: Partial<ReleaseInput> = {}): ReleaseInput {
    return {
        animalId: `animal-${slug}`,
        releasedAt: AT,
        pose: {x, y: 0.5, z, mode: "ground"},
        a: abilitiesOf(slug),
        home: {zone: "grassland", area: null},
        homeDisc: {x: -10, z: -30, r: 10},
        terrain,
        stamina: 1,
        pen: null,
        ...extra
    };
}

test("release: at home in good habitat it simply stays (the next slot starts where it was let go)", () => {
    const r = planRelease(input("red-fox", -12, -28));
    assert.equal(r.plan.kind, "stay");
    assert.equal(r.plan.legs.length, 1);
    assert.deepEqual(evalPlan(r.plan, AT + 5000)?.done, true);
});

test("release: within its homing range it walks home round the wall, at its pace, in time order", () => {
    // From the far side of the wall (x ∈ [0, 1), z ∈ [−10, 10)) to its home west of it.
    const r = planRelease(input("red-fox", 8, 0, {homeDisc: {x: -25, z: 0, r: 4}}));
    assert.equal(r.plan.kind, "homing");
    const legs = r.plan.legs;
    assert.ok(legs.length >= 3 && legs.length <= 64);
    for (let i = 1; i < legs.length; i++) assert.ok(legs[i][0] >= legs[i - 1][0], "time order");
    const last = legs[legs.length - 1];
    assert.ok(Math.hypot(last[1] + 25, last[2]) < 2.5, "ends at home");
    // Every point along the way is walkable.
    for (let t = AT; t <= planEnd(r.plan)!; t += 250) {
        const p = evalPlan(r.plan, t)!;
        const c = terrain.cell(p.x, p.z)!;
        assert.ok(!(c.flags & CELL.BLOCKED), `blocked at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    }
    // At its walking pace: no faster than its walk cap.
    const a = abilitiesOf("red-fox");
    for (let i = 1; i < legs.length; i++) {
        const d = Math.hypot(legs[i][1] - legs[i - 1][1], legs[i][2] - legs[i - 1][2]);
        const s = (legs[i][0] - legs[i - 1][0]) / 1000;
        if (s > 0) assert.ok(d / s <= a.walk * 1.01, "at its walk");
    }
});

test("release: the same release gives the same plan (deterministic)", () => {
    const a = JSON.stringify(planRelease(input("red-fox", 8, 0, {homeDisc: {x: -10, z: 0, r: 4}})));
    const b = JSON.stringify(planRelease(input("red-fox", 8, 0, {homeDisc: {x: -10, z: 0, r: 4}})));
    assert.equal(a, b);
    const camel = (seed: string) => JSON.stringify(planRelease({...input("dromedary-camel", 0, 40, {home: {zone: "desert", area: null}, homeDisc: {x: -400, z: -400, r: 10}}), animalId: seed}));
    assert.equal(camel("x"), camel("x"));
});

test("release: out of range, it searches by the habitat ahead and settles where it can live (a new home disc, its zone recorded)", () => {
    // A camel (a desert animal) in the snow, its home too far to find: it heads for better ground.
    const r = planRelease(input("dromedary-camel", 0, 40, {home: {zone: "desert", area: null}, homeDisc: {x: -400, z: -400, r: 10}}));
    assert.equal(r.plan.kind, "search");
    assert.ok(r.plan.settle, "a new home disc");
    const end = evalPlan(r.plan, planEnd(r.plan)!)!;
    assert.ok(end.z <= 20, `left the snow (z ${end.z.toFixed(1)})`);
    // Settled in its own kind of place (desert: its zone stays its own) or the same region (grassland: recorded).
    assert.ok(r.zone === null || r.zone === "grassland", String(r.zone));
    assert.ok(["desert", "grassland"].includes(terrain.cell(end.x, end.z)!.zone));
    assert.equal(r.strandedFrom, null);
});

test("release: a sea fish cut off in the fresh lake searches, can't find salt water, and is stranded (S < 0.3)", () => {
    const r = planRelease(input("atlantic-salmon", -20, -20, {pose: {x: -20, y: -1, z: -20, mode: "swim"}, home: {zone: "open_ocean", area: null}, homeDisc: {x: 40, z: 0, r: 14}}));
    assert.equal(r.plan.kind, "search");
    assert.ok(r.strandedFrom !== null, "stranded");
    for (let t = AT; t <= planEnd(r.plan)!; t += 2000) {
        const p = evalPlan(r.plan, t)!;
        assert.ok(Math.hypot(p.x + 20, p.z + 20) < 8.5, "stays in the lake");
    }
    assert.ok(planEnd(r.plan)! - AT <= 3 * ARK_DAY_S * 1000 + 200_000, "settles within 3 Ark days");
    assert.ok(r.plan.legs.length <= 64);
});

test("release: a zoo animal resumes its enclosure where it is; a flyer goes home in a straight line", () => {
    assert.equal(planRelease(input("red-fox", -7.5, 32.5, {pen: 7})).plan.kind, "enclosure");
    const eagle = planRelease(input("golden-eagle", 30, 30, {home: {zone: "mountains", area: null}, homeDisc: {x: -40, z: -40, r: 20}, pose: {x: 30, y: 10, z: 30, mode: "air"}}));
    assert.equal(eagle.plan.kind, "homing");
    assert.equal(eagle.plan.legs[0][3], modeIndex("air"));
});

test("release: released on the wrong island within an Ark day of a crossing, it retraces (the strait leg is stored)", () => {
    const r = planRelease(
        input("golden-eagle", 0, 0, {
            home: {zone: "mountains", area: null},
            homeDisc: {x: 900, z: 900, r: 20},
            pose: {x: 0, y: 8, z: 0, mode: "air"},
            crossed: {arrivedAt: AT - 10 * 60_000, at: {x: 45, z: 0}, canCrossBack: true, strait: {farPoint: {x: 45, z: 0}, seconds: 31, to: "wild"}}
        })
    );
    assert.equal(r.plan.kind, "retrace");
    assert.equal(r.plan.island, "wild");
    const last = r.plan.legs[r.plan.legs.length - 1];
    assert.equal(last[3], modeIndex("strait"));
    // After the window it searches the island it is on instead.
    const late = planRelease(
        input("golden-eagle", 0, 0, {
            home: {zone: "mountains", area: null},
            homeDisc: {x: 900, z: 900, r: 20},
            pose: {x: 0, y: 8, z: 0, mode: "air"},
            crossed: {arrivedAt: AT - 2 * ARK_DAY_S * 1000, at: {x: 45, z: 0}, canCrossBack: true, strait: {farPoint: {x: 45, z: 0}, seconds: 31, to: "wild"}}
        })
    );
    assert.notEqual(late.plan.kind, "retrace");
});

test("release: a path to a place it can't reach (a walker across the sea) is null", () => {
    assert.equal(findPath(abilitiesOf("red-fox"), "walk", terrain, {x: 0, z: 30}, {x: 45, z: 30}, "grassland", null, 500), null);
});

test("plan-eval: evaluated between legs, null before the first, done after the last; the file stays import-free", () => {
    const plan = {kind: "homing" as const, legs: [[1000, 0, 0, 0], [3000, 2, 0, 0], [5000, 2, 2, 0]] as Array<[number, number, number, number]>, settle_at: null, settle: null};
    assert.equal(evalPlan(plan, 999), null);
    const mid = evalPlan(plan, 2000)!;
    assert.deepEqual([mid.x, mid.z, mid.done, mid.moving], [1, 0, false, true]);
    assert.ok(Math.abs(mid.yaw - Math.PI / 2) < 1e-9);
    const end = evalPlan(plan, 9000)!;
    assert.deepEqual([end.x, end.z, end.done], [2, 2, true]);
    const source = readFileSync(new URL("../ark-live/plan-eval.ts", import.meta.url), "utf8");
    assert.ok(!/^\s*import\s/m.test(source), "plan-eval.ts has no imports (the Deno copy in _shared/ark-positions must match it byte for byte)");
});

test("release: the stored home override for the shared position module (null falls back to the formula)", async () => {
    const {homeOverrideOf} = await import("@/ark-live/release");
    const where = {releaseIsland: "wild", homeIsland: "wild"};
    assert.equal(homeOverrideOf(planRelease(input("red-fox", -12, -28)), where), null, "stay: its formula home");
    assert.equal(homeOverrideOf(planRelease(input("red-fox", 8, 0, {homeDisc: {x: -25, z: 0, r: 4}})), where), null, "homing: its formula home once the legs end");
    const settled = homeOverrideOf(planRelease(input("dromedary-camel", 0, 40, {home: {zone: "desert", area: null}, homeDisc: {x: -400, z: -400, r: 10}})), where)!;
    assert.equal(settled.island, "wild");
    assert.ok(typeof settled.x === "number" && typeof settled.z === "number" && typeof settled.r === "number", "search: the disc it settled in");
    assert.deepEqual(homeOverrideOf(planRelease(input("red-fox", -12, -28)), {releaseIsland: "town", homeIsland: "wild"}), {island: "town"}, "left on another island");
});

test("homes from the shared position module: its home with the stored override; the zone's site without a slot", async () => {
    const {positionHomes} = await import("@/ark-live/position-homes");
    const calls: unknown[] = [];
    const fake = {homeOf: (_atlas: null, ref: {slot: number}, override?: unknown) => (calls.push([ref, override]), {x: 10, z: 20, r: 7})};
    const lookup = positionHomes(fake, null);
    const facts = {id: "a", slug: "red-fox", zone: "grassland" as const, area: null, enclosure: null};
    const a = abilitiesOf("red-fox");
    assert.deepEqual(lookup(facts, a, null, {island: "wild", speciesId: "s", slot: 3, rank: 1}), {x: 10, z: 20, r: 7});
    const state = {animal_id: "a", island: "wild" as const, released_at: "", plan: {kind: "search" as const, legs: [], settle_at: null, settle: null}, zone: null, stamina: 1, exposure: 0, home: {island: "wild", x: 1, z: 2, r: 3}};
    lookup(facts, a, state, {island: "wild", speciesId: "s", slot: 3, rank: 1});
    assert.deepEqual((calls[1] as unknown[])[1], {island: "wild", x: 1, z: 2, r: 3}, "the stored HomeOverride goes to homeOf");
    const fallback = lookup(facts, a, null, {island: "wild", speciesId: null, slot: null, rank: null});
    assert.ok(fallback.r > 0 && calls.length === 2, "no slot: the zone's site");
});
