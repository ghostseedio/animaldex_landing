/** The reason Paddle shows on a Wildlife Guide card refund, from guide_purchases.refund_reason. */
export function refundReasonText(reason: string | null | undefined) {
    switch (reason) {
        case "no_reply":
            return "The guide's author did not reply within 48 hours.";
        case "buyer_request":
            return "The buyer asked for a refund within 7 days.";
        case "payment_reversed":
            return "Duplicate purchase of the same guide.";
        case "moderation":
            return "The guide was removed by AnimalDex.";
        default:
            return "Wildlife Guide refund.";
    }
}
