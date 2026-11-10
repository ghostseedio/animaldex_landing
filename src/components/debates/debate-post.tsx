"use client";

/**
 * A public debate in Discover (docs/debates/SPEC.md, sections 1.6 and 4;
 * docs/rich-chat/SPEC.md, section 2.5; iOS `DebateDiscoverPostView`): the
 * votes and "Voting closes in 40h", "Which animal has the best way for
 * this?", the anonymised problem, at most three animals (the viewer's vote,
 * else the winner, always among them) each with its Vote, the rest as faces
 * and "+N more", the notes, and the report as an edge-to-edge band. "+N
 * more" and the report open the debate's own page. Private debates never
 * appear here.
 *
 * Never clipped and never scrolled inside its slot (owner, 2026-11-09: a
 * debate of seven lost its bottom): every text is clamped (title 2 lines,
 * problem 3, opening 2, a report line 1, try first 2, a note 2), and while
 * it is still taller than its slot it steps down, as iOS's ViewThatFits
 * does: no openings, then the report's label alone (problem 2 lines), then
 * the animals as one row of faces with a Vote link.
 */

import {useCallback, useLayoutEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {debateColor, debateFaceUrl, useDebateVote} from "@/components/debates/debate-views";
import {useDebateUpdates} from "@/components/debates/use-debates";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {debateAnimalName, debateOpenings, debateVoteState, mergeDebate, reportWayFor, type Debate, type DebateParticipant} from "@/lib/debates";
import {
    DEBATE_CARD_HIDDEN_FACES,
    debateCardNextDensity,
    debateClosesIn,
    debateDiscoverRows,
    debateResultLines,
    debateVotesText,
    type DebateCardDensity
} from "@/lib/debate-words";

const BAND = "-mx-5 flex flex-col gap-2 bg-white/[0.05] px-5 py-3.5 text-left transition-colors hover:bg-white/[0.08]";

function Faces({participants, size = 24}: {participants: readonly DebateParticipant[]; size?: number}) {
    return (
        <span className="flex shrink-0 items-center">
            {participants.map((participant, index) => (
                <span key={participant.id} className="rounded-full bg-black" style={{marginLeft: index === 0 ? 0 : -size * 0.3, boxShadow: "0 0 0 1.5px #000"}}>
                    <AskAnimalFace url={debateFaceUrl(participant)} size={size} />
                </span>
            ))}
        </span>
    );
}

function Chevron() {
    return (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-white/40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
        </svg>
    );
}

export default function DebatePost({debate: seed, words, signedIn, pinned = false, locale}: {
    debate: Debate;
    words: CompanionWords;
    signedIn: boolean;
    /** Boosted to the top of the feed for a reader who has not voted. */
    pinned?: boolean;
    locale?: string;
}) {
    const [debate, setDebate] = useState(seed);
    useDebateUpdates(seed.id, useCallback((next: Debate) => setDebate((current) => mergeDebate(current, next)), []));
    const ballot = useDebateVote(debate, words, setDebate);
    const state = debateVoteState(debate, signedIn);
    const openings = debateOpenings(debate);
    const {shown, hidden} = debateDiscoverRows(debate.participants, debate.myVote ?? debate.winnerParticipantId);
    // Once the asker has chosen a way, no clock or rollover is left over (iOS 6db4f601).
    const openVote = debate.status === "voting" && !debate.chosenParticipantId;
    const closesIn = openVote ? debateClosesIn(debate.votingDeadlineAt, words, locale) : null;
    const results = debate.status === "settled" || debate.status === "draw" ? debateResultLines(debate, words) : [];
    const href = `/app/debates/${encodeURIComponent(debate.id)}`;

    // The most the slot holds: start full, and step down after each draw that is still too tall.
    const [density, setDensity] = useState<DebateCardDensity>("full");
    const articleRef = useRef<HTMLElement | null>(null);
    useLayoutEffect(() => {
        const article = articleRef.current;
        if (!article) return;
        if (article.scrollHeight > article.clientHeight + 1) {
            const next = debateCardNextDensity(density);
            if (next) setDensity(next);
        }
    }, [density, debate, ballot.problem]);
    // A new slot size (a rotation, a resize) or new contents: measure again from the top.
    const sizeRef = useRef<string>("");
    useLayoutEffect(() => {
        const article = articleRef.current;
        if (!article || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => {
            const size = `${article.clientWidth}x${article.clientHeight}`;
            if (size === sizeRef.current) return;
            sizeRef.current = size;
            setDensity("full");
        });
        observer.observe(article);
        return () => observer.disconnect();
    }, []);
    const contentKey = `${debate.participants.length}:${debate.status}:${debate.myVote ?? ""}:${debate.report ? 1 : 0}`;
    const contentRef = useRef(contentKey);
    useLayoutEffect(() => {
        if (contentRef.current === contentKey) return;
        contentRef.current = contentKey;
        setDensity("full");
    }, [contentKey]);

    const note = (text: string, key?: string) => <p key={key ?? text} className="line-clamp-2 text-[11px] leading-4 text-white/60">{text}</p>;
    const facesLink = (participants: readonly DebateParticipant[], title: string) => (
        <Link href={href} className="flex min-h-9 items-center gap-2.5 text-left" data-testid="debate-post-more">
            <Faces participants={participants} />
            <span className="truncate text-xs font-bold text-white">{title}</span>
            <Chevron />
        </Link>
    );
    const reportLabel = (
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white/45">
            <span className="flex-1 truncate">{words.debate.reportTitle}</span>
            <Chevron />
        </span>
    );

    return (
        // One page of the feed; it never scrolls inside, it steps down (above).
        <article
            ref={articleRef}
            aria-label={words.debate.voteQuestion}
            className="flex h-full min-h-0 flex-col overflow-hidden bg-black px-5 pb-28 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] lg:pb-6 lg:pt-5 [&>*]:shrink-0"
            data-density={density}
            data-testid="debate-post"
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-primary-200/85">
                    {pinned ? (
                        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true"><path d="M15 3 21 9l-2 2-1-1-4 4v4l-2 2-3-3-4 4-1-1 4-4-3-3 2-2h4l4-4-1-1 2-2Z" /></svg>
                    ) : null}
                    <span className="truncate text-[10px] font-black uppercase tracking-[0.14em]">{words.debates.tab}</span>
                    <span className="flex-1" />
                    <span className="shrink-0 text-[11px] font-semibold text-white/45">{debateVotesText(debate.totalVotes, words)}</span>
                </div>
                {closesIn ? <p className="line-clamp-2 text-[11px] leading-4 text-white/45" data-testid="debate-post-closes">{closesIn}</p> : null}
            </div>
            <h2 className="mt-3 line-clamp-2 font-display text-xl font-black leading-7 text-white">{words.debate.voteQuestion}</h2>
            {debate.problemPublic ? (
                <p className={`mt-2 break-words text-[14px] leading-[22px] text-white/70 ${density === "minimal" || density === "faces" ? "line-clamp-2" : "line-clamp-3"}`}>{debate.problemPublic}</p>
            ) : null}

            {density === "faces" ? (
                <div className="mt-3.5">{facesLink(debate.participants, state.kind === "vote" ? words.debate.vote : words.debate.reportTitle)}</div>
            ) : (
                <div className="mt-3.5 flex flex-col gap-3">
                    {shown.map((participant) => {
                        const opening = density === "full" ? openings.get(participant.seat) : null;
                        const voted = state.kind === "voted" && state.participantId === participant.id;
                        const won = debate.status === "settled" && debate.winnerParticipantId === participant.id;
                        return (
                            <div key={participant.id} className="flex items-start gap-2.5" data-testid="debate-post-animal">
                                <span className="shrink-0 rounded-full"><AskAnimalFace url={debateFaceUrl(participant)} size={36} /></span>
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="flex min-w-0 items-baseline gap-1.5">
                                        <span className="min-w-0 truncate text-[13px] font-bold" style={{color: debateColor(participant)}}>{debateAnimalName(participant)}</span>
                                        {participant.powerName ? <span className="min-w-0 truncate text-[11px] text-white/40">{participant.powerName}</span> : null}
                                    </span>
                                    {opening ? <span className="line-clamp-2 break-words text-[14px] leading-[22px] text-white/90">{opening}</span> : null}
                                    {state.kind !== "vote" && participant.votes !== null ? (
                                        <span className="truncate text-[11px] text-white/40">{debateVotesText(participant.votes, words)}</span>
                                    ) : null}
                                </span>
                                {state.kind === "vote" ? (
                                    <button
                                        type="button"
                                        onClick={() => ballot.vote(participant)}
                                        disabled={Boolean(ballot.voting)}
                                        aria-label={`${words.debate.vote}: ${debateAnimalName(participant)}`}
                                        className="min-h-8 shrink-0 rounded-full bg-primary-400 px-4 text-xs font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500 disabled:opacity-60"
                                    >
                                        {ballot.voting === participant.id ? "…" : words.debate.vote}
                                    </button>
                                ) : voted ? (
                                    <span className="shrink-0 text-[11px] font-bold text-primary-300">✓ {words.debate.voted}</span>
                                ) : won ? (
                                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#F2B84B]" fill="currentColor" aria-hidden="true" data-testid="debate-post-winner"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z" /></svg>
                                ) : null}
                            </div>
                        );
                    })}
                    {hidden.length > 0 ? facesLink(hidden.slice(0, DEBATE_CARD_HIDDEN_FACES), fillWords(words.debate.moreCount, {n: hidden.length})) : null}
                </div>
            )}

            <div className="mt-3 flex flex-col gap-1">
                {debate.rollovers > 0 && openVote ? note(words.debate.rollover) : null}
                {state.kind === "own" ? note(words.debate.cantVoteOwn) : null}
                {state.kind === "ineligible" && !ballot.problem ? note(words.debateWeb.ineligible) : null}
                {state.kind === "signIn" ? (
                    <Link href="/account" className="self-start text-xs font-bold text-primary-200 underline-offset-2 hover:underline">{words.debateWeb.signInToVote}</Link>
                ) : null}
                {results.slice(0, 2).map((line) => note(line, `result-${line}`))}
                {ballot.problem ? note(ballot.problem, "problem") : null}
            </div>

            <div className="min-h-3.5 flex-1 !shrink" aria-hidden="true" />
            {density === "full" || density === "noOpenings" ? (
                <Link href={href} className={BAND} data-testid="debate-post-report">
                    {reportLabel}
                    {debate.report ? (
                        <>
                            {shown.map((participant) => {
                                const way = reportWayFor(debate.report!, participant);
                                return way ? (
                                    <span key={participant.id} className="flex min-w-0 items-baseline gap-2">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor: debateColor(participant)}} />
                                        <span className="min-w-0 truncate text-xs text-white">{way.way}</span>
                                    </span>
                                ) : null;
                            })}
                            {debate.report.tryFirst ? <span className="line-clamp-2 text-xs font-semibold text-primary-300">{debate.report.tryFirst}</span> : null}
                        </>
                    ) : null}
                </Link>
            ) : density === "minimal" ? (
                <Link href={href} className={BAND} data-testid="debate-post-report">{reportLabel}</Link>
            ) : null}
        </article>
    );
}
