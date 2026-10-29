/**
 * The call's recognizer for browsers without one of their own (Firefox): one
 * turn of what the reader said, as 16 kHz 16-bit mono WAV, transcribed by
 * ElevenLabs speech to text. `/api/ask/call-transcribe` wires it up; the
 * browser side is `voice-call/call-server-listener.ts`.
 *
 * Only for a signed-in reader, and only where calls are offered at all
 * (`askCallsOffered`: development, or production with NEXT_PUBLIC_ANIMAL_CALLS
 * on). A turn is at most 31 s (the listener sends at 30 s) and 1 MB, in
 * exactly the listener's format, so nothing else can be sent through it; and
 * a reader is held to 30 transcriptions a minute and 300 an hour (a turn
 * takes one to four: one at each pause, a few while talking over the animal).
 * Nothing is stored.
 *
 * No `server-only`: the tests drive it with a fake reader and a fake
 * ElevenLabs.
 */

import {parseWav, CALL_HEARING} from "@/lib/ask-animaldex/call-hearing";

export const CALL_TRANSCRIBE_LIMITS = {
    maxSeconds: 31,
    minSeconds: 0.2,
    maxBytes: 1_000_000,
    perMinute: 30,
    perHour: 300,
    timeoutMs: 15_000
} as const;

/**
 * ElevenLabs' batch speech-to-text model (`ANIMAL_CALL_TRANSCRIBE_MODEL` to
 * change it). Scribe v2 heard a 3.3 s turn word for word in 1.0 s; v1 took
 * 2.0 s for the same words (2026-10-29), and the wait is the end of a turn.
 */
export const DEFAULT_CALL_TRANSCRIBE_MODEL = "scribe_v2";

export type CallTranscribeDeps = {
    /** Who is asking. */
    viewer: () => Promise<{signedIn: boolean; userId: string | null}>;
    /** The call gate (`askCallsOffered`). */
    callsOffered: (signedIn: boolean) => boolean;
    apiKey: string | null;
    model?: string;
    fetchImpl?: typeof fetch;
    rateLimit: (key: string, limit: number, windowMs: number) => {allowed: boolean; retryAfterSeconds: number};
};

const HEADERS = {"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"} as const;

function json(body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {status, headers: {...HEADERS, ...extra, "Content-Type": "application/json"}});
}

/** The language ElevenLabs is told (ISO 639), from the call's BCP 47 tag; null lets it tell. */
export function transcribeLanguage(raw: string | null): string | null {
    const primary = raw?.trim().split(/[-_]/)[0]?.toLowerCase() ?? "";
    return /^[a-z]{2,3}$/.test(primary) ? primary : null;
}

/** What was said, from ElevenLabs' answer: its words (no sound events), or its text. */
export function transcriptText(payload: unknown): string {
    const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const words = Array.isArray(row.words) ? row.words as Array<Record<string, unknown>> : null;
    const joined = words
        ? words.filter((word) => word.type === "word" || word.type === "spacing").map((word) => (typeof word.text === "string" ? word.text : "")).join("")
        : typeof row.text === "string" ? row.text : "";
    return joined.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Reads at most `limit` bytes of the body; null when there is more. */
async function readCapped(request: Request, limit: number): Promise<Uint8Array | null> {
    if (!request.body) return new Uint8Array(0);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) {
            await reader.cancel().catch(() => undefined);
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, at);
        at += chunk.byteLength;
    }
    return bytes;
}

export async function handleCallTranscribe(request: Request, deps: CallTranscribeDeps): Promise<Response> {
    const limits = CALL_TRANSCRIBE_LIMITS;
    if (!deps.callsOffered(true)) return json({ok: false, error: "calls_unavailable"}, 404);
    const viewer = await deps.viewer();
    if (!viewer.signedIn || !viewer.userId) return json({ok: false, error: "sign_in_required"}, 401);
    if (!deps.apiKey) return json({ok: false, error: "transcription_unavailable"}, 503);

    const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (type !== "audio/wav" && type !== "audio/x-wav" && type !== "audio/wave") return json({ok: false, error: "unsupported_audio"}, 415);
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limits.maxBytes) return json({ok: false, error: "too_large"}, 413);
    const bytes = await readCapped(request, limits.maxBytes);
    if (!bytes) return json({ok: false, error: "too_large"}, 413);

    const wav = parseWav(bytes);
    if (!wav) return json({ok: false, error: "invalid_audio"}, 400);
    if (wav.format !== 1 || wav.channels !== 1 || wav.bitsPerSample !== 16 || wav.sampleRate !== CALL_HEARING.sampleRate) {
        return json({ok: false, error: "unsupported_audio"}, 415);
    }
    if (wav.seconds > limits.maxSeconds) return json({ok: false, error: "too_long"}, 413);
    if (wav.seconds < limits.minSeconds) return json({ok: false, error: "too_short"}, 400);

    for (const [window, limit, ms] of [["minute", limits.perMinute, 60_000], ["hour", limits.perHour, 3_600_000]] as const) {
        const rate = deps.rateLimit(`call-transcribe:${window}:${viewer.userId}`, limit, ms);
        if (!rate.allowed) {
            return json({ok: false, error: "rate_limited", retryAfterSeconds: rate.retryAfterSeconds}, 429, {"Retry-After": String(rate.retryAfterSeconds)});
        }
    }

    const form = new FormData();
    form.append("model_id", deps.model || DEFAULT_CALL_TRANSCRIBE_MODEL);
    form.append("file", new Blob([bytes], {type: "audio/wav"}), "turn.wav");
    const language = transcribeLanguage(new URL(request.url).searchParams.get("language"));
    if (language) form.append("language_code", language);
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onAbort, {once: true});
    try {
        const response = await (deps.fetchImpl ?? fetch)("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: {"xi-api-key": deps.apiKey},
            body: form,
            signal: controller.signal
        });
        if (!response.ok) {
            const detail = (await response.text().catch(() => "")).slice(0, 200);
            console.warn(`[ask-animaldex] call transcription ${response.status}: ${detail}`);
            return json({ok: false, error: "transcription_failed"}, 502);
        }
        return json({ok: true, text: transcriptText(await response.json())});
    } catch (error) {
        console.warn("[ask-animaldex] call transcription failed", error instanceof Error ? error.message : error);
        return json({ok: false, error: "transcription_failed"}, 502);
    } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", onAbort);
    }
}
