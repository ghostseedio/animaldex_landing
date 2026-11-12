import assert from "node:assert/strict";
import test from "node:test";
import {heelPose} from "@/lib/ark-liveliness";

// (2026-11-12, the default view's backwards share: a zebra foal, e9779d, went backwards 7-10 s of its 8-11 s of movement
// in a play bout beside its sleeping mother. After a dash ahead of her it crept back to her heel facing her way.)
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test("a foal's play bout beside its sleeping mother is never backwards for more than 0.5 s", () => {
    const mother = {x: 12, z: -7, yaw: 0.9, length: 2.4, height: 1.4};
    const youngLength = mother.length * 0.6;
    let moving = 0;
    let worst = 0;
    let dashes = 0;
    for (const id of ["foal-a", "foal-b", "e9779d", "calf-1", "kid-7", "fawn-3"]) {
        let last = heelPose(id, mother, {distance: 1.04, carried: false}, 0.9, 0, () => ({x: mother.x, z: mother.z}));
        let run = 0;
        let wasPlaying = false;
        // Two hours, every 0.1 s, her asleep where she lies (her heading the same all the while).
        for (let ms = 100; ms < 2 * 3600 * 1000; ms += 100) {
            const p = heelPose(id, mother, {distance: 1.04, carried: false}, 0.9, ms, () => ({x: mother.x, z: mother.z}));
            const d = Math.hypot(p.x - last.x, p.z - last.z);
            if (p.playing && !wasPlaying) dashes++;
            wasPlaying = p.playing;
            if (d / 0.1 > 0.15 * youngLength) {
                moving += 0.1;
                const off = Math.abs(angle(Math.atan2(p.x - last.x, p.z - last.z) - p.yaw));
                run = off > Math.PI / 2 ? run + 0.1 : 0;
                worst = Math.max(worst, run);
            } else run = 0;
            last = p;
        }
    }
    assert.ok(dashes > 20 && moving > 30, `dashes ${dashes}, moving ${moving.toFixed(1)} s`);
    assert.ok(worst <= 0.5 + 1e-9, `backwards ${worst.toFixed(1)} s in a row`);
});
