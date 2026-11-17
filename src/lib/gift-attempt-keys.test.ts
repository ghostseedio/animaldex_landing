import assert from "node:assert/strict";
import {test} from "node:test";
import {GiftAttemptKeys} from "./gift-attempt-keys";

test("a gift attempt keeps one key across retries until the server confirms it", () => {
    let counter = 0;
    const keys = new GiftAttemptKeys(() => `key-${++counter}`);
    const first = keys.key("capture", "gift");
    assert.equal(keys.key("capture", "gift"), first);
    assert.equal(keys.key("capture", "gift"), first);
    keys.succeeded("capture", "gift");
    assert.notEqual(keys.key("capture", "gift"), first);
});

test("attempts are separate per capture and per Gift", () => {
    const keys = new GiftAttemptKeys();
    const a = keys.key("capture", "giftA");
    const b = keys.key("capture", "giftB");
    const c = keys.key("other", "giftA");
    assert.equal(new Set([a, b, c]).size, 3);
    keys.succeeded("capture", "giftB");
    assert.equal(keys.key("capture", "giftA"), a);
});
