/**
 * Dog walks (p5 (humans); the owner, 2026-11-17: "for the humans can we also see them walking dogs (this should also
 * help distribute dogs better)"). The town's people take the record's REAL dogs out on a lead, morning and evening by
 * the shared island clock, along the pavements (`pavements.ts`) to somewhere a few hundred metres off (the park, the
 * beach's end of the town, a street corner) and home again; the dog at heel, with stops to sniff where the walker waits.
 *
 * - **No duplicates.** A walked dog is the same animal that lives at its home: the scene moves that one entry along the
 *   walk (its `act`), and it is back at its home when the walk ends. A dog is either at home or on its walk.
 * - **Who walks whom** is a pairing by home, pure in the ids: each person belongs to one of the town's households
 *   (`areas.ts` householdOf, as a pet does); a dog is walked by a person of its own household, else by the nearest
 *   neighbour with a hand free (within `NEIGHBOUR_REACH` m), else it stays home. One dog per lead, two leads a walker.
 * - **When**: each walker's morning walk begins between 06:40 and 09:00 and the evening's between 17:10 and 19:40 (by
 *   the walker and the day), never before they wake; about 10–20 minutes each.
 *
 * Pure in the clock and the ids (every viewer sees the same walk at the same place); positions in the town's frame.
 */

import {humanUnit} from "@/ark-scene/humans/figures";
import {nearestNode, nodeFor, walkFix, walkSeconds, type PavementGraph, type WalkFix} from "@/ark-scene/humans/pavements";
import {householdOf, townHouseholds} from "@/ark-scene/islands/town/areas";
import {townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";

/** The kind every breed of dog belongs to (the record's Domestic Dog, *Canis lupus familiaris*). */
export const DOG_KIND_ID = "c54e5eca-48bc-4b31-bef6-7f69515e76f7";
/** A neighbour walks a dog whose own household has nobody to: within this far of its home (m). */
export const NEIGHBOUR_REACH = 60;
/** Leads a walker holds. */
export const LEADS = 2;
/** A dog walk's pace (m/s): a little under a stroll's, the dog setting it. */
export const DOG_WALK_PACE = 1.05;
/** How far to the walker's side a dog walks (m), and how far ahead. */
export const HEEL_SIDE = 0.42;
export const HEEL_AHEAD = 0.3;
/** The longest a lead is drawn (m): hand to collar, with its sag. */
export const LEAD_MAX = 2;

/** Whether an animal of the record is a pet dog of a town house (the only dogs walked). */
export function isHouseDog(a: {species_profile_id?: string | null; kind_species_profile_id?: string | null; kind_name?: string | null; area?: string | null; island?: string | null}): boolean {
    const dog = a.kind_species_profile_id === DOG_KIND_ID || a.species_profile_id === DOG_KIND_ID || a.kind_name === "Domestic Dog";
    return dog && a.area === "house" && a.island !== "wild";
}

/** A dog as the walks need it: its household, where it lives (its spot, town frame) and its body's length (m). */
export type WalkDog = {id: string; household: string; x: number; z: number; length: number};
/** A person: their household and where it is (its building's middle, town frame). */
export type Walker = {id: string; household: string; x: number; z: number};

export type DogPairs = {
    /** Each walked dog's walker. */
    walkerOf: Map<string, string>;
    /** Each walker's dogs (one or two), in the order they took them. */
    dogsOf: Map<string, WalkDog[]>;
    /** The dogs nobody walks (they stay home). */
    home: string[];
};

/**
 * The pairing: a household's own people take its dogs first (in id order, a dog each round until hands or dogs run
 * out); a dog left over goes to the nearest person with a hand free within `NEIGHBOUR_REACH` m of its home (a tie: by
 * id); the rest stay home. Pure in the ids and places: the same for every viewer.
 */
export function pairDogs(dogs: readonly WalkDog[], walkers: readonly Walker[]): DogPairs {
    const walkerOf = new Map<string, string>();
    const dogsOf = new Map<string, WalkDog[]>();
    const byHouse = new Map<string, Walker[]>();
    const sorted = walkers.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const w of sorted) byHouse.set(w.household, [...(byHouse.get(w.household) ?? []), w]);
    const give = (w: Walker, d: WalkDog) => {
        walkerOf.set(d.id, w.id);
        dogsOf.set(w.id, [...(dogsOf.get(w.id) ?? []), d]);
    };
    const free = (w: Walker) => (dogsOf.get(w.id)?.length ?? 0) < LEADS;
    const pets = dogs.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const left: WalkDog[] = [];
    // Their own people first, a dog each in turn.
    const turn = new Map<string, number>();
    for (const d of pets) {
        const own = (byHouse.get(d.household) ?? []).filter(free);
        if (!own.length) {
            left.push(d);
            continue;
        }
        const n = turn.get(d.household) ?? 0;
        turn.set(d.household, n + 1);
        give(own[n % own.length], d);
    }
    // Then a neighbour with a hand free.
    const home: string[] = [];
    for (const d of left) {
        let best: Walker | null = null;
        let bestD = NEIGHBOUR_REACH;
        for (const w of sorted) {
            if (!free(w)) continue;
            const dist = Math.hypot(w.x - d.x, w.z - d.z);
            if (dist < bestD) {
                best = w;
                bestD = dist;
            }
        }
        if (best) give(best, d);
        else home.push(d.id);
    }
    return {walkerOf, dogsOf, home};
}

