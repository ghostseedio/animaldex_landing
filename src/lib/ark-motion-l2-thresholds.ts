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
    surfaceBreachesMax: 0
} as const;
