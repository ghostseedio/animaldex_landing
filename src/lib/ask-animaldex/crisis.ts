/* Ported from the apps' supabase/functions/_shared/animal-crisis.ts (AnimalDex strategy/chat-engine, 2026-11-04): keep the two in step. */
/// A crisis is read apart from everything else (strategy, 2026-11-04). Until
/// now safety was the prompt's own exception (ANIMAL_ROLE_RULES) and a word
/// list (CRISIS_PATTERN, animal-companion.ts), which misses "I don't want to
/// be here anymore" and catches "I could kill myself laughing".
///
/// A small fast call reads the message for an emergency, beside the kind's
/// verdict, so it adds no wait of its own. When it says crisis the turn gets
/// the fixed reply (crisis-helplines.ts): no model writes it, no steps, no
/// debate, no follow-ups, nothing remembered, and the message is not charged.
/// Each one is logged in safety_events (migration 20261104170000): who, which
/// animal, where and the category, never the words.
///
/// When the call fails or is off, the word list decides as before. When it
/// answers, it overrules the word list both ways: a figure of speech is not a
/// crisis, and a crisis in other words is one.

import Anthropic from "@anthropic-ai/sdk";

type Env = (name: string) => string | undefined;
const defaultEnv: Env = (name) => process.env[name]?.trim() || undefined;

export const CRISIS_CATEGORIES = ["suicide", "self_harm", "harm_to_others", "abuse", "medical", "other"] as const;
export type CrisisCategory = typeof CRISIS_CATEGORIES[number];
export type CrisisRisk = "none" | "concern" | "crisis";

export type CrisisCheck = { risk: CrisisRisk; category: CrisisCategory | null };

/// Room for the one-line JSON.
export const CRISIS_CHECK_MAX_TOKENS = 60;

/// Off with ANIMAL_CHAT_CRISIS_CHECK=off (the word list alone decides).
export function crisisCheckEnabled(env: Env = defaultEnv): boolean {
    return env("ANIMAL_CHAT_CRISIS_CHECK")?.toLowerCase() !== "off";
}

function clip(value: string | null | undefined, max: number): string {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export type CrisisCheckInput = {
    message: string;
    /// Earlier turns, oldest first: "I've decided" means something else after "I want to end it".
    history?: Array<{ role: string; content: string }>;
    /// 13 to 17 (age-band.ts): a hint is enough.
    teen?: boolean;
};

export function buildCrisisCheckPrompt(input: CrisisCheckInput): string {
    const earlier = (input.history ?? [])
        .map((turn) => ({ who: turn.role === "user" ? "person" : "animal", said: clip(turn.content, 300) }))
        .filter((turn) => turn.said.length > 0)
        .slice(-4);
    return [
        "You check one message sent to an AI animal in a chat app for an emergency. You are not replying to it.",
        "",
        earlier.length > 0 ? `Earlier in the conversation, oldest first:\n${JSON.stringify(earlier)}` : "",
        `The message: <message>${clip(input.message, 900)}</message>`,
        "",
        "Is the person at risk right now: thinking about or planning suicide or hurting themselves, saying they will hurt",
        "someone, being hurt or threatened by someone at this moment, or in a medical emergency? In any language, and in",
        "slang. Jokes, song lyrics, games, fiction, figures of speech (\"this traffic is killing me\", \"I could die of",
        "embarrassment\") and a past that is over are not. Sadness, stress, grief or loneliness on their own are concern,",
        "not crisis. When unsure between concern and crisis, say crisis.",
        ...(input.teen
            ? ["The person is 13 to 17: any sign they want to hurt themselves, or that an adult is hurting or threatening them, is crisis."]
            : []),
        "",
        'Return JSON only, on one line: {"risk": "none", "concern" or "crisis", "category": "suicide", "self_harm",',
        '"harm_to_others", "abuse", "medical", "other" or null}',
    ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

/// The request as it goes to the model (the eval harness writes this exact call out).
export function crisisCheckRequest(model: string, input: CrisisCheckInput) {
    return {
        model,
        max_tokens: CRISIS_CHECK_MAX_TOKENS,
        thinking: { type: "disabled" as const },
        messages: [{ role: "user" as const, content: buildCrisisCheckPrompt(input) }],
    };
}

export function parseCrisisCheck(raw: Record<string, unknown>): CrisisCheck | null {
    const risk = typeof raw.risk === "string" ? raw.risk.trim().toLowerCase() : "";
    if (risk !== "none" && risk !== "concern" && risk !== "crisis") return null;
    const value = typeof raw.category === "string" ? raw.category.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
    const category = (CRISIS_CATEGORIES as readonly string[]).includes(value) ? value as CrisisCategory : null;
    return { risk, category: risk === "none" ? null : category ?? (risk === "crisis" ? "other" : null) };
}

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

/// Null on any failure: the word list then decides.
export async function requestCrisisCheck(params: {
    apiKey: string;
    model: string;
    input: CrisisCheckInput;
    timeoutMs?: number;
    /// For tests.
    fetchImpl?: typeof fetch;
}): Promise<CrisisCheck | null> {
    try {
        const client = new Anthropic({
            apiKey: params.apiKey,
            fetch: (input, init) => (params.fetchImpl ?? fetch)(input, init),
            timeout: params.timeoutMs ?? 4_000,
            maxRetries: 0,
        });
        const response = await client.messages.create(crisisCheckRequest(params.model, params.input));
        const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
        const raw = jsonRecord(text);
        return raw ? parseCrisisCheck(raw) : null;
    } catch (error) {
        console.warn("animal crisis check failed", error instanceof Error ? error.message : String(error));
        return null;
    }
}

export type CrisisDecision = { crisis: boolean; category: CrisisCategory | null; source: "classifier" | "pattern" | null };

/// Whether this turn is a crisis: the classifier's word when it answered, the
/// word list's when it did not.
export function crisisDecision(params: { check: CrisisCheck | null; patternHit: boolean }): CrisisDecision {
    if (params.check) {
        return params.check.risk === "crisis"
            ? { crisis: true, category: params.check.category ?? "other", source: "classifier" }
            : { crisis: false, category: null, source: null };
    }
    return params.patternHit ? { crisis: true, category: "other", source: "pattern" } : { crisis: false, category: null, source: null };
}

type SafetyAdmin = {
    from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message?: string; code?: string } | null }> };
};

/// One row per safety event, never the message. Never fails the turn; missing
/// before the migration is applied.
export async function logSafetyEvent(admin: SafetyAdmin, row: {
    userId: string | null;
    speciesProfileId: string | null;
    surface: "app" | "web";
    /// crisis_reply | age_restricted
    action: "crisis_reply" | "age_restricted";
    category: string | null;
    source: "classifier" | "pattern" | "age_gate";
    ageBand?: string | null;
}): Promise<void> {
    try {
        const { error } = await admin.from("safety_events").insert({
            user_id: row.userId,
            species_profile_id: row.speciesProfileId,
            surface: row.surface,
            action: row.action,
            category: row.category ? row.category.slice(0, 40) : null,
            source: row.source,
            age_band: row.ageBand ?? null,
        });
        if (error && error.code !== "42P01") console.warn("safety_events insert failed", error.message);
    } catch (error) {
        console.warn("safety_events insert failed", error instanceof Error ? error.message : String(error));
    }
}
