/**
 * Where an animal stands on the Ark map (B3): from the server's place
 * (`slot`, `slot_rank`: authoritative, never changed here), its zone and its
 * species' map entry, on whatever terrain the sampler describes. A pure
 * function of those, so nobody moves when another arrives, is born, is
 * eaten or dies, and every viewer sees the same Ark.
 *
 * - A small animal (size stat ≤ 15) sits on one of the scenery's attach
 *   points whose tag its spawn tags allow and whose size range fits it
 *   (its spawn tag first, then its other tags; its zone's own points first).
 * - A canopy animal (limb, trunk) takes a limb of a canopy tree.
 * - Everyone else stands (or swims, floats, lies on the sea floor, stands
 *   on a floe) at a launch point of its spawn tag (`points.ts`), in the
 *   water or on dry ground as it lives.
 * - Its cluster (the server's slot) takes one point; a second cluster on
 *   the same point (more clusters than points) stands a little round it;
 *   its rank a step about the cluster's spot, on the same tag's ground.
 * - Where it sleeps, when its `sleep_pattern` names somewhere else (a cave,
 *   a tree, a burrow, the reeds...): the nearest such place in its reach.
 * - A held species (decision 2, the head louse) is not placed: it waits at
 *   the landing (the jetty), never on a habitat.
 */

import {canopyPlace, canopyTrees, burrowAt, speciesLayer, type Burrow, type CanopyPlace, type LayerMode} from "@/ark-scene/layers";
import type {MicroPlace, MicroSpot} from "@/ark-scene/micro";
import {borrowedKey, clusterKey, MapPoints, pointIndex, type SlotKind, type SlotPick} from "@/ark-scene/map/points";
import {MAX_SLOPE, MOUNTAIN_SLOPE} from "@/ark-scene/behaviour-nav";
import {attachFits, type ArkMapSampler, type AttachPoint, type AttachTag} from "@/ark-scene/map/sampler";
import {isHeldOnMap, mapSpecies, type MapSpecies} from "@/ark-scene/map/species";
import {FRESH_TAGS, SEA_TAGS, TAG_AREA, type MapArea, type MapTag} from "@/ark-scene/map/tags";
import {waterSpot, waterTagAt, type WaterClass} from "@/ark-scene/map/water";
import {worldSampler} from "@/ark-scene/map/world-sampler";
import {speciesDepth, waterHomeSpot} from "@/ark-scene/sea-depth";
import {ARK_ZONES, type ArkAnimal, type ArkZone} from "@/ark-scene/types";
import {hashString, VISITOR_LANDING} from "@/ark-scene/world";

/** Where it sleeps (when that is not where it lives). */
export type MapRoost = {
    tag: MapTag;
    kind: "ground" | "water" | "attach" | "canopy" | "burrow";
    x: number;
    y: number;
    z: number;
    attach?: AttachPoint;
    canopy?: CanopyPlace;
    burrow?: Burrow;
};

export type MapPlace = {
    species: MapSpecies | null;
    /** The tag it stands for where it is (its spawn tag, or another of its own when the terrain has none of that). */
    tag: MapTag | null;
    area: MapArea | null;
    /** Held (decision 2): waiting at the landing. */
    held: boolean;
    /** At sea (the sea's swimmers loop about their spot). */
    sea: boolean;
    /** On a scenery attach point (a small animal). */
    attach?: AttachPoint;
    /** A water species (`water.ts`): placed by its depth band's water, never by a land tag. */
    water?: WaterClass;
    roost: MapRoost | null;
    /** Its cluster's key (zone and slot) and its point's level (0: on the point). */
    key: number;
    level: number;
};

