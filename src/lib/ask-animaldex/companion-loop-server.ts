import "server-only";

/**
 * The companion loop's reads and writes, with the service role, as the apps'
 * `generate-applied-insight` does them (`loadCompanionLoop`,
 * `applyCompanionLines`, the referral take, and since 3.2 Debates
 * `loadDebateChatState` and `noteDebateOffer`). The prompt text and the line
 * parsing live in `companion-focus.ts`.
 *
 * Every call fails quietly: a database without the migration, or one that
 * refuses, leaves the animal without the loop, never without an answer.
 */

import {newStepAllowed} from "@/lib/ask-animaldex/reply-guards";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {STEP_PROOF_WAIT_MS, decodeStepProofResponse, type StepProof} from "@/lib/ask-animaldex/step-proof";
import {
    NO_DEBATE,
    companionDoneFields,
    debateChatState,
    describeStepMedia,
    type DebateChatState,
    parseCompanionRoster,
    parseCompanionState,
    parseCompanionStepDebate,
    resolveReferral,
    type CompanionBond,
    type CompanionLines,
    type CompanionOpenTrial,
    type CompanionRosterEntry,
    type CompanionState,
    type CompanionStepDebate,
    type CompanionStepReport
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
    /** `animal_chat_owner_progress`: whether the Power is earned. */
    powerEarned: boolean;
    /**
     * `animal_chat_owner_progress` as it came (3.2: `loop_step`, `warmup`
     * {available, passed}, the Trials, debates), for `companionWarmup`. The
     * prompt does not carry it as owner_progress on the web.
     */
    progress: Record<string, unknown>;
    /**
     * 3.2 Debates (`debate_chat_state`): whether the animal may offer a debate
     * in this reply (`companion.debate.may_offer`) and whether a call may hand
     * one to the chat (`may_hand_over`). Only asked when the turn allows it
     * (`debateState` on the call) and the Power is earned; both false otherwise.
     */
    debate: DebateChatState;
    /** The loop, when it is on (personalisation on, not a Trial thread). */
    loop: {
        state: CompanionState | null;
        roster: CompanionRosterEntry[];
        powerJustEarned: boolean;
        /**
         * 3.2: this message is their report on the open step ("I did it",
         * `step_report`), already attached through `attach_animal_step_report_v1`,
         * with what they added in words ("a video", "2 photos"). Only for the
         * step that is open now; null otherwise.
         */
        stepReport: StepReport | null;
    } | null;
};

export type StepReport = CompanionStepReport & {stepId: string};

/**
 * The report a `step_report` names, checked against the step that is open:
 * a stale or someone else's step id is no report (an ordinary message). What
 * was attached is read from the row (`media_paths`), never from the request,
 * and said in words (`describeStepMedia`). The apps' `loadStepReport`.
 *
 * With a photo or video, the proof check (owner, 2026-10-31; the apps'
 * docs/your-step/PROOF.md) is the apps' `check-animal-step-proof`, asked with
 * the reader's own session: it reuses a stored result or runs the check and
 * stores it, so a confirmed proof adds +5 XP when the step is done. A failed,
 * refused or slow check (about 12 s) is `failed`: the animal is told nobody
 * could look at it. It never throws.
 */
async function readStepReport(service: Service, userId: string, open: CompanionOpenTrial | null, stepId: string | null): Promise<StepReport | null> {
    if (!stepId) return null;
    if (!open || open.id.toLowerCase() !== stepId.toLowerCase()) {
        console.warn("[ask-animaldex] step_report is not the open step", stepId);
        return null;
    }
    let media: string | null = null;
    // The debate the step came from, if any: the animal may point back to the
    // other ways when it did not work. Read alongside the media and the proof.
    const debate = readStepDebate(service, userId, open.id);
    try {
        const {data, error} = await service
            .from("animal_companion_trials")
            .select("media_paths")
            .eq("id", open.id)
            .eq("user_id", userId)
            .eq("status", "open")
            .maybeSingle();
        if (error) {
            warn("step report read", error);
            return {stepId: open.id, media: null, debate: await debate};
        }
        const raw: unknown = data?.media_paths;
        const paths = Array.isArray(raw) ? raw.filter((path): path is string => typeof path === "string") : [];
        media = describeStepMedia(paths);
        if (!media) return {stepId: open.id, media: null, debate: await debate};
        return {stepId: open.id, media, proof: await askStepProof(open.id), debate: await debate};
    } catch (error) {
        warn("step report read", error);
        return {stepId: open.id, media, debate: await debate};
    }
}

