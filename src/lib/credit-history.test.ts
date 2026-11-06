import assert from "node:assert/strict";
import test from "node:test";
import {creditTransactionDelta, creditTransactionLabel, decodeCreditTransactions, type CreditTransaction} from "@/lib/credit-history";

const row = (delta: number, reason: string, metadata: CreditTransaction["metadata"] = null): CreditTransaction => ({id: "x", delta, reason, createdAt: "2026-11-06T00:00:00Z", metadata});

test("credit history lines read as iOS words them", () => {
    assert.equal(creditTransactionLabel(row(25, "purchase", {product_code: "purchase_25"})), "Purchased 25 credits");
    assert.equal(creditTransactionLabel(row(0, "purchase", {product_code: "pro_annual"})), "AnimalDex Pro");
    assert.equal(creditTransactionLabel(row(-2, "analysis")), "Scan");
    assert.equal(creditTransactionLabel(row(2, "analysis")), "Scan credit returned");
    assert.equal(creditTransactionLabel(row(5, "grant", {action: "mission_reward", mission_title: "First catch"})), "First catch");
    assert.equal(creditTransactionLabel(row(1, "grant", {action: "wild_unique_species_credit"})), "First wild capture");
    assert.equal(creditTransactionLabel(row(-1, "adjustment", {action: "stat_boost", stat: "top_speed"})), "Trained Top Speed");
    assert.equal(creditTransactionLabel(row(-1, "adjustment", {action: "animal_chat_message"})), "Animal chat");
    assert.equal(creditTransactionLabel(row(-3, "adjustment", {action: "capture_gift"})), "Sent a Gift");
    assert.equal(creditTransactionLabel(row(-5, "other", {action: "heart_heal"})), "Heal a heart: 5 Credits");
    assert.equal(creditTransactionLabel(row(-4, "mystery")), "Credits used");
});

test("the amount is signed, and a Pro purchase reads PRO", () => {
    assert.equal(creditTransactionDelta(row(25, "purchase")), "+25");
    assert.equal(creditTransactionDelta(row(-2, "analysis")), "-2");
    assert.equal(creditTransactionDelta(row(0, "purchase", {product_code: "pro_upgrade"})), "PRO");
});

test("rows without an id, a number or a date are dropped", () => {
    const decoded = decodeCreditTransactions([
        {id: "a", delta: 3, reason: "grant", created_at: "2026-11-06T00:00:00Z", metadata: {action: "signup_starter"}},
        {id: "b", delta: "x", reason: "grant", created_at: "2026-11-06T00:00:00Z"},
        {delta: 1, created_at: "2026-11-06T00:00:00Z"},
        null
    ]);
    assert.equal(decoded.length, 1);
    assert.equal(creditTransactionLabel(decoded[0]), "Starter credits");
});
