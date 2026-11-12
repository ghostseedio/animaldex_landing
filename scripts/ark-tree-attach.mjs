#!/usr/bin/env node
/**
 * The asset trees' attach points on their real geometry (graphics pass, the leaf shot).
 *
 * The asset lane's `public/ark/assets/v1/trees/attach.json` says where small animals sit on each tree (leaf, bark,
 * branch, …), but its points are computed before the level-of-detail cut and before a leaf's fold, curl and growth,
 * so many float off the drawn lod0 leaves (median up to 0.27 m on some trees). This script keeps attach.json's
 * choice of WHERE (its spread over the crown and trunk) and puts each point on the drawn lod0 surface:
 *
 *   leaf    the nearest drawn, up-facing single leaf (a blade, within 0.6 m; else the crown's leaf mass, a clump):
 *           its top surface over its middle, up = the leaf's
 *           own up, forward = along its midrib (base → tip), size from its length;
 *   bark    the nearest point of the trunk's wood, up = the wood's normal there, forward = up the trunk;
 *   branch  the top of the nearest branch's wood, up = its normal (kept only where it faces the sky);
 *   tree_hollow  the middle of the drawn hole's mouth (its dark ring), facing out of the hole, with its depth;
 *   limb    the top of thick (radius 3 cm and up), not too steep wood up in the tree, for large climbers, with the
 *           limb's radius and the clear room above and below; canopy_hang  the underside of such a limb where the
 *           drop below is clearest (bats).
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
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = path.join(root, "node_modules");
const THREE = await import(pathToFileURL(path.join(nm, "three/build/three.module.js")).href);
const {GLTFLoader} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/loaders/GLTFLoader.js")).href);
const {MeshoptDecoder} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/libs/meshopt_decoder.module.js")).href);
const {Vector3, Triangle, Ray} = THREE;

/** Bump when the method changes (it is part of the source hash). */
const GENERATOR = 6;
const OUT = path.join(root, "src/ark-scene/tree-attach.json");
const manifest = JSON.parse(readFileSync(path.join(root, "src/ark-scene/assets-manifest.json"), "utf8"));
const base = path.join(root, "public", manifest.base);
const attachFile = path.join(base, "trees", "attach.json");
/** The forest floor set's attach points (the fallen logs' tops, graphics batch 6). */
const floorFile = path.join(base, "floor", "attach.json");

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
    if (existsSync(floorFile)) {
        hash.update(readFileSync(floorFile));
        for (const id of logIds()) hash.update(readFileSync(path.join(base, manifest.assets[id].lods.find((l) => l.level === "lod0").file)));
    }
    return hash.digest("hex").slice(0, 32);
}

