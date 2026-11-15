/**
 * A meal acted out after the catch (`meals.ts` has the rules): where each of the two is, moment by moment, from the
 * catch to the predator's rest. Pure in the catch, the plan and the time since the catch, so every viewer sees the
 * same feeding bouts, the same glances up, the same walk to the water.
 *
 * Phases after the catch (u, seconds):
 *
 * 1. carry (a raptor with a small catch, the strike over water or awkward ground): up with it under its feet, and
 *    down onto dry ground nearby;
 * 2. the meal: swallowed whole (`swallow`: picked up, lifted, down into the mouth; a snake slowly, head first) or fed
 *    on (`feed`: the prey lies on its side, head-down bouts and glances up);
 * 3. a drink when water is near (`drinkSeconds`): a walk to the water's edge, head down to drink;
 * 4. rest: a walk a few body lengths off (or back from the water), lying up.
 *
 * The prey never fades at the catch: it lies where it fell until the meal is over (and any scavengers have been), then
 * fades (`preyAt` with the carcass's end), or is gone into the mouth.
 */

import type {ActPose, ChaseKind, MealStage} from "@/ark-scene/acts";
import {feedBeatAt, feedBouts, mealRandom, type MealPlan} from "@/ark-scene/meals";

export type MealBody = {x: number; z: number; base: number; yaw: number; length: number; height: number};

export type MealCatch = {
    kind: ChaseKind;
    /** Both at the catch (the chase's last frame: `MealStage.predator(catchAt)`, `prey(catchAt)`). */
    predator: MealBody;
    prey: MealBody;
    /** The prey in the water at the catch (a fish). */
    preyInWater: boolean;
    /** The predator swims (a pike, an otter in the water): it eats where it is, in the water. */
    predatorSwims: boolean;
    /** The ground's height (never below the sea: `acts.ts` groundAt). */
    ground: (x: number, z: number) => number;
    /** Dry ground it may stand or lie on. */
    clear: (x: number, z: number) => boolean;
    /** The nearest water's edge it can drink at, within reach (`DRINK_REACH`), or null. */
    water: {x: number; z: number} | null;
    /** Its walking pace (m/s). */
    walk: number;
};

/** How far it goes for a drink after a meal (m). */
export const DRINK_REACH = 25;

export type MealScript = {
    plan: MealPlan;
    c: MealCatch;
    /** Where it eats (a raptor's landing spot; else where it caught it). */
    feed: {x: number; z: number; base: number; yaw: number};
    /** Where the prey lies while it is eaten. */
    carcass: {x: number; z: number; base: number; yaw: number};
    /** The side it lies on (+1 or -1). */
    side: 1 | -1;
    carry: number;
    feedFrom: number;
    feedTo: number;
    drink: {at: {x: number; z: number; yaw: number}; walkFrom: number; from: number; to: number} | null;
    rest: {at: {x: number; z: number; yaw: number}; walkFrom: number; from: number; to: number};
    /** When the predator leaves the carcass (scavengers may come from then), and when its rest is over. */
    leaves: number;
    ends: number;
    bouts: ReturnType<typeof feedBouts>;
};

const smooth = (t: number) => {
    const c = Math.min(Math.max(t, 0), 1);
    return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const heading = (dx: number, dz: number) => Math.atan2(dx, dz);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The nearest spot (round `want`'s bearing) that is clear, at about `distance` from `from`; else `from`. */
function clearSpot(from: {x: number; z: number}, bearing: number, distance: number, clear: (x: number, z: number) => boolean): {x: number; z: number} {
    for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI]) {
        for (const k of [1, 0.6]) {
            const x = from.x + Math.sin(bearing + off) * distance * k;
            const z = from.z + Math.cos(bearing + off) * distance * k;
            if (clear(x, z)) return {x, z};
        }
    }
    return {x: from.x, z: from.z};
}

