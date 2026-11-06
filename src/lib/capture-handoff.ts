"use client";

import type {CaptureEntry} from "@/lib/capture-entry";

/**
 * The file the chat's "+" just picked, on its way to the capture page. A
 * file input has to be opened by the person's tap, which happens in the
 * chat; the review lives on the capture page. The handoff is in memory
 * only: a full reload loses it, and the capture page then offers the same
 * source again on its own.
 */
let pending: {entry: CaptureEntry; file: File} | null = null;

export function setPendingCaptureFile(entry: CaptureEntry, file: File) {
    pending = {entry, file};
}

export function takePendingCaptureFile(entry: CaptureEntry): File | null {
    const current = pending;
    pending = null;
    return current && current.entry === entry ? current.file : null;
}
