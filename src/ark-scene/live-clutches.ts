/**
 * ARK-MATING-SHOWN (AnimalDex docs/ark/DECISIONS.md 416, owner 2026-11-20): laying and hatching you can see.
 *
 *   LAYING (every egg-layer: birds, reptiles, amphibians, fish, insects; a `laid` row of the record): once the pair's
 *   mating is over (`matingEnd`: never before the mount is seen), the mother walks from where her day has her to her
 *   spot (where she stood for the mount, `clutchSpot`; else a body length beside her; for an animal that spawns, in the
 *   water where she is), settles over it, the clutch appears under her egg by egg (`ArkNests`), she stays by it a
 *   while, then goes back to her day. The CLUTCH STAYS at that spot until it hatches (the row's `hatch_ark_day` on the
 *   Ark clock), drawn larger than true for a small animal (`clutchSize` has a floor), at most `CLUTCHES_KEPT` at once.
 *   HATCHING (a `birth` row `from_egg`): held as a live birth is (`ark-act-hold.ts`, the young out of sight until it
 *   begins), the eggs of her clutch rock and split, and the young come out at the clutch and stay round it a while,
 *   then go to their day. A clutch laid before this page read its log is put where the young are, a moment before.
 *
 * Nothing here decides anything: the clutch, its parents, its size and both times are the record's. The mother is the
 * parent the scene draws as female, else the record's first (the engine has no sexes). Pure in the shared clock; the
 * scene gives it entries through a host and draws the nests itself.
 */

import type {ActPose} from "@/ark-scene/acts";

export type LaidAct = {key: string; parents: string[]; eggs: number | null; /** The row's time (s, shared clock). */ t0: number; /** When it hatches (s), or NaN: unknown. */ hatchAt: number};
export type HatchedAct = {key: string; parents: string[]; young: string[]; /** The act's start (s): the record's time, held as a birth's. */ t0: number};

type Point = {x: number; z: number};

export type LiveClutchesHost<E> = {
    find: (id: string) => E | null;
    female: (entry: E) => boolean | null;
    /** Its day's place at a time (pure); null off its day or in the air. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; yaw: number} | null;
    /** A housed one's place (a tank's, a cage's), or null. */
    placeOf?: (entry: E) => {x: number; z: number; yaw: number; base: number} | null;
    ground: (x: number, z: number) => number;
    length: (entry: E) => number;
    walk: (entry: E) => number;
    /** Whether it lays in the water (fish, frogs, toads: a spawn), at this spot. */
    spawns: (entry: E, p: Point) => boolean;
    setAct: (entry: E, pose: ActPose | null) => void;
    busy: (entry: E) => boolean;
    /** When the mating of a pair naming `id` is over (s), or null: none acted. */
    matingEnd: (id: string) => number | null;
    /** Where she stood for the mount that took (`live-matings.ts` clutchSpot), or null. */
    clutchSpot: (id: string) => Point | null;
    /** The scene's nests: lay a clutch under her, hatch it, where it is, take it away. */
    /** (`ago`: how many seconds ago it was laid or began to hatch: the nests run on the frame clock, not the Ark's.) */
    lay: (key: string, at: Point & {base: number}, mother: E, eggs: number | null, ago: number) => void;
    hatch: (key: string, ago: number) => void;
    where: (key: string) => (Point & {y: number; size: number}) | null;
    remove: (key: string) => void;
};

export const LAY_WALK = 5;
export const LAY_SETTLE = 7;
/** The eggs appear this far into her settling (s). */
export const LAY_AT = LAY_WALK + 2;
export const LAY_GUARD = 16;
const LAY_RETURN = 6;
/** A laying not begun this long after its row (s) is not acted (the clutch is simply laid where she is). */
const LAY_LATE = 20 * 60;
/** Clutches drawn at once (the oldest goes first); the low tier keeps fewer. */
export const CLUTCHES_KEPT = 24;
/** A clutch whose hatching never came is taken away this long after it was due (s). */
const OVERDUE = 10 * 60;
/** The eggs rock this long before the young come out (`ArkNests` HATCH_ROCK), and the young stay at the clutch this long. */
export const HATCH_ROCK = 0.9;
export const HATCH_STAY = 14;
const HATCH_PART = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};
const lerpP = (p: Point, q: Point, k: number): Point => ({x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k});
const yawTo = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.z - from.z);
function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

