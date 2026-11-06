"use client";

import {useMemo, useState, useSyncExternalStore} from "react";
import type {EnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import type {AnimalPower} from "@/lib/animal-powers";
import {parseAnimalPowerIcon} from "@/lib/animal-power-icon";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";
import {useAnimalPowerIcon} from "@/components/animal-detail/animal-powers/use-animal-power-icon";
import {CAPTURE_WORDS_EN, fillCaptureWords, type CaptureWords} from "@/lib/capture-words";

/**
 * The Animal Power band on Learn, ported from iOS `AnimalPowerGuideSection`.
 *
 * ONE Power surface, read top to bottom: see the Power, understand it, want
 * it. The name and lesson come first and the rows that explain it follow.
 * Earned, the band closes on what earning opened. It has no earning button:
 * since 3.2 the Power is earned with the animal, one step at a time in its
 * chat (docs/your-step/SPEC.md), which "Talk to it" opens.
 *
 * Nothing here reads a Pro entitlement: the Power, its explanation and its
 * earning action are core. The padlock marks ownership, never secrecy.
 */

const NEON = "#A7F432";
/** The muted glyph while a Power is not yet earned (iOS textTertiary). */
const MUTED = "#7E8781";
/** The padlock badge, distinct from both the neon and the muted glyph (iOS stateCaution). */
const LOCK_AMBER = "#FAB83D";
const BADGE_FILL = "#0D2A16";

/** The small amber padlock on the corner of a not-yet-earned Power's glyph. */
function LockBadge() {
    return (
        <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 flex h-[17px] w-[17px] items-center justify-center rounded-full"
            style={{background: BADGE_FILL, border: `1px solid ${LOCK_AMBER}8C`}}
        >
            <svg viewBox="0 0 24 24" width={9} height={9} fill={LOCK_AMBER} aria-hidden="true" focusable="false">
                <path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm3 0h4V7a2 2 0 0 0-4 0z" />
            </svg>
        </span>
    );
}

type RowId = "pattern" | "proof" | "continuum" | "practise" | "notice";

/**
 * Whether "Learn more" is open (iOS `AnimalPowerLearnMoreState`): one answer
 * for every card and species page, kept for the session only, never saved,
 * so a fresh load starts calm.
 */
let learnMoreExpanded = false;
const learnMoreListeners = new Set<() => void>();

function subscribeLearnMore(listener: () => void) {
    learnMoreListeners.add(listener);
    return () => {
        learnMoreListeners.delete(listener);
    };
}

function setLearnMoreExpanded(next: boolean) {
    learnMoreExpanded = next;
    learnMoreListeners.forEach((listener) => listener());
}

function useLearnMoreExpanded() {
    return useSyncExternalStore(subscribeLearnMore, () => learnMoreExpanded, () => false);
}

function Row({
    title,
    isOpen,
    onToggle,
    children
}: {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="border-t border-white/[0.08]">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="flex min-h-11 w-full items-center gap-3 text-left"
            >
                <span className="text-sm font-semibold text-white">{title}</span>
                <span aria-hidden="true" className={`ml-auto text-[10px] font-bold text-white/40 transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
            </button>
            {isOpen ? <div className="flex flex-col gap-3 pb-4 text-sm leading-6 text-white/70">{children}</div> : null}
        </div>
    );
}

export default function AnimalPowerBand({
    profile,
    power,
    speciesProfileId,
    words = CAPTURE_WORDS_EN.card
}: {
    profile: EnhancedAnimalPowerProfile;
    /**
     * Earned state for this Power. Null while loading, or when the species has
     * none — the band then shows the Power and simply draws no state.
     */
    power: AnimalPower | null;
    /** The species, for the Power's icon before `power` has loaded. */
    speciesProfileId?: string | null;
    words?: CaptureWords["card"];
}) {
    const [openRow, setOpenRow] = useState<RowId | null>(null);
    const isLearnMoreOpen = useLearnMoreExpanded();
    const toggle = (row: RowId) => setOpenRow((current) => (current === row ? null : row));

    const isEarned = power?.isEarned === true;
    // The CURRENT name from the viewer row wins: a rename shows through there
    // immediately, while the static profile can lag a deploy.
    const principleName = power?.principleName ?? profile.principleName;
    const expression = (power?.principleExpression ?? profile.principleExpression)?.trim() || null;
    const lesson = (power?.coreLesson ?? profile.coreLesson)?.trim() || null;
    const motto = (power?.shortMotto ?? profile.shortMotto)?.trim() || null;
    const enhanced = profile.availability === "enhanced";
    // Read here rather than inside AnimalPowerIcon: the header needs to know
    // whether a glyph exists to decide between it and the plain ✓ / 🔒.
    const iconSvg = useAnimalPowerIcon(power?.speciesProfileId ?? speciesProfileId);
    const hasIcon = useMemo(() => parseAnimalPowerIcon(iconSvg) !== null, [iconSvg]);
    const isLocked = power !== null && !isEarned;
    const hasRows = enhanced
        ? Boolean(profile.corePattern || profile.behavioralEvidence.length || profile.powerContinuum || profile.embodimentPractices.length || profile.reflectionQuestions.length)
        : Boolean(profile.biologicalBasis || profile.applicationExample);

    return (
        <section className="flex flex-col gap-4 border-b border-white/[0.08] bg-[#0F2A17]/55 px-5 py-6 font-sans">
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-xs font-bold" style={{color: NEON}}>⚡</span>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-white">{words.animalPower}</h3>
                    </span>
                    {/* Earned state, as a quiet label beside the section title.
                        State only — the action lives at the close of the band. */}
                    {power ? (
                        <span
                            className="ml-auto flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em]"
                            style={{color: isEarned ? NEON : "rgba(255,255,255,0.4)"}}
                        >
                            <span aria-hidden="true">{isEarned ? "✓" : "○"}</span>
                            {isEarned ? words.powerEarned : words.notYetEarned}
                        </span>
                    ) : null}
                </div>

                {/* The Power's own glyph leads its name: lit once earned, muted
                    with an amber padlock badge until then. The name is always
                    readable, and wraps rather than truncating. A Power with no
                    glyph yet keeps the plain ✓ / 🔒. */}
                {hasIcon ? (
                    <div className="flex items-start gap-3.5 pt-1">
                        <span className="relative mt-[3px] shrink-0" style={{color: isLocked ? MUTED : NEON}}>
                            <AnimalPowerIcon svg={iconSvg} size={30} gap={0} style={{display: "block"}} />
                            {isLocked ? <LockBadge /> : null}
                        </span>
                        <p className="min-w-0 break-words font-display text-[28px] font-extrabold leading-tight text-white">
                            {principleName}
                        </p>
                    </div>
                ) : (
                    <div className="flex items-baseline gap-2.5 pt-1">
                        {power ? (
                            <span aria-hidden="true" className="text-sm font-bold" style={{color: isEarned ? NEON : "rgba(255,255,255,0.4)"}}>
                                {isEarned ? "✓" : "🔒"}
                            </span>
                        ) : null}
                        <p className="break-words font-display text-[28px] font-extrabold leading-tight text-white">
                            {principleName}
                        </p>
                    </div>
                )}

                {expression ? <p className="text-base font-semibold text-white/90">{expression}</p> : null}
                {lesson ? <p className="text-sm leading-6 text-white/70">{lesson}</p> : null}
                {motto ? <p className="text-sm italic text-white/55">“{motto}”</p> : null}
            </div>

            {/* The name, motto and lesson are the Power at a glance; the rows
                that explain it wait behind one "Learn more" (iOS 06d80a58). */}
            {hasRows ? <div className="flex flex-col border-b border-white/[0.08]">
                <button
                    type="button"
                    onClick={() => setLearnMoreExpanded(!isLearnMoreOpen)}
                    aria-expanded={isLearnMoreOpen}
                    className="flex min-h-11 w-full items-center gap-2 border-t border-white/[0.08] text-left"
                    data-testid="power-learn-more"
                >
                    <span className="text-sm font-semibold" style={{color: NEON}}>{isLearnMoreOpen ? words.showLess : words.learnMore}</span>
                    <span aria-hidden="true" className={`ml-auto text-[10px] font-bold transition-transform ${isLearnMoreOpen ? "rotate-180" : ""}`} style={{color: NEON}}>⌄</span>
                </button>
                {!isLearnMoreOpen ? null : enhanced ? (
                    <>
                        {profile.corePattern ? (
                            <Row title={words.thePattern} isOpen={openRow === "pattern"} onToggle={() => toggle("pattern")}>
                                <p>{profile.corePattern}</p>
                            </Row>
                        ) : null}
                        {profile.behavioralEvidence.length ? (
                            <Row title={words.natureProof} isOpen={openRow === "proof"} onToggle={() => toggle("proof")}>
                                {profile.behavioralEvidence.map((item) => (
                                    <div key={item.title} className="flex flex-col gap-1">
                                        <p className="font-semibold text-white">{item.title}</p>
                                        <p>{item.observation}</p>
                                        {item.biologicalFunction ? <p className="text-white/55">{item.biologicalFunction}</p> : null}
                                        {item.interpretation ? <p className="text-white/55">{item.interpretation}</p> : null}
                                    </div>
                                ))}
                            </Row>
                        ) : null}
                        {profile.powerContinuum ? (
                            <Row title={words.howItShowsUp} isOpen={openRow === "continuum"} onToggle={() => toggle("continuum")}>
                                <p><span className="font-semibold text-orange-300">{words.tooLittle} · </span>{profile.powerContinuum.deficientExpression}</p>
                                <p><span className="font-semibold" style={{color: NEON}}>{words.balanced} · </span>{profile.powerContinuum.balancedExpression}</p>
                                <p><span className="font-semibold text-violet-300">{words.tooMuch} · </span>{profile.powerContinuum.excessExpression}</p>
                            </Row>
                        ) : null}
                        {profile.embodimentPractices.length ? (
                            <Row title={words.practise} isOpen={openRow === "practise"} onToggle={() => toggle("practise")}>
                                {profile.embodimentPractices.map((practice) => (
                                    <div key={practice.title} className="flex flex-col gap-1">
                                        <p className="font-semibold text-white">{practice.title}</p>
                                        <p>{practice.instruction}</p>
                                        {practice.animalConnection ? <p className="text-white/55">{practice.animalConnection}</p> : null}
                                        {practice.timeframe ? (
                                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">{practice.timeframe}</p>
                                        ) : null}
                                    </div>
                                ))}
                            </Row>
                        ) : null}
                        {profile.reflectionQuestions.length ? (
                            <Row title={words.noticeInYourLife} isOpen={openRow === "notice"} onToggle={() => toggle("notice")}>
                                <ul className="flex list-disc flex-col gap-2 pl-5">
                                    {profile.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}
                                </ul>
                            </Row>
                        ) : null}
                    </>
                ) : (
                    <>
                        {profile.biologicalBasis ? (
                            <Row title={words.natureProof} isOpen={openRow === "proof"} onToggle={() => toggle("proof")}>
                                <p>{profile.biologicalBasis}</p>
                            </Row>
                        ) : null}
                        {profile.applicationExample ? (
                            <Row title={words.practise} isOpen={openRow === "practise"} onToggle={() => toggle("practise")}>
                                <p>{profile.applicationExample}</p>
                            </Row>
                        ) : null}
                    </>
                )}
            </div> : null}

            {/* Earned: what earning opened. */}
            {isEarned ? (
                <div className="flex flex-col gap-2 pt-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{color: NEON}}>{words.unlocked}</p>
                    {[words.debates, words.fusion].map((title) => (
                        <p key={title} aria-label={fillCaptureWords(words.unlockedItem, {title})} className="flex items-center gap-[7px] text-xs text-white/60">
                            <span aria-hidden="true" className="text-[10px] font-black" style={{color: NEON}}>✓</span>
                            {title}
                        </p>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
