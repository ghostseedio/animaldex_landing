import "server-only";

/**
 * The server half of memory: reading and writing `animal_chat_user_memory`
 * with the service role, and learning from a finished exchange. The prompt
 * text and parsing live in `memory-prompt.ts`, which has no server imports
 * so the prompt builders (and their tests) can use it.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {requestAskJSONObject} from "@/lib/ask-animaldex/providers";
import {
    buildAskMemoryExtractionPrompts,
    parseAskMemoryFacts,
    type AskMemoryFact
} from "@/lib/ask-animaldex/memory-prompt";

export type {AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";

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
 * Learns what this exchange said about the person and saves it. Runs after
 * the answer has gone out; a failure here never touches the conversation.
 */
export async function rememberAskTurn(params: {
    userId: string | null;
    existing: AskMemoryFact[];
    animalName: string;
    userMessage: string;
    answer: string;
}): Promise<void> {
    if (!params.userId || !params.answer.trim()) return;
    const service = createSupabaseServiceClient();
    if (!service) return;
    try {
        const prompts = buildAskMemoryExtractionPrompts(params);
        const raw = await requestAskJSONObject({systemPrompt: prompts.system, userPrompt: prompts.user});
        if (!raw) return;
        const facts = parseAskMemoryFacts(raw.facts);
        if (facts.length === 0 && params.existing.length === 0) return;
        const unchanged = facts.length === params.existing.length
            && facts.every((fact, index) => fact.fact === params.existing[index]?.fact);
        if (unchanged) return;
        await service
            .from("animal_chat_user_memory")
            .upsert({user_id: params.userId, facts, updated_at: new Date().toISOString()}, {onConflict: "user_id"});
    } catch (error) {
        console.warn("[ask-animaldex] memory update failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    }
}
