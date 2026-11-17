/**
 * The Ark's people drawn with the rigged bodies (`people-rig.ts`): a drop-in for `HumanFigures` (the same `group`,
 * `setFrame(list, camera, seconds)`, `drawn` and `dispose`), so nothing that decides where people are or what they do
 * changes (`HUMANS-FIGURE-INTERFACE.md`).
 *
 * The three files (870 KB, meshopt) are fetched only when a person is first to be drawn: with no humans aboard (the
 * server's `humans` switch off) nothing loads. Until they are in, or if they fail, the procedural figures draw the
 * people, as before. `globalThis.__arkPeople = "procedural"` (the harness's `?people=procedural`) keeps the procedural
 * figures, for comparisons.
 *
 * Drawn instanced: per body, a near mesh (within `HUMAN_NEAR`, casting shadows) and a far one (to `HUMAN_FAR`), only
 * the bodies someone wears now. Each person carries its colours and two rows of the bone texture with the blend
 * between them; the vertex shader skins the body from the texture. Written into preallocated arrays each frame.
 */

import {BufferGeometry, DataTexture, Group, HalfFloatType, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshDepthMaterial, MeshStandardMaterial, NearestFilter, RGBADepthPacking, RGBAFormat, Vector3, type WebGLProgramParametersWithUniforms} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {HUMAN_FAR, HUMAN_MAX, HUMAN_NEAR, HumanFigures, type HumanInstance} from "@/ark-scene/humans/figures";
import {ARM_FIRST, ARM_LAST, bakePeople, LEAN_FIRST, LEAN_LAST, PEOPLE_BASE, PEOPLE_FILES, PERSON_IDS, peopleGrips, peopleMatrix, peoplePose, type BakedPeople, type PeoplePose, type PersonId} from "@/ark-scene/humans/people-rig";

const PEOPLE_GLSL = /* glsl */ `
uniform highp sampler2D peopleBones;
attribute vec4 peoplePaint;
attribute vec4 arkJoints;
attribute vec4 arkWeights;
attribute vec3 iSkin;
attribute vec3 iTop;
attribute vec3 iBottom;
attribute vec3 iHair;
attribute vec4 iAnim;
attribute vec4 iMisc;
varying vec3 vPeopleColour;
varying float vPeopleLight;
mat4 peopleBone(float row, float bone) {
    int x = int(iAnim.w + 0.5) + int(bone + 0.5) * 3;
    int y = int(row + 0.5);
    vec4 r0 = texelFetch(peopleBones, ivec2(x, y), 0);
    vec4 r1 = texelFetch(peopleBones, ivec2(x + 1, y), 0);
    vec4 r2 = texelFetch(peopleBones, ivec2(x + 2, y), 0);
    return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 peopleBoneAt(float bone) {
    return peopleBone(iAnim.x, bone) * (1.0 - iAnim.z) + peopleBone(iAnim.y, bone) * iAnim.z;
}
float peopleUpper(float bone) {
    return bone > ${LEAN_FIRST - 0.5} && bone < ${LEAN_LAST + 0.5} && !(bone > ${ARM_FIRST - 0.5} && bone < ${ARM_LAST + 0.5}) ? 1.0 : 0.0;
}
float peopleArm(float bone) {
    return bone > ${ARM_FIRST - 0.5} && bone < ${ARM_LAST + 0.5} ? 1.0 : 0.0;
}
// The skin this frame. A driver's lean (iMisc.y, forward +) turns the trunk and head about the hips (iMisc.z high);
// the arms go with the shoulders (iMisc.w high) without turning, so the hands stay out at the wheel.
mat4 peopleSkinMatrix() {
    mat4 m = peopleBoneAt(arkJoints.x) * arkWeights.x + peopleBoneAt(arkJoints.y) * arkWeights.y
        + peopleBoneAt(arkJoints.z) * arkWeights.z + peopleBoneAt(arkJoints.w) * arkWeights.w;
    if (abs(iMisc.y) > 0.001) {
        float upper = peopleUpper(arkJoints.x) * arkWeights.x + peopleUpper(arkJoints.y) * arkWeights.y
            + peopleUpper(arkJoints.z) * arkWeights.z + peopleUpper(arkJoints.w) * arkWeights.w;
        float arm = peopleArm(arkJoints.x) * arkWeights.x + peopleArm(arkJoints.y) * arkWeights.y
            + peopleArm(arkJoints.z) * arkWeights.z + peopleArm(arkJoints.w) * arkWeights.w;
        float c = cos(iMisc.y);
        float s = sin(iMisc.y);
        float p = iMisc.z;
        float up = iMisc.w - p;
        mat4 lean = mat4(1.0, 0.0, 0.0, 0.0, 0.0, c, s, 0.0, 0.0, -s, c, 0.0, 0.0, p * (1.0 - c), -p * s, 1.0);
        mat4 follow = mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, up * (c - 1.0), up * s, 1.0);
        m = (lean * m) * upper + (follow * m) * arm + m * (1.0 - upper - arm);
    }
    return m;
}
// Parts (people.manifest.json format.parts): 0 skin, 1 top, 2 bottom, 3 hair, 4 shoes, 5 fixed, 6 brow and lash,
// 7 swimwear (the top's colour), 8 eye. The paint's rgb is the baked shade times the part's fixed colour.
vec3 peopleColour() {
    float part = floor(peoplePaint.a * 16.0);
    vec3 c;
    if (part < 0.5) c = iSkin;
    else if (part < 1.5) c = iTop;
    else if (part < 2.5) c = iBottom;
    else if (part < 3.5) c = iHair;
    else if (part < 4.5) c = iBottom * 0.3 + vec3(0.045, 0.04, 0.038);
    else if (part < 5.5) c = vec3(1.0);
    else if (part < 6.5) c = iHair * 0.55;
    else if (part < 7.5) c = iTop;
    else c = vec3(1.0);
    return c * peoplePaint.rgb;
}
`;

