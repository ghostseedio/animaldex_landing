/**
 * A debate's turns (docs/debates/SPEC.md, section 1.3), on the group
 * conversation engine's frames: every animal opens with its own way (the host
 * first), then each answers the others once (the host first), then each
 * closes in a line (the host last, since the thread is its chat). No converge
 * and no decide: no animal decides for the person. Three turns per animal.
 *
 * Port of the plan and the stream of the apps' `_shared/animal-debate.ts`
 * (AnimalDex r32d-server 0021b8b2, e97df917): the same sequence, the same
 * resume from saved turns, one more try for a turn that came back empty, and
 * two counters, the stream's frame index (a failed try uses one) and the
 * saved `turn_index` (only a turn that was said takes one). What each turn is
 * told is `debate-rules.ts`.
 *
 * Frames, as the apps': {flow:"debate", debate_id, speakers} · {turn:{index,
 * participant, seat, phase, reply_to, persona}} · {participant, turn_index,
 * delta} · {participant, turn_index, participant_done} · {participant,
 * turn_index, error} · {report_pending} · {report} | {report_error} ·
 * {done, debate, turns}. Turns already said are not replayed: the page shows
 * them from `debate_v1`.
 */

import {splitStreamedReply} from "@/lib/ask-animaldex/prompt";
import {askVisibleTurnText, type AskConversationMember, type AskConversationSpeaker} from "@/lib/ask-animaldex/group-conversation";
import type {AnswerDeltaSource} from "@/lib/ask-animaldex/providers";

export type AskDebatePhase = "open" | "react" | "close";

export type AskDebatePlan = {
    /** Which seat speaks. */
    seat: number;
    phase: AskDebatePhase;
    /** The seat this turn answers (react only); null for the person. */
    replyTo: number | null;
};

export type AskDebateTurn = {seat: number; phase: AskDebatePhase; text: string};

/** Every turn of a debate among these seats, in order. Fewer than two animals is no debate. */
export function askDebateSchedule(seats: number[]): Array<{seat: number; phase: AskDebatePhase}> {
    const order = Array.from(new Set(seats)).sort((a, b) => a - b);
    if (order.length < 2) return [];
    const [host, ...others] = order;
    return [
        ...order.map((seat) => ({seat, phase: "open" as const})),
        ...order.map((seat) => ({seat, phase: "react" as const})),
        ...[...others, host].map((seat) => ({seat, phase: "close" as const}))
    ];
}

/**
 * The next turn, given the turns already said (saved, so a debate the person
 * left resumes where it stopped). `out` holds seats whose model failed in this
 * run; their turns are skipped and the debate stays incomplete. An answer
 * goes to whoever spoke last, unless that was this animal.
 */
export function nextAskDebateTurn(params: {
    seats: number[];
    said: ReadonlyArray<Pick<AskDebateTurn, "seat" | "phase">>;
    out?: ReadonlySet<number>;
}): AskDebatePlan | null {
    const done = new Set(params.said.map((turn) => `${turn.seat}:${turn.phase}`));
    const out = params.out ?? new Set<number>();
    const next = askDebateSchedule(params.seats).find((step) => !done.has(`${step.seat}:${step.phase}`) && !out.has(step.seat));
    if (!next) return null;
    if (next.phase !== "react") return {...next, replyTo: null};
    for (let index = params.said.length - 1; index >= 0; index -= 1) {
        if (params.said[index].seat !== next.seat) return {...next, replyTo: params.said[index].seat};
    }
    return {...next, replyTo: null};
}

/** Every turn of the schedule has been said. */
export function askDebateComplete(seats: number[], said: ReadonlyArray<Pick<AskDebateTurn, "seat" | "phase">>): boolean {
    const done = new Set(said.map((turn) => `${turn.seat}:${turn.phase}`));
    const schedule = askDebateSchedule(seats);
    return schedule.length > 0 && schedule.every((step) => done.has(`${step.seat}:${step.phase}`));
}

export type AskDebateSpeaker<M extends AskConversationMember> = AskConversationSpeaker<M> & {seat: number};

export type AskDebateFinish = {report: Record<string, unknown> | null; debate: Record<string, unknown> | null};

/**
 * One SSE response for the rest of a debate: each turn saved before the next
 * starts. Once every turn is in, the report is asked for and sent, then
 * `done`. When the page goes away the turns stop (the debate resumes when the
 * asker comes back); a debate whose last turn is in still goes on to its
 * report.
 */
