/**
 * Each wild zone's site (`world.ts` ZoneSite's shape): where its animals gather, its label, where the camera flies to
 * it. Split out of `sites.ts` so `world.ts` can take it for the v2 world without the map's machinery (P1, docs/ark/
 * wild-island.md §Integration). Pure.
 */

import type {ArkZone} from "@/ark-scene/types";
import {sampleWildGround, underWater, wildZoneAt} from "@/ark-scene/islands/wild/ground";
import {WILD_ZONES} from "@/ark-scene/islands/wild/biomes";
import {LAKE, bearingOf, coastRadius} from "@/ark-scene/islands/wild/fields";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";

/** `world.ts` ZoneSite's shape. */
export type WildZoneSite = {x: number; z: number; spacing: number; kind: "land" | "sea" | "ring" | "shore"; theta?: number; clearing: number};

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

