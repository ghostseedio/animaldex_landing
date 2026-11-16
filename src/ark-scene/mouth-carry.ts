/**
 * Young carried in the mouth (3.3 batch, lane C; owner 2026-11-16), for the species whose own stored text says so
 * (`young-life.json` `mouthCarry`, built by `scripts/ark-young-life.mts` from the species catalogue):
 *
 *   jaws    a crocodilian mother (American Alligator, Mugger Crocodile, Saltwater Crocodile). After a hatching of the
 *           record she walks to the nest (where the hatchlings are), lowers her head and takes them up, walks to the
 *           nearest water's edge with them at her jaw, and lets them go there; each then goes back to its day.
 *   brood   a mouthbrooding fish (the male Asian and Silver Arowana, the female Nile Tilapia). After a hatching of the
 *           record the fry are in the parent's mouth (not drawn), come out in a small cloud at its mouth, and are
 *           taken in again, by the shared clock; and dart back in at once while the parent is alarmed here (the
 *           reactive layer's alert: the viewer's own, visual only).
 *
 * The catalogue asks for a new clip for these; there is none, so this is the procedural version: places and poses
 * only. Real young only: the hatchlings of a `birth` event with `from_egg`, and their recorded parents. The scene
 * never decides a hatching. Like the live births (`live-births.ts`), the scene gives its entries through a host and
 * this layer only says, per frame, which act pose each takes: nothing here touches the renderer.
 */

import type {ActPose} from "@/ark-scene/acts";
import table from "@/ark-scene/young-life.json";
import {unit} from "@/lib/ark-clock";

export type MouthCarryKind = "jaws" | "brood";
export type MouthCarrySpec = {name: string; line: string; kind: MouthCarryKind; carrier: "female" | "male"; /** When the row's sentence is true of what is drawn: while she carries, while the fry are held or out, as they dart in at danger; null: never said. */ say: "carry" | "hold" | "danger" | null};

const SPECS = (table as unknown as {mouthCarry: Record<string, MouthCarrySpec>}).mouthCarry;

/** The species' mouth-carrying, or null (nearly every species). */
export function mouthCarryOf(slug: string | null | undefined): MouthCarrySpec | null {
    return (slug && SPECS[slug]) || null;
}

/** A hatching from the record: the hatchlings, their parents, and when (s, the shared clock). */
export type HatchAct = {key: string; parents: string[]; young: string[]; t0: number};

export type MouthCarryHost<E> = {
    find: (id: string) => E | null;
    slug: (entry: E) => string;
    /** Its schedule's place at a time (pure in the time); null off the schedule. */
    placeAt: (entry: E, epoch: number) => {x: number; y: number; z: number; yaw: number} | null;
    ground: (x: number, z: number) => number;
    /** The nearest water's edge within reach of a spot, or null. */
    waterNear: (x: number, z: number) => {x: number; z: number} | null;
    walk: (entry: E) => number;
    length: (entry: E) => number;
    height: (entry: E) => number;
    male: (entry: E) => boolean | null;
    /** Alarmed here and now (the viewer's reactive layer): a mouthbrooder's fry dart in. */
    alarmed: (entry: E) => boolean;
    setAct: (entry: E, pose: ActPose | null) => void;
    busy: (entry: E) => boolean;
};

/** How long after its time a hatching is still acted (s): the tick and the record's read come later. */
export const HATCH_LIVE_SECONDS = 20 * 60;
/** The hatchlings drawn at her jaw at most (the rest of the clutch ride out of sight). */
export const JAWS_SHOWN = 4;
/** The fry kept one by one in the herds' count (pins), and those placed at the mouth at most (a bigger brood's others keep their day). */
export const FRY_SHOWN = 8;
export const FRY_MOST = 24;
const WALK_MAX = 45;
const GATHER = 7;
const RELEASE = 7;
const PART_MIN = 4;
const PART_MAX = 20;
/** A mouthbrooder's fry: out for about this long, then in for about this long (s), and so on. */
const FRY_OUT = 22;
const FRY_IN = 12;

type Point = {x: number; z: number};
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};
const yawTo = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.z - from.z);

// MARK: A crocodilian's carry to the water

