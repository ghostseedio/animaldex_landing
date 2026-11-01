"use client";

/**
 * The parts every debate surface shares (docs/debates/SPEC.md, sections 1
 * and 4): an animal's face (its species' icon art, never a capture photo),
 * a turn, the report band with "Try {name}'s way", the vote panel, and a
 * debate's row in a list.
 *
 * Since 2026-10-31 (docs/rich-chat/SPEC.md, sections 2.3 to 2.5) a debate
 * is drawn in the conversation's own shapes: each turn is the speaking
 * animal's own messages (`DebateTurnMessage`), the setup gone quiet is
 * "DEBATE" and who is in it (`DebateQuietSection`), and the report and the
 * vote are sections of a special message from the host
 * (`DebateReportSections`, `DebateVoteSection`).
 */

import {useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AskAnimalFace, AskReplyBubbles, AskSpecialLabel, AskTypingBubble} from "@/components/ask-animaldex/ask-messenger";
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
import {debateCast, debateClosesIn, debateHeadline, debateLine, debateProblemText, debateResultLines, debateSpeakerLine, debateStatusText, debateVotesText} from "@/lib/debate-words";
import {debateIsOwnOnly} from "@/lib/debates";
import {voteOnDebate, noteDebateChanged} from "@/components/debates/use-debates";

export function debateFaceUrl(participant: Pick<DebateParticipant, "slug"> | null | undefined): string | null {
    return participant?.slug ? getSpeciesImageRoute(participant.slug) : null;
}

/**
 * Each animal's colour, by its seat: the host first. Never by card, which
 * only its owner is sent. Used on its name only, never on an edge, a ring or
 * a bubble (UX pass, DECISIONS section 2).
 */
export function debateColor(participant: Pick<DebateParticipant, "seat"> | null | undefined): string {
    return participant ? ASK_GROUP_COLORS[Math.max(0, participant.seat) % ASK_GROUP_COLORS.length] : "rgb(var(--c-ink-300))";
}

/** The animals' faces, overlapping, each set off from the next by the page's own colour. */
export function DebateFaces({debate, size = 26}: {debate: Debate; size?: number}) {
    return (
        <span className="flex shrink-0 items-center">
            {debate.participants.map((participant, index) => (
                <span
                    key={participant.id}
                    className="rounded-full bg-canvas-950"
                    style={{marginLeft: index === 0 ? 0 : -size * 0.3, boxShadow: "0 0 0 1.5px rgb(var(--c-canvas-950))"}}
                >
                    <AskAnimalFace url={debateFaceUrl(participant)} size={size} />
                </span>
            ))}
        </span>
    );
}

function ReportLine({label, text}: {label: string; text: string | null}) {
    if (!text) return null;
    return (
        <p className="text-[13px] leading-5 text-white/75">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-300">{label} · </span>
            {text}
        </p>
    );
}

/**
 * "Debate report": the problem in one line, each animal's way with the
 * lesson behind it, where it fits and what it costs, and what to try first.
 * It never picks a winner. The asker gets "Try {name}'s way" on each animal
 * (their private choice, never a vote); on an animal that is not theirs,
 * "Capture a {species} to earn its Power."
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
                                <AskAnimalFace url={debateFaceUrl(participant)} size={26} />
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
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-300">{web.reportTryFirst} · </span>
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
                            <span className="shrink-0 rounded-full">
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


// MARK: - In the conversation's own shapes (docs/rich-chat/SPEC.md, section 2)

/**
 * One animal's turn, drawn exactly as the host's replies are: its name and
 * Power above its first bubble, one bubble per thought typed out at its
 * pace, its species icon art beside the last; the three-dot bubble while it
 * finds its words. A tap shows the rest at once. No voice on debate turns.
 */
export function DebateTurnMessage({participant, text, live = false, typingLabel, onSkip}: {
    participant: DebateParticipant | null;
    text: string;
    live?: boolean;
    typingLabel?: string;
    onSkip?: () => void;
}) {
    const face = debateFaceUrl(participant);
    const name = participant ? debateAnimalName(participant) : "";
    return (
        <div className="flex flex-col" data-testid="debate-turn">
            {participant ? <p className="truncate pb-1 pl-9 text-[11px] font-semibold leading-4 text-ink-300">{debateSpeakerLine(participant)}</p> : null}
            {text ? (
                <AskReplyBubbles text={text} isLive={live} avatarUrl={face} speakerName={name} photoUrl={null} photoAlt="" onSkip={onSkip} />
            ) : (
                <AskTypingBubble avatarUrl={face} label={typingLabel ?? name} />
            )}
        </div>
    );
}

