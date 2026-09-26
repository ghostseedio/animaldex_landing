/**
 * Deterministic native waveform geometry for each visual-signature type,
 * ported from `AnimalDex/Views/SystemDynamics/SystemWaveformGeometry.swift`.
 *
 * Pure functions of the resolved signature: no randomness, no timers.
 * Coordinates are normalized (x 0…1 left→right, y 0…1 top→bottom where smaller
 * y means higher activity).
 */

import {
    type SystemFrequency,
    type SystemVisualPhase,
    type SystemVisualSignature
} from "@/lib/system-dynamics";

export type WaveformPoint = {x: number; y: number};

export type WaveformStrand = {
    points: WaveformPoint[];
    /** Relative emphasis (1 = primary stroke). */
    emphasis: number;
};

export type WaveformRegion = {
    start: number;
    end: number;
    phase: SystemVisualPhase;
};

export type WaveformColorStop = {
    location: number;
    frequency: SystemFrequency;
};

export type WaveformRendering = {
    strands: WaveformStrand[];
    regions: WaveformRegion[];
    colorStops: WaveformColorStop[];
    /** Normalized x of a threshold rule, for phase-change grammars. */
    thresholdX: number | null;
    /**
     * Normalized y of a faint activity-ceiling reference, for grammars whose
     * meaning is "operates far below capacity" (steady low).
     */
    referenceY: number | null;
};

const SAMPLE_COUNT = 180;

// MARK: - Math

