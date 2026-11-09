"use client";

/**
 * Debates v2 in the conversation's own shapes (docs/debates/V2.md; iOS
 * e15b474b and 390e5c2a, DebateComponents.swift and DebateAskPublicViews.swift),
 * each a section of the host's report message:
 *
 *   - a rated way: the animal (with "Wild" on a kind they have not caught),
 *     a thin fit bar (neon on the one Recommended), the way in bold, the
 *     recommendation's reason, its own Try (primary on the Recommended one),
 *     and "Why" for the lesson, where it fits and what it costs;
 *   - "Your qualities": what a pick adds, as chips;
 *   - Ask more animals: new suggestions to pick, then Bring them in;
 *   - "I solved it my way": whose ideas they used, the Power it earned, the
 *     kinds they could catch, the qualities;
 *   - Ask the public (the asker): what it means, the anonymous draft to read
 *     and change, Post it or Keep it private, then the words it went up as;
 *   - Add one of your animals (anyone who could vote on it).
 *
 * Faces are species icon art, never a capture photo.
 */

import {useEffect, useState, type ReactNode} from "react";
import {AskAnimalFace, AskSpecialLabel, AskWalkIcon} from "@/components/ask-animaldex/ask-messenger";
import {ASK_GROUP_COLORS} from "@/lib/ask-animaldex/group-thread";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {
    DEBATE_PUBLIC_TEXT_MAX,
    debateAnimalName,
    debateParticipantIsWild,
    type Debate,
    type DebateAskPublicStage,
    type DebateCandidate,
    type DebateParticipant,
    type DebateQuality,
    type DebateReportWay,
    type DebateSolution
} from "@/lib/debates";
import {debateFitLabel, debateQualitiesLabel, debateSolutionHeadline} from "@/lib/debate-words";

const CHIP = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-[14px] py-1.5 text-left text-xs leading-4 transition-colors disabled:opacity-50";
export const DEBATE_PRIMARY_CHIP = `${CHIP} bg-primary-400 font-black text-black hover:bg-primary-300 active:bg-primary-500`;
export const DEBATE_SECONDARY_CHIP = `${CHIP} border border-white/12 bg-white/[0.07] font-bold text-white hover:bg-white/10 active:bg-white/15`;
/** The picker rows: the panel radius token (globals.css). */
const ROW_RADIUS = {borderRadius: "var(--r-panel)"} as const;

function faceUrl(slug: string | null | undefined): string | null {
    return slug ? getSpeciesImageRoute(slug) : null;
}

function seatColor(seat: number): string {
    return ASK_GROUP_COLORS[Math.max(0, seat) % ASK_GROUP_COLORS.length];
}

function Note({children, testId}: {children: ReactNode; testId?: string}) {
    return <p className="text-[12px] leading-[18px] text-white/60" data-testid={testId}>{children}</p>;
}

function Working({children}: {children: ReactNode}) {
    return (
        <p role="status" className="flex items-center gap-2 text-[12px] leading-[18px] text-white/60">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin rounded-full border border-white/25 border-t-white/70 motion-reduce:animate-none" />
            {children}
        </p>
    );
}

/** "Wild": a kind the person hasn't caught, in a debate for its way. */
export function DebateWildTag({words}: {words: CompanionWords}) {
    return (
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold leading-4 text-white/60" title={words.debate.wildNote} data-testid="debate-wild">
            <LeafIcon />
            <span>{words.debate.wild}</span>
            <span className="sr-only">, {words.debate.wildNote}</span>
        </span>
    );
}

