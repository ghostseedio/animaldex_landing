/**
 * What a person reads while a photo is uploading and being identified,
 * ported from iOS `CaptureProcessingProgressCopy` (photo captures; the web
 * has no video capture). Everything is derived from the stage and the time
 * spent in it, never from raw error text.
 */

export type CaptureProgressStage = "uploading" | "analyzing";

export type CaptureProgressSnapshot = {
    label: string;
    detail: string | null;
    /** True once the stage has sat past its typical window. */
    offersRetry: boolean;
    isDelayed: boolean;
    /** 0…1 hint, capped below 1 so a long run never looks done. */
    progressFraction: number;
};

export type CaptureProgressWords = {
    uploadingPhoto: string;
    uploadUsually: string;
    /** "{time}" */
    uploadAboutLeft: string;
    uploadSlowTitle: string;
    uploadSlowDetail: string;
    identifying: string;
    identifyRange: string;
    /** "{time}", "{range}" */
    identifyAboutLeft: string;
    /** "{range}" */
    identifySoon: string;
    identifySlowTitle: string;
    /** "{range}" */
    identifySlowDetail: string;
    /** "{n}" */
    seconds: string;
    /** "{n}" */
    minutes: string;
    /** "{m}", "{s}" */
    minutesSeconds: string;
};

/** iOS `Context.default` for a photo. */
export const TYPICAL_UPLOAD_SECONDS = 8;
export const TYPICAL_IDENTIFY_SECONDS = 25;
/** iOS `delayedAfterUpload` / `delayedAfterIdentify(isVideo: false)`. */
export const DELAYED_AFTER_UPLOAD_SECONDS = 45;
export const DELAYED_AFTER_IDENTIFY_SECONDS = 45;

function fill(template: string, values: Record<string, string | number>) {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export function formatCaptureDuration(interval: number, words: Pick<CaptureProgressWords, "seconds" | "minutes" | "minutesSeconds">): string {
    const seconds = Math.max(0, Math.ceil(interval));
    if (seconds < 60) return fill(words.seconds, {n: seconds});
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (minutes >= 10 || remainder === 0) return fill(words.minutes, {n: minutes});
    return fill(words.minutesSeconds, {m: minutes, s: remainder});
}

function remainingPhrase(elapsed: number, typical: number, words: CaptureProgressWords): string | null {
    const remaining = typical - elapsed;
    return remaining >= 3 ? formatCaptureDuration(remaining, words) : null;
}

function cappedProgress(elapsed: number, typical: number, start: number, cap: number) {
    const raw = start + (elapsed / Math.max(typical, 1)) * (cap - start);
    return Math.min(cap, Math.max(start, raw));
}

export function captureProgressSnapshot(stage: CaptureProgressStage, elapsedSeconds: number, words: CaptureProgressWords): CaptureProgressSnapshot {
    const elapsed = Math.max(0, elapsedSeconds);
    if (stage === "uploading") {
        const progressFraction = cappedProgress(elapsed, TYPICAL_UPLOAD_SECONDS, 0.12, 0.88);
        if (elapsed >= DELAYED_AFTER_UPLOAD_SECONDS) {
            return {label: words.uploadSlowTitle, detail: words.uploadSlowDetail, offersRetry: true, isDelayed: true, progressFraction};
        }
        const remaining = remainingPhrase(elapsed, TYPICAL_UPLOAD_SECONDS, words);
        return {
            label: words.uploadingPhoto,
            detail: remaining ? fill(words.uploadAboutLeft, {time: remaining}) : words.uploadUsually,
            offersRetry: false,
            isDelayed: false,
            progressFraction
        };
    }

    const progressFraction = cappedProgress(elapsed, TYPICAL_IDENTIFY_SECONDS, 0.22, 0.9);
    if (elapsed >= DELAYED_AFTER_IDENTIFY_SECONDS) {
        return {
            label: words.identifySlowTitle,
            detail: fill(words.identifySlowDetail, {range: words.identifyRange}),
            offersRetry: true,
            isDelayed: true,
            progressFraction
        };
    }
    const remaining = remainingPhrase(elapsed, TYPICAL_IDENTIFY_SECONDS, words);
    return {
        label: words.identifying,
        detail: remaining
            ? fill(words.identifyAboutLeft, {time: remaining, range: words.identifyRange})
            : fill(words.identifySoon, {range: words.identifyRange}),
        offersRetry: false,
        isDelayed: false,
        progressFraction
    };
}
