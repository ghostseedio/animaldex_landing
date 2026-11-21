/**
 * The quiet line in a card's thread once the animal that card brought aboard
 * has died on the Ark for good (AnimalDex docs/ark/chat-is-ark.md section 3,
 * plan `chat-tools-plan.md` 5.2; decision 438). It is not a stored message: a
 * stored `system` row would break the frozen 3.3 iOS decoder, so every client
 * draws it from `voyage_capture_lives_v1` (status `gone`, `died_at`), the
 * owner's own card only. Text from the word catalogue, never the animal's
 * voice, no last words:
 *
 *   "Your House Fly's life on the Ark has ended. It lived there for 8 days."
 *
 * with "See its kind in the Ark" (the Ark, flown to its kind: the animal
 * itself is no longer there). A death that spends a heart is not final
 * (`recovering`): no line; the chat's animal is resting, and says so itself.
 */

export type ArkCardDeath = {
    animalId: string;
    diedAt: string;
    /** `eaten`, `starved`, `died_old`, or another way its life ended; never shown, kept for the memorial. */
    deathKind: string | null;
    /** Lives it lived there (its returns plus the last). */
    lives: number;
    /** Real days from coming aboard to its death; null when its arrival is not known. */
    daysAboard: number | null;
};

export type ArkCardDeathWords = {
    deathEnded: string;
    deathLivedOne: string;
    deathLivedMany: string;
    deathSee: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown, max = 80): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

/**
 * The line's facts from `voyage_capture_lives_v1` (and the animal's arrival,
 * `voyage_animal_life_v1` `origin.at`), or null: hearts off, someone else's
 * card, no animal, alive or recovering, or a shape it does not know.
 */
export function decodeArkCardDeath(lives: unknown, arrivedAt: string | null = null): ArkCardDeath | null {
    if (!lives || typeof lives !== "object" || Array.isArray(lives)) return null;
    const row = lives as Record<string, unknown>;
    if (row.ark_hearts !== true || row.status !== "gone") return null;
    const animalId = text(row.animal_id, 40);
    const diedAt = text(row.died_at, 40);
    if (!animalId || !UUID.test(animalId) || !diedAt || !Number.isFinite(Date.parse(diedAt))) return null;
    const revives = Number(row.revives);
    const arrived = arrivedAt ? Date.parse(arrivedAt) : NaN;
    const span = Date.parse(diedAt) - arrived;
    return {
        animalId: animalId.toLowerCase(),
        diedAt,
        deathKind: text(row.death_kind, 40),
        lives: Math.max(1, Math.min(4, (Number.isFinite(revives) ? Math.floor(revives) : 0) + 1)),
        daysAboard: Number.isFinite(span) && span >= 0 ? Math.max(1, Math.round(span / DAY_MS)) : null
    };
}

/** The line's words: what ended, and how long it lived there when that is known. */
export function arkCardDeathLines(death: ArkCardDeath, species: string, words: ArkCardDeathWords, locale = "en"): {ended: string; lived: string | null} {
    const ended = words.deathEnded.replace("{species}", species);
    if (death.daysAboard === null) return {ended, lived: null};
    const days = new Intl.NumberFormat(locale).format(death.daysAboard);
    return {ended, lived: death.daysAboard === 1 ? words.deathLivedOne : words.deathLivedMany.replace("{days}", days)};
}

/**
 * Where the line sits: after the last message sent at or before the death,
 * so the thread reads in order. `null`: before every message (it died before
 * they first talked); `"end"` with no messages.
 */
export function arkCardDeathAnchor(death: ArkCardDeath, messages: ReadonlyArray<{id: string; createdAt: string}>): string | null | "end" {
    if (messages.length === 0) return "end";
    const at = Date.parse(death.diedAt);
    let anchor: string | null = null;
    for (const message of messages) {
        const sent = Date.parse(message.createdAt);
        // A message with no readable time follows the one before it.
        if (!Number.isFinite(sent) || sent <= at) anchor = message.id;
        else break;
    }
    return anchor;
}
