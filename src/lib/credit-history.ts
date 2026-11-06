/**
 * Credit history (iOS `CreditTransactionItem.humanLabel` and
 * `signedDeltaText`): each `credit_transactions` row as the line iOS shows,
 * in iOS's English. Pure; the read is `data/credit-history.ts`.
 */

export type CreditTransaction = {
    id: string;
    delta: number;
    reason: string;
    createdAt: string;
    metadata: {
        product_code?: string | null;
        action?: string | null;
        mission_title?: string | null;
        stat?: string | null;
    } | null;
};

const PRO_CODES = new Set(["pro_upgrade", "pro_upgrade_annual", "pro_annual"]);

function capitalizeWords(text: string) {
    return text.split(" ").map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)).join(" ");
}

export function decodeCreditTransactions(raw: unknown): CreditTransaction[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const record = row as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id : null;
        const delta = Number(record.delta);
        const createdAt = typeof record.created_at === "string" ? record.created_at : null;
        if (!id || !Number.isFinite(delta) || !createdAt) return [];
        const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata as CreditTransaction["metadata"] : null;
        return [{id, delta, reason: typeof record.reason === "string" ? record.reason : "", createdAt, metadata}];
    });
}

export function creditTransactionLabel(item: CreditTransaction): string {
    const {delta, metadata} = item;
    const action = metadata?.action ?? null;
    switch (metadata?.product_code) {
        case "purchase_25": return "Purchased 25 credits";
        case "purchase_100": return "Purchased 100 credits";
        default: if (PRO_CODES.has(metadata?.product_code ?? "")) return "AnimalDex Pro";
    }
    // Debates (3.2): a public debate won, and a heart healed.
    if (action === "debate_win") return "Debates";
    if (action === "heart_heal") return delta < 0 ? "Heal a heart: 5 Credits" : "Credits added";
    switch (item.reason.toLowerCase()) {
        case "analysis":
            if (action === "reanalysis") return delta < 0 ? "Re-analysis" : "Re-analysis credit returned";
            if (action === "premium_unlock") return delta < 0 ? "Unlocked deeper analysis" : "Premium analysis credit returned";
            return delta < 0 ? "Scan" : "Scan credit returned";
        case "purchase":
            return "Purchase added";
        case "grant":
            if (action === "signup_starter") return "Starter credits";
            if (action === "mission_reward") return metadata?.mission_title || "Mission reward";
            if (action === "referral_reward_inviter") return "Referral reward";
            if (action === "referral_reward_invitee") return "Referral welcome reward";
            if (action === "challenge_stake_payout") return "Battle payout";
            if (action === "wild_unique_species_credit") return "First wild capture";
            return "Bonus granted";
        case "refund":
            return "Refund";
        case "adjustment":
            if (action === "stat_boost") {
                const stat = metadata?.stat?.replace(/_/g, " ");
                if (stat) return delta < 0 ? `Trained ${capitalizeWords(stat)}` : "Stat boost credit returned";
                return delta < 0 ? "Trained animal stat" : "Stat boost credit returned";
            }
            if (action === "health_restore") return delta < 0 ? "Restored battle health" : "Battle health credit returned";
            // Old Applied Insight refreshes and paid chat messages are both the animal chat now.
            if (action === "applied_insight_refresh" || action === "animal_chat_message") return delta < 0 ? "Animal chat" : "Animal chat credit returned";
            if (action === "challenge_stake_escrow_debit") return delta < 0 ? "Battle stake escrow" : "Battle stake returned";
            if (action === "capture_gift") return delta < 0 ? "Sent a Gift" : "Gift credit returned";
            return "Adjustment";
        default:
            return delta < 0 ? "Credits used" : "Credits added";
    }
}

/** "+25", "-2", or "PRO" for a Pro purchase. */
export function creditTransactionDelta(item: CreditTransaction): string {
    if (PRO_CODES.has(item.metadata?.product_code ?? "")) return "PRO";
    return `${item.delta >= 0 ? "+" : ""}${item.delta}`;
}
