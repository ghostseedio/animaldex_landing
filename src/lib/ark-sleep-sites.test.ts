/**
 * Lane ark-sleep: where animals sleep by their kind (`sleep-sites.ts`), and the primates' sit asleep posed from the
 * skeleton (`locomotion/sit-sleep-pose.ts`) on the fixture chimpanzee (src/ark-scene/locomotion/fixtures/).
 */

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {DataUtils, Matrix4, Vector3} from "three";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {SLEEP_COVER, sleepCover, sleepSiteKind} from "@/ark-scene/sleep-sites";
import {buildLocoRig, bonePointNow, type RawSkeleton} from "@/ark-scene/locomotion/skeleton";
import {SIT_FRAMES, SitSleepPose, posedSitRows, sitShaped} from "@/ark-scene/locomotion/sit-sleep-pose";

const kind = (slug: string, length: number) => sleepSiteKind(behaviourProfile(slug), length);

test("sleep kinds from the stored rows: primates, hunters, small mammals, grazers, birds, reptiles", () => {
    assert.equal(kind("long-tailed-macaque", 0.5), "primate");
    assert.equal(kind("chimpanzee", 0.9), "primate");
    assert.equal(kind("olive-baboon", 0.9), "primate");
    assert.equal(kind("african-lion", 2.5), "hunter");
    assert.equal(kind("red-fox", 0.7), "hunter");
    assert.equal(kind("brown-bear", 2.2), "hunter");
    assert.equal(kind("european-rabbit", 0.4), "small");
    assert.equal(kind("plains-zebra", 2.2), "grazer");
    assert.equal(kind("white-tailed-deer", 1.6), "grazer");
    assert.equal(kind("european-robin", 0.14), "bird");
    assert.equal(kind("common-wall-lizard", 0.2), "reptile");
    // (A wallaby sits upright too, but never climbs: not a primate.)
    assert.notEqual(kind("red-necked-wallaby", 0.9), "primate");
});

test("each kind's cover: primates up a tree first, hunters a den or a rock before shade, grazers shade only", () => {
    assert.equal(SLEEP_COVER.primate[0], "branch");
    assert.deepEqual(SLEEP_COVER.hunter.slice(0, 2), ["cave_mouth", "burrow_entrance"]);
    assert.ok(SLEEP_COVER.hunter.includes("rock_top") && SLEEP_COVER.hunter.includes("shade"));
    assert.equal(SLEEP_COVER.small[0], "burrow_entrance");
    assert.deepEqual(SLEEP_COVER.grazer, ["shade"]);
    assert.equal(SLEEP_COVER.bird[0], "branch");
    assert.ok(SLEEP_COVER.reptile.includes("log_top") && SLEEP_COVER.reptile.includes("rock_face"));
    assert.deepEqual(sleepCover(behaviourProfile("mallard"), 0.6).filter((tag) => tag === "shade"), []);
});

const FIXTURES = path.join(process.cwd(), "src/ark-scene/locomotion/fixtures");
const raw = JSON.parse(readFileSync(path.join(FIXTURES, "chimpanzee.json"), "utf8")) as RawSkeleton & {positions: number[]; joints: number[]; weights: number[]};
const at = (m: Matrix4) => new Vector3(m.elements[12], m.elements[13], m.elements[14]);

test("the chimpanzee sits asleep: rump down, knees drawn up above the hips, back leaning up, head forward and down", () => {
    const rig = buildLocoRig(raw);
    assert.ok(sitShaped(rig));
    const sit = new SitSleepPose(rig, raw);
    assert.ok(sit.check.ok, String(sit.check.reason));
    const world = sit.pose(1, rig.bones.map(() => new Matrix4()));
    const rest = rig.bones.map((bone) => bone.restWorld);
    const fwd = rig.legs.filter((l) => l.end === "fore")[0].hip[2] >= rig.legs.filter((l) => l.end === "hind")[0].hip[2] ? 1 : -1;
    for (const leg of rig.legs.filter((l) => l.end === "hind")) {
        // (The hip joint comes down, the knee is above it and in front of it.)
        assert.ok(at(world[leg.upper]).y < at(rest[leg.upper]).y - rig.height * 0.05, `${leg.key}: the hip comes down`);
        assert.ok(at(world[leg.lower]).y > at(world[leg.upper]).y, `${leg.key}: the knee drawn up`);
        assert.ok((at(world[leg.lower]).z - at(world[leg.upper]).z) * fwd > 0, `${leg.key}: the knee in front`);
        const sole = bonePointNow(rig, world, leg.foot, leg.contact, new Vector3());
        assert.ok(sole.y < at(world[leg.upper]).y, `${leg.key}: the foot below the hip`);
    }
    // The back leans up: the shoulders well above the hips.
    const mid = (end: "fore" | "hind") => rig.legs.filter((l) => l.end === end).reduce((v, l) => v.add(at(world[l.upper])), new Vector3()).multiplyScalar(0.5);
    assert.ok(mid("fore").y - mid("hind").y > rig.height * 0.2);
    // The head forward of the shoulders and below the top of the neck.
    assert.ok((at(world[rig.head]).z - mid("fore").z) * fwd > 0, "the head in front of the shoulders");
    assert.ok(at(world[rig.head]).y < at(world[rig.neck]).y, "the head down from the neck");
    assert.ok(sit.check.sink <= 0.02);
});

