/**
 * The server's check of every pose a controller proposes (design §4.5, §4.6). An accepted pose becomes the record and
 * is relayed to everyone; a rejected one gets a correction back to the last accepted pose. Three rejections in 5 s
 * hold the animal for a second (it "stumbles"); twenty in a minute end the session.
 *
 * What is checked, in order:
 *  1. order and time: newer sequence numbers only; the client's stamp clamped to [now − 1 s, now + 0.25 s];
 *  2. kinematics: each step ≤ cap(mode) × Δt × 1.15 + 0.05 m; a rolling 1 s window ≤ cap × 1.2 + 0.3 m; any single
 *     jump over max(1 m, cap × 0.25 s) rejected outright (no teleports); the sprint token bucket; the turn rate;
 *     climb and dive rates;
 *  3. the path: every metre of the step must allow the mode (no walking through trunks, walls or a ridge; no fish
 *     out of water; no non-flyer in the air; pens and enclosures are walls);
 *  4. the mode graph: switches only where the species has the move and the place allows it, each taking its clip's
 *     time before the animal may go fast;
 *  5. the server sets the height of grounded modes (nothing floats);
 *  6. the meters: a held animal (lying exhausted, a distressed stop) does not move.
 *
 * Pure: the server passes its own clock (ms).
 */

import type {Abilities} from "@/ark-live/species";
import {SPRINT_BURST_S, SPRINT_REFILL_PER_S, ACCEL_TIME_S} from "@/ark-live/species";
import {angleDelta, type CorrectionReason, type Mode, type PoseMessage, type WirePose} from "@/ark-live/protocol";
import type {Terrain} from "@/ark-live/terrain";
import {capFor, canSwitch, cellAllows, paddleLimit, stepLimits, surfaceY, topSpeed, walkLine, SWITCH_SECONDS, LEAVE_SECONDS, SWITCH_SPEED_SHARE, type AnimalFacts} from "@/ark-live/rules";
import type {Signals} from "@/ark-live/meters";
import {restingY} from "@/ark-live/movement";

export const STEP_SLACK = 1.15;
export const STEP_PAD_M = 0.05;
export const WINDOW_MS = 1000;
export const WINDOW_SLACK = 1.2;
export const WINDOW_PAD_M = 0.3;
export const CLOCK_BEHIND_MS = 1000;
export const CLOCK_AHEAD_MS = 250;
export const MAX_PACKETS_PER_S = 12;
export const STUMBLE_AFTER = 3;
export const STUMBLE_WITHIN_MS = 5000;
export const STUMBLE_MS = 1000;
export const END_AFTER = 20;
export const END_WITHIN_MS = 60_000;
export const HELD_GRACE_MS = 400;
export const RESYNC_MS = 700;

export type Accepted = WirePose & {seq: number; t: number; received: number};

export type Motion = {
    last: Accepted;
    /** Accepted steps in the last second (server receipt time, distance, and the cap each was allowed). */
    window: Array<{at: number; d: number; cap: number}>;
    /** Receipt times of packets in the last second (the rate limit). */
    packets: number[];
    rejections: number[];
    /** Total rejections (the audit's count). */
    rejected: number;
    heldUntil: number;
    heldSince: number | null;
    sprintTokens: number;
    switchUntil: number;
    paddled: number;
    distance: number;
    maxSpeed: number;
    /** Client stamps clamped (the audit). */
    clamped: number;
    /** Packets dropped for the rate (the audit). */
    dropped: number;
    /**
     * After a correction, poses already in flight (built on the rejected one) are dropped quietly until one comes back
     * near the corrected pose, or this time passes: one bad step is one correction, not a cascade.
     */
    resyncUntil: number;
};

export type ValidateContext = {a: Abilities; facts: AnimalFacts; terrain: Terrain; sig: Signals | null};

export type Verdict =
    | {kind: "accept"; pose: Accepted}
    | {kind: "drop"}
    | {kind: "reject"; reason: CorrectionReason; stumble: boolean; end: boolean};

export function newMotion(start: WirePose, now: number): Motion {
    return {
        last: {...start, seq: 0, t: now, received: now},
        window: [],
        packets: [],
        rejections: [],
        rejected: 0,
        heldUntil: 0,
        heldSince: null,
        sprintTokens: SPRINT_BURST_S,
        switchUntil: 0,
        paddled: 0,
        distance: 0,
        maxSpeed: 0,
        clamped: 0,
        dropped: 0,
        resyncUntil: 0
    };
}

function seqNewer(next: number, last: number): boolean {
    const d = (next - last) & 0xffff;
    return d > 0 && d < 0x8000;
}

