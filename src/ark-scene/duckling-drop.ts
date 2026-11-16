/**
 * Ducklings dropping from the tree hole (3.3 batch, lane B; owner 2026-11-16): on the day the brood leaves the nest
 * the ducklings jump from the cavity one by one, bounce, and gather at their parent below. Only the species whose own
 * stored text says so (`bird-moves.json` `drop`: Muscovy duck, bufflehead, Australian wood duck, lesser whistling duck,
 * mandarin, cotton pygmy goose).
 *
 * The young are the record's: a hatching (`voyage_events` `birth` with `from_egg`) of one of these species, its parents
 * and its young. The record has no event for "the brood leaves the nest now", so the drop is acted from the hatch
 * event's time on the shared clock, the way a live birth is (`live-births.ts`), the same for every viewer: the stored
 * texts say they leave within a day of hatching ("day-old", "soon after hatching"), and the hatch is the record's only
 * moment for it. The scene never decides a hatching.
 *
 *   come     the mother walks to the foot of the tree under the hole;
 *   jump     the young, out of sight in the hole until then, come to its mouth one by one, jump out and down, bounce;
 *   gather   each runs to her side; they stay gathered at her a while;
 *   part     each walks back to where its day has it.
 *
 * The hole is the scenery's: the nearest drawn `tree_hollow` to her, else a sideways `bark` point well up a trunk (where
 * the props cut a hole for a cavity nester), found through the host. No hole near: nothing is acted (the young are where
 * their day has them). PURE in the time; like the births, it only says which act pose each takes.
 */

import type {ActPose} from "@/ark-scene/acts";

export type HatchAct = {key: string; parents: string[]; young: string[]; t0: number};

type Point = {x: number; z: number};
type Ground = (x: number, z: number) => number;
/** The hole: its mouth (world) and the way out of the trunk (level unit vector). */
export type Hollow = {x: number; y: number; z: number; nx: number; nz: number};

export type DuckDropHost<E> = {
    find: (id: string) => E | null;
    /** Its schedule's place at a time (pure in the time); null off the schedule. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; yaw: number} | null;
    /** Its species drops from a tree hole (`bird-moves.json` drop). */
    drops: (entry: E) => boolean;
    /** The nearest tree hole to a point (pure: the scenery's), or null. */
    hollow: (x: number, z: number) => Hollow | null;
    ground: Ground;
    length: (entry: E) => number;
    walk: (entry: E) => number;
    male: (entry: E) => boolean | null;
    setAct: (entry: E, pose: ActPose | null) => void;
    busy: (entry: E) => boolean;
};

export const DROP_LIVE_SECONDS = 20 * 60;
const COME = 6;
/** The first young at the mouth, then one every EACH s: a peek, the jump, the fall, a bounce. */
const FIRST = COME + 1;
const EACH = 2.6;
const PEEK = 0.8;
const BOUNCE = 0.45;
const RUN = 2.2;
const GATHERED = 10;
const PART_MIN = 4;
const PART_MAX = 20;
const SHOWN_MAX = 10;
/** How far out from the trunk a jump carries (m), at least. */
const OUT = 0.7;
const G = 9.8;

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

export type DropScript = {
    hole: Hollow;
    /** Where the mother waits, facing the tree, and where each young lands and then sits at her side. */
    foot: Point;
    footYaw: number;
    from: Point & {yaw: number};
    land: Point[];
    side: Point[];
    /** Each young's jump: when it leaves the mouth (s after t0) and how long it falls. */
    leave: number[];
    fall: number[];
    gatheredEnd: number;
    motherLength: number;
};

/** The drop's script, built once from where the mother's day has her at the hatch and the hole near her. */
export function dropScript(mother: Point & {yaw: number; length: number}, hole: Hollow, young: number, key: string, ground: Ground): DropScript {
    const n = clamp(young, 1, SHOWN_MAX);
    const out = {x: hole.nx, z: hole.nz};
    const across = {x: out.z, z: -out.x};
    const L = Math.max(mother.length, 0.2);
    const reach = OUT + L * 1.2;
    const foot = {x: hole.x + out.x * (reach + L * 0.9), z: hole.z + out.z * (reach + L * 0.9)};
    const land: Point[] = [];
    const side: Point[] = [];
    const leave: number[] = [];
    const fall: number[] = [];
    for (let k = 0; k < n; k++) {
        const spread = (unit(`${key}:l${k}`) - 0.5) * L * 1.2;
        const far = OUT + L * (0.6 + 0.5 * unit(`${key}:f${k}`));
        land.push({x: hole.x + out.x * far + across.x * spread, z: hole.z + out.z * far + across.z * spread});
        const a = (k - (n - 1) / 2) * 0.5;
        side.push({x: foot.x + (Math.cos(a) * out.x * 0.2 + Math.sin(a) * across.x) * L * 0.9, z: foot.z + (Math.cos(a) * out.z * 0.2 + Math.sin(a) * across.z) * L * 0.9});
        leave.push(FIRST + EACH * k + PEEK);
        const drop = Math.max(hole.y - ground(land[k].x, land[k].z), 0.2);
        fall.push(Math.sqrt((2 * drop) / G) + 0.12);
    }
    const lastDown = leave[n - 1] + fall[n - 1] + BOUNCE + RUN;
    return {hole, foot, footYaw: Math.atan2(hole.x - foot.x, hole.z - foot.z), from: {x: mother.x, z: mother.z, yaw: mother.yaw}, land, side, leave, fall, gatheredEnd: lastDown + GATHERED, motherLength: L};
}

