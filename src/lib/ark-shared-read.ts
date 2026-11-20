/**
 * One read shared by every anonymous visitor of the Ark (`data/ark-voyage.ts`): the public snapshot is the same for
 * all of them (~4.7 MB of JSON from `voyage_public_v2` on 2026-11-20), and Cloudflare does not cache `/api/*`
 * (`cf-cache-status: DYNAMIC`), so without this every page render and every 45-second poll was its own database read.
 *
 * - Fresh for `freshMs`: answered from memory, no read.
 * - Older: one read at a time (single flight); a caller arriving while it runs waits for it, unless a good answer
 *   younger than `staleMs` is held, which it gets at once (stale while revalidating).
 * - A failed read (thrown, or `isGood` false) keeps the last good answer for up to `staleMs` and is not retried
 *   for `retryMs`, so a struggling database is not asked again by every visitor. With nothing good held the
 *   failure itself is the answer (as before).
 */
export type ArkSharedRead<T> = {
    read: (load: () => Promise<T>) => Promise<T>;
    /** Tests: forget everything. */
    reset: () => void;
};

export function createArkSharedRead<T>(options: {freshMs: number; staleMs: number; retryMs: number; isGood: (value: T) => boolean; now?: () => number}): ArkSharedRead<T> {
    const now = options.now ?? Date.now;
    let good: {value: T; at: number} | null = null;
    let pending: Promise<T> | null = null;
    let retryAt = 0;

    const start = (load: () => Promise<T>): Promise<T> => {
        const run = (async () => {
            try {
                const value = await load();
                if (options.isGood(value)) {
                    good = {value, at: now()};
                    retryAt = 0;
                    return value;
                }
                retryAt = now() + options.retryMs;
                return value;
            } catch (error) {
                retryAt = now() + options.retryMs;
                throw error;
            }
        })();
        pending = run.finally(() => {
            pending = null;
        });
        return pending;
    };

    const read = async (load: () => Promise<T>): Promise<T> => {
        const t = now();
        const held = good && t - good.at < options.staleMs ? good : null;
        if (held && t - held.at < options.freshMs) return held.value;
        if (held) {
            // Stale but usable: answer now, refresh behind (once, and not while backing off after a failure).
            if (!pending && t >= retryAt) start(load).catch(() => undefined);
            return held.value;
        }
        // Nothing usable held: share the read in flight (its failure is this caller's too), else start one.
        return pending ?? start(load);
    };

    return {
        read,
        reset: () => {
            good = null;
            pending = null;
            retryAt = 0;
        },
    };
}
