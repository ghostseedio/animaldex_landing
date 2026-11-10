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
};

export type ActBody = {x: number; z: number; base: number; yaw: number; length: number; height: number; /** How fast it moves (m/s), from its speed stat; absent: the stage's own pace. */ speed?: number};

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

/**
 * The prey's part, the same in every chase: it looks up, startles (a hop
 * and a turn away), flees a little, and fades where it is caught.
 */
function preyPart(prey: ActBody, away: {x: number; z: number}, startle: number, caught: number, flee: number, onGround: boolean) {
    const awayYaw = heading(away.x, away.z);
    return (t: number): ActPose => {
        const pose = still(prey);
        if (t >= caught + 0.55) return {...pose, hidden: true, scale: 0, dim: 1};
        const s = t - startle;
        if (s > 0) {
            // The startle: a hop that is over at once, then running.
            const hop = s < 0.3 ? Math.sin(Math.PI * s / 0.3) : 0;
            pose.base += hop * prey.height * 0.18;
            pose.pitch = -0.08 * hop;
            pose.yaw = turn(prey.yaw, awayYaw, smooth(s / 0.35));
            const run = flee * smooth(span(t, startle + 0.15, caught));
            pose.x += away.x * run;
            pose.z += away.z * run;
            if (onGround) pose.base += groundAt(pose.x, pose.z) - groundAt(prey.x, prey.z);
        }
        // Caught: it sinks a little, greys and fades.
        const fade = span(t, caught, caught + 0.5);
        if (fade > 0) {
            pose.dim = fade;
            pose.scale = 1 - 0.85 * fade;
            pose.base -= prey.height * 0.25 * fade;
        }
        return pose;
    };
}

/**
 * A meal acted out: the predator comes from where it is (or from nearer, if
 * it lives far off) to the prey.
 */
/** The stage as drawn at its own pace, with the stretch the predator covers ground in, and how far it goes. */
type PacedStage = MealStage & {moving?: [number, number]; travel?: number};

/**
 * A meal acted out: the predator comes from where it is (or from nearer, if
 * it lives far off) to the prey, at its own speed when it has one: the
 * stretch it covers the ground in is drawn out or cut short (between 0.6
 * and 2 times the stage's own pace) and the rest of the stage moves with it.
 */
export function mealStage(kind: ChaseKind, predator: ActBody, prey: ActBody): MealStage {
    const stage = pacedStage(kind, predator, prey);
    const {moving, travel, ...plain} = stage;
    if (!moving || !travel || !predator.speed || !(predator.speed > 0)) return plain;
    const [from, to] = moving;
    const window = to - from;
    const wanted = Math.min(Math.max(travel / predator.speed, window * 0.6), window * 2);
    const k = wanted / window;
    // Real time to the stage's own: as it was before the stretch, slowed or hurried through it, shifted after.
    const own = (t: number) => (t <= from ? t : t <= from + wanted ? from + (t - from) / k : t - (wanted - window));
    return {
        ...plain,
        seconds: plain.seconds + wanted - window,
        predator: (t) => plain.predator(own(t)),
        prey: (t) => plain.prey(own(t)),
        puffs: (a, b) => plain.puffs(own(a), own(b))
    };
}

