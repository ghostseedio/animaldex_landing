/**
 * "Ask another animal" (2026-11-07): the web passes the request to the apps'
 * `generate-applied-insight` (`mode: "refer_animal"`) as the signed-in
 * reader, so the app and the web check and refuse alike (one validator, in
 * the function's `_shared/animal-referral-request.ts`). No model is asked: the
 * target's referral greeting opens on the problem when its chat greets with
 * the id (`useAskThread().greet({referralId})`).
 *
 * Request: {from_species_profile_id, to_species_profile_id, to_capture_id, problem}.
 * 200: {referral_id, referral: {id, species_profile_id, capture_id}}.
 * Otherwise {error}: invalid_request, problem_too_short, problem_too_long,
 * same_animal, unknown_animal, capture_not_that_animal (400), not_your_animal
 * (403), rate_limited (429), referral_refused (422), referral_failed (500),
 * plus the age response and, from this route, not_authenticated (401) and
 * unavailable (503/502).
 */

const FIELDS = ["from_species_profile_id", "to_species_profile_id", "to_capture_id", "problem"] as const;

/** The function's request: only the four fields, as sent. */
export function referAnimalUpstreamBody(body: Record<string, unknown>): Record<string, unknown> {
    const referral: Record<string, unknown> = {};
    for (const field of FIELDS) referral[field] = body[field] ?? null;
    return {mode: "refer_animal", refer_animal: referral};
}

/** What the reader gets back from the function's answer. */
export function referAnimalReply(status: number, payload: unknown): {status: number; body: Record<string, unknown>} {
    const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const referral = data.referral && typeof data.referral === "object" ? data.referral as Record<string, unknown> : null;
    if (status === 200 && typeof data.referral_id === "string" && data.referral_id) {
        return {
            status: 200,
            body: {
                referral_id: data.referral_id,
                referral: {
                    id: data.referral_id,
                    species_profile_id: typeof referral?.species_profile_id === "string" ? referral.species_profile_id : null,
                    capture_id: typeof referral?.capture_id === "string" ? referral.capture_id : null
                }
            }
        };
    }
    const error = typeof data.error === "string" && data.error ? data.error : "unavailable";
    return {status: status >= 400 ? status : 502, body: {error, ...(typeof data.reason === "string" ? {reason: data.reason} : {})}};
}
