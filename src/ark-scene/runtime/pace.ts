/**
 * Frame pacing and resolution on phones (mobile performance lane, docs/ark/perf-audit-mobile-2026-11.md).
 *
 * A phone that cannot hold 60 frames a second drew at whatever it managed (a jittery 35–50), and the only lever was
 * the tier check: frames measured in the first two seconds after the first frame (while the island was still being
 * built and its models coming in) and, if long, a whole tier down for good (no shadows, no finish, less grass). Now,
 * on a touch device, one small controller fed every drawn frame's interval and main-thread work:
 *
 * 1. **The resolution.** When the frames run late as a rule (the median) but their own work is short (the GPU, not the
 *    script, is the bottleneck: fill rate, the finish's passes), the drawing buffer's scale steps down by 0.1 (to 0.7 of the
 *    tier's pixel ratio at most); it steps back up after 6 s of frames on time, never to a scale found too high at that
 *    rate lately: for 90 s the first time, twice as long each time the same scale fails again (to 15 minutes). The
 *    picture stays whole; it is only softer.
 * 2. **The rate.** Held at the display's rate while it can (a GPU-bound phone first gives up resolution); when a
 *    quarter of the frames still miss it (a jittery 40–50), locked to a steady 30. It tries the display's rate again
 *    after 8 s, and waits twice as long after each try that fails at once (8, 16, 32 … 300 s): it never oscillates. A
 *    try the GPU missed at every resolution before starts at the lowest in one step, and a try that fails goes back to
 *    the resolution the steady 30 held, in one step. The start (the world being built, the first models) is forgotten
 *    when it ends, and the display's rate tried again. The low tier on a slow main thread starts locked.
 *
 * (Graphics and performance pass, 2026-11, on model devices over ten minutes: a GPU that holds 60 at 0.8 and not at
 * 0.9 changed resolution 14 times, now 6 and rarer after; one that cannot hold 60 at all, 38 times, now 21: every
 * change re-makes every render target and is seen as a soften or a sharpen.)
 * 3. **The tier.** Only once the start is over: locked at 30 and as low as the resolution goes, still missing 30 for
 *    3 s; or locked at 30 by the script's own work for 15 s on end (a phone then trades the tier's finish for 60).
 * 4. **Above the tier's pixel ratio** (the low tier on a dense screen, `setTop`). The low tier draws one buffer pixel
 *    a CSS pixel: on a 3× phone screen every edge is a stair and a lit window two pixels wide twinkles. Once the
 *    start is over and the frames have been on time for 10 s at the rate they hold, the scale steps up (1.25, then
 *    1.5, never past the screen's own density); a step that makes the frames late is taken back by rule 1 and stays
 *    out of reach for 6 minutes, twice as long each time (to 15). It starts at 1, as before: a phone with nothing to
 *    spare never leaves it.
 * 5. **A tier on trial** (`trial`, `runtime/trial.ts`) must hold the display's rate: a GPU that misses it at every
 *    resolution goes down the tier after 15 s at the steady 30, instead of staying there.
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
/** A frame interval over this misses the display's 60 Hz (16.7 ms, a little room for jitter). */
const HOLD_60_MS = 19;
/** The share of frames that may miss before the rate counts as not held (judged on the frames' 75th percentile). */
const LATE_SHARE = 0.75;
/** A locked frame later than this (median) is not holding 30 either. */
const HOLD_30_MS = 40;
const WINDOW = 45;
const MIN_SAMPLES = 24;
const JUDGE_EVERY_S = 1;
const RETRY_FIRST_S = 8;
/** The longest wait between tries at the display's rate (s): a phone that cannot hold it tries for a second or two of uneven frames each time. */
const RETRY_MOST_S = 300;
export const SCALE_STEP = 0.1;
export const SCALE_FLOOR = 0.7;
/** The steps above the tier's own pixel ratio (rule 4), and how long the frames must have been on time for one. */
export const SHARP_STEP = 0.25;
const SHARP_UP_AFTER_S = 10;
/** A scale above 1 found too high stays out of reach this many times longer than one below (it was a bonus, not the picture). */
const SHARP_HOLD_TIMES = 4;
const SCALE_UP_AFTER_S = 6;
const SCALE_COOLDOWN_S = 1.5;
/**
 * How long a scale found too high at a rate stays out of reach at that rate (s): twice as long each time the same
 * scale is found too high again, to `CEILING_HOLD_MOST_S` (a GPU that holds the rate at 0.8 and not at 0.9 was sent
 * back up to 0.9 every 90 s for good: a soften and sharpen, and every render target made twice, each time).
 */
