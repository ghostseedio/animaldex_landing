import {NextResponse} from "next/server";

/**
 * A debate, streamed (docs/debates/SPEC.md, section 1.3): the animals of a
 * debate the reader asked for take their turns in the reader's chat, on the
 * group conversation engine's frames. Open (each animal's verdict and why,
 * from its own life), react (each answers the others once), close (one line
 * each); no converge, no decide, at most three turns per animal.
 *
 * The web's own run of the apps' `generate-applied-insight` `debate` flow, as
 * the group route is of `animal_group_query`:
 *   - Only the asker runs it, and only while the server holds it `debating`
 *     (`debate_v1`). Turns already kept are not said again, so a debate picked
 *     up after a reload carries on where it stopped.
 *   - Each animal speaks from its species, nature and Power; invited animals
 *     never under their owner's name for them, and no other owner's memory
 *     is loaded. A public debate is argued from the approved, anonymised text,
 *     because its openings are shown on Discover; a private one from the
 *     asker's own words.
 *   - Each finished turn is kept in `debate_turns` (service role). When the
 *     last is in, `write-debate-report` writes the report (and moves the
 *     debate on: `private_done`, or `voting` with its Discover post), and the
 *     last frame carries the debate as it then stands.
 *   - A debate's turns never take from the chat allowance: the debate limit
 *     replaces it.
 *
 * What each turn is told is `debate-rules.ts`, which the server's rules
 * replace word for word.
 */

import {loadAskGroupMembers, type AskGroupMember} from "@/data/ask-group-members";
import {loadAskStatQuantiles} from "@/data/ask-stat-quantiles";
import {loadDebatesEnabled, readDebate} from "@/data/debates";
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
import {debateUuid, orderedDebateTurns, type Debate} from "@/lib/debates";

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

/** One kept turn (`debate_turns`, service role: clients read it through `debate_v1` only). */
async function keepTurn(debateId: string, turn: AskDebateTurn): Promise<void> {
    const service = createSupabaseServiceClient();
    if (!service) return;
    const {error} = await service.from("debate_turns").insert({debate_id: debateId, seat: turn.seat, phase: turn.phase, text: turn.text});
    if (error) throw new Error(error.message);
}

/**
 * The report, once (`write-debate-report`, the repurposed Round 3 editorial
 * function), called with the service key as the push senders are. It stores
 * `debates.report` and moves the debate on.
 */
async function writeReport(debateId: string): Promise<boolean> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return false;
    try {
        const response = await fetch(`${url}/functions/v1/write-debate-report`, {
            method: "POST",
            headers: {"Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key},
            body: JSON.stringify({debate_id: debateId}),
            cache: "no-store",
            signal: AbortSignal.timeout(120_000)
        });
        if (!response.ok) console.warn("[debates] write-debate-report answered", response.status);
        return response.ok;
    } catch (error) {
        console.warn("[debates] write-debate-report failed", error instanceof Error ? error.message.slice(0, 200) : String(error));
        return false;
    }
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
    if (!(await loadDebatesEnabled())) return askJson({error: "debates_off"}, 403);

    const read = await readDebate(viewer.client as Parameters<typeof readDebate>[0], debateId);
    const debate: Debate | null = read.debate;
    if (!debate) return askJson({error: "not_found"}, 404);
    if (!debate.askerIsMe) return askJson({error: "not_asker"}, 403);
    // Only a debate still being argued runs; any other is shown as it stands.
    if (debate.status !== "debating") return askJson({error: "debate_not_running", debate}, 409);

    const quantiles = await loadAskStatQuantiles();
    const captureIds = debate.participants.map((participant) => participant.captureId);
    const [loaded, settings] = await Promise.all([
        loadAskGroupMembers({userId, captureIds, quantiles, anyOwner: true}),
        loadAskChatSettings(userId)
    ]);
    if (!loaded.ok) return askJson({error: loaded.error}, 500);
    const memberOf = new Map(loaded.members.map((member) => [member.captureId, member]));
    const seated = debate.participants.flatMap((participant) => {
        const member = memberOf.get(participant.captureId);
        return member ? [{seat: participant.seat, participant, member}] : [];
    });
    if (seated.length < 2) return askJson({error: "animal_power_unavailable"}, 422);

    const providers = availableAskProviders({animalVoice: true});
    if (providers.length === 0) {
        console.error("[debates] no model provider configured");
        return askJson({error: "unavailable"}, 503);
    }

    // The asker's own memory only: it is about them. No other owner's is ever read.
    const memory: AskMemoryFact[] = settings.personalisationEnabled ? await loadAskMemory(userId).catch(() => []) : [];
    const problem = (debate.visibility === "public" ? debate.problemPublic : debate.problemPrivate ?? debate.problemPublic) ?? "";
    if (!problem) return askJson({error: "not_found"}, 409);
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
        return {seat: entry.seat, member: me, persona, systemPrompt};
    });
    const bySeat = new Map(prepared.map((entry, index) => [entry.seat, {...entry, room: room[index]}]));
    const said: AskDebateTurn[] = orderedDebateTurns(debate.turns)
        .filter((turn) => bySeat.has(turn.seat))
        .map((turn) => ({seat: turn.seat, phase: turn.phase, text: turn.text}));

    return streamAskDebate<AskGroupMember>({
        speakers: prepared.map((entry) => ({
            seat: entry.seat,
            member: entry.member,
            persona: askPersonaFrame(entry.member.voice, entry.persona)
        })),
        said,
        sourceFor: (plan, turns, signal) => {
            const entry = bySeat.get(plan.seat)!;
            const userPrompt = buildAskGroupTurnUserPrompt({
                userMessage: problem,
                memory,
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
        onTurn: (turn) => keepTurn(debateId, turn),
        finish: async () => {
            const reported = await writeReport(debateId);
            const after = await readDebate(viewer.client as Parameters<typeof readDebate>[0], debateId).catch(() => ({debate: null}));
            return {report_written: reported, debate: after.debate};
        },
        headers: ASK_RESPONSE_HEADERS,
        signal: request.signal
    });
}
