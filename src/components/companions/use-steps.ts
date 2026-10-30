"use client";

/**
 * AnimalDex 3.2 "Your step" in the browser: the calls behind the step card's
 * buttons and the report composer, and the open step kept in step between the
 * three places it shows (the chat, in its thread; the card's Bond tab; "Your steps"
 * on Companions). The server is the authority: these only say what it
 * answered, and every caller puts back what it showed when a call fails.
 */

import {useCallback, useEffect, useState} from "react";
import {extractTrialFrames} from "@/lib/animal-trial-frames";
import {askStepReportThumb} from "@/lib/ask-animaldex/thread";
import {
    STEP_VIDEO_FRAMES,
    cleanStepReport,
    decodeStepResult,
    isAcceptedStepMedia,
    isStepVideoFile,
    stepProblemCode,
    type AnimalStep,
    type OpenStepRow,
    type StepFrequency,
    type StepProblemCode,
    type StepRecordWithMedia
} from "@/lib/your-step";

const OPEN_STEP_EVENT = "animaldex:open-step";

type OpenStepDetail = {speciesProfileId: string; step: AnimalStep | null};

/** Tells every surface showing this animal's step what it is now (null: none open). */
export function noteOpenStep(speciesProfileId: string | null | undefined, step: AnimalStep | null) {
    if (!speciesProfileId || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<OpenStepDetail>(OPEN_STEP_EVENT, {detail: {speciesProfileId: speciesProfileId.toLowerCase(), step}}));
}

/** Follows `noteOpenStep` for one animal (or, with no species, for every animal). */
export function useOpenStepUpdates(speciesProfileId: string | null | undefined, onChange: (step: AnimalStep | null, speciesProfileId: string) => void) {
    useEffect(() => {
        const wanted = speciesProfileId?.toLowerCase() ?? null;
        const listener = (event: Event) => {
            const detail = (event as CustomEvent<OpenStepDetail>).detail;
            if (!detail || (wanted && detail.speciesProfileId !== wanted)) return;
            onChange(detail.step, detail.speciesProfileId);
        };
        window.addEventListener(OPEN_STEP_EVENT, listener);
        return () => window.removeEventListener(OPEN_STEP_EVENT, listener);
    }, [speciesProfileId, onChange]);
}

/** A call's outcome: the value, or the code to say in words (`stepProblemText`). */
export type StepCallResult<T> = {ok: true; value: T} | {ok: false; code: StepProblemCode};

async function post(body: Record<string, unknown>): Promise<{ok: true; payload: Record<string, unknown>} | {ok: false; code: StepProblemCode}> {
    try {
        const response = await fetch("/api/app/steps", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!response.ok || payload?.ok !== true) return {ok: false, code: stepProblemCode(payload?.code)};
        return {ok: true, payload};
    } catch {
        return {ok: false, code: "step_unavailable"};
    }
}

/** "I'll do it": the step as the server now holds it. */
export async function acceptStep(step: AnimalStep): Promise<StepCallResult<AnimalStep>> {
    const result = await post({action: "accept", stepId: step.id});
    if (!result.ok) return result;
    return {ok: true, value: decodeStepResult(result.payload.step) ?? {...step, acceptedAt: step.acceptedAt ?? new Date().toISOString()}};
}

/** "A different step": the step is dropped (a no-op on one no longer open). */
export async function dropStep(step: AnimalStep): Promise<StepCallResult<null>> {
    const result = await post({action: "drop", stepId: step.id});
    return result.ok ? {ok: true, value: null} : result;
}

/** "Make this my step": the Trial replaces any open step, accepted at once. */
export async function stepFromTrial(speciesProfileId: string, frequency: StepFrequency): Promise<StepCallResult<AnimalStep>> {
    const result = await post({action: "fromTrial", speciesProfileId, frequency});
    if (!result.ok) return result;
    const step = decodeStepResult(result.payload.step);
    return step ? {ok: true, value: step} : {ok: false, code: "step_unavailable"};
}

/**
 * The bucket takes JPEG, PNG and WebP photos (no HEIC): any other photo the
 * browser can open is redrawn as a JPEG, at most 2048 pixels on its long
 * edge. A video goes as it is when the bucket takes its type. Null: it
 * cannot be sent.
 */
export async function preparedStepMedia(file: File): Promise<File | null> {
    if (isAcceptedStepMedia(file)) return file;
    if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return null;
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
        return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {type: "image/jpeg"}) : null;
    } catch {
        return null;
    }
}

/**
 * Uploads their photo or video and attaches the report to the open step.
 * A video sends its clip and three frames for the record's thumbnail; a clip
 * the browser cannot read still goes, without frames. Not ok: the report is
 * not attached, so the message is not sent as a report.
 */
