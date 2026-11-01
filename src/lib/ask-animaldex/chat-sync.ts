/**
 * Chat history on every device, the website's half (docs/chat-sync/SPEC.md,
 * section 3; DECISIONS section 12). The browser's thread store stays the
 * cache and works offline; a signed-in reader's thread is read from their
 * account in the background when it opens, and merged:
 *
 *   - an empty local thread adopts the server's whole thread;
 *   - otherwise a server row missing here is added in time order: a person's
 *     message when no local message has its request id; a reply when no
 *     reply follows the local message it answers (`reply_to`); a hello
 *     (`is_greeting`, no ids) by time, never beside a local hello within the
 *     same minute;
 *   - local-only rows (Warmup questions, debates, special sections, the
 *     step's own message) stay where they are, and a turn still in flight is
 *     never touched.
 *
 * Pure, so it is tested. The thread key differs on each side: the browser
 * files a species thread under its slug (`species:red-fox`), the account
 * under the canonical species id (`species:<uuid>`); a card's thread is
 * `capture:<uuid>` on both.
 */

import {createAskMessage, type AskMessage} from "@/lib/ask-animaldex/thread";

/** One row of `animal_chat_thread_messages_v1`. */
export type ServerChatRow = {
    id: string;
    role: "user" | "assistant";
    body: string;
    client_message_id: string | null;
    reply_to: string | null;
    is_greeting: boolean;
    meta: Record<string, unknown>;
    created_at: string;
};

/** A row as the RPC returned it, or nothing: a malformed one is dropped, never the thread. */
export function normalizeServerChatRow(raw: unknown): ServerChatRow | null {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!row) return null;
    const role = row.role === "user" || row.role === "assistant" ? row.role : null;
    const body = typeof row.body === "string" ? row.body : "";
    const id = typeof row.id === "string" ? row.id : "";
    const createdAt = typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at)) ? row.created_at : "";
    if (!role || !body.trim() || !id || !createdAt) return null;
    const lower = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null);
    return {
        id,
        role,
        body,
        client_message_id: lower(row.client_message_id),
        reply_to: lower(row.reply_to),
        is_greeting: row.is_greeting === true,
        meta: row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta as Record<string, unknown> : {},
        created_at: createdAt
    };
}

export function normalizeServerChatRows(raw: unknown): ServerChatRow[] {
    return (Array.isArray(raw) ? raw : []).map(normalizeServerChatRow).filter((row): row is ServerChatRow => row !== null);
}

/** A hello within this long of a local one is the same hello. */
const SAME_HELLO_MS = 60_000;

function isSettled(message: AskMessage): boolean {
    return message.status === "complete";
}

/** The message a server row becomes here: a person's keeps its request id as its id, so the next merge finds it. */
export function serverRowMessage(row: ServerChatRow): AskMessage {
    const report = row.meta.step_report && typeof row.meta.step_report === "object" ? row.meta.step_report as Record<string, unknown> : null;
    const stepId = typeof report?.step_id === "string" ? report.step_id : null;
    return createAskMessage(row.role, row.body, {
        id: row.role === "user" && row.client_message_id ? row.client_message_id : `server-${row.id}`,
        createdAt: new Date(Date.parse(row.created_at)).toISOString(),
        ...(row.is_greeting ? {isGreeting: true} : {}),
        ...(row.role === "user" && stepId ? {stepReportId: stepId} : {})
    });
}

function at(message: {createdAt: string}): number {
    return Date.parse(message.createdAt) || 0;
}

/** Puts `message` before the first message that came after it, never among the turns still in flight at the end. */
function insertByTime(thread: AskMessage[], message: AskMessage): AskMessage[] {
    const time = at(message);
    let index = thread.length;
    // In-flight turns are the newest: everything settled goes before them.
    while (index > 0 && !isSettled(thread[index - 1])) index -= 1;
    for (let at_ = 0; at_ < index; at_ += 1) {
        if (at(thread[at_]) > time) {
            index = at_;
            break;
        }
    }
    return [...thread.slice(0, index), message, ...thread.slice(index)];
}

