/**
 * What the behaviour schedule knows of the town (the wild island's `world-sampler.ts` interface, `ArkWorldSampler`):
 * the ground's height, water, slope and zone, the places animals go to, and what stands in the way. So the town's
 * animals live on the same schedule, the same walk grid and the same motion pass as the wild island's.
 *
 * - **Places** (attach points) from the town's own spots (`areas.ts`) and trees: lawns, yards, paddocks, runs, the
 *   park and the enclosures are grass; the wood and churchyard leaf litter; the canal's banks, the ponds and the zoo's
 *   pools water edges; ridges, ledges and tall tops posts and ledges; eaves house walls; lamp-lit walls porch lights;
 *   bins and drains burrow mouths; each tree's trunk, limbs, crown and shade. Each zoo enclosure's feeding station is a
 *   grass place too (the keepers' food is put down there).
 * - **In the way**: the buildings, the tree trunks, and the zoo's fences and nets (raised thick on the 1 m raster so
 *   the 2 m walk grid has no gap through them: an enclosure is its own room). Garden hedges, walls and fences are not
 *   (cats, foxes, rats and hedgehogs go through and over them).
 *
 * Pure in the plan and the open enclosures: the same for every viewer.
 */

import type {ArkZone} from "@/ark-scene/types";
import type {ArkWorldSampler, AttachPoint, AttachTag} from "@/ark-scene/world-sampler";
import type {ColliderSet} from "@/ark-scene/collide/colliders";
import {inPoly, polyEdgeDistance, type Poly} from "@/ark-scene/islands/town/geom";
import {sampleTownGround, townHeight, type TownSurface} from "@/ark-scene/islands/town/ground";
import {TOWN_HALF, townPlan} from "@/ark-scene/islands/town/plan";
import {townAreas, zooLayout, zooSpotsFor, type SpotWhere, type TownSpot} from "@/ark-scene/islands/town/areas";
import {townObstacles} from "@/ark-scene/islands/town/obstacles";
import {townTreePerches, townTrees} from "@/ark-scene/islands/town/trees";
import {townWaterSurface} from "@/ark-scene/islands/town/drawn-ground";
import {homeSiteFootprints, inTownSolid} from "@/ark-scene/islands/town/tanks";
import {corners} from "@/ark-scene/islands/town/geom";
import {townHouseholds} from "@/ark-scene/islands/town/areas";

/** Lane TB: spots on raised things (roofs, eaves, ledges, a balcony, a lamp-lit wall); every other spot is on the ground. */
const RAISED_WHERE = new Set<SpotWhere>(["roof", "eave", "ledge", "tall", "belfry", "balcony", "window", "lamp_wall"]);

const RASTER = 1;
const BUCKET = 12;

const TAGS_BY_WHERE: Partial<Record<SpotWhere, AttachTag[]>> = {
    lawn: ["grass"],
    yard: ["grass"],
    courtyard: ["grass", "shade"],
    paddock: ["grass"],
    farmyard: ["grass"],
    run: ["grass"],
    garden: ["grass", "flower"],
    park: ["grass"],
    allotment: ["grass", "worm_hole"],
    churchyard: ["grass", "leaf_litter"],
    wood: ["leaf_litter", "shade"],
    wild_corner: ["grass", "leaf_litter"],
    hedgerow: ["grass", "shade"],
    field_margin: ["grass", "flower"],
    canal: ["water_edge", "reeds"],
    millpond: ["water_edge", "reeds"],
    farm_pond: ["water_edge", "reeds"],
    beach: ["grass"],
    roof: ["post"],
    eave: ["house_wall"],
    ledge: ["cliff_ledge", "post"],
    tall: ["cliff_ledge", "post"],
    belfry: ["cliff_ledge", "tree_hollow"],
    bin: ["burrow_entrance"],
    drain: ["burrow_entrance", "worm_hole"],
    quay: ["rock_top", "post"],
    square: ["grass"],
    lamp_wall: ["porch_light", "house_wall"],
    enclosure: ["grass"],
    pool: ["water_edge", "pond_surface"],
    balcony: ["post"]
};

