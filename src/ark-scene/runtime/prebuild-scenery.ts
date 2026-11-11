/**
 * The prebuild's scenery part (runtime/prebuild.ts): the decor, the forest fill and the grass, which need nothing but
 * the seeded world (no three.js, no species data), so their worker is ~20 KB. The grass travels packed.
 */

import {forestFill, grassTufts, worldDecor, type DecorItem, type FillItem, type GrassTuft} from "@/ark-scene/decor";
import * as terrain from "@/ark-scene/terrain";
import {reefGrowth, type ReefItem} from "@/ark-scene/reef";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";

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
export type ArkSceneryPrebuild = {decor: DecorItem[]; fill: FillItem[]; grass: ArkPackedGrass; ground: GroundArrays | null; reef?: ReefItem[]; ms: number};

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
    return {decor: worldDecor(), fill: forestFill(), grass: packGrass(grassTufts(grass), grass), ground, reef: reefGrowth(), ms: Date.now() - started};
}
