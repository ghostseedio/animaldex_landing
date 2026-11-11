/**
 * The weather and time the props answer to (dew at dawn, puddles and wet
 * surfaces after rain, frost, lying and wind-blown snow, chimney smoke in
 * the wind, mist): a small interface, so the props never depend on how the
 * liveliness lane's shared clock (`src/lib/ark-clock.ts` on `ark-liveliness`)
 * is built.
 *
 * Until that clock is in the scene, `stubConditions` gives a calm, dry,
 * mild Ark from the hour alone (the same for every viewer at that hour).
 * When it lands, `conditionsFromArkWeather(weatherAt(ms, clock), hours)`
 * is the adapter: its fields are the clock's own `ArkWeather` names, read
 * structurally, so nothing here imports it.
 *
 * Visual only: nothing here decides anything that happens in the Ark.
 */

export type PropsConditions = {
    /** The hour (0–24) on the scene's clock. */
    hours: number;
    /** 0–1: how far into dawn (a bell from about 4:30 to 8:30, highest near sunrise). */
    dawn: number;
    /** 0 by day, 1 at full night. */
    night: number;
    /** 0–1 the ground's wetness: darker, shinier props, glinting slime trails, muddy yards. */
    wetness: number;
    /** 0–1 standing water in hollows (after heavy rain). */
    puddles: number;
    /** 0–1 rain falling now. */
    rain: number;
    /** 0–1 the wind's strength, and the way it blows (radians, from +x toward +z). */
    wind: number;
    windDirection: number;
    /** 0–1 how cold: frost on the mountain and the ice when high, icicles in the cold area. */
    cold: number;
    /** 0–1 snow lying on the mountain (the ice keeps its own). */
    snowCover: number;
    /** 0–1 fog and morning mist. */
    mist: number;
    /** 0–1 dew on the webs and the grass: dawn after a still, clear or damp night. */
    dew: number;
};

/** The liveliness clock's weather, as far as the props read it (`ArkWeather` on `ark-liveliness`). */
export type ArkWeatherLike = {
    rain: number;
    wind: number;
    windDirection: number;
    fog: number;
    wetness: number;
    puddles: number;
    cold: number;
    mountainSnowCover: number;
    cloud?: number;
};

/** 0–1: the dawn bell (sunrise is at 6 on the scene's sun, `ark-daylight.ts`). */
export function dawnBell(hours: number): number {
    const h = ((hours % 24) + 24) % 24;
    if (h < 4.3 || h > 8.8) return 0;
    const t = (h - 4.3) / 4.5;
    return Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)) ** 1.5;
}

/** 0 by day, 1 at night, eased through dusk and dawn (sun from 4° above to 8° below the horizon). */
export function nightOf(hours: number): number {
    const elevation = 58 * Math.sin((2 * Math.PI * (hours - 6)) / 24);
    const t = Math.min(Math.max((4 - elevation) / 12, 0), 1);
    return t * t * (3 - 2 * t);
}

/** Dew forms at dawn when the air is still and the rain has stopped; a damp night leaves more. */
export function dewOf(hours: number, wind: number, rain: number, wetness: number): number {
    const still = Math.max(0, 1 - wind * 1.6);
    return Math.min(1, dawnBell(hours) * still * (1 - rain) * (0.75 + 0.5 * wetness));
}

/** A calm, dry, mild Ark at this hour: the stand-in until the shared clock is wired. */
export function stubConditions(hours: number): PropsConditions {
    const wind = 0.22;
    const night = nightOf(hours);
    // Colder in the small hours and at dawn, mild by day.
    const cold = 0.35 + 0.25 * Math.max(night, dawnBell(hours));
    return {
        hours,
        dawn: dawnBell(hours),
        night,
        wetness: 0,
        puddles: 0,
        rain: 0,
        wind,
        windDirection: 0.6,
        cold,
        snowCover: 0.55,
        mist: 0.65 * dawnBell(hours),
        dew: dewOf(hours, wind, 0, 0)
    };
}

/** The adapter from the shared clock's weather (when it is in the scene). */
export function conditionsFromArkWeather(weather: ArkWeatherLike, hours: number): PropsConditions {
    return {
        hours,
        dawn: dawnBell(hours),
        night: nightOf(hours),
        wetness: clamp(weather.wetness),
        puddles: clamp(weather.puddles),
        rain: clamp(weather.rain),
        wind: clamp(weather.wind),
        windDirection: weather.windDirection,
        cold: clamp(weather.cold),
        snowCover: clamp(weather.mountainSnowCover),
        mist: clamp(Math.max(weather.fog, 0.5 * dawnBell(hours) * (1 - weather.wind))),
        dew: dewOf(hours, weather.wind, weather.rain, weather.wetness)
    };
}

/** Named looks for the golden shots and development (`?weather=` on the golden page). */
export const PROPS_WEATHER_LOOKS: Record<string, Partial<PropsConditions>> = {
    calm: {},
    after_rain: {wetness: 0.9, puddles: 0.85, rain: 0, wind: 0.15},
    rain: {wetness: 1, puddles: 0.7, rain: 0.8, wind: 0.4},
    windy: {wind: 0.85},
    cold: {cold: 0.95, snowCover: 0.9, wind: 0.75},
    misty: {mist: 1, wind: 0.05}
};

/** Apply a partial override (a named look, or development's `__arkPropsWeather`), keeping dew consistent with it. */
export function withOverride(base: PropsConditions, override: Partial<PropsConditions> | null | undefined): PropsConditions {
    if (!override) return base;
    const next = {...base, ...override};
    if (override.dew === undefined) next.dew = dewOf(next.hours, next.wind, next.rain, next.wetness);
    return next;
}

function clamp(value: number): number {
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}
