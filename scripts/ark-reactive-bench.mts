#!/usr/bin/env -S npx tsx
/**
 * The reactive layer's CPU cost in node (no rendering): 130 animals round the camera, 600 frames, with and without
 * lines of sight, per tier (high acts on the nearest 90 within 70 m, medium 48 within 50 m, low 20 within 32 m).
 * `npx tsx scripts/ark-reactive-bench.mts [high|medium|low]` (default: all three). The phone proxy is about 4x slower.
 */
import {ReactiveLayer, type ReactiveInput, type ReactiveTier} from "@/ark-scene/reactive";
import {intelProfile} from "@/ark-scene/intelligence-profile";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {worldSampler} from "@/ark-scene/world-sampler";
import {reactiveWorldQueries} from "@/ark-scene/reactive-world";
import {ZONE_SITES} from "@/ark-scene/world";
const slugs = ["plains-zebra", "red-deer", "meerkat", "chimpanzee", "african-lion", "eurasian-wolf", "red-squirrel", "house-sparrow"];
const at = ZONE_SITES.grassland;
const inputs: ReactiveInput[] = Array.from({length: 130}, (_, i) => {
  const slug = slugs[i % slugs.length]; const b = behaviourProfile(slug);
  return {id: `a${i}`, slug, plan: intelProfile(slug).plan, length: 1.2, size: b.size, speed: b.speed, dominance: b.dominance, social: b.social, diet: b.diet, intel: intelProfile(slug), asleep: false, acting: false,
    shared: {x: at.x + (i % 13) * 4 - 26, y: 0, z: at.z + Math.floor(i / 13) * 4 - 20, yaw: i, moving: i % 3 === 0, aloft: false, doing: ["graze", "rest", "forage"][i % 3]}};
});
const t0 = performance.now();
const q = reactiveWorldQueries(worldSampler(), 8);
console.log("sampler+queries", (performance.now() - t0).toFixed(1));
const tiers = (process.argv[2] ? [process.argv[2]] : ["high", "medium", "low"]) as ReactiveTier[];
for (const tier of tiers) for (const withSight of [false, true]) {
  const layer = new ReactiveLayer({tier});
  const times: number[] = [];
  // CPU time too: the wall clock on a shared machine counts other processes' turns.
  const cpu: number[] = [];
  for (let f = 0; f < 600; f++) {
    for (const i of inputs) if (i.shared.moving) i.shared.x += 0.05;
    const t = performance.now();
    const c0 = process.cpuUsage();
    layer.step(inputs, {now: 1000 + f / 30, dt: 1 / 30, hours: 10, night: 0, weather: {rain: 0, wind: 0.3, windDirection: 0, fog: 0, storm: 0}, camera: {x: at.x, y: 3, z: at.z - 25}, sight: withSight ? q.sight : undefined, refuge: q.refuge});
    if (f >= 60) {
      times.push(performance.now() - t);
      const c = process.cpuUsage(c0);
      cpu.push((c.user + c.system) / 1000);
    }
  }
  times.sort((a, b) => a - b);
  cpu.sort((a, b) => a - b);
  console.log(tier, withSight ? "with sight" : "no sight", "p50", times[Math.floor(times.length * 0.5)].toFixed(2), "p95", times[Math.floor(times.length * 0.95)].toFixed(2), "| cpu p50", cpu[Math.floor(cpu.length * 0.5)].toFixed(2), "p95", cpu[Math.floor(cpu.length * 0.95)].toFixed(2), JSON.stringify(layer.stats));
}