/** How well a way fits what the person told them: a thin bar, neon on the recommended one. No number on screen. */
export function DebateFitBar({fit, recommended, words}: {fit: number; recommended: boolean; words: CompanionWords}) {
    // Grows in once shown (no motion under Reduce Motion, where it is drawn full at once).
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(frame);
    }, []);
    return (
        <div role="img" aria-label={debateFitLabel(fit, words)} className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]" data-testid="debate-fit-bar">
            <div
                className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${recommended ? "bg-primary-400" : "bg-white/40"}`}
                style={{width: `${shown ? Math.max(0, Math.min(100, fit)) : 0}%`}}
            />
        </div>
    );
}

/** What a pick says about them: "YOUR QUALITIES" and a chip per quality. */
export function DebateQualitiesLine({qualities, words}: {qualities: readonly DebateQuality[]; words: CompanionWords}) {
    if (qualities.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5" role="group" aria-label={debateQualitiesLabel(qualities, words)} data-testid="debate-qualities">
            <p aria-hidden="true" className="flex items-center gap-1 text-[10px] font-black uppercase leading-4 tracking-[0.1em] text-white/60">
                <SparkleIcon />
                {words.debate.yourQualities}
            </p>
            <div aria-hidden="true" className="flex flex-wrap gap-1.5">
                {qualities.map((quality) => (
                    <span key={quality.label} className="inline-flex items-center gap-1 rounded-full border border-primary-300/40 bg-primary-400/10 px-2.5 py-1 text-[11px] font-bold leading-4 text-primary-300">
                        <span aria-hidden="true">+</span>
                        {quality.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** The animal at the head of a way: its face, its name in its colour (and Wild), its Power under it. */
function WayHead({participant, words, trailing}: {participant: DebateParticipant; words: CompanionWords; trailing?: ReactNode}) {
    return (
        <div className="flex items-center gap-2">
            <AskAnimalFace url={faceUrl(participant.slug)} size={28} />
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate text-[13px] font-bold leading-5" style={{color: seatColor(participant.seat)}}>{debateAnimalName(participant)}</span>
                    {debateParticipantIsWild(participant) ? <DebateWildTag words={words} /> : null}
                </span>
                {participant.powerName ? <span className="block truncate text-[11px] leading-4 text-white/45">{participant.powerName}</span> : null}
            </span>
            {trailing}
        </div>
    );
}

/**
 * V2: one way, quiet until wanted: its animal, a fit bar, the way in bold,
 * and its own Try (primary on the recommended one). The lesson, where it fits
 * and what it costs open under "Why". Once a way is chosen it says so in
 * place, with what earning its Power takes and the qualities it adds.
 */
export function DebateRatedWay({participant, way, recommended, why, words, chosenId, tried, onTryWay, choosing, choosingLabel, ownsSpecies, qualities, nextLine = null}: {
    participant: DebateParticipant;
    way: DebateReportWay;
    recommended: boolean;
    /** The recommendation's reason, on the recommended way only. */
    why: string | null;
    words: CompanionWords;
    chosenId: string | null;
    tried: boolean;
    /** The asker only. */
    onTryWay?: (participant: DebateParticipant) => void;
    choosing: string | null;
    choosingLabel: string;
    ownsSpecies: boolean;
    qualities: readonly DebateQuality[];
    /** Under the chosen way: the step it becomes and the Power doing it earns (`debateWayNextLine`). */
    nextLine?: string | null;
}) {
    const [open, setOpen] = useState(false);
    const name = debateAnimalName(participant);
    const reasons = [way.lesson, way.fits ? fillWords(words.debate.fitsWhen, {text: way.fits}) : null, way.costs ? fillWords(words.debate.costs, {text: way.costs})
        : null].filter((line): line is string => Boolean(line) && line !== why);
    const chosen = chosenId === participant.id;
    return (
        <div
            className="flex flex-col gap-1.5 pl-2.5"
            style={{boxShadow: `inset 2px 0 0 ${recommended ? "rgb(var(--c-primary-400) / 0.6)" : "var(--ask-hairline)"}`}}
            data-testid="debate-rated-way"
        >
            <WayHead
                participant={participant}
                words={words}
                trailing={recommended ? (
                    <span className="shrink-0 rounded-full bg-primary-400 px-2 py-0.5 text-[10px] font-bold leading-4 text-black" data-testid="debate-recommended">{words.debate.recommended}</span>
                ) : null}
            />
            {way.fit !== null ? <DebateFitBar fit={way.fit} recommended={recommended} words={words} /> : null}
            <p className="text-[14px] font-semibold leading-[22px] text-white">{way.way}</p>
            {recommended && why ? <p className="text-[13px] leading-5 text-white/70">{why}</p> : null}
            {open ? reasons.map((line) => <p key={line} className="text-[13px] leading-5 text-white/70">{line}</p>) : null}
            <div className="flex items-center gap-2">
                {chosen ? (
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold leading-4 text-primary-300" data-testid="debate-chosen">
                        <CheckIcon />
                        {fillWords(words.debate.youChose, {name})}
                    </p>
                ) : tried ? (
                    <p className="text-[12px] font-semibold leading-4 text-white/60" data-testid="debate-tried-way">{words.debate.didntWorkForYou}</p>
                ) : !chosenId && onTryWay ? (
                    <button
                        type="button"
                        onClick={() => onTryWay(participant)}
                        disabled={Boolean(choosing)}
                        className={recommended ? DEBATE_PRIMARY_CHIP : DEBATE_SECONDARY_CHIP}
                        data-testid="debate-try-way"
                    >
                        <AskWalkIcon />
                        {choosing === participant.id ? choosingLabel : fillWords(words.debate.tryWay, {name})}
                    </button>
                ) : null}
                <span className="flex-1" />
                {reasons.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setOpen((current) => !current)}
                        aria-expanded={open}
                        className="inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-white/45 hover:text-white/70"
                        data-testid="debate-why"
                    >
                        {words.debate.why}
                        <ChevronIcon open={open} />
                    </button>
                ) : null}
            </div>
            {chosen && nextLine ? <p className="text-[13px] font-semibold leading-5 text-white" data-testid="debate-way-next">{nextLine}</p> : null}
            {chosen && !ownsSpecies ? <p className="text-[11px] leading-4 text-white/55">{fillWords(words.debate.catchToEarn, {species: participant.animal})}</p> : null}
            {chosen ? <DebateQualitiesLine qualities={qualities} words={words} /> : null}
        </div>
    );
}

/** One animal to pick (Ask more, Add one of your animals): its face, name and Power, "Fits this best", Wild. */
function CandidateRow({candidate, words, on, disabled, trailing, onTap}: {
    candidate: DebateCandidate;
    words: CompanionWords;
    on?: boolean;
    disabled: boolean;
    trailing: ReactNode;
    onTap: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onTap}
            disabled={disabled}
            aria-pressed={on}
            className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors active:bg-white/[0.09] disabled:opacity-45 ${on ? "bg-primary-400/[0.1]" : "border-transparent bg-white/[0.04] hover:bg-white/[0.07]"}`}
            style={{...ROW_RADIUS, ...(on ? {borderColor: "var(--ask-special-edge)"} : {})}}
            data-testid="debate-candidate-row"
        >
            <AskAnimalFace url={faceUrl(candidate.slug)} size={30} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold leading-5 text-white">{debateAnimalName(candidate)}</span>
                {candidate.powerName ? <span className="block truncate text-[11px] leading-4 text-white/50">{candidate.powerName}</span> : null}
                {candidate.fits || candidate.kind === "wild" ? (
                    <span className="mt-0.5 flex items-center gap-2">
                        {candidate.fits ? <span className="text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-primary-300">{words.debate.suggested}</span> : null}
                        {candidate.kind === "wild" ? <DebateWildTag words={words} /> : null}
                    </span>
                ) : null}
            </span>
            {trailing}
        </button>
    );
}

