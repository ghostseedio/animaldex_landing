"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {FinanceOperatorSignInCard, useFinanceActor} from "@/app/admin/_components/finance-operator-auth";
import {
    AdminPage,
    Alert,
    Badge,
    Button,
    buttonVariants,
    Card,
    CardHeader,
    EmptyState,
    Field,
    fieldClass,
    ListSkeleton,
    PageHeader,
    Section,
    Table,
    TableSkeleton,
    TD,
    TH
} from "@/components/admin/ui";
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
    // Which button started the in-flight action, so only it shows a spinner.
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
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
        load()
            .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
            .finally(() => setInitialLoading(false));
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
        setBusyAction(`${action}:${payoutId}`);
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
            setBusyAction(null);
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
        setBusyAction("release_posted_creator_rewards");
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
            setBusyAction(null);
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

    const isBusy = (action: string, payoutId: string) => busyAction === `${action}:${payoutId}`;
    const manualFieldClass = `${fieldClass} mt-1 py-1.5`;

    return (
        <AdminPage className="text-ink-100">
            <PageHeader
                eyebrow="Creator economy"
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        Payouts
                        {diagnostics ? (
                            <Badge tone={diagnostics.isProduction ? "bad" : "good"}>
                                {diagnostics.isProduction ? "PRODUCTION — REAL MONEY" : "WISE SANDBOX"}
                            </Badge>
                        ) : null}
                    </span>
                }
                description={
                    <>
                        Ghostseed Ltd pays creators from Available Earnings via Wise. Model:{" "}
                        <strong className="text-ink-200">request → Held → Approve → manual Wise → record → Paid</strong>.
                        Target SLA: {readiness?.payout_sla_days ?? 14} days. Auto-payout stays off.
                    </>
                }
                actions={
                    <Link href="/admin/payout-corridors" className={buttonVariants({size: "sm"})}>
                        Corridors
                    </Link>
                }
            />

            <div className="mt-6 space-y-3">
                {actorLoaded && canFinance && (
                    <Alert tone="good" title={`Named finance operator: ${actor?.email}`}>
                        Finance actions are enabled for this session.
                    </Alert>
                )}

                {actorLoaded && !canFinance && (
                    <div>
                        <Alert tone="warn" title="Finance actions locked">
                            Your current session is a shared-password admin session, which cannot approve
                            payouts. Sign in as a named finance operator below to enable payout approvals.
                        </Alert>
                        <FinanceOperatorSignInCard onSignedIn={signedIn} />
                    </div>
                )}

                {diagnostics && (
                    <Alert tone="warn" title={diagnostics.banner}>
                        <span className="font-mono text-xs">
                            AnimalDex={diagnostics.animaldexEnvironment} · payouts_enabled=
                            {String(diagnostics.payoutsEnabled)} · auto_payout=
                            {String(diagnostics.autoPayoutEnabled)} · credentials=
                            {String(diagnostics.wiseCredentialsConfigured)} · profile=
                            {String(diagnostics.wiseProfileBound)} · balance=
                            {String(Boolean(diagnostics.wiseBalanceBound))} · webhook=
                            {String(diagnostics.webhookPublicKeyConfigured)}
                        </span>
                    </Alert>
                )}

                {diagnostics?.autoPayoutEnabled && (
                    <Alert tone="bad">
                        Warning: <code>auto_payout_enabled=true</code>. Product policy is manual finance only.
                    </Alert>
                )}

                {error && <Alert tone="bad">{error}</Alert>}
                {message && (
                    <Alert tone="good">
                        <span className="break-all">{message}</span>
                    </Alert>
                )}
            </div>

            <Section title="How to pay a creator" className="mt-6">
                <Card className="p-4">
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-300">
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
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-300 pt-4">
                        <Button
                            size="sm"
                            variant={hasPendingRewards ? "primary" : "outline"}
                            disabled={busy || !hasPendingRewards}
                            loading={busyAction === "release_posted_creator_rewards"}
                            onClick={() => void releasePostedCreatorRewards()}
                        >
                            {hasPendingRewards ? "Release posted rewards to Available" : "Posted rewards already Available"}
                        </Button>
                        {!hasPendingRewards && rows.some((r) => Number(r.available_amount_minor || 0) > 0) && (
                            <p className="text-xs text-emerald-300">
                                No pending rewards remain. Creators with complete bank setup can now request payout.
                            </p>
                        )}
                    </div>
                </Card>
            </Section>

            <Section title="Who needs paying / setup">
                <Card>
                    {initialLoading && rows.length === 0 ? (
                        <TableSkeleton rows={4} columns={5} />
                    ) : rows.length === 0 ? (
                        <EmptyState
                            className="m-4"
                            title="No Earnings balances yet"
                            description="Post Creator Rewards to Earnings first."
                        />
                    ) : (
                        <Table minWidth={760}>
                            <thead>
                                <tr>
                                    <TH>Creator</TH>
                                    <TH>Available</TH>
                                    <TH>Bank setup</TH>
                                    <TH>Pay by</TH>
                                    <TH>Next step</TH>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={`${r.user_id}-${r.currency_code}`}>
                                        <TD className="text-white">
                                            {r.display_name || r.username || r.user_id.slice(0, 8)}
                                            <span className="block text-xs text-ink-500">
                                                {r.beta_member ? "beta" : "not beta"} · {r.currency_code}
                                            </span>
                                        </TD>
                                        <TD className="tabular-nums">
                                            {money(r.available_amount_minor, r.currency_code)}
                                            <span className="block text-xs text-ink-500">
                                                pending {money(r.pending_amount_minor, r.currency_code)} ·{" "}
                                                held {money(r.held_amount_minor, r.currency_code)}
                                            </span>
                                        </TD>
                                        <TD>
                                            {r.setup_complete ? (
                                                <Badge tone="good">{r.masked_destination || "Ready"}</Badge>
                                            ) : (
                                                <Badge tone="warn">Needs bank details</Badge>
                                            )}
                                        </TD>
                                        <TD className="tabular-nums text-ink-300">
                                            {r.target_pay_by
                                                ? `${r.target_pay_by}${
                                                      typeof r.days_until_due === "number"
                                                          ? ` (${r.days_until_due}d)`
                                                          : ""
                                                  }`
                                                : "—"}
                                        </TD>
                                        <TD className="text-ink-300">{r.next_admin_step}</TD>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card>
            </Section>

            <Section title="Payout requests">
                <div className="space-y-3">
                {initialLoading && payouts.length === 0 && <ListSkeleton rows={3} />}
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
                        <Card key={p.payoutId} className="p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="flex flex-wrap items-center gap-2 font-semibold tabular-nums text-white">
                                    {isPaid ? (
                                        <Badge tone="good">✓ Paid</Badge>
                                    ) : (
                                        <>
                                            {money(p.amountMinor, p.currencyCode)}
                                            <Badge tone="neutral">{p.status}</Badge>
                                        </>
                                    )}
                                </h3>
                                <span className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
                                    {p.provider}/{p.environment}
                                    {p.reviewTier ? ` · ${p.reviewTier}` : ""}
                                </span>
                            </div>
                            {isPaid && (
                                <div className="mt-3 border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-50">
                                    <p className="font-bold tabular-nums">
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
                                <Alert tone="warn" className="mt-3 text-xs font-semibold">
                                    BETA / FIRST-PAYOUT REVIEW — destination {p.targetCurrency}. Confirm recipient,
                                    estimate, held reconciliation, then send manually in Wise. Do not auto-fund.
                                </Alert>
                            )}
                            {!p.paidAt && p.targetCurrency && p.targetCurrency === p.currencyCode && (
                                <Alert tone="warn" className="mt-3 text-xs">
                                    Manual finance review required. Confirm masked destination and Available→Held
                                    before sending.
                                </Alert>
                            )}
                            <p className="mt-2 font-mono text-[11px] text-ink-500">
                                {p.payoutId} · user {p.userId.slice(0, 8)}… · transfer{" "}
                                {p.providerTransferRef || "—"}
                                {p.hasHold ? ` · payout hold ${isPaid ? "recorded/released" : "recorded"}` : ""}
                            </p>
                            {(p.targetCurrency || p.estimateTargetAmountMinor != null) && (
                                <p className="mt-1 text-xs tabular-nums text-ink-400">
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
                                <Alert tone="warn" className="mt-3 text-xs font-semibold">
                                    Wise quote created, but transfer preparation is incomplete. Resume
                                    preparation to create the Wise transfer — or confirm the creator has
                                    re-submitted their payout destination if the recipient address was
                                    incomplete.
                                </Alert>
                            )}
                            {p.destination && (
                                <div className="mt-3 border border-line-300 bg-canvas-900 px-3 py-3 text-xs text-ink-300">
                                    <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Resolved payout destination</p>
                                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
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
                                <Alert tone="good" className="mt-3 text-xs">
                                    Ready to send in Wise. Transfer {p.providerTransferRef}; status{" "}
                                    {p.providerStatus || "unknown"}. Do not mark Paid until Wise reports
                                    outgoing_payment_sent.
                                </Alert>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2 border-t border-line-300 pt-3">
                                {isPaid ? (
                                    <>
                                        <Button
                                            size="sm"
                                            disabled={!transferPrepared}
                                            onClick={() => openWiseTransfer(p)}
                                        >
                                            Open in Wise
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={busy || !transferPrepared || !canFinance}
                                            loading={isBusy("refresh_status", p.payoutId)}
                                            onClick={() => run("refresh_status", p.payoutId)}
                                        >
                                            Refresh provider status
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    disabled={busy || !canPrepare || !canFinance}
                                    loading={isBusy("approve_prepare", p.payoutId)}
                                    onClick={() => run("approve_prepare", p.payoutId)}
                                >
                                    {step1Label}
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={!transferPrepared}
                                    onClick={() => openWiseTransfer(p)}
                                >
                                    2. Open Wise to send
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy || !transferPrepared || !canFinance}
                                    loading={isBusy("refresh_status", p.payoutId)}
                                    onClick={() => run("refresh_status", p.payoutId)}
                                >
                                    Refresh Wise status
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={busy || !canConfirm || !canFinance}
                                    loading={isBusy("confirm_paid", p.payoutId)}
                                    onClick={() => run("confirm_paid", p.payoutId)}
                                >
                                    3. Confirm Paid from Wise
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-amber-100"
                                    disabled={busy || !canRecord || !canFinance}
                                    onClick={() => openRecord(p)}
                                >
                                    Manual fallback
                                </Button>
                                {!autoExecuteBlocked && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={busy || !canFinance}
                                            loading={isBusy("approve_execute", p.payoutId)}
                                            onClick={() => run("approve_execute", p.payoutId)}
                                        >
                                            Sandbox auto-execute
                                        </Button>
                                    </>
                                )}
                                    </>
                                )}
                            </div>

                            {!isPaid && recordFor === p.payoutId && (
                                <div className="mt-4 grid gap-3 border border-line-300 bg-canvas-900 p-4 sm:grid-cols-2">
                                    <p className="text-xs text-amber-100 sm:col-span-2">
                                        Manual fallback only. Normal flow should use the prepared Wise transfer and
                                        provider status/webhook reconciliation.
                                    </p>
                                    <Field label="Wise transfer id" className="sm:col-span-2">
                                        <input
                                            className={manualFieldClass}
                                            value={recordForm.providerTransferRef}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    providerTransferRef: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field label="Source currency">
                                        <input
                                            className={manualFieldClass}
                                            value={recordForm.quoteSourceCurrency}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteSourceCurrency: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field label="Target currency">
                                        <input
                                            className={manualFieldClass}
                                            value={recordForm.quoteTargetCurrency}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteTargetCurrency: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field label="Source amount">
                                        <input
                                            className={`${manualFieldClass} tabular-nums`}
                                            value={recordForm.quoteSourceAmount}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteSourceAmount: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field label="Target amount">
                                        <input
                                            className={`${manualFieldClass} tabular-nums`}
                                            value={recordForm.quoteTargetAmount}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteTargetAmount: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field label="Fee (company-absorbed)">
                                        <input
                                            className={`${manualFieldClass} tabular-nums`}
                                            value={recordForm.quoteFeeAmount}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({
                                                    ...f,
                                                    quoteFeeAmount: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field label="Rate">
                                        <input
                                            className={`${manualFieldClass} tabular-nums`}
                                            value={recordForm.quoteRate}
                                            onChange={(e) =>
                                                setRecordForm((f) => ({...f, quoteRate: e.target.value}))
                                            }
                                        />
                                    </Field>
                                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            disabled={busy || !canFinance}
                                            loading={isBusy("record_wise_transfer", p.payoutId)}
                                            onClick={() => void submitRecord()}
                                        >
                                            Save Wise record
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            disabled={busy || !canFinance}
                                            loading={isBusy("confirm_paid_manual_override", p.payoutId)}
                                            onClick={() => run("confirm_paid_manual_override", p.payoutId)}
                                        >
                                            Confirm Paid manual override
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setRecordFor(null)}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
                {!initialLoading && payouts.length === 0 && (
                    <EmptyState title="No payout requests yet." />
                )}
                </div>
            </Section>
        </AdminPage>
    );
}
