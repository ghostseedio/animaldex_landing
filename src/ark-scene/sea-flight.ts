/**
 * A seabird that lives on the wing over the open sea (SEA-SURFACE, 2026-11-24; the coordinator: "give it seabird
 * behaviour rows from the catalogue ... It must move and be visible"). Only the kinds whose own stored text says so
 * (`sea-flight.json`: the quotes and their fields). Today one aboard: the Magnificent Frigatebird, whose text says it
 * "rode thermals by night as well as by day" and that "it does not settle on the sea. Food is picked from the surface in
 * flight".
 *
 * - **Soaring**: wide thermal circles (its row's radius) round a centre that drifts slowly about its home over the sea,
 *   climbing in the thermal and gliding down out of it on a cycle (its row's heights and cycle), by night as by day.
 * - **A low pass**: now and then (its row's pass rate) it comes down to skim the water for a few seconds and climbs
 *   away again. A flight pass only: nothing is caught or eaten (meals are the engine's, and none is shown here). Only
 *   over water: a pass whose low point would be over land is not flown (it keeps soaring).
 *
 * Pure in (id, slug, home, epoch seconds, the water test): every viewer sees the same bird in the same place at the
 * same moment, with no state. Visual only: nothing here changes what happens on the Ark.
 */

import {hash32} from "@/lib/ark-clock";
import table from "@/ark-scene/sea-flight.json";

type Row = {radius: [number, number]; climb: [number, number]; cycle: number; pass: [number, number]; soar: [string, string]; wings: [string, string]; low: [string, string]};

const ROWS = (table as unknown as {species: Record<string, Row>}).species;

/** Its ground speed on the wing (m/s): a frigatebird's slow soaring glide, an estimate. */
export const SEA_FLIGHT_SPEED = 7;
/** How far the thermal's centre drifts from home (m). */
export const SEA_FLIGHT_DRIFT = 24;
/** A low pass, s: down, along the water, up again. */
export const PASS_DOWN = 6;
export const PASS_LOW = 4;
export const PASS_UP = 6;
export const PASS_SECONDS = PASS_DOWN + PASS_LOW + PASS_UP;

export type SeaFlightSpec = {radius: [number, number]; climb: [number, number]; cycle: number; passEvery: number; passHeight: number; quote: string};

/** Its row (null: not a kind that lives on the wing over the sea by its own text). */
export function seaFlightSpec(slug: string | null | undefined): SeaFlightSpec | null {
    const row = slug ? ROWS[slug] : undefined;
    if (!row) return null;
    return {radius: row.radius, climb: row.climb, cycle: row.cycle, passEvery: row.pass[0], passHeight: row.pass[1], quote: row.soar[0]};
}

/** How far round a soaring centre must be open water (m): its widest circle and its drift. */
export const SEA_FLIGHT_CLEAR = 64;

/**
 * Where over the sea it soars from: its place if open water lies all round it, else the nearest point out to sea that
 * has (rings of 16 bearings 30 m apart, out to 240 m; the first with water at all 16 points of a `SEA_FLIGHT_CLEAR` m
 * circle round it, else the one with the most). A frigatebird placed near the shore soared half over the land.
 * Pure in (place, ground): the same for every viewer.
 */
export function seaHome(place: {x: number; z: number}, ground: (x: number, z: number) => number): {x: number; z: number} {
    const wet = (x: number, z: number) => ground(x, z) < -1;
    const score = (x: number, z: number) => {
        if (!wet(x, z)) return -1;
        let n = 0;
        for (let k = 0; k < 16; k++) if (wet(x + Math.cos((k / 16) * Math.PI * 2) * SEA_FLIGHT_CLEAR, z + Math.sin((k / 16) * Math.PI * 2) * SEA_FLIGHT_CLEAR)) n++;
        return n;
    };
    let bestAt = {x: place.x, z: place.z};
    let best = score(place.x, place.z);
    if (best === 16) return bestAt;
    for (let r = 30; r <= 240; r += 30) {
        for (let k = 0; k < 16; k++) {
            const x = place.x + Math.cos((k / 16) * Math.PI * 2) * r;
            const z = place.z + Math.sin((k / 16) * Math.PI * 2) * r;
            const n = score(x, z);
            if (n > best) {
                best = n;
                bestAt = {x, z};
            }
        }
        if (best === 16) return bestAt;
    }
    return bestAt;
}

