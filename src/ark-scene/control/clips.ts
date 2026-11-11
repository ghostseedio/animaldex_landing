/**
 * A controlled animal's clip (the wire's, `protocol.ts` CLIPS) to the rig clip its rig plays (`rig-clips.ts`, rig v2
 * and v6 names; design §4.1): the first the rig has, in order; played by the distance covered for gaits (feet
 * planted), by time otherwise. Flight clips exist only where the rig set approved them (`flight_approved`); without
 * them a flyer holds its take-off's last frame, wings open (D16), or its idle.
 */

import type {Clip} from "@/ark-live/protocol";

const ORDER: Record<Clip, string[]> = {
    idle: ["idle"],
    walk: ["walk", "slither", "hop"],
    run: ["run", "bound", "walk", "slither", "hop"],
    sprint: ["run", "bound", "walk", "slither"],
    stalk: ["walk", "slither"],
    swim: ["swim", "slither", "paddle"],
    paddle: ["paddle", "swim"],
    dive: ["dive", "swim"],
    surface: ["surface", "paddle", "swim"],
    takeoff: ["takeoff", "flap"],
    flap: ["flap", "glide", "soar"],
    glide: ["glide", "soar", "flap"],
    soar: ["soar", "glide", "flap"],
    hover: ["hover", "flap"],
    bank_l: ["bank_l", "glide", "flap"],
    bank_r: ["bank_r", "glide", "flap"],
    land: ["land", "idle"],
    perch: ["perch", "idle"],
    climb: ["climb", "walk"],
    leap: ["leap", "run"],
    hang: ["hang", "climb", "idle"],
    burrow: ["burrow", "dig", "walk"],
    emerge: ["emerge", "idle"],
    slither: ["slither", "walk"],
    hop: ["hop", "walk"],
    enter_water: ["enter_water", "walk"],
    exit_water: ["exit_water", "walk"],
    shake_off: ["shake_off", "idle"],
    lie: ["lie", "sleep_lie", "lie_down", "idle"],
    strike: ["strike", "clash", "idle"],
    plunge: ["plunge", "dive", "glide"],
    rest: ["idle"]
};

const BY_DISTANCE = new Set(["walk", "run", "bound", "slither", "hop", "paddle", "climb"]);
const FLIGHT = new Set<Clip>(["takeoff", "flap", "glide", "soar", "hover", "bank_l", "bank_r", "plunge"]);

export type RigPick = {name: string; byDistance: boolean; hold?: number};

export function controlRigClip(clip: Clip, has: (name: string) => boolean): RigPick | null {
    for (const name of ORDER[clip] ?? ["idle"]) if (has(name)) return {name, byDistance: BY_DISTANCE.has(name)};
    // A flyer whose flight clips aren't approved: the take-off's last frame, wings spread (never the closed rest pose).
    if (FLIGHT.has(clip) && has("takeoff")) return {name: "takeoff", byDistance: false, hold: 1};
    return has("idle") ? {name: "idle", byDistance: false} : null;
}

export function isFlightClip(clip: Clip): boolean {
    return FLIGHT.has(clip);
}