/** A walk: its stops and pauses, and for each of the walker's dogs the seconds of it the dog is on the lead (from its door to its door). */
/** The town's people as walkers: each one's household (`areas.ts` householdOf, flats too) and where its building is. */
export function townWalkers(ids: readonly string[], plan: TownPlan = townPlan()): Walker[] {
    const households = townHouseholds(plan);
    const at = new Map(plan.buildings.map((b) => [b.id, b.at]));
    return ids.map((id) => {
        const h = householdOf(id, true, households);
        const box = at.get(h.building);
        return {id, household: h.id, x: box?.x ?? 0, z: box?.z ?? 0};
    });
}

/** Where a dog walk may head for: the middle of each of the town's parks, and the beach walks' ends (the sand's edge). */
export function dogWalkPlaces(beachWalks: ReadonlyArray<readonly [{x: number; z: number}, {x: number; z: number}]>, plan: TownPlan = townPlan()): DogWalkPlace[] {
    const out: DogWalkPlace[] = [];
    for (const green of plan.greens) {
        if (green.kind !== "park" || !green.poly.length) continue;
        out.push({x: green.poly.reduce((s, p) => s + p.x, 0) / green.poly.length, z: green.poly.reduce((s, p) => s + p.z, 0) / green.poly.length});
    }
    for (const [a, b] of beachWalks) out.push({x: a.x, z: a.z, along: {x: b.x, z: b.z}}, {x: b.x, z: b.z, along: {x: a.x, z: a.z}});
    return out;
}

/** A place a dog walk heads for; a beach walk's end has `along`: its other end (the walk goes on along the sand that way). */
export type DogWalkPlace = {x: number; z: number; along?: {x: number; z: number}};

/** Quality pass: how far along the sand a beach dog walk goes (m) before turning back. */
export const BEACH_STRETCH = 30;

/**
 * Quality pass: a beach dog walk's leg on the sand: from the pavement's last node (`node`) out to the sand's end of the
 * beach walk, along it `BEACH_STRETCH` m (or half its length), and back the same way; `arrive`: the trip's second at
 * the node; `seconds`: the leg's length in time at the dog walk's pace.
 */
type BeachLeg = {arrive: number; seconds: number; points: Array<{x: number; z: number}>; lengths: number[]};

type Trip = {key: string; start: number; seconds: number; stops: number[]; pauses: number[]; on: Array<[number, number]>; beach?: BeachLeg};

/** A dog on its walk at a moment (town frame): where, which way, and whether it has stopped to sniff. */
export type HeelPose = {x: number; z: number; yaw: number; sniffing: boolean; speed: number};

export class DogWalks {
    private pairs: DogPairs = {walkerOf: new Map(), dogsOf: new Map(), home: []};
    private trips = new Map<string, Trip>();
    private doors = new Map<string, number>();
    private readonly fix: WalkFix = {x: 0, z: 0, yaw: 0, paused: false, kind: "pavement", done: false};
    private readonly lead: Array<{dog: WalkDog; side: number}> = [];

    /** `graph`: the town's pavements (built when first asked); `places`: named places a walk may head for (the park, the beach's end). */
    constructor(private readonly graph: () => PavementGraph, private readonly placesOf: () => ReadonlyArray<DogWalkPlace> = () => NONE_PLACES) {}

    private placesMemo: ReadonlyArray<DogWalkPlace> | null = null;
    private get places(): ReadonlyArray<DogWalkPlace> {
        return this.placesMemo ?? (this.placesMemo = this.placesOf());
    }

    /** The record's house dogs and the town's grown people (each new roster). */
    setRoster(dogs: readonly WalkDog[], walkers: readonly Walker[]): void {
        this.pairs = pairDogs(dogs, walkers);
        this.trips.clear();
        this.doors.clear();
    }

    get pairing(): DogPairs {
        return this.pairs;
    }

    /** A walker's dogs (none: this person walks no dog). */
    dogsOf(walker: string): readonly WalkDog[] {
        return this.pairs.dogsOf.get(walker) ?? NONE;
    }

