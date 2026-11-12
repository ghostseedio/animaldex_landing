/**
 * The locomotion layer's CPU cost per animal (lane L1): every golden species posed for 6 s of a walk/run course at
 * 60 fps through the full layer (baked row, driver, skin row into the live texture), timed. Node on this machine;
 * the browser's numbers come from the rig scenes' --perf run.
 *   npx tsx scripts/ark-loco-bench.mts
 */
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import {Matrix4, Quaternion, Vector3} from "three";
import {buildLocoRig, type RawSkeleton} from "../src/ark-scene/locomotion/skeleton";
import {LocoLayer, newLocoAnimal} from "../src/ark-scene/locomotion/layer";
import {scenarioPath} from "../src/ark-scene/locomotion/sim";
import {terrainGround} from "../src/ark-scene/locomotion/ground";

const dir = path.join(process.cwd(), "src/ark-scene/locomotion/fixtures");
const rows: Array<{slug: string; bones: number; legs: number; usPerFrame: number}> = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const rig = buildLocoRig(JSON.parse(readFileSync(path.join(dir, file), "utf8")) as RawSkeleton);
    const layer = new LocoLayer(rig, new Uint16Array(rig.bones.length * 12 * 2));
    const animal = newLocoAnimal();
    const scale = 1.5 / Math.max(rig.length, rig.height);
    const inst = new Matrix4();
    const frames = 60 * 6;
    // Warm up, then time every frame on its own: the median frame (a shared, loaded machine preempts whole passes).
    const times: number[] = [];
    for (let pass = 0; pass < 3; pass++) {
        for (let f = 0; f < frames; f++) {
            const t = f / 60;
            const p = scenarioPath(f < 180 ? "walk" : "run", rig.gaitLength * scale, rig.length * scale, t);
            const x = 30 + p.x, z = -40 + p.z;
            inst.compose(new Vector3(x, terrainGround(x, z).height - rig.minY * scale, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.yaw), new Vector3(scale, scale, scale));
            const t0 = performance.now();
            layer.pose(animal, {instance: inst, scale, yaw: p.yaw, dt: 1 / 60, clock: 1000 + t + pass * 100, seed: 0.4, ground: terrainGround, grounded: true, clipNow: "walk", clipFrom: null, clipPhase: 0}, [0, 1, 0.5], null, 0, 0);
            if (pass > 0) times.push((performance.now() - t0) * 1000);
        }
    }
    times.sort((a, b) => a - b);
    const best = times[Math.floor(times.length / 2)];
    rows.push({slug: rig.slug, bones: rig.bones.length, legs: rig.legs.length, usPerFrame: Math.round(best * 10) / 10, p90: Math.round(times[Math.floor(times.length * 0.9)] * 10) / 10} as (typeof rows)[number]);
}
const sorted = rows.map((r) => r.usPerFrame).sort((a, b) => a - b);
console.table(rows);
console.log("median us/animal/frame", sorted[Math.floor(sorted.length / 2)], "max", sorted[sorted.length - 1], "-> 24 rigged animals:", ((sorted[Math.floor(sorted.length / 2)] * 24) / 1000).toFixed(2), "ms/frame (median rig), 8 (lite):", ((sorted[Math.floor(sorted.length / 2)] * 8) / 1000).toFixed(2), "ms");
