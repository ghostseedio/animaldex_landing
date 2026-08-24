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

    const env = config?.environment;
    const envBadge = (env?.environmentLabel ?? "unknown").toUpperCase();
    const projectRef = env?.supabaseProjectRef ?? "unknown";

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
            ? window.confirm(
                  `Confirm ${action} on ${envBadge} (${projectRef})?\nThis cannot be mixed with payout.`
              )
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
            <Link href="/admin" className="text-sm text-ink-400 hover:text-white">
                ← Admin
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl text-white">Creator Rewards</h1>
                <span
                    className={`rounded-md px-2.5 py-1 text-xs font-black tracking-wide ${
                        env?.isProduction
                            ? "bg-rose-600 text-white"
                            : envBadge === "STAGING" || envBadge === "LOCAL"
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-500 text-black"
                    }`}
                >
                    {envBadge}
                </span>
            </div>
            <p className="mt-2 text-sm text-ink-400">
                Internal operations console. Environment from authoritative server config (project{" "}
                <code className="text-ink-200">{projectRef}</code>). Service role stays server-side only.
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
                            : env?.isProduction
                              ? "Creator Rewards disabled — no live periods can be created."
                              : `Creator Rewards disabled — ${envBadge}`}
                    </p>
                    <p className="text-sm text-ink-300">
                        auto_post_earnings={String(config.autoPostEarnings)}. Beta allowlist required=
                        {String(env?.betaAllowlistRequired ?? false)}. Test fixtures allowed=
                        {String(env?.allowTestFixtures ?? false)}.
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
                    Draft creation is allowed while disabled. Opening/freezing still requires enablement. Staging/test
                    slug names are refused on PRODUCTION.
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
                    <label className="text-sm md:col-span-2">
                        Formula version
                        <select
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                            value={draft.calculationVersion}
                            onChange={(e) => setDraft({...draft, calculationVersion: e.target.value})}
                        >
                            <option value="creator_rewards_v1_calibrated">creator_rewards_v1_calibrated</option>
                            <option value="event_caps_v1">event_caps_v1</option>
                        </select>
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
                <div className="mt-3 space-y-3">
                    {periods.map((p) => (
                        <article key={p.periodId} className="rounded-2xl border border-line-300 px-4 py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="font-semibold text-white">{p.displayName}</h3>
                                <span className="text-xs uppercase text-ink-400">{p.status}</span>
                            </div>
                            <p className="mt-1 text-sm text-ink-400">
                                {p.slug} · {p.currencyCode} · pool {(p.poolAmountMinor / 100).toFixed(2)} · allocated{" "}
                                {(p.allocatedAmountMinor / 100).toFixed(2)} · remainder{" "}
                                {(p.unallocatedRemainderMinor / 100).toFixed(2)} · {p.calculationVersion}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {["open", "freeze", "calculate", "finalize", "post", "cancel"].map((action) => (
                                    <button
                                        key={action}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => run(action, p.periodId)}
                                        className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold text-ink-100 disabled:opacity-50"
                                    >
                                        {action}
                                    </button>
                                ))}
                            </div>
                        </article>
                    ))}
                    {periods.length === 0 && <p className="text-sm text-ink-500">No periods.</p>}
                </div>
            </section>
        </main>
    );
}
