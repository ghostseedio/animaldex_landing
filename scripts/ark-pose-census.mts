/**
 * ARK-POSE: the lying gate and the neck gate on every mammal rig of a folder of rig files (the live set's), each loaded
 * as the page loads it (`prepareRigPoses`). A line of JSON per rig: what it lies in and each lying clip it keeps against
 * `pose-gate.ts`, and the neck's stretch under the look, under each clip alone, and under each clip with the look on
 * top (`neck-gate.ts`).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-pose-census.mts <dir> <out.jsonl> [--part k/n] [--slugs a,b] [--off]
 *
 * `--off`: the load as it was before this lane (`__arkPoseGate = false`), for the before numbers.
 */
import {appendFileSync, existsSync, readdirSync, rmSync} from "node:fs";
import {loadRig} from "./ark-pose-lib.mts";
import {floatRow, measureLyingClip} from "@/ark-scene/locomotion/pose-gate";
import {headTurnDeg, neckRegion, neckStretch, restRow, worstLook} from "@/ark-scene/locomotion/neck-gate";
import {clipBase} from "@/ark-scene/rig-player";

const [dir, out] = process.argv.slice(2);
const opt = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : null;
};
if (process.argv.includes("--off")) (globalThis as {__arkPoseGate?: boolean}).__arkPoseGate = false;
const only = opt("slugs")?.split(",") ?? null;
const [part, parts] = (opt("part") ?? "0/1").split("/").map(Number);
if (existsSync(out)) rmSync(out);
const DEG = 180 / Math.PI;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const files = readdirSync(dir).filter((f) => f.endsWith(".glb")).sort();
for (let i = 0; i < files.length; i++) {
    const slug = files[i].replace(/\.glb$/, "");
    if (only ? !only.includes(slug) : i % parts !== part) continue;
    try {
        const r = await loadRig(`${dir}/${files[i]}`, slug);
        const plan = r.entry.plan;
        if (plan !== "quadruped" && plan !== "primate") continue;
        const ground = r.geometry.boundingBox!.min.y;
        const lying: Record<string, unknown> = {};
        if (plan === "quadruped") {
            const seen = new Set<number>();
            for (const [name, clip] of Object.entries(r.clips)) {
                if (clipBase(clip) !== "lying" || seen.has(clip.row)) continue;
                seen.add(clip.row);
                const m = measureLyingClip(r.rig, r, r.data, r.bones, clip, ground);
                lying[name] = {shoulder: r3(m.shoulder), rump: r3(m.rump), frontGap: r3(m.frontGap), rearGap: r3(m.rearGap), bellyRear: r3(m.bellyRear), bellyFront: r3(m.bellyFront), pawOverHip: r3(m.pawOverHip), legAir: r3(m.legAir), ok: m.ok, reason: m.reason};
            }
        }
        const region = neckRegion(r.rig, r, r.index);
        const neck: Record<string, unknown> = {};
        if (region) {
            // (The look as the page keeps it: fitted under the gate, the file's own with `--off`.)
            const look = r.prepared.look ?? r.look;
            neck.fit = r.prepared.neck?.fit ?? null;
            neck.shares = r.prepared.neck?.shares ?? null;
            neck.clipYaw = r.prepared.neck?.clipYaw ?? null;
            const caps = look ? {yaw: look.yaw * DEG, up: look.up * DEG, down: look.down * DEG} : null;
            if (look && caps) { const w = worstLook(region, r, restRow(r.rig), r.bones, look, look.neckShare, caps); neck.look = r3(w.p99); neck.lookMax = r3(w.max); neck.lookHead = r3(w.head); }
            neck.lookOff = r.lookOff;
            const clips: Record<string, {alone: number; p99: number; turn: number; look?: number}> = {};
            const row = new Float32Array(r.bones * 12);
            for (const [name, clip] of Object.entries(r.clips)) {
                let worst = {alone: 1, p99: 0, turn: 0, at: 0};
                for (let f = 0; f < clip.rows; f += 2) {
                    floatRow(r.data, r.bones, clip.row + f, row);
                    const s = neckStretch(region, r, row);
                    if (s.p99 > worst.p99) worst = {alone: s.max, p99: s.p99, turn: headTurnDeg(r.rig, row), at: f};
                }
                const entry: {alone: number; p99: number; turn: number; look?: number} = {alone: r3(worst.alone), p99: r3(worst.p99), turn: Math.round(worst.turn)};
                // (The look on top of the clip's worst row.)
                if (look && caps) entry.look = r3(worstLook(region, r, floatRow(r.data, r.bones, clip.row + worst.at, row), r.bones, look, look.neckShare, caps, clip.lookShare ?? 1).p99);
                clips[name] = entry;
            }
            neck.clips = clips;
        }
        appendFileSync(out, JSON.stringify({slug, plan, code: r.entry.code, posedLie: r.prepared.posedLie, chose: r.prepared.lying?.chose ?? null, sit: r.prepared.sit, own: r.prepared.lying?.own ? {rump: r3(r.prepared.lying.own.rump), ok: r.prepared.lying.own.ok, reason: r.prepared.lying.own.reason} : null, lying, neck}) + "\n");
    } catch (error) {
        appendFileSync(out, JSON.stringify({slug, error: String(error instanceof Error ? error.stack : error)}) + "\n");
    }
}
