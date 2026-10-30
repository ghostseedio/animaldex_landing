/**
 * A debate's turns (docs/debates/SPEC.md, section 1.3), on the group
 * conversation engine's frames: every animal opens with its verdict, then
 * each answers the others once, then each closes in one line. No converge
 * and no decide: no animal decides for the person. At most three turns per
 * animal, in seat order (seat 0 is the host).
 *
 * The schedule and the stream only. What each turn is told is
 * `debate-rules.ts`; each finished turn is handed to `onTurn` to be kept
 * (`debate_record_turn`, idempotent on its index: a turn's index is its place
 * in the schedule, so a debate picked up again never writes one twice), and
 * `finish` moves it on to its report before the last frame.
 *
 * Frames, as the group conversation's, so the page reads them with the same
 * parser: {flow:"debate", speakers} · {turn:{index, participant, seat, phase,
 * reply_to, persona}} · {participant, turn_index, delta} · {participant,
 * turn_index, participant_done} · {participant, turn_index, error} · {done,
 * turns, ...finish()}.
 */

import {splitStreamedReply} from "@/lib/ask-animaldex/prompt";
import {askVisibleTurnText, type AskConversationMember, type AskConversationSpeaker} from "@/lib/ask-animaldex/group-conversation";
import type {AnswerDeltaSource} from "@/lib/ask-animaldex/providers";

export type AskDebatePhase = "open" | "react" | "close";

export type AskDebatePlan = {
    /** Which seat speaks. */
    seat: number;
    phase: AskDebatePhase;
    /** The seat this turn answers; null for an opening or a close. */
    replyTo: number | null;
};

export type AskDebateTurn = {seat: number; phase: AskDebatePhase; text: string};

/** A turn's index: its place in the schedule. */
export function askDebateTurnIndex(schedule: AskDebatePlan[], plan: Pick<AskDebatePlan, "seat" | "phase">): number {
    return schedule.findIndex((entry) => entry.seat === plan.seat && entry.phase === plan.phase);
}

/**
 * The whole debate, in order: everyone opens, everyone reacts once (each to
 * the animal who spoke just before, the host to the last opener), everyone
 * closes. Two animals: six turns; four: twelve.
 */
export function askDebateSchedule(seats: number[]): AskDebatePlan[] {
    const order = Array.from(new Set(seats)).sort((a, b) => a - b);
    if (order.length < 2) return order.map((seat) => ({seat, phase: "open" as const, replyTo: null}));
    const opens = order.map((seat) => ({seat, phase: "open" as const, replyTo: null}));
    const reacts = order.map((seat, index) => ({
        seat,
        phase: "react" as const,
        replyTo: index === 0 ? order[order.length - 1] : order[index - 1]
    }));
    const closes = order.map((seat) => ({seat, phase: "close" as const, replyTo: null}));
    return [...opens, ...reacts, ...closes];
}

/**
 * The next turn: the first in the schedule not yet said, skipping animals
 * whose model failed. A reaction to a silent animal answers the last one who
 * did speak; with one animal left there is no one to answer, so it ends.
 */
export function nextAskDebateTurn(params: {
    schedule: AskDebatePlan[];
    said: Array<Pick<AskDebateTurn, "seat" | "phase">>;
    out?: ReadonlySet<number>;
}): AskDebatePlan | null {
    const out = params.out ?? new Set<number>();
    const done = new Set(params.said.map((turn) => `${turn.phase}:${turn.seat}`));
    const standing = new Set(params.schedule.map((plan) => plan.seat).filter((seat) => !out.has(seat)));
    if (standing.size < 2) return null;
    for (const plan of params.schedule) {
        if (done.has(`${plan.phase}:${plan.seat}`) || out.has(plan.seat)) continue;
        if (plan.replyTo !== null && out.has(plan.replyTo)) {
            const last = [...params.said].reverse().find((turn) => turn.seat !== plan.seat && !out.has(turn.seat));
            return {...plan, replyTo: last?.seat ?? null};
        }
        return plan;
    }
    return null;
}

export type AskDebateSpeaker<M extends AskConversationMember> = AskConversationSpeaker<M> & {seat: number};

