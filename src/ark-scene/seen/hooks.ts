/**
 * V1's hooks for what the engine does not publish yet (decision 389: "engine pieces not built yet get clean hooks
 * only, no fakes"). Nothing here is drawn, said or pinned until the public read sends it; each hook says which engine
 * item sends what, and where V1 already takes it.
 *
 * E6 "visible searching from real state" (snapshot fields; no look-ahead: only what a due hunter is doing NOW):
 *   searching     a hunter out on its foray, no quarry yet
 *   stalking      it has found one and is closing on it (`target`: the quarry's id)
 *   chasing       the rush (`target`)
 *   wary          a prey animal that has noticed a hunter near it (`target`: the hunter, when the read names it)
 *   mate_seeking  one in season looking for a mate
 * E5 "hunt styles" (bite-and-wait first):
 *   wounded       bitten and weakening (`since`); ends in its collapse (`death_old`/`starved`-like row with a wound's
 *                 cause, acted by `live-deaths.ts` `cause: "wounds"`) or in its recovery (off the list)
 *
 * WHAT V1 DOES WITH A STATE TODAY (all real, none made up):
 *   - `arkSeenStates(snapshot)` reads them from the read (the proposed field is `animal.state`, see below) and gives
 *     them to `ArkSeen.setStates`, which (1) pins the animal and its target so both are drawn (`live-cast.ts`), (2)
 *     gives the selection its line (`arkSeenStateText`, also Ark Lite's), and (3) hands the wounded to the scene's limp
 *     (`ArkSceneHandle.setWounded`, `live-escapes.ts`).
 * WHAT IS LEFT FOR E6/E5:
 *   - the acting itself: a searching hunter's foray is its schedule's already; a stalk and a chase need the read's
 *     own geometry (as `encounter` gives a meal's), then `live-meals.ts` `approachPose` is where the stalk goes;
 *   - wariness: `reactive.ts` already has `alarmed`/`watch_prey`; a `wary` state would only bias it;
 *   - the words in 44 languages (`ark.seen.*`; English here until then).
 *
 * PROPOSED WIRE SHAPE (to be matched to the server's when E5/E6 write it): on a snapshot animal,
 *   `state: {kind: "stalking", target: "<animal id>", since: "<ISO>"}` (one state; absent: none).
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";

export const ARK_SEEN_STATE_KINDS = ["searching", "stalking", "chasing", "wary", "mate_seeking", "wounded"] as const;
export type ArkSeenStateKind = (typeof ARK_SEEN_STATE_KINDS)[number];
export type ArkSeenState = {id: string; kind: ArkSeenStateKind; target: string | null; /** Epoch seconds, when the read says. */ since: number | null};

/** The proposed field on an animal of the read (not sent yet). */
type WithState = ArkAnimal & {state?: {kind?: unknown; target?: unknown; since?: unknown} | null};

/** The states the read carries (none today: neither E5 nor E6 sends the field). Checked: an unknown kind is dropped. */
export function arkSeenStates(snapshot: ArkSnapshot | null): ArkSeenState[] {
    const out: ArkSeenState[] = [];
    for (const animal of (snapshot?.animals ?? []) as WithState[]) {
        const raw = animal.state;
        if (!raw || typeof raw !== "object" || typeof raw.kind !== "string" || !(ARK_SEEN_STATE_KINDS as readonly string[]).includes(raw.kind)) continue;
        const since = typeof raw.since === "string" ? Date.parse(raw.since) / 1000 : NaN;
        out.push({id: animal.id, kind: raw.kind as ArkSeenStateKind, target: typeof raw.target === "string" && raw.target ? raw.target : null, since: Number.isFinite(since) ? since : null});
    }
    return out;
}

/** The states' and marks' words, English until the Ark's words carry them (`ark.seen`). */
export const ARK_SEEN_ENGLISH = {
    searching: "Searching for prey",
    stalking: "Stalking {aPrey}",
    stalkingNoTarget: "Stalking",
    chasing: "Chasing {aPrey}",
    chasingNoTarget: "Chasing",
    wary: "Wary: a hunter is near",
    mate_seeking: "Looking for a mate",
    wounded: "Wounded",
    lone: "Lone: the only one of its kind in the wild, and it came alone",
    last: "Last one in the wild",
    critical: "Critical: one of two left in the wild"
} as const;
export type ArkSeenWords = Partial<Record<keyof typeof ARK_SEEN_ENGLISH, string>>;

/** A state's line for the selection and for Ark Lite. `targetName`: the target's species, when it is in the read. */
export function arkSeenStateText(state: Pick<ArkSeenState, "kind">, targetName: string | null, words: ArkSeenWords | null = null): string {
    const w = {...ARK_SEEN_ENGLISH, ...(words ?? {})};
    const article = (name: string) => `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
    if (state.kind === "stalking" || state.kind === "chasing") return targetName ? w[state.kind].replace("{aPrey}", article(targetName)) : w[`${state.kind}NoTarget`];
    return w[state.kind];
}
