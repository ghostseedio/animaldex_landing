/**
 * The server's matings in the live world (owner 2026-11-15: "we need the animals mating in 3d, they need to physically
 * go to each other and mate"; then: "they mount the back and it lasts a long time ... sometimes mating is not
 * successful ... sometimes there's chasing first or peacocks may try to fan its feathers"). Each `mated` event of the
 * record is acted out on the shared clock from the event's time, the same for every viewer:
 *
 *   walk      both walk to each other until they meet;
 *   court     the species' own courtship: a display (the male fans, puffs, raises its crest), a dance together
 *             (cranes, grebes), or, with neither in its recipes, a chase (she trots off, he follows close behind);
 *   mount     he mounts her from behind (mammals rear up over her back, birds step onto it, reptiles and insects
 *             climb on low, fish and snakes lie alongside), and it lasts with the body: a bird's is brief, an
 *             elephant's long. Before the one that takes, sometimes a try or two fail: she walks on and he slides off;
 *   after     the two rest together a little;
 *   part      each walks back to where its day has it now.
 *
 * The scene never decides a mating: a pair comes only from the record (`voyage_events` kind `mated`, its two
 * animals); the failed tries before it are part of its acting, the same for every viewer (from the event's key).
 * Two animals in different worlds (the town and the wild) or very far apart are not walked across the Ark. The rigs
 * have no mating clip: a mount is the body's pose (its place, height and pitch), the legs keep their standing clip.
 *
 * Like the live meals (`live-meals.ts`), the scene gives it its entries through a host and this layer only says, per
 * frame, which act pose each of them takes (`entry.act`), so nothing here touches the renderer.
 */

import type {ActPose} from "@/ark-scene/acts";

/** A mating from the record: its two animals and when it happened (s, the shared clock). */
export type MatingAct = {key: string; a: string; b: string; t0: number};

/** How a species courts before mating (its recipes say display or dance; otherwise he chases her). */
export type Courtship = "chase" | "display" | "dance";
/** How the body mounts: rear up over her back, step onto it (birds), climb on low, or lie alongside. */
export type MountKind = "mount" | "perch" | "low" | "alongside";

export type LiveMatingsHost<E> = {
    /** A living animal's entry. */
    find: (id: string) => E | null;
    /** Its schedule's place at a time (pure in the time); null off the schedule. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; y: number; yaw: number; doing: string; aloft: boolean} | null;
    ground: (x: number, z: number) => number;
    /** Its walking pace (m/s). */
    walk: (entry: E) => number;
    /** Its drawn body length and height (m). */
    length: (entry: E) => number;
    height: (entry: E) => number;
    /** Its rig's body plan (quadruped, flying_bird, fish…), or null. */
    plan: (entry: E) => string | null;
    /** Its species' courtship from its recipes (display or dance), or null. */
    courtship: (entry: E) => Courtship | null;
    /** Its drawn sex (true male, false female, null neither). */
    male: (entry: E) => boolean | null;
    /** Whether the two live in the same world (both in the town, or both in the wild). */
    together: (a: E, b: E) => boolean;
    setAct: (entry: E, pose: ActPose | null) => void;
    /** Held by something else now (a replay's act, a meal, a moment): left alone. */
    busy: (entry: E) => boolean;
    /** How its species' rival males contest (its recipes: antlers or horns clash, boxing, wrestling), or null. */
    contest?: (entry: E) => ContestKind | null;
    /** A rival for the male before this mating: a real male of his kind near him at the time (not the female), or null. */
    rival?: (male: E, female: E, epoch: number) => E | null;
};

/**
 * A contest before a mating (handover §5, "males fight each other"; decision 369): where the species' rival males
 * contest and a real male of the kind is near, he challenges first; the two spar, the rival gives way and runs off,
 * and the mating goes on as the record has it. Acting only: the record's pair is the pair (the engine has no sexes,
 * so the record's male always wins), and with no rival near there is no contest.
 */
export type ContestKind = "clash" | "box" | "wrestle";
export type ContestScript = {
    kind: ContestKind;
    centre: Point;
    /** Unit vector from the male's side to the rival's, and its yaw. */
    axis: Point;
    yaw: number;
    /** Half the distance between the two when they are locked. */
    half: number;
    from: {m: Point; r: Point};
    walk: number;
    bouts: number;
    /** The rival runs off to here, until `end`. */
    away: Point;
    end: number;
    /** Where the male stands when it is over (the mating starts from here). */
    mEnd: Point;
};