/** Where a mother lays, from where she is: where she stood for the mount, else a body length to one side. Pure. */
export function laySpot(at: {x: number; z: number; yaw: number}, length: number, key: string, mounted: Point | null): Point {
    if (mounted) return mounted;
    const side = unit(`${key}:side`) < 0.5 ? -1 : 1;
    return {x: at.x + Math.cos(at.yaw) * side * length * 0.9, z: at.z - Math.sin(at.yaw) * side * length * 0.9};
}

/** The mother's pose `s` seconds into her laying (from `from` to the clutch at `spot`), or null once she is back. Pure. */
export function layPose(s: number, from: Point & {yaw: number}, spot: Point, back: Point | null, length: number, pace: number, ground: (x: number, z: number) => number): ActPose | null {
    const mk = (p: Point, yaw: number, state: string, speed = 0, pitch = 0): ActPose => ({x: p.x, z: p.z, base: ground(p.x, p.z), yaw, pitch, roll: 0, scale: 1, dim: 0, hidden: false, state, speed, meal: "resting"});
    const d = Math.hypot(spot.x - from.x, spot.z - from.z);
    if (s < LAY_WALK) {
        const moving = d > 0.03;
        return mk(lerpP(from, spot, ease(s / LAY_WALK)), moving ? yawTo(from, spot) : from.yaw, moving ? "walk" : "scan", moving ? d / LAY_WALK : 0);
    }
    const yaw = d > 0.03 ? yawTo(from, spot) : from.yaw;
    // Settled over the spot, low (a slight bob as each egg comes).
    if (s < LAY_WALK + LAY_SETTLE) return mk(spot, yaw, "rest", 0, 0.08 * Math.sin((s - LAY_WALK) * 2.4));
    // Then beside it, facing it: a step back off it.
    const off = {x: spot.x - Math.sin(yaw) * length * 0.75, z: spot.z - Math.cos(yaw) * length * 0.75};
    const g = s - LAY_WALK - LAY_SETTLE;
    if (g < 1.2) return mk(lerpP(spot, off, ease(g / 1.2)), yaw, "walk", (length * 0.75) / 1.2);
    if (g < LAY_GUARD) return mk(off, yaw, "scan");
    if (!back) return null;
    const r = (g - LAY_GUARD) / LAY_RETURN;
    if (r >= 1) return null;
    const dd = Math.hypot(back.x - off.x, back.z - off.z);
    return mk(lerpP(off, back, ease(r)), dd > 0.03 ? yawTo(off, back) : yaw, "walk", Math.max(dd / LAY_RETURN, 0.1 * pace));
}

/** The k-th hatchling's pose `s` seconds into its hatching at the clutch `nest` (hidden until it is out). Pure. */
export function hatchlingPose(s: number, k: number, n: number, nest: Point & {size: number}, back: Point | null, ground: (x: number, z: number) => number): ActPose | null {
    const angle = (k / Math.max(n, 1)) * Math.PI * 2 + 0.6;
    const r = nest.size * (0.35 + 0.25 * (k % 2));
    const at = {x: nest.x + Math.sin(angle) * r, z: nest.z + Math.cos(angle) * r};
    const mk = (p: Point, yaw: number, state: string, extra: Partial<ActPose> = {}): ActPose => ({x: p.x, z: p.z, base: ground(p.x, p.z), yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0, ...extra});
    if (s < HATCH_ROCK + k * 0.4) return mk(nest, angle, "rest", {hidden: true});
    const out = s - HATCH_ROCK - k * 0.4;
    // Out of the egg at the clutch's middle, then a few steps clear of it, then about it.
    if (out < 1.4) return mk(lerpP(nest, at, ease(out / 1.4)), angle, "walk", {scale: 0.5 + 0.5 * ease(out / 0.8), speed: r / 1.4});
    if (s < HATCH_STAY) return mk(at, angle + Math.sin(out * 1.7 + k) * 0.5, "scan");
    if (!back) return null;
    const p = (s - HATCH_STAY) / HATCH_PART;
    if (p >= 1) return null;
    const d = Math.hypot(back.x - at.x, back.z - at.z);
    return mk(lerpP(at, back, ease(p)), d > 0.03 ? yawTo(at, back) : angle, "walk", {speed: d / HATCH_PART});
}

type Laying = {act: LaidAct; mother: string | null; start: number | null; from: (Point & {yaw: number}) | null; spot: Point | null; laid: boolean; done: boolean; acting: boolean; /** One off any day (housed, or a small animal on its wall): her own floor, not the ground. */ floor: number | null};
type Hatching = {act: HatchedAct; nest: string | null; acting: Set<string>; done: boolean; hatched: boolean};

