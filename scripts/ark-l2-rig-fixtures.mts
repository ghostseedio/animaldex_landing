#!/usr/bin/env -S npx tsx
/**
 * Small rig fixtures for lane L2's driver metrics in CI (`src/lib/ark-motion-l2-drivers.test.ts`): a few real rigs
 * from the local v2 set (`~/animaldex-talking-models/rig/publish-v2`), their skeleton (as `rig-player.ts`
 * rawSkeletonOf reads it), a decimated rest mesh (every wing, chain and head vertex, one in five of the rest) and the
 * baked rows of the clips the drivers start from. Read-only on the rig set; writes `src/lib/__fixtures__/ark-l2/`.
 *
 *   npx tsx scripts/ark-l2-rig-fixtures.mts [--set <dir>] mallard golden-eagle monarch-butterfly sidewinder blue-whale
 */

import fs from "node:fs";
import path from "node:path";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type {SkinnedMesh} from "three";
import {halfToFloat, rawSkeletonOf, restGeometry} from "@/ark-scene/rig-player";

const args = process.argv.slice(2);
const setAt = args.indexOf("--set");
const set = setAt >= 0 ? args[setAt + 1] : path.join(process.env.HOME ?? "", "animaldex-talking-models/rig/publish-v2");
const slugs = args.filter((a, i) => a !== "--set" && (setAt < 0 || i !== setAt + 1));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "src/lib/__fixtures__/ark-l2");
fs.mkdirSync(out, {recursive: true});
await MeshoptDecoder.ready;
const CLIPS = ["flap", "glide", "slither", "swim"];
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

for (const slug of slugs) {
    const dir = path.join(set, slug);
    const file = fs.readdirSync(dir).find((f) => f.endsWith(".rig.glb"));
    if (!file) throw new Error(`${slug}: no rig file`);
    const buf = fs.readFileSync(path.join(dir, file));
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
    const ex = (gltf.parser.json as {extras: {ark_rig: {bufferView: number; bones: string[]; rows: number; rig: {plan: string; pose: string | null; clips: Record<string, {row: number; rows: number; seconds: number; flap_hz?: number; ground_speed?: number}>}}}}).extras.ark_rig;
    const view = (await gltf.parser.getDependency("bufferView", ex.bufferView)) as ArrayBuffer;
    const data = new Uint16Array(view);
    let mesh: SkinnedMesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
        if (!mesh && (o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh;
    });
    if (!mesh) throw new Error(`${slug}: no skinned mesh`);
    const geometry = restGeometry(mesh, ex.bones);
    const raw = rawSkeletonOf(mesh, ex.bones, geometry, slug, {plan: ex.rig.plan, pose: ex.rig.pose});
    // Every wing vertex (the fold is measured on them); a chain rig one in four (its bones carry the whole body).
    const keep = new Set(ex.bones.map((b, i) => (/^wing/.test(b) ? i : -1)).filter((i) => i >= 0));
    const positions: number[] = [];
    const joints: number[] = [];
    const weights: number[] = [];
    const count = raw.positions.length / 3;
    for (let i = 0; i < count; i++) {
        let best = 0;
        let bw = -1;
        for (let k = 0; k < 4; k++) if (raw.weights[i * 4 + k] > bw) (bw = raw.weights[i * 4 + k]), (best = raw.joints[i * 4 + k]);
        if (!keep.has(best) && i % (raw.plan === "legless" || raw.plan === "fish" ? 4 : 5)) continue;
        for (let k = 0; k < 3; k++) positions.push(r5(raw.positions[i * 3 + k]));
        for (let k = 0; k < 4; k++) {
            joints.push(raw.joints[i * 4 + k]);
            weights.push(r5(raw.weights[i * 4 + k]));
        }
    }
    const clips: Record<string, {seconds: number; flap_hz?: number; ground_speed?: number; rows: number[][]}> = {};
    for (const name of CLIPS) {
        const clip = ex.rig.clips[name];
        if (!clip) continue;
        const rows: number[][] = [];
        for (let r = 0; r < clip.rows; r++) {
            const base = (clip.row + r) * ex.bones.length * 12;
            rows.push(Array.from(data.subarray(base, base + ex.bones.length * 12), (h) => r5(halfToFloat(h))));
        }
        clips[name] = {seconds: clip.seconds, ...(clip.flap_hz ? {flap_hz: clip.flap_hz} : {}), ...(clip.ground_speed ? {ground_speed: clip.ground_speed} : {}), rows};
    }
    const fixture = {slug, plan: raw.plan, pose: raw.pose, bones: raw.bones, parents: raw.parents, rest: raw.rest.map((m) => m.map(r5)), positions, joints, weights, clips};
    fs.writeFileSync(path.join(out, `${slug}.json`), JSON.stringify(fixture));
    console.log(`${slug}: ${raw.bones.length} bones, ${positions.length / 3} of ${count} vertices, clips ${Object.keys(clips).join(", ")}, ${(fs.statSync(path.join(out, `${slug}.json`)).size / 1024).toFixed(0)} KB`);
}
