/**
 * Species-specific hunt acts (signature behaviours, theme `hunt_tactic`; AnimalDex docs/ark/behaviours-plan.md and
 * docs/ark/hunt-styles-e5.md). A hunter's way of hunting, drawn when the server's record says a hunt happened: a
 * released `meal` (the chase that ends in a catch) or `escaped` (the same, ending in a miss), and a hunter's released
 * search. The scene never decides an outcome and never shows one before its record: the acts here are built from the
 * record's two animals and its encounter, and begin at the record's own clock (`ark-act-hold.ts`), as the generic chase
 * does. The catch or the miss is the record's; an act only chooses how the animal gets there.
 *
 * One act a species (`hunt-acts.json`, from `scripts/ark-hunt-acts.mts`: the species' own text, or the ambient hunting
 * recipe it already has, so the two never disagree and a species never has two). A species with none, or a pair the
 * act does not fit (a pounce needs prey on the ground, a plunge prey in the water), keeps the generic chase (`acts.ts`).
 *
 *   pounce   stalks low in stops and starts, crouches with a wiggle, then one leap (a high arc: `leap`); jumping spiders jump
 *   dash     sits still while the prey walks in, then one short dash (geckos, lizards, wolf spiders)
 *   lunge    sits still; the prey comes within reach; a strike reaches out (mantises, bugs, frogs, a Komodo Dragon)
 *   tongue   sits still; the tongue takes the prey in (toads)
 *   web      the prey is held in the web and struggles; the spider comes over, bites and wraps it
 *   wade     slow placed steps in the shallows, motionless, then the spear
 *   lurk     a crocodilian drifts in with its eyes above the water, then an explosive strike from it
 *   drop     from a perch, a shallow silent glide onto the prey (owls, kookaburras, shrikes)
 *   hover    hangs over the prey in the wind, then drops (kestrels, buzzards, barn owls)
 *   plunge   hangs, then drops feet first into the water (an osprey, a kingfisher, a pelican); `talon` skims it at
 *            the surface (a kite, a fish eagle) and is the generic stoop on land prey
 *   hawk     after flying prey in the air: darts out and turns after it (dragonflies, swallows, hornets)
 *   peck     a small bird on the ground: runs, stops with its head tilted, stabs (a blackbird, a gull behind a plough)
 *   dive     from the water's surface, down after a fish (cormorants): the generic water chase, as a swimmer
 *   stoop    the generic stoop (a falcon's)
 *
 * Everything is a pure function of the two bodies, the seed (the prey's id and the time) and the record, sampled once
 * at 60 Hz: the same for every viewer. No `Math.random`.
 */
import table from "@/ark-scene/hunt-acts.json";
import type {ActBody, ChaseKind, FleeStyle, Puff} from "@/ark-scene/acts";

export const HUNT_ACTS = ["pounce", "leap", "jump", "dash", "lunge", "tongue", "web", "wade", "lurk", "drop", "hover", "plunge", "talon", "hawk", "peck", "dive", "stoop"] as const;
export type HuntAct = (typeof HUNT_ACTS)[number];

const ACT = (table as {species: Record<string, string>}).species;

/** The species' hunt act (`hunt-acts.json`), or null: the generic chase. */
export function huntActOf(slug: string): HuntAct | null {
    const act = ACT[slug];
    return act && (HUNT_ACTS as readonly string[]).includes(act) ? (act as HuntAct) : null;
}

/** What the act is chosen from: both animals as the scene has them at the record's encounter. */
export type HuntCtx = {
    slug: string;
    /** The predator's rig plan (`mammal`, `bird`, `reptile`, `snake`, `frog`, `arthropod`…). */
    plan: string | null;
    predatorLength: number;
    preyLength: number;
    /** In the water at the encounter. */
    predatorWater: boolean;
    preyWater: boolean;
    /** Its day has it on the wing (`profile.move === "fly"`, or a flier by name). */
    predatorAerial: boolean;
    preyAerial: boolean;
    flee: FleeStyle;
};

export type HuntChoice = {act: HuntAct; kind: ChaseKind};

/** A small bird picking small prey off the ground is a peck, whatever its species says (a rule of the pair, not a fact of the species). */
const PECKER_MAX = 0.6;
const PECK_PREY = 0.4;

/**
 * The act this pair plays, and the chase kind it is drawn as (the meal's script reads the kind: a perched raptor's
 * "swoop" carries a small catch off, a swimmer eats where it is), or null for the generic chase.
 */
export function huntChoice(c: HuntCtx): HuntChoice | null {
    let act = huntActOf(c.slug);
    const bird = c.plan === "bird";
    const lp = Math.max(c.predatorLength, 0.01);
    const lq = Math.max(c.preyLength, 0.005);
    const small = lq <= lp * PECK_PREY;
    // A hawker's prey on the ground, or none in the air: it picks it up instead.
    if (act === "hawk" && !c.preyAerial) act = bird && small && !c.preyWater ? "peck" : null;
    if (!act && bird && !c.predatorWater && !c.preyWater && !c.preyAerial && !c.predatorAerial && lp <= PECKER_MAX && small) act = "peck";
    if (!act) return null;
    const land = !c.predatorWater && !c.preyWater;
    switch (act) {
        case "pounce":
        case "leap":
        case "jump":
        case "dash":
        case "lunge":
        case "tongue":
            return land && !bird ? {act, kind: "glide"} : null;
        case "web":
            return land && lq <= lp * 4 ? {act, kind: "glide"} : null;
        case "wade":
            // (In the shallows or on the bank: a wading bird stands where it is, never swims.)
            return bird && (c.preyWater || lq <= lp * 0.5) ? {act, kind: "glide"} : null;
        case "lurk":
            return c.predatorWater ? {act, kind: "dart"} : null;
        case "drop":
        case "hover":
            return !c.preyWater && c.plan === "bird" ? {act, kind: "swoop"} : null;
        case "plunge":
            // (A small one on prey on the land drops from its perch onto it; a big one stoops: the generic chase.)
            return bird && c.preyWater ? {act, kind: "swoop"} : bird && !c.preyAerial && lp <= 0.45 ? {act: "drop", kind: "swoop"} : null;
        case "talon":
            return c.preyWater && bird ? {act: "talon", kind: "swoop"} : bird ? {act: "stoop", kind: "swoop"} : null;
        case "hawk":
            return c.preyAerial && !c.preyWater ? {act, kind: "swoop"} : null;
        case "peck":
            return bird && !c.predatorWater && !c.preyWater && !c.preyAerial ? {act, kind: "glide"} : null;
        case "dive":
            return c.predatorWater && c.preyWater ? {act, kind: "dart"} : null;
        case "stoop":
            return bird ? {act, kind: "swoop"} : null;
    }
}

// MARK: The sampled run

export type HuntSample = {x: number; z: number; y: number; yaw: number; v: number; state: string; pitch: number; roll?: number; hidden?: boolean; dim?: number; scale?: number};

export type HuntRun = {kind: ChaseKind; pred: HuntSample[]; prey: HuntSample[]; /** The catch (or the miss), s into the run. */ tc: number; seconds: number; puffs: Puff[]; /** When the hunter commits (the frame's focus). */ launch: number};

export type HuntInput = {
    act: HuntAct;
    predator: ActBody;
    prey: ActBody;
    seed: string;
    flee: FleeStyle;
    /** A miss: the hunter is never nearer its prey (middle to middle) than `gap`. */
    miss: boolean;
    gap: number;
    /** The server's places: the hunter starts from its waypoint, however far (up to 40 m). */
    exact: boolean;
    /** A meal follows: the run ends at the catch. */
    meal: boolean;
    clear?: (x: number, z: number) => boolean;
    water?: (x: number, z: number) => boolean;
    ground: (x: number, z: number) => number;
    /** m/s: the hunter's sprint, the prey's flee, the hunter's stalk, a raptor's dive. */
    paces: {sprint: number; flee: number; stalk: number; dive: number};
};

const DT = 1 / 60;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
};
const heading = (dx: number, dz: number) => Math.atan2(dx, dz);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const steer = (from: number, to: number, max: number) => from + clamp(wrap(to - from), -max, max);

function rng(seed: string): () => number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let s = h >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) % 1_000_003) / 1_000_003;
    };
}

type Pose = {x: number; z: number; y: number; yaw: number; state: string; pitch: number; roll?: number; hidden?: boolean; dim?: number; scale?: number};
type At = (t: number) => Pose;

/** Where the hunter and its prey are in the world at the start: the geometry every act works from. */
type Geo = {lp: number; lq: number; mouth: number; dir: {x: number; z: number}; face: number; D: number};
function geo(i: HuntInput): Geo {
    const lp = Math.max(i.predator.length, 0.01);
    const lq = Math.max(i.prey.length, 0.005);
    let dx = i.prey.x - i.predator.x;
    let dz = i.prey.z - i.predator.z;
    let D = Math.hypot(dx, dz);
    if (D < 0.01) {
        dx = Math.sin(i.predator.yaw);
        dz = Math.cos(i.predator.yaw);
        D = 1;
    }
    const dir = {x: dx / D, z: dz / D};
    return {lp, lq, mouth: lp * 0.5, dir, face: heading(dir.x, dir.z), D};
}

