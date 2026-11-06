"use client";

/**
 * What the Talk front door keeps in this browser (lib/talk-front-door):
 *
 * - the unsent draft (localStorage), so coming back shows it (SPEC 4.4);
 * - the message on its way to the chat it opens (sessionStorage, and this
 *   tab's memory when storage is refused), taken once by that chat's
 *   conversation, which sends it as the person's first message. Only then is
 *   the draft cleared: a chat that never took it (or whose gate was refused)
 *   leaves the draft in the box.
 *
 * Every read and write is guarded: a private window or blocked storage
 * keeps the draft for this page only, and the handoff in memory.
 */

import {
    FRONT_DOOR_DRAFT_KEY,
    FRONT_DOOR_HANDOFF_KEY,
    FRONT_DOOR_TEXT_MAX,
    decodeFrontDoorHandoff,
    handoffMatches,
    type FrontDoorHandoff
} from "@/lib/talk-front-door";

function local(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function session(): Storage | null {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

export function readFrontDoorDraft(): string {
    try {
        return (local()?.getItem(FRONT_DOOR_DRAFT_KEY) ?? "").slice(0, FRONT_DOOR_TEXT_MAX);
    } catch {
        return "";
    }
}

export function writeFrontDoorDraft(text: string) {
    try {
        const store = local();
        if (!store) return;
        if (text.trim()) store.setItem(FRONT_DOOR_DRAFT_KEY, text.slice(0, FRONT_DOOR_TEXT_MAX));
        else store.removeItem(FRONT_DOOR_DRAFT_KEY);
    } catch {
        // Kept for this page only.
    }
}

let memory: FrontDoorHandoff | null = null;

function readHandoff(): FrontDoorHandoff | null {
    try {
        return decodeFrontDoorHandoff(session()?.getItem(FRONT_DOOR_HANDOFF_KEY)) ?? memory;
    } catch {
        return memory;
    }
}

/**
 * Forgets a message no chat took. The box is on screen again, so they are not
 * in that chat: its draft is back in the box, and opening the chat later must
 * not send it for them.
 */
export function clearFrontDoorHandoff() {
    memory = null;
    try {
        session()?.removeItem(FRONT_DOOR_HANDOFF_KEY);
    } catch {
        // Memory is cleared; that is enough for this tab.
    }
}

/** The message, on its way to the chat about to open. */
export function handOffFrontDoorMessage(handoff: FrontDoorHandoff) {
    memory = handoff;
    try {
        session()?.setItem(FRONT_DOOR_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
        // This tab's memory carries it.
    }
}

type ChatKey = {captureId: string | null; slug: string | null; speciesProfileId?: string | null};

/** Whether a message from the front door is waiting for this chat (it says no hello then). */
export function frontDoorMessageWaiting(chat: ChatKey): boolean {
    return handoffMatches(readHandoff(), chat, Date.now());
}

/** The message for this chat, taken once. The chat clears the draft once it sends it (`clearFrontDoorDraft`). */
export function takeFrontDoorMessage(chat: ChatKey): string | null {
    const handoff = readHandoff();
    if (!handoffMatches(handoff, chat, Date.now()) || !handoff) return null;
    clearFrontDoorHandoff();
    return handoff.text;
}

/** The draft was sent: the box is empty when they come back. */
export function clearFrontDoorDraft() {
    writeFrontDoorDraft("");
}
