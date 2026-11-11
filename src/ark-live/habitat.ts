/**
 * How suitable a place is for an animal: S (design §5.1, §12.5), from the cell's zone and water and the species'
 * own zone, region, depth band and water kind.
 *
 *   1.0   its own zone (or its area: a pet at home), its realm; in water its own kind and depth band
 *   0.6   the same region, or another zone it can live in; a swimmer outside its depth band; brackish water
 *   0.3   the opposite climate (polar or mountains ↔ desert, rainforest, coral reef); salt ↔ fresh for an air-breather
 *   0.15  a sea fish in fresh water, or the reverse
 *   0     impossible (the validator already forbids it: a fish out of water)
 *
 * Pure.
 */

import type {Abilities} from "@/ark-live/species";
import {WATER_KIND, type TerrainCell} from "@/ark-live/terrain";
import type {MeterCause} from "@/ark-live/protocol";
import {ZONE_REGION, type ArkArea, type ArkZone} from "@/ark-scene/types";
import type {DepthBand} from "@/ark-scene/sea-depth";

const COLD = new Set<ArkZone>(["polar", "mountains"]);
const WARM = new Set<ArkZone>(["desert", "rainforest", "coral_reef"]);

/** Each depth band's water depth (m, the island's scale: the sea is at most about 10 m deep, a 30 m strait). */
const BAND_DEPTH: Record<DepthBand, [number, number]> = {
    surface: [0.3, 40],
    upper: [0.8, 40],
    mid: [1.5, 40],
    seabed: [0.5, 40],
    reef: [0.5, 6],
    deep: [4, 40],
    pond_surface: [0.2, 4],
    pond_mid: [0.6, 4],
    pond_bed: [0.3, 4]
};

export type AnimalHome = {zone: ArkZone; area: ArkArea | null};
export type Suitability = {s: number; cause: MeterCause};

export function suitability(ability: Abilities, home: AnimalHome, cell: TerrainCell | null, opts: {otherIsland?: boolean; openSea?: boolean} = {}): Suitability {
    if (opts.openSea) {
        // Crossing the strait (§12.5): salt-water species and seabirds at home, other flyers 0.6, fresh-water swimmers 0.3.
        if (ability.water === "salt" || ability.seabird) return {s: 1, cause: "none"};
        if (ability.gills) return {s: 0.15, cause: "salt"};
        if (ability.canFly) return {s: 0.6, cause: "open_sea"};
        return {s: 0.3, cause: "salt"};
    }
    if (!cell) return {s: 0.3, cause: "far_from_home"};
    const inWater = cell.depth > 0;
    // Fish, rays, jellies: their water first.
    if (ability.gills) {
        if (!inWater) return {s: 0, cause: "dry"};
        const kind = ability.water ?? "salt";
        if (cell.water === WATER_KIND.BRACKISH) return {s: 0.6, cause: kind === "salt" ? "fresh" : "salt"};
        if ((kind === "salt" && cell.water === WATER_KIND.FRESH) || (kind === "fresh" && cell.water === WATER_KIND.SALT)) return {s: 0.15, cause: kind === "salt" ? "fresh" : "salt"};
        const band = ability.band ? BAND_DEPTH[ability.band] : null;
        if (band && (cell.depth < band[0] || cell.depth > band[1] * 1.2)) return {s: 0.6, cause: cell.depth < band[0] ? "shallow" : "deep"};
        return {s: 1, cause: "none"};
    }
    // Air-breathing swimmers (ducks, otters, seals, penguins) in the wrong water.
    if (inWater && ability.canSwim && ability.water && cell.water !== WATER_KIND.BRACKISH) {
        const wrong = (ability.water === "salt" && cell.water === WATER_KIND.FRESH) || (ability.water === "fresh" && cell.water === WATER_KIND.SALT);
        if (wrong) return {s: 0.3, cause: ability.water === "salt" ? "fresh" : "salt"};
    }
    let s: number;
    let cause: MeterCause = "none";
    if (home.area === "house" || home.area === "farm") {
        // A pet or a farm animal: at home in the home region (the hamlet), out of place elsewhere.
        s = cell.zone === "farm_garden" ? 1 : 0.6;
        if (s < 1) cause = "far_from_home";
    } else if (cell.zone === home.zone) {
        s = 1;
    } else if (ZONE_REGION[cell.zone] === ZONE_REGION[home.zone]) {
        s = 0.6;
    } else if ((COLD.has(home.zone) && WARM.has(cell.zone)) || (WARM.has(home.zone) && COLD.has(cell.zone))) {
        s = 0.3;
        cause = COLD.has(cell.zone) ? "cold" : "heat";
    } else {
        s = 0.6;
        cause = "far_from_home";
    }
    if (opts.otherIsland && s > 0.6) {
        s = 0.6;
        cause = "other_island";
    }
    return {s, cause};
}
