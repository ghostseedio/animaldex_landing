/**
 * Climbing a tree along its trunk (the owner, 2026-11-17, on the live Ark: "monkeys are climbing trees parallel to the
 * ground and not the tree"). `tree-climb.ts`: a climb between the ground and a place up a tree goes to the trunk's foot,
 * up the trunk with its belly to the bark and its body along the trunk's axis, then out along the limb; down the same,
 * head first or tail first by kind.
 *
 * The pure path (a leaning, tapering trunk), the drawn trees' trunks, and the real wild island's climbers over hours
 * of the shared schedule: the real snapshot is read in place where it is (`ARK_REAL_SNAPSHOT`, or development's
 * `public/ark-local/real.json`); skipped without one.
 */

import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {assetTrunkFit, descendsHeadFirst, fitTrunk, offBark, treeClimb, treeClimbAt, treeHostOf, trunkFrame, BARK_SKIN, type Trunk} from "@/ark-scene/tree-climb";
import {assetAttachRows} from "@/ark-scene/tree-assets";
import {scheduleSurface} from "@/ark-scene/grounding/stand";

const dot = (a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}) => a.x * b.x + a.y * b.y + a.z * b.z;
const flat = () => 0;
// A trunk leaning 10 cm a metre toward +x, 0.4 m across at its foot and tapering.
const TRUNK: Trunk = {x: 0, y: 0, z: 0, lx: 0.1, lz: 0, r0: 0.4, taper: -0.02, height: 12};
const axis = (t: Trunk) => {
    const l = Math.hypot(t.lx, 1, t.lz);
    return {x: t.lx / l, y: 1 / l, z: t.lz / l};
};

test("fitTrunk: the axis, lean and taper of a trunk from points on its bark", () => {
    const pts = [];
    for (let k = 0; k < 12; k++) {
        const y = 0.5 + k * 0.8;
        const az = k * 2.3;
        const f = trunkFrame(TRUNK, y, az);
        pts.push({x: f.p.x - Math.sin(az) * BARK_SKIN, y, z: f.p.z - Math.cos(az) * BARK_SKIN, nx: Math.sin(az), nz: Math.cos(az)});
    }
    const fit = fitTrunk(pts)!;
    assert.ok(Math.abs(fit.cx) < 0.03 && Math.abs(fit.cz) < 0.03, JSON.stringify(fit));
    assert.ok(Math.abs(fit.lx - 0.1) < 0.015 && Math.abs(fit.lz) < 0.02, JSON.stringify(fit));
    assert.ok(Math.abs(fit.r0 - 0.4) < 0.03 && Math.abs(fit.taper + 0.02) < 0.01, JSON.stringify(fit));
});

test("every asset tree with bark has a trunk fitted inside its drawn bark (radius about its own trunk's)", () => {
    for (const id of ["oak-a", "beech-c", "emergent-a", "emergent-b", "lime-a", "plane-a", "palm-b", "pine-a", "willow-a", "acacia-b", "mangrove-a", "yew-a", "snag-a"]) {
        const fit = assetTrunkFit(id);
        assert.ok(fit, `${id}: no trunk`);
        const bark = assetAttachRows(id).filter((r) => r[0] === "bark");
        for (const r of bark) {
            const y = r[2];
            const c = {x: fit.cx + fit.lx * y, z: fit.cz + fit.lz * y};
            const off = Math.hypot(r[1] - c.x, r[3] - c.z) - (fit.r0 + fit.taper * y);
            assert.ok(Math.abs(off) < 0.12, `${id}: a bark point ${off.toFixed(3)} m off the fitted trunk`);
        }
    }
});

