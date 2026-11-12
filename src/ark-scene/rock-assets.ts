/**
 * Which of the asset lane's rocks (`public/ark/assets/v1/rocks`) stands in for
 * each decor rock (graphics pass, batch 5), and where its attach points are.
 * Pure and deterministic: the renderer (`asset-rocks.ts`), the attach points
 * (`sampler.ts`) and the tests all ask these functions, so an animal on a rock
 * face sits on the very surface that is drawn.
 *
 * Each rock keeps its place, turn and footprint (about the procedural rock's
 * width), and takes a kind from where it lies: tide-pool rocks and barnacled
 * clusters on the shore, mossy boulders in the woods and by the water, bare
 * boulders and clusters elsewhere. Its attach points come from the asset's own
 * attach.json, which the asset lane measured on the drawn lod0 surface.
 */

import manifest from "@/ark-scene/assets-manifest.json";
import rockAttach from "../../public/ark/assets/v1/rocks/attach.json";
import {DECOR_SINK} from "@/ark-scene/micro-decor";
import {baseOutline, cachedRock, orient, ROCK_DETAIL, ROCK_VARIANTS, rockAttachRows, tiltedBox} from "@/ark-scene/rock-shapes";
import {arkWorld, heightAt, onArkWorld, sampleGround, zoneAt} from "@/ark-scene/world";

type RockInfo = {kind: string; height: number; bounds: {min: [number, number, number]; max: [number, number, number]}; lod_distances: [number, number, number]; lods: Array<{level: "lod0" | "lod1" | "lod2"; file: string; tris: number; doubleSided: boolean}>};
type Row = {tag: string; p: [number, number, number]; n: [number, number, number]; size: [number, number]; spot?: string};

const ASSETS = (manifest as unknown as {assets: Record<string, RockInfo & {group?: string; set?: string}>}).assets;
const ATTACH = rockAttach as unknown as Record<string, Row[]>;

/** The rock assets this mapping uses (cliff faces, scree, pebbles and stalagmites are for other places). */
export const ROCK_ASSET_IDS = ["boulder-a", "boulder-b", "boulder-cluster-a", "boulder-cluster-b", "boulder-mossy-a", "boulder-cluster-mossy-a", "boulder-cluster-barnacle-a", "boulder-cluster-barnacle-b", "tide-pool-rock-a", "tide-pool-rock-b"].filter((id) => ASSETS[id]);

/**
 * The decor's rocks on the mountain and the ice are made in code (scenery lane, the motion 100x pass: `rock-shapes.ts`
 * boulders and slabs, angular like the mountain's crags, not the asset set's round boulders): "gen-<style>-<variant>".
 * Their levels of detail are the shape's own meshes ("gen:<style>:<variant>:<detail>"), built, not loaded.
 */
const GENERATED = /^gen-(boulder|slab)-(\d+)$/;

/** How many of each style's shapes the decor's rocks use. */
const DECOR_SHAPES = {boulder: 3, slab: 2} as const;

function generated(id: string): {style: "boulder" | "slab"; variant: number} | null {
    const m = GENERATED.exec(id);
    return m ? {style: m[1] as "boulder" | "slab", variant: Number(m[2])} : null;
}

const generatedInfo = new Map<string, RockInfo>();

export function rockAssetInfo(id: string): RockInfo {
    const made = generated(id);
    if (!made) return ASSETS[id];
    let info = generatedInfo.get(id);
    if (!info) {
        const detail = ROCK_DETAIL[made.style];
        const near = cachedRock(made.style, made.variant, detail[0]);
        info = {
            kind: made.style,
            height: near.bounds.max[1],
            bounds: near.bounds,
            // The asset boulders' own distances.
            lod_distances: [14.4, 31, 76],
            lods: (["lod0", "lod1", "lod2"] as const).map((level, k) => ({level, file: `gen:${made.style}:${made.variant}:${detail[k]}`, tris: cachedRock(made.style, made.variant, detail[k]).triangles, doubleSided: false}))
        };
        generatedInfo.set(id, info);
    }
    return info;
}

