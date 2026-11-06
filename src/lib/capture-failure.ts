/**
 * The web's mirror of the one failure vocabulary
 * (`supabase/functions/_shared/failure-taxonomy.ts`, iOS
 * `Models/CaptureFailure.swift`).
 *
 * Clients render failures; they do not reinterpret them, and they never print
 * what a server, a provider or Postgres said. The capture screen shows the
 * code's title and message (in the reader's language, from `capture-words`)
 * and the actions its retryability allows.
 *
 * Keep the codes, their retryability and the English copy identical to the
 * TypeScript table; `capture-failure.test.ts` checks a sample of each class.
 */

export type CaptureFailureRetryability = "transient" | "user_action" | "permanent" | "conservative" | "cancelled";

export type CaptureFailurePresentation = {title: string; message: string};

/** Every code the table knows, with its retryability and its English copy. */
export const CAPTURE_FAILURES = {
    // Transient
    network_unavailable: {retryability: "transient", title: "No internet connection", message: "Your capture is safe. We'll continue when you're back online."},
    provider_rate_limited: {retryability: "transient", title: "Temporarily delayed", message: "The service is busy. Your capture is safe and we'll try again shortly."},
    provider_unavailable: {retryability: "transient", title: "Temporarily delayed", message: "The service is busy. Your capture is safe and we'll try again shortly."},
    provider_timeout: {retryability: "transient", title: "Taking longer than usual", message: "Your capture is safe. We'll try again shortly."},
    server_error: {retryability: "transient", title: "Something went wrong", message: "Your capture is safe. We'll try again."},
    database_unavailable: {retryability: "transient", title: "Something went wrong", message: "Your capture is safe. We'll try again."},
    database_deadlock: {retryability: "transient", title: "Temporarily delayed", message: "Your capture is safe. We'll try again shortly."},
    // User action
    insufficient_credits: {retryability: "user_action", title: "Not enough credits", message: "This capture is saved. Add credits to continue analysing it."},
    authentication_required: {retryability: "user_action", title: "Sign in to continue", message: "Your capture is saved. Sign in again and we'll pick up where we left off."},
    instagram_reauthorization_required: {retryability: "user_action", title: "Reconnect Instagram", message: "Instagram needs you to sign in again before we can continue your import. Your progress is saved."},
    location_unavailable: {retryability: "user_action", title: "Waiting for your location", message: "Your capture is saved. We'll continue once AnimalDex has a location fix."},
    capture_rules_not_accepted: {retryability: "user_action", title: "Agree to the capture rules", message: "Your upload is saved. Agree to the capture rules from the + button, then tap to try again."},
    wifi_required: {retryability: "user_action", title: "Waiting for Wi-Fi", message: "Your capture is saved and will continue when Wi-Fi is available."},
    likely_burst_duplicate: {retryability: "user_action", title: "Looks like a recent capture", message: "Your capture is saved. Confirm it is a new animal to analyse it, or attach it to the earlier one."},
    // Permanent
    account_suspended: {retryability: "permanent", title: "Your account is suspended", message: "This account broke the capture rules three times and can't identify new captures. Your existing captures are safe. Contact support if you think this is a mistake."},
    media_too_large: {retryability: "permanent", title: "This capture is too large", message: "Try capturing it again at a shorter length."},
    media_unreadable: {retryability: "permanent", title: "This capture can't be read", message: "The photo or video appears to be damaged. Try capturing it again."},
    media_missing: {retryability: "permanent", title: "This capture didn't finish uploading", message: "It's still on your device. Tap to try again."},
    no_animal_detected: {retryability: "permanent", title: "No animal found", message: "We couldn't find an animal in this capture."},
    authenticity_rejected: {retryability: "permanent", title: "This doesn't look like an original capture", message: "AnimalDex detected that this may be a screenshot, screen recording, or otherwise not an eligible original capture."},
    source_media_unavailable: {retryability: "permanent", title: "We couldn't access the original photo", message: "The original photo was not uploaded, so AnimalDex couldn't analyse this capture."},
    instagram_media_unavailable: {retryability: "permanent", title: "This post is no longer available", message: "We couldn't retrieve this media from Instagram."},
    video_frames_required: {retryability: "permanent", title: "This video needs to be analysed on your device", message: "Open AnimalDex and we'll finish identifying it."},
    gemini_empty_content: {retryability: "permanent", title: "Couldn't identify this capture", message: "Your capture is saved. We couldn't finish analysing this photo. You can try again later."},
    // Storage
    storage_unavailable: {retryability: "conservative", title: "Something went wrong", message: "Your capture is safe. We'll try again."},
    // Cancelled
    cancelled_by_user: {retryability: "cancelled", title: "Cancelled", message: "This was cancelled. Nothing else is waiting."},
    // The last fallback
    unknown: {retryability: "conservative", title: "Something went wrong", message: "Your capture is safe. We'll try again."}
} as const satisfies Record<string, {retryability: CaptureFailureRetryability} & CaptureFailurePresentation>;

