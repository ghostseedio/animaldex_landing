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
import {sampleGround, zoneAt} from "@/ark-scene/world";

type RockInfo = {kind: string; height: number; bounds: {min: [number, number, number]; max: [number, number, number]}; lod_distances: [number, number, number]; lods: Array<{level: "lod0" | "lod1" | "lod2"; file: string; tris: number; doubleSided: boolean}>};
type Row = {tag: string; p: [number, number, number]; n: [number, number, number]; size: [number, number]; spot?: string};

const ASSETS = (manifest as unknown as {assets: Record<string, RockInfo & {group?: string; set?: string}>}).assets;
const ATTACH = rockAttach as unknown as Record<string, Row[]>;

/** The rock assets this mapping uses (cliff faces, scree, pebbles and stalagmites are for other places). */
export const ROCK_ASSET_IDS = ["boulder-a", "boulder-b", "boulder-cluster-a", "boulder-cluster-b", "boulder-mossy-a", "boulder-cluster-mossy-a", "boulder-cluster-barnacle-a", "boulder-cluster-barnacle-b", "tide-pool-rock-a", "tide-pool-rock-b"].filter((id) => ASSETS[id]);

export function rockAssetInfo(id: string): RockInfo {
    return ASSETS[id];
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

export type RockPlacement = {id: string; x: number; y: number; z: number; yaw: number; scale: number};

type RockItem = {kind: string; x: number; y: number; z: number; scale: number; rotation: number};

/** The asset rock for a decor rock, placed (null when the rock set is missing). */
export function rockAssetFor(item: RockItem): RockPlacement | null {
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
    } else {
        id = r < 0.55 ? pick(["boulder-a", "boulder-b"], unit(item.x, item.z, 6)) : pick(["boulder-cluster-a", "boulder-cluster-b"], unit(item.x, item.z, 6));
    }
    if (!id) return null;
    const b = ASSETS[id].bounds;
    const footprint = ((b.max[0] - b.min[0]) + (b.max[2] - b.min[2])) / 2;
    const scale = (OLD_FOOTPRINT * item.scale) / footprint;
    return {id, x: item.x, y: item.y - DECOR_SINK, z: item.z, yaw: item.rotation, scale};
}

export type RockAttach = {tag: string; spot: string; position: {x: number; y: number; z: number}; normal: {x: number; y: number; z: number}; size: [number, number]};

/** A placed rock's attach points (attach.json, measured on the drawn lod0 surface), in the world. */
export function rockAttachPoints(placement: RockPlacement): RockAttach[] {
    const rows = ATTACH[placement.id] ?? [];
    const c = Math.cos(placement.yaw);
    const s = Math.sin(placement.yaw);
    // three.js turns about +y by yaw: x' = x cos + z sin, z' = -x sin + z cos.
    const turn = (v: [number, number, number]) => ({x: v[0] * c + v[2] * s, y: v[1], z: -v[0] * s + v[2] * c});
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
    const b = ASSETS[placement.id].bounds;
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
