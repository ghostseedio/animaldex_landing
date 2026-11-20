/**
 * The record's escapes acted out in the live world (AnimalDex decision 373; owner 2026-11-16: "the chase that ends in
 * a miss, then a limp for a while"). Each `escaped` event of the record (a prey animal that got away from a
 * predator's attempt: the server decides every one, from the predator kind's published hunting success rate) is acted
 * on the shared clock from the encounter's step, the same for every viewer:
 *
 *   stalk    the predator turns to its prey and comes on, low and slow, to where it breaks cover;
 *   rush     it sprints; the prey looks up, bolts and darts, the predator cutting its corners and closing;
 *   miss     the lunge (a snake's strike, a raptor's stoop): the prey jinks aside and it meets empty air. It is never
 *            a catch: the two bodies are never nearer than `missGap` (held by construction, every sample);
 *   clear    the predator pulls up and watches it go; the prey runs on, slows and looks back;
 *   part     each goes back to where its day has it now: the prey at a limping pace.
 *
 * Then the limp (`limpOffsets`): for `LIMP_SECONDS` after the escape the prey favours a leg: an uneven dip and roll as
 * it goes, a lean off the leg while it stands. A pure function of the time since the event, so every viewer sees the
 * same hitch. Only the look of it: its schedule (where it is, how fast it gets there) is not changed, so the pace is
 * capped only on the act's own walk back.
 *
 * The scene never decides an escape (`voyage_events` kind `escaped`, with the encounter's geometry). Like the live
 * births (`live-births.ts`) and the meals' chases (`acts.ts`, whose paces `chasePace` this reuses), the scene gives it
 * its entries through a host and this layer only says, per frame, which act pose each takes: nothing here touches the
 * renderer.
 */

import {chasePace, type ActBody, type ActPose, type ChaseKind, type FleeStyle, type MealEncounter} from "@/ark-scene/acts";
import {APPROACH_SECONDS, approachPose} from "@/ark-scene/live-meals";
import {huntRun, type HuntAct} from "@/ark-scene/hunt-acts";

/** An escape from the record: who got away from whom, and when (s, the shared clock: the encounter's step). */
export type EscapeAct = {key: string; prey: string; predator: string; t0: number; encounter?: MealEncounter | null};

/** The chase's two bodies where it starts (pure in the record and the time), and the ground each may cross. */
export type EscapeChase = {
    kind: Exclude<ChaseKind, "cutaway">;
    flee: FleeStyle;
    predator: ActBody;
    prey: ActBody;
    /** The act's seed (the prey's id and the time), so every viewer sees the same darts. */
    seed: string;
    /** The two are where the server says: the hunter comes from its waypoint, however far (up to 40 m). */
    exact?: boolean;
    clear?: (x: number, z: number) => boolean;
    water?: (x: number, z: number) => boolean;
    ground: (x: number, z: number) => number;
    /** The hunter's own way of hunting (`hunt-acts.ts`), where its species has one that fits this pair; absent: the generic chase. */
    hunt?: HuntAct | null;
};

export type LiveEscapesHost<E> = {
    find: (id: string) => E | null;
    /** The chase from the record alone; null where a chase would look wrong (`chaseKind`'s cut-away): only the limp. */
    chase: (act: EscapeAct, predator: E, prey: E) => EscapeChase | null;
    /** Its schedule's place at a time (pure in the time); null off the schedule. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; y: number; yaw: number; aloft: boolean} | null;
    ground: (x: number, z: number) => number;
    walk: (entry: E) => number;
    flies: (entry: E) => boolean;
    setAct: (entry: E, pose: ActPose | null) => void;
    busy: (entry: E) => boolean;
};

/** How long after an escape the prey limps (s): well past the server's tick (10 minutes), so it is seen. */
export const LIMP_SECONDS = 30 * 60;
/** Its pace on its walk back to its day, of its walk. */
export const LIMP_PACE = 0.5;
const RETURN_MIN = 3;
const RETURN_MAX = 40;
const DT = 1 / 60;
/** The hunter is held this much beyond the least gap at every sample. */
const HOLD = 1.03;

type Sample = {x: number; z: number; y: number; yaw: number; v: number; state: string; pitch: number; roll?: number};

export type EscapeScript = {
    kind: EscapeChase["kind"];
    /** When the lunge meets empty air, and when the two are done (s after t0). */
    missAt: number;
    seconds: number;
    /** The nearest the two bodies' middles ever are (m), and the least they may be (`missGap`). */
    closest: number;
    gap: number;
    pred: Sample[];
    prey: Sample[];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const smooth = (t: number) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const heading = (dx: number, dz: number) => Math.atan2(dx, dz);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const steer = (from: number, to: number, max: number) => from + clamp(wrap(to - from), -max, max);
function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}
function rng(seed: string): () => number {
    let s = Math.floor(unit(seed) * 4294967295) >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_003) / 1_000_003;
    };
}

/**
 * The least distance between the two bodies' middles (m): nose to rump and a clear gap more (a quarter of the smaller
 * body, 8 cm at least). A miss is drawn as a miss: at this distance the hunter's mouth is short of its prey.
 */
export function missGap(predatorLength: number, preyLength: number): number {
    const lp = Math.max(predatorLength, 0.05);
    const lq = Math.max(preyLength, 0.05);
    return (lp + lq) * 0.5 + Math.max(Math.min(lp, lq) * 0.25, 0.08);
}

