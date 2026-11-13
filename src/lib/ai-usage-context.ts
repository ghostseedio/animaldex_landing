import {AsyncLocalStorage} from "node:async_hooks";

// Which job a paid AI call belongs to, carried across awaits. The usage logger
// (src/lib/ai-usage.ts) names a call's feature from the stack of the fetch,
// which works for a call made while a request handler is still on the stack
// (the compiled route frame is there) but not for the background jobs the
// server runs after the response has gone: a blog article being written, a
// page video, a share's copy, the trend radar. Their stacks hold only webpack
// chunks, and the ledger showed them as web:prod:unattributed (159 Opus calls
// in the month to 16 Nov 2026). Each job entry point now runs inside
// runWithAiFeature(<its name>), and the logger reads currentAiFeature() first.
// The store follows promise chains, so a fire-and-forget `void job()` started
// inside the scope keeps the name too.

const storage = new AsyncLocalStorage<string>();

/** Runs `fn` with every AI call inside it (and in the promises it starts) attributed to `feature`. */
export function runWithAiFeature<T>(feature: string, fn: () => T): T {
    return storage.run(feature, fn);
}

/** The feature of the job this call belongs to, or null outside one. */
export function currentAiFeature(): string | null {
    return storage.getStore() ?? null;
}
