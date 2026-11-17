/**
 * The town's people (owner 2026-11-17: humans "will live in houses (you can maybe look inside the windows and see them
 * watching tv or something), sitting on benches, inside the moving cars, the speedboats, on the beaches … sunbathing";
 * AnimalDex decision 378). One person per human the record has aboard (the snapshot's `human` animals: one per real
 * human capture), never a crowd beyond that. Each is a generic figure (`figures.ts` humanLook from its id): no photo,
 * no face, no name.
 *
 * Their day is a pure function of the island clock (`people.ts` townClockAt: UTC plus the island's offset) and their
 * id, so every viewer sees the same person in the same place at the same moment:
 * - asleep from their own bedtime (22:00–00:30) to their own waking (6:10–7:50);
 * - workers (60%) away on weekdays from after breakfast to 17:00–18:30 (not drawn: at work);
 * - the rest of the day in 90-minute blocks, home for some, out for the others; who is out in a block goes, in the
 *   order of a hash of (id, day, block), to the speedboats' helms (8:00–19:00), the moving cars' wheels, the benches'
 *   seats, then the beach (10:00–18:00: lying in the sun, or walking the sand), any left over away about the town;
 * - evenings at home: dinner at the table (18:30–19:30), then the TV or the table until bed.
 * At home a person is drawn only in a room the homes lane's see-into rooms give (`HumanRoomHost`); with none, the home
 * stays implied by its lit windows, as before.
 *
 * Everything here is in the town's frame (x east, z south), except the boats' helms, which are the world's.
 */

import {humanLook, humanUnit, sitRootY, BASE_HEIGHT, type HumanInstance, type HumanLook, type HumanPoseKind} from "@/ark-scene/humans/figures";
import {townClockAt, weekday, type TownClock} from "@/ark-scene/islands/town/people";
import {sampleTownGround, townHeight} from "@/ark-scene/islands/town/ground";
import {MILLPOND, townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import {inPoly, local, type Pt} from "@/ark-scene/islands/town/geom";
import {PARK_BENCH_RING} from "@/ark-scene/islands/town/render/scenery";
import {BOAT_ROUTES, boatFix} from "@/ark-scene/ocean-traffic";

/** The Homo sapiens species profile (AnimalDex 2fabfa9a…, #2068) and the stray "Human" profile without a name. */
export const HUMAN_SPECIES_IDS: readonly string[] = ["2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", "0fd32bd2-669f-489d-8a1b-8e917aa5117d"];

/** Whether a snapshot animal is a human (by its species, its model slug or its scientific name). */
export function isHumanAnimal(a: {species_profile_id?: string | null; model_slug?: string | null; scientific_name?: string | null}): boolean {
    return HUMAN_SPECIES_IDS.indexOf(a.species_profile_id ?? "") >= 0 || a.model_slug === "human" || /^homo\s+sapiens/i.test(a.scientific_name ?? "");
}

export type Spot = {x: number; y: number; z: number; /** Facing (three's yaw: forward (sin, cos)). */ yaw: number};

/** A room people live in (the homes lane's see-into rooms): its floor's height and its furniture's spots, town frame. */
export type HumanRoom = {
    id: string;
    /** The room's floor (m). */
    floor: number;
    /** The sofa's seats facing the TV (the seat's top, where a sitter sits). */
    seats: Spot[];
    /** The TV (its screen's middle and which way it faces), or null. */
    tv: Spot | null;
    /** Chairs at the table (the seat's top), facing the table. */
    chairs: Spot[];
    /** Where people sleep (a bed's top, head toward `yaw`). */
    beds: Spot[];
};

/** Who gives the rooms (wired after the homes / rural lanes merge: their `home-rooms.ts` rooms and furniture). */
export interface HumanRoomHost {
    rooms(): readonly HumanRoom[];
}

/** Ten benches' seats: the park's round the millpond and the square's (two sitters each). */
export type Seat = Spot & {bench: string};

export type TownHumanSites = {seats: Seat[]; beach: Pt[]; walks: Array<[Pt, Pt]>};

let sitesMemo: {plan: TownPlan; sites: TownHumanSites} | null = null;

/** A bench's frame (the kit's: local +z its front) to its two seats (the seat's top 0.44 m up, facing its front). */
function benchSeats(id: string, x: number, z: number, rot: number, y: number, out: Seat[]) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const lx of [-0.42, 0.42]) {
        // (The kit's frame: world = (x + lx·c − lz·s, z + lx·s + lz·c); a sitter a little forward of the back.)
        const lz = 0.02;
        out.push({bench: id, x: x + lx * c - lz * s, y: y + 0.44, z: z + lx * s + lz * c, yaw: Math.atan2(-s, c)});
    }
}

