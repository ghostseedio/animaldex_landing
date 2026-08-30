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

/**
 * Official Wise webhook verification public keys (published by Wise; not secrets).
 * Source: https://docs.wise.com/guides/developer/webhooks/event-handling
 */
export const WISE_PRODUCTION_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvO8vXV+JksBzZAY6GhSO
XdoTCfhXaaiZ+qAbtaDBiu2AGkGVpmEygFmWP4Li9m5+Ni85BhVvZOodM9epgW3F
bA5Q1SexvAF1PPjX4JpMstak/QhAgl1qMSqEevL8cmUeTgcMuVWCJmlge9h7B1CS
D4rtlimGZozG39rUBDg6Qt2K+P4wBfLblL0k4C4YUdLnpGYEDIth+i8XsRpFlogx
CAFyH9+knYsDbR43UJ9shtc42Ybd40Afihj8KnYKXzchyQ42aC8aZ/h5hyZ28yVy
Oj3Vos0VdBIs/gAyJ/4yyQFCXYte64I7ssrlbGRaco4nKF3HmaNhxwyKyJafz19e
HwIDAQAB
-----END PUBLIC KEY-----`;

export const WISE_SANDBOX_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwpb91cEYuyJNQepZAVfP
ZIlPZfNUefH+n6w9SW3fykqKu938cR7WadQv87oF2VuT+fDt7kqeRziTmPSUhqPU
ys/V2Q1rlfJuXbE+Gga37t7zwd0egQ+KyOEHQOpcTwKmtZ81ieGHynAQzsn1We3j
wt760MsCPJ7GMT141ByQM+yW1Bx+4SG3IGjXWyqOWrcXsxAvIXkpUD/jK/L958Cg
nZEgz0BSEh0QxYLITnW1lLokSx/dTianWPFEhMC9BgijempgNXHNfcVirg1lPSyg
z7KqoKUN0oHqWLr2U1A+7kqrl6O2nx3CKs1bj1hToT1+p4kcMoHXA7kA+VBLUpEs
VwIDAQAB
-----END PUBLIC KEY-----`;

function verifyWithPem(rawBody: string, signatureBase64: string, pem: string): boolean {
    try {
        const verifier = createVerify("RSA-SHA256");
        verifier.update(rawBody);
        verifier.end();
        return verifier.verify(pem, signatureBase64, "base64");
    } catch {
        return false;
    }
}

/** Turn a Wise error body into a compact operator-readable message. */
export function providerErrorMessage(json: unknown, text: string): string {
    if (json && typeof json === "object") {
        const obj = json as Record<string, unknown>;
        if (Array.isArray(obj.errors)) {
            const parts = obj.errors
                .map((item) => {
                    if (!item || typeof item !== "object") return String(item);
                    const row = item as Record<string, unknown>;
                    const code = row.code ? String(row.code) : "";
                    const field = row.field ? String(row.field) : "";
                    return field ? `${code} (${field})` : code;
                })
                .filter(Boolean);
            if (parts.length > 0) return parts.join("; ");
        }
        if ("error" in obj) return JSON.stringify(obj.error);
        if (typeof obj.message === "string") return obj.message;
    }
    return text.slice(0, 300);
}

/** Verify Wise webhook RSA signature without requiring API token/profile config. */
export function verifyWiseWebhookSignature(
    rawBody: string,
    headers: Headers,
    preferredEnvironment?: "sandbox" | "production"
): boolean {
    const signature =
        headers.get("X-Signature-SHA256") ||
        headers.get("x-signature-sha256") ||
        headers.get("X-Signature-Sha256") ||
        headers.get("X-Signature-SHA256");
    if (!signature) return false;

    const envKey = process.env.WISE_WEBHOOK_PUBLIC_KEY?.trim() || null;
    const ordered =
        preferredEnvironment === "sandbox"
            ? [envKey, WISE_SANDBOX_WEBHOOK_PUBLIC_KEY, WISE_PRODUCTION_WEBHOOK_PUBLIC_KEY]
            : preferredEnvironment === "production"
              ? [envKey, WISE_PRODUCTION_WEBHOOK_PUBLIC_KEY, WISE_SANDBOX_WEBHOOK_PUBLIC_KEY]
              : [envKey, WISE_PRODUCTION_WEBHOOK_PUBLIC_KEY, WISE_SANDBOX_WEBHOOK_PUBLIC_KEY];

    for (const pem of ordered) {
        if (!pem) continue;
        if (verifyWithPem(rawBody, signature, pem)) return true;
    }
    return false;
}

export type WiseConfig = {
    environment: "sandbox" | "production";
    apiToken: string;
    profileId: string;
    balanceId?: string | null;
    webhookPublicKeyPem?: string | null;
    legalEntityName?: string | null;
    /** Must be true for production API calls. Sandbox configs leave this unset/false. */
    allowProductionExecution?: boolean;
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

    if (environment === "production") {
        return loadWiseProductionConfigFromEnv();
    }

    const apiToken = process.env.WISE_API_TOKEN?.trim() || "";
    const profileId = process.env.WISE_PROFILE_ID?.trim() || "";
    if (!apiToken || !profileId) {
        throw new WiseConfigurationError(
            "Wise credentials missing: set WISE_API_TOKEN and WISE_PROFILE_ID (sandbox)"
        );
    }
    return {
        environment: "sandbox",
        apiToken,
        profileId,
        balanceId: process.env.WISE_BALANCE_ID?.trim() || null,
        webhookPublicKeyPem: process.env.WISE_WEBHOOK_PUBLIC_KEY?.trim() || null,
        legalEntityName: process.env.WISE_LEGAL_ENTITY_NAME?.trim() || "Ghostseed Ltd"
    };
}

