/**
 * The Ark's rigged people (p6, the owner's approved polish of the p5 figures): twelve generic bodies made with
 * MakeHuman / MPFB2 from its CC0 system assets (`public/ark/assets/people-v1/`, licences in `docs/ark-credits.md`), one
 * shared 23-bone skeleton, fourteen clips authored on one of them (`clips.glb`). PRIVACY (the owner's fixed rule): a
 * body is picked from the person's seeded look (`humanLook`: age band, hair, the place they are in), never from the
 * capture: no photo, no face, no name. The faces are the same few presets for everyone.
 *
 * This module is the pure part: which body and clip a `HumanInstance` takes, and the bake at load. The bake retargets
 * each clip onto each body as Blender's pose space does (a bone's local rotation = its own rest × the canonical rest's
 * inverse × the clip's; Root and pelvis moves scaled by the hip height) and writes, per body, clip and frame, each
 * bone's 3×4 matrix that takes a vertex of the rest pose to its place in that frame (the layout `rig-player.ts` uses
 * for the animals): one RGBA half-float texture, a column block of 69 texels per body, a row per frame. The renderer
 * (`people-figures.ts`) samples it in the vertex shader, instanced: nothing per frame but a few numbers per person.
 */

import {DataUtils, Matrix4, Quaternion, Vector3, type AnimationClip, type Bone, type BufferGeometry, type Object3D, type SkinnedMesh} from "three";
import {BufferAttribute, BufferGeometry as Geometry} from "three";
import {WALK_PACE, type HumanInstance, type HumanLook, type HumanPoseKind} from "@/ark-scene/humans/figures";

/** Where the people's files ship (with the web deploy, beside the town's cars). A new set is a new folder. */
export const PEOPLE_BASE = "/ark/assets/people-v1";
export const PEOPLE_FILES = {near: "people-near.glb", far: "people-far.glb", clips: "clips.glb"} as const;

/** The bodies, as the files name them (`people.manifest.json`). */
export const PERSON_IDS = ["p01-older-man-coat", "p02-woman-swim", "p03-child", "p04-feller", "p05-teen-girl", "p06-man-casual", "p07-woman-casual", "p08-older-woman", "p09-man-swim", "p10-boy", "p11-feller-b", "p12-woman-bikini"] as const;
export type PersonId = (typeof PERSON_IDS)[number];

/** The skeleton's bones, in the skins' joint order (the same in every body and in the clips' skeleton). */
export const PEOPLE_BONES = ["Root", "pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r", "neck_01", "head", "thigh_l", "calf_l", "foot_l", "ball_l", "thigh_r", "calf_r", "foot_r", "ball_r"] as const;
const BONE = Object.fromEntries(PEOPLE_BONES.map((name, i) => [name, i])) as Record<(typeof PEOPLE_BONES)[number], number>;
/** Texels a body's block takes (three per bone). */
export const PERSON_TEXELS = PEOPLE_BONES.length * 3;
/** The bones a driver's lean turns (spine up, arms and head): texture indices 2…14; the arms (5…12) only follow. */
export const LEAN_FIRST = BONE.spine_01;
export const LEAN_LAST = BONE.head;
export const ARM_FIRST = BONE.clavicle_l;
export const ARM_LAST = BONE.hand_r;

export type PeopleClipName = "walk" | "dog_walk" | "carry" | "stand" | "paddle" | "sit" | "drive" | "sunback" | "sunside" | "sleep" | "sunsit" | "chop" | "saw" | "plant";

/**
 * The clips as baked: frames a second (the slow loops at 10, the moving ones at their authored 30) and how the root
 * sits. `ground`: the clip's own pace at the canonical body (m/s, `people.manifest.json`), so the feet do not slide;
 * `contact`: "feet" (the root on the ground under the feet), "low" (kneeling, sitting on or lying on the ground: the
 * lowest point of the body at the root), "seat" (the hips on a seat at `sitRootY`), and lying clips are turned so the
 * feet are at the root and the head toward −z, as the procedural figures lay them (the towels are placed for that).
 */
