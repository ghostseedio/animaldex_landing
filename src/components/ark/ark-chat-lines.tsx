"use client";

/**
 * The Ark's lines in the animal chat (Part 2, docs/ark-next.md; captures +
 * thrive, 2026-11-11). Every one is a UI label, never the animal's words, and
 * none opens a window:
 *
 * - under a live step card, what the step does for the reader's animals of
 *   that kind ("If this works, your Komodo Dragons will thrive", "…will be in
 *   prime condition", "…will stay in prime condition", "…will thrive once one
 *   is aboard"), by the server's state and bands;
 * - in the thread, under the reply that finished a step that worked, what it
 *   did: "Your Komodo Dragons are thriving", the band it left them in, and the
 *   step's locked Ark Score points ("+30 Ark Score"). Fresh (it landed while
 *   the chat was open), it plays in;
 * - history: under a reply whose step brought an animal aboard (before
 *   captures did), the animal, with its icon; "See it in the Ark" opens the
 *   panel beside the chat on it, when the chat has one.
 * - under that line, when the reader may share it (founders contract,
 *   section 4): one calm moment, in place, never a window: the name question
 *   first when the server says to ask it, then "Share how this worked?".
 */

import {AskSpecialBubble} from "@/components/ask-animaldex/ask-messenger";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import {arkArrivalLine, arkStepOfferLine, type ArkStepOffer, type ArkWorldWords} from "@/lib/ark-world";
import {arkStepResultLines, type ArkStepResult, type ArkStepResultWords} from "@/lib/ark-thrive";
import {pluralAnimalName} from "@/lib/ark-population";
import {ARK_STORY_PROBLEM_MAX, ARK_STORY_STEP_MAX} from "@/lib/ark-founders";
import {useArkFounderShare} from "@/components/ark/use-ark-chat";

/** The line's words under an arrival (`companions.ark.founders`): the name question, the story, and the 18+ error. */
export type ArkFounderShareWords = {
    name: {ask: string; adult: string; yes: string; shown: string};
    share: {
        ask: string;
        askShort: string;
        stepLabel: string;
        problemPlaceholder: string;
        share: string;
        confirmShare: string;
        edit: string;
        notNow: string;
        shared: string;
        publicNote: string;
        notPublic: string;
        couldNotCheck: string;
        remove: string;
        removed: string;
    };
    error: {needsAdult: string};
};

export function ArkGlyph({className = "h-3.5 w-3.5"}: {className?: string}) {
    return (
        <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12.5h15l-2.2 3.2a2 2 0 0 1-1.7.8H6.4a2 2 0 0 1-1.7-.8z" />
            <path d="M6 12.5V8.8h8v3.7" />
            <path d="M10 8.8V3.5" />
            <path d="M10 4l3.2 2.2L10 7" />
        </svg>
    );
}

/** Under a live step: one quiet line with the Ark's mark, what the step does for their animals of this kind. */
export function ArkStepOfferNote({offer, words, locale}: {offer: ArkStepOffer; words: ArkWorldWords; locale: string}) {
    return (
        <p className="flex items-start gap-1.5 text-[12px] font-semibold leading-[18px] text-primary-200/90" data-testid={`ark-step-offer-${offer.state}`} data-band={offer.bandNow}>
            <span className="mt-[2px] shrink-0 text-primary-300"><ArkGlyph /></span>
            <span>{arkStepOfferLine(offer, words, locale, pluralAnimalName)}</span>
        </p>
    );
}

/**
 * In the thread, under the reply that finished a step that worked: what it
 * did for their animals of this kind, in the step card's own container, with
 * the kind's icon, the band in plain words, and the step's points.
 */
