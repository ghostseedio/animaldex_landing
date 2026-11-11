/**
 * The controller's own movement (design §4.1–4.3): from the player's input to the next pose, by the species' abilities
 * and the shared rules (`rules.ts`). The page runs it every frame for its own animal (client prediction); the load
 * test's bots run it too. The server never runs it: it checks the poses that come out of it (`validate.ts`).
 *
 * Deterministic for the same inputs. Pure.
 */

import type {Abilities} from "@/ark-live/species";
import {SPRINT_BURST_S, SPRINT_REFILL_PER_S, ACCEL_TIME_S, BURROW_DEPTH_M} from "@/ark-live/species";
import {angleDelta, wrapAngle, type Clip, type Mode, type StartPose, type WirePose} from "@/ark-live/protocol";
import {CELL, type Terrain, type TerrainCell} from "@/ark-live/terrain";
import {capFor, cellAllows, canSwitch, paddleLimit, stepLimits, surfaceY, SWITCH_SECONDS, LEAVE_SECONDS, waterModeFor, type AnimalFacts} from "@/ark-live/rules";
import type {Signals} from "@/ark-live/meters";

export type ControlInput = {
    /** The way the player wants to go, in world space (a unit vector, or zero), and how hard (0–1). */
    dirX: number;
    dirZ: number;
    amount: number;
    run: boolean;
    sprint: boolean;
    stalk: boolean;
    /** −1…1: down or up (a swimmer's depth, a flyer's climb, a climber's way along the trunk). */
    vertical: number;
    /** Edges (pressed this frame). */
    takeoff: boolean;
    land: boolean;
    dig: boolean;
    climb: boolean;
    /** Held: flap (a flyer) rather than glide; dive (a raptor's stoop, a seabird's plunge). */
    flap: boolean;
    dive: boolean;
};

export const NO_INPUT: ControlInput = {dirX: 0, dirZ: 0, amount: 0, run: false, sprint: false, stalk: false, vertical: 0, takeoff: false, land: false, dig: false, climb: false, flap: false, dive: false};

export type MoverState = WirePose & {
    /** Seconds since control began (the mover's own clock). */
    t: number;
    /** Vertical speed (m/s). */
    vy: number;
    /** A switch of mode is under way until this time (s). */
    switchUntil: number;
    sprintTokens: number;
    /** Deep water paddled since it last stood (a non-swimmer's limit). */
    paddled: number;
    /** Why the last step was stopped short (for the HUD's notices), or null. */
    blocked: "cant_swim" | "cant_climb" | "terrain" | "steep" | "pen" | "paddle" | null;
    /** True when the last step went down a slope too steep to come back up (the HUD warns). */
    oneWayDrop: boolean;
};

export type MoveContext = {a: Abilities; facts: AnimalFacts; terrain: Terrain; sig: Signals | null};

export function startMover(start: StartPose, ctx: MoveContext): MoverState {
    return {
        x: start.x,
        y: start.y,
        z: start.z,
        yaw: start.yaw,
        pitch: 0,
        roll: 0,
        mode: start.mode,
        clip: "idle",
        speed: 0,
        t: 0,
        vy: 0,
        switchUntil: 0,
        sprintTokens: SPRINT_BURST_S,
        paddled: 0,
        blocked: null,
        oneWayDrop: false
    };
}

const approach = (value: number, target: number, step: number) => (value < target ? Math.min(value + step, target) : Math.max(value - step, target));

/** Where it sits in this mode over this cell (the server sets the same for grounded modes). */
export function restingY(a: Abilities, mode: Mode, cell: TerrainCell, ground: number, y: number): number {
    switch (mode) {
        case "ground":
        case "wade":
            return ground;
        case "paddle":
            return surfaceY(cell) - Math.min(0.35 * a.D, Math.max(cell.depth - 0.05, 0));
        case "burrow":
            return Math.max(Math.min(y, ground), ground - BURROW_DEPTH_M);
        default:
            return y;
    }
}

/** The gait it asks for (its target speed's cap). */
function gaitClip(a: Abilities, input: ControlInput, sig: Signals | null, tokens: number): Clip {
    const noRun = sig?.noRun ?? false;
    if (input.stalk) return "stalk";
    if (input.sprint && !noRun && a.sprint > 0 && tokens > 0.1) return "sprint";
    if ((input.run || input.sprint) && !noRun && a.run > 0) return "run";
    return "walk";
}

