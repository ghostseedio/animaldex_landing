/**
 * Group conversations as a real conversation: the animals talk WITH each
 * other while the reader listens, one turn at a time, each turn written by
 * that animal's own persona after hearing everything said so far.
 *
 * A round follows one arc: one animal opens with its own Power's answer; each
 * of the others, on its first word, says what ITS Power would do and where it
 * differs; then they argue it out, holding their ground or conceding to a
 * better reason. If most of the room has come round (the hidden [[settled]]
 * marker on their latest turn), one says where they now agree ("converge",
 * which the page badges "Common ground"); if not, the most dominant animal
 * makes the call ("decide"). Another then closes — agreeing, or still holding
 * out — and turns back to the reader. Agreement can land the round early, once
 * everyone has spoken and someone has answered back; a real argument runs to
 * the cap. A message addressed to one animal, or a crisis, is a single answer.
 *
 * Port of the apps' `supabase/functions/_shared/animal-group-conversation.ts`
 * (AnimalDex 4870e24b, 243748bc), rule text verbatim, with the same SSE frames
 * so the page plays a round the way the apps do. The web asks only for the
 * conversation flow; the apps' older one-answer-per-animal stream is not
 * ported. Plus the turn's user prompt (the apps' `buildAnimalVoiceUserPrompt`
 * with a turn instruction).
 */

