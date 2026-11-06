import assert from "node:assert/strict";
import test from "node:test";
import {captureStarCount, gradeShare, levelShare, settingShare, tierShare} from "@/lib/capture-star-rating";

const weak = {dominance: 5, speed: 5, size: 5, intelligence: 5, rarity: 5};
const strong = {dominance: 99, speed: 99, size: 99, intelligence: 99, rarity: 99};

test("each share as iOS CaptureStarRating counts it", () => {
    assert.equal(gradeShare(10), 1);
    assert.equal(gradeShare(1), 0);
    assert.equal(gradeShare(null), 0);
    assert.equal(settingShare("Wild"), 1);
    assert.equal(settingShare("zoo"), 0);
    assert.ok(Math.abs(settingShare("farm") - 2 / 3) < 1e-9);
    assert.equal(levelShare(1), 0);
    assert.equal(levelShare(21), 1);
    assert.equal(levelShare(80), 1);
    assert.equal(tierShare("S"), 1);
    assert.equal(tierShare("E"), 0);
});

test("one to five stars; a pet tagged Wild scores as domestic", () => {
    assert.equal(captureStarCount({grade: null, settingTag: "Zoo", totalProgressionXP: 0, stats: weak}), 1);
    assert.equal(captureStarCount({grade: 10, settingTag: "Wild", totalProgressionXP: 1_000_000, stats: strong}), 5);
    const wild = captureStarCount({grade: 10, settingTag: "Wild", totalProgressionXP: 0, stats: weak});
    const pet = captureStarCount({grade: 10, settingTag: "Wild", humanContext: "pet", totalProgressionXP: 0, stats: weak});
    assert.ok(pet <= wild);
});
