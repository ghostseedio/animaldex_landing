/**
 * How the scene acts out what the server says happened (life audit sections
 * 2.2 and 3.6). Every act here is driven by an event from the log: the scene
 * never decides that anything is eaten, born or dies, it only shows it.
 *
 * A meal is a short chase, in the way that suits the animals (and models
 * with no skeleton):
 *
 * - glide: a land animal moves to its prey with a body bob and a little dust;
 * - bound: a hopper (frogs, rabbits and the like) in three hops;
 * - slither: a snake, its swim undulation carrying it in an S;
 * - dart: in the water, a slow approach then a dash;
 * - swoop: a bird dives from the air and climbs away;
 * - cutaway: anything else (a shark and a seal on the beach, a penguin and a
 *   fish): the camera turns aside and the caption says what happened.
 *
 * The prey startles, then fades. Each stage is a pure function of the time
 * since it began.
 *
 * The predator's speed stat sets how fast it covers the ground (`speed`, in
 * m/s: 0.6 to 2 of its own body lengths a second, `stats.ts`): a cheetah is
 * on its prey at once, a tortoise takes its time, and a slow one starts
 * nearer. Only the look of it: the meal itself is the server's.
 */

import {SWIMMING_PLANS} from "@/ark-scene/sizes";
import {heightAt} from "@/ark-scene/world";

/** The ground under a land animal on the move. */
const groundAt = (x: number, z: number) => Math.max(heightAt(x, z), -0.3);

export type ChaseKind = "glide" | "bound" | "slither" | "dart" | "swoop" | "cutaway";

/** Hoppers by name: the body plan says "mammal" for a rabbit as for a lion. */
const HOPPERS = /(rabbit|hare|jackrabbit|kangaroo|wallaby|wallaroo|jerboa|springhare|pademelon|quokka|bettong|potoroo|frog|toad)/;

export function chaseKind(input: {predatorSlug: string; predatorPlan: string | null; predatorWater: boolean; preyWater: boolean; predatorFlies: boolean}): ChaseKind {
    const plan = input.predatorPlan ?? "";
    // Birds come from the air, onto land or the water's surface; a penguin can't.
    if ((plan === "bird" || input.predatorFlies) && !/penguin/.test(input.predatorSlug)) return "swoop";
    if (SWIMMING_PLANS.has(plan) || plan === "ray") return input.predatorWater && input.preyWater ? "dart" : "cutaway";
    if (input.predatorWater || input.preyWater) return "cutaway";
    if (plan === "snake") return "slither";
    if (plan === "frog" || HOPPERS.test(input.predatorSlug)) return "bound";
    if (plan === "mammal" || plan === "reptile" || plan === "arthropod" || plan === "turtle") return "glide";
    // Insects, butterflies, worms and anything else would look wrong on the move.
    return "cutaway";
}

/** Where an animal stands (or swims) and how it is turned: a pose the scene draws in place of its own. */
export type ActPose = {
    x: number;
    z: number;
    /** Its feet (or belly in the water). */
    base: number;
    yaw: number;
    pitch: number;
    roll: number;
    /** 1 as it is; toward 0 as it fades. */
    scale: number;
    /** 0 in full colour; 1 faded into the haze. */
    dim: number;
    hidden: boolean;
    /** What it is doing (the recipe states' names, `ARK_RECIPE_STATES`: stalk, freeze, run, leap, strike, eat, scan,
     *  swim, fly, glide, plunge, strike_feet, takeoff, rest), for the rig player's clip; and its speed along its way
     *  (m/s): a gait engine picks a gallop or a bound from it. */
    state?: string;
    speed?: number;
    /** Its partner in the act (the prey, the predator), by id: the collision lane lets the two close to contact. */
    with?: string;
    /** Its side in a meal's chase: the hunter (nearby prey scatter from it, `reactive.ts` `chasing`) or its quarry. */
    role?: "hunter" | "quarry";
};

export type ActBody = {
    x: number;
    z: number;
    base: number;
    yaw: number;
    length: number;
    height: number;
    /** How fast it moves (m/s), from its speed stat (`moveSpeed`); absent: the middle of the scale. */
    speed?: number;
    /** Its speed stat (0–100), when known: the chase's sprint and flee (`chasePace`). */
    speedStat?: number | null;
    /** Its rig's fastest ground clip (body lengths a second per cadence, `behaviours.json` gait): the sprint's cap. */
    gait?: number | null;
    /** Its species (the locomotion lanes' paces look up its style). */
    slug?: string;
};

export type Puff = {x: number; y: number; z: number; size: number; kind: "dust" | "bubble"};

export type MealStage = {
    kind: ChaseKind;
    seconds: number;
    /** Where the camera looks while it plays. */
    focus: {x: number; y: number; z: number};
    distance: number;
    polar: number;
    predator: (t: number) => ActPose | null;
    prey: (t: number) => ActPose;
    /** Puffs that start between `from` and `to` seconds. */
    puffs: (from: number, to: number) => Puff[];
    /** For a cut-away: when the camera turns aside, and when the prey is gone. */
    turnAt?: number;
    /** The catch (s into the stage). */
    catchAt?: number;
};

const smooth = (t: number) => {
    const c = Math.min(Math.max(t, 0), 1);
    return c * c * (3 - 2 * c);
};
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The short way round from one heading to another. */
function turn(from: number, to: number, t: number): number {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d * t;
}
const heading = (dx: number, dz: number) => Math.atan2(dx, dz);

function still(body: ActBody): ActPose {
    return {x: body.x, z: body.z, base: body.base, yaw: body.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false};
}