function peopleShader(shader: WebGLProgramParametersWithUniforms, bones: {value: DataTexture | null}, colour: boolean) {
    shader.uniforms.peopleBones = bones;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${PEOPLE_GLSL}`);
    if (colour) {
        shader.vertexShader = shader.vertexShader
            .replace("#include <beginnormal_vertex>", "mat4 peopleSkin = peopleSkinMatrix();\nvec3 objectNormal = normalize(mat3(peopleSkin) * normal);")
            .replace("#include <begin_vertex>", "vec3 transformed = (peopleSkin * vec4(position, 1.0)).xyz;")
            .replace("#include <color_vertex>", "#include <color_vertex>\nvPeopleColour = peopleColour();\nvPeopleLight = iMisc.x;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vPeopleColour;\nvarying float vPeopleLight;")
            .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vPeopleColour, opacity );")
            // (Indoors at night: the room's lamp and the screen's glow on them, as the procedural figures.)
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vPeopleColour * vPeopleLight * vec3(0.5, 0.47, 0.44);");
    } else {
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = (peopleSkinMatrix() * vec4(position, 1.0)).xyz;");
    }
}

type Level = {mesh: InstancedMesh; skin: InstancedBufferAttribute; top: InstancedBufferAttribute; bottom: InstancedBufferAttribute; hair: InstancedBufferAttribute; anim: InstancedBufferAttribute; misc: InstancedBufferAttribute; attrs: InstancedBufferAttribute[]; count: number; capacity: number; geometry: BufferGeometry; near: boolean};

const noRaycast = () => {};

/** The bake and its one bone texture, shared by every renderer on the page (the town's and the forest's). */
type Shared = {baked: BakedPeople; texture: DataTexture; users: number};

/** A renderer's loaded side: the shared bake and each body's two levels (made on first use). */
type Loaded = {shared: Shared; baked: BakedPeople; texture: DataTexture; levels: Map<string, Level>; list: Level[]};

/** One fetch and one bake for every renderer on the page; let go when the last renderer is disposed. */
let shared: Promise<Shared> | null = null;
function loadPeople(base: string): Promise<Shared> {
    if (shared) return shared;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const get = (file: string) => loader.loadAsync(`${base}/${file}`);
    shared = Promise.all([get(PEOPLE_FILES.near), get(PEOPLE_FILES.far), get(PEOPLE_FILES.clips)]).then(([near, far, clips]) => {
        const baked = bakePeople(near, far, clips);
        // (The files' own meshes are not drawn: only the bake's compact geometries are kept.)
        for (const g of [near, far, clips]) g.scene.traverse((o) => (o as {geometry?: {dispose(): void}}).geometry?.dispose());
        const texture = new DataTexture(baked.bones, baked.width, baked.height, RGBAFormat, HalfFloatType);
        texture.minFilter = NearestFilter;
        texture.magFilter = NearestFilter;
        texture.generateMipmaps = false;
        texture.flipY = false;
        texture.needsUpdate = true;
        // Once on the GPU, the 5 MB of matrices leave the JS heap (the phone's tightest budget; a new scene bakes again).
        texture.onUpdate = () => {
            (texture as unknown as {image: unknown}).image = {data: null, width: baked.width, height: baked.height};
            baked.bones = new Uint16Array(0);
        };
        return {baked, texture, users: 0};
    });
    shared.catch(() => (shared = null));
    return shared;
}

function release(s: Shared) {
    if (--s.users > 0) return;
    s.texture.dispose();
    s.baked.persons.forEach((p) => {
        p.near.dispose();
        p.far.dispose();
    });
    shared = null;
}

export class PeopleFigures {
    readonly group = new Group();
    /** How many were drawn at the last frame (near, far). */
    drawn = {near: 0, far: 0};
    private fallback: HumanFigures | null = null;
    private loaded: Loaded | null = null;
    private loading = false;
    private failed = false;
    private disposed = false;
    private readonly bones = {value: null as DataTexture | null};
    private readonly material: MeshStandardMaterial;
    private readonly depth: MeshDepthMaterial;
    private readonly pose: PeoplePose = {person: null!, clip: null!, rowA: 0, rowB: 0, frac: 0, scale: 1};
    private readonly matrix = new Matrix4();
    private order: number[] = [];
    private distances = new Float32Array(HUMAN_MAX);
    private last: readonly HumanInstance[] = [];
    private lastSeconds = 0;
    private readonly work: boolean;
    private readonly base: string;

    /** `work`: the forest's crews (work clothes, hi-vis and helmets). */
    constructor(options: {work?: boolean; base?: string} = {}) {
        this.group.name = "humans";
        this.work = options.work === true;
        this.base = options.base ?? PEOPLE_BASE;
        this.material = new MeshStandardMaterial({color: 0xffffff, roughness: 0.8, metalness: 0});
        this.material.customProgramCacheKey = () => "ark-people";
        this.material.onBeforeCompile = (shader) => peopleShader(shader, this.bones, true);
        this.depth = new MeshDepthMaterial({depthPacking: RGBADepthPacking});
        this.depth.customProgramCacheKey = () => "ark-people-depth";
        this.depth.onBeforeCompile = (shader) => peopleShader(shader, this.bones, false);
        if ((globalThis as {__arkPeople?: string}).__arkPeople === "procedural") this.failed = true;
    }

    /** Whether the rigged bodies are drawing (false: the procedural figures, while loading or after a failure). */
    get rigged(): boolean {
        return this.loaded !== null;
    }

    setFrame(list: readonly HumanInstance[], camera: Vector3, seconds: number): void {
        this.last = list;
        this.lastSeconds = seconds;
        if (!this.loaded) {
            if (list.length && !this.loading && !this.failed) this.load();
            if (!list.length && !this.fallback) return;
            const fallback = this.fallback ?? (this.fallback = new HumanFigures());
            if (!fallback.group.parent) this.group.add(fallback.group);
            fallback.setFrame(list, camera, seconds);
            this.drawn.near = fallback.drawn.near;
            this.drawn.far = fallback.drawn.far;
            return;
        }
        const levels = this.loaded.list;
        if (this.distances.length < list.length) this.distances = new Float32Array(list.length * 2);
        const order = this.order;
        order.length = 0;
        for (let i = 0; i < list.length; i++) {
            const h = list[i];
            const d = Math.sqrt((h.x - camera.x) ** 2 + (h.y - camera.y) ** 2 + (h.z - camera.z) ** 2);
            this.distances[i] = d;
            if (d < HUMAN_FAR) order.push(i);
        }
        if (order.length > HUMAN_MAX) {
            order.sort((a, b) => this.distances[a] - this.distances[b]);
            order.length = HUMAN_MAX;
        }
        for (const l of levels) l.count = 0;
        let near = 0;
        let far = 0;
        for (const i of order) {
            const h = list[i];
            const pose = peoplePose(this.loaded.baked, h, seconds, this.work, this.pose);
            const isNear = this.distances[i] < HUMAN_NEAR;
            const l = this.level(pose.person.id, isNear);
            this.write(l, h, pose);
            if (isNear) near++;
            else far++;
        }
        for (const l of levels) {
            l.mesh.count = l.count;
            l.mesh.visible = l.count > 0;
            if (!l.count) continue;
            l.mesh.instanceMatrix.needsUpdate = true;
            l.mesh.instanceMatrix.clearUpdateRanges();
            l.mesh.instanceMatrix.addUpdateRange(0, l.count * 16);
            for (const a of l.attrs) {
                a.needsUpdate = true;
                a.clearUpdateRanges();
                a.addUpdateRange(0, l.count * a.itemSize);
            }
        }
        this.drawn.near = near;
        this.drawn.far = far;
    }

    /**
     * A drawn person's grip points now (world: the left hand's and the right's, where a tool's handle or a lead is
     * held), with the same pose and matrix the body is drawn with. False while the procedural figures draw.
     */
    grips(h: HumanInstance, seconds: number, left: Vector3, right: Vector3): boolean {
        if (!this.loaded) return false;
        const pose = peoplePose(this.loaded.baked, h, seconds, this.work, this.pose);
        peopleMatrix(h, pose, this.matrix);
        peopleGrips(pose, this.matrix, left, right);
        return true;
    }

    /**
     * The dog walks' leads: the hand of the walker `id` (as drawn at the last frame) nearer the scene's own guess at
     * it, written into `hand`. False when that walker is not drawn or the rigged bodies are not in.
     */
    leadHand(id: string, hand: {x: number; y: number; z: number}): boolean {
        if (!this.loaded) return false;
        let h: HumanInstance | null = null;
        for (const p of this.last) {
            if ((p as {id?: string}).id === id) {
                h = p;
                break;
            }
        }
        if (!h || !this.grips(h, this.lastSeconds, leftHand, rightHand)) return false;
        const dl = (leftHand.x - hand.x) ** 2 + (leftHand.z - hand.z) ** 2;
        const dr = (rightHand.x - hand.x) ** 2 + (rightHand.z - hand.z) ** 2;
        const g = dl < dr ? leftHand : rightHand;
        hand.x = g.x;
        hand.y = g.y;
        hand.z = g.z;
        return true;
    }

    private load() {
        this.loading = true;
        loadPeople(this.base).then(
            (s) => {
                if (this.disposed) return;
                s.users++;
                this.bones.value = s.texture;
                this.loaded = {shared: s, baked: s.baked, texture: s.texture, levels: new Map(), list: []};
                // Hand over from the procedural figures on the next frame.
                if (this.fallback) {
                    this.fallback.dispose();
                    this.fallback = null;
                }
                this.loading = false;
            },
            (error) => {
                console.warn("[ark] people", error instanceof Error ? error.message : error);
                this.loading = false;
                this.failed = true;
            }
        );
    }

    private level(id: PersonId, near: boolean): Level {
        const key = near ? `${id}:near` : `${id}:far`;
        const levels = this.loaded!.levels;
        let l = levels.get(key);
        if (!l) {
            const person = this.loaded!.baked.persons.get(id)!;
            l = this.makeLevel(near ? person.near : person.far, near, key, 8);
            levels.set(key, l);
            this.loaded!.list.push(l);
        }
        if (l.count >= l.capacity) {
            const bigger = this.makeLevel(l.geometry, near, key, Math.min(HUMAN_MAX, l.capacity * 2), l);
            levels.set(key, bigger);
            this.loaded!.list[this.loaded!.list.indexOf(l)] = bigger;
            l = bigger;
        }
        return l;
    }

    /** A body's instanced level (`from`: a full one it replaces, its people so far copied over). */
    private makeLevel(geometry: BufferGeometry, near: boolean, name: string, capacity: number, from?: Level): Level {
        const attr = (size: number, old?: InstancedBufferAttribute) => {
            const a = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
            a.setUsage(35048); // DynamicDrawUsage
            if (old) (a.array as Float32Array).set(old.array as Float32Array);
            return a;
        };
        // Each renderer its own geometry over the body's shared vertex attributes (the town's and the forest's people
        // carry their own per-person attributes; the vertices are uploaded once).
        let g = from?.geometry;
        if (!g) {
            g = new BufferGeometry();
            for (const key of Object.keys(geometry.attributes)) g.setAttribute(key, geometry.getAttribute(key));
            g.setIndex(geometry.getIndex());
            g.boundingSphere = geometry.boundingSphere;
            g.boundingBox = geometry.boundingBox;
        }
        const mesh = new InstancedMesh(g, this.material, capacity);
        const skin = attr(3, from?.skin), top = attr(3, from?.top), bottom = attr(3, from?.bottom), hair = attr(3, from?.hair), anim = attr(4, from?.anim), misc = attr(4, from?.misc);
        const l: Level = {mesh, skin, top, bottom, hair, anim, misc, attrs: [skin, top, bottom, hair, anim, misc], count: from?.count ?? 0, capacity, geometry: g, near};
        if (from) (mesh.instanceMatrix.array as Float32Array).set(from.mesh.instanceMatrix.array as Float32Array);
        g.setAttribute("iSkin", l.skin);
        g.setAttribute("iTop", l.top);
        g.setAttribute("iBottom", l.bottom);
        g.setAttribute("iHair", l.hair);
        g.setAttribute("iAnim", l.anim);
        g.setAttribute("iMisc", l.misc);
        mesh.name = `humans:${name}`;
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = near;
        mesh.receiveShadow = true;
        if (near) mesh.customDepthMaterial = this.depth;
        mesh.userData.kind = "human";
        // (The high tier's ambient occlusion draws every object with one plain material, which would see the rest pose.)
        mesh.userData.gtaoSkip = true;
        mesh.raycast = noRaycast;
        if (from) {
            from.mesh.removeFromParent();
            from.mesh.dispose();
        }
        this.group.add(mesh);
        return l;
    }

    private write(l: Level, h: HumanInstance, pose: PeoplePose) {
        const k = l.count++;
        peopleMatrix(h, pose, this.matrix);
        l.mesh.setMatrixAt(k, this.matrix);
        const look = h.look;
        l.skin.setXYZ(k, look.skin[0], look.skin[1], look.skin[2]);
        l.top.setXYZ(k, look.top[0], look.top[1], look.top[2]);
        l.bottom.setXYZ(k, look.bottom[0], look.bottom[1], look.bottom[2]);
        // (No hair: the hair's shell takes the skin's colour.)
        const hair = look.bald ? look.skin : look.hair;
        l.hair.setXYZ(k, hair[0], hair[1], hair[2]);
        l.anim.setXYZW(k, pose.rowA, pose.rowB, pose.frac, pose.person.column);
        l.misc.setXYZW(k, h.light ?? 0, h.lean ?? 0, pose.person.hip, pose.person.shoulder);
    }

    /** Triangles of a body at each level (the largest of the twelve), for the budget's test and the report. */
    static triangles(baked: BakedPeople): {near: number; far: number} {
        let near = 0;
        let far = 0;
        baked.persons.forEach((p) => {
            near = Math.max(near, p.near.index!.count / 3);
            far = Math.max(far, p.far.index!.count / 3);
        });
        return {near, far};
    }

    dispose(): void {
        this.disposed = true;
        this.fallback?.dispose();
        this.fallback = null;
        if (this.loaded) {
            for (const l of this.loaded.list) {
                l.mesh.dispose();
                l.geometry.dispose();
            }
            release(this.loaded.shared);
        }
        this.material.dispose();
        this.depth.dispose();
        this.group.removeFromParent();
    }
}

const leftHand = new Vector3();
const rightHand = new Vector3();

/** The bodies' ids (for tests and the harness). */
export const PEOPLE_BODIES: readonly PersonId[] = PERSON_IDS;
