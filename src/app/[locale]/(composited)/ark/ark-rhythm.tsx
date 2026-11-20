"use client";

import {Suspense, lazy, useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import type {ArkSceneHandle} from "@/ark-scene/types";
import type {ArkRhythmStatus} from "@/ark-scene/rhythm-status";
import {RhythmDot, RHYTHM_TONE} from "@/components/ark/sd-rhythm-dot";

/** The waveform, only once the panel opens (the page's static JavaScript budget, `ark-page-weight.test.ts`). */
const SdRhythmCompare = lazy(() => import("@/components/ark/sd-rhythm-compare"));
import {ARK_RHYTHM_ENGLISH, type ArkRhythmWords} from "@/lib/ark-sd-rhythm-words";

/**
 * The card's rhythm (lane `ark-sd-align`, owner 2026-11-15): the selected animal's last 24 hours in the Ark against its
 * kind's System Dynamics, from the scene (`animalRhythm`, the same schedule it animates). A line in the status column
 * (a dot, in rhythm / slightly off / out of rhythm) opens the comparison: the SD waveform beside its live line, its
 * modes' weights against its time, its tempo, why it is off (the server's state, in plain words) and, where a person's
 * step can bring it back, the way to its chat. Old age is said plainly, never promised.
 */

/** Its rhythm from the scene: worked out a little a tick until whole, then read again every few seconds. */
export function useAnimalRhythm(scene: () => ArkSceneHandle | null, id: string, stepFeeds = false): ArkRhythmStatus | "pending" | null {
    const [rhythm, setRhythm] = useState<ArkRhythmStatus | "pending" | null>("pending");
    useEffect(() => {
        let timer = 0;
        let stopped = false;
        let last = "";
        const read = () => {
            if (stopped) return;
            let next: ArkRhythmStatus | "pending" | null = null;
            try {
                next = scene()?.animalRhythm?.(id, {budgetMs: 8, stepFeeds}) ?? null;
            } catch {
                next = null;
            }
            const signature = next === null || next === "pending" ? String(next) : `${next.id}:${next.to}:${next.agreement.score.toFixed(3)}`;
            if (signature !== last) {
                last = signature;
                setRhythm(next);
            }
            timer = window.setTimeout(read, next === "pending" ? 60 : 5000);
        };
        setRhythm("pending");
        read();
        return () => {
            stopped = true;
            window.clearTimeout(timer);
        };
    }, [scene, id, stepFeeds]);
    return rhythm;
}

/** The SD waveform's path for a species (the System Dynamics route's teaser: signature, profile and waveform). */
function useSdPath(speciesProfileId: string | null | undefined, open: boolean): string | null {
    const [path, setPath] = useState<string | null>(null);
    useEffect(() => {
        if (!open || !speciesProfileId) return undefined;
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch(`/api/app/system-dynamics?speciesProfileId=${encodeURIComponent(speciesProfileId)}`, {headers: {Accept: "application/json"}, signal: controller.signal});
                if (!response.ok) return;
                const payload = await response.json();
                setPath(typeof payload?.dynamics?.waveform?.pathD === "string" ? payload.dynamics.waveform.pathD : null);
            } catch {
                // (No waveform: the comparison draws the Ark's line alone.)
            }
        })();
        return () => controller.abort();
    }, [speciesProfileId, open]);
    return path;
}

export function ArkRhythmLine({rhythm, open, onToggle, words = ARK_RHYTHM_ENGLISH}: {rhythm: ArkRhythmStatus; open: boolean; onToggle: () => void; words?: ArkRhythmWords}) {
    const state = rhythm.agreement.state;
    return (
        <button type="button" onClick={onToggle} aria-expanded={open} data-testid="ark-card-rhythm" data-state={state} className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full text-left text-[12px] leading-snug text-ink-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300">
            <RhythmDot state={state} />
            <span className="font-semibold" style={{color: RHYTHM_TONE[state]}}>{words.state[state]}</span>
            <span className="truncate text-ink-400">· {words.howItLives}</span>
            <span aria-hidden="true" className="text-ink-400">{open ? "▴" : "▾"}</span>
        </button>
    );
}

export function ArkRhythmPanel({rhythm, speciesProfileId, talkHref, words = ARK_RHYTHM_ENGLISH}: {rhythm: ArkRhythmStatus; speciesProfileId: string | null | undefined; talkHref: string | null; words?: ArkRhythmWords}) {
    const sdPath = useSdPath(speciesProfileId, true);
    const a = rhythm.agreement;
    const fixable = rhythm.causes.some((c) => c.fixable);
    return (
        <div className="mt-2 grid max-h-[42vh] grid-cols-1 gap-x-6 gap-y-3 overflow-y-auto overscroll-contain border-t border-line-200/60 pt-2.5 md:max-h-none md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:overflow-visible md:pl-[3.75rem]" data-testid="ark-card-rhythm-panel">
            <Suspense fallback={<div className="min-h-[120px]" />}>
                <SdRhythmCompare sdPath={sdPath} line={rhythm.line} live shares={a.shares} tempo={rhythm.tempo} boutMinutes={rhythm.boutMinutes} state={a.state} score={a.score} words={words} />
            </Suspense>
            <div className="flex min-w-0 flex-col gap-2 text-[12.5px] leading-snug">
                {a.state !== "in" ? (
                    <div>
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{words.causesTitle}</p>
                        {rhythm.causes.length ? (
                            <ul className="mt-1 flex flex-col gap-1">
                                {rhythm.causes.map((c) => (
                                    <li key={c.cause} className="text-ink-100" data-cause={c.cause}>
                                        {words.cause[c.cause]}
                                        {c.cause === "old" ? <span className="block text-ink-400">{words.oldNoFix}</span> : null}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-1 text-ink-200">{words.noKnownCause}</p>
                        )}
                        {fixable && talkHref ? (
                            <p className="mt-2 text-ink-100">
                                {words.stepFixes}{" "}
                                <Link href={talkHref} className="font-bold text-primary-300 underline-offset-2 hover:underline">{words.stepLink} →</Link>
                            </p>
                        ) : null}
                    </div>
                ) : null}
                {rhythm.page ? (
                    <Link href={`/animals/${rhythm.page}#system-dynamics`} className="font-bold text-primary-300 underline-offset-2 hover:underline" data-testid="ark-card-sd-link">
                        {words.howItLives} →
                    </Link>
                ) : null}
            </div>
        </div>
    );
}
