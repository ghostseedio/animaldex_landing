/**
 * ARK-MATING-SHOWN (decision 416, owner 2026-11-20: "animals will look for eachother"; "an adult without a reachable
 * partner shows as looking for a mate"): an adult whose released state is `mate_seeking` (E6's read, `animal.state`)
 * does not stand idle. While its day has it awake and about, it roams in a loop about where its day
 * has it, a few of its own lengths out, and between the walks stops and looks about (its head turning one way, then the
 * other). On land only: one its day has in the water, the air, a tree or asleep is left as it is. Pure in the shared clock and its id, the same for every viewer; nothing here decides anything, and it is
 * never a herd's figure's job (only an animal drawn one by one takes an act pose).
 *
 * A meal, a mating, a birth or a moment has the animal first (`busy`). It eases in when the state arrives and out when
 * it goes, so nobody jumps.
 */

import type {ActPose} from "@/ark-scene/acts";

export type LiveSeekingHost<E> = {
    find: (id: string) => E | null;
    /** Its day's place at a time; null off its day (held, housed) or in the air. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; yaw: number; doing: string; aloft: boolean} | null;
    ground: (x: number, z: number) => number;
    walk: (entry: E) => number;
    length: (entry: E) => number;
    setAct: (entry: E, pose: ActPose | null) => void;
    busy: (entry: E) => boolean;
};

/** One loop: walking this long (s), then looking about this long. */
export const SEEK_WALK = 9;
export const SEEK_LOOK = 5;
const EASE = 3;
/** Only while its day has it about on the ground (`behaviour-schedule.ts` ArkDoing): never asleep, at rest, in a tree, in the air or in the water. */
const ABOUT = new Set(["watch", "wander", "forage", "graze", "browse", "drink", "bask", "groom"]);

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

/** How far round its loop (radians) and whether it is walking, `t` seconds on the shared clock. Pure. */
export function seekPhase(id: string, t: number, radius: number, pace: number): {angle: number; walking: boolean; look: number} {
    const period = SEEK_WALK + SEEK_LOOK;
    const shifted = t + unit(`${id}#seek`) * period;
    const n = Math.floor(shifted / period);
    const u = shifted - n * period;
    const walked = n * SEEK_WALK + Math.min(u, SEEK_WALK);
    const speed = clamp(pace, 0.2, 3) * 0.6;
    const sign = unit(`${id}#way`) < 0.5 ? -1 : 1;
    const angle = unit(`${id}#start`) * Math.PI * 2 + sign * ((walked * speed) / Math.max(radius, 0.05));
    return {angle, walking: u < SEEK_WALK, look: u < SEEK_WALK ? 0 : Math.sin(((u - SEEK_WALK) / SEEK_LOOK) * Math.PI * 2) * 0.9};
}

/** The roaming pose about `at` (its day's place), with `k` (0..1) of the loop's reach. Pure. */
export function seekPose(id: string, at: {x: number; z: number; yaw: number}, t: number, length: number, pace: number, k: number, ground: (x: number, z: number) => number): ActPose {
    const radius = clamp(length * 3, 1.2, 40);
    const p = seekPhase(id, t, radius, pace);
    const p0 = seekPhase(id, 0, radius, pace).angle;
    // (A loop through its day's place: centred a radius off it, so with k at 0 it is exactly where its day has it.)
    const cx = at.x - Math.sin(p0) * radius;
    const cz = at.z - Math.cos(p0) * radius;
    const x = at.x + (cx + Math.sin(p.angle) * radius - at.x) * k;
    const z = at.z + (cz + Math.cos(p.angle) * radius - at.z) * k;
    const sign = unit(`${id}#way`) < 0.5 ? -1 : 1;
    const along = p.angle + (sign * Math.PI) / 2;
    const yaw = k < 0.05 ? at.yaw : along + (p.walking ? 0 : p.look);
    const speed = p.walking ? clamp(pace, 0.2, 3) * 0.6 * k : 0;
    return {x, z, base: ground(x, z), yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: p.walking && k > 0.05 ? "walk" : "scan", speed};
}

export class LiveSeeking<E> {
    private ids = new Map<string, {since: number; until: number | null}>();
    private acting = new Set<E>();

    constructor(private readonly host: LiveSeekingHost<E>) {}

    get size(): number {
        return this.ids.size;
    }

    /** The ids the read says are looking for a mate now (`epoch`: the shared clock, s). */
    set(ids: Iterable<string>, epoch: number): void {
        const now = new Set(ids);
        for (const id of Array.from(now)) {
            const known = this.ids.get(id);
            if (!known) this.ids.set(id, {since: epoch, until: null});
            else if (known.until !== null) this.ids.set(id, {since: epoch - EASE * this.reach(known, epoch), until: null});
        }
        for (const [id, s] of Array.from(this.ids)) if (!now.has(id) && s.until === null) this.ids.set(id, {...s, until: epoch});
    }

    private reach(s: {since: number; until: number | null}, epoch: number): number {
        return Math.min(ease((epoch - s.since) / EASE), s.until === null ? 1 : 1 - ease((epoch - s.until) / EASE));
    }

    clear(): void {
        this.acting.forEach((e) => this.host.setAct(e, null));
        this.acting.clear();
        this.ids.clear();
    }

    step(epoch: number): void {
        const h = this.host;
        const acting = new Set<E>();
        for (const [id, s] of Array.from(this.ids)) {
            if (s.until !== null && epoch - s.until > EASE) {
                this.ids.delete(id);
                continue;
            }
            const entry = h.find(id);
            if (!entry || h.busy(entry)) continue;
            const at = h.scheduleAt(entry, epoch);
            if (!at || at.aloft || !ABOUT.has(at.doing)) continue;
            h.setAct(entry, seekPose(id, at, epoch, h.length(entry), h.walk(entry), this.reach(s, epoch), h.ground));
            acting.add(entry);
        }
        this.acting.forEach((e) => {
            if (!acting.has(e) && !h.busy(e)) h.setAct(e, null);
        });
        this.acting = acting;
    }
}