// MARK: The chase (motion 100x brief section 6: a meal acted out as a full chase)

/** How the prey gets away (or tries to): it runs and darts, bounds, takes off, swims and darts, or stays put (a snail). */
export type FleeStyle = "run" | "bound" | "fly" | "swim" | "still";

/** Hard-shelled, rooted or very slow prey: it pulls in where it is rather than run. */
const STILL_PREY = /(snail|slug|tortoise|clam|mussel|oyster|scallop|barnacle|coral|sponge|anemone|urchin|starfish|sea-star|sea-cucumber|limpet|chiton|sloth)/;

export function preyFleeStyle(input: {preySlug: string; preyPlan: string | null; preyWater: boolean; preyFlies: boolean; speedStat?: number | null}): FleeStyle {
    if (input.preyWater) return "swim";
    if (input.preyFlies) return "fly";
    const plan = input.preyPlan ?? "";
    if (STILL_PREY.test(input.preySlug) || plan === "turtle" || (input.speedStat ?? 50) < 10) return "still";
    if (plan === "frog" || HOPPERS.test(input.preySlug)) return "bound";
    return "run";
}

/**
 * The server's positions for a meal (encounter-based hunting, `voyage_config.hunting = 'encounter'`): the hunter at its
 * foray waypoint at the step `t` (epoch seconds), the prey somewhere in its home disc. Absent in pool mode: the chase
 * then starts from where the scene has the two.
 */
export type MealEncounter = {t?: number; predator: {x: number; z: number}; prey: {x: number; z: number; r: number}};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A meal act's encounter (`act.encounter`, or the event's `payload.encounter`), checked; null when there is none. */
export function mealEncounter(act: unknown): MealEncounter | null {
    if (!act || typeof act !== "object") return null;
    const raw = (act as {encounter?: unknown; payload?: {encounter?: unknown}}).encounter ?? (act as {payload?: {encounter?: unknown}}).payload?.encounter;
    if (!raw || typeof raw !== "object") return null;
    const e = raw as {t?: unknown; predator?: {x?: unknown; z?: unknown}; prey?: {x?: unknown; z?: unknown; r?: unknown}};
    if (!e.predator || !e.prey || !finite(e.predator.x) || !finite(e.predator.z) || !finite(e.prey.x) || !finite(e.prey.z)) return null;
    return {t: finite(e.t) ? e.t : undefined, predator: {x: e.predator.x, z: e.predator.z}, prey: {x: e.prey.x, z: e.prey.z, r: finite(e.prey.r) ? Math.max(e.prey.r, 0) : 0}};
}

/** How far the scene's pose of the hunter may be from the server's waypoint and still be used as it is (m): the
 *  encounter plan's agreement between the server (Deno) and the scene (the browser), about 4–6 m. */
export const ENCOUNTER_AGREE = 5;

/**
 * Where the chase starts, from the scene's poses of the two (at the encounter's time `t` where the scene can give
 * them) and the server's record of where it happened: the hunter where the scene has it when that is within
 * `ENCOUNTER_AGREE` of its waypoint, else at the waypoint; the prey where the scene has it when that is inside its disc
 * (half a metre's play), else at the disc's point nearest that. The server's decision is the record; the scene agrees
 * to within a few metres. The hunter faces its prey.
 */
export function encounterBodies(predator: ActBody, prey: ActBody, encounter: MealEncounter, ground: (x: number, z: number) => number = groundAt): {predator: ActBody; prey: ActBody} {
    const disc = encounter.prey;
    const dx = prey.x - disc.x;
    const dz = prey.z - disc.z;
    const d = Math.hypot(dx, dz);
    const inside = d <= disc.r + 0.5;
    const k = inside || d < 1e-6 ? 1 : disc.r / d;
    const px = inside ? prey.x : disc.x + dx * k;
    const pz = inside ? prey.z : disc.z + dz * k;
    const agrees = Math.hypot(predator.x - encounter.predator.x, predator.z - encounter.predator.z) <= ENCOUNTER_AGREE;
    const hx = agrees ? predator.x : encounter.predator.x;
    const hz = agrees ? predator.z : encounter.predator.z;
    const onLand = (body: ActBody) => body.base >= -0.02;
    return {
        predator: {...predator, x: hx, z: hz, base: agrees || !onLand(predator) ? predator.base : ground(hx, hz), yaw: Math.hypot(px - hx, pz - hz) > 0.05 ? heading(px - hx, pz - hz) : predator.yaw},
        prey: {...prey, x: px, z: pz, base: inside || !onLand(prey) ? prey.base : ground(px, pz)}
    };
}

/**
 * The locomotion lanes' paces, wired by the scene once they are in (`setChasePaces`): L1's legged sprint and flee
 * (`locomotion/flee.ts`), L2's swim burst (`swimPaces(length, style).burst`) and flight dive (`flightSpec(...).dive`).
 * Each may answer null (no data for that animal): the provisional pace below stands.
 */
export type ChasePaces = Partial<Record<"sprint" | "flee" | "burst" | "dive", (body: ActBody) => number | null | undefined>>;
let lanePaces: ChasePaces | null = null;
export function setChasePaces(paces: ChasePaces | null) {
    lanePaces = paces;
}

/**
 * How fast it goes in a chase (m/s): the locomotion lanes' pace where wired (`setChasePaces`), else a provisional one:
 * its top speed from its speed stat, (0.3 + 14.5·(stat/100)^1.2) m/s, a little more for a bigger body (×L^0.25) and
 * capped by its rig's fastest clip where known (`gait`): a cheetah about 16 m/s, a lion 13, a zebra 12, a fox 8.5, a
 * mouse 4, a tortoise under 1. A swimmer's burst and a raptor's stoop by its length. One place to swap.
 */
