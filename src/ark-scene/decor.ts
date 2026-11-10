/**
 * What grows and lies about in each zone: trees in the forests, an acacia
 * here and there on the grassland, conifers on the lower slopes, reeds in
 * the wetland, rocks on the shore and in the desert, ice on the polar coast,
 * coral under the reef's shallows. Placed once from a fixed seed, kept out
 * of each site's clearing (the animals' ground), off the water and away
 * from the river, so every viewer sees the same world.
 */

import {ZONE_PALETTES} from "@/ark-scene/palettes";
import {fbm, LAKE, riverDistance, sampleGround, seeded, TERRAIN_HALF, ZONE_SITES, zoneAt} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

export type DecorKind = "broadleaf" | "conifer" | "acacia" | "rock" | "reed" | "coral";

export type DecorItem = {
    kind: DecorKind;
    x: number;
    y: number;
    z: number;
    /** Overall size (1 = the kind's usual size). */
    scale: number;
    rotation: number;
    color: string;
};

/** Per zone: how many tries per 100 m², and what each try grows into. */
const GROWTH: Partial<Record<ArkZone, {density: number; pick: (r: number) => DecorKind | null}>> = {
    rainforest: {density: 4.2, pick: (r) => (r < 0.9 ? "broadleaf" : "rock")},
    woodland: {density: 3, pick: (r) => (r < 0.55 ? "broadleaf" : r < 0.92 ? "conifer" : "rock")},
    mountains: {density: 0.9, pick: (r) => (r < 0.55 ? "conifer" : "rock")},
    grassland: {density: 0.12, pick: (r) => (r < 0.75 ? "acacia" : "rock")},
    desert: {density: 0.12, pick: () => "rock"},
    wetland: {density: 2.4, pick: (r) => (r < 0.9 ? "reed" : "broadleaf")},
    river_lake: {density: 0.45, pick: (r) => (r < 0.55 ? "reed" : r < 0.85 ? "broadleaf" : "rock")},
    farm_garden: {density: 0.14, pick: (r) => (r < 0.85 ? "broadleaf" : "rock")},
    seashore: {density: 0.18, pick: () => "rock"},
    polar: {density: 0.22, pick: () => "rock"}
};

function tone(zone: ArkZone, kind: DecorKind, r: number): string {
    const palette = ZONE_PALETTES[zone];
    if (kind === "rock") {
        if (zone === "polar") return r < 0.5 ? "#e4edf2" : "#d2e0e8";
        if (zone === "desert") return r < 0.5 ? "#b98a5e" : "#a87b52";
        return r < 0.5 ? "#8a8273" : "#7a7365";
    }
    if (kind === "reed") return r < 0.5 ? "#a99a5e" : "#8d8a4a";
    return r < 0.5 ? palette.growth[0] : palette.growth[1];
}

const MAX_DENSITY = 5;

let cached: DecorItem[] | null = null;

export function worldDecor(): DecorItem[] {
    if (cached) return cached;
    const random = seeded(20261110);
    const items: DecorItem[] = [];
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
        const sample = sampleGround(x, z);
        if (sample.height < 0.35 || sample.land < 0.6) continue;
        const zone = zoneAt(sample);
        const growth = GROWTH[zone];
        if (!growth) continue;
        // Patchy, not even: denser where the noise is high.
        const patch = 0.35 + 1.3 * fbm(x * 0.05 + 40, z * 0.05 - 40);
        if (roll > growth.density / MAX_DENSITY * patch) continue;
        const site = ZONE_SITES[zone];
        if (Math.hypot(x - site.x, z - site.z) < site.clearing) continue;
        if (riverDistance(x, z) < 4.5) continue;
        if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1.5) continue;
        const kind = growth.pick(pickRoll);
        if (!kind) continue;
        // Reeds keep to the water's edge; trees thin out up the mountain.
        if (kind === "reed" && sample.height > 1.4) continue;
        if (kind === "conifer" && sample.height > 22) continue;
        if (kind === "broadleaf" && zone === "mountains") continue;
        const scale = kind === "rock" ? 0.5 + 1.2 * sizeRoll * sizeRoll : 0.75 + 0.5 * sizeRoll;
        items.push({kind, x, y: sample.height, z, scale, rotation, color: tone(zone, kind, toneRoll)});
    }

    // Coral on the reef's floor.
    const reef = ZONE_SITES.coral_reef;
    for (let i = 0; i < 140; i++) {
        const angle = random() * Math.PI * 2;
        const radius = 4 + 24 * Math.sqrt(random());
        const x = reef.x + Math.cos(angle) * radius;
        const z = reef.z + Math.sin(angle) * radius;
        const height = sampleGround(x, z).height;
        if (height > -0.6 || height < -4) continue;
        const colours = ["#e98a73", "#e6b25f", "#d9708a", "#c58fd0", "#f0c48a"];
        items.push({kind: "coral", x, y: height, z, scale: 0.5 + random() * 0.9, rotation: random() * Math.PI * 2, color: colours[Math.floor(random() * colours.length)]});
    }

    cached = items;
    return items;
}

/** Trunks and rocks the animals keep clear of: a coarse grid of (x, z, radius). */
export class DecorObstacles {
    private readonly cells = new Map<string, Array<[number, number, number]>>();
    private static readonly CELL = 6;

    constructor(items: DecorItem[]) {
        for (const item of items) {
            if (item.kind === "coral" || item.kind === "reed") continue;
            const radius = item.kind === "rock" ? 0.9 * item.scale : 0.9;
            const key = this.key(item.x, item.z);
            const list = this.cells.get(key) ?? [];
            list.push([item.x, item.z, radius]);
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
}
