/**
 * Discover "seen" tracking, ported from the iOS source of truth
 * (`DiscoverSeenOutbox`, `DiscoverVisibleWindow` and the marking in
 * `DiscoverActivityFeedView`).
 *
 * Once a signed-in reader has scrolled past a Discover post, that post must
 * never be served to them again — on this device or any other. The server
 * excludes what the ledger holds; this module decides what goes INTO the
 * ledger, and makes sure a mark that failed to send is not lost.
 *
 * The ledger is shared with the phone, so a wrong mark here hides a post there.
 * Everything below errs toward marking too little.
 */

/** The card types `mark_discover_timeline_seen` accepts. */
export type DiscoverSeenPostType = "capture" | "challenge" | "trade" | "alignment" | "principle_fusion" | "animal_trial";

export type DiscoverSeenPost = {
    type: DiscoverSeenPostType;
    id: string;
};

export const DISCOVER_SEEN_POST_TYPES: DiscoverSeenPostType[] = [
    "capture", "challenge", "trade", "alignment", "principle_fusion", "animal_trial"
];

/** How long a post has to be the leading one before it counts as seen. */
export const LEADING_POST_SEEN_DWELL_MS = 900;
/** Mirrors `discoverSeenFlushBatchSize` on iOS. */
export const DISCOVER_SEEN_FLUSH_BATCH_SIZE = 250;
const MAX_OUTBOX_ENTRIES = 4000;
const MAX_OUTBOX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Timeline item ids are `<prefix>-<uuid>`; the ledger wants the type and the bare id. */
const ITEM_ID_PREFIXES: Array<[string, DiscoverSeenPostType]> = [
    ["capture-", "capture"],
    ["alignment-", "alignment"],
    ["fusion-", "principle_fusion"],
    ["challenge-", "challenge"],
    ["trade-", "trade"],
    // The ledger id is the view's `post_id`, so the mark hides the same card
    // the phone would hide.
    ["animal-trial-", "animal_trial"]
];

/**
 * The ledger entry for one timeline item, or null when the item has no
 * well-formed id. An item that cannot be named exactly is never marked.
 */
export function discoverSeenPostForItemId(itemId: string | null | undefined): DiscoverSeenPost | null {
    if (!itemId) return null;
    for (const [prefix, type] of ITEM_ID_PREFIXES) {
        if (!itemId.startsWith(prefix)) continue;
        const id = itemId.slice(prefix.length).toLowerCase();
        return UUID_PATTERN.test(id) ? {type, id} : null;
    }
    return null;
}

export function isDiscoverSeenPost(value: unknown): value is DiscoverSeenPost {
    const post = value as DiscoverSeenPost | null;
    return Boolean(
        post
        && typeof post === "object"
        && (DISCOVER_SEEN_POST_TYPES as string[]).includes(post.type)
        && typeof post.id === "string"
        && UUID_PATTERN.test(post.id)
    );
}

export function discoverSeenKey(post: DiscoverSeenPost) {
    return `${post.type}:${post.id.toLowerCase()}`;
}

/**
 * Every item above the leading one: they were scrolled past to get here.
 *
 * Returns nothing when the leading item is not in the list. A post that is no
 * longer in the feed must never be treated as a position — on iOS a ghost row
 * at the top made everything beneath it look scrolled past.
 */
export function itemIdsScrolledPast(orderedItemIds: string[], leadingItemId: string | null | undefined) {
    if (!leadingItemId) return [];
    const leadingIndex = orderedItemIds.indexOf(leadingItemId);
    return leadingIndex > 0 ? orderedItemIds.slice(0, leadingIndex) : [];
}

// MARK: - Outbox

type OutboxEntry = DiscoverSeenPost & {queuedAt: number};

export type DiscoverSeenStorage = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
};

/** Resolves true when the batch landed. Anything else keeps the batch queued. */
export type DiscoverSeenSender = (posts: DiscoverSeenPost[], options: {keepalive: boolean}) => Promise<boolean>;

