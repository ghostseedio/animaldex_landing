import assert from "node:assert/strict";
import test from "node:test";
import {
    animalTrialAccessibilityLabel,
    animalTrialFrequencyLabel,
    animalTrialPeerSummary,
    animalTrialPeers,
    animalTrialPills,
    animalTrialStatusLabel,
    isWrittenAnimalTrialPost,
    pinnedAnimalTrialCohort
} from "./discover-animal-trial";

test("frequency labels match the phone, with the written route as Your Way", () => {
    assert.equal(animalTrialFrequencyLabel("LOW"), "LOW TRIAL");
    assert.equal(animalTrialFrequencyLabel("mid"), "MID TRIAL");
    assert.equal(animalTrialFrequencyLabel("HIGH"), "HIGH TRIAL");
    assert.equal(animalTrialFrequencyLabel("APPLICATION"), "YOUR WAY");
    assert.equal(animalTrialFrequencyLabel(null), "TRIAL");
    assert.equal(animalTrialStatusLabel({frequency: "LOW", isFailed: true}), "LOW TRIAL · FAILED");
});

test("pills show rewards earned, or why nothing was earned", () => {
    assert.deepEqual(animalTrialPills({isFailed: false, rewardXP: 10, rewardCredits: 5}), [
        {tone: "reward", text: "+10 XP"},
        {tone: "reward", text: "+5 Credits"}
    ]);
    assert.deepEqual(animalTrialPills({isFailed: false, rewardXP: 10, rewardCredits: 0}), [{tone: "reward", text: "+10 XP"}]);
    assert.deepEqual(animalTrialPills({isFailed: true, rewardXP: 0, rewardCredits: 0}), [{tone: "fail", text: "EVIDENCE NOT ACCEPTED"}]);
});

test("a written account is prose and the label names the outcome", () => {
    assert.equal(isWrittenAnimalTrialPost({proofType: "application"}), true);
    assert.equal(isWrittenAnimalTrialPost({proofType: "photo"}), false);
    assert.equal(
        animalTrialAccessibilityLabel({frequency: "MID", isFailed: true, rewardXP: 0, rewardCredits: 0, title: "Hum", speciesName: "Alpaca"}),
        "MID TRIAL. Failed. Hum. Alpaca."
    );
});

test("the cohort pins the visible post first and names the other collectors once", () => {
    const current = {id: "a", collector: {userId: "u1", name: "Lenny"}};
    const page = [
        {id: "b", collector: {userId: "u2", name: "Ash"}},
        current,
        {id: "c", collector: {userId: "u2", name: "Ash"}},
        {id: "d", collector: {userId: "u3", name: "Misty"}}
    ];
    const cohort = pinnedAnimalTrialCohort(current, page);
    assert.deepEqual(cohort.map((post) => post.id), ["a", "b", "c", "d"]);
    assert.deepEqual(animalTrialPeers(current, cohort).map((peer) => peer.name), ["Ash", "Misty"]);
    assert.equal(animalTrialPeerSummary(["Ash"]), "Also finished a Trial: Ash");
    assert.equal(animalTrialPeerSummary(["Ash", "Misty"]), "Also finished a Trial by 2 other collectors");
    assert.equal(animalTrialPeerSummary([]), null);
});
