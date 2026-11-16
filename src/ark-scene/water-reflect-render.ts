/**
 * p3 (reflect): draws the animals' reflections in still water (the rule: `water-reflect.ts`; the shader:
 * `water-reflect-shader.ts`).
 *
 * Per species mesh with an animal to reflect this frame (its near, rigged or far instanced mesh), two small instanced
 * meshes draw the SAME geometry (its vertex buffers shared, nothing uploaded again) with the animal material's
 * reflection variant: a depth pass then the colour, both after the water (the water is see-through and writes no
 * depth). Each frame the chosen instances' matrices and per-instance attributes (phase, sleep, look, rig clip rows,
 * coat, variation: all of them, by name) are copied into their own few slots, so a reflection has its animal's pose
 * and its clip's frame exactly. No render target, no second scene pass; a few hundred bytes of instance data per
 * reflected species.
 */

import {BufferGeometry, InstancedBufferAttribute, InstancedMesh, LessEqualDepth, type BufferAttribute, type InterleavedBufferAttribute, type MeshStandardMaterial, type Scene, type Vector3} from "three";
import type {QualityTier} from "@/ark-scene/post";
import {pickReflections, REFLECT_PER_MESH, REFLECT_TIERS, reflectPlane, reflectStrength, stillWaterAt, type ReflectCandidate, type StillWater} from "@/ark-scene/water-reflect";
import {islandWaterNow, type IslandWater} from "@/ark-scene/water-level";
import {reflectUniforms, type ReflectUniforms} from "@/ark-scene/water-reflect-shader";

/** Makes a source mesh's reflection material (its own options with `reflect`); null when it cannot. */
export type ReflectMaterialFor = (source: InstancedMesh, uniforms: ReflectUniforms) => MeshStandardMaterial | null;

type Mirror = {
    id: number;
    source: InstancedMesh;
    geometry: BufferGeometry;
    depth: InstancedMesh;
    colour: InstancedMesh;
    uniforms: ReflectUniforms;
    /** Its own copies of the source's per-instance attributes, by name. */
    copies: Map<string, {from: InstancedBufferAttribute; to: InstancedBufferAttribute}>;
    /** The same copies, as a list (no iterator a frame). */
    list: Array<{from: InstancedBufferAttribute; to: InstancedBufferAttribute}>;
    usedAt: number;
    count: number;
};

/** A reflection unused this long is let go (its materials and its few slots). */
const KEEP_SECONDS = 20;

export class WaterReflections {
    private readonly mirrors = new Map<InstancedMesh, Mirror>();
    private readonly time = {value: 0};
    private tier: QualityTier = "high";
    private lite = false;
    private reduced = false;
    private nextId = 1;
    private readonly pool: ReflectCandidate[] = [];
    private readonly list: ReflectCandidate[] = [];
    private readonly perSource = new Map<number, number>();
    private readonly sources: Mirror[] = [];
    private readonly dropping: Mirror[] = [];
    private readonly water = new Map<number, StillWater | null>();
    private readonly scratch: StillWater = {level: 0, tint: 0};
    private seaLevel = 0;
    private island: IslandWater | null = null;
    /** Reflections drawn on the last frame. */
    drawn = 0;

    constructor(private readonly scene: Scene, private readonly materialFor: ReflectMaterialFor) {}

    setTier(tier: QualityTier, lite: boolean): void {
        this.tier = tier;
        this.lite = lite;
    }

    /** Reduced motion: the ripple holds still. */
    setReducedMotion(reduced: boolean): void {
        this.reduced = reduced;
    }

    /** The still water at a point, cached on a half-metre grid (the harbour's level follows the tide). */
    private stillAt = (x: number, z: number): StillWater | null => {
        const key = (Math.round(x * 2) + 32768) * 65536 + Math.round(z * 2) + 32768;
        let found = this.water.get(key);
        if (found === undefined) {
            const hit = stillWaterAt(x, z, this.seaLevel, this.scratch);
            found = hit ? {level: hit.level, tint: hit.tint} : null;
            if (this.water.size > 8192) this.water.clear();
            this.water.set(key, found);
        }
        if (found && found.tint === 2) found.level = this.seaLevel;
        return found;
    };