export function chasePace(body: ActBody, mode: "sprint" | "flee" | "stalk" | "burst" | "dive"): number {
    if (mode !== "stalk") {
        const lane = lanePaces?.[mode]?.(body);
        if (finite(lane) && lane > 0) return lane;
    }
    const length = Math.max(body.length, 0.05);
    const stat = statOf(body);
    // (No stat but its pace at a full chase, `moveSpeed`: that is its top speed.)
    const top = !finite(body.speedStat) && finite(body.speed) && body.speed > 0 ? body.speed : (0.3 + 14.5 * Math.pow(stat / 100, 1.2)) * Math.min(Math.max(Math.pow(length, 0.25), 0.4), 1.6);
    const rig = body.gait ? length * body.gait * 2.5 * 1.3 : Infinity;
    switch (mode) {
        case "sprint":
            return Math.max(Math.min(top, rig, 22), 0.3);
        case "flee":
            return Math.max(Math.min(top, rig, 22), 0.2);
        case "stalk":
            return Math.min(Math.max(length * 0.45, 0.2), 1.4);
        case "burst":
            return Math.max(Math.min(length * (1.2 + 2.2 * (stat / 100)), 9), 0.3);
        case "dive":
            return Math.min(Math.max(length * 9, 8), 26);
    }
}

/** Its speed stat (0–100): as given, else the middle of the scale. */
function statOf(body: ActBody): number {
    return finite(body.speedStat) ? Math.min(Math.max(body.speedStat, 0), 100) : 50;
}

export type ChaseOptions = {
    /** The act's seed (its event: the prey's id and the time), so every viewer sees the same darts. */
    seed?: string;
    /** How the prey flees (`preyFleeStyle`); a run when absent. */
    flee?: FleeStyle;
    /** Ground a runner may cross (the walk grid, the colliders); water a swimmer may swim. Absent: anywhere. */
    clear?: (x: number, z: number) => boolean;
    water?: (x: number, z: number) => boolean;
    /** The two are where the server says (`encounterBodies`): the hunter starts from its waypoint, however far (up to
     *  40 m), closing the gap in its stalk; otherwise a far one comes into view nearer. */
    exact?: boolean;
};

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

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Turn from `from` toward `to` by at most `max` (rad). */
const steer = (from: number, to: number, max: number) => from + Math.max(Math.min(wrap(to - from), max), -max);

/** One sampled moment of one animal in the chase. */
type Sample = {x: number; z: number; y: number; yaw: number; v: number; state: string; pitch: number; hidden?: boolean; dim?: number; scale?: number};

const DT = 1 / 60;
/** Lunged at, the prey runs on straight at this share of its pace (the catch lands where it will be). */
const LUNGE_PREY = 0.85;

/** The nearest clear way to `want` (a little ahead of a body), or `want` itself when it is clear or nothing is. */
function roundIt(want: number, x: number, z: number, ahead: number, ok: (x: number, z: number) => boolean): number {
    const clear = (a: number) => ok(x + Math.sin(a) * ahead, z + Math.cos(a) * ahead) && ok(x + Math.sin(a) * ahead * 0.5, z + Math.cos(a) * ahead * 0.5);
    if (clear(want)) return want;
    for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7]) if (clear(want + off)) return want + off;
    return want;
}

/** Whether the straight way between two points stays clear (every quarter metre). */
function lineClear(ax: number, az: number, bx: number, bz: number, ok: (x: number, z: number) => boolean): boolean {
    const n = Math.min(Math.max(Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25), 1), 80);
    for (let i = 1; i <= n; i++) if (!ok(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)) return false;
    return true;
}

/** The sampled chase: both animals at every DT, the catch, the camera's frame. */
type Run = {pred: Sample[]; prey: Sample[]; tc: number; seconds: number; puffs: Puff[]; launch: number};

function sampleAt(list: Sample[], t: number): Sample {
    const f = Math.min(Math.max(t / DT, 0), list.length - 1);
    const i = Math.min(Math.floor(f), list.length - 2 < 0 ? 0 : list.length - 2);
    const a = list[i];
    const b = list[Math.min(i + 1, list.length - 1)];
    const k = f - i;
    return {...a, x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), y: lerp(a.y, b.y, k), yaw: turn(a.yaw, b.yaw, k), v: lerp(a.v, b.v, k), pitch: lerp(a.pitch, b.pitch, k), dim: lerp(a.dim ?? 0, b.dim ?? 0, k), scale: lerp(a.scale ?? 1, b.scale ?? 1, k)};
}

/**
 * A chase on land or in the water, sampled once (pure in the two bodies and the seed):
 *
 * 1. it turns to its prey and stalks it, low and slow, up to the distance it breaks from (a slow one starts nearer,
 *    and a long stalk is cut to a few seconds: it comes into view from its side);
 * 2. the prey looks up, then bolts: away from it, darting from side to side, round anything in its way;
 * 3. the predator sprints after it, cutting the corners of its darts (it aims where the prey is going), and closes;
 * 4. the lunge or pounce onto it: the catch; it stands over it, head down, and the prey fades.
 *
 * A snake does not run: it creeps up and strikes. The prey only ever loses: the server says it was eaten, so it runs
 * at most at 72% of the hunter's sprint and tires after a few seconds.
 */
