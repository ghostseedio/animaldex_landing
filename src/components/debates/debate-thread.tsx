"use client";

/**
 * One debate as the person watches it (docs/debates/SPEC.md, sections 1.3
 * to 1.6): its turns typing out one animal at a time, as group turns do;
 * then the report and "Try {name}'s way"; in public, the vote. The same block
 * in the chat thread and on the debate's own page.
 *
 * In the conversation's own shapes (docs/rich-chat/SPEC.md, sections 2.3 to
 * 2.5): each turn is the speaking animal's own messages, its icon art beside
 * the last bubble and its name and Power above the first; the report and the
 * vote are one special message from the host, and while the report is being
 * written, the host's typing bubble says so. No turn style, no phase labels,
 * no bands. Started from an offer in the chat, the offer's section has gone
 * quiet in place ("DEBATE" and who is in it); anywhere else the block opens
 * on that line as the host's own special message (`opening`).
 *
 * The asker's chat runs a debate the server holds `debating`
 * (`/api/ask/debate`, the apps' own debate flow); every other view reads it.
 * Turns already said show at once (the stream's replays add any the read
 * had not); the report comes at the end of the stream, or is read until it
 * is in. Closing the chat mid-debate stops it there; the next look carries
 * it on from the next turn.
 *
 * Debates v2 (docs/debates/V2.md; iOS e15b474b, 390e5c2a): a rated report
 * (fit bars, one Recommended, Why); for the asker before a way is chosen,
 * [I solved it my way] (in the chat's message bar, `onEdit`) and [Ask more
 * animals], whose new animals then argue here; Ask the public under a
 * finished private report; and, for anyone who could vote on a debate asked
 * in public, [Add one of your animals].
 */

import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useAskGroupDirector} from "@/components/ask-animaldex/use-group-director";
import {usePrefersReducedMotion} from "@/components/ask-animaldex/use-reply-pacer";
import {parseAskGroupFrame} from "@/lib/ask-animaldex/group-thread";
import type {CompanionWords} from "@/lib/companion-bond";
import {
    DEBATE_MIN_SOLUTION,
    DEBATE_PROBLEM_MAX,
    DEBATE_PUBLIC_TEXT_MAX,
    debateAskPublicStage,
    debateCanOfferAnimal,
    debateOffersAskMore,
    debateOffersSolve,
    decodeDebateReport,
    mergeDebate,
    orderedDebateTurns,
    type Debate,
    type DebateParticipant,
    type DebatePhase,
    type DebateQuality,
    type DebateTurn
} from "@/lib/debates";
import {debateProblemText} from "@/lib/debate-words";
import {chooseDebateWay, fetchDebate, loadTopQualities, noteDebateChanged, useDebateUpdates} from "@/components/debates/use-debates";
import {refreshCompanionLoop} from "@/components/companions/use-steps";
import {useDebateV2} from "@/components/debates/use-debate-v2";
import type {DebateEdit} from "@/components/debates/debate-sheet";
import {AskSpecialBubble, AskTypingBubble} from "@/components/ask-animaldex/ask-messenger";
import {debateFaceUrl, DebateQuietSection, DebateReportSections, DebateTurnMessage} from "@/components/debates/debate-views";
import {DebateAskMoreSection, DebateAskPublicSection, DebateJudgingSection, DebateOfferAnimalSection, DebateSolutionSection} from "@/components/debates/debate-v2-views";

export {DebateQuietSection};

/** Reads an SSE body frame by frame. */
async function readFrames(body: ReadableStream<Uint8Array>, onFrame: (frame: Record<string, unknown>) => void) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true}).replace(/\r\n/g, "\n");
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
            const line = frame.split("\n").find((candidate) => candidate.startsWith("data:"));
            const payload = line?.slice(5).trim();
            if (!payload) continue;
            try {
                onFrame(JSON.parse(payload) as Record<string, unknown>);
            } catch {
                // A frame that cannot be parsed is skipped.
            }
        }
    }
}

const REPORT_POLL_MS = 3000;
const REPORT_POLLS = 60;

function phaseOf(raw: unknown): DebatePhase {
    return raw === "react" ? "react" : raw === "close" || raw === "seal" ? "close" : "open";
}

