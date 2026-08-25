"use client";

import Link from "next/link";
import {useEffect, useState, type FormEvent} from "react";

type Environment = {
    environmentLabel: string;
    supabaseProjectRef: string | null;
    allowTestFixtures: boolean;
    betaAllowlistRequired: boolean;
    isProduction: boolean;
    creatorRewardsEnabled: boolean;
    autoPostEarnings: boolean;
};
type Config = {
    enabled: boolean;
    autoPostEarnings: boolean;
    environment: Environment | null;
};
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
    nextStep?: string;
    why?: string;
};
type FormulaSummary = {
    calculationVersion: string;
    weights?: Record<string, number>;
    socialCapBps?: number;
    minAllocationAmountMinor?: number;
    notes?: string;
};
type PlaybookStep = {title: string; body: string};
type CreatorRow = {
    user_id: string;
    username: string | null;
    display_name: string | null;
    allocation_amount_minor: number;
    allocation_status: string;
    posting_status: string;
    contribution_points: number;
    eligibility_state: string;
};

const ACTION_HELP: Record<string, string> = {
    open: "Starts contribution scoring for the period window. Does not create money or pay anyone.",
    freeze: "Locks inputs so Calculate is fair and repeatable. Run when the period window should stop accepting new signals.",
    calculate: "Runs the formula and shows each creator’s proposed share. Still not final money.",
    finalize: "Locks the allocation results. With auto_post on, may also create Pending Earnings.",
    post: "Writes finalized allocations into the Earnings ledger as Pending. Still not a bank payout.",
    cancel: "Stops this period path. Existing posted Earnings (if any) are not deleted by cancel.",
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

function money(minor: number, currency: string) {
    return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function AdminCreatorRewardsClient() {
    const [config, setConfig] = useState<Config | null>(null);
    const [periods, setPeriods] = useState<PeriodSummary[]>([]);
    const [formula, setFormula] = useState<FormulaSummary | null>(null);
    const [playbook, setPlaybook] = useState<PlaybookStep[]>([]);
    const [draft, setDraft] = useState(emptyDraft);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [creators, setCreators] = useState<CreatorRow[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    const env = config?.environment;
    const envBadge = (env?.environmentLabel ?? "unknown").toUpperCase();
    const projectRef = env?.supabaseProjectRef ?? "unknown";

    async function load() {
        setError(null);
        const res = await fetch("/api/admin/creator-rewards", {cache: "no-store"});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setConfig(json.config);
        setPeriods(json.periods || []);
        setFormula(json.formula || null);
        setPlaybook(Array.isArray(json.playbook) ? json.playbook : []);
    }

    async function loadDetail(periodId: string) {
        setDetailLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/creator-rewards?periodId=${encodeURIComponent(periodId)}`, {
                cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to load creators");
            const rows = Array.isArray(json.detail?.creators) ? json.detail.creators : [];
            setCreators(rows);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load creators");
            setCreators([]);
        } finally {
            setDetailLoading(false);
        }
    }

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    }, []);

    async function togglePeriod(periodId: string) {
        if (expandedId === periodId) {
            setExpandedId(null);
            setCreators([]);
            return;
        }
        setExpandedId(periodId);
        await loadDetail(periodId);
    }

    async function run(action: string, periodId?: string, body: Record<string, unknown> = {}) {
        if (!config?.enabled && action !== "create") {
            setMessage("Creator Rewards are disabled on the server. Opening/freezing/calculate still require enablement.");
            return;
        }
        const help = ACTION_HELP[action] ?? "";
        const confirmed = window.confirm(
            `${action.toUpperCase()} on ${envBadge} (${projectRef})\n\n${help}\n\nContinue?`
        );
        if (!confirmed) return;
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/admin/creator-rewards", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action, periodId, ...body}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Action failed");
            setMessage(json.message || `${action} completed`);
            await load();
            if (periodId && expandedId === periodId) await loadDetail(periodId);
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
        if (!(pool > 0)) return setError("Pool amount must be positive");
        if (!(minAlloc >= 0)) return setError("Allocation minimum must be >= 0");
        if (socialCapBps < 0 || socialCapBps > 2500) return setError("Social cap must be between 0% and 25%");
        if (!draft.startsAt || !draft.endsAt || draft.startsAt >= draft.endsAt) {
            return setError("Start must be before end");
        }
        if (!/^[A-Z]{3}$/.test(draft.currency.trim().toUpperCase())) {
            return setError("Currency must be a 3-letter code");
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
            notes: "Admin draft",
        });
    }

    return (
        <main className="min-h-screen bg-canvas-950 px-6 py-8 text-ink-100">
            <Link href="/admin" className="text-sm text-ink-400 hover:text-white">
                ← Admin
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl text-white">Creator Rewards</h1>
                <span
                    className={`rounded-md px-2.5 py-1 text-xs font-black tracking-wide ${
                        env?.isProduction ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                    }`}
                >
                    {envBadge}
                </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-ink-400">
                Company-funded reward periods → allocations → Earnings ledger. Bank payouts are a separate finance
                step on{" "}
                <Link href="/admin/payouts" className="text-white underline-offset-2 hover:underline">
                    /admin/payouts
                </Link>
                . Credits cannot be withdrawn.
            </p>

            {config && (
                <div
                    className={`mt-6 rounded-2xl border px-4 py-3 ${
                        config.enabled ? "border-amber-400/40 bg-amber-500/10" : "border-rose-400/40 bg-rose-500/10"
                    }`}
                >
                    <p className="font-bold text-white">
                        {config.enabled
                            ? `Creator Rewards enabled — ${envBadge}`
                            : "Creator Rewards disabled — drafts allowed; open/freeze/calculate blocked"}
                    </p>
                    <p className="mt-1 text-sm text-ink-300">
                        auto_post_earnings={String(config.autoPostEarnings)} · project {projectRef} · beta allowlist=
                        {String(env?.betaAllowlistRequired ?? false)}
                    </p>
                    {config.autoPostEarnings && (
                        <p className="mt-2 text-sm text-amber-200">
                            Warning: auto_post means Finalize can create Pending Earnings without a separate Post
                            click.
                        </p>
                    )}
                </div>
            )}

            <section className="mt-8 rounded-2xl border border-line-300 px-4 py-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">How this works</h2>
                <ol className="mt-3 space-y-3">
                    {(playbook.length
                        ? playbook
                        : [
                              {
                                  title: "Create → open → freeze → calculate → finalize → post",
                                  body: "Then pay Available Earnings manually via Wise on /admin/payouts.",
                              },
                          ]
                    ).map((step) => (
                        <li key={step.title} className="text-sm">
                            <p className="font-semibold text-white">{step.title}</p>
                            <p className="text-ink-400">{step.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {formula && (
                <section className="mt-6 rounded-2xl border border-line-300 bg-white/[0.02] px-4 py-4">
                    <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">Formula</h2>
                    <p className="mt-2 font-semibold text-white">{formula.calculationVersion}</p>
                    {formula.weights && (
                        <ul className="mt-2 grid gap-1 text-sm text-ink-300 sm:grid-cols-2">
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
                            Community support hard cap: {(formula.socialCapBps / 100).toFixed(0)}% of total
                        </p>
                    )}
                    {typeof formula.minAllocationAmountMinor === "number" && (
                        <p className="text-sm text-ink-300">
                            Minimum allocation: ${(formula.minAllocationAmountMinor / 100).toFixed(2)}
                        </p>
                    )}
                </section>
            )}

            <section className="mt-8 rounded-2xl border border-line-300 px-4 py-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">Create draft period</h2>
                <p className="mt-1 text-xs text-ink-500">
                    Drafts are planning only. Staging/test slug names are refused on PRODUCTION.
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
                            onChange={(e) => setDraft({...draft, currency: e.target.value})}
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
                    <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50 md:col-span-2"
                    >
                        Create draft
                    </button>
                </form>
            </section>

            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

            <section className="mt-8">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">Periods</h2>
                <div className="mt-3 space-y-4">
                    {periods.map((p) => (
                        <article key={p.periodId} className="rounded-2xl border border-line-300 px-4 py-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="font-semibold text-white">{p.displayName || p.slug}</h3>
                                <span className="rounded bg-white/10 px-2 py-0.5 text-xs uppercase tracking-wide text-ink-200">
                                    {p.status}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-ink-400">
                                {p.slug} · pool {money(p.poolAmountMinor, p.currencyCode)} · allocated{" "}
                                {money(p.allocatedAmountMinor, p.currencyCode)} · remainder{" "}
                                {money(p.unallocatedRemainderMinor, p.currencyCode)} · {p.eligibleCreatorCount}{" "}
                                creators · {p.calculationVersion}
                            </p>
                            {p.nextStep && (
                                <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2">
                                    <p className="text-xs font-black uppercase tracking-wide text-sky-200">
                                        Next step
                                    </p>
                                    <p className="mt-1 text-sm text-white">{p.nextStep}</p>
                                    {p.why && <p className="mt-1 text-xs text-ink-400">{p.why}</p>}
                                </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                                {["open", "freeze", "calculate", "finalize", "post", "cancel"].map((action) => (
                                    <button
                                        key={action}
                                        type="button"
                                        disabled={busy}
                                        title={ACTION_HELP[action]}
                                        onClick={() => run(action, p.periodId)}
                                        className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold text-ink-100 disabled:opacity-50"
                                    >
                                        {action}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    disabled={busy || detailLoading}
                                    onClick={() => togglePeriod(p.periodId)}
                                    className="rounded-md border border-emerald-400/40 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                                >
                                    {expandedId === p.periodId ? "Hide individuals" : "Show individuals"}
                                </button>
                            </div>

                            {expandedId === p.periodId && (
                                <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                                    {detailLoading ? (
                                        <p className="px-3 py-4 text-sm text-ink-400">Loading creators…</p>
                                    ) : creators.length === 0 ? (
                                        <p className="px-3 py-4 text-sm text-ink-400">
                                            No creator rows yet. Freeze + Calculate first.
                                        </p>
                                    ) : (
                                        <table className="min-w-full text-left text-sm">
                                            <thead className="bg-white/5 text-xs uppercase tracking-wide text-ink-400">
                                                <tr>
                                                    <th className="px-3 py-2">Creator</th>
                                                    <th className="px-3 py-2">Allocation</th>
                                                    <th className="px-3 py-2">Status</th>
                                                    <th className="px-3 py-2">Earnings</th>
                                                    <th className="px-3 py-2">Points</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {creators.map((c) => (
                                                    <tr key={c.user_id} className="border-t border-white/10">
                                                        <td className="px-3 py-2 text-white">
                                                            {c.display_name || c.username || c.user_id.slice(0, 8)}
                                                            {c.username ? (
                                                                <span className="block text-xs text-ink-500">
                                                                    @{c.username}
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                        <td className="px-3 py-2 tabular-nums text-ink-100">
                                                            {money(Number(c.allocation_amount_minor || 0), p.currencyCode)}
                                                        </td>
                                                        <td className="px-3 py-2 text-ink-300">
                                                            {c.allocation_status}
                                                        </td>
                                                        <td className="px-3 py-2 text-ink-300">{c.posting_status}</td>
                                                        <td className="px-3 py-2 tabular-nums text-ink-400">
                                                            {Number(c.contribution_points || 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                    <p className="border-t border-white/10 px-3 py-2 text-xs text-ink-500">
                                        After Posted: pay Available balances on /admin/payouts. Target SLA 14 days
                                        after Available. Payouts are never automatic.
                                    </p>
                                </div>
                            )}
                        </article>
                    ))}
                    {periods.length === 0 && <p className="text-sm text-ink-500">No periods yet.</p>}
                </div>
            </section>
        </main>
    );
}
