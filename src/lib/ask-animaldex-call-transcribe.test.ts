import assert from "node:assert/strict";
import test from "node:test";

// The call's server recognizer (`/api/ask/call-transcribe`): who may use it,
// what it takes, how often, and what it hands ElevenLabs and gives back.
import {encodeWav} from "@/lib/ask-animaldex/call-hearing";
import {
    CALL_TRANSCRIBE_LIMITS,
    handleCallTranscribe,
    transcribeLanguage,
    transcriptText,
    type CallTranscribeDeps
} from "@/lib/ask-animaldex/call-transcribe";
import {askCallsOffered} from "@/lib/ask-animaldex/call-gate";

const SECOND = 16_000;

function turn(seconds: number): Uint8Array {
    const samples = new Int16Array(Math.round(seconds * SECOND));
    for (let i = 0; i < samples.length; i++) samples[i] = Math.round(8_000 * Math.sin(2 * Math.PI * 200 * i / SECOND));
    return encodeWav(samples);
}

function post(body: Uint8Array | string, options: {type?: string; language?: string; length?: string} = {}) {
    const headers: Record<string, string> = {"Content-Type": options.type ?? "audio/wav"};
    if (options.length) headers["Content-Length"] = options.length;
    return new Request(`http://localhost/api/ask/call-transcribe${options.language ? `?language=${options.language}` : ""}`, {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : Buffer.from(body)
    });
}

type Sent = {url: string; key: string | null; fields: Record<string, string>; file: {type: string; size: number} | null};

function harness(overrides: Partial<CallTranscribeDeps> = {}) {
    const sent: Sent[] = [];
    const hits = new Map<string, number>();
    const deps: CallTranscribeDeps = {
        viewer: async () => ({signedIn: true, userId: "reader-1"}),
        callsOffered: (signedIn) => askCallsOffered(signedIn, {NODE_ENV: "production", NEXT_PUBLIC_ANIMAL_CALLS: "on"}),
        apiKey: "test-key",
        rateLimit: (key, limit) => {
            const count = (hits.get(key) ?? 0) + 1;
            hits.set(key, count);
            return {allowed: count <= limit, retryAfterSeconds: 42};
        },
        fetchImpl: (async (url: string, init: RequestInit) => {
            const form = init.body as FormData;
            const fields: Record<string, string> = {};
            let file: Sent["file"] = null;
            form.forEach((value, name) => {
                if (typeof value === "string") fields[name] = value;
                else file = {type: value.type, size: value.size};
            });
            sent.push({url, key: (init.headers as Record<string, string>)["xi-api-key"] ?? null, fields, file});
            return new Response(JSON.stringify({
                text: "Hello fox (laughs) how are you?",
                words: [
                    {text: "Hello", type: "word"}, {text: " ", type: "spacing"}, {text: "fox", type: "word"},
                    {text: " ", type: "spacing"}, {text: "(laughs)", type: "audio_event"}, {text: " ", type: "spacing"},
                    {text: "how", type: "word"}, {text: " ", type: "spacing"}, {text: "are", type: "word"},
                    {text: " ", type: "spacing"}, {text: "you?", type: "word"}
                ]
            }), {status: 200, headers: {"Content-Type": "application/json"}});
        }) as unknown as typeof fetch,
        ...overrides
    };
    return {deps, sent};
}

test("a signed-in reader's turn is transcribed by ElevenLabs, in the call's language, and nothing else is said back", async () => {
    const {deps, sent} = harness();
    const response = await handleCallTranscribe(post(turn(1.5), {language: "en-GB"}), deps);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {ok: true, text: "Hello fox how are you?"});
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, "https://api.elevenlabs.io/v1/speech-to-text");
    assert.equal(sent[0].key, "test-key");
    assert.deepEqual(sent[0].fields, {model_id: "scribe_v2", language_code: "en", tag_audio_events: "false", diarize: "false"});
    assert.deepEqual(sent[0].file, {type: "audio/wav", size: 44 + 1.5 * SECOND * 2});
});