export const PEOPLE_CLIPS: Record<PeopleClipName, {fps: number; ground?: number; contact: "feet" | "low" | "seat"; lying?: boolean}> = {
    walk: {fps: 30, ground: 1.0581, contact: "feet"},
    dog_walk: {fps: 30, ground: 1.0581, contact: "feet"},
    carry: {fps: 30, ground: 1.0581, contact: "feet"},
    stand: {fps: 10, contact: "feet"},
    paddle: {fps: 10, contact: "feet"},
    sit: {fps: 10, contact: "seat"},
    drive: {fps: 10, contact: "seat"},
    sunback: {fps: 10, contact: "low", lying: true},
    sunside: {fps: 10, contact: "low", lying: true},
    sleep: {fps: 10, contact: "low", lying: true},
    sunsit: {fps: 10, contact: "low"},
    chop: {fps: 30, contact: "feet"},
    saw: {fps: 30, contact: "feet"},
    plant: {fps: 30, contact: "low"}
};
/** The canonical body's hip height (m) the clips' paces and moves were authored at. */
export const CANON_HIP = 0.8418;
/** How far past the hand bone a grip is (m at the canonical body): the palm inside the curled fingers (`tools.py`). */
const GRIP_REACH = 0.11;

const POSE_CLIP: Record<HumanPoseKind, PeopleClipName> = {walk: "walk", stand: "stand", sit: "sit", lie: "sunback", drive: "drive", chop: "chop", plant: "plant", sleep: "sleep", carry: "carry", saw: "saw", sunback: "sunback", sunside: "sunside", sunsit: "sunsit", paddle: "paddle"};
const BEACH_POSES: ReadonlySet<HumanPoseKind> = new Set<HumanPoseKind>(["sunback", "sunside", "sunsit", "paddle"]);
const WORK_POSES: ReadonlySet<HumanPoseKind> = new Set<HumanPoseKind>(["chop", "saw", "plant", "carry"]);

/** The clip a pose plays (a dog walker's walk holds the lead out: `dog_walk`). */
export function peopleClip(pose: HumanPoseKind, dogWalk = false): PeopleClipName {
    return pose === "walk" && dogWalk ? "dog_walk" : POSE_CLIP[pose];
}

/** The look's grey or white hair (`humanLook` gives it only to its elders). */
function elder(look: HumanLook): boolean {
    return look.hair[0] > 0.55 && Math.abs(look.hair[0] - look.hair[2]) < 0.05;
}

/** A unit from the look's own colours (the seed's, so the same person always gets the same body). */
function lookUnit(look: HumanLook): number {
    const v = look.top[0] * 7.13 + look.top[1] * 3.71 + look.bottom[2] * 5.31 + look.skin[1] * 11.7 + look.height * 13.1;
    return v - Math.floor(v);
}

/**
 * The body for a person: by age band (a child under 1.2 m, an older child, an elder by the look's grey hair, an adult),
 * by the place (swimwear on the beach: the town's beach look, or a beach pose; work clothes with hi-vis and a helmet
 * for the forest's crews), and the long-haired looks to the women's bodies. Only the seeded look decides it.
 */
export function personFor(look: HumanLook, pose: HumanPoseKind, work = false): PersonId {
    const long = look.longHair >= 0.5;
    if (look.child) return look.height < 1.2 ? "p03-child" : long ? "p05-teen-girl" : "p10-boy";
    if (work || WORK_POSES.has(pose)) return elder(look) ? "p11-feller-b" : "p04-feller";
    if (look.swim || BEACH_POSES.has(pose)) return long ? (lookUnit(look) < 0.5 ? "p02-woman-swim" : "p12-woman-bikini") : "p09-man-swim";
    if (elder(look)) return long ? "p08-older-woman" : "p01-older-man-coat";
    return long ? "p07-woman-casual" : "p06-man-casual";
}

// MARK: - The bake

