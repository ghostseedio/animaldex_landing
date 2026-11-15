/**
 * The server's matings in the live world (owner 2026-11-15: "we need the animals mating in 3d, they need to physically
 * go to each other and mate"). Each `mated` event of the record is acted out on the shared clock from the event's time,
 * the same for every viewer:
 *
 *   walk     both walk to each other (to a meeting point between them) until they touch;
 *   court    the first parent displays (posture, wings, crest), the other watches;
 *   nuzzle   heads together, grooming each other;
 *   pair     the first steps alongside and the two lie together, side by side;
 *   part     each walks back to where its day has it now.
 *
 * The rigs have no mating clip, so the pairing is shown through closeness (touching, grooming, lying together), never
 * a mount. The scene never decides a mating: a pair comes only from the record (`voyage_events` kind `mated`, its two
 * animals). Two animals in different worlds (the town and the wild) or very far apart are not walked across the Ark.
 *
 * Like the live meals (`live-meals.ts`), the scene gives it its entries through a host and this layer only says, per
 * frame, which act pose each of them takes (`entry.act`), so nothing here touches the renderer.
 */

import type {ActPose} from "@/ark-scene/acts";

/** A mating from the record: its two animals (the first displays) and when it happened (s, the shared clock). */
export type MatingAct = {key: string; a: string; b: string; t0: number};

export type LiveMatingsHost<E> = {
    /** A living animal's entry. */
    find: (id: string) => E | null;
    /** Its schedule's place at a time (pure in the time); null off the schedule. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; y: number; yaw: number; doing: string; aloft: boolean} | null;
    ground: (x: number, z: number) => number;
    /** Its walking pace (m/s). */
    walk: (entry: E) => number;
    /** Its body length (m). */
    length: (entry: E) => number;
    /** Whether the two live in the same world (both in the town, or both in the wild). */
    together: (a: E, b: E) => boolean;
    setAct: (entry: E, pose: ActPose | null) => void;
    /** Held by something else now (a replay's act, a meal, a moment): left alone. */
    busy: (entry: E) => boolean;
};

/** Farther apart than this (m) at the start: not walked across the Ark. */
export const MATING_MAX_APART = 160;
/** The longest walk to each other (s): farther pairs hurry. */
const WALK_MAX = 75;
const FACE = 1.5;
const COURT = 7;
const NUZZLE = 6;
const PAIR = 10;
const RETURN_MIN = 4;
const RETURN_MAX = 30;
/** How long after its time a mating is still acted (s): the server's tick and the record's read come later. */
export const MATING_LIVE_SECONDS = 20 * 60;

type Point = {x: number; z: number};

type Script = {
    from: {a: Point; b: Point};
    to: {a: Point; b: Point};
    /** The first's place lying alongside the other. */
    side: Point;
    walk: number;
    /** Phase ends (s after t0). */
    faced: number;
    courted: number;
    nuzzled: number;
    paired: number;
    /** Facing each other at the meeting (yaw of a toward b; b's is the opposite). */
    facing: number;
    /** The way both lie (b's yaw at the meeting). */
    lie: number;
    paceA: number;
    paceB: number;
    lengthA: number;
    lengthB: number;
};

type Live<E> = {act: MatingAct; script: Script | null; failed: boolean; over: boolean; acting: Set<E>};

const ease = (u: number) => {
    const c = Math.min(Math.max(u, 0), 1);
    return c * c * (3 - 2 * c);
};
const yawTo = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.z - from.z);

