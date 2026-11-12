/**
 * The selection through a snapshot laid out again (`index.ts` setSnapshot): the town joining a few hundred animals at a
 * time (decision 153), a newer read, a tier change. Pure.
 *
 * The selected animal stays chosen while it is aboard, and it is pinned, so it stays one of those drawn one by one
 * (whoever else the live budget or the herds now draw). Before, an animal that only fell out of the live set as the town's
 * animals joined was deselected, and its card vanished within seconds of a tap (U1, desktop).
 */

/**
 * The ids the layout must draw one by one: a replay's, a herd member brought forward to be met, the followed one (as
 * before), and now the selected animal while it is aboard.
 */
export function selectionPins(aboard: ReadonlySet<string>, keep: {selected: string | null; promoted: string | null; followed: string | null; replay: Iterable<string>}): Set<string> {
    const pins = new Set<string>(keep.replay);
    if (keep.promoted) pins.add(keep.promoted);
    if (keep.followed) pins.add(keep.followed);
    if (keep.selected && aboard.has(keep.selected)) pins.add(keep.selected);
    return pins;
}

/** Whether the selection survives a new layout: only an animal gone from the Ark (or a visitor gone) is deselected. */
export function selectionSurvives(selected: string | null, aboard: ReadonlySet<string>, visitor: string | null): boolean {
    return !selected || aboard.has(selected) || selected === visitor;
}
