/**
 * How sleep looks (visual only; docs/ark/sleep.md). The shared schedule says
 * who is asleep and where (`behaviour-schedule.ts`: its roost, its slot, the
 * night watch); this says how that looks, the same for every viewer:
 *
 * - its posture, per species from stored data (`sleep.json`, made by
 *   `scripts/ark-sleep-styles.mts`): lying on its chest or its side, curled,
 *   standing, on one leg, the head tucked, hanging, afloat on its back, on
 *   the bottom or still in the water column, upright in the water. Some
 *   species take another of their postures on some nights (seeded by the
 *   animal and the night);
 * - the way into it and out of it: lying down and getting up over a time by
 *   its size (eyes shut last, open first), never a jump; a startled get-up
 *   is quick;
 * - its eyes shut (for the ones with eyelids), its breath (slower and deeper
 *   for bigger animals), and now and then a stir: the head lifts and
 *   settles, the body shifts, the tail flicks;
 * - how it sleeps with its kind (`social`): huddled, piled, in a row along a
 *   branch, clustered (the schedule's roosts use `sleepSpacing`);
 * - what the tap card says ("Asleep in its den", "Resting", "Dozing in the
 *   sun", "Keeping watch": `restStatus`).
 *
 * The rig clips win when the rig has them (`sleepClips`: the rigging lane's
 * v6 `lie_down`, `lie`, `sleep`, `get_up`); until then it is procedural: the
 * body lowered, rolled for side-lying and bent for a curl, the head lowered
 * or turned back through the look chain within its limits.
 *
 * Pure: ids, the shared world clock and the stored rows in, numbers out.
 */

import data from "@/ark-scene/sleep.json";
import {hashString} from "@/ark-scene/world";

export const SLEEP_POSTURES = ["sternal", "side", "curl", "stand", "one_leg", "tuck", "hang", "float_back", "sit", "flat", "bottom", "hover", "bottle", "still"] as const;
export type SleepPosture = (typeof SLEEP_POSTURES)[number];
export type SleepSocial = "apart" | "huddle" | "pile" | "row" | "cluster";

export type SleepStyle = {
    posture: SleepPosture;
    /** Other postures it takes on some nights (a lion on its side, on its chest, or curled). */
    alts: SleepPosture[];
    social: SleepSocial;
    /** It shuts its eyes (eyelids: mammals, birds, turtles, crocodilians, most lizards, frogs). */
    eyes: boolean;
    /** A mammal (its young sleep against the adult they keep to). */
    mammal: boolean;
    /** Its breath against a mammal's of its size (0: no chest to rise: gills, an insect). */
    breath: number;
};

const ROWS = (data as {species: Record<string, string>}).species;
const STYLES = new Map<string, SleepStyle>();
const STILL: SleepStyle = Object.freeze({posture: "still", alts: [], social: "apart", eyes: false, mammal: false, breath: 0}) as SleepStyle;

export function decodeSleepRow(row: string): SleepStyle {
    const [posture = "still", alts = "", social = "", flags = "", breath = ""] = row.split("|");
    const known = (p: string): p is SleepPosture => (SLEEP_POSTURES as readonly string[]).includes(p);
    return {
        posture: known(posture) ? posture : "still",
        alts: alts ? alts.split(",").filter(known) : [],
        social: (["huddle", "pile", "row", "cluster"].includes(social) ? social : "apart") as SleepSocial,
        eyes: flags.includes("e"),
        mammal: flags.includes("m"),
        breath: breath ? Number(breath) || 0 : 0
    };
}

/** A species' sleep style (a species with no row keeps still, eyes as drawn). */
export function sleepStyle(slug: string): SleepStyle {
    let hit = STYLES.get(slug);
    if (!hit) {
        const row = ROWS[slug];
        hit = row ? Object.freeze(decodeSleepRow(row)) : STILL;
        STYLES.set(slug, hit);
    }
    return hit;
}

// MARK: The night's posture

/** One night (or day, for a night animal) of sleep: its posture is the same from lying down to getting up. */
const BOUT_SECONDS = 6 * 3600;

/**
 * The posture it takes this bout (its usual one most nights; one of its others on some, seeded by its id and the
 * bout), and which way: the side it lies on or curls to (+1 its left), and its head (0 up, 1 to its flank, 2 down).
 */
