import assert from "node:assert/strict";
import test from "node:test";
import {
    FUSED_COPY,
    attemptsExhausted,
    boostChips,
    boostStateText,
    decodeFusedPower,
    decodeFusedPowers,
    decodeFusedSubmitResult,
    decodePrepareStage,
    estimatedMinutesLine,
    finishButtonTitle,
    fusedProvingRewardLine,
    fusedRefusalMessage,
    fusedStage,
    fusedSteps,
    fusedTrainingForQuiz,
    fusedTrainingRewardLine,
    needsPrepare,
    pendingFusedSummary,
    pendingFusedXP,
    statDisplayName,
    toFinishLine,
    whenEarnedLine
} from "@/lib/fused-powers";

/** FUSED_SPEC's sample item, filled in. */
const SAMPLE = {
    id: "8a1c0f4e-0000-4000-8000-000000000001",
    capture_id: "c0ffee00-0000-4000-8000-000000000002",
    name: "Lookout Turn",
    expression: "Take turns watching so everyone else can work.",
    receiver_principle_name: "Steady Foraging",
    teacher_principle_name: "Vigilance",
    teacher_species_profile_id: "5eed0000-0000-4000-8000-000000000003",
    teacher_name: "Meerkat",
    created_at: "2026-10-11T10:00:00Z",
    boost: {primary_stat: "intelligence", primary: 1, secondary_stat: null, secondary: 0},
    earned: false,
    earned_via: null,
    earned_at: null,
    stage: "training",
    content_status: "ready",
    power: {
        motto: "Someone always watches.",
        lesson: "Share the watching so the group can focus.",
        expression: "Rotate who keeps watch.",
        receiver_part: "steady work",
        teacher_part: "a sentry",
        example: "Take turns checking messages during focus time."
    },
    training: {
        completed: false,
        reward_xp: 10,
        questions: [
            {index: 1, prompt: "Why rotate?", choices: ["Rest", "Speed", "Noise"]},
            {index: 0, prompt: "Who watches?", choices: ["One at a time", "Nobody", "Everyone"]}
        ]
    },
    trial: {
        title: "Set up a watch rota",
        instructions: "Agree a rota with someone for one task.",
        proof_prompt: "Photograph the rota.",
        success_criteria: ["A rota is visible", "Two names are on it"],
        estimated_minutes: 15
    },
    reward: {xp: 10, credits: 3},
    attempts: {rejections_today: 0, max_rejections_per_day: 3, last_reason: null}
};

test("decodes the spec's sample item", () => {
    const item = decodeFusedPower(SAMPLE);
    assert.ok(item);
    assert.equal(item.name, "Lookout Turn");
    assert.equal(item.teacherName, "Meerkat");
    assert.equal(item.stage, "training");
    assert.equal(item.contentStatus, "ready");
    assert.deepEqual(item.boost, {primaryStat: "intelligence", primary: 1, secondaryStat: null, secondary: 0});
    assert.equal(item.power?.receiverPart, "steady work");
    assert.equal(item.power?.teacherPart, "a sentry");
    // Questions come back in index order.
    assert.deepEqual(item.training?.questions.map((question) => question.prompt), ["Who watches?", "Why rotate?"]);
    assert.equal(item.trial?.proofPrompt, "Photograph the rota.");
    assert.deepEqual(item.trial?.successCriteria, ["A rota is visible", "Two names are on it"]);
    assert.equal(item.trial?.estimatedMinutes, 15);
    assert.deepEqual(item.reward, {xp: 10, credits: 3});
    assert.deepEqual(item.attempts, {rejectionsToday: 0, maxRejectionsPerDay: 3, lastReason: null});
});

test("a preparing item carries no content; the list decodes from text and drops nameless rows", () => {
    const preparing = {...SAMPLE, stage: "preparing", content_status: "generating", power: null, training: null, trial: null};
    const list = decodeFusedPowers(JSON.stringify([preparing, {id: "x"}, SAMPLE]));
    assert.equal(list.length, 2);
    assert.equal(list[0].stage, "preparing");
    assert.equal(list[0].power, null);
    assert.equal(list[0].training, null);
    assert.equal(list[0].trial, null);
    assert.equal(fusedTrainingForQuiz(list[0]), null);
    assert.deepEqual(decodeFusedPowers(null), []);
    assert.deepEqual(decodeFusedPowers({}), []);
});

test("stage mapping: the server's stage wins, and a missing one follows the RPC rule", () => {
    assert.equal(fusedStage({stage: "proving", earned: false, contentStatus: "ready", trainingCompleted: true}), "proving");
    assert.equal(fusedStage({stage: "training", earned: true, contentStatus: "ready", trainingCompleted: false}), "earned");
    assert.equal(fusedStage({stage: undefined, earned: false, contentStatus: "failed", trainingCompleted: false}), "preparing");
    assert.equal(fusedStage({stage: "bogus", earned: false, contentStatus: "ready", trainingCompleted: false}), "training");
    assert.equal(fusedStage({stage: null, earned: false, contentStatus: "ready", trainingCompleted: true}), "proving");
    // Legacy rows are earned and look the same.
    assert.equal(decodeFusedPower({...SAMPLE, stage: "earned", earned: true, earned_via: "legacy"})?.stage, "earned");
});

