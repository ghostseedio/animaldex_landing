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
 * Here an animal's spot is a function of its zone, slot, rank, model and
 * its species' stats alone: slot k stands on a spot of the zone's grid (the
 * spiral's spots on the right ground and clear of trees and rocks: the
 * terrain only, never the other animals), picked by the species' dominance
 * and rarity (see "The stats in placement" below); rank 0 stands on it, the
 * rest close about it. A small animal (`micro.ts`) takes its slot's point
 * on its microhabitat instead (a wall of the cottage, a trunk, a flower...),
 * from the same zone, slot and rank. So nobody moves
 * when another arrives, is born, is eaten or dies, and every viewer sees the
 * same Ark. A departed animal keeps its place (the replay draws it there).
 *
 * A v1 answer has no places: `allocateArkPlaces` gives them by the server's
 * rules, in arrival order (on v1 nothing ever leaves, so that is stable too).
 * `leader` names the cluster's lowest-ranked member that is here, which the
 * others keep to as they swim or fly.
 */

import {DecorObstacles, worldDecor} from "@/ark-scene/decor";
import {burrowAt, canopyPlace, canopyPoint, speciesLayer, type Burrow, type CanopyPlace} from "@/ark-scene/layers";
import {microPlace, surfacePoint, type MicroPlace} from "@/ark-scene/micro";
import {mapPlace, mapPoints, type MapPerch, type MapPlace} from "@/ark-scene/map/place";
import {hamletPlotsFor, plotOf, plotSpots} from "@/ark-scene/map/hamlet";
import type {HomePlot} from "@/ark-scene/props/home-layout";
import {isHost} from "@/ark-scene/map/species";
import {speciesDepth, waterHomeSpot} from "@/ark-scene/sea-depth";
import {displayLength} from "@/ark-scene/sizes";
import {arkBody, arkStats} from "@/ark-scene/stats";
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
    /** A rare one partly behind a tree or a rock from the default camera: seen from the far side when flown to. */
    covered?: boolean;
    /**
     * A small animal at its microhabitat (`micro.ts`): on the cottage, a
     * trunk, a flower, a stone, the leaf litter or a pond's surface. Then
     * `ground` is the height of the surface it is on, and `x`, `z` the point.
     */
    micro?: MicroPlace;
    /** A canopy animal (`layers.ts`): on a limb, the crown or a trunk of its zone's canopy trees; `ground` is the height it is at. */
    canopy?: CanopyPlace;
    /** An underground animal: its burrow (the entrance at its spot, the tunnel and the chamber below). */
    burrow?: Burrow;
    /** At sea: the sea's swimmers loop about their spot (the map's sea tags, else a sea zone). */
    sea?: boolean;
    /** Its place on the Ark map (`map/place.ts`): the tag it stands for, its roost, its partner role; absent when placed by its zone. */
    map?: MapPlace;
    /** A small bird, bat or other vertebrate on its attach point (`map/place.ts` MapPerch): its home and roost on the behaviour schedule. */
    perch?: MapPerch;
    /** A hamlet resident (a captured pet or farm animal, `map/hamlet.ts`): its plot; `x`, `z`, `ground` are its door (indoors). */
    hamlet?: {plot: HomePlot};
    /**
     * A partner with its host aboard (section 6): a rider on its back (the
     * oxpecker on a buffalo, the remora under a shark), one at its feet (the
     * egrets), a parasite beside it (never harming it). `x`, `z`, `ground`
     * are then on or by the host's spot; its own spot is its fallback.
     */
    host?: {id: string; role: "rider" | "beside" | "parasite"; dx: number; dz: number; lift: number};
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

// MARK: Where a slot stands: the zone's grid, and the stats

/**
 * The grid: per zone, the spiral's spots on the right ground, in spiral
 * order, each given a little give of its own (so the spiral never reads as
 * a pattern). Terrain only: never the animals.
 */
const grids = new Map<string, {spots: Array<{x: number; z: number}>; next: number}>();

