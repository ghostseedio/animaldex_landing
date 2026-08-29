/**
 * Server-only Wise sandbox payout orchestration.
 * Never import from client components.
 */

import {createHash, randomUUID} from "crypto";
import {
    assertPayoutEnvironmentCompatible,
    PayoutEnvironmentError
} from "@/lib/payout-environment";
import {applyProviderPayoutStatus} from "@/lib/payout-status-engine";
import {
    applyCorridorDefaults,
    mapWiseRequirementsToFields,
    missingAddressFieldKeys,
    normalizeDbSchema,
    RECIPIENT_ADDRESS_PART_LABELS,
    recipientAddressFromProfileRow,
    requiredAddressParts,
    type RecipientAddressPart
} from "@/lib/payout-destination-requirements";
import {payoutNeedsManualApproval, shouldReuseQuote} from "@/lib/payout-preparation-state";
import type {AdminActor} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    loadWiseConfigFromEnv,
    loadWiseProductionConfigFromEnv,
    verifyWiseWebhookSignature,
    WISE_SANDBOX_GBP_FAILURE_RECIPIENT,
    WISE_SANDBOX_GBP_SUCCESS_RECIPIENT,
    WiseConfigurationError,
    WisePayoutProvider
} from "@/lib/wise-payout-provider";

async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase is not configured");
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {
            "Content-Type": "application/json",
            Accept: "application/json",
            Prefer: "return=representation"
        }),
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

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase is not configured");
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {
            "Content-Type": "application/json",
            Accept: "application/json",
            Prefer: "return=representation",
            ...(init?.headers as Record<string, string> | undefined)
        }),
        cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.message === "string" ? payload.message : `${path} failed`;
        throw new Error(message);
    }
    return payload as T;
}

export async function getPayoutDiagnostics() {
    const animaldex = await rpc<Record<string, unknown>>("get_animaldex_environment_identity");
    const monetization = await rpc<Record<string, unknown>>("get_monetization_config");
    let wiseConfigured = false;
    let wiseEnvironment: string | null = null;
    let wiseProfileId: string | null = null;
    let wiseBalanceId: string | null = null;
    try {
        if (Boolean(animaldex.is_production)) {
            const cfg = loadWiseProductionConfigFromEnv();
            wiseConfigured = true;
            wiseEnvironment = cfg.environment;
            wiseProfileId = cfg.profileId;
            wiseBalanceId = cfg.balanceId ?? null;
        } else {
            const cfg = loadWiseConfigFromEnv();
            wiseConfigured = true;
            wiseEnvironment = cfg.environment;
            wiseProfileId = cfg.profileId;
            wiseBalanceId = cfg.balanceId ?? null;
        }
    } catch {
        wiseConfigured = false;
    }
    const isProduction = Boolean(animaldex.is_production);
    return {
        animaldexEnvironment: String(animaldex.environment_label ?? "unknown"),
        isProduction,
        payoutsEnabled: Boolean(monetization.payouts_enabled),
        autoPayoutEnabled: Boolean(monetization.auto_payout_enabled),
        feeTreatment: String(monetization.fee_treatment ?? ""),
        provider: "wise",
        wiseEnvironment,
        wiseCredentialsConfigured: wiseConfigured,
        wiseProfileBound: Boolean(wiseProfileId),
        wiseBalanceBound: Boolean(wiseBalanceId),
        webhookPublicKeyConfigured: Boolean(process.env.WISE_WEBHOOK_PUBLIC_KEY?.trim()),
        legalEntityName: "Ghostseed Ltd",
        banner: isProduction
            ? "PRODUCTION — REAL MONEY — WISE"
            : "WISE SANDBOX · LOCAL / STAGING · NO REAL MONEY",
        phase7cStopReason: isProduction
            ? "Live £5 payout blocked until Ghostseed Wise GBP balance is funded and finance operator confirms recipient."
            : null
    };
}

async function requireNonProductionForFixtures() {
    const animaldex = await rpc<Record<string, unknown>>("get_animaldex_environment_identity");
    const label = String(animaldex.environment_label ?? "unknown");
    assertPayoutEnvironmentCompatible({
        animaldexEnvironment: label,
        providerEnvironment: "sandbox",
        allowFixtureGeneration: true
    });
    if (label === "production" || animaldex.is_production) {
        throw new PayoutEnvironmentError("refuse_production_supabase_with_sandbox_fixtures");
    }
    return label;
}

export async function ensureNamedFinanceOperator(actor: AdminActor) {
    if (!actor.canActAsFinanceActor || actor.kind !== "named_email" || !actor.email) {
        throw new Error("named_operator_required_for_finance");
    }
    const op = await rpc<Record<string, unknown>>("admin_upsert_operator", {
        p_email: actor.email,
        p_role: "finance",
        p_user_id: actor.userId,
        p_display_name: actor.email,
        p_enabled: true
    });
    return {id: String(op.id), email: String(op.email)};
}

