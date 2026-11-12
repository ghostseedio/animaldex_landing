#!/usr/bin/env -S npx tsx
/**
 * Lane L2's metrics as numbers (the same measures `src/lib/ark-motion-l2.test.ts` and `ark-motion-l2-drivers.test.ts`
 * guard in CI), before (the scene without L2: the published clips and the talking model's own waves) and after.
 *
 *   npx tsx scripts/ark-motion-l2-metrics.mts [--json]
 */

import fs from "node:fs";
import path from "node:path";
import {Euler, Matrix4, Vector3} from "three";
import {bankAngle, CLIP_BANK, flightRigFrame, flightSpecOf, newFlightMemory, wingbeatHz, decodeFlight} from "@/ark-scene/locomotion/flight";
import {locoStyle, locoStyleSlugs} from "@/ark-scene/locomotion/styles";
import {SWIM, swimCycles, swimHeadroom, swimPaces, swimSurfaceGuard, SWIM_SURFACE_CLEAR, newSwimMemory, tailBeatHz} from "@/ark-scene/locomotion/swim";
import {leglessSlip} from "@/ark-scene/locomotion/legless";
import {buildLocoRig, restInverses, rowToWorld} from "@/ark-scene/locomotion/skeleton";
import {chainDriver, flightDriver} from "@/ark-scene/locomotion/l2-drivers";
import {arkBody} from "@/ark-scene/stats";
import type {LocoInput, LocoRig} from "@/ark-scene/locomotion/types";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out: Record<string, unknown> = {};

// Wing-beat rate against size: the catalogue's birds' fitted exponent; before, the rig's own flap_hz (3·L^-0.6).
{
    const xs: number[] = [];
    const after: number[] = [];
    const before: number[] = [];
    for (const slug of locoStyleSlugs()) {
        const f = locoStyle(slug).flight;
        if (!f || f.kind !== "bird" || f.style === "hover") continue;
        const L = arkBody({model_slug: slug}).metres;
        xs.push(Math.log(L));
        after.push(Math.log(wingbeatHz(f, L)));
        before.push(Math.log(Math.min(Math.max(3 * L ** -0.6, 1.5), 12)));
    }
    const fit = (ys: number[]) => {
        const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const my = ys.reduce((a, b) => a + b, 0) / ys.length;
        return xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    };
    const refs: Array<[string, string, number]> = [["house sparrow", "b", 0.15], ["feral pigeon", "c1.15", 0.32], ["mallard", "c1.35", 0.58], ["barn owl", "g0.75", 0.36], ["grey heron", "g0.8", 0.95], ["golden eagle", "s0.8d", 0.85], ["mute swan", "c1.35", 1.42], ["ruby-throated hummingbird", "h", 0.08]];
    out.wingbeat = {
        birds: xs.length,
        slopeAfter: Math.round(fit(after) * 1000) / 1000,
        slopeBefore: Math.round(fit(before) * 1000) / 1000,
        references: Object.fromEntries(refs.map(([name, code, L]) => [name, {after: Math.round(wingbeatHz(decodeFlight(code)!, L) * 10) / 10, before: Math.round(Math.min(Math.max(3 * L ** -0.6, 1.5), 12) * 10) / 10}]))
    };
}

// Tail-beat rate against speed: after, f = hold + U / stride by the distance swum; before, a fixed rate per species.
{
    const L = 2.5;
    const style = "cetacean" as const;
    const run = (speed: number) => {
        const m = newSwimMemory();
        for (let i = 0; i < 600; i++) swimCycles(m, style, speed / 60, 1 / 60, L);
        return m.cycles / 10;
    };
    const cruise = swimPaces(L, style).cruise;
    out.tailbeat = {
        dolphinCruiseHz: Math.round(run(cruise) * 100) / 100,
        dolphinBurstHz: Math.round(run(cruise * 2.2) * 100) / 100,
        burstOverCruiseAfter: Math.round(((run(cruise * 2.2) - SWIM[style].hold) / (run(cruise) - SWIM[style].hold)) * 100) / 100,
        burstOverCruiseBefore: 1,
        references: {trout03mAt06: tailBeatHz(0.6 / 0.3, "subcarangiform"), blueWhale25mAt25: Math.round(tailBeatHz(2.5 / 25, "cetacean") * 100) / 100, tuna2mAt4: tailBeatHz(4 / 2, "thunniform")}
    };
}

// Water surface: up-and-down swimmers whose flukes break the surface at the top of their band, before and after the guard.
{
    const ASPECT: Record<string, number> = {cetacean: 0.22, sirenian: 0.3, flatfish: 0.12, rajiform: 0.12, mobuliform: 0.12};
    let before = 0;
    let after = 0;
    let checked = 0;
    for (const slug of locoStyleSlugs()) {
        const swim = locoStyle(slug).swim;
        if (!swim || SWIM[swim].axis !== "y") continue;
        checked++;
        const length = arkBody({model_slug: slug}).display;
        const height = length * (ASPECT[swim] ?? 0.25);
        const base = -SWIM_SURFACE_CLEAR - height;
        const lift = swimHeadroom(swim) * length + Math.abs(Math.sin(0.2)) * length * 0.5;
        if (base + height + lift > -1e-6) before++;
        if (swimSurfaceGuard(base, height, length, swim, 0.2, 0) + height + lift > -SWIM_SURFACE_CLEAR + 1e-9) after++;
    }
    out.surface = {upAndDownSwimmers: checked, breachingBefore: before, breachingAfter: after};
}

