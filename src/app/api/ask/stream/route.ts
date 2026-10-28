import {NextResponse} from "next/server";

/**
 * Ask AnimalDex, streamed.
 *
 * The web port of the apps' `generate-applied-insight` streaming path. Same
 * prompts, same `§§FOLLOW_UPS§§` sentinel held back mid-stream, same
 * `{persona}` / `{delta}` / `{done, follow_up_prompts}` / `{error}` event
 * contract — so the client is the same state machine the app runs.
 *
 * On a species page the animal itself speaks (Speak to [Animal]): Claude
 * first, its stats and System Dynamics rhythm as dials, its record at the end
 * of a cached system prompt, the conversation as real turns, and a greeting
 * when the reader opens an empty thread (`greeting: true`).
 *
 * Deliberately not a proxy to that edge function: it requires a signed-in
 * account and a capture or species id, and an anonymous reader on a species
 * page has neither. The web's entitlement is the daily Ask allowance instead,
 * which is also what keeps the public species page out of a paywall.
 *
 * On the reader's own card the animal works on their life with them (the
 * companion loop, `companion-focus.ts`): its focus, the step it set, a step
 * done, another of their animals it sends them to. It records what it did in
 * hidden lines after the follow-ups, which are taken out here, written with
 * the service role, and reported as `companion` (and the new `bond`) in
 * `done`, in the edge function's shape. A `referral_id` greeting opens on the
 * referred problem, or says nothing once it has been taken up.
 */

import {buildAskPacket} from "@/data/ask-grounding";
import {getAskWildProfile} from "@/data/ask-wild-profile";
import {loadAskCompanion, type AskCompanion} from "@/data/ask-companion-voice";
import {loadAskStatQuantiles} from "@/data/ask-stat-quantiles";
import {loadAskChatSettings, loadAskMemory, rememberAskTurn} from "@/lib/ask-animaldex/memory";
import {askHistoryAsTurns, dedupeCurrentQuestion, fallbackAskGreeting} from "@/lib/ask-animaldex/companion";
import {
    ASK_RESPONSE_HEADERS,
    askLanguageName,
    refundAskTurn,
    takeAskGreeting,
    takeAskTurn,
    resolveAskHistory,
    resolveAskRequestId,
    resolveAskQuestion,
    resolveAskSubject,
    resolveAskViewer
} from "@/lib/ask-animaldex/request";
import {buildAskGreetingUserPrompt, buildAskUserPrompt} from "@/lib/ask-animaldex/grounding";
import {
    ASK_FOLLOW_UP_SENTINEL,
    buildAskStreamingSystemPrompt,
    buildAskSystemPrompt,
    splitStreamedReply,
    visibleAnswerSoFar,
    type AskConversationTurn
} from "@/lib/ask-animaldex/prompt";
import {
    askAnswerSource,
    askChatMaxEffort,
    availableAskProviders,
    requestAskAnswerJSON,
    type AnswerDeltaSource,
    type AskProviderName
} from "@/lib/ask-animaldex/providers";
import {
    askPersonaDials,
    askPersonaFrame,
    capAskEffort,
    type AskChatEffort,
    type AskPersonaFrame
} from "@/lib/ask-animaldex/persona";
import {askSupportedVisuals} from "@/lib/ask-animaldex/visuals";
import {
    bondForClient,
    companionPromptLines,
    extractCompanionLines,
    type CompanionLines
} from "@/lib/ask-animaldex/companion-focus";
import {
    applyCompanionLines,
    loadOwnerCompanion,
    readerOwnsCapture,
    takeAnimalReferral,
    type OwnerCompanion
} from "@/lib/ask-animaldex/companion-loop-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function askJson(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

