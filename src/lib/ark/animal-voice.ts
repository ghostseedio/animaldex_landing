/**
 * What the chat's animal is saying, for anything beside the chat that shows
 * it talking (the Ark panel). The conversation tells; listeners follow:
 *
 * - `talking`: it started or stopped answering (typing, streaming or being heard);
 * - `text`: more of its reply appeared on screen (what the reader sees, word by word);
 * - `spoken`: the voice reached its next word, when the reply is heard aloud.
 *
 * Each names the animal (its species slug and canonical id) so a listener
 * beside another chat ignores it. In the browser only; nothing is sent anywhere.
 */

export type AnimalVoiceSubject = {slug: string | null; speciesProfileId: string | null};

export type AnimalVoiceEvent =
    | ({kind: "talking"; active: boolean} & AnimalVoiceSubject)
    | ({kind: "text"; chunk: string} & AnimalVoiceSubject)
    | ({kind: "spoken"} & AnimalVoiceSubject);

type Listener = (event: AnimalVoiceEvent) => void;

const listeners = new Set<Listener>();

export function emitAnimalVoice(event: AnimalVoiceEvent) {
    listeners.forEach((listener) => {
        try {
            listener(event);
        } catch {
            // A listener's trouble is its own.
        }
    });
}

export function onAnimalVoice(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Whether an event is about this animal (by slug, or by canonical species id when both have one). */
export function voiceIsAbout(event: AnimalVoiceSubject, subject: AnimalVoiceSubject): boolean {
    if (event.speciesProfileId && subject.speciesProfileId && event.speciesProfileId === subject.speciesProfileId) return true;
    return Boolean(event.slug && subject.slug && event.slug === subject.slug);
}