function gridSpot(zoneKey: string, site: ZoneSite, index: number): {x: number; z: number} {
    let grid = grids.get(zoneKey);
    if (!grid) {
        grid = {spots: [], next: 0};
        grids.set(zoneKey, grid);
    }
    while (grid.spots.length <= index && grid.next < MAX_SLOTS) {
        const spiral = grid.next++;
        const base = slot(site, spiral);
        if (!fits(site, base.x, base.z, 1)) continue;
        const spotHash = hashString(`${zoneKey}#${grid.spots.length}`);
        const jitterAngle = ((spotHash >>> 8) % 360) / 180 * Math.PI + grid.spots.length;
        const jitter = site.spacing * (site.kind === "shore" ? 0.12 : 0.22) * (((spotHash >>> 16) % 100) / 100);
        const jittered = {x: base.x + Math.cos(jitterAngle) * jitter, z: base.z + Math.sin(jitterAngle) * jitter};
        grid.spots.push(fits(site, jittered.x, jittered.z, 1) ? jittered : base);
    }
    return grid.spots[Math.min(index, grid.spots.length - 1)] ?? {x: site.x, z: site.z};
}

/**
 * The stats in placement (docs/ark-next.md, stats addendum, parts 3 and 4),
 * within the server's places: the server picks a slot (which cluster) and
 * the rank in it; the web picks which spot of the zone's grid the slot
 * stands on. While a slot holds anyone, everyone in it is one species (a
 * herd, a mate, a parent and its young), so the spot can follow the
 * species' stats without anyone ever moving: only an empty slot can change
 * species. Each kind of slot has its own spots, and slot k only ever takes
 * the k-th of its kind's (or, past their end, the plain k-th), so no two
 * slots share a spot.
 *
 * - core: a dominant species (dominance 80+) stands at the zone's middle:
 *   the first spots are kept for it.
 * - edge: a rare one (rarity 65+, when rarer than it is dominant) stands
 *   in the ring of spots at the zone's edge, by the trees;
 * - cover: some rare ones (a choice from the species' id, the slot and its
 *   rarity) stand just past the edge, at a spot with a tree or a rock
 *   between them and the default camera: partly hidden from afar, in plain
 *   view close by;
 * - plain: the rest, in slot order after the core.
 *
 * A less dominant species' herd also stands a little more spread out.
 */
const CORE_DOMINANCE = 80;
const EDGE_RARITY = 65;
const EDGE_SPOTS = 24;
/** Past the edge's spots, how many more are looked at for cover (just into the trees). */
const COVER_SCAN = 48;

export type SlotKind = "core" | "edge" | "cover" | "plain";

type Layout = {core: number; edgeFrom: number; edge: number[]; cover: number[]};
const layouts = new Map<string, Layout>();

function layoutOf(zoneKey: string, site: ZoneSite): Layout {
    const known = layouts.get(zoneKey);
    if (known) return known;
    const core = site.kind === "land" || site.kind === "sea" ? 2 : 0;
    // Where the edge begins: by the trees on land, the second ring by the lake, far out at sea.
    const edgeRadius = site.kind === "land" ? site.clearing - 2.6 : site.kind === "ring" ? LAKE.r + 1.4 + site.spacing * 0.5 : site.spacing * 3.2;
    let edgeFrom = 0;
    if (site.kind !== "shore") {
        edgeFrom = core + 8;
        while (edgeFrom < 400 && Math.hypot(gridSpot(zoneKey, site, edgeFrom).x - site.x, gridSpot(zoneKey, site, edgeFrom).z - site.z) < edgeRadius) edgeFrom++;
    }
    const edge: number[] = [];
    const cover: number[] = [];
    if (site.kind !== "shore") {
        for (let index = edgeFrom; index < edgeFrom + EDGE_SPOTS; index++) edge.push(index);
        // Just past the edge, among the first trees: the spots with something tall in front of them.
        for (let index = edgeFrom + EDGE_SPOTS; site.kind !== "sea" && index < edgeFrom + EDGE_SPOTS + COVER_SCAN; index++) {
            const spot = gridSpot(zoneKey, site, index);
            if (obstacles!.covers(spot.x, spot.z)) cover.push(index);
        }
    }
    const layout = {core, edgeFrom, edge, cover};
    layouts.set(zoneKey, layout);
    return layout;
}

