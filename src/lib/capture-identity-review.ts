/**
 * Finds pairs of one owner's captures that may be one animal named twice.
 *
 * A burst of photos of the same animal is judged frame by frame, so two frames
 * seconds apart can land on different species (a semi-slug and, 27 seconds
 * later, "Mantis Ootheca"). Time and place alone are not enough: most
 * back-to-back pairs are genuinely different animals (a kite, then an otter).
 * A pair is only queued when something also suggests a mistake — a low
 * confidence, related names, or a label that is only a group (Mantodea).
 *
 * Pure: the scan route feeds it rows and stores what it returns.
 */

export type CaptureForReview = {
    id: string;
    userId: string;
    /** Milliseconds since epoch: when the photo was taken, else when it was saved. */
    takenAt: number;
    latitude: number | null;
    longitude: number | null;
    speciesProfileId: string;
    name: string;
    scientificName: string | null;
    confidence: number | null;
};

export type ReviewSignal = "low_confidence" | "related_names" | "broad_label" | "same_genus";

export type ReviewCandidate = {
    userId: string;
    captureA: CaptureForReview;
    captureB: CaptureForReview;
    secondsApart: number;
    distanceM: number | null;
    signals: ReviewSignal[];
};

export const REVIEW_WINDOW_SECONDS = 180;
export const REVIEW_MAX_DISTANCE_M = 250;
export const LOW_CONFIDENCE = 0.7;

const STOP_WORDS = new Set(["common", "the", "and", "of", "great", "little", "lesser", "small", "large", "giant", "wild", "domestic"]);

export function distanceMeters(a: {latitude: number | null; longitude: number | null}, b: {latitude: number | null; longitude: number | null}) {
    if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
    return Math.round(6_371_000 * 2 * Math.asin(Math.sqrt(h)));
}

function nameTokens(name: string) {
    return name
        .toLowerCase()
        .split(/[^a-z]+/)
        .map((token) => token.replace(/(ies|es|s)$/, (suffix) => (suffix === "ies" ? "y" : "")))
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

/** "Fly" / "House Fly", "Mosquito" / "Asian Tiger Mosquito": one name contains the other's head noun. */
export function namesAreRelated(left: string, right: string) {
    const a = nameTokens(left);
    const b = nameTokens(right);
    if (!a.length || !b.length) return false;
    return a.some((token) => b.includes(token));
}

/** A scientific name with no species part is a group label: Mantodea, Formicidae, Insecta. */
export function isBroadLabel(scientificName: string | null) {
    const value = scientificName?.trim();
    return Boolean(value) && !/\s/.test(value!);
}

function genus(scientificName: string | null) {
    const value = scientificName?.trim();
    if (!value || !/\s/.test(value)) return null;
    return value.split(/\s+/)[0].toLowerCase();
}

export function reviewSignals(a: CaptureForReview, b: CaptureForReview): ReviewSignal[] {
    const signals: ReviewSignal[] = [];
    if (Math.min(a.confidence ?? 1, b.confidence ?? 1) < LOW_CONFIDENCE) signals.push("low_confidence");
    if (namesAreRelated(a.name, b.name)) signals.push("related_names");
    if (isBroadLabel(a.scientificName) || isBroadLabel(b.scientificName)) signals.push("broad_label");
    const genusA = genus(a.scientificName);
    if (genusA && genusA === genus(b.scientificName)) signals.push("same_genus");
    return signals;
}

/** Seconds within which a low confidence alone is worth a look: one burst, not two subjects. */
export const LOW_CONFIDENCE_ONLY_WINDOW_SECONDS = 30;

/**
 * Low confidence is the norm (many analyses report 0.5), so on its own it only
 * counts inside a single burst. Related names, a shared genus or a group-only
 * label point at a naming slip at any distance inside the window.
 */
export function shouldQueue(signals: ReviewSignal[], secondsApart: number) {
    if (signals.some((signal) => signal !== "low_confidence")) return true;
    return signals.includes("low_confidence") && secondsApart <= LOW_CONFIDENCE_ONLY_WINDOW_SECONDS;
}

export function findReviewCandidates(
    captures: CaptureForReview[],
    {windowSeconds = REVIEW_WINDOW_SECONDS, maxDistanceM = REVIEW_MAX_DISTANCE_M} = {}
): ReviewCandidate[] {
    const byUser = new Map<string, CaptureForReview[]>();
    for (const capture of captures) {
        const list = byUser.get(capture.userId);
        if (list) list.push(capture);
        else byUser.set(capture.userId, [capture]);
    }

    const candidates: ReviewCandidate[] = [];
    for (const [userId, list] of Array.from(byUser)) {
        list.sort((left, right) => left.takenAt - right.takenAt || left.id.localeCompare(right.id));
        for (let i = 0; i < list.length; i += 1) {
            for (let j = i + 1; j < list.length; j += 1) {
                const a = list[i];
                const b = list[j];
                const secondsApart = Math.round((b.takenAt - a.takenAt) / 1000);
                if (secondsApart > windowSeconds) break;
                if (a.speciesProfileId === b.speciesProfileId) continue;

                const distanceM = distanceMeters(a, b);
                if (distanceM != null && distanceM > maxDistanceM) continue;

                const signals = reviewSignals(a, b);
                if (!shouldQueue(signals, secondsApart)) continue;
                candidates.push({userId, captureA: a, captureB: b, secondsApart, distanceM, signals});
            }
        }
    }
    return candidates;
}
