/**
 * The liveliness wiring's shared decisions (docs/ark/liveliness-wiring.md):
 * how the shared clock's weather, tide and ages reach what each animal does
 * in the scene. Visual only: nothing here decides an arrival, a meal, a
 * birth, a death or a score.
 *
 * Deterministic and shared, like `ark-clock.ts`: every answer is a pure
 * function of a moment (ms since the epoch, UTC), the weather (itself a pure
 * function of the moment) and animal ids. The scene applies these on top of
 * the behaviour schedule's pose (`behaviour-schedule.ts`), so every viewer
 * sees the same zebra walk to the same tree when the same rain comes in.
 *
 * - Shelter: in rain or a storm, each animal that shelters goes to cover (a
 *   tree near its home, or its roost), or hunkers where it stands with its
 *   back to the wind; each at its own seeded moment, walking there.
 * - Young: a dependent young one keeps at its parent's heel (or rides on
 *   it), and now and then plays round it.
 * - Tide: water animals keep to the water's surface as it rises and falls;
 *   a land animal never stands on ground the tide has covered.
 */

import {hash32, unit} from "@/lib/ark-clock";

// ---------------------------------------------------------------------------
// Small helpers

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

/** Smoothstep on 0…1. */
export function ease(t: number): number {
    const c = clamp01(t);
    return c * c * (3 - 2 * c);
}

function wrapAngle(angle: number): number {
    const a = ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return a - Math.PI;
}

/** From `a` toward `b` by t, the short way round. */
export function lerpAngle(a: number, b: number, t: number): number {
    return a + wrapAngle(b - a) * t;
}

/** The heading (yaw, model forward = +z) that faces along (dx, dz). */
export function yawToward(dx: number, dz: number): number {
    return Math.atan2(dx, dz);
}

// ---------------------------------------------------------------------------
// Weather flips: when a shared yes/no about the weather last changed

export type FlipState = {
    /** The answer now. */
    on: boolean;
    /** When it last changed (ms), or -Infinity if not within the look-back. */
    since: number;
    /** When it changed before that (ms), or -Infinity. */
    before: number;
};

/**
 * When a yes/no question about the weather ("seek cover?") last changed: the
 * question is asked on a fixed grid (absolute multiples of `stepMs`, so two
 * viewers ask at the same moments) and each change is narrowed by halving
 * to `precisionMs`. Pure apart from its cache: every viewer gets the same
 * moments.
 */
export class WeatherFlips {
    private readonly cache = new Map<number, boolean>();
    private readonly flips = new Map<number, number>();
    /** The last two changes at or before grid point `index` (the backward scan, done once per grid point). */
    private readonly scans = new Map<number, [number, number]>();

    constructor(
        private readonly predicate: (ms: number) => boolean,
        private readonly stepMs = 30_000,
        private readonly lookBackMs = 3 * 3_600_000,
        private readonly precisionMs = 250
    ) {}

    private at(index: number): boolean {
        let value = this.cache.get(index);
        if (value === undefined) {
            value = this.predicate(index * this.stepMs);
            this.cache.set(index, value);
            if (this.cache.size > 4096) this.prune(index);
        }
        return value;
    }

    private prune(index: number) {
        const keep = Math.ceil(this.lookBackMs / this.stepMs) + 64;
        this.cache.forEach((_, key) => {
            if (Math.abs(key - index) > keep) this.cache.delete(key);
        });
        this.flips.forEach((_, key) => {
            if (Math.abs(key - index) > keep) this.flips.delete(key);
        });
        this.scans.forEach((_, key) => {
            if (Math.abs(key - index) > keep) this.scans.delete(key);
        });
    }

    /** The moment within grid step `index` → `index + 1` where the answer changes (halving, deterministic). */
    private flipIn(index: number): number {
        const known = this.flips.get(index);
        if (known !== undefined) return known;
        const from = this.at(index);
        let lo = index * this.stepMs;
        let hi = lo + this.stepMs;
        while (hi - lo > this.precisionMs) {
            const mid = Math.floor((lo + hi) / 2);
            if (this.predicate(mid) === from) lo = mid;
            else hi = mid;
        }
        this.flips.set(index, hi);
        return hi;
    }

