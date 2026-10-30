"use client";

/**
 * The parts every debate surface shares (docs/debates/SPEC.md, sections 1
 * and 4): an animal's face (its species' icon art, never a capture photo),
 * a turn, the report band with "Try {name}'s way", the vote panel, and a
 * debate's row in a list. Edge-to-edge bands, as everywhere in the app.
 */

import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AssistantMarkdown from "@/components/ask-animaldex/assistant-markdown";
import {AskAnimalFace, AskPlainBubbleText, AskSparkle, ASK_BUBBLE_INCOMING} from "@/components/ask-animaldex/ask-messenger";
import {askReplyPieces} from "@/lib/ask-animaldex/thread-layout";
import {ASK_GROUP_COLORS} from "@/lib/ask-animaldex/group-thread";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {
    debateAnimalName,
    debateVoteState,
    reportWayFor,
    type Debate,
    type DebateParticipant
} from "@/lib/debates";
import {debateCast, debateHeadline, debateProblemText, debateResultLines, debateStatusText, debateVotesText} from "@/lib/debate-words";
import {voteOnDebate, noteDebateChanged} from "@/components/debates/use-debates";

export function debateFaceUrl(participant: Pick<DebateParticipant, "slug"> | null | undefined): string | null {
    return participant?.slug ? getSpeciesImageRoute(participant.slug) : null;
}

/** Each animal's colour, by its seat: the host first. Never by card, which only its owner is sent. */
export function debateColor(participant: Pick<DebateParticipant, "seat"> | null | undefined): string {
    return participant ? ASK_GROUP_COLORS[Math.max(0, participant.seat) % ASK_GROUP_COLORS.length] : "rgb(var(--c-ink-300))";
}

/** The animals' faces, overlapping, each ringed in its colour. */
export function DebateFaces({debate, size = 26}: {debate: Debate; size?: number}) {
    return (
        <span className="flex shrink-0 items-center">
            {debate.participants.map((participant, index) => (
                <span
                    key={participant.id}
                    className="rounded-full bg-canvas-950"
                    style={{marginLeft: index === 0 ? 0 : -size * 0.3, boxShadow: `0 0 0 1.5px ${debateColor(participant)}cc`}}
                >
                    <AskAnimalFace url={debateFaceUrl(participant)} size={size} />
                </span>
            ))}
        </span>
    );
}

