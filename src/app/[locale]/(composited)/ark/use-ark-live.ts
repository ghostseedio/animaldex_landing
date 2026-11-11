"use client";

import {useCallback, useEffect, useRef, type MutableRefObject} from "react";
import type {ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import type {ArkLive} from "@/ark-scene/live/controller";
import type {ArkWords} from "@/lib/ark-words";

/** The log's fold, kept per reader. */
const FOLD_KEY = "ark.live.folded";
/** Development's feed: a beat this often (ms), the first a moment after the world is up. */
const FEED_MS = 8_000;
const FEED_FIRST_MS = 3_000;

type Options = {
    sceneRef: MutableRefObject<ArkSceneHandle | null>;
    snapshotRef: MutableRefObject<ArkSnapshot | null>;
    setSnapshot: (snapshot: ArkSnapshot) => void;
    /** The scene is up. */
    ready: boolean;
    words: ArkWords;
    locale: string;
    /** Development's fixtures: no server event log to read. */
    fixture: boolean;
    /** Development's live feed (`?fixture=1&feed=1`, `?fixture=live`, `?fixture=grow`). */
    feed: boolean;
    /** `?fixture=grow`: who is still to come aboard (the feed's arrivals take them first). */
    growFrom: ArkSnapshot | null;
    /** A card covers the foot of the world. */
    covered: boolean;
    reducedMotion: boolean;
};

/**
 * The live log over /ark's world (`src/ark-scene/live/controller.ts`), and development's feed. The page hooks
 * in with `hostRef` (an empty box over the world) and `observe` (every snapshot it is handed, before its own
 * "same animals" check, so a clutch laid with no one new still reads the event log).
 */
export function useArkLive({sceneRef, snapshotRef, setSnapshot, ready, words, locale, fixture, feed, growFrom, covered, reducedMotion}: Options) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const liveRef = useRef<ArkLive | null>(null);
    const coveredRef = useRef(covered);
    coveredRef.current = covered;
    const wordsIn = useCallback(() => ({live: words.live, replay: words.replay, showMe: words.showMe}), [words]);
    const wordsRef = useRef(wordsIn);
    wordsRef.current = wordsIn;

    useEffect(() => {
        const host = hostRef.current;
        if (!ready || !host) return;
        let disposed = false;
        let live: ArkLive | null = null;
        void import("@/ark-scene/live/controller").then(({ArkLive}) => {
            if (disposed) return;
            live = new ArkLive({
                host,
                scene: () => sceneRef.current,
                words: wordsRef.current(),
                locale,
                eventsUrl: fixture ? null : "/api/ark/events",
                reducedMotion,
                storageKey: FOLD_KEY
            });
            if (snapshotRef.current) live.snapshot(snapshotRef.current);
            live.setCovered(coveredRef.current);
            liveRef.current = live;
        });
        return () => {
            disposed = true;
            live?.dispose();
            liveRef.current = null;
        };
        // One log per scene; words, cover and motion go through the setters below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, fixture]);

    useEffect(() => {
        liveRef.current?.setWords(wordsIn(), locale);
    }, [wordsIn, locale]);
    useEffect(() => {
        liveRef.current?.setCovered(covered);
    }, [covered]);
    useEffect(() => {
        liveRef.current?.setReducedMotion(reducedMotion);
    }, [reducedMotion]);

    // Development's feed: what a running tick would send, a beat at a time (never in production: the page only asks in development).
    useEffect(() => {
        if (!ready || !feed || process.env.NODE_ENV === "production") return;
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        void import("@/lib/ark-live-fixture").then(({ArkLiveFixtureFeed}) => {
            const start = snapshotRef.current;
            if (disposed || !start) return;
            const source = new ArkLiveFixtureFeed(start, {pool: growFrom?.animals ?? null});
            const run = () => {
                if (disposed) return;
                if (document.visibilityState === "visible") {
                    const step = source.next(new Date(), snapshotRef.current ?? undefined);
                    if (step) {
                        liveRef.current?.events(step.events);
                        snapshotRef.current = step.snapshot;
                        setSnapshot(step.snapshot);
                        sceneRef.current?.update(step.snapshot);
                        liveRef.current?.snapshot(step.snapshot);
                    }
                }
                timer = setTimeout(run, FEED_MS);
            };
            timer = setTimeout(run, FEED_FIRST_MS);
        });
        return () => {
            disposed = true;
            if (timer) clearTimeout(timer);
        };
        // The feed starts once, from the snapshot the world opened on.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, feed]);

    const observe = useCallback((next: ArkSnapshot) => {
        liveRef.current?.snapshot(next);
    }, []);

    return {hostRef, observe};
}
