/**
 * The rigged animals' player: a species' rig file (its Ark near mesh with a
 * skin, and its baked bone matrices) played on the GPU, one draw call per
 * species, for the few animals close to the camera, focused, or the viewer's
 * own. Everyone else keeps today's near and far meshes and their procedural
 * motion (`animal-material.ts`).
 *
 * The rig sets (`rigBasesFrom`: v2, then v1) each have a manifest
 * (`<rigBase>/manifest.json`, `rig-clips.ts`), read once (cached by the
 * browser). A species plays from the first set that lists it (v2 when its
 * manifest is up and lists it, else v1), and from the next if that file
 * fails. Each gives the species' rig file, `<rigBase>/<slug>/<v>.rig.glb`:
 * a skinned glTF (meshopt) without its animations or skin texture (the near
 * level's texture is the same image), carrying in `extras.ark_rig` its entry
 * (state, pose, facing, the published clips and their rows) and a buffer
 * view of float16 bone matrices: per clip, per frame, per bone, the 3×4 rows
 * that take a vertex of the rest pose (in the Ark model's space) to its place
 * in that frame. Only the published clips are in it, and `rigClip`'s rule is
 * applied to them again here.
 *
 * At load the mesh is put in its rest pose in the model's space (so it lines
 * up with the near model: at weight 0 the two are the same figure), its
 * joints renumbered to the texture's bones, and the matrices go into an
 * RGBA half-float texture (a row per frame, three texels per bone).
 *
 * A missing, failed or late rig is never an error: the animal stays
 * procedural. Downloads are capped per session (species and bytes), and
 * rigs not drawn for a while are let go.
 */

import {
    BufferAttribute,
    BufferGeometry,
    DataTexture,
    HalfFloatType,
    Matrix3,
    Matrix4,
    NearestFilter,
    RGBAFormat,
    Vector3,
    type Bone,
    type SkinnedMesh
} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
    FLIGHT_CLIPS,
    decodeRigEntry,
    decodeRigLook,
    decodeRigSet,
    flightApproved,
    rigClip,
    rigLookLimits,
    rigPlayable,
    rigSetVersion,
    type RigClip,
    type RigEntry,
    type RigIndex,
    type RigSetIndex
} from "@/ark-scene/rig-clips";
import {gripBones} from "@/ark-scene/map/grip";

export type RigClipData = RigClip & {name: string; row: number; rows: number};

export type RigModel = {
    slug: string;
    /** Rest pose in model space, with `arkJoints` (texture bone indices) and `arkWeights`. */
    geometry: BufferGeometry;
    texture: DataTexture;
    bones: number;
    clips: Record<string, RigClipData>;
    facingDeg: number;
    bytes: number;
    /** The bone matrices (half floats) kept on the CPU for the root's own motion (`rootOffset`). */
    data: Uint16Array;
    /** The rest mesh's middle (model units). */
    centre: Vector3;
    /** The set it was read from (2: v2; 1: the v1 fallback), and the file's own entry format (1 when absent). */
    set: number;
    entryVersion: number;
    plan: string | null;
    /** Whether its flight clips play (the set's and the species' approval, and at least one kept). */
    flight: boolean;
    /** A flyer with no playable flap: in the air its wings are drawn open (an open-wing clip held, the shader flap on it). */
    flightOpen: boolean;
    /** The head and neck chain the look turns (`rigLookChain`); null when the rig has no head bone. */
    look: RigLookChain | null;
    /** The bones that grip (feet, hands, claws: `map/grip.ts`), each with its rest position (model units). */
    grips: Array<{bone: number; rest: {x: number; y: number; z: number}}>;
    /** Last time it was drawn (seconds), for letting it go. */
    usedAt: number;
};

/**
 * A rig's look chain for the shader (contract section 5): the bones'
 * texture indices (neck -1 on a chain rig: the head only), their pivots in
 * the rest pose (model space), the limits in radians, and the neck's share.
 */
export type RigLookChain = {
    neck: number;
    head: number;
    neckPivot: [number, number, number];
    headPivot: [number, number, number];
    yaw: number;
    up: number;
    down: number;
    neckShare: number;
};

const DEG = Math.PI / 180;

/**
 * A rig's look chain: a v2 entry's `look` (its bones, pivots, limits and
 * share), else (a v1 file) its own `neck` and `head` bones at their rest
 * joints, within the plan's limits. Null without a head bone.
 */
