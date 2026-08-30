import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {providerErrorMessage, WisePayoutProvider} from "./wise-payout-provider";

describe("Wise payout provider error handling", () => {
    it("condenses Wise 422 validation errors into a readable message", () => {
        const message = providerErrorMessage(
            {
                errors: [
                    {code: "validation.failure.address.country.empty", field: "account/address/country"},
                    {code: "validation.failure.address.city.empty", field: "account/address/city"}
                ]
            },
            ""
        );
        assert.match(message, /validation\.failure\.address\.country\.empty/);
        assert.match(message, /account\/address\/country/);
        assert.match(message, /validation\.failure\.address\.city\.empty/);
    });

    it("falls back to an error string or raw text when no errors array is present", () => {
        assert.equal(providerErrorMessage({error: "boom"}, ""), '"boom"');
        assert.equal(providerErrorMessage({message: "nope"}, ""), "nope");
        assert.equal(providerErrorMessage(null, "raw text"), "raw text");
    });

    it("propagates a Wise 422 as wise_http_422 with the validation codes", async () => {
        const fetchImpl = (async () => ({
            ok: false,
            status: 422,
            text: async () =>
                JSON.stringify({
                    errors: [
                        {code: "validation.failure.address.country.empty", field: "account/address/country"}
                    ]
                })
        })) as unknown as typeof fetch;

        const provider = new WisePayoutProvider({
            environment: "sandbox",
            apiToken: "test-token",
            profileId: "12345",
            fetchImpl
        });

        await assert.rejects(
            () =>
                provider.createQuote({
                    profileId: "12345",
                    sourceCurrency: "GBP",
                    targetCurrency: "GBP",
                    sourceAmount: 5,
                    targetAccount: 1
                }),
            /wise_http_422:.*validation\.failure\.address\.country\.empty/
        );
    });

    it("maps getTransfer final facts (source/target amounts + payment reference)", async () => {
        const fetchImpl = (async () => ({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    id: 2338505126,
                    customerTransactionId: "43a4089b-cea0-4369-b754-5a89c7db6e66",
                    status: "outgoing_payment_sent",
                    created: "2026-08-29T12:49:14.360518Z",
                    sourceValue: 1.3,
                    sourceCurrency: "USD",
                    targetValue: 0.96,
                    targetCurrency: "GBP",
                    details: {reference: "AnimalDex 43a4089b"}
                })
        })) as unknown as typeof fetch;

        const provider = new WisePayoutProvider({
            environment: "production",
            apiToken: "test-token",
            profileId: "96792752",
            allowProductionExecution: true,
            fetchImpl
        });

        const transfer = await provider.getTransfer(2338505126);
        assert.equal(transfer.providerTransferRef, "2338505126");
        assert.equal(transfer.status, "outgoing_payment_sent");
        assert.equal(transfer.sourceAmount, 1.3);
        assert.equal(transfer.sourceCurrency, "USD");
        assert.equal(transfer.targetAmount, 0.96);
        assert.equal(transfer.targetCurrency, "GBP");
        assert.equal(transfer.paymentReference, "AnimalDex 43a4089b");
    });

    it("maps getTransfer with a top-level reference fallback", async () => {
        const fetchImpl = (async () => ({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    id: 999,
                    status: "processing",
                    sourceValue: 5,
                    sourceCurrency: "GBP",
                    targetValue: 5,
                    targetCurrency: "GBP",
                    reference: "fallback-ref"
                })
        })) as unknown as typeof fetch;

        const provider = new WisePayoutProvider({
            environment: "sandbox",
            apiToken: "test-token",
            profileId: "12345",
            fetchImpl
        });

        const transfer = await provider.getTransfer(999);
        assert.equal(transfer.paymentReference, "fallback-ref");
    });
});
