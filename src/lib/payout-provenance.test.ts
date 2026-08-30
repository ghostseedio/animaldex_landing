import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe, it} from "node:test";
import {
    mapCreatorRewardReceiptSummary,
    parseReceiptPaymentDetails,
} from "./earnings";
import type {ProviderTransfer} from "./payout-provider";
import {majorToMinor, providerFinalSnapshotPatch} from "./payout-provenance";

const migrationSource = readFileSync(
    join(process.cwd(), "supabase/migrations/20260829182500_payout_provider_final_payment_snapshot.sql"),
    "utf8"
);

function finalTransfer(overrides: Partial<ProviderTransfer> = {}): ProviderTransfer {
    return {
        providerTransferRef: "2338505126",
        customerTransactionId: "43a4089b-cea0-4369-b754-5a89c7db6e66",
        status: "outgoing_payment_sent",
        createdAt: null,
        sourceAmount: 1.3,
        sourceCurrency: "USD",
        targetAmount: 0.96,
        targetCurrency: "GBP",
        paymentReference: "AnimalDex 43a4089b",
        ...overrides,
    };
}

describe("provider final snapshot", () => {
    it("converts decimal source/target values to integer minor units", () => {
        assert.equal(majorToMinor(1.3), 130);
        assert.equal(majorToMinor(0.96), 96);
        assert.equal(majorToMinor(null), null);
        assert.equal(majorToMinor(undefined), null);
        assert.equal(majorToMinor(Number.NaN), null);
    });

    it("does not snapshot a non-final transfer", () => {
        assert.equal(providerFinalSnapshotPatch({}, finalTransfer({status: "processing"}), "2026-01-01T00:00:00Z"), null);
        assert.equal(providerFinalSnapshotPatch({}, null, "2026-01-01T00:00:00Z"), null);
    });

    it("builds a full snapshot for an outgoing_payment_sent transfer", () => {
        const patch = providerFinalSnapshotPatch({}, finalTransfer(), "2026-08-29T12:49:14Z");
        assert.deepEqual(patch, {
            provider_final_source_amount_minor: 130,
            provider_final_source_currency: "USD",
            provider_final_target_amount_minor: 96,
            provider_final_target_currency: "GBP",
            provider_payment_reference: "AnimalDex 43a4089b",
            provider_finalized_at: "2026-08-29T12:49:14Z",
        });
    });

    it("is idempotent: never rewrites already-stored non-null facts", () => {
        const current = {
            provider_final_source_amount_minor: 130,
            provider_final_source_currency: "USD",
            provider_final_target_amount_minor: 96,
            provider_final_target_currency: "GBP",
            provider_payment_reference: "AnimalDex 43a4089b",
            provider_finalized_at: "2026-08-29T12:49:14Z",
        };
        assert.equal(providerFinalSnapshotPatch(current, finalTransfer(), "2026-08-30T00:00:00Z"), null);
    });

    it("does not erase a stored snapshot with a less-complete provider response", () => {
        const current = {
            provider_final_source_amount_minor: 130,
            provider_final_source_currency: "USD",
            provider_final_target_amount_minor: 96,
            provider_final_target_currency: "GBP",
            provider_payment_reference: "AnimalDex 43a4089b",
            provider_finalized_at: "2026-08-29T12:49:14Z",
        };
        const incomplete = finalTransfer({sourceAmount: null, targetAmount: null, paymentReference: null});
        assert.equal(providerFinalSnapshotPatch(current, incomplete, "2026-08-30T00:00:00Z"), null);
    });

    it("only fills missing fields on a partial first snapshot", () => {
        const current = {provider_final_source_currency: "USD"};
        const patch = providerFinalSnapshotPatch(current, finalTransfer(), "2026-08-29T12:49:14Z");
        assert.ok(patch);
        assert.equal(patch.provider_final_source_currency, undefined);
        assert.equal(patch.provider_final_source_amount_minor, 130);
        assert.equal(patch.provider_final_target_amount_minor, 96);
    });
});

