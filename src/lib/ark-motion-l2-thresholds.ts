/**
 * Lane L2's CI thresholds (flight, swimming, legless; `ark-motion-l2.test.ts`). A deliberate change updates these in
 * the same commit, with why.
 */
export const MOTION_L2_THRESHOLDS = {
    /** The catalogue's birds: the fitted exponent of wing-beat rate against length (m^-0.33 with m ∝ L^2.9 is -0.96). */
    wingbeatSlopeMin: -1.1,
    wingbeatSlopeMax: -0.8,
    /** Radians between the frame's bank (instance roll plus the bank clip's own) and tan φ = v ω / g. */
    bankErrorMax: 0.01,
    /** A 2.2x burst against cruise: the beat ratio's error (played by distance, so it is the speed ratio). */
    tailBeatRatioError: 0.05,
    /** Lateral undulation: mean sideways slip against the head's track, as a share of the swing. */
    leglessSlipMax: 0.02,
    /** Up-and-down swimmers whose flukes break the surface at the top of their band, not breathing (after the guard). */
    surfaceBreachesMax: 0,
    /** Rigs: the hand's span at mid-upstroke over mid-downstroke (the published flap: 1.0). */
    upstrokeSpanRatioMax: 0.85,
    /** Rigs: an open-winged insect's wing-tip rise and fall (model units) once the driver beats it (the held glide: 0). */
    insectStrokeMin: 0.05,
    /** Rigs: a snake chain's mean sideways slip against its front's track, as a share of its swing. */
    rigSlipMax: 0.2,
    /**
     * Rigs: a chain driver's mean pose (ms) in the test's own loop. A guard against a pathological regression only (a
     * shared Mac under load measured 0.5 ms; idle 0.01-0.03 ms): the real figures are `scripts/ark-l2-perf.mts`'s.
     */
    poseMsMax: 5
} as const;