const CEILING_HOLD_S = 90;
const CEILING_HOLD_MOST_S = 900;
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
    /** The highest scale (rule 4): 1, or more for the low tier on a dense screen (`setTop`). */
    private top = 1;
    private changedScaleAt = -Infinity;
    /** Per rate, the scale its frames were late at, and until when it stays out of reach (no bouncing back up). */
    private readonly ceiling: Record<Rate, {scale: number; until: number; times: number} | null> = {full: null, locked: null};
    private onTimeSince: number | null = null;
    private slowSince: number | null = null;
    private droppedFor: PaceTier | null = null;
    /** Since when the rate has been locked (s), for the drop that trades the tier's finish for the display's rate. */
    private lockedSince: number | null = null;
    /** The start was over at the last frame (its frames, the world being built, say nothing of the frames to come). */
    private wasSettled = false;
    /** The scale in use, locked, before the last try at the display's rate (that try may lower it): gone back to at once if the try fails. */
    private beforeTry: number | null = null;
    /** The GPU missed the display's rate even at the lowest resolution: a later try starts there (no higher one can hold it). */
    private floorMissed = false;
    /** Started locked (the low tier on a slow main thread): no try at the display's rate before the start is over. */
    private slowStart = false;
    /**
     * The tier is a guess being proven (`runtime/trial.ts`: a device that hides what it is, started a tier up from
     * where it was before): it must hold the display's rate there. A GPU that misses it at every resolution is not
     * left at a steady 30 on that tier, as a device that said what it is would be: after `LOCKED_DROP_AFTER_S` locked
     * it goes down the tier, where it drew before.
     */
    trial = false;

    /** `startLocked`: the low tier on a slow main thread (`tierForCpu`) starts at a steady 30. */
    constructor(private tier: PaceTier, now: number, startLocked = tier === "low") {
        this.locked = startLocked;
        this.slowStart = startLocked;
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
        this.floorMissed = false;
        this.beforeTry = null;
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

    /**
     * Drawing again after a pause (the panel covered, the page hidden or scrolled away, a stall of seconds): what was
     * measured before says nothing now, and the time away is not time spent locked. Without this, a phone locked at a
     * steady 30 whose panel was covered for fifteen seconds came back to "locked by the script for 15 s on end" and
     * lost its tier for good at the first frames back (measured: the medium tier dropped 0.1 s after `ark:visible`
     * true, 112 programs compiled again).
     */
    resume(now: number) {
        this.reset(now);
        if (this.locked) this.lockedSince = now;
        this.retryAt = Math.max(this.retryAt, now + 2);
    }

    /**
     * The highest scale the frames may earn (1: the tier's own pixel ratio, as before). The scene sets it: above 1 only
     * on the low tier of a screen denser than the tier draws, with no power cap and no lighter view asked for. A scale
     * over a lowered top comes down to it at once (the scene applies `resolution`).
     */
    setTop(top: number, now: number) {
        const next = Math.max(round2(top), 1);
        if (next === this.top) return;
        this.top = next;
        if (this.scale > next + 1e-6) {
            this.scale = next;
            this.changedScaleAt = now;
            this.reset(now);
        }
    }

    get scaleTop(): number {
        return this.top;
    }

    /** The next scale down: a tenth under 1, the steps of rule 4 above it. */
    private down(scale: number): number {
        if (scale > 1 + 1e-6) return Math.max(round2(Math.ceil((scale - 1) / SHARP_STEP - 1e-6) * SHARP_STEP + 1 - SHARP_STEP), 1);
        return Math.max(round2(scale - SCALE_STEP), SCALE_FLOOR);
    }

    /** The next scale up, never past the top. */
    private up(scale: number): number {
        if (scale >= 1 - 1e-6) return Math.min(round2(Math.floor((scale - 1) / SHARP_STEP + 1e-6) * SHARP_STEP + 1 + SHARP_STEP), this.top);
        return Math.min(round2(scale + SCALE_STEP), 1);
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
            // The start just ended: what was measured during it is forgotten, a lock counts from now, and the display's
            // rate is tried again soon (its earlier failures were the start's).
            this.wasSettled = true;
            this.reset(now);
            if (this.locked) this.lockedSince = now;
            this.failures = 0;
            this.retryAt = Math.min(this.retryAt, now + 2);
        }
        this.intervals[this.at] = intervalMs;
        this.work[this.at] = workMs;
        this.at = (this.at + 1) % WINDOW;
        this.count = Math.min(this.count + 1, WINDOW);
        if (this.count < MIN_SAMPLES || now - this.judgedAt < JUDGE_EVERY_S) return keep();
        this.judgedAt = now;
        // (The interval at its 75th percentile: a quarter of the frames late is a jittery rate, even when the median is on
        // time. A GPU too slow for the picture makes every frame late: the median. Sporadic late frames, a collection or
        // another task, lock the rate but never cost resolution.)
        const interval = percentile(this.intervals, this.count, LATE_SHARE);
        const typical = percentile(this.intervals, this.count, 0.5);
        const work = percentile(this.work, this.count, 0.5);
        const rate: Rate = this.locked ? "locked" : "full";
        const target = this.locked ? PACE_LOCK_MS : 1000 / 60;
        const limit = this.locked ? target * 1.12 : HOLD_60_MS;
        const late = interval > limit;
        const cooled = now - this.changedScaleAt > SCALE_COOLDOWN_S;

        if (late) {
            this.onTimeSince = null;
            // 1. The resolution: late frames with short work (the GPU's, not the script's) give up a step of resolution
            // first; that scale stays out of reach at this rate for a while (no bouncing).
            // (Locked, a scale above the tier's own, rule 4, is given back whatever made the frames late: there is no
            // lower rate to give, and it was a bonus. At the display's rate the script's lateness locks the rate, below.)
            if (((this.locked && this.scale > 1 + 1e-6) || (typical > limit && work < target * 0.6)) && this.scale > SCALE_FLOOR + 1e-6) {
                if (!cooled) return keep();
                // (The same scale found too high again: out of reach twice as long.)
                const before = this.ceiling[rate];
                const times = before && Math.abs(before.scale - this.scale) < 1e-6 ? before.times + 1 : 0;
                const hold = CEILING_HOLD_S * (this.scale > 1 + 1e-6 ? SHARP_HOLD_TIMES : 1);
                this.ceiling[rate] = {scale: this.scale, until: now + Math.min(hold * 2 ** times, CEILING_HOLD_MOST_S), times};
                this.scale = this.down(this.scale);
                this.changedScaleAt = now;
                this.reset(now);
                return keep(true);
            }
            // 2. The rate: the script is the bottleneck (or the resolution is as low as it goes): a steady 30.
            if (!this.locked) {
                this.locked = true;
                this.lockedSince = now;
                // (A try at the display's rate that failed at once: wait longer before the next. One that held a while
                // first: the count starts over.)
                if (now - this.triedAt < RETRY_FIRST_S + 10) this.failures++;
                else if (Number.isFinite(this.triedAt)) this.failures = 0;
                // (The GPU too slow for 60 even at the lowest resolution: no quick retries.)
                if (this.scale <= SCALE_FLOOR + 1e-6 && typical > limit && work < target * 0.6) {
                    this.failures = Math.max(this.failures, 2);
                    this.floorMissed = true;
                }
                this.retryAt = now + Math.min(RETRY_FIRST_S * 2 ** this.failures, RETRY_MOST_S);
                // (A try that lowered the resolution to reach the display's rate and failed at once: the resolution the
                // steady 30 held before it, in one step, not climbed back to a tenth every six seconds.)
                if (this.beforeTry !== null && now - this.triedAt < RETRY_FIRST_S + 10 && this.beforeTry > this.scale + 1e-6) {
                    this.scale = this.beforeTry;
                    this.changedScaleAt = now;
                }
                this.beforeTry = null;
                this.reset(now);
                return keep(true);
            }
            // 3. The tier: locked, as low as the resolution goes (or the script is the bottleneck), still not holding 30.
            if (settled && this.tier !== "low" && this.droppedFor !== this.tier && typical > HOLD_30_MS) {
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
        // (Above the tier's own pixel ratio, rule 4: only once the start is over, and after longer on time.)
        const sharper = this.scale >= 1 - 1e-6;
        if (this.scale < this.top - 1e-6 && cooled && now - this.onTimeSince >= (sharper ? SHARP_UP_AFTER_S : SCALE_UP_AFTER_S) && (!sharper || settled)) {
            const next = this.up(this.scale);
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
        if (this.locked && settled && this.tier !== "low" && this.droppedFor !== this.tier && (work > (1000 / 60) * 0.6 || (this.trial && this.floorMissed)) && this.lockedSince !== null && now - this.lockedSince >= LOCKED_DROP_AFTER_S) {
            this.droppedFor = this.tier;
            return {interval: this.interval, scale: this.scale, dropTier: true, changed: true};
        }
        // (Not judged by the frames' work at 30: much of it is per second, not per frame, so it reads heavier than it is at 60.)
        if (this.locked && now >= this.retryAt && !(this.tier === "low" && this.slowStart && !this.wasSettled)) {
            this.locked = false;
            this.lockedSince = null;
            this.triedAt = now;
            this.beforeTry = this.scale;
            const ceiling = this.ceiling.full;
            if (this.floorMissed) {
                // (It missed this rate at every resolution down to the lowest: tried there, in one step.)
                if (this.scale > SCALE_FLOOR + 1e-6) {
                    this.scale = SCALE_FLOOR;
                    this.changedScaleAt = now;
                }
            } else if (ceiling && now <= ceiling.until && this.scale >= ceiling.scale - 1e-6) {
                this.scale = this.down(ceiling.scale);
                this.changedScaleAt = now;
            }
            this.reset(now);
            return keep(true);
        }
        return keep();
    }
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function percentile(values: Float64Array, count: number, share: number): number {
    const sorted = Array.from(values.subarray(0, count)).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;
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
