/**
 * The notice a card opens with when its photo is not a clean identification
 * (iOS `ScanResultView`: `uncertaintyCard`, `IdentityEvidenceGuidanceCard`
 * and `captureEligibilitySection`).
 *
 * - An uncertain identification: "Retake required", for anyone who opens it.
 * - The owner's unclear photo of an animal with no AnimalDex number: "Capture
 *   needs a clearer look" with Retake, though not on the card just revealed
 *   unless the photo graded 3 or lower (IOS-28).
 * - Otherwise, for the owner, an unclear or ineligible photo says so once,
 *   with what to try, and no button.
 */

import type {CaptureWords} from "@/lib/capture-words";

export type CaptureValidityNotice = {
    kind: "uncertain" | "guidance" | "eligibility";
    tone: "danger" | "caution" | "warning";
    title: string;
    message: string;
    detail: string | null;
    /** Offers Retake (the camera). */
    retake: boolean;
};

export function captureValidityNotice(input: {
    isOwner: boolean;
    captureValidity: string | null;
    isEligibleCapture: boolean;
    hasUncertaintyFallback: boolean;
    /** The species has an AnimalDex number (a numbered catalog identity). */
    isNumbered: boolean;
    /** This card was opened by the capture flow that just made it. */
    justRevealed: boolean;
    captureGrade: number | null;
    words: CaptureWords["card"];
}): CaptureValidityNotice | null {
    const {words} = input;
    if (input.hasUncertaintyFallback) {
        return {kind: "uncertain", tone: "danger", title: words.retakeRequired, message: words.retakeRequiredMessage, detail: words.retakeRequiredDetail, retake: false};
    }
    if (!input.isOwner) return null;
    const validity = input.captureValidity?.trim().toLowerCase() ?? "";
    const unclear = validity === "unclear_capture";
    if (input.isEligibleCapture && unclear && !input.isNumbered
        && (!input.justRevealed || (input.captureGrade ?? 10) <= 3)) {
        return {kind: "guidance", tone: "caution", title: words.unclearTitle, message: words.unclearMessage, detail: null, retake: true};
    }
    if (input.isEligibleCapture && !unclear) return null;
    if (unclear) {
        return {kind: "eligibility", tone: "caution", title: words.unclearTitle, message: words.unclearMessage, detail: words.unclearRetry, retake: false};
    }
    if (validity === "likely_non_live_source") {
        return {kind: "eligibility", tone: "warning", title: words.nonLiveTitle, message: words.nonLiveMessage, detail: words.liveAnimalRetry, retake: false};
    }
    if (validity === "no_animal_detected") {
        return {kind: "eligibility", tone: "warning", title: words.noAnimalTitle, message: words.noAnimalMessage, detail: words.liveAnimalRetry, retake: false};
    }
    return null;
}
