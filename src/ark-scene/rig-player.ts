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
            clips[name] = {...clip, name, row, rows: clipRows};
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
};

export const RIG_FADE_SECONDS = 0.25;

export function newRigState(): RigState {
    return {weight: 0, now: {name: "idle", phase: 0}, from: null, fade: 1, last: null};
}

/** Switch to a clip (a cross-fade from the one playing). */
export function rigSwitch(state: RigState, name: string, phase = 0) {
    if (state.now.name === name) return;
    state.from = {...state.now};
    state.now = {name, phase};
    state.fade = 0;
}

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
export function rootOffset(model: RigModel, clip: RigClipData, phase: number, out: Vector3): Vector3 {
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
        // From where the clip began (its first frame), so a clip that starts in place adds nothing then.
        const start = at(first, axis);
        if (axis === 0) out.x = value - start;
        else if (axis === 1) out.y = value - start;
        else out.z = value - start;
    }
    return out;
}
