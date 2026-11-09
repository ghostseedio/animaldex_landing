// Browser-side video compression for /admin/story-videos uploads.
//
// Measured 2026-11-09 on the owner's line: one upload to Supabase storage runs
// at 2.1–2.7 MB/s and three in parallel saturate at ~3.3 MB/s (the same as a
// raw Cloudflare upload test), so bytes are the bottleneck, not the route. The
// Shorts came out of the editor at 11–12.4 Mbps; re-encoding them to 8 Mbps
// H.264 with the Mac's hardware encoder (what Chrome's WebCodecs uses) took
// ~8 s for 54 s of 1080×1920 and scored VMAF 96.1 against the source (10 Mbps:
// 97.2), i.e. no visible change, and every platform re-encodes far lower anyway.
// Files already at or near the target pass through untouched.
//
// mediabunny is imported on demand so it stays out of the admin page's bundle.

/** YouTube's recommended upload bitrate for 1080p30 SDR; scaled by pixels and frame rate. */
const BASE_BITRATE = 8_000_000;
const BASE_PIXELS = 1080 * 1920;
/** Only re-encode when it saves at least this share of the video bytes. */
const MIN_SAVING = 0.25;

export type VideoProbe = {
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
    /** Average video bitrate in bits/s. */
    videoBitrate: number;
    /** The file is already an MP4 the storage path accepts as is. */
    isMp4: boolean;
    /** The bitrate a re-encode would aim for. */
    targetBitrate: number;
    /** Estimated size after re-encoding, in bytes (video at target + audio as is). */
    estimatedBytes: number;
    /** Re-encoding would cut the file by at least MIN_SAVING. */
    worthCompressing: boolean;
};

export function targetBitrateFor(width: number, height: number, fps: number) {
    const pixels = Math.max(1, width * height) / BASE_PIXELS;
    const motion = fps > 40 ? 1.5 : 1;
    return Math.round(BASE_BITRATE * Math.min(2, Math.max(0.35, pixels)) * motion);
}

export async function probeVideo(file: File): Promise<VideoProbe> {
    const mb = await import("mediabunny");
    const input = new mb.Input({source: new mb.BlobSource(file), formats: mb.ALL_FORMATS});
    try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error("No video track in this file");
        const [durationSeconds, stats, format, width, height] = await Promise.all([
            input.computeDuration(),
            // Every packet: a sample of the first few hundred misjudged quiet openings by 2×.
            track.computePacketStats(),
            input.getFormat(),
            track.getDisplayWidth(),
            track.getDisplayHeight()
        ]);
        const fps = stats.averagePacketRate || 30;
        const videoBitrate = stats.averageBitrate || (file.size * 8) / Math.max(1, durationSeconds);
        const targetBitrate = targetBitrateFor(width, height, fps);
        const videoBytes = (videoBitrate / 8) * durationSeconds;
        const otherBytes = Math.max(0, file.size - videoBytes);
        const estimatedBytes = Math.round(otherBytes + (Math.min(videoBitrate, targetBitrate) / 8) * durationSeconds);
        return {
            durationSeconds,
            width,
            height,
            fps,
            videoBitrate,
            isMp4: format.name === "MP4",
            targetBitrate,
            estimatedBytes,
            worthCompressing: videoBitrate > targetBitrate * (1 + MIN_SAVING)
        };
    } finally {
        input.dispose();
    }
}

export class CompressionCancelled extends Error {
    constructor() {
        super("Cancelled");
    }
}

/**
 * Re-encodes the video track to H.264 at the target bitrate (2 s key frames,
 * fast-start MP4) and copies the audio as is. With `transcodeVideo: false` it
 * only remuxes into MP4 (for .mov sources that are already small enough).
 */
export async function compressVideo(
    file: File,
    options: {targetBitrate: number; width: number; height: number; transcodeVideo: boolean; onProgress: (fraction: number) => void; signal: AbortSignal}
): Promise<Blob> {
    const mb = await import("mediabunny");
    if (options.transcodeVideo && !(await mb.canEncodeVideo("avc", {width: options.width, height: options.height, quality: new mb.Quality({bitrate: options.targetBitrate})}))) {
        throw new Error("This browser cannot encode H.264 (use Chrome or Safari), so the original file is uploaded");
    }
    const input = new mb.Input({source: new mb.BlobSource(file), formats: mb.ALL_FORMATS});
    const target = new mb.BufferTarget();
    const output = new mb.Output({format: new mb.Mp4OutputFormat({fastStart: "in-memory"}), target});
    try {
        const conversion = await mb.Conversion.init({
            input,
            output,
            tracks: "primary",
            video: options.transcodeVideo
                ? // A bare number would be a 0–1 quality LEVEL, not a bitrate.
                {codec: "avc", quality: new mb.Quality({bitrate: options.targetBitrate, bitrateMode: "variable"}), keyFrameInterval: 2, forceTranscode: true}
                : {},
            audio: {}
        });
        if (!conversion.isValid) {
            const reasons = conversion.discardedTracks.map((discarded) => discarded.reason).join(", ");
            throw new Error(`This video cannot be converted here (${reasons || "unsupported tracks"})`);
        }
        conversion.onProgress = (progress) => options.onProgress(Math.min(1, Math.max(0, progress)));
        const cancel = () => {
            void conversion.cancel();
        };
        options.signal.addEventListener("abort", cancel, {once: true});
        try {
            await conversion.execute();
        } catch (error) {
            if (options.signal.aborted) throw new CompressionCancelled();
            throw error;
        } finally {
            options.signal.removeEventListener("abort", cancel);
        }
        if (!target.buffer) throw new Error("The converter produced no file");
        return new Blob([target.buffer], {type: "video/mp4"});
    } finally {
        input.dispose();
    }
}

/**
 * A few evenly spaced JPEG frames, small enough for a model to judge cheaply.
 * Used only when the server's whole-video description fails and falls back to Claude.
 */
export async function sampleFrames(source: Blob | string, count = 6, maxHeight = 768): Promise<string[]> {
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    const video = document.createElement("video");
    // Storage serves public files with CORS, so frames from a URL can be read back.
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    try {
        await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => resolve();
            video.onerror = () => reject(new Error("Could not read frames"));
        });
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (!duration || !video.videoWidth) return [];
        const scale = Math.min(1, maxHeight / video.videoHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) return [];
        const frames: string[] = [];
        for (let index = 0; index < count; index += 1) {
            const time = duration * ((index + 0.5) / count);
            await new Promise<void>((resolve) => {
                video.onseeked = () => resolve();
                video.currentTime = time;
            });
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.72).replace(/^data:image\/jpeg;base64,/, ""));
        }
        return frames;
    } catch {
        return [];
    } finally {
        video.removeAttribute("src");
        video.load();
        if (typeof source !== "string") URL.revokeObjectURL(url);
    }
}

/** Plain voiceover text from an .srt dropped next to its video. */
export function srtToText(srt: string) {
    return srt
        .replace(/\r/g, "")
        .split("\n")
        .filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !/-->/.test(line))
        .map((line) => line.replace(/<[^>]+>/g, "").trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}
