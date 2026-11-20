/**
 * The server's encounter meals in the live world (lane ark-kills-real, 2026-11-15): each meal acted out on the shared
 * clock from its encounter step (`encounter.t`), the same for every viewer: the chase, the catch, the meal, the
 * predator's drink and rest, the scavengers that come to what is left, and the traces left behind.
 *
 * The scene never decides a kill: a meal comes from the hunting read (`voyage_hunting_v1`'s recent meals with their
 * geometry) and the event log's records of the two animals. The server works the world out on its tick (every 10
 * minutes), so a meal is known up to that long after its step. V1 (the audit's §2.4 "hold the live chase until the
 * record arrives"): the act is HELD until the record is out (`ark-act-hold.ts` `arkActStart`: the row's own time and a
 * page's refresh), so the chase is seen by whoever is watching, not only the feeding after it. Until then the two go
 * on with their day (the eaten one stands in, `replay/cast.ts`); in the last `APPROACH_SECONDS` each walks from where
 * its day has it to where the record's encounter starts the chase, when that is near enough to walk (else it is
 * simply there at the start, as before). A viewer who comes later sees whatever part of it is still going on.
 *
 * The scene (`index.ts`) gives it its entries through `LiveMealsHost`; this layer only says, per frame, which act pose
 * each of them takes (the replay's own `entry.act`), so nothing here touches the renderer.
 */

import type {ActPose, ChaseKind, MealStage} from "@/ark-scene/acts";
import {mealScript, predatorAt, preyAt, scavengeVisit, scavengerAt, type MealCatch, type MealScript, type ScavengeVisit} from "@/ark-scene/meal-acts";
import {pickScavengers, scavengeSeconds, type MealPlan, type ScavengerCandidate, type TraceKind} from "@/ark-scene/meals";
import type {ArkAct} from "@/lib/ark-life";
import {arkActStartOf} from "@/lib/ark-act-hold";

export type MealAct = Extract<ArkAct, {kind: "meal"}>;

/** What the layer needs of the scene. `E` is the scene's entry. */
export type LiveMealsHost<E> = {
    /** A living animal's entry (not a stand-in). */
    find: (id: string) => E | null;
    /** A stand-in for the eaten one (from the event's record), made once per meal; `drop` forgets it. */
    ghost: (act: MealAct) => E | null;
    drop: (ghost: E) => void;
    /** The chase (ending at the catch: `mealStage` with `meal: true`) from the encounter alone, and the catch's ground. */
    stage: (act: MealAct, predator: E, prey: E) => {stage: MealStage; kind: ChaseKind; plan: MealPlan; catch: Omit<MealCatch, "predator" | "prey" | "kind">; predatorHeight: number; preyHeight: number; predatorLength: number; preyLength: number} | null;
    /** Its schedule's place at a time (pure in the time), with its doing; null off the schedule. */
    scheduleAt: (entry: E, epoch: number) => {x: number; z: number; y: number; yaw: number; doing: string; aloft: boolean} | null;
    /** The scavengers that might come: carrion eaters (`isScavenger`) round a spot, with their places then. */
    candidates: (spot: {x: number; z: number}, epoch: number) => Array<ScavengerCandidate & {entry: E; height: number; walk: number}>;
    /** Whether the predator hunts that kind (its prey keep clear of it). */
    eats: (predatorSlug: string, slug: string) => boolean;
    ground: (x: number, z: number) => number;
    /** Its walking pace (m/s). */
    walk: (entry: E) => number;
    /** The pose it takes (null: its own again). */
    setAct: (entry: E, pose: ActPose | null) => void;
    /** Held by something else now (a replay's act, a moment): left alone. */
    busy: (entry: E) => boolean;
    /** The stand-in shown or not (held back while a replay acts the same meal). */
    hold: (ghost: E, held: boolean) => void;
};

type Built = {
    stage: MealStage;
    kind: ChaseKind;
    catchAt: number;
    script: MealScript;
    catchPrey: ActPose;
    visits: Array<ScavengeVisit & {feedTo: number}>;
    /** u (after the catch) when the carcass is left by everyone: the prey fades then. */
    carcassEnd: number;
    /** u when the predator's walk back to its day ends. */
    predatorBack: number;
    returnFrom: number;
};

