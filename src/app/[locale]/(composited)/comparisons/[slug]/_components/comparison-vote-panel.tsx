"use client";

import {useCallback, useState} from "react";
import type {ComparisonVoteSide, ComparisonVoteTally} from "@/data/comparison-engagement";

export type ComparisonVoteCopy = {
    eyebrow: string;
    title: string;
    description: string;
    votedLabel: string;
    changeHint: string;
    totalVotes: string;
    noVotesYet: string;
    errorMessage: string;
    rateLimitMessage: string;
    votePrompt: string;
};

type ComparisonVotePanelProps = {
    slug: string;
    animalAName: string;
    animalBName: string;
    animalAArtwork: string;
    animalBArtwork: string;
    initialTally: ComparisonVoteTally;
    initialVote: ComparisonVoteSide | null;
    copy: ComparisonVoteCopy;
};

function share(tally: ComparisonVoteTally, side: ComparisonVoteSide) {
    if (tally.totalVotes <= 0) return 0;
    const value = side === "animalA" ? tally.animalAVotes : tally.animalBVotes;
    return Math.round((value / tally.totalVotes) * 100);
}

export default function ComparisonVotePanel({
    slug,
    animalAName,
    animalBName,
    animalAArtwork,
    animalBArtwork,
    initialTally,
    initialVote,
    copy
}: ComparisonVotePanelProps) {
    const [tally, setTally] = useState(initialTally);
    const [vote, setVote] = useState<ComparisonVoteSide | null>(initialVote);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<ComparisonVoteSide | null>(null);

    const castVote = useCallback(async (side: ComparisonVoteSide) => {
        if (pending) return;
        setPending(side);
        setError(null);

        const previousVote = vote;
        const previousTally = tally;

        // Optimistic: move the reader's vote across immediately.
        setVote(side);
        setTally((current) => {
            const next = {...current};
            if (previousVote === side) return current;
            if (previousVote === "animalA") next.animalAVotes = Math.max(0, next.animalAVotes - 1);
            if (previousVote === "animalB") next.animalBVotes = Math.max(0, next.animalBVotes - 1);
            if (!previousVote) next.totalVotes += 1;
            if (side === "animalA") next.animalAVotes += 1;
            else next.animalBVotes += 1;
            return next;
        });

        try {
            const response = await fetch("/api/comparisons/vote", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({slug, side})
            });

            if (!response.ok) {
                setVote(previousVote);
                setTally(previousTally);
                setError(response.status === 429 ? copy.rateLimitMessage : copy.errorMessage);
                return;
            }

            const payload = (await response.json()) as {
                tally?: ComparisonVoteTally;
                viewerVote?: ComparisonVoteSide;
            };
            if (payload.tally) setTally(payload.tally);
            if (payload.viewerVote) setVote(payload.viewerVote);
        } catch {
            setVote(previousVote);
            setTally(previousTally);
            setError(copy.errorMessage);
        } finally {
            setPending(null);
        }
    }, [copy.errorMessage, copy.rateLimitMessage, pending, slug, tally, vote]);

    const options: Array<{side: ComparisonVoteSide; name: string; artwork: string}> = [
        {side: "animalA", name: animalAName, artwork: animalAArtwork},
        {side: "animalB", name: animalBName, artwork: animalBArtwork}
    ];
    const hasVotes = tally.totalVotes > 0;

    return (
        <section id="vote" className="scroll-mt-28 rounded-[2rem] border border-line-300 bg-surface-900/60 p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{copy.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">{copy.title}</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-200">
                {vote ? copy.changeHint : copy.description}
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {options.map((option) => {
                    const selected = vote === option.side;
                    const percentage = share(tally, option.side);
                    const count = option.side === "animalA" ? tally.animalAVotes : tally.animalBVotes;

                    return (
                        <button
                            key={option.side}
                            type="button"
                            onClick={() => castVote(option.side)}
                            aria-pressed={selected}
                            disabled={pending !== null}
                            className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition disabled:cursor-wait ${selected ? "border-primary-400 bg-primary-400/10" : "border-line-300 bg-black/20 hover:border-primary-400/50"}`}
                        >
                            <div className="flex items-center gap-4">
                                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-800/70">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={option.artwork} alt="" loading="lazy" className="h-full w-full object-cover" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-display text-xl font-bold text-white">{option.name}</span>
                                    <span className="mt-0.5 block text-sm font-semibold text-ink-300">
                                        {hasVotes ? `${percentage}% · ${count.toLocaleString()}` : copy.votePrompt}
                                    </span>
                                </span>
                                {selected ? (
                                    <span className="shrink-0 rounded-full bg-primary-400 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-black">
                                        {copy.votedLabel}
                                    </span>
                                ) : null}
                            </div>

                            <span className="mt-4 block h-2 w-full overflow-hidden rounded-full bg-white/10">
                                <span
                                    className={`block h-full rounded-full transition-[width] duration-500 ${selected ? "bg-primary-400" : "bg-white/35"}`}
                                    style={{width: `${hasVotes ? percentage : 0}%`}}
                                />
                            </span>
                        </button>
                    );
                })}
            </div>

            <p className="mt-5 text-sm font-semibold text-ink-300" aria-live="polite">
                {hasVotes ? copy.totalVotes.replace("{count}", tally.totalVotes.toLocaleString()) : copy.noVotesYet}
            </p>

            {error ? <p className="mt-2 text-sm font-semibold text-amber-300">{error}</p> : null}
        </section>
    );
}