function landOrWaterChase(kind: ChaseKind, predator: ActBody, prey: ActBody, o: ChaseOptions): Run {
    const random = rng(o.seed ?? `${predator.x.toFixed(2)},${prey.x.toFixed(2)}`);
    const swim = kind === "dart";
    const flee: FleeStyle = o.flee ?? (swim ? "swim" : "run");
    const lp = Math.max(predator.length, 0.05);
    const lq = Math.max(prey.length, 0.05);
    const vp = swim ? chasePace(predator, "burst") : chasePace(predator, "sprint");
    const vq = flee === "still" ? 0 : Math.min(swim || flee === "swim" ? chasePace(prey, "burst") : chasePace(prey, "flee"), vp * 0.72);
    const vs = swim ? Math.max(vp * 0.25, 0.15) : Math.min(chasePace(predator, "stalk"), vp * 0.3);
    const ok = (x: number, z: number, water: boolean) => (water ? (o.water ? o.water(x, z) : true) : o.clear ? o.clear(x, z) : true);
    let dx = prey.x - predator.x;
    let dz = prey.z - predator.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 0.01) {
        dx = Math.sin(predator.yaw);
        dz = Math.cos(predator.yaw);
        distance = 1;
    }
    const dir = {x: dx / distance, z: dz / distance};
    const mouth = lp * 0.5;
    // Where it breaks cover: about 1.3 s of its sprint off (a chase of three or four seconds once the prey bolts and
    // darts; a snake, its strike's reach).
    const launch = kind === "slither" ? lp * 0.7 + lq * 0.5 + mouth : Math.min(Math.max(vp * 1.3, lp * 2.5, 3), 16) + mouth;
    const stalkFor = kind === "slither" ? 3.2 : 2.6;
    // From the server's positions it starts from its waypoint and closes faster (up to a slinking trot) to keep the
    // stalk to a few seconds; otherwise it comes into view from its side, at most this far off.
    const exact = Boolean(o.exact) && distance <= 40;
    const approach = exact ? Math.max(vs, (distance - launch) / 4.5) : vs;
    const reach = exact ? Infinity : launch + vs * stalkFor;
    const from = distance > reach ? {x: prey.x - dir.x * reach, z: prey.z - dir.z * reach} : {x: predator.x, z: predator.z};
    const face = heading(dir.x, dir.z);
    const ground = (x: number, z: number) => groundAt(x, z);
    const yOf = (body: ActBody, x: number, z: number, water: boolean) => (water ? Math.min(body.base, -0.05) : ground(x, z));
    const predWater = swim || predator.base < -0.02;
    const preyWater = swim || flee === "swim";
    const pred: Sample[] = [];
    const prq: Sample[] = [];
    const puffs: Puff[] = [];
    const p = {x: from.x, z: from.z, yaw: distance > reach ? face : predator.yaw, v: 0};
    const q = {x: prey.x, z: prey.z, yaw: prey.yaw, v: 0, y: prey.base};
    // The prey's darts: a side and a size per stretch, switching every so often (L1's flee styles: small prey dart in
    // sharp cuts, mid-sized zigzag, big ones run nearly straight with a swerve now and then; a hare jinks, a fish flashes).
    const darts: Array<{at: number; off: number}> = [];
    let side = random() < 0.5 ? -1 : 1;
    const big = lq >= 2.2 && flee === "run";
    const tiny = lq < 0.35 || flee === "bound";
    const dartSize = big ? [0.18, 0.4] : tiny ? [0.6, 1.05] : flee === "swim" ? [0.45, 0.9] : [0.35, 0.8];
    const dartEvery = big ? [0.9, 0.5] : tiny ? [0.35, 0.3] : [0.55, 0.4];
    let tLaunch = -1;
    let tFlee = -1;
    let tLunge = -1;
    let tc = -1;
    let lungeFrom = {x: 0, z: 0};
    let lungeTo = {x: 0, z: 0};
    let lungeYaw = 0;
    let lungeSpeed = -1;
    const react = 0.12 + random() * 0.22;
    const turnP = Math.min(Math.max(5 / Math.pow(lp, 0.4), 1.6), 9);
    const turnQ = Math.min(Math.max(8 / Math.pow(lq, 0.4), 2.5), 12);
    let preyDim = 0;
    let lastStride = 0;
    const maxT = 14;
    for (let i = 0; ; i++) {
        const t = i * DT;
        let predState = "stalk";
        let preyState = "rest";
        let predPitch = 0;
        let preyPitch = 0;
        const gap = Math.hypot(q.x - p.x, q.z - p.z);
        const toPrey = heading(q.x - p.x, q.z - p.z);
        if (tc < 0) {
            if (t < 0.35) {
                // Readying: it turns to its prey, low.
                p.yaw = steer(p.yaw, toPrey, turnP * DT);
                predPitch = 0.07;
            } else if (tLaunch < 0) {
                // The stalk (a snake's creep): straight at it, slow and low, until it is near enough to break.
                p.yaw = steer(p.yaw, toPrey, turnP * DT);
                const crouchFirst = gap <= launch;
                if (crouchFirst || t > 0.35 + (exact ? 4.5 : stalkFor) * 1.2) {
                    if (crouchFirst && t < 0.85) {
                        predState = "freeze";
                    } else {
                        tLaunch = t;
                    }
                } else {
                    p.v = approach;
                    const nx = p.x + Math.sin(p.yaw) * approach * DT;
                    const nz = p.z + Math.cos(p.yaw) * approach * DT;
                    if (ok(nx, nz, predWater) || !ok(p.x, p.z, predWater)) {
                        p.x = nx;
                        p.z = nz;
                    } else tLaunch = t;
                }
                predPitch = 0.09;
                // The prey looks up just before it breaks.
                preyState = gap < launch + vs * 0.4 ? "scan" : "rest";
            }
            if (tLaunch >= 0 && tLunge < 0) {
                const since = t - tLaunch;
                if (kind === "slither") {
                    tLunge = t;
                } else {
                    predState = "run";
                    // Up to its sprint in half a second; it aims where the prey is going (a little ahead), cutting corners.
                    p.v = vp * Math.min(0.3 + since / 0.5, 1);
                    const lead = Math.min(gap / Math.max(vp, 0.1), 0.45);
                    let aim = heading(q.x + Math.sin(q.yaw) * q.v * lead - p.x, q.z + Math.cos(q.yaw) * q.v * lead - p.z);
                    // Round anything in its way, as its prey does.
                    aim = roundIt(aim, p.x, p.z, Math.max(lp * 0.8, 0.6), (x, z) => ok(x, z, predWater));
                    p.yaw = steer(p.yaw, aim, turnP * DT);
                    const nx = p.x + Math.sin(p.yaw) * p.v * DT;
                    const nz = p.z + Math.cos(p.yaw) * p.v * DT;
                    if (ok(nx, nz, predWater) || !ok(p.x, p.z, predWater)) {
                        p.x = nx;
                        p.z = nz;
                    } else p.v *= 0.5;
                    // Dust from its feet, a stride at a time.
                    if (!predWater && t - lastStride > Math.max(lp * 0.9, 0.5) / Math.max(p.v, 0.5)) {
                        lastStride = t;
                        puffs.push({x: p.x, y: ground(p.x, p.z), z: p.z, size: lp * 0.35, kind: "dust"});
                    }
                    // Near enough (or it tires of it), with nothing between: the lunge.
                    if ((gap - mouth <= lq * 0.35 + lp * 0.25 || since > 6.5) && lineClear(p.x, p.z, q.x, q.z, (x, z) => ok(x, z, predWater))) tLunge = t;
                }
                if (tFlee < 0 && t >= tLaunch + react && flee !== "still") {
                    tFlee = t;
                    for (let at = t + 0.2 + random() * 0.25; at < t + 9; at += dartEvery[0] + random() * dartEvery[1]) {
                        darts.push({at, off: side * (dartSize[0] + (dartSize[1] - dartSize[0]) * random())});
                        side = -side;
                    }
                }
            }
            if (tLunge >= 0 && tc < 0 && t >= tLunge) {
                // The lunge, the pounce, the strike: onto it, its mouth on the prey where the prey will be.
                const span = kind === "slither" ? 0.24 : 0.32;
                if (t === tLunge) {
                    lungeFrom = {x: p.x, z: p.z};
                    // Where the prey will be at the catch: on along its way, at its lunging pace (it darts no more).
                    const ahead = q.v * LUNGE_PREY * span;
                    const tx = q.x + Math.sin(q.yaw) * ahead;
                    const tz = q.z + Math.cos(q.yaw) * ahead;
                    const ty = heading(tx - p.x, tz - p.z);
                    lungeTo = {x: tx - Math.sin(ty) * mouth * 0.9, z: tz - Math.cos(ty) * mouth * 0.9};
                    lungeYaw = q.yaw;
                }
                const u = Math.min((t - tLunge) / span, 1);
                const e = 1 - (1 - u) * (1 - u);
                p.x = lerp(lungeFrom.x, lungeTo.x, e);
                p.z = lerp(lungeFrom.z, lungeTo.z, e);
                p.yaw = steer(p.yaw, heading(lungeTo.x - lungeFrom.x + 1e-9, lungeTo.z - lungeFrom.z), turnP * 2 * DT);
                predState = kind === "slither" ? "strike" : swim ? "strike" : "leap";
                predPitch = kind === "slither" ? 0.05 : 0.18 * Math.sin(Math.PI * u);
                if (u >= 1) tc = t;
            }
            // The prey: grazing, then bolting and darting, slowing as it tires; round what is in its way.
            if (tFlee >= 0 && tc < 0) {
                const since = t - tFlee;
                const tire = since > 3.5 ? Math.max(1 - (since - 3.5) * 0.45, 0.3) : 1;
                const lunging = tLunge >= 0 && kind !== "slither";
                if (lunging && lungeSpeed < 0) lungeSpeed = q.v * LUNGE_PREY;
                q.v = lunging ? lungeSpeed : vq * Math.min(since / 0.35, 1) * tire;
                const away = heading(q.x - p.x, q.z - p.z);
                const dart = darts.filter((d) => d.at <= t).pop();
                // Round anything in its way: the nearest way that is clear, a little ahead. (Lunged at, it runs on straight.)
                const want = lunging ? lungeYaw : roundIt(away + (dart ? dart.off : 0), q.x, q.z, Math.max(lq, 0.6), (x, z) => ok(x, z, preyWater));
                const before = q.yaw;
                q.yaw = lunging ? lungeYaw : steer(q.yaw, want, turnQ * DT);
                if (Math.abs(wrap(q.yaw - before)) > turnQ * DT * 0.9 && !preyWater && random() < 0.08) puffs.push({x: q.x, y: ground(q.x, q.z), z: q.z, size: lq * 0.4, kind: "dust"});
                const nx = q.x + Math.sin(q.yaw) * q.v * DT;
                const nz = q.z + Math.cos(q.yaw) * q.v * DT;
                if (ok(nx, nz, preyWater) || !ok(q.x, q.z, preyWater)) {
                    q.x = nx;
                    q.z = nz;
                } else q.v *= 0.4;
                preyState = flee === "swim" ? "swim" : flee === "fly" ? "fly" : "run";
                if (flee === "fly") q.y = Math.max(prey.base, 0) + Math.min(since * 1.8, lq * 2 + 0.6);
            } else if (tFlee < 0 && tLaunch >= 0 && tc < 0) {
                // It has seen it: head up, turning to run.
                preyState = flee === "still" ? "freeze" : "scan";
                if (flee === "still") preyPitch = 0.12;
            }
        } else {
            // Caught: it stands over it (eases to a stop a little on), head down; the prey sinks and fades.
            const after = t - tc;
            predState = "eat";
            predPitch = (kind === "slither" ? 0.05 : 0.14) * Math.min(after / 0.3, 1) + 0.03 * Math.sin(after * 9) * Math.min(after / 0.3, 1);
            p.v = 0;
            preyState = "eat";
            preyDim = Math.min(after / 0.5, 1);
            q.v = 0;
        }
        // (In the water every way of going is a swim, the lunge a strike.)
        if (predWater) predState = predState === "leap" ? "strike" : predState === "eat" ? "eat" : "swim";
        pred.push({x: p.x, z: p.z, y: yOf(predator, p.x, p.z, predWater), yaw: p.yaw, v: p.v, state: predState, pitch: predWater ? 0 : predPitch});
        const preyY = flee === "fly" && tc < 0 ? q.y : flee === "fly" ? Math.max(q.y - (t - tc) * 3, yOf(prey, q.x, q.z, false)) : yOf(prey, q.x, q.z, preyWater);
        prq.push({x: q.x, z: q.z, y: preyY - (tc >= 0 ? prey.height * 0.25 * preyDim : 0), yaw: q.yaw, v: q.v, state: preyState, pitch: preyPitch, dim: preyDim, scale: 1 - 0.85 * preyDim, hidden: tc >= 0 && t >= tc + 0.55});
        if (tc >= 0 && t >= tc + 1.4) break;
        if (t > maxT) {
            // (Never: the lunge comes at 6.5 s of sprinting at the latest.)
            tc = t;
        }
    }
    if (tc >= 0) puffs.push({x: lungeTo.x, y: groundAt(lungeTo.x, lungeTo.z), z: lungeTo.z, size: (lp + lq) * 0.6, kind: predWater ? "bubble" : "dust"});
    // A hopper's bounds: arcs over the ground as it goes.
    if (kind === "bound" || flee === "bound") {
        const hop = (list: Sample[], length: number, on: boolean) => {
            if (!on) return;
            let travelled = 0;
            for (let i = 1; i < list.length; i++) {
                const step = Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z);
                travelled += step;
                if (list[i].state !== "run" && list[i].state !== "leap") continue;
                const stride = Math.max(length * 1.3, 0.35);
                list[i].y += Math.abs(Math.sin((travelled / stride) * Math.PI)) * Math.max(length * 0.4, 0.2);
                list[i].pitch += -0.25 * Math.cos((travelled / stride) * Math.PI * 2);
            }
        };
        hop(pred, lp, kind === "bound");
        hop(prq, lq, flee === "bound");
    }
    return {pred, prey: prq, tc, seconds: pred.length * DT, puffs, launch: tLaunch};
}

