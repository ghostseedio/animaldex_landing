#!/usr/bin/env -S npx tsx
/**
 * PERF-WEB audit (FRAME-2 verifier, untracked): the wild island's behaviour world build (`ScheduleWorldBuild`, v2) as
 * the scene runs it, every task call timed. Prints the calls' count and sizes, and how many frames the build takes
 * under a per-frame budget checked between calls (SlicedBuild's rule: at least one call a frame), and with only a
 * floor of one call every N frames. Read-only: it patches SlicedBuild.prototype.step in this process only.
 *
 *   npx tsx scripts/.audit-frameloop-v2-tasks.mts
 */
import {setArkWorld} from "@/ark-scene/world";

setArkWorld("v2");
const {SlicedBuild} = await import("@/ark-scene/behaviour-build");
const {allAttachPoints} = await import("@/ark-scene/sampler");
const {ScheduleWorldBuild} = await import("@/ark-scene/behaviour-schedule");

const calls: number[] = [];
type Inner = {result: unknown; index: number; tasks: Array<() => boolean>; finish: () => unknown; slices: number; spentMs: number};
(SlicedBuild.prototype as unknown as {step: (budgetMs: number) => unknown}).step = function (this: Inner, budgetMs: number) {
    if (this.result !== null) return this.result;
    const started = performance.now();
    this.slices++;
    do {
        if (this.index >= this.tasks.length) break;
        const t = performance.now();
        if (this.tasks[this.index]()) this.index++;
        calls.push(performance.now() - t);
    } while (performance.now() - started < budgetMs);
    if (this.index >= this.tasks.length) this.result = this.finish();
    this.spentMs += performance.now() - started;
    return this.result;
};

// The scene prepares the attach points first (`prepareAttachPoints`, its own slices), then builds the world.
const a0 = performance.now();
allAttachPoints();
const attachMs = performance.now() - a0;
const build = new ScheduleWorldBuild();
const w0 = performance.now();
build.run();
const worldMs = performance.now() - w0;

const sorted = [...calls].sort((x, y) => x - y);
const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
const total = calls.reduce((s, x) => s + x, 0);
/** Frames under a budget checked between calls (at least one call a frame). */
const framesAt = (budget: number) => {
    let frames = 0;
    let i = 0;
    while (i < calls.length) {
        frames++;
        let spent = 0;
        do {
            spent += calls[i++];
        } while (i < calls.length && spent < budget);
    }
    return frames;
};
console.log(JSON.stringify({
    attachMs: Math.round(attachMs),
    worldMs: Math.round(worldMs),
    calls: calls.length,
    callsMs: Math.round(total),
    callMs: {p50: +q(0.5).toFixed(2), p90: +q(0.9).toFixed(2), p99: +q(0.99).toFixed(2), max: +sorted[sorted.length - 1].toFixed(1)},
    framesAtBudget: {"6": framesAt(6), "3": framesAt(3), "2": framesAt(2), "1": framesAt(1)},
    framesFloorOneCallEvery4: calls.length * 4
}, null, 1));
