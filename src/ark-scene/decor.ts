/**
 * What grows and stands in each zone, placed once from a fixed seed so every
 * viewer sees the same world: layered rainforest canopy, mixed woodland,
 * conifers climbing the mountain, acacias on the savanna, cacti and dry
 * shrubs in the desert, palms on the coast, reeds and lily pads in the
 * wetland and the lake, coral and kelp on the reef, rocks in clusters, and
 * at Home a barn, hay bales, an orchard and fences. Kept out of each site's
 * clearing (the animals' ground), off the water where they don't belong and
 * away from the river.
 *
 * Grass is placed separately (`grassBlades`): it is dense, and how much of
 * it is drawn depends on the device.
 */

import {COTTAGE, GARDEN_POND, microDecor} from "@/ark-scene/micro-decor";
import {ZONE_PALETTES} from "@/ark-scene/palettes";
import {fbm, LAKE, noise, riverDistance, sampleGround, seeded, smoothstep, TERRAIN_HALF, ZONE_SITES, zoneAt} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

export type DecorKind =
    | "broadleaf"
    | "rainforest"
    | "conifer"
    | "acacia"
    | "palm"
    | "shrub"
    | "cactus"
    | "rock"
    | "reed"
    | "lily"
    | "coral"
    | "kelp"
    | "barn"
    | "hay"
    | "fence"
    | "orchard"
    // The microhabitats (`micro-decor.ts`): the cottage and its pond are drawn by `micro-scene.ts`, the rest instanced here.
    | "cottage"
    | "pond"
    | "flower"
    | "leaf"
    // The canopy's trees (`micro-decor.ts` canopyTree): limbs to perch, climb and hang on.
    | "canopy"
    // A lamp post at each land zone's micro corner (drawn by `micro-scene.ts`).
    | "lamp";

export type DecorItem = {
    kind: DecorKind;
    /** Which of the kind's shapes. */
    variant: number;
    x: number;
    y: number;
    z: number;
    /** Overall size (1 = the kind's usual size). */
    scale: number;
    rotation: number;
    color: string;
};

type Pick = (roll: number) => DecorKind | null;

/** Per zone: tries per 100 m² (out of MAX_DENSITY), and what each try becomes. */
const GROWTH: Partial<Record<ArkZone, {density: number; pick: Pick}>> = {
    rainforest: {density: 4.8, pick: (r) => (r < 0.55 ? "rainforest" : r < 0.78 ? "broadleaf" : r < 0.96 ? "shrub" : "rock")},
    woodland: {density: 3.4, pick: (r) => (r < 0.6 ? "broadleaf" : r < 0.88 ? "conifer" : r < 0.95 ? "shrub" : "rock")},
    mountains: {density: 1.1, pick: (r) => (r < 0.5 ? "conifer" : r < 0.62 ? "shrub" : "rock")},
    grassland: {density: 0.22, pick: (r) => (r < 0.5 ? "acacia" : r < 0.8 ? "shrub" : "rock")},
    desert: {density: 0.4, pick: (r) => (r < 0.32 ? "cactus" : r < 0.66 ? "shrub" : "rock")},
    wetland: {density: 2.6, pick: (r) => (r < 0.88 ? "reed" : r < 0.94 ? "broadleaf" : "shrub")},
    river_lake: {density: 0.7, pick: (r) => (r < 0.5 ? "reed" : r < 0.8 ? "broadleaf" : "rock")},
    farm_garden: {density: 0.12, pick: (r) => (r < 0.7 ? "broadleaf" : "shrub")},
    seashore: {density: 0.22, pick: (r) => (r < 0.45 ? "palm" : "rock")},
    polar: {density: 0.3, pick: () => "rock"}
};

const MAX_DENSITY = 5;