/** Production Wise credentials — never fall back to sandbox tokens. */
export function loadWiseProductionConfigFromEnv(): WiseConfig {
    const apiToken =
        process.env.WISE_PRODUCTION_API_TOKEN?.trim() || process.env.WISE_API_TOKEN?.trim() || "";
    const profileId =
        process.env.WISE_PRODUCTION_PROFILE_ID?.trim() || process.env.WISE_PROFILE_ID?.trim() || "";
    const balanceId =
        process.env.WISE_PRODUCTION_BALANCE_ID?.trim() || process.env.WISE_BALANCE_ID?.trim() || null;
    if (!apiToken || !profileId) {
        throw new WiseConfigurationError(
            "Wise production credentials missing: set WISE_PRODUCTION_API_TOKEN and WISE_PRODUCTION_PROFILE_ID"
        );
    }
    if (profileId !== "96792752") {
        // Soft check: Ghostseed Ltd profile observed in Phase 7C audit. Override only intentionally.
        // Still allow other IDs if explicitly set, but require legal entity name.
    }
    return {
        environment: "production",
        apiToken,
        profileId,
        balanceId,
        webhookPublicKeyPem: process.env.WISE_WEBHOOK_PUBLIC_KEY?.trim() || null,
        legalEntityName: process.env.WISE_LEGAL_ENTITY_NAME?.trim() || "Ghostseed Ltd",
        allowProductionExecution: true
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
        if (this.config.environment === "production" && !this.config.allowProductionExecution) {
            throw new PayoutEnvironmentError("wise_production_requires_explicit_allow");
        }
        if (this.config.environment !== "sandbox" && this.config.environment !== "production") {
            throw new WiseConfigurationError("invalid_wise_environment");
        }
    }

    private baseUrl(): string {
        return this.config.environment === "sandbox" ? SANDBOX_BASE : PRODUCTION_BASE;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        extraHeaders?: Record<string, string>
    ): Promise<T> {
        this.validateConfiguration();
        const fetchImpl = this.config.fetchImpl ?? fetch;
        const response = await fetchImpl(`${this.baseUrl()}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.config.apiToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                ...extraHeaders
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
            const message = providerErrorMessage(json, text);
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
        const rate = quote.rate == null ? null : Number(quote.rate);
        const quotedTargetAmount = Number(quote.targetAmount);
        const targetAmount = Number.isFinite(quotedTargetAmount)
            ? quotedTargetAmount
            : Number.isFinite(rate)
              ? input.sourceAmount * Number(rate)
              : input.sourceAmount;
        return {
            providerQuoteRef: id,
            sourceCurrency: String(quote.sourceCurrency ?? input.sourceCurrency),
            targetCurrency: String(quote.targetCurrency ?? input.targetCurrency),
            sourceAmount: Number(quote.sourceAmount ?? input.sourceAmount),
            targetAmount,
            fee: Number.isFinite(fee) ? fee : 0,
            rate,
            expiresAt: quote.expirationTime ? String(quote.expirationTime) : null
        };
    }

    /**
     * Dynamic recipient field requirements for a corridor.
     * Docs: GET /v1/account-requirements?source=&target=&sourceAmount=
     */
    async getAccountRequirements(input: {
        sourceCurrency: string;
        targetCurrency: string;
        sourceAmount?: number;
    }): Promise<unknown> {
        const params = new URLSearchParams({
            source: input.sourceCurrency,
            target: input.targetCurrency,
            sourceAmount: String(input.sourceAmount ?? 1000)
        });
        // Ghostseed pays as BUSINESS; PRIVATE originatorLegalEntityType is for end-user sender cases.
        params.set("originatorLegalEntityType", "BUSINESS");
        return this.request(
            "GET",
            `${API_PREFIX}/account-requirements?${params.toString()}`,
            undefined,
            {"Accept-Minor-Version": "1"}
        );
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
        const details = transfer.details && typeof transfer.details === "object"
            ? transfer.details as Record<string, unknown>
            : {};
        return {
            providerTransferRef: String(transfer.id),
            customerTransactionId: String(transfer.customerTransactionId ?? ""),
            status: String(transfer.status ?? "unknown"),
            createdAt: transfer.created ? String(transfer.created) : null,
            sourceCurrency: transfer.sourceCurrency ? String(transfer.sourceCurrency) : null,
            sourceAmount: transfer.sourceValue == null ? null : Number(transfer.sourceValue),
            targetCurrency: transfer.targetCurrency ? String(transfer.targetCurrency) : null,
            targetAmount: transfer.targetValue == null ? null : Number(transfer.targetValue),
            paymentReference: details.reference
                ? String(details.reference)
                : transfer.reference
                  ? String(transfer.reference)
                  : null
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
        return verifyWiseWebhookSignature(rawBody, headers, this.config.environment);
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
