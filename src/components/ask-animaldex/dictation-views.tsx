"use client";

/**
 * The message bar's dictation (DECISIONS section 9): the mic beside Send,
 * and while it listens a strip above the field with a live level, a timer
 * and ✕, the words arriving in the field itself. In the bar, the way "I did
 * it" puts the bar in report mode; never a window.
 */

import {useEffect, useRef, useState} from "react";
import {MicIcon} from "@/components/ask-animaldex/voice-call/call-icons";
import {usePrefersReducedMotion} from "@/components/ask-animaldex/use-reply-pacer";
import type {DictationPhase} from "@/components/ask-animaldex/use-dictation";
import type {CallCopy} from "@/lib/ask-animaldex/call-copy";
import {dictationClock} from "@/lib/ask-animaldex/dictation";

const BARS = 7;

function DictationLevel({level}: {level: () => number}) {
    const bars = useRef<Array<HTMLSpanElement | null>>([]);
    const reduced = usePrefersReducedMotion();
    useEffect(() => {
        if (reduced) return;
        let frame = 0;
        const tick = () => {
            frame = requestAnimationFrame(tick);
            const value = level();
            bars.current.forEach((bar, index) => {
                if (!bar) return;
                const shape = [0.55, 0.8, 1, 0.9, 1, 0.75, 0.5][index] ?? 0.7;
                bar.style.transform = `scaleY(${Math.max(0.2, Math.min(1, value * shape * 1.4))})`;
            });
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [level, reduced]);
    return (
        <span className="flex h-5 items-center gap-[3px]" aria-hidden="true">
            {Array.from({length: BARS}, (_, index) => (
                <span
                    key={index}
                    ref={(node) => {
                        bars.current[index] = node;
                    }}
                    className="h-5 w-[3px] origin-center rounded-full bg-primary-400 transition-transform duration-75"
                    style={{transform: "scaleY(0.25)"}}
                />
            ))}
        </span>
    );
}

/** The strip above the field: why, the first time; listening; turning it into text; or why it could not. */
export function DictationStrip({phase, priming, startedAt, name, copy, level, onCancel, onDismiss}: {
    phase: DictationPhase;
    priming: boolean;
    startedAt: number | null;
    /** The animal they are talking to, for the first-time line. */
    name: string;
    copy: CallCopy;
    level: () => number;
    onCancel: () => void;
    onDismiss: () => void;
}) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (phase !== "listening") return;
        const timer = window.setInterval(() => setNow(Date.now()), 500);
        return () => window.clearInterval(timer);
    }, [phase]);
    if (phase === "idle") return null;
    const quiet = phase === "denied" || phase === "failed";
    const line = phase === "starting"
        ? (priming ? copy.dictationPrimer.replace("{name}", name) : null)
        : phase === "transcribing"
            ? copy.transcribing
            : phase === "denied"
                ? copy.dictationDenied
                : phase === "failed"
                    ? copy.dictationFailed
                    : null;
    return (
        <div
            className="-mx-4 -mt-3 mb-3 flex items-center gap-3 border-b border-primary-400/20 bg-primary-400/[0.07] py-2 pl-[19px] pr-4"
            style={{boxShadow: "inset 3px 0 0 var(--ask-special-edge)"}}
            role={quiet ? "alert" : "status"}
            data-testid="dictation-strip"
        >
            {phase === "listening" ? (
                <>
                    <DictationLevel level={level} />
                    <span className="text-[13px] font-semibold leading-4 tabular-nums text-white/80">{dictationClock(startedAt ? (now - startedAt) / 1000 : 0)}</span>
                    <span className="min-w-0 flex-1" />
                </>
            ) : (
                <p className={`min-w-0 flex-1 text-[13px] leading-4 ${quiet ? "text-ink-200" : "text-primary-300"}`}>{line}</p>
            )}
            <button
                type="button"
                onClick={quiet ? onDismiss : onCancel}
                aria-label={copy.cancelDictation}
                title={copy.cancelDictation}
                className="-mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12"
            >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9m0-9l-9 9" /></svg>
            </button>
        </div>
    );
}

/** The mic beside Send: tap to dictate, tap again (✓) to stop; the words stay in the field. */
export function DictationButton({active, busy, copy, onStart, onStop}: {
    active: boolean;
    /** Turning the recording into text: wait. */
    busy: boolean;
    copy: CallCopy;
    onStart: () => void;
    onStop: () => void;
}) {
    return (
        <button
            type="button"
            onClick={active ? onStop : onStart}
            disabled={busy}
            aria-label={active ? copy.stopDictating : copy.dictate}
            aria-pressed={active}
            title={active ? copy.stopDictating : copy.dictate}
            className={`mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40 ${active ? "bg-primary-400/[0.16] text-primary-300" : "text-ink-300 hover:bg-white/8 hover:text-white active:bg-white/12"}`}
            data-testid="dictation-button"
        >
            {active ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
            ) : (
                <MicIcon size={17} />
            )}
        </button>
    );
}
