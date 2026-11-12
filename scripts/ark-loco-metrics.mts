/**
 * Locomotion metrics before and after (lane L1), on real rig files, and the CI fixtures.
 *
 *   npx tsx scripts/ark-loco-metrics.mts --set ~/animaldex-talking-models/rig/publish-v2 [--slugs a,b] [--out dir] [--fixtures]
 *
 * For each species and scenario (`locomotion/sim.ts`: walk, trot, run, accel, turn, spin, slope, steps) it runs
 * "before" (the baked clips played by the distance moved, as the scene played them: walk or run by pace, idle
 * standing, the instance's mesh floor on the ground at its middle) and "after" (the legged driver), and measures
 * both the same way (`locomotion/metrics.ts`). `--fixtures` writes each species' skeleton (bones, rest matrices, the
 * foot-carried vertices and the mesh's corners) to src/ark-scene/locomotion/fixtures/ for the CI test.
 * Reads local files only; nothing is uploaded.
 */

import {mkdirSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {Matrix4, type SkinnedMesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {clipRows, cyclesFor, paceClip, rawSkeletonOf, restGeometry, withCycleSpeed, type RigClipData} from "../src/ark-scene/rig-player";
import {decodeRigEntry} from "../src/ark-scene/rig-clips";
import {buildLocoRig, rowToWorld, type RawSkeleton} from "../src/ark-scene/locomotion/skeleton";
import {bakedRow} from "../src/ark-scene/locomotion/layer";
import {SCENARIOS, leggedPoser, simulate, type Poser, type Scenario} from "../src/ark-scene/locomotion/sim";
import type {LocoRig} from "../src/ark-scene/locomotion/types";

const arg = (name: string, fallback: string | null = null) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const home = os.homedir();
const set = path.resolve((arg("set", path.join(home, "animaldex-talking-models/rig/publish-v2")) as string).replace(/^~/, home));
const out = path.resolve((arg("out", path.join(home, "animaldex-ark-handover-2026-11-11/ark/motion/L1/metrics")) as string).replace(/^~/, home));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** The 20 golden species (body plans) and their true lengths (m). */
export const GOLDEN: Record<string, number> = {
    "red-deer": 2.0,
    "plains-zebra": 2.3,
    "african-lion": 2.2,
    cheetah: 1.3,
    "domestic-dog": 0.9,
    "african-bush-elephant": 6.0,
    giraffe: 4.5,
    "brown-bear": 2.2,
    "house-mouse": 0.085,
    chimpanzee: 0.9,
    ostrich: 2.1,
    "domestic-chicken": 0.45,
    mallard: 0.58,
    "emperor-penguin": 1.15,
    "komodo-dragon": 2.6,
    "aldabra-giant-tortoise": 1.2,
    "american-bullfrog": 0.18,
    "black-ant": 0.009,
    "carolina-wolf-spider": 0.035,
    "coconut-crab": 0.4
};
const slugs = (arg("slugs") ?? Object.keys(GOLDEN).join(",")).split(",").filter(Boolean);

type Loaded = {raw: RawSkeleton; rig: LocoRig; data: Uint16Array; clips: Record<string, RigClipData>; bones: number};

async function load(slug: string): Promise<Loaded> {
    const dir = path.join(set, slug);
    const file = readdirSync(dir).find((n) => n.endsWith(".rig.glb"));
    if (!file) throw new Error(`no rig for ${slug}`);
    const buffer = readFileSync(path.join(dir, file));
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const gltf = await loader.parseAsync(ab, "");
    const extras = (gltf.parser.json as {extras: {ark_rig: {bufferView: number; bones: string[]; rows: number; rig: unknown}}}).extras.ark_rig;
    const entry = decodeRigEntry(extras.rig);
    if (!entry) throw new Error("no entry");
    let mesh: SkinnedMesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
        if (!mesh && (o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh;
    });
    if (!mesh) throw new Error("no skinned mesh");
    const geometry = restGeometry(mesh, extras.bones);
    const raw = rawSkeletonOf(mesh, extras.bones, geometry, slug, entry);
    const view = (await gltf.parser.getDependency("bufferView", extras.bufferView)) as ArrayBuffer;
    const data = new Uint16Array(view.slice(0));
    const clips: Record<string, RigClipData> = {};
    for (const [name, clip] of Object.entries((entry.clips ?? {}) as Record<string, RigClipData>)) {
        if (!clip || clip.pass === false) continue;
        clips[name] = withCycleSpeed({...clip, name, row: Number(clip.row), rows: Number(clip.rows)}, Number(entry.version) || 1);
    }
    return {raw, rig: buildLocoRig(raw), data, clips, bones: extras.bones.length};
}

/** The scene's old way: walk or run (or hop) by the distance moved (phase capped at 3.5× its pace), idle standing. */
function bakedPoser(loaded: Loaded): Poser {
    let now: {name: string; phase: number} = {name: "idle", phase: 0};
    let pace = 0;
    const row = new Float32Array(loaded.bones * 12);
    const gaits = ["walk", "run", "hop", "slither"].map((n) => loaded.clips[n]).filter((c): c is RigClipData => Boolean(c));
    return (rig, input, world, moved) => {
        const movedUnits = moved / input.scale;
        if (input.dt > 0) pace += (movedUnits / input.dt - pace) * Math.min(input.dt * 5, 1);
        const pick = paceClip(pace, gaits, now.name);
        const moving = pick && pace > pick.ground_speed! * (now.name === pick.name ? 0.12 : 0.3);
        const want = moving ? pick!.name : loaded.clips.idle ? "idle" : null;
        if (want && want !== now.name) now = {name: want, phase: 0.37};
        const clip = want ? loaded.clips[want] : null;
        if (clip) {
            if (moving) now.phase += Math.min(cyclesFor(clip, movedUnits), (input.dt / clip.seconds) * 3.5);
            else now.phase += input.dt / clip.seconds;
            bakedRow(loaded.data, loaded.bones, clipRows(clip, now.phase), null, 0, row);
        } else bakedRow(loaded.data, loaded.bones, null, null, 0, row);
        rowToWorld(rig, row, 0, world);
        return {down: null, gait: null};
    };
}

/** A compact fixture: the skeleton and only the mesh the CI needs (the foot-carried vertices and the mesh's corners). */
function fixtureOf(raw: RawSkeleton): unknown {
    const feet = new Set(raw.bones.map((n, i) => (/_foot$/.test(n) ? i : -1)).filter((i) => i >= 0));
    const positions: number[] = [];
    const joints: number[] = [];
    const weights: number[] = [];
    const count = raw.positions.length / 3;
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) {
        const p = [raw.positions[i * 3], raw.positions[i * 3 + 1], raw.positions[i * 3 + 2]];
        min = min.map((m, k) => Math.min(m, p[k]));
        max = max.map((m, k) => Math.max(m, p[k]));
        let w = 0;
        for (let k = 0; k < 4; k++) if (feet.has(raw.joints[i * 4 + k])) w += raw.weights[i * 4 + k];
        if (w < 0.25) continue;
        positions.push(...p.map((v) => Math.round(v * 1e5) / 1e5));
        for (let k = 0; k < 4; k++) {
            joints.push(raw.joints[i * 4 + k]);
            weights.push(Math.round(raw.weights[i * 4 + k] * 1000) / 1000);
        }
    }
    // The mesh's corners, carrying no weight (extents only).
    for (const p of [min, max]) {
        positions.push(...p.map((v) => Math.round(v * 1e5) / 1e5));
        joints.push(0, 0, 0, 0);
        weights.push(0, 0, 0, 0);
    }
    return {slug: raw.slug, plan: raw.plan, pose: raw.pose ?? null, bones: raw.bones, parents: raw.parents, rest: raw.rest.map((m) => m.map((v) => Math.round(v * 1e6) / 1e6)), positions, joints, weights};
}

mkdirSync(out, {recursive: true});
const fixtures = path.join(root, "src/ark-scene/locomotion/fixtures");
if (flag("fixtures")) mkdirSync(fixtures, {recursive: true});
const scenarios = (arg("scenarios") ?? SCENARIOS.join(",")).split(",") as Scenario[];
const report: Record<string, unknown> = {};
for (const slug of slugs) {
    let loaded: Loaded;
    try {
        loaded = await load(slug);
    } catch (error) {
        console.log(slug, "skipped:", error instanceof Error ? error.message : error);
        continue;
    }
    const {rig} = loaded;
    if (flag("fixtures")) writeFileSync(path.join(fixtures, `${slug}.json`), JSON.stringify(fixtureOf(loaded.raw)));
    const length = GOLDEN[slug] ?? 1;
    const scale = length / Math.max(rig.length, rig.height, 1e-6);
    const rows: Record<string, unknown> = {};
    for (const scenario of scenarios) {
        const before = simulate(rig, scenario, scale, bakedPoser(loaded));
        const after = simulate(rig, scenario, scale, leggedPoser());
        rows[scenario] = {before: before.metrics, after: after.metrics, gaits: after.gaits};
        const b = before.metrics;
        const a = after.metrics;
        console.log(`${slug.padEnd(24)} ${scenario.padEnd(6)} slide ${String(b.slideMeanMm).padStart(7)} -> ${String(a.slideMeanMm).padStart(6)} mm  stride ${String(b.strideMismatch).padStart(6)} -> ${String(a.strideMismatch).padStart(5)}  height ${String(b.footHeightMm).padStart(6)} -> ${String(a.footHeightMm).padStart(5)} mm  joints ${String(b.jointViolations).padStart(6)} -> ${String(a.jointViolations).padStart(6)}  ${after.gaits.join(">")}`);
    }
    report[slug] = {plan: rig.plan, legs: rig.legs.length, hipM: Math.round(rig.legHeight * scale * 1000) / 1000, lengthM: length, missing: rig.missing, sitting: rig.sitting, scenarios: rows};
}
writeFileSync(path.join(out, `metrics${arg("label") ? "-" + arg("label") : ""}.json`), JSON.stringify(report, null, 1));
console.log("wrote", out);
void Matrix4;
