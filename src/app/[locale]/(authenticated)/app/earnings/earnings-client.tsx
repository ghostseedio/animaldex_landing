"use client";

import {useEffect, useState} from "react";
import {
    EARNINGS_COPY,
    eligibilityTitle,
    formatEarningsMinor,
    hasAnyEarningsBalance,
    payoutChecklist,
    scrubConsumerPayoutCopy,
    type CreatorRewardPeriodProgress,
    type EarningActivityItem,
    type CreatorRewardReceiptSummary,
    type EarningEntry,
    type EarningsCurrencyBalance,
} from "@/lib/earnings";

type PayoutCorridor = {
    id?: string;
    countryCode: string;
    currencyCode?: string;
    displayName?: string;
    recipientType?: string;
    currencies: string[];
    enabledForSetup?: boolean;
    comingSoon?: boolean;
    minimumPayoutAmountMinor?: number | null;
};

type PayoutFieldOption = {
    label: string;
    value: string;
};

type PayoutField = {
    key: string;
    label: string;
    type: string;
    required: boolean;
    minLength?: number | null;
    maxLength?: number | null;
    pattern?: string | null;
    options?: PayoutFieldOption[] | null;
    sensitive?: boolean;
    group?: string | null;
    defaultValue?: string | null;
    readOnly?: boolean;
};

const SEARCHABLE_SELECT_OPTION_THRESHOLD = 12;

function normalizeFieldOptions(raw: unknown): PayoutFieldOption[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const out: PayoutFieldOption[] = [];
    for (const item of raw) {
        if (item == null) continue;
        if (typeof item === "string" || typeof item === "number") {
            const value = String(item);
            out.push({label: value, value});
            continue;
        }
        if (typeof item === "object") {
            const row = item as Record<string, unknown>;
            const value = String(row.value ?? row.key ?? "");
            if (!value) continue;
            const label = String(row.label ?? row.name ?? row.title ?? value).trim() || value;
            out.push({label, value});
        }
    }
    return out.length > 0 ? out : null;
}

function fieldUsesSearchableSelect(field: PayoutField): boolean {
    return field.type === "select" && (field.options?.length ?? 0) >= SEARCHABLE_SELECT_OPTION_THRESHOLD;
}

function fieldPresentationSection(field: PayoutField): "bank" | "address" {
    return field.group === "address" || field.key.startsWith("address.") ? "address" : "bank";
}

function optionLabel(field: PayoutField, value: string): string {
    if (!value) return "";
    return field.options?.find((o) => o.value === value)?.label ?? value;
}

type PayoutSetup = {
    setupComplete?: boolean;
    payoutsEnabled?: boolean;
    canWithdraw?: boolean;
    eligible?: boolean;
    maskedDestination?: string | null;
    setupProviderReady?: boolean;
    contactEmail?: string | null;
    destinationCountry?: string | null;
    destinationCurrency?: string | null;
    reasonCodes?: string[];
    payoutSlaDays?: number;
    availableAmountMinor?: number;
    targetPayBy?: string | null;
    blockerTitle?: string | null;
    blockerDetail?: string | null;
    nextStep?: string | null;
    corridors?: PayoutCorridor[];
};

type Payload = {
    balances: EarningsCurrencyBalance[];
    activity?: EarningActivityItem[];
    entries: EarningEntry[];
    creatorRewardReceipts: CreatorRewardReceiptSummary[];
    periodProgress?: CreatorRewardPeriodProgress | null;
    payoutSetup?: PayoutSetup | null;
};

function activitySourceLabel(sourceType: string): string {
    switch (sourceType) {
        case "creator_reward":
            return "Creator Rewards";
        case "guide_settlement":
            return "Guide earning";
        case "campaign_reward":
            return "Sponsored Challenge";
        case "payout":
            return "Payout";
        case "adjustment":
            return "Adjustment";
        default:
            return "Earnings";
    }
}

function activityStatusLabel(status: string): string {
    switch (status.toLowerCase()) {
        case "pending":
            return "Pending";
        case "available":
            return "Available";
        case "held":
            return "Held for payout";
        case "paid":
            return "Paid";
        case "adjustment":
            return "Adjustment";
        case "reversed":
        case "reversal":
            return "Reversal";
        default:
            return status.replaceAll("_", " ");
    }
}

