import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {narrationCachePath, narrationLanguageCode, splitNarrationText} from "@/lib/narration-text";

// The AI voiceover signed-in readers get on blog posts and animal stories.
// Google Cloud TTS (a Chirp 3 HD voice), else OpenAI, as MP3. Each reading is
// saved to the public `narration-audio` bucket under a hash of its text and
// voice, so a piece is only ever voiced once: the next listener plays the file.

export const NARRATION_BUCKET = "narration-audio";

/** Pieces voiced at once for a long article. */
const PARALLEL_REQUESTS = 4;

export type CloudNarration = {url: string; cached: boolean; provider: "google" | "openai" | "cache"};

function storage() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase storage is not configured.");
    return {url, key};
}

function encodePath(path: string) {
    return path.split("/").map(encodeURIComponent).join("/");
}

export function narrationPublicUrl(path: string) {
    return `${storage().url}/storage/v1/object/public/${NARRATION_BUCKET}/${encodePath(path)}`;
}

export function narrationVoice(locale: string) {
    const name = process.env.NARRATION_TTS_VOICE_NAME?.trim() || "Charon";
    return `${narrationLanguageCode(locale)}-Chirp3-HD-${name}`;
}

let bucketReady: Promise<void> | null = null;

/**
 * Creates the bucket the first time it is needed (also declared in
 * supabase/migrations/20261010200000_narration_audio_bucket.sql, which may
 * not have been applied to every project).
 */
function ensureBucket() {
    bucketReady ??= (async () => {
        const {url, key} = storage();
        const response = await fetch(`${url}/storage/v1/bucket`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({id: NARRATION_BUCKET, name: NARRATION_BUCKET, public: true, file_size_limit: 52_428_800, allowed_mime_types: ["audio/mpeg"]}),
            cache: "no-store"
        });
        if (response.ok) return;
        const detail = await response.text();
        // Already there (409, or 400 "Duplicate" on older storage versions).
        if (response.status === 409 || /already exists|duplicate/i.test(detail)) return;
        throw new Error(`narration_bucket_${response.status}:${detail.slice(0, 200)}`);
    })().catch((error) => {
        bucketReady = null;
        throw error;
    });
    return bucketReady;
}

async function isSaved(path: string) {
    const response = await fetch(narrationPublicUrl(path), {method: "HEAD", cache: "no-store"});
    return response.ok;
}

async function upload(path: string, mp3: Buffer) {
    await ensureBucket();
    const {url, key} = storage();
    const response = await fetch(`${url}/storage/v1/object/${NARRATION_BUCKET}/${encodePath(path)}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "audio/mpeg", "x-upsert": "true", "Cache-Control": "max-age=31536000"}),
        body: new Uint8Array(mp3),
        cache: "no-store",
        signal: AbortSignal.timeout(2 * 60_000)
    });
    if (!response.ok) throw new Error(`narration_upload_${response.status}:${(await response.text()).slice(0, 200)}`);
}

async function googlePiece(text: string, voice: string, key: string): Promise<Buffer> {
    const languageCode = voice.split("-").slice(0, 2).join("-");
    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({input: {text}, voice: {languageCode, name: voice}, audioConfig: {audioEncoding: "MP3"}}),
        signal: AbortSignal.timeout(90_000)
    });
    if (!response.ok) throw new Error(`google_tts_${response.status}:${(await response.text()).slice(0, 200)}`);
    const body = await response.json() as {audioContent?: string};
    if (!body.audioContent) throw new Error("google_tts_empty");
    return Buffer.from(body.audioContent, "base64");
}

async function openaiPiece(text: string, key: string): Promise<Buffer> {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify({
            model: process.env.NARRATION_OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
            voice: process.env.NARRATION_OPENAI_TTS_VOICE?.trim() || "ash",
            input: text,
            instructions: "Warm, clear documentary narrator reading an article aloud. Natural pace, curious tone.",
            response_format: "mp3"
        }),
        signal: AbortSignal.timeout(90_000)
    });
    if (!response.ok) throw new Error(`openai_tts_${response.status}:${(await response.text()).slice(0, 200)}`);
    return Buffer.from(await response.arrayBuffer());
}

async function voicePieces(pieces: string[], speak: (piece: string) => Promise<Buffer>) {
    const out: Buffer[] = new Array(pieces.length);
    let next = 0;
    await Promise.all(Array.from({length: Math.min(PARALLEL_REQUESTS, pieces.length)}, async () => {
        while (next < pieces.length) {
            const index = next++;
            out[index] = await speak(pieces[index]);
        }
    }));
    // MP3 is a stream of frames: the pieces play back to back when joined.
    return Buffer.concat(out);
}

/** One provider for the whole reading, so the voice never changes mid-article. */
async function synthesize(text: string, voice: string): Promise<{mp3: Buffer; provider: "google" | "openai"}> {
    const pieces = splitNarrationText(text);
    if (!pieces.length) throw new Error("Nothing to read.");
    const failures: string[] = [];
    const googleKey = process.env.GOOGLE_TTS_API_KEY?.trim();
    if (googleKey) {
        try {
            return {mp3: await voicePieces(pieces, (piece) => googlePiece(piece, voice, googleKey)), provider: "google"};
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        }
    }
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) {
        try {
            // OpenAI takes up to 4,096 characters per request.
            const openaiPieces = splitNarrationText(text, 3_800);
            return {mp3: await voicePieces(openaiPieces, (piece) => openaiPiece(piece, openaiKey)), provider: "openai"};
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        }
    }
    throw new Error(`No AI voice available — ${failures.join("; ") || "set GOOGLE_TTS_API_KEY or OPENAI_API_KEY"}`);
}

/** The saved reading, or null when this text has not been voiced yet. */
export async function findCloudNarration(text: string, locale: string): Promise<CloudNarration | null> {
    const path = narrationCachePath(text, narrationVoice(locale));
    return await isSaved(path) ? {url: narrationPublicUrl(path), cached: true, provider: "cache"} : null;
}

const inFlight = new Map<string, Promise<CloudNarration>>();

/** Voices and saves a reading. Two readers asking at once share one synthesis. */
export function createCloudNarration(text: string, locale: string): Promise<CloudNarration> {
    const path = narrationCachePath(text, narrationVoice(locale));
    const running = inFlight.get(path);
    if (running) return running;
    const job = (async () => {
        const {mp3, provider} = await synthesize(text, narrationVoice(locale));
        await upload(path, mp3);
        return {url: narrationPublicUrl(path), cached: false, provider};
    })().finally(() => inFlight.delete(path));
    inFlight.set(path, job);
    return job;
}
