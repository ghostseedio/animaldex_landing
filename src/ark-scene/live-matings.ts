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
 *
 * V1, matings you can read (a tapped mating line of a pair the layer skipped showed one animal, or two far apart):
 *   - a pair farther apart than `MATING_MAX_APART` is no longer skipped: the one that mounts is simply nearer when
 *     the act starts (`MATING_FAR_FROM` from her, on the line from where his day had him) and walks to her from there;
 *   - a pair with no day to walk from (a zoo house's, a tank's, a cage's or a room's residents: the scene draws each
 *     where it lives) is acted where she is (`housed`): the two come together between their places when those are near
 *     (one enclosure), a courtship without a chase (nothing leaves the enclosure), one mount, the two together; when
 *     they live apart (two homes' tanks, two vivariums: each little longer than its animal) he is brought to her side
 *     (in from small, as an arrival) and the two lie side by side where she is, he displaying, then both at rest:
 *     no walk and no mount, which would take one of them out through the glass; then each is back where it lives.
 * Still skipped: two in different worlds (the town and the wild), and one of them in the air.
 */

import type {ActPose} from "@/ark-scene/acts";
import {reproAct, reproFx, reproPlan, reproPose, staysPut, type FxEmitter, type Repro, type ReproPlan} from "@/ark-scene/repro";

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
    /** V1: where it is drawn now when it has no day (a zoo house's, a tank's, a cage's or a room's resident), or null. */
    placeOf?: (entry: E) => {x: number; z: number; yaw: number; base: number; /** ARK-MATING-SHOWN: not in an enclosure, only off any day (a small animal on its wall, its flower, its leaf). */ free?: boolean} | null;
    /** ARK-MATING-SHOWN: whether it flies (a free one flies to her; one that crawls goes by the ground). */
    flies?: (entry: E) => boolean;
    /**
     * ARK-MATING-SHOWN (decision 416): whether a pair can be SEEN meeting at a spot: nothing drawn solid over it (a
     * bridge, a roof, a deck; trees are left out, a shot dissolves them) and, for a pair of land animals (`wet` false),
     * dry ground, not a river's or a pond's bed. Absent: anywhere is.
     */
    clear?: (p: Point, wet: boolean) => boolean;
    /** REAL-REPRODUCTION: nothing at all overhead there (a rail, a hedge, a roof too). */
    open?: (p: Point) => boolean;
    /** REAL-REPRODUCTION: whether one could walk straight from one to the other (no fence or wall across). */
    between?: (a: Point, b: Point) => boolean;
    /** REAL-REPRODUCTION (decision 440): its kind's way of breeding (`repro.ts` reproOf), or null: it mates. */
    repro?: (entry: E) => Repro | null;
    /** REAL-REPRODUCTION: where others of its kind are near it now (they spawn with it on its spawning night). */
    kinSpots?: (entry: E) => Point[];
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

/** Farther apart than this (m) at the start: not walked across the Ark (V1: the one that mounts starts `MATING_FAR_FROM` from her). */
export const MATING_MAX_APART = 160;
export const MATING_FAR_FROM = 60;
/**
 * ARK-MATING-SHOWN (decision 416: "the two partners visibly move to each other, from where each was"): a far pair is no
 * longer started nearer (`MATING_FAR_FROM` was a jump of hundreds of metres): both walk the whole way, hurrying at up to
 * this speed (m/s) when half a minute is too short.
 */
export const FAR_SPEED = 8;
/**
 * V1: a housed pair's places within this (m) are one enclosure: the two come together between them. Farther (two
 * homes' tanks, two vivariums): he is brought to her side, this share of their two lengths from her middle, heading
 * as she does, and the two stay so (`beside`).
 */
export const HOUSED_NEAR = 9;
const HOUSED_BEHIND = 0.2;
const HOUSED_BESIDE = 0.07;
/**
 * V1: a housed pair is acted close: its spacings (how far apart they meet, where he comes up behind her, where he
 * rests beside her) are worked out for bodies this share of their length. A vivarium is little longer than its snake
 * and a cage than its bird; at full spacing he was out through the glass. They overlap, as two in one box do.
 */
const HOUSED_COMPACT = 0.4;
/** V1: a housed pair's coming together lasts at least this long (s). */
const HOUSED_WALK_LEAST = 22;
/** V1: a housed pair rests together this long (s): an enclosure's two are near each other anyway. */
const HOUSED_AFTER = 40;
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
/** REAL-REPRODUCTION: others of its kind drawn spawning with a pair on its spawning night, at most. */
const KIN_MOST = 10;

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

type Live<E> = {act: MatingAct; script: MatingScript | null; failed: boolean; over: boolean; acting: Set<E>; contest?: {script: ContestScript; rival: string; maleFirst: boolean} | null; /** V1: how it was brought about (`far`: he started nearer; `housed`: in their enclosure; `brought`: he was brought beside her), the floor a housed pair stands on, and who was brought. */ how?: "far" | "housed" | "brought" | "free"; floor?: (x: number, z: number) => number; brought?: "a" | "b" | null; /** REAL-REPRODUCTION: the act of the kind's own way (no mount), and its kin's spots. */ repro?: ReproPlan | null; kin?: Point[]; /** V1 (brought): where she lives and where he lies beside her, both heading as she does. */ beside?: {she: Point; he: Point; yaw: number}};

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
        case "mammal":
        case "quadruped":
        case "primate":
        case "bat":
        case null:
            return "mount";
        default:
            // REAL-REPRODUCTION (decision 440): no mammal's mount for anything that is not a mammal. The rig's "other"
            // (snails, slugs, worms, stars, sponges...) and any plan not named here lie alongside.
            return "alongside";
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

/**
 * ARK-MATING-SHOWN (decision 416): where a pair meet, so that the meeting can be seen. Their midpoint when it is clear;
 * else the nearest clear spot on the line between them (she is where she is, he comes: from the middle out), then her
 * place, his, then rings round the midpoint out to `MEET_SEARCH` of their lengths (eight bearings a ring, nearest
 * first). Null: nowhere clear near (the midpoint is kept). Pure.
 */
export const MEET_SEARCH = 24;
export function meetingSpot(a: Point, b: Point, half: number, clear: (p: Point) => boolean): Point | null {
    const mid = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
    if (clear(mid)) return mid;
    for (const k of [0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9, 0, 1]) {
        const p = lerpP(a, b, k);
        if (clear(p)) return p;
    }
    const step = Math.max(half, 0.3);
    for (let r = step; r <= step * MEET_SEARCH; r *= 1.6) {
        for (let i = 0; i < 8; i++) {
            const p = {x: mid.x + Math.sin((i * Math.PI) / 4) * r, z: mid.z + Math.cos((i * Math.PI) / 4) * r};
            if (clear(p)) return p;
        }
    }
    return null;
}

export function matingScript(a: MatingBody, b: MatingBody, key: string, options: {/** V1: in an enclosure: a courtship in place (no chase), one mount, a shorter rest. */ housed?: boolean; /** ARK-MATING-SHOWN: where a meeting can be seen (`LiveMatingsHost.clear`). */ clear?: (p: Point) => boolean; /** ARK-MATING-SHOWN: a pair farther apart than `MATING_MAX_APART` walks (hurries) all the way, at up to `FAR_SPEED`. */ far?: boolean; /** ARK-MATING-SHOWN: they meet at her place (a small animal on its own surface: he comes to her). */ atHer?: boolean} = {}): MatingScript | null {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (!(d <= MATING_MAX_APART) && !(options.far && Number.isFinite(d))) return null;
    // He mounts her: the male when the look says only one is; else the record's first.
    const firstMounts = !(b.male === true && a.male !== true);
    const M = firstMounts ? a : b;
    const F = firstMounts ? b : a;
    const half = (M.length + F.length) / 2;
    // (ARK-MATING-SHOWN: they meet where it can be seen: not under a bridge, not on a river's bed.)
    const meet = options.atHer ? {x: F.x, z: F.z} : options.clear && !options.housed ? meetingSpot(a, b, half, options.clear) : null;
    const mid = meet ?? {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
    // (Facing: along the line between them; when they meet off it, from where he comes.)
    const dm = Math.hypot(mid.x - M.x, mid.z - M.z);
    const dir = meet && dm > 1e-6 && Math.abs(dm - d / 2) > 1e-6 ? {x: (mid.x - M.x) / dm, z: (mid.z - M.z) / dm} : d > 1e-6 ? {x: (F.x - M.x) / d, z: (F.z - M.z) / d} : {x: 0, z: 1};
    // They meet nose to nose (a little under touching: the collision lane closes them to contact).
    const contact = meet ? half * 0.45 : Math.min(half * 0.45, d / 2);
    // (V1, housed: side by side a little, so two of one pattern in one box read as two: head on they lay one over the other.)
    const aside = options.housed ? half * 0.25 : 0;
    const toM = add(add(mid, dir, -contact), {x: dir.z, z: -dir.x}, aside);
    const toF = add(add(mid, dir, contact), {x: dir.z, z: -dir.x}, -aside);
    const pace = Math.max(Math.min(M.pace, F.pace), 0.3);
    // (V1: a housed pair comes together slowly: its line reaches a viewer from twenty seconds to a minute after its time,
    // and a walk of two seconds across a tank had the courtship over before anyone could have tapped it.)
    const way = Math.max(Math.hypot(toM.x - M.x, toM.z - M.z), Math.hypot(toF.x - F.x, toF.z - F.z));
    const walk = clamp(way / pace, options.housed ? HOUSED_WALK_LEAST : 2, Math.max(WALK_MAX, way / FAR_SPEED));
    const mount = mountKind(M.plan ?? F.plan);
    let court: Courtship = options.atHer ? (M.courtship === "dance" || F.courtship === "dance" ? "dance" : "display") : options.housed ? (M.courtship === "dance" || F.courtship === "dance" ? "dance" : "display") : M.courtship ?? F.courtship ?? (mount === "perch" ? "display" : "chase");
    // After the courtship: where she stands and which way, with him behind her.
    let spot = toF;
    let heading = yawOf(dir);
    let courted = walk + COURT_SECONDS + TURN;
    let chase: Chase | null = null;
    if (court === "chase") {
        const run: Chase = {start: toF, dir, normal: {x: dir.z, z: -dir.x}, radius: Math.max(3, F.length * 2.5), speed: clamp(pace * 2.2, 0.8, 9), sep0: contact * 2, sep: half * 1.1};
        const end = arcAt(run, run.speed * CHASE_SECONDS);
        // (ARK-MATING-SHOWN: a chase that would end where the mount cannot be seen, under a bridge or in the water, is
        // a display in place instead.)
        if (options.clear && [0.25, 0.5, 0.75, 1].some((k) => !options.clear!(arcAt(run, run.speed * CHASE_SECONDS * k).p))) court = "display";
        else {
            chase = run;
            spot = end.p;
            heading = end.yaw;
            courted = walk + CHASE_SECONDS;
        }
    }
    const hd = {x: Math.sin(heading), z: Math.cos(heading)};
    const attempts: MatingAttempt[] = [];
    const tries = options.housed ? 1 : failedTries(key) + 1;
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
        // A try that fails: she walks on a body length (from when he slides off, through his following). (ARK-MATING-SHOWN:
        // not on into cover: then she turns in place, and the next try is where she stands.)
        if (!took) {
            const on = add(at, hd, F.length * 1.1);
            if (!options.clear || options.clear(on)) at = on;
        }
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
        paired: last.end + (options.housed ? HOUSED_AFTER : AFTER),
        m: {length: M.length, height: M.height, pace: M.pace},
        f: {length: F.length, height: F.height, pace: F.pace}
    };
}

/**
 * ARK-MATING-SHOWN: the height under a free one's way from his surface (`hb`, at `he`) to hers (`sb`, at `she`): a flier
 * arcs over the ground between them; one that crawls comes down to the ground and up again. At her end, her own surface
 * (they mate there). Pure.
 */
export function surfacePath(he: Point, she: Point, hb: number, sb: number, fly: boolean, d: number, ground: (x: number, z: number) => number): (x: number, z: number) => number {
    return (x, z) => {
        const k = d > 1e-6 ? clamp(((x - he.x) * (she.x - he.x) + (z - he.z) * (she.z - he.z)) / (d * d), 0, 1) : 1;
        const line = hb + (sb - hb) * k;
        const g = ground(x, z);
        if (fly) return Math.max(line, g) + Math.sin(Math.PI * k) * Math.min(d * 0.2, 4);
        // (Down off his surface within the first stretch and up onto hers in the last, the ground between.)
        const w = clamp(Math.min(k, 1 - k) / 0.15, 0, 1);
        return line + (g - line) * w;
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

    /**
     * WATCH (the camera director): the matings under way now: the pair (`a` the one that walks to the other), its rival
     * while their contest is on (`rival`), and whether the two are still coming together (`meeting`).
     */
    pairs(epoch: number): Array<{a: string; b: string; rival: string | null; meeting: boolean; t0: number}> {
        const out: Array<{a: string; b: string; rival: string | null; meeting: boolean; t0: number}> = [];
        for (const m of this.matings) {
            if (!m.acting.size || m.over || m.failed || !m.script) continue;
            const s = epoch - m.act.t0;
            const contestEnd = m.contest?.script.end ?? 0;
            out.push({a: m.act.a, b: m.act.b, rival: m.contest && s < contestEnd ? m.contest.rival : null, meeting: s < contestEnd + m.script.walk, t0: m.act.t0});
        }
        return out;
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

    /** ARK-MATING-SHOWN: when the mating of a pair naming `id` is over (s, the shared clock: they have rested together), or null: none acted. */
    endOf(id: string): number | null {
        for (let i = this.matings.length - 1; i >= 0; i--) {
            const m = this.matings[i];
            if (m.failed || !m.script || (m.act.a !== id && m.act.b !== id)) continue;
            return m.act.t0 + (m.contest?.script.end ?? 0) + m.script.paired;
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
                const kind = h.together(a, b) && !reproAct(h.repro?.(a) ?? null) ? h.contest?.(male) ?? null : null;
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
                let pa: Point | null = at(a, true);
                let pb: Point | null = at(b, false);
                // V1: one with no day to walk from (a zoo house's, a tank's, a cage's resident) is where the scene draws it.
                const ha = pa ? null : h.placeOf?.(a) ?? null;
                const hb = pb ? null : h.placeOf?.(b) ?? null;
                // (ARK-MATING-SHOWN: one off any day that is not in an enclosure, a small animal on its wall or its
                // flower, is not "housed": he goes to her, flying or by the ground, and they mate on her surface.)
                const housed = Boolean((ha && !ha.free) || (hb && !hb.free));
                const free = !housed && Boolean(ha?.free || hb?.free);
                pa ??= ha;
                pb ??= hb;
                if (!pa || !pb) {
                    m.failed = true;
                    continue;
                }
                // REAL-REPRODUCTION: a pair in amplexus in an enclosure, at its fence, moves in off it to where the camera
                // can look in from any side (a rail between was all the picture): the nearest open spot it can walk to.
                if (housed && h.open && h.between) {
                    const way0 = h.repro?.(a) ?? h.repro?.(b) ?? null;
                    const mid = {x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2};
                    if (way0 && reproAct(way0) === "amplexus" && !h.open(mid)) {
                        search: for (const r of [0.3, 0.6, 0.9, 1.3]) {
                            for (let i = 0; i < 8; i++) {
                                const q = {x: mid.x + Math.sin((i * Math.PI) / 4) * r, z: mid.z + Math.cos((i * Math.PI) / 4) * r};
                                if (h.open(q) && h.between(mid, q)) {
                                    pa = {...pa, x: pa.x + q.x - mid.x, z: pa.z + q.z - mid.z};
                                    pb = {...pb, x: pb.x + q.x - mid.x, z: pb.z + q.z - mid.z};
                                    break search;
                                }
                            }
                        }
                    }
                }
                const maleFirst = !(h.male(b) === true && h.male(a) !== true);
                const d = Math.hypot(pb.x - pa.x, pb.z - pa.z);
                // (He comes to her: the one that mounts is the one moved nearer, on the line from where he was; `behind`:
                // to behind her instead, by her own heading.)
                const nearer = (from: number, behind: number | null = null): {pa: Point; pb: Point} => {
                    const [he, she] = maleFirst ? [pa!, pb!] : [pb!, pa!];
                    const k = d > 1e-6 ? from / d : 0;
                    const moved = behind === null ? {x: she.x + (he.x - she.x) * k, z: she.z + (he.z - she.z) * k} : {x: she.x - Math.sin(behind) * from, z: she.z - Math.cos(behind) * from};
                    return maleFirst ? {pa: moved, pb: she} : {pa: she, pb: moved};
                };
                if (free) {
                    const maleFirst2 = !(h.male(b) === true && h.male(a) !== true);
                    const [he, she] = maleFirst2 ? [pa, pb] : [pb, pa];
                    const [hb2, sb2] = (maleFirst2 ? [ha, hb] : [hb, ha]).map((own, i) => own?.base ?? h.ground(i ? she.x : he.x, i ? she.z : he.z));
                    const fly = h.flies?.(maleFirst2 ? a : b) ?? false;
                    const dd = Math.hypot(she.x - he.x, she.z - he.z);
                    m.floor = surfacePath(he, she, hb2, sb2, fly, dd, h.ground);
                    m.how = "free";
                } else if (housed) {
                    const baseOf = (p: Point, own: {base: number} | null) => own?.base ?? h.ground(p.x, p.z);
                    const [ba, bb] = [baseOf(pa, ha), baseOf(pb, hb)];
                    m.how = "housed";
                    if (d > HOUSED_NEAR) {
                        // Two enclosures (two homes' tanks, two vivariums): he is brought to her side, on her floor.
                        const hers = maleFirst ? hb ?? h.scheduleAt(b, m.act.t0 + lead) : ha ?? h.scheduleAt(a, m.act.t0 + lead);
                        const she = maleFirst ? pb : pa;
                        const yaw = hers?.yaw ?? 0;
                        const off = (h.length(a) + h.length(b)) * HOUSED_BESIDE;
                        m.beside = {she, he: {x: she.x + Math.cos(yaw) * off, z: she.z - Math.sin(yaw) * off}, yaw};
                        // (The script is still made, from just behind her: its times are the act's, `debug`.)
                        ({pa, pb} = nearer((h.length(a) + h.length(b)) * HOUSED_BEHIND, yaw));
                        m.how = "brought";
                        m.brought = maleFirst ? "a" : "b";
                        const floor = maleFirst ? bb : ba;
                        m.floor = () => floor;
                    } else {
                        // One enclosure: its floor between the two (a tank's water at each one's own depth).
                        const [ax, az, bx, bz] = [pa.x, pa.z, pb.x, pb.z];
                        m.floor = (x, z) => {
                            const k = d > 1e-6 ? Math.min(Math.max(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (d * d), 0), 1) : 0.5;
                            return ba + (bb - ba) * k;
                        };
                    }
                } else if (d > MATING_MAX_APART) {
                    // (ARK-MATING-SHOWN: the whole way, from where each was: no longer started nearer.)
                    m.how = "far";
                }
                const close = (body: MatingBody): MatingBody => (housed ? {...body, length: body.length * HOUSED_COMPACT} : body);
                // (ARK-MATING-SHOWN: a pair of swimmers may meet in the water; any other pair on dry ground. Neither under cover.)
                const wet = mountKind(h.plan(a) ?? h.plan(b)) === "alongside";
                const clear = h.clear ? (p: Point) => h.clear!(p, wet) : undefined;
                // REAL-REPRODUCTION: amplexus is watched from beside the pair: a spot open all round (no fence rail or
                // post between the camera and them), else the usual one.
                const wayFirst = h.repro?.(a) ?? h.repro?.(b) ?? null;
                const roomy = wayFirst && reproAct(wayFirst) === "amplexus" && h.open && clear ? (p: Point) => clear(p) && h.open!(p) : null;
                // (A small pair that would meet at her place meets there only when it is open round; else at the
                // nearest open spot, which `meetingSpot` finds, or her place after all.)
                const roomyAt = roomy && (!free || roomy({x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2}) === false) ? roomy : null;
                const script =
                    (roomyAt && matingScript(close(this.body(a, pa)), close(this.body(b, pb)), m.act.key, {housed, clear: roomyAt, far: m.how === "far" || free, atHer: false})) ||
                    matingScript(close(this.body(a, pa)), close(this.body(b, pb)), m.act.key, {housed, clear: free ? undefined : clear, far: m.how === "far" || free, atHer: free});
                if (!script) {
                    m.failed = true;
                    continue;
                }
                // REAL-REPRODUCTION (decision 440): the kind's own way instead of a mount (a spawning night where each
                // is, a redd, amplexus, the seahorses' dance): the same meeting, its own act and its own length.
                const way = h.repro?.(a) ?? h.repro?.(b) ?? null;
                const act = reproAct(way);
                if (act && way) {
                    let plan = reproPlan(act, way, {from: script.from, to: script.to, walk: script.walk, heading: script.heading, m: script.m, f: script.f});
                    const openAt = h.open ?? clear;
                    if (act === "amplexus" && openAt) {
                        // (She walks on as she lays: the way with the most open round it, nothing over it and room on
                        // every side where she ends (the camera looks in from beside her: a rail or a post a hand's
                        // breadth off would stand between), so the strings and the pair are seen.)
                        const reach = plan.f.length * 3;
                        let best = {yaw: plan.heading, open: -1};
                        for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
                            const yaw = plan.heading + (turn * Math.PI) / 4;
                            const at = (k: number) => ({x: plan.spot.x + Math.sin(yaw) * reach * k, z: plan.spot.z + Math.cos(yaw) * reach * k});
                            const end = at(1);
                            const checks = [at(0.35), at(0.7), end, at(1.4), ...[0, 1, 2, 3, 4, 5].map((i) => ({x: end.x + Math.sin((i * Math.PI) / 3) * 0.4, z: end.z + Math.cos((i * Math.PI) / 3) * 0.4}))];
                            const open = checks.filter((q) => openAt(q)).length;
                            if (open > best.open) best = {yaw, open};
                            if (open === checks.length) break;
                        }
                        plan = {...plan, heading: best.yaw};
                    }
                    m.repro = plan;
                    if (act === "spawn_night") m.kin = (h.kinSpots?.(a) ?? []).slice(0, KIN_MOST);
                    script.court = "display";
                    script.chase = null;
                    script.courted = plan.walk;
                    script.attempts = [{spot: plan.spot, behind: plan.spot, approach: plan.walk, rise: plan.walk, on: plan.walk, off: plan.end, end: plan.end, took: true}];
                    script.side = plan.to.m;
                    script.mounted = plan.end;
                    script.paired = plan.end;
                    if (staysPut(act) || !m.floor) {
                        // (Each at its own depth, as its day has it: a bivalve on the seabed, a fish in the water. The
                        // land's ground stops at the shore's water line, so a sea kind there would be pulled up to it.)
                        const own = (p: Point, day: {base?: number; y?: number} | null) => Math.min(day?.base ?? day?.y ?? h.ground(p.x, p.z), h.ground(p.x, p.z));
                        const [ba, bb] = [own(pa, ha), own(pb, hb)];
                        const [ax, az, bx, bz] = [pa.x, pa.z, pb.x, pb.z];
                        m.floor = (x, z) => {
                            const k = d > 1e-6 ? Math.min(Math.max(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (d * d), 0), 1) : 0.5;
                            return ba + (bb - ba) * k;
                        };
                    }
                    if (act === "spawn_pair" || act === "pouch") {
                        // (A pair of swimmers spawns at one level: the lower of the two, by their rock or their seabed.)
                        const f0 = m.floor ?? h.ground;
                        const lo = Math.min(f0(pa.x, pa.z), f0(pb.x, pb.z));
                        m.floor = () => lo;
                    }
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
            const floor = m.floor ?? h.ground;
            // (V1: the one brought beside her comes in from small, as an arrival does, and goes the same way.)
            const brought = (which: "a" | "b", act: ActPose | null): ActPose | null => (act && m.brought === which ? {...act, scale: act.scale * Math.min(0.3 + 0.7 * ease(sM / 1.2), 0.3 + 0.7 * ease((sc.paired - sM) / 1.2))} : act);
            if (sM < sc.paired && m.beside) {
                // Side by side where she lives: he displays to her, then the two rest together.
                const by = m.beside;
                const lie = (p: Point, state: string, other: string): ActPose => ({x: p.x, z: p.z, base: floor(p.x, p.z), yaw: by.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0, with: other});
                const courting = sM < sc.courted;
                const heIsA = m.brought === "a";
                pose(a, brought("a", lie(heIsA ? by.he : by.she, courting ? (heIsA ? "display" : "scan") : "rest", m.act.b)));
                pose(b, brought("b", lie(heIsA ? by.she : by.he, courting ? (heIsA ? "scan" : "display") : "rest", m.act.a)));
            } else if (sM < sc.paired && m.repro) {
                pose(a, brought("a", reproPose(m.repro, sc.firstMounts, sM, floor, m.act.b)));
                pose(b, brought("b", reproPose(m.repro, !sc.firstMounts, sM, floor, m.act.a)));
            } else if (sM < sc.paired) {
                pose(a, brought("a", matingPose(sc, true, sM, floor, m.act.b)));
                pose(b, brought("b", matingPose(sc, false, sM, floor, m.act.a)));
            } else {
                // Part: each back to where its day has it now.
                const last = sc.attempts[sc.attempts.length - 1];
                const back = (entry: E, from: Point, pace: number, which: "a" | "b") => {
                    // (One that was brought is simply back where it lives.)
                    if (m.brought === which) return null;
                    const now = h.scheduleAt(entry, epoch) ?? h.placeOf?.(entry) ?? null;
                    if (!now) return null;
                    const d = Math.hypot(now.x - from.x, now.z - from.z);
                    const seconds = Math.min(Math.max(d / Math.max(pace, 0.3), RETURN_MIN), RETURN_MAX);
                    const k = (sM - sc.paired) / seconds;
                    if (k >= 1) return null;
                    const e = ease(k);
                    const x = from.x + (now.x - from.x) * e;
                    const z = from.z + (now.z - from.z) * e;
                    return {x, z, base: floor(x, z), yaw: d > 0.05 ? Math.atan2(now.x - from.x, now.z - from.z) : now.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: k < 0.12 ? "rest" : "walk", speed: k < 0.12 ? 0 : d / seconds} satisfies ActPose;
                };
                if (m.repro) {
                    const end = (isM: boolean): Point => (m.repro!.guard === "both" || m.repro!.guard === (isM ? "m" : "f") ? m.repro!.spot : isM ? m.repro!.to.m : m.repro!.to.f);
                    const ra = back(a, end(sc.firstMounts), sc.firstMounts ? sc.m.pace : sc.f.pace, "a");
                    const rb = back(b, end(!sc.firstMounts), sc.firstMounts ? sc.f.pace : sc.m.pace, "b");
                    pose(a, ra);
                    pose(b, rb);
                    if (!ra && !rb) m.over = true;
                    m.acting.forEach((e) => {
                        if (!acting.has(e)) h.setAct(e, null);
                    });
                    m.acting = acting;
                    continue;
                }
                const ba = back(a, sc.firstMounts ? sc.side : last.spot, sc.firstMounts ? sc.m.pace : sc.f.pace, "a");
                const bb = back(b, sc.firstMounts ? last.spot : sc.side, sc.firstMounts ? sc.f.pace : sc.m.pace, "b");
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

    /** REAL-REPRODUCTION: the puffs of every act under way at `epoch` (gametes, eggs, milt), its kin's haze too. */
    fx(epoch: number): FxEmitter[] {
        const out: FxEmitter[] = [];
        for (const m of this.matings) {
            if (!m.repro || !m.script || m.failed || m.over || !m.acting.size) continue;
            const s = epoch - m.act.t0 - (m.contest?.script.end ?? 0);
            const floor = m.floor ?? this.host.ground;
            const mine = reproFx(m.repro, m.act.key, s, floor);
            out.push(...mine);
            if (m.kin && mine.length && mine[0].kind === "haze") m.kin.forEach((k, i) => out.push({...mine[0], key: `${m.act.key}#${i}`, x: k.x, z: k.z, y: this.host.ground(k.x, k.z) + mine[0].size * 0.5}));
        }
        return out;
    }

    /** (`meet`, `courted`, `mounted`, `end`: s after `t0`, a contest's lead included: when the two meet, when the mounts begin and end, when they part.) */
    debug(): Array<{key: string; t0: number; phase: string; court?: Courtship; mount?: MountKind; tries?: number; paired?: number; contest?: ContestKind; rival?: string; contestEnd?: number; meet?: number; courted?: number; mounted?: number; end?: number; how?: "far" | "housed" | "brought" | "free"}> {
        return this.matings.map((m) => ({
            key: m.act.key,
            t0: m.act.t0,
            phase: m.failed ? "skipped" : m.over ? "over" : m.script ? "acting" : "waiting",
            ...(m.how ? {how: m.how} : {}),
            ...(m.script ? {court: m.script.court, mount: m.script.mount, tries: m.script.attempts.length, paired: Math.round(m.script.paired), meet: (m.contest?.script.end ?? 0) + m.script.walk, courted: (m.contest?.script.end ?? 0) + m.script.courted, mounted: (m.contest?.script.end ?? 0) + m.script.mounted, end: (m.contest?.script.end ?? 0) + m.script.paired} : {}),
            ...(m.contest ? {contest: m.contest.script.kind, rival: m.contest.rival, contestEnd: Math.round(m.contest.script.end)} : {}),
            // REAL-REPRODUCTION: the kind's own act (no mount to look away from) and when its telling part runs.
            ...(m.repro ? {repro: m.repro.act, telling: [(m.contest?.script.end ?? 0) + m.script!.walk + m.repro.b - m.repro.walk, (m.contest?.script.end ?? 0) + m.script!.walk + m.repro.c - m.repro.walk]} : {})
        }));
    }
}
