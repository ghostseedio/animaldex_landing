/**
 * Transparent, double-sided meshes drawn as two meshes (mobile performance lane, docs/ark/perf-audit-mobile-2026-11.md).
 *
 * three.js draws a transparent `DoubleSide` material in two passes, its back faces then its front, and marks the
 * material changed before each, so every such object costs two program look-ups a frame (the parameters and the cache
 * key worked out again: ~0.8 ms a frame and ~4 MB/s of garbage on the phone profile, from the town's zoo glass, cage
 * bars and nets). Here each becomes two meshes that draw exactly the same: the mesh itself with a back-face copy of its
 * material, and a child with a front-face copy, sharing its geometry, its place (the same depth, so the same place in
 * the transparent sort) and drawn right after it (the next id). Only meshes that cast no shadow and have no draw hook of
 * their own; the copies keep the material's shader patch and its program key.
 */

import {BackSide, DoubleSide, FrontSide, Mesh, Object3D, type Material} from "three";

const SPLIT = "arkTwoSided";
const pairs = new WeakMap<Material, {back: Material; front: Material}>();

function copyOf(material: Material, side: typeof BackSide | typeof FrontSide): Material {
    const copy = material.clone();
    copy.onBeforeCompile = material.onBeforeCompile;
    copy.customProgramCacheKey = material.customProgramCacheKey;
    copy.side = side;
    return copy;
}

/** Whether three would draw this mesh in two passes, and it can be split without changing anything else. */
function splittable(object: Object3D): object is Mesh {
    const mesh = object as Mesh;
    if (!mesh.isMesh || (mesh as {isInstancedMesh?: boolean}).isInstancedMesh || mesh.userData[SPLIT]) return false;
    const material = mesh.material;
    if (Array.isArray(material) || !material.transparent || material.side !== DoubleSide || material.forceSinglePass) return false;
    return !mesh.castShadow && mesh.onBeforeRender === Object3D.prototype.onBeforeRender && mesh.onAfterRender === Object3D.prototype.onAfterRender;
}

/** Split every such mesh under `root` not split yet; how many were. */
export function splitTwoSided(root: Object3D): number {
    const found: Mesh[] = [];
    root.traverse((object) => {
        if (splittable(object)) found.push(object);
    });
    for (const mesh of found) {
        const material = mesh.material as Material;
        let pair = pairs.get(material);
        if (!pair) pairs.set(material, (pair = {back: copyOf(material, BackSide), front: copyOf(material, FrontSide)}));
        const front = new Mesh(mesh.geometry, pair.front);
        front.name = `${mesh.name}:front`;
        front.renderOrder = mesh.renderOrder;
        front.receiveShadow = mesh.receiveShadow;
        front.castShadow = false;
        front.frustumCulled = mesh.frustumCulled;
        front.layers.mask = mesh.layers.mask;
        front.userData[SPLIT] = true;
        mesh.userData[SPLIT] = true;
        mesh.material = pair.back;
        mesh.add(front);
    }
    return found.length;
}
