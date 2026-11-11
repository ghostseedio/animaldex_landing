/**
 * The props lane's toolkit (docs/ark/props.md): vertex-coloured geometry
 * helpers, the shared materials that answer the weather (wet, frost, snow),
 * and the two kinds of level of detail every prop uses:
 *
 * - `LodBatch`: one prop repeated (scree stones, tussocks, worm casts, nests):
 *   a detailed near mesh and an optional cheap far mesh, both instanced,
 *   refilled from the camera's position only when it has moved, the nearest
 *   first up to the tier's cap.
 * - `LodPiece`: one built place (the garden's extras, the barn's yard, the
 *   cave): its merged near mesh within a radius, an optional far mesh
 *   beyond it, nothing past the far radius.
 *
 * Everything is a pure function of fixed seeds: the same props for every viewer.
 */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DynamicDrawUsage,
    Group,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Quaternion,
    Vector3,
    type Material
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {QualityTier} from "@/ark-scene/post";
import {ARK_GROUND_TEXTURES, GROUND_MEANS} from "@/ark-scene/ground-textures";

// MARK: - Tiers

export type PropsTier = {
    /** Detailed meshes within this many metres of the camera. */
    near: number;
    /** Cheap meshes out to here; nothing beyond. */
    far: number;
    /** A multiplier on every repeated prop's cap. */
    density: number;
    /** Particles (smoke, moths, mist, dew, snow, dust): a multiplier on their counts, 0 = none. */
    particles: number;
    /** Fine things only seen close up: webs and their dew, slime trails, ant trails, worm casts. */
    fine: boolean;
};

export const PROPS_TIERS: Record<QualityTier, PropsTier> = {
    high: {near: 56, far: 240, density: 1, particles: 1, fine: true},
    medium: {near: 36, far: 160, density: 0.55, particles: 0.5, fine: true},
    low: {near: 18, far: 90, density: 0.22, particles: 0, fine: false}
};

// MARK: - Geometry

/** Non-indexed, uv dropped, normals computed, a vertex colour from `colour` times `shade(y, i)`. */
export function paint(geometry: BufferGeometry, colour: Color | string, shade: (y: number, i: number, x: number, z: number) => number = () => 1): BufferGeometry {
    const c = typeof colour === "string" ? new Color(colour) : colour;
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
    if (flat.getAttribute("uv1")) flat.deleteAttribute("uv1");
    flat.computeVertexNormals();
    const position = flat.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        const value = shade(position.getY(i), i, position.getX(i), position.getZ(i));
        colors[i * 3] = c.r * value;
        colors[i * 3 + 1] = c.g * value;
        colors[i * 3 + 2] = c.b * value;
    }
    flat.setAttribute("color", new BufferAttribute(colors, 3));
    return flat;
}

/** Merge painted parts (all non-indexed with position, normal, color). */
export function merge(parts: BufferGeometry[]): BufferGeometry {
    const ready = parts.filter((part) => part.getAttribute("position").count > 0);
    if (!ready.length) return new BufferGeometry();
    return mergeGeometries(ready) ?? new BufferGeometry();
}

/** Move a geometry: turn about y, then translate. */
export function place<T extends BufferGeometry>(geometry: T, x: number, y: number, z: number, turn = 0): T {
    if (turn) geometry.rotateY(turn);
    geometry.translate(x, y, z);
    return geometry;
}

/** Push every vertex out along its direction from the middle by value noise: a lumpy, natural shape. */
export function lumpy<T extends BufferGeometry>(geometry: T, amount: number, random: () => number): T {
    const bumps = Array.from({length: 5}, () => new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize());
    const position = geometry.getAttribute("position");
    const v = new Vector3();
    const dir = new Vector3();
    for (let i = 0; i < position.count; i++) {
        v.set(position.getX(i), position.getY(i), position.getZ(i));
        dir.copy(v).normalize();
        let push = 0;
        for (const bump of bumps) push += Math.max(dir.dot(bump), 0) ** 3;
        v.multiplyScalar(1 + amount * (push - 0.4));
        position.setXYZ(i, v.x, v.y, v.z);
    }
    return geometry;
}

/** Triangles kept only where `keep(centroid)`: cut openings out of a shell. */
export function keepTriangles(geometry: BufferGeometry, keep: (x: number, y: number, z: number) => boolean): BufferGeometry {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = flat.getAttribute("position");
    const kept: number[] = [];
    for (let t = 0; t < position.count; t += 3) {
        const x = (position.getX(t) + position.getX(t + 1) + position.getX(t + 2)) / 3;
        const y = (position.getY(t) + position.getY(t + 1) + position.getY(t + 2)) / 3;
        const z = (position.getZ(t) + position.getZ(t + 1) + position.getZ(t + 2)) / 3;
        if (!keep(x, y, z)) continue;
        for (let k = 0; k < 3; k++) kept.push(position.getX(t + k), position.getY(t + k), position.getZ(t + k));
    }
    const out = new BufferGeometry();
    out.setAttribute("position", new BufferAttribute(new Float32Array(kept), 3));
    return out;
}