/** The meal's script from the catch (pure). */
export function mealScript(plan: MealPlan, c: MealCatch): MealScript {
    const random = mealRandom(`${plan.seed}#script`);
    const side: 1 | -1 = random() < 0.5 ? -1 : 1;
    const p = c.predator;
    const q = c.prey;
    // A raptor's small catch, or one struck over the water: carried a little way and brought down on dry ground.
    let feed = {x: p.x, z: p.z, base: p.base, yaw: p.yaw};
    let carry = 0;
    const struckAloft = p.base > c.ground(p.x, p.z) + 0.3;
    if (c.kind === "swoop" && (plan.style === "swallow" || c.preyInWater || !c.clear(q.x, q.z))) {
        const land = c.clear(q.x, q.z) && !c.preyInWater ? {x: q.x, z: q.z} : clearSpot(q, p.yaw, Math.max(p.length * 6, 5), c.clear);
        const yaw = Math.hypot(land.x - p.x, land.z - p.z) > 0.2 ? heading(land.x - p.x, land.z - p.z) : p.yaw;
        feed = {x: land.x, z: land.z, base: c.ground(land.x, land.z), yaw};
        carry = Math.min(Math.max(Math.hypot(land.x - p.x, land.z - p.z) / 6, 1.2), 3);
    } else if (c.kind === "swoop" && struckAloft) {
        // (Mantled on the ground where it struck.)
        feed = {x: p.x, z: p.z, base: c.ground(p.x, p.z), yaw: p.yaw};
        carry = 0.6;
    }
    // The prey lies in front of it, at its mouth (a swallowed one is picked up from there).
    const mouth = p.length * 0.45 + q.length * (plan.style === "swallow" ? 0.1 : 0.3);
    const lies = carry > 0 ? {x: feed.x + Math.sin(feed.yaw) * mouth, z: feed.z + Math.cos(feed.yaw) * mouth} : {x: q.x, z: q.z};
    const carcass = {x: lies.x, z: lies.z, base: c.predatorSwims && c.preyInWater ? q.base : c.ground(lies.x, lies.z), yaw: carry > 0 ? feed.yaw + side * 1.2 : q.yaw};
    const feedFrom = carry;
    const feedTo = carry + plan.feedSeconds;
    let t = feedTo;
    const walk = Math.max(c.walk, 0.2);
    // A drink, when water is near (it walks there).
    let drink: MealScript["drink"] = null;
    if (plan.drinkSeconds > 0 && c.water && !c.predatorSwims && Math.hypot(c.water.x - feed.x, c.water.z - feed.z) <= DRINK_REACH) {
        const d = Math.hypot(c.water.x - feed.x, c.water.z - feed.z);
        const walkFor = Math.min(Math.max(d / walk, 1.5), 30);
        drink = {at: {x: c.water.x, z: c.water.z, yaw: d > 0.1 ? heading(c.water.x - feed.x, c.water.z - feed.z) : feed.yaw}, walkFrom: t, from: t + walkFor, to: t + walkFor + plan.drinkSeconds};
        t = drink.to;
    }
    // The rest: a few body lengths off to one side (back from the water when it drank), lying up.
    const from = drink ? drink.at : feed;
    const bearing = drink ? drink.at.yaw + Math.PI + side * 0.6 : feed.yaw + side * (1.7 + 0.6 * random());
    const at = plan.restSeconds > 0 && !c.predatorSwims ? clearSpot(from, bearing, Math.max(p.length * 2.5, 1.5), c.clear) : {x: from.x, z: from.z};
    const restWalk = Math.hypot(at.x - from.x, at.z - from.z) / walk;
    const restYaw = restWalk > 0.05 ? heading(at.x - from.x, at.z - from.z) + side * 0.8 : from.yaw;
    const rest = {at: {x: at.x, z: at.z, yaw: restYaw}, walkFrom: t, from: t + Math.min(restWalk, 20), to: t + Math.min(restWalk, 20) + plan.restSeconds};
    return {plan, c, feed, carcass, side, carry, feedFrom, feedTo, drink, rest, leaves: feedTo, ends: rest.to, bouts: feedBouts(plan.seed, plan.feedSeconds)};
}

/** What the card says it is doing in each phase (`ark.activity.*`). */
export type MealDoing = "eating" | "drinking" | "resting";

export type MealPose = ActPose & {doing: MealDoing};

