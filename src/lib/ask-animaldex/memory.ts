import "server-only";

/**
 * The server half of memory: reading `animal_chat_user_memory` and the
 * reader's chat settings with the service role, and learning from a finished
 * exchange. The prompt text and parsing live in `memory-prompt.ts` and
 * `companion.ts`, which have no server imports so the prompt builders (and
 * their tests) can use them.
 *
 * Writes go through `apply_animal_chat_memory_delta`, as the apps' do: the
 * model returns only what changed and the database merges it under a row lock,
 * so two surfaces learning at once never overwrite each other's facts.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {requestAskJSONObject} from "@/lib/ask-animaldex/providers";
import {parseAskMemoryFacts, type AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";
import {buildAskMemoryDeltaPrompts, memoryMinLength, parseAskMemoryDelta, type AskMemoryRevealedStep} from "@/lib/ask-animaldex/companion";
import {createAskFollowUp, loadAskJourneyNote, saveAskJourney} from "@/lib/ask-animaldex/chat-records-server";
import {applyLifeSimActions, lifeSimActions, loadRecentRevealedSteps} from "@/lib/ask-animaldex/ark-sim";

export type {AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";

/** The reader's standing choices about Speak to [Animal]. */
export type AskChatSettings = {
    /** False: no memory is read and nothing is learned. */
    personalisationEnabled: boolean;
    /** False: the animal sets no steps unless asked (the companion loop's opt-out). */
    suggestSteps: boolean;
    /** False: the animal never offers to check back on something. */
    followUpsEnabled: boolean;
};

const DEFAULT_SETTINGS: AskChatSettings = {personalisationEnabled: true, suggestSteps: true, followUpsEnabled: true};

/**
 * `animal_chat_settings_for`, service role. A database without the companions
 * migration has no such function; the defaults are what every reader had
 * before it, so that is what they keep.
 */
