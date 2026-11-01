/**
 * Runs work once the browser is idle, after at least `delayMs`, so warming
 * what the reader will most likely open next never competes with what they
 * are looking at now. Returns a cancel.
 */
export function onIdle(work: () => void, delayMs = 1500): () => void {
    if (typeof window === "undefined") return () => undefined;
    let idleId: number | null = null;
    const timer = window.setTimeout(() => {
        const ric = (window as Window & {requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number}).requestIdleCallback;
        if (typeof ric === "function") idleId = ric(work, {timeout: 2000});
        else work();
    }, delayMs);
    return () => {
        window.clearTimeout(timer);
        const cic = (window as Window & {cancelIdleCallback?: (id: number) => void}).cancelIdleCallback;
        if (idleId !== null && typeof cic === "function") cic(idleId);
    };
}
