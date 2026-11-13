/**
 * Frame pacing and resolution on phones (mobile performance lane, docs/ark/perf-audit-mobile-2026-11.md).
 *
 * A phone that cannot hold 60 frames a second drew at whatever it managed (a jittery 35–50), and the only lever was
 * the tier check: frames measured in the first two seconds after the first frame (while the island was still being
 * built and its models coming in) and, if long, a whole tier down for good (no shadows, no finish, less grass). Now,
 * on a touch device, one small controller fed every drawn frame's interval and main-thread work:
 *
 * 1. **The resolution.** When the frames run long but their own work is short (the GPU, not the script, is the
 *    bottleneck: fill rate, the finish's passes), the drawing buffer's scale steps down by 0.1 (to 0.7 of the tier's
 *    pixel ratio at most); it steps back up after 6 s of frames on time, and after a step up that had to be undone the
 *    next step up waits a minute. The picture stays whole; it is only softer.
 * 2. **The rate.** Held at the display's rate while it can (a GPU-bound phone first gives up resolution); when the
 *    median interval over a second still runs past 19 ms, locked to 30 frames a second (a steady 30 beats a jittery
 *    45). It tries the display's rate again only when the frames are light (their work under 9 ms), and waits longer
 *    each time a try fails (8, 16, 32 … 120 s): it never oscillates. The low tier starts locked.
 * 3. **The tier.** Only once the start is over (the scene says `settled`), locked at 30 and at the lowest scale, a
 *    median past 40 ms for 3 s drops a tier, as the old check did.
 *
 * Pure: the clock is passed in. The scene applies what `step` returns.
 */

export type PaceTier = "high" | "medium" | "low";

/** What the scene should do after a frame. */
export type PaceDecision = {
    /** The least ms between drawn frames the pacing asks for (0: the display's rate). */
    interval: number;
    /** The drawing buffer's scale on the tier's pixel ratio (1: as before). */
    scale: number;
    /** Drop a tier now. */
    dropTier: boolean;
    /** Something changed this frame (the scene applies the scale only then). */
    changed: boolean;
};

export const PACE_LOCK_MS = 1000 / 30;
/** The median interval over which the display's rate is not being held (60 Hz: 16.7 ms; a little room for jitter). */
const HOLD_60_MS = 19;
/** Frames whose own work is under this (72% of a 60 Hz frame) may try the display's rate again. */
const LIGHT_WORK_MS = 12;
/** A locked frame later than this (median) is not holding 30 either. */
const HOLD_30_MS = 40;
const WINDOW = 45;
const MIN_SAMPLES = 24;
const JUDGE_EVERY_S = 1;
const RETRY_FIRST_S = 8;
const RETRY_MOST_S = 120;
export const SCALE_STEP = 0.1;
export const SCALE_FLOOR = 0.7;
const SCALE_UP_AFTER_S = 6;
const SCALE_COOLDOWN_S = 1.5;
/** How long a scale found too high at a rate stays out of reach at that rate (s). */
const CEILING_HOLD_S = 90;
const TIER_AFTER_S = 3;
/** Locked at 30 by the script's own work this long once settled: a tier down, for the display's rate. */
const LOCKED_DROP_AFTER_S = 15;

type Rate = "full" | "locked";

export class ArkFramePacer {
    private readonly intervals = new Float64Array(WINDOW);
    private readonly work = new Float64Array(WINDOW);
    private count = 0;
    private at = 0;
    private judgedAt = 0;
    private locked: boolean;
    private failures = 0;
    private retryAt = 0;
    /** When the display rate was last tried again (a failure within a few seconds of it counts against it). */
    private triedAt = -Infinity;
    private scale = 1;
    private changedScaleAt = -Infinity;
    /** Per rate, the scale its frames were late at, and until when it stays out of reach (no bouncing back up). */
    private readonly ceiling: Record<Rate, {scale: number; until: number} | null> = {full: null, locked: null};
    private onTimeSince: number | null = null;
    private slowSince: number | null = null;
    private droppedFor: PaceTier | null = null;
    /** Since when the rate has been locked (s), for the drop that trades the tier's finish for the display's rate. */
    private lockedSince: number | null = null;
    /** The start was over at the last frame (its frames, the world being built, say nothing of the frames to come). */
    private wasSettled = false;