export function triangles(geometry: BufferGeometry): number {
    return geometry.index ? geometry.index.count / 3 : geometry.getAttribute("position").count / 3;
}

// MARK: - Materials

/** The props' weather, as their materials read it (`conditions.ts` fills it every frame). */
export const PROPS_WEATHER = {
    wet: {value: 0},
    frost: {value: 0},
    snow: {value: 0}
};

/**
 * A vertex-coloured standard material that darkens and shines when wet,
 * and (the cold one) whitens on its upward faces with frost and lying snow.
 * `texture` lays one of the ground's CC0 photo layers (`ground-textures.ts`:
 * 1 forest floor, 2 soil, 3 sand, 5 rock, 6 mud, 7 snow) over the vertex
 * colour, projected three ways in world space, so the props share the
 * ground's and the rocks' grain (until the textures are in, plain colour).
 */
export function propMaterial(options: {cold?: boolean; roughness?: number; doubleSide?: boolean; flatShading?: boolean; texture?: number; textureScale?: number; textureStrength?: number; /** Drawn to a stage (a growing nest): vertices whose `aBuild` is past the instance's `iStage` collapse away. */ growth?: boolean; /** (cold) Snow always lying on its upward faces, at least this much (0–1): high rock. */ dust?: number} = {}): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: options.roughness ?? 0.9, metalness: 0, flatShading: options.flatShading ?? false});
    if (options.doubleSide) material.side = 2;
    const cold = Boolean(options.cold);
    const layer = options.texture ?? -1;
    const mean = layer >= 0 ? GROUND_MEANS[layer] : [1, 1, 1];
    const growth = Boolean(options.growth);
    material.onBeforeCompile = (shader) => {
        shader.uniforms.propWet = PROPS_WEATHER.wet;
        shader.uniforms.propFrost = PROPS_WEATHER.frost;
        shader.uniforms.propSnow = PROPS_WEATHER.snow;
        shader.uniforms.propAlbedo = ARK_GROUND_TEXTURES.albedo;
        shader.uniforms.propTexReady = ARK_GROUND_TEXTURES.ready;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>\nvarying float vPropUp;\nvarying vec3 vPropWorld;\nvarying vec3 vPropNormal;${growth ? "\nattribute float aBuild;\nattribute float iStage;" : ""}`)
            .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvPropUp = objectNormal.y;")
            .replace("#include <begin_vertex>", growth ? "#include <begin_vertex>\nif (aBuild > iStage + 0.0001) transformed = vec3(0.0);" : "#include <begin_vertex>")
            .replace(
                "#include <project_vertex>",
                `#include <project_vertex>
vec4 propAt = vec4(transformed, 1.0);
vec3 propN = objectNormal;
#ifdef USE_INSTANCING
propAt = instanceMatrix * propAt;
propN = mat3(instanceMatrix) * propN;
#endif
vPropWorld = (modelMatrix * propAt).xyz;
vPropNormal = normalize(mat3(modelMatrix) * propN);`
            );
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vPropUp;\nvarying vec3 vPropWorld;\nvarying vec3 vPropNormal;\nuniform float propWet;\nuniform float propFrost;\nuniform float propSnow;\nuniform highp sampler2DArray propAlbedo;\nuniform float propTexReady;")
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
${layer >= 0 ? `if (propTexReady > 0.5) {
    vec3 pn = normalize(vPropNormal);
    vec3 pk = pow(abs(pn), vec3(4.0));
    pk /= (pk.x + pk.y + pk.z);
    vec3 pw = vPropWorld * ${(options.textureScale ?? 0.6).toFixed(3)};
    vec3 pt = texture(propAlbedo, vec3(pw.zy, ${layer.toFixed(1)})).rgb * pk.x + texture(propAlbedo, vec3(pw.xz, ${layer.toFixed(1)})).rgb * pk.y + texture(propAlbedo, vec3(pw.xy, ${layer.toFixed(1)})).rgb * pk.z;
    vec3 pd = pt / vec3(${mean.map((v) => v.toFixed(4)).join(", ")});
    pd = mix(vec3(dot(pd, vec3(0.3333))), pd, 0.4);
    diffuseColor.rgb *= mix(vec3(1.0), pd, ${(options.textureStrength ?? 0.85).toFixed(2)});
}` : ""}
diffuseColor.rgb *= 1.0 - 0.3 * propWet;
${cold ? `float propWhite = clamp(propFrost * 0.65 * smoothstep(0.1, 0.8, vPropUp) + max(propSnow, ${(options.dust ?? 0).toFixed(3)}) * smoothstep(0.35, 0.8, vPropUp), 0.0, 1.0);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), propWhite);` : ""}`
            )
            .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.22, propWet * 0.85);");
    };
    material.customProgramCacheKey = () => `ark-prop-${cold ? "cold" : "warm"}-${layer}-${options.textureScale ?? 0.6}-${options.textureStrength ?? 0.85}${growth ? "-growth" : ""}${options.dust ? `-dust${options.dust}` : ""}`;
    return material;
}

