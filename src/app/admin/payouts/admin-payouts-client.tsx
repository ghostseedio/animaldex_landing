"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {FinanceOperatorSignInCard, useFinanceActor} from "@/app/admin/_components/finance-operator-auth";
import {
    canConfirmPaid,
    canPrepareStep,
    canRecordManualTransfer,
    isPreparationIncomplete,
    isTransferPrepared,
    step1ActionLabel
} from "@/lib/payout-preparation-state";

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
    payoutProfileId: string | null;
    currencyCode: string;
    amountMinor: number;
    status: string;
    provider: string;
    environment: string;
    providerQuoteRef: string | null;
    providerTransferRef: string | null;
    providerStatus: string | null;
    failureCode: string | null;
    sourceEarningsCurrency: string | null;
    sourceEarningsAmountMinor: number | null;
    targetCurrency: string | null;
    targetAmountMinor: number | null;
    estimateTargetAmountMinor: number | null;
    estimateExchangeRate: number | null;
    quoteSourceCurrency: string | null;
    quoteTargetCurrency: string | null;
    quoteSourceAmountMinor: number | null;
    quoteTargetAmountMinor: number | null;
    quoteFeeAmountMinor: number | null;
    quoteRate: number | null;
    providerFinalSourceAmountMinor: number | null;
    providerFinalSourceCurrency: string | null;
    providerFinalTargetAmountMinor: number | null;
    providerFinalTargetCurrency: string | null;
    providerPaymentReference: string | null;
    providerFinalizedAt: string | null;
    feePolicy: string | null;
    reviewTier: string | null;
    hasHold: boolean;
    paidAt: string | null;
    manualTransferRecordedAt: string | null;
    destination: PayoutDestination | null;
};

