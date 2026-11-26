/**
 * An arrival waits for its animal (logged bug, 2026-11-24): a newcomer's entrance (its grow and the ripple ring under
 * it) starts on the first frame its body is drawn, not when it came aboard. A fresh capture of a kind no one else has
 * aboard has its model still loading: the ring used to open and fade on the empty ground before the animal was there.
 *
 * While it is not drawn its entrance clock is held at its start. One never drawn within `ARRIVAL_WAIT_SECONDS` (a
 * fetch that failed, a slow phone) comes in with no entrance at all, rather than a late ring that no longer means
 * "it just arrived". Once its entrance has started it is never held again (a level's mesh still loading midway: the
 * ring plays on).
 */

export const ARRIVAL_WAIT_SECONDS = 12;

export type ArrivalClock = {
    /** When its entrance started (s, the scene's clock), or null: no entrance. */
    arrivedAt: number | null;
    /** The entrance being waited on: when it was asked for, and the start last held. */
    arrivalWait?: {asked: number; held: number} | null;
    /** The start of the entrance that has been seen (drawn at least once). */
    arrivalSeen?: number | null;
};

/** Steps `entry`'s entrance clock for this frame: `shown` when its body (model, icon or marker) is drawn this frame. */
export function waitForArrival(entry: ArrivalClock, now: number, shown: boolean): void {
    const at = entry.arrivedAt;
    if (at === null) {
        entry.arrivalWait = null;
        return;
    }
    if (entry.arrivalSeen === at) return;
    if (shown) {
        entry.arrivalSeen = at;
        entry.arrivalWait = null;
        return;
    }
    // (A start set anew by another arrival, replay or birth: waited on from then.)
    const wait = entry.arrivalWait && entry.arrivalWait.held === at ? entry.arrivalWait : {asked: at, held: at};
    if (now - wait.asked > ARRIVAL_WAIT_SECONDS) {
        entry.arrivedAt = null;
        entry.arrivalWait = null;
        return;
    }
    wait.held = Math.max(now, at);
    entry.arrivedAt = wait.held;
    entry.arrivalWait = wait;
}

/** Whether its entrance is playing (drawn at least once since it started): its ring is shown only then. */
export const entranceShowing = (entry: ArrivalClock): boolean => entry.arrivedAt !== null && entry.arrivalSeen === entry.arrivedAt;
