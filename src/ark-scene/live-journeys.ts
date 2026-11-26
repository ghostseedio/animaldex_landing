/**
 * MATE-FINDING (AnimalDex decision 432, owner 2026-11-20: "if animals have spawned far apart they should attempt to find
 * each other"): the record's `mate_found` rows acted out. The engine decided the find and moved the traveller's home beside
 * its partner's (the row's `journey`: from, to, distance, way); this draws the trip, once, from its old home to its new one:
 * a walker walks the nav grid's way (round water and rocks), a swimmer swims the water's way, a flier flies straight over
 * in an arc. It starts at the row's time on the shared clock, so every viewer sees the same trip, and lasts as long as the
 * trip takes at its pace (12 s to 2.5 min). Nothing here decides anything: the row has happened.
 *
 * A meal, a mating, a birth or a moment has the animal first (`busy`); a trip over, the animal is where its day has it
 * (its new home, once the read has its new place).
 */

import type {ActPose} from "@/ark-scene/acts";
import {alongPath, pathLength, type NavPoint} from "@/ark-scene/behaviour-nav";

import type {Journey, JourneyWay} from "@/ark-scene/live/mate-lines";

export type {Journey, JourneyWay};

export type LiveJourneyHost<E> = {
    find: (id: string) => E | null;
    /** A way the locomotion allows, from `from` to `to` (the nav grid's walk or swim); a flier's is straight. */
    path: (entry: E, from: NavPoint, to: NavPoint, way: JourneyWay) => NavPoint[];
    ground: (x: number, z: number) => number;
    /** The water's top at a point (the ground's where there is none). */
    water: (x: number, z: number) => number;
    /** Its walking pace (m/s). */
    walk: (entry: E) => number;
    length: (entry: E) => number;
    setAct: (entry: E, pose: ActPose | null) => void;
    busy: (entry: E) => boolean;
};

/** The shortest and longest a trip is drawn (s). */
export const JOURNEY_MIN = 12;
export const JOURNEY_MAX = 150;
/** Paces by way (m/s): a flier's cruise, a swimmer's; a walker travels at its walk x 1.6 (a steady trot). */
const AIR_PACE = 7;
const WATER_PACE = 1.6;
/** Trips kept at once (the oldest let go first). */
const MOST = 24;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** How long a trip of `length` m takes at `pace` (s). Pure. */
export function journeySeconds(length: number, pace: number): number {
    return clamp(length / Math.max(pace, 0.2), JOURNEY_MIN, JOURNEY_MAX);
}

/** Where along its trip an animal is at `epoch` (0..1), or null before or after it. Pure. */
export function journeyShare(t0: number, seconds: number, epoch: number): number | null {
    const u = (epoch - t0) / seconds;
    return u < 0 || u > 1 ? null : u;
}

/** A flier's height over the ground along its arc (m): up off the ground, over, and down. Pure. */
export function flightHeight(u: number, distance: number): number {
    return Math.sin(Math.PI * clamp(u, 0, 1)) * clamp(distance * 0.08, 3, 24);
}

export class LiveJourneys<E> {
    private trips = new Map<string, Journey & {path: NavPoint[] | null; total: number; seconds: number}>();
    private acting = new Set<E>();

    constructor(private readonly host: LiveJourneyHost<E>) {}

    get size(): number {
        return this.trips.size;
    }

    /** WATCH (the camera director): the travellers on their way to a far mate now. */
    travellers(): Array<{id: string; t0: number}> {
        const out: Array<{id: string; t0: number}> = [];
        for (const t of Array.from(this.trips.values())) {
            const entry = this.acting.size ? this.host.find(t.id) : null;
            if (entry && this.acting.has(entry)) out.push({id: t.id, t0: t.t0});
        }
        return out;
    }

    pins(): string[] {
        return Array.from(this.trips.values()).map((t) => t.id);
    }

    add(list: readonly Journey[], epoch: number): void {
        for (const j of list) {
            if (this.trips.has(j.key)) continue;
            // (A trip long over when its row is read, a reload's: nothing to draw.)
            if (epoch - j.t0 > JOURNEY_MAX) continue;
            this.trips.set(j.key, {...j, path: null, total: 0, seconds: 0});
        }
        while (this.trips.size > MOST) this.trips.delete(this.trips.keys().next().value as string);
    }

    clear(): void {
        this.acting.forEach((e) => this.host.setAct(e, null));
        this.acting.clear();
        this.trips.clear();
    }

    step(epoch: number): void {
        const h = this.host;
        const acting = new Set<E>();
        for (const [key, t] of Array.from(this.trips)) {
            const entry = h.find(t.id);
            if (!entry) {
                if (epoch - t.t0 > JOURNEY_MAX) this.trips.delete(key);
                continue;
            }
            if (!t.path) {
                // (Worked out once, when it is first drawn: the nav grid's way for a walker or a swimmer.)
                t.path = t.way === "air" ? [t.from, t.to] : h.path(entry, t.from, t.to, t.way);
                if (t.path.length < 2) t.path = [t.from, t.to];
                t.total = pathLength(t.path);
                const pace = t.way === "air" ? AIR_PACE : t.way === "water" ? WATER_PACE : h.walk(entry) * 1.6;
                t.seconds = journeySeconds(t.total, pace);
            }
            const u = journeyShare(t.t0, t.seconds, epoch);
            if (u === null) {
                if (epoch > t.t0 + t.seconds) this.trips.delete(key);
                continue;
            }
            if (h.busy(entry)) continue;
            const at = alongPath(t.path, u, t.total);
            const speed = t.total / t.seconds;
            let base: number;
            let state: string;
            if (t.way === "air") {
                base = Math.max(h.ground(at.x, at.z), h.water(at.x, at.z)) + flightHeight(u, t.total);
                state = u < 0.08 ? "takeoff" : u > 0.92 ? "glide" : "fly";
            } else if (t.way === "water") {
                base = h.water(at.x, at.z) - Math.min(h.length(entry) * 0.3, 0.4);
                state = "swim";
            } else {
                base = h.ground(at.x, at.z);
                state = speed > h.walk(entry) * 2 ? "run" : "walk";
            }
            // (Its card says so while the trip is drawn: "on its way to its mate", the record's own find, never a guess.)
            h.setAct(entry, {x: at.x, z: at.z, base, yaw: at.yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed, meal: "toMate"});
            acting.add(entry);
        }
        this.acting.forEach((e) => {
            if (!acting.has(e)) h.setAct(e, null);
        });
        this.acting = acting;
    }
}
