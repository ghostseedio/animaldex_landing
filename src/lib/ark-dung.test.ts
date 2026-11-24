import assert from "node:assert/strict";
import test from "node:test";
import {DUNG_LIFE_SECONDS, DUNG_PAUSE_SECONDS, DUNG_SNIFF_SECONDS, dungAlpha, dungDiet, dungDrops, dungMarkAt, dungPose, leavesDung, sniffsAfter} from "@/ark-scene/dung";

const DAY = 3314;

test("who leaves dung: land mammals big enough to see", () => {
    assert.equal(leavesDung("mammal", 2, false), true);
    assert.equal(leavesDung("mammal", 0.1, false), false);
    assert.equal(leavesDung("mammal", 2, true), false);
    assert.equal(leavesDung("bird", 1, false), false);
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

test("zoo close-up: the pause stays where its day has it and ends as it began (no jump in or out)", () => {
    // (An elephant of the live Ark's savanna: 4.36 m. It stood 2.2 m ahead as the pause began, and ended 1.1 m off, turned round.)
    const p = {x: 10, z: -5};
    const yaw = 0.7;
    const length = 4.36;
    const keys = Array.from({length: 200}, (_, i) => `dung:e:${i}`);
    for (const key of [keys.find(sniffsAfter)!, keys.find((k) => !sniffsAfter(k))!]) {
        let last: {x: number; z: number; yaw: number} | null = null;
        let most = 0;
        let turnMost = 0;
        let end = 0;
        for (let s = 0; s < 20; s += 1 / 60) {
            const pose = dungPose(p, yaw, 0, "plants", length, key, s);
            if (!pose) break;
            end = s;
            assert.ok(Math.hypot(pose.x - p.x, pose.z - p.z) < 1e-9, "where its day has it, the whole pause");
            if (s === 0) assert.ok(Math.abs(pose.yaw - yaw) < 1e-9, "facing as its day has it as it begins");
            if (last) {
                most = Math.max(most, Math.hypot(pose.x - last.x, pose.z - last.z));
                turnMost = Math.max(turnMost, Math.abs(pose.yaw - last.yaw));
            }
            last = {x: pose.x, z: pose.z, yaw: pose.yaw};
        }
        assert.ok(last && Math.abs(Math.atan2(Math.sin(last.yaw - yaw), Math.cos(last.yaw - yaw))) < 0.01, `ends facing as it began (${key})`);
        assert.ok(turnMost < 0.1, `turns, never snaps round (${turnMost.toFixed(3)} rad a frame)`);
        assert.equal(most, 0);
        assert.ok(end > 0);
    }
    const sniffer = keys.find(sniffsAfter)!;
    const round = dungPose(p, yaw, 0, "plants", length, sniffer, DUNG_PAUSE_SECONDS + DUNG_SNIFF_SECONDS / 2 + 0.5)!;
    const head = {x: round.x + Math.sin(round.yaw) * length * 0.5, z: round.z + Math.cos(round.yaw) * length * 0.5};
    const mark = dungMarkAt(p, yaw, length);
    assert.ok(Math.hypot(head.x - mark.x, head.z - mark.z) < 0.01, "turned round, its head is at the mark under where its tail was");
});
