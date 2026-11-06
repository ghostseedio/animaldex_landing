import assert from "node:assert/strict";
import test from "node:test";
import {captureProgressSnapshot, formatCaptureDuration} from "@/lib/capture-progress-copy";
import {CAPTURE_WORDS_EN} from "@/lib/capture-words";

const words = CAPTURE_WORDS_EN.progress;

test("durations read as iOS formats them", () => {
    assert.equal(formatCaptureDuration(4.2, words), "5s");
    assert.equal(formatCaptureDuration(60, words), "1 min");
    assert.equal(formatCaptureDuration(75, words), "1 min 15s");
    assert.equal(formatCaptureDuration(660, words), "11 min");
});

test("uploading: the time left, then the slow line with Retry after 45 s", () => {
    const early = captureProgressSnapshot("uploading", 2, words);
    assert.equal(early.label, "Uploading photo…");
    assert.equal(early.detail, "Usually a few seconds. About 6s left.");
    assert.equal(early.offersRetry, false);
    assert.equal(captureProgressSnapshot("uploading", 7, words).detail, "This usually takes a few seconds.");
    const slow = captureProgressSnapshot("uploading", 50, words);
    assert.equal(slow.label, "Upload is taking longer");
    assert.equal(slow.offersRetry, true);
    assert.ok(slow.progressFraction <= 0.88);
});

test("identifying: about how long, then 'should be done soon', then taking longer with Retry", () => {
    const early = captureProgressSnapshot("analyzing", 5, words);
    assert.equal(early.label, "Identifying…");
    assert.equal(early.detail, "About 20s left · usually 15–30 seconds.");
    assert.equal(captureProgressSnapshot("analyzing", 24, words).detail, "Should be done soon · usually 15–30 seconds.");
    const slow = captureProgressSnapshot("analyzing", 46, words);
    assert.equal(slow.label, "Identification is taking longer");
    assert.equal(slow.detail, "Still working — usually 15–30 seconds. Your photo is saved.");
    assert.equal(slow.offersRetry, true);
    // Capped below done, however long it runs.
    assert.ok(captureProgressSnapshot("analyzing", 600, words).progressFraction <= 0.9);
    assert.ok(early.progressFraction >= 0.22);
});