    /**
     * This frame: every drawn animal of these meshes near the camera is looked at; the nearest over still water, up to
     * the tier's budget, are reflected. Call after the meshes' instances are written for the frame.
     */
    update(sources: ReadonlyArray<InstancedMesh | null | undefined>, camera: Vector3, seaLevel: number, now: number, clock: number): void {
        this.seaLevel = seaLevel;
        // (Another island in or out: its water answers differently now.)
        const island = islandWaterNow();
        if (island !== this.island) {
            this.island = island;
            this.water.clear();
        }
        if (!this.reduced) this.time.value = clock;
        const budget = this.lite ? (this.tier === "high" ? REFLECT_TIERS.medium : null) : REFLECT_TIERS[this.tier];
        let length = 0;
        this.list.length = 0;
        this.sources.length = 0;
        if (budget) {
            for (let si = 0; si < sources.length; si++) {
                const source = sources[si];
                if (!source || !source.visible || source.count === 0 || !source.parent || (source.layers.mask & 1) === 0) continue;
                const options = (source.material as MeshStandardMaterial).userData?.arkOptions as {minY: number; maxY: number; behaviour?: {extent?: {min?: number[]; max?: number[]}} | null; shell?: boolean} | undefined;
                if (!options || options.shell) continue;
                const e = source.instanceMatrix.array as Float32Array;
                const zExtent = (options.behaviour?.extent?.max?.[2] ?? 0.5) - (options.behaviour?.extent?.min?.[2] ?? -0.5);
                let sourceId = -1;
                for (let i = 0; i < source.count; i++) {
                    const at = i * 16;
                    const tx = e[at + 12];
                    const ty = e[at + 13];
                    const tz = e[at + 14];
                    const distance = Math.hypot(tx - camera.x, ty - camera.y, tz - camera.z);
                    if (distance >= budget.within) continue;
                    const yy = e[at + 5];
                    if (Math.abs(yy) < 1e-5 && Math.abs(e[at + 4]) < 1e-5 && Math.abs(e[at + 6]) < 1e-5) continue;
                    const a = ty + options.minY * yy;
                    const b = ty + options.maxY * yy;
                    const fl = Math.hypot(e[at + 8], e[at + 10]);
                    const fx = fl > 1e-6 ? e[at + 8] / fl : 0;
                    const fz = fl > 1e-6 ? e[at + 10] / fl : 1;
                    const reach = Math.max(zExtent * Math.hypot(e[at + 8], e[at + 9], e[at + 10]) * 0.5, 0.15);
                    const water = reflectPlane(tx, tz, fx, fz, reach, this.stillAt);
                    if (!water) continue;
                    const strength = reflectStrength(Math.min(a, b), Math.max(a, b), water.level, distance, budget.within);
                    if (strength <= 0.01) continue;
                    if (sourceId < 0) {
                        sourceId = this.sources.length;
                        this.sources.push(this.mirrorFor(source, now));
                    }
                    const c = this.pool[length] ?? (this.pool[length] = {source: 0, index: 0, distance: 0, level: 0, tint: 0, strength: 0});
                    c.source = sourceId;
                    c.index = i;
                    c.distance = distance;
                    c.level = water.level;
                    c.tint = water.tint;
                    c.strength = strength;
                    this.list.push(c);
                    length++;
                }
            }
        }
        const kept = length ? pickReflections(this.list, length, budget!.count, this.perSource) : 0;
        this.mirrors.forEach((mirror) => (mirror.count = 0));
        for (let k = 0; k < kept; k++) {
            const c = this.list[k];
            const mirror = this.sources[c.source];
            if (!this.sync(mirror)) continue;
            const slot = mirror.count++;
            const from = mirror.source.instanceMatrix.array as Float32Array;
            const to = mirror.colour.instanceMatrix.array as Float32Array;
            for (let j = 0; j < 16; j++) to[slot * 16 + j] = from[c.index * 16 + j];
            for (let n = 0; n < mirror.list.length; n++) {
                const copy = mirror.list[n];
                const size = copy.from.itemSize;
                const src = copy.from.array as Float32Array;
                const dst = copy.to.array as Float32Array;
                for (let j = 0; j < size; j++) dst[slot * size + j] = src[c.index * size + j];
            }
            mirror.uniforms.arkReflect.value[slot].set(c.level, c.strength, c.tint, 0);
            mirror.usedAt = now;
        }
        this.drawn = kept;
        this.mirrors.forEach((mirror, source) => {
            const on = mirror.count > 0;
            mirror.depth.visible = on;
            mirror.colour.visible = on;
            mirror.depth.count = mirror.count;
            mirror.colour.count = mirror.count;
            if (on) {
                mirror.colour.instanceMatrix.needsUpdate = true;
                for (let n = 0; n < mirror.list.length; n++) mirror.list[n].to.needsUpdate = true;
            } else if (now - mirror.usedAt > KEEP_SECONDS || !source.parent) {
                this.dropping.push(mirror);
            }
        });
        for (let n = 0; n < this.dropping.length; n++) this.drop(this.dropping[n]);
        this.dropping.length = 0;
    }

