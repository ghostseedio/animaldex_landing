/**
 * What the behaviour system knows of the world: the ground's height, water,
 * slope and zone at any point, and the scenery's attach points (a branch to
 * perch on, a flower head, a rock face, a tide pool, the porch light, a
 * burrow entrance), each with its position, surface normal, orientation, tag
 * and size range.
 *
 * The graphics lane (`ark-graphics`) owns the terrain and the scenery and will
 * provide this interface from its own sampler. Until it lands, `stubSampler`
 * builds the same interface from today's terrain (`world.ts`) and scenery
 * (`decor.ts`, `micro-decor.ts`, `micro.ts`). Nothing is hand-placed: every
 * point is generated from the terrain and the scenery, so navigation and
 * interaction points rebuild whenever the terrain changes (`version`).
 */

import {worldDecor, type DecorItem} from "@/ark-scene/decor";
import {COTTAGE, GARDEN_POND, microDecor, zoneLamp, MICRO_ZONES} from "@/ark-scene/micro-decor";
import {porchLight} from "@/ark-scene/micro";
import type {ArkZone} from "@/ark-scene/types";
import {hashString, LAKE, RIVER, sampleGround, TERRAIN_HALF, zoneAt, ZONE_SITES} from "@/ark-scene/world";

/** The graphics lane's attach-point tags, plus the terrain's own (water edges, grass, ledges, shade). */
export const ATTACH_TAGS = [
    "leaf",
    "branch",
    "bark",
    "flower",
    "rock_face",
    "rock_top",
    "tide_pool",
    "house_wall",
    "porch_light",
    "worm_hole",
    "burrow_entrance",
    "water_edge",
    "grass",
    "leaf_litter",
    "cliff_ledge",
    "cave_mouth",
    "reeds",
    "shade"
] as const;
export type AttachTag = (typeof ATTACH_TAGS)[number];

export type AttachPoint = {
    id: string;
    tag: AttachTag;
    x: number;
    y: number;
    z: number;
    /** The surface normal (unit). Up for the ground, out of a wall, down under the porch roof. */
    nx: number;
    ny: number;
    nz: number;
    /** Which way along the surface it faces (radians about the normal; 0 = the surface's own +x). */
    yaw: number;
    /** The animal lengths (m) it suits. */
    size: [number, number];
    zone: ArkZone;
};

export interface ArkWorldSampler {
    /** Changes whenever the terrain or scenery does: anything built from the sampler is rebuilt. */
    readonly version: string;
    heightAt(x: number, z: number): number;
    /** Under water there (the sea, the lake, the river, a pond). */
    isWater(x: number, z: number): boolean;
    /** The ground's steepness there (rise over run). */
    slope(x: number, z: number): number;
    /** The zone a point belongs to. */
    zoneAt(x: number, z: number): ArkZone;
    /** Every attach point with this tag (optionally within r metres of a point). */
    attachPoints(tag: AttachTag, near?: {x: number; z: number; r: number}): readonly AttachPoint[];
    /** A solid obstacle there (a tree trunk, a rock, a wall) for something of this clearance. */
    blocked(x: number, z: number, clearance: number): boolean;
}

// MARK: The stub, from today's terrain and scenery

const TREE_KINDS = new Set<DecorItem["kind"]>(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "canopy"]);
const TREE_HEIGHT: Partial<Record<DecorItem["kind"], number>> = {broadleaf: 5.5, rainforest: 8, conifer: 7, acacia: 4.5, palm: 6, orchard: 3.5, canopy: 9};

class GridIndex {
    private readonly cells = new Map<string, AttachPoint[]>();
    constructor(private readonly cell: number) {}
    add(point: AttachPoint) {
        const key = `${Math.floor(point.x / this.cell)},${Math.floor(point.z / this.cell)}`;
        const list = this.cells.get(key);
        if (list) list.push(point);
        else this.cells.set(key, [point]);
    }
    near(x: number, z: number, r: number): AttachPoint[] {
        const out: AttachPoint[] = [];
        const span = Math.ceil(r / this.cell);
        const cx = Math.floor(x / this.cell);
        const cz = Math.floor(z / this.cell);
        for (let dx = -span; dx <= span; dx++) {
            for (let dz = -span; dz <= span; dz++) {
                for (const p of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(p.x - x, p.z - z) <= r) out.push(p);
            }
        }
        return out;
    }
}

