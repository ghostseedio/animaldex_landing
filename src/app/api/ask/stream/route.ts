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
 */

import {buildAskPacket} from "@/data/ask-grounding";
import {getAskWildProfile} from "@/data/ask-wild-profile";
import {loadAskCompanion, type AskCompanion} from "@/data/ask-companion-voice";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const [basePacket, wildProfile, settings] = await Promise.all([
        buildAskPacket({subject, question: question ?? ""}),
        getAskWildProfile(viewer.userId),
        loadAskChatSettings(viewer.userId)
    ]);
    // Personalisation off: no memory is read and nothing is learned.
    const personalise = viewer.signedIn && settings.personalisationEnabled;
    const speaksAsAnimal = basePacket.scope === "species" && Boolean(basePacket.species);
    if (isGreeting && !speaksAsAnimal) {
        // Only an animal speaks first; the site-wide assistant waits to be asked.
        return askJson({error: "greeting_unavailable"}, 400);
    }
    const [memory, companion] = await Promise.all([
        speaksAsAnimal && personalise ? loadAskMemory(viewer.userId) : Promise.resolve([]),
        // How this animal talks: its voice card, or the record-derived fallback.
        speaksAsAnimal && basePacket.species
            ? loadAskCompanion(basePacket.species)
            : Promise.resolve(null as AskCompanion | null)
    ]);
    // A Trial question is grounded on that Trial and kept there.
    const aboutTrial = Boolean(subject.trialContext);
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
        ...(subject.trialContext ? {trialContext: subject.trialContext} : {})
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
            voice: companion.voice
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
        stats: companion?.stats ?? null
    };
    // The animal sees the conversation as real turns (its own replies as its
    // own), as in the apps; the site-wide assistant keeps it in the text.
    const historyTurns: AskConversationTurn[] | undefined = speaksAsAnimal ? askHistoryAsTurns(history) : undefined;
    const userPrompt = isGreeting
        ? buildAskGreetingUserPrompt({packet, recordInSystem: true})
        : buildAskUserPrompt({
            userQuestion: question ?? "",
            packet,
            conversationHistory: history,
            recordInSystem: speaksAsAnimal,
            historyAsTurns: speaksAsAnimal
        });
    const providers = availableAskProviders({animalVoice: speaksAsAnimal});

    const closing = isGreeting
        ? {greeting: true, signed_in: viewer.signedIn, has_wild_profile: wildProfile.hasWildProfile, ...personaFrame}
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
            ...personaFrame
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

    // Free but capped: past the cap (or with no model answering) the animal
    // opens with its card's own question, in the streamed shape.
    const greetingFromModel = isGreeting ? await takeAskGreeting(request, viewer) : false;
    const fixedGreeting = isGreeting && packet.species
        ? fallbackAskGreeting({animalName: packet.species.name, voice: companion?.voice ?? null})
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

            const finish = () => {
                const split = splitStreamedReply(full);
                if (split.answer.length > emitted) {
                    send({delta: split.answer.slice(emitted)});
                }
                send({done: true, follow_up_prompts: split.followUps, ...closing});
                if (split.answer.trim()) remember(split.answer);
            };

            const failures: string[] = [];
            const modelProviders = isGreeting && !greetingFromModel ? [] : providers;
            for (const provider of modelProviders) {
                const source = sourceFor(provider);
                if (!source) continue;
                try {
                    await pump(source);
                    finish();
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
                        finish();
                        controller.close();
                        return;
                    }
                }
            }

            if (fixedGreeting) {
                if (failures.length > 0) console.warn("[ask-animaldex] greeting fell back to the card", failures.join(" | "));
                full = `${fixedGreeting.text}\n${ASK_FOLLOW_UP_SENTINEL}\n${fixedGreeting.followUps.join("\n")}`;
                finish();
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
