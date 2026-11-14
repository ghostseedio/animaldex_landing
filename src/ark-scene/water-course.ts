/**
 * A never-stop swimmer's course (behaviours pass, the water fixes on the merged tree, 2026-11-14;
 * docs/ark/behaviour-pass-2026-11/water.md "On the merged tree"): where a whale, a shark, a manta, a tuna or a
 * dolphin is on its patrol at any moment, as one smooth curve in time, not a new way worked out slot by slot.
 *
 * Before: each 80 s slot drew its own goal in the animal's range and `water-patrol.ts` looked for a round from where
 * the last slot left it to that goal, to be swum in the slot's time and come in on the next slot's heading. For a big
 * swimmer the goals were closer together than its turning circle (a fin whale's range was 4 m across, its circle
 * 36 m), so for most slots no round was found: it dashed to the goal and hung there (a blue whale was still 89% of
 * its waking day on the validator's Ark, the great whales 54% between them), and where one was found it came in off
 * its heading, a kink where two slots meet.
 *
 * The course is a wide loop round a middle in open water, with the loop's own middle going slowly round a smaller
 * circle (two turning arms, the second a third as long and a quarter as fast), so no lap repeats the last. Where it
 * is and which way it heads are closed forms of the time: a slot's way is the course over its 80 s, and where one
 * slot ends is exactly where and how the next begins. Its loop is as wide as its range allows and never tighter than
 * its turning circle asks (`water-patrol.ts` turnRadiusOf); the whole ring of water it sweeps is deep enough for it,
 * looked for outwards from its home. Where its water has no room for that, a smaller loop swum slower (it turns no
 * faster than on its own circle), and where there is none at all, no course: the patrol of `water-patrol.ts` as before.
 *
 * Pure geometry: the schedule gives it the water test and its seeded numbers, so every viewer has the same course.
 * Visual only.
 */

export type Course = {
    /** The loop's middle (m). */
    cx: number;
    cz: number;
    /** The loop's radius and its wander's (m). */
    a: number;
    b: number;
    /** How fast it goes round its loop (rad/s, signed: which way round), the wander's rate against it, and their phases. */
    w: number;
    k: number;
    p0: number;
    p1: number;
    /** Its pace on the loop (m/s, the mean: it varies by `b * k / a` either way). */
    pace: number;
};

export type CourseInput = {
    home: {x: number; z: number};
    /** The loop's radius its range asks (m), and the least its turning circle takes at its pace. */
    want: number;
    least: number;
    /** Its patrol's pace (m/s). */
    pace: number;
    /** How far its body reaches past where it is (m): the ring of water it sweeps is this much wider each side. */
    margin: number;
    /** How far from its home the loop's middle may be (m). */
    reach: number;
    /** Which way round (1 or -1) and a seeded 0…1 stream. */
    turn: 1 | -1;
    random: () => number;
    /** Water it can swim, at a point; and how far apart the points of a ring are looked at (m: the walk grid's cell). */
    wet: (x: number, z: number) => boolean;
    cell: number;
};

/** The wander's arm against the loop's, and the two ends of how fast it turns against the loop. */
const WANDER = 0.3;
const WANDER_RATE: [number, number] = [0.2, 0.3];
/** The loop's radius a turning circle takes: its tightest bend is 0.83 of the loop's radius (both arms pulling one way). */
export const COURSE_TURN = 1.2;
/** Smaller loops tried where the water has no room, as shares of the radius asked. */
const SMALLER = [1, 0.8, 0.65, 0.5, 0.4, 0.3];
/** Never slower than this share of its pace on a loop too small for its turning circle. */
const SLOWEST = 0.4;
/** The clock's origin (s): the course's angles stay small numbers. */
const EPOCH = 1_760_000_000;

/** Whether the whole ring between two radii round a point is water it can swim (every `cell` m of it). */
function ringWet(cx: number, cz: number, inner: number, outer: number, cell: number, wet: CourseInput["wet"]): boolean {
    // (A quick look round its outside first: most places near a shore fail here.)
    for (let k = 0; k < 12; k++) if (!wet(cx + Math.cos((k / 12) * Math.PI * 2) * outer, cz + Math.sin((k / 12) * Math.PI * 2) * outer)) return false;
    for (let r = outer; r >= inner; r -= cell) {
        const n = Math.max(Math.ceil((Math.PI * 2 * r) / cell), 8);
        for (let k = 0; k < n; k++) if (!wet(cx + Math.cos((k / n) * Math.PI * 2) * r, cz + Math.sin((k / n) * Math.PI * 2) * r)) return false;
    }
    return true;
}