export type CaptureFailureCode = keyof typeof CAPTURE_FAILURES;

/** Shown once automatic recovery has genuinely stopped trying. */
export const CAPTURE_FAILURE_EXHAUSTED: CaptureFailurePresentation = {
    title: "Something went wrong",
    message: "Your capture is still saved, but we couldn't finish analysing it. Try again."
};

/** Explicit codes our own backend emits, mapped onto the vocabulary. */
const EXPLICIT_ERROR_CODES: Record<string, CaptureFailureCode> = {
    insufficient_credits: "insufficient_credits",
    unauthenticated: "authentication_required",
    invalid_token: "authentication_required",
    forbidden: "authentication_required",
    instagram_reauthorization_required: "instagram_reauthorization_required",
    instagram_not_connected: "instagram_reauthorization_required",
    capture_rules_not_accepted: "capture_rules_not_accepted",
    account_suspended: "account_suspended",
    no_primary_image: "media_missing",
    upload_incomplete: "source_media_unavailable",
    local_source_missing: "source_media_unavailable",
    storage_object_missing_after_upload: "source_media_unavailable",
    instagram_media_unavailable: "instagram_media_unavailable",
    video_frames_required: "video_frames_required",
    missing_video_frames: "video_frames_required",
    video_requires_client_supplied_frames: "video_frames_required",
    capture_not_found: "media_missing",
    gemini_temporarily_unavailable: "provider_unavailable",
    analysis_temporarily_busy: "provider_rate_limited",
    no_animal_detected: "no_animal_detected",
    likely_non_live_source: "authenticity_rejected",
    cancelled: "cancelled_by_user",
    likely_burst_duplicate: "likely_burst_duplicate",
    burst_duplicate_collapsed: "likely_burst_duplicate",
    gemini_empty_content: "gemini_empty_content"
};

function token(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed ? trimmed : null;
}

function isKnownCode(value: string): value is CaptureFailureCode {
    return Object.prototype.hasOwnProperty.call(CAPTURE_FAILURES, value);
}

/** The code for a raw value, `unknown` for anything the table does not name. */
export function describeCaptureFailure(code: string | null | undefined): CaptureFailureCode {
    const value = token(code);
    return value && isKnownCode(value) ? value : "unknown";
}

export function captureFailureRetryability(code: string | null | undefined): CaptureFailureRetryability {
    return CAPTURE_FAILURES[describeCaptureFailure(code)].retryability;
}

/**
 * Map whatever a boundary produced onto a code: an explicit code first, then
 * the HTTP status, then (only where no status exists) a narrow set of markers
 * in the text. The text itself is never shown.
 */
