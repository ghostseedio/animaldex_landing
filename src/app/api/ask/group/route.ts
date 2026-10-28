import {NextResponse} from "next/server";

/**
 * "Talk to several animals", streamed: two to four of the reader's own
 * animals talk it over with each other, turn by turn, one of each species,
 * while the reader listens and can jump in.
 *
 * The web port of the apps' `generate-applied-insight` `animal_group_query`
 * with `flow: "conversation"` (AnimalDex 4870e24b, 4b8bbfc7, 243748bc): the
 * same members, speaker choice, prompts and SSE frames
 * (`group-conversation.ts`), Claude first as in the one-to-one route. Signed
 * in only: a group is made of the reader's own cards.
 *
 * Each animal that speaks takes one message from today's budget (or one
 * credit past it), filed under the message's id and the card, so a retry is
 * never charged twice; an animal that never got a word in is handed back.
 * What the round taught about the reader is learned afterwards, and each
 * animal that spoke counts the day for its bond and its popularity.
 */

import {loadAskGroupMembers, type AskGroupMember} from "@/data/ask-group-members";
import {loadAskStatQuantiles} from "@/data/ask-stat-quantiles";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {loadAskChatSettings, loadAskMemory, rememberAskTurn} from "@/lib/ask-animaldex/memory";
import type {AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";
import {ASK_CRISIS_PATTERN, dedupeCurrentQuestion} from "@/lib/ask-animaldex/companion";
import {
    ASK_RESPONSE_HEADERS,
    askLanguageName,
    refundAskTurn,
    resolveAskQuestion,
    resolveAskRequestId,
    resolveAskViewer,
    takeAskTurn,
    type AskAllowance
} from "@/lib/ask-animaldex/request";
import {buildAskStreamingSystemPrompt} from "@/lib/ask-animaldex/prompt";
import {
    askAnswerSource,
    askChatMaxEffort,
    availableAskProviders,
    requestAskJSONObject,
    type AnswerDeltaSource,
    type AskProviderName
} from "@/lib/ask-animaldex/providers";
import {askPersonaDials, askPersonaFrame, capAskEffort} from "@/lib/ask-animaldex/persona";
import {askGroupNatureLines, askRightNowLine} from "@/lib/ask-animaldex/nature";
import {
    ASK_GROUP_CONVERSATION_FOLLOW_UPS,
    ASK_GROUP_MAX_ANIMALS,
    ASK_GROUP_MIN_ANIMALS,
    askDefaultAngle,
    askDeterministicSpeakers,
    askGroupMaxSpeakers,
    askGroupRulesLines,
    askOnePerSpecies,
    askParticipantLabel,
    buildAskGroupRouterPrompts,
    parseAskGroupRouter,
    trimAskGroundingForGroup
} from "@/lib/ask-animaldex/group-rules";
import {
    askConversationLength,
    askConversationRulesLines,
    askConversationTurnInstruction,
    askMentionedSpeakers,
    askPhaseWordBudget,
    askShortNames,
    buildAskGroupTurnUserPrompt,
    streamAskGroupConversation
} from "@/lib/ask-animaldex/group-conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function askJson(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

function uuid(value: unknown): string | null {
    return typeof value === "string" && UUID_PATTERN.test(value.trim()) ? value.trim().toLowerCase() : null;
}

type GroupHistoryTurn = {role: "user" | "assistant"; content: string; speaker: string | null};

/** The conversation as the page sends it: who said what, newest ten. */
function resolveGroupHistory(raw: unknown): GroupHistoryTurn[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .flatMap((item): GroupHistoryTurn[] => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
            const content = typeof row.content === "string" ? row.content.replace(/\s+/g, " ").trim().slice(0, 900) : "";
            if (!role || !content) return [];
            return [{role, content, speaker: role === "assistant" ? uuid(row.speakerCaptureId) : null}];
        })
        .slice(-10);
}

/** `animal_chat_config.group_max_speakers`; 3 when it cannot be read. */
async function loadGroupMaxSpeakers(): Promise<number> {
    const service = createSupabaseServiceClient();
    if (!service) return 3;
    try {
        const {data} = await service.from("animal_chat_config").select("group_max_speakers").eq("singleton", true).maybeSingle();
        return askGroupMaxSpeakers(data?.group_max_speakers);
    } catch {
        return 3;
    }
}

