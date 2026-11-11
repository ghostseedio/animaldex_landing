#!/usr/bin/env -S npx tsx
/**
 * Writes src/ark-scene/collide/body-shapes.json: each Ark model's own body shape (its `ark.json` extent: width, height
 * and length) as fractions of the axis its drawn length is measured on (`stats.ts` bodyAxisExtent), so the collisions
 * know an animal's footprint before (and whether or not) its model loads, the same for every viewer.
 *
 *   npx tsx scripts/ark-collide-bodies.mts [<models dir>, default ~/animaldex-talking-models]
 *
 * Each entry is six base-36 characters: width, height, length, each round(fraction × 100) in two characters.
 */

import {existsSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {bodyAxisExtent} from "@/ark-scene/stats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = path.join(process.argv[2] ?? path.join(os.homedir(), "animaldex-talking-models"), "ark");
if (!existsSync(models)) throw new Error(`no model set at ${models}`);
const code = (v: number) => Math.min(Math.max(Math.round(v * 100), 1), 1295).toString(36).padStart(2, "0");
const shapes: Record<string, string> = {};
let skipped = 0;
for (const slug of readdirSync(models).sort()) {
    const file = path.join(models, slug, "ark.json");
    if (!existsSync(file)) continue;
    const ark = JSON.parse(readFileSync(file, "utf8")) as {extent?: [number, number, number]; behaviour?: {plan?: string}};
    if (!ark.extent || ark.extent.length !== 3) {
        skipped++;
        continue;
    }
    const [x, y, z] = ark.extent;
    const axis = bodyAxisExtent(slug, ark.behaviour?.plan, {x, y, z});
    shapes[slug] = code(x / axis) + code(y / axis) + code(z / axis);
}
const out = {about: "Each Ark model's body (scripts/ark-collide-bodies.mts, from its ark.json extent): width, height and length as fractions of its drawn length's axis, round(×100) in base 36, two characters each.", shapes};
writeFileSync(path.join(root, "src/ark-scene/collide/body-shapes.json"), JSON.stringify(out) + "\n");
console.log(`body shapes: ${Object.keys(shapes).length} species (${skipped} without an extent)`);
