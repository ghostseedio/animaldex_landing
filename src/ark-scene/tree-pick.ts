/**
 * Which asset-library tree (the asset lane's `public/ark/assets/v1/trees`,
 * `assets-manifest.json`) stands in for each decor tree, at what scale, and
 * where it is drawn: pure and deterministic, split out of `tree-assets.ts`
 * (scenery lane, the motion 100x pass) so the decor's scatter
 * (`tree-spacing.ts`, run in the prebuild worker too) can ask it without the
 * attach points' table. `tree-assets.ts` re-exports everything here.
 */

import manifest from "@/ark-scene/assets-manifest.json";
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

/**
 * Real heights (decision 34, scenery lane: the animals are in real metres now, so the trees are too). The height a
 * grown tree of each kind reaches on average, m: English oak 15-25, beech 20-30, silver birch 15-25, willow 10-20,
 * an orchard apple 4-6 (pruned), Scots pine 15-35, Norway spruce 20-40, umbrella thorn acacia 6-12, coconut palm
 * 15-25, mangrove 5-15, rainforest emergents 40-60 (the canopy under them 25-35), a dead snag about 10. Each asset's
 * own variety (its variants, the decor's size roll) stays round that mean.
 */
export const REAL_HEIGHT: Record<string, number> = {oak: 18, beech: 22, birch: 16, willow: 12, apple: 5, pine: 22, spruce: 25, acacia: 8, palm: 15, mangrove: 8, emergent: 45, snag: 10};

const realFactors = new Map<string, number>();

/** How much larger than the asset library draws it a tree of this kind is in life (its variants' mean height to the real one). */
export function realFactor(kind: string): number {
    let factor = realFactors.get(kind);
    if (factor === undefined) {
        const heights = ["a", "b", "c"].map((letter) => ASSETS[`${kind}-${letter}`]?.height).filter((h): h is number => h !== undefined);
        const mean = heights.reduce((sum, h) => sum + h, 0) / Math.max(heights.length, 1);
        factor = REAL_HEIGHT[kind] && mean > 0 ? REAL_HEIGHT[kind] / mean : 1;
        realFactors.set(kind, factor);
    }
    return factor;
}

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
            // Rainforest: a canopy of emergent kinds at 25-35 m, a few full giants (40-60 m) above it; mangroves where it
            // meets the water.
            if (zone === "seashore" || zone === "river_lake") kind = "mangrove";
            else {
                kind = "emergent";
                size *= r < 0.18 ? 1 : 0.55 + 0.25 * unit(item.x, item.z, 3);
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
    // The decor's size roll (a young tree to a big one) round the kind's real height (decision 34).
    return {id, scale: Math.min(Math.max(size, 0.35), 1.4) * realFactor(kind)};
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

// MARK: - Which forest fill every tier draws (shared with the attach points)

/**
 * The least share of the forest fill drawn in the rainforest and the woodland, whatever the tier (batch 6: on the low tier
 * a 0.3 share of the thinned fill left the decor emergents standing as tall bare trunks with small tufts from the island
 * view; the lower canopy is what makes the woods read leafy). Other zones keep the tier's share. `asset-trees.ts` draws by it.
 */
export const WOODS_FILL = 0.6;

/**
 * Whether every tier draws this tree (decision 33, scenery lane): every decor tree, forest fill within the low tier's
 * share (`lowTierFill`), and in the woods fill within `WOODS_FILL`. Only these carry attach points (`sampler.ts`), so
 * an animal on a tree never floats where a lighter tier leaves the tree out.
 */
export function fillDrawnOnEveryTier(item: {x: number; z: number; rank?: number}, lowTierFill: number): boolean {
    if (item.rank === undefined) return true;
    const zone = zoneAt(sampleGround(item.x, item.z));
    return item.rank <= (zone === "rainforest" || zone === "woodland" ? Math.max(WOODS_FILL, lowTierFill) : lowTierFill);
}