    /** `startLocked`: the low tier on a slow main thread (`tierForCpu`) starts at a steady 30. */
    constructor(private tier: PaceTier, now: number, startLocked = tier === "low") {
        this.locked = startLocked;
        this.lockedSince = startLocked ? now : null;
        this.judgedAt = now;
        this.retryAt = now + RETRY_FIRST_S;
    }

    /**
     * The tier changed (by the power cap, the reader, or a drop): it starts over at the display's rate (a drop is made to
     * reach it); `locked` to start at a steady 30 instead (the power cap's low tier is capped at 30 anyway).
     */
    setTier(tier: PaceTier, now: number, locked = false) {
        if (tier === this.tier) return;
        this.tier = tier;
        this.locked = locked;
        this.lockedSince = locked ? now : null;
        this.failures = 0;
        this.retryAt = now + RETRY_FIRST_S;
        this.ceiling.full = this.ceiling.locked = null;
        this.reset(now);
    }

    /** Forget the frames measured (the start, a pause, a tier change): they say nothing about the frames to come. */
    reset(now: number) {
        this.count = 0;
        this.at = 0;
        this.judgedAt = now;
        this.onTimeSince = null;
        this.slowSince = null;
    }

    get interval(): number {
        return this.locked ? PACE_LOCK_MS : 0;
    }

    get resolution(): number {
        return this.scale;
    }

