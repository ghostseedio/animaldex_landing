import assert from "node:assert/strict";
import {test} from "node:test";
import {captureStarScore, captureStars} from "@/lib/capture-star-rating";

test("stars are the stored capture_stars", () => {
    assert.equal(captureStars(1), 1);
    assert.equal(captureStars(5), 5);
    assert.equal(captureStars("4"), 4);
});

test("no stored stars means no stars, never a computed fallback", () => {
    assert.equal(captureStars(null), null);
    assert.equal(captureStars(undefined), null);
    assert.equal(captureStars(""), null);
    assert.equal(captureStars(0), null);
    assert.equal(captureStars(6), null);
    assert.equal(captureStars(Number.NaN), null);
});

test("star_score reads numbers and numeric strings", () => {
    assert.equal(captureStarScore(0.4159), 0.4159);
    assert.equal(captureStarScore("0.5473"), 0.5473);
    assert.equal(captureStarScore(null), null);
    assert.equal(captureStarScore("x"), null);
});
