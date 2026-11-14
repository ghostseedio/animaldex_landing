/**
 * A swimmer's patrol (behaviours pass, lane B6 water, 2026-11-14; docs/ark/behaviour-pass-2026-11/water.md): the way
 * it swims from where a slot finds it to where the slot's goal is, when its way of life is to keep swimming
 * (`water-life.ts` patrolRule). Not the straight line there (a few seconds' swim, then a slot hanging at the spot):
 * a round through its range, as long as its pace covers in its time, setting off the way it faces and coming in on
 * the heading it will leave by, so slot after slot is one unbroken swim.
 *
 * The round: points about its range's middle, each a sixth to a quarter turn on from the last (always the same way
 * round for one animal), at over half the range's radius, until the way is long enough; then to its goal. Every
 * point is over water deep enough for it and every run between two is over water (else that point is left out), and
 * the way is then swum a step at a time with a turning circle (`swum`), so every corner is an arc and it never turns
 * on the spot.
 *
 * Pure geometry: the schedule gives it the water test and its seeded numbers, so every viewer has the same patrol.
 * Visual only.
 */

export type PatrolPoint = {x: number; z: number};

export type PatrolInput = {
    from: PatrolPoint;
    to: PatrolPoint;
    /** The heading it sets off on and the one it comes in on (radians, the scene's yaw: forward is (sin, cos)); null when not known. */
    fromYaw: number | null;
    toYaw: number | null;
    /** Its range's middle and radius (m). */
    centre: PatrolPoint;
    radius: number;
    /** How long the way should be (m). */
    length: number;
    /** Its body's length (m): how far its lead-in and lead-out run. */
    body: number;
    /** Which way round when its heading does not say (1 or -1), and a seeded 0…1 stream. */
    turn: 1 | -1;
    random: () => number;
    /**
     * The tightest circle it turns (m, its radius): by its size and its pace (`turnRadiusOf`). Absent: two and a half
     * steps of its way, whatever its size.
     */
    turnRadius?: number;
    /** Fewer steps to the way (36, 72 at most): for one that stops at its goal, where no next slot hangs on its heading. */
    coarse?: boolean;
    /** Over water it can swim, at a point; and all the way from one point to another. */
    wet: (x: number, z: number) => boolean;
};

const dist = (a: PatrolPoint, b: PatrolPoint) => Math.hypot(b.x - a.x, b.z - a.z);

/** Whether the straight run from a to b is over water all the way (a look every 1.5 m, at most 40). */
function runWet(a: PatrolPoint, b: PatrolPoint, wet: PatrolInput["wet"]): boolean {
    const d = dist(a, b);
    const steps = Math.min(Math.max(Math.ceil(d / 1.5), 1), 40);
    for (let k = 1; k < steps; k++) if (!wet(a.x + ((b.x - a.x) * k) / steps, a.z + ((b.z - a.z) * k) / steps)) return false;
    return true;
}

/** The point `along` metres down a polyline (its end past it). */
function pointAt(points: PatrolPoint[], along: number): PatrolPoint {
    let left = along;
    for (let i = 0; i + 1 < points.length; i++) {
        const d = dist(points[i], points[i + 1]);
        if (left <= d && d > 0) return {x: points[i].x + ((points[i + 1].x - points[i].x) * left) / d, z: points[i].z + ((points[i + 1].z - points[i].z) * left) / d};
        left -= d;
    }
    return points[points.length - 1];
}

/** The most it turns in one step of its way (radians): a turning circle of two and a half steps, where its size asks no wider. */
const STEP_TURN = 0.4;

/**
 * The tightest circle a swimmer turns on its way (m, its radius), by its body's length and its pace: 1.2 of its
 * length at least, more for the biggest (a 14 m whale's turn is a wide arc, a dolphin's a few metres), and never a full turn in under
 * half a minute at its pace (a round is a swim, not a spin). So at its patrol's pace a dolphin takes about a quarter
 * of a minute to come right round, a great whale most of a minute. (Behaviours pass, the merged tree: every size had
 * the same two-and-a-half-step circle, and a humpback turned 500 degrees in 20 s.)
 */
export function turnRadiusOf(length: number, pace: number): number {
    // (Wider than 1.2 of its length for the great whales: half its length to the power of one and a half, a 13 m humpback's
    // 19 m.)
    return Math.max(length * 1.2, 0.4 * length ** 1.5, (pace * 30) / (2 * Math.PI));
}