    /** The pavement node at a dog's home (its door): where its walk begins and ends. */
    private door(dog: WalkDog): number {
        let node = this.doors.get(dog.id);
        if (node === undefined) {
            node = nearestNode(this.graph(), dog.x, dog.z);
            this.doors.set(dog.id, node);
        }
        return node;
    }

    /** The walk of a walker on a day, morning (0) or evening (1): from the first dog's door, out and home. */
    private trip(walker: string, day: number, half: 0 | 1, wake: number): Trip | null {
        const dogs = this.pairs.dogsOf.get(walker);
        if (!dogs?.length) return null;
        const key = `${walker}#${day}#${half}`;
        let t = this.trips.get(key);
        if (t) return t;
        const g = this.graph();
        if (!g.main.length) return null;
        const n = g.nodes.length;
        const door = this.door(dogs[0]);
        // Somewhere 150–420 m off: a named place when one is that far (the park, the beach's end), else a corner by the day.
        const named = this.places.map((p) => ({node: nearestNode(g, p.x, p.z), place: p})).filter(({node}) => g.dist[door * n + node] >= 120 && g.dist[door * n + node] <= 520);
        const pick = humanUnit(`${key}#to`);
        const chosen = named.length && pick < 0.6 ? named[Math.min(Math.floor((pick / 0.6) * named.length), named.length - 1)] : null;
        const far = chosen ? chosen.node : nodeFor(g, `${key}#corner`, door, 150, 420);
        // Quality pass: a beach's end: the walk goes on off the pavement onto the sand and along it, and back.
        let leg: Omit<BeachLeg, "arrive"> | null = null;
        if (chosen?.place.along) {
            const node = g.nodes[far];
            const a = chosen.place;
            const b = chosen.place.along;
            const span = Math.hypot(b.x - a.x, b.z - a.z) || 1;
            const reach = Math.min(BEACH_STRETCH, span * 0.5);
            const turn = {x: a.x + ((b.x - a.x) / span) * reach, z: a.z + ((b.z - a.z) / span) * reach};
            const points = [{x: node.x, z: node.z}, {x: a.x, z: a.z}, turn, {x: a.x, z: a.z}, {x: node.x, z: node.z}];
            const lengths = [0];
            for (let k = 1; k < points.length; k++) lengths.push(lengths[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].z - points[k - 1].z));
            leg = {seconds: lengths[lengths.length - 1] / DOG_WALK_PACE, points, lengths};
        }
        // A stop to sniff on the way out and one on the way back, each a short way off the straight line.
        const out = nodeFor(g, `${key}#sniff1`, door, 50, 140);
        const back = nodeFor(g, `${key}#sniff2`, door, 40, 120);
        let stops = [door, out, far, back, door];
        // (A second dog of another home is fetched on the way out and taken home on the way back: its door is the
        // second stop and the last but one, a moment at each to clip and unclip its lead.)
        const other = dogs[1] && this.door(dogs[1]) !== door ? this.door(dogs[1]) : -1;
        if (other >= 0) {
            stops.splice(1, 0, other);
            stops.splice(stops.length - 1, 0, other);
        }
        // (No stop twice running: a sniff stop that is the place itself, or a neighbour's door on the way.)
        stops = stops.filter((node, k) => k === 0 || node !== stops[k - 1]);
        const last = stops.length - 1;
        const pauses = stops.map((node, k) => (k === 0 || k === last ? 0 : node === other && (k === 1 || k === last - 1) ? 5 : node === far ? (leg ? leg.seconds : 0) + 25 + humanUnit(`${key}#stay`) * 40 : 12 + humanUnit(`${key}#sniff#${k}`) * 22));
        const pause = (k: number) => pauses[k] ?? 0;
        const seconds = walkSeconds(g, stops, DOG_WALK_PACE, pause);
        const begin = half === 0 ? Math.max(6.67 + humanUnit(`${key}#at`) * 2.33, wake + 0.25) : 17.17 + humanUnit(`${key}#at`) * 2.5;
        // The first dog the whole walk; a second from another home between its door's two stops.
        const on: Array<[number, number]> = [[0, seconds]];
        if (dogs[1]) on.push(other >= 0 ? [walkSeconds(g, stops.slice(0, 2), DOG_WALK_PACE, pause), walkSeconds(g, stops.slice(0, last), DOG_WALK_PACE, pause) + pause(last - 1)] : [0, seconds]);
        const farAt = stops.indexOf(far);
        t = {key, start: begin, seconds, stops, pauses, on, beach: leg && farAt > 0 ? {...leg, arrive: walkSeconds(g, stops.slice(0, farAt + 1), DOG_WALK_PACE, pause)} : undefined};
        if (this.trips.size > 600) this.trips.clear();
        this.trips.set(key, t);
        return t;
    }

    /**
     * Where a walker is on their dog walk now (the returned fix is reused: read it before the next call), or null: no
     * dog, or not a walk's time. `wake`: the hour the walker wakes.
     */
    at(walker: string, hours: number, day: number, wake: number): WalkFix | null {
        for (const half of [0, 1] as const) {
            const t = this.trip(walker, day, half, wake);
            if (!t) return null;
            const seconds = (hours - t.start) * 3600;
            if (seconds < 0 || seconds >= t.seconds) continue;
            const dogs = this.pairs.dogsOf.get(walker)!;
            this.lead.length = 0;
            for (let k = 0; k < dogs.length; k++) if (seconds >= t.on[k][0] && seconds < t.on[k][1]) this.lead.push({dog: dogs[k], side: k});
            const fix = walkFix(this.graph(), t.stops, seconds, DOG_WALK_PACE, (k) => t.pauses[k] ?? 0, this.fix);
            // Quality pass: out on the sand of a beach walk (after it, standing at the pavement's end a while, as before).
            const leg = t.beach;
            if (leg && seconds >= leg.arrive && seconds < leg.arrive + leg.seconds) {
                const s = (seconds - leg.arrive) * DOG_WALK_PACE;
                let k = 1;
                while (k < leg.lengths.length - 1 && leg.lengths[k] < s) k++;
                const a = leg.points[k - 1], b = leg.points[k];
                const f = Math.min(1, Math.max(0, (s - leg.lengths[k - 1]) / Math.max(leg.lengths[k] - leg.lengths[k - 1], 1e-6)));
                fix.x = a.x + (b.x - a.x) * f;
                fix.z = a.z + (b.z - a.z) * f;
                fix.yaw = Math.atan2(b.x - a.x, b.z - a.z);
                fix.paused = false;
                fix.kind = "path";
            }
            return fix;
        }
        this.lead.length = 0;
        return null;
    }

    /** The dogs on the lead at the last `at` that answered (reused: read it before the next call), each with its side. */
    get onLead(): ReadonlyArray<{dog: WalkDog; side: number}> {
        return this.lead;
    }

    /** When a walker's walks are on a day (hours: [start, end] of the morning's and the evening's), for the tests. */
    hoursOf(walker: string, day: number, wake: number): Array<[number, number]> {
        const out: Array<[number, number]> = [];
        for (const half of [0, 1] as const) {
            const t = this.trip(walker, day, half, wake);
            if (t) out.push([t.start, t.start + t.seconds / 3600]);
        }
        return out;
    }
}

