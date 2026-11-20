/**
 * ARK-ANIM (the owner on batch 13): bird head turns capped and spread (`locomotion/bird-neck.ts`), and lying clips seated
 * by their lowest point, an equid's muzzle on its head (`locomotion/skin-fixes.ts`), on the fixture skeletons.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {DataUtils, Matrix4, Quaternion, Vector3} from "three";
import {buildLocoRig, restInverses, rotateSubtree, skinRow, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import {BIRD_YAW_CAP_DEG, birdYawLimits, isBirdRig, spreadBirdYaw, yawFromChest} from "@/ark-scene/locomotion/bird-neck";
import {LIE_SINK, lowestOfRow, rigidMuzzle, seatLyingRows} from "@/ark-scene/locomotion/skin-fixes";

const FIXTURES = path.join(process.cwd(), "src/ark-scene/locomotion/fixtures");
const raw = (slug: string) => JSON.parse(readFileSync(path.join(FIXTURES, `${slug}.json`), "utf8")) as RawSkeleton;
const restWorld = (rig: ReturnType<typeof buildLocoRig>) => rig.bones.map((b) => b.restWorld.clone());

test("a bird's head turned 150° comes back to 70° from its body, the neck carrying a quarter of it", () => {
    const r = raw("mallard");
    assert.ok(isBirdRig(r.plan, r.bones));
    const rig = buildLocoRig(r);
    const world = restWorld(rig);
    const idx = (n: string) => rig.bones.findIndex((b) => b.name === n);
    const [chest, neck, head] = ["chest", "neck", "head"].map(idx);
    const up = new Vector3(0, 1, 0);
    rotateSubtree(rig, world, neck, new Quaternion().setFromAxisAngle(up, (0.6 * 150 * Math.PI) / 180), new Vector3().setFromMatrixPosition(world[neck]));
    rotateSubtree(rig, world, head, new Quaternion().setFromAxisAngle(up, (0.4 * 150 * Math.PI) / 180), new Vector3().setFromMatrixPosition(world[head]));
    const lim = birdYawLimits("mallard");
    const done = spreadBirdYaw(rig, world, lim.cap, lim.shares)!;
    assert.ok(Math.abs(done.before - 150) < 1, `read ${done.before}`);
    assert.equal(done.after, BIRD_YAW_CAP_DEG);
    const headYaw = (yawFromChest(rig, world, chest, head)! * 180) / Math.PI;
    const neckYaw = (yawFromChest(rig, world, chest, neck)! * 180) / Math.PI;
    assert.ok(Math.abs(headYaw - 70) < 1, `head ${headYaw}`);
    assert.ok(Math.abs(neckYaw - 70 * lim.shares[1]) < 1, `neck ${neckYaw}`);
    assert.equal(birdYawLimits("barn-owl").cap, 170);
});

test("a lying clip is seated: its belly on the ground, no folded leg more than LIE_SINK into it", () => {
    const r = raw("red-deer");
    const rig = buildLocoRig(r);
    const n = rig.bones.length;
    const per = n * 12;
    // Two rows: the rest pose lowered 0.3 (legs straight: they would go 0.3 under) as a 'lie' clip.
    const row = new Float32Array(per);
    const world = restWorld(rig).map((m) => m.clone().premultiply(new Matrix4().makeTranslation(0, -0.3, 0)));
    skinRow(rig, world, row, 0);
    const data = new Uint16Array(per * 2);
    for (let k = 0; k < 2; k++) for (let i = 0; i < per; i++) data[k * per + i] = DataUtils.toHalfFloat(row[i]);
    const skin = {positions: Float32Array.from(r.positions as ArrayLike<number>), joints: Uint8Array.from(r.joints as ArrayLike<number>), weights: Float32Array.from(r.weights as ArrayLike<number>)};
    let restLow = Infinity;
    for (let i = 1; i < skin.positions.length; i += 3) restLow = Math.min(restLow, skin.positions[i]);
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 2; i < skin.positions.length; i += 3) (minZ = Math.min(minZ, skin.positions[i])), (maxZ = Math.max(maxZ, skin.positions[i]));
    const legs = new Set(rig.bones.flatMap((b, i) => (/^leg/.test(b.name) ? [i] : [])));
    void restInverses(rig);
    seatLyingRows(skin, restLow, maxZ - minZ, legs, data, n, {lie: {row: 0, rows: 2, base: "lying"}});
    const low = lowestOfRow(skin, data, n, 0);
    assert.ok(low >= restLow - LIE_SINK * (maxZ - minZ) - 2e-3, `low ${low} rest ${restLow}`);
});

test("an equid's muzzle is held by its head, not its neck", () => {
    const r = raw("plains-zebra");
    const rig = buildLocoRig(r);
    const skin = {positions: Float32Array.from(r.positions as ArrayLike<number>), joints: Uint8Array.from(r.joints as ArrayLike<number>), weights: Float32Array.from(r.weights as ArrayLike<number>)};
    rigidMuzzle(rig, skin);
    const head = rig.bones.findIndex((b) => b.name === "head");
    const neck = rig.bones.findIndex((b) => b.name === "neck");
    let maxZ = -Infinity;
    for (let i = 2; i < skin.positions.length; i += 3) maxZ = Math.max(maxZ, skin.positions[i]);
    const hz = rig.bones[head].restWorld.elements[14];
    for (let v = 0; v < skin.positions.length / 3; v++) {
        if (skin.positions[v * 3 + 2] < hz + 0.5 * (maxZ - hz)) continue;
        let onNeck = 0;
        for (let k = 0; k < 4; k++) if (skin.joints[v * 4 + k] === neck) onNeck += skin.weights[v * 4 + k];
        assert.ok(onNeck < 1e-6, `vertex ${v} still ${onNeck} on the neck`);
    }
});
