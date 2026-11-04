/* Ported from the apps' supabase/functions/_shared/animal-chat-routing.ts (AnimalDex strategy/chat-engine, 2026-11-04): keep the two in step. */
/// Which model answers a turn, and how hard it thinks (strategy, 2026-11-04).
///
/// - A greeting and small talk: the small-talk model (Haiku 5.5), thinking
///   off. A hello cost as much as a real answer on Opus ($0.029 a greeting,
///   CTO audit 2026-11-04) and read no better for it.
/// - An idea, a decision or a problem, a report on a step, and a Trial
///   question: the deep model, at effort medium or higher whatever the
///   animal's stats. Until now the intelligence stat set the effort, so 79%
///   of species answered at low, and a grieving person got one line from a
///   sea star. The stats shape the voice, never the depth.
/// - A live call: the call model, as before (the voice must start at once).
///
/// The deep model for free and for Pro accounts, the small-talk model and the
/// floor are columns of animal_chat_config (migration 20261104170000):
/// deep_model_free, deep_model_pro (Opus 5.5 for both by default),
/// small_talk_model and deep_effort_floor; turn_routing false puts every turn
/// back on the single chat model, as before. A missing column keeps its
/// default, so the function can ship before the migration.
/// ANIMAL_CHAT_MAX_EFFORT still caps everything (an emergency brake).
///
/// The animal's system prompt is cached per model, so a conversation that
/// moves between Haiku and the deep model keeps one warm cache for each.

import type {TurnKind} from "@/lib/ask-animaldex/turn-kind";

export type ChatEffort = "low" | "medium" | "high";

export type ChatRoutingConfig = {
    /// turn_routing: false sends every turn to the single chat model.
    enabled: boolean;
    deepModelFree: string;
    deepModelPro: string;
    smallTalkModel: string;
    deepEffortFloor: ChatEffort;
};

export const DEFAULT_CHAT_ROUTING: ChatRoutingConfig = {
    enabled: true,
    deepModelFree: "claude-opus-5-5",
    deepModelPro: "claude-opus-5-5",
    smallTalkModel: "claude-haiku-5-5",
    deepEffortFloor: "medium",
};

const EFFORT_ORDER: ChatEffort[] = ["low", "medium", "high"];

function effortOf(raw: unknown): ChatEffort | null {
    const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return (EFFORT_ORDER as string[]).includes(value) ? value as ChatEffort : null;
}

function modelOf(raw: unknown, fallback: string): string {
    const value = typeof raw === "string" ? raw.trim() : "";
    return /^claude-[a-z0-9.-]{3,60}$/.test(value) ? value : fallback;
}

/// The config row, defaults for anything missing or malformed.
export function parseChatRoutingConfig(row: Record<string, unknown> | null | undefined): ChatRoutingConfig {
    const r = row ?? {};
    return {
        enabled: r.turn_routing !== false,
        deepModelFree: modelOf(r.deep_model_free, DEFAULT_CHAT_ROUTING.deepModelFree),
        deepModelPro: modelOf(r.deep_model_pro, DEFAULT_CHAT_ROUTING.deepModelPro),
        smallTalkModel: modelOf(r.small_talk_model, DEFAULT_CHAT_ROUTING.smallTalkModel),
        deepEffortFloor: effortOf(r.deep_effort_floor) ?? DEFAULT_CHAT_ROUTING.deepEffortFloor,
    };
}

type ConfigAdmin = { from: (table: string) => unknown };

let routingCache: { at: number; value: ChatRoutingConfig } | null = null;
const ROUTING_TTL_MS = 60 * 1000;

/// The live config, read once a minute per function instance; the defaults
/// when it cannot be read.
export async function loadChatRoutingConfig(admin: ConfigAdmin): Promise<ChatRoutingConfig> {
    if (routingCache && Date.now() - routingCache.at < ROUTING_TTL_MS) return routingCache.value;
    let value = DEFAULT_CHAT_ROUTING;
    try {
        // deno-lint-ignore no-explicit-any
        const { data, error } = await (admin.from("animal_chat_config") as any).select("*").eq("singleton", true).maybeSingle();
        if (!error) value = parseChatRoutingConfig(data as Record<string, unknown> | null);
    } catch {
        value = DEFAULT_CHAT_ROUTING;
    }
    routingCache = { at: Date.now(), value };
    return value;
}

/// For tests: forget the cached config.
export function resetChatRoutingCache(): void {
    routingCache = null;
}

export type ChatRoute = {
    tier: "greeting" | "small_talk" | "deep" | "call" | "single_model";
    model: string;
    effort: ChatEffort;
    /// "off" only on Haiku, where thinking can be switched off (Opus 5.5 and
    /// Sonnet 5.5 reject it).
    thinking: "adaptive" | "off";
    /// The server-side fallback on a declined request (not on Haiku 5.5).
    fallback: boolean;
};

export function isHaikuModel(model: string): boolean {
    return /haiku/i.test(model);
}

function capped(effort: ChatEffort, cap: string | null | undefined): ChatEffort {
    const limit = EFFORT_ORDER.indexOf(effortOf(cap) ?? "high");
    return EFFORT_ORDER[Math.min(EFFORT_ORDER.indexOf(effort), limit)];
}

function raised(effort: ChatEffort, floor: ChatEffort): ChatEffort {
    return EFFORT_ORDER[Math.max(EFFORT_ORDER.indexOf(effort), EFFORT_ORDER.indexOf(floor))];
}

function light(tier: "greeting" | "small_talk", model: string): ChatRoute {
    const haiku = isHaikuModel(model);
    return { tier, model, effort: "low", thinking: haiku ? "off" : "adaptive", fallback: !haiku };
}

export function routeChatTurn(params: {
    /// The turn's kind (resolveTurnKind); ignored for a greeting.
    kind: TurnKind | null;
    greeting: boolean;
    call: boolean;
    /// A report on their step, or a Trial question: the deep model whatever the words.
    forceDeep?: boolean;
    /// Verified Pro (take_animal_chat_turn_v2), for the deep model.
    isPro: boolean;
    /// The animal's own effort (animal-persona.ts): a floor for the deep turn, never its ceiling.
    personaEffort: ChatEffort;
    /// ANIMAL_CHAT_MAX_EFFORT; medium when unset.
    maxEffort?: string | null;
    config: ChatRoutingConfig;
    /// CLAUDE_ANIMAL_CHAT_MODEL: every turn's model with routing off.
    chatModel: string;
    /// CLAUDE_ANIMAL_CALL_MODEL.
    callModel: string;
}): ChatRoute {
    const cap = params.maxEffort ?? "medium";
    if (params.call) return { tier: "call", model: params.callModel, effort: "low", thinking: "off", fallback: false };
    if (!params.config.enabled) {
        const haiku = isHaikuModel(params.chatModel);
        return {
            tier: "single_model",
            model: params.chatModel,
            effort: params.greeting ? "low" : capped(params.personaEffort, cap),
            thinking: "adaptive",
            fallback: !haiku,
        };
    }
    if (params.greeting) return light("greeting", params.config.smallTalkModel);
    if (params.kind === "chat" && !params.forceDeep) return light("small_talk", params.config.smallTalkModel);
    const model = params.isPro ? params.config.deepModelPro : params.config.deepModelFree;
    return {
        tier: "deep",
        model,
        effort: capped(raised(params.personaEffort, params.config.deepEffortFloor), cap),
        thinking: "adaptive",
        fallback: !isHaikuModel(model),
    };
}
