"use client";

/**
 * The chat's context (`/api/ask/context`: who the animal is to this reader,
 * its openers) takes a round trip to the database, about a second from far
 * away. Started when the reader shows intent (a hover that settles, a touch,
 * focus) on the animal they are about to open, it is in flight or done by
 * the time the conversation mounts and asks for it. One promise per request
 * body, kept briefly; a failure is forgotten so the conversation asks again.
 */

import {askDeclaredSubject, type AskSubject} from "@/lib/ask-animaldex/subject";

const KEEP_MS = 60_000;
const inflight = new Map<string, {at: number; promise: Promise<Response>}>();

/** The request body the conversation sends, so a prefetch and the real read share one key. */
export function askContextRequestBody(locale: string, subject: AskSubject): string {
    return JSON.stringify({
        locale,
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
            trialKey: subject.trialKey,
            ...(subject.arkAnimalId ? {arkAnimalId: subject.arkAnimalId} : {})
        }
    });
}

function request(body: string): Promise<Response> {
    return fetch("/api/ask/context", {method: "POST", headers: {"Content-Type": "application/json"}, body});
}

/**
 * The context for this body: the prefetched read when there is one fresh
 * enough, else a new one. The response is cloned, so a prefetch can be read
 * once by the conversation and still serve a second mount within the minute.
 */
export function fetchAskContext(body: string): Promise<Response> {
    const kept = inflight.get(body);
    if (kept && Date.now() - kept.at < KEEP_MS) return kept.promise.then((response) => response.clone());
    const promise = request(body);
    inflight.set(body, {at: Date.now(), promise});
    promise.then((response) => {
        if (!response.ok) inflight.delete(body);
    }).catch(() => inflight.delete(body));
    return promise.then((response) => response.clone());
}

/** Warms the context for a subject; nothing when it is already warm. */
export function prefetchAskContextFor(locale: string, subject: AskSubject) {
    if (typeof window === "undefined") return;
    const body = askContextRequestBody(locale, subject);
    const kept = inflight.get(body);
    if (kept && Date.now() - kept.at < KEEP_MS) return;
    void fetchAskContext(body).catch(() => undefined);
}

/** Warms the context for an animal's Talk page chat, the subject exactly as `TalkChat` declares it (the path carries no query). */
export function prefetchAskContext(locale: string, slug: string, name: string, captureId: string | null = null) {
    prefetchAskContextFor(locale, askDeclaredSubject(`/talk/${slug}`, {scope: "species", slug, name, title: name, captureId}, null));
}

/**
 * Intent on a link to an animal's chat: a hover that settles (120 ms), a
 * touch, a press or focus. Returns the handlers to spread on the link.
 */
export function askContextIntentHandlers(prefetch: () => void) {
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = null;
    };
    return {
        onMouseEnter: () => {
            clear();
            hoverTimer = setTimeout(prefetch, 120);
        },
        onMouseLeave: clear,
        onPointerDown: prefetch,
        onTouchStart: prefetch,
        onFocus: prefetch
    };
}