const CONTEST_WALK_MAX = 20;
const CONTEST_BOUTS = 14;
const CONTEST_FLEE = 5;
/** A rival farther than this from the male (m) does not come. */
export const CONTEST_MAX_APART = 45;

/** The contest's script from the two males' places at its start. Pure. */
export function contestScript(male: Point & {length: number; pace: number}, rival: Point & {length: number; pace: number}, kind: ContestKind, key: string): ContestScript | null {
    const d = Math.hypot(rival.x - male.x, rival.z - male.z);
    if (!(d <= CONTEST_MAX_APART) || d < 0.01) return null;
    const axis = {x: (rival.x - male.x) / d, z: (rival.z - male.z) / d};
    // They meet nearer the male (it is his ground): a third of the way to the rival.
    const centre = add(male, axis, d / 3);
    const half = Math.max((male.length + rival.length) * 0.27, 0.05);
    const walk = clamp(Math.max(d / 3 / Math.max(male.pace, 0.3), (d * 2) / 3 / Math.max(rival.pace * 1.6, 0.3)), 2, CONTEST_WALK_MAX);
    const bouts = CONTEST_BOUTS + Math.round(unit(`${key}:bouts`) * 8);
    const run = Math.max(rival.length * 6, 10);
    const away = add(centre, axis, half + run);
    return {kind, centre, axis, yaw: yawOf(axis), half, from: {m: {x: male.x, z: male.z}, r: {x: rival.x, z: rival.z}}, walk, bouts, away, end: walk + bouts + CONTEST_FLEE, mEnd: add(centre, axis, -half)};
}

/** One of the two rivals' pose `s` seconds into the contest (`isMale`: the one that mates). Pure. */
export function contestPose(c: ContestScript, isMale: boolean, s: number, ground: (x: number, z: number) => number, otherId: string): ActPose | null {
    if (s < 0 || s >= c.end) return null;
    const sign = isMale ? -1 : 1;
    const face = isMale ? c.yaw : c.yaw + Math.PI;
    const mk = (p: Point, yaw: number, state: string, speed = 0, pitch = 0): ActPose => ({x: p.x, z: p.z, base: ground(p.x, p.z), yaw, pitch, roll: 0, scale: 1, dim: 0, hidden: false, state, speed, with: otherId});
    const locked = add(c.centre, c.axis, sign * c.half);
    if (s < c.walk) {
        const from = isMale ? c.from.m : c.from.r;
        const k = ease(s / c.walk);
        const d = Math.hypot(locked.x - from.x, locked.z - from.z);
        return mk(lerpP(from, locked, k), d > 0.05 ? yawTo(from, locked) : face, isMale ? "walk" : "run", d / c.walk);
    }
    const t = s - c.walk;
    if (t < c.bouts) {
        if (c.kind === "clash") {
            // Back off, then come together head to head: one clash every 2.6 s.
            const u = (t % 2.6) / 2.6;
            const apart = u < 0.55 ? ease(u / 0.55) : 1 - ease((u - 0.55) / 0.2);
            const back = c.half * 1.3 * Math.max(apart, 0);
            const hit = u >= 0.75;
            return mk(add(locked, c.axis, sign * back), face, hit ? "clash" : u < 0.55 ? "walk" : "run", hit ? 0 : c.half, hit ? 0.12 : 0);
        }
        if (c.kind === "box") return mk(add(locked, c.axis, sign * c.half * 0.15 * Math.sin(t * 5 + (isMale ? 0 : 1.7))), face, "box", 0, -0.35 + 0.06 * Math.sin(t * 7));
        // Wrestle: locked together, turning slowly about the middle, heaving.
        const turn = t * 0.35;
        const ax = {x: c.axis.x * Math.cos(turn) + c.axis.z * Math.sin(turn), z: c.axis.z * Math.cos(turn) - c.axis.x * Math.sin(turn)};
        const heave = c.half * 0.12 * Math.sin(t * 3.1);
        return mk(add(c.centre, ax, sign * (c.half * 0.85 + (isMale ? heave : -heave))), yawOf(ax) + (isMale ? 0 : Math.PI), "fight");
    }
    // Over: the rival turns and runs; the male watches it go.
    const f = (t - c.bouts) / CONTEST_FLEE;
    if (isMale) return mk(locked, face, "scan");
    const d = Math.hypot(c.away.x - locked.x, c.away.z - locked.z);
    return mk(lerpP(locked, c.away, ease(f)), c.yaw, "run", d / CONTEST_FLEE);
}

