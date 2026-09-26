/**
 * Samples frames evenly across a recorded clip, in the browser.
 *
 * This is where video verification actually happens: nothing server-side in
 * this stack can decode video, so the sequence the model judges is the one
 * assembled here. It mirrors `SupabaseAnimalTrialsService.extractFrames` on iOS,
 * which samples the same count for the same reason.
 */

const FRAME_QUALITY = 0.7;

function seek(video: HTMLVideoElement, time: number) {
    return new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            video.removeEventListener("error", onError);
            resolve();
        };
        const onError = () => {
            video.removeEventListener("seeked", onSeeked);
            video.removeEventListener("error", onError);
            reject(new Error("The recording could not be read."));
        };
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);
        video.currentTime = time;
    });
}

function loadMetadata(video: HTMLVideoElement) {
    return new Promise<void>((resolve, reject) => {
        if (video.readyState >= 1) {
            resolve();
            return;
        }
        video.addEventListener("loadedmetadata", () => resolve(), {once: true});
        video.addEventListener("error", () => reject(new Error("The recording could not be read.")), {once: true});
    });
}

function toBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", FRAME_QUALITY);
    });
}

/**
 * Returns `count` JPEG frames sampled evenly across the clip. Fewer than two
 * usable frames means the recording cannot be judged, and the caller must say
 * so rather than submitting a sequence the model cannot read.
 */
export async function extractTrialFrames(file: File, count = 4): Promise<File[]> {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    try {
        await loadMetadata(video);

        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        if (!duration) return [];

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const context = canvas.getContext("2d");
        if (!context) return [];

        const frames: File[] = [];
        for (let index = 0; index < count; index += 1) {
            // Evenly spaced, nudged inside the clip so the first and last frames
            // are real content rather than a black lead-in or trailing frame.
            const time = duration * ((index + 0.5) / count);
            try {
                await seek(video, Math.min(time, Math.max(0, duration - 0.05)));
            } catch {
                break;
            }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await toBlob(canvas);
            if (blob) frames.push(new File([blob], `frame-${index}.jpg`, {type: "image/jpeg"}));
        }

        return frames;
    } finally {
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
    }
}
