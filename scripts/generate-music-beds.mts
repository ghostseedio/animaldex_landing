// Generates the blog-video music beds listed in src/lib/content-video/music.ts
// into public/video-music/: ElevenLabs Music (ELEVENLABS_API_KEY, paid plan)
// first, Google's Lyria (GEMINI_API_KEY) when ElevenLabs fails or has no key.
// Skips tracks that already exist; pass --force to regenerate, --lyria to skip
// ElevenLabs, or track ids to make only those. Afterwards, level them:
// ffmpeg -i in.mp3 -af loudnorm=I=-14:TP=-1.5:LRA=11 -b:a 128k out.mp3
//
// Run: npx tsx --env-file=.env scripts/generate-music-beds.mts [--force] [--lyria] [suspense-1 …]
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {MUSIC_TRACKS} from "../src/lib/content-video/music.ts";

const key = process.env.GEMINI_API_KEY?.trim();
const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
if (!key && !elevenKey) throw new Error("Set ELEVENLABS_API_KEY or GEMINI_API_KEY");
const model = process.env.MUSIC_BED_MODEL?.trim() || "lyria-3.5";
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = new Set(args.filter((arg) => !arg.startsWith("--")));
const outDir = path.join(process.cwd(), "public", "video-music");
mkdirSync(outDir, {recursive: true});

async function elevenLabs(prompt: string): Promise<Buffer> {
    const response = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", {
        method: "POST",
        headers: {"xi-api-key": elevenKey!, "Content-Type": "application/json"},
        body: JSON.stringify({prompt, music_length_ms: 62_000, model_id: "music_v1", force_instrumental: true}),
        signal: AbortSignal.timeout(300_000)
    });
    if (!response.ok) throw new Error(`elevenlabs ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return Buffer.from(await response.arrayBuffer());
}

async function generate(prompt: string): Promise<{audio: Buffer; provider: string}> {
    if (elevenKey && !args.includes("--lyria")) {
        try {
            return {audio: await elevenLabs(prompt), provider: "elevenlabs"};
        } catch (error) {
            console.warn(`  elevenlabs failed, trying lyria: ${error instanceof Error ? error.message : error}`);
        }
    }
    if (!key) throw new Error("no GEMINI_API_KEY for the Lyria fallback");
    return {audio: await lyria(prompt), provider: "lyria"};
}

async function lyria(prompt: string): Promise<Buffer> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key!)}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({contents: [{role: "user", parts: [{text: prompt}]}], generationConfig: {responseModalities: ["AUDIO"]}}),
        signal: AbortSignal.timeout(300_000)
    });
    if (!response.ok) throw new Error(`lyria ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const body = await response.json() as {candidates?: Array<{content?: {parts?: Array<{inlineData?: {mimeType?: string; data?: string}}>}}>};
    const audio = body.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!audio?.data) throw new Error("lyria returned no audio");
    return Buffer.from(audio.data, "base64");
}

const tracks = MUSIC_TRACKS.filter((track) => (only.size ? only.has(track.id) : true));
// Two at a time: each call takes about a minute, and ElevenLabs allows two concurrent requests on the current plan.
for (let index = 0; index < tracks.length; index += 2) {
    await Promise.all(tracks.slice(index, index + 2).map(async (track) => {
        const file = path.join(outDir, `${track.id}.mp3`);
        if (existsSync(file) && !force) return console.log(`skip ${track.id}`);
        try {
            const {audio, provider} = await generate(track.prompt);
            writeFileSync(file, audio);
            console.log(`made ${track.id} with ${provider} (${Math.round(audio.length / 1024)} KB)`);
        } catch (error) {
            console.error(`FAILED ${track.id}: ${error instanceof Error ? error.message : error}`);
        }
    }));
}
