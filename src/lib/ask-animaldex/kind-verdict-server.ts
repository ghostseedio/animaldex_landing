/**
 * The kind's verdict request (`kind-verdict.ts` holds the prompt): a fast
 * model with thinking off, never retried, so a slow or failed call only means
 * the animal answers without one. With the apps' stance memory
 * (animal_species_stances, AnimalDex 20261102160000): the stances this animal
 * already holds come in with the turn's reads, a kept one counts as a use and
 * a new one is kept for the next person.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
    ASK_HELD_MATCH_FLOOR,
    ASK_KIND_VERDICT_MAX_TOKENS,
    askHeldStances,
    askProblemSimilarity,
    askWithChosenLatch,
    buildAskKindVerdictPrompt,
    parseAskTurnRead,
    type AskHeldStance,
    type AskKindVerdict,
    type AskKindVerdictInput,
    type AskTurnRead
} from "@/lib/ask-animaldex/kind-verdict";
import {createSupabaseServiceClient} from "@/lib/supabase/server";

/** The call model's default (`call-voice.ts`): fast, and good with thinking off. */
const DEFAULT_VERDICT_MODEL = "claude-haiku-5-5";

function jsonRecord(text: string): Record<string, unknown> | null {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        const value = JSON.parse(text.slice(start, end + 1));
        return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

/** The verdict call's model: the call model (Haiku 5.5 unless configured). */
export function askVerdictModel(): string {
    return process.env.CLAUDE_ANIMAL_CALL_MODEL?.trim() || DEFAULT_VERDICT_MODEL;
}

/** The request as it goes to the model. */
export function askKindVerdictRequest(model: string, input: AskKindVerdictInput) {
    return {
        model,
        max_tokens: ASK_KIND_VERDICT_MAX_TOKENS,
        thinking: {type: "disabled" as const},
        messages: [{role: "user" as const, content: buildAskKindVerdictPrompt(input)}]
    };
}

/**
 * What the turn is and its verdict, with the latch chosen for this reader
 * (`angle.ts`). Null on any failure: the animal then answers without one.
 */
export async function requestAskTurnRead(params: {
    key: string;
    input: AskKindVerdictInput;
    model?: string;
    timeoutMs?: number;
    /** For tests. */
    fetchImpl?: typeof fetch;
}): Promise<AskTurnRead | null> {
    try {
        const client = new Anthropic({
            apiKey: params.key,
            timeout: params.timeoutMs ?? 5_000,
            // The reply goes ahead without a verdict rather than wait for a retry.
            maxRetries: 0,
            ...(params.fetchImpl ? {fetch: params.fetchImpl} : {})
        });
        const response = await client.messages.create(askKindVerdictRequest(params.model ?? askVerdictModel(), params.input));
        const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
        const raw = jsonRecord(text);
        if (!raw) return null;
        const read = parseAskTurnRead(raw, (params.input.held ?? []).slice(0, 8));
        const verdict = read.verdict;
        // A "same kind" whose own description reads unlike the held one is
        // asked again without the held stances: a fresh answer beats someone else's.
        if (verdict?.held_id && verdict.asked_problem !== undefined &&
            askProblemSimilarity(verdict.asked_problem, verdict.problem ?? "") < ASK_HELD_MATCH_FLOOR) {
            return await requestAskTurnRead({...params, input: {...params.input, held: []}});
        }
        return {...read, verdict: askWithChosenLatch(verdict, params.input.heard ?? [])};
    } catch (error) {
        console.warn("[ask-animaldex] kind verdict failed", error instanceof Error ? error.message : String(error));
        return null;
    }
}

/** The verdict alone (requestAskTurnRead). */
export async function requestAskKindVerdict(params: Parameters<typeof requestAskTurnRead>[0]): Promise<AskKindVerdict | null> {
    return (await requestAskTurnRead(params))?.verdict ?? null;
}

/** The stances this animal already holds that might be this kind of problem; none on any failure. */
export async function loadAskHeldStances(speciesProfileId: string, message: string, source: "app" | "lab"): Promise<AskHeldStance[]> {
    const service = createSupabaseServiceClient();
    if (!service) return [];
    try {
        const {data, error} = await service.rpc("animal_stance_candidates", {
            p_species_profile_id: speciesProfileId,
            p_message: message,
            p_source: source
        });
        return error ? [] : askHeldStances(data);
    } catch {
        return [];
    }
}

/** A kept stance counts as a use; a new one is kept for the next person. Never fails the turn. */
export async function rememberAskStance(speciesProfileId: string, verdict: AskKindVerdict, source: "app" | "lab"): Promise<void> {
    const service = createSupabaseServiceClient();
    if (!service) return;
    try {
        const {error} = verdict.held_id
            ? await service.rpc("use_animal_stance", {p_id: verdict.held_id})
            : verdict.problem
            ? await service.rpc("record_animal_stance", {
                p_species_profile_id: speciesProfileId,
                p_problem: verdict.problem,
                p_stance: {
                    power_says: verdict.power_says,
                    obvious: verdict.obvious,
                    angle: verdict.angle,
                    verdict: verdict.verdict,
                    ...((verdict.latch ?? verdict.latches?.[0])
                        ? {latch: {from: (verdict.latch ?? verdict.latches![0]).source, behaviour: (verdict.latch ?? verdict.latches![0]).behaviour}}
                        : {})
                },
                p_source: source
            })
            : {error: null};
        if (error) console.warn("[ask-animaldex] stance write failed", error.message);
    } catch (error) {
        console.warn("[ask-animaldex] stance write failed", error instanceof Error ? error.message : String(error));
    }
}
