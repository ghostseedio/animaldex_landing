"use client";

import {useEffect, useState} from "react";
import {parseTrialStoryboard, type TrialStoryboard} from "@/lib/trial-motion/storyboard";

/**
 * A Trial's Loop storyboard, for surfaces whose data carries none (Discover
 * Trial posts). Requests made in the same moment go out as one call, and every
 * answer, null included, is remembered for the page's lifetime.
 */

const cache = new Map<string, TrialStoryboard | null>();
const waiting = new Map<string, Array<(value: TrialStoryboard | null) => void>>();
let flushTimer: number | null = null;

function keyOf(speciesProfileId: string, frequency: string) {
    return `${speciesProfileId.toLowerCase()}:${frequency.toUpperCase()}`;
}

/** Puts a storyboard in the cache, as if fetched (dev preview fixtures). */
export function primeTrialMotionStoryboard(speciesProfileId: string, frequency: string, storyboard: unknown) {
    cache.set(keyOf(speciesProfileId, frequency), parseTrialStoryboard(storyboard));
}

function settle(key: string, value: TrialStoryboard | null) {
    cache.set(key, value);
    for (const resolve of waiting.get(key) ?? []) resolve(value);
    waiting.delete(key);
}

function flush() {
    flushTimer = null;
    const keys = Array.from(waiting.keys()).filter((key) => !cache.has(key));
    for (let start = 0; start < keys.length; start += 24) {
        const chunk = keys.slice(start, start + 24);
        fetch(`/api/trial-motion?key=${encodeURIComponent(chunk.join(","))}`)
            .then((response) => (response.ok ? response.json() : {storyboards: {}}))
            .then((payload: {storyboards?: Record<string, unknown>}) => {
                for (const key of chunk) settle(key, parseTrialStoryboard(payload.storyboards?.[key] ?? null));
            })
            .catch(() => {
                // No loop is the same as today's card; do not remember a network failure.
                for (const key of chunk) {
                    for (const resolve of waiting.get(key) ?? []) resolve(null);
                    waiting.delete(key);
                }
            });
    }
}

function request(key: string) {
    return new Promise<TrialStoryboard | null>((resolve) => {
        waiting.set(key, [...(waiting.get(key) ?? []), resolve]);
        if (flushTimer == null) flushTimer = window.setTimeout(flush, 40);
    });
}

export function useTrialMotionStoryboard(speciesProfileId: string | null | undefined, frequency: string | null | undefined, enabled = true) {
    const key = speciesProfileId && frequency && ["LOW", "MID", "HIGH"].includes(frequency.toUpperCase())
        ? keyOf(speciesProfileId, frequency)
        : null;
    const [storyboard, setStoryboard] = useState<TrialStoryboard | null>(() => (key ? cache.get(key) ?? null : null));

    useEffect(() => {
        if (!key || !enabled) return undefined;
        if (cache.has(key)) {
            setStoryboard(cache.get(key) ?? null);
            return undefined;
        }
        let cancelled = false;
        void request(key).then((value) => {
            if (!cancelled) setStoryboard(value);
        });
        return () => {
            cancelled = true;
        };
    }, [enabled, key]);

    return key && enabled ? storyboard : null;
}
