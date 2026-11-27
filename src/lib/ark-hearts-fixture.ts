/**
 * Development's hearts (`/ark?fixture=1&hearts=1`): the fixture as the server's hearts read would answer for an owner,
 * in the contract's shapes (AnimalDex docs/ark/HEARTS-LIVES-DESIGN.md, section 6). Made-up data, never in production:
 * the first arrived animal is the reader's with 2 hearts, the second with 3, and the third is away recovering (taken
 * out of the snapshot, as the server's reads leave a recovering animal out), back in about a day.
 */

import type {ArkSnapshot} from "@/ark-scene/types";
import {ARK_HEART_COST, type ArkOwnerHearts} from "@/lib/ark-hearts";
import type {ArkHeartsRules} from "@/lib/ark-hearts-rules";

const CARD = (n: number) => `00000000-0000-4000-8000-0000000c${String(n).padStart(4, "0")}`;

/**
 * `rules`: the server's hearts rule as `/api/ark/hearts` would read it out (`&rules=final|return|off`): a heart a survived
 * attack (old age final, or still returning), or today's lives. The third animal then recovers from what that rule says
 * (`cause`: a hunt it survived, else the old rule's death).
 */
export function arkHeartsFixture(snapshot: ArkSnapshot, now = Date.now(), rules: ArkHeartsRules | null = null): {snapshot: ArkSnapshot; hearts: ArkOwnerHearts} {
    const arrived = snapshot.animals.filter((animal) => animal.origin !== "born" && !animal.placeholder);
    const [first, second, away] = arrived;
    const hearts: ArkOwnerHearts = {healCost: ARK_HEART_COST, animals: {}, ...(rules ? {rules} : {})};
    if (first) hearts.animals[first.id] = {id: first.id, captureId: CARD(1), hearts: 2, status: "present", returnsAt: null, cause: null, revives: 1, name: null, modelSlug: null};
    if (second) hearts.animals[second.id] = {id: second.id, captureId: CARD(2), hearts: 3, status: "present", returnsAt: null, cause: null, revives: 0, name: null, modelSlug: null};
    if (away) hearts.animals[away.id] = {id: away.id, captureId: CARD(3), hearts: 1, status: "recovering", returnsAt: new Date(now + 22 * 3_600_000).toISOString(), cause: "eaten", revives: 2, name: away.name, modelSlug: away.model_slug};
    const mine = new Set([first?.id, second?.id].filter(Boolean));
    const animals = snapshot.animals.filter((animal) => animal.id !== away?.id).map((animal) => (mine.has(animal.id) ? {...animal, mine: true} : animal));
    return {snapshot: {...snapshot, animals, counts: {...snapshot.counts, animals: animals.length}}, hearts};
}
