import assert from "node:assert/strict";
import test from "node:test";

// A voice call's server side: the web port of the apps' animal-call-voice.ts
// (sentences, timed words, the archetype voice, the streamed voice and the
// spoken-reply allowance it takes and gives back).
import {
    CALL_REPLY_LINE,
    CALL_SAMPLE_RATE,
    SpokenSentences,
    pauseSeconds,
    speakableText,
    speechSettings,
    spokenWords
} from "@/lib/ask-animaldex/call-speech";
import {callSpeaker, CallVoiceStream, type CallVoice, type CallVoiceSetup} from "@/lib/ask-animaldex/call-voice-stream";
import {chooseAskChatVoiceKey as chooseChatVoiceKey} from "@/lib/ask-animaldex/persona";

// MARK: - Sentences

test("a streamed reply is cut into sentences as they complete", () => {
    const sentences = new SpokenSentences();
    assert.deepEqual(sentences.push("Hello there, little one. I was"), ["Hello there, little one."]);
    assert.deepEqual(sentences.push(" asleep in the gum tree all"), []);
    assert.deepEqual(sentences.push(" afternoon! Why"), ["I was asleep in the gum tree all afternoon!"]);
    assert.deepEqual(sentences.flush(), ["Why."]);
});

test("a very short sentence waits for the next, and a long run is cut at a comma", () => {
    const sentences = new SpokenSentences();
    assert.deepEqual(sentences.push("Oh. "), []);
    assert.deepEqual(sentences.push("That is a lovely question to ask me. "), ["Oh. That is a lovely question to ask me."]);
    const long = "When the rain comes down hard over the ridge and the creek starts to rise, I climb higher, and I wait there quietly";
    const out = new SpokenSentences().push(long);
    assert.equal(out.length, 1);
    assert.ok(out[0].endsWith(","));
});

test("markdown is not read out", () => {
    assert.equal(speakableText("## Try this\n- **Breathe** slowly\n- Then [rest](https://x.y)"), "Try this. Breathe slowly. Then rest.");
    assert.equal(speakableText("Look:\n```card\n{\"a\":1}\n```\nDone."), "Look: Done.");
    assert.deepEqual(new SpokenSentences().push("### \n"), []);
});

test("each word is timed from its first character to its last, break tags skipped", () => {
    const text = "Hi <break time=\"0.3s\" /> there.";
    const characters = Array.from(text);
    const words = spokenWords({
        characters,
        character_start_times_seconds: characters.map((_, i) => i * 0.05),
        character_end_times_seconds: characters.map((_, i) => i * 0.05 + 0.04)
    });
    assert.deepEqual(words.map((word) => word.text), ["Hi", "there."]);
    assert.equal(words[0].start, 0);
    assert.equal(words[0].end, 0.09);
});

test("the call's length line asks for speech, not a screen", () => {
    assert.match(CALL_REPLY_LINE, /^this_reply — a live voice call/);
    assert.equal(pauseSeconds("slow"), 0.45);
    assert.equal(pauseSeconds("quick"), 0.06);
    assert.equal(pauseSeconds("measured"), 0.22);
});

test("the voice is the apps' archetype for the animal", () => {
    assert.equal(chooseChatVoiceKey({animalName: "Red Fox", taxonomy: {class_name: "Mammalia", family_name: "Canidae"}, stats: null}), "trickster");
    assert.equal(chooseChatVoiceKey({animalName: "Koala", taxonomy: null, stats: null}), "sleepy");
    assert.equal(chooseChatVoiceKey({animalName: "Giant Oceanic Manta Ray", taxonomy: null, stats: null}), "ocean_glider");
    assert.equal(chooseChatVoiceKey({animalName: "Ocellaris Clownfish", taxonomy: {order_name: "Perciformes"}, stats: {dominance: 10, speed: 30, size: 4, intelligence: 20, rarity: 30}}), "playful_marine");
    const slow = speechSettings({baseSpeed: 1, dials: {tempo: "slow", build: "huge", presence: "commanding", rhythm: "calm"}, pace: "slow"});
    assert.equal(slow.speed, 0.86);
    assert.equal(slow.stability, 0.62);
});

// MARK: - The voice stream

const VOICE: CallVoice = {
    voiceKey: "sleepy",
    label: "Sleepy",
    elevenlabsVoiceId: "voiceid1234567",
    model: "eleven_flash_v2_5",
    settings: {speed: 0.9, stability: 0.5, similarity_boost: 0.78, style: 0.15},
    rate: 0.9,
    pace: "measured"
};

