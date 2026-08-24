"use client";

import {useEffect, useState, type FormEvent} from "react";

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
type FormulaSummary = {
    calculationVersion: string;
    weights?: Record<string, number>;
    socialCapBps?: number;
    minAllocationAmountMinor?: number;
    firewalls?: string[];
    notes?: string;
};

const emptyDraft = {
    title: "",
    slug: "",
    startsAt: "",
    endsAt: "",
    currency: "USD",
    poolAmount: "100.00",
    allocationMinimum: "0.50",
    calculationVersion: "creator_rewards_v1_calibrated",
    eligibilityVersion: "eligibility_v1",
    riskVersion: "risk_v1",
    socialCapPercent: "15",
};

export function AdminCreatorRewardsClient() {
    const [config, setConfig] = useState<Config | null>(null);
    const [periods, setPeriods] = useState<PeriodSummary[]>([]);
    const [formula, setFormula] = useState<FormulaSummary | null>(null);
    const [draft, setDraft] = useState(emptyDraft);
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
        setFormula(json.formula || null);
    }

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    }, []);

    async function run(action: string, periodId?: string, body: Record<string, unknown> = {}) {
        if (!config?.enabled && action !== "list" && action !== "create" && action !== "formula") {
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
                body: JSON.stringify({action, periodId, ...body}),
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

    async function createDraft(e: FormEvent) {
        e.preventDefault();
        const pool = Math.round(Number(draft.poolAmount) * 100);
        const minAlloc = Math.round(Number(draft.allocationMinimum) * 100);
        const socialCapBps = Math.round(Number(draft.socialCapPercent) * 100);
        if (!(pool > 0)) {
            setError("Pool amount must be positive");
            return;
        }
        if (!(minAlloc >= 0)) {
            setError("Allocation minimum must be >= 0");
            return;
        }
        if (socialCapBps < 0 || socialCapBps > 2500) {
            setError("Social cap must be between 0% and 25%");
            return;
        }
        if (!draft.startsAt || !draft.endsAt || draft.startsAt >= draft.endsAt) {
            setError("Start must be before end");
            return;
        }
        if (!/^[A-Z]{3}$/.test(draft.currency.trim().toUpperCase())) {
            setError("Currency must be a 3-letter code");
            return;
        }
        await run("create", undefined, {
            slug: draft.slug,
            displayName: draft.title,
            currencyCode: draft.currency.trim().toUpperCase(),
            poolAmountMinor: pool,
            periodStart: new Date(draft.startsAt).toISOString(),
            periodEnd: new Date(draft.endsAt).toISOString(),
            calculationVersion: draft.calculationVersion,
            eligibilityVersion: draft.eligibilityVersion,
            riskVersion: draft.riskVersion,
            minAllocationAmountMinor: minAlloc,
            socialCapBps,
            notes: "Admin draft — simulation until finalized/posted",
        });
    }

    return (
        <main className="min-h-screen bg-canvas-950 px-6 py-8 text-ink-100">
            <h1 className="font-display text-3xl text-white">Creator Rewards</h1>
            <p className="mt-2 text-sm text-ink-400">
                Internal operations console. Service role stays server-side only. No “Calculate & Pay” shortcut.
            </p>

            {config && (
                <div
                    className={`mt-6 rounded-2xl border px-4 py-3 ${
                        config.enabled ? "border-amber-400/40 bg-amber-500/10" : "border-rose-400/40 bg-rose-500/10"
                    }`}
                >
                    <p className="font-bold text-white">
                        {config.enabled ? "Creator Rewards enabled" : "Creator Rewards disabled"}
                    </p>
                    <p className="text-sm text-ink-300">
                        auto_post_earnings={String(config.autoPostEarnings)}. Lifecycle actions (except draft create) are
                        blocked while disabled.
                    </p>
                </div>
            )}

            {formula && (
                <section className="mt-6 rounded-2xl border border-line-300 bg-white/[0.02] px-4 py-4">
                    <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">Formula preview</h2>
                    <p className="mt-2 font-semibold text-white">{formula.calculationVersion}</p>
                    {formula.weights && (
                        <ul className="mt-2 space-y-1 text-sm text-ink-300">
                            {Object.entries(formula.weights).map(([k, v]) => (
                                <li key={k}>
                                    {k.replaceAll("_", " ")}: {v}
                                    {typeof v === "number" && v <= 100 ? "%" : ""}
                                </li>
                            ))}
                        </ul>
                    )}
                    {typeof formula.socialCapBps === "number" && (
                        <p className="mt-2 text-sm text-ink-300">
                            Community support hard cap: {(formula.socialCapBps / 100).toFixed(0)}% of total contribution
                        </p>
                    )}
                    {typeof formula.minAllocationAmountMinor === "number" && (
                        <p className="text-sm text-ink-300">
                            Minimum allocation: ${(formula.minAllocationAmountMinor / 100).toFixed(2)}
                        </p>
                    )}
                    {formula.notes && <p className="mt-2 text-xs text-ink-500">{formula.notes}</p>}
                </section>
            )}

            <section className="mt-8 rounded-2xl border border-line-300 px-4 py-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">Create draft period</h2>
                <p className="mt-1 text-xs text-ink-500">
                    Draft creation is allowed while disabled. Opening/freezing still requires enablement on a non-production
                    project.
                </p>
                <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createDraft}>
                    <label className="text-sm">
                        Title
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.title}
                            onChange={(e) => setDraft({...draft, title: e.target.value})}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Slug
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.slug}
                            onChange={(e) => setDraft({...draft, slug: e.target.value})}
                            pattern="^[a-z][a-z0-9_]*$"
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Starts at
                        <input
                            type="datetime-local"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.startsAt}
                            onChange={(e) => setDraft({...draft, startsAt: e.target.value})}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Ends at
                        <input
                            type="datetime-local"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.endsAt}
                            onChange={(e) => setDraft({...draft, endsAt: e.target.value})}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Currency
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.currency}
                            onChange={(e) => setDraft({...draft, currency: e.target.value.toUpperCase()})}
                            maxLength={3}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Pool amount
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.poolAmount}
                            onChange={(e) => setDraft({...draft, poolAmount: e.target.value})}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Allocation minimum
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.allocationMinimum}
                            onChange={(e) => setDraft({...draft, allocationMinimum: e.target.value})}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Social cap %
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.socialCapPercent}
                            onChange={(e) => setDraft({...draft, socialCapPercent: e.target.value})}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Calculation version
                        <select
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.calculationVersion}
                            onChange={(e) => setDraft({...draft, calculationVersion: e.target.value})}
                        >
                            <option value="creator_rewards_v1_calibrated">creator_rewards_v1_calibrated</option>
                            <option value="event_caps_v1">event_caps_v1 (Phase 3)</option>
                        </select>
                    </label>
                    <label className="text-sm">
                        Eligibility version
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.eligibilityVersion}
                            onChange={(e) => setDraft({...draft, eligibilityVersion: e.target.value})}
                            required
                        />
                    </label>
                    <label className="text-sm">
                        Risk version
                        <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.riskVersion}
                            onChange={(e) => setDraft({...draft, riskVersion: e.target.value})}
                            required
                        />
                    </label>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={busy}
                            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold uppercase disabled:opacity-40"
                        >
                            Create draft
                        </button>
                    </div>
                </form>
            </section>

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
                                    <div className="text-xs text-ink-500">
                                        {p.slug} · {p.calculationVersion || "—"}
                                    </div>
                                    {p.status === "draft" || p.status === "calculated" || p.status === "frozen" ? (
                                        <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
                                            Simulation / Not finalized
                                        </div>
                                    ) : null}
                                </td>
                                <td className="px-3 py-3">{p.status}</td>
                                <td className="px-3 py-3">
                                    {p.currencyCode} {(p.poolAmountMinor / 100).toFixed(2)}
                                </td>
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
                                <td className="px-3 py-6 text-ink-500" colSpan={7}>
                                    No Creator Reward periods yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
