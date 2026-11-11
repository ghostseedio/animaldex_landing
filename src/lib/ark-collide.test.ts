/**
 * Collisions (motion pass L5): the colliders come from the lanes' own sources, the queries are exact, every walk path
 * is clear of everything solid for the body that walks it, the collisions' layer is pure and symmetric, and a run of
 * the synthetic Ark (every species and a full hamlet, `src/lib/ark-collide/fixture.ts`) has no animal passing through
 * a fence, a building, a trunk, a rock, a log or a hay bale.
 *
 * The long runs (the real snapshot, many hours, every 1-2 s) are `scripts/ark-collide-audit.mts`; CI's audit runs the
 * fixture against `tests/ark-collide/thresholds.json` (`.github/workflows/ark-collisions.yml`).
 */

import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {buildColliders, ColliderSet, colliderDistance, colliderSetFor, PICKET_GAP, RAIL_CLEAR} from "@/ark-scene/collide/colliders";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {onSurface} from "@/ark-scene/collide/attach";
import {overlapOf, pushOut, separation, type ResolveBody, type ResolvePose} from "@/ark-scene/collide/resolve";
import {hamletPlotsFor} from "@/ark-scene/map/hamlet";
import {MAX_SLOPE, NAV_RADII} from "@/ark-scene/behaviour-nav";
import {picketRuns, paddockRect, paddockSegments, plotFrame} from "@/ark-scene/props/home-layout";
import {worldDecor} from "@/ark-scene/decor";
import {drawnRocks} from "@/ark-scene/map/rocks";
import {setBehaviourHomePlots} from "@/ark-scene/world-sampler";
import {buildSim} from "@/lib/ark-collide/sim";
import {collideFixture} from "@/lib/ark-collide/fixture";
import {measureCollisions, rawPosesAt, resolvedPosesAt} from "@/lib/ark-collide/metrics";

const root = path.resolve(__dirname, "../..");
const animals = collideFixture(root, {limit: 420});
const plots = hamletPlotsFor(animals);

test("the colliders are the lanes' own: every fence run, rock, trunk, building and prop, the same every build", () => {
    const list = buildColliders(plots);
    const again = buildColliders(plots.map((p) => ({...p})));
    assert.deepEqual(list, again, "a pure function of the world and the plots");
    const kinds = new Map<string, number>();
    for (const c of list) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    for (const kind of ["fence", "building", "trunk", "rock", "log", "post"]) assert.ok((kinds.get(kind) ?? 0) > 0, `no ${kind} colliders`);
    assert.equal(list.filter((c) => c.kind === "rock").length, drawnRocks().length, "every drawn rock");
    // Every picket run of every house plot and every paddock rail of every smallholding.
    for (const plot of plots) {
        if (plot.kind === "house") assert.equal(list.filter((c) => c.id.startsWith(`picket:${plot.id}:`)).length, picketRuns().length, plot.id);
        else assert.ok(list.some((c) => c.id.startsWith(`paddock:${plot.id}:`)), plot.id);
        assert.ok(list.some((c) => c.id === `${plot.kind === "house" ? "house" : "barn"}:${plot.id}`) || plot.barn === false, `${plot.id}'s building`);
    }
    assert.equal(list.filter((c) => c.id.startsWith("field-fence") && c.id.endsWith(":rails")).length, worldDecor().filter((i) => i.kind === "fence").length, "every field fence");
});

