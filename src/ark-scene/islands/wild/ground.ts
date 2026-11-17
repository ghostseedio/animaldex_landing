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
import {CRATER, craterAt, craterWarmth, outletAt, PLUNGE_POOL, PLUNGE_SPILL, type CraterShape, type OutletHit} from "@/ark-scene/islands/wild/crater";

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
    /** p5: where the point is on the old volcano (`crater.ts`): its lake's shore, its rim, how much it is the cone's. */
    crater: CraterShape;
    /** p5: the caldera's warm ground (0…1): the snow line stands higher there. */
    warm: number;
    /** p5: the crater lake's outlet stream at its nearest point (null far from the volcano). */
    outlet: OutletHit | null;
};

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
    // p5 (crater): the crater lake's water and shore, and its outlet's banks, are fresh water's too.
    const crater = craterAt(x, z);
    const outlet = crater.d < 90 ? outletAt(x, z) : null;
    const plunge = Math.hypot((x - PLUNGE_POOL.x) / PLUNGE_POOL.rx, (z - PLUNGE_POOL.z) / PLUNGE_POOL.rz);
    const craterBank = Math.max(
        // (Eased over some 20 m, as every zone's edge is: never a hard line.)
        smoothstep(15, -9, crater.shore + 5 * (fbm(x * 0.07 + 6, z * 0.07 - 3) - 0.5)),
        smoothstep(16, -6, (plunge - 1) * PLUNGE_POOL.rz),
        outlet ? smoothstep(outlet.width + 15, outlet.width - 7, Math.hypot(outlet.d, outlet.along >= 1 ? outlet.beyond : 0)) : 0
    );
    const freshBank = Math.max(lakeBank, riverBank * (1 - estuary * 0.7), craterBank);
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
    // (Metres from the river's line to the far edge of its banks' easing: 28, inline so the v2 world can be chosen while
    // this module is still loading.)
    const VALLEY = 28;
    if (river.d < VALLEY && inland > 2) {
        // (Its valley by the river's own profile: the mouth's fall to the lake is cut into it, the land round it as it was.)
        const floor = river.valley + 1.2 + 0.05 * river.d;
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
        // (The upper river's banks stand clear of it by its fall too, across a cell of the drawn water's 1.1 m grid and a
        // half: its water is drawn at a cell's highest corner, and on its steep reach a bank only 35 cm over the water
        // beside it had the water drawn over its grass. Lane MA3, the river mouth.)
        const bank = river.level + 0.35 + 0.07 * Math.max(river.d - w, 0) + (river.upper ? 1.6 * river.fall : 0);
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
    // p5 (crater): the outlet stream through the breach in the rim and over the sill to the falls' lip, then the lake.
    if (outlet && outlet.d < outlet.width + 30) {
        const w = outlet.width;
        // (Past the lip the sill ends: the cliff. In the lake its line is the lake's.)
        const side = outlet.along >= 1 ? smoothstep(1.2, 0, outlet.beyond) : 1;
        // The breach: the rim cut down to the stream in a V.
        const floor = outlet.level + 0.6 + 0.62 * Math.max(outlet.d - w, 0);
        if (height > floor) height += (floor - height) * smoothstep(w + 24, w + 6, outlet.d) * side;
        // The sill: the ground beside the stream stands up to its banks (the falls' lip is the valley's head).
        const bank = outlet.level + 0.3 + 0.09 * Math.max(outlet.d - w, 0);
        if (outlet.d > w && height < bank) height += (bank - height) * smoothstep(w + 10, w + 1, outlet.d) * side;
        const bed = outlet.level - outlet.depth * (1 - Math.min(outlet.d / Math.max(w, 0.1), 1) ** 2) - 0.05;
        height += (bed - height) * smoothstep(w + 1.3, w * 0.7, outlet.d) * side * smoothstep(-1.5, 1.5, crater.shore);
        if (outlet.d < w + 0.5 && side > 0.5 && crater.shore > -0.6) {
            freshLevel = Math.max(freshLevel ?? -Infinity, outlet.level);
            fresh = Math.max(fresh, smoothstep(w + 0.5, w - 0.5, outlet.d));
        }
    }
    // The crater lake: its bed and shore are the caldera's own (`crater.ts`); its water where the bed is under it.
    if (crater.shore < 0.6) {
        freshLevel = Math.max(freshLevel ?? -Infinity, CRATER.level);
        fresh = Math.max(fresh, smoothstep(0.6, -0.6, crater.shore));
    }
    // The falls' plunge pool: a basin under its level, banks over it but where it spills to the spring.
    if (plunge < 1.8) {
        // (At the spill its bank is a notch a hand under the water: the pool runs over it to the spring.)
        const notch = smoothstep(1.8, 1.0, Math.hypot((x - PLUNGE_SPILL.x) / 0.9, (z - PLUNGE_SPILL.z - 1.1) / 1.6));
        const bank = PLUNGE_POOL.level + 0.35 - 0.47 * notch;
        // (Full for a cell and a half round the water, so no drawn water's corner is dry ground under it.)
        if (plunge >= 1 && height < bank) height += (bank - height) * smoothstep(1.75, 1.45, plunge);
        if (plunge < 1.06) {
            const bed = PLUNGE_POOL.level - 0.3 - 2.3 * (1 - Math.min(plunge, 1) ** 2);
            height = Math.min(height, height + (bed - height) * smoothstep(1.06, 0.92, plunge));
            if (plunge < 1.02) {
                freshLevel = Math.max(freshLevel ?? -Infinity, PLUNGE_POOL.level);
                fresh = Math.max(fresh, smoothstep(1.02, 0.94, plunge));
            }
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
        riverHit: river,
        crater,
        warm: crater.d < 60 ? craterWarmth(x, z) : 0,
        outlet
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
