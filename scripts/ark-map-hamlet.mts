#!/usr/bin/env -S npx tsx
/**
 * The hamlet's reserved plots (`src/ark-scene/map/hamlet-slots.json`): the
 * 15 houses and 5 smallholdings past today's cottage and barn, in their fixed
 * order, from `planHamletSlots()` (the hamlet's plan along its lanes) on the
 * current terrain and scenery; and their footprints for the props' decor
 * (`src/ark-scene/props/hamlet-footprints.json`, which `props/hamlet-land.ts`
 * reads without an import cycle). Run it again when the terrain, the lanes or
 * the decor change (`src/lib/ark-hamlet.test.ts` and `ark-props.test` fail
 * until then). `npx tsx scripts/ark-map-hamlet.mts`
 */
import {writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {planWithReport, plotFootprint} from "../src/ark-scene/map/hamlet.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const started = performance.now();
const {plots: planned, misses} = planWithReport();
const plots = planned.map((plot) => ({...plot, x: Math.round(plot.x * 1000) / 1000, z: Math.round(plot.z * 1000) / 1000}));
const file = {about: "The hamlet's reserved plots past today's cottage and barn, in their fixed order (scripts/ark-map-hamlet.mts, map/hamlet.ts planHamletSlots). Append-only: homePlots() takes them in this order.", plots};
writeFileSync(join(root, "src/ark-scene/map/hamlet-slots.json"), JSON.stringify(file, null, 1) + "\n");
const footprints = Object.fromEntries(plots.map((plot) => [plot.id, plotFootprint(plot).map((c) => [Math.round(c.x * 1000) / 1000, Math.round(c.z * 1000) / 1000])]));
writeFileSync(join(root, "src/ark-scene/props/hamlet-footprints.json"), JSON.stringify({about: "The reserved hamlet slots' footprints (map/hamlet.ts plotFootprint, world x/z corners), baked so decor.ts can thin its grass and flowers under them without an import cycle. ark-props.test checks they still match. Written by scripts/ark-map-hamlet.mts.", footprints}, null, 1) + "\n");
console.log(`${plots.length} plots (${plots.filter((p) => p.kind === "house").length} houses, ${plots.filter((p) => p.kind === "smallholding").length} smallholdings) in ${Math.round(performance.now() - started)} ms${misses.length ? `; not placed: ${JSON.stringify(misses)}` : ""}`);
