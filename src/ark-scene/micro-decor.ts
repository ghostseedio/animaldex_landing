/**
 * The microhabitats' scenery (docs/ark-micro.md): where the small animals'
 * spots are, as world geometry. Pure functions of the world (`world.ts`)
 * and a fixed seed, so every viewer sees the same cottage, the same flower
 * patches and the same stones.
 *
 * - The cottage at Home, facing the default camera (south, +z), with a
 *   porch, a porch light, a garden pond beside it, a rockery, a flower bed
 *   along the front and a tree with leaf litter under it.
 * - In every other land zone a "micro corner" just past the clearing's edge
 *   toward the camera: a flower patch, a patch of leaf litter and a few
 *   stones; the zone's own trees nearby are its bark.
 *
 * `decor.ts` adds these items to the world (so the animals' grid keeps
 * clear of the cottage and the pond); `micro.ts` turns them into spots.
 */

import type {ArkZone} from "@/ark-scene/types";
import {noHamlet, onHamletSwitch} from "@/ark-scene/no-hamlet";
import {LAKE, riverDistance, sampleGround, seeded, ZONE_SITES, zoneAt} from "@/ark-scene/world";

/** The cottage: its middle on the ground, its size (m), turned to face +z (the default camera). */
export const COTTAGE = (() => {
    const farm = ZONE_SITES.farm_garden;
    const x = farm.x + 3;
    const z = farm.z + 17;
    // A small cottage at its real size (decision 34, scenery lane: it was about 0.8 of one beside true-size animals):
    // a 6.5 × 5 m footprint, eaves at 2.7 m, the ridge at 5 m. Its door (2 m) and windows were real already.
    const width = 6.5;
    const depth = 5;
    return {
        x,
        z,
        /** Faces +z: rotation about y (radians). */
        rotation: 0,
        /** Along x, along z, to the eaves. */
        width,
        depth,
        wall: 2.7,
        /** The ridge above the eaves. */
        ridge: 2.3,
        /** How far the roof reaches past the walls. */
        overhang: 0.4,
        /** The floor: a little above the ground's highest corner, so no wall sinks into the slope. */
        floor: Math.max(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([sx, sz]) => sampleGround(x + sx * (width / 2 + 0.1), z + sz * (depth / 2 + 0.1)).height)) + 0.04,
        /** The porch: a deck in front of the door, under its own little roof. */
        porch: {depth: 1.6, width: 2.8, height: 0.16},
        /** The porch light: on the front wall beside the door (local coordinates). */
        light: {x: 1.0, y: 1.85, z: depth / 2 + 0.12}
    };
})();

/** The garden pond beside the cottage (its water is drawn a little above the ground's highest rim point). */
export const GARDEN_POND = (() => {
    const x = COTTAGE.x + 6.4;
    const z = COTTAGE.z + 1.6;
    const radius = 1.35;
    let rim = -Infinity;
    for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        rim = Math.max(rim, sampleGround(x + Math.cos(a) * radius, z + Math.sin(a) * radius).height);
    }
    return {x, z, radius, y: Math.max(rim, sampleGround(x, z).height) + 0.05};
})();

/** The flowers' shapes (`vegetation.ts` draws them): stem height per variant and head radius, in the flower's own metres. */
export const FLOWER_SHAPE = {stem: [0.36, 0.46, 0.3], head: 0.06, squash: 0.55, /** The head's top above the stem, per shape, in head radii (the daisy's eye, the round head, the cup). */ top: [0.5, 0.5, 0.95]};
/** How far the instanced decor is sunk into the ground (`vegetation.ts`), except lily pads and leaves. */
export const DECOR_SINK = 0.08;
/** The leaves of the litter lie this far above the ground. */
export const LEAF_LIFT = 0.012;

