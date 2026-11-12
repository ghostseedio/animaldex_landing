/**
 * Walks the scene lays out itself, routed by the walk grid (collisions, motion pass L5): a hamlet resident's door beat
 * (`map/hamlet.ts`: out of its door to its spot in the garden or the paddock, and back) went in a straight line, through
 * its own house, the picket fence or the paddock's rails. Now it walks the walk grid's path between the two (round the
 * house, through the gate), at the same pace over the same beat: a pure function of the two ends and its body, the same
 * for every viewer.
 */

import {alongPath, MAX_SLOPE, pathLength, type NavGrid, type NavPoint} from "@/ark-scene/behaviour-nav";

const routes = new Map<string, NavPoint[]>();

/** The walk between two points for a body of this radius (the grid's path; the straight line if it finds none). */
export function walkRoute(nav: NavGrid | null, from: {x: number; z: number}, to: {x: number; z: number}, radius: number): NavPoint[] {
    if (!nav || !nav.colliders) return [{x: from.x, z: from.z}, {x: to.x, z: to.z}];
    const key = `${nav.version}|${from.x.toFixed(2)},${from.z.toFixed(2)}|${to.x.toFixed(2)},${to.z.toFixed(2)}|${radius.toFixed(2)}`;
    let route = routes.get(key);
    if (!route) {
        const path = nav.path({x: from.x, z: from.z}, {x: to.x, z: to.z}, "walk", 0.5, 6000, MAX_SLOPE, radius);
        const end = path[path.length - 1];
        // (Not reached, a spot its body does not quite fit at: the way as far as it goes, and the last short step to it.)
        route = Math.hypot(end.x - to.x, end.z - to.z) < 0.01 ? path : [...path, {x: to.x, z: to.z}];
        if (routes.size > 2000) routes.clear();
        routes.set(key, route);
    }
    return route;
}

/** Where a door beat has it (`t` 0–1 through the beat), along its route, and the way it faces. */
export function doorWalkAt(nav: NavGrid | null, from: {x: number; z: number}, to: {x: number; z: number}, radius: number, t: number): {x: number; z: number; yaw: number} {
    const route = walkRoute(nav, from, to, radius);
    const total = pathLength(route);
    const at = alongPath(route, t, total);
    // (Facing a little way on along its route, as a schedule walk does: a corner is turned through.)
    if (total > 0.01 && t < 1) {
        const ahead = alongPath(route, Math.min(t + 0.6 / total, 1), total);
        if (Math.hypot(ahead.x - at.x, ahead.z - at.z) > 0.02) at.yaw = Math.atan2(ahead.x - at.x, ahead.z - at.z);
    }
    return at;
}