    /** The answer at `ms`, when it last changed, and when before that. */
    stateAt(ms: number): FlipState {
        const index = Math.floor(ms / this.stepMs);
        const steps = Math.ceil(this.lookBackMs / this.stepMs);
        // The answer exactly at ms (between grid points it may already have changed).
        let on = this.at(index);
        let since = -Infinity;
        let before = -Infinity;
        const within = this.at(index + 1) !== on ? this.flipIn(index) : null;
        if (within !== null && within <= ms) {
            since = within;
            on = !on;
        }
        const found: number[] = since === -Infinity ? [] : [since];
        let scan = this.scans.get(index);
        if (!scan) {
            const back: number[] = [];
            for (let k = 0; k < steps && back.length < 2; k++) {
                const i = index - k - 1;
                if (this.at(i) !== this.at(i + 1)) back.push(this.flipIn(i));
            }
            scan = [back[0] ?? -Infinity, back[1] ?? -Infinity];
            this.scans.set(index, scan);
        }
        for (const flip of scan) if (found.length < 2 && flip !== -Infinity) found.push(flip);
        if (since === -Infinity) {
            since = found[0] ?? -Infinity;
            before = found[1] ?? -Infinity;
        } else {
            before = found[1] ?? -Infinity;
        }
        return {on, since, before};
    }
}

// ---------------------------------------------------------------------------
// Shelter in rain

export type ShelterKind = "cover" | "roost" | "hunker" | "none";

/** What the shelter rule reads of a species' behaviour profile (`behaviour-profile.ts`). */
export type ShelterProfile = {
    move: string;
    roost: string;
    social: string;
    size: number | null;
    seabed?: boolean;
};

const WATER_ROOSTS = new Set(["water", "bottom", "reef"]);
/** Roosts that are themselves cover: it goes home in the rain. */
const COVER_ROOSTS = new Set(["tree", "tree_hole", "cave", "crevice", "burrow", "den", "nest", "reeds", "ground_cover", "rocks", "cliff"]);
/** Plans that like the wet, or live in it: they stay out (frogs and snails come out after rain). */
const WET_PLANS = new Set(["frog", "amphibian", "fish", "ray", "cetacean", "jellyfish", "cephalopod", "worm", "sessile"]);

/**
 * How a species sits out the rain: big herd grazers hunker in the open, back
 * to the wind; animals with a sheltered roost go to it; the rest go under a
 * tree near home; water animals, frogs and the like stay as they are.
 */
export function shelterKind(profile: ShelterProfile | null | undefined, plan: string | null | undefined, inWater = false): ShelterKind {
    if (!profile || inWater) return "none";
    if (WET_PLANS.has(plan ?? "")) return "none";
    if (profile.move === "swim" || profile.move === "sessile" || profile.seabed || WATER_ROOSTS.has(profile.roost)) return "none";
    const size = profile.size ?? 40;
    if (size >= 62 && (profile.social === "herd" || profile.social === "group" || profile.move === "walk")) return "hunker";
    if (COVER_ROOSTS.has(profile.roost)) return "roost";
    return size >= 75 ? "hunker" : "cover";
}

/** Seconds after the weather turns before it goes (or comes out): seeded, 4–44 s, so a herd never moves at once. */
export function shelterDelayMs(id: string): number {
    return Math.round((4 + 40 * unit(id, "shelter-delay")) * 1000);
}

/** Its walking pace to shelter (m/s), from its drawn length: never a sprint. */
export function shelterPace(length: number): number {
    return Math.min(Math.max(length * 0.9, 0.45), 2.2);
}

export type ShelterNow = {
    /** 0 out in the open (its schedule's pose) … 1 at its shelter. */
    level: number;
    /** Walking to it (or back) right now. */
    moving: boolean;
    /** Going in (true) or coming out (false). */
    going: boolean;
    /** When it set off (ms): the start of the walk in, or out. */
    since: number;
    /** While coming out: when it went in (ms). */
    wentIn: number;
};

/**
 * Where an animal is between the open and its shelter at `ms`: the shared
 * answer `flips` (seek cover or not) shifted by its own delay, then walked at
 * its pace over `travelMs`.
 */
