/**
 * The Ark's hour: day and night on /ark, from the viewer's own clock.
 *
 * Visual only (life audit section 3.4): the hour moves the sun, colours the
 * light, the haze and the water, and says which animals are asleep from the
 * species' stored `activity` (diurnal, nocturnal, crepuscular, any). It never
 * decides anything that happens in the Ark: the server does that.
 *
 * The sun rises at 6 in the east, stands highest at noon a little west of
 * south, and sets at 18 in the west-north-west, where the v1 golden hour put
 * it (so 17:00 looks as the Ark always has). At night the moon stands
 * opposite it.
 */

export type ArkActivity = "diurnal" | "nocturnal" | "crepuscular" | "any";

export type ArkDaylightPhase = "night" | "dawn" | "day" | "dusk";

export type ArkDaylight = {
    hours: number;
    /** The sun's height above the horizon, in degrees (negative at night). */
    elevation: number;
    /** Its bearing, in degrees from the south (+z) toward the east (+x). */
    azimuth: number;
    phase: ArkDaylightPhase;
    /** The light that casts shadows: the sun by day, the moon at night. */
    light: {elevation: number; azimuth: number; color: string; intensity: number};
    fill: {sky: string; ground: string; intensity: number};
    fog: string;
    /** The sky as the water reflects it. */
    horizon: string;
    zenith: string;
    /** How strongly the sky lights every surface (the scene's environment intensity). */
    environment: number;
    /** 1 at full day, about 0.2 deep in the night: unlit materials (the water, icons) follow it. */
    daylight: number;
    /** 0 by day, 1 at full night: the night sky's stars and its deep blue. */
    night: number;
    /** The warm rim on fur and feathers: strong in a low sun, none at night. */
    rim: number;
};

