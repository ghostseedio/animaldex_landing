/**
 * How a hunter searches (signature behaviours, theme `hunt_tactic`): the same foray the server's positions give it
 * (`hunting.ts`: the waypoints it is at on each 15-Ark-minute step, which it still reaches on the step), walked in its
 * species' way. Only the way between two waypoints is shaped, in time and a few metres to the side (never more than the
 * agreement between the server's places and the scene's, `ENCOUNTER_AGREE`), so a hunt that begins from them starts
 * from them.
 *
 * Only the search is drawn: no prey is shown or implied (the engine finds and attempts inside one step: what it finds is
 * the record's, and nothing here strikes). An animal that is searching looks like one that is: a cat creeps in stops, a
 * heron wades in slow steps and freezes, a ground bird runs and stops with its head tilted, an ambusher mostly waits, a
 * raptor soars, a hawker weaves.
 *
 *   creep   moves in short bursts low and slow, stopping to look (a cat, a fox, a jumping spider)
 *   watch   waits much more than it moves (a gecko, a mantis, a toad, a crocodile, an owl on its perch)
 *   wade    slow placed steps, then stock still (herons, egrets, storks)
 *   glean   runs a few strides and stops, head tilted (a blackbird, a plover)
 *   soar    sweeps wide circles on the wing (a hawk, a kite, an osprey, a kestrel hanging in the wind)
 *   weave   quartering the air in sweeps from side to side (swallows, dragonflies)
 */
import {huntActOf, type HuntAct} from "@/ark-scene/hunt-acts";
import type {ArkBeat, ArkDoing} from "@/ark-scene/behaviour-schedule";

export type SearchStyle = "creep" | "watch" | "wade" | "glean" | "soar" | "weave";

const OF: Partial<Record<HuntAct, SearchStyle>> = {pounce: "creep", leap: "creep", jump: "creep", dash: "watch", lunge: "watch", tongue: "watch", web: "watch", lurk: "watch", drop: "watch", wade: "wade", peck: "glean", hover: "soar", plunge: "soar", talon: "soar", stoop: "soar", hawk: "weave"};

/** The search a species walks, or null: the plain walk between waypoints. */
export function searchStyleOf(slug: string): SearchStyle | null {
    const act = huntActOf(slug);
    return act ? OF[act] ?? null : null;
}

function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

/** Real seconds one 15-Ark-minute step lasts (the leg's time): the cycles below fit it. */
const LEG_SECONDS = 34;

type Cycle = {period: number; moving: number; beat: ArkBeat; still: ArkBeat};
const CYCLE: Record<SearchStyle, Cycle> = {
    creep: {period: 3.2, moving: 0.55, beat: "stalk", still: "scan"},
    watch: {period: 11, moving: 0.2, beat: "walk", still: "scan"},
    wade: {period: 4.5, moving: 0.35, beat: "walk", still: "scan"},
    glean: {period: 2.4, moving: 0.45, beat: "run", still: "scan"},
    soar: {period: 34, moving: 1, beat: "glide", still: "glide"},
    weave: {period: 34, moving: 1, beat: "fly", still: "fly"}
};

export type SearchLeg = {
    /** How far along the leg it is (0-1): stops and starts for a walker, a plain run for a flyer. */
    u: number;
    moving: boolean;
    beat: ArkBeat;
    doing: ArkDoing | null;
    /** Metres out to the side of the leg's line (to the left of its way): zero at both waypoints. */
    side: number;
};

/**
 * A leg walked in the species' way, `u` (0-1) of the way along it. Pure in the animal's id, the leg's number and `u`: the
 * same for every viewer.
 */
export function searchLeg(style: SearchStyle, u: number, key: string, length: number, flyer: boolean): SearchLeg {
    const c = CYCLE[style];
    const jitter = 0.8 + 0.4 * unit(`${key}:search`);
    if (style === "soar" || style === "weave") {
        const k = clamp(length, 0.05, 3);
        // Wide sweeps: a few metres to each side, a round or two over the leg; zero at both ends.
        const amplitude = Math.min(Math.max(k * 5, 1.5), 4.2);
        const turns = (style === "soar" ? 1.5 : 3) * jitter;
        const phase = unit(`${key}:phase`) * Math.PI * 2;
        const env = Math.sin(Math.PI * u);
        const side = amplitude * env * Math.sin(2 * Math.PI * turns * u + phase) - amplitude * env * Math.sin(phase);
        return {u, moving: true, beat: flyer ? (style === "soar" ? "glide" : Math.sin(u * 40 + phase) > 0.6 ? "glide" : "fly") : "walk", doing: flyer ? (style === "soar" ? "soar" : "fly") : null, side};
    }
    const n = Math.max(Math.round((LEG_SECONDS / c.period) * jitter), 1);
    const x = u * n;
    const whole = Math.min(Math.floor(x), n - 1);
    const f = x - whole;
    const go = clamp(f / c.moving, 0, 1);
    // (Ease in and out of each burst: a step starts and ends gently.)
    const eased = go * go * (3 - 2 * go);
    return {u: (whole + eased) / n, moving: f < c.moving, beat: f < c.moving ? c.beat : c.still, doing: null, side: 0};
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
