/**
 * Crossing between islands as a controlled animal (design §12.2–12.4).
 *
 * Only strong flyers and sea-capable swimmers cross; everyone else ends control at the shore. A crossing starts inside
 * the departure band after a server pre-check (not a zoo or kept animal, the right move, stamina ≥ the need + 10
 * points, exposure under 0.6, time left in the session and the day). In the strait the controller's poses are in
 * corridor coordinates (`x` = progress s ∈ [0, L], `z` = lateral l, `y` = height over the sea or, negative, depth),
 * the mode fixed. Halfway is the commit point: before it the animal may turn back; after it only lateral steering.
 * Under 10 % stamina the server takes over and brings it to the nearer shore at half its cruise (no death, D6).
 *
 * Pure.
 */

import type {Abilities} from "@/ark-live/species";
import type {Strait} from "@/ark-live/islands";
import {suitability, type AnimalHome} from "@/ark-live/habitat";
import {DRAIN_PER_S} from "@/ark-live/meters";
import type {AnimalFacts} from "@/ark-live/rules";

export const CROSS_STAMINA_MARGIN = 0.1;
export const MIN_PROGRESS_SHARE = 0.3;
export const PROGRESS_WINDOW_MS = 5000;
export const RESCUE_STAMINA = 0.1;
export const ARRIVAL_HOLD_MS = 30_000;
export const FLY_HEIGHT = {min: 0.3, max: 42} as const;
export const SWIM_DEPTH_MAX = 30;

export type CrossingKind = "air" | "swim";

/** A flyer's share of gliding over open sea (est., from its height band; design §12.2). */
export function glideShare(a: Abilities): number {
    return a.altitude === "high" ? 1 : a.altitude === "mid" ? 0.3 : 0.15;
}

export type CrossingNeed = {kind: CrossingKind; cruise: number; seconds: number; drainPerS: number; s: number; need: number};

/** What a crossing would take, by flight or by swimming (null when it has neither). */
export function crossingNeed(a: Abilities, home: AnimalHome, strait: Strait, prefer: CrossingKind | null = null): CrossingNeed | null {
    const s = suitability(a, home, null, {openSea: true}).s;
    const options: CrossingNeed[] = [];
    if (a.canFly && a.fly > 0) {
        const cruise = 0.8 * a.fly;
        const share = glideShare(a);
        const drainPerS = (share * DRAIN_PER_S.glide + (1 - share) * DRAIN_PER_S.flap) * (1 + 2 * (1 - s));
        const seconds = strait.length / cruise;
        options.push({kind: "air", cruise, seconds, drainPerS, s, need: drainPerS * seconds});
    }
    if (a.canSwim && a.swim > 0) {
        const cruise = 0.8 * a.swim;
        const drainPerS = DRAIN_PER_S.swim * (1 + 2 * (1 - s));
        const seconds = strait.length / cruise;
        options.push({kind: "swim", cruise, seconds, drainPerS, s, need: drainPerS * seconds});
    }
    if (!options.length) return null;
    if (prefer) return options.find((o) => o.kind === prefer) ?? null;
    return options.sort((x, y) => x.need - y.need)[0];
}

export type PreCheckReason = "zoo" | "kept" | "sessile" | "cant" | "salt" | "tired" | "exposed" | "time" | "band";

/** Where a point is against the departure band: its fraction along the band, and how far offshore (m). */
export function departureFraction(strait: Strait, x: number, z: number): {f: number; offshore: number; along: number} {
    const bx = strait.a1.x - strait.a0.x;
    const bz = strait.a1.z - strait.a0.z;
    const len2 = bx * bx + bz * bz;
    const f = len2 > 0 ? ((x - strait.a0.x) * bx + (z - strait.a0.z) * bz) / len2 : 0;
    const offshore = (x - strait.a0.x) * strait.out.x + (z - strait.a0.z) * strait.out.z;
    return {f, offshore, along: f * Math.sqrt(len2)};
}

export function preCheck(input: {
    a: Abilities;
    facts: AnimalFacts;
    home: AnimalHome;
    strait: Strait;
    stamina: number;
    exposure: number;
    sessionLeft: number;
    dayLeft: number;
    x: number;
    z: number;
    kind: CrossingKind | null;
}): {ok: true; need: CrossingNeed; f: number} | {ok: false; reason: PreCheckReason} {
    const {a, facts, strait} = input;
    if (facts.enclosure !== null) return {ok: false, reason: "zoo"};
    // Kept animals stay home (DECISIONS #9: pets that fly don't cross; #10: farm animals are fenced).
    if (facts.area === "house" || facts.area === "farm") return {ok: false, reason: "kept"};
    if (a.sessile) return {ok: false, reason: "sessile"};
    const need = crossingNeed(a, input.home, strait, input.kind);
    if (!need) return {ok: false, reason: "cant"};
    if (need.kind === "swim" && need.s < 0.3) return {ok: false, reason: "salt"};
    if (input.stamina < need.need + CROSS_STAMINA_MARGIN) return {ok: false, reason: "tired"};
    if (input.exposure >= 0.6) return {ok: false, reason: "exposed"};
    if (input.sessionLeft < need.seconds || input.dayLeft < need.seconds + 120) return {ok: false, reason: "time"};
    const band = departureFraction(strait, input.x, input.z);
    if (band.f < 0 || band.f > 1 || band.offshore < -2 || band.offshore > strait.bandReach) return {ok: false, reason: "band"};
    return {ok: true, need, f: band.f};
}

