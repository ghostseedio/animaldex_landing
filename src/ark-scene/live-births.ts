/**
 * The record's live births acted out in the live world (handover §5, owner 2026-11-15: "could do a 'giving birth' one").
 * Each `birth` of the record that is not a hatching (a live-bearer's young, born on its due day since gestation,
 * decision 363) is acted on the shared clock, the same for every viewer, from the act's start: V1 holds it until the
 * record is out (`ark-act-hold.ts`: before, the birth was over before a page had read of it), the young out of sight
 * until then:
 *
 *   settle   the mother settles where her day has her: she lies down, or stands (tall hoofed animals, a giraffe or
 *            an elephant, give birth standing);
 *   born     the young appear one by one at her rear (a cub or a pup tucked at her belly in a den birth);
 *   lick     she turns to them and licks them;
 *   rise     young that follow their mother from the start (calves, foals) get up on wobbly legs;
 *   nurse    they suckle at her flank (den young suckle lying against her);
 *   part     each walks back to where its day has it now.
 *
 * How it goes comes from the species' care (`care.json`, read from its stored text): follow, carry, nest, guard, none.
 * Carried young: a primate's infant clings to her at once; a marsupial's newborn goes straight into the pouch (nothing
 * to see but the mother resting: never a joey on the ground); a scorpion's young climb onto her back. Young that are
 * guarded or on their own (live-bearing snakes, lizards, fish) appear beside her and stay near or go.
 *
 * The scene never decides a birth: the young and their parents come only from the record (`voyage_events` kind `birth`,
 * not `from_egg`). Which parent is the mother is the scene's drawn sex (the engine has none), else the record's first.
 * The card says "giving birth" while she does; mother and young then read "resting" (one new activity only: the Ark
 * page's static JavaScript budget, `ark-page-weight.test.ts`, had 41 bytes left).
 * Like the live matings (`live-matings.ts`), the scene gives it its entries through a host and this layer only says,
 * per frame, which act pose each takes, so nothing here touches the renderer.
 */

import type {ActPose} from "@/ark-scene/acts";
import type {ArkCareKind} from "@/lib/ark-care";

/** A litter from the record: its parents, its young, and when they were born (s, the shared clock). */
export type BirthAct = {key: string; parents: string[]; young: string[]; t0: number};

export type BirthStyle = "open" | "den" | "cling" | "pouch" | "back" | "beside";

export type LiveBirthsHost<E> = {
    find: (id: string) => E | null;
    /** Its schedule's place at a time (pure in the time); null off the schedule. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; yaw: number} | null;
    ground: (x: number, z: number) => number;
    walk: (entry: E) => number;
    /** Its drawn body length and height (m). */
    length: (entry: E) => number;
    height: (entry: E) => number;
    /** Its model's plan (`ark.json` behaviour.plan: mammal, reptile, snake, arthropod, fish…), or null. */
    plan: (entry: E) => string | null;
    /** Its species' care of the young (`care.json`), or null. */
    care: (entry: E) => ArkCareKind | null;
    /** Whether its kind carries its young in a pouch (a marsupial). */
    pouch: (entry: E) => boolean;
    male: (entry: E) => boolean | null;
    setAct: (entry: E, pose: ActPose | null) => void;
    busy: (entry: E) => boolean;
};

/** How long after its time a birth is still acted (s): the tick and the record's read come later. */
export const BIRTH_LIVE_SECONDS = 20 * 60;
const SETTLE = 8;
const EACH = 3;
const LICK = 16;
const RISE = 9;
const NURSE = 30;
const PART_MIN = 4;
const PART_MAX = 20;
/** A tall hoofed mother (drawn height, m) gives birth standing. */
const STAND_HEIGHT = 2.4;
/** The young drawn at most (a big litter's others are tucked out of sight in the den or among the first). */
const SHOWN_MAX = 6;

type Point = {x: number; z: number};

export type BirthScript = {
    style: BirthStyle;
    standing: boolean;
    spot: Point;
    yaw: number;
    /** Where each shown young is born and where it nurses. */
    born: Point[];
    nurse: Point[];
    /** Phase starts (s after t0). */
    first: number;
    lickEnd: number;
    riseEnd: number;
    end: number;
    mother: {length: number; height: number; pace: number};
    pace: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};
const yawTo = (from: Point, to: Point) => Math.atan2(to.x - from.x, to.z - from.z);
const lerpP = (p: Point, q: Point, k: number): Point => ({x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k});
function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

