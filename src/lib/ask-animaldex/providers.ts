import "server-only";

/**
 * Where the answer's tokens come from.
 *
 * Ported from `claudeAnswerSource` / `geminiAnswerSource` / `openAIAnswerSource`
 * / `consumeServerSentEvents` in the apps' backend. Provider-agnostic on
 * purpose: the frame plumbing, the sentinel hold-back and the client-facing
 * event contract are identical whichever model produces the text, so switching
 * provider is a matter of swapping the delta source.
 *
 * Speak to [Animal] (species scope) is Claude first, exactly as in the apps
 * since 2026-10-23: Claude Opus 5.5 speaks as every animal, and Gemini, then
 * OpenAI, take over only when Claude is not configured or fails before it has
 * said a word. `ANIMAL_CHAT_PROVIDER=gemini` skips Claude, as it does in the
 * edge function. The site-wide assistant (general scope) keeps Gemini first:
 * the Animal Power and System Dynamics content it explains are both generated
 * by `gemini-2.5-flash`, and OpenAI is its fallback.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {AskChatEffort} from "@/lib/ask-animaldex/persona";
import type {AskConversationTurn} from "@/lib/ask-animaldex/prompt";

export const DEFAULT_CLAUDE_ASK_MODEL = "claude-opus-5-5";
export const DEFAULT_GEMINI_ASK_MODEL = "gemini-2.5-flash";
export const DEFAULT_OPENAI_ASK_MODEL = "gpt-4o-mini";

/** Emits deltas until the model is done, or throws. */
export type AnswerDeltaSource = (emit: (delta: string) => void) => Promise<void>;

export type AskProviderName = "claude" | "gemini" | "openai";

export function resolveClaudeAskModel(): string {
    return process.env.CLAUDE_ANIMAL_CHAT_MODEL?.trim() || DEFAULT_CLAUDE_ASK_MODEL;
}

export function resolveGeminiAskModel(): string {
    return process.env.GEMINI_ANIMAL_POWER_MODEL?.trim()
        || process.env.GEMINI_PREMIUM_MODEL?.trim()
        || process.env.GEMINI_FAST_MODEL?.trim()
        || DEFAULT_GEMINI_ASK_MODEL;
}

export function resolveOpenAIAskModel(): string {
    return process.env.OPENAI_APPLIED_INSIGHT_MODEL?.trim()
        || process.env.OPENAI_PREMIUM_MODEL?.trim()
        || DEFAULT_OPENAI_ASK_MODEL;
}

/** The same secret names the edge function and the website's other Claude callers read. */
export function claudeAskKey(): string | null {
    if (process.env.ANIMAL_CHAT_PROVIDER?.trim().toLowerCase() === "gemini") return null;
    return process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || null;
}

export function geminiAskKey(): string | null {
    return process.env.GEMINI_API_KEY?.trim() || null;
}

export function openAIAskKey(): string | null {
    return process.env.OPENAI_API_KEY?.trim() || null;
}

/**
 * Which providers this deployment can actually use, best first. Claude leads
 * only where the animal itself is speaking.
 */
export function availableAskProviders(options: {animalVoice?: boolean} = {}): AskProviderName[] {
    const providers: AskProviderName[] = [];
    if (options.animalVoice && claudeAskKey()) providers.push("claude");
    if (geminiAskKey()) providers.push("gemini");
    if (openAIAskKey()) providers.push("openai");
    return providers;
}

/**
 * The effort the animal thinks at: its own (from intelligence), capped by
 * `ANIMAL_CHAT_MAX_EFFORT` — medium unless configured, as in the app.
 */
export function askChatMaxEffort(): string {
    return process.env.ANIMAL_CHAT_MAX_EFFORT?.trim() || "medium";
}

function extractGeminiText(frame: Record<string, unknown>): string {
    const candidates = Array.isArray(frame.candidates) ? frame.candidates : [];
    const candidate = candidates[0] as Record<string, unknown> | undefined;
    const content = candidate?.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content?.parts as unknown[] : [];
    return parts
        .map((part) => {
            const record = part as Record<string, unknown> | null;
            return typeof record?.text === "string" ? record.text : "";
        })
        .join("");
}

/** Reads an SSE body frame by frame, handing each `data:` payload to `onFrame`. */
export async function consumeServerSentEvents(
    body: ReadableStream<Uint8Array>,
    onFrame: (payload: Record<string, unknown>) => void,
    signal?: AbortSignal
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        for (;;) {
            if (signal?.aborted) return;
            const {done, value} = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, {stream: true}).replace(/\r\n/g, "\n");

            // Frames are separated by a blank line; keep any partial tail.
            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";

            for (const frame of frames) {
                const line = frame.split("\n").find((candidate) => candidate.startsWith("data:"));
                if (!line) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                    onFrame(JSON.parse(payload) as Record<string, unknown>);
                } catch {
                    // A frame we cannot parse is skipped rather than failing the answer.
                }
            }
        }
    } finally {
        // A reader left open holds the socket for the life of the lambda.
        reader.releaseLock?.();
    }
}

