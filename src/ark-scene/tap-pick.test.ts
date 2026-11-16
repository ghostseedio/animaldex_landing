import assert from "node:assert/strict";
import test from "node:test";
import {pickFigure, preferTap, tapScore, TAP_MIN_RADIUS, type Projector} from "@/ark-scene/tap-pick";

// A camera looking straight down from 10 m: 1 m on the ground is 50 px, the screen's middle at the origin.
const project: Projector = (x, _y, z) => ({sx: 400 + x * 50, sy: 300 + z * 50, distance: 10});
const perPixelAt = 1 / (50 * 10);

const dogs = {members: [{id: "dog-a"}, {id: "dog-b"}, {id: "dog-c"}], middles: new Float32Array([0, 0.3, 0, 2, 0.3, 0, Number.NaN, 0, 0]), length: 0.9, height: 0.6};

test("a tap on a drawn resting figure picks it (the town's dogs were untappable)", () => {
    const hit = pickFigure(400, 300, [dogs], project, perPixelAt);
    assert.equal(hit?.id, "dog-a");
    assert.equal(hit?.score, 0);
    // The second dog, 2 m over.
    assert.equal(pickFigure(500, 302, [dogs], project, perPixelAt)?.id, "dog-b");
});

test("a member not drawn this frame (NaN middle) is never picked, nor one behind the camera", () => {
    const hidden = {members: [{id: "c"}], middles: new Float32Array([Number.NaN, 0, 0]), length: 1, height: 1};
    assert.equal(pickFigure(400, 300, [hidden], project, perPixelAt), null);
    assert.equal(pickFigure(400, 300, [dogs], () => null, perPixelAt), null);
});

test("a figure's circle is its body on screen, at least the minimum radius", () => {
    // 0.9 m at 50 px/m: 45 px across, so a 22.5 px radius; a tap 21 px off is in, 24 px off is out.
    assert.equal(pickFigure(421, 300, [dogs], project, perPixelAt)?.id, "dog-a");
    assert.equal(pickFigure(424, 300, [dogs], project, perPixelAt), null);
    // A far, tiny one still takes a tap within the minimum radius.
    const far: Projector = (x, _y, z) => ({sx: 400 + x, sy: 300 + z, distance: 500});
    assert.equal(pickFigure(400 - TAP_MIN_RADIUS + 1, 300, [dogs], far, perPixelAt)?.id, "dog-a");
});

test("the nearer of a live animal and a figure wins; a tie goes to the live animal", () => {
    assert.ok(tapScore(0, 0, 10, 0, 20) === 0.5);
    assert.equal(tapScore(0, 0, 30, 0, 20), Number.POSITIVE_INFINITY);
    // The finger on the figure, at the edge of a big live animal's circle (the one already chosen, close up).
    assert.deepEqual(preferTap({hit: "cat", score: 0.8}, {id: "dog-a", score: 0.05}), {figure: "dog-a"});
    assert.deepEqual(preferTap({hit: "cat", score: 0.1}, {id: "dog-a", score: 0.6}), {live: "cat"});
    assert.deepEqual(preferTap({hit: "cat", score: 0.3}, {id: "dog-a", score: 0.3}), {live: "cat"});
    assert.deepEqual(preferTap(null, {id: "dog-a", score: 0.9}), {figure: "dog-a"});
    assert.equal(preferTap(null, null), null);
});