    private mirrorFor(source: InstancedMesh, now: number): Mirror {
        let mirror = this.mirrors.get(source);
        if (mirror) return mirror;
        const uniforms = reflectUniforms(this.time);
        const colourMaterial = this.materialFor(source, uniforms);
        const depthMaterial = this.materialFor(source, uniforms);
        const geometry = new BufferGeometry();
        const colour = new InstancedMesh(geometry, colourMaterial ?? undefined, REFLECT_PER_MESH);
        // (The depth pass shares the colour pass's instance matrices: the same buffer.)
        const depth = new InstancedMesh(geometry, depthMaterial ?? undefined, REFLECT_PER_MESH);
        depth.instanceMatrix = colour.instanceMatrix;
        for (const [mesh, material, order] of [[depth, depthMaterial, 3], [colour, colourMaterial, 4]] as const) {
            if (material) {
                material.transparent = true;
                material.depthFunc = LessEqualDepth;
                material.depthWrite = mesh === depth;
                material.colorWrite = mesh !== depth;
            }
            mesh.name = mesh === depth ? "ark:reflection-depth" : "ark:reflection";
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.renderOrder = order;
            mesh.count = 0;
            mesh.visible = false;
            // (Never in the shadow map or the scene's other passes as an animal: it is drawn only after the water.)
            mesh.userData.arkReflection = true;
        }
        mirror = {id: this.nextId++, source, geometry, depth, colour, uniforms, copies: new Map(), list: [], usedAt: now, count: 0};
        if (colourMaterial && depthMaterial) {
            this.scene.add(depth);
            this.scene.add(colour);
        }
        this.mirrors.set(source, mirror);
        return mirror;
    }

    /** The mirror's geometry follows its source's: shared vertex buffers, its own copies of the per-instance ones. */
    private sync(mirror: Mirror): boolean {
        if (!mirror.colour.parent) return false;
        const from = mirror.source.geometry;
        const into = mirror.geometry;
        if (into.index !== from.index) into.setIndex(from.index);
        for (const name in from.attributes) {
            const attribute = from.attributes[name] as BufferAttribute | InterleavedBufferAttribute;
            if ((attribute as InstancedBufferAttribute).isInstancedBufferAttribute) {
                const own = mirror.copies.get(name);
                if (own && own.from === attribute) continue;
                const source = attribute as InstancedBufferAttribute;
                const copy = new InstancedBufferAttribute(new Float32Array(REFLECT_PER_MESH * source.itemSize), source.itemSize);
                mirror.copies.set(name, {from: source, to: copy});
                mirror.list = Array.from(mirror.copies.values());
                into.setAttribute(name, copy);
            } else if (into.attributes[name] !== attribute) {
                into.setAttribute(name, attribute);
            }
        }
        return true;
    }

    private drop(mirror: Mirror): void {
        this.mirrors.delete(mirror.source);
        this.scene.remove(mirror.depth);
        this.scene.remove(mirror.colour);
        // The shared buffers belong to the source: off this geometry before it is disposed (disposing it frees every
        // buffer still on it).
        const geometry = mirror.geometry;
        for (const name of Object.keys(geometry.attributes)) if (!mirror.copies.has(name)) geometry.deleteAttribute(name);
        geometry.setIndex(null);
        geometry.dispose();
        mirror.colour.dispose();
        (mirror.depth.material as MeshStandardMaterial).dispose();
        (mirror.colour.material as MeshStandardMaterial).dispose();
    }

    dispose(): void {
        Array.from(this.mirrors.values()).forEach((mirror) => this.drop(mirror));
    }
}
