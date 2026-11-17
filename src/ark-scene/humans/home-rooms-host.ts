/**
 * p5 (humans): people at home in the homes lane's see-into rooms. A structural adapter (no import of that lane's
 * modules, which are not on this branch yet): its `HomeRoom` apartments, furnished by its `render/pet-homes.ts`
 * `apartment()` (a sofa along the tower's wall, placed by `rng(hashText(room.id))`'s second draw), give the sofa's two
 * seats facing the glass, and the TV this lane draws (`tvs.ts`) stands before the glass facing the sofa.
 *
 * TO WIRE AFTER THE HOMES MERGE (index.ts, where `buildPetHomes(used, rooms)` is called):
 *   townHumans.setRoomHost(humanRoomHost(rooms))   // the same furnished rooms pet-homes draws, nothing else
 * and if pet-homes' sofa placement changes, change `sofaOffset` with it (the human tests pin the seats in the room).
 */

import {hashText, rng, type Box} from "@/ark-scene/islands/town/geom";
import type {HumanRoom, HumanRoomHost, Spot} from "@/ark-scene/humans/town-humans";

/** The homes lane's `HomeRoom`, as much of it as people need. */
export type HomeRoomLike = {id: string; kind: string; shell: Box; floor: number};

/** pet-homes.ts `apartment()`: the sofa's width and its offset along the wall. */
export function sofaOffset(room: HomeRoomLike): {su: number; sw: number} {
    const r = rng(hashText(room.id));
    r(); // (the sofa's colour)
    const sw = Math.min(2.4, room.shell.w * 0.4);
    return {su: (r() - 0.5) * (room.shell.w - sw - 1.6), sw};
}

function at(b: Box, lx: number, lz: number, y: number, facing: number): Spot {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    // (Local +z is the glass front: three's yaw for it is atan2(-sin, cos); `facing` turns from there.)
    return {x: b.x + lx * c - lz * s, y, z: b.z + lx * s + lz * c, yaw: Math.atan2(-s, c) + facing};
}

/** An apartment's people's places: the sofa's two seats, the TV before the glass. Garden rooms: null (no sofa yet). */
export function apartmentHumanRoom(room: HomeRoomLike): HumanRoom | null {
    if (room.kind !== "apartment") return null;
    const b = room.shell;
    const {su, sw} = sofaOffset(room);
    const seatZ = -b.d / 2 + 0.5;
    const seats = [-1, 1].map((side) => at(b, su + side * sw * 0.22, seatZ + 0.05, room.floor + 0.42, 0));
    const tv = at(b, su, b.d / 2 - 0.45, room.floor + 0.42, Math.PI);
    return {id: room.id, floor: room.floor, seats, tv, chairs: [], beds: []};
}

export function humanRoomHost(rooms: readonly HomeRoomLike[]): HumanRoomHost {
    const list = rooms.map(apartmentHumanRoom).filter((r): r is HumanRoom => r !== null);
    return {rooms: () => list};
}
