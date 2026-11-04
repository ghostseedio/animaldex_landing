import assert from "node:assert/strict";
import test from "node:test";
import {
    billingReturnHref,
    billingStatusIsServerFulfilled,
    creditDeltaForProduct,
    isProProductCode,
    WEB_STORE_PRO_BENEFITS,
    WEB_STORE_PRO_PLANS,
    WEB_STORE_PRODUCTS,
    webPurchaseProductCode,
    webStoreProBenefits,
    localePrefixForPath,
    localizedBillingReturnPath,
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

test("billing return paths keep the page's language and nothing else", () => {
    assert.equal(sanitizeBillingReturnPath("/id/app/credits"), "/id/app/credits");
    assert.equal(sanitizeBillingReturnPath("/en/app/credits"), "/app/credits");
    assert.equal(sanitizeBillingReturnPath("/id/account"), "/app/import/instagram");
    assert.equal(sanitizeBillingReturnPath("/\\evil.example"), "/app/import/instagram");
    assert.equal(sanitizeBillingReturnPath(null, "/id"), "/id/app/import/instagram");
    assert.equal(localePrefixForPath("/id/app/credits"), "/id");
    assert.equal(localePrefixForPath("/identity"), "");
    assert.equal(localePrefixForPath("/app/credits"), "");
});

test("checkout returns to the page that started it, in its language", () => {
    assert.equal(localizedBillingReturnPath("/app/credits", "/id/app/credits"), "/id/app/credits");
    assert.equal(localizedBillingReturnPath("/app/import/instagram", "/app/import/instagram"), "/app/import/instagram");
    assert.equal(
        billingReturnHref("p1", "/app/credits"),
        "/app/billing/return?status=success&purchase_id=p1&return=%2Fapp%2Fcredits"
    );
    assert.equal(
        billingReturnHref("p1", "/id/app/credits"),
        "/id/app/billing/return?status=success&purchase_id=p1&return=%2Fid%2Fapp%2Fcredits"
    );
});

test("Pro comes yearly or monthly; both are the database's one Pro product", () => {
    assert.deepEqual(WEB_STORE_PRO_PLANS, ["pro_annual", "pro_upgrade"]);
    assert.equal(isProProductCode("pro_annual"), true);
    assert.equal(isProProductCode("pro_upgrade"), true);
    assert.equal(isProProductCode("purchase_25"), false);
    assert.equal(creditDeltaForProduct("pro_annual"), 0);
    assert.equal(webPurchaseProductCode("pro_annual"), "pro_upgrade");
    assert.equal(webPurchaseProductCode("pro_upgrade"), "pro_upgrade");
    assert.equal(webPurchaseProductCode("purchase_100"), "purchase_100");
    assert.equal(WEB_STORE_PRODUCTS.pro_annual.period, "year");
    assert.equal(WEB_STORE_PRODUCTS.pro_upgrade.fallbackPrice, "$14.99/month");
    assert.equal(validateCheckoutRequestBody({productCode: "pro_annual"}).ok, true);
    assert.equal(validateCheckoutRequestBody({productCode: "pro_annual", priceId: "pri_cheap"}).ok, false);
});

test("Pro's benefits promise only what a buyer gets: no Instagram Import, and no monthly Credits on the yearly plan", () => {
    assert.ok(!WEB_STORE_PRO_BENEFITS.some((benefit) => /instagram/i.test(`${benefit.title} ${benefit.detail ?? ""}`)));
    assert.ok(webStoreProBenefits("pro_upgrade").some((benefit) => benefit.title === "42 Credits every month"));
    // Paddle grants the 42 Credits once per paid billing period.
    assert.ok(!webStoreProBenefits("pro_annual").some((benefit) => /Credits every month/.test(benefit.title)));
    assert.doesNotMatch(WEB_STORE_PRODUCTS.pro_annual.detail, /42 Credits/);
});
