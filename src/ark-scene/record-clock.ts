/**
 * The recorder's clock (`/ark?record=1` only): time stands still until the
 * recorder moves it on, one video frame at a time, so a clip comes out at an
 * exact 30 fps however long each frame takes to draw headless.
 *
 * `performance.now()` and `requestAnimationFrame` are replaced for the whole
 * page (the scene, three.js and the replay all read them), and `Math.random`
 * is seeded, so the same shot of the same Ark records the same way twice.
 * Timers, fetches and model loading keep real time: they only bring things
 * in, and the director waits for them before it starts a shot.
 *
 * Pure apart from `install`, which only the recording page calls.
 */

export type RecordClock = {
    /** Move time on by `ms` and run every frame callback waiting (once). `tick(0)` draws a frame without moving time. */
    tick: (ms: number) => void;
    /** Virtual milliseconds since the clock was installed. */
    elapsed: () => number;
};

type FrameCallback = (time: number) => void;

export type ClockTarget = {
    performance: {now: () => number};
    requestAnimationFrame: (callback: FrameCallback) => number;
    cancelAnimationFrame: (handle: number) => void;
    Math: {random: () => number};
};

/** mulberry32: a small seeded generator, enough for idle motion. */
export function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function installRecordClock(target: ClockTarget, seed = 20261110): RecordClock {
    const start = target.performance.now();
    let virtual = 0;
    let nextHandle = 1;
    let waiting = new Map<number, FrameCallback>();
    target.performance.now = () => start + virtual;
    target.requestAnimationFrame = (callback) => {
        const handle = nextHandle++;
        waiting.set(handle, callback);
        return handle;
    };
    target.cancelAnimationFrame = (handle) => {
        waiting.delete(handle);
    };
    target.Math.random = seededRandom(seed);
    return {
        tick: (ms) => {
            virtual += Math.max(0, ms);
            // Callbacks asked for during this frame wait for the next tick, as in a browser.
            const due = waiting;
            waiting = new Map();
            const now = start + virtual;
            due.forEach((callback) => callback(now));
        },
        elapsed: () => virtual
    };
}