const SIZE_BY_TAG: Partial<Record<AttachTag, [number, number]>> = {
    grass: [0.02, 8],
    leaf_litter: [0.005, 1.2],
    shade: [0.05, 6],
    flower: [0.005, 0.12],
    worm_hole: [0.005, 0.4],
    water_edge: [0.05, 6],
    reeds: [0.02, 1.5],
    pond_surface: [0.01, 1.5],
    post: [0.05, 1.2],
    cliff_ledge: [0.05, 1.2],
    house_wall: [0.005, 0.35],
    porch_light: [0.005, 0.3],
    burrow_entrance: [0.03, 0.5],
    rock_top: [0.05, 1.5],
    tree_hollow: [0.02, 0.6],
    branch: [0.02, 1.4],
    bark: [0.005, 0.8],
    leaf: [0.003, 0.3]
};

const ZONE_BY_SURFACE: Record<TownSurface, ArkZone> = {
    sea: "open_ocean",
    sand: "seashore",
    shore: "seashore",
    grass: "farm_garden",
    lawn: "farm_garden",
    park: "farm_garden",
    meadow: "grassland",
    wood: "woodland",
    field: "grassland",
    orchard: "farm_garden",
    paddock: "grassland",
    farmyard: "farm_garden",
    zoo: "farm_garden",
    allotment: "farm_garden",
    churchyard: "farm_garden",
    square: "farm_garden",
    bank: "river_lake",
    water: "river_lake"
};

export type TownSampler = ArkWorldSampler & {readonly half: number; readonly centre: {x: number; z: number}};

/**
 * The town's behaviour world for these open enclosures (the snapshot's names, or the launch set), in the world frame:
 * the town's local frame moved to `origin` (decision 141: one world, the town across the strait). (0, 0): its own frame.
 */
export type TownSamplerData = {solid: Uint8Array; points: AttachPoint[]};

