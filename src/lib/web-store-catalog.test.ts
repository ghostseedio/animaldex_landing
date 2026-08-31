import assert from "node:assert/strict";
import test from "node:test";
import {
    billingStatusIsServerFulfilled,
    creditDeltaForProduct,
    recommendCreditPack,
    sanitizeBillingReturnPath,
    validateCheckoutRequestBody
} from "./web-store-catalog";

test("credit packs map to canonical amounts", () => {
    assert.equal(creditDeltaForProduct("purchase_25"), 25);
    assert.equal(creditDeltaForProduct("purchase_100"), 100);
    assert.equal(creditDeltaForProduct("pro_upgrade"), 0);
});

test("recommended pack is catalog-based, not dynamic pricing", () => {
    assert.equal(recommendCreditPack(1), "purchase_25");
    assert.equal(recommendCreditPack(25), "purchase_25");
    assert.equal(recommendCreditPack(26), "purchase_100");
});

test("checkout body rejects tampered price, credits, and user", () => {
    assert.equal(validateCheckoutRequestBody({productCode: "purchase_25"}).ok, true);
    assert.equal(validateCheckoutRequestBody({productCode: "unknown"}).ok, false);
    assert.equal(validateCheckoutRequestBody({productCode: "purchase_25", credits: 999}).ok, false);
    assert.equal(validateCheckoutRequestBody({productCode: "purchase_25", price: 0.01}).ok, false);
    assert.equal(validateCheckoutRequestBody({productCode: "purchase_25", userId: "other"}).ok, false);
    assert.equal(validateCheckoutRequestBody({productCode: "purchase_25", priceId: "price_fake"}).ok, false);
});

test("checkout return waits for webhook fulfillment, not pre-existing Pro", () => {
    assert.equal(billingStatusIsServerFulfilled({fulfilled: true}), true);
    assert.equal(billingStatusIsServerFulfilled({fulfilled: false, is_pro: true} as {fulfilled?: boolean}), false);
    assert.equal(billingStatusIsServerFulfilled({}), false);
});

test("billing return paths reject open redirects", () => {
    assert.equal(sanitizeBillingReturnPath("/app/import/instagram"), "/app/import/instagram");
    assert.equal(sanitizeBillingReturnPath("/app/credits"), "/app/credits");
    assert.equal(sanitizeBillingReturnPath("https://evil.example/phish"), "/app/import/instagram");
    assert.equal(sanitizeBillingReturnPath("//evil.example"), "/app/import/instagram");
    assert.equal(sanitizeBillingReturnPath("/account"), "/app/import/instagram");
    assert.equal(sanitizeBillingReturnPath("/app/import/instagram?token=secret"), "/app/import/instagram");
});
