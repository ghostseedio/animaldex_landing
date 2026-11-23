/**
 * Look states (lane SIG-OTHER, 2026-11-20): the colour a species changes with the hour, the season or its mood, and the
 * parts of it that swell in a display (a lizard's dewlap, a frog's vocal sac, a crane's throat pouch, a rutting deer's
 * neck, a hamster's full cheeks). Only the species whose own catalogue row says so (`look-states.json`, built by
 * `scripts/ark-look-states.mts` from AnimalDex docs/ark/signature-behaviours.json, never edited by hand): each entry
 * keeps the row's quote and its English log sentence.
 *
 * How it is drawn, with no new draw call, texture, attribute or download (the antler cycle's way):
 * - the night's tone (`night`: a gecko pales, a goldfish fades) is a pure function of the island's daylight in the
 *   shader (`arkDaylight`), so it costs nothing per animal and every viewer sees the same;
 * - the other state (`state`: by month, by an act, by alarm, by foraging) is one strength of 0-15 per animal, packed in
 *   the twelfth bit upward of `arkCoat.y` (`packState`, above the antlers' 32s: 512 each), which the look shader reads
 *   for the species' tone over the skin (`arkStateA-D`: a colour, how much, how grey or rich, where on the body) and
 *   its swell (`arkSwellA-B`: the vertices in one ellipsoid of the rest pose, pushed out along their normals).
 *
 * Visual only: nothing here decides anything on the Ark. Seasons are the Ark year's months (`seasonMonthAt`), the sex is
 * the seeded one (`sexLook`), the acts are the recipes' blocks now. Pure in its inputs.
 */

import table from "@/ark-scene/look-states.json";

export type Rgb = [number, number, number];
export type Vec3 = [number, number, number];
/** An ellipsoid of the model's rest pose (its own units: the model is one long); `mirror`: the same on both sides (x folded). */
export type Region = {c: Vec3; r: Vec3; mirror?: boolean};
/** How a state changes the skin: a colour mixed in, grey (+) or richer (-), lighter or darker, over the whole body or one region. */
export type Tone = {colour?: Rgb; mix?: number; desat?: number; gain?: number; /** Light added in its colour (eyeshine, a firefly): it takes the eyes too. */ glow?: number; region?: Region};
export type Swell = {region: Region; push: number};
export type Trigger =
    | {kind: "season"; months: number[]; sex?: "male" | "female"}
    | {kind: "blocks"; blocks: string[]; sex?: "male" | "female"}
    | {kind: "alarm"}
    | {kind: "forage"}
    /** A light organ's flash after dusk: on for `on` s every `period` s, each animal on its own beat (a drawing's timing: the row gives none). */
    | {kind: "flash"; period: number; on: number; sex?: "male" | "female"};
export type NightSpec = {tone: Tone; line: string; quote: string; id: string};
/** Each animal its own pattern (a koi's patches, a guppy's spots): dark and light areas from its own seed, over the skin's own colours. */
export type Individual = {kind: "patches" | "spots"; scale: number; dark: number; light: number};
export type StateSpec = {trigger: Trigger; tone?: Tone; swell?: Swell; individual?: Individual; line: string; quote: string; id: string; say?: "on" | "off"};
export type LookStateSpec = {name: string; night?: NightSpec; state?: StateSpec};

const SPECIES = (table as unknown as {species: Record<string, LookStateSpec>}).species;

/** The species' look states, or null (most species look the same all day and all year). */
export function lookStateOf(slug: string | null | undefined): LookStateSpec | null {
    return (slug && SPECIES[slug]) || null;
}

/** Every species with a look state (the tests and the harness). */
export function lookStateSpecies(): Array<[string, LookStateSpec]> {
    return Object.entries(SPECIES);
}

// MARK: The strength per animal

/** The steps of strength an animal can carry (4 bits). */
export const STATE_STEPS = 15;
const STATE_UNIT = 512;

/** A strength (0-1) as the steps an animal carries. */
export function stateSteps(strength: number): number {
    return Math.round(Math.min(Math.max(strength, 0), 1) * STATE_STEPS);
}

