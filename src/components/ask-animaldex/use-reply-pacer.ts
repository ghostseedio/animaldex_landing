"use client";

/**
 * Types one reply out at the animal's pace. The timer half of
 * `AnimalReplyPacer` in the iOS app; the steps themselves are
 * `askPacerStep` in `@/lib/ask-animaldex/pacer`.
 *
 * Only a reply that arrives while the drawer is open is paced: one restored
 * from an earlier visit is simply there. The text a reader sees is never
 * taken back, and a reader who prefers reduced motion gets every word as it
 * arrives, as they did before pacing existed.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {ASK_PACER_DEFAULT, ASK_PACER_WAIT_SECONDS, askPacerStep, askPacerWordShown} from "@/lib/ask-animaldex/pacer";
import type {AskPersonaFrame} from "@/lib/ask-animaldex/persona";

export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(query.matches);
        update();
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    return reduced;
}

export type AskReplyPacer = {
    /** The reply being typed out, or null when nothing is. */
    messageId: string | null;
    /** What of it is on screen. */
    visibleText: string;
    /** Still typing: there is more to show, or more may arrive. */
    revealing: boolean;
    /** Show the rest now (a click on the reply, or Stop once it has all arrived). */
    skipToEnd: () => void;
};

export function useReplyPacer(params: {
    /** The assistant message to type out; a new id starts over. */
    messageId: string | null;
    /** Everything received for it so far. */
    text: string;
    /** The network is done with it. */
    sourceDone: boolean;
    persona: AskPersonaFrame | null;
    /** Reduced motion: no pacing at all. */
    instant: boolean;
    /**
     * Words just appeared while typing: whether they open the reply and
     * whether they end a sentence. The animal's sounds follow this. Not called
     * when the rest appears at once (a click, Stop, reduced motion), nor for a
     * card or drawing.
     */
    onWordShown?: (word: {isFirst: boolean; endsSentence: boolean}) => void;
}): AskReplyPacer {
    const [visibleText, setVisibleText] = useState("");
    const [revealing, setRevealing] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

    const shownRef = useRef(0);
    const skipRef = useRef(false);
    const wordsShownRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The loop reads the latest of these on every step.
    const latest = useRef(params);
    latest.current = params;

    const clearTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
    };

    const tick = useCallback(() => {
        timerRef.current = null;
        const {text, sourceDone, persona, instant} = latest.current;
        const shown = Math.min(shownRef.current, text.length);
        if (shown >= text.length && sourceDone) {
            setVisibleText(text);
            setRevealing(false);
            return;
        }
        const step = askPacerStep({
            target: text,
            shown,
            sourceDone,
            instant: instant || skipRef.current,
            typingCps: persona?.typing_cps ?? ASK_PACER_DEFAULT.typingCps,
            pace: persona?.pace ?? ASK_PACER_DEFAULT.pace
        });
        const advanced = step.next > shown;
        if (advanced) {
            shownRef.current = step.next;
            setVisibleText(text.slice(0, step.next));
            const word = instant || skipRef.current ? null : askPacerWordShown(text.slice(shown, step.next));
            if (word) {
                latest.current.onWordShown?.({isFirst: wordsShownRef.current === 0, endsSentence: word.endsSentence});
                wordsShownRef.current += 1;
            }
        }
        const wait = advanced ? step.pause : Math.max(step.pause, ASK_PACER_WAIT_SECONDS);
        timerRef.current = setTimeout(tick, Math.round(wait * 1000));
    }, []);

    // A new reply starts over from nothing.
    useEffect(() => {
        clearTimer();
        shownRef.current = 0;
        skipRef.current = false;
        wordsShownRef.current = 0;
        setVisibleText("");
        setActiveId(params.messageId);
        if (!params.messageId) {
            setRevealing(false);
            return;
        }
        setRevealing(true);
        timerRef.current = setTimeout(tick, 0);
        return clearTimer;
    }, [params.messageId, tick]);

    // Reduced motion, or more text after the loop went quiet: step now.
    useEffect(() => {
        if (!params.messageId || timerRef.current) return;
        if (shownRef.current < params.text.length || !params.sourceDone) {
            setRevealing(true);
            timerRef.current = setTimeout(tick, 0);
        }
    }, [params.messageId, params.text, params.sourceDone, params.instant, tick]);

    const skipToEnd = useCallback(() => {
        skipRef.current = true;
        clearTimer();
        timerRef.current = setTimeout(tick, 0);
    }, [tick]);

    const current = activeId === params.messageId && params.messageId !== null;
    return {
        messageId: current ? params.messageId : null,
        visibleText: current ? visibleText : "",
        revealing: current ? revealing : false,
        skipToEnd
    };
}
