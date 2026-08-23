"use client";

import {useEffect, useState} from "react";
import {
    EARNINGS_COPY,
    formatEarningsMinor,
    hasAnyEarningsBalance,
    type CreatorRewardReceiptSummary,
    type EarningEntry,
    type EarningsCurrencyBalance,
} from "@/lib/earnings";

type Payload = {
    balances: EarningsCurrencyBalance[];
    entries: EarningEntry[];
    creatorRewardReceipts: CreatorRewardReceiptSummary[];
};

export function EarningsClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/app/earnings", {cache: "no-store"});
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || "Failed to load Earnings");
                if (!cancelled) setData(json);
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

    const empty = !data || (!hasAnyEarningsBalance(data.balances) && data.entries.length === 0 && data.creatorRewardReceipts.length === 0);

    return (
        <main className="mx-auto min-h-screen max-w-3xl bg-black px-4 py-8 text-white">
            <h1 className="font-display text-3xl font-bold">Earnings</h1>
            <p className="mt-2 text-sm text-white/60">{EARNINGS_COPY.homeSupporting}</p>

            {loading && <p className="mt-10 text-white/50">Loading…</p>}
            {error && <p className="mt-10 text-sm text-white/60">{error}</p>}

            {!loading && !error && empty && (
                <section className="mt-10 space-y-3">
                    <h2 className="text-xl font-bold">{EARNINGS_COPY.emptyTitle}</h2>
                    <p className="text-sm text-white/60">{EARNINGS_COPY.emptyBody}</p>
                </section>
            )}

            {!loading && !error && data && !empty && (
                <div className="mt-8 space-y-8">
                    {data.balances.map((b) => (
                        <section key={b.currencyCode} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                            <p className="text-xs font-bold uppercase tracking-wide text-white/40">{b.currencyCode}</p>
                            <p className="mt-2 text-sm text-white/50">Available</p>
                            <p className="text-3xl font-bold tabular-nums">{formatEarningsMinor(b.availableAmountMinor, b.currencyCode)}</p>
                            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-white/40">Pending</p>
                                    <p className="font-semibold">{formatEarningsMinor(b.pendingAmountMinor, b.currencyCode)}</p>
                                </div>
                                <div>
                                    <p className="text-white/40">Held</p>
                                    <p className="font-semibold">{formatEarningsMinor(b.heldAmountMinor, b.currencyCode)}</p>
                                </div>
                                <div>
                                    <p className="text-white/40">Lifetime</p>
                                    <p className="font-semibold">{formatEarningsMinor(b.lifetimeEarnedAmountMinor, b.currencyCode)}</p>
                                </div>
                            </div>
                        </section>
                    ))}

                    {data.balances.some((b) => b.availableAmountMinor > 0) && (
                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs font-bold uppercase text-white/40">{EARNINGS_COPY.payoutsTitle}</p>
                            <p className="mt-1 font-semibold text-white/70">{EARNINGS_COPY.payoutsComingLater}</p>
                            <p className="mt-1 text-sm text-white/45">{EARNINGS_COPY.availableNoPayoutNote}</p>
                        </section>
                    )}

                    <section>
                        <h2 className="text-lg font-bold">Creator Rewards</h2>
                        {data.creatorRewardReceipts.length === 0 ? (
                            <p className="mt-2 text-sm text-white/50">Eligible Creator Rewards periods will appear here when AnimalDex runs them.</p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {data.creatorRewardReceipts.map((r) => (
                                    <li key={r.periodId} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                        <p className="font-semibold">{r.periodDisplayName}</p>
                                        <p className="text-sm text-white/50">{r.status} · {formatEarningsMinor(r.amountMinor, r.currencyCode)}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section>
                        <h2 className="text-lg font-bold">History</h2>
                        {data.entries.length === 0 ? (
                            <p className="mt-2 text-sm text-white/50">No Earnings history yet.</p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {data.entries.slice(0, 20).map((e) => (
                                    <li key={e.id} className="flex items-start justify-between gap-3 border-b border-white/5 py-3">
                                        <div>
                                            <p className="font-semibold">{e.displayLabel}</p>
                                            <p className="text-xs text-white/45">{e.sourceType} · {e.displayStatus}</p>
                                        </div>
                                        <p className="font-bold tabular-nums">{formatEarningsMinor(e.amountMinor, e.currencyCode)}</p>
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
