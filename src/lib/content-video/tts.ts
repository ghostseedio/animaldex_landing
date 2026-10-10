// The voiceover, one line at a time: Google Cloud TTS (an HD voice), else
// OpenAI. Each line comes back as 16-bit mono WAV, so its exact length is in
// the header — that is what times the scenes and the captions.

export type SpokenLine = {wav: Buffer; seconds: number; provider: "google" | "openai"};

/** Duration of a PCM WAV from its header (fmt + data chunks). */
export function wavSeconds(wav: Buffer): number {
    if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
        throw new Error("Not a WAV file");
    }
    let offset = 12;
    let byteRate = 0;
    while (offset + 8 <= wav.length) {
        const id = wav.toString("ascii", offset, offset + 4);
        let size = wav.readUInt32LE(offset + 4);
        if (id === "fmt ") byteRate = wav.readUInt32LE(offset + 16);
        if (id === "data") {
            // Streamed WAVs (OpenAI) can carry a placeholder size: use what is actually there.
            if (size === 0 || size === 0xFFFFFFFF || offset + 8 + size > wav.length) size = wav.length - offset - 8;
            if (!byteRate) throw new Error("WAV has no fmt chunk");
            return size / byteRate;
        }
        offset += 8 + size + (size % 2);
    }
    throw new Error("WAV has no data chunk");
}

async function googleLine(text: string, key: string): Promise<Buffer> {
    const voice = process.env.CONTENT_VIDEO_TTS_VOICE?.trim() || "en-US-Chirp3-HD-Charon";
    const languageCode = voice.split("-").slice(0, 2).join("-");
    const call = (audioConfig: Record<string, unknown>) => fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({input: {text}, voice: {languageCode, name: voice}, audioConfig}),
        signal: AbortSignal.timeout(60_000)
    });
    const base = {audioEncoding: "LINEAR16", sampleRateHertz: 24000};
    const rate = Number(process.env.CONTENT_VIDEO_TTS_RATE ?? "1.08");
    let response = await call(Number.isFinite(rate) && rate !== 1 ? {...base, speakingRate: rate} : base);
    // Not every voice takes a speaking rate; fall back to its natural pace.
    if (response.status === 400) response = await call(base);
    if (!response.ok) throw new Error(`google_tts_${response.status}:${(await response.text()).slice(0, 200)}`);
    const body = await response.json() as {audioContent?: string};
    if (!body.audioContent) throw new Error("google_tts_empty");
    return Buffer.from(body.audioContent, "base64");
}

async function openaiLine(text: string, key: string): Promise<Buffer> {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
        body: JSON.stringify({
            model: process.env.CONTENT_VIDEO_OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
            voice: process.env.CONTENT_VIDEO_OPENAI_TTS_VOICE?.trim() || "ash",
            input: text,
            instructions: "Energetic, confident short-form video narrator. Brisk pace, clear emphasis, warm and curious; never shouty.",
            response_format: "wav"
        }),
        signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) throw new Error(`openai_tts_${response.status}:${(await response.text()).slice(0, 200)}`);
    return Buffer.from(await response.arrayBuffer());
}

/**
 * Speaks one line. A provider that fails is skipped for the rest of the
 * video (`state.skip`), so one voice is not swapped for another mid-video
 * unless the first stops working.
 */
export async function speakLine(text: string, state: {skip: Set<string>; failures: string[]}): Promise<SpokenLine> {
    const googleKey = process.env.GOOGLE_TTS_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (googleKey && !state.skip.has("google")) {
        try {
            const wav = await googleLine(text, googleKey);
            return {wav, seconds: wavSeconds(wav), provider: "google"};
        } catch (error) {
            state.skip.add("google");
            state.failures.push(error instanceof Error ? error.message : String(error));
        }
    }
    if (openaiKey && !state.skip.has("openai")) {
        try {
            const wav = await openaiLine(text, openaiKey);
            return {wav, seconds: wavSeconds(wav), provider: "openai"};
        } catch (error) {
            state.skip.add("openai");
            state.failures.push(error instanceof Error ? error.message : String(error));
        }
    }
    throw new Error(`No voice available — ${state.failures.join("; ") || "set GOOGLE_TTS_API_KEY or OPENAI_API_KEY"}`);
}
