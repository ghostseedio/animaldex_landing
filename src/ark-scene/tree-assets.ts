/**
 * Which asset-library tree (the asset lane's `public/ark/assets/v1/trees`,
 * `assets-manifest.json`) stands in for each decor tree, and at what scale
 * (graphics pass, batch 3). Pure and deterministic: the renderer
 * (`asset-trees.ts`), the attach points (`sampler.ts`) and the bark animals
 * (`micro.ts`) all ask this one function, so they agree on every tree.
 *
 * The attach path (graphics pass, the leaf shot): `treeAttachPoints(item)`
 * puts each asset's attach points (attach.json, moved onto the drawn lod0
 * surface by `scripts/ark-tree-attach.mjs` into `tree-attach.json`) onto the
 * placed tree, where the renderer draws it (`assetTreePlacement`), and
 * `treeSway` moves a point with the tree's wind exactly as the tree shader
 * moves the leaf or bark under it.
 */

import manifest from "@/ark-scene/assets-manifest.json";
import attachData from "@/ark-scene/tree-attach.json";
import type {DecorItem} from "@/ark-scene/decor";
import {DECOR_SINK} from "@/ark-scene/micro-decor";
import {heightAt, sampleGround, zoneAt} from "@/ark-scene/world";

export type AssetInfo = {
    kind: string;
    height: number;
    crown_radius: number;
    trunk_radius: number;
    lod_distances: [number, number, number];
    lods: Array<{level: "lod0" | "lod1" | "lod2" | "card"; file: string; tris: number; doubleSided: boolean}>;
};

export const ASSET_BASE: string = (manifest as {base: string}).base;
export const ASSETS = (manifest as unknown as {assets: Record<string, AssetInfo>}).assets;

