import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    buildFramePayload,
    ESCALATION_FRAME_POSITIONS,
    INITIAL_FRAME_POSITIONS,
    jpegDataUrlToRawBase64,
    MAX_IMPORT_FRAMES,
    scaledFrameSize,
    shouldEscalateFrames,
    timestampMsForPosition
} from "./instagram-reel-frames";

test("initial and escalation positions match iOS", () => {
    assert.deepEqual(Array.from(INITIAL_FRAME_POSITIONS), [0.2, 0.5, 0.8]);
    assert.deepEqual(Array.from(ESCALATION_FRAME_POSITIONS), [0.35, 0.65, 0.9]);
    assert.equal(INITIAL_FRAME_POSITIONS.length + ESCALATION_FRAME_POSITIONS.length, MAX_IMPORT_FRAMES);
});

test("frame timestamps use duration fractions", () => {
    assert.equal(timestampMsForPosition(26000, 0.2), 5200);
    assert.equal(timestampMsForPosition(26000, 0.5), 13000);
    assert.equal(timestampMsForPosition(26000, 0.8), 20800);
});

test("frames are capped at 1024 on the long side", () => {
    assert.deepEqual(scaledFrameSize(2048, 1024), {width: 1024, height: 512});
    assert.deepEqual(scaledFrameSize(800, 600), {width: 800, height: 600});
});

test("payloads are raw jpeg base64 without a data URL prefix", () => {
    const payload = buildFramePayload({
        index: 3,
        timestampMs: 9100,
        jpegBase64: "data:image/jpeg;base64,/9j/4AAQ"
    });
    assert.equal(payload.frame_index, 3);
    assert.equal(payload.jpeg_base64, "/9j/4AAQ");
    assert.equal(jpegDataUrlToRawBase64("data:image/jpeg;base64,/9j/4AAQ"), "/9j/4AAQ");
});

test("escalation only happens when the server asks and frames remain", () => {
    assert.equal(shouldEscalateFrames({escalate: true}, 3), true);
    assert.equal(shouldEscalateFrames({escalate: true}, 6), false);
    assert.equal(shouldEscalateFrames({escalate: false}, 3), false);
});

test("frame extraction walks positions with an index loop, not .entries()", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "instagram-reel-frames.ts"), "utf8");
    assert.doesNotMatch(source, /\.entries\(\)/);
    assert.match(source, /for \(let offset = 0; offset < options\.positions\.length; offset \+= 1\)/);
    assert.equal(timestampMsForPosition(10000, INITIAL_FRAME_POSITIONS[0]), 2000);
    assert.equal(timestampMsForPosition(10000, INITIAL_FRAME_POSITIONS[1]), 5000);
    assert.equal(timestampMsForPosition(10000, INITIAL_FRAME_POSITIONS[2]), 8000);
});
