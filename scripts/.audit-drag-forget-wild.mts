/**
 * PERF-WEB audit (drag lane, 2026-11-27), untracked helper: what one `forgetSchedules()` costs on the WILD island.
 *
 * The wild island's animals of the real snapshot laid out and wired as the scene wires them (`lib/ark-collide/sim.ts`
 * buildSim: placement, groups, spacing, threats, recipes), on the v2 world. A subset of `--live` scheduled animals (the
 * high tier's live budget is 1,200; picked by a hash of the id, as a rotation would be: not the nearest), stepped at
 * 60 fps on the island clock (tripAt + poseOnTrip, as the scene's schedulePose), then:
 *   - steady ms a frame (warm);
 *   - forgetSchedules(), every one's first step at once (a recording's path);
 *   - forgetSchedules(), first steps gated as index.ts gates them (WARM_MS = 6: a first step only while the frame's
 *     first steps so far are under 6 ms): frames until all are warm, ms a frame meanwhile, the costliest first step.
 * Output only; nothing written.
 *
 *   npx tsx scripts/.audit-drag-forget-wild.mts --snapshot <voyage.json> [--live 1200] [--warm 20]
 */
import {readFileSync} from "node:fs";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {setArkWorld} from "@/ark-scene/world";
import {forgetSchedules, poseOnTrip, tripAt} from "@/ark-scene/behaviour-schedule";

const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
if (!snapshot) throw new Error("no snapshot");
setArkWorld("v2");
const liveCount = Number(arg("live", "1200"));
const warmSeconds = Number(arg("warm", "20"));
const from = Number(arg("from", "1796032800"));
const fps = 60;
const WARM_MS = 6;

const wild = arkIslandSnapshot(snapshot, "wild");
const t0 = performance.now();
const {buildSim} = await import("@/lib/ark-collide/sim");
const sim = buildSim(wild.animals, {arkDay: snapshot.ark_day ?? null});
const buildMs = performance.now() - t0;
const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
};
const scheduled = sim.animals.filter((s) => s.sched);
const live = scheduled.slice().sort((a, b) => hash(a.a.id) - hash(b.a.id)).slice(0, liveCount);
const stepOne = (s: (typeof live)[number], epoch: number) => {
    const trip = tripAt(sim.world, s.profile, s.sched!, epoch, sim.hoursAt, s.a.activity);
    poseOnTrip(sim.world, trip, epoch);
};
const pct = (list: number[], q: number) => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
const r1 = (v: number) => Math.round(v * 10) / 10;

let f = 0;
const c0 = performance.now();
for (const s of live) stepOne(s, from);
const coldStartMs = performance.now() - c0;
const steady: number[] = [];
for (; f < warmSeconds * fps; f++) {
    const e = from + f / fps;
    const s0 = performance.now();
    for (const s of live) stepOne(s, e);
    if (f > (warmSeconds - 5) * fps) steady.push(performance.now() - s0);
}
// (a) all at once
forgetSchedules();
const a0 = performance.now();
for (const s of live) stepOne(s, from + f / fps);
const allAtOnceMs = performance.now() - a0;
f++;
for (let w = 0; w < 5 * fps; w++, f++) for (const s of live) stepOne(s, from + f / fps);
// (b) gated
forgetSchedules();
const warm = new Set<unknown>();
const frameMs: number[] = [];
const firstSteps: number[] = [];
let frames = 0;
while (warm.size < live.length && frames < 120 * fps) {
    const e = from + f / fps;
    let spent = 0;
    const s0 = performance.now();
    for (const s of live) {
        if (warm.has(s)) {
            stepOne(s, e);
            continue;
        }
        if (spent > WARM_MS) continue;
        const p = performance.now();
        stepOne(s, e);
        const ms = performance.now() - p;
        spent += ms;
        firstSteps.push(ms);
        warm.add(s);
    }
    frameMs.push(performance.now() - s0);
    frames++;
    f++;
}
console.log(JSON.stringify({
    wildAnimals: wild.animals.length,
    scheduled: scheduled.length,
    live: live.length,
    buildSimMs: Math.round(buildMs),
    coldStartAllAtOnceMs: Math.round(coldStartMs),
    steadyMsPerFrame: {p50: r1(pct(steady, 0.5)), p95: r1(pct(steady, 0.95)), max: r1(pct(steady, 1))},
    afterForget: {
        allAtOnceMs: Math.round(allAtOnceMs),
        gated: {framesUntilAllWarm: frames, seconds60fps: r1(frames / fps), msPerFrame: {p50: r1(pct(frameMs, 0.5)), p95: r1(pct(frameMs, 0.95)), max: r1(pct(frameMs, 1))}, framesOver16ms: frameMs.filter((v) => v > 16.7).length, framesOver50ms: frameMs.filter((v) => v > 50).length, totalMs: Math.round(frameMs.reduce((a, b) => a + b, 0))},
        firstStepMs: {p50: r1(pct(firstSteps, 0.5)), p95: r1(pct(firstSteps, 0.95)), p99: r1(pct(firstSteps, 0.99)), max: r1(pct(firstSteps, 1)), sum: Math.round(firstSteps.reduce((a, b) => a + b, 0))}
    }
}, null, 1));
