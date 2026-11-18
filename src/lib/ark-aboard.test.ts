import {test} from "node:test";
import assert from "node:assert/strict";
import {
    ARK_ABOARD_BACKOFF_MS,
    ARK_ABOARD_FRESH_MS,
    ARK_ABOARD_MAX_BATCH,
    arkAboardHref,
    createArkAboardStore,
    decodeArkAboard,
    isArkAboardId
} from "@/lib/ark-aboard";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const WOLF = "5b0f2a9e-0f6e-4c1a-9a43-3a2d4f1b7c11";

test("link: the Ark opens on the animal by its id and follows it, never the arrival scene", () => {
    assert.equal(arkAboardHref(WOLF.toUpperCase()), `/ark?focus=${WOLF}&follow=1`);
    assert.ok(!arkAboardHref(WOLF).includes("arrival"));
});

test("answer: only asked captures with id values", () => {
    const answer = decodeArkAboard({[id(1)]: WOLF, [id(2)]: "not an id", [id(3)]: WOLF, garbage: WOLF}, [id(1), id(2)]);
    assert.deepEqual(answer, {[id(1)]: WOLF});
    for (const nothing of [[], null, undefined, "nonsense", 7, {}]) assert.deepEqual(decodeArkAboard(nothing, [id(1)]), {});
    assert.ok(isArkAboardId(WOLF) && !isArkAboardId("wolf") && !isArkAboardId(null));
});

function harness(options: {answer?: (ids: string[]) => Record<string, string> | null} = {}) {
    let time = 1_800_000_000_000;
    const calls: string[][] = [];
    const timers: Array<() => void> = [];
    let answer = options.answer ?? (() => ({}));
    const store = createArkAboardStore({
        fetchBatch: async (ids) => {
            calls.push(ids);
            return answer(ids);
        },
        now: () => time,
        setTimer: (run) => {
            timers.push(run);
            return timers.length;
        }
    });
    return {
        store,
        calls,
        timers,
        advance: (ms: number) => { time += ms; },
        setAnswer: (next: typeof answer) => { answer = next; }
    };
}

test("asks within a moment go as batches of at most fifty, from one timer", async () => {
    const h = harness();
    const ids = Array.from({length: 120}, (_, n) => id(n + 1));
    for (const captureId of ids) h.store.request(captureId);
    assert.equal(h.timers.length, 1, "one debounce for the whole page");
    await h.store.flush();
    assert.deepEqual(h.calls.map((call) => call.length), [ARK_ABOARD_MAX_BATCH, ARK_ABOARD_MAX_BATCH, 20]);
    assert.deepEqual(new Set(h.calls.flat()), new Set(ids), "every capture asked about exactly once");
    assert.equal(h.calls.flat().length, 120);
});

test("only aboard captures get a chip, the rest are remembered as no, and nothing unasked is believed", async () => {
    const h = harness({answer: () => ({[id(1)]: WOLF, [id(9)]: WOLF})});
    let notified = 0;
    h.store.subscribe(() => { notified += 1; });
    h.store.request(id(1));
    h.store.request(id(2));
    await h.store.flush();
    assert.equal(h.store.get(id(1)), WOLF);
    assert.equal(h.store.get(id(2)), null);
    assert.equal(h.store.get(id(9)), null, "a capture that was not asked about cannot be answered");
    assert.equal(notified, 1);
    // Neither is asked again while its answer is fresh.
    h.store.request(id(1));
    h.store.request(id(2));
    await h.store.flush();
    assert.equal(h.calls.length, 1);
});

test("an answer is asked again after it goes stale, so a dead animal loses its chip", async () => {
    const h = harness({answer: () => ({[id(1)]: WOLF})});
    h.store.request(id(1));
    await h.store.flush();
    assert.equal(h.store.get(id(1)), WOLF);
    h.advance(ARK_ABOARD_FRESH_MS + 1);
    h.setAnswer(() => ({}));
    h.store.request(id(1));
    await h.store.flush();
    assert.equal(h.calls.length, 2);
    assert.equal(h.store.get(id(1)), null);
});

test("a failed call draws nothing and backs off, then asks again", async () => {
    const h = harness({answer: () => null});
    h.store.request(id(1));
    await h.store.flush();
    assert.equal(h.calls.length, 1);
    assert.equal(h.store.get(id(1)), null);
    // Straight away: still backing off, nothing is sent.
    h.store.request(id(1));
    await h.store.flush();
    assert.equal(h.calls.length, 1);
    // After the backoff the same capture is asked again, and the chip appears.
    h.setAnswer(() => ({[id(1)]: WOLF}));
    h.advance(ARK_ABOARD_BACKOFF_MS + 1);
    h.store.request(id(1));
    await h.store.flush();
    assert.equal(h.calls.length, 2);
    assert.equal(h.store.get(id(1)), WOLF);
});

test("a throwing read is a failed read", async () => {
    let time = 0;
    const store = createArkAboardStore({
        fetchBatch: async () => { throw new Error("offline"); },
        now: () => time,
        setTimer: () => 1
    });
    store.request(id(1));
    await store.flush();
    assert.equal(store.get(id(1)), null);
    time += 1;
    store.request(id(1));
    await store.flush();
});

test("an id that is not a capture id is never asked", async () => {
    const h = harness();
    h.store.request("not-an-id");
    assert.equal(h.timers.length, 0);
    await h.store.flush();
    assert.equal(h.calls.length, 0);
});
