#!/usr/bin/env node
/**
 * The asset trees' attach points on their real geometry (graphics pass, the leaf shot).
 *
 * The asset lane's `public/ark/assets/v1/trees/attach.json` says where small animals sit on each tree (leaf, bark,
 * branch, …), but its points are computed before the level-of-detail cut and before a leaf's fold, curl and growth,
 * so many float off the drawn lod0 leaves (median up to 0.27 m on some trees). This script keeps attach.json's
 * choice of WHERE (its spread over the crown and trunk) and puts each point on the drawn lod0 surface:
 *
 *   leaf    the nearest drawn, up-facing leaf (blade or clump): its top surface over its middle, up = the leaf's
 *           own up, forward = along its midrib (base → tip), size from its length;
 *   bark    the nearest point of the trunk's wood, up = the wood's normal there, forward = up the trunk;
 *   branch  the top of the nearest branch's wood, up = its normal (kept only where it faces the sky).
 *
 * Each point also gets the drawn surface's wind weights there (COLOR_1, interpolated), so the scene can move an
 * animal with its leaf exactly as the tree shader moves the leaf (`tree-assets.ts` treeSway), and `open`: the share
 * of sight lines within 40° of out-and-up that leave its own tree unblocked (how visible it is from outside).
 *
 * Writes `src/ark-scene/tree-attach.json` (bundled with the sampler). Its `source` hash covers attach.json and every
 * lod0 GLB, so `src/lib/ark-attach.test.ts` fails when the assets change and this needs running again:
 *
 *   node scripts/ark-tree-attach.mjs           (re)write tree-attach.json
 *   node scripts/ark-tree-attach.mjs --check   exit 1 if it is out of date
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
const {Vector3, Triangle, Ray} = THREE;

/** Bump when the method changes (it is part of the source hash). */
const GENERATOR = 1;
const OUT = path.join(root, "src/ark-scene/tree-attach.json");
const manifest = JSON.parse(readFileSync(path.join(root, "src/ark-scene/assets-manifest.json"), "utf8"));
const base = path.join(root, "public", manifest.base);
const attachFile = path.join(base, "trees", "attach.json");

/** The inputs' hash: the generator version, attach.json and every tree's lod0 GLB (the same as the test computes). */
function sourceHash() {
    const hash = createHash("sha256");
    hash.update(`generator ${GENERATOR}\n`);
    hash.update(readFileSync(attachFile));
    const attach = JSON.parse(readFileSync(attachFile, "utf8"));
    for (const id of Object.keys(attach).sort()) {
        const lod = manifest.assets[id]?.lods.find((l) => l.level === "lod0");
        if (lod) hash.update(readFileSync(path.join(base, lod.file)));
    }
    return hash.digest("hex").slice(0, 32);
}