export function sleepPostureFor(id: string, slug: string, epochSeconds: number): {posture: SleepPosture; side: 1 | -1; head: 0 | 1 | 2} {
    const style = sleepStyle(slug);
    const bout = Math.floor(epochSeconds / BOUT_SECONDS);
    const h = hashString(`${id}#sleep#${bout}`);
    const u = (h % 1000) / 1000;
    let posture = style.posture;
    // Its usual posture 60% of nights, its others share the rest.
    if (style.alts.length && u >= 0.6) posture = style.alts[Math.min(Math.floor(((u - 0.6) / 0.4) * style.alts.length), style.alts.length - 1)];
    return {posture, side: (h >> 10) & 1 ? 1 : -1, head: (((h >> 11) % 3) as 0 | 1 | 2)};
}

/**
 * What a posture does to the body (procedural, until its clips): how far it is lowered (a share of its height), its
 * roll onto a side, its nose up (−) or down (+), its head (yaw toward its flank, pitch: + up), the spine's bend (a
 * curl, radians each half), how deep it breathes, whether it is lying (its clips go by `lie_down`/`get_up`), and
 * whether it is in the water (its depth band's).
 */
export type PostureSpec = {drop: number; roll: number; pitch: number; headYaw: number; headPitch: number; curl: number; breath: number; lying: boolean; water: boolean};

const P = (s: Partial<PostureSpec>): PostureSpec => Object.freeze({drop: 0, roll: 0, pitch: 0, headYaw: 0, headPitch: 0, curl: 0, breath: 1, lying: false, water: false, ...s}) as PostureSpec;
export const POSTURE_SPECS: Record<SleepPosture, PostureSpec> = {
    // On its chest, the legs folded under (they go under the body: into the ground, out of sight).
    sternal: P({drop: 0.4, roll: 0.06, headPitch: -0.12, lying: true}),
    // Flat on its side, the legs out.
    side: P({drop: 0.44, roll: 1.25, headPitch: -0.05, breath: 1.2, lying: true}),
    // Curled: low, leaning a little, the spine bent round and the head back to the flank.
    curl: P({drop: 0.46, roll: 0.22, headYaw: 1.1, headPitch: -0.35, curl: 1.05, lying: true}),
    // Standing: a little sag, the head low.
    stand: P({drop: 0.025, roll: 0.03, headPitch: -0.35, breath: 0.8}),
    // On one leg, the head sunk into the shoulders and turned back.
    one_leg: P({drop: 0.03, roll: 0.035, headYaw: 0.45, headPitch: -0.3, breath: 0.7}),
    // A bird sitting or perched: down on its legs, the head turned back or sunk.
    tuck: P({drop: 0.22, headYaw: 1.6, headPitch: -0.3, breath: 0.8}),
    // Hanging (the recipes' attitude turns it over): nothing more.
    hang: P({breath: 0.6}),
    // Afloat on its back (the recipes' roll): the paws up.
    float_back: P({breath: 0.8, water: true}),
    // A primate sitting hunched.
    sit: P({drop: 0.18, pitch: 0.12, headPitch: -0.5, curl: 0.25}),
    // A reptile or a frog, belly down.
    flat: P({drop: 0.1, headPitch: -0.08, breath: 0.6, lying: true}),
    // A fish on the bottom.
    bottom: P({breath: 0, water: true}),
    // A fish hanging still, a little nose down.
    hover: P({pitch: 0.05, breath: 0, water: true}),
    // Upright in the water, the head at the surface (a sperm whale, a seal bottling).
    bottle: P({pitch: -1.3, breath: 0.6, water: true}),
    still: P({breath: 0})
};

/** Its head asleep (yaw toward its flank, pitch: + up), by its posture and the night's head choice. */
export function sleepHead(spec: PostureSpec, side: 1 | -1, head: 0 | 1 | 2, posture: SleepPosture): {yaw: number; pitch: number} {
    if (posture === "sternal") {
        // Head up and resting, back to its flank, or the chin down.
        if (head === 1) return {yaw: 1.0 * side, pitch: -0.3};
        if (head === 2) return {yaw: 0.15 * side, pitch: -0.5};
        return {yaw: 0.1 * side, pitch: -0.08};
    }
    if (posture === "tuck" && head === 2) return {yaw: 0.1 * side, pitch: -0.42};
    return {yaw: spec.headYaw * side, pitch: spec.headPitch};
}