/** `arkCoat.y` with the state's steps above the antlers' bits (`packAntler`), the bits below kept. */
export function packState(y: number, steps: number): number {
    const low = y - STATE_UNIT * Math.floor(y / STATE_UNIT + 1e-6);
    return Math.max(low, 0) + STATE_UNIT * Math.min(Math.max(Math.round(steps), 0), STATE_STEPS);
}

/** Writes an animal's state steps into the look pass's `arkCoat` (after the young coat and the antlers, which rewrite the bits below). */
export function applyLookState(geometry: {getAttribute(name: string): unknown}, index: number, steps: number): void {
    if (steps <= 0) return;
    const attribute = geometry.getAttribute("arkCoat") as {count: number; getY(i: number): number; setY(i: number, y: number): void; needsUpdate: boolean} | undefined;
    if (!attribute || index >= attribute.count) return;
    attribute.setY(index, packState(attribute.getY(index), steps));
    attribute.needsUpdate = true;
}

/** What the scene knows of an animal this frame, as far as a trigger needs it. */
export type StateContext = {
    /** The Ark year's month (1-12). */
    month: number;
    sex: "male" | "female" | null;
    /** The block of the recipe act it is in now, or null. */
    block: string | null;
    /** The reactive layer's alarm (0-1). */
    alarmed: number;
    /** The schedule's beat now (`peck`, `chew`, `forage`...), or null. */
    beat: string | null;
    /** The shared clock (s), the island's daylight (`ARK_DAYLIGHT`: 1 by day, 0.34 deep in the night) and the animal's seed in [0, 1): a light organ's flash. */
    clock?: number;
    daylight?: number;
    seed?: number;
};

/** The beats and blocks that are taking food (a cheek pouch fills while they go on). */
const FORAGING = new Set(["eat", "peck", "pick_up", "probe", "dig", "pull", "forage", "graze", "browse", "chew", "bite"]);

/** Where a trigger wants the strength now (0 or 1). */
export function stateTarget(trigger: Trigger, ctx: StateContext): number {
    switch (trigger.kind) {
        case "season":
            return trigger.months.includes(ctx.month) && (!trigger.sex || trigger.sex === ctx.sex) ? 1 : 0;
        case "blocks":
            return ctx.block !== null && trigger.blocks.includes(ctx.block) && (!trigger.sex || trigger.sex === ctx.sex) ? 1 : 0;
        case "alarm":
            return ctx.alarmed > 0.4 ? 1 : 0;
        case "forage":
            return (ctx.block !== null && FORAGING.has(ctx.block)) || (ctx.beat !== null && FORAGING.has(ctx.beat)) ? 1 : 0;
        case "flash": {
            if (trigger.sex && trigger.sex !== ctx.sex) return 0;
            if ((ctx.daylight ?? 1) > 0.8) return 0;
            const at = (((ctx.clock ?? 0) / trigger.period + (ctx.seed ?? 0)) % 1 + 1) % 1;
            return at < trigger.on / trigger.period ? 1 : 0;
        }
    }
}

/** How fast the strength follows its target (a share of it a second): a season turns over a few seconds (a moult seen), a display opens at once, cheeks stay full a while. */
const RATES: Record<Trigger["kind"], {up: number; down: number}> = {season: {up: 0.08, down: 0.08}, blocks: {up: 1.6, down: 0.7}, alarm: {up: 0.9, down: 0.25}, forage: {up: 0.4, down: 0.025}, flash: {up: 9, down: 4}};

/** One frame: the strength moves toward the target at the trigger's own rate. */
export function stepStrength(kind: Trigger["kind"], strength: number, target: number, dt: number): number {
    if (!(dt > 0)) return strength;
    const rate = target > strength ? RATES[kind].up : RATES[kind].down;
    const step = rate * dt;
    return target > strength ? Math.min(strength + step, target) : Math.max(strength - step, target);
}

/** Whether the species' sentence for its state is true of what is drawn at this strength. */
export function stateSays(strength: number): boolean {
    return strength >= 0.6;
}

