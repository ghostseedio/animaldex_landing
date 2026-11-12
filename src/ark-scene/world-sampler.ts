/**
 * What the behaviour system knows of the world: the ground's height, water,
 * slope and zone at any point, and the places animals go to (a branch to
 * perch on, a flower head, a rock face, a tide pool, the porch light, a
 * burrow mouth, a drinking spot at the water's edge), each with its position,
 * surface normal, heading, tag and size range.
 *
 * Everything comes from the graphics lane's scenery interface
 * (`sampler.ts`: `surfaceAt`, `attachPoints`, docs/ark/graphics-interface.md),
 * which owns the terrain and the scenery. Its attach points are used as they
 * are (mapped to the behaviour system's tags); the few places it does not
 * offer (water edges, grazing grass, rock tops, cliff ledges, cave mouths,
 * reeds, shade) are generated here from its `surfaceAt` and the scenery's own
 * items. Nothing is hand-placed, so when the graphics lane reworks the terrain
 * this all rebuilds (`version`).
 */

import {forestFill, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {allAttachPoints, shoreRadius, surfaceAt, type AttachPoint as SceneryPoint, type AttachTag as SceneryTag} from "@/ark-scene/sampler";
import {COTTAGE, GARDEN_POND} from "@/ark-scene/micro-decor";
import {coopSpot, paddockRect, paddockSegments, picketRuns, plotFrame, type HomePlot} from "@/ark-scene/props/home-layout";
import {floorObstacles} from "@/ark-scene/floor-assets";
import {drawnRocks, type DrawnRock} from "@/ark-scene/map/rocks";
import type {ArkZone} from "@/ark-scene/types";
import {chunked, once, SlicedBuild, type BuildTask} from "@/ark-scene/behaviour-build";
import {hashString, heightAt as groundHeight, LAKE, RIVER, TERRAIN_HALF} from "@/ark-scene/world";
import {colliderDistance, ColliderSet, colliderSetFor} from "@/ark-scene/collide/colliders";

/** The behaviour system's place tags. */
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
    "pond_surface",
    "grass",
    "leaf_litter",
    "cliff_ledge",
    "cave_mouth",
    "reeds",
    "shade",
    // (2026-11-11, from the graphics lane's new points: the drawn hollows in tree trunks; fence posts and roof edges.)
    "tree_hollow",
    "post",
    // (Graphics batch 6: the top of a fallen log, where a small animal basks, perches or runs along.)
    "log_top",
    // (Behaviour recipes: the hanging points under thick limbs, where bats and sloths hang.)
    "canopy_hang"
] as const;
export type AttachTag = (typeof ATTACH_TAGS)[number];

export type AttachPoint = {
    id: string;
    tag: AttachTag;
    x: number;
    y: number;
    z: number;
    /** The surface normal (unit): up on the ground, out of a wall, down under the eaves. */
    nx: number;
    ny: number;
    nz: number;
    /** Heading round the normal (radians). */
    yaw: number;
    /** The body lengths (m) it suits. */
    size: [number, number];
    zone: ArkZone;
    /** Under a limb (`canopy_hang`): the clear drop below it (m), and the limb's radius there. */
    clearBelow?: number;
    radius?: number;
};

export interface ArkWorldSampler {
    /** Changes whenever the terrain or scenery does: anything built from the sampler is rebuilt. */
    readonly version: string;
    /** Part C: half the island's square (m) the walk grid covers; absent: the wild island's terrain (`TERRAIN_HALF`). */
    readonly half?: number;
    /** Part C: the middle of that square in the world frame (another island across the strait); absent: (0, 0). */
    readonly centre?: {x: number; z: number};
    heightAt(x: number, z: number): number;
    /** Under water there (the sea, the lake, the river, a pond). */
    isWater(x: number, z: number): boolean;
    /** The ground's steepness there (rise over run). */
    slope(x: number, z: number): number;
    zoneAt(x: number, z: number): ArkZone;
    /** Every place with this tag (optionally within r metres of a point). */
    attachPoints(tag: AttachTag, near?: {x: number; z: number; r: number}): readonly AttachPoint[];
    /** A solid obstacle there (a trunk, a rock, a wall) for something of this clearance. */
    blocked(x: number, z: number, clearance: number): boolean;
    /** The world's solid things as drawn, for exact checks (`collide/colliders.ts`; the same plots as `blocked`). */
    readonly colliders?: ColliderSet;
}