const NONE: readonly WalkDog[] = [];
const NONE_PLACES: ReadonlyArray<DogWalkPlace> = [];

/**
 * A walker's k-th dog at heel: beside them (the first on one side, the second on the other), a little ahead, facing
 * the way they go; stopped where the walker has stopped, nose down.
 */
export function heelPose(fix: {x: number; z: number; yaw: number; paused: boolean}, k: number, out: HeelPose): HeelPose {
    const fx = Math.sin(fix.yaw), fz = Math.cos(fix.yaw);
    const side = k % 2 ? -1 : 1;
    out.x = fix.x + fz * HEEL_SIDE * side + fx * HEEL_AHEAD;
    out.z = fix.z - fx * HEEL_SIDE * side + fz * HEEL_AHEAD;
    out.yaw = fix.yaw;
    out.sniffing = fix.paused;
    out.speed = fix.paused ? 0 : DOG_WALK_PACE;
    return out;
}

/**
 * A lead's line from the walker's hand to the dog's collar, hanging a little (`points` of 3 numbers each, written into
 * `into` from `offset`): a parabola's sag of a twelfth of its span, never longer than `LEAD_MAX`.
 */
export function leadLine(hand: {x: number; y: number; z: number}, collar: {x: number; y: number; z: number}, points: number, into: Float32Array, offset: number): number {
    const span = Math.hypot(collar.x - hand.x, collar.y - hand.y, collar.z - hand.z);
    const sag = Math.min(span / 12, 0.12);
    let length = 0;
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < points; i++) {
        const t = i / (points - 1);
        const x = hand.x + (collar.x - hand.x) * t;
        const y = hand.y + (collar.y - hand.y) * t - sag * 4 * t * (1 - t);
        const z = hand.z + (collar.z - hand.z) * t;
        into[offset + i * 3] = x;
        into[offset + i * 3 + 1] = y;
        into[offset + i * 3 + 2] = z;
        if (i) length += Math.hypot(x - px, y - py, z - pz);
        px = x;
        py = y;
        pz = z;
    }
    return length;
}