export async function loadAskChatSettings(userId: string | null): Promise<AskChatSettings> {
    if (!userId) return DEFAULT_SETTINGS;
    const service = createSupabaseServiceClient();
    if (!service) return DEFAULT_SETTINGS;
    try {
        const {data, error} = await service.rpc("animal_chat_settings_for", {p_user_id: userId});
        if (error || !data || typeof data !== "object") return DEFAULT_SETTINGS;
        const row = data as Record<string, unknown>;
        return {
            personalisationEnabled: row.personalisation_enabled !== false,
            suggestSteps: row.suggest_steps !== false,
            followUpsEnabled: row.follow_ups_enabled !== false
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export async function loadAskMemory(userId: string | null): Promise<AskMemoryFact[]> {
    if (!userId) return [];
    const service = createSupabaseServiceClient();
    if (!service) return [];
    const {data} = await service
        .from("animal_chat_user_memory")
        .select("facts")
        .eq("user_id", userId)
        .maybeSingle();
    return parseAskMemoryFacts(data?.facts);
}

/**
 * Learns what this exchange said about the person and merges it. Runs after
 * the answer has gone out; a failure here never touches the conversation.
 * The caller only calls it while personalisation is on.
 */
export async function rememberAskTurn(params: {
    userId: string | null;
    existing: AskMemoryFact[];
    animalName: string;
    /** The canonical species, stamped on new facts so that animal finds them first. */
    speciesProfileId: string | null;
    userMessage: string;
    answer: string;
    /**
     * The owner's own chat: this exchange also updates their journey with the
     * animal, the visitor-safe note a visitor's animal may repeat. A visitor's
     * exchange is not part of it.
     */
    journey?: {speciesProfileId: string} | null;
    /** The owner's chat with check-ins on: they may have asked the animal to check back. */
    allowFollowUp?: boolean;
    /** Teen mode (`age-band.ts`): only light, everyday facts are kept. */
    teen?: boolean;
    /**
     * Life sim (docs/life-sim/CONTRACT.md sections 5 and 6), as the apps'
     * `rememberFromTurn` (edge 5a1ff095): the same call also hears how their
     * recent revealed steps went, and whether the problem with this animal
     * (`focus`, the owner's turn only) has turned hard.
     */
    lifeSim?: {
        focus: {id: string; focus: string; sensitive?: boolean} | null;
        /** The step this turn reports on (step_report) and any step done in this reply: the report revises those, so chat detection never judges them. */
        exclude: string[];
        chatMessageRef: string | null;
    } | null;
}): Promise<void> {
    if (!params.userId || !params.answer.trim()) return;
    const message = params.userMessage.trim();
    if (message.length < memoryMinLength(true)) return;
    const service = createSupabaseServiceClient();
    if (!service) return;
    const userId = params.userId;
    try {
        const lifeSim = params.lifeSim ?? null;
        const revealed = lifeSim ? await loadRecentRevealedSteps(service, {userId, exclude: lifeSim.exclude}) : [];
        // "ok", "yes", "thanks": nothing to learn, no call to make; while they
        // have a revealed step, a few words may say how it went.
        if (message.length < memoryMinLength(revealed.length > 0)) return;
        const checkedFocus = lifeSim?.focus && lifeSim.focus.sensitive !== true ? lifeSim.focus : null;
        const revealedSteps: AskMemoryRevealedStep[] = revealed.map(({focusId: _focus, ...step}) => step);
        const existingJourney = params.journey ? await loadAskJourneyNote(userId, params.journey.speciesProfileId) : null;
        const prompts = buildAskMemoryDeltaPrompts({
            existing: params.existing,
            animalName: params.animalName,
            userMessage: params.userMessage,
            answer: params.answer,
            existingJourney,
            allowFollowUp: params.allowFollowUp === true,
            teen: params.teen === true,
            revealedSteps,
            focusSensitiveCheck: checkedFocus ? {problem: checkedFocus.focus} : null
        });
        const raw = await requestAskJSONObject({systemPrompt: prompts.system, userPrompt: prompts.user});
        if (!raw) return;
        const knownIds = new Set(params.existing.map((fact) => fact.id).filter((id): id is string => Boolean(id)));
        const delta = parseAskMemoryDelta(raw, knownIds, {
            teen: params.teen === true,
            stepIds: new Set(revealed.map((step) => step.id))
        });
        const tasks: Promise<unknown>[] = [];
        if (lifeSim) {
            // The flag first, then the revisions (`applyLifeSimActions`).
            const actions = lifeSimActions({
                stepOutcomes: delta.step_outcomes,
                focusSensitive: delta.focus_sensitive,
                revealed,
                checkedFocus,
                message
            });
            tasks.push(
                applyLifeSimActions(service, {userId, actions, chatMessageRef: lifeSim.chatMessageRef, chatSpeciesProfileId: params.speciesProfileId})
                    .catch((error) => console.warn("[ask-animaldex] ark detection failed", error instanceof Error ? error.message.slice(0, 200) : "unknown"))
            );
        }
        if (params.journey) {
            tasks.push(saveAskJourney({
                userId,
                speciesProfileId: params.journey.speciesProfileId,
                animalName: params.animalName,
                note: delta.journey
            }));
        }
        if (params.allowFollowUp && delta.follow_up && params.speciesProfileId) {
            tasks.push(createAskFollowUp({
                userId,
                speciesProfileId: params.speciesProfileId,
                topic: delta.follow_up.topic,
                revisitAfterDays: delta.follow_up.revisit_after_days
            }));
        }
        if (delta.add.length === 0 && delta.update.length === 0 && delta.retire.length === 0) {
            await Promise.allSettled(tasks);
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const {error} = await service.rpc("apply_animal_chat_memory_delta", {
            p_user_id: params.userId,
            p_add: delta.add.map((item) => ({
                ...item,
                animal: params.animalName,
                ...(params.speciesProfileId ? {species_profile_id: params.speciesProfileId} : {}),
                noted_at: today
            })),
            p_update: delta.update,
            p_retire: delta.retire
        });
        if (error) console.warn("[ask-animaldex] memory delta failed", error.message.slice(0, 200));
        await Promise.allSettled(tasks);
    } catch (error) {
        console.warn("[ask-animaldex] memory update failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    }
}