/**
 * One row per day the reader had a real exchange with this animal (its bond),
 * and one per day they talked with it at all (how popular it is to talk to,
 * `species_chat_popularity`). The primary keys make retries count once.
 */
async function countTheDay(userId: string, speciesProfileId: string, message: string): Promise<void> {
    const service = createSupabaseServiceClient();
    if (!service) return;
    const day = new Date().toISOString().slice(0, 10);
    const writes: Array<PromiseLike<unknown>> = [
        service.from("animal_chat_species_days")
            .upsert({species_profile_id: speciesProfileId, user_id: userId, day}, {onConflict: "species_profile_id,user_id,day", ignoreDuplicates: true})
            .then(({error}) => {
                if (error && error.code !== "42P01") console.warn("[ask-animaldex] talk day failed", error.message.slice(0, 200));
            })
    ];
    if (message.trim().length >= 20) {
        writes.push(service.from("animal_companion_days")
            .upsert({user_id: userId, species_profile_id: speciesProfileId, day}, {onConflict: "user_id,species_profile_id,day", ignoreDuplicates: true})
            .then(({error}) => {
                if (error) console.warn("[ask-animaldex] companion day failed", error.message.slice(0, 200));
            }));
    }
    await Promise.allSettled(writes);
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

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return askJson({error: "invalid_request"}, 400);
    }

    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.userId) return askJson({error: "sign_in_required"}, 401);
    const userId = viewer.userId;

    const captureIds = Array.from(new Set(
        (Array.isArray(body.captureIds) ? body.captureIds : []).map(uuid).filter((id): id is string => id !== null)
    ));
    if (captureIds.length < ASK_GROUP_MIN_ANIMALS || captureIds.length > ASK_GROUP_MAX_ANIMALS) {
        return askJson({error: "invalid_group"}, 400);
    }
    const question = resolveAskQuestion(body.question);
    if (!question) return askJson({error: "invalid_question"}, 400);

    const quantiles = await loadAskStatQuantiles();
    const [loaded, settings, maxSpeakers] = await Promise.all([
        loadAskGroupMembers({userId, captureIds, quantiles}),
        loadAskChatSettings(userId),
        loadGroupMaxSpeakers()
    ]);
    if (!loaded.ok) return askJson({error: loaded.error}, loaded.error === "capture_not_owned" ? 403 : 500);
    // Two of one species would be twins with one voice and one name: each species speaks once.
    const members = askOnePerSpecies(loaded.members);
    if (members.length === 0) return askJson({error: "animal_power_unavailable"}, 422);

    const personalise = settings.personalisationEnabled;
    const memoryLoad: Promise<AskMemoryFact[]> = personalise ? loadAskMemory(userId).catch(() => []) : Promise.resolve([]);
    const history = dedupeCurrentQuestion(resolveGroupHistory(body.history), question);
    const isFirstQuestion = !history.some((turn) => turn.role === "assistant");
    const labelFor = (captureId: string | null) => {
        const member = members.find((candidate) => candidate.captureId === captureId);
        return member ? askParticipantLabel(member) : "an animal";
    };

    // Who speaks: a rule when one decides it, otherwise one small routing call.
    const addressedId = uuid(body.addressedCaptureId);
    let chosen: Array<{member: AskGroupMember; angle: string | null}> | null = null;
    const ruled = askDeterministicSpeakers({participants: members, addressedCaptureId: addressedId, isFirstQuestion, message: question, maxSpeakers});
    if (ruled) {
        chosen = ruled.map((member) => ({member, angle: askDefaultAngle(member)}));
    } else if (members.length <= maxSpeakers) {
        // Everyone takes part in a conversation anyway: no routing call to wait on.
        chosen = members.map((member) => ({member, angle: askDefaultAngle(member)}));
    } else {
        const prompts = buildAskGroupRouterPrompts({
            participants: members,
            message: question,
            recent: history.map((turn) => ({speaker: turn.role === "user" ? "the person" : labelFor(turn.speaker), content: turn.content})),
            maxSpeakers
        });
        const routed = parseAskGroupRouter(
            await requestAskJSONObject({systemPrompt: prompts.system, userPrompt: prompts.user, signal: request.signal}).catch(() => null),
            members,
            maxSpeakers
        );
        if (routed.length > 0) chosen = routed.map((entry) => ({member: entry.participant, angle: entry.angle ?? askDefaultAngle(entry.participant)}));
    }
    if (!chosen) chosen = members.slice(0, maxSpeakers).map((member) => ({member, angle: askDefaultAngle(member)}));

    const dominanceOf = (member: AskGroupMember) => member.stats?.dominance ?? 30;
    // One animal answers alone when it was addressed, in a crisis, or when it
    // is the only one here; otherwise a conversation needs at least two voices.
    const single = members.length === 1 || ASK_CRISIS_PATTERN.test(question)
        || Boolean(addressedId && members.some((member) => member.captureId === addressedId));
    if (!single) {
        // The animal the message names opens; the rest of the room joins in,
        // most dominant first, up to the speaker cap.
        const opener = ruled?.length === 1 ? chosen[0].member : null;
        const byDominance = [...members].sort((a, b) => dominanceOf(b) - dominanceOf(a));
        const picked = new Set(chosen.map((entry) => entry.member));
        for (const member of byDominance) {
            if (picked.size >= Math.max(2, Math.min(maxSpeakers, members.length))) break;
            picked.add(member);
        }
        const current = chosen;
        const angleOf = (member: AskGroupMember) => current.find((entry) => entry.member === member)?.angle ?? askDefaultAngle(member);
        const ordered = byDominance.filter((member) => picked.has(member) && member !== opener);
        chosen = (opener ? [opener, ...ordered] : ordered).map((member) => ({member, angle: angleOf(member)}));
    } else {
        chosen = [...chosen].sort((a, b) => dominanceOf(b.member) - dominanceOf(a.member));
    }

    // One message (or one credit) per animal that speaks.
    const baseRequestId = resolveAskRequestId(body.requestId) ?? globalThis.crypto.randomUUID();
    const payWithCredits = body.payWithCredits === true;
    const speakers: Array<{member: AskGroupMember; angle: string | null; allowance: AskAllowance}> = [];
    const skipped: string[] = [];
    let lastDenied: AskAllowance | null = null;
    for (const entry of chosen) {
        const allowance = await takeAskTurn(request, viewer, {requestId: `${baseRequestId}:${entry.member.captureId}`, payWithCredits});
        if (allowance.allowed) {
            speakers.push({...entry, allowance});
        } else {
            skipped.push(entry.member.captureId);
            lastDenied = allowance;
        }
    }
    if (speakers.length === 0 && lastDenied) {
        return askJson({
            error: "limit_reached",
            reason: lastDenied.reason ?? "daily_limit_reached",
            remaining: 0,
            limit: lastDenied.limit,
            retryAfterSeconds: lastDenied.retryAfterSeconds,
            resetsAt: lastDenied.resetsAt,
            signedIn: true,
            isPro: lastDenied.isPro,
            ...(lastDenied.creditOverflow ? {creditOverflow: lastDenied.creditOverflow} : {})
        }, 429);
    }

    const providers = availableAskProviders({animalVoice: true});
    if (providers.length === 0) {
        console.error("[ask-animaldex] no model provider configured");
        await Promise.allSettled(speakers.map((speaker) => refundAskTurn(viewer, speaker.allowance)));
        return askJson({error: "unavailable"}, 503);
    }

    const memory = await memoryLoad;
    const languageName = askLanguageName(body.locale);
    const utcOffset = Number.isFinite(Number(body.utcOffsetMinutes)) && body.utcOffsetMinutes !== null
        ? Math.max(-14 * 60, Math.min(14 * 60, Math.round(Number(body.utcOffsetMinutes))))
        : null;
    const last = speakers[speakers.length - 1].allowance;
    const paidKinds = new Set(speakers.map((speaker) => speaker.allowance.paidWith));
    const closing: Record<string, unknown> = {
        remaining: last.remaining,
        limit: last.limit,
        signed_in: true,
        is_pro: last.isPro,
        ...(last.resetsAt ? {resets_at: last.resetsAt} : {}),
        ...(last.paidWith
            ? {paid_with: paidKinds.size > 1 ? "mixed" : last.paidWith, credit_cost: last.creditCost, credit_balance: last.creditBalance}
            : {}),
        ...(last.creditOverflow ? {credit_overflow: last.creditOverflow} : {}),
        skipped_for_limit: skipped
    };

    const names = askShortNames(speakers.map((speaker) => speaker.member));
    const room = speakers.map((speaker, index) => ({
        label: askParticipantLabel(speaker.member),
        shortName: names[index],
        powerName: speaker.member.powerName
    }));
    const prepared = speakers.map((speaker, index) => {
        const me = speaker.member;
        const persona = askPersonaDials({stats: me.stats, dynamics: me.species.systemDynamics?.frequency ?? null, voice: me.voice, quantiles});
        // Who in the room would eat whom: wariness or amusement, never threats.
        const preyLines = single
            ? []
            : askGroupNatureLines(
                {nature: me.nature},
                speakers.flatMap((other, otherIndex) => (otherIndex !== index ? [{shortName: names[otherIndex], nature: other.member.nature}] : []))
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
            groupLines: single
                ? askGroupRulesLines({
                    me,
                    angle: speaker.angle,
                    others: members.filter((member) => member !== me),
                    speakingNow: [me],
                    wordBudget: Math.min(90, persona.wordBudget)
                })
                : [...askConversationRulesLines({me: room[index], others: room.filter((_, other) => other !== index)}), ...preyLines]
        });
        return {speaker, persona, systemPrompt};
    });
    const earlier = history.map((turn) => ({
        speaker: turn.role === "user" ? "the person" : labelFor(turn.speaker),
        captureId: turn.role === "user" ? null : turn.speaker,
        content: turn.content
    }));
    const maxEffort = askChatMaxEffort();

    return streamAskGroupConversation<AskGroupMember>({
        speakers: prepared.map((entry) => ({
            member: entry.speaker.member,
            persona: askPersonaFrame(entry.speaker.member.voice, entry.persona)
        })),
        length: askConversationLength(prepared.length),
        single,
        sourceFor: (plan, turns, signal) => {
            const entry = prepared[plan.speaker];
            const me = entry.speaker.member;
            const userPrompt = buildAskGroupTurnUserPrompt({
                userMessage: question,
                memory,
                speciesProfileId: me.speciesProfileId,
                rightNow: askRightNowLine({nature: me.nature, utcOffsetMinutes: utcOffset}),
                earlier: earlier.map((turn) => ({
                    speaker: turn.captureId === me.captureId ? `${turn.speaker} (you)` : turn.speaker,
                    content: turn.content
                })),
                roundSoFar: turns.map((turn) => ({
                    speaker: turn.speaker === plan.speaker ? `${room[turn.speaker].label} (you)` : room[turn.speaker].label,
                    content: turn.text
                })),
                turnInstruction: askConversationTurnInstruction({
                    plan,
                    words: askPhaseWordBudget(plan.phase, entry.persona.wordBudget),
                    replyToName: plan.replyTo === null ? null : room[plan.replyTo].shortName,
                    personMessage: question
                })
            });
            // Conversation turns are short and should come quickly; only landing
            // the round, and an answer given alone, get the animal's own depth.
            const cap = plan.phase === "converge" || plan.phase === "decide" || plan.phase === "answer" ? maxEffort : "low";
            return turnSource(providers, {
                systemPrompt: entry.systemPrompt,
                userPrompt,
                effort: capAskEffort(entry.persona.effort, cap),
                signal
            });
        },
        mentionsOf: (text) => askMentionedSpeakers(text, prepared.map((entry) => entry.speaker.member)),
        closing,
        followUps: ASK_GROUP_CONVERSATION_FOLLOW_UPS,
        headers: ASK_RESPONSE_HEADERS,
        signal: request.signal,
        onSpeakerSilent: (speaker) => refundAskTurn(viewer, prepared[speaker].speaker.allowance),
        onDone: (turns) => {
            void (async () => {
                const work: Array<Promise<unknown>> = turns.map((turn) => countTheDay(userId, turn.member.speciesProfileId, question));
                if (personalise && turns.length > 0) {
                    const first = turns[0].member;
                    work.push(rememberAskTurn({
                        userId,
                        existing: memory,
                        animalName: first.animalName,
                        speciesProfileId: first.speciesProfileId,
                        userMessage: question,
                        answer: turns.map((turn) => `${askParticipantLabel(turn.member)}: ${turn.text}`).join("\n\n")
                    }));
                }
                await Promise.allSettled(work);
            })();
        }
    });
}
