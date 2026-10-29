"use client";

/**
 * The animals that write to you, for the whole tab (iOS
 * `AppState.animalConversations` and `unreadAnimalMessageCount`): what the
 * Companions rows say about their messages, and the unread count on the
 * Companions tab.
 *
 * The badge reads the cheap count until the list is loaded, then the list;
 * opening an animal's chat marks its messages read and the server answers
 * what is left, so the badge drops at once. A failed read leaves what was
 * shown before.
 */

import {useEffect, useSyncExternalStore} from "react";
import {decodeAnimalConversations, unreadAnimalMessages, type AnimalConversation} from "@/lib/companion-rows";

type Snapshot = {conversations: AnimalConversation[]; didLoad: boolean; unread: number | null};

let snapshot: Snapshot = {conversations: [], didLoad: false, unread: null};
let inFlight: Promise<void> | null = null;
let countInFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: Snapshot = {conversations: [], didLoad: false, unread: null};

function emit(next: Snapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function reloadAnimalConversations(): Promise<void> {
    if (inFlight) return inFlight;
    inFlight = fetch("/api/ask/animal-messages", {headers: {Accept: "application/json"}, cache: "no-store"})
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: {conversations?: unknown; available?: boolean} | null) => {
            if (!payload || payload.available === false) {
                emit({...snapshot, didLoad: true});
                return;
            }
            const conversations = decodeAnimalConversations(payload.conversations);
            emit({conversations, didLoad: true, unread: unreadAnimalMessages(conversations)});
        })
        .catch(() => emit({...snapshot, didLoad: true}))
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
}

function reloadUnreadCount(): Promise<void> {
    if (countInFlight) return countInFlight;
    countInFlight = fetch("/api/ask/animal-messages?view=unread", {headers: {Accept: "application/json"}, cache: "no-store"})
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: {unread?: unknown} | null) => {
            if (typeof payload?.unread === "number" && !snapshot.didLoad) emit({...snapshot, unread: payload.unread});
        })
        .catch(() => undefined)
        .finally(() => {
            countInFlight = null;
        });
    return countInFlight;
}

/** Everything you talk with, and what is unread. */
export function useAnimalConversations(enabled = true) {
    const state = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
    useEffect(() => {
        if (enabled && !state.didLoad) void reloadAnimalConversations();
    }, [enabled, state.didLoad]);
    return {...state, reload: reloadAnimalConversations};
}

/** Unread animal messages across every animal, for the Companions tab. */
export function useUnreadAnimalMessages(enabled: boolean): number {
    const state = useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
    useEffect(() => {
        if (enabled && state.unread === null) void reloadUnreadCount();
    }, [enabled, state.unread]);
    return enabled ? state.unread ?? 0 : 0;
}

/**
 * The chat read this animal's messages. `remaining` is what the server says
 * is left unread across every animal (`mark_animal_messages_read`).
 */
export function noteAnimalMessagesRead(speciesProfileId: string, remaining: number | null) {
    const species = speciesProfileId.toLowerCase();
    const conversations = snapshot.conversations.map((conversation) =>
        conversation.speciesProfileId === species ? {...conversation, unreadCount: 0} : conversation);
    emit({
        ...snapshot,
        conversations,
        unread: remaining ?? (snapshot.didLoad ? unreadAnimalMessages(conversations) : snapshot.unread)
    });
}

/** The animal was muted or unmuted (from its chat, or here). */
export function noteAnimalMessagesMuted(speciesProfileId: string, muted: boolean) {
    const species = speciesProfileId.toLowerCase();
    emit({
        ...snapshot,
        conversations: snapshot.conversations.map((conversation) =>
            conversation.speciesProfileId === species ? {...conversation, muted} : conversation)
    });
}

/** Mute or unmute an animal: shown at once, put back if the server says no. Resolves whether it went through. */
export async function setAnimalMessagesMuted(speciesProfileId: string, muted: boolean): Promise<boolean> {
    const before = snapshot.conversations.find((conversation) => conversation.speciesProfileId === speciesProfileId.toLowerCase())?.muted ?? !muted;
    noteAnimalMessagesMuted(speciesProfileId, muted);
    try {
        const response = await fetch("/api/ask/animal-messages", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "mute", speciesProfileId, muted})
        });
        if (!response.ok) throw new Error(String(response.status));
        const payload = await response.json() as {muted?: boolean};
        noteAnimalMessagesMuted(speciesProfileId, payload.muted === true);
        return payload.muted === muted;
    } catch {
        noteAnimalMessagesMuted(speciesProfileId, before);
        return false;
    }
}
