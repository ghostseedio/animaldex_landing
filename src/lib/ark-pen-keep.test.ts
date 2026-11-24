/**
 * Lane PENKEEP (2026-11-24): a penned animal's pen bound (`islands/town/placement.ts` keepInPen, the scene's last word on a
 * kept animal's pose) and the collisions (`collide/layer.ts`) keep it with one shape: its pen's keep box (the pen, its
 * margin in from the rails) and its body's capsule as it faces (`collide/resolve.ts` pushOut). Before, the collisions knew
 * no pen and the bound kept clear of what stands in the pen by a circle of the margin's width (1.65 m round a horse):
 *
 * - by the horse paddock's trough (`rural:trough:1`, 0.87 m inside the inset by the west rails) no point near a horse was
 *   clear of that circle, and the nearest that was swapped sides as it walked: 5 m across the trough in one frame;
 * - horses the collisions pushed apart past the inset were pulled back onto one line by the bound, inside each other for
 *   up to 81 s (`scripts/ark-paddock-overlap.ts`: 15 pairs over a second, 771 pair-seconds in 20 minutes; now 3 and 115).
 *
 * Real geometry: the town's colliders and the rural paddock as the town lays them.
 */

import assert from "node:assert/strict";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {keepInPen, penKeep, penMarginOf, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldOrigin} from "@/ark-scene/islands";
import {RURAL_TROUGHS, ruralPen} from "@/ark-scene/islands/town/rural";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {bodyClear, inKeep, keepGive, overlapOf, pushOut, separateCluster, type ResolveBody, type ResolvePose} from "@/ark-scene/collide/resolve";
import {colliderDistance} from "@/ark-scene/collide/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {scheduleWorld, SLOT_SECONDS, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";

const origin = townWorldOrigin();
const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
const placed = placeTownAnimals(town.animals);
const set = townColliderSet(placed.open, origin);
const pen = ruralPen("rural-paddock-1")!.at;
// (A live paddock horse: 2.4 m drawn, its margin 1.8 m, its body 0.29 m half-wide and 0.92 m half-long.)
const LENGTH = 2.4;
const margin = penMarginOf(LENGTH, pen);
const shape = bodyShape("domestic-horse", LENGTH);
const horse = (id: string): ResolveBody => ({id, radius: shape.radius, half: shape.half, height: shape.height});
const keep = penKeep(pen, margin, origin.x, origin.z);
const trough = RURAL_TROUGHS[1];
const tx = trough.x + origin.x;
const tz = trough.z + origin.z;
// (Its feet on the ground there, as the schedule stands it.)
const ground = (x: number, z: number) => townHeight(x - origin.x, z - origin.z);
const poseAt = (x: number, z: number, yaw: number): ResolvePose => ({x, y: ground(x, z), z, yaw, aloft: false});

test("the trough is where the case is: inside the paddock, within a horse's reach of the inset by the rails", () => {
    assert.ok(margin > 1.7 && margin <= 1.8, `margin ${margin}`);
    const insetX = keep.x - keep.hx;
    assert.ok(tx - trough.d / 2 - insetX > 0.5 && tx - trough.d / 2 - insetX < 1.2, `${(tx - trough.d / 2 - insetX).toFixed(2)} m from the inset to the trough`);
    assert.ok(!bodyClear(set, horse("h"), poseAt(insetX + 0.4, tz, Math.PI / 2), insetX + 0.4, tz), "a horse across the gap is in the trough");
});

test("the bound leaves what the collisions placed as it is: one keep box, one body, round the trough at every heading", () => {
    const body = horse("h");
    let moved = 0;
    let n = 0;
    for (let x = tx - 3.2; x <= tx + 2; x += 0.2) {
        for (let z = tz - 3; z <= tz + 3; z += 0.2) {
            for (const yaw of [0, 0.04, 0.7, Math.PI / 2, 2.4]) {
                const placedOut = pushOut(set, body, poseAt(x, z, yaw), keep);
                const bound = {x: placedOut.x, z: placedOut.z};
                keepInPen(pen, margin, bound, origin.x, origin.z, set, {...body, yaw, y: ground(x, z)});
                moved = Math.max(moved, Math.hypot(bound.x - placedOut.x, bound.z - placedOut.z));
                assert.ok(inKeep(keep, placedOut.x, placedOut.z, keepGive(keep, body)), `(${x.toFixed(1)}, ${z.toFixed(1)}) yaw ${yaw}: placed outside its keep`);
                n++;
            }
        }
    }
    assert.ok(n > 2000, `${n} poses`);
    assert.equal(moved, 0, `the bound moved the collisions' answer ${moved.toFixed(3)} m`);
});