type PayoutDestination = {
    originalProfileId: string | null;
    activeProfileId: string | null;
    usingRecovery: boolean;
    recipientRefMasked: string | null;
    profileStatus: string | null;
    addressCountry: string | null;
    addressCity: string | null;
    addressPostCode: string | null;
    addressFirstLine: string | null;
    addressState: string | null;
    missingAddressLabels: string[];
    addressComplete: boolean;
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

type RecordForm = {
    providerTransferRef: string;
    quoteSourceCurrency: string;
    quoteTargetCurrency: string;
    quoteSourceAmount: string;
    quoteTargetAmount: string;
    quoteFeeAmount: string;
    quoteRate: string;
};

function money(minor: number, currency: string) {
    return `${currency} ${(Number(minor) / 100).toFixed(2)}`;
}

function formatDateTime(value: string | null) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function shortId(id: string | null | undefined) {
    return id ? `${id.slice(0, 8)}…` : "—";
}

function toMinor(amount: string): number {
    return Math.round(Number(amount) * 100);
}

const DEFAULT_HOW_TO_PAY = [
    "Confirm Available Earnings (not Credits) and masked bank destination.",
    "Creator requests payout → Available becomes Held.",
    "Named finance approves payout; AnimalDex prepares Wise quote + transfer using the stored recipient.",
    "Send/fund the prepared transfer in Ghostseed Wise Business.",
    "Refresh Wise status until outgoing_payment_sent.",
    "Confirm Paid from Wise status (releases hold + posts payout debit).",
];

export function AdminPayoutsClient() {
    const {actor, loaded: actorLoaded, signedIn} = useFinanceActor();
    const canFinance = actor?.canActAsFinanceActor === true;
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [payouts, setPayouts] = useState<PayoutRow[]>([]);
    const [readiness, setReadiness] = useState<Readiness | null>(null);
    const [autoExecuteBlocked, setAutoExecuteBlocked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [recordFor, setRecordFor] = useState<string | null>(null);
    const [recordForm, setRecordForm] = useState<RecordForm>({
        providerTransferRef: "",
        quoteSourceCurrency: "GBP",
        quoteTargetCurrency: "GBP",
        quoteSourceAmount: "",
        quoteTargetAmount: "",
        quoteFeeAmount: "0",
        quoteRate: "1",
    });

    async function load() {
        setError(null);
        const res = await fetch("/api/admin/payouts", {cache: "no-store"});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setDiagnostics(json.diagnostics);
        setPayouts(json.payouts || []);
        setReadiness(json.readiness || null);
        setAutoExecuteBlocked(Boolean(json.autoExecuteBlocked));
    }

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }, []);

    function openRecord(p: PayoutRow) {
        setRecordFor(p.payoutId);
        setRecordForm({
            providerTransferRef: p.providerTransferRef || "",
            quoteSourceCurrency: p.quoteSourceCurrency || p.sourceEarningsCurrency || p.currencyCode,
            quoteTargetCurrency: p.quoteTargetCurrency || p.targetCurrency || p.currencyCode,
            quoteSourceAmount: String(
                ((p.quoteSourceAmountMinor ?? p.sourceEarningsAmountMinor ?? p.amountMinor) || 0) / 100
            ),
            quoteTargetAmount: String(
                ((p.quoteTargetAmountMinor ?? p.targetAmountMinor ?? p.estimateTargetAmountMinor ?? p.amountMinor) ||
                    0) / 100
            ),
            quoteFeeAmount: String((p.quoteFeeAmountMinor ?? 0) / 100),
            quoteRate: String(p.quoteRate ?? p.estimateExchangeRate ?? 1),
        });
    }

    function openWiseTransfer(p: PayoutRow) {
        if (!p.providerTransferRef) return;
        window.open("https://wise.com/", "_blank", "noopener,noreferrer");
    }

    async function run(action: string, payoutId: string, extra?: Record<string, unknown>) {
        const amountHint = payouts.find((p) => p.payoutId === payoutId);
        const confirmed = window.confirm(
            [
                diagnostics?.isProduction ? "PRODUCTION — REAL MONEY" : "SANDBOX",
                `Action: ${action}`,
                `Payout: ${payoutId}`,
                amountHint
                    ? `Amount: ${money(amountHint.amountMinor, amountHint.currencyCode)}`
                    : null,
                "Named finance operator required.",
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
                body: JSON.stringify({action, payoutId, ...extra}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Action failed");
            setMessage(`${action} ok`);
            setRecordFor(null);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Action failed");
        } finally {
            setBusy(false);
        }
    }

    async function releasePostedCreatorRewards() {
        const pendingByCurrency = rows.reduce<Record<string, number>>((acc, r) => {
            acc[r.currency_code] = (acc[r.currency_code] || 0) + Number(r.pending_amount_minor || 0);
            return acc;
        }, {});
        const pendingSummary = Object.entries(pendingByCurrency)
            .filter(([, amount]) => amount > 0)
            .map(([currency, amount]) => money(amount, currency))
            .join(", ");
        const confirmed = window.confirm(
            [
                diagnostics?.isProduction ? "PRODUCTION — REAL MONEY" : "SANDBOX",
                "Action: release posted Creator Rewards to Available",
                `Pending total shown: ${pendingSummary || "0"}`,
                "This makes posted rewards eligible for creator payout requests.",
                "Continue?",
            ].join("\n")
        );
        if (!confirmed) return;
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/admin/payouts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "release_posted_creator_rewards"}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Release failed");
            const count = json.result?.released_count ?? 0;
            const amount = json.result?.released_amount_minor ?? 0;
            setMessage(`Released ${count} reward entries (${amount} minor units)`);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Release failed");
        } finally {
            setBusy(false);
        }
    }

    async function submitRecord() {
        if (!recordFor) return;
        await run("record_wise_transfer", recordFor, {
            providerTransferRef: recordForm.providerTransferRef.trim(),
            quoteSourceCurrency: recordForm.quoteSourceCurrency.trim().toUpperCase(),
            quoteTargetCurrency: recordForm.quoteTargetCurrency.trim().toUpperCase(),
            quoteSourceAmountMinor: toMinor(recordForm.quoteSourceAmount),
            quoteTargetAmountMinor: toMinor(recordForm.quoteTargetAmount),
            quoteFeeAmountMinor: toMinor(recordForm.quoteFeeAmount),
            quoteRate: Number(recordForm.quoteRate),
        });
    }

    const rows = readiness?.rows || [];
    const hasPendingRewards = rows.some((r) => Number(r.pending_amount_minor || 0) > 0);

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
                <Link
                    href="/admin/payout-corridors"
                    className="rounded-md border border-white/20 px-2.5 py-1 text-xs font-semibold text-ink-200 hover:bg-white/5"
                >
                    Corridors
                </Link>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-ink-400">
                Ghostseed Ltd pays creators from Available Earnings via Wise. Model:{" "}
                <strong className="text-ink-200">request → Held → Approve → manual Wise → record → Paid</strong>.
                Target SLA: {readiness?.payout_sla_days ?? 14} days. Auto-payout stays off.
            </p>

            {actorLoaded && canFinance && (
                <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                    <p className="font-bold text-white">
                        Named finance operator: {actor?.email}
                    </p>
                    <p className="mt-1 text-sm text-ink-300">
                        Finance actions are enabled for this session.
                    </p>
                </div>
            )}

            {actorLoaded && !canFinance && (
                <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
                    <p className="font-bold text-white">Finance actions locked</p>
                    <p className="mt-1 text-sm text-ink-300">
                        Your current session is a shared-password admin session, which cannot approve
                        payouts. Sign in as a named finance operator below to enable payout approvals.
                    </p>
                    <FinanceOperatorSignInCard onSignedIn={signedIn} />
                </div>
            )}

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
                    {(readiness?.how_to_pay?.length ? readiness.how_to_pay : DEFAULT_HOW_TO_PAY).map(
                        (step) => (
                            <li key={step}>{step}</li>
                        )
                    )}
                </ol>
                <p className="mt-3 text-xs text-ink-500">
                    Creator Rewards on{" "}
                    <Link href="/admin/creator-rewards" className="text-white underline-offset-2 hover:underline">
                        /admin/creator-rewards
                    </Link>
                    . Enable countries on{" "}
                    <Link href="/admin/payout-corridors" className="text-white underline-offset-2 hover:underline">
                        /admin/payout-corridors
                    </Link>{" "}
                    after Wise verification (no app release).
                </p>
                <button
                    type="button"
                    disabled={busy || !hasPendingRewards}
                    onClick={() => void releasePostedCreatorRewards()}
                    className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-100 disabled:opacity-50"
                >
                    {hasPendingRewards ? "Release posted rewards to Available" : "Posted rewards already Available"}
                </button>
                {!hasPendingRewards && rows.some((r) => Number(r.available_amount_minor || 0) > 0) && (
                    <p className="mt-2 text-xs text-emerald-300">
                        No pending rewards remain. Creators with complete bank setup can now request payout.
                    </p>
                )}
            </section>

            {diagnostics?.autoPayoutEnabled && (
                <p className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    Warning: <code>auto_payout_enabled=true</code>. Product policy is manual finance only.
                </p>
            )}

            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-4 break-all text-sm text-emerald-300">{message}</p>}

            <section className="mt-8">
                <h2 className="text-sm font-black uppercase tracking-wide text-ink-400">
                    Who needs paying / setup
                </h2>
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
                                                pending {money(r.pending_amount_minor, r.currency_code)} ·{" "}
                                                held {money(r.held_amount_minor, r.currency_code)}
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
                {payouts.map((p) => {
                    const facts = {
                        status: p.status,
                        hasHold: p.hasHold,
                        providerQuoteRef: p.providerQuoteRef,
                        providerTransferRef: p.providerTransferRef,
                    };
                    const transferPrepared = isTransferPrepared(facts);
                    const preparingIncomplete = isPreparationIncomplete(facts);
                    const canPrepare = canPrepareStep(facts);
                    const canRecord = canRecordManualTransfer(p.status);
                    const canConfirm = canConfirmPaid(facts);
                    const step1Label = step1ActionLabel(facts);
                    const isPaid = p.status === "paid" || Boolean(p.paidAt);

                    return (
                        <article key={p.payoutId} className="rounded-2xl border border-line-300 px-4 py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="font-semibold text-white">
                                    {isPaid ? "✓ Paid" : `${money(p.amountMinor, p.currencyCode)} · ${p.status}`}
                                </h3>
                                <span className="text-xs uppercase text-ink-400">
                                    {p.provider}/{p.environment}
                                    {p.reviewTier ? ` · ${p.reviewTier}` : ""}
                                </span>
                            </div>
                            {isPaid && (
                                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-50">
                                    <p className="font-bold">
                                        {money(p.amountMinor, p.currencyCode)}
                                        {p.providerFinalTargetAmountMinor != null
                                            ? ` → ${money(p.providerFinalTargetAmountMinor, p.providerFinalTargetCurrency || p.targetCurrency || p.currencyCode)}`
                                            : p.quoteTargetAmountMinor != null
                                              ? ` → ${money(p.quoteTargetAmountMinor, p.quoteTargetCurrency || p.targetCurrency || p.currencyCode)} (quoted)`
                                              : ""}
                                    </p>
                                    <p className="mt-1 text-xs text-emerald-100/85">
                                        Paid via Wise
                                        {p.providerTransferRef ? ` · transfer ${p.providerTransferRef}` : ""}
                                    </p>
                                    {p.providerPaymentReference && (
                                        <p className="mt-1 text-xs text-emerald-100/85">
                                            Reference {p.providerPaymentReference}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-emerald-100/70">
                                        Paid {formatDateTime(p.paidAt)} · payout hold: {p.hasHold ? "released / historical record" : "none"}
                                    </p>
                                </div>
                            )}
                            {p.targetCurrency &&
                                p.targetCurrency !== p.currencyCode &&
                                !p.paidAt && (
                                <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                                    BETA / FIRST-PAYOUT REVIEW — destination {p.targetCurrency}. Confirm recipient,
                                    estimate, held reconciliation, then send manually in Wise. Do not auto-fund.
                                </p>
                            )}
                            {!p.paidAt && p.targetCurrency && p.targetCurrency === p.currencyCode && (
                                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
                                    Manual finance review required. Confirm masked destination and Available→Held
                                    before sending.
                                </p>
                            )}
                            <p className="mt-1 text-xs text-ink-500">
                                {p.payoutId} · user {p.userId.slice(0, 8)}… · transfer{" "}
                                {p.providerTransferRef || "—"}
                                {p.hasHold ? ` · payout hold ${isPaid ? "recorded/released" : "recorded"}` : ""}
                            </p>
                            {(p.targetCurrency || p.estimateTargetAmountMinor != null) && (
                                <p className="mt-1 text-xs text-ink-400">
                                    Dest {p.targetCurrency || "—"}
                                    {p.estimateTargetAmountMinor != null
                                        ? ` · est ${money(p.estimateTargetAmountMinor, p.targetCurrency || p.currencyCode)}`
                                        : ""}
                                    {p.quoteTargetAmountMinor != null
                                        ? ` · final ${money(p.quoteTargetAmountMinor, p.quoteTargetCurrency || p.targetCurrency || p.currencyCode)} @ ${p.quoteRate ?? "—"}`
                                        : ""}
                                </p>
                            )}
                            {preparingIncomplete && (
                                <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                                    Wise quote created, but transfer preparation is incomplete. Resume
                                    preparation to create the Wise transfer — or confirm the creator has
                                    re-submitted their payout destination if the recipient address was
                                    incomplete.
                                </p>
                            )}
                            {p.destination && (
                                <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-ink-300">
                                    <p className="font-semibold text-white">Resolved payout destination</p>
                                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                                        <p>
                                            Recipient:{" "}
                                            <span className="text-ink-100">
                                                {p.destination.recipientRefMasked || "Not provided"}
                                            </span>
                                        </p>
                                        <p>
                                            Active profile:{" "}
                                            <span className="text-ink-100">
                                                {shortId(p.destination.activeProfileId)}
                                            </span>{" "}
                                            · {p.destination.profileStatus || "—"}
                                        </p>
                                    </div>
                                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                                        <p>
                                            Country:{" "}
                                            <span className="text-ink-100">
                                                {p.destination.addressCountry || "Not provided"}
                                            </span>
                                        </p>
                                        <p>
                                            City:{" "}
                                            <span className="text-ink-100">
                                                {p.destination.addressCity || "Not provided"}
                                            </span>
                                        </p>
                                        <p>
                                            Postcode:{" "}
                                            <span className="text-ink-100">
                                                {p.destination.addressPostCode || "Not provided"}
                                            </span>
                                        </p>
                                        <p>
                                            Address line 1:{" "}
                                            <span className="text-ink-100">
                                                {p.destination.addressFirstLine || "Not provided"}
                                            </span>
                                        </p>
                                        {p.destination.addressState ? (
                                            <p>
                                                State / region:{" "}
                                                <span className="text-ink-100">
                                                    {p.destination.addressState}
                                                </span>
                                            </p>
                                        ) : null}
                                    </div>
                                    {p.destination.usingRecovery && (
                                        <p className="mt-1 text-amber-200">
                                            Original payout profile: {shortId(p.destination.originalProfileId)} ·
                                            Active recovery profile: {shortId(p.destination.activeProfileId)} ·
                                            Using current active destination for recovery
                                        </p>
                                    )}
                                    <p className="mt-1">
                                        Address validation:{" "}
                                        {p.destination.addressComplete ? (
                                            <span className="text-emerald-300">Complete</span>
                                        ) : (
                                            <span className="text-rose-300">
                                                Missing: {p.destination.missingAddressLabels.join(", ") || "—"}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}
                            {p.providerTransferRef && !p.paidAt && (
                                <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100">
                                    Ready to send in Wise. Transfer {p.providerTransferRef}; status{" "}
                                    {p.providerStatus || "unknown"}. Do not mark Paid until Wise reports
                                    outgoing_payment_sent.
                                </p>
                            )}

                            <div className="mt-3 flex flex-wrap gap-2">
                                {isPaid ? (
                                    <>
                                        <button
                                            type="button"
                                            disabled={!transferPrepared}
                                            onClick={() => openWiseTransfer(p)}
                                            className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100 disabled:opacity-50"
                                        >
                                            Open in Wise
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy || !transferPrepared || !canFinance}
                                            onClick={() => run("refresh_status", p.payoutId)}
                                            className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                                        >
                                            Refresh provider status
                                        </button>
                                    </>
                                ) : (
                                    <>
                                <button
                                    type="button"
                                    disabled={busy || !canPrepare || !canFinance}
                                    onClick={() => run("approve_prepare", p.payoutId)}
                                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100 disabled:opacity-50"
                                >
                                    {step1Label}
                                </button>
                                <button
                                    type="button"
                                    disabled={!transferPrepared}
                                    onClick={() => openWiseTransfer(p)}
                                    className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100 disabled:opacity-50"
                                >
                                    2. Open Wise to send
                                </button>
                                <button
                                    type="button"
                                    disabled={busy || !transferPrepared || !canFinance}
                                    onClick={() => run("refresh_status", p.payoutId)}
                                    className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                                >
                                    Refresh Wise status
                                </button>
                                <button
                                    type="button"
                                    disabled={busy || !canConfirm || !canFinance}
                                    onClick={() => run("confirm_paid", p.payoutId)}
                                    className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-100 disabled:opacity-50"
                                >
                                    3. Confirm Paid from Wise
                                </button>
                                <button
                                    type="button"
                                    disabled={busy || !canRecord || !canFinance}
                                    onClick={() => openRecord(p)}
                                    className="rounded-md border border-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-100 disabled:opacity-50"
                                >
                                    Manual fallback
                                </button>
                                {!autoExecuteBlocked && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={busy || !canFinance}
                                            onClick={() => run("approve_execute", p.payoutId)}
                                            className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                                        >
                                            Sandbox auto-execute
                                        </button>
                                    </>
                                )}
                                    </>
                                )}
                            </div>

                            {!isPaid && recordFor === p.payoutId && (
                                <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
                                    <p className="text-xs text-amber-100 sm:col-span-2">
                                        Manual fallback only. Normal flow should use the prepared Wise transfer and
                                        provider status/webhook reconciliation.
                                    </p>
                                    <label className="text-xs text-ink-400 sm:col-span-2">
                                        Wise transfer id
                                        <input
                                            className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                                            value={recordForm.providerTransferRef}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    providerTransferRef: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <label className="text-xs text-ink-400">
                                        Source currency
                                        <input
                                            className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                                            value={recordForm.quoteSourceCurrency}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteSourceCurrency: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <label className="text-xs text-ink-400">
                                        Target currency
                                        <input
                                            className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                                            value={recordForm.quoteTargetCurrency}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteTargetCurrency: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <label className="text-xs text-ink-400">
                                        Source amount
                                        <input
                                            className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                                            value={recordForm.quoteSourceAmount}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteSourceAmount: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <label className="text-xs text-ink-400">
                                        Target amount
                                        <input
                                            className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                                            value={recordForm.quoteTargetAmount}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteTargetAmount: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <label className="text-xs text-ink-400">
                                        Fee (company-absorbed)
                                        <input
                                            className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                                            value={recordForm.quoteFeeAmount}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteFeeAmount: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <label className="text-xs text-ink-400">
                                        Rate
                                        <input
                                            className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                                            value={recordForm.quoteRate}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({...f, quoteRate: e.target.value}))
                                            }
                                        />
                                    </label>
                                    <div className="flex gap-2 sm:col-span-2">
                                        <button
                                            type="button"
                                            disabled={busy || !canFinance}
                                            onClick={() => void submitRecord()}
                                            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                        >
                                            Save Wise record
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy || !canFinance}
                                            onClick={() => run("confirm_paid_manual_override", p.payoutId)}
                                            className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-100 disabled:opacity-50"
                                        >
                                            Confirm Paid manual override
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRecordFor(null)}
                                            className="rounded-md border border-white/20 px-3 py-1.5 text-xs"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </article>
                    );
                })}
                {payouts.length === 0 && (
                    <p className="text-sm text-ink-500">No payout requests yet.</p>
                )}
            </section>
        </main>
    );
}
