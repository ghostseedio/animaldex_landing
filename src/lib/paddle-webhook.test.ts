import assert from "node:assert/strict";
import test from "node:test";
import {handlePaddleEvent, type WildlifeGuideFulfillment, type WildlifeGuideWebPurchase} from "./paddle-webhook";
import {productCodeForPaddlePriceId, type PaddleEvent} from "./paddle-server";

// The catalog each Credits and Pro event's Price ID is checked against.
process.env.PADDLE_PRICE_CREDITS_25 = "pri_25";
process.env.PADDLE_PRICE_CREDITS_100 = "pri_100";
process.env.PADDLE_PRICE_PRO_MONTHLY = "pri_pro";

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

test("a Credits or Pro event with a Price ID that is not ours fails closed", async () => {
    const foreign = mockSupabase();
    await assert.rejects(() => handlePaddleEvent(foreign.client as never, transactionEvent({
        items: [{quantity: 1, price: {id: "pri_foreign"}}]
    })), /paddle_unknown_price/);
    assert.equal(foreign.calls.some((call) => call.name === "fulfill_web_purchase"), false);
    assert.equal(foreign.calls.at(-1)?.name, "fail_web_purchase_event");

    // A Credit pack's Price ID never keeps a subscription alive.
    const packSubscription = mockSupabase();
    await assert.rejects(() => handlePaddleEvent(packSubscription.client as never, {
        event_id: "evt_sub_pack",
        event_type: "subscription.activated",
        occurred_at: "2026-08-31T09:00:00Z",
        data: {id: "sub_1", status: "active", items: [{quantity: 1, price: {id: "pri_25"}}]}
    }), /paddle_unknown_price/);
    assert.equal(packSubscription.calls.some((call) => call.name === "sync_paddle_subscription_state"), false);
});

