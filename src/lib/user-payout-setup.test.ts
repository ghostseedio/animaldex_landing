import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";
import {completeUserPayoutSetup} from "./user-payout-setup";

const GBP_CORRIDOR_ID = "cd4d16f5-1662-42dd-8e45-fd1ef4f07b7f";

// Exact corridor shape the production `get_payout_corridor_requirements` RPC
// returns for the verified UK sort-code corridor.
const GBP_CORRIDOR = {
    id: GBP_CORRIDOR_ID,
    country_code: "GB",
    currency_code: "GBP",
    recipient_type: "sort_code",
    status: "verified",
    enabled_for_setup: true,
    requirements_schema: {
        alwaysInclude: [
            {
                key: "accountHolderName",
                type: "text",
                group: "identity",
                label: "Account holder name",
                required: true,
                maxLength: 100,
                minLength: 2,
                sensitive: false
            }
        ],
        fields: [
            {
                key: "sortCode",
                type: "text",
                group: "account",
                label: "Sort code",
                pattern: "^[0-9]{6}$",
                required: true,
                maxLength: 6,
                minLength: 6,
                sensitive: true
            },
            {
                key: "accountNumber",
                type: "text",
                group: "account",
                label: "Account number",
                pattern: "^[0-9]{6,10}$",
                required: true,
                maxLength: 10,
                minLength: 6,
                sensitive: true
            },
            {
                key: "address.firstLine",
                type: "text",
                group: "address",
                label: "Recipient address",
                required: true,
                maxLength: 255,
                minLength: 1,
                sensitive: false
            },
            {
                key: "address.city",
                type: "text",
                group: "address",
                label: "City",
                required: true,
                maxLength: 255,
                minLength: 1,
                sensitive: false
            },
            {
                key: "address.postCode",
                type: "text",
                group: "address",
                label: "Post code",
                required: true,
                maxLength: 32,
                minLength: 1,
                sensitive: false
            },
            {
                key: "address.country",
                type: "readonly",
                group: "address",
                label: "Country",
                required: true,
                pattern: "^GB$",
                readOnly: true,
                maxLength: 2,
                minLength: 2,
                sensitive: false,
                defaultValue: "GB",
                options: [{label: "United Kingdom", value: "GB"}]
            }
        ]
    }
};

function okJson(data: unknown, status = 200) {
    const text = JSON.stringify(data);
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
        text: async () => text
    } as unknown as Response;
}

function installFetchMock() {
    const calls: {
        wiseRecipientPayload: Record<string, unknown> | null;
        insertBody: Record<string, unknown> | null;
        supersedeCount: number;
        rpcCalls: string[];
    } = {
        wiseRecipientPayload: null,
        insertBody: null,
        supersedeCount: 0,
        rpcCalls: []
    };

    const originalFetch = global.fetch;
    global.fetch = (async (url: unknown, init?: unknown) => {
        const u = String(url);
        const opts = (init ?? {}) as {method?: string; body?: string};
        const method = opts.method ?? "GET";
        const body = opts.body ? JSON.parse(opts.body) : null;

        if (u.includes("api.wise-sandbox.com")) {
            calls.wiseRecipientPayload = body;
            return okJson({id: 999});
        }

        const rpcMatch = u.match(/\/rest\/v1\/rpc\/([^?]+)/);
        if (rpcMatch) {
            const name = decodeURIComponent(rpcMatch[1]);
            calls.rpcCalls.push(name);
            if (name === "get_animaldex_environment_identity") {
                return okJson({environment_label: "local", is_production: false});
            }
            if (name === "get_monetization_config") {
                return okJson({payouts_enabled: true, auto_payout_enabled: false});
            }
            if (name === "list_my_payout_corridors") {
                return okJson([]);
            }
            return okJson({});
        }

        if (u.includes("/rest/v1/monetization_payout_corridors")) {
            return okJson([GBP_CORRIDOR]);
        }
        if (u.includes("/rest/v1/monetization_profiles")) {
            return okJson([]);
        }
        if (u.includes("/rest/v1/payout_profiles")) {
            if (method === "PATCH") {
                calls.supersedeCount += 1;
                return okJson([]);
            }
            if (method === "POST") {
                calls.insertBody = body;
                return okJson([{...body, id: "profile-1"}]);
            }
        }

        throw new Error(`unexpected fetch: ${method} ${u}`);
    }) as typeof fetch;

    return {calls, restore: () => (global.fetch = originalFetch)};
}

function setupEnv() {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.WISE_ENVIRONMENT = "sandbox";
    process.env.WISE_API_TOKEN = "test-token";
    process.env.WISE_PROFILE_ID = "12345";
}

const VALID_GBP_FIELDS = {
    accountHolderName: "Leonard Beadle",
    sortCode: "040075",
    accountNumber: "37778842",
    "address.firstLine": "1 Test Street",
    "address.city": "Darlington",
    "address.postCode": "DL2 3PD",
    "address.country": "GB"
};

afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.WISE_ENVIRONMENT;
    delete process.env.WISE_API_TOKEN;
    delete process.env.WISE_PROFILE_ID;
});

describe("completeUserPayoutSetup integration (GBP sort_code)", () => {
    it("forwards the recipient address to Wise and persists address columns on the profile", async () => {
        setupEnv();
        const {calls, restore} = installFetchMock();
        try {
            await completeUserPayoutSetup({
                userId: "user-1",
                contactEmail: "creator@example.com",
                corridorId: GBP_CORRIDOR_ID,
                legalCapacityAttested: true,
                fields: VALID_GBP_FIELDS
            });

            // Wise recipient payload carries the address.
            assert.ok(calls.wiseRecipientPayload, "Wise recipient should be created");
            const details = calls.wiseRecipientPayload.details as Record<string, unknown>;
            const address = details.address as Record<string, string>;
            assert.deepEqual(address, {
                firstLine: "1 Test Street",
                city: "Darlington",
                postCode: "DL2 3PD",
                country: "GB"
            });
            assert.equal(details.sortCode, "040075");
            assert.equal(details.accountNumber, "37778842");

            // payout_profiles INSERT carries the address columns.
            assert.ok(calls.insertBody, "payout_profiles should be inserted");
            assert.equal(calls.insertBody.address_country, "GB");
            assert.equal(calls.insertBody.address_city, "Darlington");
            assert.equal(calls.insertBody.address_post_code, "DL2 3PD");
            assert.equal(calls.insertBody.address_first_line, "1 Test Street");
            assert.equal(calls.insertBody.country_code, "GB");
            // Sensitive bank fields are never persisted.
            assert.equal("sortCode" in calls.insertBody, false);
            assert.equal("accountNumber" in calls.insertBody, false);
        } finally {
            restore();
        }
    });

    it("rejects a submission missing required address fields before creating a Wise recipient or profile", async () => {
        setupEnv();
        const {calls, restore} = installFetchMock();
        try {
            await assert.rejects(
                () =>
                    completeUserPayoutSetup({
                        userId: "user-1",
                        contactEmail: "creator@example.com",
                        corridorId: GBP_CORRIDOR_ID,
                        legalCapacityAttested: true,
                        fields: {
                            accountHolderName: "Leonard Beadle",
                            sortCode: "040075",
                            accountNumber: "37778842"
                        }
                    }),
                /recipient_address_required:.*address\.firstLine/
            );
            assert.equal(calls.wiseRecipientPayload, null, "no Wise recipient may be created");
            assert.equal(calls.insertBody, null, "no payout profile may be created");
        } finally {
            restore();
        }
    });
});
