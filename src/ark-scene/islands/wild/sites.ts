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
import {sampleWildGround, underWater, wildZoneAt} from "@/ark-scene/islands/wild/ground";
import {wildMapSampler} from "@/ark-scene/islands/wild/map-sampler";
import {bigRanges, whaleCells} from "@/ark-scene/islands/wild/reserves";
import {WILD_ZONES} from "@/ark-scene/islands/wild/biomes";
import {LAKE, bearingOf, coastRadius} from "@/ark-scene/islands/wild/fields";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";

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

/** `world.ts` ZoneSite's shape. */
export type WildZoneSite = {x: number; z: number; spacing: number; kind: "land" | "sea" | "ring" | "shore"; theta?: number; clearing: number};

let points: MapPoints | null = null;

/** The map's spawn cells over the wild island (MapPoints, unchanged). */
export function wildMapPoints(): MapPoints {
    points ??= new MapPoints(wildMapSampler());
    return points;
}

let sites: Record<ArkZone, WildZoneSite> | null = null;

/**
 * Each zone's site: the middle of its core (the weighted centre of the cells where it holds 0.6 or more), moved to the
 * nearest core cell; the sea zones' at their water (the lagoon's middle, the east's open water off the drop-off), the
 * lake's ring round the lake, the coast's on its southern beach.
 */
export function wildZoneSites(): Record<ArkZone, WildZoneSite> {
    if (sites) return sites;
    const sums = new Map<string, {x: number; z: number; w: number; cells: Array<[number, number]>}>();
    for (let z = -WILD_HALF + 2; z < WILD_HALF; z += 4) {
        for (let x = -WILD_HALF + 2; x < WILD_HALF; x += 4) {
            const s = sampleWildGround(x, z);
            const water = underWater(s);
            let zone: string;
            if (water === "sea") zone = s.reef > 0.3 ? "coral_reef" : s.inland < -30 && s.dropOff > 0.5 && -s.height > 12 ? "open_ocean" : "";
            else {
                zone = wildZoneAt(s);
                if (s.weights[zone as keyof typeof s.weights] < 0.6) zone = "";
            }
            if (!zone) continue;
            const e = sums.get(zone) ?? {x: 0, z: 0, w: 0, cells: []};
            e.x += x;
            e.z += z;
            e.w += 1;
            e.cells.push([x, z]);
            sums.set(zone, e);
        }
    }
    const centre = (zone: string) => {
        const e = sums.get(zone);
        if (!e) return {x: 0, z: 0};
        const mx = e.x / e.w;
        const mz = e.z / e.w;
        let best = e.cells[0];
        for (const c of e.cells) if (Math.hypot(c[0] - mx, c[1] - mz) < Math.hypot(best[0] - mx, best[1] - mz)) best = c;
        return {x: best[0], z: best[1]};
    };
    const beach = Math.PI;
    const shoreR = coastRadius(beach) - 6;
    const out = {} as Record<ArkZone, WildZoneSite>;
    for (const zone of WILD_ZONES) {
        const c = centre(zone);
        if (zone === "coral_reef" || zone === "open_ocean") out[zone] = {...c, spacing: zone === "open_ocean" ? 7 : 4.2, kind: "sea", clearing: 0};
        else if (zone === "river_lake") out[zone] = {x: LAKE.x, z: LAKE.z, spacing: 2.6, kind: "ring", clearing: LAKE.r + 6};
        else if (zone === "seashore") out[zone] = {x: Math.sin(beach) * shoreR, z: -Math.cos(beach) * shoreR, spacing: 2.4, kind: "shore", clearing: 8, theta: bearingOf(0, 1) - Math.PI / 2};
        else out[zone] = {...c, spacing: zone === "grassland" ? 3 : 2.8, kind: "land", clearing: 12};
    }
    // No garden on the wild island: its key keeps the type's shape at the island's middle (no animal is routed there).
    out.farm_garden = {x: 0, z: 0, spacing: 2.6, kind: "land", clearing: 0};
    sites = out;
    return out;
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
