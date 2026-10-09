import assert from "node:assert/strict";
import test from "node:test";
import {
    applyWildProfileChip,
    suggestedWildProfileChips,
    wildProfileInterviewChips
} from "./wild-profile-interview-chips";

test("habitat keywords win first, matching the iOS order", () => {
    assert.deepEqual(suggestedWildProfileChips("Which wild place feels like home — forest or ocean?"), wildProfileInterviewChips.habitat);
});

test("food, social, movement and pressure questions get their own chips", () => {
    assert.deepEqual(suggestedWildProfileChips("Are you more herbivore or carnivore?"), wildProfileInterviewChips.food);
    assert.deepEqual(suggestedWildProfileChips("Pack animal or lone wolf?"), wildProfileInterviewChips.social);
    assert.deepEqual(suggestedWildProfileChips("Would you rather swim or glide?"), wildProfileInterviewChips.movement);
    assert.deepEqual(suggestedWildProfileChips("Under pressure, what changes?"), wildProfileInterviewChips.pressure);
});

test("questions without a keyword get no chips", () => {
    assert.deepEqual(suggestedWildProfileChips("Tell me more about that."), []);
});

test("a chip fills an empty composer and appends only once", () => {
    const [forest] = wildProfileInterviewChips.habitat;
    assert.equal(applyWildProfileChip("", forest), "Forest");
    assert.equal(applyWildProfileChip("I like", forest), "I like Forest");
    assert.equal(applyWildProfileChip("I like forest", forest), "I like forest");
});
