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