// MARK: - Level of detail

export type PropInstance = {x: number; y: number; z: number; turn: number; scale: number; /** Scale along y (default `scale`). */ tall?: number; tint?: Color; /** Tilted to lie on a surface: its up. */ up?: Vector3; /** How far built (a growing nest, 0…1; `growth` materials read it). */ stage?: number};

/** The instance's matrix. */
export function instanceMatrix(item: PropInstance, out = new Matrix4()): Matrix4 {
    const quaternion = new Quaternion().setFromAxisAngle(UP, item.turn);
    if (item.up) quaternion.premultiply(new Quaternion().setFromUnitVectors(UP, item.up));
    return out.compose(new Vector3(item.x, item.y, item.z), quaternion, new Vector3(item.scale, item.tall ?? item.scale, item.scale));
}

const UP = new Vector3(0, 1, 0);

/**
 * A prop repeated: near and far instanced meshes refilled from the camera.
 * `cap` is the most drawn near at the high tier (times the tier's density);
 * the far mesh draws up to twice as many, past the near radius.
 */
export class LodBatch {
    readonly near: InstancedMesh;
    readonly far: InstancedMesh | null;
    private readonly matrices: Float32Array;
    private readonly xs: Float32Array;
    private readonly ys: Float32Array;
    private readonly zs: Float32Array;
    private readonly tints: Float32Array | null;
    /** Per instance, how far built (a growing nest): copied to the `iStage` instanced attribute as the batch refills. */
    private readonly stages: Float32Array | null;
    private readonly order: Int32Array;
    private readonly distances: Float32Array;
    private nearCap = 0;
    private farCap = 0;
    private nearRadius = 0;
    private farRadius = 0;
    private enabled = true;
    /** Hidden by the weather or the time (snow drifts without snow, icicles in the warm): drawn nowhere. */
    hidden = false;

    constructor(
        readonly name: string,
        items: PropInstance[],
        nearGeometry: BufferGeometry,
        farGeometry: BufferGeometry | null,
        material: Material,
        private readonly options: {cap: number; /** The near radius times this (a big prop seen further, a small one only close). */ reach?: number; /** Fine detail: none at a tier without `fine`. */ fine?: boolean; shadow?: boolean; farReach?: number}
    ) {
        const count = items.length;
        this.matrices = new Float32Array(count * 16);
        this.xs = new Float32Array(count);
        this.ys = new Float32Array(count);
        this.zs = new Float32Array(count);
        this.tints = items.some((item) => item.tint) ? new Float32Array(count * 3) : null;
        this.stages = items.some((item) => item.stage !== undefined) ? new Float32Array(count).fill(1) : null;
        this.order = new Int32Array(count);
        this.distances = new Float32Array(count);
        const matrix = new Matrix4();
        items.forEach((item, i) => {
            instanceMatrix(item, matrix).toArray(this.matrices, i * 16);
            this.xs[i] = item.x;
            this.ys[i] = item.y;
            this.zs[i] = item.z;
            if (this.stages) this.stages[i] = item.stage ?? 1;
            if (this.tints) {
                const tint = item.tint ?? WHITE;
                this.tints[i * 3] = tint.r;
                this.tints[i * 3 + 1] = tint.g;
                this.tints[i * 3 + 2] = tint.b;
            }
        });
        const nearMax = Math.max(1, Math.min(count, options.cap));
        this.near = new InstancedMesh(nearGeometry, material, nearMax);
        this.near.instanceMatrix.setUsage(DynamicDrawUsage);
        this.near.frustumCulled = false;
        this.near.castShadow = Boolean(options.shadow);
        this.near.receiveShadow = true;
        this.near.count = 0;
        this.near.visible = false;
        this.near.name = `props:${name}:near`;
        this.far = farGeometry ? new InstancedMesh(farGeometry, material, Math.max(1, Math.min(count, options.cap * 2))) : null;
        if (this.far) {
            this.far.instanceMatrix.setUsage(DynamicDrawUsage);
            this.far.frustumCulled = false;
            this.far.receiveShadow = true;
            this.far.count = 0;
            this.far.visible = false;
            this.far.name = `props:${name}:far`;
        }
        if (this.tints) {
            this.near.instanceColor = instancedColors(nearMax);
            if (this.far) this.far.instanceColor = instancedColors(this.far.instanceMatrix.count);
        }
        if (this.stages) {
            nearGeometry.setAttribute("iStage", instancedStages(nearMax));
            if (this.far) farGeometry!.setAttribute("iStage", instancedStages(this.far.instanceMatrix.count));
        }
    }

