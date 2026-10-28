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
 * first, its stats and System Dynamics rhythm as dials, its nature (how it
 * holds a conversation, lives its day and senses the world), its record at
 * the end of a cached system prompt, the conversation as real turns, each
 * reply's length from the moment, stories of its own life when it chooses to
 * tell one, and a greeting when the reader opens an empty thread
 * (`greeting: true`).
 *
 * Deliberately not a proxy to that edge function: it requires a signed-in
 * account and a capture or species id, and an anonymous reader on a species
 * page has neither. The web's entitlement is the daily Ask allowance instead,
 * which is also what keeps the public species page out of a paywall.
 *
 * On a signed-in reader's own card the animal works on their life with them
 * (the companion loop, `companion-focus.ts`): its focus, the step it set, a
 * step done, another of their animals it sends them to. It records what it did
 * in hidden lines after the follow-ups, which are taken out here, written with
 * the service role, and reported as `companion` (and the new `bond`) in
 * `done`, in the edge function's shape. A `referral_id` greeting opens on the
 * referred problem, or says nothing once it has been taken up. It also passes
 * on who visited, checks back on what they asked it to, and keeps the
 * visitor-safe journey note.
 *
 * On someone else's card the animal is theirs: it talks about its owner only
 * from what the owner shares (`animal_chat_owner_context`), tells the visitor
 * once that it passes visits on, and passes on the gist.
 *
 * Every answered turn of a signed-in reader notes that they talked to this
 * animal today (`animal_chat_species_days`), for how many people have.
 */

import {buildAskPacket} from "@/data/ask-grounding";
import {getAskWildProfile} from "@/data/ask-wild-profile";
import {loadAskCompanion, type AskCompanion} from "@/data/ask-companion-voice";
import {loadAskStatQuantiles} from "@/data/ask-stat-quantiles";
import {loadAskCaptureContext} from "@/data/ask-capture-context";
import {loadAskRecordExtras} from "@/data/ask-animal-record";
import {loadAskChatSettings, loadAskMemory, rememberAskTurn} from "@/lib/ask-animaldex/memory";
import {
    ASK_CRISIS_PATTERN,
    askHistoryAsTurns,
    dedupeCurrentQuestion,
    fallbackAskGreeting
} from "@/lib/ask-animaldex/companion";
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
import {buildAskGreetingUserPrompt, buildAskUserPrompt, shortWordsFor} from "@/lib/ask-animaldex/grounding";
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
import {askAnimalNatureFor, askHowYouMetLine, askRightNowLine} from "@/lib/ask-animaldex/nature";
import {askReplyLengthFor, askReplyLengthLine, askRoomForAStory} from "@/lib/ask-animaldex/reply-length";
import {askOwnLifePromptSection, askStorytellingLine, cleanAskOwnStory, extractAskOwnStory} from "@/lib/ask-animaldex/stories";
import {
    answerWithAskVisitorNotice,
    askVisitorNotesEnabled,
    askVisitorNoticeText,
    askVisitorNotesPromptSection,
    withAskVisitorNotice
} from "@/lib/ask-animaldex/visitor-notes";
import {askSupportedVisuals} from "@/lib/ask-animaldex/visuals";
import {askCallTurn, resolveAskCallQuestion} from "@/lib/ask-animaldex/call-voice";
import {CALL_REPLY_LINE} from "@/lib/ask-animaldex/call-speech";
import {askCallsOffered} from "@/lib/ask-animaldex/call-gate";
import {
    bondForClient,
    companionPromptLines,
    extractCompanionLines,
    type CompanionLines
} from "@/lib/ask-animaldex/companion-focus";
import {
    applyCompanionLines,
    loadOwnerCompanion,
    takeAnimalReferral,
    type OwnerCompanion
} from "@/lib/ask-animaldex/companion-loop-server";
import {
    loadAskDueFollowUp,
    loadAskOwnerContext,
    loadAskOwnStories,
    loadAskPendingVisitorNotes,
    markAskFollowUpRaised,
    markAskVisitorNotesDelivered,
    recordAskCompanionDay,
    recordAskTalkDay,
    resolveAskVisitorRelay,
    saveAskOwnStory,
    saveAskVisitorNote
} from "@/lib/ask-animaldex/chat-records-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function askJson(body: unknown, status = 200) {
    return NextResponse.json(body, {status, headers: ASK_RESPONSE_HEADERS});
}