/**
 * A raptor's chase: it comes over, high, then stoops onto its prey, which bolts (or takes off) a moment before it
 * hits; feet first onto it. A small one it carries off, climbing; a big one it mantles on the ground.
 */
function swoopChase(predator: ActBody, prey: ActBody, o: ChaseOptions): Run {
    const random = rng(o.seed ?? `${predator.x.toFixed(2)},${prey.x.toFixed(2)}`);
    const flee: FleeStyle = o.flee ?? "run";
    const lp = Math.max(predator.length, 0.05);
    const lq = Math.max(prey.length, 0.05);
    let dx = prey.x - predator.x;
    let dz = prey.z - predator.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 0.01) {
        dx = Math.sin(predator.yaw);
        dz = Math.cos(predator.yaw);
        distance = 1;
    }
    const dir = {x: dx / distance, z: dz / distance};
    const face = heading(dir.x, dir.z);
    const reach = Math.min(distance, 22);
    const from = {x: prey.x - dir.x * reach, z: prey.z - dir.z * reach};
    const altitude = Math.max(predator.base > 2 ? predator.base : Math.max(predator.base, 0) + Math.max(8, lp * 9), Math.max(prey.base, 0) + 6);
    const cruise = Math.min(Math.max(lp * 7, 5), 14);
    const stoop = chasePace(predator, "dive");
    // Over toward it (from where it is: up into the air first when it stands), then the stoop from about 10 m out.
    const rise = predator.base > 2 ? 0 : 0.8;
    const stoopFrom = {x: prey.x - dir.x * Math.min(10, reach * 0.6), z: prey.z - dir.z * Math.min(10, reach * 0.6)};
    const glide = Math.hypot(stoopFrom.x - from.x, stoopFrom.z - from.z) / cruise;
    const tStoop = rise + Math.max(glide, 0.6);
    const drop = Math.hypot(Math.hypot(prey.x - stoopFrom.x, prey.z - stoopFrom.z), altitude - Math.max(prey.base, 0));
    const stoopFor = Math.min(Math.max(drop / stoop, 0.7), 2.2);
    const tc = tStoop + stoopFor;
    // The prey bolts (or takes off) as the shadow comes: about 0.7 s before the strike.
    const tFlee = tc - 0.55 - random() * 0.3;
    const vq = flee === "still" ? 0 : Math.min(flee === "fly" ? Math.max(lq * 6, 3) : chasePace(prey, "flee"), 9);
    const ok = (x: number, z: number) => (o.clear ? o.clear(x, z) : true);
    const prq: Sample[] = [];
    const q = {x: prey.x, z: prey.z, yaw: prey.yaw, v: 0, y: prey.base};
    const away = face + (random() < 0.5 ? -1 : 1) * (0.3 + 0.5 * random());
    const carry = lq < lp * 0.75;
    const end = tc + 1.6;
    for (let t = 0; t <= end + 1e-9; t += DT) {
        let state = "rest";
        if (t >= tFlee && t < tc) {
            const since = t - tFlee;
            q.v = vq * Math.min(since / 0.25, 1);
            q.yaw = steer(q.yaw, away, 9 * DT);
            const nx = q.x + Math.sin(q.yaw) * q.v * DT;
            const nz = q.z + Math.cos(q.yaw) * q.v * DT;
            if (flee === "fly" || ok(nx, nz)) {
                q.x = nx;
                q.z = nz;
            }
            if (flee === "fly") q.y = Math.max(prey.base, 0) + Math.min(since * 2.2, 2.5);
            state = flee === "fly" ? "fly" : flee === "swim" ? "swim" : flee === "still" ? "freeze" : "run";
        } else if (t >= tc - 1.4 && t < tFlee) state = "scan";
        const after = t - tc;
        const dim = after > 0 ? Math.min(after / (carry ? 1.1 : 0.5), 1) : 0;
        prq.push({x: q.x, z: q.z, y: flee === "fly" ? q.y : flee === "swim" ? Math.min(prey.base, -0.05) : groundAt(q.x, q.z), yaw: q.yaw, v: after > 0 ? 0 : q.v, state: after > 0 ? "eat" : state, pitch: 0, dim, scale: 1 - 0.85 * dim, hidden: after > (carry ? 1.15 : 0.55)});
    }
    const strikeAt = sampleAt(prq, tc);
    const strikeY = strikeAt.y + prey.height * 0.6;
    const pred: Sample[] = [];
    const climb = {x: Math.sin(face), z: Math.cos(face)};
    for (let t = 0; t <= end + 1e-9; t += DT) {
        let x: number;
        let z: number;
        let y: number;
        let pitch = 0;
        let state = "fly";
        let yaw = face;
        if (t < rise) {
            const k = smooth(t / rise);
            x = lerp(predator.x, from.x, k * 0.15) + (from.x - predator.x) * 0;
            z = lerp(predator.z, from.z, k * 0.15);
            y = lerp(Math.max(predator.base, 0), altitude, k);
            yaw = turn(predator.yaw, face, k);
            pitch = -0.35 * Math.sin(Math.PI * k);
            state = "takeoff";
            // (From its own place, up: then across to where it comes over.)
            x = lerp(predator.x, from.x, 0);
            z = lerp(predator.z, from.z, 0);
        } else if (t < tStoop) {
            const k = (t - rise) / Math.max(tStoop - rise, 1e-3);
            const sx = rise ? predator.x : from.x;
            const sz = rise ? predator.z : from.z;
            x = lerp(sx, stoopFrom.x, k);
            z = lerp(sz, stoopFrom.z, k);
            y = altitude + Math.sin(Math.PI * k) * 0.6;
            yaw = heading(stoopFrom.x - sx + 1e-9, stoopFrom.z - sz);
            state = k > 0.75 ? "glide" : "fly";
        } else if (t < tc) {
            // The stoop: a curve down onto where the prey will be at the strike, gathering speed, wings closed; feet
            // thrown forward at the last moment.
            const k = (t - tStoop) / stoopFor;
            const e = k * k;
            const cx = (stoopFrom.x + strikeAt.x) / 2;
            const cz = (stoopFrom.z + strikeAt.z) / 2;
            const u = 1 - e;
            x = u * u * stoopFrom.x + 2 * u * e * cx + e * e * strikeAt.x;
            z = u * u * stoopFrom.z + 2 * u * e * cz + e * e * strikeAt.z;
            y = u * u * altitude + 2 * u * e * (altitude * 0.9) + e * e * strikeY;
            yaw = heading(strikeAt.x - stoopFrom.x + 1e-9, strikeAt.z - stoopFrom.z);
            pitch = k < 0.85 ? 0.9 * Math.sin(Math.PI * Math.min(k * 1.2, 1) * 0.5) : -0.6;
            state = k < 0.85 ? "plunge" : "strike_feet";
        } else {
            const k = smooth((t - tc) / (end - tc));
            if (carry) {
                // Away with it, climbing hard.
                x = strikeAt.x + climb.x * 7 * k;
                z = strikeAt.z + climb.z * 7 * k;
                y = strikeY + 5 * k;
                pitch = -0.4 * Math.sin(Math.PI * Math.min(k * 1.4, 1));
                state = "fly";
            } else {
                // Mantled over it on the ground, wings spread, head down.
                x = strikeAt.x;
                z = strikeAt.z;
                y = groundAt(x, z);
                pitch = 0.15 * Math.min((t - tc) / 0.3, 1);
                state = "eat";
            }
        }
        pred.push({x, z, y, yaw, v: 0, state, pitch});
    }
    // A small catch goes with it, under its feet, fading.
    if (carry) {
        for (let i = 0; i < prq.length; i++) {
            const t = i * DT;
            if (t < tc) continue;
            const c = pred[Math.min(i, pred.length - 1)];
            prq[i] = {...prq[i], x: c.x, z: c.z, y: c.y - lq * 0.3, yaw: c.yaw};
        }
    }
    for (let i = 1; i < pred.length; i++) pred[i].v = Math.hypot(pred[i].x - pred[i - 1].x, pred[i].z - pred[i - 1].z, pred[i].y - pred[i - 1].y) / DT;
    const puffs: Puff[] = [{x: strikeAt.x, y: Math.max(strikeAt.y, 0) + 0.1, z: strikeAt.z, size: lq * 1.2, kind: flee === "swim" ? "bubble" : "dust"}];
    return {pred, prey: prq, tc, seconds: end, puffs, launch: tStoop};
}

