/**
 * The live log as a stack (owner 2026-11-20, decision 439: "if a new one comes it replaces the old, can it instead push
 * the previous one up and have them fade out, show maybe 3-4 at once"). Pure: what the scene's DOM log
 * (`src/ark-scene/live/log-view.ts`) draws for the lines `ArkLiveLog` holds (oldest first, newest at the foot).
 *
 * - At most 4 lines at once, 3 at a phone's width (4 two-line rows there cover the animals the reader is watching).
 * - The older a line is in the stack, the fainter: 1, 0.7, 0.45, 0.25 from the newest up.
 * - Each line also fades on its own over the last stretch of its life (`ARK_LIVE_LOG_DEFAULTS`: about 8-12 s).
 * - Only the newest line carries its tag ("Now", "Seen"): an older one is no longer happening now.
 */

/** Lines on screen at most, wide and at a phone's width (below `ARK_LIVE_STACK_PHONE_PX`). */
export const ARK_LIVE_STACK_MAX = 4;
export const ARK_LIVE_STACK_MAX_PHONE = 3;
export const ARK_LIVE_STACK_PHONE_PX = 640;
/** The opacity of each place in the stack, from the newest (the foot) up. */
export const ARK_LIVE_STACK_STEPS: readonly number[] = [1, 0.7, 0.45, 0.25];
/** The last stretch of a line's life over which it fades out (ms). */
export const ARK_LIVE_STACK_FADE_MS = 3000;

export function arkLiveStackMax(width: number): number {
    return width < ARK_LIVE_STACK_PHONE_PX ? ARK_LIVE_STACK_MAX_PHONE : ARK_LIVE_STACK_MAX;
}

/** The lines the stack shows of `lines` (oldest first): the newest `max`, oldest first. */
export function arkLiveStackPick<T>(lines: readonly T[], max: number): T[] {
    const n = Math.max(Math.floor(max), 0);
    return n === 0 ? [] : lines.slice(-n);
}

/**
 * A line's opacity: its place in the stack (0 the newest) times its own fade (`left`: ms of its life left).
 * Never above 1, never below 0; a line past its life is 0.
 */
export function arkLiveStackOpacity(rank: number, left: number, fade = ARK_LIVE_STACK_FADE_MS): number {
    const steps = ARK_LIVE_STACK_STEPS;
    const step = steps[Math.min(Math.max(Math.floor(rank), 0), steps.length - 1)];
    const own = fade > 0 ? Math.min(Math.max(left / fade, 0), 1) : left > 0 ? 1 : 0;
    return Math.round(step * own * 1000) / 1000;
}

/** Whether a line at this place shows its tag: the newest only. */
export function arkLiveStackTagged(rank: number): boolean {
    return rank === 0;
}

/**
 * How many lines fit (the newest first): `heights` are the rows' heights from the newest up, `gap` the space between
 * two, `room` the height the stack may take (above a card, below the controls at the top). The newest always stays,
 * whatever the room: it is the line just said. Never a line cut in half: one that would cross the top goes.
 */
export function arkLiveStackFit(heights: readonly number[], gap: number, room: number): number {
    let used = 0;
    let n = 0;
    for (const h of heights) {
        const next = used + (n > 0 ? gap : 0) + h;
        if (n > 0 && next > room) break;
        used = next;
        n++;
    }
    return n;
}