/**
 * The rig's sleep clips for a posture, best first (the rigging lane's v6 names, contract section 8.2): the night's
 * posture when the rig has it (a lion on its side tonight plays `sleep_side`, through `side_down`), else its kind's
 * plain `sleep`. The rig player's base poses take it down and up (`baseStep`: `lie_down`, `get_up`, `get_up_fast`).
 */
export function sleepPostureClips(posture: SleepPosture): readonly string[] {
    return POSTURE_CLIPS[posture];
}
const POSTURE_CLIPS: Record<SleepPosture, readonly string[]> = {
    sternal: ["sleep"],
    side: ["sleep_side", "sleep"],
    curl: ["sleep_curl", "sleep"],
    stand: ["sleep_stand"],
    one_leg: ["sleep_one_leg", "sleep"],
    tuck: ["sleep_tuck", "sleep"],
    hang: ["sleep_hang"],
    float_back: ["sleep_float"],
    sit: ["sleep"],
    flat: ["sleep", "bask"],
    bottom: [],
    hover: [],
    bottle: [],
    still: []
};

// MARK: Lying down and getting up

/** How long it takes to lie down (s): bigger animals take longer (a mouse 1.1 s, a deer 2 s, an elephant 3.5). */
export function lieDownSeconds(length: number, lying: boolean): number {
    if (!lying) return 1.2;
    return Math.min(Math.max(1.0 + 0.55 * Math.sqrt(Math.max(length, 0.05)) * 1.5, 1.1), 3.5);
}
/** Getting up: a little quicker; startled, a third of a second. */
export function getUpSeconds(length: number, lying: boolean, startled: boolean): number {
    if (startled) return 0.35;
    return lieDownSeconds(length, lying) * 0.75;
}

/**
 * One frame of the way in or out: `t` (0 awake … 1 asleep) moves at a constant rate toward its target, so it starts
 * and ends at once (no long tail) and the stages below ease within it.
 */
export function stepSleep(t: number, asleep: boolean, dt: number, seconds: number): number {
    const rate = dt / Math.max(seconds, 0.05);
    return asleep ? Math.min(t + rate, 1) : Math.max(t - rate, 0);
}

const smooth = (a: number, b: number, x: number) => {
    const k = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return k * k * (3 - 2 * k);
};

/**
 * The stages of lying down within `t` (getting up runs them back): the body goes down first, the head after, the eyes
 * shut last. Each 0…1, continuous in `t`: no stage ever jumps.
 */
export function sleepStages(t: number): {body: number; head: number; eyes: number; roll: number} {
    return {body: smooth(0, 0.7, t), head: smooth(0.35, 0.95, t), eyes: smooth(0.75, 1, t), roll: smooth(0.25, 1, t)};
}

// MARK: Breath and stirs

/**
 * Its breaths a second asleep: a mammal's by its length (about 15 a minute for a lion, 10 for an elephant, 50 for a
 * mouse), times its style's factor; slower than awake. 0: none.
 */
export function breathRate(length: number, factor: number): number {
    if (!factor) return 0;
    return Math.min(Math.max(0.29 * Math.pow(Math.max(length, 0.05), -0.4), 0.09), 0.9) * Math.min(factor, 1.3) * (factor < 0.5 ? 0.8 : 1);
}

/**
 * A stir now (shared: its id and the world clock). Every 25–70 s of sleep (each gap its own) it stirs for a few
 * seconds: the head lifts and settles (`lift` 0…1) or the tail flicks (`flick` 0…1), or it only shifts; each stir
 * settles it on a slightly new heading (`shift`, radians, eased during the stir and kept).
 */
