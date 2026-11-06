/**
 * The capture flow's, the card's and the reveal's words in the reader's
 * language (`appCapture` in the locale file), English for any key the locale
 * lacks. The English is iOS's own, from the Swift source and its String
 * Catalog, so a translation there reads the same here.
 *
 * Server pages read the locale and hand the result to the client components
 * as a prop (`loaders/capture-words`), as every other label in the app is.
 */

import {captureFailureCopyEn, CAPTURE_FAILURE_EXHAUSTED} from "@/lib/capture-failure";

export const CAPTURE_WORDS_EN = {
    close: "Close",
    tryAgain: "Try again",
    signIn: "Sign in",
    scanner: {
        /** iOS `cameraPrimingContent`. */
        primingTitle: "Point at any animal.",
        primingDetail: "AnimalDex identifies it, and it becomes yours to talk to.",
        continue: "Continue",
        requestingCamera: "Starting the camera…",
        cameraRequiredTitle: "Camera access required",
        cameraRequiredDetail: "AnimalDex requires camera access for live scans. Enable Camera access in Settings before taking a photo or video.",
        tapToShoot: "Tap to shoot",
        takePhoto: "Take photo",
        cameraNotReady: "Camera isn't ready yet. Please try again.",
        reviewTitle: "Review photo",
        retake: "Retake",
        chooseAnother: "Choose another",
        identifyPhoto: "Identify photo",
        usesOneCredit: "Uses 1 credit",
        usesCredits: "Uses {n} credits",
        creditsLeft: "{n} left",
        includedWithPro: "Included with Pro",
        freeWithPro: "Free with Pro",
        needsCredits: "Needs {required} credits — you have {available}.",
        getCredits: "Get Credits",
        takeAnother: "Take another",
        retry: "Retry",
        ready: "Ready",
        locationAttached: "Live location attached for habitat validation",
        gettingLocation: "Getting your location…",
        reviewAltLive: "Live camera capture review",
        reviewAltLibrary: "Camera roll photo review",
        // The chat's "+" entries.
        takeAPhoto: "Take a photo",
        uploadFromCameraRoll: "Upload from camera roll",
        chooseFromCameraRoll: "Choose from camera roll",
        openCamera: "Open camera",
        entryLibraryDetail: "Choose a photo you took. Screenshots, downloads and AI images can't be uploaded.",
        entryCameraDetail: "Take a photo of the animal with your camera.",
        checkingPhoto: "Checking photo…",
        chooseAnotherPhoto: "Choose another photo you took.",
        takeAnotherPhoto: "Take another photo with your camera.",
        rejectUnreadable: "This photo couldn't be read. Try a different one.",
        rejectScreenshot: "Screenshots can't be uploaded. Upload the original photo you took of the animal.",
        rejectNoCameraInformation: "This photo has no camera information, so it doesn't look like one you took. Downloaded, saved or AI-generated images can't be uploaded.",
        // A library photo's place.
        fromThePhoto: "From the photo: {place}",
        confirm: "Confirm",
        change: "Change",
        noPlaceSaved: "This photo has no location saved. Pick the place you took it.",
        pickThePlace: "Pick the place",
        pickPlaceFirst: "Pick where this photo was taken first.",
        whereWasThis: "Where was this?",
        photoSays: "The photo says {place}. Pick the place if that's wrong.",
        noPlaceRequired: "This photo has no location saved. Pick the place you took it. It's required for camera-roll uploads.",
        searchForAPlace: "Search for a place",
        searching: "Searching…",
        confirmLocation: "Confirm location"
    },
    /** iOS `CaptureProcessingProgressCopy` (photo). */
    progress: {
        uploadingPhoto: "Uploading photo…",
        uploadUsually: "This usually takes a few seconds.",
        uploadAboutLeft: "Usually a few seconds. About {time} left.",
        uploadSlowTitle: "Upload is taking longer",
        uploadSlowDetail: "Still working. Retry if this hasn't moved.",
        identifying: "Identifying…",
        identifyRange: "usually 15–30 seconds",
        identifyAboutLeft: "About {time} left · {range}.",
        identifySoon: "Should be done soon · {range}.",
        identifySlowTitle: "Identification is taking longer",
        identifySlowDetail: "Still working — {range}. Your photo is saved.",
        seconds: "{n}s",
        minutes: "{n} min",
        minutesSeconds: "{m} min {s}s"
    },
    /** The failure table's copy (`capture-failure.ts`), per code. */
    failures: captureFailureCopyEn(),
    exhausted: {...CAPTURE_FAILURE_EXHAUSTED},
    /** What the capture route turns away before anything is created. */
    refusals: {
        capture_session_expired: "This capture expired. Take the photo again.",
        jpeg_required: "The photo must be a JPEG.",
        place_required: "Pick where this photo was taken.",
        location_required: "Location permission is required for live scans.",
        location_denied: "AnimalDex requires location permission for live scans.",
        location_unsupported: "This browser does not provide location access.",
        camera_unsupported: "Live camera capture requires HTTPS and a supported browser.",
        photo_unreadable: "Could not read the photo. Try again.",
        session_failed: "Could not start a secure capture session.",
        rules_save_failed: "Couldn't save that. Try again."
    },
    /** iOS `TermsAgreementView`: asked before the first capture is sent. */
    terms: {
        title: "Community Terms",
        intro: "Before you share captures, profiles and messages, agree to the rules that keep AnimalDex safe.",
        ruleContent: "No objectionable, abusive, harassing, hateful, sexual, violent, or illegal content.",
        ruleReport: "Report objectionable content when you see it.",
        ruleBlock: "Block abusive users to remove their content from your feed immediately.",
        ruleRemoval: "AnimalDex may remove content and eject users who violate these rules.",
        legalPrefix: "These rules are part of AnimalDex's",
        termsOfUse: "Terms of Use",
        and: "and",
        privacyPolicy: "Privacy Policy",
        zeroTolerance: "The Terms prohibit objectionable content and abusive behavior. You can report content and block users from community surfaces.",
        agree: "I Agree"
    }
};