/** A level's file that is a rock made here: its shape and detail (`asset-rocks.ts` builds it instead of loading). */
export function generatedRockFile(file: string): {style: "boulder" | "slab"; variant: number; detail: number} | null {
    const m = /^gen:(boulder|slab):(\d+):(\d+)$/.exec(file);
    return m ? {style: m[1] as "boulder" | "slab", variant: Number(m[2]), detail: Number(m[3])} : null;
}

/** The procedural rock's footprint at scale 1 (vegetation.ts rock(): about 1.9 × 1.6 m across). */
const OLD_FOOTPRINT = 1.75;

function unit(x: number, z: number, salt: number): number {
    const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
    return h - Math.floor(h);
}

function pick(list: string[], r: number): string {
    const usable = list.filter((id) => ASSETS[id]);
    return usable[Math.min(Math.floor(r * usable.length), usable.length - 1)];
}

export type RockPlacement = {id: string; x: number; y: number; z: number; yaw: number; scale: number; /** Tilted to lie along its slope (scenery lane): its up. */ up?: [number, number, number]};

type RockItem = {kind: string; x: number; y: number; z: number; scale: number; rotation: number};

/**
 * The bigger wild island's rocks as placed (P3): seating one samples its ground a few dozen times, and over the island's
 * rocks that is most of a second on a phone, asked again by every reader (the renderer, the drawn rocks, the attach
 * points). So on v2 each decor rock's placement is kept by its item, the scenery worker's own handed in with the decor
 * (`primeRockPlacements`, runtime/prebuild.ts). Today's island places a rock at each ask, as before.
 */
let placedRocks = new WeakMap<object, RockPlacement | null>();
onArkWorld(() => {
    placedRocks = new WeakMap();
});

/** Runtime prebuild hook: the scenery worker's placements of these decor items (the primed decor's own), by index. */
export function primeRockPlacements(items: readonly object[], placements: ReadonlyArray<RockPlacement | null>): void {
    if (arkWorld() !== "v2") return;
    items.forEach((item, i) => {
        if (placements[i] !== undefined) placedRocks.set(item, placements[i]);
    });
}

/** The asset rock for a decor rock, placed (null when the rock set is missing). */
export function rockAssetFor(item: RockItem): RockPlacement | null {
    if (arkWorld() !== "v2") return placeRock(item);
    const known = placedRocks.get(item);
    if (known !== undefined) return known;
    const placed = placeRock(item);
    placedRocks.set(item, placed);
    return placed;
}

function placeRock(item: RockItem): RockPlacement | null {
    if (item.kind !== "rock" || !ROCK_ASSET_IDS.length) return null;
    const sample = sampleGround(item.x, item.z);
    const zone = zoneAt(sample);
    const r = unit(item.x, item.z, 5);
    let id: string;
    if (item.y < 0.55 && sample.land < 0.98) {
        // The shore: pools in low flat rock, barnacled clusters at the waterline, a few bare boulders.
        id = r < 0.45 ? pick(["tide-pool-rock-a", "tide-pool-rock-b"], unit(item.x, item.z, 6)) : r < 0.8 ? pick(["boulder-cluster-barnacle-a", "boulder-cluster-barnacle-b"], unit(item.x, item.z, 6)) : pick(["boulder-a", "boulder-b"], unit(item.x, item.z, 6));
    } else if (zone === "woodland" || zone === "rainforest" || zone === "wetland" || zone === "river_lake") {
        id = r < 0.45 ? "boulder-mossy-a" : r < 0.75 ? "boulder-cluster-mossy-a" : pick(["boulder-a", "boulder-b"], unit(item.x, item.z, 6));
    } else if (zone === "mountains" || zone === "polar") {
        // The mountain's and the ice's rocks: broken blocks and shelves made here, like the crags round them.
        // Five shapes (three boulders, two slabs; each a draw call per level in use), turned, leaned and sized apiece.
        const style = r < 0.72 ? "boulder" : "slab";
        const shapes = Math.min(DECOR_SHAPES[style], ROCK_VARIANTS[style]);
        id = `gen-${style}-${Math.min(Math.floor(unit(item.x, item.z, 6) * shapes), shapes - 1)}`;
    } else {
        id = r < 0.55 ? pick(["boulder-a", "boulder-b"], unit(item.x, item.z, 6)) : pick(["boulder-cluster-a", "boulder-cluster-b"], unit(item.x, item.z, 6));
    }
    if (!id) return null;
    const b = rockAssetInfo(id).bounds;
    const footprint = ((b.max[0] - b.min[0]) + (b.max[2] - b.min[2])) / 2;
    const scale = ((OLD_FOOTPRINT * item.scale) / footprint) * (TRIMMED.get(`${Math.round(item.x * 100)},${Math.round(item.z * 100)}`) ?? 1);
    // Leaned most of the way with its slope; a rock that would still hang over the downhill side lies fully along it.
    let up = lieAlong(item.x, item.z, footprint * scale * 0.4, LEAN);
    let placed = seat(item, b, scale, up);
    if (!placed.seated) {
        up = lieAlong(item.x, item.z, footprint * scale * 0.4, 1);
        placed = seat(item, b, scale, up);
    }
    // On a cliff's edge even that hangs over: deeper in, the rock showing through the ground there.
    if (!placed.seated) placed = seat(item, b, scale, up, 0.9);
    return {id, x: item.x, y: placed.y, z: item.z, yaw: item.rotation, scale, up};
}