const STIR_PERIOD = 47;
/** Each animal's stir for its current period, worked out once a period (the hashes are most of a sleeper's cost). */
const STIRS = new Map<string, {k: number; offset: number; at: number; kind: number; from: number; to: number}>();
export function sleepStir(id: string, epochSeconds: number): {lift: number; shift: number; flick: number} {
    let memo = STIRS.get(id);
    const offset = memo ? memo.offset : ((hashString(`${id}#stir`) % 1000) / 1000) * STIR_PERIOD;
    const k = Math.floor((epochSeconds + offset) / STIR_PERIOD);
    if (!memo || memo.k !== k) {
        if (STIRS.size > 4096) STIRS.clear();
        const h = hashString(`${id}#stir#${k}`);
        const shiftOf = (n: number) => (((hashString(`${id}#shift#${n}`) % 1000) / 1000) - 0.5) * 0.4;
        memo = {k, offset, at: 4 + ((h % 1000) / 1000) * (STIR_PERIOD - 12), kind: (h >> 10) % 4, from: shiftOf(k - 1), to: shiftOf(k)};
        STIRS.set(id, memo);
    }
    const u = (epochSeconds + offset - k * STIR_PERIOD - memo.at) / 3.2;
    const pulse = u > 0 && u < 1 ? Math.sin(Math.PI * u) ** 2 : 0;
    // Every stir settles it on a slightly new heading: eased from the last stir's to this one's during the stir, then kept.
    const shift = memo.from + (memo.to - memo.from) * smooth(0, 1, u);
    return {lift: memo.kind === 0 || memo.kind === 3 ? pulse : 0, shift, flick: memo.kind === 2 ? pulse : 0};
}

// MARK: Sleeping together

/**
 * How close its group sleeps round its leader, against the schedule's usual spread (1): huddled and piled bodies
 * touch (a pig pile, penguins in a huddle), a young mammal sleeps against the adult it keeps to.
 */
export function sleepSpacing(slug: string, young = false): number {
    const social = sleepStyle(slug).social;
    if (social === "huddle" || social === "pile" || social === "cluster" || social === "row") return 0.45;
    return young && sleepStyle(slug).mammal ? 0.45 : 1;
}

/** Sleeping in a row or a cluster on a raised roost: its leader's perch, offset along it (`row`) or round it. */
export function roostOffset(slug: string, rank: number, length: number, yaw: number): {dx: number; dz: number; dy: number} | null {
    const social = sleepStyle(slug).social;
    if (social === "apart" || rank <= 0) return null;
    if (social === "cluster") {
        // A bat's cluster: packed round the leader's hang point, a little below one another.
        const a = rank * 2.39996;
        const d = length * 0.42 * Math.sqrt(rank);
        return {dx: Math.cos(a) * d, dz: Math.sin(a) * d, dy: -0.03 * length * (rank % 3)};
    }
    // Side by side along the limb, one either side of the leader in turn, about a body's width apart.
    const step = Math.ceil(rank / 2) * (rank % 2 ? 1 : -1) * length * 0.42;
    return {dx: Math.sin(yaw + Math.PI / 2) * step, dz: Math.cos(yaw + Math.PI / 2) * step, dy: 0};
}

// MARK: What the tap card says

export type ArkRestStatus =
    | "asleep"
    | "asleep_den"
    | "asleep_burrow"
    | "asleep_perch"
    | "asleep_hanging"
    | "asleep_standing"
    | "asleep_one_leg"
    | "asleep_water"
    | "asleep_huddle"
    | "resting"
    | "resting_den"
    | "dozing_sun"
    | "basking"
    | "on_watch";

export type RestStatusInput = {
    asleep: boolean;
    /** The schedule's doing (rest, bask, watch, sleep…). */
    doing?: string | null;
    /** Settled at its roost, and whether the roost hides it (`restingAtRoost`). */
    atRoost?: boolean;
    enclosed?: boolean;
    /** Its profile's roost kind (den, burrow, tree, cave…). */
    roost?: string | null;
    posture?: SleepPosture | null;
    social?: SleepSocial;
    /** Drawn on a raised perch (a branch), and in the water. */
    raised?: boolean;
    inWater?: boolean;
    /** The sun up, not raining. */
    sunny?: boolean;
};

/** Its rest in plain words for the tap card's "Right now" (null: it is up and about). */
export function restStatus(input: RestStatusInput): ArkRestStatus | null {
    if (input.asleep) {
        if (input.enclosed) return input.roost === "burrow" ? "asleep_burrow" : "asleep_den";
        if (input.posture === "hang") return "asleep_hanging";
        if (input.inWater || input.posture === "float_back" || input.posture === "bottom" || input.posture === "hover" || input.posture === "bottle") return "asleep_water";
        if (input.social === "huddle" || input.social === "pile") return "asleep_huddle";
        if (input.posture === "one_leg") return "asleep_one_leg";
        if (input.posture === "stand") return "asleep_standing";
        if (input.raised) return "asleep_perch";
        return "asleep";
    }
    if (input.doing === "watch") return "on_watch";
    if (input.doing === "bask") return "basking";
    if (input.doing === "rest") {
        if (input.enclosed) return "resting_den";
        return input.sunny && !input.inWater && !input.raised ? "dozing_sun" : "resting";
    }
    return null;
}