export function shelterAt(flips: Pick<WeatherFlips, "stateAt">, id: string, ms: number, travelMs: number): ShelterNow {
    const delay = shelterDelayMs(id);
    const state = flips.stateAt(ms - delay);
    const since = state.since + delay;
    const walk = Math.max(travelMs, 1);
    const t = since === -Infinity ? 1 : clamp01((ms - since) / walk);
    if (state.on) return {level: t, moving: t < 1, going: true, since, wentIn: since};
    return {level: 1 - t, moving: t < 1 && t > 0, going: false, since, wentIn: state.before + delay};
}

/** The heading that keeps its back to the wind (`windDirection`: where the wind blows toward), with a seeded few degrees. */
export function backToWindYaw(id: string, windDirection: number): number {
    return yawToward(Math.cos(windDirection), Math.sin(windDirection)) + (unit(id, "wind-yaw") - 0.5) * 0.6;
}

export type CoverPoint = {x: number; z: number; nx: number; nz: number; id?: string};

/**
 * Its cover: one of the trunks nearest its home (seeded among the closest
 * three, so a herd spreads over a stand of trees), on the trunk's outward
 * side, a little more than a body length from the bark. Null: no tree within
 * reach (it hunkers instead).
 */
export function coverSpot(id: string, home: {x: number; z: number}, length: number, trunks: CoverPoint[], reach: number): {x: number; z: number} | null {
    const near = trunks
        .map((p) => ({p, d: Math.hypot(p.x - home.x, p.z - home.z)}))
        .filter((c) => c.d <= reach)
        .sort((a, b) => a.d - b.d || ((a.p.id ?? "") < (b.p.id ?? "") ? -1 : 1))
        .slice(0, 3);
    if (!near.length) return null;
    const chosen = near[hash32(id, "cover") % near.length].p;
    const nl = Math.hypot(chosen.nx, chosen.nz) || 1;
    const out = 0.35 + length * 0.75;
    const side = (unit(id, "cover-side") - 0.5) * 1.6;
    const ox = (chosen.nx / nl) * out;
    const oz = (chosen.nz / nl) * out;
    // Round the trunk a little either way, so two under one tree stand apart.
    return {x: chosen.x + ox * Math.cos(side) - oz * Math.sin(side), z: chosen.z + ox * Math.sin(side) + oz * Math.cos(side)};
}

// ---------------------------------------------------------------------------
// Young at heel

/**
 * Its parent: an adult of its kind in its own cluster (the server places the
 * young with their parents), else anywhere in its zone; seeded by its id, so
 * every viewer agrees. The snapshot carries no parents, so this is the
 * scene's pick, not a record.
 */
export function pickParent(young: {id: string; slot?: number | null; zone: string}, adults: Array<{id: string; slot?: number | null; zone: string}>): string | null {
    const sameSlot = adults.filter((a) => a.id !== young.id && a.zone === young.zone && young.slot != null && a.slot === young.slot).map((a) => a.id).sort();
    const pool = sameSlot.length ? sameSlot : adults.filter((a) => a.id !== young.id && a.zone === young.zone).map((a) => a.id).sort();
    if (!pool.length) return null;
    return pool[hash32(young.id, "parent") % pool.length];
}

export type HeelPose = {x: number; z: number; lift: number; yaw: number; playing: boolean; /** Moving on its own (a dash), apart from its parent's walking. */ moving: boolean};

/** The fastest a young one turns (rad/s): small ones quicker, big ones slower (a foal about 2 rad/s). */
export function youngTurnRate(length: number): number {
    return Math.min(Math.max(2.2 / Math.sqrt(Math.max(length, 0.05)), 1), 4.5);
}

/** Play bursts: at most one in each of these windows (ms); a dash only in every `DASH_EVERY`th. */
export const PLAY_SLOT_MS = 25_000;
const DASH_EVERY = 4;

type Burst = {slot: number; start: number; dashMs: number; end: number};

/**
 * Young at play (owner, 2026-11-11: no going round in circles): a short dash
 * ahead of its parent on its own side (never more than about 35 degrees off
 * her heading, turned into at its body's turn rate), a pause with a kick or
 * two, and then it stands there facing her way while she walks back up past
 * it; while she hasn't, a later burst is kicks on the spot. So it never
 * orbits her and never turns about in a burst: an out-and-back run facing
 * its way would turn a full circle. Pure: seeded per window, and where its
 * parent was at past moments (`parentAt`, her shared schedule).
 */