/** The nearest clear way to `want` a little ahead of a body (as the meals' chases go round things), or `want`. */
function roundIt(want: number, x: number, z: number, ahead: number, ok: (x: number, z: number) => boolean): number {
    const clear = (a: number) => ok(x + Math.sin(a) * ahead, z + Math.cos(a) * ahead) && ok(x + Math.sin(a) * ahead * 0.4, z + Math.cos(a) * ahead * 0.4);
    if (clear(want)) return want;
    for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1]) if (clear(want + off)) return want + off;
    return want;
}

/** The hunter kept off its prey: never nearer than `gap` over the ground, pushed back along the line between them. */
function holdOff(p: {x: number; z: number}, q: {x: number; z: number}, gap: number, fallback: number): void {
    // (A little more than the gap: the poses drawn between two samples keep it too.)
    const flat = gap * HOLD;
    const dx = p.x - q.x;
    const dz = p.z - q.z;
    const d = Math.hypot(dx, dz);
    if (d >= flat) return;
    const k = flat;
    if (d < 1e-6) {
        p.x = q.x - Math.sin(fallback) * k;
        p.z = q.z - Math.cos(fallback) * k;
    } else {
        p.x = q.x + (dx / d) * k;
        p.z = q.z + (dz / d) * k;
    }
}

/**
 * The same in the air (a stoop): out along the line between them, so it never jumps from one side of its prey to the
 * other; under its prey (one that took off over it) out level, never down into the ground.
 */
function pushOut(p: {x: number; y: number; z: number}, q: {x: number; y: number; z: number}, gap: number): void {
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const dz = p.z - q.z;
    const d = Math.hypot(dx, dy, dz);
    if (d >= gap) return;
    const dh = Math.hypot(dx, dz);
    if (dy >= 0 && d > 1e-6) {
        p.x = q.x + (dx / d) * gap;
        p.y = q.y + (dy / d) * gap;
        p.z = q.z + (dz / d) * gap;
    } else if (dy >= 0) p.y = q.y + gap;
    else {
        const flat = Math.sqrt(Math.max(gap * gap - dy * dy, 0));
        p.x = q.x + (dh > 1e-6 ? dx / dh : 1) * flat;
        p.z = q.z + (dh > 1e-6 ? dz / dh : 0) * flat;
    }
}

/**
 * A chase on land or in the water that ends in a miss, sampled once (pure in the two bodies and the seed). The
 * hunter's sprint and the prey's flight are their own (`chasePace`, from their speed stats); while the hunter closes
 * the prey runs at no more than four fifths of its sprint (it was surprised), and at the lunge it jinks aside at its
 * full pace while the hunter, committed, runs on into empty air and pulls up.
 */
