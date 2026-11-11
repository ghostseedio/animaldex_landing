// Loads every GLB in src/ark-scene/assets-manifest.json with three's GLTFLoader + MeshoptDecoder
// (as the scene does) and checks: one mesh, position/normal/color/color_1 present, the triangle
// count matches the manifest, morph targets where listed, attach points inside the bounds.
//
//   node scripts/ark-assets/verify.mjs [--node-modules /path/to/node_modules]

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const nmArg = process.argv.indexOf("--node-modules");
const nm = nmArg > 0 ? process.argv[nmArg + 1] : path.join(repo, "node_modules");
const {GLTFLoader} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/loaders/GLTFLoader.js")).href);
const {MeshoptDecoder} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/libs/meshopt_decoder.module.js")).href);

const manifest = JSON.parse(fs.readFileSync(path.join(repo, "src/ark-scene/assets-manifest.json"), "utf8"));
const base = path.join(repo, "public", manifest.base);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

let failures = 0;
let files = 0;
const fail = (msg) => {
    failures++;
    console.error("FAIL", msg);
};
for (const [id, asset] of Object.entries(manifest.assets)) {
    for (const lod of asset.lods) {
        const buf = fs.readFileSync(path.join(base, lod.file));
        const gltf = await new Promise((resolve, reject) =>
            loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject));
        files++;
        const meshes = [];
        gltf.scene.traverse((o) => o.isMesh && meshes.push(o));
        if (meshes.length !== 1) fail(`${lod.file}: ${meshes.length} meshes`);
        const g = meshes[0].geometry;
        for (const name of ["position", "normal", "color", "color_1"]) {
            if (!g.getAttribute(name)) fail(`${lod.file}: no ${name}`);
        }
        const tris = g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
        if (tris !== lod.tris) fail(`${lod.file}: ${tris} triangles, manifest says ${lod.tris}`);
        if (lod.morph && !(g.morphAttributes.position && g.morphAttributes.position.length === 1)) {
            fail(`${lod.file}: morph target missing`);
        }
        if (meshes[0].material.side !== (lod.doubleSided ? 2 : 0)) fail(`${lod.file}: side ${meshes[0].material.side}`);
        const p = g.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
            if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) {
                fail(`${lod.file}: non-finite position`);
                break;
            }
        }
    }
}
for (const [set, info] of Object.entries(manifest.sets)) {
    const attach = JSON.parse(fs.readFileSync(path.join(base, info.attach), "utf8"));
    for (const [id, points] of Object.entries(attach)) {
        const a = manifest.assets[id];
        if (!a) {
            fail(`${info.attach}: ${id} not in the manifest`);
            continue;
        }
        const pad = 0.25;
        for (const pt of points) {
            if (!manifest.tags[pt.tag]) fail(`${id}: unknown tag ${pt.tag}`);
            for (let k = 0; k < 3; k++) {
                if (pt.p[k] < a.bounds.min[k] - pad || pt.p[k] > a.bounds.max[k] + pad) {
                    fail(`${id}: ${pt.tag} attach point outside the bounds`);
                    break;
                }
            }
            if (!(pt.size[0] <= pt.size[1])) fail(`${id}: bad size range`);
        }
    }
}
console.log(`${files} GLB files checked, ${failures} failures`);
process.exit(failures ? 1 : 0);