export async function listAdminPayouts() {
    const rows = await rest<Array<Record<string, unknown>>>(
        [
            "payouts?select=",
            "id,user_id,payout_profile_id,currency_code,amount_minor,status,provider,environment,",
            "provider_quote_ref,provider_transfer_ref,provider_status,failure_code,created_at,updated_at,approved_by,",
            "source_earnings_currency,source_earnings_amount_minor,target_currency,target_amount_minor,",
            "estimate_target_amount_minor,estimate_exchange_rate,estimate_provider_fee_minor,",
            "quote_source_currency,quote_target_currency,quote_source_amount_minor,quote_target_amount_minor,",
            "quote_fee_amount_minor,quote_rate,fee_policy,review_tier,corridor_id,",
            "earning_hold_id,paid_at,manual_transfer_recorded_at",
            "&order=created_at.desc&limit=100"
        ].join("")
    );
    return (rows || []).map((p) => ({
        payoutId: String(p.id),
        userId: String(p.user_id),
        payoutProfileId: p.payout_profile_id ? String(p.payout_profile_id) : null,
        currencyCode: String(p.currency_code),
        amountMinor: Number(p.amount_minor ?? 0),
        status: String(p.status),
        provider: String(p.provider),
        environment: String(p.environment),
        providerQuoteRef: p.provider_quote_ref ? String(p.provider_quote_ref) : null,
        providerTransferRef: p.provider_transfer_ref ? String(p.provider_transfer_ref) : null,
        providerStatus: p.provider_status ? String(p.provider_status) : null,
        failureCode: p.failure_code ? String(p.failure_code) : null,
        createdAt: String(p.created_at ?? ""),
        approvedBy: p.approved_by ? String(p.approved_by) : null,
        sourceEarningsCurrency: p.source_earnings_currency ? String(p.source_earnings_currency) : null,
        sourceEarningsAmountMinor:
            p.source_earnings_amount_minor == null ? null : Number(p.source_earnings_amount_minor),
        targetCurrency: p.target_currency ? String(p.target_currency) : null,
        targetAmountMinor: p.target_amount_minor == null ? null : Number(p.target_amount_minor),
        estimateTargetAmountMinor:
            p.estimate_target_amount_minor == null ? null : Number(p.estimate_target_amount_minor),
        estimateExchangeRate: p.estimate_exchange_rate == null ? null : Number(p.estimate_exchange_rate),
        quoteSourceCurrency: p.quote_source_currency ? String(p.quote_source_currency) : null,
        quoteTargetCurrency: p.quote_target_currency ? String(p.quote_target_currency) : null,
        quoteSourceAmountMinor:
            p.quote_source_amount_minor == null ? null : Number(p.quote_source_amount_minor),
        quoteTargetAmountMinor:
            p.quote_target_amount_minor == null ? null : Number(p.quote_target_amount_minor),
        quoteFeeAmountMinor: p.quote_fee_amount_minor == null ? null : Number(p.quote_fee_amount_minor),
        quoteRate: p.quote_rate == null ? null : Number(p.quote_rate),
        feePolicy: p.fee_policy ? String(p.fee_policy) : null,
        reviewTier: p.review_tier ? String(p.review_tier) : null,
        corridorId: p.corridor_id ? String(p.corridor_id) : null,
        hasHold: Boolean(p.earning_hold_id),
        paidAt: p.paid_at ? String(p.paid_at) : null,
        manualTransferRecordedAt: p.manual_transfer_recorded_at
            ? String(p.manual_transfer_recorded_at)
            : null
    }));
}

/** Non-sensitive resolved payout destination shown on /admin/payouts. */
export type AdminPayoutDestination = {
    originalProfileId: string | null;
    activeProfileId: string | null;
    usingRecovery: boolean;
    recipientRefMasked: string | null;
    profileStatus: string | null;
    addressCountry: string | null;
    addressCity: string | null;
    addressPostCode: string | null;
    addressFirstLine: string | null;
    addressState: string | null;
    missingAddressLabels: string[];
    addressComplete: boolean;
};

const PROFILE_DESTINATION_COLUMNS = [
    "id", "user_id", "provider", "status", "country_code", "default_currency",
    "recipient_type", "corridor_id", "provider_recipient_ref", "masked_destination",
    "address_country", "address_city", "address_post_code", "address_first_line",
    "address_state", "created_at"
].join(",");

