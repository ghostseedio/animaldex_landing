/**
 * The wild island's biomes from its climate fields (islands plan §2.2): climate fields, not nearest centres.
 *
 * - **Landform zones** come first, each a smooth membership of the land itself: the river and the lake (their water and
 *   banks), the wetland (its low basin), the coast (low ground near the sea), the polar cove (the coldest low ground),
 *   the mountains (by elevation). Each takes its share of what is left, in that order.
 * - **Climate zones** share the rest by temperature and moisture, as in a Whittaker chart: rainforest (warm, wet),
 *   woodland (temperate), grassland and savanna (warm, half dry), desert (dry). Their weights are a soft-max over each
 *   zone's distance from its place in (temperature, moisture), so a boundary follows the fields' contours: valleys,
 *   slopes and the rain shadow, never a straight line or a circle.
 *
 * The transitions are 20–50 m wide (measured in `summary.ts` and the tests). The zone ids are the Ark's own (the 11
 * wild zones; `farm_garden` is never present), so species zones, spawn tags, food links and the harness don't change.
 */

import {smoothstep} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

/** The land zones, in `world.ts` GroundSample's key order (farm_garden kept at 0 for its shape). */
export const WILD_LAND_ZONES = ["farm_garden", "seashore", "river_lake", "wetland", "rainforest", "woodland", "grassland", "desert", "mountains", "polar"] as const;
export type WildLandZone = typeof WILD_LAND_ZONES[number];
export type ZoneWeights = Record<WildLandZone, number>;

/** The wild island's zones (no farm_garden: decision 16 took garden and countryside wildlife to the town). */
export const WILD_ZONES: readonly ArkZone[] = ["coral_reef", "open_ocean", "seashore", "river_lake", "wetland", "rainforest", "woodland", "grassland", "desert", "mountains", "polar"];

/** Each climate zone's place in (temperature, moisture). */
const CLIMATE: ReadonlyArray<{zone: "rainforest" | "woodland" | "grassland" | "desert"; t: number; m: number}> = [
    {zone: "rainforest", t: 0.88, m: 0.84},
    {zone: "woodland", t: 0.63, m: 0.6},
    {zone: "grassland", t: 0.84, m: 0.36},
    {zone: "desert", t: 0.84, m: 0.06}
];
/** The soft-max's temperature in climate space (smaller: sharper edges). */
const CLIMATE_SOFTNESS = 0.02;

export type BiomeInputs = {
    temperature: number;
    moisture: number;
    /** The regional elevation (m): the land's broad shape, without the mountains' arêtes and gullies. */
    elevation: number;
    /** Metres inside the coast. */
    inland: number;
    /** 0…1: the river's and the lake's water and banks. */
    freshBank: number;
    /** 0…1: the wetland's basin. */
    basin: number;
    /** 0…1: how much a cliff this coast is. */
    cliff: number;
    /** 0…1: near the mouth (the estuary's mangroves widen the coast). */
    estuary: number;
    /** 0…1: the cove's ice shelf. */
    ice: number;
    /** A little noise (0…1) to rag the edges. */
    rag: number;
};

/** The memberships of the landform zones (0…1 each) before they take their shares. */
export function landforms(i: BiomeInputs): {river_lake: number; wetland: number; seashore: number; polar: number; mountains: number} {
    const r = i.rag - 0.5;
    const coastReach = 13 + 18 * i.estuary - 7 * i.cliff;
    const seashore = smoothstep(coastReach + 14, coastReach - 14, i.inland + 10 * r) * (1 - smoothstep(4, 11, i.elevation + 3 * r));
    const cold = smoothstep(0.32, 0.1, i.temperature + 0.05 * r);
    const polar = Math.max(i.ice, cold * (1 - smoothstep(18, 34, i.elevation + 6 * r)));
    const mountains = smoothstep(12, 44, i.elevation + 8 * r);
    return {river_lake: i.freshBank, wetland: i.basin, seashore, polar, mountains};
}

/** The zone weights at a point (summing to 1 over the land zones). */
export function zoneWeights(i: BiomeInputs): ZoneWeights {
    const forms = landforms(i);
    const out: ZoneWeights = {farm_garden: 0, seashore: 0, river_lake: 0, wetland: 0, rainforest: 0, woodland: 0, grassland: 0, desert: 0, mountains: 0, polar: 0};
    let left = 1;
    for (const zone of ["wetland", "river_lake", "polar", "seashore", "mountains"] as const) {
        const w = forms[zone] * left;
        out[zone] = w;
        left -= w;
    }
    if (left > 1e-6) {
        const scores = CLIMATE.map((c) => -((i.temperature - c.t) ** 2 + (i.moisture - c.m) ** 2) / CLIMATE_SOFTNESS);
        const top = Math.max(...scores);
        const raw = scores.map((s) => Math.exp(s - top));
        const total = raw.reduce((sum, w) => sum + w, 0);
        CLIMATE.forEach((c, k) => {
            out[c.zone] = (raw[k] / total) * left;
        });
    }
    return out;
}

/** The land zone with the most weight. */
export function topZone(w: ZoneWeights): WildLandZone {
    let best: WildLandZone = "grassland";
    let weight = -1;
    for (const zone of WILD_LAND_ZONES) {
        if (w[zone] > weight) {
            weight = w[zone];
            best = zone;
        }
    }
    return best;
}
