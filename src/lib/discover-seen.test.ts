import assert from "node:assert/strict";
import test from "node:test";
import {
    DISCOVER_SEEN_FLUSH_BATCH_SIZE,
    type DiscoverSeenPost,
    type DiscoverSeenStorage,
    DiscoverSeenOutbox,
    discoverSeenPostForItemId,
    isDiscoverSeenPost,
    itemIdsScrolledPast
} from "@/lib/discover-seen";

const USER = "138bd2bc-af58-4e51-ac92-3df6161d53db";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const capture = (n: number): DiscoverSeenPost => ({type: "capture", id: uuid(n)});

function memoryStorage(): DiscoverSeenStorage & {data: Map<string, string>} {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key)
    };
}

test("each timeline item id maps to the ledger type and the bare id", () => {
    assert.deepEqual(discoverSeenPostForItemId(`capture-${uuid(1)}`), {type: "capture", id: uuid(1)});
    assert.deepEqual(discoverSeenPostForItemId(`alignment-${uuid(2)}`), {type: "alignment", id: uuid(2)});
    assert.deepEqual(discoverSeenPostForItemId(`fusion-${uuid(3)}`), {type: "principle_fusion", id: uuid(3)});
    assert.deepEqual(discoverSeenPostForItemId(`challenge-${uuid(4)}`), {type: "challenge", id: uuid(4)});
    assert.deepEqual(discoverSeenPostForItemId(`trade-${uuid(5)}`), {type: "trade", id: uuid(5)});
    assert.deepEqual(discoverSeenPostForItemId(`animal-trial-${uuid(6)}`), {type: "animal_trial", id: uuid(6)});
});

test("an item that cannot be named exactly is never marked", () => {
    assert.equal(discoverSeenPostForItemId("capture-not-a-uuid"), null);
    assert.equal(discoverSeenPostForItemId(`story-${uuid(1)}`), null);
    assert.equal(discoverSeenPostForItemId(`${uuid(1)}`), null);
    assert.equal(discoverSeenPostForItemId(`capture-${uuid(1)}:fallback`), null);
    assert.equal(discoverSeenPostForItemId(null), null);
    assert.equal(isDiscoverSeenPost({type: "story", id: uuid(1)}), false);
    assert.equal(isDiscoverSeenPost({type: "capture", id: "1"}), false);
});

test("only the rows above the leading one were scrolled past", () => {
    const ids = ["a", "b", "c", "d"];
    assert.deepEqual(itemIdsScrolledPast(ids, "c"), ["a", "b"]);
    assert.deepEqual(itemIdsScrolledPast(ids, "a"), []);
});

test("a leading row that is no longer in the feed marks nothing", () => {
    assert.deepEqual(itemIdsScrolledPast(["a", "b"], "ghost"), []);
    assert.deepEqual(itemIdsScrolledPast(["a", "b"], null), []);
});

test("a mark is in storage before anything is sent", async () => {
    const storage = memoryStorage();
    let storedAtSend = "";
    const outbox = new DiscoverSeenOutbox(USER, storage, async () => {
        storedAtSend = Array.from(storage.data.values()).join("");
        return true;
    });
    outbox.enqueue([capture(1)]);
    assert.match(Array.from(storage.data.values()).join(""), new RegExp(uuid(1)));
    await outbox.flush();
    assert.match(storedAtSend, new RegExp(uuid(1)));
    assert.equal(outbox.pendingCount, 0);
    assert.equal(storage.data.size, 0, "an empty queue leaves nothing behind");
});

test("a failed send keeps the batch, and the next visit sends it", async () => {
    const storage = memoryStorage();
    const offline = new DiscoverSeenOutbox(USER, storage, async () => false);
    offline.enqueue([capture(1), capture(2)]);
    await offline.flush();
    assert.equal(offline.pendingCount, 2);

    const sent: DiscoverSeenPost[] = [];
    const nextVisit = new DiscoverSeenOutbox(USER, storage, async (posts) => {
        sent.push(...posts);
        return true;
    });
    assert.equal(nextVisit.pendingCount, 2);
    assert.equal(nextVisit.has(capture(1)), true, "still counts as seen while it waits");
    await nextVisit.flush();
    assert.deepEqual(sent.map((post) => post.id), [uuid(1), uuid(2)]);
    assert.equal(nextVisit.pendingCount, 0);
});

