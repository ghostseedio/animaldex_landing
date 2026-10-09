import {spawn} from "child_process";
import {mkdtemp, readFile, rm, writeFile} from "fs/promises";
import {tmpdir} from "os";
import path from "path";
import {needsFrameRateFix, readMp4VideoInfo} from "@/lib/social/mp4-info";

// Story videos first shipped at 15 fps, which TikTok and Instagram/Facebook
// Reels reject. Anything outside 24–60 fps is re-encoded to a constant 30 fps
// (frames duplicated, same duration and audio) before upload. The app renders
// at 30 fps from late Oct 2026; this stays as the safety net for older files.
// Needs the ffmpeg binary (installed in the Docker runner stage).

const FFMPEG_TIMEOUT_MS = 8 * 60_000;

export const FRAME_RATE_FIX_ARGS = [
    "-vf", "fps=30",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart"
];

function runFfmpeg(args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(process.env.FFMPEG_PATH?.trim() || "ffmpeg", args, {stdio: ["ignore", "ignore", "pipe"]});
        let stderr = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
        child.stderr.on("data", (chunk) => {
            stderr = (stderr + chunk.toString()).slice(-2000);
        });
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(new Error((error as NodeJS.ErrnoException).code === "ENOENT" ? "ffmpeg is not installed on the server" : error.message));
        });
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg ${signal ? `was killed (${signal})` : `exited ${code}`}: ${stderr.trim().split("\n").slice(-3).join(" ")}`));
        });
    });
}

export type NormalizedVideo = {video: Buffer; converted: boolean; fromFps: number | null};

/** The video as-is when its frame rate is acceptable, else a 30 fps re-encode. */
export async function normalizeVideoForSocial(video: Buffer): Promise<NormalizedVideo> {
    const info = readMp4VideoInfo(video);
    if (!needsFrameRateFix(info)) return {video, converted: false, fromFps: info?.fps ?? null};

    const dir = await mkdtemp(path.join(tmpdir(), "animaldex-share-"));
    try {
        const input = path.join(dir, "in.mp4");
        const output = path.join(dir, "out.mp4");
        await writeFile(input, video);
        await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", input, ...FRAME_RATE_FIX_ARGS, output]);
        const converted = await readFile(output);
        const after = readMp4VideoInfo(converted);
        if (!after || needsFrameRateFix(after)) throw new Error("Re-encoded video still has an unsupported frame rate");
        return {video: converted, converted: true, fromFps: info?.fps ?? null};
    } finally {
        // The re-encode is a temporary copy for this upload only, never kept.
        await rm(dir, {recursive: true, force: true}).catch(() => undefined);
    }
}
