/**
 * The kept town animals around where the viewer is looking come out to move (the owner, 2026-11-16: "why are most the
 * animals just still ... e.g. the dogs or chickens").
 *
 * The live budget (`live-budget.ts`) gives every one of the Ark's ~945 kinds at least one animal outside before sharing
 * the rest by size, so the few very common kept kinds get a small share: measured on the live read, 45 of 267 dogs, 51
 * of 312 cats and 15 of 89 chickens outside on the high tier (one dog on the low tier); every other one is drawn as a
 * resting figure (decision 255), which never moves. Close up in a garden or a farm's run that read as frozen animals.
 *
 * So the few kept animals nearest the point the camera looks at (within `NEAR_KEPT_WITHIN` m, at most `NEAR_KEPT_MAX`)
 * are pinned outside for this viewer, on top of the budget, as a selected one is. Each then shows its own shared
 * schedule (pure in time and id), so nothing it does differs between viewers; only who is drawn one by one does, which
 * the figures already made viewer-dependent (they are drawn by distance). Picked anew only when the look point has moved
 * `NEAR_KEPT_MOVE` m, so the layout is not redone every frame. Pure.
 */

/** How far from the look point a kept animal is brought out (m). */
export const NEAR_KEPT_WITHIN = 18;
/** At most this many (each one an animal drawn one by one on top of the budget). */
export const NEAR_KEPT_MAX = 12;
/** The look point moves this far (m) before the choice is made again. */
export const NEAR_KEPT_MOVE = 8;
/** Brought out only while the camera is this close to its look point (m): a garden's view, not the map's. */
export const NEAR_KEPT_VIEW = 45;

/** The nearest kept animals to (x, z) within `within` m, at most `max`, nearest first (a tie: by id). */
export function nearestKept(candidates: ReadonlyArray<{id: string; x: number; z: number}>, x: number, z: number, within = NEAR_KEPT_WITHIN, max = NEAR_KEPT_MAX): string[] {
    const found: Array<{id: string; d: number}> = [];
    const limit = within * within;
    for (const c of candidates) {
        const d = (c.x - x) ** 2 + (c.z - z) ** 2;
        if (d <= limit) found.push({id: c.id, d});
    }
    found.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return found.slice(0, max).map((f) => f.id);
}

/** Whether the choice is made again: the first time, after the look point moved `NEAR_KEPT_MOVE` m. */
export function nearKeptDue(last: {x: number; z: number} | null, x: number, z: number): boolean {
    return !last || Math.hypot(x - last.x, z - last.z) >= NEAR_KEPT_MOVE;
}

/** Whether two choices are the same set (no new layout then). */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}
