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

import attachData from "@/ark-scene/tree-attach.json";
import type {DecorItem} from "@/ark-scene/decor";
import {assetTreePlacement, type TreePlacement} from "@/ark-scene/tree-pick";

// The pick itself lives in `tree-pick.ts` (scenery lane): the decor's scatter asks it without this module's attach table.
export {ASSET_BASE, ASSETS, ASSET_TREE_KINDS, assetTreePlacement, assetTrunk, treeAssetFor, type AssetInfo, type TreeAsset, type TreePlacement} from "@/ark-scene/tree-pick";

type Placeable = Pick<DecorItem, "kind" | "x" | "y" | "z" | "scale" | "rotation">;

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

export type TreeAttachTag = "leaf" | "bark" | "branch" | "tree_hollow" | "limb" | "canopy_hang";

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
    /** Hollows: how deep the hole runs into the trunk (m). */
    depth?: number;
    /** Limbs and hang points: the limb's radius (m), the clear room above it (to wood) and below it (to anything of the tree), scaled. */
    radius?: number;
    clearAbove?: number;
    clearBelow?: number;
    wind: TreeWind;
};

type Row = [TreeAttachTag, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
const ATTACH = (attachData as unknown as {assets: Record<string, Row[]>}).assets;

/** A fallen log's tops on its drawn lod0 surface (asset space): [p×3, up×3, forward×3, sizeMin, sizeMax] (graphics batch 6's floor). */
export function floorLogTops(id: string): ReadonlyArray<readonly number[]> {
    return (attachData as unknown as {logs?: Record<string, number[][]>}).logs?.[id] ?? [];
}

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
        const [tag, px, py, pz, nx, ny, nz, fx, fy, fz, s0, s1, w0, w1, w2, w3, open, , blade, depth, radius, above, below] = row;
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
            ...(tag === "tree_hollow" ? {depth: depth * placed.scale} : {}),
            ...(tag === "limb" || tag === "canopy_hang" ? {radius: radius * placed.scale, clearAbove: above * placed.scale, clearBelow: below * placed.scale} : {}),
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
    // The frequencies are whole cycles in the shared 600 s clock window (graphics batch 6), as the shader's.
    const wave = Math.sin(time * 1.24617 + phase + wind.root.x * 0.19 + wind.root.z * 0.15) + 0.4 * Math.sin(time * 2.59705 + phase * 1.7 + wind.root.x * 0.4);
    const bend = sway * (0.25 + 0.06 * Math.max(wind.local.y, 0));
    const k = (0.35 + 0.65 * wave) * bend * 0.09 * gust;
    const leaf = leafPhase * 6.2831853;
    const f = flutter * 0.025 * (0.4 + gust);
    // In the asset's own space (the shader moves `transformed` before the instance matrix), then turned and scaled.
    const lx = ax * k + Math.sin(time * 7.1 + leaf) * f;
    const ly = 0.6 * Math.sin(time * 6.30413 + leaf * 1.3) * f;
    const lz = az * k + Math.cos(time * 6.70206 + leaf) * f;
    const c = Math.cos(wind.rotation);
    const s = Math.sin(wind.rotation);
    return {x: (lx * c + lz * s) * wind.scale, y: ly * wind.scale, z: (-lx * s + lz * c) * wind.scale};
}
