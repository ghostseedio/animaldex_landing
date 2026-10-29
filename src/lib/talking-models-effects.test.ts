import assert from "node:assert/strict";
import test from "node:test";

// The call camera's vignette and ambient occlusion rules, held to what
// SceneKit itself drew for the iOS call (`AnimalTalkingStage.camera`).
import {
    AMBIENT_OCCLUSION_SAMPLES,
    AmbientOcclusionGovernor,
    ambientOcclusionQualityFor,
    CALL_VIGNETTE,
    drawsAmbientOcclusion,
    occlusionKernel,
    vignetteAt
} from "@/lib/talking-models/effects";

test("the vignette is SceneKit's: 0.6 at the edges, 1 in the middle, its numbers", () => {
    assert.deepEqual(CALL_VIGNETTE, {intensity: 0.4, power: 0.8});
    assert.equal(vignetteAt(0.5, 0.5), 1);
    assert.ok(Math.abs(vignetteAt(0, 0.5) - 0.6) < 1e-9);
    assert.ok(Math.abs(vignetteAt(0.5, 1) - 0.6) < 1e-9);
    assert.ok(Math.abs(vignetteAt(1, 1) - 0.6) < 1e-9);
});

test("the vignette meets SceneKit's measured darkening across the frame", () => {
    // Linear-light ratios read from SceneKit renders (786×716, vignette on against off).
    const measured: Array<[number, number, number]> = [
        [60, 350, 0.749],
        [120, 100, 0.735],
        [60, 50, 0.652],
        [180, 350, 0.917],
        [390, 50, 0.749],
        [360, 200, 0.950]
    ];
    for (const [x, y, ratio] of measured) {
        const predicted = vignetteAt((x + 0.5) / 786, (y + 0.5) / 716);
        // One 8-bit step at these levels is about 0.015.
        assert.ok(Math.abs(predicted - ratio) < 0.02, `${x},${y}: ${predicted.toFixed(3)} vs ${ratio}`);
    }
});

test("the occlusion pass runs only where the skin is seen, as SceneKit's shows only there", () => {
    assert.equal(drawsAmbientOcclusion(0), true);
    assert.equal(drawsAmbientOcclusion(Number.NaN), true);
    // A furred animal's shells set their own occlusion over SceneKit's.
    assert.equal(drawsAmbientOcclusion(0.005), false);
    assert.equal(drawsAmbientOcclusion(0.0025), false);
});

test("a modest phone draws half the samples; anything else all of them", () => {
    assert.equal(ambientOcclusionQualityFor({coarsePointer: true, cores: 4, memoryGB: null}), "low");
    assert.equal(ambientOcclusionQualityFor({coarsePointer: true, cores: 8, memoryGB: 2}), "low");
    assert.equal(ambientOcclusionQualityFor({coarsePointer: true, cores: 8, memoryGB: 8}), "high");
    assert.equal(ambientOcclusionQualityFor({coarsePointer: true, cores: null, memoryGB: null}), "high");
    assert.equal(ambientOcclusionQualityFor({coarsePointer: false, cores: 2, memoryGB: 2}), "high");
    assert.deepEqual(AMBIENT_OCCLUSION_SAMPLES, {high: 16, low: 8});
});

test("slow frames turn the occlusion down a step at a time, never back up", () => {
    const governor = new AmbientOcclusionGovernor("high");
    const run = (frames: number, ms: number) => {
        let quality = governor.quality;
        for (let index = 0; index < frames; index++) quality = governor.frame(ms);
        return quality;
    };
    // The first second does not count (shaders warming up).
    assert.equal(run(AmbientOcclusionGovernor.settleFrames, 200), "high");
    assert.equal(run(AmbientOcclusionGovernor.windowFrames, 40), "low");
    assert.equal(run(AmbientOcclusionGovernor.windowFrames, 16), "low");
    assert.equal(run(AmbientOcclusionGovernor.windowFrames, 40), "off");
    assert.equal(run(AmbientOcclusionGovernor.windowFrames * 3, 16), "off");
});

test("frames that hold up keep the occlusion", () => {
    const governor = new AmbientOcclusionGovernor("high");
    let quality = governor.quality;
    // A few long frames among many short ones: the median is what counts.
    for (let index = 0; index < 600; index++) quality = governor.frame(index % 10 === 0 ? 80 : 16.7);
    assert.equal(quality, "high");
});

test("the kernel is the same everywhere, in the hemisphere, reaching from a quarter of the radius to all of it", () => {
    const kernel = occlusionKernel(16);
    assert.equal(kernel.length, 16);
    assert.deepEqual(kernel, occlusionKernel(16));
    kernel.forEach(([x, y, z], index) => {
        const length = Math.hypot(x, y, z);
        assert.ok(Math.abs(length - (0.25 + 0.75 * index / 16)) < 1e-9);
        assert.ok(z >= 0.15 * length);
    });
});