export function rigLookChain(entry: RigEntry, slug: string, boneNames: readonly string[], restPivot: (name: string) => [number, number, number] | null): RigLookChain | null {
    const look = decodeRigLook(entry.look);
    if (look) {
        const hasNeck = look.bones.length === 2 && look.bones[0] === "neck";
        const headName = look.bones[look.bones.length - 1];
        const head = boneNames.indexOf(headName);
        const neck = hasNeck ? boneNames.indexOf(look.bones[0]) : -1;
        if (head < 0 || (hasNeck && neck < 0)) return null;
        const share = hasNeck ? Math.min(Math.max(Number(look.share.neck ?? 0.5), 0), 1) : 0;
        return {
            neck,
            head,
            neckPivot: hasNeck ? look.rest[look.bones[0]].head : [0, 0, 0],
            headPivot: look.rest[headName].head,
            yaw: look.limits_deg.yaw * DEG,
            up: look.limits_deg.pitch_up * DEG,
            down: look.limits_deg.pitch_down * DEG,
            neckShare: share
        };
    }
    if (entry.look === null && (entry.version ?? 1) >= 2) return null;
    // A v1 file: no `look`; its neck and head bones (every legged v1 rig has them) at their rest joints.
    const head = boneNames.indexOf("head");
    if (head < 0) return null;
    const headPivot = restPivot("head");
    if (!headPivot) return null;
    const neckAt = boneNames.indexOf("neck");
    const neckPivot = neckAt >= 0 ? restPivot("neck") : null;
    const neck = neckPivot ? neckAt : -1;
    const {limits_deg, neck: neckShare} = rigLookLimits(entry.plan, slug);
    if (limits_deg.yaw <= 0 && limits_deg.pitch_up <= 0 && limits_deg.pitch_down <= 0) return null;
    return {neck, head, neckPivot: neckPivot ?? [0, 0, 0], headPivot, yaw: limits_deg.yaw * DEG, up: limits_deg.pitch_up * DEG, down: limits_deg.pitch_down * DEG, neckShare: neck >= 0 ? neckShare : 0};
}

/** A rig set as the library reads it: its folder, and its manifest. */
export type RigSet = RigSetIndex & {base: string};

/**
 * Which sets a species plays from, in order: every set that lists it, the
 * first one first (v2 before the v1 fallback). A species no set lists has
 * no rig.
 */
export function rigChoices(sets: readonly (RigSet | null)[]): Map<string, RigSet[]> {
    const out = new Map<string, RigSet[]>();
    for (const set of sets) {
        if (!set) continue;
        for (const slug of Object.keys(set.index)) {
            const list = out.get(slug);
            if (list) list.push(set);
            else out.set(slug, [set]);
        }
    }
    return out;
}

export type RigCaps = {species: number; bytes: number};

/** Default session caps: rig files downloaded, and their bytes. */
export const RIG_CAPS: RigCaps = {species: 48, bytes: 9_000_000};
export const RIG_CAPS_LITE: RigCaps = {species: 14, bytes: 2_500_000};

type RigExtras = {bufferView: number; bones: string[]; rows: number; rig?: unknown};

/**
 * Float16 (IEEE half) to float, for reading a bone matrix on the CPU (the
 * leap's root offset); the GPU reads the half floats directly.
 */
export function halfToFloat(h: number): number {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    if (e === 0) return s * 2 ** -14 * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * 2 ** (e - 15) * (1 + f / 1024);
}

export class RigLibrary {
    private sets: RigSet[] = [];
    private choices: Map<string, RigSet[]> | null = null;
    private readonly manifestReady: Promise<RigIndex | null>;
    private readonly loader: GLTFLoader;
    private readonly models = new Map<string, RigModel>();
    private readonly failed = new Set<string>();
    private readonly queue: string[] = [];
    private readonly queued = new Set<string>();
    private active = 0;
    private downloaded = 0;
    private loadedSpecies = 0;
    private disposed = false;
    private readonly abort = new AbortController();
    caps: RigCaps;
    /** Called when a rig is ready to draw. */
    onLoad: (slug: string) => void = () => undefined;

    /**
     * `bases`: the rig sets in order (`rigBasesFrom`: the release's set, then
     * the v1 fallback); one folder or null (no rigs) as before.
     */
    constructor(bases: readonly string[] | string | null, caps: RigCaps, private readonly concurrency = 2) {
        this.caps = caps;
        this.loader = new GLTFLoader();
        this.loader.setMeshoptDecoder(MeshoptDecoder);
        const roots = (bases === null ? [] : typeof bases === "string" ? [bases] : bases).map((base) => base.replace(/\/+$/, "")).filter(Boolean);
        this.manifestReady = !roots.length
            ? Promise.resolve(null)
            : Promise.all(roots.map((base) => this.readSet(base))).then((sets) => {
                  this.sets = sets.filter((set): set is RigSet => Boolean(set));
                  this.choices = rigChoices(this.sets);
                  this.pump();
                  if (!this.sets.length) return null;
                  const index: RigIndex = {};
                  this.choices.forEach((list, slug) => {
                      index[slug] = list[0].index[slug];
                  });
                  return index;
              });
    }

    /** One set's manifest; null when it is missing, malformed, or not the version its folder names (v2 then falls back to v1). */
    private async readSet(base: string): Promise<RigSet | null> {
        try {
            const response = await fetch(`${base}/manifest.json`, {signal: this.abort.signal});
            if (!response.ok) return null;
            const set = decodeRigSet(await response.json(), rigSetVersion(base));
            return set ? {...set, base} : null;
        } catch {
            return null;
        }
    }

    ready(): Promise<RigIndex | null> {
        return this.manifestReady;
    }

    /** The sets read (folder, version, flight, how many species), for the debug overlay and tests. */
    get setSummary(): {base: string; version: number; flight: boolean; species: number}[] {
        return this.sets.map((set) => ({base: set.base, version: set.version, flight: set.flight, species: Object.keys(set.index).length}));
    }