export type CaptureWords = typeof CAPTURE_WORDS_EN;

function overlay<T extends Record<string, unknown>>(base: T, raw: unknown): T {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(base).map(([key, value]) => {
        const candidate = given[key];
        if (typeof value === "string") {
            return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
        }
        return [key, overlay(value as Record<string, unknown>, candidate)];
    })) as T;
}

/** A locale's `appCapture` labels over the English ones. */
export function captureWords(raw: unknown): CaptureWords {
    return overlay(CAPTURE_WORDS_EN as CaptureWords, raw);
}

/** "{n}"-style placeholders filled in. */
export function fillCaptureWords(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/**
 * The review's footnote (iOS `reviewCostFootnote`): what Identify costs and
 * what is left, "Included with Pro" for Pro. Null while the wallet is unknown.
 */
export function captureCostFootnote(
    wallet: {balance: number | null; isPro: boolean} | null,
    cost: number,
    words: CaptureWords["scanner"]
): string | null {
    if (!wallet) return null;
    if (wallet.isPro) return words.includedWithPro;
    let text = cost === 1 ? words.usesOneCredit : fillCaptureWords(words.usesCredits, {n: cost});
    if (wallet.balance !== null) text += ` · ${fillCaptureWords(words.creditsLeft, {n: wallet.balance})}`;
    return text;
}

/**
 * iOS `showsFreeWithPro`: a quiet "Free with Pro" once only a couple of
 * captures are left. Never for Pro or an unknown balance.
 */
export function captureShowsFreeWithPro(wallet: {balance: number | null; isPro: boolean} | null, cost: number): boolean {
    if (!wallet || wallet.isPro || wallet.balance === null) return false;
    return wallet.balance - cost < cost * 2;
}

/** iOS `captureCreditShortfall`: the known balance cannot pay for this capture. */
export function captureCreditShortfall(wallet: {balance: number | null; isPro: boolean} | null, cost: number): {required: number; available: number} | null {
    if (!wallet || wallet.isPro || wallet.balance === null || wallet.balance >= cost) return null;
    return {required: cost, available: wallet.balance};
}
