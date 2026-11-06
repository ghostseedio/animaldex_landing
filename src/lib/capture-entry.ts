/**
 * How a capture begins on the web.
 *
 * The scanner is the Capture button's page: the live camera in the browser.
 * The other two are the chat's "+" (the owner, 2026-11-06, after the Claude
 * app): the phone's camera app for one still, or the camera roll straight
 * away. Both land in the scanner page's own review, so every rule it enforces
 * (the capture rules, screening, credits) holds without a viewfinder.
 *
 * Mirrors iOS `CameraScanEntry.swift` and Android `CameraScanEntry.kt`.
 */
export type CaptureEntry = "camera" | "library";

/** What a capture says it came from, as the capture route reads it. */
export type WebCaptureSource = "live_camera" | "camera_roll";

/** The `?entry=` the "+" sends the capture page; anything else is the scanner. */
export function captureEntryFromParam(value: string | string[] | null | undefined): CaptureEntry | null {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw === "camera" || raw === "library" ? raw : null;
}

/** A still from the phone's camera app is a live capture; a pick from the roll is a library upload. */
export function captureSourceForEntry(entry: CaptureEntry): WebCaptureSource {
    return entry === "library" ? "camera_roll" : "live_camera";
}

/**
 * "Take a photo" opens the phone's camera app through a file input with
 * `capture`; a desktop has no camera app, so there it is the scanner page.
 */
export function takePhotoOpensCameraApp(coarsePointer: boolean): boolean {
    return coarsePointer;
}

/** The capture rules are asked before a library pick, never before a live shot (as in the apps). */
export function needsCaptureRules(entry: CaptureEntry, acceptedVersion: number | null, requiredVersion: number): boolean {
    return entry === "library" && (acceptedVersion ?? 0) < requiredVersion;
}

/**
 * A library photo never takes today's GPS fix: Identify waits for the place
 * the file carried, confirmed, or the one the person picks. A live shot's
 * place is the browser's fix at Identify, as on the scanner.
 */
export function libraryNeedsPlace(source: WebCaptureSource, confirmedPlace: boolean): boolean {
    return source === "camera_roll" && !confirmedPlace;
}

/** The file input each "+" item opens. */
export function plusItemInput(entry: CaptureEntry): {accept: string; capture?: "environment"} {
    return entry === "camera" ? {accept: "image/*", capture: "environment"} : {accept: "image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp"};
}