/** The floor set's logs that have a drawn lod0 and log tops. */
function logIds() {
    if (!existsSync(floorFile)) return [];
    const floor = JSON.parse(readFileSync(floorFile, "utf8"));
    return Object.keys(floor).filter((id) => id.startsWith("log-") && manifest.assets[id]?.lods.some((l) => l.level === "lod0") && floor[id].some((row) => row.tag === "log_top")).sort();
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
    return {tris, leaves, W, N, C: geometry.getAttribute("color"), P, wood: tris.filter((t) => !t.leafy)};
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
    const box = new THREE.Box3();
    let best = null;
    for (const t of list) {
        if (skip && skip.has(t)) continue;
        // Skip a triangle whose box the ray misses (most of them), before the exact test.
        t.box ??= new THREE.Box3().setFromPoints([t.tri.a, t.tri.b, t.tri.c]).expandByScalar(1e-4);
        if (!ray.intersectsBox(box.copy(t.box))) continue;
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
    const {tris, leaves, W, N, C, P, wood} = build(geometry);
    const leafy = tris.filter((t) => t.leafy);
    // The wind weights of the drawn surface nearest the (rounded) point: where two pieces meet, the one it is on.
    const windAt = (list, point) => {
        const under = closestOn(list, point);
        return interpolate(W, under.t, under.point, 4);
    };
    const rows = [];
    const used = new Set();
    const counts = {leaf: [0, 0], bark: [0, 0], branch: [0, 0], tree_hollow: [0, 0]};
    const snapped = {leaf: [], bark: [], branch: [], tree_hollow: []};
    attach[id].forEach((row, source) => {
        if (!counts[row.tag]) return;
        counts[row.tag][0]++;
        const p = new Vector3(...row.p);
        if (row.tag === "leaf") {
            // The nearest drawn leaf that faces the sky and is big enough to sit on: a single leaf (a blade) if one is
            // within 0.6 m, else the crown's leaf mass (a clump) there.
            const nearestOf = (blade) => {
                let best = null;
                const q = new Vector3();
                for (const leaf of leaves) {
                    if (leaf.blade !== blade || leaf.up.y < 0.45 || leaf.length < 0.05 || used.has(leaf)) continue;
                    for (const t of leaf.list) {
                        t.tri.closestPointToPoint(p, q);
                        const d = q.distanceTo(p);
                        if (!best || d < best.d) best = {d, leaf};
                    }
                }
                return best;
            };
            const blade = nearestOf(true);
            const best = blade && blade.d < 0.6 ? blade : nearestOf(false) ?? blade;
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
            rows.push(["leaf", ...position.toArray().map(r3), ...leaf.up.toArray().map(r3), ...forward.toArray().map(r3), 0.002, r3(maxSize), ...weights.map(r4), r3(open), source, leaf.blade ? 1 : 0, 0, 0, 0, 0]);
            snapped.leaf.push(best.d);
            counts.leaf[1]++;
            return;
        }
        if (row.tag === "tree_hollow") {
            // The hollow's mouth as drawn: the ring of dark wood round the hole (trees.py mesh_holes: an inner
            // point, a dark ring, a paler lip), its middle, facing out of the hole.
            // The hole is its own piece of mesh: from the darkest vertex near the point, everything joined to it.
            let start = -1;
            for (let i = 0; i < P.count; i++) {
                if (Math.max(C.getX(i), C.getY(i), C.getZ(i)) >= 0.015) continue;
                if (start < 0 || new Vector3(P.getX(i), P.getY(i), P.getZ(i)).distanceTo(p) < new Vector3(P.getX(start), P.getY(start), P.getZ(start)).distanceTo(p)) start = i;
            }
            if (start < 0 || new Vector3(P.getX(start), P.getY(start), P.getZ(start)).distanceTo(p) > 0.4) return;
            const piece = new Set([start]);
            for (let grew = true; grew;) {
                grew = false;
                for (const t of wood) {
                    if (!t.ids.some((i) => piece.has(i)) || t.ids.every((i) => piece.has(i))) continue;
                    for (const i of t.ids) piece.add(i);
                    grew = true;
                }
            }
            const near = Array.from(piece).map((i) => ({v: new Vector3(P.getX(i), P.getY(i), P.getZ(i)), darkest: Math.max(C.getX(i), C.getY(i), C.getZ(i))}));
            const ring = near.filter((entry) => entry.darkest >= 0.015 && entry.darkest < 0.045).map((entry) => entry.v);
            const inner = near.filter((entry) => entry.darkest < 0.015).map((entry) => entry.v);
            if (ring.length < 5 || !inner.length) return;
            const mouth = ring.reduce((sum, v) => sum.add(v), new Vector3()).multiplyScalar(1 / ring.length);
            const deepest = inner.reduce((best, v) => (v.distanceTo(mouth) < best.distanceTo(mouth) ? v : best), inner[0]);
            const normal = mouth.clone().sub(deepest).normalize();
            const widest = ring.reduce((m, v) => Math.max(m, v.distanceTo(mouth)), 0);
            const weights = windAt(wood, mouth);
            const forward = along(row.f, normal);
            const depth = r3(mouth.distanceTo(deepest) + (row.depth ?? 0));
            // A mouth that opens into the tree's own wood or leaves within half a metre is no way in (snag-a's first
            // hole faces a limb 11 cm off: generator 6, scenery lane): left out.
            if (rayHit(tris, mouth.clone().addScaledVector(normal, 0.01), normal, 0.5)) return;
            rows.push(["tree_hollow", ...mouth.toArray().map(r3), ...normal.toArray().map(r3), ...forward.toArray().map(r3), r3(row.size[0]), r3(Math.min(row.size[1], widest * 2.2)), ...weights.map(r4), 0, source, 0, depth, 0, 0, 0]);
            snapped.tree_hollow.push(p.distanceTo(mouth));
            counts.tree_hollow[1]++;
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
        rows.push([row.tag, ...position.toArray().map(r3), ...normal.toArray().map(r3), ...forward.toArray().map(r3), ...row.size.map(r3), ...weights.map(r4), r3(open), source, 0, 0, 0, 0, 0]);
        snapped[row.tag].push(p.distanceTo(hit.point));
        counts[row.tag][1]++;
    });
    // Limbs for large climbers (sloths, orangutans, tree kangaroos): the tops of thick, not too steep wood up in the
    // tree, each with the limb's radius (half its chord straight through, along the surface normal), the clear room
    // above it (to wood) and below it (to anything of the tree), spread at least 0.9 m apart, thickest first. And the
    // hang points under them (bats, hanging sloths): the limb's underside where the drop below is clearest.
    const H = manifest.assets[id].height;
    let limbCount = 0;
    let hangCount = 0;
    const limbs = [];
    for (const t of wood) {
        if (t.area < 2e-4) continue;
        const c = t.tri.getMidpoint(new Vector3());
        if (c.y < 0.2 * H) continue;
        const n = new Vector3(...interpolate(N, t, c, 3)).normalize();
        if (n.y < 0.6 || t.normal.dot(n) < 0.3) continue;
        // The chord from just inside the surface, measured from the point 2 mm off it (as the point is stored), twice
        // from two depths: where overlapping pieces of wood meet (a limb's root inside the trunk) they disagree, and
        // a limb is never thicker than the trunk.
        const point = c.clone().addScaledVector(n, 0.002);
        const chordFrom = (depth) => {
            const hit = rayHit(wood, point.clone().addScaledVector(n, -depth), n.clone().negate(), 1.5);
            return hit ? hit.point.distanceTo(point) : Infinity;
        };
        const chord = chordFrom(0.006);
        if (!Number.isFinite(chord) || Math.abs(chordFrom(0.01) - chord) > 0.01) continue;
        const radius = chord / 2;
        if (radius < 0.03 || radius > 0.9 * manifest.assets[id].trunk_radius) continue;
        // Its underside: straight down through the limb from its top (below that, the drop is open air or the next limb).
        const under = rayHit(wood, point.clone().add(new Vector3(0, -0.006, 0)), new Vector3(0, -1, 0), 1.5);
        if (!under) continue;
        limbs.push({t, c, n, radius, bottom: under.point});
    }
    limbs.sort((a, b) => b.radius - a.radius || a.c.y - b.c.y || a.c.x - b.c.x);
    const spread = (list, count) => {
        const kept = [];
        for (const entry of list) {
            if (kept.length >= count) break;
            if (kept.some((other) => other.c.distanceTo(entry.c) < 0.9)) continue;
            kept.push(entry);
        }
        return kept;
    };
    // Along the limb: the axis the wood's normals round it turn about (the least-varying direction of those normals).
    const axisAt = (c, n) => {
        const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (const t of wood) {
            const mid = t.tri.getMidpoint(new Vector3());
            if (mid.distanceTo(c) > 0.3) continue;
            const v = t.normal;
            const a = [v.x, v.y, v.z];
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += t.area * a[i] * a[j];
        }
        // The smallest eigenvector: power iteration on (trace·I − M).
        const tr = m[0][0] + m[1][1] + m[2][2];
        let v = [1, 0.3, 0.2];
        for (let k = 0; k < 60; k++) {
            const w = [0, 1, 2].map((i) => tr * v[i] - (m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]));
            const l = Math.hypot(...w) || 1;
            v = w.map((x) => x / l);
        }
        const axis = along(v, n);
        // Pointing out from the trunk.
        if (axis.x * c.x + axis.z * c.z < 0) axis.negate();
        return axis;
    };
    // (Not on palms: a frond's stalk is no limb to climb along; bats still hang under them.)
    for (const limb of spread(id.startsWith("palm") ? [] : limbs, 16)) {
        const above = rayHit(wood, limb.c.clone().addScaledVector(limb.n, 0.01), new Vector3(0, 1, 0), 3)?.d ?? 3;
        const below = rayHit(tris, limb.bottom.clone().add(new Vector3(0, -0.01, 0)), new Vector3(0, -1, 0), 6)?.d ?? 6;
        const position = new Vector3(...limb.c.clone().addScaledVector(limb.n, 0.002).toArray().map(r3));
        rows.push(["limb", ...position.toArray().map(r3), ...limb.n.toArray().map(r3), ...axisAt(limb.c, limb.n).toArray().map(r3), 0.15, r3(Math.min(1.6, 24 * limb.radius)), ...windAt(wood, position).map(r4), 0, -1, 0, 0, r3(limb.radius), r3(above), r3(below)]);
        limbCount++;
    }
    // (The drop measured from 5 mm under the underside, as the test does: an apple hanging just under it counts.)
    const hangs = limbs.map((limb) => ({...limb, below: (rayHit(tris, limb.bottom.clone().add(new Vector3(0, -0.005, 0)), new Vector3(0, -1, 0), 6)?.d ?? 5.995) + 0.005}))
        .filter((limb) => limb.below >= 1.2)
        .sort((a, b) => b.below - a.below || b.radius - a.radius);
    for (const hang of spread(hangs, 8)) {
        const position = new Vector3(...hang.bottom.clone().add(new Vector3(0, -0.002, 0)).toArray().map(r3));
        // (Measured again from the point the row records, as the test does: rounding it can move the ray a fraction of a
        // millimetre onto a triangle edge the first ray missed, as under one of emergent-b's umbrella-crown limbs. Only a
        // drop more than the test's 1 cm shorter replaces the first measurement, so no other tree's rows change.)
        const recheck = rayHit(tris, position.clone().add(new Vector3(0, -0.003, 0)), new Vector3(0, -1, 0), 6);
        const below = recheck && recheck.d + 0.003 < Math.min(hang.below, 6) - 0.01 ? recheck.d + 0.003 : hang.below;
        rows.push(["canopy_hang", ...position.toArray().map(r3), 0, -1, 0, ...along(axisAt(hang.c, hang.n).toArray(), new Vector3(0, -1, 0)).toArray().map(r3), 0.02, r3(Math.min(0.6, 12 * hang.radius)), ...windAt(wood, position).map(r4), 0, -1, 0, 0, r3(hang.radius), 0, r3(below)]);
        hangCount++;
    }
    assets[id] = rows;
    const med = (list) => (list.length ? list.slice().sort((a, b) => a - b)[list.length >> 1].toFixed(3) : "-");
    report.push(`${id}: ${Object.entries(counts).map(([tag, [n, kept]]) => `${tag} ${kept}/${n} (moved ${med(snapped[tag])} m median)`).join(", ")}, limb ${limbCount}, canopy_hang ${hangCount}`);
}

// The fallen logs' tops (graphics batch 6's forest floor): the floor set's log_top rows sit up to 2 cm inside or above
// the drawn bark's relief; each goes onto the topmost drawn surface straight under it, 2 mm up, with that face's up.
const logs = {};
for (const id of logIds()) {
    const geometry = await lod0(id);
    const {tris, N} = build(geometry);
    const floor = JSON.parse(readFileSync(floorFile, "utf8"));
    logs[id] = floor[id].filter((row) => row.tag === "log_top").map((row) => {
        const p = new Vector3(...row.p);
        const hit = rayHit(tris, p.clone().add(new Vector3(0, 0.3, 0)), new Vector3(0, -1, 0), 0.6);
        const at = hit ? hit.point : p;
        // The surface's smooth normal there (a bark facet's own can lean far over).
        let n = hit ? new Vector3(...interpolate(N, hit.t, hit.point, 3)) : new Vector3(...row.n);
        if (n.y < 0) n.negate();
        n = n.normalize();
        const forward = along(row.f, n);
        return [...at.clone().addScaledVector(n, 0.002).toArray().map(r3), ...n.toArray().map(r3), ...forward.toArray().map(r3), r3(row.size[0]), r3(row.size[1])];
    });
}

const out = {
    about: "Generated by scripts/ark-tree-attach.mjs from public/ark/assets/v1/trees/attach.json and the lod0 GLBs: each tree asset's attach points on its drawn lod0 surface, in the asset's own metres. Row: [tag, px, py, pz, upx, upy, upz, fwdx, fwdy, fwdz, sizeMin, sizeMax, wind sway, wind phase, flutter, leaf phase, open, attach.json index, 1 on a single leaf (blade) / 0 on a leaf mass (clump) or wood, a hollow's depth (m) / 0, limb radius (m) / 0, clear room above to wood (m), clear drop below to anything of the tree (m)]. Do not edit by hand.",
    generator: GENERATOR,
    source: sourceHash(),
    assets,
    /** The fallen logs' tops, per floor asset: [px, py, pz, upx, upy, upz, fwdx, fwdy, fwdz, sizeMin, sizeMax], on the drawn lod0 surface. */
    logs
};
writeFileSync(OUT, JSON.stringify(out).replace(/\],\[/g, "],\n["));
console.log(report.join("\n"));
console.log(`wrote ${path.relative(root, OUT)}: ${Object.values(assets).reduce((sum, rows) => sum + rows.length, 0)} points`);