/**
 * One SSE response for the debate's remaining turns, each kept as it is
 * finished. The debate runs to its end even when the page goes away (the
 * reader closed the chat): a public debate must reach its report and its
 * vote, and a private one is there when they come back. Only the frames stop.
 */
export function streamAskDebate<M extends AskConversationMember>(params: {
    speakers: Array<AskDebateSpeaker<M>>;
    /** Turns already kept (a debate picked up again): never said twice. */
    said: AskDebateTurn[];
    sourceFor: (plan: AskDebatePlan, turns: AskDebateTurn[], signal: AbortSignal) => AnswerDeltaSource;
    /** A finished turn, to keep, with its index in the schedule. */
    onTurn: (turn: AskDebateTurn, index: number) => Promise<void>;
    /** Every turn is in: write the report; its answer joins the last frame. */
    finish: (turns: AskDebateTurn[]) => Promise<Record<string, unknown>>;
    headers: Record<string, string>;
    /** The request's own signal: only the frames stop with it. */
    signal?: AbortSignal;
    /** How long one turn may take before it counts as failed. */
    turnTimeoutMs?: number;
}): Response {
    const encoder = new TextEncoder();
    let gone = false;
    params.signal?.addEventListener("abort", () => {
        gone = true;
    });
    const bySeat = new Map(params.speakers.map((speaker) => [speaker.seat, speaker]));
    const schedule = askDebateSchedule(params.speakers.map((speaker) => speaker.seat));
    const turnTimeoutMs = params.turnTimeoutMs ?? 60_000;

    const body = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: Record<string, unknown>) => {
                if (gone) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch {
                    gone = true;
                }
            };
            send({
                flow: "debate",
                speakers: params.speakers.map((speaker) => ({
                    capture_id: speaker.member.captureId,
                    seat: speaker.seat,
                    animal_name: speaker.member.animalName,
                    nickname: speaker.member.nickname,
                    power_name: speaker.member.powerName,
                    persona: speaker.persona
                }))
            });

            const turns: AskDebateTurn[] = [...params.said];
            const out = new Set<number>();
            for (;;) {
                const plan = nextAskDebateTurn({schedule, said: turns, out});
                if (!plan) break;
                const speaker = bySeat.get(plan.seat);
                if (!speaker) {
                    out.add(plan.seat);
                    continue;
                }
                const participant = speaker.member.captureId;
                const index = askDebateTurnIndex(schedule, plan);
                send({
                    turn: {
                        index,
                        participant,
                        seat: plan.seat,
                        phase: plan.phase,
                        reply_to: plan.replyTo === null ? null : bySeat.get(plan.replyTo)?.member.captureId ?? null,
                        persona: speaker.persona
                    }
                });

                let raw = "";
                let emitted = 0;
                const timeout = AbortSignal.timeout(turnTimeoutMs);
                try {
                    await params.sourceFor(plan, turns, timeout)((delta) => {
                        if (!delta) return;
                        raw += delta;
                        const visible = askVisibleTurnText(raw, false).text;
                        if (visible.length > emitted) {
                            send({participant, turn_index: index, delta: visible.slice(emitted)});
                            emitted = visible.length;
                        }
                    });
                } catch (error) {
                    console.warn("[debates] turn failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
                }

                const text = splitStreamedReply(askVisibleTurnText(raw, true).text).answer.trim();
                if (text.length > emitted) send({participant, turn_index: index, delta: text.slice(emitted)});
                if (!text) {
                    out.add(plan.seat);
                    send({participant, turn_index: index, error: "speaker_failed"});
                    continue;
                }
                const turn: AskDebateTurn = {seat: plan.seat, phase: plan.phase, text};
                turns.push(turn);
                await params.onTurn(turn, index).catch((error) => {
                    console.warn("[debates] keeping a turn failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
                });
                send({participant, turn_index: index, participant_done: true});
            }

            // The report is written once every animal has had its say (or could not).
            const finished = await params.finish(turns).catch(() => ({} as Record<string, unknown>));
            send({done: true, turns: turns.length, ...finished});
            try {
                controller.close();
            } catch {
                // Already closed by the page.
            }
        },
        cancel() {
            gone = true;
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