type SourceParams = {
    systemPrompt: string;
    userPrompt: string;
    /**
     * Earlier turns, oldest first, starting with the person and ending on the
     * animal (`askHistoryAsTurns`). Species scope sends the conversation as
     * real turns, as the apps do; the general scope keeps it in the prompt text.
     */
    history?: AskConversationTurn[];
    signal?: AbortSignal;
};

/**
 * Claude as the voice of the animal: a streamed reply in character.
 *
 * The system prompt (the character, the rules and the animal's whole record)
 * is identical turn after turn within a conversation, so it carries a cache
 * breakpoint: the greeting writes it and every reply after reads it. Volatile
 * context (memory, the reader, the message) is in the last user turn.
 *
 * Claude Opus 5.5 always thinks; `effort` is the only dial (no temperature).
 * The animal's intelligence picks it (`persona.ts`). A declined request is
 * re-run server-side on the recommended fallback model. No retries here: the
 * caller falls back to Gemini when nothing was emitted.
 */
export function claudeAnswerSource(params: SourceParams & {
    key: string;
    model: string;
    effort: AskChatEffort;
    /** Covers thinking as well as the reply. */
    maxTokens?: number;
}): AnswerDeltaSource {
    return async (emit) => {
        const client = new Anthropic({apiKey: params.key, timeout: 90_000, maxRetries: 0});
        const stream = client.beta.messages.stream({
            model: params.model,
            max_tokens: params.maxTokens ?? 6000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: {effort: params.effort},
            system: [{type: "text", text: params.systemPrompt, cache_control: {type: "ephemeral"}}],
            messages: [
                ...(params.history ?? []).map((turn) => ({role: turn.role, content: turn.content})),
                {role: "user" as const, content: params.userPrompt}
            ]
        }, {signal: params.signal});

        let emitted = false;
        stream.on("text", (delta) => {
            if (!delta) return;
            emitted = true;
            emit(delta);
        });
        const final = await stream.finalMessage();
        logClaudeUsage("stream", final);
        if (!emitted) {
            throw new Error(final.stop_reason === "refusal"
                ? `claude_refusal:${final.stop_details?.category ?? "unknown"}`
                : `claude_empty:${final.stop_reason}`);
        }
    };
}

/** One line per Claude call outside production, so caching can be checked from the dev server log. */
function logClaudeUsage(kind: string, message: {model: string; stop_reason: string | null; usage: unknown}) {
    if (process.env.NODE_ENV === "production") return;
    const usage = (message.usage ?? {}) as Record<string, unknown>;
    console.info(
        `[ask-animaldex] claude ${kind} ${message.model} stop=${message.stop_reason}`
        + ` in=${usage.input_tokens ?? "?"} cache_write=${usage.cache_creation_input_tokens ?? 0}`
        + ` cache_read=${usage.cache_read_input_tokens ?? 0} out=${usage.output_tokens ?? "?"}`
    );
}

/** The conversation as Gemini wants it: earlier turns, then this one. */
function geminiContents(params: {userPrompt: string; history?: AskConversationTurn[]}) {
    return [
        ...(params.history ?? []).map((turn) => ({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{text: turn.content}]
        })),
        {role: "user", parts: [{text: params.userPrompt}]}
    ];
}

function openAIMessages(params: {systemPrompt: string; userPrompt: string; history?: AskConversationTurn[]}) {
    return [
        {role: "system", content: params.systemPrompt},
        ...(params.history ?? []).map((turn) => ({role: turn.role, content: turn.content})),
        {role: "user", content: params.userPrompt}
    ];
}

