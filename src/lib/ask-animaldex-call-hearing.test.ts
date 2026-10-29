import assert from "node:assert/strict";
import test from "node:test";

// Hearing a call turn without the browser's recognizer (Firefox): the turn's
// end from the echo-cancelled microphone's level, with iOS's silence and
// thinking-pause rules, the audio transcribed on the server.
import {
    CALL_HEARING,
    CallDownsampler,
    CallTurnDetector,
    encodeWav,
    parseWav,
    pcmDecibels,
    wordsNotTheAnimals,
    type HearingAction
} from "@/lib/ask-animaldex/call-hearing";

const QUIET = -70;
const VOICE = -28;
const FRAME = CALL_HEARING.frameMs;

/** Feeds 20 ms frames at `decibels` from `from` (exclusive) to `to` ms; returns every action, each with when it came. */
function feed(detector: CallTurnDetector, decibels: number, from: number, to: number) {
    const actions: Array<HearingAction & {at: number}> = [];
    for (let at = from + FRAME; at <= to; at += FRAME) {
        for (const action of detector.frame(decibels, at)) actions.push({...action, at});
    }
    return actions;
}

/** Talking: syllables (180 ms loud) with the short dips between them (60 ms), as speech has and a fan has not. */
function speak(detector: CallTurnDetector, from: number, to: number) {
    const actions: Array<HearingAction & {at: number}> = [];
    for (let at = from + FRAME; at <= to; at += FRAME) {
        const level = (at - from) % 240 < 180 ? VOICE : -50;
        for (const action of detector.frame(level, at)) actions.push({...action, at});
    }
    return actions;
}

function only<K extends HearingAction["kind"]>(actions: HearingAction[], kind: K) {
    return actions.filter((action): action is Extract<HearingAction, {kind: K}> & {at: number} => action.kind === kind);
}

test("nothing said for 15 s ends the listen with nothing", () => {
    const detector = new CallTurnDetector();
    const actions = feed(detector, QUIET, 0, 16_000);
    const finish = only(actions, "finish");
    assert.equal(finish.length, 1);
    assert.equal(finish[0].text, null);
    assert.equal((finish[0] as {at: number}).at, 15_000);
    assert.equal(only(actions, "transcribe").length, 0);
});

test("a finished sentence ends the turn 1.3 s into the pause", () => {
    const detector = new CallTurnDetector();
    feed(detector, QUIET, 0, 1_000);
    feed(detector, VOICE, 1_000, 2_200);
    // Half a second into the pause, what was said is transcribed, with the 0.6 s before they began.
    const pause = feed(detector, QUIET, 2_200, 2_700);
    const [ask] = only(pause, "transcribe");
    assert.ok(ask, "transcribed into the pause");
    assert.equal(ask.toMs, 2_700);
    assert.equal(ask.fromMs, 1_000 - CALL_HEARING.prerollMs);
    const heard = detector.transcript(ask.id, "I saw a fox by the river.");
    assert.deepEqual(only(heard, "heard").map((action) => action.text), ["I saw a fox by the river."]);
    assert.equal(only(heard, "finish").length, 0);
    const rest = feed(detector, QUIET, 2_700, 4_000);
    const [finish] = only(rest, "finish");
    assert.equal(finish.text, "I saw a fox by the river.");
    assert.equal(finish.at, 2_200 + 1_300);
});

test("a pause mid-sentence is thinking: it waits 2.4 s", () => {
    const detector = new CallTurnDetector();
    feed(detector, VOICE, 0, 1_000);
    const [ask] = only(feed(detector, QUIET, 1_000, 1_500), "transcribe");
    detector.transcript(ask.id, "I was wondering whether");
    assert.equal(only(feed(detector, QUIET, 1_500, 3_000), "finish").length, 0);
    const [finish] = only(feed(detector, QUIET, 3_000, 4_000), "finish");
    assert.equal(finish.text, "I was wondering whether");
    assert.equal(finish.at, 1_000 + 2_400);
});

test("carrying on after a pause is the same turn, transcribed whole again", () => {
    const detector = new CallTurnDetector();
    feed(detector, VOICE, 0, 1_000);
    const [first] = only(feed(detector, QUIET, 1_000, 1_600), "transcribe");
    detector.transcript(first.id, "So I think");
    // They go on before the pause is up.
    feed(detector, VOICE, 1_600, 2_600);
    const [second] = only(feed(detector, QUIET, 2_600, 3_100), "transcribe");
    assert.equal(second.fromMs, first.fromMs, "from the start of the turn");
    assert.equal(second.toMs, 3_100);
    detector.transcript(second.id, "So I think the fox lives here.");
    const [finish] = only(feed(detector, QUIET, 3_100, 5_000), "finish");
    assert.equal(finish.text, "So I think the fox lives here.");
    assert.equal(finish.at, 2_600 + 1_300);
});

