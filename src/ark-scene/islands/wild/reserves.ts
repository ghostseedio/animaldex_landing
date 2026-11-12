/**
 * Room for true-size animals on the wild island (decisions 53 and 54):
 *
 * - **Deep water for whales** (decision 53 on today's island, carried over): swimmers drawn 6 m or longer take reserved
 *   cells in the deepest open water, furthest out, 30 m apart; no other swimmer's cell lies within 14 m of one. On the
 *   wild island that water is the east's drop-off (`fields.ts` dropOffOf), 15 m deep and more.
 * - **Big-animal ground** (decision 54: "reserve big-animal ground when Part C rebuilds the map"): each land zone keeps
 *   ranges, spots of open, gentle ground 16 m apart, each with a 7 m clear disc that no smaller animal's cell, no tree
 *   and no rock takes. Land animals drawn 2.5 m or longer (an elephant, a giraffe, a rhino, a bison, a crocodile on its
 *   bank) take a range of their zone, so a 5 m elephant's home is always clear whoever else arrives.
 *
 * Both are static, from the terrain alone: no arrival or departure moves anyone. Pure.
 */

import {fbm, hashString} from "@/ark-scene/world";
import {sampleWildGround, underWater, wildZoneAt} from "@/ark-scene/islands/wild/ground";
import {gridSlope} from "@/ark-scene/islands/wild/terrain-cache";
import {WILD_HALF} from "@/ark-scene/islands/wild/frame";
import type {WildLandZone} from "@/ark-scene/islands/wild/biomes";

/** Land animals at least this long (m) take a big-animal range. */
export const BIG_LAND_LENGTH = 2.5;
/** A range's clear disc (m). */
export const RANGE_CLEAR = 7;
/** Ranges at least this far apart (m). */
export const RANGE_SPACING = 16;
/** Swimmers at least this long (m) take a whale cell (decision 53). */
export const WHALE_LENGTH = 6;
export const WHALE_SPACING = 30;
export const WHALE_CLEAR = 14;
export const WHALE_DEPTH = 15;

export type Range = {zone: WildLandZone; x: number; y: number; z: number; index: number};
export type WhaleCell = {x: number; y: number; z: number; depth: number; index: number};

/** How many ranges each zone keeps (the most it can fit is less where the zone is small or rugged). */
const RANGE_WANT: Partial<Record<WildLandZone, number>> = {grassland: 40, rainforest: 24, woodland: 24, river_lake: 14, wetland: 18, desert: 14, seashore: 10, mountains: 8, polar: 6};

let ranges: Range[] | null = null;
let whales: WhaleCell[] | null = null;

/** A fixed order for candidates (a scatter, not the grid's rows), so the spread does not lean to one corner. */
function scatter(x: number, z: number): number {
    return hashString(`${Math.round(x * 10)},${Math.round(z * 10)}`);
}

/** Every zone's big-animal ranges: open, gentle, dry ground in the zone's core, spread out. */
export function bigRanges(): Range[] {
    if (ranges) return ranges;
    const out: Range[] = [];
    const candidates: Array<{zone: WildLandZone; x: number; y: number; z: number; h: number; score: number}> = [];
    for (let z = -WILD_HALF + 6; z < WILD_HALF; z += 6) {
        for (let x = -WILD_HALF + 6; x < WILD_HALF; x += 6) {
            const s = sampleWildGround(x, z);
            if (underWater(s) || s.inland < 10 || s.ice > 0) continue;
            const zone = wildZoneAt(s);
            if (zone === "farm_garden" || s.weights[zone] < 0.6 || !RANGE_WANT[zone]) continue;
            const slope = gridSlope(x, z);
            if (slope > 0.22) continue;
            // Clear of fresh water by its disc and a margin (a crocodile's range is its bank, not the river).
            if (s.river < s.riverHit.width + RANGE_CLEAR + 2) continue;
            // Never in the forests' deepest woods: a range is a clearing, preferring flat, open ground.
            const open = fbm(x * 0.028 + 41, z * 0.028 - 17);
            candidates.push({zone, x, y: s.height, z, h: scatter(x, z), score: slope + 0.3 * open});
        }
    }
    candidates.sort((a, b) => a.h - b.h);
    const taken = new Map<WildLandZone, number>();
    for (const c of candidates) {
        if ((taken.get(c.zone) ?? 0) >= (RANGE_WANT[c.zone] ?? 0)) continue;
        if (out.some((r) => Math.hypot(r.x - c.x, r.z - c.z) < RANGE_SPACING)) continue;
        out.push({zone: c.zone, x: c.x, y: c.y, z: c.z, index: taken.get(c.zone) ?? 0});
        taken.set(c.zone, (taken.get(c.zone) ?? 0) + 1);
    }
    ranges = out;
    return out;
}

/** The ranges of one zone, in their fixed order. */
export function rangesOf(zone: string): Range[] {
    return bigRanges().filter((r) => r.zone === zone);
}

/** Inside some range's clear disc (grown by `margin`)? */
export function inRange(x: number, z: number, margin = 0): boolean {
    for (const r of bigRanges()) if (Math.abs(r.x - x) < RANGE_CLEAR + margin && Math.hypot(r.x - x, r.z - z) < RANGE_CLEAR + margin) return true;
    return false;
}

/** The whales' cells: the deepest open water of the east's drop-off, furthest out first, 30 m apart. */
export function whaleCells(): WhaleCell[] {
    if (whales) return whales;
    const candidates: Array<{x: number; y: number; z: number; depth: number; off: number}> = [];
    for (let z = -WILD_HALF + 8; z < WILD_HALF - 8; z += 4) {
        for (let x = -WILD_HALF + 8; x < WILD_HALF - 8; x += 4) {
            const s = sampleWildGround(x, z);
            // The east's drop-off (the islands plan's deep water for whales), past its narrow shelf.
            if (s.height > -WHALE_DEPTH || s.inland > -24 || s.reef > 0.05 || s.dropOff < 0.45) continue;
            candidates.push({x, y: s.height, z, depth: -s.height, off: -s.inland});
        }
    }
    candidates.sort((a, b) => b.depth - a.depth || b.off - a.off || a.x - b.x || a.z - b.z);
    const out: WhaleCell[] = [];
    for (const c of candidates) {
        if (out.length >= 24) break;
        if (out.some((w) => Math.hypot(w.x - c.x, w.z - c.z) < WHALE_SPACING)) continue;
        out.push({...c, index: out.length});
    }
    whales = out;
    return out;
}

/** Within a whale cell's clear water? */
export function nearWhale(x: number, z: number, margin = 0): boolean {
    for (const w of whaleCells()) if (Math.hypot(w.x - x, w.z - z) < WHALE_CLEAR + margin) return true;
    return false;
}