/** The straight way a to b stays on ground the hunter may cross (every 0.4 m), short of the last `spare` m. */
function lineOk(ok: ((x: number, z: number) => boolean) | undefined, ax: number, az: number, bx: number, bz: number, spare = 0): boolean {
    if (!ok) return true;
    const d = Math.hypot(bx - ax, bz - az);
    const n = clamp(Math.ceil(d / 0.4), 1, 120);
    const last = d > 1e-6 ? Math.max(1 - spare / d, 0) : 0;
    for (let k = 1; k <= n; k++) {
        const f = (k / n) * last;
        if (!ok(ax + (bx - ax) * f, az + (bz - az) * f)) return false;
    }
    return true;
}

/** A way on in stops and starts: `move` seconds going, `hold` standing, repeated. Distance covered after `t` seconds of it. */
function stopGo(t: number, move: number, hold: number, v: number): number {
    const period = move + hold;
    const cycles = Math.floor(t / period);
    return v * (cycles * move + Math.min(t - cycles * period, move));
}
const movingAt = (t: number, move: number, hold: number) => t % (move + hold) < move;

/** A way from `a` to `b` over ground `ok`: straight where it is clear, else steered round what is in the way (straight on where it is boxed in). */
function routeAround(ok: ((x: number, z: number) => boolean) | undefined, a: {x: number; z: number}, b: {x: number; z: number}): Array<{x: number; z: number}> {
    if (!ok || lineOk(ok, a.x, a.z, b.x, b.z)) return [{x: a.x, z: a.z}, {x: b.x, z: b.z}];
    const step = 0.4;
    const pts = [{x: a.x, z: a.z}];
    let x = a.x;
    let z = a.z;
    let yaw = heading(b.x - a.x, b.z - a.z);
    // (Round an obstacle on one side, kept: it does not swing from side to side at a corner.)
    let side = 0;
    for (let n = 0; n < 600; n++) {
        if (Math.hypot(b.x - x, b.z - z) < 0.6) {
            pts.push({x: b.x, z: b.z});
            return pts;
        }
        const want = heading(b.x - x, b.z - z);
        // (Clear a step on, a few steps on, and a body's width to each side of the first: it does not clip a corner.)
        const free = (h: number) => ok(x + Math.sin(h) * step, z + Math.cos(h) * step) && ok(x + Math.sin(h) * step * 2.5, z + Math.cos(h) * step * 2.5) && ok(x + Math.sin(h) * step + Math.cos(h) * 0.3, z + Math.cos(h) * step - Math.sin(h) * 0.3) && ok(x + Math.sin(h) * step - Math.cos(h) * 0.3, z + Math.cos(h) * step + Math.sin(h) * 0.3);
        let chosen: number | null = null;
        const offsets = side === 0 ? [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7] : [0, 0.35 * side, 0.7 * side, 1.05 * side, 1.5 * side, 2.1 * side, 2.7 * side, -0.35 * side, -0.7 * side, -1.05 * side];
        for (const off of offsets) {
            if (free(want + off)) {
                chosen = want + off;
                if (off !== 0) side = Math.sign(off);
                else side = 0;
                break;
            }
        }
        // (Boxed in: straight on, as the generic chase does; a short way through whatever is there.)
        if (chosen === null) return [{x: a.x, z: a.z}, {x: b.x, z: b.z}];
        yaw = steer(yaw, chosen, 0.9);
        x += Math.sin(yaw) * step;
        z += Math.cos(yaw) * step;
        pts.push({x, z});
    }
    return [{x: a.x, z: a.z}, {x: b.x, z: b.z}];
}

/**
 * Where it stands to strike, `dist` m from the prey, on the side it comes from where that is clear (else round it). Ground
 * beset with obstacles has no such place: then any clear place near, and at the last the side it comes from (a short
 * leap or stab is not stopped by a stem). Never null: the generic chase has nothing better to offer there.
 */
function standPoint(ok: ((x: number, z: number) => boolean) | undefined, q: {x: number; z: number}, face: number, dist: number): {x: number; z: number} {
    const spot = (h: number) => ({x: q.x - Math.sin(h) * dist, z: q.z - Math.cos(h) * dist});
    if (!ok || dist < 0.02) return spot(face);
    const offsets = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI];
    for (const off of offsets) {
        const p = spot(face + off);
        if (ok(p.x, p.z) && lineOk(ok, p.x, p.z, q.x, q.z, dist * 0.5)) return p;
    }
    for (const off of offsets) {
        const p = spot(face + off);
        if (ok(p.x, p.z)) return p;
    }
    return spot(face);
}

/** A path along points `pts`: a quick advance, then a creep in stops and starts over the last `creepDist` m of it. */
function approach(pts: Array<{x: number; z: number}>, o: {creepDist: number; fast: number; creep: number; move: number; hold: number}) {
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z));
    const D = Math.max(cum[cum.length - 1], 1e-6);
    const dCreep = Math.min(D, Math.max(o.creepDist, 0));
    const dFast = D - dCreep;
    const tFast = dFast / Math.max(o.fast, 0.05);
    const moveTotal = stopGo(o.creep, o.move, o.hold, 1) || 1;
    const vm = dCreep / moveTotal;
    const along = (s: number) => {
        let k = 1;
        while (k < cum.length - 1 && cum[k] < s) k++;
        const seg = Math.max(cum[k] - cum[k - 1], 1e-9);
        const f = clamp((s - cum[k - 1]) / seg, 0, 1);
        return {x: lerp(pts[k - 1].x, pts[k].x, f), z: lerp(pts[k - 1].z, pts[k].z, f), yaw: heading(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z)};
    };
    return {
        end: tFast + (dCreep > 1e-4 ? o.creep : 0),
        fastFor: tFast,
        at(t: number): {x: number; z: number; yaw: number; moving: boolean; creeping: boolean} {
            let s: number;
            let moving: boolean;
            let creeping = false;
            if (t < tFast) {
                s = Math.min(dFast * (t / tFast), dFast);
                moving = true;
            } else {
                const u = Math.min(t - tFast, o.creep);
                s = dFast + Math.min(stopGo(u, o.move, o.hold, vm), dCreep);
                moving = dCreep > 1e-4 && t - tFast < o.creep && movingAt(u, o.move, o.hold);
                creeping = dCreep > 1e-4 && t - tFast < o.creep;
            }
            const p = along(Math.min(s, D));
            return {x: p.x, z: p.z, yaw: p.yaw, moving, creeping};
        }
    };
}

const routeLength = (pts: Array<{x: number; z: number}>) => pts.reduce((sum, p, k) => (k ? sum + Math.hypot(p.x - pts[k - 1].x, p.z - pts[k - 1].z) : 0), 0);
/** A heading part of the way from `a` toward `b` (the short way round). */
const lerpYaw = (a: number, b: number, f: number) => a + wrap(b - a) * f;

/** The pace of the quick advance before a creep: its base pace, or what covers the distance in about `secs` s (at most most of its sprint). */
const trot = (distance: number, base: number, sprint: number, secs = 3.2) => clamp(distance / secs, base, Math.max(sprint * 0.6, base));

/** The finished run: speeds from the positions, the yaw turned at a limited rate, the tail after the catch when no meal follows. */
function finish(i: HuntInput, kind: ChaseKind, end: number, tc: number, launch: number, pred: At, prey: At, o: {turnP: number; turnQ: number; air?: boolean; airQ?: boolean; puffs?: Puff[]; startYaw?: number}): HuntRun {
    const n = Math.ceil((end + (i.meal || i.miss ? 0 : 1.4)) / DT);
    const P: HuntSample[] = [];
    const Q: HuntSample[] = [];
    let yp = o.startYaw ?? i.predator.yaw;
    let yq = i.prey.yaw;
    for (let k = 0; k <= n; k++) {
        const t = k * DT;
        const a = pred(t);
        const b = prey(t);
        yp = steer(yp, a.yaw, o.turnP * DT);
        yq = steer(yq, b.yaw, o.turnQ * DT);
        const after = !i.miss && t > tc ? clamp((t - tc) / 0.5, 0, 1) : 0;
        P.push({...a, yaw: yp, v: 0});
        Q.push({...b, yaw: yq, v: 0, dim: b.dim ?? after, scale: b.scale ?? 1 - 0.85 * after, hidden: b.hidden ?? (!i.miss && t >= tc + 0.55)});
    }
    const speed = (list: HuntSample[], air: boolean | undefined) => {
        for (let k = 1; k < list.length; k++) list[k].v = Math.hypot(list[k].x - list[k - 1].x, list[k].z - list[k - 1].z, air ? list[k].y - list[k - 1].y : 0) / DT;
        if (list.length > 1) list[0].v = list[1].v;
        // (A little smoothing: the rig's gait follows it.)
        for (let k = 1; k < list.length - 1; k++) list[k].v = (list[k - 1].v + list[k].v * 2 + list[k + 1].v) / 4;
    };
    // A miss is drawn as a miss: the hunter is never nearer its prey than the gap, at any sample (pushed back along the line between them).
    if (i.miss) {
        for (let k = 0; k < P.length; k++) {
            const dx = P[k].x - Q[k].x;
            const dy = o.air ? P[k].y - Q[k].y : 0;
            const dz = P[k].z - Q[k].z;
            const d = Math.hypot(dx, dy, dz);
            if (d < i.gap * 1.02) {
                const f = d > 1e-6 ? (i.gap * 1.02) / d : 0;
                if (f > 0) {
                    P[k].x = Q[k].x + dx * f;
                    P[k].z = Q[k].z + dz * f;
                    if (o.air) P[k].y = Q[k].y + dy * f;
                } else {
                    P[k].x = Q[k].x - Math.sin(P[k].yaw) * i.gap * 1.02;
                    P[k].z = Q[k].z - Math.cos(P[k].yaw) * i.gap * 1.02;
                }
            }
        }
    }
    speed(P, o.air);
    speed(Q, o.airQ);
    return {kind, pred: P, prey: Q, tc, seconds: n * DT, puffs: o.puffs ?? [], launch};
}