    /**
     * Whether this species' rig may fly (and so is worth drawing in the air): a loaded rig that flies, or, before
     * it loads, a species whose first set publishes flight.
     */
    mayFly(slug: string): boolean {
        const model = this.models.get(slug);
        if (model) return rigFlies(model);
        return !this.failed.has(slug) && Boolean(this.choices?.get(slug)?.[0]?.flight);
    }

    /** Whether its rig walks (a walk, run, hop, slither or climb): before it loads, assumed; a sitting rig with only its idle does not. */
    walks(slug: string): boolean {
        const model = this.models.get(slug);
        if (!model) return true;
        return ["walk", "run", "hop", "slither", "climb"].some((name) => Boolean(model.clips[name]));
    }

    /** Whether a set lists a rig for this species (one that has not failed to load from every set). */
    available(slug: string): boolean {
        return !this.failed.has(slug) && Boolean(this.choices?.get(slug)?.length);
    }

    /** A loaded rig's clip (only clips that passed `rigClip`'s rule are kept at load). */
    clip(slug: string, name: string): RigClipData | null {
        return this.models.get(slug)?.clips[name] ?? null;
    }

    get(slug: string): RigModel | undefined {
        return this.models.get(slug);
    }

    get loadedCount(): number {
        return this.models.size;
    }

    get bytes(): number {
        return this.downloaded;
    }

    get busy(): boolean {
        return this.active > 0 || this.queue.length > 0;
    }

    /** Ask for a species' rig (once; within the session's caps). */
    request(slug: string) {
        if (this.disposed || this.models.has(slug) || this.queued.has(slug) || this.failed.has(slug)) return;
        if (!this.available(slug)) return;
        if (this.loadedSpecies >= this.caps.species || this.downloaded >= this.caps.bytes) return;
        this.queued.add(slug);
        this.queue.push(slug);
        this.pump();
    }

    /** Let go of rigs not drawn since `before` (seconds), keeping at most `keep`. */
    evict(before: number, keep: number) {
        if (this.models.size <= keep) return;
        const old = Array.from(this.models.values()).filter((model) => model.usedAt < before).sort((a, b) => a.usedAt - b.usedAt);
        for (const model of old) {
            if (this.models.size <= keep) break;
            this.models.delete(model.slug);
            this.queued.delete(model.slug);
            model.geometry.dispose();
            model.texture.dispose();
            this.onEvict(model.slug);
        }
    }

    onEvict: (slug: string) => void = () => undefined;

    private pump() {
        if (!this.choices || this.disposed) return;
        while (this.active < this.concurrency && this.queue.length) {
            const slug = this.queue.shift()!;
            if (this.downloaded >= this.caps.bytes) {
                this.queued.delete(slug);
                continue;
            }
            this.active++;
            this.loadedSpecies++;
            this.load(slug)
                .catch((error) => {
                    if (this.disposed) return;
                    this.failed.add(slug);
                    console.warn(`[ark] rig ${slug}`, error instanceof Error ? error.message : error);
                })
                .finally(() => {
                    this.active--;
                    this.pump();
                });
        }
    }

    /** From the first set that lists it; a file that fails falls back to the next set's (v2 → v1). */
    private async load(slug: string) {
        const sets = this.choices?.get(slug) ?? [];
        if (!sets.length) throw new Error("not listed");
        let last: unknown = null;
        for (const set of sets) {
            if (this.disposed) return;
            try {
                await this.loadFrom(set, slug);
                return;
            } catch (error) {
                last = error;
            }
        }
        throw last instanceof Error ? last : new Error(String(last));
    }

