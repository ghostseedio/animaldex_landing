/**
 * Each species' locomotion styles for flight, swimming and legless motion (motion pass lane L2), from
 * `locomotion/styles.json`: generated from stored data (taxonomy, the stored text where it names a style, the rig and
 * model plans) by `scripts/ark-locomotion-styles.mts`; the reason per species is in `data/ark/locomotion-styles.json`.
 * A species the table lacks gets its body plan's default, flagged `fallback`. Visual only.
 */

import table from "@/ark-scene/locomotion/styles.json";

export type FlightStyle = "continuous" | "flap_glide" | "flap_bound" | "soar" | "hover" | "bat" | "flutter" | "whir";
export type FlyerKind = "bird" | "bat" | "insect";
export type GroundGait = "hop" | "walk" | "waddle" | "run";
export type SwimStyle = "anguilliform" | "subcarangiform" | "carangiform" | "thunniform" | "ostraciiform" | "labriform" | "flatfish" | "rajiform" | "mobuliform" | "cetacean" | "sirenian";
export type LeglessMode = "lateral" | "sidewind" | "rectilinear" | "peristaltic" | "glide";

export type FlightStyleRow = {
    style: FlightStyle;
    kind: FlyerKind;
    /** Multiplies the size allometry's wing-beat rate (heavy wings beat faster, broad slow wings slower); 1 for most. */
    factor: number;
    /** An insect's own wing-beat rate (Hz, true); null for birds and bats (from their size). */
    insectHz: number | null;
    /** It stoops or plunge-dives onto prey (raptors, falcons, gannets, kingfishers, terns, owls' drop). */
    stoops: boolean;
};

export type LocoStyle = {
    flight: FlightStyleRow | null;
    ground: {gait: GroundGait; bob: boolean} | null;
    swim: SwimStyle | null;
    legless: LeglessMode | null;
    /** Not in the table: the plan's default. */
    fallback: boolean;
};

const ROWS = (table as {species: Record<string, string>}).species;
const FLIGHT_CODES: Record<string, FlightStyle> = {c: "continuous", g: "flap_glide", b: "flap_bound", s: "soar", h: "hover", t: "bat", f: "flutter", w: "whir"};
const GROUND_CODES: Record<string, GroundGait> = {h: "hop", w: "walk", a: "waddle", r: "run"};
export const SWIM_CODES: Record<string, SwimStyle> = {an: "anguilliform", sc: "subcarangiform", ca: "carangiform", th: "thunniform", os: "ostraciiform", lb: "labriform", ff: "flatfish", rj: "rajiform", mb: "mobuliform", ce: "cetacean", si: "sirenian"};
const LEGLESS_CODES: Record<string, LeglessMode> = {la: "lateral", sw: "sidewind", re: "rectilinear", pe: "peristaltic", gl: "glide"};

/** One flight code (`s0.8d`, `w190`, `f`, `t`, `h35`) decoded. */
export function decodeFlight(code: string, insect = false): FlightStyleRow | null {
    const m = /^([cgbshtfw])([0-9.]*)(d?)$/.exec(code);
    if (!m) return null;
    const style = FLIGHT_CODES[m[1]];
    const n = m[2] ? Number(m[2]) : null;
    const kind: FlyerKind = style === "bat" ? "bat" : style === "flutter" || style === "whir" || (style === "hover" && n !== null) || insect ? "insect" : "bird";
    return {style, kind, factor: kind === "bird" && n ? n : 1, insectHz: kind === "insect" ? n : null, stoops: m[3] === "d"};
}

export function decodeStyleRow(row: string): LocoStyle {
    const [f, g, s, l] = row.split("|");
    const gm = /^([hwar])(b?)$/.exec(g ?? "");
    return {
        flight: f ? decodeFlight(f) : null,
        ground: gm ? {gait: GROUND_CODES[gm[1]], bob: gm[2] === "b"} : null,
        swim: s ? SWIM_CODES[s] ?? null : null,
        legless: l ? LEGLESS_CODES[l] ?? null : null,
        fallback: false
    };
}

/**
 * A body plan's defaults (the talking model's plan: bird, fish, snake...; or the rig's: flying_bird, legless...), for
 * a species the table lacks.
 */
function planDefault(plan: string | null | undefined): LocoStyle {
    const none: LocoStyle = {flight: null, ground: null, swim: null, legless: null, fallback: true};
    switch (plan) {
        case "bird":
        case "flying_bird":
            return {...none, flight: {style: "continuous", kind: "bird", factor: 1, insectHz: null, stoops: false}, ground: {gait: "walk", bob: false}};
        case "walking_bird":
        case "flightless_bird":
            return {...none, ground: {gait: "walk", bob: false}};
        case "bat":
            return {...none, flight: {style: "bat", kind: "bat", factor: 1, insectHz: null, stoops: false}};
        case "flying_insect":
        case "butterfly":
            return {...none, flight: plan === "butterfly" ? {style: "flutter", kind: "insect", factor: 1, insectHz: null, stoops: false} : {style: "whir", kind: "insect", factor: 1, insectHz: 120, stoops: false}};
        case "fish":
            return {...none, swim: "subcarangiform"};
        case "eel":
            return {...none, swim: "anguilliform", legless: "lateral"};
        case "ray":
            return {...none, swim: "rajiform"};
        case "flatfish":
            return {...none, swim: "flatfish"};
        case "cetacean":
            return {...none, swim: "cetacean"};
        case "snake":
        case "legless":
            return {...none, legless: "lateral"};
        case "worm":
            return {...none, legless: "peristaltic"};
        default:
            return none;
    }
}

const cache = new Map<string, LocoStyle>();

/** A species' styles: its row, else its plan's default (flagged). */
export function locoStyle(slug: string, plan?: string | null): LocoStyle {
    const key = `${slug}#${plan ?? ""}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const row = ROWS[slug];
    const style = row ? decodeStyleRow(row) : planDefault(plan);
    cache.set(key, style);
    return style;
}

export function hasLocoStyle(slug: string): boolean {
    return slug in ROWS;
}

/** Every species in the table (for the metrics and tests). */
export function locoStyleSlugs(): string[] {
    return Object.keys(ROWS);
}
