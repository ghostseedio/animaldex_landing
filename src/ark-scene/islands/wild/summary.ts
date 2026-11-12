/**
 * The wild island in numbers (docs/ark/wild-island.md): land per biome, the transitions' widths, the heights, the
 * water. Measured on a 1 m grid (as the islands plan measured today's island). Pure.
 */

import {sampleWildGround, underWater, wildZoneAt} from "@/ark-scene/islands/wild/ground";
import {WILD_LAND_ZONES, type WildLandZone} from "@/ark-scene/islands/wild/biomes";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";

export type WildMeasure = {
    /** Dry land (ha), the ice shelf included. */
    landHa: number;
    /** Dry land per zone (ha), by the zone with the most weight. */
    zoneHa: Record<WildLandZone, number>;
    /** Zone cores (weight ≥ 0.6) per zone (ha): the animals' home areas. */
    coreHa: Record<WildLandZone, number>;
    /** Fresh water's surface (ha): the lake, the river, the wetland's pools. */
    freshHa: number;
    /** Sea inside the square by depth band (ha). */
    seaHa: {lagoon: number; shallow: number; mid: number; deep: number; abyss: number};
    /** The highest point and the land's span. */
    peak: number;
    acrossX: number;
    acrossZ: number;
};

export function measureWild(step = 1): WildMeasure {
    const zoneHa = Object.fromEntries(WILD_LAND_ZONES.map((z) => [z, 0])) as Record<WildLandZone, number>;
    const coreHa = Object.fromEntries(WILD_LAND_ZONES.map((z) => [z, 0])) as Record<WildLandZone, number>;
    const cell = (step * step) / 10000;
    let land = 0;
    let fresh = 0;
    const sea = {lagoon: 0, shallow: 0, mid: 0, deep: 0, abyss: 0};
    let peak = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let z = -WILD_HALF + step / 2; z < WILD_HALF; z += step) {
        for (let x = -WILD_HALF + step / 2; x < WILD_HALF; x += step) {
            const s = sampleWildGround(x, z);
            const water = underWater(s);
            if (water === "fresh") {
                fresh += cell;
                continue;
            }
            if (water === "sea") {
                const depth = -s.height;
                if (s.reef > 0.3) sea.lagoon += cell;
                else if (depth < 5) sea.shallow += cell;
                else if (depth < 15) sea.mid += cell;
                else if (depth < 40) sea.deep += cell;
                else sea.abyss += cell;
                continue;
            }
            land += cell;
            const zone = wildZoneAt(s);
            zoneHa[zone] += cell;
            for (const z2 of WILD_LAND_ZONES) if (s.weights[z2] >= 0.6) coreHa[z2] += cell;
            peak = Math.max(peak, s.height);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }
    }
    const round = (v: number) => Math.round(v * 100) / 100;
    for (const z of WILD_LAND_ZONES) {
        zoneHa[z] = round(zoneHa[z]);
        coreHa[z] = round(coreHa[z]);
    }
    return {landHa: round(land), zoneHa, coreHa, freshHa: round(fresh), seaHa: {lagoon: round(sea.lagoon), shallow: round(sea.shallow), mid: round(sea.mid), deep: round(sea.deep), abyss: round(sea.abyss)}, peak: Math.round(peak * 10) / 10, acrossX: maxX - minX, acrossZ: maxZ - minZ};
}

/**
 * The transitions' widths (m) between each pair of neighbouring land zones: along many transects through points where
 * the two share the ground (each between 0.3 and 0.7 of their pair), the distance over which the one's share of the
 * pair runs from 0.1 to 0.9 along the steepest way. Median per pair.
 */
export function ecotoneWidths(step = 6): Array<{a: WildLandZone; b: WildLandZone; width: number; samples: number}> {
    const widths = new Map<string, number[]>();
    const e = 1.5;
    for (let z = -WILD_HALF; z < WILD_HALF; z += step) {
        for (let x = -WILD_HALF; x < WILD_HALF; x += step) {
            const s = sampleWildGround(x, z);
            if (s.height < 0.2 || s.land < 0.9) continue;
            const ranked = WILD_LAND_ZONES.map((zone) => ({zone, w: s.weights[zone]})).sort((p, q) => q.w - p.w);
            const [a, b] = ranked;
            if (a.w + b.w < 0.85 || b.w < 0.25) continue;
            const share = (g: ReturnType<typeof sampleWildGround>) => g.weights[a.zone] / Math.max(g.weights[a.zone] + g.weights[b.zone], 1e-6);
            const gx = (share(sampleWildGround(x + e, z)) - share(sampleWildGround(x - e, z))) / (2 * e);
            const gz = (share(sampleWildGround(x, z + e)) - share(sampleWildGround(x, z - e))) / (2 * e);
            const g = Math.hypot(gx, gz);
            if (g < 1e-5) continue;
            // 0.1 → 0.9 of the pair's share, from its slope at the middle (a logistic's 0.1–0.9 is 4.39 / its rate, and its
            // slope at the middle is a quarter of its rate): 1.1 / slope.
            const width = Math.min(1.1 / g, 400);
            const key = [a.zone, b.zone].sort().join("|");
            const list = widths.get(key) ?? [];
            list.push(width);
            widths.set(key, list);
        }
    }
    return Array.from(widths.entries()).map(([key, list]) => {
        list.sort((p, q) => p - q);
        const [a, b] = key.split("|") as [WildLandZone, WildLandZone];
        return {a, b, width: Math.round(list[Math.floor(list.length / 2)]), samples: list.length};
    }).sort((p, q) => q.samples - p.samples);
}