describe("creator reward receipt provenance", () => {
    const paymentDetails = {
        paid_at: "2026-08-29T12:49:14Z",
        provider: "wise",
        sender_name: null,
        provider_transfer_ref: "2338505126",
        payment_reference: "AnimalDex 43a4089b",
        source_amount_minor: 130,
        source_currency: "USD",
        target_amount_minor: 96,
        target_currency: "GBP",
        destination_mask: "sort_code •••• 3182",
    };

    it("parses the canonical payment_details JSON object", () => {
        const details = parseReceiptPaymentDetails(paymentDetails);
        assert.equal(details.paidAt, "2026-08-29T12:49:14Z");
        assert.equal(details.provider, "wise");
        assert.equal(details.paymentMethodLabel, "Wise");
        assert.equal(details.providerTransferRef, "2338505126");
        assert.equal(details.providerPaymentReference, "AnimalDex 43a4089b");
        assert.equal(details.finalSourceAmountMinor, 130);
        assert.equal(details.finalSourceCurrency, "USD");
        assert.equal(details.finalTargetAmountMinor, 96);
        assert.equal(details.finalTargetCurrency, "GBP");
        assert.equal(details.destinationMask, "sort_code •••• 3182");
    });

    it("maps a paid receipt row with payment_details without changing the reward amount", () => {
        const mapped = mapCreatorRewardReceiptSummary({
            period_id: "p1",
            period_slug: "s1",
            period_display_name: "Period",
            currency_code: "USD",
            amount_minor: 131,
            status: "paid",
            financial_status: "paid",
            eligibility_state: "posted",
            contribution_categories: [],
            payment_details: paymentDetails,
        });
        assert.equal(mapped.amountMinor, 131);
        assert.equal(mapped.currencyCode, "USD");
        assert.equal(mapped.financialStatus, "paid");
        assert.equal(mapped.finalTargetAmountMinor, 96);
        assert.equal(mapped.finalTargetCurrency, "GBP");
        assert.equal(mapped.providerPaymentReference, "AnimalDex 43a4089b");
        assert.equal(mapped.providerTransferRef, "2338505126");
        assert.equal(mapped.paidAt, "2026-08-29T12:49:14Z");
        assert.equal(mapped.destinationMask, "sort_code •••• 3182");
    });

    it("maps an unpaid receipt row (no payment_details) with null provenance", () => {
        const mapped = mapCreatorRewardReceiptSummary({
            period_id: "p1",
            period_slug: "s1",
            period_display_name: "Period",
            currency_code: "USD",
            amount_minor: 131,
            status: "pending_credit",
            financial_status: "pending_credit",
            eligibility_state: "posted",
            contribution_categories: [],
            payment_details: null,
        });
        assert.equal(mapped.finalTargetAmountMinor, null);
        assert.equal(mapped.providerPaymentReference, null);
        assert.equal(mapped.providerTransferRef, null);
        assert.equal(mapped.paidAt, null);
        assert.equal(mapped.destinationMask, null);
    });

    it("preserves the stored destination mask verbatim (no relabeling)", () => {
        const details = parseReceiptPaymentDetails({...paymentDetails, destination_mask: "IBAN ••••1234"});
        assert.equal(details.destinationMask, "IBAN ••••1234");
    });
});

describe("payout snapshot migration", () => {
    it("adds the six nullable provider-final columns", () => {
        for (const col of [
            "provider_final_source_amount_minor",
            "provider_final_source_currency",
            "provider_final_target_amount_minor",
            "provider_final_target_currency",
            "provider_payment_reference",
            "provider_finalized_at",
        ]) {
            assert.match(migrationSource, new RegExp(`add column if not exists ${col}`));
        }
    });

    it("backfills only the known payout id, provenance-only and idempotent", () => {
        assert.match(migrationSource, /where id = '43a4089b-cea0-4369-b754-5a89c7db6e66'/);
        assert.match(migrationSource, /coalesce\(provider_final_source_amount_minor, 130\)/);
        assert.match(migrationSource, /coalesce\(provider_final_target_amount_minor, 96\)/);
        assert.match(migrationSource, /coalesce\(provider_payment_reference, 'AnimalDex 43a4089b'\)/);
        // No status / amount / ledger mutation in the backfill.
        const backfill = migrationSource.match(/update public\.payouts[\s\S]*?where id = '43a4089b-cea0-4369-b754-5a89c7db6e66';/)?.[0] ?? "";
        assert.doesNotMatch(backfill, /^\s*status\s*=/m);
        assert.doesNotMatch(backfill, /^\s*amount_minor\s*=/m);
        assert.doesNotMatch(backfill, /earning_hold/);
    });
});

