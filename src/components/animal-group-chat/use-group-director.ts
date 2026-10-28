"use client";

/**
 * Plays a group round out on screen: one animal typing at a time at its own
 * pace, a short natural breath between speakers, and the next animal visibly
 * typing before the current one has finished. The server writes the turns
 * (`group-conversation.ts`); this decides when each appears.
 *
 * The web counterpart of `AnimalGroupConversationDirector` in the iOS app.
 * The order rules are `group-thread.ts`; the typing is the one-to-one chat's
 * pacer (`useReplyPacer`), so every animal types exactly as it does alone.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {useReplyPacer} from "@/components/ask-animaldex/use-reply-pacer";
import {
    EMPTY_ASK_GROUP_QUEUE,
    askGroupPauseSeconds,
    askGroupQueueCurrent,
    askGroupQueueFail,
    askGroupQueueFinish,
    askGroupQueueFinishStream,
    askGroupQueueIsFinished,
    askGroupQueueMarkRevealed,
    askGroupQueueReceive,
    askGroupQueueStart,
    askGroupQueueWaiting,
    askGroupTurnReadyToType,
    type AskGroupQueue,
    type AskGroupTurn,
    type AskGroupTurnStart
} from "@/lib/ask-animaldex/group-thread";

export type AskGroupDirectorCallbacks = {
    /** A turn finished typing: it belongs in the thread now. */
    onTurnShown?: (turn: AskGroupTurn, text: string) => void;
    /** The round is over and everything is on screen. */
    onRoundFinished?: () => void;
    /**
     * Words of a turn just appeared while it typed: the animal's own sounds
     * follow this, per speaker (the apps' `pacer.onWordShown` → that animal's
     * soundscape). Not called when the rest appears at once.
     */
    onWordShown?: (captureId: string, word: {isFirst: boolean; endsSentence: boolean}) => void;
};

export function useAskGroupDirector(params: AskGroupDirectorCallbacks & {
    /** Reduced motion: every word as it arrives. */
    instant: boolean;
}) {
    const [queue, setQueue] = useState<AskGroupQueue>(EMPTY_ASK_GROUP_QUEUE);
    const [revealingIndex, setRevealingIndex] = useState<number | null>(null);
    const [pausing, setPausing] = useState(false);
    const [active, setActive] = useState(false);
    const [round, setRound] = useState(0);
    const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Read through a ref, so a callback that changes identity never restarts a round.
    const callbacks = useRef(params);
    callbacks.current = params;

    const revealing = revealingIndex === null ? null : queue.turns.find((turn) => turn.index === revealingIndex) ?? null;
    const revealId = revealing ? `${round}-${revealing.index}` : null;
    const pacer = useReplyPacer({
        messageId: revealId,
        text: revealing?.text ?? "",
        sourceDone: revealing?.serverDone ?? false,
        persona: revealing?.persona ?? null,
        instant: params.instant,
        onWordShown: (word) => {
            if (revealing) callbacks.current.onWordShown?.(revealing.captureId, word);
        }
    });

    const clearPause = () => {
        if (pauseTimer.current) clearTimeout(pauseTimer.current);
        pauseTimer.current = null;
    };
    useEffect(() => clearPause, []);

    // The turn on screen has typed out in full: it joins the thread, and the
    // next animal draws breath before it speaks.
    useEffect(() => {
        if (!revealing || !revealing.serverDone || pacer.messageId !== revealId || pacer.revealing) return;
        const after = askGroupQueueMarkRevealed(queue, revealing.index);
        setQueue(after);
        setRevealingIndex(null);
        callbacks.current.onTurnShown?.(revealing, revealing.text.trim());
        const next = askGroupQueueCurrent(after);
        if (next) {
            setPausing(true);
            clearPause();
            pauseTimer.current = setTimeout(() => {
                pauseTimer.current = null;
                setPausing(false);
            }, Math.round(askGroupPauseSeconds(next.persona?.pace, Math.random()) * 1000));
        }
    }, [revealing, revealId, pacer.messageId, pacer.revealing, queue]);

    // The next turn starts typing when its text is there and the breath is over;
    // the round closes when nothing is left.
    useEffect(() => {
        if (!active || revealingIndex !== null || pausing) return;
        const next = askGroupQueueCurrent(queue);
        if (!next) {
            if (askGroupQueueIsFinished(queue)) {
                setActive(false);
                callbacks.current.onRoundFinished?.();
            }
            return;
        }
        if (askGroupTurnReadyToType(next)) setRevealingIndex(next.index);
    }, [active, revealingIndex, pausing, queue]);

    const beginRound = useCallback(() => {
        clearPause();
        setPausing(false);
        setQueue(EMPTY_ASK_GROUP_QUEUE);
        setRevealingIndex(null);
        setRound((current) => current + 1);
        setActive(true);
    }, []);

    const turnStarted = useCallback((start: AskGroupTurnStart) => setQueue((current) => askGroupQueueStart(current, start)), []);
    const received = useCallback((index: number, text: string) => setQueue((current) => askGroupQueueReceive(current, index, text)), []);
    const turnDone = useCallback((index: number, settled: boolean) => setQueue((current) => askGroupQueueFinish(current, index, settled)), []);
    const turnFailed = useCallback((index: number) => {
        setQueue((current) => askGroupQueueFail(current, index));
        setRevealingIndex((current) => (current === index ? null : current));
    }, []);
    const streamFinished = useCallback(() => setQueue((current) => askGroupQueueFinishStream(current)), []);

    /**
     * The reader jumped in or left: what the animal on screen had already said
     * stays (cut where it stood); everything not yet shown goes.
     */
    const interrupt = useCallback((): {turn: AskGroupTurn; shown: string} | null => {
        clearPause();
        const shown = revealing ? pacer.visibleText.trim() : "";
        const kept = revealing && shown ? {turn: revealing, shown} : null;
        setPausing(false);
        setQueue(EMPTY_ASK_GROUP_QUEUE);
        setRevealingIndex(null);
        setRound((current) => current + 1);
        setActive(false);
        return kept;
    }, [revealing, pacer.visibleText]);

    const current = askGroupQueueCurrent(queue);
    return {
        queue,
        active,
        /** The turn typing out right now, and what of it is on screen. */
        revealing: revealing && pacer.messageId === revealId ? revealing : null,
        visibleText: pacer.messageId === revealId ? pacer.visibleText : "",
        current,
        waiting: askGroupQueueWaiting(queue),
        beginRound,
        turnStarted,
        received,
        turnDone,
        turnFailed,
        streamFinished,
        interrupt,
        /** Show the rest of the current turn at once (a click on it). */
        skipCurrent: pacer.skipToEnd
    };
}
