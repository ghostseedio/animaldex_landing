"use client";

import {Suspense, useEffect, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {AppPage, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {billingStatusIsServerFulfilled, sanitizeBillingReturnPath} from "@/lib/web-store-catalog";
import {trackEvent} from "@/lib/analytics";

export const dynamic = "force-dynamic";

function BillingReturnInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const credits = useAppCredits();
    const status = searchParams.get("status");
    const purchaseId = searchParams.get("purchase_id");
    const canceledReturn = sanitizeBillingReturnPath(searchParams.get("return"));
    const [message, setMessage] = useState(
        status === "cancel"
            ? "Payment cancelled. Your Instagram import is still here."
            : "Payment received — updating your AnimalDex…"
    );

    useEffect(() => {
        if (status === "cancel") {
            trackEvent("web_checkout_cancelled", {source: "billing_return", provider: "paddle"});
            const timer = window.setTimeout(() => router.replace(`${canceledReturn}?billing=cancel`), 900);
            return () => window.clearTimeout(timer);
        }
        if (status !== "success" || !purchaseId) {
            router.replace("/app/import/instagram");
            return;
        }

        let stopped = false;
        let attempts = 0;
        const poll = async () => {
            attempts += 1;
            try {
                const response = await fetch(`/api/app/billing/status?purchase_id=${encodeURIComponent(purchaseId)}`);
                const payload = await response.json() as {
                    fulfilled?: boolean;
                    balance?: number;
                    is_pro?: boolean;
                    return_path?: string;
                };
                if (stopped) return;
                if (typeof payload.balance === "number") credits.setBalance(payload.balance);
                if (billingStatusIsServerFulfilled(payload)) {
                    trackEvent(payload.is_pro ? "web_pro_activated" : "web_checkout_completed_server_confirmed", {
                        source: "billing_return",
                        pro: Boolean(payload.is_pro),
                        provider: "paddle"
                    });
                    const next = sanitizeBillingReturnPath(payload.return_path);
                    const confirmed = new URLSearchParams({billing: "success", purchase_id: purchaseId});
                    router.replace(`${next}?${confirmed.toString()}`);
                    return;
                }
            } catch {
                // Keep polling until the bound is reached.
            }
            if (attempts >= 12) {
                setMessage("Your payment was received, but your balance is still updating. You can refresh from Import.");
                const fallback = sanitizeBillingReturnPath(canceledReturn);
                window.setTimeout(() => router.replace(`${fallback}?billing=pending`), 1600);
                return;
            }
            window.setTimeout(() => void poll(), Math.min(4000, 400 * attempts));
        };
        void poll();
        return () => {
            stopped = true;
        };
    }, [canceledReturn, credits, purchaseId, router, status]);

    return (
        <AppPage>
            <AppSurface className="flex min-h-[24rem] flex-col items-center justify-center px-6 py-16 text-center">
                <h1 className="font-display text-3xl font-bold text-white">
                    {status === "cancel" ? "Checkout cancelled" : "Updating AnimalDex"}
                </h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/60" role="status" aria-live="polite">
                    {message}
                </p>
            </AppSurface>
        </AppPage>
    );
}

export default function BillingReturnPage() {
    return (
        <Suspense fallback={null}>
            <BillingReturnInner />
        </Suspense>
    );
}
