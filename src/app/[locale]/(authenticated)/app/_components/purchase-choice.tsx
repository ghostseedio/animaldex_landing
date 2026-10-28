"use client";

import {useState} from "react";
import {trackEvent} from "@/lib/analytics";
import {useWebStoreAvailability} from "@/app/[locale]/(authenticated)/app/_components/web-store-availability";
import {openPaddleCheckout, type PaddleRuntimeEnvironment} from "@/lib/paddle-checkout";
import {splitLocalePath} from "@/lib/request-routing";
import {
    billingReturnHref,
    localizedBillingReturnPath,
    recommendCreditPack,
    WEB_STORE_PRODUCTS,
    type WebStoreProductCode
} from "@/lib/web-store-catalog";

/**
 * Opens Paddle for one product. `appReturnPath` is the page that started it
 * (`/app/credits`, the import page): the buyer comes back there, in the
 * language they were reading, once the webhook has added the purchase.
 */
export async function startWebCheckout(productCode: WebStoreProductCode, appReturnPath: string, source: string) {
    const returnPath = localizedBillingReturnPath(appReturnPath, window.location.pathname);
    trackEvent(productCode === "pro_upgrade" ? "web_pro_checkout_started" : "web_checkout_started", {
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
        throw new Error(payload.error || "Checkout could not start.");
    }
    if (payload.environment !== "production" && payload.environment !== "sandbox") {
        throw new Error("Checkout is not available.");
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
            onCompleted() {
                trackEvent("web_checkout_payment_ui_completed", {product: productCode, source, provider: "paddle"});
                window.location.assign(billingReturnHref(payload.purchaseId!, returnPath));
            },
            onClosed() {
                trackEvent("web_checkout_cancelled", {product: productCode, source, provider: "paddle"});
                resolve("closed");
            }
        }).catch(reject);
    });
}

export function PurchaseChoice({
    needed,
    balance,
    returnPath,
    source,
    onRefresh
}: {
    needed: number;
    balance: number;
    returnPath: string;
    source: string;
    onRefresh: () => void;
}) {
    const deficit = Math.max(0, needed - balance);
    const availability = useWebStoreAvailability();
    // The pack that covers the shortfall, or the other one when only it is on sale.
    const packs = (["purchase_25", "purchase_100"] as const).filter((code) => availability[code]);
    const preferred = recommendCreditPack(deficit);
    const recommended: WebStoreProductCode | null = availability[preferred] ? preferred : packs[0] ?? null;
    const proOnSale = availability.pro_upgrade;
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<WebStoreProductCode | null>(null);

    async function buy(code: WebStoreProductCode) {
        setBusy(code);
        setError(null);
        try {
            await startWebCheckout(code, returnPath, source);
            setBusy(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Checkout could not start.");
            setBusy(null);
        }
    }

    return (
        <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-white/70">
                You need {needed === 1 ? "1 Credit" : `${needed} Credits`} to continue.
                Balance: {balance === 1 ? "1 Credit" : `${balance} Credits`}
                {deficit > 0 ? ` · ${deficit} more needed` : ""}.
            </p>
            {recommended || proOnSale ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    {recommended ? (
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void buy(recommended)}
                            className="inline-flex min-h-11 items-center justify-center bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50"
                        >
                            {busy === recommended ? "Opening checkout…" : `Buy ${WEB_STORE_PRODUCTS[recommended].label}`}
                        </button>
                    ) : null}
                    {proOnSale ? (
                        <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void buy("pro_upgrade")}
                            className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                        >
                            {busy === "pro_upgrade" ? "Opening checkout…" : "Go Pro"}
                        </button>
                    ) : null}
                </div>
            ) : (
                <p className="text-sm leading-6 text-white/55">
                    Credits and Pro aren’t on sale on the website right now. You can get them in the AnimalDex app.
                </p>
            )}
            {proOnSale ? (
                <p className="text-xs leading-5 text-white/45">
                    Instagram Import is included with Pro, along with unlimited captures and 42 Credits every month.
                </p>
            ) : null}
            <div className="flex flex-wrap gap-3 text-sm font-bold">
                {packs.filter((code) => code !== recommended).map((code) => (
                    <button
                        key={code}
                        type="button"
                        className="text-primary-200"
                        disabled={Boolean(busy)}
                        onClick={() => void buy(code)}
                    >
                        See {WEB_STORE_PRODUCTS[code].label}
                    </button>
                ))}
                <button type="button" className="text-white/50" onClick={onRefresh}>
                    Refresh balance
                </button>
            </div>
            {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        </div>
    );
}