type Live<E> = {
    key: string;
    act: MealAct;
    t0: number;
    built: Built | null;
    failed: boolean;
    /** Acted to its end (only its traces left). */
    over: boolean;
    ghost: E | null;
    /** Everyone the layer is acting now (to hand back when it stops). */
    acting: Set<E>;
    /** Where each one's day had it when its walk to the chase's start began (`approachPose`); null: not walked. */
    lead?: {predator: From | null; prey: From | null};
    /** V1: added from the event log (`add`), kept whatever the hunting read lists. */
    logged?: boolean;
};

export type LiveTrace = {key: string; x: number; y: number; z: number; kind: TraceKind; flattened: boolean; size: number; amount: number; alpha: number; seed: string};

export type LiveHunt = {predator: string; prey: string; phase: "hunting" | "eating"; t0: number};

const ease = (u: number) => {
    const c = Math.min(Math.max(u, 0), 1);
    return c * c * (3 - 2 * c);
};

/** Back to its day: from where the meal left it to where its schedule has it now, walking (or flying), over `seconds`. */
function backTo(from: ActPose, to: {x: number; z: number; y: number; yaw: number; aloft: boolean}, k: number, seconds: number, flies: boolean, ground: (x: number, z: number) => number): ActPose {
    const e = ease(k);
    const x = from.x + (to.x - from.x) * e;
    const z = from.z + (to.z - from.z) * e;
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const yaw = d > 0.05 ? Math.atan2(to.x - from.x, to.z - from.z) : to.yaw;
    const air = flies && d > 2;
    const y = air ? from.base + (to.y - from.base) * e + Math.sin(Math.PI * k) * Math.min(Math.max(d * 0.25, 2), 10) : flies ? from.base + (to.y - from.base) * e : ground(x, z);
    return {x, z, base: y, yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: air ? (k < 0.15 ? "takeoff" : "fly") : "walk", speed: d / Math.max(seconds, 0.5)};
}

const RETURN_MIN = 3;
const RETURN_MAX = 25;
/** The walk to where the chase starts: this long before it (s), only from within this many times its walk over that time. */
export const APPROACH_SECONDS = 14;
/** A meal the log added is kept this long after its start (s): the hunting read's own window. */
const LOGGED_SECONDS = 7200;
const APPROACH_REACH = 2.5;

type From = {x: number; z: number; y: number; yaw: number};

/**
 * On its way to where the record's chase starts (pure in its day's place when the walk began, the start and `k`): a
 * walk over the ground (or straight through the air or the water for one that is off it), turned to the start's own
 * heading as it gets there. Null when the start is too far to walk in the time.
 */
export function approachPose(from: From, to: ActPose, k: number, walk: number, ground: (x: number, z: number) => number): ActPose | null {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    if (d > Math.max(walk, 0.3) * APPROACH_SECONDS * APPROACH_REACH) return null;
    const e = ease(k);
    const x = from.x + (to.x - from.x) * e;
    const z = from.z + (to.z - from.z) * e;
    const onGround = Math.abs(from.y - ground(from.x, from.z)) < 0.3 && Math.abs(to.base - ground(to.x, to.z)) < 0.3;
    const base = onGround ? ground(x, z) : from.y + (to.base - from.y) * e;
    const along = d > 0.05 ? Math.atan2(to.x - from.x, to.z - from.z) : to.yaw;
    const turn = ease((k - 0.8) / 0.2);
    const yaw = along + Math.atan2(Math.sin(to.yaw - along), Math.cos(to.yaw - along)) * turn;
    // (Its pace eases in and out with the way: the derivative of the ease.)
    const speed = (d / APPROACH_SECONDS) * 6 * Math.min(Math.max(k, 0), 1) * (1 - Math.min(Math.max(k, 0), 1));
    return {x, z, base, yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state: onGround ? (d < 0.05 ? "scan" : "walk") : to.base < -0.02 ? "swim" : "fly", speed};
}

export class LiveMeals<E> {
    private meals: Live<E>[] = [];

    constructor(private readonly host: LiveMealsHost<E>) {}

