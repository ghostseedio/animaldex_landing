/**
 * The Ark's ambient beds: which looping recordings play under the animals,
 * and how loud, for where the listener is, the hour, the weather and the
 * tide (liveliness pass, ambient sounds). Pure and deterministic: the same
 * inputs give the same beds and gains for every viewer. The WebAudio engine
 * (`ark-audio.ts`, the liveliness-wiring lane) plays what this returns and
 * owns everything else (unlocking on the first tap, fades, the master gain).
 *
 * Sound is off until the viewer taps, on the web and in the apps' panel
 * (`initialSoundPreference` in `src/lib/ark-sound.ts`). Nothing here plays
 * anything, so calling it before that tap is harmless.
 *
 * Signature (agreed with the engine lane):
 *
 *     selectAmbientBeds({zone, weather, hour, tide, cameraPos, nearWater})
 *         -> Array<{id, url, gain, pan?}>
 *
 * Additions to that signature, all optional and backwards compatible:
 * - input `cameraPos.yaw`: the listener's heading, for `pan` (no yaw: no pan).
 * - input `eyeDistance`: metres from the camera to `cameraPos` (the orbit
 *   target); far out, nearby water fades (a waterfall is not heard from the
 *   sky).
 * - input `format` ("webm" | "m4a"), `baseUrl`, `maxBeds`, `nowMs`.
 * - output `fallbackUrl` (the other format), `loopSeconds`, `ramp`,
 *   `offset` (when `nowMs` is given) and `lowpassHz` (underwater).
 *
 * How the engine uses the answer:
 * - Call it a few times a second (or when the inputs change) and move each
 *   bed's gain toward `gain` over about `ramp` seconds (`setTargetAtTime`
 *   with a time constant of ramp / 3, or `approachGain` below). A bed missing
 *   from the list fades to 0, then may be stopped.
 * - Loop each buffer with `loopStart = 0` and `loopEnd = loopSeconds`: the
 *   files are cut so the loop is seamless at exactly that length, which also
 *   hides any codec padding at the end of the decoded buffer.
 * - Start a bed at `offset` seconds (the same moment of the loop for every
 *   viewer at `nowMs`).
 * - Prefer `url` (Opus in WebM); use `fallbackUrl` (AAC in M4A) where
 *   `canPlayType('audio/webm; codecs="opus"')` is empty (older Safari).
 *
 * Inputs, all from the shared clock and the scene, never per viewer:
 * - `zone`: the zone round the listener, or 0–1 weights of the zones round
 *   it (smooth as the camera moves).
 * - `weather`: `weatherAt(ms)` from `src/lib/ark-clock.ts` (rain, wind,
 *   storm, insects, cold).
 * - `hour`: `islandHours(ms)`.
 * - `tide`: `tideAt(ms)` (or its height, -1 low to 1 high).
 * - `cameraPos`: the listener: the point the camera orbits (on the ground),
 *   with `y` its height in world metres.
 * - `nearWater`: metres from the listener to the nearest sea, river, rapids,
 *   waterfall, pond and lake (and optionally where, for panning), plus
 *   `underwater` when the camera is below the sea's surface. The scene can
 *   measure these with `sampler.ts` (`surfaceAt`, `place("river_source")`…).
 *
 * The bed table is `ambient-beds.json`; the recordings and their licences are
 * in `docs/ark-credits.md` ("Ambient beds").
 */

import table from "@/ark-scene/ambient-beds.json";
import {dawnChorus, dawnDusk, unit} from "@/lib/ark-clock";
import {sunElevation} from "@/lib/ark-daylight";
import type {ArkZone} from "@/ark-scene/types";

// ---------------------------------------------------------------------------
// The table

export type AmbientWaterKind = "sea" | "river" | "rapids" | "waterfall" | "pond" | "lake";
export type AmbientWeatherKey = "rain" | "wind" | "storm" | "insects" | "cold";
export type AmbientTimeKey = "any" | "day" | "night" | "dawn" | "dusk";