test("a thrown send is a failed send", async () => {
    const outbox = new DiscoverSeenOutbox(USER, memoryStorage(), async () => {
        throw new Error("network");
    });
    outbox.enqueue([capture(1)]);
    await outbox.flush();
    assert.equal(outbox.pendingCount, 1);
});

test("nothing is queued twice, even after it was sent", async () => {
    let calls = 0;
    const outbox = new DiscoverSeenOutbox(USER, memoryStorage(), async () => {
        calls += 1;
        return true;
    });
    assert.equal(outbox.enqueue([capture(1), capture(1)]), 1);
    await outbox.flush();
    assert.equal(outbox.enqueue([capture(1), {type: "capture", id: uuid(1).toUpperCase()}]), 0);
    await outbox.flush();
    assert.equal(calls, 1);
});

test("sends oldest first in batches and stops at the first failure", async () => {
    const batches: number[] = [];
    const outbox = new DiscoverSeenOutbox(USER, memoryStorage(), async (posts) => {
        batches.push(posts.length);
        return batches.length < 2;
    });
    outbox.enqueue(Array.from({length: DISCOVER_SEEN_FLUSH_BATCH_SIZE * 2 + 10}, (_, index) => capture(index + 1)));
    await outbox.flush();
    assert.deepEqual(batches, [DISCOVER_SEEN_FLUSH_BATCH_SIZE, DISCOVER_SEEN_FLUSH_BATCH_SIZE]);
    assert.equal(outbox.pendingCount, DISCOVER_SEEN_FLUSH_BATCH_SIZE + 10);
});

test("a mark queued while a flush is running is sent by the follow-up flush", async () => {
    const sent: string[] = [];
    let release: (() => void) | null = null;
    const outbox = new DiscoverSeenOutbox(USER, memoryStorage(), async (posts) => {
        if (!sent.length) await new Promise<void>((resolve) => { release = resolve; });
        sent.push(...posts.map((post) => post.id));
        return true;
    });
    outbox.enqueue([capture(1)]);
    const first = outbox.flush();
    outbox.enqueue([capture(2)]);
    await outbox.flush();
    release!();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(sent, [uuid(1), uuid(2)]);
    assert.equal(outbox.pendingCount, 0);
});

test("one reader's queue is never read as another's", () => {
    const storage = memoryStorage();
    new DiscoverSeenOutbox(USER, storage, async () => false).enqueue([capture(1)]);
    const other = new DiscoverSeenOutbox(uuid(999), storage, async () => true);
    assert.equal(other.pendingCount, 0);
    assert.equal(other.has(capture(1)), false);
});

test("stale and malformed stored entries are dropped on read", () => {
    const storage = memoryStorage();
    const now = Date.parse("2026-09-28T12:00:00Z");
    const day = 1000 * 60 * 60 * 24;
    storage.setItem(`animaldex:discover-seen-outbox:${USER}`, JSON.stringify([
        {type: "capture", id: uuid(1), queuedAt: now - day * 31},
        {type: "capture", id: uuid(2), queuedAt: now - day},
        {type: "story", id: uuid(3), queuedAt: now},
        {type: "capture", id: "nope", queuedAt: now},
        "garbage"
    ]));
    const outbox = new DiscoverSeenOutbox(USER, storage, async () => true, () => now);
    assert.equal(outbox.pendingCount, 1);
    assert.equal(outbox.has(capture(2)), true);
});

test("unreadable storage is an empty queue, not a crash", () => {
    const storage = memoryStorage();
    storage.setItem(`animaldex:discover-seen-outbox:${USER}`, "{not json");
    const broken: DiscoverSeenStorage = {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("blocked"); },
        removeItem: () => { throw new Error("blocked"); }
    };
    assert.equal(new DiscoverSeenOutbox(USER, storage, async () => true).pendingCount, 0);
    const outbox = new DiscoverSeenOutbox(USER, broken, async () => true);
    assert.equal(outbox.enqueue([capture(1)]), 1);
});