test("walking past the trough by the rails, the bound never jumps it across the trough (it did, 5 m in a frame)", () => {
    const body = horse("h");
    // The live case (horse 2227e0fb, +770.6 s): its pose 1.5 m outside the inset, walking along the rails past the trough.
    const insetX = keep.x - keep.hx;
    const run = (withBody: boolean) => {
        let step = 0;
        let was: {x: number; z: number} | null = null;
        for (let z = tz - 3; z <= tz + 3; z += 0.03) {
            const at = {x: insetX - 0.1, z};
            keepInPen(pen, margin, at, origin.x, origin.z, set, withBody ? {...body, yaw: 0.04, y: ground(at.x, at.z)} : null);
            if (was) step = Math.max(step, Math.hypot(at.x - was.x, at.z - was.z));
            was = at;
        }
        return step;
    };
    const before = run(false);
    const after = run(true);
    assert.ok(before > 2, `the margin's circle: ${before.toFixed(2)} m in one 3 cm step (the bug)`);
    assert.ok(after < 0.1, `the body as it faces: ${after.toFixed(3)} m in one 3 cm step`);
});

test("two horses on one spot by the rails are eased apart along the inset, not past it for the bound to pull back together", () => {
    const a = horse("a");
    const b = horse("b");
    const insetX = keep.x - keep.hx;
    const z = tz + 2.6;
    const pa = {...poseAt(insetX, z, 0.04), still: true};
    const pb = {...poseAt(insetX + 0.05, z + 0.02, 0.04), still: true};
    const before = overlapOf(a, pa, b, pb).depth;
    const [ra, rb] = separateCluster(set, [{body: a, pose: pa, keep}, {body: b, pose: pb, keep}]);
    for (const r of [ra, rb]) assert.ok(inKeep(keep, r.x, r.z), `(${r.x.toFixed(2)}, ${r.z.toFixed(2)}) left the keep box`);
    const after = overlapOf(a, {...pa, x: ra.x, z: ra.z}, b, {...pb, x: rb.x, z: rb.z}).depth;
    assert.ok(after < before * 0.25, `overlap ${before.toFixed(2)} m to ${after.toFixed(2)} m`);
    // Then the bound: both kept as the collisions left them.
    for (const [r, p] of [[ra, pa], [rb, pb]] as const) {
        const bound = {x: r.x, z: r.z};
        keepInPen(pen, margin, bound, origin.x, origin.z, set, {...a, yaw: p.yaw, y: p.y});
        assert.deepEqual(bound, r);
    }
    // Without the keep box (as before): pushed past the inset, and the bound put them back inside each other.
    const [oa, ob] = separateCluster(set, [{body: a, pose: pa}, {body: b, pose: pb}]);
    const ba = {x: oa.x, z: oa.z};
    const bb = {x: ob.x, z: ob.z};
    keepInPen(pen, margin, ba, origin.x, origin.z, set);
    keepInPen(pen, margin, bb, origin.x, origin.z, set);
    assert.ok(!inKeep(keep, oa.x, oa.z) || !inKeep(keep, ob.x, ob.z), "one of them pushed out past the inset (the bug)");
    assert.ok(overlapOf(a, {...pa, x: ba.x, z: ba.z}, b, {...pb, x: bb.x, z: bb.z}).depth > after + 0.1, "and pulled back into the other by the bound");
});

test("a penned horse's goals are inside its keep box and clear of the trough by its reach, never behind it by the rails", () => {
    // (The live paddock-1 horses' goals by the trough went to the one strip that fitted them, between the trough and the
    // west rails, outside the keep box: three horses on one point, wedged, inside each other for 25 s at a time.)
    const world = scheduleWorld(townWorldSampler(placed.open, origin, set));
    const profile = behaviourProfile("domestic-horse");
    const insetX = keep.x - keep.hx;
    const trough = set.list.find((c) => c.id === "town:rural:trough:1")!;
    assert.ok(trough, "the trough's collider");
    const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    const goals = (withKeep: boolean) => {
        const animal: ScheduleAnimal = {id: `pen-keep-horse-${withKeep}`, zone: "grassland", home: {x: insetX, y: ground(insetX, tz - 1.8), z: tz - 1.8}, length: LENGTH, sea: false, range: 10.2, kept: true, keep: withKeep ? keep : null};
        const out: Array<{x: number; z: number; doing: string}> = [];
        for (let slot = 0; slot < 240; slot++) {
            const trip = tripAt(world, profile, animal, 1796032800 + slot * SLOT_SECONDS + 1, hours);
            if (trip.doing !== "sleep") out.push({x: trip.to.x, z: trip.to.z, doing: trip.doing});
        }
        return out;
    };
    const reach = shape.half + shape.radius;
    const behind = (g: {x: number; z: number}) => g.x < trough.cx && Math.abs(g.z - tz) < trough.reach + 0.2;
    const after = goals(true);
    assert.ok(after.length > 150, `${after.length} goals`);
    for (const g of after) {
        assert.ok(inKeep(keep, g.x, g.z), `goal (${g.x.toFixed(2)}, ${g.z.toFixed(2)}) outside its keep box (${g.doing})`);
        assert.ok(colliderDistance(trough, g.x, g.z) >= reach - 0.05 || !behind(g), `goal (${g.x.toFixed(2)}, ${g.z.toFixed(2)}) behind the trough`);
    }
    const before = goals(false);
    assert.ok(before.some((g) => !inKeep(keep, g.x, g.z)), "without its keep box some goals were outside it (the bug)");
});