/** How far a prey that breaks at pace `pace` has gone `since` seconds after it breaks: up to its pace over 0.28 s, then steady. */
const bolted = (since: number, pace: number) => (since <= 0 ? 0 : since < 0.28 ? (pace * since * since) / 0.56 : pace * (since - 0.14));

const preyY = (i: HuntInput, x: number, z: number) => (i.flee === "swim" ? Math.min(i.prey.base, -0.05) : i.ground(x, z));

// MARK: Pounce, leap, jump

/**
 * Stalks low in stops and starts, holds crouched with its hind end working, then one leap onto where the prey will be.
 * (A miss: the prey breaks aside as it comes, the leap lands where it was going, and it stands over empty ground.)
 */
function runPounce(i: HuntInput, mode: "pounce" | "leap" | "jump"): HuntRun | null {
    const {predator: P, prey: Q} = i;
    const g = geo(i);
    const random = rng(`${i.seed}#pounce`);
    const {lp, lq, mouth} = g;
    const high = mode === "leap";
    const jump = mode === "jump";
    const exact = i.exact && g.D <= 40;
    const creepDist = clamp(lp * 6, 0.6, 8);
    const D0 = exact ? g.D : Math.min(g.D, creepDist + 8);
    const leapD = Math.min(jump ? clamp(lp * 6, 0.03, 1.4) : clamp(lp * (high ? 3.2 : 2.6), 0.5, 7.5), D0);
    const A = {x: Q.x - g.dir.x * D0, z: Q.z - g.dir.z * D0};
    // Where it crouches to leap, on the side it comes from where that is clear, and the way there (round what is in it).
    const L = D0 > leapD ? standPoint(i.clear, Q, g.face, leapD) : {x: A.x, z: A.z};
    const route = routeAround(i.clear, A, L);
    const faceL = heading(Q.x - L.x, Q.z - L.z);
    const move = 0.55 + 0.5 * random();
    const hold = 0.35 + 0.55 * random();
    const creepFor = clamp(creepDist / clamp(lp * 0.35, 0.04, 1.1), 1.2, 4.2);
    const fast = trot(Math.max(routeLength(route) - creepDist, 0), clamp(Math.max(i.paces.stalk * 3, lp * 1.3 + 0.3), 0.3, Math.max(i.paces.sprint * 0.5, 0.6)), i.paces.sprint);
    const way = approach(route, {creepDist, fast, creep: creepFor, move, hold});
    const tReady = 0.35;
    const wiggle = (jump ? 0.6 : 0.8) + 0.8 * random();
    const tL = tReady + way.end + wiggle;
    const dist0 = Math.max(Math.hypot(Q.x - L.x, Q.z - L.z), 1e-3);
    const Tl = clamp((0.3 * Math.pow(Math.max(dist0, 0.05), 0.35) + 0.12) * (jump ? 0.6 : 1), 0.2, 0.7);
    const tc = tL + Tl;
    const side = random() < 0.5 ? -1 : 1;
    // The prey breaks as it comes, on along its way at a lunged-at prey's pace; a miss adds a sharp break aside.
    const vq = i.flee === "still" ? 0 : Math.min(i.paces.flee, i.paces.sprint * 0.72);
    const tB = tL + 0.08;
    const fwd = faceL + side * 0.35;
    const dq = bolted(tc - tB, vq * 0.85);
    const aim = {x: Q.x + Math.sin(fwd) * dq, z: Q.z + Math.cos(fwd) * dq};
    const aimYaw = heading(aim.x - L.x, aim.z - L.z);
    const land = {x: aim.x - Math.sin(aimYaw) * mouth * 0.9, z: aim.z - Math.cos(aimYaw) * mouth * 0.9};
    const lat = i.miss ? Math.max(i.gap * 1.7, vq * 0.2) : 0;
    const perp = {x: Math.cos(faceL) * side, z: -Math.sin(faceL) * side};
    const tail = 3.2;
    const end = i.miss ? tc + tail : tc;
    const arc = (jump ? 0.35 * dist0 : clamp(dist0 * 0.3, lp * 0.2, lp * 1.1)) * (high ? 1.8 : 1);
    const puffs: Puff[] = [{x: land.x, y: i.ground(land.x, land.z), z: land.z, size: lp * 0.5, kind: "dust"}];
    const ground = (x: number, z: number) => i.ground(x, z);
    const pred: At = (t) => {
        if (t < tReady) return {x: A.x, z: A.z, y: ground(A.x, A.z), yaw: heading(route[1].x - route[0].x, route[1].z - route[0].z), state: "stalk", pitch: 0.07 * smooth(t / tReady)};
        const u = t - tReady;
        if (u < way.end) {
            const p = way.at(u);
            const fastPhase = u < way.fastFor;
            return {x: p.x, z: p.z, y: ground(p.x, p.z), yaw: p.moving || fastPhase ? p.yaw : lerpYaw(p.yaw, faceL, 0.7), state: p.moving || fastPhase ? "stalk" : "crouch", pitch: fastPhase ? 0.05 : 0.14};
        }
        if (t < tL) {
            // Crouched at the launch: the hind end working side to side, a little more as the moment comes.
            const w = (t - tReady - way.end) / wiggle;
            return {x: L.x, z: L.z, y: ground(L.x, L.z), yaw: faceL + Math.sin(t * 33) * 0.05 * (0.4 + w), state: "crouch", pitch: 0.2, roll: Math.sin(t * 33 + 1.3) * 0.05 * (0.4 + w)};
        }
        if (t < tc) {
            const k = (t - tL) / Tl;
            const x = lerp(L.x, land.x, k);
            const z = lerp(L.z, land.z, k);
            const y = lerp(ground(L.x, L.z), ground(land.x, land.z), k) + 4 * arc * k * (1 - k);
            return {x, z, y, yaw: aimYaw, state: "leap", pitch: high ? lerp(-0.7, 1.1, smooth(k)) : lerp(-0.45, 0.55, smooth(k))};
        }
        // After: a catch ends here (the meal's script has it); a miss lands, slides on a step and stands over nothing.
        const after = t - tc;
        const slide = smooth(Math.min(after / 0.45, 1));
        const x = land.x + Math.sin(aimYaw) * mouth * 0.7 * slide;
        const z = land.z + Math.cos(aimYaw) * mouth * 0.7 * slide;
        return {x, z, y: ground(x, z), yaw: aimYaw + (after > 1.2 ? Math.sin((after - 1.2) * 1.6) * 0.5 : 0), state: after < 0.7 ? "stalk" : "scan", pitch: after < 0.5 ? 0.1 : 0};
    };
    const prey: At = (t) => {
        if (t < tB) {
            // Unaware, then looking up as the wiggle starts.
            return {x: Q.x, z: Q.z, y: preyY(i, Q.x, Q.z), yaw: Q.yaw, state: t > tL - 0.55 ? "scan" : "rest", pitch: i.flee === "still" && t > tL - 0.3 ? 0.12 : 0};
        }
        const since = t - tB;
        const along = since < tc - tB ? bolted(since, vq * 0.85) : dq + (i.miss ? vq * 0.85 * Math.min(t - tc, 2.4) * (1 - 0.35 * clamp((t - tc) / 2.4, 0, 1)) : 0);
        const ease = smooth(since / Math.max(tc - tB, 0.1));
        const x = Q.x + Math.sin(fwd) * along + perp.x * lat * ease;
        const z = Q.z + Math.cos(fwd) * along + perp.z * lat * ease;
        const flee = i.flee;
        const lift = flee === "fly" ? clamp(since * 1.8, 0, lq * 2 + 0.6) : 0;
        const done = i.miss && t - tc > 2;
        return {x, z, y: preyY(i, x, z) + lift, yaw: fwd + (i.miss ? side * 0.6 : 0), state: done ? "scan" : flee === "still" ? "freeze" : flee === "fly" ? "fly" : flee === "swim" ? "swim" : "run", pitch: 0};
    };
    return finish(i, "glide", end, tc, tL, pred, prey, {turnP: 7, turnQ: 9, air: false, airQ: i.flee === "fly", puffs, startYaw: P.yaw});
}