/** Farther apart than this (m) at the start: not walked across the Ark. */
export const MATING_MAX_APART = 160;
/**
 * The longest walk to each other (s): farther pairs hurry. The log's line reaches a viewer from a few seconds to about a
 * minute after the mating's time (the release each minute, then the page's read every 45 s) and stays 15 s: with a
 * walk of up to 75 s a far pair was still apart when the line was tapped (owner 2026-11-16: "when i click a mating
 * log, i don't see 2 of its kind next to each other"). Within half a minute they have met.
 */
export const MATING_WALK_MAX = 30;
const WALK_MAX = MATING_WALK_MAX;
export const COURT_SECONDS = 10;
export const CHASE_SECONDS = 9;
const TURN = 1.2;
const APPROACH = 1.6;
const FOLLOW = 2.6;
const RISE = 1.2;
const FAILED_ON = 2.4;
const OFF = 1.2;
/**
 * How long the two rest together after the mount that takes (s). It was 8 s, and the whole act was over 30 to 110 s
 * after its time: a near pair had parted before most viewers saw the line. Resting side by side for two minutes keeps
 * them together while the line is read and tapped (same reason as `MATING_WALK_MAX`).
 */
export const MATING_AFTER_SECONDS = 120;
const AFTER = MATING_AFTER_SECONDS;
const RETURN_MIN = 4;
const RETURN_MAX = 30;
/** How long after its time a mating is still acted (s): the server's tick and the record's read come later. */
export const MATING_LIVE_SECONDS = 20 * 60;

type Point = {x: number; z: number};
export type MatingBody = Point & {pace: number; length: number; height: number; plan: string | null; courtship: Courtship | null; male: boolean | null};

export type MatingAttempt = {
    /** Where she stands for it, and the spot behind her he mounts from. */
    spot: Point;
    behind: Point;
    /** Phase starts (s after t0): he comes up behind her, rises onto her, is on, comes off; then the next. */
    approach: number;
    rise: number;
    on: number;
    off: number;
    end: number;
    took: boolean;
};

type Chase = {start: Point; dir: Point; normal: Point; radius: number; speed: number; sep0: number; sep: number};

export type MatingScript = {
    /** Whether the record's first animal is the one that mounts. */
    firstMounts: boolean;
    court: Courtship;
    mount: MountKind;
    from: {m: Point; f: Point};
    to: {m: Point; f: Point};
    walk: number;
    courted: number;
    /** Her heading through the mounts (both face it), and its unit vector. */
    heading: number;
    dir: Point;
    /** The chase's path (court = chase). */
    chase: Chase | null;
    attempts: MatingAttempt[];
    /** After the last: he lies beside her until `paired`. */
    side: Point;
    mounted: number;
    paired: number;
    m: {length: number; height: number; pace: number};
    f: {length: number; height: number; pace: number};
};

type Live<E> = {act: MatingAct; script: MatingScript | null; failed: boolean; over: boolean; acting: Set<E>; contest?: {script: ContestScript; rival: string; maleFirst: boolean} | null};

const ease = (u: number) => {
    const c = Math.min(Math.max(u, 0), 1);
    return c * c * (3 - 2 * c);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const yawOf = (d: Point) => Math.atan2(d.x, d.z);
const yawTo = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.z - from.z);
const lerpP = (p: Point, q: Point, k: number): Point => ({x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k});
const add = (p: Point, d: Point, k: number): Point => ({x: p.x + d.x * k, z: p.z + d.z * k});
/** The shorter way round from one yaw to another. */
const turnTo = (from: number, to: number, k: number) => {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return from + d * clamp(k, 0, 1);
};
/** 0..1 from a key, the same for every viewer. */
function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

/** How a body plan mounts. */
export function mountKind(plan: string | null): MountKind {
    // The scene's plan is the model's (`ark.json` behaviour.plan: mammal, bird, reptile, snake, frog, arthropod…); the
    // rig contract's names are kept too. (Fixed 2026-11-16: only the rig's names were listed, so every bird, snake,
    // lizard, frog and insect mounted like a mammal.)
    switch (plan) {
        case "bird":
        case "flying_bird":
        case "walking_bird":
        case "flightless_bird":
            return "perch";
        case "reptile":
        case "frog":
        case "arthropod":
        case "butterfly":
        case "lizard":
        case "turtle":
        case "insect":
        case "flying_insect":
        case "arachnid":
        case "crustacean":
        case "amphibian":
            return "low";
        case "snake":
        case "eel":
        case "ray":
        case "cetacean":
        case "cephalopod":
        case "jellyfish":
        case "worm":
        case "fish":
        case "legless":
        case "cephalopod_jelly":
            return "alongside";
        default:
            return "mount";
    }
}

