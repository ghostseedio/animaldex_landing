"use client";

import Link from "next/link";
import {useEffect, useState} from "react";

type Diagnostics = {
    animaldexEnvironment: string;
    isProduction: boolean;
    payoutsEnabled: boolean;
    autoPayoutEnabled: boolean;
    wiseCredentialsConfigured: boolean;
    wiseEnvironment: string | null;
    wiseProfileBound: boolean;
    wiseBalanceBound?: boolean;
    webhookPublicKeyConfigured: boolean;
    banner: string;
    phase7cStopReason?: string | null;
    legalEntityName?: string;
};

type PayoutRow = {
    payoutId: string;
    userId: string;
    currencyCode: string;
    amountMinor: number;
    status: string;
    provider: string;
    environment: string;
    providerTransferRef: string | null;
    providerStatus: string | null;
    failureCode: string | null;
};

type ReadinessRow = {
    user_id: string;
    username: string | null;
    display_name: string | null;
    currency_code: string;
    available_amount_minor: number;
    pending_amount_minor: number;
    held_amount_minor: number;
    paid_amount_minor: number;
    setup_complete: boolean;
    masked_destination: string | null;
    payout_profile_status: string;
    target_pay_by: string | null;
    days_until_due: number | null;
    next_admin_step: string;
    beta_member: boolean;
};

type Readiness = {
    payouts_enabled?: boolean;
    auto_payout_enabled?: boolean;
    payout_sla_days?: number;
    how_to_pay?: string[];
    rows?: ReadinessRow[];
};

function money(minor: number, currency: string) {
    return `${currency} ${(Number(minor) / 100).toFixed(2)}`;
}

