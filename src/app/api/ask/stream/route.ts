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
import {
    ASK_RESPONSE_HEADERS,
    askLanguageName,
    checkAskRateLimit,
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
    const rate = checkAskRateLimit(request, viewer);
    if (!rate.allowed) {
        return askJson({
            error: "limit_reached",
            remaining: 0,
            limit: rate.limit,
            retryAfterSeconds: rate.retryAfterSeconds,
            signedIn: viewer.signedIn,
            isPro: viewer.isPro
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
    const [basePacket, wildProfile] = await Promise.all([
        buildAskPacket({subject, question}),
        getAskWildProfile(viewer.userId)
    ]);
    // A signed-in reader's Wild Profile personalises the answer. A signed-out
    // one has none to have, so the packet says nothing about it either way.
    const groundedPacket = viewer.signedIn
        ? {...basePacket, wildProfile: {summary: wildProfile.summary}}
        : basePacket;
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
        is_pro: viewer.isPro,
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
                return askJson({answer: oneShot.answer, follow_up_prompts: oneShot.followUps, ...closing});
            }
        } catch (error) {
            console.error("[ask-animaldex] one-piece answer failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        }
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
                    controller.close();
                    return;
                }
            } catch {
                // Falls through to the error event below.
            }

            console.error("[ask-animaldex] every provider failed", failures.join(" | "));
            send({error: "stream_failed", detail: failures[0] ?? "unknown"});
            controller.close();
        }
    });

    return new Response(responseStream, {status: 200, headers: STREAM_HEADERS});
}
