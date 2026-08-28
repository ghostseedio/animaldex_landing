import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    assertNoSensitivePersistencePayload,
    maskGbpBankAccount
} from "./user-payout-setup";
import {mapPayoutEligibility} from "./monetization";

describe("Phase 7C user payout setup", () => {
    it("masks UK account numbers for display", () => {
        assert.equal(maskGbpBankAccount("12345678"), "GBP • Bank account •••• 5678");
        assert.equal(maskGbpBankAccount("12-34-56 78901234"), "GBP • Bank account •••• 1234");
    });

    it("refuses payloads that embed raw bank field names", () => {
        assert.throws(
            () => assertNoSensitivePersistencePayload({sort_code: "040075"}),
            /refuse_persist_raw_bank_fields/
        );
        assert.throws(
            () => assertNoSensitivePersistencePayload({accountNumber: "12345678"}),
            /refuse_persist_raw_bank_fields/
        );
        assert.doesNotThrow(() =>
            assertNoSensitivePersistencePayload({
                masked_destination: "GBP • Bank account •••• 5678",
                provider_recipient_ref: "1393656685",
                destination_type: "bank_account",
                recipient_type: "sort_code",
                bank_label: "sort_code"
            })
        );
    });

    it("allows safe payout profile storage metadata columns", () => {
        assert.doesNotThrow(() =>
            assertNoSensitivePersistencePayload({
                user_id: "00000000-0000-0000-0000-000000000000",
                provider: "wise",
                provider_account_ref: "96792752",
                provider_recipient_ref: "1393656685",
                masked_destination: "GBP • Bank account •••• 8842",
                destination_type: "bank_account",
                recipient_type: "sort_code",
                corridor_id: "11111111-1111-1111-1111-111111111111",
                bank_label: "sort_code",
                country_code: "GB",
                default_currency: "GBP",
                status: "active"
            })
        );
    });

    it("maps setupComplete without inventing withdraw entitlement", () => {
        const mapped = mapPayoutEligibility({
            eligible: false,
            payoutsEnabled: false,
            setupComplete: true,
            maskedDestination: "GBP • Bank account •••• 5367",
            canWithdraw: false,
            reasonCodes: ["payouts_disabled"]
        });
        assert.equal(mapped.setupComplete, true);
        assert.equal(mapped.payoutsEnabled, false);
        assert.equal(mapped.canWithdraw, false);
        assert.equal(mapped.maskedDestination, "GBP • Bank account •••• 5367");
        assert.deepEqual(mapped.reasonCodes, ["payouts_disabled"]);
    });

    it("maps payout SLA and blocker transparency fields", () => {
        const mapped = mapPayoutEligibility({
            eligible: true,
            payoutsEnabled: true,
            setupComplete: true,
            canWithdraw: true,
            payoutSlaDays: 14,
            payoutSlaStartsOn: "available",
            availableAmountMinor: 500,
            targetPayBy: "2026-09-07",
            blockerTitle: null,
            nextStep: "Finance will send your Available balance by the target pay date",
            paymentModel: "manual_finance_approval",
            reasonCodes: []
        });
        assert.equal(mapped.payoutSlaDays, 14);
        assert.equal(mapped.targetPayBy, "2026-09-07");
        assert.equal(mapped.availableAmountMinor, 500);
        assert.equal(mapped.paymentModel, "manual_finance_approval");
        assert.match(String(mapped.nextStep), /Finance will send/);
    });
});
