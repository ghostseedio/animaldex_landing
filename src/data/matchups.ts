import "server-only";

import type {DiscoverCaptureItem} from "@/data/discover-timeline";
import {getChallengeArenaCaptureById, getChallengeArenaCaptures} from "@/data/discover-timeline";
import type {
    MatchupHistoryItem,
    MatchupOpponent,
    MatchupResolveResult,
    MatchupRosterCapture
} from "@/data/matchups-types";
import {getSpeciesImageRoute} from "@/data/species-images";
import {
    getBattlePower,
    getBattleTier,
    toEffectiveStats
} from "@/lib/matchup-stats";
import {resolveCaptureDisplayName} from "@/lib/capture-display-name";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type QueryRow = Record<string, unknown>;

const HISTORY_SELECT = [
    "id", "created_at", "attacker_user_id", "defender_user_id", "attacker_capture_id", "defender_capture_id",
    "winner_user_id", "winner_capture_id", "chosen_stat", "attacker_stat_value", "defender_stat_value",
    "resolution_rule", "points_awarded", "rewarded", "stake_amount", "escrow_amount", "payout_amount", "burn_amount",
    "scenario_key", "scenario_family", "scenario_title", "scenario_domain", "scenario_description",
    "deciding_edge_label", "attacker_context_score", "defender_context_score",
    "winner_explanation", "strategic_insight", "scenario_version",
    "challenge_format", "battle_status", "required_votes", "votes_count",
    "round1_winner_capture_id", "round2_winner_capture_id", "round3_winner_capture_id",
    "overall_winner_capture_id", "rounds_won_attacker", "rounds_won_defender",
    "round3_species_comparison_slug", "viewer_voted_capture_id", "voting_deadline_at", "settlement_reason",
    "attacker_animal_name", "defender_animal_name"
].join(",");

const ROSTER_SELECT = [
    "capture_id", "animal_name", "normalized_identity_key", "breed_guess", "capture_title", "scientific_name",
    "game_stats", "challenge_health", "is_challenge_ready",
    "challenge_stake", "is_discoverable", "dominance_boost", "speed_boost", "intelligence_boost",
    "comparison_dominance_boost", "comparison_speed_boost", "comparison_size_boost",
    "comparison_intelligence_boost", "comparison_rarity_boost",
    "dominance_endorsements", "speed_endorsements", "size_endorsements", "intelligence_endorsements", "rarity_endorsements",
    "total_progression_xp", "completed_at", "error_message"
].join(",");