/** `animal_step_debate_context_v1`: the way they chose and the others still there; null when the step was not a debate's way. */
async function readStepDebate(service: Service, userId: string, stepId: string): Promise<CompanionStepDebate | null> {
    try {
        const {data, error} = await service.rpc("animal_step_debate_context_v1", {p_user_id: userId, p_trial_id: stepId});
        if (error) {
            warn("animal_step_debate_context_v1", error);
            return null;
        }
        return parseCompanionStepDebate(data);
    } catch (error) {
        warn("animal_step_debate_context_v1", error);
        return null;
    }
}

/** `check-animal-step-proof` for the open step; `failed` on any error or after about 12 s. */
async function askStepProof(stepId: string): Promise<StepProof | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<StepProof>((resolve) => {
        timer = setTimeout(() => resolve({status: "failed", seen: null}), STEP_PROOF_WAIT_MS);
    });
    const asked = invokeAuthenticatedSupabaseFunctionResponse("check-animal-step-proof", {step_id: stepId})
        .then((result) => {
            if (!result.ok) console.warn("[ask-animaldex] check-animal-step-proof", result.status, String(result.payload?.error ?? "").slice(0, 120));
            return decodeStepProofResponse(result.ok, result.payload);
        })
        .catch((error): StepProof => {
            warn("check-animal-step-proof", error);
            return {status: "failed", seen: null};
        });
    try {
        return await Promise.race([asked, late]);
    } finally {
        clearTimeout(timer);
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
    /**
     * 3.2 Debates: everything but the Power and `debate_chat_state` allows a
     * debate offer (or, on a call, a hand-over) in this reply: the request takes
     * debates, the loop is on, not a greeting, steps are offered, no crisis
     * words, and in a chat no debate marker in the conversation yet.
     */
    debateState?: boolean;
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

    // The loop settles the Power first, so the progress read follows it, and
    // the debate state only once the Power is earned, as in the apps.
    const loop = params.loopOn ? await loadLoop() : null;
    const [bond, [progress, debate]] = await Promise.all([
        loadBond(),
        loadProgress().then(async (progress) => [
            progress,
            params.debateState && loop && progress.power_earned
                ? await loadDebateChatState(service, params.userId, params.speciesProfileId)
                : NO_DEBATE
        ] as const)
    ]);
    return {
        service,
        bond,
        powerEarned: Boolean(progress.power_earned),
        progress,
        debate,
        loop
    };
}

/**
 * Whether the animal may offer a debate now, and whether a call may hand one
 * to the chat (`debateChatState`). The apps' `loadDebateChatState`
 * (`debate_chat_state`, service role only).
 */
async function loadDebateChatState(service: Service, userId: string, speciesProfileId: string): Promise<DebateChatState> {
    try {
        const {data, error} = await service.rpc("debate_chat_state", {p_user_id: userId, p_species_profile_id: speciesProfileId});
        if (error) warn("debate_chat_state", error);
        return error ? NO_DEBATE : debateChatState(data);
    } catch (error) {
        warn("debate_chat_state", error);
        return NO_DEBATE;
    }
}

/**
 * The animal made the debate offer (its marker in a chat reply, DEBATE_OFFER
 * or DEBATE on a call): noted, so it is made once for a problem, in any chat
 * or call. `accepted` when they said yes on a call. The apps' `noteDebateOffer`
 * (`debate_note_offer`, service role only).
 */
export async function noteDebateOffer(service: Service, params: {
    userId: string;
    speciesProfileId: string;
    via: "chat" | "call";
    accepted?: boolean;
}): Promise<void> {
    try {
        const {error} = await service.rpc("debate_note_offer", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
            p_via: params.via,
            p_accepted: params.accepted === true
        });
        if (error) warn("debate_note_offer", error);
    } catch (error) {
        warn("debate_note_offer", error);
    }
}

