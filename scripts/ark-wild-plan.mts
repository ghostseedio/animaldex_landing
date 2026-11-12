#!/usr/bin/env -S npx tsx
/**
 * The wild island's plan picture and numbers (docs/ark/wild-island.md): no WebGL, so it runs anywhere.
 *
 *   npx tsx scripts/ark-wild-plan.mts [--out .ark-golden/wild] [--scale 1]      plan.png (1 px = 1 m) + measure.json
 *   npx tsx scripts/ark-wild-plan.mts --validate [--out dir]                     the spawn validator's report
 *   npx tsx scripts/ark-wild-plan.mts --atlas [--out dir]                        the slot lists (atlas input)
 */

import {mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";
import {sampleWildGround, underWater, wildZoneAt} from "../src/ark-scene/islands/wild/ground.ts";
import {ecotoneWidths, measureWild} from "../src/ark-scene/islands/wild/summary.ts";
import {WILD_HALF} from "../src/ark-scene/islands/wild/frame.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
const flag = (name: string) => argv.includes(`--${name}`);
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "wild")));
mkdirSync(out, {recursive: true});

const ZONE_COLOUR: Record<string, [number, number, number]> = {
    seashore: [222, 204, 150], river_lake: [120, 170, 110], wetland: [96, 140, 120], rainforest: [36, 110, 48], woodland: [92, 132, 60],
    grassland: [200, 178, 92], desert: [240, 150, 70], mountains: [138, 128, 112], polar: [236, 242, 246], farm_garden: [255, 0, 255]
};

if (!flag("validate") && !flag("atlas")) {
    const scale = Number(arg("scale", "1"));
    const size = Math.round((WILD_HALF * 2) / scale);
    const pixels = Buffer.alloc(size * size * 3);
    const heights = new Float32Array(size * size);
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) heights[row * size + col] = sampleWildGround(-WILD_HALF + (col + 0.5) * scale, -WILD_HALF + (row + 0.5) * scale).height;
    }
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const x = -WILD_HALF + (col + 0.5) * scale;
            const z = -WILD_HALF + (row + 0.5) * scale;
            const s = sampleWildGround(x, z);
            const water = underWater(s);
            const i = (row * size + col) * 3;
            let c: [number, number, number];
            if (water === "fresh") c = [70, 120, 150];
            else if (water === "sea") {
                const d = -s.height;
                const t = Math.min(d / 40, 1);
                c = [Math.round(90 - 70 * t), Math.round(170 - 110 * t), Math.round(190 - 90 * t)];
                if (s.reef > 0.3) c = [Math.round(c[0] * 0.6 + 230 * 0.4), Math.round(c[1] * 0.6 + 140 * 0.4), Math.round(c[2] * 0.6 + 120 * 0.4)];
                if (s.kelp > 0.5 && d > 3 && d < 14 && s.inland > -45) c = [Math.round(c[0] * 0.7 + 60 * 0.3), Math.round(c[1] * 0.7 + 90 * 0.3), Math.round(c[2] * 0.7 + 40 * 0.3)];
            } else {
                c = [0, 0, 0];
                for (const [zone, w] of Object.entries(s.weights)) {
                    const zc = ZONE_COLOUR[zone];
                    c[0] += zc[0] * w;
                    c[1] += zc[1] * w;
                    c[2] += zc[2] * w;
                }
                if (s.ice > 0.5) c = [250, 252, 255];
                // Hillshade from the north-west, and contours every 10 m.
                const hl = heights[row * size + Math.max(col - 1, 0)];
                const hu = heights[Math.max(row - 1, 0) * size + col];
                const shade = Math.max(0.55, Math.min(1.35, 1 + ((s.height - hl) * -0.6 + (s.height - hu) * -0.6) / scale));
                c = c.map((v) => Math.min(255, v * shade)) as [number, number, number];
                if (Math.floor(s.height / 10) !== Math.floor(hl / 10) || Math.floor(s.height / 10) !== Math.floor(hu / 10)) c = c.map((v) => v * 0.7) as [number, number, number];
            }
            pixels[i] = c[0];
            pixels[i + 1] = c[1];
            pixels[i + 2] = c[2];
        }
    }
    // Chunk lines (Part B's 52.8 m).
    for (let k = 0; k <= 10; k++) {
        const p = Math.min(size - 1, Math.round((k * 52.8) / scale));
        for (let q = 0; q < size; q++) {
            for (const i of [(p * size + q) * 3, (q * size + p) * 3]) {
                pixels[i] = Math.round(pixels[i] * 0.8);
                pixels[i + 1] = Math.round(pixels[i + 1] * 0.8);
                pixels[i + 2] = Math.round(pixels[i + 2] * 0.8);
            }
        }
    }
    await sharp(pixels, {raw: {width: size, height: size, channels: 3}}).png().toFile(path.join(out, "plan.png"));
    const measure = measureWild(1);
    const ecotones = ecotoneWidths(4);
    writeFileSync(path.join(out, "measure.json"), JSON.stringify({measure, ecotones}, null, 2));
    console.log(JSON.stringify(measure, null, 1));
    console.log(ecotones.map((e) => `${e.a}↔${e.b}: ${e.width} m (${e.samples})`).join("\n"));
    console.log("plan", path.join(out, "plan.png"));
}
