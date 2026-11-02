/**
 * The kind's verdict request (`kind-verdict.ts` holds the prompt): a fast
 * model with thinking off, never retried, so a slow or failed call only means
 * the animal answers without one.
 */

import Anthropic from "@anthropic-ai/sdk";
import {ASK_KIND_VERDICT_MAX_TOKENS, buildAskKindVerdictPrompt, parseAskKindVerdict, type AskKindVerdict, type AskKindVerdictInput} from "@/lib/ask-animaldex/kind-verdict";

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

/** Null on any failure: the animal then answers without one. */
export async function requestAskKindVerdict(params: {
    key: string;
    input: AskKindVerdictInput;
    model?: string;
    timeoutMs?: number;
    /** For tests. */
    fetchImpl?: typeof fetch;
}): Promise<AskKindVerdict | null> {
    try {
        const client = new Anthropic({
            apiKey: params.key,
            timeout: params.timeoutMs ?? 5_000,
            // The reply goes ahead without a verdict rather than wait for a retry.
            maxRetries: 0,
            ...(params.fetchImpl ? {fetch: params.fetchImpl} : {})
        });
        const response = await client.messages.create({
            model: params.model ?? (process.env.CLAUDE_ANIMAL_CALL_MODEL?.trim() || DEFAULT_VERDICT_MODEL),
            max_tokens: ASK_KIND_VERDICT_MAX_TOKENS,
            thinking: {type: "disabled"},
            messages: [{role: "user", content: buildAskKindVerdictPrompt(params.input)}]
        });
        const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
        const raw = jsonRecord(text);
        return raw ? parseAskKindVerdict(raw) : null;
    } catch (error) {
        console.warn("[ask-animaldex] kind verdict failed", error instanceof Error ? error.message : String(error));
        return null;
    }
}