/** The gait it is actually in at this speed (slowing from a run it is still running): the label the server caps by. */
function gaitAtSpeed(a: Abilities, speed: number, wanted: Clip): Clip {
    if (wanted === "stalk" && speed <= a.walk * 0.5 + 1e-6) return "stalk";
    if (speed <= a.walk + 1e-6) return "walk";
    if (a.run > 0 && speed <= a.run + 1e-6) return "run";
    return a.sprint > 0 ? "sprint" : "run";
}

/** One step of the controller's animal. */
export function stepMover(s: MoverState, input: ControlInput, dt: number, ctx: MoveContext): MoverState {
    const {a, facts, terrain, sig} = ctx;
    const t = s.t + dt;
    const next: MoverState = {...s, t, blocked: null, oneWayDrop: false};
    const cellHere = terrain.cell(s.x, s.z);
    if (!cellHere || sig?.held) {
        next.speed = approach(s.speed, 0, (Math.max(a.walk, 0.5) / ACCEL_TIME_S) * dt);
        next.clip = sig?.lying ? "lie" : "idle";
        return next;
    }
    const groundHere = terrain.height(s.x, s.z);
    const switching = t < s.switchUntil;

    // Mode switches the player asks for (their clip plays for its length before it may go fast).
    if (!switching) {
        if (input.takeoff && a.canFly && s.mode !== "air" && canSwitch(a, s.mode, "air", cellHere, s.y, groundHere)) {
            next.mode = "air";
            next.clip = "takeoff";
            next.switchUntil = t + (SWITCH_SECONDS.air ?? 0.6);
            next.vy = Math.max(a.fly * 0.4, 1);
            return finishAir(next, s, input, dt, ctx);
        }
        if (input.dig && a.canBurrow && s.mode === "ground" && cellHere.flags & CELL.SOIL) {
            next.mode = "burrow";
            next.clip = "burrow";
            next.switchUntil = t + (SWITCH_SECONDS.burrow ?? 1);
            next.speed = 0;
            next.y = groundHere - 0.6;
            return next;
        }
        if (input.dig && s.mode === "burrow" && canSwitch(a, "burrow", "ground", cellHere, s.y, groundHere)) {
            next.mode = "ground";
            next.clip = "emerge";
            next.switchUntil = t + (LEAVE_SECONDS.burrow ?? 1);
            next.speed = 0;
            next.y = groundHere;
            return next;
        }
        if (input.climb && a.canClimb && s.mode === "ground" && cellHere.flags & CELL.CLIMB) {
            next.mode = "climb";
            next.clip = "climb";
            next.switchUntil = t + (SWITCH_SECONDS.climb ?? 0.25);
            next.speed = 0;
            return next;
        }
        if (input.climb && s.mode === "climb" && s.y - groundHere < 0.4) {
            next.mode = "ground";
            next.clip = "idle";
            next.y = groundHere;
            return next;
        }
    }

    switch (s.mode) {
        case "air":
        case "strait":
            return finishAir(next, s, input, dt, ctx);
        case "swim":
            return finishSwim(next, s, input, dt, ctx);
        case "climb":
            return finishClimb(next, s, input, dt, ctx, groundHere, cellHere);
        case "burrow":
            if (switching) return next;
            return finishSurface(next, s, input, dt, ctx, "burrow");
        default:
            if (switching && s.clip === "emerge") return next;
            return finishSurface(next, s, input, dt, ctx, s.mode);
    }
}

