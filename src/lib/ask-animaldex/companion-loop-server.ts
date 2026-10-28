import "server-only";

/**
 * The companion loop's reads and writes, with the service role, as the apps'
 * `generate-applied-insight` does them (`loadCompanionLoop`,
 * `applyCompanionLines`, the referral take). The prompt text and the line
 * parsing live in `companion-focus.ts`.
 *
 * Every call fails quietly: a database without the migration, or one that
 * refuses, leaves the animal without the loop, never without an answer.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {
    companionDoneFields,
    parseCompanionRoster,
    parseCompanionState,
    resolveReferral,
    type CompanionBond,
    type CompanionLines,
    type CompanionRosterEntry,
    type CompanionState
} from "@/lib/ask-animaldex/companion-focus";

type Service = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

function warn(what: string, error: unknown) {
    const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error
        ? String((error as {message: unknown}).message)
        : String(error);
    console.warn(`[ask-animaldex] ${what} failed`, message.slice(0, 200));
}

/**
 * Whether the reader is talking to their own animal: the capture on screen is
 * theirs. Anyone else's card, or no card, is not the owner's chat.
 */
export async function readerOwnsCapture(userId: string | null, captureId: string | null): Promise<boolean> {
    if (!userId || !captureId) return false;
    const service = createSupabaseServiceClient();
    if (!service) return false;
    try {
        const {data, error} = await service.from("captures").select("user_id").eq("id", captureId).maybeSingle();
        if (error) {
            warn("capture owner read", error);
            return false;
        }
        return data?.user_id === userId;
    } catch (error) {
        warn("capture owner read", error);
        return false;
    }
}

export type OwnerCompanion = {
    service: Service;
    bond: CompanionBond | null;
    /** `animal_chat_owner_progress`: whether the Power is earned and the lesson check passed. */
    powerEarned: boolean;
    lessonCheckPassed: boolean;
    /** The loop, when it is on (personalisation on, not a Trial thread). */
    loop: {state: CompanionState | null; roster: CompanionRosterEntry[]; powerJustEarned: boolean} | null;
};

/**
 * Everything the owner's turn needs: the bond, where the Power stands and,
 * with the loop on, the loop itself. A Your Trial done since the lesson check
 * passed earns the Power first (`settle_animal_companion_power`), then the
 * state and their other animals are read for a referral.
 */
export async function loadOwnerCompanion(params: {
    userId: string;
    speciesProfileId: string;
    loopOn: boolean;
}): Promise<OwnerCompanion | null> {
    const service = createSupabaseServiceClient();
    if (!service) return null;
    const base = {p_user_id: params.userId, p_species_profile_id: params.speciesProfileId};

    const loadLoop = async (): Promise<OwnerCompanion["loop"]> => {
        try {
            const settled = await service.rpc("settle_animal_companion_power", base);
            if (settled.error) warn("settle_animal_companion_power", settled.error);
            const [state, roster] = await Promise.all([
                service.rpc("animal_companion_state", base),
                service.rpc("animal_companion_roster", {
                    p_user_id: params.userId,
                    p_exclude_species_profile_id: params.speciesProfileId,
                    p_limit: 40
                })
            ]);
            if (state.error) warn("animal_companion_state", state.error);
            if (roster.error) warn("animal_companion_roster", roster.error);
            return {
                state: parseCompanionState(state.data),
                roster: parseCompanionRoster(roster.data),
                powerJustEarned: settled.data === true
            };
        } catch (error) {
            warn("companion loop", error);
            return {state: null, roster: [], powerJustEarned: false};
        }
    };

    const loadBond = async (): Promise<CompanionBond | null> => {
        try {
            const {data, error} = await service.rpc("animal_companion_bond", base);
            if (error) warn("animal_companion_bond", error);
            return !error && data && typeof data === "object" ? data as CompanionBond : null;
        } catch (error) {
            warn("animal_companion_bond", error);
            return null;
        }
    };

    const loadProgress = async (): Promise<Record<string, unknown>> => {
        try {
            const {data, error} = await service.rpc("animal_chat_owner_progress", base);
            if (error) warn("animal_chat_owner_progress", error);
            return !error && data && typeof data === "object" ? data as Record<string, unknown> : {};
        } catch (error) {
            warn("animal_chat_owner_progress", error);
            return {};
        }
    };

    // The loop settles the Power first, so the progress read follows it.
    const loop = params.loopOn ? await loadLoop() : null;
    const [bond, progress] = await Promise.all([loadBond(), loadProgress()]);
    return {
        service,
        bond,
        powerEarned: Boolean(progress.power_earned),
        lessonCheckPassed: progress.training_passed !== false,
        loop
    };
}