/** The predator `u` seconds after the catch (u up to `script.ends`; after that its schedule has it again). */
export function predatorAt(s: MealScript, u: number): MealPose {
    const c = s.c;
    const p = c.predator;
    const base = (x: number, z: number) => (c.predatorSwims ? p.base : c.ground(x, z));
    const pose = (x: number, z: number, yaw: number, state: string, pitch: number, speed: number, doing: MealDoing, y?: number): MealPose => ({x, z, base: y ?? base(x, z), yaw, pitch, roll: 0, scale: 1, dim: 0, hidden: false, state, speed, doing});
    if (u < s.carry) {
        // Up with it (or down from its strike) and onto dry ground.
        const k = smooth(u / s.carry);
        const lift = Math.sin(Math.PI * k) * Math.max(p.length * 2, 1.2);
        const y = lerp(p.base, s.feed.base, k) + lift;
        return pose(lerp(p.x, s.feed.x, k), lerp(p.z, s.feed.z, k), s.feed.yaw, k < 0.85 ? "fly" : "land", -0.2 * Math.sin(Math.PI * k), Math.hypot(s.feed.x - p.x, s.feed.z - p.z) / Math.max(s.carry, 0.1), "eating", y);
    }
    if (u < s.feedTo) {
        const v = u - s.feedFrom;
        if (s.plan.style === "swallow") return {...swallowPose(s, v), doing: "eating"};
        const beat = feedBeatAt(s.bouts, v);
        return pose(s.feed.x, s.feed.z, s.feed.yaw + beat.look, beat.state, beat.pitch, 0, "eating");
    }
    const walkTo = (from: {x: number; z: number}, to: {x: number; z: number; yaw?: number}, a: number, b: number, w: number, doing: MealDoing): MealPose => {
        const k = b > a ? Math.min(Math.max((w - a) / (b - a), 0), 1) : 1;
        const yaw = Math.hypot(to.x - from.x, to.z - from.z) > 0.05 ? heading(to.x - from.x, to.z - from.z) : to.yaw ?? s.feed.yaw;
        return pose(lerp(from.x, to.x, k), lerp(from.z, to.z, k), yaw, "walk", 0, k < 1 ? Math.hypot(to.x - from.x, to.z - from.z) / Math.max(b - a, 0.1) : 0, doing);
    };
    const restFrom = s.drink ? s.drink.at : s.feed;
    if (s.drink && u < s.drink.to) {
        if (u < s.drink.from) return walkTo(s.feed, s.drink.at, s.drink.walkFrom, s.drink.from, u, "drinking");
        // Head down at the edge, lapping (a small bob), looking up now and then.
        const v = u - s.drink.from;
        const up = Math.sin(v * 0.9) > 0.92;
        return pose(s.drink.at.x, s.drink.at.z, s.drink.at.yaw, up ? "scan" : "eat", up ? 0 : 0.16 + 0.02 * Math.sin(v * 7), 0, "drinking");
    }
    if (u < s.rest.from) return walkTo(restFrom, s.rest.at, s.rest.walkFrom, s.rest.from, u, "resting");
    // Lying up, digesting; a slow look round now and then.
    const v = u - s.rest.from;
    const look = Math.sin(v * 0.21 + s.side) > 0.85 ? s.side * 0.25 : 0;
    return pose(s.rest.at.x, s.rest.at.z, s.rest.at.yaw + look, "rest", 0, 0, "resting");
}

/** Where the mouth is: the front of the body, low with its head down, high with it up. */
function mouthOf(s: MealScript, up: number): {x: number; z: number; y: number} {
    const p = s.c.predator;
    const reach = p.length * 0.5;
    return {x: s.feed.x + Math.sin(s.feed.yaw) * reach, z: s.feed.z + Math.cos(s.feed.yaw) * reach, y: s.feed.base + p.height * lerp(0.15, 0.8, up)};
}

/**
 * A swallow, `v` seconds into it: picked up (head down), lifted (head up, the catch turned head first), and down into
 * the mouth with a few gulps; then a pause. A snake keeps its head on the ground and takes it in slowly.
 */
function swallowPose(s: MealScript, v: number): ActPose {
    const S = s.plan.feedSeconds;
    const snake = s.c.kind === "slither";
    const at = (state: string, pitch: number): ActPose => ({x: s.feed.x, z: s.feed.z, base: s.c.predatorSwims ? s.c.predator.base : s.c.ground(s.feed.x, s.feed.z), yaw: s.feed.yaw, pitch, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0});
    if (snake) return at("eat", 0.03 + 0.015 * Math.sin(v * 1.7));
    const u = v / S;
    if (u < 0.2) return at("eat", 0.14 * smooth(u / 0.08));
    if (u < 0.85) {
        // Head up and back, a gulp every so often.
        const k = smooth((u - 0.2) / 0.1);
        return at("scan", -0.22 * k + 0.05 * Math.max(Math.sin(v * 6), 0) * k);
    }
    return at("scan", -0.22 * (1 - smooth((u - 0.85) / 0.15)));
}