/** The setup gone quiet in place: "DEBATE", the faces, and "Luna, Pip and Bruno: private debate". */
export function DebateQuietSection({debate, words, locale}: {debate: Debate; words: CompanionWords; locale?: string}) {
    return (
        <section className="flex flex-col gap-2" aria-label={words.debate.quiet} data-testid="debate-quiet">
            <AskSpecialLabel icon={<GroupIcon />}>{words.debate.quiet}</AskSpecialLabel>
            <div className="flex items-center gap-2.5">
                <DebateFaces debate={debate} size={26} />
                <span className="min-w-0 text-[13px] font-semibold leading-5 text-white">{debateLine(debate, words, locale)}</span>
            </div>
            {debateIsOwnOnly(debate) ? <p className="text-[12px] leading-4 text-white/55" data-testid="debate-own-only">{words.debate.ownOnly}</p> : null}
        </section>
    );
}

/** The section's width, followed as it changes: the report becomes a table where the column is wide. */
function useWide(min: number) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [wide, setWide] = useState(false);
    useEffect(() => {
        const node = ref.current;
        if (!node || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => setWide(node.getBoundingClientRect().width >= min));
        observer.observe(node);
        return () => observer.disconnect();
    }, [min]);
    return {ref, wide};
}

/**
 * "DEBATE REPORT", a section of the host's special message (written by the
 * report writer, so no animal words above it): the problem in one bold
 * line; each animal's way (face, name and Power; "Its way:", the lesson,
 * "Fits when …", "Costs …"), as a table where the column is wide; "Try
 * first: …"; and for the asker a chip per animal, until a way is chosen:
 * then only "You chose {name}'s way", with how to earn its Power when the
 * animal is not theirs.
 */
