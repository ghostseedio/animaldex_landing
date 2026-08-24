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
    await requireNonProductionForFixtures();
    const rows = await rest<Array<Record<string, unknown>>>(
        "payouts?select=id,user_id,currency_code,amount_minor,status,provider,environment,provider_transfer_ref,provider_status,failure_code,created_at,updated_at,approved_by&order=created_at.desc&limit=100"
    );
    return (rows || []).map((p) => ({
        payoutId: String(p.id),
        userId: String(p.user_id),
        currencyCode: String(p.currency_code),
        amountMinor: Number(p.amount_minor ?? 0),
        status: String(p.status),
        provider: String(p.provider),
        environment: String(p.environment),
        providerTransferRef: p.provider_transfer_ref ? String(p.provider_transfer_ref) : null,
        providerStatus: p.provider_status ? String(p.provider_status) : null,
        failureCode: p.failure_code ? String(p.failure_code) : null,
        createdAt: String(p.created_at ?? ""),
        approvedBy: p.approved_by ? String(p.approved_by) : null
    }));
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
    await requireNonProductionForFixtures();
    const operator = await ensureNamedFinanceOperator(actor);
    const provider = new WisePayoutProvider(loadWiseConfigFromEnv());
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