/** The act pose of one of the two at `s` seconds into the mating (`first`: the one that displays). Pure. */
export function matingPose(script: Script, first: boolean, s: number, ground: (x: number, z: number) => number, otherId: string): ActPose | null {
    const pose = (x: number, z: number, yaw: number, state: string, speed = 0, close = false): ActPose => ({
        x,
        z,
        base: ground(x, z),
        yaw,
        pitch: 0,
        roll: 0,
        scale: 1,
        dim: 0,
        hidden: false,
        state,
        speed,
        ...(close ? {with: otherId} : {})
    });
    const from = first ? script.from.a : script.from.b;
    const to = first ? script.to.a : script.to.b;
    if (s < 0 || s >= script.paired) return null;
    if (s < script.walk) {
        const k = ease(s / script.walk);
        const d = Math.hypot(to.x - from.x, to.z - from.z);
        const moving = d > 0.05;
        return pose(from.x + (to.x - from.x) * k, from.z + (to.z - from.z) * k, moving ? yawTo(from, to) : first ? script.facing : script.facing + Math.PI, moving ? "walk" : "scan", moving ? d / script.walk : 0, s > script.walk * 0.7);
    }
    const facing = first ? script.facing : script.facing + Math.PI;
    if (s < script.faced) return pose(to.x, to.z, facing, "scan", 0, true);
    if (s < script.courted) return pose(to.x, to.z, facing, first ? "display" : "scan", 0, true);
    if (s < script.nuzzled) return pose(to.x, to.z, facing, "groom_other", 0, true);
    // Pair: the first steps round alongside the other (a couple of seconds), then both lie, the same way, touching.
    const step = 2;
    if (first) {
        const k = ease((s - script.nuzzled) / step);
        const x = to.x + (script.side.x - to.x) * k;
        const z = to.z + (script.side.z - to.z) * k;
        if (k < 1) return pose(x, z, yawTo(to, script.side), "walk", Math.hypot(script.side.x - to.x, script.side.z - to.z) / step, true);
        return pose(script.side.x, script.side.z, script.lie, "rest", 0, true);
    }
    return pose(to.x, to.z, script.lie, s - script.nuzzled < step ? "scan" : "rest", 0, true);
}

/** The script of a mating from the two's places at its start, or null (too far apart). Pure. */
export function matingScript(a: Point & {pace: number; length: number}, b: Point & {pace: number; length: number}): Script | null {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (!(d <= MATING_MAX_APART)) return null;
    const ux = d > 1e-6 ? (b.x - a.x) / d : 1;
    const uz = d > 1e-6 ? (b.z - a.z) / d : 0;
    const mid = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
    // Touching: the two bodies' half lengths, a little less (the collision lane closes them to contact).
    const contact = Math.min(((a.length + b.length) / 2) * 0.45, d / 2);
    const toA = {x: mid.x - ux * contact, z: mid.z - uz * contact};
    const toB = {x: mid.x + ux * contact, z: mid.z + uz * contact};
    const dA = Math.hypot(toA.x - a.x, toA.z - a.z);
    const dB = Math.hypot(toB.x - b.x, toB.z - b.z);
    const pace = Math.max(Math.min(a.pace, b.pace), 0.3);
    const walk = Math.min(Math.max(Math.max(dA, dB) / pace, 2), WALK_MAX);
    const facing = Math.atan2(ux, uz);
    // Alongside: beside the other, on its right, both facing across the meeting line.
    const lie = facing + Math.PI / 2;
    const gap = ((a.length + b.length) / 2) * 0.3;
    const side = {x: toB.x + Math.cos(lie) * gap, z: toB.z - Math.sin(lie) * gap};
    const faced = walk + FACE;
    const courted = faced + COURT;
    const nuzzled = courted + NUZZLE;
    return {from: {a, b}, to: {a: toA, b: toB}, side, walk, faced, courted, nuzzled, paired: nuzzled + PAIR, facing, lie, paceA: a.pace, paceB: b.pace, lengthA: a.length, lengthB: b.length};
}

export class LiveMatings<E> {
    private matings: Live<E>[] = [];

    constructor(private readonly host: LiveMatingsHost<E>) {}