    /**
     * V1: meals straight from the event log as it is read (the hunting read comes up to a refresh later, and by then
     * the held chase may have begun): added to the set, never replacing it. One the set already has (the same hunter
     * and prey) is left as it is; one added here stays until it is long over, whatever the hunting read then lists.
     */
    add(acts: MealAct[], epoch: number): void {
        // (Kept while its traces may still show: the hunting read's own window.)
        this.meals = this.meals.filter((m) => !m.logged || epoch - m.t0 < LOGGED_SECONDS || (this.stop(m), false));
        for (const act of acts) {
            const t0 = arkActStartOf(act.at, act.encounter?.t);
            if (!Number.isFinite(t0) || epoch - t0 > LOGGED_SECONDS) continue;
            if (this.meals.some((m) => m.act.predator.id === act.predator.id && m.act.prey.id === act.prey.id && Math.abs(m.t0 - t0) < LOGGED_SECONDS)) continue;
            this.meals.push({key: `${act.predator.id}>${act.prey.id}@${act.encounter?.t ?? act.at}`, act, t0, built: null, failed: false, over: false, ghost: null, acting: new Set(), logged: true});
        }
        this.meals.sort((a, b) => a.t0 - b.t0);
    }

    /** The meals to act (from the hunting read and the event log); one no longer named stops (its animals let go). */
    set(acts: MealAct[]): void {
        const keyOf = (act: MealAct) => `${act.predator.id}>${act.prey.id}@${act.encounter?.t ?? act.at}`;
        const keep = new Map(this.meals.map((m) => [m.key, m]));
        const next: Live<E>[] = [];
        // (V1: what the log added stays, and is not doubled by the read's row of the same meal.)
        for (const m of this.meals) {
            if (!m.logged) continue;
            next.push(m);
            keep.delete(m.key);
        }
        for (const act of acts) {
            if (next.some((m) => m.logged && m.act.predator.id === act.predator.id && m.act.prey.id === act.prey.id)) continue;
            // (Held until the record is out, `ark-act-hold.ts`; never before the encounter's own step.)
            const t0 = arkActStartOf(act.at, act.encounter?.t);
            if (!Number.isFinite(t0)) continue;
            const key = keyOf(act);
            next.push(keep.get(key) ?? {key, act, t0, built: null, failed: false, over: false, ghost: null, acting: new Set()});
            keep.delete(key);
        }
        keep.forEach((gone) => this.stop(gone));
        this.meals = next.sort((a, b) => a.t0 - b.t0);
    }

    private stop(m: Live<E>): void {
        m.acting.forEach((e) => this.host.setAct(e, null));
        m.acting.clear();
        if (m.ghost) this.host.drop(m.ghost);
        m.ghost = null;
    }

    clear(): void {
        for (const m of this.meals) this.stop(m);
        this.meals = [];
    }

    get size(): number {
        return this.meals.length;
    }

    /** Every id a meal under way names now (drawn one by one, never as a herd's figure). */
    pins(): string[] {
        const out: string[] = [];
        for (const m of this.meals) if (!m.over && (m.built || m.acting.size)) out.push(m.act.predator.id, m.act.prey.id, ...(m.built?.visits.map((v) => v.id) ?? []));
        return out;
    }

    /** True while this meal is still being acted in the live world (a replay of it then hands over without a fade). */
    under(predator: string, prey: string, epoch: number): boolean {
        return this.meals.some((m) => m.act.predator.id === predator && m.act.prey.id === prey && m.built && epoch - m.t0 < m.built.catchAt + m.built.carcassEnd);
    }

