import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe, it} from "node:test";
import {
    canConfirmPaid,
    canPrepareStep,
    canRecordManualTransfer,
    isPreparationIncomplete,
    isTransferPrepared,
    payoutNeedsManualApproval,
    shouldReuseQuote,
    step1ActionLabel
} from "./payout-preparation-state";

const orchestrationSource = readFileSync(
    join(process.cwd(), "src/lib/wise-sandbox-payouts.ts"),
    "utf8"
);
const prepareFnSource =
    orchestrationSource.match(/export async function approveAndPrepareWiseTransfer[\s\S]*?\n\}/)?.[0] ?? "";

const FUTURE = "2099-01-01T00:00:00Z";
const PAST = "2000-01-01T00:00:00Z";

describe("payout preparation state machine", () => {
    it("quote + transfer success is a prepared state (transfer ref present)", () => {
        const facts = {
            status: "provider_transfer_created",
            hasHold: true,
            providerQuoteRef: "q1",
            providerTransferRef: "t1"
        };
        assert.equal(isTransferPrepared(facts), true);
        assert.equal(isPreparationIncomplete(facts), false);
        assert.equal(canConfirmPaid(facts), true);
        assert.equal(canPrepareStep(facts), false);
    });

    it("quote succeeds + transfer 422 leaves an incomplete, retryable state", () => {
        const facts = {
            status: "provider_quote_created",
            hasHold: true,
            providerQuoteRef: "q1",
            providerTransferRef: null
        };
        assert.equal(isPreparationIncomplete(facts), true);
        assert.equal(isTransferPrepared(facts), false);
        assert.equal(canPrepareStep(facts), true);
        assert.equal(canConfirmPaid(facts), false);
    });

    it("quote succeeds + transfer network failure is equally retryable", () => {
        const facts = {
            status: "provider_quote_created",
            hasHold: true,
            providerQuoteRef: "q1",
            providerTransferRef: null
        };
        assert.equal(canPrepareStep(facts), true);
        assert.equal(isPreparationIncomplete(facts), true);
    });

    it("stranded provider_quote_created with null transfer ref is retryable", () => {
        assert.equal(
            canPrepareStep({
                status: "provider_quote_created",
                hasHold: true,
                providerQuoteRef: "q1",
                providerTransferRef: null
            }),
            true
        );
    });

    it("does not prepare a payout that is no longer held", () => {
        assert.equal(
            canPrepareStep({
                status: "provider_quote_created",
                hasHold: false,
                providerQuoteRef: "q1",
                providerTransferRef: null
            }),
            false
        );
    });

    it("reuses a valid, unexpired quote against the same recipient", () => {
        assert.equal(
            shouldReuseQuote({
                providerQuoteRef: "q1",
                quoteExpiresAt: FUTURE,
                snapshotRecipientRef: "111",
                currentRecipientRef: "111"
            }),
            true
        );
    });

    it("replaces an expired quote", () => {
        assert.equal(
            shouldReuseQuote({
                providerQuoteRef: "q1",
                quoteExpiresAt: PAST,
                snapshotRecipientRef: "111",
                currentRecipientRef: "111"
            }),
            false
        );
    });

    it("replaces a quote when the creator re-submitted their destination", () => {
        assert.equal(
            shouldReuseQuote({
                providerQuoteRef: "q1",
                quoteExpiresAt: FUTURE,
                snapshotRecipientRef: "111",
                currentRecipientRef: "222"
            }),
            false
        );
    });

    it("never reuses a quote when no quote reference exists", () => {
        assert.equal(
            shouldReuseQuote({
                providerQuoteRef: null,
                quoteExpiresAt: FUTURE,
                snapshotRecipientRef: "111",
                currentRecipientRef: "111"
            }),
            false
        );
    });

    it("enables Resume for a quote-only held state and keeps other actions gated", () => {
        const facts = {
            status: "provider_quote_created",
            hasHold: true,
            providerQuoteRef: "q1",
            providerTransferRef: null
        };
        assert.equal(canPrepareStep(facts), true);
        assert.equal(step1ActionLabel(facts), "1. Resume Wise preparation");
        // Open Wise + Confirm Paid require a real transfer ref.
        assert.equal(isTransferPrepared(facts), false);
        assert.equal(canConfirmPaid(facts), false);
    });

    it("uses the approve label for pre-quote states", () => {
        assert.equal(
            step1ActionLabel({
                status: "approved_for_manual_payment",
                hasHold: true,
                providerQuoteRef: null,
                providerTransferRef: null
            }),
            "1. Approve + prepare Wise transfer"
        );
    });

    it("manual approval is only required for pre-approval states", () => {
        assert.equal(payoutNeedsManualApproval("requested"), true);
        assert.equal(payoutNeedsManualApproval("approved"), true);
        assert.equal(payoutNeedsManualApproval("approved_for_manual_payment"), false);
        assert.equal(payoutNeedsManualApproval("provider_quote_created"), false);
    });

    it("manual-fallback recording stays gated to prepared/processing states", () => {
        assert.equal(canRecordManualTransfer("provider_transfer_created"), true);
        assert.equal(canRecordManualTransfer("provider_quote_created"), false);
    });
});

describe("payout orchestration recovery invariants", () => {
    it("enforces the named-finance boundary before any Wise work", () => {
        assert.match(prepareFnSource, /ensureNamedFinanceOperator\(actor\)/);
    });

    it("short-circuits when a transfer reference already exists", () => {
        assert.match(prepareFnSource, /if \(payout\.provider_transfer_ref\)/);
        assert.match(prepareFnSource, /reused: true/);
    });

    it("uses the payout id as the Wise transfer idempotency key", () => {
        assert.match(prepareFnSource, /customerTransactionId: payoutId/);
    });

    it("reuses or replaces the quote based on shared state predicates", () => {
        assert.match(prepareFnSource, /shouldReuseQuote\(/);
        assert.match(prepareFnSource, /payoutNeedsManualApproval\(/);
    });

    it("never releases the hold or completes the payout during preparation", () => {
        assert.doesNotMatch(
            prepareFnSource,
            /admin_release_payout_hold|admin_complete_payout_from_hold|admin_fail_payout_and_release|admin_release_posted_creator_rewards/
        );
    });
});