function tone(zone: ArkZone, kind: DecorKind, r: number): string {
    const palette = ZONE_PALETTES[zone];
    switch (kind) {
        case "rock":
            if (zone === "polar") return r < 0.5 ? "#eef4f7" : "#dbe6ec";
            if (zone === "desert") return r < 0.5 ? "#c39066" : "#ad7f58";
            if (zone === "mountains") return r < 0.5 ? "#8f877a" : "#7b7468";
            return r < 0.5 ? "#958c7c" : "#827a6c";
        case "reed":
            return r < 0.5 ? "#b2a565" : "#8f8f4f";
        case "shrub":
            if (zone === "desert") return r < 0.5 ? "#9c8a5a" : "#8a7a4c";
            return r < 0.5 ? "#5f7535" : "#6f7f3c";
        case "cactus":
            return r < 0.5 ? "#6d8a4c" : "#5d7a44";
        case "palm":
            return r < 0.5 ? "#6f8f3a" : "#7d9a42";
        case "acacia":
            return r < 0.5 ? "#6f7c38" : "#7d8540";
        case "conifer":
            return r < 0.5 ? "#3f5a35" : "#4a6439";
        case "rainforest":
            return r < 0.33 ? "#3e6a2c" : r < 0.66 ? "#355f29" : "#4b7531";
        default:
            return r < 0.5 ? palette.growth[0] : palette.growth[1];
    }
}

let cached: DecorItem[] | null = null;

