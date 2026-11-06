/**
 * Chat history on every device (docs/chat-sync/SPEC.md, section 2; the
 * server as built, AnimalDex df8d2dc0 docs/chat-sync/SERVER.md): what an
 * answered one-to-one turn on the website stores for a signed-in reader, the
 * rows `record_animal_chat_messages_v1` takes, built by the same rules as the
 * edge function's `buildChatTranscript` (`_shared/animal-chat-history.ts`),
 * with `p_surface: "web"`. Never a group, a debate, a call or a Trial
 * thread; never a signed-out reader; never a refused or failed turn.
 *
 * Pure, so the rules are tested; the route makes the call.
 */

/** The longest message kept (the table's own check). */
export const CHAT_HISTORY_BODY_MAX = 8000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lowerUUID(value: string | null | undefined): string | null {
    const text = typeof value === "string" ? value.trim() : "";
    return UUID.test(text) ? text.toLowerCase() : null;
}

/**
 * The thread a one-to-one turn belongs to: its card when it has one (theirs
 * or someone else's), else the species, by the catalog's canonical id
 * (DECISIONS section 12), so the apps and the website share it.
 */
export function chatThreadKey(subject: {captureId: string | null; speciesProfileId: string | null}): string | null {
    const capture = lowerUUID(subject.captureId);
    if (capture) return `capture:${capture}`;
    const species = lowerUUID(subject.speciesProfileId);
    return species ? `species:${species}` : null;
}

/**
 * The id the person's message is stored under: the request id the browser
 * sent (a UUID from `crypto.randomUUID`). Any other id becomes a UUID
 * derived from it the way the server derives one, so a retry of the same
 * request lands on the same row.
 */
export async function chatMessageId(requestId: string): Promise<string> {
    const direct = lowerUUID(requestId);
    if (direct) return direct;
    const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`animal-chat-message:${requestId}`))
    );
    const bytes = digest.slice(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type ChatTranscriptSkip = "signed_out" | "call" | "trial" | "no_thread" | "unanswered";

export type ChatTranscriptInput = {
    /** The signed-in reader; a signed-out one is never stored. */
    userId: string | null;
    captureId: string | null;
    /** The canonical species the route resolved. */
    speciesProfileId: string | null;
    call: boolean;
    aboutTrial: boolean;
    /** The animal spoke first: only its reply is stored. */
    greeting: boolean;
    requestId: string | null;
    question: string;
    /** The reply exactly as the reader was shown it (a visitor's notice included). */
    answer: string;
    /** When the request arrived: the person's message is stored at that time. */
    askedAt: Date;
    /** Their report on their open step (3.2), when the route took it as one. */
    stepReport?: {stepId: string; media: string | null} | null;
    /** The check-in this reply raised. */
    followUpId?: string | null;
    /** Which door the person's message came in by (docs/talk-front-door/SPEC.md, section 6.3). */
    origin?: ChatMessageOrigin | null;
};

/** The doors a message may say it came in by; anything else is ignored (the server's list, AnimalDex 4403b042). */
export const CHAT_MESSAGE_ORIGINS = ["front_door", "referral"] as const;
export type ChatMessageOrigin = typeof CHAT_MESSAGE_ORIGINS[number];

/** A known door, or null for anything else (most messages say none). */
export function chatMessageOrigin(raw: unknown): ChatMessageOrigin | null {
    return typeof raw === "string" && (CHAT_MESSAGE_ORIGINS as readonly string[]).includes(raw) ? raw as ChatMessageOrigin : null;
}

export type ChatTranscriptMessage = {
    role: "user" | "assistant";
    body: string;
    client_message_id?: string;
    reply_to?: string;
    is_greeting?: boolean;
    meta?: Record<string, unknown>;
    at?: string;
};

/** The arguments of `record_animal_chat_messages_v1`. */
export type ChatTranscript = {
    p_user_id: string;
    p_thread_key: string;
    p_capture_id: string | null;
    p_species_profile_id: string | null;
    p_surface: "web";
    p_messages: ChatTranscriptMessage[];
};

export function chatTranscriptSkip(input: ChatTranscriptInput): ChatTranscriptSkip | null {
    if (!lowerUUID(input.userId)) return "signed_out";
    if (input.call) return "call";
    if (input.aboutTrial) return "trial";
    if (!chatThreadKey(input)) return "no_thread";
    if (!input.answer.trim()) return "unanswered";
    if (!input.greeting && (!input.question.trim() || !input.requestId)) return "unanswered";
    return null;
}

function mediaKind(media: string | null): "photo" | "video" | null {
    if (!media) return null;
    return /video/i.test(media) ? "video" : /photo/i.test(media) ? "photo" : null;
}

function clipBody(text: string): string {
    return text.trim().slice(0, CHAT_HISTORY_BODY_MAX);
}

/**
 * The rows one answered turn stores, in the order said: the person's
 * message (keyed by the request id) and then the reply (answering it); a
 * greeting is its reply alone. Null when the turn is not stored.
 */
export async function buildChatTranscript(input: ChatTranscriptInput): Promise<ChatTranscript | null> {
    if (chatTranscriptSkip(input)) return null;
    const base = {
        p_user_id: lowerUUID(input.userId) as string,
        p_thread_key: chatThreadKey(input) as string,
        p_capture_id: lowerUUID(input.captureId),
        p_species_profile_id: lowerUUID(input.speciesProfileId),
        p_surface: "web" as const
    };
    const reply = clipBody(input.answer);
    if (input.greeting) return {...base, p_messages: [{role: "assistant", body: reply, is_greeting: true}]};
    const id = await chatMessageId(input.requestId as string);
    const stepId = lowerUUID(input.stepReport?.stepId ?? null);
    const followUpId = lowerUUID(input.followUpId ?? null);
    // Kept as `meta.origin` on the person's message (talk front door SPEC 6.3), beside a step report.
    const origin = chatMessageOrigin(input.origin);
    const questionMeta: Record<string, unknown> = {
        ...(stepId ? {step_report: {step_id: stepId, media_kind: mediaKind(input.stepReport?.media ?? null)}} : {}),
        ...(origin ? {origin} : {})
    };
    const question: ChatTranscriptMessage = {
        role: "user",
        body: clipBody(input.question),
        client_message_id: id,
        at: input.askedAt.toISOString(),
        ...(Object.keys(questionMeta).length > 0 ? {meta: questionMeta} : {})
    };
    const answer: ChatTranscriptMessage = {
        role: "assistant",
        body: reply,
        reply_to: id,
        ...(followUpId ? {meta: {follow_up_id: followUpId}} : {})
    };
    return {...base, p_messages: [question, answer]};
}

/** PostgREST's "no such function": the migration is not applied yet, which is today's behaviour, not a failure. */
export function isMissingRpc(error: {code?: string | null; message?: string | null} | null | undefined): boolean {
    if (!error) return false;
    return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}