export function geminiAnswerSource(params: SourceParams & {key: string; model: string}): AnswerDeltaSource {
    return async (emit) => {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}`
            + `:streamGenerateContent?alt=sse&key=${encodeURIComponent(params.key)}`,
            {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    systemInstruction: {parts: [{text: params.systemPrompt}]},
                    contents: geminiContents(params),
                    generationConfig: {
                        temperature: 0.4,
                        // With thinkingBudget 0, maxOutputTokens is purely
                        // visible output. Left at the default, reasoning tokens
                        // eat the budget and the answer truncates mid-list.
                        maxOutputTokens: 2048,
                        thinkingConfig: {thinkingBudget: 0}
                    }
                }),
                signal: params.signal
            }
        );

        if (!response.ok || !response.body) {
            const detail = response.ok ? "empty_body" : (await response.text().catch(() => "")).slice(0, 300);
            throw new Error(`gemini_${response.status}: ${detail}`);
        }

        await consumeServerSentEvents(response.body, (frame) => {
            emit(extractGeminiText(frame));
        }, params.signal);
    };
}

export function openAIAnswerSource(params: SourceParams & {key: string; model: string}): AnswerDeltaSource {
    return async (emit) => {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${params.key}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: params.model,
                temperature: 0.4,
                max_completion_tokens: 1600,
                stream: true,
                messages: openAIMessages(params)
            }),
            signal: params.signal
        });

        if (!response.ok || !response.body) {
            const detail = response.ok ? "empty_body" : (await response.text().catch(() => "")).slice(0, 300);
            throw new Error(`openai_${response.status}: ${detail}`);
        }

        await consumeServerSentEvents(response.body, (frame) => {
            const choices = Array.isArray(frame.choices) ? frame.choices : [];
            const delta = (choices[0] as Record<string, unknown> | undefined)?.delta as
                Record<string, unknown> | undefined;
            if (typeof delta?.content === "string") emit(delta.content);
        }, params.signal);
    };
}

/** The delta source for one provider, or null when its key is missing. */
export function askAnswerSource(
    provider: AskProviderName,
    params: SourceParams & {effort?: AskChatEffort}
): AnswerDeltaSource | null {
    if (provider === "claude") {
        const key = claudeAskKey();
        return key ? claudeAnswerSource({...params, key, model: resolveClaudeAskModel(), effort: params.effort ?? "low"}) : null;
    }
    if (provider === "gemini") {
        const key = geminiAskKey();
        return key ? geminiAnswerSource({...params, key, model: resolveGeminiAskModel()}) : null;
    }
    const key = openAIAskKey();
    return key ? openAIAnswerSource({...params, key, model: resolveOpenAIAskModel()}) : null;
}

// MARK: - One-shot fallback

/**
 * The same answer in one piece, for when the stream could not be established.
 *
 * Streaming adds a second way for a turn to break — a dropped connection
 * part-way through, a proxy that buffers the body — and none of those are a
 * reason to lose an answer the model can still produce. iOS calls this path
 * `finishWithoutStreaming`.
 */
export async function requestAskAnswerJSON(params: {
    systemPrompt: string;
    userPrompt: string;
    history?: AskConversationTurn[];
    /** Species scope: Claude first, as on the stream, so the fallback sounds the same. */
    animalVoice?: boolean;
    effort?: AskChatEffort;
    signal?: AbortSignal;
}): Promise<AskWholeAnswer | null> {
    const claudeKey = params.animalVoice ? claudeAskKey() : null;
    if (claudeKey) {
        const parsed = await requestClaudeJSON({
            ...params,
            key: claudeKey,
            model: resolveClaudeAskModel(),
            effort: params.effort ?? "low"
        }).catch((error) => {
            const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message.slice(0, 160)})` : "";
            console.warn("[ask-animaldex] claude one-piece answer failed", `${error instanceof Error ? error.message.slice(0, 200) : "unknown"}${cause}`);
            return null;
        });
        if (parsed) return parsed;
    }

    const geminiKey = geminiAskKey();
    if (geminiKey) {
        const parsed = await requestGeminiJSON({...params, key: geminiKey, model: resolveGeminiAskModel()})
            .catch(() => null);
        if (parsed) return parsed;
    }

    const openaiKey = openAIAskKey();
    if (!openaiKey) return null;
    return await requestOpenAIJSON({...params, key: openaiKey, model: resolveOpenAIAskModel()})
        .catch(() => null);
}

/**
 * One JSON object from whichever provider is configured, for work that is
 * not an answer (memory extraction). Null when no provider could produce one.
 */
export async function requestAskJSONObject(params: {
    systemPrompt: string;
    userPrompt: string;
    signal?: AbortSignal;
}): Promise<Record<string, unknown> | null> {
    const parse = (raw: string | null | undefined): Record<string, unknown> | null => {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as unknown;
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : null;
        } catch {
            return null;
        }
    };
    const geminiKey = geminiAskKey();
    if (geminiKey) {
        const raw = await requestGeminiRaw({...params, key: geminiKey, model: resolveGeminiAskModel()}).catch(() => null);
        const parsed = parse(raw);
        if (parsed) return parsed;
    }
    const openaiKey = openAIAskKey();
    if (!openaiKey) return null;
    const raw = await requestOpenAIRaw({...params, key: openaiKey, model: resolveOpenAIAskModel()}).catch(() => null);
    return parse(raw);
}