test("the queries: a fence blocks, its picket gaps let a mouse through, its rails let a hen walk under", () => {
    const set = colliderSetFor(plots);
    const picket = set.list.find((c) => c.id.startsWith("picket:") && c.shape === "segment")!;
    assert.ok(picket.shape === "segment");
    const mx = (picket.ax + picket.bx) / 2;
    const mz = (picket.az + picket.bz) / 2;
    const l = Math.hypot(picket.bx - picket.ax, picket.bz - picket.az);
    const nx = -(picket.bz - picket.az) / l;
    const nz = (picket.bx - picket.ax) / l;
    assert.ok(set.blocked(mx, mz, 0.2), "on the fence");
    assert.ok(!set.blocked(mx + nx, mz + nz, 0.2), "a metre off it");
    assert.ok(!set.blocked(mx, mz, PICKET_GAP / 2 - 0.005), "a mouse slips through the pickets");
    assert.ok(!set.segmentClear(mx - nx, mz - nz, mx + nx, mz + nz, 0.2), "a straight run through it");
    const t = set.sweep(mx - nx, mz - nz, mx + nx, mz + nz, 0.2);
    // (From a metre off, the body touches the fence at its radius and the fence's half thickness short of its line.)
    assert.ok(t > 0.3 && t < 0.45, `the sweep stops before the fence (${t})`);
    const rails = set.list.find((c) => c.id.startsWith("paddock:") && c.id.endsWith(":rails"))!;
    assert.ok(rails.shape === "segment");
    const rx = (rails.ax + rails.bx) / 2;
    const rz = (rails.az + rails.bz) / 2;
    assert.ok(set.blocked(rx, rz, 0.3, rails.y0 - RAIL_CLEAR, 1.4), "a cow meets the rails");
    assert.ok(!set.blocked(rx, rz, 0.12, rails.y0 - RAIL_CLEAR, 0.35), "a hen walks under them");
    // On top of a rock is clear of it; in it is not.
    const rock = set.list.find((c) => c.kind === "rock")!;
    assert.ok(set.blocked(rock.cx, rock.cz, 0.1, rock.y0 + 0.05, 0.3));
    assert.ok(!set.blocked(rock.cx, rock.cz, 0.1, rock.y1, 0.3), "on its top");
    assert.ok(onSurface("rock_face:decor614:3") && onSurface("map:burrow") && !onSurface("grass:12") && !onSurface(null));
});

