"use client";

/**
 * One turn of the conversation, end to end.
 *
 * The web port of `AnimalPowerAskChatView.sendMessage`: append the question, put
 * a placeholder under it, stream the answer into that placeholder, then replace
 * it with the finished answer and the model's follow-up offers. Stop, retry and
 * regenerate behave as they do in the app, including what each one leaves behind
 * in the thread.
 */

import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {askConversationHistory} from "@/lib/ask-animaldex/grounding";
import {splitStreamedReply, visibleAnswerSoFar} from "@/lib/ask-animaldex/prompt";
import {
    createAskMessage,
    newAskMessageId,
    type AskMessage
} from "@/lib/ask-animaldex/thread";
import type {AskSubject} from "@/lib/ask-animaldex/subject";
import {decorateFollowUps} from "@/lib/ask-animaldex/wild-profile";
import {TRIAL_ASK_FALLBACK_FOLLOW_UPS} from "@/lib/animal-trial-ask";

/** Offered when the model returns none, so the thread never dead-ends. */
export function fallbackFollowUps(principleName: string | null, aboutTrial = false): string[] {
    if (aboutTrial) return [...TRIAL_ASK_FALLBACK_FOLLOW_UPS];
    return principleName
        ? [
            "How do I practise this?",
            "What's the opposite pattern?",
            "What should I watch out for?"
        ]
        : [
            "Go deeper on the biology",
            "What's the opposite pattern?",
            "What should I watch out for?"
        ];
}

/**
 * Distinguishes the failures a reader can act on from the ones they cannot.
 *
 * Every error used to collapse into one sentence on iOS, so being offline, being
 * rate limited and hitting a gate were indistinguishable — and the two of those
 * a reader *can* fix looked like a broken feature.
 */
export function askErrorMessage(error: unknown): string {
    if (error instanceof AskLimitError) {
        if (error.reason === "insufficient_credits") {
            return "You don't have enough credits for another message. Your free messages come back tomorrow.";
        }
        return error.retryAfterSeconds && error.retryAfterSeconds < 60 * 60 * 6
            ? "You've used today's questions. They reset within a few hours."
            : "You've used today's questions. Sign in for more, or come back tomorrow.";
    }
    if (error instanceof AskUnavailableError) {
        return "Ask AnimalDex is unavailable right now. Try again in a moment.";
    }
    if (error instanceof AskEmptyError) {
        return "AnimalDex didn't send anything back. Try asking again.";
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return "You're offline. Reconnect and ask again.";
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
        return "That took too long to come back. Try asking again.";
    }
    if (error instanceof TypeError) {
        // `fetch` rejects with a TypeError for a dropped connection or a blocked
        // request — the reader's own network, not our failure.
        return "Couldn't reach AnimalDex. Check your connection and try again.";
    }
    return "AnimalDex couldn't answer that just now. Try asking again.";
}

export class AskLimitError extends Error {
    constructor(
        readonly retryAfterSeconds: number,
        readonly limit: number,
        readonly reason: string = "daily_limit_reached"
    ) {
        super("limit_reached");
    }
}

/** Whether credits can carry the reader past today's allowance, and at what price. */
export type AskCreditOverflow = {available: boolean; cost: number; balance: number};

function creditOverflowFrom(raw: unknown): AskCreditOverflow | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    return {
        available: row.available === true,
        cost: typeof row.cost === "number" ? row.cost : 1,
        balance: typeof row.balance === "number" ? row.balance : 0
    };
}

/**
 * "Continue with credits" lasts until the day's allowance resets (the
 * server's `resets_at`, the next UTC midnight). Kept per browser, so a
 * reload the same day does not ask again; storage that throws only means the
 * reader is asked again.
 */
const PAY_WITH_CREDITS_KEY = "animaldex:ask:pay-with-credits-until";