// MARK: One animal, frame by frame (the scene's)

/** Its sleep now: how far into it (`t`), its posture for this bout, and which way it is going. */
export type SleepNow = {t: number; posture: SleepPosture; side: 1 | -1; head: 0 | 1 | 2; spec: PostureSpec; down: boolean; startled: boolean};

export type SleepStepInput = {
    id: string;
    slug: string;
    /** Drawn length (m). */
    length: number;
    /** Asleep now: the shared layer has it asleep, and nothing woke it here. */
    asleep: boolean;
    /** Woken with a start (`reactive.ts`): the quick get-up. */
    startled: boolean;
    /** The world clock (epoch seconds, shared). */
    epoch: number;
    dt: number;
    /** Reduced motion: straight to the posture, no transition, no stirs. */
    reduced: boolean;
};

/** One frame of an animal's sleep: null while awake and up; its posture is chosen as it starts to lie down. */
export function stepSleepNow(now: SleepNow | null, input: SleepStepInput): SleepNow | null {
    if (!now) {
        if (!input.asleep) return null;
        const pick = sleepPostureFor(input.id, input.slug, input.epoch);
        now = {t: 0, ...pick, spec: POSTURE_SPECS[pick.posture], down: true, startled: false};
    }
    now.down = input.asleep;
    if (input.startled) now.startled = true;
    if (input.reduced) now.t = input.asleep ? 1 : 0;
    else {
        const lying = now.spec.lying;
        const seconds = input.asleep ? lieDownSeconds(input.length, lying) : getUpSeconds(input.length, lying, now.startled);
        now.t = stepSleep(now.t, input.asleep, input.dt, seconds);
    }
    if (now.t <= 0 && !input.asleep) return null;
    if (input.asleep) now.startled = false;
    return now;
}

/** What the scene draws of its sleep this frame. */
export type SleepDraw = {
    /** Its legs' share of its height taken down (`lyingDrop`), its roll (− its left side down: three.js turns +y toward −x), nose down (+), and its heading's shift. */
    legs: number;
    roll: number;
    pitch: number;
    yaw: number;
    /** Its head (yaw: + to its left; pitch: + up) and how much of it is drawn (0…1). */
    headYaw: number;
    headPitch: number;
    headWeight: number;
    /** The shader's `arkSleep`: eyes shut 0…1, the curl (radians each half, + toward its left), a tail flick 0…1, breaths a second. */
    eyes: number;
    curl: number;
    flick: number;
    breath: number;
};

/**
 * Its sleep as drawn: the posture's body (lowered, rolled, nosed down) and head by the stages of lying down, its eyes,
 * curl, breath, and its stirs once fully asleep (the head lifting a little with the eyes half open, a new heading, a
 * tail flick). `procedural` 0…1: how much of the body and head the scene draws (a rig with lying clips does them:
 * `sleepClip`). Pure in (its state, its id, the world clock).
 */
export function sleepDraw(now: SleepNow, input: {id: string; slug: string; length: number; epoch: number; procedural: number; reduced: boolean; legShare?: number | null}): SleepDraw {
    const style = sleepStyle(input.slug);
    const spec = now.spec;
    const stages = sleepStages(now.t);
    const settled = smooth(0.9, 1, now.t);
    const stir = input.reduced ? {lift: 0, shift: 0, flick: 0} : sleepStir(input.id, input.epoch);
    const lift = stir.lift * settled;
    const head = sleepHead(spec, now.side, now.head, now.posture);
    const k = Math.min(Math.max(input.procedural, 0), 1);
    const headWeight = stages.head * k;
    return {
        legs: proceduralDrop(spec, input.legShare) * stages.body * k,
        // (All of it gives way to a clip, the roll too: half of it stayed on under a sleep clip, so a rig lying on
        // its side by its own `sleep_side` was turned a further 36 degrees, past its side.)
        roll: -proceduralRoll(spec) * now.side * stages.roll * k,
        pitch: spec.pitch * stages.body * k,
        yaw: stir.shift * settled,
        headYaw: head.yaw * (1 - 0.5 * lift),
        headPitch: head.pitch * (1 - 0.75 * lift) + 0.08 * lift,
        headWeight,
        eyes: style.eyes ? stages.eyes * (1 - 0.7 * lift) : 0,
        curl: spec.curl * now.side * stages.roll * k,
        flick: stir.flick * settled,
        // (A rig's sleep clip breathes itself: `breath_hz`, one breath a loop.)
        breath: spec.breath > 0 && k > 0.5 ? breathRate(input.length, style.breath) : 0
    };
}