/** The sampler's heavy part (its obstacle raster and its places, world frame): pure, so the prebuild worker makes it (decision 153). */
export function townSamplerData(open: readonly string[], origin: {x: number; z: number} = {x: 0, z: 0}): TownSamplerData {
    const plan = townPlan();
    const half = TOWN_HALF;
    const ox = origin.x;
    const oz = origin.z;
    const n = Math.ceil((half * 2) / RASTER);
    const solid = new Uint8Array(n * n);
    const cellOf = (x: number, z: number) => {
        const i = Math.floor((x + half) / RASTER);
        const j = Math.floor((z + half) / RASTER);
        return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
    };
    // (Lane TB: `margin`: every cell within it of the footprint too, so a 1 m cell's centre test leaves no half-metre
    // strip inside a building's wall for a small animal to rest in.)
    const fillPoly = (poly: Poly, margin = 0) => {
        let x0 = Infinity;
        let z0 = Infinity;
        let x1 = -Infinity;
        let z1 = -Infinity;
        for (const p of poly) {
            x0 = Math.min(x0, p.x - margin);
            z0 = Math.min(z0, p.z - margin);
            x1 = Math.max(x1, p.x + margin);
            z1 = Math.max(z1, p.z + margin);
        }
        for (let x = Math.floor(x0); x <= x1; x += RASTER) {
            for (let z = Math.floor(z0); z <= z1; z += RASTER) {
                if (!inPoly(poly, x + 0.5, z + 0.5) && !(margin > 0 && polyEdgeDistance(poly, x + 0.5, z + 0.5) < margin)) continue;
                const k = cellOf(x + 0.5, z + 0.5);
                if (k >= 0) solid[k] = 1;
            }
        }
    };
    const fillLine = (line: Poly, width: number) => {
        for (let s = 1; s < line.length; s++) {
            const a = line[s - 1];
            const b = line[s];
            const length = Math.hypot(b.x - a.x, b.z - a.z);
            const steps = Math.max(1, Math.ceil(length / 0.4));
            for (let t = 0; t <= steps; t++) {
                const x = a.x + ((b.x - a.x) * t) / steps;
                const z = a.z + ((b.z - a.z) * t) / steps;
                for (let dx = -width / 2; dx <= width / 2; dx += 0.5) {
                    for (let dz = -width / 2; dz <= width / 2; dz += 0.5) {
                        const k = cellOf(x + dx, z + dz);
                        if (k >= 0) solid[k] = 1;
                    }
                }
            }
        }
    };
    const fillDisc = (x: number, z: number, r: number) => {
        for (let dx = -r; dx <= r; dx += 0.5) {
            for (let dz = -r; dz <= r; dz += 0.5) {
                if (dx * dx + dz * dz > r * r) continue;
                const k = cellOf(x + dx, z + dz);
                if (k >= 0) solid[k] = 1;
            }
        }
    };
    for (const o of townObstacles(plan, open)) {
        if (o.kind === "building") fillPoly(o.poly, 0.5);
        else if (o.kind === "tree") fillDisc(o.x, o.z, Math.max(o.r, 0.25));
        // (A zoo fence or net 2.5 m thick on the raster: the walk grid's 2 m cells have no way through it.)
        else if (o.kind === "barrier" && o.hard) fillLine(o.line, 2.5);
    }
    // (Lane TB: the garden rooms and the raised garden ponds stand in the way too: nobody walks through their glass.)
    for (const b of homeSiteFootprints(townHouseholds(plan), plan)) fillPoly(corners(b), 0.5);

    // The places.
    const points: AttachPoint[] = [];
    // (Places are made in the town's own frame and stored in the world's.)
    const add = (tag: AttachTag, id: string, x: number, y: number, z: number, nx = 0, ny = 1, nz = 0, yaw = 0) => {
        const size = SIZE_BY_TAG[tag] ?? [0.02, 4];
        points.push({id, tag, x: x + ox, y, z: z + oz, nx, ny, nz, yaw, size: [size[0], size[1]], zone: localZone(x, z)});
    };
    const localZone = (x: number, z: number): ArkZone => {
        const g = sampleTownGround(x, z);
        return g.height < 0 ? "open_ocean" : ZONE_BY_SURFACE[g.surface] ?? "farm_garden";
    };
    const spots: TownSpot[] = [...townAreas().spots.filter((s) => s.area !== "zoo"), ...zooSpotsFor(open)];
    spots.forEach((s, i) => {
        const tags = TAGS_BY_WHERE[s.where];
        if (!tags) return;
        // (Lane TB: a place on the ground never in a building's footprint, a garden room's or a pond's: some gardens and
        // bins lie under a block of flats; an animal going there rested inside its walls.)
        if (!RAISED_WHERE.has(s.where) && s.area !== "zoo" && inTownSolid(s.x, s.z, 0.3)) return;
        const yaw = ((i * 2654435761) >>> 0) % 6283 / 1000;
        // (A place on the ground is on it, or on the water's surface over it: a drain's mouth, a bank's edge, never under them.)
        const g = townHeight(s.x, s.z);
        const water = townWaterSurface(s.x, s.z);
        const y = RAISED_WHERE.has(s.where) || s.area === "zoo" ? s.y : water !== null && g < water ? water : Math.max(s.y, g);
        for (const tag of tags) add(tag, `town:${s.where}:${i}:${tag}`, s.x, y, s.z, 0, 1, 0, yaw);
    });
    for (const e of zooLayout(open).enclosures) {
        if (e.shared) continue;
        add("grass", `town:feed:${e.id}`, e.feeding.x, townHeight(e.feeding.x, e.feeding.z), e.feeding.z);
        e.enrichment.forEach((r, k) => add(r.what === "logs" ? "log_top" : "grass", `town:enrich:${e.id}:${k}`, r.at.x, townHeight(r.at.x, r.at.z) + (r.what === "logs" ? 0.5 : 0), r.at.z));
    }
    // Each tree's places on the drawn tree itself (its asset's bark, branch tops and leaves: `trees.ts`, lane GC), and its shade.
    townTrees(plan).forEach((t, i) => {
        if (t.low) return;
        // (Its shade on the ground beside it: never in a building's footprint, a garden room's or a pond's; lane TB.)
        if (!inTownSolid(t.x + 1.2, t.z + 0.6, 0.3)) add("shade", `town:tree:${i}:shade`, t.x + 1.2, townHeight(t.x + 1.2, t.z + 0.6), t.z + 0.6);
        let limb = 0;
        for (const p of townTreePerches(t)) add(p.tag, p.tag === "branch" ? `town:tree:${i}:limb${limb++}` : `town:tree:${i}:${p.tag}`, p.x, p.y, p.z, p.nx, p.ny, p.nz, p.yaw);
    });
    return {solid, points};
}