function nextUtcMidnight(now = Date.now()): number {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

function readPayingUntil(): number | null {
    try {
        const raw = window.localStorage.getItem(PAY_WITH_CREDITS_KEY);
        const until = raw ? Number(raw) : Number.NaN;
        return Number.isFinite(until) && until > Date.now() ? until : null;
    } catch {
        return null;
    }
}

function writePayingUntil(until: number | null) {
    try {
        if (until) window.localStorage.setItem(PAY_WITH_CREDITS_KEY, String(until));
        else window.localStorage.removeItem(PAY_WITH_CREDITS_KEY);
    } catch {
        // Session-only, then.
    }
}
export class AskUnavailableError extends Error {}
export class AskEmptyError extends Error {}

type StreamEvent = {
    delta?: string;
    done?: boolean;
    follow_up_prompts?: string[];
    remaining?: number;
    limit?: number;
    signed_in?: boolean;
    is_pro?: boolean;
    has_wild_profile?: boolean;
    resets_at?: string;
    paid_with?: "allowance" | "credits";
    credit_cost?: number | null;
    credit_balance?: number | null;
    credit_overflow?: AskCreditOverflow;
    error?: string;
    detail?: string;
};

type CompleteAnswer = StreamEvent & {answer?: string};

/** Reads an SSE body frame by frame. The mirror of the server's own reader. */
async function consumeAskStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: StreamEvent) => void
) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true}).replace(/\r\n/g, "\n");
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
            const line = frame.split("\n").find((candidate) => candidate.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
                onEvent(JSON.parse(payload) as StreamEvent);
            } catch {
                // A frame we cannot parse is skipped rather than failing the answer.
            }
        }
    }
}

export type AskQuota = {
    remaining: number | null;
    limit: number | null;
    reached: boolean;
    /** Who the budget belongs to, so the limit notice offers the right next step. */
    signedIn?: boolean;
    isPro?: boolean;
    /** `daily_limit_reached` or `insufficient_credits`, when the server said which. */
    reason?: string;
    /** Present when the server can say whether credits can carry the reader on. */
    creditOverflow?: AskCreditOverflow | null;
    /** The reader chose "Continue with credits" and it still holds today. */
    paying?: boolean;
    /** From the last answer paid with credits. */
    creditCost?: number | null;
    creditBalance?: number | null;
};

