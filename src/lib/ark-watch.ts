/**
 * The camera director ("Watch", 2026-11-26): when the viewer is not steering (a Watch toggle, or untouched for a while),
 * the follow camera cuts to the most dramatic real thing happening now, holds it, and moves on. The scene gathers what
 * is happening (`ArkWatchCandidate`, from its live layers: the record's acts and the engine's hunt odds, never made up);
 * this picks the shot. Pure: no clock, no randomness, no I/O. The camera moves only: nothing here changes what happens.
 *
 * Rank (the owner's order), best first:
 *   hunt       a hunt under way: the record's chase (weight 1), else a hunter out on its forays now, by its chance of a
 *              catch in the next Ark day (the engine's find share and catch chance, `ark-eat-soon.ts`)
 *   birth      a live birth acted from the record
 *   chase      an escape's chase and flight, from the record
 *   mate       a mate arriving: the record's trip to a far mate, or a pair walking to each other to mate
 *   rivals     rivals meeting: a mating's contest from the record, or the schedule's contest moment
 *   signature  a species' own signature behaviour starting now (the schedule's moment with its own line)
 */

export const ARK_WATCH_KINDS = ["hunt", "birth", "chase", "mate", "rivals", "signature"] as const;
export type ArkWatchKind = (typeof ARK_WATCH_KINDS)[number];

export type ArkWatchCandidate = {
    /** The animal the camera goes to (a pair's first). */
    id: string;
    /** A pair's other, framed with it (a mating, a contest). */
    other?: string | null;
    kind: ArkWatchKind;
    /** 0..1 within its kind (a hunter's chance of a catch; 1 for the record's own act). */
    weight: number;
    /** When it began (epoch s): the newer of two equal ones first. */
    since: number;
};

export type ArkWatchState = {
    /** The shot now: its subject, kind and when the cut was made (s, the caller's clock). */
    shot: {id: string; other: string | null; kind: ArkWatchKind; score: number; from: number} | null;
    /** Since when the shot's subject has had nothing happening (s), or null. */
    lostAt: number | null;
    /** Subjects shot lately (id to when the shot ended), not cut back to while others are on. */
    recent: Array<{id: string; at: number}>;
    /** Subjects the camera could not see (hidden in a bush, under a crown): not cut back to at all for a while. */
    hidden?: Array<{id: string; at: number}>;
};

/** The shortest hold of a shot (s): a cut never comes sooner, whatever else starts. */
export const ARK_WATCH_HOLD = 12;
/** The longest (s): past it, the camera moves on when something else is happening. */
export const ARK_WATCH_MOST = 40;
/** A subject whose act ended: held this long more (s) before the next cut (the act's last beat, a rest). */
export const ARK_WATCH_GRACE = 4;
/** A stronger shot (a kind higher in the rank) takes over after this much of the hold (s). */
export const ARK_WATCH_PREEMPT = 6;
/** A subject left is not cut back to for this long (s) while there is anything else. */
export const ARK_WATCH_AGAIN = 90;
/** Untouched for this long (s), with nothing selected, the director starts by itself (the idle Watch). */
export const ARK_WATCH_IDLE = 45;
/** A subject hidden from the camera this long (s), after the camera has pulled back and up, is given up. */
export const ARK_WATCH_HIDDEN = 3;
/** A subject given up as hidden is not cut back to for this long (s), even with nothing else on. */
export const ARK_WATCH_HIDDEN_AGAIN = 60;

export const arkWatchStart = (): ArkWatchState => ({shot: null, lostAt: null, recent: []});

/** A candidate's score: its kind's place in the rank, then its weight within the kind. */
export function arkWatchScore(candidate: Pick<ArkWatchCandidate, "kind" | "weight">): number {
    const rank = ARK_WATCH_KINDS.indexOf(candidate.kind);
    return (ARK_WATCH_KINDS.length - (rank < 0 ? ARK_WATCH_KINDS.length : rank)) * 10 + Math.min(Math.max(Number.isFinite(candidate.weight) ? candidate.weight : 0, 0), 1) * 9;
}