/** How long the mount that takes lasts (s), by body: a bird's is brief, a big mammal's long, a tortoise's slow. */
export function mountSeconds(kind: MountKind, length: number): number {
    if (kind === "perch") return clamp(3 + length * 4, 3, 8);
    if (kind === "low") return clamp(10 + length * 12, 10, 40);
    if (kind === "alongside") return clamp(8 + length * 4, 8, 20);
    return clamp(6 + length * 5, 8, 40);
}

/** How many tries fail before the one that takes (0, 1 or 2), from the mating's key. */
export function failedTries(key: string): number {
    const u = unit(`${key}#tries`);
    return u < 0.5 ? 0 : u < 0.85 ? 1 : 2;
}

/** A place along the chase's path `u` metres from its start (straight behind the start, then a curve). */
function arcAt(c: Chase, u: number): {p: Point; yaw: number} {
    if (u <= 0) return {p: add(c.start, c.dir, u), yaw: yawOf(c.dir)};
    const phi = u / c.radius;
    const centre = add(c.start, c.normal, c.radius);
    const p = {
        x: centre.x - c.normal.x * c.radius * Math.cos(phi) + c.dir.x * c.radius * Math.sin(phi),
        z: centre.z - c.normal.z * c.radius * Math.cos(phi) + c.dir.z * c.radius * Math.sin(phi)
    };
    return {p, yaw: Math.atan2(c.dir.x * Math.cos(phi) + c.normal.x * Math.sin(phi), c.dir.z * Math.cos(phi) + c.normal.z * Math.sin(phi))};
}

/** The script of a mating from the two's places at its start, or null (too far apart). Pure. */
/**
 * 3.3 fix (breeding taps): the record writes a pair's `laid` with its `mated`; the clutch is laid where she stood for
 * the try that took, on her left (he rests on her right), half a body length clear of her: in the picture the pair's
 * tap frames, never where she happened to be before she walked to him.
 */
export function clutchSpot(sc: MatingScript): Point {
    const took = sc.attempts.find((a) => a.took) ?? sc.attempts[sc.attempts.length - 1];
    const at = took ? took.spot : sc.to.f;
    return add(at, {x: -sc.dir.z, z: sc.dir.x}, sc.f.length * 0.9);
}

