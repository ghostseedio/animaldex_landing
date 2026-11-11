#!/usr/bin/env -S npx tsx
/**
 * The hamlet's reserved plots (`src/ark-scene/map/hamlet-slots.json`): the
 * 15 houses and 5 smallholdings past today's cottage and barn, in their fixed
 * order, from `planHamletSlots()` on the current terrain and scenery. Run it
 * again when the terrain or the decor changes (`src/lib/ark-hamlet.test.ts`
 * fails until then). `npx tsx scripts/ark-map-hamlet.mts`
 */
import {writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {planHamletSlots} from "../src/ark-scene/map/hamlet.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const started = performance.now();
const plots = planHamletSlots().map((plot) => ({...plot, x: Math.round(plot.x * 1000) / 1000, z: Math.round(plot.z * 1000) / 1000}));
const file = {about: "The hamlet's reserved plots past today's cottage and barn, in their fixed order (scripts/ark-map-hamlet.mts, map/hamlet.ts planHamletSlots). Append-only: homePlots() takes them in this order.", plots};
writeFileSync(join(root, "src/ark-scene/map/hamlet-slots.json"), JSON.stringify(file, null, 1) + "\n");
console.log(`${plots.length} plots (${plots.filter((p) => p.kind === "house").length} houses, ${plots.filter((p) => p.kind === "smallholding").length} smallholdings) in ${Math.round(performance.now() - started)} ms`);
