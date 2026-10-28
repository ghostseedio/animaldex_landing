import assert from "node:assert/strict";
import test from "node:test";
import {
    beginCheckoutParameters,
    checkoutValueFromPaddle,
    rememberCompletedCheckout,
    takeConfirmedPurchase,
    type CheckoutStorage
} from "./web-checkout-analytics";

function memoryStorage(): CheckoutStorage & {data: Map<string, string>} {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key)
    };
}

const paddleEuro = {
    transaction_id: "txn_01",
    currency_code: "EUR",
    totals: {subtotal: 2.75, discount: 0, tax: 0.52, total: 3.27}
};

test("the value is Paddle's localized price before tax, in its currency", () => {
    assert.deepEqual(checkoutValueFromPaddle(paddleEuro), {value: 2.75, currency: "EUR", tax: 0.52});
    assert.deepEqual(checkoutValueFromPaddle({currency_code: "GBP", totals: {total: 3.6, tax: 0.6}}), {value: 3, currency: "GBP", tax: 0.6});
    assert.equal(checkoutValueFromPaddle({currency_code: "eur", totals: {total: 1}}), null);
    assert.equal(checkoutValueFromPaddle(undefined), null);
});

test("begin_checkout falls back to the catalog price only when Paddle reports none", () => {
    assert.deepEqual(beginCheckoutParameters("purchase_25", paddleEuro), {
        value: 2.75,
        currency: "EUR",
        items: [{item_id: "purchase_25", item_name: "25 Credits", price: 2.75, quantity: 1}]
    });
    assert.deepEqual(beginCheckoutParameters("pro_upgrade", undefined).currency, "USD");
    assert.equal(beginCheckoutParameters("pro_upgrade", undefined).value, 9.99);
});

test("a confirmed purchase is reported once, with the overlay's transaction and price", () => {
    const storage = memoryStorage();
    rememberCompletedCheckout(storage, "purchase-1", "purchase_25", paddleEuro);
    assert.deepEqual(takeConfirmedPurchase(storage, "purchase-1", "purchase_25"), {
        transaction_id: "txn_01",
        value: 2.75,
        currency: "EUR",
        tax: 0.52,
        items: [{item_id: "purchase_25", item_name: "25 Credits", price: 2.75, quantity: 1}]
    });
    assert.equal(takeConfirmedPurchase(storage, "purchase-1", "purchase_25"), null);
});

test("a purchase confirmed without the overlay's data still counts, at the catalog price", () => {
    const storage = memoryStorage();
    const purchase = takeConfirmedPurchase(storage, "purchase-2", "pro_upgrade");
    assert.equal(purchase?.transaction_id, "purchase-2");
    assert.equal(purchase?.currency, "USD");
    assert.equal(purchase?.items[0]?.item_id, "pro_upgrade");
    assert.equal(takeConfirmedPurchase(memoryStorage(), "purchase-3", "not_a_product"), null);
});