test("up a tree from the ground: along the ground to the trunk, up the trunk belly to the bark along its axis, then out along the limb", () => {
    // A limb's top 6 m up, 1.6 m out toward -z, rising outward (its normal leans back toward the trunk).
    const limb = {x: 0.6, y: 6, z: -1.6, nx: 0, ny: 0.94, nz: 0.34};
    const ground = {x: 3, y: 0, z: 2, nx: 0, ny: 1, nz: 0};
    const climb = treeClimb(ground, limb, null, TRUNK, flat, false)!;
    assert.deepEqual(climb.segs.map((s) => s.kind), ["ground", "trunk", "limb"]);
    const a = axis(TRUNK);
    let onTrunk = 0;
    for (let k = 0; k <= 400; k++) {
        const p = treeClimbAt(climb, k / 400, flat);
        assert.ok(Math.abs(Math.hypot(p.nx, p.ny, p.nz) - 1) < 1e-9 && Math.abs(Math.hypot(p.fx, p.fy, p.fz) - 1) < 1e-6);
        assert.ok(Math.abs(p.fx * p.nx + p.fy * p.ny + p.fz * p.nz) < 1e-6, "heading on the surface");
        assert.ok(p.y >= -1e-9, "never under the ground");
        if (Math.abs(p.ny) < 0.35) {
            onTrunk++;
            // Its body along the trunk's axis, head up; its back out of the bark; its contact on the skin.
            assert.ok(dot({x: p.fx, y: p.fy, z: p.fz}, a) > 0.9, `k ${k}: body ${dot({x: p.fx, y: p.fy, z: p.fz}, a)} off the trunk's axis`);
            assert.ok(Math.abs(offBark(TRUNK, p) - BARK_SKIN) < 0.02, `k ${k}: ${offBark(TRUNK, p)} off the bark`);
            const c = {x: TRUNK.x + TRUNK.lx * p.y, z: TRUNK.z + TRUNK.lz * p.y};
            const out = {x: p.x - c.x, y: 0, z: p.z - c.z};
            assert.ok(dot({x: p.nx, y: p.ny, z: p.nz}, out) / Math.hypot(out.x, out.z) > 0.9, "belly to the bark");
        }
        // Never further from the trunk than its limb place, never above it: on the tree, not beside it in the air.
        if (p.onTree) assert.ok(offBark(TRUNK, p) <= offBark(TRUNK, limb) + 0.05 && p.y <= limb.y + 1e-6);
    }
    assert.ok(onTrunk > 200, `${onTrunk} of 401 on the trunk`);
    const end = treeClimbAt(climb, 1, flat);
    assert.ok(Math.hypot(end.x - limb.x, end.y - limb.y, end.z - limb.z) < 1e-6);
});

test("down a tree: a primate backs down tail first (its body still heads up the trunk); a squirrel comes down head first", () => {
    const limb = {x: 0.6, y: 6, z: -1.6, nx: 0, ny: 0.94, nz: 0.34};
    const ground = {x: 3, y: 0, z: 2, nx: 0, ny: 1, nz: 0};
    const a = axis(TRUNK);
    for (const headFirst of [false, true]) {
        const climb = treeClimb(limb, ground, TRUNK, null, flat, headFirst)!;
        let seen = 0;
        for (let k = 0; k <= 200; k++) {
            const p = treeClimbAt(climb, k / 200, flat);
            if (Math.abs(p.ny) >= 0.35) continue;
            seen++;
            const along = dot({x: p.fx, y: p.fy, z: p.fz}, a);
            assert.ok(headFirst ? along < -0.9 : along > 0.9, `head first ${headFirst}: ${along}`);
            assert.equal(p.down, headFirst);
            assert.equal(p.backing, !headFirst);
        }
        assert.ok(seen > 50);
    }
    assert.equal(descendsHeadFirst("siamang", "mammal"), false);
    assert.equal(descendsHeadFirst("squirrel-monkey", "mammal"), false);
    assert.equal(descendsHeadFirst("eurasian-red-squirrel", "mammal"), true);
    assert.equal(descendsHeadFirst("tokay-gecko", "reptile"), true);
    assert.equal(descendsHeadFirst("koala", "mammal"), false);
    assert.equal(descendsHeadFirst("domestic-cat", "mammal"), false);
    assert.equal(descendsHeadFirst("asian-black-bear", "mammal"), false);
    // (A goat walks down its tree head first; so does the margay, the one cat that does.)
    assert.equal(descendsHeadFirst("domestic-goat", "mammal"), true);
    assert.equal(descendsHeadFirst("margay", "mammal"), true);
});

