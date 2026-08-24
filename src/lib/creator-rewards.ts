/**
 * Phase 3 Creator Rewards decode helpers for web.
 * No UI wiring. Pool math stays server-authoritative.
 */

export type CreatorRewardEnvironment = {
    environmentLabel: string;
    supabaseProjectRef: string | null;
    allowTestFixtures: boolean;
    betaAllowlistRequired: boolean;
    isProduction: boolean;
    creatorRewardsEnabled: boolean;
    autoPostEarnings: boolean;
};

export type CreatorRewardConfig = {
    enabled: boolean;
    autoPostEarnings: boolean;
    environment: CreatorRewardEnvironment | null;
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

export function mapCreatorRewardEnvironment(row: Record<string, unknown> | null | undefined): CreatorRewardEnvironment | null {
    if (!row || typeof row !== "object") return null;
    return {
        environmentLabel: String(row.environment_label ?? "unknown"),
        supabaseProjectRef:
            typeof row.supabase_project_ref === "string" ? row.supabase_project_ref : null,
        allowTestFixtures: Boolean(row.allow_test_fixtures),
        betaAllowlistRequired: Boolean(row.beta_allowlist_required),
        isProduction: Boolean(row.is_production),
        creatorRewardsEnabled: Boolean(row.creator_rewards_enabled),
        autoPostEarnings: Boolean(row.auto_post_earnings),
    };
}

export function mapCreatorRewardConfig(row: Record<string, unknown>): CreatorRewardConfig {
    const envRaw =
        row.environment && typeof row.environment === "object"
            ? (row.environment as Record<string, unknown>)
            : null;
    return {
        enabled: Boolean(row.enabled),
        autoPostEarnings: Boolean(row.auto_post_earnings),
        environment: mapCreatorRewardEnvironment(envRaw),
    };
}
