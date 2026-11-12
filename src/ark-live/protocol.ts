/**
 * The `ark-live` wire protocol (design §2.3; docs/ark/player-control-contract.md §6).
 *
 * Hot messages are binary, little-endian, one message per WebSocket frame, the first byte its type:
 *
 *   PING        C→S  [1][c0 u32]                                                                  5 B
 *   PONG        S→C  [2][c0 u32][s u32]                                                           9 B
 *   POSE        C→S  [3][seq u16][t u32][x i16][z i16][y i16][yaw u16][pitch i8][roll i8]
 *                    [mode u8][clip u8][speed u8][flags u8]                                       21 B
 *   SNAPSHOT    S→C  [4][tick u32][ack u16][n u8][flags u8] then n × 14 B:
 *                    [idx u16][x i16][z i16][y i16][yaw u8][roll i8][mode<<5|clip u8][phase u8][speed u8][flags u8]
 *   CORRECTION  S→C  [5][seq u16][reason u8][x i16][z i16][y i16][yaw u16][mode u8][clip u8]       14 B
 *   METER       S→C  [6][stamina u8][exposure u8][habitat u8][cause u8][flags u8][sessionLeft u16][dayLeft u16]  10 B
 *   NPC         S→C  [7][tick u32][n u8] then n × 8 B: [idx u16][dx i8][dz i8][dyaw i8][doing u8][alarm u8][look u8]
 *
 * Times (`c0`, `s`, `t`, `tick`) are milliseconds; `s`, `t` and `tick` count from the server's `epochBase` (sent in
 * `welcome`), wrapping at 2^32 (`unwrapMs`). Positions are in the island's `unit` (1 or 2 cm); heights always in cm.
 * Yaw is radians about up (0 = +z), pitch and roll radians × 80.
 *
 * Rare messages are JSON text frames with a `t` field (`TextToServer`, `TextToClient`).
 *
 * Pure: no Node, no DOM.
 */

import type {IslandId} from "@/ark-live/islands";

export const PROTOCOL_VERSION = 1;

export const MSG = {PING: 1, PONG: 2, POSE: 3, SNAPSHOT: 4, CORRECTION: 5, METER: 6, NPC: 7} as const;

/** How a controlled animal moves now (3 bits on the wire). `strait`: crossing between islands (design §12.3). */
export const MODES = ["ground", "wade", "paddle", "swim", "air", "climb", "burrow", "strait"] as const;
export type Mode = (typeof MODES)[number];

/** What its rig plays (5 bits). The scene maps each to the rig's clip where it has one (`control/clips.ts`). */
export const CLIPS = [
    "idle", "walk", "run", "sprint", "stalk", "swim", "paddle", "dive",
    "surface", "takeoff", "flap", "glide", "soar", "hover", "bank_l", "bank_r",
    "land", "perch", "climb", "leap", "hang", "burrow", "emerge", "slither",
    "hop", "enter_water", "exit_water", "shake_off", "lie", "strike", "plunge", "rest"
] as const;
export type Clip = (typeof CLIPS)[number];

/** Pose flags (client → server). */
export const POSE_FLAG = {RUN: 1, STALK: 2, SPRINT: 4, FIRST_PERSON: 8, STILL: 16} as const;
/** Snapshot flags per animal (server → everyone). */
export const ENTITY_FLAG = {EXHAUSTED: 1, DISTRESSED: 2, CROSSING: 4, HELD: 8, TALKING: 16, YOURS: 32} as const;
/** Meter flags (server → its controller). */
export const METER_FLAG = {EXHAUSTED: 1, DISTRESSED: 2, UNCOMFORTABLE: 4, IN_DANGER: 8, NO_RUN: 16, ONE_WAY_DROP: 32, CAN_CROSS: 64, HUNGRY: 128} as const;

/** Why the server corrected a pose. */
export const CORRECTION_REASONS = ["none", "speed", "teleport", "terrain", "mode", "time", "turn", "bounds", "enclosure", "held", "depth", "altitude", "exhausted", "crossing"] as const;
export type CorrectionReason = (typeof CORRECTION_REASONS)[number];