export type AmbientNearRule = {water: AmbientWaterKind; full: number; silent: number; weight?: number};

export type AmbientSource = {
    title: string;
    recordist: string;
    license: string;
    source: string;
    page: string;
    /** Which part of the recording the loop is cut from, seconds. */
    segment?: [number, number];
};

export type AmbientBedDef = {
    id: string;
    label: string;
    /** False until the files are in `public/ark/sound/ambient/`: never selected. */
    ready: boolean;
    loopSeconds: number | null;
    /** The bed's gain when everything about it is at full (before the engine's master volume). */
    level: number;
    /** Seconds the engine takes to reach a new gain. */
    ramp: number;
    /** Zone weights; "*" for any zone not listed. */
    zones?: Record<string, number>;
    near?: AmbientNearRule[];
    /** [from, to] listener height (metres) over which the bed comes in. */
    altitude?: [number, number];
    /** How the place parts combine: "and" multiplies zone and near; "max" takes the larger (zone, near, altitude). */
    combine?: "and" | "max";
    time: Partial<Record<AmbientTimeKey, number>>;
    /** Weather that drives the bed in: [from, to, floor]. */
    weather?: Partial<Record<AmbientWeatherKey, [number, number] | [number, number, number]>>;
    /** Weather that quietens it: gain × (1 - k × value). */
    quiet?: Partial<Record<AmbientWeatherKey, number>>;
    /** Tide: louder toward high ({high: k}) or low ({low: k}) water. */
    tide?: {high?: number; low?: number};
    /** Pan toward the nearest water it belongs to. */
    pan?: boolean;
    /** Gain multiplier with the listener underwater (default 0: not heard). */
    underwater?: number;
    sources: AmbientSource[];
};

type AmbientTable = {version: number; path: string; formats: string[]; beds: AmbientBedDef[]};

export const AMBIENT_TABLE = table as unknown as AmbientTable;
export const AMBIENT_BEDS: readonly AmbientBedDef[] = AMBIENT_TABLE.beds;
export const AMBIENT_PATH = AMBIENT_TABLE.path;

/** At most this many beds at once by default (the sound tiers' "high"; pass `maxBeds` for medium 3, low 2). */
export const AMBIENT_MAX_BEDS = 5;
/** Below this a bed is left out (the engine fades it away). */
export const AMBIENT_MIN_GAIN = 0.01;
/** Underwater, everything left is heard through this low-pass. */
export const AMBIENT_UNDERWATER_LOWPASS_HZ = 380;

// ---------------------------------------------------------------------------
// Input and output

export type AmbientWaterNear = number | {distance: number; x?: number; z?: number};

export type AmbientInput = {
    zone: ArkZone | string | Partial<Record<string, number>> | null;
    weather: {rain: number; wind: number; storm: number; insects?: number; cold?: number};
    /** The island's hour, 0–24. */
    hour: number;
    /** `tideAt(ms)` or its height (-1 low to 1 high). Null: mid tide. */
    tide?: {height: number} | number | null;
    /** The listener (the camera's orbit target). `yaw`: its heading, radians about up, 0 = +z (as `ArkLocated.yaw`). */
    cameraPos: {x: number; y: number; z: number; yaw?: number};
    nearWater?: Partial<Record<AmbientWaterKind, AmbientWaterNear | null>> & {underwater?: boolean};
    /** Metres from the camera's eye to `cameraPos`. */
    eyeDistance?: number;
    format?: "webm" | "m4a";
    /** Prefix for the URLs (e.g. "https://animaldex.app"); default "" (site-relative). */
    baseUrl?: string;
    maxBeds?: number;
    /** Now (ms since the epoch): fills `offset`. */
    nowMs?: number;
};

export type AmbientBedPlay = {
    id: string;
    url: string;
    gain: number;
    /** -1 left … 1 right. */
    pan?: number;
    fallbackUrl: string;
    loopSeconds: number;
    ramp: number;
    offset?: number;
    lowpassHz?: number;
};

