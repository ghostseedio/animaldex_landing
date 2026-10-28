import assert from "node:assert/strict";
import test from "node:test";

// A voice call in the browser: reading the call's frames off the chat stream
// as the iOS client does, the word being heard, the turn-taking pauses, and
// the animal's pace kept without changing its pitch.
import {
    CALL_END_OF_TURN_SILENCE_MS,
    CALL_MID_SENTENCE_SILENCE_MS,
    callClock,
    callEventFrom,
    callPauseAfter,
    callSpokenIndex,
    decodePcm16,
    heardWordCount,
    loudness
} from "@/lib/ask-animaldex/call-events";
import {StreamingTimeStretch} from "@/lib/ask-animaldex/call-time-stretch";

const CALL_SAMPLE_RATE = 24_000;

// MARK: - The browser's reading of the stream

test("call frames read as iOS reads them, and the chat's own frames do not", () => {
    const pcm = Buffer.alloc(4);
    pcm.writeInt16LE(-2, 0);
    pcm.writeInt16LE(300, 2);
    const audio = callEventFrom({audio: pcm.toString("base64"), sample_rate: 24000});
    assert.equal(audio?.kind, "audio");
    assert.deepEqual(Array.from((audio as {pcm: Int16Array}).pcm), [-2, 300]);
    assert.deepEqual(callEventFrom({call_voice: {available: true, rate: 0.92, sample_rate: 24000, label: "Sleepy"}}), {
        kind: "voice",
        info: {available: true, reason: null, rate: 0.92, sampleRate: 24000, label: "Sleepy"}
    });
    assert.deepEqual(callEventFrom({call_voice: {available: false, reason: "speech_limit_reached"}}), {
        kind: "voice",
        info: {available: false, reason: "speech_limit_reached", rate: null, sampleRate: null, label: null}
    });
    assert.deepEqual(callEventFrom({words: [{text: "Hi.", start: 0.1, end: 0.3}, {text: 5}]}), {
        kind: "words",
        words: [{text: "Hi.", start: 0.1, end: 0.3}]
    });
    assert.equal(callEventFrom({delta: "Hello"}), null);
    assert.equal(callEventFrom({done: true, words: [{text: "x", start: 0, end: 1}]}), null);
    assert.equal(callEventFrom({persona: {pace: "slow"}}), null);
    assert.deepEqual(Array.from(decodePcm16(Buffer.from([0xff, 0x7f, 0x00, 0x80]).toString("base64"))), [32767, -32768]);
});

test("the word being heard is the last to have started", () => {
    const words = [{text: "Hello", start: 0, end: 0.3}, {text: "there.", start: 0.4, end: 0.8}];
    assert.equal(callSpokenIndex(words, -0.1), -1);
    assert.equal(callSpokenIndex(words, 0.35), 0);
    assert.equal(callSpokenIndex(words, 2), 1);
    assert.equal(heardWordCount(" um "), 1);
    assert.equal(heardWordCount("wait no"), 2);
});

test("a finished sentence ends the turn sooner than a thought in the middle", () => {
    assert.equal(callPauseAfter("Where do you sleep?"), CALL_END_OF_TURN_SILENCE_MS);
    assert.equal(callPauseAfter("Where do you"), CALL_MID_SENTENCE_SILENCE_MS);
    // A recognizer that punctuates is trusted to; one that never does marks the moment by settling.
    assert.equal(callPauseAfter("where do you sleep", {settled: true, punctuates: false}), CALL_END_OF_TURN_SILENCE_MS);
    assert.equal(callPauseAfter("where do you", {settled: true, punctuates: true}), CALL_MID_SENTENCE_SILENCE_MS);
    assert.equal(callClock(7.9), "0:07");
    assert.equal(callClock(750), "12:30");
});

test("loudness is the RMS of each 10 ms, in dBFS", () => {
    const loud = new Float32Array(480).fill(0.5);
    const levels = loudness(loud, 240);
    assert.equal(levels.length, 2);
    assert.ok(Math.abs(levels[0] - 20 * Math.log10(0.5)) < 1e-6);
    assert.equal(loudness(new Float32Array(240), 240)[0], -90);
});

// MARK: - The animal's pace

function sine(frequency: number, seconds: number): Float32Array {
    const out = new Float32Array(Math.round(CALL_SAMPLE_RATE * seconds));
    for (let i = 0; i < out.length; i++) out[i] = 0.5 * Math.sin(2 * Math.PI * frequency * i / CALL_SAMPLE_RATE);
    return out;
}

function zeroCrossingsPerSecond(samples: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) if ((samples[i - 1] < 0) !== (samples[i] < 0)) crossings++;
    return crossings / (samples.length / CALL_SAMPLE_RATE);
}

test("a slower animal takes longer to say the same thing, at the same pitch", () => {
    for (const rate of [0.86, 1.1]) {
        const stretch = new StreamingTimeStretch(rate);
        const input = sine(220, 2);
        const pieces: Float32Array[] = [];
        // Arriving a tenth of a second at a time, as the stream does.
        for (let at = 0; at < input.length; at += 2400) pieces.push(stretch.push(input.subarray(at, at + 2400)));
        pieces.push(stretch.flush());
        const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
        const out = new Float32Array(total);
        let at = 0;
        for (const piece of pieces) {
            out.set(piece, at);
            at += piece.length;
        }
        const expected = input.length / rate;
        assert.ok(Math.abs(out.length - expected) / expected < 0.03, `rate ${rate}: ${out.length} vs ${expected}`);
        const middle = out.subarray(Math.round(out.length * 0.1), Math.round(out.length * 0.9));
        const pitch = zeroCrossingsPerSecond(middle) / 2;
        assert.ok(Math.abs(pitch - 220) < 4, `rate ${rate}: ${pitch} Hz`);
    }
    const same = new StreamingTimeStretch(1);
    const input = sine(220, 0.1);
    assert.equal(same.push(input), input);
});
