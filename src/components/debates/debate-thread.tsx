"use client";

/**
 * One debate as the person watches it (docs/debates/SPEC.md, sections 1.3
 * to 1.6): its turns typing out one animal at a time, as group turns do,
 * with the species' icon art beside each; then the report band and "Try
 * {name}'s way"; in public, the votes. The same block in the chat thread
 * and on the debate's own page.
 *
 * The asker's chat runs a debate the server holds `debating`
 * (`/api/ask/debate`); every other view reads it. Turns already kept show at
 * once; the report is read until it is in. Closing the chat mid-debate
 * leaves it running: the next look shows it where it got to.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useAskGroupDirector} from "@/components/ask-animaldex/use-group-director";
import {usePrefersReducedMotion} from "@/components/ask-animaldex/use-reply-pacer";
import {parseAskGroupFrame} from "@/lib/ask-animaldex/group-thread";
import type {CompanionWords} from "@/lib/companion-bond";
import {
    decodeDebate,
    orderedDebateTurns,
    type Debate,
    type DebateParticipant,
    type DebatePhase,
    type DebateTurn
} from "@/lib/debates";
import {debateProblemText, debateStatusText} from "@/lib/debate-words";
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

/**
 * "Try {name}'s way": the asker's private choice (never a vote), then the
 * chat that sets the step, with the problem already known: their own card
 * of that animal, or the host's when the animal is someone else's.
 */
export function useTryDebateWay(debate: Debate | null, words: CompanionWords) {
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
            const query = choice.referralId ? `?referral=${encodeURIComponent(choice.referralId)}` : "?talk=1";
            router.push(`/app/capture/${encodeURIComponent(captureId)}${query}`);
        });
    }, [debate, choosing, router, words]);
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
    onApprove
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
}) {
    const [debate, setDebate] = useState<Debate>(seed);
    const [shown, setShown] = useState<DebateTurn[]>(() => orderedDebateTurns(seed.turns));
    const [streaming, setStreaming] = useState(false);
    const [waitingReport, setWaitingReport] = useState(false);
    const reducedMotion = usePrefersReducedMotion();
    const ranRef = useRef(false);
    const pollingRef = useRef(false);
    const mounted = useRef(true);
    useEffect(() => () => {
        mounted.current = false;
    }, []);

    const seatOf = useCallback((captureId: string) => debate.participants.find((participant) => participant.captureId === captureId)?.seat ?? 0, [debate.participants]);
    const director = useAskGroupDirector({
        instant: reducedMotion,
        onTurnShown: (turn, text) => {
            if (!text) return;
            setShown((current) => [...current, {seat: seatOf(turn.captureId), phase: phaseOf(turn.phase), text, createdAt: new Date().toISOString(), index: turn.index}]);
        }
    });

    /** The server's copy: its turns win once nothing is typing out. */
    const apply = useCallback((next: Debate, opts: {turns?: boolean} = {}) => {
        setDebate((current) => ({...current, ...next, participants: next.participants.length > 0 ? next.participants : current.participants}));
        if (opts.turns !== false && next.turns.length > 0) {
            setShown((current) => (next.turns.length >= current.length ? orderedDebateTurns(next.turns) : current));
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
        director.beginRound();
        let finished: Debate | null = null;
        try {
            const response = await fetch("/api/ask/debate", {
                method: "POST",
                headers: {"Content-Type": "application/json", Accept: "text/event-stream"},
                body: JSON.stringify({
                    debateId: seed.id,
                    locale,
                    utcOffsetMinutes: -new Date().getTimezoneOffset()
                })
            });
            if (!response.ok || !response.body || !(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
                const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
                finished = decodeDebate(payload?.debate);
            } else {
                await readFrames(response.body, (frame) => {
                    if (frame.done === true) {
                        finished = decodeDebate(frame.debate);
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
            // Cut off: the debate as kept fills in what was not shown.
        } finally {
            director.streamFinished();
        }
        if (!mounted.current) return;
        setStreaming(false);
        const done = finished as Debate | null;
        if (done) {
            apply(done, {turns: false});
            noteDebateChanged(done);
        }
        if (!done?.report) void waitForReport();
    }, [seed.id, locale, director, apply, waitForReport]);

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

    const tryWay = useTryDebateWay(debate, words);
    const live = director.revealing;
    const waiting = director.waiting ?? (director.current && director.current !== live ? director.current : null);
    const participantFor = (captureId: string | null) => debate.participants.find((participant) => participant.captureId === captureId) ?? null;
    const talking = streaming || director.active;
    const status = useMemo(() => debateStatusText(debate, words), [debate, words]);

    return (
        <div className="flex flex-col gap-3" aria-live="polite">
            <div className={`${bleed} flex items-center gap-2.5 border-y border-white/[0.08] bg-white/[0.025] py-2.5`}>
                <DebateFaces debate={debate} size={24} />
                <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-primary-200/85">
                        {debate.visibility === "public" ? words.debate.public : words.debate.private}
                    </span>
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
            {debate.status === "cancelled" ? <p className="text-xs text-white/50">{words.debateWeb.problems.notFound}</p> : null}
        </div>
    );
}