/** On foot, wading, paddling at the surface, or digging along under it: the turn, the gait, and the step. */
function finishSurface(next: MoverState, s: MoverState, input: ControlInput, dt: number, ctx: MoveContext, mode: Mode): MoverState {
    const {a, facts, terrain, sig} = ctx;
    const moving = input.amount > 0.05;
    const want = moving ? Math.atan2(input.dirX, input.dirZ) : s.yaw;
    const turn = angleDelta(s.yaw, want);
    const maxTurn = a.turnRate * dt;
    next.yaw = wrapAngle(s.yaw + Math.max(-maxTurn, Math.min(maxTurn, turn)));
    const align = Math.cos(angleDelta(next.yaw, want));
    let clip: Clip = mode === "paddle" ? "paddle" : mode === "burrow" ? "burrow" : gaitClip(a, input, sig, s.sprintTokens);
    if (mode === "wade" && (clip === "run" || clip === "sprint")) clip = "walk";
    const cap = capFor(a, mode, clip, sig);
    const target = moving ? cap * input.amount * Math.max(0.15, align) : 0;
    next.speed = approach(s.speed, target, (Math.max(cap, 0.3) / ACCEL_TIME_S) * dt);
    if (clip === "sprint" && next.speed > a.run) next.sprintTokens = Math.max(0, s.sprintTokens - dt);
    else next.sprintTokens = Math.min(SPRINT_BURST_S, s.sprintTokens + SPRINT_REFILL_PER_S * dt);
    const step = next.speed * dt;
    const nx = s.x + Math.sin(next.yaw) * step;
    const nz = s.z + Math.cos(next.yaw) * step;
    const moved = tryStep(next, s, nx, nz, mode, ctx);
    if (!moved) {
        // Slide along whatever stopped it, one axis at a time.
        if (!tryStep(next, s, nx, s.z, mode, ctx) && !tryStep(next, s, s.x, nz, mode, ctx)) {
            next.speed = 0;
            next.x = s.x;
            next.z = s.z;
            const cell = terrain.cell(s.x, s.z)!;
            next.y = restingY(a, next.mode, cell, terrain.height(s.x, s.z), s.y);
        }
    }
    // The swimmer's dive from the surface.
    if (next.mode === "paddle" && a.canSwim && input.vertical < -0.3) {
        const cell = terrain.cell(next.x, next.z);
        if (cell && cell.depth > Math.max(a.D, 0.6)) {
            next.mode = "swim";
            next.clip = "dive";
            next.vy = -Math.max(a.swim * 0.4, 0.4);
            return next;
        }
    }
    const gait = next.mode === "ground" && clip !== "paddle" && clip !== "burrow" ? gaitAtSpeed(a, next.speed, clip) : clip;
    next.clip = next.speed < 0.05 ? (next.mode === "paddle" ? "paddle" : next.mode === "burrow" ? "burrow" : "idle") : gait;
    void facts;
    return next;
}

/** Try one step on the surface; on success fill `next` and return true. */
function tryStep(next: MoverState, s: MoverState, nx: number, nz: number, mode: Mode, ctx: MoveContext): boolean {
    const {a, facts, terrain} = ctx;
    const cell = terrain.cell(nx, nz);
    if (!cell) {
        next.blocked = "terrain";
        return false;
    }
    const ground = terrain.height(nx, nz);
    // What the new cell asks for: on foot, wading, or at the water's surface (a burrower stays under).
    let nextMode: Mode | null = mode === "burrow" ? "burrow" : waterModeFor(a, cell);
    if (!nextMode) {
        next.blocked = a.gills ? "terrain" : "cant_swim";
        return false;
    }
    if (mode !== "burrow" && nextMode !== mode && !canSwitch(a, mode, nextMode, cell, s.y, ground)) {
        next.blocked = "cant_swim";
        return false;
    }
    const y = restingY(a, nextMode, cell, ground, s.y);
    const verdict = cellAllows(a, facts, nextMode, cell, y, ground);
    if (!verdict.ok) {
        next.blocked = verdict.reason === "enclosure" ? "pen" : verdict.reason === "depth" ? "cant_swim" : "terrain";
        return false;
    }
    if (nextMode === "ground" || nextMode === "wade") {
        const here = terrain.height(s.x, s.z);
        const run = Math.hypot(nx - s.x, nz - s.z);
        const limits = stepLimits(a, facts.zone);
        if (run > 1e-4 && (ground - here) / run > limits.up) {
            next.blocked = "steep";
            return false;
        }
        if (run > 1e-4 && (here - ground) / run > limits.up) next.oneWayDrop = true;
    }
    // A non-swimmer's paddle across deep water: only so far, then only back toward the shallows.
    let paddled = s.paddled;
    if (nextMode === "paddle" && !a.canSwim) {
        const here = terrain.cell(s.x, s.z);
        paddled += Math.hypot(nx - s.x, nz - s.z);
        if (paddled > paddleLimit(a) && here && cell.depth > here.depth) {
            next.blocked = "paddle";
            return false;
        }
    } else if (nextMode === "ground" || nextMode === "wade") {
        paddled = 0;
    }
    next.x = nx;
    next.z = nz;
    next.y = y;
    next.mode = nextMode;
    next.paddled = paddled;
    next.pitch = 0;
    next.roll = 0;
    return true;
}

