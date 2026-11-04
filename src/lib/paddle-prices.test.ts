import assert from "node:assert/strict";
import test from "node:test";
import {annualSavingPercent, describePaddlePrice, loadProPlanPrices} from "./paddle-prices";

// The Pro plans' prices on the website come from Paddle's own price objects:
// the configured Price ID's amount, period and free trial.

const yearly = {id: "pri_year", status: "active", unit_price: {amount: "7999", currency_code: "USD"}, billing_cycle: {interval: "year", frequency: 1}, trial_period: {interval: "day", frequency: 7}};
const monthly = {id: "pri_month", status: "active", unit_price: {amount: "1499", currency_code: "USD"}, billing_cycle: {interval: "month", frequency: 1}, trial_period: null};

test("a Paddle price reads as the page shows it, with the trial only when the price has one", () => {
    assert.deepEqual(describePaddlePrice(yearly), {priceId: "pri_year", amount: 79.99, currency: "USD", display: "$79.99/year", interval: "year", frequency: 1, trialLabel: "7 days free"});
    assert.equal(describePaddlePrice(monthly)?.display, "$14.99/month");
    assert.equal(describePaddlePrice(monthly)?.trialLabel, null);
    assert.equal(describePaddlePrice({...yearly, trial_period: {interval: "week", frequency: 1}})?.trialLabel, "1 week free");
    // Zero-decimal currencies are whole units in Paddle.
    assert.equal(describePaddlePrice({...monthly, unit_price: {amount: "2200", currency_code: "JPY"}})?.amount, 2200);
    assert.equal(describePaddlePrice({...monthly, billing_cycle: {interval: "month", frequency: 3}})?.display, "$14.99/3 months");
});

test("anything that is not a readable, active, recurring price is left to the catalog's fallback", () => {
    assert.equal(describePaddlePrice(undefined), null);
    assert.equal(describePaddlePrice({...yearly, billing_cycle: null}), null);
    assert.equal(describePaddlePrice({...yearly, status: "archived"}), null);
    assert.equal(describePaddlePrice({...yearly, unit_price: {amount: "79.99", currency_code: "USD"}}), null);
    assert.equal(describePaddlePrice({...yearly, unit_price: {amount: "7999", currency_code: "usd"}}), null);
});

test("the yearly saving is shown only for a plain month against a plain year in one currency, rounded down", () => {
    assert.equal(annualSavingPercent(describePaddlePrice(monthly), describePaddlePrice(yearly)), 55);
    assert.equal(annualSavingPercent(describePaddlePrice(monthly), describePaddlePrice({...yearly, unit_price: {amount: "7999", currency_code: "EUR"}})), null);
    assert.equal(annualSavingPercent(null, describePaddlePrice(yearly)), null);
    assert.equal(annualSavingPercent(describePaddlePrice(monthly), describePaddlePrice({...yearly, unit_price: {amount: "19999", currency_code: "USD"}})), null);
});

test("with no Pro Price ID or no Paddle API key, nothing is fetched and the page falls back", async () => {
    assert.deepEqual(await loadProPlanPrices({} as NodeJS.ProcessEnv), {});
    assert.deepEqual(await loadProPlanPrices({PADDLE_PRICE_PRO_ANNUAL: "pri_year", PADDLE_ENVIRONMENT: "production", PADDLE_API_KEY: ""} as unknown as NodeJS.ProcessEnv), {});
});
