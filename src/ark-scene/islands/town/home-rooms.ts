/**
 * Pets indoors at home (p5 (homes); the owner, 2026-11-17: "currently so many dogs and horses and cows etc. in one
 * garden ... maybe a way to enter the skyrise buildings where you can see dogs/cats inside homes").
 *
 * Measured on the live record (2026-11-16 snapshot): 600 cats, dogs and other outdoor pets over 160 gardens, up to 15 in
 * one (house-51#0: six cats, three dogs, a rabbit, a goat, a guinea pig, a tortoise ...). Real households keep a few
 * outdoors and the rest in the house. The rule here, pure and the same for every viewer:
 *
 * - **The garden cap** (`GARDEN_CAP`): a house's garden keeps at most 3 of its outdoor pets, a terrace home's yard 2.
 *   Pets that cannot live indoors (a tortoise, hens, a pigeon) stay out first; the rest of the places outside go to the
 *   home's indoor-able pets (domestic cats, dogs, rabbits, guinea pigs, ferrets ...) in the order of a hash of each
 *   animal's id, so which stay out never depends on who arrived first. (The trade-off: the cap needs the home's whole
 *   set of pets, so a newcomer whose hash ranks higher sends one indoors; no one else moves.)
 * - **Indoors**: the rest live in the home's glass garden room (`tanks.ts` homeSite, at most `ROOM_CAP`: 2 at a house,
 *   1 at a terrace home) and, past that, in a flat in the downtown's towers: glazed winter-garden apartments on their
 *   fronts and backs (`towerApartments`), each taking up to 4 pets (a 1.5 m cell each), assigned by the same hash order over a rendezvous of the
 *   apartments (stable as the set grows; a full apartment passes a pet to its next).
 * - **In its room** a pet has its own cell of the free floor (in front of the displays or the sofa), and walks about it
 *   on the shared clock (`roomPose`, pure in time and id): never through the glass, the furniture or another pet.
 */

