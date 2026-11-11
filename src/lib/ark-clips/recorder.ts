import {spawn} from "node:child_process";
import {existsSync, readdirSync} from "node:fs";
import {mkdir, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type {ArkDirectorFrame, ArkDirectorInfo} from "@/ark-scene/director";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkClipTimeline} from "@/lib/ark-clips/captions";
import {arkOverlays, overlayFilter, renderArkOverlay} from "@/lib/ark-clips/overlays";
import {readArkFieldGuide} from "@/lib/ark-clips/field-guide";
import {CLIP_FPS, CLIP_HEIGHT, CLIP_WIDTH, END_SECONDS, MAX_CLIP_SECONDS, MIN_CLIP_SECONDS, pickArkSubject, planArkShot, type ArkMarks, type ArkShotKind, type ArkShotPlan} from "@/lib/ark-clips/shots";
import {pickMusicTrack, musicTrackPath, type MusicMood} from "@/lib/content-video/music";
import {decodeArkEvents} from "@/lib/ark-life";

/**
 * The Ark clip recorder (Node, on a machine with a GPU): opens `/ark?record=1`
 * in headless Chromium, plans the shot from the Ark it was given, has the
 * director film it frame by frame, then burns in the captions, the logo and
 * a music bed with ffmpeg (1080×1920, H.264, 30 fps, AAC).
 *
 * The page's own data decides what the clip shows: the live Ark unless
 * `fixture` (then the clip is a sample, named `sample-*`, never uploaded).
 */

export type RecordOptions = {
    shot: ArkShotKind;
    /** The site that serves `/ark?record=1` (a local `next dev`, or `next start` with ARK_RECORD_ENABLED=1). */
    baseUrl: string;
    fixture: boolean;
    species?: string | null;
    outDir: string;
    /** File name stem; default: the plan's slug. */
    name?: string | null;
    /** A Chromium/Chrome binary; default: ARK_CHROMIUM, then Playwright's cached Chromium, then Chrome. */
    chromium?: string | null;
    log?: (line: string) => void;
};

export type RecordedClip = {
    plan: ArkShotPlan;
    marks: ArkMarks;
    videoPath: string;
    posterPath: string;
    seconds: number;
    probe: ClipProbe;
};

export type ClipProbe = {width: number; height: number; fps: number; seconds: number; videoCodec: string; audioCodec: string | null; bytes: number};

