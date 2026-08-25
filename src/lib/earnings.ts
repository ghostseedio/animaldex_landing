/**
 * Phase 2 Earnings ledger decode contracts for web.
 * No UI wiring. No fake balances. Server remains authoritative.
 */

export type EarningsCurrencyBalance = {
    currencyCode: string;
    pendingAmountMinor: number;
    availableAmountMinor: number;
    heldAmountMinor: number;
    paidAmountMinor: number;
    lifetimeEarnedAmountMinor: number;
};

export type EarningsSummary = {
    balances: EarningsCurrencyBalance[];
};

export type EarningEntry = {
    id: string;
    currencyCode: string;
    amountMinor: number;
    sourceType: string;
    displayStatus: string;
    displayLabel: string;
    createdAt: string;
    sourceReference: string;
};

export const EARNINGS_ALLOWED_SOURCE_TYPES = [
    "creator_reward",
    "guide_settlement",
    "campaign_reward",
    "adjustment",
    "payout",
] as const;

export const EARNINGS_FORBIDDEN_SOURCE_TYPES = [
    "credit",
    "gift",
    "endorsement",
    "xp",
    "score",
    "pvp",
    "pack",
    "credit_offer",
] as const;

export function mapEarningsSummaryRow(row: Record<string, unknown>): EarningsCurrencyBalance {
    return {
        currencyCode: String(row.currency_code ?? ""),
        pendingAmountMinor: Number(row.pending_amount_minor ?? 0),
        availableAmountMinor: Number(row.available_amount_minor ?? 0),
        heldAmountMinor: Number(row.held_amount_minor ?? 0),
        paidAmountMinor: Number(row.paid_amount_minor ?? 0),
        lifetimeEarnedAmountMinor: Number(row.lifetime_earned_amount_minor ?? 0),
    };
}

export function mapEarningEntryRow(row: Record<string, unknown>): EarningEntry {
    return {
        id: String(row.id ?? ""),
        currencyCode: String(row.currency_code ?? ""),
        amountMinor: Number(row.amount_minor ?? 0),
        sourceType: String(row.source_type ?? ""),
        displayStatus: String(row.display_status ?? ""),
        displayLabel: String(row.display_label ?? ""),
        createdAt: String(row.created_at ?? ""),
        sourceReference: String(row.source_reference ?? ""),
    };
}


export type CreatorRewardReceiptSummary = {
    periodId: string;
    periodSlug: string;
    periodDisplayName: string;
    periodStart: string | null;
    periodEnd: string | null;
    currencyCode: string;
    amountMinor: number;
    status: string;
    eligibilityState: string;
    contributionCategories: string[];
    createdAt: string | null;
};

export type CreatorRewardReceiptDetail = CreatorRewardReceiptSummary & {
    eligibilityMessage: string | null;
};

export function mapCreatorRewardReceiptSummary(row: Record<string, unknown>): CreatorRewardReceiptSummary {
    return {
        periodId: String(row.period_id ?? ""),
        periodSlug: String(row.period_slug ?? ""),
        periodDisplayName: String(row.period_display_name ?? ""),
        periodStart: row.period_start ? String(row.period_start) : null,
        periodEnd: row.period_end ? String(row.period_end) : null,
        currencyCode: String(row.currency_code ?? ""),
        amountMinor: Number(row.amount_minor ?? 0),
        status: String(row.status ?? ""),
        eligibilityState: String(row.eligibility_state ?? ""),
        contributionCategories: Array.isArray(row.contribution_categories)
            ? row.contribution_categories.map(String)
            : [],
        createdAt: row.created_at ? String(row.created_at) : null,
    };
}

export function mapCreatorRewardReceiptDetail(row: Record<string, unknown>): CreatorRewardReceiptDetail {
    return {
        ...mapCreatorRewardReceiptSummary(row),
        eligibilityMessage: row.eligibility_message ? String(row.eligibility_message) : null,
    };
}

export type CreatorRewardPeriodProgress = {
    featureEnabled: boolean;
    mayParticipate: boolean;
    isProvisional: boolean;
    eligibility: {state: string; message: string | null};
    period: {
        id: string;
        displayName: string;
        status: string;
        currencyCode: string;
        poolAmountMinor: number | null;
        daysRemaining: number | null;
        timelineFraction: number | null;
    } | null;
    activity: {
        liveCaptureCount: number;
        uniqueSpeciesCount: number;
        activeDays: number;
        averageGrade: number | null;
        giftUniqueSenders: number;
        giftCount: number;
    };
    signals: Array<{
        key: string;
        title: string;
        subtitle: string;
        count: number;
        target: number;
        fraction: number;
        active: boolean;
        systemImage?: string;
    }>;
};

