/**
 * The Ark's shared clock for everything that moves on its own (water, wind, caustics, foliage sway, sea life,
 * particles): epoch seconds, the same for every viewer, so two people see the same wave and the same sway, and an
 * animal on a leaf (`attachPointAt`) sways the same on every screen. (Before: seconds since the page opened, a
 * different phase for every viewer.) docs/ark/graphics-interface.md, "The shared clock".
 *
 * Shaders cannot take epoch seconds as they are (float32: 1.7e9 s leaves no fraction), so the shader time
 * (`ARK_TIME.value`) is epoch seconds from an origin that is a whole number of `ARK_TIME_PERIOD`s (600 s):
 *
 * - every term that makes whole cycles in 600 s (`arkWholeCycles`) has the same phase for every viewer, whenever
 *   they opened the page;
 * - the number never wraps while anyone is looking (no seam): it starts under 600 and grows with the visit, as the
 *   old per-page clock did; it is brought back down (`rebase`) only at a moment nobody sees, the scene being hidden
 *   or paused, once it has passed an hour (float precision in the noise hashes).
 *
 * Terms that are not periodic in 600 s (a noise pattern scrolled by the wind) still move smoothly, but their offset
 * differs by whole windows between viewers who opened in different windows; graphics-interface.md lists them.
 */

/** The window every shared periodic motion makes whole cycles in (s). The reef lane's sea clock uses the same. */
export const ARK_TIME_PERIOD = 600;
/** Past this (s), the shader time is brought back down at the next unseen moment. */
export const ARK_TIME_REBASE_AFTER = 3600;
/** The animals' own idle clock (`ARK_CLOCK`, animal-material.ts) wraps at this (s). */
export const ARK_CLOCK_PERIOD = 3600;

let pinned: {epoch: number; at: number} | null = null;
/**
 * The server's clock less the device's (ms), from `ark-live`'s ping and pong (design §2.4; `src/ark-live/clock.ts`
 * slews it at ≤ 50 ms a second, so no pose jumps). 0 without a live connection: the device clock, as before.
 */
let offsetMs = 0;

/** Set the device clock's offset to the server's (ms); 0 hands back to the device clock. */
export function setArkClockOffset(ms: number): void {
    offsetMs = Number.isFinite(ms) ? ms : 0;
}

/** The server's offset in force now (ms; 0 without a live connection). */
export function arkClockOffsetMs(): number {
    return offsetMs;
}

function monotonicMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Epoch seconds now: the same for every viewer (or, pinned, running on from the pin). */
export function arkEpochSeconds(): number {
    return pinned ? pinned.epoch + (monotonicMs() - pinned.at) / 1000 : (Date.now() + offsetMs) / 1000;
}

/** Development (golden shots, recordings): run the shared clock from this epoch second, or (null) the real clock again. */
export function pinArkClock(epochSeconds: number | null): void {
    pinned = epochSeconds === null || !Number.isFinite(epochSeconds) ? null : {epoch: epochSeconds, at: monotonicMs()};
}

/** The nearest angular frequency (rad/s) that makes a whole number of cycles in the window: the same phase for everyone. */
export function arkWholeCycles(angular: number, period = ARK_TIME_PERIOD): number {
    const step = (2 * Math.PI) / period;
    return Math.round(angular / step) * step;
}

/** A per-second rate (a `fract(t * rate)` loop) rounded to whole loops in the window. */
export function arkWholeLoops(rate: number, period = ARK_TIME_PERIOD): number {
    return Math.round(rate * period) / period;
}

/** Epoch seconds mod the window (CPU twins that only need the phase: fish schools, sway). */
export function arkWindowSeconds(epochSeconds = arkEpochSeconds(), period = ARK_TIME_PERIOD): number {
    const t = epochSeconds % period;
    return t < 0 ? t + period : t;
}

/** The animals' idle clock, shared: epoch seconds mod an hour. */
export function arkAnimalClock(epochSeconds = arkEpochSeconds()): number {
    return arkWindowSeconds(epochSeconds, ARK_CLOCK_PERIOD);
}

/** The shader time for one page: epoch seconds from a whole-window origin (see the file's comment). */
export class ArkShaderClock {
    private origin: number;

    constructor(epochSeconds = arkEpochSeconds()) {
        this.origin = ArkShaderClock.originFor(epochSeconds);
    }

    static originFor(epochSeconds: number): number {
        return Math.floor(epochSeconds / ARK_TIME_PERIOD) * ARK_TIME_PERIOD;
    }

    /** `ARK_TIME.value` now. */
    seconds(epochSeconds = arkEpochSeconds()): number {
        return epochSeconds - this.origin;
    }

    /** A moment nobody sees the scene: bring the number back under a window if it has grown past an hour. True if it moved. */
    rebase(epochSeconds = arkEpochSeconds()): boolean {
        if (epochSeconds - this.origin <= ARK_TIME_REBASE_AFTER) return false;
        this.origin = ArkShaderClock.originFor(epochSeconds);
        return true;
    }
}
