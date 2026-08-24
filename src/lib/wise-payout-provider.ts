/**
 * Wise Platform payout provider (sandbox-first).
 * Docs: https://docs.wise.com/guides/product/send-money/use-cases/enterprise/send-money
 * Sandbox base: https://api.wise-sandbox.com
 * Transfer idempotency: customerTransactionId
 * Webhooks: X-Signature-SHA256 + RSA public key (not a shared secret).
 */

import {createVerify} from "crypto";
import type {
    PayoutProvider,
    PayoutProviderIdentity,
    ProviderFundResult,
    ProviderQuote,
    ProviderTransfer,
    WiseRecipientDetails
} from "./payout-provider";
import {PayoutEnvironmentError} from "./payout-environment";

const SANDBOX_BASE = "https://api.wise-sandbox.com";
const PRODUCTION_BASE = "https://api.wise.com";
/** Current Wise Platform versioned path from official docs (2026Q3). */
const API_PREFIX = "/v1";

export type WiseConfig = {
    environment: "sandbox" | "production";
    apiToken: string;
    profileId: string;
    balanceId?: string | null;
    webhookPublicKeyPem?: string | null;
    legalEntityName?: string | null;
    fetchImpl?: typeof fetch;
};

export class WiseConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "WiseConfigurationError";
    }
}

export function loadWiseConfigFromEnv(): WiseConfig {
    const environment = (process.env.WISE_ENVIRONMENT?.trim().toLowerCase() || "sandbox") as
        | "sandbox"
        | "production";
    if (environment !== "sandbox" && environment !== "production") {
        throw new WiseConfigurationError("WISE_ENVIRONMENT must be sandbox or production");
    }
    const apiToken = process.env.WISE_API_TOKEN?.trim() || "";
    const profileId = process.env.WISE_PROFILE_ID?.trim() || "";
    if (!apiToken || !profileId) {
        throw new WiseConfigurationError(
            "Wise credentials missing: set WISE_API_TOKEN and WISE_PROFILE_ID (sandbox only for Phase 7B)"
        );
    }
    return {
        environment,
        apiToken,
        profileId,
        balanceId: process.env.WISE_BALANCE_ID?.trim() || null,
        webhookPublicKeyPem: process.env.WISE_WEBHOOK_PUBLIC_KEY?.trim() || null,
        legalEntityName: process.env.WISE_LEGAL_ENTITY_NAME?.trim() || "Ghostseed Ltd"
    };
}

export class WisePayoutProvider implements PayoutProvider {
    constructor(private readonly config: WiseConfig) {}

    getProviderIdentity(): PayoutProviderIdentity {
        return {
            provider: "wise",
            environment: this.config.environment,
            legalEntityName: this.config.legalEntityName ?? "Ghostseed Ltd"
        };
    }

    validateConfiguration(): void {
        if (!this.config.apiToken || !this.config.profileId) {
            throw new WiseConfigurationError("Wise API token/profile not configured");
        }
        if (this.config.environment !== "sandbox") {
            // Phase 7B hard stop for live Wise from this integration surface.
            throw new PayoutEnvironmentError("phase7b_allows_wise_sandbox_only");
        }
    }

