/**
 * A group conversation on the page: the round's frames, the order its turns
 * appear in (one animal typing at a time, the next one visibly waiting), the
 * breath between speakers, and the thread kept in the browser.
 *
 * Port of `AnimalGroupTurnQueue`, `AnimalGroupPalette` and the group thread
 * of the iOS app (`AnimalGroupConversation.swift`, `AnimalGroupChatView.swift`,
 * AnimalDex de78fe74, 546d7a07). Pure: the page's hook owns the timers.
 */

import {parseAskPersonaFrame, type AskPersonaFrame} from "@/lib/ask-animaldex/persona";
import type {AskConversationPhase} from "@/lib/ask-animaldex/group-conversation";

export type AskGroupPhase = AskConversationPhase | "unknown";

const PHASES: AskConversationPhase[] = ["answer", "open", "react", "converge", "decide", "seal"];

function phaseOf(raw: unknown): AskGroupPhase {
    return PHASES.find((phase) => phase === raw) ?? "unknown";
}

// MARK: - Frames

export type AskGroupSpeaker = {
    captureId: string;
    animalName: string;
    nickname: string | null;
    powerName: string | null;
    persona: AskPersonaFrame | null;
};

export type AskGroupTurnStart = {
    index: number;
    captureId: string;
    phase: AskGroupPhase;
    replyTo: string | null;
    persona: AskPersonaFrame | null;
};

export type AskGroupDone = {
    followUps: string[];
    remaining: number | null;
    limit: number | null;
    isPro: boolean;
    paidWith: string | null;
    creditCost: number | null;
    creditBalance: number | null;
    creditOverflow: {available: boolean; cost: number; balance: number} | null;
};

export type AskGroupEvent =
    | {kind: "speakers"; speakers: AskGroupSpeaker[]}
    | {kind: "turnStarted"; start: AskGroupTurnStart}
    | {kind: "turnDelta"; index: number; captureId: string; text: string}
    | {kind: "turnDone"; index: number; captureId: string; settled: boolean}
    | {kind: "turnFailed"; index: number; captureId: string}
    | {kind: "done"; done: AskGroupDone};

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** One `data:` payload of the group stream, as the apps decode it. Anything unrecognised is null. */
export function parseAskGroupFrame(raw: Record<string, unknown>): AskGroupEvent | null {
    if (Array.isArray(raw.speakers)) {
        return {
            kind: "speakers",
            speakers: raw.speakers.flatMap((item): AskGroupSpeaker[] => {
                const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
                const captureId = str(row?.capture_id);
                if (!row || !captureId) return [];
                return [{
                    captureId: captureId.toLowerCase(),
                    animalName: str(row.animal_name) ?? "",
                    nickname: str(row.nickname),
                    powerName: str(row.power_name),
                    persona: parseAskPersonaFrame(row.persona)
                }];
            })
        };
    }
    if (raw.turn && typeof raw.turn === "object") {
        const turn = raw.turn as Record<string, unknown>;
        const index = num(turn.index);
        const captureId = str(turn.participant);
        if (index === null || !captureId) return null;
        return {
            kind: "turnStarted",
            start: {
                index,
                captureId: captureId.toLowerCase(),
                phase: phaseOf(turn.phase),
                replyTo: str(turn.reply_to)?.toLowerCase() ?? null,
                persona: parseAskPersonaFrame(turn.persona)
            }
        };
    }
    if (raw.done === true) {
        const overflow = raw.credit_overflow && typeof raw.credit_overflow === "object" ? raw.credit_overflow as Record<string, unknown> : null;
        return {
            kind: "done",
            done: {
                followUps: (Array.isArray(raw.follow_up_prompts) ? raw.follow_up_prompts : [])
                    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
                    .slice(0, 3),
                remaining: num(raw.remaining),
                limit: num(raw.limit),
                isPro: raw.is_pro === true,
                paidWith: str(raw.paid_with),
                creditCost: num(raw.credit_cost),
                creditBalance: num(raw.credit_balance),
                creditOverflow: overflow
                    ? {available: overflow.available === true, cost: num(overflow.cost) ?? 1, balance: num(overflow.balance) ?? 0}
                    : null
            }
        };
    }
    const index = num(raw.turn_index);
    const captureId = str(raw.participant)?.toLowerCase() ?? null;
    if (index === null || !captureId) return null;
    if (typeof raw.delta === "string") return {kind: "turnDelta", index, captureId, text: raw.delta};
    if (raw.participant_done === true) return {kind: "turnDone", index, captureId, settled: raw.settled === true};
    if (typeof raw.error === "string") return {kind: "turnFailed", index, captureId};
    return null;
}

// MARK: - The order turns appear in