export function smoothstep(edge0: number, edge1: number, x: number) {
    if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

/** 0 outside [a, b], peaking at 1 in the middle. */
export function bell(a: number, b: number, x: number) {
    const mid = (a + b) / 2;
    return smoothstep(a, mid, x) * (1 - smoothstep(mid, b, x));
}

/** Triangle wave in -1…1 with the same phase convention as sin. */
export function triangle(phase: number) {
    return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

// MARK: - Builders

type Sample = {value: number; dx: number};

/**
 * Phase accumulator: integrating instantaneous frequency keeps a sine
 * continuous while its frequency changes across the trace.
 */
class PhaseAccumulator {
    value = 0;

    advance(cyclesPerUnit: number, dx: number) {
        this.value += 2 * Math.PI * cyclesPerUnit * dx;
    }
}

function strand(emphasis: number, y: (sample: Sample, phase: PhaseAccumulator) => number): WaveformStrand {
    const phase = new PhaseAccumulator();
    const dx = 1 / (SAMPLE_COUNT - 1);
    const points: WaveformPoint[] = [];
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
        const x = index * dx;
        const value = y({value: x, dx: index === 0 ? 0 : dx}, phase);
        points.push({x, y: Math.min(1, Math.max(0, value))});
    }
    return {points, emphasis};
}

function single(
    frequency: SystemFrequency,
    y: (sample: Sample, phase: PhaseAccumulator) => number
): WaveformRendering {
    return {
        strands: [strand(1, y)],
        regions: [],
        colorStops: [{location: 0, frequency}],
        thresholdX: null,
        referenceY: null
    };
}

// MARK: - Parameters

function oscillationParameters(frequency: SystemFrequency) {
    switch (frequency) {
        case "LOW": return {center: 0.62, amplitude: 0.16, cycles: 3};
        case "MID": return {center: 0.52, amplitude: 0.20, cycles: 7};
        default: return {center: 0.50, amplitude: 0.26, cycles: 14};
    }
}

function modeParameters(frequency: SystemFrequency) {
    switch (frequency) {
        case "LOW": return {center: 0.76, amplitude: 0.015, cycles: 1.5};
        case "MID": return {center: 0.55, amplitude: 0.08, cycles: 6};
        default: return {center: 0.42, amplitude: 0.24, cycles: 16};
    }
}

function phaseRegions(signature: SystemVisualSignature, boundaries: number[]): WaveformRegion[] {
    const ordered = (["baseline", "transition", "destination"] as const)
        .map((role) => signature.phases.find((phase) => phase.role === role))
        .filter((phase): phase is SystemVisualPhase => Boolean(phase));
    if (ordered.length !== 3 || boundaries.length !== 2) return [];
    return [
        {start: 0, end: boundaries[0], phase: ordered[0]},
        {start: boundaries[0], end: boundaries[1], phase: ordered[1]},
        {start: boundaries[1], end: 1, phase: ordered[2]}
    ];
}

function ambushRegions(signature: SystemVisualSignature): WaveformRegion[] {
    const baseline = signature.phases.find((phase) => phase.role === "baseline");
    const destination = signature.phases.find((phase) => phase.role === "destination");
    if (!baseline || !destination) return [];
    return [
        {start: 0, end: 0.64, phase: baseline},
        {start: 0.64, end: 0.735, phase: destination}
    ];
}

function pulseColorStops(signature: SystemVisualSignature, primary: SystemFrequency): WaveformColorStop[] {
    const source = signature.transition?.source ?? primary;
    const destination = signature.transition?.destination ?? "HIGH";
    return [
        {location: 0, frequency: source},
        {location: 0.63, frequency: source},
        {location: 0.66, frequency: destination},
        {location: 0.72, frequency: destination},
        {location: 0.75, frequency: source},
        {location: 1, frequency: source}
    ];
}

function adaptiveColorStops(
    signature: SystemVisualSignature,
    primary: SystemFrequency,
    includesHighEvent: boolean
): WaveformColorStop[] {
    const baseline = signature.phases.find((phase) => phase.frequency !== "HIGH")?.frequency ?? primary;
    if (!includesHighEvent) return [{location: 0, frequency: baseline}];
    return [
        {location: 0, frequency: baseline},
        {location: 0.79, frequency: baseline},
        {location: 0.81, frequency: "HIGH"},
        {location: 0.85, frequency: "HIGH"},
        {location: 0.87, frequency: baseline},
        {location: 1, frequency: baseline}
    ];
}

function multimodal(signature: SystemVisualSignature, primary: SystemFrequency): WaveformRendering {
    const modes = signature.phases.filter((phase) => phase.frequency);
    if (!modes.length) {
        return single(primary, (x, phase) => {
            phase.advance(6, x.dx);
            return 0.55 + 0.08 * Math.sin(phase.value);
        });
    }

    // Segment widths follow conceptual weights but never collapse below a readable minimum.
    const rawWeights = modes.map((mode) => mode.weight ?? 0);
    let widths: number[];
    if (rawWeights.some((value) => value > 0)) {
        const total = rawWeights.reduce((sum, value) => sum + value, 0);
        const clamped = rawWeights.map((value) => Math.max(0.18, value / total));
        const sum = clamped.reduce((total_, value) => total_ + value, 0);
        widths = clamped.map((value) => value / sum);
    } else {
        widths = new Array(modes.length).fill(1 / modes.length);
    }

    const boundaries = [0];
    for (const width of widths) boundaries.push(boundaries[boundaries.length - 1] + width);

    const regions: WaveformRegion[] = [];
    const stops: WaveformColorStop[] = [];
    modes.forEach((mode, index) => {
        const start = boundaries[index];
        const end = boundaries[index + 1];
        regions.push({start, end, phase: mode});
        const frequency = mode.frequency ?? primary;
        stops.push({location: start, frequency});
        stops.push({location: end, frequency});
    });

    const trace = strand(1, (x, phase) => {
        const found = boundaries.findIndex((boundary) => boundary > x.value);
        const index = Math.min(modes.length - 1, Math.max(0, found === -1 ? modes.length - 1 : found - 1));
        const params = modeParameters(modes[index].frequency ?? primary);
        phase.advance(params.cycles, x.dx);
        // Blend centres across the boundary so segments read as one trace.
        const boundary = boundaries[index];
        const previousCenter = index > 0
            ? modeParameters(modes[index - 1].frequency ?? primary).center
            : params.center;
        const blend = smoothstep(boundary, boundary + 0.03, x.value);
        const center = previousCenter + (params.center - previousCenter) * blend;
        const wave = modes[index].frequency === "HIGH" ? triangle(phase.value) : Math.sin(phase.value);
        return center + params.amplitude * wave;
    });

    return {strands: [trace], regions, colorStops: stops, thresholdX: null, referenceY: null};
}

// MARK: - Entry point

export function waveformRendering(signature: SystemVisualSignature): WaveformRendering {
    const primary = signature.primaryFrequency === "UNKNOWN" ? "MID" : signature.primaryFrequency;

    switch (signature.type) {
        case "STEADY_LOW": {
            const base = single(primary, (x, phase) => {
                phase.advance(1.5, x.dx);
                return 0.76 + 0.015 * Math.sin(phase.value);
            });
            return {...base, referenceY: 0.14};
        }

        case "OSCILLATING": {
            const params = oscillationParameters(primary);
            return single(primary, (x, phase) => {
                phase.advance(params.cycles, x.dx);
                const wave = primary === "HIGH" ? triangle(phase.value) : Math.sin(phase.value);
                return params.center + params.amplitude * wave;
            });
        }

        case "BURST_RECOVERY":
            return single(primary, (x, phase) => {
                phase.advance(2, x.dx);
                const baseline = 0.82 + 0.01 * Math.sin(phase.value);
                const rise = smoothstep(0.32, 0.40, x.value);
                const drop = smoothstep(0.50, 0.60, x.value);
                const recovery = smoothstep(0.60, 1.0, x.value);
                const peak = 0.10 + 0.02 * Math.sin(phase.value * 3);
                let y = baseline - (baseline - peak) * rise;
                y += (0.58 - 0.12) * drop;
                y += (0.82 - 0.58) * recovery;
                return y;
            });

        case "AMBUSH_PULSE":
            return {
                strands: [strand(1, (x, phase) => {
                    phase.advance(1.2, x.dx);
                    const baseline = 0.84 + 0.008 * Math.sin(phase.value);
                    const pulse = smoothstep(0.64, 0.665, x.value) - smoothstep(0.71, 0.735, x.value);
                    return baseline - (baseline - 0.12) * pulse;
                })],
                regions: ambushRegions(signature),
                colorStops: pulseColorStops(signature, primary),
                thresholdX: null,
                referenceY: null
            };

        case "PHASE_WAVE": {
            const source = signature.transition?.source ?? primary;
            const destination = signature.transition?.destination ?? "HIGH";
            return {
                strands: [strand(1, (x, phase) => {
                    const t = smoothstep(0.40, 0.62, x.value);
                    const cycles = 3.0 + 13.0 * t;
                    phase.advance(cycles, x.dx);
                    const center = 0.64 - 0.18 * t;
                    const amplitude = 0.045 + 0.175 * t * (0.85 + 0.15 * Math.sin(2 * Math.PI * 2.1 * x.value));
                    const instability = 0.06 * bell(0.40, 0.62, x.value) * Math.sin(2 * Math.PI * 7.3 * x.value + 1.1);
                    return center + amplitude * Math.sin(phase.value) + instability;
                })],
                regions: phaseRegions(signature, [0.40, 0.62]),
                colorStops: [
                    {location: 0, frequency: source},
                    {location: 0.40, frequency: source},
                    {location: 0.62, frequency: destination},
                    {location: 1, frequency: destination}
                ],
                thresholdX: 0.51,
                referenceY: null
            };
        }

        case "DISTRIBUTED_ADAPTIVE": {
            const segments = [
                {amplitude: 0.06, cycles: 4},
                {amplitude: 0.13, cycles: 9},
                {amplitude: 0.05, cycles: 2.5},
                {amplitude: 0.15, cycles: 12}
            ];
            const includesHighEvent = signature.phases.some((phase) => phase.frequency === "HIGH");
            return {
                strands: [strand(1, (x, phase) => {
                    const position = x.value * segments.length;
                    const index = Math.min(segments.length - 1, Math.floor(position));
                    const next = Math.min(segments.length - 1, index + 1);
                    const blend = smoothstep(0.85, 1.0, position - index);
                    const amplitude = segments[index].amplitude
                        + (segments[next].amplitude - segments[index].amplitude) * blend;
                    const cycles = segments[index].cycles
                        + (segments[next].cycles - segments[index].cycles) * blend;
                    phase.advance(cycles, x.dx);
                    let y = 0.56 + amplitude * Math.sin(phase.value);
                    if (includesHighEvent) {
                        const event = smoothstep(0.80, 0.815, x.value) - smoothstep(0.845, 0.86, x.value);
                        y -= (y - 0.14) * event;
                    }
                    return y;
                })],
                regions: [],
                colorStops: adaptiveColorStops(signature, primary, includesHighEvent),
                thresholdX: null,
                referenceY: null
            };
        }

        case "MULTIMODAL":
            return multimodal(signature, primary);

        case "NETWORK_SYNC": {
            const offsets = [-1.6, 0, 1.6];
            const strands = offsets.map((offset, index) => strand(index === 1 ? 1 : 0.7, (x, phase) => {
                phase.advance(5, x.dx);
                const sync = smoothstep(0.15, 0.72, x.value);
                const spread = (index - 1) * 0.11 * (1 - sync);
                return 0.5 + spread + 0.15 * Math.sin(phase.value + offset * (1 - sync));
            }));
            return {
                strands,
                regions: [],
                colorStops: [{location: 0, frequency: primary}],
                thresholdX: null,
                referenceY: null
            };
        }

        case "ROTATING_LOAD": {
            const laneCount = 3;
            const period = 0.22;
            const strands = Array.from({length: laneCount}, (_, lane) => strand(0.85, (x, phase) => {
                phase.advance(6, x.dx);
                const laneCenter = 0.30 + 0.20 * lane;
                const segment = Math.floor(x.value / period);
                const loadedLane = segment % laneCount;
                const segmentStart = segment * period;
                const segmentEnd = segmentStart + period;
                const load = loadedLane === lane
                    ? smoothstep(segmentStart, segmentStart + 0.03, x.value)
                        - smoothstep(segmentEnd - 0.03, segmentEnd, x.value)
                    : 0;
                return laneCenter - 0.11 * load + 0.01 * Math.sin(phase.value);
            }));
            return {
                strands,
                regions: [],
                colorStops: [{location: 0, frequency: primary}],
                thresholdX: null,
                referenceY: null
            };
        }

        default:
            return {strands: [], regions: [], colorStops: [], thresholdX: null, referenceY: null};
    }
}
