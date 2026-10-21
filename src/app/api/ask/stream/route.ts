import {NextResponse} from "next/server";

/**
 * Ask AnimalDex, streamed.
 *
 * The web port of the iOS `generate-applied-insight` streaming path. Same
 * prompts, same `§§FOLLOW_UPS§§` sentinel held back mid-stream, same
 * `{delta}` / `{done, follow_up_prompts}` / `{error}` event contract — so the
 * client is the same state machine the app runs.
 *
 * Deliberately not a proxy to that edge function: it requires a capture id, Pro,
 * and premium field-guide provenance, none of which an anonymous reader on a
 * species page has. The web's entitlement is the daily Ask allowance instead,
 * which is also what keeps the public species page out of a paywall.
 */

import {buildAskPacket} from "@/data/ask-grounding";
import {getAskWildProfile} from "@/data/ask-wild-profile";
import {loadAskMemory, rememberAskTurn} from "@/lib/ask-animaldex/memory";
import {
    ASK_RESPONSE_HEADERS,
    askLanguageName,
    refundAskTurn,
    takeAskTurn,
    resolveAskHistory,
    resolveAskQuestion,
    resolveAskSubject,
    resolveAskViewer
} from "@/lib/ask-animaldex/request";
import {buildAskUserPrompt} from "@/lib/ask-animaldex/grounding";
import {
    buildAskStreamingSystemPrompt,
    buildAskSystemPrompt,
    splitStreamedReply,
    visibleAnswerSoFar
} from "@/lib/ask-animaldex/prompt";
import {
    askAnswerSource,
    availableAskProviders,
    requestAskAnswerJSON,
    type AnswerDeltaSource
} from "@/lib/ask-animaldex/providers";
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

    const question = resolveAskQuestion(body.question);
    if (!question) return askJson({error: "invalid_question"}, 400);

    const viewer = await resolveAskViewer(request);
    const rate = await takeAskTurn(request, viewer);
    if (!rate.allowed) {
        return askJson({
            error: "limit_reached",
            remaining: 0,
            limit: rate.limit,
            retryAfterSeconds: rate.retryAfterSeconds,
            signedIn: viewer.signedIn,
            isPro: rate.isPro
        }, 429);
    }

    const providers = availableAskProviders();
    if (providers.length === 0) {
        // No key configured is an outage, not an empty answer. Returning a
        // cheerful fallback here is how a revoked key hides behind a 200.
        console.error("[ask-animaldex] no model provider configured");
        return askJson({error: "unavailable"}, 503);
    }

    const subject = resolveAskSubject(body.subject);
    const history = resolveAskHistory(body.history);
    const [basePacket, wildProfile, memory] = await Promise.all([
        buildAskPacket({subject, question}),
        getAskWildProfile(viewer.userId),
        subject.scope === "species" ? loadAskMemory(viewer.userId) : Promise.resolve([])
    ]);
    // A signed-in reader's Wild Profile personalises the answer, and what the
    // animals already remember about them rides along. A signed-out reader
    // has neither, so the packet says nothing about them either way.
    const groundedPacket = viewer.signedIn
        ? {...basePacket, wildProfile: {summary: wildProfile.summary}, memory}
        : basePacket;
    // What this exchange taught about the person is learned after the answer
    // has gone out, so the reply is never slowed by it.
    const remember = (answer: string) => {
        if (packet.scope !== "species" || !packet.species) return;
        void rememberAskTurn({
            userId: viewer.userId,
            existing: memory,
            animalName: packet.species.name,
            userMessage: question,
            answer
        });
    };
    // A Trial question is grounded on that Trial and kept there.
    const packet = subject.trialContext
        ? {...groundedPacket, trialContext: subject.trialContext}
        : groundedPacket;
    const aboutTrial = Boolean(subject.trialContext);
    const languageName = askLanguageName(body.locale);

    const supportedVisuals = askSupportedVisuals(packet.hasReaderPhoto);
    const userPrompt = buildAskUserPrompt({userQuestion: question, packet, conversationHistory: history});
    const closing = {
        remaining: rate.remaining,
        limit: rate.limit,
        signed_in: viewer.signedIn,
        is_pro: rate.isPro,
        has_wild_profile: wildProfile.hasWildProfile
    };

    // The one-piece answer, asked for by a client whose stream was cut off
    // mid-answer. A different request shape, which often survives what killed
    // the stream — a buffering proxy, an SSE-hostile network — and returns the
    // whole answer or nothing, so the reader is never left with half of one.
    if (body.mode === "complete") {
        try {
            const oneShot = await requestAskAnswerJSON({
                systemPrompt: buildAskSystemPrompt({scope: packet.scope, supportedVisuals, languageName, aboutTrial}),
                userPrompt,
                signal: request.signal
            });
            if (oneShot?.answer.trim()) {
                remember(oneShot.answer);
                return askJson({answer: oneShot.answer, follow_up_prompts: oneShot.followUps, ...closing});
            }
        } catch (error) {
            console.error("[ask-animaldex] one-piece answer failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        }
        await refundAskTurn(viewer);
        return askJson({error: "unavailable"}, 503);
    }
    const streamingSystemPrompt = buildAskStreamingSystemPrompt({
        scope: packet.scope,
        supportedVisuals,
        languageName,
        aboutTrial
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
            for (const provider of providers) {
                const source = askAnswerSource(provider, {
                    systemPrompt: streamingSystemPrompt,
                    userPrompt,
                    signal: request.signal
                });
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

            // Every stream failed before producing a word. The one-piece path
            // is a different request shape and often survives what killed the
            // stream — a buffering proxy, an SSE-hostile network.
            try {
                const oneShot = await requestAskAnswerJSON({
                    systemPrompt: buildAskSystemPrompt({
                        scope: packet.scope,
                        supportedVisuals,
                        languageName
                    }),
                    userPrompt,
                    signal: request.signal
                });
                if (oneShot) {
                    send({delta: oneShot.answer});
                    send({done: true, follow_up_prompts: oneShot.followUps, ...closing});
                    remember(oneShot.answer);
                    controller.close();
                    return;
                }
            } catch {
                // Falls through to the error event below.
            }

            console.error("[ask-animaldex] every provider failed", failures.join(" | "));
            // Nothing was produced, so the message goes back to the budget.
            await refundAskTurn(viewer);
            send({error: "stream_failed", detail: failures[0] ?? "unknown"});
            controller.close();
        }
    });

    return new Response(responseStream, {status: 200, headers: STREAM_HEADERS});
}
