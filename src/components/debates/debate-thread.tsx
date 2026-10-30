"use client";

/**
 * One debate as the person watches it (docs/debates/SPEC.md, sections 1.3
 * to 1.6): its turns typing out one animal at a time, as group turns do,
 * with the species' icon art beside each; then the report band and "Try
 * {name}'s way"; in public, the votes. The same block in the chat thread
 * and on the debate's own page.
 *
 * The asker's chat runs a debate the server holds `debating`
 * (`/api/ask/debate`, the apps' own debate flow); every other view reads it.
 * Turns already said show at once (the stream's replays add any the read
 * had not); the report comes at the end of the stream, or is read until it
 * is in. Closing the chat mid-debate stops it there; the next look carries
 * it on from the next turn.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useAskGroupDirector} from "@/components/ask-animaldex/use-group-director";
import {usePrefersReducedMotion} from "@/components/ask-animaldex/use-reply-pacer";
import {parseAskGroupFrame} from "@/lib/ask-animaldex/group-thread";
import type {CompanionWords} from "@/lib/companion-bond";
import {
    decodeDebateReport,
    orderedDebateTurns,
    type Debate,
    type DebateParticipant,
    type DebatePhase,
    type DebateTurn
} from "@/lib/debates";
import {debateLine, debateProblemText, debateStatusText} from "@/lib/debate-words";
import {chooseDebateWay, fetchDebate, noteDebateChanged, useDebateUpdates} from "@/components/debates/use-debates";
import {DebateFaces, DebateReportBand, DebateTurnRow, DebateVotePanel, TypingDots} from "@/components/debates/debate-views";

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
export function useTryDebateWay(debate: Debate | null, words: CompanionWords, chat: {captureId: string | null; onOwnWay?: () => void} = {captureId: null}) {
    const router = useRouter();
    const [choosing, setChoosing] = useState<string | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [chosenId, setChosenId] = useState<string | null>(debate?.chosenParticipantId ?? null);
    useEffect(() => setChosenId(debate?.chosenParticipantId ?? null), [debate?.chosenParticipantId]);
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
            const choice = result.value;
            const captureId = choice.captureId
                ?? (choice.stepSource === "own_animal" && (participant.ownerIsMe || participant.isAskerOwned) ? participant.captureId : debate.hostCaptureId);
            if (!captureId) return;
            if (!choice.referralId && chat.captureId && captureId === chat.captureId && chat.onOwnWay) {
                chat.onOwnWay();
                return;
            }
            const query = choice.referralId ? `?referral=${encodeURIComponent(choice.referralId)}` : "?talk=1";
            router.push(`/app/capture/${encodeURIComponent(captureId)}${query}`);
        });
    }, [debate, choosing, router, words, chat]);
    return {tryWay, choosing, chosenId, problem};
}

export default function DebateThread({
    seed,
    words,
    typingLabel,
    run = false,
    signedIn = true,
    bleed = "-mx-4 px-4",
    locale,
    onApprove,
    chat
}: {
    seed: Debate;
    words: CompanionWords;
    typingLabel: string;
    /** The asker's own chat: it runs a debate still being argued. */
    run?: boolean;
    signedIn?: boolean;
    bleed?: string;
    locale?: string;
    /** A public debate waiting for its text to be approved: open the approval. */
    onApprove?: (debate: Debate) => void;
    /** Shown in this card's own chat: the host's own way is said here. */
    chat?: {captureId: string | null; onOwnWay?: () => void};
}) {
    const [debate, setDebate] = useState<Debate>(seed);
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
    const mounted = useRef(true);
    useEffect(() => () => {
        mounted.current = false;
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
        setDebate((current) => ({...current, ...next, participants: next.participants.length > 0 ? next.participants : current.participants}));
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
                if (fetched.report || (fetched.status !== "debating" && fetched.status !== "reporting")) {
                    apply(fetched);
                    noteDebateChanged(fetched);
                    return;
                }
                // Someone else's view of a debate still being argued: its new turns, as they are kept.
                if (!run) apply(fetched);
            }
        } finally {
            pollingRef.current = false;
            if (mounted.current) setWaitingReport(false);
        }
    }, [seed.id, apply, run]);

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
        if (written) setDebate((current) => ({...current, report: written}));
        // Where it stands now (the `done` frame carries only the status): the server's copy.
        const {debate: fetched} = await fetchDebate(seed.id);
        if (fetched && mounted.current) {
            apply(written && !fetched.report ? {...fetched, report: written} : fetched);
            noteDebateChanged(fetched);
        }
        const now = fetched ?? null;
        if (finished && !written && !now?.report) void waitForReport();
        else if (!finished && now && (now.status === "reporting")) void waitForReport();
    }, [seed.id, locale, director, apply, waitForReport, words]);

    // The asker's chat runs it once, while it is being argued; any other view reads it as it goes.
    useEffect(() => {
        if (debate.status !== "debating" && debate.status !== "reporting") return;
        if (run && debate.askerIsMe && debate.status === "debating" && !ranRef.current) {
            ranRef.current = true;
            void runDebate();
            return;
        }
        if (!streaming && !ranRef.current) void waitForReport();
    }, [run, debate.status, debate.askerIsMe, runDebate, streaming, waitForReport]);

    const tryWay = useTryDebateWay(debate, words, chat);
    const live = director.revealing;
    const waiting = director.waiting ?? (director.current && director.current !== live ? director.current : null);
    const participantFor = (participantId: string | null) => debate.participants.find((participant) => participant.id === participantId) ?? null;
    const talking = streaming || director.active;
    const status = useMemo(() => debateStatusText(debate, words), [debate, words]);

    return (
        <div className="flex flex-col gap-3" aria-live="polite">
            <div className={`${bleed} flex items-center gap-2.5 border-y border-white/[0.08] bg-white/[0.025] py-2.5`}>
                <DebateFaces debate={debate} size={24} />
                {/* Started, the setup is one line: "Luna, Pip and Bruno: private debate" (SPEC section 6). */}
                <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold leading-4 text-white">{debateLine(debate, words, locale)}</span>
                    <span className="block truncate text-[11px] font-semibold text-white/55">{status}</span>
                </span>
            </div>
            {shown.map((turn, index) => (
                <DebateTurnRow
                    key={`${turn.seat}-${turn.phase}-${index}`}
                    debate={debate}
                    participant={debate.participants.find((participant) => participant.seat === turn.seat) ?? null}
                    text={turn.text}
                />
            ))}
            {live ? (
                <DebateTurnRow debate={debate} participant={participantFor(live.captureId)} text={director.visibleText} live />
            ) : null}
            {waiting && talking ? (
                <DebateTurnRow debate={debate} participant={participantFor(waiting.captureId)} text="" typingLabel={typingLabel} />
            ) : null}
            {runProblem && !talking ? (
                <div className={`${bleed} flex flex-wrap items-center gap-3 border-y border-white/[0.08] py-3`}>
                    <p className="min-w-0 flex-1 text-xs leading-5 text-white/60">{runProblem}</p>
                    {debate.status === "debating" && debate.askerIsMe ? (
                        <button
                            type="button"
                            onClick={() => void runDebate()}
                            className="min-h-9 rounded-full border border-white/12 bg-white/[0.05] px-4 text-xs font-bold text-white hover:bg-white/10"
                        >
                            {words.debateWeb.tryAgain}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {debate.status === "approving" || debate.status === "drafting" ? (
                <div className={`${bleed} flex flex-col items-start gap-2 border-y border-white/[0.08] py-3`}>
                    <p className="text-sm text-white/70">{words.debateWeb.statusApproving}</p>
                    {onApprove && debate.askerIsMe ? (
                        <button
                            type="button"
                            onClick={() => onApprove(debate)}
                            className="min-h-10 rounded-full bg-primary-400 px-4 text-[13px] font-black text-black hover:bg-primary-300"
                        >
                            {words.debate.publicText}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {!talking && !debate.report && (waitingReport || debate.status === "reporting" || (debate.status === "debating" && shown.length > 0)) ? (
                <div className="flex items-center gap-2 text-xs text-white/55">
                    <TypingDots />
                    <span>{words.debateWeb.reportWriting}</span>
                </div>
            ) : null}
            {!talking ? (
                <DebateReportBand
                    debate={debate}
                    words={words}
                    bleed={bleed}
                    onTryWay={debate.askerIsMe ? tryWay.tryWay : undefined}
                    choosing={tryWay.choosing}
                    chosenId={tryWay.chosenId}
                    problem={tryWay.problem}
                />
            ) : null}
            {!talking && debate.visibility === "public" && (debate.status === "voting" || debate.status === "settled" || debate.status === "draw") ? (
                <DebateVotePanel debate={debate} words={words} signedIn={signedIn} bleed={bleed} onChange={(next) => apply(next, {turns: false})} />
            ) : null}
            {debate.status === "cancelled" ? (
                <p className="text-xs text-white/50">{debate.cancelReason === "not_public" ? words.debate.notPublic : words.debateWeb.problems.notFound}</p>
            ) : null}
        </div>
    );
}