test("only where calls are offered, and only for a signed-in reader", async () => {
    const closed = harness({callsOffered: (signedIn) => askCallsOffered(signedIn, {NODE_ENV: "production"})});
    assert.equal((await handleCallTranscribe(post(turn(1)), closed.deps)).status, 404);
    const signedOut = harness({viewer: async () => ({signedIn: false, userId: null})});
    const response = await handleCallTranscribe(post(turn(1)), signedOut.deps);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {ok: false, error: "sign_in_required"});
    // Development lets a signed-out reader call (scripted), never transcribe.
    const development = harness({viewer: async () => ({signedIn: false, userId: null}), callsOffered: (signedIn) => askCallsOffered(signedIn, {NODE_ENV: "development"})});
    assert.equal((await handleCallTranscribe(post(turn(1)), development.deps)).status, 401);
    for (const harnessed of [closed, signedOut, development]) assert.equal(harnessed.sent.length, 0);
    const noKey = harness({apiKey: null});
    assert.equal((await handleCallTranscribe(post(turn(1)), noKey.deps)).status, 503);
});

test("a turn is capped: 31 s, 1 MB, and the listener's own format only", async () => {
    const {deps, sent} = harness();
    const status = async (request: Request) => (await handleCallTranscribe(request, deps)).status;
    assert.equal(await status(post(turn(CALL_TRANSCRIBE_LIMITS.maxSeconds))), 200);
    assert.equal(await status(post(turn(CALL_TRANSCRIBE_LIMITS.maxSeconds + 0.5))), 413);
    assert.equal(await status(post(turn(0.1))), 400);
    // A declared length over the cap is refused before the body is read; so is a body that runs over it.
    assert.equal(await status(post(turn(1), {length: String(CALL_TRANSCRIBE_LIMITS.maxBytes + 1)})), 413);
    assert.equal(await status(post(new Uint8Array(CALL_TRANSCRIBE_LIMITS.maxBytes + 10))), 413);
    // Not WAV, not this WAV.
    assert.equal(await status(post(turn(1), {type: "audio/mpeg"})), 415);
    assert.equal(await status(post("RIFF....WAVEnot really a wave file at all, sorry")), 400);
    const stereo = turn(1);
    new DataView(stereo.buffer).setUint16(22, 2, true);
    assert.equal(await status(post(stereo)), 415);
    const fast = turn(1);
    new DataView(fast.buffer).setUint32(24, 48_000, true);
    assert.equal(await status(post(fast)), 415);
    assert.equal(sent.length, 1, "only the good one reached ElevenLabs");
});

test("a reader is held to 30 a minute (and 300 an hour)", async () => {
    const {deps, sent} = harness();
    const statuses: number[] = [];
    for (let i = 0; i < CALL_TRANSCRIBE_LIMITS.perMinute + 2; i++) statuses.push((await handleCallTranscribe(post(turn(0.5)), deps)).status);
    assert.deepEqual(statuses.slice(0, CALL_TRANSCRIBE_LIMITS.perMinute), new Array(CALL_TRANSCRIBE_LIMITS.perMinute).fill(200));
    const limited = await handleCallTranscribe(post(turn(0.5)), deps);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "42");
    assert.equal((await limited.json()).error, "rate_limited");
    assert.equal(sent.length, CALL_TRANSCRIBE_LIMITS.perMinute);
    assert.equal(CALL_TRANSCRIBE_LIMITS.perHour, 300);
});

test("ElevenLabs failing is a failed transcription, not an empty one", async () => {
    const down = harness({fetchImpl: (async () => new Response("overloaded", {status: 503})) as unknown as typeof fetch});
    const response = await handleCallTranscribe(post(turn(1)), down.deps);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, "transcription_failed");
    const broken = harness({fetchImpl: (async () => {
        throw new Error("network");
    }) as unknown as typeof fetch});
    assert.equal((await handleCallTranscribe(post(turn(1)), broken.deps)).status, 502);
});

test("the language and the transcript are read carefully", () => {
    assert.equal(transcribeLanguage("en-US"), "en");
    assert.equal(transcribeLanguage("pt_BR"), "pt");
    assert.equal(transcribeLanguage("fil"), "fil");
    assert.equal(transcribeLanguage("zh-Hant-TW"), "zh");
    assert.equal(transcribeLanguage(""), null);
    assert.equal(transcribeLanguage("en'; drop"), null);
    assert.equal(transcriptText({text: " [music] I'm here. "}), "I'm here.");
    assert.equal(transcriptText({}), "");
    assert.equal(transcriptText(null), "");
});
