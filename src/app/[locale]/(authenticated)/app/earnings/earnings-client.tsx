"use client";

import {useEffect, useState} from "react";
import {
    EARNINGS_COPY,
    eligibilityTitle,
    formatEarningsMinor,
    hasAnyEarningsBalance,
    payoutChecklist,
    type CreatorRewardPeriodProgress,
    type CreatorRewardReceiptSummary,
    type EarningEntry,
    type EarningsCurrencyBalance,
} from "@/lib/earnings";

type PayoutSetup = {
    setupComplete?: boolean;
    payoutsEnabled?: boolean;
    canWithdraw?: boolean;
    maskedDestination?: string | null;
    setupProviderReady?: boolean;
    contactEmail?: string | null;
    destinationCountry?: string | null;
    reasonCodes?: string[];
    payoutSlaDays?: number;
    availableAmountMinor?: number;
    targetPayBy?: string | null;
    blockerTitle?: string | null;
    blockerDetail?: string | null;
    nextStep?: string | null;
};

type Payload = {
    balances: EarningsCurrencyBalance[];
    entries: EarningEntry[];
    creatorRewardReceipts: CreatorRewardReceiptSummary[];
    periodProgress?: CreatorRewardPeriodProgress | null;
    payoutSetup?: PayoutSetup | null;
};

function ProgressRing({fraction}: {fraction: number}) {
    const clamped = Math.min(1, Math.max(0, fraction));
    const r = 36;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - clamped);
    return (
        <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
                <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle
                    cx="44"
                    cy="44"
                    r={r}
                    fill="none"
                    stroke="#9AFF4A"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums">{Math.round(clamped * 100)}%</span>
                <span className="text-[10px] uppercase tracking-wide text-white/40">elapsed</span>
            </div>
        </div>
    );
}

function SignalBar({
    title,
    subtitle,
    count,
    target,
    fraction,
    active,
}: {
    title: string;
    subtitle: string;
    count: number;
    target: number;
    fraction: number;
    active: boolean;
}) {
    const fill = Math.min(100, Math.max(0, fraction * 100));
    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="text-xs text-white/40">{subtitle}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold tabular-nums ${active ? "text-white" : "text-white/40"}`}>
                    {count}/{target}
                </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                        active ? "bg-primary-500" : "bg-white/25"
                    }`}
                    style={{width: `${Math.max(fill, fill > 0 ? 4 : 0)}%`}}
                />
            </div>
        </div>
    );
}