/** The scenery's tags as the behaviour system uses them (the hanging points under limbs: hangers only, `recipeRoostTags`). */
const FROM_SCENERY: Partial<Record<SceneryTag, AttachTag>> = {
    leaf: "leaf",
    branch: "branch",
    canopy_perch: "branch",
    bark: "bark",
    canopy_climb: "bark",
    flower_head: "flower",
    rock_face: "rock_face",
    tide_pool: "tide_pool",
    house_wall: "house_wall",
    house_eave: "house_wall",
    porch_light: "porch_light",
    lamp: "porch_light",
    leaf_litter: "leaf_litter",
    worm_hole: "worm_hole",
    burrow: "burrow_entrance",
    pond_surface: "pond_surface",
    // (2026-11-11.) Shelves on cliffs and rocks are ledges; a thick limb is a branch (its size range says who it bears);
    // fence posts and roof edges are posts to perch on; the hanging points under limbs are where bats and sloths hang.
    ledge: "cliff_ledge",
    limb: "branch",
    tree_hollow: "tree_hollow",
    fence_post: "post",
    roof_edge: "post",
    canopy_hang: "canopy_hang",
    // (Graphics batch 6: the tops of the fallen logs, on the drawn bark.)
    log: "log_top"
};

/**
 * How far past a drawn rock's box (the map lane's `map/rocks.ts` drawnRocks, the shape its `inRock` tests, so the
 * walk and the map's placing agree on what is rock) a walker keeps: the walk grid tests its 2 m cells' centres, so
 * with 0.2 m of clearance a cell whose centre is outside the box widened by this much (1.45 m, over half a cell's
 * diagonal however the rock is turned) holds no point of the rock.
 */
export const ROCK_MARGIN = 1.25;

/** How far the garden pond's ring of stones reaches past its water (m: `micro-scene.ts` stones at radius + 0.05, up to 0.3 across). */
export const POND_STONES = 0.3;

/** Is (x, z) within `widen` of a drawn rock's box (the test `inRock` makes, in the rock's own frame)? */
function nearDrawnRock(rock: DrawnRock, x: number, z: number, widen: number): boolean {
    const dx = x - rock.x;
    const dz = z - rock.z;
    const lx = dx * rock.cos - dz * rock.sin;
    const lz = dx * rock.sin + dz * rock.cos;
    return lx >= rock.hx0 - widen && lx <= rock.hx1 + widen && lz >= rock.hz0 - widen && lz <= rock.hz1 + widen;
}

class GridIndex {
    // (Numeric cell keys: the string keys were a large part of a cold schedule's cost. Same cells, same order.)
    private readonly cells = new Map<number, AttachPoint[]>();
    constructor(private readonly cell: number) {}
    private static key(i: number, j: number): number {
        return (i + 32768) * 65536 + (j + 32768);
    }
    add(point: AttachPoint) {
        const key = GridIndex.key(Math.floor(point.x / this.cell), Math.floor(point.z / this.cell));
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
                const list = this.cells.get(GridIndex.key(cx + dx, cz + dz));
                if (!list) continue;
                for (const p of list) if (Math.hypot(p.x - x, p.z - z) <= r) out.push(p);
            }
        }
        return out;
    }
}

const TREE_KINDS = new Set<DecorItem["kind"]>(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "canopy"]);
const UP = {nx: 0, ny: 1, nz: 0};