    private build(m: Live<E>): Built | null {
        const h = this.host;
        const predator = h.find(m.act.predator.id);
        if (!predator) return null;
        m.ghost ??= h.ghost(m.act);
        if (!m.ghost) return null;
        const made = h.stage(m.act, predator, m.ghost);
        if (!made) return null;
        const catchAt = made.stage.catchAt ?? made.stage.seconds;
        const p = made.stage.predator(catchAt);
        const q = made.stage.prey(catchAt);
        if (!p) return null;
        const script = mealScript(made.plan, {...made.catch, kind: made.kind, predator: {x: p.x, z: p.z, base: p.base, yaw: p.yaw, length: made.predatorLength, height: made.predatorHeight}, prey: {x: q.x, z: q.z, base: q.base, yaw: q.yaw, length: made.preyLength, height: made.preyHeight}});
        // The scavengers: who is near and awake when the predator leaves what is left (their schedules' places then).
        const leftAt = m.t0 + catchAt + script.leaves;
        const visits: Built["visits"] = [];
        if (made.plan.scavengers > 0) {
            const spot = script.carcass;
            const list = h.candidates(spot, leftAt);
            const picks = pickScavengers(list, spot, {seed: made.plan.seed, count: made.plan.scavengers, predatorId: m.act.predator.id, preyId: m.act.prey.id, eatenBy: (slug) => h.eats(m.act.predator.model_slug, slug)});
            for (const pick of picks) {
                const c = list.find((row) => row.id === pick.id)!;
                const start = script.leaves + pick.delay;
                const from = h.scheduleAt(c.entry, m.t0 + catchAt + start);
                if (!from) continue;
                const feed = scavengeSeconds(made.plan.seed, c.id);
                const visit = scavengeVisit({id: c.id, seed: made.plan.seed, flies: c.flies, length: c.length, height: c.height, walk: c.walk, from: {x: from.x, z: from.z, base: from.y, yaw: from.yaw}, carcass: spot, carcassLength: made.preyLength, start, feedSeconds: feed, ground: h.ground});
                // Still awake when it would leave: else it does not come.
                const after = h.scheduleAt(c.entry, m.t0 + catchAt + visit.leave);
                if (!after || after.doing === "sleep" || after.doing === "to_roost") continue;
                visits.push({...visit, feedTo: visit.leave});
            }
        }
        const carcassEnd = Math.max(script.leaves, ...visits.map((v) => v.leave));
        return {stage: made.stage, kind: made.kind, catchAt, script, catchPrey: q, visits, carcassEnd, predatorBack: script.ends + RETURN_MAX, returnFrom: script.ends};
    }

    /**
     * One frame at `epoch` (s, the shared clock): every meal under way poses its animals. `replaying(id)`: a replay acts
     * that animal now (left to it; its stand-in hidden).
     */
    step(epoch: number, replaying: (id: string) => boolean): void {
        const h = this.host;
        for (const m of this.meals) {
            const s = epoch - m.t0;
            if (m.failed) continue;
            if (s < 0) {
                if (s >= -APPROACH_SECONDS && !replaying(m.act.predator.id) && !replaying(m.act.prey.id)) this.approach(m, s, epoch);
                continue;
            }
            if (!m.built) {
                m.built = this.build(m);
                if (!m.built) {
                    // (Its predator is not in the scene, or the stand-in could not be placed: nothing to act.)
                    m.failed = !h.find(m.act.predator.id);
                    continue;
                }
            }
            const b = m.built;
            const u = s - b.catchAt;
            if (u > Math.max(b.carcassEnd + 3, b.predatorBack, ...b.visits.map((v) => v.leave + RETURN_MAX))) {
                // Over: everyone is its own again (its traces stay, `traces`).
                if (m.acting.size || m.ghost) this.stop(m);
                m.over = true;
                continue;
            }
            const acting = new Set<E>();
            const pose = (entry: E | null, act: ActPose | null) => {
                if (!entry) return;
                if (h.busy(entry)) return;
                h.setAct(entry, act);
                if (act) acting.add(entry);
            };
            const predator = h.find(m.act.predator.id);
            const replayed = replaying(m.act.predator.id) || replaying(m.act.prey.id);
            if (m.ghost) h.hold(m.ghost, replayed);
            if (replayed) {
                m.acting = acting;
                continue;
            }
            // The prey (the stand-in): the chase, then lying where it fell until the carcass is left, then gone.
            if (m.ghost) {
                const gone = u >= b.carcassEnd + 2.6 || (b.script.plan.style === "swallow" && u >= b.script.feedTo);
                pose(m.ghost, gone ? {...b.catchPrey, hidden: true} : u < 0 ? {...b.stage.prey(s), with: m.act.predator.id, role: "quarry"} : {...preyAt(b.script, u, b.catchPrey, b.carcassEnd), with: m.act.predator.id});
            }
            // The predator: the chase, the meal, its drink and rest, then back to its day.
            if (predator) {
                if (u < 0) {
                    const p = b.stage.predator(s);
                    pose(predator, p ? {...p, with: m.act.prey.id, role: "hunter", meal: "hunting"} : null);
                } else if (u < b.returnFrom) {
                    const p = predatorAt(b.script, u);
                    pose(predator, {...p, with: m.act.prey.id, meal: p.doing});
                } else {
                    const back = this.back(predator, predatorAt(b.script, b.returnFrom - 1e-3), m.t0 + b.catchAt + b.returnFrom, epoch, false);
                    pose(predator, back);
                }
            }
            // The scavengers: on their way, feeding, then back to their day.
            for (const v of b.visits) {
                const entry = h.find(v.id);
                if (!entry || u < v.start) continue;
                if (u < v.leave) {
                    pose(entry, {...scavengerAt(v, u), meal: "scavenging", with: m.act.prey.id});
                    continue;
                }
                pose(entry, this.back(entry, scavengerAt(v, v.leave - 1e-3), m.t0 + b.catchAt + v.leave, epoch, v.flies));
            }
            // Whoever it acted last frame and not now: its own again.
            m.acting.forEach((e) => {
                if (!acting.has(e)) h.setAct(e, null);
            });
            m.acting = acting;
        }
    }

