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
});