function groundMiss(c: EscapeChase): EscapeScript {
    const random = rng(c.seed);
    const swim = c.kind === "dart";
    const snake = c.kind === "slither";
    const flee = c.flee;
    const lp = Math.max(c.predator.length, 0.05);
    const lq = Math.max(c.prey.length, 0.05);
    const gap = missGap(lp, lq);
    const vp = swim ? chasePace(c.predator, "burst") : chasePace(c.predator, "sprint");
    const vqFull = flee === "still" ? 0 : flee === "fly" ? Math.max(lq * 6, 3) : swim || flee === "swim" ? chasePace(c.prey, "burst") : chasePace(c.prey, "flee");
    const vqClose = Math.min(vqFull, vp * 0.8);
    const vs = swim ? Math.max(vp * 0.25, 0.15) : Math.min(chasePace(c.predator, "stalk"), vp * 0.3);
    const predWater = swim || c.predator.base < -0.02;
    const preyWater = swim || flee === "swim";
    const ok = (x: number, z: number, water: boolean) => (water ? (c.water ? c.water(x, z) : true) : c.clear ? c.clear(x, z) : true);
    const yOf = (body: ActBody, x: number, z: number, water: boolean) => (water ? Math.min(body.base, -0.05) : c.ground(x, z));
    let dx = c.prey.x - c.predator.x;
    let dz = c.prey.z - c.predator.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 0.01) {
        dx = Math.sin(c.predator.yaw);
        dz = Math.cos(c.predator.yaw);
        distance = 1;
    }
    const dir = {x: dx / distance, z: dz / distance};
    const launch = snake ? gap + lp * 0.45 : Math.min(Math.max(vp * 1.3, lp * 2.5, 3), 16) + lp * 0.5;
    const stalkFor = snake ? 3.2 : 2.6;
    const exact = Boolean(c.exact) && distance <= 40;
    const approach = exact ? Math.max(vs, (distance - launch) / 4.5) : vs;
    const reach = exact ? Infinity : launch + vs * stalkFor;
    // (A far hunter without the server's place comes into view nearer, as in a meal's chase; never inside the gap.)
    const start = Math.max(Math.min(distance, reach), gap * 1.05);
    const p = {x: c.prey.x - dir.x * start, z: c.prey.z - dir.z * start, yaw: distance > reach ? heading(dir.x, dir.z) : c.predator.yaw, v: 0};
    const q = {x: c.prey.x, z: c.prey.z, yaw: c.prey.yaw, v: 0, y: c.prey.base};
    const turnP = clamp(5 / Math.pow(lp, 0.4), 1.6, 9);
    const turnQ = clamp(8 / Math.pow(lq, 0.4), 2.5, 12);
    const tiny = lq < 0.35 || flee === "bound";
    const dartSize = lq >= 2.2 ? [0.18, 0.4] : tiny ? [0.6, 1.05] : [0.35, 0.8];
    const dartEvery = lq >= 2.2 ? [0.9, 0.5] : tiny ? [0.35, 0.3] : [0.55, 0.4];
    const darts: Array<{at: number; off: number}> = [];
    let side = random() < 0.5 ? -1 : 1;
    const react = 0.12 + random() * 0.22;
    const jink = 0.9 + 0.4 * random();
    const clearFor = 2.6 + 1.4 * random();
    const lungeFor = snake ? 0.24 : 0.32;
    let tLaunch = -1;
    let tFlee = -1;
    let tLunge = -1;
    let tMiss = -1;
    let lungeYaw = 0;
    let jinkYaw = 0;
    let closest = Infinity;
    const pred: Sample[] = [];
    const prq: Sample[] = [];
    let end = Infinity;
    for (let i = 0; i * DT <= end + 1e-9 && i < 30 / DT; i++) {
        const t = i * DT;
        let predState = "stalk";
        let preyState = "rest";
        let predPitch = 0.08;
        let preyPitch = 0;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        const toPrey = heading(q.x - p.x, q.z - p.z);
        if (tMiss < 0) {
            if (tLaunch < 0) {
                // Readying, then the stalk (a snake's creep): straight at it, slow and low, to where it breaks cover.
                p.yaw = steer(p.yaw, toPrey, turnP * DT);
                p.v = 0;
                if (t >= 0.35) {
                    const near = d <= launch;
                    if (near || t > 0.35 + (exact ? 4.5 : stalkFor) * 1.2) {
                        if (near && t < 0.85) predState = "freeze";
                        else tLaunch = t;
                    } else {
                        p.v = approach;
                        const nx = p.x + Math.sin(p.yaw) * approach * DT;
                        const nz = p.z + Math.cos(p.yaw) * approach * DT;
                        if (ok(nx, nz, predWater) || !ok(p.x, p.z, predWater)) {
                            p.x = nx;
                            p.z = nz;
                        } else tLaunch = t;
                    }
                    // The prey looks up just before it breaks.
                    if (d < launch + vs * 0.4) preyState = "scan";
                }
            }
            if (tLaunch >= 0 && tLunge < 0) {
                const since = t - tLaunch;
                if (flee === "still") {
                    // A prey that does not run (a shell, a snail): it comes up to it, and the prey pulls in.
                    predState = "walk";
                    p.v = Math.min(vp, Math.max(vs * 2, 0.4));
                    p.yaw = steer(p.yaw, toPrey, turnP * DT);
                    p.x += Math.sin(p.yaw) * p.v * DT;
                    p.z += Math.cos(p.yaw) * p.v * DT;
                    if (d <= gap * 1.08 || since > 8) tLunge = t;
                } else if (snake) {
                    tLunge = t;
                } else {
                    predState = "run";
                    predPitch = 0;
                    // Up to its sprint in half a second; it aims where the prey is going, cutting the corners of its darts.
                    p.v = vp * Math.min(0.3 + since / 0.5, 1);
                    const lead = Math.min(d / Math.max(vp, 0.1), 0.45);
                    const aim = roundIt(heading(q.x + Math.sin(q.yaw) * q.v * lead - p.x, q.z + Math.cos(q.yaw) * q.v * lead - p.z), p.x, p.z, Math.max(lp * 0.8, 0.6), (x, z) => ok(x, z, predWater));
                    p.yaw = steer(p.yaw, aim, turnP * DT);
                    p.x += Math.sin(p.yaw) * p.v * DT;
                    p.z += Math.cos(p.yaw) * p.v * DT;
                    // Near enough (or it tires of it): the lunge.
                    if (d <= gap + lp * 0.7 + lq * 0.2 || since > 6.5) tLunge = t;
                }
                if (tFlee < 0 && flee !== "still" && (snake || t >= tLaunch + react)) {
                    tFlee = t;
                    for (let at = t + 0.2 + random() * 0.25; at < t + 9; at += dartEvery[0] + random() * dartEvery[1]) {
                        darts.push({at, off: side * (dartSize[0] + (dartSize[1] - dartSize[0]) * random())});
                        side = -side;
                    }
                }
                if (tLunge >= 0) {
                    // Committed: on along where the prey was going. The prey breaks to one side.
                    lungeYaw = flee === "still" ? p.yaw : heading(q.x + Math.sin(q.yaw) * q.v * lungeFor - p.x, q.z + Math.cos(q.yaw) * q.v * lungeFor - p.z);
                    jinkYaw = q.yaw + side * jink;
                }
            }
            if (tLunge >= 0 && t > tLunge) {
                // The lunge, the pounce, the strike: into where the prey would have been.
                const u = Math.min((t - tLunge) / lungeFor, 1);
                if (flee === "still") {
                    predState = "scan";
                    p.v = 0;
                } else {
                    predState = snake || predWater ? "strike" : "leap";
                    predPitch = snake ? 0.05 : 0.18 * Math.sin(Math.PI * u);
                    p.v = (snake ? lp * 2.2 : vp * 1.1) * (1 - 0.3 * u);
                    p.yaw = steer(p.yaw, lungeYaw, turnP * 2 * DT);
                    p.x += Math.sin(lungeYaw) * p.v * DT;
                    p.z += Math.cos(lungeYaw) * p.v * DT;
                }
                if (u >= 1) {
                    tMiss = t;
                    end = t + (flee === "still" ? 2.6 : clearFor + 2.4);
                }
            }
        } else {
            // Missed: it runs on a few strides, pulls up and watches it go (a snake draws back where it lies).
            const after = t - tMiss;
            if (flee === "still") {
                // It noses at the shut shell, then lifts its head: nothing to be had.
                predState = after < 1.8 ? "stalk" : "scan";
                predPitch = after < 1.8 ? 0.12 + 0.03 * Math.sin(after * 6) : 0;
                p.v = 0;
            } else {
                const k = clamp(after / (snake ? 0.4 : 1.2), 0, 1);
                p.v = (snake ? lp * 1.2 : vp * 0.75) * (1 - k) * (1 - k);
                p.x += Math.sin(lungeYaw) * p.v * DT;
                p.z += Math.cos(lungeYaw) * p.v * DT;
                if (k >= 1) p.yaw = steer(p.yaw, toPrey, turnP * 0.5 * DT);
                predState = k < 0.6 && !snake ? "run" : "scan";
                predPitch = 0;
            }
        }
        // The prey: grazing, then bolting and darting; at the lunge a break to one side at its full pace; then on until
        // it is clear, slowing, and a look back.
        if (tFlee >= 0) {
            const since = t - tFlee;
            const cleared = tMiss >= 0 ? t - tMiss - clearFor : -1;
            if (cleared < 0) {
                const away = heading(q.x - p.x, q.z - p.z);
                const dart = darts.filter((x) => x.at <= t).pop();
                const jinking = tLunge >= 0 && t - tLunge < 0.6;
                const pace = tLunge >= 0 ? Math.max(vqFull, vqClose) : vqClose;
                q.v = pace * Math.min(since / 0.35, 1);
                const want = roundIt(jinking ? jinkYaw : away + (dart ? dart.off * (tMiss >= 0 ? 0.4 : 1) : 0), q.x, q.z, Math.max(lq, 0.6), (x, z) => ok(x, z, preyWater));
                q.yaw = steer(q.yaw, want, turnQ * (jinking ? 2 : 1) * DT);
                preyState = flee === "swim" ? "swim" : flee === "fly" ? "fly" : "run";
            } else {
                const k = clamp(cleared / 1.2, 0, 1);
                q.v = vqFull * 0.6 * (1 - k) * (1 - k);
                if (k >= 1 && flee !== "fly") q.yaw = steer(q.yaw, heading(p.x - q.x, p.z - q.z) + side * 0.5, turnQ * 0.4 * DT);
                preyState = flee === "fly" ? "fly" : k < 0.7 ? (flee === "swim" ? "swim" : "run") : flee === "swim" ? "swim" : "scan";
            }
            const nx = q.x + Math.sin(q.yaw) * q.v * DT;
            const nz = q.z + Math.cos(q.yaw) * q.v * DT;
            if (flee === "fly" || ok(nx, nz, preyWater) || !ok(q.x, q.z, preyWater)) {
                q.x = nx;
                q.z = nz;
            }
            if (flee === "fly") q.y = Math.max(c.prey.base, c.ground(q.x, q.z), 0) + Math.min(since * 2.2, 3.5);
        } else if (tLaunch >= 0 || tLunge >= 0) {
            preyState = flee === "still" ? "freeze" : "scan";
            if (flee === "still") preyPitch = 0.12;
        }
        const preyY = flee === "fly" && tFlee >= 0 ? q.y : yOf(c.prey, q.x, q.z, preyWater);
        // Never a catch: whatever the paces, the darts and the ground did, the hunter is held off its prey.
        holdOff(p, q, gap, toPrey);
        closest = Math.min(closest, Math.hypot(q.x - p.x, q.z - p.z));
        if (predWater && predState !== "strike") predState = "swim";
        pred.push({x: p.x, z: p.z, y: yOf(c.predator, p.x, p.z, predWater), yaw: p.yaw, v: p.v, state: predState, pitch: predWater ? 0 : predPitch});
        prq.push({x: q.x, z: q.z, y: preyY, yaw: q.yaw, v: q.v, state: preyState, pitch: preyPitch});
        // (Its way blocked all along: it gives the chase up where it is, and that is the miss.)
        if (tMiss < 0 && tLunge < 0 && t > 14) {
            tLunge = t;
            lungeYaw = p.yaw;
            jinkYaw = q.yaw;
        }
    }
    // A hopper's bounds: arcs over the ground as it goes.
    const hop = (list: Sample[], length: number) => {
        let travelled = 0;
        for (let i = 1; i < list.length; i++) {
            travelled += Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z);
            if (list[i].state !== "run" && list[i].state !== "leap") continue;
            const stride = Math.max(length * 1.3, 0.35);
            list[i].y += Math.abs(Math.sin((travelled / stride) * Math.PI)) * Math.max(length * 0.4, 0.2);
            list[i].pitch += -0.25 * Math.cos((travelled / stride) * Math.PI * 2);
        }
    };
    if (c.kind === "bound") hop(pred, lp);
    if (flee === "bound") hop(prq, lq);
    return {kind: c.kind, missAt: tMiss < 0 ? pred.length * DT : tMiss, seconds: pred.length * DT, closest, gap, pred, prey: prq};
}