export function matingScript(a: MatingBody, b: MatingBody, key: string): MatingScript | null {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (!(d <= MATING_MAX_APART)) return null;
    // He mounts her: the male when the look says only one is; else the record's first.
    const firstMounts = !(b.male === true && a.male !== true);
    const M = firstMounts ? a : b;
    const F = firstMounts ? b : a;
    const dir = d > 1e-6 ? {x: (F.x - M.x) / d, z: (F.z - M.z) / d} : {x: 0, z: 1};
    const mid = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
    const half = (M.length + F.length) / 2;
    // They meet nose to nose (a little under touching: the collision lane closes them to contact).
    const contact = Math.min(half * 0.45, d / 2);
    const toM = add(mid, dir, -contact);
    const toF = add(mid, dir, contact);
    const pace = Math.max(Math.min(M.pace, F.pace), 0.3);
    const walk = clamp(Math.max(Math.hypot(toM.x - M.x, toM.z - M.z), Math.hypot(toF.x - F.x, toF.z - F.z)) / pace, 2, WALK_MAX);
    const mount = mountKind(M.plan ?? F.plan);
    const court: Courtship = M.courtship ?? F.courtship ?? (mount === "perch" ? "display" : "chase");
    // After the courtship: where she stands and which way, with him behind her.
    let spot = toF;
    let heading = yawOf(dir);
    let courted = walk + COURT_SECONDS + TURN;
    let chase: Chase | null = null;
    if (court === "chase") {
        chase = {start: toF, dir, normal: {x: dir.z, z: -dir.x}, radius: Math.max(3, F.length * 2.5), speed: clamp(pace * 2.2, 0.8, 9), sep0: contact * 2, sep: half * 1.1};
        const end = arcAt(chase, chase.speed * CHASE_SECONDS);
        spot = end.p;
        heading = end.yaw;
        courted = walk + CHASE_SECONDS;
    }
    const hd = {x: Math.sin(heading), z: Math.cos(heading)};
    const attempts: MatingAttempt[] = [];
    const tries = failedTries(key) + 1;
    let t = courted;
    let at = spot;
    for (let k = 0; k < tries; k++) {
        const took = k === tries - 1;
        const approach = t;
        const rise = approach + (k === 0 ? APPROACH : FOLLOW);
        const on = rise + RISE;
        const off = on + (took ? mountSeconds(mount, M.length) : FAILED_ON);
        const end = off + OFF;
        attempts.push({spot: at, behind: add(at, hd, -half * 0.95), approach, rise, on, off, end, took});
        t = end;
        // A try that fails: she walks on a body length (from when he slides off, through his following).
        if (!took) at = add(at, hd, F.length * 1.1);
    }
    const last = attempts[attempts.length - 1];
    // Resting together: he lies down beside her, on her right, the same way.
    const side = add(last.spot, {x: hd.z, z: -hd.x}, half * 0.4);
    return {
        firstMounts,
        court,
        mount,
        from: {m: {x: M.x, z: M.z}, f: {x: F.x, z: F.z}},
        to: {m: toM, f: toF},
        walk,
        courted,
        heading,
        dir: hd,
        chase,
        attempts,
        side,
        mounted: last.end,
        paired: last.end + AFTER,
        m: {length: M.length, height: M.height, pace: M.pace},
        f: {length: F.length, height: F.height, pace: F.pace}
    };
}

/** His place on her (k: 0 behind her, 1 on), by how the body mounts. */
export function mountPlace(sc: MatingScript, spot: Point, k: number): {p: Point; lift: number; pitch: number} {
    const {m, f, dir} = sc;
    const behind = add(spot, dir, -((m.length + f.length) / 2) * 0.95);
    let on: Point;
    let lift: number;
    let pitch: number;
    if (sc.mount === "perch") {
        on = add(spot, dir, -f.length * 0.08);
        lift = f.height * 0.55;
        pitch = 0;
    } else if (sc.mount === "low") {
        on = add(spot, dir, -(f.length * 0.2 + m.length * 0.25));
        lift = f.height * 0.45;
        pitch = -0.2;
    } else if (sc.mount === "alongside") {
        on = add(spot, {x: dir.z, z: -dir.x}, ((m.length + f.length) / 2) * 0.3);
        lift = 0;
        pitch = 0;
    } else {
        // Rearing up (nose up is a negative pitch): his chest over her hips, lifted so his hind feet stay down.
        pitch = -0.55;
        on = add(spot, dir, -(f.length * 0.3 + m.length * 0.3));
        lift = (m.length / 2) * Math.sin(-pitch);
    }
    const e = ease(k);
    return {p: lerpP(behind, on, e), lift: lift * e, pitch: pitch * e};
}