    /**
     * The last seconds before the chase: each of the two on its way from where its day had it to where the record's
     * encounter starts them (the eaten one's stand-in takes over from the one in the roster here, where that one stood).
     */
    private approach(m: Live<E>, s: number, epoch: number): void {
        const h = this.host;
        const predator = h.find(m.act.predator.id);
        if (!predator || h.busy(predator)) return;
        if (!m.lead) {
            // (Where the prey's day has it, asked before its stand-in hides the one in the roster.)
            const living = h.find(m.act.prey.id);
            const start = m.t0 - APPROACH_SECONDS;
            const preyFrom = living ? h.scheduleAt(living, start) : null;
            const predatorFrom = h.scheduleAt(predator, start);
            m.built ??= this.build(m);
            if (!m.built) return;
            m.lead = {predator: predatorFrom, prey: preyFrom};
        }
        const b = m.built;
        if (!b) return;
        const k = (s + APPROACH_SECONDS) / APPROACH_SECONDS;
        const acting = new Set<E>();
        const p0 = b.stage.predator(0);
        const walked = p0 && m.lead.predator ? approachPose(m.lead.predator, p0, k, h.walk(predator), h.ground) : null;
        if (walked) {
            h.setAct(predator, {...walked, with: m.act.prey.id});
            acting.add(predator);
        }
        if (m.ghost) {
            h.hold(m.ghost, false);
            const q0 = b.stage.prey(0);
            const own = m.lead.prey ? approachPose(m.lead.prey, q0, k, h.walk(m.ghost), h.ground) : null;
            // (Too far to walk, or its day unknown: it is at the start, as it always was.)
            h.setAct(m.ghost, own ?? {...q0, with: m.act.predator.id});
            acting.add(m.ghost);
        }
        m.acting.forEach((e) => {
            if (!acting.has(e)) h.setAct(e, null);
        });
        m.acting = acting;
    }

    /** Walking (or flying) back to where its schedule has it, from `since`; null once there (its schedule's again). */
    private back(entry: E, from: ActPose, since: number, epoch: number, flies: boolean): ActPose | null {
        const h = this.host;
        const at0 = h.scheduleAt(entry, since);
        const now = h.scheduleAt(entry, epoch);
        if (!at0 || !now) return null;
        const seconds = Math.min(Math.max(Math.hypot(at0.x - from.x, at0.z - from.z) / Math.max(h.walk(entry) * (flies ? 6 : 1), 0.3), RETURN_MIN), RETURN_MAX);
        const k = (epoch - since) / seconds;
        if (k >= 1) return null;
        return backTo(from, now, k, seconds, flies, h.ground);
    }

