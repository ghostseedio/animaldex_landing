/**
 * People at home in the homes lane's see-into rooms (wired on the live page, humans visible, 2026-11-18): the towers'
 * apartments (`islands/town/home-rooms.ts` towerApartments), furnished by `render/pet-homes.ts` apartment() from the
 * same `apartmentLayout`: the sofa's two seats facing the open front, the bed's two sides, the TV this lane draws
 * (`tvs.ts`) before the front facing the sofa. Every human of the record has a home here (two to a flat at most), and
 * the scene draws the flats people live in as it draws those pets live in, so a person at home or asleep is seen.
 */

import {apartmentLayout, type HomeRoom} from "@/ark-scene/islands/town/home-rooms";
import {hashText, type Box} from "@/ark-scene/islands/town/geom";
import type {HumanRoom, HumanRoomHost, Spot} from "@/ark-scene/humans/town-humans";

/** A sleeper's head rests this far toward the foot of the pillow's middle (m): the crown clear of the headboard. */
export const SLEEP_HEAD_SHORT = 0.07;

/** The homes lane's `HomeRoom`, as much of it as people need. */
export type HomeRoomLike = Pick<HomeRoom, "id" | "shell" | "floor"> & {kind: string};

/** The sofa's width and its middle along the wall (`apartmentLayout`'s). */
export function sofaOffset(room: HomeRoomLike): {su: number; sw: number} {
    const {su, sw} = apartmentLayout(room);
    return {su, sw};
}

function at(b: Box, lx: number, lz: number, y: number, facing: number): Spot {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    // (Local +z is the open front: three's yaw for it is atan2(-sin, cos); `facing` turns from there.)
    return {x: b.x + lx * c - lz * s, y, z: b.z + lx * s + lz * c, yaw: Math.atan2(-s, c) + facing};
}

/** An apartment's people's places: the sofa's two seats, the bed's two sides, the TV before the front. Garden rooms: null. */
export function apartmentHumanRoom(room: HomeRoomLike): HumanRoom | null {
    if (room.kind !== "apartment") return null;
    const b = room.shell;
    const L = apartmentLayout(room);
    const {su, sw} = L;
    const seatZ = -b.d / 2 + 0.5;
    const seats = [-1, 1].map((side) => at(b, su + side * sw * 0.22, seatZ + 0.05, room.floor + 0.42, 0));
    // (The TV to the side of the sofa's line, toward the room's middle, turned to face it: not between the sitters and
    // a passer-by at the front.)
    const side = su > 0 ? -1 : 1;
    const tx = su + side * Math.min(1.5, sw / 2 + 0.5);
    const tz = b.d / 2 - 0.5;
    const tv = at(b, tx, tz, room.floor + 0.42, Math.atan2(su - tx, seatZ - tz));
    // The bed (humans polish, 2026-11-18): where each sleeper's head rests, on their pillow, one each side of the bed's
    // middle, at the mattress's top; the town lays the body from there toward the foot (`sleeperRoot`), straight along
    // the bed. Facing: from the head to the foot.
    const bed = L.bed;
    const pillow = bed.x + L.bedSide * (bed.length / 2 - 0.26 - SLEEP_HEAD_SHORT);
    const toFoot = L.bedSide > 0 ? -Math.PI / 2 : Math.PI / 2;
    const beds = [-1, 1].map((k) => at(b, pillow, bed.z + k * bed.width * 0.25, room.floor + bed.top, toFoot));
    return {id: room.id, floor: room.floor, seats, tv, chairs: [], beds, front: Math.atan2(-Math.sin(b.rot), Math.cos(b.rot))};
}

/**
 * The rooms people live in, in the order they are offered (`TownHumans` assignHomes ranks by a rendezvous on each id):
 * every apartment, those the record's pets live in first (`petRooms`: their ids), so a person at home often has a pet
 * beside them; only as many as two to a flat needs, plus a few, so the town's people live together and not one to a
 * tower floor each.
 */
export function humanRoomHost(rooms: readonly HomeRoomLike[], people = Infinity, petRooms: ReadonlySet<string> = new Set()): HumanRoomHost {
    const all = rooms.map(apartmentHumanRoom).filter((r): r is HumanRoom => r !== null);
    const order = (a: HumanRoom, b: HumanRoom) => Number(petRooms.has(b.id)) - Number(petRooms.has(a.id)) || hashText(`${a.id}|home`) - hashText(`${b.id}|home`) || (a.id < b.id ? -1 : 1);
    const wanted = Number.isFinite(people) ? Math.min(all.length, Math.ceil(people / 2) + 4) : all.length;
    const list = all.sort(order).slice(0, wanted);
    return {rooms: () => list};
}
