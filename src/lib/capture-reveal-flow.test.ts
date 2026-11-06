import assert from "node:assert/strict";
import test from "node:test";
import {captureRevealHeader, captureRevealTimeline} from "@/lib/capture-reveal-flow";
import {CAPTURE_WORDS_EN} from "@/lib/capture-words";

const words = CAPTURE_WORDS_EN.reveal;

test("the header names what happened, and an uncertain one plainly", () => {
    assert.deepEqual(captureRevealHeader({phase: "identify", isNewSpecies: true, isUncertain: false, words}), {title: "New species", detail: "Matched to AnimalDex"});
    assert.deepEqual(captureRevealHeader({phase: "locked", isNewSpecies: false, isUncertain: false, words}), {title: "Identified", detail: "Subject locked"});
    assert.deepEqual(captureRevealHeader({phase: "morph", isNewSpecies: true, isUncertain: false, words}), {title: "New Animal Discovered", detail: "Added to your AnimalDex"});
    assert.deepEqual(captureRevealHeader({phase: "identify", isNewSpecies: false, isUncertain: true, words}), {title: "Not sure yet", detail: "Re-analyze it free from your card"});
});

test("a repeat sighting locks and moves on; a first-time species gets its discovery", () => {
    assert.deepEqual(captureRevealTimeline({discovery: false, reduceMotion: false}).map((step) => step.phase), ["locked", "done"]);
    const discovery = captureRevealTimeline({discovery: true, reduceMotion: false});
    assert.deepEqual(discovery.map((step) => step.phase), ["locked", "catalog", "morph", "done"]);
    assert.equal(discovery.reduce((sum, step) => sum + step.afterMs, 0), 800 + 450 + 2250 + 1650 + 500);
    const calm = captureRevealTimeline({discovery: true, reduceMotion: true}).reduce((sum, step) => sum + step.afterMs, 0);
    assert.ok(calm < 2500);
});