/** How the species gives birth, from its body plan and care. */
export function birthStyle(plan: string | null, care: ArkCareKind | null, pouch: boolean): BirthStyle {
    // (The model's plan: mammal, arthropod, reptile, snake, fish… A carried young that is not in a pouch clings: primates,
    // sloths, anteaters, bats. An arthropod's carried young ride its back: scorpions, whip scorpions.)
    if (pouch) return "pouch";
    if (plan === "arthropod" || plan === "arachnid") return care === "carry" ? "back" : "beside";
    if (plan === "mammal") return care === "follow" || care === "guard" ? "open" : care === "carry" ? "cling" : "den";
    return "beside";
}

/** The litter's script, built once from where the mother's day has her at the birth. */
export function birthScript(mother: Point & {yaw: number; length: number; height: number; pace: number; plan: string | null; care: ArkCareKind | null; pouch: boolean}, young: number, key: string, youngPace = 0.4): BirthScript {
    const style = birthStyle(mother.plan, mother.care, mother.pouch);
    const standing = style === "open" && mother.height >= STAND_HEIGHT;
    const n = clamp(young, 1, SHOWN_MAX);
    const dir = {x: Math.sin(mother.yaw), z: Math.cos(mother.yaw)};
    const side = {x: dir.z, z: -dir.x};
    const L = Math.max(mother.length, 0.05);
    const spread = (unit(`${key}:side`) < 0.5 ? -1 : 1);
    const born: Point[] = [];
    const nurse: Point[] = [];
    for (let k = 0; k < n; k++) {
        const fan = (k - (n - 1) / 2) * 0.22;
        if (style === "open") {
            // Behind her, a little to one side; nursing at her flank, head under her belly.
            born.push({x: mother.x - dir.x * L * 0.65 + side.x * (spread * 0.2 + fan) * L, z: mother.z - dir.z * L * 0.65 + side.z * (spread * 0.2 + fan) * L});
            nurse.push({x: mother.x - dir.x * L * (0.1 + 0.08 * k) + side.x * spread * L * 0.38, z: mother.z - dir.z * L * (0.1 + 0.08 * k) + side.z * spread * L * 0.38});
        } else if (style === "den") {
            // Tucked against her belly, in a row.
            const p = {x: mother.x + dir.x * L * (0.25 - 0.14 * k) + side.x * spread * L * 0.3, z: mother.z + dir.z * L * (0.25 - 0.14 * k) + side.z * spread * L * 0.3};
            born.push(p);
            nurse.push(p);
        } else if (style === "cling" || style === "back" || style === "pouch") {
            born.push({x: mother.x + dir.x * L * 0.12, z: mother.z + dir.z * L * 0.12});
            nurse.push(born[k]);
        } else {
            // Beside her, scattered in a half ring.
            const a = mother.yaw + Math.PI * (0.35 + 0.6 * (k / Math.max(n - 1, 1))) * spread;
            const r = L * (0.7 + 0.25 * unit(`${key}:r${k}`));
            born.push({x: mother.x + Math.sin(a) * r, z: mother.z + Math.cos(a) * r});
            nurse.push({x: mother.x + Math.sin(a) * r * 1.6, z: mother.z + Math.cos(a) * r * 1.6});
        }
    }
    const first = SETTLE;
    const lickEnd = first + EACH * (n - 1) + (style === "beside" || style === "pouch" || style === "back" ? 4 : LICK);
    const riseEnd = lickEnd + (style === "open" ? RISE : 0);
    const end = riseEnd + (style === "beside" ? 8 : NURSE);
    return {style, standing, spot: {x: mother.x, z: mother.z}, yaw: mother.yaw, born, nurse, first, lickEnd, riseEnd, end, mother: {length: L, height: mother.height, pace: mother.pace}, pace: youngPace};
}

type Ground = (x: number, z: number) => number;

function at(p: Point, yaw: number, ground: Ground, state: string, extra: Partial<ActPose> = {}): ActPose {
    return {x: p.x, z: p.z, base: ground(p.x, p.z), yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0, ...extra};
}

/** The mother's pose s seconds after the birth. */
export function motherPose(sc: BirthScript, s: number, ground: Ground, youngId?: string): ActPose {
    const lying = !sc.standing && sc.style !== "beside" && sc.style !== "back";
    const state = lying ? "rest" : "scan";
    const extra: Partial<ActPose> = {meal: s < sc.lickEnd ? "birthing" : "resting", ...(youngId ? {with: youngId} : {})};
    if (s < sc.first) return at(sc.spot, sc.yaw, ground, state, extra);
    if (s < sc.lickEnd && sc.style !== "beside" && sc.style !== "pouch" && sc.style !== "back") {
        // She turns to the young and licks them (head down to them, a slow bob).
        const toYoung = yawTo(sc.spot, sc.born[0]);
        const k = ease((s - sc.first) / 2.5);
        let d = toYoung - sc.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turn = lying ? d * 0.55 : d;
        return at(sc.spot, sc.yaw + turn * k, ground, lying ? "rest" : "eat", {...extra, pitch: lying ? 0 : 0.18 + 0.08 * Math.sin(s * 3)});
    }
    return at(sc.spot, sc.yaw, ground, state, extra);
}

