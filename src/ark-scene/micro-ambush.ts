/**
 * Small clingers that hunt by sit-and-wait (signature behaviours, lane SIG2-REPTILES; AnimalDex
 * docs/ark/signature-behaviours.json, the recipe `pounce~lizard` of the geckos and lizards that live on a wall or a rock):
 * "waits motionless beside wall lamps for moths", "hunts insects at lit walls at night", "waits at burrow mouths for
 * insects", "motionless on rock then dashes out at insect". They are small animals at their microhabitat (`micro.ts`),
 * off the schedule (`map/place.ts` onSchedule), so the engine's episodes never reach them: this is their own act, pure in
 * the animal's id and the world's clock, so every viewer sees the same hunt at the same moment.
 *
 * In its hours (`micro-ambush.json`: the catalogue's own `when`, night for the geckos, day for the lizards) the animal
 * sits still on its spot (the wandering out and back is for the other hours). Once or twice in about half a minute, an
 * insect settles on the surface just ahead of it; it waits, watching; a dash of a few body lengths, a snap (the strike
 * clip where the rig has it), the insect gone; it eats, turns, walks back to its spot and turns round again.
 *
 *   wait (the insect there) → dash 0.45 s → strike 0.6 s (the catch 0.42 s in) → eat 1.4 s → turn 0.6 s → back → turn 0.6 s
 */

import table from "@/ark-scene/micro-ambush.json";
import type {RecipeAct} from "@/ark-scene/behaviour-recipes";
import type {QuarryNow} from "@/ark-scene/recipe-hunt";
import {quarrySize} from "@/ark-scene/recipe-hunt";

export const AMBUSH_RECIPE = "pounce~lizard";

const HOURS = (table as {species: Record<string, "night" | "day">}).species;

/** When a species hunts so (island hours): night for the lamp and burrow-mouth geckos, day for the rock lizards. */
export function ambushHours(slug: string): "night" | "day" | null {
    return HOURS[slug] ?? null;
}

export function inAmbushHours(kind: "night" | "day", hours: number): boolean {
    return kind === "night" ? hours >= 19.2 || hours <= 5.4 : hours > 7 && hours < 17.6;
}

/** A point on its surface (`micro.ts` SurfacePoint, the part read here). */
export type AmbushPoint = {x: number; y: number; z: number; nx: number; ny: number; nz: number; tx: number; ty: number; tz: number};

function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

const ease = (u: number) => {
    const c = Math.min(Math.max(u, 0), 1);
    return c * c * (3 - 2 * c);
};

// The bout's timeline (seconds from the dash's start).
export const DASH = 0.45;
export const STRIKE = 0.6;
/** The catch is made this far through the strike (the lunge's reach). */
const CATCH = 0.7;
export const EAT = 1.4;
export const TURN = 0.6;
/** How fast it walks back (body lengths a second). */
const WALK_BL = 3;
/** A bout is every this long on average. */
const PERIOD = 28;
/** Seconds the insect has been there before the dash, at the shortest and the longest. */
const WAIT: [number, number] = [2.5, 6];

export type Bout = {id: string; /** The bout's number (an episode). */ k: number; /** World seconds: the insect lands, the dash starts, the bout is over. */ tv: number; td: number; te: number; /** The insect is caught (else it gets away). */ ok: boolean; /** How far the dash goes (m). */ reach: number; /** The back-walk's length (s). */ back: number};

/** The bout of an animal that begins its period `k` (null: it takes none then). */
export function boutOf(id: string, length: number, k: number): Bout | null {
    if (unit(`${id}#amb#${k}#on`) > 0.85) return null;
    const period = PERIOD * (0.75 + 0.5 * unit(`${id}#amb#period`));
    const start = k * period + 1 + 5 * unit(`${id}#amb#${k}#s`);
    const wait = WAIT[0] + (WAIT[1] - WAIT[0]) * unit(`${id}#amb#${k}#w`);
    const reach = Math.min(Math.max(length * 3.5, 0.08), 0.45);
    const back = reach / Math.max(length * WALK_BL, 0.05);
    const td = start + wait;
    return {id, k, tv: start, td, te: td + DASH + STRIKE + EAT + TURN + back + TURN, ok: unit(`${id}#amb#${k}#ok`) < 0.8, reach, back};
}

/** The period an epoch falls in and the one before (a bout may still be running into the next period). */
function periodOf(id: string, epoch: number): number {
    return Math.floor(epoch / (PERIOD * (0.75 + 0.5 * unit(`${id}#amb#period`))));
}

/** The bouts of an animal that start between two world times (for the harness and the tests). */
export function ambushBouts(id: string, length: number, from: number, to: number): Bout[] {
    const out: Bout[] = [];
    for (let k = periodOf(id, from) - 1; k <= periodOf(id, to) + 1; k++) {
        const bout = boutOf(id, length, k);
        if (bout && bout.te >= from && bout.tv <= to) out.push(bout);
    }
    return out;
}