export function DebateReportSections({debate, words, locale, onTryWay, choosing, chosenId, problem, signedIn = true, onVoted}: {
    debate: Debate;
    words: CompanionWords;
    locale?: string;
    onTryWay?: (participant: DebateParticipant) => void;
    choosing?: string | null;
    chosenId?: string | null;
    problem?: string | null;
    signedIn?: boolean;
    onVoted?: (debate: Debate) => void;
}) {
    const report = debate.report;
    // The reply column at 640 px or more (the Talk page): this section is that column less the face and the bubble's room.
    const {ref, wide} = useWide(500);
    const web = words.debateWeb;
    const ways = report
        ? debate.participants.map((participant) => ({participant, way: reportWayFor(report, participant)})).filter((entry) => entry.way !== null)
        : [];
    const chosen = chosenId ? debate.participants.find((participant) => participant.id === chosenId) ?? null : null;
    const header = (template: string) => fillWords(template, {text: ""}).replace(/[:\s]+$/, "");
    return (
        <div ref={ref} className="ask-special-stack flex flex-col">
            {report ? (
                <section className="flex flex-col gap-2.5" aria-label={words.debate.reportTitle} data-testid="debate-report">
                    <AskSpecialLabel icon={<ReportIcon />}>{words.debate.reportTitle}</AskSpecialLabel>
                    {report.problem ? <p className="text-[15px] font-bold leading-6 text-white">{report.problem}</p> : null}
                    {wide ? (
                        <div className="max-w-full overflow-x-auto" style={{borderRadius: 12, boxShadow: "inset 0 0 0 1px var(--ask-hairline)"}} data-testid="debate-report-table">
                            <table className="w-full border-collapse text-left text-[13px] leading-5">
                                <thead>
                                    <tr style={{backgroundColor: "var(--ask-panel)"}}>
                                        {[words.debate.reportAnimal, header(words.debate.itsWay), header(words.debate.fitsWhen), header(words.debate.costs)].map((title) => (
                                            <th key={title} scope="col" className="border-b px-3 py-2.5 font-bold text-white" style={{borderColor: "var(--ask-hairline)"}}>{title}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ways.map(({participant, way}, index) => (
                                        <tr key={participant.id} className="align-top">
                                            <td className={`min-w-[10rem] px-3 py-2.5 ${index > 0 ? "border-t" : ""}`} style={{borderColor: "var(--ask-hairline)"}}>
                                                <span className="flex items-center gap-2">
                                                    <AskAnimalFace url={debateFaceUrl(participant)} size={24} />
                                                    <span className="min-w-0">
                                                        <span className="block font-bold text-white">{debateAnimalName(participant)}</span>
                                                        {participant.powerName ? <span className="block text-[11px] text-white/50">{participant.powerName}</span> : null}
                                                    </span>
                                                </span>
                                            </td>
                                            <td className={`min-w-[12rem] px-3 py-2.5 text-white ${index > 0 ? "border-t" : ""}`} style={{borderColor: "var(--ask-hairline)"}}>
                                                {way?.way}
                                                {way?.lesson ? <span className="mt-1 block text-[12px] text-white/55">{way.lesson}</span> : null}
                                            </td>
                                            <td className={`min-w-[9rem] px-3 py-2.5 text-white/80 ${index > 0 ? "border-t" : ""}`} style={{borderColor: "var(--ask-hairline)"}}>{way?.fits}</td>
                                            <td className={`min-w-[9rem] px-3 py-2.5 text-white/80 ${index > 0 ? "border-t" : ""}`} style={{borderColor: "var(--ask-hairline)"}}>{way?.costs}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {ways.map(({participant, way}) => (
                                <div key={participant.id} className="flex flex-col gap-1" data-testid="debate-report-way">
                                    <div className="flex items-center gap-2">
                                        <AskAnimalFace url={debateFaceUrl(participant)} size={24} />
                                        <span className="text-[13px] font-bold text-white">{debateAnimalName(participant)}</span>
                                        {participant.powerName ? <span className="min-w-0 truncate text-[11px] font-semibold text-white/45">{participant.powerName}</span> : null}
                                    </div>
                                    <p className="text-[14px] leading-[22px] text-white"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-300">{words.debate.itsWay}</span> {way?.way}</p>
                                    {way?.lesson ? <p className="text-[13px] leading-5 text-white/70">{way.lesson}</p> : null}
                                    {way?.fits ? <p className="text-[13px] leading-5 text-white/70">{fillWords(words.debate.fitsWhen, {text: way.fits})}</p> : null}
                                    {way?.costs ? <p className="text-[13px] leading-5 text-white/70">{fillWords(words.debate.costs, {text: way.costs})}</p> : null}
                                </div>
                            ))}
                        </div>
                    )}
                    {report.tryFirst ? (
                        <p className="text-[14px] leading-[22px] text-white" data-testid="debate-try-first">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-300">{fillWords(words.debate.tryFirst, {text: ""}).trim()}</span>{" "}{report.tryFirst}
                        </p>
                    ) : null}
                    {onTryWay ? (
                        chosen ? (
                            <div className="flex flex-col gap-1" data-testid="debate-chosen">
                                <p className="text-[13px] font-semibold leading-5 text-white/70">{fillWords(words.debate.youChose, {name: debateAnimalName(chosen)})}</p>
                                {!chosen.isAskerOwned && !chosen.ownerIsMe ? (
                                    <p className="text-[12px] leading-4 text-white/50">{fillWords(words.debate.catchToEarn, {species: chosen.animal})}</p>
                                ) : null}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2" data-testid="debate-try-ways">
                                {ways.map(({participant}) => (
                                    <button
                                        key={participant.id}
                                        type="button"
                                        onClick={() => onTryWay(participant)}
                                        disabled={Boolean(choosing)}
                                        className="inline-flex min-h-9 items-center rounded-full bg-primary-400 px-[14px] text-xs font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-60"
                                    >
                                        {choosing === participant.id ? web.choosing : fillWords(words.debate.tryWay, {name: debateAnimalName(participant)})}
                                    </button>
                                ))}
                            </div>
                        )
                    ) : null}
                    {problem ? <p role="alert" className="text-[12px] text-white/60">{problem}</p> : null}
                </section>
            ) : null}
            {debate.visibility === "public" && (debate.status === "voting" || debate.status === "settled" || debate.status === "draw") ? (
                <DebateVoteSection debate={debate} words={words} locale={locale} signedIn={signedIn} onChange={onVoted} />
            ) : null}
        </div>
    );
}

/**
 * "COMMUNITY VOTE" (public only): the vote count, "Voting closes in …" or
 * the rollover line, and the result; for a reader who may vote, a Vote per
 * animal (the debate's own page). Never per-animal counts to someone who
 * could still be swayed.
 */
export function DebateVoteSection({debate, words, locale, signedIn, onChange}: {
    debate: Debate;
    words: CompanionWords;
    locale?: string;
    signedIn: boolean;
    onChange?: (debate: Debate) => void;
}) {
    const [voting, setVoting] = useState<string | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const state = debateVoteState(debate, signedIn);
    const results = debateResultLines(debate, words);
    const closesIn = debate.status === "voting" ? debateClosesIn(debate.votingDeadlineAt, words, locale) : null;
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
        <section className="flex flex-col gap-2" aria-label={words.debate.communityVote} data-testid="debate-vote">
            <AskSpecialLabel icon={<VoteIcon />}>{words.debate.communityVote}</AskSpecialLabel>
            <p className="text-[13px] font-semibold leading-5 text-white/70">
                {debateVotesText(debate.totalVotes, words)}
                {debate.status === "voting" ? ` · ${debate.rollovers > 0 ? words.debate.rollover : closesIn ?? words.debateWeb.statusVoting}` : ""}
            </p>
            {state.kind === "vote" || showsCounts ? (
                <div className="flex flex-col gap-1.5">
                    {debate.participants.map((participant) => {
                        const name = debateAnimalName(participant);
                        const mine = state.kind === "voted" && state.participantId === participant.id;
                        const won = debate.status === "settled" && debate.winnerParticipantId === participant.id;
                        return (
                            <div key={participant.id} className="flex items-center gap-2.5">
                                <AskAnimalFace url={debateFaceUrl(participant)} size={24} />
                                <span className="min-w-0 flex-1">
                                    <span className={`block truncate text-[13px] font-bold ${won ? "text-primary-200" : "text-white"}`}>{name}</span>
                                    {mine ? <span className="block text-[11px] font-semibold text-primary-200">{words.debate.voted}</span> : null}
                                </span>
                                {showsCounts && participant.votes !== null ? <span className="shrink-0 text-xs font-bold tabular-nums text-white/60">{participant.votes}</span> : null}
                                {state.kind === "vote" ? (
                                    <button
                                        type="button"
                                        onClick={() => vote(participant)}
                                        disabled={Boolean(voting)}
                                        aria-label={`${words.debate.vote}: ${name}`}
                                        className="min-h-8 shrink-0 rounded-full bg-primary-400 px-3.5 text-xs font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-60"
                                    >
                                        {words.debate.vote}
                                    </button>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
            {state.kind === "own" && !debate.askerIsMe ? <p className="text-[12px] leading-4 text-white/60">{words.debate.cantVoteOwn}</p> : null}
            {state.kind === "ineligible" ? <p className="text-[12px] leading-4 text-white/60">{words.debateWeb.ineligible}</p> : null}
            {state.kind === "signIn" ? (
                <Link href="/account" className="inline-flex min-h-8 items-center self-start rounded-full bg-primary-400 px-3.5 text-xs font-black text-black">
                    {words.debateWeb.signInToVote}
                </Link>
            ) : null}
            {results.length > 0 ? results.map((line) => <p key={line} className="text-[13px] font-bold leading-5 text-white">{line}</p>) : null}
            {problem ? <p role="alert" className="text-[12px] text-white/60">{problem}</p> : null}
        </section>
    );
}

function sectionIcon(path: React.ReactNode) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

const GroupIcon = () => sectionIcon(<path d="M7 9a2.3 2.3 0 1 0 0-4.6A2.3 2.3 0 0 0 7 9Zm6.5-.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.8 15.5a4.2 4.2 0 0 1 8.4 0m1-4.6a3.7 3.7 0 0 1 5 3.6" />);
const ReportIcon = () => sectionIcon(<path d="M5.5 3.5h9v13h-9Zm2.5 3.5h4m-4 3h4m-4 3h2.5" />);
const VoteIcon = () => sectionIcon(<path d="M4 10.5 8 14.5l8-9" />);