export class LiveClutches<E> {
    private layings: Laying[] = [];
    private hatchings: Hatching[] = [];
    /** The clutches drawn now, in the order they were laid: key, parents (sorted), when they are due. */
    private kept: Array<{key: string; pair: string; hatchAt: number}> = [];
    most = CLUTCHES_KEPT;

    constructor(private readonly host: LiveClutchesHost<E>) {}

    get size(): number {
        return this.layings.length + this.hatchings.length + this.kept.length;
    }

    addLaid(acts: LaidAct[]): void {
        const known = new Set(this.layings.map((l) => l.act.key));
        for (const act of acts) {
            if (known.has(act.key) || !act.parents.length || !Number.isFinite(act.t0) || this.kept.some((c) => c.key === act.key)) continue;
            this.layings.push({act, mother: null, start: null, from: null, spot: null, laid: false, done: false, acting: false, floor: null});
            known.add(act.key);
        }
    }

    addHatched(acts: HatchedAct[]): void {
        const known = new Set(this.hatchings.map((h) => h.act.key));
        for (const act of acts) {
            if (known.has(act.key) || !act.young.length || !Number.isFinite(act.t0)) continue;
            this.hatchings.push({act, nest: null, acting: new Set(), done: false, hatched: false});
            known.add(act.key);
        }
    }

    /** Every id an act names now (drawn one by one). */
    pins(): string[] {
        const out: string[] = [];
        for (const l of this.layings) if (l.acting && l.mother) out.push(l.mother);
        for (const h of this.hatchings) out.push(...Array.from(h.acting));
        return out;
    }

    /** Whether this layer keeps the clutch `key` (a tap's own clutch then neither moves nor takes it away). */
    keeps(key: string): boolean {
        return this.kept.some((c) => c.key === key) || this.layings.some((l) => l.act.key === key && !l.done);
    }

    /** Whether a clutch of this pair is drawn now (its key), for the hatching. */
    clutchOf(parents: string[]): string | null {
        const pair = [...parents].sort().join("|");
        for (let i = this.kept.length - 1; i >= 0; i--) if (this.kept[i].pair === pair) return this.kept[i].key;
        return null;
    }

    clear(): void {
        for (const l of this.layings) if (l.acting && l.mother) this.release(l.mother);
        for (const h of this.hatchings) h.acting.forEach((id) => this.release(id));
        for (const c of this.kept) this.host.remove(c.key);
        this.layings = [];
        this.hatchings = [];
        this.kept = [];
    }

    private release(id: string): void {
        const e = this.host.find(id);
        if (e) this.host.setAct(e, null);
    }

    private motherOf(parents: string[]): {id: string; entry: E} | null {
        const drawn = parents.map((id) => ({id, entry: this.host.find(id)})).filter((p): p is {id: string; entry: E} => Boolean(p.entry));
        return drawn.find((p) => this.host.female(p.entry) === true) ?? drawn[0] ?? null;
    }

    private keep(key: string, parents: string[], hatchAt: number): void {
        this.kept.push({key, pair: [...parents].sort().join("|"), hatchAt});
        while (this.kept.length > this.most) this.host.remove(this.kept.shift()!.key);
    }