test("the mini stepper: Training → Trial → Earned", () => {
    const states = (stage: Parameters<typeof fusedSteps>[0]) => fusedSteps(stage).map((step) => step.state);
    assert.deepEqual(fusedSteps("training").map((step) => step.label), ["Training", "Trial", "Earned"]);
    assert.deepEqual(states("preparing"), ["current", "upcoming", "upcoming"]);
    assert.deepEqual(states("training"), ["current", "upcoming", "upcoming"]);
    assert.deepEqual(states("proving"), ["done", "current", "upcoming"]);
    assert.deepEqual(states("earned"), ["done", "done", "done"]);
});

test("boost chips, state text and reward lines", () => {
    assert.deepEqual(boostChips({primaryStat: "intelligence", primary: 1, secondaryStat: null, secondary: 0}), ["+1 Intelligence"]);
    assert.deepEqual(
        boostChips({primaryStat: "pack_coordination", primary: 2, secondaryStat: "speed", secondary: 1}),
        ["+2 Pack Coordination", "+1 Speed"]
    );
    assert.deepEqual(boostChips({primaryStat: "speed", primary: 0, secondaryStat: null, secondary: 0}), []);
    assert.equal(statDisplayName("social_intelligence"), "Social Intelligence");
    assert.equal(boostStateText(true), "Boost on");
    assert.equal(boostStateText(false), "Boost locked");
    const item = decodeFusedPower(SAMPLE)!;
    assert.equal(fusedTrainingRewardLine(item), "+10 XP");
    assert.equal(fusedProvingRewardLine(item), "+10 XP · +3 Credits · Boost on");
    assert.equal(fusedProvingRewardLine({...item, reward: {xp: 10, credits: 1}}), "+10 XP · +1 Credit · Boost on");
    assert.equal(estimatedMinutesLine(15), "~15 min");
    assert.equal(estimatedMinutesLine(null), null);
    assert.equal(whenEarnedLine(1, "Intelligence"), "+1 Intelligence when earned");
    assert.equal(toFinishLine(1), "1 to finish");
    assert.equal(toFinishLine(3), "3 to finish");
    assert.equal(finishButtonTitle("Lookout Turn"), "Finish Lookout Turn");
    assert.equal(finishButtonTitle("A Very Long Fused Power Name"), "Continue");
});

test("prepare only when nobody is writing; poll otherwise", () => {
    const item = decodeFusedPower(SAMPLE)!;
    assert.equal(needsPrepare({...item, stage: "preparing", contentStatus: "missing"}), true);
    assert.equal(needsPrepare({...item, stage: "preparing", contentStatus: "failed"}), true);
    assert.equal(needsPrepare({...item, stage: "preparing", contentStatus: "generating"}), false);
    assert.equal(needsPrepare(item), false);
    assert.equal(decodePrepareStage({stage: "ready"}), "ready");
    assert.equal(decodePrepareStage({stage: "unavailable"}), "unavailable");
    assert.equal(decodePrepareStage({error: "x"}), "preparing");
});

test("attempts: three rejections today lock submit", () => {
    const item = decodeFusedPower(SAMPLE)!;
    assert.equal(attemptsExhausted(item), false);
    assert.equal(attemptsExhausted({...item, attempts: {...item.attempts, rejectionsToday: 3}}), true);
});

test("pending summary for the Power Loop: count, first's name, stage and pay", () => {
    const training = decodeFusedPower(SAMPLE)!;
    const proving = decodeFusedPower({...SAMPLE, id: "p", name: "Second", stage: "proving", training: {...SAMPLE.training, completed: true}})!;
    const earned = decodeFusedPower({...SAMPLE, id: "e", stage: "earned", earned: true})!;
    assert.equal(pendingFusedXP(training), 20);
    assert.equal(pendingFusedXP(proving), 10);
    assert.equal(pendingFusedXP(earned), 0);
    assert.deepEqual(pendingFusedSummary([earned, proving, training]), {
        pending: 2,
        firstId: "p",
        firstName: "Second",
        firstStage: "proving",
        firstXP: 10,
        firstCredits: 3
    });
    assert.deepEqual(pendingFusedSummary([earned]), {
        pending: 0, firstId: null, firstName: null, firstStage: null, firstXP: 0, firstCredits: 0
    });
});

test("the quiz adapter feeds the shared Training quiz", () => {
    const quiz = fusedTrainingForQuiz(decodeFusedPower(SAMPLE)!);
    assert.ok(quiz);
    assert.equal(quiz.available, true);
    assert.equal(quiz.unlocked, true);
    assert.equal(quiz.completed, false);
    assert.equal(quiz.rewardXP, 10);
    assert.equal(quiz.questions.length, 2);
});

test("submit results and refusals", () => {
    assert.deepEqual(
        decodeFusedSubmitResult({ok: true, verdict: "approved", reason: "Nice rota.", earned: true, reward_xp: 10, reward_credits: 3, rejections_remaining: 3}),
        {verdict: "approved", reason: "Nice rota.", earned: true, rewardXP: 10, rewardCredits: 3, rejectionsRemaining: 3}
    );
    assert.equal(decodeFusedSubmitResult({error: "training_required"}), null);
    assert.equal(fusedRefusalMessage("training_required"), "Complete this Power's Training first.");
    assert.equal(fusedRefusalMessage("attempts_exhausted_today"), FUSED_COPY.attemptsExhausted);
    assert.equal(fusedRefusalMessage("fused_power_not_ready"), "This Power isn't ready yet. Try again in a minute.");
    assert.equal(fusedRefusalMessage("already_earned"), "You have already earned this Power.");
    assert.equal(fusedRefusalMessage("grading_unavailable"), "We could not check that right now. Nothing was used up — try again in a moment.");
    assert.equal(fusedRefusalMessage("account_too_short"), "Tell us a bit more about what you actually did.");
});