/** The act pose of one of the two at `s` seconds into the mating (`first`: the record's first animal). Pure. */
export function matingPose(script: MatingScript, first: boolean, s: number, ground: (x: number, z: number) => number, otherId: string): ActPose | null {
    if (s < 0 || s >= script.paired) return null;
    const isM = first === script.firstMounts;
    const me = isM ? script.m : script.f;
    const pose = (p: Point, yaw: number, state: string, speed = 0, extra: {lift?: number; pitch?: number} = {}, close = true): ActPose => ({
        x: p.x,
        z: p.z,
        base: ground(p.x, p.z) + (extra.lift ?? 0),
        yaw,
        pitch: extra.pitch ?? 0,
        roll: 0,
        scale: 1,
        dim: 0,
        hidden: false,
        state,
        speed,
        ...(close ? {with: otherId} : {})
    });
    const from = isM ? script.from.m : script.from.f;
    const to = isM ? script.to.m : script.to.f;
    const facing = yawTo(script.to.m, script.to.f) + (isM ? 0 : Math.PI);
    if (s < script.walk) {
        const k = ease(s / script.walk);
        const d = Math.hypot(to.x - from.x, to.z - from.z);
        const moving = d > 0.05;
        return pose(lerpP(from, to, k), moving ? yawTo(from, to) : facing, moving ? "walk" : "scan", moving ? d / script.walk : 0, {}, s > script.walk * 0.7);
    }
    // Courtship.
    if (s < script.courted) {
        const c = s - script.walk;
        if (script.chase) {
            const ch = script.chase;
            const u = ch.speed * c;
            const lag = ch.sep0 + (ch.sep - ch.sep0) * ease(c / 1.5);
            const at = arcAt(ch, isM ? u - lag : u);
            return pose(at.p, at.yaw, "walk", ch.speed);
        }
        if (c < COURT_SECONDS) return pose(to, facing, script.court === "dance" ? "dance" : isM ? "display" : "scan");
        // She turns to show him her back; he waits.
        if (isM) return pose(to, facing, "scan");
        return pose(to, turnTo(facing, script.heading, ease((c - COURT_SECONDS) / TURN)), "walk", 0.3);
    }
    // The mounts.
    for (let i = 0; i < script.attempts.length; i++) {
        const at = script.attempts[i];
        if (s >= at.end) continue;
        const next = script.attempts[i + 1];
        if (!isM) {
            // She stands for it (a bird crouches); after a try that fails she walks on to where the next one is.
            if (s >= at.off && !at.took && next) {
                const k = ease((s - at.off) / (next.rise - at.off));
                return pose(lerpP(at.spot, next.spot, k), script.heading, "walk", me.pace);
            }
            if (s >= at.on && !at.took) {
                // She does not stand for it: she starts to move off under him.
                const k = ease((s - at.on) / FAILED_ON) * 0.25;
                return pose(lerpP(at.spot, next ? next.spot : at.spot, k), script.heading, "walk", me.pace * 0.5);
            }
            return pose(at.spot, script.heading, script.mount === "perch" && s >= at.rise ? "rest" : "scan");
        }
        if (s < at.rise) {
            // Up behind her: from where he is (the courtship's end, or off the try before).
            const start = i > 0 ? script.attempts[i - 1].behind : script.chase ? arcAt(script.chase, script.chase.speed * CHASE_SECONDS - script.chase.sep).p : script.to.m;
            const k = ease((s - at.approach) / (at.rise - at.approach));
            const moving = Math.hypot(at.behind.x - start.x, at.behind.z - start.z) > 0.05 && k < 1;
            return pose(lerpP(start, at.behind, k), moving ? yawTo(start, at.behind) : script.heading, moving ? "walk" : "scan", moving ? me.pace : 0);
        }
        if (s < at.on) {
            const m = mountPlace(script, at.spot, (s - at.rise) / RISE);
            return pose(m.p, script.heading, "walk", 0.2, m);
        }
        if (s < at.off) {
            // On her: a steady rhythm (forward and back a little, and the nose). A try that fails slips as she moves.
            const slip = at.took || !next ? 0 : ease((s - at.on) / FAILED_ON) * 0.25;
            const spot = next && !at.took ? lerpP(at.spot, next.spot, slip) : at.spot;
            const m = mountPlace(script, spot, 1 - slip);
            const beat = Math.sin((s - at.on) * Math.PI * 2 * 1.6);
            const push = script.mount === "mount" || script.mount === "low" ? me.length * 0.035 * beat : 0;
            return pose(add(m.p, script.dir, push), script.heading, "scan", 0, {lift: m.lift, pitch: m.pitch + (script.mount === "perch" ? 0.08 : 0.04) * beat});
        }
        // Off again, back behind where she stood.
        const m = mountPlace(script, at.spot, 1 - (s - at.off) / OFF);
        return pose(m.p, script.heading, "walk", 0.2, m);
    }
    // Resting together: he steps round beside her (a couple of seconds), then both lie, the same way.
    const last = script.attempts[script.attempts.length - 1];
    const r = s - script.mounted;
    if (!isM) return pose(last.spot, script.heading, r < 2 ? "scan" : "rest");
    const k = ease(r / 2);
    if (k < 1) return pose(lerpP(last.behind, script.side, k), yawTo(last.behind, script.side), "walk", Math.hypot(script.side.x - last.behind.x, script.side.z - last.behind.z) / 2);
    return pose(script.side, script.heading, "rest");
}

export class LiveMatings<E> {
    private matings: Live<E>[] = [];

    /** A rival entry's id (the host's entries are opaque here). */
    private readonly rivalId?: (entry: E) => string;

    constructor(private readonly host: LiveMatingsHost<E>, rivalId?: (entry: E) => string) {
        this.rivalId = rivalId;
    }