/**
 * The ground's height on a 0.5 m lattice, each corner worked out the first time it is needed (`world.ts`
 * `heightAt`), and read between corners bilinearly: animals are posed every frame, and the analytic ground costs
 * tens of microseconds a point. Within a centimetre or two of the analytic ground on the island's slopes (finer
 * than the drawn terrain mesh).
 */
class HeightLattice {
    private static readonly STEP = 0.5;
    private readonly n = Math.ceil((TERRAIN_HALF * 2) / HeightLattice.STEP) + 2;
    // Doubles: a value read back must be the value first worked out (float32 would round only after the first read).
    private readonly cache = new Float64Array(this.n * this.n).fill(Number.NaN);
    private corner(i: number, j: number): number {
        const k = j * this.n + i;
        let h = this.cache[k];
        if (Number.isNaN(h)) h = this.cache[k] = groundHeight(-TERRAIN_HALF + i * HeightLattice.STEP, -TERRAIN_HALF + j * HeightLattice.STEP);
        return h;
    }
    readonly at = (x: number, z: number): number => {
        const fx = (x + TERRAIN_HALF) / HeightLattice.STEP;
        const fz = (z + TERRAIN_HALF) / HeightLattice.STEP;
        const i = Math.floor(fx);
        const j = Math.floor(fz);
        if (i < 0 || j < 0 || i >= this.n - 1 || j >= this.n - 1) return groundHeight(x, z);
        const u = fx - i;
        const v = fz - j;
        const a = this.corner(i, j);
        const b = this.corner(i + 1, j);
        const c = this.corner(i, j + 1);
        const d = this.corner(i + 1, j + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

/** The sampler over the graphics lane's scenery interface, built now. */
export function sceneSampler(): ArkWorldSampler {
    const job = sceneSamplerTasks();
    return new SlicedBuild(job.tasks, job.finish).run();
}

/**
 * The sampler as tasks (`behaviour-build.ts`): the same work in the same order as building it all at once (so the
 * same points, ids and version), cut small so it can be built between frames. The graphics lane's
 * `allAttachPoints` is one task (it is theirs, and shared with the props); everything derived here is cut fine.
 */
export function sceneSamplerTasks(): {tasks: BuildTask[]; finish: () => ArkWorldSampler} {
    const points = new Map<AttachTag, AttachPoint[]>();
    const indexes = new Map<AttachTag, GridIndex>();
    const add = (point: Omit<AttachPoint, "id"> & {id?: string}) => {
        const list = points.get(point.tag) ?? [];
        const full = {...point, id: point.id ?? `${point.tag}:${list.length}`} as AttachPoint;
        list.push(full);
        points.set(point.tag, list);
        let index = indexes.get(point.tag);
        if (!index) indexes.set(point.tag, (index = new GridIndex(8)));
        index.add(full);
    };
    const surface = (x: number, z: number) => surfaceAt(x, z);
    const lattice = new HeightLattice();
    const tasks: BuildTask[] = [];

    // The scenery's own points (trees, flowers, rocks, the house, lamps, ponds, the ground's holes and litter).
    let scenery: SceneryPoint[] = [];
    tasks.push(once(() => {
        scenery = allAttachPoints();
    }));
    tasks.push(chunked(() => scenery.length, 400, (i) => {
        const p = scenery[i];
        const tag = FROM_SCENERY[p.tag];
        if (!tag) return;
        add({id: p.id, tag, x: p.position.x, y: p.position.y, z: p.position.z, nx: p.normal.x, ny: p.normal.y, nz: p.normal.z, yaw: p.yaw, size: p.size, zone: (p.zone ?? surface(p.position.x, p.position.z).zone) as ArkZone, ...(tag === "canopy_hang" ? {clearBelow: p.clearBelow, radius: p.radius} : {})});
    }));

    // From the scenery's items: rock tops (basking, perching), shade under trees and shrubs, reeds, cave mouths; and the obstacles.
    const obstacles: Array<[number, number, number]> = [];
    let items: DecorItem[] = [];
    let rocks: DrawnRock[] = [];
    const rockOf = new Map<string, DrawnRock>();
    tasks.push(once(() => {
        items = [...worldDecor(), ...forestFill()];
        rocks = drawnRocks();
        for (const rock of rocks) rockOf.set(`${rock.x},${rock.z}`, rock);
        // The mountain's crags and boulders (scenery lane, rock-layout.ts): their tops too, to bask and perch on.
        for (const rock of rocks) {
            if (!rock.source || rock.source === "decor") continue;
            add({tag: "rock_top", x: rock.x, y: rock.y1, z: rock.z, ...UP, yaw: 0, size: [0.02, Math.min(rock.hx1 - rock.hx0, rock.hz1 - rock.hz0) * 0.7], zone: surface(rock.x, rock.z).zone});
        }
    }));
    tasks.push(chunked(() => items.length, 60, (i) => {
        const item = items[i];
        if (TREE_KINDS.has(item.kind)) {
            const sx = item.x + 1.4 * item.scale;
            const sz = item.z + 1.1 * item.scale;
            const s = surface(sx, sz);
            if (s.waterDepth <= 0 && i % 2 === 0) add({tag: "shade", x: sx, y: s.height, z: sz, ...UP, yaw: item.rotation, size: [0.05, 4], zone: s.zone});
            obstacles.push([item.x, item.z, 0.35 * item.scale]);
        } else if (item.kind === "rock") {
            const s = surface(item.x, item.z);
            // The rock as drawn (the map lane's drawnRocks: graphics batch 5's asset rock, turned and scaled as the
            // renderer places it): its top is where a small animal basks or perches; its box keeps walkers out (blocked).
            const solid = rockOf.get(`${item.x},${item.z}`);
            add({tag: "rock_top", x: item.x, y: solid ? solid.y1 : item.y + 0.18 * item.scale + 0.53 * item.scale * 0.95, z: item.z, ...UP, yaw: item.rotation, size: [0.02, 1.4 * item.scale], zone: s.zone});
            if (item.scale > 1.3 && (s.zone === "mountains" || s.surface === "rock")) add({tag: "cave_mouth", x: item.x + Math.sin(item.rotation) * item.scale, y: s.height, z: item.z + Math.cos(item.rotation) * item.scale, nx: Math.sin(item.rotation), ny: 0, nz: Math.cos(item.rotation), yaw: item.rotation, size: [0.05, 2.5], zone: s.zone});
        } else if (item.kind === "reed") {
            add({tag: "reeds", x: item.x, y: item.y, z: item.z, ...UP, yaw: item.rotation, size: [0.02, 1.2], zone: surface(item.x, item.z).zone});
        } else if (item.kind === "shrub" || item.kind === "cactus") {
            if (i % 2 === 0) {
                const s = surface(item.x + 0.7, item.z + 0.4);
                if (s.waterDepth <= 0) add({tag: "shade", x: item.x + 0.7, y: s.height, z: item.z + 0.4, ...UP, yaw: item.rotation, size: [0.02, 0.9], zone: s.zone});
            }
            obstacles.push([item.x, item.z, 0.5 * item.scale]);
        } else if (item.kind === "barn") obstacles.push([item.x, item.z, 5.5]);
    }));
    tasks.push(once(() => {
        obstacles.push([COTTAGE.x, COTTAGE.z, Math.max(COTTAGE.width, COTTAGE.depth) / 2]);
    }));
    // The fallen logs (graphics batch 6, `floor-assets.ts` floorObstacles: circles along each log): walkers go round them.
    // A small animal (up to 0.8 m) may climb onto one: its top is the scenery's `log` points on the drawn bark (log_top).
    let logs: Array<{x: number; z: number; radius: number}> = [];
    tasks.push(once(() => {
        logs = floorObstacles();
    }));
    tasks.push(chunked(() => logs.length, 60, (k) => {
        const log = logs[k];
        // (0.9 m more than the log, as for a fence: the walk grid's 2 m cells, whose centres are tested, never step through it.)
        obstacles.push([log.x, log.z, log.radius + 0.9]);
    }));
    // The hamlet's plots (`setBehaviourHomePlots`, the map lane's homePlots): their houses, barns and coops, and the
    // props' picket and paddock fences, so a wild walker's path goes round them. Doors are outside the walls and the
    // fences' gates are gaps, so a resident's door beat (the map's, off the schedule) passes.
    const plots = behaviourPlots;
    const solids: PlotSolid[] = [];
    const fences: FenceRun[] = [];
    tasks.push(chunked(() => (plots ? plots.length : 0), 1, (k) => {
        const plot = plots![k];
        const frame = plotFrame(plot);
        if (plot.kind === "house") {
            solids.push({frame, x0: -COTTAGE.width / 2, x1: COTTAGE.width / 2, z0: -COTTAGE.depth / 2, z1: COTTAGE.depth / 2});
            for (const [ax, az, bx, bz] of picketRuns()) fences.push({a: frame.toWorld(ax, az), b: frame.toWorld(bx, bz)});
        } else {
            if (plot.barn) solids.push({frame, x0: -3.2, x1: 3.2, z0: -2.2, z1: 2.2});
            const coop = coopSpot(plot);
            const c = Math.cos(coop.turn);
            const sn = Math.sin(coop.turn);
            // The coop (about 1.6 by 1.2 m), turned in the plot's frame: its corners' box.
            const corners = [[-0.8, -0.6], [0.8, -0.6], [0.8, 0.6], [-0.8, 0.6]].map(([lx, lz]) => ({x: coop.x + lx * c + lz * sn, z: coop.z - lx * sn + lz * c}));
            solids.push({frame, x0: Math.min(...corners.map((p) => p.x)), x1: Math.max(...corners.map((p) => p.x)), z0: Math.min(...corners.map((p) => p.z)), z1: Math.max(...corners.map((p) => p.z))});
            for (const segment of paddockSegments(paddockRect(plot))) if (!segment.gate) fences.push({a: frame.toWorld(segment.a.x, segment.a.z), b: frame.toWorld(segment.b.x, segment.b.z)});
        }
    }));

    // Water edges: just dry ground at the lake, along the river, round the garden pond, walked out from the water.
    const edge = (x: number, z: number, outward: number, zone?: ArkZone) => {
        for (let d = 0; d < 6; d += 0.25) {
            const px = x + Math.cos(outward) * d;
            const pz = z + Math.sin(outward) * d;
            const s = surface(px, pz);
            if (s.waterDepth <= 0 && s.height > 0.05) {
                add({tag: "water_edge", x: px, y: s.height, z: pz, ...UP, yaw: outward + Math.PI, size: [0.02, 6], zone: zone ?? s.zone});
                return;
            }
        }
    };
    tasks.push(chunked(() => 28, 7, (k) => {
        const a = (k / 28) * Math.PI * 2;
        edge(LAKE.x + Math.cos(a) * (LAKE.r - 1), LAKE.z + Math.sin(a) * (LAKE.r - 1), a, "river_lake");
    }));
    tasks.push(chunked(() => Math.max(RIVER.length - 1, 0), 2, (seg) => {
        const [ax, az] = RIVER[seg];
        const [bx, bz] = RIVER[seg + 1];
        const normal = Math.atan2(bx - ax, -(bz - az));
        for (let t = 0.2; t < 1; t += 0.3) {
            edge(ax + (bx - ax) * t, az + (bz - az) * t, normal);
            edge(ax + (bx - ax) * t, az + (bz - az) * t, normal + Math.PI);
        }
    }));
    // The garden pond (drawn water over dry ground, so `surfaceAt` has no water there): where to drink is just outside
    // its ring of stones, facing the water (2026-11-11: a dog drank standing in it, from points 0.8 m inside).
    tasks.push(chunked(() => 6, 6, (k) => {
        const a = (k / 6) * Math.PI * 2;
        const r = GARDEN_POND.radius + POND_STONES + 0.25;
        const x = GARDEN_POND.x + Math.cos(a) * r;
        const z = GARDEN_POND.z + Math.sin(a) * r;
        add({tag: "water_edge", x, y: surface(x, z).height, z, ...UP, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), size: [0.02, 2.5], zone: "farm_garden"});
    }));
    // The sea's shore: just dry ground at the waterline all round the island (where seals, penguins and turtles go in and out).
    tasks.push(chunked(() => 120, 12, (k) => {
        const theta = (k / 120) * Math.PI * 2;
        const r = shoreRadius(theta);
        const s0 = surface(Math.cos(theta) * (r + 1.5), Math.sin(theta) * (r + 1.5));
        if (s0.cliff > 0.45) return;
        edge(Math.cos(theta) * (r + 2), Math.sin(theta) * (r + 2), theta + Math.PI);
    }));

    // A lattice over the land: grazing grass where the ground is grass, ledges where the coast is a cliff (a column of it a task).
    const step = 6;
    const columns: number[] = [];
    for (let x = -TERRAIN_HALF; x <= TERRAIN_HALF; x += step) columns.push(x);
    tasks.push(chunked(() => columns.length, 1, (c) => {
        const x = columns[c];
        for (let z = -TERRAIN_HALF; z <= TERRAIN_HALF; z += step) {
            const jitter = hashString(`${x},${z}`);
            const px = x + ((jitter % 97) / 97 - 0.5) * step;
            const pz = z + (((jitter >> 7) % 97) / 97 - 0.5) * step;
            const s = surface(px, pz);
            if (s.waterDepth > 0 || s.height <= 0.05) continue;
            if (s.cliff > 0.45 && s.normal.y > 0.6) add({tag: "cliff_ledge", x: px, y: s.height, z: pz, ...UP, yaw: Math.atan2(-px, -pz), size: [0.1, 1.5], zone: s.zone});
            if ((s.weights.grass ?? 0) > 0.45 && s.normal.y > 0.85) add({tag: "grass", x: px, y: s.height, z: pz, ...UP, yaw: 0, size: [0.05, 6], zone: s.zone});
        }
    }));

    const finish = (): ArkWorldSampler => {
        const obstacleIndex = new Map<string, Array<[number, number, number]>>();
        for (const o of obstacles) {
            const key = `${Math.floor(o[0] / 6)},${Math.floor(o[1] / 6)}`;
            const list = obstacleIndex.get(key) ?? [];
            list.push(o);
            obstacleIndex.set(key, list);
        }
        // The drawn rocks, each in every 6 m cell its box reaches.
        const rockIndex = new Map<string, DrawnRock[]>();
        for (const rock of rocks) {
            for (let i = Math.floor((rock.x - rock.reach) / 6); i <= Math.floor((rock.x + rock.reach) / 6); i++) {
                for (let j = Math.floor((rock.z - rock.reach) / 6); j <= Math.floor((rock.z + rock.reach) / 6); j++) {
                    const key = `${i},${j}`;
                    const list = rockIndex.get(key) ?? [];
                    list.push(rock);
                    rockIndex.set(key, list);
                }
            }
        }
        const rockAt = (x: number, z: number, clearance: number) => {
            const widen = clearance + ROCK_MARGIN;
            // (A point within `widen` of a box, in the rock's frame, is within widen·√2 of it on the world's axes.)
            const reach = widen * Math.SQRT2;
            for (let i = Math.floor((x - reach) / 6); i <= Math.floor((x + reach) / 6); i++) {
                for (let j = Math.floor((z - reach) / 6); j <= Math.floor((z + reach) / 6); j++) {
                    for (const rock of rockIndex.get(`${i},${j}`) ?? []) if (nearDrawnRock(rock, x, z, widen)) return true;
                }
            }
            return false;
        };
        const counts = ATTACH_TAGS.map((tag) => points.get(tag)?.length ?? 0).join(".");
        // (The plots are in the version: a new plot rebuilds the walk grid.)
        const plotKey = plots ? `:${plots.map((p) => `${p.id}@${p.x.toFixed(2)},${p.z.toFixed(2)},${p.rotation.toFixed(3)}`).join(";")}` : "";
        // A building keeps walkers ROCK_MARGIN off its walls (a turned plot's corner is up to half a cell's diagonal from
        // the nearest cell's centre: with 0.8 m two corners of the grown hamlet's houses sat on walkable cells) and a fence
        // 0.9 m off its line, so the walk grid's 2 m cells (whose centres are tested) never cut a corner nor step between a
        // fence's posts; the gaps of gates stay what they are.
        const solidAt = (x: number, z: number, clearance: number) => {
            const margin = ROCK_MARGIN + clearance;
            for (const solid of solids) {
                const local = solid.frame.toLocal(x, z);
                if (local.x > solid.x0 - margin && local.x < solid.x1 + margin && local.z > solid.z0 - margin && local.z < solid.z1 + margin) return true;
            }
            for (const fence of fences) if (segmentDistance(x, z, fence.a, fence.b) < 0.9 + clearance) return true;
            return false;
        };
        // The world's solid things as drawn (`collide/colliders.ts`): exact checks for the walk grid's edges and paths.
        // What the walk grid's cells did not keep walkers off before (the farm's field fences, hay bales, lamp posts,
        // the plots' solid props: compost, water butts, the hay shelter, troughs, coops) is added to its cells here, with
        // the same margins as a fence (0.9 m off its line) and a building (ROCK_MARGIN off its sides).
        const colliders = colliderSetFor(plots);
        const added = new ColliderSet(colliders.list.filter((c) => c.id.startsWith("field-fence") || c.kind === "hay" || c.id.startsWith("lamp") || (c.kind === "building" && !c.id.startsWith("house:") && !c.id.startsWith("barn:"))), "cells");
        const addedAt = (x: number, z: number, clearance: number) => {
            for (const c of added.near(x, z, ROCK_MARGIN + clearance + 0.1)) {
                const margin = c.shape === "box" ? ROCK_MARGIN : 0.9 - (c.shape === "segment" ? c.r : 0);
                if (colliderDistance(c, x, z) < margin + clearance) return true;
            }
            return false;
        };
        return {
            colliders,
            // (The drawn rocks are in it too: a new rock set rebuilds the walk grid; and the colliders, any change of them.)
            version: `scene:${items.length}:${scenery.length}:${counts}:rocks${rocks.length}${plotKey}:${colliders.version}`,
            // The ground's height (the same number `surfaceAt` gives), from a lattice of it filled as asked: it is asked every frame.
            heightAt: lattice.at,
            isWater: (x, z) => surface(x, z).waterDepth > 0,
            slope: (x, z) => {
                const n = surface(x, z).normal;
                return Math.sqrt(Math.max(1 - n.y * n.y, 0)) / Math.max(n.y, 0.05);
            },
            zoneAt: (x, z) => surface(x, z).zone,
            attachPoints: (tag, near) => (near ? indexes.get(tag)?.near(near.x, near.z, near.r) ?? [] : points.get(tag) ?? []),
            blocked: (x, z, clearance) => {
                const cx = Math.floor(x / 6);
                const cz = Math.floor(z / 6);
                for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const [ox, oz, r] of obstacleIndex.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(x - ox, z - oz) < r + clearance) return true;
                if (rockAt(x, z, clearance)) return true;
                // The garden pond and its stones, kept as clear as a rock (no walkable cell holds any of it): a land
                // animal drinks at its edge, never walks in.
                if (Math.hypot(x - GARDEN_POND.x, z - GARDEN_POND.z) < GARDEN_POND.radius + POND_STONES + ROCK_MARGIN + clearance) return true;
                if (addedAt(x, z, clearance)) return true;
                return solids.length || fences.length ? solidAt(x, z, clearance) : false;
            }
        };
    };
    return {tasks, finish};
}

/** A building's footprint in its plot's frame (local x0..x1, z0..z1); a fence run (world). */
type PlotSolid = {frame: ReturnType<typeof plotFrame>; x0: number; x1: number; z0: number; z1: number};
type FenceRun = {a: {x: number; z: number}; b: {x: number; z: number}};

function segmentDistance(x: number, z: number, a: {x: number; z: number}, b: {x: number; z: number}): number {
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const length = vx * vx + vz * vz;
    const t = length > 0 ? Math.min(Math.max(((x - a.x) * vx + (z - a.z) * vz) / length, 0), 1) : 0;
    return Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
}

/** The hamlet's plots the behaviour world keeps walkers out of (null: none beyond today's cottage and barn). */
let behaviourPlots: HomePlot[] | null = null;
/** The plots the behaviour world is built for now (`collide/` builds its colliders for the same ones). */
export function behaviourHomePlots(): HomePlot[] | null {
    return behaviourPlots;
}
let behaviourPlotsKey = "";

/**
 * Give the behaviour world the hamlet's plots (the map lane's `hamletPlotsFor`, set beside `setAttachHomePlots`).
 * Returns true when they changed: the shared sampler is dropped, and the scene builds its world again (sliced).
 */
export function setBehaviourHomePlots(plots: HomePlot[] | null): boolean {
    const key = plots ? plots.map((p) => `${p.id}@${p.x},${p.z},${p.rotation},${p.kind},${p.barn ? 1 : 0}`).join(";") : "";
    if (key === behaviourPlotsKey) return false;
    behaviourPlotsKey = key;
    behaviourPlots = plots ? plots.map((p) => ({...p})) : null;
    resetWorldSampler();
    return true;
}

let shared: ArkWorldSampler | null = null;
/**
 * Part C: another island's sampler (`islands/town/sampler.ts`), installed while that island is the one loaded (one at a
 * time): the schedule, the walk grid and everything that asks `worldSampler()` read it. Null: the wild island's.
 */
let installed: ArkWorldSampler | null = null;
export function installWorldSampler(sampler: ArkWorldSampler | null): void {
    if (installed === sampler) return;
    installed = sampler;
    resetWorldSampler();
}
/** The shared sampler being built a slice at a time (`worldSamplerBuild`); asked for before it is done, it is finished at once. */
let building: SlicedBuild<ArkWorldSampler> | null = null;
/** The sampler in use, built once from the scenery (and again whenever `resetWorldSampler` is called after a terrain change). */
export function worldSampler(): ArkWorldSampler {
    if (installed) return installed;
    if (!shared) shared = building ? building.run() : sceneSampler();
    return shared;
}
/** Built already (`worldSampler` would return at once). */
export function worldSamplerReady(): boolean {
    return installed !== null || shared !== null;
}
/** The shared sampler built a slice at a time (`SlicedBuild.step`); it becomes `worldSampler`'s once done. */
export function worldSamplerBuild(): SlicedBuild<ArkWorldSampler> {
    if (installed) {
        const island = installed;
        return new SlicedBuild<ArkWorldSampler>([], () => island);
    }
    if (shared) {
        const built = shared;
        return new SlicedBuild<ArkWorldSampler>([], () => built);
    }
    if (building) return building;
    const job = sceneSamplerTasks();
    const build: SlicedBuild<ArkWorldSampler> = new SlicedBuild(job.tasks, () => {
        const made = job.finish();
        shared = made;
        if (building === build) building = null;
        return made;
    });
    building = build;
    return build;
}
export function resetWorldSampler() {
    shared = null;
    building = null;
}
