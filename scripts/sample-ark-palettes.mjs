#!/usr/bin/env node
/**
 * Samples each zone's talking-model background once and prints the Ark
 * scene's palette constants (src/ark-scene/palettes.ts is written from this
 * output, then hand-tuned). The images stay out of the repo: only the
 * averaged colours come in.
 *
 *   node scripts/sample-ark-palettes.mjs [~/animaldex-talking-models/backgrounds]
 *
 * For each 768×1344 portrait: sky = the mean of the top quarter, mid = the
 * band from 45% to 60% (the horizon in most of them), ground = the mean of
 * the bottom third, and accent = the most saturated of a 6×10 grid's cells
 * in the lower half (flowers, coral, moss).
 */
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const dir = process.argv[2] ?? path.join(os.homedir(), "animaldex-talking-models", "backgrounds");
const ZONES = ["coral_reef", "open_ocean", "seashore", "river_lake", "wetland", "rainforest", "woodland", "grassland", "desert", "mountains", "polar", "farm_garden"];

const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function mean(data, width, x0, y0, x1, y1) {
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * 3;
            sum[0] += data[i];
            sum[1] += data[i + 1];
            sum[2] += data[i + 2];
            n++;
        }
    }
    return sum.map((v) => v / Math.max(n, 1));
}

function saturation([r, g, b]) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
}

const out = {};
for (const zone of ZONES) {
    const {data, info} = await sharp(path.join(dir, `${zone}.jpg`)).resize(96, 168, {fit: "fill"}).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const {width: w, height: h} = info;
    const sky = mean(data, w, 0, 0, w, Math.round(h * 0.25));
    const mid = mean(data, w, 0, Math.round(h * 0.45), w, Math.round(h * 0.6));
    const ground = mean(data, w, 0, Math.round(h * 0.67), w, h);
    let accent = ground;
    for (let gy = 5; gy < 10; gy++) {
        for (let gx = 0; gx < 6; gx++) {
            const cell = mean(data, w, gx * 16, gy * 16.8 | 0, gx * 16 + 16, (gy + 1) * 16.8 | 0);
            if (saturation(cell) > saturation(accent)) accent = cell;
        }
    }
    out[zone] = {sky: hex(sky), mid: hex(mid), ground: hex(ground), accent: hex(accent)};
}
console.log(JSON.stringify(out, null, 2));
