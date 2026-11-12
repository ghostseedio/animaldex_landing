/**
 * The wild island's ground at any point (Part C, docs/ark/wild-island.md): the height, the zone weights and the water,
 * from the landforms and climate fields (`fields.ts`, `biomes.ts`). The sample has `world.ts` GroundSample's shape
 * (height, weights over the same land zones, land, inland, river, reef, cliff), so the scene's ground, scenery and map
 * code can read it as they read today's island, plus the wild island's own fields.
 *
 * Pure and deterministic.
 */

import {fbm, smoothstep} from "@/ark-scene/world";
import {bearingOf, cliffAt, dropOffOf, elevationOf, iceShelf, ICE_HEIGHT, inlandOf, kelpOf, LAKE, lakeEdge, lagoonOf, moistureOf, riverAlong, riverAt, seaDepth, temperatureOf, wetlandBasin, WETLAND, MOUTH_BEARING, bearingDiff, type RiverHit} from "@/ark-scene/islands/wild/fields";
import {topZone, zoneWeights, type WildLandZone, type ZoneWeights} from "@/ark-scene/islands/wild/biomes";

export type WildGroundSample = {
    height: number;
    weights: ZoneWeights;
    /** 1 inland, 0 at the waterline and out to sea. */
    land: number;
    /** Metres inside the coast (negative at sea). */
    inland: number;
    /** Metres to the river's line. */
    river: number;
    /** 0…1 how much the coral reef's (the lagoon and its crest). */
    reef: number;
    /** 0…1 how much of a sea cliff this stretch of coast is. */
    cliff: number;
    // The wild island's own.
    temperature: number;
    moisture: number;
    /** Elevation before the water was cut in (m). */
    elevation: number;
    /** Fresh water over the ground here (the lake, the river, the wetland's pools): its surface, or null. */
    freshLevel: number | null;
    /** 0…1 how much this is fresh water (0.5 and up is drawn as it). */
    fresh: number;
    /** The cove's ice shelf (0…1). */
    ice: number;
    /** 0…1: the lagoon's bearing; the east's drop-off; the kelp's shore. */
    lagoon: number;
    dropOff: number;
    kelp: number;
    /** 0…1 near the river's mouth. */
    estuary: number;
    /** How far along the river its nearest point is (0 spring, 1 mouth). */
    riverAlong: number;
    /** The river's surface, width and depth at its nearest point. */
    riverHit: RiverHit;
};

/** Metres from the river's line to the far edge of its banks' easing. */
const VALLEY = 28;

