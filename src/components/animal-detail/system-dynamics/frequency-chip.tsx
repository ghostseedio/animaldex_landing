"use client";

import {
    type SystemFrequency,
    type SystemFrequencyProfile,
    type SystemStateTransition,
    type SystemVisualSignature,
    frequencyColor,
    frequencyCompactLabel,
    frequencyDisplayTitle,
    modeStateName,
    signatureShapeLabel
} from "@/lib/system-dynamics";

/** Threshold / transition marks are not a frequency, so not a frequency colour. */
const TRANSITION_ACCENT = "#A78BFA";

/** `● LOW` / `● MID` / `⚡ HIGH`. Never truncates; "frequency" is implied by context. */
export function FrequencyStateChip({
    frequency,
    size = "compact"
}: {
    frequency: SystemFrequency;
    size?: "compact" | "regular";
}) {
    const color = frequencyColor(frequency);
    const compact = size === "compact";

    return (
        <span
            aria-label={frequencyDisplayTitle(frequency)}
            className={`inline-flex shrink-0 items-center gap-[5px] rounded-full border font-bold text-white ${
                compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"
            }`}
            style={{
                backgroundColor: `${color}1F`,
                borderColor: `${color}59`
            }}
        >
            {frequency === "HIGH" ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} fill={color}>
                    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                </svg>
            ) : (
                <span
                    aria-hidden="true"
                    className={compact ? "h-[6px] w-[6px] rounded-full" : "h-2 w-2 rounded-full"}
                    style={{backgroundColor: color}}
                />
            )}
            {frequencyCompactLabel(frequency)}
        </span>
    );
}

function Node({
    name,
    frequency,
    weight,
    expanded,
    fills = true
}: {
    name: string;
    frequency: SystemFrequency;
    weight: number | null;
    expanded: boolean;
    fills?: boolean;
}) {
    return (
        <div className={`flex flex-col gap-1.5 ${fills ? "items-center" : "items-start"} ${expanded && fills ? "min-w-0 flex-1" : ""}`}>
            {expanded ? (
                <span className="h-4 max-w-full truncate text-[11px] font-semibold leading-4 text-white">{name}</span>
            ) : null}
            <FrequencyStateChip frequency={frequency} size={expanded ? "regular" : "compact"} />
            {expanded && weight != null ? (
                <span className="text-[10px] font-semibold text-white/40">{weight}%</span>
            ) : null}
        </div>
    );
}

function Connector({symbol, label, expanded}: {symbol: "arrow" | "switch" | "plus"; label?: string; expanded: boolean}) {
    const glyph = symbol === "arrow" ? "→" : symbol === "switch" ? "⇄" : "+";
    return (
        <div className="flex shrink-0 flex-col items-center gap-1.5">
            {expanded ? (
                <span className="h-4 text-[10px] font-semibold leading-4 text-white/40">{label ?? " "}</span>
            ) : null}
            <span className={`${expanded ? "flex h-[26px] items-center text-[13px]" : "text-[11px]"} font-bold text-white/40`}>
                {glyph}
            </span>
        </div>
    );
}

function TransitionNode({transition, expanded}: {transition: SystemStateTransition; expanded: boolean}) {
    const name = transition.triggerName ?? (transition.kind === "phaseChange" ? "Threshold" : "Trigger");
    return (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {expanded ? (
                <span className="h-4 max-w-full truncate text-[11px] font-semibold leading-4" style={{color: TRANSITION_ACCENT}}>
                    {name}
                </span>
            ) : null}
            <span className="flex h-[26px] items-center text-[13px] font-bold" style={{color: TRANSITION_ACCENT}}>
                {transition.kind === "phaseChange" ? "⟳" : "⚡"}
            </span>
        </div>
    );
}

/**
 * Shows how the system's states relate: a directional transition, coexisting
 * modes, adaptive switching, or a single defining frequency. Never forces one
 * visual sequence on every animal.
 */
export default function SystemStateRow({
    signature,
    profile,
    style = "compact"
}: {
    signature: SystemVisualSignature;
    profile: SystemFrequencyProfile;
    style?: "compact" | "expanded";
}) {
    const expanded = style === "expanded";
    const modes = profile.modes.filter((mode) => mode.frequency !== "UNKNOWN");
    const hasWeights = profile.modes.some((mode) => mode.weight != null);
    const gap = expanded ? "gap-1" : "gap-1.5";

    if (signature.transition) {
        const transition = signature.transition;
        return (
            <div className={`flex items-start ${gap}`} aria-label={signature.accessibilityDescription}>
                <Node name={transition.sourceName} frequency={transition.source} weight={null} expanded={expanded} />
                <Connector symbol="arrow" expanded={expanded} />
                {expanded ? (
                    <>
                        <TransitionNode transition={transition} expanded={expanded} />
                        <Connector symbol="arrow" expanded={expanded} />
                    </>
                ) : null}
                <Node name={transition.destinationName} frequency={transition.destination} weight={null} expanded={expanded} />
            </div>
        );
    }

    if (modes.length >= 2) {
        const isAdaptive = profile.behavior === "ADAPTIVE";
        return (
            <div className={`flex items-start ${gap}`} aria-label={signature.accessibilityDescription}>
                {modes.map((mode, index) => (
                    <div key={`${mode.frequency}-${index}`} className={`flex items-start ${gap} ${expanded ? "min-w-0 flex-1" : ""}`}>
                        {index > 0 ? (
                            <Connector
                                symbol={isAdaptive ? "switch" : "plus"}
                                label={isAdaptive ? "switches" : undefined}
                                expanded={expanded}
                            />
                        ) : null}
                        <Node
                            name={modeStateName(mode)}
                            frequency={mode.frequency}
                            weight={hasWeights ? mode.weight : null}
                            expanded={expanded}
                        />
                    </div>
                ))}
            </div>
        );
    }

    const only = modes[0];
    if (!only) return null;

    return (
        <div
            className={`flex gap-3 ${expanded ? "items-start" : "items-center"}`}
            aria-label={signature.accessibilityDescription}
        >
            <Node
                name={only.label ?? modeStateName(only)}
                frequency={only.frequency}
                weight={null}
                expanded={expanded}
                fills={false}
            />
            <span className={`text-[11px] font-semibold text-white/55 ${expanded ? "pt-[22px]" : ""}`}>
                {signatureShapeLabel(signature.type)}
            </span>
        </div>
    );
}