function readString(row: QueryRow, key: string) {
    const value = row[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(row: QueryRow, key: string, fallback = 0) {
    const value = Number(row[key] ?? fallback);
    return Number.isFinite(value) ? value : fallback;
}

function animalLevel(totalProgressionXP: number) {
    return Math.min(100, Math.floor(Math.sqrt(Math.max(0, totalProgressionXP))) + 1);
}

function captureImageSrc(captureId: string, speciesSlug: string | null) {
    if (speciesSlug) {
        return getSpeciesImageRoute(speciesSlug, captureId);
    }
    return getCaptureImageRoute(captureId);
}

function rosterStatsFromRow(row: QueryRow) {
    const stored = row.game_stats && typeof row.game_stats === "object" ? row.game_stats as QueryRow : {};
    return toEffectiveStats(stored as Record<string, number>, {
        dominance: readNumber(row, "dominance_boost") + readNumber(row, "comparison_dominance_boost") + readNumber(row, "dominance_endorsements"),
        speed: readNumber(row, "speed_boost") + readNumber(row, "comparison_speed_boost") + readNumber(row, "speed_endorsements"),
        size: readNumber(row, "comparison_size_boost") + readNumber(row, "size_endorsements"),
        intelligence: readNumber(row, "intelligence_boost") + readNumber(row, "comparison_intelligence_boost") + readNumber(row, "intelligence_endorsements"),
        rarity: readNumber(row, "comparison_rarity_boost") + readNumber(row, "rarity_endorsements")
    });
}

function toOpponent(item: DiscoverCaptureItem): MatchupOpponent {
    const stats = toEffectiveStats(item.effectiveGameStats);
    const battlePower = getBattlePower(stats);
    const stake = Math.max(2, item.challengeStake || 2);
    const animalName = resolveCaptureDisplayName({
        animalName: item.animalName,
        breedGuess: item.breedGuess,
        captureTitle: item.title,
        speciesSlug: item.speciesSlug,
        scientificName: item.scientificName
    });

    return {
        captureId: item.captureId,
        animalName,
        speciesSlug: item.speciesSlug,
        ownerUserId: item.collector.userId,
        ownerName: item.collector.name,
        ownerUsername: item.collector.username,
        imageSrc: item.imageSrc,
        level: item.level,
        battleTier: getBattleTier(battlePower),
        battlePower,
        challengeStake: stake,
        challengeHealth: item.challengeHealth,
        isChallengeReady: item.isChallengeReady,
        isChallengeAvailable: item.isChallengeAvailable,
        principle: item.learnedPrinciple,
        powerTag: item.bestForTags[0] ?? null,
        gameStats: stats,
        estimatedPayout: Math.max(0, stake * 2 - 1)
    };
}

function toRosterCapture(row: QueryRow): MatchupRosterCapture | null {
    const captureId = readString(row, "capture_id");
    if (!captureId || !row.game_stats || row.completed_at == null || readString(row, "error_message")) {
        return null;
    }

    const stats = rosterStatsFromRow(row);
    const battlePower = getBattlePower(stats);
    const speciesSlug = readString(row, "normalized_identity_key")?.replace(/_/g, "-") ?? null;
    const animalName = resolveCaptureDisplayName({
        animalName: readString(row, "animal_name"),
        breedGuess: readString(row, "breed_guess"),
        captureTitle: readString(row, "capture_title"),
        normalizedIdentityKey: readString(row, "normalized_identity_key"),
        speciesSlug,
        scientificName: readString(row, "scientific_name")
    });

    return {
        captureId,
        animalName,
        speciesSlug,
        imageSrc: captureImageSrc(captureId, speciesSlug),
        battleTier: getBattleTier(battlePower),
        battlePower,
        challengeHealth: Math.min(3, Math.max(0, readNumber(row, "challenge_health", 3))),
        challengeStake: Math.min(100, Math.max(2, readNumber(row, "challenge_stake", 2))),
        isChallengeReady: row.is_challenge_ready === true,
        isDiscoverable: row.is_discoverable === true,
        gameStats: stats,
        level: animalLevel(readNumber(row, "total_progression_xp"))
    };
}

function mapHistoryRow(row: QueryRow, viewerUserId: string): MatchupHistoryItem {
    const attackerCaptureId = readString(row, "attacker_capture_id") ?? "";
    const defenderCaptureId = readString(row, "defender_capture_id") ?? "";
    const winnerCaptureId = readString(row, "winner_capture_id") ?? "";
    const attackerUserId = readString(row, "attacker_user_id") ?? "";
    const defenderUserId = readString(row, "defender_user_id") ?? "";
    const winnerUserId = readString(row, "winner_user_id") ?? "";
    const viewerWasAttacker = attackerUserId === viewerUserId;
    const viewerWon = winnerUserId === viewerUserId;
    const stakeAmount = readNumber(row, "stake_amount");
    const payoutAmount = readNumber(row, "payout_amount");

    return {
        id: readString(row, "id") ?? "",
        date: readString(row, "created_at") ?? new Date(0).toISOString(),
        scenarioTitle: readString(row, "scenario_title"),
        scenarioDomain: readString(row, "scenario_domain"),
        scenarioFamily: readString(row, "scenario_family"),
        scenarioDescription: readString(row, "scenario_description"),
        chosenStat: readString(row, "chosen_stat"),
        decidingEdgeLabel: readString(row, "deciding_edge_label"),
        winnerExplanation: readString(row, "winner_explanation"),
        strategicInsight: readString(row, "strategic_insight"),
        resolutionRule: readString(row, "resolution_rule"),
        pointsAwarded: readNumber(row, "points_awarded"),
        rewarded: row.rewarded === true,
        attackerCaptureId,
        defenderCaptureId,
        attackerAnimalName: readString(row, "attacker_animal_name") ?? "Animal",
        defenderAnimalName: readString(row, "defender_animal_name") ?? "Animal",
        attackerImageSrc: captureImageSrc(attackerCaptureId, null),
        defenderImageSrc: captureImageSrc(defenderCaptureId, null),
        attackerUserId,
        defenderUserId,
        winnerCaptureId,
        winnerUserId,
        stakeAmount,
        escrowAmount: readNumber(row, "escrow_amount"),
        payoutAmount,
        burnAmount: readNumber(row, "burn_amount"),
        attackerStatValue: readNumber(row, "attacker_stat_value", NaN) || null,
        defenderStatValue: readNumber(row, "defender_stat_value", NaN) || null,
        attackerContextScore: readNumber(row, "attacker_context_score", NaN) || null,
        defenderContextScore: readNumber(row, "defender_context_score", NaN) || null,
        viewerWasAttacker,
        viewerWon,
        creditsDelta: viewerWon ? payoutAmount - stakeAmount : -stakeAmount,
        challengeFormat: readString(row, "challenge_format"),
        battleStatus: readString(row, "battle_status"),
        requiredVotes: readNumber(row, "required_votes", NaN) || null,
        votesCount: readNumber(row, "votes_count"),
        round1WinnerCaptureId: readString(row, "round1_winner_capture_id"),
        round2WinnerCaptureId: readString(row, "round2_winner_capture_id"),
        round3WinnerCaptureId: readString(row, "round3_winner_capture_id"),
        overallWinnerCaptureId: readString(row, "overall_winner_capture_id"),
        roundsWonAttacker: readNumber(row, "rounds_won_attacker", NaN) || null,
        roundsWonDefender: readNumber(row, "rounds_won_defender", NaN) || null,
        speciesComparisonSlug: readString(row, "round3_species_comparison_slug"),
        viewerVotedCaptureId: readString(row, "viewer_voted_capture_id"),
        votingDeadlineAt: readString(row, "voting_deadline_at"),
        settlementReason: readString(row, "settlement_reason")
    };
}

export function mapResolveRow(row: QueryRow): MatchupResolveResult {
    const attackerContextScore = readNumber(row, "attacker_context_score", NaN);
    const defenderContextScore = readNumber(row, "defender_context_score", NaN);
    const scenarioVersion = readNumber(row, "scenario_version", NaN);

    return {
        id: readString(row, "id") ?? "",
        attackerCaptureId: readString(row, "attacker_capture_id") ?? "",
        defenderCaptureId: readString(row, "defender_capture_id") ?? "",
        winnerCaptureId: readString(row, "winner_capture_id") ?? "",
        winnerUserId: readString(row, "winner_user_id") ?? "",
        chosenStat: readString(row, "chosen_stat") ?? "dominance",
        attackerStatValue: readNumber(row, "attacker_stat_value"),
        defenderStatValue: readNumber(row, "defender_stat_value"),
        resolutionRule: readString(row, "resolution_rule"),
        pointsAwarded: readNumber(row, "points_awarded"),
        rewarded: row.rewarded === true,
        stakeAmount: readNumber(row, "stake_amount"),
        escrowAmount: readNumber(row, "escrow_amount"),
        payoutAmount: readNumber(row, "payout_amount"),
        burnAmount: readNumber(row, "burn_amount"),
        scenarioKey: readString(row, "scenario_key"),
        scenarioFamily: readString(row, "scenario_family"),
        scenarioTitle: readString(row, "scenario_title") ?? "Scenario Arena",
        scenarioDomain: readString(row, "scenario_domain"),
        scenarioDescription: readString(row, "scenario_description"),
        decidingEdgeLabel: readString(row, "deciding_edge_label"),
        winnerExplanation: readString(row, "winner_explanation"),
        strategicInsight: readString(row, "strategic_insight"),
        attackerContextScore: Number.isFinite(attackerContextScore) ? attackerContextScore : null,
        defenderContextScore: Number.isFinite(defenderContextScore) ? defenderContextScore : null,
        scenarioVersion: Number.isFinite(scenarioVersion) ? scenarioVersion : null,
        attackerBattlePower: readNumber(row, "attacker_battle_power"),
        defenderBattlePower: readNumber(row, "defender_battle_power"),
        attackerTier: readString(row, "attacker_tier") ?? "C",
        defenderTier: readString(row, "defender_tier") ?? "C",
        createdAt: readString(row, "created_at") ?? new Date().toISOString(),
        challengeFormat: readString(row, "challenge_format"),
        battleStatus: readString(row, "battle_status"),
        requiredVotes: readNumber(row, "required_votes", NaN) || null,
        votesCount: readNumber(row, "votes_count"),
        round1WinnerCaptureId: readString(row, "round1_winner_capture_id"),
        round2WinnerCaptureId: readString(row, "round2_winner_capture_id"),
        round3WinnerCaptureId: readString(row, "round3_winner_capture_id"),
        overallWinnerCaptureId: readString(row, "overall_winner_capture_id"),
        roundsWonAttacker: readNumber(row, "rounds_won_attacker", NaN) || null,
        roundsWonDefender: readNumber(row, "rounds_won_defender", NaN) || null,
        speciesComparisonSlug: readString(row, "round3_species_comparison_slug"),
        viewerVotedCaptureId: readString(row, "viewer_voted_capture_id"),
        votingDeadlineAt: readString(row, "voting_deadline_at"),
        settlementReason: readString(row, "settlement_reason")
    };
}

export async function getMatchupArena(userId: string, limit = 48) {
    const captures = await getChallengeArenaCaptures(userId, limit);
    return captures.map(toOpponent);
}

export async function getMatchupArenaTarget(userId: string, captureId: string) {
    const capture = await getChallengeArenaCaptureById(captureId, userId);
    return capture ? toOpponent(capture) : null;
}

export async function getMatchupRoster(userId: string, limit = 160) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [] as MatchupRosterCapture[];

    const {data} = await supabase
        .from("owned_capture_manifest_v1")
        .select(ROSTER_SELECT)
        .eq("user_id", userId)
        .eq("is_discoverable", true)
        .not("game_stats", "is", null)
        .order("capture_created_at", {ascending: false})
        .limit(limit);

    return ((data ?? []) as unknown as QueryRow[])
        .map(toRosterCapture)
        .filter((item): item is MatchupRosterCapture => Boolean(item));
}

export async function getMatchupHistory(userId: string, limit = 40) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [] as MatchupHistoryItem[];

    const {data} = await supabase
        .from("discover_challenge_history_v2")
        .select(HISTORY_SELECT)
        .or(`attacker_user_id.eq.${userId},defender_user_id.eq.${userId}`)
        .order("created_at", {ascending: false})
        .limit(limit);

    const items = ((data ?? []) as unknown as QueryRow[]).map((row) => mapHistoryRow(row, userId));
    return enrichHistoryDisplayNames(items);
}

