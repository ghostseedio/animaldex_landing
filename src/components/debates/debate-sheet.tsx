"use client";

/**
 * "Compare with other animals" (docs/debates/SPEC.md, sections 1.2 and 4):
 * Private (the default: your own animals, nothing at stake, only you see it)
 * or Public (other people's animals from the roster, a heart on each, the
 * community votes). The problem as they told it, editable; the animals, with
 * the ones that fit best marked. A public debate's anonymised text is shown
 * to approve, with the stake; nothing posts until then. Anything too
 * personal stays private (`debate_not_public`), and the sheet offers Private.
 */

import {useCallback, useEffect, useMemo, useState} from "react";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {
    DEBATE_MAX_PICKS,
    DEBATE_PROBLEM_MAX,
    DEBATE_PUBLIC_TEXT_MAX,
    debateAnimalName,
    type Debate,
    type DebateCandidate,
    type DebateProblemCode,
    type DebateVisibility
} from "@/lib/debates";
import {debateProblemText, debateStakeNote} from "@/lib/debate-words";
import {approvePublicDebate, createDebate, loadDebateCandidates, noteDebateChanged, setDebateRoster} from "@/components/debates/use-debates";

/** The animal the debate starts from: the one whose chat this is. */
export type DebateHost = {
    captureId: string;
    /** "Luna", or the animal. */
    name: string;
    speciesProfileId: string | null;
    powerEarned: boolean;
    /** Null when unknown: the server checks. */
    hearts: number | null;
};

const MIN_PROBLEM = 3;

