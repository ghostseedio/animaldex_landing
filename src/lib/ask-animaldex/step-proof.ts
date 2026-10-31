/**
 * The step proof (owner, 2026-10-31; the apps' docs/your-step/PROOF.md): the
 * photo or video a person adds to "I did it" is looked at against the step
 * before the animal replies. A confirmed proof adds +5 XP when the step is
 * done and pays (server side); the animal hears what was seen (`proof.seen`)
 * and adds nothing of its own. A step still counts without proof.
 *
 * The web route asks the apps' `check-animal-step-proof` edge function (with
 * the reader's JWT and `{step_id}`), which runs the same check
 * `generate-applied-insight` does and stores its result. This decodes what
 * comes back; anything unreadable, slow or failed is `failed`.
 */

export type StepProofStatus = "confirmed" | "unclear" | "not_shown" | "failed";
export const STEP_PROOF_STATUSES: readonly StepProofStatus[] = ["confirmed", "unclear", "not_shown", "failed"];

/** What the animal is told about the photo or video; `seen` is null when failed. */
export type StepProof = {status: StepProofStatus; seen: string | null};

/** The check, downloads and models included, gets about 12 s; the route stops waiting then. */
export const STEP_PROOF_WAIT_MS = 12_000;

/** A stored or returned status, or null when it is none of the four. */
export function storedStepProofStatus(value: unknown): StepProofStatus | null {
    return STEP_PROOF_STATUSES.includes(value as StepProofStatus) ? value as StepProofStatus : null;
}

/**
 * `check-animal-step-proof`'s answer: `{status, seen}`, or `{status: null}`
 * when the step has no media (null: nothing to say). A refusal, an error or a
 * malformed answer is `failed`.
 */
export function decodeStepProofResponse(ok: boolean, payload: unknown): StepProof | null {
    const row = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
    if (!ok || !row) return {status: "failed", seen: null};
    if (row.status === null) return null;
    const status = storedStepProofStatus(row.status);
    if (!status) return {status: "failed", seen: null};
    const seen = status !== "failed" && typeof row.seen === "string" ? row.seen.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    return {status, seen: seen || null};
}