/** The town's behaviour world (see the top); `data`: its raster and places worked out already (`townSamplerData`). */
export function townWorldSampler(open: readonly string[], origin: {x: number; z: number} = {x: 0, z: 0}, colliders?: ColliderSet, data?: TownSamplerData): TownSampler {
    const half = TOWN_HALF;
    const ox = origin.x;
    const oz = origin.z;
    const n = Math.ceil((half * 2) / RASTER);
    const cellOf = (x: number, z: number) => {
        const i = Math.floor((x + half) / RASTER);
        const j = Math.floor((z + half) / RASTER);
        return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
    };
    const localZone = (x: number, z: number): ArkZone => {
        const g = sampleTownGround(x, z);
        return g.height < 0 ? "open_ocean" : ZONE_BY_SURFACE[g.surface] ?? "farm_garden";
    };
    const {solid, points} = data ?? townSamplerData(open, origin);

    // By tag, in buckets for the near queries.
    const byTag = new Map<AttachTag, {all: AttachPoint[]; buckets: Map<number, AttachPoint[]>}>();
    const bucketOf = (x: number, z: number) => Math.floor((x + 1000) / BUCKET) * 4096 + Math.floor((z + 1000) / BUCKET);
    for (const p of points) {
        let entry = byTag.get(p.tag);
        if (!entry) byTag.set(p.tag, (entry = {all: [], buckets: new Map()}));
        entry.all.push(p);
        const key = bucketOf(p.x, p.z);
        let list = entry.buckets.get(key);
        if (!list) entry.buckets.set(key, (list = []));
        list.push(p);
    }
    const version = `town@${ox},${oz}:${open.join(",")}`;
    return {
        version,
        half,
        centre: {x: ox, z: oz},
        // (L5: the walk grid's clearance and its paths exact against the town's own colliders, `colliders.ts`.)
        ...(colliders ? {colliders} : {}),
        heightAt: (x, z) => townHeight(x - ox, z - oz),
        // (Lane TB: the canal's, the millpond's and the farm pond's own level, held by the lock; the sea's 0 elsewhere,
        // under every bit of the town's dry land. A swimmer floats on the water that is drawn, never 1 m under it.)
        waterSurface: (x, z) => townWaterSurface(x - ox, z - oz) ?? 0,
        isWater: (x, z) => {
            const g = sampleTownGround(x - ox, z - oz);
            return g.surface === "water" || g.height < 0;
        },
        slope: (x, z) => {
            const d = 0.75;
            const lx = x - ox;
            const lz = z - oz;
            return Math.max(Math.abs(townHeight(lx + d, lz) - townHeight(lx - d, lz)), Math.abs(townHeight(lx, lz + d) - townHeight(lx, lz - d))) / (2 * d);
        },
        zoneAt: (x, z) => localZone(x - ox, z - oz),
        attachPoints: (tag, near) => {
            const entry = byTag.get(tag);
            if (!entry) return [];
            if (!near) return entry.all;
            const out: AttachPoint[] = [];
            const r2 = near.r * near.r;
            const i0 = Math.floor((near.x - near.r + 1000) / BUCKET);
            const i1 = Math.floor((near.x + near.r + 1000) / BUCKET);
            const j0 = Math.floor((near.z - near.r + 1000) / BUCKET);
            const j1 = Math.floor((near.z + near.r + 1000) / BUCKET);
            for (let i = i0; i <= i1; i++) {
                for (let j = j0; j <= j1; j++) {
                    for (const p of entry.buckets.get(i * 4096 + j) ?? []) if ((p.x - near.x) ** 2 + (p.z - near.z) ** 2 <= r2) out.push(p);
                }
            }
            return out;
        },
        blocked: (x, z, clearance) => {
            const r = Math.max(clearance, 0);
            for (let dx = -r; dx <= r + 1e-9; dx += Math.max(r, 0.5)) {
                for (let dz = -r; dz <= r + 1e-9; dz += Math.max(r, 0.5)) {
                    const k = cellOf(x - ox + dx, z - oz + dz);
                    if (k >= 0 && solid[k]) return true;
                }
            }
            return false;
        }
    };
}