export async function attachStepReport(params: {
    step: AnimalStep;
    speciesProfileId: string;
    account: string;
    file: File | null;
}): Promise<StepCallResult<null>> {
    const form = new FormData();
    form.set("stepId", params.step.id);
    form.set("speciesProfileId", params.speciesProfileId);
    form.set("account", cleanStepReport(params.account));
    if (params.file) {
        const media = await preparedStepMedia(params.file);
        if (!media) return {ok: false, code: "media_not_supported"};
        form.set("media", media);
        if (isStepVideoFile(media)) {
            const frames = await extractTrialFrames(media, STEP_VIDEO_FRAMES, {maxLongEdge: 1280}).catch(() => [] as File[]);
            for (const frame of frames) form.append("frames", frame);
        }
    }
    try {
        const response = await fetch("/api/app/steps/report", {method: "POST", body: form});
        const payload = await response.json().catch(() => null) as {ok?: boolean; code?: unknown} | null;
        return response.ok && payload?.ok === true ? {ok: true, value: null} : {ok: false, code: stepProblemCode(payload?.code)};
    } catch {
        return {ok: false, code: "step_unavailable"};
    }
}

/**
 * The small thumbnail the person's report bubble shows beside "YOUR STEP"
 * (docs/your-step/INLINE.md): a photo, or a video's first frame, drawn at
 * most `longEdge` pixels on its long side as a JPEG data URL, so the thread
 * keeps it when it is reopened. Null when the browser cannot draw it (the
 * report still goes, without one).
 */
export async function stepReportThumbnail(file: File, longEdge = 360): Promise<string | null> {
    try {
        const source = isStepVideoFile(file)
            ? (await extractTrialFrames(file, 1, {maxLongEdge: longEdge}).catch(() => [] as File[]))[0] ?? null
            : file;
        if (!source || typeof createImageBitmap !== "function") return null;
        const bitmap = await createImageBitmap(source);
        // Smaller and softer until it fits what the thread keeps.
        for (const [edge, quality] of [[longEdge, 0.72], [Math.round(longEdge * 0.7), 0.6], [Math.round(longEdge * 0.5), 0.5]] as const) {
            const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const thumb = askStepReportThumb(canvas.toDataURL("image/jpeg", quality));
            if (thumb) {
                bitmap.close();
                return thumb;
            }
        }
        bitmap.close();
        return null;
    } catch {
        return null;
    }
}

/** Every open step across their animals, for Companions' "Your steps". */
export function useOpenSteps(enabled = true) {
    const [steps, setSteps] = useState<OpenStepRow[]>([]);
    const [didLoad, setDidLoad] = useState(false);

    const reload = useCallback(async () => {
        if (!enabled) return;
        try {
            const response = await fetch("/api/app/steps", {headers: {Accept: "application/json"}, cache: "no-store"});
            const payload = response.ok ? await response.json() as {steps?: OpenStepRow[]} : null;
            if (payload && Array.isArray(payload.steps)) setSteps(payload.steps);
        } catch {
            // Keep what was shown.
        } finally {
            setDidLoad(true);
        }
    }, [enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    // A step accepted, dropped or finished in a chat changes its row at once.
    useOpenStepUpdates(null, useCallback((step: AnimalStep | null, speciesProfileId: string) => {
        setSteps((current) => {
            const index = current.findIndex((row) => row.speciesProfileId === speciesProfileId);
            if (!step) return index < 0 ? current : current.filter((_, at) => at !== index);
            if (index < 0) return current;
            const next = [...current];
            next[index] = {...next[index], ...step};
            return next;
        });
    }, []));

    return {steps, didLoad, reload};
}

/** The done steps with one animal, newest first, each with its media signed for the reader. */
export function useStepRecords(speciesProfileId: string | null | undefined) {
    const [records, setRecords] = useState<StepRecordWithMedia[]>([]);
    const [didLoad, setDidLoad] = useState(false);

    const reload = useCallback(async () => {
        if (!speciesProfileId) {
            setRecords([]);
            setDidLoad(true);
            return;
        }
        try {
            const response = await fetch(`/api/app/steps?speciesProfileId=${encodeURIComponent(speciesProfileId)}`, {
                headers: {Accept: "application/json"},
                cache: "no-store"
            });
            const payload = response.ok ? await response.json() as {records?: StepRecordWithMedia[]} : null;
            setRecords(payload?.records && Array.isArray(payload.records) ? payload.records : []);
        } catch {
            setRecords([]);
        } finally {
            setDidLoad(true);
        }
    }, [speciesProfileId]);

    useEffect(() => {
        setDidLoad(false);
        void reload();
    }, [reload]);

    return {records, didLoad, reload};
}
