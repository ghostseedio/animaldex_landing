/**
 * Best-of-three battle rules, ported from the iOS source of truth
 * (`DiscoverChallengeHistoryItem` and the Arena/Discover battle panels) after
 * `arena_round2_vote_closes_at_deadline`.
 *
 * Round 2 is decided by whatever the community vote says when the window
 * closes. There is no vote target any more: the window never closes early, a
 * tied tally (including 0–0) is a Round 2 draw that scores for nobody, and
 * the battle always goes on to the species comparison. A drawn round can
 * leave the battle 1–1: that is an overall draw — no winner, no payout, and
 * each player gets their own stake back in full.
 */

export const VOTE_RULE_LINE = "MOST VOTES WINS · TIE = DRAW";
export const VOTE_CLOSE_EXPLANATION = "When voting closes, the animal with the most votes wins Round 2. A tie is a draw.";
export const ROUND_TWO_DRAW_LINE = "The community vote was a draw.";
export const OVERALL_DRAW_LINE = "Draw. Nobody won, so both stakes were returned.";
export const VOTING_TIMEOUT_FALLBACK_LINE = "Voting ended before the target was reached. The Round 1 winner takes the battle.";

export type BattleLike = {
    challengeFormat: string | null;
    battleStatus: string | null;
};

export function isBestOfThreeBattle(battle: BattleLike) {
    return battle.challengeFormat === "best_of_3_v2";
}

export function isBattleVoting(battle: BattleLike) {
    return isBestOfThreeBattle(battle) && battle.battleStatus === "round_2_voting";
}

export function isBattleComplete(battle: BattleLike) {
    return !isBestOfThreeBattle(battle) || battle.battleStatus === "completed";
}

/** A drawn battle is only a thing once it has settled; mid-battle the flag means nothing. */
export function isOverallDraw(battle: BattleLike & {overallDraw: boolean}) {
    return isBestOfThreeBattle(battle) && isBattleComplete(battle) && battle.overallDraw;
}

/**
 * Battles created before votes stopped having a target still carry one; the
 * count alone is the honest progress for every battle.
 */
export function voteProgressText(votesCount: number) {
    const count = Math.max(0, Math.floor(votesCount));
    return count === 1 ? "1 vote" : `${count} votes`;
}

export function finalScoreText(battle: BattleLike & {roundsWonAttacker: number | null; roundsWonDefender: number | null}) {
    if (!isBestOfThreeBattle(battle) || !isBattleComplete(battle)) return null;
    if (battle.roundsWonAttacker == null || battle.roundsWonDefender == null) return null;
    return `${battle.roundsWonAttacker}–${battle.roundsWonDefender}`;
}

/** History row status, as the phone words it. */
export function battleHistoryStatus(battle: BattleLike & {
    overallDraw: boolean;
    votesCount: number;
    roundsWonAttacker: number | null;
    roundsWonDefender: number | null;
}) {
    if (isBattleVoting(battle)) return `Round 2 · ${voteProgressText(battle.votesCount)}`;
    const score = finalScoreText(battle);
    if (score) return isOverallDraw(battle) ? `Draw · ${score}` : `Complete · ${score}`;
    if (isBestOfThreeBattle(battle)) return "Round 3 · Comparing species…";
    return null;
}

export function roundWinnerText(input: {
    round: 2 | 3;
    round2Draw: boolean;
    winnerCaptureId: string | null;
    attackerCaptureId: string;
    attackerName: string;
    defenderName: string;
}) {
    if (input.round === 2 && input.round2Draw) return ROUND_TWO_DRAW_LINE;
    const name = input.winnerCaptureId === input.attackerCaptureId ? input.attackerName : input.defenderName;
    return input.round === 2 ? `The community backed ${name}.` : `Species comparison favored ${name}.`;
}

export type MatchupHistoryPerspective = {
    viewerWasAttacker: boolean;
    viewerWon: boolean;
    viewerDrew: boolean;
    creditsDelta: number;
};

/**
 * What one battle meant for the viewer. On a draw both stakes come back, so
 * nothing was won or lost.
 */
export function viewerPerspective(battle: BattleLike & {
    attackerUserId: string;
    defenderUserId: string;
    winnerUserId: string | null;
    overallDraw: boolean;
    stakeAmount: number;
    payoutAmount: number;
}, viewerUserId: string): MatchupHistoryPerspective | null {
    const viewerWasAttacker = battle.attackerUserId === viewerUserId;
    const viewerWasDefender = battle.defenderUserId === viewerUserId;
    if (!viewerWasAttacker && !viewerWasDefender) return null;
    if (isOverallDraw(battle)) {
        return {viewerWasAttacker, viewerWon: false, viewerDrew: true, creditsDelta: 0};
    }
    const viewerWon = battle.winnerUserId === viewerUserId;
    return {
        viewerWasAttacker,
        viewerWon,
        viewerDrew: false,
        creditsDelta: viewerWon ? battle.payoutAmount - battle.stakeAmount : -battle.stakeAmount
    };
}

export function creditCountText(count: number) {
    return count === 1 ? "1 credit" : `${count} credits`;
}