    private async loadFrom(set: RigSet, slug: string) {
        const version = set.index[slug];
        if (!version) throw new Error("not listed");
        const url = `${set.base}/${encodeURIComponent(slug)}/${encodeURIComponent(version)}.rig.glb`;
        const response = await fetch(url, {signal: this.abort.signal});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        this.downloaded += buffer.byteLength;
        if (this.disposed) return;
        const gltf = await this.loader.parseAsync(buffer, "");
        const extras = (gltf.parser.json as {extras?: {ark_rig?: RigExtras}}).extras?.ark_rig;
        if (!extras || !Number.isInteger(extras.bufferView) || !Array.isArray(extras.bones) || !extras.bones.length) throw new Error("no bones");
        const entry = decodeRigEntry(extras.rig);
        // The set's flight switch and the file's own entry: `rigClip`'s rule, per file.
        const own = entry ? {flight: set.flight, species: {[slug]: entry}} : null;
        if (!entry || !rigPlayable(own, slug)) throw new Error("no playable clip");
        const view = (await gltf.parser.getDependency("bufferView", extras.bufferView)) as ArrayBuffer;
        const boneCount = extras.bones.length;
        const rows = extras.rows;
        if (view.byteLength !== rows * boneCount * 12 * 2) throw new Error("bone data size");
        let skinned: SkinnedMesh | null = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((object) => {
            if (!skinned && (object as SkinnedMesh).isSkinnedMesh) skinned = object as SkinnedMesh;
        });
        const mesh = skinned as SkinnedMesh | null;
        if (!mesh) throw new Error("no skinned mesh");
        const grips = gripBones(mesh, extras.bones);
        const geometry = restGeometry(mesh, extras.bones);
        const restPivot = (name: string): [number, number, number] | null => {
            const bone = (mesh.skeleton.bones as Bone[]).find((b) => b.name === name);
            if (!bone) return null;
            const at = new Vector3().setFromMatrixPosition(bone.matrixWorld);
            return [at.x, at.y, at.z];
        };
        const look = rigLookChain(entry, slug, extras.bones, restPivot);
        const material = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        material.forEach((m) => m.dispose());
        mesh.geometry.dispose();
        const data = new Uint16Array(view.slice(0));
        const texture = new DataTexture(data, boneCount * 3, rows, RGBAFormat, HalfFloatType);
        texture.minFilter = NearestFilter;
        texture.magFilter = NearestFilter;
        texture.generateMipmaps = false;
        texture.flipY = false;
        texture.needsUpdate = true;
        const clips: Record<string, RigClipData> = {};
        const listed = entry.clips && !Array.isArray(entry.clips) ? entry.clips : {};
        for (const [name, clip] of Object.entries(listed)) {
            if (!rigClip(own, slug, name)) continue;
            const row = Number(clip.row);
            const clipRows = Number(clip.rows);
            if (!Number.isInteger(row) || !Number.isInteger(clipRows) || clipRows < 2 || row < 0 || row + clipRows > rows) continue;
            clips[name] = withCycleSpeed({...clip, name, row, rows: clipRows}, Number(entry.version) || 1);
        }
        if (!Object.keys(clips).length) {
            geometry.dispose();
            texture.dispose();
            throw new Error("no playable clip");
        }
        if (this.disposed) {
            geometry.dispose();
            texture.dispose();
            return;
        }
        const centre = geometry.boundingBox!.getCenter(new Vector3());
        const flight = flightApproved(own, slug) && Object.keys(clips).some((name) => FLIGHT_CLIPS.has(name));
        this.models.set(slug, {
            slug,
            geometry,
            texture,
            bones: boneCount,
            clips,
            facingDeg: Number(entry.facing_deg) || 0,
            bytes: buffer.byteLength,
            data,
            centre,
            set: set.version,
            entryVersion: Number(entry.version) || 1,
            plan: typeof entry.plan === "string" ? entry.plan : null,
            flight,
            flightOpen: entry.flight_fallback_open === true,
            look,
            grips,
            usedAt: 0
        });
        this.onLoad(slug);
    }

    dispose() {
        this.disposed = true;
        this.abort.abort();
        this.models.forEach((model) => {
            model.geometry.dispose();
            model.texture.dispose();
        });
        this.models.clear();
    }
}

/**
 * The skinned mesh in its rest pose, in the model's space (what the bone
 * matrices start from), as a plain geometry with float positions and
 * normals, the uv, and the skin renumbered to the texture's bones.
 */
function restGeometry(mesh: SkinnedMesh, boneNames: string[]): BufferGeometry {
    const source = mesh.geometry;
    const position = source.getAttribute("position");
    const normal = source.getAttribute("normal");
    const uv = source.getAttribute("uv");
    const skinIndex = source.getAttribute("skinIndex");
    const skinWeight = source.getAttribute("skinWeight");
    if (!position || !skinIndex || !skinWeight) throw new Error("no skin");
    const count = position.count;
    const bones = mesh.skeleton.bones as Bone[];
    // A joint that is not one of the texture's bones (the rig's root) carries no weight: bone 0.
    const remap = bones.map((bone) => Math.max(boneNames.indexOf(bone.name), 0));
    const jointMatrices = bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, mesh.skeleton.boneInverses[i]));
    const toWorld = new Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
    const blended = new Matrix4();
    const weighted = new Matrix4();
    const normalMatrix = new Matrix3();
    const v = new Vector3();
    const n = new Vector3();
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const joints = new Uint8Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
        blended.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        let total = 0;
        for (let k = 0; k < 4; k++) {
            const w = skinWeight.getComponent(i, k);
            const j = skinIndex.getComponent(i, k);
            joints[i * 4 + k] = remap[j] ?? 0;
            weights[i * 4 + k] = w;
            total += w;
            if (w <= 0 || !jointMatrices[j]) continue;
            weighted.copy(jointMatrices[j]);
            const e = weighted.elements;
            const out = blended.elements;
            for (let m = 0; m < 16; m++) out[m] += e[m] * w;
        }
        if (total > 0 && Math.abs(total - 1) > 1e-3) {
            for (let k = 0; k < 4; k++) weights[i * 4 + k] /= total;
            const out = blended.elements;
            for (let m = 0; m < 16; m++) out[m] /= total;
        }
        if (total <= 0) blended.identity();
        blended.premultiply(toWorld).multiply(mesh.bindMatrix);
        v.fromBufferAttribute(position, i).applyMatrix4(blended);
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
        if (normal) {
            normalMatrix.getNormalMatrix(blended);
            n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
            normals[i * 3] = n.x;
            normals[i * 3 + 1] = n.y;
            normals[i * 3 + 2] = n.z;
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    if (normal) geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    if (uv) {
        const uvs = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
            uvs[i * 2] = uv.getX(i);
            uvs[i * 2 + 1] = uv.getY(i);
        }
        geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    }
    geometry.setAttribute("arkJoints", new BufferAttribute(joints, 4));
    geometry.setAttribute("arkWeights", new BufferAttribute(weights, 4));
    const index = source.getIndex();
    if (index) geometry.setIndex(new BufferAttribute(index.array.slice(0), 1));
    if (!normal) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