function pacedStage(kind: ChaseKind, predator: ActBody, prey: ActBody): PacedStage {
    let dx = prey.x - predator.x;
    let dz = prey.z - predator.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 0.01) {
        dx = Math.sin(predator.yaw);
        dz = Math.cos(predator.yaw);
        distance = 1;
    }
    const dir = {x: dx / distance, z: dz / distance};
    // A slow one starts nearer, so its chase isn't a long crawl across the view.
    const reach = Math.min(kind === "swoop" ? 10 : kind === "dart" ? 7 : 8, predator.speed && predator.speed > 0 ? Math.max(3, predator.speed * 2.6) : Infinity);
    // Never across the island: it comes into view from its side, at most this far off.
    const from = distance > reach ? {x: prey.x - dir.x * reach, z: prey.z - dir.z * reach} : {x: predator.x, z: predator.z};
    const gap = Math.max((predator.length + prey.length) * 0.42, 0.5);
    const face = heading(dir.x, dir.z);
    const span0 = Math.hypot(prey.x - from.x, prey.z - from.z);
    const focusOf = (y: number) => ({x: (from.x + prey.x) / 2, y, z: (from.z + prey.z) / 2});
    // Close enough that both fill the view: the chase across the middle, side on.
    const view = Math.max(6, span0 * 1.05 + 2.5 + Math.max(prey.length, predator.length) * 1.6);

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

    if (kind === "swoop") {
        // From where it flies, or up from where it stands.
        const altitude = predator.base > 2 ? predator.base : Math.max(predator.base, 0) + 8;
        const strikeY = Math.max(prey.base, 0) + prey.height * 0.6;
        const flee = Math.min(prey.length * 0.4, 0.6);
        const caughtAt = 1.95;
        const strike = {x: prey.x + dir.x * flee, z: prey.z + dir.z * flee};
        const preyPose = preyPart(prey, dir, 1.45, caughtAt, flee, prey.base >= 0);
        const start = {x: from.x - dir.x * 2, z: from.z - dir.z * 2};
        return {
            kind,
            seconds: 3.3,
            focus: focusOf(Math.max(prey.base, 0) + 2.5),
            distance: view + 4,
            polar: 1.0,
            predator: (t) => {
                const pose = still(predator);
                pose.yaw = face;
                if (t < 0.8) {
                    // Up into the air, from where it is.
                    const k = smooth(t / 0.8);
                    pose.x = lerp(from.x, start.x, k);
                    pose.z = lerp(from.z, start.z, k);
                    pose.base = lerp(predator.base, altitude, k);
                    pose.pitch = -0.35 * Math.sin(Math.PI * k);
                    pose.yaw = turn(predator.yaw, face, k);
                    return pose;
                }
                if (t < caughtAt) {
                    // The dive: a curve down onto it, nose down, faster toward the end.
                    const k = (t - 0.8) / (caughtAt - 0.8);
                    const e = k * k;
                    const cx = (start.x + strike.x) / 2;
                    const cz = (start.z + strike.z) / 2;
                    const u = 1 - e;
                    pose.x = u * u * start.x + 2 * u * e * cx + e * e * strike.x;
                    pose.z = u * u * start.z + 2 * u * e * cz + e * e * strike.z;
                    pose.base = u * u * altitude + 2 * u * e * (altitude * 0.95) + e * e * strikeY;
                    pose.pitch = 0.55 * Math.sin(Math.PI * Math.min(k * 1.1, 1));
                    return pose;
                }
                // Away again, climbing.
                const k = smooth((t - caughtAt) / (3.3 - caughtAt));
                pose.x = strike.x + dir.x * 6 * k;
                pose.z = strike.z + dir.z * 6 * k;
                pose.base = strikeY + 6 * k;
                pose.pitch = -0.45 * Math.sin(Math.PI * Math.min(k * 1.4, 1));
                return pose;
            },
            prey: preyPose,
            puffs: (a, b) => (a <= caughtAt && caughtAt < b ? [{x: strike.x, y: Math.max(prey.base, 0) + 0.1, z: strike.z, size: prey.length * 1.2, kind: "dust"}] : []),
            // A dive is quicker than a run: it falls as well as flies.
            moving: [0.8, caughtAt],
            travel: (Math.hypot(strike.x - start.x, strike.z - start.z) + (altitude - strikeY)) * 0.5
        };
    }

    if (kind === "dart") {
        const flee = Math.min(prey.length * 0.8, 1.2);
        const caughtAt = 1.45;
        const end = {x: prey.x + dir.x * flee, z: prey.z + dir.z * flee};
        const stop = {x: end.x - dir.x * gap * 0.6, z: end.z - dir.z * gap * 0.6};
        const slow = {x: lerp(from.x, stop.x, 0.35), z: lerp(from.z, stop.z, 0.35)};
        const depth = Math.min(predator.base, -0.05);
        return {
            kind,
            seconds: 2.7,
            focus: focusOf(-0.4),
            distance: view,
            polar: 0.85,
            predator: (t) => {
                const pose = still(predator);
                pose.base = lerp(predator.base, depth, smooth(t / 0.5));
                pose.yaw = turn(predator.yaw, face, smooth(t / 0.5));
                if (t < 0.95) {
                    const k = smooth(t / 0.95);
                    pose.x = lerp(from.x, slow.x, k);
                    pose.z = lerp(from.z, slow.z, k);
                } else if (t < caughtAt) {
                    // The dash.
                    const k = (t - 0.95) / (caughtAt - 0.95);
                    const e = 1 - (1 - k) * (1 - k);
                    pose.x = lerp(slow.x, stop.x, e);
                    pose.z = lerp(slow.z, stop.z, e);
                    pose.roll = 0.12 * Math.sin(k * Math.PI * 3);
                } else {
                    // On through, slowing.
                    const k = 1 - (1 - smooth((t - caughtAt) / (2.7 - caughtAt))) ** 2;
                    pose.x = stop.x + dir.x * 1.8 * k;
                    pose.z = stop.z + dir.z * 1.8 * k;
                }
                return pose;
            },
            prey: preyPart(prey, dir, 0.95, caughtAt, flee, false),
            puffs: (a, b) => (a <= caughtAt && caughtAt < b ? [{x: end.x, y: 0.05, z: end.z, size: prey.length * 1.4 + 0.6, kind: "bubble"}] : []),
            moving: [0, caughtAt],
            travel: Math.hypot(stop.x - from.x, stop.z - from.z)
        };
    }

    // On land: glide, bound or slither to it.
    const caughtAt = kind === "slither" ? 2.7 : 2.05;
    const startle = kind === "slither" ? 1.9 : 1.15;
    const flee = Math.min(prey.length * 0.5, 0.9);
    const end = {x: prey.x + dir.x * flee, z: prey.z + dir.z * flee};
    const stop = {x: end.x - dir.x * gap, z: end.z - dir.z * gap};
    const moveFrom = kind === "slither" ? 0.35 : 0.45;
    const seconds = caughtAt + 1.0;
    const travel = Math.hypot(stop.x - from.x, stop.z - from.z);
    return {
        kind,
        seconds,
        focus: focusOf(Math.max(prey.base, 0) + prey.height * 0.5),
        distance: view,
        polar: 1.1,
        predator: (t) => {
            const pose = still(predator);
            pose.yaw = turn(predator.yaw, face, smooth(t / 0.4));
            const u = span(t, moveFrom, caughtAt);
            if (t < moveFrom) {
                // Readying: low and still.
                pose.pitch = 0.07 * smooth(t / moveFrom);
                pose.x = from.x;
                pose.z = from.z;
                pose.base = groundAt(from.x, from.z);
                return pose;
            }
            if (t < caughtAt) {
                if (kind === "bound") {
                    // Three hops: each an arc, the ground covered in the air.
                    const hops = 3;
                    const h = Math.min(Math.floor(u * hops), hops - 1);
                    const f = u * hops - h;
                    const k = (h + smooth(f)) / hops;
                    pose.x = lerp(from.x, stop.x, k);
                    pose.z = lerp(from.z, stop.z, k);
                    pose.base = groundAt(pose.x, pose.z) + Math.sin(Math.PI * f) * Math.max(predator.length * 0.5, 0.35);
                    pose.pitch = -0.3 * Math.cos(Math.PI * f);
                    return pose;
                }
                if (kind === "slither") {
                    // Slow at first, then the strike: the body's own undulation, and an S across the path.
                    const k = u < 0.8 ? 0.7 * smooth(u / 0.8) : 0.7 + 0.3 * smooth((u - 0.8) / 0.2);
                    const side = Math.sin(k * Math.PI * 3) * predator.length * 0.28 * (1 - k);
                    pose.x = lerp(from.x, stop.x, k) + dir.z * side;
                    pose.z = lerp(from.z, stop.z, k) - dir.x * side;
                    pose.base = groundAt(pose.x, pose.z);
                    pose.yaw = face + 0.45 * Math.cos(k * Math.PI * 3) * (1 - k);
                    return pose;
                }
                // Glide: eased along the ground, with a gait's bob.
                const k = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
                pose.x = lerp(from.x, stop.x, k);
                pose.z = lerp(from.z, stop.z, k);
                const stride = Math.max(predator.length * 0.8, 0.5);
                const bob = Math.abs(Math.sin(k * travel / stride * Math.PI));
                pose.base = groundAt(pose.x, pose.z) + bob * predator.height * 0.07;
                pose.pitch = 0.05 + 0.04 * Math.sin(k * travel / stride * Math.PI * 2);
                return pose;
            }
            // Caught: it stands over it, head down.
            pose.x = stop.x;
            pose.z = stop.z;
            pose.base = groundAt(stop.x, stop.z);
            pose.yaw = face;
            const eat = span(t, caughtAt, caughtAt + 0.3);
            pose.pitch = (kind === "slither" ? 0.05 : 0.14) * eat + 0.03 * Math.sin((t - caughtAt) * 9) * eat;
            return pose;
        },
        prey: preyPart(prey, dir, startle, caughtAt, flee, true),
        moving: [moveFrom, caughtAt],
        travel,
        puffs: (a, b) => {
            const out: Puff[] = [];
            if (kind !== "slither") {
                // Dust from its feet as it goes (on each landing, for a hopper).
                const every = kind === "bound" ? (caughtAt - moveFrom) / 3 : 0.28;
                for (let s = moveFrom + every; s < caughtAt; s += every) {
                    if (a <= s && s < b) {
                        const k = span(s, moveFrom, caughtAt);
                        out.push({x: lerp(from.x, stop.x, k), y: groundAt(lerp(from.x, stop.x, k), lerp(from.z, stop.z, k)), z: lerp(from.z, stop.z, k), size: predator.length * 0.45, kind: "dust"});
                    }
                }
            }
            if (a <= caughtAt && caughtAt < b) out.push({x: end.x, y: groundAt(end.x, end.z), z: end.z, size: (predator.length + prey.length) * 0.6, kind: "dust"});
            return out;
        }
    };
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
