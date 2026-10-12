"use client";

import Link from "next/link";
import {useEffect, useState, type FormEvent} from "react";
import {
    AdminPage,
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Field,
    fieldClass,
    ListSkeleton,
    LoadingRow,
    PageHeader,
    Section,
    Skeleton,
    Table,
    TD,
    TH
} from "@/components/admin/ui";

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
    // Which action is in flight, so only the clicked button shows a spinner.
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [creators, setCreators] = useState<CreatorRow[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailCreatorCount, setDetailCreatorCount] = useState<number | null>(null);

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
        setDetailError(null);
        setDetailCreatorCount(null);
        try {
            const res = await fetch(`/api/admin/creator-rewards?periodId=${encodeURIComponent(periodId)}`, {
                cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to load creators");
            const rows = Array.isArray(json.detail?.creators) ? json.detail.creators : [];
            setCreators(rows);
            setDetailCreatorCount(
                typeof json.detail?.creator_count === "number" ? json.detail.creator_count : rows.length
            );
        } catch (e) {
            setDetailError(e instanceof Error ? e.message : "Failed to load creators");
            setCreators([]);
        } finally {
            setDetailLoading(false);
        }
    }

    useEffect(() => {
        load()
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
            .finally(() => setInitialLoading(false));
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
        setBusyAction(`${action}:${periodId ?? ""}`);
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
            setBusyAction(null);
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

    const draftFieldClass = `${fieldClass} mt-1`;

    return (
        <AdminPage className="text-ink-100">
            <PageHeader
                eyebrow="Creator economy"
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        Creator Rewards
                        {config ? <Badge tone={env?.isProduction ? "bad" : "good"}>{envBadge}</Badge> : null}
                    </span>
                }
                description={
                    <>
                        Company-funded reward periods → allocations → Earnings ledger. Bank payouts are a separate finance
                        step on{" "}
                        <Link href="/admin/payouts" className="text-white underline-offset-2 hover:underline">
                            /admin/payouts
                        </Link>
                        . Credits cannot be withdrawn.
                    </>
                }
            />

            {initialLoading && !config ? (
                <div className="mt-6 border border-line-300 bg-surface-900 px-4 py-4">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="mt-3 h-2.5 w-2/3" />
                </div>
            ) : null}

            {config && (
                <Alert
                    tone={config.enabled ? "warn" : "bad"}
                    className="mt-6"
                    title={
                        config.enabled
                            ? `Creator Rewards enabled — ${envBadge}`
                            : "Creator Rewards disabled — drafts allowed; open/freeze/calculate blocked"
                    }
                >
                    <span className="font-mono text-xs">
                        auto_post_earnings={String(config.autoPostEarnings)} · project {projectRef} · beta allowlist=
                        {String(env?.betaAllowlistRequired ?? false)}
                    </span>
                    {config.autoPostEarnings && (
                        <p className="mt-2 text-amber-200">
                            Warning: auto_post means Finalize can create Pending Earnings without a separate Post
                            click.
                        </p>
                    )}
                </Alert>
            )}

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
                <Section title="How this works" className="mt-0">
                    <Card className="p-4">
                        <ol className="space-y-3">
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
                    </Card>
                </Section>

                {formula && (
                    <Section title="Formula" className="mt-0">
                        <Card className="p-4">
                            <p className="font-mono text-sm font-semibold text-white">{formula.calculationVersion}</p>
                            {formula.weights && (
                                <ul className="mt-3 grid gap-1 text-sm text-ink-300 sm:grid-cols-2">
                                    {Object.entries(formula.weights).map(([k, v]) => (
                                        <li key={k} className="tabular-nums">
                                            {k.replaceAll("_", " ")}: {v}
                                            {typeof v === "number" && v <= 100 ? "%" : ""}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {typeof formula.socialCapBps === "number" && (
                                <p className="mt-3 text-sm tabular-nums text-ink-300">
                                    Community support hard cap: {(formula.socialCapBps / 100).toFixed(0)}% of total
                                </p>
                            )}
                            {typeof formula.minAllocationAmountMinor === "number" && (
                                <p className="text-sm tabular-nums text-ink-300">
                                    Minimum allocation: ${(formula.minAllocationAmountMinor / 100).toFixed(2)}
                                </p>
                            )}
                        </Card>
                    </Section>
                )}
            </div>

            <Section
                title="Create draft period"
                description="Drafts are planning only. Staging/test slug names are refused on PRODUCTION."
            >
                <Card className="p-4">
                    <form className="grid gap-3 md:grid-cols-2" onSubmit={createDraft}>
                        <Field label="Title">
                            <input
                                className={draftFieldClass}
                                value={draft.title}
                                onChange={(e) => setDraft({...draft, title: e.target.value})}
                                required
                            />
                        </Field>
                        <Field label="Slug">
                            <input
                                className={draftFieldClass}
                                value={draft.slug}
                                onChange={(e) => setDraft({...draft, slug: e.target.value})}
                                required
                            />
                        </Field>
                        <Field label="Starts at">
                            <input
                                type="datetime-local"
                                className={draftFieldClass}
                                value={draft.startsAt}
                                onChange={(e) => setDraft({...draft, startsAt: e.target.value})}
                                required
                            />
                        </Field>
                        <Field label="Ends at">
                            <input
                                type="datetime-local"
                                className={draftFieldClass}
                                value={draft.endsAt}
                                onChange={(e) => setDraft({...draft, endsAt: e.target.value})}
                                required
                            />
                        </Field>
                        <Field label="Currency">
                            <input
                                className={draftFieldClass}
                                value={draft.currency}
                                onChange={(e) => setDraft({...draft, currency: e.target.value})}
                                required
                            />
                        </Field>
                        <Field label="Pool amount">
                            <input
                                className={`${draftFieldClass} tabular-nums`}
                                value={draft.poolAmount}
                                onChange={(e) => setDraft({...draft, poolAmount: e.target.value})}
                                required
                            />
                        </Field>
                        <Field label="Allocation minimum">
                            <input
                                className={`${draftFieldClass} tabular-nums`}
                                value={draft.allocationMinimum}
                                onChange={(e) => setDraft({...draft, allocationMinimum: e.target.value})}
                                required
                            />
                        </Field>
                        <Field label="Social cap %">
                            <input
                                className={`${draftFieldClass} tabular-nums`}
                                value={draft.socialCapPercent}
                                onChange={(e) => setDraft({...draft, socialCapPercent: e.target.value})}
                                required
                            />
                        </Field>
                        <div className="flex justify-end border-t border-line-300 pt-3 md:col-span-2">
                            <Button type="submit" variant="primary" disabled={busy} loading={busyAction === "create:"}>
                                Create draft
                            </Button>
                        </div>
                    </form>
                </Card>
            </Section>

            {(error || message) && (
                <div className="mt-6 space-y-3">
                    {error && <Alert tone="bad">{error}</Alert>}
                    {message && <Alert tone="good">{message}</Alert>}
                </div>
            )}

            <Section title="Periods">
                <div className="space-y-3">
                    {initialLoading && periods.length === 0 && <ListSkeleton rows={3} />}
                    {periods.map((p) => (
                        <Card key={p.periodId} className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-semibold text-white">{p.displayName || p.slug}</h3>
                                <Badge tone={p.status === "posted" ? "good" : p.status === "cancelled" ? "bad" : "neutral"}>
                                    {p.status}
                                </Badge>
                            </div>
                            <p className="mt-1 text-sm tabular-nums text-ink-400">
                                {p.slug} · pool {money(p.poolAmountMinor, p.currencyCode)} · allocated{" "}
                                {money(p.allocatedAmountMinor, p.currencyCode)} · remainder{" "}
                                {money(p.unallocatedRemainderMinor, p.currencyCode)} · {p.eligibleCreatorCount}{" "}
                                creators · {p.calculationVersion}
                            </p>
                            <p className="mt-1 text-xs text-ink-500">
                                Allocated here is a Creator Rewards proposal — not Earnings and not a bank payout.
                                After Finalize → Post, money appears on /admin/payouts once Available.
                            </p>
                            {p.nextStep && (
                                <div className="mt-3 border border-sky-400/30 bg-sky-500/[.07] px-3 py-2">
                                    <p className="text-[11px] font-black uppercase tracking-[.12em] text-sky-200">
                                        Next step
                                    </p>
                                    <p className="mt-1 text-sm text-white">{p.nextStep}</p>
                                    {p.why && <p className="mt-1 text-xs text-ink-400">{p.why}</p>}
                                    {["calculated", "finalized", "posted"].includes(p.status) && (
                                        <p className="mt-2 text-xs text-sky-100/90">
                                            Click <strong>Show individuals</strong> to see who the{" "}
                                            {money(p.allocatedAmountMinor, p.currencyCode)} is allocated to (
                                            {p.eligibleCreatorCount} creators).
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2 border-t border-line-300 pt-3">
                                {["open", "freeze", "calculate", "finalize", "post", "cancel"].map((action) => (
                                    <Button
                                        key={action}
                                        size="sm"
                                        variant={action === "cancel" ? "danger" : "outline"}
                                        className="capitalize"
                                        disabled={busy}
                                        loading={busyAction === `${action}:${p.periodId}`}
                                        title={ACTION_HELP[action]}
                                        onClick={() => run(action, p.periodId)}
                                    >
                                        {action}
                                    </Button>
                                ))}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-200"
                                    disabled={busy || detailLoading}
                                    loading={detailLoading && expandedId === p.periodId}
                                    onClick={() => togglePeriod(p.periodId)}
                                >
                                    {expandedId === p.periodId
                                        ? "Hide individuals"
                                        : `Show individuals (${p.eligibleCreatorCount})`}
                                </Button>
                            </div>

                            {expandedId === p.periodId && (
                                <div className="mt-4 border border-line-300 bg-canvas-900">
                                    {detailLoading ? (
                                        <LoadingRow>Loading {p.eligibleCreatorCount} creators…</LoadingRow>
                                    ) : detailError ? (
                                        <Alert tone="bad" className="m-3">
                                            Couldn’t load individuals: {detailError}. Allocated totals above are still
                                            authoritative — refresh after the detail RPC fix if this persists.
                                        </Alert>
                                    ) : creators.length === 0 ? (
                                        <EmptyState
                                            className="m-3"
                                            title={
                                                p.allocatedAmountMinor > 0
                                                    ? `Expected ~${p.eligibleCreatorCount} creators for ${money(p.allocatedAmountMinor, p.currencyCode)} but the detail query returned none.`
                                                    : "No creator rows yet. Freeze + Calculate first."
                                            }
                                        />
                                    ) : (
                                        <>
                                            <p className="border-b border-line-300 px-3 py-2 text-xs tabular-nums text-ink-400">
                                                Showing {creators.length}
                                                {detailCreatorCount != null ? ` / ${detailCreatorCount}` : ""}{" "}
                                                creators · sorted by allocation · who the{" "}
                                                {money(p.allocatedAmountMinor, p.currencyCode)} is assigned to
                                            </p>
                                            <Table>
                                                <thead>
                                                    <tr>
                                                        <TH>Creator</TH>
                                                        <TH numeric>Allocation</TH>
                                                        <TH>Status</TH>
                                                        <TH>Earnings</TH>
                                                        <TH numeric>Points</TH>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {creators.map((c) => (
                                                        <tr key={c.user_id}>
                                                            <TD className="text-white">
                                                                {c.display_name ||
                                                                    c.username ||
                                                                    c.user_id.slice(0, 8)}
                                                                {c.username ? (
                                                                    <span className="block text-xs text-ink-500">
                                                                        @{c.username}
                                                                    </span>
                                                                ) : null}
                                                            </TD>
                                                            <TD numeric className="text-ink-100">
                                                                {money(
                                                                    Number(c.allocation_amount_minor || 0),
                                                                    p.currencyCode
                                                                )}
                                                            </TD>
                                                            <TD className="text-ink-300">
                                                                {c.allocation_status}
                                                            </TD>
                                                            <TD className="text-ink-300">
                                                                {c.posting_status}
                                                            </TD>
                                                            <TD numeric className="text-ink-400">
                                                                {Number(c.contribution_points || 0).toFixed(2)}
                                                            </TD>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </>
                                    )}
                                    <p className="border-t border-line-300 px-3 py-2 text-xs text-ink-500">
                                        After Posted: pay Available balances on /admin/payouts. Target SLA 14 days
                                        after Available. Payouts are never automatic.
                                    </p>
                                </div>
                            )}
                        </Card>
                    ))}
                    {!initialLoading && periods.length === 0 && <EmptyState title="No periods yet." />}
                </div>
            </Section>
        </AdminPage>
    );
}
