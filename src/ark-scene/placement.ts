/**
 * Where each animal stands (Ark spec section 6: automatic, visual only).
 *
 * Life v2: the server decides each animal's place once, when it comes
 * aboard or is born (`voyage_public_v2`'s `slot` and `slot_rank`; rules in
 * 20261111122000 `voyage_animal_place`). `slot` is a cluster in the zone: a
 * young one joins a living parent's, an animal of a `group` species its
 * herd's, of a `pair` species a lone mate's, else it takes the zone's lowest
 * slot no living animal holds. `slot_rank` is its place in the cluster.
 *
 * Here an animal's spot is a function of its zone, slot, rank and model
 * alone: slot k is the k-th spot of the zone's spiral that is on the right
 * ground and clear of trees and rocks (the terrain only, never the other
 * animals), rank 0 stands on it, the rest close about it. So nobody moves
 * when another arrives, is born, is eaten or dies, and every viewer sees the
 * same Ark. A departed animal keeps its place (the replay draws it there).
 *
 * A v1 answer has no places: `allocateArkPlaces` gives them by the server's
 * rules, in arrival order (on v1 nothing ever leaves, so that is stable too).
 * `leader` names the cluster's lowest-ranked member that is here, which the
 * others keep to as they swim or fly.
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

/** The most living animals in one cluster (the server's c_cluster). */
export const ARK_CLUSTER_MAX = 12;

export type ArkPlace = {slot: number; rank: number};

/**
 * Places for animals the server sent none for (a v1 answer), by the server's
 * rules, in arrival order. Animals that have one keep it and are counted as
 * holding it. All the animals given are taken as living.
 */
export function allocateArkPlaces(animals: ArkAnimal[]): Map<string, ArkPlace> {
    const places = new Map<string, ArkPlace>();
    /** Per zone: slot -> the members' species and ranks. */
    const zones = new Map<string, Map<number, {species: string; ranks: Set<number>}>>();
    const zoneKey = (animal: ArkAnimal) => (ZONE_SITES[animal.zone] ? animal.zone : "farm_garden");
    const hold = (animal: ArkAnimal, place: ArkPlace) => {
        const zone = zones.get(zoneKey(animal)) ?? new Map();
        zones.set(zoneKey(animal), zone);
        const cluster = zone.get(place.slot) ?? {species: animal.species_profile_id || animal.model_slug, ranks: new Set<number>()};
        zone.set(place.slot, cluster);
        cluster.ranks.add(place.rank);
        places.set(animal.id, place);
    };
    const ordered = [...animals].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id));
    for (const animal of ordered) {
        if (typeof animal.slot === "number" && typeof animal.slot_rank === "number") hold(animal, {slot: animal.slot, rank: animal.slot_rank});
    }
    for (const animal of ordered) {
        if (places.has(animal.id)) continue;
        const zone = zones.get(zoneKey(animal)) ?? new Map<number, {species: string; ranks: Set<number>}>();
        const species = animal.species_profile_id || animal.model_slug;
        let slot: number | undefined;
        if (animal.sociality === "group" || animal.sociality === "pair") {
            const room = animal.sociality === "pair" ? 2 : ARK_CLUSTER_MAX;
            slot = Array.from(zone.entries()).filter(([, c]) => c.species === species && c.ranks.size < room).map(([k]) => k).sort((a, b) => a - b)[0];
        }
        if (slot === undefined) {
            slot = 0;
            while (zone.has(slot)) slot++;
        }
        const ranks = zone.get(slot)?.ranks ?? new Set<number>();
        let rank = 0;
        while (ranks.has(rank)) rank++;
        hold(animal, {slot, rank});
    }
    return places;
}

/** Per zone, the spiral's spots on the right ground, in order: slot k stands on the k-th. Terrain only. */
const grids = new Map<string, {spots: Array<{x: number; z: number}>; next: number}>();

function gridSpot(zoneKey: string, site: ZoneSite, slotIndex: number): {x: number; z: number} {
    let grid = grids.get(zoneKey);
    if (!grid) {
        grid = {spots: [], next: 0};
        grids.set(zoneKey, grid);
    }
    while (grid.spots.length <= slotIndex && grid.next < MAX_SLOTS) {
        const base = slot(site, grid.next++);
        if (fits(site, base.x, base.z, 1)) grid.spots.push(base);
    }
    return grid.spots[Math.min(slotIndex, grid.spots.length - 1)] ?? {x: site.x, z: site.z};
}

/** Slot k's spot: the k-th grid spot, given a little give from the slot (never the animal), so the spiral never reads as a pattern. */
const centres = new Map<string, Array<{x: number; z: number}>>();