/**
 * A raptor's stoop that misses: it comes over, high, and stoops onto where its prey is; the prey bolts (or takes off)
 * aside as the shadow comes, a moment sooner than one that is caught; feet thrown at empty ground, it pulls out and
 * climbs away.
 */
function swoopMiss(c: EscapeChase): EscapeScript {
    const random = rng(c.seed);
    const flee = c.flee;
    const lp = Math.max(c.predator.length, 0.05);
    const lq = Math.max(c.prey.length, 0.05);
    const gap = missGap(lp, lq);
    let dx = c.prey.x - c.predator.x;
    let dz = c.prey.z - c.predator.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 0.01) {
        dx = Math.sin(c.predator.yaw);
        dz = Math.cos(c.predator.yaw);
        distance = 1;
    }
    const dir = {x: dx / distance, z: dz / distance};
    const face = heading(dir.x, dir.z);
    const reach = Math.min(distance, 22);
    const preyY0 = flee === "swim" ? Math.min(c.prey.base, -0.05) : c.prey.base;
    const aloft = c.predator.base > c.ground(c.predator.x, c.predator.z) + 2;
    const from = aloft && distance <= 22 ? {x: c.predator.x, z: c.predator.z} : {x: c.prey.x - dir.x * reach, z: c.prey.z - dir.z * reach};
    const altitude = Math.max(aloft ? c.predator.base : Math.max(c.predator.base, 0) + Math.max(Math.min(8, Math.max(lp * 30, 1.5)), lp * 9), Math.max(preyY0, 0) + Math.min(6, Math.max(lp * 25, 1.2)));
    const cruise = clamp(lp * 7, 5, 14);
    const stoop = chasePace(c.predator, "dive");
    const rise = aloft ? 0 : 0.8;
    const stoopFrom = {x: c.prey.x - dir.x * Math.min(10, reach * 0.6), z: c.prey.z - dir.z * Math.min(10, reach * 0.6)};
    const tStoop = rise + Math.max(Math.hypot(stoopFrom.x - from.x, stoopFrom.z - from.z) / cruise, 0.6);
    const stoopFor = clamp(Math.hypot(Math.hypot(c.prey.x - stoopFrom.x, c.prey.z - stoopFrom.z), altitude - Math.max(preyY0, 0)) / stoop, 0.7, 2.2);
    const tMiss = tStoop + stoopFor;
    const tFlee = tMiss - 0.5 - random() * 0.25;
    const vq = flee === "still" ? 0 : flee === "fly" ? Math.max(lq * 6, 3) : flee === "swim" ? chasePace(c.prey, "burst") : chasePace(c.prey, "flee");
    const away = face + (random() < 0.5 ? -1 : 1) * (0.7 + 0.5 * random());
    const clearFor = 2.4 + 1.2 * random();
    const end = tMiss + clearFor + 1.6;
    const ok = (x: number, z: number) => (flee === "swim" ? (c.water ? c.water(x, z) : true) : c.clear ? c.clear(x, z) : true);
    const prq: Sample[] = [];
    const pred: Sample[] = [];
    const q = {x: c.prey.x, z: c.prey.z, yaw: c.prey.yaw, v: 0, y: preyY0};
    for (let i = 0; i * DT <= end + 1e-9; i++) {
        const t = i * DT;
        let state = t >= tMiss - 1.6 ? "scan" : "rest";
        if (t >= tFlee && flee !== "still") {
            const since = t - tFlee;
            const cleared = t - tMiss - clearFor;
            const k = clamp(cleared / 1.2, 0, 1);
            q.v = vq * Math.min(since / 0.25, 1) * (cleared > 0 ? 0.6 * (1 - k) * (1 - k) : 1);
            q.yaw = steer(q.yaw, roundIt(away, q.x, q.z, Math.max(lq, 0.6), ok), 9 * DT);
            const nx = q.x + Math.sin(q.yaw) * q.v * DT;
            const nz = q.z + Math.cos(q.yaw) * q.v * DT;
            if (flee === "fly" || ok(nx, nz) || !ok(q.x, q.z)) {
                q.x = nx;
                q.z = nz;
            }
            if (flee === "fly") q.y = Math.max(preyY0, c.ground(q.x, q.z), 0) + Math.min(since * 2.2, 3.5);
            state = flee === "fly" ? "fly" : flee === "swim" ? "swim" : k > 0.7 ? "scan" : "run";
        } else if (flee === "still" && t >= tFlee) state = "freeze";
        prq.push({x: q.x, z: q.z, y: flee === "fly" ? q.y : flee === "swim" ? preyY0 : c.ground(q.x, q.z), yaw: q.yaw, v: q.v, state, pitch: 0});
    }
    // Where its feet come down: where the prey was a moment before (it cannot follow the last of its dodge; a still
    // one: over it, the gap above its back). (A fish's: the water's surface: it plunges, and comes up with nothing.)
    const strike = prq[clamp(Math.round((tMiss - 0.3) / DT), 0, prq.length - 1)];
    const strikeY = Math.max(strike.y, flee === "swim" ? 0 : -Infinity) + Math.max(c.prey.height * 0.6, lp * 0.15);
    let closest = Infinity;
    for (let i = 0; i < prq.length; i++) {
        const t = i * DT;
        const at = prq[i];
        let x: number;
        let z: number;
        let y: number;
        let pitch = 0;
        let ps = "fly";
        let yaw = face;
        if (t < rise) {
            const k = smooth(t / rise);
            x = from.x;
            z = from.z;
            y = lerp(Math.max(c.predator.base, 0), altitude, k);
            yaw = c.predator.yaw + wrap(face - c.predator.yaw) * k;
            pitch = -0.35 * Math.sin(Math.PI * k);
            ps = "takeoff";
        } else if (t < tStoop) {
            const k = (t - rise) / Math.max(tStoop - rise, 1e-3);
            x = lerp(from.x, stoopFrom.x, k);
            z = lerp(from.z, stoopFrom.z, k);
            y = altitude + Math.sin(Math.PI * k) * 0.6;
            ps = k > 0.75 ? "glide" : "fly";
        } else if (t < tMiss) {
            // The stoop: a curve down onto where the prey was, gathering speed; feet thrown forward at the last moment.
            const k = (t - tStoop) / stoopFor;
            const e = k * k;
            const u = 1 - e;
            const cx = (stoopFrom.x + strike.x) / 2;
            const cz = (stoopFrom.z + strike.z) / 2;
            x = u * u * stoopFrom.x + 2 * u * e * cx + e * e * strike.x;
            z = u * u * stoopFrom.z + 2 * u * e * cz + e * e * strike.z;
            yaw = heading(strike.x - stoopFrom.x + 1e-9, strike.z - stoopFrom.z);
            y = u * u * altitude + 2 * u * e * (altitude * 0.9) + e * e * strikeY;
            pitch = k < 0.85 ? 0.9 * Math.sin(Math.PI * Math.min(k * 1.2, 1) * 0.5) : -0.6;
            ps = k < 0.85 ? "plunge" : "strike_feet";
        } else {
            // Nothing in its feet: it pulls out along its way and climbs.
            const k = smooth((t - tMiss) / (end - tMiss));
            x = strike.x + dir.x * 12 * k;
            z = strike.z + dir.z * 12 * k;
            y = strikeY + (altitude * 0.7 - strikeY) * k;
            pitch = -0.4 * Math.sin(Math.PI * Math.min(k * 1.6, 1));
        }
        // Never a catch: held off its prey in the air too (lifted over one that did not move).
        const held = {x, y, z};
        pushOut(held, at, gap * HOLD);
        x = held.x;
        y = held.y;
        z = held.z;
        closest = Math.min(closest, Math.hypot(x - at.x, z - at.z, y - at.y));
        pred.push({x, z, y, yaw, v: 0, state: ps, pitch});
    }
    for (let i = 1; i < pred.length; i++) pred[i].v = Math.hypot(pred[i].x - pred[i - 1].x, pred[i].z - pred[i - 1].z, pred[i].y - pred[i - 1].y) / DT;
    return {kind: c.kind, missAt: tMiss, seconds: pred.length * DT, closest, gap, pred, prey: prq};
}