export type JawsScript = {
    from: Point;
    nest: Point;
    water: Point;
    /** Phase ends (s after the hatching): at the nest, the hatchlings taken up, at the water, let go. */
    atNest: number;
    taken: number;
    atWater: number;
    end: number;
    length: number;
    height: number;
    shown: number;
};

/** The carry's script, built once: from where her day has her to the nest, then to the water's edge. */
export function jawsScript(mother: Point & {length: number; height: number; pace: number}, nest: Point, water: Point, young: number): JawsScript {
    const pace = Math.max(mother.pace, 0.3);
    const L = Math.max(mother.length, 0.05);
    // (She stops with her snout over the nest: her middle half her length short of it.)
    const reach = Math.hypot(nest.x - mother.x, nest.z - mother.z);
    const atNest = clamp(Math.max(reach - L * 0.5, 0) / pace, 3, WALK_MAX);
    const taken = atNest + GATHER;
    const atWater = taken + clamp(Math.hypot(water.x - nest.x, water.z - nest.z) / pace, 4, WALK_MAX);
    return {from: {x: mother.x, z: mother.z}, nest, water, atNest, taken, atWater, end: atWater + RELEASE, length: L, height: mother.height, shown: clamp(young, 1, JAWS_SHOWN)};
}

type Ground = (x: number, z: number) => number;

/** Where her middle is, and her heading, s seconds after the hatching. */
function motherAt(sc: JawsScript, s: number): Point & {yaw: number; moving: boolean} {
    const toNest = yawTo(sc.from, sc.nest);
    const reach = Math.hypot(sc.nest.x - sc.from.x, sc.nest.z - sc.from.z);
    // Her stand at the nest: her snout over it.
    const short = Math.min(sc.length * 0.5, reach);
    const stand = {x: sc.nest.x - Math.sin(toNest) * short, z: sc.nest.z - Math.cos(toNest) * short};
    if (s < sc.atNest) {
        const k = ease(s / sc.atNest);
        return {x: sc.from.x + (stand.x - sc.from.x) * k, z: sc.from.z + (stand.z - sc.from.z) * k, yaw: toNest, moving: k > 0.02 && k < 0.98};
    }
    if (s < sc.taken) return {...stand, yaw: toNest, moving: false};
    const toWater = yawTo(stand, sc.water);
    if (s < sc.atWater) {
        const k = ease((s - sc.taken) / (sc.atWater - sc.taken));
        // (She turns to the water over the first of the walk.)
        let d = toWater - toNest;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return {x: stand.x + (sc.water.x - stand.x) * k, z: stand.z + (sc.water.z - stand.z) * k, yaw: toNest + d * ease((s - sc.taken) / 3), moving: k > 0.02 && k < 0.98};
    }
    return {x: sc.water.x, z: sc.water.z, yaw: toWater, moving: false};
}

/** The mother's pose s seconds after the hatching. */
export function jawsMotherPose(sc: JawsScript, s: number, ground: Ground, youngId?: string): ActPose {
    const at = motherAt(sc, s);
    const gathering = s >= sc.atNest && s < sc.taken;
    const releasing = s >= sc.atWater;
    // Head down to the nest as she takes them up, and to the water as she lets them go.
    const pitch = gathering || releasing ? 0.16 + 0.05 * Math.sin(s * 2.4) : 0;
    const pace = at.moving ? Math.hypot(sc.water.x - sc.nest.x, sc.water.z - sc.nest.z) / Math.max(sc.atWater - sc.taken, 1) : 0;
    return {x: at.x, z: at.z, base: ground(at.x, at.z), yaw: at.yaw, pitch, roll: 0, scale: 1, dim: 0, hidden: false, state: at.moving ? "walk" : gathering || releasing ? "eat" : "scan", speed: pace, meal: "resting", ...(youngId ? {with: youngId} : {})};
}

/** When the k-th hatchling is taken up (one after another over the gathering) and when it is let go at the water. */
function jawsTimes(sc: JawsScript, k: number): {taken: number; freed: number} {
    const slot = Math.min(k, sc.shown - 1);
    return {taken: sc.atNest + 1 + ((sc.taken - sc.atNest - 2) * slot) / Math.max(sc.shown - 1, 1), freed: sc.atWater + 1 + slot * 0.6};
}

