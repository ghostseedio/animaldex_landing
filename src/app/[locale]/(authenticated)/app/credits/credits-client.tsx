"use client";

import {useCallback, useEffect, useState} from "react";
import {AppPage, AppPageHeader, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {useAppCredits} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {startWebCheckout} from "@/app/[locale]/(authenticated)/app/_components/purchase-choice";
import {useWebStoreAvailability} from "@/app/[locale]/(authenticated)/app/_components/web-store-availability";
import {annualSavingPercent, type ProPlanCode, type ProPlanPrice} from "@/lib/paddle-prices";
import {WEB_STORE_PRO_PLANS, WEB_STORE_PRODUCTS, webStoreProBenefits, type WebStoreProductCode} from "@/lib/web-store-catalog";

type BillingStatus = {
    balance?: number;
    is_pro?: boolean;
    pro_provider?: string;
};

export type CreditsAccount = {email: string; provider: string | null} | null;

const CREDIT_PACKS = ["purchase_25", "purchase_100"] as const;
const UNAVAILABLE_LABEL = "Not available right now";
const PLAN_NAMES: Record<ProPlanCode, string> = {pro_annual: "Yearly", pro_upgrade: "Monthly"};

/**
 * Credits and Pro on the web, in the order the iOS store uses: Pro first and
 * recommended, then the Credit packs for someone who only needs a few. Pro
 * shows the yearly plan first and pre-selected, with its free trial when
 * Paddle's price has one; monthly second. With no yearly Price ID set, it is
 * monthly only, as before.
 */
export default function CreditsClient({account, packDetails, proPlans}: {
    account: CreditsAccount;
    /** Each pack's line in the reader's language; the catalog's English otherwise. */
    packDetails?: Partial<Record<WebStoreProductCode, string>>;
    /** Paddle's price and trial for each Pro plan (src/lib/paddle-prices.ts); missing ones show the catalog price. */
    proPlans?: Partial<Record<ProPlanCode, ProPlanPrice>>;
}) {
    // setBalance alone: the context value is new on every frame of the
    // balance animation, and depending on it would refetch on every frame.
    const {setBalance, displayBalance} = useAppCredits();
    const availability = useWebStoreAvailability();
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [busy, setBusy] = useState<WebStoreProductCode | "portal" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [plan, setPlan] = useState<ProPlanCode>("pro_annual");

    const refresh = useCallback(async () => {
        const response = await fetch("/api/app/billing/status", {cache: "no-store"});
        const payload = await response.json() as BillingStatus & {error?: string};
        if (!response.ok) throw new Error(payload.error || "Could not refresh Credits.");
        setStatus(payload);
        if (typeof payload.balance === "number") setBalance(payload.balance);
        return payload;
    }, [setBalance]);

    useEffect(() => {
        void refresh().catch((caught) => {
            setError(caught instanceof Error ? caught.message : "Could not load Credits.");
        });
    }, [refresh]);

    // Back from checkout: the return page only sends people here once the purchase is on the account.
    useEffect(() => {
        const billing = new URLSearchParams(window.location.search).get("billing");
        if (billing === "success") setNotice("Thank you. Your purchase is on your account.");
        else if (billing === "cancel") setNotice("Checkout cancelled. You haven't been charged.");
    }, []);

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
    const balance = status?.balance ?? displayBalance;
    const plansOnSale = WEB_STORE_PRO_PLANS.filter((code) => availability[code]);
    // Yearly is pre-selected; with only one plan on sale, that one.
    const selected: ProPlanCode = availability[plan] ? plan : plansOnSale[0] ?? "pro_upgrade";
    const pro = WEB_STORE_PRODUCTS[selected];
    const priceOf = (code: ProPlanCode) => proPlans?.[code]?.display ?? WEB_STORE_PRODUCTS[code].fallbackPrice;
    const trial = selected === "pro_annual" ? proPlans?.pro_annual?.trialLabel ?? null : null;
    const saving = annualSavingPercent(proPlans?.pro_upgrade, proPlans?.pro_annual);
    const nothingOnSale = plansOnSale.length === 0 && CREDIT_PACKS.every((code) => !availability[code]);

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
                        className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-2.5 text-sm font-bold text-white"
                        onClick={() => void refresh().then(() => setNotice("Balance refreshed.")).catch((caught) => setError(caught instanceof Error ? caught.message : "Refresh failed."))}
                    >
                        Refresh balance
                    </button>
                    {isPro && provider === "paddle" ? (
                        <button
                            type="button"
                            disabled={busy === "portal"}
                            className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                            onClick={() => void manageSubscription()}
                        >
                            {busy === "portal" ? "Opening…" : "Manage subscription"}
                        </button>
                    ) : null}
                </div>
            </AppSurface>

            {notice ? <p className="border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70" role="status">{notice}</p> : null}
            {error ? <p className="border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</p> : null}

            {account ? (
                <div className="border-l-2 border-primary-400/50 pl-4">
                    <p className="text-sm font-bold text-white">
                        Signed in as {account.email}
                        {account.provider ? <span className="font-medium text-white/45"> · {account.provider}</span> : null}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                        Purchases go to this account. To see them in the app, sign in there the same way.
                    </p>
                </div>
            ) : null}
            {nothingOnSale ? (
                <p className="text-sm leading-6 text-white/55">
                    Credits and Pro aren’t on sale on the website right now. You can get them in the AnimalDex app.
                </p>
            ) : null}

            <section id="pro" className="scroll-mt-24">
                <AppSurface className="border-primary-400/30">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Membership</p>
                        {isPro ? null : (
                            <span className="bg-primary-400 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-black">
                                Recommended
                            </span>
                        )}
                    </div>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white">{WEB_STORE_PRODUCTS.pro_upgrade.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/55">{pro.detail}</p>
                    {plansOnSale.length > 1 && !isPro ? (
                        <div role="radiogroup" aria-label="Choose a plan" className="mt-5 grid gap-3 sm:grid-cols-2">
                            {plansOnSale.map((code) => {
                                const active = code === selected;
                                const planTrial = code === "pro_annual" ? proPlans?.pro_annual?.trialLabel ?? null : null;
                                return (
                                    <button
                                        key={code}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setPlan(code)}
                                        className={`flex flex-col items-start gap-1 border px-4 py-3 text-left transition ${active ? "border-primary-400 bg-primary-400/10" : "border-white/15 hover:border-white/35"}`}
                                    >
                                        <span className="flex flex-wrap items-center gap-2 text-sm font-black text-white">
                                            {PLAN_NAMES[code]}
                                            {code === "pro_annual" && saving ? (
                                                <span className="bg-primary-400 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-black">Save {saving}%</span>
                                            ) : null}
                                        </span>
                                        <span className="text-sm text-white/80">{priceOf(code)}</span>
                                        {planTrial ? <span className="text-xs font-bold text-primary-200">{planTrial}</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="mt-3 text-sm font-bold text-white/80">{priceOf(selected)}{trial ? ` · ${trial}` : ""}</p>
                    )}
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                        {webStoreProBenefits(selected).map((benefit) => (
                            <li key={benefit.title} className="border-l border-white/10 pl-3">
                                <p className="text-sm font-bold text-white/85">{benefit.title}</p>
                                {benefit.detail ? <p className="mt-0.5 text-xs leading-5 text-white/45">{benefit.detail}</p> : null}
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        disabled={Boolean(busy) || isPro || !availability[selected]}
                        onClick={() => void buy(selected)}
                        className="mt-6 inline-flex min-h-11 w-full items-center justify-center bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50 sm:w-auto sm:min-w-[14rem]"
                    >
                        {isPro
                            ? "Already Pro"
                            : !availability[selected]
                                ? UNAVAILABLE_LABEL
                                : busy === selected
                                    ? "Opening checkout…"
                                    : trial
                                        ? "Start free trial"
                                        : "Go Pro"}
                    </button>
                    {trial && !isPro && availability[selected] ? (
                        <p className="mt-3 text-xs leading-5 text-white/45">
                            {trial}, then {priceOf("pro_annual")}. Cancel before the trial ends and you won&apos;t be charged.
                        </p>
                    ) : null}
                </AppSurface>
            </section>

            <section id="credits" className="scroll-mt-24">
                <h2 className="font-display text-2xl font-bold text-white">Just need a few credits?</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {CREDIT_PACKS.map((code) => {
                        const product = WEB_STORE_PRODUCTS[code];
                        const onSale = availability[code];
                        return (
                            <AppSurface key={code}>
                                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Credit pack</p>
                                <h3 className="mt-2 font-display text-2xl font-bold text-white">{product.label}</h3>
                                <p className="mt-2 text-sm leading-6 text-white/55">{packDetails?.[code] ?? product.detail}</p>
                                <p className="mt-3 text-sm font-bold text-white/80">{product.fallbackPrice}</p>
                                <button
                                    type="button"
                                    disabled={Boolean(busy) || !onSale}
                                    onClick={() => void buy(code)}
                                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center border border-white/15 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                                >
                                    {!onSale
                                        ? UNAVAILABLE_LABEL
                                        : busy === code
                                            ? "Opening checkout…"
                                            : `Buy ${product.label}`}
                                </button>
                            </AppSurface>
                        );
                    })}
                </div>
            </section>
        </AppPage>
    );
}
