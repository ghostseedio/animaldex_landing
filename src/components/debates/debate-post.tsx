"use client";

/**
 * A public debate in Discover (docs/debates/SPEC.md, sections 1.6 and 4):
 * "Which animal has the best way for this?", the anonymised problem, each
 * animal's opening, the report, and one Vote per animal with the counts. A
 * voter sees "You voted"; the asker and the animals' owners see "You can't
 * vote on a debate you're in." A boosted one (not enough votes yet) says
 * voting stays open another day. Private debates never appear here.
 *
 * Never clipped (owner, 2026-11-09): with up to 7 animals ("Ask more
 * animals") it shows the first three and "+N more", which shows the rest in
 * place; the question and each opening are clamped, and the card is as tall
 * as what it holds (scrolling inside its slot only when that is taller).
 */

import {useCallback, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {DebateMoreAnimals, DebateReportBand, DebateVotePanel, debateColor, debateFaceUrl} from "@/components/debates/debate-views";
import {useDebateUpdates} from "@/components/debates/use-debates";
import type {CompanionWords} from "@/lib/companion-bond";
import {debateAnimalName, debateOpenings, mergeDebate, type Debate} from "@/lib/debates";
import {debateCardAnimals, debateHeadline} from "@/lib/debate-words";

export default function DebatePost({debate: seed, words, signedIn, pinned = false, locale}: {
    debate: Debate;
    words: CompanionWords;
    signedIn: boolean;
    /** Boosted to the top of the feed for a reader who has not voted. */
    pinned?: boolean;
    locale?: string;
}) {
    const [debate, setDebate] = useState(seed);
    const [showsReport, setShowsReport] = useState(false);
    // "+N more": every animal, here and in the vote.
    const [allAnimals, setAllAnimals] = useState(false);
    useDebateUpdates(seed.id, useCallback((next: Debate) => setDebate((current) => mergeDebate(current, next)), []));
    const openings = debateOpenings(debate);
    const {shown, more} = debateCardAnimals(debate.participants, allAnimals);

    return (
        // It scrolls inside its feed slot, and hands the swipe on to the feed at its edges.
        <article data-feed-inner-scroll aria-label={words.debate.voteQuestion} className="flex max-h-full min-h-0 flex-col overflow-y-auto bg-black px-5 pb-28 [&>*]:shrink-0 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] [scrollbar-width:none] lg:pb-6 lg:pt-5 [&::-webkit-scrollbar]:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-200/85">{words.debate.voteQuestion}</p>
            {pinned && debate.rollovers > 0 ? <p className="mt-1 text-[11px] font-semibold text-amber-200/90">{words.debate.rollover}</p> : null}
            <h2 className="mt-2 line-clamp-3 break-words font-display text-xl font-black leading-7 text-white">{debateHeadline(debate)}</h2>

            <div className="-mx-5 mt-4 flex flex-col divide-y divide-white/[0.06] border-y border-white/[0.08]">
                {shown.map((participant) => {
                    const color = debateColor(participant);
                    const opening = openings.get(participant.seat);
                    return (
                        <div key={participant.id} className="flex items-start gap-2.5 px-5 py-3">
                            <span className="shrink-0 rounded-full">
                                <AskAnimalFace url={debateFaceUrl(participant)} size={32} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-baseline gap-2">
                                    <span className="min-w-0 truncate text-sm font-bold" style={{color}}>{debateAnimalName(participant)}</span>
                                    {participant.powerName ? <span className="min-w-0 truncate text-[11px] font-semibold text-white/40">{participant.powerName}</span> : null}
                                </span>
                                {opening ? <span className="mt-1 line-clamp-2 block break-words text-[14px] leading-6 text-white/85">{opening}</span> : null}
                            </span>
                        </div>
                    );
                })}
                {more > 0 ? (
                    <div className="px-5 py-2.5">
                        <DebateMoreAnimals more={more} words={words} onShow={() => setAllAnimals(true)} />
                    </div>
                ) : null}
            </div>

            {debate.report ? (
                showsReport ? (
                    <div className="mt-4">
                        <DebateReportBand debate={debate} words={words} bleed="-mx-5 px-5" />
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowsReport(true)}
                        aria-expanded={false}
                        className="-mx-5 mt-4 flex items-center justify-between border-y border-white/[0.08] px-5 py-3 text-left text-sm font-bold text-white hover:bg-white/[0.03]"
                    >
                        {words.debate.reportTitle}
                        <span aria-hidden="true" className="text-white/40">▾</span>
                    </button>
                )
            ) : null}

            <div className="mt-4">
                <DebateVotePanel
                    debate={debate}
                    words={words}
                    signedIn={signedIn}
                    bleed="-mx-5 px-5"
                    onChange={setDebate}
                    locale={locale}
                    expanded={allAnimals}
                    onShowAll={() => setAllAnimals(true)}
                />
            </div>

            {signedIn ? (
                <Link href={`/app/debates/${debate.id}`} className="mt-4 self-start text-xs font-bold text-primary-200 underline-offset-2 hover:underline">
                    {words.debateWeb.openDebate}
                </Link>
            ) : null}
        </article>
    );
}
