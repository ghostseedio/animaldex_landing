/**
 * Pure payout-preparation state predicates shared by the Wise orchestration
 * (server) and the payouts admin UI (client) so the two stay in agreement about
 * which provider states are incomplete, recoverable, or terminal.
 *
 * Invariants encoded here:
 * - `provider_quote_created` with a null transfer ref is an *incomplete*
 *   preparation state (quote exists, transfer not yet created), never terminal.
 * - "Open Wise to send" and "Confirm Paid" require a real transfer reference.
 * - A held payout with a quote and no transfer ref is always resumable.
 */

export type PreparationFacts = {
    status: string;
    hasHold: boolean;
    providerQuoteRef: string | null;
    providerTransferRef: string | null;
};

const APPROVAL_REQUIRED_STATUSES = ["requested", "reserved", "eligibility_check", "approved"];

const PREPARATION_ACTIONABLE_STATUSES = [
    ...APPROVAL_REQUIRED_STATUSES,
    "approved_for_manual_payment",
    "provider_quote_created"
];

const RECORDABLE_MANUAL_STATUSES = [
    "approved_for_manual_payment",
    "processing",
    "reserved",
    "provider_transfer_created"
];

const CONFIRMABLE_STATUSES = ["provider_transfer_created", "processing", "approved_for_manual_payment"];

/** Still awaiting the manual-approval transition (before any Wise work). */
export function payoutNeedsManualApproval(status: string): boolean {
    return APPROVAL_REQUIRED_STATUSES.includes(status);
}

export function isQuoteCreated(facts: PreparationFacts): boolean {
    return Boolean(facts.providerQuoteRef);
}

export function isTransferPrepared(facts: PreparationFacts): boolean {
    return Boolean(facts.providerTransferRef);
}

/** Quote persisted but no transfer yet — the recoverable, incomplete state. */
export function isPreparationIncomplete(facts: PreparationFacts): boolean {
    return isQuoteCreated(facts) && !isTransferPrepared(facts);
}

/** The admin may (re)prepare this held payout. */
export function canPrepareStep(facts: PreparationFacts): boolean {
    return facts.hasHold && PREPARATION_ACTIONABLE_STATUSES.includes(facts.status);
}

export function canRecordManualTransfer(status: string): boolean {
    return RECORDABLE_MANUAL_STATUSES.includes(status);
}

/** Confirm-Paid requires a real transfer ref plus a prepared/processing status. */
export function canConfirmPaid(facts: PreparationFacts): boolean {
    return isTransferPrepared(facts) && CONFIRMABLE_STATUSES.includes(facts.status);
}

export function step1ActionLabel(facts: PreparationFacts): string {
    return isPreparationIncomplete(facts)
        ? "1. Resume Wise preparation"
        : "1. Approve + prepare Wise transfer";
}

/**
 * Whether a persisted quote may be reused for transfer creation. A quote is
 * reused only when it exists, is not expired, and was created against the same
 * recipient reference now in use.
 */
export function shouldReuseQuote(facts: {
    providerQuoteRef: string | null;
    quoteExpiresAt: string | null;
    snapshotRecipientRef: string;
    currentRecipientRef: string;
    now?: number;
}): boolean {
    if (!facts.providerQuoteRef) return false;
    const expiresAt = facts.quoteExpiresAt ? new Date(facts.quoteExpiresAt).getTime() : NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= (facts.now ?? Date.now())) return false;
    if (Boolean(facts.snapshotRecipientRef) && facts.snapshotRecipientRef !== facts.currentRecipientRef) {
        return false;
    }
    return true;
}