/**
 * Rocks drawn smaller than the decor's size for them (decision 155), by where they stand (centimetres): the two shore
 * rocks by the rainforest's coast, `rock:decor265` and `rock:decor276`, leaned onto their steep shelf, closed the nook
 * of water west of them on a mallard's dabbling (every straight way north or east ran into them). Three quarters of
 * their size opens it; they still lean with the shelf, sit in it and stand out of the water.
 */
const TRIMMED: ReadonlyMap<string, number> = new Map([["-7735,1701", 0.75], ["-7740,1678", 0.75]]);

/** How much a rock leans with its ground (scenery lane): most of the way, as a rock that has settled on a slope. */
const LEAN = 0.75;

/** The ground's slope under a rock (over `reach` m), leaned into by LEAN: the rock's up. */
function lieAlong(x: number, z: number, reach: number, lean: number): [number, number, number] {
    const e = Math.max(reach, 0.5);
    const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    const l = Math.hypot(dx, 1, dz);
    const u = [(-dx / l) * lean, 1 - lean + (1 / l) * lean, (-dz / l) * lean];
    const m = Math.hypot(u[0], u[1], u[2]);
    return [u[0] / m, u[1] / m, u[2] / m];
}

/** A placed rock's box as the map keeps rocks (`map/rocks.ts`, the decor's trees): turned, the tilt folded in. */
export function rockBox(placement: RockPlacement): {x: number; z: number; cos: number; sin: number; hx0: number; hx1: number; hz0: number; hz1: number; y0: number; y1: number} {
    const b = rockAssetInfo(placement.id).bounds;
    return {x: placement.x, z: placement.z, cos: Math.cos(placement.yaw), sin: Math.sin(placement.yaw), ...tiltedBox(b, placement.scale, placement.up ?? [0, 1, 0], placement.yaw, placement.y)};
}

/** A placed rock's base outline (world), every point of which is in the ground (`scenery-check.ts`). */
export function rockBase(placement: RockPlacement): Array<[number, number, number]> {
    const b = rockAssetInfo(placement.id).bounds;
    return baseOutline(b, placement.scale, placement.up ?? [0, 1, 0], placement.yaw, 0.85).map(([dx, dy, dz]) => [placement.x + dx, placement.y + dy, placement.z + dz]);
}

/**
 * Where a decor rock's origin goes so it sits into its slope (scenery lane): leaned with the ground (`lieAlong`), then
 * sunk until every point of its base's outline is under the ground by a few centimetres, so no edge hangs over the
 * downhill side; never higher than the decor's own sink, never sunk past `SINK_MOST` of its height (a rock on a cliff
 * keeps showing).
 */
const SINK_MOST = 0.55;

function seat(item: RockItem, b: {min: [number, number, number]; max: [number, number, number]}, scale: number, up: [number, number, number], most = SINK_MOST): {y: number; seated: boolean} {
    const ground = heightAt(item.x, item.z);
    let need = 0;
    for (const [dx, dy, dz] of baseOutline(b, scale, up, item.rotation, 0.85)) need = Math.max(need, ground + dy - heightAt(item.x + dx, item.z + dz) + 0.04);
    const deepest = ground - most * b.max[1] * scale;
    const y = Math.min(item.y - DECOR_SINK, ground - need);
    return {y: Math.max(y, Math.min(item.y - DECOR_SINK, deepest)), seated: y >= deepest};
}