/** What `placement.ts` gets back: a placement's fields. */
export type MapPlacement = {
    x: number;
    z: number;
    ground: number;
    yaw: number;
    water: boolean;
    micro?: MicroPlace;
    canopy?: CanopyPlace;
    burrow?: Burrow;
    /** A rare one behind a tree or a rock from the default camera. */
    covered?: boolean;
    map: MapPlace;
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** A hexagonal lattice's cells (axial), ring by ring out from the middle (not counting it), to ring 9. */
const HEX_SPIRAL: Array<[number, number]> = (() => {
    const cells: Array<[number, number]> = [];
    const steps: Array<[number, number]> = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (let ring = 1; ring <= 9; ring++) {
        let [i, j] = [-ring, ring];
        for (const [di, dj] of steps) {
            for (let k = 0; k < ring; k++) {
                cells.push([i, j]);
                i += di;
                j += dj;
            }
        }
    }
    return cells;
})();
const SPOT_OF: Record<AttachTag, MicroSpot> = {
    leaf: "leaf_litter", branch: "bark", bark: "bark", flower_head: "flowers", rock_face: "rocks", tide_pool: "pond_surface",
    house_wall: "house", house_eave: "house", porch_light: "lamp", worm_hole: "leaf_litter", burrow_entrance: "leaf_litter"
};

let enabled = true;
let points: MapPoints | null = null;

/** The map on (default) or off (the zone placement as before: `?map=0`, for comparing). */
export function setArkMapEnabled(on: boolean): void {
    enabled = on;
}

export function arkMapEnabled(): boolean {
    return enabled;
}

/** Use this terrain (the graphics lane's sampler when it lands); the default is the stub over today's world. */
export function setArkMapSampler(sampler: ArkMapSampler): void {
    points = new MapPoints(sampler);
}

export function mapPoints(): MapPoints {
    points ??= new MapPoints(worldSampler());
    return points;
}

/** In the water (swimmers, floaters, the sea floor's, the floes', the fixed ones of a water tag): its points are the water's. */
export function wetOf(species: MapSpecies, tag: MapTag): boolean {
    // On a dry tag (a seal's rocks, a polar bear's tundra) even a swimmer stands on dry ground.
    if (!SEA_TAGS.has(tag) && !FRESH_TAGS.has(tag)) return false;
    return ["water", "floor", "surface", "ice", "anemone", "station", "fixed"].includes(species.attach);
}

const CANOPY_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["canopy", "leaves", "trunks_bark", "bamboo", "host_nests"]);

/**
 * Lives on a canopy tree's limbs (not small, not a water species): its table
 * says a limb or a trunk; or it hangs or leaps (a sloth, a gibbon); or it is
 * of the canopy layer (`layers.json`) and climbs or perches, its text naming
 * the trees (a tree kangaroo, an orangutan, a fish eagle over the lake).
 */
export function arborealOf(species: MapSpecies, slug: string): boolean {
    if (species.small) return species.attach === "limb" || species.attach === "trunk";
    if (species.attach === "limb" || species.attach === "trunk" || species.move === "hang" || species.move === "leap") return true;
    if (species.move !== "climb" && species.move !== "perch") return false;
    // (Trees only as its roost, a cormorant's or a heron's: it lives at the water by day and sleeps in a tree, `roostOf`.)
    return speciesLayer(slug).layer === "canopy" && Array.from(species.allowed).some((tag) => CANOPY_TAGS.has(tag) && tag !== species.roost);
}

/** The tags to try, its spawn tag first. */
function tagsToTry(species: MapSpecies): MapTag[] {
    return [species.spawn, ...Array.from(species.allowed).filter((tag) => tag !== species.spawn && tag !== species.roost)];
}

function canopyMode(species: MapSpecies): LayerMode {
    return species.move === "climb" || species.move === "leap" || species.move === "hang" || species.move === "perch" ? species.move : species.move === "fly" ? "perch" : "climb";
}

