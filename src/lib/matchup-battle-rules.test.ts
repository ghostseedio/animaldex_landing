import assert from "node:assert/strict";
import test from "node:test";
import {
    OVERALL_DRAW_LINE,
    ROUND_TWO_DRAW_LINE,
    battleHistoryStatus,
    isOverallDraw,
    roundWinnerText,
    viewerPerspective,
    voteProgressText
} from "./matchup-battle-rules";

const base = {
    challengeFormat: "best_of_3_v2",
    battleStatus: "completed",
    attackerUserId: "a",
    defenderUserId: "d",
    winnerUserId: "a",
    overallDraw: false,
    stakeAmount: 3,
    payoutAmount: 5,
    votesCount: 0,
    roundsWonAttacker: 2,
    roundsWonDefender: 1
};

test("vote progress is a count: there is no target to reach", () => {
    assert.equal(voteProgressText(0), "0 votes");
    assert.equal(voteProgressText(1), "1 vote");
    assert.equal(voteProgressText(7), "7 votes");
    assert.equal(battleHistoryStatus({...base, battleStatus: "round_2_voting", votesCount: 1}), "Round 2 · 1 vote");
});

test("a tied vote is a Round 2 draw and 1–1 is an overall draw that refunds both stakes", () => {
    assert.equal(roundWinnerText({round: 2, round2Draw: true, winnerCaptureId: null, attackerCaptureId: "x", attackerName: "Lion", defenderName: "Tiger"}), ROUND_TWO_DRAW_LINE);
    assert.equal(roundWinnerText({round: 2, round2Draw: false, winnerCaptureId: "x", attackerCaptureId: "x", attackerName: "Lion", defenderName: "Tiger"}), "The community backed Lion.");
    assert.equal(roundWinnerText({round: 3, round2Draw: true, winnerCaptureId: "y", attackerCaptureId: "x", attackerName: "Lion", defenderName: "Tiger"}), "Species comparison favored Tiger.");

    const drawn = {...base, overallDraw: true, roundsWonAttacker: 1, roundsWonDefender: 1};
    assert.equal(isOverallDraw(drawn), true);
    assert.equal(battleHistoryStatus(drawn), "Draw · 1–1");
    assert.deepEqual(viewerPerspective(drawn, "a"), {viewerWasAttacker: true, viewerWon: false, viewerDrew: true, creditsDelta: 0});
    assert.deepEqual(viewerPerspective(drawn, "d"), {viewerWasAttacker: false, viewerWon: false, viewerDrew: true, creditsDelta: 0});
    assert.equal(OVERALL_DRAW_LINE, "Draw. Nobody won, so both stakes were returned.");
});

test("a draw flag on an unsettled battle means nothing yet", () => {
    assert.equal(isOverallDraw({...base, battleStatus: "round_3_species", overallDraw: true}), false);
    assert.equal(battleHistoryStatus(base), "Complete · 2–1");
    assert.deepEqual(viewerPerspective(base, "d"), {viewerWasAttacker: false, viewerWon: false, viewerDrew: false, creditsDelta: -3});
    assert.equal(viewerPerspective(base, "nobody"), null);
});
