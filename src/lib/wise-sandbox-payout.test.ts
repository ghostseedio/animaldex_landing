import assert from "node:assert/strict";
import test from "node:test";
import {
    assertPayoutEnvironmentCompatible,
    PayoutEnvironmentError
} from "./payout-environment";
import {applyProviderPayoutStatus, mapWiseTransferStatus} from "./payout-status-engine";
import {sharedPasswordMayApproveFinance} from "./monetization";

test("environment guards refuse production+sandbox fixtures and local+wise production", () => {
    assert.throws(
        () =>
            assertPayoutEnvironmentCompatible({
                animaldexEnvironment: "production",
                providerEnvironment: "sandbox",
                allowFixtureGeneration: true
            }),
        PayoutEnvironmentError
    );
    assert.throws(
        () =>
            assertPayoutEnvironmentCompatible({
                animaldexEnvironment: "local",
                providerEnvironment: "production"
            }),
        PayoutEnvironmentError
    );
    assert.doesNotThrow(() =>
        assertPayoutEnvironmentCompatible({
            animaldexEnvironment: "local",
            providerEnvironment: "sandbox",
            allowFixtureGeneration: true
        })
    );
});

test("Wise status mapping only pays on outgoing_payment_sent and ignores late processing", () => {
    assert.equal(mapWiseTransferStatus("outgoing_payment_sent"), "paid");
    assert.equal(mapWiseTransferStatus("processing"), "processing");
    assert.equal(mapWiseTransferStatus("funds_refunded"), "reversed");

    const late = applyProviderPayoutStatus({
        currentStatus: "paid",
        wiseStatus: "processing"
    });
    assert.equal(late.action, "noop");
    assert.equal(late.nextStatus, "paid");

    const reverse = applyProviderPayoutStatus({
        currentStatus: "paid",
        wiseStatus: "funds_refunded"
    });
    assert.equal(reverse.action, "reverse");
});

test("shared password cannot approve finance payouts", () => {
    assert.equal(sharedPasswordMayApproveFinance("shared_password"), false);
    assert.equal(sharedPasswordMayApproveFinance("named_email"), true);
});