/**
 * The local thread with what the account holds and it lacks, or null when it
 * lacks nothing (so nothing is written).
 */
export function mergeServerThread(local: readonly AskMessage[], rows: readonly ServerChatRow[]): AskMessage[] | null {
    if (rows.length === 0) return null;
    const ordered = [...rows].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
    const settled = local.filter(isSettled);
    if (settled.length === 0) {
        // Adopts the whole thread; a turn in flight (the hello on its way, say) stays at the end.
        return [...ordered.map(serverRowMessage), ...local];
    }
    let thread = [...local];
    let changed = false;
    const hasId = (id: string) => thread.some((message) => message.id.toLowerCase() === id);
    for (const row of ordered) {
        if (row.role === "user") {
            if (!row.client_message_id || hasId(row.client_message_id)) continue;
            thread = insertByTime(thread, serverRowMessage(row));
            changed = true;
            continue;
        }
        if (row.reply_to) {
            const asked = thread.findIndex((message) => message.role === "user" && message.id.toLowerCase() === row.reply_to);
            if (asked >= 0) {
                const next = thread[asked + 1];
                // Answered here already, or being answered now (a Warmup question is not an answer).
                if (next && next.role === "assistant" && !next.warmup && (next.text.trim() || !isSettled(next))) continue;
                thread = [...thread.slice(0, asked + 1), serverRowMessage(row), ...thread.slice(asked + 1)];
                changed = true;
                continue;
            }
            // Its question is not here (an older page of history): by time, unless the same words are.
            if (thread.some((message) => message.role === "assistant" && message.text.trim() === row.body.trim())) continue;
            thread = insertByTime(thread, serverRowMessage(row));
            changed = true;
            continue;
        }
        // A hello: by time, and never a second one beside a local hello of the same minute.
        const time = Date.parse(row.created_at);
        const sameHello = thread.some((message) => message.role === "assistant"
            && (message.isGreeting || message.text.trim() === row.body.trim())
            && Math.abs(at(message) - time) < SAME_HELLO_MS);
        if (sameHello || thread.some((message) => message.id === `server-${row.id}`)) continue;
        thread = insertByTime(thread, serverRowMessage(row));
        changed = true;
    }
    return changed ? thread : null;
}

/** The account's key for a thread the browser has open: its card, else its canonical species. */
export function serverThreadKey(params: {captureId: string | null; speciesProfileId: string | null}): string | null {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (params.captureId && uuid.test(params.captureId)) return `capture:${params.captureId.toLowerCase()}`;
    if (params.speciesProfileId && uuid.test(params.speciesProfileId)) return `species:${params.speciesProfileId.toLowerCase()}`;
    return null;
}

/** One of the account's threads, named for the sidebar by the history route. */
export type ServerChatThread = {
    /** The browser's key for it (`species:<slug>` or `capture:<uuid>`). */
    key: string;
    /** The account's key, for deleting it. */
    serverKey: string;
    slug: string;
    name: string;
    captureId: string | null;
    preview: string;
    lastAt: number;
};

export function normalizeServerChatThreads(raw: unknown): ServerChatThread[] {
    const rows = Array.isArray(raw) ? raw : [];
    const threads: ServerChatThread[] = [];
    for (const item of rows) {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : null;
        if (!row) continue;
        const key = typeof row.key === "string" ? row.key : "";
        const serverKey = typeof row.serverKey === "string" ? row.serverKey : "";
        const slug = typeof row.slug === "string" ? row.slug : "";
        const name = typeof row.name === "string" ? row.name : "";
        if (!/^(species|capture):/.test(key) || !/^(species|capture):/.test(serverKey) || !/^[a-z0-9-]+$/.test(slug) || !name) continue;
        threads.push({
            key,
            serverKey,
            slug,
            name,
            captureId: typeof row.captureId === "string" ? row.captureId : null,
            preview: typeof row.preview === "string" ? row.preview : "",
            lastAt: typeof row.lastAt === "number" && Number.isFinite(row.lastAt) ? row.lastAt : 0
        });
    }
    return threads;
}