export function worldDecor(): DecorItem[] {
    if (cached) return cached;
    const random = seeded(20261110);
    const items: DecorItem[] = [];
    const push = (item: DecorItem) => items.push(item);
    const area = (TERRAIN_HALF * 2) ** 2;
    const tries = Math.round(area / 100 * MAX_DENSITY);
    for (let i = 0; i < tries; i++) {
        const x = (random() * 2 - 1) * TERRAIN_HALF;
        const z = (random() * 2 - 1) * TERRAIN_HALF;
        const roll = random();
        const pickRoll = random();
        const toneRoll = random();
        const sizeRoll = random();
        const rotation = random() * Math.PI * 2;
        const variantRoll = random();
        const sample = sampleGround(x, z);
        if (sample.height < 0.3 || sample.land < 0.45) continue;
        const zone = zoneAt(sample);
        const growth = GROWTH[zone];
        if (!growth) continue;
        // Patchy, not even: groves and glades.
        const patch = 0.25 + 1.4 * fbm(x * 0.05 + 40, z * 0.05 - 40);
        if (roll > growth.density / MAX_DENSITY * patch) continue;
        const site = ZONE_SITES[zone];
        if (Math.hypot(x - site.x, z - site.z) < site.clearing) continue;
        if (riverDistance(x, z) < 4) continue;
        if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1.2) continue;
        const kind = growth.pick(pickRoll);
        if (!kind) continue;
        // Reeds keep to the water's edge; trees thin out up the mountain; palms keep to the sand.
        if (kind === "reed" && sample.height > 1.3) continue;
        if (kind === "conifer" && sample.height > 24) continue;
        if (kind === "broadleaf" && zone === "mountains") continue;
        if (kind === "palm" && sample.land > 0.97) continue;
        if (sample.cliff > 0.4 && kind !== "rock" && sample.land < 0.8) continue;
        const scale = kind === "rock" ? 0.5 + 1.3 * sizeRoll * sizeRoll : 0.75 + 0.55 * sizeRoll;
        const variant = Math.floor(variantRoll * 3);
        push({kind, variant, x, y: sample.height, z, scale, rotation, color: tone(zone, kind, toneRoll)});
        // Rocks come in clusters: a big one and a few smaller about it.
        if (kind === "rock") {
            const extra = 1 + Math.floor(random() * 3);
            for (let k = 0; k < extra; k++) {
                const angle = random() * Math.PI * 2;
                const distance = scale * (0.9 + random() * 0.9);
                const rx = x + Math.cos(angle) * distance;
                const rz = z + Math.sin(angle) * distance;
                const ground = sampleGround(rx, rz).height;
                push({kind: "rock", variant: Math.floor(random() * 3), x: rx, y: ground, z: rz, scale: scale * (0.3 + random() * 0.4), rotation: random() * Math.PI * 2, color: tone(zone, "rock", random())});
            }
        }
    }

    // Rocks along the cliffs and the shore, half in the water: the waves break round them.
    for (let i = 0; i < 260; i++) {
        const theta = random() * Math.PI * 2;
        const x0 = Math.cos(theta);
        const z0 = Math.sin(theta);
        let placed = false;
        for (let r = 60; r < 100 && !placed; r += 0.8) {
            const s = sampleGround(x0 * r, z0 * r);
            if (s.height < 0.15 && s.height > -0.9) {
                const site = ZONE_SITES.seashore;
                if (Math.hypot(x0 * r - site.x, z0 * r - site.z) < 16) break;
                if (riverDistance(x0 * r, z0 * r) < 6) break;
                if (s.cliff < 0.3 && random() > 0.35) break;
                const zone = zoneAt(s);
                push({kind: "rock", variant: Math.floor(random() * 3), x: x0 * r, y: s.height, z: z0 * r, scale: 0.6 + random() * 1.4, rotation: random() * Math.PI * 2, color: tone(zone === "polar" ? "polar" : "seashore", "rock", random())});
                placed = true;
            }
        }
    }

    // Lily pads on the lake's still margins and the wetland's pools.
    for (let i = 0; i < 520; i++) {
        const nearLake = random() < 0.55;
        const angle = random() * Math.PI * 2;
        const x = nearLake ? LAKE.x + Math.cos(angle) * (LAKE.r - 1.5 - random() * 3) : ZONE_SITES.wetland.x + (random() * 2 - 1) * 22;
        const z = nearLake ? LAKE.z + Math.sin(angle) * (LAKE.r - 1.5 - random() * 3) : ZONE_SITES.wetland.z + (random() * 2 - 1) * 22;
        const s = sampleGround(x, z);
        if (s.height > -0.12 || s.height < -1.6) continue;
        if (noise(x * 0.4, z * 0.4) < 0.45) continue;
        push({kind: "lily", variant: Math.floor(random() * 3), x, y: 0.02, z, scale: 0.6 + random() * 0.6, rotation: random() * Math.PI * 2, color: random() < 0.5 ? "#5f8a3c" : "#6e9844"});
    }

    // The reef: coral heads and fans on the shallow floor, kelp swaying a little deeper.
    const reef = ZONE_SITES.coral_reef;
    const corals = ["#ef8a76", "#f0b25f", "#e0708f", "#c68fd6", "#f6c98d", "#ff9f6e"];
    for (let i = 0; i < 520; i++) {
        const angle = random() * Math.PI * 2;
        const radius = 3 + 30 * Math.sqrt(random());
        const x = reef.x + Math.cos(angle) * radius;
        const z = reef.z + Math.sin(angle) * radius;
        const height = sampleGround(x, z).height;
        if (height > -0.7 || height < -6) continue;
        if (height < -2.6 && random() < 0.7) {
            // Kelp never breaks the surface: its tallest ribbon (3.4 m) stays under.
            const scale = Math.min(0.7 + random() * 0.7, (-height - 0.5) / 3.4);
            if (scale < 0.35) continue;
            push({kind: "kelp", variant: Math.floor(random() * 3), x, y: height, z, scale, rotation: random() * Math.PI * 2, color: random() < 0.5 ? "#6f7a2e" : "#8a8a35"});
        } else {
            push({kind: "coral", variant: Math.floor(random() * 3), x, y: height, z, scale: 0.5 + random() * 0.9, rotation: random() * Math.PI * 2, color: corals[Math.floor(random() * corals.length)]});
        }
    }

    // Home: a barn on the fields' edge, hay bales, an orchard in rows, and fences along the lanes.
    const farm = ZONE_SITES.farm_garden;
    const onFarm = (x: number, z: number) => {
        const s = sampleGround(x, z);
        return s.height > 0.4 && s.land > 0.9 && zoneAt(s) === "farm_garden" && riverDistance(x, z) > 5 && Math.hypot(x - farm.x, z - farm.z) > farm.clearing + 1;
    };
    const barn = {x: farm.x - 15, z: farm.z + 9};
    if (onFarm(barn.x, barn.z)) push({kind: "barn", variant: 0, x: barn.x, y: sampleGround(barn.x, barn.z).height, z: barn.z, scale: 1, rotation: 0.35, color: "#9a4a36"});
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
            const x = farm.x + 16 + col * 3.2 + (row % 2) * 1.6;
            const z = farm.z - 6 + row * 3.4;
            if (!onFarm(x, z)) continue;
            push({kind: "orchard", variant: (row + col) % 3, x, y: sampleGround(x, z).height, z, scale: 0.85 + random() * 0.25, rotation: random() * Math.PI * 2, color: random() < 0.5 ? "#5f8a3a" : "#6b9440"});
        }
    }
    for (let i = 0; i < 60; i++) {
        const x = farm.x + (random() * 2 - 1) * 30;
        const z = farm.z + (random() * 2 - 1) * 24;
        if (!onFarm(x, z) || noise(x * 0.12, z * 0.12) < 0.5) continue;
        push({kind: "hay", variant: 0, x, y: sampleGround(x, z).height, z, scale: 0.9 + random() * 0.2, rotation: random() * Math.PI, color: "#d8b45c"});
    }
    // Fences: lines of posts and rails along the field boundaries (the fields' own grid, turned as the shader turns them).
    const along = {x: 0.94, z: 0.34};
    const across = {x: -0.34, z: 0.94};
    for (const line of [-2, 1, 3]) {
        for (let k = -14; k < 14; k++) {
            // A field boundary every 6.5 m across, segments 2.4 m long along it.
            const u = k * 2.4;
            const v = line * 6.5 + 0.2;
            const wx = along.x * u + across.x * v;
            const wz = along.z * u + across.z * v;
            if (!onFarm(wx, wz) || noise(wx * 0.08 + 11, wz * 0.08) < 0.35) continue;
            push({kind: "fence", variant: 0, x: wx, y: sampleGround(wx, wz).height, z: wz, scale: 1, rotation: -Math.atan2(along.z, along.x), color: "#8a6a48"});
        }
    }

    // The microhabitats: the cottage at Home with its garden, and a corner of flowers, litter and stones in every land zone.
    // Nothing of the farm stands in the cottage, its porch or its pond.
    const clear = (item: DecorItem) => {
        const inCottage = Math.abs(item.x - COTTAGE.x) < COTTAGE.width / 2 + 1.4 && item.z - COTTAGE.z < COTTAGE.depth / 2 + COTTAGE.porch.depth + 1.6 && COTTAGE.z - item.z < COTTAGE.depth / 2 + 1.4;
        return !inCottage && Math.hypot(item.x - GARDEN_POND.x, item.z - GARDEN_POND.z) > GARDEN_POND.radius + 0.8;
    };
    const kept = items.filter(clear);
    for (const item of microDecor()) kept.push({kind: item.kind, variant: item.variant, x: item.x, y: item.y, z: item.z, scale: item.scale, rotation: item.rotation, color: item.color});

    cached = kept;
    return kept;
}

