/**
 * Which asset-library tree (the asset lane's `public/ark/assets/v1/trees`,
 * `assets-manifest.json`) stands in for each decor tree, and at what scale
 * (graphics pass, batch 3). Pure and deterministic: the renderer
 * (`asset-trees.ts`), the attach points (`sampler.ts`) and the bark animals
 * (`micro.ts`) all ask this one function, so they agree on every tree.
 */

import manifest from "@/ark-scene/assets-manifest.json";
import type {DecorItem} from "@/ark-scene/decor";
import {sampleGround, zoneAt} from "@/ark-scene/world";

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
