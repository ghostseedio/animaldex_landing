/**
 * Underwater caves (3.3 batch, lane E; the owner, 2026-11-16: "add underwater caves"): the pure parts. Where they
 * stand and what rocks each is made of. Three.js-free; `sea-caves-render.ts` draws them.
 *
 * A cave is an arch and a short cavern on the sea bed, built from the island's own rock kit (`rock-shapes.ts`: no new
 * models): crags for its two walls, boulders closing its back, slabs laid across for its roof and a lintel over its
 * mouth, a boulder on top and one leaning on each wall, a few more and scree spilled at its feet. Its mouth looks down the bed's slope, out to the open water.
 *
 * Sites are one pure rule over the terrain (`seaCaves`), so every viewer has the same caves: points on a spiral out
 * from the island's middle, kept where the water is 3.5–9 m deep (the roof stays well under the surface at the
 * lowest tide), the bed is not steep, nothing of the reef grows in its footprint, no drawn rock or vent is in it,
 * and no other cave is near.
 *
 * Not here (said plainly in the lane's report): the caves are scenery. Swimmers are not yet steered round the rock
 * (the sea has no obstacles: its loops are not collision-resolved), and the crevice and cave species do not yet
 * sleep in them through the schedule.
 */

import {reefGrowth, seaBedAt, REEF_HEIGHT} from "@/ark-scene/reef";
import {ROCK_VARIANTS, type RockStyle} from "@/ark-scene/rock-shapes";
import {seaVents} from "@/ark-scene/sea-bubbles";
import {worldDecor} from "@/ark-scene/decor";
import {TERRAIN_HALF, arkWorld, hashString, onArkWorld, sampleGround} from "@/ark-scene/world";

export type CaveRock = {
    style: RockStyle;
    variant: number;
    /** Its base's place (world, m) and its turn about y. */
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Its drawn size along its own x, y and z (m): the kit's rock is fitted to it. */
    sx: number;
    sy: number;
    sz: number;
    /** A lean about its own x (radians): a roof slab laid across leans a little. */
    lean: number;
    part: "wall" | "back" | "roof" | "lintel" | "cap" | "spill";
};

export type SeaCave = {
    /** The middle of its mouth on the bed. */
    x: number;
    y: number;
    z: number;
    /** Its floor's height: the highest of the bed along it (the roof stands `height` over this). */
    floor: number;
    /** Water over its floor at mean tide (m). */
    depth: number;
    /** The bearing its mouth looks along (radians: x = sin, z = cos), down the slope. */
    yaw: number;
    /** Its inside: across, up and back from the mouth (m). */
    width: number;
    height: number;
    length: number;
    /** Everything within this of its middle is its own (m): the keep-clear radius. */
    reach: number;
    rocks: CaveRock[];
};

export const CAVE_MIN_DEPTH = 3.5;
export const CAVE_MAX_DEPTH = 9;
/** No two caves nearer than this (m). */
export const CAVE_SPACING = 24;
export const CAVE_LIMIT = 9;
/** The roof's top is at least this far under the mean surface (m). */
export const CAVE_ROOF_CLEAR = 0.9;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const unit = (key: string): number => (hashString(key) % 10000) / 10000;

/** A cave's middle (the centre of its cavern on the bed). */
export function caveMiddle(cave: Pick<SeaCave, "x" | "z" | "yaw" | "length">): {x: number; z: number} {
    return {x: cave.x - Math.sin(cave.yaw) * cave.length * 0.5, z: cave.z - Math.cos(cave.yaw) * cave.length * 0.5};
}

/** A cave's floor: the highest of the bed along it (it rises to the back on a slope), so the roof clears all of it. */
function floorOf(x: number, z: number, yaw: number, length: number): number {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    return Math.max(sampleGround(x, z).height, sampleGround(x - sin * length * 0.5, z - cos * length * 0.5).height, sampleGround(x - sin * length, z - cos * length).height);
}

