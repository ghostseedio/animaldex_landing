/**
 * Shaking off the water (owner 2026-11-16: "animals like geese who normally shake upon getting out of the water - can
 * we do that"). When the shared schedule brings an animal up out of the water (a swim leg, then its climb out, then
 * its "after" beat on the bank: `behaviour-schedule.ts`), a species that really shakes does so: a goose, a duck or a
 * swan shakes its body and then flaps its wings with its head stretched up, before it preens; an otter, a Labrador, a
 * polar bear shakes from its head to its tail. A bath's own shake (a recipe's `shake_off` step) is drawn the same way.
 *
 * Which species: `water-shake.json`, built by rule from stored data (scripts/ark-water-shake.mts says the rule and its
 * sources), never by hand. Every other species keeps what its crossing does today (a seal lies, a penguin preens).
 *
 * Pure in the trip and the world's clock, so every viewer sees the same shake at the same moment, near or far.
 * Visual only: the body rolls in the instance shader (`SHAKE_VERTEX`, from `arkInstance.w`, as the defence moves do:
 * no new attribute, no new draw call), droplets fly from the recipe layer's points (`recipe-scene.ts`, off on the low
 * tier), and it eases back to the schedule's pose. With reduced motion there is no shake at all.
 */

import table from "@/ark-scene/water-shake.json";

export type ShakeSpec = {
    /** Waterfowl: a wing flap with the head stretched up after the body shake. */
    wings: boolean;
};

const SPECS = new Map<string, ShakeSpec>(Object.entries((table as {species: Record<string, string[]>}).species).map(([slug, [kind]]) => [slug, {wings: kind === "w"}]));

/** The log's sentence (English first, decision 374): said while the shake is in view. */
export const SHAKE_LINE: string = (table as {line: string}).line;

export function waterShakeOf(slug: string | null | undefined): ShakeSpec | null {
    return (slug && SPECS.get(slug)) || null;
}

export function waterShakeSpecies(): string[] {
    return Array.from(SPECS.keys());
}

/** A moment on the bank before it starts (it has just found its feet). */
export const SHAKE_DELAY = 0.2;

/**
 * The body shake's length (s) by body size: 0.6 s for a duck or a rakali, up to 1.2 s for a polar bear or a swan (a
 * big body swings slower and longer).
 */
export function shakeSeconds(length: number): number {
    return Math.min(Math.max(0.5 + 0.35 * Math.max(length, 0), 0.6), 1.2);
}

/** Its swings a second: a small body faster (about 5 a second for a duck, 3 for a bear). */
export function shakeRate(length: number): number {
    return Math.min(Math.max(5.6 - 1.2 * Math.max(length, 0), 3), 5.5);
}

/** The wing flap after it (waterfowl): three beats with the head up. */
export const FLAP_SECONDS = 1;
const FLAP_RATE = 3;

/** The whole of it (s): the wait, the shake, the flap. */
export function shakeTotal(spec: ShakeSpec, length: number): number {
    return SHAKE_DELAY + shakeSeconds(length) + (spec.wings ? FLAP_SECONDS : 0);
}

/**
 * The shake now: the body's swing (0–1 of its reach, eased in and out) and its phase (radians), the wings' flap the
 * same, and the body's pitch (a bird rears up to flap). All zero outside it. `t`: seconds since it came out.
 */
export type ShakeNow = {body: number; bodyPhase: number; wings: number; wingPhase: number; pitch: number};

export const SHAKE_NONE: ShakeNow = {body: 0, bodyPhase: 0, wings: 0, wingPhase: 0, pitch: 0};

/** In over its first fifth, out over its last quarter, smoothly (it eases back to the schedule's pose). */
function bump(u: number): number {
    if (u <= 0 || u >= 1) return 0;
    const k = Math.min(u / 0.22, 1, (1 - u) / 0.28);
    return k * k * (3 - 2 * k);
}

