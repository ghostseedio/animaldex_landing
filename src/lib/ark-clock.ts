/**
 * The Ark's shared clock for liveliness: weather, tides, dawn and dusk, and
 * each animal's own small differences (docs/ark-next.md, liveliness pass).
 *
 * Visual and audio only. Nothing here decides an arrival, a meal, a birth or
 * a death, and nothing here touches a score: the server does all of that.
 *
 * Deterministic and shared: every answer is a pure function of a moment
 * (milliseconds since the Unix epoch, read as UTC), the voyage's start, and
 * animal ids. There is no `Math.random`, no viewer clock zone and no stored
 * state, so every viewer, the recorder and a future livestream see and hear
 * the same weather, the same tide and the same animals at the same moment.
 *
 * The scene drives its adapters from these numbers (sea level, wetness,
 * wind, cloud, fog, snow), so today's terrain/water/sky and the graphics
 * pass's rework can both read them without changing this module.
 */

import {sunElevation} from "@/lib/ark-daylight";

// ---------------------------------------------------------------------------
// Seeds

/** FNV-1a over a string, then a murmur3 finaliser: a well-mixed 32-bit hash. */
function fnv(text: string, seed = 0x811c9dc5): number {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function finalise(value: number): number {
    let h = value >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

/** A 32-bit hash of any mix of strings and integers, in order. */
export function hash32(...parts: Array<string | number>): number {
    let h = 0x811c9dc5;
    for (const part of parts) {
        if (typeof part === "number") {
            // Integers (period indices, slots): hashed by their decimal text, so any size is exact.
            const n = Math.floor(part);
            h = fnv(`${n}`, h ^ 0x9e3779b9);
        } else {
            h = fnv(part, h);
        }
        h = finalise(h);
    }
    return h >>> 0;
}

/** A number in [0, 1) from the parts. */
export function unit(...parts: Array<string | number>): number {
    return hash32(...parts) / 4294967296;
}

/** A number in [-1, 1], clustered around 0 (the mean of two draws): subtle by default. */
function centred(...parts: Array<string | number>): number {
    return unit(...parts, "a") + unit(...parts, "b") - 1;
}

function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

function smooth(t: number): number {
    const c = clamp01(t);
    return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Time

/** One Ark day in real milliseconds: 1 Ark year = 14 real days (`voyage_ark_day`). */
export const ARK_DAY_MS = (DAY_MS * 14) / 365;

/**
 * The island's hour (0–24), the same for everyone: UTC plus a fixed offset.
 * The scene's daylight follows the viewer's own clock today
 * (`ark-daylight.ts` `localHours`); a shared livestream needs this one.
 */
export function islandHours(ms: number, offsetHours = 0): number {
    const h = ms / HOUR_MS + offsetHours;
    return ((h % 24) + 24) % 24;
}

/** The Ark day at `ms`, as the server counts it (rounded to 6 places, like `voyage_ark_day`). */
export function arkDayAt(ms: number, voyageStartMs: number): number {
    return Math.round(((ms - voyageStartMs) / ARK_DAY_MS) * 1e6) / 1e6;
}

/** Day of the year (0–365) at `ms`, UTC. */
export function dayOfYear(ms: number): number {
    const date = new Date(ms);
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    return (ms - start) / DAY_MS;
}

/** The hour (0–24) at which the sun stands at `elevation` degrees, morning or evening, on the scene's sun curve. */
export function hourOfElevation(elevation: number, side: "morning" | "evening"): number {
    const s = Math.min(Math.max(elevation / 58, -1), 1);
    const angle = Math.asin(s); // radians of the curve's phase past 6:00
    const hours = (angle * 24) / (2 * Math.PI);
    return side === "morning" ? 6 + hours : 18 - hours;
}

export type ArkDawnDusk = {
    /** Civil dawn: the sun 6° below the horizon. */
    dawn: number;
    sunrise: number;
    sunset: number;
    /** Civil dusk. */
    dusk: number;
    /** The dawn chorus: from half an hour before civil dawn to an hour after sunrise. */
    chorus: [number, number];
    /** When dawn mist is likeliest. */
    mist: [number, number];
};

/** Dawn and dusk on the scene's own sun (`ark-daylight.ts`): sunrise at 6, sunset at 18 by construction. */
export function dawnDusk(): ArkDawnDusk {
    const dawn = hourOfElevation(-6, "morning");
    const sunrise = hourOfElevation(0, "morning");
    const sunset = hourOfElevation(0, "evening");
    const dusk = hourOfElevation(-6, "evening");
    return {dawn, sunrise, sunset, dusk, chorus: [dawn - 0.5, sunrise + 1], mist: [dawn - 1.5, sunrise + 2.5]};
}

/** 0–1: how far into the dawn chorus `hours` is (a bell over the window, 0 outside it). */
export function dawnChorus(hours: number): number {
    const [from, to] = dawnDusk().chorus;
    if (hours <= from || hours >= to) return 0;
    const t = (hours - from) / (to - from);
    return Math.sin(Math.PI * t);
}

// ---------------------------------------------------------------------------
// Moon and tides

/** A new moon (2000-01-06 18:14 UTC) and the mean synodic month. */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
export const SYNODIC_DAYS = 29.530588853;
/** The principal lunar semi-diurnal tide's period, hours. */
export const M2_HOURS = 12.4206012;
/** Spring tides come a day or two after new and full moon (the tide's "age"). */
const TIDE_AGE_DAYS = 1.5;
/** High water this long after the moon crosses the island's meridian (the "establishment"). */
const ESTABLISHMENT_HOURS = 1.2;
const NEAP_AMPLITUDE = 0.55;

export type ArkMoon = {
    /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
    phase: number;
    /** Days since the new moon. */
    age: number;
    /** 0 dark, 1 full. */
    illumination: number;
};

export function moonAt(ms: number): ArkMoon {
    const days = (ms - NEW_MOON_MS) / DAY_MS;
    const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
    const phase = age / SYNODIC_DAYS;
    return {phase, age, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2};
}

export type ArkTide = {
    /** The water's height, -1 (the lowest spring low) to 1 (the highest spring high). */
    height: number;
    /** This tide's half-range, NEAP_AMPLITUDE (neap) to 1 (spring). */
    amplitude: number;
    /** 1 at springs, 0 at neaps. */
    spring: number;
    rising: boolean;
    /** 0 at high water, 0.5 at low water, through one tidal cycle. */
    cycle: number;
    nextHigh: number;
    nextLow: number;
    moon: ArkMoon;
};

/** Radians of the semi-diurnal tide: twice the moon's hour angle at the island (longitude 0), less the establishment. */
function tideAngle(ms: number): number {
    const hours = ms / HOUR_MS;
    const moon = moonAt(ms);
    const solar = (2 * Math.PI * (hours - 12)) / 24;
    const hourAngle = solar - 2 * Math.PI * moon.phase;
    return 2 * hourAngle - (2 * Math.PI * ESTABLISHMENT_HOURS) / M2_HOURS;
}

/** Radians per hour of the tide angle: one cycle every M2_HOURS (≈ 12.42 h). */
const TIDE_OMEGA = (2 * Math.PI) / M2_HOURS;

export function springness(ms: number): number {
    const lagged = moonAt(ms - TIDE_AGE_DAYS * DAY_MS).phase;
    return (1 + Math.cos(4 * Math.PI * lagged)) / 2;
}

/** About two highs and two lows a day, 50 minutes later each day, higher at springs (new and full moon). */
export function tideAt(ms: number): ArkTide {
    const angle = tideAngle(ms);
    const spring = springness(ms);
    const amplitude = lerp(NEAP_AMPLITUDE, 1, spring);
    const wrapped = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const cycle = wrapped / (2 * Math.PI);
    const toHigh = ((2 * Math.PI - wrapped) % (2 * Math.PI)) / TIDE_OMEGA;
    const toLow = (((3 * Math.PI - wrapped) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / TIDE_OMEGA;
    return {
        height: amplitude * Math.cos(angle),
        amplitude,
        spring,
        rising: Math.sin(angle) < 0,
        cycle,
        nextHigh: ms + (toHigh === 0 ? M2_HOURS : toHigh) * HOUR_MS,
        nextLow: ms + (toLow === 0 ? M2_HOURS : toLow) * HOUR_MS,
        moon: moonAt(ms)
    };
}

export type ArkSeaConfig = {
    /** The sea's mean level in world units (the scene's water plane today). */
    mean: number;
    /** The spring tide's full range, high to low, in world units. */
    springRange: number;
};

/** The sea-level adapter: what the water plane's height should be now. */
export function seaLevelAt(ms: number, config: ArkSeaConfig): number {
    return config.mean + (tideAt(ms).height * config.springRange) / 2;
}

export type ArkShore = {
    /** 0–1: tide pools and the rocky shore out of the water (low tide). */
    poolsExposed: number;
    /** 0–1: the water up to the strandline (high tide). */
    highWater: number;
    /** Crabs and shorebirds out feeding (visual): the pools exposed. */
    shoreFeeding: boolean;
    /** Animals keep off the waterline. */
    avoidWaterline: boolean;
};

export function shoreAt(tide: Pick<ArkTide, "height">): ArkShore {
    const poolsExposed = smooth((-0.15 - tide.height) / 0.4);
    const highWater = smooth((tide.height - 0.35) / 0.4);
    return {poolsExposed, highWater, shoreFeeding: poolsExposed > 0.5, avoidWaterline: highWater > 0.5};
}

// ---------------------------------------------------------------------------
// Weather

export const ARK_WEATHER_KINDS = ["clear", "cloudy", "light_rain", "heavy_rain", "windy", "fog", "storm"] as const;
export type ArkWeatherKind = (typeof ARK_WEATHER_KINDS)[number];

type WeatherParams = {cloud: number; rain: number; wind: number; fog: number; storm: number};

const PARAMS: Record<ArkWeatherKind, WeatherParams> = {
    clear: {cloud: 0.1, rain: 0, wind: 0.2, fog: 0, storm: 0},
    cloudy: {cloud: 0.7, rain: 0, wind: 0.3, fog: 0, storm: 0},
    light_rain: {cloud: 0.82, rain: 0.35, wind: 0.35, fog: 0.08, storm: 0},
    heavy_rain: {cloud: 0.95, rain: 0.85, wind: 0.55, fog: 0.15, storm: 0},
    windy: {cloud: 0.45, rain: 0, wind: 0.85, fog: 0, storm: 0},
    fog: {cloud: 0.55, rain: 0, wind: 0.05, fog: 0.85, storm: 0},
    storm: {cloud: 1, rain: 1, wind: 1, fog: 0.1, storm: 1}
};

/** Weights by season: [winter, summer]; spring and autumn lie between. */
const WEIGHTS: Record<ArkWeatherKind, [number, number]> = {
    clear: [0.24, 0.42],
    cloudy: [0.26, 0.2],
    light_rain: [0.18, 0.11],
    heavy_rain: [0.1, 0.05],
    windy: [0.12, 0.08],
    fog: [0.07, 0.07],
    storm: [0.03, 0.07]
};

/** The chance a weather period keeps the one before it, so weather comes in spells. */
const PERSIST = 0.45;
/** The share of a period spent turning from the last weather into this one. */
const TRANSITION = 0.3;
/** Wet ground dries over about this many periods. */
const DRY_PERIODS = 1.2;

export type ArkWeatherClock = {
    /** The voyage's start (its `started_at`): weather periods count from it, like the server's Ark days. */
    voyageStartMs?: number | null;
    /** A weather period's length; one Ark day (≈ 55 minutes) by default. */
    periodMs?: number;
    /** A salt for the voyage, so two voyages differ. */
    seed?: string;
    /** The island's hour offset from UTC (`islandHours`). */
    offsetHours?: number;
};

export type ArkWeather = {
    /** The weather of this period (after the turn, when `turning` is done). */
    kind: ArkWeatherKind;
    /** The weather it is turning from. */
    from: ArkWeatherKind;
    /** 0–1 through the turn from `from` to `kind`. */
    turning: number;
    period: number;
    /** 0–1 cloud cover: dims the light, greys the sky. */
    cloud: number;
    /** 0–1 rain: particles, sound. */
    rain: number;
    /** 0–1 wind: grass, trees, water. */
    wind: number;
    /** The wind's direction, radians (toward which it blows, from +x toward +z). */
    windDirection: number;
    /** 0–1 fog (mostly at dawn). */
    fog: number;
    /** 0–1 storm (lightning). */
    storm: number;
    /** 0–1 the ground's wetness: darker ground, shiny rocks. Lags the rain and dries after it. */
    wetness: number;
    /** 0–1 standing water in hollows (after heavy rain). */
    puddles: number;
    /** 0–1 a rainbow, after rain with a low sun behind the viewer. */
    rainbow: number;
    /** 0–1: how cold (season, hour, weather): snow on the mountain when high. */
    cold: number;
    /** 0–1 snow falling on the mountain (precipitation while cold). */
    mountainSnowfall: number;
    /** 0–1 snow lying on the mountain. */
    mountainSnowCover: number;
    /** 0–1 how many insects are about (fewer in rain and wind). */
    insects: number;
    /** Behaviour hints (the behaviour system decides; these are only its inputs). */
    hints: {
        /** Birds stop flying and perch or shelter. */
        birdsGrounded: boolean;
        /** Animals that shelter seek cover under trees. */
        seekCover: boolean;
        /** Grazers turn their backs to the wind. */
        faceAwayFromWind: boolean;
        /** Frogs and snails come out (after rain). */
        afterRain: boolean;
    };
};

function seasonWarmth(ms: number): number {
    // 0 at midwinter (about 15 January), 1 at midsummer, northern seasons.
    return (1 - Math.cos((2 * Math.PI * (dayOfYear(ms) - 15)) / 365.25)) / 2;
}

function periodOf(ms: number, clock: ArkWeatherClock): {index: number; fraction: number; startMs: number; length: number} {
    const length = clock.periodMs ?? ARK_DAY_MS;
    const origin = clock.voyageStartMs ?? 0;
    const p = (ms - origin) / length;
    const index = Math.floor(p);
    return {index, fraction: p - index, startMs: origin + index * length, length};
}

/** The period's own pick, before persistence and the dawn rule. */
function basePick(index: number, midMs: number, salt: string): ArkWeatherKind {
    const warmth = seasonWarmth(midMs);
    let total = 0;
    const weights = ARK_WEATHER_KINDS.map((kind) => {
        const [winter, summer] = WEIGHTS[kind];
        const w = lerp(winter, summer, warmth);
        total += w;
        return w;
    });
    let r = unit(salt, "weather", index) * total;
    for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return ARK_WEATHER_KINDS[i];
    }
    return "clear";
}

/** The weather of period `index` (a pure function of the index: no history walk). */
export function weatherOfPeriod(index: number, clock: ArkWeatherClock = {}): ArkWeatherKind {
    const length = clock.periodMs ?? ARK_DAY_MS;
    const origin = clock.voyageStartMs ?? 0;
    const salt = clock.seed ?? "ark";
    const midMs = origin + (index + 0.5) * length;
    let kind = basePick(index, midMs, salt);
    // Spells: some periods carry the one before on (one step back only, so it stays a pure function).
    if (unit(salt, "persist", index) < PERSIST) kind = basePick(index - 1, midMs - length, salt);
    // Fog belongs to the early morning; at other hours it is a grey, cloudy spell.
    if (kind === "fog") {
        const hours = islandHours(midMs, clock.offsetHours ?? 0);
        const [from, to] = dawnDusk().mist;
        if (hours < from || hours > to) kind = "cloudy";
    }
    // A storm needs a build-up: one straight out of clear skies starts as heavy rain.
    if (kind === "storm" && weatherBase(index - 1, clock) === "clear") kind = "heavy_rain";
    return kind;
}

/** The pick of period `index` with persistence but no storm rule (used to look one period back without recursion). */
function weatherBase(index: number, clock: ArkWeatherClock): ArkWeatherKind {
    const length = clock.periodMs ?? ARK_DAY_MS;
    const origin = clock.voyageStartMs ?? 0;
    const salt = clock.seed ?? "ark";
    const midMs = origin + (index + 0.5) * length;
    return unit(salt, "persist", index) < PERSIST ? basePick(index - 1, midMs - length, salt) : basePick(index, midMs, salt);
}

function jittered(kind: ArkWeatherKind, index: number, salt: string): WeatherParams {
    const p = PARAMS[kind];
    const j = (key: string) => centred(salt, "jitter", key, index) * 0.08;
    return {
        cloud: clamp01(p.cloud + j("cloud")),
        rain: p.rain > 0 ? clamp01(p.rain + j("rain")) : 0,
        wind: clamp01(p.wind + j("wind")),
        fog: p.fog > 0 ? clamp01(p.fog + j("fog")) : 0,
        storm: p.storm
    };
}

function windDirectionOf(index: number, salt: string): number {
    // A prevailing wind from the west-south-west, swinging up to ±70° from period to period.
    return Math.PI * 0.1 + centred(salt, "wind-dir", index) * 1.2;
}

/** The weather at `ms`, the same for every viewer. */
export function weatherAt(ms: number, clock: ArkWeatherClock = {}): ArkWeather {
    const salt = clock.seed ?? "ark";
    const {index, fraction, startMs, length} = periodOf(ms, clock);
    const kind = weatherOfPeriod(index, clock);
    const from = weatherOfPeriod(index - 1, clock);
    const now = jittered(kind, index, salt);
    const before = jittered(from, index - 1, salt);
    // The sky turns first, the rain follows it in (or stops before the cloud clears).
    const turning = smooth(fraction / TRANSITION);
    const skyT = smooth(fraction / (TRANSITION * 0.7));
    const rainT = now.rain > before.rain ? smooth((fraction - TRANSITION * 0.35) / (TRANSITION * 0.65)) : smooth(fraction / (TRANSITION * 0.6));
    const cloud = lerp(before.cloud, now.cloud, skyT);
    const rain = lerp(before.rain, now.rain, rainT);
    const wind = lerp(before.wind, now.wind, turning);
    const storm = lerp(before.storm, now.storm, rainT);
    const dirA = windDirectionOf(index - 1, salt);
    const dirB = windDirectionOf(index, salt);
    const windDirection = lerp(dirA, dirB, turning);

    // Fog: the period's own, plus a thin dawn mist on calm, clear or cloudy mornings.
    const hours = islandHours(ms, clock.offsetHours ?? 0);
    const [mistFrom, mistTo] = dawnDusk().mist;
    const mistBell = hours > mistFrom && hours < mistTo ? Math.sin((Math.PI * (hours - mistFrom)) / (mistTo - mistFrom)) : 0;
    const calm = 1 - smooth((wind - 0.25) / 0.3);
    const ownFog = lerp(before.fog, now.fog, turning);
    const dawnMist = (kind === "clear" || kind === "cloudy" ? 0.28 : 0) * mistBell * calm;
    const fog = clamp01(Math.max(ownFog * (kind === "fog" ? 0.35 + 0.65 * mistBell : 1), dawnMist));

    // Wetness: today's rain soaks in over the turn; earlier periods' rain dries away.
    let wetness = rain * smooth(fraction / (TRANSITION * 1.6));
    for (let k = 1; k <= 3; k++) {
        const past = jittered(weatherOfPeriod(index - k, clock), index - k, salt).rain;
        if (past <= 0) continue;
        const sinceEnd = (ms - (startMs - (k - 1) * length)) / length; // periods since that rain ended
        wetness = Math.max(wetness, past * Math.exp(-sinceEnd / DRY_PERIODS));
    }
    wetness = clamp01(wetness * 1.15);
    let heavy = 0;
    for (let k = 0; k <= 2; k++) heavy = Math.max(heavy, jittered(weatherOfPeriod(index - k, clock), index - k, salt).rain);
    const puddles = clamp01(smooth((wetness - 0.45) / 0.45) * smooth((heavy - 0.5) / 0.3));

    // A rainbow: rain just passed, the sky clearing, the sun low enough to throw one.
    const elevation = sunElevation(hours);
    const rainbow =
        before.rain >= 0.3 && now.rain < 0.05 && elevation > 4 && elevation < 42
            ? Math.sin(Math.PI * clamp01((fraction - TRANSITION * 0.6) / 0.45)) * (1 - cloud * 0.6)
            : 0;

    // Cold: the season, the hour and the weather (rain and wind chill).
    const nightChill = elevation < 0 ? 0.15 : 0;
    const cold = clamp01(0.75 - 0.6 * seasonWarmth(ms) + nightChill + 0.15 * rain + 0.1 * wind - 0.1 * (1 - cloud) * (elevation > 20 ? 1 : 0));
    const snowy = smooth((cold - 0.55) / 0.2);
    const mountainSnowfall = clamp01(Math.max(rain, cloud > 0.8 ? 0.2 : 0) * snowy);
    const mountainSnowCover = clamp01(smooth((0.7 - seasonWarmth(ms)) / 0.5) * 0.85 + mountainSnowfall * 0.15);

    const insects = clamp01((1 - rain * 0.85) * (1 - wind * 0.5) * (1 - fog * 0.3));
    return {
        kind,
        from,
        turning,
        period: index,
        cloud,
        rain: clamp01(rain),
        wind: clamp01(wind),
        windDirection,
        fog,
        storm: clamp01(storm),
        wetness,
        puddles,
        rainbow: clamp01(rainbow),
        cold,
        mountainSnowfall,
        mountainSnowCover,
        insects,
        hints: {
            birdsGrounded: rain > 0.6 || wind > 0.8 || storm > 0.5,
            seekCover: rain > 0.45 || storm > 0.3,
            faceAwayFromWind: wind > 0.6,
            afterRain: wetness > 0.35 && rain < 0.12
        }
    };
}

/** 0–1 lightning at `ms` in a storm: short seeded flashes, a couple a minute (visual; thunder follows in the sound). */
export function lightningAt(ms: number, storm: number, seed = "ark"): number {
    if (storm <= 0.05) return 0;
    const slot = Math.floor(ms / 2300);
    if (unit(seed, "flash", slot) > 0.06 * storm) return 0;
    const offset = unit(seed, "flash-at", slot) * 1800;
    const t = ms - slot * 2300 - offset;
    if (t < 0 || t > 420) return 0;
    // Two strokes: a bright one and a fainter return.
    return t < 90 ? 1 - t / 90 : t > 160 && t < 260 ? 0.55 * (1 - (t - 160) / 100) : 0;
}

// ---------------------------------------------------------------------------
// Each animal's own differences

export type ArkVariation = {
    /** Times the species' size (adults about ±8%). */
    size: number;
    /** Hue shift in turns (±0.02 ≈ ±7°): subtle, the species stays itself. */
    hue: number;
    /** Times the saturation. */
    saturation: number;
    /** Times the brightness. */
    brightness: number;
    /** Where its pattern starts on the texture (a shader's offset, 0–1 each). */
    pattern: [number, number];
    /** Where its idle loop starts (0–1) and how fast it runs, so no two move together. */
    idlePhase: number;
    idleRate: number;
};

export function animalVariation(id: string): ArkVariation {
    return {
        size: 1 + centred(id, "size") * 0.08,
        hue: centred(id, "hue") * 0.02,
        saturation: 1 + centred(id, "sat") * 0.07,
        brightness: 1 + centred(id, "bright") * 0.08,
        pattern: [unit(id, "pattern-u"), unit(id, "pattern-v")],
        idlePhase: unit(id, "idle-phase"),
        idleRate: 1 + centred(id, "idle-rate") * 0.12
    };
}

/** Floats per instance in `variationAttributes`: size, hue, saturation, brightness, pattern u, pattern v, idle phase, idle rate. */
export const ARK_VARIATION_STRIDE = 8;

/** One animal's variation packed for a per-instance attribute (GPU instancing). */
export function variationAttributes(id: string, out: Float32Array = new Float32Array(ARK_VARIATION_STRIDE), offset = 0): Float32Array {
    const v = animalVariation(id);
    out[offset] = v.size;
    out[offset + 1] = v.hue;
    out[offset + 2] = v.saturation;
    out[offset + 3] = v.brightness;
    out[offset + 4] = v.pattern[0];
    out[offset + 5] = v.pattern[1];
    out[offset + 6] = v.idlePhase;
    out[offset + 7] = v.idleRate;
    return out;
}

export type ArkPersonalityLabel = "bold" | "shy" | "curious" | "steady";

export type ArkPersonality = {
    /** -1 shy … 1 bold. */
    boldness: number;
    /** 0 … 1. */
    curiosity: number;
    label: ArkPersonalityLabel;
    /** Times the species' usual distance from others (bold walk closer). */
    personalSpace: number;
    /** Times the distance at which it moves off from a threat (shy go sooner). */
    fleeDistance: number;
    /** Seconds before it reacts to an alarm (bold wait longer, shy react at once). */
    fleeDelay: number;
    /** Times its glances at the camera (curious look more). */
    glanceRate: number;
};

export function animalPersonality(id: string): ArkPersonality {
    const boldness = centred(id, "bold");
    const curiosity = unit(id, "curious");
    const label: ArkPersonalityLabel = boldness > 0.45 ? "bold" : boldness < -0.45 ? "shy" : curiosity > 0.72 ? "curious" : "steady";
    return {
        boldness,
        curiosity,
        label,
        personalSpace: 1 - boldness * 0.3,
        fleeDistance: 1 - boldness * 0.35,
        fleeDelay: 0.35 + boldness * 0.25,
        glanceRate: 0.6 + curiosity * 1.2
    };
}
