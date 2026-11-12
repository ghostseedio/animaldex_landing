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

import {onHamletSwitch} from "@/ark-scene/no-hamlet";
import {canopyPlace, canopyPoint, canopyTrees, burrowAt, speciesLayer, type Burrow, type CanopyPlace, type LayerMode} from "@/ark-scene/layers";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {surfacePoint, type MicroPlace, type MicroSpot} from "@/ark-scene/micro";
import {borrowedKey, clusterKey, MapPoints, pointIndex, type SlotKind, type SlotPick} from "@/ark-scene/map/points";
import {MAX_SLOPE, MOUNTAIN_SLOPE} from "@/ark-scene/behaviour-nav";
import {attachFits, type ArkMapSampler, type AttachPoint, type AttachTag} from "@/ark-scene/map/sampler";
import {bodyOf, isHeldOnMap, mapSpecies, trueMicro, type MapSpecies} from "@/ark-scene/map/species";
import {arkStats, massFromSize} from "@/ark-scene/stats";
import {FRESH_TAGS, SEA_TAGS, TAG_AREA, type MapArea, type MapTag} from "@/ark-scene/map/tags";
import {waterSpot, waterTagAt, type WaterClass} from "@/ark-scene/map/water";
import {worldSampler} from "@/ark-scene/map/world-sampler";
import {speciesDepth, waterHomeSpot} from "@/ark-scene/sea-depth";
import {place as scenePlace} from "@/ark-scene/sampler";
import {ARK_ZONES, type ArkAnimal, type ArkZone} from "@/ark-scene/types";
import {arkWorld, hashString, onArkWorld, VISITOR_LANDING, ZONE_SITES} from "@/ark-scene/world";
import {rangeSpot, resetWildMapV2, takesRange, wildCoveCentre} from "@/ark-scene/islands/wild/map-v2";
import {drawnRocks, inRock, type DrawnRock} from "@/ark-scene/map/rocks";

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
    /** A diver that hauls out (a penguin, a seal): on its shore, the cold cove's or its own coast's (`haulsOut`). */
    shore?: "cove" | "coast";
    roost: MapRoost | null;
    /** Its cluster's key (zone and slot) and its point's level (0: on the point). */
    key: number;
    level: number;
    /** Whose place it is (its species and drawn length), for its den on the schedule (`scheduleRoost`). */
    who?: {slug: string; length: number};
    /** Where it sleeps on the schedule, worked out with its place (`settleRoosts`); null: the schedule's own choice. */
    den?: ScheduleSpot | null;
};

/** A perch: a bird's, a bat's or a small vertebrate's attach point, as the surface it stands on (its back to `n`, heading `t`). */
export type MapPerch = {x: number; y: number; z: number; nx: number; ny: number; nz: number; tx: number; ty: number; tz: number; tag: AttachTag; id: string};

/** What `placement.ts` gets back: a placement's fields. */
export type MapPlacement = {
    /** A small vertebrate on its attach point (`trueMicro` says it is not a micro animal): its perch, home and roost. */
    perch?: MapPerch;
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
    house_wall: "house", house_eave: "house", porch_light: "lamp", worm_hole: "leaf_litter", burrow_entrance: "leaf_litter",
    limb: "bark", canopy_hang: "bark", fence_post: "rocks", roof_edge: "house", ledge: "rocks", tree_hollow: "bark"
};

let enabled = true;
let points: MapPoints | null = null;

/**
 * The positions atlas's generator (scripts/ark-positions-atlas.mts; AnimalDex `_shared/ark-positions`) listens here:
 * which way each place was found and, on an attach point, the list it was picked on, so the server's encounter
 * hunting finds every home where the scene draws it. Null in the scene (nothing is ever told).
 */
export type MapPlaceTrace = {route(name: "shore" | "held" | "water" | "attach" | "canopy" | "tag" | "rocks"): void; attach(list: ReadonlyArray<{x: number; z: number}>, own: boolean): void};
// (On the global object, not in this module: a script's loader may hold two copies of the scene's modules.)
const TRACE_KEY = "__arkMapPlaceTrace";
const tracer = (): MapPlaceTrace | null => ((globalThis as Record<string, unknown>)[TRACE_KEY] as MapPlaceTrace | undefined) ?? null;
export function traceMapPlace(trace: MapPlaceTrace | null): void {
    (globalThis as Record<string, unknown>)[TRACE_KEY] = trace;
}

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

export const CANOPY_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["canopy", "leaves", "trunks_bark", "bamboo", "host_nests"]);

/**
 * Lives on a canopy tree's limbs (not small, not a water species): its table
 * says a limb or a trunk; or it hangs or leaps (a sloth, a gibbon); or it is
 * of the canopy layer (`layers.json`) and climbs or perches, its text naming
 * the trees (a tree kangaroo, an orangutan, a fish eagle over the lake).
 */
export function arborealOf(species: MapSpecies, slug: string): boolean {
    // Only a body that climbs, perches or flies, or lives in the canopy layer, ever goes on a limb (the table once gave an African
    // forest buffalo "climb" and "limb": a generator slip; its behaviour profile walks).
    if (!climbsTrees(slug)) return false;
    if (species.small) return species.attach === "limb" || species.attach === "trunk";
    if (species.attach === "limb" || species.attach === "trunk" || species.move === "hang" || species.move === "leap") return true;
    if (species.move !== "climb" && species.move !== "perch") return false;
    // (Trees only as its roost, a cormorant's or a heron's: it lives at the water by day and sleeps in a tree, `roostOf`.)
    return speciesLayer(slug).layer === "canopy" && Array.from(species.allowed).some((tag) => CANOPY_TAGS.has(tag) && tag !== species.roost);
}

/** A body that can be on a tree: its behaviour profile climbs, perches or flies, or it lives in the canopy layer (`layers.json`). */
export function climbsTrees(slug: string): boolean {
    const profile = behaviourProfile(slug);
    if (profile.move === "climb" || profile.move === "perch" || profile.move === "fly" || profile.move === "cling") return true;
    if (profile.moves.some((move) => move === "climb" || move === "perch" || move === "fly" || move === "cling")) return true;
    return speciesLayer(slug).layer === "canopy";
}

const TREE_POINT: ReadonlySet<AttachTag> = new Set<AttachTag>(["limb", "canopy_hang", "branch", "bark", "tree_hollow"]);

