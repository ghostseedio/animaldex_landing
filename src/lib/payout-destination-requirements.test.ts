import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    addressColumnsFromFields,
    applyCorridorDefaults,
    assertNoSensitivePersistencePayload,
    buildWiseRecipientDetailsFromFields,
    consumerLabelForKey,
    enrichOptionLabels,
    extractRecipientAddress,
    fieldUsesSearchableSelect,
    mapWiseRequirementsToFields,
    maskDestinationFromFields,
    missingAddressFieldKeys,
    normalizeDbSchema,
    normalizeOptions,
    recipientAddressFromProfileRow,
    requiredAddressParts,
    validateFieldsAgainstSchema,
    wiseRecipientDetailsShouldIncludeAddress
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

    it("includes recipient address for Wise GBP sort-code details (address is required)", () => {
        assert.equal(
            wiseRecipientDetailsShouldIncludeAddress({currencyCode: "GBP", recipientType: "sort_code"}),
            true
        );
        const details = buildWiseRecipientDetailsFromFields({
            accountHolderName: "Leonard Beadle",
            sortCode: "040075",
            accountNumber: "37778842",
            "address.firstLine": "1 Test Street",
            "address.city": "Darlington",
            "address.postCode": "DL2 3PD",
            "address.country": "GB"
        });
        assert.deepEqual(details, {
            legalType: "PRIVATE",
            sortCode: "040075",
            accountNumber: "37778842",
            address: {firstLine: "1 Test Street", city: "Darlington", postCode: "DL2 3PD", country: "GB"}
        });
    });

    it("still supports opt-out of address via includeAddress flag", () => {
        const details = buildWiseRecipientDetailsFromFields(
            {
                accountHolderName: "Leonard Beadle",
                sortCode: "040075",
                accountNumber: "37778842",
                "address.firstLine": "1 Test Street",
                "address.city": "Darlington"
            },
            {includeAddress: false}
        );
        assert.deepEqual(details, {
            legalType: "PRIVATE",
            sortCode: "040075",
            accountNumber: "37778842"
        });
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

    it("extracts and round-trips recipient address fields", () => {
        const address = extractRecipientAddress({
            "address.firstLine": "12 Main St",
            "address.city": "London",
            "address.postCode": "E1 6AN",
            "address.country": "GB",
            "address.state": "",
            accountNumber: "12345678"
        });
        assert.equal(address.firstLine, "12 Main St");
        assert.equal(address.city, "London");
        assert.equal(address.postCode, "E1 6AN");
        assert.equal(address.country, "GB");
        assert.equal(address.state, undefined);

        const columns = addressColumnsFromFields(
            {"address.city": "London", "address.firstLine": "12 Main St"},
            "GB"
        );
        assert.equal(columns.address_country, "GB");
        assert.equal(columns.address_city, "London");
        assert.equal(columns.address_first_line, "12 Main St");
        assert.equal(columns.address_post_code, null);
        assert.equal(columns.address_state, null);
    });

    it("reads persisted recipient address back from a profile row with country fallback", () => {
        const address = recipientAddressFromProfileRow({
            address_country: "ID",
            address_city: "Jakarta",
            address_post_code: "10110",
            address_first_line: "Jl. Merdeka 1",
            address_state: null
        });
        assert.equal(address.country, "ID");
        assert.equal(address.city, "Jakarta");
        assert.equal(address.postCode, "10110");
        assert.equal(address.firstLine, "Jl. Merdeka 1");
        assert.equal(address.state, "");

        const legacy = recipientAddressFromProfileRow({country_code: "GB"});
        assert.equal(legacy.country, "GB");
        assert.equal(legacy.city, "");
    });

    it("computes required address parts from a field schema", () => {
        const fields = mapWiseRequirementsToFields(
            [
                {
                    type: "indonesian",
                    fields: [
                        {
                            group: [
                                {key: "bankCode", name: "Bank", type: "select", required: true, valuesAllowed: [{key: "140397", name: "BCA"}]},
                                {key: "accountNumber", name: "Account number", type: "text", required: true},
                                {key: "address.country", name: "Country", type: "select", required: true, valuesAllowed: [{key: "ID", name: "Indonesia"}]},
                                {key: "address.city", name: "City", type: "text", required: true},
                                {key: "address.firstLine", name: "Address", type: "text", required: true},
                                {key: "address.postCode", name: "Post code", type: "text", required: true}
                            ]
                        }
                    ]
                }
            ],
            "indonesian",
            "ID"
        );
        assert.deepEqual(requiredAddressParts(fields).sort(), ["city", "country", "firstLine", "postCode"].sort());
    });

    it("accepts a complete required address and reports each missing part", () => {
        const required = ["country", "city", "postCode", "firstLine"] as const;
        const complete = {country: "GB", city: "London", postCode: "E1 6AN", firstLine: "12 Main St", state: ""};
        assert.deepEqual(missingAddressFieldKeys(complete, [...required]), []);

        const missingCountry = {...complete, country: ""};
        assert.deepEqual(missingAddressFieldKeys(missingCountry, [...required]), ["address.country"]);

        const missingCity = {...complete, city: ""};
        assert.deepEqual(missingAddressFieldKeys(missingCity, [...required]), ["address.city"]);

        const missingPostCodeAndLine = {...complete, postCode: "", firstLine: ""};
        assert.deepEqual(missingAddressFieldKeys(missingPostCodeAndLine, [...required]).sort(), ["address.firstLine", "address.postCode"].sort());
    });

    it("requires state only for country-specific corridors that demand it", () => {
        const baseRequired = ["country", "city", "postCode", "firstLine"] as const;
        const usRequired = [...baseRequired, "state"] as const;
        const address = {country: "US", city: "Austin", postCode: "78701", firstLine: "1 Congress Ave", state: ""};

        // Without state in the required list, it is not reported missing.
        assert.deepEqual(missingAddressFieldKeys(address, [...baseRequired]), []);
        // With state required (US corridor), it is reported missing.
        assert.deepEqual(missingAddressFieldKeys(address, [...usRequired]), ["address.state"]);
    });

    it("round-trips the real GBP sort_code setup payload into a profile row and back", () => {
        // Exact shape the setup UI emits for the UK sort-code corridor.
        const fields = {
            accountHolderName: "Leonard Beadle",
            sortCode: "040075",
            accountNumber: "37778842",
            "address.firstLine": "1 Test Street",
            "address.city": "Darlington",
            "address.postCode": "DL2 3PD",
            "address.country": "GB"
        };

        // extractRecipientAddress → addressColumnsFromFields
        const address = extractRecipientAddress(fields);
        assert.equal(address.firstLine, "1 Test Street");
        assert.equal(address.city, "Darlington");
        assert.equal(address.postCode, "DL2 3PD");
        assert.equal(address.country, "GB");

        const columns = addressColumnsFromFields(fields, "GB");
        assert.equal(columns.address_country, "GB");
        assert.equal(columns.address_city, "Darlington");
        assert.equal(columns.address_post_code, "DL2 3PD");
        assert.equal(columns.address_first_line, "1 Test Street");
        assert.equal(columns.address_state, null);

        // payout_profiles representation (columns merged with the corridor row).
        const profileRow = {
            id: "profile-1",
            user_id: "user-1",
            provider: "wise",
            status: "active",
            country_code: "GB",
            default_currency: "GBP",
            recipient_type: "sort_code",
            provider_recipient_ref: "155000000065",
            ...columns
        };

        // recipientAddressFromProfileRow reconstructs the address.
        const reconstructed = recipientAddressFromProfileRow(profileRow);
        assert.equal(reconstructed.country, "GB");
        assert.equal(reconstructed.city, "Darlington");
        assert.equal(reconstructed.postCode, "DL2 3PD");
        assert.equal(reconstructed.firstLine, "1 Test Street");

        // GBP corridor requires country/city/postCode/firstLine (not state).
        const required = ["country", "city", "postCode", "firstLine"] as const;
        assert.deepEqual(missingAddressFieldKeys(reconstructed, [...required]), []);
    });

    it("round-trips common address alias forms", () => {
        const aliasFields = {
            accountHolderName: "Leonard Beadle",
            sortCode: "040075",
            accountNumber: "37778842",
            "address.first_line": "10 Downing Street",
            "address.city": "London",
            "address.postalCode": "SW1A 2AA",
            "address.countryCode": "GB"
        };
        const address = extractRecipientAddress(aliasFields);
        assert.equal(address.firstLine, "10 Downing Street");
        assert.equal(address.city, "London");
        assert.equal(address.postCode, "SW1A 2AA");
        assert.equal(address.country, "GB");

        const columns = addressColumnsFromFields(aliasFields, "GB");
        assert.equal(columns.address_first_line, "10 Downing Street");
        assert.equal(columns.address_city, "London");
        assert.equal(columns.address_post_code, "SW1A 2AA");
        assert.equal(columns.address_country, "GB");
    });
});
