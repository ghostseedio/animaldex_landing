export type MatchupGameStats = Record<"dominance" | "speed" | "size" | "intelligence" | "rarity", number>;

export type AnimalBattleTier = "E" | "D" | "C" | "B" | "A" | "S";

const TIER_RANK: Record<AnimalBattleTier, number> = {E: 0, D: 1, C: 2, B: 3, A: 4, S: 5};

export function clampStat(value: number) {
    return Math.min(100, Math.max(0, Math.round(value)));
}

export function toEffectiveStats(
    gameStats: Record<string, number> | null | undefined,
    boosts: Partial<Record<string, number>> = {}
) {
    const base = gameStats && typeof gameStats === "object" ? gameStats : {};
    return {
        dominance: clampStat(Number(base.dominance ?? 0) + Number(boosts.dominance ?? 0)),
        speed: clampStat(Number(base.speed ?? 0) + Number(boosts.speed ?? 0)),
        size: clampStat(Number(base.size ?? 0) + Number(boosts.size ?? 0)),
        intelligence: clampStat(Number(base.intelligence ?? 0) + Number(boosts.intelligence ?? 0)),
        rarity: clampStat(Number(base.rarity ?? 0) + Number(boosts.rarity ?? 0))
    } satisfies MatchupGameStats;
}

export function getBattlePower(stats: MatchupGameStats) {
    return Math.round(
        stats.dominance * 0.22
        + stats.speed * 0.14
        + stats.size * 0.10
        + stats.intelligence * 0.14
        + stats.rarity * 0.40
    );
}

export function getBattleTier(power: number): AnimalBattleTier {
    if (power < 25) return "E";
    if (power < 40) return "D";
    if (power < 52) return "C";
    if (power < 62) return "B";
    if (power < 80) return "A";
    return "S";
}

export function tierRank(tier: AnimalBattleTier) {
    return TIER_RANK[tier];
}

export function allowsMatchup(attackerTier: AnimalBattleTier, defenderTier: AnimalBattleTier) {
    return Math.abs(tierRank(attackerTier) - tierRank(defenderTier)) <= 1;
}

export function formatStatLabel(key: string) {
    return key.charAt(0).toUpperCase() + key.slice(1);
}

export function friendlyChallengeError(message: string) {
    const raw = message.toLowerCase();
    if (raw.includes("pair_cooldown") || raw.includes("already ran this matchup")) {
        return "You already ran this matchup recently.";
    }
    if (raw.includes("attacker_health_depleted")) {
        return "That animal is out of hearts. Restore it before comparing again.";
    }
    if (raw.includes("defender_health_depleted")) {
        return "That opponent is out of hearts and cannot be challenged right now.";
    }
    if (raw.includes("attacker_insufficient_credits")) {
        return "You do not have enough credits to match this stake.";
    }
    if (raw.includes("defender_insufficient_credits") || raw.includes("defender_stake_unavailable")) {
        return "That capture is no longer available at a valid stake.";
    }
    if (raw.includes("analysis_game_stats_unavailable")) {
        return "One of these animals needs refreshed comparison stats before this matchup can run.";
    }
    if (raw.includes("scenario_unavailable")) {
        return "No eligible scenario was available for this matchup right now.";
    }
    return message;
}