/** Grass tufts, densest on the meadows, thinning to nothing on sand, rock, snow and the fields. */
export type GrassTuft = {x: number; y: number; z: number; scale: number; rotation: number; zone: ArkZone; dry: number};

export function grassTufts(count: number): GrassTuft[] {
    const random = seeded(77001);
    const tufts: GrassTuft[] = [];
    const meadow: Partial<Record<ArkZone, number>> = {grassland: 1, woodland: 0.75, farm_garden: 0.55, river_lake: 0.85, wetland: 0.6, rainforest: 0.45, mountains: 0.35, seashore: 0.12};
    let guard = 0;
    while (tufts.length < count && guard++ < count * 12) {
        const x = (random() * 2 - 1) * 100;
        const z = (random() * 2 - 1) * 100;
        const s = sampleGround(x, z);
        if (s.height < 0.35 || s.land < 0.85 || s.height > 20) continue;
        const zone = zoneAt(s);
        // Fuller round the animals' own ground, where the camera comes close.
        const site = ZONE_SITES[zone];
        const nearAnimals = site.kind === "land" && Math.hypot(x - site.x, z - site.z) < site.clearing + 6 ? 1.8 : 1;
        const want = (meadow[zone] ?? 0) * nearAnimals * smoothstep(0.15, 0.5, fbm(x * 0.06 - 7, z * 0.06 + 3) + (nearAnimals > 1 ? 0.2 : 0));
        if (random() > want) continue;
        if (riverDistance(x, z) < 3) continue;
        // Not through the garden pond's water or the cottage's floor.
        if (Math.hypot(x - GARDEN_POND.x, z - GARDEN_POND.z) < GARDEN_POND.radius + 0.3 || (Math.abs(x - COTTAGE.x) < COTTAGE.width / 2 + 0.2 && Math.abs(z - COTTAGE.z - COTTAGE.porch.depth / 2) < COTTAGE.depth / 2 + COTTAGE.porch.depth / 2 + 0.2)) continue;
        tufts.push({x, y: s.height, z, scale: 0.45 + random() * 0.4, rotation: random() * Math.PI * 2, zone, dry: zone === "grassland" ? 0.75 + 0.25 * random() : zone === "mountains" ? 0.4 : 0.15 * random()});
    }
    return tufts;
}