const STREAM_HEADERS = {
    ...ASK_RESPONSE_HEADERS,
    "Content-Type": "text/event-stream; charset=utf-8",
    Connection: "keep-alive",
    // Without this, nginx and some CDN edges buffer the whole body and the
    // reader waits out the entire generation before seeing one word — which is
    // the exact failure streaming was added to remove.
    "X-Accel-Buffering": "no"
} as const;

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return askJson({error: "invalid_request"}, 400);
    }

    // The animal's opening line: it speaks before the reader has said anything.
    const isGreeting = body.greeting === true;
    const question = isGreeting ? "" : resolveAskQuestion(body.question);
    if (!isGreeting && !question) return askJson({error: "invalid_question"}, 400);

    const viewer = await resolveAskViewer(request);
    const subject = resolveAskSubject(body.subject);

    // A greeting is free: it never touches the message allowance or credits.
    // Every other message takes one from today's budget (or one credit past
    // it), with one id per message, reused when that message is retried (and
    // by the one-piece retry below), so the same message is never charged twice.
    const rate = isGreeting
        ? null
        : await takeAskTurn(request, viewer, {
            requestId: resolveAskRequestId(body.requestId),
            payWithCredits: body.payWithCredits === true
        });
    if (rate && !rate.allowed) {
        return askJson({
            error: "limit_reached",
            // The apps' reasons: the day's allowance is used, or the reader
            // chose to pay and the balance cannot cover a message.
            reason: rate.reason ?? "daily_limit_reached",
            remaining: 0,
            limit: rate.limit,
            retryAfterSeconds: rate.retryAfterSeconds,
            resetsAt: rate.resetsAt,
            signedIn: viewer.signedIn,
            isPro: rate.isPro,
            ...(rate.creditOverflow ? {creditOverflow: rate.creditOverflow} : {})
        }, 429);
    }
    const refund = async () => {
        if (rate) await refundAskTurn(viewer, rate);
    };

    if (availableAskProviders({animalVoice: true}).length === 0) {
        // No key configured is an outage, not an empty answer. Returning a
        // cheerful fallback here is how a revoked key hides behind a 200.
        console.error("[ask-animaldex] no model provider configured");
        await refund();
        return askJson({error: "unavailable"}, 503);
    }

    // The history must not carry the message being sent; an older client
    // still appends it, so a trailing copy of the question is dropped here.
    const history = dedupeCurrentQuestion(resolveAskHistory(body.history), question ?? "");
    const [basePacket, wildProfile, settings, ownsCapture] = await Promise.all([
        buildAskPacket({subject, question: question ?? ""}),
        getAskWildProfile(viewer.userId),
        loadAskChatSettings(viewer.userId),
        // The reader's own card: their one-to-one chat with this animal.
        viewer.signedIn ? readerOwnsCapture(viewer.userId, subject.captureId) : Promise.resolve(false)
    ]);
    // Personalisation off: no memory is read and nothing is learned.
    const personalise = viewer.signedIn && settings.personalisationEnabled;
    const speaksAsAnimal = basePacket.scope === "species" && Boolean(basePacket.species);
    if (isGreeting && !speaksAsAnimal) {
        // Only an animal speaks first; the site-wide assistant waits to be asked.
        return askJson({error: "greeting_unavailable"}, 400);
    }
    const [memory, companion, quantiles] = await Promise.all([
        speaksAsAnimal && personalise ? loadAskMemory(viewer.userId) : Promise.resolve([]),
        // How this animal talks: its voice card, or the record-derived fallback.
        speaksAsAnimal && basePacket.species
            ? loadAskCompanion(basePacket.species)
            : Promise.resolve(null as AskCompanion | null),
        // The persona's bands are cut on the live catalogue's spread.
        speaksAsAnimal ? loadAskStatQuantiles() : Promise.resolve(null)
    ]);
    // A Trial question is grounded on that Trial and kept there.
    const aboutTrial = Boolean(subject.trialContext);
    // The owner's turn: the bond, and (personalisation on, not a Trial) the
    // companion loop. Anything that fails leaves the animal without it.
    const ownerSpeciesId = speaksAsAnimal && ownsCapture && viewer.userId ? companion?.speciesProfileId ?? null : null;
    const owner: OwnerCompanion | null = ownerSpeciesId && viewer.userId
        ? await loadOwnerCompanion({userId: viewer.userId, speciesProfileId: ownerSpeciesId, loopOn: personalise && !aboutTrial})
            .catch(() => null)
        : null;
    const loop = owner?.loop ?? null;
    // Another of their animals sent them here about something not yet taken up.
    const referral = loop?.state?.referral ?? null;
    // The website has no step cards, so the animal talks in chat mode; a
    // Trial thread is training, as the apps force it.
    const mode = aboutTrial ? "training" as const : "chat" as const;
    // A signed-in reader's Wild Profile personalises the answer, and what the
    // animals already remember about them rides along. A signed-out reader
    // has neither, so the packet says nothing about them either way.
    const groundedPacket = viewer.signedIn
        ? {
            ...basePacket,
            // As the apps do, personalisation off also keeps the Wild Profile out.
            wildProfile: {summary: personalise ? wildProfile.summary : null},
            memory,
            memorySpeciesProfileId: companion?.speciesProfileId ?? null
        }
        : basePacket;
    const packet = {
        ...groundedPacket,
        ...(groundedPacket.scope === "species" ? {mode, stats: companion?.stats ?? null} : {}),
        ...(subject.trialContext ? {trialContext: subject.trialContext} : {}),
        ...(owner?.bond?.stage
            ? {relationship: {stage: owner.bond.stage, counted: owner.bond.counted ?? {}}}
            : {}),
        ...(loop
            ? {
                companionLines: companionPromptLines({
                    state: loop.state,
                    roster: loop.roster,
                    powerJustEarned: loop.powerJustEarned,
                    powerEarned: owner?.powerEarned ?? false,
                    lessonCheckPassed: owner?.lessonCheckPassed ?? true
                })
            }
            : {})
    };
    // What this exchange taught about the person is learned after the answer
    // has gone out, so the reply is never slowed by it.
    const remember = (answer: string) => {
        if (isGreeting || !personalise || packet.scope !== "species" || !packet.species) return;
        void rememberAskTurn({
            userId: viewer.userId,
            existing: memory,
            animalName: packet.species.name,
            speciesProfileId: companion?.speciesProfileId ?? null,
            userMessage: question ?? "",
            answer
        });
    };
    const languageName = askLanguageName(body.locale);

    // The stats and System Dynamics rhythm as conversational dials: how hard
    // it thinks, who steers, how much it says, how fast it types.
    const persona = speaksAsAnimal && companion
        ? askPersonaDials({
            stats: companion.stats,
            dynamics: packet.species?.systemDynamics?.frequency ?? null,
            voice: companion.voice,
            quantiles
        })
        : null;
    const personaFrame: {persona?: AskPersonaFrame} = persona && companion
        ? {persona: askPersonaFrame(companion.voice, persona)}
        : {};
    // Greetings think at low effort, as in the apps; replies at the animal's own,
    // capped (medium unless ANIMAL_CHAT_MAX_EFFORT says otherwise).
    const effort: AskChatEffort = isGreeting ? "low" : capAskEffort(persona?.effort ?? "low", askChatMaxEffort());

    const supportedVisuals = askSupportedVisuals(packet.hasReaderPhoto);
    const promptOptions = {
        scope: packet.scope,
        supportedVisuals,
        languageName,
        aboutTrial,
        voice: companion?.voice ?? null,
        animalName: packet.species?.name ?? null,
        mode,
        // Species scope: the character's dials, and the record at the end of
        // the system prompt where it is cached turn after turn.
        persona,
        species: speaksAsAnimal ? packet.species : null,
        stats: companion?.stats ?? null,
        companionLoop: loop ? {offersSteps: settings.suggestSteps} : null
    };
    // The animal sees the conversation as real turns (its own replies as its
    // own), as in the apps; the site-wide assistant keeps it in the text.
    const historyTurns: AskConversationTurn[] | undefined = speaksAsAnimal ? askHistoryAsTurns(history) : undefined;
    const userPrompt = isGreeting
        ? buildAskGreetingUserPrompt({packet, recordInSystem: true, referral: Boolean(referral)})
        : buildAskUserPrompt({
            userQuestion: question ?? "",
            packet,
            conversationHistory: history,
            recordInSystem: speaksAsAnimal,
            historyAsTurns: speaksAsAnimal
        });
    const providers = availableAskProviders({animalVoice: speaksAsAnimal});

    // The owner's bond, as the apps get it on every turn.
    const bondFrame: {bond?: Record<string, unknown>} = owner?.bond?.stage ? {bond: bondForClient(owner.bond)} : {};
    const closing = isGreeting
        ? {greeting: true, signed_in: viewer.signedIn, has_wild_profile: wildProfile.hasWildProfile, ...personaFrame, ...bondFrame}
        : {
            remaining: rate?.remaining,
            limit: rate?.limit,
            signed_in: viewer.signedIn,
            is_pro: rate?.isPro,
            has_wild_profile: wildProfile.hasWildProfile,
            ...(rate?.resetsAt ? {resets_at: rate.resetsAt} : {}),
            ...(rate?.paidWith
                ? {paid_with: rate.paidWith, credit_cost: rate.creditCost, credit_balance: rate.creditBalance}
                : {}),
            // Lets the client offer credits as soon as the last free message is
            // spent, instead of after a refused one.
            ...(rate?.creditOverflow ? {credit_overflow: rate.creditOverflow} : {}),
            ...personaFrame,
            ...bondFrame
        };

    const oneShot = () => requestAskAnswerJSON({
        systemPrompt: buildAskSystemPrompt(promptOptions),
        userPrompt,
        history: historyTurns,
        animalVoice: speaksAsAnimal,
        effort,
        signal: request.signal
    });

    // The one-piece answer, asked for by a client whose stream was cut off
    // mid-answer. A different request shape, which often survives what killed
    // the stream — a buffering proxy, an SSE-hostile network — and returns the
    // whole answer or nothing, so the reader is never left with half of one.
    if (body.mode === "complete" && !isGreeting) {
        try {
            const whole = await oneShot();
            if (whole?.answer.trim()) {
                remember(whole.answer);
                return askJson({answer: whole.answer, follow_up_prompts: whole.followUps, ...closing});
            }
        } catch (error) {
            console.error("[ask-animaldex] one-piece answer failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        }
        await refund();
        return askJson({error: "unavailable"}, 503);
    }

    // Opened from a referral that has been taken up already: nothing to open with.
    const referralId = typeof body.referral_id === "string" && UUID_PATTERN.test(body.referral_id.trim())
        ? body.referral_id.trim()
        : null;
    const staleReferral = isGreeting && Boolean(referralId) && !referral;
    // Free but capped: past the cap (or with no model answering) the animal
    // opens with its card's own question, in the streamed shape. Sent here by
    // another animal, it always opens with the problem.
    const greetingFromModel = isGreeting && !staleReferral
        ? Boolean(referral) || await takeAskGreeting(request, viewer)
        : false;
    const fixedGreeting = isGreeting && packet.species && !staleReferral
        ? fallbackAskGreeting({animalName: packet.species.name, voice: companion?.voice ?? null})
        : null;
    // The loop's hidden lines, written before `done`; what comes back is merged into it.
    const onCompanion = loop && owner && ownerSpeciesId && viewer.userId
        ? (lines: CompanionLines) => applyCompanionLines({
            service: owner.service,
            userId: viewer.userId as string,
            speciesProfileId: ownerSpeciesId,
            state: loop.state,
            roster: loop.roster,
            lines
        })
        : null;
    const streamingSystemPrompt = buildAskStreamingSystemPrompt(promptOptions);
    const sourceFor = (provider: AskProviderName) => askAnswerSource(provider, {
        systemPrompt: streamingSystemPrompt,
        userPrompt,
        history: historyTurns,
        effort,
        signal: request.signal
    });

    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let closed = false;
            const send = (event: Record<string, unknown>) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch {
                    closed = true;
                }
            };

            // The animal's pace comes first, so the drawer can type the very
            // first word at it.
            if (personaFrame.persona) send(personaFrame);

            let full = "";
            // Everything up to the sentinel is answer text; once it appears,
            // the rest is follow-ups and must not be shown as part of the answer.
            let emitted = 0;

            const pump = (source: AnswerDeltaSource) => source((delta) => {
                if (!delta) return;
                full += delta;
                const visible = visibleAnswerSoFar(full);
                if (visible.length > emitted) {
                    send({delta: visible.slice(emitted)});
                    emitted = visible.length;
                }
            });

            const finish = async () => {
                // The companion lines come out before the follow-ups are read,
                // so they are never shown and never become chips.
                const hidden = extractCompanionLines(full);
                const split = splitStreamedReply(hidden.raw);
                if (split.answer.length > emitted) {
                    send({delta: split.answer.slice(emitted)});
                }
                const companionFields = split.answer.trim() && onCompanion
                    ? await onCompanion(hidden.lines).catch(() => ({}))
                    : {};
                send({done: true, follow_up_prompts: split.followUps, ...closing, ...companionFields});
                if (split.answer.trim()) {
                    remember(split.answer);
                    // The animal it was sent to has now taken the problem up.
                    if (isGreeting && referral && owner && viewer.userId) {
                        void takeAnimalReferral(owner.service, viewer.userId, referral.id);
                    }
                }
            };

            // A referral already taken up: an empty greeting, which the
            // client takes as no hello.
            if (staleReferral) {
                send({done: true, follow_up_prompts: [], ...closing});
                controller.close();
                return;
            }

            const failures: string[] = [];
            const modelProviders = isGreeting && !greetingFromModel ? [] : providers;
            for (const provider of modelProviders) {
                const source = sourceFor(provider);
                if (!source) continue;
                try {
                    await pump(source);
                    await finish();
                    controller.close();
                    return;
                } catch (error) {
                    if (request.signal.aborted) {
                        // The reader pressed stop. Whatever arrived is already
                        // on their screen and is theirs to keep.
                        controller.close();
                        return;
                    }
                    const detail = error instanceof Error ? error.message.slice(0, 200) : "unknown";
                    failures.push(`${provider}: ${detail}`);
                    // A provider that already wrote half an answer cannot be
                    // retried with a second one: the reader would watch the
                    // answer restart mid-sentence.
                    if (emitted > 0) {
                        await finish();
                        controller.close();
                        return;
                    }
                }
            }

            if (fixedGreeting) {
                if (failures.length > 0) console.warn("[ask-animaldex] greeting fell back to the card", failures.join(" | "));
                full = `${fixedGreeting.text}\n${ASK_FOLLOW_UP_SENTINEL}\n${fixedGreeting.followUps.join("\n")}`;
                await finish();
                controller.close();
                return;
            }

            // Every stream failed before producing a word. The one-piece path
            // is a different request shape and often survives what killed the
            // stream — a buffering proxy, an SSE-hostile network.
            try {
                const whole = await oneShot();
                if (whole) {
                    send({delta: whole.answer});
                    send({done: true, follow_up_prompts: whole.followUps, ...closing});
                    remember(whole.answer);
                    controller.close();
                    return;
                }
            } catch {
                // Falls through to the error event below.
            }

            console.error("[ask-animaldex] every provider failed", failures.join(" | "));
            // Nothing was produced, so the message goes back to the budget.
            await refund();
            send({error: "stream_failed", detail: failures[0] ?? "unknown"});
            controller.close();
        }
    });

    return new Response(responseStream, {status: 200, headers: STREAM_HEADERS});
}