/**
 * A meal acted out: a full chase in the way that suits the animals (a cut-away where a chase would look wrong). The
 * predator's speed stat sets its sprint (`chasePace`), so a cheetah is on its prey at once and a tortoise takes its
 * time; the prey's own flees it, darting. With the server's positions (`options` from `encounterBodies`) it starts from
 * where hunting found them. Only the look of it: the meal itself is the server's.
 */
export function mealStage(kind: ChaseKind, predator: ActBody, prey: ActBody, options: ChaseOptions = {}): MealStage {
    if (kind === "cutaway") {
        return {
            kind,
            seconds: 3.2,
            focus: {x: prey.x, y: Math.max(prey.base, 0) + prey.height * 0.5, z: prey.z},
            distance: Math.max(9, prey.length * 6),
            polar: 1.12,
            predator: () => null,
            prey: (t) => (t >= 1.5 ? {...still(prey), hidden: true, scale: 0} : still(prey)),
            puffs: () => [],
            turnAt: 0.5
        };
    }
    const run = kind === "swoop" ? swoopChase(predator, prey, options) : landOrWaterChase(kind, predator, prey, options);
    // The frame: everything both of them cover, side on (the scene's camera takes the bearing).
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const list of [run.pred, run.prey]) {
        for (let i = 0; i < list.length; i += 6) {
            const s = list[i];
            minX = Math.min(minX, s.x);
            maxX = Math.max(maxX, s.x);
            minZ = Math.min(minZ, s.z);
            maxZ = Math.max(maxZ, s.z);
            minY = Math.min(minY, s.y);
            maxY = Math.max(maxY, s.y);
        }
    }
    const extent = Math.max(maxX - minX, maxZ - minZ, (maxY - minY) * 1.4);
    const pose = (body: ActBody, list: Sample[]) => (t: number): ActPose => {
        const s = sampleAt(list, t);
        return {x: s.x, z: s.z, base: s.y, yaw: s.yaw, pitch: s.pitch, roll: 0, scale: s.scale ?? 1, dim: s.dim ?? 0, hidden: Boolean(s.hidden), state: s.state, speed: s.v};
    };
    return {
        kind,
        seconds: run.seconds,
        focus: {x: (minX + maxX) / 2, y: Math.max(Math.max(prey.base, 0) + prey.height * 0.5, kind === "swoop" ? (minY + Math.min(maxY, minY + 6)) / 2 : (minY + maxY) / 2 + prey.height * 0.4), z: (minZ + maxZ) / 2},
        distance: Math.max(6, extent * 1.05 + 2.5 + Math.max(prey.length, predator.length) * 1.6) + (kind === "swoop" ? 3 : 0),
        polar: kind === "swoop" ? 1.0 : kind === "dart" ? 0.85 : 1.1,
        predator: pose(predator, run.pred),
        prey: pose(prey, run.prey),
        puffs: (a, b) => run.puffs.filter((puff, i) => {
            const at = puffTime(run, i);
            return a <= at && at < b && puff.size > 0;
        }),
        catchAt: run.tc
    };
}

