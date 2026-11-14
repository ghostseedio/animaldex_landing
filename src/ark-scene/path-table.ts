/**
 * A long path's run lengths worked out once (behaviours pass 2026-11, lane BP perf; visual only).
 *
 * `alongPath` and `pathLength` (`behaviour-nav.ts`) walk a path from its start each time they are asked, a square root
 * a run. That was nothing while a path was two to five points. A swimmer's patrol is 20 to 120 points
 * (`water-patrol.ts`), and a pose on it asks three times a frame (where it is, the path's length, where it faces): a
 * whale's pose took 14 microseconds against 3 on main.
 *
 * Here the runs' lengths are kept beside the path the first time a pose asks, and the same sums are made from them:
 * the same additions and subtractions in the same order on the same numbers, so every answer is the same to the bit
 * (the tests compare them; the pass's pose check compares the whole snapshot's). A short path is left to the plain
 * functions (nothing to save, and nothing kept for it). A path changed since (its length, or its last point) is
 * measured again.
 */
import {alongPath, pathLength, type NavPoint} from "@/ark-scene/behaviour-nav";

/** Paths this long or longer get a table. */
export const PATH_TABLE_FROM = 8;

type Table = {count: number; lastX: number; lastZ: number; total: number; runs: Float64Array};
const TABLES = new WeakMap<NavPoint[], Table>();

function tableOf(path: NavPoint[]): Table {
    const count = path.length;
    const last = path[count - 1];
    const known = TABLES.get(path);
    if (known && known.count === count && known.lastX === last.x && known.lastZ === last.z) return known;
    const runs = new Float64Array(count - 1);
    let total = 0;
    for (let i = 1; i < count; i++) {
        const run = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
        runs[i - 1] = run;
        // (As `pathLength` adds them: from the start, one at a time.)
        total += run;
    }
    const table = {count, lastX: last.x, lastZ: last.z, total, runs};
    TABLES.set(path, table);
    return table;
}

/** `pathLength(path)`, to the bit. */
export function tabledLength(path: NavPoint[]): number {
    return path.length < PATH_TABLE_FROM ? pathLength(path) : tableOf(path).total;
}

/** `alongPath(path, fraction, total)`, to the bit. */
export function tabledAlong(path: NavPoint[], fraction: number, total = tabledLength(path)): {x: number; z: number; yaw: number} {
    if (path.length < PATH_TABLE_FROM) return alongPath(path, fraction, total);
    if (total <= 0) return {x: path[0].x, z: path[0].z, yaw: 0};
    const runs = tableOf(path).runs;
    let remaining = Math.min(Math.max(fraction, 0), 1) * total;
    for (let i = 1; i < path.length; i++) {
        const run = runs[i - 1];
        if (remaining <= run || i === path.length - 1) {
            const a = path[i - 1];
            const b = path[i];
            const t = run > 0 ? Math.min(remaining / run, 1) : 1;
            return {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z)};
        }
        remaining -= run;
    }
    const end = path[path.length - 1];
    return {x: end.x, z: end.z, yaw: 0};
}
