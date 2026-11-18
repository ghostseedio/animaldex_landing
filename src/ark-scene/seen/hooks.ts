/**
 * What an animal is doing now, as the public read says it (decision 389: real, released state only; no look-ahead).
 * Nothing here is drawn, said or pinned until the read sends it.
 *
 * The read: `animal.state = {kind, target?, since?}` (E6, AnimalDex `docs/ark/audits/ecosystem/seen-states-api-contract.md`;
 * behind `voyage_config.visible_searching`, and `hunt_styles` for the two of a bite). At most one state an animal:
 *   searching     a hunter out on its foray now: due, awake, no quarry yet (what it finds is the record's)
 *   stalking      a bite-and-wait hunter following the prey it has bitten (`target`: the bitten one, `since`: the bite)
 *   wounded       an animal a bite-and-wait hunter has bitten (`target`: its biter, `since`: the bite); ends in its
 *                 collapse (the record's, acted by `live-deaths.ts` `cause: "wounds"`) or its healing (off the list)
 *   mate_seeking  an adult in season that the breeding rule leaves without a partner in its place
 * Never sent, so never said: a chase in progress (the engine decides an attempt inside one step: the chase is the
 * record's act, which V1 holds and acts) and wariness (the engine's prey notices nothing).
 *
 * WHAT V1 DOES WITH A STATE (all real, none made up):
 *   - `arkSeenStates(snapshot)` reads them (an unknown kind is dropped: a later kind must not break a reader);
 *   - `attachArkSeen` (1) keeps the wounded, the stalking and the searching drawn, with a stalker's or a wounded one's
 *     other (`arkSeenStatesToPin`: never the mate-seeking, there are a few hundred), (2) gives the selection its line
 *     (`arkSeenStateText`; Ark Lite's list says the same), and (3) hands the wounded to the scene's limp
 *     (`ArkSceneHandle.setWounded`, `live-escapes.ts`).
 *   - A searching hunter's walk is its foray, which the scene computes already; a sleeping one looks asleep (the
 *     scene's own sleep rule wins for the look: a state is the engine's word as of its last step).
 */

import type {ArkSnapshot} from "@/ark-scene/types";

/** The kinds the read sends, in the order two would apply (what is happening to it now before what it waits for). */
export const ARK_SEEN_STATE_KINDS = ["wounded", "stalking", "searching", "mate_seeking"] as const;
export type ArkSeenStateKind = (typeof ARK_SEEN_STATE_KINDS)[number];
export type ArkSeenState = {id: string; kind: ArkSeenStateKind; target: string | null; /** Epoch seconds, when the read says. */ since: number | null};

/** The states the read carries (none while the server's flag is off), in the read's order. An unknown kind is dropped. */
export function arkSeenStates(snapshot: ArkSnapshot | null): ArkSeenState[] {
    const out: ArkSeenState[] = [];
    for (const animal of snapshot?.animals ?? []) {
        const raw = animal.state;
        if (!raw || typeof raw !== "object" || typeof raw.kind !== "string" || !(ARK_SEEN_STATE_KINDS as readonly string[]).includes(raw.kind)) continue;
        const since = typeof raw.since === "string" ? Date.parse(raw.since) / 1000 : NaN;
        out.push({id: animal.id, kind: raw.kind as ArkSeenStateKind, target: typeof raw.target === "string" && raw.target ? raw.target : null, since: Number.isFinite(since) ? since : null});
    }
    return out;
}

/**
 * The states whose animals are kept drawn, at most `most`: the wounded, then the stalking, then the searching (the
 * contract's order). Never the mate-seeking: they are a few hundred, and their line needs nothing drawn.
 */
export function arkSeenStatesToPin(states: readonly ArkSeenState[], most: number): ArkSeenState[] {
    const rank = (state: ArkSeenState) => ARK_SEEN_STATE_KINDS.indexOf(state.kind);
    return states.filter((state) => state.kind !== "mate_seeking").map((state, index) => ({state, index})).sort((a, b) => rank(a.state) - rank(b.state) || a.index - b.index).slice(0, Math.max(0, most)).map((entry) => entry.state);
}

/**
 * The states' and marks' words in English: the fallback under the Ark's own (`ark.seen.*`, `ark.life.lone`,
 * `ark.endangered.last` and `.critical`, and `ark.replay.a` / `.an` for a name with its article), 45 languages.
 */
export const ARK_SEEN_ENGLISH = {
    searching: "Searching for prey",
    stalking: "Stalking {aPrey}",
    stalkingNoTarget: "Stalking",
    mate_seeking: "Looking for a mate",
    wounded: "Wounded",
    // (Short: the selection's box is two bar rows wide. A lone founder: the only wild one of a kind that arrived alone.)
    lone: "Lone founder",
    last: "Last one in the wild",
    critical: "Critical: one of two left in the wild",
    a: "a {animal}",
    an: "an {animal}"
} as const;
export type ArkSeenWords = Partial<Record<keyof typeof ARK_SEEN_ENGLISH, string>>;

/** A state's line for the selection and for Ark Lite. `targetName`: the stalked one's species, when it is in the read. */
export function arkSeenStateText(state: Pick<ArkSeenState, "kind">, targetName: string | null, words: ArkSeenWords | null = null): string {
    const w = {...ARK_SEEN_ENGLISH, ...(words ?? {})};
    // (As the live log's `arkWithArticle`: most languages' `a` and `an` are the name alone.)
    const article = (name: string) => (/^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name) ? w.an : w.a).replace("{animal}", name);
    if (state.kind === "stalking") return targetName ? w.stalking.replace("{aPrey}", article(targetName)) : w.stalkingNoTarget;
    return w[state.kind];
}
