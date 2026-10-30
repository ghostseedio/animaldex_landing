/**
 * What each animal is told in a debate (docs/debates/SPEC.md, section 1.3).
 *
 * PLACEHOLDER, for the coordinator to replace word for word with the server
 * lane's debate rules (`generate-applied-insight`'s `debate` flow,
 * docs/debates/SERVER.md) when they are ported, as the group and Your step
 * rules were. Until then these lines say only what the SPEC says, so the
 * web's debate runs end to end with the same shape: an opening verdict from
 * the animal's own life and Power, one answer to the others that holds its
 * own way, one closing line; never a decision for the person, and an invited
 * animal speaks as its species and Power only.
 */

import type {AskDebatePlan} from "@/lib/ask-animaldex/debate-flow";

export function askDebateRulesLines(params: {
    me: {label: string; shortName: string; powerName: string};
    others: Array<{label: string; shortName: string; powerName: string}>;
}): string[] {
    return [
        `Debate: the person brought you a real problem, and you are weighing in with ${params.others.map((other) => `${other.label} (${other.powerName})`).join("; ")}. You are ${params.me.shortName}.`,
        `- Your way is your Power's, ${params.me.powerName}, and comes from how your kind lives. Give your own verdict and why, from your own life.`,
        "- Answer the others by name. Hold your ground, or concede a point, but never give up your own way.",
        "- You never decide for the person, and nobody wins here: the person picks a way to try.",
        "- Speak only as yourself. Never write lines for the others.",
        "- Each turn's instructions give you its job and its length. Follow both."
    ];
}

export function askDebateTurnInstruction(params: {plan: AskDebatePlan; words: number; replyToName: string | null}): string[] {
    switch (params.plan.phase) {
        case "open":
            return [
                "this_turn: your opening.",
                `Give your verdict on the person's problem and why, from your own life, in at most ${params.words} words.`
            ];
        case "react":
            return [
                `this_turn: answer ${params.replyToName ?? "the others"} once (the last line in just_now).`,
                `Hold your ground or concede a point, but keep your own way, in at most ${params.words} words.`
            ];
        case "close":
            return [
                "this_turn: your closing line.",
                `One line: your way, for the person to try, in at most ${params.words} words. Do not decide for them.`
            ];
    }
}

/** How long a debate turn may be: an opening has room, a close is one line. */
export function askDebateWordBudget(phase: AskDebatePlan["phase"], personaWordBudget: number): number {
    const base = {open: 55, react: 36, close: 18}[phase];
    const scale = 0.7 + 0.3 * Math.min(1, Math.max(0, personaWordBudget - 35) / 60);
    return Math.max(10, Math.round(base * scale));
}