/** Corridor coordinates to a point on either island (for its watchers): `side` "from" or "to". */
export function corridorToIsland(strait: Strait, f: number, s: number, l: number, side: "from" | "to"): {x: number; z: number; yaw: number} {
    if (side === "from") {
        const ox = strait.a0.x + (strait.a1.x - strait.a0.x) * f;
        const oz = strait.a0.z + (strait.a1.z - strait.a0.z) * f;
        // Lateral is to the right of the way out.
        const rx = strait.out.z;
        const rz = -strait.out.x;
        return {x: ox + strait.out.x * s + rx * l, z: oz + strait.out.z * s + rz * l, yaw: Math.atan2(strait.out.x, strait.out.z)};
    }
    const ox = strait.b0.x + (strait.b1.x - strait.b0.x) * f;
    const oz = strait.b0.z + (strait.b1.z - strait.b0.z) * f;
    const rx = strait.into.z;
    const rz = -strait.into.x;
    const back = strait.length - s;
    return {x: ox - strait.into.x * back + rx * l, z: oz - strait.into.z * back + rz * l, yaw: Math.atan2(strait.into.x, strait.into.z)};
}

/** Where it comes ashore on the far island (just inside its arrival band). */
export function arrivalPoint(strait: Strait, f: number, l = 0): {x: number; z: number} {
    const p = corridorToIsland(strait, f, strait.length, l, "to");
    return {x: p.x, z: p.z};
}

export type Crossing = {
    strait: Strait;
    kind: CrossingKind;
    need: CrossingNeed;
    /** Fraction along the bands where it set off. */
    f: number;
    startedAt: number;
    s: number;
    l: number;
    h: number;
    committed: boolean;
    /** Progress samples for the minimum-progress rule. */
    progress: Array<{at: number; s: number}>;
    /** The server has taken over (under 10 % stamina): toward the nearer shore. */
    rescue: "back" | "on" | null;
    arrivedAt: number | null;
};

export function startCrossing(strait: Strait, need: CrossingNeed, f: number, now: number): Crossing {
    return {strait, kind: need.kind, need, f, startedAt: now, s: 0, l: 0, h: need.kind === "air" ? 6 : -2, committed: false, progress: [{at: now, s: 0}], rescue: null, arrivedAt: null};
}

export type CrossingVerdict = {ok: true} | {ok: false; reason: "speed" | "bounds" | "altitude" | "depth" | "turn" | "stall"};

/** Check one corridor pose (`x` = s, `z` = l, `y` = height or −depth) and advance the crossing. Mutates `c`. */
export function crossingStep(c: Crossing, a: Abilities, next: {s: number; l: number; h: number}, dt: number, now: number): CrossingVerdict {
    const cap = (c.kind === "air" ? a.fly : a.swim) * 1.15;
    const ds = next.s - c.s;
    const dl = next.l - c.l;
    if (Math.hypot(ds, dl) > cap * Math.max(dt, 0.05) + 0.1) return {ok: false, reason: "speed"};
    if (Math.abs(next.l) > c.strait.halfWidth) return {ok: false, reason: "bounds"};
    if (c.kind === "air" && (next.h < FLY_HEIGHT.min - 0.1 || next.h > FLY_HEIGHT.max)) return {ok: false, reason: "altitude"};
    if (c.kind === "swim" && (next.h > 0.3 || -next.h > Math.min(SWIM_DEPTH_MAX, c.strait.depth))) return {ok: false, reason: "depth"};
    if (c.committed && ds < -0.05) return {ok: false, reason: "turn"};
    if (next.s < -1 || next.s > c.strait.length + 1) return {ok: false, reason: "bounds"};
    // At least 0.3 × cruise over each 5 s (no parking at sea): a swimmer at home in the sea may rest at the surface.
    c.progress = c.progress.filter((p) => now - p.at <= PROGRESS_WINDOW_MS);
    const oldest = c.progress[0];
    const restsAtSea = c.kind === "swim" && c.need.s >= 1 && next.h > -0.5;
    if (!restsAtSea && oldest && now - oldest.at >= PROGRESS_WINDOW_MS - 50) {
        const made = Math.abs(next.s - oldest.s);
        if (made < MIN_PROGRESS_SHARE * c.need.cruise * ((now - oldest.at) / 1000) * 0.9) return {ok: false, reason: "stall"};
    }
    c.progress.push({at: now, s: next.s});
    c.s = next.s;
    c.l = next.l;
    c.h = next.h;
    if (!c.committed && c.s >= c.strait.length / 2) c.committed = true;
    return {ok: true};
}

/** The server's own step while it has taken over: toward the nearer shore at half its cruise. */
export function rescueStep(c: Crossing, dt: number): void {
    if (!c.rescue) c.rescue = c.s >= c.strait.length / 2 ? "on" : "back";
    const v = c.need.cruise * 0.5;
    c.s = c.rescue === "on" ? Math.min(c.strait.length, c.s + v * dt) : Math.max(0, c.s - v * dt);
    c.l *= 0.98;
    if (c.kind === "air") c.h = Math.max(c.h, 2);
    else c.h = Math.min(c.h, -0.3);
}

export function crossingDone(c: Crossing): "arrived" | "returned" | null {
    if (c.s >= c.strait.length) return "arrived";
    if (c.rescue === "back" && c.s <= 0) return "returned";
    return null;
}