export function sampleWildGround(x: number, z: number): WildGroundSample {
    const b = bearingOf(x, z);
    const {inland} = inlandOf(x, z);
    const ice = iceShelf(x, z);
    const river = riverAt(x, z);
    const along = riverAlong(river);
    const elevation = elevationOf(x, z, inland);
    const regional = elevationOf(x, z, inland, true);
    const temperature = temperatureOf(x, z, regional);
    const moisture = moistureOf(x, z, river);
    const cliff = inland > -40 ? cliffAt(b, x, z) : 0;
    const mouthNear = Math.max(0, 1 - Math.abs(bearingDiff(b, MOUTH_BEARING)) / 0.22);
    const estuary = smoothstep(0, 1, mouthNear) * smoothstep(60, 0, Math.max(inland, 0)) * (river.upper ? 0 : 1);

    // The fresh water's banks: the lake's shore and the river's, as one membership for the river_lake zone.
    const lakeD = Math.hypot(x - LAKE.x, z - LAKE.z);
    const edge = lakeEdge(x, z);
    const bankReach = river.upper ? 9 : 14;
    const lakeBank = smoothstep(edge + 34, edge - 4, lakeD + 8 * (fbm(x * 0.05, z * 0.05) - 0.5));
    const riverBank = smoothstep(river.width + bankReach + 20, river.width + bankReach - 18, river.d + 8 * (fbm(x * 0.06 + 4, z * 0.06) - 0.5)) * smoothstep(-2, 6, inland);
    const freshBank = Math.max(lakeBank, riverBank * (1 - estuary * 0.7));
    const basin = wetlandBasin(x, z, 1.32, 0.5);
    const weights = zoneWeights({temperature, moisture, elevation: regional, inland, freshBank, basin, cliff, estuary, ice, rag: fbm(x * 0.045 + 13, z * 0.045 - 2)});

    // Height: the elevation, the dunes and hummocks of its biome, the valley the river cut.
    let height = elevation;
    if (weights.desert > 0.05) {
        const dune = Math.abs(Math.sin((x * 0.42 + z * 0.3) * 0.16 + 3 * fbm(x * 0.02, z * 0.02)));
        height += weights.desert * (2.6 * dune * dune + 0.8 * fbm(x * 0.05, z * 0.05));
    }
    if (weights.grassland > 0.05) height += weights.grassland * 0.8 * (fbm(x * 0.04 + 2, z * 0.04) - 0.5);
    // The valley: land near the river eases toward a floor a metre or two above its water.
    if (river.d < VALLEY && inland > 2) {
        const floor = river.level + 1.2 + 0.05 * river.d;
        const pull = smoothstep(VALLEY, river.width + 3, river.d) * 0.9;
        if (height > floor) height += (floor - height) * pull;
    }

    // The coast: the land eases down to the beach, cliffs where the mountains and woods meet the sea; then the sea floor.
    const land = smoothstep(0, 9, inland);
    const off = Math.max(-inland, 0);
    const sea = seaDepth(x, z, b, off);
    const seaFloor = -sea.depth;
    const reach = 9 - 7 * cliff;
    if (ice > 0.02) {
        // The ice shelf: flat, a little above the sea, a sheer front into the cove.
        const shelf = ICE_HEIGHT + 0.12 * (fbm(x * 0.2, z * 0.2) - 0.5);
        const ground = inland > -1 ? seaFloor + (height - seaFloor) * smoothstep(-1, reach, inland) : seaFloor;
        height = ground + (Math.max(shelf, inland > 3 ? ground : shelf) - ground) * smoothstep(0.1, 0.9, ice);
    } else {
        // (The cliff's lift only along the coast: a whole sector raised would draw a star from the middle.)
        const lift = 3.2 * cliff * smoothstep(0, 4, inland) * smoothstep(40, 16, inland);
        height = inland > -1 ? seaFloor + (height + lift - seaFloor) * smoothstep(-1, reach, inland) : seaFloor;
    }

    // The lake: a basin below its level, its shore eased up above it.
    let freshLevel: number | null = null;
    let fresh = 0;
    // The lake's shore eases down to its water (a gentle bank, not a cliff where the hills come close).
    if (lakeD < edge + 34 && inland > 4) {
        const floor = LAKE.level + 0.6 + 0.16 * Math.max(lakeD - edge, 0);
        if (height > floor) height += (floor - height) * smoothstep(edge + 34, edge + 2, lakeD) * 0.92;
    }
    if (lakeD < edge + 14) {
        const inside = Math.min(lakeD / edge, 1);
        const bed = LAKE.level - 0.4 - 3.2 * (1 - inside * inside);
        const into = smoothstep(edge + 1.5, edge - 1.5, lakeD);
        // The shore rises above the water (a bank), never below it.
        const bank = LAKE.level + 0.45 + 0.09 * Math.max(lakeD - edge, 0);
        if (lakeD >= edge - 1.5 && height < bank) height += (bank - height) * smoothstep(edge + 14, edge + 1.5, lakeD);
        height = height + (bed - height) * into;
        if (lakeD < edge + 0.6) {
            freshLevel = LAKE.level;
            fresh = Math.max(fresh, smoothstep(edge + 0.6, edge - 0.6, lakeD));
        }
    }
    // The river: a U-shaped bed below its surface, banks above it.
    if (river.d < river.width + 12 && inland > -3) {
        const w = river.width;
        const bank = river.level + 0.35 + 0.07 * Math.max(river.d - w, 0);
        const coastFade = smoothstep(-2, 5, inland);
        // (Not inside the lake: its own shore is the bank there, and a river's bank across it would wall it off.)
        const outOfLake = smoothstep(edge - 1, edge + 4, lakeD);
        if (river.d > w && height < bank) height += (bank - height) * smoothstep(w + 12, w + 1, river.d) * coastFade * outOfLake;
        const bed = river.level - river.depth * (1 - Math.min(river.d / Math.max(w, 0.1), 1) ** 2) - 0.05;
        const into = smoothstep(w + 1.4, w * 0.6, river.d);
        // (The channel only ever lowers the ground: inside the lake its bed is deeper than the river's.)
        height = Math.min(height, height + (bed - height) * into * Math.max(coastFade, inland < 0 ? 0.6 : 0));
        if (river.d < w + 0.5 && inland > 1.5) {
            freshLevel = Math.max(freshLevel ?? -Infinity, river.level);
            fresh = Math.max(fresh, smoothstep(w + 0.5, w - 0.5, river.d) * smoothstep(1.5, 4, inland));
        }
    }
    // The wetland's pools: where its floor lies below its water.
    if (basin > 0.35 && height < WETLAND.level && inland > 4 && freshLevel === null) {
        freshLevel = WETLAND.level;
        fresh = smoothstep(WETLAND.level, WETLAND.level - 0.12, height) * smoothstep(0.35, 0.5, basin);
    }

    return {
        height,
        weights,
        land,
        inland,
        river: river.d,
        reef: sea.reef,
        cliff,
        temperature,
        moisture,
        elevation,
        freshLevel,
        fresh,
        ice,
        lagoon: lagoonOf(b),
        dropOff: dropOffOf(b),
        kelp: kelpOf(b),
        estuary,
        riverAlong: along,
        riverHit: river
    };
}

export function wildHeight(x: number, z: number): number {
    return sampleWildGround(x, z).height;
}

export function wildZoneAt(sample: Pick<WildGroundSample, "weights">): WildLandZone {
    return topZone(sample.weights);
}

/** Is this point under water (the sea, or fresh water standing over it)? */
export function underWater(sample: Pick<WildGroundSample, "height" | "freshLevel" | "fresh">): "sea" | "fresh" | null {
    if (sample.freshLevel !== null && sample.fresh >= 0.5 && sample.height < sample.freshLevel) return "fresh";
    if (sample.height < 0) return "sea";
    return null;
}
