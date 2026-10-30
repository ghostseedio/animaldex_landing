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
    type CompanionOpenTrial,
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
    /** `animal_chat_owner_progress`: whether the Power is earned (`training_passed` is always true since 3.2). */
    powerEarned: boolean;
    lessonCheckPassed: boolean;
    /** The loop, when it is on (personalisation on, not a Trial thread). */
    loop: {
        state: CompanionState | null;
        roster: CompanionRosterEntry[];
        powerJustEarned: boolean;
        /**
         * 3.2: this message is their report on the open step ("I did it",
         * `step_report`), already attached through `attach_animal_step_report_v1`,
         * with how many photos or videos they added. Only for the step that
         * is open now; null otherwise.
         */
        stepReport: StepReport | null;
    } | null;
};

export type StepReport = {stepId: string; mediaCount: number};

/**
 * The report a `step_report` names, checked against the step that is open:
 * a stale or someone else's step id is no report. The media is counted from
 * the row (`media_paths`), never from the request.
 */
async function readStepReport(service: Service, userId: string, open: CompanionOpenTrial | null, stepId: string | null): Promise<StepReport | null> {
    if (!stepId || !open || open.id.toLowerCase() !== stepId.toLowerCase()) return null;
    try {
        const {data, error} = await service
            .from("animal_companion_trials")
            .select("media_paths")
            .eq("id", stepId)
            .eq("user_id", userId)
            .maybeSingle();
        if (error) {
            warn("step report read", error);
            return {stepId, mediaCount: 0};
        }
        const paths: unknown = data?.media_paths;
        const count = Array.isArray(paths) ? paths.filter((path) => typeof path === "string" && path.trim()).length : 0;
        return {stepId, mediaCount: count};
    } catch (error) {
        warn("step report read", error);
        return {stepId, mediaCount: 0};
    }
}

/**
 * Everything the owner's turn needs: the bond, where the Power stands and,
 * with the loop on, the loop itself. A step done earns the Power first
 * (`settle_animal_companion_power`; since 3.2 any first done step does), then
 * the state and their other animals are read for a referral.
 */
export async function loadOwnerCompanion(params: {
    userId: string;
    speciesProfileId: string;
    loopOn: boolean;
    /** `step_report.step_id` on the request: they tapped "I did it" on this step. */
    stepReportId?: string | null;
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
            const parsed = parseCompanionState(state.data);
            return {
                state: parsed,
                roster: parseCompanionRoster(roster.data),
                powerJustEarned: settled.data === true,
                stepReport: await readStepReport(service, params.userId, parsed?.open_trial ?? null, params.stepReportId ?? null)
            };
        } catch (error) {
            warn("companion loop", error);
            return {state: null, roster: [], powerJustEarned: false, stepReport: null};
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
    let openStep: CompanionOpenTrial | null = params.state?.open_trial ?? null;
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
                // 3.2: the step pays +5 XP (at most one a day per animal); the
                // Power never waits for a lesson check any more.
                const xp = Number(result.xp ?? result.xp_awarded);
                event.trial_done = {
                    step: result.step ?? params.state.open_trial.step,
                    power_earned: result.power_earned === true,
                    xp: Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0
                };
                done = Number(result.your_trials_done) || done + 1;
                openStep = null;
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
                const id = typeof data === "string" ? data : null;
                // The id is the step the card under this reply acts on. The
                // same step set again keeps the one already open, as it was.
                if (id && id !== openStep?.id) {
                    openStep = {id, step: lines.trial.step, set_at: new Date().toISOString(), accepted_at: null, trial_frequency: null, has_report: false};
                }
                event.trial_set = {step: lines.trial.step, ...(id ? {id} : {})};
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
    return companionDoneFields({focus, openStep, yourTrialsDone: done, event, bond});
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