/** Hours (0–24) on the viewer's clock. */
export function localHours(date: Date): number {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function sunElevation(hours: number): number {
    return 58 * Math.sin(2 * Math.PI * (hours - 6) / 24);
}

export function sunAzimuth(hours: number): number {
    return 70 - (hours - 6) * 17;
}

type Key = {
    at: number;
    sun: string;
    sunIntensity: number;
    sky: string;
    ground: string;
    fill: number;
    fog: string;
    horizon: string;
    zenith: string;
    environment: number;
    daylight: number;
    rim: number;
};

/** Keyframes by the sun's elevation; the morning's low light is a little cooler and pinker than the evening's. */
// Graphics pass, batch 1: a brighter blue moonlight that keeps shapes and hues readable (moon key, cool sky fill, more sky light).
const NIGHT: Key = {at: -14, sun: "#b7c9ff", sunIntensity: 2.7, sky: "#7891d0", ground: "#4a5676", fill: 1.55, fog: "#22314f", horizon: "#33466e", zenith: "#0f1b36", environment: 0.62, daylight: 0.34, rim: 0.06};
const BLUE_EVENING: Key = {at: -5, sun: "#c9a8c8", sunIntensity: 1.6, sky: "#7d8cbc", ground: "#3a3a48", fill: 1.15, fog: "#55557a", horizon: "#6f6384", zenith: "#2d3a60", environment: 0.52, daylight: 0.46, rim: 0.08};
const BLUE_MORNING: Key = {...BLUE_EVENING, sun: "#b8a6c8", sky: "#65739a", fog: "#5b5a78", horizon: "#7d6e8c"};
const LOW_EVENING: Key = {at: 4, sun: "#ffad78", sunIntensity: 2.0, sky: "#b6bfd6", ground: "#5c4a3a", fill: 0.8, fog: "#dcae90", horizon: "#e6b998", zenith: "#7d92b4", environment: 0.65, daylight: 0.78, rim: 0.26};
const LOW_MORNING: Key = {...LOW_EVENING, sun: "#ffbc90", fog: "#e2b8a6", horizon: "#e9c0ae", zenith: "#8aa0c0"};
/** The v1 Ark's light, exactly. */
const GOLDEN: Key = {at: 15, sun: "#ffd9a8", sunIntensity: 2.6, sky: "#c9dbe8", ground: "#6f6248", fill: 0.55, fog: "#d9c9b4", horizon: "#e3d4bf", zenith: "#7fa2c0", environment: 0.75, daylight: 1, rim: 0.22};
const MIDDAY: Key = {at: 45, sun: "#fff3e2", sunIntensity: 2.35, sky: "#c6d8e8", ground: "#6f6248", fill: 0.5, fog: "#d2d6d2", horizon: "#dde3e2", zenith: "#6d9bc6", environment: 0.7, daylight: 1, rim: 0.1};

function hex(value: string): [number, number, number] {
    const n = parseInt(value.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
    const x = hex(a);
    const y = hex(b);
    return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

function mixKey(a: Key, b: Key, t: number): Key {
    const k = Math.min(Math.max(t, 0), 1);
    const n = (x: number, y: number) => x + (y - x) * k;
    return {
        at: n(a.at, b.at),
        sun: mixHex(a.sun, b.sun, k),
        sunIntensity: n(a.sunIntensity, b.sunIntensity),
        sky: mixHex(a.sky, b.sky, k),
        ground: mixHex(a.ground, b.ground, k),
        fill: n(a.fill, b.fill),
        fog: mixHex(a.fog, b.fog, k),
        horizon: mixHex(a.horizon, b.horizon, k),
        zenith: mixHex(a.zenith, b.zenith, k),
        environment: n(a.environment, b.environment),
        daylight: n(a.daylight, b.daylight),
        rim: n(a.rim, b.rim)
    };
}

function smooth(t: number): number {
    const c = Math.min(Math.max(t, 0), 1);
    return c * c * (3 - 2 * c);
}

export function daylightAt(hours: number): ArkDaylight {
    const h = ((hours % 24) + 24) % 24;
    const elevation = sunElevation(h);
    const azimuth = sunAzimuth(h);
    const morning = h < 12;
    const keys = morning ? [NIGHT, BLUE_MORNING, LOW_MORNING, GOLDEN, MIDDAY] : [NIGHT, BLUE_EVENING, LOW_EVENING, GOLDEN, MIDDAY];
    let key = keys[0];
    if (elevation >= keys[keys.length - 1].at) key = keys[keys.length - 1];
    else {
        for (let i = 0; i < keys.length - 1; i++) {
            if (elevation >= keys[i].at && elevation < keys[i + 1].at) {
                key = mixKey(keys[i], keys[i + 1], smooth((elevation - keys[i].at) / (keys[i + 1].at - keys[i].at)));
                break;
            }
        }
    }
    // Below the horizon the shadows come from the moon, opposite the sun and well up.
    const moonUp = smooth((-elevation - 2) / 8);
    const light = elevation > -2
        ? {elevation: Math.max(elevation, 5), azimuth, color: key.sun, intensity: key.sunIntensity * (0.35 + 0.65 * smooth((elevation + 2) / 6))}
        : {elevation: 38, azimuth: azimuth + 180, color: key.sun, intensity: key.sunIntensity * (0.35 + 0.65 * moonUp)};
    const night = smooth((-elevation - 1) / 11);
    const phase: ArkDaylightPhase = elevation < -6 ? "night" : elevation < 10 ? (morning ? "dawn" : "dusk") : "day";
    return {
        hours: h,
        elevation,
        azimuth,
        phase,
        light,
        fill: {sky: key.sky, ground: key.ground, intensity: key.fill},
        fog: key.fog,
        horizon: key.horizon,
        zenith: key.zenith,
        environment: key.environment,
        daylight: key.daylight,
        night,
        rim: key.rim
    };
}

/** "diurnal", "nocturnal"…, anything else (no data) as null. */
export function arkActivity(value: unknown): ArkActivity | null {
    return value === "diurnal" || value === "nocturnal" || value === "crepuscular" || value === "any" ? value : null;
}

/**
 * Whether an animal of this activity is awake with the sun at `elevation`.
 * A species with no activity data keeps the day's hours, as most do.
 */
export function isAwake(activity: ArkActivity | null | undefined, elevation: number): boolean {
    switch (activity) {
        case "any":
            return true;
        case "nocturnal":
            return elevation < 8;
        case "crepuscular":
            return elevation > -14 && elevation < 22;
        default:
            return elevation > -4;
    }
}
