import assert from "node:assert/strict";
import test from "node:test";
import {DUNG_LIFE_SECONDS, DUNG_PAUSE_SECONDS, dungAlpha, dungDiet, dungDrops, dungPose, leavesDung, sniffsAfter} from "@/ark-scene/dung";

const DAY = 3314;

test("who leaves dung: land mammals big enough to see", () => {
    assert.equal(leavesDung("quadruped", 2, false), true);
    assert.equal(leavesDung("quadruped", 0.1, false), false);
    assert.equal(leavesDung("quadruped", 2, true), false);
    assert.equal(leavesDung("flying_bird", 1, false), false);
    assert.equal(dungDiet("grazer"), "plants");
    assert.equal(dungDiet("meat"), "meat");
    assert.equal(dungDiet("insects"), "mixed");
});

test("drops: the same for every viewer, a plant eater's far more often than a hunter's, gone after their life", () => {
    const a = dungDrops("zebra-1", "plants", 50_000, DAY);
    assert.deepEqual(a, dungDrops("zebra-1", "plants", 50_000, DAY));
    const lion = dungDrops("lion-1", "meat", 50_000, DAY);
    assert.ok(a.length >= 3 && a.length <= 6, `${a.length}`);
    assert.ok(lion.length <= 1);
    assert.ok(a.every((d) => d.at <= 50_000 && 50_000 - d.at <= DUNG_LIFE_SECONDS));
    // Two of a herd never fall in step.
    const b = dungDrops("zebra-2", "plants", 50_000, DAY);
    assert.notEqual(a[0].at, b[0].at);
    assert.equal(dungAlpha(0), 1);
    assert.equal(dungAlpha(DUNG_LIFE_SECONDS), 0);
    assert.ok(dungAlpha(DUNG_LIFE_SECONDS - 60) < 0.3);
});

test("the pause: a hunter squats, a grazer just stands; some turn and sniff after; then it is over", () => {
    const p = {x: 0, z: 0};
    assert.ok(dungPose(p, 0, 0, "meat", 1.5, "k", 2)!.pitch < -0.1);
    assert.equal(dungPose(p, 0, 0, "plants", 2, "k", 2)!.pitch, 0);
    const keys = Array.from({length: 200}, (_, i) => `dung:x:${i}`);
    const share = keys.filter(sniffsAfter).length / keys.length;
    assert.ok(share > 0.2 && share < 0.5, `${share}`);
    const sniffer = keys.find(sniffsAfter)!;
    const plain = keys.find((k) => !sniffsAfter(k))!;
    assert.equal(dungPose(p, 0, 0, "meat", 1.5, plain, DUNG_PAUSE_SECONDS + 0.1), null);
    const sniff = dungPose(p, 0, 0, "meat", 1.5, sniffer, DUNG_PAUSE_SECONDS + 3)!;
    assert.equal(sniff.state, "eat");
    assert.ok(Math.abs(sniff.yaw - Math.PI) < 1e-6, "turned round to it");
});
