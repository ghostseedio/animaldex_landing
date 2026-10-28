import crypto from "crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {productCodeForPaddlePriceId, type PaddleEvent} from "@/lib/paddle-server";
import type {WebStoreProductCode} from "@/lib/web-store-catalog";

export type PaddleWebhookResult = {ok: true; skipped?: boolean; reason?: string};

/** custom_data.kind on a Wildlife Guide card checkout (src/app/api/wildlife-guides/[id]/checkout). */
export const WILDLIFE_GUIDE_CHECKOUT_KIND = "wildlife_guide";

/** A web_card row of public.guide_purchases, as far as the webhook needs it. */
export type WildlifeGuideWebPurchase = {
    id: string;
    listing_id: string;
    channel: string;
    status: string;
    buyer_user_id: string | null;
    buyer_email: string | null;
    paddle_transaction_id: string | null;
};

/**
 * What fulfilling a guide purchase needs beyond RPCs: reading the row, finding
 * or creating the buyer's account, and emailing a guest their sign-in link.
 * The route passes the real implementation (src/lib/wildlife-guide-fulfillment.ts);
 * tests pass fakes.
 */
export type WildlifeGuideFulfillment = {
    loadPurchase(purchaseId: string): Promise<WildlifeGuideWebPurchase | null>;
    findUserIdByEmail(email: string): Promise<string | null>;
    createUser(email: string): Promise<string>;
    /** A checkout canceled earlier and then paid after all goes back to pending first. */
    reopenPurchase(purchaseId: string): Promise<void>;
    sendAccessLink(input: {email: string; purchaseId: string; listingId: string; userId: string}): Promise<void>;
};

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

/** Which catalog product a Paddle Price ID sells, or null when it is none of ours. */
export type PaddleCatalogLookup = (priceId: string) => WebStoreProductCode | null;

const catalogFromEnvironment: PaddleCatalogLookup = (priceId) => productCodeForPaddlePriceId(priceId);

/**
 * A Credits or Pro event must carry one of the configured catalog Price IDs
 * (a subscription, the Pro one). Only the event's own Price ID is checked: a
 * product whose Price ID is not configured never stops an event for another.
 */
function requireCatalogPrice(priceId: string | null, catalog: PaddleCatalogLookup, only?: WebStoreProductCode) {
    const product = priceId ? catalog(priceId) : null;
    if (!product || (only && product !== only)) throw new Error("paddle_unknown_price");
}

function isWildlifeGuideEvent(event: PaddleEvent) {
    return asString(customData(event.data).kind) === WILDLIFE_GUIDE_CHECKOUT_KIND;
}

export async function handlePaddleEvent(
    supabase: SupabaseClient,
    event: PaddleEvent,
    rawBody = JSON.stringify(event),
    guides: WildlifeGuideFulfillment | null = null,
    catalog: PaddleCatalogLookup = catalogFromEnvironment
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
        if (event.event_type === "transaction.completed" && isWildlifeGuideEvent(event)) {
            if (!guides) throw new Error("wildlife_guide_fulfillment_unavailable");
            result = await fulfillWildlifeGuide(supabase, event, guides);
        } else if (event.event_type === "transaction.canceled" && isWildlifeGuideEvent(event)) {
            result = await failWildlifeGuide(supabase, event);
        } else if (event.event_type.startsWith("transaction.") && isWildlifeGuideEvent(event)) {
            // transaction.payment_failed is a declined attempt inside a checkout
            // that stays open; the buyer can try another card on the same
            // transaction, so the purchase stays pending until completed or canceled.
            result = {ok: true, skipped: true, reason: "wildlife_guide_transaction_pending"};
        } else if (event.event_type === "transaction.completed") {
            result = await fulfillTransaction(supabase, event, catalog);
        } else if (event.event_type.startsWith("subscription.")) {
            result = await syncSubscription(supabase, event, catalog);
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

async function fulfillWildlifeGuide(
    supabase: SupabaseClient,
    event: PaddleEvent,
    guides: WildlifeGuideFulfillment
): Promise<PaddleWebhookResult> {
    const object = event.data;
    const purchaseId = asString(customData(object).purchase_id);
    const transactionId = asString(object.id);
    if (!purchaseId || !transactionId || asString(object.status) !== "completed") {
        throw new Error("wildlife_guide_transaction_mismatch");
    }
    const purchase = await guides.loadPurchase(purchaseId);
    if (!purchase || purchase.channel !== "web_card") throw new Error("wildlife_guide_purchase_not_found");
    if (purchase.paddle_transaction_id && purchase.paddle_transaction_id !== transactionId) {
        throw new Error("wildlife_guide_transaction_mismatch");
    }
    // Already settled (a redelivered event, or paid then reversed): nothing to do.
    if (purchase.status !== "pending" && purchase.status !== "failed") {
        return {ok: true, skipped: true, reason: "wildlife_guide_already_settled"};
    }
    if (purchase.status === "failed") await guides.reopenPurchase(purchase.id);

    const email = purchase.buyer_email?.trim().toLowerCase() || "";
    const isGuest = !purchase.buyer_user_id;
    let buyerId = purchase.buyer_user_id;
    if (!buyerId) {
        if (!email) throw new Error("wildlife_guide_buyer_unknown");
        buyerId = await guides.findUserIdByEmail(email) ?? await guides.createUser(email);
    }

    const {data, error} = await supabase.rpc("mark_wildlife_guide_web_purchase_paid", {
        p_purchase_id: purchase.id,
        p_transaction_id: transactionId,
        p_buyer_user_id: buyerId
    });
    if (error) throw new Error(error.message);
    const row = asObject(Array.isArray(data) ? data[0] : data);

    // A guest has no session: email them a sign-in link that opens the guide.
    // The payment is already recorded, so a failed email never fails the event.
    if (isGuest && email && asString(row.status) === "paid") {
        try {
            await guides.sendAccessLink({email, purchaseId: purchase.id, listingId: purchase.listing_id, userId: buyerId});
        } catch (sendError) {
            console.error("[paddle-webhook] wildlife guide access email failed", purchase.id, sendError);
            return {ok: true, reason: "wildlife_guide_access_email_failed"};
        }
    }
    return {ok: true};
}

async function failWildlifeGuide(supabase: SupabaseClient, event: PaddleEvent): Promise<PaddleWebhookResult> {
    const purchaseId = asString(customData(event.data).purchase_id);
    if (!purchaseId) throw new Error("wildlife_guide_transaction_mismatch");
    const {error} = await supabase.rpc("mark_wildlife_guide_web_purchase_failed", {p_purchase_id: purchaseId});
    if (error) throw new Error(error.message);
    return {ok: true};
}

async function fulfillTransaction(supabase: SupabaseClient, event: PaddleEvent, catalog: PaddleCatalogLookup): Promise<PaddleWebhookResult> {
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
    requireCatalogPrice(priceId, catalog);
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

async function syncSubscription(supabase: SupabaseClient, event: PaddleEvent, catalog: PaddleCatalogLookup): Promise<PaddleWebhookResult> {
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
    requireCatalogPrice(priceId, catalog, "pro_upgrade");
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
    // A refund or chargeback of a Wildlife Guide card payment (ours, sent by
    // the refunds job, or one made in Paddle) locks the guide again. A no-op
    // for any other transaction and for a purchase that is already refunded.
    if ((action === "refund" || action === "chargeback") && (status === "approved" || status === "refunded")) {
        const {error: guideError} = await supabase.rpc("mark_wildlife_guide_web_purchase_reversed", {
            p_transaction_id: transactionId
        });
        if (guideError) throw new Error(guideError.message);
    }
    return {ok: true};
}