/** The k-th hatchling's pose s seconds after the hatching: at the nest, at her jaw (the first few drawn), let go at the water. */
export function jawsYoungPose(sc: JawsScript, k: number, s: number, ground: Ground, motherId?: string): ActPose {
    const extra = {pitch: 0, roll: 0, scale: 1, dim: 0, state: "rest", speed: 0, meal: "resting" as const, ...(motherId ? {with: motherId} : {})};
    // Round the nest until she takes it up.
    const ring = (k % 6) * (Math.PI / 3) + 0.4;
    const r = sc.length * 0.12 * (1 + Math.floor(k / 6) * 0.5);
    const home = {x: sc.nest.x + Math.sin(ring) * r, z: sc.nest.z + Math.cos(ring) * r};
    const times = jawsTimes(sc, k);
    if (s < times.taken) return {...extra, x: home.x, z: home.z, base: ground(home.x, home.z), yaw: ring + Math.PI, hidden: false};
    if (s < times.freed) {
        // In her mouth: the first few show at the tip of her jaw, side by side and across it; the others ride out of sight.
        const at = motherAt(sc, s);
        const fx = Math.sin(at.yaw);
        const fz = Math.cos(at.yaw);
        const across = (Math.min(k, sc.shown - 1) - (sc.shown - 1) / 2) * sc.length * 0.035;
        const x = at.x + fx * sc.length * 0.45 + fz * across;
        const z = at.z + fz * sc.length * 0.45 - fx * across;
        // (Her head is down at the nest and at the water: the jaw's tip nearer the ground there.)
        const low = s < sc.taken || s >= sc.atWater ? 0.12 : 0.3;
        const jaw = ground(at.x, at.z) + sc.height * low;
        if (k >= sc.shown) return {...extra, x, z, base: jaw, yaw: at.yaw, hidden: true};
        const up = ease(s - times.taken);
        const from = ground(home.x, home.z);
        return {...extra, x: home.x + (x - home.x) * up, z: home.z + (z - home.z) * up, base: from + (jaw - from) * up, yaw: at.yaw + Math.PI / 2, hidden: false};
    }
    // Let go at the water: each swims a little way out ahead of her, fanned.
    const at = motherAt(sc, sc.atWater);
    const out = ease((s - times.freed) / 3);
    const fan = at.yaw + ((k % 7) - 3) * 0.3;
    const d = sc.length * (0.5 + (0.3 + 0.08 * Math.floor(k / 7)) * out);
    const x = at.x + Math.sin(fan) * d;
    const z = at.z + Math.cos(fan) * d;
    return {...extra, x, z, base: ground(x, z), yaw: fan, hidden: false, state: out < 1 ? "swim" : "rest", speed: out < 1 ? 0.2 : 0};
}

// MARK: A mouthbrooder's fry

/** Whether the fry are out of the mouth t seconds after the hatching, by the shared clock: 0 in … 1 out (eased at each end). */
export function fryOut(key: string, t: number): number {
    const period = FRY_OUT + FRY_IN;
    // The first while after the hatching they are held (the text: eggs and then young carried in the mouth).
    const u = t - FRY_IN - unit(key, "fry") * 6;
    if (u < 0) return 0;
    const s = u % period;
    return Math.min(ease(s / 1.2), ease((FRY_OUT - s) / 0.6));
}

/** The k-th fry's place: a small cloud just ahead of the parent's mouth while out, at its mouth (hidden) while in. */
export function fryPose(parent: {x: number; y: number; z: number; yaw: number; length: number}, k: number, t: number, key: string, out: number): {x: number; y: number; z: number; yaw: number; hidden: boolean} {
    const L = Math.max(parent.length, 0.02);
    const fx = Math.sin(parent.yaw);
    const fz = Math.cos(parent.yaw);
    const mouth = {x: parent.x + fx * L * 0.5, y: parent.y, z: parent.z + fz * L * 0.5};
    // Its own place in the cloud, drifting a little.
    const a = unit(key, "fry-a", k) * Math.PI * 2 + t * (0.5 + unit(key, "fry-w", k) * 0.6);
    const r = L * (0.1 + 0.16 * unit(key, "fry-r", k));
    const ahead = L * (0.16 + 0.2 * unit(key, "fry-f", k));
    const x = mouth.x + (fx * ahead + fz * Math.cos(a) * r) * out;
    const z = mouth.z + (fz * ahead - fx * Math.cos(a) * r) * out;
    const y = mouth.y + Math.sin(a) * r * 0.6 * out;
    // (Coming out it faces away from the mouth; going in, back to it.)
    return {x, y, z, yaw: parent.yaw + Math.sin(a * 0.7) * 0.5, hidden: out < 0.08};
}

