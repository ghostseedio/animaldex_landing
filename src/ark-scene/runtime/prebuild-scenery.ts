/**
 * The prebuild's scenery part (runtime/prebuild.ts): the decor, the forest fill and the grass, which need nothing but
 * the seeded world (no three.js, no species data), so their worker is ~20 KB. The grass travels packed.
 */

import {forestFill, grassTufts, worldDecor, type DecorItem, type FillItem, type GrassTuft} from "@/ark-scene/decor";
import {ARK_ZONES, type ArkZone} from "@/ark-scene/types";

export type ArkPackedGrass = {count: number; numbers: Float64Array; zones: Uint8Array};
export type ArkSceneryPrebuild = {decor: DecorItem[]; fill: FillItem[]; grass: ArkPackedGrass; ms: number};

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

export function computeScenery(grass: number): ArkSceneryPrebuild {
    const started = Date.now();
    return {decor: worldDecor(), fill: forestFill(), grass: packGrass(grassTufts(grass), grass), ms: Date.now() - started};
}