export function useAskThread(params: {
    threadKey: string;
    subject: AskSubject;
    locale: string;
    principleName: string | null;
    /**
     * What the drawer already knows about the reader, used until an answer
     * reports it afresh. A Wild Profile made in another tab shows up with the
     * next answer rather than never.
     */
    viewer?: {signedIn: boolean; hasWildProfile: boolean};
    onAnswered?: (info: {question: string; followUps: number}) => void;
    onFailed?: (reason: string) => void;
}) {
    const {threadKey, subject, locale, principleName} = params;

    const messages = useSyncExternalStore(
        askSessionStore.subscribe,
        () => askSessionStore.snapshot(threadKey),
        () => EMPTY_MESSAGES
    );

    const [isSending, setIsSending] = useState(false);
    const [quota, setQuota] = useState<AskQuota>({remaining: null, limit: null, reached: false});
    const abortRef = useRef<AbortController | null>(null);
    // Read through a ref so `send` keeps one identity; the state mirrors it
    // for rendering the footer.
    const payingUntilRef = useRef<number | null>(null);
    const [payingUntil, setPayingUntil] = useState<number | null>(null);
    useEffect(() => {
        const stored = readPayingUntil();
        payingUntilRef.current = stored;
        setPayingUntil(stored);
    }, []);
    const isPaying = useCallback(() => {
        const until = payingUntilRef.current;
        return until !== null && until > Date.now();
    }, []);
    const stopPaying = useCallback(() => {
        payingUntilRef.current = null;
        setPayingUntil(null);
        writePayingUntil(null);
    }, []);
    // Callbacks are read through a ref so `send` keeps one identity across
    // renders; a changing identity re-runs every effect that opens with a
    // question and sends it twice.
    const callbacks = useRef(params);
    callbacks.current = params;

    useEffect(() => () => abortRef.current?.abort(), []);

    const replace = useCallback((next: AskMessage[]) => {
        askSessionStore.replace(threadKey, next);
    }, [threadKey]);

    const send = useCallback(async (rawQuestion: string, options: {requestId?: string} = {}) => {
        const question = rawQuestion.replace(/\s+/g, " ").trim();
        if (!question || abortRef.current) return;

        const current = askSessionStore.messages(threadKey);
        // The question's own id is the request id: one per message, and the
        // same one when that message is retried, so a retry is never charged
        // twice.
        const userMessage = createAskMessage("user", question, options.requestId ? {id: options.requestId} : {});
        const requestId = userMessage.id;
        const placeholderId = newAskMessageId();
        const placeholder = createAskMessage("assistant", "", {id: placeholderId, status: "thinking"});
        replace([...current, userMessage, placeholder]);

        // Everything before this message; the question itself travels as `question`.
        const history = askConversationHistory(current);
        const controller = new AbortController();
        abortRef.current = controller;
        setIsSending(true);

        let answer = "";
        let lastFlush = 0;
        let didFinish = false;

        const flush = (force: boolean) => {
            const now = Date.now();
            // Coalesce: a token-rate re-render would lay out the whole thread
            // dozens of times a second for no visible gain.
            if (!force && now - lastFlush < 50) return;
            lastFlush = now;
            const thread = askSessionStore.messages(threadKey);
            const index = thread.findIndex((message) => message.id === placeholderId);
            if (index < 0) return;
            const next = [...thread];
            // The server holds the sentinel back, and this holds it back again.
            // Rendering it would put "§§FOLLOW_UPS§§" and three bare questions
            // into the middle of an answer, which is the one streaming failure a
            // reader would definitely notice — cheap enough to defend twice.
            next[index] = {...next[index], text: visibleAnswerSoFar(answer), status: "streaming"};
            replace(next);
        };

        const settle = (text: string, followUps: string[], failed: boolean) => {
            const thread = askSessionStore.messages(threadKey);
            const index = thread.findIndex((message) => message.id === placeholderId);
            if (index < 0) return;
            const next = [...thread];
            next[index] = {
                ...next[index],
                text,
                status: failed ? "failed" : "complete",
                followUpPrompts: failed ? [] : followUps
            };
            replace(next);
        };

        const drop = () => {
            const thread = askSessionStore.messages(threadKey);
            replace(thread.filter((message) => message.id !== placeholderId));
        };

        const payWithCredits = isPaying();
        const requestBody = {
            question,
            locale,
            history,
            requestId,
            ...(payWithCredits ? {payWithCredits: true} : {}),
            subject: {
                scope: subject.scope,
                slug: subject.slug,
                name: subject.name,
                captureId: subject.captureId,
                hasReaderPhoto: subject.hasReaderPhoto,
                title: subject.title,
                summary: subject.summary,
                path: subject.path,
                trialContext: subject.trialContext,
                trialKey: subject.trialKey
            }
        };

        /** The model's own offers, plus the Wild Profile offer when the reader has none. */
        const offersFor = (raw: string[], event: StreamEvent) => decorateFollowUps(
            raw.length ? raw : fallbackFollowUps(principleName, Boolean(subject.trialContext)),
            {
                signedIn: event.signed_in ?? callbacks.current.viewer?.signedIn ?? false,
                hasWildProfile: event.has_wild_profile ?? callbacks.current.viewer?.hasWildProfile ?? false
            }
        );

        try {
            const response = await fetch("/api/ask/stream", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                signal: controller.signal,
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429) {
                const payload = await response.json().catch(() => ({})) as {
                    retryAfterSeconds?: number;
                    limit?: number;
                    signedIn?: boolean;
                    isPro?: boolean;
                    reason?: string;
                    creditOverflow?: unknown;
                };
                // Paying and still refused: the balance ran out, so the
                // offer goes away until the reader is offered it again.
                if (payWithCredits) stopPaying();
                setQuota({
                    remaining: 0,
                    limit: payload.limit ?? null,
                    reached: true,
                    signedIn: payload.signedIn ?? callbacks.current.viewer?.signedIn ?? false,
                    isPro: payload.isPro ?? false,
                    reason: payload.reason,
                    creditOverflow: creditOverflowFrom(payload.creditOverflow),
                    paying: false
                });
                throw new AskLimitError(payload.retryAfterSeconds ?? 0, payload.limit ?? 0, payload.reason);
            }
            if (!response.ok || !response.body) {
                throw new AskUnavailableError();
            }

            let streamError: string | null = null;
            await consumeAskStream(response.body, (event) => {
                if (typeof event.delta === "string") {
                    answer += event.delta;
                    flush(false);
                    return;
                }
                if (event.done) {
                    didFinish = true;
                    const split = splitStreamedReply(answer);
                    const offers = offersFor(
                        event.follow_up_prompts?.length ? event.follow_up_prompts : split.followUps,
                        event
                    );
                    settle(split.answer, offers, false);
                    if (typeof event.remaining === "number") {
                        const paying = isPaying();
                        setQuota({
                            remaining: event.remaining,
                            limit: event.limit ?? null,
                            // While paying with credits the allowance is spent
                            // by design; the footer says what each message costs.
                            reached: event.remaining <= 0 && !paying,
                            signedIn: event.signed_in ?? callbacks.current.viewer?.signedIn ?? false,
                            isPro: event.is_pro ?? false,
                            creditOverflow: event.credit_overflow ?? null,
                            paying,
                            creditCost: event.credit_cost ?? null,
                            creditBalance: event.credit_balance ?? null
                        });
                    }
                    callbacks.current.onAnswered?.({question, followUps: offers.length});
                    return;
                }
                if (event.error) streamError = event.error;
            });

            if (!didFinish) {
                const partial = splitStreamedReply(answer);

                // The connection ended before the answer did. Ask once more for
                // the whole answer in one piece and put that in its place: half
                // an answer that stops mid-sentence reads as the whole of one.
                // Not attempted when the server itself reported a failure, which
                // a second request would only repeat.
                let whole: CompleteAnswer | null = null;
                if (!streamError) {
                    try {
                        const retryResponse = await fetch("/api/ask/stream", {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            signal: controller.signal,
                            body: JSON.stringify({...requestBody, mode: "complete"})
                        });
                        if (retryResponse.status === 429) {
                            setQuota((current) => ({...current, remaining: 0, reached: !isPaying()}));
                        } else if (retryResponse.ok) {
                            whole = await retryResponse.json() as CompleteAnswer;
                        }
                    } catch (error) {
                        if (controller.signal.aborted) throw error;
                    }
                }

                if (whole?.answer?.trim()) {
                    const offers = offersFor(whole.follow_up_prompts ?? [], whole);
                    settle(whole.answer, offers, false);
                    if (typeof whole.remaining === "number") {
                        const paying = isPaying();
                        setQuota({
                            remaining: whole.remaining,
                            limit: whole.limit ?? null,
                            reached: whole.remaining <= 0 && !paying,
                            paying,
                            creditCost: whole.credit_cost ?? null,
                            creditBalance: whole.credit_balance ?? null
                        });
                    }
                    callbacks.current.onAnswered?.({question, followUps: offers.length});
                } else if (partial.answer.trim()) {
                    // The whole answer could not be had either. What arrived is
                    // still an answer to the question that was asked, so it is
                    // kept rather than replaced with an error.
                    settle(partial.answer, offersFor(partial.followUps, {}), false);
                } else {
                    throw streamError ? new AskUnavailableError() : new AskEmptyError();
                }
            }
        } catch (error) {
            if (controller.signal.aborted) {
                // Stopping is a reader action, not a failure: drop the
                // placeholder and leave the question standing so it can be
                // sent again.
                drop();
            } else {
                settle(askErrorMessage(error), [], true);
                callbacks.current.onFailed?.(error instanceof Error ? error.message : "unknown");
            }
        } finally {
            abortRef.current = null;
            setIsSending(false);
        }
    }, [threadKey, subject, locale, principleName, replace, isPaying, stopPaying]);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    /**
     * Drops a failed answer and re-asks the question that produced it, as the
     * same message: same id, so the server never charges it twice, and the
     * question is re-added by `send` rather than left standing twice.
     */
    const retry = useCallback((messageId: string) => {
        const thread = askSessionStore.messages(threadKey);
        const index = thread.findIndex((message) => message.id === messageId);
        if (index <= 0 || thread[index - 1].role !== "user") return;
        const asked = thread[index - 1];
        replace([...thread.slice(0, index - 1), ...thread.slice(index + 1)]);
        void send(asked.text, {requestId: asked.id});
    }, [threadKey, replace, send]);

    /**
     * The reader chose "Continue with credits": every message pays one credit
     * until the allowance resets, and the message the limit refused is sent
     * again (same id) so they do not have to retype it.
     */
    const continueWithCredits = useCallback(() => {
        const until = nextUtcMidnight();
        payingUntilRef.current = until;
        setPayingUntil(until);
        writePayingUntil(until);
        setQuota((current) => ({...current, reached: false, paying: true}));
        const thread = askSessionStore.messages(threadKey);
        const last = thread[thread.length - 1];
        if (last && last.role === "assistant" && last.status === "failed") retry(last.id);
    }, [threadKey, retry]);

    /** Drops a finished answer and asks again, so the thread keeps its shape. */
    const regenerate = useCallback((messageId: string) => {
        const thread = askSessionStore.messages(threadKey);
        const index = thread.findIndex((message) => message.id === messageId);
        if (index <= 0 || thread[index - 1].role !== "user") return;
        const question = thread[index - 1].text;
        replace([...thread.slice(0, index - 1), ...thread.slice(index + 1)]);
        void send(question);
    }, [threadKey, replace, send]);

    const clear = useCallback(() => {
        stop();
        askSessionStore.clear(threadKey);
    }, [stop, threadKey]);

    const hasConversation = useMemo(
        () => messages.some((message) => message.role === "user"),
        [messages]
    );

    const paying = payingUntil !== null && payingUntil > Date.now();

    return {
        messages,
        hasConversation,
        isSending,
        quota: {...quota, paying},
        send,
        stop,
        retry,
        regenerate,
        clear,
        continueWithCredits
    };
}

const EMPTY_MESSAGES: AskMessage[] = [];