export type RockAttach = {tag: string; spot: string; position: {x: number; y: number; z: number}; normal: {x: number; y: number; z: number}; size: [number, number]};

/** A placed rock's attach points (attach.json, measured on the drawn lod0 surface), in the world. */
export function rockAttachPoints(placement: RockPlacement): RockAttach[] {
    const made = generated(placement.id);
    const rows: Row[] = made ? rockAttachRows(made.style, made.variant) : ATTACH[placement.id] ?? [];
    // The renderer's tilt then turn (three.js turns about +y by yaw: x' = x cos + z sin, z' = -x sin + z cos).
    const rotate = orient(placement.up ?? [0, 1, 0], placement.yaw);
    const turn = (v: [number, number, number]) => {
        const [x, y, z] = rotate(v[0], v[1], v[2]);
        return {x, y, z};
    };
    return rows.map((row) => {
        const p = turn(row.p);
        return {
            tag: row.tag,
            spot: row.spot ?? "rocks",
            position: {x: placement.x + p.x * placement.scale, y: placement.y + p.y * placement.scale, z: placement.z + p.z * placement.scale},
            normal: turn(row.n),
            size: [row.size[0], row.size[1] * placement.scale]
        };
    });
}

/**
 * One of a rock's faces for an attach point the sampler asks for by a direction round the rock (an angle, and how far
 * up 0…1): the asset's rock face or ledge nearest that direction that looks outward (not into a cluster's own
 * stones), skipping faces this rock has given already. Keeps the sampler's ids and its random draws.
 */
export function rockFaceToward(placement: RockPlacement, angle: number, up: number, used: Set<number>): {point: RockAttach; index: number} | null {
    const points = rockAttachPoints(placement);
    const want = {x: Math.sin(angle) * (1 - up), y: up, z: Math.cos(angle) * (1 - up)};
    // The rock's half-width in the world: a face this near its middle is inside a cluster, among its own stones.
    const b = rockAssetInfo(placement.id).bounds;
    const half = (((b.max[0] - b.min[0]) + (b.max[2] - b.min[2])) / 4) * placement.scale;
    const facts = points.map((point) => {
        const d = {x: point.position.x - placement.x, y: point.position.y - placement.y, z: point.position.z - placement.z};
        const l = Math.hypot(d.x, d.y, d.z) || 1;
        return {
            usable: (point.tag === "rock_face" || point.tag === "ledge"),
            // Outward: the face's normal along its offset from the rock's middle (a face inside a cluster looks inward).
            outward: (d.x * point.normal.x + d.y * point.normal.y + d.z * point.normal.z) / l,
            // On the outside of the rock (or a ledge on top, open to the sky).
            outside: Math.hypot(d.x, d.z) >= half * 0.45 || point.normal.y >= 0.7,
            // Not buried: a real rock sinks into a sloping beach, and its lower faces lie under the sand.
            clear: point.position.y >= sampleGround(point.position.x, point.position.z).height + 0.03,
            toward: (d.x * want.x + d.y * want.y + d.z * want.z) / l
        };
    });
    // Strictest first, easing off only when a rock has nothing better: the point always stays on the drawn rock. A rock
    // sunk deep in a slope may have few faces in the open: then a clear face is given again before a buried one.
    const passes: Array<{fits: (f: (typeof facts)[number]) => boolean; again: boolean}> = [
        {fits: (f) => f.outward >= 0.15 && f.outside && f.clear, again: false},
        {fits: (f) => f.outward >= 0.15 && f.clear, again: false},
        {fits: (f) => f.clear, again: false},
        {fits: (f) => f.clear, again: true},
        {fits: () => true, again: true}
    ];
    for (const pass of passes) {
        let best = -1;
        let bestScore = -Infinity;
        facts.forEach((f, index) => {
            if (!f.usable || (!pass.again && used.has(index)) || !pass.fits(f)) return;
            const score = f.toward + 0.8 * Math.max(f.outward, 0);
            if (score > bestScore) {
                bestScore = score;
                best = index;
            }
        });
        if (best >= 0) return {point: points[best], index: best};
    }
    return null;
}
