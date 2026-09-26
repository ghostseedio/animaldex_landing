"use client";

import {useMemo, useState, type ReactNode} from "react";
import {
    type SpeciesSystemDynamics,
    behaviorCompactTitle,
    displayHeadline,
    hasLongerExplanation,
    isRenderable,
    mechanismLabel,
    resolveVisualSignature,
    shortExplanation,
    showsMechanismSeparately,
    summaryStateLine
} from "@/lib/system-dynamics";
import SystemStateRow, {FrequencyStateChip} from "@/components/animal-detail/system-dynamics/frequency-chip";
import SystemWaveform from "@/components/animal-detail/system-dynamics/system-waveform";
import CrossDomainBrowser from "@/components/animal-detail/system-dynamics/cross-domain-browser";

/**
 * System Dynamics for the Learn tab, ported from iOS `SystemDynamicsHeroCard`
 * and `SystemDynamicsDetailView`.
 *
 * Collapsed: system identity, state relationship, native waveform, one short
 * state line, and the Explore CTA. Expanded: identity → state hero → one
 * explanation → Across Reality → failure mode. No lesson content.
 */

const ACCENT = "#A7F432";

function FailureModes({dynamics}: {dynamics: SpeciesSystemDynamics}) {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!dynamics.failureModes.length) return null;

    return (
        <section className="flex flex-col">
            <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                aria-expanded={isExpanded}
                className="flex min-h-11 items-center gap-2.5 text-left"
            >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-orange-400/90" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 4 2.5 20h19L12 4Z" strokeLinejoin="round" />
                    <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-[0.11em] text-white">Failure Mode</span>
                <span className="ml-auto text-[10px] font-semibold text-white/40">{dynamics.failureModes.length}</span>
                <span aria-hidden="true" className={`text-[10px] font-bold text-white/40 transition-transform ${isExpanded ? "rotate-90" : ""}`}>›</span>
            </button>

            {isExpanded ? (
                <div className="mt-2 flex flex-col gap-3">
                    {dynamics.failureModes.map((mode, index) => (
                        <div key={`${mode.title}-${index}`} className={index > 0 ? "border-t border-white/[0.08] pt-3" : ""}>
                            <div className="flex flex-wrap items-center gap-2">
                                {mode.frequency ? <FrequencyStateChip frequency={mode.frequency} size="compact" /> : null}
                                <p className="text-sm font-bold text-white">{mode.title}</p>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-white/55">{mode.explanation}</p>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
}

export default function SystemDynamicsPanel({
    dynamics,
    animalName,
    /**
     * A viewer without Pro sees the identical card — iOS shows them
     * `SystemDynamicsProTeaser`, which is this same compact layout — but the
     * closing affordance upgrades instead of opening the full guide, and the
     * guide itself never mounts because the payload carries no interpretation.
     */
    locked = false,
    lockedAction
}: {
    dynamics: SpeciesSystemDynamics;
    animalName: string;
    locked?: boolean;
    lockedAction?: ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [showsFullExplanation, setShowsFullExplanation] = useState(false);
    const signature = useMemo(() => resolveVisualSignature(dynamics), [dynamics]);

    if (!isRenderable(dynamics)) return null;

    const headline = displayHeadline(dynamics);
    const mechanism = mechanismLabel(dynamics);
    const behaviorTag = behaviorCompactTitle(dynamics.frequencyProfile.behavior).toUpperCase();
    const stateLine = summaryStateLine(dynamics);
    const full = dynamics.signatureExplanation?.trim() ?? null;
    const short = shortExplanation(dynamics);

    const identity = (
        <>
            <p className="text-2xl font-bold leading-tight text-white">{headline}</p>
            {showsMechanismSeparately(dynamics) ? (
                <p className="text-xs text-white/40">{mechanism}</p>
            ) : null}
        </>
    );

    const card = (open: (() => void) | null) => {
        const Wrapper = open ? "button" : "div";
        return (
            <Wrapper
                {...(open ? {type: "button" as const, onClick: open, "aria-label": `${signature.accessibilityDescription} Opens the full System Dynamics guide.`} : {})}
                className="flex w-full flex-col gap-3 text-left"
            >
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.11em]" style={{color: ACCENT}}>
                        System Dynamics
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">{behaviorTag}</span>
                </div>

                <div className="flex flex-col gap-0.5">{identity}</div>

                <SystemStateRow signature={signature} profile={dynamics.frequencyProfile} style="compact" />
                <SystemWaveform signature={signature} fallbackWaveform={dynamics.waveform} style="compact" />

                {stateLine ? <p className="text-sm text-white/70">{stateLine}</p> : null}

                {open ? (
                    <span className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold" style={{color: ACCENT}}>
                        Explore System Dynamics <span aria-hidden="true">›</span>
                    </span>
                ) : null}
            </Wrapper>
        );
    };

    if (locked) {
        return (
            <div className="flex flex-col gap-4 border border-line-300 bg-white/[0.035] p-4">
                {card(null)}
                {lockedAction}
            </div>
        );
    }

    if (!isOpen) {
        return card(() => setIsOpen(true));
    }

    return (
        <div className="flex flex-col gap-7">
            {/* Header: species → principle → mechanism → behaviour tag. */}
            <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-semibold text-white/40">{animalName}</p>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="min-h-8 text-xs font-semibold text-white/50 hover:text-white"
                    >
                        Close
                    </button>
                </div>
                {identity}
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{color: ACCENT}}>
                    {behaviorTag} · AnimalDex system profile
                </p>
            </div>

            {/* Hero: state relationship, waveform, explanation. */}
            <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                <SystemStateRow signature={signature} profile={dynamics.frequencyProfile} style="expanded" />
                <SystemWaveform signature={signature} fallbackWaveform={dynamics.waveform} style="expanded" />

                {full ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm leading-6 text-white/70">
                            {showsFullExplanation ? full : short ?? full}
                        </p>
                        {hasLongerExplanation(dynamics) ? (
                            <button
                                type="button"
                                onClick={() => setShowsFullExplanation((current) => !current)}
                                className="min-h-8 w-fit text-xs font-semibold"
                                style={{color: ACCENT}}
                            >
                                {showsFullExplanation ? "Show less" : "Read full explanation"}
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {dynamics.crossDomainMatrix.length ? (
                <CrossDomainBrowser mappings={dynamics.crossDomainMatrix} transition={signature.transition} />
            ) : null}

            <FailureModes dynamics={dynamics} />
        </div>
    );
}
