/**
 * Where the termite mounds stand (scenery lane, the motion 100x pass): the savanna's three old mounds (always there,
 * `props/areas.ts`) and the ones raised while termites are aboard (`props/homes.ts`), each seated so its whole foot is
 * in the ground on a slope. Pure and light, so the decor's scatter keeps its trunks out of them, the mountain's rocks
 * keep clear of them, and the collisions lane reads them (`props/areas.ts` termiteMoundFootprints).
 */

import {arkWorld, hashString, onArkWorld, sampleGround, seeded, ZONE_SITES} from "@/ark-scene/world";
import {wildScenery} from "@/ark-scene/islands/wild/scenery";
import type {ArkZone} from "@/ark-scene/types";

export type Mound = {x: number; y: number; z: number; turn: number; scale: number; /** The mound's height at scale 1 (`shapes.termiteMound(h)`). */ h: number};

/** A mound's foot: 0.55 of its height each way (`shapes.termiteMound`: its lumpy base cylinder). */
export function moundFoot(mound: Mound): number {
    return mound.h * 0.55 * mound.scale;
}

/** The lowest ground under a mound's foot, a little under: no rim in the air on a slope. */
function seated(x: number, z: number, foot: number): number {
    let lowest = sampleGround(x, z).height;
    for (let k = 0; k < 10; k++) lowest = Math.min(lowest, sampleGround(x + Math.cos((k / 10) * Math.PI * 2) * foot * 0.9, z + Math.sin((k / 10) * Math.PI * 2) * foot * 0.9).height);
    return lowest - 0.05;
}

/** The mound's height at scale 1 on the bigger wild island (its generator draws them 2 m at its scale). */
const WILD_MOUND_H = 2;

/** The bigger wild island's savanna mounds, built once (its generator is seconds of work on a phone: primed from the scenery worker). */
let wildMounds: Mound[] | null = null;
onArkWorld(() => {
    wildMounds = null;
});

/** Runtime prebuild hook (runtime/prebuild.ts): the bigger wild island's savanna mounds, from the scenery worker. */
export function primeSavannaMounds(mounds: Mound[]): void {
    wildMounds = mounds;
}

/**
 * The savanna's old termite mounds (shared scenery: there whether termites are aboard or not). On the bigger wild island
 * (P3), its generator's: up to 18 over the savanna and the desert's edge, 14 m apart and more, each seated as these are.
 */
export function savannaMounds(): Mound[] {
    if (arkWorld() === "v2") {
        wildMounds ??= wildScenery().filter((item) => item.kind === "mound").map((item) => ({x: item.x, y: seated(item.x, item.z, WILD_MOUND_H * 0.55 * item.scale), z: item.z, turn: item.yaw, scale: item.scale, h: WILD_MOUND_H}));
        return wildMounds;
    }
    const site = ZONE_SITES.grassland;
    const mounds: Mound[] = [];
    for (const [dx, dz, s] of [[-site.clearing - 6, 8, 1.2], [site.clearing + 8, -5, 0.9], [4, -site.clearing - 9, 1.05]] as const) {
        const x = site.x + dx;
        const z = site.z + dz;
        mounds.push({x, y: seated(x, z, 2.4 * 0.55 * s), z, turn: dx, scale: s, h: 2.4});
    }
    return mounds;
}

/**
 * The termite mounds raised while termites are aboard, on the savanna and the desert's edge (its own seed, `props/
 * sampler.ts` propRandom("termites"): the same mounds every time, the same draws as before).
 */
export function activeTermiteMounds(): Mound[] {
    const random = seeded(hashString("termites") >>> 0);
    const items: Mound[] = [];
    for (const zone of ["grassland", "desert"] as ArkZone[]) {
        const site = ZONE_SITES[zone];
        for (let k = 0; k < 6; k++) {
            const a = random() * Math.PI * 2;
            const d = site.clearing + 2 + random() * 14;
            const x = site.x + Math.cos(a) * d;
            const z = site.z + Math.sin(a) * d;
            if (sampleGround(x, z).land < 0.9) continue;
            const turn = random() * 6;
            const scale = 0.8 + random() * 0.6;
            items.push({x, y: seated(x, z, 2.2 * 0.55 * scale), z, turn, scale, h: 2.2});
        }
    }
    return items;
}

/** Every mound (the active ones too: kept clear of whether or not termites are aboard). */
export function allMounds(): Mound[] {
    return [...savannaMounds(), ...activeTermiteMounds()];
}