/** The k-th young's pose s seconds after the birth (hidden before it is born). */
export function youngPose(sc: BirthScript, k: number, s: number, ground: Ground, motherId?: string): ActPose {
    const shown = Math.min(k, sc.born.length - 1);
    const bornAt = sc.first + EACH * shown;
    const extra: Partial<ActPose> = {meal: "resting", ...(motherId ? {with: motherId} : {})};
    const p = sc.born[shown];
    const faceMother = yawTo(p, sc.spot);
    if (s < bornAt || k >= sc.born.length || sc.style === "pouch") return {...at(p, faceMother, ground, "rest"), hidden: true};
    const up = sc.mother.height;
    if (sc.style === "cling") return at(sc.nurse[shown], sc.yaw, () => ground(sc.spot.x, sc.spot.z) + up * 0.35, "rest", {...extra, pitch: -0.5});
    if (sc.style === "back") return at({x: sc.spot.x - Math.sin(sc.yaw) * sc.mother.length * 0.1 * shown, z: sc.spot.z - Math.cos(sc.yaw) * sc.mother.length * 0.1 * shown}, sc.yaw + shown * 0.7, () => ground(sc.spot.x, sc.spot.z) + up * 0.8, "rest", extra);
    if (sc.style === "den") return at(p, sc.yaw + Math.PI / 2, ground, "rest", {...extra, lying: 0.6});
    if (sc.style === "beside") {
        const k2 = ease((s - bornAt - 2) / 6);
        const q = lerpP(p, sc.nurse[shown], k2);
        return at(q, yawTo(sc.spot, sc.nurse[shown]), ground, k2 > 0 && k2 < 1 ? "walk" : "rest", {...extra, speed: k2 > 0 && k2 < 1 ? 0.2 : 0});
    }
    // In the open: lying where born while she licks it; then up on wobbly legs; then to her flank to suckle.
    if (s < sc.lickEnd) return at(p, faceMother, ground, "rest", {...extra, lying: 0.5});
    if (s < sc.riseEnd) {
        const u = (s - sc.lickEnd) / (sc.riseEnd - sc.lickEnd);
        const wobble = Math.sin(u * 19 + shown) * 0.12 * (1 - u);
        return at(p, faceMother, ground, u < 0.35 ? "rest" : "scan", {...extra, roll: wobble, pitch: u < 0.35 ? 0.35 * (1 - u / 0.35) : wobble * 0.5});
    }
    const w = clamp((s - sc.riseEnd) / 5, 0, 1);
    const q = lerpP(p, sc.nurse[shown], ease(w));
    if (w < 1) return at(q, yawTo(p, sc.nurse[shown]), ground, "walk", {...extra, speed: Math.hypot(sc.nurse[shown].x - p.x, sc.nurse[shown].z - p.z) / 5});
    return at(q, sc.yaw + Math.PI * 0.85, ground, "eat", {...extra, pitch: -0.25});
}

type Live<E> = {act: BirthAct; script: BirthScript | null; motherId: string | null; failed: boolean; over: boolean; acting: Set<E>};

export class LiveBirths<E> {
    private births: Live<E>[] = [];

    constructor(private readonly host: LiveBirthsHost<E>) {}

    /** New litters from the record; those long over are forgotten. */
    add(acts: BirthAct[], epoch: number): void {
        const known = new Set(this.births.map((b) => b.act.key));
        for (const act of acts) {
            if (!Number.isFinite(act.t0) || known.has(act.key) || !act.young.length) continue;
            if (epoch - act.t0 > BIRTH_LIVE_SECONDS) continue;
            this.births.push({act, script: null, motherId: null, failed: false, over: false, acting: new Set()});
            known.add(act.key);
        }
        this.births.sort((x, y) => x.act.t0 - y.act.t0);
    }

    clear(): void {
        for (const b of this.births) this.release(b);
        this.births = [];
    }

    get size(): number {
        return this.births.length;
    }

    pins(): string[] {
        const out: string[] = [];
        for (const b of this.births) if (b.acting.size && b.motherId) out.push(b.motherId, ...b.act.young);
        return out;
    }

    private release(b: Live<E>): void {
        b.acting.forEach((e) => this.host.setAct(e, null));
        b.acting.clear();
    }