test("a Credit pack without a Price ID never stops Pro events", async () => {
    const proOnly = {PADDLE_PRICE_PRO_MONTHLY: "pri_pro"} as unknown as NodeJS.ProcessEnv;
    const mock = mockSupabase();
    await handlePaddleEvent(mock.client as never, {
        event_id: "evt_pro_only",
        event_type: "subscription.activated",
        occurred_at: "2026-08-31T09:00:00Z",
        data: {id: "sub_1", status: "active", items: [{quantity: 1, price: {id: "pri_pro"}}]}
    }, undefined, null, (priceId) => productCodeForPaddlePriceId(priceId, proOnly));
    assert.equal(mock.calls.some((call) => call.name === "sync_paddle_subscription_state"), true);
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

// ---------------------------------------------------------------------------
// Wildlife Guides bought by card (custom_data.kind = "wildlife_guide")
// ---------------------------------------------------------------------------

const GUIDE_PURCHASE_ID = "44444444-4444-4444-8444-444444444444";

function guideMock(options: {markPaidStatus?: string; rpcError?: {name: string; message: string}} = {}) {
    const calls: RpcCall[] = [];
    return {
        calls,
        client: {
            rpc: async (name: string, args: Record<string, unknown>) => {
                calls.push({name, args});
                if (options.rpcError?.name === name) return {data: null, error: {message: options.rpcError.message}};
                if (name === "claim_web_purchase_event") return {data: true, error: null};
                if (name === "mark_wildlife_guide_web_purchase_paid") {
                    return {data: {id: args.p_purchase_id, status: options.markPaidStatus ?? "paid"}, error: null};
                }
                return {data: null, error: null};
            }
        }
    };
}

function guideServices(purchase: Partial<WildlifeGuideWebPurchase> | null, existingUserId: string | null = null) {
    const log: string[] = [];
    const services: WildlifeGuideFulfillment = {
        loadPurchase: async (id) => (purchase ? {
            id,
            listing_id: "55555555-5555-4555-8555-555555555555",
            channel: "web_card",
            status: "pending",
            buyer_user_id: null,
            buyer_email: "guest@example.com",
            paddle_transaction_id: null,
            ...purchase
        } : null),
        findUserIdByEmail: async (email) => {
            log.push(`find:${email}`);
            return existingUserId;
        },
        createUser: async (email) => {
            log.push(`create:${email}`);
            return "66666666-6666-4666-8666-666666666666";
        },
        reopenPurchase: async (id) => {
            log.push(`reopen:${id}`);
        },
        sendAccessLink: async ({email, userId}) => {
            log.push(`email:${email}:${userId}`);
        }
    };
    return {services, log};
}

function guideEvent(eventType = "transaction.completed", overrides: Record<string, unknown> = {}): PaddleEvent {
    return {
        event_id: `evt_guide_${eventType}`,
        event_type: eventType,
        occurred_at: "2026-10-20T08:00:00Z",
        data: {
            id: "txn_guide",
            status: eventType === "transaction.completed" ? "completed" : "canceled",
            custom_data: {kind: "wildlife_guide", purchase_id: GUIDE_PURCHASE_ID},
            items: [{quantity: 1, price: {id: "pri_inline", product_id: "pro_inline"}}],
            ...overrides
        }
    };
}

test("a guest's paid guide makes an account, marks it paid and emails a sign-in link", async () => {
    const mock = guideMock();
    const {services, log} = guideServices({});
    await handlePaddleEvent(mock.client as never, guideEvent(), undefined, services);
    const paid = mock.calls.find((call) => call.name === "mark_wildlife_guide_web_purchase_paid");
    assert.equal(paid?.args.p_purchase_id, GUIDE_PURCHASE_ID);
    assert.equal(paid?.args.p_transaction_id, "txn_guide");
    assert.equal(paid?.args.p_buyer_user_id, "66666666-6666-4666-8666-666666666666");
    assert.deepEqual(log, ["find:guest@example.com", "create:guest@example.com", "email:guest@example.com:66666666-6666-4666-8666-666666666666"]);
    assert.equal(mock.calls.some((call) => call.name === "fulfill_web_purchase"), false);
    assert.equal(mock.calls.at(-1)?.name, "complete_web_purchase_event");
});

test("a guest whose email already has an account is linked to it, not given a new one", async () => {
    const mock = guideMock();
    const {services, log} = guideServices({}, "77777777-7777-4777-8777-777777777777");
    await handlePaddleEvent(mock.client as never, guideEvent(), undefined, services);
    const paid = mock.calls.find((call) => call.name === "mark_wildlife_guide_web_purchase_paid");
    assert.equal(paid?.args.p_buyer_user_id, "77777777-7777-4777-8777-777777777777");
    assert.equal(log.some((entry) => entry.startsWith("create:")), false);
});

test("a signed-in card buyer is marked paid on their own account and gets no email", async () => {
    const mock = guideMock();
    const {services, log} = guideServices({buyer_user_id: "88888888-8888-4888-8888-888888888888"});
    await handlePaddleEvent(mock.client as never, guideEvent(), undefined, services);
    const paid = mock.calls.find((call) => call.name === "mark_wildlife_guide_web_purchase_paid");
    assert.equal(paid?.args.p_buyer_user_id, "88888888-8888-4888-8888-888888888888");
    assert.deepEqual(log, []);
});

test("a redelivered completion for a settled guide purchase changes nothing", async () => {
    const mock = guideMock();
    const {services, log} = guideServices({status: "paid", paddle_transaction_id: "txn_guide", buyer_user_id: "88888888-8888-4888-8888-888888888888"});
    const result = await handlePaddleEvent(mock.client as never, guideEvent(), undefined, services);
    assert.equal(result.reason, "wildlife_guide_already_settled");
    assert.equal(mock.calls.some((call) => call.name === "mark_wildlife_guide_web_purchase_paid"), false);
    assert.deepEqual(log, []);
});

test("a duplicate guide purchase refunded by the database sends no access email", async () => {
    const mock = guideMock({markPaidStatus: "refunded"});
    const {services, log} = guideServices({}, "77777777-7777-4777-8777-777777777777");
    await handlePaddleEvent(mock.client as never, guideEvent(), undefined, services);
    assert.equal(log.some((entry) => entry.startsWith("email:")), false);
});

test("a canceled checkout paid after all reopens the purchase before marking it paid", async () => {
    const mock = guideMock();
    const {services, log} = guideServices({status: "failed"});
    await handlePaddleEvent(mock.client as never, guideEvent(), undefined, services);
    assert.equal(log[0], `reopen:${GUIDE_PURCHASE_ID}`);
    assert.ok(mock.calls.some((call) => call.name === "mark_wildlife_guide_web_purchase_paid"));
});

test("a guide transaction that does not match the stored one fails closed", async () => {
    const mock = guideMock();
    const {services} = guideServices({paddle_transaction_id: "txn_other"});
    await assert.rejects(() => handlePaddleEvent(mock.client as never, guideEvent(), undefined, services), /wildlife_guide_transaction_mismatch/);
    assert.ok(mock.calls.some((call) => call.name === "fail_web_purchase_event"));
});

test("a canceled guide checkout is marked failed; a declined card attempt keeps it pending", async () => {
    const canceled = guideMock();
    await handlePaddleEvent(canceled.client as never, guideEvent("transaction.canceled"), undefined, guideServices({}).services);
    assert.equal(canceled.calls.find((call) => call.name === "mark_wildlife_guide_web_purchase_failed")?.args.p_purchase_id, GUIDE_PURCHASE_ID);

    const declined = guideMock();
    const result = await handlePaddleEvent(declined.client as never, guideEvent("transaction.payment_failed"), undefined, guideServices({}).services);
    assert.equal(result.reason, "wildlife_guide_transaction_pending");
    assert.equal(declined.calls.some((call) => call.name === "mark_wildlife_guide_web_purchase_failed"), false);
});

test("an approved refund or chargeback also reverses a Wildlife Guide card purchase", async () => {
    for (const action of ["refund", "chargeback"]) {
        const mock = mockSupabase();
        await handlePaddleEvent(mock.client as never, {
            event_id: `evt_guide_${action}`,
            event_type: "adjustment.updated",
            occurred_at: "2026-10-20T10:00:00Z",
            data: {id: `adj_guide_${action}`, transaction_id: "txn_guide", action, type: "full", status: "approved"}
        });
        assert.equal(mock.calls.find((call) => call.name === "mark_wildlife_guide_web_purchase_reversed")?.args.p_transaction_id, "txn_guide");
    }
    const pending = mockSupabase();
    await handlePaddleEvent(pending.client as never, {
        event_id: "evt_guide_pending_refund",
        event_type: "adjustment.created",
        occurred_at: "2026-10-20T10:00:00Z",
        data: {id: "adj_pending", transaction_id: "txn_guide", action: "refund", type: "full", status: "pending_approval"}
    });
    assert.equal(pending.calls.some((call) => call.name === "mark_wildlife_guide_web_purchase_reversed"), false);
});
