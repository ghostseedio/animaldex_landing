/**
 * The broken-wing display (3.3 batch, lane B; owner 2026-11-16): a ground-nesting parent lures a predator away from its
 * nest by dragging a wing and fluttering along the ground, then flies back. Only the species whose own stored text says
 * so (`bird-moves.json` `lure`, from the catalogue's rows: killdeer, southern lapwing, black-winged stilt, blue crane).
 *
 * There is no rig clip for it (the catalogue asks for one), so this is the plain procedural version: the bird runs a
 * few steps off its nest, then goes along the ground in short fluttering hops with its body rolled over onto one side
 * (the "broken" wing down, shaking), pausing to drag itself and look back, always further from the nest and never
 * nearer the predator than where it began (it leads off across the predator's line, not past it); at the end it stands
 * up and flies back in a low arc. PURE in the time. The wing itself does not hang: the body's roll and the flutter say it.
 *
 * Viewer-local and visual only, like the reactive layer and `mobbing.ts`: it starts for a bird on the ground near the
 * camera when one of its predators comes near, the predator is not moved (it does not follow), and the bird eases back
 * to where the shared schedule has it. The nest is the record's (the props' site for a sitter with eggs or chicks) when
 * the bird is at one; else the display starts from where the bird stands, and a sentence that speaks of its nest is
 * not said.
 */

import type {ActPose} from "@/ark-scene/acts";
import {FLIGHT_TILT, type MobHost} from "@/ark-scene/mobbing";

type Point = {x: number; z: number};
type Ground = (x: number, z: number) => number;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};
function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

/** The run off the nest, the lure along the ground, the look back, the flight home (s). */
export const LURE_RUN = 1.5;
export const LURE_LEAD = 14;
export const LURE_HOLD = 2;
export const LURE_FLY = 4;
export const LURE_SECONDS = LURE_RUN + LURE_LEAD + LURE_HOLD + LURE_FLY;
/** A hop and the drag after it (s), and the share of each stretch covered in the hop. */
const CYCLE = 1.4;
const HOP = 0.55;
const HOP_SHARE = 0.7;
/** How far over the body rolls onto its "broken" wing (rad), and the shake on it. */
export const LURE_ROLL = 0.55;
const SHAKE = 0.16;

export type LureScript = {
    nest: Point;
    /** The way it leads (a unit vector): across the predator's line and away. */
    dir: Point;
    /** The run's length and the whole lure's (m from the nest). */
    run: number;
    reach: number;
    /** Which wing is down: 1 or -1. */
    side: number;
    length: number;
};

/**
 * The lure's script for a bird at its nest and a predator: null when there is no dry ground to lead across. It leads at
 * a right angle or more to the line from the nest to the predator, so the predator is never nearer than at the start.
 */
export function lureScript(nest: Point, threat: Point, key: string, birdLength: number, ground: Ground): LureScript | null {
    const to = Math.atan2(threat.x - nest.x, threat.z - nest.z);
    const first = unit(`${key}:side`) < 0.5 ? -1 : 1;
    const length = Math.max(birdLength, 0.1);
    for (const side of [first, -first]) {
        const a = to + side * (1.62 + 0.35 * unit(`${key}:angle`));
        const dir = {x: Math.sin(a), z: Math.cos(a)};
        for (const reach of [clamp(length * 30, 5, 9), 3.5]) {
            let dry = true;
            for (let k = 1; k <= 8 && dry; k++) dry = ground(nest.x + dir.x * reach * (k / 8), nest.z + dir.z * reach * (k / 8)) > 0.03;
            if (dry) return {nest, dir, run: Math.min(length * 4, reach * 0.2), reach, side, length};
        }
    }
    return null;
}