// MARK: Dash, lunge, tongue, web (the hunter sits; the prey comes)

/**
 * The hunter sits still and the prey comes (it grazes in, a step at a time): then one strike, by the hunter's way:
 * a short dash onto it (`dash`), a reach (`lunge`), the tongue (`tongue`), or - in a web - a held, struggling prey
 * that the hunter crosses to, bites and wraps (`web`). A miss: the prey sees it and is gone as it strikes.
 */
function runSit(i: HuntInput, mode: "dash" | "lunge" | "tongue" | "web"): HuntRun | null {
    const {predator: P} = i;
    const g = geo(i);
    const random = rng(`${i.seed}#sit`);
    const {lp, lq, mouth} = g;
    const web = mode === "web";
    // How near the prey comes before the strike (a miss: never inside the gap).
    const base = mode === "dash" ? clamp(lp * 3 + lq, 0.04, 2.5) : mode === "lunge" ? lp * 0.75 + lq * 0.4 : mode === "tongue" ? lp * 1.3 + lq * 0.3 : clamp(lp * 3.2 + lq, 0.05, 1.6);
    const strikeD = Math.max(base, i.miss ? i.gap * 1.15 : 0);
    const comeFrom = web ? strikeD : Math.max(clamp(lp * 9 + lq * 3, 0.3, 9), strikeD * 1.6);
    const Rapp = web ? strikeD : Math.min(Math.max(g.D, strikeD), comeFrom);
    const hunter = {x: P.x, z: P.z};
    const at = (r: number) => ({x: hunter.x + g.dir.x * r, z: hunter.z + g.dir.z * r});
    // The prey walks in a step at a time (a held prey does not walk).
    const vw = web || i.flee === "still" ? 0 : clamp(i.paces.flee * 0.16, lq * 0.35, 1.2);
    const walkFor = vw > 0 ? clamp((Rapp - strikeD) / vw, 1.2, 6.2) : 0;
    const vwEff = walkFor > 0 ? (Rapp - strikeD) / (stopGo(walkFor, 0.9, 0.5, 1) || 1) : 0;
    const tStart = 0.5;
    const feel = web ? 1.1 + 0.7 * random() : 0.35 + 0.35 * random();
    const tS = tStart + walkFor + feel + 0.1;
    const side = random() < 0.5 ? -1 : 1;
    const dashPace = Math.max(Math.min(i.paces.sprint, lp * 14), 0.2);
    const strikeFor = mode === "dash" ? clamp(strikeD / dashPace, 0.12, 0.6) : mode === "lunge" ? 0.2 : mode === "tongue" ? 0.16 : clamp(strikeD / dashPace, 0.15, 0.7);
    const preyAt0 = (t: number) => {
        const u = clamp(t - tStart, 0, walkFor);
        const r = Rapp - (web ? 0 : stopGo(u, 0.9, 0.5, vwEff));
        const p = at(r);
        return {x: p.x, z: p.z, walking: !web && walkFor > 0 && t >= tStart && t < tStart + walkFor && movingAt(u, 0.9, 0.5)};
    };
    const hold = at(strikeD);
    const toHold = g.face;
    const tc = tS + strikeFor + (web && !i.miss ? 1.5 : 0);
    // The strike's end: the hunter's mouth on the prey (a lunge reaches out from where it sits; a miss falls short of the gap).
    const reachTo = mode === "lunge" ? Math.max(strikeD - (i.miss ? i.gap * 1.04 : mouth * 1.1 + lq * 0.3), 0) : mode === "tongue" ? 0 : Math.max(strikeD - (i.miss ? i.gap * 1.04 : mouth * 0.9), 0);
    const catchAt = at(reachTo);
    const mouthPoint = at(mouth * 0.95);
    const tail = 2.6;
    const end = i.miss ? tc + tail : tc;
    const away = g.face + side * 0.4;
    const vq = i.flee === "still" ? 0 : Math.min(i.paces.flee, i.paces.sprint * 0.72);
    const jinkAt = tS + strikeFor * 0.45;
    const ground = (x: number, z: number) => i.ground(x, z);
    const puffs: Puff[] = [{x: catchAt.x, y: ground(catchAt.x, catchAt.z), z: catchAt.z, size: lp * 0.4, kind: "dust"}];
    const pred: At = (t) => {
        const y = ground(hunter.x, hunter.z);
        if (t < tS) {
            // Waiting: still; a mantis sways; at the prey's coming it looks (a web: it feels the thread).
            const near = t > tS - feel;
            return {x: hunter.x, z: hunter.z, y, yaw: g.face + (mode === "lunge" ? Math.sin(t * 1.4) * 0.05 : 0) + (near ? Math.sin(t * 30) * 0.012 : 0), state: near && web ? "scan" : "freeze", pitch: mode === "lunge" ? -0.05 : near ? 0.06 : 0};
        }
        if (t < tS + strikeFor) {
            const k = (t - tS) / strikeFor;
            const e = 1 - (1 - k) * (1 - k);
            if (mode === "tongue") return {x: hunter.x, z: hunter.z, y, yaw: toHold, state: "strike", pitch: -0.18 * Math.sin(Math.PI * k) + 0.05};
            const x = lerp(hunter.x, catchAt.x, e);
            const z = lerp(hunter.z, catchAt.z, e);
            if (mode === "lunge") return {x, z, y, yaw: toHold, state: "strike", pitch: 0.28 * Math.sin(Math.PI * Math.min(k * 1.4, 1))};
            return {x, z, y, yaw: toHold, state: "run", pitch: 0.05};
        }
        if (web && !i.miss && t < tc) {
            // The bite, then the wrap: it circles the prey, turning it over and over, and ends with its mouth on it.
            const w = (t - tS - strikeFor) / 1.5;
            const r = (lp + lq) * 0.4 * smooth(Math.min(w * 3, 1));
            const ang = toHold + Math.PI + w * 7;
            const back = smooth((w - 0.8) / 0.2);
            const x = lerp(hold.x + Math.sin(ang) * r, catchAt.x, back);
            const z = lerp(hold.z + Math.cos(ang) * r, catchAt.z, back);
            return {x, z, y, yaw: heading(hold.x - x, hold.z - z), state: "strike", pitch: 0.1};
        }
        const after = t - tc;
        return {x: catchAt.x, z: catchAt.z, y, yaw: toHold + (after > 0.8 ? Math.sin((after - 0.8) * 1.4) * 0.6 : 0), state: after < 0.6 ? "freeze" : "scan", pitch: 0};
    };
    const prey: At = (t) => {
        const p = preyAt0(Math.min(t, tS));
        if (t < tS) {
            const shaking = web && t >= tStart;
            return {x: p.x, z: p.z, y: preyY(i, p.x, p.z) + (shaking ? Math.abs(Math.sin(t * 11)) * lq * 0.12 : 0), yaw: web ? g.face + Math.PI * 0.5 : g.face + Math.PI, state: web ? "run" : p.walking ? "walk" : t > tS - feel ? "scan" : t < tStart ? "rest" : "eat", pitch: 0, roll: shaking ? Math.sin(t * 13) * 0.22 : 0};
        }
        const k = (t - tS) / strikeFor;
        if (!i.miss) {
            // The catch: the tongue draws it in; a bite and a wrap hold it where it is.
            if (mode === "tongue") {
                const e = smooth((k - 0.2) / 0.8);
                return {x: lerp(hold.x, mouthPoint.x, e), z: lerp(hold.z, mouthPoint.z, e), y: preyY(i, hold.x, hold.z) + lq * 0.3 * Math.sin(Math.PI * clamp(e, 0, 1)), yaw: g.face + Math.PI, state: "run", pitch: 0};
            }
            const wrapping = web && t > tS + strikeFor;
            return {x: hold.x, z: hold.z, y: preyY(i, hold.x, hold.z), yaw: wrapping ? g.face + (t - tS) * 5 : toHold + Math.PI, state: wrapping ? "freeze" : "scan", pitch: 0, roll: wrapping ? Math.sin(t * 12) * 0.3 : 0};
        }
        // A miss: it is gone as the strike comes, away at its own pace (a web's prey breaks free and flies).
        const since = Math.max(t - jinkAt, 0);
        const d = vq * 1.1 * Math.min(since, 2.4) * (1 - 0.3 * clamp(since / 2.4, 0, 1));
        const x = hold.x + Math.sin(away) * d;
        const z = hold.z + Math.cos(away) * d;
        const flies = i.flee === "fly" || web;
        return {x, z, y: preyY(i, x, z) + (flies ? clamp(since * 1.5, 0, 1.4) : 0), yaw: away, state: since <= 0 ? "scan" : flies ? "fly" : since < 1.6 ? "run" : "scan", pitch: 0};
    };
    return finish(i, "glide", end, tc, tS, pred, prey, {turnP: 9, turnQ: 9, air: false, airQ: i.flee === "fly" || web, puffs, startYaw: P.yaw});
}

