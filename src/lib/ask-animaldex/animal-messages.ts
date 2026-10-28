/**
 * The messages an animal writes to its owner by itself (`animal_messages`,
 * AnimalDex 51293f02), as they join the owner's chat with it: each as a
 * finished reply under the server's own id, in time order. Unread ones always
 * join; read ones only when they are newer than anything in the thread, so a
 * cleared or trimmed thread never fills back up with old ones. Port of the
 * apps' `AnimalMessageDelivery`. Pure.
 */

import type {AskMessage} from "@/lib/ask-animaldex/thread";

export type AskAnimalInboxMessage = {
    id: string;
    body: string;
    createdAt: string;
    unread: boolean;
};

/** Rows from `animal_messages_for`, kept only when whole. */
export function parseAskAnimalMessages(raw: unknown): AskAnimalInboxMessage[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item): AskAnimalInboxMessage[] => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        const id = typeof row?.id === "string" ? row.id : null;
        const body = typeof row?.body === "string" ? row.body.trim() : "";
        const createdAt = typeof row?.created_at === "string" && Number.isFinite(Date.parse(row.created_at)) ? row.created_at : null;
        if (!id || !body || !createdAt) return [];
        return [{id, body, createdAt, unread: row?.read_at === null || row?.read_at === undefined}];
    });
}

function time(iso: string): number {
    return Date.parse(iso) || 0;
}

/** The messages that should join this thread now, oldest first. */
export function deliverableAskAnimalMessages(incoming: AskAnimalInboxMessage[], thread: AskMessage[]): AskAnimalInboxMessage[] {
    const existing = new Set(thread.flatMap((message) => [message.id, message.animalMessageId ?? ""]).filter(Boolean));
    const newestInThread = thread.length > 0 ? Math.max(...thread.map((message) => time(message.createdAt))) : null;
    const seen = new Set<string>();
    return incoming
        .filter((message) => {
            if (existing.has(message.id) || seen.has(message.id)) return false;
            seen.add(message.id);
            if (!message.body.trim()) return false;
            if (message.unread) return true;
            return newestInThread !== null && time(message.createdAt) > newestInThread;
        })
        .sort((left, right) => time(left.createdAt) - time(right.createdAt));
}

/**
 * The thread with the animal's messages in it: each after everything said at
 * or before it, which is the end of the thread unless it was written while an
 * older conversation was still going on.
 */
export function mergeAskAnimalMessages(
    incoming: AskAnimalInboxMessage[],
    thread: AskMessage[],
    make: (message: AskAnimalInboxMessage) => AskMessage
): {messages: AskMessage[]; merged: string[]} {
    const joining = deliverableAskAnimalMessages(incoming, thread);
    if (joining.length === 0) return {messages: thread, merged: []};
    const messages = [...thread];
    for (const message of joining) {
        let index = 0;
        for (let at = messages.length - 1; at >= 0; at -= 1) {
            if (time(messages[at].createdAt) <= time(message.createdAt)) {
                index = at + 1;
                break;
            }
        }
        messages.splice(index, 0, make(message));
    }
    return {messages, merged: joining.map((message) => message.id)};
}
