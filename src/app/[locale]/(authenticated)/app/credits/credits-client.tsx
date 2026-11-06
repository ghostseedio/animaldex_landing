"use client";

import {useCallback, useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AppPage, AppPageHeader, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {useUserFacingError} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {AppRequestError} from "@/lib/user-facing-error";
import {creditBalanceLine, type CreditsWords} from "@/lib/credits-words";
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

/** iOS `CreditStoreSettingsRow`: a full-width row that leads somewhere. */
function StoreRow({href, title, subtitle}: {href: string; title: string; subtitle: string}) {
    return (
        <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04]">
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-white/45">{subtitle}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-white/35" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </Link>
    );
}

/** iOS `AnimalDexBandHeader`: an uppercase micro band, flush. */
function BandHeader({title}: {title: string}) {
    return <h2 className="px-4 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">{title}</h2>;
}

/**
 * Credits and Pro on the web, in the order the iOS store uses: Pro first and
 * recommended, then the Credit packs for someone who only needs a few. Pro
 * shows the yearly plan first and pre-selected, with its free trial when
 * Paddle's price has one; monthly second. With no yearly Price ID set, it is
 * monthly only, as before.
 */
export default function CreditsClient({account, packDetails, proPlans, words}: {
    account: CreditsAccount;
    words: CreditsWords;
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
    // Never the server's own text (iOS UserFacingError): offline, our side, or the action's line.
    const describeError = useUserFacingError();
    const planName = (code: ProPlanCode) => (code === "pro_annual" ? words.yearly : words.monthly);

    const refresh = useCallback(async () => {
        const response = await fetch("/api/app/billing/status", {cache: "no-store"});
        const payload = await response.json() as BillingStatus & {error?: string};
        if (!response.ok) throw new AppRequestError(response.status, payload.error ?? null);
        setStatus(payload);
        if (typeof payload.balance === "number") setBalance(payload.balance);
        return payload;
    }, [setBalance]);

    useEffect(() => {
        void refresh().catch((caught) => {
            setError(describeError(caught));
        });
    }, [refresh, describeError]);

    // Back from checkout: the return page only sends people here once the purchase is on the account.
    useEffect(() => {
        const billing = new URLSearchParams(window.location.search).get("billing");
        if (billing === "success") setNotice(words.purchaseDone);
        else if (billing === "cancel") setNotice(words.purchaseCancelled);
    }, [words.purchaseDone, words.purchaseCancelled]);

    async function buy(code: WebStoreProductCode) {
        setBusy(code);
        setError(null);
        try {
            await startWebCheckout(code, "/app/credits", "credits_page");
            setBusy(null);
        } catch (caught) {
            setError(describeError(caught));
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
                setNotice(words.manageApple);
                setBusy(null);
                return;
            }
            if (payload.code === "manage_on_google") {
                setNotice(words.manageGoogle);
                setBusy(null);
                return;
            }
            if (!response.ok || !payload.url) throw new AppRequestError(response.status, payload.error ?? null);
            window.location.assign(payload.url);
        } catch (caught) {
            setError(describeError(caught));
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

    const subscribedLine = provider === "paddle"
        ? words.subscribedWeb
        : provider === "apple"
            ? words.subscribedApple
            : provider === "google"
                ? words.subscribedGoogle
                : words.subscribedOther;

    return (
        <AppPage>
            {/* iOS hero: ANIMALDEX MEMBERSHIP, then what this page is for you. */}
            <AppPageHeader eyebrow={words.eyebrow} title={isPro ? words.titlePro : words.titleFree} description={isPro ? words.bodyPro : words.bodyFree} />
            <AppSurface>
                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">{words.yourAnimalDex}</p>
                <p className="mt-2 font-display text-3xl font-bold text-white" aria-live="polite">{creditBalanceLine(words, balance)}</p>
                <p className="mt-2 text-sm text-white/45">{words.creditsNote}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-2.5 text-sm font-bold text-white"
                        onClick={() => void refresh().then(() => setNotice(words.refreshed)).catch((caught) => setError(describeError(caught)))}
                    >
                        {words.refresh}
                    </button>
                </div>
            </AppSurface>

            {notice ? <p className="border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70" role="status">{notice}</p> : null}
            {error ? <p className="border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</p> : null}

            {account ? (
                <div className="border-l-2 border-primary-400/50 pl-4">
                    <p className="text-sm font-bold text-white">
                        {words.signedInAs.replace("{email}", account.email)}
                        {account.provider ? <span className="font-medium text-white/45"> · {account.provider}</span> : null}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/45">{words.purchasesGoHere}</p>
                </div>
            ) : null}
            {nothingOnSale && !isPro ? <p className="text-sm leading-6 text-white/55">{words.nothingOnSale}</p> : null}

            {isPro ? (
                // iOS `proActiveSection`: Your membership · AnimalDex Pro · MEMBERSHIP ACTIVE · benefits · Manage.
                <section id="pro" className="scroll-mt-24">
                    <BandHeader title={words.yourMembership} />
                    <AppSurface className="border-primary-400/30">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-display text-2xl font-bold text-white">AnimalDex Pro</h2>
                            <span className="bg-primary-400 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-black">{words.membershipActive}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/55">{subscribedLine}</p>
                        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                            {webStoreProBenefits(selected).map((benefit) => (
                                <li key={benefit.title} className="border-l border-white/10 pl-3">
                                    <p className="text-sm font-bold text-white/85">{benefit.title}</p>
                                    {benefit.detail ? <p className="mt-0.5 text-xs leading-5 text-white/45">{benefit.detail}</p> : null}
                                </li>
                            ))}
                        </ul>
                        {provider === "paddle" ? (
                            <div className="mt-6">
                                <button
                                    type="button"
                                    disabled={busy === "portal"}
                                    className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                                    onClick={() => void manageSubscription()}
                                >
                                    {busy === "portal" ? words.opening : words.manage}
                                </button>
                                <p className="mt-2 text-xs leading-5 text-white/45">{words.manageWeb}</p>
                            </div>
                        ) : (
                            <p className="mt-6 text-xs leading-5 text-white/45">{provider === "apple" ? words.manageApple : provider === "google" ? words.manageGoogle : words.manageWeb}</p>
                        )}
                    </AppSurface>
                </section>
            ) : (
                <section id="pro" className="scroll-mt-24">
                    <AppSurface className="border-primary-400/30">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">{words.membership}</p>
                            <span className="bg-primary-400 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-black">{words.recommended}</span>
                        </div>
                        <h2 className="mt-2 font-display text-3xl font-bold text-white">{WEB_STORE_PRODUCTS.pro_upgrade.label}</h2>
                        <p className="mt-2 text-sm leading-6 text-white/55">{pro.detail}</p>
                        {plansOnSale.length > 1 ? (
                            <div role="radiogroup" aria-label={words.choosePlan} className="mt-5 grid gap-3 sm:grid-cols-2">
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
                                                {planName(code)}
                                                {code === "pro_annual" && saving ? (
                                                    <span className="bg-primary-400 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-black">{words.save.replace("{percent}", String(saving))}</span>
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
                            disabled={Boolean(busy) || !availability[selected]}
                            onClick={() => void buy(selected)}
                            className="mt-6 inline-flex min-h-11 w-full items-center justify-center bg-primary-400 px-4 py-3 text-sm font-black text-black disabled:opacity-50 sm:w-auto sm:min-w-[14rem]"
                        >
                            {!availability[selected]
                                ? words.unavailable
                                : busy === selected
                                    ? words.openingCheckout
                                    : trial
                                        ? words.startTrial
                                        : words.goPro}
                        </button>
                        {trial && availability[selected] ? (
                            <p className="mt-3 text-xs leading-5 text-white/45">
                                {words.trialTerms.replace("{trial}", trial).replace("{price}", priceOf("pro_annual"))}
                            </p>
                        ) : null}
                    </AppSurface>
                </section>
            )}

            {/* iOS: Earn free Credits, between the membership and the packs. */}
            <section className="-mx-4 border-y border-white/[0.08] bg-[#141414] md:mx-0 md:border">
                <StoreRow href="/app/missions" title={words.earnTitle} subtitle={words.earnDetail} />
            </section>

            <section id="credits" className="scroll-mt-24">
                <h2 className="font-display text-2xl font-bold text-white">{words.packsTitle}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {CREDIT_PACKS.map((code) => {
                        const product = WEB_STORE_PRODUCTS[code];
                        const onSale = availability[code];
                        return (
                            <AppSurface key={code}>
                                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">{words.creditPack}</p>
                                <h3 className="mt-2 font-display text-2xl font-bold text-white">{product.label}</h3>
                                <p className="mt-2 text-sm leading-6 text-white/55">{packDetails?.[code] ?? product.detail}</p>
                                <p className="mt-3 text-sm font-bold text-white/80">{product.fallbackPrice}</p>
                                <button
                                    type="button"
                                    disabled={Boolean(busy) || !onSale}
                                    onClick={() => void buy(code)}
                                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center border border-white/15 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                                >
                                    {!onSale ? words.unavailable : busy === code ? words.openingCheckout : words.buy.replace("{label}", product.label)}
                                </button>
                            </AppSurface>
                        );
                    })}
                </div>
            </section>

            {/* iOS `accountSection`: Your account · Credit history. */}
            <section>
                <BandHeader title={words.yourAccount} />
                <div className="-mx-4 border-y border-white/[0.08] bg-[#141414] md:mx-0 md:border">
                    <StoreRow href="/app/credits/history" title={words.history} subtitle={words.historyDetail} />
                </div>
            </section>
        </AppPage>
    );
}
