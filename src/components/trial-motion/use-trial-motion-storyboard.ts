"use client";

import {useEffect, useState} from "react";
import {usePathname} from "next/navigation";
import {parseTrialStoryboard, type TrialStoryboard} from "@/lib/trial-motion/storyboard";
import {trialMotionCaptionLanguageFromPath} from "@/lib/trial-motion/captions";

/**
 * A Trial's Loop storyboard, and on an /id page its pre-translated captions,
 * for surfaces whose data carries none (Discover Trial posts). Requests made in
 * the same moment go out as one call per language, and every answer, null
 * included, is remembered for the page's lifetime.
 */

export type TrialMotionLoopData = {
    storyboard: TrialStoryboard | null;
    /** Translated captions valid for exactly this storyboard; null shows its own. */
    captions: string[] | null;
};

const EMPTY: TrialMotionLoopData = {storyboard: null, captions: null};
const cache = new Map<string, TrialMotionLoopData>();
const waiting = new Map<string, Array<(value: TrialMotionLoopData) => void>>();
let flushTimer: number | null = null;

function keyOf(speciesProfileId: string, frequency: string) {
    return `${speciesProfileId.toLowerCase()}:${frequency.toUpperCase()}`;
}

/** The cache key: the Trial, and the caption language ("en" for none). */
function cacheKeyOf(key: string, lang: string | null) {
    return `${key}|${lang ?? "en"}`;
}

/** Puts a storyboard (and captions) in the cache, as if fetched (dev preview fixtures). */
export function primeTrialMotionStoryboard(speciesProfileId: string, frequency: string, storyboard: unknown, captions: {lang: string; captions: string[]} | null = null) {
    const key = keyOf(speciesProfileId, frequency);
    const parsed = parseTrialStoryboard(storyboard);
    cache.set(cacheKeyOf(key, null), {storyboard: parsed, captions: null});
    if (captions) cache.set(cacheKeyOf(key, captions.lang), {storyboard: parsed, captions: captions.captions});
}

function settle(cacheKey: string, value: TrialMotionLoopData) {
    cache.set(cacheKey, value);
    for (const resolve of waiting.get(cacheKey) ?? []) resolve(value);
    waiting.delete(cacheKey);
}

function flush() {
    flushTimer = null;
    const pending = Array.from(waiting.keys()).filter((cacheKey) => !cache.has(cacheKey));
    const byLanguage = new Map<string, string[]>();
    for (const cacheKey of pending) {
        const lang = cacheKey.split("|")[1];
        byLanguage.set(lang, [...(byLanguage.get(lang) ?? []), cacheKey]);
    }
    byLanguage.forEach((cacheKeys, lang) => {
        for (let start = 0; start < cacheKeys.length; start += 24) {
            const chunk = cacheKeys.slice(start, start + 24);
            const keys = chunk.map((cacheKey) => cacheKey.split("|")[0]);
            const langParam = lang === "en" ? "" : `&lang=${encodeURIComponent(lang)}`;
            fetch(`/api/trial-motion?key=${encodeURIComponent(keys.join(","))}${langParam}`)
                .then((response) => (response.ok ? response.json() : {storyboards: {}, captions: {}}))
                .then((payload: {storyboards?: Record<string, unknown>; captions?: Record<string, unknown>}) => {
                    chunk.forEach((cacheKey, index) => {
                        const storyboard = parseTrialStoryboard(payload.storyboards?.[keys[index]] ?? null);
                        const raw = payload.captions?.[keys[index]];
                        const captions = storyboard && Array.isArray(raw) && raw.length === storyboard.beats.length && raw.every((item) => typeof item === "string")
                            ? (raw as string[])
                            : null;
                        settle(cacheKey, {storyboard, captions});
                    });
                })
                .catch(() => {
                    // No loop is the same as today's card; do not remember a network failure.
                    for (const cacheKey of chunk) {
                        for (const resolve of waiting.get(cacheKey) ?? []) resolve(EMPTY);
                        waiting.delete(cacheKey);
                    }
                });
        }
    });
}

function request(cacheKey: string) {
    return new Promise<TrialMotionLoopData>((resolve) => {
        waiting.set(cacheKey, [...(waiting.get(cacheKey) ?? []), resolve]);
        if (flushTimer == null) flushTimer = window.setTimeout(flush, 40);
    });
}

export function useTrialMotionStoryboard(speciesProfileId: string | null | undefined, frequency: string | null | undefined, enabled = true): TrialMotionLoopData {
    const lang = trialMotionCaptionLanguageFromPath(usePathname());
    const key = speciesProfileId && frequency && ["LOW", "MID", "HIGH"].includes(frequency.toUpperCase())
        ? keyOf(speciesProfileId, frequency)
        : null;
    const cacheKey = key ? cacheKeyOf(key, lang) : null;
    const [data, setData] = useState<TrialMotionLoopData>(() => (cacheKey ? cache.get(cacheKey) ?? EMPTY : EMPTY));

    useEffect(() => {
        if (!cacheKey || !enabled) return undefined;
        const cached = cache.get(cacheKey);
        if (cached) {
            setData(cached);
            return undefined;
        }
        let cancelled = false;
        void request(cacheKey).then((value) => {
            if (!cancelled) setData(value);
        });
        return () => {
            cancelled = true;
        };
    }, [cacheKey, enabled]);

    return cacheKey && enabled ? data : EMPTY;
}

/** The page's Trial Loop caption language: `id` on /id pages, null (English) elsewhere. */
export function useTrialMotionCaptionLanguage() {
    return trialMotionCaptionLanguageFromPath(usePathname());
}