    /** New matings from the record (one already known is kept as it is); those long over are forgotten. */
    add(acts: MatingAct[], epoch: number): void {
        const known = new Set(this.matings.map((m) => m.act.key));
        for (const act of acts) {
            if (!Number.isFinite(act.t0) || known.has(act.key) || act.a === act.b) continue;
            if (epoch - act.t0 > MATING_LIVE_SECONDS) continue;
            this.matings.push({act, script: null, failed: false, over: false, acting: new Set()});
            known.add(act.key);
        }
        this.matings.sort((x, y) => x.act.t0 - y.act.t0);
    }

    clear(): void {
        for (const m of this.matings) this.release(m);
        this.matings = [];
    }

    get size(): number {
        return this.matings.length;
    }

    /** Every id a mating under way names now (drawn one by one, never as a herd's figure). */
    pins(): string[] {
        const out: string[] = [];
        for (const m of this.matings) if (m.acting.size) out.push(m.act.a, m.act.b);
        return out;
    }

    private release(m: Live<E>): void {
        m.acting.forEach((e) => this.host.setAct(e, null));
        m.acting.clear();
    }

    /** One frame at `epoch` (s, the shared clock): every mating under way poses its two. */
    step(epoch: number): void {
        const h = this.host;
        for (const m of this.matings) {
            if (m.over || m.failed) continue;
            const s = epoch - m.act.t0;
            if (s < 0) continue;
            const a = h.find(m.act.a);
            const b = h.find(m.act.b);
            if (!a || !b) {
                if (m.acting.size) this.release(m);
                continue;
            }
            if (!m.script) {
                if (!h.together(a, b)) {
                    m.failed = true;
                    continue;
                }
                const pa = h.scheduleAt(a, m.act.t0);
                const pb = h.scheduleAt(b, m.act.t0);
                const script = pa && pb
                    ? matingScript({x: pa.x, z: pa.z, pace: h.walk(a), length: h.length(a)}, {x: pb.x, z: pb.z, pace: h.walk(b), length: h.length(b)})
                    : null;
                if (!script) {
                    m.failed = true;
                    continue;
                }
                m.script = script;
            }
            const sc = m.script;
            const acting = new Set<E>();
            const pose = (entry: E, act: ActPose | null) => {
                if (!act || h.busy(entry)) return;
                h.setAct(entry, act);
                acting.add(entry);
            };
            if (s < sc.paired) {
                pose(a, matingPose(sc, true, s, h.ground, m.act.b));
                pose(b, matingPose(sc, false, s, h.ground, m.act.a));
            } else {
                // Part: each back to where its day has it now.
                const back = (entry: E, from: Point, pace: number) => {
                    const now = h.scheduleAt(entry, epoch);
                    if (!now) return null;
                    const d = Math.hypot(now.x - from.x, now.z - from.z);
                    const seconds = Math.min(Math.max(d / Math.max(pace, 0.3), RETURN_MIN), RETURN_MAX);
                    const k = (s - sc.paired) / seconds;
                    if (k >= 1) return null;
                    const e = ease(k);
                    const x = from.x + (now.x - from.x) * e;
                    const z = from.z + (now.z - from.z) * e;
                    return {x, z, base: h.ground(x, z), yaw: d > 0.05 ? Math.atan2(now.x - from.x, now.z - from.z) : now.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: k < 0.12 ? "rest" : "walk", speed: k < 0.12 ? 0 : d / seconds} satisfies ActPose;
                };
                const ba = back(a, sc.side, sc.paceA);
                const bb = back(b, sc.to.b, sc.paceB);
                pose(a, ba);
                pose(b, bb);
                if (!ba && !bb) m.over = true;
            }
            m.acting.forEach((e) => {
                if (!acting.has(e)) h.setAct(e, null);
            });
            m.acting = acting;
        }
        this.matings = this.matings.filter((m) => !(m.over || m.failed) || m.acting.size > 0 || epoch - m.act.t0 < MATING_LIVE_SECONDS);
    }

    debug(): Array<{key: string; t0: number; phase: string}> {
        return this.matings.map((m) => ({key: m.act.key, t0: m.act.t0, phase: m.failed ? "skipped" : m.over ? "over" : m.script ? "acting" : "waiting"}));
    }
}