// MARK: The layer

type Live<E> = {act: HatchAct; kind: MouthCarryKind | null; carrierId: string | null; script: JawsScript | null; failed: boolean; over: boolean; acting: Set<E>; said: "carry" | "hold" | "danger" | null; dartAt: number};

export class MouthCarry<E> {
    private acts: Live<E>[] = [];

    constructor(private readonly host: MouthCarryHost<E>) {}

    /** New hatchings from the record; those long over are forgotten. */
    add(acts: HatchAct[], epoch: number): void {
        const known = new Set(this.acts.map((b) => b.act.key));
        for (const act of acts) {
            if (!Number.isFinite(act.t0) || known.has(act.key) || !act.young.length || !act.parents.length) continue;
            if (epoch - act.t0 > HATCH_LIVE_SECONDS) continue;
            this.acts.push({act, kind: null, carrierId: null, script: null, failed: false, over: false, acting: new Set(), said: null, dartAt: -Infinity});
            known.add(act.key);
        }
        this.acts.sort((x, y) => x.act.t0 - y.act.t0);
    }

    clear(): void {
        for (const b of this.acts) this.release(b);
        this.acts = [];
    }

    get size(): number {
        return this.acts.length;
    }

    pins(): string[] {
        const out: string[] = [];
        for (const b of this.acts) if (b.acting.size && b.carrierId) out.push(b.carrierId, ...b.act.young.slice(0, FRY_SHOWN));
        return out;
    }

    /** What the carrier of an act is showing now, for the log: its species' own sentence when it is true of the frame. */
    showing(carrierId: string): {key: string; line: string} | null {
        for (const b of this.acts) {
            if (b.carrierId !== carrierId || !b.said) continue;
            const carrier = this.host.find(carrierId);
            const spec = carrier ? mouthCarryOf(this.host.slug(carrier)) : null;
            if (spec && spec.say === b.said) return {key: `${b.act.key}:${b.said}`, line: spec.line};
        }
        return null;
    }

    private release(b: Live<E>): void {
        b.acting.forEach((e) => this.host.setAct(e, null));
        b.acting.clear();
    }

    /** The parent that carries: the one drawn of the sex the species' text names, else one not drawn the other sex. */
    private carrier(act: HatchAct): {id: string; entry: E; spec: MouthCarrySpec} | null {
        const h = this.host;
        const found = act.parents.map((id) => ({id, entry: h.find(id)})).filter((p): p is {id: string; entry: E} => p.entry !== null);
        const spec = found.length ? mouthCarryOf(h.slug(found[0].entry)) : null;
        if (!spec) return null;
        const wantMale = spec.carrier === "male";
        const pick = found.find((p) => h.male(p.entry) === wantMale) ?? found.find((p) => h.male(p.entry) !== !wantMale) ?? found[0];
        return {...pick, spec};
    }