test("a transcript that comes back after they went on does not end the turn", () => {
    const detector = new CallTurnDetector();
    feed(detector, VOICE, 0, 800);
    const [ask] = only(feed(detector, QUIET, 800, 1_300), "transcribe");
    // They carry on while it is out.
    feed(detector, VOICE, 1_300, 2_000);
    const late = detector.transcript(ask.id, "Hello.");
    assert.deepEqual(only(late, "heard").map((action) => action.text), ["Hello."]);
    // Quiet again: not finished at 1.3 s on the old transcript; a fresh one is asked for.
    const after = feed(detector, QUIET, 2_000, 3_400);
    assert.equal(only(after, "finish").length, 0);
    assert.equal(only(after, "transcribe").length, 1);
});

test("a click is not talking, and a noise that transcribes to nothing is dropped", () => {
    const detector = new CallTurnDetector();
    feed(detector, QUIET, 0, 1_000);
    // 60 ms: shorter than someone talking.
    const click = [...feed(detector, VOICE, 1_000, 1_060), ...feed(detector, QUIET, 1_060, 3_000)];
    assert.equal(only(click, "transcribe").length, 0);
    assert.equal(detector.hearsSomeone, false);
    // 300 ms of a knock: transcribed, nothing in it, dropped.
    feed(detector, VOICE, 3_000, 3_300);
    const [ask] = only(feed(detector, QUIET, 3_300, 3_800), "transcribe");
    assert.ok(ask);
    detector.transcript(ask.id, "");
    assert.equal(detector.hearsSomeone, false);
    // Then they speak: a turn of its own, from just before they began.
    feed(detector, QUIET, 3_800, 6_000);
    feed(detector, VOICE, 6_000, 7_000);
    const [next] = only(feed(detector, QUIET, 7_000, 7_500), "transcribe");
    assert.ok(next.fromMs >= 6_000 - CALL_HEARING.prerollMs, `from ${next.fromMs}`);
    detector.transcript(next.id, "Are you there?");
    const [finish] = only(feed(detector, QUIET, 7_500, 9_000), "finish");
    assert.equal(finish.text, "Are you there?");
});

test("a steady noise becomes the room within 3 s: it neither holds the turn open nor is transcribed again and again", () => {
    const detector = new CallTurnDetector();
    // A fan at -45 dBFS, louder than a quiet room's threshold, from the start.
    let asks = 0;
    let at = 0;
    for (let round = 0; round < 10; round++) {
        const actions = feed(detector, -45, at, at + 1_000);
        at += 1_000;
        for (const ask of only(actions, "transcribe")) {
            asks += 1;
            detector.transcript(ask.id, "");
        }
    }
    assert.ok(asks <= 1, `transcribed ${asks} times`);
    assert.equal(detector.hearsSomeone, false);
    // A voice over the fan is still heard, and its pause found.
    const voice = [...feed(detector, VOICE, at, at + 800), ...feed(detector, -45, at + 800, at + 1_400)];
    assert.equal(only(voice, "transcribe").length, 1);
});

test("tapping sends what was said now", () => {
    const detector = new CallTurnDetector();
    feed(detector, VOICE, 0, 1_200);
    const now = detector.finishNow();
    const [ask] = only(now, "transcribe");
    assert.equal(ask.toMs, 1_200);
    const [finish] = only(detector.transcript(ask.id, "Tell me about"), "finish");
    assert.equal(finish.text, "Tell me about");
    // Before anyone spoke, it sends nothing.
    const quiet = new CallTurnDetector();
    feed(quiet, QUIET, 0, 500);
    assert.deepEqual(quiet.finishNow(), [{kind: "finish", text: null}]);
});

test("a turn is sent at 30 s however long they go on", () => {
    const detector = new CallTurnDetector();
    const actions = speak(detector, 0, 32_000);
    assert.equal(only(actions, "transcribe").length, 1, "no pause in all that talking");
    const asks = only(actions, "transcribe");
    const last = asks[asks.length - 1];
    assert.ok(last.toMs - last.fromMs <= CALL_HEARING.maxTurnMs, "no clip longer than the route takes");
    const done = detector.transcript(last.id, "A very long story about the forest");
    // They are still talking, and the turn is not sent past 30 s.
    const [finish] = only([...done, ...speak(detector, 32_000, 33_000)], "finish");
    assert.equal(finish.text, "A very long story about the forest");
});

