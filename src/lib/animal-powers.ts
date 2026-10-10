/**
 * Animal Powers, ported from the iOS source of truth (`AnimalDex/Models/AnimalPower.swift`).
 *
 * Finding the animal reveals the Power. Applying it earns the Power. The
 * knowledge is never locked — it is what creates the wanting — so this model
 * always carries the lesson and only the earned state varies.
 *
 * IDENTITY IS `speciesProfileId`. `species_behavior_principles` is keyed by it
 * and has no surrogate id, and the principle NAME is authored content that gets
 * rewritten. Nothing here compares or joins on a name.
 */

import {trackEvent} from "@/lib/analytics";
import {
    DOMAIN_PREFERRED_ORDER,
    type SystemDynamicsDomain,
    normalizeDomain
} from "@/lib/system-dynamics";

/** How a Power was earned. Both routes grant the same Power; neither is lesser. */
export type AnimalPowerRoute = "trial" | "application";

export function earnedLabel(route: AnimalPowerRoute | null) {
    switch (route) {
        case "trial": return "Earned by Trial";
        case "application": return "Earned by applying it";
        default: return "Earned";
    }
}

/** One row of `animal_powers_for_viewer_v1`. */
export type AnimalPower = {
    speciesProfileId: string;
    speciesDisplayName: string;
    /**
     * The CURRENT name. A rename shows through here immediately, while the
     * earned state below is unaffected by it.
     */
    principleName: string;
    coreLesson: string | null;
    principleExpression: string | null;
    shortMotto: string | null;

    isEarned: boolean;
    earnedAt: string | null;
    earnedVia: AnimalPowerRoute | null;
    sourceDomain: string | null;
    sourceTrialFrequency: string | null;
    /** What it was called on the day it was earned, when that differs. */
    principleNameAtEarning: string | null;

    /**
     * 729 species have a Power and no authored Trial, so the written route is
     * not a convenience — for those animals it is the only way in.
     */
    hasTrial: boolean;

    /** The animal's own System Dynamics domains, most-mapped first. */
    suggestedDomains: SystemDynamicsDomain[];
};

/**
 * Why Play is or is not open for one capture, mirroring
 * `capture_power_gate_status` in the database.
 *
 * Four states and not a boolean, because two of them permit the action WITHOUT
 * the Power having been earned: a species we never authored a Power for, and a
 * capture that never resolved to a species at all. Those are our content gaps,
 * and the UI must let the person play while never claiming they earned
 * anything — a lock they cannot open, or a badge they did not win, would both
 * be lies.
 */
export type PowerGateStatus =
    | "earned"
    | "not_earned"
    | "not_applicable_missing_power"
    | "not_applicable_unresolved_species";

const POWER_GATE_STATUSES: PowerGateStatus[] = [
    "earned", "not_earned", "not_applicable_missing_power", "not_applicable_unresolved_species"
];

/**
 * May this capture be used for Comparison and Fusion? True for `earned` AND for
 * both transitional states. Never read this to decide whether to show an earned
 * badge.
 */
export function gatePermitsPlay(status: PowerGateStatus) {
    return status !== "not_earned";
}

/** Should the UI show a lock and route toward earning? */
export function gateIsLocked(status: PowerGateStatus) {
    return status === "not_earned";
}

/**
 * One row of `capture_play_eligibility_v1`: everything the picker needs about
 * one of the viewer's own captures, fetched in bulk.
 */
export type CapturePlayEligibility = {
    captureId: string;
    canonicalSpeciesProfileId: string | null;
    principleName: string | null;
    powerGateStatus: PowerGateStatus;
    zooComparisonBanned: boolean;
    challengeHealth: number;
};

export type CapturePlayEligibilityMap = Record<string, CapturePlayEligibility>;

/**
 * Is Comparison closed to this person because NONE of the animals they could
 * send has earned its Power?
 *
 * The gate is on the attacker. So on somebody else's card the question is about
 * the viewer's own animals, never about the animal on screen.
 *
 * Fails OPEN wherever the answer is not known: no eligibility read yet, no
 * candidates at all (a different problem with its own message), or a candidate
 * with no row. The picker and the server remain the authority; this only
 * decides whether the entry point should look locked.
 */
export function allChallengersPowerLocked(
    candidateIds: string[],
    eligibility: CapturePlayEligibilityMap | null | undefined
) {
    if (!eligibility || !candidateIds.length) return false;
    return !candidateIds.some((id) => {
        const row = eligibility[id.toLowerCase()];
        return row ? gatePermitsPlay(row.powerGateStatus) : true;
    });
}

// MARK: - Applying it

/** The verdict on one written application, mirroring `_shared/power-application-rubric.ts`. */
export type PowerApplicationVerdict = "approved" | "needs_more" | "rejected";

