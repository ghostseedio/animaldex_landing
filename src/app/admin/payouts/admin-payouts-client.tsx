"use client";

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

export function AdminPayoutsClient() {
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [payouts, setPayouts] = useState<PayoutRow[]>([]);
    const [blocked, setBlocked] = useState(false);
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
        setBlocked(Boolean(json.blocked));
    }

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }, []);

    async function run(action: string, payoutId: string) {
        const confirmed = window.confirm(
            `Confirm ${action} on ${diagnostics?.banner ?? "SANDBOX"}?\nPayout ${payoutId}\nNamed finance operator required. No real money.`
        );
        if (!confirmed) return;
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/admin/payouts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action, payoutId})
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

    return (
        <main className="min-h-screen bg-canvas-950 px-6 py-8 text-ink-100">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl text-white">Payouts</h1>
                <span
                    className={`rounded-md px-2.5 py-1 text-xs font-black tracking-wide text-white ${
                        diagnostics?.isProduction ? "bg-rose-700" : "bg-emerald-700"
                    }`}
                >
                    {diagnostics?.isProduction ? "PRODUCTION — REAL MONEY" : "WISE SANDBOX"}
                </span>
            </div>
            <p className="mt-2 text-sm text-ink-400">
                Ghostseed Ltd · Named finance operator required. Shared password cannot approve. No raw bank
                details.
            </p>

            {diagnostics && (
                <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
                    <p className="font-bold text-white">{diagnostics.banner}</p>
                    <p className="mt-1 text-sm text-ink-300">
                        AnimalDex={diagnostics.animaldexEnvironment} · payouts_enabled=
                        {String(diagnostics.payoutsEnabled)} · auto_payout=
                        {String(diagnostics.autoPayoutEnabled)} · credentials=
                        {String(diagnostics.wiseCredentialsConfigured)} · profile=
                        {String(diagnostics.wiseProfileBound)} · webhook_key=
                        {String(diagnostics.webhookPublicKeyConfigured)}
                    </p>
                </div>
            )}

            {blocked && (
                <p className="mt-4 text-sm text-rose-300">
                    {diagnostics?.isProduction
                        ? "Production payout execution is gated. Fund Ghostseed Wise GBP and complete Phase 7C readiness before any real transfer."
                        : "Production payout execution is blocked. Use local Supabase + Wise sandbox only."}
                </p>
            )}

            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-4 break-all text-sm text-emerald-300">{message}</p>}

            <section className="mt-8 space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">Sandbox payouts</h2>
                {payouts.map((p) => (
                    <article key={p.payoutId} className="rounded-2xl border border-line-300 px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-semibold text-white">
                                {p.currencyCode} {(p.amountMinor / 100).toFixed(2)} · {p.status}
                            </h3>
                            <span className="text-xs uppercase text-ink-400">
                                {p.provider}/{p.environment}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-ink-400">
                            {p.payoutId} · user {p.userId.slice(0, 8)}… · transfer{" "}
                            {p.providerTransferRef ?? "—"} · provider_status {p.providerStatus ?? "—"}
                            {p.failureCode ? ` · fail ${p.failureCode}` : ""}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={busy || blocked}
                                onClick={() => run("approve_execute", p.payoutId)}
                                className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                            >
                                approve + execute sandbox
                            </button>
                            <button
                                type="button"
                                disabled={busy || blocked}
                                onClick={() => run("refresh_status", p.payoutId)}
                                className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                            >
                                refresh provider status
                            </button>
                        </div>
                    </article>
                ))}
                {payouts.length === 0 && !blocked && (
                    <p className="text-sm text-ink-500">No sandbox payouts yet.</p>
                )}
            </section>
        </main>
    );
}