test("from one tree to another: down the first trunk, across the ground, up the second", () => {
    const other: Trunk = {...TRUNK, x: 6, lx: 0};
    const a = {x: 0.6, y: 6, z: -1.6, nx: 0, ny: 0.94, nz: 0.34};
    const b = {x: 7.2, y: 5, z: 0.2, nx: -0.3, ny: 0.95, nz: 0};
    const climb = treeClimb(a, b, TRUNK, other, flat, false)!;
    assert.deepEqual(climb.segs.map((s) => s.kind), ["limb", "trunk", "ground", "trunk", "limb"]);
    // The same tree: round and along its trunk, never down to the ground.
    const c = {x: -1.4, y: 4, z: 0.1, nx: 0.3, ny: 0.95, nz: 0};
    const same = treeClimb(a, c, TRUNK, TRUNK, flat, false)!;
    assert.deepEqual(same.segs.map((s) => s.kind), ["limb", "trunk", "limb"]);
    for (let k = 0; k <= 100; k++) assert.ok(treeClimbAt(same, k / 100, flat).y > 3.5);
});

test("the drawn body's frame on the trunk: its forward the climb's own (scheduleSurface)", () => {
    const climb = treeClimb({x: 3, y: 0, z: 2, nx: 0, ny: 1, nz: 0}, {x: 0.6, y: 6, z: -1.6, nx: 0, ny: 0.94, nz: 0.34}, null, TRUNK, flat, false)!;
    const p = treeClimbAt(climb, 0.5, flat);
    const frame = scheduleSurface({x: p.x, y: p.y, z: p.z, yaw: p.yaw, nx: p.nx, ny: p.ny, nz: p.nz}, {x: p.fx, y: p.fy, z: p.fz});
    assert.ok(dot({x: frame.tx, y: frame.ty, z: frame.tz}, axis(TRUNK)) > 0.9);
});

test("a place's tree from its id", () => {
    assert.equal(treeHostOf("limb:decor254:2"), "decor254");
    assert.equal(treeHostOf("map:limb:decor289:8"), "decor289");
    assert.equal(treeHostOf("branch:fill8:0"), "fill8");
    assert.equal(treeHostOf("town:tree:4:limb0"), "town:tree:4");
    assert.equal(treeHostOf("shade:640"), null);
    assert.equal(treeHostOf(null), null);
});

// MARK: - The real wild island

const realFile = process.env.ARK_REAL_SNAPSHOT ?? path.join(process.cwd(), "public/ark-local/real.json");

