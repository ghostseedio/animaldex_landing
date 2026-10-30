import {NextResponse} from "next/server";

/**
 * A debate, streamed (docs/debates/SPEC.md, section 1.3): the animals of a
 * debate the reader asked for take their turns in the reader's chat, on the
 * group conversation engine's frames. Open (each animal's verdict and why,
 * from its own life), react (each answers the others once), close (one line
 * each); no converge, no decide, at most three turns per animal.
 *
 * The web's own run of the apps' `generate-applied-insight` `debate` flow, as
 * the group route is of `animal_group_query`, on the server's service steps
 * (AnimalDex migration 20261031150000_debates, docs/debates/SERVER.md):
 *   - `debate_run_context(debate, asker)`: only the asker runs it, and only
 *     while the server holds it `debating`. Turns already kept are not said
 *     again, so a debate picked up after a reload carries on where it stopped.
 *   - Each animal speaks from its species, nature and Power (by species, from
 *     the run context); invited animals come as species and Power only,
 *     never under their owner's name for them, and no other owner's memory is
 *     loaded. The context's problem is the approved, anonymised text for a
 *     public debate (its openings are shown on Discover) and the asker's own
 *     words for a private one.
 *   - Each finished turn: `debate_record_turn` (idempotent; the last one moves
 *     the debate on to `reporting`, even if the person has left). Then the
 *     report: `write-debate-report` (job "report", with the service key, as
 *     the apps' route asks for it; `debate_request_job` if that cannot be
 *     reached, and `settle_due_debates` asks again if it never came), waited
 *     for briefly, and sent with the debate as the reader then sees it.
 *   - Memory: none in a public debate (its turns are shown to the
 *     community); in a private one, the asker's own, for their own animals'
 *     turns only.
 *   - A debate's turns never take from the chat allowance: the debate limit
 *     replaces it.
 *   - Not here yet: the model safety re-check of a public debate's approved
 *     text before its first turn (`debate_mark_public_checked` /
 *     `debate_refuse_public`), which ports with the server's debate rules.
 *
 * What each turn is told is `debate-rules.ts`, which the server's rules
 * replace word for word.
 */

