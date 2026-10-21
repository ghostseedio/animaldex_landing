import assert from "node:assert/strict";
import {test} from "node:test";
import {
    isDeepWildProfileQuestion,
    wildProfileAnswerInput,
    wildProfileBirthDateAnswer,
    wildProfileBirthDateBounds
} from "@/lib/wild-profile-interview-answers";

test("only birth_date questions get the date input; unknown types fall back to text", () => {
    assert.equal(wildProfileAnswerInput({question_type: "birth_date"}), "birth_date");
    assert.equal(wildProfileAnswerInput({question_type: "free_text"}), "text");
    assert.equal(wildProfileAnswerInput({question_type: "star_sign"}), "text");
    assert.equal(wildProfileAnswerInput({question_type: null}), "text");
    assert.equal(wildProfileAnswerInput(null), "text");
});

test("the picker runs from 120 years ago to 5 years ago", () => {
    assert.deepEqual(wildProfileBirthDateBounds(new Date(2026, 9, 21)), {min: "1906-10-21", max: "2021-10-21"});
    // 29 February steps back to the 28th in a year without one.
    assert.deepEqual(wildProfileBirthDateBounds(new Date(2028, 1, 29)), {min: "1908-02-29", max: "2023-02-28"});
});

test("a birth date answer is a real ISO day inside the bounds", () => {
    const today = new Date(2026, 9, 21);
    assert.equal(wildProfileBirthDateAnswer("1998-03-14", today), "1998-03-14");
    assert.equal(wildProfileBirthDateAnswer(" 2021-10-21 ", today), "2021-10-21");
    assert.equal(wildProfileBirthDateAnswer("2021-10-22", today), null);
    assert.equal(wildProfileBirthDateAnswer("1906-10-20", today), null);
    assert.equal(wildProfileBirthDateAnswer("1998-02-30", today), null);
    assert.equal(wildProfileBirthDateAnswer("14/03/1998", today), null);
    assert.equal(wildProfileBirthDateAnswer("", today), null);
});

test("deep questions hide the animal chips", () => {
    for (const dimension of ["identity_name", "identity_birth_date", "purpose_reading", "deep_unlived_path"]) {
        assert.equal(isDeepWildProfileQuestion({dimension}), true);
    }
    assert.equal(isDeepWildProfileQuestion({dimension: "habitat"}), false);
    assert.equal(isDeepWildProfileQuestion({dimension: null}), false);
});
