import assert from "node:assert/strict";
import test from "node:test";

import {
    askEstimatedSpokenWords,
    askMatchSpokenWords,
    askReplyWords,
    askSpokenIndex,
    askWordRanges,
    askWords,
    parseAskSpokenWords
} from "@/lib/ask-animaldex/spoken-words";
import {askReplyPieces} from "@/lib/ask-animaldex/thread-layout";
import {
    AskVoiceScheduler,
    askSoundAudioUrl,
    askSoundSegments,
    parseAskSoundBank,
    type AskSoundBank,
    type AskSoundCue
} from "@/lib/ask-animaldex/animal-sounds";

// MARK: - Spoken words (the iOS AnimalChatSpokenWordsTests)

test("a word is what holds a letter or a digit", () => {
    assert.deepEqual(askWords("Wait — then go … 3 times."), ["Wait", "then", "go", "3", "times."]);
    assert.deepEqual(askWordRanges("Hi there"), [[0, 2], [3, 8]]);
});

test("a reply's words run across its bubbles and skip its drawings", () => {
    const reply = [
        "Evening. Who's in your pack?",
        "",
        "```animaldex-flow",
        '{"title":"Trail","steps":[{"label":"Find food"},{"label":"Mark it"}]}',
        "```",
        "",
        "Keep it **short**."
    ].join("\n");
    const {words, pieceStarts} = askReplyWords(askReplyPieces(reply, false));
    assert.deepEqual(words, ["Evening.", "Who's", "in", "your", "pack?", "Keep", "it", "short."]);
    assert.equal(pieceStarts[0], 0);
    assert.equal(pieceStarts[pieceStarts.length - 1], 5);
});

test("spoken words find their words on screen in order", () => {
    const shown = ["Evening.", "Who’s", "in", "your", "pack?"];
    const spoken = ["Evening.", "Who's", "in", "your", "pack?"];
    assert.deepEqual(askMatchSpokenWords(spoken, shown), [0, 1, 2, 3, 4]);
    assert.deepEqual(askMatchSpokenWords(["café"], ["Cafe"]), [0]);
});

test("a spoken word with no match lights nothing and matching carries on", () => {
    const shown = ["It", "is", "20%", "warmer", "today."];
    const spoken = ["It", "is", "twenty", "percent", "warmer", "today."];
    assert.deepEqual(askMatchSpokenWords(spoken, shown), [0, 1, null, null, 3, 4]);
});

test("the word at a moment holds through the gaps and ends after the last", () => {
    const words = [
        {text: "Stay", start: 0.1, end: 0.4},
        {text: "low.", start: 0.5, end: 0.9},
        {text: "Then", start: 1.6, end: 1.9}
    ];
    assert.equal(askSpokenIndex(0.05, words), null);
    assert.equal(askSpokenIndex(0.2, words), 0);
    assert.equal(askSpokenIndex(1.2, words), 1);
    assert.equal(askSpokenIndex(1.7, words), 2);
    assert.equal(askSpokenIndex(2.5, words), null);
});

test("a clip without times spreads its words over the clip in order", () => {
    const times = askEstimatedSpokenWords(["Stay", "low.", "Then", "strike."], 4);
    assert.equal(times.length, 4);
    assert.equal(times[0].start, 0);
    for (let index = 1; index < times.length; index += 1) {
        assert.ok(times[index - 1].start < times[index].start && times[index - 1].end <= times[index].start);
    }
    assert.ok(times[times.length - 1].end <= 4);
    // A sentence ends with a beat: "low." takes longer than "Stay".
    assert.ok(times[1].end - times[1].start > times[0].end - times[0].start);
    assert.deepEqual(askEstimatedSpokenWords([], 4), []);
});

test("the server's word times are read tolerantly", () => {
    assert.deepEqual(parseAskSpokenWords([{text: "Hi", start: 0, end: 0.3}, {text: 4}, null]), [{text: "Hi", start: 0, end: 0.3}]);
    assert.equal(parseAskSpokenWords("nope"), null);
    assert.equal(parseAskSpokenWords([]), null);
});

// MARK: - Sound banks (the iOS AnimalChatSoundsTests)