/**
 * Where the town's people go out: the benches' seats (the park's four round the millpond, `scenery.ts`
 * parkBenchSpots, and the square's three), the beach's dry sand (a 2.5 m grid of points well above the tide's reach
 * and clear of the water, on the beach's own ground), and walks along it.
 */
export function townHumanSites(plan: TownPlan = townPlan()): TownHumanSites {
    if (sitesMemo && sitesMemo.plan === plan) return sitesMemo.sites;
    const seats: Seat[] = [];
    const ground = (x: number, z: number) => townHeight(x, z);
    // The park's benches round the millpond (scenery.ts parkBenchSpots; their feet on the lower of their corners).
    [165, 70, 215, 298].forEach((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const x = MILLPOND.x + Math.cos(a) * (MILLPOND.rx + PARK_BENCH_RING);
        const z = MILLPOND.z + Math.sin(a) * (MILLPOND.rz + PARK_BENCH_RING);
        const rot = Math.atan2(MILLPOND.x - x, MILLPOND.z - z);
        benchSeats(`park${i}`, x, z, rot, benchFloor(x, z, rot, ground) + 0.1, seats);
    });
    // The square's (scenery.ts square: two facing the fountain along the north side, one at the west end).
    const s = plan.square;
    for (const [k, lx, lz, turn] of [[0, -8, -s.d / 2 + 2, 0], [1, 8, -s.d / 2 + 2, 0], [2, -s.w / 2 + 2, 4, Math.PI / 2]] as const) {
        const p = local(s, lx, lz);
        const rot = s.rot + turn;
        benchSeats(`square${k}`, p.x, p.z, rot, benchFloor(p.x, p.z, rot, ground) + 0.1, seats);
    }
    // The beach: dry sand from 5 m above the waterline's reach to where the sand ends, on a 2.5 m grid.
    const beachArea = plan.greens.find((g) => g.kind === "beach");
    const beach: Pt[] = [];
    if (beachArea) {
        for (let z = 110; z < 170; z += 2.5) {
            for (let x = 50; x < 200; x += 2.5) {
                if (!inPoly(beachArea.poly, x, z)) continue;
                const g = sampleTownGround(x, z);
                if (g.surface !== "sand" || g.inland < 6 || g.height < 0.9) continue;
                // (Its whole towel on sand: the corners round it too.)
                let ok = true;
                for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
                    const c = sampleTownGround(x + dx, z + dz);
                    if (c.surface !== "sand" || c.inland < 5 || !inPoly(beachArea.poly, x + dx, z + dz)) ok = false;
                }
                if (ok) beach.push({x, z});
            }
        }
    }
    // Walks: from one end of the dry sand to the other, along its seaward edge and its landward edge.
    const walks: Array<[Pt, Pt]> = [];
    if (beach.length > 4) {
        const sorted = beach.slice().sort((a, b) => a.x - b.x || a.z - b.z);
        const west = sorted[0];
        const east = sorted[sorted.length - 1];
        walks.push([west, east]);
        const mid = sorted[Math.floor(sorted.length / 2)];
        walks.push([west, mid], [mid, east]);
    }
    const sites = {seats, beach, walks: walks.filter(([a, b]) => walkOnSand(a, b))};
    sitesMemo = {plan, sites};
    return sites;
}

