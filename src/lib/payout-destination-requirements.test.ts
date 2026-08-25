import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    assertNoSensitivePersistencePayload,
    buildWiseRecipientDetailsFromFields,
    maskDestinationFromFields,
    normalizeDbSchema,
    validateFieldsAgainstSchema
} from "./payout-destination-requirements";

describe("payout destination requirements", () => {
    it("validates UK sort-code schema", () => {
        const fields = normalizeDbSchema({
            alwaysInclude: [
                {key: "accountHolderName", label: "Account holder name", type: "text", required: true, minLength: 2}
            ],
            fields: [
                {key: "sortCode", label: "Sort code", type: "text", required: true, pattern: "^[0-9]{6}$"},
                {key: "accountNumber", label: "Account number", type: "text", required: true, minLength: 6}
            ]
        });
        assert.equal(
            validateFieldsAgainstSchema(fields, {
                accountHolderName: "Ada",
                sortCode: "040075",
                accountNumber: "12345678"
            }),
            null
        );
        assert.match(
            String(
                validateFieldsAgainstSchema(fields, {
                    accountHolderName: "Ada",
                    sortCode: "bad",
                    accountNumber: "12345678"
                })
            ),
            /Sort code/
        );
    });

    it("builds nested address for PHP/US and masks without raw persistence", () => {
        const details = buildWiseRecipientDetailsFromFields({
            accountHolderName: "Maria",
            accountNumber: "0044123456",
            bic: "ABORPHPHXXX",
            "address.firstLine": "123 Rizal",
            "address.city": "Manila",
            "address.postCode": "1000",
            "address.country": "PH"
        });
        assert.equal(details.legalType, "PRIVATE");
        assert.equal((details.address as Record<string, string>).country, "PH");
        const mask = maskDestinationFromFields({
            currencyCode: "PHP",
            recipientType: "philippines",
            fields: {accountNumber: "0044123456", bic: "BCA"}
        });
        assert.match(mask, /PHP/);
        assert.match(mask, /3456/);
        assert.throws(
            () => assertNoSensitivePersistencePayload({accountNumber: "123"}),
            /refuse_persist_raw_bank_fields/
        );
    });
});
