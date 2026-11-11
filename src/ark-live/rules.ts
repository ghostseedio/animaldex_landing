/**
 * The movement rules both sides share (design §4.3–4.5): which modes a species has, how fast it may go in each, where
 * each mode is allowed, and how long the switches between them take. The page's controller (`movement.ts`) moves by
 * them; the server's validator (`validate.ts`) checks every pose against them with a small tolerance.
 *
 * Pure.
 */

import type {Abilities} from "@/ark-live/species";
import {maxSlopeFor, PADDLE_LIMIT_M, BURROW_DEPTH_M} from "@/ark-live/species";
import {CELL, FARM_PEN_BASE, type Terrain, type TerrainCell} from "@/ark-live/terrain";
import type {Clip, Mode} from "@/ark-live/protocol";
import type {Signals} from "@/ark-live/meters";
import type {ArkArea, ArkZone} from "@/ark-scene/types";

/** What the server knows about the controlled animal itself (never from the client). */
export type AnimalFacts = {
    id: string;
    slug: string;
    zone: ArkZone;
    area: ArkArea | null;
    /** A zoo animal's enclosure (Part C), or null. */
    enclosure: number | null;
};

/** The minimum time each switch takes (s): its clip's length (design §4.5 step 5). */
export const SWITCH_SECONDS: Partial<Record<Mode, number>> = {air: 0.6, burrow: 1.0, climb: 0.25};
/** Leaving a mode: a landing, coming up out of the ground. */
export const LEAVE_SECONDS: Partial<Record<Mode, number>> = {air: 0.5, burrow: 1.0};
/** Under the switch, it goes no faster than this share of its walk (or 0.4 m/s). */
export const SWITCH_SPEED_SHARE = 0.6;

export function modesFor(a: Abilities): Set<Mode> {
    const out = new Set<Mode>();
    if (a.sessile) return out;
    if (a.land) {
        out.add("ground");
        out.add("wade");
    }
    if (a.canSwim) {
        out.add("swim");
        if (!a.gills) out.add("paddle");
    }
    if (a.paddles) out.add("paddle");
    if (a.canFly) out.add("air");
    if (a.canClimb) out.add("climb");
    if (a.canBurrow) out.add("burrow");
    return out;
}

/** The speed cap (m/s) for a mode and clip, after the meters' limits. */
export function capFor(a: Abilities, mode: Mode, clip: Clip, sig: Pick<Signals, "walkFactor" | "noRun" | "held"> | null): number {
    if (sig?.held) return 0;
    const wf = sig?.walkFactor ?? 1;
    const noRun = sig?.noRun ?? false;
    switch (mode) {
        case "ground": {
            // The clip claims the gait; the sprint is bounded by its token bucket, the run by the meters.
            if (clip === "sprint" && !noRun && a.sprint > 0) return a.sprint;
            if ((clip === "run" || clip === "sprint") && !noRun && a.run > 0) return a.run;
            if (clip === "stalk") return a.walk * 0.5 * wf;
            return a.walk * wf;
        }
        case "wade":
            return a.wade * wf;
        case "paddle":
            return a.paddle * wf;
        case "swim":
            return a.swim * (noRun ? 0.7 : 1);
        case "air":
            if (clip === "plunge") return a.fly * 2;
            return a.fly * (noRun ? 0.8 : 1);
        case "climb":
            return a.climb * wf;
        case "burrow":
            return a.burrow * wf;
        case "strait":
            return Math.max(a.fly, a.swim);
        default:
            return 0;
    }
}

/** The fastest it can go in any mode it has (for the 1 s window and the teleport check). */
export function topSpeed(a: Abilities): number {
    return Math.max(a.sprint, a.run, a.walk, a.swim, a.fly * 2, a.climb, a.paddle, 0.3);
}

/** The world surface over a cell (the water's level, else the ground). */
export function surfaceY(cell: TerrainCell): number {
    return cell.depth > 0 ? cell.height + cell.depth : cell.height;
}

export type CellVerdict = {ok: true} | {ok: false; reason: "terrain" | "depth" | "altitude" | "mode" | "enclosure" | "bounds"};

/**
 * Whether the animal may be at this cell in this mode at height y (the server checks every cell a step crosses).
 * `ground` is the ground's height at the point.
 */
