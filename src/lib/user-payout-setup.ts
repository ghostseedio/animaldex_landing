/**
 * Phase 7C user payout destination setup.
 *
 * Bank / IBAN / sort-code fields are accepted ephemerally, forwarded to Wise,
 * and NEVER written to Supabase. AnimalDex stores only provider refs + mask.
 *
 * Does not enable production withdrawals (payouts_enabled stays operator-gated).
 */

import {
    applyCorridorDefaults,
    buildWiseRecipientDetailsFromFields,
    maskDestinationFromFields,
    normalizeDbSchema,
    validateFieldsAgainstSchema,
    wiseRecipientDetailsShouldIncludeAddress
} from "@/lib/payout-destination-requirements";
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
    id?: string;
    countryCode: string;
    currencyCode?: string;
    provider: string;
    recipientType?: string;
    displayName?: string;
    currencies: string[];
    minimumPayoutAmountMinor: number | null;
    minimumPayoutCurrency: string | null;
    enabledForSetup?: boolean;
    comingSoon?: boolean;
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
    corridorId: string;
    legalCapacityAttested: boolean;
    /** Ephemeral field map — never persisted */
    fields: Record<string, string>;
    /** @deprecated GB-only compat — mapped into fields */
    countryCode?: string;
    currencyCode?: string;
    accountHolderName?: string;
    sortCode?: string;
    accountNumber?: string;
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
    const forbidden = new Set([
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
    ]);
    const stack: unknown[] = [payload];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || typeof current !== "object") continue;
        if (Array.isArray(current)) {
            stack.push(...current);
            continue;
        }
        for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
            const normalized = key.replace(/[.\s-]/g, "").toLowerCase();
            if (forbidden.has(key.toLowerCase()) || forbidden.has(normalized)) {
                throw new Error("refuse_persist_raw_bank_fields");
            }
            if (value && typeof value === "object") {
                stack.push(value);
            }
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
        const currencyCode = String(item.currencyCode ?? item.currency_code ?? "");
        const currencies = Array.isArray(item.currencies)
            ? item.currencies.map(String)
            : Array.isArray(item.supported_currencies)
              ? (item.supported_currencies as unknown[]).map(String)
              : currencyCode
                ? [currencyCode]
                : [];
        return {
            id: item.id == null ? undefined : String(item.id),
            countryCode: String(item.countryCode ?? item.country_code ?? ""),
            currencyCode: currencyCode || undefined,
            provider: String(item.provider ?? "wise"),
            recipientType:
                item.recipientType == null && item.recipient_type == null
                    ? undefined
                    : String(item.recipientType ?? item.recipient_type),
            displayName:
                item.displayName == null && item.display_name == null
                    ? undefined
                    : String(item.displayName ?? item.display_name),
            currencies,
            minimumPayoutAmountMinor:
                item.minimumPayoutAmountMinor == null && item.minimum_payout_amount_minor == null
                    ? null
                    : Number(item.minimumPayoutAmountMinor ?? item.minimum_payout_amount_minor),
            minimumPayoutCurrency:
                item.minimumPayoutCurrency == null && item.minimum_payout_currency == null
                    ? null
                    : String(item.minimumPayoutCurrency ?? item.minimum_payout_currency),
            enabledForSetup: Boolean(item.enabledForSetup ?? item.enabled_for_setup),
            comingSoon: Boolean(item.comingSoon ?? item.coming_soon ?? !(item.enabledForSetup ?? item.enabled_for_setup))
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
    if (!input.legalCapacityAttested) {
        throw new Error("Confirm you are eligible to receive payouts.");
    }

    const fields: Record<string, string> = {...(input.fields ?? {})};
    // GB backward-compat for older clients still posting sortCode/accountNumber.
    if (input.accountHolderName && !fields.accountHolderName) {
        fields.accountHolderName = input.accountHolderName;
    }
    if (input.sortCode && !fields.sortCode) fields.sortCode = digitsOnly(input.sortCode);
    if (input.accountNumber && !fields.accountNumber) fields.accountNumber = digitsOnly(input.accountNumber);

    const accountHolderName = String(fields.accountHolderName ?? "").trim();
    if (accountHolderName.length < 2) {
        throw new Error("Enter the account holder name.");
    }

    let corridorId = String(input.corridorId ?? "").trim();
    if (!corridorId && input.countryCode && input.currencyCode) {
        const rows = await serviceRest<Array<Record<string, unknown>>>(
            `monetization_payout_corridors?country_code=eq.${encodeURIComponent(input.countryCode.trim().toUpperCase())}&currency_code=eq.${encodeURIComponent(input.currencyCode.trim().toUpperCase())}&provider=eq.wise&enabled_for_setup=eq.true&select=id&limit=1`
        );
        corridorId = rows[0]?.id ? String(rows[0].id) : "";
    }
    if (!corridorId) {
        throw new Error("Select a supported payout country.");
    }

    const corridorRows = await serviceRest<Array<Record<string, unknown>>>(
        `monetization_payout_corridors?id=eq.${encodeURIComponent(corridorId)}&select=*&limit=1`
    );
    const corridor = corridorRows[0];
    if (!corridor) throw new Error("Payout corridor not found.");

    const status = String(corridor.status ?? "");
    const enabledForSetup = Boolean(corridor.enabled_for_setup);
    let betaMember = false;
    if (!enabledForSetup) {
        if (status !== "testing") {
            throw new Error("Payouts aren't available in your country yet.");
        }
        try {
            const betaRows = await serviceRest<Array<Record<string, unknown>>>(
                `creator_reward_beta_members?user_id=eq.${encodeURIComponent(input.userId)}&enabled=eq.true&select=user_id&limit=1`
            );
            betaMember = Boolean(betaRows[0]?.user_id);
        } catch {
            betaMember = false;
        }
        if (!betaMember) {
            throw new Error("Payouts aren't available in your country yet.");
        }
    }

    const countryCode = String(corridor.country_code);
    const currencyCode = String(corridor.currency_code);
    const recipientType = String(corridor.recipient_type);
    const schemaFields = applyCorridorDefaults(normalizeDbSchema(corridor.requirements_schema), countryCode);
    // Apply readonly defaults (e.g. address.country) before validation.
    for (const field of schemaFields) {
        if (field.defaultValue && !String(fields[field.key] ?? "").trim()) {
            fields[field.key] = field.defaultValue;
        }
    }
    const validationError = validateFieldsAgainstSchema(schemaFields, fields);
    if (validationError) throw new Error(validationError);

    const wise = await resolveWiseConfigForUserSetup();
    if (!wise.setupProviderReady) {
        throw new Error("Payout destination setup is not available yet.");
    }

    const provider = new WisePayoutProvider(wise.config);
    const bankField = schemaFields.find((f) => f.key === "bankCode" || f.key === "bic" || f.key === "swiftCode");
    const bankLabels =
        bankField?.options?.reduce<Record<string, string>>((acc, opt) => {
            acc[opt.value] = opt.label;
            return acc;
        }, {}) ?? undefined;

    const maskedDestination = maskDestinationFromFields({
        currencyCode,
        recipientType,
        fields,
        bankLabels
    });
    const details = buildWiseRecipientDetailsFromFields(fields, {
        includeAddress: wiseRecipientDetailsShouldIncludeAddress({currencyCode, recipientType})
    });

    const created = await provider.createRecipient({
        currency: currencyCode,
        type: recipientType,
        accountHolderName,
        profileId: wise.config.profileId,
        details,
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

    // Supersede prior active profiles for replace-destination flow.
    await serviceRest(
        `payout_profiles?user_id=eq.${input.userId}&provider=eq.wise&status=in.(draft,onboarding,active,restricted)`,
        {
            method: "PATCH",
            headers: restHeaders({Prefer: "return=minimal"}),
            body: JSON.stringify({
                status: "closed",
                superseded_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        }
    );

    const profileRow = {
        user_id: input.userId,
        provider: "wise",
        provider_account_ref: wise.config.profileId,
        provider_recipient_ref: created.providerRecipientRef,
        masked_destination: maskedDestination,
        destination_type: recipientType === "iban" ? "iban" : "bank_account",
        recipient_type: recipientType,
        corridor_id: corridorId,
        bank_label: recipientType,
        country_code: countryCode,
        default_currency: currencyCode,
        status: "active",
        verification_status: "verified",
        tax_status: "not_required",
        environment: wise.config.environment,
        verification_mode: wise.config.environment === "sandbox" ? "sandbox_test" : "provider_hosted",
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
    };
    assertNoSensitivePersistencePayload(profileRow);

    await serviceRest("payout_profiles", {
        method: "POST",
        headers: restHeaders({Prefer: "return=minimal"}),
        body: JSON.stringify(profileRow)
    });

    const monetization = await serviceRpc<Record<string, unknown>>("get_monetization_config");
    const corridorsRaw = await serviceRpc<unknown>("list_my_payout_corridors").catch(() => []);
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
        destinationType: recipientType === "iban" ? "iban" : "bank_account",
        provider: "wise",
        canWithdraw: false
    };

    return mapPayoutSetupStatus(eligibilityShape, {
        setupProviderReady: true,
        corridors: mapCorridors(Array.isArray(corridorsRaw) ? corridorsRaw : []),
        contactEmail: input.contactEmail
    });
}