export function shakeAt(spec: ShakeSpec, length: number, t: number): ShakeNow {
    const body = shakeSeconds(length);
    const s = t - SHAKE_DELAY;
    if (s >= 0 && s < body) {
        const u = s / body;
        return {body: bump(u), bodyPhase: s * shakeRate(length) * Math.PI * 2, wings: 0, wingPhase: 0, pitch: 0};
    }
    const f = s - body;
    if (spec.wings && f >= 0 && f < FLAP_SECONDS) {
        const u = f / FLAP_SECONDS;
        // (Up onto its toes, breast out, head up: the body tips back while the wings beat; the beat starts up.)
        const k = bump(u);
        return {body: 0, bodyPhase: 0, wings: k, wingPhase: f * FLAP_RATE * Math.PI * 2 - Math.PI / 2, pitch: -0.32 * k};
    }
    return SHAKE_NONE;
}

/** A bath's shake (a recipe's `shake_off` step, `u` 0–1 through it): the body shake over the whole step. */
export function bathShakeAt(length: number, u: number, seconds: number): ShakeNow {
    if (u <= 0 || u >= 1) return SHAKE_NONE;
    return {body: bump(u), bodyPhase: u * seconds * shakeRate(length) * Math.PI * 2, wings: 0, wingPhase: 0, pitch: 0};
}

type LegLike = {mode: string; seconds: number; beat?: string};
type TripLike = {start: number; arrive?: number; legs: readonly LegLike[]; stay?: ReadonlyArray<{at: number; beat: string}>};

/** The shortest stand on the edge a shake is drawn in there (a trip squeezed into its slot has less: it shakes on arrival). */
const EDGE_LEAST = 0.8;

/** Its stand on the bank's edge to shake (a pause after the climb out): its start and length, or null. */
function edgeLeg(trip: TripLike): {t0: number; seconds: number} | null {
    let t0 = trip.start;
    for (let i = 0; i < trip.legs.length; i++) {
        const leg = trip.legs[i];
        if (leg.mode === "pause" && leg.beat === "shake" && trip.legs[i - 1]?.mode === "exit") return leg.seconds >= EDGE_LEAST ? {t0, seconds: leg.seconds} : null;
        t0 += leg.seconds;
    }
    return null;
}

/**
 * Seconds into its shake, just out of the water: on the first spot of land (the pause the schedule puts straight after
 * a climb out for a species on the list; `total`: the shake's own length, fitted into a shorter stand), or else as it
 * arrives (where the edge is still in the water, a canal's wall, or the stand was squeezed). Null at any other time.
 */
export function sinceOutOfWater(trip: TripLike, epoch: number, total = 0): number | null {
    const edge = edgeLeg(trip);
    if (edge) return epoch >= edge.t0 && epoch < edge.t0 + edge.seconds ? (epoch - edge.t0) * Math.max(total / edge.seconds, 1) : null;
    const t0 = shakeStartOf(trip);
    if (t0 === null || epoch < t0) return null;
    return epoch < (trip.stay?.[1]?.at ?? Infinity) + (trip.arrive ?? 0) ? epoch - t0 : null;
}

/** When its shake begins (world seconds), or null on a trip that does not climb out of the water. */
export function shakeStartOf(trip: TripLike): number | null {
    const edge = edgeLeg(trip);
    if (edge) return edge.t0;
    return trip.arrive !== undefined && trip.legs.some((leg) => leg.mode === "exit") && trip.stay?.[0]?.beat === "shake" ? trip.arrive : null;
}

/** The seconds after it arrives that its shake takes, when it shakes on arrival (0 otherwise): its stay's episodes wait for it. */
export function shakeOnArrival(trip: TripLike, spec: ShakeSpec | null, length: number): number {
    return spec && !edgeLeg(trip) && shakeStartOf(trip) !== null ? shakeTotal(spec, length) : 0;
}

// MARK: The shader's side

/** The shader's kinds in `arkInstance.w` (packed negative like `defence-moves.ts` packDefence; 1–8 are its own). */
export const SHAKE_KIND = {body: 10, wings: 11} as const;