export function mapCreatorRewardPeriodProgress(raw: unknown): CreatorRewardPeriodProgress {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const eligibility = (row.eligibility && typeof row.eligibility === "object"
        ? row.eligibility
        : {}) as Record<string, unknown>;
    const period = row.period && typeof row.period === "object" ? (row.period as Record<string, unknown>) : null;
    const activity = (row.activity && typeof row.activity === "object" ? row.activity : {}) as Record<string, unknown>;
    const signals = Array.isArray(row.signals) ? row.signals : [];

    return {
        featureEnabled: Boolean(row.featureEnabled),
        mayParticipate: Boolean(row.mayParticipate),
        isProvisional: row.isProvisional !== false,
        eligibility: {
            state: String(eligibility.state ?? "feature_disabled"),
            message: eligibility.message ? String(eligibility.message) : null,
        },
        period: period
            ? {
                  id: String(period.id ?? ""),
                  displayName: String(period.displayName ?? ""),
                  status: String(period.status ?? ""),
                  currencyCode: String(period.currencyCode ?? "GBP"),
                  poolAmountMinor:
                      period.poolAmountMinor == null ? null : Number(period.poolAmountMinor),
                  daysRemaining: period.daysRemaining == null ? null : Number(period.daysRemaining),
                  timelineFraction:
                      period.timelineFraction == null ? null : Number(period.timelineFraction),
              }
            : null,
        activity: {
            liveCaptureCount: Number(activity.liveCaptureCount ?? 0),
            uniqueSpeciesCount: Number(activity.uniqueSpeciesCount ?? 0),
            activeDays: Number(activity.activeDays ?? 0),
            averageGrade: activity.averageGrade == null ? null : Number(activity.averageGrade),
            giftUniqueSenders: Number(activity.giftUniqueSenders ?? 0),
            giftCount: Number(activity.giftCount ?? 0),
        },
        signals: signals.map((s) => {
            const signal = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
            return {
                key: String(signal.key ?? ""),
                title: String(signal.title ?? signal.key ?? ""),
                subtitle: String(signal.subtitle ?? ""),
                count: Number(signal.count ?? 0),
                target: Number(signal.target ?? 1),
                fraction: Number(signal.fraction ?? 0),
                active: Boolean(signal.active),
                systemImage: signal.systemImage ? String(signal.systemImage) : undefined,
            };
        }),
    };
}

export function eligibilityTitle(state: string): string {
    switch (state) {
        case "participating":
            return "You're in this period";
        case "period_closing":
            return "Period closing";
        case "waiting_for_period":
            return "Waiting for a period";
        case "not_participating":
            return "Not in this group yet";
        case "excluded":
            return "Not eligible this period";
        case "feature_disabled":
            return "Creator Rewards paused";
        default:
            return "Creator Rewards";
    }
}

export type PayoutChecklistItem = {
    id: string;
    title: string;
    detail: string;
    isComplete: boolean;
};