/** When each puff starts (from its place in the chase: strides and darts in order, the catch's last). */
function puffTime(run: Run, index: number): number {
    const cached = (run as Run & {times?: number[]}).times;
    if (cached) return cached[index];
    const times = run.puffs.map((puff, i) => {
        if (i === run.puffs.length - 1) return run.tc;
        // The moment the predator or the prey was nearest that spot.
        let best = 0;
        let bestD = Infinity;
        for (const list of [run.pred, run.prey]) {
            for (let k = 0; k < list.length; k += 2) {
                const d = Math.hypot(list[k].x - puff.x, list[k].z - puff.z);
                if (d < bestD) {
                    bestD = d;
                    best = k * DT;
                }
            }
        }
        return best;
    });
    (run as Run & {times?: number[]}).times = times;
    return times[index];
}

/** Old age: the head goes down, the colour goes, and it sinks out of sight. Quiet, no puff. */
export function deathPose(body: ActBody, t: number): ActPose {
    const pose = still(body);
    const lower = smooth(t / 1.6);
    pose.pitch = 0.2 * lower;
    pose.dim = 0.55 * lower;
    const go = span(t, 1.7, 2.8);
    if (go > 0) {
        pose.dim = 0.55 + 0.45 * go;
        pose.scale = 1 - 0.9 * go;
        pose.base -= body.height * 0.4 * go;
    }
    if (t >= 2.8) pose.hidden = true;
    return pose;
}

export const DEATH_SECONDS = 3.3;
export const ARRIVAL_SECONDS = 2.2;
export const BIRTH_SECONDS = 2.8;
export const EXTINCTION_SECONDS = 2.2;