/** The escape's script, built once (pure in the chase): both animals at every sixtieth of a second. */
export function escapeScript(chase: EscapeChase): EscapeScript {
    // The hunter's own way where its species has one (`hunt-acts.ts`): the same act as its catches, ending in the miss.
    if (chase.hunt) {
        const gap = missGap(chase.predator.length, chase.prey.length);
        const air = chase.kind === "swoop";
        const run = huntRun({act: chase.hunt, predator: chase.predator, prey: chase.prey, seed: chase.seed, flee: chase.flee, miss: true, gap, exact: Boolean(chase.exact), meal: false, clear: chase.clear, water: chase.water, ground: chase.ground, paces: {sprint: chasePace(chase.predator, "sprint"), flee: chasePace(chase.prey, "flee"), stalk: chasePace(chase.predator, "stalk"), dive: chasePace(chase.predator, "dive")}});
        if (run) {
            let closest = Infinity;
            for (let k = 0; k < run.pred.length; k++) closest = Math.min(closest, Math.hypot(run.pred[k].x - run.prey[k].x, run.pred[k].z - run.prey[k].z, air ? run.pred[k].y - run.prey[k].y : 0));
            return {kind: chase.kind, missAt: run.tc, seconds: run.seconds, closest, gap, pred: run.pred, prey: run.prey};
        }
    }
    return chase.kind === "swoop" ? swoopMiss(chase) : groundMiss(chase);
}