/** One animal's turn: its face in its colour, its name, then what it said, one bubble per thought. */
export function DebateTurnRow({debate, participant, text, live = false, typingLabel}: {
    debate: Debate;
    participant: DebateParticipant | null;
    text: string;
    live?: boolean;
    typingLabel?: string;
}) {
    const color = debateColor(participant);
    const pieces = askReplyPieces(text, !live).filter((piece) => piece.kind === "bubble");
    return (
        <div className="flex items-start gap-2">
            <span className="shrink-0 rounded-full" style={{boxShadow: `0 0 0 1.5px ${color}cc`}}>
                <AskAnimalFace url={debateFaceUrl(participant)} size={30} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[5px]">
                <span className="text-[11px] font-bold" style={{color}}>{participant ? debateAnimalName(participant) : ""}</span>
                {pieces.length === 0 ? (
                    <TypingDots label={typingLabel} />
                ) : (
                    <div className="flex min-w-0 flex-col items-start gap-[3px] pr-6">
                        {pieces.map((piece, index) => {
                            if (piece.kind !== "bubble") return null;
                            const top = index === 0 ? "19px" : "6px";
                            const bottom = index === pieces.length - 1 ? "19px" : "6px";
                            const sparkle = live && index === pieces.length - 1;
                            return (
                                <div
                                    key={index}
                                    className="min-w-0 max-w-full break-words px-3.5 py-2 text-[15px] leading-6 text-white"
                                    style={{backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: `${top} 19px 19px ${bottom}`}}
                                >
                                    {piece.isPlain ? (
                                        <AskPlainBubbleText text={piece.text} sparkle={sparkle} />
                                    ) : (
                                        <>
                                            <AssistantMarkdown compact text={piece.text} />
                                            {sparkle ? <AskSparkle /> : null}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function TypingDots({label}: {label?: string}) {
    return (
        <span
            role={label ? "status" : undefined}
            aria-label={label}
            className="flex h-[38px] w-[58px] items-center justify-center gap-[5px]"
            style={{backgroundColor: ASK_BUBBLE_INCOMING, borderRadius: "19px"}}
        >
            {[0, 1, 2].map((dot) => (
                <span key={dot} aria-hidden="true" className="ask-typing-dot h-[7px] w-[7px] rounded-full bg-white/75" style={{animationDelay: `${dot * 150}ms`}} />
            ))}
        </span>
    );
}

function ReportLine({label, text}: {label: string; text: string | null}) {
    if (!text) return null;
    return (
        <p className="text-[13px] leading-5 text-white/75">
            <span className="font-bold text-white/45">{label} · </span>
            {text}
        </p>
    );
}

/**
 * "Debate report": the problem in one line, each animal's way with the
 * lesson behind it, where it fits and what it costs, and what to try first.
 * It never picks a winner. The asker gets "Try {name}'s way" on each animal
 * (their private choice, never a vote); on an animal that is not theirs,
 * "Catch a {species} to earn its Power."
 */
export function DebateReportBand({debate, words, bleed = "-mx-4 px-4", onTryWay, choosing, chosenId, problem}: {
    debate: Debate;
    words: CompanionWords;
    /** The band's edge-to-edge margins in its column. */
    bleed?: string;
    /** The asker only. */
    onTryWay?: (participant: DebateParticipant) => void;
    choosing?: string | null;
    chosenId?: string | null;
    problem?: string | null;
}) {
    const report = debate.report;
    if (!report) return null;
    const web = words.debateWeb;
    return (
        <section aria-label={words.debate.reportTitle} className={`${bleed} border-y border-white/[0.08] bg-white/[0.025] py-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-200/85">{words.debate.reportTitle}</p>
            {report.problem ? <p className="mt-2 font-display text-lg font-black leading-6 text-white">{report.problem}</p> : null}
            <div className="mt-3 flex flex-col divide-y divide-white/[0.06]">
                {debate.participants.map((participant) => {
                    const way = reportWayFor(report, participant);
                    if (!way) return null;
                    const name = debateAnimalName(participant);
                    const color = debateColor(participant);
                    const chosen = chosenId === participant.id;
                    return (
                        <div key={participant.id} className="flex flex-col gap-1.5 py-3">
                            <div className="flex items-center gap-2">
                                <span className="shrink-0 rounded-full" style={{boxShadow: `0 0 0 1.5px ${color}cc`}}>
                                    <AskAnimalFace url={debateFaceUrl(participant)} size={26} />
                                </span>
                                <span className="text-sm font-bold" style={{color}}>{name}</span>
                                {participant.powerName ? <span className="min-w-0 truncate text-[11px] font-semibold text-white/40">{participant.powerName}</span> : null}
                            </div>
                            <p className="text-[15px] leading-6 text-white">{way.way}</p>
                            <ReportLine label={web.reportLesson} text={way.lesson} />
                            <ReportLine label={web.reportFits} text={way.fits} />
                            <ReportLine label={web.reportCosts} text={way.costs} />
                            {onTryWay ? (
                                <div className="mt-1.5 flex flex-col items-start gap-1">
                                    <button
                                        type="button"
                                        onClick={() => onTryWay(participant)}
                                        disabled={Boolean(choosing)}
                                        aria-pressed={chosen}
                                        className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13px] font-black transition-colors disabled:opacity-60 ${
                                            chosen ? "bg-white text-black" : "bg-primary-400 text-black hover:bg-primary-300"
                                        }`}
                                    >
                                        {choosing === participant.id ? web.choosing : fillWords(words.debate.tryWay, {name})}
                                    </button>
                                    {!participant.isAskerOwned && !participant.ownerIsMe ? (
                                        <span className="text-[11px] leading-4 text-white/50">{fillWords(words.debate.catchToEarn, {species: participant.animal})}</span>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            {report.tryFirst ? (
                <p className="mt-2 border-t border-white/[0.08] pt-3 text-sm leading-6 text-white/85">
                    <span className="font-bold text-primary-200">{web.reportTryFirst} · </span>
                    {report.tryFirst}
                </p>
            ) : null}
            {problem ? <p role="alert" className="mt-2 text-xs text-white/60">{problem}</p> : null}
        </section>
    );
}

/**
 * "Which animal has the best way for this?": one Vote per animal, the counts,
 * "You voted" on the one they chose, "You can't vote on a debate you're in"
 * for its people, and the result once it is settled.
 */
export function DebateVotePanel({debate, words, signedIn, bleed = "-mx-4 px-4", onChange}: {
    debate: Debate;
    words: CompanionWords;
    signedIn: boolean;
    bleed?: string;
    onChange?: (debate: Debate) => void;
}) {
    const [voting, setVoting] = useState<string | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    if (debate.visibility !== "public") return null;
    const state = debateVoteState(debate, signedIn);
    const results = debateResultLines(debate, words);
    const showsCounts = state.kind !== "vote" || debate.status !== "voting";

    const vote = (participant: DebateParticipant) => {
        if (voting) return;
        setVoting(participant.id);
        setProblem(null);
        void voteOnDebate(debate.id, participant.id).then((result) => {
            setVoting(null);
            if (!result.ok) {
                setProblem(debateProblemText(result.code, words));
                return;
            }
            const {votes, counts} = result.value;
            const next: Debate = {
                ...debate,
                myVote: participant.id,
                canVote: false,
                totalVotes: votes ?? (debate.totalVotes ?? 0) + 1,
                // The server's counts once they voted; else one more for theirs.
                participants: debate.participants.map((item) => ({
                    ...item,
                    votes: counts.get(item.id) ?? (item.id === participant.id ? (item.votes ?? 0) + 1 : item.votes)
                }))
            };
            onChange?.(next);
            noteDebateChanged(next);
        });
    };

    return (
        <section aria-label={words.debate.voteQuestion} className={`${bleed} border-y border-white/[0.08] py-4`}>
            <p className="text-sm font-black text-white">{words.debate.voteQuestion}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-white/45">
                {debateVotesText(debate.totalVotes, words)}
                {debate.status === "voting" && debate.rollovers > 0 ? ` · ${words.debate.rollover}` : ""}
            </p>
            <div className="mt-3 flex flex-col gap-2">
                {debate.participants.map((participant) => {
                    const name = debateAnimalName(participant);
                    const mine = state.kind === "voted" && state.participantId === participant.id;
                    const won = debate.status === "settled" && debate.winnerParticipantId === participant.id;
                    return (
                        <div key={participant.id} className="flex items-center gap-2.5">
                            <span className="shrink-0 rounded-full" style={{boxShadow: `0 0 0 1.5px ${debateColor(participant)}cc`}}>
                                <AskAnimalFace url={debateFaceUrl(participant)} size={28} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={`block truncate text-sm font-bold ${won ? "text-primary-200" : "text-white"}`}>{name}</span>
                                {mine ? <span className="block text-[11px] font-semibold text-primary-200">{words.debate.voted}</span> : null}
                            </span>
                            {/* Per-animal counts only once the server shows them (not to someone who could still be swayed). */}
                            {showsCounts && participant.votes !== null ? (
                                <span className="shrink-0 text-xs font-bold tabular-nums text-white/60">{participant.votes}</span>
                            ) : null}
                            {state.kind === "vote" ? (
                                <button
                                    type="button"
                                    onClick={() => vote(participant)}
                                    disabled={Boolean(voting)}
                                    aria-label={`${words.debate.vote}: ${name}`}
                                    className="min-h-9 shrink-0 rounded-full bg-primary-400 px-4 text-xs font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-60"
                                >
                                    {words.debate.vote}
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            {state.kind === "own" ? <p className="mt-3 text-xs leading-5 text-white/60">{words.debate.cantVoteOwn}</p> : null}
            {state.kind === "ineligible" ? <p className="mt-3 text-xs leading-5 text-white/60">{words.debateWeb.ineligible}</p> : null}
            {state.kind === "signIn" ? (
                <Link href="/account" className="mt-3 inline-flex min-h-9 items-center rounded-full bg-primary-400 px-4 text-xs font-black text-black">
                    {words.debateWeb.signInToVote}
                </Link>
            ) : null}
            {results.length > 0 ? (
                <div className="mt-3 flex flex-col gap-1">
                    {results.map((line) => <p key={line} className="text-sm font-bold text-white">{line}</p>)}
                </div>
            ) : null}
            {problem ? <p role="alert" className="mt-2 text-xs text-white/60">{problem}</p> : null}
        </section>
    );
}

/** A debate in a list: the faces, the problem, where it stands. Opens the debate. */
export function DebateRow({debate, words, href}: {debate: Debate; words: CompanionWords; href: string}) {
    const headline = debateHeadline(debate) || debateCast(debate);
    return (
        <Link href={href} className="-mx-5 flex items-center gap-3 border-b border-white/[0.06] px-5 py-3.5 transition-colors hover:bg-white/[0.03]">
            <DebateFaces debate={debate} size={28} />
            <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm font-semibold leading-5 text-white">{headline}</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/45">
                    {debate.visibility === "public" ? words.debate.public : words.debate.private}
                    {" · "}
                    {debateStatusText(debate, words)}
                </span>
            </span>
            <span aria-hidden="true" className="text-[11px] font-bold text-white/35">›</span>
        </Link>
    );
}