/**
 * The prey `u` seconds after the catch: at the predator's feet while it is carried; lying on its side where it is fed
 * on, until `carcassEnd` (the predator gone and any scavengers too), then fading; or picked up and gone into the mouth.
 * `atCatch` is its pose at the catch (from the chase).
 */
export function preyAt(s: MealScript, u: number, atCatch: ActPose, carcassEnd: number): ActPose {
    const q = s.c.prey;
    const lying = (k: number): ActPose => ({x: s.carcass.x, z: s.carcass.z, base: s.carcass.base, yaw: s.carcass.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: "lie", speed: 0, lying: s.side * k});
    if (u < s.carry) {
        // Under its feet as it goes.
        const pred = predatorAt(s, u);
        return {...atCatch, x: pred.x, z: pred.z, base: pred.base - q.height * 0.4, yaw: pred.yaw, dim: 0, scale: 1, hidden: false, state: "lie", speed: 0};
    }
    if (s.plan.style === "swallow") {
        const v = u - s.feedFrom;
        const S = s.plan.feedSeconds;
        const snake = s.c.kind === "slither";
        if (snake) {
            // Head first into the jaws: it slides along the snake's way, smaller as it goes in.
            const k = smooth((v / S - 0.1) / 0.85);
            const mouth = mouthOf(s, 0);
            const into = q.length * 0.5 * k;
            return {...lying(1), x: mouth.x - Math.sin(s.feed.yaw) * into, z: mouth.z - Math.cos(s.feed.yaw) * into, yaw: s.feed.yaw, lying: 0, scale: Math.max(1 - 0.92 * k, 0.05), hidden: k >= 0.99};
        }
        const w = v / S;
        if (w < 0.2) return {...lying(smooth(w / 0.06)), x: mouthOf(s, 0).x, z: mouthOf(s, 0).z};
        // Lifted in the bill or jaws (turned head first), then down: smaller and into the mouth.
        const lift = smooth((w - 0.2) / 0.12);
        const gulp = smooth((w - 0.35) / 0.5);
        const mouth = mouthOf(s, lift);
        return {x: mouth.x - Math.sin(s.feed.yaw) * q.length * 0.3 * gulp, z: mouth.z - Math.cos(s.feed.yaw) * q.length * 0.3 * gulp, base: mouth.y - q.height * 0.5, yaw: s.feed.yaw + Math.PI * (1 - lift) * 0.5, pitch: -0.5 * lift, roll: 0, scale: Math.max(1 - 0.9 * gulp, 0.05), dim: 0, hidden: w >= 0.85, state: "lie", speed: 0, lying: 0};
    }
    // Fed on: down onto its side over the first moment after the catch (from the height it was caught at), and it stays.
    const down = smooth((u - s.carry) / 0.8);
    const pose = lying(down);
    if (s.carry === 0) pose.base = lerp(atCatch.base, s.carcass.base, smooth((u - s.carry) / 0.4));
    if (u >= carcassEnd) {
        const k = smooth((u - carcassEnd) / 2.5);
        pose.dim = 0.6 * k;
        pose.scale = 1 - 0.35 * k;
        pose.base -= q.height * 0.3 * k;
        pose.hidden = u >= carcassEnd + 2.5;
    }
    return pose;
}

/** How long the meal holds the predator, catch to the end of its rest (s). */
export function mealSeconds(s: MealScript): number {
    return s.ends;
}

/** The angle a heading turns through (for tests). */
export const turnOf = (a: number, b: number) => Math.abs(wrap(b - a));

// MARK: Scavengers

export type ScavengeVisit = {
    id: string;
    flies: boolean;
    length: number;
    height: number;
    /** Where its schedule had it when it set off (u = `start`). */
    from: {x: number; z: number; base: number; yaw: number};
    /** Where it feeds: at the carcass's edge, on its side away from the way it came. */
    at: {x: number; z: number; base: number; yaw: number};
    start: number;
    arrive: number;
    leave: number;
    bouts: ReturnType<typeof feedBouts>;
};

