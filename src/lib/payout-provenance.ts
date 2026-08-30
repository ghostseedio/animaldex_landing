/**
 * Provider-final payment provenance (read model).
 *
 * Pure helpers for building the snapshot of provider-confirmed facts that are
 * persisted onto a PAID payout. Snapshot writes are read-model only: they never
 * alter accounting, holds, or payment state.
 */

import type {ProviderTransfer} from "./payout-provider";

/** Safe decimal → integer minor-unit conversion (never introduces floats). */
export function majorToMinor(value: number | null | undefined): number | null {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.round(value * 100);
}

/**
 * Build the PATCH body that snapshots provider-final facts for a transfer that
 * reached `outgoing_payment_sent`.
 *
 * Idempotency + stability guarantees:
 *  - returns null when the transfer is not final (no write);
 *  - never overwrites an already-stored non-null fact with null/less-complete
 *    data from a later provider response;
 *  - sets `provider_finalized_at` once, on first successful snapshot.
 */
export function providerFinalSnapshotPatch(
    current: Record<string, unknown> | null | undefined,
    transfer: ProviderTransfer | null | undefined,
    nowIso: string
): Record<string, unknown> | null {
    if (!transfer || transfer.status !== "outgoing_payment_sent") return null;

    const c = current ?? {};
    const patch: Record<string, unknown> = {};

    const sourceMinor = majorToMinor(transfer.sourceAmount);
    if (sourceMinor != null && c.provider_final_source_amount_minor == null) {
        patch.provider_final_source_amount_minor = sourceMinor;
    }
    if (transfer.sourceCurrency && c.provider_final_source_currency == null) {
        patch.provider_final_source_currency = transfer.sourceCurrency;
    }

    const targetMinor = majorToMinor(transfer.targetAmount);
    if (targetMinor != null && c.provider_final_target_amount_minor == null) {
        patch.provider_final_target_amount_minor = targetMinor;
    }
    if (transfer.targetCurrency && c.provider_final_target_currency == null) {
        patch.provider_final_target_currency = transfer.targetCurrency;
    }

    if (transfer.paymentReference && c.provider_payment_reference == null) {
        patch.provider_payment_reference = transfer.paymentReference;
    }

    if (c.provider_finalized_at == null) {
        patch.provider_finalized_at = nowIso;
    }

    return Object.keys(patch).length > 0 ? patch : null;
}