export type BakedClip = {
    name: PeopleClipName;
    /** First row and frames (rows = frames + 1: the closing frame, so a loop's last frame blends to its first). */
    row: number;
    frames: number;
    seconds: number;
    /** Lowest point of the body over the clip (model units, from the root), for "low" contact. */
    low: number;
    /** "seat": the hips' underside (model units, from the root). */
    seat: number;
    /** Lying: the turn (rad about y) and the move (model units) that put the feet at the root and the head toward −z. */
    fixYaw: number;
    fixX: number;
    fixZ: number;
};

export type BakedPerson = {
    id: PersonId;
    near: BufferGeometry;
    far: BufferGeometry;
    /** The body's first texel column in the bone texture. */
    column: number;
    /** Standing height, hip height and shoulder height (model units = m). */
    height: number;
    hip: number;
    shoulder: number;
    clips: Record<PeopleClipName, BakedClip>;
    /** Per row: the left and the right hand's grip points (model space, rest root at the origin), 6 floats a row. */
    grips: Float32Array;
};

export type BakedPeople = {
    persons: Map<PersonId, BakedPerson>;
    /** RGBA half floats, `width` × `height` texels (emptied once the texture is on the GPU). */
    bones: Uint16Array;
    width: number;
    height: number;
    rows: number;
};

type Gltf = {scene: Object3D; animations: AnimationClip[]};

function skinnedOf(root: Object3D): SkinnedMesh {
    let found: SkinnedMesh | null = null;
    root.traverse((o) => {
        if (!found && (o as SkinnedMesh).isSkinnedMesh) found = o as SkinnedMesh;
    });
    if (!found) throw new Error(`no skinned mesh in ${root.name}`);
    return found;
}

/** The bone a name means, with three's de-duplicating suffix (`pelvis_3`) allowed. */
function bonesInOrder(mesh: SkinnedMesh): Bone[] {
    const bones = mesh.skeleton.bones as Bone[];
    if (bones.length !== PEOPLE_BONES.length) throw new Error(`${bones.length} bones`);
    bones.forEach((bone, i) => {
        const name = PEOPLE_BONES[i];
        if (bone.name !== name && !new RegExp(`^${name}_\\d+$`).test(bone.name)) throw new Error(`bone ${i} is ${bone.name}, not ${name}`);
    });
    return bones;
}

/**
 * The skinned mesh in its rest pose in the person's space (feet at y 0, facing +z, its left +x), as a compact plain
 * geometry: float positions, signed-byte normals, the paint (rgb: the baked shade × a fixed colour; a: the part code,
 * `people.manifest.json` `format.parts`), the four joints and their byte weights.
 */