export function maskRecipientRef(ref: string): string {
    const trimmed = String(ref ?? "").trim();
    if (!trimmed) return "";
    if (trimmed.length <= 6) return `${trimmed.slice(0, 2)}***`;
    return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

type PayoutDestinationKey = {
    payoutId: string;
    userId: string;
    payoutProfileId: string | null;
    corridorId: string | null;
};

async function resolveAdminPayoutDestinations(
    payouts: PayoutDestinationKey[]
): Promise<Map<string, AdminPayoutDestination>> {
    const out = new Map<string, AdminPayoutDestination>();
    if (payouts.length === 0) return out;

    const userIds = Array.from(new Set(payouts.map((p) => p.userId).filter(Boolean)));
    const corridorIds = Array.from(
        new Set(payouts.map((p) => p.corridorId).filter((id): id is string => Boolean(id)))
    );

    const [profileRows, corridorRows] = await Promise.all([
        userIds.length
            ? rest<Array<Record<string, unknown>>>(
                  `payout_profiles?user_id=in.(${userIds.map((id) => encodeURIComponent(id)).join(",")})&provider=eq.wise&select=${PROFILE_DESTINATION_COLUMNS}&order=created_at.desc`
              )
            : Promise.resolve([] as Record<string, unknown>[]),
        corridorIds.length
            ? rest<Array<Record<string, unknown>>>(
                  `monetization_payout_corridors?id=in.(${corridorIds.map((id) => encodeURIComponent(id)).join(",")})&select=id,requirements_schema,country_code,currency_code,recipient_type`
              )
            : Promise.resolve([] as Record<string, unknown>[])
    ]);

    const profilesByUser = new Map<string, Record<string, unknown>[]>();
    for (const row of profileRows) {
        const uid = String(row.user_id);
        const list = profilesByUser.get(uid) ?? [];
        list.push(row);
        profilesByUser.set(uid, list);
    }
    const corridorById = new Map<string, Record<string, unknown>>();
    for (const row of corridorRows) {
        corridorById.set(String(row.id), row);
    }

    for (const payout of payouts) {
        const userProfiles = profilesByUser.get(payout.userId) ?? [];
        const activeProfile = userProfiles.find((r) => String(r.status) === "active") ?? null;
        const snapshottedProfile = payout.payoutProfileId
            ? userProfiles.find((r) => String(r.id) === payout.payoutProfileId) ?? null
            : null;
        const profile =
            (activeProfile?.provider_recipient_ref ? activeProfile : snapshottedProfile) ?? activeProfile;

        if (!profile) {
            out.set(payout.payoutId, {
                originalProfileId: payout.payoutProfileId,
                activeProfileId: activeProfile ? String(activeProfile.id) : null,
                usingRecovery: false,
                recipientRefMasked: null,
                profileStatus: null,
                addressCountry: null,
                addressCity: null,
                addressPostCode: null,
                addressFirstLine: null,
                addressState: null,
                missingAddressLabels: [],
                addressComplete: false
            });
            continue;
        }

        const address = recipientAddressFromProfileRow(profile);
        const corridor = payout.corridorId ? corridorById.get(payout.corridorId) : undefined;
        const requiredParts =
            corridor?.requirements_schema != null
                ? requiredAddressParts(normalizeDbSchema(corridor.requirements_schema))
                : [];
        const missingAddressLabels = requiredParts
            .filter((part) => !String(address[part] ?? "").trim())
            .map((part) => RECIPIENT_ADDRESS_PART_LABELS[part]);

        out.set(payout.payoutId, {
            originalProfileId: payout.payoutProfileId,
            activeProfileId: activeProfile ? String(activeProfile.id) : null,
            usingRecovery: Boolean(
                snapshottedProfile?.id &&
                    activeProfile?.id &&
                    String(snapshottedProfile.id) !== String(activeProfile.id)
            ),
            recipientRefMasked: profile.provider_recipient_ref
                ? maskRecipientRef(String(profile.provider_recipient_ref))
                : null,
            profileStatus: profile.status ? String(profile.status) : null,
            addressCountry: address.country || null,
            addressCity: address.city || null,
            addressPostCode: address.postCode || null,
            addressFirstLine: address.firstLine || null,
            addressState: address.state || null,
            missingAddressLabels,
            addressComplete: missingAddressLabels.length === 0
        });
    }

    return out;
}

export async function listAdminPayoutsWithDestinations() {
    const payouts = await listAdminPayouts();
    const destinations = await resolveAdminPayoutDestinations(
        payouts.map((p) => ({
            payoutId: p.payoutId,
            userId: p.userId,
            payoutProfileId: p.payoutProfileId,
            corridorId: p.corridorId
        }))
    );
    return payouts.map((p) => ({...p, destination: destinations.get(p.payoutId) ?? null}));
}

/** Production-safe: Held/reserved → approve for manual Wise send. */
export async function approvePayoutForManualPayment(payoutId: string, actor: AdminActor) {
    const operator = await ensureNamedFinanceOperator(actor);
    return rpc<Record<string, unknown>>("admin_approve_payout_for_manual_payment", {
        p_payout_id: payoutId,
        p_actor_operator_id: operator.id
    });
}

function loadWiseConfigForCurrentEnvironment(isProduction: boolean) {
    return isProduction ? loadWiseProductionConfigFromEnv() : loadWiseConfigFromEnv();
}

/**
 * Resolve the address fields Wise requires for a corridor, taking the union of
 * the corridor's verified static schema and the live `account-requirements`
 * contract. The union is fail-closed: a required address field is never dropped
 * just because the live payload happened to omit it.
 */
async function resolveRequiredRecipientAddressParts(
    provider: WisePayoutProvider,
    input: {
        sourceCurrency: string;
        targetCurrency: string;
        recipientType: string;
        countryCode: string;
        staticSchema: unknown;
    }
): Promise<RecipientAddressPart[]> {
    const staticFields = applyCorridorDefaults(normalizeDbSchema(input.staticSchema), input.countryCode);
    const staticParts = requiredAddressParts(staticFields);
    let liveParts: RecipientAddressPart[] = [];
    try {
        const wiseRequirements = await provider.getAccountRequirements({
            sourceCurrency: input.sourceCurrency,
            targetCurrency: input.targetCurrency,
            sourceAmount: 100
        });
        const liveFields = mapWiseRequirementsToFields(
            wiseRequirements,
            input.recipientType,
            input.countryCode
        );
        if (liveFields.length > 1) {
            liveParts = requiredAddressParts(liveFields);
        }
    } catch {
        // Keep static parts only.
    }
    return Array.from(new Set([...staticParts, ...liveParts]));
}

export async function approveAndPrepareWiseTransfer(payoutId: string, actor: AdminActor) {
    const operator = await ensureNamedFinanceOperator(actor);
    const diagnostics = await getPayoutDiagnostics();
    const config = loadWiseConfigForCurrentEnvironment(diagnostics.isProduction);
    const provider = new WisePayoutProvider(config);
    provider.validateConfiguration();

    const rows = await rest<Array<Record<string, unknown>>>(
        `payouts?id=eq.${encodeURIComponent(payoutId)}&select=*&limit=1`
    );
    let payout = rows?.[0];
    if (!payout) throw new Error("payout_not_found");
    if (!payout.earning_hold_id) throw new Error("payout_not_held");

    // Idempotent short-circuit: a transfer reference already exists, so the
    // payout has been prepared. Never create a second transfer for this payout.
    if (payout.provider_transfer_ref) {
        return {
            ok: true,
            status: payout.status,
            transferRef: String(payout.provider_transfer_ref),
            reused: true
        };
    }

    // Only transition the held payout to manual-approval while it is still in a
    // pre-approval state. `provider_quote_created` is an *incomplete* preparation
    // state (quote persisted, transfer not yet created) and must be resumable
    // without re-running the approval transition.
    if (payoutNeedsManualApproval(String(payout.status))) {
        await approvePayoutForManualPayment(payoutId, actor);
        const refreshed = await rest<Array<Record<string, unknown>>>(
            `payouts?id=eq.${encodeURIComponent(payoutId)}&select=*&limit=1`
        );
        payout = refreshed?.[0];
        if (!payout) throw new Error("payout_not_found");
    }

    // Re-read the CURRENT destination. The payout request snapshots
    // `payout_profile_id`; a creator who re-submits their destination closes the
    // old profile and creates a fresh active one with a new provider recipient.
    // Prefer the active profile so recovery never re-uses an obsolete recipient.
    const snapshottedRows = await rest<Array<Record<string, unknown>>>(
        `payout_profiles?id=eq.${encodeURIComponent(String(payout.payout_profile_id))}&select=*&limit=1`
    );
    const snapshottedProfile = snapshottedRows?.[0];
    const activeRows = await rest<Array<Record<string, unknown>>>(
        `payout_profiles?user_id=eq.${encodeURIComponent(String(payout.user_id))}&provider=eq.wise&status=eq.active&order=created_at.desc&limit=1`
    );
    const activeProfile = activeRows?.[0];

    const profile =
        (activeProfile?.provider_recipient_ref ? activeProfile : snapshottedProfile) ?? activeProfile;
    if (!profile) throw new Error("payout_profile_not_found");
    const recipientRef = profile.provider_recipient_ref ? String(profile.provider_recipient_ref) : "";
    if (!recipientRef.trim()) throw new Error("provider_recipient_ref_missing");

    const snapshotRecipientRef = snapshottedProfile?.provider_recipient_ref
        ? String(snapshottedProfile.provider_recipient_ref)
        : "";

    const sourceCurrency = String(payout.source_earnings_currency || payout.currency_code);
    const targetCurrency = String(payout.target_currency || profile.default_currency || payout.currency_code);
    const sourceAmountMinor = Number(payout.source_earnings_amount_minor ?? payout.amount_minor);
    const sourceAmount = sourceAmountMinor / 100;

    const corridorId = payout.corridor_id
        ? String(payout.corridor_id)
        : profile.corridor_id
          ? String(profile.corridor_id)
          : "";
    let corridor: Record<string, unknown> | undefined;
    if (corridorId) {
        const corridorRows = await rest<Array<Record<string, unknown>>>(
            `monetization_payout_corridors?id=eq.${encodeURIComponent(corridorId)}&select=requirements_schema,recipient_type,currency_code,country_code&limit=1`
        );
        corridor = corridorRows?.[0];
    }

    // Validate recipient address BEFORE any new Wise mutation. This is the
    // boundary that turns a silent Wise 422 into a recoverable, named error.
    const requiredParts = await resolveRequiredRecipientAddressParts(provider, {
        sourceCurrency,
        targetCurrency,
        recipientType: String(corridor?.recipient_type ?? profile.recipient_type ?? "sort_code"),
        countryCode: String(corridor?.country_code ?? profile.country_code ?? ""),
        staticSchema: corridor?.requirements_schema ?? null
    });

    const resolvedAddress = recipientAddressFromProfileRow(profile);
    // Structured, server-side diagnostic log for payout preparation. Contains
    // ONLY presence booleans + ids/masked ref — never the street address or bank
    // details. Kept intentionally small for operator traceability.
    console.log(
        JSON.stringify({
            event: "payout_preparation_destination",
            payout_id: payoutId,
            payout_profile_id: payout.payout_profile_id ? String(payout.payout_profile_id) : null,
            active_profile_id: activeProfile ? String(activeProfile.id) : null,
            recipient_ref: recipientRef ? maskRecipientRef(recipientRef) : null,
            address_country_present: Boolean(resolvedAddress.country),
            address_city_present: Boolean(resolvedAddress.city),
            address_post_code_present: Boolean(resolvedAddress.postCode),
            address_first_line_present: Boolean(resolvedAddress.firstLine),
            address_state_present: Boolean(resolvedAddress.state)
        })
    );

    if (requiredParts.length > 0) {
        const missing = missingAddressFieldKeys(resolvedAddress, requiredParts);
        if (missing.length > 0) {
            throw new Error(`recipient_address_incomplete:${missing.join(", ")}`);
        }
    }

    // Reuse the persisted quote when it is still valid and was created against
    // the current recipient; otherwise create a replacement quote. Quotes are
    // cheap and expiring, so replacing a stale/incompatible quote is safe.
    const existingQuoteRef = payout.provider_quote_ref ? String(payout.provider_quote_ref) : "";
    const quoteExpiresAt = payout.quote_expires_at ? String(payout.quote_expires_at) : "";
    const canReuseQuote = shouldReuseQuote({
        providerQuoteRef: existingQuoteRef || null,
        quoteExpiresAt: quoteExpiresAt || null,
        snapshotRecipientRef,
        currentRecipientRef: recipientRef
    });

    let quote: {
        providerQuoteRef: string;
        sourceCurrency: string;
        targetCurrency: string;
        sourceAmount: number;
        targetAmount: number;
        fee: number;
        rate: number | null;
        expiresAt: string | null;
    };

    if (canReuseQuote) {
        quote = {
            providerQuoteRef: existingQuoteRef,
            sourceCurrency,
            targetCurrency,
            sourceAmount,
            targetAmount: Number(payout.quote_target_amount_minor ?? 0) / 100,
            fee: Number(payout.quote_fee_amount_minor ?? 0) / 100,
            rate: payout.quote_rate == null ? null : Number(payout.quote_rate),
            expiresAt: quoteExpiresAt
        };
    } else {
        await recordAttempt(payoutId, "create_quote", "started");
        quote = await provider.createQuote({
            profileId: config.profileId,
            sourceCurrency,
            targetCurrency,
            sourceAmount,
            targetAccount: recipientRef
        });
        await recordAttempt(payoutId, "create_quote", "succeeded", quote.providerQuoteRef);

        // Persist the quote as the incomplete-but-recoverable preparation state.
        await rest(`payouts?id=eq.${encodeURIComponent(payoutId)}`, {
            method: "PATCH",
            body: JSON.stringify({
                status: "provider_quote_created",
                provider_quote_ref: quote.providerQuoteRef,
                quote_source_currency: quote.sourceCurrency,
                quote_target_currency: quote.targetCurrency,
                quote_source_amount_minor: Math.round(quote.sourceAmount * 100),
                quote_target_amount_minor: Math.round(quote.targetAmount * 100),
                quote_fee_amount_minor: Math.round(quote.fee * 100),
                quote_rate: quote.rate,
                quote_expires_at: quote.expiresAt,
                updated_at: new Date().toISOString()
            })
        });
    }

    // Create exactly one transfer. `customerTransactionId` is the Wise
    // idempotency key, so retries reconcile with any transfer Wise may already
    // have created rather than minting a duplicate real-money transfer.
    await recordAttempt(payoutId, "create_transfer", "started");
    const transfer = await provider.createTransfer({
        quoteUuid: quote.providerQuoteRef,
        targetAccount: recipientRef,
        customerTransactionId: payoutId,
        reference: `AnimalDex ${payoutId.slice(0, 8)}`
    });
    await recordAttempt(payoutId, "create_transfer", "succeeded", transfer.providerTransferRef);

    await rest(`payouts?id=eq.${encodeURIComponent(payoutId)}`, {
        method: "PATCH",
        body: JSON.stringify({
            status: "provider_transfer_created",
            provider_transfer_ref: transfer.providerTransferRef,
            provider_payout_ref: transfer.providerTransferRef,
            provider_status: transfer.status,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
    });

    await rpc("monetization_admin_audit_write", {
        p_action: "payout_provider_transfer_prepared",
        p_actor_operator_id: operator.id,
        p_actor_label: operator.email,
        p_user_id: payout.user_id,
        p_payout_id: payoutId,
        p_metadata: {
            provider: "wise",
            environment: config.environment,
            quote_ref: quote.providerQuoteRef,
            transfer_ref: transfer.providerTransferRef,
            provider_status: transfer.status,
            funded: false,
            reused_quote: canReuseQuote
        }
    });

    return {
        ok: true,
        status: "provider_transfer_created",
        transferRef: transfer.providerTransferRef,
        providerStatus: transfer.status,
        quote: {
            sourceCurrency: quote.sourceCurrency,
            sourceAmountMinor: Math.round(quote.sourceAmount * 100),
            targetCurrency: quote.targetCurrency,
            targetAmountMinor: Math.round(quote.targetAmount * 100),
            feeAmountMinor: Math.round(quote.fee * 100),
            rate: quote.rate
        }
    };
}

/** Production-safe: record final Wise quote after you paid in Wise Business. */
export async function recordManualWiseTransfer(
    payoutId: string,
    actor: AdminActor,
    input: {
        providerTransferRef: string;
        quoteSourceCurrency: string;
        quoteTargetCurrency: string;
        quoteSourceAmountMinor: number;
        quoteTargetAmountMinor: number;
        quoteFeeAmountMinor: number;
        quoteRate: number;
        providerStatus?: string;
    }
) {
    const operator = await ensureNamedFinanceOperator(actor);
    return rpc<Record<string, unknown>>("admin_record_manual_wise_transfer", {
        p_payout_id: payoutId,
        p_actor_operator_id: operator.id,
        p_provider_transfer_ref: input.providerTransferRef,
        p_quote_source_currency: input.quoteSourceCurrency.toUpperCase(),
        p_quote_target_currency: input.quoteTargetCurrency.toUpperCase(),
        p_quote_source_amount_minor: input.quoteSourceAmountMinor,
        p_quote_target_amount_minor: input.quoteTargetAmountMinor,
        p_quote_fee_amount_minor: input.quoteFeeAmountMinor,
        p_quote_rate: input.quoteRate,
        p_provider_status: input.providerStatus ?? "outgoing_payment_sent"
    });
}

/** Production-safe: release hold + debit Available → Paid. */
export async function confirmManualPayoutPaid(payoutId: string, actor: AdminActor) {
    const operator = await ensureNamedFinanceOperator(actor);
    const rows = await rest<Array<Record<string, unknown>>>(
        `payouts?id=eq.${encodeURIComponent(payoutId)}&select=*&limit=1`
    );
    const payout = rows?.[0];
    if (!payout) throw new Error("payout_not_found");
    const transferRef = payout.provider_transfer_ref ? String(payout.provider_transfer_ref) : "";
    if (!transferRef.trim()) throw new Error("provider_transfer_missing");

    const diagnostics = await getPayoutDiagnostics();
    const provider = new WisePayoutProvider(loadWiseConfigForCurrentEnvironment(diagnostics.isProduction));
    provider.validateConfiguration();
    const transfer = await provider.getTransfer(transferRef);
    const decision = await applyProviderStatusToPayout({
        payoutId,
        currentStatus: String(payout.status),
        wiseStatus: transfer.status,
        operatorId: operator.id
    });
    if (decision.action !== "paid") {
        return {
            ok: false,
            status: decision.nextStatus,
            providerStatus: transfer.status,
            message: "Wise has not reported outgoing_payment_sent yet."
        };
    }

    return {
        ok: true,
        status: "paid",
        providerStatus: transfer.status
    };
}

/** Legacy fallback: trusts operator-entered Wise facts. Not the normal production path. */
export async function confirmManualPayoutPaidWithoutProviderCheck(payoutId: string, actor: AdminActor) {
    const operator = await ensureNamedFinanceOperator(actor);
    try {
        return await rpc<Record<string, unknown>>("admin_confirm_manual_payout_paid", {
            p_payout_id: payoutId,
            p_actor_operator_id: operator.id
        });
    } catch {
        // Fallback before notification migration is applied.
        return rpc<Record<string, unknown>>("admin_complete_payout_from_hold", {
            p_payout_id: payoutId,
            p_actor_operator_id: operator.id,
            p_provider_status: "outgoing_payment_sent"
        });
    }
}

async function recordAttempt(
    payoutId: string,
    operation: string,
    status: string,
    providerRequestRef?: string | null,
    failureCode?: string | null
) {
    const existing = await rest<Array<{attempt_number: number}>>(
        `payout_attempts?payout_id=eq.${payoutId}&select=attempt_number&order=attempt_number.desc&limit=1`
    );
    const attemptNumber = (existing?.[0]?.attempt_number ?? 0) + 1;
    await rest("payout_attempts", {
        method: "POST",
        body: JSON.stringify({
            payout_id: payoutId,
            attempt_number: attemptNumber,
            provider: "wise",
            operation,
            provider_request_ref: providerRequestRef ?? null,
            status,
            failure_code: failureCode ?? null,
            completed_at: status === "started" ? null : new Date().toISOString()
        })
    });
}

export async function approveAndExecuteSandboxPayout(payoutId: string, actor: AdminActor) {
    await requireNonProductionForFixtures();
    const operator = await ensureNamedFinanceOperator(actor);
    const provider = new WisePayoutProvider(loadWiseConfigFromEnv());
    provider.validateConfiguration();

    const reserved = await rpc<Record<string, unknown>>("admin_reserve_payout_earnings", {
        p_payout_id: payoutId,
        p_actor_operator_id: operator.id
    });

    const amountMajor = Number(reserved.amount_minor) / 100;
    const currency = String(reserved.currency_code);
    if (currency !== "GBP" && currency !== "USD") {
        throw new Error("phase7b_currency_not_in_sandbox_scope");
    }

    // Prefer same-currency GBP sandbox recipient fixtures from Wise docs.
    const recipientFixture =
        currency === "GBP" ? WISE_SANDBOX_GBP_SUCCESS_RECIPIENT : WISE_SANDBOX_GBP_SUCCESS_RECIPIENT;
    if (currency !== "GBP") {
        // Phase 7B prefers GBP same-currency; refuse USD until fixture confirmed.
        throw new Error("phase7b_use_gbp_same_currency_sandbox");
    }

    try {
        await recordAttempt(payoutId, "create_recipient", "started");
        const recipient = await provider.createRecipient({
            ...recipientFixture,
            profileId: loadWiseConfigFromEnv().profileId
        });
        await recordAttempt(payoutId, "create_recipient", "succeeded", recipient.providerRecipientRef);

        await rest(`payout_profiles?id=eq.${reserved.payout_profile_id}`, {
            method: "PATCH",
            body: JSON.stringify({
                provider_recipient_ref: recipient.providerRecipientRef,
                masked_destination: recipientFixture.maskedDestination,
                status: "active",
                verification_status: "verified",
                environment: "sandbox",
                verification_mode: "sandbox_test"
            })
        }).catch(() => null);

        await recordAttempt(payoutId, "create_quote", "started");
        const quote = await provider.createQuote({
            profileId: loadWiseConfigFromEnv().profileId,
            sourceCurrency: currency,
            targetCurrency: currency,
            sourceAmount: amountMajor,
            targetAccount: recipient.providerRecipientRef
        });
        await recordAttempt(payoutId, "create_quote", "succeeded", quote.providerQuoteRef);

        await rest(`payouts?id=eq.${payoutId}`, {
            method: "PATCH",
            body: JSON.stringify({
                status: "provider_quote_created",
                provider_quote_ref: quote.providerQuoteRef,
                quote_source_currency: quote.sourceCurrency,
                quote_target_currency: quote.targetCurrency,
                quote_source_amount_minor: Math.round(quote.sourceAmount * 100),
                quote_target_amount_minor: Math.round(quote.targetAmount * 100),
                quote_fee_amount_minor: Math.round(quote.fee * 100),
                quote_rate: quote.rate,
                quote_expires_at: quote.expiresAt,
                updated_at: new Date().toISOString()
            })
        });

        await recordAttempt(payoutId, "create_transfer", "started");
        const transfer = await provider.createTransfer({
            quoteUuid: quote.providerQuoteRef,
            targetAccount: recipient.providerRecipientRef,
            customerTransactionId: payoutId,
            reference: `AnimalDex ${payoutId.slice(0, 8)}`
        });
        await recordAttempt(payoutId, "create_transfer", "succeeded", transfer.providerTransferRef);

        await rest(`payouts?id=eq.${payoutId}`, {
            method: "PATCH",
            body: JSON.stringify({
                status: "provider_transfer_created",
                provider_transfer_ref: transfer.providerTransferRef,
                provider_payout_ref: transfer.providerTransferRef,
                provider_status: transfer.status,
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
        });

        await recordAttempt(payoutId, "fund_transfer", "started");
        const funded = await provider.fundTransfer({
            profileId: loadWiseConfigFromEnv().profileId,
            transferId: transfer.providerTransferRef
        });
        await recordAttempt(payoutId, "fund_transfer", funded.errorCode ? "failed" : "succeeded", null, funded.errorCode);

        if (funded.errorCode) {
            await rpc("admin_fail_payout_and_release", {
                p_payout_id: payoutId,
                p_failure_code: funded.errorCode,
                p_actor_operator_id: operator.id
            });
            return {ok: false, status: "failed", failureCode: funded.errorCode};
        }

        await rest(`payouts?id=eq.${payoutId}`, {
            method: "PATCH",
            body: JSON.stringify({
                status: "processing",
                provider_status: transfer.status,
                updated_at: new Date().toISOString()
            })
        });

        // Sandbox: advance toward paid via documented simulation endpoint when available.
        try {
            await provider.simulateTransferStatus?.(transfer.providerTransferRef, "processing");
            await new Promise((r) => setTimeout(r, 5500));
            await provider.simulateTransferStatus?.(transfer.providerTransferRef, "funds_converted");
            await new Promise((r) => setTimeout(r, 5500));
            const sent = await provider.simulateTransferStatus?.(
                transfer.providerTransferRef,
                "outgoing_payment_sent"
            );
            if (sent?.status === "outgoing_payment_sent") {
                await rpc("admin_complete_payout_from_hold", {
                    p_payout_id: payoutId,
                    p_actor_operator_id: operator.id,
                    p_provider_status: "outgoing_payment_sent"
                });
                return {ok: true, status: "paid", transferRef: transfer.providerTransferRef};
            }
        } catch {
            // Simulation may be unavailable; leave processing for webhook/poll.
        }

        return {ok: true, status: "processing", transferRef: transfer.providerTransferRef};
    } catch (error) {
        const message = error instanceof Error ? error.message : "provider_failed";
        await recordAttempt(payoutId, "execute", "failed", null, message.slice(0, 120));
        await rpc("admin_fail_payout_and_release", {
            p_payout_id: payoutId,
            p_failure_code: message.slice(0, 120),
            p_actor_operator_id: operator.id
        });
        throw error;
    }
}

export async function refreshPayoutProviderStatus(payoutId: string, actor: AdminActor) {
    const operator = await ensureNamedFinanceOperator(actor);
    const diagnostics = await getPayoutDiagnostics();
    const provider = new WisePayoutProvider(loadWiseConfigForCurrentEnvironment(diagnostics.isProduction));
    provider.validateConfiguration();

    const rows = await rest<Array<Record<string, unknown>>>(
        `payouts?id=eq.${payoutId}&select=*&limit=1`
    );
    const payout = rows?.[0];
    if (!payout) throw new Error("payout_not_found");
    const transferRef = payout.provider_transfer_ref ? String(payout.provider_transfer_ref) : null;
    if (!transferRef) throw new Error("provider_transfer_missing");

    const transfer = await provider.getTransfer(transferRef);
    return applyProviderStatusToPayout({
        payoutId,
        currentStatus: String(payout.status),
        wiseStatus: transfer.status,
        operatorId: operator.id
    });
}

async function applyProviderStatusToPayout(input: {
    payoutId: string;
    currentStatus: string;
    wiseStatus: string;
    operatorId: string | null;
}) {
    const decision = applyProviderPayoutStatus({
        currentStatus: input.currentStatus,
        wiseStatus: input.wiseStatus
    });
    await rest(`payouts?id=eq.${input.payoutId}`, {
        method: "PATCH",
        body: JSON.stringify({
            provider_status: input.wiseStatus,
            updated_at: new Date().toISOString(),
            ...(decision.action === "processing" ? {status: "processing"} : {}),
            ...(decision.action === "hold" ? {status: "held"} : {})
        })
    });

    if (decision.action === "paid") {
        await rpc("admin_complete_payout_from_hold", {
            p_payout_id: input.payoutId,
            p_actor_operator_id: input.operatorId,
            p_provider_status: input.wiseStatus
        });
    } else if (decision.action === "fail") {
        await rpc("admin_fail_payout_and_release", {
            p_payout_id: input.payoutId,
            p_failure_code: input.wiseStatus,
            p_actor_operator_id: input.operatorId
        });
    } else if (decision.action === "reverse") {
        await rpc("admin_reverse_paid_payout", {
            p_payout_id: input.payoutId,
            p_actor_operator_id: input.operatorId,
            p_reason: input.wiseStatus
        });
    }

    await rpc("monetization_admin_audit_write", {
        p_action: "payout_status_refresh",
        p_actor_operator_id: input.operatorId,
        p_actor_label: "finance",
        p_user_id: null,
        p_payout_id: input.payoutId,
        p_metadata: {
            wise_status: input.wiseStatus,
            action: decision.action,
            next_status: decision.nextStatus
        }
    });

    return decision;
}

/**
 * Wise webhook ingress is allowed on production.
 * Sandbox fixture generation remains blocked elsewhere via requireNonProductionForFixtures.
 */
export async function ingestWiseWebhook(rawBody: string, headers: Headers) {
    const signatureHeader =
        headers.get("X-Signature-SHA256") ||
        headers.get("x-signature-sha256") ||
        headers.get("X-Signature-Sha256");

    // Wise Developer Hub reachability probes are often unsigned GET/HEAD/POST.
    // Ack without processing; only signed deliveries may mutate payout state.
    if (!signatureHeader) {
        return {ok: true, ready: true};
    }

    const preferred =
        (process.env.WISE_ENVIRONMENT?.trim().toLowerCase() as "sandbox" | "production" | undefined) ||
        "production";
    if (!verifyWiseWebhookSignature(rawBody, headers, preferred)) {
        throw new Error("wise_webhook_signature_invalid");
    }


    const isTestNotification =
        (headers.get("X-Test-Notification") || headers.get("x-test-notification") || "").toLowerCase() ===
        "true";

    let payload: unknown;
    try {
        payload = JSON.parse(rawBody) as unknown;
    } catch {
        throw new Error("wise_webhook_payload_invalid");
    }

    // Subscription setup sends a signed test event; ack without ledger side effects.
    if (isTestNotification) {
        return {ok: true, test: true};
    }

    const provider = new WisePayoutProvider({
        environment: preferred === "sandbox" ? "sandbox" : "production",
        apiToken: "webhook-only",
        profileId: "webhook-only",
        webhookPublicKeyPem: process.env.WISE_WEBHOOK_PUBLIC_KEY?.trim() || null
    });
    const parsed = provider.parseProviderEvent(payload);
    const deliveryId = headers.get("X-Delivery-Id") || headers.get("x-delivery-id") || parsed.eventId;
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const environment = preferred === "sandbox" ? "sandbox" : "production";

    try {
        await rest("payout_provider_events", {
            method: "POST",
            body: JSON.stringify({
                provider: "wise",
                environment,
                provider_event_id: deliveryId,
                event_type: parsed.eventType,
                provider_transfer_ref: parsed.transferRef,
                payload_hash: payloadHash,
                processing_status: "received",
                status: "received"
            })
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.toLowerCase().includes("duplicate") || message.includes("23505")) {
            return {ok: true, duplicate: true};
        }
        if (message.includes("payout_provider_events_unique")) {
            return {ok: true, duplicate: true};
        }
    }

    if (parsed.transferRef && parsed.providerStatus) {
        const rows = await rest<Array<Record<string, unknown>>>(
            `payouts?provider_transfer_ref=eq.${encodeURIComponent(parsed.transferRef)}&select=id,status&limit=1`
        );
        const payout = rows?.[0];
        if (payout) {
            await applyProviderStatusToPayout({
                payoutId: String(payout.id),
                currentStatus: String(payout.status),
                wiseStatus: parsed.providerStatus,
                operatorId: null
            });
            await rest(
                `payout_provider_events?provider=eq.wise&provider_event_id=eq.${encodeURIComponent(deliveryId)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        payout_id: payout.id,
                        processed_at: new Date().toISOString(),
                        processing_status: "processed",
                        status: "processed"
                    })
                }
            );
        }
    }

    return {ok: true, duplicate: false, eventId: deliveryId};
}

export async function createSandboxPayoutRequest(input: {
    userId: string;
    currencyCode: string;
    amountMinor: number;
    payoutProfileId: string;
}) {
    await requireNonProductionForFixtures();
    if (!(input.amountMinor > 0)) throw new Error("invalid_amount");
    const idempotencyKey = `payout-req:${input.userId}:${input.currencyCode}:${input.amountMinor}:${randomUUID()}`;
    const rows = await rest<Array<Record<string, unknown>>>("payouts", {
        method: "POST",
        body: JSON.stringify({
            user_id: input.userId,
            payout_profile_id: input.payoutProfileId,
            currency_code: input.currencyCode,
            amount_minor: input.amountMinor,
            fee_amount_minor: 0,
            net_amount_minor: input.amountMinor,
            status: "requested",
            provider: "wise",
            environment: "sandbox",
            idempotency_key: idempotencyKey
        })
    });
    return rows?.[0] ?? null;
}

export {WISE_SANDBOX_GBP_FAILURE_RECIPIENT, WISE_SANDBOX_GBP_SUCCESS_RECIPIENT};
