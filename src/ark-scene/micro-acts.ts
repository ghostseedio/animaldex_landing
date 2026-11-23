/**
 * What a small animal does at its spot (signature behaviours, wave 2, the small bodies; AnimalDex
 * docs/ark/behaviours-plan.md decision 367/369): a true micro animal (a small invertebrate under 12 cm, `map/species.ts`
 * trueMicro) lives at its microhabitat and is off the shared schedule (`micro.ts`), so the recipe engine
 * (`behaviour-recipes.ts`) never plays its recipes: a jumping spider's dance, a cricket's digging, a hawkmoth hanging at
 * a flower, an ant's boxing at its border were written into its row and drawn by no one. This is their way of showing:
 * the same recipes (the row's ids, the same blocks, `behaviour-blocks.ts` and `recipe-small.ts`), played in place.
 *
 * Now and then (a window each `period`, taken with the recipe's chance) the animal stops where it is and plays the
 * recipe's steps on the spot: its attitude and bob from the blocks (pitch, roll, heave, as `keyPose` has them), its named
 * state for the rig (`recipeClip`), its dirt and dust and its hole (`fx`, `mark`), a hover's lift. Pure in (id, species,
 * the clock), so every viewer sees the same act at the same moment, as every recipe is. A pair's act (ants boxing at a
 * border, beetles wrestling) is played by the two neighbours of its cluster together: the window is the pair's, taken
 * from its key.
 *
 * Imports no scene code (the page's static JavaScript is not touched: this is read with the scene).
 */

import {BLOCKS} from "@/ark-scene/behaviour-blocks";
import {seasonFactor, sexLook, speciesRecipes, type RecipeAct} from "@/ark-scene/behaviour-recipes";
import {hashString} from "@/ark-scene/world";

type Step = {b: string; s: [number, number]};
export type MicroActDef = {
    /** The recipe's id (its row's; `recipe-small.ts` and `recipe-templates.ts`). */
    id: string;
    /** The ground it needs under it: soil (a digger), a flower (a hover), or any surface. */
    needs?: "soil" | "flower";
    hours?: "day" | "night";
    season?: "mating";
    sex?: "male";
    /** One window in this many seconds, taken with the recipe's weight x 0.7. */
    period: number;
    steps: Step[];
    /** Held off its surface while it plays: body lengths up (a hover at a flower). */
    lift?: number;
    /** Played by two of its cluster, facing each other (a pair's recipe). */
    pair?: boolean;
};

const DIG: Step[] = [{b: "dig", s: [6, 12]}, {b: "scan", s: [1, 2]}, {b: "dig", s: [4, 8]}];
const WAIT: Step[] = [{b: "ambush", s: [8, 16]}, {b: "strike", s: [0.5, 0.9]}, {b: "ambush", s: [5, 10]}, {b: "strike", s: [0.5, 0.9]}];

/** The recipes a micro animal plays in place (a row's recipe that is not here is a schedule's: `behaviour-recipes.ts`). */
export const MICRO_ACTS: Record<string, MicroActDef> = Object.fromEntries(
    ([
        {id: "spider_dance", hours: "day", season: "mating", sex: "male", period: 330, steps: [{b: "leg_wave", s: [8, 13]}, {b: "scan", s: [3, 5]}, {b: "leg_wave", s: [4, 8]}]},
        {id: "dig_burrow", needs: "soil", period: 400, steps: DIG},
        {id: "bank_burrow", needs: "soil", period: 400, steps: DIG},
        {id: "flower_hover", needs: "flower", period: 280, lift: 1, steps: [{b: "hover_probe", s: [4, 8]}, {b: "hover_probe", s: [3, 6]}]},
        {id: "sit_snap", period: 300, steps: WAIT},
        {id: "border_spar", period: 360, pair: true, steps: [{b: "rear", s: [1, 2]}, {b: "front_box", s: [6, 12]}]},
        {id: "claw_spar", period: 360, pair: true, steps: [{b: "rear", s: [1, 2]}, {b: "claw_shove", s: [5, 9]}]},
        {id: "wrestle", period: 420, season: "mating", sex: "male", pair: true, steps: [{b: "display", s: [1.5, 3]}, {b: "fight", s: [4, 8]}]}
    ] as MicroActDef[]).map((d) => [d.id, d])
);