/**
 * The most a procedural body leans onto a side (radians, about 20 degrees). Its legs are its standing mesh's: they
 * cannot be folded or laid out, so turned onto its side (the `side` posture's 72 degrees) they stood out stiff, up in
 * the air (the behaviours pass: a rabbit "on its back", its rig playing its idle under the turn). Flat on its side
 * is a clip's (`sleep_side`); without one it lies on its chest, leaning.
 */
export const PROCEDURAL_ROLL_MOST = 0.35;
/** How far into the ground a body lying on it is pressed (a share of its height): it rests on it, never hovers a hair over it. */
export const LYING_PRESS = 0.015;
/** The most of its height a procedural body is lowered by, whatever its mesh says (a mesh read wrongly never buries it). */
export const PROCEDURAL_DROP_MOST = 0.62;

/** A posture's roll as the procedural body takes it: within `PROCEDURAL_ROLL_MOST`. */
export function proceduralRoll(spec: PostureSpec): number {
    return Math.min(spec.roll, PROCEDURAL_ROLL_MOST);
}

/**
 * How much of its height a procedural body is lowered by (the legs' share that goes under it). `legShare`: how high
 * its own underside is over its feet, as a share of its height (`bodyLegShare`, from its mesh). Lying (on its chest,
 * curled, flat) it comes down by exactly that, so its chest meets the ground with its legs under it, out of sight;
 * sitting, tucked or standing it comes down by its posture's share, never further than its underside. With no mesh to
 * read: its posture's share, as before.
 *
 * (The behaviours pass, 2026-11-14: one share for every body, 0.4 of the height on its chest, left a deer's legs cut
 * off at the grass with its body still in the air (its underside is half its height up), sank a pig's belly a tenth of
 * its height into the ground, and cut a flamingo's legs in half as it "sat".)
 */
export function proceduralDrop(spec: PostureSpec, legShare?: number | null): number {
    if (typeof legShare !== "number" || !Number.isFinite(legShare)) return spec.drop;
    const share = Math.min(Math.max(legShare, 0), PROCEDURAL_DROP_MOST);
    return spec.lying ? Math.min(share + LYING_PRESS, PROCEDURAL_DROP_MOST) : Math.min(spec.drop, share);
}

/** A mesh as `bodyLegShare` reads it (three's BufferGeometry fits). */
export type SleepGeometry = {
    boundingBox: {min: {x: number; y: number; z: number}; max: {x: number; y: number; z: number}} | null;
    getAttribute(name: string): {count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number} | undefined;
};
const LEG_SHARES = new WeakMap<object, number | null>();

/**
 * How high a model's underside is over its feet, as a share of its height (x across, y up, z along), from its own
 * mesh: over the stretch of its length between its feet (the middle of its footprint, `grounding/base.ts`; with none,
 * the middle of its length) and the middle of its width, the height that all but the lowest twentieth of its points
 * are above. Between a deer's fore and hind legs that is its belly; a bird's legs stand in that stretch, so it reads
 * low and the bird keeps its feet. Worked out once per mesh; null with too few points to tell.
 */
export function bodyLegShare(geometry: SleepGeometry, footprint?: {z0: number; z1: number} | null): number | null {
    const known = LEG_SHARES.get(geometry);
    if (known !== undefined) return known;
    const share = undersideShare(geometry, footprint ?? null);
    LEG_SHARES.set(geometry, share);
    return share;
}

