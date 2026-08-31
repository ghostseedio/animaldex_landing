export const INITIAL_FRAME_POSITIONS = [0.2, 0.5, 0.8] as const;
export const ESCALATION_FRAME_POSITIONS = [0.35, 0.65, 0.9] as const;
export const MAX_IMPORT_FRAMES = 6;
export const MAX_FRAME_PIXEL_LENGTH = 1024;
export const FRAME_JPEG_QUALITY = 0.6;

export type InstagramReelFramePayload = {
    frame_index: number;
    timestamp_ms: number;
    jpeg_base64: string;
};

export function clampFramePosition(position: number) {
    if (!Number.isFinite(position)) return 0.5;
    return Math.min(0.95, Math.max(0.05, position));
}

export function timestampMsForPosition(durationMs: number, position: number) {
    return Math.round(Math.max(0, durationMs) * clampFramePosition(position));
}

export function scaledFrameSize(width: number, height: number, maxPixelLength = MAX_FRAME_PIXEL_LENGTH) {
    const longest = Math.max(width, height, 1);
    if (longest <= maxPixelLength) return {width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height))};
    const scale = maxPixelLength / longest;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };
}

export function jpegDataUrlToRawBase64(dataUrl: string) {
    const match = dataUrl.match(/^data:image\/jpeg;base64,(.+)$/i);
    return match?.[1] ?? "";
}

export function buildFramePayload(options: {
    index: number;
    timestampMs: number;
    jpegBase64: string;
}): InstagramReelFramePayload {
    return {
        frame_index: options.index,
        timestamp_ms: options.timestampMs,
        jpeg_base64: options.jpegBase64.replace(/^data:image\/jpeg;base64,/i, "")
    };
}

export function shouldEscalateFrames(result: {escalate?: boolean | null}, currentCount: number) {
    return result.escalate === true && currentCount < MAX_IMPORT_FRAMES;
}

function waitForEvent(target: EventTarget, event: string, timeoutMs: number) {
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error("frame_extraction_timeout"));
        }, timeoutMs);
        const onEvent = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error("frame_extraction_interrupted"));
        };
        const cleanup = () => {
            window.clearTimeout(timer);
            target.removeEventListener(event, onEvent);
            target.removeEventListener("error", onError);
        };
        target.addEventListener(event, onEvent, {once: true});
        target.addEventListener("error", onError, {once: true});
    });
}

export async function extractInstagramReelFrames(options: {
    src: string;
    positions: readonly number[];
    startIndex?: number;
    timeoutMs?: number;
}): Promise<{frames: InstagramReelFramePayload[]; durationMs: number; bytesTransferred: number; path: "remote"}> {
    if (typeof document === "undefined") {
        throw new Error("frame_extraction_interrupted");
    }

    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.preload = "metadata";
    video.controls = false;
    video.src = options.src;

    try {
        await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error("frame_extraction_timeout")), options.timeoutMs ?? 20000);
            video.onloadedmetadata = () => {
                window.clearTimeout(timer);
                resolve();
            };
            video.onerror = () => {
                window.clearTimeout(timer);
                reject(new Error("frame_extraction_interrupted"));
            };
        });

        const durationMs = Math.round((video.duration || 0) * 1000);
        const size = scaledFrameSize(video.videoWidth || MAX_FRAME_PIXEL_LENGTH, video.videoHeight || MAX_FRAME_PIXEL_LENGTH);
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("frame_extraction_interrupted");

        const frames: InstagramReelFramePayload[] = [];
        const startIndex = options.startIndex ?? 0;
        for (let offset = 0; offset < options.positions.length; offset += 1) {
            const position = options.positions[offset];
            const timestampMs = timestampMsForPosition(durationMs, position);
            video.currentTime = timestampMs / 1000;
            await waitForEvent(video, "seeked", options.timeoutMs ?? 12000);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", FRAME_JPEG_QUALITY);
            const jpegBase64 = jpegDataUrlToRawBase64(dataUrl);
            if (!jpegBase64) throw new Error("frame_extraction_interrupted");
            frames.push(buildFramePayload({
                index: startIndex + offset,
                timestampMs,
                jpegBase64
            }));
        }

        return {
            frames,
            durationMs,
            bytesTransferred: 0,
            path: "remote"
        };
    } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
        canvas.width = 0;
        canvas.height = 0;
    }
}
