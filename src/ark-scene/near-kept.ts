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

/**
 * p4 (zoolive): a zoo enclosure in view comes out whole (the owner, 2026-11-17, on the live Ark: "why are all the
 * animals in the elephant enclosure frozen and I can't click on them, maybe other enclosures too").
 *
 * The elephants' paddock holds 24 residents; on the high tier the live budget had 6 of them out, and the 12 nearest the
 * look point (`nearestKept`, only with the camera within 45 m) left the rest of the paddock standing as resting figures:
 * frozen, in the same view as the ones that walk. From the usual enclosure view (50 to 80 m out) none came out at all.
 * So every resident of an enclosure with a resident near the look point (`NEAR_ZOO_WITHIN`) is brought out, while the
 * camera is within `NEAR_ZOO_VIEW` m, nearest enclosure first, at most `cap` animals in all (a whole enclosure or none,
 * unless the first alone is over the cap: its nearest then). Pure.
 */

/** The camera within this far of its look point (m) for a zoo enclosure to come out: the view of a paddock, not the map's. */
export const NEAR_ZOO_VIEW = 90;
/** An enclosure with a resident this near the look point (m) comes out. */
export const NEAR_ZOO_WITHIN = 30;
/** At most this many zoo residents brought out (the low tier and the lighter view: `NEAR_ZOO_MAX_LOW`). */
export const NEAR_ZOO_MAX = 40;
export const NEAR_ZOO_MAX_LOW = 20;

/**
 * The kept animals to bring out for a look point: the nearest kept ones (`nearestKept`, with the camera within
 * `NEAR_KEPT_VIEW`), then the whole of each zoo enclosure (`group`) with a resident within `NEAR_ZOO_WITHIN`, nearest
 * enclosure first, up to `zooCap` zoo residents (with the camera within `NEAR_ZOO_VIEW`). Nearest first; ids unique.
 */
export function keptToBringOut(candidates: ReadonlyArray<{id: string; x: number; z: number; group?: string | null}>, x: number, z: number, view: number, zooCap = NEAR_ZOO_MAX): string[] {
    const out = view < NEAR_KEPT_VIEW ? nearestKept(candidates, x, z) : [];
    if (view >= NEAR_ZOO_VIEW) return out;
    const groups = new Map<string, Array<{id: string; d: number}>>();
    for (const c of candidates) {
        if (!c.group) continue;
        const d = (c.x - x) ** 2 + (c.z - z) ** 2;
        const list = groups.get(c.group);
        if (list) list.push({id: c.id, d});
        else groups.set(c.group, [{id: c.id, d}]);
    }
    const order = (a: {id: string; d: number}, b: {id: string; d: number}) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const near = Array.from(groups.entries()).map(([key, list]) => ({key, list: list.sort(order)})).filter((g) => g.list[0].d <= NEAR_ZOO_WITHIN ** 2);
    near.sort((a, b) => a.list[0].d - b.list[0].d || (a.key < b.key ? -1 : 1));
    const seen = new Set(out);
    let zoo = 0;
    for (let k = 0; k < near.length; k++) {
        const g = near[k];
        if (k > 0 && zoo + g.list.length > zooCap) continue;
        for (const m of g.list) {
            if (zoo >= zooCap) break;
            zoo++;
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            out.push(m.id);
        }
    }
    return out;
}
