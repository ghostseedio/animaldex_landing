import {spawn} from "node:child_process";
import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {AI_CLIP_SECONDS, type CardSpec, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, type TimelineEntry} from "@/lib/content-video/plan";

// The edit, in ffmpeg (installed in the Docker runner stage): one silent
// segment per scene — a slow push-in/out across a photo, or an AI clip
// fitted to the line it plays under — concatenated, then one final pass that
// lays the voiceover under it, burns in the captions (libass) and the logo,
// and normalises loudness to the -14 LUFS the short-video feeds use.

export type SceneVisual =
    | {type: "image"; path: string; focusX: number}
    | {type: "clip"; path: string; seconds?: number}
    | {type: "card"; card: CardSpec; left: string; right: string};

type RenderInput = {
    dir: string;
    timeline: TimelineEntry[];
    /** One visual per non-end timeline entry, in order. */
    visuals: SceneVisual[];
    /** Background of the end card: a blog photo, blurred. */
    endImagePath: string;
    /** Voiceover line per timeline entry (end card included), 16-bit mono WAV. */
    lines: Buffer[];
    assPath: string;
    fontsDir: string;
    logoPath: string;
    /** Instrumental bed, ducked under the voice; none for a voice-only mix. */
    musicPath?: string | null;
};

function ffmpegBinary() {
    return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

/** Runs ffmpeg at low CPU priority (it shares the box with the web server). */
export function runFfmpeg(args: string[], timeoutMs = 10 * 60_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const useNice = process.platform !== "win32" && process.env.CONTENT_VIDEO_NICE !== "0";
        const command = useNice ? "nice" : ffmpegBinary();
        const fullArgs = useNice ? ["-n", "15", ffmpegBinary(), "-hide_banner", "-loglevel", "error", "-y", ...args] : ["-hide_banner", "-loglevel", "error", "-y", ...args];
        const child = spawn(command, fullArgs, {stdio: ["ignore", "ignore", "pipe"]});
        let stderr = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
        child.stderr.on("data", (chunk) => {
            stderr = (stderr + chunk.toString()).slice(-4000);
        });
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(new Error((error as NodeJS.ErrnoException).code === "ENOENT" ? "ffmpeg is not installed on the server" : error.message));
        });
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg ${signal ? `was killed (${signal})` : `exited ${code}`}: ${stderr.trim().split("\n").slice(-4).join(" ")}`));
        });
    });
}

function frames(seconds: number) {
    return Math.max(1, Math.round(seconds * VIDEO_FPS));
}

/** A photo cropped to 9:16 around `focusX` (0 left … 1 right) and resized to width × height. */
export async function portraitCrop(source: string | Buffer, focusX: number, width: number, height: number) {
    // Rotated first, so the crop is measured on the photo as it is seen.
    const {data, info} = await sharp(source).rotate().toBuffer({resolveWithObject: true});
    const target = 9 / 16;
    let crop = {left: 0, top: 0, width: info.width, height: info.height};
    if (info.width / info.height > target) {
        const cropWidth = Math.round(info.height * target);
        crop = {left: Math.round((info.width - cropWidth) * focusX), top: 0, width: cropWidth, height: info.height};
    } else if (info.width / info.height < target) {
        const cropHeight = Math.round(info.width / target);
        crop = {left: 0, top: Math.round((info.height - cropHeight) * 0.4), width: info.width, height: cropHeight};
    }
    return sharp(data).extract(crop).resize(width, height, {kernel: "lanczos3"});
}

/** A dark AnimalDex backdrop (SVG shapes only, no text, so no fonts are needed). */
function backdropSvg(width: number, height: number, variant: "studio" | "vs" | "pair") {
    const glow = (cx: number, cy: number, r: number, colour: string, opacity: number) =>
        `<radialGradient id="g${cx}${cy}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${colour}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></radialGradient>`;
    if (variant === "vs") {
        // Pokémon-style split arena: red corner left, blue corner right, a lime slash between.
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>
            <linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b0a10"/><stop offset="1" stop-color="#0b0b0f"/></linearGradient>
            <linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1f45"/><stop offset="1" stop-color="#0b0b0f"/></linearGradient>
            ${glow(width * 0.25, height * 0.38, width * 0.42, "#ff3b3b", 0.35)}${glow(width * 0.75, height * 0.38, width * 0.42, "#3b8bff", 0.35)}
        </defs>
        <rect width="${width}" height="${height}" fill="#0b0b0f"/>
        <polygon points="0,0 ${width * 0.56},0 ${width * 0.44},${height} 0,${height}" fill="url(#l)"/>
        <polygon points="${width * 0.56},0 ${width},0 ${width},${height} ${width * 0.44},${height}" fill="url(#r)"/>
        <rect width="${width}" height="${height}" fill="url(#g${width * 0.25}${height * 0.38})"/><rect width="${width}" height="${height}" fill="url(#g${width * 0.75}${height * 0.38})"/>
        <polygon points="${width * 0.545},0 ${width * 0.575},0 ${width * 0.455},${height} ${width * 0.425},${height}" fill="#a7f432" opacity="0.9"/>
        <rect y="${height * 0.53}" width="${width}" height="${height * 0.24}" fill="#000" opacity="0.45"/>
    </svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>
        <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1f14"/><stop offset="1" stop-color="#060807"/></linearGradient>
        ${glow(width / 2, height * 0.45, width * 0.7, "#a7f432", variant === "pair" ? 0.22 : 0.16)}
    </defs><rect width="${width}" height="${height}" fill="url(#b)"/><rect width="${width}" height="${height}" fill="url(#g${width / 2}${height * 0.45})"/></svg>`;
}

/** A cut-out (transparent) image fitted into a box, with a soft floor shadow. */
async function placeCutout(source: string, box: {left: number; top: number; width: number; height: number}) {
    const fitted = await sharp(source).rotate().resize(Math.round(box.width), Math.round(box.height), {fit: "inside"}).png().toBuffer({resolveWithObject: true});
    return {
        input: fitted.data,
        left: Math.round(box.left + (box.width - fitted.info.width) / 2),
        top: Math.round(box.top + (box.height - fitted.info.height))
    };
}

async function hasTransparency(source: string) {
    const meta = await sharp(source).metadata();
    if (!meta.hasAlpha) return false;
    const {channels} = await sharp(source).resize(64, 64, {fit: "fill"}).stats();
    return (channels[3]?.min ?? 255) < 200;
}

/**
 * Supersampled 2x, so the zoom's whole-pixel steps vanish when scaled back
 * down (no Ken Burns jitter). Species artwork (a cut-out) is shown whole on a
 * studio backdrop instead of being cropped.
 */
async function preparePortrait(source: string, focusX: number, out: string) {
    const width = VIDEO_WIDTH * 2;
    const height = VIDEO_HEIGHT * 2;
    if (await hasTransparency(source)) {
        const subject = await placeCutout(source, {left: width * 0.04, top: height * 0.24, width: width * 0.92, height: height * 0.5});
        await sharp(Buffer.from(backdropSvg(width, height, "studio"))).composite([subject]).jpeg({quality: 92}).toFile(out);
        return;
    }
    await (await portraitCrop(source, focusX, width, height)).jpeg({quality: 92}).toFile(out);
}

/** The VS card or the parents card: backdrop and artwork (the text is in the captions file). */
async function prepareCard(visual: Extract<SceneVisual, {type: "card"}>, out: string) {
    const width = VIDEO_WIDTH * 2;
    const height = VIDEO_HEIGHT * 2;
    const layers = visual.card.kind === "vs"
        ? [
            await placeCutout(visual.left, {left: width * 0.02, top: height * 0.2, width: width * 0.48, height: height * 0.31}),
            await placeCutout(visual.right, {left: width * 0.5, top: height * 0.2, width: width * 0.48, height: height * 0.31})
        ]
        : [
            await placeCutout(visual.left, {left: width * 0.02, top: height * 0.25, width: width * 0.46, height: height * 0.35}),
            await placeCutout(visual.right, {left: width * 0.52, top: height * 0.25, width: width * 0.46, height: height * 0.35})
        ];
    await sharp(Buffer.from(backdropSvg(width, height, visual.card.kind))).composite(layers).jpeg({quality: 92}).toFile(out);
}

/** Longer than this on one photo and the shot cuts to a tighter framing halfway (retention). */
const PUNCH_IN_AFTER_SECONDS = 4.5;

/** The hook's opening hit: a white flash and a short camera shake (with the punch-in zoom in the shot itself). */
const HOOK_FLASH = "fade=t=in:st=0:d=0.22:color=white";
const SHAKE_X = "+if(lt(on,14),18*sin(on*2.1),0)";
const SHAKE_Y = "+if(lt(on,14),12*cos(on*2.7),0)";

async function zoomShot(prepared: string, n: number, zoom: string, out: string, hook = false) {
    const shake = hook ? {x: SHAKE_X, y: SHAKE_Y} : {x: "", y: ""};
    await runFfmpeg([
        "-loop", "1", "-framerate", String(VIDEO_FPS), "-i", prepared,
        "-vf", `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)${shake.x}':y='ih/2-(ih/zoom/2)${shake.y}':d=${n}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS},setsar=1,format=yuv420p${hook ? `,${HOOK_FLASH}` : ""}`,
        "-frames:v", String(n),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-threads", "2", "-an", out
    ]);
}

