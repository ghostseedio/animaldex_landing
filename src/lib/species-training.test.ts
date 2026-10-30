import assert from "node:assert/strict";
import test from "node:test";
import {
    TRAINING_COPY,
    chooseTrainingAnswer,
    decodeSpeciesTraining,
    decodeSpeciesTrainingResult,
    isTrainingQuizReady,
    notingTrainingResult,
    previousTrainingQuestion,
    startTrainingQuiz,
    trainingCanStart,
    trainingFailSummary,
    trainingQuestionProgress,
    trainingRefusalMessage,
    trainingRewardLine,
    trainingSubmission
} from "@/lib/species-training";
import {powerRefusalMessage} from "@/lib/animal-powers";
import {fusedRefusalMessage} from "@/lib/fused-powers";

const SPECIES = "742b057b-47c4-447a-a61c-53d0b28c5e00";

const AVAILABLE = {
    species_profile_id: SPECIES,
    available: true,
    completed: false,
    unlocked: true,
    reward_xp: 10,
    reward_credits: 1,
    content_version: 1,
    questions: [
        {index: 0, prompt: "Where does a Red Fox find the most food?", choices: ["Deep in the middle of the forest", "Where the woods meet the fields", "High up in the trees"]},
        {index: 1, prompt: "Second?", choices: ["A", "B", "C"]}
    ]
};

test("get_species_training decodes an available Training", () => {
    const training = decodeSpeciesTraining(AVAILABLE);
    assert.ok(training);
    assert.equal(training.speciesProfileId, SPECIES);
    assert.equal(training.available, true);
    assert.equal(training.completed, false);
    assert.equal(training.unlocked, true);
    assert.equal(training.rewardXP, 10);
    assert.equal(training.rewardCredits, 1);
    assert.equal(training.contentVersion, 1);
    assert.equal(training.questions.length, 2);
    assert.deepEqual(training.questions[0].choices, AVAILABLE.questions[0].choices);
    assert.equal(trainingCanStart(training), true);
});

test("get_species_training decodes from a JSON string too", () => {
    assert.equal(decodeSpeciesTraining(JSON.stringify(AVAILABLE))?.questions.length, 2);
});

test("an animal with no quiz offers no Warmup", () => {
    const training = decodeSpeciesTraining({
        species_profile_id: SPECIES, available: false, completed: false, unlocked: true,
        reward_xp: 10, reward_credits: 1, content_version: null, questions: []
    });
    assert.ok(training);
    assert.equal(training.available, false);
    assert.equal(training.contentVersion, null);
    assert.equal(trainingCanStart(training), false);
});

test("no read, or a broken one, offers nothing", () => {
    assert.equal(trainingCanStart(null), false);
    assert.equal(decodeSpeciesTraining(null), null);
    assert.equal(decodeSpeciesTraining("not json"), null);
    // Claims available with nothing answerable: no quiz nobody can take.
    const broken = decodeSpeciesTraining({...AVAILABLE, questions: [{index: 0, prompt: "", choices: []}]});
    assert.equal(broken?.available, false);
    assert.equal(trainingCanStart(broken), false);
});

test("a passed Warmup is done, and passing is once", () => {
    const training = decodeSpeciesTraining({...AVAILABLE, completed: true});
    assert.equal(training?.completed, true);
    assert.equal(trainingCanStart(training), false);
});

test("questions are ordered by index", () => {
    const training = decodeSpeciesTraining({...AVAILABLE, questions: [...AVAILABLE.questions].reverse()});
    assert.deepEqual(training?.questions.map((question) => question.index), [0, 1]);
});

test("submit_species_training decodes a fail without any right answer", () => {
    const result = decodeSpeciesTrainingResult({passed: false, correct: [true, false]});
    assert.ok(result);
    assert.equal(result.passed, false);
    assert.deepEqual(result.correct, [true, false]);
    assert.deepEqual(result.explanations, []);
    assert.equal(trainingFailSummary(result.correct), "1 of 2 right. Every answer has to be right.");
    // 3.2: a miss costs nothing and locks nothing; it can be retaken at once.
    const training = decodeSpeciesTraining(AVAILABLE)!;
    assert.equal(trainingCanStart(notingTrainingResult(training, result)), true);
});

