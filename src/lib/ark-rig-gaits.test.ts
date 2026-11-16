import assert from "node:assert/strict";
import test from "node:test";
import {climbClipName, MOVING_CLIPS} from "@/ark-scene/rig-clips";
import {boneMajorToRows} from "@/ark-scene/rig-player";

test("bone-major bone data comes back in the texture's row-major order", () => {
    const bones = 3;
    const rows = 4;
    // Row-major source: value = row * 100 + bone * 10 + k (k the half within the 3x4 matrix, 0..11).
    const rowMajor = new Uint16Array(rows * bones * 12);
    for (let r = 0; r < rows; r++) for (let b = 0; b < bones; b++) for (let k = 0; k < 12; k++) rowMajor[(r * bones + b) * 12 + k] = r * 100 + b * 10 + k;
    const boneMajor = new Uint16Array(rowMajor.length);
    for (let b = 0; b < bones; b++) for (let r = 0; r < rows; r++) boneMajor.set(rowMajor.subarray((r * bones + b) * 12, (r * bones + b + 1) * 12), (b * rows + r) * 12);
    assert.notDeepEqual(Array.from(boneMajor), Array.from(rowMajor));
    assert.deepEqual(Array.from(boneMajorToRows(boneMajor, bones, rows)), Array.from(rowMajor));
});

test("head first down a steep trunk plays climb_down where the rig has it, else climb", () => {
    const both = (name: string) => name === "climb" || name === "climb_down";
    const climbOnly = (name: string) => name === "climb";
    assert.equal(climbClipName(0.1, true, both), "climb_down");
    assert.equal(climbClipName(0.1, false, both), "climb");
    assert.equal(climbClipName(0.1, true, climbOnly), "climb");
    // Gentle ground: no climbing clip; and none without the clips.
    assert.equal(climbClipName(0.8, true, both), null);
    assert.equal(climbClipName(0.1, true, () => false), null);
    // A moving clip: held on a sitting rig like climb.
    assert.ok(MOVING_CLIPS.has("climb_down"));
});