    private baseUrl(): string {
        return this.config.environment === "sandbox" ? SANDBOX_BASE : PRODUCTION_BASE;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        this.validateConfiguration();
        const fetchImpl = this.config.fetchImpl ?? fetch;
        const response = await fetchImpl(`${this.baseUrl()}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.config.apiToken}`,
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: "no-store"
        });
        const text = await response.text();
        let json: unknown = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = {raw: text};
        }
        if (!response.ok) {
            const message =
                typeof json === "object" && json && "error" in json
                    ? JSON.stringify((json as {error: unknown}).error)
                    : text.slice(0, 300);
            throw new Error(`wise_http_${response.status}:${message}`);
        }
        return json as T;
    }

    async createRecipient(input: WiseRecipientDetails): Promise<{providerRecipientRef: string}> {
        const payload = {
            currency: input.currency,
            type: input.type,
            profile: Number(input.profileId),
            accountHolderName: input.accountHolderName,
            ownedByCustomer: false,
            details: input.details
        };
        const created = await this.request<{id: number | string}>("POST", `${API_PREFIX}/accounts`, payload);
        return {providerRecipientRef: String(created.id)};
    }

    async createQuote(input: {
        profileId: string;
        sourceCurrency: string;
        targetCurrency: string;
        sourceAmount: number;
        targetAccount?: string | number;
    }): Promise<ProviderQuote> {
        if (input.sourceCurrency !== input.targetCurrency) {
            throw new Error("phase7b_same_currency_only");
        }
        const body: Record<string, unknown> = {
            sourceCurrency: input.sourceCurrency,
            targetCurrency: input.targetCurrency,
            sourceAmount: input.sourceAmount,
            targetAmount: null
        };
        if (input.targetAccount != null) {
            body.targetAccount = Number(input.targetAccount);
        }
        // Prefer versioned quotes path when available; fall back to classic /v1 for sandbox tokens.
        let quote: Record<string, unknown>;
        try {
            quote = await this.request<Record<string, unknown>>(
                "POST",
                `/v3/profiles/${input.profileId}/quotes`,
                body
            );
        } catch {
            quote = await this.request<Record<string, unknown>>(
                "POST",
                `${API_PREFIX}/quotes`,
                {...body, profile: Number(input.profileId)}
            );
        }
        const id = String(quote.id ?? quote.uuid ?? "");
        const paymentOptions = Array.isArray(quote.paymentOptions)
            ? (quote.paymentOptions as Array<Record<string, unknown>>)
            : [];
        const option = paymentOptions[0] ?? {};
        const fee =
            typeof option.fee === "object" && option.fee && "total" in (option.fee as object)
                ? Number((option.fee as {total: number}).total)
                : Number(quote.fee ?? 0);
        return {
            providerQuoteRef: id,
            sourceCurrency: String(quote.sourceCurrency ?? input.sourceCurrency),
            targetCurrency: String(quote.targetCurrency ?? input.targetCurrency),
            sourceAmount: Number(quote.sourceAmount ?? input.sourceAmount),
            targetAmount: Number(quote.targetAmount ?? input.sourceAmount),
            fee: Number.isFinite(fee) ? fee : 0,
            rate: quote.rate == null ? null : Number(quote.rate),
            expiresAt: quote.expirationTime ? String(quote.expirationTime) : null
        };
    }

    async createTransfer(input: {
        quoteUuid: string;
        targetAccount: string | number;
        customerTransactionId: string;
        reference: string;
    }): Promise<ProviderTransfer> {
        const created = await this.request<Record<string, unknown>>("POST", `${API_PREFIX}/transfers`, {
            targetAccount: Number(input.targetAccount),
            quoteUuid: input.quoteUuid,
            customerTransactionId: input.customerTransactionId,
            details: {reference: input.reference}
        });
        return {
            providerTransferRef: String(created.id),
            customerTransactionId: String(created.customerTransactionId ?? input.customerTransactionId),
            status: String(created.status ?? "incoming_payment_waiting"),
            createdAt: created.created ? String(created.created) : null
        };
    }

    async fundTransfer(input: {
        profileId: string;
        transferId: string | number;
        type?: string;
        balanceId?: string | number;
    }): Promise<ProviderFundResult> {
        const balanceId = input.balanceId ?? this.config.balanceId;
        const body: Record<string, unknown> = {type: input.type ?? "BALANCE"};
        if (balanceId) body.balanceId = Number(balanceId);
        const result = await this.request<Record<string, unknown>>(
            "POST",
            `${API_PREFIX}/profiles/${input.profileId}/transfers/${input.transferId}/payments`,
            body
        );
        return {
            status: String(result.status ?? result.type ?? "COMPLETED"),
            errorCode: result.errorCode ? String(result.errorCode) : null
        };
    }

    async getTransfer(transferId: string | number): Promise<ProviderTransfer> {
        const transfer = await this.request<Record<string, unknown>>(
            "GET",
            `${API_PREFIX}/transfers/${transferId}`
        );
        return {
            providerTransferRef: String(transfer.id),
            customerTransactionId: String(transfer.customerTransactionId ?? ""),
            status: String(transfer.status ?? "unknown"),
            createdAt: transfer.created ? String(transfer.created) : null
        };
    }

    async simulateTransferStatus(transferId: string | number, status: string): Promise<ProviderTransfer> {
        // Sandbox simulation endpoint (official tracking-transfers guide)
        await this.request(
            "GET",
            `${API_PREFIX}/simulation/transfers/${transferId}/${encodeURIComponent(status)}`
        );
        return this.getTransfer(transferId);
    }

    verifyWebhook(headers: Headers, rawBody: string): boolean {
        const signature = headers.get("X-Signature-SHA256") || headers.get("x-signature-sha256");
        const pem = this.config.webhookPublicKeyPem;
        if (!signature || !pem) {
            return false;
        }
        try {
            const verifier = createVerify("RSA-SHA256");
            verifier.update(rawBody);
            verifier.end();
            return verifier.verify(pem, signature, "base64");
        } catch {
            return false;
        }
    }

    parseProviderEvent(payload: unknown): {
        eventId: string;
        eventType: string;
        transferRef: string | null;
        providerStatus: string | null;
    } {
        const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
        const resource =
            data.resource && typeof data.resource === "object"
                ? (data.resource as Record<string, unknown>)
                : data;
        const transferRef =
            resource.id != null
                ? String(resource.id)
                : resource.transfer_id != null
                  ? String(resource.transfer_id)
                  : null;
        const currentState =
            resource.current_state != null
                ? String(resource.current_state)
                : resource.status != null
                  ? String(resource.status)
                  : null;
        return {
            eventId: String(body.subscription_id ?? body.event_id ?? body.id ?? `${transferRef}:${body.sent_at}`),
            eventType: String(body.event_type ?? body.eventType ?? "transfers#state-change"),
            transferRef,
            providerStatus: currentState
        };
    }
}

/** Documented GBP sandbox-style recipient fields from Wise docs (examples). Not real PII. */
export const WISE_SANDBOX_GBP_SUCCESS_RECIPIENT = {
    currency: "GBP",
    type: "sort_code",
    accountHolderName: "Sandbox Success Recipient",
    details: {
        legalType: "PRIVATE",
        sortCode: "040075",
        accountNumber: "37778842"
    },
    maskedDestination: "GB sort ****8842"
};

export const WISE_SANDBOX_GBP_FAILURE_RECIPIENT = {
    currency: "GBP",
    type: "sort_code",
    accountHolderName: "Sandbox Failure Recipient",
    details: {
        legalType: "PRIVATE",
        sortCode: "000000",
        accountNumber: "00000000"
    },
    maskedDestination: "GB sort ****0000"
};
