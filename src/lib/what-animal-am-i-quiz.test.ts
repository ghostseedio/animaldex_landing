import assert from "node:assert/strict";
import test from "node:test";
import {quizQuestions, scoreQuiz, wildProfileRoleQuestions} from "@/data/what-animal-am-i-quiz";

function allAnswers(pick: (index: number) => number) {
    return Object.fromEntries(quizQuestions.map((question) => [question.id, question.answers[pick(question.answers.length) % question.answers.length].id]));
}

test("role question ids all exist in the quiz", () => {
    const ids = new Set(quizQuestions.map((question) => question.id));
    for (const id of [...wildProfileRoleQuestions.apex, ...wildProfileRoleQuestions.active]) {
        assert.ok(ids.has(id), `unknown question id ${id}`);
    }
});

test("every answer combination path yields three different animals", () => {
    for (let offset = 0; offset < 4; offset += 1) {
        for (let step = 0; step < 4; step += 1) {
            let index = 0;
            const answers = allAnswers(() => offset + step * index++);
            const {origin, apex, active} = scoreQuiz(answers);
            assert.equal(new Set([origin.slug, apex.slug, active.slug]).size, 3);
        }
    }
});

test("apex follows the pressure answers, active the current-season answers", () => {
    const answers: Record<string, string> = {
        "solo-group": "team",
        planning: "rough",
        recharge: "people",
        novelty: "new",
        learning: "burst",
        "day-night": "morning",
        conflict: "head-on",
        pressure: "fiercer",
        care: "protect",
        flaw: "over-giving"
    };
    const result = scoreQuiz(answers);
    assert.equal(result.origin.slug, "wolf");
    assert.equal(result.apex.slug, "honey-badger");
    assert.equal(result.active.slug, "ruby-throated-hummingbird");
});

test("scoring is deterministic and ignores unknown ids", () => {
    const answers = allAnswers(() => 1);
    assert.deepEqual(scoreQuiz(answers), scoreQuiz({...answers, bogus: "nope"}));
    const empty = scoreQuiz({});
    assert.equal(new Set([empty.origin.slug, empty.apex.slug, empty.active.slug]).size, 3);
});