/** Trunks, rocks and buildings the animals keep clear of: a coarse grid of (x, z, radius). */
export class DecorObstacles {
    private readonly cells = new Map<string, Array<[number, number, number, number]>>();
    private static readonly CELL = 6;

    constructor(items: DecorItem[]) {
        for (const item of items) {
            if (item.kind === "coral" || item.kind === "reed" || item.kind === "lily" || item.kind === "kelp" || item.kind === "fence" || item.kind === "flower" || item.kind === "leaf") continue;
            const radius = item.kind === "rock" ? 0.9 * item.scale : item.kind === "barn" ? 5.5 : item.kind === "cottage" ? 4.4 : item.kind === "pond" ? item.scale + 0.5 : item.kind === "lamp" ? 0.3 : item.kind === "hay" ? 1.1 : 0.9;
            // Tall enough to stand between an animal and the camera: trees, shrubs, cacti, a big rock.
            const tall = item.kind === "rock" ? radius >= 0.65 : item.kind !== "hay" && item.kind !== "barn" && item.kind !== "pond";
            const key = this.key(item.x, item.z);
            const list = this.cells.get(key) ?? [];
            list.push([item.x, item.z, radius, tall ? 1 : 0]);
            this.cells.set(key, list);
        }
    }

    private key(x: number, z: number): string {
        return `${Math.floor(x / DecorObstacles.CELL)},${Math.floor(z / DecorObstacles.CELL)}`;
    }

    blocked(x: number, z: number, clearance: number): boolean {
        const cx = Math.floor(x / DecorObstacles.CELL);
        const cz = Math.floor(z / DecorObstacles.CELL);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const [ox, oz, r] of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) {
                    if (Math.hypot(x - ox, z - oz) < r + clearance) return true;
                }
            }
        }
        return false;
    }

    /**
     * Something tall just in front of this spot as the default camera sees
     * it (from the south, +z): a tree, a shrub or a big rock between about 1
     * and 5.5 m nearer the camera and across the line of sight, so an animal
     * here is partly behind it from afar and in plain view from close by.
     */
    covers(x: number, z: number): boolean {
        const cx = Math.floor(x / DecorObstacles.CELL);
        const cz = Math.floor(z / DecorObstacles.CELL);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = 0; dz <= 1; dz++) {
                for (const [ox, oz, r, tall] of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) {
                    if (!tall) continue;
                    const ahead = oz - z;
                    if (ahead > 0.9 + r * 0.5 && ahead < 5.5 && Math.abs(ox - x) < r + 0.3) return true;
                }
            }
        }
        return false;
    }
}