function slotCentre(zoneKey: string, site: ZoneSite, slotIndex: number): {x: number; z: number} {
    let known = centres.get(zoneKey);
    if (!known) {
        known = [];
        centres.set(zoneKey, known);
    }
    const cached = known[slotIndex];
    if (cached) return cached;
    const base = gridSpot(zoneKey, site, slotIndex);
    const slotHash = hashString(`${zoneKey}#${slotIndex}`);
    const jitterAngle = ((slotHash >>> 8) % 360) / 180 * Math.PI + slotIndex;
    const jitter = site.spacing * (site.kind === "shore" ? 0.12 : 0.22) * (((slotHash >>> 16) % 100) / 100);
    const jittered = {x: base.x + Math.cos(jitterAngle) * jitter, z: base.z + Math.sin(jitterAngle) * jitter};
    const centre = fits(site, jittered.x, jittered.z, 1) ? jittered : base;
    known[slotIndex] = centre;
    return centre;
}

/**
 * The rank-th spot about a cluster's centre (rank 1 the nearest), `gap`
 * apart, on the right ground, and in the gaps of the zone's grid: clear of
 * every slot's spot (taken or not, so it never depends on who is aboard),
 * so a herd's members stand between their neighbours, never on one.
 */
function clusterSpot(zoneKey: string, site: ZoneSite, slotIndex: number, centre: {x: number; z: number}, gap: number, rank: number, turnHash: number): {x: number; z: number} | null {
    const c = gap / Math.sqrt(Math.PI);
    const turn = ((turnHash >>> 12) % 360) / 180 * Math.PI;
    const clear = Math.max(site.spacing * 0.32, 1);
    const reach = slotIndex + Math.ceil(15 * Math.sqrt(slotIndex + 1)) + 100;
    let found = 0;
    for (let index = 0; index < 600; index++) {
        const radius = c * Math.sqrt(index + 0.5) + gap * 0.55;
        const angle = index * GOLDEN_ANGLE + turn;
        const x = centre.x + Math.cos(angle) * radius;
        const z = centre.z + Math.sin(angle) * radius;
        if (!fits(site, x, z, 1)) continue;
        let onSpot = false;
        for (let other = 0; other < reach && !onSpot; other++) {
            if (other === slotIndex) continue;
            const spot = slotCentre(zoneKey, site, other);
            onSpot = Math.abs(spot.x - x) < clear && Math.abs(spot.z - z) < clear && Math.hypot(spot.x - x, spot.z - z) < clear;
        }
        if (onSpot) continue;
        if (++found === rank) return {x, z};
    }
    return null;
}

/**
 * Every animal's place: from its zone, slot, rank and model alone (see
 * above), so the same animal stands in the same spot whoever else is in the
 * list. `animals` in any order.
 */
export function placeAnimals(animals: ArkAnimal[]): Map<string, Placement> {
    obstacles ??= new DecorObstacles(worldDecor());
    const places = allocateArkPlaces(animals);
    const placed = new Map<string, Placement>();
    /** Per zone and slot: the lowest-ranked member here, and how many are here. */
    const clusters = new Map<string, {leader: string; rank: number; count: number}>();
    for (const animal of animals) {
        const zoneKey = ZONE_SITES[animal.zone] ? animal.zone : "farm_garden";
        const {slot: slotIndex, rank} = places.get(animal.id)!;
        const key = `${zoneKey}#${slotIndex}`;
        const cluster = clusters.get(key);
        if (!cluster) clusters.set(key, {leader: animal.id, rank, count: 1});
        else {
            cluster.count++;
            if (rank < cluster.rank || (rank === cluster.rank && animal.id < cluster.leader)) Object.assign(cluster, {leader: animal.id, rank});
        }
    }
    for (const animal of animals) {
        const site = ZONE_SITES[animal.zone] ?? ZONE_SITES.farm_garden;
        const zoneKey = ZONE_SITES[animal.zone] ? animal.zone : "farm_garden";
        const {slot: slotIndex, rank} = places.get(animal.id)!;
        const key = `${zoneKey}#${slotIndex}`;
        const slotHash = hashString(key);
        const ownHash = hashString(animal.id);
        const centre = slotCentre(zoneKey, site, slotIndex);
        let spot = centre;
        if (rank > 0) {
            const gap = Math.max(site.spacing * 0.45, displayLength(animal.model_slug, null) * 0.85);
            spot = clusterSpot(zoneKey, site, slotIndex, centre, gap, rank, slotHash) ?? centre;
        }
        const chosen = placementAt(site, spot.x, spot.z, slotHash);
        // A cluster faces much the same way, each a little turned; a lone one as its slot says.
        if (rank > 0 && site.kind !== "sea") chosen.yaw += (((ownHash >>> 20) % 100) / 100 - 0.5) * 0.9;
        const cluster = clusters.get(key)!;
        if (cluster.count > 1) {
            chosen.leader = cluster.leader;
            chosen.rank = rank;
        }
        placed.set(animal.id, chosen);
    }
    return placed;
}
