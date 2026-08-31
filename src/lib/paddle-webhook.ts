import crypto from "crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {PaddleEvent} from "@/lib/paddle-server";

export type PaddleWebhookResult = {ok: true; skipped?: boolean; reason?: string};

function asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function customData(object: Record<string, unknown>) {
    return asObject(object.custom_data);
}

function priceFromItems(object: Record<string, unknown>) {
    const items = Array.isArray(object.items) ? object.items : [];
    if (items.length !== 1) throw new Error("paddle_line_item_mismatch");
    const item = asObject(items[0]);
    if (item.quantity != null && Number(item.quantity) !== 1) throw new Error("paddle_quantity_mismatch");
    const price = asObject(item.price);
    const product = asObject(price.product);
    return {priceId: asString(price.id), productId: asString(price.product_id) || asString(product.id)};
}

export async function handlePaddleEvent(
    supabase: SupabaseClient,
    event: PaddleEvent,
    rawBody = JSON.stringify(event)
): Promise<PaddleWebhookResult> {
    const digest = crypto.createHash("sha256").update(rawBody).digest("hex");
    const {data: claimed, error: claimError} = await supabase.rpc("claim_web_purchase_event", {
        p_provider: "paddle",
        p_event_id: event.event_id,
        p_event_type: event.event_type,
        p_occurred_at: event.occurred_at,
        p_payload_digest: digest,
        p_notification_id: event.notification_id ?? null
    });
    if (claimError) throw new Error(claimError.message);
    if (claimed === false) return {ok: true, skipped: true, reason: "duplicate_event"};

    try {
        let result: PaddleWebhookResult;
        if (event.event_type === "transaction.completed") {
            result = await fulfillTransaction(supabase, event);
        } else if (event.event_type.startsWith("subscription.")) {
            result = await syncSubscription(supabase, event);
        } else if (event.event_type === "adjustment.created" || event.event_type === "adjustment.updated") {
            result = await recordAdjustment(supabase, event);
        } else {
            result = {ok: true, skipped: true, reason: "unhandled_event"};
        }
        const {error} = await supabase.rpc("complete_web_purchase_event", {
            p_provider: "paddle",
            p_event_id: event.event_id
        });
        if (error) throw new Error(error.message);
        return result;
    } catch (error) {
        await supabase.rpc("fail_web_purchase_event", {
            p_provider: "paddle",
            p_event_id: event.event_id,
            p_error: error instanceof Error ? error.message.slice(0, 500) : "webhook_failed"
        });
        throw error;
    }
}

async function fulfillTransaction(supabase: SupabaseClient, event: PaddleEvent): Promise<PaddleWebhookResult> {
    const object = event.data;
    const transactionId = asString(object.id);
    const status = asString(object.status);
    const custom = customData(object);
    const purchaseId = asString(custom.animaldex_purchase_id);
    const reportedUserId = asString(custom.animaldex_user_id);
    const {priceId, productId} = priceFromItems(object);
    if (!transactionId || status !== "completed" || !purchaseId || !priceId) {
        throw new Error("paddle_transaction_mismatch");
    }
    const {data, error} = await supabase.rpc("fulfill_web_purchase", {
        p_purchase_id: purchaseId,
        p_provider: "paddle",
        p_provider_transaction_id: transactionId,
        p_provider_customer_id: asString(object.customer_id),
        p_provider_subscription_id: asString(object.subscription_id),
        p_provider_price_id: priceId,
        p_provider_product_id: productId,
        p_reported_user_id: reportedUserId,
        p_event_id: event.event_id,
        p_occurred_at: event.occurred_at
    });
    if (error) throw new Error(error.message);
    if (data && typeof data === "object" && (data as {ok?: boolean}).ok === false) throw new Error("fulfillment_failed");
    return {ok: true};
}

const SUBSCRIPTION_EVENTS = new Set([
    "subscription.created", "subscription.activated", "subscription.updated", "subscription.trialing",
    "subscription.past_due", "subscription.paused", "subscription.resumed", "subscription.canceled"
]);

async function syncSubscription(supabase: SupabaseClient, event: PaddleEvent): Promise<PaddleWebhookResult> {
    if (!SUBSCRIPTION_EVENTS.has(event.event_type)) return {ok: true, skipped: true, reason: "unhandled_subscription_event"};
    const object = event.data;
    const custom = customData(object);
    const statusOverride: Record<string, string> = {
        "subscription.activated": "active",
        "subscription.resumed": "active",
        "subscription.trialing": "trialing",
        "subscription.past_due": "past_due",
        "subscription.paused": "paused",
        "subscription.canceled": "canceled"
    };
    const status = statusOverride[event.event_type] || asString(object.status);
    const {priceId, productId} = priceFromItems(object);
    if (!asString(object.id) || !status || !priceId) throw new Error("paddle_subscription_mismatch");
    const period = asObject(object.current_billing_period);
    const scheduledChange = asObject(object.scheduled_change);
    const {error} = await supabase.rpc("sync_paddle_subscription_state", {
        p_purchase_id: asString(custom.animaldex_purchase_id),
        p_reported_user_id: asString(custom.animaldex_user_id),
        p_paddle_subscription_id: asString(object.id),
        p_paddle_customer_id: asString(object.customer_id),
        p_status: status,
        p_price_id: priceId,
        p_product_id: productId,
        p_current_period_end: asString(period.ends_at),
        p_scheduled_change_action: asString(scheduledChange.action),
        p_scheduled_change_at: asString(scheduledChange.effective_at),
        p_occurred_at: event.occurred_at,
        p_event_id: event.event_id
    });
    if (error) throw new Error(error.message);
    return {ok: true};
}

async function recordAdjustment(supabase: SupabaseClient, event: PaddleEvent): Promise<PaddleWebhookResult> {
    const object = event.data;
    const adjustmentId = asString(object.id);
    const transactionId = asString(object.transaction_id);
    const action = asString(object.action);
    const status = asString(object.status);
    const type = asString(object.type);
    if (!adjustmentId || !transactionId || !action || !status) throw new Error("paddle_adjustment_mismatch");
    const {error} = await supabase.rpc("record_web_purchase_adjustment", {
        p_provider: "paddle",
        p_provider_adjustment_id: adjustmentId,
        p_provider_transaction_id: transactionId,
        p_action: action,
        p_adjustment_type: type,
        p_status: status,
        p_event_id: event.event_id,
        p_occurred_at: event.occurred_at
    });
    if (error) throw new Error(error.message);
    return {ok: true};
}