function ProgressRing({fraction}: {fraction: number}) {
    const clamped = Math.min(1, Math.max(0, fraction));
    const r = 36;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - clamped);
    return (
        <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
                <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle
                    cx="44"
                    cy="44"
                    r={r}
                    fill="none"
                    stroke="#9AFF4A"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums">{Math.round(clamped * 100)}%</span>
                <span className="text-[10px] uppercase tracking-wide text-white/40">elapsed</span>
            </div>
        </div>
    );
}

function SignalBar({
    title,
    subtitle,
    count,
    target,
    fraction,
    active,
}: {
    title: string;
    subtitle: string;
    count: number;
    target: number;
    fraction: number;
    active: boolean;
}) {
    const fill = Math.min(100, Math.max(0, fraction * 100));
    return (
        <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="text-xs text-white/40">{subtitle}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold tabular-nums ${active ? "text-white" : "text-white/40"}`}>
                    {count}/{target}
                </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                        active ? "bg-primary-500" : "bg-white/25"
                    }`}
                    style={{width: `${Math.max(fill, fill > 0 ? 4 : 0)}%`}}
                />
            </div>
        </div>
    );
}

export function EarningsClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);
    const [setupBusy, setSetupBusy] = useState(false);
    const [setupError, setSetupError] = useState<string | null>(null);
    const [legalCapacityAttested, setLegalCapacityAttested] = useState(false);
    const [selectedCountryCode, setSelectedCountryCode] = useState("");
    const [selectedCorridorId, setSelectedCorridorId] = useState("");
    const [fieldDefs, setFieldDefs] = useState<PayoutField[]>([]);
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [fieldsLoading, setFieldsLoading] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [showRequestSheet, setShowRequestSheet] = useState(false);
    const [requestBusy, setRequestBusy] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [requestMessage, setRequestMessage] = useState<string | null>(null);
    const [estimate, setEstimate] = useState<{
        estimateAvailable?: boolean;
        targetAmountMinor?: number;
        targetCurrency?: string;
        exchangeRate?: number;
        providerFeeMinor?: number;
        note?: string;
    } | null>(null);

    async function reload() {
        const res = await fetch("/api/app/earnings", {cache: "no-store"});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load Earnings");
        setData(json);
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await reload();
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

    const hasBalances = Boolean(data && hasAnyEarningsBalance(data.balances));
    const activity = data?.activity ?? [];
    const hasAvailable = Boolean(data?.balances.some((b) => b.availableAmountMinor > 0));
    const setup = data?.payoutSetup ?? null;
    const setupComplete = Boolean(setup?.setupComplete);
    const showPayoutCard = hasAvailable || setupComplete || showSetup;
    const progress = data?.periodProgress ?? null;
    const checklist = payoutChecklist(setup ?? {});
    const checklistDone = checklist.filter((i) => i.isComplete).length;
    const accent =
        progress?.eligibility.state === "participating" || progress?.eligibility.state === "period_closing";
    const corridors = (setup?.corridors ?? []).filter((c) => c.id);
    const enabledCorridors = corridors.filter((c) => c.enabledForSetup && !c.comingSoon);
    const countries = Array.from(
        new Map(
            enabledCorridors.map((c) => [
                c.countryCode,
                {code: c.countryCode, name: c.displayName || c.countryCode},
            ])
        ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));
    const currenciesForCountry = enabledCorridors.filter((c) => c.countryCode === selectedCountryCode);
    const comingSoonNames = Array.from(
        new Set(
            corridors
                .filter((c) => !c.enabledForSetup || c.comingSoon)
                .map((c) => c.displayName || c.countryCode)
                .filter((name) => !countries.some((c) => c.name === name))
        )
    ).sort();
    const selectedCorridor = enabledCorridors.find((c) => c.id === selectedCorridorId) ?? null;
    const primaryBalance = data?.balances.find((b) => b.availableAmountMinor > 0) ?? data?.balances[0];

    function applyCountry(countryCode: string) {
        setSelectedCountryCode(countryCode);
        setSelectedCorridorId("");
        setFieldDefs([]);
        setFieldValues({});
        if (!countryCode) return;
        const options = enabledCorridors.filter((c) => c.countryCode === countryCode);
        if (options.length === 1 && options[0]?.id) {
            setSelectedCorridorId(options[0].id);
            void loadCorridorFields(options[0].id);
        }
    }

    async function loadCorridorFields(corridorId: string) {
        setFieldsLoading(true);
        setSetupError(null);
        setFieldDefs([]);
        setFieldValues({});
        try {
            const res = await fetch(`/api/app/payouts/corridors?corridorId=${encodeURIComponent(corridorId)}`, {
                cache: "no-store",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to load payment fields");
            const fields = (Array.isArray(json.requirements?.fields) ? json.requirements.fields : []).map(
                (f: Record<string, unknown>) =>
                    ({
                        ...f,
                        options: normalizeFieldOptions(f.options),
                    }) as PayoutField
            );
            setFieldDefs(fields);
            const next: Record<string, string> = {};
            for (const f of fields) next[f.key] = String(f.defaultValue ?? "");
            setFieldValues(next);
        } catch (e) {
            setSetupError(e instanceof Error ? e.message : "Failed to load payment fields");
        } finally {
            setFieldsLoading(false);
        }
    }

    async function submitSetup(event: React.FormEvent) {
        event.preventDefault();
        if (!selectedCorridorId) {
            setSetupError("Select a country first.");
            return;
        }
        setSetupBusy(true);
        setSetupError(null);
        try {
            const res = await fetch("/api/app/payouts/setup", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    corridorId: selectedCorridorId,
                    legalCapacityAttested,
                    fields: fieldValues,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Setup failed");
            setShowSetup(false);
            setFieldValues({});
            setLegalCapacityAttested(false);
            await reload();
        } catch (e) {
            setSetupError(e instanceof Error ? e.message : "Setup failed");
        } finally {
            setSetupBusy(false);
        }
    }

    async function openRequestSheet() {
        if (!primaryBalance || primaryBalance.availableAmountMinor <= 0) return;
        setShowRequestSheet(true);
        setRequestError(null);
        setRequestMessage(null);
        setEstimate(null);
        const destCurrency = setup?.destinationCurrency || selectedCorridor?.currencyCode || primaryBalance.currencyCode;
        if (destCurrency && destCurrency !== primaryBalance.currencyCode) {
            try {
                const estRes = await fetch("/api/app/payouts/estimate", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        sourceCurrency: primaryBalance.currencyCode,
                        targetCurrency: destCurrency,
                        sourceAmountMinor: primaryBalance.availableAmountMinor,
                    }),
                });
                const est = await estRes.json();
                setEstimate(est);
            } catch {
                setEstimate({estimateAvailable: false});
            }
        }
    }

    async function requestPayout() {
        if (!primaryBalance || primaryBalance.availableAmountMinor <= 0) return;
        setRequestBusy(true);
        setRequestError(null);
        setRequestMessage(null);
        try {
            const res = await fetch("/api/app/payouts/request", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    currencyCode: primaryBalance.currencyCode,
                    amountMinor: primaryBalance.availableAmountMinor,
                    idempotencyKey: `web-${primaryBalance.currencyCode}-${Date.now()}`,
                    estimateTargetAmountMinor: estimate?.targetAmountMinor ?? null,
                    estimateExchangeRate: estimate?.exchangeRate ?? null,
                    estimateProviderFeeMinor: estimate?.providerFeeMinor ?? null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Request failed");
            setRequestMessage(EARNINGS_COPY.requestPayoutHeldNote);
            await reload();
        } catch (e) {
            setRequestError(e instanceof Error ? e.message : "Request failed");
        } finally {
            setRequestBusy(false);
        }
    }

    return (
        <main className="mx-auto min-h-screen max-w-3xl bg-black px-4 py-8 text-white">
            <h1 className="font-display text-3xl font-bold">Earnings</h1>
            <p className="mt-2 text-sm text-white/60">{EARNINGS_COPY.homeSupporting}</p>

            {loading && <p className="mt-10 text-white/50">Loading…</p>}
            {error && <p className="mt-10 text-sm text-white/60">{error}</p>}

            {!loading && !error && data && (
                <div className="mt-8 space-y-6">
                    {progress && (
                        <>
                            <section
                                className={`rounded-2xl border p-5 ${
                                    accent
                                        ? "border-primary-500/35 bg-primary-500/10"
                                        : "border-white/10 bg-white/[0.04]"
                                }`}
                            >
                                <p className="text-xs font-bold uppercase tracking-wide text-white/40">
                                    Creator Rewards
                                </p>
                                <h2 className="mt-1 text-xl font-bold">
                                    {eligibilityTitle(progress.eligibility.state)}
                                </h2>
                                {progress.eligibility.message && (
                                    <p className="mt-2 text-sm text-white/60">{progress.eligibility.message}</p>
                                )}
                            </section>

                            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                {progress.period ? (
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                        <ProgressRing fraction={progress.period.timelineFraction ?? 0} />
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold">{progress.period.displayName}</p>
                                                    <p className="text-xs text-white/40">Reward period</p>
                                                </div>
                                                {progress.period.poolAmountMinor != null &&
                                                    progress.period.poolAmountMinor > 0 && (
                                                        <div className="text-right">
                                                            <p className="font-bold text-primary-500">
                                                                {formatEarningsMinor(
                                                                    progress.period.poolAmountMinor,
                                                                    progress.period.currencyCode,
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-white/40">Pool</p>
                                                        </div>
                                                    )}
                                            </div>
                                            <p className="text-sm text-white/55">
                                                {(progress.period.daysRemaining ?? 0) <= 0
                                                    ? "Ends soon"
                                                    : `${Math.round(progress.period.daysRemaining ?? 0)} days left`}
                                                {" · "}
                                                {progress.activity.liveCaptureCount} live captures
                                                {" · "}
                                                {progress.activity.uniqueSpeciesCount} species
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-semibold">No open reward period</p>
                                        <p className="mt-1 text-sm text-white/50">
                                            When AnimalDex opens the next period, your live captures and diversity
                                            will fill these meters.
                                        </p>
                                    </div>
                                )}
                            </section>

                            {progress.period && progress.signals.length > 0 && (
                                <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                    <div>
                                        <h2 className="text-lg font-bold">Your contribution signals</h2>
                                        <p className="mt-1 text-xs text-white/40">
                                            Visual progress only — not a payout estimate. Shares are calculated when
                                            the period ends.
                                        </p>
                                    </div>
                                    {progress.signals.map((s) => (
                                        <SignalBar
                                            key={s.key}
                                            title={s.title}
                                            subtitle={s.subtitle}
                                            count={s.count}
                                            target={s.target}
                                            fraction={s.fraction}
                                            active={s.active}
                                        />
                                    ))}
                                </section>
                            )}

                            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-lg font-bold">Set up payouts</h2>
                                    <span className="text-sm font-bold text-primary-500">
                                        {checklistDone}/{checklist.length}
                                    </span>
                                </div>
                                <div className="mt-3 flex gap-1.5">
                                    {checklist.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`h-1 flex-1 rounded-full ${
                                                item.isComplete ? "bg-primary-500" : "bg-white/15"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <ul className="mt-4 space-y-3">
                                    {checklist.map((item) => (
                                        <li key={item.id} className="flex gap-3">
                                            <span
                                                className={`mt-0.5 text-sm font-bold ${
                                                    item.isComplete ? "text-primary-500" : "text-white/35"
                                                }`}
                                            >
                                                {item.isComplete ? "✓" : "○"}
                                            </span>
                                            <div>
                                                <p className="font-semibold">{item.title}</p>
                                                <p className="text-xs text-white/45">{item.detail}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </>
                    )}

                    {hasBalances &&
                        data.balances.map((b) => (
                            <section key={b.currencyCode} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                                <p className="text-xs font-bold uppercase tracking-wide text-white/40">{b.currencyCode}</p>
                                <p className="mt-2 text-sm text-white/50">Available</p>
                                <p className="text-3xl font-bold tabular-nums">
                                    {formatEarningsMinor(b.availableAmountMinor, b.currencyCode)}
                                </p>
                                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <p className="text-white/40">Pending</p>
                                        <p className="font-semibold">
                                            {formatEarningsMinor(b.pendingAmountMinor, b.currencyCode)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-white/40">Held</p>
                                        <p className="font-semibold">
                                            {formatEarningsMinor(b.heldAmountMinor, b.currencyCode)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-white/40">Lifetime</p>
                                        <p className="font-semibold">
                                            {formatEarningsMinor(b.lifetimeEarnedAmountMinor, b.currencyCode)}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        ))}

                    {showPayoutCard && (
                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs font-bold uppercase text-white/40">{EARNINGS_COPY.payoutsTitle}</p>
                            {scrubConsumerPayoutCopy(setup?.blockerTitle) && (!setupComplete || !setup?.payoutsEnabled) && (
                                <>
                                    <p className="mt-1 font-semibold text-white">{scrubConsumerPayoutCopy(setup?.blockerTitle)}</p>
                                    {scrubConsumerPayoutCopy(setup?.blockerDetail) && (
                                        <p className="mt-1 text-sm text-white/55">{scrubConsumerPayoutCopy(setup?.blockerDetail)}</p>
                                    )}
                                </>
                            )}
                            {setupComplete ? (
                                <>
                                    <p className="mt-1 font-semibold text-white">{EARNINGS_COPY.payoutsReadyTitle}</p>
                                    {setup?.maskedDestination && (
                                        <p className="mt-1 text-sm text-white/60">{setup.maskedDestination}</p>
                                    )}
                                    {setup?.destinationCountry && setup?.destinationCurrency && (
                                        <p className="mt-1 text-xs text-white/45">
                                            {setup.destinationCountry} · {setup.destinationCurrency}
                                        </p>
                                    )}
                                    {setup?.targetPayBy && (setup.availableAmountMinor ?? 0) > 0 ? (
                                        <p className="mt-2 text-sm font-semibold text-primary-400">
                                            Target pay by {setup.targetPayBy}
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-sm text-white/45">
                                            We aim to pay within {setup?.payoutSlaDays ?? 14} days after your balance
                                            becomes Available. {EARNINGS_COPY.paymentModelNote}
                                        </p>
                                    )}
                                    {setup?.payoutsEnabled &&
                                        setup?.canWithdraw &&
                                        (primaryBalance?.availableAmountMinor ?? 0) > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void openRequestSheet()}
                                                    className="rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-black text-canvas-950"
                                                >
                                                    {EARNINGS_COPY.requestPayoutTitle}
                                                </button>
                                                {showRequestSheet && (
                                                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-3">
                                                        <div>
                                                            <p className="text-xs text-white/45">{EARNINGS_COPY.requestPayoutYouSend}</p>
                                                            <p className="font-bold">
                                                                {formatEarningsMinor(
                                                                    primaryBalance!.availableAmountMinor,
                                                                    primaryBalance!.currencyCode
                                                                )}
                                                            </p>
                                                        </div>
                                                        {estimate?.estimateAvailable &&
                                                            estimate.targetAmountMinor != null &&
                                                            estimate.targetCurrency && (
                                                                <>
                                                                    <div>
                                                                        <p className="text-xs text-white/45">{EARNINGS_COPY.requestPayoutYouReceive}</p>
                                                                        <p className="font-bold">
                                                                            {formatEarningsMinor(
                                                                                estimate.targetAmountMinor,
                                                                                estimate.targetCurrency
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    {estimate.exchangeRate != null && (
                                                                        <div>
                                                                            <p className="text-xs text-white/45">{EARNINGS_COPY.requestPayoutRate}</p>
                                                                            <p className="font-semibold">{estimate.exchangeRate.toFixed(4)}</p>
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <p className="text-xs text-white/45">{EARNINGS_COPY.requestPayoutFee}</p>
                                                                        <p className="font-semibold">{EARNINGS_COPY.requestPayoutFeeCovered}</p>
                                                                    </div>
                                                                    <p className="text-xs text-white/45">{EARNINGS_COPY.requestPayoutEstimateNote}</p>
                                                                </>
                                                            )}
                                                        {setup?.maskedDestination && (
                                                            <div>
                                                                <p className="text-xs text-white/45">{EARNINGS_COPY.requestPayoutMethod}</p>
                                                                <p className="font-semibold">{setup.maskedDestination}</p>
                                                            </div>
                                                        )}
                                                        {requestError && <p className="text-sm text-rose-300">{requestError}</p>}
                                                        {requestMessage && <p className="text-sm text-emerald-300">{requestMessage}</p>}
                                                        <button
                                                            type="button"
                                                            disabled={requestBusy}
                                                            onClick={() => void requestPayout()}
                                                            className="rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-black text-canvas-950 disabled:opacity-50"
                                                        >
                                                            {requestBusy ? "Requesting…" : EARNINGS_COPY.requestPayoutCTA}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    {!setup?.payoutsEnabled && (
                                        <p className="mt-2 text-sm text-white/45">{EARNINGS_COPY.payoutsNotAvailableYet}</p>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="mt-1 font-semibold text-white">{EARNINGS_COPY.setUpPayoutsTitle}</p>
                                    <p className="mt-1 text-sm text-white/55">{EARNINGS_COPY.setUpPayoutsBody}</p>
                                    {!showSetup && (
                                        <button
                                            type="button"
                                            className="mt-3 rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-black text-canvas-950"
                                            onClick={() => setShowSetup(true)}
                                            disabled={!setup?.setupProviderReady || enabledCorridors.length === 0}
                                        >
                                            {setup?.setupProviderReady && enabledCorridors.length > 0
                                                ? EARNINGS_COPY.setUpPayoutsTitle
                                                : EARNINGS_COPY.payoutsNotAvailableYet}
                                        </button>
                                    )}
                                    {showSetup && setup?.setupProviderReady && (
                                        <form className="mt-4 space-y-3" onSubmit={submitSetup}>
                                            <label className="block text-xs text-white/45">
                                                {EARNINGS_COPY.countryLabel}
                                                <select
                                                    className="mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-2 text-sm text-white"
                                                    value={selectedCountryCode}
                                                    onChange={(e) => applyCountry(e.target.value)}
                                                    required
                                                >
                                                    <option value="">Select…</option>
                                                    {countries.map((c) => (
                                                        <option key={c.code} value={c.code}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            {selectedCountryCode && currenciesForCountry.length > 1 && (
                                                <label className="block text-xs text-white/45">
                                                    {EARNINGS_COPY.currencyLabel}
                                                    <select
                                                        className="mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-2 text-sm text-white"
                                                        value={selectedCorridorId}
                                                        onChange={(e) => {
                                                            const id = e.target.value;
                                                            setSelectedCorridorId(id);
                                                            if (id) void loadCorridorFields(id);
                                                        }}
                                                        required
                                                    >
                                                        <option value="">Select…</option>
                                                        {currenciesForCountry.map((c) => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.currencyCode || c.currencies[0] || "—"}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            )}
                                            {selectedCountryCode && currenciesForCountry.length === 1 && (
                                                <p className="text-sm text-white/60">
                                                    {EARNINGS_COPY.currencyLabel}: {currenciesForCountry[0]?.currencyCode || currenciesForCountry[0]?.currencies[0]}
                                                </p>
                                            )}
                                            <button type="button" className="text-xs text-white/45 underline-offset-2 hover:underline" onClick={() => setShowComingSoon((v) => !v)}>
                                                {EARNINGS_COPY.dontSeeCountry}
                                            </button>
                                            {showComingSoon && (
                                                <p className="text-xs text-white/45">
                                                    {EARNINGS_COPY.comingSoonBody}
                                                    {comingSoonNames.length > 0 ? ` ${comingSoonNames.slice(0, 12).join(" · ")}` : ""}
                                                </p>
                                            )}
                                            {fieldsLoading && <p className="text-sm text-white/45">Loading fields…</p>}
                                            {(["bank", "address"] as const).map((section) => {
                                                const sectionFields = fieldDefs.filter((f) => fieldPresentationSection(f) === section);
                                                if (sectionFields.length === 0) return null;
                                                return (
                                                    <div key={section} className="space-y-3 border-t border-white/10 pt-4">
                                                        <p className="text-sm font-semibold text-white/80">
                                                            {section === "bank" ? "Bank details" : "Address"}
                                                        </p>
                                                        {sectionFields.map((field) => (
                                                            <label key={field.key} className="block text-xs text-white/45">
                                                                {field.label}
                                                                {field.readOnly || field.type === "readonly" ? (
                                                                    <p className="mt-1 text-sm text-white">
                                                                        {optionLabel(field, fieldValues[field.key] ?? field.defaultValue ?? "") ||
                                                                            fieldValues[field.key] ||
                                                                            field.defaultValue ||
                                                                            "—"}
                                                                    </p>
                                                                ) : field.options && field.options.length > 0 ? (
                                                                    <select
                                                                        className="mt-1 w-full border-b border-white/15 bg-transparent px-0 py-2 text-sm text-white"
                                                                        value={fieldValues[field.key] ?? ""}
                                                                        onChange={(e) => setFieldValues((v) => ({...v, [field.key]: e.target.value}))}
                                                                        required={field.required}
                                                                    >
                                                                        <option value="">Select…</option>
                                                                        {field.options.map((opt) => (
                                                                            <option key={opt.value} value={opt.value}>
                                                                                {opt.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <input
                                                                        className="mt-1 w-full border-b border-white/15 bg-transparent px-0 py-2 text-sm"
                                                                        type="text"
                                                                        autoComplete="off"
                                                                        value={fieldValues[field.key] ?? ""}
                                                                        onChange={(e) => setFieldValues((v) => ({...v, [field.key]: e.target.value}))}
                                                                        required={field.required}
                                                                        minLength={field.minLength ?? undefined}
                                                                        maxLength={field.maxLength ?? undefined}
                                                                        pattern={field.pattern ?? undefined}
                                                                    />
                                                                )}
                                                            </label>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                            <div className="space-y-3 border-t border-white/10 pt-4">
                                                <p className="text-sm font-semibold text-white/80">Confirmation</p>
                                                <label className="flex items-start gap-2 text-sm text-white/70">
                                                    <input type="checkbox" checked={legalCapacityAttested} onChange={(e) => setLegalCapacityAttested(e.target.checked)} />
                                                    {EARNINGS_COPY.legalCapacityHint}
                                                </label>
                                                <p className="text-xs text-white/40">{EARNINGS_COPY.privacyNote}</p>
                                                {setupError && <p className="text-sm text-rose-300">{setupError}</p>}
                                                <button
                                                    type="submit"
                                                    disabled={setupBusy || !legalCapacityAttested || !selectedCorridorId || fieldsLoading}
                                                    className="rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-black text-canvas-950 disabled:opacity-50"
                                                >
                                                    {setupBusy ? "Saving…" : EARNINGS_COPY.setUpPayoutsTitle}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {data.creatorRewardReceipts.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold">Reward receipts</h2>
                            <ul className="mt-3 space-y-2">
                                {data.creatorRewardReceipts.map((r) => (
                                    <li
                                        key={r.periodId}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                                    >
                                        <p className="font-semibold">{r.periodDisplayName}</p>
                                        <p className="text-sm text-white/50">
                                            {(() => {
                                                const status = String(r.status || "").toLowerCase();
                                                const proposal =
                                                    ["calculating", "calculated", "finalized"].includes(status) &&
                                                    (r.amountMinor === 0 || status === "calculating" || status === "calculated");
                                                if (proposal) {
                                                    if (status === "finalized") return "Reward confirmed · Not in Earnings yet";
                                                    if (status === "calculated") return "Calculated · Not in Earnings yet";
                                                    return "Being finalized · Not in Earnings yet";
                                                }
                                                return `${r.status} · ${formatEarningsMinor(r.amountMinor, r.currencyCode)}`;
                                            })()}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section>
                        <h2 className="text-lg font-bold">History</h2>
                        {activity.length === 0 ? (
                            <p className="mt-2 text-sm text-white/50">No Earnings history yet.</p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {activity.slice(0, 20).map((e) => (
                                    <li
                                        key={e.id}
                                        className="flex items-start justify-between gap-3 border-b border-white/5 py-3"
                                    >
                                        <div>
                                            <p className="font-semibold">{e.displayTitle}</p>
                                            <p className="text-xs text-white/45">
                                                {activitySourceLabel(e.sourceType)} · {activityStatusLabel(e.currentStatus)}
                                            </p>
                                        </div>
                                        <p className="font-bold tabular-nums">
                                            {e.amountPrefix}{formatEarningsMinor(e.amountMinor, e.currencyCode)}
                                        </p>
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