    /** Set the instances' build stages (in the items' order); drawn from the next `update`. */
    setStages(values: ArrayLike<number>) {
        if (!this.stages) return;
        for (let i = 0; i < this.stages.length && i < values.length; i++) this.stages[i] = Math.min(Math.max(values[i], 0), 1);
    }

    /** The instances' build stages (in the items' order), or null for a batch that does not grow. */
    stageOf(i: number): number | null {
        return this.stages ? this.stages[i] : null;
    }

    get count(): number {
        return this.xs.length;
    }

    /** For a single merged piece drawn at the origin (its geometry already in the world): where to measure its distance from. */
    setCentre(centre: Vector3) {
        if (!this.xs.length) return;
        this.xs[0] = centre.x;
        this.ys[0] = centre.y;
        this.zs[0] = centre.z;
    }

    add(group: Group) {
        group.add(this.near);
        if (this.far) group.add(this.far);
    }

    setTier(tier: PropsTier) {
        this.enabled = !(this.options.fine && !tier.fine);
        const reach = this.options.reach ?? 1;
        this.nearRadius = tier.near * reach;
        this.farRadius = this.far ? tier.far * (this.options.farReach ?? reach) : 0;
        this.nearCap = Math.min(this.near.instanceMatrix.count, Math.max(this.enabled ? 1 : 0, Math.round(this.options.cap * tier.density)));
        this.farCap = this.far ? Math.min(this.far.instanceMatrix.count, this.nearCap * 2) : 0;
    }

    setShadows(on: boolean) {
        this.near.castShadow = on && Boolean(this.options.shadow);
    }

    /** Refill from the camera: the nearest within the near radius up to the cap, then the far ones. */
    update(cx: number, cy: number, cz: number) {
        const count = this.xs.length;
        if (!this.enabled || this.hidden || !count) {
            this.near.count = 0;
            this.near.visible = false;
            if (this.far) {
                this.far.count = 0;
                this.far.visible = false;
            }
            return;
        }
        const farSq = Math.max(this.farRadius, this.nearRadius) ** 2;
        let n = 0;
        for (let i = 0; i < count; i++) {
            const dx = this.xs[i] - cx;
            const dy = this.ys[i] - cy;
            const dz = this.zs[i] - cz;
            const d = dx * dx + dy * dy + dz * dz;
            if (d > farSq) continue;
            this.distances[i] = d;
            this.order[n++] = i;
        }
        const chosen = Array.from(this.order.subarray(0, n));
        if (n > this.nearCap) chosen.sort((a, b) => this.distances[a] - this.distances[b]);
        const nearSq = this.nearRadius ** 2;
        let near = 0;
        let far = 0;
        const nearArray = this.near.instanceMatrix.array as Float32Array;
        const farArray = this.far ? (this.far.instanceMatrix.array as Float32Array) : null;
        const nearStages = this.stages ? (this.near.geometry.getAttribute("iStage") as InstancedBufferAttribute) : null;
        const farStages = this.stages && this.far ? (this.far.geometry.getAttribute("iStage") as InstancedBufferAttribute) : null;
        for (const i of chosen) {
            // A nest not started yet (stage 0) is not drawn at all.
            if (this.stages && this.stages[i] <= 0.001) continue;
            if (this.distances[i] <= nearSq && near < this.nearCap) {
                nearArray.set(this.matrices.subarray(i * 16, i * 16 + 16), near * 16);
                if (this.tints && this.near.instanceColor) (this.near.instanceColor.array as Float32Array).set(this.tints.subarray(i * 3, i * 3 + 3), near * 3);
                if (nearStages && this.stages) (nearStages.array as Float32Array)[near] = this.stages[i];
                near++;
            } else if (farArray && far < this.farCap) {
                farArray.set(this.matrices.subarray(i * 16, i * 16 + 16), far * 16);
                if (this.tints && this.far?.instanceColor) (this.far.instanceColor.array as Float32Array).set(this.tints.subarray(i * 3, i * 3 + 3), far * 3);
                if (farStages && this.stages) (farStages.array as Float32Array)[far] = this.stages[i];
                far++;
            }
        }
        if (nearStages) nearStages.needsUpdate = true;
        if (farStages) farStages.needsUpdate = true;
        this.near.count = near;
        this.near.visible = near > 0;
        this.near.instanceMatrix.needsUpdate = true;
        if (this.near.instanceColor) this.near.instanceColor.needsUpdate = true;
        if (this.far) {
            this.far.count = far;
            this.far.visible = far > 0;
            this.far.instanceMatrix.needsUpdate = true;
            if (this.far.instanceColor) this.far.instanceColor.needsUpdate = true;
        }
    }