export function EarningsClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);
    const [setupBusy, setSetupBusy] = useState(false);
    const [setupError, setSetupError] = useState<string | null>(null);
    const [accountHolderName, setAccountHolderName] = useState("");
    const [sortCode, setSortCode] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [legalCapacityAttested, setLegalCapacityAttested] = useState(false);

    async function reload() {
        const res = await fetch("/api/app/earnings", {cache: "no-store"});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load Earnings");
        setData(json);
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await reload();
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load Earnings");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const hasBalances = Boolean(data && hasAnyEarningsBalance(data.balances));
    const hasAvailable = Boolean(data?.balances.some((b) => b.availableAmountMinor > 0));
    const setup = data?.payoutSetup ?? null;
    const setupComplete = Boolean(setup?.setupComplete);
    const showPayoutCard = hasAvailable || setupComplete || showSetup;
    const progress = data?.periodProgress ?? null;
    const checklist = payoutChecklist(setup ?? {});
    const checklistDone = checklist.filter((i) => i.isComplete).length;
    const accent =
        progress?.eligibility.state === "participating" || progress?.eligibility.state === "period_closing";

    async function submitSetup(event: React.FormEvent) {
        event.preventDefault();
        setSetupBusy(true);
        setSetupError(null);
        try {
            const res = await fetch("/api/app/payouts/setup", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    countryCode: "GB",
                    currencyCode: "GBP",
                    accountHolderName,
                    sortCode,
                    accountNumber,
                    legalCapacityAttested,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Setup failed");
            setShowSetup(false);
            setAccountNumber("");
            setSortCode("");
            await reload();
        } catch (e) {
            setSetupError(e instanceof Error ? e.message : "Setup failed");
        } finally {
            setSetupBusy(false);
        }
    }

    return (
        <main className="mx-auto min-h-screen max-w-3xl bg-black px-4 py-8 text-white">
            <h1 className="font-display text-3xl font-bold">Earnings</h1>
            <p className="mt-2 text-sm text-white/60">{EARNINGS_COPY.homeSupporting}</p>

            {loading && <p className="mt-10 text-white/50">Loading…</p>}
            {error && <p className="mt-10 text-sm text-white/60">{error}</p>}

            {!loading && !error && data && (
                <div className="mt-8 space-y-6">
                    {progress && (
                        <>
                            <section
                                className={`rounded-2xl border p-5 ${
                                    accent
                                        ? "border-primary-500/35 bg-primary-500/10"
                                        : "border-white/10 bg-white/[0.04]"
                                }`}
                            >
                                <p className="text-xs font-bold uppercase tracking-wide text-white/40">
                                    Creator Rewards
                                </p>
                                <h2 className="mt-1 text-xl font-bold">
                                    {eligibilityTitle(progress.eligibility.state)}
                                </h2>
                                {progress.eligibility.message && (
                                    <p className="mt-2 text-sm text-white/60">{progress.eligibility.message}</p>
                                )}
                            </section>

                            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                {progress.period ? (
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                        <ProgressRing fraction={progress.period.timelineFraction ?? 0} />
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold">{progress.period.displayName}</p>
                                                    <p className="text-xs text-white/40">Reward period</p>
                                                </div>
                                                {progress.period.poolAmountMinor != null &&
                                                    progress.period.poolAmountMinor > 0 && (
                                                        <div className="text-right">
                                                            <p className="font-bold text-primary-500">
                                                                {formatEarningsMinor(
                                                                    progress.period.poolAmountMinor,
                                                                    progress.period.currencyCode,
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-white/40">Pool</p>
                                                        </div>
                                                    )}
                                            </div>
                                            <p className="text-sm text-white/55">
                                                {(progress.period.daysRemaining ?? 0) <= 0
                                                    ? "Ends soon"
                                                    : `${Math.round(progress.period.daysRemaining ?? 0)} days left`}
                                                {" · "}
                                                {progress.activity.liveCaptureCount} live captures
                                                {" · "}
                                                {progress.activity.uniqueSpeciesCount} species
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-semibold">No open reward period</p>
                                        <p className="mt-1 text-sm text-white/50">
                                            When AnimalDex opens the next period, your live captures and diversity
                                            will fill these meters.
                                        </p>
                                    </div>
                                )}
                            </section>

                            {progress.period && progress.signals.length > 0 && (
                                <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                    <div>
                                        <h2 className="text-lg font-bold">Your contribution signals</h2>
                                        <p className="mt-1 text-xs text-white/40">
                                            Visual progress only — not a payout estimate. Shares are calculated when
                                            the period ends.
                                        </p>
                                    </div>
                                    {progress.signals.map((s) => (
                                        <SignalBar
                                            key={s.key}
                                            title={s.title}
                                            subtitle={s.subtitle}
                                            count={s.count}
                                            target={s.target}
                                            fraction={s.fraction}
                                            active={s.active}
                                        />
                                    ))}
                                </section>
                            )}

                            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-lg font-bold">Payout readiness</h2>
                                    <span className="text-sm font-bold text-primary-500">
                                        {checklistDone}/{checklist.length}
                                    </span>
                                </div>
                                <div className="mt-3 flex gap-1.5">
                                    {checklist.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`h-1 flex-1 rounded-full ${
                                                item.isComplete ? "bg-primary-500" : "bg-white/15"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <ul className="mt-4 space-y-3">
                                    {checklist.map((item) => (
                                        <li key={item.id} className="flex gap-3">
                                            <span
                                                className={`mt-0.5 text-sm font-bold ${
                                                    item.isComplete ? "text-primary-500" : "text-white/35"
                                                }`}
                                            >
                                                {item.isComplete ? "✓" : "○"}
                                            </span>
                                            <div>
                                                <p className="font-semibold">{item.title}</p>
                                                <p className="text-xs text-white/45">{item.detail}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </>
                    )}

                    {hasBalances &&
                        data.balances.map((b) => (
                            <section key={b.currencyCode} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                <p className="text-xs font-bold uppercase tracking-wide text-white/40">{b.currencyCode}</p>
                                <p className="mt-2 text-sm text-white/50">Available</p>
                                <p className="text-3xl font-bold tabular-nums">
                                    {formatEarningsMinor(b.availableAmountMinor, b.currencyCode)}
                                </p>
                                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <p className="text-white/40">Pending</p>
                                        <p className="font-semibold">
                                            {formatEarningsMinor(b.pendingAmountMinor, b.currencyCode)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-white/40">Held</p>
                                        <p className="font-semibold">
                                            {formatEarningsMinor(b.heldAmountMinor, b.currencyCode)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-white/40">Lifetime</p>
                                        <p className="font-semibold">
                                            {formatEarningsMinor(b.lifetimeEarnedAmountMinor, b.currencyCode)}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        ))}

                    {showPayoutCard && (
                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs font-bold uppercase text-white/40">{EARNINGS_COPY.payoutsTitle}</p>
                            {setup?.blockerTitle && (!setupComplete || !setup?.payoutsEnabled) && (
                                <>
                                    <p className="mt-1 font-semibold text-white">{setup.blockerTitle}</p>
                                    {setup.blockerDetail && (
                                        <p className="mt-1 text-sm text-white/55">{setup.blockerDetail}</p>
                                    )}
                                </>
                            )}
                            {setupComplete ? (
                                <>
                                    <p className="mt-1 font-semibold text-white">{EARNINGS_COPY.payoutsReadyTitle}</p>
                                    {setup?.maskedDestination && (
                                        <p className="mt-1 text-sm text-white/60">{setup.maskedDestination}</p>
                                    )}
                                    {setup?.targetPayBy && (setup.availableAmountMinor ?? 0) > 0 ? (
                                        <p className="mt-2 text-sm font-semibold text-primary-400">
                                            Target pay by {setup.targetPayBy}
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-sm text-white/45">
                                            Ghostseed aims to pay within {setup?.payoutSlaDays ?? 14} days after
                                            your balance becomes Available. {EARNINGS_COPY.paymentModelNote}
                                        </p>
                                    )}
                                    {setup?.nextStep && (
                                        <p className="mt-2 text-sm text-white/55">{setup.nextStep}</p>
                                    )}
                                    {!setup?.payoutsEnabled && (
                                        <p className="mt-2 text-sm text-white/45">
                                            {EARNINGS_COPY.payoutsNotAvailableYet}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="mt-1 font-semibold text-white">{EARNINGS_COPY.setUpPayoutsTitle}</p>
                                    <p className="mt-1 text-sm text-white/55">{EARNINGS_COPY.setUpPayoutsBody}</p>
                                    {!showSetup && (
                                        <button
                                            type="button"
                                            className="mt-3 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-black text-canvas-950"
                                            onClick={() => setShowSetup(true)}
                                            disabled={!setup?.setupProviderReady}
                                        >
                                            {setup?.setupProviderReady
                                                ? EARNINGS_COPY.setUpPayoutsTitle
                                                : EARNINGS_COPY.payoutsNotAvailableYet}
                                        </button>
                                    )}
                                    {showSetup && setup?.setupProviderReady && (
                                        <form className="mt-4 space-y-3" onSubmit={submitSetup}>
                                            {setup.contactEmail && (
                                                <p className="text-xs text-white/45">Contact: {setup.contactEmail}</p>
                                            )}
                                            <p className="text-xs text-white/45">United Kingdom · GBP · Bank account</p>
                                            <p className="text-xs text-white/45">{EARNINGS_COPY.otherCountriesNote}</p>
                                            <input
                                                className="w-full rounded-xl border border-white/15 bg-black px-3 py-2 text-sm"
                                                placeholder="Account holder name"
                                                value={accountHolderName}
                                                onChange={(e) => setAccountHolderName(e.target.value)}
                                                required
                                            />
                                            <input
                                                className="w-full rounded-xl border border-white/15 bg-black px-3 py-2 text-sm"
                                                placeholder="Sort code"
                                                value={sortCode}
                                                onChange={(e) => setSortCode(e.target.value)}
                                                required
                                                autoComplete="off"
                                            />
                                            <input
                                                className="w-full rounded-xl border border-white/15 bg-black px-3 py-2 text-sm"
                                                placeholder="Account number"
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                                required
                                                autoComplete="off"
                                            />
                                            <label className="flex items-start gap-2 text-sm text-white/70">
                                                <input
                                                    type="checkbox"
                                                    checked={legalCapacityAttested}
                                                    onChange={(e) => setLegalCapacityAttested(e.target.checked)}
                                                />
                                                I confirm I am eligible to receive payouts for this account (age /
                                                capacity).
                                            </label>
                                            <p className="text-xs text-white/40">{EARNINGS_COPY.legalCapacityHint}</p>
                                            {setupError && <p className="text-sm text-rose-300">{setupError}</p>}
                                            <button
                                                type="submit"
                                                disabled={setupBusy || !legalCapacityAttested}
                                                className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-black text-canvas-950 disabled:opacity-50"
                                            >
                                                {setupBusy ? "Saving…" : "Confirm payout method"}
                                            </button>
                                        </form>
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {data.creatorRewardReceipts.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold">Reward receipts</h2>
                            <ul className="mt-3 space-y-2">
                                {data.creatorRewardReceipts.map((r) => (
                                    <li
                                        key={r.periodId}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                                    >
                                        <p className="font-semibold">{r.periodDisplayName}</p>
                                        <p className="text-sm text-white/50">
                                            {r.status} · {formatEarningsMinor(r.amountMinor, r.currencyCode)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section>
                        <h2 className="text-lg font-bold">History</h2>
                        {data.entries.length === 0 ? (
                            <p className="mt-2 text-sm text-white/50">No Earnings history yet.</p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {data.entries.slice(0, 20).map((e) => (
                                    <li
                                        key={e.id}
                                        className="flex items-start justify-between gap-3 border-b border-white/5 py-3"
                                    >
                                        <div>
                                            <p className="font-semibold">{e.displayLabel}</p>
                                            <p className="text-xs text-white/45">
                                                {e.sourceType} · {e.displayStatus}
                                            </p>
                                        </div>
                                        <p className="font-bold tabular-nums">
                                            {formatEarningsMinor(e.amountMinor, e.currencyCode)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            )}

            <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-bold">{EARNINGS_COPY.creditsAreSeparateTitle}</p>
                <p className="mt-1 text-sm text-white/55">{EARNINGS_COPY.creditsAreSeparateBody}</p>
                <p className="mt-3 text-sm text-white/45">{EARNINGS_COPY.giftsSignal}</p>
                <p className="mt-2 text-sm text-white/45">{EARNINGS_COPY.score}</p>
                <p className="mt-2 text-sm text-white/45">{EARNINGS_COPY.pool}</p>
            </section>
        </main>
    );
}