// MARK: Playing

/** One clip playing on an animal: its name and where in its cycle (0…1, or 0…1 once through for a one-shot). */
export type RigPlay = {name: string; phase: number};

/** What an animal's rig is doing: the clip now, the one it is leaving (fading out), and how far it has faded. */
export type RigState = {
    weight: number;
    now: RigPlay;
    from: RigPlay | null;
    fade: number;
    last: Vector3 | null;
    /** In the air on its rig (from its take-off until its landing has played). */
    flying: boolean;
    /** Its path's climb angle (radians, + up) and turn rate (radians a second, + left), eased; its last heading. */
    climb: number;
    turn: number;
    yaw: number | null;
    /** When (the scene's clock, seconds) its last landing ended: no take-off on the tail of the same flight. */
    landedAt: number;
    /**
     * Its pace (model units a second) for choosing a clip, eased: a path that moves in steps (the reactive layer's
     * offset on alternate frames) never flips walk and graze, or walk and run, frame by frame.
     */
    pace: number;
    /** A clip played by distance: how fast it moves against the clip's own ground speed (1: its natural pace). 0 otherwise. */
    ratio: number;
    /** Moving backwards (backing off, a step back): its walk plays in reverse. */
    reverse: boolean;
};

export const RIG_FADE_SECONDS = 0.25;

export function newRigState(): RigState {
    return {weight: 0, now: {name: "idle", phase: 0}, from: null, fade: 1, last: null, flying: false, climb: 0, turn: 0, yaw: null, landedAt: -1e9, pace: 0, ratio: 0, reverse: false};
}

/** Switch to a clip (a cross-fade from the one playing). */
export function rigSwitch(state: RigState, name: string, phase = 0) {
    if (state.now.name === name) return;
    state.from = {...state.now};
    state.now = {name, phase};
    state.fade = 0;
}

/**
 * The ground clip for a pace (model units a second): the slowest whose own pace covers it within 1.5 times (a walk
 * while it walks, a run or a hop when it goes faster), else the fastest it has; the one playing keeps a little
 * margin (1.7 times) so it doesn't flip at the edge. Played by the distance covered, its feet stay planted.
 */
export function paceClip(speed: number, clips: readonly RigClipData[], current?: string | null): RigClipData | null {
    const usable = clips.filter((c) => (c.ground_speed ?? 0) > 0).sort((a, b) => a.ground_speed! - b.ground_speed!);
    if (!usable.length) return null;
    return usable.find((c) => speed <= c.ground_speed! * (c.name === current ? 1.7 : 1.5)) ?? usable[usable.length - 1];
}

/**
 * Every visible animal's gait, rigged or not: where it was drawn, how far through its step cycle (by the distance it
 * covers: a cycle, two steps, every 0.6 body lengths), and its pace (m/s, eased over about 0.3 s so a stepped path
 * reads as one pace). It picks which movers get a rig from the island view, and gives every mover without one a
 * cheap gait (`gaitPose`), so nothing slides along still.
 */
export type Gait = {x: number; z: number; phase: number; speed: number};

export function stepGait(gait: Gait | null | undefined, x: number, z: number, dt: number, length: number): Gait {
    if (!gait) return {x, z, phase: 0, speed: 0};
    const moved = Math.hypot(x - gait.x, z - gait.z);
    // A jump (a new spot, an act's cut) is no step.
    const step = moved > Math.max(length * 4, 2) ? 0 : moved;
    gait.phase = (gait.phase + step / Math.max(0.6 * length, 0.02)) % 1000;
    if (dt > 0) gait.speed += (step / dt - gait.speed) * Math.min(dt * 3.5, 1);
    gait.x = x;
    gait.z = z;
    return gait;
}

/** Whether it moves now at a walk or more (not a shuffle in place): a fifth of its body length a second. */
export function gaitMoving(gait: Gait | null | undefined, length: number): boolean {
    return Boolean(gait && gait.speed > 0.2 * Math.max(length, 0.05));
}

/**
 * The cheap gait of a mover with no rig: the body bobs up at every step and rocks a little side to side and fore and
 * aft with its steps, as much as it moves (none standing, full from about half a body length a second).
 */
export function gaitPose(gait: Gait, length: number, height: number): {weight: number; bob: number; roll: number; pitch: number} {
    const weight = Math.min(Math.max((gait.speed / Math.max(length, 0.05) - 0.1) / 0.4, 0), 1);
    if (weight <= 0) return {weight: 0, bob: 0, roll: 0, pitch: 0};
    const a = Math.PI * 2 * gait.phase;
    return {
        weight,
        bob: weight * 0.035 * height * Math.abs(Math.sin(a)),
        roll: weight * 0.045 * Math.sin(a),
        pitch: weight * 0.025 * Math.sin(2 * a)
    };
}