import {ASK_FOLLOW_UP_SENTINEL, splitStreamedReply} from "@/lib/ask-animaldex/prompt";
import {askMemorySection, type AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";
import type {AnswerDeltaSource} from "@/lib/ask-animaldex/providers";

export type AskConversationPhase = "answer" | "open" | "react" | "converge" | "decide" | "seal";

export type AskConversationTurn = {
    speaker: number;
    phase: AskConversationPhase;
    text: string;
    /** The speaker says the room now wants the same thing for the person. */
    settled: boolean;
    /** Other speakers this turn named. */
    mentioned: number[];
};

export type AskConversationPlan = {
    speaker: number;
    phase: AskConversationPhase;
    /** Who this turn answers; null for the person. */
    replyTo: number | null;
    /** A reaction that is this animal's first word: it states its own position. */
    first?: true;
    /** A seal after a disagreement the leader settled, not a shared view. */
    overruled?: true;
};

export const ASK_SETTLED_MARKER = "[[settled]]";

/**
 * The most turns in one round: everyone states a position, the argument goes
 * back and forth, and the round lands on two closing turns. A round that finds
 * real agreement lands sooner (`planAskNextTurn`); one that does not argues to here.
 */
export function askConversationLength(speakers: number): number {
    if (speakers <= 1) return 1;
    return Math.min(8, Math.max(6, speakers + 4));
}

/** Most of the room came round: more than half of the animals still in it ended their latest turn settled. */
function roomAgrees(turns: AskConversationTurn[], available: number[]): boolean {
    const settled = available.filter((index) => {
        for (let i = turns.length - 1; i >= 0; i -= 1) if (turns[i].speaker === index) return turns[i].settled;
        return false;
    });
    return settled.length * 2 > available.length;
}

/**
 * Who speaks next, and to do what. Speakers are ordered: index 0 opens and is
 * the leader (the most dominant, or the animal the reader addressed). `out`
 * holds speakers whose model failed this round; they are skipped.
 */
export function planAskNextTurn(params: {
    speakers: number;
    turns: AskConversationTurn[];
    length: number;
    out?: ReadonlySet<number>;
    /** One animal alone answers (addressed, crisis, or only one in the room). */
    single?: boolean;
}): AskConversationPlan | null {
    const out = params.out ?? new Set<number>();
    const available = Array.from({length: params.speakers}, (_, index) => index).filter((index) => !out.has(index));
    const {turns} = params;
    if (available.length === 0) return null;

    if (params.single || params.speakers === 1) {
        return turns.length === 0 ? {speaker: available[0], phase: "answer", replyTo: null} : null;
    }
    if (turns.length === 0) return {speaker: available[0], phase: "open", replyTo: null};

    const last = turns[turns.length - 1];
    if (last.phase === "seal" || turns.length >= params.length) return null;
    // Only one animal left standing: nobody to talk with.
    if (available.length === 1) return null;

    const spoken = new Set(turns.map((turn) => turn.speaker));
    const everyoneSpoke = available.every((index) => spoken.has(index));
    const lastSpoke = (index: number) => {
        for (let i = turns.length - 1; i >= 0; i -= 1) if (turns[i].speaker === index) return i;
        return -1;
    };
    const leastRecent = (candidates: number[]) =>
        [...candidates].sort((a, b) => lastSpoke(a) - lastSpoke(b) || a - b)[0];
    const others = available.filter((index) => index !== last.speaker);
    if (others.length === 0) return null;
    const leader = available[0];

    if (last.phase === "converge" || last.phase === "decide") {
        return {
            speaker: leastRecent(others),
            phase: "seal",
            replyTo: last.speaker,
            ...(last.phase === "decide" ? {overruled: true as const} : {})
        };
    }
    const landed = turns.some((turn) => turn.phase === "converge" || turn.phase === "decide");
    const landAt = params.length - 2;
    // Agreement can end the argument early, but never before everyone has had
    // their say and someone has answered back.
    const agreedEarly = everyoneSpoke && turns.length >= available.length + 1 && roomAgrees(turns, available);
    if (!landed && agreedEarly) {
        return {speaker: others[0], phase: "converge", replyTo: null};
    }
    if (!landed && everyoneSpoke && turns.length >= landAt) {
        if (roomAgrees(turns, available)) {
            // The most dominant animal who did not just speak pulls it together.
            return {speaker: others[0], phase: "converge", replyTo: null};
        }
        // No common ground: the leader settles it, unless it spoke last.
        return {speaker: leader === last.speaker ? others[0] : leader, phase: "decide", replyTo: null};
    }

    const fresh = others.find((index) => !spoken.has(index));
    if (fresh !== undefined) return {speaker: fresh, phase: "react", replyTo: last.speaker, first: true};
    // The turn before the round lands goes to someone other than the leader,
    // so the leader can make the call without answering itself.
    const landsNext = turns.length + 1 >= landAt;
    const candidates = landsNext && others.length > 1 ? others.filter((index) => index !== leader) : others;
    const named = last.mentioned.find((index) => candidates.includes(index));
    if (named !== undefined) return {speaker: named, phase: "react", replyTo: last.speaker};
    return {speaker: leastRecent(candidates), phase: "react", replyTo: last.speaker};
}

/** How long this turn may be. Big animals (small persona budgets) say less. */
export function askPhaseWordBudget(phase: AskConversationPhase, personaWordBudget: number): number {
    if (phase === "answer") return personaWordBudget;
    const base = {open: 45, react: 32, converge: 40, decide: 40, seal: 24}[phase];
    const scale = 0.7 + 0.3 * Math.min(1, Math.max(0, personaWordBudget - 35) / 60);
    return Math.max(12, Math.round(base * scale));
}

/**
 * The system-prompt rules for an animal in a conversation. Stable for a given
 * room, so each animal's prompt is cached across its turns.
 */
export function askConversationRulesLines(params: {
    me: {label: string; shortName: string};
    others: Array<{label: string; shortName: string; powerName: string}>;
}): string[] {
    const names = params.others.map((other) => other.shortName).join(", ");
    return [
        `Group conversation: you are here with ${params.others.map((other) => `${other.label} (${other.powerName})`).join("; ")}. `
            + "The person who keeps all of you is listening, and joins in when they want.",
        "This is a real back-and-forth between animals, not a panel answering questions. You speak in short turns: react to what was just said, then add what only you would say.",
        "- Each of you sees the problem through your own Power, so you usually want different things for the person. That is why they asked all of you: to hear different takes argued out, not a panel that agrees. Your view is your Power's view.",
        `- Call the others by name (${names}) and talk TO them, not about them. You are ${params.me.shortName}.`,
        "- Hold your ground with reasons from your body, your world and your Power. Concede only when someone's reason beats yours, and then say what changed your mind. Never agree to be agreeable, never meet in the middle to keep the peace, never mock.",
        "- Sound like yourself in every line: your senses, your habits, your rhythm, your size. No assistant phrasing, no lists, no headings, no greetings, no summing up what the others said, no stage directions in asterisks.",
        "- Never repeat a point someone already made.",
        "- Speak only as yourself. Never write lines for the others.",
        "- Each turn's instructions give you its job and its length. Follow both."
    ];
}

/** What this turn is for, appended after the conversation so far. */
export function askConversationTurnInstruction(params: {
    plan: AskConversationPlan;
    words: number;
    replyToName?: string | null;
    personMessage: string;
}): string[] {
    const {plan, words} = params;
    const them = params.replyToName ?? "them";
    const settledLine =
        `If you and the others now genuinely want the same thing for the person — they came round to you, or a reason of theirs beat yours — end with ${ASK_SETTLED_MARKER} (it is hidden from the person). Never use it to keep the peace.`;
    switch (plan.phase) {
        case "answer":
            return [
                "this_turn: the person is talking to you alone; the others are listening.",
                `Answer them as yourself, in about ${words} words.`
            ];
        case "open":
            return [
                "this_turn: you speak first.",
                `Tell the person what YOU would do about what they said — your Power's answer, as a clear position, in your own voice, in at most ${words} words. Pick a side; do not cover the other options or hedge. The others will bring their own.`
            ];
        case "react":
            if (plan.first) {
                return [
                    `this_turn: your first word. ${params.replyToName ?? "The last speaker"} just spoke (the last line in just_now).`,
                    `Say what YOU would do — your Power's answer — even if it goes against everything said so far, and tell ${them} by name where you differ. Talk to the animals, not the person. At most ${words} words.`,
                    settledLine
                ];
            }
            return [
                `this_turn: ${params.replyToName ?? "the last speaker"} just spoke (the last line in just_now).`,
                `Answer ${them} directly, and the others if you like, not the person. Hold your ground with a reason from how you live, or concede if their reason truly beats yours and say what changed your mind. At most ${words} words.`,
                settledLine
            ];
        case "converge":
            return [
                "this_turn: most of you have come round to one view. Pull it together.",
                `Say where you all now agree, in your own voice, in at most ${words} words. Name who brought you round. If someone still differs, name it in a few words.`
            ];
        case "decide":
            return [
                "this_turn: you have all had your say and you still disagree. You carry the most weight here, so you make the call.",
                `Tell the person which way to go and why, in your own voice, in at most ${words} words. Name who you are overruling and the one thing they got right. Do not pretend everyone agrees.`
            ];
        case "seal":
            if (plan.overruled) {
                return [
                    `this_turn: ${params.replyToName ?? "another animal"} just made the call.`,
                    `Close it: accept it in a few words, or say plainly that you still see it differently — you do not have to agree. Then turn to the person with one short question that helps them choose. At most ${words} words.`
                ];
            }
            return [
                `this_turn: ${params.replyToName ?? "another animal"} just said where you all agree.`,
                `Close it: agree in a few words, or add one small condition from how you live, then turn to the person with one short question that helps them act on it. At most ${words} words.`
            ];
    }
}

/**
 * What the animals call each other: the nickname, else the animal's last word
 * ("the Western Honey Bee" → "Bee"), else, when two would share it, the full
 * name. Addressing a friend as "African Bush Elephant" sounds stiff.
 */
export function askShortNames(members: Array<{nickname: string | null; animalName: string}>): string[] {
    const lastWord = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
    const counts = new Map<string, number>();
    for (const member of members) {
        const key = lastWord(member.animalName).toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return members.map((member) => {
        const nickname = member.nickname?.trim();
        if (nickname) return nickname;
        return counts.get(lastWord(member.animalName).toLowerCase()) === 1 ? lastWord(member.animalName) : member.animalName;
    });
}

/** Speakers a line names, by nickname, full animal name, or its last word ("the Gray Wolf" → "wolf"). */
export function askMentionedSpeakers(text: string, names: Array<{nickname: string | null; animalName: string}>): number[] {
    const lower = text.toLowerCase();
    const has = (word: string) => word.length >= 3
        && new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(lower);
    return names.flatMap((name, index) => {
        const animal = name.animalName.toLowerCase();
        const lastWord = animal.split(/\s+/).at(-1) ?? animal;
        return (name.nickname && has(name.nickname.toLowerCase())) || has(animal) || has(lastWord) ? [index] : [];
    });
}

/**
 * The visible text of a turn so far: the settled marker and any follow-up
 * sentinel removed, and while streaming, a tail held back that could be the
 * start of either.
 */
export function askVisibleTurnText(raw: string, done: boolean): {text: string; settled: boolean} {
    const settled = /\[\[\s*settled\s*\]\]/i.test(raw);
    let text = raw.replace(/\[\[\s*settled\s*\]\]/gi, "");
    const sentinel = text.indexOf(ASK_FOLLOW_UP_SENTINEL);
    if (sentinel >= 0) text = text.slice(0, sentinel);
    if (!done) {
        // Only a tail that could still become a marker waits for more text.
        const hold = Math.max(ASK_SETTLED_MARKER.length, ASK_FOLLOW_UP_SENTINEL.length) - 1;
        const tailStart = Math.max(0, text.length - hold);
        const open = text.slice(tailStart).search(/[[§]/);
        if (open >= 0) text = text.slice(0, tailStart + open);
    }
    return {text: done ? text.trimEnd() : text, settled};
}

/**
 * One turn's user prompt: the person's message, what the animals remember,
 * the animal's moment, the conversation labelled by who said it, what has been
 * said this round, and this turn's job. The apps' `buildAnimalVoiceUserPrompt`
 * with `turnInstruction`, for a record that sits in the system prompt.
 */
export function buildAskGroupTurnUserPrompt(params: {
    userMessage: string;
    memory: AskMemoryFact[];
    speciesProfileId: string | null;
    /** `askRightNowLine`, when the reader's clock is known. */
    rightNow?: string | null;
    earlier: Array<{speaker: string; content: string}>;
    roundSoFar: Array<{speaker: string; content: string}>;
    turnInstruction: string[];
}): string {
    const labelled = params.earlier.filter((turn) => turn.content.trim().length > 0).slice(-8);
    const round = params.roundSoFar.filter((turn) => turn.content.trim().length > 0);
    return [
        `user_message: ${params.userMessage}`,
        "",
        params.rightNow ?? "",
        "wild_profile_summary: not_set",
        askMemorySection(params.memory, params.speciesProfileId),
        labelled.length > 0 ? `earlier_conversation (who said what):\n${JSON.stringify(labelled)}` : "",
        round.length > 0 ? `just_now (the animals, after the person's message, in order):\n${JSON.stringify(round)}` : "",
        "",
        ...params.turnInstruction,
        "Use the conversation for names, pronouns and context, but never let it replace animal_record.",
        "Never bring up the Wild Profile."
    ].filter(Boolean).join("\n");
}

export type AskConversationMember = {
    captureId: string;
    animalName: string;
    nickname: string | null;
    powerName: string;
};

export type AskConversationSpeaker<M extends AskConversationMember> = {
    member: M;
    /** The persona frame the page types this speaker's turns with. */
    persona: Record<string, unknown>;
};

/**
 * One SSE response for a whole conversation round. Turns are generated one
 * after another (each needs the last one's words) and streamed as they are
 * written; the page paces them. The stream stops generating as soon as the
 * page goes away (the reader closed the chat or jumped in).
 *
 * Frames, as the apps': {speakers, flow:"conversation"} · {turn:{index,
 * participant, phase, reply_to, persona}} · {participant, turn_index, delta}
 * · {participant, turn_index, participant_done, settled} · {participant,
 * turn_index, error} · {done, follow_up_prompts, turns, ...closing}.
 */
export function streamAskGroupConversation<M extends AskConversationMember>(params: {
    speakers: Array<AskConversationSpeaker<M>>;
    length: number;
    single: boolean;
    sourceFor: (plan: AskConversationPlan, turns: AskConversationTurn[], signal: AbortSignal) => AnswerDeltaSource;
    mentionsOf: (text: string) => number[];
    closing: Record<string, unknown>;
    followUps: string[];
    headers: Record<string, string>;
    /** An animal that never got a word in: its turn goes back. */
    onSpeakerSilent: (speaker: number) => Promise<void>;
    onDone: (turns: Array<{member: M; text: string; phase: AskConversationPhase}>) => void;
    /** The request's own signal: the page went away. */
    signal?: AbortSignal;
}): Response {
    const encoder = new TextEncoder();
    const abort = new AbortController();
    let cancelled = false;
    params.signal?.addEventListener("abort", () => {
        cancelled = true;
        abort.abort();
    });

    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: Record<string, unknown>) => {
                if (cancelled) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch {
                    cancelled = true;
                    abort.abort();
                }
            };
            send({
                flow: "conversation",
                speakers: params.speakers.map((speaker) => ({
                    capture_id: speaker.member.captureId,
                    animal_name: speaker.member.animalName,
                    nickname: speaker.member.nickname,
                    power_name: speaker.member.powerName,
                    persona: speaker.persona
                }))
            });

            const turns: AskConversationTurn[] = [];
            const out = new Set<number>();
            let turnIndex = 0;
            while (!cancelled) {
                const plan = planAskNextTurn({speakers: params.speakers.length, turns, length: params.length, out, single: params.single});
                if (!plan) break;
                const speaker = params.speakers[plan.speaker];
                const participant = speaker.member.captureId;
                const index = turnIndex;
                turnIndex += 1;
                send({
                    turn: {
                        index,
                        participant,
                        phase: plan.phase,
                        reply_to: plan.replyTo === null ? null : params.speakers[plan.replyTo].member.captureId,
                        persona: speaker.persona
                    }
                });

                let raw = "";
                let emitted = 0;
                try {
                    await params.sourceFor(plan, turns, abort.signal)((delta) => {
                        if (!delta || cancelled) return;
                        raw += delta;
                        const visible = askVisibleTurnText(raw, false).text;
                        if (visible.length > emitted) {
                            send({participant, turn_index: index, delta: visible.slice(emitted)});
                            emitted = visible.length;
                        }
                    });
                } catch (error) {
                    if (!cancelled) console.warn("[ask-animaldex] group turn failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
                }
                if (cancelled) break;

                const final = askVisibleTurnText(raw, true);
                const text = splitStreamedReply(final.text).answer.trim();
                if (text.length > emitted) {
                    send({participant, turn_index: index, delta: text.slice(emitted)});
                }
                if (!text) {
                    out.add(plan.speaker);
                    send({participant, turn_index: index, error: "speaker_failed"});
                    continue;
                }
                turns.push({speaker: plan.speaker, phase: plan.phase, text, settled: final.settled, mentioned: params.mentionsOf(text)});
                send({participant, turn_index: index, participant_done: true, settled: final.settled});
            }

            // An animal that never got a word in this round is not charged for it.
            const spoke = new Set(turns.map((turn) => turn.speaker));
            await Promise.allSettled(
                params.speakers.map((_, index) => (spoke.has(index) ? Promise.resolve() : params.onSpeakerSilent(index)))
            );
            send({done: true, follow_up_prompts: turns.length > 1 ? params.followUps : [], turns: turns.length, ...params.closing});
            params.onDone(turns.map((turn) => ({member: params.speakers[turn.speaker].member, text: turn.text, phase: turn.phase})));
            if (!cancelled) {
                try {
                    controller.close();
                } catch {
                    // Already closed by the page.
                }
            }
        },
        cancel() {
            cancelled = true;
            abort.abort();
        }
    });
    return new Response(body, {
        status: 200,
        headers: {
            ...params.headers,
            "Content-Type": "text/event-stream; charset=utf-8",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no"
        }
    });
}
