/**
 * The birds' tail habits (3.3 batch, lane B; owner 2026-11-16): the small constant tail movement a bird is known by. A
 * wagtail pumps its tail down and up without a pause, a wren holds its tail cocked, a swamphen flicks it, a sandpiper's
 * rear end bobs, a water tyrant fans it. Only the species whose own stored text says so (`bird-moves.json` `tail`, from
 * the catalogue's rows), and only where the species' model marks its tail (`ark.json` `behaviour.tail`: a base and a
 * length): the instance shader (`animal-material.ts`) hinges those vertices up and down about the tail's base and
 * spreads them for a fan. A model with no tail marked is left as it is: nothing is faked on the body.
 *
 * The angles and the beat are the drawing's (the text gives none): a pump of a fifth of a turn's tenth, a cock held
 * well up, a flick now and then. Awake only; it fades with distance like the rest of the near model's own motion.
 */

import table from "@/ark-scene/bird-moves.json";

/** `pump` (rad): a steady down-and-up; negative: a sharp flick up now and then. `cock` (rad): held up. `fan`: how far it spreads (share of its width). `rate` (rad/s): the pump's or the flicks' beat. */
export type TailHabit = {pump: number; cock: number; fan: number; rate: number};

const MOVES = (table as unknown as {tail: Record<string, {moves: string[]; line: string | null}>}).tail;

const TAU = Math.PI * 2;
/** A species' tail habit from its catalogue moves, or null (no row says it has one). */
export function tailHabitOf(slug: string | null | undefined): TailHabit | null {
    const moves = slug ? MOVES[slug]?.moves : undefined;
    if (!moves?.length) return null;
    const has = (move: string) => moves.includes(move);
    const habit: TailHabit = {pump: 0, cock: 0, fan: 0, rate: 0};
    if (has("pump")) Object.assign(habit, {pump: 0.32, rate: TAU * 2.2});
    if (has("bob")) Object.assign(habit, {pump: 0.2, rate: TAU * 1.8});
    if (has("flick")) Object.assign(habit, {pump: -0.45, rate: TAU * 0.45});
    if (has("cock")) habit.cock = 0.6;
    if (has("fan")) habit.fan = 0.5;
    // (A tail held cocked or fanned still twitches: a slow beat for the fan to open and close by.)
    if (!habit.rate) habit.rate = TAU * 0.5;
    return habit;
}

/** The tail's lift (rad) at a time, as the shader works it out: the cock plus the pump's wave or the flick's snap. */
export function tailLift(habit: TailHabit, clock: number): number {
    const beat = clock * habit.rate;
    const pump = habit.pump >= 0 ? habit.pump * Math.sin(beat) : -habit.pump * Math.max(Math.sin(beat), 0) ** 8;
    return habit.cock + pump;
}

/**
 * The shader's hinge on one vertex of the model (y up, z to the head), for the tests: behind the tail's base it turns
 * about the base's side-to-side axis by the lift, eased in over the tail's first third; ahead of it nothing moves.
 */
export function tailHinge(p: {x: number; y: number; z: number}, tail: {base: [number, number, number]; length: number}, lift: number, fan = 0): {x: number; y: number; z: number} {
    if (tail.length <= 0 || p.z >= tail.base[2]) return p;
    const into = Math.min(Math.max((tail.base[2] - p.z) / tail.length, 0), 1);
    const smooth = (a: number, b: number, v: number) => {
        const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
        return t * t * (3 - 2 * t);
    };
    const side = 1 - smooth(0.5, 0.9, Math.abs(p.x - tail.base[0]) / tail.length);
    const a = lift * smooth(0, 0.3, into) * side;
    const dy = p.y - tail.base[1];
    const dz = p.z - tail.base[2];
    return {x: tail.base[0] + (p.x - tail.base[0]) * (1 + fan * into * side), y: tail.base[1] + dy * Math.cos(a) - dz * Math.sin(a), z: tail.base[2] + dy * Math.sin(a) + dz * Math.cos(a)};
}

/** The shader's uniform: (pump, cock, fan, rate); all zero for a species with no habit. */
export function tailHabitUniform(habit: TailHabit | null | undefined): [number, number, number, number] {
    return habit ? [habit.pump, habit.cock, habit.fan, habit.rate] : [0, 0, 0, 0];
}