/** The most a canopy tree's limb (`micro-decor.ts` canopyTree, a limb 12 cm thick at its base) holds (kg). */
export const CANOPY_LIMB_LOAD = 150;

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
    const placed = mapPlaceOn(animal, zone, slot, rank, length, trueLength, kind);
    if (placed) placed.map.who = {slug: animal.model_slug, length};
    // (A tree's climber stays in its tree, a centipede on its limb: its den is a rock in reach, else its perch.)
    if (placed && !placed.water && !placed.canopy && !placed.micro && !placed.map.held && !placed.map.shore && !inTheTrees(placed, animal.model_slug) && ROCK_DENS.has(denKindOf(animal.model_slug) ?? "") && !rockInReach(placed.map, placed.perch ?? null, placed.x, placed.z)) {
        const moved = toTheRocks(placed, zone, slot, rank, length);
        if (moved) {
            tracer()?.route("rocks");
            return moved;
        }
    }
    return placed;
}

/** Does it live in the trees: a climber, hanger or percher of the trees (`arborealOf`), or perched on a tree's point? */
export function inTheTrees(place: {perch?: MapPerch; canopy?: unknown; map?: MapPlace}, slug: string): boolean {
    if (place.canopy) return true;
    if (place.perch && TREE_POINT.has(place.perch.tag)) return true;
    return Boolean(place.map?.species && arborealOf(place.map.species, slug));
}

/**
 * A crevice or cave dweller with no dry rock in reach of its home: its home at the foot of the nearest dry drawn rock
 * of its zone, on ground its text allows (the cluster round it, a body and more apart, each slot its own bearing).
 * A pure function of its zone, slot and rank, as every place is.
 */
function toTheRocks(placed: MapPlacement, zone: ArkZone, slot: number, rank: number, length: number): MapPlacement | null {
    const species = placed.map.species;
    if (!species) return null;
    const feet = rockHomes(species, zone, length).map((foot) => ({...foot, d: Math.hypot(foot.x - placed.x, foot.z - placed.z)})).sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z);
    if (!feet.length) return null;
    const sampler = mapPoints().sampler;
    // The nearest rock's feet first; the slot picks among the nearest dozen, a member a few bearings on.
    const pick = feet[(hashString(`${zone}#rocks#${slot}`) + rank * 5) % Math.min(feet.length, 12)];
    const g = sampler.ground(pick.x, pick.z);
    const tag = g.tags.find((t) => species.allowed.has(t))!;
    void length;
    const {perch: _perch, micro: _micro, burrow: _burrow, ...rest} = placed;
    void _perch;
    void _micro;
    void _burrow;
    return {...rest, x: pick.x, z: pick.z, ground: g.height, water: false, map: {...placed.map, tag, area: TAG_AREA[tag], attach: undefined, roost: null}};
}

