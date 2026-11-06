import assert from "node:assert/strict";
import test from "node:test";
import {captureValidityNotice} from "@/lib/capture-validity-notice";
import {CAPTURE_WORDS_EN} from "@/lib/capture-words";

const base = {
    isOwner: true,
    captureValidity: "valid_live_capture",
    isEligibleCapture: true,
    hasUncertaintyFallback: false,
    isNumbered: true,
    justRevealed: false,
    captureGrade: 7,
    words: CAPTURE_WORDS_EN.card
};

test("a clean capture opens with nothing; an uncertain one says Retake required to anyone", () => {
    assert.equal(captureValidityNotice(base), null);
    const uncertain = captureValidityNotice({...base, isOwner: false, hasUncertaintyFallback: true});
    assert.equal(uncertain?.title, "Retake required");
    assert.equal(uncertain?.kind, "uncertain");
});

test("the owner's unclear photo of an unnumbered animal: Capture needs a clearer look, with Retake", () => {
    const notice = captureValidityNotice({...base, captureValidity: "unclear_capture", isNumbered: false});
    assert.equal(notice?.title, "Capture needs a clearer look");
    assert.equal(notice?.retake, true);
    // Never on someone else's card.
    assert.equal(captureValidityNotice({...base, isOwner: false, captureValidity: "unclear_capture", isNumbered: false}), null);
});

test("a just-revealed card keeps the Retake only for a photo graded 3 or lower (IOS-28)", () => {
    const revealed = captureValidityNotice({...base, captureValidity: "unclear_capture", isNumbered: false, justRevealed: true});
    assert.equal(revealed?.retake, false);
    assert.equal(revealed?.kind, "eligibility");
    const lowGrade = captureValidityNotice({...base, captureValidity: "unclear_capture", isNumbered: false, justRevealed: true, captureGrade: 3});
    assert.equal(lowGrade?.retake, true);
});

test("a numbered animal's unclear photo, and an ineligible one, say so once with what to try", () => {
    const numbered = captureValidityNotice({...base, captureValidity: "unclear_capture"});
    assert.equal(numbered?.detail, "Try retaking the photo with the animal larger and sharper in frame.");
    assert.equal(numbered?.retake, false);
    const screen = captureValidityNotice({...base, captureValidity: "likely_non_live_source", isEligibleCapture: false});
    assert.equal(screen?.title, "Possible poster or screen image");
    const none = captureValidityNotice({...base, captureValidity: "no_animal_detected", isEligibleCapture: false});
    assert.equal(none?.title, "No animal detected");
});