// Bank against turn rate: the frame's bank (instance roll plus the clip's) against tan φ = v ω / g; before, a fixed 25° clip
// on any turn past 0.12 rad/s and -0.35·(ω/0.2) of instance roll, whatever the speed.
{
    const spec = flightSpecOf(decodeFlight("g"), 0.5)!;
    let worst = 0;
    let worstBefore = 0;
    for (const v of [4, 8, 12]) {
        for (const w of [-0.9, -0.4, -0.15, 0.15, 0.4, 0.9]) {
            const memory = newFlightMemory();
            memory.takeoffAt = -100;
            const frame = flightRigFrame({spec, has: () => true, clipHz: () => 4, current: "glide", phase: 0, climb: 0, turn: w, speed: v, agl: 30, clock: 100, seed: 0.3, dt: 1 / 60, beat: "glide"}, memory);
            const phi = bankAngle(v, w, spec.bankMax);
            const total = -frame.roll + (frame.clip === "bank_l" ? CLIP_BANK : frame.clip === "bank_r" ? -CLIP_BANK : 0);
            worst = Math.max(worst, Math.abs(total - phi));
            const beforeClip = Math.abs(w) > 0.12 ? Math.sign(w) * CLIP_BANK : 0;
            worstBefore = Math.max(worstBefore, Math.abs(beforeClip - phi));
        }
    }
    out.bank = {maxErrorRadAfter: Math.round(worst * 1000) / 1000, maxErrorRadBefore: Math.round(worstBefore * 1000) / 1000};
}

// Rigs: the upstroke fold, the head in a bank, a snake's slip.
{
    type Fixture = {clips: Record<string, {rows: number[][]}>; positions: number[]; joints: number[]; weights: number[]} & Parameters<typeof buildLocoRig>[0];
    const fixture = (slug: string): Fixture => JSON.parse(fs.readFileSync(path.join(root, "src/lib/__fixtures__/ark-l2", `${slug}.json`), "utf8"));
    const clipWorld = (rig: LocoRig, f: Fixture, clip: string, q: number) => {
        const rows = f.clips[clip].rows;
        const at = q * (rows.length - 1);
        const i = Math.floor(at);
        const t = at - i;
        const row = rows[i].map((v, k) => v * (1 - t) + rows[Math.min(i + 1, rows.length - 1)][k] * t);
        const world = rig.bones.map(() => new Matrix4());
        rowToWorld(rig, row, 0, world);
        return world;
    };
    const span = (rig: LocoRig, f: Fixture, world: Matrix4[], bone: number) => {
        const inv = restInverses(rig);
        let most = 0;
        for (let i = 0; i < f.positions.length / 3; i++) {
            let best = -1;
            let bw = -1;
            for (let k = 0; k < 4; k++) if (f.weights[i * 4 + k] > bw) (bw = f.weights[i * 4 + k]), (best = f.joints[i * 4 + k]);
            if (best !== bone) continue;
            const v = new Vector3(f.positions[i * 3], f.positions[i * 3 + 1], f.positions[i * 3 + 2]);
            const acc = new Vector3();
            for (let k = 0; k < 4; k++) if (f.weights[i * 4 + k] > 0) acc.addScaledVector(v.clone().applyMatrix4(new Matrix4().multiplyMatrices(world[f.joints[i * 4 + k]], inv[f.joints[i * 4 + k]])), f.weights[i * 4 + k]);
            most = Math.max(most, Math.abs(acc.x));
        }
        return most;
    };
    const input = (over: Partial<LocoInput>): LocoInput => ({instance: new Matrix4(), scale: 1, yaw: 0, dt: 1 / 60, clock: 10, seed: 0.3, ground: () => ({height: 0, nx: 0, ny: 1, nz: 0}), grounded: false, clipNow: "flap", clipFrom: null, clipPhase: 0, ...over});
    const fold: Record<string, {before: number; after: number}> = {};
    for (const slug of ["mallard", "golden-eagle"]) {
        const f = fixture(slug);
        const rig = buildLocoRig(f);
        const hand = rig.bones.findIndex((b) => b.name === "wingL_hand");
        const at = (q: number, driven: boolean) => {
            const world = clipWorld(rig, f, "flap", q);
            if (driven) flightDriver.pose(rig, input({clipPhase: q}), world, flightDriver.init(rig));
            return span(rig, f, world, hand);
        };
        fold[slug] = {before: Math.round((at(0.75, false) / at(0.25, false)) * 1000) / 1000, after: Math.round((at(0.75, true) / at(0.25, true)) * 1000) / 1000};
    }
    const f = fixture("golden-eagle");
    const rig = buildLocoRig(f);
    const instance = new Matrix4().makeRotationFromEuler(new Euler(0, 0, 0.5));
    const tilt = (world: Matrix4[]) => {
        const m = new Matrix4().multiplyMatrices(instance, new Matrix4().multiplyMatrices(world[rig.head], restInverses(rig)[rig.head]));
        return Math.abs(Math.asin(Math.min(Math.max(new Vector3(1, 0, 0).transformDirection(m).y, -1), 1)));
    };
    const world = clipWorld(rig, f, "glide", 0.3);
    const before = tilt(world);
    flightDriver.pose(rig, input({clipNow: "glide", instance}), world, flightDriver.init(rig));
    out.rigs = {upstrokeOverDownstrokeSpan: fold, headRollIn05RadBank: {before: Math.round(before * 1000) / 1000, after: Math.round(tilt(world) * 1000) / 1000}, lateralSlipModel: Math.round(leglessSlip("lateral") * 1000) / 1000};
    void chainDriver;
}

if (process.argv.includes("--json")) console.log(JSON.stringify(out));
else console.log(JSON.stringify(out, null, 2));