export type PowerApplicationResult = {
    verdict: PowerApplicationVerdict;
    reason: string;
    /**
     * The clause the grader quoted back. The reward screen echoes this, so the
     * person sees the specific thing they did named back to them.
     */
    quotedAction: string;
    /**
     * True only on the submission that actually created the Power. A second
     * approval through the other route returns false and pays nothing.
     */
    grantedPower: boolean;
    rejectionsRemaining: number;
    /** The grader's read on whether the photo or video shows what was written. */
    evidenceMatches?: boolean;
};

/** A photo is one image; a video is the frames sampled from it in the browser. */
export type PowerApplicationEvidenceType = "photo" | "video";

/**
 * The evidence the written route now requires. Mirrors the server contract in
 * `verify-power-application`: a photo is exactly one image, a video is 2–4
 * sampled frames. The clip itself is never uploaded.
 */
export const POWER_APPLICATION_EVIDENCE = {
    bucket: "journal-proofs",
    frameCount: 4,
    minFrames: 2,
    maxFrames: 4,
    firstFrameFraction: 0.05,
    lastFrameFraction: 0.95,
    maxLongEdge: 768,
    jpegQuality: 0.7,
    /** The bucket accepts only these, so anything else is refused before upload. */
    photoTypes: ["image/jpeg", "image/png", "image/webp"] as readonly string[]
} as const;

export const POWER_APPLICATION_LIMITS = {
    /** Mirrors POWER_APPLICATION_MAX_REJECTIONS in the shared rubric. */
    maxRejections: 3,
    minCharacters: 80,
    maxCharacters: 1500
} as const;

/** What to actually show someone. Never a raw code. */
export function powerRefusalMessage(code: string, serverMessage?: string | null) {
    switch (code) {
        case "already_earned":
            return "You have already earned this Power.";
        case "application_attempts_exhausted":
            return "You have used your attempts on this Power for now. The Trial is still open.";
        case "account_too_short":
            return "Tell us a bit more about what you actually did.";
        case "account_too_long":
            return "That is longer than we can check. Keep it to the one thing you did.";
        case "domain_not_allowed":
            return "Pick one of the listed areas of life.";
        case "power_not_found":
            return "This animal has no Power to earn yet.";
        case "species_not_unlocked":
            return "You don't own this index yet. Capture this animal first.";
        case "grading_unavailable":
            // Explicitly NOT phrased as a refusal. Nothing was graded and no
            // attempt was spent, so the copy must not imply otherwise.
            return "We could not check that right now. Nothing was used up — try again in a moment.";
        case "server_configuration":
            return "Reviewing is offline right now. Nothing was lost.";
        case "evidence_required":
            return "Add a photo or video of what you did.";
        case "video_frames_required":
            return "That video could not be read. Try recording it again.";
        case "evidence_path_not_owned":
        case "evidence_download_failed":
            return "Your photo or video did not finish uploading. Try adding it again.";
        default:
            return serverMessage || "Could not check that right now. Try again in a moment.";
    }
}

// MARK: - Where it was used

/**
 * Where a person actually lives their life, in the order to offer it.
 *
 * PRESENTATION ONLY. The canonical 18 are untouched and every one of them stays
 * reachable; this is which six to show before "More", so that "Where did you
 * use this Power?" opens as a question anybody can answer rather than a wall of
 * eighteen categories.
 */
export const EVERYDAY_APPLICATION_ORDER: SystemDynamicsDomain[] = [
    "HUMAN_BEHAVIOR",
    "BUSINESS",
    "MONEY_FINANCE",
    "SPORT_ATHLETICS",
    "TECHNOLOGY",
    "STRATEGY"
];

const ALL_DOMAINS: SystemDynamicsDomain[] = [
    "MONEY_FINANCE", "BUSINESS", "HUMAN_BEHAVIOR", "PLANT_KINGDOM", "FOOD_NUTRITION",
    "SPORT_ATHLETICS", "TECHNOLOGY", "ENTERTAINMENT", "ARCHITECTURE", "TRANSPORT",
    "STRATEGY", "PEOPLE_HISTORY_POWER", "PLACE_GEOGRAPHY", "STARS", "MUSIC",
    "ART", "ENGINEERING", "NATURAL_FORCES"
];

/** Every domain on offer. `UNKNOWN` is a decoding fallback, never a choice. */
export const OFFERED_APPLICATION_DOMAINS: SystemDynamicsDomain[] = [
    ...DOMAIN_PREFERRED_ORDER,
    ...ALL_DOMAINS.filter((domain) => !DOMAIN_PREFERRED_ORDER.includes(domain))
];

/**
 * Six domains: the animal's own best-mapped ones first where the content
 * actually says anything, then the everyday order.
 *
 * The ranking is deliberately weak-but-honest. Only 38 of 1,789 species have
 * any variance in how much their cross-domain matrix says per domain, so for
 * nearly everything this falls through to the everyday order.
 */