function playBurst(youngId: string, slot: number, play: number, dashMs: number): Burst | null {
    const chance = Math.min(0.2 + 0.45 * play, 0.6);
    if (play <= 0.05 || unit(youngId, "play", slot) >= chance) return null;
    const start = slot * PLAY_SLOT_MS + 2_000 + unit(youngId, "play-at", slot) * 9_000;
    return {slot, start, dashMs, end: start + dashMs + 1_200 + unit(youngId, "play-kick", slot) * 1_800};
}

/**
 * Where a young one is beside its parent: at heel (behind her shoulder on its
 * own seeded side), riding on her back when carried, and in a play burst
 * dashing ahead, kicking and waiting for her (see `playBurst`). The parent's
 * pose a moment earlier is passed in (the young trail it); `parentAt` gives
 * where she was at an earlier moment (null: as now).
 */
export function heelPose(
    youngId: string,
    parent: {x: number; z: number; yaw: number; length: number; height: number},
    follow: {distance: number; carried: boolean},
    play: number,
    ms: number,
    parentAt: ((ms: number) => {x: number; z: number} | null) | null = null
): HeelPose {
    const fx = Math.sin(parent.yaw);
    const fz = Math.cos(parent.yaw);
    const rx = Math.cos(parent.yaw);
    const rz = -Math.sin(parent.yaw);
    const at = (right: number, forward: number) => ({x: parent.x + rx * right + fx * forward, z: parent.z + rz * right + fz * forward});
    if (follow.carried) {
        // On the back, a little behind the shoulders.
        const p = at(0, -parent.length * 0.08);
        return {...p, lift: parent.height * 0.82, yaw: parent.yaw, playing: false, moving: false};
    }
    const side = hash32(youngId, "heel-side") % 2 ? 1 : -1;
    const d = Math.max(follow.distance, 0.4) * parent.length;
    // At heel: behind the shoulder, 35-60 degrees off her tail, on its own side.
    const theta = 0.6 + 0.45 * unit(youngId, "heel-angle");
    const heel = {r: side * d * Math.sin(theta), f: -d * Math.cos(theta)};
    // Its play spot: ahead of her shoulder on the same side (a dash within about 35 degrees of her heading).
    const ahead = {r: heel.r + side * parent.length * 0.25 * unit(youngId, "play-out"), f: parent.length * (0.8 + 0.5 * unit(youngId, "play-ahead"))};
    const span = Math.hypot(ahead.r - heel.r, ahead.f - heel.f);
    const dashYaw = Math.atan2(ahead.r - heel.r, ahead.f - heel.f);
    const youngLength = parent.length * 0.6;
    const dashMs = (span / Math.min(Math.max(youngLength * 2.4, 1.2), 4)) * 1000;
    const turnMs = (Math.abs(dashYaw) / youngTurnRate(youngLength)) * 1000;
    const here = (k: number) => at(heel.r + (ahead.r - heel.r) * k, heel.f + (ahead.f - heel.f) * k);

    // A dash can start only in every fourth window (one chance a 100 s); the bursts between are kicks on the spot. So where
    // it is depends only on its latest dash and how far she has walked since: no chain of earlier bursts to agree on.
    const now = Math.floor(ms / PLAY_SLOT_MS);
    let lastDash: Burst | null = null;
    for (let slot = now - (((now % DASH_EVERY) + DASH_EVERY) % DASH_EVERY); slot >= now - 2 * DASH_EVERY && !lastDash; slot -= DASH_EVERY) {
        const b = playBurst(youngId, slot, play, dashMs);
        if (b && b.start <= ms) lastDash = b;
    }
    let kick: Burst | null = null;
    for (let slot = now; slot >= now - 1 && !kick; slot--) {
        if (((slot % DASH_EVERY) + DASH_EVERY) % DASH_EVERY === 0) continue;
        const b = playBurst(youngId, slot, play, dashMs);
        if (b && b.start <= ms && ms < b.end) kick = b;
    }
    // How far it has come back to heel after a dash: as far as she has walked up (her shared schedule), and in any case
    // creeping back between 50 and 80 s after (before the next dash can start).
    const backAfter = (b: Burst) => {
        let walked = Infinity;
        if (parentAt) {
            const then = parentAt(b.end);
            walked = then ? Math.hypot(parent.x - then.x, parent.z - then.z) : Infinity;
        }
        const creep = Math.min(Math.max((ms - b.end - 50_000) / 30_000, 0), 1);
        return Math.min(Math.max(walked / span, creep * creep * (3 - 2 * creep)), 1);
    };
    const turnTo = (target: number, sinceMs: number) => target * Math.min(Math.max(sinceMs / Math.max(turnMs, 1), 0), 1);
    const kicks = (sinceMs: number, lengthMs: number) => {
        const k = Math.min(Math.max(sinceMs / lengthMs, 0), 1);
        // One or two kicks: a quick hop each.
        const hops = 1 + (hash32(youngId, "hops", now) % 2);
        return Math.max(Math.sin(Math.PI * k * hops), 0) * 0.07 * parent.length * Math.sin(Math.PI * k);
    };
    if (lastDash && ms < lastDash.end) {
        const b = lastDash;
        const t = ms - b.start;
        if (t < b.dashMs) {
            // The dash: turned into at its rate, eased off at the end; facing the way it goes.
            const k = t / b.dashMs;
            const p = here(k * k * (3 - 2 * k));
            return {...p, lift: 0, yaw: parent.yaw + turnTo(dashYaw, t), playing: true, moving: true};
        }
        // The kick, turning back to her heading at its rate.
        const since = t - b.dashMs;
        const p = here(1);
        return {...p, lift: kicks(since, b.end - b.start - b.dashMs), yaw: parent.yaw + dashYaw - turnTo(dashYaw, since), playing: true, moving: false};
    }
    // Ahead of her after a dash, facing her way, until she walks up past it; kicks on the spot meanwhile. If she does not
    // (asleep, say), it walks back to her heel between 50 and 80 s after, facing the way it goes while that creep is what
    // brings it back: turned to it and back to her heading at its rate (from the moments before, so nothing snaps when
    // she walks up after all). (2026-11-12: it slid back to heel facing her way, a foal backwards for 7 s in the default
    // view.)
    const back = lastDash ? backAfter(lastDash) : 1;
    const p = here(1 - back);
    const lift = kick ? kicks(ms - kick.start, kick.end - kick.start) : 0;
    const homeward = Math.atan2(heel.r - ahead.r, heel.f - ahead.f);
    const turnMsBack = Math.max((Math.abs(homeward) / youngTurnRate(youngLength)) * 1000, 1);
    const creepStart = lastDash ? lastDash.end + 50_000 : Infinity;
    const then = lastDash && parentAt && ms > creepStart && ms < creepStart + 30_000 + 2 * turnMsBack ? parentAt(lastDash.end) : null;
    if (then && parentAt) {
        // Its own creep at a moment (0 or 1): the creep, not her walking up, bringing it back.
        const own = (t: number, mother: {x: number; z: number} | null) => {
            if (t < creepStart || t >= creepStart + 30_000 || !mother) return 0;
            const c = (t - creepStart) / 30_000;
            return c * c * (3 - 2 * c) > Math.hypot(mother.x - then.x, mother.z - then.z) / span ? 1 : 0;
        };
        // How far turned to its way home: following `own` at its turn rate over the last two turns' time, on a fixed grid
        // of moments (the same for every frame and viewer), and read between the grid moments either side of now (so it
        // turns no faster than its rate). Where she has not moved over that time, as she is now (the grid moment just
        // after now is asked all the same: she may set off).
        const step = 150;
        const g = Math.floor(ms / step) * step;
        const t0 = g - Math.ceil((2 * turnMsBack) / step) * step;
        const first = parentAt(t0);
        const still = first !== null && Math.hypot(first.x - parent.x, first.z - parent.z) < 1e-3;
        let w = own(t0, first);
        let before = w;
        for (let t = t0 + step; t <= g + step; t += step) {
            before = w;
            w += Math.min(Math.max(own(t, still && t <= ms ? parent : parentAt(t)) - w, -step / turnMsBack), step / turnMsBack);
        }
        const share = before + (w - before) * ((ms - g) / step);
        if (share > 0) return {...p, lift, yaw: parent.yaw + homeward * share, playing: Boolean(kick), moving: own(ms, parent) === 1};
    }
    return {...p, lift, yaw: parent.yaw, playing: Boolean(kick), moving: false};
}


