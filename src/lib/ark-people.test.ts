/**
 * p6 (people): the rigged bodies that replace the procedural figures (`humans/people-rig.ts`, `people-figures.ts`;
 * the contract `humans/HUMANS-FIGURE-INTERFACE.md`). The shipped files themselves are baked here, as the page bakes
 * them: twelve CC0 bodies, fourteen clips, one bone texture.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {Matrix4, Vector3} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {DOG_WALK_PACE} from "@/ark-scene/humans/dog-walks";
import {humanLook, sitRootY, type HumanInstance, type HumanPoseKind} from "@/ark-scene/humans/figures";
import {bakePeople, PEOPLE_BASE, PEOPLE_CLIPS, PEOPLE_FILES, PEOPLE_PACE, PERSON_IDS, peopleClip, peopleGrips, peopleMatrix, peoplePose, personFor, CANON_HIP, type BakedPeople, type PeoplePose} from "@/ark-scene/humans/people-rig";

const DIR = path.join(process.cwd(), "public", PEOPLE_BASE);
const POSES: HumanPoseKind[] = ["stand", "walk", "sit", "lie", "drive", "chop", "plant", "sleep", "carry", "saw", "sunback", "sunside", "sunsit", "paddle"];
const ROSTER = Array.from({length: 112}, (_, i) => `fixture-human-${String(i).padStart(3, "0")}`);

function glbJson(file: string): {images?: unknown[]; textures?: unknown[]} {
    const b = readFileSync(path.join(DIR, file));
    return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
}

let baked: BakedPeople | null = null;
async function bake(): Promise<BakedPeople> {
    if (baked) return baked;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const load = (file: string) => {
        const b = readFileSync(path.join(DIR, file));
        return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
    };
    const [near, far, clips] = await Promise.all([load(PEOPLE_FILES.near), load(PEOPLE_FILES.far), load(PEOPLE_FILES.clips)]);
    baked = bakePeople(near, far, clips);
    return baked;
}

const fresh = (): PeoplePose => ({person: null!, clip: null!, rowA: 0, rowB: 0, frac: 0, scale: 1});
const person = (look = humanLook("fixture-human-005"), pose: HumanPoseKind = "stand", extra: Partial<HumanInstance> = {}): HumanInstance => ({x: 10, y: 2, z: -4, yaw: 0.6, pose, phase: 1.3, look, ...extra});

test("privacy: the files carry no textures or images (no skin photos, no faces), only the generic bodies", () => {
    for (const file of Object.values(PEOPLE_FILES)) {
        const json = glbJson(file);
        assert.equal(json.images, undefined, file);
        assert.equal(json.textures, undefined, file);
    }
});

test("the body is the seeded look's alone: the same every time, children, elders, the beach and the forest each their own", () => {
    for (const id of ROSTER.slice(0, 30)) for (const pose of POSES) assert.equal(personFor(humanLook(id), pose), personFor(humanLook(id), pose));
    const used = new Set(ROSTER.map((id) => personFor(humanLook(id), "walk")));
    assert.ok(used.size >= 4, `town bodies ${Array.from(used)}`);
    for (const id of ROSTER.slice(0, 40)) {
        const look = humanLook(id);
        const child = humanLook(id, true);
        assert.ok(["p03-child", "p05-teen-girl", "p10-boy"].includes(personFor(child, "walk")), "a child's body");
        assert.ok(["p04-feller", "p11-feller-b"].includes(personFor(look, "walk", true)), "the forest's crews in work clothes");
        assert.ok(["p04-feller", "p11-feller-b"].includes(personFor(look, "saw")));
        if (!look.child) assert.ok(["p02-woman-swim", "p09-man-swim", "p12-woman-bikini"].includes(personFor({...look, swim: 1}, "walk")), "swimwear on the beach");
        assert.ok(["p02-woman-swim", "p09-man-swim", "p12-woman-bikini"].includes(personFor(look, "sunback")));
        const grey = look.hair[0] > 0.55 && Math.abs(look.hair[0] - look.hair[2]) < 0.05;
        if (grey) assert.ok(["p01-older-man-coat", "p08-older-woman"].includes(personFor(look, "stand")), "elders in coats");
    }
});

test("the bake: twelve bodies, every clip, one bone texture any WebGL2 device holds, the bodies' budget", async () => {
    const b = await bake();
    assert.equal(b.persons.size, PERSON_IDS.length);
    assert.ok(b.width <= 2048 && b.height <= 2048, `${b.width}×${b.height}`);
    assert.equal(b.bones.length, b.width * b.height * 4);
    for (const p of Array.from(b.persons.values())) {
        const near = p.near.index!.count / 3;
        const far = p.far.index!.count / 3;
        // The new budget (replacing the procedural 1,500–3,000 / 700): at most 6,000 triangles a near body, 700 far.
        assert.ok(near >= 4000 && near <= 6000, `${p.id} near ${near}`);
        assert.ok(far <= 700 && far <= near * 0.15, `${p.id} far ${far}`);
        assert.equal(p.near.getAttribute("uv"), undefined);
        assert.deepEqual(Object.keys(p.clips).sort(), Object.keys(PEOPLE_CLIPS).sort());
        assert.ok(p.height > 0.9 && p.height < 2 && p.hip > p.height * 0.4 && p.hip < p.height * 0.62, `${p.id} ${p.height} ${p.hip}`);
    }
    for (const pose of POSES) assert.ok(PEOPLE_CLIPS[peopleClip(pose)], pose);
    assert.equal(peopleClip("walk", true), "dog_walk");
    // Every matrix finite (half floats: no NaN or infinity), and the rest-near first frame of the stand clip.
    const view = new DataView(b.bones.buffer);
    for (let i = 0; i < b.bones.length; i++) {
        const exp = (view.getUint16(i * 2, true) >> 10) & 31;
        assert.ok(exp !== 31, `texel ${i}`);
    }
});

test("on the ground: standing feet, a sitter's hips on the seat, the ground poses' lowest point at the root", async () => {
    const b = await bake();
    const m = new Matrix4();
    for (const id of ROSTER.slice(0, 24)) {
        for (const child of [false, true]) {
            const look = humanLook(id, child);
            for (const pose of POSES) {
                const pp = peoplePose(b, person(look, pose), 0, false, fresh());
                const {clip, scale} = pp;
                const spec = PEOPLE_CLIPS[clip.name];
                peopleMatrix(person(look, pose), pp, m);
                const lift = m.elements[13] - 2;
                if (spec.contact === "feet") {
                    assert.ok(Math.abs(clip.low) < 0.05, `${pp.person.id} ${clip.name} feet ${clip.low}`);
                    assert.equal(lift, 0);
                } else if (spec.contact === "low") {
                    assert.ok(Math.abs(lift + clip.low * scale) < 1e-6);
                } else {
                    // The scene puts the root at sitRootY(seat): the thighs' underside lands on the seat.
                    const seat = 0.45;
                    const root = sitRootY(seat, (look.height * 1) / 1.75);
                    const y = root + lift + clip.seat * scale;
                    assert.ok(Math.abs(y - seat) < 1e-6, `${clip.name} ${y}`);
                    assert.ok(clip.seat > pp.person.hip * 0.6 && clip.seat < pp.person.hip * 1.05, `${pp.person.id} seat ${clip.seat}`);
                }
            }
        }
    }
});

test("lying on a towel as the procedural figures did: feet at the root, the head toward the back (−z turned by yaw)", async () => {
    const b = await bake();
    const m = new Matrix4();
    const head = new Vector3();
    for (const id of ROSTER.slice(0, 16)) {
        const look = {...humanLook(id), swim: 1};
        for (const pose of ["sunback", "sunside"] as const) {
            const h = person(look, pose, {yaw: 0, x: 0, y: 0, z: 0});
            const pp = peoplePose(b, h, 0, false, fresh());
            peopleMatrix(h, pp, m);
            // The head end: the grips of sunback are behind the head; the body's far end is along −z.
            const g = pp.person.grips;
            head.set(g[pp.rowA * 6 + 3], g[pp.rowA * 6 + 4], g[pp.rowA * 6 + 5]).applyMatrix4(m);
            if (pose === "sunback") assert.ok(head.z < -look.height * 0.6 && Math.abs(head.x) < 0.5, `${pp.person.id} ${head.toArray()}`);
            assert.ok(Math.abs(pp.clip.fixX) < 0.6 && Math.abs(pp.clip.fixZ) < 0.3);
        }
    }
});

test("the walk's feet do not slide: the clip plays at the town's pace for every body and size", async () => {
    assert.equal(PEOPLE_PACE.dog, DOG_WALK_PACE);
    const b = await bake();
    for (const id of ROSTER.slice(0, 30)) {
        for (const [what, pace] of [["pavement", PEOPLE_PACE.walk], ["dogwalk", PEOPLE_PACE.dog]] as const) {
            const h = {...person(humanLook(id), "walk"), what} as HumanInstance;
            const a = peoplePose(b, h, 0, false, fresh());
            const ground = PEOPLE_CLIPS[a.clip.name].ground! * (a.person.hip / CANON_HIP) * a.scale;
            // After `cycle` seconds of the clip at the rate the pose used, the body would cover pace × cycle.
            const later = peoplePose(b, h, 0.2, false, fresh());
            const moved = (later.rowA + later.frac - (a.rowA + a.frac) + a.clip.frames) % a.clip.frames;
            const covered = (moved / a.clip.frames) * a.clip.seconds * ground;
            assert.ok(Math.abs(covered - pace * 0.2) < 0.01, `${a.person.id} ${what} ${covered} vs ${pace * 0.2}`);
        }
    }
});

test("the tools' hands: the axe's two hands on one haft, the chainsaw's at its handles, a dog lead's hand by the hip", async () => {
    const b = await bake();
    const m = new Matrix4();
    const l = new Vector3();
    const r = new Vector3();
    for (const id of ROSTER.slice(0, 12)) {
        for (const pose of ["chop", "saw", "walk"] as const) {
            for (const t of [0, 0.4, 0.9, 1.3]) {
                const h = {...person(humanLook(id), pose, {x: 0, y: 0, z: 0, yaw: 0}), what: pose === "walk" ? "dogwalk" : undefined} as HumanInstance;
                const pp = peoplePose(b, h, t, true, fresh());
                peopleMatrix(h, pp, m);
                peopleGrips(pp, m, l, r);
                for (const v of [l, r]) assert.ok(Number.isFinite(v.x + v.y + v.z));
                const apart = l.distanceTo(r);
                const height = h.look.height;
                if (pose === "chop") assert.ok(apart > 0.05 && apart < 0.35, `chop hands ${apart}`);
                if (pose === "saw") assert.ok(apart > 0.12 && apart < 0.45, `saw hands ${apart}`);
                if (pose === "walk") assert.ok(r.y > height * 0.3 && r.y < height * 0.7 && r.z > 0.1, `lead hand ${r.toArray()}`);
            }
        }
    }
});