    /** New matings from the record (one already known is kept as it is); those long over are forgotten. */
    add(acts: MatingAct[], epoch: number): void {
        const known = new Set(this.matings.map((m) => m.act.key));
        for (const act of acts) {
            if (!Number.isFinite(act.t0) || known.has(act.key) || act.a === act.b) continue;
            if (epoch - act.t0 > MATING_LIVE_SECONDS) continue;
            this.matings.push({act, script: null, failed: false, over: false, acting: new Set(), contest: undefined});
            known.add(act.key);
        }
        this.matings.sort((x, y) => x.act.t0 - y.act.t0);
    }

    clear(): void {
        for (const m of this.matings) this.release(m);
        this.matings = [];
    }

    get size(): number {
        return this.matings.length;
    }

    /** Every id a mating under way names now (drawn one by one, never as a herd's figure). */
    pins(): string[] {
        const out: string[] = [];
        for (const m of this.matings) if (m.acting.size) out.push(m.act.a, m.act.b, ...(m.contest ? [m.contest.rival] : []));
        return out;
    }

    /**
     * The other of a mating under way now that names `id` (its two are being acted: walking to each other, courting,
     * mounting, resting together or walking apart), for the log's tap to frame both; null when none is (over, not
     * started, skipped). The newest such mating when there are several.
     */
    /** 3.3 fix (breeding taps): where her clutch is laid while the pair's mating is acted (`clutchSpot`), or null. */
    clutchSpotOf(id: string): Point | null {
        for (let i = this.matings.length - 1; i >= 0; i--) {
            const m = this.matings[i];
            if (!m.acting.size || m.over || m.failed || !m.script) continue;
            if (m.act.a === id || m.act.b === id) return clutchSpot(m.script);
        }
        return null;
    }

    partnerOf(id: string): string | null {
        for (let i = this.matings.length - 1; i >= 0; i--) {
            const m = this.matings[i];
            if (!m.acting.size || m.over || m.failed) continue;
            if (m.act.a === id) return m.act.b;
            if (m.act.b === id) return m.act.a;
        }
        return null;
    }

    private release(m: Live<E>): void {
        m.acting.forEach((e) => this.host.setAct(e, null));
        m.acting.clear();
    }

    private body(entry: E, at: Point): MatingBody {
        const h = this.host;
        return {x: at.x, z: at.z, pace: h.walk(entry), length: h.length(entry), height: h.height(entry), plan: h.plan(entry), courtship: h.courtship(entry), male: h.male(entry)};
    }

