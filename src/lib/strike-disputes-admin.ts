/**
 * Strike disputes, for /admin/disputes.
 *
 * People dispute a strike from the app (iOS 3.3 Settings, Account standing):
 * `submit_strike_dispute` stores their statement, a link and photos in the
 * private `strike-dispute-evidence` bucket. A person decides here, through
 * `admin_resolve_strike_dispute` (AnimalDex migration 20261017235500):
 *   - uphold keeps the strike and needs a note, because the person is told why;
 *   - overturn removes it through `admin_revoke_account_strike`, puts the photo
 *     back when it was public before, and lifts a suspension it caused.
 * No automated review runs (Vision and Claude are paid; owner's call).
 */

export type DisputeStatus = "submitted" | "overturned" | "upheld";
export type DisputeStatusFilter = DisputeStatus | "all";
export type DisputeDecision = "overturn" | "uphold";

export const DISPUTE_STATUS_FILTERS: readonly DisputeStatusFilter[] = ["submitted", "overturned", "upheld", "all"];

export const DISPUTE_CLAIM_LABELS: Record<string, string> = {
    own_photo: "It's my own photo",
    real_animal: "It's a real, living animal",
    through_glass: "I took it through glass",
    other: "Something else",
};

export const VIOLATION_KIND_LABELS: Record<string, string> = {
    screen_capture_likely: "Photo of a screen",
    poster_or_print_likely: "Photo of a print or poster",
    artwork_or_mural_likely: "Artwork, not a real animal",
    ai_generated_likely: "AI-generated or edited",
};

export type DisputeImageRef = {bucket: string; path: string; cardBucket: string | null; cardPath: string | null; mediaKind: string | null};

/** admin_strike_dispute_payload, as the RPC answers it. */
export type StrikeDispute = {
    id: string;
    status: DisputeStatus;
    claim: string;
    statement: string;
    sourceUrl: string | null;
    createdAt: string;
    decidedAt: string | null;
    decidedBy: string | null;
    decisionNote: string | null;
    automatedReview: unknown;
    user: {id: string; username: string | null; displayName: string | null; standing: string; activeStrikes: number};
    strike: {id: string; reason: string; createdAt: string; revokedAt: string | null; actor: string | null};
    violation: {kind: string; confidence: number | null; findings: unknown; acquisitionKind: string | null} | null;
    capture: {
        id: string;
        capturedAt: string | null;
        locationLabel: string | null;
        lat: number | null;
        lng: number | null;
        acquisitionKind: string | null;
        image: DisputeImageRef | null;
        provenance: unknown[];
    } | null;
    evidence: {id: string; kind: string; path: string; mimeType: string | null; byteSize: number | null; metadata: unknown}[];
};

/** What the API route hands the page: the dispute plus short-lived signed URLs. */
export type StrikeDisputeView = StrikeDispute & {
    captureImageUrl: string | null;
    evidenceUrls: Record<string, string | null>;
};

export const EVIDENCE_BUCKET = "strike-dispute-evidence";

export function normalizeStatusFilter(value: string | null | undefined): DisputeStatusFilter {
    const v = (value ?? "").trim().toLowerCase();
    return (DISPUTE_STATUS_FILTERS as readonly string[]).includes(v) ? (v as DisputeStatusFilter) : "submitted";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DECISION_NOTE_MAX = 1000;

export type DecisionRequest = {disputeId: string; decision: DisputeDecision; note: string | null};

/** Validates the page's POST body before anything reaches the database. */
export function parseDecisionRequest(body: unknown): {ok: true; value: DecisionRequest} | {ok: false; error: string} {
    if (!body || typeof body !== "object") return {ok: false, error: "Body must be a JSON object."};
    const raw = body as Record<string, unknown>;
    const disputeId = typeof raw.disputeId === "string" ? raw.disputeId.trim() : "";
    if (!UUID.test(disputeId)) return {ok: false, error: "disputeId must be a UUID."};
    const decision = raw.decision;
    if (decision !== "overturn" && decision !== "uphold") return {ok: false, error: "decision must be overturn or uphold."};
    const note = typeof raw.note === "string" ? raw.note.trim() : "";
    if (note.length > DECISION_NOTE_MAX) return {ok: false, error: `The note is longer than ${DECISION_NOTE_MAX} characters.`};
    if (decision === "uphold" && note === "") {
        return {ok: false, error: "Upholding needs a note: the person is told why the strike stays."};
    }
    return {ok: true, value: {disputeId, decision, note: note || null}};
}

/** The database's exception names, as a sentence for the operator. */
export function describeResolveError(detail: string): string {
    if (detail.includes("dispute_already_decided")) return "Someone already decided this dispute. Refresh the list.";
    if (detail.includes("dispute_not_found")) return "That dispute no longer exists.";
    if (detail.includes("dispute_note_required")) return "Upholding needs a note.";
    if (detail.includes("admin_resolve_strike_dispute") || detail.includes("PGRST202")) {
        return "Disputes are not installed. Apply AnimalDex migration 20261017235500_strike_disputes.sql.";
    }
    return `The decision failed: ${detail.slice(0, 300)}`;
}

/** The photo to sign for a dispute's flagged capture: the 640 card when there is one, else the original. */
export function captureImageToSign(dispute: Pick<StrikeDispute, "capture">): {bucket: string; path: string} | null {
    const image = dispute.capture?.image;
    if (!image) return null;
    if (image.cardBucket && image.cardPath) return {bucket: image.cardBucket, path: image.cardPath};
    if (image.bucket && image.path && (!image.mediaKind || image.mediaKind === "photo")) return {bucket: image.bucket, path: image.path};
    return null;
}

/** Findings are stored as a list of short strings; anything else is shown as nothing. */
export function findingsList(findings: unknown): string[] {
    return Array.isArray(findings) ? findings.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

/** How long a dispute has waited, in whole days. */
export function ageInDays(createdAt: string, now: Date = new Date()): number {
    const at = Date.parse(createdAt);
    if (!Number.isFinite(at)) return 0;
    return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000));
}
