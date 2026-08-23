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
    homeSupporting: "Track real-money earnings from eligible AnimalDex programs.",
    emptyTitle: "No Earnings yet",
    emptyBody: "Creator Rewards and other eligible AnimalDex earnings will appear here when available.",
    creditsAreSeparateTitle: "Credits are separate",
    creditsAreSeparateBody: "Credits are AnimalDex virtual currency and cannot be withdrawn or converted into Earnings.",
    payoutsTitle: "Payouts",
    payoutsComingLater: "Coming later",
    availableNoPayoutNote: "Payouts aren’t available yet. Your available Earnings will remain recorded here.",
    giftsSignal: "Genuine Gift activity may contribute as one limited community-support signal. The Credit price of a Gift does not determine your reward.",
    score: "AnimalDex Score is a public reputation metric. Creator Rewards use separate period-specific contribution calculations.",
    pool: "Creator Rewards are allocated from an AnimalDex-funded reward pool. Gift prices, Credits, XP, and AnimalDex Score are not directly converted into cash.",
} as const;
