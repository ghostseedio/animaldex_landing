"use client";

/**
 * Their own animals for the Talk front door (lib/talk-front-door): one per
 * species, as the Companions roster names them, each on the card its chat
 * opens on (the one they last talked through here, else the newest), with
 * when they last talked to it (the server's, or this browser's last message),
 * when its row last moved and when they caught it. From the shared stores
 * the Companions tab and the Talk sidebar already read: nothing is fetched
 * twice.
 */

import {useMemo} from "react";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {useTalkThreads} from "@/components/ask-animaldex/use-talk-threads";
import {useAnimalConversations} from "@/components/companions/use-animal-conversations";
import {chatCaptureIdFor, useCompanionCards, useCompanions} from "@/components/companions/use-companions";
import {askThreadKey} from "@/lib/ask-animaldex/thread";
import {COMPANION_WORDS_EN, type CompanionWords} from "@/lib/companion-bond";
import {cardsOfSpecies} from "@/lib/companion-cards";
import {buildCompanionRows} from "@/lib/companion-rows";
import {frontDoorSpeciesKey, type OwnFrontDoorAnimal} from "@/lib/talk-front-door";

function at(raw: string | null | undefined): number | null {
    const value = raw ? Date.parse(raw) : Number.NaN;
    return Number.isFinite(value) ? value : null;
}

function latest(...values: Array<number | null>): number | null {
    const known = values.filter((value): value is number => value !== null);
    return known.length > 0 ? Math.max(...known) : null;
}

/** When they last said something on this card's thread in this browser. */
function lastSaidHere(captureId: string): number | null {
    const messages = askSessionStore.messages(askThreadKey({scope: "species", captureId}));
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") return at(messages[index].createdAt);
    }
    return null;
}

export function useFrontDoorOwnAnimals(enabled: boolean, words: CompanionWords = COMPANION_WORDS_EN): {animals: OwnFrontDoorAnimal[]; loaded: boolean} {
    const {rows: companions, didLoad} = useCompanions(enabled);
    const {cards, didLoad: cardsLoaded} = useCompanionCards(enabled);
    const {conversations} = useAnimalConversations(enabled);
    // A message sent here moves "talked to last".
    const threads = useTalkThreads();
    const animals = useMemo(() => {
        if (!enabled) return [];
        const talked = new Map(conversations.map((conversation) => [conversation.speciesProfileId, at(conversation.lastTalkedAt)]));
        return buildCompanionRows({companions, conversations, cards, words}).flatMap((row): OwnFrontDoorAnimal[] => {
            const captureId = chatCaptureIdFor(cards, row.speciesProfileId, row.captureId);
            if (!captureId) return [];
            const caught = cardsOfSpecies(cards, row.speciesProfileId).map((card) => at(card.capturedAt));
            return [{
                key: frontDoorSpeciesKey(row.speciesProfileId),
                kind: "own",
                speciesProfileId: row.speciesProfileId,
                captureId,
                slug: row.slug,
                name: row.displayName,
                power: row.powerName,
                lastTalkedAt: latest(talked.get(row.speciesProfileId) ?? null, lastSaidHere(captureId)),
                lastActivityAt: row.lastActivityAt,
                capturedAt: latest(...caught)
            }];
        });
        // `threads` is the signal that this browser's chats changed; lastSaidHere reads them.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, companions, conversations, cards, words, threads]);
    return {animals, loaded: !enabled || (didLoad && cardsLoaded)};
}
