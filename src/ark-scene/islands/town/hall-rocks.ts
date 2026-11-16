/**
 * p3 (solid): the aquarium hall's rocks as drawn (`render/aquarium-hall.ts`, the instanced boulders: the rockwork bands,
 * the caves' cheeks and roofs, the arches, the tunnel's banks, the sand's scatter), and a tank resident kept off them:
 * the owner, "I just saw a horse go through a bush", for the fish. A hall swimmer's loop keeps to the swim room (the
 * glass less the rockwork) and goes into the rock only through its cave (`tanks.ts` hallPose); a walker on the sand or a
 * bottom swimmer whose loop crosses a rock on the floor goes over it (lifted onto its top when the water above holds
 * it), else round it (out of its footprint). Pure in the hall's layout, the tank and the pose: the same for every viewer.
 */

import {aquariumHall} from "@/ark-scene/islands/town/aquarium-hall";
import type {Tank, TankPose} from "@/ark-scene/islands/town/tanks";
import {Geo} from "@/ark-scene/islands/town/render/kit";
import {buildAquariumHall, type HallRock} from "@/ark-scene/islands/town/render/aquarium-hall";

/** A drawn boulder is rounder than its box: its footprint is this share of its half width and depth. */
const ROUND = 0.85;

let memo: {byTank: Map<string, HallRock[]>; all: HallRock[]} | null = null;

/** Every rock in the hall (town frame), by the tank it stands in. */
export function hallRockList(): {byTank: Map<string, HallRock[]>; all: HallRock[]} {
    if (memo) return memo;
    const hall = aquariumHall();
    const all: HallRock[] = [];
    const byTank = new Map<string, HallRock[]>();
    if (hall) {
        buildAquariumHall(hall, new Geo(), [], {inside: new Geo(), under: new Geo(), glow: new Geo(), glass: new Geo(), water: new Geo()}, all);
        for (const r of all) {
            for (const t of hall.tanks) {
                const c = Math.cos(t.glass.rot);
                const s = Math.sin(t.glass.rot);
                const dx = r.x - t.glass.x;
                const dz = r.z - t.glass.z;
                if (Math.abs(dx * c + dz * s) > t.glass.w / 2 + 0.5 || Math.abs(-dx * s + dz * c) > t.glass.d / 2 + 0.5) continue;
                const list = byTank.get(t.tank.id) ?? [];
                if (!list.length) byTank.set(t.tank.id, list);
                list.push(r);
                break;
            }
        }
    }
    return (memo = {byTank, all});
}

/** How far into a rock's footprint a point is (< 1 inside: the ellipse's own measure, grown by `pad` each way). */
export function rockMeasure(r: HallRock, x: number, z: number, pad = 0): number {
    const c = Math.cos(r.turn);
    const s = Math.sin(r.turn);
    const dx = x - r.x;
    const dz = z - r.z;
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    return (lx / (r.sx * ROUND + pad)) ** 2 + (lz / (r.sz * ROUND + pad)) ** 2;
}

/** In or at the mouth of one of its tank's caves (where it goes into the rock, by design). */
function atCave(tank: Tank, x: number, z: number, length: number): boolean {
    for (const cave of tank.caves ?? []) if (Math.hypot(cave.x - x, cave.z - z) < cave.r * 1.3 + length * 0.6) return true;
    return false;
}

/**
 * A hall tank resident's pose (town frame, `tankPose`'s) kept off the rocks, moved in place: over a rock it swims or walks
 * over (its top under the water with the body's height to spare), else out of its footprint the shortest way, inside its
 * tank's glass. Its cave is left alone. `width`: its body's width (m).
 */
export function clearOfHallRocks(tank: Tank, pose: TankPose, length: number, width: number, height: number): TankPose {
    if (!tank.id.startsWith("aquarium-hall:") || pose.motion === "hole") return pose;
    const rocks = hallRockList().byTank.get(tank.id);
    if (!rocks || atCave(tank, pose.x, pose.z, length)) return pose;
    let out = pose;
    const pad = Math.max(width / 2, 0.02);
    for (let round = 0; round < 3; round++) {
        let moved = false;
        for (const r of rocks) {
            const top = r.y + r.sy;
            if (out.base >= top - 0.01 || out.base + height <= r.y + 0.02) continue;
            const m = rockMeasure(r, out.x, out.z, pad);
            if (m >= 1) continue;
            if (top + 0.02 + height <= tank.top - 0.02) {
                out = {...out, base: top + 0.02};
            } else {
                // Out along the way from its middle (to the ellipse's edge and a hair).
                const k = 1 / Math.sqrt(Math.max(m, 1e-6)) + 0.02;
                const dx = out.x - r.x;
                const dz = out.z - r.z;
                const x = m < 1e-6 ? r.x + (r.sx * ROUND + pad) * 1.02 : r.x + dx * k;
                const z = m < 1e-6 ? r.z : r.z + dz * k;
                if (!insideGlass(tank, x, z, Math.max(length, width) / 2)) continue;
                out = {...out, x, z};
            }
            moved = true;
        }
        if (!moved) break;
    }
    return out;
}

function insideGlass(t: Tank, x: number, z: number, margin: number): boolean {
    const c = Math.cos(t.rot);
    const s = Math.sin(t.rot);
    const dx = x - t.x;
    const dz = z - t.z;
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    if (t.round) return Math.hypot(lx, lz) <= t.round - margin;
    return Math.abs(lx) <= t.w / 2 - margin && Math.abs(lz) <= t.d / 2 - margin;
}
