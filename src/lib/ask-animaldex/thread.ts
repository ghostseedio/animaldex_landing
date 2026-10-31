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

import {normalizeCompanionEvent, type AskCompanionEvent} from "@/lib/ask-animaldex/companion-loop";

export type AskMessageRole = "user" | "assistant";

export type AskMessageStatus =
    | "complete"
    /** Request sent, nothing back yet. */
    | "thinking"
    /** Answer text is arriving; the message is renderable but unfinished. */
    | "streaming"
    | "failed";

/**
 * Why a reply failed at the day's limit, so the drawer can say it in the
 * reader's language and offer their next step: sign in (anon), Pro (a free
 * account), nothing (Pro), or Credits (not enough for another message).
 */
export type AskLimitNotice = "anon" | "free" | "pro" | "credits";

export type AskMessage = {
    id: string;
    role: AskMessageRole;
    text: string;
    status: AskMessageStatus;
    followUpPrompts: string[];
    /** ISO 8601, so the stored form survives a JSON round trip. */
    createdAt: string;
    /** The animal's opening line, said before the reader said anything. */
    isGreeting?: boolean;
    /**
     * What the animal did in this reply in the companion loop: a step of
     * theirs completed, or another of their animals it sent them to.
     */
    companionEvent?: AskCompanionEvent;
    /** On a failed reply only, which are never stored: the limit it ran into. */
    limitNotice?: AskLimitNotice;
    /**
     * A check-in the animal raised in this reply, something the owner asked it
     * to check back on, and what they answered it with once they did.
     */
    followUp?: {id: string; topic: string};
    followUpResolution?: AskFollowUpResolution;
    /** A message the animal wrote by itself (`animal_messages`), by its server id. */
    animalMessageId?: string;
    /** On a failed reply only: why, so the drawer says it in the reader's language. */
    failureKind?: AskFailureKind;
    /**
     * The person's own message that was their report on a step ("I did it",
     * 3.2): the step it reported on, so a retry sends it as the report again.
     */
    stepReportId?: string;
    /**
     * The report's photo or video, as the small thumbnail its bubble shows
     * beside "YOUR STEP" (docs/your-step/INLINE.md): a JPEG data URL drawn
     * in the browser, so it is still there when the thread is reopened. The
     * media itself lives only in their private record.
     */
    stepReportThumb?: string;
    stepReportKind?: "photo" | "video";
    /** The card under this reply (the Warmup, the Trials) was skipped or used. */
    cardsDismissed?: boolean;
    /**
     * The debate started from this reply's offer (docs/rich-chat/SPEC.md,
     * section 2.2): its section stays in the bubble, quiet, naming who is in it.
     */
    debateId?: string;
    /**
     * A Warmup question, as the animal's message in the thread
     * (docs/your-step/INLINE.md): its text is empty, so it is never history
     * for the model. Its answer and, once checked, the verdict are kept on
     * it, so the run is still there when the thread is reopened.
     */
    warmup?: AskWarmupItem;
};

/** One Warmup question in the thread (iOS `AnimalWarmupItem`). */
export type AskWarmupItem = {
    /** The reply that offered it: one run per offer. */
    runId: string;
    /** The species the answers go back to. */
    speciesProfileId: string;
    /** 0-based, in question order. */
    index: number;
    total: number;
    prompt: string;
    choices: string[];
    /** The choice they tapped. */
    chosen?: number;
    /** The server's verdict on this question, once checked. */
    correct?: boolean;
    /** On the last question, once checked: passed, and the XP it paid. */
    passed?: boolean;
    rewardXP?: number;
};

/** Why a reply failed, when it was not the day's limit. */
export type AskFailureKind = "unavailable" | "empty" | "offline" | "timeout" | "network" | "generic";

/** The three answers to a check-in: done, not now, or stop asking. */
export type AskFollowUpResolution = "done" | "not_now" | "stopped";

export type AskThreads = Record<string, AskMessage[]>;

export const ASK_THREAD_STORAGE_KEY = "animaldex:ask:threads-v1";
export const ASK_THREAD_SCHEMA_VERSION = 1;

/** Threads older than this are dropped on load. */
export const ASK_THREAD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Per-thread message cap; oldest are trimmed first. */
export const ASK_THREAD_MAX_MESSAGES = 60;
/** Total threads retained, most recently active first. */
export const ASK_THREAD_MAX_THREADS = 30;
/** A report's thumbnail is a small data URL; anything longer is not one of ours, and is dropped. */
export const ASK_STEP_REPORT_THUMB_MAX_LENGTH = 64_000;

