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
    showsTrainingStep,
    startTrainingQuiz,
    trainingFailSummary,
    trainingGatesPlay,
    trainingIntroText,
    trainingQuestionProgress,
    trainingRefusalMessage,
    trainingRewardLine,
    trainingSubmission
} from "@/lib/species-training";
import {powerRefusalMessage} from "@/lib/animal-powers";
import {isRetryableRefusal, trialStartErrorMessage, verifierRefusalMessage} from "@/lib/animal-trials";

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
    assert.equal(trainingGatesPlay(training), true);
    assert.equal(showsTrainingStep(training), true);
});

test("get_species_training decodes from a JSON string too", () => {
    assert.equal(decodeSpeciesTraining(JSON.stringify(AVAILABLE))?.questions.length, 2);
});

test("an unavailable animal shows no Training step and gates nothing", () => {
    const training = decodeSpeciesTraining({
        species_profile_id: SPECIES, available: false, completed: false, unlocked: true,
        reward_xp: 10, reward_credits: 1, content_version: null, questions: []
    });
    assert.ok(training);
    assert.equal(training.available, false);
    assert.equal(training.contentVersion, null);
    assert.equal(showsTrainingStep(training), false);
    assert.equal(trainingGatesPlay(training), false);
});

test("no read, or a broken one, gates nothing", () => {
    assert.equal(trainingGatesPlay(null), false);
    assert.equal(decodeSpeciesTraining(null), null);
    assert.equal(decodeSpeciesTraining("not json"), null);
    // Claims available with nothing answerable: never lock the Trials behind it.
    const broken = decodeSpeciesTraining({...AVAILABLE, questions: [{index: 0, prompt: "", choices: []}]});
    assert.equal(trainingGatesPlay(broken), false);
});

test("a completed Training shows complete and unlocks Play", () => {
    const training = decodeSpeciesTraining({...AVAILABLE, completed: true});
    assert.equal(showsTrainingStep(training), true);
    assert.equal(training?.completed, true);
    assert.equal(trainingGatesPlay(training), false);
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
    const training = decodeSpeciesTraining(AVAILABLE)!;
    assert.equal(trainingGatesPlay(notingTrainingResult(training, result)), true);
});

test("submit_species_training decodes a pass and unlocks Play", () => {
    const result = decodeSpeciesTrainingResult({
        passed: true, already_completed: false, correct: [true, true],
        explanations: ["Edges have the most food.", "Because."], reward_xp: 10, reward_credits: 1
    });
    assert.ok(result);
    assert.equal(result.passed, true);
    assert.equal(result.alreadyCompleted, false);
    assert.deepEqual(result.explanations, ["Edges have the most food.", "Because."]);
    assert.equal(trainingRewardLine(result.rewardXP, result.rewardCredits), "+10 XP · +1 Credit");
    const training = decodeSpeciesTraining(AVAILABLE)!;
    assert.equal(trainingGatesPlay(notingTrainingResult(training, result)), false);
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

test("copy matches the shared spec word for word", () => {
    assert.equal(TRAINING_COPY.title, "Training");
    assert.equal(TRAINING_COPY.start, "Start Training");
    assert.equal(TRAINING_COPY.complete, "Training complete");
    assert.equal(TRAINING_COPY.readPowerAgain, "Read the Power again");
    assert.equal(TRAINING_COPY.tryAgain, "Try again");
    assert.equal(TRAINING_COPY.continue, "Continue");
    assert.equal(TRAINING_COPY.lockedLine, "Complete Training to unlock");
    assert.equal(TRAINING_COPY.required, "Complete this animal's Training first.");
    assert.equal(trainingIntroText(1), "Answer 1 quick question about this animal's Power.");
    assert.equal(trainingIntroText(3), "Answer 3 quick questions about this animal's Power.");
    assert.equal(trainingQuestionProgress(1, 3), "Question 1 of 3");
});

test("training_required maps to the same message everywhere", () => {
    const message = "Complete this animal's Training first.";
    assert.equal(trialStartErrorMessage("training_required", "fallback"), message);
    assert.equal(verifierRefusalMessage("training_required"), message);
    assert.equal(isRetryableRefusal("training_required"), false);
    assert.equal(powerRefusalMessage("training_required"), message);
    assert.equal(trainingRefusalMessage("training_required"), message);
    assert.equal(trialStartErrorMessage("something else", "fallback"), "fallback");
});