/** A designed card, slowly pushing in; the hook card slams in. */
async function renderCardScene(visual: Extract<SceneVisual, {type: "card"}>, seconds: number, index: number, dir: string) {
    const prepared = path.join(dir, `card-${index}.jpg`);
    await prepareCard(visual, prepared);
    const n = frames(seconds);
    const out = path.join(dir, `segment-${String(index).padStart(2, "0")}.mp4`);
    const zoom = index === 0 ? `if(lt(on,9),1.25-0.025*on,1.03+0.04*(on/${n}))` : `1+0.05*(on/${n})`;
    await zoomShot(prepared, n, zoom, out, index === 0);
    return [out];
}

/** One or two silent shots of a photo; returns their files in order. */
async function renderImageScene(source: string, focusX: number, seconds: number, index: number, dir: string) {
    const prepared = path.join(dir, `still-${index}.jpg`);
    await preparePortrait(source, focusX, prepared);
    const n = frames(seconds);
    const base = path.join(dir, `segment-${String(index).padStart(2, "0")}`);
    if (index === 0) {
        // The hook: slams in from 135% in a third of a second, then keeps drifting.
        await zoomShot(prepared, n, `if(lt(on,10),1.35-0.025*on,1.10+0.06*sin(PI/2*on/${n}))`, `${base}.mp4`, true);
        return [`${base}.mp4`];
    }
    if (seconds <= PUNCH_IN_AFTER_SECONDS) {
        // Alternate push-in and pull-out so consecutive photos do not feel identical; eased, ~10%.
        const zoom = index % 2 === 0 ? `1+0.10*sin(PI/2*on/${n})` : `1.10-0.10*sin(PI/2*on/${n})`;
        await zoomShot(prepared, n, zoom, `${base}.mp4`);
        return [`${base}.mp4`];
    }
    // A slow push-in, then a hard cut to a tighter frame that keeps drifting in.
    const first = Math.round(n / 2);
    await zoomShot(prepared, first, `1+0.08*sin(PI/2*on/${first})`, `${base}a.mp4`);
    await zoomShot(prepared, n - first, `1.30+0.06*(on/${n - first})`, `${base}b.mp4`);
    return [`${base}a.mp4`, `${base}b.mp4`];
}