export function payoutChecklist(setup: {
    setupComplete?: boolean;
    payoutsEnabled?: boolean;
    canWithdraw?: boolean;
    maskedDestination?: string | null;
    destinationCountry?: string | null;
    reasonCodes?: string[];
    payoutSlaDays?: number;
    availableAmountMinor?: number;
    targetPayBy?: string | null;
    blockerDetail?: string | null;
    nextStep?: string | null;
}): PayoutChecklistItem[] {
    const reasons = setup.reasonCodes ?? [];
    const done = (code: string) =>
        !reasons.some((r) => r === code || r.startsWith(code));
    const countryUnsupported = !done("country_unsupported");
    const slaDays = setup.payoutSlaDays ?? 14;
    const payByDetail = setup.targetPayBy
        ? `Target pay by ${setup.targetPayBy} (within ${slaDays} days of Available)`
        : `Ghostseed aims to pay within ${slaDays} days after Earnings become Available`;

    const setupDetail = setup.setupComplete
        ? setup.maskedDestination || "UK bank connected"
        : countryUnsupported
          ? "Bank payouts are open for United Kingdom (GBP) first. Other countries can still earn — setup opens when we add your corridor."
          : setup.blockerDetail || "Add a UK bank account (GBP via Wise). Only this step opens the form.";

    return [
        {
            id: "setup",
            title: "Payout method",
            detail: setupDetail,
            isComplete: Boolean(setup.setupComplete),
        },
        {
            id: "legal",
            title: "Eligibility (at bank setup)",
            detail:
                setup.setupComplete || (done("legal_capacity") && done("monetization_profile_missing"))
                    ? "Confirmed with your bank-setup attestation — not a separate button"
                    : "Confirm with the checkbox when you add bank details. There’s nothing to click here.",
            isComplete: done("legal_capacity") && done("monetization_profile_missing"),
        },
        {
            id: "country",
            title: "Payout country",
            detail: countryUnsupported
                ? "Your country isn’t in the live payout corridor yet (UK/GBP only). Earnings still accrue."
                : setup.destinationCountry
                  ? `${setup.destinationCountry} · live corridor is United Kingdom (GBP)`
                  : "Live corridor: United Kingdom (GBP) only. More countries come later.",
            isComplete: !countryUnsupported && Boolean(setup.setupComplete || done("country_unsupported")),
        },
        {
            id: "timeline",
            title: "When you’ll be paid",
            detail: payByDetail,
            isComplete: Boolean(setup.setupComplete && (setup.availableAmountMinor ?? 0) > 0),
        },
        {
            id: "withdrawals",
            title: "Payouts",
            detail: !setup.payoutsEnabled
                ? setup.nextStep || "Payouts open when AnimalDex enables withdrawals for your cohort"
                : setup.canWithdraw
                  ? setup.nextStep || "Finance sends Available Earnings manually — not automatic"
                  : "Enabled — finish remaining checks",
            isComplete: Boolean(setup.payoutsEnabled && setup.canWithdraw),
        },
    ];
}

export function formatEarningsMinor(amountMinor: number, currencyCode: string, locale = "en-US"): string {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode || "USD" }).format(amountMinor / 100);
}

export function hasAnyEarningsBalance(balances: EarningsCurrencyBalance[]): boolean {
    return balances.some((b) =>
        b.pendingAmountMinor !== 0 ||
        b.availableAmountMinor !== 0 ||
        b.heldAmountMinor !== 0 ||
        b.paidAmountMinor !== 0 ||
        b.lifetimeEarnedAmountMinor !== 0
    );
}

export const EARNINGS_COPY = {
    homeSupporting:
        "See what you’ve earned, when Ghostseed aims to pay you, and anything blocking payout (like bank details).",
    emptyTitle: "No Earnings yet",
    emptyBody: "Creator Rewards and other eligible AnimalDex earnings will appear here when available.",
    creditsAreSeparateTitle: "Credits are separate",
    creditsAreSeparateBody:
        "Credits are AnimalDex virtual currency. They are not cash, cannot be withdrawn, and do not convert into Earnings.",
    payoutsTitle: "Payouts",
    payoutsComingLater: "Coming later",
    availableNoPayoutNote:
        "Your Available Earnings stay recorded here until Ghostseed finance completes a payout.",
    setUpPayoutsTitle: "Add UK bank details",
    setUpPayoutsBody:
        "Bank payouts are open for the United Kingdom (GBP) first. Enter UK sort code + account number so Ghostseed can pay via Wise. We don’t keep full account numbers after setup. Other countries can still earn — payout setup opens when we add their corridor.",
    payoutsReadyTitle: "Bank details saved",
    payoutsNotAvailableYet: "Payouts aren’t open for your account yet. Your balance remains recorded.",
    giftsSignal:
        "Genuine Gift activity may contribute as one limited community-support signal. The Credit price of a Gift does not determine your reward.",
    score: "AnimalDex Score is a public reputation metric. Creator Rewards use separate period-specific contribution calculations.",
    pool: "Creator Rewards are allocated from an AnimalDex-funded reward pool. Gift prices, Credits, XP, and AnimalDex Score are not directly converted into cash.",
    paymentModelNote: "Payouts are reviewed by Ghostseed finance and are not automatic.",
    otherCountriesNote:
        "Not in the UK? You can keep earning. We’ll open bank setup for more countries later — we won’t ask you to use an unsupported corridor.",
    legalCapacityHint:
        "This checkbox is how eligibility is confirmed. There’s no separate “Eligibility confirmed” button.",
} as const;