/** Playwright's own Chromium, when one is cached (`npx playwright install chromium`). */
function cachedChromium(): string | null {
    const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), "Library", "Caches", "ms-playwright"), path.join(os.homedir(), ".cache", "ms-playwright")].filter((root): root is string => Boolean(root));
    for (const root of roots) {
        if (!existsSync(root)) continue;
        const builds = readdirSync(root).filter((name) => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
        for (const build of builds) {
            const candidates = [
                path.join(root, build, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
                path.join(root, build, "chrome-mac", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"),
                path.join(root, build, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
                path.join(root, build, "chrome-linux64", "chrome"),
                path.join(root, build, "chrome-linux", "chrome")
            ];
            const found = candidates.find((candidate) => existsSync(candidate));
            if (found) return found;
        }
    }
    return null;
}

function run(command: string, args: string[], input?: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {stdio: [input ? "pipe" : "ignore", "pipe", "pipe"]});
        let out = "";
        let err = "";
        child.stdout?.on("data", (chunk) => (out += chunk));
        child.stderr?.on("data", (chunk) => (err += chunk));
        child.on("error", reject);
        child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${command} exited ${code}: ${err.trim().split("\n").slice(-4).join(" ")}`))));
    });
}

const ffmpeg = () => process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const ffprobe = () => process.env.FFPROBE_PATH?.trim() || "ffprobe";

export async function probeClip(file: string): Promise<ClipProbe> {
    const raw = await run(ffprobe(), ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size", "-of", "json", file]);
    const parsed = JSON.parse(raw) as {streams: Array<{codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string}>; format: {duration: string; size: string}};
    const video = parsed.streams.find((stream) => stream.codec_type === "video");
    const audio = parsed.streams.find((stream) => stream.codec_type === "audio");
    const [num, den] = (video?.r_frame_rate ?? "0/1").split("/").map(Number);
    return {
        width: video?.width ?? 0,
        height: video?.height ?? 0,
        fps: den ? num / den : 0,
        seconds: Number(parsed.format.duration),
        videoCodec: video?.codec_name ?? "",
        audioCodec: audio?.codec_name ?? null,
        bytes: Number(parsed.format.size)
    };
}

/** The finished clip meets the brief: 1080×1920, H.264, 30 fps, 15–45 s. */
export function clipProblems(probe: ClipProbe): string[] {
    const problems: string[] = [];
    if (probe.width !== CLIP_WIDTH || probe.height !== CLIP_HEIGHT) problems.push(`${probe.width}×${probe.height}, not ${CLIP_WIDTH}×${CLIP_HEIGHT}`);
    if (probe.videoCodec !== "h264") problems.push(`video is ${probe.videoCodec}, not h264`);
    if (Math.abs(probe.fps - CLIP_FPS) > 0.01) problems.push(`${probe.fps} fps, not ${CLIP_FPS}`);
    if (probe.seconds < MIN_CLIP_SECONDS - 0.05 || probe.seconds > MAX_CLIP_SECONDS + 0.05) problems.push(`${probe.seconds.toFixed(2)} s, outside ${MIN_CLIP_SECONDS}–${MAX_CLIP_SECONDS} s`);
    if (probe.audioCodec !== "aac") problems.push("no AAC audio track");
    return problems;
}

function moodOf(plan: ArkShotPlan): MusicMood {
    return plan.kind === "meal_chase" ? "intense" : plan.kind === "day_to_night" ? "mystery" : "wonder";
}

/** The little of Playwright the recorder uses (its own types need a newer TypeScript than the site's). */
type Page = {
    on: (event: "console", listener: (message: {type: () => string; text: () => string}) => void) => void;
    goto: (url: string, options: {waitUntil: "domcontentloaded"; timeout: number}) => Promise<unknown>;
    waitForFunction: (predicate: () => boolean, arg: undefined, options: {timeout: number; polling: number}) => Promise<unknown>;
    evaluate: <R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A) => Promise<R>;
};
type Playwright = {
    chromium: {
        launch: (options: {executablePath?: string; channel?: string; headless: boolean; args: string[]}) => Promise<{
            newPage: (options: {viewport: {width: number; height: number}; deviceScaleFactor: number}) => Promise<Page>;
            close: () => Promise<void>;
        }>;
    };
};

/** playwright-core, a dev dependency, loaded only when a clip is recorded. */
async function loadPlaywright(): Promise<Playwright> {
    const name = "playwright-core";
    const loaded = await import(name) as Playwright & {default?: Playwright};
    return loaded.chromium ? loaded : loaded.default!;
}

export async function recordArkClip(options: RecordOptions): Promise<RecordedClip> {
    const log = options.log ?? (() => undefined);
    const {chromium} = await loadPlaywright();
    const executablePath = options.chromium || process.env.ARK_CHROMIUM?.trim() || cachedChromium();
    const browser = await chromium.launch({
        ...(executablePath ? {executablePath} : {channel: "chrome"}),
        headless: true,
        // WebGL on the machine's GPU (ANGLE on Metal on a Mac); SwiftShader is far too slow at 1080×1920.
        args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "--autoplay-policy=no-user-gesture-required"]
    });
    const work = path.join(options.outDir, `.work-${options.shot}-${Date.now().toString(36)}`);
    await mkdir(work, {recursive: true});
    try {
        const page = await browser.newPage({viewport: {width: CLIP_WIDTH, height: CLIP_HEIGHT}, deviceScaleFactor: 1});
        page.on("console", (message) => {
            if (message.type() === "error" || message.text().startsWith("[ark]")) log(`page: ${message.text().slice(0, 300)}`);
        });
        const url = new URL("/ark", options.baseUrl);
        url.searchParams.set("record", "1");
        if (options.fixture) url.searchParams.set("fixture", "1");
        log(`opening ${url.toString()}`);
        await page.goto(url.toString(), {waitUntil: "domcontentloaded", timeout: 240_000});
        await page.waitForFunction(() => Boolean((window as unknown as {__arkDirector?: unknown}).__arkDirector), undefined, {timeout: 240_000, polling: 250});

        const info = await page.evaluate(() => (window as unknown as {__arkDirector: {info: () => ArkDirectorInfo}}).__arkDirector.info());
        if (info.fixture !== options.fixture) throw new Error(info.fixture ? "The page served the fixture Ark (a development server asked with ?fixture=) but a live clip was asked for" : "The page served the live Ark but --fixture was asked for");
        const snapshot = decodeArkSnapshot(info.snapshot);
        if (!snapshot) throw new Error("The page's Ark snapshot did not decode");
        const events = decodeArkEvents(info.events, snapshot);

        let fieldGuide = null;
        if (options.shot === "meet") {
            const subject = pickArkSubject(snapshot, "meet", options.species);
            if (subject) {
                fieldGuide = await readArkFieldGuide(subject.species_profile_id);
                log(`field guide for ${subject.name}: ${fieldGuide ? "found" : "none"}`);
            }
        }
        const plan = planArkShot(options.shot, {snapshot, events, fieldGuide, fixture: info.fixture, now: new Date(), species: options.species});
        log(`plan: ${plan.slug} (${plan.dataSource}), ${plan.cues.length} captions`);

        const prepared = await page.evaluate((direction) => (window as unknown as {__arkDirector: {prepare: (d: unknown) => Promise<{models: number}>}}).__arkDirector.prepare(direction), plan.direction);
        log(`ready: ${prepared.models} models loaded`);

        // The frames, straight into an intermediate encode (near-lossless; the final pass adds the words and the sound).
        const rawPath = path.join(work, "raw.mp4");
        const encoder = spawn(ffmpeg(), ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(CLIP_FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-pix_fmt", "yuv420p", "-r", String(CLIP_FPS), rawPath], {stdio: ["pipe", "ignore", "pipe"]});
        let encoderError = "";
        encoder.stderr.on("data", (chunk) => (encoderError += chunk));
        const encoded = new Promise<void>((resolve, reject) => {
            encoder.on("error", reject);
            encoder.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg (frames) exited ${code}: ${encoderError.trim().slice(-400)}`))));
        });
        const started = Date.now();
        let frames = 0;
        for (;;) {
            const frame = await page.evaluate(() => (window as unknown as {__arkDirector: {frame: () => ArkDirectorFrame}}).__arkDirector.frame());
            const comma = frame.image.indexOf(",");
            if (comma < 0) throw new Error(`Frame ${frame.index} came back empty`);
            const bytes = Buffer.from(frame.image.slice(comma + 1), "base64");
            if (!encoder.stdin.write(bytes)) await new Promise((resolve) => encoder.stdin.once("drain", resolve));
            frames += 1;
            if (frames % 90 === 0) log(`  ${frames} frames (${(frames / CLIP_FPS).toFixed(1)} s of video, ${((Date.now() - started) / 1000).toFixed(0)} s so far)`);
            if (frame.done) break;
        }
        encoder.stdin.end();
        await encoded;
        const marks = await page.evaluate(() => (window as unknown as {__arkDirector: {marks: () => ArkMarks}}).__arkDirector.marks());
        log(`filmed ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s; act ${marks.act.toFixed(2)}–${marks.actEnd.toFixed(2)} s, end card at ${marks.end.toFixed(2)} s`);

        // The words (one transparent PNG per caption), the logo, the end card's dimming and the music bed.
        const overlays = arkOverlays(plan, marks);
        const overlayFiles: string[] = [];
        for (let index = 0; index < overlays.length; index += 1) {
            const file = path.join(work, `overlay-${index}.png`);
            await writeFile(file, await renderArkOverlay(overlays[index]));
            overlayFiles.push(file);
        }
        const logo = path.join(work, "logo.png");
        await sharp(path.join(process.cwd(), "public", "images", "animaldex-logo-text.webp")).resize({width: 300}).ensureAlpha(0.88).png().toFile(logo);
        const track = pickMusicTrack(moodOf(plan), plan.slug);
        const music = track ? musicTrackPath(process.cwd(), track) : null;
        const total = marks.total;
        const stem = (options.name || plan.slug).replace(/[^a-z0-9-]+/gi, "-");
        await mkdir(options.outDir, {recursive: true});
        const videoPath = path.join(options.outDir, `${stem}.mp4`);
        const endAt = Math.max(total - END_SECONDS, 0);
        const audioIn = music && existsSync(music) ? ["-stream_loop", "-1", "-i", music] : ["-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=r=48000:cl=stereo"];
        await run(ffmpeg(), [
            "-hide_banner", "-loglevel", "error", "-y",
            "-i", rawPath,
            ...audioIn,
            "-loop", "1", "-framerate", String(CLIP_FPS), "-t", total.toFixed(2), "-i", logo,
            ...overlayFiles.flatMap((file) => ["-loop", "1", "-framerate", String(CLIP_FPS), "-t", total.toFixed(2), "-i", file]),
            "-filter_complex", [
                `[2:v]format=rgba,colorchannelmixer=aa=0.85[logo]`,
                // The end card: the Ark keeps moving under a dark veil.
                `[0:v]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.5:t=fill:enable='gte(t,${endAt.toFixed(2)})'[veiled]`,
                `[veiled][logo]overlay=x=(W-w)/2:y=110:enable='lt(t,${endAt.toFixed(2)})'[base]`,
                ...overlayFilter(overlays, 3, "base", "worded"),
                `[worded]format=yuv420p[v]`,
                `[1:a]atrim=0:${total.toFixed(2)},asetpts=N/SR/TB,afade=t=in:d=0.6,afade=t=out:st=${Math.max(total - 1.6, 0).toFixed(2)}:d=1.6,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`
            ].join(";"),
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", "8M", "-bufsize", "16M", "-profile:v", "high",
            "-r", String(CLIP_FPS),
            "-c:a", "aac", "-b:a", "160k",
            "-t", total.toFixed(2),
            "-movflags", "+faststart",
            videoPath
        ]);
        // The poster: a frame from the hook, with its headline on screen.
        const posterPath = path.join(options.outDir, `${stem}.jpg`);
        await run(ffmpeg(), ["-hide_banner", "-loglevel", "error", "-y", "-ss", "1.2", "-i", videoPath, "-frames:v", "1", "-q:v", "3", posterPath]);
        const probe = await probeClip(videoPath);
        const problems = clipProblems(probe);
        if (problems.length) throw new Error(`The clip is off-brief: ${problems.join("; ")}`);
        await writeFile(path.join(options.outDir, `${stem}.json`), JSON.stringify({plan, marks, probe, music: track?.id ?? null, timeline: arkClipTimeline(plan, marks)}, null, 2));
        await rm(work, {recursive: true, force: true});
        return {plan, marks, videoPath, posterPath, seconds: total, probe};
    } finally {
        await browser.close().catch(() => undefined);
    }
}
