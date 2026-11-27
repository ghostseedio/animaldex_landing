/**
 * Lane ELEPHANTS (2026-11-24, the owner: "elephant enclosure glitching when I get close"). In the forest paddock, two
 * of the four elephants were inside each other for up to 128 s, 1.5 m deep (`scripts/ark-paddock-overlap.ts`). Wired as
 * the scene wires them, as a herd, all four elephants' places came from the schedule:
 *
 * - a member's place by its leader (`shadowOf`) was 0.8–3 spreads off it, about a metre for an elephant, and was
 *   checked against nothing but the walk grid. A member's own goal (`placedIntent`) was checked only against solids,
 *   so a goal could sit 0.1 m from a herd-mate. Between the trees and the keep box's edge, the collisions had no room
 *   to push them apart;
 * - a long body walking between a rock and the keep box's edge took the give its whole length needs facing the rails.
 *   It stayed wedged, and the ring search out of the rock swapped sides as it turned: a giraffe moved 3–5 m in a frame.
 *
 * Real geometry: the fixture town's colliders, its plains paddock's rock mound by the side fence, and the live Ark's
 * forest paddock herd where it is saved (git-ignored: skipped where it is not).
 */

import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {maskBox, penKeep, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldOrigin} from "@/ark-scene/islands";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {zooLayout} from "@/ark-scene/islands/town/areas";
import {inKeep, keepGive, keepGrow, overlapOf, pushOut, type ResolveBody} from "@/ark-scene/collide/resolve";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {groupLives} from "@/ark-scene/behaviour-group";
import {bodyShape} from "@/ark-scene/collide/bodies";
import {displayLength} from "@/ark-scene/sizes";
import {poseOnTrip, scheduleWorld, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";

const origin = townWorldOrigin();

test("keep give by the way a body faces: lengthwise along the rails it needs only its width", () => {
    const keep = {x: 0, z: 0, cos: 1, sin: 0, hx: 10, hz: 5, margin: 2.36};
    const giraffe = {radius: 0.54, half: 1.47};
    // (Facing along x: its length that way, its width across.)
    const along = keepGrow(keep, giraffe, Math.PI / 2);
    assert.ok(Math.abs(along.x - (2.36 - 1.47 - 0.54 - 0.05)) < 1e-9);
    assert.ok(Math.abs(along.z - (2.36 - 0.54 - 0.05)) < 1e-9);
    // (Never less than the give whichever way it faces, `keepGive`.)
    for (const yaw of [0, 0.4, 1.1, 2.6, -2]) {
        const g = keepGrow(keep, giraffe, yaw);
        assert.ok(g.x >= keepGive(keep, giraffe) - 1e-9 && g.z >= keepGive(keep, giraffe) - 1e-9);
    }
});

test("a giraffe walking along its paddock's side past a rock by the keep box's edge is never thrown across it", () => {
    const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
    const placed = placeTownAnimals(town.animals);
    const set = townColliderSet(placed.open, origin);
    const plains = zooLayout(placed.open).enclosures.find((e) => e.id === "safari_plains-1")!;
    assert.ok(plains, "the plains paddock is open in the fixture");
    // (A live giraffe: 5.0 m drawn, its margin 2.36 m.)
    const body: ResolveBody = {id: "giraffe", radius: 0.5423, half: 1.4662, height: 5.14};
    const keep = penKeep(maskBox(plains.mask), 2.3594, origin.x, origin.z);
    const rock = set.list.find((c) => c.id === "town:zoo:safari_plains-1/mound-23")!;
    assert.ok(rock, "the mound by the side fence");
    // (Its way, as the schedule's walk took it: along the box's edge past the rock, a little outside it, turning.)
    const edge = keep.z - keep.hz;
    let last: {x: number; z: number} | null = null;
    let worst = 0;
    for (let t = 0; t <= 1; t += 0.005) {
        const x = rock.cx - 3 + 6 * t;
        const z = edge - 0.3 + 0.6 * Math.sin(t * Math.PI);
        const yaw = 1.99 - 0.55 * t;
        const pose = {x, y: townHeight(x - origin.x, z - origin.z), z, yaw, aloft: false};
        const out = pushOut(set, body, pose, keep);
        assert.ok(inKeep(keep, out.x, out.z, keepGrow(keep, body, yaw)), `t ${t.toFixed(3)}: outside its keep's give`);
        if (last) worst = Math.max(worst, Math.hypot(out.x - last.x, out.z - last.z));
        last = out;
    }
    // (Its way's own step is 3 cm; the push out of the rock along the edge adds some, never a jump across: 3.8 m before.)
    assert.ok(worst < 0.5, `the biggest step between two poses 3 cm apart: ${worst.toFixed(2)} m`);
});

const LIVE = process.env.ARK_LIVE_SNAPSHOT ?? "public/ark-local/live.json";

test("the live Ark's forest paddock herd: elephants standing still are never placed inside each other", {skip: !existsSync(LIVE)}, () => {
    const raw = JSON.parse(readFileSync(LIVE, "utf8"));
    const town = arkIslandSnapshot(decodeArkSnapshot(raw.snapshot ?? raw)!, "town");
    const placed = placeTownAnimals(town.animals);
    const set = townColliderSet(placed.open, origin);
    const world = scheduleWorld(townWorldSampler(placed.open, origin, set));
    // (As the scene schedules a kept zoo animal and wires its herd: `index.ts` makeSched and wireSchedules.)
    const items = town.animals.filter((a) => placed.town.get(a.id)?.place === "safari_forest-1").map((a) => {
        const info = placed.town.get(a.id)!;
        const p = placed.places.get(a.id)!;
        const length = displayLength(a);
        const keep = penKeep(maskBox(info.enclosure!.mask), info.enclosureMargin!, origin.x, origin.z);
        const sched: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5, kept: true, keep};
        const shape = bodyShape(a.model_slug, length);
        return {a, sched, profile: behaviourProfile(a.model_slug), body: {id: a.id, radius: shape.radius, half: shape.half, height: shape.height} as ResolveBody};
    });
    const byId = new Map(items.map((it) => [it.a.id, it]));
    for (const it of items) {
        it.sched.mates = () => items.map((o) => ({animal: o.sched, profile: o.profile}));
        const lead = placed.places.get(it.a.id)?.leader;
        const leader = lead && lead !== it.a.id ? byId.get(lead) : undefined;
        if (!leader || leader.a.model_slug !== it.a.model_slug || !(["herd", "group"].includes(it.profile.social) || groupLives(it.a.model_slug))) continue;
        const size = items.filter((o) => placed.places.get(o.a.id)?.leader === lead).length;
        it.sched.group = {leader: leader.sched, profile: leader.profile, activity: undefined, rank: Math.max(placed.places.get(it.a.id)?.rank ?? 1, 1), size: Math.max(size, 2)};
    }
    const elephants = items.filter((it) => it.a.model_slug === "asian-elephant");
    assert.ok(elephants.length >= 3 && elephants.some((e) => e.sched.group), "a herd of elephants");
    // (Two hours of their days every 5 s: still ones' poses as the schedule places them.)
    const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
    let inside = 0;
    let samples = 0;
    for (let t = 1796032800; t < 1796032800 + 7200; t += 5) {
        const poses = elephants.map((e) => ({e, pose: poseOnTrip(world, tripAt(world, e.profile, e.sched, t, hours), t)}));
        for (let i = 0; i < poses.length; i++) {
            for (let j = i + 1; j < poses.length; j++) {
                const p = poses[i];
                const q = poses[j];
                if (p.pose.moving || q.pose.moving) continue;
                samples++;
                const pa = {x: p.pose.x, y: p.pose.y, z: p.pose.z, yaw: p.pose.yaw, aloft: false};
                const pb = {x: q.pose.x, y: q.pose.y, z: q.pose.z, yaw: q.pose.yaw, aloft: false};
                if (overlapOf(p.e.body, pa, q.e.body, pb).depth > 0.3) inside++;
            }
        }
    }
    assert.ok(samples > 100, `${samples} still pairs`);
    // (Before: 2736 of 13733, a fifth.)
    console.log(`still elephant pairs inside each other: ${inside} of ${samples}`);
    assert.ok(inside / samples < 0.02, `still elephants inside each other in ${inside} of ${samples} samples`);
});
