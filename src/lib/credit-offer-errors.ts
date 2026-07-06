export function friendlyCreditOfferError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const normalized = message.toLowerCase();

    if (normalized.includes("credit_offer_amount_invalid")) {
        return "Credit offers must stay between 1 and 5000 credits.";
    }
    if (normalized.includes("active_credit_offer_limit_reached")) {
        return "You already have too many pending credit offers.";
    }
    if (normalized.includes("self_credit_offer_blocked")) {
        return "You cannot make a credit offer on your own animal.";
    }
    if (normalized.includes("target_capture_not_found")) {
        return "That animal is no longer available.";
    }
    if (normalized.includes("target_capture_not_offer_eligible") || normalized.includes("target_capture_owner_mismatch")) {
        return "That animal is no longer eligible for credit offers.";
    }
    if (
        normalized.includes("credit_offer_not_pending")
        || normalized.includes("credit_offer_expired")
        || normalized.includes("credit_offer_not_found")
    ) {
        return "That credit offer is no longer pending.";
    }
    if (normalized.includes("only_owner_can_resolve_credit_offer")) {
        return "Only the animal owner can accept or reject this credit offer.";
    }
    if (normalized.includes("only_bidder_can_cancel_credit_offer")) {
        return "Only the bidder can cancel this credit offer.";
    }
    if (normalized.includes("insufficient_credits")) {
        return "You do not have enough credits for that offer.";
    }
    if (normalized.includes("trade_unlock_score_required")) {
        return "Trading unlocks at 1000 overall score.";
    }

    return message || "Credit offer failed.";
}