test("t 0 is the rest pose, and the way down is continuous", () => {
    const rig = buildLocoRig(raw);
    const sit = new SitSleepPose(rig, raw);
    const p0 = sit.pose(0, rig.bones.map(() => new Matrix4()));
    p0.forEach((m, b) => assert.ok(at(m).distanceTo(at(rig.bones[b].restWorld)) < 1e-9));
    let last = at(p0[rig.head]);
    for (let k = 1; k <= SIT_FRAMES; k++) {
        const now = at(sit.pose(k / SIT_FRAMES, rig.bones.map(() => new Matrix4()))[rig.head]);
        assert.ok(now.distanceTo(last) < rig.height * 0.5, `step ${k}`);
        last = now;
    }
});

test("its rows: sit_down, sit_up and sleep appended after the rig's own; a quadruped gets none", () => {
    const rig = buildLocoRig(raw);
    const per = rig.bones.length * 12;
    const own = new Uint16Array(per * 5);
    const rows = posedSitRows(rig, raw, own, rig.bones.length, DataUtils.toHalfFloat);
    assert.ok(rows.data);
    assert.deepEqual(rows.clips.map((c) => c.name), ["sit_down", "sit_up", "sleep"]);
    assert.equal(rows.clips[0].row, 5);
    assert.equal(rows.data!.length, own.length + (2 * (SIT_FRAMES + 1) + 2) * per);
    const lion = JSON.parse(readFileSync(path.join(FIXTURES, "african-lion.json"), "utf8")) as RawSkeleton & {positions: number[]; joints: number[]; weights: number[]};
    const lionRig = buildLocoRig(lion);
    assert.equal(posedSitRows(lionRig, lion, new Uint16Array(lionRig.bones.length * 12), lionRig.bones.length, DataUtils.toHalfFloat).data, null);
});

test("kept stock sleep by their pen's shelter at night, at their own place by day, close but apart", async () => {
    const {stockAsleep, stockBed, penShelterSpot} = await import("@/ark-scene/islands/town/stock-beds");
    assert.equal(stockAsleep("diurnal", 23), true);
    assert.equal(stockAsleep("diurnal", 12), false);
    assert.equal(stockAsleep("nocturnal", 12), true);
    assert.equal(stockAsleep("nocturnal", 23), false);
    const at = {x: 0, z: 0, w: 4, d: 3, rot: 0};
    const plan = {buildings: [{id: "s", kind: "field_shelter", at}]} as never;
    const pen = {x: 0, z: 8, w: 20, d: 12, rot: 0};
    const spot = penShelterSpot(pen, plan)!;
    assert.ok(spot && spot.z > 1.5, "the side facing the pen");
    assert.equal(stockBed(pen, 0.9, "a", 1.4, "diurnal", 12, plan), null);
    const a = stockBed(pen, 0.9, "a", 1.4, "diurnal", 23, plan)!;
    const b = stockBed(pen, 0.9, "b", 1.4, "diurnal", 23, plan)!;
    assert.ok(Math.hypot(a.x - spot.x, a.z - spot.z) < 1.4 * 3 + 1);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.01, "apart");
});

test("a ground-roosting bird's cover stays low (a crane never goes up a tree)", () => {
    for (const slug of ["common-crane", "sandhill-crane"]) {
        const p = behaviourProfile(slug);
        if (p.roost === "tree") continue;
        assert.ok(!sleepCover(p, 1.1).includes("branch"), slug);
    }
});

test("a primate house climber sleeps up on the frames' beams, awake it is not placed there, a gorilla stays down", async () => {
    const {zooSleepFrame} = await import("@/ark-scene/islands/town/zoo-swing");
    const climbs = [{a: [0, 3, 0], b: [6, 3, 0], posts: [[0, 3.5, 0], [6, 3.5, 0]], feet: [[0, 0, 0], [6, 0, 0]]}] as never;
    const macaque = {id: "m1", model_slug: "long-tailed-macaque", scientific_name: "Macaca fascicularis"};
    const f = zooSleepFrame(macaque, climbs, false, behaviourProfile("long-tailed-macaque").roost)!;
    assert.ok(f && f.y > 3 && f.x >= 0 && f.x <= 6 && f.z === 0, JSON.stringify(f));
    assert.equal(zooSleepFrame(macaque, climbs, true, "tree"), null);
    assert.equal(zooSleepFrame({id: "g1", model_slug: "western-gorilla", scientific_name: "Gorilla gorilla"}, climbs, false, "nest"), null);
});