/** Best first: score, then the newest, then the id (the same order for the same inputs). */
export function arkWatchRanked(candidates: readonly ArkWatchCandidate[]): ArkWatchCandidate[] {
    // (One per subject: its best.)
    const best = new Map<string, ArkWatchCandidate>();
    for (const c of candidates) {
        const had = best.get(c.id);
        if (!had || arkWatchScore(c) > arkWatchScore(had)) best.set(c.id, c);
    }
    return Array.from(best.values()).sort((a, b) => arkWatchScore(b) - arkWatchScore(a) || b.since - a.since || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The next step: the state after `now` (s) with these candidates, and the cut to make (null: hold the shot). With nothing
 * happening and no shot, nothing is cut (the view stays where it is).
 */
export function arkWatchNext(state: ArkWatchState, candidates: readonly ArkWatchCandidate[], now: number): {state: ArkWatchState; cut: ArkWatchCandidate | null} {
    const hidden = (state.hidden ?? []).filter((h) => now - h.at < ARK_WATCH_HIDDEN_AGAIN);
    if (hidden.length || state.hidden) state = {...state, hidden};
    const ranked = arkWatchRanked(candidates.filter((c) => !hidden.some((h) => h.id === c.id)));
    const recent = state.recent.filter((r) => now - r.at < ARK_WATCH_AGAIN);
    const fresh = (c: ArkWatchCandidate) => !recent.some((r) => r.id === c.id);
    const take = (c: ArkWatchCandidate): {state: ArkWatchState; cut: ArkWatchCandidate} => ({
        state: {shot: {id: c.id, other: c.other ?? null, kind: c.kind, score: arkWatchScore(c), from: now}, lostAt: null, recent: state.shot ? [...recent.filter((r) => r.id !== state.shot!.id), {id: state.shot.id, at: now}].slice(-12) : recent, hidden},
        cut: c
    });
    const shot = state.shot;
    if (!shot) {
        const first = ranked.find(fresh) ?? ranked[0];
        return first ? take(first) : {state: {...state, recent, hidden}, cut: null};
    }
    const held = now - shot.from;
    const others = ranked.filter((c) => c.id !== shot.id);
    const current = ranked.find((c) => c.id === shot.id) ?? null;
    if (!current) {
        // Its act is over: a short grace, then the best other (none: hold where it is).
        const lostAt = state.lostAt ?? now;
        const next = others.find(fresh) ?? others[0];
        if (next && held >= ARK_WATCH_HOLD && now - lostAt >= ARK_WATCH_GRACE) return take(next);
        return {state: {shot, lostAt, recent, hidden}, cut: null};
    }
    const score = arkWatchScore(current);
    const kept: ArkWatchState = {shot: {...shot, kind: current.kind, score}, lostAt: null, recent, hidden};
    const best = others.find(fresh);
    // A stronger kind starting (a chase while a signature plays) takes over early (not one just left).
    if (best && held >= ARK_WATCH_PREEMPT && Math.floor(arkWatchScore(best) / 10) > Math.floor(score / 10)) return take(best);
    if (held < ARK_WATCH_HOLD) return {state: kept, cut: null};
    // Held long enough: something else when there is anything fresh, or after the longest hold, anything at all.
    const next = others.find(fresh);
    if (next && arkWatchScore(next) > score + 0.5) return take(next);
    if (held >= ARK_WATCH_MOST && (next ?? others[0])) return take(next ?? others[0]);
    return {state: kept, cut: null};
}

/**
 * The shot's subject has stayed hidden from the camera (`ARK_WATCH_HIDDEN`): the shot is given up, and the subject is
 * neither cut back to soon nor at all for `ARK_WATCH_HIDDEN_AGAIN`. The next `arkWatchNext` then cuts to the best other
 * (none: the caller goes back to the island's view).
 */
export function arkWatchGiveUp(state: ArkWatchState, now: number): ArkWatchState {
    const shot = state.shot;
    if (!shot) return state;
    const hidden = [...(state.hidden ?? []).filter((h) => h.id !== shot.id && now - h.at < ARK_WATCH_HIDDEN_AGAIN), {id: shot.id, at: now}].slice(-12);
    const recent = [...state.recent.filter((r) => r.id !== shot.id), {id: shot.id, at: now}].slice(-12);
    return {shot: null, lostAt: null, recent, hidden};
}

/** The switch from the address: `?watch=1` starts it at once, `?watch=0` never starts it by itself. */
export function arkWatchParam(search: string | null | undefined): "on" | "off" | null {
    try {
        const v = new URLSearchParams(search ?? "").get("watch");
        return v === "1" ? "on" : v === "0" ? "off" : null;
    } catch {
        return null;
    }
}
