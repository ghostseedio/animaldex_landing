"use client";

/**
 * Their animals as the Companions page lists them (polish pass, DESIGN.md
 * section 1): the bond's rows with the conversations, the cards and the
 * chats kept in this browser, sorted by what needs them. The Companions page
 * and the app's side menu (the owner, 2026-11-06) read the same rows.
 */

import {useCallback, useEffect, useMemo, useState} from "react";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {useTalkThreads} from "@/components/ask-animaldex/use-talk-threads";
import {useAnimalConversations} from "@/components/companions/use-animal-conversations";
import {chatCaptureIdFor, useCompanionCards, useCompanions} from "@/components/companions/use-companions";
import {useOpenStepUpdates} from "@/components/companions/use-steps";
import {askThreadKey} from "@/lib/ask-animaldex/thread";
import type {CompanionWords} from "@/lib/companion-bond";
import type {CompanionCard} from "@/lib/companion-cards";
import {rosterLastAt, rosterLine, sortCompanionRoster, type RosterLocalLast} from "@/lib/companion-roster";
import {animalMessagePreviewText, buildCompanionRows, type CompanionTabRow} from "@/lib/companion-rows";
import type {AnimalStep} from "@/lib/your-step";

export type CompanionRosterEntry = {row: CompanionTabRow; line: ReturnType<typeof rosterLine>; time: number | null};

/** The newest message on the animal's chat in this browser, yours or its. */
function localLastOf(cards: CompanionCard[], row: CompanionTabRow): RosterLocalLast {
    const captureId = chatCaptureIdFor(cards, row.speciesProfileId, row.captureId);
    if (!captureId) return null;
    const messages = askSessionStore.messages(askThreadKey({scope: "species", captureId}));
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.status !== "complete" || !message.text.trim()) continue;
        const at = Date.parse(message.createdAt);
        const text = animalMessagePreviewText(message.text);
        return text && Number.isFinite(at) ? {text, at} : null;
    }
    return null;
}

export function useCompanionRoster(words: CompanionWords, enabled = true) {
    const {rows: companions, didLoad, available, reload} = useCompanions(enabled);
    const {cards, didLoad: cardsLoaded, available: cardsAvailable, reload: reloadCards} = useCompanionCards(enabled);
    // Signed out (the side menu passes enabled = false), nothing is read: the
    // list answered 401 on every page a visitor opened.
    const {conversations, reload: reloadConversations} = useAnimalConversations(enabled);
    // Read again when a thread changes here: a message sent moves its row and its line.
    const threads = useTalkThreads();
    // A step accepted, dropped or finished in a chat changes its row at once.
    const [stepOverrides, setStepOverrides] = useState<ReadonlyMap<string, string | null>>(() => new Map());
    useOpenStepUpdates(null, useCallback((step: AnimalStep | null, speciesProfileId: string) => {
        setStepOverrides((current) => new Map(current).set(speciesProfileId, step?.step ?? null));
    }, []));

    useEffect(() => {
        if (!enabled) return;
        const refresh = () => {
            void reload();
            void reloadCards();
            void reloadConversations();
        };
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [enabled, reload, reloadCards, reloadConversations]);
    // The server's list is the truth again once it has been read after a change.
    useEffect(() => setStepOverrides(new Map()), [companions]);

    const entries = useMemo<CompanionRosterEntry[]>(() => {
        const rows = buildCompanionRows({companions, conversations, cards, words}).map((row) =>
            stepOverrides.has(row.speciesProfileId) ? {...row, openStep: stepOverrides.get(row.speciesProfileId) ?? null} : row);
        const local = new Map(rows.map((row) => [row.speciesProfileId, localLastOf(cards, row)]));
        const localOf = (row: CompanionTabRow) => local.get(row.speciesProfileId) ?? null;
        return sortCompanionRoster(rows, localOf).map((row) => ({
            row,
            line: rosterLine(row, localOf(row), words),
            // The time only once there is a conversation to date.
            time: row.hasConversation || localOf(row) ? rosterLastAt(row, localOf(row)) : null
        }));
        // `threads` is the signal that this browser's chats changed; the rows read them through localLastOf.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companions, conversations, cards, words, stepOverrides, threads]);

    return {entries, cards, didLoad, cardsLoaded, available, cardsAvailable};
}

/** The side menu picked an animal: the Companions chat, wherever it is, opens it. */
export const COMPANIONS_SWITCH_EVENT = "animaldex:companions-switch";