test("submit_species_training decodes a pass, once", () => {
    const result = decodeSpeciesTrainingResult({
        passed: true, already_completed: false, correct: [true, true],
        explanations: ["Edges have the most food.", "Because."], reward_xp: 5, reward_credits: 0
    });
    assert.ok(result);
    assert.equal(result.passed, true);
    assert.equal(result.alreadyCompleted, false);
    assert.deepEqual(result.explanations, ["Edges have the most food.", "Because."]);
    // The Warmup pays +5 XP and no Credits (3.2).
    assert.equal(trainingRewardLine(result.rewardXP, result.rewardCredits), "+5 XP");
    const training = decodeSpeciesTraining(AVAILABLE)!;
    assert.equal(notingTrainingResult(training, result).completed, true);
    assert.equal(trainingCanStart(notingTrainingResult(training, result)), false);
});

test("a pass with no card to put XP on hides the XP part", () => {
    const result = decodeSpeciesTrainingResult({passed: true, already_completed: false, correct: [true], explanations: ["x"], reward_xp: 0, reward_credits: 1});
    assert.equal(trainingRewardLine(result!.rewardXP, result!.rewardCredits), "+1 Credit");
});

test("already completed decodes as a pass with no reward", () => {
    const result = decodeSpeciesTrainingResult({passed: true, already_completed: true, reward_xp: 0, reward_credits: 0});
    assert.equal(result?.passed, true);
    assert.equal(result?.alreadyCompleted, true);
    assert.deepEqual(result?.correct, []);
    assert.equal(trainingRewardLine(0, 0), "");
});

test("a payload with no verdict is not a result", () => {
    assert.equal(decodeSpeciesTrainingResult({}), null);
    assert.equal(decodeSpeciesTrainingResult(null), null);
});

test("quiz: choosing advances, Back keeps the answer, the last answer completes it", () => {
    let quiz = startTrainingQuiz(3);
    assert.deepEqual(quiz, {answers: [null, null, null], position: 0});
    assert.equal(trainingSubmission(quiz), null);

    quiz = chooseTrainingAnswer(quiz, 1);
    assert.equal(quiz.position, 1);
    quiz = previousTrainingQuestion(quiz);
    assert.equal(quiz.position, 0);
    assert.equal(quiz.answers[0], 1);
    quiz = chooseTrainingAnswer(quiz, 2);
    assert.deepEqual(quiz, {answers: [2, null, null], position: 1});

    quiz = chooseTrainingAnswer(quiz, 0);
    assert.equal(isTrainingQuizReady(quiz), false);
    quiz = chooseTrainingAnswer(quiz, 1);
    // The last question stays put; the caller submits.
    assert.equal(quiz.position, 2);
    assert.equal(isTrainingQuizReady(quiz), true);
    assert.deepEqual(trainingSubmission(quiz), [2, 0, 1]);

    assert.equal(previousTrainingQuestion(startTrainingQuiz(2)).position, 0);
});

test("Try again restarts with no answers chosen", () => {
    assert.deepEqual(startTrainingQuiz(2).answers, [null, null]);
});

test("a fused Power's quiz keeps its Training wording (SPEC section 6)", () => {
    assert.equal(TRAINING_COPY.title, "Lesson check");
    assert.equal(TRAINING_COPY.start, "Take the lesson check");
    assert.equal(TRAINING_COPY.complete, "Lesson check passed");
    assert.equal(TRAINING_COPY.readPowerAgain, "Read the Power again");
    assert.equal(TRAINING_COPY.tryAgain, "Try again");
    assert.equal(TRAINING_COPY.continue, "Continue");
    assert.equal(trainingQuestionProgress(1, 3), "Question 1 of 3");
});

test("the read's locks are never read, for every app version", () => {
    // `locked` and `proof_locked` are always false since 3.2; even an old row saying true locks nothing.
    const stale = decodeSpeciesTraining({...AVAILABLE, locked: true, proof_locked: true})!;
    assert.equal("locked" in stale, false);
    assert.equal("proofLocked" in stale, false);
    assert.equal(trainingCanStart(stale), true);
    assert.equal(trainingCanStart({...stale, unlocked: false}), false);
});

test("no refusal says tomorrow or a lock any more", () => {
    for (const message of [
        trainingRefusalMessage("training_locked"),
        trainingRefusalMessage("training_required"),
        powerRefusalMessage("proof_locked"),
        powerRefusalMessage("training_locked"),
        fusedRefusalMessage("fused_training_locked"),
        fusedRefusalMessage("attempts_exhausted_today")
    ]) {
        assert.equal(/tomorrow|lesson check first/i.test(message), false, message);
    }
    assert.equal(trainingRefusalMessage("species_not_unlocked"), "You don't own this index yet. Capture this animal first.");
    assert.equal(trainingRefusalMessage("answers_mismatch"), "Those answers did not match the questions. Try again.");
});