export default function DebateSheet({
    host,
    problem: initialProblem,
    words,
    closeLabel,
    optedIn,
    onOptedIn,
    approving: initialApproving = null,
    onStarted,
    onClose
}: {
    host: DebateHost;
    /** The person's problem, as they said it in the chat. */
    problem: string;
    words: CompanionWords;
    closeLabel: string;
    /** The reader's roster opt-in; null when unknown. */
    optedIn: boolean | null;
    onOptedIn?: (optedIn: boolean) => void;
    /** A public debate already drafted, waiting for its text to be approved. */
    approving?: Debate | null;
    /** The debate is on: the chat shows it turn by turn. */
    onStarted: (debate: Debate) => void;
    onClose: () => void;
}) {
    const web = words.debateWeb;
    const [visibility, setVisibility] = useState<DebateVisibility>("private");
    const [problem, setProblem] = useState(initialProblem.slice(0, DEBATE_PROBLEM_MAX));
    const [candidates, setCandidates] = useState<DebateCandidate[] | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    const [working, setWorking] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [refusedPublic, setRefusedPublic] = useState(false);
    const [draft, setDraft] = useState<Debate | null>(initialApproving);
    const [publicText, setPublicText] = useState((initialApproving?.problemPublic ?? "").slice(0, DEBATE_PUBLIC_TEXT_MAX));
    const [rosterSaving, setRosterSaving] = useState(false);
    // Candidates are fitted to the problem as it stands when they ask, not at every keystroke.
    const [fittedTo, setFittedTo] = useState(initialProblem.trim());

    const publicBlocker = visibility !== "public"
        ? null
        : !host.powerEarned
            ? web.problems.powerNotEarned
            : host.hearts !== null && host.hearts <= 0
                ? words.roster.offRoster
                : null;

    useEffect(() => {
        if (draft || publicBlocker) return;
        let cancelled = false;
        setCandidates(null);
        setFailure(null);
        void loadDebateCandidates({hostCaptureId: host.captureId, visibility, problem: fittedTo}).then((result) => {
            if (cancelled) return;
            if (!result.ok) {
                setCandidates([]);
                setFailure(debateProblemText(result.code, words));
                return;
            }
            // Fits this best first, then the rest; never a second of the host's species.
            const usable = result.value.filter((candidate) => !host.speciesProfileId || candidate.speciesProfileId !== host.speciesProfileId);
            setCandidates([...usable.filter((candidate) => candidate.fits), ...usable.filter((candidate) => !candidate.fits)]);
            setPicked((current) => current.filter((id) => usable.some((candidate) => candidate.captureId === id)));
        });
        return () => {
            cancelled = true;
        };
    }, [draft, publicBlocker, host.captureId, host.speciesProfileId, visibility, fittedTo, words]);

    const pickedSpecies = useMemo(() => new Set((candidates ?? [])
        .filter((candidate) => picked.includes(candidate.captureId) && candidate.speciesProfileId)
        .map((candidate) => candidate.speciesProfileId as string)), [candidates, picked]);

    const toggle = (candidate: DebateCandidate) => {
        setPicked((current) => {
            if (current.includes(candidate.captureId)) return current.filter((id) => id !== candidate.captureId);
            if (current.length >= DEBATE_MAX_PICKS) return current;
            return [...current, candidate.captureId];
        });
    };

    const say = useCallback((code: DebateProblemCode) => setFailure(debateProblemText(code, words)), [words]);

    const start = async () => {
        if (working) return;
        const text = problem.trim();
        if (text.length < MIN_PROBLEM) {
            setFailure(web.problemPlaceholder);
            return;
        }
        if (picked.length === 0) {
            setFailure(web.problems.pickOne);
            return;
        }
        setWorking(true);
        setFailure(null);
        const result = await createDebate({hostCaptureId: host.captureId, visibility, problem: text, captureIds: picked});
        setWorking(false);
        if (!result.ok) {
            if (result.code === "debate_not_public") {
                // Too personal to post: it stays private, and the sheet offers that.
                setRefusedPublic(true);
                setVisibility("private");
                setPicked([]);
                return;
            }
            say(result.code);
            return;
        }
        // Theirs, from this animal, started now: the chat places it where it was asked.
        const debate: Debate = {
            ...result.value,
            askerIsMe: true,
            hostCaptureId: result.value.hostCaptureId ?? host.captureId,
            createdAt: result.value.createdAt ?? new Date().toISOString()
        };
        noteDebateChanged(debate);
        if (debate.visibility === "public" && (debate.status === "approving" || debate.status === "drafting")) {
            setDraft(debate);
            setPublicText((debate.problemPublic ?? "").slice(0, DEBATE_PUBLIC_TEXT_MAX));
            return;
        }
        onStarted(debate);
    };

    const approve = async () => {
        if (!draft || working) return;
        const text = publicText.trim();
        if (text.length < MIN_PROBLEM) return;
        setWorking(true);
        setFailure(null);
        const result = await approvePublicDebate(draft.id, text);
        setWorking(false);
        if (!result.ok) {
            if (result.code === "debate_not_public") {
                setDraft(null);
                setRefusedPublic(true);
                setVisibility("private");
                setPicked([]);
                return;
            }
            say(result.code);
            return;
        }
        const approved = result.value;
        const started: Debate = {
            ...draft,
            ...(approved ?? {}),
            status: approved?.status ?? "debating",
            problemPublic: approved?.problemPublic ?? text,
            participants: approved?.participants.length ? approved.participants : draft.participants,
            hostCaptureId: approved?.hostCaptureId ?? draft.hostCaptureId ?? host.captureId,
            createdAt: approved?.createdAt ?? draft.createdAt,
            askerIsMe: true
        };
        noteDebateChanged(started);
        onStarted(started);
    };

    const optIn = async () => {
        setRosterSaving(true);
        const result = await setDebateRoster(true);
        setRosterSaving(false);
        if (result.ok) onOptedIn?.(result.value);
        else say(result.code);
    };

    const stakeCount = draft ? Math.max(1, draft.participants.length - 1) : picked.length;

    return (
        <div role="dialog" aria-modal="true" aria-label={words.debate.start} className="fixed inset-0 z-[72] flex items-end justify-center bg-black/70 md:items-center">
            <div className="flex max-h-[92dvh] w-full max-w-lg flex-col border-t border-white/12 bg-canvas-950 md:border">
                <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-3.5">
                    <h2 className="min-w-0 flex-1 font-display text-lg font-black text-white">{words.debate.start}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white"
                    >
                        ✕
                    </button>
                </header>

                {draft ? (
                    // Public: the anonymised text to approve. Nothing posts until then.
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <div className="border-b border-white/[0.08] px-5 py-4">
                            <p className="text-sm font-black text-white">{words.debate.publicText}</p>
                            <p className="mt-1 text-xs leading-5 text-white/60">{words.debate.publicTextNote}</p>
                            <label className="sr-only" htmlFor="debate-public-text">{words.debate.publicText}</label>
                            <textarea
                                id="debate-public-text"
                                value={publicText}
                                onChange={(event) => setPublicText(event.target.value.slice(0, DEBATE_PUBLIC_TEXT_MAX))}
                                rows={5}
                                maxLength={DEBATE_PUBLIC_TEXT_MAX}
                                placeholder={web.writingPublic}
                                className="mt-3 w-full resize-none border border-white/12 bg-white/[0.05] px-3.5 py-3 text-[15px] leading-6 text-white outline-none placeholder:text-white/35 focus:border-primary-300/45"
                            />
                            <p className="mt-1 text-right text-[11px] tabular-nums text-white/40">{publicText.length} / {DEBATE_PUBLIC_TEXT_MAX}</p>
                        </div>
                        <p className="border-b border-white/[0.08] px-5 py-3 text-xs leading-5 text-white/70">{debateStakeNote(stakeCount, words)}</p>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <div role="radiogroup" aria-label={words.debate.start} className="flex flex-col border-b border-white/[0.08]">
                            {(["private", "public"] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    role="radio"
                                    aria-checked={visibility === option}
                                    onClick={() => {
                                        setVisibility(option);
                                        setPicked([]);
                                        setFailure(null);
                                    }}
                                    className={`flex items-start gap-3 px-5 py-3.5 text-left transition-colors ${visibility === option ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                                >
                                    <span aria-hidden="true" className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${visibility === option ? "border-primary-300" : "border-white/30"}`}>
                                        {visibility === option ? <span className="h-2 w-2 rounded-full bg-primary-300" /> : null}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-black text-white">{option === "private" ? words.debate.private : words.debate.public}</span>
                                        <span className="mt-0.5 block text-xs leading-5 text-white/60">{option === "private" ? words.debate.privateNote : words.debate.publicNote}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                        {refusedPublic ? (
                            <p role="status" className="border-b border-white/[0.08] bg-amber-400/[0.08] px-5 py-3 text-xs leading-5 text-amber-100">{words.debate.notPublic}</p>
                        ) : null}

                        <div className="border-b border-white/[0.08] px-5 py-3.5">
                            <label htmlFor="debate-problem" className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{web.problem}</label>
                            <textarea
                                id="debate-problem"
                                value={problem}
                                onChange={(event) => setProblem(event.target.value.slice(0, DEBATE_PROBLEM_MAX))}
                                onBlur={() => setFittedTo(problem.trim())}
                                rows={3}
                                maxLength={DEBATE_PROBLEM_MAX}
                                placeholder={web.problemPlaceholder}
                                className="mt-2 w-full resize-none bg-transparent text-[15px] leading-6 text-white outline-none placeholder:text-white/35"
                            />
                        </div>

                        {publicBlocker ? (
                            <p className="border-b border-white/[0.08] px-5 py-3.5 text-sm leading-6 text-white/70">{publicBlocker}</p>
                        ) : (
                            <>
                                {visibility === "public" && optedIn === false ? (
                                    <div className="flex items-start gap-3 border-b border-white/[0.08] px-5 py-3.5">
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-bold text-white">{words.roster.optIn}</span>
                                            <span className="mt-0.5 block text-xs leading-5 text-white/60">{words.roster.optInNote}</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void optIn()}
                                            disabled={rosterSaving}
                                            role="switch"
                                            aria-checked={false}
                                            aria-label={words.roster.optIn}
                                            className="mt-0.5 h-7 w-12 shrink-0 rounded-full bg-white/15 p-0.5 disabled:opacity-60"
                                        >
                                            <span className="block h-6 w-6 rounded-full bg-white" />
                                        </button>
                                    </div>
                                ) : null}
                                <div className="flex items-baseline justify-between px-5 pb-1 pt-3.5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{words.debate.pickAnimals}</p>
                                    <p className="text-[11px] font-semibold tabular-nums text-white/45">{fillWords(web.picked, {n: picked.length})}</p>
                                </div>
                                {candidates === null ? (
                                    <p className="px-5 py-4 text-sm text-white/45">{web.loadingAnimals}</p>
                                ) : candidates.length === 0 ? (
                                    <p className="px-5 py-4 text-sm leading-6 text-white/60">{visibility === "public" ? web.noRoster : web.noOwnAnimals}</p>
                                ) : (
                                    <div className="flex flex-col pb-2">
                                        {candidates.map((candidate) => {
                                            const on = picked.includes(candidate.captureId);
                                            const taken = !on && Boolean(candidate.speciesProfileId && pickedSpecies.has(candidate.speciesProfileId));
                                            const full = !on && picked.length >= DEBATE_MAX_PICKS;
                                            return (
                                                <button
                                                    key={candidate.captureId}
                                                    type="button"
                                                    onClick={() => toggle(candidate)}
                                                    disabled={taken || full}
                                                    aria-pressed={on}
                                                    title={taken ? words.picker.alreadyHereHint : undefined}
                                                    className={`flex items-center gap-3 px-5 py-2.5 text-left transition-colors disabled:opacity-45 ${on ? "bg-primary-400/[0.1]" : "hover:bg-white/[0.03]"}`}
                                                >
                                                    <AskAnimalFace url={candidate.slug ? getSpeciesImageRoute(candidate.slug) : null} size={34} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-bold text-white">{taken ? words.picker.alreadyHere : debateAnimalName(candidate)}</span>
                                                        <span className="block truncate text-[11px] font-semibold text-white/50">{candidate.powerName ?? candidate.animal}</span>
                                                    </span>
                                                    {candidate.fits ? (
                                                        <span className="shrink-0 rounded-full border border-primary-300/30 px-2 py-0.5 text-[10px] font-bold text-primary-200">{words.debate.suggested}</span>
                                                    ) : null}
                                                    <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${on ? "border-primary-300 bg-primary-300 text-black" : "border-white/25 text-transparent"}`}>✓</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {visibility === "public" && picked.length > 0 ? (
                                    <p className="border-t border-white/[0.08] px-5 py-3 text-xs leading-5 text-white/70">{debateStakeNote(picked.length, words)}</p>
                                ) : null}
                            </>
                        )}
                    </div>
                )}

                <div className="shrink-0 border-t border-white/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                    {failure ? <p role="alert" className="mb-2 text-xs leading-5 text-white/65">{failure}</p> : null}
                    {draft ? (
                        <button
                            type="button"
                            onClick={() => void approve()}
                            disabled={working || publicText.trim().length < MIN_PROBLEM}
                            className="flex min-h-12 w-full items-center justify-center rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-50"
                        >
                            {working ? web.posting : words.debate.approve}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void start()}
                            disabled={working || Boolean(publicBlocker) || picked.length === 0 || problem.trim().length < MIN_PROBLEM}
                            className="flex min-h-12 w-full items-center justify-center rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300 disabled:opacity-50"
                        >
                            {working ? (visibility === "public" ? web.writingPublic : web.starting) : words.debate.begin}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