/**
 * Its course: a loop whose ring of water is clear, at the middle nearest its home that has room for a wide one (its
 * home first, then rings out to `reach`, twelve bearings each from a seeded one; at each the widest that fits), else
 * the same for the small ones, or null where none fits.
 */
export function courseOf(input: CourseInput): Course | null {
    const {home, random, wet, cell} = input;
    const k = WANDER_RATE[0] + (WANDER_RATE[1] - WANDER_RATE[0]) * random();
    const p0 = random() * Math.PI * 2;
    const p1 = random() * Math.PI * 2;
    const first = random() * Math.PI * 2;
    const step = Math.max(input.want / 3, cell * 2);
    // (A wide loop first, at the middle nearest its home that has room for one; then the small ones the same way.)
    for (const shares of [SMALLER.filter((share) => share >= 0.65), SMALLER.filter((share) => share < 0.65)]) {
        for (let d = 0; d <= input.reach + 1e-6; d += step) {
            const n = d === 0 ? 1 : 12;
            for (let i = 0; i < n; i++) {
                const cx = home.x + Math.cos(first + (i / n) * Math.PI * 2) * d;
                const cz = home.z + Math.sin(first + (i / n) * Math.PI * 2) * d;
                if (!wet(cx, cz)) continue;
                for (const share of shares) {
                    const a = input.want * share;
                    if (a < Math.max(input.margin, cell)) break;
                    if (!ringWet(cx, cz, Math.max(a * (1 - WANDER) - input.margin, 0), a * (1 + WANDER) + input.margin, cell, wet)) continue;
                    // (On a loop too small for its turning circle it swims slower: it turns no faster than on its own.)
                    const pace = input.pace * Math.min(Math.max(a / Math.max(input.least, 1e-6), SLOWEST), 1);
                    return {cx, cz, a, b: a * WANDER, w: (input.turn * pace) / a, k, p0, p1, pace};
                }
            }
        }
    }
    return null;
}

/** Where it is on its course at a world time, and the way it heads (the scene's yaw: forward is (sin, cos)). */
export function courseAt(course: Course, epochSeconds: number): {x: number; z: number; yaw: number} {
    const t = epochSeconds - EPOCH;
    const p = course.p0 + course.w * t;
    const q = course.p1 + course.k * course.w * t;
    const vx = -course.a * Math.sin(p) - course.b * course.k * Math.sin(q);
    const vz = course.a * Math.cos(p) + course.b * course.k * Math.cos(q);
    const way = course.w < 0 ? -1 : 1;
    return {x: course.cx + course.a * Math.cos(p) + course.b * Math.cos(q), z: course.cz + course.a * Math.sin(p) + course.b * Math.sin(q), yaw: Math.atan2(vx * way, vz * way)};
}

/**
 * Its way along its course from one time to another, as points (one every 0.12 rad of its loop, 8 to 48 of them, its
 * two ends exact). With `from`, a way that starts off the course: the course's own shape carried over from where it
 * is, the gap closed smoothly through the slot (no gap is left by its end, and it comes in on the course's heading).
 */
export function courseWay(course: Course, start: number, end: number, from?: {x: number; z: number} | null): Array<{x: number; z: number}> {
    const n = Math.min(Math.max(Math.ceil((Math.abs(course.w) * (end - start)) / 0.12), 8), 48);
    const at0 = courseAt(course, start);
    const gap = from ? {x: from.x - at0.x, z: from.z - at0.z} : null;
    const out: Array<{x: number; z: number}> = [];
    for (let i = 0; i <= n; i++) {
        const u = i / n;
        const at = courseAt(course, start + (end - start) * u);
        const left = gap ? 1 - u * u * (3 - 2 * u) : 0;
        out.push(gap ? {x: at.x + gap.x * left, z: at.z + gap.z * left} : {x: at.x, z: at.z});
    }
    return out;
}