    /** The mother: the parent drawn female, else the record's first (the engine has no sexes). */
    private mother(act: BirthAct): {id: string; entry: E} | null {
        const h = this.host;
        const found = act.parents.map((id) => ({id, entry: h.find(id)})).filter((p): p is {id: string; entry: E} => p.entry !== null);
        return found.find((p) => h.male(p.entry) === false) ?? found.find((p) => h.male(p.entry) !== true) ?? found[0] ?? null;
    }

    step(epoch: number): void {
        const h = this.host;
        for (const b of this.births) {
            if (b.over || b.failed) continue;
            const s = epoch - b.act.t0;
            if (s < 0) {
                // V1 (held until the record is out, `ark-act-hold.ts`): the young are in the read already and are not
                // born yet: out of sight until they are (their mother goes on with her day).
                for (const id of b.act.young) {
                    const young = h.find(id);
                    const at = young && !h.busy(young) ? h.scheduleAt(young, epoch) : null;
                    if (!young || !at) continue;
                    h.setAct(young, {x: at.x, z: at.z, base: h.ground(at.x, at.z), yaw: at.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: true, speed: 0});
                    b.acting.add(young);
                }
                continue;
            }
            if (!b.script) {
                const mother = this.mother(b.act);
                const place = mother ? h.scheduleAt(mother.entry, b.act.t0) : null;
                if (!mother || !place) {
                    // (The young it kept out of sight while it was held are shown again.)
                    this.release(b);
                    b.failed = true;
                    continue;
                }
                const young = b.act.young.map((id) => h.find(id)).filter((e): e is E => e !== null);
                b.motherId = mother.id;
                b.script = birthScript({...place, length: h.length(mother.entry), height: h.height(mother.entry), pace: h.walk(mother.entry), plan: h.plan(mother.entry), care: h.care(mother.entry), pouch: h.pouch(mother.entry)}, young.length || b.act.young.length, b.act.key, young[0] ? h.walk(young[0]) : 0.4);
            }
            const sc = b.script;
            const mother = b.motherId ? h.find(b.motherId) : null;
            if (!mother) {
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
            const back = (entry: E, from: Point, pace: number, startAt: number): ActPose | null => {
                const now = h.scheduleAt(entry, epoch);
                if (!now) return null;
                const d = Math.hypot(now.x - from.x, now.z - from.z);
                const seconds = clamp(d / Math.max(pace, 0.3), PART_MIN, PART_MAX);
                const k = (s - startAt) / seconds;
                if (k >= 1) return null;
                const e = ease(k);
                const x = from.x + (now.x - from.x) * e;
                const z = from.z + (now.z - from.z) * e;
                return {x, z, base: h.ground(x, z), yaw: d > 0.05 ? Math.atan2(now.x - from.x, now.z - from.z) : now.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: k < 0.15 ? "rest" : "walk", speed: k < 0.15 ? 0 : d / seconds};
            };
            const youngIds = b.act.young;
            if (s < sc.end) {
                pose(mother, motherPose(sc, s, h.ground, youngIds[0]));
                youngIds.forEach((id, k) => {
                    const e = h.find(id);
                    if (e) pose(e, youngPose(sc, k, s, h.ground, b.motherId ?? undefined));
                });
            } else {
                // Part: each back to its day. (Young beyond the shown few, and a pouch's, simply are where their day has them.)
                const bm = back(mother, sc.spot, sc.mother.pace, sc.end);
                pose(mother, bm);
                let any = Boolean(bm);
                youngIds.forEach((id, k) => {
                    const e = h.find(id);
                    if (!e || k >= sc.born.length || sc.style === "pouch") return;
                    const from = sc.style === "open" || sc.style === "beside" ? sc.nurse[k] : sc.born[k];
                    const by = back(e, from, sc.pace, sc.end);
                    pose(e, by);
                    any ||= Boolean(by);
                });
                if (!any) b.over = true;
            }
            b.acting.forEach((e) => {
                if (!acting.has(e)) h.setAct(e, null);
            });
            b.acting = acting;
        }
        this.births = this.births.filter((b) => !(b.over || b.failed) || b.acting.size > 0 || epoch - b.act.t0 < BIRTH_LIVE_SECONDS);
    }

    debug(): Array<{key: string; t0: number; mother: string | null; end: number | null; phase: string; style?: BirthStyle; young: number}> {
        return this.births.map((b) => ({key: b.act.key, t0: b.act.t0, mother: b.motherId, end: b.script ? Math.round(b.script.end) : null, phase: b.failed ? "skipped" : b.over ? "over" : b.script ? "acting" : "waiting", ...(b.script ? {style: b.script.style} : {}), young: b.act.young.length}));
    }
}