function finishAir(next: MoverState, s: MoverState, input: ControlInput, dt: number, ctx: MoveContext): MoverState {
    const {a, facts, terrain, sig} = ctx;
    const moving = input.amount > 0.05;
    const want = moving ? Math.atan2(input.dirX, input.dirZ) : next.yaw;
    const turn = angleDelta(next.yaw, want);
    const maxTurn = a.turnRate * 0.8 * dt;
    const dyaw = Math.max(-maxTurn, Math.min(maxTurn, turn));
    next.yaw = wrapAngle(next.yaw + dyaw);
    const diving = input.dive && a.diver;
    const climbing = input.vertical > 0.2;
    const flapping = input.flap || climbing || next.t < next.switchUntil;
    const cap = capFor(a, "air", diving ? "plunge" : "flap", sig);
    const cruise = a.fly * (flapping ? 1 : 0.85);
    let target = moving ? Math.min(cruise * Math.max(input.amount, 0.35), cap) : a.hover ? 0 : a.fly * 0.45;
    if (diving) target = cap;
    if (next.t < next.switchUntil) target = Math.min(target, a.fly * 0.5);
    next.speed = approach(s.speed, target, (Math.max(a.fly, 1) / 1.2) * dt);
    // Vertical: flaps climb (at most half its flight speed), a glide sinks, a stoop drops.
    let vy: number;
    if (next.t < next.switchUntil && next.clip === "takeoff") vy = Math.max(a.fly * 0.35, 0.8);
    else if (diving) vy = -Math.min(a.fly * 1.2, 20);
    else if (climbing) vy = a.fly * 0.5 * Math.min(input.vertical, 1);
    else if (input.vertical < -0.2) vy = -a.fly * 0.6 * Math.min(-input.vertical, 1);
    else vy = flapping ? 0 : -0.15 * next.speed;
    next.vy = vy;
    const step = next.speed * dt;
    const nx = s.x + Math.sin(next.yaw) * step;
    const nz = s.z + Math.cos(next.yaw) * step;
    const cell = terrain.cell(nx, nz);
    if (!cell || !cellAllows(a, facts, "air", cell, Math.max(s.y, terrain.height(nx, nz) + 0.4), terrain.height(nx, nz)).ok) {
        next.speed = 0;
        next.blocked = "terrain";
        next.clip = "hover";
        return next;
    }
    const ground = terrain.height(nx, nz);
    const base = Math.max(ground, surfaceY(cell));
    let y = s.y + vy * dt;
    y = Math.min(y, base + a.flightCeiling);
    next.x = nx;
    next.z = nz;
    // Touching down: near the ground (or the water) and coming down, or asked to land.
    const low = y - base < 0.35;
    if ((low && (vy < 0 || input.land)) || (input.land && y - base < 1.2)) {
        const mode = diving && cell.depth > 0.5 && a.canSwim ? "swim" : waterModeFor(a, cell) ?? (a.canSwim && cell.depth > 0 ? "paddle" : null);
        if (mode && canSwitch(a, "air", mode, cell, y, ground)) {
            next.mode = mode;
            next.clip = mode === "swim" ? "plunge" : "land";
            next.switchUntil = next.t + (LEAVE_SECONDS.air ?? 0.5);
            next.speed = Math.min(next.speed, capFor(a, mode, "walk", sig));
            next.vy = 0;
            next.y = restingY(a, mode, cell, ground, Math.min(y, surfaceY(cell)));
            next.pitch = 0;
            next.roll = 0;
            return next;
        }
    }
    next.y = Math.max(y, base + 0.3);
    next.pitch = Math.atan2(vy, Math.max(next.speed, 0.5)) * 0.6;
    next.roll = -Math.max(-0.45, Math.min(0.45, (dyaw / Math.max(dt, 1e-3)) * 0.25));
    const turning = Math.abs(dyaw / Math.max(dt, 1e-3)) > 0.6;
    next.clip =
        next.t < next.switchUntil ? "takeoff" :
        diving ? "plunge" :
        a.hover && next.speed < 0.4 ? "hover" :
        turning ? (dyaw > 0 ? "bank_r" : "bank_l") :
        flapping ? "flap" :
        a.altitude === "high" ? "soar" : "glide";
    return next;
}