/** Each animal says each phase once: the server's turns, with any shown here that it does not have yet. */
function mergeTurns(server: DebateTurn[], shown: DebateTurn[]): DebateTurn[] {
    const key = (turn: DebateTurn) => `${turn.seat}:${turn.phase}`;
    const known = new Set(server.map(key));
    return orderedDebateTurns([...server, ...shown.filter((turn) => !known.has(key(turn)))]);
}

function withTurn(current: DebateTurn[], turn: DebateTurn): DebateTurn[] {
    return current.some((item) => item.seat === turn.seat && item.phase === turn.phase) ? current : [...current, turn];
}

/**
 * "Try {name}'s way": the asker's private choice (never a vote), then the
 * chat that sets the step, with the problem already known (SERVER.md,
 * `choose_debate_way_v1`): their own card of that animal with its referral,
 * or the host's with a referral to turn another person's way into their
 * step. The host's own way needs no referral: inside the host's chat the
 * choice is said there as their message (`onOwnWay`); anywhere else the
 * host's chat opens.
 */
export type DebateThreadChat = {
    captureId: string | null;
    onOwnWay?: () => void;
    /** The Companions tab's chat (2026-11-07): the way's chat opens in place, on its referral; true once it did. */
    onOpenAnimal?: (target: {speciesProfileId: string | null; captureId: string | null}, referralId: string | null) => boolean;
};

export function useTryDebateWay(debate: Debate | null, words: CompanionWords, chat: DebateThreadChat = {captureId: null}) {
    const router = useRouter();
    const [choosing, setChoosing] = useState<string | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [chosenId, setChosenId] = useState<string | null>(debate?.chosenParticipantId ?? null);
    useEffect(() => setChosenId(debate?.chosenParticipantId ?? null), [debate?.chosenParticipantId]);
    // V2: what the way they chose adds to their qualities, shown under it.
    const [qualities, setQualities] = useState<DebateQuality[]>([]);
    const tryWay = useCallback((participant: DebateParticipant) => {
        if (!debate || choosing) return;
        setChoosing(participant.id);
        setProblem(null);
        void chooseDebateWay(debate.id, participant.id).then((result) => {
            setChoosing(null);
            if (!result.ok) {
                setProblem(debateProblemText(result.code, words));
                return;
            }
            setChosenId(participant.id);
            if (participant.speciesProfileId) void loadTopQualities(participant.speciesProfileId).then(setQualities);
            const choice = result.value;
            // Every surface holding this debate keeps the choice (a list row never carries it).
            noteDebateChanged({...debate, chosenParticipantId: participant.id});
            // The server set the step from this way on the animal it belongs to, replacing that
            // animal's old open step: read the loops of the chosen animal (when it is theirs)
            // and the host again, so the old step stops showing as the active one and the new
            // one shows "I'll do it" (owner, 2026-11-09).
            const host = debate.participants.find((item) => item.seat === 0) ?? null;
            const chosenSpecies = choice.speciesProfileId
                ?? (participant.isAskerOwned || participant.ownerIsMe ? participant.speciesProfileId : null);
            for (const species of Array.from(new Set([chosenSpecies, host?.speciesProfileId ?? null]))) void refreshCompanionLoop(species);
            const captureId = choice.captureId
                ?? (choice.stepSource === "own_animal" && (participant.ownerIsMe || participant.isAskerOwned) ? participant.captureId : debate.hostCaptureId);
            if (!captureId) return;
            if (!choice.referralId && chat.captureId && captureId === chat.captureId && chat.onOwnWay) {
                chat.onOwnWay();
                return;
            }
            if (choice.referralId && chat.onOpenAnimal?.({speciesProfileId: participant.speciesProfileId ?? null, captureId}, choice.referralId)) return;
            const query = choice.referralId ? `?referral=${encodeURIComponent(choice.referralId)}` : "?talk=1";
            router.push(`/app/capture/${encodeURIComponent(captureId)}${query}`);
        });
    }, [debate, choosing, router, words, chat]);
    return {tryWay, choosing, chosenId, problem, qualities};
}