/**
 * The way as a swimmer swims it: from the polyline's start, on `yaw` (else along its first run), a step at a time
 * towards a point two and a half steps ahead of it on the polyline, turning at most STEP_TURN a step. So every corner
 * is an arc it can swim, and it never turns on the spot or doubles back.
 *
 * With a `runIn` (the polyline's last run is its straight coming-in, on the heading it must arrive by): it makes for
 * the run's start, and once within its turning circle of it follows the run's line in (steering for the point on the
 * line two and a half steps ahead of where it is abreast of), so it is on its heading by its goal. The last few steps
 * are eased onto the polyline's end (it comes in within about a step of it). Null when it cannot get there in three
 * times the polyline's length.
 */
function swum(points: PatrolPoint[], step: number, yaw: number | null, runIn: boolean, turnRadius: number): PatrolPoint[] | null {
    // (Its turn a step, and how near a point of its way counts as reached: its turning circle's.)
    const most1 = Math.min(STEP_TURN, step / Math.max(turnRadius, 1e-6));
    const reach = Math.max(step * 2.5, turnRadius);
    const total = patrolLength(points);
    const end = points[points.length - 1];
    const gate = points[points.length - 2];
    const run = runIn ? dist(gate, end) : 0;
    const before = total - run;
    const fx = run > 0 ? (end.x - gate.x) / run : 0;
    const fz = run > 0 ? (end.z - gate.z) / run : 0;
    const out: PatrolPoint[] = [points[0]];
    let at = points[0];
    let heading = yaw ?? Math.atan2(points[1].x - points[0].x, points[1].z - points[0].z);
    let target = 0;
    let onRun = false;
    let waited = 0;
    const most = Math.ceil((total / step) * 3) + 8;
    for (let k = 0; k < most; k++) {
        let aim: PatrolPoint;
        if (run > 0 && !onRun) {
            while (target < before && dist(at, pointAt(points, target)) < reach) target += step * 0.5;
            aim = target >= before ? gate : pointAt(points, target);
            // (At the run's start, or a full turn spent trying for it: onto the run.)
            // (By the run's start and heading its way, not passing it the other way; or a turn and a quarter spent
            // trying for it: onto the run.)
            if (target >= before && ((dist(at, gate) < reach && Math.sin(heading) * fx + Math.cos(heading) * fz > 0.2) || waited > Math.PI * 2.5)) onRun = true;
        } else {
            while (target < total && dist(at, pointAt(points, target)) < reach) target += step * 0.5;
            aim = target >= total ? end : pointAt(points, target);
        }
        if (onRun) {
            const along = Math.min(Math.max((at.x - gate.x) * fx + (at.z - gate.z) * fz, 0), run);
            const to = Math.min(along + reach, run);
            aim = {x: gate.x + fx * to, z: gate.z + fz * to};
            target = total;
        }
        if (target >= total && dist(at, end) < step * 1.3) {
            // Eased onto its end over its last steps (six at most).
            const n = Math.min(6, out.length - 1);
            const dx = end.x - at.x;
            const dz = end.z - at.z;
            for (let i = 1; i <= n; i++) {
                const p = out[out.length - 1 - n + i];
                out[out.length - 1 - n + i] = {x: p.x + (dx * i) / n, z: p.z + (dz * i) / n};
            }
            // (Its end itself, to the bit: the next slot starts from it.)
            if (n === 0) out.push(end);
            else out[out.length - 1] = end;
            return out;
        }
        const want = Math.atan2(aim.x - at.x, aim.z - at.z);
        const turn = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
        heading += Math.min(Math.max(turn, -most1), most1);
        // (Circling the run's start, which lies inside its turning circle: after a turn and a quarter, onto the run.)
        if (run > 0 && !onRun && target >= before) waited += Math.min(Math.abs(turn), most1);
        at = {x: at.x + Math.sin(heading) * step, z: at.z + Math.cos(heading) * step};
        out.push(at);
    }
    return null;
}

/**
 * A doubling back opened into a turn: a corner of over 100 degrees becomes two, `width` apart across the way it came
 * (a swimmer turns round in a U, never on the spot), each over water, else the corner is kept.
 */