function finishSwim(next: MoverState, s: MoverState, input: ControlInput, dt: number, ctx: MoveContext): MoverState {
    const {a, facts, terrain, sig} = ctx;
    const moving = input.amount > 0.05;
    const want = moving ? Math.atan2(input.dirX, input.dirZ) : next.yaw;
    const turn = angleDelta(next.yaw, want);
    const maxTurn = a.turnRate * dt;
    next.yaw = wrapAngle(next.yaw + Math.max(-maxTurn, Math.min(maxTurn, turn)));
    const dash = input.sprint && !(sig?.noRun ?? false) && s.sprintTokens > 0.1;
    const cap = capFor(a, "swim", "swim", sig) * (dash ? 1 : 0.8);
    const target = moving ? cap * input.amount * Math.max(0.2, Math.cos(angleDelta(next.yaw, want))) : 0;
    next.speed = approach(s.speed, target, (Math.max(cap, 0.3) / ACCEL_TIME_S) * dt);
    if (dash && moving) next.sprintTokens = Math.max(0, s.sprintTokens - dt);
    else next.sprintTokens = Math.min(SPRINT_BURST_S, s.sprintTokens + SPRINT_REFILL_PER_S * dt);
    const vy = input.vertical * a.swim * 0.5;
    const step = next.speed * dt;
    const nx = s.x + Math.sin(next.yaw) * step;
    const nz = s.z + Math.cos(next.yaw) * step;
    const cell = terrain.cell(nx, nz);
    if (!cell) {
        next.speed = 0;
        next.blocked = "terrain";
        return next;
    }
    const ground = terrain.height(nx, nz);
    const level = surfaceY(cell);
    const top = a.gills ? level - Math.min(0.3 * a.D, cell.depth * 0.5) : level;
    let y = Math.min(Math.max(s.y + vy * dt, ground + 0.1), top);
    if (cell.depth <= 0 || (a.gills && cell.depth < 0.3 * a.D)) {
        // The shore: a fish turns back; an air-breather comes out at the surface.
        if (a.gills || !a.land) {
            next.speed = 0;
            next.blocked = "terrain";
            next.clip = "swim";
            return next;
        }
        const mode = waterModeFor(a, cell);
        if (!mode) {
            next.speed = 0;
            next.blocked = "terrain";
            return next;
        }
        next.mode = mode;
        next.x = nx;
        next.z = nz;
        next.y = restingY(a, mode, cell, ground, y);
        next.clip = "exit_water";
        return next;
    }
    if (!cellAllows(a, facts, "swim", cell, y, ground).ok) {
        next.speed = 0;
        next.blocked = "terrain";
        next.clip = "swim";
        return next;
    }
    next.x = nx;
    next.z = nz;
    // An air-breather at the surface and rising: paddling on top.
    if (!a.gills && y >= level - 0.05 && input.vertical >= 0) {
        next.mode = "paddle";
        next.y = restingY(a, "paddle", cell, ground, y);
        next.clip = "surface";
        next.vy = 0;
        return next;
    }
    next.y = y;
    next.vy = vy;
    next.pitch = Math.atan2(vy, Math.max(next.speed, 0.3)) * 0.8;
    next.clip = "swim";
    return next;
}

function finishClimb(next: MoverState, s: MoverState, input: ControlInput, dt: number, ctx: MoveContext, ground: number, cell: TerrainCell): MoverState {
    const {a, sig} = ctx;
    const cap = capFor(a, "climb", "climb", sig);
    // Up and down the trunk with the stick's forward and back (or the vertical keys).
    const along = input.vertical !== 0 ? input.vertical : input.amount > 0.05 ? Math.cos(angleDelta(s.yaw, Math.atan2(input.dirX, input.dirZ))) * input.amount : 0;
    const vy = along * cap;
    let y = s.y + vy * dt;
    const top = ground + Math.max(cell.climbTop, 0);
    y = Math.min(Math.max(y, ground), top);
    next.y = y;
    next.vy = vy;
    next.speed = Math.abs(vy);
    next.clip = Math.abs(vy) > 0.02 ? "climb" : "hang";
    if (y <= ground + 0.02 && along < -0.2) {
        next.mode = "ground";
        next.clip = "idle";
        next.y = ground;
    }
    if (input.takeoff && a.canFly) {
        next.mode = "air";
        next.clip = "takeoff";
        next.switchUntil = next.t + (SWITCH_SECONDS.air ?? 0.6);
    }
    return next;
}