// MARK: Wade

/** A wading bird: slow placed steps in the shallows, stock still, then the spear. */
function runWade(i: HuntInput): HuntRun | null {
    const {predator: P, prey: Q} = i;
    const g = geo(i);
    const random = rng(`${i.seed}#wade`);
    const {lp, lq, mouth} = g;
    const strikeD = Math.max(lp * 0.55 + lq * 0.45, i.miss ? i.gap * 1.1 : 0);
    const creepDist = clamp(lp * 3, 0.6, 4);
    const exact = i.exact && g.D <= 40;
    const D0 = Math.max(exact ? g.D : Math.min(g.D, strikeD + creepDist + 4), strikeD);
    const A = {x: Q.x - g.dir.x * D0, z: Q.z - g.dir.z * D0};
    // (Over its own ground: the shallows, or the bank.)
    const walkable = i.clear || i.water ? (x: number, z: number) => (i.clear ? i.clear(x, z) : false) || (i.water ? i.water(x, z) : false) : undefined;
    const L = D0 > strikeD ? standPoint(walkable, Q, g.face, strikeD) : {x: A.x, z: A.z};
    const route = routeAround(walkable, A, L);
    const faceL = heading(Q.x - L.x, Q.z - L.z);
    const move = 0.8 + 0.4 * random();
    const hold = 0.9 + 1.2 * random();
    const creepFor = clamp(creepDist / clamp(lp * 0.12, 0.04, 0.4), 2, 4.6);
    const fast = trot(Math.max(routeLength(route) - creepDist, 0), clamp(Math.max(i.paces.stalk * 2.4, lp * 0.8), 0.25, 2.2), i.paces.sprint, 4);
    const way = approach(route, {creepDist, fast, creep: creepFor, move, hold});
    const tReady = 0.4;
    const still = 1.2 + 0.9 * random();
    const tS = tReady + way.end + still;
    const strikeFor = 0.17;
    const tc = tS + strikeFor;
    const side = random() < 0.5 ? -1 : 1;
    const away = faceL + side * 1.2;
    const vq = Math.min(i.paces.flee, 3);
    const tB = tS - 0.02;
    const catchAt = {x: Q.x + g.dir.x * 0, z: Q.z + g.dir.z * 0};
    const lat = i.miss ? Math.max(i.gap * 1.7, vq * 0.2) : 0;
    const perp = {x: Math.cos(faceL) * side, z: -Math.sin(faceL) * side};
    const tail = 2.8;
    const end = i.miss ? tc + tail : tc;
    const strikeTo = {x: Q.x - Math.sin(faceL) * (mouth * 0.9 + (i.miss ? lat * 0.4 : 0)), z: Q.z - Math.cos(faceL) * (mouth * 0.9 + (i.miss ? lat * 0.4 : 0))};
    const stand = (x: number, z: number) => i.ground(x, z);
    const puffs: Puff[] = [{x: Q.x, y: -0.05, z: Q.z, size: lq * 1.2 + lp * 0.2, kind: "bubble"}];
    const pred: At = (t) => {
        if (t < tReady) return {x: A.x, z: A.z, y: stand(A.x, A.z), yaw: heading(route[1].x - route[0].x, route[1].z - route[0].z), state: "scan", pitch: 0};
        const u = t - tReady;
        if (u < way.end) {
            const p = way.at(u);
            const fastPhase = u < way.fastFor;
            // (A step lifts the body a little; a bird freezes mid-way, head low.)
            return {x: p.x, z: p.z, y: stand(p.x, p.z), yaw: p.moving || fastPhase ? p.yaw : lerpYaw(p.yaw, faceL, 0.7), state: p.moving ? "wade" : "scan", pitch: fastPhase ? 0.04 : 0.12};
        }
        if (t < tS) {
            const w = (t - tReady - way.end) / still;
            return {x: L.x, z: L.z, y: stand(L.x, L.z), yaw: faceL, state: "scan", pitch: 0.2 + 0.2 * smooth(w) + Math.sin(t * 14) * 0.01 * w};
        }
        if (t < tc) {
            const k = (t - tS) / strikeFor;
            const e = 1 - (1 - k) * (1 - k);
            return {x: lerp(L.x, strikeTo.x, e), z: lerp(L.z, strikeTo.z, e), y: stand(L.x, L.z), yaw: faceL, state: "strike", pitch: lerp(0.4, 1.05, e)};
        }
        const after = t - tc;
        // A catch is the meal's from here. A miss: it straightens up, the neck coming back, and watches.
        const x = strikeTo.x;
        const z = strikeTo.z;
        return {x, z, y: stand(x, z), yaw: faceL + (after > 0.9 ? Math.sin((after - 0.9) * 1.5) * 0.5 : 0), state: "scan", pitch: lerp(1.0, 0.05, smooth(after / 0.7))};
    };
    const prey: At = (t) => {
        const water = i.flee === "swim";
        const y = (x: number, z: number) => (water ? Math.min(i.prey.base, -0.05) : stand(x, z));
        if (t < tB) return {x: Q.x, z: Q.z, y: y(Q.x, Q.z), yaw: Q.yaw, state: water ? "swim" : "rest", pitch: 0};
        const since = t - tB;
        if (!i.miss) return {x: Q.x, z: Q.z, y: y(Q.x, Q.z), yaw: Q.yaw, state: water ? "swim" : "scan", pitch: 0};
        const d = vq * 1.3 * Math.min(since, 2.4) * (1 - 0.3 * clamp(since / 2.4, 0, 1));
        const x = Q.x + Math.sin(away) * d + perp.x * lat * smooth(since / 0.3);
        const z = Q.z + Math.cos(away) * d + perp.z * lat * smooth(since / 0.3);
        return {x, z, y: y(x, z) + (i.flee === "fly" ? clamp(since * 1.5, 0, 1.4) : 0), yaw: away, state: since < 2 ? (water ? "swim" : i.flee === "fly" ? "fly" : "run") : "scan", pitch: 0};
    };
    void catchAt;
    return finish(i, "glide", end, tc, tS, pred, prey, {turnP: 5, turnQ: 9, air: false, puffs, startYaw: P.yaw});
}

// MARK: Peck