export function peopleRestGeometry(mesh: SkinnedMesh, root: Object3D): BufferGeometry {
    const source = mesh.geometry;
    const position = source.getAttribute("position");
    const normal = source.getAttribute("normal");
    const colour = source.getAttribute("color");
    const skinIndex = source.getAttribute("skinIndex");
    const skinWeight = source.getAttribute("skinWeight");
    if (!position || !normal || !colour || !skinIndex || !skinWeight) throw new Error("people mesh attributes");
    const bones = mesh.skeleton.bones as Bone[];
    const toRoot = new Matrix4().copy(root.matrixWorld).invert();
    const joint = bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, mesh.skeleton.boneInverses[i]));
    const toWorld = new Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
    const blended = new Matrix4();
    const v = new Vector3();
    const n = new Vector3();
    const count = position.count;
    const positions = new Float32Array(count * 3);
    const normals = new Int8Array(count * 4);
    const paint = new Uint8Array(count * 4);
    const joints = new Uint8Array(count * 4);
    const weights = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
        const e = blended.elements;
        e.fill(0);
        let total = 0;
        const w4 = [0, 0, 0, 0];
        for (let k = 0; k < 4; k++) {
            const w = skinWeight.getComponent(i, k);
            const j = skinIndex.getComponent(i, k);
            joints[i * 4 + k] = j;
            w4[k] = w;
            total += w;
            if (w <= 0) continue;
            const m = joint[j].elements;
            for (let q = 0; q < 16; q++) e[q] += m[q] * w;
        }
        if (total <= 0) blended.identity();
        else if (Math.abs(total - 1) > 1e-4) for (let q = 0; q < 16; q++) e[q] /= total;
        blended.premultiply(toWorld).multiply(mesh.bindMatrix).premultiply(toRoot);
        v.fromBufferAttribute(position, i).applyMatrix4(blended);
        positions.set([v.x, v.y, v.z], i * 3);
        n.fromBufferAttribute(normal, i).transformDirection(blended);
        normals.set([Math.round(n.x * 127), Math.round(n.y * 127), Math.round(n.z * 127), 0], i * 4);
        // Byte weights that still sum to 255 (the largest takes the rounding).
        const b = w4.map((w) => Math.round((w / (total || 1)) * 255));
        const big = b.indexOf(Math.max(...b));
        b[big] += 255 - (b[0] + b[1] + b[2] + b[3]);
        weights.set(b, i * 4);
        paint.set([Math.round(colour.getX(i) * 255), Math.round(colour.getY(i) * 255), Math.round(colour.getZ(i) * 255), Math.round(colour.getW(i) * 255)], i * 4);
    }
    const g = new Geometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("normal", new BufferAttribute(normals, 4, true));
    g.setAttribute("peoplePaint", new BufferAttribute(paint, 4, true));
    g.setAttribute("arkJoints", new BufferAttribute(joints, 4));
    g.setAttribute("arkWeights", new BufferAttribute(weights, 4, true));
    const index = source.getIndex();
    if (!index) throw new Error("people mesh index");
    g.setIndex(new BufferAttribute(index.array.slice(0), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
}

/** The clips' frames: how many rows the bake writes for each (frames + 1). */
export function clipRows(clips: readonly AnimationClip[]): {name: PeopleClipName; frames: number; seconds: number; row: number}[] {
    const out: {name: PeopleClipName; frames: number; seconds: number; row: number}[] = [];
    let row = 0;
    for (const name of Object.keys(PEOPLE_CLIPS) as PeopleClipName[]) {
        const clip = clips.find((c) => c.name === name);
        if (!clip) throw new Error(`no clip ${name}`);
        const frames = Math.max(1, Math.round(clip.duration * PEOPLE_CLIPS[name].fps));
        out.push({name, frames, seconds: clip.duration, row});
        row += frames + 1;
    }
    return out;
}

/**
 * The bake: every body's rest geometry (near and far), and every clip retargeted onto it, frame by frame, into one
 * bone texture. About 12 × 770 frames × 23 bones of matrix work, once at load.
 */
export function bakePeople(near: Gltf, far: Gltf, clips: Gltf): BakedPeople {
    const steps = bakePeopleSteps(near, far, clips);
    for (;;) {
        const step = steps.next();
        if (step.done) return step.value;
    }
}

/**
 * The bake one body at a time (a generator: the page takes a body a task, so no single task holds the main thread for
 * the whole bake on a phone).
 */
export function* bakePeopleSteps(near: Gltf, far: Gltf, clips: Gltf): Generator<void, BakedPeople, void> {
    near.scene.updateMatrixWorld(true);
    far.scene.updateMatrixWorld(true);
    clips.scene.updateMatrixWorld(true);
    const canon = bonesInOrder(skinnedOf(clips.scene));
    const canonQ = canon.map((b) => b.quaternion.clone());
    const canonP = canon.map((b) => b.position.clone());
    const canonQInv = canonQ.map((q) => q.clone().invert());
    const canonHip = new Vector3().setFromMatrixPosition(canon[BONE.pelvis].matrixWorld).y;
    const plan = clipRows(clips.animations);
    const rows = plan.reduce((sum, c) => sum + c.frames + 1, 0);
    const people = near.scene.children.filter((c) => (PERSON_IDS as readonly string[]).includes(c.name));
    if (people.length !== PERSON_IDS.length) throw new Error(`${people.length} people in the near file`);
    const width = PERSON_IDS.length * PERSON_TEXELS;
    const bones = new Uint16Array(width * rows * 4);
    const persons = new Map<PersonId, BakedPerson>();
    // Per clip: each track's sampler (three's interpolants), by bone and kind.
    const samplers = plan.map(({name}) => {
        const clip = clips.animations.find((c) => c.name === name)!;
        const rot: ({evaluate(t: number): ArrayLike<number>} | null)[] = PEOPLE_BONES.map(() => null);
        const pos: ({evaluate(t: number): ArrayLike<number>} | null)[] = PEOPLE_BONES.map(() => null);
        for (const track of clip.tracks) {
            const dot = track.name.lastIndexOf(".");
            const bone = PEOPLE_BONES.indexOf(track.name.slice(0, dot) as (typeof PEOPLE_BONES)[number]);
            if (bone < 0) continue;
            const kind = track.name.slice(dot + 1);
            const interpolant = track.createInterpolant() as unknown as {evaluate(t: number): ArrayLike<number>};
            if (kind === "quaternion") rot[bone] = interpolant;
            else if (kind === "position") pos[bone] = interpolant;
        }
        return {rot, pos};
    });
    const q = new Quaternion();
    const delta = new Vector3();
    const m = new Matrix4();
    const at = new Vector3();
    const axis = new Vector3();
    for (let p = 0; p < PERSON_IDS.length; p++) {
        const id = PERSON_IDS[p];
        const root = people.find((c) => c.name === id)!;
        const farRoot = far.scene.children.find((c) => c.name === id);
        if (!farRoot) throw new Error(`no far ${id}`);
        const mesh = skinnedOf(root);
        const own = bonesInOrder(mesh);
        const geometry = peopleRestGeometry(mesh, root);
        const farGeometry = peopleRestGeometry(skinnedOf(farRoot), farRoot);
        const restQ = own.map((b) => b.quaternion.clone());
        const restP = own.map((b) => b.position.clone());
        const toRoot = new Matrix4().copy(root.matrixWorld).invert();
        const restInv = own.map((b) => new Matrix4().multiplyMatrices(toRoot, b.matrixWorld).invert());
        const hip = new Vector3().setFromMatrixPosition(own[BONE.pelvis].matrixWorld).applyMatrix4(toRoot).y;
        const ratio = hip / canonHip;
        const shoulder = new Vector3().setFromMatrixPosition(own[BONE.upperarm_l].matrixWorld).applyMatrix4(toRoot).y;
        const height = geometry.boundingBox!.max.y;
        const column = p * PERSON_TEXELS;
        const grips = new Float32Array(rows * 6);
        const baked = {} as Record<PeopleClipName, BakedClip>;
        // The rest geometry's positions, joints and weights, to measure each clip's posed body.
        const P = geometry.getAttribute("position").array as Float32Array;
        const J = geometry.getAttribute("arkJoints").array as Uint8Array;
        const W = geometry.getAttribute("arkWeights").array as Uint8Array;
        const frameMatrices = own.map(() => new Matrix4());
        plan.forEach(({name, frames, seconds, row}, c) => {
            const {rot, pos} = samplers[c];
            let low = Infinity;
            let seat = Infinity;
            let head = new Vector3();
            let feet = new Vector3();
            for (let f = 0; f <= frames; f++) {
                const t = Math.min((f / frames) * seconds, seconds);
                own.forEach((bone, i) => {
                    const r = rot[i]?.evaluate(t);
                    if (r) bone.quaternion.copy(restQ[i]).multiply(canonQInv[i]).multiply(q.set(r[0], r[1], r[2], r[3]));
                    else bone.quaternion.copy(restQ[i]);
                    const s = pos[i]?.evaluate(t);
                    if (s) {
                        // The move in the canonical bone's rest frame, scaled to this body's hips, in this body's frame.
                        delta.set(s[0], s[1], s[2]).sub(canonP[i]).applyQuaternion(canonQInv[i]).multiplyScalar(ratio).applyQuaternion(restQ[i]);
                        bone.position.copy(restP[i]).add(delta);
                    } else bone.position.copy(restP[i]);
                });
                root.updateMatrixWorld(true);
                own.forEach((bone, i) => {
                    m.multiplyMatrices(toRoot, bone.matrixWorld).multiply(restInv[i]);
                    frameMatrices[i].copy(m);
                    const e = m.elements;
                    const base = ((row + f) * width + column + i * 3) * 4;
                    for (let r = 0; r < 3; r++) {
                        bones[base + r * 4] = DataUtils.toHalfFloat(e[r]);
                        bones[base + r * 4 + 1] = DataUtils.toHalfFloat(e[4 + r]);
                        bones[base + r * 4 + 2] = DataUtils.toHalfFloat(e[8 + r]);
                        bones[base + r * 4 + 3] = DataUtils.toHalfFloat(e[12 + r]);
                    }
                });
                // The grips: past each hand bone along it (its +y).
                for (const [k, bone] of [[0, own[BONE.hand_l]], [1, own[BONE.hand_r]]] as const) {
                    m.multiplyMatrices(toRoot, bone.matrixWorld);
                    at.setFromMatrixPosition(m);
                    axis.setFromMatrixColumn(m, 1).normalize().multiplyScalar(GRIP_REACH * ratio);
                    at.add(axis);
                    grips.set([at.x, at.y, at.z], (row + f) * 6 + k * 3);
                }
                if (f === 0 || f === Math.floor(frames / 2)) {
                    // The posed body's lowest point, and its seat (the hips' and thighs' underside).
                    for (let v = 0; v < P.length / 3; v++) {
                        let y = 0;
                        let x = 0;
                        let z = 0;
                        let hips = 0;
                        for (let k = 0; k < 4; k++) {
                            const w = W[v * 4 + k] / 255;
                            if (w <= 0) continue;
                            const jj = J[v * 4 + k];
                            const e = frameMatrices[jj].elements;
                            x += (e[0] * P[v * 3] + e[4] * P[v * 3 + 1] + e[8] * P[v * 3 + 2] + e[12]) * w;
                            y += (e[1] * P[v * 3] + e[5] * P[v * 3 + 1] + e[9] * P[v * 3 + 2] + e[13]) * w;
                            z += (e[2] * P[v * 3] + e[6] * P[v * 3 + 1] + e[10] * P[v * 3 + 2] + e[14]) * w;
                            if (jj === BONE.pelvis || jj === BONE.thigh_l || jj === BONE.thigh_r) hips += w;
                        }
                        void x;
                        void z;
                        if (y < low) low = y;
                        if (hips > 0.6 && y < seat) seat = y;
                    }
                }
                if (f === 0) {
                    head = new Vector3().setFromMatrixPosition(m.multiplyMatrices(toRoot, own[BONE.head].matrixWorld));
                    const l = new Vector3().setFromMatrixPosition(m.multiplyMatrices(toRoot, own[BONE.ball_l].matrixWorld));
                    const r = new Vector3().setFromMatrixPosition(m.multiplyMatrices(toRoot, own[BONE.ball_r].matrixWorld));
                    feet = l.add(r).multiplyScalar(0.5);
                }
            }
            let fixYaw = 0;
            let fixX = 0;
            let fixZ = 0;
            if (PEOPLE_CLIPS[name].lying) {
                // Turn the body so it runs from the feet (at the root) to the head toward −z.
                fixYaw = Math.PI - Math.atan2(head.x - feet.x, head.z - feet.z);
                const cy = Math.cos(fixYaw);
                const sy = Math.sin(fixYaw);
                fixX = -(feet.x * cy + feet.z * sy);
                fixZ = -(-feet.x * sy + feet.z * cy);
            }
            baked[name] = {name, row, frames, seconds, low: Number.isFinite(low) ? low : 0, seat: Number.isFinite(seat) ? seat : hip, fixYaw, fixX, fixZ};
        });
        // Back to the rest pose (the file's objects are let go after the bake).
        own.forEach((bone, i) => {
            bone.quaternion.copy(restQ[i]);
            bone.position.copy(restP[i]);
        });
        persons.set(id, {id, near: geometry, far: farGeometry, column, height, hip, shoulder, clips: baked, grips});
        yield;
    }
    return {persons, bones, width, height: rows, rows};
}

// MARK: - Per person, per frame

export type PeoplePose = {
    person: BakedPerson;
    clip: BakedClip;
    /** Rows to blend and how far between them. */
    rowA: number;
    rowB: number;
    frac: number;
    /** The body's scale (look height × growth over the body's own height) and the procedural one (over 1.75 m). */
    scale: number;
};

/** The walking paces the town gives (m/s): the pavements' `WALK_PACE` (about), a dog walk's (`DOG_WALK_PACE`). */
export const PEOPLE_PACE = {walk: WALK_PACE, dog: 1.05};

/** Where a person is in their clip now (`seconds`: the shared clock), written into `out`. */
export function peoplePose(baked: BakedPeople, h: HumanInstance, seconds: number, work: boolean, out: PeoplePose): PeoplePose {
    const dog = (h as {what?: string}).what === "dogwalk";
    const person = baked.persons.get(personFor(h.look, h.pose, work))!;
    const name = peopleClip(h.pose, dog);
    const clip = person.clips[name];
    const spec = PEOPLE_CLIPS[name];
    const scale = (h.look.height * (h.scale ?? 1)) / person.height;
    let rate = 1;
    if (spec.ground) rate = (dog ? PEOPLE_PACE.dog : PEOPLE_PACE.walk) / (spec.ground * (person.hip / CANON_HIP) * scale);
    const t = ((h.phase + seconds) * rate) / clip.seconds;
    const u = t - Math.floor(t);
    const at = u * clip.frames;
    const f = Math.min(Math.floor(at), clip.frames - 1);
    out.person = person;
    out.clip = clip;
    out.rowA = clip.row + f;
    out.rowB = clip.row + f + 1;
    out.frac = at - f;
    out.scale = scale;
    return out;
}

const qa = new Quaternion();
const qb = new Quaternion();
const yAxis = new Vector3(0, 1, 0);
const xAxis = new Vector3(0, 0, 0).set(1, 0, 0);
const move = new Vector3();
const size = new Vector3();
const inner = new Matrix4();

/**
 * The person's instance matrix: at its root, turned to its yaw, its slope's tilt (lying), scaled (the look's build
 * widens it a little), then the lying clips' own fix; lifted so the feet, the hips on a seat or the body on the ground
 * meet what the scene put them on.
 */
export function peopleMatrix(h: HumanInstance, pose: PeoplePose, out: Matrix4): Matrix4 {
    const {clip, scale} = pose;
    const spec = PEOPLE_CLIPS[clip.name];
    const proc = (h.look.height * (h.scale ?? 1)) / 1.75;
    const lift = spec.contact === "seat" ? 0.86 * proc - clip.seat * scale : spec.contact === "low" ? -clip.low * scale : 0;
    qa.setFromAxisAngle(yAxis, h.yaw);
    if (spec.lying && h.tilt) qa.multiply(qb.setFromAxisAngle(xAxis, h.tilt));
    const build = 1 + (h.look.build - 1) * 0.6;
    out.compose(move.set(h.x, h.y + lift, h.z), qa, size.set(scale * build, scale, scale * (0.96 + 0.04 * h.look.build)));
    if (clip.fixYaw || clip.fixX || clip.fixZ) {
        inner.makeRotationY(clip.fixYaw).setPosition(clip.fixX, 0, clip.fixZ);
        out.multiply(inner);
    }
    return out;
}

/** A person's grip points now (world), from the bake's rows and the same matrix the body is drawn with. */
export function peopleGrips(pose: PeoplePose, matrix: Matrix4, left: Vector3, right: Vector3): void {
    const g = pose.person.grips;
    const a = pose.rowA * 6;
    const b = pose.rowB * 6;
    const t = pose.frac;
    left.set(g[a] + (g[b] - g[a]) * t, g[a + 1] + (g[b + 1] - g[a + 1]) * t, g[a + 2] + (g[b + 2] - g[a + 2]) * t).applyMatrix4(matrix);
    right.set(g[a + 3] + (g[b + 3] - g[a + 3]) * t, g[a + 4] + (g[b + 4] - g[a + 4]) * t, g[a + 5] + (g[b + 5] - g[a + 5]) * t).applyMatrix4(matrix);
}
