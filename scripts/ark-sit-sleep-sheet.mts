#!/usr/bin/env -S npx tsx
/**
 * Lane ark-sleep: the primates' posed sit (`locomotion/sit-sleep-pose.ts`) on the fixture rigs, drawn side on as the
 * mesh's skinned points (an SVG per rig: rest grey, sitting dark), to look at without a browser.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-sit-sleep-sheet.mts <out dir> [rig.json ...]
 */
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {Matrix4, Vector3} from "three";
import {buildLocoRig, restInverses, type RawSkeleton} from "../src/ark-scene/locomotion/skeleton.ts";
import {SitSleepPose} from "../src/ark-scene/locomotion/sit-sleep-pose.ts";

const [out, ...files] = process.argv.slice(2);
const list = files.length ? files : [path.join(process.cwd(), "src/ark-scene/locomotion/fixtures/chimpanzee.json")];
for (const file of list) {
    const raw = JSON.parse(readFileSync(file, "utf8")) as RawSkeleton & {positions: number[]; joints: number[]; weights: number[]};
    const rig = buildLocoRig(raw);
    const sit = new SitSleepPose(rig, raw);
    const skin = (world: Matrix4[]) => {
        const inv = restInverses(rig);
        const m = world.map((w, b) => new Matrix4().multiplyMatrices(w, inv[b]));
        const pts: Vector3[] = [];
        for (let i = 0; i < raw.positions.length / 3; i++) {
            const v = new Vector3();
            for (let k = 0; k < 4; k++) {
                const w = raw.weights[i * 4 + k];
                if (w > 0) v.add(new Vector3(raw.positions[i * 3], raw.positions[i * 3 + 1], raw.positions[i * 3 + 2]).applyMatrix4(m[raw.joints[i * 4 + k]]).multiplyScalar(w));
            }
            pts.push(v);
        }
        return pts;
    };
    const rest = skin(rig.bones.map((b) => b.restWorld.clone()));
    const posed = skin(sit.pose(1, rig.bones.map(() => new Matrix4())));
    const restBones = rig.bones.map((b) => new Vector3().setFromMatrixPosition(b.restWorld));
    const posedWorld = sit.pose(1, rig.bones.map(() => new Matrix4()));
    const posedBones = posedWorld.map((m) => new Vector3().setFromMatrixPosition(m));
    const all = [...restBones, ...posedBones];
    const minZ = Math.min(...all.map((p) => p.z));
    const maxZ = Math.max(...all.map((p) => p.z));
    const minY = Math.min(...all.map((p) => p.y));
    const maxY = Math.max(...all.map((p) => p.y));
    const s = Math.min(360 / (maxY - minY), 370 / (maxZ - minZ));
    const X = (p: Vector3, dz = 0) => (20 + (p.z + dz - minZ) * s).toFixed(1);
    const Y = (p: Vector3) => (380 - (p.y - minY) * s).toFixed(1);
    const line = (a: Vector3, b: Vector3, dz: number, c: string) => `<line x1="${X(a, dz)}" y1="${Y(a)}" x2="${X(b, dz)}" y2="${Y(b)}" stroke="${c}" stroke-width="3"/>`;
    const legOf = (i: number) => rig.legs.find((l) => [l.upper, ...rig.below[l.upper]].includes(i));
    const headSet = new Set(rig.head >= 0 ? [rig.neck >= 0 ? rig.neck : rig.head, ...rig.below[rig.neck >= 0 ? rig.neck : rig.head]] : []);
    const colour = (i: number) => (headSet.has(i) ? "#c33" : legOf(i)?.end === "fore" ? "#36c" : legOf(i)?.end === "hind" ? "#3a3" : rig.tail.includes(i) ? "#a6c" : "#222");
    const dot = (p: Vector3, fill: string) => `<circle cx="${(20 + (p.z - minZ) * s).toFixed(1)}" cy="${(380 - (p.y - minY) * s).toFixed(1)}" r="2.2" fill="${fill}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="white"/><line x1="0" x2="800" y1="${380 - (Math.min(...rest.map((p) => p.y)) - minY) * s}" y2="${380 - (Math.min(...rest.map((p) => p.y)) - minY) * s}" stroke="#b55"/>` +
        rest.map((p) => dot(p, "#ccc")).join("") + posed.map((p) => dot(new Vector3(p.x, p.y, p.z + (maxZ - minZ) * 1.1), "#99a")).join("") +
        rig.bones.map((b, i) => (b.parent < 0 ? "" : line(restBones[b.parent], restBones[i], 0, colour(i)) + line(posedBones[b.parent], posedBones[i], (maxZ - minZ) * 1.1, colour(i)))).join("") +
        `<text x="10" y="20" font-size="14">${raw.slug}: rest (grey), posed sit asleep (dark); check ${JSON.stringify(sit.check)}</text></svg>`;
    writeFileSync(path.join(out, `${raw.slug}.svg`), svg);
    console.log(raw.slug, JSON.stringify(sit.check));
}
