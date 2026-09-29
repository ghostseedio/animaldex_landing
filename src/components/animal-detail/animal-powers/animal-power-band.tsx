"use client";

import {useState} from "react";
import type {EnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import type {AnimalPower} from "@/lib/animal-powers";

/**
 * The Animal Power band on Learn, ported from iOS `AnimalPowerGuideSection`.
 *
 * ONE Power surface, read top to bottom as the journey:
 *
 *     see the Power -> understand it -> want it -> Earn this Power
 *
 * The name and lesson come first, the rows that explain it follow, and the band
 * CLOSES on the single action. Earning swaps that closing action for what it
 * opened. There is no second Power heading and no second button anywhere else
 * on Learn.
 *
 * Nothing here reads a Pro entitlement: the Power, its explanation and its
 * earning action are core. The padlock marks ownership, never secrecy.
 */

const NEON = "#A7F432";

type RowId = "pattern" | "proof" | "continuum" | "practise" | "notice";

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
    onEarnPower
}: {
    profile: EnhancedAnimalPowerProfile;
    /**
     * Earned state for this Power. Null while loading, or when the species has
     * none — the band then shows the Power and simply draws no state.
     */
    power: AnimalPower | null;
    /** Absent when there is no species to earn against, so the band draws no button. */
    onEarnPower?: (() => void) | null;
}) {
    const [openRow, setOpenRow] = useState<RowId | null>(null);
    const toggle = (row: RowId) => setOpenRow((current) => (current === row ? null : row));

    const isEarned = power?.isEarned === true;
    // The CURRENT name from the viewer row wins: a rename shows through there
    // immediately, while the static profile can lag a deploy.
    const principleName = power?.principleName ?? profile.principleName;
    const expression = (power?.principleExpression ?? profile.principleExpression)?.trim() || null;
    const lesson = (power?.coreLesson ?? profile.coreLesson)?.trim() || null;
    const motto = (power?.shortMotto ?? profile.shortMotto)?.trim() || null;
    const enhanced = profile.availability === "enhanced";

    return (
        <section className="flex flex-col gap-4 border-b border-white/[0.08] bg-[#0F2A17]/55 px-5 py-6 font-sans">
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-xs font-bold" style={{color: NEON}}>⚡</span>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-white">Animal Power</h3>
                    </span>
                    {/* Earned state, as a quiet label beside the section title.
                        State only — the action lives at the close of the band. */}
                    {power ? (
                        <span
                            className="ml-auto flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em]"
                            style={{color: isEarned ? NEON : "rgba(255,255,255,0.4)"}}
                        >
                            <span aria-hidden="true">{isEarned ? "✓" : "○"}</span>
                            {isEarned ? "Power earned" : "Not yet earned"}
                        </span>
                    ) : null}
                </div>

                {/* The name is always readable, and wraps rather than truncating. */}
                <div className="flex items-baseline gap-2.5 pt-1">
                    {power ? (
                        <span aria-hidden="true" className="text-sm font-bold" style={{color: isEarned ? NEON : "rgba(255,255,255,0.4)"}}>
                            {isEarned ? "✓" : "🔒"}
                        </span>
                    ) : null}
                    <p className="break-words font-display text-[28px] font-extrabold leading-tight text-white">{principleName}</p>
                </div>

                {expression ? <p className="text-base font-semibold text-white/90">{expression}</p> : null}
                {lesson ? <p className="text-sm leading-6 text-white/70">{lesson}</p> : null}
                {motto ? <p className="text-sm italic text-white/55">“{motto}”</p> : null}
            </div>

            <div className="flex flex-col border-b border-white/[0.08]">
                {enhanced ? (
                    <>
                        {profile.corePattern ? (
                            <Row title="The Pattern" isOpen={openRow === "pattern"} onToggle={() => toggle("pattern")}>
                                <p>{profile.corePattern}</p>
                            </Row>
                        ) : null}
                        {profile.behavioralEvidence.length ? (
                            <Row title="Nature Proof" isOpen={openRow === "proof"} onToggle={() => toggle("proof")}>
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
                            <Row title="How this Power shows up" isOpen={openRow === "continuum"} onToggle={() => toggle("continuum")}>
                                <p><span className="font-semibold text-orange-300">Too little · </span>{profile.powerContinuum.deficientExpression}</p>
                                <p><span className="font-semibold" style={{color: NEON}}>Balanced · </span>{profile.powerContinuum.balancedExpression}</p>
                                <p><span className="font-semibold text-violet-300">Too much · </span>{profile.powerContinuum.excessExpression}</p>
                            </Row>
                        ) : null}
                        {profile.embodimentPractices.length ? (
                            <Row title="Practise this Power" isOpen={openRow === "practise"} onToggle={() => toggle("practise")}>
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
                            <Row title="Notice this in your life" isOpen={openRow === "notice"} onToggle={() => toggle("notice")}>
                                <ul className="flex list-disc flex-col gap-2 pl-5">
                                    {profile.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}
                                </ul>
                            </Row>
                        ) : null}
                    </>
                ) : (
                    <>
                        {profile.biologicalBasis ? (
                            <Row title="Nature Proof" isOpen={openRow === "proof"} onToggle={() => toggle("proof")}>
                                <p>{profile.biologicalBasis}</p>
                            </Row>
                        ) : null}
                        {profile.applicationExample ? (
                            <Row title="Practise this Power" isOpen={openRow === "practise"} onToggle={() => toggle("practise")}>
                                <p>{profile.applicationExample}</p>
                            </Row>
                        ) : null}
                    </>
                )}
            </div>

            {/* How the band ends: the one earning action, or what earning opened. */}
            {isEarned ? (
                <div className="flex flex-col gap-2 pt-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{color: NEON}}>Play unlocked</p>
                    {["Comparison Battles", "Fusion"].map((title) => (
                        <p key={title} aria-label={`${title} unlocked`} className="flex items-center gap-[7px] text-xs text-white/60">
                            <span aria-hidden="true" className="text-[10px] font-black" style={{color: NEON}}>✓</span>
                            {title}
                        </p>
                    ))}
                </div>
            ) : power && onEarnPower ? (
                <button
                    type="button"
                    onClick={onEarnPower}
                    className="mt-1 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90"
                    style={{backgroundColor: NEON}}
                >
                    Earn this Power <span aria-hidden="true">→</span>
                </button>
            ) : null}
        </section>
    );
}