/**
 * Writes what the animal did in this reply (its hidden lines) and says what
 * changed, for the `done` event: `companion` (the loop now: `open_trial` is
 * the open step's text, `open_step` the step object the chat pins) and, when
 * a step was completed, the new `bond`. The apps' `applyCompanionLines`.
 *
 * The web is a 3.2 client: the step card's "I'll do it" accepts the step
 * (`accept_animal_step_v1`), which makes its check-in, so a step set here
 * never makes one (`p_check_in_on_set: false`).
 */
export async function applyCompanionLines(params: {
    service: Service;
    userId: string;
    speciesProfileId: string;
    state: CompanionState | null;
    roster: CompanionRosterEntry[];
    lines: CompanionLines;
    /** What they said, for the one-new-step-a-day rule (they may ask for another). */
    userMessage?: string;
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
                // 3.2: the step pays +5 XP (0 past the first paying step with
                // this animal today); the Power never waits for a lesson check.
                // Since 2026-10-31 a confirmed proof adds +5 on a step that
                // pays: `xp` includes it, `proof_bonus` says it (0 or 5).
                event.trial_done = {
                    id: typeof result.trial_id === "string" ? result.trial_id : params.state.open_trial.id,
                    step: result.step ?? params.state.open_trial.step,
                    power_earned: result.power_earned === true,
                    power_waits_for_training: result.power_waits_for_training === true,
                    xp: Number(result.xp) || 0,
                    proof_bonus: Number(result.proof_bonus) || 0
                };
                // How it went: kept on the step; a debate's way that did not
                // work reopens that debate, so its other ways can be tried.
                if (lines.doneOutcome) {
                    const trialDone = event.trial_done as Record<string, unknown>;
                    trialDone.outcome = lines.doneOutcome;
                    const recorded = await service.rpc("record_animal_step_outcome_v1", {
                        p_user_id: userId,
                        p_trial_id: trialDone.id,
                        p_outcome: lines.doneOutcome
                    });
                    if (recorded.error) warn("record_animal_step_outcome_v1", recorded.error);
                    else if (recorded.data && typeof recorded.data === "object") {
                        const row = recorded.data as Record<string, unknown>;
                        if (row.debate_reopened === true && typeof row.debate_id === "string") trialDone.debate_reopened = row.debate_id;
                    }
                }
                done = Number(result.your_trials_done) || done + 1;
                openStep = null;
                if (result.bond && typeof result.bond === "object") bond = result.bond as CompanionBond;
            }
        }
        // At most one new step on a problem a day (the apps' rule, 2026-11-04): a
        // different step does not replace one set less than a day ago unless
        // they reported on it or asked for another.
        const stepAllowed = newStepAllowed({
            openTrial: params.state?.open_trial ?? null,
            newStep: lines.trial?.step ?? null,
            reportedDone: Boolean(lines.done),
            userMessage: params.userMessage ?? ""
        });
        if (lines.trial && stepAllowed) {
            const {data, error} = await service.rpc("set_animal_companion_trial", {
                ...base,
                p_step: lines.trial.step,
                p_check_in_after_days: lines.trial.checkInAfterDays,
                p_check_in_on_set: false
            });
            if (error) warn("set_animal_companion_trial", error);
            else if (typeof data === "string" && data) {
                // The id is the step the card under this reply acts on. The
                // same step said again keeps its id and where it stood.
                openStep = openStep?.id === data
                    ? openStep
                    : {id: data, step: lines.trial.step, set_at: new Date().toISOString(), accepted_at: null, trial_frequency: null, has_report: false};
                event.trial_set = {id: data, step: openStep.step};
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

/**
 * Their private debates in the last day, for the second opinion's free one a
 * day (SPEC 3.3; the apps' `privateDebatesToday`); null when it cannot be read.
 */
export async function privateDebatesToday(service: Service, userId: string): Promise<number | null> {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const {count, error} = await service.from("debates").select("id", {count: "exact", head: true})
            .eq("asker_user_id", userId).eq("visibility", "private").gt("created_at", since).neq("status", "cancelled");
        return error ? null : count ?? 0;
    } catch {
        return null;
    }
}
