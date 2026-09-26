"use client";

/**
 * One thread store for the whole tab.
 *
 * The web counterpart of `AnimalPowerAskSessionStore.shared`. It is a singleton
 * rather than component state for the same reason iOS made it one: the drawer is
 * unmounted every time it closes, and a thread that lived in its state would be
 * thrown away with it. Writes are coalesced before they reach storage, because a
 * streaming answer updates many times a second and none of those states are
 * persistable.
 */

import {
    loadAskThreads,
    saveAskThreads,
    type AskMessage,
    type AskThreads
} from "@/lib/ask-animaldex/thread";

type Listener = () => void;

let threads: AskThreads | null = null;
const listeners = new Set<Listener>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function storage() {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function ensureLoaded(): AskThreads {
    if (threads === null) {
        threads = loadAskThreads(storage());
    }
    return threads;
}

/**
 * Coalesces the writes one turn produces — append question, append placeholder,
 * replace placeholder — into a single storage write.
 */
function schedulePersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveAskThreads(storage(), threads ?? {});
    }, 400);
}

function emit() {
    listeners.forEach((listener) => listener());
}

export const askSessionStore = {
    subscribe(listener: Listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },

    messages(key: string): AskMessage[] {
        return ensureLoaded()[key] ?? EMPTY;
    },

    replace(key: string, messages: AskMessage[]) {
        const current = ensureLoaded();
        threads = {...current, [key]: messages};
        emit();
        // Nothing to write until the answer lands.
        if (messages[messages.length - 1]?.status === "streaming") return;
        schedulePersist();
    },

    clear(key: string) {
        const current = ensureLoaded();
        const next = {...current};
        delete next[key];
        threads = next;
        emit();
        schedulePersist();
    },

    /** Snapshot for `useSyncExternalStore`, which needs a stable reference. */
    snapshot(key: string) {
        return this.messages(key);
    }
};

const EMPTY: AskMessage[] = [];
