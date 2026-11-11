#!/usr/bin/env tsx
/**
 * Writes src/ark-scene/map/walk-mask.json: the behaviour lane's walk grid (`behaviour-nav.ts`, from its scenery
 * sampler) as two bits a cell, at the two slopes placement asks (MAX_SLOPE, MOUNTAIN_SLOPE), so placement never builds
 * the behaviour world at mount (`map/walk-mask.ts`). Run it again when the terrain or the scenery changes (the map
 * test fails until it is).
 *
 *   npx tsx scripts/ark-map-walk-mask.mts
 */

import {writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {MAX_SLOPE, MOUNTAIN_SLOPE, navGrid} from "@/ark-scene/behaviour-nav";
import {worldSampler} from "@/ark-scene/world-sampler";
import {encodeMask} from "@/ark-scene/map/walk-mask";
import {TERRAIN_HALF} from "@/ark-scene/world";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampler = worldSampler();
const grid = navGrid(sampler);
const {size, walk, steep} = grid.cells;
const slopes: Record<string, string> = {};
for (const slope of [MAX_SLOPE, MOUNTAIN_SLOPE]) slopes[String(slope)] = encodeMask(size, (k) => walk[k] === 1 && steep[k] <= slope);
const file = {cell: (TERRAIN_HALF * 2) / size === 2 ? 2 : (TERRAIN_HALF * 2) / size, size, half: TERRAIN_HALF, version: sampler.version, slopes};
writeFileSync(path.join(root, "src/ark-scene/map/walk-mask.json"), JSON.stringify(file) + "\n");
console.log(`walk mask: ${size}x${size} cells, ${Object.keys(slopes).length} slopes, from ${sampler.version}`);