/** A small bird on the ground: runs, stops with its head tilted, runs, stabs; a pull for a worm (`pull`). */
function runPeck(i: HuntInput): HuntRun | null {
    const {predator: P, prey: Q} = i;
    const g = geo(i);
    const random = rng(`${i.seed}#peck`);
    const {lp, lq} = g;
    const strikeD = lp * 0.5 + lq * 0.5 + 0.01;
    const exact = i.exact && g.D <= 40;
    const D0 = exact ? g.D : Math.min(g.D, 9 * lp + 4);
    const A = {x: Q.x - g.dir.x * D0, z: Q.z - g.dir.z * D0};
    const L = D0 > strikeD ? standPoint(i.clear, Q, g.face, strikeD) : {x: A.x, z: A.z};
    const route = routeAround(i.clear, A, L);
    const faceL = heading(Q.x - L.x, Q.z - L.z);
    const cum = [0];
    for (let k = 1; k < route.length; k++) cum.push(cum[k - 1] + Math.hypot(route[k].x - route[k - 1].x, route[k].z - route[k - 1].z));
    // Runs of a few strides, each ending in a stop with the head cocked.
    const stride = clamp(lp * 6, 0.4, 3.5);
    const runs = clamp(Math.ceil(cum[cum.length - 1] / (lp * 10 + 0.5)), 1, 4);
    const legs: Array<{from: number; to: number; t0: number; t1: number; stop: number}> = [];
    let t = 0.4;
    let d = 0;
    const total = cum[cum.length - 1];
    for (let k = 0; k < runs; k++) {
        const piece = total / runs;
        const dur = Math.max(piece / stride, 0.15);
        const stop = 0.45 + 0.55 * random();
        legs.push({from: d, to: d + piece, t0: t, t1: t + dur, stop});
        t += dur + stop;
        d += piece;
    }
    const tS = t + 0.2;
    const strikeFor = 0.14;
    const tc = tS + strikeFor;
    const tB = tS - 0.12;
    const side = random() < 0.5 ? -1 : 1;
    const vq = i.flee === "still" ? 0 : Math.min(i.paces.flee, 1.5);
    const perp = {x: Math.cos(faceL) * side, z: -Math.sin(faceL) * side};
    const lat = i.miss ? Math.max(i.gap * 1.6, 0.06) : 0;
    const end = i.miss ? tc + 2.4 : tc;
    const along = (dd: number) => {
        let k = 1;
        while (k < cum.length - 1 && cum[k] < dd) k++;
        const f = clamp((dd - cum[k - 1]) / Math.max(cum[k] - cum[k - 1], 1e-9), 0, 1);
        return {x: lerp(route[k - 1].x, route[k].x, f), z: lerp(route[k - 1].z, route[k].z, f), yaw: heading(route[k].x - route[k - 1].x, route[k].z - route[k - 1].z)};
    };
    const pred: At = (tt) => {
        const ground = (x: number, z: number) => i.ground(x, z);
        let dd = 0;
        let state = "scan";
        let tilt = 0;
        for (const leg of legs) {
            if (tt >= leg.t0 && tt < leg.t1) {
                dd = lerp(leg.from, leg.to, smooth((tt - leg.t0) / (leg.t1 - leg.t0) * 0.0 + (tt - leg.t0) / (leg.t1 - leg.t0)));
                state = "run";
                break;
            }
            if (tt >= leg.t1 && tt < leg.t1 + leg.stop) {
                dd = leg.to;
                // Stopped, the head cocked to one side, listening, looking.
                tilt = Math.sin(((tt - leg.t1) / leg.stop) * Math.PI) * 0.5 * (legs.indexOf(leg) % 2 ? -1 : 1);
                state = "scan";
                break;
            }
            if (tt >= leg.t1) dd = leg.to;
        }
        const p = along(dd);
        if (tt >= tS - 0.0 && tt < tc) {
            const k = (tt - tS) / strikeFor;
            const e = 1 - (1 - k) * (1 - k);
            const x = lerp(L.x, L.x + Math.sin(faceL) * lp * 0.3, e);
            const z = lerp(L.z, L.z + Math.cos(faceL) * lp * 0.3, e);
            return {x, z, y: ground(x, z), yaw: faceL, state: "peck", pitch: lerp(0.1, 0.95, e)};
        }
        if (tt >= tc) {
            const after = tt - tc;
            const x = L.x + Math.sin(faceL) * lp * 0.3;
            const z = L.z + Math.cos(faceL) * lp * 0.3;
            return {x, z, y: ground(x, z), yaw: faceL + (after > 0.6 ? Math.sin(after * 3) * 0.4 : 0), state: after < 0.4 ? "peck" : "scan", pitch: lerp(0.95, 0.1, smooth(after / 0.4))};
        }
        return {x: p.x, z: p.z, y: ground(p.x, p.z), yaw: (state === "run" ? p.yaw : faceL) + tilt, state, pitch: state === "run" ? 0.12 : tilt !== 0 ? -0.08 : 0};
    };
    const prey: At = (tt) => {
        const awayYaw = faceL + side * (i.miss ? 1.3 : 0.4);
        if (tt < tB) return {x: Q.x, z: Q.z, y: preyY(i, Q.x, Q.z), yaw: Q.yaw, state: "rest", pitch: 0};
        const since = tt - tB;
        if (!i.miss) {
            // A last twitch: it starts to go.
            const dd = vq * 0.4 * Math.min(since, 0.2);
            const x = Q.x + Math.sin(awayYaw) * dd;
            const z = Q.z + Math.cos(awayYaw) * dd;
            return {x, z, y: preyY(i, x, z), yaw: awayYaw, state: i.flee === "still" ? "freeze" : "run", pitch: 0};
        }
        const dd = vq * 1.3 * Math.min(since, 2.2);
        const x = Q.x + Math.sin(awayYaw) * dd + perp.x * lat * smooth(since / 0.25);
        const z = Q.z + Math.cos(awayYaw) * dd + perp.z * lat * smooth(since / 0.25);
        return {x, z, y: preyY(i, x, z) + (i.flee === "fly" ? clamp(since * 1.4, 0, 1.2) : 0), yaw: awayYaw, state: i.flee === "fly" ? "fly" : since < 2 ? "run" : "scan", pitch: 0};
    };
    const puffs: Puff[] = [{x: Q.x, y: i.ground(Q.x, Q.z), z: Q.z, size: lp * 0.3, kind: "dust"}];
    return finish(i, "glide", end, tc, tS, pred, prey, {turnP: 14, turnQ: 10, air: false, puffs, startYaw: P.yaw});
}

// MARK: Lurk

/** A crocodilian: drifts in with only its eyes above the water, then an explosive strike up from it onto the bank (or the prey in the water). */
function runLurk(i: HuntInput): HuntRun | null {
    const {predator: P, prey: Q} = i;
    const g = geo(i);
    const random = rng(`${i.seed}#lurk`);
    const {lp, lq, mouth} = g;
    // The water's edge along the line to the prey: the last water point from the hunter.
    const water = i.water ?? (() => true);
    let shore = 0;
    for (let s = 0; s <= Math.min(g.D, 40); s += 0.25) {
        if (!water(P.x + g.dir.x * s, P.z + g.dir.z * s)) break;
        shore = s;
    }
    const preyInWater = i.flee === "swim" || water(Q.x, Q.z);
    // Where the prey stands: at the water's edge, drinking (or where it swims); beyond a body's reach inland there is no strike.
    const strikeD = Math.max(lp * 0.85 + lq * 0.3, i.miss ? i.gap * 1.1 : 0);
    let stand = {x: Q.x, z: Q.z};
    if (!preyInWater) {
        const inland = clamp(lp * 0.55, 0.3, 3);
        // (It comes down to the water's edge to drink, as far as the hunter's own water goes.)
        stand = {x: P.x + g.dir.x * (shore + inland), z: P.z + g.dir.z * (shore + inland)};
    }
    const D1 = Math.hypot(stand.x - P.x, stand.z - P.z);
    const toStand = heading(stand.x - P.x, stand.z - P.z);
    const u = {x: (stand.x - P.x) / Math.max(D1, 1e-6), z: (stand.z - P.z) / Math.max(D1, 1e-6)};
    const L = {x: stand.x - u.x * strikeD, z: stand.z - u.z * strikeD};
    // The drift in: slow, never a ripple of effort, in stops.
    const drift = clamp(lp * 0.22, 0.1, 0.9);
    const move = 1.2 + 0.8 * random();
    const hold = 0.8 + 0.9 * random();
    const driftFor = clamp((D1 - strikeD) / drift, 0.3, 6.5);
    const way = approach([{x: P.x, z: P.z}, L], {creepDist: Math.hypot(L.x - P.x, L.z - P.z), fast: drift, creep: driftFor, move, hold});
    const tReady = 0.4;
    const still = 1.0 + 0.8 * random();
    const tS = tReady + way.end + still;
    const strikeFor = 0.24;
    const tc = tS + strikeFor;
    const side = random() < 0.5 ? -1 : 1;
    const lat = i.miss ? Math.max(i.gap * 1.7, 0.3) : 0;
    const perp = {x: Math.cos(toStand) * side, z: -Math.sin(toStand) * side};
    const away = toStand + side * 1.0;
    const vq = i.flee === "still" ? 0 : Math.min(i.paces.flee, 8);
    const tB = tS - 0.05;
    const hit = {x: stand.x - u.x * mouth * 0.9, z: stand.z - u.z * mouth * 0.9};
    const level = (x: number, z: number) => (water(x, z) ? Math.min(P.base, -0.05) - lp * 0.03 : i.ground(x, z));
    const tail = 3.0;
    const end = i.miss ? tc + tail : tc;
    const puffs: Puff[] = [{x: hit.x, y: -0.05, z: hit.z, size: (lp + lq) * 0.7, kind: "bubble"}];
    const pred: At = (t) => {
        if (t < tReady) return {x: P.x, z: P.z, y: level(P.x, P.z), yaw: toStand, state: "swim", pitch: 0};
        const w = t - tReady;
        if (w < way.end) {
            const p = way.at(w);
            return {x: p.x, z: p.z, y: level(p.x, p.z), yaw: toStand, state: "swim", pitch: 0};
        }
        if (t < tS) return {x: L.x, z: L.z, y: level(L.x, L.z), yaw: toStand + Math.sin(t * 1.1) * 0.03, state: "swim", pitch: -0.02};
        if (t < tc) {
            // Up out of the water and onto it: the front of the body clears the surface.
            const k = (t - tS) / strikeFor;
            const e = 1 - (1 - k) * (1 - k);
            const x = lerp(L.x, i.miss ? hit.x - u.x * lat * 0.4 : hit.x, e);
            const z = lerp(L.z, i.miss ? hit.z - u.z * lat * 0.4 : hit.z, e);
            return {x, z, y: level(x, z) + lp * 0.18 * Math.sin(Math.PI * Math.min(k * 1.2, 1)), yaw: toStand, state: "strike", pitch: -0.3 * Math.sin(Math.PI * k) + 0.12};
        }
        const after = t - tc;
        const x = i.miss ? hit.x - u.x * lat * 0.4 : hit.x;
        const z = i.miss ? hit.z - u.z * lat * 0.4 : hit.z;
        return {x, z, y: level(x, z), yaw: toStand, state: after < 0.8 ? "strike" : "swim", pitch: 0};
    };
    const prey: At = (t) => {
        const wet = preyInWater;
        const y = (x: number, z: number) => (wet ? Math.min(Q.base, -0.05) : i.ground(x, z));
        if (t < tB) return {x: stand.x, z: stand.z, y: y(stand.x, stand.z), yaw: toStand + Math.PI, state: wet ? "swim" : t < tS - 0.7 ? "eat" : "scan", pitch: t < tS - 0.7 && !wet ? 0.15 : 0};
        if (!i.miss) return {x: stand.x, z: stand.z, y: y(stand.x, stand.z), yaw: toStand, state: "scan", pitch: 0};
        const since = t - tB;
        const d = vq * 1.3 * Math.min(since, 2.4) * (1 - 0.3 * clamp(since / 2.4, 0, 1));
        const x = stand.x + Math.sin(away) * d + perp.x * lat * smooth(since / 0.3);
        const z = stand.z + Math.cos(away) * d + perp.z * lat * smooth(since / 0.3);
        return {x, z, y: y(x, z), yaw: away, state: wet ? "swim" : since < 2 ? "run" : "scan", pitch: 0};
    };
    return finish(i, "dart", end, tc, tS, pred, prey, {turnP: 4, turnQ: 9, air: false, puffs, startYaw: P.yaw});
}