/** Check one proposed pose. `p.t` is already unwrapped to server ms. Mutates `m` (the session's motion record). */
export function validatePose(m: Motion, p: PoseMessage, now: number, ctx: ValidateContext): Verdict {
    const {a, facts, terrain, sig} = ctx;
    // 1. Order, rate and time.
    m.packets = m.packets.filter((at) => now - at < 1000);
    if (m.packets.length >= MAX_PACKETS_PER_S) {
        m.dropped++;
        return {kind: "drop"};
    }
    m.packets.push(now);
    if (!seqNewer(p.seq, m.last.seq) && m.last.seq !== 0) return {kind: "drop"};
    let t = p.t;
    if (t < now - CLOCK_BEHIND_MS || t > now + CLOCK_AHEAD_MS) {
        t = Math.min(Math.max(t, now - CLOCK_BEHIND_MS), now + CLOCK_AHEAD_MS);
        m.clamped++;
    }
    if (t <= m.last.t) t = m.last.t + 1;
    const dt = Math.min((t - m.last.t) / 1000, 0.5);
    const last = m.last;

    const reject = (reason: CorrectionReason): Verdict => {
        if (now < m.resyncUntil) {
            m.last = {...m.last, seq: p.seq};
            return {kind: "drop"};
        }
        m.resyncUntil = now + RESYNC_MS;
        m.rejections = m.rejections.filter((at) => now - at < END_WITHIN_MS);
        m.rejections.push(now);
        m.rejected++;
        // A rejected step still advances the sequence: the client's later poses build on the correction.
        m.last = {...m.last, seq: p.seq};
        const recent = m.rejections.filter((at) => now - at < STUMBLE_WITHIN_MS).length;
        const stumble = recent >= STUMBLE_AFTER && m.heldUntil < now;
        if (stumble) m.heldUntil = now + STUMBLE_MS;
        return {kind: "reject", reason, stumble, end: m.rejections.length >= END_AFTER};
    };

    // Held: stumbling, lying exhausted, a distressed stop (with a short grace for the client to hear of it).
    const held = m.heldUntil > now || Boolean(sig?.held);
    if (held) m.heldSince ??= now;
    else m.heldSince = null;
    const flatD = Math.hypot(p.x - last.x, p.z - last.z);
    if (held && flatD > 0.15 && m.heldSince !== null && now - m.heldSince > HELD_GRACE_MS) return reject(m.heldUntil > now ? "held" : "exhausted");

    // 2. The mode graph.
    const cell = terrain.cell(p.x, p.z);
    if (!cell) return reject("bounds");
    const ground = terrain.height(p.x, p.z);
    const switching = p.mode !== last.mode;
    if (switching) {
        if (!canSwitch(a, last.mode, p.mode, cell, p.y, ground)) return reject("mode");
        const into = SWITCH_SECONDS[p.mode] ?? 0;
        const outOf = LEAVE_SECONDS[last.mode] ?? 0;
        m.switchUntil = Math.max(m.switchUntil, t + Math.max(into, outOf) * 1000);
    }

    // 3. Kinematics.
    const inSwitch = t < m.switchUntil;
    let cap = Math.max(capFor(a, p.mode, p.clip, sig), switching ? capFor(a, last.mode, last.clip, sig) : 0);
    if (inSwitch) cap = Math.min(cap, Math.max(a.walk * SWITCH_SPEED_SHARE, 0.4, last.speed * 1.1, p.mode === "air" ? a.fly * 0.5 : 0));
    // Slowing down takes time: what it carried from its last step may fade at its deceleration (a run eased to a walk,
    // a landing's glide, an exhausted animal coming to its new cap) without counting as speeding.
    const decel = Math.max(capFor(a, last.mode, "sprint", null), capFor(a, last.mode, "run", null), 0.3) / ACCEL_TIME_S;
    cap = Math.max(cap, last.speed - decel * dt);
    if (held) cap = Math.min(cap, 0.15);
    const vertical = p.mode === "air" || p.mode === "swim" || last.mode === "air" || last.mode === "swim";
    const d = vertical ? Math.hypot(flatD, p.y - last.y) : flatD;
    const jumpLimit = Math.max(1, topSpeed(a) * 0.25);
    if (flatD > jumpLimit) return reject("teleport");
    // (A dive drops faster than it flies forward: the stoop's vertical part is checked below.)
    const stepD = p.mode === "air" && p.y < last.y ? flatD : d;
    if (stepD > cap * dt * STEP_SLACK + STEP_PAD_M) return reject("speed");
    m.window = m.window.filter((w) => now - w.at < WINDOW_MS);
    const windowD = m.window.reduce((sum, w) => sum + w.d, 0) + flatD;
    // (Each step's own cap counts: a second that began at a run and ends at a walk may cover a run's worth.)
    const windowCap = m.window.reduce((most, w) => Math.max(most, w.cap), Math.max(cap, capFor(a, last.mode, last.clip, sig)));
    if (windowD > windowCap * WINDOW_SLACK + WINDOW_PAD_M) return reject("speed");
    // Sprint tokens: a sprint beyond its run is paid for from a 3 s bucket that refills a second every five.
    let tokens = Math.min(SPRINT_BURST_S, m.sprintTokens + SPRINT_REFILL_PER_S * dt);
    if (p.mode === "ground" && a.run > 0 && dt > 0 && flatD / dt > a.run * STEP_SLACK) {
        tokens -= dt;
        if (tokens < 0) return reject("speed");
    }
    // Turning.
    const turnCap = a.turnRate * (p.mode === "air" ? 0.8 : 1) * Math.max(dt, 0.05) * 1.3 + 0.15;
    if (p.mode === last.mode && p.mode !== "climb" && Math.abs(angleDelta(last.yaw, p.yaw)) > turnCap) return reject("turn");
    // Vertical rates.
    const dy = p.y - last.y;
    if (p.mode === "air" && !switching) {
        const up = a.fly * 0.5 * 1.25 + 1.2;
        const down = (a.diver ? 22 : a.fly * 0.7 + 1) * 1.15;
        if (dy > up * dt + 0.1 || -dy > down * dt + 0.15) return reject("altitude");
    }
    if (p.mode === "swim" && !switching && Math.abs(dy) > a.swim * 0.5 * 1.3 * dt + 0.15) return reject("depth");
    if (p.mode === "climb" && Math.abs(dy) > Math.max(a.climb, 0.2) * 1.3 * dt + 0.1) return reject("speed");

    // 4. The path, every metre of it.
    const limits = stepLimits(a, facts.zone);
    let pathFail: CorrectionReason | null = null;
    let prevH = terrain.height(last.x, last.z);
    let prevX = last.x;
    let prevZ = last.z;
    walkLine(last.x, last.z, p.x, p.z, (x, z, f) => {
        const c = terrain.cell(x, z);
        const g = terrain.height(x, z);
        const y = last.y + (p.y - last.y) * f;
        const mode: Mode = f < 0.5 && switching ? last.mode : p.mode;
        const yHere = mode === "ground" || mode === "wade" || mode === "paddle" ? (c ? restingY(a, mode, c, g, y) : y) : y;
        const verdict = cellAllows(a, facts, mode, c, yHere, g);
        if (!verdict.ok) {
            // (The switch's other end may be the one the cell allows: at a shore, either.)
            const other = switching ? cellAllows(a, facts, mode === p.mode ? last.mode : p.mode, c, yHere, g) : verdict;
            if (!other.ok) {
                pathFail = verdict.reason === "bounds" ? "bounds" : verdict.reason === "enclosure" ? "enclosure" : verdict.reason === "altitude" ? "altitude" : verdict.reason === "depth" ? "depth" : verdict.reason === "mode" ? "mode" : "terrain";
                return false;
            }
        }
        if (mode === "ground" || mode === "wade") {
            const run = Math.hypot(x - prevX, z - prevZ);
            if (run > 0.05 && (g - prevH) / run > limits.up * 1.1 + 0.05) {
                pathFail = "terrain";
                return false;
            }
        }
        prevH = g;
        prevX = x;
        prevZ = z;
        return true;
    });
    if (pathFail) return reject(pathFail);

    // A non-swimmer's paddle: so far across deep water, then only back toward the shallows.
    let paddled = m.paddled;
    if (p.mode === "paddle" && !a.canSwim) {
        paddled += flatD;
        const before = terrain.cell(last.x, last.z);
        if (paddled > paddleLimit(a) + 1 && before && cell.depth > before.depth + 0.02) return reject("depth");
    } else if (p.mode === "ground" || p.mode === "wade") {
        paddled = 0;
    }

    // 5. Accepted: the server sets the height of grounded modes.
    let y = p.y;
    if (p.mode === "ground" || p.mode === "wade" || p.mode === "paddle") y = restingY(a, p.mode, cell, ground, p.y);
    if (p.mode === "air") y = Math.max(y, ground - 0.05);
    void surfaceY;
    const pose: Accepted = {x: p.x, y, z: p.z, yaw: p.yaw, pitch: p.pitch, roll: p.roll, mode: p.mode, clip: p.clip, speed: dt > 0 ? Math.min(d / dt, 25) : 0, seq: p.seq, t, received: now};
    m.window.push({at: now, d: flatD, cap});
    m.resyncUntil = 0;
    m.last = pose;
    m.sprintTokens = tokens;
    m.paddled = paddled;
    m.distance += flatD;
    m.maxSpeed = Math.max(m.maxSpeed, pose.speed);
    return {kind: "accept", pose};
}
