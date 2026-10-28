import assert from "node:assert/strict";
import test from "node:test";
import {assertPaddleBrowserCheckout, paddleCheckoutLocale} from "./paddle-checkout";

test("browser checkout rejects sandbox tokens in production and live tokens in sandbox", () => {
    assert.equal(assertPaddleBrowserCheckout("production", "live_exampletokenexampletokenex", "pri_25"), null);
    assert.match(assertPaddleBrowserCheckout("production", "test_example", "pri_25") ?? "", /live/);
    assert.match(assertPaddleBrowserCheckout("sandbox", "live_exampletokenexampletokenex", "pri_25") ?? "", /sandbox/);
    assert.match(assertPaddleBrowserCheckout("production", "live_exampletokenexampletokenex", "price_25") ?? "", /Price ID/);
});

test("the overlay opens in the page's language when Paddle has it, else English", () => {
    assert.equal(paddleCheckoutLocale("en"), "en");
    assert.equal(paddleCheckoutLocale("id"), "en");
    assert.equal(paddleCheckoutLocale("de-AT"), "de");
    assert.equal(paddleCheckoutLocale("pt-br"), "pt-BR");
    assert.equal(paddleCheckoutLocale("pt_PT"), "pt");
    assert.equal(paddleCheckoutLocale("zh-HK"), "zh-TW");
    assert.equal(paddleCheckoutLocale("zh-CN"), "zh-Hans");
    assert.equal(paddleCheckoutLocale("nb"), "no");
    assert.equal(paddleCheckoutLocale(undefined), "en");
});