// MARK: The air: drop, hover, plunge, talon, hawk

/** A raptor or a kingfisher from a perch, over the prey, or after the water's prey: the drop's variants. */
function runAir(i: HuntInput, mode: "drop" | "hover" | "plunge" | "talon"): HuntRun | null {
    const {predator: P, prey: Q} = i;
    const g = geo(i);
    const random = rng(`${i.seed}#air`);
    const {lp, lq} = g;
    const water = i.flee === "swim";
    const ground = (x: number, z: number) => i.ground(x, z);
    const surface = water ? 0 : ground(Q.x, Q.z);
    const aloft = P.base > ground(P.x, P.z) + 2;
    // On a perch (above the ground a little) or on the ground: from the ground it first takes to a low station.
    const perched = !aloft && P.base > ground(P.x, P.z) + 0.3;
    const small = lp < 0.45;
    const perchH = perched ? P.base - ground(P.x, P.z) : clamp(lp * 4, 1.2, 3);
    const station = mode === "hover" ? clamp(lp * 9, 3, 12) : mode === "plunge" ? clamp(lp * (small ? 7 : 14), small ? 2 : 6, 16) : 0;
    const reach = Math.min(g.D, 22);
    const from = {x: Q.x - g.dir.x * reach, z: Q.z - g.dir.z * reach};
    const start = g.D <= 22 ? {x: P.x, z: P.z} : from;
    const cruise = clamp(lp * 8, 4, 14);
    const y0 = aloft || perched ? P.base : ground(start.x, start.z);
    // The place over the prey it hangs or starts from.
    const stationY = mode === "drop" ? (aloft || perched ? y0 : y0 + perchH) : mode === "talon" ? Math.max(y0, surface + clamp(lp * 7, 2.5, 10)) : surface + station;
    const lead = mode === "hover" || mode === "plunge" ? 0 : clamp(lp * 9, 3, 9);
    const hoverAt = mode === "drop" ? {x: start.x, z: start.z} : {x: Q.x - g.dir.x * lead, z: Q.z - g.dir.z * lead};
    const flyTo = Math.hypot(hoverAt.x - start.x, hoverAt.z - start.z);
    const watch = mode === "drop" ? 1.4 + 1.6 * random() : 0.6 + 0.5 * random();
    const tReady = 0.4;
    const tA = tReady + (mode === "drop" ? watch : flyTo / cruise + (aloft ? 0 : 0.7));
    const hang = mode === "hover" ? 1.6 + 1.4 * random() : mode === "plunge" ? (small ? 0.5 : 1.0) + 0.5 * random() : 0;
    const tD = tA + hang;
    const drop = Math.max(stationY - (surface + lq * 0.5), 0.5);
    const diveFor = clamp(drop / (mode === "hover" ? i.paces.dive * 0.55 : i.paces.dive * (mode === "drop" ? 0.28 : 0.6)), 0.5, mode === "drop" ? 2.6 : 1.6);
    const tc = tD + diveFor;
    const side = random() < 0.5 ? -1 : 1;
    const vq = i.flee === "still" ? 0 : i.flee === "fly" ? Math.max(lq * 6, 3) : Math.min(i.paces.flee, 9);
    const tB = tc - 0.5 - 0.3 * random();
    const away = g.face + side * (i.miss ? 1.2 : 0.5);
    const lat = i.miss ? Math.max(i.gap * 1.5, lq * 2, 0.3) : 0;
    const perp = {x: Math.cos(g.face) * side, z: -Math.sin(g.face) * side};
    const dip = mode === "plunge" ? clamp(lp * (small ? 0.5 : 1.0), 0.1, 1.2) : 0;
    // (The prey where it would be had it not broken aside: where the hunter aims.)
    const preyPlace = (t: number, sideways: number) => {
        const wet = water;
        const baseY = (x: number, z: number) => (wet ? Math.min(Q.base, -0.05) : ground(x, z));
        const since = Math.max(t - tB, 0);
        const run = Math.min(since, tc - tB);
        const d = vq * clamp(since / 0.25, 0, 1) * run * 0.5 + (i.miss ? Math.max(vq * 1.2 * (since - (tc - tB)), 0) : 0);
        const e = smooth(run / Math.max(tc - tB, 0.1));
        const x = Q.x + Math.sin(away) * d + perp.x * sideways * e;
        const z = Q.z + Math.cos(away) * d + perp.z * sideways * e;
        const lift = i.flee === "fly" ? clamp(since * 2.2, 0, 2.5) : wet ? -clamp(since * 0.5, 0, 0.5) : 0;
        return {x, z, y: baseY(x, z) + lift};
    };
    const preyAt: At = (t) => {
        const wet = water;
        if (t < tB) return {x: Q.x, z: Q.z, y: wet ? Math.min(Q.base, -0.05) : ground(Q.x, Q.z), yaw: Q.yaw, state: wet ? "swim" : t > tB - 1.0 ? "scan" : "rest", pitch: 0};
        const p = preyPlace(t, lat);
        return {...p, yaw: away, state: wet ? "swim" : i.flee === "still" ? "freeze" : i.flee === "fly" ? "fly" : "run", pitch: 0};
    };
    const strikeAt = (() => {
        const p = preyPlace(tc, 0);
        return {x: p.x, z: p.z, y: p.y + (water ? 0 : lq * 0.55)};
    })();
    const climb = {x: Math.sin(g.face), z: Math.cos(g.face)};
    const pred: At = (t) => {
        if (t < tReady) return {x: start.x, z: start.z, y: y0, yaw: g.face, state: aloft ? "fly" : "perch", pitch: 0};
        if (t < tA) {
            if (mode === "drop" && (aloft || perched)) {
                // Perched, watching: a slow turn of the head, then it leans.
                return {x: start.x, z: start.z, y: y0, yaw: g.face + Math.sin(t * 0.9) * 0.25, state: "scan", pitch: t > tA - 0.35 ? 0.2 : 0};
            }
            // Over to its place: up from where it stood, then across.
            const k = (t - tReady) / Math.max(tA - tReady, 1e-3);
            const e = smooth(k);
            return {x: lerp(start.x, hoverAt.x, e), z: lerp(start.z, hoverAt.z, e), y: lerp(y0, stationY, smooth(Math.min(k * 1.6, 1))), yaw: heading(hoverAt.x - start.x + 1e-9, hoverAt.z - start.z), state: !aloft && k < 0.2 ? "takeoff" : k > 0.8 ? "glide" : "fly", pitch: !aloft && k < 0.25 ? -0.3 : 0};
        }
        if (t < tD) {
            // Hanging: wings working, head still; the body bobs a little.
            return {x: hoverAt.x + Math.sin(t * 1.3) * 0.15, z: hoverAt.z, y: stationY + Math.sin(t * 2.1) * 0.08, yaw: g.face, state: "hover", pitch: -0.1};
        }
        if (t < tc) {
            const k = (t - tD) / diveFor;
            if (mode === "drop") {
                // A shallow silent glide: low over the ground, the feet thrown forward at the last.
                const e = Math.pow(k, 1.6);
                const x = lerp(hoverAt.x, strikeAt.x, k);
                const z = lerp(hoverAt.z, strikeAt.z, k);
                return {x, z, y: lerp(stationY, strikeAt.y, e), yaw: heading(strikeAt.x - hoverAt.x + 1e-9, strikeAt.z - hoverAt.z), state: k < 0.8 ? "glide" : "strike_feet", pitch: k < 0.8 ? 0.2 * Math.sin(Math.PI * k) : -0.55};
            }
            // A steep drop, wings folded, feet forward at the end.
            const e = k * k;
            const x = lerp(hoverAt.x, strikeAt.x, e);
            const z = lerp(hoverAt.z, strikeAt.z, e);
            const y = lerp(stationY, strikeAt.y - dip * smooth((k - 0.88) / 0.12), e);
            return {x, z, y, yaw: heading(strikeAt.x - hoverAt.x + 1e-9, strikeAt.z - hoverAt.z), state: k < 0.82 ? "plunge" : "strike_feet", pitch: k < 0.82 ? 0.95 * Math.sin(Math.PI * Math.min(k * 1.2, 1) * 0.5) : -0.6};
        }
        const after = t - tc;
        // A miss: pulled out, climbing away over the prey's line; a catch is the meal's from here.
        const k = smooth(after / 1.6);
        return {x: strikeAt.x + climb.x * 7 * k, z: strikeAt.z + climb.z * 7 * k, y: strikeAt.y + (i.miss ? 4 * k : 0), yaw: g.face, state: "fly", pitch: -0.4 * Math.sin(Math.PI * Math.min(k * 1.4, 1))};
    };
    const tail = 2.0;
    const end = i.miss ? tc + tail : tc;
    const puffs: Puff[] = [{x: strikeAt.x, y: Math.max(strikeAt.y, 0) + 0.1, z: strikeAt.z, size: lq * 1.2 + (water ? lp * 0.8 : 0), kind: water ? "bubble" : "dust"}];
    return finish(i, "swoop", end, tc, tD, pred, preyAt, {turnP: 6, turnQ: 9, air: true, airQ: i.flee === "fly", puffs, startYaw: P.yaw});
}