if (process.argv.includes("--check")) {
    const current = JSON.parse(readFileSync(OUT, "utf8")).source;
    const want = sourceHash();
    console.log(current === want ? "tree-attach.json is up to date" : `tree-attach.json is stale (${current} != ${want}): run node scripts/ark-tree-attach.mjs`);
    process.exit(current === want ? 0 : 1);
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

async function lod0(id) {
    const lod = manifest.assets[id].lods.find((l) => l.level === "lod0");
    const buf = readFileSync(path.join(base, lod.file));
    const gltf = await new Promise((resolve, reject) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject));
    let geometry = null;
    gltf.scene.traverse((object) => {
        if (!geometry && object.isMesh) geometry = object.geometry;
    });
    return geometry;
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;

function build(geometry) {
    const P = geometry.getAttribute("position");
    const N = geometry.getAttribute("normal");
    const W = geometry.getAttribute("color_1");
    const index = geometry.index;
    const count = index.count / 3;
    const vertex = (i) => new Vector3(P.getX(i), P.getY(i), P.getZ(i));
    const tris = [];
    for (let t = 0; t < count; t++) {
        const ids = [index.getX(3 * t), index.getX(3 * t + 1), index.getX(3 * t + 2)];
        // Leaves (blades, clumps, needles) flutter: COLOR_1 z (0 at the stalk) or w (the leaf's phase) set; wood has neither.
        const leafy = ids.some((i) => W.getZ(i) > 0.002 || W.getW(i) > 0.002);
        const tri = new Triangle(vertex(ids[0]), vertex(ids[1]), vertex(ids[2]));
        tris.push({ids, tri, leafy, area: tri.getArea(), normal: tri.getNormal(new Vector3())});
    }
    // Leaves: connected pieces of leafy triangles (no two leaves share a vertex).
    const parent = new Int32Array(P.count).map((_, i) => i);
    const find = (i) => {
        while (parent[i] !== i) i = parent[i] = parent[parent[i]];
        return i;
    };
    for (const t of tris) if (t.leafy) for (const i of t.ids.slice(1)) parent[find(i)] = find(t.ids[0]);
    const groups = new Map();
    for (const t of tris) {
        if (!t.leafy) continue;
        const key = find(t.ids[0]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }
    const leaves = [];
    for (const list of groups.values()) {
        const verts = Array.from(new Set(list.flatMap((t) => t.ids)));
        const area = list.reduce((sum, t) => sum + t.area, 0);
        if (area < 1e-5) continue;
        const up = new Vector3();
        const centroid = new Vector3();
        for (const t of list) {
            up.addScaledVector(t.normal, t.area);
            centroid.addScaledVector(t.tri.getMidpoint(new Vector3()), t.area / area);
        }
        if (up.y < 0) up.negate();
        up.normalize();
        let baseV = verts[0];
        let tipV = verts[0];
        for (const i of verts) {
            if (W.getZ(i) < W.getZ(baseV)) baseV = i;
            if (W.getZ(i) > W.getZ(tipV)) tipV = i;
        }
        // A blade's tip is the one vertex at full flutter (1); a clump's rim stops at 0.6.
        const blade = W.getZ(tipV) > 0.8;
        const length = vertex(tipV).distanceTo(vertex(baseV));
        let reach = 0;
        for (const i of verts) reach = Math.max(reach, vertex(i).distanceTo(vertex(baseV)));
        leaves.push({list, verts, area, up, centroid, base: vertex(baseV), tip: vertex(tipV), blade, length: blade ? length : reach * 2});
    }
    return {tris, leaves, W, N, wood: tris.filter((t) => !t.leafy)};
}

/** The barycentric mix of a per-vertex attribute at a point on a triangle. */
function interpolate(attribute, t, point, size) {
    const bary = t.tri.getBarycoord(point, new Vector3());
    const get = [(i) => attribute.getX(i), (i) => attribute.getY(i), (i) => attribute.getZ(i), (i) => attribute.getW(i)];
    const out = [];
    for (let k = 0; k < size; k++) out.push(bary.x * get[k](t.ids[0]) + bary.y * get[k](t.ids[1]) + bary.z * get[k](t.ids[2]));
    return out;
}

function closestOn(list, p) {
    let best = null;
    const q = new Vector3();
    for (const t of list) {
        t.tri.closestPointToPoint(p, q);
        const d = q.distanceToSquared(p);
        if (!best || d < best.d) best = {d, t, point: q.clone()};
    }
    if (best) best.d = Math.sqrt(best.d);
    return best;
}

function rayHit(list, origin, direction, far, skip) {
    const ray = new Ray(origin, direction);
    const hit = new Vector3();
    let best = null;
    for (const t of list) {
        if (skip && skip.has(t)) continue;
        if (!ray.intersectTriangle(t.tri.a, t.tri.b, t.tri.c, false, hit)) continue;
        const d = hit.distanceTo(origin);
        if (d <= far && (!best || d < best.d)) best = {d, t, point: hit.clone()};
    }
    return best;
}

/** Sight lines within 40° of the out-and-up axis that leave the tree (none of its triangles in the way). */
function openness(all, point, up, skip) {
    const out = new Vector3(point.x, 0, point.z);
    const axis = (out.lengthSq() > 1e-4 ? out.normalize().multiplyScalar(0.8) : new Vector3()).add(up).normalize();
    const side = new Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
    const side2 = new Vector3().crossVectors(axis, side);
    const origin = point.clone().addScaledVector(up, 0.01);
    let clear = 0;
    const rays = 24;
    for (let k = 0; k < rays; k++) {
        // A golden-angle spiral over the cone's cap: even coverage, the same every run.
        const f = (k + 0.5) / rays;
        const theta = Math.acos(1 - f * (1 - Math.cos((40 * Math.PI) / 180)));
        const phi = k * 2.399963229728653;
        const dir = axis.clone().multiplyScalar(Math.cos(theta)).addScaledVector(side, Math.sin(theta) * Math.cos(phi)).addScaledVector(side2, Math.sin(theta) * Math.sin(phi)).normalize();
        if (!rayHit(all, origin, dir, 30, skip)) clear++;
    }
    return clear / rays;
}

const along = (f, n) => {
    const v = new Vector3(...f);
    v.addScaledVector(n, -v.dot(n));
    if (v.lengthSq() < 1e-8) v.set(1, 0, 0).addScaledVector(n, -n.x);
    return v.normalize();
};

const attach = JSON.parse(readFileSync(attachFile, "utf8"));
const assets = {};
const report = [];
for (const id of Object.keys(attach).sort()) {
    if (!manifest.assets[id]) continue;
    const geometry = await lod0(id);
    if (!geometry) continue;
    const {tris, leaves, W, N, wood} = build(geometry);
    const leafy = tris.filter((t) => t.leafy);
    // The wind weights of the drawn surface nearest the (rounded) point: where two pieces meet, the one it is on.
    const windAt = (list, point) => {
        const under = closestOn(list, point);
        return interpolate(W, under.t, under.point, 4);
    };
    const rows = [];
    const used = new Set();
    const counts = {leaf: [0, 0], bark: [0, 0], branch: [0, 0]};
    const snapped = {leaf: [], bark: [], branch: []};
    attach[id].forEach((row, source) => {
        if (!counts[row.tag]) return;
        counts[row.tag][0]++;
        const p = new Vector3(...row.p);
        if (row.tag === "leaf") {
            // The nearest drawn leaf that faces the sky and is big enough to sit on.
            let best = null;
            const q = new Vector3();
            for (const leaf of leaves) {
                if (leaf.up.y < 0.45 || leaf.length < 0.05 || used.has(leaf)) continue;
                for (const t of leaf.list) {
                    t.tri.closestPointToPoint(p, q);
                    const d = q.distanceTo(p);
                    if (!best || d < best.d) best = {d, leaf};
                }
            }
            if (!best) return;
            const leaf = best.leaf;
            used.add(leaf);
            // Its top surface over its middle (a folded blade: the ridge of its midrib).
            const from = leaf.blade ? leaf.base.clone().lerp(leaf.tip, 0.45) : leaf.centroid.clone();
            const hit = rayHit(leaf.list, from.clone().addScaledVector(leaf.up, 0.5), leaf.up.clone().negate(), 1) ?? closestOn(leaf.list, from);
            const forward = leaf.blade ? along(leaf.tip.clone().sub(leaf.base).toArray(), leaf.up) : along(row.f, leaf.up);
            const position = new Vector3(...hit.point.clone().addScaledVector(leaf.up, 0.002).toArray().map(r3));
            const weights = windAt(leafy, position);
            const open = openness(tris, position, leaf.up, new Set(leaf.list));
            const maxSize = leaf.blade ? 0.6 * leaf.length : 0.45 * leaf.length;
            rows.push(["leaf", ...position.toArray().map(r3), ...leaf.up.toArray().map(r3), ...forward.toArray().map(r3), 0.002, r3(maxSize), ...weights.map(r4), r3(open), source]);
            snapped.leaf.push(best.d);
            counts.leaf[1]++;
            return;
        }
        // Bark and branches: the wood itself.
        let hit = closestOn(wood, p);
        if (!hit) return;
        let normal = new Vector3(...interpolate(N, hit.t, hit.point, 3)).normalize();
        if (row.tag === "branch" && normal.y < 0.55) {
            // The top of the branch: straight down onto its wood from just above.
            const top = rayHit(wood, p.clone().add(new Vector3(0, 0.15, 0)), new Vector3(0, -1, 0), 0.4);
            if (top) {
                hit = top;
                normal = new Vector3(...interpolate(N, hit.t, hit.point, 3)).normalize();
            }
        }
        const far = row.tag === "bark" ? 0.06 : 0.08;
        if (hit.d > far + (row.tag === "branch" ? 0.15 : 0)) return;
        if (row.tag === "branch" && normal.y < 0.55) return;
        if (row.tag === "bark" && normal.dot(new Vector3(...row.n)) < 0) normal.negate();
        const position = new Vector3(...hit.point.clone().addScaledVector(normal, 0.002).toArray().map(r3));
        const weights = windAt(wood, position);
        const forward = along(row.f, normal);
        const open = row.tag === "bark" ? openness(tris, position, normal, new Set([hit.t])) : 0;
        rows.push([row.tag, ...position.toArray().map(r3), ...normal.toArray().map(r3), ...forward.toArray().map(r3), ...row.size.map(r3), ...weights.map(r4), r3(open), source]);
        snapped[row.tag].push(p.distanceTo(hit.point));
        counts[row.tag][1]++;
    });
    assets[id] = rows;
    const med = (list) => (list.length ? list.slice().sort((a, b) => a - b)[list.length >> 1].toFixed(3) : "-");
    report.push(`${id}: ${Object.entries(counts).map(([tag, [n, kept]]) => `${tag} ${kept}/${n} (moved ${med(snapped[tag])} m median)`).join(", ")}`);
}

const out = {
    about: "Generated by scripts/ark-tree-attach.mjs from public/ark/assets/v1/trees/attach.json and the lod0 GLBs: each tree asset's attach points on its drawn lod0 surface, in the asset's own metres. Row: [tag, px, py, pz, upx, upy, upz, fwdx, fwdy, fwdz, sizeMin, sizeMax, wind sway, wind phase, flutter, leaf phase, open, attach.json index]. Do not edit by hand.",
    generator: GENERATOR,
    source: sourceHash(),
    assets
};
writeFileSync(OUT, JSON.stringify(out).replace(/\],\[/g, "],\n["));
console.log(report.join("\n"));
console.log(`wrote ${path.relative(root, OUT)}: ${Object.values(assets).reduce((sum, rows) => sum + rows.length, 0)} points`);