async function enrichHistoryDisplayNames(items: MatchupHistoryItem[]) {
    if (!items.length) return items;

    const supabase = createSupabaseServerClient();
    if (!supabase) return items;

    const captureIds = Array.from(new Set(items.flatMap((item) => [item.attackerCaptureId, item.defenderCaptureId]).filter(Boolean)));
    if (!captureIds.length) return items;

    const namesByCaptureId = new Map<string, string>();

    async function ingestRows(rows: QueryRow[] | null | undefined) {
        for (const row of rows ?? []) {
            const captureId = readString(row, "capture_id");
            if (!captureId || namesByCaptureId.has(captureId)) continue;
            namesByCaptureId.set(captureId, resolveCaptureDisplayName({
                animalName: readString(row, "animal_name"),
                breedGuess: readString(row, "breed_guess"),
                captureTitle: readString(row, "capture_title"),
                normalizedIdentityKey: readString(row, "normalized_identity_key"),
                scientificName: readString(row, "scientific_name")
            }));
        }
    }

    const [challengeRows, feedRows] = await Promise.all([
        supabase
            .from("challenge_feed_v1")
            .select("capture_id,animal_name,breed_guess,capture_title,normalized_identity_key,scientific_name")
            .in("capture_id", captureIds),
        supabase
            .from("discover_feed_v1")
            .select("capture_id,animal_name,breed_guess,capture_title,normalized_identity_key,scientific_name")
            .in("capture_id", captureIds)
    ]);

    await ingestRows((challengeRows.data ?? []) as unknown as QueryRow[]);
    await ingestRows((feedRows.data ?? []) as unknown as QueryRow[]);

    return items.map((item) => ({
        ...item,
        attackerAnimalName: namesByCaptureId.get(item.attackerCaptureId) ?? item.attackerAnimalName,
        defenderAnimalName: namesByCaptureId.get(item.defenderCaptureId) ?? item.defenderAnimalName
    }));
}

export async function getMatchupHubBundle(userId: string) {
    const [arena, roster, history] = await Promise.all([
        getMatchupArena(userId),
        getMatchupRoster(userId),
        getMatchupHistory(userId)
    ]);

    return {arena, roster, history};
}