export function cellAllows(a: Abilities, facts: AnimalFacts, mode: Mode, cell: TerrainCell | null, y: number, ground: number): CellVerdict {
    if (!cell) return {ok: false, reason: "bounds"};
    // Pens: a zoo animal only in its enclosure; a farm animal only in a smallholding's yard and paddock (DECISIONS #10);
    // no one else walks into a zoo enclosure.
    if (facts.enclosure !== null) {
        if (cell.pen !== facts.enclosure) return {ok: false, reason: "enclosure"};
    } else if (facts.area === "farm") {
        if (cell.pen < FARM_PEN_BASE) return {ok: false, reason: "enclosure"};
    } else if (cell.pen > 0 && cell.pen < FARM_PEN_BASE) {
        return {ok: false, reason: "enclosure"};
    }
    const water = cell.depth;
    const level = surfaceY(cell);
    switch (mode) {
        case "ground":
            if (!a.land) return {ok: false, reason: "mode"};
            if (cell.flags & CELL.BLOCKED) return {ok: false, reason: "terrain"};
            if (water > 0.05) return {ok: false, reason: "depth"};
            return {ok: true};
        case "wade":
            if (!a.land) return {ok: false, reason: "mode"};
            if (cell.flags & CELL.BLOCKED) return {ok: false, reason: "terrain"};
            if (water > a.wadeDepth + 0.05) return {ok: false, reason: "depth"};
            return {ok: true};
        case "paddle":
            if (!(a.canSwim && !a.gills) && !a.paddles) return {ok: false, reason: "mode"};
            if (water <= 0) return {ok: false, reason: "depth"};
            if (y < level - Math.max(0.6 * a.D, 0.3) - 0.1 || y > level + 0.3) return {ok: false, reason: "depth"};
            return {ok: true};
        case "swim": {
            if (!a.canSwim) return {ok: false, reason: "mode"};
            if (water <= 0) return {ok: false, reason: "depth"};
            // Fish are never out of water: deep enough to cover them, and their middle under the surface.
            if (a.gills && water < 0.6 * a.D * 0.5) return {ok: false, reason: "depth"};
            const top = a.gills ? level - Math.min(0.3 * a.D, water * 0.5) : level + 0.2;
            if (y > top + 0.1 || y < ground - 0.15) return {ok: false, reason: "depth"};
            return {ok: true};
        }
        case "air": {
            if (!a.canFly) return {ok: false, reason: "mode"};
            const base = Math.max(ground, level);
            if (y > base + a.flightCeiling + 0.5) return {ok: false, reason: "altitude"};
            if (y < ground - 0.1) return {ok: false, reason: "altitude"};
            return {ok: true};
        }
        case "climb":
            if (!a.canClimb) return {ok: false, reason: "mode"};
            if (!(cell.flags & CELL.CLIMB) && !(cell.flags & CELL.WALK)) return {ok: false, reason: "terrain"};
            if (y > ground + Math.max(cell.climbTop, 0) + 0.3 || y < ground - 0.2) return {ok: false, reason: "altitude"};
            if (!(cell.flags & CELL.CLIMB) && y > ground + 0.5) return {ok: false, reason: "altitude"};
            return {ok: true};
        case "burrow":
            if (!a.canBurrow) return {ok: false, reason: "mode"};
            if (!(cell.flags & CELL.SOIL)) return {ok: false, reason: "terrain"};
            if (y < ground - BURROW_DEPTH_M - 0.1 || y > ground + 0.2) return {ok: false, reason: "depth"};
            return {ok: true};
        default:
            return {ok: false, reason: "mode"};
    }
}

/** Whether a switch from one mode to another may happen here (design §4.5 step 5: the mode graph). */
export function canSwitch(a: Abilities, from: Mode, to: Mode, cell: TerrainCell | null, y: number, ground: number): boolean {
    if (from === to) return true;
    if (!cell) return false;
    const modes = modesFor(a);
    if (!modes.has(to)) return false;
    const pair = `${from}>${to}`;
    switch (pair) {
        // Into and out of water happen where the water is (the cell decides which).
        case "ground>wade":
        case "wade>ground":
        case "wade>paddle":
        case "paddle>wade":
        case "ground>paddle":
        case "paddle>ground":
        case "paddle>swim":
        case "swim>paddle":
        case "wade>swim":
        case "swim>wade":
        case "ground>swim":
        case "swim>ground":
            return true;
        // Taking off from the ground, the water's surface or a perch; landing near the ground or the water.
        case "ground>air":
        case "wade>air":
        case "paddle>air":
        case "climb>air":
            return true;
        case "air>ground":
        case "air>wade":
        case "air>climb":
        case "air>paddle":
            return y - Math.max(ground, surfaceY(cell)) < 1.2;
        case "air>swim":
            // A plunge into the sea (seabirds) or a dabbler's landing.
            return cell.depth > 0 && a.canSwim;
        case "ground>climb":
        case "climb>ground":
            return Boolean(cell.flags & (CELL.CLIMB | CELL.WALK));
        case "ground>burrow":
        case "burrow>ground":
            return Boolean(cell.flags & CELL.SOIL);
        default:
            return false;
    }
}

/** How steep a step may climb (rise over run) and drop (m), on foot. */
export function stepLimits(a: Abilities, zone: ArkZone): {up: number; drop: number} {
    return {up: maxSlopeFor(zone), drop: Math.max(1, 1.5 * a.D)};
}

/** The paddle limit for a non-swimmer (m of deep water per crossing). */
export function paddleLimit(a: Abilities): number {
    return a.canSwim ? Infinity : a.paddles ? PADDLE_LIMIT_M : 0;
}

/** The mode a point's cell calls for, for a walker coming onto it (ground, wade, or the water's surface). */
export function waterModeFor(a: Abilities, cell: TerrainCell): Mode | null {
    if (cell.depth <= 0.05) return a.land ? "ground" : null;
    if (a.land && cell.depth <= a.wadeDepth) return "wade";
    if (a.canSwim && a.gills) return "swim";
    if ((a.canSwim && !a.gills) || a.paddles) return "paddle";
    return null;
}

/** Sample a straight step every metre (and its end), calling `visit` with each point; false stops. */
export function walkLine(x0: number, z0: number, x1: number, z1: number, visit: (x: number, z: number, f: number) => boolean): boolean {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(d / 0.9));
    for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        if (!visit(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, f)) return false;
    }
    return true;
}

export function terrainGround(t: Terrain, x: number, z: number): number {
    return t.height(x, z);
}