export type AskGroupTurn = {
    index: number;
    captureId: string;
    phase: AskGroupPhase;
    persona: AskPersonaFrame | null;
    /** Everything received for this turn so far. */
    text: string;
    serverDone: boolean;
    failed: boolean;
    settled: boolean;
    /** Typed out in full and kept in the thread. */
    revealed: boolean;
};

export type AskGroupQueue = {turns: AskGroupTurn[]; streamDone: boolean};

export const EMPTY_ASK_GROUP_QUEUE: AskGroupQueue = {turns: [], streamDone: false};

function blank(text: string): boolean {
    return text.trim().length === 0;
}

function update(queue: AskGroupQueue, index: number, change: (turn: AskGroupTurn) => AskGroupTurn): AskGroupQueue {
    if (!queue.turns.some((turn) => turn.index === index)) return queue;
    return {...queue, turns: queue.turns.map((turn) => (turn.index === index ? change(turn) : turn))};
}

export function askGroupQueueStart(queue: AskGroupQueue, start: AskGroupTurnStart): AskGroupQueue {
    if (queue.turns.some((turn) => turn.index === start.index)) return queue;
    const turn: AskGroupTurn = {
        index: start.index,
        captureId: start.captureId,
        phase: start.phase,
        persona: start.persona,
        text: "",
        serverDone: false,
        failed: false,
        settled: false,
        revealed: false
    };
    return {...queue, turns: [...queue.turns, turn].sort((a, b) => a.index - b.index)};
}

export function askGroupQueueReceive(queue: AskGroupQueue, index: number, text: string): AskGroupQueue {
    return update(queue, index, (turn) => ({...turn, text: turn.text + text}));
}

export function askGroupQueueFinish(queue: AskGroupQueue, index: number, settled: boolean): AskGroupQueue {
    return update(queue, index, (turn) => ({...turn, serverDone: true, settled, failed: turn.failed || blank(turn.text)}));
}

export function askGroupQueueFail(queue: AskGroupQueue, index: number): AskGroupQueue {
    return update(queue, index, (turn) => ({...turn, failed: true}));
}

/** The stream is over: a turn the server never closed has nothing more coming. */
export function askGroupQueueFinishStream(queue: AskGroupQueue): AskGroupQueue {
    return {
        streamDone: true,
        turns: queue.turns.map((turn) => (turn.serverDone ? turn : {...turn, serverDone: true, failed: turn.failed || blank(turn.text)}))
    };
}

export function askGroupQueueMarkRevealed(queue: AskGroupQueue, index: number): AskGroupQueue {
    return update(queue, index, (turn) => ({...turn, revealed: true}));
}

/** The turn that types out now (or is about to): the first one neither shown nor failed. */
export function askGroupQueueCurrent(queue: AskGroupQueue): AskGroupTurn | null {
    return queue.turns.find((turn) => !turn.revealed && !turn.failed) ?? null;
}

/** The animal after it, already composing its turn. */
export function askGroupQueueWaiting(queue: AskGroupQueue): AskGroupTurn | null {
    const current = askGroupQueueCurrent(queue);
    if (!current) return null;
    return queue.turns.find((turn) => turn.index > current.index && !turn.revealed && !turn.failed) ?? null;
}

/** Nothing left to show or to come. */
export function askGroupQueueIsFinished(queue: AskGroupQueue): boolean {
    return queue.streamDone && askGroupQueueCurrent(queue) === null;
}

/** Text the current turn can start typing: at least one whole word, or the whole turn once the server has finished it. */
export function askGroupTurnReadyToType(turn: AskGroupTurn): boolean {
    if (turn.serverDone) return !blank(turn.text);
    return /\s/.test(turn.text) && /\p{L}/u.test(turn.text);
}

/** The pause before an animal starts talking after another: a beat, longer for a slow talker, never mechanical. */
export function askGroupPauseSeconds(pace: AskPersonaFrame["pace"] | null | undefined, roll: number): number {
    const [low, high] = pace === "quick" ? [0.25, 0.45] : pace === "slow" ? [0.5, 0.9] : [0.35, 0.65];
    return low + (high - low) * Math.min(Math.max(roll, 0), 1);
}

/** Each animal's colour, so who is talking reads at a glance: the name over its bubble, the ring round its face. */
export const ASK_GROUP_COLORS = ["#A7F432", "#5ED6CC", "#F2B84B", "#FF8E7A"];

export function askGroupColor(captureId: string | null | undefined, captureIds: string[]): string {
    const index = captureId ? captureIds.indexOf(captureId) : -1;
    return index < 0 ? "rgb(var(--c-ink-300))" : ASK_GROUP_COLORS[index % ASK_GROUP_COLORS.length];
}

// MARK: - The thread

export type AskGroupMessage = {
    id: string;
    role: "user" | "assistant";
    text: string;
    status: "complete" | "failed";
    /** ISO 8601. */
    createdAt: string;
    /** Which animal said it. */
    speakerCaptureId?: string | null;
    /** The turn's job in its round; "converge" is badged "Common ground". */
    phase?: AskConversationPhase | null;
    /** On the round's last turn: the chips under it. */
    followUpPrompts?: string[];
    /** The question's request id, reused when it is sent again. */
    requestId?: string;
};

