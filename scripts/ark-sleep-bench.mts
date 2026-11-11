#!/usr/bin/env -S npx tsx
/**
 * What sleep costs on the CPU (docs/ark/sleep.md), in node: the reactive layer with the same 130 animals awake by day
 * and asleep at night (a watch up in each group), per tier; and the sleep layer's own per-animal work each frame
 * (`stepSleepNow`, `sleepDraw`, `lyingDrop`, `packSleep`). The phone proxy is about 4x slower than this machine.
 *
 *   npx tsx scripts/ark-sleep-bench.mts
 */
import {ReactiveLayer, type ReactiveInput, type ReactiveTier} from "@/ark-scene/reactive";
import {intelProfile} from "@/ark-scene/intelligence-profile";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {worldSampler} from "@/ark-scene/world-sampler";
import {reactiveWorldQueries} from "@/ark-scene/reactive-world";
import {ZONE_SITES} from "@/ark-scene/world";
import {lyingDrop, packSleep, sleepDraw, stepSleepNow, type SleepNow} from "@/ark-scene/sleep";

const slugs = ["plains-zebra", "red-deer", "meerkat", "chimpanzee", "african-lion", "eurasian-wolf", "red-squirrel", "house-sparrow"];
const at = ZONE_SITES.grassland;
const make = (night: boolean): ReactiveInput[] =>
    Array.from({length: 130}, (_, i) => {
        const slug = slugs[i % slugs.length];
        const b = behaviourProfile(slug);
        // At night all asleep but one in eight (the watch, and a few night animals).
        const asleep = night && i % 8 !== 0;
        return {
            id: `a${i}`,
            slug,
            plan: intelProfile(slug).plan,
            length: 1.2,
            size: b.size,
            speed: b.speed,
            dominance: b.dominance,
            social: b.social,
            diet: b.diet,
            intel: intelProfile(slug),
            asleep,
            acting: false,
            shared: {x: at.x + (i % 13) * 4 - 26, y: 0, z: at.z + Math.floor(i / 13) * 4 - 20, yaw: i, moving: !asleep && i % 3 === 0, aloft: false, doing: asleep ? "sleep" : night ? "watch" : ["graze", "rest", "forage"][i % 3]}
        };
    });
const q = reactiveWorldQueries(worldSampler(), 8);
const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
console.log("reactive layer, 130 animals, 600 frames (ms per frame, median of CPU time):");
for (const tier of ["high", "medium", "low"] as ReactiveTier[]) {
    const row: string[] = [];
    for (const night of [false, true]) {
        const inputs = make(night);
        const layer = new ReactiveLayer({tier});
        const cpu: number[] = [];
        for (let f = 0; f < 600; f++) {
            for (const i of inputs) if (i.shared.moving) i.shared.x += 0.05;
            const c0 = process.cpuUsage();
            layer.step(inputs, {now: 1000 + f / 30, dt: 1 / 30, hours: night ? 1.5 : 11, night: night ? 1 : 0, weather: {rain: 0, wind: 0.3, windDirection: 0.5, fog: 0, storm: 0}, camera: {x: at.x, y: 3, z: at.z - 30}, sight: q.sight, refuge: q.refuge});
            const c = process.cpuUsage(c0);
            cpu.push((c.user + c.system) / 1000);
        }
        row.push(`${night ? "night (asleep)" : "day (awake)"} ${median(cpu.slice(60)).toFixed(3)}`);
    }
    console.log(`  ${tier}: ${row.join("   ")}`);
}
// The sleep layer per animal: 600 sleeping animals, every frame (the scene steps every entry, draws the visible ones).
const n = 600;
let states: Array<SleepNow | null> = Array.from({length: n}, () => null);
const box = {minX: -0.3, maxX: 0.3, minY: 0, maxY: 1.1};
const t0 = process.cpuUsage();
let sink = 0;
for (let f = 0; f < 600; f++) {
    for (let i = 0; i < n; i++) {
        const id = `s${i}`;
        states[i] = stepSleepNow(states[i], {id, slug: slugs[i % slugs.length], length: 1.5, asleep: f > 30, startled: false, epoch: 5000 + f / 30, dt: 1 / 30, reduced: false});
        const sn = states[i];
        if (sn) {
            const d = sleepDraw(sn, {id, slug: slugs[i % slugs.length], length: 1.5, epoch: 5000 + f / 30, procedural: 1, reduced: false});
            sink += lyingDrop(box, d.legs, d.roll) + packSleep(d.eyes, d.curl, d.flick, d.breath);
        }
    }
}
const used = process.cpuUsage(t0);
console.log(`sleep layer: ${(((used.user + used.system) / 1000) / 600).toFixed(3)} ms per frame for ${n} sleeping animals (${(((used.user + used.system) / (600 * n))).toFixed(2)} µs each)${sink ? "" : " "}`);
states = [];
