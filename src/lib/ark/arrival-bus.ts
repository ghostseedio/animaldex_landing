/**
 * An animal of the reader's came aboard while its chat was open (Part 2,
 * docs/ark-next.md): the chat tells, and the Ark panel beside it (open now,
 * or opened in the next few minutes) flies to the newcomer with its entrance.
 * In the browser only; nothing is sent anywhere.
 */

import type {ArkAnimal} from "@/ark-scene/types";
import type {AnimalVoiceSubject} from "@/lib/ark/animal-voice";

export type ArkArrivalEvent = AnimalVoiceSubject & {animal: ArkAnimal; at: number};

type Listener = (event: ArkArrivalEvent) => void;

const listeners = new Set<Listener>();
let last: ArkArrivalEvent | null = null;

/** How long a panel opened after the arrival still flies to it. */
const REMEMBERED_MS = 5 * 60_000;

export function emitArkArrival(event: Omit<ArkArrivalEvent, "at">) {
    const told: ArkArrivalEvent = {...event, at: Date.now()};
    last = told;
    listeners.forEach((listener) => {
        try {
            listener(told);
        } catch {
            // A listener's trouble is its own.
        }
    });
}

export function onArkArrival(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** The newest arrival told in the last few minutes, for a panel opening now. */
export function recentArkArrival(now = Date.now()): ArkArrivalEvent | null {
    return last && now - last.at <= REMEMBERED_MS ? last : null;
}
