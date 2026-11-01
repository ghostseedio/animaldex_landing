"use client";

/**
 * What each animal thread in this browser is about (its slug, its name, the
 * card it is on), kept beside the thread store so the Talk page's sidebar can
 * name a thread and open it (docs/rich-chat/SPEC.md, section 4.2). Written
 * by the conversation once it knows who it is talking to, in the drawer and
 * on the page alike; the threads themselves stay in `askSessionStore`.
 */

import {useSyncExternalStore} from "react";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {loadAskThreads} from "@/lib/ask-animaldex/thread";
import {normalizeTalkThreadMetas, type TalkThreadMeta, type TalkThreadMetas} from "@/lib/ask-animaldex/talk";

const STORAGE_KEY = "animaldex:ask:thread-meta-v1";
/** As many as the thread store keeps, and a few over. */
const MAX_ENTRIES = 40;

let metas: TalkThreadMetas | null = null;
const listeners = new Set<() => void>();
const EMPTY: TalkThreadMetas = {};

function storage() {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function load(): TalkThreadMetas {
    if (metas) return metas;
    try {
        const raw = storage()?.getItem(STORAGE_KEY);
        metas = raw ? normalizeTalkThreadMetas(JSON.parse(raw)) : {};
    } catch {
        metas = {};
    }
    return metas;
}

function save(next: TalkThreadMetas) {
    metas = next;
    listeners.forEach((listener) => listener());
    try {
        storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Private mode: the sidebar names threads from their slugs instead.
    }
}

/** Notes what a thread is about; unchanged entries write nothing. Older entries without a thread go first. */
export function rememberTalkThread(key: string, meta: TalkThreadMeta) {
    if (!/^(species|capture):/.test(key)) return;
    const current = load();
    const known = current[key];
    if (known && known.slug === meta.slug && known.name === meta.name && known.captureId === meta.captureId && known.nickname === meta.nickname) return;
    let next: TalkThreadMetas = {...current, [key]: meta};
    const keys = Object.keys(next);
    if (keys.length > MAX_ENTRIES) {
        const threads = loadAskThreads(storage());
        next = Object.fromEntries(Object.entries(next).filter(([entry]) => entry === key || threads[entry] || askSessionStore.messages(entry).length > 0));
    }
    save(next);
}

export function forgetTalkThread(key: string) {
    const current = load();
    if (!current[key]) return;
    const next = {...current};
    delete next[key];
    save(next);
}

export function useTalkThreadMetas(): TalkThreadMetas {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        load,
        () => EMPTY
    );
}

/** Every thread's note gone, with the threads ("Delete chat history"). */
export function forgetAllTalkThreads() {
    save({});
}