/** How long the young trail their parent (s): a moment, so they follow its turns rather than mirror them. */
export const HEEL_LAG_SECONDS = 0.6;

// ---------------------------------------------------------------------------
// Tide

/** A water animal's base fitted to a surface at `seaLevel` instead of 0: the column moves with the tide; its floor does not. */
export function tideFit<S extends {floorY: number; surface?: number}>(spec: S, height: number, seaLevel: number, fit: (spec: S, height: number) => {base: number; middle: number}): {base: number; middle: number} {
    // (A column with a surface of its own, a lake or a river above the sea on the bigger wild island: the tide never moves it.)
    if (!seaLevel || spec.surface) return fit(spec, height);
    const shifted = fit({...spec, floorY: spec.floorY - seaLevel}, height);
    return {base: shifted.base + seaLevel, middle: shifted.middle + seaLevel};
}

/**
 * A land animal on ground the tide has covered: moved up the beach (along the
 * ground's rise, at most `maxShift` m) until it stands at least `clear` m
 * above the water. Pure: the same heights, the same sea, the same spot.
 */
export function aboveTide(x: number, z: number, seaLevel: number, heightAt: (x: number, z: number) => number, clear = 0.04, maxShift = 6): {x: number; z: number; ground: number; moved: boolean} {
    const ground = heightAt(x, z);
    if (ground >= seaLevel + clear) return {x, z, ground, moved: false};
    let cx = x;
    let cz = z;
    let g = ground;
    const step = 0.5;
    for (let travelled = 0; travelled < maxShift && g < seaLevel + clear; travelled += step) {
        const e = 0.4;
        const gx = heightAt(cx + e, cz) - heightAt(cx - e, cz);
        const gz = heightAt(cx, cz + e) - heightAt(cx, cz - e);
        const n = Math.hypot(gx, gz);
        // Flat (a bar in the sea): straight in toward the island's middle.
        const ux = n > 1e-5 ? gx / n : -cx / (Math.hypot(cx, cz) || 1);
        const uz = n > 1e-5 ? gz / n : -cz / (Math.hypot(cx, cz) || 1);
        cx += ux * step;
        cz += uz * step;
        g = heightAt(cx, cz);
    }
    return {x: cx, z: cz, ground: g, moved: true};
}

