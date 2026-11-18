/**
 * "Aboard the Ark" on a Discover capture post (board item, 2026-11-18): a chip that says the post's animal is on the
 * Ark right now, and opens the Ark on it. One public, batched read answers for a page of posts
 * (`voyage_capture_aboard_v1`, migration 20261201150000): `{capture id: Ark animal id}` for the captures whose animal
 * is aboard and alive, and only under the Ark capture photo's public-capture gate, so a private, hidden, reported or
 * unnamed post is simply absent and never says why. The answer carries the Ark animal's id and nothing else (no user,
 * place or state).
 *
 * Nothing waits or spins: a post draws no chip until the server has said it is aboard, and a tap opens the Ark on the
 * animal and follows it (`/ark?focus=<id>&follow=1`, the link "See it in the Ark" uses). A server without the read, or
 * a failed read, draws no chip; the next time the post is on screen it asks again. iOS `ArkAboardChip.swift`.
 */

export const ARK_ABOARD_MAX_BATCH = 50;
/** The server takes at most this many ids per call. */
export const ARK_ABOARD_SERVER_MAX = 100;
export const ARK_ABOARD_DEBOUNCE_MS = 150;
/** An answer, yes or no, is trusted this long (an animal can die). */
export const ARK_ABOARD_FRESH_MS = 600_000;
export const ARK_ABOARD_BACKOFF_MS = 20_000;
export const ARK_ABOARD_MAX_BACKOFF_MS = 300_000;
/** The whole table is dropped when it grows past this (a very long session). */
export const ARK_ABOARD_MAX_ENTRIES = 3_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isArkAboardId(value: unknown): value is string {
    return typeof value === "string" && UUID.test(value.toLowerCase());
}

/** The answer, `{"<capture id>": "<animal id>"}`, kept to the captures that were asked about and to ids. */
export function decodeArkAboard(raw: unknown, asked: readonly string[]): Record<string, string> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const wanted = new Set(asked.map((id) => id.toLowerCase()));
    const answer: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const capture = key.toLowerCase();
        if (!wanted.has(capture) || !isArkAboardId(capture) || !isArkAboardId(value)) continue;
        answer[capture] = (value as string).toLowerCase();
    }
    return answer;
}

/** What a tap opens: the animal by its id, followed (never the first-boarding scene of a person's own animal). */
export function arkAboardHref(animalId: string): string {
    return `/ark?focus=${encodeURIComponent(animalId.toLowerCase())}&follow=1`;
}

export type ArkAboardStore = {
    /** The Ark animal this capture brought, when the server has said it is aboard now. */
    get(captureId: string): string | null;
    /** Ask about a capture (batched with the others asked within a moment). */
    request(captureId: string): void;
    subscribe(listener: () => void): () => void;
    /** Sends what is waiting now (the debounce calls this; the tests too). */
    flush(): Promise<void>;
};

type StoreOptions = {
    /** One call for these ids: the answer, or null when it failed (a server without the read answers `{}`). */
    fetchBatch: (ids: string[]) => Promise<Record<string, string> | null>;
    now?: () => number;
    /** Schedules the debounced flush; the tests run it by hand. */
    setTimer?: (run: () => void, ms: number) => unknown;
};

/**
 * Which captures are aboard, asked a page at a time. A card asks when it comes on screen; asks made within a moment of
 * each other go as one call (at most ARK_ABOARD_MAX_BATCH ids), a capture is not asked again while its answer is fresh,
 * and a failed call is not retried for a while. Only the captures that were asked can be answered.
 */
export function createArkAboardStore(options: StoreOptions): ArkAboardStore {
    const now = options.now ?? (() => Date.now());
    const setTimer = options.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
    let aboard = new Map<string, string>();
    const answeredAt = new Map<string, number>();
    const pending: string[] = [];
    const pendingSet = new Set<string>();
    const inFlight = new Set<string>();
    const listeners = new Set<() => void>();
    let scheduled = false;
    let failures = 0;
    let retryAfter = 0;
    let running: Promise<void> | null = null;

    function emit() {
        for (const listener of listeners) listener();
    }

    async function drain(): Promise<void> {
        if (now() < retryAfter) return;
        while (pending.length) {
            const batch = pending.splice(0, ARK_ABOARD_MAX_BATCH);
            for (const id of batch) {
                pendingSet.delete(id);
                inFlight.add(id);
            }
            let found: Record<string, string> | null;
            try {
                found = await options.fetchBatch(batch);
            } catch {
                found = null;
            }
            for (const id of batch) inFlight.delete(id);
            if (found === null) {
                failures += 1;
                retryAfter = now() + Math.min(ARK_ABOARD_BACKOFF_MS * failures, ARK_ABOARD_MAX_BACKOFF_MS);
                // Nothing was learned: what is left waits for the next request after the backoff.
                return;
            }
            failures = 0;
            const at = now();
            if (answeredAt.size + batch.length > ARK_ABOARD_MAX_ENTRIES) {
                answeredAt.clear();
                aboard = new Map();
            }
            let changed = false;
            const asked = decodeArkAboard(found, batch);
            for (const id of batch) {
                answeredAt.set(id, at);
                const animal = asked[id];
                if (animal) {
                    if (aboard.get(id) !== animal) changed = true;
                    aboard.set(id, animal);
                } else if (aboard.delete(id)) {
                    changed = true;
                }
            }
            if (changed) emit();
        }
    }

    function flush(): Promise<void> {
        scheduled = false;
        running = (running ?? Promise.resolve()).then(drain);
        return running;
    }

    return {
        get(captureId) {
            return aboard.get(captureId.toLowerCase()) ?? null;
        },
        request(captureId) {
            const id = captureId.toLowerCase();
            if (!isArkAboardId(id)) return;
            const answered = answeredAt.get(id);
            if (answered !== undefined && now() - answered < ARK_ABOARD_FRESH_MS) return;
            if (inFlight.has(id)) return;
            if (!pendingSet.has(id)) {
                pendingSet.add(id);
                pending.push(id);
            }
            if (scheduled) return;
            scheduled = true;
            setTimer(() => void flush(), ARK_ABOARD_DEBOUNCE_MS);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        flush
    };
}