/** One of the two at a time, between its samples. */
function sampleAt(list: Sample[], s: number): Sample {
    const f = clamp(s / DT, 0, list.length - 1);
    const i = Math.min(Math.floor(f), Math.max(list.length - 2, 0));
    const a = list[i];
    const b = list[Math.min(i + 1, list.length - 1)];
    const k = f - i;
    return {x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), y: lerp(a.y, b.y, k), yaw: a.yaw + wrap(b.yaw - a.yaw) * k, pitch: lerp(a.pitch, b.pitch, k), roll: lerp(a.roll ?? 0, b.roll ?? 0, k), state: a.state, v: lerp(a.v, b.v, k)};
}

/**
 * One of the two `s` seconds after the escape's time (to `script.seconds`; then its walk back to its day). The hunter
 * is held off its prey here too, at the very pose that is drawn: never nearer than the script's gap, at any time.
 */
export function escapePose(script: EscapeScript, who: "predator" | "prey", s: number): ActPose {
    const at = sampleAt(who === "predator" ? script.pred : script.prey, s);
    if (who === "predator") pushOut(at, sampleAt(script.prey, s), script.gap);
    return {x: at.x, z: at.z, base: at.y, yaw: at.yaw, pitch: at.pitch, roll: at.roll ?? 0, scale: 1, dim: 0, hidden: false, state: at.state, speed: at.v};
}

// MARK: The limp

/** How much it limps `since` seconds after the escape: fully for two thirds of `LIMP_SECONDS`, then easing off. */
export function limpAmount(since: number): number {
    if (!(since >= 0) || since >= LIMP_SECONDS) return 0;
    return 1 - smooth((since - LIMP_SECONDS * (2 / 3)) / (LIMP_SECONDS / 3));
}

