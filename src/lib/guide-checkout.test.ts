import assert from "node:assert/strict";
import test from "node:test";
import {quoteGuideCheckout} from "./guide-checkout";

test("a USD listing is charged in USD with no conversion", () => {
    const quote = quoteGuideCheckout({amountMinor: 2500, currencyCode: "usd", guestCount: 2});
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.chargeCurrency, "USD");
    assert.equal(quote.chargeAmountMinor, 5000);
    assert.equal(quote.listedTotalMinor, 5000);
    assert.equal(quote.fxRate, null);
});

test("an IDR listing converts the listed fee into USD cents", () => {
    const quote = quoteGuideCheckout({
        amountMinor: 200000,
        currencyCode: "IDR",
        guestCount: 2,
        usdPerMajorUnit: 0.00006
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.listedCurrency, "IDR");
    assert.equal(quote.listedTotalMinor, 400000);
    assert.equal(quote.chargeCurrency, "USD");
    assert.equal(quote.chargeAmountMinor, 2400);
    assert.equal(quote.fxRate, 0.00006);
});

test("IDR without a rate is refused instead of inventing a price", () => {
    const quote = quoteGuideCheckout({amountMinor: 200000, currencyCode: "IDR", guestCount: 1});
    assert.equal(quote.ok, false);
});

test("a charge under the merchant minimum is refused", () => {
    const quote = quoteGuideCheckout({amountMinor: 10, currencyCode: "USD", guestCount: 1});
    assert.equal(quote.ok, false);
    if (quote.ok) return;
    assert.match(quote.error, /minimum/);
});