/** The heading a small animal takes on its point, and its rank's offset, as `micro.ts` does. */
function attachPlace(point: AttachPoint, key: number, level: number, rank: number, length: number): MicroPlace {
    const hash = hashString(`${point.id}#${key}`);
    const clinger = point.tag === "house_wall" || point.tag === "house_eave" || point.tag === "bark";
    const heading = clinger ? ((hash & 1) ? 0 : Math.PI) + (((hash >>> 3) % 100) / 100 - 0.5) * 1.2 : ((hash >>> 3) % 360) / 180 * Math.PI;
    const gap = Math.max(length * 3.2, 0.035);
    // A second cluster on the point a few body lengths along; a cluster's members in a small spiral.
    const along = level * gap * 2.2;
    const r = rank > 0 ? gap * Math.sqrt(rank) : 0;
    return {spot: SPOT_OF[point.tag], surface: "attach", host: 0, a: 0, b: 0, heading, offAlong: along + Math.cos(rank * 2.39996) * r, offAcross: Math.sin(rank * 2.39996) * r, attach: point};
}

/**
 * An animal's place on the map, or null when the map is off or has nothing
 * for it (then `placement.ts` places it by its zone, as before). `length`
 * is its drawn length, `trueLength` its true body length (m).
 */
export function mapPlace(animal: ArkAnimal, zone: ArkZone, slot: number, rank: number, length: number, trueLength: number, kind: "core" | "edge" | "cover" | "plain" = "plain"): MapPlacement | null {
    if (!enabled) return null;
    const key = clusterKey(zone, slot);
    const ownHash = hashString(animal.id);
    if (isHeldOnMap(animal.model_slug)) {
        const depth = speciesDepth(animal.model_slug, zone);
        if (depth) {
            // A held water species waits in the water: the sea off the landing's shore (or the lake), never on the beach.
            const spot = waterHomeSpot(depth.water === "fresh" ? depth : {...depth, home: "coast"}, depth.water === "fresh" ? zone : "seashore", 400 + (key % 400), rank, length);
            if (spot) {
                const ground = mapPoints().sampler.ground(spot.x, spot.z);
                return {x: spot.x, z: spot.z, ground: ground.height, yaw: (((ownHash >>> 4) % 1000) / 1000) * Math.PI * 2, water: true, map: {species: null, tag: null, area: null, held: true, sea: depth.water === "salt", roost: null, key, level: 0}};
            }
        }
        // Waiting at the landing (the jetty's foot), in a row along the beach.
        const foot = VISITOR_LANDING.foot;
        const along = 1.6 + (key % 7) * 1.4 + rank * 0.9;
        const x = foot.x + Math.cos(VISITOR_LANDING.theta + Math.PI / 2) * along;
        const z = foot.z + Math.sin(VISITOR_LANDING.theta + Math.PI / 2) * along;
        const sampler = mapPoints().sampler;
        const ground = sampler.ground(x, z);
        return {x, z, ground: ground.height, yaw: Math.atan2(-Math.sin(VISITOR_LANDING.theta), Math.cos(VISITOR_LANDING.theta)), water: ground.depth > 0, map: {species: null, tag: null, area: null, held: true, sea: false, roost: null, key, level: 0}};
    }
    const species = mapSpecies(animal.model_slug, zone);
    if (!species) return null;
    const all = mapPoints();
    const sampler = all.sampler;
    const tags = tagsToTry(species);

    // A water species (its depth band, `sea-depth.ts`): in its band's water, never on a land tag.
    const depth = speciesDepth(animal.model_slug, zone);
    if (depth) {
        // A small one of the rocky shore's floor (a limpet, a shore crab): a tide pool, salt water at the foot of the shore's rocks.
        if (species.small && depth.water === "salt" && (depth.band === "seabed" || depth.band === "reef") && species.allowed.has("rocky_shore") && species.move !== "swim") {
            const found = all.attachOf("rocky_shore", trueLength, zone, true);
            const pools = found.list.filter((point) => point.tag === "tide_pool");
            if (pools.length) {
                const {index, level} = pointIndex(found.own ? slot : borrowedKey(zone, slot), pools.length);
                const point = pools[index];
                return {
                    x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tangent[0], point.tangent[2]), water: true, micro: attachPlace(point, key, level, rank, trueLength),
                    map: {species, tag: "rocky_shore", area: TAG_AREA.rocky_shore, held: false, sea: true, attach: point, roost: null, key, level}
                };
            }
        }
        const spot = waterSpot(all.water, depth, zone, slot, rank, length);
        if (spot) {
            const ground = sampler.ground(spot.x, spot.z);
            const tag = waterTagAt(sampler, spot.cls, spot.x, spot.z);
            return {
                x: spot.x, z: spot.z, ground: ground.height, yaw: (((ownHash >>> 4) % 1000) / 1000) * Math.PI * 2, water: true,
                map: {species, tag, area: tag ? TAG_AREA[tag] : null, held: false, sea: spot.cls !== "lake", water: spot.cls, roost: null, key, level: 0}
            };
        }
    }

    // A small animal: on an attach point.
    const watery = ["water", "floor", "surface", "fixed", "air", "station", "anemone", "ice"].includes(species.attach);
    if (species.small && !watery) {
        // Flyers perch (branches, leaves, bark, rock tops, ledges, flower heads, walls, the lamps); only crawlers, hoppers and diggers use holes.
        const holes = species.move !== "fly" && species.move !== "perch";
        // A burrower (its movement, or the layers' underground) tries its burrow's tags first.
        const digger = species.move === "burrow" || speciesLayer(animal.model_slug).layer === "underground";
        const order = digger ? [...tags.filter((tag) => tag === "burrows" || tag === "soil"), ...tags.filter((tag) => tag !== "burrows" && tag !== "soil")] : tags;
        for (const tag of order) {
            const found = all.attachOf(tag, trueLength, zone, holes);
            // A bird on bark only where its own text names bark (woodpeckers, nuthatches, treecreepers).
            // Upside down under the eaves: crawlers only (geckos, spiders), never a bird or a moth at rest.
            const list = found.list.filter((point) => !(species.move === "fly" && tag !== "trunks_bark" && point.tag === "bark") && !(point.tag === "house_eave" && species.move !== "crawl" && species.move !== "climb"));
            const own = found.own;
            if (!list.length) continue;
            const {index, level} = pointIndex(own ? slot : borrowedKey(zone, slot), list.length);
            let point = list[index];
            let memberRank = rank;
            if (rank > 0 && trueLength * 3.2 * Math.sqrt(rank) > 0.12) {
                // A cluster too big for one point: each member on the next nearest point of the same kind (within a few metres).
                const leader = point;
                const near = list.filter((other) => other !== leader && Math.hypot(other.x - leader.x, other.y - leader.y, other.z - leader.z) < 25)
                    .sort((a, b) => Math.hypot(a.x - leader.x, a.y - leader.y, a.z - leader.z) - Math.hypot(b.x - leader.x, b.y - leader.y, b.z - leader.z) || a.id.localeCompare(b.id));
                // Each a couple of body lengths from the others (greedily, nearest first).
                const spaced: AttachPoint[] = [leader];
                const gap = Math.max(2 * trueLength, 0.1);
                for (const other of near) {
                    if (spaced.length >= 12) break;
                    if (spaced.every((p) => Math.hypot(p.x - other.x, p.y - other.y, p.z - other.z) >= gap)) spaced.push(other);
                }
                // Too few for the whole cluster: they share them, round in turn.
                point = spaced[rank % spaced.length];
                memberRank = Math.floor(rank / spaced.length);
            }
            const roost = roostOf(species, all, point.x, point.z, trueLength, key, ownHash, point);
            if (digger && (point.tag === "burrow_entrance" || point.tag === "worm_hole")) {
                // A small burrower: its burrow's entrance is the point, its tunnel and chamber in the soil or sand below; it comes up to it.
                const burrow = burrowAt(point.x, point.z, point.y, `${zone}#${slot}#${rank}`, length);
                return {
                    x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tangent[0], point.tangent[2]), water: false, burrow,
                    map: {species, tag, area: TAG_AREA[tag], held: false, sea: false, attach: point, roost: null, key, level}
                };
            }
            const micro = attachPlace(point, key, level, memberRank, trueLength);
            return {
                x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tangent[0], point.tangent[2]), water: point.tag === "tide_pool", micro,
                map: {species, tag, area: TAG_AREA[tag], held: false, sea: false, attach: point, roost, key, level}
            };
        }
    }

    // A canopy animal: a limb (or the trunk) of a canopy tree. The owner's rule (2026-11-11): hangers, leapers, and the canopy layer's
    // climbers and perchers (`layers.json`) grip a real limb, never the ground under it.
    if (arborealOf(species, animal.model_slug)) {
        const canopyTag = tags.find((tag) => CANOPY_TAGS.has(tag)) ?? (species.move === "hang" || species.move === "leap" ? "canopy" : undefined);
        if (canopyTag) {
            const hostZone = canopyTrees(zone)[0]?.zone ?? zone;
            const place = canopyPlace(hostZone, key, rank, canopyMode(species), length);
            if (place) {
                place.zone = hostZone;
                if (species.attach === "trunk") place.limb = -2;
                return {
                    x: 0, z: 0, ground: 0, yaw: 0, water: false, canopy: place,
                    map: {species, tag: canopyTag, area: TAG_AREA[canopyTag], held: false, sea: false, roost: null, key, level: 0}
                };
            }
        }
    }

    // Everyone else: a cell of its tag (`points.ts`), in the water or on dry ground, its cluster's own. Its tags in its text's
    // order: the first whose list has a cell for its slot (its first lap) it can stand on; else its spawn tag's, a lap round.
    const radius = Math.min(Math.max(trueLength * 0.2, 0.1), 0.6);
    // The behaviour lane's walk grid: steep ground is a mountain animal's only (`behaviour-schedule.ts` maxSlopeOf).
    const maxSlope = zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE;
    // (Flyers, perchers and climbers may stand on a cliff's steep ground; walkers, crawlers, hoppers and diggers walk off their spot.)
    const walker = ["walk", "crawl", "slither", "hop", "burrow"].includes(species.move);
    const okOn = (wet: boolean, holds: (tags: readonly MapTag[]) => boolean) => (x: number, z: number) => {
        const g = sampler.ground(x, z);
        if (!holds(g.tags) || (g.water !== null) !== wet) return false;
        if (wet) return g.depth >= (species.attach === "water" ? 0.5 : 0.05);
        if (sampler.blocked(x, z, radius)) return false;
        return !walker || !sampler.walkable || sampler.walkable(x, z, maxSlope);
    };
    const okFor = (tag: MapTag, wet: boolean) => okOn(wet, (tags) => tags.includes(tag));
    type Choice = {tag: MapTag; wet: boolean; pick: SlotPick; ok: (x: number, z: number) => boolean};
    /** Where it can stand for a pick: its lap's spot, else the nearest within a metre that suits it, else the same round its cell's middle. */
    const settle = ({pick, ok}: Choice): {x: number; z: number} | null => {
        for (const [bx, bz] of [[pick.x, pick.z], [pick.point.x, pick.point.z]]) {
            if (ok(bx, bz)) return {x: bx, z: bz};
            for (let k = 1; k < 30; k++) {
                const r = 0.22 * Math.sqrt(k);
                const tx = bx + Math.cos(k * GOLDEN) * r;
                const tz = bz + Math.sin(k * GOLDEN) * r;
                if (ok(tx, tz)) return {x: tx, z: tz};
            }
        }
        return null;
    };
    let chosen: (Choice & {at: {x: number; z: number}}) | null = null;
    let fallback: (Choice & {at: {x: number; z: number}}) | null = null;
    let first: Choice | null = null;
    for (const tag of tags) {
        const wet = wetOf(species, tag);
        const partition = all.partitionOf(tag, wet, zone);
        if (!partition.list.length) continue;
        // The stats (docs/ark-next.md, stats addendum): a dominant kind at the list's middle, a rare one at its edge (behind
        // cover where it has it); past its kind's cells, the plain ones.
        // (A cover slot past the covered cells takes the edge's, then looks for cover round it.)
        const order: SlotKind[] = kind === "cover" ? ["cover", "edge", "plain"] : kind === "plain" ? ["plain"] : [kind, "plain"];
        let pick = all.pick(all.kindOf(partition.list, order[0]), partition.own, zone, slot);
        for (const next of order.slice(1)) if (pick.level > 0 && partition.list.length >= 12) pick = all.pick(all.kindOf(partition.list, next), partition.own, zone, slot);
        const choice: Choice = {tag, wet, pick, ok: okFor(tag, wet)};
        first ??= choice;
        // Free: its cell, or the cell's first lap (half a cell over), so it keeps to the place its text names first.
        const free = pick.level <= 1;
        const at = free || !fallback ? settle(choice) : null;
        if (at && free) {
            chosen = {...choice, at};
            break;
        }
        if (at) fallback ??= {...choice, at};
    }
    chosen ??= fallback;
    if (!chosen && !first) return null;
    const {tag, wet, pick, ok} = chosen ?? first!;
    const point = pick.point;
    let cx = chosen ? chosen.at.x : pick.x;
    let cz = chosen ? chosen.at.z : pick.z;
    // A rare kind's cover (stats addendum part 4): something tall just in front of it from the default camera, within 5 m (never by another point).
    if (kind === "cover" && !wet && sampler.covered && !sampler.covered(cx, cz)) {
        for (let k = 1; k < 100; k++) {
            const r = 0.5 * Math.sqrt(k);
            const tx = cx + Math.cos(k * GOLDEN) * r;
            const tz = cz + Math.sin(k * GOLDEN) * r;
            if (sampler.covered(tx, tz) && ok(tx, tz) && !all.nearLaunch(tx, tz, 2.4, point)) {
                cx = tx;
                cz = tz;
                break;
            }
        }
    }
    let x = cx;
    let z = cz;
    if (rank > 0) {
        // A cluster's members on a hexagonal lattice about its spot, `gap` apart (so no two ever share a spot): the rank-th cell, in rings
        // outward, of those on its own ground (the lattice turned by the slot, so neighbouring clusters do not line up).
        const gap = Math.max(1.1, length * 0.85);
        const turn = ((hashString(`${zone}#${slot}`) >>> 12) % 360) / 180 * Math.PI;
        // On its own tag's ground; where that runs out (a small patch by a rock), on any ground its text names.
        const spill = okOn(wet, (here) => here.some((t) => species.allowed.has(t)));
        for (const fits of [ok, spill]) {
            let seen = 0;
            let found = false;
            for (const [i, j] of HEX_SPIRAL) {
                const lx = gap * (i + j / 2);
                const lz = gap * (j * Math.sqrt(3) / 2);
                const tx = cx + lx * Math.cos(turn) - lz * Math.sin(turn);
                const tz = cz + lx * Math.sin(turn) + lz * Math.cos(turn);
                // Never on another cluster's launch point.
                if (!fits(tx, tz) || all.nearLaunch(tx, tz, 1.2, point)) continue;
                if (++seen === rank) {
                    x = tx;
                    z = tz;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }
    // The tag it stands for where it is (a member spilt onto its other ground stands for that).
    const here = sampler.ground(x, z).tags;
    const standsFor = here.includes(tag) ? tag : (tags.find((t) => here.includes(t)) ?? tag);
    const ground = sampler.ground(x, z);
    const turn = ((ownHash >>> 4) % 1000) / 1000;
    const yaw = wet ? turn * Math.PI * 2 : ((ownHash & 1) === 0 ? 1 : -1) * (0.35 + 0.95 * turn);
    const sea = wet && ground.water === "sea" && SEA_TAGS.has(tag);
    let base = ground.height;
    if (species.attach === "ice") base = 0.25;
    if (species.attach === "surface") base = 0;
    const placement: MapPlacement = {
        x, z, ground: base, yaw, water: wet && species.attach !== "ice", covered: kind === "cover" && rank === 0 && !wet && Boolean(sampler.covered?.(x, z)),
        map: {species, tag: standsFor, area: TAG_AREA[standsFor], held: false, sea, roost: roostOf(species, all, x, z, trueLength, key, ownHash, null), key, level: pick.level}
    };
    if (species.attach === "burrow" && !wet) placement.burrow = burrowAt(x, z, ground.height, `${zone}#${slot}#${rank}`, length);
    return placement;
}

/** How far it goes to sleep, by how it moves (m). */
function reachOf(species: MapSpecies): number {
    switch (species.move) {
        case "fly": return 45;
        case "swim": return 30;
        case "crawl": case "fixed": case "drift": return species.small ? 4 : 10;
        case "burrow": return 6;
        default: return 22;
    }
}

/**
 * Where it sleeps, when its stored `sleep_pattern` names a place that is not
 * where it lives: its own burrow under its spot (burrows, soil), the nearest
 * attach point of that tag (a small animal), the nearest canopy tree (a
 * tree, the leaves, a tree hole), or the nearest ground of that tag. None in
 * its reach: it sleeps where it is.
 */
function roostOf(species: MapSpecies, all: MapPoints, x: number, z: number, length: number, key: number, hash: number, from: AttachPoint | null): MapRoost | null {
    const tag = species.roost;
    if (!tag || species.colony) return null;
    const sampler = all.sampler;
    const reach = reachOf(species);
    const here = from ? all.tagsOf(from) : sampler.ground(x, z).tags;
    if (here.includes(tag)) return null;
    if (tag === "burrows" || tag === "soil") {
        const g = sampler.ground(x, z);
        const spot = g.tags.includes(tag) ? {x, z} : all.nearest(tag, false, x, z, reach);
        if (!spot) return null;
        const ground = sampler.ground(spot.x, spot.z).height;
        const burrow = burrowAt(spot.x, spot.z, ground, `roost#${key}#${hash}`, Math.max(length, 0.3));
        return {tag, kind: "burrow", x: spot.x, y: ground, z: spot.z, burrow};
    }
    if (species.small) {
        let best: AttachPoint | null = null;
        let distance = reach;
        for (const point of sampler.attachPoints()) {
            const d = Math.hypot(point.x - x, point.z - z);
            if (d < distance && attachFits(point, length) && all.tagsOf(point).includes(tag)) {
                best = point;
                distance = d;
            }
        }
        return best ? {tag, kind: "attach", x: best.x, y: best.y, z: best.z, attach: best} : null;
    }
    if (tag === "canopy" || tag === "leaves" || tag === "trunks_bark" || tag === "host_nests") {
        let best: {zone: ArkZone; tree: number; d: number} | null = null;
        for (const anchor of sampler.anchors()) {
            if (anchor.name !== "canopy_tree" || !anchor.tags.includes(tag)) continue;
            const d = Math.hypot(anchor.x - x, anchor.z - z);
            if (d > reach || (best && d >= best.d)) continue;
            const tree = canopyTrees(anchor.zone).findIndex((host) => host.item.x === anchor.x && host.item.z === anchor.z);
            if (tree >= 0) best = {zone: anchor.zone, tree, d};
        }
        if (!best) return null;
        const place: CanopyPlace = {tree: best.tree, limb: tag === "trunks_bark" ? -2 : key % 5, a: 0.4 + ((hash >>> 6) % 100) / 250, b: ((hash >>> 9) % 1000) / 1000, mode: species.move === "fly" ? "perch" : "climb", offset: 0, zone: best.zone};
        return {tag, kind: "canopy", x: 0, y: 0, z: 0, canopy: place};
    }
    const wet = ["lake", "pond", "coastal_shallows", "open_ocean", "stream_river", "seabed", "coral_reef", "kelp", "deep_water", "sea_surface"].includes(tag);
    const spot = all.nearest(tag, wet, x, z, reach) ?? (wet ? null : all.nearest(tag, true, x, z, reach));
    if (!spot) return null;
    const g = sampler.ground(spot.x, spot.z);
    return {tag, kind: g.water ? "water" : "ground", x: spot.x, y: g.water ? 0 : g.height, z: spot.z};
}