/** After flying prey in the air: darts out (or goes on from where it is on the wing) and turns after it, the prey weaving. */
function runHawk(i: HuntInput): HuntRun | null {
    const {predator: P, prey: Q} = i;
    const g = geo(i);
    const random = rng(`${i.seed}#hawk`);
    const {lp, lq, mouth} = g;
    const ground = (x: number, z: number) => i.ground(x, z);
    const aloft = P.base > ground(P.x, P.z) + 1;
    const vp = clamp(lp * 14, 3.5, 17);
    const vq = clamp(lq * 9, 1.0, 5);
    const turn = clamp(7 / Math.pow(Math.max(lp, 0.05), 0.3), 4, 9);
    const preyH = Math.max(Q.base, ground(Q.x, Q.z), 0) + clamp(1 + lq * 10, 1.2, 3);
    const start = {x: Q.x - g.dir.x * Math.min(g.D, 14), z: Q.z - g.dir.z * Math.min(g.D, 14)};
    const y0 = aloft ? P.base : Math.max(P.base, ground(start.x, start.z) + 0.4);
    const side = random() < 0.5 ? -1 : 1;
    const phase = random() * 6.28;
    const tReady = aloft ? 0.3 : 0.6;
    const pq = {x: Q.x, z: Q.z, y: preyH, yaw: g.face + side * 0.8};
    const pp = {x: start.x, z: start.z, y: y0, yaw: g.face, v: aloft ? vp * 0.6 : 0};
    const pred: HuntSample[] = [];
    const prey: HuntSample[] = [];
    let tc = -1;
    let tMiss = -1;
    let jinkYaw = 0;
    const gapNeed = i.miss ? i.gap * 1.15 : mouth + lq * 0.3;
    const limit = 9;
    for (let k = 0; k * DT < limit + 4; k++) {
        const t = k * DT;
        // The prey: a weaving flight at its own pace.
        const weave = Math.sin((t * 6.28) / 1.15 + phase) * 0.9 + Math.sin((t * 6.28) / 0.47 + phase * 2) * 0.35;
        const striking = tMiss >= 0;
        pq.yaw = striking && t - tMiss < 0.5 ? jinkYaw : g.face + side * 0.5 + weave;
        const vqNow = vq * (striking ? 1.8 : 1);
        pq.x += Math.sin(pq.yaw) * vqNow * DT;
        pq.z += Math.cos(pq.yaw) * vqNow * DT;
        pq.y = Math.max(preyH + Math.sin(t * 2.3 + phase) * 0.4, ground(pq.x, pq.z) + 0.5);
        // The hunter: sits, then darts out and turns after it.
        let state = "fly";
        let pitch = 0;
        const d3 = Math.hypot(pq.x - pp.x, pq.z - pp.z, pq.y - pp.y);
        if (t < tReady) {
            state = aloft ? "fly" : "perch";
        } else if (tc < 0 && tMiss < 0) {
            const lag = Math.min(d3 / Math.max(vp, 0.1), 0.5);
            const wantYaw = heading(pq.x + Math.sin(pq.yaw) * vqNow * lag - pp.x, pq.z + Math.cos(pq.yaw) * vqNow * lag - pp.z);
            pp.yaw = steer(pp.yaw, wantYaw, turn * (t > 4.5 ? 2 : 1) * DT);
            // (Not to be shaken off: after a few seconds it is faster and turns tighter, so the chase always closes.)
            const boost = t > 4.5 ? 1 + (t - 4.5) * 0.9 : 1;
            pp.v = Math.min(pp.v + vp * 6 * DT, vp * boost);
            pp.x += Math.sin(pp.yaw) * pp.v * DT;
            pp.z += Math.cos(pp.yaw) * pp.v * DT;
            const wantY = pq.y;
            pp.y += clamp(wantY - pp.y, -vp * 0.8 * DT, vp * 0.8 * DT);
            pp.y = Math.max(pp.y, ground(pp.x, pp.z) + 0.3);
            pitch = clamp(Math.atan2(pp.y - wantY, Math.max(Math.hypot(pq.x - pp.x, pq.z - pp.z), 0.2)) * 0.6, -0.5, 0.6);
            state = d3 < lp * 3 ? "strike" : t - tReady < 0.35 ? "takeoff" : "fly";
            if (d3 <= gapNeed + 0.02 || t > limit) {
                if (i.miss) {
                    tMiss = t;
                    jinkYaw = pq.yaw + side * 1.6;
                } else tc = t;
            }
        } else {
            // A catch ends here. A miss: it flies on past, banks and turns away.
            const after = t - (tc >= 0 ? tc : tMiss);
            pp.v = vp * Math.max(1 - after / 1.5, 0.25);
            pp.yaw += side * -0.5 * DT * Math.min(after, 1.5);
            pp.x += Math.sin(pp.yaw) * pp.v * DT;
            pp.z += Math.cos(pp.yaw) * pp.v * DT;
            pp.y = Math.max(pp.y + Math.sin(after * 2) * 0.01, ground(pp.x, pp.z) + 0.3);
            state = "fly";
        }
        // (A miss: held off by the gap in the air too.)
        if (i.miss) {
            const dx = pp.x - pq.x;
            const dy = pp.y - pq.y;
            const dz = pp.z - pq.z;
            const dd = Math.hypot(dx, dy, dz);
            if (dd < i.gap && dd > 1e-6) {
                pp.x = pq.x + (dx / dd) * i.gap;
                pp.y = pq.y + (dy / dd) * i.gap;
                pp.z = pq.z + (dz / dd) * i.gap;
            }
        }
        pred.push({x: pp.x, z: pp.z, y: pp.y, yaw: pp.yaw, v: 0, state, pitch});
        prey.push({x: pq.x, z: pq.z, y: pq.y, yaw: pq.yaw, v: 0, state: "fly", pitch: 0});
        const done = i.miss ? tMiss >= 0 && t - tMiss > 2.2 : tc >= 0;
        if (done) break;
    }
    const tEnd = (pred.length - 1) * DT;
    const tHit = tc >= 0 ? tc : tMiss >= 0 ? tMiss : tEnd;
    // (Held to its sampled run: the shared finishing wants poses of a time.)
    const at = (list: HuntSample[]): At => (t) => {
        const f = clamp(t / DT, 0, list.length - 1);
        const a = list[Math.floor(f)];
        const b = list[Math.min(Math.floor(f) + 1, list.length - 1)];
        const u = f - Math.floor(f);
        return {x: lerp(a.x, b.x, u), z: lerp(a.z, b.z, u), y: lerp(a.y, b.y, u), yaw: a.yaw + wrap(b.yaw - a.yaw) * u, state: a.state, pitch: lerp(a.pitch, b.pitch, u)};
    };
    // (A catch's puff is the last of the run, at the catch: the stage times it from there.)
    const hitAt = prey[Math.min(Math.round(tHit / DT), prey.length - 1)];
    const puffs: Puff[] = [{x: hitAt.x, y: hitAt.y, z: hitAt.z, size: Math.max(lq * 1.2, 0.03), kind: "dust"}];
    return finish(i, "swoop", Math.min(i.miss ? tEnd : tHit, tEnd), tHit, Math.max(tReady, 0), at(pred), at(prey), {turnP: 30, turnQ: 30, air: true, airQ: true, puffs, startYaw: P.yaw});
}

// MARK: The entry

/**
 * The act's run, or null (the generic chase): a builder that finds the way blocked or the pair the wrong shape draws
 * nothing of its own.
 */
export function huntRun(i: HuntInput): HuntRun | null {
    switch (i.act) {
        case "pounce":
        case "leap":
        case "jump":
            return runPounce(i, i.act);
        case "dash":
        case "lunge":
        case "tongue":
        case "web":
            return runSit(i, i.act);
        case "wade":
            return runWade(i);
        case "peck":
            return runPeck(i);
        case "lurk":
            return runLurk(i);
        case "drop":
        case "hover":
        case "plunge":
        case "talon":
            return runAir(i, i.act);
        case "hawk":
            return runHawk(i);
        default:
            return null;
    }
}
