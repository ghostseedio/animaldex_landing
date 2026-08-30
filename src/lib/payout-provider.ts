/**
 * Provider-neutral payout interface (Phase 7A/7B).
 * Earnings ledger must never call Wise HTTP APIs directly.
 */

export type PayoutProviderIdentity = {
    provider: string;
    environment: "sandbox" | "production";
    legalEntityName: string | null;
};

export type WiseRecipientDetails = {
    currency: string;
    type: string;
    accountHolderName: string;
    profileId: string;
    details: Record<string, unknown>;
    /** Masked for AnimalDex storage only */
    maskedDestination: string;
};

export type ProviderQuote = {
    providerQuoteRef: string;
    sourceCurrency: string;
    targetCurrency: string;
    sourceAmount: number;
    targetAmount: number;
    fee: number;
    rate: number | null;
    expiresAt: string | null;
};

export type ProviderTransfer = {
    providerTransferRef: string;
    customerTransactionId: string;
    status: string;
    createdAt: string | null;
    sourceCurrency?: string | null;
    sourceAmount?: number | null;
    targetCurrency?: string | null;
    targetAmount?: number | null;
    paymentReference?: string | null;
};

export type ProviderFundResult = {
    status: string;
    errorCode: string | null;
};

export interface PayoutProvider {
    getProviderIdentity(): PayoutProviderIdentity;
    validateConfiguration(): void;
    createRecipient(input: WiseRecipientDetails): Promise<{providerRecipientRef: string}>;
    createQuote(input: {
        profileId: string;
        sourceCurrency: string;
        targetCurrency: string;
        sourceAmount: number;
        targetAccount?: string | number;
    }): Promise<ProviderQuote>;
    getAccountRequirements?(input: {
        sourceCurrency: string;
        targetCurrency: string;
        sourceAmount?: number;
    }): Promise<unknown>;
    createTransfer(input: {
        quoteUuid: string;
        targetAccount: string | number;
        customerTransactionId: string;
        reference: string;
    }): Promise<ProviderTransfer>;
    fundTransfer(input: {
        profileId: string;
        transferId: string | number;
        type?: string;
        balanceId?: string | number;
    }): Promise<ProviderFundResult>;
    getTransfer(transferId: string | number): Promise<ProviderTransfer>;
    simulateTransferStatus?(transferId: string | number, status: string): Promise<ProviderTransfer>;
    verifyWebhook?(headers: Headers, rawBody: string): boolean;
    parseProviderEvent?(payload: unknown): {
        eventId: string;
        eventType: string;
        transferRef: string | null;
        providerStatus: string | null;
    };
}
