/**
 * Phase 7C user payout destination setup.
 *
 * Bank / IBAN / sort-code fields are accepted ephemerally, forwarded to Wise,
 * and NEVER written to Supabase. AnimalDex stores only provider refs + mask.
 *
 * Does not enable production withdrawals (payouts_enabled stays operator-gated).
 */

import {
    assertPayoutEnvironmentCompatible,
    PayoutEnvironmentError,
    type AnimaldexEnvironmentLabel
} from "@/lib/payout-environment";
import {mapPayoutEligibility, type PayoutEligibility} from "@/lib/monetization";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    loadWiseConfigFromEnv,
    loadWiseProductionConfigFromEnv,
    WiseConfigurationError,
    WisePayoutProvider,
    type WiseConfig
} from "@/lib/wise-payout-provider";

export type PayoutSetupCorridor = {
    countryCode: string;
    provider: string;
    currencies: string[];
    minimumPayoutAmountMinor: number | null;
    minimumPayoutCurrency: string | null;
};

export type PayoutSetupStatus = PayoutEligibility & {
    setupComplete: boolean;
    maskedDestination: string | null;
    destinationCurrency: string | null;
    destinationCountry: string | null;
    destinationType: string | null;
    provider: string | null;
    canWithdraw: boolean;
    setupProviderReady: boolean;
    corridors: PayoutSetupCorridor[];
    contactEmail: string | null;
};

export type CompletePayoutSetupInput = {
    userId: string;
    contactEmail: string | null;
    countryCode: string;
    currencyCode: string;
    accountHolderName: string;
    legalCapacityAttested: boolean;
    /** Ephemeral — never persisted */
    sortCode: string;
    /** Ephemeral — never persisted */
    accountNumber: string;
};

function restHeaders(extra?: Record<string, string>) {
    const key = getSupabaseServiceKey();
    if (!key) throw new Error("Supabase is not configured");
    return getSupabaseHeaders(key, {
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "return=representation",
        ...extra
    });
}

async function serviceRpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase is not configured");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: restHeaders(),
        body: JSON.stringify(body),
        cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.message === "string" ? payload.message : `${name} failed`;
        throw new Error(message);
    }
    return payload as T;
}

async function serviceRest<T>(path: string, init?: RequestInit): Promise<T> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase is not configured");
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: restHeaders(init?.headers as Record<string, string> | undefined),
        cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.message === "string" ? payload.message : `${path} failed`;
        throw new Error(message);
    }
    return payload as T;
}

function digitsOnly(value: string): string {
    return value.replace(/\D/g, "");
}

export function maskGbpBankAccount(accountNumber: string): string {
    const digits = digitsOnly(accountNumber);
    const last4 = digits.slice(-4).padStart(Math.min(4, digits.length), "•");
    return `GBP • Bank account •••• ${last4}`;
}

export function assertNoSensitivePersistencePayload(payload: unknown): void {
    const text = JSON.stringify(payload ?? {}).toLowerCase();
    const forbidden = [
        "accountnumber",
        "account_number",
        "sortcode",
        "sort_code",
        "iban",
        "routingnumber",
        "routing_number",
        "swift",
        "bic",
        "cardnumber",
        "card_number"
    ];
    for (const key of forbidden) {
        if (text.includes(`"${key}"`)) {
            throw new Error("refuse_persist_raw_bank_fields");
        }
    }
}

export async function resolveWiseConfigForUserSetup(): Promise<{
    config: WiseConfig;
    animaldexEnvironment: AnimaldexEnvironmentLabel;
    setupProviderReady: boolean;
}> {
    const identity = await serviceRpc<Record<string, unknown>>("get_animaldex_environment_identity");
    const animaldexEnvironment = String(
        identity.environment_label ?? identity.environmentLabel ?? "unknown"
    ).toLowerCase() as AnimaldexEnvironmentLabel;

    let config: WiseConfig;
    try {
        if (animaldexEnvironment === "production") {
            config = loadWiseProductionConfigFromEnv();
        } else {
            config = loadWiseConfigFromEnv();
        }
    } catch (error) {
        if (error instanceof WiseConfigurationError) {
            return {
                config: {
                    environment: animaldexEnvironment === "production" ? "production" : "sandbox",
                    apiToken: "",
                    profileId: ""
                },
                animaldexEnvironment,
                setupProviderReady: false
            };
        }
        throw error;
    }

    try {
        assertPayoutEnvironmentCompatible({
            animaldexEnvironment,
            providerEnvironment: config.environment,
            allowFixtureGeneration: false
        });
        new WisePayoutProvider(config).validateConfiguration();
        return {config, animaldexEnvironment, setupProviderReady: true};
    } catch (error) {
        if (error instanceof PayoutEnvironmentError || error instanceof WiseConfigurationError) {
            return {config, animaldexEnvironment, setupProviderReady: false};
        }
        throw error;
    }
}