/** Repeatable dice, so a rhythm can be checked exactly. */
function seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function bank(style: AskSoundBank["style"] = "short", interval = 0.5, grains = 6): AskSoundBank {
    return {
        version: 1,
        kind: "species",
        habitatLabel: null,
        audio: "sprite-test.m4a",
        calls: [{start: 0.15, duration: 2}, {start: 2.3, duration: 1.6}],
        grains: Array.from({length: grains}, (_, index) => ({start: 4 + index, duration: 0.25})),
        style,
        rhythm: {interval, callLength: 0.25},
        credits: []
    };
}

test("the published manifest decodes", () => {
    const decoded = parseAskSoundBank({
        version: 1,
        audio: "sprite-1a2b3c4d.m4a",
        calls: [[0.15, 2.4], [2.7, 1.9]],
        grains: [[4.75, 0.31], [5.21, 0.18]],
        style: "long",
        rhythm: {ioi: 1.869, event: 1.2, events_per_minute: 12.2},
        credits: [{recordist: "Jo Field", license: "CC BY 4.0", source: "iNaturalist", page: "https://www.inaturalist.org/observations/1"}]
    });
    assert.ok(decoded);
    assert.deepEqual(decoded.calls, [{start: 0.15, duration: 2.4}, {start: 2.7, duration: 1.9}]);
    assert.equal(decoded.grains.length, 2);
    assert.equal(decoded.style, "long");
    assert.equal(decoded.rhythm.interval, 1.869);
    assert.equal(decoded.credits[0].recordist, "Jo Field");
    assert.equal(askSoundSegments(decoded).length, 4);
    assert.equal(
        askSoundAudioUrl("59F1A1A9-CF08-4418-9BAF-B20DDD00CEB3", decoded),
        "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animal-chat-sounds/v1/59f1a1a9-cf08-4418-9baf-b20ddd00ceb3/sprite-1a2b3c4d.m4a"
    );
});

test("a bank without calls is refused, and a bad rhythm is clamped", () => {
    assert.equal(parseAskSoundBank({version: 1, audio: "a.m4a", calls: [], grains: [[1, 0.2]]}), null);
    const clamped = parseAskSoundBank({version: 1, audio: "a.m4a", calls: [[0, 1]], rhythm: {ioi: 0.001, event: 40}});
    assert.ok(clamped);
    assert.equal(clamped.rhythm.interval, 0.08);
    assert.equal(clamped.rhythm.callLength, 3);
    assert.deepEqual(clamped.grains, []);
    assert.equal(clamped.style, "short");
});

test("a habitat bank points at shared audio, and nowhere else", () => {
    const habitat = parseAskSoundBank({
        version: 1, kind: "habitat", habitat: "reef", habitat_label: "the reef",
        shared_audio: "habitat/reef/sprite-1a2b3c4d.m4a",
        calls: [[0.15, 3]], grains: [[3.3, 0.6]], style: "ambient", rhythm: {ioi: 3.5, event: 1},
        credits: [{recordist: "National Park Service", license: "CC0", source: "Wikimedia Commons"}]
    });
    assert.ok(habitat);
    assert.equal(habitat.kind, "habitat");
    assert.equal(habitat.habitatLabel, "the reef");
    assert.equal(habitat.audio, "habitat/reef/sprite-1a2b3c4d.m4a");
    assert.equal(askSoundAudioUrl("x", habitat).endsWith("/v1/habitat/reef/sprite-1a2b3c4d.m4a"), true);
    for (const shared of ["../secret/sprite-1a2b3c4d.m4a", "habitat/reef/../../x.m4a", "habitat/Reef/sprite-zz.m4a"]) {
        assert.equal(parseAskSoundBank({version: 1, kind: "habitat", shared_audio: shared, calls: [[0, 1]]}), null);
    }
    assert.equal(parseAskSoundBank({version: 1, audio: "other/sprite.m4a", calls: [[0, 1]]}), null);
});

test("surroundings are sparser and softer than a voice", () => {
    const ambient: AskSoundBank = {...bank("ambient", 0.5, 2), kind: "habitat", habitatLabel: "the reef"};
    const scheduler = new AskVoiceScheduler(ambient);
    assert.ok(scheduler.baseInterval >= 3.5);
    assert.ok((scheduler.replyBegan(0, seeded(9))?.gain ?? 1) < 0.85);
});