/**
 * Which way its moving clip plays: backwards while the body moves back along its facing (more than half of the step
 * against the way it faces: backing off from a threat or the camera, a step back), forwards again once the step is
 * more forward than not. Sideways steps keep the clip forwards. A walk played forwards while the body goes back is
 * the "going backwards" moonwalk.
 */
export function stepReverses(was: boolean, dx: number, dz: number, yaw: number): boolean {
    const flat = Math.hypot(dx, dz);
    if (flat < 1e-6) return was;
    const forward = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / flat;
    return was ? forward < 0.2 : forward < -0.5;
}

/**
 * A clip's ground speed as the scene uses it: the speed the body moves for its feet to stay planted, so that
 * `ground_speed × seconds` is the distance a full cycle covers (`cyclesFor`).
 *
 * A v2 file already says so (contract section 3.2: `stride` = sweep / duty). A v1 file's `ground_speed` is the
 * stance sweep a second (`stride` = the sweep), which understates the body's speed by 1 / duty (contract section 6):
 * played by it, a walk's legs cycle 1.6 times too fast and a run's 2.6 times, and the feet slide (the owner's
 * "walking animations seem weird" and the moonwalk "going backwards"). So a v1 moving clip's speed is divided by
 * its duty (its own `duty`, else the contract's: walk 0.62, run 0.38, climb 0.72).
 */
export function withCycleSpeed<T extends RigClip>(clip: T & {name: string}, entryVersion: number): T & {name: string} {
    if (entryVersion >= 2 || !clip.ground_speed) return clip;
    const stated = Number((clip as {duty?: number}).duty);
    const duty = stated > 0.05 && stated < 1 ? stated : V1_DUTY[clip.name];
    if (!duty) return clip;
    return {...clip, ground_speed: clip.ground_speed / duty};
}
const V1_DUTY: Record<string, number> = {walk: 0.62, run: 0.38, climb: 0.72};

/**
 * The texture rows of a clip at a phase, for the shader: the frame's row,
 * the next row, and how far between. Looping clips wrap (their last row is
 * their first frame again); a one-shot holds its last frame.
 */
export function clipRows(clip: RigClipData, phase: number): [number, number, number] {
    const frames = clip.rows - 1;
    const p = clip.loop ? ((phase % 1) + 1) % 1 : Math.min(Math.max(phase, 0), 1);
    const at = p * frames;
    const f0 = Math.min(Math.floor(at), frames);
    const f1 = Math.min(f0 + 1, frames);
    return [clip.row + f0, clip.row + f1, at - f0];
}

/**
 * How far through its cycle a clip moves for a distance walked (model
 * units): the feet stay planted when the root moves at the clip's own
 * ground speed, whatever the pace.
 */
export function cyclesFor(clip: RigClip, distance: number): number {
    const perCycle = (clip.ground_speed ?? 0) * clip.seconds;
    return perCycle > 1e-6 ? distance / perCycle : 0;
}

/**
 * How far a clip's own root motion has carried the body's middle from where
 * it stood (model units), at a phase: the first bone's matrix applied to the
 * rest mesh's middle. A leap carries its body forward in the clip; the scene
 * already moves it along its path, so it takes this off.
 */
export function rootOffset(model: RigModel, clip: RigClipData, phase: number, out: Vector3, fromRest = false): Vector3 {
    const [r0, r1, t] = clipRows(clip, phase);
    const c = model.centre;
    const at = (row: number, axis: number) => {
        const base = row * model.bones * 12 + axis * 4;
        const d = model.data;
        return halfToFloat(d[base]) * c.x + halfToFloat(d[base + 1]) * c.y + halfToFloat(d[base + 2]) * c.z + halfToFloat(d[base + 3]);
    };
    const first = clip.row;
    for (let axis = 0; axis < 3; axis++) {
        const value = at(r0, axis) * (1 - t) + at(r1, axis) * t;
        // From where the clip began (its first frame), so a clip that starts in place adds nothing then; or from the
        // rest pose (a landing or a climb out of the water ends there, it does not start there).
        const start = fromRest ? (axis === 0 ? c.x : axis === 1 ? c.y : c.z) : at(first, axis);
        if (axis === 0) out.x = value - start;
        else if (axis === 1) out.y = value - start;
        else out.z = value - start;
    }
    return out;
}

/**
 * Clips whose own root motion the scene's path already makes: take-off and
 * landing rise and come down on the path, and the bank's way into and out
 * of the water goes where the schedule (and the depth band) puts it. The
 * scene takes the clip's body offset from the rest pose off, so the body
 * keeps to its path while the clip moves its legs, wings and back.
 */
export const PATH_CARRIED_CLIPS: ReadonlySet<string> = new Set(["takeoff", "land", "enter_water", "exit_water"]);

