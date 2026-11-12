#!/usr/bin/env node
/**
 * The asset trees' crowns as they are drawn (scenery lane, the motion 100x pass): "trees grow inside each other".
 *
 * The manifest's `crown_radius` is the furthest leaf from the trunk (an acacia's one long bough), which says little
 * about where a crown's leaves really are. This script measures each tree's lod0 leaves (the triangles that flutter:
 * COLOR_1 z or w set, as `ark-tree-attach.mjs` tells leaf from wood), weighted by their area:
 *
 *   cx, cz      the middle of the leaf area (an acacia's crown leans off its trunk);
 *   bands       the crown from its lowest leaves (8th percentile of leaf area by height) to its top in five slices,
 *               each [from, to, r]: r holds 85% of that slice's leaf area round the middle (a spruce's cone narrows
 *               to its tip, an oak's dome is widest in the middle);
 *   sectors     how far the crown reaches in eight 45° sectors round the middle (from +x toward +z: atan2(z, x)),
 *               as a share of its overall 85% radius, for crowns that are not round;
 *   top         the tree's highest point;
 *   trunk       the trunk's radius at the foot (the manifest's).
 *
 * Writes `src/ark-scene/tree-footprints.json` (small; bundled with the decor's scatter, `tree-spacing.ts`). Its
 * `source` hash covers every tree's lod0 GLB, so `src/lib/ark-scenery.test.ts` fails when the trees change and this
 * needs running again:
 *
 *   node scripts/ark-tree-footprints.mjs           (re)write tree-footprints.json
 *   node scripts/ark-tree-footprints.mjs --check   exit 1 if it is out of date
 */

import {createHash} from "node:crypto";
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = path.join(root, "node_modules");
const THREE = await import(pathToFileURL(path.join(nm, "three/build/three.module.js")).href);
const {GLTFLoader} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/loaders/GLTFLoader.js")).href);
const {MeshoptDecoder} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/libs/meshopt_decoder.module.js")).href);
const {Vector3, Triangle} = THREE;

/** Bump when the method changes (it is part of the source hash). */
const GENERATOR = 2;
const OUT = path.join(root, "src/ark-scene/tree-footprints.json");
const manifest = JSON.parse(readFileSync(path.join(root, "src/ark-scene/assets-manifest.json"), "utf8"));
const base = path.join(root, "public", manifest.base);

/** Every tree (and bush) with a crown: the asset lane's `trees` and `bush` groups. */
const ids = Object.keys(manifest.assets).filter((id) => {
    const a = manifest.assets[id];
    return (a.group === "trees" || a.set === "trees" || a.group === "bush" || a.set === "bush") && a.lods.some((l) => l.level === "lod0");
}).sort();

function lodFile(id) {
    return path.join(base, manifest.assets[id].lods.find((l) => l.level === "lod0").file);
}

export function sourceHash() {
    const hash = createHash("sha256");
    hash.update(`generator ${GENERATOR}\n`);
    for (const id of ids) {
        hash.update(id);
        hash.update(readFileSync(lodFile(id)));
    }
    return hash.digest("hex").slice(0, 32);
}

if (process.argv.includes("--check")) {
    const current = JSON.parse(readFileSync(OUT, "utf8")).source;
    const want = sourceHash();
    console.log(current === want ? "tree-footprints.json is up to date" : `tree-footprints.json is stale (${current} != ${want}): run node scripts/ark-tree-footprints.mjs`);
    process.exit(current === want ? 0 : 1);
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

async function geometryOf(id) {
    const buf = readFileSync(lodFile(id));
    const gltf = await new Promise((resolve, reject) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject));
    let geometry = null;
    gltf.scene.traverse((object) => {
        if (!geometry && object.isMesh) geometry = object.geometry;
    });
    return geometry;
}

/** The value under which `share` of the weight lies. */
function weighted(values, share) {
    const sorted = values.slice().sort((a, b) => a.v - b.v);
    const total = sorted.reduce((sum, e) => sum + e.w, 0);
    let run = 0;
    for (const e of sorted) {
        run += e.w;
        if (run >= share * total) return e.v;
    }
    return sorted.length ? sorted[sorted.length - 1].v : 0;
}