    /** One frame at `epoch` (s, the shared clock): every mating under way poses its two. */
    step(epoch: number): void {
        const h = this.host;
        for (const m of this.matings) {
            if (m.over || m.failed) continue;
            const s = epoch - m.act.t0;
            if (s < 0) continue;
            const a = h.find(m.act.a);
            const b = h.find(m.act.b);
            if (!a || !b) {
                if (m.acting.size) this.release(m);
                continue;
            }
            if (m.contest === undefined) {
                // A rival first, where the species' males contest and one is near (decided once, from the time's places).
                m.contest = null;
                const maleFirst = !(h.male(b) === true && h.male(a) !== true);
                const male = maleFirst ? a : b;
                const female = maleFirst ? b : a;
                const kind = h.together(a, b) ? h.contest?.(male) ?? null : null;
                const rival = kind ? h.rival?.(male, female, m.act.t0) ?? null : null;
                const pm = rival ? h.scheduleAt(male, m.act.t0) : null;
                const pr = rival ? h.scheduleAt(rival, m.act.t0) : null;
                const id = rival ? this.rivalId?.(rival) ?? null : null;
                if (kind && rival && pm && pr && id && !pm.aloft && !pr.aloft) {
                    const script = contestScript({x: pm.x, z: pm.z, length: h.length(male), pace: h.walk(male)}, {x: pr.x, z: pr.z, length: h.length(rival), pace: h.walk(rival)}, kind, m.act.key);
                    if (script) m.contest = {script, rival: id, maleFirst};
                }
            }
            const lead = m.contest ? m.contest.script.end : 0;
            if (m.contest && s < lead) {
                const c = m.contest;
                const male = c.maleFirst ? a : b;
                const rival = h.find(c.rival);
                const acting = new Set<E>();
                const put = (entry: E | null, act: ActPose | null) => {
                    if (!entry || !act || h.busy(entry)) return;
                    h.setAct(entry, act);
                    acting.add(entry);
                };
                put(male, contestPose(c.script, true, s, h.ground, c.rival));
                put(rival, contestPose(c.script, false, s, h.ground, c.maleFirst ? m.act.a : m.act.b));
                m.acting.forEach((e) => {
                    if (!acting.has(e)) h.setAct(e, null);
                });
                m.acting = acting;
                continue;
            }
            if (!m.script) {
                if (!h.together(a, b)) {
                    m.failed = true;
                    continue;
                }
                // (After a contest the male starts from where it ended, and she from where her day has her by then.)
                const at = (entry: E, first: boolean) => {
                    const c = m.contest;
                    if (c && first === c.maleFirst) return c.script.mEnd;
                    return h.scheduleAt(entry, m.act.t0 + lead);
                };
                const pa = at(a, true);
                const pb = at(b, false);
                const script = pa && pb ? matingScript(this.body(a, pa), this.body(b, pb), m.act.key) : null;
                if (!script) {
                    m.failed = true;
                    continue;
                }
                m.script = script;
            }
            const sc = m.script;
            const sM = s - lead;
            const acting = new Set<E>();
            const pose = (entry: E, act: ActPose | null) => {
                if (!act || h.busy(entry)) return;
                h.setAct(entry, act);
                acting.add(entry);
            };
            if (sM < sc.paired) {
                pose(a, matingPose(sc, true, sM, h.ground, m.act.b));
                pose(b, matingPose(sc, false, sM, h.ground, m.act.a));
            } else {
                // Part: each back to where its day has it now.
                const last = sc.attempts[sc.attempts.length - 1];
                const back = (entry: E, from: Point, pace: number) => {
                    const now = h.scheduleAt(entry, epoch);
                    if (!now) return null;
                    const d = Math.hypot(now.x - from.x, now.z - from.z);
                    const seconds = Math.min(Math.max(d / Math.max(pace, 0.3), RETURN_MIN), RETURN_MAX);
                    const k = (sM - sc.paired) / seconds;
                    if (k >= 1) return null;
                    const e = ease(k);
                    const x = from.x + (now.x - from.x) * e;
                    const z = from.z + (now.z - from.z) * e;
                    return {x, z, base: h.ground(x, z), yaw: d > 0.05 ? Math.atan2(now.x - from.x, now.z - from.z) : now.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: k < 0.12 ? "rest" : "walk", speed: k < 0.12 ? 0 : d / seconds} satisfies ActPose;
                };
                const ba = back(a, sc.firstMounts ? sc.side : last.spot, sc.firstMounts ? sc.m.pace : sc.f.pace);
                const bb = back(b, sc.firstMounts ? last.spot : sc.side, sc.firstMounts ? sc.f.pace : sc.m.pace);
                pose(a, ba);
                pose(b, bb);
                if (!ba && !bb) m.over = true;
            }
            m.acting.forEach((e) => {
                if (!acting.has(e)) h.setAct(e, null);
            });
            m.acting = acting;
        }
        this.matings = this.matings.filter((m) => !(m.over || m.failed) || m.acting.size > 0 || epoch - m.act.t0 < MATING_LIVE_SECONDS);
    }

    /** (`meet`, `courted`, `mounted`, `end`: s after `t0`, a contest's lead included: when the two meet, when the mounts begin and end, when they part.) */
    debug(): Array<{key: string; t0: number; phase: string; court?: Courtship; mount?: MountKind; tries?: number; paired?: number; contest?: ContestKind; rival?: string; contestEnd?: number; meet?: number; courted?: number; mounted?: number; end?: number}> {
        return this.matings.map((m) => ({
            key: m.act.key,
            t0: m.act.t0,
            phase: m.failed ? "skipped" : m.over ? "over" : m.script ? "acting" : "waiting",
            ...(m.script ? {court: m.script.court, mount: m.script.mount, tries: m.script.attempts.length, paired: Math.round(m.script.paired), meet: (m.contest?.script.end ?? 0) + m.script.walk, courted: (m.contest?.script.end ?? 0) + m.script.courted, mounted: (m.contest?.script.end ?? 0) + m.script.mounted, end: (m.contest?.script.end ?? 0) + m.script.paired} : {}),
            ...(m.contest ? {contest: m.contest.script.kind, rival: m.contest.rival, contestEnd: Math.round(m.contest.script.end)} : {})
        }));
    }
}
