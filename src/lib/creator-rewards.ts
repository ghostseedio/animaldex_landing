/**
 * Phase 3 Creator Rewards decode helpers for web.
 * No UI wiring. Pool math stays server-authoritative.
 */

export type CreatorRewardConfig = {
    enabled: boolean;
    autoPostEarnings: boolean;
};

export type CreatorRewardAllocation = {
    periodId: string;
    periodSlug: string;
    periodDisplayName: string;
    currencyCode: string;
    allocationAmountMinor: number;
    status: string;
    finalizedAt: string | null;
    postedAt: string | null;
};

/** Mirrors creator_reward_gift_points_for_sender_count. Event count only — never Credit cost. */
export function creatorRewardGiftPoints(senderGiftCount: number, maxPointsPerSender: number): number {
    if (senderGiftCount <= 0 || maxPointsPerSender <= 0) return 0;
    return Math.min(maxPointsPerSender, senderGiftCount);
}

/** Mirrors creator_reward_risk_multiplier_bps. */
export function creatorRewardRiskMultiplierBps(riskState: string): number {
    switch (riskState) {
        case "clear":
        case "unreviewed":
            return 10_000;
        case "discounted":
            return 5_000;
        case "excluded":
            return 0;
        default:
            return 0;
    }
}

export function mapCreatorRewardConfig(row: Record<string, unknown>): CreatorRewardConfig {
    return {
        enabled: Boolean(row.enabled),
        autoPostEarnings: Boolean(row.auto_post_earnings),
    };
}