/** The decor kinds the asset trees replace (shrubs, reeds and the canopy trees keep their own shapes). */
export const ASSET_TREE_KINDS = new Set(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard"]);

/** The decor scale a kind averages (decor.ts: (0.75 + 0.55 × ½) × its TREE_SIZE): an asset at that scale is its natural size. */
const MEAN_SCALE: Record<string, number> = {broadleaf: 1.54, rainforest: 1.49, conifer: 1.64, acacia: 1.38, palm: 1.33, orchard: 1.18};

function unit(x: number, z: number, salt: number): number {
    const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
    return h - Math.floor(h);
}

function pick(list: string[], r: number): string {
    return list[Math.min(Math.floor(r * list.length), list.length - 1)];
}

export type TreeAsset = {id: string; /** Uniform scale on the asset (its own metres). */ scale: number};

/** The asset tree for a decor (or forest-fill) tree, or null to keep its own shape. */
export function treeAssetFor(item: Pick<DecorItem, "kind" | "x" | "z" | "scale">): TreeAsset | null {
    if (!ASSET_TREE_KINDS.has(item.kind)) return null;
    const zone = zoneAt(sampleGround(item.x, item.z));
    const r = unit(item.x, item.z, 1);
    const v = unit(item.x, item.z, 2);
    const variant = (kind: string) => pick(["a", "b", "c"].filter((letter) => ASSETS[`${kind}-${letter}`]), v);
    let kind: string;
    let size = item.scale / (MEAN_SCALE[item.kind] ?? 1.5);
    switch (item.kind) {
        case "broadleaf":
            if (zone === "river_lake" || zone === "wetland") kind = r < 0.55 ? "willow" : r < 0.8 ? "birch" : "oak";
            else if (zone === "woodland" || zone === "mountains") kind = r < 0.05 ? "snag" : r < 0.45 ? "oak" : r < 0.78 ? "beech" : "birch";
            else if (zone === "farm_garden") kind = r < 0.7 ? "oak" : "apple";
            else if (zone === "seashore") kind = "mangrove";
            else kind = r < 0.6 ? "oak" : "beech";
            break;
        case "rainforest":
            // Rainforest: emergents of every size, a few full giants above the rest; mangroves where it meets the water.
            if (zone === "seashore" || zone === "river_lake") kind = "mangrove";
            else {
                kind = "emergent";
                size *= r < 0.18 ? 1 : 0.42 + 0.3 * unit(item.x, item.z, 3);
            }
            break;
        case "conifer":
            kind = r < 0.5 ? "pine" : "spruce";
            break;
        case "acacia":
            kind = "acacia";
            break;
        case "palm":
            kind = "palm";
            break;
        default:
            kind = "apple";
    }
    const id = `${kind}-${variant(kind)}`;
    if (!ASSETS[id]) return null;
    return {id, scale: Math.min(Math.max(size, 0.35), 1.4)};
}

/**
 * The asset tree's trunk in the decor item's own metres (before the item's scale), in the shape micro.ts climbs
 * (vegetation.ts `Trunk`): a round trunk (a 12-sided prism) tapering to the crown.
 */
export function assetTrunk(item: Pick<DecorItem, "kind" | "x" | "z" | "scale">): {height: number; radius: number; top: number; lean: number; sides: number; clear: number} | null {
    const asset = treeAssetFor(item);
    if (!asset) return null;
    const info = ASSETS[asset.id];
    const k = asset.scale / Math.max(item.scale, 1e-3);
    const radius = info.trunk_radius * k;
    const height = info.height * 0.5 * k;
    return {height, radius, top: radius * 0.55, lean: 0, sides: 12, clear: height * 0.92};
}

// MARK: - Placement (shared with the renderer)

export type TreePlacement = {
    id: string;
    /** Uniform scale on the asset. */
    scale: number;
    /** The instance's origin: the decor item's foot, sunk as the renderer sinks decor. */
    x: number;
    y: number;
    z: number;
    /** Turn about +y (radians), as three's Quaternion.setFromAxisAngle(up, rotation). */
    rotation: number;
    /** The drawn tree's height and crown radius (m, scaled). */
    height: number;
    radius: number;
};

type Placeable = Pick<DecorItem, "kind" | "x" | "y" | "z" | "scale" | "rotation">;

/**
 * Where (and whether) the renderer draws a decor or forest-fill tree as its asset tree: null when it keeps its own
 * shape or is left out (bare rock faces high on the mountain read as pockmarks from afar). `asset-trees.ts` composes
 * its instance matrix from exactly this, so attach points agree with the drawn tree.
 */
export function assetTreePlacement(item: Placeable): TreePlacement | null {
    const asset = treeAssetFor(item);
    if (!asset) return null;
    if (item.y > 16) {
        const slope = Math.hypot(heightAt(item.x + 1.5, item.z) - heightAt(item.x - 1.5, item.z), heightAt(item.x, item.z + 1.5) - heightAt(item.x, item.z - 1.5)) / 3;
        if (slope > 0.8) return null;
    }
    const info = ASSETS[asset.id];
    return {id: asset.id, scale: asset.scale, x: item.x, y: item.y - DECOR_SINK, z: item.z, rotation: item.rotation, height: info.height * asset.scale, radius: info.crown_radius * asset.scale};
}

/**
 * How far a camera is from a placed tree for its level of detail: from its foot, as before, but never further than
 * from the tree's own bounds (a camera up in a crown, a close-up on a leaf, is right beside the tree, however far
 * its foot is).
 */
export function treeLodDistance(tree: Pick<TreePlacement, "x" | "y" | "z" | "height" | "radius">, camera: {x: number; y: number; z: number}): number {
    const foot = Math.hypot(tree.x - camera.x, tree.y - camera.y, tree.z - camera.z);
    const dy = camera.y < tree.y ? tree.y - camera.y : camera.y > tree.y + tree.height ? camera.y - tree.y - tree.height : 0;
    const dr = Math.max(Math.hypot(tree.x - camera.x, tree.z - camera.z) - tree.radius, 0);
    return Math.min(foot, Math.hypot(dr, dy));
}

/** Within this of a tree's bounds a tree is always drawn at full detail (lod0), the level its attach points are on. */
export const TREE_CLOSE = 2.5;

// MARK: - Attach points on the drawn trees

type Vec3 = {x: number; y: number; z: number};

export type TreeAttachTag = "leaf" | "bark" | "branch";

/** The weights the tree shader sways a point by (the asset's COLOR_1 there), and where it sits on its tree. */
export type TreeWind = {
    /** COLOR_1 at the point: sway weight, limb phase, flutter, leaf phase (0…1 each). */
    weights: [number, number, number, number];
    /** The point in the asset's own metres (the shader bends by its height). */
    local: Vec3;
    /** The instance's origin, turn and scale (`assetTreePlacement`). */
    root: Vec3;
    rotation: number;
    scale: number;
};

export type TreeAttach = {
    tag: TreeAttachTag;
    /** The asset tree ("oak-a"). */
    asset: string;
    /** Index among this asset's points of the tag (stable while tree-attach.json is). */
    n: number;
    position: Vec3;
    /** Out of the surface: the animal's up. */
    normal: Vec3;
    /** Along the surface: a leaf's midrib base → tip, up a trunk, along a branch. */
    forward: Vec3;
    size: [number, number];
    /** 0…1: the share of sight lines within 40° of out-and-up that leave the tree unblocked. */
    open: number;
    /** Leaves: a single leaf (blade) or the crown's leaf mass (clump). */
    leaf?: "blade" | "clump";
    wind: TreeWind;
};

type Row = [TreeAttachTag, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
const ATTACH = (attachData as unknown as {assets: Record<string, Row[]>}).assets;

/** The asset's own attach points (asset space), by tag. */
export function assetAttachRows(id: string): readonly Row[] {
    return ATTACH[id] ?? [];
}

/** Every attach point of a placed asset tree, in the world (empty when the tree is not drawn as an asset). */
export function treeAttachPoints(item: Placeable): TreeAttach[] {
    const placed = assetTreePlacement(item);
    if (!placed) return [];
    const c = Math.cos(placed.rotation);
    const s = Math.sin(placed.rotation);
    const turn = (x: number, y: number, z: number): Vec3 => ({x: x * c + z * s, y, z: -x * s + z * c});
    const root = {x: placed.x, y: placed.y, z: placed.z};
    const seen: Record<string, number> = {};
    return assetAttachRows(placed.id).map((row) => {
        const [tag, px, py, pz, nx, ny, nz, fx, fy, fz, s0, s1, w0, w1, w2, w3, open, , blade] = row;
        const p = turn(px * placed.scale, py * placed.scale, pz * placed.scale);
        const n = seen[tag] ?? 0;
        seen[tag] = n + 1;
        return {
            tag,
            asset: placed.id,
            n,
            position: {x: root.x + p.x, y: root.y + p.y, z: root.z + p.z},
            normal: turn(nx, ny, nz),
            forward: turn(fx, fy, fz),
            size: [s0 * placed.scale, s1 * placed.scale],
            open,
            ...(tag === "leaf" ? {leaf: blade ? ("blade" as const) : ("clump" as const)} : {}),
            wind: {weights: [w0, w1, w2, w3], local: {x: px, y: py, z: pz}, root, rotation: placed.rotation, scale: placed.scale}
        };
    });
}

/**
 * How far the tree's wind has moved a point (world metres), the CPU twin of the asset-tree shader
 * (`asset-trees.ts` windMaterial; `src/lib/ark-attach.test.ts` holds the two together): give it the shader's own
 * `arkTime` and `arkWind` (`ARK_TIME.value`, `ARK_WIND.value` in glsl.ts) and an animal on a leaf moves with the leaf.
 * Visual only: the time is the viewer's scene clock.
 */
export function treeSway(wind: TreeWind, time: number, windVector: {x: number; y: number}): Vec3 {
    const gust = Math.hypot(windVector.x, windVector.y);
    const ax = windVector.x / Math.max(gust, 1e-3);
    const az = windVector.y / Math.max(gust, 1e-3);
    const [sway, limbPhase, flutter, leafPhase] = wind.weights;
    const phase = limbPhase * 6.2831853;
    const wave = Math.sin(time * 1.25 + phase + wind.root.x * 0.19 + wind.root.z * 0.15) + 0.4 * Math.sin(time * 2.6 + phase * 1.7 + wind.root.x * 0.4);
    const bend = sway * (0.25 + 0.06 * Math.max(wind.local.y, 0));
    const k = (0.35 + 0.65 * wave) * bend * 0.09 * gust;
    const leaf = leafPhase * 6.2831853;
    const f = flutter * 0.025 * (0.4 + gust);
    // In the asset's own space (the shader moves `transformed` before the instance matrix), then turned and scaled.
    const lx = ax * k + Math.sin(time * 7.1 + leaf) * f;
    const ly = 0.6 * Math.sin(time * 6.3 + leaf * 1.3) * f;
    const lz = az * k + Math.cos(time * 6.7 + leaf) * f;
    const c = Math.cos(wind.rotation);
    const s = Math.sin(wind.rotation);
    return {x: (lx * c + lz * s) * wind.scale, y: ly * wind.scale, z: (-lx * s + lz * c) * wind.scale};
}
