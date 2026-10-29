/**
 * Every card you hold, as the Companions tab and the group picker read them
 * (`/api/app/companions/cards`): one row per card, its species folded into
 * the canonical one the bond and the animal's messages are kept under.
 *
 * And which of your cards of an animal its chat opens on. Threads live in
 * this browser, one per card, and the server names the newest card of the
 * species; catching the animal again would open an empty thread. The card
 * you last talked through wins, else the server's (iOS 5c980123,
 * `AnimalMessageDelivery.chatCaptureID`). Pure.
 */

export type CompanionCard = {
    captureId: string;
    /** The canonical species. */
    speciesProfileId: string;
    animal: string;
    /** `captures.title`, the name its owner gave it. */
    nickname: string | null;
    /** The species' icon-art slug. */
    slug: string | null;
    capturedAt: string | null;
};

function object(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The cards, newest first as the server sent them; a row without a card or a species is left out. */
export function decodeCompanionCards(raw: unknown): CompanionCard[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return raw.flatMap((item): CompanionCard[] => {
        const row = object(item);
        const captureId = str(row?.capture_id)?.toLowerCase();
        const speciesProfileId = str(row?.species_profile_id)?.toLowerCase();
        if (!row || !captureId || !speciesProfileId || seen.has(captureId)) return [];
        seen.add(captureId);
        return [{
            captureId,
            speciesProfileId,
            animal: str(row.animal) ?? "",
            nickname: str(row.nickname),
            slug: str(row.slug),
            capturedAt: str(row.captured_at)
        }];
    });
}

/** Your cards of one animal. */
export function cardsOfSpecies(cards: CompanionCard[], speciesProfileId: string | null | undefined): CompanionCard[] {
    const wanted = speciesProfileId?.trim().toLowerCase();
    return wanted ? cards.filter((card) => card.speciesProfileId === wanted) : [];
}

/**
 * Of your cards of one species, the one whose conversation was last active in
 * this browser; `fallback` (the server's card) when none has one.
 */
export function chatCaptureId(
    cardIds: string[],
    lastSaid: (captureId: string) => number | null,
    fallback: string | null
): string | null {
    let best: {id: string; at: number} | null = null;
    for (const id of cardIds) {
        const at = lastSaid(id);
        if (at === null || !Number.isFinite(at)) continue;
        if (!best || at > best.at) best = {id, at};
    }
    return best?.id ?? fallback;
}