async function renderClipScene(source: string, seconds: number, out: string, clipSeconds = AI_CLIP_SECONDS, hook = false) {
    // A line longer than the clip slows it a little (up to 30%), then holds its last frame.
    const stretch = Math.min(Math.max(seconds / clipSeconds, 1), 1.3);
    const hold = Math.max(seconds - clipSeconds * stretch, 0) + 0.2;
    await runFfmpeg([
        "-i", source,
        "-vf", [
            `setpts=${stretch.toFixed(3)}*PTS`,
            `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos`,
            `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
            `fps=${VIDEO_FPS}`,
            `tpad=stop_mode=clone:stop_duration=${hold.toFixed(2)}`,
            // The hook clip punches in from 128% with a shake, behind a white flash.
            ...(hook ? [`zoompan=z='if(lt(on,10),1.28-0.028*on,1)':x='iw/2-(iw/zoom/2)${SHAKE_X}':y='ih/2-(ih/zoom/2)${SHAKE_Y}':d=1:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`] : []),
            "setsar=1",
            "format=yuv420p",
            ...(hook ? [HOOK_FLASH] : [])
        ].join(","),
        "-frames:v", String(frames(seconds)),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-threads", "2", "-an", out
    ]);
}

/** The end card: the photo blurred and darkened, the logo on top; its text comes from the captions. */
async function renderEndCard(source: string, logoPath: string, seconds: number, out: string, dir: string) {
    const background = await sharp(source).rotate()
        .resize(VIDEO_WIDTH, VIDEO_HEIGHT, {fit: "cover"})
        .blur(28)
        .modulate({brightness: 0.42, saturation: 0.8})
        .toBuffer();
    const logo = await sharp(logoPath).resize({width: 720}).toBuffer();
    const logoMeta = await sharp(logo).metadata();
    const card = path.join(dir, "end-card.jpg");
    await sharp(background)
        .composite([{input: logo, left: Math.round((VIDEO_WIDTH - 720) / 2), top: Math.round(VIDEO_HEIGHT * 0.26 - (logoMeta.height ?? 160) / 2)}])
        .jpeg({quality: 92})
        .toFile(card);
    const n = frames(seconds);
    await runFfmpeg([
        "-loop", "1", "-framerate", String(VIDEO_FPS), "-i", card,
        "-vf", "setsar=1,format=yuv420p",
        "-frames:v", String(n),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-threads", "2", "-an", out
    ]);
}

type WavInfo = {sampleRate: number; channels: number; bits: number; data: Buffer};

function readWav(wav: Buffer): WavInfo {
    let offset = 12;
    let info: Omit<WavInfo, "data"> | null = null;
    while (offset + 8 <= wav.length) {
        const id = wav.toString("ascii", offset, offset + 4);
        let size = wav.readUInt32LE(offset + 4);
        if (id === "fmt ") info = {channels: wav.readUInt16LE(offset + 10), sampleRate: wav.readUInt32LE(offset + 12), bits: wav.readUInt16LE(offset + 22)};
        if (id === "data") {
            if (size === 0 || size === 0xFFFFFFFF || offset + 8 + size > wav.length) size = wav.length - offset - 8;
            if (!info) throw new Error("WAV has no fmt chunk");
            return {...info, data: wav.subarray(offset + 8, offset + 8 + size)};
        }
        offset += 8 + size + (size % 2);
    }
    throw new Error("WAV has no data chunk");
}

function wavHeader(dataBytes: number, sampleRate: number) {
    const header = Buffer.alloc(44);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(36 + dataBytes, 4);
    header.write("WAVE", 8, "ascii");
    header.write("fmt ", 12, "ascii");
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36, "ascii");
    header.writeUInt32LE(dataBytes, 40);
    return header;
}

/**
 * One voiceover track: each line placed at its scene's start. Lines from a
 * different voice (or rate) are converted to the first line's format first.
 */
async function buildVoiceTrack(lines: Buffer[], timeline: TimelineEntry[], dir: string) {
    const parsed = lines.map(readWav);
    const sampleRate = parsed[0]?.sampleRate ?? 24000;
    const pcm: Buffer[] = [];
    for (let index = 0; index < parsed.length; index += 1) {
        const line = parsed[index];
        if (line.sampleRate === sampleRate && line.channels === 1 && line.bits === 16) {
            pcm.push(line.data);
            continue;
        }
        const input = path.join(dir, `line-${index}.wav`);
        const output = path.join(dir, `line-${index}.pcm`);
        await writeFile(input, lines[index]);
        await runFfmpeg(["-i", input, "-ar", String(sampleRate), "-ac", "1", "-f", "s16le", output]);
        pcm.push(await readFile(output));
    }
    const end = timeline.at(-1)!;
    const totalSamples = Math.ceil((end.start + end.duration) * sampleRate);
    const track = Buffer.alloc(totalSamples * 2);
    timeline.forEach((entry, index) => {
        const data = pcm[index];
        if (!data) return;
        const at = Math.round(entry.start * sampleRate) * 2;
        data.copy(track, at, 0, Math.min(data.length, track.length - at));
    });
    const out = path.join(dir, "voice.wav");
    await writeFile(out, Buffer.concat([wavHeader(track.length, sampleRate), track]));
    return out;
}

const LOUDNESS = {I: -14, TP: -1.5, LRA: 11};
/** Evens out the voice first: without it the peaks stop loudnorm short of -14. */
const VOICE_COMPRESSOR = "acompressor=threshold=0.1:ratio=3:attack=5:release=120:makeup=1.5";

/**
 * First loudnorm pass over the mix: its measured loudness, so the final
 * pass can normalise linearly and land on -14 LUFS (single-pass loudnorm
 * undershoots on speech with pauses).
 */
function measureLoudness(file: string): Promise<Record<string, string> | null> {
    return new Promise((resolve) => {
        const child = spawn(ffmpegBinary(), ["-hide_banner", "-nostats", "-i", file, "-af", `loudnorm=I=${LOUDNESS.I}:TP=${LOUDNESS.TP}:LRA=${LOUDNESS.LRA}:print_format=json`, "-f", "null", "-"], {stdio: ["ignore", "ignore", "pipe"]});
        let stderr = "";
        child.stderr.on("data", (chunk) => {
            stderr = (stderr + chunk.toString()).slice(-8000);
        });
        child.on("error", () => resolve(null));
        child.on("close", () => {
            const json = stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1);
            try {
                const parsed = JSON.parse(json) as Record<string, string>;
                resolve(parsed.input_i && Number.isFinite(Number(parsed.input_i)) ? parsed : null);
            } catch {
                resolve(null);
            }
        });
    });
}

/** Bed level under the voice (~-16 dB), and how much further it dips while someone speaks. */
const MUSIC_GAIN = 0.16;

/**
 * Voice (compressed) plus the music bed, looped to length, faded in and out,
 * and ducked by the voice through a sidechain compressor, as one stereo WAV.
 */
export type SoundEffects = {impacts: number[]; whooshes: number[]};

/** Synthesised in ffmpeg, so there are no files to license: a sub-bass hit with a noise crack, and a pink-noise swish. */
const IMPACT = "aevalsrc=exprs='0.9*sin(2*PI*(42+70*exp(-9*t))*t)*exp(-3.2*t)+0.35*(2*random(0)-1)*exp(-22*t)':s=48000:d=1.4";
const WHOOSH = "anoisesrc=d=0.5:c=pink:a=0.6:r=48000,highpass=f=300,lowpass=f=6000,afade=t=in:st=0:d=0.32:curve=exp,afade=t=out:st=0.32:d=0.18";

/** Where the hits go: the opening frame, every cut, and the moments a format marks (VS slam, the winner). */
export function soundEffectsFor(timeline: TimelineEntry[]): SoundEffects {
    const impacts = [0];
    const whooshes: number[] = [];
    timeline.forEach((entry, index) => {
        if (index > 0) whooshes.push(Math.max(entry.start - 0.3, 0));
        if (entry.card?.kind === "vs") impacts.push(entry.start + 0.15);
        if (entry.overlayStyle === "winner") impacts.push(Math.max(entry.start + 0.5, entry.start + entry.duration - 2.4));
    });
    return {impacts: Array.from(new Set(impacts.map((value) => Math.round(value * 100) / 100))), whooshes};
}

async function buildMix(voice: string, music: string | null | undefined, seconds: number, dir: string, sfx: SoundEffects) {
    const out = path.join(dir, "mix.wav");
    const inputs = ["-i", voice, ...(music ? ["-stream_loop", "-1", "-i", music] : [])];
    const graph = [`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,${VOICE_COMPRESSOR}${music ? ",asplit=2[vo][vk]" : "[vo]"}`];
    const mixInputs = ["[vo]"];
    if (music) {
        const fadeOutAt = Math.max(seconds - 1.8, 0);
        graph.push(`[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${MUSIC_GAIN},afade=t=in:d=0.4,afade=t=out:st=${fadeOutAt.toFixed(2)}:d=1.8[mu]`);
        graph.push("[mu][vk]sidechaincompress=threshold=0.02:ratio=5:attack=20:release=400[md]");
        mixInputs.push("[md]");
    }
    const effects = [
        ...sfx.impacts.map((at) => ({source: IMPACT, at, gain: 0.85})),
        ...sfx.whooshes.map((at) => ({source: WHOOSH, at, gain: 0.22}))
    ].filter((effect) => effect.at < seconds - 0.2);
    effects.forEach((effect, index) => {
        const delay = Math.round(effect.at * 1000);
        graph.push(`${effect.source},aformat=sample_rates=48000:channel_layouts=stereo,volume=${effect.gain},adelay=${delay}|${delay}[fx${index}]`);
        mixInputs.push(`[fx${index}]`);
    });
    graph.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=first:normalize=0[out]`);
    await runFfmpeg([...inputs, "-filter_complex", graph.join(";"), "-map", "[out]", "-t", seconds.toFixed(2), out]);
    return out;
}

/** Seconds of audio actually in a file (decoded sample count / rate), or null if it cannot be read. */
function audioSeconds(file: string): Promise<number | null> {
    return new Promise((resolve) => {
        const child = spawn(ffmpegBinary(), ["-hide_banner", "-nostats", "-i", file, "-map", "0:a", "-af", "aresample=48000,astats=measure_perchannel=none", "-f", "null", "-"], {stdio: ["ignore", "ignore", "pipe"]});
        let stderr = "";
        child.stderr.on("data", (chunk) => {
            stderr = (stderr + chunk.toString()).slice(-6000);
        });
        child.on("error", () => resolve(null));
        child.on("close", () => {
            const samples = Number(stderr.match(/Number of samples:\s*(\d+)/)?.[1]);
            resolve(Number.isFinite(samples) && samples > 0 ? samples / 48000 : null);
        });
    });
}

/** Escapes a path for use inside an ffmpeg filter argument. */
function filterPath(value: string) {
    return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function renderVideo(input: RenderInput): Promise<{videoPath: string; posterPath: string; seconds: number}> {
    const {dir, timeline, visuals} = input;
    const segments: string[] = [];
    for (let index = 0; index < timeline.length; index += 1) {
        const entry = timeline[index];
        const out = path.join(dir, `segment-${String(index).padStart(2, "0")}.mp4`);
        if (entry.kind === "end") {
            await renderEndCard(input.endImagePath, input.logoPath, entry.duration, out, dir);
            segments.push(out);
            continue;
        }
        const visual = visuals[index];
        if (!visual) throw new Error(`Scene ${index + 1} has no visual`);
        if (visual.type === "card") {
            segments.push(...await renderCardScene(visual, entry.duration, index, dir));
        } else if (visual.type === "clip") {
            await renderClipScene(visual.path, entry.duration, out, visual.seconds, index === 0);
            segments.push(out);
        } else {
            segments.push(...await renderImageScene(visual.path, visual.focusX, entry.duration, index, dir));
        }
    }

    const list = path.join(dir, "segments.txt");
    await writeFile(list, segments.map((segment) => `file '${segment.replace(/'/g, "'\\''")}'`).join("\n"));
    const silent = path.join(dir, "silent.mp4");
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", silent]);

    const voiceTrack = await buildVoiceTrack(input.lines, timeline, dir);
    const totalSeconds = timeline.at(-1)!.start + timeline.at(-1)!.duration;
    const voice = await buildMix(voiceTrack, input.musicPath, totalSeconds, dir, soundEffectsFor(timeline));
    const measured = await measureLoudness(voice);
    const loudnorm = `loudnorm=I=${LOUDNESS.I}:TP=${LOUDNESS.TP}:LRA=${LOUDNESS.LRA}` + (measured
        ? `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
        : "");
    const end = timeline.at(-1)!;
    const total = end.start + end.duration;
    // The logo rides along the top until the end card, which carries its own.
    const logo = path.join(dir, "logo-small.png");
    await sharp(input.logoPath).resize({width: 300}).ensureAlpha(0.88).png().toFile(logo);
    // The audio is mastered on its own, sample-exact. Normalised inside the video
    // pass it lost ~3 s of samples over a 48 s video while keeping its
    // timestamps, so the voice drifted ahead of the captions scene by scene.
    const master = path.join(dir, "master.wav");
    await runFfmpeg(["-i", voice, "-af", `${loudnorm},aresample=48000,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo`, "-c:a", "pcm_s16le", "-t", total.toFixed(2), master]);

    const videoPath = path.join(dir, "final.mp4");
    await runFfmpeg([
        "-i", silent,
        "-i", master,
        // Looped: a one-frame image input ends after its first frame, and the overlay can drop it mid-video.
        "-loop", "1", "-framerate", String(VIDEO_FPS), "-i", logo,
        "-filter_complex", [
            `[2:v]format=rgba,colorchannelmixer=aa=0.85[logo]`,
            `[0:v][logo]overlay=x=(W-w)/2:y=110:shortest=1:enable='lt(t,${end.start.toFixed(2)})'[branded]`,
            `[branded]ass='${filterPath(input.assPath)}':fontsdir='${filterPath(input.fontsDir)}',format=yuv420p[v]`
        ].join(";"),
        "-map", "[v]", "-map", "1:a",
        // One thread and veryfast: on the 2-vCPU, 2 GB production VM a medium/2-thread encode starved the web
        // server for 11+ minutes until the health check restarted the container (502s, Oct 10 2026).
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-maxrate", "8M", "-bufsize", "16M", "-profile:v", "high", "-threads", "1",
        "-r", String(VIDEO_FPS),
        "-c:a", "aac", "-b:a", "160k",
        "-t", total.toFixed(2),
        "-movflags", "+faststart",
        videoPath
    ], 20 * 60_000);

    // Never ship a video whose sound has drifted from its picture and captions.
    const audio = await audioSeconds(videoPath);
    if (audio !== null && Math.abs(audio - total) > 0.1) {
        throw new Error(`The finished audio is ${audio.toFixed(2)}s for a ${total.toFixed(2)}s video; the voice would drift from the captions`);
    }

    // The poster is a frame from the hook, with its headline already on screen.
    const posterPath = path.join(dir, "poster.jpg");
    await runFfmpeg(["-ss", "1.0", "-i", videoPath, "-frames:v", "1", "-q:v", "3", posterPath]);
    return {videoPath, posterPath, seconds: total};
}