/** How far along its way it is at `s` (m from the nest): never going back until it flies home. */
export function lureAlong(sc: LureScript, s: number): {d: number; hop: number; dragging: boolean} {
    if (s <= LURE_RUN) return {d: sc.run * ease(s / LURE_RUN), hop: 0, dragging: false};
    const t = Math.min(s - LURE_RUN, LURE_LEAD);
    const cycles = LURE_LEAD / CYCLE;
    const each = (sc.reach - sc.run) / cycles;
    const n = Math.min(Math.floor(t / CYCLE), cycles - 1);
    const u = t - n * CYCLE;
    const inHop = u < HOP;
    const part = inHop ? HOP_SHARE * ease(u / HOP) : HOP_SHARE + (1 - HOP_SHARE) * Math.min((u - HOP) / (CYCLE - HOP), 1);
    return {d: sc.run + each * (n + part), hop: inHop && s < LURE_RUN + LURE_LEAD ? Math.sin(Math.PI * (u / HOP)) : 0, dragging: !inHop};
}

/** Its pose `s` seconds in, and whether it is in the air (the flight home, to `home`: where its day has it now). */
export function lurePose(sc: LureScript, s: number, ground: Ground, home: {x: number; y: number; z: number; yaw: number}): {pose: ActPose; aloft: boolean} | null {
    if (s < 0 || s >= LURE_SECONDS) return null;
    const yaw = Math.atan2(sc.dir.x, sc.dir.z);
    const at = (d: number) => ({x: sc.nest.x + sc.dir.x * d, z: sc.nest.z + sc.dir.z * d});
    const base = {pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false};
    if (s < LURE_RUN + LURE_LEAD) {
        const along = lureAlong(sc, s);
        const p = at(along.d);
        if (s < LURE_RUN) return {pose: {...base, ...p, base: ground(p.x, p.z), yaw, state: "run", speed: sc.run / LURE_RUN}, aloft: false};
        // Rolled onto the "broken" wing, shaking; up a little in each fluttering hop; dragging, it turns to look back.
        const lift = along.hop * Math.max(sc.length * 0.45, 0.06);
        const roll = sc.side * (LURE_ROLL + SHAKE * Math.sin(s * 23));
        return {pose: {...base, ...p, base: ground(p.x, p.z) + lift, yaw: yaw + (along.dragging ? sc.side * 0.6 : 0.12 * Math.sin(s * 11)), pitch: along.dragging ? 0.16 : 0.05, roll, state: along.dragging ? "scan" : "walk", speed: along.dragging ? 0.2 : ((sc.reach - sc.run) / (LURE_LEAD / CYCLE)) * HOP_SHARE / HOP}, aloft: false};
    }
    const end = at(sc.reach);
    if (s < LURE_RUN + LURE_LEAD + LURE_HOLD) {
        // Far enough: it stands up, whole again, and looks back the way it came.
        const k = ease((s - LURE_RUN - LURE_LEAD) / 0.8);
        return {pose: {...base, ...end, base: ground(end.x, end.z), yaw: yaw + sc.side * 0.6 + (Math.PI - 0.6) * sc.side * k, roll: sc.side * LURE_ROLL * (1 - k), state: "scan", speed: 0}, aloft: false};
    }
    // The flight home, low over the ground.
    const k = (s - LURE_RUN - LURE_LEAD - LURE_HOLD) / LURE_FLY;
    const e = ease(k);
    const x = end.x + (home.x - end.x) * e;
    const z = end.z + (home.z - end.z) * e;
    const from = ground(end.x, end.z);
    const y = Math.max(from + (home.y - from) * e + Math.sin(Math.PI * k) * 1.4, ground(x, z));
    const flat = Math.hypot(home.x - end.x, home.z - end.z);
    return {pose: {...base, x, z, base: y, yaw: flat > 0.05 ? Math.atan2(home.x - end.x, home.z - end.z) : home.yaw, pitch: FLIGHT_TILT * Math.sin(Math.PI * Math.min(k * 1.15, 1)) - 0.25 * Math.cos(Math.PI * k), state: k > 0.85 ? "land" : "fly", speed: flat / LURE_FLY}, aloft: k < 0.92};
}

export type LureHost<E> = MobHost<E> & {
    /** Its nest of the record now (the props' site for a sitter with eggs or chicks), or null. */
    nest: (entry: E, epoch: number) => Point | null;
};