export function ArkStepResultLine({result, slug, fresh, words, locale, plain = true}: {
    result: ArkStepResult;
    slug: string | null;
    fresh: boolean;
    words: ArkStepResultWords;
    locale: string;
    /** The chat's plain thread (full width, as the step card); false beside the animal's face. */
    plain?: boolean;
}) {
    const lines = arkStepResultLines(result, words, locale, pluralAnimalName);
    if (!lines) return null;
    return (
        <div className={`pt-1.5 ${fresh ? "ask-ark-arrive" : ""}`} data-testid="ark-step-result" data-thrive={result.thriveAfter ?? undefined}>
            <AskSpecialBubble avatarUrl={null} showsFace={false} plain={plain}>
                <div className="flex items-center gap-3" role={fresh ? "status" : undefined}>
                    {slug ? (
                        <span className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6f1e7] ${fresh ? "ark-arrival-icon" : ""}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getSpeciesArtworkUrl(slug)} alt="" width={36} height={36} className="h-[82%] w-[82%] object-contain" />
                        </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-5 text-white">
                            <span className="mr-1.5 inline-block align-[-2px] text-primary-300"><ArkGlyph /></span>
                            {lines.line}
                        </p>
                        {lines.band || lines.points ? (
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                {lines.band ? (
                                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold leading-5 ${result.thriveAfter === "ordinary" ? "bg-white/[0.08] text-white/80" : "bg-primary-400/15 text-primary-200"}`}>{lines.band}</span>
                                ) : null}
                                {lines.points ? <span className="text-[12px] font-bold tabular-nums text-primary-300" data-testid="ark-step-result-points">{lines.points}</span> : null}
                            </p>
                        ) : null}
                    </div>
                </div>
            </AskSpecialBubble>
        </div>
    );
}

/** In the thread (history: a step brought it, before captures did): the animal that came aboard, with its icon. */
export function ArkArrivalLine({species, slug, fresh, words, locale, onSee, plain = true, animalId = null}: {
    species: string;
    slug: string;
    fresh: boolean;
    words: ArkWorldWords & {arrivalSee: string; founders?: ArkFounderShareWords};
    /** The animal that came aboard: its share line reads (as the reader) whether its story may be shared. */
    animalId?: string | null;
    locale: string;
    /** Opens the Ark panel beside the chat on this animal; left out where the chat has none. */
    onSee?: () => void;
    /** The chat's plain thread (full width, as the step card); false beside the animal's face. */
    plain?: boolean;
}) {
    return (
        <div className={`pt-1.5 ${fresh ? "ask-ark-arrive" : ""}`} data-testid="ark-arrival">
            {/* The step card's own container, lined up with the animal's messages (as the reveal's numbers). */}
            <AskSpecialBubble avatarUrl={null} showsFace={false} plain={plain}>
                <div className="flex items-center gap-3" role={fresh ? "status" : undefined}>
                    <span className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f6f1e7] ${fresh ? "ark-arrival-icon" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getSpeciesArtworkUrl(slug)} alt="" width={36} height={36} className="h-[82%] w-[82%] object-contain" />
                    </span>
                    <p className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-white">
                        <span className="mr-1.5 inline-block align-[-2px] text-primary-300"><ArkGlyph /></span>
                        {arkArrivalLine(species, words, locale)}
                    </p>
                    {onSee ? (
                        <button
                            type="button"
                            onClick={onSee}
                            className="shrink-0 rounded-full border border-white/14 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-200"
                            data-testid="ark-arrival-see"
                        >
                            {words.arrivalSee}
                        </button>
                    ) : null}
                </div>
                {words.founders && animalId ? <ArkFounderShareLine animalId={animalId} species={species} words={words.founders} /> : null}
            </AskSpecialBubble>
        </div>
    );
}

const CHIP = "inline-flex min-h-8 items-center justify-center rounded-full px-3 text-[12px] font-semibold transition-colors disabled:opacity-60";
const CHIP_PRIMARY = `${CHIP} bg-primary-400 text-canvas-950 hover:bg-primary-300`;
const CHIP_PLAIN = `${CHIP} border border-white/14 text-white hover:border-primary-400 hover:text-primary-200`;
const CHIP_QUIET = `${CHIP} text-ink-300 hover:text-white`;

/** The check mark of a line that is done ("Shared on the Ark", "Your name shows on the Ark"). */
function Tick() {
    return <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" /></svg>;
}

/**
 * One calm moment under the arrival (founders contract, section 4), in place:
 * first, when the server says to ask, "Show your name on the Ark? I'm 18 or
 * over" (Yes, show my name / Not now); either answer moves the same line on to
 * the story: collapsed (the prefilled step in one line, Share / Edit / Not
 * now), expanded to edit, or shared (Edit / Remove from the Ark). Nothing is
 * shared without a tap and the problem is never prefilled. While the 18+
 * confirmation is still needed, Share reads "I'm 18 or over, share".
 */
export function ArkFounderShareLine({animalId, species, words}: {animalId: string; species: string | null; words: ArkFounderShareWords}) {
    const {state, nameYes, nameNotNow, share, edit, notNow, remove, setStep, setProblem} = useArkFounderShare({animalId, species, enabled: true});
    if (state.phase === "loading") return null;
    const shownNote = state.nameShown ? (
        <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold leading-4 text-primary-200" role="status" data-testid="ark-name-shown"><Tick />{words.name.shown}</p>
    ) : null;
    // "Not now" to the story after a yes to the name: the name's line stays, the rest goes.
    if (state.phase === "hidden") return shownNote ? <div className="mt-3 border-t border-white/10 pt-3">{shownNote}</div> : null;
    const w = words.share;
    const error = state.error === "not_public" ? w.notPublic : state.error === "needs_adult" ? words.error.needsAdult : state.error === "could_not_check" ? w.couldNotCheck : null;
    const errorLine = error ? <p className="mt-2 text-[12px] font-semibold leading-4 text-[#ffb4a8]" role="alert" data-testid="ark-share-error">{error}</p> : null;
    const shareLabel = state.needsAdult ? w.confirmShare : w.share;
    return (
        <div className="mt-3 border-t border-white/10 pt-3" data-testid={`ark-share-${state.phase}`}>
            {state.phase === "name" ? (
                <>
                    <p className="text-[13px] font-semibold leading-5 text-white">{words.name.ask}</p>
                    <p className="mt-0.5 text-[12px] leading-4 text-ink-300">{words.name.adult}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void nameYes()} disabled={state.busy} className={CHIP_PRIMARY} data-testid="ark-name-yes">{words.name.yes}</button>
                        <button type="button" onClick={nameNotNow} disabled={state.busy} className={CHIP_QUIET} data-testid="ark-name-not-now">{w.notNow}</button>
                    </div>
                    {errorLine}
                </>
            ) : state.phase === "collapsed" ? (
                <>
                    {shownNote}
                    <p className="text-[13px] font-semibold leading-5 text-white">{state.nameAsked ? w.askShort : w.ask}</p>
                    {state.step ? <p className="mt-0.5 truncate text-[12px] leading-4 text-ink-300" data-testid="ark-share-preview">{state.step}</p> : null}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void share()} disabled={state.busy} className={CHIP_PRIMARY} data-testid="ark-share-share">{shareLabel}</button>
                        <button type="button" onClick={edit} disabled={state.busy} className={CHIP_PLAIN} data-testid="ark-share-edit">{w.edit}</button>
                        <button type="button" onClick={notNow} disabled={state.busy} className={CHIP_QUIET} data-testid="ark-share-not-now">{w.notNow}</button>
                    </div>
                    {errorLine}
                </>
            ) : state.phase === "editing" ? (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void share();
                    }}
                >
                    {shownNote}
                    <label className="block text-[12px] font-semibold leading-4 text-ink-300" htmlFor={`ark-share-step-${animalId}`}>{w.stepLabel}</label>
                    <textarea
                        id={`ark-share-step-${animalId}`}
                        value={state.step}
                        onChange={(event) => setStep(event.target.value)}
                        maxLength={ARK_STORY_STEP_MAX}
                        rows={3}
                        className="mt-1 w-full resize-none rounded-xl border border-white/14 bg-white/[0.04] px-3 py-2 text-[13px] leading-5 text-white outline-none placeholder:text-ink-400 focus:border-primary-400"
                        data-testid="ark-share-step"
                    />
                    <input
                        type="text"
                        value={state.problem}
                        onChange={(event) => setProblem(event.target.value)}
                        maxLength={ARK_STORY_PROBLEM_MAX}
                        placeholder={w.problemPlaceholder}
                        aria-label={w.problemPlaceholder}
                        className="mt-2 w-full rounded-xl border border-white/14 bg-white/[0.04] px-3 py-2 text-[13px] leading-5 text-white outline-none placeholder:text-ink-400 focus:border-primary-400"
                        data-testid="ark-share-problem"
                    />
                    <p className="mt-2 text-[12px] leading-4 text-ink-400">{w.publicNote}</p>
                    {errorLine}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        <button type="submit" disabled={state.busy || state.step.trim().length < 3} className={CHIP_PRIMARY} data-testid="ark-share-share">{shareLabel}</button>
                        <button type="button" onClick={notNow} disabled={state.busy} className={CHIP_QUIET} data-testid="ark-share-not-now">{w.notNow}</button>
                    </div>
                </form>
            ) : state.phase === "shared" ? (
                <>
                    {shownNote}
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold leading-5 text-primary-200"><Tick />{w.shared}</p>
                    {state.story ? <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-ink-300">{state.story.step}</p> : null}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        <button type="button" onClick={edit} disabled={state.busy} className={CHIP_PLAIN} data-testid="ark-share-edit">{w.edit}</button>
                        <button type="button" onClick={() => void remove()} disabled={state.busy} className={CHIP_QUIET} data-testid="ark-share-remove">{w.remove}</button>
                    </div>
                    {errorLine}
                </>
            ) : (
                <>
                    {shownNote}
                    <p className="text-[12px] font-semibold leading-4 text-ink-300" role="status">{w.removed}</p>
                </>
            )}
        </div>
    );
}
