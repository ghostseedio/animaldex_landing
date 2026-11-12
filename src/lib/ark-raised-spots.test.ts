/**
 * Raised schedule spots on the bigger wild island (v2; the film lane's find, 2026-11-13): an animal arrived on a raised
 * place the schedule sent it to (a rock's top, a ledge, a branch, a limb, a log, a post) is drawn on that place's
 * surface, never sunk to the terrain under it. The grounding hook (`grounding/hook.ts` scheduledPerch) holds it there,
 * whether the place is one of the scenery's points or one the schedule's own world made (`world-sampler.ts`
 * `rock_top:<n>`) or a map roost (`map:<id>`); and grounding's own test (`standsOnGround`, the scene's `grounded`
 * guard in `index.ts`) never reads it as on the ground, so the legged driver never re-levels it onto the terrain.
 *
 * The collisions' synthetic Ark (every species, `lib/ark-collide/fixture.ts`), its wild animals on v2, over two hours
 * of the shared clock.
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {heightAt, setArkWorld} from "@/ark-scene/world";
import {collideFixture} from "@/lib/ark-collide/fixture";
import {buildSim} from "@/lib/ark-collide/sim";
import {poseOnTrip, tripAt} from "@/ark-scene/behaviour-schedule";
import {RAISED_POINT_TAGS, scheduledPerch, standsOnGround} from "@/ark-scene/grounding/hook";
import {drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";

const tagOf = (id: string) => (id.startsWith("map:") ? id.slice(4) : id).split(":")[0];

test("v2: every animal arrived on a raised schedule spot is drawn on that spot's surface, never below it (two hours)", () => {
    setArkWorld("v2");
    const animals = collideFixture(path.resolve(".")).filter((a) => a.area !== "house" && a.area !== "farm" && a.area !== "zoo");
    const sim = buildSim(animals, {});
    const from = Math.floor(Date.UTC(2026, 10, 12, 0, 0, 0) / 1000);
    const below: string[] = [];
    const grounded: string[] = [];
    const seen = new Map<string, number>();
    for (let t = from; t < from + 2 * 3600; t += 60) {
        for (const s of sim.animals) {
            if (!s.sched || s.place.host) continue;
            const trip = tripAt(sim.world, s.profile, s.sched, t, sim.hoursAt, s.a.activity);
            const to = trip.to;
            if (!to?.point || !RAISED_POINT_TAGS.has(tagOf(to.point))) continue;
            const pose = poseOnTrip(sim.world, trip, t);
            if (t < trip.arrive || pose.moving || pose.aloft || Math.hypot(pose.x - to.x, pose.z - to.z) > 0.05) continue;
            // Raised, as grounding reads it: above the analytic and the drawn ground both, by its tolerance.
            const ground = Math.max(heightAt(to.x, to.z), drawnGroundHeight(to.x, to.z));
            if (to.y <= ground + 0.05) continue;
            seen.set(tagOf(to.point), (seen.get(tagOf(to.point)) ?? 0) + 1);
            const frame = scheduledPerch(pose, to, true, 0, {x: 0, y: 0}, drawnGroundHeight);
            // Drawn on the place: the hook's surface, at the spot's height (the scenery point it names, or the spot itself).
            if (!frame || frame.y < to.y - 0.01) below.push(`${s.a.model_slug}@${to.point} ${frame ? `${(to.y - frame.y).toFixed(2)} m under` : "no surface"}, ${(to.y - ground).toFixed(2)} m up`);
            // And never on the ground by grounding's own test (the scene's `grounded` guard: no re-level onto the terrain).
            if (standsOnGround({x: pose.x, z: pose.z, base: frame?.y ?? pose.y, afloat: false}, heightAt(pose.x, pose.z), drawnGroundHeight(pose.x, pose.z))) grounded.push(`${s.a.model_slug}@${to.point}`);
        }
    }
    // The sample reaches the raised places this is about: rock tops (basking), rock faces, ledges, branches.
    for (const tag of ["rock_top", "rock_face", "ledge", "branch"]) assert.ok((seen.get(tag) ?? 0) > 0, `no arrival on a raised ${tag} sampled: ${JSON.stringify(Object.fromEntries(seen))}`);
    assert.deepEqual(below.slice(0, 8), [], `${below.length} arrivals drawn below their spot`);
    assert.deepEqual(grounded.slice(0, 8), [], `${grounded.length} arrivals read as on the ground`);
});
