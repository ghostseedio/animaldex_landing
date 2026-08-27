import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    applyCorridorDefaults,
    assertNoSensitivePersistencePayload,
    buildWiseRecipientDetailsFromFields,
    consumerLabelForKey,
    enrichOptionLabels,
    fieldUsesSearchableSelect,
    mapWiseRequirementsToFields,
    maskDestinationFromFields,
    normalizeDbSchema,
    normalizeOptions,
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

    it("preserves select option label separate from value", () => {
        const opts = normalizeOptions([
            {key: "140397", name: "BCA Bank Central Asia"},
            {key: "JAWA_TIMUR_UUS", name: "BANK JATIM UNIT USAHA SYARIAH"},
            "PLAIN"
        ]);
        assert.deepEqual(opts?.[0], {label: "BCA Bank Central Asia", value: "140397"});
        assert.deepEqual(opts?.[1], {
            label: "BANK JATIM UNIT USAHA SYARIAH",
            value: "JAWA_TIMUR_UUS"
        });
        assert.deepEqual(opts?.[2], {label: "PLAIN", value: "PLAIN"});
        assert.notEqual(opts?.[0]?.label, opts?.[0]?.value);
    });

    it("maps Wise indonesian requirements with labels and address fields", () => {
        const wise = [
            {
                type: "indonesian",
                fields: [
                    {
                        name: "Bank name",
                        group: [
                            {
                                key: "bankCode",
                                name: "Bank name",
                                type: "select",
                                required: true,
                                valuesAllowed: [
                                    {key: "140397", name: "BCA Bank Central Asia"},
                                    {key: "5670011", name: "Allo Bank Indonesia"}
                                ]
                            }
                        ]
                    },
                    {
                        name: "Account number",
                        group: [{key: "accountNumber", name: "Account number (IDR)", type: "text", required: true, minLength: 7, maxLength: 18}]
                    },
                    {
                        name: "Email",
                        group: [{key: "email", name: "Email (Optional)", type: "text", required: false}]
                    },
                    {
                        name: "Country",
                        group: [
                            {
                                key: "address.country",
                                name: "Country",
                                type: "select",
                                required: true,
                                valuesAllowed: [{key: "ID", name: "Indonesia"}]
                            }
                        ]
                    },
                    {
                        name: "City",
                        group: [{key: "address.city", name: "City", type: "text", required: true}]
                    },
                    {
                        name: "Recipient address",
                        group: [{key: "address.firstLine", name: "Recipient address", type: "text", required: true}]
                    },
                    {
                        name: "Post code",
                        group: [{key: "address.postCode", name: "Post code", type: "text", required: true}]
                    }
                ]
            }
        ];
        const fields = mapWiseRequirementsToFields(wise, "indonesian", "ID");
        const bank = fields.find((f) => f.key === "bankCode");
        assert.ok(bank);
        assert.equal(bank?.options?.[0]?.label, "BCA Bank Central Asia");
        assert.equal(bank?.options?.[0]?.value, "140397");
        assert.notEqual(bank?.options?.[0]?.label, bank?.options?.[0]?.value);
        // This reduced fixture has only two banks; the production Indonesia
        // catalog crosses the searchable-select threshold.
        assert.equal(fieldUsesSearchableSelect(bank!), false);
        assert.ok(
            fieldUsesSearchableSelect({
                ...bank!,
                options: Array.from({length: 12}, (_, index) => ({
                    label: `Bank ${index}`,
                    value: String(index)
                }))
            })
        );

        for (const key of ["address.firstLine", "address.city", "address.postCode", "address.country"]) {
            assert.ok(fields.some((f) => f.key === key), `missing ${key}`);
        }
        assert.equal(consumerLabelForKey("address.firstLine"), "Address");
        assert.equal(consumerLabelForKey("address.postCode"), "Postal code");

        const country = fields.find((f) => f.key === "address.country");
        assert.equal(country?.readOnly, true);
        assert.equal(country?.defaultValue, "ID");
        assert.equal(country?.options?.[0]?.label, "Indonesia");
    });

    it("fails closed when required unsupported provider type appears", () => {
        const wise = [
            {
                type: "indonesian",
                fields: [
                    {
                        group: [
                            {key: "bankCode", name: "Bank", type: "select", required: true, valuesAllowed: [{key: "1", name: "A"}]},
                            {key: "weirdDoc", name: "Upload", type: "file", required: true}
                        ]
                    }
                ]
            }
        ];
        assert.deepEqual(mapWiseRequirementsToFields(wise, "indonesian", "ID"), []);
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
        assert.match(mask, /BCA/);
        assert.match(mask, /3456/);
        assert.doesNotMatch(mask, /0044123456/);
        const idrMask = maskDestinationFromFields({
            currencyCode: "IDR",
            recipientType: "indonesian",
            fields: {accountNumber: "1234567890", bankCode: "140397"},
            bankLabels: {"140397": "BCA Bank Central Asia"}
        });
        assert.match(idrMask, /BCA/);
        assert.match(idrMask, /7890/);
        assert.doesNotMatch(idrMask, /1234567890/);
        assert.throws(
            () => assertNoSensitivePersistencePayload({accountNumber: "123"}),
            /refuse_persist_raw_bank_fields/
        );
    });

    it("applyCorridorDefaults prefills Indonesia country", () => {
        const fields = applyCorridorDefaults(
            normalizeDbSchema({
                fields: [
                    {key: "address.country", label: "Country", type: "select", required: true, options: ["ID", "US"]}
                ]
            }),
            "ID"
        );
        assert.equal(fields[0]?.defaultValue, "ID");
        assert.equal(fields[0]?.readOnly, true);
    });

    it("enrichOptionLabels maps numeric bank codes to friendly names", () => {
        const fields = enrichOptionLabels(
            normalizeDbSchema({
                fields: [
                    {
                        key: "bankCode",
                        label: "Bank",
                        type: "select",
                        required: true,
                        options: ["140397", "JAWA_TIMUR_UUS"]
                    }
                ]
            })
        );
        assert.equal(fields[0]?.options?.[0]?.value, "140397");
        assert.equal(fields[0]?.options?.[0]?.label, "BCA Bank Central Asia");
        assert.notEqual(fields[0]?.options?.[0]?.label, "140397");
        assert.equal(fields[0]?.options?.[1]?.label, "BANK JATIM UNIT USAHA SYARIAH");
    });
});
