"use client";

/**
 * AnimalDex 3.2 "Your step" in the browser: the calls behind the step card's
 * buttons and the report composer, and the open step kept in step between the
 * three places it shows (the chat, in its thread; the card's Bond tab; "Your steps"
 * on Companions). The server is the authority: these only say what it
 * answered, and every caller puts back what it showed when a call fails.
 */

import {useCallback, useEffect, useRef, useState} from "react";
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
import {decodeArkChange, arkRevealSkip, type ArkChange, type ArkRevealSkip} from "@/lib/ark";
import {normalizeCompanionLoop, type AskCompanionLoop} from "@/lib/ask-animaldex/companion-loop";

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

const COMPANION_LOOP_EVENT = "animaldex:companion-loop";

type CompanionLoopDetail = {speciesProfileId: string; loop: AskCompanionLoop};

/** Follows `refreshCompanionLoop` for one animal: its focus and open step as the server now holds them. */
export function useCompanionLoopUpdates(speciesProfileId: string | null | undefined, onChange: (loop: AskCompanionLoop) => void) {
    const callback = useRef(onChange);
    callback.current = onChange;
    useEffect(() => {
        const wanted = speciesProfileId?.toLowerCase() ?? null;
        if (!wanted) return;
        const listener = (event: Event) => {
            const detail = (event as CustomEvent<CompanionLoopDetail>).detail;
            if (detail?.speciesProfileId === wanted) callback.current(detail.loop);
        };
        window.addEventListener(COMPANION_LOOP_EVENT, listener);
        return () => window.removeEventListener(COMPANION_LOOP_EVENT, listener);
    }, [speciesProfileId]);
}

/**
 * Reads one animal's loop again and tells every surface (the chat, the
 * card's Bond tab, "Your steps"). After a debate way is chosen the server
 * sets that animal's step from the way and replaces its old open step,
 * focused on the debate's problem (owner, 2026-11-09): the old step must not
 * stay on screen as the active one, and the new one shows "I'll do it".
 * Null when it could not be read (what is shown then stays).
 */
export async function refreshCompanionLoop(speciesProfileId: string | null | undefined): Promise<AskCompanionLoop | null> {
    const species = speciesProfileId?.toLowerCase() ?? null;
    if (!species || typeof window === "undefined") return null;
    try {
        const response = await fetch(`/api/ask/companion?speciesProfileId=${encodeURIComponent(species)}`, {headers: {Accept: "application/json"}, cache: "no-store"});
        const payload = response.ok ? await response.json() as {loop?: unknown} : null;
        const loop = normalizeCompanionLoop(payload?.loop);
        if (!loop) return null;
        window.dispatchEvent(new CustomEvent<CompanionLoopDetail>(COMPANION_LOOP_EVENT, {detail: {speciesProfileId: species, loop}}));
        noteOpenStep(species, loop.openStep);
        return loop;
    } catch {
        return null;
    }
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

/** "I'll do it", answered: the step now, and the Life Sim reveal it played (or why none). */
export type StepAccepted = {step: AnimalStep; reveal: ArkChange | null; revealSkipped: ArkRevealSkip | null};

/**
 * "I'll do it": the step as the server now holds it, and its reveal
 * (docs/life-sim/CONTRACT.md, section 3). An old server sends no reveal.
 */
export async function acceptStep(step: AnimalStep): Promise<StepCallResult<StepAccepted>> {
    const result = await post({action: "accept", stepId: step.id});
    if (!result.ok) return result;
    const reveal = decodeArkChange(result.payload.reveal);
    return {
        ok: true,
        value: {
            step: decodeStepResult(result.payload.step) ?? {...step, acceptedAt: step.acceptedAt ?? new Date().toISOString()},
            reveal,
            revealSkipped: reveal ? null : arkRevealSkip(result.payload.revealSkipped)
        }
    };
}

/** "A different step": the step is dropped (a no-op on one no longer open). */
export async function dropStep(step: AnimalStep): Promise<StepCallResult<null>> {
    const result = await post({action: "drop", stepId: step.id});
    return result.ok ? {ok: true, value: null} : result;
}

/**
 * "Make this my step": the Trial replaces any open step, accepted at once.
 * Life Sim: the reveal comes from `accept_animal_step_v1` right after
 * (a Trials card's step is untagged, so it reveals with `story: []`). The
 * step stands even when that second call fails: no reveal then.
 */
export async function stepFromTrial(speciesProfileId: string, frequency: StepFrequency): Promise<StepCallResult<StepAccepted>> {
    const result = await post({action: "fromTrial", speciesProfileId, frequency});
    if (!result.ok) return result;
    const step = decodeStepResult(result.payload.step);
    if (!step) return {ok: false, code: "step_unavailable"};
    const accepted = await acceptStep(step);
    return {
        ok: true,
        value: accepted.ok
            ? {...accepted.value, step: {...accepted.value.step, trialFrequency: accepted.value.step.trialFrequency ?? step.trialFrequency}}
            : {step, reveal: null, revealSkipped: null}
    };
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
    const stepsRef = useRef(steps);
    stepsRef.current = steps;

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

    // A step accepted, dropped or finished in a chat changes its row at once;
    // one this list has no row for (set from a debate's way) is read again.
    useOpenStepUpdates(null, useCallback((step: AnimalStep | null, speciesProfileId: string) => {
        if (step && !stepsRef.current.some((row) => row.speciesProfileId === speciesProfileId)) {
            void reload();
            return;
        }
        setSteps((current) => {
            const index = current.findIndex((row) => row.speciesProfileId === speciesProfileId);
            if (!step) return index < 0 ? current : current.filter((_, at) => at !== index);
            if (index < 0) return current;
            const next = [...current];
            next[index] = {...next[index], ...step};
            return next;
        });
    }, [reload]));

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