/** The kinds with a row. */
export function seaFlightKinds(): string[] {
    return Object.keys(ROWS);
}

const unit = (key: string) => hash32(key) / 4294967296;
const smooth = (t: number) => {
    const u = Math.min(Math.max(t, 0), 1);
    return u * u * (3 - 2 * u);
};

/** Where on its circle and how high, before any pass: the centre's drift, the circle, the thermal's height. */
function soarAt(id: string, spec: SeaFlightSpec, home: {x: number; z: number}, seconds: number): {x: number; z: number; altitude: number; turn: 1 | -1} {
    const seed = unit(`sea-flight#${id}`);
    const radius = spec.radius[0] + (spec.radius[1] - spec.radius[0]) * seed;
    const turn: 1 | -1 = unit(`sea-flight-turn#${id}`) < 0.5 ? 1 : -1;
    // The centre drifts on a slow Lissajous round home (periods of 15 and 21 minutes).
    const cx = home.x + SEA_FLIGHT_DRIFT * Math.sin((seconds / 900) * Math.PI * 2 + seed * 11);
    const cz = home.z + SEA_FLIGHT_DRIFT * Math.sin((seconds / 1260) * Math.PI * 2 + seed * 7);
    const angle = turn * (seconds * SEA_FLIGHT_SPEED) / radius + seed * Math.PI * 2;
    // The thermal: up over 70% of the cycle, gliding down over the rest.
    const u = (((seconds / spec.cycle + seed) % 1) + 1) % 1;
    const rise = u < 0.7 ? smooth(u / 0.7) : 1 - smooth((u - 0.7) / 0.3);
    return {x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius, altitude: spec.climb[0] + (spec.climb[1] - spec.climb[0]) * rise, turn};
}

/** How far into a low pass it is at `seconds`: 0 none, 1 at the water. And the pass's middle (s), if one is on. */
export function passAt(id: string, spec: SeaFlightSpec, seconds: number): {low: number; middle: number | null} {
    const offset = unit(`sea-flight-pass#${id}`) * spec.passEvery;
    const k = Math.floor((seconds - offset) / spec.passEvery);
    const start = offset + k * spec.passEvery;
    const into = seconds - start;
    if (into < 0 || into >= PASS_SECONDS) return {low: 0, middle: null};
    const low = into < PASS_DOWN ? smooth(into / PASS_DOWN) : into < PASS_DOWN + PASS_LOW ? 1 : 1 - smooth((into - PASS_DOWN - PASS_LOW) / PASS_UP);
    return {low, middle: start + PASS_DOWN + PASS_LOW / 2};
}

export type SeaFlightPose = {x: number; z: number; altitude: number; yaw: number; bank: number; low: number};

/**
 * Where it is at `seconds` (epoch): its circle, its height over the sea, its heading (forward is (sin yaw, cos yaw),
 * as every model's), its bank into the turn (radians, level on a pass) and how far into a low pass it is (0…1).
 * `overWater(x, z)`: is the sea under that point (a pass is only flown over water).
 */
export function seaFlightAt(id: string, spec: SeaFlightSpec, home: {x: number; z: number}, seconds: number, overWater: (x: number, z: number) => boolean): SeaFlightPose {
    const here = soarAt(id, spec, home, seconds);
    const ahead = soarAt(id, spec, home, seconds + 0.1);
    const pass = passAt(id, spec, seconds);
    let low = 0;
    if (pass.middle !== null) {
        const mid = soarAt(id, spec, home, pass.middle);
        if (overWater(mid.x, mid.z)) low = pass.low;
    }
    const altitude = here.altitude + (spec.passHeight - here.altitude) * low;
    return {x: here.x, z: here.z, altitude, yaw: Math.atan2(ahead.x - here.x, ahead.z - here.z), bank: -here.turn * 0.32 * (1 - low), low};
}