/** For the tests and the probes: a zone's layout of kinds. */
export function zoneLayout(zone: ArkAnimal["zone"]): Layout & {spot: (index: number) => {x: number; z: number}} {
    obstacles ??= new DecorObstacles(worldDecor());
    const site = ZONE_SITES[zone];
    return {...layoutOf(zone, site), spot: (index) => gridSpot(zone, site, index)};
}

/** The kind of slot a species takes in this zone: from its dominance and rarity, and (for cover) its id and the slot. */
export function slotKind(animal: ArkAnimal, slotIndex: number): SlotKind {
    const site = ZONE_SITES[animal.zone] ?? ZONE_SITES.farm_garden;
    if (site.kind === "shore") return "plain";
    const {dominance, rarity} = arkStats(animal);
    const rare = rarity - EDGE_RARITY;
    const dominant = dominance - CORE_DOMINANCE;
    if (rare >= 0 && rare >= dominant) {
        const chance = Math.min(Math.max((rarity - 55) * 1.6, 0), 70);
        const species = animal.species_profile_id || animal.model_slug;
        return site.kind !== "sea" && hashString(`${species}#${animal.zone}#${slotIndex}`) % 100 < chance ? "cover" : "edge";
    }
    return dominant >= 0 && site.kind !== "ring" ? "core" : "plain";
}

/** The grid index slot k of this kind stands on. */
function gridIndex(layout: Layout, kind: SlotKind, slotIndex: number): number {
    const plain = () => {
        const index = layout.core + slotIndex;
        // Plain slots skip over the edge's and the cover's spots (kept for the rare ones).
        return index < layout.edgeFrom || layout.edgeFrom === 0 ? index : index + EDGE_SPOTS + COVER_SCAN;
    };
    if (kind === "core") return slotIndex < layout.core ? slotIndex : plain();
    if (kind === "cover" && slotIndex < layout.cover.length) return layout.cover[slotIndex];
    if ((kind === "cover" || kind === "edge") && slotIndex < layout.edge.length) return layout.edge[slotIndex];
    return plain();
}

/**
 * The rank-th spot about a cluster's centre (rank 1 the nearest), `gap`
 * apart, on the right ground, and in the gaps of the zone's grid: clear of
 * every grid spot (taken or not, so it never depends on who is aboard), so
 * a herd's members stand between their neighbours, never on one.
 */
function clusterSpot(zoneKey: string, site: ZoneSite, centreIndex: number, centre: {x: number; z: number}, gap: number, rank: number, turnHash: number): {x: number; z: number} | null {
    const c = gap / Math.sqrt(Math.PI);
    const turn = ((turnHash >>> 12) % 360) / 180 * Math.PI;
    const clear = Math.max(site.spacing * 0.32, 1);
    const reach = centreIndex + Math.ceil(15 * Math.sqrt(centreIndex + 1)) + 100;
    let found = 0;
    for (let index = 0; index < 600; index++) {
        const radius = c * Math.sqrt(index + 0.5) + gap * 0.55;
        const angle = index * GOLDEN_ANGLE + turn;
        const x = centre.x + Math.cos(angle) * radius;
        const z = centre.z + Math.sin(angle) * radius;
        if (!fits(site, x, z, 1)) continue;
        let onSpot = false;
        for (let other = 0; other < reach && !onSpot; other++) {
            if (other === centreIndex) continue;
            const spot = gridSpot(zoneKey, site, other);
            onSpot = Math.abs(spot.x - x) < clear && Math.abs(spot.z - z) < clear && Math.hypot(spot.x - x, spot.z - z) < clear;
        }
        if (onSpot) continue;
        if (++found === rank) return {x, z};
    }
    return null;
}

/**
 * Every animal's place: from its zone, slot, rank, model and its species'
 * stats alone (see above), so the same animal stands in the same spot
 * whoever else is in the list. `animals` in any order.
 */