export default function DebateThread({
    seed,
    words,
    typingLabel,
    run = false,
    signedIn = true,
    locale,
    onApprove,
    chat,
    hostFaceUrl = null,
    opening = true,
    onEdit
}: {
    seed: Debate;
    words: CompanionWords;
    typingLabel: string;
    /** The asker's own chat: it runs a debate still being argued. */
    run?: boolean;
    signedIn?: boolean;
    locale?: string;
    /** A public debate waiting for its text to be approved: open the approval. */
    onApprove?: (debate: Debate) => void;
    /** Shown in this card's own chat: the host's own way is said here. */
    chat?: DebateThreadChat;
    /** The host's face for its special messages (its species icon art); else the host's seat's. */
    hostFaceUrl?: string | null;
    /** Opens on "DEBATE" and who is in it, as the host's own message (false: the offer's section already says it). */
    opening?: boolean;
    /** The chat's message bar edit mode: "I solved it my way" and Ask the public's Edit are written there. */
    onEdit?: (edit: DebateEdit) => void;
}) {
    const [debate, setDebate] = useState<Debate>(seed);
    const debateRef = useRef(debate);
    debateRef.current = debate;
    const [shown, setShown] = useState<DebateTurn[]>(() => orderedDebateTurns(seed.turns));
    /** The stream's phase for each frame index (the group parser reads only its own phases). */
    const phasesRef = useRef(new Map<number, DebatePhase>());
    /** Why the last run could not go on, in words, with a way to try again. */
    const [runProblem, setRunProblem] = useState<string | null>(null);
    const [streaming, setStreaming] = useState(false);
    const [waitingReport, setWaitingReport] = useState(false);
    const reducedMotion = usePrefersReducedMotion();
    const ranRef = useRef(false);
    const pollingRef = useRef(false);
    /** This view runs the turns: the asker's chat, or here after Ask more animals. */
    const [runs, setRuns] = useState(run);
    /** After Ask more animals, the report on show until the new one replaces it (its JSON). */
    const staleReportRef = useRef<string | null>(null);
    const reportIsNew = (report: Debate["report"]) => Boolean(report) && JSON.stringify(report) !== staleReportRef.current;
    const mounted = useRef(true);
    // Set again on every mount: React's development double mount runs the cleanup once in between.
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // The stream names each animal by its participant id (never by card).
    const seatOf = useCallback((participantId: string) => debate.participants.find((participant) => participant.id === participantId)?.seat ?? 0, [debate.participants]);
    const director = useAskGroupDirector({
        instant: reducedMotion,
        onTurnShown: (turn, text) => {
            if (!text) return;
            const said: DebateTurn = {seat: seatOf(turn.captureId), phase: phasesRef.current.get(turn.index) ?? phaseOf(turn.phase), text, createdAt: new Date().toISOString(), index: null};
            setShown((current) => withTurn(current, said));
        }
    });

    /** The server's copy: its turns win once nothing is typing out. */
    const apply = useCallback((next: Debate, opts: {turns?: boolean} = {}) => {
        setDebate((current) => mergeDebate(current, next));
        if (opts.turns !== false && next.turns.length > 0) {
            setShown((current) => mergeTurns(next.turns, current));
        }
    }, []);
    useDebateUpdates(seed.id, useCallback((next: Debate) => apply(next, {turns: !streaming}), [apply, streaming]));

    // The whole debate, as the reader may see it.
    useEffect(() => {
        let cancelled = false;
        void fetchDebate(seed.id).then(({debate: fetched}) => {
            if (!cancelled && fetched) apply(fetched);
        });
        return () => {
            cancelled = true;
        };
    }, [seed.id, apply]);

    /** The report is written once the animals have closed: read until it is in. */
    const waitForReport = useCallback(async () => {
        if (pollingRef.current) return;
        pollingRef.current = true;
        setWaitingReport(true);
        try {
            for (let attempt = 0; attempt < REPORT_POLLS && mounted.current; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, REPORT_POLL_MS));
                const {debate: fetched} = await fetchDebate(seed.id);
                if (!fetched) continue;
                if (reportIsNew(fetched.report) || (fetched.status !== "debating" && fetched.status !== "reporting")) {
                    staleReportRef.current = null;
                    apply(fetched);
                    noteDebateChanged(fetched);
                    return;
                }
                // Someone else's view of a debate still being argued: its new turns, as they are kept.
                if (!runs) apply(fetched);
            }
        } finally {
            pollingRef.current = false;
            if (mounted.current) setWaitingReport(false);
        }
    }, [seed.id, apply, runs]);

    const runDebate = useCallback(async () => {
        setStreaming(true);
        setRunProblem(null);
        director.beginRound();
        phasesRef.current = new Map();
        let finished = false;
        let report: Debate["report"] = null;
        // Turns already said come back first, whole (`replay`): straight into the thread.
        const replays = new Map<number, {seat: number; phase: DebatePhase; text: string}>();
        try {
            const response = await fetch("/api/ask/debate", {
                method: "POST",
                headers: {"Content-Type": "application/json", Accept: "text/event-stream"},
                body: JSON.stringify({debateId: seed.id, locale})
            });
            if (!response.ok || !response.body || !(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
                const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
                const code = typeof payload?.error === "string" ? payload.error : "";
                // Not ready, cancelled (too personal to post, among others) or gone: the debate as it stands says so.
                if (!["debate_not_ready", "debate_cancelled", "debate_not_public", "debate_not_found"].includes(code)) {
                    setRunProblem(debateProblemText(code === "debates_off" ? "debates_off" : null, words));
                }
            } else {
                await readFrames(response.body, (frame) => {
                    if (frame.done === true) {
                        finished = true;
                        return;
                    }
                    if (frame.report && typeof frame.report === "object") {
                        report = decodeDebateReport(frame.report);
                        return;
                    }
                    const turn = frame.turn && typeof frame.turn === "object" ? frame.turn as Record<string, unknown> : null;
                    if (turn && typeof turn.index === "number") {
                        const phase = phaseOf(turn.phase);
                        phasesRef.current.set(turn.index, phase);
                        if (turn.replay === true) {
                            replays.set(turn.index, {seat: typeof turn.seat === "number" ? turn.seat : 0, phase, text: ""});
                            return;
                        }
                    }
                    const replayIndex = typeof frame.turn_index === "number" ? frame.turn_index : null;
                    const replay = replayIndex === null ? undefined : replays.get(replayIndex);
                    if (replay) {
                        if (typeof frame.delta === "string") replay.text += frame.delta;
                        if (frame.participant_done === true && replay.text.trim()) {
                            const said: DebateTurn = {seat: replay.seat, phase: replay.phase, text: replay.text.trim(), createdAt: null, index: replayIndex};
                            setShown((current) => withTurn(current, said));
                        }
                        return;
                    }
                    const event = parseAskGroupFrame(frame);
                    if (!event) return;
                    switch (event.kind) {
                        case "turnStarted":
                            director.turnStarted(event.start);
                            break;
                        case "turnDelta":
                            director.received(event.index, event.text);
                            break;
                        case "turnDone":
                            director.turnDone(event.index, false);
                            break;
                        case "turnFailed":
                            director.turnFailed(event.index);
                            break;
                        default:
                            break;
                    }
                });
            }
        } catch {
            // Cut off: the debate as saved fills in what was not shown.
        } finally {
            director.streamFinished();
        }
        if (!mounted.current) return;
        setStreaming(false);
        const written = report as Debate["report"];
        if (written) {
            staleReportRef.current = null;
            setDebate((current) => ({...current, report: written}));
        }
        // Where it stands now (the `done` frame carries only the status): the server's copy.
        const {debate: fetched} = await fetchDebate(seed.id);
        if (fetched && mounted.current) {
            apply(written && !reportIsNew(fetched.report) ? {...fetched, report: written} : fetched);
            noteDebateChanged(fetched);
        }
        const now = fetched ?? null;
        if (!written && (now?.status === "reporting" || (finished && !reportIsNew(now?.report ?? null)))) void waitForReport();
    }, [seed.id, locale, director, apply, waitForReport, words]);

    // The asker's chat runs it once, while it is being argued; any other view reads it as it goes.
    useEffect(() => {
        if (debate.status !== "debating" && debate.status !== "reporting") return;
        if (runs && debate.askerIsMe && debate.status === "debating" && !ranRef.current) {
            ranRef.current = true;
            void runDebate();
            return;
        }
        if (!streaming && !ranRef.current) void waitForReport();
    }, [runs, debate.status, debate.askerIsMe, runDebate, streaming, waitForReport]);

    const tryWay = useTryDebateWay(debate, words, chat);
    // V2: Ask more animals brings them into this debate, and the turns run here, then the report again.
    const v2 = useDebateV2({
        debate,
        words,
        locale,
        apply: useCallback((next: Debate) => apply(next, {turns: false}), [apply]),
        onExtended: useCallback((extended: Debate) => {
            const before = extended.report ?? debateRef.current.report;
            staleReportRef.current = before ? JSON.stringify(before) : null;
            ranRef.current = false;
            setRuns(true);
            apply(extended);
        }, [apply])
    });
    const live = director.revealing;
    const waiting = director.waiting ?? (director.current && director.current !== live ? director.current : null);
    const participantFor = (participantId: string | null) => debate.participants.find((participant) => participant.id === participantId) ?? null;
    const talking = streaming || director.active;
    const hostFace = hostFaceUrl ?? debateFaceUrl(debate.participants.find((participant) => participant.seat === 0) ?? debate.participants[0] ?? null);
    // After Ask more animals the report on show is the old one, until the new one is written.
    const shownReport = debate.report && reportIsNew(debate.report) ? debate.report : null;
    const writingReport = !talking && !shownReport && (waitingReport || debate.status === "reporting" || (debate.status === "debating" && shown.length > 0));
    const reportDebate = shownReport === debate.report ? debate : {...debate, report: shownReport};
    const askPublicStage = !talking && !v2.askMore.picking ? debateAskPublicStage(debate) : null;
    const offersSolve = Boolean(onEdit) && debateOffersSolve(debate) && !v2.solve.working;
    const offersAskMore = debateOffersAskMore(debate) && !v2.askMore.picking && !talking;
    const solveEdit = () => onEdit?.({
        kind: "solution",
        text: "",
        min: DEBATE_MIN_SOLUTION,
        max: DEBATE_PROBLEM_MAX,
        strip: words.debate.solvedTitle,
        placeholder: words.debate.solvedPlaceholder,
        sendLabel: words.debate.solvedSend,
        save: (text) => void v2.solve.send(text)
    });
    const publicEdit = onEdit ? () => onEdit({
        kind: "public",
        text: v2.askPublic.draft,
        min: 10,
        max: DEBATE_PUBLIC_TEXT_MAX,
        save: (text) => v2.askPublic.setDraft(text.slice(0, DEBATE_PUBLIC_TEXT_MAX))
    }) : undefined;
    const votes = debate.visibility === "public" && (debate.status === "voting" || debate.status === "settled" || debate.status === "draw");
    const hostMessage = (children: React.ReactNode, testId?: string) => (
        <div className="pt-3.5">
            <AskSpecialBubble avatarUrl={hostFace} testId={testId}>{children}</AskSpecialBubble>
        </div>
    );

    return (
        <div className="flex flex-col" aria-live="polite" data-testid="debate-block">
            {opening ? (
                <AskSpecialBubble avatarUrl={hostFace} testId="debate-opening">
                    <DebateQuietSection debate={debate} words={words} locale={locale} />
                </AskSpecialBubble>
            ) : null}
            {shown.map((turn, index) => (
                <div key={`${turn.seat}-${turn.phase}-${index}`} className={index === 0 && !opening ? "" : "pt-3.5"}>
                    <DebateTurnMessage
                        participant={debate.participants.find((participant) => participant.seat === turn.seat) ?? null}
                        text={turn.text}
                        words={words}
                    />
                </div>
            ))}
            {live ? (
                <div className="pt-3.5">
                    <DebateTurnMessage participant={participantFor(live.captureId)} text={director.visibleText} live onSkip={director.skipCurrent} words={words} />
                </div>
            ) : null}
            {waiting && talking ? (
                <div className="pt-3.5">
                    <DebateTurnMessage participant={participantFor(waiting.captureId)} text="" typingLabel={typingLabel} />
                </div>
            ) : null}
            {runProblem && !talking ? hostMessage(
                <div className="flex flex-col items-start gap-2">
                    <p className="text-[13px] leading-5 text-white/70">{runProblem}</p>
                    {debate.status === "debating" && debate.askerIsMe ? (
                        <button
                            type="button"
                            onClick={() => void runDebate()}
                            className="inline-flex min-h-9 items-center rounded-full border border-white/12 bg-white/[0.07] px-[14px] text-xs font-bold text-white hover:bg-white/10 active:bg-white/15"
                        >
                            {words.debateWeb.tryAgain}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {/* A v1 public debate waiting for its text (one asked in public says so under its report). */}
            {(debate.status === "approving" || debate.status === "drafting") && !debate.askedPublic ? hostMessage(
                <div className="flex flex-col items-start gap-2">
                    <p className="text-[13px] leading-5 text-white/70">{words.debateWeb.statusApproving}</p>
                    {onApprove && debate.askerIsMe ? (
                        <button
                            type="button"
                            onClick={() => onApprove(debate)}
                            className="inline-flex min-h-9 items-center rounded-full bg-primary-400 px-[14px] text-xs font-black text-black hover:bg-primary-300 active:bg-primary-500"
                        >
                            {words.debate.publicText}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {writingReport ? (
                // The host's typing bubble, captioned: the report is the app's writer's, not the animal speaking.
                <div className="flex flex-col gap-1 pt-3.5" data-testid="debate-report-writing">
                    <AskTypingBubble avatarUrl={hostFace} label={words.debate.writingReport} />
                    <p className="pl-9 text-[11px] font-semibold text-white/50">{words.debate.writingReport}</p>
                </div>
            ) : null}
            {!talking && (shownReport || votes) ? hostMessage(
                <DebateReportSections
                    debate={reportDebate}
                    words={words}
                    locale={locale}
                    onTryWay={debate.askerIsMe ? tryWay.tryWay : undefined}
                    choosing={tryWay.choosing}
                    chosenId={tryWay.chosenId}
                    problem={tryWay.problem ?? v2.solve.problem}
                    signedIn={signedIn}
                    onVoted={(next) => apply(next, {turns: false})}
                    qualities={tryWay.qualities}
                    // Once a way is chosen the report is settled: no more animals and no "my way" (owner, 2026-11-03).
                    onSolve={offersSolve && !tryWay.chosenId ? solveEdit : undefined}
                    onAskMore={offersAskMore && !tryWay.chosenId ? () => void v2.askMore.begin() : undefined}
                    sections={(
                        <>
                            {v2.askMore.picking ? (
                                <DebateAskMoreSection
                                    words={words}
                                    rows={v2.askMore.rows}
                                    picked={v2.askMore.picked}
                                    room={v2.askMore.room}
                                    loading={v2.askMore.loading}
                                    bringing={v2.askMore.bringing}
                                    problem={v2.askMore.problem}
                                    onToggle={v2.askMore.toggle}
                                    onBring={() => void v2.askMore.bring()}
                                    onCancel={v2.askMore.cancel}
                                />
                            ) : null}
                            {v2.solve.working ? <DebateJudgingSection words={words} /> : debate.solution ? (
                                <DebateSolutionSection debate={debate} solution={debate.solution} words={words} locale={locale} />
                            ) : null}
                            {askPublicStage ? (
                                <DebateAskPublicSection
                                    debate={debate}
                                    stage={askPublicStage}
                                    words={words}
                                    working={v2.askPublic.working}
                                    problem={v2.askPublic.problem}
                                    draft={v2.askPublic.draft}
                                    onDraft={v2.askPublic.setDraft}
                                    onAsk={() => void v2.askPublic.ask()}
                                    onPost={() => void v2.askPublic.post()}
                                    onKeepPrivate={() => void v2.askPublic.keepPrivate()}
                                    onEdit={publicEdit}
                                />
                            ) : null}
                        </>
                    )}
                    closing={debateCanOfferAnimal(debate) || v2.offer.picking ? (
                        <DebateOfferAnimalSection
                            words={words}
                            picking={v2.offer.picking}
                            candidates={v2.offer.candidates}
                            loading={v2.offer.loading}
                            offeringId={v2.offer.offeringId}
                            problem={v2.offer.problem}
                            onBegin={() => void v2.offer.begin()}
                            onOffer={(candidate) => void v2.offer.offer(candidate)}
                            onCancel={v2.offer.cancel}
                        />
                    ) : null}
                />,
                "debate-report-message"
            ) : null}
            {debate.status === "cancelled" ? (
                <p className="pt-3 text-[12px] text-white/50">{debate.cancelReason === "not_public" ? words.debate.notPublic : words.debateWeb.problems.notFound}</p>
            ) : null}
        </div>
    );
}