export type LimpOffsets = {drop: number; roll: number; pitch: number};

/**
 * The limp's hitch on the drawn body, `since` seconds after the escape (pure: the same for every viewer). Moving: once a
 * stride the hurt leg takes the weight for a short moment only, so the body dips onto it and rolls to that side, a
 * quick uneven beat (a third of the stride), with a small nod; standing: a lean off the leg. `drop` in metres (down),
 * `roll` and `pitch` in radians. False (and zeros) when there is nothing to add.
 */
export function limpOffsets(key: string, since: number, moving: boolean, length: number, out: LimpOffsets): boolean {
    const amount = limpAmount(since);
    out.drop = out.roll = out.pitch = 0;
    if (amount <= 0) return false;
    const side = unit(`${key}:leg`) < 0.5 ? -1 : 1;
    if (!moving) {
        out.roll = -side * 0.035 * amount;
        return true;
    }
    const L = clamp(length, 0.05, 6);
    const stride = clamp(0.4 + 0.3 * Math.sqrt(L), 0.4, 1.3);
    const phase = (since / stride) % 1;
    const dip = phase < 0.34 ? Math.sin((Math.PI * phase) / 0.34) : 0;
    const hitch = dip * dip * amount;
    out.drop = hitch * Math.min(0.07 * L, 0.16);
    out.roll = side * hitch * 0.12;
    out.pitch = hitch * 0.06;
    return true;
}

// MARK: On the stage

type Live<E> = {act: EscapeAct; script: EscapeScript | null; built: boolean; over: boolean; acting: Set<E>; /** Where each one's day had it when its walk to the chase's start began. */ lead?: {predator: {x: number; z: number; y: number; yaw: number} | null; prey: {x: number; z: number; y: number; yaw: number} | null}};

export class LiveEscapes<E> {
    private escapes: Live<E>[] = [];
    /** Each prey's latest escape (its limp's clock). */
    private limping = new Map<string, {t0: number; key: string}>();
    /** V1 hook: who the server says is wounded (id to since when, epoch s). Empty until E5 sends it. */
    private wounded = new Map<string, number>();

    constructor(private readonly host: LiveEscapesHost<E>) {}

    /** New escapes from the record; those whose limp is long over are forgotten. */
    add(acts: EscapeAct[], epoch: number): void {
        const known = new Set(this.escapes.map((e) => e.act.key));
        for (const act of acts) {
            if (!Number.isFinite(act.t0) || known.has(act.key) || !act.prey || !act.predator || act.prey === act.predator) continue;
            if (epoch - act.t0 > LIMP_SECONDS) continue;
            this.escapes.push({act, script: null, built: false, over: false, acting: new Set()});
            known.add(act.key);
            const had = this.limping.get(act.prey);
            if (!had || had.t0 < act.t0) this.limping.set(act.prey, {t0: act.t0, key: act.key});
        }
        this.escapes.sort((x, y) => x.act.t0 - y.act.t0);
    }

    clear(): void {
        for (const e of this.escapes) this.release(e);
        this.escapes = [];
        this.limping.clear();
    }

    get size(): number {
        return this.escapes.length + this.wounded.size;
    }

    /** Everyone a chase under way names now (drawn one by one, never as a herd's figure). */
    pins(): string[] {
        const out: string[] = [];
        for (const e of this.escapes) if (e.acting.size) out.push(e.act.prey, e.act.predator);
        return out;
    }

    /** The limp of the one that got away, now (`limpOffsets`, into `out`); false when it has none. */
    limp(id: string, epoch: number, moving: boolean, length: number, out: LimpOffsets): boolean {
        // (A wound's limp does not ease off with time: its stride's clock runs, its amount stays whole.)
        const hurt = this.wounded.get(id);
        if (hurt !== undefined && epoch >= hurt) return limpOffsets(`wound:${id}`, (epoch - hurt) % (LIMP_SECONDS / 2), moving, length, out);
        const at = this.limping.get(id);
        if (!at) return false;
        return limpOffsets(at.key, epoch - at.t0, moving, length, out);
    }

    private release(e: Live<E>): void {
        e.acting.forEach((entry) => this.host.setAct(entry, null));
        e.acting.clear();
    }

    /** Back to its day: from where the chase left it to where its schedule has it now; null once there. */
    private back(entry: E, from: ActPose, since: number, epoch: number, pace: number, flies: boolean, extra: Partial<ActPose>): ActPose | null {
        const h = this.host;
        const at0 = h.scheduleAt(entry, since);
        const now = h.scheduleAt(entry, epoch);
        if (!at0 || !now) return null;
        const seconds = clamp(Math.hypot(at0.x - from.x, at0.z - from.z) / Math.max(pace * (flies ? 6 : 1), 0.15), RETURN_MIN, RETURN_MAX);
        const k = (epoch - since) / seconds;
        if (k >= 1) return null;
        const e = smooth(k);
        const x = lerp(from.x, now.x, e);
        const z = lerp(from.z, now.z, e);
        const d = Math.hypot(now.x - from.x, now.z - from.z);
        const air = flies && (d > 2 || from.base > h.ground(from.x, from.z) + 0.5 || now.aloft);
        const y = air ? lerp(from.base, now.y, e) + Math.sin(Math.PI * k) * Math.min(Math.max(d * 0.2, 1), 8) : from.base < -0.02 ? lerp(from.base, now.y, e) : h.ground(x, z);
        return {x, z, base: y, yaw: d > 0.05 ? heading(now.x - from.x, now.z - from.z) : now.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: air ? "fly" : from.base < -0.02 ? "swim" : "walk", speed: d / seconds, ...extra};
    }