    /** Development (the kills harness): each meal's times (s after its step) and who comes to it. */
    debug(): Array<{key: string; t0: number; catchAt: number; hunt: string | null; style: string; feedTo: number; drink: [number, number] | null; rest: [number, number]; carcassEnd: number; visits: Array<{id: string; start: number; arrive: number; leave: number}>; carcass: {x: number; z: number} | null; plan: MealPlan | null}> {
        return this.meals.map((m) => {
            const b = m.built;
            const at = b?.catchAt ?? 0;
            return {
                key: m.key,
                t0: m.t0,
                catchAt: at,
                hunt: b?.stage.hunt ?? null,
                style: b?.script.plan.style ?? "-",
                feedTo: at + (b?.script.feedTo ?? 0),
                drink: b?.script.drink ? [at + b.script.drink.from, at + b.script.drink.to] : null,
                rest: [at + (b?.script.rest.from ?? 0), at + (b?.script.rest.to ?? 0)],
                carcassEnd: at + (b?.carcassEnd ?? 0),
                visits: b?.visits.map((v) => ({id: v.id, start: at + v.start, arrive: at + v.arrive, leave: at + v.leave})) ?? [],
                carcass: b ? {x: b.script.carcass.x, z: b.script.carcass.z} : null,
                plan: b?.script.plan ?? null
            };
        });
    }

    /** The traces where meals were: from the catch (the grass pressed, feathers plucked as it feeds), fading by rule. */
    traces(epoch: number): LiveTrace[] {
        const out: LiveTrace[] = [];
        for (const m of this.meals) {
            const b = m.built;
            if (!b) continue;
            const u = epoch - m.t0 - b.catchAt;
            const t = b.script.plan.trace;
            if (u < 0 || (t.kind === "none" && !t.flattened)) continue;
            const left = b.carcassEnd;
            const life = u - left;
            if (life > t.seconds) continue;
            // Builds up while it feeds (plucking, tearing), then stays; fades over its last third.
            const amount = Math.min(u / Math.max(b.script.plan.feedSeconds, 1), 1);
            const alpha = life <= t.seconds * (2 / 3) ? 1 : 1 - (life - t.seconds * (2 / 3)) / (t.seconds / 3);
            out.push({key: m.key, x: b.script.carcass.x, y: b.script.carcass.base, z: b.script.carcass.z, kind: t.kind, flattened: t.flattened, size: t.size, amount, alpha: Math.max(alpha, 0), seed: b.script.plan.seed});
        }
        return out;
    }

    /** Where a catch lies being eaten now (the grass round it pressed down by the struggle, so it is seen). */
    pressed(epoch: number): Array<{x: number; z: number; radius: number}> {
        const out: Array<{x: number; z: number; radius: number}> = [];
        for (const m of this.meals) {
            const b = m.built;
            if (!b || m.over) continue;
            const u = epoch - m.t0 - b.catchAt;
            if (u < 0 || u > b.carcassEnd + 3) continue;
            out.push({x: b.script.carcass.x, z: b.script.carcass.z, radius: Math.max(b.script.c.prey.length * 1.6, 0.45)});
        }
        return out;
    }

    /** The newest hunt or meal under way (the marker): its chase or its feeding, not its rest. */
    newest(epoch: number): LiveHunt | null {
        let best: LiveHunt | null = null;
        for (const m of this.meals) {
            const b = m.built;
            if (!b) continue;
            const s = epoch - m.t0;
            // (V1: from the hunter's walk to where the chase starts: the marker is up before the first stride.)
            if (s < -APPROACH_SECONDS) continue;
            const phase = s < b.catchAt ? "hunting" : s < b.catchAt + b.script.feedTo ? "eating" : null;
            if (phase && (!best || m.t0 > best.t0)) best = {predator: m.act.predator.id, prey: m.act.prey.id, phase, t0: m.t0};
        }
        return best;
    }

    /** Whether a meal still needs the layer at `epoch` (acting, or a trace showing). */
    live(epoch: number, traceSeconds = 0): boolean {
        return this.meals.some((m) => epoch >= m.t0 && (!m.built || epoch - m.t0 < m.built.catchAt + Math.max(m.built.carcassEnd + Math.max(m.built.script.plan.trace.seconds, traceSeconds), m.built.predatorBack, ...m.built.visits.map((v) => v.leave + RETURN_MAX))));
    }
}
