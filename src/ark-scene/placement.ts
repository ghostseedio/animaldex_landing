/**
 * Where each animal stands (Ark spec section 6: automatic, visual only).
 *
 * Each zone's animals take slots on a sunflower spiral about the zone's
 * site; the lake's take rings round its shore. Animals are placed in arrival
 * order and each starts at a slot picked from a hash of its id, then walks
 * outward to the first free one that is on the right ground (land for land
 * zones, open water for the sea's) and clear of trees and rocks. An
 * animal's place depends only on the animals that arrived before it, so it
 * never moves when another comes aboard, and every viewer sees it in the
 * same place.
 */

import {DecorObstacles, worldDecor} from "@/ark-scene/decor";
import type {ArkAnimal} from "@/ark-scene/types";
import {hashString, LAKE, riverDistance, sampleGround, ZONE_SITES, type ZoneSite} from "@/ark-scene/world";

export type Placement = {
    x: number;
    z: number;
    /** The ground (or sea floor) under it. */
    ground: number;
    /** Radians about y; 0 faces +z. */
    yaw: number;
    /** Standing in water (the sea, the lake, a wetland pool). */
    water: boolean;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_SLOTS = 6000;

function slot(site: ZoneSite, index: number): {x: number; z: number} {
    if (site.kind === "ring") {
        let ring = 0;
        let first = 0;
        for (;;) {
            const radius = LAKE.r + 1.4 + ring * site.spacing;
            const count = Math.max(6, Math.floor(2 * Math.PI * radius / site.spacing));
            if (index < first + count) {
                const angle = (index - first) / count * Math.PI * 2 + ring * 0.7 + 0.4;
                return {x: site.x + Math.cos(angle) * radius, z: site.z + Math.sin(angle) * radius};
            }
            first += count;
            ring++;
        }
    }
    const c = site.spacing / Math.sqrt(Math.PI);
    const radius = c * Math.sqrt(index + 0.5);
    const angle = index * GOLDEN_ANGLE;
    return {x: site.x + Math.cos(angle) * radius, z: site.z + Math.sin(angle) * radius};
}

let obstacles: DecorObstacles | null = null;

/** Every animal's place. `animals` in any order; arrival order is applied here. */
export function placeAnimals(animals: ArkAnimal[]): Map<string, Placement> {
    obstacles ??= new DecorObstacles(worldDecor());
    const ordered = [...animals].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id));
    const taken = new Map<string, Set<number>>();
    const placed = new Map<string, Placement>();
    for (const animal of ordered) {
        const site = ZONE_SITES[animal.zone] ?? ZONE_SITES.farm_garden;
        const zoneKey = ZONE_SITES[animal.zone] ? animal.zone : "farm_garden";
        const used = taken.get(zoneKey) ?? new Set<number>();
        taken.set(zoneKey, used);
        const hash = hashString(animal.id);
        let chosen: Placement | null = null;
        for (let index = hash % 5; index < MAX_SLOTS && !chosen; index++) {
            if (used.has(index)) continue;
            const base = slot(site, index);
            // A little give, so the spiral never reads as a pattern.
            const jitterAngle = ((hash >>> 8) % 360) / 180 * Math.PI + index;
            const jitter = site.spacing * 0.22 * (((hash >>> 16) % 100) / 100);
            const x = base.x + Math.cos(jitterAngle) * jitter;
            const z = base.z + Math.sin(jitterAngle) * jitter;
            const ground = sampleGround(x, z);
            if (site.kind === "sea") {
                if (ground.height > -1.4) continue;
            } else if (site.kind === "land") {
                if (ground.height < 0.3 || ground.land < 0.7 || riverDistance(x, z) < 3) continue;
                if (obstacles.blocked(x, z, 0.8)) continue;
            } else if (obstacles.blocked(x, z, 0.6)) {
                continue;
            }
            used.add(index);
            const turn = ((hash >>> 4) % 1000) / 1000;
            const side = (hash & 1) === 0 ? 1 : -1;
            chosen = {
                x,
                z,
                ground: ground.height,
                yaw: site.kind === "sea" ? turn * Math.PI * 2 : side * (0.35 + 0.95 * turn),
                water: ground.height < 0.05
            };
        }
        placed.set(animal.id, chosen ?? {x: site.x, z: site.z, ground: sampleGround(site.x, site.z).height, yaw: 0, water: false});
    }
    return placed;
}
