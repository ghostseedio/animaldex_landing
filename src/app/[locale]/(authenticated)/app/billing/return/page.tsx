"use client";

import {Suspense, useEffect, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {AppPage, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {billingStatusIsServerFulfilled, localePrefixForPath, sanitizeBillingReturnPath} from "@/lib/web-store-catalog";
import {trackEvent} from "@/lib/analytics";

export const dynamic = "force-dynamic";

const PENDING_MESSAGE = "Payment received — your account is updating. This usually takes a few seconds.";
const CANCELLED_MESSAGE = "Checkout cancelled. You haven't been charged.";
const POLL_ATTEMPTS = 12;

/**
 * Where Paddle's overlay sends a buyer after payment. It waits for the webhook
 * to add the purchase (browser completion is never proof), then goes back to
 * the page that started checkout (`return`, or the path stored with the
 * purchase). Every product comes through here, so the copy is about the
 * account, not about any one page.
 */
function BillingReturnInner() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    // setBalance alone: the context value is new on every frame of the
    // balance animation, and depending on it would restart the polling.
    const {setBalance} = useAppCredits();
    const localePrefix = localePrefixForPath(pathname);
    const status = searchParams.get("status");
    const purchaseId = searchParams.get("purchase_id");
    const returnPath = sanitizeBillingReturnPath(searchParams.get("return"), localePrefix);
    const [phase, setPhase] = useState<"updating" | "pending">("updating");
    // Each Refresh starts another round of checks.
    const [round, setRound] = useState(0);

    useEffect(() => {
        if (status === "cancel") {
            trackEvent("web_checkout_cancelled", {source: "billing_return", provider: "paddle"});
            const timer = window.setTimeout(() => router.replace(`${returnPath}?billing=cancel`), 1200);
            return () => window.clearTimeout(timer);
        }
        if (status !== "success" || !purchaseId) {
            router.replace(returnPath);
            return;
        }

        setPhase("updating");
        let stopped = false;
        let attempts = 0;
        let timer = 0;
        const poll = async () => {
            attempts += 1;
            try {
                const response = await fetch(`/api/app/billing/status?purchase_id=${encodeURIComponent(purchaseId)}`, {cache: "no-store"});
                const payload = await response.json() as {
                    fulfilled?: boolean;
                    balance?: number;
                    is_pro?: boolean;
                    return_path?: string;
                };
                if (stopped) return;
                if (typeof payload.balance === "number") setBalance(payload.balance);
                if (billingStatusIsServerFulfilled(payload)) {
                    trackEvent(payload.is_pro ? "web_pro_activated" : "web_checkout_completed_server_confirmed", {
                        source: "billing_return",
                        pro: Boolean(payload.is_pro),
                        provider: "paddle"
                    });
                    const next = sanitizeBillingReturnPath(payload.return_path || returnPath, localePrefix);
                    const confirmed = new URLSearchParams({billing: "success", purchase_id: purchaseId});
                    router.replace(`${next}?${confirmed.toString()}`);
                    return;
                }
            } catch {
                // Keep checking until the bound is reached.
            }
            if (stopped) return;
            if (attempts >= POLL_ATTEMPTS) {
                setPhase("pending");
                return;
            }
            timer = window.setTimeout(() => void poll(), Math.min(4000, 400 * attempts));
        };
        void poll();
        return () => {
            stopped = true;
            window.clearTimeout(timer);
        };
    }, [localePrefix, purchaseId, returnPath, round, router, setBalance, status]);

    const cancelled = status === "cancel";

    return (
        <AppPage>
            <AppSurface className="flex min-h-[24rem] flex-col items-center justify-center px-6 py-16 text-center">
                <h1 className="font-display text-3xl font-bold text-white">
                    {cancelled ? "Checkout cancelled" : "Updating your account"}
                </h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-white/60" role="status" aria-live="polite">
                    {cancelled ? CANCELLED_MESSAGE : PENDING_MESSAGE}
                </p>
                {!cancelled && phase === "pending" ? (
                    <button
                        type="button"
                        onClick={() => setRound((value) => value + 1)}
                        className="mt-6 inline-flex min-h-11 items-center justify-center border border-white/15 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/30"
                    >
                        Refresh
                    </button>
                ) : null}
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