/** Whether a loaded rig flies: its flight is approved and it has a flap or an open-wing clip to fly with. */
export function rigFlies(model: Pick<RigModel, "flight" | "clips">): boolean {
    return model.flight && (Boolean(model.clips.flap) || OPEN_WING_CLIPS.some((name) => Boolean(model.clips[name])) || Boolean(model.clips.takeoff));
}

/**
 * The last resort for open wings (contract `flight_fallback_open`): a rig with no flap and no open-wing loop holds its
 * take-off's last frame, wings spread (the scene's path carries the body; `PATH_CARRIED_CLIPS`).
 */
export const OPEN_WINGS_HOLD = "takeoff";

// MARK: Choosing clips

/** Open-wing flight clips, in the order a flyer with no playable flap holds one (contract: `flight_fallback_open`). */
export const OPEN_WING_CLIPS = ["glide", "soar", "bank_l", "bank_r", "hover"] as const;

export type FlightClipInput = {
    /** Whether the rig has a playable clip of that name. */
    has: (name: string) => boolean;
    /** The clip playing now (for hysteresis: no flicker between flap and glide on a level path). */
    current?: string | null;
    /** The path's climb angle (radians; + up, − down). */
    climb: number;
    /** How fast it turns (radians a second; + toward its left, +x: a left turn). */
    turn: number;
    /** Its ground speed in body lengths a second. */
    speed: number;
    /** The schedule's beat in the air ("glide" on a long glide leg), when it is on the schedule. */
    beat?: string | null;
    /** Soaring (the schedule's "soar", a raptor circling a thermal). */
    soaring?: boolean;
    /** The shared clock (seconds) and the animal's own seed in [0, 1): flap and glide take turns, the same for every viewer. */
    clock: number;
    seed: number;
    /** The species' share of the time spent gliding (the glide clip's `glide_share`; 0.3 when absent). */
    glideShare?: number;
    /** No playable flap (`flight_fallback_open`): an open-wing clip is held. */
    open?: boolean;
};

/**
 * A flyer's clip in the air (contract section 4): it flaps to climb, glides
 * down, banks into a turn (`bank_l` turning left, `bank_r` right), soars on
 * a soaring leg, hovers when it hangs still (hummingbirds, kestrels), and on
 * a level path flaps and glides by turns in the species' own share. A flyer
 * with no playable flap holds an open-wing clip (never the closed rest
 * pose). Null: no flight clip at all (the procedural flight).
 */
export function flightClip(input: FlightClipInput): string | null {
    const {has} = input;
    const current = input.current ?? null;
    if (input.open || !has("flap")) {
        if (input.soaring && has("soar")) return "soar";
        return OPEN_WING_CLIPS.find((name) => has(name)) ?? (has(OPEN_WINGS_HOLD) ? OPEN_WINGS_HOLD : null);
    }
    // Hanging still in the air (a hummingbird at a flower, a kestrel over a field).
    if (has("hover") && input.speed < (current === "hover" ? 0.4 : 0.25)) return "hover";
    // Climbing: wing beats.
    if (input.climb > (current === "flap" ? 0.04 : 0.08)) return "flap";
    const left = input.turn > 0;
    const turning = Math.abs(input.turn) > (current === "bank_l" || current === "bank_r" ? 0.08 : 0.12);
    const bank = turning ? (left ? "bank_l" : "bank_r") : null;
    if (input.soaring && has("soar")) return bank && has(bank) && Math.abs(input.turn) > 0.5 ? bank : "soar";
    const share = Math.min(Math.max(input.glideShare ?? 0.3, 0), 1);
    // Flap and glide by turns over a 7 s cycle, offset per animal: the same at the same moment for every viewer.
    const cycle = (((input.clock / 7 + input.seed) % 1) + 1) % 1;
    const gliding = input.beat === "glide" || input.climb < -0.1 || cycle < share;
    if (gliding && (has("glide") || (bank && has(bank)))) return bank && has(bank) ? bank : "glide";
    return "flap";
}

/**
 * The behaviour recipes' named states (`behaviour-blocks.ts` ARK_RECIPE_STATES; docs/ark/behaviour-recipes.md) that
 * a rig clip expresses: the clips to try in order, and how they play (by the distance covered, as a loop, or once
 * from the start). The table of what is mapped and what falls back is in docs/ark/rig-player.md.
 */
