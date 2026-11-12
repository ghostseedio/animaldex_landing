/**
 * The wild island's zones as the Ark places animals in them (Part C; islands plan §2.1, §2.2): each zone's site (where
 * its animals gather, its label, where the camera flies to it), its home area (the zone's core, weight ≥ 0.6), its
 * placement cells (the map's own `MapPoints` over the wild island's sampler: 2.5 m cells, one tag each, in the order
 * slots take them), its big-animal ranges and whale cells (`reserves.ts`), and its capacity against the plan's counts.
 *
 * Placement stays a pure function of (zone, slot, rank) and the terrain: nobody moves when another arrives or leaves.
 */

import {MapPoints} from "@/ark-scene/map/points";
import type {ArkZone} from "@/ark-scene/types";
import {wildMapSampler} from "@/ark-scene/islands/wild/map-sampler";
import {bigRanges, whaleCells} from "@/ark-scene/islands/wild/reserves";
import {WILD_ZONES} from "@/ark-scene/islands/wild/biomes";

/** The islands plan's wild-island counts per zone (§2.1): today (2026-11-12), at 3×, at a year. */
export const WILD_PLAN_COUNTS: Record<string, {today: number; triple: number; year: number}> = {
    rainforest: {today: 161, triple: 483, year: 707},
    woodland: {today: 154, triple: 462, year: 587},
    river_lake: {today: 139, triple: 417, year: 576},
    grassland: {today: 122, triple: 366, year: 469},
    wetland: {today: 59, triple: 177, year: 246},
    seashore: {today: 26, triple: 78, year: 112},
    desert: {today: 21, triple: 63, year: 87},
    coral_reef: {today: 13, triple: 39, year: 64},
    open_ocean: {today: 7, triple: 21, year: 30},
    mountains: {today: 2, triple: 6, year: 6},
    polar: {today: 0, triple: 0, year: 0}
};

export {wildZoneSites, type WildZoneSite} from "@/ark-scene/islands/wild/zone-sites";

let points: MapPoints | null = null;

/** The map's spawn cells over the wild island (MapPoints, unchanged). */
export function wildMapPoints(): MapPoints {
    points ??= new MapPoints(wildMapSampler());
    return points;
}

export type ZoneCapacity = {
    zone: ArkZone;
    /** Rule E's visible capacity (`map/capacity.ts`): the zone's own cells plus its attach points. */
    cells: number;
    attach: number;
    /** Big-animal ranges (land) or whale cells (the open ocean). */
    reserved: number;
    visible: number;
    plan: {today: number; triple: number; year: number};
    /** Visible capacity over the year's count (≥ 1: everyone shown at once at a year). */
    headroomYear: number;
};

/** Every wild zone's capacity against the islands plan's counts. */
export function wildCapacities(): ZoneCapacity[] {
    const mp = wildMapPoints();
    const cells = mp.cellsPerZone();
    const attach = new Map<string, number>();
    for (const point of wildMapSampler().attachPoints()) attach.set(point.zone, (attach.get(point.zone) ?? 0) + 1);
    const ranges = new Map<string, number>();
    for (const r of bigRanges()) ranges.set(r.zone, (ranges.get(r.zone) ?? 0) + 1);
    return WILD_ZONES.map((zone) => {
        const plan = WILD_PLAN_COUNTS[zone];
        const c = cells.get(zone) ?? 0;
        const a = attach.get(zone) ?? 0;
        const reserved = zone === "open_ocean" ? whaleCells().length : ranges.get(zone) ?? 0;
        const visible = c + a + reserved;
        return {zone, cells: c, attach: a, reserved, visible, plan, headroomYear: plan.year ? Math.round((visible / plan.year) * 10) / 10 : Infinity};
    });
}