    /**
     * One drawn frame: `intervalMs` since the one before, `workMs` its own main-thread time; `full` when the governor
     * drew it at full rate (a calm or capped frame says nothing about what the device can hold); `settled` once the
     * start is over (only then may a tier drop). `now` in seconds.
     */
    step(now: number, intervalMs: number, workMs: number, full: boolean, settled: boolean): PaceDecision {
        const keep = (changed = false): PaceDecision => ({interval: this.interval, scale: this.scale, dropTier: false, changed});
        if (!full || !(intervalMs > 0) || intervalMs > 250) return keep();
        if (settled && !this.wasSettled) {
            // The start just ended: what was measured during it is forgotten, and a lock counts from now.
            this.wasSettled = true;
            this.reset(now);
            if (this.locked) this.lockedSince = now;
        }
        this.intervals[this.at] = intervalMs;
        this.work[this.at] = workMs;
        this.at = (this.at + 1) % WINDOW;
        this.count = Math.min(this.count + 1, WINDOW);
        if (this.count < MIN_SAMPLES || now - this.judgedAt < JUDGE_EVERY_S) return keep();
        this.judgedAt = now;
        const interval = median(this.intervals, this.count);
        const work = median(this.work, this.count);
        const rate: Rate = this.locked ? "locked" : "full";
        const target = this.locked ? PACE_LOCK_MS : 1000 / 60;
        const late = interval > (this.locked ? target * 1.12 : HOLD_60_MS);
        const cooled = now - this.changedScaleAt > SCALE_COOLDOWN_S;

        if (late) {
            this.onTimeSince = null;
            // 1. The resolution: late frames with short work (the GPU's, not the script's) give up a step of resolution
            // first; that scale stays out of reach at this rate for a while (no bouncing).
            if (work < target * 0.6 && this.scale > SCALE_FLOOR + 1e-6) {
                if (!cooled) return keep();
                this.ceiling[rate] = {scale: this.scale, until: now + CEILING_HOLD_S};
                this.scale = Math.max(round2(this.scale - SCALE_STEP), SCALE_FLOOR);
                this.changedScaleAt = now;
                this.reset(now);
                return keep(true);
            }
            // 2. The rate: the script is the bottleneck (or the resolution is as low as it goes): a steady 30.
            if (!this.locked) {
                this.locked = true;
                this.lockedSince = now;
                // (A try at the display's rate that failed at once: wait longer before the next.)
                if (now - this.triedAt < RETRY_FIRST_S + 10) this.failures++;
                // (The GPU too slow for 60 even at the lowest resolution: no quick retries.)
                if (this.scale <= SCALE_FLOOR + 1e-6 && work < target * 0.6) this.failures = Math.max(this.failures, 2);
                this.retryAt = now + Math.min(RETRY_FIRST_S * 2 ** this.failures, RETRY_MOST_S);
                this.reset(now);
                return keep(true);
            }
            // 3. The tier: locked, as low as the resolution goes (or the script is the bottleneck), still not holding 30.
            if (settled && this.tier !== "low" && this.droppedFor !== this.tier && interval > HOLD_30_MS) {
                this.slowSince ??= now;
                if (now - this.slowSince >= TIER_AFTER_S) {
                    this.droppedFor = this.tier;
                    this.slowSince = null;
                    return {interval: this.interval, scale: this.scale, dropTier: true, changed: true};
                }
            } else this.slowSince = null;
            return keep();
        }

        this.slowSince = null;
        this.onTimeSince ??= now;
        // On time: back up a step after a while, never to a scale found too high at this rate lately.
        if (this.scale < 1 && cooled && now - this.onTimeSince >= SCALE_UP_AFTER_S) {
            const next = Math.min(round2(this.scale + SCALE_STEP), 1);
            const ceiling = this.ceiling[rate];
            if (!ceiling || now > ceiling.until || next < ceiling.scale - 1e-6) {
                this.scale = next;
                this.changedScaleAt = now;
                this.reset(now);
                return keep(true);
            }
        }
        // Locked and light: the display's rate again, after the wait (longer after each failed try), at a scale under
        // the one last found too high at that rate.
        // Locked a while because the script is the bottleneck (not the GPU: that gave up resolution first): a phone trades the
        // tier's finish (shadows, the miniature's soft edges, grass) for the display's rate, once the start is over.
        if (this.locked && settled && this.tier !== "low" && this.droppedFor !== this.tier && work > (1000 / 60) * 0.6 && this.lockedSince !== null && now - this.lockedSince >= LOCKED_DROP_AFTER_S) {
            this.droppedFor = this.tier;
            return {interval: this.interval, scale: this.scale, dropTier: true, changed: true};
        }
        if (this.locked && now >= this.retryAt && work < LIGHT_WORK_MS) {
            this.locked = false;
            this.lockedSince = null;
            this.triedAt = now;
            const ceiling = this.ceiling.full;
            if (ceiling && now <= ceiling.until && this.scale >= ceiling.scale - 1e-6) {
                this.scale = Math.max(round2(ceiling.scale - SCALE_STEP), SCALE_FLOOR);
                this.changedScaleAt = now;
            }
            this.reset(now);
            return keep(true);
        }
        return keep();
    }
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function median(values: Float64Array, count: number): number {
    const sorted = Array.from(values.subarray(0, count)).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * How fast this device's main thread is: a short fixed piece of work like the frame loop's (float arithmetic over typed
 * arrays, small objects read and written), its best time of three runs in ms (~2 ms on a recent desktop core; a
 * phone 2–8× that). The starting tier on a touch device takes it into account (`tierForCpu`), so a slow phone starts on
 * the low tier rather than building the medium tier's scenery and dropping it seconds later.
 */
export function arkCpuScore(): number {
    const values = new Float64Array(2048);
    const items: Array<{x: number; y: number; z: number}> = [];
    for (let i = 0; i < 256; i++) items.push({x: i * 0.5, y: i * 0.25, z: -i});
    let best = Infinity;
    let sink = 0;
    for (let run = 0; run < 3; run++) {
        const started = performance.now();
        for (let pass = 0; pass < 600; pass++) {
            for (let i = 0; i < values.length; i++) values[i] = values[i] * 0.999 + ((i * 7 + pass) % 13) * 0.25 - Math.abs(values[(i * 31) & 2047]) * 0.001;
            for (const item of items) {
                const d = item.x * item.x + item.z * item.z;
                item.y = item.y * 0.5 + (d > 1000 ? Math.sqrt(d) : d) * 0.001;
                sink += item.y;
            }
        }
        best = Math.min(best, performance.now() - started);
    }
    (globalThis as {__arkCpuSink?: number}).__arkCpuSink = sink + values[7];
    return best;
}

/**
 * The starting tier on a touch device, from the device's own answer (`chooseTier`) and its main thread's speed: a
 * score over `SLOW_CPU_MS` (about a 5× slowed desktop core, a low-end Android's) starts on the low tier. Never raises.
 */
export const SLOW_CPU_MS = 9.5;
export function tierForCpu(tier: PaceTier, cpuMs: number): PaceTier {
    return cpuMs > SLOW_CPU_MS && tier !== "low" ? "low" : tier;
}
