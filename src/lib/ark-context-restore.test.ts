import assert from "node:assert/strict";
import test from "node:test";
import {ARK_CONTEXT_RELOADS_KEY, arkMayReloadForContext} from "@/lib/ark-context-restore";

function memory(): {getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; data: Map<string, string>} {
    const data = new Map<string, string>();
    return {data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value)};
}

test("a restored context reloads the page, twice at most in three minutes", () => {
    const store = memory();
    const t0 = 1_800_000_000_000;
    assert.equal(arkMayReloadForContext(store, t0), true);
    assert.equal(arkMayReloadForContext(store, t0 + 20_000), true);
    // A third within the window: left as it is (no loop on a device that keeps losing the context).
    assert.equal(arkMayReloadForContext(store, t0 + 40_000), false);
    assert.equal(arkMayReloadForContext(store, t0 + 170_000), false);
    // Once the first has aged out, again.
    assert.equal(arkMayReloadForContext(store, t0 + 181_000), true);
    assert.equal(JSON.parse(store.data.get(ARK_CONTEXT_RELOADS_KEY) ?? "[]").length, 2);
});

test("no storage, or rubbish in it: the reload goes ahead", () => {
    assert.equal(arkMayReloadForContext(null, 5), true);
    const store = memory();
    store.setItem(ARK_CONTEXT_RELOADS_KEY, "{not json");
    assert.equal(arkMayReloadForContext(store, 5), true);
    store.setItem(ARK_CONTEXT_RELOADS_KEY, JSON.stringify(["x", 1e18, null]));
    assert.equal(arkMayReloadForContext(store, 5), true);
    const failing = {getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }};
    assert.equal(arkMayReloadForContext(failing, 5), true);
});