function opened(points: PatrolPoint[], width: number, wet: PatrolInput["wet"]): PatrolPoint[] {
    const out: PatrolPoint[] = [points[0]];
    for (let i = 1; i + 1 < points.length; i++) {
        const a = out[out.length - 1];
        const v = points[i];
        const c = points[i + 1];
        const la = dist(a, v);
        const lc = dist(v, c);
        const cross = (v.x - a.x) * (c.z - v.z) - (v.z - a.z) * (c.x - v.x);
        const turn = Math.abs(Math.atan2(cross, (v.x - a.x) * (c.x - v.x) + (v.z - a.z) * (c.z - v.z)));
        if (turn <= 1.75 || la < 1e-6 || lc < 1e-6 || i === 1 || i === points.length - 2) {
            out.push(v);
            continue;
        }
        const w = Math.min(width, la / 2, lc / 2);
        // (Across the way it came, towards the side it turns to: first the far side, then round.)
        const side = cross >= 0 ? 1 : -1;
        const nx = (-(v.z - a.z) / la) * side;
        const nz = ((v.x - a.x) / la) * side;
        const first = {x: v.x - ((v.x - a.x) / la) * w - nx * w * 0.5, z: v.z - ((v.z - a.z) / la) * w - nz * w * 0.5};
        const second = {x: v.x + ((c.x - v.x) / lc) * w + nx * w * 0.5, z: v.z + ((c.z - v.z) / lc) * w + nz * w * 0.5};
        if (wet(first.x, first.z) && wet(second.x, second.z) && runWet(a, first, wet) && runWet(first, second, wet) && runWet(second, c, wet)) out.push(first, second);
        else out.push(v);
    }
    out.push(points[points.length - 1]);
    return out;
}

export function patrolLength(points: PatrolPoint[]): number {
    let total = 0;
    for (let i = 0; i + 1 < points.length; i++) total += dist(points[i], points[i + 1]);
    return total;
}

/**
 * The patrol's path from `from` to `to`, about `length` long (within a run between two points of it; never shorter
 * than the straight way), or null when its water gives it no room for one (its goal is then swum to as before).
 */
export function patrolRoute(input: PatrolInput): PatrolPoint[] | null {
    // (Where its round runs into the shore, a smaller one, twice at most, never under three of its lengths across its
    // radius: a 1.6 m seal turned a full circle in under 20 s on a 2 m round.)
    const smaller = (share: number) => (input.radius * share >= input.body * 3 ? roundOf(input, input.radius * share) : null);
    // (Where no round fits its time and its turning circle, a great whale's 120 m in a slot against a circle 38 m
    // across: no round, its way there in two arcs that meet, `met`. For it first; for the others when no round is found.)
    const wide = (input.turnRadius ?? 0) * 6 > input.length;
    if (wide) return met(input) ?? roundOf(input, input.radius);
    return roundOf(input, input.radius) ?? smaller(0.6) ?? smaller(0.35) ?? met(input);
}

/**
 * Its way as two arcs that meet (for a swimmer with a wide turning circle): one swum from where it is, the way it
 * faces; the other swum backwards from its goal, off against the heading it must come in on; each straight for a
 * stretch (so the way is about as long as asked), then turning towards the other at its turning circle until they
 * meet head on. Joined, the way sets off as it faces and comes in on its heading exactly, with no corner between: its
 * two ends are swum, not aimed at. Null when they do not meet (circling each other) or the way leaves its water.
 */
function met(input: PatrolInput): PatrolPoint[] | null {
    const {from, to, wet} = input;
    const direct = dist(from, to);
    if (input.length < Math.max(direct * 1.15, input.body * 2, 0.5)) return null;
    const turning = Math.max(input.turnRadius ?? 0, input.length / 26);
    const step = Math.max(input.length / (input.coarse ? 36 : 64), 1e-3);
    const most1 = Math.min(STEP_TURN, step / turning);
    const line = Math.atan2(to.x - from.x, to.z - from.z);
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    // (Straight first for a share of what the way asks beyond the straight line and a half turn each: longest first.)
    for (const share of [0.5, 0.3, 0.15, 0]) {
        const straight = Math.max(input.length - direct - Math.PI * turning, 0) * share;
        let a = from;
        let b = to;
        let ha = input.fromYaw ?? line;
        let hb = (input.toYaw ?? line) + Math.PI;
        const first: PatrolPoint[] = [a];
        const last: PatrolPoint[] = [b];
        let ok = false;
        for (let k = 0; k < 200; k++) {
            if (dist(a, b) < step * 1.5) {
                ok = true;
                break;
            }
            const free = k * step >= straight;
            if (free) ha += Math.min(Math.max(wrap(Math.atan2(b.x - a.x, b.z - a.z) - ha), -most1), most1);
            a = {x: a.x + Math.sin(ha) * step, z: a.z + Math.cos(ha) * step};
            if (dist(a, b) < step * 1.5) {
                first.push(a);
                ok = true;
                break;
            }
            if (free) hb += Math.min(Math.max(wrap(Math.atan2(a.x - b.x, a.z - b.z) - hb), -most1), most1);
            b = {x: b.x + Math.sin(hb) * step, z: b.z + Math.cos(hb) * step};
            if (!wet(a.x, a.z) || !wet(b.x, b.z)) break;
            first.push(a);
            last.push(b);
        }
        // (Met head on, within half a radian: passing side by side is no meeting, the join would be a corner.)
        if (!ok || Math.abs(wrap(ha - (hb + Math.PI))) > 0.5) continue;
        // (Where they meet: the middle of the two, in place of both.)
        const pa = first[first.length - 1];
        const pb = last[last.length - 1];
        const way = first.length > 1 && last.length > 1 ? [...first.slice(0, -1), {x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2}, ...last.slice(0, -1).reverse()] : [...first, ...last.reverse()];
        if (way.length < 3 || patrolLength(way) > input.length * 1.5) continue;
        // (Over water at every point of it, its two ends too.)
        if (way.some((p) => !wet(p.x, p.z))) continue;
        return thinned(way);
    }
    return null;
}