    step(epoch: number): void {
        const h = this.host;
        for (const b of this.acts) {
            if (b.over || b.failed) continue;
            const s = epoch - b.act.t0;
            if (s < 0) continue;
            if (!b.kind) {
                const carrier = this.carrier(b.act);
                if (!carrier) {
                    // (Not a mouth-carrying species, or its parents are not drawn: nothing to act.)
                    b.failed = true;
                    continue;
                }
                b.kind = carrier.spec.kind;
                b.carrierId = carrier.id;
            }
            const carrier = b.carrierId ? h.find(b.carrierId) : null;
            if (!carrier) {
                this.release(b);
                b.over = true;
                continue;
            }
            const acting = new Set<E>();
            const pose = (entry: E, act: ActPose | null) => {
                if (!act || h.busy(entry)) return;
                h.setAct(entry, act);
                acting.add(entry);
            };
            b.said = null;
            if (b.kind === "brood") {
                // The parent keeps its day; only the fry are placed, at its mouth.
                const at = h.placeAt(carrier, epoch);
                if (!at || s > HATCH_LIVE_SECONDS) {
                    this.release(b);
                    b.over = true;
                    continue;
                }
                const alarmed = h.alarmed(carrier);
                if (alarmed) b.dartAt = epoch;
                // (Darting in is quick; they stay in a little after the alarm is over.)
                const safe = clamp((epoch - b.dartAt - 4) / 1.5, 0, 1);
                const out = fryOut(b.act.key, s) * safe;
                b.said = alarmed && fryOut(b.act.key, s) > 0.2 ? "danger" : "hold";
                b.act.young.forEach((id, k) => {
                    const e = k < FRY_MOST ? h.find(id) : null;
                    if (!e) return;
                    const p = fryPose({...at, length: h.length(carrier)}, k, s, b.act.key, out);
                    pose(e, {x: p.x, z: p.z, base: p.y, yaw: p.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: p.hidden, state: "swim", speed: 0.1, meal: "resting", with: b.carrierId ?? undefined});
                });
            } else {
                if (!b.script) {
                    const from = h.placeAt(carrier, b.act.t0);
                    const first = b.act.young.map((id) => h.find(id)).find((e): e is E => e !== null) ?? null;
                    const nest = first ? h.placeAt(first, b.act.t0) : null;
                    const water = nest ? h.waterNear(nest.x, nest.z) : null;
                    if (!from || !nest || !water) {
                        // (No water within reach of the nest, or the hatchlings are not in the scene yet and the act's time has gone.)
                        if (s > 30 || (from && nest)) b.failed = true;
                        continue;
                    }
                    b.script = jawsScript({x: from.x, z: from.z, length: h.length(carrier), height: h.height(carrier), pace: h.walk(carrier)}, {x: nest.x, z: nest.z}, water, b.act.young.length);
                }
                const sc = b.script;
                const back = (entry: E, fromP: Point, pace: number, startAt: number): ActPose | null => {
                    const now = h.placeAt(entry, epoch);
                    if (!now) return null;
                    const d = Math.hypot(now.x - fromP.x, now.z - fromP.z);
                    const seconds = clamp(d / Math.max(pace, 0.3), PART_MIN, PART_MAX);
                    const k = (s - startAt) / seconds;
                    if (k >= 1) return null;
                    const e = ease(k);
                    const x = fromP.x + (now.x - fromP.x) * e;
                    const z = fromP.z + (now.z - fromP.z) * e;
                    return {x, z, base: h.ground(x, z), yaw: d > 0.05 ? Math.atan2(now.x - fromP.x, now.z - fromP.z) : now.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: k < 0.15 ? "rest" : "walk", speed: k < 0.15 ? 0 : d / seconds};
                };
                if (s < sc.end) {
                    pose(carrier, jawsMotherPose(sc, s, h.ground, b.act.young[0]));
                    b.act.young.forEach((id, k) => {
                        const e = h.find(id);
                        if (e) pose(e, jawsYoungPose(sc, k, s, h.ground, b.carrierId ?? undefined));
                    });
                    if (s >= sc.atNest && s < sc.atWater + 2) b.said = "carry";
                } else {
                    const bm = back(carrier, sc.water, h.walk(carrier), sc.end);
                    pose(carrier, bm);
                    let any = Boolean(bm);
                    b.act.young.forEach((id, k) => {
                        const e = h.find(id);
                        if (!e) return;
                        const last = jawsYoungPose(sc, k, sc.end, h.ground);
                        const by = back(e, {x: last.x, z: last.z}, h.walk(e), sc.end);
                        pose(e, by);
                        any ||= Boolean(by);
                    });
                    if (!any) b.over = true;
                }
            }
            b.acting.forEach((e) => {
                if (!acting.has(e)) h.setAct(e, null);
            });
            b.acting = acting;
        }
        this.acts = this.acts.filter((b) => !(b.over || b.failed) || b.acting.size > 0 || epoch - b.act.t0 < HATCH_LIVE_SECONDS);
    }

    debug(): Array<{key: string; t0: number; carrier: string | null; kind: MouthCarryKind | null; phase: string; said: string | null; script: JawsScript | null}> {
        return this.acts.map((b) => ({key: b.act.key, t0: b.act.t0, carrier: b.carrierId, kind: b.kind, phase: b.failed ? "skipped" : b.over ? "over" : b.kind ? "acting" : "waiting", said: b.said, script: b.script}));
    }
}
