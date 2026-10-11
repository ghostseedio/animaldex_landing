"use client";

import Link from "@/app/[locale]/_components/link";
import {POWER_LOOP_ANCHORS} from "@/components/animal-detail/power-loop/power-loop-context";
import {POWER_LOOP_COPY, type PowerLoop, type PowerLoopStep} from "@/lib/power-loop";
import {fusedPowerAnchor} from "@/lib/fused-powers";

const NEON = "#A7F432";
const NEON_TEXT = "rgb(var(--c-primary-text-400))";

function scrollToStep(step: PowerLoopStep["id"]) {
    document.getElementById(POWER_LOOP_ANCHORS[step])?.scrollIntoView({behavior: "smooth", block: "start"});
}

/**
 * The Power Loop, first on the viewer's own Play tab: Training → Trials →
 * Battles → Fusion ↻, what each pays and what level it reaches, then one Next
 * strip with the single thing to do now. A full-width band like the Training
 * band under it, never an inset card. Ported from the iOS Power Loop.
 *
 * The step row is drawn for the eye and read as one sentence: screen readers
 * get `loop.accessibilityLabel` instead of four nodes, and the Next buttons
 * keep their own labels. Tapping a node scrolls to its section.
 */
export default function PowerLoopBar({
    loop,
    onStartTraining,
    onGoToTrials,
    battleHref,
    canBattle,
    onFuse
}: {
    loop: PowerLoop;
    onStartTraining: () => void;
    /** Puts the earn fork on its Trial arm; the bar then scrolls to it. */
    onGoToTrials: () => void;
    battleHref: string;
    /** False for a card that cannot be compared (a zoo capture): no Battle button, as on iOS. */
    canBattle: boolean;
    /** Null when this card has nothing to fuse with. */
    onFuse: (() => void) | null;
}) {
    const {next} = loop;

    return (
        <section className="flex flex-col border-b border-white/[0.08]">
            <div className="flex flex-col gap-1 px-5 pt-5">
                <h3 className="font-display text-2xl font-black leading-tight text-white">{POWER_LOOP_COPY.title}</h3>
                <p className="text-sm leading-6 text-white/70">{POWER_LOOP_COPY.subtitle}</p>
            </div>

            <p className="sr-only">{loop.accessibilityLabel}</p>
            {/* The ↻ sits on the connector past Fusion rather than in a fifth
                column, so the four captions keep the width they need at 360px. */}
            <div aria-hidden="true" className="relative grid grid-cols-4 pl-1 pr-4 pt-5">
                {loop.steps.map((step, index) => (
                    <StepNode key={step.id} step={step} isLast={index === loop.steps.length - 1} />
                ))}
                <span className="absolute right-1 top-5 flex h-8 items-center text-[15px] font-black" style={{color: NEON_TEXT}}>↻</span>
            </div>

            <p className="flex items-start gap-2 px-5 pb-4 pt-3 text-[11px] leading-4 text-white/50">
                <span aria-hidden="true" className="font-black" style={{color: NEON_TEXT}}>↻</span>
                <span>{POWER_LOOP_COPY.repeatLine}</span>
            </p>

            {/* The Next strip: lit from the left, like the Training band. */}
            <div className="flex flex-col gap-2 border-t border-white/[0.08] bg-white/[0.03] px-5 py-4" style={{boxShadow: `inset 3px 0 0 ${NEON}8C`}}>
                <p className="text-base font-bold leading-6 text-white">{next.title}</p>
                <p className="text-sm leading-6 text-white/70">{next.sentence}</p>
                <div className="flex flex-col gap-[3px] text-[11px]">
                    {next.reward ? <p className="font-black" style={{color: NEON_TEXT}}>{next.reward}</p> : null}
                    {next.level ? (
                        <p className="flex items-center gap-1 font-bold text-white">
                            <span aria-hidden="true">↗</span>{next.level}
                        </p>
                    ) : null}
                    {next.stake ? <p className="text-white/50">{next.stake}</p> : null}
                </div>

                <div className="mt-1 flex flex-col gap-2">
                    {next.step === "training" ? (
                        <PrimaryButton onClick={onStartTraining}>{POWER_LOOP_COPY.startTraining}</PrimaryButton>
                    ) : next.step === "fusion" && next.fusedPowerId ? (
                        // "Finish {name}": to that fused Power's row under Fuse Powers.
                        <PrimaryButton
                            onClick={() => {
                                document.getElementById(fusedPowerAnchor(next.fusedPowerId!))?.scrollIntoView({behavior: "smooth", block: "start"});
                            }}
                        >
                            {next.button ?? next.title}
                        </PrimaryButton>
                    ) : next.step === "trials" ? (
                        <PrimaryButton
                            onClick={() => {
                                onGoToTrials();
                                // After the fork has switched arms, so the anchor is in place.
                                window.requestAnimationFrame(() => scrollToStep("trials"));
                            }}
                        >
                            {POWER_LOOP_COPY.goToTrials}
                        </PrimaryButton>
                    ) : (
                        <>
                            {canBattle ? (
                                <Link
                                    href={battleHref}
                                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90"
                                    style={{backgroundColor: NEON}}
                                >
                                    {POWER_LOOP_COPY.battle} <span aria-hidden="true">→</span>
                                </Link>
                            ) : null}
                            {/* Fuse Powers leads when there is no Battle to lead (iOS). */}
                            {onFuse ? (
                                canBattle ? (
                                    <button
                                        type="button"
                                        onClick={onFuse}
                                        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-white/15 text-sm font-bold text-white"
                                    >
                                        <span aria-hidden="true" style={{color: NEON_TEXT}}>△</span> {POWER_LOOP_COPY.fusePowers}
                                    </button>
                                ) : (
                                    <PrimaryButton onClick={onFuse}>{POWER_LOOP_COPY.fusePowers}</PrimaryButton>
                                )
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

function PrimaryButton({onClick, children}: {onClick: () => void; children: React.ReactNode}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-black/90"
            style={{backgroundColor: NEON}}
        >
            {children} <span aria-hidden="true">→</span>
        </button>
    );
}

/**
 * One step: circle, label, reward caption, level chip. The connector runs from
 * this circle's centre to the next one's; after Fusion it runs on, dashed, to
 * the ↻ that sends the loop back round.
 */
function StepNode({step, isLast}: {step: PowerLoopStep; isLast: boolean}) {
    const done = step.status === "done";
    const current = step.status === "current";
    const upcoming = step.status === "upcoming";
    const lineLit = done || (current && step.repeats);

    return (
        <button
            type="button"
            tabIndex={-1}
            onClick={() => scrollToStep(step.id)}
            className="relative flex min-w-0 flex-col items-center gap-1 px-0.5 text-center"
        >
            <span
                className={`absolute left-1/2 top-4 h-0 w-full border-t-2 ${isLast ? "border-dashed" : ""}`}
                style={{borderColor: lineLit ? `${NEON}8C` : "rgb(var(--c-white) / 0.12)"}}
            />
            <span
                className={`relative grid h-8 w-8 place-items-center rounded-full text-[13px] font-black ${upcoming ? "border border-white/20 bg-black text-white/40" : ""}`}
                style={done
                    ? {backgroundColor: NEON, color: "rgba(0,0,0,0.85)"}
                    : current
                        ? {backgroundColor: "#000", boxShadow: `inset 0 0 0 2px ${NEON}, 0 0 0 3px ${NEON}2E`, color: NEON_TEXT}
                        : undefined}
            >
                {done ? "✓" : step.number}
                {current && step.repeats ? (
                    <span
                        className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full text-[9px] font-black text-black/85"
                        style={{backgroundColor: NEON}}
                    >
                        ↻
                    </span>
                ) : null}
            </span>
            <span className={`mt-0.5 text-[12px] font-bold leading-4 ${upcoming ? "text-white/40" : "text-white"}`}>{step.title}</span>
            <span className={`flex flex-col text-[10px] leading-[13px] ${upcoming ? "text-white/35" : "text-white/60"}`}>
                {/* Reward lines never wrap: "Costs 16 Credits" just fits a
                    360px column and a third line would not. */}
                {step.caption.map((line) => (
                    // Word captions ("Training complete", "Apply It Your Way")
                    // wrap inside their column instead of running into the next.
                    <span key={line} className={`tracking-[-0.01em] ${/^[+\d]|^Costs /.test(line) ? "whitespace-nowrap" : "break-words"}`}>{line}</span>
                ))}
            </span>
            {step.levelChip ? (
                <span
                    className="mt-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-black leading-3"
                    style={{color: NEON_TEXT, backgroundColor: `${NEON}24`}}
                >
                    {step.levelChipHasArrow ? <>↑ </> : null}{step.levelChip}
                </span>
            ) : null}
        </button>
    );
}