import {corners, hashText, hashTextOn, hashTextPrefix, local, sub, toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {TOWER_FLOOR, townPlan, type Building, type TownPlan} from "@/ark-scene/islands/town/plan";
import type {Household} from "@/ark-scene/islands/town/areas";
import type {HomeSite} from "@/ark-scene/islands/town/tanks";

/** A room a pet lives in: a home's glass garden room or a tower apartment's winter garden. */
export type HomeRoom = {
    id: string;
    kind: "garden_room" | "apartment";
    /** The household (a garden room) or the tower (an apartment). */
    building: string;
    /** The whole room (an apartment's glazed bay: local +z is the glass front, -z the tower's wall). */
    shell: Box;
    /** The free floor the pets walk on. */
    free: Box;
    floor: number;
    height: number;
    capacity: number;
    /** An apartment's storey (from 0 at the street). */
    storey?: number;
};

/** Outdoor pets a garden keeps at most. */
export const GARDEN_CAP = {house: 3, terrace_home: 2} as const;
/** Pets a home's garden room holds at most (on the floor in front of its displays). */
export const ROOM_CAP = {house: 2, terrace_home: 1} as const;
export const APARTMENT_CAP = 4;

/** The apartments' glazed bays: how far they stand out from the tower's front (m), the lowest storey with homes. */
export const BAY_DEPTH = 2.8;
export const APARTMENT_FROM_STOREY = 4;

/** A tower's ground floor (`render/buildings.ts` buildingFrame's): the highest ground under its corners and middle, + 0.15. */
export function towerFloor(b: Box): number {
    let high = townHeight(b.x, b.z);
    for (const c of corners(b)) high = Math.max(high, townHeight(c.x, c.z));
    return high + 0.15;
}

/** A tower's apartment storeys: from `APARTMENT_FROM_STOREY` to the one under the roof's (offices below, in the podium). */
export function apartmentStoreys(b: Pick<Building, "floors">): number[] {
    const out: number[] = [];
    for (let s = APARTMENT_FROM_STOREY; s < b.floors - 1; s++) out.push(s);
    return out;
}

/**
 * The towers' apartments: two a storey on each tower's front (local +z) and back, each a glazed bay standing `BAY_DEPTH`
 * out from the curtain wall, its floor on the storey's slab; a pet a 1.5 m cell of its floor, 4 at most. Pure in the plan.
 */
export function towerApartments(plan: TownPlan = townPlan()): HomeRoom[] {
    const memo = memoRooms.get(plan);
    if (memo) return memo;
    const out: HomeRoom[] = [];
    for (const b of plan.buildings) {
        if (b.kind !== "tower") continue;
        const ground = towerFloor(b.at);
        const width = b.at.w / 2 - 0.9;
        for (const face of [1, -1]) {
            // (The front, local +z, and the back: a back bay is the front's turned half round, its glass facing out.)
            const turned: Box = face > 0 ? b.at : {...b.at, rot: b.at.rot + Math.PI};
            for (const storey of apartmentStoreys(b)) {
                for (const side of [-1, 1]) {
                    const shell = sub(turned, (side * b.at.w) / 4, b.at.d / 2 + BAY_DEPTH / 2, width, BAY_DEPTH);
                    const floor = ground + storey * TOWER_FLOOR;
                    // (The free floor: in front of the sofa along the tower's wall, short of the glass, clear of the shelf and the plant.)
                    const free = sub(shell, 0, 0.45, width - 1.5, BAY_DEPTH - 1.5);
                    // (A cell a pet, at least 1.5 m wide.)
                    const capacity = Math.max(1, Math.min(APARTMENT_CAP, Math.floor(free.w / 1.5)));
                    out.push({id: `${b.id}~${face > 0 ? "f" : "b"}${storey}${side < 0 ? "l" : "r"}`, kind: "apartment", building: b.id, shell, free, floor, height: TOWER_FLOOR - 0.36, capacity, storey});
                }
            }
        }
    }
    memoRooms.set(plan, out);
    return out;
}
const memoRooms = new WeakMap<TownPlan, HomeRoom[]>();

/** A home's garden room as a room for its pets: its floor in front of the displays along the house's wall. */
export function gardenRoomOf(site: HomeSite, kind: Household["kind"]): HomeRoom | null {
    if (site.kind !== "garden_room" || (kind !== "house" && kind !== "terrace_home")) return null;
    const b = site.box;
    // (The displays stand along the +z side, 0.5 m deep with 0.12 m to the wall: `tanks.ts` displaySlots.)
    const back = 0.12 + 0.5 + 0.08;
    const d = b.d - back - 0.18;
    const free = sub(b, 0, -b.d / 2 + 0.18 + d / 2, b.w - 0.3, d);
    return {id: `${site.household}~room`, kind: "garden_room", building: site.household, shell: b, free, floor: site.floor, height: site.height, capacity: ROOM_CAP[kind]};
}

/** Pet kinds people keep indoors (their stored kind): the domestic mammals of the home, not livestock. */
const INDOOR_KIND = /^domestic-(cat|dog|rabbit|ferret)|(^|-)cat$|guinea-pig|ferret|chinchilla|(^|-)degu(-|$)|hedgehog-pet/;
const LIVESTOCK = /horse|pony|donkey|(^|-)cow(-|$)|cattle|goat|sheep|(^|-)pig(-|$)|llama|alpaca|buffalo/;
const NOT_LIVESTOCK = /guinea-pig/;

/** Whether a pet of this kind lives indoors when its garden is full: a domestic cat, dog, rabbit, guinea pig, ferret. */
export function indoorKind(slug: string, plan: string | null): boolean {
    return (plan === null || plan === "mammal") && INDOOR_KIND.test(slug) && (NOT_LIVESTOCK.test(slug) || !LIVESTOCK.test(slug));
}

/** Whether a pet counts towards its garden's cap: a body worth the name (not the lawn's woodlice and spiders). */
export function countsInGarden(plan: string | null, length: number): boolean {
    return length >= 0.12 && plan !== "arthropod" && plan !== "butterfly";
}

export type OutdoorPet = {id: string; slug: string; plan: string | null; length: number; home: Household};

/** Where a pet over its garden's cap lives: its room, and its cell of the room's free floor (index of how many). */
export type IndoorPlace = {room: HomeRoom; cell: number; cells: number};

/**
 * Which of the homes' outdoor pets live indoors, and where (see the top). `rooms`: each home's garden room (or null).
 * Pure: the same pets give the same answer in any order.
 */
export function homeIndoors(pets: readonly OutdoorPet[], roomOf: (home: Household) => HomeRoom | null, apartments: readonly HomeRoom[]): Map<string, IndoorPlace> {
    const byHome = new Map<string, OutdoorPet[]>();
    for (const p of pets) {
        if (p.home.kind === "flat" || !countsInGarden(p.plan, p.length)) continue;
        let list = byHome.get(p.home.id);
        if (!list) byHome.set(p.home.id, (list = []));
        list.push(p);
    }
    const order = (a: OutdoorPet, b: OutdoorPet) => hashText(`${a.id}|garden`) - hashText(`${b.id}|garden`) || (a.id < b.id ? -1 : 1);
    const inRoom = new Map<string, OutdoorPet[]>();
    const toTowers: OutdoorPet[] = [];
    byHome.forEach((list) => {
        const home = list[0].home;
        const cap = GARDEN_CAP[home.kind as "house" | "terrace_home"];
        const fixed = list.filter((p) => !indoorKind(p.slug, p.plan));
        const able = list.filter((p) => indoorKind(p.slug, p.plan)).sort(order);
        const outside = Math.max(cap - fixed.length, 0);
        const over = able.slice(outside);
        if (!over.length) return;
        const room = roomOf(home);
        if (room) {
            // (Its room takes the ones its floor holds: a dog needs its length clear in the room's depth.)
            const fits = over.filter((p) => p.length * 0.5 + 0.1 <= room.free.d / 2);
            const taken = fits.slice(0, room.capacity);
            if (taken.length) inRoom.set(room.id, taken);
            for (const p of over) if (!taken.includes(p)) toTowers.push(p);
        } else toTowers.push(...over);
    });
    const out = new Map<string, IndoorPlace>();
    const rooms = new Map<string, HomeRoom>();
    pets.forEach((p) => {
        const room = roomOf(p.home);
        if (room) rooms.set(room.id, room);
    });
    inRoom.forEach((list, id) => {
        const room = rooms.get(id)!;
        list.forEach((p, i) => out.set(p.id, {room, cell: i, cells: list.length}));
    });
    // The towers: in hash order, each to its first apartment (rendezvous) with a place.
    toTowers.sort(order);
    const filled = new Map<string, OutdoorPet[]>();
    for (const p of toTowers) {
        const prefix = hashTextPrefix(`${p.id}|flat|`);
        let best: HomeRoom | null = null;
        let bestScore = -1;
        for (const a of apartments) {
            if ((filled.get(a.id)?.length ?? 0) >= a.capacity) continue;
            if (p.length * 0.5 + 0.1 > a.free.d / 2) continue;
            const score = hashTextOn(prefix, a.id);
            if (score > bestScore) {
                bestScore = score;
                best = a;
            }
        }
        if (!best) continue;
        let list = filled.get(best.id);
        if (!list) filled.set(best.id, (list = []));
        list.push(p);
    }
    filled.forEach((list, id) => {
        const room = apartments.find((a) => a.id === id)!;
        list.forEach((p, i) => out.set(p.id, {room, cell: i, cells: room.capacity}));
    });
    return out;
}

/** A pet's cell of its room's free floor: the free floor cut into `cells` along its width. */
export function roomCell(place: IndoorPlace): Box {
    const f = place.room.free;
    const w = f.w / place.cells;
    return sub(f, -f.w / 2 + w * (place.cell + 0.5), 0, w, f.d);
}

function u01(id: string, salt: string | number): number {
    return hashText(`${id}|${salt}`) / 4294967296;
}

/**
 * Where a pet is in its room at a clock (s, the shared clock): it rests at a point of its cell, then walks to the next
 * (one every 30-60 s, a few seconds' walk), its whole body (half its length) inside the cell. Pure in time and id.
 */
export function roomPose(place: IndoorPlace, id: string, length: number, clock: number): {x: number; z: number; base: number; yaw: number; moving: boolean} {
    const cell = roomCell(place);
    const mx = Math.max(cell.w / 2 - length * 0.5 - 0.05, 0);
    const mz = Math.max(cell.d / 2 - length * 0.5 - 0.05, 0);
    const period = 30 + u01(id, "period") * 30;
    const t = clock / period + u01(id, "phase");
    const k = Math.floor(t);
    const f = t - k;
    const spot = (n: number) => local(cell, (u01(id, `x${n}`) * 2 - 1) * mx, (u01(id, `z${n}`) * 2 - 1) * mz);
    const a = spot(k);
    const b = spot(k + 1);
    // (The walk: the slot's last 12%, eased; at rest, its own heading.)
    const walk = 0.12;
    const s = f < 1 - walk ? 0 : (f - (1 - walk)) / walk;
    const e = s * s * (3 - 2 * s);
    const moving = s > 0 && s < 1 && Math.hypot(b.x - a.x, b.z - a.z) > 0.05;
    const yaw = moving ? Math.atan2(b.x - a.x, b.z - a.z) : place.room.shell.rot + u01(id, `yaw${k}`) * Math.PI * 2;
    return {x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e, base: place.room.floor, yaw, moving};
}

/** Whether a point is inside a box (with `margin` m in from its sides). */
export function insideBox(b: Box, x: number, z: number, margin = 0): boolean {
    const l = toLocal(b, x, z);
    return Math.abs(l.x) <= b.w / 2 - margin + 1e-6 && Math.abs(l.z) <= b.d / 2 - margin + 1e-6;
}
