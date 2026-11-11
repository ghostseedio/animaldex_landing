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
        for (let k = 0; k < steps && found.length < 2; k++) {
            const i = index - k - 1;
            if (this.at(i) !== this.at(i + 1)) found.push(this.flipIn(i));
        }
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

export type HeelPose = {x: number; z: number; lift: number; yaw: number; playing: boolean};

/**
 * Where a young one is beside its parent: at heel (behind and to one side, a
 * seeded side), riding on its back when carried, and in a play burst
 * scampering in a loop round it with small hops. The parent's pose a moment
 * earlier is passed in (the young trail it).
 */
export function heelPose(
    youngId: string,
    parent: {x: number; z: number; yaw: number; length: number; height: number},
    follow: {distance: number; carried: boolean},
    play: number,
    ms: number
): HeelPose {
    if (follow.carried) {
        // On the back, a little behind the shoulders.
        const back = parent.length * 0.08;
        return {x: parent.x - Math.sin(parent.yaw) * back, z: parent.z - Math.cos(parent.yaw) * back, lift: parent.height * 0.82, yaw: parent.yaw, playing: false};
    }
    const side = hash32(youngId, "heel-side") % 2 ? 1 : -1;
    const d = Math.max(follow.distance, 0.4) * parent.length;
    // Behind the shoulder: 35–60° off its tail, on its own side.
    const angle = parent.yaw + Math.PI - side * (0.6 + 0.45 * unit(youngId, "heel-angle"));
    let x = parent.x + Math.sin(angle) * d;
    let z = parent.z + Math.cos(angle) * d;
    let yaw = parent.yaw;
    let lift = 0;
    let playing = false;
    // Play: bursts in 20 s windows, more the younger it is; a loop round the parent, hopping.
    if (play > 0.05) {
        const windowMs = 20_000;
        const slot = Math.floor(ms / windowMs);
        const chance = Math.min(play * 0.7, 0.75);
        if (unit(youngId, "play", slot) < chance) {
            const start = slot * windowMs + unit(youngId, "play-at", slot) * windowMs * 0.5;
            const length = 4_000 + unit(youngId, "play-len", slot) * 5_000;
            const k = (ms - start) / length;
            if (k > 0 && k < 1) {
                playing = true;
                const swing = Math.sin(Math.PI * k);
                const turn = k * Math.PI * 2 * (hash32(youngId, "play-dir", slot) % 2 ? 1 : -1);
                const r = d * (1 + 0.9 * swing);
                const a = angle + turn;
                x = parent.x + Math.sin(a) * r;
                z = parent.z + Math.cos(a) * r;
                yaw = a + (turn >= 0 ? Math.PI / 2 : -Math.PI / 2);
                lift = Math.abs(Math.sin(k * Math.PI * 9)) * 0.06 * parent.length * swing;
            }
        }
    }
    return {x, z, lift, yaw, playing};
}

/** How long the young trail their parent (s): a moment, so they follow its turns rather than mirror them. */
export const HEEL_LAG_SECONDS = 0.6;

// ---------------------------------------------------------------------------
// Tide

/** A water animal's base fitted to a surface at `seaLevel` instead of 0: the column moves with the tide; its floor does not. */
export function tideFit<S extends {floorY: number}>(spec: S, height: number, seaLevel: number, fit: (spec: S, height: number) => {base: number; middle: number}): {base: number; middle: number} {
    if (!seaLevel) return fit(spec, height);
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