export function AdminPayoutsClient() {
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [payouts, setPayouts] = useState<PayoutRow[]>([]);
    const [readiness, setReadiness] = useState<Readiness | null>(null);
    const [blocked, setBlocked] = useState(false);
    const [blockedReason, setBlockedReason] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function load() {
        setError(null);
        const res = await fetch("/api/admin/payouts", {cache: "no-store"});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setDiagnostics(json.diagnostics);
        setPayouts(json.payouts || []);
        setReadiness(json.readiness || null);
        setBlocked(Boolean(json.blocked));
        setBlockedReason(typeof json.blockedReason === "string" ? json.blockedReason : null);
    }

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }, []);

    async function run(action: string, payoutId: string) {
        const amountHint = payouts.find((p) => p.payoutId === payoutId);
        const confirmed = window.confirm(
            [
                diagnostics?.isProduction ? "PRODUCTION — REAL MONEY" : "SANDBOX",
                `Action: ${action}`,
                `Payout: ${payoutId}`,
                amountHint
                    ? `Amount: ${money(amountHint.amountMinor, amountHint.currencyCode)}`
                    : null,
                "Named finance operator required. Shared password alone cannot approve.",
                "Continue?",
            ]
                .filter(Boolean)
                .join("\n")
        );
        if (!confirmed) return;
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/admin/payouts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action, payoutId}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Action failed");
            setMessage(JSON.stringify(json.result ?? json));
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Action failed");
        } finally {
            setBusy(false);
        }
    }

    const rows = readiness?.rows || [];

    return (
        <main className="min-h-screen bg-canvas-950 px-6 py-8 text-ink-100">
            <Link href="/admin" className="text-sm text-ink-400 hover:text-white">
                ← Admin
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl text-white">Payouts</h1>
                <span
                    className={`rounded-md px-2.5 py-1 text-xs font-black tracking-wide text-white ${
                        diagnostics?.isProduction ? "bg-rose-700" : "bg-emerald-700"
                    }`}
                >
                    {diagnostics?.isProduction ? "PRODUCTION — REAL MONEY" : "WISE SANDBOX"}
                </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-ink-400">
                Ghostseed Ltd pays creators from Available Earnings via Wise. Payouts are{" "}
                <strong className="text-ink-200">never automatic</strong>. Target SLA:{" "}
                {readiness?.payout_sla_days ?? 14} days after balance becomes Available.
            </p>

            {diagnostics && (
                <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
                    <p className="font-bold text-white">{diagnostics.banner}</p>
                    <p className="mt-1 text-sm text-ink-300">
                        AnimalDex={diagnostics.animaldexEnvironment} · payouts_enabled=
                        {String(diagnostics.payoutsEnabled)} · auto_payout=
                        {String(diagnostics.autoPayoutEnabled)} · credentials=
                        {String(diagnostics.wiseCredentialsConfigured)} · profile=
                        {String(diagnostics.wiseProfileBound)} · balance=
                        {String(Boolean(diagnostics.wiseBalanceBound))} · webhook=
                        {String(diagnostics.webhookPublicKeyConfigured)}
                    </p>
                </div>
            )}

            <section className="mt-8 rounded-2xl border border-line-300 px-4 py-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">
                    How to pay a creator
                </h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-300">
                    {(readiness?.how_to_pay?.length
                        ? readiness.how_to_pay
                        : [
                              "Confirm Available Earnings (not Credits).",
                              "Confirm bank destination setup (masked only).",
                              "Create payout request → named finance approves.",
                              "System reserves → Wise quote/transfer/fund.",
                              "Paid only after Wise outgoing_payment_sent.",
                          ]
                    ).map((step) => (
                        <li key={step}>{step}</li>
                    ))}
                </ol>
                <p className="mt-3 text-xs text-ink-500">
                    Creator Rewards allocations are prepared on{" "}
                    <Link href="/admin/creator-rewards" className="text-white underline-offset-2 hover:underline">
                        /admin/creator-rewards
                    </Link>
                    . This page is the bank rail.
                </p>
            </section>

            {blocked && (
                <p className="mt-4 text-sm text-rose-300">
                    {blockedReason ||
                        "Production payout execution is gated until Wise GBP is funded and Phase 7C gates pass."}
                </p>
            )}

            {diagnostics?.autoPayoutEnabled && (
                <p className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    Warning: <code>auto_payout_enabled=true</code> on this environment. Product policy is manual
                    finance approval only — turn this off unless you intentionally changed ops policy.
                </p>
            )}

            <p className="mt-4 text-xs text-ink-500">
                Bank corridor live today: <strong className="text-ink-200">United Kingdom · GBP · Wise</strong>.
                Other countries can earn Creator Rewards; payout destination setup opens when their corridor is
                enabled. This page stays empty until Creator Rewards are Finalized → Posted and balances become
                Available.
            </p>

            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-4 break-all text-sm text-emerald-300">{message}</p>}

            <section className="mt-8">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">
                    Who needs paying / setup
                </h2>
                <p className="mt-1 text-xs text-ink-500">
                    Available balances, bank setup status, and SLA due dates. No raw bank details.
                </p>
                <div className="mt-3 overflow-x-auto rounded-2xl border border-line-300">
                    {rows.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-ink-500">
                            No Earnings balances yet. Post Creator Rewards to Earnings first.
                        </p>
                    ) : (
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-white/5 text-xs uppercase tracking-wide text-ink-400">
                                <tr>
                                    <th className="px-3 py-2">Creator</th>
                                    <th className="px-3 py-2">Available</th>
                                    <th className="px-3 py-2">Bank setup</th>
                                    <th className="px-3 py-2">Pay by</th>
                                    <th className="px-3 py-2">Next step</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={`${r.user_id}-${r.currency_code}`} className="border-t border-white/10">
                                        <td className="px-3 py-2 text-white">
                                            {r.display_name || r.username || r.user_id.slice(0, 8)}
                                            <span className="block text-xs text-ink-500">
                                                {r.beta_member ? "beta" : "not beta"} · {r.currency_code}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 tabular-nums">
                                            {money(r.available_amount_minor, r.currency_code)}
                                            <span className="block text-xs text-ink-500">
                                                pending {money(r.pending_amount_minor, r.currency_code)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {r.setup_complete ? (
                                                <span className="text-emerald-300">
                                                    {r.masked_destination || "Ready"}
                                                </span>
                                            ) : (
                                                <span className="text-amber-200">Needs bank details</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-ink-300">
                                            {r.target_pay_by
                                                ? `${r.target_pay_by}${
                                                      typeof r.days_until_due === "number"
                                                          ? ` (${r.days_until_due}d)`
                                                          : ""
                                                  }`
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-ink-300">{r.next_admin_step}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">Payout requests</h2>
                {payouts.map((p) => (
                    <article key={p.payoutId} className="rounded-2xl border border-line-300 px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-semibold text-white">
                                {money(p.amountMinor, p.currencyCode)} · {p.status}
                            </h3>
                            <span className="text-xs uppercase text-ink-400">
                                {p.provider}/{p.environment}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-500">
                            {p.payoutId} · user {p.userId.slice(0, 8)}… · transfer{" "}
                            {p.providerTransferRef || "—"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={busy || blocked}
                                onClick={() => run("approve_execute", p.payoutId)}
                                className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                            >
                                Approve & execute
                            </button>
                            <button
                                type="button"
                                disabled={busy || blocked}
                                onClick={() => run("refresh_status", p.payoutId)}
                                className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                            >
                                Refresh status
                            </button>
                        </div>
                    </article>
                ))}
                {payouts.length === 0 && (
                    <p className="text-sm text-ink-500">No payout requests in this environment yet.</p>
                )}
            </section>
        </main>
    );
}