    /** One frame at `epoch` (s, the shared clock): every escape under way poses its two. */
    step(epoch: number): void {
        const h = this.host;
        for (const e of this.escapes) {
            const s = epoch - e.act.t0;
            if (e.over) continue;
            if (s < 0) {
                // V1 (held until the record is out, `ark-act-hold.ts`): the last seconds before the chase, each on its
                // way from where its day has it to where the record's encounter starts them (`approachPose`).
                if (s >= -APPROACH_SECONDS) this.approach(e, s);
                continue;
            }
            const prey = h.find(e.act.prey);
            const predator = h.find(e.act.predator);
            if (!e.built) {
                if (!prey || !predator) {
                    // (One of them is not in the scene yet: asked again for a minute, then only the limp is left.)
                    if (s > 60) e.over = true;
                    continue;
                }
                e.built = true;
                const chase = h.chase(e.act, predator, prey);
                e.script = chase ? escapeScript(chase) : null;
            }
            const sc = e.script;
            if (!sc || !prey) {
                this.release(e);
                e.over = true;
                continue;
            }
            const acting = new Set<E>();
            const pose = (entry: E | null, act: ActPose | null) => {
                if (!entry || !act || h.busy(entry)) return;
                h.setAct(entry, act);
                acting.add(entry);
            };
            if (s < sc.seconds) {
                pose(predator, {...escapePose(sc, "predator", s), with: e.act.prey, role: "hunter", meal: "hunting"});
                pose(prey, {...escapePose(sc, "prey", s), with: e.act.predator, role: "quarry"});
            } else {
                const since = e.act.t0 + sc.seconds;
                const last = sc.seconds - 1e-3;
                pose(predator, predator ? this.back(predator, escapePose(sc, "predator", last), since, epoch, h.walk(predator), h.flies(predator), {}) : null);
                // (The one that got away: at a limping pace.)
                pose(prey, this.back(prey, escapePose(sc, "prey", last), since, epoch, h.walk(prey) * (h.flies(prey) ? 1 : LIMP_PACE), h.flies(prey), {}));
                if (!acting.size) e.over = true;
            }
            e.acting.forEach((entry) => {
                if (!acting.has(entry)) h.setAct(entry, null);
            });
            e.acting = acting;
        }
        if (this.escapes.some((e) => epoch - e.act.t0 > LIMP_SECONDS && !e.acting.size)) {
            this.escapes = this.escapes.filter((e) => epoch - e.act.t0 <= LIMP_SECONDS || e.acting.size > 0);
            this.limping.forEach((at, id) => {
                if (epoch - at.t0 > LIMP_SECONDS) this.limping.delete(id);
            });
        }
    }

    private approach(e: Live<E>, s: number): void {
        const h = this.host;
        const prey = h.find(e.act.prey);
        const predator = h.find(e.act.predator);
        if (!prey || !predator) return;
        if (!e.built) {
            e.built = true;
            const chase = h.chase(e.act, predator, prey);
            e.script = chase ? escapeScript(chase) : null;
        }
        const sc = e.script;
        if (!sc) return;
        e.lead ??= {predator: h.scheduleAt(predator, e.act.t0 - APPROACH_SECONDS), prey: h.scheduleAt(prey, e.act.t0 - APPROACH_SECONDS)};
        const k = (s + APPROACH_SECONDS) / APPROACH_SECONDS;
        const acting = new Set<E>();
        const pose = (entry: E, from: {x: number; z: number; y: number; yaw: number} | null, who: "predator" | "prey", other: string) => {
            if (!from || h.busy(entry)) return;
            const walked = approachPose(from, escapePose(sc, who, 0), k, h.walk(entry), h.ground);
            if (!walked) return;
            h.setAct(entry, {...walked, with: other});
            acting.add(entry);
        };
        pose(predator, e.lead.predator, "predator", e.act.prey);
        pose(prey, e.lead.prey, "prey", e.act.predator);
        e.acting.forEach((entry) => {
            if (!acting.has(entry)) h.setAct(entry, null);
        });
        e.acting = acting;
    }

    /** V1 hook (E5's hunt styles, NOT sent yet): an animal the server says is wounded limps as one that got away does, until it is taken off the list. */
    setWounded(list: ReadonlyArray<{id: string; since: number}>): void {
        this.wounded.clear();
        for (const one of list) if (one.id && Number.isFinite(one.since)) this.wounded.set(one.id, one.since);
    }

    debug(): Array<{key: string; t0: number; prey: string; predator: string; phase: string; kind: string | null; missAt: number | null; seconds: number | null; closest: number | null; gap: number | null}> {
        return this.escapes.map((e) => ({key: e.act.key, t0: e.act.t0, prey: e.act.prey, predator: e.act.predator, phase: e.over ? (e.script ? "limping" : "limp only") : e.built ? "acting" : "waiting", kind: e.script?.kind ?? null, missAt: e.script ? Math.round(e.script.missAt * 100) / 100 : null, seconds: e.script ? Math.round(e.script.seconds * 100) / 100 : null, closest: e.script ? Math.round(e.script.closest * 1000) / 1000 : null, gap: e.script ? Math.round(e.script.gap * 1000) / 1000 : null}));
    }
}