/** The reader's clock, minutes ahead of UTC, as the drawer reports it; null when unknown. */
function resolveUtcOffset(raw: unknown): number | null {
    const value = typeof raw === "number" ? raw : Number.NaN;
    return Number.isFinite(value) && Math.abs(value) <= 14 * 60 ? Math.round(value) : null;
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
    const question = isGreeting ? "" : body.call === true ? resolveAskCallQuestion(body.question) : resolveAskQuestion(body.question);
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
    const [basePacket, wildProfile, settings, card] = await Promise.all([
        buildAskPacket({subject, question: question ?? ""}),
        getAskWildProfile(viewer.userId),
        loadAskChatSettings(viewer.userId),
        // The card the chat is about: whose it is, its name, how they met.
        // Only for a signed-in reader; a signed-out one is never anyone's
        // owner or visitor.
        viewer.signedIn ? loadAskCaptureContext(subject.captureId) : Promise.resolve(null)
    ]);
    const ownsCapture = Boolean(card && viewer.userId && card.ownerId === viewer.userId);
    // On someone else's card the animal is theirs.
    const isVisit = Boolean(card && viewer.userId && card.ownerId !== viewer.userId);
    // Personalisation off: no memory is read and nothing is learned.
    const personalise = viewer.signedIn && settings.personalisationEnabled;
    const speaksAsAnimal = basePacket.scope === "species" && Boolean(basePacket.species);
    // A live voice call (`call-voice.ts`): a fast model, a short spoken reply,
    // and its voice streamed back in this stream with the words.
    const isCall = !isGreeting && body.call === true && speaksAsAnimal && askCallsOffered(viewer.signedIn);
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
    const speciesId = speaksAsAnimal ? companion?.speciesProfileId ?? null : null;
    // A Trial question is grounded on that Trial and kept there.
    const aboutTrial = Boolean(subject.trialContext);
    // The owner's turn: the bond, and (personalisation on, not a Trial) the
    // companion loop. Anything that fails leaves the animal without it.
    const ownerSpeciesId = ownsCapture && viewer.userId ? speciesId : null;
    const followUpsOn = personalise && settings.followUpsEnabled;
    // Its Trials and qualities, its taxonomy; on a visit, what it may say
    // about its owner; for the owner, a check-in they asked for (on the first
    // thing they say) and who visited (in the hello or the first reply).
    const animalOwnerId = card?.ownerId ?? viewer.userId;
    const ownerTalksFirst = isGreeting || history.filter((turn) => turn.role === "assistant").length <= 1;
    const [owner, extras, ownerContext, dueFollowUp, visitorNotes, ownStories] = await Promise.all([
        ownerSpeciesId && viewer.userId
            ? loadOwnerCompanion({userId: viewer.userId, speciesProfileId: ownerSpeciesId, loopOn: personalise && !aboutTrial})
                .catch(() => null as OwnerCompanion | null)
            : Promise.resolve(null as OwnerCompanion | null),
        speciesId ? loadAskRecordExtras(speciesId) : Promise.resolve(null),
        isVisit && speciesId && card && viewer.userId
            ? loadAskOwnerContext({viewerId: viewer.userId, ownerId: card.ownerId, speciesProfileId: speciesId})
            : Promise.resolve(null),
        ownerSpeciesId && viewer.userId && followUpsOn && !history.some((turn) => turn.role === "user") && !aboutTrial
            ? loadAskDueFollowUp(viewer.userId, ownerSpeciesId)
            : Promise.resolve(null),
        ownerSpeciesId && viewer.userId && askVisitorNotesEnabled() && ownerTalksFirst
            ? loadAskPendingVisitorNotes(viewer.userId, ownerSpeciesId)
            : Promise.resolve([]),
        speciesId && animalOwnerId ? loadAskOwnStories(animalOwnerId, speciesId) : Promise.resolve([])
    ]);
    const loop = owner?.loop ?? null;
    // Another of their animals sent them here about something not yet taken up.
    const referral = loop?.state?.referral ?? null;
    // How the animal talks is read from each message, as in the apps since
    // 2026-10-28; a Trial thread is training, as the apps force it.
    const mode = aboutTrial ? "training" as const : "auto" as const;
    const languageName = askLanguageName(body.locale);

    // On a visit: what it may say about its owner, and whether it passes the
    // visit on (the visitor has been told, by a fixed line in their language).
    const visitorContext = isVisit ? ownerContext ?? {has_spoken: false, journey: null} : null;
    const ownerName = typeof visitorContext?.owner_name === "string" ? visitorContext.owner_name.trim() : "";
    const relay = isVisit && askVisitorNotesEnabled() && speciesId && card && viewer.userId && ownerName
        ? await resolveAskVisitorRelay({visitorId: viewer.userId, ownerId: card.ownerId, speciesProfileId: speciesId, history})
        : null;
    const relayOn = Boolean(relay && !relay.blocked);
    // Not told yet: this answer tells them, and what they say now stays here.
    const visitorNotice = relayOn && relay && !relay.noticed ? askVisitorNoticeText(languageName, ownerName) : null;
    const relayThisTurn = relayOn && Boolean(relay?.noticed) && !isGreeting;

    // Its nature, its day, and the moment they met.
    const species = basePacket.species
        ? {
            ...basePacket.species,
            ...(extras ? {trials: extras.trials, qualities: extras.qualities, bestTimeOfDay: extras.bestTimeOfDay} : {})
        }
        : null;
    const nature = speaksAsAnimal && species
        ? askAnimalNatureFor({
            animalName: species.name,
            taxonomy: extras?.taxonomy ?? null,
            stats: companion?.stats ?? null,
            fieldGuide: {
                species_spotlight: species.summary,
                signature_traits: species.identification,
                interesting_facts: species.interestingFacts,
                typical_habitat: species.habitat,
                sleep_pattern: species.sleepPattern,
                predators_summary: species.predators,
                lifespan_estimate: species.lifespan,
                best_time_of_day: species.bestTimeOfDay ?? null,
                diet_summary: species.diet
            },
            intellect: askPersonaDials({stats: companion?.stats ?? null, dynamics: null, voice: null, quantiles}).intellect,
            card: companion?.voice.nature ?? null
        })
        : null;
    const rightNow = nature
        ? askRightNowLine({nature, utcOffsetMinutes: resolveUtcOffset(body.utc_offset_minutes), latitude: card?.latitude ?? null})
        : null;
    const howYouMet = card ? askHowYouMetLine(card.moment, {forVisitor: isVisit}) : null;

    // The stats and System Dynamics rhythm as conversational dials: how hard
    // it thinks, who steers, how fast it types.
    const persona = speaksAsAnimal && companion
        ? askPersonaDials({
            stats: companion.stats,
            dynamics: species?.systemDynamics?.frequency ?? null,
            voice: companion.voice,
            quantiles
        })
        : null;
    // How long this reply should be, and whether a story is the animal's to
    // tell: from its character, the relationship and what it has told. The
    // animal matches the size of what was said; a short reply has no room
    // for a story.
    const lengthTier = askReplyLengthFor({message: question ?? "", mode, history});
    const thisReply = isGreeting
        ? null
        : isCall
        ? [CALL_REPLY_LINE]
        : !nature
        ? null
        : [
            askReplyLengthLine(lengthTier),
            askStorytellingLine({
                tells: nature.tells,
                stories: ownStories,
                blocked: aboutTrial || ASK_CRISIS_PATTERN.test(question ?? "") || !askRoomForAStory(lengthTier)
            })
        ];

    // A signed-in reader's Wild Profile personalises the answer, and what the
    // animals already remember about them rides along. A signed-out reader
    // has neither, so the packet says nothing about them either way.
    const groundedPacket = viewer.signedIn
        ? {
            ...basePacket,
            species,
            // As the apps do, personalisation off also keeps the Wild Profile out.
            wildProfile: {summary: personalise ? wildProfile.summary : null},
            memory,
            memorySpeciesProfileId: speciesId
        }
        : {...basePacket, species};
    const packet = {
        ...groundedPacket,
        ...(groundedPacket.scope === "species"
            ? {
                mode,
                stats: companion?.stats ?? null,
                howYouMet,
                rightNow,
                ownLife: ownStories.length > 0 ? askOwnLifePromptSection(ownStories) : null,
                thisReply,
                shortWords: persona ? shortWordsFor(persona.wordBudget) : null,
                invitedFollowUp: dueFollowUp ? {topic: dueFollowUp.topic, invitedAt: dueFollowUp.invitedAt} : null,
                visitorNotes: visitorNotes.length > 0 ? askVisitorNotesPromptSection(visitorNotes) : null,
                ownerContext: visitorContext
            }
            : {}),
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

    /**
     * Everything an answered turn leaves behind, after the answer has gone
     * out so the reply is never slowed by it: what it taught about the
     * person (and, for the owner, the journey and a check-in they asked for),
     * the visit's gist for its owner, the visits passed on, the bond's day,
     * the check-in raised, and that they talked to this animal today.
     */
    const afterAnswer = (shown: string) => {
        // The notice is the route's line, not part of what the animal said.
        const answer = visitorNotice ? shown.replace(visitorNotice, "").trim() : shown;
        if (!answer.trim() || packet.scope !== "species" || !packet.species) return;
        const userId = viewer.userId;
        if (isGreeting) {
            if (userId && visitorNotes.length > 0) void markAskVisitorNotesDelivered(userId, visitorNotes, answer);
            return;
        }
        if (!userId) return;
        const work: Promise<unknown>[] = [];
        if (personalise) {
            work.push(rememberAskTurn({
                userId,
                existing: memory,
                animalName: packet.species.name,
                speciesProfileId: speciesId,
                userMessage: question ?? "",
                answer,
                journey: ownerSpeciesId ? {speciesProfileId: ownerSpeciesId} : null,
                allowFollowUp: Boolean(ownerSpeciesId) && followUpsOn
            }));
        }
        if (relayThisTurn && card && speciesId) {
            work.push(saveAskVisitorNote({
                visitorId: userId,
                ownerId: card.ownerId,
                ownerName,
                speciesProfileId: speciesId,
                captureId: subject.captureId,
                animalName: packet.species.name,
                visitorMessage: question ?? "",
                answer
            }));
        }
        if (visitorNotes.length > 0) work.push(markAskVisitorNotesDelivered(userId, visitorNotes, answer));
        if (ownerSpeciesId) work.push(recordAskCompanionDay(userId, ownerSpeciesId, question ?? ""));
        if (speciesId) work.push(recordAskTalkDay(userId, speciesId));
        if (dueFollowUp) work.push(markAskFollowUpRaised(userId, dueFollowUp.id));
        void Promise.allSettled(work);
    };
    /** A story of its own life it told in this reply: kept with the owner's animal of this species. */
    const rememberStory = (story: string | null) => {
        if (!story || !speciesId || !animalOwnerId || !packet.species) return;
        void saveAskOwnStory({ownerId: animalOwnerId, speciesProfileId: speciesId, animalName: packet.species.name, story});
    };

    const personaFrame: {persona?: AskPersonaFrame} = persona && companion
        ? {persona: askPersonaFrame(companion.voice, persona)}
        : {};
    // Greetings think at low effort, as in the apps; replies at the animal's own,
    // capped (medium unless ANIMAL_CHAT_MAX_EFFORT says otherwise).
    const effort: AskChatEffort = isGreeting ? "low" : capAskEffort(persona?.effort ?? "low", askChatMaxEffort());
    const call = isCall
        ? askCallTurn({
            viewer,
            speciesProfileId: companion?.speciesProfileId ?? null,
            animalName: packet.species?.name ?? "",
            stats: companion?.stats ?? null,
            dials: persona,
            pace: companion?.voice.pace ?? null,
            signal: request.signal
        })
        : null;

    const supportedVisuals = askSupportedVisuals(packet.hasReaderPhoto);
    const promptOptions = {
        scope: packet.scope,
        supportedVisuals,
        languageName,
        aboutTrial,
        voice: companion?.voice ?? null,
        animalName: packet.species?.name ?? null,
        mode,
        speakingTo: isVisit ? "visitor" as const : "owner" as const,
        visitorRelay: relayOn,
        nature,
        nickname: card?.nickname ?? null,
        stories: speaksAsAnimal,
        suggestSteps: viewer.signedIn ? settings.suggestSteps : true,
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
        ? {
            greeting: true,
            conversation_mode: mode,
            signed_in: viewer.signedIn,
            has_wild_profile: wildProfile.hasWildProfile,
            ...personaFrame,
            ...bondFrame
        }
        : {
            remaining: rate?.remaining,
            limit: rate?.limit,
            signed_in: viewer.signedIn,
            is_pro: rate?.isPro,
            has_wild_profile: wildProfile.hasWildProfile,
            conversation_mode: mode,
            ...(rate?.resetsAt ? {resets_at: rate.resetsAt} : {}),
            ...(rate?.paidWith
                ? {paid_with: rate.paidWith, credit_cost: rate.creditCost, credit_balance: rate.creditBalance}
                : {}),
            // Lets the client offer credits as soon as the last free message is
            // spent, instead of after a refused one.
            ...(rate?.creditOverflow ? {credit_overflow: rate.creditOverflow} : {}),
            // The check-in this reply raised, for its Done / Not now / Stop asking.
            ...(dueFollowUp ? {follow_up: {id: dueFollowUp.id, topic: dueFollowUp.topic}} : {}),
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
    /** A one-piece answer, with the notice the stream would have led with. */
    const shownWhole = (answer: string) => visitorNotice ? answerWithAskVisitorNotice(answer, visitorNotice, "lead") : answer;

    // The one-piece answer, asked for by a client whose stream was cut off
    // mid-answer. A different request shape, which often survives what killed
    // the stream — a buffering proxy, an SSE-hostile network — and returns the
    // whole answer or nothing, so the reader is never left with half of one.
    if (body.mode === "complete" && !isGreeting) {
        try {
            const whole = await oneShot();
            if (whole?.answer.trim()) {
                afterAnswer(whole.answer);
                rememberStory(cleanAskOwnStory(whole.ownStory));
                return askJson({answer: shownWhole(whole.answer), follow_up_prompts: whole.followUps, ...closing});
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
        ? fallbackAskGreeting({
            animalName: packet.species.name,
            voice: companion?.voice ?? null,
            nickname: isVisit ? null : card?.nickname ?? null,
            ownerName: isVisit ? ownerName || null : null
        })
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
    const sourceFor = (provider: AskProviderName): AnswerDeltaSource | null => {
        const params = {systemPrompt: streamingSystemPrompt, userPrompt, history: historyTurns, effort, signal: request.signal};
        const source = call ? call.source(provider, params) : askAnswerSource(provider, params);
        if (!source || !visitorNotice) return source;
        // The visitor is told once: at the end of a hello, at the start of a reply.
        return withAskVisitorNotice(source, visitorNotice, isGreeting ? "tail" : "lead");
    };

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
            // A call speaks the answer as it arrives, in this stream.
            const speaker = call?.speaker(send) ?? null;

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
                    speaker?.hear(visible.slice(emitted));
                    emitted = visible.length;
                }
            });

            const finish = async () => {
                // The story line and the companion lines come out before the
                // follow-ups are read, so they are never shown and never
                // become chips.
                const told = extractAskOwnStory(full);
                const hidden = extractCompanionLines(told.raw);
                const split = splitStreamedReply(hidden.raw);
                if (split.answer.length > emitted) {
                    send({delta: split.answer.slice(emitted)});
                    speaker?.hear(split.answer.slice(emitted));
                }
                const companionFields = split.answer.trim() && onCompanion
                    ? await onCompanion(hidden.lines).catch(() => ({}))
                    : {};
                // On a call, `done` waits until all of it has been spoken.
                await speaker?.finish();
                send({done: true, follow_up_prompts: split.followUps, ...closing, ...companionFields});
                if (split.answer.trim()) {
                    afterAnswer(split.answer);
                    rememberStory(told.story);
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
                const hello = visitorNotice ? answerWithAskVisitorNotice(fixedGreeting.text, visitorNotice, "tail") : fixedGreeting.text;
                full = `${hello}\n${ASK_FOLLOW_UP_SENTINEL}\n${fixedGreeting.followUps.join("\n")}`;
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
                    send({delta: shownWhole(whole.answer)});
                    speaker?.hear(shownWhole(whole.answer));
                    await speaker?.finish();
                    send({done: true, follow_up_prompts: whole.followUps, ...closing});
                    afterAnswer(whole.answer);
                    rememberStory(cleanAskOwnStory(whole.ownStory));
                    controller.close();
                    return;
                }
            } catch {
                // Falls through to the error event below.
            }

            console.error("[ask-animaldex] every provider failed", failures.join(" | "));
            // Nothing was produced, so the message goes back to the budget.
            await refund();
            speaker?.stop();
            send({error: "stream_failed", detail: failures[0] ?? "unknown"});
            controller.close();
        }
    });

    return new Response(responseStream, {status: 200, headers: STREAM_HEADERS});
}