function benchFloor(x: number, z: number, rot: number, ground: (x: number, z: number) => number): number {
    let y = ground(x, z);
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [lx, lz] of [[-0.85, 0.22], [0.85, 0.22], [-0.85, -0.26], [0.85, -0.26]]) y = Math.min(y, ground(x + lx * c - lz * s, z + lx * s + lz * c));
    return y;
}

/** Whether a straight walk between two points stays on dry sand (every metre). */
function walkOnSand(a: Pt, b: Pt): boolean {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
    for (let i = 0; i <= n; i++) {
        const t = n ? i / n : 0;
        const g = sampleTownGround(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        if (g.surface !== "sand" || g.inland < 5) return false;
    }
    return true;
}

// MARK: - The day

export type HumanDay = "sleep" | "home" | "work" | "out";

const BLOCK_HOURS = 1.5;

/** A person's own rhythm (pure in the id). */
function rhythm(id: string) {
    const r = humanUnit(`${id}#rhythm`);
    return {wake: 6.15 + r * 1.65, bed: 22 + humanUnit(`${id}#bed`) * 2.5, worker: humanUnit(`${id}#works`) < 0.6, back: 17 + humanUnit(`${id}#back`) * 1.5, homebody: humanUnit(`${id}#home`)};
}

/** Where a person's day has them at a moment of the island clock (pure in the clock and the id). */
export function humanDay(id: string, clock: TownClock): HumanDay {
    const h = clock.hours;
    const r = rhythm(id);
    const bed = r.bed % 24;
    const asleep = bed < 12 ? h >= bed && h < r.wake : h >= r.bed || h < r.wake;
    if (asleep) return "sleep";
    const day = weekday(clock);
    if (h < r.wake + 1) return "home";
    if (r.worker && day >= 1 && day <= 5 && h < r.back) return "work";
    // Dinner at home, then the evening in.
    if (h >= 18.5) return "home";
    if (h < 9) return "home";
    const block = Math.floor(h / BLOCK_HOURS);
    return humanUnit(`${id}#${clock.day}#${block}#in`) < 0.25 + r.homebody * 0.25 ? "home" : "out";
}

/** What a person is doing out: at a boat's helm, at a car's wheel or beside its driver, on a bench, on the beach, or about the town (not drawn). */
export type OutWhat = {kind: "boat"; boat: number; seat: 0 | 1} | {kind: "car"; car: number; seat: 0 | 1} | {kind: "bench"; seat: number} | {kind: "sun"; spot: number} | {kind: "walk"; walk: number; offset: number} | {kind: "about"};

/**
 * Who is out in a block goes where (pure in the block and the people out): in the order of a hash of (id, day, block),
 * the speedboats' helms first (by day), then the cars' wheels (one for each of the town's moving cars; a few take a
 * passenger), then the benches' seats, then the beach (by day: lying in the sun or walking), the rest about the town.
 */
export function assignOut(out: readonly string[], clock: TownClock, sites: TownHumanSites, cars: number): Map<string, OutWhat> {
    const block = Math.floor(clock.hours / BLOCK_HOURS);
    const order = out.slice().sort((a, b) => humanUnit(`${a}#${clock.day}#${block}#go`) - humanUnit(`${b}#${clock.day}#${block}#go`) || (a < b ? -1 : 1));
    const result = new Map<string, OutWhat>();
    const h = clock.hours;
    const boats = h >= 8 && h < 19 ? BOAT_ROUTES.filter((r) => r.kind === "speedboat").length : 0;
    let k = 0;
    for (let b = 0; b < boats && k < order.length; b++) result.set(order[k++], {kind: "boat", boat: b, seat: 0});
    for (let c = 0; c < cars && k < order.length; c++) {
        result.set(order[k++], {kind: "car", car: c, seat: 0});
        if (humanUnit(`car#${c}#${clock.day}#${block}#pass`) < 0.3 && k < order.length) result.set(order[k++], {kind: "car", car: c, seat: 1});
    }
    // Benches: about half the seats taken at a time (a stranger leaves the other end free).
    const seats = sites.seats.length;
    const used = new Set<number>();
    const benchGoers = Math.min(Math.ceil(seats * 0.55), order.length - k);
    for (let i = 0; i < benchGoers; i++) {
        const id = order[k++];
        let s = Math.floor(humanUnit(`${id}#${clock.day}#${block}#seat`) * seats);
        while (used.has(s)) s = (s + 1) % seats;
        used.add(s);
        result.set(id, {kind: "bench", seat: s});
    }
    const sunny = h >= 10 && h < 18 && sites.beach.length > 0;
    const spots = new Set<number>();
    while (k < order.length) {
        const id = order[k++];
        if (!sunny) {
            result.set(id, {kind: "about"});
            continue;
        }
        if (humanUnit(`${id}#${clock.day}#${block}#walk`) < 0.35 && sites.walks.length) {
            result.set(id, {kind: "walk", walk: Math.floor(humanUnit(`${id}#walkline`) * sites.walks.length), offset: humanUnit(`${id}#${block}#walkoff`)});
            continue;
        }
        // A spot of sand two cells from any other sunbather (no towels overlap).
        let s = Math.floor(humanUnit(`${id}#${clock.day}#${block}#sand`) * sites.beach.length);
        let tries = 0;
        while (tries++ < sites.beach.length && Array.from(spots).some((o) => Math.hypot(sites.beach[o].x - sites.beach[s].x, sites.beach[o].z - sites.beach[s].z) < 3.5)) s = (s + 7) % sites.beach.length;
        if (tries > sites.beach.length) {
            result.set(id, {kind: "about"});
            continue;
        }
        spots.add(s);
        result.set(id, {kind: "sun", spot: s});
    }
    return result;
}

// MARK: - The people drawn

export type TownHumanRecord = {id: string};

/** A moving car as the traffic gives it (`vehicles.ts` MovingCar: its middle, heading, whether it drives now). */
export type CarFix = {index: number; x: number; z: number; dx: number; dz: number; active: boolean};

export type TownHumansOptions = {
    /** The town's origin in the world (the figures are drawn in the world's frame). */
    origin: {x: number; z: number};
    /** The island clock's offset (hours). */
    offsetHours?: number;
    /** A person away now (the logging lane: at work in the wild island's forest): not drawn in the town. */
    away?: (id: string, epochMs: number) => boolean;
    /** The road's height under a car (`vehicles.ts` roadHeight). */
    roadHeight?: (x: number, z: number) => number;
    /** The sea's level now (the boats float on it). */
    seaLevel?: () => number;
};

/** A seated driver's lean back (rad) so the head clears the roof: more for the tallest. */
function driverLean(look: HumanLook): number {
    return 0.3 + Math.max(0, look.height / BASE_HEIGHT - 0.9) * 1.6;
}

/**
 * A seat in a moving car (town frame): driving on the left, the driver on the right (local −x facing +z), the passenger
 * beside; the hips 0.25 m over the road (these cars' roofs are low: the driver leans back to clear it, `driverLean`).
 */
export function carSeat(car: {x: number; z: number; dx: number; dz: number}, seat: 0 | 1, road: number, scale: number): Spot {
    const yaw = Math.atan2(car.dx, car.dz);
    const lx = seat === 0 ? -0.37 : 0.37;
    const lz = 0.05;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return {x: car.x + lx * c + lz * s, y: sitRootY(road + 0.03 + 0.22, scale), z: car.z - lx * s + lz * c, yaw};
}

/** A speedboat's helm seat (world frame): x −0.32, z −0.55 on its 0.78 m deck, the seat's top 0.5 m up, facing the bow. */
export function helmSeat(fix: {x: number; z: number; yaw: number}, pace: number, sea: number, scale: number): Spot {
    const lx = -0.32;
    const lz = -0.55;
    const c = Math.cos(fix.yaw);
    const s = Math.sin(fix.yaw);
    // (The hull rides 0.12 m higher at full speed and trims bow-up 0.09 rad: the seat aft of the middle sits a little lower.)
    return {x: fix.x + lx * c + lz * s, y: sitRootY(sea + 0.12 * pace + 1.28 + lz * 0.09 * pace, scale), z: fix.z - lx * s + lz * c, yaw: fix.yaw};
}

export type DrawnHuman = HumanInstance & {id: string; what: HumanDay | OutWhat["kind"]};

/**
 * The town's people now: `frame` fills `out` (reused, world frame) with everyone drawn at this moment: in a room at
 * home (only with a room host), on a bench, at a car's wheel, at a boat's helm, on the beach.
 */
export class TownHumans {
    private roster: string[] = [];
    private looks = new Map<string, HumanLook>();
    private rooms: HumanRoomHost | null = null;
    private sites: TownHumanSites;
    private blockKey = "";
    private assigned = new Map<string, OutWhat>();
    private homes = new Map<string, {room: number; slot: number}>();
    private pool: DrawnHuman[] = [];
    readonly out: DrawnHuman[] = [];

    constructor(private readonly options: TownHumansOptions, plan: TownPlan = townPlan()) {
        this.sites = townHumanSites(plan);
    }

    /** The record's humans (one per real human capture aboard, the server's). */
    setRoster(humans: readonly TownHumanRecord[]): void {
        const ids = humans.map((h) => h.id).sort();
        if (ids.join(",") === this.roster.join(",")) return;
        this.roster = ids;
        this.looks = new Map(ids.map((id) => [id, humanLook(id)]));
        this.blockKey = "";
        this.assignHomes();
    }

    get count(): number {
        return this.roster.length;
    }

    setRoomHost(host: HumanRoomHost | null): void {
        this.rooms = host;
        this.assignHomes();
    }

    /** Each person's room: two to a room, by a rendezvous of the rooms on the id (stable as people come and go). */
    private assignHomes() {
        this.homes.clear();
        const rooms = this.rooms?.rooms() ?? [];
        if (!rooms.length) return;
        const fill = new Map<number, number>();
        const capacity = (i: number) => Math.max(1, Math.min(2, rooms[i].seats.length, Math.max(rooms[i].beds.length, 1) * 2));
        for (const id of this.roster) {
            const ranked = rooms.map((room, i) => ({i, u: humanUnit(`${id}|${room.id}`)})).sort((a, b) => b.u - a.u);
            const pick = ranked.find((r) => (fill.get(r.i) ?? 0) < capacity(r.i));
            if (!pick) continue;
            const slot = fill.get(pick.i) ?? 0;
            fill.set(pick.i, slot + 1);
            this.homes.set(id, {room: pick.i, slot});
        }
    }

    lookOf(id: string): HumanLook | undefined {
        return this.looks.get(id);
    }

    /** Everyone drawn at `epochMs` (the shared clock); `cars`: the town's moving cars now (null: none drawn). */
    frame(epochMs: number, cars: readonly CarFix[] | null, carCount: number): DrawnHuman[] {
        const out = this.out;
        out.length = 0;
        if (!this.roster.length) return out;
        const clock = townClockAt(epochMs, this.options.offsetHours ?? 0);
        const block = Math.floor(clock.hours / BLOCK_HOURS);
        const seconds = epochMs / 1000;
        const ox = this.options.origin.x;
        const oz = this.options.origin.z;
        const days = new Map<string, HumanDay>();
        const key = `${clock.day}#${block}`;
        for (const id of this.roster) days.set(id, this.options.away?.(id, epochMs) ? "work" : humanDay(id, clock));
        if (key !== this.blockKey) {
            this.blockKey = key;
            this.assigned = assignOut(this.roster.filter((id) => days.get(id) === "out"), clock, this.sites, carCount);
        }
        const rooms = this.rooms?.rooms() ?? [];
        let n = 0;
        const take = (id: string, look: HumanLook, what: DrawnHuman["what"], x: number, y: number, z: number, yaw: number, pose: HumanPoseKind, phase: number) => {
            const h = this.pool[n] ?? (this.pool[n] = {id, look, what, x, y, z, yaw, pose, phase});
            h.id = id;
            h.look = look;
            h.what = what;
            h.x = x;
            h.y = y;
            h.z = z;
            h.yaw = yaw;
            h.pose = pose;
            h.phase = phase;
            h.scale = 1;
            h.lean = what === "car" ? -driverLean(look) : 0;
            n++;
            out.push(h);
        };
        for (const id of this.roster) {
            const look = this.looks.get(id)!;
            const scale = look.height / BASE_HEIGHT;
            const day = days.get(id)!;
            const phase = humanUnit(`${id}#phase`) * 100;
            if (day === "sleep" || day === "home") {
                const home = this.homes.get(id);
                const room = home ? rooms[home.room] : undefined;
                if (!room) continue;
                if (day === "sleep") {
                    const bed = room.beds[home!.slot % Math.max(room.beds.length, 1)];
                    if (bed) take(id, look, "sleep", ox + bed.x, bed.y, oz + bed.z, bed.yaw, "sleep", phase);
                    continue;
                }
                // Dinner at the table, else the evening on the sofa in front of the TV (or at the table).
                const dinner = clock.hours >= 18.5 && clock.hours < 19.5;
                const tv = !dinner && room.tv && room.seats.length && humanUnit(`${id}#${clock.day}#tv`) < 0.7;
                const chair = room.chairs[home!.slot % Math.max(room.chairs.length, 1)];
                const seat = tv ? room.seats[home!.slot % room.seats.length] : chair ?? room.seats[home!.slot % Math.max(room.seats.length, 1)];
                if (seat) take(id, look, "home", ox + seat.x, sitRootY(seat.y, scale), oz + seat.z, seat.yaw, "sit", phase);
                continue;
            }
            if (day === "work") continue;
            const what = this.assigned.get(id);
            if (!what) continue;
            switch (what.kind) {
                case "bench": {
                    const seat = this.sites.seats[what.seat];
                    take(id, look, "bench", ox + seat.x, sitRootY(seat.y, scale), oz + seat.z, seat.yaw, "sit", phase);
                    break;
                }
                case "sun": {
                    const p = this.sites.beach[what.spot];
                    // Lying on a towel, feet to the sea (the beach faces south-east here: +z), now and then sitting up.
                    const yaw = Math.PI * 0.85 + humanUnit(`${id}#towel`) * 0.5;
                    take(id, look, "sun", ox + p.x, townHeight(p.x, p.z), oz + p.z, yaw, "lie", phase);
                    break;
                }
                case "walk": {
                    const [a, b] = this.sites.walks[what.walk];
                    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
                    const pace = 1.15 * (0.9 + 0.2 * humanUnit(`${id}#pace`));
                    const t = ((seconds * pace) / length + what.offset) % 2;
                    const back = t > 1;
                    const f = back ? 2 - t : t;
                    const x = a.x + (b.x - a.x) * f;
                    const z = a.z + (b.z - a.z) * f;
                    const yaw = Math.atan2((b.x - a.x) * (back ? -1 : 1), (b.z - a.z) * (back ? -1 : 1));
                    take(id, look, "walk", ox + x, townHeight(x, z), oz + z, yaw, "walk", phase);
                    break;
                }
                case "car": {
                    const car = cars?.[what.car];
                    if (!car || !car.active) break;
                    const road = this.options.roadHeight?.(car.x, car.z) ?? townHeight(car.x, car.z);
                    const p = carSeat(car, what.seat, road, scale);
                    take(id, look, "car", ox + p.x, p.y, oz + p.z, p.yaw, what.seat === 0 ? "drive" : "sit", phase);
                    break;
                }
                case "boat": {
                    const route = BOAT_ROUTES.filter((r) => r.kind === "speedboat")[what.boat];
                    if (!route) break;
                    const fix = boatFix(route, seconds);
                    const p = helmSeat(fix, Math.min(fix.speed / route.speed, 1), this.options.seaLevel?.() ?? 0, scale);
                    take(id, look, "boat", p.x, p.y, p.z, p.yaw, "drive", phase);
                    break;
                }
                default:
                    break;
            }
        }
        return out;
    }
}

export {townClockAt};