function roundOf(input: PatrolInput, within: number, round = true): PatrolPoint[] | null {
    const {from, to, centre, wet, random} = input;
    const direct = dist(from, to);
    if (input.length < Math.max(direct * 1.15, input.body * 2, 0.5)) return null;
    // (Half a lap of its range or so in a slot: a short way keeps to a smaller round.)
    const turning = input.turnRadius ?? 0;
    // (Its round a little wider than its turning circle at least.)
    const radius = Math.max(Math.min(within, input.length / 2.5), turning ? Math.max(input.body * 2, turning * 1.3) : input.body * 3, 0.4);
    // (Its set-off and its coming in run straight for a few lengths, a twenty-fifth of the way at least.)
    const lead = Math.min(Math.max(input.body * 2, 0.5, input.length * 0.04), Math.max(radius * 0.5, 0.3), input.length * 0.12);
    const points: PatrolPoint[] = [from];
    let last = from;
    let total = 0;
    const add = (p: PatrolPoint): boolean => {
        if (!wet(p.x, p.z) || !runWet(last, p, wet)) return false;
        total += dist(last, p);
        points.push(p);
        last = p;
        return true;
    };
    const ahead = (yaw: number) => ({x: Math.sin(yaw), z: Math.cos(yaw)});
    /** A point `on` ahead of `p` along a heading and `aside` to its right. */
    const off = (p: PatrolPoint, yaw: number, on: number, aside: number) => ({x: p.x + ahead(yaw).x * on + ahead(yaw).z * aside, z: p.z + ahead(yaw).z * on - ahead(yaw).x * aside});
    /** How far to the right of a heading from `p` a point lies, and how far ahead. */
    const right = (p: PatrolPoint, yaw: number, q: PatrolPoint) => (q.x - p.x) * ahead(yaw).z - (q.z - p.z) * ahead(yaw).x;
    const front = (p: PatrolPoint, yaw: number, q: PatrolPoint) => (q.x - p.x) * ahead(yaw).x + (q.z - p.z) * ahead(yaw).z;
    // Setting off the way it faces.
    const setOff = input.fromYaw !== null && add(off(from, input.fromYaw, lead, 0)) ? last : null;
    // Coming in on the heading it will leave by: a run of its lead straight in.
    // (Long enough to be on its heading by its goal: a sixth of the way, ten steps, four of its turning circles' radii.)
    let leadIn = Math.min(Math.max(lead, input.length * 0.16, turning * 1.2), Math.max(radius, lead));
    let end: PatrolPoint = to;
    // (As long a run as its water has room for behind its goal.)
    for (const run of input.toYaw !== null ? [leadIn, leadIn * 0.6, Math.max(leadIn * 0.3, lead), lead] : []) {
        const before = off(to, input.toYaw!, -run, 0);
        if (wet(before.x, before.z) && runWet(before, to, wet)) {
            end = before;
            leadIn = run;
            break;
        }
    }
    const tail = end === to ? 0 : dist(end, to);
    let angle = Math.atan2(last.z - centre.z, last.x - centre.x);
    // Round its range the way it is already heading (so it does not turn back on itself to start), else its own way.
    let turn = input.turn;
    if (input.fromYaw !== null) {
        const along = -Math.sin(angle) * ahead(input.fromYaw).x + Math.cos(angle) * ahead(input.fromYaw).z;
        if (Math.abs(along) > 0.2) turn = along > 0 ? 1 : -1;
    }
    let misses = 0;
    for (let k = 0; round && k < 28 && misses < 10; k++) {
        // Long enough, and behind where it must come in (so it need not double back to come in on its heading): from
        // four fifths of the way asked; a quarter over it at most.
        const so = total + dist(last, end) + tail;
        if (so >= input.length * 1.25) break;
        if (so >= input.length * 0.8 && (end === to || input.toYaw === null || front(end, input.toYaw, last) < -dist(end, last) * 0.3)) break;
        angle += turn * (Math.PI / 3 + (random() * Math.PI) / 5);
        // (Further in where the shore is close: a point that is not over water is tried again nearer the middle.)
        let placed = false;
        for (const share of [0.5 + 0.4 * random(), 0.4, 0.2]) {
            const p = {x: centre.x + Math.cos(angle) * radius * share, z: centre.z + Math.sin(angle) * radius * share};
            // (Not past what is left of the way: the last point before its goal is as far out as the way allows.)
            if (total + dist(last, p) + dist(p, end) + tail > input.length * 1.3 && points.length > 2) continue;
            // (Its first point off to one side of the way it faces: it swings out towards it, not round on the spot.)
            if (setOff && last === setOff && input.fromYaw !== null && front(setOff, input.fromYaw, p) < dist(setOff, p) * 0.7) add(off(setOff, input.fromYaw, lead, Math.sign(right(setOff, input.fromYaw, p) || 1) * lead * 0.8));
            if (add(p)) {
                placed = true;
                break;
            }
        }
        if (!placed) misses++;
    }
    if (end !== to && input.toYaw !== null && front(end, input.toYaw, last) > -dist(end, last) * 0.7) {
        // (Not coming from behind where it must come in: round by its side first, the side it comes from.)
        const side = Math.sign(right(end, input.toYaw, last) || 1);
        // (Wide where there is room for it, tighter by the shore.)
        if (!add(off(end, input.toYaw, -leadIn * 0.8, side * leadIn * 1.2))) add(off(end, input.toYaw, -lead, side * lead * 0.8));
    }
    let runIn = false;
    if (end !== to) {
        if (!runWet(last, end, wet)) {
            if (points.length <= 2 || !runWet(last, to, wet)) return null;
        } else {
            points.push(end);
            runIn = true;
        }
    } else if (!runWet(last, to, wet)) return null;
    points.push(to);
    if (points.length < 3) return null;
    // Swum at even steps: 64 to the way, more (120 at most) where its round is tight for that, so its turning circle
    // (two and a half steps) is a quarter of its round's radius at most. Every corner an arc.
    const whole = patrolLength(points);
    const step = input.coarse ? Math.max(whole / 72, Math.min(whole / 36, radius * 0.14)) : Math.max(whole / 120, Math.min(whole / 64, radius * 0.1));
    const way = swum(opened(points, Math.max(step * 3, turning * 2), wet), step, input.fromYaw, runIn, turning);
    // (An arc is inside its corner: over water wherever both runs were, save round a headland's tip. No way it can
    // swim, or one over land: no patrol, it swims straight to its goal as before.)
    if (!way) return null;
    for (const p of way) if (!wet(p.x, p.z)) return null;
    // (Half as long again as asked or more: it would have to swim it half as fast again. A smaller round, or none.)
    if (patrolLength(way) > input.length * 1.5) return null;
    return thinned(way);
}

/**
 * The swum way with the points of its straight runs and its gentle arcs left out (a point where it has turned under
 * 0.16 rad since the last one kept, up to three in a row): the same way to within a few centimetres in a hundred
 * metres, in under half the points (a trip is remembered for half an hour of slots, and a phone holds a few hundred
 * swimmers' trips).
 */
function thinned(way: PatrolPoint[]): PatrolPoint[] {
    const out: PatrolPoint[] = [way[0]];
    let skipped = 0;
    for (let i = 1; i + 1 < way.length; i++) {
        const a = out[out.length - 1];
        const turn = Math.abs(Math.atan2((way[i].x - a.x) * (way[i + 1].z - way[i].z) - (way[i].z - a.z) * (way[i + 1].x - way[i].x), (way[i].x - a.x) * (way[i + 1].x - way[i].x) + (way[i].z - a.z) * (way[i + 1].z - way[i].z)));
        // (Its second point and its last but one are kept: its set-off and its coming-in headings.)
        if (turn < 0.16 && skipped < 3 && i > 1 && i < way.length - 2) {
            skipped++;
            continue;
        }
        skipped = 0;
        out.push(way[i]);
    }
    out.push(way[way.length - 1]);
    return out;
}