/** What is behind the habitat meter (the HUD's line). */
export const METER_CAUSES = ["none", "cold", "heat", "dry", "salt", "fresh", "deep", "shallow", "open_sea", "far_from_home", "other_island"] as const;
export type MeterCause = (typeof METER_CAUSES)[number];

export type WirePose = {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    roll: number;
    mode: Mode;
    clip: Clip;
    /** m/s over the ground (or through the water or the air). */
    speed: number;
};

export type PoseMessage = WirePose & {seq: number; t: number; flags: number};
export type SnapshotEntity = Omit<WirePose, "pitch"> & {idx: number; phase: number; flags: number};
export type SnapshotMessage = {tick: number; ack: number; flags: number; entities: SnapshotEntity[]};
export type CorrectionMessage = {seq: number; reason: CorrectionReason; x: number; y: number; z: number; yaw: number; mode: Mode; clip: Clip};
export type MeterMessage = {stamina: number; exposure: number; habitat: number; cause: MeterCause; flags: number; sessionLeft: number; dayLeft: number};
export type NpcOffset = {idx: number; dx: number; dz: number; dyaw: number; doing: number; alarm: number; look: number};
export type NpcMessage = {tick: number; offsets: NpcOffset[]};

export const POSE_BYTES = 21;
export const SNAPSHOT_HEADER_BYTES = 9;
export const SNAPSHOT_ENTITY_BYTES = 14;
export const NPC_HEADER_BYTES = 6;
export const NPC_OFFSET_BYTES = 8;

const TAU = Math.PI * 2;
const clampInt = (value: number, low: number, high: number) => Math.min(Math.max(Math.round(value), low), high);
const i16 = (value: number) => clampInt(value, -32768, 32767);
const i8 = (value: number) => clampInt(value, -128, 127);
const u8 = (value: number) => clampInt(value, 0, 255);
const u16 = (value: number) => clampInt(value, 0, 65535);

export function wrapAngle(angle: number): number {
    const a = angle % TAU;
    return a < 0 ? a + TAU : a;
}

/** The signed difference b − a, in (−π, π]. */
export function angleDelta(a: number, b: number): number {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d <= -Math.PI) d += TAU;
    return d;
}

export function modeIndex(mode: Mode): number {
    const i = MODES.indexOf(mode);
    return i < 0 ? 0 : i;
}

export function clipIndex(clip: Clip): number {
    const i = CLIPS.indexOf(clip);
    return i < 0 ? 0 : i;
}

/** A u32 millisecond stamp back to a full count, taking the one nearest `nearMs` (wraps every 49.7 days). */
export function unwrapMs(stamp: number, nearMs: number): number {
    const span = 2 ** 32;
    const base = nearMs - (nearMs % span);
    let best = base + stamp;
    for (const candidate of [best - span, best + span]) if (Math.abs(candidate - nearMs) < Math.abs(best - nearMs)) best = candidate;
    return best;
}

export function u32ms(ms: number): number {
    const span = 2 ** 32;
    const v = Math.floor(ms) % span;
    return v < 0 ? v + span : v;
}

// MARK: Binary

export function encodePing(c0: number): ArrayBuffer {
    const view = new DataView(new ArrayBuffer(5));
    view.setUint8(0, MSG.PING);
    view.setUint32(1, u32ms(c0), true);
    return view.buffer;
}

export function encodePong(c0: number, s: number): ArrayBuffer {
    const view = new DataView(new ArrayBuffer(9));
    view.setUint8(0, MSG.PONG);
    view.setUint32(1, u32ms(c0), true);
    view.setUint32(5, u32ms(s), true);
    return view.buffer;
}

export function encodePose(pose: PoseMessage, unit: number): ArrayBuffer {
    const view = new DataView(new ArrayBuffer(POSE_BYTES));
    view.setUint8(0, MSG.POSE);
    view.setUint16(1, pose.seq & 0xffff, true);
    view.setUint32(3, u32ms(pose.t), true);
    view.setInt16(7, i16(pose.x / unit), true);
    view.setInt16(9, i16(pose.z / unit), true);
    view.setInt16(11, i16(pose.y * 100), true);
    view.setUint16(13, Math.round((wrapAngle(pose.yaw) / TAU) * 65536) & 0xffff, true);
    view.setInt8(15, i8(pose.pitch * 80));
    view.setInt8(16, i8(pose.roll * 80));
    view.setUint8(17, modeIndex(pose.mode));
    view.setUint8(18, clipIndex(pose.clip));
    view.setUint8(19, u8(pose.speed * 10));
    view.setUint8(20, pose.flags & 0xff);
    return view.buffer;
}

