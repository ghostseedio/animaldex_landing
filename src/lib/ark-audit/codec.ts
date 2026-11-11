/**
 * Samples packed into shared typed arrays, so worker threads can simulate
 * slices of the Ark and the main thread can measure the whole of it.
 * Per sample: 4 floats (x, y, z, yaw) and 4 bytes (state, doing, clip, flags).
 */

import type {AuditSample} from "./types";

export const STATES = ["asleep", "awake", "flying", "breathing", "other"] as const;
export const DOINGS = [null, "sleep", "to_roost", "rest", "wander", "forage", "graze", "drink", "perch", "fly", "soar", "swim", "breathe", "dive", "bask", "burrow", "climb", "groom", "hide", "visit_flowers", "circle_light", "crawl", "idle", "flee", "other"] as const;
export const CLIPS = [null, "idle", "walk", "run", "hop", "slither", "swim", "climb", "perch", "hang", "leap", "burrow", "emerge", "flap", "glide", "takeoff", "land", "other"] as const;

const code = <T>(list: readonly T[], value: T) => {
    const i = list.indexOf(value);
    return i >= 0 ? i : list.length - 1;
};

export function packSample(s: AuditSample, floats: Float32Array, bytes: Uint8Array, at: number) {
    floats[at * 4] = s.x;
    floats[at * 4 + 1] = s.y;
    floats[at * 4 + 2] = s.z;
    floats[at * 4 + 3] = s.yaw;
    bytes[at * 4] = code(STATES as readonly string[], s.state);
    bytes[at * 4 + 1] = code(DOINGS as readonly (string | null)[], s.doing);
    bytes[at * 4 + 2] = code(CLIPS as readonly (string | null)[], s.clip);
    bytes[at * 4 + 3] = (s.aloft ? 1 : 0) | (s.moving ? 2 : 0) | (s.wingsOpen ? 4 : 0) | (s.headDown ? 8 : 0) | (s.inWater ? 16 : 0) | (s.raised ? 32 : 0);
}

export function blankSample(): AuditSample {
    return {state: "awake", doing: null, x: 0, y: 0, z: 0, yaw: 0, aloft: false, moving: false, wingsOpen: false, clip: null, headDown: false, inWater: false, raised: false};
}

export function unpackSample(floats: Float32Array, bytes: Uint8Array, at: number, into: AuditSample): AuditSample {
    into.x = floats[at * 4];
    into.y = floats[at * 4 + 1];
    into.z = floats[at * 4 + 2];
    into.yaw = floats[at * 4 + 3];
    into.state = STATES[bytes[at * 4]];
    into.doing = DOINGS[bytes[at * 4 + 1]];
    into.clip = CLIPS[bytes[at * 4 + 2]];
    const f = bytes[at * 4 + 3];
    into.aloft = Boolean(f & 1);
    into.moving = Boolean(f & 2);
    into.wingsOpen = Boolean(f & 4);
    into.headDown = Boolean(f & 8);
    into.inWater = Boolean(f & 16);
    into.raised = Boolean(f & 32);
    return into;
}
