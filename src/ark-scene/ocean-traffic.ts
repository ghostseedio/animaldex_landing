/**
 * Boats on the open sea between the islands (graphics pass 2, lane OCEAN; the owner, 2026-11-16: "would be good to see
 * some speedboats or activity in the big ocean too"): three speedboats on their circuits, a sailing yacht beating round
 * the wild island's south-west, and a small passenger ferry between the wild island's jetty and the town's harbour mouth.
 * Generic (no names, no brands), scenery only: no animal reacts to them and nothing of the record depends on them.
 *
 * Pure in the shared clock (epoch seconds): every viewer sees the same boat at the same place at the same moment. Every
 * route lies on water 2.5 m deep or more with no land within 12 m, except the ferry's two landings (checked by
 * `ark-open-ocean.test.ts` over the whole route). `ocean-traffic-render.ts` draws them.
 *
 * Pure: no three.js.
 */

import {loopAt, loopLength, type OceanLoop} from "@/ark-scene/open-ocean";

export type BoatKind = "speedboat" | "sailboat" | "ferry";

/** A boat's circuit (an ellipse, as the animals' loops) or its run (a line there and back, with a wait at each end). */
export type BoatRoute =
    | {kind: BoatKind; id: string; loop: OceanLoop; speed: number; direction: 1 | -1; phase: number; wander: number}
    | {kind: BoatKind; id: string; line: ReadonlyArray<{x: number; z: number}>; speed: number; wait: number; phase: number};

/** The routes, in the islands mode's world frame (the town's origin at (601.2, −249)). */
export const BOAT_ROUTES: readonly BoatRoute[] = [
    // Three speedboats, 11–14 m/s (about 25 knots): a lap of their circuit in 40–70 s.
    {kind: "speedboat", id: "speed-strait", loop: {id: "speed-strait", x: 281, z: -140, rx: 60, rz: 128, turn: -0.393}, speed: 13.5, direction: 1, phase: 0.1, wander: 0.08},
    {kind: "speedboat", id: "speed-south", loop: {id: "speed-south", x: 40, z: 330, rx: 170, rz: 45, turn: 0.05}, speed: 12, direction: -1, phase: 0.55, wander: 0.06},
    {kind: "speedboat", id: "speed-east", loop: {id: "speed-east", x: 330, z: 60, rx: 100, rz: 60, turn: 0.3}, speed: 11, direction: 1, phase: 0.8, wander: 0.08},
    // A yacht under sail off the south-west, slow.
    {kind: "sailboat", id: "yacht", loop: {id: "yacht", x: -200, z: 285, rx: 90, rz: 40, turn: -0.35}, speed: 3.2, direction: 1, phase: 0.3, wander: 0.05},
    // The ferry: off the wild island's jetty to off the town's harbour mouth and back, 7 m/s, half a minute at each.
    {kind: "ferry", id: "ferry", line: [{x: 24, z: 214}, {x: 110, z: 248}, {x: 250, z: 200}, {x: 400, z: 60}, {x: 540, z: -20}, {x: 617, z: -62}], speed: 7, wait: 30, phase: 0.2}
];

/** A boat's length (m) and the wake it trails (m, at full speed). */
export const BOAT_SIZE: Record<BoatKind, {length: number; wake: number}> = {
    speedboat: {length: 6.4, wake: 46},
    sailboat: {length: 9, wake: 12},
    ferry: {length: 22, wake: 40}
};

export type BoatFix = {x: number; z: number; yaw: number; speed: number; kind: BoatKind; id: string};