const r2 = (v) => Math.round(v * 100) / 100;
const out = {about: "The asset trees' crowns as drawn (lod0 leaf area): scripts/ark-tree-footprints.mjs. cx/cz: the crown's middle; top: the tree's top; trunk: its radius; r: the radius holding 85% of the leaf area; bands: [from, to, r] in five slices up the crown; sectors: reach per 45° from +x toward +z (atan2(z, x)) as a share of r. Asset metres, before the placement's scale and turn.", generator: GENERATOR, source: sourceHash(), assets: {}};

for (const id of ids) {
    const geometry = await geometryOf(id);
    const P = geometry.getAttribute("position");
    const W = geometry.getAttribute("color_1");
    const index = geometry.index;
    const count = index ? index.count / 3 : P.count / 3;
    const at = (k) => (index ? index.getX(k) : k);
    const leaf = [];
    const wood = [];
    let top = 0;
    const tri = new Triangle();
    const mid = new Vector3();
    for (let t = 0; t < count; t++) {
        const v = [at(3 * t), at(3 * t + 1), at(3 * t + 2)];
        for (const i of v) top = Math.max(top, P.getY(i));
        tri.set(new Vector3(P.getX(v[0]), P.getY(v[0]), P.getZ(v[0])), new Vector3(P.getX(v[1]), P.getY(v[1]), P.getZ(v[1])), new Vector3(P.getX(v[2]), P.getY(v[2]), P.getZ(v[2])));
        const area = tri.getArea();
        if (area < 1e-7) continue;
        tri.getMidpoint(mid);
        // Bushes carry no wind weights: every triangle is crown. Trees: leaves flutter, wood does not.
        const leafy = !W || v.some((i) => W.getZ(i) > 0.002 || W.getW(i) > 0.002);
        (leafy ? leaf : wood).push({x: mid.x, y: mid.y, z: mid.z, w: area});
    }
    // A dead snag has no leaves: its crown is its bare limbs (the wood above a third of its height).
    const crown = leaf.length ? leaf : wood.filter((e) => e.y > top * 0.35);
    const total = crown.reduce((sum, e) => sum + e.w, 0);
    const cx = crown.reduce((sum, e) => sum + e.x * e.w, 0) / total;
    const cz = crown.reduce((sum, e) => sum + e.z * e.w, 0) / total;
    const baseY = weighted(crown.map((e) => ({v: e.y, w: e.w})), 0.08);
    const radial = crown.map((e) => ({v: Math.hypot(e.x - cx, e.z - cz), w: e.w, a: Math.atan2(e.z - cz, e.x - cx), y: e.y}));
    const r = weighted(radial, 0.85);
    const bands = [];
    const slices = 5;
    for (let b = 0; b < slices; b++) {
        const from = baseY + ((top - baseY) * b) / slices;
        const to = baseY + ((top - baseY) * (b + 1)) / slices;
        const list = radial.filter((e) => e.y >= from && (e.y < to || b === slices - 1));
        const weight = list.reduce((sum, e) => sum + e.w, 0);
        // A slice with almost no leaves keeps a small reach (the very tip, a gap between tiers).
        bands.push([r2(from), r2(to), r2(weight > total * 0.01 ? weighted(list, 0.85) : r * 0.2)]);
    }
    const sectors = [];
    for (let s = 0; s < 8; s++) {
        const from = s * (Math.PI / 4);
        const list = radial.filter((e) => {
            const a = e.a < 0 ? e.a + Math.PI * 2 : e.a;
            return a >= from && a < from + Math.PI / 4;
        });
        const weight = list.reduce((sum, e) => sum + e.w, 0);
        // A sector with almost no leaves keeps a little reach (a crown is not a pie with a slice cut out).
        sectors.push(r2(weight > total * 0.02 ? weighted(list, 0.85) / r : 0.35));
    }
    const info = manifest.assets[id];
    out.assets[id] = {cx: r2(cx), cz: r2(cz), top: r2(top), trunk: r2(info.trunk_radius ?? 0.04), r: r2(r), bands, sectors};
    console.log(id.padEnd(22), JSON.stringify(out.assets[id]));
}

writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"') + "\n");
console.log(`wrote ${path.relative(root, OUT)} (${ids.length} trees and bushes)`);