/** Which of a species' recipes it plays in place (its row's order), with their weights. Remembered. */
const OWN = new Map<string, Array<{def: MicroActDef; weight: number}>>();
export function microActsOf(slug: string): ReadonlyArray<{def: MicroActDef; weight: number}> {
    let own = OWN.get(slug);
    if (!own) {
        own = speciesRecipes(slug).recipes.filter((r) => MICRO_ACTS[r.id]).map((r) => ({def: MICRO_ACTS[r.id], weight: r.weight}));
        OWN.set(slug, own);
    }
    return own;
}

/** Whether a micro animal plays anything in place (cheap: asked each frame). */
export function playsInPlace(slug: string): boolean {
    return microActsOf(slug).length > 0;
}

/** How long it eases into the act's attitude and out of it (s). */
const EASE = 0.5;

const unit = (key: string) => (hashString(key) % 100003) / 100003;

export type MicroActIn = {
    id: string;
    slug: string;
    epoch: number;
    /** The island's hour of day. */
    hours: number;
    /** The animal's body length (m). */
    length: number;
    /** It is on soil (leaf litter, the ground), for a digger. */
    soil: boolean;
    /** It is on a flower, for a hover. */
    flower?: boolean;
    /** It is resting or asleep (its schedule's). */
    resting: boolean;
    /** A pair's recipe: the pair's key (the two ids, in order), this animal's role, and whether the other is a male (a males' contest needs two). */
    pair?: {key: string; role: "a" | "b"; otherMale?: boolean} | null;
};

export type MicroActNow = {
    act: RecipeAct;
    /** When the act began and ends (world seconds), for holding it still and its easing. */
    t0: number;
    t1: number;
    /** 0 outside the easing, up to 1 inside the act: how far its attitude is applied. */
    weight: number;
    /** Pitch and roll (rad), and the lift above its surface (m): already weighted. */
    pitch: number;
    roll: number;
    heave: number;
    /** The pair's role, when it is a pair's recipe. */
    pair: "a" | "b" | null;
    /** A hole (a digger's), where it is. */
    mark: boolean;
};

function def(slug: string, id: string): {def: MicroActDef; weight: number} | null {
    return microActsOf(slug).find((o) => o.def.id === id) ?? null;
}

/** Its steps drawn once from the window's seed: [block, start, end] in seconds from the act's start. */
function timeline(def: MicroActDef, seed: string): {steps: Array<{b: string; from: number; to: number}>; total: number} {
    let at = 0;
    const steps = def.steps.map((s, i) => {
        const len = s.s[0] + (s.s[1] - s.s[0]) * unit(`${seed}#${i}`);
        const out = {b: s.b, from: at, to: at + len};
        at += len;
        return out;
    });
    return {steps, total: at};
}

/**
 * The act it plays in place at a world time, or null. The windows are `period` seconds apart; in each the recipe is taken
 * with its chance (its weight x 0.7, x its season's factor), at a start the window's seed gives. Where two of its recipes
 * would both take a window the first of its row has it.
 */