export type RecipeClipRule = {clips: readonly string[]; play: "distance" | "loop" | "once"};
export const RECIPE_CLIPS: Readonly<Record<string, RecipeClipRule>> = {
    walk: {clips: ["walk", "slither", "hop"], play: "distance"},
    run: {clips: ["run", "walk"], play: "distance"},
    stalk: {clips: ["walk"], play: "distance"},
    crawl: {clips: ["walk", "slither"], play: "distance"},
    wade: {clips: ["walk"], play: "distance"},
    carry: {clips: ["walk"], play: "distance"},
    push: {clips: ["walk"], play: "distance"},
    charge: {clips: ["run", "walk"], play: "distance"},
    clash: {clips: ["run", "walk"], play: "distance"},
    climb: {clips: ["climb"], play: "distance"},
    swim: {clips: ["swim", "slither"], play: "loop"},
    leap: {clips: ["leap"], play: "once"},
    fly: {clips: ["flap", "glide"], play: "loop"},
    glide: {clips: ["glide", "soar"], play: "loop"},
    hover: {clips: ["hover"], play: "loop"},
    takeoff: {clips: ["takeoff"], play: "once"},
    land: {clips: ["land"], play: "once"},
    slide: {clips: ["enter_water"], play: "once"},
    slip_in: {clips: ["enter_water"], play: "once"},
    dive_in: {clips: ["enter_water"], play: "once"},
    launch: {clips: ["enter_water"], play: "once"},
    haul_out: {clips: ["exit_water"], play: "once"},
    hop_out: {clips: ["exit_water"], play: "once"},
    surface: {clips: ["surface"], play: "once"},
    scan: {clips: ["scan"], play: "loop"},
    peck: {clips: ["graze"], play: "loop"},
    eat: {clips: ["graze"], play: "loop"},
    pick_up: {clips: ["graze"], play: "loop"},
    place: {clips: ["graze"], play: "loop"},
    perch: {clips: ["perch"], play: "loop"},
    shake: {clips: ["shake_off"], play: "once"},
    bathe: {clips: ["shake_off"], play: "once"}
};

/**
 * The states no clip expresses yet, and the block's fallback beat each plays meanwhile (`beatClip`: bite, chew, peck
 * and drink graze; scan scans; the rest keep the idle or the scene's own motion). The rigging lane's list of clips
 * that would add the most.
 */
export const RECIPE_FALLBACK: Readonly<Record<string, string>> = {
    crouch: "pause",
    strike: "bite",
    swipe: "bite",
    scoop: "bite",
    sweep: "peck",
    upend: "bite",
    probe: "peck",
    pull: "bite",
    drum: "peck",
    beat_prey: "bite",
    dig: "peck",
    tool: "bite",
    display: "scan",
    pushup: "scan",
    dance: "play",
    call: "scan",
    fight: "play",
    rear: "play",
    box: "play",
    mark: "peck",
    groom: "preen",
    groom_other: "preen",
    bury: "rest",
    roll: "rest",
    dust_bathe: "rest",
    wallow: "rest",
    bask: "rest",
    wing_dry: "preen",
    stretch: "rest",
    yawn: "rest",
    float_back: "rest",
    sleep: "sleep",
    freeze: "pause",
    rest: "rest",
    incubate: "rest",
    plunge: "glide",
    strike_feet: "glide",
    dive: "swim"
};

/** A recipe state's clip on this rig (the first of its rule's clips it has), or null: the block's beat plays (`beatClip`). */
export function recipeClip(state: string | null | undefined, has: (name: string) => boolean): {name: string; play: RecipeClipRule["play"]} | null {
    const rule = state ? RECIPE_CLIPS[state] : undefined;
    if (!rule) return null;
    const name = rule.clips.find((clip) => has(clip));
    return name ? {name, play: rule.play} : null;
}

/**
 * The clip for the reactive layer's action (`reactive.ts`; intelligence-review-30 section 6), on its own feet on
 * land: a flee runs (a walk without a run; a walk too while it is still slow), played by the distance it covers;
 * a sentinel stands up and scans (its idle, upright, without a scan); withdrawn or frozen, its idle (the reactive
 * crouch lowers the body). Null: the action has no clip of its own.
 */
export function reactiveClip(action: string | null | undefined, has: (name: string) => boolean, fast: boolean): {name: string; byDistance: boolean} | null {
    switch (action) {
        case "flee": {
            const walk = has("walk") ? "walk" : has("slither") ? "slither" : has("hop") ? "hop" : null;
            const name = has("run") && (fast || !walk) ? "run" : walk;
            return name ? {name, byDistance: true} : null;
        }
        case "sentinel":
            return has("scan") ? {name: "scan", byDistance: false} : has("idle") ? {name: "idle", byDistance: false} : null;
        case "withdraw":
        case "freeze":
            return has("idle") ? {name: "idle", byDistance: false} : null;
        default:
            return null;
    }
}

/**
 * The clip for the schedule's beat while it stays somewhere (contract
 * section 4; `behaviour-schedule.ts`): bite and chew graze (browse while it
 * browses), a peck or a drink takes the head down too, a scan looks round,
 * a shake shakes the water off, and the bank's way in and out of the water
 * its enter and exit. Null: the beat has no clip of its own (the scene's
 * walk, run, idle).
 */
export function beatClip(beat: string | null | undefined, doing: string | null | undefined, has: (name: string) => boolean): string | null {
    switch (beat) {
        case "bite":
        case "chew":
            // Head up to leaves while it browses, down to the ground otherwise: never the one for the other.
            if (doing === "browse") return has("browse") ? "browse" : null;
            return has("graze") ? "graze" : null;
        case "peck":
        case "drink":
            return has("graze") ? "graze" : null;
        case "scan":
            return has("scan") ? "scan" : null;
        case "shake":
            return has("shake_off") ? "shake_off" : null;
        case "enter_water":
            return has("enter_water") ? "enter_water" : null;
        case "exit_water":
            return has("exit_water") ? "exit_water" : null;
        default:
            return null;
    }
}