export function placeAnimals(animals: ArkAnimal[]): Map<string, Placement> {
    obstacles ??= new DecorObstacles(worldDecor());
    const places = allocateArkPlaces(animals);
    const placed = new Map<string, Placement>();
    // The hamlet's plots for this snapshot's residents (append-only as they grow).
    const hamletPlots = hamletPlotsFor(animals);
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
        // A hamlet resident (a captured pet or farm animal): its plot, indoors at its door; the hamlet's rotation brings it out.
        const plot = plotOf(animal, hamletPlots);
        if (plot) {
            const door = plotSpots(plot).door;
            placed.set(animal.id, {x: door.x, z: door.z, ground: door.y, yaw: plot.rotation, water: false, sea: false, hamlet: {plot}});
            continue;
        }
        // The Ark map (B3): its spawn tag's place on the terrain, from the same zone, slot and rank.
        const mapped = mapPlace(animal, zoneKey as ArkAnimal["zone"], slotIndex, rank, displayLength(animal), arkBody(animal).metres, slotKind(animal, slotIndex));
        if (mapped) {
            const chosen: Placement = {x: mapped.x, z: mapped.z, ground: mapped.ground, yaw: mapped.yaw, water: mapped.water, sea: mapped.map.sea, map: mapped.map};
            if (mapped.covered) chosen.covered = true;
            if (mapped.micro) {
                const point = surfacePoint(mapped.micro, zoneKey as ArkAnimal["zone"]);
                Object.assign(chosen, {x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tx, point.tz), micro: mapped.micro});
            }
            if (mapped.canopy) {
                const point = canopyPoint(zoneKey as ArkAnimal["zone"], mapped.canopy);
                Object.assign(chosen, {x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tx, point.tz), canopy: mapped.canopy});
            }
            if (mapped.burrow) chosen.burrow = mapped.burrow;
            if (mapped.perch) chosen.perch = mapped.perch;
            const cluster = clusters.get(key)!;
            if (cluster.count > 1) {
                chosen.leader = cluster.leader;
                chosen.rank = rank;
            }
            placed.set(animal.id, chosen);
            continue;
        }
        // A small animal lives at its microhabitat: its slot's point on its spot's surfaces, its rank a step about it.
        const small = microPlace(animal.model_slug, zoneKey as ArkAnimal["zone"], slotIndex, rank, arkBody(animal).metres);
        if (small) {
            const point = surfacePoint(small, zoneKey as ArkAnimal["zone"]);
            const chosen: Placement = {x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tx, point.tz), water: small.surface === "water", micro: small};
            const cluster = clusters.get(key)!;
            if (cluster.count > 1) {
                chosen.leader = cluster.leader;
                chosen.rank = rank;
            }
            placed.set(animal.id, chosen);
            continue;
        }
        // A canopy animal: its slot's point on the zone's canopy trees.
        const layer = speciesLayer(animal.model_slug);
        if (layer.layer === "canopy") {
            const perch = canopyPlace(zoneKey as ArkAnimal["zone"], slotIndex, rank, layer.mode, displayLength(animal));
            if (perch) {
                const point = canopyPoint(zoneKey as ArkAnimal["zone"], perch);
                const chosen: Placement = {x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tx, point.tz), water: false, canopy: perch};
                const cluster = clusters.get(key)!;
                if (cluster.count > 1) {
                    chosen.leader = cluster.leader;
                    chosen.rank = rank;
                }
                placed.set(animal.id, chosen);
                continue;
            }
        }
        // A water species whose zone's own place is not its water (`sea-depth.ts`): in the lake, or the sea off its zone's coast.
        const depth = speciesDepth(animal.model_slug, zoneKey);
        const wet = depth ? waterHomeSpot(depth, zoneKey as ArkAnimal["zone"], slotIndex, rank, displayLength(animal)) : null;
        if (wet) {
            const chosen: Placement = {x: wet.x, z: wet.z, ground: sampleGround(wet.x, wet.z).height, yaw: ((slotHash >>> 4) % 1000) / 1000 * Math.PI * 2, water: true};
            const cluster = clusters.get(key)!;
            if (cluster.count > 1) {
                chosen.leader = cluster.leader;
                chosen.rank = rank;
            }
            placed.set(animal.id, chosen);
            continue;
        }
        const kind = slotKind(animal, slotIndex);
        const centreIndex = gridIndex(layoutOf(zoneKey, site), kind, slotIndex);
        const centre = gridSpot(zoneKey, site, centreIndex);
        let spot = centre;
        if (rank > 0) {
            // A less dominant kind's herd keeps a little more apart.
            const spread = 1 + 0.35 * (1 - arkStats(animal).dominance / 100);
            // (In the water, a school's members at least 1.3 body lengths apart: side by side, never touching.)
            const gap = Math.max(site.spacing * 0.45, displayLength(animal) * (depth ? 1.3 : 0.85)) * spread;
            spot = clusterSpot(zoneKey, site, centreIndex, centre, gap, rank, slotHash) ?? centre;
        }
        const chosen = placementAt(site, spot.x, spot.z, slotHash);
        chosen.sea = site.kind === "sea";
        // A cluster faces much the same way, each a little turned; a lone one as its slot says.
        if (rank > 0 && site.kind !== "sea") chosen.yaw += (((ownHash >>> 20) % 100) / 100 - 0.5) * 0.9;
        if (kind === "cover" && rank === 0 && obstacles.covers(spot.x, spot.z)) chosen.covered = true;
        // Underground: its burrow's entrance at its spot.
        if (layer.layer === "underground" && !chosen.water) chosen.burrow = burrowAt(chosen.x, chosen.z, chosen.ground, `${zoneKey}#${slotIndex}#${rank}`, displayLength(animal));
        const cluster = clusters.get(key)!;
        if (cluster.count > 1) {
            chosen.leader = cluster.leader;
            chosen.rank = rank;
        }
        placed.set(animal.id, chosen);
    }
    attachToHosts(animals, placed);
    return placed;
}

