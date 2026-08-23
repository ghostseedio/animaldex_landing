"use client";

import {useEffect, useState} from "react";

type Config = {enabled: boolean; autoPostEarnings: boolean};
type PeriodSummary = {
    periodId: string;
    slug: string;
    displayName: string;
    currencyCode: string;
    poolAmountMinor: number;
    periodStart: string;
    periodEnd: string;
    status: string;
    eligibleCreatorCount: number;
    allocatedAmountMinor: number;
    unallocatedRemainderMinor: number;
    calculationVersion: string;
};

export function AdminCreatorRewardsClient() {
    const [config, setConfig] = useState<Config | null>(null);
    const [periods, setPeriods] = useState<PeriodSummary[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    async function load() {
        setError(null);
        const res = await fetch("/api/admin/creator-rewards?action=list", {cache: "no-store"});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setConfig(json.config);
        setPeriods(json.periods || []);
    }

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    }, []);

    async function run(action: string, periodId?: string) {
        if (!config?.enabled && action !== "list") {
            setMessage("Creator Rewards are disabled. Enablement is server-controlled.");
            return;
        }
        const confirmed = ["finalize", "post", "cancel"].includes(action)
            ? window.confirm(`Confirm ${action}? This cannot be mixed with payout.`)
            : true;
        if (!confirmed) return;
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/creator-rewards", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action, periodId}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Action failed");
            setMessage(json.message || "Done");
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Action failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-canvas-950 px-6 py-8 text-ink-100">
            <h1 className="font-display text-3xl text-white">Creator Rewards</h1>
            <p className="mt-2 text-sm text-ink-400">Internal operations console. Service role stays server-side only.</p>

            {config && (
                <div className={`mt-6 rounded-2xl border px-4 py-3 ${config.enabled ? "border-amber-400/40 bg-amber-500/10" : "border-rose-400/40 bg-rose-500/10"}`}>
                    <p className="font-bold text-white">
                        {config.enabled ? "Creator Rewards enabled" : "Creator Rewards disabled"}
                    </p>
                    <p className="text-sm text-ink-300">
                        auto_post_earnings={String(config.autoPostEarnings)}. Lifecycle actions are blocked while disabled.
                    </p>
                </div>
            )}

            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-4 text-sm text-primary-200">{message}</p>}

            <div className="mt-8 overflow-x-auto rounded-2xl border border-line-300">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/[0.03] text-ink-400">
                        <tr>
                            <th className="px-3 py-2">Period</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Pool</th>
                            <th className="px-3 py-2">Allocated</th>
                            <th className="px-3 py-2">Remainder</th>
                            <th className="px-3 py-2">Creators</th>
                            <th className="px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {periods.map((p) => (
                            <tr key={p.periodId} className="border-t border-line-300/70">
                                <td className="px-3 py-3">
                                    <div className="font-semibold text-white">{p.displayName}</div>
                                    <div className="text-xs text-ink-500">{p.slug}</div>
                                    {p.status === "draft" || p.status === "calculated" ? (
                                        <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-300">Simulation / no Earnings posted</div>
                                    ) : null}
                                </td>
                                <td className="px-3 py-3">{p.status}</td>
                                <td className="px-3 py-3">{p.currencyCode} {(p.poolAmountMinor / 100).toFixed(2)}</td>
                                <td className="px-3 py-3">{(p.allocatedAmountMinor / 100).toFixed(2)}</td>
                                <td className="px-3 py-3">{(p.unallocatedRemainderMinor / 100).toFixed(2)}</td>
                                <td className="px-3 py-3">{p.eligibleCreatorCount}</td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-2">
                                        {["open", "freeze", "calculate", "finalize", "post", "cancel"].map((action) => (
                                            <button
                                                key={action}
                                                disabled={busy || !config?.enabled}
                                                onClick={() => run(action, p.periodId)}
                                                className="rounded-lg border border-white/10 px-2 py-1 text-xs font-bold uppercase disabled:opacity-40"
                                            >
                                                {action}
                                            </button>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {periods.length === 0 && (
                            <tr>
                                <td className="px-3 py-6 text-ink-500" colSpan={7}>No Creator Reward periods yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
