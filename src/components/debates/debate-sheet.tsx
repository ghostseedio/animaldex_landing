"use client";

/**
 * Setting a debate up (docs/debates/SPEC.md, sections 1.2, 4 and 6): Private
 * (the default: your own animals, nothing at stake, only you see it) or
 * Public (other people's animals from the roster, a heart on each, the
 * community votes); the animals, the best fits pre-selected; the problem as
 * they told it, with Edit; Start. A public debate's anonymised text comes
 * back to approve in the same place, with the stake: Post, Edit, or Keep it
 * private. Anything too personal stays private (`debate_not_public`).
 *
 * Since 2026-10-31 (docs/rich-chat/SPEC.md, section 2.2) it lives in the
 * conversation's own shapes, like Your step (`layout: "section"`): the offer's
 * section in the animal's special message grows into this setup in place
 * ("SET UP THE DEBATE", the question in bold with Edit, the animals as
 * compact rows, Private | Public chips, the notes, [Start the debate] and
 * [Not now]); opened from the ••• menu, the Bond tab or a call, it is a
 * special message of its own from the host. Edit works in the message bar
 * (`onEdit`), never in a field in the bubble. The modal sheet (`layout:
 * "sheet"`) is only the drawer's fallback below 340 px.
 */

import {useCallback, useEffect, useMemo, useState, type ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import {AskAnimalFace, AskSpecialLabel} from "@/components/ask-animaldex/ask-messenger";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {
    DEBATE_MAX_PICKS,
    DEBATE_PROBLEM_MAX,
    DEBATE_PUBLIC_TEXT_MAX,
    debateAnimalName,
    debateHasStakes,
    debateSetupRows,
    groupDebateCandidates,
    othersPicked,
    preselectedDebatePicks,
    type Debate,
    type DebateCandidate,
    type DebateNamedAnimal,
    type DebateProblemCode,
    type DebateVisibility
} from "@/lib/debates";
import {debateProblemText, debateStakeNote} from "@/lib/debate-words";
import {approvePublicDebate, cancelDebate, createDebate, fetchDebate, loadDebateCandidates, noteDebateChanged, setDebateRoster} from "@/components/debates/use-debates";

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

/**
 * The message bar's edit mode (docs/rich-chat/SPEC.md, section 2.2): the
 * strip says what is being edited, the field is prefilled, Send saves it.
 */
export type DebateEdit = {
    kind: "problem" | "public";
    text: string;
    min: number;
    max: number;
    save: (text: string) => void;
};

/** The server wants at least this much of the problem (and of the public text). */
const MIN_PROBLEM = 10;
/** "More animals" shows this many more rows at a time. */
const MORE_ROWS = 6;
/** SERVER.md: poll about every 1.5 s; still drafting after about 30 s is a soft error. */
const DRAFT_POLL_MS = 1500;
const DRAFT_POLLS = 20;

const NO_NAMED: readonly DebateNamedAnimal[] = [];

const primaryButton = "inline-flex min-h-11 items-center justify-center rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500 disabled:opacity-50";
const quietButton = "inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-4 text-sm font-bold text-white transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50";
// Inside the bubble: the special message's own chips (ask-special.tsx).
const CHIP = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-[14px] py-1.5 text-left text-xs leading-4 transition-colors disabled:opacity-50";
const PRIMARY_CHIP = `${CHIP} bg-primary-400 font-black text-black hover:bg-primary-300 active:bg-primary-500`;
const SECONDARY_CHIP = `${CHIP} border border-white/12 bg-white/[0.07] font-bold text-white hover:bg-white/10 active:bg-white/15`;
/** The roster rows: the panel radius token (globals.css). */
const ROW_RADIUS = {borderRadius: "var(--r-panel)"} as const;

export default function DebateSetup({
    layout = "sheet",
    host,
    problem: initialProblem,
    named = NO_NAMED,
    fromCall = false,
    words,
    closeLabel,
    optedIn,
    onOptedIn,
    approving: initialApproving = null,
    onStarted,
    onClose,
    onEdit,
    initialVisibility = "private"
}: {
    /** In the thread, the section of the animal's special message; or the modal fallback. */
    layout?: "section" | "sheet";
    host: DebateHost;
    /** The person's problem: the animal's summary of it, or as they said it. */
    problem: string;
    /**
     * The owner's own animals the animal named in its offer (`debate_offer.with`,
     * or a call's `debate_request.with`): pre-selected first, then the suggestions.
     */
    named?: readonly DebateNamedAnimal[];
    /** Asked for on a voice call: "From your call", Private. */
    fromCall?: boolean;
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
    /** The section's Edit: the message bar's edit mode. Without it (the sheet), a field. */
    onEdit?: (edit: DebateEdit) => void;
    /** Private, always, in the chat; the dev gallery opens on Public to show it. */
    initialVisibility?: DebateVisibility;
}) {
    const web = words.debateWeb;
    const [visibility, setVisibility] = useState<DebateVisibility>(initialVisibility);
    const [problem, setProblem] = useState(initialProblem.slice(0, DEBATE_PROBLEM_MAX));
    const [editingProblem, setEditingProblem] = useState(initialProblem.trim().length === 0);
    const [candidates, setCandidates] = useState<DebateCandidate[] | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    // The suggestions are pre-selected until the person picks for themselves.
    const [touched, setTouched] = useState(false);
    const [showsAll, setShowsAll] = useState(false);
    // The section's "More animals": rows beyond the suggestions, six at a time.
    const [moreRows, setMoreRows] = useState(0);
    const [working, setWorking] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [refusedPublic, setRefusedPublic] = useState(false);
    const [draft, setDraft] = useState<Debate | null>(initialApproving);
    const [publicText, setPublicText] = useState((initialApproving?.problemPublic ?? "").slice(0, DEBATE_PUBLIC_TEXT_MAX));
    const [editingPublic, setEditingPublic] = useState(false);
    const [rosterSaving, setRosterSaving] = useState(false);
    // Candidates are fitted to the problem as it stands when they ask, not at every keystroke.
    const [fittedTo, setFittedTo] = useState(initialProblem.trim());

    /** Back to choosing, as Private: after a refusal, or "Keep it private". */
    const backToPrivate = useCallback(() => {
        setDraft(null);
        setEditingPublic(false);
        setVisibility("private");
        setPicked([]);
        setTouched(false);
    }, []);

    // A public debate starts as a draft the server writes (no names, places
    // or other identifying details): wait for it, then show it to approve. One
    // too personal to post comes back cancelled `not_public`: it stays private.
    const drafting = draft?.status === "drafting";
    useEffect(() => {
        if (!draft || draft.status !== "drafting") return;
        let cancelled = false;
        void (async () => {
            for (let attempt = 0; attempt < DRAFT_POLLS && !cancelled; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, DRAFT_POLL_MS));
                if (cancelled) return;
                const {debate} = await fetchDebate(draft.id);
                if (!debate || cancelled || debate.status === "drafting") continue;
                if (debate.status === "cancelled") {
                    backToPrivate();
                    if (debate.cancelReason === "not_public") setRefusedPublic(true);
                    else setFailure(web.problems.generic);
                    return;
                }
                const next: Debate = {...debate, askerIsMe: true, participants: debate.participants.length > 0 ? debate.participants : draft.participants};
                setDraft(next);
                setPublicText((debate.problemPublic ?? "").slice(0, DEBATE_PUBLIC_TEXT_MAX));
                noteDebateChanged(next);
                return;
            }
            if (!cancelled) setFailure(web.problems.draftSlow);
        })();
        return () => {
            cancelled = true;
        };
    }, [draft, web.problems.generic, web.problems.draftSlow, backToPrivate]);

    // Out of hearts no longer blocks Public (owner, 2026-10-31): with only
    // its own animals nothing is at stake; it needs a heart only with someone
    // else's animal picked (said beside the stake, below).
    const publicBlocker = visibility !== "public" || host.powerEarned ? null : web.problems.powerNotEarned;

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

    // The animals it named, then the suggestions, pre-selected, until they choose for themselves.
    useEffect(() => {
        if (!candidates || touched) return;
        setPicked(preselectedDebatePicks(candidates, named, DEBATE_MAX_PICKS));
    }, [candidates, touched, named]);

    const pickedSpecies = useMemo(() => new Set((candidates ?? [])
        .filter((candidate) => picked.includes(candidate.captureId) && candidate.speciesProfileId)
        .map((candidate) => candidate.speciesProfileId as string)), [candidates, picked]);
    const suggested = useMemo(() => (candidates ?? []).filter((candidate) => candidate.fits).slice(0, DEBATE_MAX_PICKS), [candidates]);
    const listed = useMemo(() => {
        if (!candidates) return [];
        // The suggestions and whatever else they picked, then six more at a time.
        if (layout === "section") return debateSetupRows(candidates, picked, moreRows).rows;
        if (showsAll || suggested.length === 0) return candidates;
        // The suggestions, and whatever else they picked.
        return candidates.filter((candidate) => suggested.includes(candidate) || picked.includes(candidate.captureId));
    }, [candidates, showsAll, suggested, picked, layout, moreRows]);

    const toggle = (candidate: DebateCandidate) => {
        setTouched(true);
        setPicked((current) => {
            if (current.includes(candidate.captureId)) return current.filter((id) => id !== candidate.captureId);
            if (current.length >= DEBATE_MAX_PICKS) return current;
            return [...current, candidate.captureId];
        });
    };

    /** One animal to pick: its face, name and Power, "Fits this best", and the tick. */
    const candidateRow = (candidate: DebateCandidate) => {
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
                className={`flex items-center gap-3 ${pad} py-2.5 text-left transition-colors disabled:opacity-45 ${on ? "bg-primary-400/[0.1]" : "hover:bg-white/[0.03]"}`}
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
    };

    /**
     * Public (owner, 2026-10-31): "Your animals" first, then "Other people's
     * animals" when there are any; with none, the note says yours debate it
     * and the community votes.
     */
    const publicGroups = (rows: DebateCandidate[]) => {
        const {own, others} = groupDebateCandidates(rows);
        const groups: Array<{key: string; title: string | null; rows: DebateCandidate[]; note: string | null}> = [];
        if (own.length > 0) groups.push({key: "own", title: words.debate.yourAnimals, rows: own, note: null});
        if (others.length > 0) groups.push({key: "others", title: words.debate.othersAnimals, rows: others, note: null});
        if (!(candidates ?? []).some((candidate) => !candidate.ownerIsMe)) {
            groups.push({key: "no-others", title: null, rows: [], note: words.debate.noOthers});
        }
        return groups;
    };

    const say = useCallback((code: DebateProblemCode) => setFailure(debateProblemText(code, words)), [words]);

    const start = async () => {
        if (working) return;
        const text = problem.trim();
        if (text.length < MIN_PROBLEM) {
            setEditingProblem(true);
            setFailure(web.problems.tooShort);
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
                // Too personal to post: it stays private, and says so.
                backToPrivate();
                setRefusedPublic(true);
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
                backToPrivate();
                setRefusedPublic(true);
                return;
            }
            if (result.code === "animal_unavailable") {
                // One of the invited animals joined another debate meanwhile: drop this one, pick again.
                const dropped = await cancelDebate(draft.id);
                if (dropped.ok && dropped.value) noteDebateChanged({...dropped.value, askerIsMe: true});
                setDraft(null);
                setEditingPublic(false);
                setPicked([]);
                setTouched(false);
                say(result.code);
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

    /** Lets an unapproved public draft go (`cancel_debate_v1`): nothing was posted, and the day's public debate is free again. */
    const dropDraft = useCallback(() => {
        if (!draft || (draft.status !== "drafting" && draft.status !== "approving")) return;
        const dropped = draft;
        void cancelDebate(dropped.id).then((result) => {
            noteDebateChanged(result.ok && result.value ? {...result.value, askerIsMe: true} : {...dropped, status: "cancelled", cancelReason: "asker_cancelled"});
        });
    }, [draft]);

    /** "Keep it private": the draft goes, and the same problem is set up as a private debate. */
    const keepPrivate = () => {
        dropDraft();
        backToPrivate();
    };

    const optIn = async () => {
        setRosterSaving(true);
        const result = await setDebateRoster(true);
        setRosterSaving(false);
        if (result.ok) onOptedIn?.(result.value);
        else say(result.code);
    };

    const close = () => {
        dropDraft();
        onClose();
    };

    // Hearts and Credits move only between different owners: only your own animals, nothing at stake.
    const draftHasStakes = draft
        ? draft.stakes ?? (draft.participants.length > 1 ? debateHasStakes({...draft, stakes: null}) : othersPicked(candidates ?? [], picked) > 0)
        : false;
    const stakeLine = (hasStakes: boolean, count: number) => (hasStakes ? debateStakeNote(count, words) : words.debate.ownOnly);
    const pickedOthers = othersPicked(candidates ?? [], picked);
    // With a stake (someone else's animal picked), the host and your own picks each need a heart
    // (SPEC section 7): the first of yours without one, to heal on its card, or pick only your own.
    const heartless = visibility !== "public" || pickedOthers === 0
        ? null
        : host.hearts !== null && host.hearts <= 0
            ? host.captureId
            : (candidates ?? []).find((candidate) => candidate.ownerIsMe && picked.includes(candidate.captureId) && candidate.hearts !== null && candidate.hearts <= 0)?.captureId ?? null;
    const hostOutOfHearts = heartless !== null;
    // Why Start can't be tapped yet, so it is never a disabled button with no reason.
    const startHint = !draft && !working && !failure && !publicBlocker && candidates !== null && candidates.length > 0
        ? picked.length === 0
            ? web.problems.pickOne
            : problem.trim().length < MIN_PROBLEM
                ? web.problems.tooShort
                : null
        : null;
    const pad = "px-5";
    const rule = "border-b border-white/[0.08]";

    /** Edit, in the bar (the section) or in a field (the sheet). */
    const editProblem = () => {
        if (onEdit) {
            onEdit({
                kind: "problem",
                text: problem,
                min: MIN_PROBLEM,
                max: DEBATE_PROBLEM_MAX,
                save: (text) => {
                    const next = text.slice(0, DEBATE_PROBLEM_MAX);
                    setProblem(next);
                    setFittedTo(next.trim());
                    setFailure(null);
                }
            });
            return;
        }
        setEditingProblem(true);
    };
    const editPublic = () => {
        if (onEdit) {
            onEdit({kind: "public", text: publicText, min: MIN_PROBLEM, max: DEBATE_PUBLIC_TEXT_MAX, save: (text) => setPublicText(text.slice(0, DEBATE_PUBLIC_TEXT_MAX))});
            return;
        }
        setEditingPublic(true);
    };

    if (layout === "section") {
        return (
            <DebateSetupSection
                words={words}
                fromCall={fromCall}
                problem={problem}
                onEditProblem={editProblem}
                visibility={visibility}
                onVisibility={(option) => {
                    if (visibility === option) return;
                    setVisibility(option);
                    setPicked([]);
                    setTouched(false);
                    setMoreRows(0);
                    setFailure(null);
                }}
                draft={draft}
                drafting={drafting}
                publicText={publicText}
                onEditPublic={editPublic}
                stake={draft
                    ? (draftHasStakes && draft.creditsForWinner !== null
                        ? fillWords(words.debate.stakeNote, {credits: draft.creditsForWinner})
                        : stakeLine(draftHasStakes, draft.participants.length > 1
                            ? draft.participants.filter((participant) => !participant.isAskerOwned).length
                            : othersPicked(candidates ?? [], picked)))
                    : null}
                notes={
                    <>
                        {refusedPublic ? <SectionNote tone="warn">{words.debate.notPublic}</SectionNote> : null}
                        {publicBlocker ? <SectionNote>{publicBlocker}</SectionNote> : null}
                    </>
                }
                roster={!draft && !publicBlocker && visibility === "public" && optedIn === false ? (
                    <div className="flex items-start gap-3">
                        <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold leading-5 text-white">{words.roster.optIn}</span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-white/60">{words.roster.optInNote}</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => void optIn()}
                            disabled={rosterSaving}
                            role="switch"
                            aria-checked={false}
                            aria-label={words.roster.optIn}
                            className="mt-0.5 h-6 w-10 shrink-0 rounded-full bg-white/15 p-0.5 disabled:opacity-60"
                        >
                            <span className="block h-5 w-5 rounded-full bg-white" />
                        </button>
                    </div>
                ) : null}
                animals={!draft && !publicBlocker ? (
                    candidates === null ? (
                        <p className="text-[13px] text-white/50">{web.loadingAnimals}</p>
                    ) : candidates.length === 0 ? (
                        <SectionNote>{visibility === "public" ? web.noRoster : web.noOwnAnimals}</SectionNote>
                    ) : (
                        <div className="flex flex-col gap-1.5" data-testid="debate-animals">
                            {(visibility === "public" ? publicGroups(listed) : [{key: "all", title: null, rows: listed, note: null}]).map((group) => (
                                <div key={group.key} className="flex flex-col gap-1.5">
                                    {group.title ? (
                                        <p className="pt-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">{group.title}</p>
                                    ) : null}
                                    {group.rows.map((candidate) => (
                                        <SectionAnimalRow
                                            key={candidate.captureId}
                                            candidate={candidate}
                                            on={picked.includes(candidate.captureId)}
                                            taken={!picked.includes(candidate.captureId) && Boolean(candidate.speciesProfileId && pickedSpecies.has(candidate.speciesProfileId))}
                                            full={!picked.includes(candidate.captureId) && picked.length >= DEBATE_MAX_PICKS}
                                            words={words}
                                            onToggle={() => toggle(candidate)}
                                        />
                                    ))}
                                    {group.note ? <SectionNote testId="debate-no-others">{group.note}</SectionNote> : null}
                                </div>
                            ))}
                            {listed.length < candidates.length ? (
                                <button
                                    type="button"
                                    onClick={() => setMoreRows((current) => current + MORE_ROWS)}
                                    className="self-start py-1 text-xs font-bold text-primary-300 hover:text-primary-200"
                                    data-testid="debate-more-animals"
                                >
                                    {words.debate.moreAnimals} ›
                                </button>
                            ) : null}
                        </div>
                    )
                ) : null}
                stakeNote={!draft && visibility === "public" && picked.length > 0 && !publicBlocker ? (
                    hostOutOfHearts ? (
                        <>
                            {words.roster.offRoster}{" "}
                            <Link href={`/app/capture/${encodeURIComponent(heartless ?? host.captureId)}?tab=stats`} className="font-bold text-primary-200 underline-offset-2 hover:underline">{web.heal}</Link>
                        </>
                    ) : stakeLine(pickedOthers > 0, pickedOthers)
                ) : null}
                failure={failure}
                startHint={startHint}
                actions={draft ? (
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void approve()} disabled={working || drafting || publicText.trim().length < MIN_PROBLEM} className={PRIMARY_CHIP}>
                            {working ? web.posting : words.debate.approve}
                        </button>
                        {!drafting ? (
                            <button type="button" onClick={editPublic} disabled={working} className={SECONDARY_CHIP}>{web.edit}</button>
                        ) : null}
                        <button type="button" onClick={keepPrivate} disabled={working} className={SECONDARY_CHIP}>{web.keepPrivate}</button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void start()}
                            disabled={working || Boolean(publicBlocker) || hostOutOfHearts || picked.length === 0 || problem.trim().length < MIN_PROBLEM}
                            className={PRIMARY_CHIP}
                            data-testid="debate-start"
                        >
                            {working ? (visibility === "public" ? web.writingPublic : web.starting) : words.debate.begin}
                        </button>
                        <button type="button" onClick={close} disabled={working} className={SECONDARY_CHIP}>{words.debate.notNow}</button>
                    </div>
                )}
            />
        );
    }

    const body = draft ? (
        // Public: the anonymised text to approve. Nothing posts until then.
        <>
            <div className={`${rule} ${pad} py-3.5`}>
                <p className="text-sm font-black text-white">{words.debate.publicText}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">{words.debate.publicTextNote}</p>
                {drafting ? (
                    <p role="status" className="mt-3 text-sm text-white/55">{web.writingPublic}</p>
                ) : editingPublic ? (
                    <>
                        <label className="sr-only" htmlFor="debate-public-text">{words.debate.publicText}</label>
                        <textarea
                            id="debate-public-text"
                            value={publicText}
                            onChange={(event) => setPublicText(event.target.value.slice(0, DEBATE_PUBLIC_TEXT_MAX))}
                            rows={5}
                            maxLength={DEBATE_PUBLIC_TEXT_MAX}
                            autoFocus
                            className="mt-3 w-full resize-none border border-white/12 bg-white/[0.05] px-3.5 py-3 text-[15px] leading-6 text-white outline-none focus:border-primary-300/45"
                        />
                        <p className="mt-1 text-right text-[11px] tabular-nums text-white/40">{publicText.length} / {DEBATE_PUBLIC_TEXT_MAX}</p>
                    </>
                ) : (
                    <p className="mt-3 whitespace-pre-line border-l-2 border-white/15 pl-3 text-[15px] leading-6 text-white">{publicText}</p>
                )}
            </div>
            <p className={`${rule} ${pad} py-3 text-xs leading-5 text-white/70`} data-testid="debate-stake">{draft && draftHasStakes && draft.creditsForWinner !== null
                ? fillWords(words.debate.stakeNote, {credits: draft.creditsForWinner})
                : stakeLine(draftHasStakes, draft && draft.participants.length > 1
                    ? draft.participants.filter((participant) => !participant.isAskerOwned).length
                    : othersPicked(candidates ?? [], picked))}</p>
        </>
    ) : (
        <>
            {fromCall ? <p className={`${rule} ${pad} py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-200/85`}>{words.debate.fromCall}</p> : null}
            <div className={`${rule} ${pad} py-3`}>
                <div role="radiogroup" aria-label={words.debate.start} className="flex border border-white/10 bg-white/[0.04] p-[3px]">
                    {(["private", "public"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={visibility === option}
                            onClick={() => {
                                if (visibility === option) return;
                                setVisibility(option);
                                setPicked([]);
                                setTouched(false);
                                setFailure(null);
                            }}
                            className={`min-w-0 flex-1 truncate px-2 py-2 text-center text-[13px] font-black transition ${visibility === option ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                        >
                            {option === "private" ? words.debate.private : words.debate.public}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-white/60">{visibility === "private" ? words.debate.privateNote : words.debate.publicNote}</p>
            </div>
            {refusedPublic ? (
                <p role="status" className={`${rule} ${pad} bg-amber-400/[0.08] py-3 text-xs leading-5 text-amber-100`}>{words.debate.notPublic}</p>
            ) : null}

            {publicBlocker ? (
                <p className={`${rule} ${pad} py-3.5 text-sm leading-6 text-white/70`}>
                    {publicBlocker}
                </p>
            ) : (
                <>
                    {visibility === "public" && optedIn === false ? (
                        <div className={`flex items-start gap-3 ${rule} ${pad} py-3.5`}>
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
                    <div className={`flex items-baseline justify-between ${pad} pb-1 pt-3`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{words.debate.pickAnimals}</p>
                        <p className="text-[11px] font-semibold tabular-nums text-white/45">{fillWords(web.picked, {n: picked.length})}</p>
                    </div>
                    {candidates === null ? (
                        <p className={`${pad} py-3 text-sm text-white/45`}>{web.loadingAnimals}</p>
                    ) : candidates.length === 0 ? (
                        <p className={`${pad} py-3 text-sm leading-6 text-white/60`}>{visibility === "public" ? web.noRoster : web.noOwnAnimals}</p>
                    ) : (
                        <div className="flex flex-col pb-1">
                            {(visibility === "public" ? publicGroups(listed) : [{key: "all", title: null, rows: listed, note: null}]).map((group) => (
                                <div key={group.key} className="flex flex-col">
                                    {group.title ? (
                                        <p className={`${pad} pb-1 pt-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/40`}>{group.title}</p>
                                    ) : null}
                                    {group.rows.map(candidateRow)}
                                    {group.note ? (
                                        <p className={`${pad} py-2.5 text-xs leading-5 text-white/55`} data-testid="debate-no-others">{group.note}</p>
                                    ) : null}
                                </div>
                            ))}
                            {!showsAll && listed.length < candidates.length ? (
                                <button
                                    type="button"
                                    onClick={() => setShowsAll(true)}
                                    className={`${pad} py-2.5 text-left text-xs font-bold text-primary-200 hover:text-primary-100`}
                                >
                                    {words.debate.pickAnimals} ›
                                </button>
                            ) : null}
                        </div>
                    )}
                </>
            )}

            <div className={`border-t border-white/[0.08] ${pad} py-3`}>
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{web.problem}</p>
                    {!editingProblem ? (
                        <button type="button" onClick={editProblem} className="text-xs font-bold text-primary-200 hover:text-primary-100">
                            {web.edit}
                        </button>
                    ) : null}
                </div>
                {editingProblem ? (
                    <>
                        <label className="sr-only" htmlFor="debate-problem-sheet">{web.problem}</label>
                        <textarea
                            id="debate-problem-sheet"
                            value={problem}
                            onChange={(event) => setProblem(event.target.value.slice(0, DEBATE_PROBLEM_MAX))}
                            onBlur={() => setFittedTo(problem.trim())}
                            rows={3}
                            maxLength={DEBATE_PROBLEM_MAX}
                            autoFocus={initialProblem.trim().length > 0}
                            placeholder={web.problemPlaceholder}
                            className="mt-2 w-full resize-none border border-white/12 bg-white/[0.05] px-3 py-2.5 text-[15px] leading-6 text-white outline-none placeholder:text-white/35 focus:border-primary-300/45"
                        />
                    </>
                ) : (
                    <p className="mt-1.5 line-clamp-4 text-sm leading-6 text-white/85">{problem}</p>
                )}
            </div>
            {visibility === "public" && picked.length > 0 && !publicBlocker ? (
                <p className={`border-t border-white/[0.08] ${pad} py-3 text-xs leading-5 text-white/70`} data-testid="debate-stake">
                    {hostOutOfHearts ? (
                        <>
                            {words.roster.offRoster}{" "}
                            <Link href={`/app/capture/${encodeURIComponent(heartless ?? host.captureId)}?tab=stats`} className="font-bold text-primary-200 underline-offset-2 hover:underline">{web.heal}</Link>
                        </>
                    ) : stakeLine(pickedOthers > 0, pickedOthers)}
                </p>
            ) : null}
        </>
    );

    const actions = draft ? (
        <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void approve()} disabled={working || drafting || publicText.trim().length < MIN_PROBLEM} className={primaryButton}>
                {working ? web.posting : words.debate.approve}
            </button>
            {!drafting && !editingPublic ? (
                <button type="button" onClick={editPublic} disabled={working} className={quietButton}>{web.edit}</button>
            ) : null}
            <button type="button" onClick={keepPrivate} disabled={working} className={quietButton}>{web.keepPrivate}</button>
        </div>
    ) : (
        <button
            type="button"
            onClick={() => void start()}
            disabled={working || Boolean(publicBlocker) || hostOutOfHearts || picked.length === 0 || problem.trim().length < MIN_PROBLEM}
            className={`${primaryButton} w-full`}
        >
            {working ? (visibility === "public" ? web.writingPublic : web.starting) : words.debate.begin}
        </button>
    );

    return (
        <div role="dialog" aria-modal="true" aria-label={words.debate.start} className="fixed inset-0 z-[72] flex items-end justify-center bg-black/70 md:items-center">
            <div className="flex max-h-[92dvh] w-full max-w-lg flex-col border-t border-white/12 bg-canvas-950 md:border">
                <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display text-lg font-black text-white">{words.debate.start}</h2>
                        <p className="text-xs leading-5 text-white/55">{words.debate.startNote}</p>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        aria-label={closeLabel}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white"
                    >
                        ✕
                    </button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
                <div className="shrink-0 border-t border-white/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                    {failure ? <p role="alert" className="mb-2 text-xs leading-5 text-white/65">{failure}</p> : null}
                    {startHint ? <p className="mb-2 text-xs leading-5 text-white/55" data-testid="debate-start-hint">{startHint}</p> : null}
                    {actions}
                </div>
            </div>
        </div>
    );
}

/** A small line inside the section: a note, a reason, an error. */
function SectionNote({children, tone = "quiet", testId}: {children: ReactNode; tone?: "quiet" | "warn"; testId?: string}) {
    return (
        <p role={tone === "warn" ? "status" : undefined} className={`text-[12px] leading-[18px] ${tone === "warn" ? "text-amber-200" : "text-white/60"}`} data-testid={testId}>
            {children}
        </p>
    );
}

/** One animal to pick, compact: its face, name and Power, "Fits this best", and, picked, a neon outline and a check. */
function SectionAnimalRow({candidate, on, taken, full, words, onToggle}: {
    candidate: DebateCandidate;
    on: boolean;
    taken: boolean;
    full: boolean;
    words: CompanionWords;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={taken || full}
            aria-pressed={on}
            title={taken ? words.picker.alreadyHereHint : undefined}
            // Inside the special message's own hairline, a row carries no border of its own at rest (no double
            // borders, DESIGN.md section 4); picked, its neon outline is the mark.
            className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors active:bg-white/[0.09] disabled:opacity-45 ${on ? "bg-primary-400/[0.1]" : "border-transparent bg-white/[0.04] hover:bg-white/[0.07]"}`}
            style={{...ROW_RADIUS, ...(on ? {borderColor: "var(--ask-special-edge)"} : {})}}
            data-testid="debate-animal-row"
        >
            <AskAnimalFace url={candidate.slug ? getSpeciesImageRoute(candidate.slug) : null} size={30} />
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="min-w-0 truncate text-[13px] font-bold leading-5 text-white">{taken ? words.picker.alreadyHere : debateAnimalName(candidate)}</span>
                    {candidate.fits ? (
                        <span className="shrink-0 text-[11px] font-black uppercase leading-4 tracking-[0.08em] text-primary-300" data-testid="debate-fits">{words.debate.suggested}</span>
                    ) : null}
                </span>
                <span className="block truncate text-[11px] font-semibold leading-4 text-white/50">{candidate.powerName ?? candidate.animal}</span>
            </span>
            <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${on ? "border-primary-300 bg-primary-300 text-black" : "border-white/25 text-transparent"}`}>✓</span>
        </button>
    );
}

/**
 * The setup as a section of the animal's special message (docs/rich-chat/
 * SPEC.md, section 2.2), top to bottom: the label, the question in bold with
 * Edit, the animals, Private | Public, the notes, and its chips; or, for a
 * public debate, what people will see, to approve.
 */
function DebateSetupSection({
    words,
    fromCall,
    problem,
    onEditProblem,
    visibility,
    onVisibility,
    draft,
    drafting,
    publicText,
    onEditPublic,
    stake,
    notes,
    roster,
    animals,
    stakeNote,
    failure,
    startHint,
    actions
}: {
    words: CompanionWords;
    fromCall: boolean;
    problem: string;
    onEditProblem: () => void;
    visibility: DebateVisibility;
    onVisibility: (visibility: DebateVisibility) => void;
    draft: Debate | null;
    drafting: boolean;
    publicText: string;
    onEditPublic: () => void;
    stake: string | null;
    notes: ReactNode;
    roster: ReactNode;
    animals: ReactNode;
    stakeNote: ReactNode;
    failure: string | null;
    startHint: string | null;
    actions: ReactNode;
}) {
    const web = words.debateWeb;
    return (
        <section className="flex flex-col gap-3" aria-label={words.debate.setUp} data-testid="debate-setup">
            <div>
                <AskSpecialLabel icon={<GroupIcon />}>{words.debate.setUp}</AskSpecialLabel>
                {fromCall ? <p className="mt-0.5 text-[11px] font-semibold leading-4 text-white/55">{words.debate.fromCall}</p> : null}
            </div>
            {draft ? (
                <div className="flex flex-col gap-1.5" data-testid="debate-approval">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white/50">{words.debate.publicText}</p>
                    {drafting ? (
                        <p role="status" className="text-[14px] leading-6 text-white/55">{web.writingPublic}</p>
                    ) : (
                        <p className="whitespace-pre-line text-[15px] font-bold leading-6 text-white" data-testid="debate-public-text">{publicText}</p>
                    )}
                    <p className="text-[12px] leading-[18px] text-white/60">{words.debate.publicTextNote}</p>
                    {stake ? <p className="text-[12px] leading-[18px] text-white/70" data-testid="debate-stake">{stake}</p> : null}
                </div>
            ) : (
                <>
                    <p className="text-[15px] leading-6" data-testid="debate-question">
                        <span className={`font-bold ${problem.trim() ? "text-white" : "text-white/40"}`}>{problem.trim() || web.problemPlaceholder}</span>{" "}
                        <button type="button" onClick={onEditProblem} className="text-xs font-bold text-primary-300 hover:text-primary-200" data-testid="debate-edit-question">
                            {web.edit}
                        </button>
                    </p>
                    {notes}
                    {animals}
                    <div className="flex flex-col gap-1.5">
                        <div role="radiogroup" aria-label={words.debate.start} className="flex flex-wrap gap-1.5">
                            {(["private", "public"] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    role="radio"
                                    aria-checked={visibility === option}
                                    onClick={() => onVisibility(option)}
                                    className={`inline-flex min-h-8 items-center rounded-full border px-3.5 text-[12px] font-black transition-colors ${visibility === option ? "border-white bg-white text-black" : "border-white/15 text-white/70 hover:text-white"}`}
                                    data-testid={`debate-${option}`}
                                >
                                    {option === "private" ? words.debate.private : words.debate.public}
                                </button>
                            ))}
                        </div>
                        <SectionNote>{visibility === "private" ? words.debate.privateNote : words.debate.publicNote}</SectionNote>
                    </div>
                    {roster}
                    {stakeNote ? <SectionNote testId="debate-stake">{stakeNote}</SectionNote> : null}
                </>
            )}
            {failure ? <p role="alert" className="text-[12px] leading-[18px] text-white/70">{failure}</p> : null}
            {startHint ? <SectionNote testId="debate-start-hint">{startHint}</SectionNote> : null}
            {actions}
        </section>
    );
}

function GroupIcon() {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 9a2.3 2.3 0 1 0 0-4.6A2.3 2.3 0 0 0 7 9Zm6.5-.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.8 15.5a4.2 4.2 0 0 1 8.4 0m1-4.6a3.7 3.7 0 0 1 5 3.6" />
        </svg>
    );
}