function mapPlaceOn(animal: ArkAnimal, zone: ArkZone, slot: number, rank: number, length: number, trueLength: number, kind: "core" | "edge" | "cover" | "plain"): MapPlacement | null {
    if (!enabled) return null;
    const key = clusterKey(zone, slot);
    const ownHash = hashString(animal.id);
    // A penguin or a seal: standing on its shore (the cold cove's ice and rocks for the penguins and the polar seals), its home and its
    // rest; its schedule takes it swimming and back. Held Antarctic species wait on the cove's land too, never bobbing at sea.
    const shore = shoreOf(animal.model_slug, zone);
    if (shore) {
        const spot = shoreSpot(shore, zone, slot, rank, length);
        if (spot) {
            const sampler = mapPoints().sampler;
            const g = sampler.ground(spot.x, spot.z);
            const tag = SHORE_TAGS.find((t) => g.tags.includes(t)) ?? g.tags[0] ?? null;
            const held = isHeldOnMap(animal.model_slug);
            tracer()?.route("shore");
            return {
                x: spot.x, z: spot.z, ground: g.height, yaw: ((((ownHash >>> 4) % 1000) / 1000) - 0.5) * 1.6 + spot.toSea, water: false,
                map: {species: held ? null : mapSpecies(animal.model_slug, zone), tag, area: tag ? TAG_AREA[tag] : null, held, sea: false, shore: shore === "cove" ? "cove" : "coast", roost: null, key, level: 0}
            };
        }
    }
    if (isHeldOnMap(animal.model_slug)) {
        const depth = speciesDepth(animal.model_slug, zone);
        if (depth) {
            // A held water species waits in the water: the sea off the landing's shore (or the lake), never on the beach.
            const spot = waterHomeSpot(depth.water === "fresh" ? depth : {...depth, home: "coast"}, depth.water === "fresh" ? zone : "seashore", 400 + (key % 400), rank, length);
            if (spot) {
                const ground = mapPoints().sampler.ground(spot.x, spot.z);
                tracer()?.route("held");
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
        tracer()?.route("held");
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
                tracer()?.attach(pools, found.own);
                tracer()?.route("attach");
                return {
                    x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tangent[0], point.tangent[2]), water: true, micro: attachPlace(point, key, level, rank, trueLength),
                    map: {species, tag: "rocky_shore", area: TAG_AREA.rocky_shore, held: false, sea: true, attach: point, roost: null, key, level}
                };
            }
        }
        const spot = waterSpot(all.water, depth, zone, slot, rank, length);
        if (spot) {
            tracer()?.route("water");
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
            // Hang points under limbs are a bat's or a hanger's; a bat takes them first where its tags allow.
            const hanger = bodyOf(animal.model_slug) === "t" || species.move === "hang";
            // A tree's points (its limbs, branches, bark, hollows, the leaves up in it) are a climber's, a percher's or a flyer's only:
            // a hedgehog or a frog that does not climb takes the ground's (a fallen leaf, a hole).
            // (A crawler, an insect, a spider, a snail, crawls on any surface, the owner's rule: trees too.)
            const climber = climbsTrees(animal.model_slug) || species.move === "crawl" || trueMicro(species, animal.model_slug, trueLength);
            const inTree = (point: AttachPoint) => TREE_POINT.has(point.tag) || (point.tag === "leaf" && point.y - sampler.ground(point.x, point.z).height > 0.3);
            let list = found.list.filter((point) => !(species.move === "fly" && tag !== "trunks_bark" && point.tag === "bark") && !(point.tag === "house_eave" && species.move !== "crawl" && species.move !== "climb") && !(point.tag === "canopy_hang" && !hanger) && (climber || !inTree(point)));
            if (hanger && list.some((point) => point.tag === "canopy_hang")) list = list.filter((point) => point.tag === "canopy_hang");
            const own = found.own;
            if (!list.length) continue;
            const {index, level} = pointIndex(own ? slot : borrowedKey(zone, slot), list.length);
            let point = list[index];
            tracer()?.attach(list, own);
            tracer()?.route("attach");
            let memberRank = rank;
            const tiny = trueMicro(species, animal.model_slug, trueLength);
            if (rank > 0) {
                const spread = spreadMembers(list, point, rank, trueLength, tiny);
                point = spread.point;
                memberRank = spread.memberRank;
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
            if (!trueMicro(species, animal.model_slug, trueLength)) {
                // A bird, a bat, a small mammal, a lizard or a frog: its attach point is its perch (its home and its roost on the
                // behaviour schedule, which flies, walks or hops it from there and back), not a micro animal's spot.
                let at = surfacePoint(micro, zone);
                // Set down beside a hole in the ground a few body lengths out, never into a drawn rock beside it (a crag by a
                // burrow, scenery lane): on the hole itself then, which keeps clear of the rocks (`world-sampler.ts`).
                if ((point.tag === "burrow_entrance" || point.tag === "worm_hole") && inRock(at.x, at.z, Math.min(Math.max(trueLength * 0.2, 0.05), 0.3))) at = surfacePoint({...micro, offAlong: 0, offAcross: 0}, zone);
                return {
                    x: at.x, z: at.z, ground: at.y, yaw: Math.atan2(at.tx, at.tz), water: false, perch: {...at, tag: point.tag, id: point.id},
                    map: {species, tag, area: TAG_AREA[tag], held: false, sea: false, attach: point, roost, key, level}
                };
            }
            return {
                x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(point.tangent[0], point.tangent[2]), water: point.tag === "tide_pool", micro,
                map: {species, tag, area: TAG_AREA[tag], held: false, sea: false, attach: point, roost, key, level}
            };
        }
    }

    // A large tree climber, hanger or percher: a thick limb of the real forest (the scenery's `limb` points, matched to its body by the
    // limb's fit and load and the room above it), a hanger a hang point under a limb; its perch, home and roost on the schedule.
    const heavy = massFromSize(arkStats(animal).size) > CANOPY_LIMB_LOAD;
    if (arborealOf(species, animal.model_slug) && !species.small && !heavy) {
        const hang = species.move === "hang";
        const mass = massFromSize(arkStats(animal).size);
        const found = all.limbsFor(hang ? "canopy_hang" : "limb", trueLength, mass, zone);
        if (found.list.length) {
            const {index, level} = pointIndex(found.own ? slot : borrowedKey(zone, slot), found.list.length);
            const point = rank > 0 ? spreadMembers(found.list, found.list[index], rank, trueLength, false).point : found.list[index];
            tracer()?.attach(found.list, found.own);
            tracer()?.route("attach");
            const n = point.normal;
            const t = point.tangent;
            const tag = tags.find((t2) => CANOPY_TAGS.has(t2)) ?? "canopy";
            return {
                x: point.x, z: point.z, ground: point.y, yaw: Math.atan2(t[0], t[2]), water: false,
                perch: {x: point.x, y: point.y, z: point.z, nx: n[0], ny: n[1], nz: n[2], tx: t[0], ty: t[1], tz: t[2], tag: point.tag, id: point.id},
                map: {species, tag, area: TAG_AREA[tag], held: false, sea: false, attach: point, roost: null, key, level}
            };
        }
    }

    // A canopy animal: a limb (or the trunk) of a canopy tree. The owner's rule (2026-11-11): hangers, leapers, and the canopy layer's
    // climbers and perchers (`layers.json`) grip a real limb, never the ground under it; never one too heavy for the limb.
    // (v2, the bigger wild island: no canopy trees of today's island's kind; its tree animals are on its trees' own limbs,
    // hang points and branches, above.)
    if (arborealOf(species, animal.model_slug) && !heavy && arkWorld() !== "v2") {
        const canopyTag = tags.find((tag) => CANOPY_TAGS.has(tag)) ?? (species.move === "hang" || species.move === "leap" ? "canopy" : undefined);
        if (canopyTag) {
            const hostZone = canopyTrees(zone)[0]?.zone ?? zone;
            const place = canopyPlace(hostZone, key, rank, canopyMode(species), length);
            if (place) {
                place.zone = hostZone;
                if (species.attach === "trunk") place.limb = -2;
                tracer()?.route("canopy");
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
        // Never on the hamlet's reserved plots (a lap's offset or a member's lattice step from a cell beside one).
        if (sampler.reserved?.(x, z)) return false;
        return !walker || !sampler.walkable || sampler.walkable(x, z, maxSlope);
    };
    const okFor = (tag: MapTag, wet: boolean) => okOn(wet, (tags) => tags.includes(tag));
    // v2 (decision 54): a big land walker's home is one of its zone's ranges on its own ground, kept clear of every smaller
    // animal's cell; its ground test is everyone's but the ranges' reservation, which is its own.
    if (arkWorld() === "v2" && !species.small && takesRange(species.move, trueLength) && !wetOf(species, species.spawn)) {
        const fits = (x: number, z: number) => {
            const g = sampler.ground(x, z);
            return g.water === null && g.tags.some((t) => species.allowed.has(t)) && !sampler.blocked(x, z, radius) && (!sampler.walkable || sampler.walkable(x, z, maxSlope));
        };
        const spot = rangeSpot(sampler, zone, species.allowed, slot, rank, Math.max(1.1, length * 0.85), fits);
        if (spot) {
            const here = spot.ground.tags;
            // (Its own tags in its text's order; the range's ground may be its roost's, which they leave out.)
            const tag = tags.find((t) => here.includes(t)) ?? Array.from(species.allowed).find((t) => here.includes(t))!;
            const turn = ((ownHash >>> 4) % 1000) / 1000;
            tracer()?.route("tag");
            const placement: MapPlacement = {
                x: spot.x, z: spot.z, ground: spot.ground.height, yaw: ((ownHash & 1) === 0 ? 1 : -1) * (0.35 + 0.95 * turn), water: false,
                map: {species, tag, area: TAG_AREA[tag], held: false, sea: false, roost: roostOf(species, all, spot.x, spot.z, trueLength, key, ownHash, null), key, level: spot.level}
            };
            if (species.attach === "burrow") placement.burrow = burrowAt(spot.x, spot.z, spot.ground.height, `${zone}#${slot}#${rank}`, length);
            return placement;
        }
    }
    type Choice = {tag: MapTag; wet: boolean; pick: SlotPick; ok: (x: number, z: number) => boolean};
    /** Where it can stand for a pick: its lap's spot, else the nearest within a metre that suits it, else the same round its cell's middle. */
    const settle = ({pick, ok}: Choice): {x: number; z: number} | null => {
        for (const [bx, bz] of [[pick.x, pick.z], [pick.point.x, pick.point.z]]) {
            if (ok(bx, bz)) return {x: bx, z: bz};
            // (Up to 2 m round: a cell beside a drawn rock may have its clear ground a step away.)
            for (let k = 1; k < 84; k++) {
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
    // (v2: when nothing settles on its own tags' cells, a borrowed list on another zone's steep ground, its roost's own
    // ground is its last choice before the search round its first pick, below. Today's island tries its tags alone.)
    const roostTry = arkWorld() === "v2" && species.roost && species.allowed.has(species.roost) && !tags.includes(species.roost) ? [species.roost] : [];
    for (const tag of [...tags, ...roostTry]) {
        if (tag === species.roost && roostTry.length && (chosen || fallback)) break;
        const wet = wetOf(species, tag);
        const partition = all.partitionOf(tag, wet, zone);
        if (!partition.list.length) continue;
        // The stats (docs/ark-next.md, stats addendum): a dominant kind at the list's middle, a rare one at its edge (behind
        // cover where it has it); past its kind's cells, the plain ones.
        // (A cover slot past the covered cells takes the edge's, then looks for cover round it.)
        const order: SlotKind[] = kind === "cover" ? ["cover", "edge", "plain"] : kind === "plain" ? ["plain"] : [kind, "plain"];
        // (A zone borrowing another's cells takes the whole list: its keys spread over every cell, never lapping one kind's few.)
        let pick = all.pick(partition.own ? all.kindOf(partition.list, order[0]) : partition.list, partition.own, zone, slot, partition.borrowers);
        if (partition.own) for (const next of order.slice(1)) if (pick.level > 0 && partition.list.length >= 12) pick = all.pick(all.kindOf(partition.list, next), partition.own, zone, slot);
        const choice: Choice = {tag, wet, pick, ok: okFor(tag, wet)};
        first ??= choice;
        // Free: its cell, or the cell's first lap (half a cell over), so it keeps to the place its text names first.
        const free = pick.level <= 1;
        const at: {x: number; z: number} | null = free || !fallback ? settle(choice) : null;
        if (at && free) {
            chosen = {...choice, at};
            break;
        }
        // Past every tag's first lap, the tag whose cell is least lapped (a scarce borrowed list is not piled four deep).
        if (at && (!fallback || pick.level < fallback.pick.level)) fallback = {...choice, at};
    }
    chosen ??= fallback;
    if (!chosen && first) {
        // Nothing settles on any of its tags' cells (a corner of drawn rocks, steep ground): the nearest spot within 6 m on any ground
        // its text names that it can stand and walk on.
        const any = okOn(first.wet, (here) => here.some((t) => species.allowed.has(t)));
        for (let k = 1; k < 600 && !chosen; k++) {
            const r = 0.25 * Math.sqrt(k);
            const tx = first.pick.x + Math.cos(k * GOLDEN) * r;
            const tz = first.pick.z + Math.sin(k * GOLDEN) * r;
            if (any(tx, tz)) chosen = {...first, ok: any, at: {x: tx, z: tz}};
        }
    }
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
    tracer()?.route("tag");
    return placement;
}

/**
 * Can this animal's home be here, by the map (behaviour's spawn spacing,
 * `spaceHomes`, moves a predator's home away from its prey and asks this of
 * every spot it tries): on ground one of its tags names. Always true with
 * the map off, for a species the map does not place, and for a water
 * species (its water is its band's, which the swim test already asks).
 */
export function mapHabitatAt(animal: Pick<ArkAnimal, "model_slug" | "zone">, x: number, z: number, margin = 0): boolean {
    if (!enabled || isHeldOnMap(animal.model_slug) || speciesDepth(animal.model_slug, animal.zone)) return true;
    const species = mapSpecies(animal.model_slug, animal.zone);
    if (!species) return true;
    const sampler = mapPoints().sampler;
    const holds = (px: number, pz: number) => sampler.ground(px, pz).tags.some((tag) => species.allowed.has(tag));
    if (holds(x, z)) return true;
    // Within `margin` of its own ground (a predator's home at the edge of its range: it ranges over its ground from there).
    for (let k = 0; margin > 0 && k < 8; k++) if (holds(x + Math.sin(k * Math.PI / 4) * margin, z + Math.cos(k * Math.PI / 4) * margin)) return true;
    return false;
}

/**
 * On the behaviour lane's schedule (`index.ts` makeSched): everyone but a
 * true micro animal (`trueMicro`) and an underground one that never comes up
 * to graze (a mole, a naked mole-rat). A bird, a bat or a small mammal on an
 * attach point is scheduled from its perch; a wombat or a badger from its
 * burrow's entrance.
 */
export function onSchedule(place: {micro?: unknown; burrow?: unknown; hamlet?: unknown}, slug: string): boolean {
    // (A hamlet resident: the hamlet's rotation brings it out of its door and back, `hamlet.ts`.)
    if (place.micro || place.hamlet) return false;
    if (place.burrow) return speciesLayer(slug).layer !== "underground" || (behaviourProfile(slug).weights.graze ?? 0) > 0;
    return true;
}

/** A spot on the schedule's terms (`behaviour-schedule.ts` Spot). */
export type ScheduleSpot = {x: number; y: number; z: number; nx: number; ny: number; nz: number; point: string | null};

/**
 * Where the schedule takes it to sleep: the roost its text names
 * (`sleep_pattern`: a tree, an attach point, a burrow, ground of a tag), else
 * its perch; null leaves the choice to the schedule (its profile's roost).
 * So the scene's sleepers are where the validator checks them.
 */
export function scheduleRoost(place: {perch?: MapPerch; map?: MapPlace}, zone: ArkZone): ScheduleSpot | null {
    // (Worked out with its place already: `settleRoosts`, in the places worker for a big Ark. The same answer.)
    if (place.map && place.map.den !== undefined) return place.map.den;
    return workRoost(place, zone);
}

/**
 * Every placed animal's roost on the schedule (`scheduleRoost`), worked out now and kept on its place, so the mount
 * reads it rather than building the map's sampler to ask. Run last in `placeAnimals` (after the hosts' partners are
 * attached: a place as the mount will see it).
 */
export function settleRoosts(animals: ArkAnimal[], places: Map<string, {perch?: MapPerch; map?: MapPlace; hamlet?: unknown}>): void {
    for (const animal of animals) {
        const place = places.get(animal.id);
        if (!place?.map || place.hamlet) continue;
        place.map = {...place.map, den: workRoost(place, animal.zone)};
    }
}

function workRoost(place: {perch?: MapPerch; map?: MapPlace}, zone: ArkZone): ScheduleSpot | null {
    // A crevice or cave dweller (a rock hyrax, a gundi, a pika, a rock wallaby): a dry rock face, ledge or the foot of a
    // drawn rock, never a hole on open grass (the props' rock-den slot reads as one: golden den_rock, 2026-11-11).
    const home = place as {x?: number; z?: number};
    if (place.map?.who && !place.map.water && ROCK_DENS.has(denKindOf(place.map.who.slug) ?? "") && typeof home.x === "number" && typeof home.z === "number") {
        const rock = rockDen(place.map, place.perch ?? null, home.x, home.z!);
        if (rock) return rock;
    }
    const roost = place.map?.roost;
    // (A burrow or a sleeping ground of its text in the tide or the surf: its den on dry land instead, when it has one.)
    const wetDen = roost && (roost.kind === "burrow" || roost.kind === "ground" || roost.kind === "attach") && !denIsDry(roost.burrow?.x ?? roost.x, roost.burrow?.z ?? roost.z);
    const dry = wetDen && place.map?.who && typeof (place as {x?: number}).x === "number" ? coastalDen(place.map, (place as {x: number}).x, (place as {z: number}).z, (place as {ground?: number}).ground ?? 0) : null;
    if (dry) return dry;
    if (roost) {
        if (roost.kind === "attach" && roost.attach) return {x: roost.attach.x, y: roost.attach.y, z: roost.attach.z, nx: roost.attach.normal[0], ny: roost.attach.normal[1], nz: roost.attach.normal[2], point: `map:${roost.attach.id}`};
        if (roost.kind === "canopy" && roost.canopy) {
            const at = canopyPoint(roost.canopy.zone ?? zone, roost.canopy);
            return {x: at.x, y: at.y, z: at.z, nx: at.nx, ny: at.ny, nz: at.nz, point: `map:canopy`};
        }
        if (roost.kind === "burrow" && roost.burrow) return {x: roost.burrow.x, y: roost.burrow.ground, z: roost.burrow.z, nx: 0, ny: 1, nz: 0, point: "map:burrow"};
        return {x: roost.x, y: roost.y, z: roost.z, nx: 0, ny: 1, nz: 0, point: `map:${roost.tag}`};
    }
    const perch = place.perch;
    // (A den on its perch in the tide or the surf, a desert rain frog's hole on the beach: its den on dry land instead.)
    const wetPerch = perch && place.map?.who && !denIsDry(perch.x, perch.z) ? coastalDen(place.map, perch.x, perch.z, perch.y) : null;
    if (wetPerch) return wetPerch;
    if (perch) return {x: perch.x, y: perch.y, z: perch.z, nx: perch.nx, ny: perch.ny, nz: perch.nz, point: `map:${perch.id}`};
    // A hauled-out diver rests where it stands on its shore (a penguin colony on the cove's ice).
    const at = place as {x?: number; z?: number; ground?: number};
    if (place.map?.shore && typeof at.x === "number" && typeof at.z === "number") {
        // (A burrow-nesting penguin's or a crevice auklet's den above the surf, though it stands in the splash: dry land.)
        const den = place.map.who && !denIsDry(at.x, at.z) ? coastalDen(place.map, at.x, at.z, at.ground ?? 0) : null;
        return den ?? {x: at.x, y: at.ground ?? 0, z: at.z, nx: 0, ny: 1, nz: 0, point: `map:shore`};
    }
    // A den by the sea on dry land (a rock hyrax's crevice, a porcupine's cave): never a boulder in the surf.
    if (place.map?.who && typeof at.x === "number" && typeof at.z === "number") return coastalDen(place.map, at.x, at.z, at.ground ?? 0);
    return null;
}

/** A den is found for an animal living within this of the sea (the schedule's own choice reaches up to its range, about this far). */
const COAST_REACH = 40;
/** Roosts that are dens (`behaviour-profile.ts` roost), and the map's points that make one. */
const DEN_POINTS: Partial<Record<string, AttachTag[]>> = {cave: ["rock_face", "ledge"], crevice: ["rock_face", "ledge"], burrow: ["burrow_entrance"], den: ["burrow_entrance", "rock_face"], tree_hole: ["tree_hollow", "bark", "branch"]};

/** The kind of den its schedule's roost is (a cave, a crevice, a burrow, a den, a tree hole), or null when it sleeps in the open. */
export function denKindOf(slug: string): string | null {
    const roost = behaviourProfile(slug).roost;
    return DEN_POINTS[roost] ? roost : null;
}

/** Dry land for a den: not in any water, and above the sea's tide and surf (`points.ts` DEN_DRY, inSurf). */
export function denIsDry(x: number, z: number): boolean {
    const all = mapPoints();
    return all.sampler.ground(x, z).water === null && !all.inSurf(x, z);
}

/** The sampler's attach points by 16 m cell (each cell's in the sampler's own order), for the den and roost searches. */
const NEAR_CELL = 16;
let nearIndex: {sampler: ArkMapSampler; cells: Map<string, number[]>} | null = null;
/**
 * The sampler's attach points within `reach` of a spot (a superset: whole cells), in the sampler's own order, so a
 * search over them finds what one over every point finds, first-found ties and all.
 */
function pointsNear(x: number, z: number, reach: number): AttachPoint[] {
    const sampler = mapPoints().sampler;
    const all = sampler.attachPoints();
    if (!nearIndex || nearIndex.sampler !== sampler) {
        const cells = new Map<string, number[]>();
        all.forEach((point, i) => {
            const key = `${Math.floor(point.x / NEAR_CELL)},${Math.floor(point.z / NEAR_CELL)}`;
            const list = cells.get(key);
            if (list) list.push(i);
            else cells.set(key, [i]);
        });
        nearIndex = {sampler, cells};
    }
    const found: number[] = [];
    for (let i = Math.floor((x - reach) / NEAR_CELL); i <= Math.floor((x + reach) / NEAR_CELL); i++) {
        for (let j = Math.floor((z - reach) / NEAR_CELL); j <= Math.floor((z + reach) / NEAR_CELL); j++) {
            const list = nearIndex.cells.get(`${i},${j}`);
            if (list) for (const k of list) found.push(k);
        }
    }
    return found.sort((a, b) => a - b).map((k) => all[k]);
}

/** The dens that are rock's: a crevice, a cave. */
const ROCK_DENS: ReadonlySet<string> = new Set(["crevice", "cave"]);
/** How far a rock den may be from its home (m); none: the home goes to the rocks (`mapPlace`). */
export const ROCK_DEN_REACH = 20;
/** A drawn rock's foot: this far out from its footprint (m). */
const FOOT = 0.35;

/** The ground just outside a drawn rock along a bearing (its own frame's box, turned as drawn). */
function rockFoot(rock: DrawnRock, bearing: number, out: number): {x: number; z: number} {
    const lx = Math.sin(bearing);
    const lz = Math.cos(bearing);
    const tx = lx > 0 ? rock.hx1 / lx : lx < 0 ? rock.hx0 / lx : Infinity;
    const tz = lz > 0 ? rock.hz1 / lz : lz < 0 ? rock.hz0 / lz : Infinity;
    const t = Math.min(tx, tz) + out;
    const ax = lx * t;
    const az = lz * t;
    // (Local to world: the inverse of rocks.ts's turn.)
    return {x: rock.x + ax * rock.cos + az * rock.sin, z: rock.z - ax * rock.sin + az * rock.cos};
}

/** Can a den be at a drawn rock's foot here: dry, outside every rock, off the plots and the scenery. */
function footFits(x: number, z: number): boolean {
    const sampler = mapPoints().sampler;
    return denIsDry(x, z) && !inRock(x, z, 0.12) && !sampler.reserved?.(x, z) && !sampler.blocked(x, z, 0.12);
}

/** Dry rock feet round the drawn rocks within `reach` of a spot, nearest first (12 bearings a rock, `out` from its side). */
function rockFeet(x: number, z: number, reach: number, keep: (x: number, z: number, rock: DrawnRock) => boolean = () => true, out0 = FOOT): Array<{x: number; z: number; d: number}> {
    const out: Array<{x: number; z: number; d: number}> = [];
    for (const rock of drawnRocks()) {
        if (Math.hypot(rock.x - x, rock.z - z) > reach + rock.reach + out0) continue;
        for (let k = 0; k < 12; k++) {
            const foot = rockFoot(rock, (k / 12) * Math.PI * 2, out0);
            const d = Math.hypot(foot.x - x, foot.z - z);
            if (d <= reach && footFits(foot.x, foot.z) && keep(foot.x, foot.z, rock)) out.push({...foot, d});
        }
    }
    return out.sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z);
}

/** Is a spot a rock den: a rock face's or a ledge's point (`point` its id), or the foot of a drawn rock (within a metre of it, outside it)? */
export function atRock(x: number, z: number, point: string | null): boolean {
    if (point && /^map:(rock_face|ledge):/.test(point)) return true;
    return inRock(x, z, 1) && !inRock(x, z, 0);
}

/**
 * A crevice or cave dweller's den: its perch when that is a dry rock face or ledge; else a dry rock face or ledge within
 * `ROCK_DEN_REACH` of its home (nearer likelier, seeded by its cluster); else a drawn rock's foot there. Null with no rock
 * in reach (its home was put by rocks when it had none: `mapPlace`).
 */
function rockDen(map: MapPlace, perch: MapPerch | null, x: number, z: number): ScheduleSpot | null {
    if (perch && (perch.tag === "rock_face" || perch.tag === "ledge") && denIsDry(perch.x, perch.z)) return {x: perch.x, y: perch.y, z: perch.z, nx: perch.nx, ny: perch.ny, nz: perch.nz, point: `map:${perch.id}`};
    const who = map.who!;
    const roll = (hashString(`${who.slug}#rockden#${map.key}`) % 1000) / 1000;
    const points = pointsNear(x, z, ROCK_DEN_REACH)
        .filter((point) => (point.tag === "rock_face" || point.tag === "ledge") && Math.hypot(point.x - x, point.z - z) <= ROCK_DEN_REACH && who.length >= point.size.min * 0.5 && who.length <= point.size.max * 1.5 && denIsDry(point.x, point.z))
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (points.length) {
        const point = points[Math.floor(roll ** 1.4 * points.length)];
        return {x: point.x, y: point.y, z: point.z, nx: point.normal[0], ny: point.normal[1], nz: point.normal[2], point: `map:${point.id}`};
    }
    const feet = rockFeet(x, z, ROCK_DEN_REACH);
    // (Its home at a rock's foot already, the rocks' own home for it: there.)
    if (!feet.length && atRock(x, z, null) && denIsDry(x, z)) return {x, y: mapPoints().sampler.ground(x, z).height, z, nx: 0, ny: 1, nz: 0, point: "map:rock_foot"};
    if (!feet.length) return null;
    const foot = feet[Math.floor(roll ** 1.4 * Math.min(feet.length, 12))];
    return {x: foot.x, y: mapPoints().sampler.ground(foot.x, foot.z).height, z: foot.z, nx: 0, ny: 1, nz: 0, point: "map:rock_foot"};
}

const rockHomeLists = new Map<string, Array<{x: number; z: number}>>();
/**
 * Where a crevice or cave dweller of its zone can live by the rocks: every dry drawn rock's foot in the zone, on ground
 * its text allows, its body clear of the rock and the scenery and (a walker) on the walk grid. Empty: its zone has none.
 */
export function rockHomes(species: MapSpecies, zone: ArkZone, length: number): Array<{x: number; z: number}> {
    const radius = Math.min(Math.max(length * 0.2, 0.1), 0.6);
    const key = `${zone}|${Array.from(species.allowed).sort().join(",")}|${species.move}|${radius.toFixed(2)}`;
    let list = rockHomeLists.get(key);
    if (!list) {
        const sampler = mapPoints().sampler;
        const walker = ["walk", "crawl", "slither", "hop", "burrow"].includes(species.move);
        const maxSlope = zone === "mountains" ? MOUNTAIN_SLOPE : MAX_SLOPE;
        const site = ZONE_SITES[zone];
        list = rockFeet(site.x, site.z, 1000, (x, z) => {
            const g = sampler.ground(x, z);
            return g.zone === zone && g.tags.some((tag) => species.allowed.has(tag)) && !inRock(x, z, radius) && !sampler.blocked(x, z, radius) && (!walker || !sampler.walkable || sampler.walkable(x, z, maxSlope));
        }, FOOT + radius).map(({x, z}) => ({x, z}));
        rockHomeLists.set(key, list);
    }
    return list;
}

/** Has a crevice or cave dweller a rock den in reach of a home there? */
function rockInReach(map: MapPlace, perch: MapPerch | null, x: number, z: number): boolean {
    return rockDen(map, perch, x, z) !== null;
}

/**
 * The den of a land animal living by the sea, on dry land: a point of its den's kind within 15 m of its home (nearer
 * ones likelier, seeded by its cluster), never one in the tide or the surf; none, the ground at home if that is dry,
 * else the nearest dry ground within 30 m. Null (the schedule's own choice) for one living inland, a water animal, or
 * one whose roost is not a den.
 */
function coastalDen(map: MapPlace, x: number, z: number, ground: number): ScheduleSpot | null {
    const who = map.who!;
    const profile = behaviourProfile(who.slug);
    const kinds = DEN_POINTS[profile.roost];
    if (!kinds || map.water || !mapPoints().seaWithin(x, z, COAST_REACH)) return null;
    const sampler = mapPoints().sampler;
    const near = pointsNear(x, z, 15)
        .filter((point) => kinds.includes(point.tag) && Math.hypot(point.x - x, point.z - z) <= 15 && who.length >= point.size.min * 0.5 && who.length <= point.size.max * 1.5 && denIsDry(point.x, point.z))
        .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (near.length) {
        const roll = (hashString(`${who.slug}#den#${map.key}`) % 1000) / 1000;
        const point = near[Math.floor(roll ** 1.4 * near.length)];
        return {x: point.x, y: point.y, z: point.z, nx: point.normal[0], ny: point.normal[1], nz: point.normal[2], point: `map:${point.id}`};
    }
    if (denIsDry(x, z)) return {x, y: ground, z, nx: 0, ny: 1, nz: 0, point: "map:den"};
    for (let k = 1; k < 400; k++) {
        const r = 0.5 * Math.sqrt(k);
        if (r > 30) break;
        const tx = x + Math.cos(k * GOLDEN) * r;
        const tz = z + Math.sin(k * GOLDEN) * r;
        if (denIsDry(tx, tz) && !sampler.blocked(tx, tz, 0.3) && !sampler.reserved?.(tx, tz)) return {x: tx, y: sampler.ground(tx, tz).height, z: tz, nx: 0, ny: 1, nz: 0, point: "map:den"};
    }
    return null;
}

/**
 * A cluster's member's point: the rank-th of the list's points nearest its
 * leader's, each a body and a half from the others (greedy, nearest first),
 * so no two of a perched cluster ever share a point (a puffin colony on its
 * ledges). A micro animal's cluster shares up to twelve points, round in
 * turn, a step apart on each (`attachPlace`).
 */
function spreadMembers(list: AttachPoint[], leader: AttachPoint, rank: number, length: number, tiny: boolean): {point: AttachPoint; memberRank: number} {
    if (tiny && length * 3.2 * Math.sqrt(rank) <= 0.12) return {point: leader, memberRank: rank};
    const gap = tiny ? Math.max(2 * length, 0.1) : Math.max(1.5 * length, 0.3);
    const want = tiny ? 12 : rank + 1;
    const distance = (p: AttachPoint) => Math.hypot(p.x - leader.x, p.y - leader.y, p.z - leader.z);
    const spaced: AttachPoint[] = [leader];
    // Within 25 m first, then anywhere on the list.
    for (const reach of [25, Infinity]) {
        const near = list.filter((other) => other !== leader && distance(other) < reach && !spaced.includes(other)).sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
        for (const other of near) {
            if (spaced.length >= want) break;
            if (spaced.every((p) => Math.hypot(p.x - other.x, p.y - other.y, p.z - other.z) >= gap)) spaced.push(other);
        }
        if (spaced.length >= want) break;
    }
    if (!tiny && spaced.length > rank) return {point: spaced[rank], memberRank: 0};
    // Too few for the whole cluster: they share them, round in turn.
    return {point: spaced[rank % spaced.length], memberRank: Math.floor(rank / spaced.length)};
}

/** The owner's decision 2 (map-plan.md §4): the Antarctic species held for a future southern island; they wait on the cold cove. */
const ANTARCTIC = new Set(["emperor-penguin", "adelie-penguin", "king-penguin", "gentoo-penguin", "macaroni-penguin", "southern-rockhopper-penguin", "weddell-seal", "leopard-seal", "snow-petrel", "antarctic-petrel", "snowy-sheathbill"]);
const PENGUIN = /(^|-)penguin($|-)/;
const PINNIPED = /(^|-)seal($|-)|sea-lion|fur-seal|walrus/;
const AUK = /murre|guillemot|auklet|murrelet|razorbill|(^|-)auk($|-)|dovekie/;
const POLAR_TAGS: readonly MapTag[] = ["sea_ice", "tundra", "snow_ice"];
const SHORE_TAGS: readonly MapTag[] = ["snow_ice", "tundra", "rocky_shore", "sandy_beach", "sea_cliffs", "rocks_boulders", "mudflat"];

/**
 * A diver that hauls out stands on a shore, never floats on the sea (the
 * owner, 2026-11-11: "penguins floating in the ocean"): the Antarctic and
 * sub-Antarctic penguins and the polar seals and walrus on the cold cove (its
 * ice runs down to the sea, the owner's choice; its rocky shore beside it),
 * the warm-water penguins and the other seals and sea lions on their own
 * coast's rocks and beaches. A held Antarctic species (decision 2,
 * not a water species) waits on the cove. Null for everyone else.
 */
export function shoreOf(slug: string, zone: ArkZone): "cove" | ArkZone | null {
    if (ANTARCTIC.has(slug) && !(speciesDepth(slug, zone) && !PENGUIN.test(slug) && !PINNIPED.test(slug))) return "cove";
    // A penguin of temperate or tropical rocky coasts (African, Humboldt, Galápagos, Magellanic: the coordinator's UX call,
    // 2026-11-11) on its own warm shore's rocks and beach; an Antarctic or sub-Antarctic one, or one whose text names the ice, on the cove.
    if (PENGUIN.test(slug)) {
        const species = mapSpecies(slug, zone);
        const polar = zone === "polar" || Boolean(species && POLAR_TAGS.some((tag) => species.allowed.has(tag)));
        return polar ? "cove" : ZONE_SITES[zone]?.kind === "sea" ? "seashore" : zone;
    }
    // The auks that the table puts at sea (murres, guillemots, auklets, murrelets): home on their cliffs and rocks by the sea (they
    // raft on the water and dive from it on their schedule; the puffins already stand on their ledges).
    // (Not an auk sea-depth's table gives a band of its own: that one is the table's water species.)
    const tabled = speciesDepth(slug, zone);
    const auk = AUK.test(slug) && bodyOf(slug) === "b" && !(tabled && tabled.source !== "default");
    if ((!PINNIPED.test(slug) && !auk) || bodyOf(slug) === "f") return null;
    const species = mapSpecies(slug, zone);
    if (zone === "polar" || (species && POLAR_TAGS.some((tag) => species.allowed.has(tag)))) return "cove";
    return ZONE_SITES[zone]?.kind === "sea" ? "seashore" : zone;
}

/** A shore's spot for a cluster (its zone and slot) and its rank: one spot each, close together, standing. */
function shoreSpot(shore: "cove" | ArkZone, zone: ArkZone, slot: number, rank: number, length: number): {x: number; z: number; toSea: number} | null {
    const all = mapPoints();
    const centre = shore === "cove" ? coldCove() : ZONE_SITES[shore] ?? ZONE_SITES.seashore;
    let list = all.shoreList(shore, centre);
    // A zone with no shore of its own near the sea: the beach's.
    if (!list.length && shore !== "cove") list = all.shoreList("seashore", ZONE_SITES.seashore);
    if (!list.length) return null;
    const sampler = all.sampler;
    const n = list.length;
    // Every zone's clusters share a shore's list: its key is unique over zones and slots.
    const key = clusterKey(zone, slot);
    const lap = Math.floor(key / n);
    const cell = list[key % n];
    const dry = (x: number, z: number) => sampler.ground(x, z).water === null && !sampler.blocked(x, z, Math.min(Math.max(length * 0.2, 0.1), 0.5)) && !sampler.reserved?.(x, z);
    // A cell's own spots for its laps: the dry ones of a half-metre grid within 1.6 m of it, a metre apart, nearest first (a function of
    // the terrain alone), so two clusters on one cell never share a spot, whatever drawn rock stands beside it.
    const spots = lapSpots(cell, dry, Math.min(Math.max(length * 0.2, 0.1), 0.5));
    let spot = lap < spots.length ? spots[lap] : {x: cell.x + ((0.5 + lap * 0.7548776662) % 1) * 2.5 - 1.25, z: cell.z + ((0.5 + lap * 0.5698402910) % 1) * 2.5 - 1.25};
    if (!dry(spot.x, spot.z)) {
        // Past the cell's own spots (more laps than it holds): the nearest dry, clear spot within 3 m.
        for (let k = 1; k < 150; k++) {
            const r = 0.25 * Math.sqrt(k);
            const tx = spot.x + Math.cos(k * GOLDEN) * r;
            const tz = spot.z + Math.sin(k * GOLDEN) * r;
            if (dry(tx, tz)) {
                spot = {x: tx, z: tz};
                break;
            }
        }
    }
    const cx = spot.x;
    const cz = spot.z;
    let x = cx;
    let z = cz;
    if (rank > 0) {
        // A colony stands close: its members on a hexagonal lattice a body apart (and never on its leader's spot), on dry ground.
        const gap = Math.max(0.95, length * 0.9);
        const turn = ((hashString(`${zone}#${slot}#shore`) >>> 12) % 360) / 180 * Math.PI;
        let seen = 0;
        for (const [i, j] of HEX_SPIRAL) {
            const lx = gap * (i + j / 2);
            const lz = gap * (j * Math.sqrt(3) / 2);
            const tx = cx + lx * Math.cos(turn) - lz * Math.sin(turn);
            const tz = cz + lx * Math.sin(turn) + lz * Math.cos(turn);
            if (!dry(tx, tz)) continue;
            if (++seen === rank) {
                x = tx;
                z = tz;
                break;
            }
        }
    }
    // Facing the sea: towards the nearest water of its shore's list order (the list is nearest the water first).
    let toSea = 0;
    for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        if (sampler.ground(x + Math.sin(a) * 6, z + Math.cos(a) * 6).water === "sea") {
            toSea = a;
            break;
        }
    }
    return {x, z, toSea};
}

const lapSpotCache = new Map<string, Array<{x: number; z: number}>>();
function lapSpots(cell: {x: number; z: number}, dry: (x: number, z: number) => boolean, radius: number): Array<{x: number; z: number}> {
    // (Per body: a walrus needs more clear ground than a penguin.)
    const key = `${cell.x},${cell.z},${radius.toFixed(2)}`;
    let list = lapSpotCache.get(key);
    if (!list) {
        const candidates: Array<{x: number; z: number; d: number}> = [];
        for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
            const d = Math.hypot(i, j) * 0.5;
            if (d <= 1.6 && dry(cell.x + i * 0.5, cell.z + j * 0.5)) candidates.push({x: cell.x + i * 0.5, z: cell.z + j * 0.5, d});
        }
        candidates.sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z);
        list = [];
        for (const c of candidates) if (list.every((p) => Math.hypot(p.x - c.x, p.z - c.z) >= 1)) list.push({x: c.x, z: c.z});
        lapSpotCache.set(key, list);
    }
    return list;
}

let cove: {x: number; z: number} | null = null;
// Islands mode flips (`no-hamlet.ts`): built from the other world's scenery.
const dropBuilt = () => {
    points = null;
    nearIndex = null;
    rockHomeLists.clear();
    lapSpotCache.clear();
    cove = null;
    resetWildMapV2();
};
onHamletSwitch(dropBuilt);
// The world's switch (`world.ts` setArkWorld, Part C): built from the other world's terrain and scenery.
onArkWorld(dropBuilt);
/** The cold cove's middle (the graphics lane's named place). */
function coldCove(): {x: number; z: number} {
    // (v2: the bigger wild island's cove, its ice shelf's front in the north shore's inlet.)
    if (arkWorld() === "v2") return wildCoveCentre();
    cove ??= (() => {
        const p = scenePlace("cold_cove");
        return {x: p.x, z: p.z};
    })();
    return cove;
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
        for (const point of pointsNear(x, z, reach)) {
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
