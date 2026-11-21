/// Captures + thrive (owner brief 2026-11-11, section 3: "Step offers in chat: what the step does for
/// their animals"). When an animal sets its person a step, it may say, in its own words, what a step
/// that works does for their animals of its kind on the Ark: it keeps them thriving.
///
/// Facts and a principle only, never words to say (owner rule: no hardcoded replies). Nothing is added
/// unless the capture regime is on (voyage_config.capture_arrivals), the person has living animals of
/// this kind aboard, and it is the owner's own turn (no call, no visitor or public chat, no sensitive
/// focus): otherwise the prompt is exactly as it was. The inline offer line under a step is UI copy
/// (voyage_step_offer_state_v1, the clients' labels), not this.

export type ArkStepThriveAdmin = {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ArkThriveBand = "ordinary" | "good" | "prime";

export type ArkStepThriveFacts = {
    enabled: boolean;
    livingBrought: number;
    bandNow: ArkThriveBand;
    bandIfWorked: ArkThriveBand;
};

export type ArkStepThriveTurn = {
    audience: string;
    call: boolean;
    greeting: boolean;
    focusSensitive: boolean;
};

const BANDS: ArkThriveBand[] = ["ordinary", "good", "prime"];
const band = (v: unknown): ArkThriveBand | null => (BANDS.includes(v as ArkThriveBand) ? v as ArkThriveBand : null);

export function parseArkStepThriveFacts(data: unknown): ArkStepThriveFacts | null {
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    const now = band(d.band_now), next = band(d.band_if_worked);
    const living = Number(d.living_brought);
    if (!now || !next || !Number.isFinite(living)) return null;
    return { enabled: d.enabled === true, livingBrought: Math.max(0, Math.min(2, Math.trunc(living))), bandNow: now, bandIfWorked: next };
}

/// Null on any failure (no migration, a timeout): then nothing is added.
export async function loadArkStepThrive(
    admin: ArkStepThriveAdmin,
    params: { userId: string; speciesProfileId: string },
): Promise<ArkStepThriveFacts | null> {
    try {
        const { data, error } = await admin.rpc("voyage_step_thrive_facts_v1", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
        });
        if (error) {
            console.warn("voyage_step_thrive_facts_v1 failed", error.message);
            return null;
        }
        return parseArkStepThriveFacts(data);
    } catch (error) {
        console.warn("ark step thrive unavailable", error instanceof Error ? error.message : String(error));
        return null;
    }
}

/// Plain words for a band, as the tap card says them.
const BAND_WORDS: Record<ArkThriveBand, string> = {
    ordinary: "ordinary condition",
    good: "good condition",
    prime: "prime condition",
};

/// The prompt's line, or [] (the prompt unchanged).
export function arkStepThrivePromptLines(facts: ArkStepThriveFacts | null, turn: ArkStepThriveTurn): string[] {
    if (!facts?.enabled || facts.livingBrought < 1) return [];
    if (turn.audience !== "owner" || turn.call || turn.greeting || turn.focusSensitive) return [];
    const known = {
        your_kind_they_brought_aboard: facts.livingBrought,
        their_condition_now: BAND_WORDS[facts.bandNow],
        if_the_next_step_works: BAND_WORDS[facts.bandIfWorked],
    };
    return [
        `ark_step — on the Ark (the shared world in the app where people's animals live together) this person has animals of your kind that they brought aboard. Steps they take with you that work keep those animals thriving: healthier, more lively, safer from predators and likelier to raise young. It is true, and theirs to know:\n${
            JSON.stringify(known)
        }\nOnly when this reply sets them a step: you may add, once and in your own words, what it would do for their animals of your kind on the Ark if it works, as a small true consequence beside the real reason the step helps them, never instead of it. Never as a bargain, a reward, a score or pressure; never with numbers; never when the step is about something painful; and never mention the Ark at all if you are not setting a step.`,
    ];
}
