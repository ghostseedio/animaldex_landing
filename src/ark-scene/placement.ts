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
 *
 * Life v2: the young stand beside a parent; a species whose stored
 * sociality is `group` gathers about its first one in the zone (a herd, a
 * flock, a school), one that lives in pairs stands close to its mate. Still
 * only from ids, arrival order and the species' stored traits, so it is the
 * same for every viewer. `leader` names the one a group or pair keeps to, so
 * swimmers and flyers can move together.
 */

import {DecorObstacles, worldDecor} from "@/ark-scene/decor";
import {displayLength} from "@/ark-scene/sizes";
import type {ArkAnimal} from "@/ark-scene/types";
import {BEACH_INSET, coastRadius, hashString, LAKE, riverDistance, sampleGround, ZONE_SITES, type ZoneSite} from "@/ark-scene/world";

export type Placement = {
    x: number;
    z: number;
    /** The ground (or sea floor) under it. */
    ground: number;
    /** Radians about y; 0 faces +z. */
    yaw: number;
    /** Standing in water (the sea, the lake, a wetland pool). */
    water: boolean;
    /** The group's or pair's first animal, which this one keeps to (its own id for the first). */
    leader?: string;
    /** Its place in the group (0 for the leader). */
    rank?: number;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MAX_SLOTS = 6000;

function slot(site: ZoneSite, index: number): {x: number; z: number} {
    if (site.kind === "shore") {
        // Along the beach: out from the middle either way, a second row a little inland once the first is full.
        const perRow = 8;
        const row = Math.floor(index / perRow);
        const along = index % perRow;
        const step = ((along + 1) >> 1) * (along % 2 ? 1 : -1) + (row % 2) * 0.5;
        const theta = site.theta ?? 0;
        const inset = BEACH_INSET + row * 1.6;
        const angle = theta + step * site.spacing / (coastRadius(theta) - inset);
        const radius = coastRadius(angle) - inset;
        return {x: Math.cos(angle) * radius, z: Math.sin(angle) * radius};
    }
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

/** Is this spot on the right ground for the zone, and clear? */
function fits(site: ZoneSite, x: number, z: number, clearance: number): boolean {
    const ground = sampleGround(x, z);
    if (site.kind === "sea") return ground.height <= -1.4;
    if (site.kind === "shore") return !(ground.height < 0.12 || riverDistance(x, z) < 3 || obstacles!.blocked(x, z, 0.6 * clearance));
    if (site.kind === "land") return !(ground.height < 0.3 || ground.land < 0.7 || riverDistance(x, z) < 3 || obstacles!.blocked(x, z, 0.8 * clearance));
    return !obstacles!.blocked(x, z, 0.6 * clearance);
}

function placementAt(site: ZoneSite, x: number, z: number, hash: number): Placement {
    const ground = sampleGround(x, z);
    const turn = ((hash >>> 4) % 1000) / 1000;
    const side = (hash & 1) === 0 ? 1 : -1;
    return {
        x,
        z,
        ground: ground.height,
        yaw: site.kind === "sea" ? turn * Math.PI * 2 : side * (0.35 + 0.95 * turn),
        water: ground.height < 0.05
    };
}

/** Spots close about `centre`, nearest first, `gap` apart: a tight sunflower. */
function nearSpot(site: ZoneSite, centre: {x: number; z: number}, gap: number, start: number, taken: Array<{x: number; z: number; r: number}>, hash: number): {x: number; z: number} | null {
    const c = gap / Math.sqrt(Math.PI);
    const turn = ((hash >>> 12) % 360) / 180 * Math.PI;
    for (let index = start; index < start + 160; index++) {
        const radius = c * Math.sqrt(index + 0.5) + gap * 0.55;
        const angle = index * GOLDEN_ANGLE + turn;
        const x = centre.x + Math.cos(angle) * radius;
        const z = centre.z + Math.sin(angle) * radius;
        if (taken.some((other) => Math.hypot(other.x - x, other.z - z) < Math.max(other.r, gap) * 0.8)) continue;
        if (!fits(site, x, z, 1)) continue;
        return {x, z};
    }
    return null;
}

/** Every animal's place. `animals` in any order; arrival order is applied here. */
export function placeAnimals(animals: ArkAnimal[]): Map<string, Placement> {
    obstacles ??= new DecorObstacles(worldDecor());
    const ordered = [...animals].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id));
    const taken = new Map<string, Set<number>>();
    // Animals off the grid (in a group, beside a mate or a parent), per zone: grid spots keep clear of them.
    const offGrid = new Map<string, Array<{x: number; z: number; r: number}>>();
    const placed = new Map<string, Placement>();
    /** Per zone and species: the group's first animal, and how many have joined it. */
    const groups = new Map<string, {leader: string; count: number}>();
    const byId = new Map(ordered.map((animal) => [animal.id, animal]));
    for (const animal of ordered) {
        const site = ZONE_SITES[animal.zone] ?? ZONE_SITES.farm_garden;
        const zoneKey = ZONE_SITES[animal.zone] ? animal.zone : "farm_garden";
        const used = taken.get(zoneKey) ?? new Set<number>();
        taken.set(zoneKey, used);
        const loose = offGrid.get(zoneKey) ?? [];
        offGrid.set(zoneKey, loose);
        const hash = hashString(animal.id);
        const size = displayLength(animal.model_slug, null);
        const gap = Math.max(site.spacing * 0.55, size * 0.95);
        let chosen: Placement | null = null;

        // A group (or pair) of its kind already here: join it.
        const social = animal.sociality === "group" || animal.sociality === "pair";
        const groupKey = `${zoneKey}|${animal.species_profile_id || animal.model_slug}`;
        let group = social ? groups.get(groupKey) : undefined;
        // Pairs are two: a third starts a pair of its own.
        if (group && animal.sociality === "pair" && group.count >= 2) group = undefined;
        // The young stand beside a parent that is here (else with their kind).
        const parent = animal.parents?.map((id) => placed.get(id)).find((p, i) => p && byId.get(animal.parents![i])?.zone === animal.zone);
        const anchor = parent ?? (group ? placed.get(group.leader) : undefined);
        if (anchor) {
            const spot = nearSpot(site, anchor, gap, group ? group.count : 0, loose, hash);
            if (spot) {
                chosen = placementAt(site, spot.x, spot.z, hash);
                loose.push({x: spot.x, z: spot.z, r: gap});
            }
        }

        for (let index = hash % 5; index < MAX_SLOTS && !chosen; index++) {
            if (used.has(index)) continue;
            const base = slot(site, index);
            // A little give, so the spiral never reads as a pattern.
            const jitterAngle = ((hash >>> 8) % 360) / 180 * Math.PI + index;
            const jitter = site.spacing * (site.kind === "shore" ? 0.12 : 0.22) * (((hash >>> 16) % 100) / 100);
            const x = base.x + Math.cos(jitterAngle) * jitter;
            const z = base.z + Math.sin(jitterAngle) * jitter;
            if (!fits(site, x, z, 1)) continue;
            if (loose.some((other) => Math.hypot(other.x - x, other.z - z) < Math.max(other.r, site.spacing) * 0.75)) continue;
            used.add(index);
            chosen = placementAt(site, x, z, hash);
            if (social) loose.push({x, z, r: gap * 1.4});
        }
        chosen ??= {x: site.x, z: site.z, ground: sampleGround(site.x, site.z).height, yaw: 0, water: false};
        if (social) {
            if (group) {
                chosen.leader = group.leader;
                chosen.rank = group.count;
                group.count++;
                // A mate or a herd faces much the same way as its first one, a little turned.
                const lead = placed.get(group.leader);
                if (lead && site.kind !== "sea") chosen.yaw = lead.yaw + (((hash >>> 20) % 100) / 100 - 0.5) * 0.9;
            } else {
                groups.set(groupKey, {leader: animal.id, count: 1});
                chosen.leader = animal.id;
                chosen.rank = 0;
            }
        }
        placed.set(animal.id, chosen);
    }
    return placed;
}
