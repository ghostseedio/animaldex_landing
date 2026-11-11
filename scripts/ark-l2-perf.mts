#!/usr/bin/env -S npx tsx
/**
 * Lane L2's CPU cost per animal per frame (motion pass deliverable "performance cost per animal"): the scene's own
 * L2 calls (the flight frame, the body channel, the surface guard) and the two drivers on real rig fixtures
 * (`src/lib/__fixtures__/ark-l2/`). Prints a table (µs a call: median and p95 over 20,000 calls after a warm-up).
 * `--throttle 4` repeats everything four times a call and divides, as a phone-speed proxy is not possible in Node:
 * the phone figure is this one times the measured desktop/phone ratio of the scene (`ark-l2-scenes.mjs --perf`).
 *
 *   npx tsx scripts/ark-l2-perf.mts
 */

import fs from "node:fs";
import path from "node:path";
import {Matrix4} from "three";
import {buildLocoRig, rowToWorld} from "@/ark-scene/locomotion/skeleton";
import type {LocoInput} from "@/ark-scene/locomotion/types";
import {chainDriver, flightDriver, OPEN_WING_RIGS} from "@/ark-scene/locomotion/l2-drivers";
import {l2BodyChannel, l2FlightFrame, l2SurfaceGuard, newL2Motion} from "@/ark-scene/locomotion/l2-scene";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixture = (slug: string) => JSON.parse(fs.readFileSync(path.join(root, "src/lib/__fixtures__/ark-l2", `${slug}.json`), "utf8"));

function time(label: string, n: number, fn: (i: number) => void): {label: string; median: number; p95: number} {
    for (let i = 0; i < 2000; i++) fn(i);
    const samples: number[] = [];
    const batch = 20;
    for (let i = 0; i < n; i += batch) {
        const t0 = performance.now();
        for (let k = 0; k < batch; k++) fn(i + k);
        samples.push(((performance.now() - t0) / batch) * 1000);
    }
    samples.sort((a, b) => a - b);
    return {label, median: Math.round(samples[Math.floor(samples.length / 2)] * 100) / 100, p95: Math.round(samples[Math.floor(samples.length * 0.95)] * 100) / 100};
}

const rows: Array<{label: string; median: number; p95: number}> = [];
const N = 20_000;

// The scene's flight frame for a flying rig (a mallard), each frame.
{
    const motion = newL2Motion("mallard", "bird", 0.3);
    rows.push(time("l2FlightFrame (a flying rig: clip, phase, bank, heave)", N, (i) => {
        l2FlightFrame(motion, 0.58, {has: () => true, clipHz: () => 4, current: "flap", phase: 0.3, climb: 0.02, turn: 0.4 * Math.sin(i * 0.01), speed: 6, agl: 8, drawnLength: 0.8, clock: i / 60, seed: 0.3, dt: 1 / 60});
    }));
}
// The body channel for a near swimmer and a snake (every near animal with a wave, each frame).
{
    const fish = newL2Motion("atlantic-salmon", "fish", 0.2);
    rows.push(time("l2BodyChannel (a near swimmer's wave phase and gain)", N, (i) => void l2BodyChannel(fish, i * 0.01, -1, 0, 1 / 60, 0.7, true)));
    const snake = newL2Motion("eastern-green-mamba", "snake", 0.2);
    rows.push(time("l2BodyChannel (a near snake's crawl, no slip)", N, (i) => void l2BodyChannel(snake, i * 0.007, 0, 0, 1 / 60, 1.4, false)));
    rows.push(time("l2SurfaceGuard (a swimmer in its band)", N, (i) => void l2SurfaceGuard(fish, -1.2 - (i % 7) * 0.01, 0.3, 1.2, 0.1, 0)));
}

// The drivers on real rigs (L1's CPU pose layer, rigged animals near the camera only).
const driverRow = (label: string, slug: string, driver: typeof flightDriver, clip: string, move: number) => {
    const f = fixture(slug);
    const rig = buildLocoRig(f);
    const rows0 = f.clips[clip].rows as number[][];
    const world = rig.bones.map(() => new Matrix4());
    const state = driver.init(rig);
    const instance = new Matrix4();
    const input: LocoInput = {instance, scale: 1, yaw: 0, dt: 1 / 60, clock: 0, seed: 0.3, ground: () => ({height: 0, nx: 0, ny: 1, nz: 0}), grounded: clip === "slither", clipNow: clip, clipFrom: null, clipPhase: 0};
    rows.push(time(label, N, (i) => {
        input.clock = i / 60;
        input.clipPhase = (i % rows0.length) / (rows0.length - 1);
        instance.makeTranslation(0, 0, move * i);
        if (driver.base?.(rig, input) === "rest") rig.bones.forEach((b, k) => world[k].copy(b.restWorld));
        else rowToWorld(rig, rows0[i % rows0.length], 0, world);
        driver.pose(rig, input, world, state);
    }));
};
driverRow("flightDriver (flap: upstroke fold, head level), golden eagle", "golden-eagle", flightDriver, "flap", 0.1);
OPEN_WING_RIGS.add("monarch-butterfly");
driverRow("flightDriver (open-winged insect: wings beaten), monarch", "monarch-butterfly", flightDriver, "glide", 0.02);
driverRow("chainDriver (snake laid on its track), green mamba", "eastern-green-mamba", chainDriver, "slither", 0.005);
driverRow("chainDriver (sidewinding), sidewinder", "sidewinder", chainDriver, "slither", 0.005);
driverRow("chainDriver (whale flukes), blue whale", "blue-whale", chainDriver, "swim", 0.01);

const width = Math.max(...rows.map((r) => r.label.length));
console.log(`${"call".padEnd(width)}  median µs  p95 µs`);
for (const r of rows) console.log(`${r.label.padEnd(width)}  ${String(r.median).padStart(9)}  ${String(r.p95).padStart(6)}`);
if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