/** The cave's rocks from its place, its bearing and its size (pure: the same rocks for the same site). */
function rocksOf(key: string, x: number, z: number, yaw: number, width: number, height: number, length: number): CaveRock[] {
    const rocks: CaveRock[] = [];
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // The cave's own frame: `across` to the mouth's right, `out` from the back to the mouth and beyond.
    const put = (part: CaveRock["part"], style: RockStyle, n: number, across: number, out: number, up: number, turn: number, sx: number, sy: number, sz: number, lean = 0) => {
        const wx = x + cos * across + sin * out;
        const wz = z - sin * across + cos * out;
        // (Each rock sits into the bed under it: the bed is not level. A wall's or the back's height is asked for above the
        // cave's floor: it is made taller by however much lower its own bed is, so it always reaches the roof.)
        const bed = sampleGround(wx, wz).height;
        if (up === 0 && (part === "wall" || part === "back")) sy += Math.max(floor - bed, 0) * 1.2;
        const base = up > 0 ? floor + up : bed - 0.18 * sy;
        // (One of the island's own shapes of the style: the kit's meshes are shared with the land's rocks.)
        rocks.push({style, variant: Math.floor(unit(`${key}#${part}${n}`) * ROCK_VARIANTS[style]), x: wx, y: base, z: wz, yaw: yaw + turn, sx, sy, sz, lean, part});
    };
    const half = width / 2;
    const floor = floorOf(x, z, yaw, length);
    // The walls: three crags a side, back from the mouth, each a little taller than the roof's underside.
    for (let k = 0; k < 3; k++) {
        const out = -length * (0.08 + 0.4 * k);
        for (const side of [-1, 1]) {
            const r = unit(`${key}#wall${k}${side}`);
            put("wall", k === 1 ? "boulder" : "crag", k * 2 + (side > 0 ? 1 : 0), side * (half + 0.55 + 0.25 * r), out + (r - 0.5) * 0.4, 0, (r - 0.5) * 0.7 + (side > 0 ? 0 : Math.PI), 1.6 + 0.5 * r, height * (1.4 + 0.15 * r), 2.1 + 0.6 * r);
        }
    }
    // The back: two boulders shoulder to shoulder closing it.
    put("back", "boulder", 0, -half * 0.55, -length - 0.25, 0, 0.3, half + 1.5, height * 1.5, 2);
    put("back", "boulder", 1, half * 0.6, -length - 0.05, 0, 2.7, half + 1.4, height * 1.42, 1.9);
    // The roof: slabs laid across from wall to wall, and the lintel over the mouth (a little proud of it: an overhang).
    const span = width + 2.5;
    put("lintel", "slab", 0, 0, 0.3, height * 0.98, Math.PI / 2, 2.3, 0.7, span, -0.06);
    put("roof", "slab", 1, 0.15, -length * 0.36, height * 1.02, Math.PI / 2 + 0.14, 2.9, 0.7, span * 1.04, 0.05);
    put("roof", "slab", 2, -0.1, -length * 0.8, height * 0.98, Math.PI / 2 - 0.1, 3, 0.75, span * 0.98, -0.04);
    // A boulder on the roof (it reads as an outcrop, not a table), and one leaning on each wall's outside.
    put("cap", "boulder", 0, half * 0.3, -length * 0.55, height * 1.04 + 0.45, 1.1, 1.9, 0.8, 1.6);
    put("spill", "boulder", 4, -(half + 1.9), -length * 0.45, 0, 0.2, 1.7, height * 0.8, 1.9);
    put("spill", "boulder", 5, half + 1.9, -length * 0.6, 0, 2.6, 1.6, height * 0.72, 1.8);
    // Spill at its feet: a boulder each side of the mouth and scree between.
    put("spill", "boulder", 0, -(half + 1.7), 0.9, 0, 0.7, 1.1, 0.7, 0.9);
    put("spill", "boulder", 1, half + 1.6, 1.2, 0, 2.1, 0.85, 0.55, 0.8);
    put("spill", "scree", 2, half + 0.5, 1.7, 0, 0.4, 0.7, 0.3, 0.7);
    put("spill", "scree", 3, -(half + 0.6), 2.1, 0, 1.9, 0.6, 0.28, 0.65);
    return rocks;
}

const caves = new Map<string, SeaCave[]>();
onArkWorld(() => caves.clear());