export function applicationDomainShortlist(power: AnimalPower): SystemDynamicsDomain[] {
    const ranked = power.suggestedDomains.filter((domain) => EVERYDAY_APPLICATION_ORDER.includes(domain));
    const result: SystemDynamicsDomain[] = [];
    for (const domain of [...ranked, ...EVERYDAY_APPLICATION_ORDER]) {
        if (result.includes(domain)) continue;
        result.push(domain);
        if (result.length === 6) break;
    }
    return result;
}

// MARK: - Row decoding

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

/** Decodes one `animal_powers_for_viewer_v1` row; null when it names no Power. */
export function decodeAnimalPower(row: any): AnimalPower | null {
    const speciesProfileId = str(row?.species_profile_id);
    const principleName = str(row?.principle_name);
    if (!speciesProfileId || !principleName) return null;

    const earnedVia = str(row?.earned_via);

    return {
        speciesProfileId,
        speciesDisplayName: str(row?.species_display_name) ?? "This animal",
        principleName,
        coreLesson: str(row?.core_lesson),
        principleExpression: str(row?.principle_expression),
        shortMotto: str(row?.short_motto),
        isEarned: row?.is_earned === true,
        earnedAt: str(row?.earned_at),
        earnedVia: earnedVia === "trial" || earnedVia === "application" ? earnedVia : null,
        sourceDomain: str(row?.source_domain),
        sourceTrialFrequency: str(row?.source_trial_frequency),
        principleNameAtEarning: str(row?.principle_name_at_earning),
        hasTrial: row?.has_trial === true,
        // `normalizeDomain`, not a cast: retired raw values like CURRENCY_STYLE
        // still sit in the matrix and must fold onto their successor.
        suggestedDomains: (Array.isArray(row?.suggested_domains) ? row.suggested_domains : [])
            .map((domain: unknown) => normalizeDomain(String(domain)))
            .filter((domain: SystemDynamicsDomain, index: number, all: SystemDynamicsDomain[]) =>
                domain !== "UNKNOWN" && all.indexOf(domain) === index)
    };
}

export function decodeCapturePlayEligibility(row: any): CapturePlayEligibility | null {
    const captureId = str(row?.capture_id);
    if (!captureId) return null;
    const status = str(row?.power_gate_status);

    return {
        captureId: captureId.toLowerCase(),
        canonicalSpeciesProfileId: str(row?.canonical_species_profile_id),
        principleName: str(row?.principle_name),
        // An unrecognised status must never read as earned. Falling back to the
        // permissive-but-not-earned state keeps a future server value from
        // silently unlocking a badge.
        powerGateStatus: (POWER_GATE_STATUSES as string[]).includes(status ?? "")
            ? status as PowerGateStatus
            : "not_applicable_unresolved_species",
        zooComparisonBanned: row?.zoo_comparison_banned === true,
        challengeHealth: Number.isFinite(Number(row?.challenge_health)) ? Number(row.challenge_health) : 3
    };
}

// MARK: - Telemetry

/**
 * IMPRESSIONS ARE DEDUPLICATED. React re-renders whenever anything upstream
 * changes, so each (event, species) pair is recorded at most once per page
 * load, which is what makes "how many people saw a lock" answerable at all.
 *
 * NOTHING THE PERSON WROTE IS EVER SENT. No application text, no Trial
 * evidence, no grader reasoning — only the species id and the route.
 */
const seenImpressions = new Set<string>();

function track(name: string, speciesProfileId: string | null | undefined, extra: Record<string, string> = {}) {
    trackEvent(name, {species_profile_id: speciesProfileId ?? "unknown", ...extra});
}

function once(name: string, speciesProfileId: string | null | undefined) {
    const key = `${name}:${speciesProfileId ?? "unknown"}`;
    if (seenImpressions.has(key)) return;
    seenImpressions.add(key);
    track(name, speciesProfileId);
}

export const powerGateAnalytics = {
    lockedComparisonImpression: (speciesProfileId?: string | null) => once("locked_comparison_impression", speciesProfileId),
    lockedFusionImpression: (speciesProfileId?: string | null) => once("locked_fusion_impression", speciesProfileId),
    /** Taps are NOT deduplicated: tapping twice is two real intentions. */
    lockedComparisonEarnTap: (speciesProfileId?: string | null) => track("locked_comparison_earn_tap", speciesProfileId),
    lockedFusionEarnTap: (speciesProfileId?: string | null) => track("locked_fusion_earn_tap", speciesProfileId),
    powerEarned: (speciesProfileId: string | null | undefined, via: AnimalPowerRoute | null) =>
        track("power_earned", speciesProfileId, {earned_via: via ?? "unknown"})
};