// ---------------------------------------------------------------------------
// Pieces

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

function finiteOr(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** 0 at `from`, 1 at `to` (either order), smooth between. */
export function smoothstep(from: number, to: number, value: number): number {
    if (from === to) return value >= to ? 1 : 0;
    const t = clamp01((value - from) / (to - from));
    return t * t * (3 - 2 * t);
}

/** The zone weights round the listener, from a zone name or a weights map. */
export function zoneWeights(zone: AmbientInput["zone"]): Record<string, number> {
    if (!zone) return {};
    if (typeof zone === "string") return {[zone]: 1};
    const out: Record<string, number> = {};
    Object.keys(zone).forEach((key) => {
        const w = clamp01(finiteOr(zone[key], 0));
        if (w > 0) out[key] = w;
    });
    return out;
}

/** 0–1 how much a bed belongs to the zones round the listener. */
export function zoneFactor(bedZones: Record<string, number> | undefined, weights: Record<string, number>): number {
    if (!bedZones) return 1;
    const fallback = finiteOr(bedZones["*"], 0);
    let sum = 0;
    let total = 0;
    Object.keys(weights).forEach((key) => {
        const w = weights[key];
        total += w;
        sum += w * clamp01(key in bedZones ? finiteOr(bedZones[key], 0) : fallback);
    });
    if (total === 0) return clamp01(fallback);
    return clamp01(sum / Math.max(1, total));
}

/** 0–1 of each time of day at `hour`, on the scene's sun (sunrise 6, sunset 18). */
export function timeCurves(hour: number): Record<AmbientTimeKey, number> {
    const h = ((finiteOr(hour, 12) % 24) + 24) % 24;
    const elevation = sunElevation(h);
    const {sunset, dusk} = dawnDusk();
    // Evening: from an hour before sunset to an hour after civil dusk, a bell.
    const from = sunset - 1;
    const to = dusk + 1;
    const evening = h > from && h < to ? Math.sin((Math.PI * (h - from)) / (to - from)) : 0;
    return {
        any: 1,
        day: clamp01((elevation + 4) / 12),
        night: 1 - clamp01((elevation + 2) / 8),
        dawn: dawnChorus(h),
        dusk: evening
    };
}

function timeFactor(time: AmbientBedDef["time"], curves: Record<AmbientTimeKey, number>): number {
    let best = 0;
    (Object.keys(time) as AmbientTimeKey[]).forEach((key) => {
        const w = finiteOr(time[key], 0);
        best = Math.max(best, w * (curves[key] ?? 0));
    });
    return clamp01(best);
}

function weatherValue(weather: AmbientInput["weather"], key: AmbientWeatherKey): number {
    if (key === "insects") return clamp01(finiteOr(weather.insects, 1));
    if (key === "cold") return clamp01(finiteOr(weather.cold, 0));
    return clamp01(finiteOr(weather[key], 0));
}

function weatherFactor(bed: AmbientBedDef, weather: AmbientInput["weather"]): number {
    let f = 1;
    const drive = bed.weather ?? {};
    (Object.keys(drive) as AmbientWeatherKey[]).forEach((key) => {
        const rule = drive[key];
        if (!rule) return;
        const floor = rule.length > 2 ? clamp01(finiteOr(rule[2], 0)) : 0;
        f *= floor + (1 - floor) * smoothstep(rule[0], rule[1], weatherValue(weather, key));
    });
    const quiet = bed.quiet ?? {};
    (Object.keys(quiet) as AmbientWeatherKey[]).forEach((key) => {
        f *= clamp01(1 - finiteOr(quiet[key], 0) * weatherValue(weather, key));
    });
    return clamp01(f);
}

function tideHeight(tide: AmbientInput["tide"]): number {
    if (tide == null) return 0;
    const h = typeof tide === "number" ? tide : tide.height;
    return Math.min(Math.max(finiteOr(h, 0), -1), 1);
}

function tideFactor(rule: AmbientBedDef["tide"], height: number): number {
    if (!rule) return 1;
    const high = (height + 1) / 2;
    let f = 1;
    if (rule.high) f *= 1 - rule.high + rule.high * high;
    if (rule.low) f *= 1 - rule.low + rule.low * (1 - high);
    return clamp01(f);
}

function waterDistance(near: AmbientWaterNear | null | undefined): number {
    if (near == null) return Infinity;
    const d = typeof near === "number" ? near : near.distance;
    return typeof d === "number" && Number.isFinite(d) ? Math.max(d, 0) : Infinity;
}

/** 0–1 how near the listener is to the water a bed belongs to, and which rule won (for panning). */
function nearFactor(rules: AmbientNearRule[], nearWater: AmbientInput["nearWater"], eyeDistance: number): {f: number; water: AmbientWaterKind | null} {
    let best = 0;
    let water: AmbientWaterKind | null = null;
    rules.forEach((rule) => {
        const d = waterDistance(nearWater?.[rule.water]);
        if (!Number.isFinite(d)) return;
        // From high above, the water is as far as the eye: a waterfall is not heard from the sky.
        const heard = Math.hypot(d, eyeDistance * 0.5);
        const f = finiteOr(rule.weight, 1) * (1 - smoothstep(rule.full, rule.silent, heard));
        if (f > best) {
            best = f;
            water = rule.water;
        }
    });
    return {f: clamp01(best), water};
}

/** Pan (-1 left … 1 right) toward a point, for a listener at `pos` heading `yaw` (0 = +z); 0 when right on it. */
export function panToward(pos: {x: number; z: number; yaw?: number}, target: {x: number; z: number}, distance: number, full: number): number {
    if (typeof pos.yaw !== "number" || !Number.isFinite(pos.yaw)) return 0;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return 0;
    // Heading (sin yaw, cos yaw) on (x, z) with y up: the listener's right is (-cos yaw, sin yaw).
    const side = (dx * -Math.cos(pos.yaw) + dz * Math.sin(pos.yaw)) / len;
    // Surrounded when close: no pan inside `full`, full pan from 3 × full out.
    const spread = smoothstep(full, full * 3, distance);
    return Math.round(Math.min(Math.max(side * spread * 0.8, -1), 1) * 1000) / 1000;
}

/** Seconds into a bed's loop at `nowMs`, the same for every viewer (a seeded phase per bed). */
export function loopOffset(id: string, loopSeconds: number, nowMs: number): number {
    if (!(loopSeconds > 0) || !Number.isFinite(nowMs)) return 0;
    const phase = unit("ambient", id) * loopSeconds;
    const t = (nowMs / 1000 + phase) % loopSeconds;
    return Math.round((t < 0 ? t + loopSeconds : t) * 1000) / 1000;
}

/** One step of a smooth approach to `target` (a one-pole filter with time constant ramp / 3). For engines without `setTargetAtTime`. */
export function approachGain(current: number, target: number, dtSeconds: number, ramp: number): number {
    if (!(ramp > 0) || !(dtSeconds > 0)) return target;
    const k = 1 - Math.exp(-dtSeconds / (ramp / 3));
    return current + (target - current) * k;
}

export function bedUrl(id: string, format: "webm" | "m4a", baseUrl = ""): string {
    return `${baseUrl.replace(/\/$/, "")}${AMBIENT_PATH}/${id}.${format}`;
}

// ---------------------------------------------------------------------------
// The selection

/** Each ready bed's gain (0–1) before the cap, with its pan. Exposed for tests and the debug panel. */
export function ambientGains(input: AmbientInput, beds: readonly AmbientBedDef[] = AMBIENT_BEDS): Array<{bed: AmbientBedDef; gain: number; pan: number}> {
    const weights = zoneWeights(input.zone);
    const curves = timeCurves(input.hour);
    const height = tideHeight(input.tide);
    const eye = Math.max(finiteOr(input.eyeDistance, 0), 0);
    const underwater = Boolean(input.nearWater?.underwater);
    const y = finiteOr(input.cameraPos?.y, 0);
    return beds
        .filter((bed) => bed.ready && typeof bed.loopSeconds === "number" && bed.loopSeconds > 0)
        .map((bed) => {
            const zoneF = bed.zones ? zoneFactor(bed.zones, weights) : null;
            const near = bed.near ? nearFactor(bed.near, input.nearWater, eye) : null;
            const altF = bed.altitude ? smoothstep(bed.altitude[0], bed.altitude[1], y) : null;
            let place: number;
            if (bed.combine === "max") {
                place = Math.max(zoneF ?? 0, near?.f ?? 0, altF ?? 0);
            } else {
                place = (zoneF ?? 1) * (near ? near.f : 1) * (altF ?? 1);
            }
            const raw = bed.level * place * timeFactor(bed.time, curves) * weatherFactor(bed, input.weather) * tideFactor(bed.tide, height);
            const gain = underwater ? raw * finiteOr(bed.underwater, 0) : raw;
            let pan = 0;
            if (bed.pan && near?.water && !underwater) {
                const spot = input.nearWater?.[near.water];
                if (spot && typeof spot === "object" && Number.isFinite(spot.x) && Number.isFinite(spot.z)) {
                    const rule = bed.near?.find((r) => r.water === near.water);
                    pan = panToward(input.cameraPos, {x: spot.x as number, z: spot.z as number}, waterDistance(spot), rule?.full ?? 4);
                }
            }
            return {bed, gain: Math.round(clamp01(gain) * 1000) / 1000, pan};
        });
}

/**
 * The ambient beds to play now and their target gains: the loudest
 * `maxBeds` (default 5) above `AMBIENT_MIN_GAIN`, loudest first. Every
 * viewer with the same inputs gets the same answer.
 */
export function selectAmbientBeds(input: AmbientInput, beds: readonly AmbientBedDef[] = AMBIENT_BEDS): AmbientBedPlay[] {
    const format = input.format === "m4a" ? "m4a" : "webm";
    const other = format === "webm" ? "m4a" : "webm";
    const base = input.baseUrl ?? "";
    const cap = Math.max(0, Math.floor(finiteOr(input.maxBeds, AMBIENT_MAX_BEDS)));
    const underwater = Boolean(input.nearWater?.underwater);
    return ambientGains(input, beds)
        .filter((g) => g.gain >= AMBIENT_MIN_GAIN)
        .sort((a, b) => b.gain - a.gain || (a.bed.id < b.bed.id ? -1 : 1))
        .slice(0, cap)
        .map(({bed, gain, pan}) => {
            const loopSeconds = bed.loopSeconds as number;
            const play: AmbientBedPlay = {
                id: bed.id,
                url: bedUrl(bed.id, format, base),
                gain,
                fallbackUrl: bedUrl(bed.id, other, base),
                loopSeconds,
                ramp: bed.ramp
            };
            if (pan !== 0) play.pan = pan;
            if (typeof input.nowMs === "number" && Number.isFinite(input.nowMs)) play.offset = loopOffset(bed.id, loopSeconds, input.nowMs);
            if (underwater) play.lowpassHz = AMBIENT_UNDERWATER_LOWPASS_HZ;
            return play;
        });
}

/** The credits for the beds playing (or heard in this visit), in the Sounds panel's shape (`ArkSoundCredit`). */
export function ambientCredits(ids: readonly string[], beds: readonly AmbientBedDef[] = AMBIENT_BEDS): Array<{recordist: string; license: string; source: string; page: string | null}> {
    const seen = new Set<string>();
    const out: Array<{recordist: string; license: string; source: string; page: string | null}> = [];
    beds.filter((bed) => ids.indexOf(bed.id) >= 0).forEach((bed) => {
        bed.sources.forEach((s) => {
            const key = `${s.recordist}|${s.license}|${s.page}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({recordist: s.recordist, license: s.license, source: s.source, page: s.page || null});
        });
    });
    return out;
}
