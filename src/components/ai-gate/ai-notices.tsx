"use client";

/**
 * The AI disclosure every chat carries (SPEC 3.1): the "AI" tag in its
 * header, the quiet "Replies are AI-generated." line at the top of the
 * conversation, and the notice once a session has run past three hours
 * (for a teen, with a break suggested). Square, quiet, never a banner.
 */

import {useCallback, useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AI_SAFETY_HREF} from "@/components/ai-gate/ai-chat-gate";
import {AI_SESSION_KEY, longSessionNoticeDue, parseAiSession, touchAiSession} from "@/lib/ai-chat-gate";

/**
 * "AI", beside the name in a chat header: always visible. With `linksToSafety`
 * it opens the safety page, the way the inline line used to (that line left
 * the top of the chat on 2026-11-06, owner: "drop both").
 */
export function AiTag({label, className = "", linksToSafety = false}: {label?: string; className?: string; linksToSafety?: boolean}) {
    const tag = (
        <span
            title={label}
            aria-label={label}
            className={`inline-flex h-4 shrink-0 items-center border border-primary-300/60 px-1 text-[9px] font-black uppercase leading-none tracking-[0.12em] text-primary-200 ${className}`}
            data-testid="ai-tag"
        >
            AI
        </span>
    );
    return linksToSafety ? <Link href={AI_SAFETY_HREF} className="inline-flex shrink-0 hover:opacity-80">{tag}</Link> : tag;
}

/** "Replies are AI-generated.", with the safety page a tap away. */
export function AiNotice({text, linkLabel, className = ""}: {text: string; linkLabel?: string; className?: string}) {
    return (
        <p className={`text-center text-[11px] leading-4 text-ink-400 ${className}`} data-testid="ai-notice">
            {text}
            {linkLabel ? (
                <>
                    {" "}
                    <Link href={AI_SAFETY_HREF} className="underline underline-offset-2 hover:text-white">{linkLabel}</Link>
                </>
            ) : null}
        </p>
    );
}

function readSession() {
    try {
        return parseAiSession(window.sessionStorage.getItem(AI_SESSION_KEY));
    } catch {
        return null;
    }
}

/**
 * This tab's chat session: `touch()` on every message sent; `due` once it has
 * run past three hours without a long gap (re-read every minute).
 */
export function useAiLongSession(): {due: boolean; touch: () => void} {
    const [due, setDue] = useState(false);
    const check = useCallback(() => setDue(longSessionNoticeDue(readSession(), Date.now())), []);
    useEffect(() => {
        check();
        const timer = window.setInterval(check, 60_000);
        return () => window.clearInterval(timer);
    }, [check]);
    const touch = useCallback(() => {
        const next = touchAiSession(readSession(), Date.now());
        try {
            window.sessionStorage.setItem(AI_SESSION_KEY, JSON.stringify(next));
        } catch {
            // Without session storage the notice cannot keep time; the top notice still shows.
        }
        check();
    }, [check]);
    return {due, touch};
}