const UP = {nx: 0, ny: 1, nz: 0};

export function stubSampler(): ArkWorldSampler {
    const points = new Map<AttachTag, AttachPoint[]>();
    const indexes = new Map<AttachTag, GridIndex>();
    const add = (point: Omit<AttachPoint, "id">) => {
        const list = points.get(point.tag) ?? [];
        const full = {...point, id: `${point.tag}:${list.length}`};
        list.push(full);
        points.set(point.tag, list);
        let index = indexes.get(point.tag);
        if (!index) indexes.set(point.tag, (index = new GridIndex(8)));
        index.add(full);
    };
    const zoneOf = (x: number, z: number): ArkZone => zoneAt(sampleGround(x, z)) as ArkZone;
    const decor = worldDecor();
    const obstacles: Array<[number, number, number]> = [];

    // Trees: branches up in the crown (perches and roosts), bark on the trunk, shade under them.
    for (let i = 0; i < decor.length; i++) {
        const item = decor[i];
        if (TREE_KINDS.has(item.kind)) {
            const height = (TREE_HEIGHT[item.kind] ?? 5) * item.scale;
            const zone = zoneOf(item.x, item.z);
            for (let k = 0; k < 3; k++) {
                const angle = item.rotation + (k * Math.PI * 2) / 3;
                const reach = 0.9 * item.scale + 0.3 * k;
                add({tag: "branch", x: item.x + Math.cos(angle) * reach, y: item.y + height * (0.62 + 0.08 * k), z: item.z + Math.sin(angle) * reach, ...UP, yaw: angle, size: [0.05, 1.2], zone});
            }
            add({tag: "bark", x: item.x + Math.cos(item.rotation) * 0.32 * item.scale, y: item.y + 1.2, z: item.z + Math.sin(item.rotation) * 0.32 * item.scale, nx: Math.cos(item.rotation), ny: 0, nz: Math.sin(item.rotation), yaw: Math.PI / 2, size: [0.005, 0.5], zone});
            add({tag: "shade", x: item.x + 1.6 * item.scale, y: Math.max(sampleGround(item.x + 1.6 * item.scale, item.z + 1.2 * item.scale).height, 0), z: item.z + 1.2 * item.scale, ...UP, yaw: item.rotation, size: [0.1, 4], zone});
            obstacles.push([item.x, item.z, 0.45 * item.scale]);
        } else if (item.kind === "rock") {
            const zone = zoneOf(item.x, item.z);
            const top = item.y + 0.7 * item.scale;
            add({tag: "rock_top", x: item.x, y: top, z: item.z, ...UP, yaw: item.rotation, size: [0.05, 1.6 * item.scale], zone});
            add({tag: "rock_face", x: item.x + Math.cos(item.rotation) * 0.8 * item.scale, y: item.y + 0.35 * item.scale, z: item.z + Math.sin(item.rotation) * 0.8 * item.scale, nx: Math.cos(item.rotation), ny: 0, nz: Math.sin(item.rotation), yaw: Math.PI / 2, size: [0.005, 0.4], zone});
            // A big rock in the mountains has a cave mouth at its foot (a bat's, a bear's den).
            if (item.scale > 1.4 && zone === "mountains") add({tag: "cave_mouth", x: item.x + Math.cos(item.rotation) * item.scale, y: item.y, z: item.z + Math.sin(item.rotation) * item.scale, nx: Math.cos(item.rotation), ny: 0, nz: Math.sin(item.rotation), yaw: item.rotation, size: [0.05, 2.5], zone});
            obstacles.push([item.x, item.z, 0.9 * item.scale]);
        } else if (item.kind === "reed") {
            add({tag: "reeds", x: item.x, y: item.y, z: item.z, ...UP, yaw: item.rotation, size: [0.02, 1.2], zone: zoneOf(item.x, item.z)});
        } else if (item.kind === "shrub" || item.kind === "cactus") {
            add({tag: "shade", x: item.x, y: item.y, z: item.z, ...UP, yaw: item.rotation, size: [0.02, 0.8], zone: zoneOf(item.x, item.z)});
            if (i % 3 === 0) add({tag: "burrow_entrance", x: item.x + 0.8, y: Math.max(sampleGround(item.x + 0.8, item.z + 0.5).height, 0), z: item.z + 0.5, ...UP, yaw: item.rotation, size: [0.05, 1.2], zone: zoneOf(item.x, item.z)});
            obstacles.push([item.x, item.z, 0.6 * item.scale]);
        } else if (item.kind === "barn" || item.kind === "cottage") {
            obstacles.push([item.x, item.z, item.kind === "barn" ? 5.5 : 4.4]);
        }
    }

    // The small animals' scenery: flower heads, leaves, the house walls, the porch light, the lamps.
    for (const item of microDecor()) {
        if (item.kind === "flower") add({tag: "flower", x: item.x, y: item.y + 0.4 * item.scale, z: item.z, ...UP, yaw: item.rotation, size: [0.003, 0.12], zone: item.zone});
        else if (item.kind === "leaf") add({tag: "leaf_litter", x: item.x, y: item.y, z: item.z, ...UP, yaw: item.rotation, size: [0.003, 0.3], zone: item.zone});
    }
    const c = COTTAGE;
    for (let k = 0; k < 8; k++) {
        const along = (k / 7 - 0.5) * c.width * 0.9;
        const y = c.floor + 0.4 + (k % 3) * 0.7;
        add({tag: "house_wall", x: c.x + along, y, z: c.z + c.depth / 2 + 0.02, nx: 0, ny: 0, nz: 1, yaw: 0, size: [0.003, 0.3], zone: "farm_garden"});
        add({tag: "house_wall", x: c.x + along, y, z: c.z - c.depth / 2 - 0.02, nx: 0, ny: 0, nz: -1, yaw: 0, size: [0.003, 0.3], zone: "farm_garden"});
    }
    // Under the porch roof: upside down (a gecko's ceiling).
    add({tag: "house_wall", x: c.x, y: c.floor + c.wall - 0.05, z: c.z + c.depth / 2 + c.porch.depth * 0.6, nx: 0, ny: -1, nz: 0, yaw: 0, size: [0.003, 0.2], zone: "farm_garden"});
    const porch = porchLight();
    add({tag: "porch_light", ...porch, nx: 0, ny: 0, nz: 1, yaw: 0, size: [0.003, 0.15], zone: "farm_garden"});
    for (const zone of MICRO_ZONES) {
        if (zone === "farm_garden") continue;
        const lamp = zoneLamp(zone);
        add({tag: "porch_light", x: lamp.x, y: lamp.y + 2.4, z: lamp.z, ...UP, yaw: 0, size: [0.003, 0.15], zone});
    }

    // Water edges: round the lake, along the river, round the garden pond and along the beach (sampled from the terrain).
    const edge = (x: number, z: number, outward: number, zone?: ArkZone) => {
        // Walk out from the water until the ground is just dry: that is where a drinker stands.
        for (let d = 0; d < 6; d += 0.25) {
            const px = x + Math.cos(outward) * d;
            const pz = z + Math.sin(outward) * d;
            const h = sampleGround(px, pz).height;
            if (h > 0.05) {
                add({tag: "water_edge", x: px, y: h, z: pz, ...UP, yaw: outward + Math.PI, size: [0.02, 6], zone: zone ?? zoneOf(px, pz)});
                return;
            }
        }
    };
    for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2;
        edge(LAKE.x + Math.cos(a) * (LAKE.r - 1), LAKE.z + Math.sin(a) * (LAKE.r - 1), a, "river_lake");
    }
    for (let s = 0; s + 1 < RIVER.length; s++) {
        const [ax, az] = RIVER[s];
        const [bx, bz] = RIVER[s + 1];
        const normal = Math.atan2(bx - ax, -(bz - az));
        for (let t = 0.2; t < 1; t += 0.3) {
            const x = ax + (bx - ax) * t;
            const z = az + (bz - az) * t;
            edge(x, z, normal);
            edge(x, z, normal + Math.PI);
        }
    }
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        edge(GARDEN_POND.x + Math.cos(a) * GARDEN_POND.radius * 0.6, GARDEN_POND.z + Math.sin(a) * GARDEN_POND.radius * 0.6, a, "farm_garden");
    }

    // A walk over the land on a coarse lattice: grass where it is meadow, worm holes and burrows in soft ground,
    // ledges where the coast is a cliff, tide pools on the beach's rocks.
    const step = 6;
    for (let x = -TERRAIN_HALF; x <= TERRAIN_HALF; x += step) {
        for (let z = -TERRAIN_HALF; z <= TERRAIN_HALF; z += step) {
            const jitter = hashString(`${x},${z}`);
            const px = x + ((jitter % 97) / 97 - 0.5) * step;
            const pz = z + (((jitter >> 7) % 97) / 97 - 0.5) * step;
            const sample = sampleGround(px, pz);
            if (sample.height <= 0.05) {
                // The shallows just off a beach: a tide pool.
                if (sample.height > -0.6 && sample.inland > -4 && sample.cliff < 0.3 && jitter % 4 === 0) add({tag: "tide_pool", x: px, y: sample.height, z: pz, ...UP, yaw: 0, size: [0.01, 0.6], zone: "seashore"});
                continue;
            }
            const zone = zoneAt(sample) as ArkZone;
            if (sample.cliff > 0.45 && sample.inland < 10) add({tag: "cliff_ledge", x: px, y: sample.height, z: pz, ...UP, yaw: Math.atan2(-pz, -px), size: [0.1, 1.5], zone});
            if (["grassland", "farm_garden", "river_lake", "wetland", "mountains"].includes(zone)) add({tag: "grass", x: px, y: sample.height, z: pz, ...UP, yaw: 0, size: [0.05, 5], zone});
            if (["grassland", "woodland", "farm_garden", "desert", "rainforest"].includes(zone) && jitter % 5 === 0) add({tag: "burrow_entrance", x: px, y: sample.height, z: pz, ...UP, yaw: (jitter % 628) / 100, size: [0.05, 1.2], zone});
            if (["woodland", "farm_garden", "grassland", "rainforest", "river_lake", "wetland"].includes(zone) && jitter % 7 === 0) add({tag: "worm_hole", x: px, y: sample.height, z: pz, ...UP, yaw: 0, size: [0.005, 0.4], zone});
            if (["woodland", "rainforest"].includes(zone)) add({tag: "leaf_litter", x: px, y: sample.height, z: pz, ...UP, yaw: 0, size: [0.003, 0.6], zone});
        }
    }

    const obstacleIndex = new Map<string, Array<[number, number, number]>>();
    for (const o of obstacles) {
        const key = `${Math.floor(o[0] / 6)},${Math.floor(o[1] / 6)}`;
        const list = obstacleIndex.get(key) ?? [];
        list.push(o);
        obstacleIndex.set(key, list);
    }
    const counts = ATTACH_TAGS.map((tag) => points.get(tag)?.length ?? 0).join(".");
    return {
        version: `stub:${decor.length}:${counts}`,
        heightAt: (x, z) => sampleGround(x, z).height,
        isWater: (x, z) => sampleGround(x, z).height < 0,
        slope: (x, z) => {
            const d = 0.75;
            const gx = sampleGround(x + d, z).height - sampleGround(x - d, z).height;
            const gz = sampleGround(x, z + d).height - sampleGround(x, z - d).height;
            return Math.hypot(gx, gz) / (2 * d);
        },
        zoneAt: zoneOf,
        attachPoints: (tag, near) => (near ? indexes.get(tag)?.near(near.x, near.z, near.r) ?? [] : points.get(tag) ?? []),
        blocked: (x, z, clearance) => {
            const cx = Math.floor(x / 6);
            const cz = Math.floor(z / 6);
            for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const [ox, oz, r] of obstacleIndex.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(x - ox, z - oz) < r + clearance) return true;
            return false;
        }
    };
}

let shared: ArkWorldSampler | null = null;
/** The sampler in use (the graphics lane's once it is set, the stub until then). */
export function worldSampler(): ArkWorldSampler {
    if (!shared) shared = stubSampler();
    return shared;
}
/** The graphics lane hands its sampler over here; everything built from the old one is rebuilt (its version changed). */
export function setWorldSampler(sampler: ArkWorldSampler) {
    shared = sampler;
}

/** The zone's site (its centre), where an animal's home area is when it has no spot of its own. */
export function zoneCentre(zone: ArkZone): {x: number; z: number} {
    const site = ZONE_SITES[zone];
    return {x: site.x, z: site.z};
}