import {loadAskDebateMembers, type AskGroupMember} from "@/data/ask-group-members";
import {loadAskStatQuantiles} from "@/data/ask-stat-quantiles";
import {readDebate} from "@/data/debates";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {loadAskChatSettings, loadAskMemory} from "@/lib/ask-animaldex/memory";
import type {AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";
import {ASK_RESPONSE_HEADERS, askLanguageName, resolveAskViewer} from "@/lib/ask-animaldex/request";
import {buildAskStreamingSystemPrompt} from "@/lib/ask-animaldex/prompt";
import {askAnswerSource, availableAskProviders, type AnswerDeltaSource, type AskProviderName} from "@/lib/ask-animaldex/providers";
import {askPersonaDials, askPersonaFrame, capAskEffort} from "@/lib/ask-animaldex/persona";
import {askGroupNatureLines, askRightNowLine} from "@/lib/ask-animaldex/nature";
import {askParticipantLabel, trimAskGroundingForGroup} from "@/lib/ask-animaldex/group-rules";
import {askShortNames, buildAskGroupTurnUserPrompt} from "@/lib/ask-animaldex/group-conversation";
import {streamAskDebate, type AskDebateTurn} from "@/lib/ask-animaldex/debate-flow";
import {askDebateRulesLines, askDebateTurnInstruction, askDebateWordBudget} from "@/lib/ask-animaldex/debate-rules";
import {debateUuid, decodeDebateRunContext, orderedDebateTurns} from "@/lib/debates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to twelve turns and the report, written one after another.
export const maxDuration = 300;

function askJson(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

/** A turn from the first provider that says anything; one that fails before its first word gives way to the next. */
function turnSource(providers: AskProviderName[], params: Parameters<typeof askAnswerSource>[1]): AnswerDeltaSource {
    return async (emit) => {
        let lastError: unknown = new Error("no_provider");
        for (const provider of providers) {
            const source = askAnswerSource(provider, params);
            if (!source) continue;
            let emitted = false;
            try {
                await source((delta) => {
                    if (!delta) return;
                    emitted = true;
                    emit(delta);
                });
                return;
            } catch (error) {
                lastError = error;
                if (emitted || params.signal?.aborted) throw error;
            }
        }
        throw lastError;
    };
}

type Service = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

/** One finished turn (`debate_record_turn`: false when it was already saved, or the debate moved on). */
async function keepTurn(service: Service, debateId: string, turn: AskDebateTurn & {turnIndex: number}): Promise<boolean> {
    const {data, error} = await service.rpc("debate_record_turn", {
        p_debate_id: debateId,
        p_turn_index: turn.turnIndex,
        p_seat: turn.seat,
        p_phase: turn.phase,
        p_text: turn.text
    });
    if (error) throw new Error(error.message);
    return data === true;
}

const REPORT_WAIT_TRIES = 10;
const REPORT_WAIT_MS = 3000;

/**
 * Asks `write-debate-report` for the report (it claims the job, so a retry
 * never writes it twice), with `debate_request_job` as the fallback.
 */
async function askForReport(service: Service, debateId: string): Promise<void> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (url && key) {
        try {
            const response = await fetch(`${url}/functions/v1/write-debate-report`, {
                method: "POST",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key},
                body: JSON.stringify({debate_id: debateId, job: "report"}),
                cache: "no-store",
                signal: AbortSignal.timeout(110_000)
            });
            await response.body?.cancel().catch(() => undefined);
            if (response.ok) return;
            console.warn("[debates] write-debate-report answered", response.status);
        } catch (error) {
            console.warn("[debates] write-debate-report unreachable", error instanceof Error ? error.message.slice(0, 200) : String(error));
        }
    }
    const job = await service.rpc("debate_request_job", {p_debate_id: debateId, p_job: "report"});
    if (job.error) console.warn("[debates] debate_request_job failed", job.error.message.slice(0, 200));
}

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return askJson({error: "invalid_request"}, 400);
    }
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.userId || !viewer.client) return askJson({error: "not_authenticated"}, 401);
    const userId = viewer.userId;
    const debateId = debateUuid(body.debateId);
    if (!debateId) return askJson({error: "not_found"}, 400);
    const service = createSupabaseServiceClient();
    if (!service) return askJson({error: "unavailable"}, 503);

    // What the run needs, for the asker only (`debate_run_context`).
    const context = await service.rpc("debate_run_context", {p_debate_id: debateId, p_user_id: userId});
    const run = context.error ? null : decodeDebateRunContext(context.data);
    if (!run) return askJson({error: "not_found"}, 404);
    if (!run.enabled) return askJson({error: "debates_off"}, 403);
    // Only a debate still being argued runs; any other is shown as it stands.
    if (run.status !== "debating") {
        const current = await readDebate(viewer.client as Parameters<typeof readDebate>[0], debateId).catch(() => ({debate: null}));
        return askJson({error: "debate_not_running", debate: current.debate}, 409);
    }
    const problem = run.problem ?? "";
    if (!problem) return askJson({error: "not_found"}, 409);

    const quantiles = await loadAskStatQuantiles();
    const [members, settings] = await Promise.all([
        loadAskDebateMembers({
            participants: run.participants.flatMap((participant) => participant.speciesProfileId
                ? [{key: participant.id, speciesProfileId: participant.speciesProfileId, nickname: participant.isAskerOwned ? participant.nickname : null}]
                : []),
            quantiles
        }),
        loadAskChatSettings(userId)
    ]);
    const memberOf = new Map(members.map((member) => [member.captureId, member]));
    const seated = run.participants.flatMap((participant) => {
        const member = memberOf.get(participant.id);
        return member ? [{seat: participant.seat, participant, member}] : [];
    });
    if (seated.length < 2) return askJson({error: "animal_power_unavailable"}, 422);

    const providers = availableAskProviders({animalVoice: true});
    if (providers.length === 0) {
        console.error("[debates] no model provider configured");
        return askJson({error: "unavailable"}, 503);
    }

    // The asker's own memory, in a private debate only: a public one's turns are shown to the community.
    const memory: AskMemoryFact[] = run.visibility === "private" && settings.personalisationEnabled
        ? await loadAskMemory(userId).catch(() => [])
        : [];
    const languageName = askLanguageName(body.locale);
    const utcOffset = Number.isFinite(Number(body.utcOffsetMinutes)) && body.utcOffsetMinutes !== null
        ? Math.max(-14 * 60, Math.min(14 * 60, Math.round(Number(body.utcOffsetMinutes))))
        : null;

    const names = askShortNames(seated.map((entry) => entry.member));
    const room = seated.map((entry, index) => ({
        seat: entry.seat,
        label: askParticipantLabel(entry.member),
        shortName: names[index],
        powerName: entry.member.powerName
    }));
    const prepared = seated.map((entry, index) => {
        const me: AskGroupMember = entry.member;
        const persona = askPersonaDials({stats: me.stats, dynamics: me.species.systemDynamics?.frequency ?? null, voice: me.voice, quantiles});
        // Who in the room would eat whom: wariness or amusement, never threats.
        const preyLines = askGroupNatureLines(
            {nature: me.nature},
            seated.flatMap((other, otherIndex) => (otherIndex !== index ? [{shortName: names[otherIndex], nature: other.member.nature}] : []))
        );
        const systemPrompt = buildAskStreamingSystemPrompt({
            scope: "species",
            mode: "chat",
            supportedVisuals: [],
            languageName,
            voice: me.voice,
            animalName: me.animalName,
            persona,
            nature: me.nature,
            species: trimAskGroundingForGroup(me.species),
            stats: me.stats,
            groupLines: [...askDebateRulesLines({me: room[index], others: room.filter((_, other) => other !== index)}), ...preyLines]
        });
        return {seat: entry.seat, member: me, persona, systemPrompt, ownAnimal: entry.participant.isAskerOwned};
    });
    const bySeat = new Map(prepared.map((entry, index) => [entry.seat, {...entry, room: room[index]}]));
    const existing = orderedDebateTurns(run.turns)
        .filter((turn) => bySeat.has(turn.seat))
        .map((turn, order) => ({seat: turn.seat, phase: turn.phase, text: turn.text, turnIndex: turn.index ?? order}));
    const readNow = () => readDebate(viewer.client as Parameters<typeof readDebate>[0], debateId).catch(() => ({debate: null, error: null}));

    return streamAskDebate<AskGroupMember>({
        debateId,
        speakers: prepared.map((entry) => ({
            seat: entry.seat,
            member: entry.member,
            persona: askPersonaFrame(entry.member.voice, entry.persona)
        })),
        existing,
        sourceFor: (plan, turns, signal) => {
            const entry = bySeat.get(plan.seat)!;
            const userPrompt = buildAskGroupTurnUserPrompt({
                userMessage: problem,
                memory: entry.ownAnimal ? memory : [],
                speciesProfileId: entry.member.speciesProfileId,
                rightNow: askRightNowLine({nature: entry.member.nature, utcOffsetMinutes: utcOffset}),
                earlier: [],
                roundSoFar: turns.map((turn) => ({
                    speaker: turn.seat === plan.seat ? `${entry.room.label} (you)` : bySeat.get(turn.seat)?.room.label ?? "an animal",
                    content: turn.text
                })),
                turnInstruction: askDebateTurnInstruction({
                    plan,
                    words: askDebateWordBudget(plan.phase, entry.persona.wordBudget),
                    replyToName: plan.replyTo === null ? null : bySeat.get(plan.replyTo)?.room.shortName ?? null
                })
            });
            // Openings get the animal's own depth; answers and closing lines come quickly.
            return turnSource(providers, {
                systemPrompt: entry.systemPrompt,
                userPrompt,
                effort: capAskEffort(entry.persona.effort, plan.phase === "open" ? entry.persona.effort : "low"),
                signal
            });
        },
        record: (turn) => keepTurn(service, debateId, turn),
        finish: async () => {
            await askForReport(service, debateId);
            // Another writer may still be on it: wait for it briefly.
            for (let attempt = 0; attempt < REPORT_WAIT_TRIES; attempt += 1) {
                const {debate} = await readNow();
                if (debate?.report || (debate && debate.status !== "reporting" && debate.status !== "debating") || attempt === REPORT_WAIT_TRIES - 1) {
                    return {report: debate?.report ?? null, debate: debate as unknown as Record<string, unknown> | null};
                }
                await new Promise((resolve) => setTimeout(resolve, REPORT_WAIT_MS));
            }
            return {report: null, debate: null};
        },
        incomplete: async () => (await readNow()).debate as unknown as Record<string, unknown> | null,
        headers: ASK_RESPONSE_HEADERS,
        signal: request.signal
    });
}