test("every walk path is clear of everything solid for its body, and a paddock is entered by its gate", () => {
    const sim = buildSim(animals);
    try {
        const nav = sim.world.nav;
        const set = nav.colliders!;
        assert.ok(set, "the walk grid knows the colliders");
        // Round every house and barn, through the plots: between seeded points round each plot, for each body class.
        let checked = 0;
        for (const plot of plots) {
            const frame = plotFrame(plot);
            for (let k = 0; k < 6; k++) {
                const a = frame.toWorld(-12 + (k % 3) * 2, -10 + k * 3.5);
                const b = frame.toWorld(12 - (k % 2) * 3, 11 - k * 3.2);
                for (const radius of [0.12, NAV_RADII[1], NAV_RADII[3]]) {
                    if (!nav.fits(a.x, a.z, radius) || !nav.fits(b.x, b.z, radius)) continue;
                    const path = nav.path(a, b, "walk", 0.5, 6000, MAX_SLOPE, radius);
                    for (let i = 1; i < path.length; i++) assert.ok(set.sweepAll(path[i - 1].x, path[i - 1].z, path[i].x, path[i].z, radius - 0.02) >= 1, `${plot.id}: a run of a path for radius ${radius} touches something`);
                    checked++;
                }
            }
        }
        assert.ok(checked > 40, `only ${checked} paths`);
        // Into a paddock from the barn's yard: through its gate, never over its rails.
        const farm = plots.find((p) => p.kind === "smallholding")!;
        const frame = plotFrame(farm);
        const rect = paddockRect(farm);
        const inside = frame.toWorld((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2);
        const outside = frame.toWorld((rect.x0 + rect.x1) / 2, rect.z0 > 0 ? rect.z0 - 3 : rect.z1 + 3);
        const r = bodyShape("cow", 2).radius;
        const path = nav.path(outside, inside, "walk", 0.5, 8000, MAX_SLOPE, r);
        assert.ok(Math.hypot(path[path.length - 1].x - inside.x, path[path.length - 1].z - inside.z) < 0.01, "a cow reaches the paddock's middle");
        const gate = paddockSegments(rect).find((s) => s.gate)!;
        const gateAt = frame.toWorld((gate.a.x + gate.b.x) / 2, (gate.a.z + gate.b.z) / 2);
        assert.ok(path.some((p, i) => i > 0 && segmentNear(path[i - 1], p, gateAt) < 1.3), "by the gate");
    } finally {
        setBehaviourHomePlots(null);
    }
});

function segmentNear(a: {x: number; z: number}, b: {x: number; z: number}, p: {x: number; z: number}): number {
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const l = vx * vx + vz * vz;
    const t = l > 0 ? Math.min(Math.max(((p.x - a.x) * vx + (p.z - a.z) * vz) / l, 0), 1) : 0;
    return Math.hypot(p.x - (a.x + vx * t), p.z - (a.z + vz * t));
}

test("the layer: out of anything solid, eased apart symmetrically, a recipe's pair may touch", () => {
    const set = new ColliderSet([{shape: "circle", kind: "trunk", id: "t", cx: 0, cz: 0, r: 0.5, reach: 0.5, y0: -1, y1: 5, gap: 0}], "test");
    const body: ResolveBody = {id: "a", radius: 0.3, half: 0.4, height: 1};
    const pose: ResolvePose = {x: 0.6, y: 0, z: 0, yaw: Math.PI / 2, aloft: false};
    const out = pushOut(set, body, pose);
    const placed = {...pose, x: out.x, z: out.z};
    assert.ok(colliderDistance(set.list[0], out.x, out.z) >= 0.3 - 0.01, "out of the trunk");
    assert.deepEqual(pushOut(set, body, pose), out, "pure");
    void placed;
    const b: ResolveBody = {id: "b", radius: 0.3, half: 0.4, height: 1};
    const pa: ResolvePose = {x: 5, y: 0, z: 5, yaw: 0, aloft: false};
    const pb: ResolvePose = {x: 5.3, y: 0, z: 5, yaw: 0, aloft: false};
    const sa = separation(body, pa, [{body: b, pose: pb}]);
    const sb = separation(b, pb, [{body, pose: pa}]);
    assert.ok(Math.abs(sa.dx + sb.dx) < 1e-9 && Math.abs(sa.dz + sb.dz) < 1e-9, "equal and opposite");
    const after = overlapOf(body, {...pa, x: pa.x + sa.dx, z: pa.z + sa.dz}, b, {...pb, x: pb.x + sb.dx, z: pb.z + sb.dz});
    assert.ok(after.depth <= 0.1 * 0.3 + 1e-6, `left overlapping ${after.depth}`);
    const paired = separation(body, {...pa, partner: "b"}, [{body: b, pose: pb}]);
    assert.ok(Math.hypot(paired.dx, paired.dz) < Math.hypot(sa.dx, sa.dz), "a recipe's pair may come closer");
});

test("a run of every species and a full hamlet: no animal passes through anything solid, none steps through a fence", () => {
    const sim = buildSim(animals);
    try {
        const set = colliderSetFor(plots);
        const from = Math.floor(Date.UTC(2026, 10, 12, 5, 0) / 1000);
        const report = measureCollisions(sim, set, resolvedPosesAt(sim, set), {from, seconds: 900, step: 3});
        const raw = measureCollisions(sim, set, rawPosesAt(sim, true), {from, seconds: 900, step: 3, overlaps: false});
        assert.ok(report.measured > 300, `measured ${report.measured}`);
        assert.equal(report.passThrough.samples, 0, `passing through: ${JSON.stringify(report.passThrough.byKindSource)} ${JSON.stringify(report.passThrough.worst.slice(0, 3))}`);
        assert.equal(report.fenceCrossings.count, 0, `through fences: ${JSON.stringify(report.fenceCrossings.examples.slice(0, 3))}`);
        // (The paths alone, before the layer's last word: almost nothing for it to do.)
        assert.ok(raw.passThrough.samples <= Math.max(report.samples * 0.01, 50), `the paths alone pass through ${raw.passThrough.samples} times`);
    } finally {
        setBehaviourHomePlots(null);
    }
});