test("a reply opens with a call and nothing talks over it", () => {
    const random = seeded(1);
    const scheduler = new AskVoiceScheduler(bank());
    const call = scheduler.replyBegan(100, random);
    assert.equal(call?.isCall, true);
    assert.equal(call?.segment, 0);
    // The 2 s call is still playing.
    assert.equal(scheduler.wordShown(101, false, random), null);
    assert.equal(scheduler.wordShown(101.9, false, random), null);
});

test("a quick reply opens with a short sound, and calls take turns", () => {
    const random = seeded(2);
    const scheduler = new AskVoiceScheduler(bank());
    assert.equal(scheduler.replyBegan(0, random)?.isCall, true);
    // Ten seconds later: a full call again would be tiring.
    assert.equal(scheduler.replyBegan(10, random)?.isCall, false);
    // Half a minute later it calls again, with its other call.
    const next = scheduler.replyBegan(40, random);
    assert.equal(next?.isCall, true);
    assert.equal(next?.segment, 1);
});

test("asking to hear it always gives a full call, in turn", () => {
    const random = seeded(4);
    const scheduler = new AskVoiceScheduler(bank());
    assert.equal(scheduler.replyBegan(0, random)?.segment, 0);
    // Five seconds later a reply would get a short sound; asking does not.
    const asked = scheduler.callOnRequest(5, random);
    assert.equal(asked.isCall, true);
    assert.equal(asked.segment, 1);
    assert.equal(scheduler.callOnRequest(6, random).segment, 0);
});

test("no sound twice in a row, and every one varies", () => {
    const random = seeded(3);
    const scheduler = new AskVoiceScheduler(bank("short", 0.22));
    scheduler.replyBegan(0, random);
    const cues: AskSoundCue[] = [];
    let now = 3;
    for (let index = 0; index < 400; index += 1) {
        now += 0.35;
        const cue = scheduler.wordShown(now, false, random);
        if (cue) cues.push(cue);
    }
    assert.ok(cues.length > 20);
    for (let index = 1; index < cues.length; index += 1) assert.notEqual(cues[index].segment, cues[index - 1].segment);
    assert.ok(new Set(cues.map((cue) => cue.rate)).size > 10);
    assert.ok(cues.every((cue) => cue.rate >= 0.965 && cue.rate <= 1.035 && cue.gain >= 0.42 && cue.gain <= 0.58));
});

test("the word after a full stop is a breath", () => {
    const random = seeded(4);
    const scheduler = new AskVoiceScheduler(bank());
    scheduler.replyBegan(0, random);
    scheduler.wordShown(50, true, random);
    assert.equal(scheduler.wordShown(100, false, random), null);
    assert.notEqual(scheduler.wordShown(150, false, random), null);
});

test("long-call animals are sparing", () => {
    const random = seeded(5);
    const howler = new AskVoiceScheduler(bank("long", 0.6));
    const chirper = new AskVoiceScheduler(bank("short", 0.6));
    assert.ok(howler.baseInterval >= 2.8);
    assert.ok(chirper.baseInterval < 1);
    howler.replyBegan(0, random);
    chirper.replyBegan(0, random);
    let howls = 0;
    let chirps = 0;
    let now = 2.5;
    for (let index = 0; index < 80; index += 1) {
        now += 0.4;
        if (howler.wordShown(now, false, random)) howls += 1;
        if (chirper.wordShown(now, false, random)) chirps += 1;
    }
    assert.ok(howls < chirps / 2);
});

test("a slow talker spaces its sounds out", () => {
    assert.ok(new AskVoiceScheduler(bank("short", 0.8), "slow").baseInterval > new AskVoiceScheduler(bank("short", 0.8), "quick").baseInterval);
});

test("it settles down as a long reply goes on", () => {
    const random = seeded(6);
    const scheduler = new AskVoiceScheduler(bank("short", 0.3));
    scheduler.replyBegan(0, random);
    const times: number[] = [];
    let now = 2.5;
    for (let index = 0; index < 300; index += 1) {
        now += 0.3;
        if (scheduler.wordShown(now, false, random)) times.push(now);
    }
    const gaps = times.slice(1).map((time, index) => time - times[index]);
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    assert.ok(average(gaps.slice(-5)) > average(gaps.slice(0, 5)));
});