/**
 * The canopy's trees (the layers addendum): a tall trunk with long limbs
 * reaching out under pads of leaves, and a crown on top. Birds perch on
 * the limbs and the crown, primates climb and leap along them, sloths hang
 * under them, lizards and snakes climb the trunk. In the tree's own metres,
 * before its turn and scale; the models face +z, angles from +z toward +x.
 */
export type CanopyLimb = {angle: number; height: number; length: number; rise: number; base: number; tip: number};
export type CanopyTree = {height: number; base: number; top: number; limbs: CanopyLimb[]; crown: {y: number; radius: number; squash: number}; pad: {lift: number; radius: number; squash: number}};

export function canopyTree(variant: number): CanopyTree {
    const height = 6.2 + variant * 0.8;
    const limbs: CanopyLimb[] = [];
    for (let k = 0; k < 5; k++) {
        limbs.push({angle: k * Math.PI * 2 / 5 + variant * 0.4 + 0.3, height: 2.7 + k * 0.62, length: 2.3 + 0.25 * (k % 2), rise: 0.26, base: 0.12, tip: 0.05});
    }
    return {height, base: 0.34, top: 0.16, limbs, crown: {y: height + 0.5, radius: 1.5, squash: 0.62}, pad: {lift: 0.8, radius: 0.85, squash: 0.5}};
}

/** A point along a limb, in the tree's own metres: where its axis is, which way it runs, and its radius there. */
export function limbAt(limb: CanopyLimb, trunkRadius: number, t: number): {x: number; y: number; z: number; dx: number; dy: number; dz: number; radius: number} {
    const dx = Math.cos(limb.rise) * Math.sin(limb.angle);
    const dy = Math.sin(limb.rise);
    const dz = Math.cos(limb.rise) * Math.cos(limb.angle);
    const along = trunkRadius * 0.8 + t * limb.length;
    return {x: dx * along, y: limb.height + dy * along, z: dz * along, dx, dy, dz, radius: limb.base + (limb.tip - limb.base) * t};
}

/** The land zones' canopy trees: how many stand about each zone's ground (the forests most). */
export const CANOPY_TREES: Partial<Record<ArkZone, number>> = {rainforest: 4, woodland: 4, river_lake: 2, wetland: 2, grassland: 2, mountains: 2};

export type MicroDecorItem = {
    kind: "cottage" | "pond" | "flower" | "leaf" | "rock" | "broadleaf" | "canopy" | "lamp";
    variant: number;
    x: number;
    y: number;
    z: number;
    scale: number;
    rotation: number;
    color: string;
    /** Which zone's micro corner it belongs to (the cottage's are farm_garden). */
    zone: ArkZone;
    /** For flowers and leaves: which patch (0 = the zone's own). */
    patch?: number;
};

const FLOWER_COLOURS = ["#f2d14b", "#f07a8a", "#f5f1e6", "#b58ae0", "#ef8f45", "#e85d5d"];
const LEAF_COLOURS = ["#9b6a36", "#7d5430", "#b2813f", "#6e4a2a", "#a3743a"];
const STONE = ["#958c7c", "#827a6c", "#a0978a"];

/** A lamp post: its height to the lamp, the post's radius. */
export const LAMP = {height: 2.4, radius: 0.055};

/** Where a land zone's lamp post stands (behind its micro corner), on the ground. Home has the porch light instead. */
export function zoneLamp(zone: ArkZone): {x: number; y: number; z: number} {
    const corner = microCorner(zone);
    const x = corner.x - 0.4;
    const z = corner.z - 1.5;
    return {x, y: sampleGround(x, z).height, z};
}

/** The land zones that get a micro corner (the sea's two zones have none). */
export const MICRO_ZONES: ArkZone[] = ["farm_garden", "seashore", "river_lake", "wetland", "rainforest", "woodland", "grassland", "desert", "mountains", "polar"];

function onLand(x: number, z: number): boolean {
    const s = sampleGround(x, z);
    return s.height > 0.35 && s.land > 0.9 && riverDistance(x, z) > 4.5 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 2;
}

