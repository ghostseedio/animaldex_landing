import {test} from "node:test";
import assert from "node:assert/strict";
import {HANG_SWING, hangFeet, hangPivot, hangPose} from "@/ark-scene/grounding/hang";

test("a hang point is its pivot; a limb's top is a diameter above it", () => {
    assert.equal(hangPivot({x: 1, y: 5, z: 2, tag: "canopy_hang", radius: 0.2}).y, 5);
    assert.ok(Math.abs(hangPivot({x: 1, y: 5, z: 2, tag: "branch", radius: 0.2}).y - 4.6) < 1e-9);
});

test("hanging: feet on the pivot through the swing, body a length below, head down", () => {
    const pivot = {x: 3, y: 6, z: -2};
    const length = 0.12;
    for (const yaw of [0, 1.1, -2.5]) {
        for (let t = 0; t < 12; t += 0.37) {
            const pose = hangPose(pivot, yaw, length, 1, t, 0.42);
            const feet = hangFeet(pose, yaw, length);
            assert.ok(Math.hypot(feet.x - pivot.x, feet.y - pivot.y, feet.z - pivot.z) < 1e-9);
            assert.ok(Math.abs(pose.pitch - Math.PI / 2) <= HANG_SWING + 1e-9);
            // Its middle half a length below the feet; its nose (the other end) a full length below.
            assert.ok(pose.base < pivot.y - 0.49 * length);
            const nose = pose.base - (length / 2) * Math.sin(pose.pitch);
            assert.ok(nose < pivot.y - 0.99 * length);
        }
    }
});

test("it swings slowly: no faster than a few hundredths of a radian per tenth of a second", () => {
    let last = hangPose({x: 0, y: 0, z: 0}, 0, 0.1, 1, 0, 7).pitch;
    for (let t = 0.1; t < 20; t += 0.1) {
        const p = hangPose({x: 0, y: 0, z: 0}, 0, 0.1, 1, t, 7).pitch;
        assert.ok(Math.abs(p - last) < 0.02);
        last = p;
    }
});
