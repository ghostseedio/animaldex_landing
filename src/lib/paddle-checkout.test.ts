import assert from "node:assert/strict";
import test from "node:test";
import {assertPaddleBrowserCheckout} from "./paddle-checkout";

test("browser checkout rejects sandbox tokens in production and live tokens in sandbox", () => {
    assert.equal(assertPaddleBrowserCheckout("production", "live_exampletokenexampletokenex", "pri_25"), null);
    assert.match(assertPaddleBrowserCheckout("production", "test_example", "pri_25") ?? "", /live/);
    assert.match(assertPaddleBrowserCheckout("sandbox", "live_exampletokenexampletokenex", "pri_25") ?? "", /sandbox/);
    assert.match(assertPaddleBrowserCheckout("production", "live_exampletokenexampletokenex", "price_25") ?? "", /Price ID/);
});
