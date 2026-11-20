import assert from "node:assert/strict";
import test from "node:test";
import {createArkSharedRead} from "@/lib/ark-shared-read";

type R = {ok: boolean; n: number};

function harness() {
    let t = 1_000_000;
    let calls = 0;
    const shared = createArkSharedRead<R>({freshMs: 30_000, staleMs: 600_000, retryMs: 10_000, isGood: (r) => r.ok, now: () => t});
    const gate: Array<(r: R) => void> = [];
    const slow = () => {
        calls += 1;
        return new Promise<R>((resolve) => gate.push(resolve));
    };
    return {shared, slow, gate, advance: (ms: number) => (t += ms), calls: () => calls};
}

test("concurrent first readers share one database read", async () => {
    const h = harness();
    const all = Promise.all(Array.from({length: 20}, () => h.shared.read(h.slow)));
    assert.equal(h.calls(), 1);
    h.gate[0]({ok: true, n: 1});
    assert.deepEqual((await all).map((r) => r.n), Array(20).fill(1));
});

test("fresh answers come from memory; a stale one is answered at once and refreshed once behind", async () => {
    const h = harness();
    const first = h.shared.read(h.slow);
    h.gate[0]({ok: true, n: 1});
    await first;
    h.advance(29_000);
    assert.equal((await h.shared.read(h.slow)).n, 1);
    assert.equal(h.calls(), 1);
    h.advance(2_000);
    const stale = await Promise.all([h.shared.read(h.slow), h.shared.read(h.slow), h.shared.read(h.slow)]);
    assert.deepEqual(stale.map((r) => r.n), [1, 1, 1]);
    assert.equal(h.calls(), 2);
    h.gate[1]({ok: true, n: 2});
    await new Promise((r) => setImmediate(r));
    assert.equal((await h.shared.read(h.slow)).n, 2);
    assert.equal(h.calls(), 2);
});

test("a failed refresh keeps the last good answer and is not retried by every visitor", async () => {
    const h = harness();
    const first = h.shared.read(h.slow);
    h.gate[0]({ok: true, n: 1});
    await first;
    h.advance(31_000);
    assert.equal((await h.shared.read(h.slow)).n, 1);
    h.gate[1]({ok: false, n: 0});
    await new Promise((r) => setImmediate(r));
    for (let i = 0; i < 10; i++) assert.equal((await h.shared.read(h.slow)).n, 1);
    assert.equal(h.calls(), 2);
    h.advance(10_000);
    assert.equal((await h.shared.read(h.slow)).n, 1);
    assert.equal(h.calls(), 3);
    h.gate[2]({ok: true, n: 3});
});

test("a thrown read with nothing held reaches every waiting caller; an answer older than staleMs is not served", async () => {
    const h = harness();
    const shared = createArkSharedRead<R>({freshMs: 30_000, staleMs: 600_000, retryMs: 10_000, isGood: (r) => r.ok});
    let n = 0;
    const boom = async () => {
        n += 1;
        throw new Error("db down");
    };
    const results = await Promise.allSettled([shared.read(boom), shared.read(boom)]);
    assert.deepEqual(results.map((r) => r.status), ["rejected", "rejected"]);
    assert.equal(n, 1);
    const first = h.shared.read(h.slow);
    h.gate[0]({ok: true, n: 1});
    await first;
    h.advance(601_000);
    const late = h.shared.read(h.slow);
    assert.equal(h.calls(), 2);
    h.gate[1]({ok: true, n: 2});
    assert.equal((await late).n, 2);
});
