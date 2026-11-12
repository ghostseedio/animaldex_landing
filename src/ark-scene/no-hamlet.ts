/**
 * The wild island without its hamlet (decision 148; the owner: "we should remove the farm and house etc from the wild
 * island"). With `voyage_config.islands` on, every pet, farm animal and garden or countryside animal lives on the town
 * island (decision 16), so today's island keeps only wild animals and nothing built: no cottage, houses, barns,
 * coops, smallholdings, fields, paddocks, fences, lamp posts, hay, plots, garden pond or lanes. Their ground is natural
 * land: the farm district's meadow, with scattered shrubs and a few trees settled by the scenery's spacing
 * (`tree-spacing.ts`), so nothing overlaps.
 *
 * The switch is the islands lane's own (T3: `lib/ark-islands.ts` arkTwoIslands, from the read): `mountArk` and
 * `prepareArk` set it from their snapshot before anything is built, and the prebuild workers are told it with their
 * job. Off (the default, and with the server's switch off) every module answers exactly as before: the hamlet stands.
 *
 * Every module that keeps a world built from the scenery registers a reset here (`onHamletSwitch`); flipping the
 * switch drops them all, so the next build is the other world's. Deterministic: a pure function of the switch.
 *
 * Imports nothing, so `world.ts` and the scenery's lowest modules can ask it without a cycle.
 */

// (On the global object, not in this module, as `map/place.ts`'s trace: a script's loader may hold two copies of the
// scene's modules, and both must see one switch.)
type HamletSwitch = {off: boolean; resets: Array<() => void>};
const STATE_KEY = "__arkNoHamletSwitch";
const state: HamletSwitch = (((globalThis as Record<string, unknown>)[STATE_KEY] as HamletSwitch | undefined) ??= {off: false, resets: []});

/** True: islands mode, the wild island has no hamlet. False (default): today's island, the hamlet stands. */
export function noHamlet(): boolean {
    return state.off;
}

/**
 * Set the switch (islands mode on: no hamlet). Returns true when it changed: every registered world was dropped and
 * is built again for the new mode on its next use.
 */
export function setNoHamlet(on: boolean): boolean {
    if (on === state.off) return false;
    state.off = on;
    for (const reset of state.resets) reset();
    return true;
}

/** A module's built world, dropped whenever the switch flips (registered once, at module load). */
export function onHamletSwitch(reset: () => void): void {
    state.resets.push(reset);
}

/**
 * The switch for a read: islands mode when the read has two islands (T3's `arkTwoIslands`). A development override,
 * `window.__arkNoHamlet = true | false` before mounting, wins (golden shots, previews, the validator's runs).
 */
export function noHamletFor(twoIslands: boolean): boolean {
    const forced = (globalThis as {__arkNoHamlet?: unknown}).__arkNoHamlet;
    return typeof forced === "boolean" ? forced : twoIslands;
}
