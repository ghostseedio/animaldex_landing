import "server-only";

/**
 * Life Sim on the web's own chat, server half (AnimalDex
 * docs/life-sim/CONTRACT.md, sections 4, 5 and 6): the web's /talk runs its
 * own turns, so it does what the apps' `generate-applied-insight` does
 * around a reply, through the same service-role RPCs:
 *
 *   - tags a step saved from a reply's TRIAL line (`set_animal_step_sim_tags`);
 *   - reads the steps a later chat may revise (`ark_changes_v1`, as the reader),
 *     and applies what the memory call heard (`ark_apply_step_revision`,
 *     `mark_focus_sensitive`);
 *   - reads the revisions the animal has not mentioned (`ark_unmentioned_revisions`)
 *     and marks them once the reply mentioning them is out (`ark_mark_revisions_mentioned`).
 *
 * Every call is best-effort: before the migration they all fail quietly and
 * the chat is exactly as before.
 */

import type {SupabaseClient} from "@supabase/supabase-js";
import type {createSupabaseServiceClient} from "@/lib/supabase/server";
import {requestAskJSONObject} from "@/lib/ask-animaldex/providers";
import {
    buildStepSimTagPrompts,
    parseStepSimTags,
    type ArkMentionRevision,
    type ArkRecentStep,
    type ArkStepOutcome
} from "@/lib/ask-animaldex/ark-prompts";
import {arkIsReveal, arkRevisionDirection, decodeArkChange, decodeArkChanges} from "@/lib/ark";

type Service = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

const DAY_MS = 24 * 60 * 60 * 1000;

function warn(what: string, error: unknown) {
    const message = error && typeof error === "object" && "message" in error ? String((error as {message: unknown}).message) : String(error);
    console.warn(`[ark] ${what} failed`, message.slice(0, 200));
}

/** Section 5: tag a step just saved from a reply, fire and forget. */
export async function tagArkStep(params: {
    service: Service;
    userId: string;
    stepId: string;
    animalName: string;
    power?: string | null;
    problem: string | null;
    step: string;
    teen?: boolean;
}): Promise<void> {
    try {
        const prompts = buildStepSimTagPrompts({
            animalName: params.animalName,
            power: params.power ?? null,
            problem: params.problem,
            step: params.step,
            teen: params.teen === true
        });
        const raw = await requestAskJSONObject({systemPrompt: prompts.system, userPrompt: prompts.user});
        const tags = parseStepSimTags(raw);
        if (!tags) return;
        const {error} = await params.service.rpc("set_animal_step_sim_tags", {
            p_user_id: params.userId,
            p_step_id: params.stepId,
            p_tags: tags
        });
        if (error) warn("set_animal_step_sim_tags", error);
    } catch (error) {
        warn("step tags", error);
    }
}

/**
 * Section 6: the steps they took on in the last 30 days, from every animal
 * (a reveal is a step taken on), with each step's words. Empty on any error.
 */
export async function loadArkRecentSteps(client: SupabaseClient, service: Service | null): Promise<ArkRecentStep[]> {
    try {
        const {data, error} = await client.rpc("ark_changes_v1", {
            p_since: new Date(Date.now() - 30 * DAY_MS).toISOString(),
            p_species_profile_id: null,
            p_limit: 50
        });
        if (error) return [];
        const reveals = decodeArkChanges(data).filter((change) => arkIsReveal(change) && change.stepId);
        const byStep = new Map<string, (typeof reveals)[number]>();
        for (const reveal of reveals) if (reveal.stepId && !byStep.has(reveal.stepId)) byStep.set(reveal.stepId, reveal);
        if (byStep.size === 0 || !service) return [];
        const {data: steps} = await service.from("animal_companion_trials").select("id, step").in("id", Array.from(byStep.keys()).slice(0, 30));
        const words = new Map((steps ?? []).map((row) => [String(row.id).toLowerCase(), typeof row.step === "string" ? row.step : ""]));
        return Array.from(byStep.entries()).flatMap(([stepId, reveal]) => {
            const step = words.get(stepId)?.trim();
            return step ? [{id: stepId, step, animal: reveal.animal, kind: reveal.kind === "lesson" ? "lesson" as const : "earned" as const}] : [];
        });
    } catch (error) {
        warn("recent steps", error);
        return [];
    }
}

/** Section 6: each clear outcome revises its step once (the RPC dedupes on the statement). */
export async function applyArkStepOutcomes(params: {
    service: Service;
    userId: string;
    outcomes: readonly ArkStepOutcome[];
    /** The person's message id in this thread (its request id), so the card goes under it. */
    chatMessageRef: string | null;
}): Promise<void> {
    await Promise.allSettled(params.outcomes.map(async (outcome) => {
        const {error} = await params.service.rpc("ark_apply_step_revision", {
            p_user_id: params.userId,
            p_step_id: outcome.step_id,
            p_direction: outcome.direction,
            p_source: "chat",
            p_statement: outcome.statement,
            p_chat_message_ref: params.chatMessageRef
        });
        if (error) warn("ark_apply_step_revision", error);
    }));
}

/** Section 5: the problem turned hard. Sticky: the server never unsets it. */
export async function markArkFocusSensitive(service: Service, userId: string, focusId: string): Promise<void> {
    const {error} = await service.rpc("mark_focus_sensitive", {p_user_id: userId, p_focus_id: focusId});
    if (error) warn("mark_focus_sensitive", error);
}

/** Section 4: what this animal has not mentioned yet; empty on any error. */
export async function loadArkUnmentionedRevisions(service: Service, userId: string, speciesProfileId: string): Promise<ArkMentionRevision[]> {
    try {
        const {data, error} = await service.rpc("ark_unmentioned_revisions", {p_user_id: userId, p_species_profile_id: speciesProfileId});
        if (error) return [];
        const rows = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as {revisions?: unknown}).revisions)
            ? (data as {revisions: unknown[]}).revisions
            : [];
        return rows.flatMap((raw) => {
            const change = decodeArkChange(raw);
            if (!change) return [];
            const direction = arkRevisionDirection(change);
            if (direction === "none" || change.undoneAt) return [];
            const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
            const step = typeof row.step === "string" && row.step.trim() ? row.step.trim().slice(0, 400) : null;
            return [{id: change.id, step, animal: change.animal, direction, statement: change.statement}];
        }).slice(0, 3);
    } catch (error) {
        warn("unmentioned revisions", error);
        return [];
    }
}

export async function markArkRevisionsMentioned(service: Service, userId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const {error} = await service.rpc("ark_mark_revisions_mentioned", {p_user_id: userId, p_ids: ids});
    if (error) warn("ark_mark_revisions_mentioned", error);
}