test("the real wild island's tree climbers: on a trunk the body runs along its axis (> 0.9), belly to the bark; never level in the air beside a tree", {timeout: 1_800_000}, async (t) => {
    if (!existsSync(realFile)) return t.skip("no local real snapshot");
    const {setArkWorld} = await import("@/ark-scene/world");
    setArkWorld("v2");
    const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
    const {arkIslandSnapshot} = await import("@/lib/ark-islands");
    const {placeAnimals} = await import("@/ark-scene/placement");
    const {worldSampler} = await import("@/ark-scene/world-sampler");
    const {poseOnTrip, scheduleWorld, tripAt, trunkOfSpot, withLazyRoost} = await import("@/ark-scene/behaviour-schedule");
    const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
    const {climbsTrees, onSchedule, scheduleRoost} = await import("@/ark-scene/map/place");
    const {onBehaviourSchedule} = await import("@/ark-scene/schedule-water");
    const {arkBody} = await import("@/ark-scene/stats");
    const {modelBase} = await import("@/ark-scene/grounding/base");
    const {scheduledPerch} = await import("@/ark-scene/grounding/hook");
    const {islandHours} = await import("@/lib/ark-clock");
    const raw = JSON.parse(readFileSync(realFile, "utf8"));
    const wild = arkIslandSnapshot(decodeArkSnapshot(raw.snapshot ?? raw)!, "wild");
    const places = placeAnimals(wild.animals);
    const world = scheduleWorld(worldSampler());
    const start = Date.UTC(2026, 10, 17, 6) / 1000;
    const climbers = wild.animals.filter((a) => climbsTrees(a.model_slug) && onSchedule(places.get(a.id)!, a.model_slug) && onBehaviourSchedule(a.model_slug));
    const kinds = new Set<string>();
    const bad: string[] = [];
    let onTrunk = 0;
    for (const animal of climbers) {
        const place = places.get(animal.id)!;
        const plan = modelBase(animal.model_slug)?.plan ?? null;
        const profile = behaviourProfile(animal.model_slug, plan);
        const sa = withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: arkBody(animal, plan).display, sea: false}, () => scheduleRoost(place, animal.zone));
        let trip = null as ReturnType<typeof tripAt> | null;
        for (let e = start; e < start + 4 * 3600; e += 3) {
            if (!trip || e < trip.start || e >= trip.end) trip = tripAt(world, profile, sa, e, (x: number) => islandHours(x * 1000, 0), animal.activity, trip);
            const at = poseOnTrip(world, trip, e);
            if (at.aloft || !at.moving || at.beat !== "climb") continue;
            // (The leg it is on now.)
            let left = e - trip.start;
            let leg = trip.legs[trip.legs.length - 1];
            for (const l of trip.legs) {
                if (left < l.seconds) {
                    leg = l;
                    break;
                }
                left -= l.seconds;
            }
            if (!leg || leg.mode !== "surface") continue;
            // (Between two trees: the one it is on.)
            const both = [trunkOfSpot(world, leg.from), trunkOfSpot(world, leg.to)].filter((x): x is Trunk => x !== null);
            const trunk = both.sort((p, q) => Math.abs(offBark(p, at)) - Math.abs(offBark(q, at)))[0] ?? null;
            if (!trunk) continue;
            const frame = scheduledPerch(at, trip.to, false, 0, {x: 0, y: 0}, (x, z) => world.sampler.heightAt(x, z));
            if (!frame) continue;
            if (Math.abs(frame.ny) < 0.35 && Math.abs(offBark(trunk, at)) < 0.1) {
                onTrunk++;
                kinds.add(animal.model_slug);
                const ax = axis(trunk);
                const along = Math.abs(dot({x: frame.tx, y: frame.ty, z: frame.tz}, ax));
                const c = {x: trunk.x + trunk.lx * (at.y - trunk.y), z: trunk.z + trunk.lz * (at.y - trunk.y)};
                const out = Math.hypot(at.x - c.x, at.z - c.z) || 1;
                const belly = ((at.x - c.x) * frame.nx + (at.z - c.z) * frame.nz) / out;
                if (along < 0.9 || belly < 0.9) bad.push(`${animal.model_slug} ${new Date(e * 1000).toISOString()}: along ${along.toFixed(2)} belly ${belly.toFixed(2)} n ${frame.nx.toFixed(2)},${frame.ny.toFixed(2)},${frame.nz.toFixed(2)} off ${offBark(trunk, at).toFixed(3)} ${leg.from.point} -> ${leg.to.point}`);
            }
        }
    }
    assert.deepEqual(bad.slice(0, 8), []);
    assert.ok(onTrunk > 100 && kinds.size >= 5, `${onTrunk} moments on a trunk, ${kinds.size} kinds: ${Array.from(kinds).join(", ")}`);
    console.log(`[tree-climb] ${climbers.length} climbers, ${kinds.size} kinds seen on a trunk (${onTrunk} moments): ${Array.from(kinds).sort().join(", ")}`);
});
