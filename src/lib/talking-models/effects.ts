/**
 * The call camera's two effects, as SceneKit draws them for the iOS
 * `AnimalTalkingStage.camera` (natural look): a vignette (intensity 0.4,
 * power 0.8) and screen-space ambient occlusion (intensity 0.9, radius 0.03,
 * normal threshold 0.3, depth threshold 0.05). The numbers and the rules;
 * the drawing is `voice-call/talking-model-effects.ts`. Pure, for the tests.
 *
 * Both were measured against SceneKit itself (an `SCNView` rendering the
 * app's own scene, each effect on and off):
 *
 *   - The vignette is SceneKit's `16·u·(1−u)·v·(1−v)` shape raised to the
 *     power and mixed in by the intensity, in linear light: 0.6 at the
 *     frame's edges, 1 in the middle (it fits the renders to 0.0075 rms). It
 *     darkens colour, never alpha, so on the app's clear background it falls
 *     on the animal and not on the habitat behind it.
 *   - The ambient occlusion dims only the light from the environment, and
 *     the fur shells' own shader sets that occlusion (`mix(0.7, 1, layer)`),
 *     so on a furred animal SceneKit's pass changes almost nothing (0.2% of
 *     the fox's pixels, by a few levels). It shows on the skin of the animals
 *     without fur (reptiles, fish, frogs: 1,221 of the 2,630 models),
 *     darkening their creases: under the chin, where a leg meets the body,
 *     between the toes.
 */

export const CALL_VIGNETTE = {intensity: 0.4, power: 0.8} as const;
export const CALL_AMBIENT_OCCLUSION = {intensity: 0.9, radius: 0.03, normalThreshold: 0.3, depthThreshold: 0.05} as const;

/**
 * SceneKit's radius and depth threshold are its own sampler's: in the web's
 * hemisphere kernel, 0.08 for both reads as SceneKit's 0.03 and 0.05. Fitted
 * on two models without fur against SceneKit's own renders (each animal held
 * as the preview tool holds it, occlusion on against off): the cane toad's
 * mean darkening 0.991 (SceneKit 0.991), 5th percentile 0.950 (0.934); the
 * green iguana's 0.986 (0.989) and 0.936 (0.922). The intensity and the
 * normal threshold are SceneKit's.
 */
export const WEB_OCCLUSION_KERNEL = {radius: 0.08, depthReach: 0.08} as const;

/** SceneKit's vignette at a point of the frame (0–1 across, 0–1 down), a factor on linear colour. */
export function vignetteAt(u: number, v: number, vignette: {intensity: number; power: number} = CALL_VIGNETTE): number {
    const shape = Math.min(Math.max(16 * u * v * (1 - u) * (1 - v), 0), 1);
    return 1 + vignette.intensity * (Math.pow(shape, vignette.power) - 1);
}

/** Whether a model gets the occlusion pass: only one whose skin is seen (no fur shells over it). */
export function drawsAmbientOcclusion(furLength: number): boolean {
    return !(furLength > 0);
}

/** How much ambient occlusion this device draws: 16 samples, 8, or none. */
export type AmbientOcclusionQuality = "high" | "low" | "off";

export const AMBIENT_OCCLUSION_SAMPLES: Record<Exclude<AmbientOcclusionQuality, "off">, number> = {high: 16, low: 8};

/** A phone or tablet with few cores or little memory gets half the samples. */
export function ambientOcclusionQualityFor(device: {coarsePointer: boolean; cores: number | null; memoryGB: number | null}): AmbientOcclusionQuality {
    const modest = (device.cores !== null && device.cores <= 4) || (device.memoryGB !== null && device.memoryGB <= 3);
    return device.coarsePointer && modest ? "low" : "high";
}

/**
 * Turns the occlusion down a step when frames are slow: after the first
 * second (shaders warming up), the median time between frames over the next
 * 90; slower than 28 ms (under ~36 fps) is a step down (high, low, off), then
 * it measures again. It never steps back up during a call.
 */
export class AmbientOcclusionGovernor {
    static readonly settleFrames = 60;
    static readonly windowFrames = 90;
    static readonly slowFrameMs = 28;
    private intervals: number[] = [];
    private seen = 0;

    constructor(public quality: AmbientOcclusionQuality) {}

    /** One frame, drawn `intervalMs` after the last: the quality to draw at now. */
    frame(intervalMs: number): AmbientOcclusionQuality {
        if (this.quality === "off") return this.quality;
        this.seen += 1;
        if (this.seen <= AmbientOcclusionGovernor.settleFrames || !(intervalMs > 0)) return this.quality;
        this.intervals.push(intervalMs);
        if (this.intervals.length < AmbientOcclusionGovernor.windowFrames) return this.quality;
        const sorted = [...this.intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        this.intervals = [];
        if (median > AmbientOcclusionGovernor.slowFrameMs) this.quality = this.quality === "high" ? "low" : "off";
        return this.quality;
    }
}

/**
 * Directions about +z (none lying flat along the surface), reaching from a
 * quarter of the radius out to all of it, evenly; the same on every device.
 */
export function occlusionKernel(count: number): Array<[number, number, number]> {
    let state = 0x2545f491;
    const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const kernel: Array<[number, number, number]> = [];
    while (kernel.length < count) {
        const x = random() * 2 - 1;
        const y = random() * 2 - 1;
        const z = random();
        const length = Math.hypot(x, y, z);
        // Even over directions (inside the unit ball, then outward), not lying flat along the surface.
        if (length > 1 || length < 1e-3 || z < 0.15 * length) continue;
        const reach = (0.25 + 0.75 * kernel.length / count) / length;
        kernel.push([x * reach, y * reach, z * reach]);
    }
    return kernel;
}