export function microActAt(input: MicroActIn): MicroActNow | null {
    const own = microActsOf(input.slug);
    if (!own.length || input.resting) return null;
    for (const {def: d, weight} of own) {
        if (d.needs === "soil" && !input.soil) continue;
        if (d.needs === "flower" && !input.flower) continue;
        if (d.hours === "day" && !(input.hours > 6.3 && input.hours < 18.2)) continue;
        if (d.hours === "night" && !(input.hours < 5.2 || input.hours > 19.5)) continue;
        if (d.pair && !input.pair) continue;
        if (d.sex === "male" && sexLook(input.id, input.slug).sex !== "male") continue;
        if (d.sex === "male" && d.pair && input.pair?.otherMale !== true) continue;
        const factor = d.season ? seasonFactor(speciesRecipes(input.slug), d.season, input.epoch) : 1;
        if (!factor) continue;
        const key = d.pair ? input.pair!.key : input.id;
        const k = Math.floor(input.epoch / d.period);
        const seed = `${key}#${d.id}#${k}`;
        // (A pair's chance is the pair's: both take the same window.)
        if (unit(`${seed}#on`) >= Math.min(weight * 0.7 * factor * (d.pair ? 1.6 : 1), 0.95)) continue;
        const line = timeline(d, seed);
        const start = k * d.period + unit(`${seed}#at`) * Math.max(d.period - line.total - 2 * EASE, 1);
        const end = start + line.total + 2 * EASE;
        if (input.epoch < start || input.epoch >= end) continue;
        const into = input.epoch - start - EASE;
        const w = Math.min(Math.max(Math.min(input.epoch - start, end - input.epoch) / EASE, 0), 1);
        const step = line.steps.find((s) => into < s.to) ?? line.steps[line.steps.length - 1];
        const block = BLOCKS[step.b];
        if (!block) continue;
        const u = Math.min(Math.max((into - step.from) / Math.max(step.to - step.from, 1e-3), 0), 1);
        const phase = Math.max(into - step.from, 0) * (block.rate ?? 1) * Math.PI * 2;
        const wave = Math.sin(phase);
        const pitch = ((block.pitch ?? 0) + (block.pitchWave ?? 0) * wave) * w;
        const roll = ((block.roll ?? 0) + (block.rollWave ?? 0) * wave) * w;
        const heave = ((block.heave ?? 0) * input.length * (0.5 + 0.5 * wave) + (d.lift ?? 0) * (input.length * 0.9 + 0.03)) * w;
        const fx = block.fx ? {kind: block.fx, at: {x: 0, y: 0, z: 0}, id: `${seed}#${step.b}`, during: block.fxAt === "during", when: block.fxAt ?? ("start" as const)} : null;
        const act: RecipeAct = {
            episode: seed,
            recipe: d.id,
            block: step.b,
            state: block.states[Math.min(Math.floor(u * block.states.length), block.states.length - 1)],
            u,
            pitch,
            roll,
            own: true,
            carry: null,
            prey: null,
            catch: null,
            fx,
            mark: null,
            label: d.id,
            with: null
        };
        return {act, t0: start, t1: end, weight: w, pitch, roll, heave, pair: d.pair ? input.pair!.role : null, mark: step.b === "dig"};
    }
    return null;
}

/** Its windows (world seconds) between two times, for the harness's finder and the tests: when each recipe plays and its blocks. */
export function microActWindows(id: string, slug: string, from: number, to: number, hours: number, length: number, spot: {soil: boolean; flower: boolean}, pair: MicroActIn["pair"] = null, step = 0.5): Array<{recipe: string; start: number; end: number; blocks: Array<{block: string; t0: number; t1: number}>}> {
    const out: Array<{recipe: string; start: number; end: number; blocks: Array<{block: string; t0: number; t1: number}>}> = [];
    let open: (typeof out)[number] | null = null;
    for (let t = from; t < to; t += step) {
        const now = microActAt({id, slug, epoch: t, hours, length, soil: spot.soil, flower: spot.flower, resting: false, pair});
        if (!now) {
            open = null;
            continue;
        }
        if (!open || open.recipe !== now.act.recipe || Math.abs(open.start - now.t0) > 1e-6) {
            open = {recipe: now.act.recipe, start: now.t0, end: now.t1, blocks: []};
            out.push(open);
        }
        const last = open.blocks[open.blocks.length - 1];
        if (last && last.block === now.act.block) last.t1 = t + step;
        else open.blocks.push({block: now.act.block, t0: t, t1: t + step});
    }
    return out;
}

/** Whether its microhabitat is the ground's (leaf litter, `micro.ts` MICRO_SPOTS): a digger may dig there, not on a wall, a trunk, a rock or a flower. */
export function soilSpot(spot: string): boolean {
    return spot === "leaf_litter" || spot === "litter";
}

/** Whether it is on a flower (a hover is at a flower: the map's attach tag, `map/sampler.ts`). */
export function flowerSpot(tag: string | null | undefined): boolean {
    return tag === "flower_head" || tag === "flower";
}
