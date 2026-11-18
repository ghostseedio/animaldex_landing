/**
 * The crisis layer in the live log and Ark Lite's "Latest on the Ark" (AnimalDex E4, `docs/ark/crises-e4.md`, behind
 * `voyage_config.crises`): the record's `crisis`, `saved`, `extinct_wild` and `returned_to_care` rows, said calmly and by
 * species only. The server decides every one; this only says it.
 *
 * - `crisis`: a kind in the wild fell to two or one (or moved between them): "Giant Panda: only a few left in the wild".
 * - `saved`: that crisis ended, an arrival or a birth: "Giant Panda: out of danger in the wild".
 * - `extinct_wild`: the last wild animal of a kind is gone (a lone founder's kind too): "Giant Panda: none left in the
 *   wild". Not "extinct": the Ark's own extinction line (`extinction`, Lost from the Ark) is another thing, and a kind
 *   that is gone from the wild may live on in the zoo.
 * - `returned_to_care`: a recovering animal came back into the zoo, not the wild: "Giant Panda: now cared for in the zoo".
 *
 * The public read sends none of their payload (no band, count, cause, bringer or person), so a line says only the kind
 * and what happened. Every line is the kind, a colon, and a phrase with no verb that agrees with an animal's sex or
 * number (in any language: see `src/data/locales/ark/*.json`, `ark.live.crisis` and the three after it), never a count,
 * never an internal kind name. A row without a name says nothing.
 *
 * With the scene (the controller) and with Ark Lite, never in the Ark page's static JavaScript (decision 371).
 */

import type {ArkEvent} from "@/lib/ark-life";
import {arkLiveServerItems, type ArkLiveFocus, type ArkLiveItem, type ArkLiveText} from "@/lib/ark-live-log";
import {ARK_LIVE_ENGLISH} from "@/lib/ark-live-words";
import {fillArkWords} from "@/lib/ark-words";

type CrisisKind = "crisis" | "saved" | "wildGone" | "toCare";
const KIND_OF: Record<string, CrisisKind> = {crisis: "crisis", saved: "saved", extinct_wild: "wildGone", returned_to_care: "toCare"};

/** The crisis layer's rows as log items, oldest first (the rest of the record is `arkLiveServerItems`). */
export function crisisItems(events: readonly ArkEvent[]): ArkLiveItem[] {
    const items: ArkLiveItem[] = [];
    for (const event of events) {
        const kind = KIND_OF[event.kind];
        if (!kind) continue;
        const animal = event.animal;
        // A recovering animal's return is about that animal (its name, as its "is back" line beside it); the others are about the kind.
        const name = kind === "toCare" ? animal?.name : event.species?.name || animal?.name;
        if (!name) continue;
        const speciesId = event.species?.id || animal?.species_profile_id || null;
        // Where a tap goes: one of the kind, or (none left in the wild) only the region; a returned animal, itself.
        const focus: ArkLiveFocus = kind === "toCare" ? {animalId: animal?.id ?? null, speciesId: animal?.species_profile_id || null, zone: animal?.zone ?? null} : {animalId: null, speciesId: kind === "wildGone" ? null : speciesId, zone: animal?.zone ?? null};
        items.push({id: event.id, kind, source: "server", key: `${kind}:${kind === "toCare" ? animal?.id : speciesId || name}`, animal: name, other: null, count: 1, eggs: null, focus});
    }
    return items;
}

/** The whole record's lines in the order of the events: `arkLiveServerItems` and the crisis layer's together. */
export function recordItems(events: readonly ArkEvent[]): ArkLiveItem[] {
    const items = arkLiveServerItems(events);
    const own = crisisItems(events);
    if (!own.length) return items;
    const order = new Map(events.map((event, index) => [event.id, index]));
    return [...items, ...own].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** A crisis line's words (one line however many were folded in: a repeat says nothing more), or null for any other line. */
export function crisisText(line: Pick<ArkLiveItem, "kind" | "animal">, words: Pick<ArkLiveText, "live">): string | null {
    const kind = line.kind;
    if (kind !== "crisis" && kind !== "saved" && kind !== "wildGone" && kind !== "toCare") return null;
    return fillArkWords(words.live[kind] ?? ARK_LIVE_ENGLISH[kind] ?? "{animal}", {animal: line.animal});
}