function polyline(line: ReadonlyArray<{x: number; z: number}>): {lengths: number[]; total: number} {
    const lengths = [0];
    for (let i = 1; i < line.length; i++) lengths.push(lengths[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
    return {lengths, total: lengths[lengths.length - 1]};
}

/** A point `d` m along a polyline, eased round its corners (a quadratic through each inner point's neighbourhood). */
function along(line: ReadonlyArray<{x: number; z: number}>, lengths: number[], d: number): {x: number; z: number} {
    const total = lengths[lengths.length - 1];
    const t = Math.min(Math.max(d, 0), total);
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < t) i++;
    const a = line[i - 1];
    const b = line[i];
    const seg = lengths[i] - lengths[i - 1] || 1;
    const u = (t - lengths[i - 1]) / seg;
    const p = {x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u};
    // (Round a corner: within `r` m of an inner point, a quadratic Bézier from `r` before it to `r` after it.)
    const r = 30;
    const corner = (k: number, offset: number) => {
        const before = line[k - 1];
        const at = line[k];
        const after = line[k + 1];
        const l0 = lengths[k] - lengths[k - 1];
        const l1 = lengths[k + 1] - lengths[k];
        const rr = Math.min(r, l0 / 2, l1 / 2);
        if (Math.abs(offset) > rr) return null;
        const s = (offset + rr) / (2 * rr);
        const p0 = {x: at.x + ((before.x - at.x) * rr) / l0, z: at.z + ((before.z - at.z) * rr) / l0};
        const p2 = {x: at.x + ((after.x - at.x) * rr) / l1, z: at.z + ((after.z - at.z) * rr) / l1};
        return {x: (1 - s) * (1 - s) * p0.x + 2 * s * (1 - s) * at.x + s * s * p2.x, z: (1 - s) * (1 - s) * p0.z + 2 * s * (1 - s) * at.z + s * s * p2.z};
    };
    if (i - 1 >= 1) {
        const c = corner(i - 1, t - lengths[i - 1]);
        if (c) return c;
    }
    if (i <= line.length - 2) {
        const c = corner(i, t - lengths[i]);
        if (c) return c;
    }
    return p;
}

/** Where a boat is at `seconds` (the shared clock), its heading (forward (sin yaw, cos yaw)) and its speed now (m/s). */
export function boatFix(route: BoatRoute, seconds: number): BoatFix {
    if ("loop" in route) {
        const wanderPhase = route.phase * Math.PI * 2;
        const lap = loopLength(route.loop, wanderPhase, route.wander) / route.speed;
        const at = loopAt(route.loop, seconds / lap + route.phase, route.direction, wanderPhase, route.wander);
        return {x: at.x, z: at.z, yaw: at.yaw, speed: route.speed, kind: route.kind, id: route.id};
    }
    // A run: out (easing off and on at each end over 40 m), a wait, back, a wait.
    const {lengths, total} = polyline(route.line);
    const ease = 40;
    // (Time to run the line with the eased ends: the middle at full speed, each end's 40 m at half the speed on average.)
    const run = (total - 2 * ease) / route.speed + (2 * 2 * ease) / route.speed;
    const cycle = 2 * (run + route.wait);
    const t = ((((seconds / cycle + route.phase) % 1) + 1) % 1) * cycle;
    const leg = t < run + route.wait ? 0 : 1;
    const inLeg = leg ? t - run - route.wait : t;
    let d: number;
    let speed: number;
    if (inLeg >= run) {
        d = total;
        speed = 0;
    } else {
        // Distance along the leg with a linear ramp of speed over the first and last `ease` m (2·ease/speed s each).
        const tr = (2 * ease) / route.speed;
        if (inLeg < tr) {
            const s = inLeg / tr;
            d = ease * s * s;
            speed = route.speed * s;
        } else if (inLeg > run - tr) {
            const s = (run - inLeg) / tr;
            d = total - ease * s * s;
            speed = route.speed * s;
        } else {
            d = ease + (inLeg - tr) * route.speed;
            speed = route.speed;
        }
    }
    const dist = leg ? total - d : d;
    const here = along(route.line, lengths, dist);
    const dir = leg ? -1 : 1;
    // (Heading from the way it is going; at a landing, the way it last came in.)
    const probe = Math.min(Math.max(dist + dir * 2, 0), total);
    let ahead = along(route.line, lengths, probe);
    let from = here;
    if (Math.hypot(ahead.x - here.x, ahead.z - here.z) < 0.5) {
        from = along(route.line, lengths, Math.min(Math.max(dist - dir * 2, 0), total));
        ahead = here;
    }
    return {x: here.x, z: here.z, yaw: Math.atan2(ahead.x - from.x, ahead.z - from.z), speed, kind: route.kind, id: route.id};
}
