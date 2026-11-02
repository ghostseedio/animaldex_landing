"use client";

/**
 * The thread store, for a list that names threads (the Talk sidebar, the
 * Companions roster): the same object back while no message has landed or
 * gone (`talkThreadsDigest`), so a reply typing out elsewhere does not draw
 * the list again on every step.
 */

import {useRef, useSyncExternalStore} from "react";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {talkThreadsDigest} from "@/lib/ask-animaldex/talk";
import type {AskThreads} from "@/lib/ask-animaldex/thread";

const NO_THREADS: AskThreads = {};

export function useTalkThreads(): AskThreads {
    const last = useRef<{digest: string; threads: AskThreads} | null>(null);
    return useSyncExternalStore(
        askSessionStore.subscribe,
        () => {
            const threads = askSessionStore.all();
            const digest = talkThreadsDigest(threads);
            if (last.current && last.current.digest === digest) return last.current.threads;
            last.current = {digest, threads};
            return threads;
        },
        () => NO_THREADS
    );
}
