/**
 * ARK-CANOPY (the owner, 2026-11-21: "ensure we do the monkeys swinging in trees"): the brachiation driver
 * (`locomotion/brachiate.ts`) on a real primate skeleton (the chimpanzee fixture: the same bone set as the gibbons'):
 * the holding hand's fingertips on the hold, wherever the hold is (the body drawn up under it when the arm is short),
 * the free arm out toward the next hold, the hands alternating, and on the ground both arms up for balance.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import path from "node:path";
import {Matrix4, Vector3} from "three";
import {buildLocoRig, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import {brachiateDriver, type LocoCanopy} from "@/ark-scene/locomotion/brachiate";
import type {LocoInput, LocoLeg, LocoRig} from "@/ark-scene/locomotion/types";
import {flatGround} from "@/ark-scene/locomotion/ground";

const rig: LocoRig = buildLocoRig(JSON.parse(readFileSync(path.join(process.cwd(), "src/ark-scene/locomotion/fixtures/chimpanzee.json"), "utf8")) as RawSkeleton);
const arm = (side: 1 | -1) => rig.legs.find((l) => l.end === "fore" && l.side === side)!;

function tip(world: Matrix4[], leg: LocoLeg): Vector3 {
    return new Vector3(...leg.contact).applyMatrix4(rig.bones[leg.foot].restWorld.clone().invert()).applyMatrix4(world[leg.foot]);
}

function posed(canopy: LocoCanopy): Matrix4[] {
    const world = rig.bones.map((b) => b.restWorld.clone());
    const input = {instance: new Matrix4(), scale: 1, yaw: 0, dt: 1 / 60, clock: 0, seed: 0.3, ground: flatGround(0), grounded: false, clipNow: "idle", clipFrom: null, clipPhase: 0, canopy} as unknown as LocoInput;
    assert.ok(brachiateDriver.takes(rig, input), "it takes a primate on its holds");
    brachiateDriver.pose(rig, input, world, brachiateDriver.init(rig));
    for (const m of world) assert.ok(m.elements.every(Number.isFinite), "no NaN");
    return world;
}

test("the holding hand's fingertips are on the hold, the left then the right; out of reach, the body hangs up under the hand", () => {
    const shoulder = new Vector3().setFromMatrixPosition(rig.bones[arm(1).upper].restWorld);
    const reach = arm(1).upperLength + arm(1).lowerLength;
    for (const [lead, hold] of [[1, shoulder.clone().add(new Vector3(0.1 * reach, 0.8 * reach, 0.2 * reach))], [-1, shoulder.clone().add(new Vector3(-0.3 * reach, 1.6 * reach, 0.3 * reach))]] as const) {
        const next = hold.clone().add(new Vector3(0, 0, 1.5 * reach));
        const world = posed({phase: "swing", hand: {x: hold.x, y: hold.y, z: hold.z}, next: {x: next.x, y: next.y, z: next.z}, lead, u: 0.5, brachiate: true});
        const holding = arm(lead);
        assert.ok(tip(world, holding).distanceTo(hold) < 0.02 * rig.height, `the ${lead > 0 ? "left" : "right"} hand on its hold: ${tip(world, holding).distanceTo(hold).toFixed(4)}`);
        // The free hand is out ahead, toward the next hold, further along than its shoulder.
        const free = arm(lead === 1 ? -1 : 1);
        const freeShoulder = new Vector3().setFromMatrixPosition(world[free.upper]);
        assert.ok(tip(world, free).z > freeShoulder.z, "the free hand reaches on toward the next hold");
    }
});

test("in the flight between holds the catching hand stretches to the next hold; on the ground both hands go up", () => {
    const shoulder = new Vector3().setFromMatrixPosition(rig.bones[arm(1).upper].restWorld);
    const next = shoulder.clone().add(new Vector3(0, rig.height, rig.height));
    const flying = posed({phase: "flight", hand: null, next: {x: next.x, y: next.y, z: next.z}, lead: 1, u: 0.7, brachiate: true});
    const catching = arm(-1);
    const toNext = next.clone().sub(new Vector3().setFromMatrixPosition(flying[catching.upper])).normalize();
    const along = tip(flying, catching).sub(new Vector3().setFromMatrixPosition(flying[catching.upper])).normalize();
    assert.ok(along.dot(toNext) > 0.9, `the catching arm points at the next hold: ${along.dot(toNext).toFixed(3)}`);
    const walking = posed({phase: "walk", hand: null, next: null, lead: 1, u: 0.2, brachiate: true});
    for (const side of [1, -1] as const) assert.ok(tip(walking, arm(side)).y > new Vector3().setFromMatrixPosition(walking[arm(side).upper]).y, "a hand up over its shoulder");
    // A leaper or a runner keeps its own clips.
    assert.equal(brachiateDriver.takes(rig, {canopy: {phase: "hold", hand: {x: 0, y: 1, z: 0}, next: null, lead: 1, u: 0, brachiate: false}} as unknown as LocoInput), false);
    assert.equal(brachiateDriver.takes(rig, {canopy: null} as unknown as LocoInput), false);
});

test("a sitting rig (the gibbons' and the siamang's: their fore chains laid down the legs) keeps its clip", () => {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "src/ark-scene/locomotion/fixtures/chimpanzee.json"), "utf8")) as RawSkeleton;
    const sitting = buildLocoRig({...raw, pose: "sitting (rest pose reviewed from renders)"} as RawSkeleton);
    assert.equal(brachiateDriver.takes(sitting, {canopy: {phase: "swing", hand: {x: 0, y: 1, z: 0}, next: null, lead: 1, u: 0.5, brachiate: true}} as unknown as LocoInput), false);
});