/** ElevenLabs' /stream/with-timestamps: one JSON object a line, in uneven network pieces. */
function fakeElevenLabs(seconds: number, options: {fail?: boolean} = {}): typeof fetch {
    return (async (_url: string | URL | Request, init?: RequestInit) => {
        if (options.fail) return new Response("quota", {status: 429});
        const {text} = JSON.parse(String(init?.body)) as {text: string};
        const characters = Array.from(text);
        const frames = Math.round(CALL_SAMPLE_RATE * seconds);
        const pcm = Buffer.alloc(frames * 2);
        for (let i = 0; i < frames; i++) pcm.writeInt16LE(Math.round(8000 * Math.sin(i / 10)), i * 2);
        const half = Math.floor(pcm.length / 4) * 2;
        const lines = [
            {audio_base64: pcm.subarray(0, half).toString("base64"), alignment: {
                characters,
                character_start_times_seconds: characters.map((_, i) => (i / characters.length) * seconds),
                character_end_times_seconds: characters.map((_, i) => ((i + 1) / characters.length) * seconds)
            }},
            {audio_base64: pcm.subarray(half).toString("base64"), alignment: null}
        ].map((line) => JSON.stringify(line) + "\n").join("");
        const bytes = new TextEncoder().encode(lines);
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                // Cut mid-line, as a network does.
                controller.enqueue(bytes.slice(0, 37));
                controller.enqueue(bytes.slice(37));
                controller.close();
            }
        });
        return new Response(body, {status: 200});
    }) as typeof fetch;
}

test("sentences are voiced in order, with their words timed from the start of the answer", async () => {
    const events: Array<Record<string, unknown>> = [];
    const stream = new CallVoiceStream(VOICE, "key", (event) => events.push(event), fakeElevenLabs(0.5));
    stream.say("Hello there, my friend.");
    stream.say("I was asleep.");
    await stream.finish();
    assert.ok(stream.spoke);
    const words = events.filter((event) => event.words) as Array<{words: Array<{text: string; start: number}>}>;
    assert.equal(words.length, 2);
    assert.equal(words[0].words[0].text, "Hello");
    assert.equal(words[0].words[0].start, 0);
    // The second sentence starts after the first's half second and the pause.
    assert.equal(words[1].words[0].start, 0.5 + pauseSeconds("measured"));
    // All the audio arrived, PCM frames whole, plus the pause between.
    const audioBytes = events.filter((event) => event.audio)
        .reduce((sum, event) => sum + Buffer.from(String(event.audio), "base64").length, 0);
    assert.equal(audioBytes, 2 * (2 * CALL_SAMPLE_RATE * 0.5 + Math.round(CALL_SAMPLE_RATE * pauseSeconds("measured"))));
    // Words come after the sentence's audio.
    const firstWords = events.findIndex((event) => event.words);
    assert.ok(events.slice(0, firstWords).some((event) => event.audio));
});

function setup(allowed: boolean, refunds: {count: number}): Promise<CallVoiceSetup> {
    return Promise.resolve({
        voice: VOICE,
        allowed,
        allowance: allowed ? null : {allowed: false, remaining: 0},
        refund: async () => {
            refunds.count += 1;
        }
    });
}

test("the speaker says first whether there is a voice, then speaks what it hears", async () => {
    const events: Array<Record<string, unknown>> = [];
    const refunds = {count: 0};
    const speaker = callSpeaker(setup(true, refunds), (event) => events.push(event), {apiKey: "key", fetchImpl: fakeElevenLabs(0.3)});
    speaker.hear("Hello! ");
    speaker.hear("I am here.");
    await speaker.finish();
    assert.deepEqual(events[0], {call_voice: {available: true, rate: 0.9, sample_rate: CALL_SAMPLE_RATE, label: "Sleepy"}});
    assert.ok(events.some((event) => event.audio));
    assert.equal(refunds.count, 0);
});

test("today's spoken replies used: no voice, and the answer shows as text", async () => {
    const events: Array<Record<string, unknown>> = [];
    const speaker = callSpeaker(setup(false, {count: 0}), (event) => events.push(event), {apiKey: "key", fetchImpl: fakeElevenLabs(0.3)});
    speaker.hear("Hello there friend.");
    await speaker.finish();
    assert.equal(events.length, 1);
    assert.equal((events[0].call_voice as {reason: string}).reason, "speech_limit_reached");
});

test("a spoken reply nothing was heard of goes back", async () => {
    const refunds = {count: 0};
    const failed = callSpeaker(setup(true, refunds), () => undefined, {apiKey: "key", fetchImpl: fakeElevenLabs(0.3, {fail: true})});
    failed.hear("Hello there friend.");
    await failed.finish();
    assert.equal(refunds.count, 1);
    // Hung up before a word: back too, once.
    const gone = callSpeaker(setup(true, refunds), () => undefined, {apiKey: "key", fetchImpl: fakeElevenLabs(0.3)});
    gone.stop();
    gone.stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(refunds.count, 2);
});