const pose = (x: number, z: number, base: number, yaw: number, state: string, extra: Partial<ActPose> = {}): ActPose => ({x, z, base, yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0, ...extra});

/** The mother s seconds after the hatch: to the foot of the tree, then looking up at the hole and calling. */
export function dropMotherPose(sc: DropScript, s: number, ground: Ground): ActPose {
    const k = ease(s / COME);
    const x = sc.from.x + (sc.foot.x - sc.from.x) * k;
    const z = sc.from.z + (sc.foot.z - sc.from.z) * k;
    const d = Math.hypot(sc.foot.x - sc.from.x, sc.foot.z - sc.from.z);
    if (s < COME && d > 0.05) return pose(x, z, ground(x, z), Math.atan2(sc.foot.x - sc.from.x, sc.foot.z - sc.from.z), "walk", {speed: d / COME, meal: "resting"});
    // (Looking up at the hole while they come down; then round to them.)
    return pose(sc.foot.x, sc.foot.z, ground(sc.foot.x, sc.foot.z), sc.footYaw, "scan", {pitch: s < sc.leave[sc.leave.length - 1] + 1 ? -0.25 : 0, meal: "resting"});
}

/**
 * The k-th young s seconds after the hatch: hidden in the hole until its turn; at the mouth; out and down along a fall
 * (never back into the trunk, never under the ground); a bounce; then to her side.
 */
export function dropYoungPose(sc: DropScript, k: number, s: number, ground: Ground): ActPose {
    const i = Math.min(k, sc.land.length - 1);
    const out = Math.atan2(sc.hole.nx, sc.hole.nz);
    const leave = sc.leave[i];
    const hidden = k >= sc.land.length;
    if (s < leave - PEEK || hidden) return {...pose(sc.hole.x, sc.hole.z, sc.hole.y, out, "rest"), hidden: true};
    if (s < leave) return pose(sc.hole.x, sc.hole.z, sc.hole.y, out, "scan", {pitch: 0.25 * Math.sin(((s - leave + PEEK) / PEEK) * Math.PI)});
    const land = sc.land[i];
    const groundAt = ground(land.x, land.z);
    const t = s - leave;
    const T = sc.fall[i];
    if (t < T) {
        // Out level and down: the level part eases out from the mouth (only ever away from the trunk), the height falls.
        const u = t / T;
        const x = sc.hole.x + (land.x - sc.hole.x) * Math.sin((u * Math.PI) / 2);
        const z = sc.hole.z + (land.z - sc.hole.z) * Math.sin((u * Math.PI) / 2);
        const y = Math.max(sc.hole.y + 0.15 * Math.sin(Math.min(u * 4, 1) * Math.PI) - (sc.hole.y - groundAt) * u * u, ground(x, z));
        return pose(x, z, y, out, "fly", {pitch: 0.4 * u, roll: 0.3 * Math.sin(u * 9)});
    }
    if (t < T + BOUNCE) {
        const u = (t - T) / BOUNCE;
        return pose(land.x, land.z, groundAt + Math.sin(u * Math.PI) * 0.12, out, "rest", {pitch: -0.2 * (1 - u)});
    }
    const side = sc.side[i];
    const r = (t - T - BOUNCE) / RUN;
    if (r < 1) {
        const e = ease(r);
        const x = land.x + (side.x - land.x) * e;
        const z = land.z + (side.z - land.z) * e;
        return pose(x, z, ground(x, z), Math.atan2(side.x - land.x, side.z - land.z), "walk", {speed: Math.hypot(side.x - land.x, side.z - land.z) / RUN, meal: "resting"});
    }
    return pose(side.x, side.z, ground(side.x, side.z), sc.footYaw + Math.PI, "scan", {meal: "resting"});
}

type Live<E> = {act: HatchAct; script: DropScript | null; motherId: string | null; failed: boolean; over: boolean; acting: Set<E>};

export class LiveDuckDrops<E> {
    private drops: Live<E>[] = [];

    constructor(private readonly host: DuckDropHost<E>) {}

    /** New hatchings from the record: only those of a species that drops from a tree hole are kept. */
    add(acts: HatchAct[], epoch: number): void {
        const known = new Set(this.drops.map((d) => d.act.key));
        for (const act of acts) {
            if (!Number.isFinite(act.t0) || known.has(act.key) || !act.young.length || epoch - act.t0 > DROP_LIVE_SECONDS) continue;
            this.drops.push({act, script: null, motherId: null, failed: false, over: false, acting: new Set()});
            known.add(act.key);
        }
        this.drops.sort((x, y) => x.act.t0 - y.act.t0);
    }