export function undersideShare(geometry: SleepGeometry, footprint: {z0: number; z1: number} | null): number | null {
    const box = geometry.boundingBox;
    const points = geometry.getAttribute("position");
    if (!box || !points || points.count < 24) return null;
    const height = box.max.y - box.min.y;
    const length = box.max.z - box.min.z;
    const width = box.max.x - box.min.x;
    if (!(height > 0) || !(length > 0)) return null;
    const between = footprint && footprint.z1 > footprint.z0;
    const zc = between ? (footprint!.z0 + footprint!.z1) / 2 : (box.min.z + box.max.z) / 2;
    const reach = between ? Math.max((footprint!.z1 - footprint!.z0) * 0.18, length * 0.05) : length * 0.1;
    const cx = (box.min.x + box.max.x) / 2;
    const across = Math.max(width * 0.3, 1e-6);
    // (Every n-th point of a big mesh: a few thousand say as much.)
    const step = Math.max(1, Math.floor(points.count / 6000));
    const heights: number[] = [];
    for (let i = 0; i < points.count; i += step) {
        if (Math.abs(points.getZ(i) - zc) > reach || Math.abs(points.getX(i) - cx) > across) continue;
        heights.push(points.getY(i));
    }
    if (heights.length < 8) return null;
    heights.sort((a, b) => a - b);
    const low = heights[Math.floor(heights.length * 0.05)];
    return Math.min(Math.max((low - box.min.y) / height, 0), PROCEDURAL_DROP_MOST);
}

/**
 * How far to lower a model lying down (model units, before its scale): its torso (the box above its legs' share of
 * the height, a little inside its width) turned by the roll about the model's origin, so the lowest of it meets the
 * ground where its feet stood. 0 standing. (Never under 0 into the ground: a wide body leaning with no legs to take
 * down had its low side up to 7% of its height under the ground; it is raised to rest on it instead.)
 */
export function lyingDrop(box: {minX: number; maxX: number; minY: number; maxY: number}, legs: number, roll: number): number {
    if (legs <= 0 && Math.abs(roll) < 1e-4) return 0;
    return torsoLowest(box, legs, roll) - box.minY;
}

/** The lowest point of its torso (the box above its legs' share, three quarters of its width) turned by the roll about the model's origin. */
export function torsoLowest(box: {minX: number; maxX: number; minY: number; maxY: number}, legs: number, roll: number): number {
    const height = box.maxY - box.minY;
    const cx = (box.minX + box.maxX) / 2;
    const hw = ((box.maxX - box.minX) / 2) * 0.75;
    const bottom = box.minY + legs * height;
    const s = Math.sin(roll);
    const c = Math.cos(roll);
    let lowest = Infinity;
    for (const x of [cx - hw, cx + hw]) for (const y of [bottom, box.maxY]) lowest = Math.min(lowest, x * s + y * c);
    return lowest;
}

/**
 * Its sleep for the shader, in one float (`arkInstance.w`; `animal-material.ts` arkSleepOf unpacks it): eyes shut
 * (0…1), the curl (−1.24…1.28 radians each half), a tail flick (0…1), breaths a second (0…1.26), 6 bits each. An
 * integer under 2^24, so a float holds it exactly.
 */
export function packSleep(eyes: number, curl: number, flick: number, breath: number): number {
    const q = (v: number, lo: number, hi: number) => Math.min(Math.max(Math.round(v), lo), hi);
    return q(eyes * 63, 0, 63) * 262144 + q(curl * 25 + 31, 0, 63) * 4096 + q(flick * 63, 0, 63) * 64 + q(breath * 50, 0, 63);
}

/**
 * Roosts it goes into to sleep (its schedule's roost is the entrance): a burrow's or a den's mouth on the ground. The
 * id keeps the tag it was made with: the graphics sampler's `burrow:<host>:<n>`, or `burrow_entrance:` / `cave_mouth:`.
 */
const INTO = ["burrow", "burrow_entrance", "cave_mouth"];
/** Whether its roost spot is a way in (the attach point's id: `<tag>:<host>:<n>`). */
export function goesIntoRoost(point: string | null | undefined, roost: string | null | undefined): boolean {
    if (!point || !roost || !["den", "burrow", "cave"].includes(roost)) return false;
    // The map lane's roosts carry `map:` before the point's id; its own dug burrow is `map:burrow`, a cave dweller's
    // den at a drawn rock's foot `map:rock_foot` (the props draw the way in at both: `props/burrows.ts` entranceStyle).
    const id = point.startsWith("map:") ? point.slice(4) : point;
    return id === "burrow" || (roost === "cave" && id === "rock_foot") || INTO.some((tag) => id.startsWith(`${tag}:`));
}
