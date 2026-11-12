/**
 * What the tap card says of an animal's behaviour state: the page's light half of `behaviour-state.ts` (no sea, map or
 * scenery modules), so /ark's first JavaScript stays free of the scene (decision 246).
 */

import type {ArkBehaviourState} from "@/ark-scene/behaviour-state";

/** What the tap card says of a state: "Asleep now" or nothing. */
export function cardSaysAsleep(state: ArkBehaviourState | null | undefined): boolean {
    return Boolean(state?.asleep);
}