/** How near a predator must come to the bird (m), and how long a bird that has done it leaves it be (s). */
export const LURE_REACH = 12;
export const LURE_NEST_REACH = 6;
export const LURE_REST = 180;

type Live<E> = {key: string; t0: number; bird: E; threat: E; script: LureScript; last: ActPose | null; nested: boolean};

export class BrokenWing<E> {
    private live: Live<E>[] = [];
    private rested = new Map<string, number>();
    private lookedAt = -Infinity;

    /** (The host's `mobs` says whether a species does the display.) */
    constructor(private readonly host: LureHost<E>) {}

    get active(): boolean {
        return this.live.length > 0;
    }

    due(epoch: number): boolean {
        return Math.abs(epoch - this.lookedAt) >= 1;
    }

    clear(): void {
        for (const l of this.live) if (l.last && this.host.act(l.bird) === l.last) this.host.setAct(l.bird, null, false);
        this.live = [];
    }

    /** The birds luring now (on the ground, past their run), for the live log; `nested`: it has a nest of the record. */
    seen(epoch: number): Array<{entry: E; episode: string; nested: boolean}> {
        return this.live.filter((l) => l.last && epoch - l.t0 > LURE_RUN && epoch - l.t0 < LURE_RUN + LURE_LEAD).map((l) => ({entry: l.bird, episode: l.key, nested: l.nested}));
    }

    /** This bird's display for this predator starts now (false: nowhere dry to lead it). */
    begin(epoch: number, bird: E, threat: E): boolean {
        const h = this.host;
        const at = h.place(bird);
        const foe = h.place(threat);
        if (!at || !foe) return false;
        const nest = h.nest(bird, epoch);
        const nested = Boolean(nest && Math.hypot(nest.x - at.x, nest.z - at.z) <= LURE_NEST_REACH);
        const key = `lure:${h.id(bird)}:${Math.round(epoch)}`;
        const script = lureScript(nested ? nest! : at, foe, key, h.length(bird), h.ground);
        if (!script) return false;
        this.live.push({key, t0: epoch, bird, threat, script, last: null, nested});
        this.rested.set(h.id(bird), epoch + LURE_REST);
        return true;
    }

    step(epoch: number, near: readonly E[]): void {
        const h = this.host;
        if (this.due(epoch)) {
            this.lookedAt = epoch;
            if (this.rested.size > 2000) this.rested.clear();
            for (const bird of near) {
                if (this.live.length >= 2) break;
                if (!h.mobs(bird) || !h.free(bird) || (this.rested.get(h.id(bird)) ?? -Infinity) > epoch || this.live.some((l) => l.bird === bird)) continue;
                const at = h.place(bird);
                // (On the ground: a bird up on a perch or in the air has no nest under it to lead from.)
                if (!at || at.y > h.ground(at.x, at.z) + 0.3) continue;
                let threat: E | null = null;
                let best = LURE_REACH;
                for (const other of near) {
                    if (other === bird || !h.threatens(other, bird)) continue;
                    const p = h.place(other);
                    const d = p ? Math.hypot(p.x - at.x, p.z - at.z) : Infinity;
                    if (d <= best) {
                        best = d;
                        threat = other;
                    }
                }
                if (threat) this.begin(epoch, bird, threat);
            }
        }
        if (!this.live.length) return;
        this.live = this.live.filter((l) => {
            const s = epoch - l.t0;
            // (Taken by something else since, a meal or a birth of the record: it is theirs.)
            if (h.act(l.bird) !== l.last) return false;
            const home = h.home(l.bird, epoch);
            const now = s >= 0 && home ? lurePose(l.script, s, h.ground, home) : null;
            if (!now) {
                if (l.last) h.setAct(l.bird, null, false);
                l.last = null;
                // (The clock set back to before it began: it waits.)
                return s < 0;
            }
            h.setAct(l.bird, now.pose, now.aloft);
            l.last = now.pose;
            return true;
        });
    }

    debug(): Array<{key: string; t0: number; nested: boolean; reach: number}> {
        return this.live.map((l) => ({key: l.key, t0: l.t0, nested: l.nested, reach: l.script.reach}));
    }
}