export type AmbushNow = {
    /** Metres along its heading from its spot, and its turn about the surface's normal (rad): what `micro.ts` surfacePoint and the pose take. */
    along: number;
    turn: number;
    /** What it is doing: a recipe act (null between bouts, when it only sits still). */
    act: RecipeAct | null;
};

/**
 * Where its bout has it at a world time, or null when it is not its hunting hours (the micro cycle's wandering). `at` gives
 * the surface's point `along` metres along its heading from its spot (for the insect's place).
 */
export function ambushNow(id: string, name: string, length: number, epoch: number, at: (along: number) => AmbushPoint): AmbushNow {
    const k0 = periodOf(id, epoch);
    for (const k of [k0, k0 - 1]) {
        const bout = boutOf(id, length, k);
        if (!bout || epoch < bout.tv || epoch >= bout.te) continue;
        const t = epoch - bout.td;
        const d = bout.reach;
        const lunge = Math.min(length * 0.35, 0.05);
        let along = 0;
        let turn = 0;
        let block: "freeze" | "run" | "strike" | "eat" | "turn" | "walk" = "freeze";
        let state = "freeze";
        let u = 0;
        const strikeAt = DASH;
        const eatAt = DASH + STRIKE;
        const turnAt = eatAt + EAT;
        const backAt = turnAt + TURN;
        const homeAt = backAt + bout.back;
        if (t < 0) {
            u = (epoch - bout.tv) / Math.max(bout.td - bout.tv, 1e-3);
        } else if (t < strikeAt) {
            block = "run";
            state = "run";
            u = t / DASH;
            along = d * ease(u);
        } else if (t < eatAt) {
            block = "strike";
            state = "strike";
            u = (t - strikeAt) / STRIKE;
            along = d + lunge * Math.sin(Math.min(u / CATCH, 1) * Math.PI);
        } else if (t < turnAt) {
            block = "eat";
            state = "eat";
            u = (t - eatAt) / EAT;
            along = d;
        } else if (t < backAt) {
            block = "turn";
            state = "freeze";
            u = (t - turnAt) / TURN;
            along = d;
            turn = Math.PI * ease(u);
        } else if (t < homeAt) {
            block = "walk";
            state = "walk";
            u = (t - backAt) / Math.max(bout.back, 1e-3);
            along = d * (1 - u);
            turn = Math.PI;
        } else {
            block = "turn";
            state = "freeze";
            u = (t - homeAt) / TURN;
            turn = Math.PI * (1 - ease(u));
        }
        // The insect: settled on the surface where its mouth will be, wings fluttering a little; gone when caught (a miss: off and up).
        const mouth = at(d + length * 0.55);
        const size = quarrySize("flier", length);
        const caughtAt = DASH + STRIKE * CATCH;
        let quarry: QuarryNow | null = null;
        const tq = epoch - bout.td;
        if (tq < caughtAt || (!bout.ok && tq < caughtAt + 1.4)) {
            const gone = Math.max(tq - caughtAt, 0);
            const away = bout.ok ? 0 : 1 - Math.exp(-gone * 2.4);
            const shiver = Math.sin(epoch * 31 + bout.k) * size * 0.1;
            quarry = {
                id: `${id}#amb#${bout.k}`,
                kind: "insect",
                look: "flier",
                phase: gone > 0 ? "escaped" : tq >= 0 ? "flee" : "idle",
                x: mouth.x + mouth.nx * (size * 0.55 + away * 0.5) + mouth.tx * (away * 0.25) + shiver,
                y: mouth.y + mouth.ny * (size * 0.55 + away * 0.5) + mouth.ty * (away * 0.25) + shiver,
                z: mouth.z + mouth.nz * (size * 0.55 + away * 0.5) + mouth.tz * (away * 0.25) + shiver,
                yaw: Math.atan2(mouth.tx, mouth.tz),
                size,
                alpha: bout.ok ? 1 : 1 - Math.min(Math.max((gone - 0.9) / 0.5, 0), 1),
                air: (epoch * (gone > 0 ? 24 : 9)) % 1,
                since: null
            };
            // (Before its landing: not there.)
            if (epoch < bout.tv + 0.3) quarry.alpha *= Math.min(Math.max((epoch - bout.tv) / 0.3, 0), 1);
        }
        const act: RecipeAct = {
            episode: `${id}#amb#${bout.k}`,
            recipe: AMBUSH_RECIPE,
            block,
            state,
            u,
            pitch: 0,
            roll: 0,
            own: true,
            carry: null,
            prey: null,
            catch: null,
            fx: null,
            mark: null,
            label: AMBUSH_RECIPE,
            with: null,
            ...(quarry ? {quarry} : {})
        };
        void name;
        return {along, turn, act};
    }
    return {along: 0, turn: 0, act: null};
}