/**
 * Writes what the animal did in this reply (its hidden lines) and says what
 * changed, for the `done` event: `companion` (the loop now) and, when a step
 * was completed, the new `bond`.
 */
export async function applyCompanionLines(params: {
    service: Service;
    userId: string;
    speciesProfileId: string;
    state: CompanionState | null;
    roster: CompanionRosterEntry[];
    lines: CompanionLines;
}): Promise<Record<string, unknown>> {
    const {service, userId, speciesProfileId, lines} = params;
    const base = {p_user_id: userId, p_species_profile_id: speciesProfileId};
    let focus = params.state?.focus?.focus ?? null;
    let openTrial = params.state?.open_trial?.step ?? null;
    let done = params.state?.your_trials_done ?? 0;
    let bond: CompanionBond | null = null;
    const event: Record<string, unknown> = {};
    try {
        if (lines.focus) {
            const {data, error} = await service.rpc("set_animal_companion_focus", {...base, p_focus: lines.focus});
            if (error) warn("set_animal_companion_focus", error);
            else if (data) focus = lines.focus;
        }
        // Only a step that was already open: one set in this same reply cannot be done yet.
        if (lines.done && params.state?.open_trial) {
            const {data, error} = await service.rpc("complete_animal_companion_trial", {...base, p_evidence: lines.done});
            if (error) warn("complete_animal_companion_trial", error);
            else if (data && typeof data === "object") {
                const result = data as Record<string, unknown>;
                event.trial_done = {
                    step: result.step ?? params.state.open_trial.step,
                    power_earned: result.power_earned === true,
                    power_waits_for_training: result.power_waits_for_training === true
                };
                done = Number(result.your_trials_done) || done + 1;
                openTrial = null;
                if (result.bond && typeof result.bond === "object") bond = result.bond as CompanionBond;
            }
        }
        if (lines.trial) {
            const {data, error} = await service.rpc("set_animal_companion_trial", {
                ...base,
                p_step: lines.trial.step,
                p_check_in_after_days: lines.trial.checkInAfterDays
            });
            if (error) warn("set_animal_companion_trial", error);
            else if (data) {
                openTrial = lines.trial.step;
                event.trial_set = {step: lines.trial.step};
            }
        }
        if (lines.refer) {
            const target = resolveReferral(lines.refer.key, params.roster);
            if (target) {
                const {data, error} = await service.rpc("create_animal_referral", {
                    p_user_id: userId,
                    p_from_species_profile_id: speciesProfileId,
                    p_to_species_profile_id: target.species_profile_id,
                    p_to_capture_id: target.capture_id,
                    p_problem: lines.refer.problem
                });
                if (error) warn("create_animal_referral", error);
                else if (data) {
                    event.referral = {
                        id: data,
                        species_profile_id: target.species_profile_id,
                        capture_id: target.capture_id,
                        animal: target.animal,
                        nickname: target.nickname
                    };
                }
            }
        }
    } catch (error) {
        warn("companion lines", error);
    }
    return companionDoneFields({focus, openTrial, yourTrialsDone: done, event, bond});
}

/** The animal it was sent to has now taken the problem up. */
export async function takeAnimalReferral(service: Service, userId: string, referralId: string): Promise<void> {
    try {
        const {error} = await service.rpc("take_animal_referral", {p_user_id: userId, p_id: referralId});
        if (error) warn("take_animal_referral", error);
    } catch (error) {
        warn("take_animal_referral", error);
    }
}