export function encodeSnapshot(message: SnapshotMessage, unit: number): ArrayBuffer {
    const n = Math.min(message.entities.length, 255);
    const view = new DataView(new ArrayBuffer(SNAPSHOT_HEADER_BYTES + n * SNAPSHOT_ENTITY_BYTES));
    view.setUint8(0, MSG.SNAPSHOT);
    view.setUint32(1, u32ms(message.tick), true);
    view.setUint16(5, message.ack & 0xffff, true);
    view.setUint8(7, n);
    view.setUint8(8, message.flags & 0xff);
    for (let i = 0; i < n; i++) {
        const e = message.entities[i];
        const o = SNAPSHOT_HEADER_BYTES + i * SNAPSHOT_ENTITY_BYTES;
        view.setUint16(o, e.idx & 0xffff, true);
        view.setInt16(o + 2, i16(e.x / unit), true);
        view.setInt16(o + 4, i16(e.z / unit), true);
        view.setInt16(o + 6, i16(e.y * 100), true);
        view.setUint8(o + 8, Math.round((wrapAngle(e.yaw) / TAU) * 256) & 0xff);
        view.setInt8(o + 9, i8(e.roll * 80));
        view.setUint8(o + 10, ((modeIndex(e.mode) & 7) << 5) | (clipIndex(e.clip) & 31));
        view.setUint8(o + 11, u8(e.phase * 255));
        view.setUint8(o + 12, u8(e.speed * 10));
        view.setUint8(o + 13, e.flags & 0xff);
    }
    return view.buffer;
}

export function encodeCorrection(message: CorrectionMessage, unit: number): ArrayBuffer {
    const view = new DataView(new ArrayBuffer(14));
    view.setUint8(0, MSG.CORRECTION);
    view.setUint16(1, message.seq & 0xffff, true);
    view.setUint8(3, Math.max(CORRECTION_REASONS.indexOf(message.reason), 0));
    view.setInt16(4, i16(message.x / unit), true);
    view.setInt16(6, i16(message.z / unit), true);
    view.setInt16(8, i16(message.y * 100), true);
    view.setUint16(10, Math.round((wrapAngle(message.yaw) / TAU) * 65536) & 0xffff, true);
    view.setUint8(12, modeIndex(message.mode));
    view.setUint8(13, clipIndex(message.clip));
    return view.buffer;
}

export function encodeMeter(message: MeterMessage): ArrayBuffer {
    const view = new DataView(new ArrayBuffer(10));
    view.setUint8(0, MSG.METER);
    view.setUint8(1, u8(message.stamina * 255));
    view.setUint8(2, u8(message.exposure * 255));
    view.setUint8(3, u8(message.habitat * 255));
    view.setUint8(4, Math.max(METER_CAUSES.indexOf(message.cause), 0));
    view.setUint8(5, message.flags & 0xff);
    view.setUint16(6, u16(message.sessionLeft), true);
    view.setUint16(8, u16(message.dayLeft), true);
    return view.buffer;
}

export function encodeNpc(message: NpcMessage): ArrayBuffer {
    const n = Math.min(message.offsets.length, 255);
    const view = new DataView(new ArrayBuffer(NPC_HEADER_BYTES + n * NPC_OFFSET_BYTES));
    view.setUint8(0, MSG.NPC);
    view.setUint32(1, u32ms(message.tick), true);
    view.setUint8(5, n);
    for (let i = 0; i < n; i++) {
        const o = NPC_HEADER_BYTES + i * NPC_OFFSET_BYTES;
        const e = message.offsets[i];
        view.setUint16(o, e.idx & 0xffff, true);
        view.setInt8(o + 2, i8(e.dx * 10));
        view.setInt8(o + 3, i8(e.dz * 10));
        view.setInt8(o + 4, i8(e.dyaw * 40));
        view.setUint8(o + 5, u8(e.doing));
        view.setUint8(o + 6, u8(e.alarm * 255));
        view.setUint8(o + 7, u8(e.look));
    }
    return view.buffer;
}