describe("creator reward receipt RPC parity", () => {
    it("defines the canonical payment_details helper with the exact JSON shape", () => {
        assert.match(migrationSource, /create or replace function public\.creator_reward_receipt_payment_details/);
        for (const key of [
            "'paid_at'",
            "'provider'",
            "'sender_name'",
            "'provider_transfer_ref'",
            "'payment_reference'",
            "'source_amount_minor'",
            "'source_currency'",
            "'target_amount_minor'",
            "'target_currency'",
            "'destination_mask'",
        ]) {
            assert.match(migrationSource, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
    });

    it("maps DB provider_payment_reference to JSON payment_reference", () => {
        assert.match(migrationSource, /'payment_reference', p\.provider_payment_reference/);
    });

    it("keeps sender_name null and destination_mask verbatim (no relabeling)", () => {
        assert.match(migrationSource, /'sender_name', null::text/);
        assert.match(migrationSource, /'destination_mask', pp\.masked_destination/);
    });

    it("adds payment_details jsonb to the list RPC return table", () => {
        assert.match(migrationSource, /payment_details jsonb/);
        assert.match(migrationSource, /public\.creator_reward_receipt_payment_details\(\s*v_uid,\s*coalesce\(a\.currency_code, p\.currency_code\)\s*\)/);
    });

    it("drops the list RPC before recreating (row type changes)", () => {
        assert.match(migrationSource, /DROP FUNCTION IF EXISTS public\.list_my_creator_reward_receipts\(\);/);
        // Detail keeps its jsonb return type, so it is replaced in place.
        assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.get_my_creator_reward_receipt/);
    });

    it("detail RPC delegates to the list RPC and includes payment_details", () => {
        assert.match(migrationSource, /r\.payment_details/);
        assert.match(migrationSource, /'payment_details', v_row\.payment_details/);
        // Detail derives from the list RPC (single source of truth).
        assert.match(migrationSource, /FROM public\.list_my_creator_reward_receipts\(\) r/);
    });

    it("never calls Wise from the receipt read model", () => {
        assert.doesNotMatch(migrationSource, /wise\.com|api\.wise|transfers\/|accounts/);
    });
});

describe("payout snapshot orchestration", () => {
    const sandboxSource = readFileSync(
        join(process.cwd(), "src/lib/wise-sandbox-payouts.ts"),
        "utf8"
    );

    it("snapshots on paid transition and on no-op re-observation only", () => {
        assert.match(sandboxSource, /decision\.action === "paid"/);
        assert.match(sandboxSource, /decision\.action === "noop" && input\.currentStatus === "paid"/);
    });

    it("checks reverse before the already-paid snapshot (refunds still process)", () => {
        const reverseIdx = sandboxSource.indexOf('decision.action === "reverse"');
        const noopIdx = sandboxSource.indexOf('decision.action === "noop" && input.currentStatus === "paid"');
        assert.ok(reverseIdx >= 0, "reverse branch present");
        assert.ok(noopIdx >= 0, "noop-paid snapshot branch present");
        assert.ok(reverseIdx < noopIdx, "reverse branch is evaluated before the noop-paid snapshot");
    });

    it("snapshot writes are PATCH-only and never call ledger/status RPCs", () => {
        const snapshotFn = sandboxSource.match(/async function snapshotProviderFinalPaymentFacts[\s\S]*?\n\}/)?.[0] ?? "";
        assert.doesNotMatch(snapshotFn, /\brpc\(/);
        assert.match(snapshotFn, /method: "PATCH"/);
    });
});