/** A report thumbnail as stored: a JPEG, PNG or WebP data URL within the cap, or nothing. */
export function askStepReportThumb(value: unknown): string | null {
    if (typeof value !== "string" || value.length > ASK_STEP_REPORT_THUMB_MAX_LENGTH) return null;
    return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}

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
        createdAt: overrides.createdAt ?? new Date().toISOString(),
        ...(overrides.isGreeting ? {isGreeting: true} : {}),
        ...(overrides.companionEvent ? {companionEvent: overrides.companionEvent} : {}),
        ...(overrides.followUp ? {followUp: overrides.followUp} : {}),
        ...(overrides.animalMessageId ? {animalMessageId: overrides.animalMessageId} : {}),
        ...(overrides.stepReportId ? {stepReportId: overrides.stepReportId} : {}),
        ...stepReportMediaFields(overrides.stepReportId ? overrides : {}),
        ...(overrides.cardsDismissed ? {cardsDismissed: true} : {}),
        ...debateIdField(overrides.debateId),
        ...warmupField(overrides.warmup)
    };
}

/** A started debate's id as stored, or nothing. */
function debateIdField(raw: unknown): {debateId?: string} {
    return typeof raw === "string" && /^[0-9a-f-]{36}$/i.test(raw) ? {debateId: raw.toLowerCase()} : {};
}

/** A Warmup question as stored, or nothing: a malformed one is dropped, never the thread. */
function warmupField(raw: unknown): {warmup?: AskWarmupItem} {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!row) return {};
    const index = typeof row.index === "number" && Number.isInteger(row.index) ? row.index : -1;
    const total = typeof row.total === "number" && Number.isInteger(row.total) ? row.total : 0;
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    const choices = Array.isArray(row.choices) ? row.choices.filter((choice): choice is string => typeof choice === "string").slice(0, 8) : [];
    const runId = typeof row.runId === "string" ? row.runId : "";
    const speciesProfileId = typeof row.speciesProfileId === "string" ? row.speciesProfileId : "";
    if (!runId || !speciesProfileId || index < 0 || total <= index || total > 10 || !prompt || choices.length < 2) return {};
    const chosen = typeof row.chosen === "number" && Number.isInteger(row.chosen) && row.chosen >= 0 && row.chosen < choices.length ? row.chosen : null;
    return {
        warmup: {
            runId,
            speciesProfileId,
            index,
            total,
            prompt: prompt.slice(0, 500),
            choices: choices.map((choice) => choice.slice(0, 300)),
            ...(chosen !== null ? {chosen} : {}),
            ...(typeof row.correct === "boolean" ? {correct: row.correct} : {}),
            ...(typeof row.passed === "boolean" ? {passed: row.passed} : {}),
            ...(typeof row.rewardXP === "number" && Number.isFinite(row.rewardXP) && row.rewardXP >= 0 ? {rewardXP: Math.floor(row.rewardXP)} : {})
        }
    };
}

/** The thumbnail and its kind travel together, on a report only. */
function stepReportMediaFields(row: {stepReportThumb?: unknown; stepReportKind?: unknown}): Pick<AskMessage, "stepReportThumb" | "stepReportKind"> {
    const thumb = askStepReportThumb(row.stepReportThumb);
    if (!thumb) return {};
    return {stepReportThumb: thumb, stepReportKind: row.stepReportKind === "video" ? "video" : "photo"};
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
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
        ...(row.isGreeting === true ? {isGreeting: true} : {}),
        ...companionEventField(row.companionEvent),
        ...followUpFields(row),
        ...(typeof row.animalMessageId === "string" && row.animalMessageId ? {animalMessageId: row.animalMessageId} : {}),
        ...(typeof row.stepReportId === "string" && row.stepReportId ? {stepReportId: row.stepReportId, ...stepReportMediaFields(row)} : {}),
        ...(row.cardsDismissed === true ? {cardsDismissed: true} : {}),
        ...debateIdField(row.debateId),
        ...warmupField(row.warmup)
    };
}

function followUpFields(row: Record<string, unknown>): Pick<AskMessage, "followUp" | "followUpResolution"> {
    const raw = row.followUp && typeof row.followUp === "object" ? row.followUp as Record<string, unknown> : null;
    if (!raw || typeof raw.id !== "string" || typeof raw.topic !== "string" || !raw.topic.trim()) return {};
    const resolution = row.followUpResolution === "done" || row.followUpResolution === "not_now" || row.followUpResolution === "stopped"
        ? row.followUpResolution
        : null;
    return {followUp: {id: raw.id, topic: raw.topic.trim().slice(0, 200)}, ...(resolution ? {followUpResolution: resolution} : {})};
}

function companionEventField(raw: unknown): {companionEvent?: AskCompanionEvent} {
    const event = normalizeCompanionEvent(raw);
    return event ? {companionEvent: event} : {};
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
