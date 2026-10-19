import {NextResponse} from "next/server";
import {getPublicGuideListing} from "@/data/guide-marketplace";
import {PADDLE_PAYMENT_CURRENCIES, quoteGuideCheckout} from "@/lib/guide-checkout";
import {fxDate, fxKey} from "@/lib/fx-convert";
import {getFxRates, hasFxProvider} from "@/lib/fx";
import {formatGuidePrice} from "@/lib/guide-marketplace-core";
import {isUuid} from "@/lib/guide-marketplace-admin";
import {
    assertPaddleApiConfigured,
    getPaddleClientToken,
    paddleApiRequest,
    resolvePaddleEnvironment
} from "@/lib/paddle-server";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutRow = {
    id: string;
    status: string;
    paddle_transaction_id: string | null;
    charge_currency: string;
    charge_amount_minor: number;
    guest_email: string;
};

function jsonError(message: string, status = 400) {
    return NextResponse.json({ok: false, error: message}, {status});
}

function bookableDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const today = new Date();
    const earliest = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
    return new Date(`${value}T00:00:00Z`) >= earliest;
}

function validEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

export async function POST(request: Request) {
    const configError = assertPaddleApiConfigured();
    if (configError) return jsonError("Card checkout is not available right now.", 503);
    const environment = resolvePaddleEnvironment();
    const clientToken = getPaddleClientToken();
    if (!environment || !clientToken) return jsonError("Card checkout is not available right now.", 503);

    const service = createSupabaseServiceClient();
    if (!service) return jsonError("Checkout is not configured.", 503);

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return jsonError("Invalid request.");
    }

    const listingId = typeof body.listingId === "string" ? body.listingId : "";
    const requestedDate = typeof body.requestedDate === "string" ? body.requestedDate.trim() : "";
    const guestCount = Number(body.guestCount ?? 0);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

    if (!isUuid(listingId)) return jsonError("Listing id is required.");
    if (!bookableDate(requestedDate)) return jsonError("Choose a date today or later.");
    if (!Number.isInteger(guestCount) || guestCount < 1) return jsonError("Enter a valid group size.");
    if (!validEmail(email)) return jsonError("Enter an email for the receipt.");
    if (message.length > 1000) return jsonError("Keep your note under 1,000 characters.");
    if (!idempotencyKey || idempotencyKey.length > 200) return jsonError("Checkout could not be started. Try again.");

    const listing = await getPublicGuideListing(listingId).catch(() => null);
    if (!listing || listing.id.toLowerCase() !== listingId.toLowerCase()) {
        return jsonError("This experience is no longer available.");
    }
    if (guestCount > listing.max_guests) return jsonError("Check the group size for this experience.");

    const session = createSupabaseServerClient();
    const viewer = session ? (await session.auth.getUser()).data.user : null;
    if (viewer?.id === listing.seller_user_id) return jsonError("You cannot pay for your own experience.");

    let usdPerMajorUnit: number | null = null;
    const currency = listing.currency_code.toUpperCase();
    if (!PADDLE_PAYMENT_CURRENCIES[currency]) {
        if (!hasFxProvider()) {
            return jsonError(`${currency} cannot be charged directly, and a USD conversion is not available.`, 503);
        }
        const today = fxDate(new Date());
        const key = fxKey(currency, today);
        const rates = await getFxRates("USD", [{key, currency, date: today}]);
        usdPerMajorUnit = rates.rates[key] ?? null;
    }

    const quote = quoteGuideCheckout({
        amountMinor: listing.amount_minor,
        currencyCode: currency,
        guestCount,
        usdPerMajorUnit
    });
    if (!quote.ok) return jsonError(quote.error);

    const chargeLabel = formatGuidePrice(quote.chargeAmountMinor, quote.chargeCurrency, "en");
    const listedLabel = formatGuidePrice(quote.listedTotalMinor, quote.listedCurrency, "en");

    const {data: inserted, error: insertError} = await service
        .from("guide_web_checkouts")
        .insert({
            guide_listing_id: listing.id,
            seller_user_id: listing.seller_user_id,
            guest_email: email,
            requested_date: requestedDate,
            guest_count: guestCount,
            message: message || null,
            listed_currency: quote.listedCurrency,
            listed_total_minor: quote.listedTotalMinor,
            charge_currency: quote.chargeCurrency,
            charge_amount_minor: quote.chargeAmountMinor,
            fx_rate: quote.fxRate,
            status: "pending",
            idempotency_key: idempotencyKey
        })
        .select("id, status, paddle_transaction_id, charge_currency, charge_amount_minor, guest_email")
        .maybeSingle();

    let row = inserted as CheckoutRow | null;
    if (insertError) {
        const {data: existing} = await service
            .from("guide_web_checkouts")
            .select("id, status, paddle_transaction_id, charge_currency, charge_amount_minor, guest_email")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
        row = existing as CheckoutRow | null;
        if (!row) return jsonError(insertError.message, 500);
    }
    if (!row) return jsonError("Checkout could not be started.", 500);
    if (row.status === "paid" || row.status === "accepted") {
        return NextResponse.json({ok: true, alreadyPaid: true, chargeLabel, listedLabel});
    }
    if (row.status === "declined" || row.status === "refunded") {
        return jsonError("This checkout is already closed.");
    }
    if (row.status === "failed") {
        const {error: resetError} = await service
            .from("guide_web_checkouts")
            .update({
                status: "pending",
                guest_email: email,
                requested_date: requestedDate,
                guest_count: guestCount,
                message: message || null,
                listed_currency: quote.listedCurrency,
                listed_total_minor: quote.listedTotalMinor,
                charge_currency: quote.chargeCurrency,
                charge_amount_minor: quote.chargeAmountMinor,
                fx_rate: quote.fxRate,
                paddle_transaction_id: null
            })
            .eq("id", row.id)
            .eq("status", "failed");
        if (resetError) return jsonError("Checkout could not be started.", 500);
        row = {...row, status: "pending", paddle_transaction_id: null};
    }
    if (row.paddle_transaction_id) {
        return NextResponse.json({
            ok: true,
            environment,
            clientToken,
            transactionId: row.paddle_transaction_id,
            customerEmail: row.guest_email,
            chargeLabel,
            listedLabel,
            chargeCurrency: row.charge_currency
        });
    }

    const title = listing.title.replace(/\s+/g, " ").trim().slice(0, 80);
    let transactionId = "";
    try {
        const created = await paddleApiRequest<{data?: {id?: string}}>("/transactions", {
            method: "POST",
            body: JSON.stringify({
                items: [{
                    quantity: 1,
                    price: {
                        description: "Listed wildlife experience fee",
                        name: title || "Wildlife experience",
                        unit_price: {
                            amount: String(quote.chargeAmountMinor),
                            currency_code: quote.chargeCurrency
                        },
                        product: {
                            name: "AnimalDex wildlife experience",
                            tax_category: "standard",
                            description: "One-time fee for a guided wildlife outing. The Guide confirms the date after payment. Sightings are not guaranteed."
                        }
                    }
                }],
                currency_code: quote.chargeCurrency,
                custom_data: {
                    kind: "guide_experience",
                    checkout_id: row.id
                }
            })
        });
        transactionId = created.data?.id ?? "";
    } catch (error) {
        await service.from("guide_web_checkouts").update({status: "failed"}).eq("id", row.id).eq("status", "pending");
        const message = error instanceof Error ? error.message : "Checkout could not be started.";
        return jsonError(message, 502);
    }
    if (!transactionId.startsWith("txn_")) {
        await service.from("guide_web_checkouts").update({status: "failed"}).eq("id", row.id).eq("status", "pending");
        return jsonError("Checkout could not be started.", 502);
    }

    const {error: saveError} = await service
        .from("guide_web_checkouts")
        .update({paddle_transaction_id: transactionId})
        .eq("id", row.id)
        .eq("status", "pending");
    if (saveError) return jsonError("Checkout could not be started.", 500);

    return NextResponse.json({
        ok: true,
        environment,
        clientToken,
        transactionId,
        customerEmail: email,
        chargeLabel,
        listedLabel,
        chargeCurrency: quote.chargeCurrency
    });
}
