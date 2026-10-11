"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {
    type PowerApplicationEvidenceType,
    POWER_APPLICATION_EVIDENCE,
    powerRefusalMessage
} from "@/lib/animal-powers";
import {extractTrialFrames} from "@/lib/animal-trial-frames";

/**
 * Photo-or-video evidence for earning a Power: Apply It Your Way, and a fused
 * Power's Trial. One picker so both send exactly the same thing — one image,
 * or 2–4 frames the browser sampled from the clip.
 */

/** What is attached: one photo, or the frames sampled from a video. */
export type AttachedEvidence = {
    type: PowerApplicationEvidenceType;
    files: File[];
    /** Object URL of the photo, or of the first sampled frame of a video. */
    previewUrl: string;
    /** The recording itself, for a route that keeps it (a fused Trial). Never graded. */
    clip: File | null;
};

/**
 * Turns a picked file into evidence. Throws with the copy to show when it
 * cannot be used.
 */
export async function prepareEvidence(file: File): Promise<AttachedEvidence> {
    if (file.type.startsWith("video/")) {
        const frames = await extractTrialFrames(file, POWER_APPLICATION_EVIDENCE.frameCount, {
            firstFraction: POWER_APPLICATION_EVIDENCE.firstFrameFraction,
            lastFraction: POWER_APPLICATION_EVIDENCE.lastFrameFraction,
            maxLongEdge: POWER_APPLICATION_EVIDENCE.maxLongEdge,
            quality: POWER_APPLICATION_EVIDENCE.jpegQuality
        }).catch(() => [] as File[]);
        if (frames.length < POWER_APPLICATION_EVIDENCE.minFrames) {
            throw new Error(powerRefusalMessage("video_frames_required"));
        }
        return {type: "video", files: frames, previewUrl: URL.createObjectURL(frames[0]), clip: file};
    }
    // The bucket takes JPEG, PNG and WebP only.
    if (!POWER_APPLICATION_EVIDENCE.photoTypes.includes(file.type)) {
        throw new Error(powerRefusalMessage("evidence_download_failed"));
    }
    return {type: "photo", files: [file], previewUrl: URL.createObjectURL(file), clip: null};
}

/** Attached evidence, its preparation, and the object URL it owns. */
export function useAttachedEvidence(onError: (message: string | null) => void) {
    const [evidence, setEvidence] = useState<AttachedEvidence | null>(null);
    const [isPreparing, setIsPreparing] = useState(false);

    // Each preview is an object URL; release it once it is replaced or the sheet closes.
    useEffect(() => {
        const url = evidence?.previewUrl;
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [evidence]);

    const attach = useCallback(async (file: File) => {
        setIsPreparing(true);
        onError(null);
        try {
            setEvidence(await prepareEvidence(file));
        } catch (error) {
            onError(error instanceof Error ? error.message : powerRefusalMessage("evidence_download_failed"));
        } finally {
            setIsPreparing(false);
        }
    }, [onError]);

    return {evidence, setEvidence, isPreparing, attach};
}

/** Appends the evidence to a submission, in the fields every Power route reads. */
export function appendEvidence(form: FormData, evidence: AttachedEvidence, {includeClip = false} = {}) {
    form.set("evidenceType", evidence.type);
    if (evidence.type === "photo") form.set("evidence", evidence.files[0]);
    else for (const frame of evidence.files) form.append("frames", frame);
    if (includeClip && evidence.clip) form.set("clip", evidence.clip);
}

/** The preview, Remove, and the take / record / library buttons. */
export function EvidencePicker({
    evidence,
    onRemove,
    onPick,
    isPreparing,
    disabled,
    allowsLibrary = true
}: {
    evidence: AttachedEvidence | null;
    onRemove: () => void;
    onPick: (file: File) => void;
    isPreparing: boolean;
    disabled: boolean;
    /** False for a Trial: it is something you just did, so it is captured live. */
    allowsLibrary?: boolean;
}) {
    const photoInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const libraryInputRef = useRef<HTMLInputElement>(null);

    const actions = [
        {title: "Take photo", ref: photoInputRef},
        {title: "Record video", ref: videoInputRef},
        ...(allowsLibrary ? [{title: "Choose from library", ref: libraryInputRef}] : [])
    ];
    const inputs = [
        {ref: photoInputRef, accept: "image/*", capture: true},
        {ref: videoInputRef, accept: "video/*", capture: true},
        ...(allowsLibrary ? [{ref: libraryInputRef, accept: "image/*,video/*", capture: false}] : [])
    ];

    return (
        <>
            {evidence ? (
                <div className="flex items-center gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] border border-white/10 bg-black/25">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={evidence.previewUrl}
                            alt={evidence.type === "video" ? "Video attached" : "Photo attached"}
                            className="h-full w-full object-cover"
                        />
                        {evidence.type === "video" ? (
                            <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                                Video
                            </span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={disabled}
                        className="min-h-9 rounded-full border border-white/10 bg-black/25 px-3 text-xs font-semibold text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                    >
                        Remove
                    </button>
                </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                    <button
                        key={action.title}
                        type="button"
                        onClick={() => action.ref.current?.click()}
                        disabled={disabled || isPreparing}
                        className="min-h-9 rounded-full border border-white/10 bg-black/25 px-3 text-xs font-semibold text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                    >
                        {action.title}
                    </button>
                ))}
                {isPreparing ? (
                    <span aria-live="polite" className="self-center text-[10px] text-white/40">…</span>
                ) : null}
            </div>
            {inputs.map((input) => (
                <input
                    key={input.accept}
                    ref={input.ref}
                    type="file"
                    accept={input.accept}
                    capture={input.capture ? "environment" : undefined}
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) onPick(file);
                    }}
                />
            ))}
        </>
    );
}