/** The night's strength (0 by day, 1 deep in the night) from the island's daylight (`ARK_DAYLIGHT`: 1 by day, 0.34 at its deepest): the shader's own. */
export function nightStrength(daylight: number): number {
    const t = Math.min(Math.max((1 - daylight) / 0.66, 0), 1);
    return t * t * (3 - 2 * t);
}

/** Whether the species' sentence for its night look is true now. */
export function nightSays(daylight: number): boolean {
    return nightStrength(daylight) >= 0.7;
}

// MARK: For the shader

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

type ToneUniforms = {A: number[]; B: number[]; C: number[]; D: number[]};
/**
 * A tone for the shader. A = (colour rgb, mix); B = (grey, gain, on, glow); C = (region centre xyz, mirrored);
 * D = (region radii xyz, region on). A tone is off (B.z 0) for a species without one.
 */
export function toneUniforms(tone: Tone | null | undefined): ToneUniforms {
    if (!tone) return {A: [0, 0, 0, 0], B: [0, 1, 0, 0], C: [0, 0, 0, 0], D: [1, 1, 1, 0]};
    const colour = tone.colour ?? [0, 0, 0];
    const region = tone.region;
    return {
        A: [...colour.map(linear), tone.colour ? tone.mix ?? 0.5 : 0],
        B: [tone.desat ?? 0, tone.gain ?? 1, 1, tone.glow ?? 0],
        C: region ? [...region.c, region.mirror ? 1 : 0] : [0, 0, 0, 0],
        D: region ? [...region.r, 1] : [1, 1, 1, 0]
    };
}

/** An animal's own pattern for the shader: (kind 0 none / 1 patches / 2 spots, scale, share dark, share light). */
export function individualUniform(individual: Individual | null | undefined): number[] {
    return individual ? [individual.kind === "patches" ? 1 : 2, individual.scale, individual.dark, individual.light] : [0, 1, 0, 0];
}

/** The swell for the shader: A = (centre xyz, push); B = (radii xyz, mirrored). Push 0: none. */
export function swellUniforms(swell: Swell | null | undefined): {A: number[]; B: number[]} {
    if (!swell) return {A: [0, 0, 0, 0], B: [1, 1, 1, 0]};
    return {A: [...swell.region.c, swell.push], B: [...swell.region.r, swell.region.mirror ? 1 : 0]};
}

/** The species' look state for its material (zeros for a species without one). */
export function lookStateUniforms(slug: string | null | undefined): Record<string, {value: number[]}> {
    const spec = lookStateOf(slug);
    const night = toneUniforms(spec?.night?.tone);
    const state = toneUniforms(spec?.state?.tone);
    const swell = swellUniforms(spec?.state?.swell);
    return {
        arkNightA: {value: night.A}, arkNightB: {value: night.B}, arkNightC: {value: night.C}, arkNightD: {value: night.D},
        arkStateA: {value: state.A}, arkStateB: {value: state.B}, arkStateC: {value: state.C}, arkStateD: {value: state.D},
        arkSwellA: {value: swell.A}, arkSwellB: {value: swell.B},
        arkIndA: {value: individualUniform(spec?.state?.individual)}
    };
}

/** How much of an ellipsoid region a rest-pose point is in (1 inside, 0 beyond): the shader's mask, for the tests. */
export function regionMask(p: Vec3, region: Region | null | undefined): number {
    if (!region) return 1;
    const x = region.mirror ? Math.abs(p[0]) : p[0];
    const d = Math.hypot((x - region.c[0]) / region.r[0], (p[1] - region.c[1]) / region.r[1], (p[2] - region.c[2]) / region.r[2]);
    const t = Math.min(Math.max((d - 0.55) / 0.45, 0), 1);
    return 1 - t * t * (3 - 2 * t);
}

/** The shader's push on one vertex (rest pose point and unit normal) at a strength (0-1), for the tests. */
export function swellPoint(p: Vec3, normal: Vec3, swell: Swell, strength: number): Vec3 {
    const m = regionMask(p, swell.region) * strength * swell.push;
    return [p[0] + normal[0] * m, p[1] + normal[1] * m, p[2] + normal[2] * m];
}