// ---------------------------------------------------------------------------
// Calls you can see: the head comes up while it calls

/** 0…1 how far into a call's lift it is (up fast, down slow), `ms` after the call began, for a call `durationMs` long. */
export function callLift(sinceMs: number, durationMs: number): number {
    if (sinceMs < 0) return 0;
    const up = 180;
    const hold = Math.max(durationMs, 300);
    if (sinceMs < up) return ease(sinceMs / up);
    if (sinceMs < up + hold) return 1;
    return 1 - ease((sinceMs - up - hold) / 500);
}

// ---------------------------------------------------------------------------
// Worn paths

/**
 * Where animals keep walking the same way: every animal's recent route
 * (points sampled from its shared schedule), binned into `cell`-metre cells;
 * a cell crossed at least `min` times (one animal over and over, or several)
 * is worn. Strength 0…1 by how often. Pure: the same routes, the same paths.
 */
export function wornPatches(routes: Array<Array<{x: number; z: number}>>, cell = 1.1, min = 4): Array<{x: number; z: number; count: number; strength: number}> {
    const cells = new Map<string, {x: number; z: number; count: number}>();
    for (const route of routes) {
        // A cell counts once per visit (not once per sample while it stands there).
        let last = "";
        for (const p of route) {
            const ix = Math.floor(p.x / cell);
            const iz = Math.floor(p.z / cell);
            const key = `${ix},${iz}`;
            if (key === last) continue;
            last = key;
            const at = cells.get(key) ?? {x: (ix + 0.5) * cell, z: (iz + 0.5) * cell, count: 0};
            at.count++;
            cells.set(key, at);
        }
    }
    return Array.from(cells.values())
        .filter((c) => c.count >= min)
        .sort((a, b) => b.count - a.count || a.x - b.x || a.z - b.z)
        .map((c) => ({...c, strength: Math.min(0.12 + 0.05 * (c.count - min), 0.38)}));
}