function mapCorridors(raw: unknown): PayoutSetupCorridor[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => {
        const item = row as Record<string, unknown>;
        const currencies = Array.isArray(item.currencies)
            ? item.currencies.map(String)
            : Array.isArray(item.supported_currencies)
              ? (item.supported_currencies as unknown[]).map(String)
              : [];
        return {
            countryCode: String(item.countryCode ?? item.country_code ?? ""),
            provider: String(item.provider ?? "wise"),
            currencies,
            minimumPayoutAmountMinor:
                item.minimumPayoutAmountMinor == null && item.minimum_payout_amount_minor == null
                    ? null
                    : Number(item.minimumPayoutAmountMinor ?? item.minimum_payout_amount_minor),
            minimumPayoutCurrency:
                item.minimumPayoutCurrency == null && item.minimum_payout_currency == null
                    ? null
                    : String(item.minimumPayoutCurrency ?? item.minimum_payout_currency)
        };
    });
}

export function mapPayoutSetupStatus(
    row: Record<string, unknown>,
    extras: {
        setupProviderReady: boolean;
        corridors: PayoutSetupCorridor[];
        contactEmail: string | null;
    }
): PayoutSetupStatus {
    const base = mapPayoutEligibility(row);
    return {
        ...base,
        setupComplete: Boolean(row.setupComplete ?? row.setup_complete),
        maskedDestination:
            row.maskedDestination == null && row.masked_destination == null
                ? null
                : String(row.maskedDestination ?? row.masked_destination),
        destinationCurrency:
            row.destinationCurrency == null && row.destination_currency == null
                ? null
                : String(row.destinationCurrency ?? row.destination_currency),
        destinationCountry:
            row.destinationCountry == null && row.destination_country == null
                ? null
                : String(row.destinationCountry ?? row.destination_country),
        destinationType:
            row.destinationType == null && row.destination_type == null
                ? null
                : String(row.destinationType ?? row.destination_type),
        provider: row.provider == null ? null : String(row.provider),
        canWithdraw: Boolean(row.canWithdraw ?? row.can_withdraw ?? base.eligible),
        setupProviderReady: extras.setupProviderReady,
        corridors: extras.corridors,
        contactEmail: extras.contactEmail
    };
}

export async function loadPayoutSetupStatusForUser(input: {
    eligibilityRow: Record<string, unknown>;
    corridorsRaw: unknown;
    contactEmail: string | null;
}): Promise<PayoutSetupStatus> {
    const wise = await resolveWiseConfigForUserSetup();
    return mapPayoutSetupStatus(input.eligibilityRow, {
        setupProviderReady: wise.setupProviderReady,
        corridors: mapCorridors(input.corridorsRaw),
        contactEmail: input.contactEmail
    });
}

