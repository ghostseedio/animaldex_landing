import {NextResponse} from "next/server";
import {getPublicWildlifeGuide} from "@/data/virtual-wildlife-guides";
import {WILDLIFE_GUIDE_CHECKOUT_KIND} from "@/lib/paddle-webhook";
import {assertPaddleApiConfigured, getPaddleClientToken, paddleApiRequest, resolvePaddleEnvironment} from "@/lib/paddle-server";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {
    formatGuidePrice,
    guideCardCharge,
    isUuid,
    isValidBuyerEmail,
    purchaseIsActive,
    type GuideDetail
} from "@/lib/virtual-wildlife-guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PurchaseRow = {
    id: string;
    status: string;
    buyer_email: string | null;
    paddle_transaction_id: string | null;
};

const NO_STORE = {"Cache-Control": "private, no-store"};

function jsonError(message: string, status = 400, code?: string) {
    return NextResponse.json({ok: false, error: message, ...(code ? {code} : {})}, {status, headers: NO_STORE});
}

/**
 * Card checkout for a Wildlife Guide (Paddle overlay). Works signed out: a
 * guest gives only an email, and the Paddle webhook makes or finds their
 * account and emails them a sign-in link to the guide. Guide prices are USD
 * cents, so the charge is the listed price in USD.
 *
 * The purchase row comes first (create_wildlife_guide_web_purchase, keyed by
 * the page's idempotency key), then one Paddle transaction for it, saved on the
 * row so a retry reopens the same transaction instead of charging twice.
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return jsonError("Guide not found.", 404);
    if (assertPaddleApiConfigured()) return jsonError("Card payment is not available right now.", 503);
    const environment = resolvePaddleEnvironment();
    const clientToken = getPaddleClientToken();
    if (!environment || !clientToken) return jsonError("Card payment is not available right now.", 503);
    const service = createSupabaseServiceClient();
    if (!service) return jsonError("Card payment is not available right now.", 503);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return jsonError("Checkout could not be started. Try again.");
    // The Buyer Terms version the buyer ticked; the database refuses the purchase without the current one.
    const buyerTermsVersion = typeof body.buyerTermsVersion === "string" ? body.buyerTermsVersion.trim().slice(0, 80) : "";
    if (!buyerTermsVersion) return jsonError("Agree to the Buyer Terms to buy this guide.", 400, "buyer_terms_required");

    // Signed in: the account's own email and id, never what the form says.
    const session = createSupabaseServerClient();
    const viewer = session ? (await session.auth.getUser()).data.user : null;
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (viewer) {
        email = viewer.email?.trim().toLowerCase() || email;
        const {data: mine} = await session!.rpc("get_public_wildlife_guide", {p_listing_id: params.id});
        const viewerGuide = mine as GuideDetail | null;
        if (viewerGuide?.seller?.userId === viewer.id) return jsonError("This is your own guide.", 400, "own_guide");
        if (purchaseIsActive(viewerGuide?.purchase)) return NextResponse.json({ok: true, alreadyBought: true}, {headers: NO_STORE});
    }
    if (!isValidBuyerEmail(email)) return jsonError("Enter the email to send your guide to.", 400, "email_required");

    const guide = await getPublicWildlifeGuide(params.id);
    if (!guide) return jsonError("This guide is not for sale right now.", 409, "not_for_sale");
    const charge = guideCardCharge(guide);
    if (!charge) return jsonError("Card payment is not available for this guide.", 409, "not_for_sale");
    const chargeLabel = formatGuidePrice(charge.amountMinor, charge.currency, "en");

    const {data: created, error: createError} = await service.rpc("create_wildlife_guide_web_purchase", {
        p_listing_id: guide.id,
        p_buyer_email: email,
        p_buyer_user_id: viewer?.id ?? null,
        p_idempotency_key: idempotencyKey,
        p_charge_currency: charge.currency,
        p_charge_amount_minor: charge.amountMinor,
        p_buyer_terms_version: buyerTermsVersion
    });
    if (createError) {
        if (/buyer_terms_required/.test(createError.message)) {
            return jsonError("The Buyer Terms were updated. Reload the page to read and agree to them.", 409, "buyer_terms_required");
        }
        if (/own_guide/.test(createError.message)) return jsonError("This is your own guide.", 400, "own_guide");
        if (/guide_not_for_sale/.test(createError.message)) return jsonError("This guide is not for sale right now.", 409, "not_for_sale");
        return jsonError("Checkout could not be started. Try again.", 500);
    }
    let row = (Array.isArray(created) ? created[0] : created) as PurchaseRow | null;
    if (!row?.id) return jsonError("Checkout could not be started. Try again.", 500);
    if (row.status === "paid" || row.status === "released") {
        return NextResponse.json({ok: true, alreadyPaid: true, purchaseId: row.id}, {headers: NO_STORE});
    }
    if (row.status === "refunded") return jsonError("This checkout is closed. Reload the page to buy again.", 409, "checkout_closed");
    if ((row.buyer_email ?? "") !== email) {
        // Same page key, different email: the client starts a new key per email, so this is a stale retry.
        return jsonError("Checkout could not be started. Reload the page and try again.", 409, "checkout_closed");
    }
    if (row.status === "failed") {
        const {error: resetError} = await service
            .from("guide_purchases")
            .update({status: "pending", paddle_transaction_id: null})
            .eq("id", row.id)
            .eq("status", "failed");
        if (resetError) return jsonError("Checkout could not be started. Try again.", 500);
        row = {...row, status: "pending", paddle_transaction_id: null};
    }

    const reply = (transactionId: string) => NextResponse.json({
        ok: true,
        environment,
        clientToken,
        transactionId,
        purchaseId: row!.id,
        customerEmail: email,
        chargeLabel
    }, {headers: NO_STORE});
    if (row.paddle_transaction_id) return reply(row.paddle_transaction_id);

    const title = guide.title.replace(/\s+/g, " ").trim().slice(0, 80) || "Wildlife Guide";
    let transactionId = "";
    try {
        const transaction = await paddleApiRequest<{data?: {id?: string}}>("/transactions", {
            method: "POST",
            body: JSON.stringify({
                items: [{
                    quantity: 1,
                    price: {
                        description: "Virtual Wildlife Guide",
                        name: title,
                        unit_price: {amount: String(charge.amountMinor), currency_code: charge.currency},
                        product: {
                            name: "AnimalDex Wildlife Guide",
                            tax_category: "standard",
                            description: "A virtual wildlife guide: the author's notes for every animal, a chat with the author and introductions to local people. Advice, not a tour; wildlife is never guaranteed."
                        }
                    }
                }],
                currency_code: charge.currency,
                custom_data: {kind: WILDLIFE_GUIDE_CHECKOUT_KIND, purchase_id: row.id}
            })
        });
        transactionId = transaction.data?.id ?? "";
    } catch (error) {
        console.error("[wildlife-guide-checkout] Paddle transaction failed", row.id, error);
        await service.rpc("mark_wildlife_guide_web_purchase_failed", {p_purchase_id: row.id});
        return jsonError("Card payment could not be started. Try again.", 502);
    }
    if (!transactionId.startsWith("txn_")) {
        await service.rpc("mark_wildlife_guide_web_purchase_failed", {p_purchase_id: row.id});
        return jsonError("Card payment could not be started. Try again.", 502);
    }
    const {error: saveError} = await service
        .from("guide_purchases")
        .update({paddle_transaction_id: transactionId})
        .eq("id", row.id)
        .eq("status", "pending");
    if (saveError) return jsonError("Checkout could not be started. Try again.", 500);
    return reply(transactionId);
}
