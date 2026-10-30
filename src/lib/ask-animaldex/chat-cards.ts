/**
 * The cards an animal may offer in its owner's chat (3.2, docs/your-step/
 * SPEC.md sections 4 and 5), as the apps' `animaldex-card` fence:
 *
 *   ```animaldex-card
 *   {"kind":"training", ...}   → the Warmup: Take the warmup (+5 XP) / Skip
 *   {"kind":"trial","frequency":"MID", ...} → "{name}'s Trials", a picker
 *   ```
 *
 * Only the kind (and a Trial's frequency) is read: the card's words are the
 * site's own, never the model's. Any other kind (the apps' retired `apply`,
 * `comparison`) is no card here. The fence is never drawn as a bubble; the
 * drawer draws the card under the reply.
 */

import {stepFrequency, type StepFrequency} from "@/lib/your-step";

export const ASK_CHAT_CARD_LANGUAGE = "animaldex-card";

export type AskChatCard =
    | {kind: "training"}
    | {kind: "trial"; frequency: StepFrequency | null};

export function decodeAskChatCard(payload: string): AskChatCard | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(payload);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    const kind = typeof row.kind === "string" ? row.kind.trim().toLowerCase() : "";
    if (kind === "training" || kind === "warmup") return {kind: "training"};
    if (kind === "trial" || kind === "trials") return {kind: "trial", frequency: stepFrequency(row.frequency)};
    return null;
}

/**
 * The cards in a finished reply, in order, one of each kind at most (the
 * animal offers one thing at a time). A fence still arriving is not a card yet.
 */
export function askReplyCards(text: string): AskChatCard[] {
    const cards: AskChatCard[] = [];
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let body: string[] | null = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (body) {
            if (trimmed.startsWith("```")) {
                const card = decodeAskChatCard(body.join("\n"));
                if (card && !cards.some((existing) => existing.kind === card.kind)) cards.push(card);
                body = null;
            } else {
                body.push(line);
            }
            continue;
        }
        if (trimmed.startsWith("```") && trimmed.slice(3).trim().toLowerCase() === ASK_CHAT_CARD_LANGUAGE) body = [];
    }
    return cards;
}