export type Decoded =
    | {type: "ping"; c0: number}
    | {type: "pong"; c0: number; s: number}
    | {type: "pose"; pose: PoseMessage}
    | {type: "snapshot"; snapshot: SnapshotMessage}
    | {type: "correction"; correction: CorrectionMessage}
    | {type: "meter"; meter: MeterMessage}
    | {type: "npc"; npc: NpcMessage};

function viewOf(data: ArrayBuffer | ArrayBufferView): DataView {
    return data instanceof ArrayBuffer ? new DataView(data) : new DataView(data.buffer, data.byteOffset, data.byteLength);
}

/** A binary frame, or null when it is malformed (wrong length, unknown type): never guessed. */
export function decodeBinary(data: ArrayBuffer | ArrayBufferView, unit: number): Decoded | null {
    const view = viewOf(data);
    if (view.byteLength < 1) return null;
    const type = view.getUint8(0);
    const len = view.byteLength;
    switch (type) {
        case MSG.PING:
            return len === 5 ? {type: "ping", c0: view.getUint32(1, true)} : null;
        case MSG.PONG:
            return len === 9 ? {type: "pong", c0: view.getUint32(1, true), s: view.getUint32(5, true)} : null;
        case MSG.POSE: {
            if (len !== POSE_BYTES) return null;
            const mode = MODES[view.getUint8(17)];
            const clip = CLIPS[view.getUint8(18)];
            if (!mode || !clip) return null;
            return {
                type: "pose",
                pose: {
                    seq: view.getUint16(1, true),
                    t: view.getUint32(3, true),
                    x: view.getInt16(7, true) * unit,
                    z: view.getInt16(9, true) * unit,
                    y: view.getInt16(11, true) / 100,
                    yaw: (view.getUint16(13, true) / 65536) * TAU,
                    pitch: view.getInt8(15) / 80,
                    roll: view.getInt8(16) / 80,
                    mode,
                    clip,
                    speed: view.getUint8(19) / 10,
                    flags: view.getUint8(20)
                }
            };
        }
        case MSG.SNAPSHOT: {
            if (len < SNAPSHOT_HEADER_BYTES) return null;
            const n = view.getUint8(7);
            if (len !== SNAPSHOT_HEADER_BYTES + n * SNAPSHOT_ENTITY_BYTES) return null;
            const entities: SnapshotEntity[] = [];
            for (let i = 0; i < n; i++) {
                const o = SNAPSHOT_HEADER_BYTES + i * SNAPSHOT_ENTITY_BYTES;
                const mc = view.getUint8(o + 10);
                entities.push({
                    idx: view.getUint16(o, true),
                    x: view.getInt16(o + 2, true) * unit,
                    z: view.getInt16(o + 4, true) * unit,
                    y: view.getInt16(o + 6, true) / 100,
                    yaw: (view.getUint8(o + 8) / 256) * TAU,
                    roll: view.getInt8(o + 9) / 80,
                    mode: MODES[(mc >> 5) & 7],
                    clip: CLIPS[mc & 31],
                    phase: view.getUint8(o + 11) / 255,
                    speed: view.getUint8(o + 12) / 10,
                    flags: view.getUint8(o + 13)
                });
            }
            return {type: "snapshot", snapshot: {tick: view.getUint32(1, true), ack: view.getUint16(5, true), flags: view.getUint8(8), entities}};
        }
        case MSG.CORRECTION: {
            if (len !== 14) return null;
            const mode = MODES[view.getUint8(12)];
            const clip = CLIPS[view.getUint8(13)];
            const reason = CORRECTION_REASONS[view.getUint8(3)];
            if (!mode || !clip || !reason) return null;
            return {
                type: "correction",
                correction: {
                    seq: view.getUint16(1, true),
                    reason,
                    x: view.getInt16(4, true) * unit,
                    z: view.getInt16(6, true) * unit,
                    y: view.getInt16(8, true) / 100,
                    yaw: (view.getUint16(10, true) / 65536) * TAU,
                    mode,
                    clip
                }
            };
        }
        case MSG.METER: {
            if (len !== 10) return null;
            const cause = METER_CAUSES[view.getUint8(4)];
            if (!cause) return null;
            return {
                type: "meter",
                meter: {
                    stamina: view.getUint8(1) / 255,
                    exposure: view.getUint8(2) / 255,
                    habitat: view.getUint8(3) / 255,
                    cause,
                    flags: view.getUint8(5),
                    sessionLeft: view.getUint16(6, true),
                    dayLeft: view.getUint16(8, true)
                }
            };
        }
        case MSG.NPC: {
            if (len < NPC_HEADER_BYTES) return null;
            const n = view.getUint8(5);
            if (len !== NPC_HEADER_BYTES + n * NPC_OFFSET_BYTES) return null;
            const offsets: NpcOffset[] = [];
            for (let i = 0; i < n; i++) {
                const o = NPC_HEADER_BYTES + i * NPC_OFFSET_BYTES;
                offsets.push({
                    idx: view.getUint16(o, true),
                    dx: view.getInt8(o + 2) / 10,
                    dz: view.getInt8(o + 3) / 10,
                    dyaw: view.getInt8(o + 4) / 40,
                    doing: view.getUint8(o + 5),
                    alarm: view.getUint8(o + 6) / 255,
                    look: view.getUint8(o + 7)
                });
            }
            return {type: "npc", npc: {tick: view.getUint32(1, true), offsets}};
        }
        default:
            return null;
    }
}

