/**
 * The message model, and the thread persistence behind it.
 *
 * Ported from `AnimalPowerAskMessage` and `AnimalPowerAskDiskCache` on iOS. The
 * store is `localStorage` rather than a file in the caches directory, but the
 * rules are the same ones, and they are the interesting part: an in-flight or
 * failed turn is session-scoped, a restored "thinking" row would spin forever
 * with no request behind it, and a restored failure would offer a retry for an
 * error the reader moved past days ago.
 *
 * Storage is passed in rather than read from `window`, so the trimming rules
 * are testable and a private-mode browser that throws on access degrades to an
 * in-memory thread instead of breaking the drawer.
 */

export type AskMessageRole = "user" | "assistant";

export type AskMessageStatus =
    | "complete"
    /** Request sent, nothing back yet. */
    | "thinking"
    /** Answer text is arriving; the message is renderable but unfinished. */
    | "streaming"
    | "failed";

export type AskMessage = {
    id: string;
    role: AskMessageRole;
    text: string;
    status: AskMessageStatus;
    followUpPrompts: string[];
    /** ISO 8601, so the stored form survives a JSON round trip. */
    createdAt: string;
};

export type AskThreads = Record<string, AskMessage[]>;

export const ASK_THREAD_STORAGE_KEY = "animaldex:ask:threads-v1";
export const ASK_THREAD_SCHEMA_VERSION = 1;

/** Threads older than this are dropped on load. */
export const ASK_THREAD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Per-thread message cap; oldest are trimmed first. */
export const ASK_THREAD_MAX_MESSAGES = 60;
/** Total threads retained, most recently active first. */
export const ASK_THREAD_MAX_THREADS = 30;

type AskThreadSnapshot = {
    schemaVersion: number;
    savedAt: string;
    threads: AskThreads;
};

/** Where a conversation is filed. One animal, one capture, or the site at large. */
export function askThreadKey(subject: {scope: "species" | "general"; slug?: string | null; captureId?: string | null; trialKey?: string | null}) {
    // A Trial conversation is its own thread, never a continuation of the animal's.
    if (subject.trialKey) return `trial:${subject.trialKey}`;
    if (subject.captureId) return `capture:${subject.captureId}`;
    if (subject.scope === "species" && subject.slug) return `species:${subject.slug}`;
    return "general";
}

export function createAskMessage(
    role: AskMessageRole,
    text: string,
    overrides: Partial<Omit<AskMessage, "role" | "text">> = {}
): AskMessage {
    return {
        id: overrides.id ?? newAskMessageId(),
        role,
        text,
        status: overrides.status ?? "complete",
        followUpPrompts: overrides.followUpPrompts ?? [],
        createdAt: overrides.createdAt ?? new Date().toISOString()
    };
}

export function newAskMessageId(): string {
    const cryptoRef = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
    if (cryptoRef && typeof cryptoRef.randomUUID === "function") return cryptoRef.randomUUID();
    return `ask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * In-flight and failed turns are session-scoped, and a question whose answer
 * was never persisted goes with it — otherwise a reopened thread ends on a
 * question nothing ever answered.
 */
export function persistableAskMessages(messages: AskMessage[]): AskMessage[] {
    const kept = messages.filter((message) => message.status === "complete");
    while (kept.length > 0 && kept[kept.length - 1].role === "user") {
        kept.pop();
    }
    return kept;
}

export function trimAskThreads(threads: AskThreads): AskThreads {
    const usable: AskThreads = {};
    for (const [key, messages] of Object.entries(threads)) {
        const persistable = persistableAskMessages(messages).slice(-ASK_THREAD_MAX_MESSAGES);
        if (persistable.length > 0) usable[key] = persistable;
    }

    const keys = Object.keys(usable);
    if (keys.length <= ASK_THREAD_MAX_THREADS) return usable;

    const lastActivity = (key: string) => {
        const last = usable[key][usable[key].length - 1];
        return last ? Date.parse(last.createdAt) || 0 : 0;
    };
    const mostRecent = keys
        .sort((left, right) => lastActivity(right) - lastActivity(left))
        .slice(0, ASK_THREAD_MAX_THREADS);

    const trimmed: AskThreads = {};
    for (const key of mostRecent) trimmed[key] = usable[key];
    return trimmed;
}

function normalizeMessage(value: unknown): AskMessage | null {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    const role = row.role === "user" || row.role === "assistant" ? row.role : null;
    const text = typeof row.text === "string" ? row.text : null;
    if (!role || text === null) return null;
    const status: AskMessageStatus = row.status === "complete"
        || row.status === "thinking"
        || row.status === "streaming"
        || row.status === "failed"
        ? row.status
        : "complete";
    return {
        id: typeof row.id === "string" && row.id ? row.id : newAskMessageId(),
        role,
        text,
        status,
        followUpPrompts: Array.isArray(row.followUpPrompts)
            ? row.followUpPrompts.filter((item): item is string => typeof item === "string").slice(0, 3)
            : [],
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString()
    };
}

export type AskThreadStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadAskThreads(storage: AskThreadStorage | null, now = Date.now()): AskThreads {
    if (!storage) return {};
    let raw: string | null = null;
    try {
        raw = storage.getItem(ASK_THREAD_STORAGE_KEY);
    } catch {
        // Private mode, blocked site data, or a storage quota error. A reader
        // still gets a working thread; it just does not outlive the tab.
        return {};
    }
    if (!raw) return {};

    let snapshot: AskThreadSnapshot | null = null;
    try {
        snapshot = JSON.parse(raw) as AskThreadSnapshot;
    } catch {
        return {};
    }
    if (!snapshot || snapshot.schemaVersion !== ASK_THREAD_SCHEMA_VERSION) return {};
    const savedAt = Date.parse(snapshot.savedAt ?? "");
    if (!Number.isFinite(savedAt) || now - savedAt > ASK_THREAD_MAX_AGE_MS) return {};

    const threads: AskThreads = {};
    for (const [key, messages] of Object.entries(snapshot.threads ?? {})) {
        if (!Array.isArray(messages)) continue;
        const restored = persistableAskMessages(
            messages
                .map(normalizeMessage)
                .filter((message): message is AskMessage => message !== null)
        );
        if (restored.length > 0) threads[key] = restored;
    }
    return threads;
}

export function saveAskThreads(storage: AskThreadStorage | null, threads: AskThreads) {
    if (!storage) return;
    const trimmed = trimAskThreads(threads);
    try {
        if (Object.keys(trimmed).length === 0) {
            storage.removeItem(ASK_THREAD_STORAGE_KEY);
            return;
        }
        const snapshot: AskThreadSnapshot = {
            schemaVersion: ASK_THREAD_SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            threads: trimmed
        };
        storage.setItem(ASK_THREAD_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
        // Nothing the reader can act on, and the thread is still on screen.
    }
}