function Tick({on}: {on: boolean}) {
    return <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${on ? "border-primary-300 bg-primary-300 text-black" : "border-white/25 text-transparent"}`}>✓</span>;
}

/** "Ask more animals": new suggestions to pick (the best fits already picked), then "Bring them in". */
export function DebateAskMoreSection({words, rows, picked, room, loading, bringing, problem, onToggle, onBring, onCancel}: {
    words: CompanionWords;
    rows: readonly DebateCandidate[];
    picked: readonly string[];
    room: number;
    loading: boolean;
    bringing: boolean;
    problem: string | null;
    onToggle: (id: string) => void;
    onBring: () => void;
    onCancel: () => void;
}) {
    return (
        <section className="flex flex-col gap-2.5" aria-label={words.debate.askMoreTitle} data-testid="debate-ask-more">
            <AskSpecialLabel icon={<PlusIcon />}>{words.debate.askMoreTitle}</AskSpecialLabel>
            {loading && rows.length === 0 ? <Working>{words.debateWeb.loadingAnimals}</Working> : null}
            {rows.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    {rows.map((candidate) => {
                        const on = picked.includes(candidate.id);
                        return (
                            <CandidateRow
                                key={candidate.id}
                                candidate={candidate}
                                words={words}
                                on={on}
                                disabled={bringing || (!on && picked.length >= room)}
                                trailing={<Tick on={on} />}
                                onTap={() => onToggle(candidate.id)}
                            />
                        );
                    })}
                </div>
            ) : null}
            {problem ? <p role="alert" className="text-[12px] leading-[18px] text-white/60">{problem}</p> : null}
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onBring} disabled={bringing || picked.length === 0} className={DEBATE_PRIMARY_CHIP} data-testid="debate-bring-more">
                    {bringing ? words.debateWeb.starting : words.debate.askMoreGo}
                </button>
                <button type="button" onClick={onCancel} disabled={bringing} className={DEBATE_SECONDARY_CHIP}>{words.debate.notNow}</button>
            </div>
        </section>
    );
}

/** "Reading how you solved it…" while the judge reads it. */
export function DebateJudgingSection({words}: {words: CompanionWords}) {
    return (
        <section data-testid="debate-judging">
            <Working>{words.debate.judging}</Working>
        </section>
    );
}

/**
 * What "I solved it my way" found: whose ideas they used (each with what of
 * it), the Powers it earned, the kinds they could catch, their qualities.
 */
export function DebateSolutionSection({debate, solution, words, locale}: {
    debate: Pick<Debate, "participants">;
    solution: DebateSolution;
    words: CompanionWords;
    locale?: string;
}) {
    return (
        <section className="flex flex-col gap-2.5" aria-label={words.debate.solvedMine} data-testid="debate-solution">
            <AskSpecialLabel icon={<SealIcon />}>{words.debate.solvedMine}</AskSpecialLabel>
            <p className="text-[15px] font-bold leading-6 text-white" data-testid="debate-solution-headline">{debateSolutionHeadline(debate, solution, words, locale)}</p>
            {solution.used.map((used) => {
                const participant = debate.participants.find((item) => item.seat === used.seat) ?? null;
                const earned = solution.powersEarned.find((power) => power.speciesProfileId !== null && power.speciesProfileId === used.speciesProfileId);
                return (
                    <div key={`${used.seat}-${used.animal}`} className="flex items-start gap-2">
                        <AskAnimalFace url={faceUrl(participant?.slug)} size={24} />
                        <span className="min-w-0 flex-1">
                            {used.note ? <span className="block text-[13px] leading-5 text-white">{used.note}</span> : null}
                            {earned ? (
                                <span className="mt-0.5 flex items-center gap-1 text-[12px] font-bold leading-4 text-primary-300">
                                    <BoltIcon />
                                    {fillWords(words.debate.powerEarned, {power: earned.powerName})}
                                </span>
                            ) : !used.caught ? (
                                <span className="mt-0.5 block text-[11px] leading-4 text-white/55">{fillWords(words.debate.catchToEarn, {species: used.animal})}</span>
                            ) : null}
                        </span>
                    </div>
                );
            })}
            <DebateQualitiesLine qualities={solution.qualities} words={words} />
        </section>
    );
}

/** One animal's way as the public reads it. */
export function DebatePublicWayRow({participant, way}: {participant: DebateParticipant; way: string}) {
    return (
        <div className="flex items-start gap-2" data-testid="debate-public-way">
            <AskAnimalFace url={faceUrl(participant.slug)} size={24} />
            <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold leading-5" style={{color: seatColor(participant.seat)}}>{debateAnimalName(participant)}</span>
                <span className="block text-[14px] leading-[22px] text-white">{way}</span>
            </span>
        </div>
    );
}

/**
 * Ask the public, the asker's side, under the report: [Ask the public] and
 * what it means before anything happens ([Prepare it] [Not now]); "Taking
 * out names and details…"; the draft to read and change, every way as
 * strangers will read it, [Post it] [Keep it private]; then "In public as"
 * and the words it went up as; or, too personal, that it stays private.
 */
export function DebateAskPublicSection({debate, stage, words, working, problem, draft, onDraft, onAsk, onPost, onKeepPrivate, onEdit}: {
    debate: Pick<Debate, "participants" | "publicWays">;
    stage: DebateAskPublicStage;
    words: CompanionWords;
    working: boolean;
    problem: string | null;
    /** The public text as the asker edits it before posting. */
    draft: string;
    onDraft: (text: string) => void;
    onAsk: () => void;
    onPost: () => void;
    onKeepPrivate: () => void;
    /** In the chat, Edit works in the message bar; elsewhere, in a field here. */
    onEdit?: () => void;
}) {
    const [explaining, setExplaining] = useState(false);
    const [editing, setEditing] = useState(false);
    const label = (title: string) => <AskSpecialLabel icon={<PeopleIcon />}>{title}</AskSpecialLabel>;
    const ways = (rows: DebateParticipant[]) => rows.flatMap((participant) => {
        const way = debate.publicWays[participant.id];
        return way ? [<DebatePublicWayRow key={participant.id} participant={participant} way={way} />] : [];
    });
    return (
        <section className="flex flex-col gap-2.5" aria-label={words.debate.askPublic} data-testid="debate-ask-public">
            {stage.kind === "available" ? (
                explaining ? (
                    <>
                        {label(words.debate.askPublicTitle)}
                        <Note>{words.debate.askPublicNote}</Note>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={onAsk} disabled={working} className={DEBATE_PRIMARY_CHIP} data-testid="debate-ask-public-go">
                                {working ? words.debate.askPublicDrafting : words.debate.askPublicGo}
                            </button>
                            <button type="button" onClick={() => setExplaining(false)} disabled={working} className={DEBATE_SECONDARY_CHIP}>{words.debate.notNow}</button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setExplaining(true)} className={DEBATE_SECONDARY_CHIP} data-testid="debate-ask-public-open">
                            <PeopleIcon />
                            {words.debate.askPublic}
                        </button>
                    </div>
                )
            ) : stage.kind === "drafting" ? (
                <>
                    {label(words.debate.askPublic)}
                    <Working>{words.debate.askPublicDrafting}</Working>
                </>
            ) : stage.kind === "reviewing" ? (
                <>
                    {label(words.debate.askPublic)}
                    <Note>{words.debate.askPublicReview}</Note>
                    {editing && !onEdit ? (
                        <>
                            <label className="sr-only" htmlFor="debate-public-draft">{words.debate.publicText}</label>
                            <textarea
                                id="debate-public-draft"
                                value={draft}
                                onChange={(event) => onDraft(event.target.value.slice(0, DEBATE_PUBLIC_TEXT_MAX))}
                                rows={4}
                                maxLength={DEBATE_PUBLIC_TEXT_MAX}
                                autoFocus
                                className="w-full resize-none border border-white/12 bg-white/[0.05] px-3 py-2.5 text-[14px] font-semibold leading-[22px] text-white outline-none focus:border-primary-300/45"
                                style={ROW_RADIUS}
                                data-testid="debate-public-draft"
                            />
                        </>
                    ) : (
                        <p className="text-[15px] leading-6" data-testid="debate-public-draft-text">
                            <span className="whitespace-pre-line font-bold text-white">{draft}</span>{" "}
                            <button type="button" onClick={() => (onEdit ? onEdit() : setEditing(true))} disabled={working} className="text-xs font-bold text-primary-300 hover:text-primary-200">
                                {words.debateWeb.edit}
                            </button>
                        </p>
                    )}
                    {ways(debate.participants).length > 0 ? <div className="flex flex-col gap-2">{ways(debate.participants)}</div> : null}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setEditing(false); onPost(); }} disabled={working || draft.trim().length < 10} className={DEBATE_PRIMARY_CHIP} data-testid="debate-post-public">
                            {working ? words.debateWeb.posting : words.debate.askPublicPost}
                        </button>
                        <button type="button" onClick={() => { setEditing(false); onKeepPrivate(); }} disabled={working} className={DEBATE_SECONDARY_CHIP} data-testid="debate-keep-private">
                            {words.debateWeb.keepPrivate}
                        </button>
                    </div>
                </>
            ) : stage.kind === "posted" ? (
                <>
                    {label(words.debate.askPublicPosted)}
                    <p className="text-[14px] font-semibold leading-[22px] text-white">{stage.text}</p>
                    {/* The animals other people added, with their ways. */}
                    {ways(debate.participants.filter((participant) => participant.kind === "community"))}
                </>
            ) : (
                <p className="flex items-center gap-1.5 text-[12px] font-semibold leading-4 text-white/60" data-testid="debate-public-refused">
                    <LockIcon />
                    {words.debate.notPublic}
                </p>
            )}
            {problem ? <p role="alert" className="text-[12px] leading-[18px] text-white/60">{problem}</p> : null}
        </section>
    );
}

/** Someone else's side of a debate asked in public: add one of their own animals; its way joins the vote. */
export function DebateOfferAnimalSection({words, picking, candidates, loading, offeringId, problem, onBegin, onOffer, onCancel}: {
    words: CompanionWords;
    picking: boolean;
    candidates: readonly DebateCandidate[];
    loading: boolean;
    offeringId: string | null;
    problem: string | null;
    onBegin: () => void;
    onOffer: (candidate: DebateCandidate) => void;
    onCancel: () => void;
}) {
    return (
        <section className="flex flex-col gap-2.5" aria-label={words.debate.offerAnimal} data-testid="debate-offer-animal">
            {picking ? (
                <>
                    <AskSpecialLabel icon={<PlusIcon />}>{words.debate.offerAnimalTitle}</AskSpecialLabel>
                    {loading && candidates.length === 0 ? <Working>{words.debateWeb.loadingAnimals}</Working> : null}
                    {candidates.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                            {candidates.map((candidate) => (
                                <CandidateRow
                                    key={candidate.id}
                                    candidate={candidate}
                                    words={words}
                                    disabled={offeringId !== null}
                                    trailing={offeringId === candidate.captureId
                                        ? <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border border-white/25 border-t-white/70 motion-reduce:animate-none" />
                                        : <span aria-hidden="true" className="shrink-0 text-white/45"><PlusIcon /></span>}
                                    onTap={() => onOffer(candidate)}
                                />
                            ))}
                        </div>
                    ) : null}
                    {offeringId ? <Working>{words.debate.offerAnimalWorking}</Working> : null}
                    {problem ? <p role="alert" className="text-[12px] leading-[18px] text-white/60">{problem}</p> : null}
                    <div>
                        <button type="button" onClick={onCancel} disabled={offeringId !== null} className={DEBATE_SECONDARY_CHIP}>{words.debate.notNow}</button>
                    </div>
                </>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={onBegin} className={DEBATE_SECONDARY_CHIP} data-testid="debate-offer-open">
                        <PlusIcon />
                        {words.debate.offerAnimal}
                    </button>
                </div>
            )}
        </section>
    );
}

// MARK: - Icons

function icon(path: ReactNode, strokeWidth = 2) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

export const DebateSealIcon = () => icon(<path d="M10 2.8l1.7 1.3 2.1-.2.6 2 1.8 1.1-.7 2 .7 2-1.8 1.1-.6 2-2.1-.2L10 15.2l-1.7-1.3-2.1.2-.6-2-1.8-1.1.7-2-.7-2 1.8-1.1.6-2 2.1.2Zm-2.6 6.4 1.8 1.8 3.4-3.6" />, 1.8);
export const DebatePlusIcon = () => icon(<path d="M10 6.5v7M6.5 10h7M3.5 10a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />);
const SealIcon = DebateSealIcon;
const PlusIcon = DebatePlusIcon;
const CheckIcon = () => icon(<path d="M3.5 10a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm3.5.2 2 2 4-4.2" />);
const BoltIcon = () => icon(<path d="M11 2.5 4.5 11h5l-1 6.5L15.5 9h-5Z" />);
const LeafIcon = () => (
    <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M16.5 3.5C9 3.5 4 7.4 4 13c0 1.2.3 2.3.8 3.2L3.5 17.5l1 1 1.4-1.4c.9.5 1.9.7 3.1.7 5.4 0 8.5-5 7.5-14.3ZM8 14.5l5-5" />
    </svg>
);
const SparkleIcon = () => icon(<path d="M10 3v3.5M10 13.5V17M3 10h3.5M13.5 10H17M5.5 5.5l2 2m5 5 2 2m0-9-2 2m-5 5-2 2" />, 1.8);
const PeopleIcon = () => icon(<path d="M7 9a2.3 2.3 0 1 0 0-4.6A2.3 2.3 0 0 0 7 9Zm6.5-.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.8 15.5a4.2 4.2 0 0 1 8.4 0m1-4.6a3.7 3.7 0 0 1 5 3.6" />);
const LockIcon = () => icon(<path d="M6 9V6.5a4 4 0 0 1 8 0V9M5 9h10v8H5Z" />);
function ChevronIcon({open}: {open: boolean}) {
    return (
        <svg viewBox="0 0 20 20" className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5.5 8 4.5 4.5L14.5 8" />
        </svg>
    );
}