// MARK: Text

export type StartPose = {x: number; y: number; z: number; yaw: number; mode: Mode};

export type TextToServer =
    | {t: "hello"; proto: number; island: IslandId; tier?: "high" | "medium" | "low" | "lite"; client?: string; appVersion?: string}
    | {t: "view"; x: number; z: number; r?: number}
    | {t: "control"; ticket: string; start: StartPose}
    | {t: "resume"; sessionId: string; token: string}
    | {t: "release"}
    | {t: "cross"}
    | {t: "turn-back"}
    /** Phase 2: the controller's animal is talking (it holds still; stamina doesn't drain). */
    | {t: "talking"; active: boolean}
    /** Phase 3: a hunt contact the client saw (the server decides from its own poses). */
    | {t: "strike"; preyId: string};

export type ControlDeniedReason =
    | "bad_ticket" | "expired" | "used" | "wrong_island" | "busy" | "other_animal" | "off" | "not_yours" | "age"
    | "sessile" | "cooldown" | "daily_limit" | "start_pose" | "full" | "store" | "slow" | "rate";

export type ReleaseReason =
    | "player" | "session_limit" | "daily_limit" | "exposure" | "disconnect" | "shutdown" | "rejections" | "island" | "slow" | "replaced";

export type TextToClient =
    | {t: "welcome"; proto: number; island: IslandId; epochBase: number; unit: number; rate: number; aoi: number; tier: string}
    | {t: "joined"; idx: number; animalId: string; slug: string; island: IslandId}
    | {t: "left"; idx: number}
    | {t: "control-ok"; sessionId: string; resumeToken: string; idx: number; animalId: string; slug: string; start: StartPose; sessionLeft: number; dayLeft: number; stamina: number}
    | {t: "control-denied"; reason: ControlDeniedReason}
    | {t: "released"; reason: ReleaseReason; plan: "stay" | "homing" | "search" | "retrace" | "enclosure" | null}
    | {t: "crossing"; phase: "start" | "halfway" | "arrived" | "denied" | "turned-back" | "rescued"; reason?: string; to?: IslandId; token?: string}
    | {t: "notice"; key: "slow" | "stumble" | "one_way_drop" | "cant_climb" | "cant_swim" | "cant_fly" | "enclosure" | "shore_release"}
    | {t: "npcs"; base: number; ids: string[]}
    | {t: "talk-ready"; animalId: string | null}
    | {t: "hunt"; phase: "contact" | "confirmed" | "escaped" | "denied"; preyId: string; reason?: string};

export function parseText<T extends {t: string}>(text: string): T | null {
    try {
        const value = JSON.parse(text) as unknown;
        if (!value || typeof value !== "object" || typeof (value as {t?: unknown}).t !== "string") return null;
        return value as T;
    } catch {
        return null;
    }
}

/** The bytes a binary message costs on the wire, with TLS, WebSocket and TCP/IP framing (design §2.3: about 66 B). */
export const FRAME_OVERHEAD_BYTES = 66;
