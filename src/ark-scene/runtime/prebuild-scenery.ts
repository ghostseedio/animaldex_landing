/**
 * The prebuild's scenery part (runtime/prebuild.ts): the decor, the forest fill and the grass, which need nothing but
 * the seeded world (no three.js, no species data), so their worker is ~20 KB. The grass travels packed.
 */

import {forestFill, grassTufts, worldDecor, type DecorItem, type FillItem, type GrassTuft} from "@/ark-scene/decor";
import * as terrain from "@/ark-scene/terrain";
import {reefGrowth, type ReefItem} from "@/ark-scene/reef";
import {floorPlacements, type FloorPlacement} from "@/ark-scene/floor-assets";
import {wheatStands} from "@/ark-scene/near-detail";
import {mountainRocks, type RockPiece} from "@/ark-scene/rock-layout";
import {savannaMounds, type Mound} from "@/ark-scene/mounds";
import {arkWorld} from "@/ark-scene/world";
import {rockAssetFor, type RockPlacement} from "@/ark-scene/rock-assets";
import {assetTreePlacement, type TreePlacement} from "@/ark-scene/tree-pick";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";
import {wildScenery, type WildItem} from "@/ark-scene/islands/wild/scenery";

/**
 * The ground's arrays (graphics' `groundArrays(tier)` / `primeGround(arrays)` in terrain.ts, batch 6): the terrain's
 * per-vertex sampling, bit for bit the mount's own. Coded against the names: until they are in the release, absent.
 */
type GroundArrays = Record<string, unknown> & {[key: string]: unknown};
const groundApi = terrain as unknown as {groundArrays?: (tier: "high" | "medium" | "low") => GroundArrays; primeGround?: (arrays: GroundArrays | null) => void};
export function primeGroundIfAble(arrays: GroundArrays | null | undefined): void {
    if (arrays && groundApi.primeGround) groundApi.primeGround(arrays);
}
/** The typed arrays' buffers, to transfer rather than copy. */
export function groundBuffers(arrays: GroundArrays | null | undefined): ArrayBuffer[] {
    if (!arrays) return [];
    return Object.values(arrays).filter((value): value is ArrayBufferView => ArrayBuffer.isView(value)).map((view) => view.buffer as ArrayBuffer);
}

export type ArkPackedGrass = {count: number; numbers: Float64Array; zones: Uint8Array};
export type ArkSceneryPrebuild = {
    decor: DecorItem[];
    fill: FillItem[];
    grass: ArkPackedGrass;
    ground: GroundArrays | null;
    reef?: ReefItem[];
    floor?: FloorPlacement[];
    wheat?: ReturnType<typeof wheatStands>;
    /** The bigger wild island (P3): L6's mountain over its whole square, and its savanna's mounds (each seconds on a phone). */
    mountain?: {crags: RockPiece[]; boulders: RockPiece[]; scree: RockPiece[]};
    mounds?: Mound[];
    /** The bigger wild island: each decor item's asset rock as placed (`rock-assets.ts` rockAssetFor; null for the rest), by index. */
    rocks?: Array<RockPlacement | null>;
    /** And each decor and fill item's asset tree as placed (`tree-pick.ts` assetTreePlacement; null for the rest), by index. */
    trees?: {decor: Array<TreePlacement | null>; fill: Array<TreePlacement | null>};
    /** The bigger wild island (P7): the wild generator's scenery itself, for what still reads it on the main thread (the map's sampler, the reef). */
    wild?: WildItem[];
    ms: number;
};

export function packGrass(tufts: GrassTuft[], count: number): ArkPackedGrass {
    const numbers = new Float64Array(tufts.length * 6);
    const zones = new Uint8Array(tufts.length);
    tufts.forEach((tuft, i) => {
        numbers.set([tuft.x, tuft.y, tuft.z, tuft.scale, tuft.rotation, tuft.dry], i * 6);
        zones[i] = ARK_ZONES.indexOf(tuft.zone);
    });
    return {count, numbers, zones};
}

export function unpackGrass(grass: ArkPackedGrass): GrassTuft[] {
    const tufts: GrassTuft[] = new Array(grass.zones.length);
    const n = grass.numbers;
    for (let i = 0; i < grass.zones.length; i++) {
        const o = i * 6;
        tufts[i] = {x: n[o], y: n[o + 1], z: n[o + 2], scale: n[o + 3], rotation: n[o + 4], zone: ARK_ZONES[grass.zones[i]] as ArkZone, dry: n[o + 5]};
    }
    return tufts;
}

export function computeScenery(grass: number, tier: "high" | "medium" | "low" = "high"): ArkSceneryPrebuild {
    const started = Date.now();
    const ground = groundApi.groundArrays ? groundApi.groundArrays(tier) : null;
    const scenery: ArkSceneryPrebuild = {decor: worldDecor(), fill: forestFill(), grass: packGrass(grassTufts(grass), grass), ground, reef: reefGrowth(), floor: floorPlacements(), wheat: wheatStands(), ms: 0};
    // The bigger wild island (P3): its mountain's rocks and its savanna's mounds are built here too, off the main thread;
    // and (P7) the generator's scenery itself, which the map's sampler reads.
    if (arkWorld() === "v2") {
        Object.assign(scenery, {
            mountain: mountainRocks(),
            mounds: savannaMounds(),
            rocks: scenery.decor.map((item) => rockAssetFor(item)),
            trees: {decor: scenery.decor.map((item) => assetTreePlacement(item)), fill: scenery.fill.map((item) => assetTreePlacement(item))},
            wild: wildScenery()
        });
    }
    scenery.ms = Date.now() - started;
    return scenery;
}
