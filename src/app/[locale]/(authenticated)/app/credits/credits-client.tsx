"use client";

import {useCallback, useEffect, useState} from "react";
import {AppPage, AppPageHeader, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {startWebCheckout} from "@/app/[locale]/(authenticated)/app/_components/purchase-choice";
import {WEB_STORE_PRODUCTS, WEB_STORE_PRO_BENEFITS, type WebStoreProductCode} from "@/lib/web-store-catalog";

type BillingStatus = {
    balance?: number;
    is_pro?: boolean;
    pro_provider?: string;
};

export default function CreditsClient() {
    const credits = useAppCredits();
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [busy, setBusy] = useState<WebStoreProductCode | "portal" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        const response = await fetch("/api/app/billing/status", {cache: "no-store"});
        const payload = await response.json() as BillingStatus & {error?: string};
        if (!response.ok) throw new Error(payload.error || "Could not refresh Credits.");
        setStatus(payload);
        if (typeof payload.balance === "number") credits.setBalance(payload.balance);
        return payload;
    }, [credits]);

    useEffect(() => {
        void refresh().catch((caught) => {
            setError(caught instanceof Error ? caught.message : "Could not load Credits.");
        });
    }, [refresh]);

    async function buy(code: WebStoreProductCode) {
        setBusy(code);
        setError(null);
        try {
            await startWebCheckout(code, "/app/credits", "credits_page");
            setBusy(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Checkout could not start.");
            setBusy(null);
        }
    }

    async function manageSubscription() {
        setBusy("portal");
        setError(null);
        try {
            const response = await fetch("/api/app/billing/portal", {method: "POST"});
            const payload = await response.json() as {url?: string; error?: string; code?: string};
            if (payload.code === "manage_on_apple") {
                setNotice("Manage this subscription in the App Store on your iPhone.");
                setBusy(null);
                return;
            }
            if (payload.code === "manage_on_google") {
                setNotice("Manage this subscription in Google Play on your Android device.");
                setBusy(null);
                return;
            }
            if (!response.ok || !payload.url) throw new Error(payload.error || "Could not open subscription management.");
            window.location.assign(payload.url);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not open subscription management.");
            setBusy(null);
        }
    }

    const provider = status?.pro_provider ?? "none";
    const isPro = Boolean(status?.is_pro);
    const balance = status?.balance ?? credits.displayBalance;

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Credits"
                title="Credits and Pro"
                description="Buy Credits or AnimalDex Pro on the website. The same balance and Pro status appear in the iOS and Android apps."
            />
            <AppSurface>
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Your AnimalDex</p>
                <p className="mt-2 font-display text-3xl font-bold text-white" aria-live="polite">
                    {isPro ? "Pro active" : `${balance === 1 ? "1 Credit" : `${balance} Credits`}`}
                </p>
                <p className="mt-2 text-sm text-white/45">
                    {isPro
                        ? provider === "paddle"
                            ? "Subscribed on the web."
                            : provider === "apple"
                                ? "Subscribed through the App Store."
                                : provider === "google"
                                    ? "Subscribed through Google Play."
                                    : "AnimalDex Pro is active on this account."
                        : "Credits are in-app currency and cannot be withdrawn for cash."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white"
                        onClick={() => void refresh().then(() => setNotice("Balance refreshed.")).catch((caught) => setError(caught instanceof Error ? caught.message : "Refresh failed."))}
                    >
                        Refresh balance
                    </button>
                    {isPro && provider === "paddle" ? (
                        <button
                            type="button"
                            disabled={busy === "portal"}
                            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                            onClick={() => void manageSubscription()}
                        >
                            {busy === "portal" ? "Opening…" : "Manage subscription"}
                        </button>
                    ) : null}
                </div>
            </AppSurface>

            {notice ? <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70" role="status">{notice}</p> : null}
            {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</p> : null}

            <div className="grid gap-4 md:grid-cols-3">
                {(Object.keys(WEB_STORE_PRODUCTS) as WebStoreProductCode[]).map((code) => {
                    const product = WEB_STORE_PRODUCTS[code];
                    const disabled = Boolean(busy) || (code === "pro_upgrade" && isPro);
                    return (
                        <AppSurface key={code}>
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">
                                {product.kind === "pro" ? "Membership" : "Credit pack"}
                            </p>
                            <h2 className="mt-2 font-display text-2xl font-bold text-white">{product.label}</h2>
                            <p className="mt-2 text-sm leading-6 text-white/55">{product.detail}</p>
                            <p className="mt-3 text-sm font-bold text-white/80">{product.fallbackPrice}</p>
                            {code === "pro_upgrade" ? (
                                <ul className="mt-4 space-y-1 text-sm text-white/50">
                                    {WEB_STORE_PRO_BENEFITS.map((item) => <li key={item}>{item}</li>)}
                                </ul>
                            ) : null}
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => void buy(code)}
                                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50"
                            >
                                {code === "pro_upgrade" && isPro
                                    ? "Already Pro"
                                    : busy === code
                                        ? "Opening checkout…"
                                        : code === "pro_upgrade"
                                            ? "Go Pro"
                                            : `Buy ${product.label}`}
                            </button>
                        </AppSurface>
                    );
                })}
            </div>
        </AppPage>
    );
}
