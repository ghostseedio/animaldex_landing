/**
 * A lost WebGL context, back (the lighting lane, 2026-11-14).
 *
 * A browser takes the GPU's context away when its GPU process restarts or the page has been long in the background
 * (an app's panel behind other things, a phone short of memory), and hands a new, empty one back. three re-uploads
 * what it still holds, but the Ark's scene cannot go on from that: the pictures the sky's light is made from are gone
 * (the world turns dark with hard black shadows), and so is every buffer whose copy was let go once it was on the GPU
 * (the town's trees and foliage stop drawing). The scene tells its page (`ArkSceneOptions.onContextRestored`), and the
 * page starts over: the site's /ark and the apps' panel reload, as they would have been reloaded had the browser
 * dropped the whole page instead.
 *
 * Twice at most in three minutes: a device that keeps losing the context is left as it is rather than reloaded in a loop.
 */

export const ARK_CONTEXT_RELOADS_KEY = "animaldex:ark:context-reloads";
const WINDOW_MS = 3 * 60_000;
const MOST = 2;

type Store = Pick<Storage, "getItem" | "setItem">;

/** Whether the page may reload now for a restored context; notes the reload when it may. Pure but for `store`. */
export function arkMayReloadForContext(store: Store | null, now: number): boolean {
    let times: number[] = [];
    try {
        const raw = store?.getItem(ARK_CONTEXT_RELOADS_KEY);
        const read: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(read)) times = read.filter((t): t is number => typeof t === "number" && now - t < WINDOW_MS && t <= now);
    } catch {
        times = [];
    }
    if (times.length >= MOST) return false;
    try {
        store?.setItem(ARK_CONTEXT_RELOADS_KEY, JSON.stringify([...times, now]));
    } catch {
        // (No storage: this page's one reload still goes ahead; a loop is stopped by the page's own flag below.)
    }
    return true;
}

let reloading = false;

/** The page's answer to `onContextRestored`: reload, unless it has just done so twice. */
export function arkReloadForRestoredContext(): boolean {
    if (reloading || typeof window === "undefined") return false;
    let store: Store | null = null;
    try {
        store = window.sessionStorage;
    } catch {
        store = null;
    }
    if (!arkMayReloadForContext(store, Date.now())) return false;
    reloading = true;
    window.location.reload();
    return true;
}
