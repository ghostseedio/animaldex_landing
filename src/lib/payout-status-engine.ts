/**
 * Central Wise → AnimalDex payout status mapping (Phase 7B).
 * Paid only on outgoing_payment_sent. Late stale events must not regress Paid.
 */

export type AnimaldexPayoutStatus =
    | "reserved"
    | "processing"
    | "paid"
    | "failed"
    | "reversed"
    | "cancelled"
    | "held";

const TERMINAL_PAID = new Set(["paid", "reversed"]);

export function mapWiseTransferStatus(wiseStatus: string): AnimaldexPayoutStatus {
    switch (wiseStatus) {
        case "incoming_payment_waiting":
        case "incoming_payment_initiated":
        case "processing":
        case "funds_converted":
            return "processing";
        case "outgoing_payment_sent":
            return "paid";
        case "cancelled":
            return "cancelled";
        case "funds_refunded":
        case "charged_back":
            return "reversed";
        case "bounced_back":
            return "held";
        case "unknown":
            return "held";
        default:
            return "processing";
    }
}

export function applyProviderPayoutStatus(input: {
    currentStatus: string;
    wiseStatus: string;
}): {nextStatus: AnimaldexPayoutStatus; action: "noop" | "processing" | "paid" | "fail" | "reverse" | "hold"} {
    const mapped = mapWiseTransferStatus(input.wiseStatus);
    if (TERMINAL_PAID.has(input.currentStatus) && mapped === "processing") {
        return {nextStatus: input.currentStatus as AnimaldexPayoutStatus, action: "noop"};
    }
    if (input.currentStatus === "paid" && mapped === "reversed") {
        return {nextStatus: "reversed", action: "reverse"};
    }
    if (input.currentStatus === "paid") {
        return {nextStatus: "paid", action: "noop"};
    }
    if (input.currentStatus === "failed" || input.currentStatus === "cancelled") {
        return {nextStatus: input.currentStatus as AnimaldexPayoutStatus, action: "noop"};
    }
    if (mapped === "paid") return {nextStatus: "paid", action: "paid"};
    if (mapped === "cancelled" || mapped === "failed") return {nextStatus: "failed", action: "fail"};
    if (mapped === "reversed") return {nextStatus: "reversed", action: "reverse"};
    if (mapped === "held") return {nextStatus: "held", action: "hold"};
    return {nextStatus: "processing", action: "processing"};
}