/** The same animals, picked in any order, reopen the same conversation. */
export function askGroupThreadKey(captureIds: string[]): string {
    return `group:${Array.from(new Set(captureIds.map((id) => id.toLowerCase()))).sort().join(",")}`;
}

/** What the server is sent: the last twelve things said before the question, who said each. */
export function askGroupHistoryForSending(messages: AskGroupMessage[], questionId: string): Array<{role: "user" | "assistant"; content: string; speakerCaptureId: string | null}> {
    const at = messages.findIndex((message) => message.id === questionId);
    const prior = at >= 0 ? messages.slice(0, at) : messages;
    return prior
        .filter((message) => message.status === "complete" && message.text.trim().length > 0)
        .slice(-12)
        .map((message) => ({
            role: message.role,
            content: message.text,
            speakerCaptureId: message.role === "assistant" ? message.speakerCaptureId ?? null : null
        }));
}

export const ASK_GROUP_STORAGE_KEY = "animaldex:ask:group-threads-v1";
const GROUP_SCHEMA_VERSION = 1;
const GROUP_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const GROUP_MAX_MESSAGES = 60;
const GROUP_MAX_THREADS = 30;

export type AskGroupThreads = Record<string, AskGroupMessage[]>;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function normalizeGroupMessage(raw: unknown): AskGroupMessage | null {
    const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
    if (!row) return null;
    const role = row.role === "user" || row.role === "assistant" ? row.role : null;
    const text = typeof row.text === "string" ? row.text : null;
    if (!role || text === null || row.status !== "complete") return null;
    const phase = PHASES.find((value) => value === row.phase) ?? null;
    return {
        id: typeof row.id === "string" && row.id ? row.id : `g-${Math.random().toString(36).slice(2, 10)}`,
        role,
        text,
        status: "complete",
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
        ...(typeof row.speakerCaptureId === "string" ? {speakerCaptureId: row.speakerCaptureId} : {}),
        ...(phase ? {phase} : {}),
        ...(Array.isArray(row.followUpPrompts)
            ? {followUpPrompts: row.followUpPrompts.filter((item): item is string => typeof item === "string").slice(0, 3)}
            : {}),
        ...(typeof row.requestId === "string" ? {requestId: row.requestId} : {})
    };
}

/** Failed rounds are this visit's only, and a thread never reopens on a question nothing answered. */
function persistable(messages: AskGroupMessage[]): AskGroupMessage[] {
    const kept = messages.filter((message) => message.status === "complete");
    while (kept.length > 0 && kept[kept.length - 1].role === "user") kept.pop();
    return kept.slice(-GROUP_MAX_MESSAGES);
}

export function loadAskGroupThreads(storage: Storage | null, now = Date.now()): AskGroupThreads {
    if (!storage) return {};
    try {
        const raw = storage.getItem(ASK_GROUP_STORAGE_KEY);
        if (!raw) return {};
        const snapshot = JSON.parse(raw) as {schemaVersion?: number; savedAt?: string; threads?: Record<string, unknown>};
        if (snapshot.schemaVersion !== GROUP_SCHEMA_VERSION) return {};
        const savedAt = Date.parse(snapshot.savedAt ?? "");
        if (!Number.isFinite(savedAt) || now - savedAt > GROUP_MAX_AGE_MS) return {};
        const threads: AskGroupThreads = {};
        for (const [key, messages] of Object.entries(snapshot.threads ?? {})) {
            if (!Array.isArray(messages)) continue;
            const restored = persistable(messages.map(normalizeGroupMessage).filter((message): message is AskGroupMessage => message !== null));
            if (restored.length > 0) threads[key] = restored;
        }
        return threads;
    } catch {
        return {};
    }
}

export function saveAskGroupThreads(storage: Storage | null, threads: AskGroupThreads) {
    if (!storage) return;
    const usable = Object.entries(threads)
        .map(([key, messages]) => [key, persistable(messages)] as [string, AskGroupMessage[]])
        .filter(([, messages]) => messages.length > 0)
        .sort((a, b) => Date.parse(b[1][b[1].length - 1].createdAt) - Date.parse(a[1][a[1].length - 1].createdAt))
        .slice(0, GROUP_MAX_THREADS);
    try {
        if (usable.length === 0) {
            storage.removeItem(ASK_GROUP_STORAGE_KEY);
            return;
        }
        storage.setItem(ASK_GROUP_STORAGE_KEY, JSON.stringify({
            schemaVersion: GROUP_SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            threads: Object.fromEntries(usable)
        }));
    } catch {
        // The thread is still on screen; it just does not outlive the tab.
    }
}