/**
 * A durable queue of marks, per reader.
 *
 * QUEUED BEFORE SENT. A mark exists in storage before any request is made, so
 * closing the tab mid-request loses nothing: the next visit sends it. The
 * server call is idempotent, so sending something twice is harmless and
 * sending it never is the failure worth designing against.
 *
 * Oldest first, stopping at the first failure — a failed batch is almost always
 * the network, and the batches behind it would fail the same way.
 */
export class DiscoverSeenOutbox {
    private entries: OutboxEntry[];
    /** Everything marked this session, sent or not, so nothing is queued twice. */
    private readonly known = new Set<string>();
    private isFlushing = false;
    private needsAnotherFlush = false;

    constructor(
        private readonly userId: string,
        private readonly storage: DiscoverSeenStorage | null,
        private readonly send: DiscoverSeenSender,
        private readonly now: () => number = Date.now
    ) {
        this.entries = this.read();
        for (const entry of this.entries) this.known.add(discoverSeenKey(entry));
    }

    private get storageKey() {
        return `animaldex:discover-seen-outbox:${this.userId.toLowerCase()}`;
    }

    private read(): OutboxEntry[] {
        try {
            const raw = this.storage?.getItem(this.storageKey);
            const parsed: unknown = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            const cutoff = this.now() - MAX_OUTBOX_AGE_MS;
            return parsed
                .filter((entry): entry is OutboxEntry =>
                    isDiscoverSeenPost(entry) && typeof (entry as OutboxEntry).queuedAt === "number")
                .filter((entry) => entry.queuedAt >= cutoff)
                .map((entry) => ({type: entry.type, id: entry.id.toLowerCase(), queuedAt: entry.queuedAt}))
                .slice(-MAX_OUTBOX_ENTRIES);
        } catch {
            return [];
        }
    }

    private write() {
        try {
            if (this.entries.length) this.storage?.setItem(this.storageKey, JSON.stringify(this.entries));
            else this.storage?.removeItem(this.storageKey);
        } catch {
            // Storage full or blocked: the marks still live in memory for this
            // visit, which is no worse than having no outbox at all.
        }
    }

    get pendingCount() {
        return this.entries.length;
    }

    /** True for anything marked this session or still waiting from an earlier one. */
    has(post: DiscoverSeenPost) {
        return this.known.has(discoverSeenKey(post));
    }

    /** Queues what is new and returns how many that was. */
    enqueue(posts: DiscoverSeenPost[]) {
        let queued = 0;
        for (const post of posts) {
            if (!isDiscoverSeenPost(post)) continue;
            const key = discoverSeenKey(post);
            if (this.known.has(key)) continue;
            this.known.add(key);
            this.entries.push({type: post.type, id: post.id.toLowerCase(), queuedAt: this.now()});
            queued += 1;
        }
        if (queued) {
            if (this.entries.length > MAX_OUTBOX_ENTRIES) this.entries = this.entries.slice(-MAX_OUTBOX_ENTRIES);
            this.write();
        }
        return queued;
    }

    /**
     * Sends what is queued. Single-flight: a flush requested while one is
     * running is remembered and runs once the first finishes, so a mark queued
     * mid-flush is never stranded until the next scroll.
     */
    async flush(options: {keepalive?: boolean} = {}): Promise<void> {
        if (this.isFlushing) {
            this.needsAnotherFlush = true;
            return;
        }
        this.isFlushing = true;
        try {
            while (this.entries.length) {
                const batch = this.entries.slice(0, DISCOVER_SEEN_FLUSH_BATCH_SIZE);
                let landed = false;
                try {
                    landed = await this.send(
                        batch.map(({type, id}) => ({type, id})),
                        {keepalive: options.keepalive === true}
                    );
                } catch {
                    landed = false;
                }
                if (!landed) return;
                // Acknowledged only on success, and only the entries that were
                // sent: anything queued during the request stays.
                const sent = new Set(batch.map(discoverSeenKey));
                this.entries = this.entries.filter((entry) => !sent.has(discoverSeenKey(entry)));
                this.write();
            }
        } finally {
            this.isFlushing = false;
            if (this.needsAnotherFlush) {
                this.needsAnotherFlush = false;
                void this.flush(options);
            }
        }
    }
}