test("over the animal: louder and longer to count, and heard while they talk, not at a pause", () => {
    const detector = new CallTurnDetector();
    detector.setAnimalTalking(true);
    feed(detector, QUIET, 0, 500);
    // 200 ms: a cough over the animal is not someone talking.
    assert.equal(only([...feed(detector, VOICE, 500, 700), ...feed(detector, QUIET, 700, 2_000)], "transcribe").length, 0);
    assert.equal(detector.hearsSomeone, false);
    // Talking over it: transcribed 0.7 s in, while they still talk.
    const over = speak(detector, 2_000, 3_000);
    const [ask] = only(over, "transcribe");
    assert.ok(ask, "heard while talking");
    assert.ok(ask.toMs < 3_000);
    const heard = detector.transcript(ask.id, "wait wait a moment");
    assert.deepEqual(only(heard, "heard").map((action) => action.text), ["wait wait a moment"]);
    // Three times an answer at most.
    detector.setAnimalTalking(true);
    let probes = 1;
    for (let at = 3_000; at < 9_000; at += 1_000) {
        for (const next of only(speak(detector, at, at + 1_000), "transcribe")) {
            probes += 1;
            detector.transcript(next.id, "wait wait a moment and");
        }
    }
    assert.equal(probes, CALL_HEARING.talkOverProbes);
});

test("over the animal a voice must be 6 dB clearer than in a quiet room", () => {
    const level = -52 + 3;
    const calm = new CallTurnDetector();
    feed(calm, QUIET, 0, 1_000);
    feed(calm, level, 1_000, 1_400);
    assert.equal(calm.hearsSomeone, true);
    const over = new CallTurnDetector();
    over.setAnimalTalking(true);
    feed(over, QUIET, 0, 1_000);
    feed(over, level, 1_000, 1_600);
    assert.equal(over.hearsSomeone, false);
});

test("a failed transcription is retried; failing again and again gives up", () => {
    const detector = new CallTurnDetector();
    feed(detector, VOICE, 0, 1_000);
    let [ask] = only(feed(detector, QUIET, 1_000, 1_500), "transcribe");
    for (let failure = 1; failure <= CALL_HEARING.failuresAllowed; failure++) {
        const retry = only(detector.transcript(ask.id, null), "transcribe");
        assert.equal(retry.length, 1, `retried after failure ${failure}`);
        ask = retry[0];
    }
    assert.deepEqual(detector.transcript(ask.id, null), [{kind: "fail", reason: "transcription_failed"}]);
});

test("a transcription that never answers counts as failed", () => {
    const detector = new CallTurnDetector();
    feed(detector, VOICE, 0, 1_000);
    const [ask] = only(feed(detector, QUIET, 1_000, 1_500), "transcribe");
    const waited = feed(detector, QUIET, 1_500, 1_500 + CALL_HEARING.transcriptTimeoutMs + 100);
    const [retry] = only(waited, "transcribe");
    assert.ok(retry && retry.id !== ask.id);
    // The late answer to the first is ignored.
    assert.deepEqual(detector.transcript(ask.id, "too late."), []);
});

test("only words that are not the animal's own count as talking over it", () => {
    const animal = "The river is cold this morning, and the fish are slow".split(" ");
    assert.equal(wordsNotTheAnimals("the river is cold", animal), 0);
    assert.equal(wordsNotTheAnimals("River, cold!", animal), 0);
    assert.equal(wordsNotTheAnimals("wait stop", animal), 2);
    assert.equal(wordsNotTheAnimals("wait the fish", animal), 1);
    assert.equal(wordsNotTheAnimals("Café olé", ["cafe"]), 1);
});

test("the microphone goes to 16 kHz, 16-bit, mono WAV and back", () => {
    const down = new CallDownsampler(48_000);
    const second = new Float32Array(48_000);
    for (let i = 0; i < second.length; i++) second[i] = 0.5 * Math.sin(2 * Math.PI * 220 * i / 48_000);
    // In pieces, as the microphone hands them over.
    const pieces = [second.subarray(0, 1_000), second.subarray(1_000, 30_001), second.subarray(30_001)];
    const out = pieces.map((piece) => down.push(piece));
    const total = out.reduce((sum, piece) => sum + piece.length, 0);
    assert.equal(total, 16_000);
    const joined = new Int16Array(total);
    let at = 0;
    for (const piece of out) {
        joined.set(piece, at);
        at += piece.length;
    }
    // A sine at 0.5 is about -9 dBFS.
    assert.ok(Math.abs(pcmDecibels(joined) - -9.03) < 0.3, String(pcmDecibels(joined)));
    const odd = new CallDownsampler(44_100);
    assert.ok(Math.abs(odd.push(new Float32Array(44_100)).length - 16_000) <= 1);

    const wav = encodeWav(joined);
    assert.equal(wav.length, 44 + 32_000);
    assert.deepEqual(parseWav(wav), {format: 1, channels: 1, sampleRate: 16_000, bitsPerSample: 16, dataBytes: 32_000, seconds: 1});
    assert.equal(parseWav(new TextEncoder().encode("not a wav file, not at all, no not even close")), null);
});