/**
 * A whole answer: the text, its follow-ups and, when the animal told a story
 * of its own life in it, that story in one line (never shown).
 */
export type AskWholeAnswer = {answer: string; followUps: string[]; ownStory?: string | null};

function parseAnswerPayload(raw: string): AskWholeAnswer | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const answer = typeof record.answer === "string"
        ? record.answer.trim()
        : typeof record.applied_insight === "string"
            ? record.applied_insight.trim()
            : "";
    if (!answer) return null;
    const rawFollowUps = record.follow_up_prompts ?? record.followUpPrompts;
    const followUps = Array.isArray(rawFollowUps)
        ? rawFollowUps
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0 && item.length <= 120)
            .slice(0, 3)
        : [];
    const ownStory = typeof record.own_story === "string" && record.own_story.trim() ? record.own_story.trim() : null;
    return {answer, followUps, ...(ownStory ? {ownStory} : {})};
}

const ANSWER_JSON_SCHEMA = {
    type: "object",
    properties: {
        answer: {type: "string"},
        follow_up_prompts: {type: "array", items: {type: "string"}},
        own_story: {type: "string"}
    },
    required: ["answer", "follow_up_prompts"],
    additionalProperties: false
};

/**
 * The one-piece answer from Claude, schema-constrained so it is always the
 * `{answer, follow_up_prompts}` object the parser expects. Same cache
 * breakpoint, effort and fallback as the stream.
 */
async function requestClaudeJSON(params: {
    systemPrompt: string;
    userPrompt: string;
    history?: AskConversationTurn[];
    key: string;
    model: string;
    effort: AskChatEffort;
    signal?: AbortSignal;
}): Promise<AskWholeAnswer | null> {
    // One retry: this is already the last resort for a reader whose stream
    // died, and a dropped connection (seen once on a cold dev server) is
    // worth one more try before the answer comes from another model.
    const client = new Anthropic({apiKey: params.key, timeout: 60_000, maxRetries: 1});
    const response = await client.beta.messages.create({
        model: params.model,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {effort: params.effort, format: {type: "json_schema", schema: ANSWER_JSON_SCHEMA}},
        system: [{type: "text", text: params.systemPrompt, cache_control: {type: "ephemeral"}}],
        messages: [
            ...(params.history ?? []).map((turn) => ({role: turn.role, content: turn.content})),
            {role: "user" as const, content: params.userPrompt}
        ]
    }, {signal: params.signal});
    logClaudeUsage("json", response);
    if (response.stop_reason === "refusal") throw new Error(`claude_refusal:${response.stop_details?.category ?? "unknown"}`);
    if (response.stop_reason === "max_tokens") throw new Error("claude_truncated");
    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("").trim();
    return text ? parseAnswerPayload(text) : null;
}

async function requestGeminiJSON(params: {
    systemPrompt: string;
    userPrompt: string;
    history?: AskConversationTurn[];
    key: string;
    model: string;
    signal?: AbortSignal;
}) {
    return parseAnswerPayload((await requestGeminiRaw(params)).trim());
}

async function requestGeminiRaw(params: {
    systemPrompt: string;
    userPrompt: string;
    history?: AskConversationTurn[];
    key: string;
    model: string;
    signal?: AbortSignal;
}): Promise<string> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}`
        + `:generateContent?key=${encodeURIComponent(params.key)}`,
        {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                systemInstruction: {parts: [{text: params.systemPrompt}]},
                contents: geminiContents(params),
                generationConfig: {
                    temperature: 0.35,
                    responseMimeType: "application/json",
                    maxOutputTokens: 2048,
                    thinkingConfig: {thinkingBudget: 0}
                }
            }),
            signal: params.signal
        }
    );
    if (!response.ok) throw new Error(`gemini_${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    return extractGeminiText(payload);
}

async function requestOpenAIJSON(params: {
    systemPrompt: string;
    userPrompt: string;
    history?: AskConversationTurn[];
    key: string;
    model: string;
    signal?: AbortSignal;
}) {
    const raw = await requestOpenAIRaw(params);
    return raw ? parseAnswerPayload(raw) : null;
}

async function requestOpenAIRaw(params: {
    systemPrompt: string;
    userPrompt: string;
    history?: AskConversationTurn[];
    key: string;
    model: string;
    signal?: AbortSignal;
}): Promise<string | null> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: params.model,
            temperature: 0.35,
            max_completion_tokens: 1600,
            response_format: {type: "json_object"},
            messages: openAIMessages(params)
        }),
        signal: params.signal
    });
    if (!response.ok) throw new Error(`openai_${response.status}`);
    const payload = await response.json() as {choices?: Array<{message?: {content?: string}}>};
    return payload.choices?.[0]?.message?.content ?? null;
}