/** The caves of the world in use (pure, and remembered). */
export function seaCaves(): SeaCave[] {
    const world = arkWorld();
    const known = caves.get(world);
    if (known) return known;
    const found: SeaCave[] = [];
    const growth = reefGrowth();
    const rocks = worldDecor().filter((item) => item.kind === "rock" && item.y < 1);
    const vents = seaVents();
    // (The spiral runs out to the drawn ground's edge, whichever world is in use: the bigger island's sea is further out.)
    for (let k = 60; found.length < CAVE_LIMIT; k++) {
        const radius = 2.6 * Math.sqrt(k + 0.37);
        if (radius > TERRAIN_HALF * 1.05) break;
        const angle = k * GOLDEN_ANGLE + 1.3;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = sampleGround(x, z).height;
        if (height > -CAVE_MIN_DEPTH || height < -CAVE_MAX_DEPTH) continue;
        if (found.some((cave) => Math.hypot(cave.x - x, cave.z - z) < CAVE_SPACING)) continue;
        if (hashString(`cave#${k}`) % 2) continue;
        const bed = seaBedAt(x, z);
        if (bed.slope > 0.4 || bed.substrate === "reef") continue;
        const key = `cave#${k}`;
        const width = 2.4 + 1.2 * unit(`${key}#w`);
        const tall = Math.min(1.7 + 0.8 * unit(`${key}#h`), bed.depth - CAVE_ROOF_CLEAR - 1.6);
        if (tall < 1.5) continue;
        const length = 3 + 1.4 * unit(`${key}#l`);
        // Its mouth looks down the slope (out to the open water); on a level bed, away from the island.
        const e = 1.2;
        const gx = sampleGround(x + e, z).height - sampleGround(x - e, z).height;
        const gz = sampleGround(x, z + e).height - sampleGround(x, z - e).height;
        const yaw = Math.hypot(gx, gz) > 0.02 ? Math.atan2(-gx, -gz) : Math.atan2(x, z);
        const reach = Math.hypot(width / 2 + 2.3, length / 2 + 2.6);
        const middle = caveMiddle({x, z, yaw, length});
        // The whole footprint under water deep enough, and nothing else's in it.
        let fits = true;
        for (let a = 0; a < 8 && fits; a++) {
            const h = sampleGround(middle.x + Math.cos(a * Math.PI / 4) * reach * 0.75, middle.z + Math.sin(a * Math.PI / 4) * reach * 0.75).height;
            fits = h < -(tall + CAVE_ROOF_CLEAR + 0.8) && Math.abs(h - height) < 2.2;
        }
        if (!fits) continue;
        if (growth.some((item) => item.kind !== "seagrass" && item.kind !== "encrusting" && Math.hypot(item.x - middle.x, item.z - middle.z) < reach + 0.6 * item.scale)) continue;
        if (rocks.some((item) => Math.hypot(item.x - middle.x, item.z - middle.z) < reach + 1.2 * item.scale)) continue;
        if (vents.some((vent) => Math.hypot(vent.x - middle.x, vent.z - middle.z) < reach + 0.5)) continue;
        found.push({x, y: height, z, floor: floorOf(x, z, yaw, length), depth: bed.depth, yaw, width, height: tall, length, reach, rocks: rocksOf(key, x, z, yaw, width, tall, length)});
    }
    caves.set(world, found);
    return found;
}

/** The tallest thing of the reef (m at scale 1): the tests' and the placement's margin. */
export const REEF_TALLEST = Math.max(...Object.values(REEF_HEIGHT));

/**
 * A cave's breath: a thin stream of bubbles from the back of its roof, as a vent (`sea-bubbles.ts` ventBubble reads
 * it): air caught under the roof slabs leaking out. One per cave, on the shared clock like every vent.
 */
export function caveVents(): Array<{x: number; y: number; z: number; depth: number; phase: number}> {
    return seaCaves().map((cave, i) => {
        const at = {x: cave.x - Math.sin(cave.yaw) * cave.length * 0.7, z: cave.z - Math.cos(cave.yaw) * cave.length * 0.7};
        const y = cave.y + cave.height + 0.55;
        return {x: at.x, y, z: at.z, depth: -y, phase: unit(`cave-vent#${i}`)};
    });
}