    /** What it draws now. */
    drawn(): {near: number; far: number} {
        return {near: this.near.count, far: this.far?.count ?? 0};
    }

    dispose() {
        this.near.geometry.dispose();
        this.far?.geometry.dispose();
        this.near.dispose();
        this.far?.dispose();
    }
}

const WHITE = new Color(1, 1, 1);

function instancedStages(count: number): InstancedBufferAttribute {
    const attribute = new InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
    attribute.setUsage(DynamicDrawUsage);
    return attribute;
}

function instancedColors(count: number): InstancedBufferAttribute {
    const attribute = new InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    attribute.setUsage(DynamicDrawUsage);
    return attribute;
}

/** One built place: its near mesh within `nearRadius` of `centre`, a far one out to `farRadius`. */
export class LodPiece {
    readonly near: Mesh;
    readonly far: Mesh | null;
    private nearRadius = 0;
    private farRadius = 0;

    constructor(
        readonly name: string,
        readonly centre: Vector3,
        nearGeometry: BufferGeometry,
        farGeometry: BufferGeometry | null,
        material: Material,
        private readonly options: {near: number; far: number; shadow?: boolean; fine?: boolean},
        farMaterial?: Material
    ) {
        this.near = new Mesh(nearGeometry, material);
        this.near.castShadow = Boolean(options.shadow);
        this.near.receiveShadow = true;
        this.near.visible = false;
        this.near.name = `props:${name}:near`;
        this.far = farGeometry ? new Mesh(farGeometry, farMaterial ?? material) : null;
        if (this.far) {
            this.far.receiveShadow = true;
            this.far.visible = false;
            this.far.name = `props:${name}:far`;
        }
    }

    add(group: Group) {
        group.add(this.near);
        if (this.far) group.add(this.far);
    }

    /** The radii are the piece's own (m), scaled by the tier against the high tier's. */
    setTier(tier: PropsTier) {
        const scale = tier.near / PROPS_TIERS.high.near;
        const farScale = tier.far / PROPS_TIERS.high.far;
        this.nearRadius = this.options.fine && !tier.fine ? 0 : this.options.near * scale;
        this.farRadius = this.options.far * farScale;
    }

    setShadows(on: boolean) {
        this.near.castShadow = on && Boolean(this.options.shadow);
    }

    update(cx: number, cy: number, cz: number) {
        const d = Math.hypot(this.centre.x - cx, this.centre.y - cy, this.centre.z - cz);
        this.near.visible = d < this.nearRadius;
        if (this.far) this.far.visible = !this.near.visible && d < this.farRadius;
    }

    dispose() {
        this.near.geometry.dispose();
        this.far?.geometry.dispose();
    }
}

// MARK: - Building in slices

/** Run a builder's steps to their end at once. */
export function runSteps<T>(steps: Generator<void, T, void>): T {
    let next = steps.next();
    while (!next.done) next = steps.next();
    return next.value;
}

/**
 * Run a builder's steps a few milliseconds a frame (`sliceMs`, like the sampler's `prepareAttachPoints`), so a big
 * build is no long task. Resolves with what it built, or null when `cancelled()` turned true between slices (a newer
 * build took its place). The result is the same as `runSteps`'s.
 */
export function runSliced<T>(steps: Generator<void, T, void>, sliceMs = 6, cancelled: () => boolean = () => false): Promise<T | null> {
    const later = (run: () => void) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => run()) : setTimeout(run, 0));
    return new Promise((resolve) => {
        const slice = () => {
            if (cancelled()) {
                resolve(null);
                return;
            }
            const until = performance.now() + sliceMs;
            let next = steps.next();
            while (!next.done && performance.now() < until) next = steps.next();
            if (next.done) resolve(next.value);
            else later(slice);
        };
        later(slice);
    });
}