export function classifyCaptureFailure(input: {
    errorCode?: string | null;
    httpStatus?: number | null;
    message?: string | null;
}): CaptureFailureCode {
    const explicit = token(input.errorCode);
    if (explicit && EXPLICIT_ERROR_CODES[explicit]) return EXPLICIT_ERROR_CODES[explicit];
    if (explicit && isKnownCode(explicit)) return explicit;

    const status = typeof input.httpStatus === "number" ? input.httpStatus : null;
    if (status !== null) {
        if (status === 401 || status === 403) return "authentication_required";
        if (status === 402) return "insufficient_credits";
        if (status === 404 || status === 410) return "source_media_unavailable";
        if (status === 408 || status === 504) return "provider_timeout";
        if (status === 413) return "media_too_large";
        if (status === 429) return "provider_rate_limited";
        if (status === 412 || status === 422) return "media_missing";
        if (status >= 500) return "server_error";
    }

    const text = (input.message ?? "").toLowerCase();
    if (!text) return "unknown";
    if (text.includes("instagram") && (text.includes("no longer available") || text.includes("media unavailable"))) {
        return "instagram_media_unavailable";
    }
    if (text.includes("upload_incomplete") || text.includes("storage object missing")) return "source_media_unavailable";
    if (text.includes("storage_download_failed")) return "storage_unavailable";
    if (text.includes("gemini_empty_content")) return "gemini_empty_content";
    if (text.includes("gemini_request_timeout") || text.includes("timed out")) return "provider_timeout";
    if (text.includes("deadlock detected") || text.includes("40p01") || text.includes("lock timeout") || text.includes("55p03")) {
        return "database_deadlock";
    }
    if (text.includes("not connected to internet") || text.includes("offline") || text.includes("failed to fetch")) {
        return "network_unavailable";
    }
    // A bare code, as an RPC's `error` or the analysis' own error row carries it.
    const bare = text.trim();
    if (EXPLICIT_ERROR_CODES[bare]) return EXPLICIT_ERROR_CODES[bare];
    if (isKnownCode(bare)) return bare;
    return "unknown";
}

/**
 * The words for a code. `attemptsExhausted` only rewrites copy that promised
 * another try: a user-action failure is waiting, not exhausted.
 */
export function captureFailurePresentation(
    code: string | null | undefined,
    copy: Record<string, CaptureFailurePresentation>,
    options: {attemptsExhausted?: boolean; exhausted?: CaptureFailurePresentation} = {}
): CaptureFailurePresentation {
    const resolved = describeCaptureFailure(code);
    const retryability = CAPTURE_FAILURES[resolved].retryability;
    if (options.attemptsExhausted && (retryability === "transient" || retryability === "conservative")) {
        return options.exhausted ?? CAPTURE_FAILURE_EXHAUSTED;
    }
    return copy[resolved] ?? copy.unknown ?? CAPTURE_FAILURES[resolved];
}

/** What the capture screen offers under a failure. */
export type CaptureFailureActions = {
    /** Run the analysis again: offered where a retry can change the outcome or the cause is unknown. */
    retry: boolean;
    /** Back to the camera (or the source) for a new photo. Always there unless the account cannot capture. */
    takeAnother: boolean;
    getCredits: boolean;
    signIn: boolean;
    agreeToRules: boolean;
};

export function captureFailureActions(code: string | null | undefined): CaptureFailureActions {
    const resolved = describeCaptureFailure(code);
    const retryability = CAPTURE_FAILURES[resolved].retryability;
    return {
        // iOS `offersManualRetry`: a failure that has stopped offers Retry,
        // unless only the person can move it (credits, sign-in, the rules).
        retry: retryability !== "user_action" && retryability !== "cancelled",
        takeAnother: resolved !== "account_suspended",
        getCredits: resolved === "insufficient_credits",
        signIn: resolved === "authentication_required",
        agreeToRules: resolved === "capture_rules_not_accepted"
    };
}

/** English copy for every code, keyed as `capture-words` keys it. */
export function captureFailureCopyEn(): Record<CaptureFailureCode, CaptureFailurePresentation> {
    return Object.fromEntries(
        (Object.keys(CAPTURE_FAILURES) as CaptureFailureCode[]).map((code) => [code, {
            title: CAPTURE_FAILURES[code].title,
            message: CAPTURE_FAILURES[code].message
        }])
    ) as Record<CaptureFailureCode, CaptureFailurePresentation>;
}
