import assert from "node:assert/strict";
import test from "node:test";
import {handlePaddleEvent} from "./paddle-webhook";
import type {PaddleEvent} from "./paddle-server";

type RpcCall = {name: string; args: Record<string, unknown>};

function mockSupabase(options: {claim?: boolean; rpcError?: {name: string; message: string}} = {}) {
    const calls: RpcCall[] = [];
    return {
        calls,
        client: {
            rpc: async (name: string, args: Record<string, unknown>) => {
                calls.push({name, args});
                if (options.rpcError?.name === name) return {data: null, error: {message: options.rpcError.message}};
                if (name === "claim_web_purchase_event") return {data: options.claim ?? true, error: null};
                return {data: {ok: true}, error: null};
            }
        }
    };
}

function transactionEvent(overrides: Record<string, unknown> = {}): PaddleEvent {
    return {
        event_id: "evt_txn",
        event_type: "transaction.completed",
        occurred_at: "2026-08-31T08:00:00Z",
        data: {
            id: "txn_1",
            status: "completed",
            customer_id: "ctm_1",
            subscription_id: null,
            custom_data: {animaldex_purchase_id: "11111111-1111-4111-8111-111111111111"},
            items: [{quantity: 1, price: {id: "pri_25", product_id: "pro_25"}}],
            ...overrides
        }
    };
}

test("duplicate Paddle event cannot fulfill twice", async () => {
    const mock = mockSupabase({claim: false});
    const result = await handlePaddleEvent(mock.client as never, transactionEvent());
    assert.equal(result.reason, "duplicate_event");
    assert.equal(mock.calls.some((call) => call.name === "fulfill_web_purchase"), false);
});

test("completed transaction fulfills the registered purchase with provider provenance", async () => {
    const mock = mockSupabase();
    await handlePaddleEvent(mock.client as never, transactionEvent());
    const fulfill = mock.calls.find((call) => call.name === "fulfill_web_purchase");
    assert.equal(fulfill?.args.p_purchase_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(fulfill?.args.p_provider_transaction_id, "txn_1");
    assert.equal(fulfill?.args.p_provider_price_id, "pri_25");
    assert.equal(fulfill?.args.p_provider, "paddle");
    assert.equal(mock.calls.at(-1)?.name, "complete_web_purchase_event");
});

test("wrong quantity or missing registered purchase identity fails closed and marks retryable failure", async () => {
    const quantity = mockSupabase();
    await assert.rejects(() => handlePaddleEvent(quantity.client as never, transactionEvent({
        items: [{quantity: 2, price: {id: "pri_25"}}]
    })), /quantity/);
    assert.equal(quantity.calls.at(-1)?.name, "fail_web_purchase_event");

    const purchase = mockSupabase();
    await assert.rejects(() => handlePaddleEvent(purchase.client as never, transactionEvent({custom_data: {}})), /transaction_mismatch/);
    assert.equal(purchase.calls.some((call) => call.name === "fulfill_web_purchase"), false);
});

test("foreign user metadata is passed to SQL for server-authoritative mismatch rejection", async () => {
    const mock = mockSupabase({rpcError: {name: "fulfill_web_purchase", message: "purchase_user_mismatch"}});
    await assert.rejects(() => handlePaddleEvent(mock.client as never, transactionEvent({
        custom_data: {
            animaldex_purchase_id: "11111111-1111-4111-8111-111111111111",
            animaldex_user_id: "22222222-2222-4222-8222-222222222222"
        }
    })), /purchase_user_mismatch/);
    assert.equal(mock.calls.at(-1)?.name, "fail_web_purchase_event");
});

test("subscription lifecycle maps Paddle states and carries event time for out-of-order protection", async () => {
    const cases = [
        ["subscription.activated", "active"], ["subscription.past_due", "past_due"],
        ["subscription.paused", "paused"], ["subscription.resumed", "active"],
        ["subscription.canceled", "canceled"]
    ];
    for (const [eventType, expected] of cases) {
        const mock = mockSupabase();
        await handlePaddleEvent(mock.client as never, {
            event_id: `evt_${expected}`,
            event_type: eventType,
            occurred_at: "2026-08-31T09:00:00Z",
            data: {
                id: "sub_1", status: "active", customer_id: "ctm_1",
                custom_data: {animaldex_purchase_id: "11111111-1111-4111-8111-111111111111"},
                items: [{quantity: 1, price: {id: "pri_pro", product_id: "pro_monthly"}}]
            }
        });
        const sync = mock.calls.find((call) => call.name === "sync_paddle_subscription_state");
        assert.equal(sync?.args.p_status, expected);
        assert.equal(sync?.args.p_occurred_at, "2026-08-31T09:00:00Z");
    }
});

test("approved full refund and chargeback go through durable adjustment policy", async () => {
    for (const action of ["refund", "chargeback"]) {
        const mock = mockSupabase();
        await handlePaddleEvent(mock.client as never, {
            event_id: `evt_${action}`,
            event_type: "adjustment.updated",
            occurred_at: "2026-08-31T10:00:00Z",
            data: {id: `adj_${action}`, transaction_id: "txn_1", action, type: "full", status: "approved"}
        });
        const adjustment = mock.calls.find((call) => call.name === "record_web_purchase_adjustment");
        assert.equal(adjustment?.args.p_provider_adjustment_id, `adj_${action}`);
        assert.equal(adjustment?.args.p_provider_transaction_id, "txn_1");
    }
});

test("unhandled payment-failure transaction event never grants or mutates Pro", async () => {
    const mock = mockSupabase();
    const result = await handlePaddleEvent(mock.client as never, {
        event_id: "evt_failed", event_type: "transaction.payment_failed",
        occurred_at: "2026-08-31T11:00:00Z", data: {id: "txn_failed"}
    });
    assert.equal(result.reason, "unhandled_event");
    assert.equal(mock.calls.some((call) => call.name === "fulfill_web_purchase"), false);
});