/** A scavenger's visit (pure): on its way (walking, or flying in and landing), feeding with glances up, then off. */
export function scavengeVisit(input: {id: string; seed: string; flies: boolean; length: number; height: number; walk: number; from: {x: number; z: number; base: number; yaw: number}; carcass: {x: number; z: number; base: number}; carcassLength: number; start: number; feedSeconds: number; ground: (x: number, z: number) => number}): ScavengeVisit {
    const dx = input.carcass.x - input.from.x;
    const dz = input.carcass.z - input.from.z;
    const d = Math.max(Math.hypot(dx, dz), 0.01);
    const towards = heading(dx, dz);
    // Short of the carcass by half of each (it feeds at its edge, facing it).
    const stop = input.carcassLength * 0.5 + input.length * 0.45;
    const at = {x: input.carcass.x - Math.sin(towards) * stop, z: input.carcass.z - Math.cos(towards) * stop, yaw: towards};
    const pace = input.flies ? Math.max(input.walk * 6, 6) : Math.max(input.walk, 0.4);
    const travel = Math.min(Math.max(Math.max(d - stop, 0) / pace, 3), 25);
    return {id: input.id, flies: input.flies, length: input.length, height: input.height, from: input.from, at: {...at, base: input.ground(at.x, at.z)}, start: input.start, arrive: input.start + travel, leave: input.start + travel + input.feedSeconds, bouts: feedBouts(`${input.seed}:${input.id}`, input.feedSeconds)};
}

/** A scavenger `u` seconds after the catch, from its start to `leave` (then the scene walks it back to its schedule). */
export function scavengerAt(v: ScavengeVisit, u: number): ActPose {
    if (u < v.arrive) {
        const k = smooth((u - v.start) / Math.max(v.arrive - v.start, 0.1));
        const x = lerp(v.from.x, v.at.x, k);
        const z = lerp(v.from.z, v.at.z, k);
        const yaw = heading(v.at.x - v.from.x + 1e-9, v.at.z - v.from.z);
        // A flyer comes in high and glides down to land; a walker walks.
        const y = lerp(v.from.base, v.at.base, k) + (v.flies ? Math.sin(Math.PI * Math.min(k * 1.1, 1)) * Math.max(6, v.length * 8) * (1 - k * 0.3) : 0);
        const speed = Math.hypot(v.at.x - v.from.x, v.at.z - v.from.z) / Math.max(v.arrive - v.start, 0.1);
        return {x, z, base: y, yaw, pitch: v.flies ? 0.1 * (k > 0.8 ? -1 : 1) : 0, roll: 0, scale: 1, dim: 0, hidden: false, state: v.flies ? (k > 0.88 ? "land" : k > 0.55 ? "glide" : "fly") : "walk", speed};
    }
    const beat = feedBeatAt(v.bouts, u - v.arrive);
    return {x: v.at.x, z: v.at.z, base: v.at.base, yaw: v.at.yaw + beat.look, pitch: beat.pitch, roll: 0, scale: 1, dim: 0, hidden: false, state: beat.state, speed: 0};
}

// MARK: On the stage

/** The doing a hunter's pose says (the card), from the chase into the meal. */
const DOING_KEY: Record<MealDoing, NonNullable<ActPose["meal"]>> = {eating: "eating", drinking: "drinking", resting: "resting"};

/**
 * The chase and the meal as one stage: the chase (`acts.ts` mealStage with `meal: true`) up to the catch, then the
 * script. `carcassEnd` is when the prey goes (u after the catch); a stage played in a replay shows `show` seconds of
 * the meal (it is a summary); the live world plays it all.
 */
export function mealOnStage(stage: MealStage, script: MealScript, show: number, carcassEnd: number): MealStage {
    const at = stage.catchAt ?? stage.seconds;
    const catchPrey = stage.prey(at);
    return {
        ...stage,
        seconds: at + show,
        predator: (t) => {
            if (t < at) {
                const p = stage.predator(t);
                return p ? {...p, meal: "hunting"} : p;
            }
            const pose = predatorAt(script, t - at);
            return {...pose, meal: DOING_KEY[pose.doing]};
        },
        prey: (t) => (t < at ? stage.prey(t) : preyAt(script, t - at, catchPrey, carcassEnd))
    };
}