    step(epoch: number): void {
        const h = this.host;
        for (const l of this.layings) {
            if (l.done) continue;
            if (epoch < l.act.t0) continue;
            const mother = l.mother ? {id: l.mother, entry: h.find(l.mother)} : this.motherOf(l.act.parents);
            if (!mother?.entry) {
                if (epoch - l.act.t0 > LAY_LATE) l.done = true;
                continue;
            }
            l.mother = mother.id;
            const entry = mother.entry;
            if (l.start === null) {
                // (After the pair's mating is over: the mount is seen first.)
                const end = h.matingEnd(mother.id);
                l.start = Math.max(l.act.t0, end ?? l.act.t0);
            }
            if (epoch < l.start) continue;
            const s = epoch - l.start;
            if (!l.from) {
                const day = h.scheduleAt(entry, l.start);
                const housed = day ? null : h.placeOf?.(entry) ?? null;
                const at = day ?? housed;
                if (!at) {
                    if (epoch - l.act.t0 > LAY_LATE) l.done = true;
                    continue;
                }
                l.from = {x: at.x, z: at.z, yaw: at.yaw};
                l.floor = housed ? housed.base : null;
                l.spot = housed ? {x: at.x, z: at.z} : laySpot(at, h.length(entry), l.act.key, h.clutchSpot(mother.id));
            }
            const spot = l.spot!;
            if (!l.laid && s >= LAY_AT) {
                l.laid = true;
                h.lay(l.act.key, {...spot, base: l.floor ?? h.ground(spot.x, spot.z)}, entry, l.act.eggs, s - LAY_AT);
                this.keep(l.act.key, l.act.parents, l.act.hatchAt);
            }
            const back = h.scheduleAt(entry, epoch);
            if (h.busy(entry)) {
                // (Something else has her now: left alone, and the clutch is laid all the same.)
                l.acting = false;
                if (s > LAY_AT) l.done = true;
                continue;
            }
            const floor = l.floor;
            const pose = layPose(s, l.from, spot, back ?? (floor !== null ? l.from : null), h.length(entry), h.walk(entry), floor !== null ? () => floor : h.ground);
            if (pose) {
                h.setAct(entry, pose);
                l.acting = true;
            } else if (l.acting) {
                h.setAct(entry, null);
                l.acting = false;
            }
            if (!pose && s > LAY_WALK + LAY_SETTLE + LAY_GUARD) {
                l.done = true;
                if (!l.laid) {
                    l.laid = true;
                    h.lay(l.act.key, {...spot, base: l.floor ?? h.ground(spot.x, spot.z)}, entry, l.act.eggs, 0);
                    this.keep(l.act.key, l.act.parents, l.act.hatchAt);
                }
            }
        }
        this.layings = this.layings.filter((l) => !l.done || l.acting);
        for (const x of this.hatchings) {
            if (x.done) continue;
            const s = epoch - x.act.t0;
            const young = x.act.young.map((id) => ({id, entry: h.find(id)})).filter((y): y is {id: string; entry: E} => Boolean(y.entry));
            if (!young.length) continue;
            if (x.nest === null) {
                x.nest = this.clutchOf(x.act.parents);
                if (!x.nest) {
                    // (Laid before this page read its log: the clutch is put where the young are, a moment before.)
                    const first = h.scheduleAt(young[0].entry, x.act.t0) ?? h.placeOf?.(young[0].entry) ?? null;
                    const mother = this.motherOf(x.act.parents);
                    if (!first || !mother) {
                        x.done = true;
                        continue;
                    }
                    x.nest = `hatch:${x.act.key}`;
                    h.lay(x.nest, {x: first.x, z: first.z, base: h.ground(first.x, first.z)}, mother.entry, x.act.young.length, 4 + Math.max(s, 0));
                    this.keep(x.nest, x.act.parents, x.act.t0);
                }
            }
            const nest = h.where(x.nest);
            if (!nest) {
                x.done = true;
                continue;
            }
            if (s >= 0 && !x.hatched) {
                h.hatch(x.nest, s);
                x.hatched = true;
                this.kept = this.kept.filter((c) => c.key !== x.nest);
            }
            let any = false;
            young.forEach(({id, entry}, k) => {
                if (h.busy(entry)) return;
                const day = h.scheduleAt(entry, epoch);
                const own = day ? null : h.placeOf?.(entry) ?? null;
                const back = day ?? own;
                // (On the clutch's own surface, a wall's or a leaf's too, until it walks off to its day's ground.)
                const surface = (x: number, z: number) => (day && Math.hypot(x - nest.x, z - nest.z) > nest.size * 1.5 ? h.ground(x, z) : nest.y);
                // (Before it begins: out of sight in the egg.)
                const pose = s < 0 ? {...hatchlingPose(0, k, young.length, nest, back, surface)!, hidden: true} : hatchlingPose(s, k, young.length, nest, back, surface);
                if (pose) {
                    h.setAct(entry, pose);
                    x.acting.add(id);
                    any = true;
                } else if (x.acting.has(id)) {
                    h.setAct(entry, null);
                    x.acting.delete(id);
                }
            });
            if (!any && s > HATCH_STAY) x.done = true;
        }
        this.hatchings = this.hatchings.filter((x) => !x.done || x.acting.size > 0);
        // A clutch long overdue (its hatching row never came: eaten, or this page missed it) is taken away.
        this.kept = this.kept.filter((c) => {
            if (Number.isFinite(c.hatchAt) && epoch > c.hatchAt + OVERDUE) {
                h.remove(c.key);
                return false;
            }
            return true;
        });
    }

    debug(): {layings: Array<{key: string; start: number | null; laid: boolean; mother: string | null}>; hatchings: Array<{key: string; t0: number; nest: string | null}>; kept: string[]} {
        return {layings: this.layings.map((l) => ({key: l.act.key, start: l.start, laid: l.laid, mother: l.mother})), hatchings: this.hatchings.map((x) => ({key: x.act.key, t0: x.act.t0, nest: x.nest})), kept: this.kept.map((c) => c.key)};
    }
}