/** This frame's shake for the shader: -(kind·65536 + phase·256 + amount), or 0 when there is none to draw. */
export function shakePack(now: ShakeNow): number {
    const q = (v: number) => Math.min(Math.max(Math.round(v), 0), 255);
    const wrap = (p: number) => ((p % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (now.body > 0.002) {
        const a = q(now.body * 255);
        return a ? -(SHAKE_KIND.body * 65536 + q((wrap(now.bodyPhase) / (Math.PI * 2)) * 256) * 256 + a) : 0;
    }
    if (now.wings > 0.002) {
        const a = q(now.wings * 255);
        return a ? -(SHAKE_KIND.wings * 65536 + q((wrap(now.wingPhase) / (Math.PI * 2)) * 256) * 256 + a) : 0;
    }
    return 0;
}

/**
 * After the defence moves in the vertex shader (`animal-material.ts`), in the model's space (z forward to the head, y
 * up), using their box (`arkDefBox`, `arkDefSpan`) and their unpacking (`arkDefenceOf`).
 *   - the body: each slice of it rolls about the body's long axis, the head first and the swing running back to the
 *     tail (a dog's shake), the legs below the belly left where they stand;
 *   - the wings (waterfowl): the folded wings at the sides lift up and out about the shoulders and beat, the head and
 *     neck stretched up.
 */
export const SHAKE_VERTEX = `
{
    vec3 arkSk = arkDefenceOf(arkInstance.w);
    if (arkSk.x > 9.5 && arkSk.x < 11.5) {
        float sz0 = arkDefBox.x;
        float sz1 = arkDefBox.y;
        float sy0 = arkDefBox.z;
        float sLen = max(sz1 - sz0, 0.001);
        float sHigh = max(arkDefBox.w - sy0, 0.001);
        float sAmt = arkSk.y;
        float sPh = arkSk.z / 256.0 * 6.28318;
        // (0 at the head, 1 at the tail; by the rest pose, so it stays on the body as a clip moves it.)
        float sAlong = clamp((sz1 - position.z) / sLen, 0.0, 1.0);
        float sUp = clamp((position.y - sy0) / sHigh, 0.0, 1.0);
        if (arkSk.x < 10.5) {
            float body = smoothstep(0.18, 0.5, sUp);
            float ang = 0.5 * sAmt * body * mix(1.2, 0.75, sAlong) * sin(sPh - sAlong * 2.6);
            float cy = sy0 + sHigh * 0.55;
            float dy = transformed.y - cy;
            float c = cos(ang);
            float s = sin(ang);
            float x0 = transformed.x;
            transformed.x = x0 * c - dy * s;
            transformed.y = cy + x0 * s + dy * c;
        } else {
            // The wings: the sides of the back, behind the shoulders and before the tail, up and out about a hinge at
            // the shoulder line; the beat from folded-up to high.
            float side = abs(position.x) / max(arkDefSpan, 0.001);
            float wing = smoothstep(0.3, 0.75, side) * smoothstep(0.3, 0.55, sUp) * smoothstep(0.08, 0.28, sAlong) * (1.0 - smoothstep(0.75, 0.95, sAlong));
            float lift = sAmt * wing * (0.45 + 0.35 * sin(sPh));
            float hx = sign(transformed.x) * arkDefSpan * 0.25;
            float hy = sy0 + sHigh * 0.72;
            float dx = transformed.x - hx;
            float dy = transformed.y - hy;
            float a = lift * sign(transformed.x);
            float c = cos(a);
            float s = sin(a);
            transformed.x = hx + dx * c - dy * s;
            transformed.y = hy + dx * s + dy * c;
            // The head and neck stretched up about the base of the neck.
            float head = smoothstep(0.3, 0.1, sAlong) * smoothstep(0.25, 0.5, sUp);
            float pz = sz1 - sLen * 0.3;
            float py = sy0 + sHigh * 0.6;
            float hz = transformed.z - pz;
            float hh = transformed.y - py;
            float up = -0.22 * sAmt * head;
            float hc = cos(up);
            float hs = sin(up);
            transformed.z = pz + hz * hc + hh * hs;
            transformed.y = py - hz * hs + hh * hc;
        }
    }
}
`;

/**
 * The shader's word for an animal's act now (`arkInstance.w`): its shake off the water (the act `behaviour-recipes.ts`
 * crossingPose made, carrying `shake`), or a bath's `shake_off` step for a species on the list; 0 for anything else.
 * A rig that plays its own shake clip keeps it: then only the wings are drawn here.
 */
export function shakePackOf(act: {block: string; u: number; shake?: ShakeNow} | null | undefined, slug: string, length: number, rigShakes: boolean): number {
    if (!act || act.block !== "shake_off" || !waterShakeOf(slug)) return 0;
    const now = act.shake ?? bathShakeAt(length, act.u, shakeSeconds(length));
    return rigShakes && now.body > 0 ? 0 : shakePack(now);
}