/**
 * Partners on their hosts (decision 4): each rider, follower and parasite
 * takes the host of its group that stands nearest its own spot (ties by id),
 * if one is aboard; else it stays on its own spot (its fallback). Visual
 * only, and a function of who is aboard: a rider moves off when its host
 * leaves, and back to its own spot.
 */
function attachToHosts(animals: ArkAnimal[], placed: Map<string, Placement>) {
    const partners = animals.filter((animal) => {
        const role = placed.get(animal.id)?.map?.species?.role;
        return role === "rider" || role === "beside" || role === "parasite";
    });
    if (!partners.length) return;
    for (const animal of partners) {
        const place = placed.get(animal.id)!;
        const species = place.map!.species!;
        if (!species.host) continue;
        let best: {animal: ArkAnimal; place: Placement; d: number} | null = null;
        for (const other of animals) {
            if (other.id === animal.id || !isHost(species.host, other.model_slug, other.kind_species_profile_id, other.species_profile_id)) continue;
            const there = placed.get(other.id);
            if (!there || there.map?.held) continue;
            const d = Math.hypot(there.x - place.x, there.z - place.z);
            if (!best || d < best.d || (d === best.d && other.id < best.animal.id)) best = {animal: other, place: there, d};
        }
        if (!best) continue;
        const role = species.role as "rider" | "beside" | "parasite";
        const hostLength = displayLength(best.animal);
        const hash = hashString(`${animal.id}#host`);
        const side = (hash & 1 ? 1 : -1) * (role === "rider" ? 0 : role === "beside" ? hostLength * 0.55 + 0.5 : hostLength * 0.35 + 0.15);
        const along = role === "rider" ? hostLength * 0.08 : ((hash >>> 3) % 100 / 100 - 0.5) * hostLength * 0.6;
        // Across and along the host's heading (yaw 0 faces +z).
        const c = Math.cos(best.place.yaw);
        const sn = Math.sin(best.place.yaw);
        const dx = side * c + along * sn;
        const dz = -side * sn + along * c;
        // A rider on its back (the host's drawn height, about half its length for a grazer); a remora just under a shark's belly.
        const lift = role === "rider" ? (best.place.water ? -0.25 * hostLength : 0.42 * hostLength) : 0;
        place.host = {id: best.animal.id, role, dx, dz, lift};
        place.x = best.place.x + dx;
        place.z = best.place.z + dz;
        place.ground = role === "rider" || best.place.water ? best.place.ground + lift : mapPoints().sampler.ground(place.x, place.z).height;
        place.yaw = best.place.yaw;
        place.water = best.place.water;
        place.sea = best.place.sea;
        delete place.micro;
        delete place.canopy;
        delete place.perch;
    }
}
