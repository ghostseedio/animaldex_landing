"use client";

import {trackEcommerceEvent, trackEvent} from "@/lib/analytics";
import {beginCheckoutParameters, checkoutStorage, rememberCompletedCheckout} from "@/lib/web-checkout-analytics";
import {openPaddleCheckout, type PaddleRuntimeEnvironment} from "@/lib/paddle-checkout";
import {splitLocalePath} from "@/lib/request-routing";
import {billingReturnHref, isProProductCode, localizedBillingReturnPath, type WebStoreProductCode} from "@/lib/web-store-catalog";
import {AppRequestError} from "@/lib/user-facing-error";

/**
 * Opens Paddle for one product (the web Credits and Pro flow). Lives here,
 * outside the authenticated app's components, so the Ask limit panel can
 * start a Pro checkout without pulling the app shell in; `PurchaseChoice`
 * re-exports it. `appReturnPath` is the page that started it
 * (`/app/credits`, the import page): the buyer comes back there, in the
 * language they were reading, once the webhook has added the purchase.
 */
export async function startWebCheckout(productCode: WebStoreProductCode, appReturnPath: string, source: string) {
    const returnPath = localizedBillingReturnPath(appReturnPath, window.location.pathname);
    trackEvent(isProProductCode(productCode) ? "web_pro_checkout_started" : "web_checkout_started", {
        product: productCode,
        source,
        provider: "paddle"
    });
    const response = await fetch("/api/app/billing/checkout", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({productCode, returnPath})
    });
    const payload = await response.json() as {
        environment?: PaddleRuntimeEnvironment;
        clientToken?: string;
        priceId?: string;
        purchaseId?: string;
        userId?: string;
        customerEmail?: string;
        error?: string;
    };
    if (!response.ok || !payload.clientToken || !payload.priceId || !payload.purchaseId) {
        throw new AppRequestError(response.status, payload.error ?? null);
    }
    if (payload.environment !== "production" && payload.environment !== "sandbox") {
        throw new AppRequestError(503, null);
    }
    return new Promise<"closed">((resolve, reject) => {
        void openPaddleCheckout({
            environment: payload.environment!,
            clientToken: payload.clientToken!,
            priceId: payload.priceId!,
            purchaseId: payload.purchaseId!,
            userId: payload.userId,
            customerEmail: payload.customerEmail,
            locale: splitLocalePath(window.location.pathname).locale,
            onLoaded(data) {
                trackEcommerceEvent("begin_checkout", {...beginCheckoutParameters(productCode, data), source});
            },
            onCompleted(data) {
                trackEvent("web_checkout_payment_ui_completed", {product: productCode, source, provider: "paddle"});
                // Kept for the return page, which reports the purchase once the webhook confirms it.
                rememberCompletedCheckout(checkoutStorage(), payload.purchaseId!, productCode, data);
                window.location.assign(billingReturnHref(payload.purchaseId!, returnPath));
            },
            onClosed() {
                trackEvent("web_checkout_cancelled", {product: productCode, source, provider: "paddle"});
                resolve("closed");
            }
        }).catch(reject);
    });
}