/** The corner of a zone where its microhabitats are: just past the clearing, toward the camera where the ground allows. */
export function microCorner(zone: ArkZone): {x: number; z: number} {
    if (zone === "farm_garden") return {x: COTTAGE.x, z: COTTAGE.z};
    const site = ZONE_SITES[zone];
    const reach = site.kind === "ring" ? LAKE.r + 7 : site.kind === "shore" ? 4 : site.clearing + 1.8;
    // From the south (toward the camera), sweeping round either way until the ground is right.
    for (let k = 0; k < 48; k++) {
        const turn = ((k + 1) >> 1) * (k % 2 ? 1 : -1) * 0.13;
        const angle = Math.PI / 2 + turn;
        const x = site.x + Math.cos(angle) * reach;
        const z = site.z + Math.sin(angle) * reach;
        if (!onLand(x, z)) continue;
        const s = sampleGround(x, z);
        if (zone !== "seashore" && zoneAt(s) !== zone && k < 40) continue;
        return {x, z};
    }
    return {x: site.x, z: site.z};
}

let cached: MicroDecorItem[] | null = null;

/** Every microhabitat prop, from a fixed seed. */
export function microDecor(): MicroDecorItem[] {
    if (cached) return cached;
    const random = seeded(20261111);
    const items: MicroDecorItem[] = [];
    const ground = (x: number, z: number) => sampleGround(x, z).height;
    const flowerPatch = (zone: ArkZone, cx: number, cz: number, radius: number, count: number, patch: number) => {
        for (let k = 0; k < count; k++) {
            // An even scatter (a sunflower spiral), each a little off it.
            const r = radius * Math.sqrt((k + 0.5) / count);
            const a = k * 2.39996 + random() * 0.4;
            const x = cx + Math.cos(a) * r;
            const z = cz + Math.sin(a) * r;
            if (!onLand(x, z) && zone !== "seashore") continue;
            items.push({kind: "flower", variant: k % 3, x, y: ground(x, z), z, scale: 0.8 + random() * 0.45, rotation: random() * Math.PI * 2, color: FLOWER_COLOURS[Math.floor(random() * FLOWER_COLOURS.length)], zone, patch});
        }
    };
    const litterPatch = (zone: ArkZone, cx: number, cz: number, radius: number, count: number, patch: number) => {
        for (let k = 0; k < count; k++) {
            const r = radius * Math.sqrt(random());
            const a = random() * Math.PI * 2;
            const x = cx + Math.cos(a) * r;
            const z = cz + Math.sin(a) * r;
            items.push({kind: "leaf", variant: k % 2, x, y: ground(x, z), z, scale: 0.8 + random() * 0.6, rotation: random() * Math.PI * 2, color: LEAF_COLOURS[Math.floor(random() * LEAF_COLOURS.length)], zone, patch});
        }
    };
    const stones = (zone: ArkZone, cx: number, cz: number, big: number) => {
        items.push({kind: "rock", variant: 0, x: cx, y: ground(cx, cz), z: cz, scale: big, rotation: random() * Math.PI * 2, color: STONE[0], zone});
        for (let k = 0; k < 3; k++) {
            const a = k / 3 * Math.PI * 2 + random();
            const d = big * (1.05 + random() * 0.5);
            const x = cx + Math.cos(a) * d;
            const z = cz + Math.sin(a) * d;
            items.push({kind: "rock", variant: 1 + (k % 2), x, y: ground(x, z), z, scale: big * (0.4 + random() * 0.25), rotation: random() * Math.PI * 2, color: STONE[1 + (k % 2)], zone});
        }
    };

    // Home: the cottage and its garden.
    const c = COTTAGE;
    items.push({kind: "cottage", variant: 0, x: c.x, y: c.floor, z: c.z, scale: 1, rotation: c.rotation, color: "#e9dcc3", zone: "farm_garden"});
    items.push({kind: "pond", variant: 0, x: GARDEN_POND.x, y: GARDEN_POND.y, z: GARDEN_POND.z, scale: GARDEN_POND.radius, rotation: 0, color: "#4f7f86", zone: "farm_garden"});
    // A flower bed along the front, either side of the porch.
    flowerPatch("farm_garden", c.x - 2.4, c.z + c.depth / 2 + 1.1, 0.9, 9, 0);
    flowerPatch("farm_garden", c.x + 2.6, c.z + c.depth / 2 + 1.2, 0.8, 8, 1);
    // A rockery on the west side; a tree to the east with its fallen leaves.
    stones("farm_garden", c.x - 5.6, c.z + 1.4, 0.75);
    const tree = {x: c.x + 4.6, z: c.z - 3.2};
    items.push({kind: "broadleaf", variant: 1, x: tree.x, y: ground(tree.x, tree.z), z: tree.z, scale: 1.05, rotation: 0.6, color: "#6f8f3a", zone: "farm_garden"});
    litterPatch("farm_garden", tree.x + 0.4, tree.z + 1.2, 1.5, 34, 0);

    // The canopy's trees: either side of each zone's ground, toward the camera, just past the clearing.
    for (const [zone, count] of Object.entries(CANOPY_TREES) as Array<[ArkZone, number]>) {
        const site = ZONE_SITES[zone];
        const reach = site.kind === "ring" ? LAKE.r + 9 : site.clearing + 3.2;
        let placed = 0;
        for (let k = 0; placed < count && k < 40; k++) {
            const side = k % 2 ? 1 : -1;
            const angle = Math.PI / 2 + side * (0.75 + 0.42 * Math.floor(k / 2));
            const x = site.x + Math.cos(angle) * reach;
            const z = site.z + Math.sin(angle) * reach;
            if (!onLand(x, z)) continue;
            if (items.some((item) => Math.hypot(item.x - x, item.z - z) < 3.5)) continue;
            // Seated (scenery lane): its trunk's foot (0.34 m) all in the ground on a slope, with the decor's 8 cm sink.
            let foot = ground(x, z);
            for (let k = 0; k < 8; k++) foot = Math.min(foot, ground(x + Math.cos((k * Math.PI) / 4) * 0.28, z + Math.sin((k * Math.PI) / 4) * 0.28) + 0.06);
            items.push({kind: "canopy", variant: placed % 2, x, y: foot, z, scale: 1, rotation: (placed * 1.7 + angle) % (Math.PI * 2), color: zone === "rainforest" ? "#3e6a2c" : zone === "grassland" ? "#7d8540" : "#5f8a3a", zone});
            placed++;
        }
    }

    // Every other land zone: a corner of flowers, litter and stones.
    for (const zone of MICRO_ZONES) {
        if (zone === "farm_garden") continue;
        const corner = microCorner(zone);
        // Laid out across the line of sight, so all three are seen from the default camera.
        flowerPatch(zone, corner.x - 2.2, corner.z + 0.4, 0.85, 9, 0);
        litterPatch(zone, corner.x + 0.2, corner.z + 0.8, 1.1, 22, 0);
        stones(zone, corner.x + 2.6, corner.z + 0.2, zone === "mountains" || zone === "polar" ? 0.85 : 0.65);
        // A lamp post behind the patches, lit at night: the zone's own "porch light" for its moths.
        const lamp = zoneLamp(zone);
        items.push({kind: "lamp", variant: 0, x: lamp.x, y: lamp.y, z: lamp.z, scale: 1, rotation: 0, color: "#2f2a26", zone});
    }
    // Islands mode (`no-hamlet.ts`): nothing built, so no cottage, garden pond or lamp posts. The rest (the flower beds,
    // the rockery, the tree and its litter, every zone's corner) stays: the same draws, so nothing else moves.
    cached = noHamlet() ? items.filter((item) => item.kind !== "cottage" && item.kind !== "pond" && item.kind !== "lamp") : items;
    return cached;
}

onHamletSwitch(() => {
    cached = null;
});
