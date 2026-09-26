"use client";

import {useId, useMemo} from "react";
import {
    type FrequencyWaveform,
    type SystemVisualSignature,
    frequencyColor
} from "@/lib/system-dynamics";
import {type WaveformStrand, waveformRendering} from "@/lib/system-waveform-geometry";

/**
 * SVG rendering of a resolved visual signature, mirroring iOS
 * `SystemWaveformView`. Deterministic, cheap (a few polylines), and never
 * dependent on colour alone: the accessibility label describes the shape and
 * the state relationship.
 */

const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 100;

type WaveformStyle = "compact" | "expanded";

function polyline(strand: WaveformStrand) {
    return strand.points
        .map((point) => `${(point.x * VIEW_WIDTH).toFixed(2)},${(point.y * VIEW_HEIGHT).toFixed(2)}`)
        .join(" ");
}

/** Legacy path: the raw row waveform, drawn only when the signature cannot be resolved. */
function LegacyWaveform({waveform, style}: {waveform: FrequencyWaveform; style: WaveformStyle}) {
    const points = waveform.points
        .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(" ");
    return (
        <svg
            viewBox={`0 0 ${waveform.viewBoxWidth} ${waveform.viewBoxHeight}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={waveform.accessibilityLabel ?? "Frequency waveform"}
            className={`w-full ${style === "compact" ? "h-[68px]" : "h-[128px]"}`}
        >
            {waveform.pathD ? (
                <path d={waveform.pathD} fill="none" stroke="#A7F432" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            ) : (
                <polyline points={points} fill="none" stroke="#A7F432" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}
        </svg>
    );
}

export default function SystemWaveform({
    signature,
    fallbackWaveform = null,
    style = "compact"
}: {
    signature: SystemVisualSignature;
    fallbackWaveform?: FrequencyWaveform | null;
    style?: WaveformStyle;
}) {
    const gradientId = useId();
    const rendering = useMemo(() => waveformRendering(signature), [signature]);

    if (signature.type === "UNKNOWN") {
        const hasGeometry = fallbackWaveform
            && (fallbackWaveform.points.length >= 2 || Boolean(fallbackWaveform.pathD));
        return hasGeometry ? <LegacyWaveform waveform={fallbackWaveform} style={style} /> : null;
    }

    if (!rendering.strands.length) return null;

    const expanded = style === "expanded";
    const lineWidth = expanded ? 2.4 : 2;
    // A single stop cannot make a gradient, so a one-colour trace is stroked flat.
    const stops = rendering.colorStops;
    const stroke = stops.length > 1 ? `url(#${gradientId})` : frequencyColor(stops[0]?.frequency ?? "MID");

    return (
        <div className="flex flex-col gap-2">
            <svg
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                preserveAspectRatio="none"
                role="img"
                aria-label={signature.accessibilityDescription}
                className={`w-full ${expanded ? "h-[128px]" : "h-[68px]"}`}
            >
                {stops.length > 1 ? (
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                            {stops.map((stop, index) => (
                                <stop
                                    key={`${stop.location}-${stop.frequency}-${index}`}
                                    offset={`${Math.min(100, Math.max(0, stop.location * 100))}%`}
                                    stopColor={frequencyColor(stop.frequency)}
                                />
                            ))}
                        </linearGradient>
                    </defs>
                ) : null}

                {/* Region bands name the phases the trace moves through. */}
                {expanded && rendering.regions.map((region, index) => (
                    <rect
                        key={`region-${index}`}
                        x={region.start * VIEW_WIDTH}
                        width={Math.max(0, (region.end - region.start) * VIEW_WIDTH)}
                        y={0}
                        height={VIEW_HEIGHT}
                        fill={region.phase.frequency ? frequencyColor(region.phase.frequency) : "#A78BFA"}
                        opacity={0.06}
                    />
                ))}

                {rendering.thresholdX != null ? (
                    <line
                        x1={rendering.thresholdX * VIEW_WIDTH}
                        x2={rendering.thresholdX * VIEW_WIDTH}
                        y1={0}
                        y2={VIEW_HEIGHT}
                        stroke="#A78BFA"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.55}
                    />
                ) : null}

                {expanded && rendering.referenceY != null ? (
                    <line
                        x1={0}
                        x2={VIEW_WIDTH}
                        y1={rendering.referenceY * VIEW_HEIGHT}
                        y2={rendering.referenceY * VIEW_HEIGHT}
                        stroke="#FFFFFF"
                        strokeWidth={1}
                        strokeDasharray="2 4"
                        opacity={0.16}
                    />
                ) : null}

                {rendering.strands.map((strand, index) => (
                    <polyline
                        key={`strand-${index}`}
                        points={polyline(strand)}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={lineWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={strand.emphasis}
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
            </svg>

            {expanded && rendering.regions.length ? (
                <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    {rendering.regions.map((region, index) => (
                        <span
                            key={`label-${index}`}
                            style={{flexGrow: Math.max(0.0001, region.end - region.start), flexBasis: 0}}
                            className="min-w-0 truncate"
                        >
                            {region.phase.name}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