    clear(): void {
        for (const d of this.drops) this.release(d);
        this.drops = [];
    }

    get size(): number {
        return this.drops.length;
    }

    pins(): string[] {
        const out: string[] = [];
        for (const d of this.drops) if (d.acting.size && d.motherId) out.push(d.motherId, ...d.act.young);
        return out;
    }

    /** The young jumping now (in the air), for the live log: one episode per young. */
    jumping(epoch: number): Array<{id: string; episode: string}> {
        const out: Array<{id: string; episode: string}> = [];
        for (const d of this.drops) {
            if (!d.script || d.over || d.failed) continue;
            const s = epoch - d.act.t0;
            d.act.young.forEach((id, k) => {
                if (k < d.script!.leave.length && s >= d.script!.leave[k] && s < d.script!.leave[k] + d.script!.fall[k] + BOUNCE) out.push({id, episode: `${d.act.key}:${k}`});
            });
        }
        return out;
    }

    private release(d: Live<E>): void {
        d.acting.forEach((e) => this.host.setAct(e, null));
        d.acting.clear();
    }

    private mother(act: HatchAct): {id: string; entry: E} | null {
        const h = this.host;
        const found = act.parents.map((id) => ({id, entry: h.find(id)})).filter((p): p is {id: string; entry: E} => p.entry !== null && h.drops(p.entry));
        return found.find((p) => h.male(p.entry) === false) ?? found.find((p) => h.male(p.entry) !== true) ?? found[0] ?? null;
    }

    step(epoch: number): void {
        const h = this.host;
        for (const d of this.drops) {
            if (d.over || d.failed) continue;
            const s = epoch - d.act.t0;
            if (s < 0) continue;
            if (!d.script) {
                const mother = this.mother(d.act);
                const place = mother ? h.scheduleAt(mother.entry, d.act.t0) : null;
                const hole = place ? h.hollow(place.x, place.z) : null;
                if (!mother || !place || !hole) {
                    d.failed = true;
                    continue;
                }
                d.motherId = mother.id;
                d.script = dropScript({...place, length: h.length(mother.entry)}, hole, d.act.young.length, d.act.key, h.ground);
            }
            const sc = d.script;
            const mother = d.motherId ? h.find(d.motherId) : null;
            if (!mother) {
                this.release(d);
                d.over = true;
                continue;
            }
            const acting = new Set<E>();
            const set = (entry: E, act: ActPose | null) => {
                if (!act || h.busy(entry)) return;
                h.setAct(entry, act);
                acting.add(entry);
            };
            const back = (entry: E, from: Point, pace: number): ActPose | null => {
                const now = h.scheduleAt(entry, epoch);
                if (!now) return null;
                const dist = Math.hypot(now.x - from.x, now.z - from.z);
                const seconds = clamp(dist / Math.max(pace, 0.3), PART_MIN, PART_MAX);
                const k = (s - sc.gatheredEnd) / seconds;
                if (k >= 1) return null;
                const e = ease(k);
                const x = from.x + (now.x - from.x) * e;
                const z = from.z + (now.z - from.z) * e;
                return pose(x, z, h.ground(x, z), dist > 0.05 ? Math.atan2(now.x - from.x, now.z - from.z) : now.yaw, "walk", {speed: dist / seconds});
            };
            if (s < sc.gatheredEnd) {
                set(mother, dropMotherPose(sc, s, h.ground));
                d.act.young.forEach((id, k) => {
                    const e = h.find(id);
                    if (e) set(e, dropYoungPose(sc, k, s, h.ground));
                });
            } else {
                let any = false;
                const bm = back(mother, sc.foot, h.walk(mother));
                set(mother, bm);
                any ||= Boolean(bm);
                d.act.young.forEach((id, k) => {
                    const e = h.find(id);
                    if (!e || k >= sc.side.length) return;
                    const by = back(e, sc.side[k], h.walk(e));
                    set(e, by);
                    any ||= Boolean(by);
                });
                if (!any) d.over = true;
            }
            d.acting.forEach((e) => {
                if (!acting.has(e)) h.setAct(e, null);
            });
            d.acting = acting;
        }
        this.drops = this.drops.filter((d) => !(d.over || d.failed) || d.acting.size > 0 || epoch - d.act.t0 < DROP_LIVE_SECONDS);
    }

    debug(): Array<{key: string; t0: number; mother: string | null; phase: string; young: number; end: number | null; hole: Hollow | null}> {
        return this.drops.map((d) => ({key: d.act.key, t0: d.act.t0, mother: d.motherId, phase: d.failed ? "skipped" : d.over ? "over" : d.script ? "acting" : "waiting", young: d.act.young.length, end: d.script ? Math.round(d.script.gatheredEnd) : null, hole: d.script?.hole ?? null}));
    }
}