export function streamAskDebate<M extends AskConversationMember>(params: {
    debateId: string;
    speakers: Array<AskDebateSpeaker<M>>;
    /** Turns already saved: never said twice. */
    existing: Array<AskDebateTurn & {turnIndex: number}>;
    sourceFor: (plan: AskDebatePlan, turns: AskDebateTurn[], signal: AbortSignal) => AnswerDeltaSource;
    /** A finished turn, to save under its `turn_index`. */
    record: (turn: AskDebateTurn & {turnIndex: number}) => Promise<boolean>;
    /** Every turn is in: the report, and where the debate then stands. */
    finish: () => Promise<AskDebateFinish>;
    /** Where the debate stands when this run could not finish it. */
    incomplete: () => Promise<Record<string, unknown> | null>;
    headers: Record<string, string>;
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
    const seats = params.speakers.map((speaker) => speaker.seat);
    const bySeat = new Map(params.speakers.map((speaker) => [speaker.seat, speaker]));

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
                flow: "debate",
                debate_id: params.debateId,
                speakers: params.speakers.map((speaker) => ({
                    participant_id: speaker.member.captureId,
                    seat: speaker.seat,
                    animal_name: speaker.member.animalName,
                    nickname: speaker.member.nickname,
                    power_name: speaker.member.powerName,
                    persona: speaker.persona
                }))
            });

            const turns: AskDebateTurn[] = [];
            let frameIndex = 0;
            let savedIndex = 0;
            for (const turn of [...params.existing].sort((a, b) => a.turnIndex - b.turnIndex)) {
                if (!bySeat.has(turn.seat)) continue;
                turns.push({seat: turn.seat, phase: turn.phase, text: turn.text});
                frameIndex = Math.max(frameIndex, turn.turnIndex + 1);
                savedIndex = Math.max(savedIndex, turn.turnIndex + 1);
            }

            const out = new Set<number>();
            const attempts = new Map<string, number>();
            while (!cancelled) {
                const plan = nextAskDebateTurn({seats, said: turns, out});
                if (!plan) break;
                const speaker = bySeat.get(plan.seat)!;
                const participant = speaker.member.captureId;
                const index = frameIndex;
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
                    if (!cancelled) console.warn("[debates] turn failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
                }
                if (cancelled) break;

                const text = splitStreamedReply(askVisibleTurnText(raw, true).text).answer.trim();
                if (text.length > emitted) send({participant, turn_index: index, delta: text.slice(emitted)});
                const key = `${plan.seat}:${plan.phase}`;
                if (!text) {
                    send({participant, turn_index: index, error: "speaker_failed"});
                    const tried = (attempts.get(key) ?? 0) + 1;
                    attempts.set(key, tried);
                    // One more try for a turn, then this animal sits the rest of this run out.
                    if (tried >= 2) out.add(plan.seat);
                    frameIndex += 1;
                    continue;
                }
                const turn: AskDebateTurn = {seat: plan.seat, phase: plan.phase, text};
                await params.record({...turn, turnIndex: savedIndex}).catch((error) => {
                    console.warn("[debates] turn not saved", error instanceof Error ? error.message.slice(0, 200) : String(error));
                    return false;
                });
                turns.push(turn);
                savedIndex += 1;
                frameIndex += 1;
                send({participant, turn_index: index, participant_done: true});
            }

            const complete = askDebateComplete(seats, turns);
            if (cancelled) {
                // The page left after the last word: the report is still asked for.
                if (complete) await params.finish().catch(() => null);
                try {
                    controller.close();
                } catch {
                    // Already closed by the page.
                }
                return;
            }
            if (complete) {
                send({report_pending: true});
                const finished = await params.finish().catch((error) => {
                    console.warn("[debates] report failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
                    return null;
                });
                if (finished?.report) send({report: finished.report});
                else send({report_error: "report_unavailable"});
                send({done: true, debate: finished?.debate ?? {id: params.debateId}, turns: turns.length});
            } else {
                const debate = await params.incomplete().catch(() => null);
                send({done: true, debate: {...(debate ?? {id: params.debateId}), incomplete: true}, turns: turns.length});
            }
            try {
                controller.close();
            } catch {
                // Already closed by the page.
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
