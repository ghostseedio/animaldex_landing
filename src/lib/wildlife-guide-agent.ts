/**
 * Ask AnimalDex for Wildlife Guides: the author asks in words and the
 * `wildlife-guide-agent` edge function edits their guides. Deleting, sharing
 * and hiding come back as confirmations that run only when the author clicks.
 * Copy matches iOS WildlifeGuideAgentView.
 */

export type AgentRole = "user" | "assistant";
export type AgentTurn = {role: AgentRole; text: string};

export type AgentConfirmationKind = "share_guide" | "hide_guide" | "delete_guide" | "share_all" | "hide_all";
export type AgentConfirmation = {kind: AgentConfirmationKind; guideId?: string; guideTitle?: string};

export type AgentReply = {
    reply: string;
    changedGuideIds: string[];
    confirmations: AgentConfirmation[];
    stoppedEarly: boolean;
    turnsLeft: number | null;
};

export const AGENT_DAILY_LIMIT_MESSAGE = "You've reached today's limit for Ask AnimalDex. Try again tomorrow.";
export const AGENT_UNAVAILABLE_MESSAGE = "Ask AnimalDex isn't available right now. Try again in a moment.";
export const AGENT_INTRO = "Tell AnimalDex what to change in your guides: text, prices, animals, photos, contacts or notes.";
export const AGENT_DELETE_MESSAGE = "It disappears for everyone, and AnimalDex won't make a new guide for this place.";

const MAX_TURNS = 40;
const MAX_TEXT = 4000;
const KINDS = new Set<AgentConfirmationKind>(["share_guide", "hide_guide", "delete_guide", "share_all", "hide_all"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function agentSuggestions(guideTitle?: string | null) {
    if (guideTitle) {
        return [
            `Write a better title for "${guideTitle}"`,
            `Check the draft notes in "${guideTitle}"`,
            `Make "${guideTitle}" cheaper`
        ];
    }
    return [
        "Which of my guides are still being written?",
        "Set all my guides to automatic prices",
        "Write better titles for my guides"
    ];
}

export function confirmationTitle(confirmation: AgentConfirmation) {
    const name = confirmation.guideTitle?.trim() || "this guide";
    switch (confirmation.kind) {
        case "delete_guide": return `Delete "${name}"`;
        case "share_guide": return `Share "${name}"`;
        case "hide_guide": return `Hide "${name}"`;
        case "share_all": return "Share all my guides";
        case "hide_all": return "Hide all my guides";
    }
}

export function confirmationKey(confirmation: AgentConfirmation) {
    return `${confirmation.kind}:${confirmation.guideId ?? ""}`;
}

/** The chat as the edge function takes it, or null when it can't be sent. */
export function sanitizeAgentTurns(value: unknown): AgentTurn[] | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    const turns: AgentTurn[] = [];
    for (const raw of value.slice(-MAX_TURNS)) {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Record<string, unknown>;
        if (row.role !== "user" && row.role !== "assistant") return null;
        if (typeof row.text !== "string") return null;
        const text = row.text.trim().slice(0, MAX_TEXT);
        if (!text) continue;
        turns.push({role: row.role, text});
    }
    if (turns.length === 0 || turns[turns.length - 1].role !== "user") return null;
    return turns;
}

/** Only well-formed confirmations survive; a guide action needs a guide id. */
export function sanitizeAgentReply(value: unknown): AgentReply {
    const payload = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const confirmations: AgentConfirmation[] = [];
    for (const raw of Array.isArray(payload.confirmations) ? payload.confirmations : []) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;
        const kind = row.kind as AgentConfirmationKind;
        if (!KINDS.has(kind)) continue;
        const guideId = typeof row.guideId === "string" && UUID.test(row.guideId) ? row.guideId : undefined;
        if ((kind === "share_guide" || kind === "hide_guide" || kind === "delete_guide") && !guideId) continue;
        const guideTitle = typeof row.guideTitle === "string" && row.guideTitle.trim() ? row.guideTitle.trim().slice(0, 140) : undefined;
        confirmations.push({kind, ...(guideId ? {guideId} : {}), ...(guideTitle ? {guideTitle} : {})});
    }
    return {
        reply: typeof payload.reply === "string" ? payload.reply.trim() : "",
        changedGuideIds: Array.isArray(payload.changedGuideIds)
            ? payload.changedGuideIds.filter((id): id is string => typeof id === "string" && UUID.test(id))
            : [],
        confirmations,
        stoppedEarly: payload.stoppedEarly === true,
        turnsLeft: typeof payload.turnsLeft === "number" ? payload.turnsLeft : null
    };
}