export async function completeUserPayoutSetup(input: CompletePayoutSetupInput): Promise<PayoutSetupStatus> {
    const countryCode = input.countryCode.trim().toUpperCase();
    const currencyCode = input.currencyCode.trim().toUpperCase();
    const accountHolderName = input.accountHolderName.trim();
    const sortCode = digitsOnly(input.sortCode);
    const accountNumber = digitsOnly(input.accountNumber);

    if (countryCode !== "GB") {
        throw new Error("Only United Kingdom bank payouts are available for setup right now.");
    }
    if (currencyCode !== "GBP") {
        throw new Error("GBP is required for United Kingdom payout setup.");
    }
    if (!input.legalCapacityAttested) {
        throw new Error("Confirm you are eligible to receive payouts.");
    }
    if (accountHolderName.length < 2) {
        throw new Error("Enter the account holder name.");
    }
    if (sortCode.length !== 6) {
        throw new Error("Enter a valid 6-digit UK sort code.");
    }
    if (accountNumber.length < 6 || accountNumber.length > 10) {
        throw new Error("Enter a valid UK account number.");
    }

    const wise = await resolveWiseConfigForUserSetup();
    if (!wise.setupProviderReady) {
        throw new Error("Payout destination setup is not available yet.");
    }

    const provider = new WisePayoutProvider(wise.config);
    const maskedDestination = maskGbpBankAccount(accountNumber);

    const created = await provider.createRecipient({
        currency: "GBP",
        type: "sort_code",
        accountHolderName,
        profileId: wise.config.profileId,
        details: {
            legalType: "PRIVATE",
            sortCode,
            accountNumber
        },
        maskedDestination
    });

    const persistPayload = {
        user_id: input.userId,
        country_code: countryCode,
        country_support_state: "supported",
        legal_capacity_state: "self_eligible",
        identity_verification_state: "not_required",
        tax_status: "not_required",
        account_standing: "good",
        payout_readiness: "ready",
        preferred_provider: "wise",
        updated_at: new Date().toISOString()
    };
    assertNoSensitivePersistencePayload(persistPayload);

    await serviceRest("monetization_profiles?on_conflict=user_id", {
        method: "POST",
        headers: restHeaders({Prefer: "resolution=merge-duplicates,return=minimal"}),
        body: JSON.stringify(persistPayload)
    });

    const existing = await serviceRest<Array<Record<string, unknown>>>(
        `payout_profiles?user_id=eq.${input.userId}&provider=eq.wise&status=in.(draft,onboarding,active,restricted)&select=id&limit=1`
    );

    const profileRow = {
        user_id: input.userId,
        provider: "wise",
        provider_account_ref: wise.config.profileId,
        provider_recipient_ref: created.providerRecipientRef,
        masked_destination: maskedDestination,
        destination_type: "bank_account",
        country_code: countryCode,
        default_currency: currencyCode,
        status: "active",
        verification_status: "verified",
        tax_status: "not_required",
        environment: wise.config.environment,
        verification_mode: wise.config.environment === "sandbox" ? "sandbox_test" : "provider_hosted",
        updated_at: new Date().toISOString()
    };
    assertNoSensitivePersistencePayload(profileRow);

    if (existing[0]?.id) {
        await serviceRest(`payout_profiles?id=eq.${existing[0].id}`, {
            method: "PATCH",
            headers: restHeaders({Prefer: "return=minimal"}),
            body: JSON.stringify(profileRow)
        });
    } else {
        await serviceRest("payout_profiles", {
            method: "POST",
            headers: restHeaders({Prefer: "return=minimal"}),
            body: JSON.stringify({
                ...profileRow,
                created_at: new Date().toISOString()
            })
        });
    }

    // Re-read eligibility as the user via service role impersonation is not available;
    // reconstruct from persisted facts + config.
    const monetization = await serviceRpc<Record<string, unknown>>("get_monetization_config");
    const eligibilityShape: Record<string, unknown> = {
        eligible: false,
        payoutsEnabled: Boolean(monetization.payouts_enabled ?? monetization.payoutsEnabled),
        betaMember: false,
        countryState: "supported",
        countryCode,
        legalCapacityState: "self_eligible",
        identityState: "not_required",
        taxState: "not_required",
        payoutProfileState: "active",
        accountStanding: "good",
        payoutReadiness: "ready",
        reasonCodes: Boolean(monetization.payouts_enabled ?? monetization.payoutsEnabled)
            ? ["beta_membership_required"]
            : ["payouts_disabled", "beta_membership_required"],
        setupComplete: true,
        maskedDestination,
        destinationCurrency: currencyCode,
        destinationCountry: countryCode,
        destinationType: "bank_account",
        provider: "wise",
        canWithdraw: false
    };

    return mapPayoutSetupStatus(eligibilityShape, {
        setupProviderReady: true,
        corridors: [
            {
                countryCode: "GB",
                provider: "wise",
                currencies: ["GBP"],
                minimumPayoutAmountMinor: 2000,
                minimumPayoutCurrency: "GBP"
            }
        ],
        contactEmail: input.contactEmail
    });
}
