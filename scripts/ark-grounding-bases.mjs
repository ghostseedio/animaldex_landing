#!/usr/bin/env node
/**
 * Every Ark model's true base, from its mesh (motion 100x pass, lane L3, the owner's "animals float or sink").
 *
 * The talking models were normalised to one unit long, so where each one's feet are is not where its origin or its
 * bounding box says: a bird's tail hangs below its toes, a lizard's belly drags, a far level decimated from the near
 * one has another lowest point. The scene used to stand every model on its bounding box's floor (`model.minY`, from
 * whichever level loaded first), so a perched-pose bird stood on its tail with its feet in the air and a near/far
 * swap moved it up or down. This script reads each model's own meshes and writes, in the model's own units (they
 * scale with whatever size the scene draws it at, so true sizing never needs this run again):
 *
 *   base       the height its weight rests on: the lowest level whose contact points, seen from above, surround its
 *              middle (the area-weighted centroid of its surface) within a small margin. Feet for a standing animal,
 *              the belly for a snake or a fish, the toes for a perched-pose bird whose tail hangs lower;
 *   minY       the lowest point (what the scene used), so `base - minY` is how far something hangs below its feet;
 *   footprint  the contact points' extent (x across, z along) at its base, for standing it on a slope;
 *   per level  near and far each (the scene draws each level on its own base, so a level swap never moves it).
 *
 * From the rig files (`ark-rig/v2`, else `v1`: the near mesh with a skin) it adds the feet: the lowest skinned point
 * of each grip bone (feet, hands, claws, `map/grip.ts` GRIP_BONE) at rest, how far that sole is below the bone's
 * pivot (`drop`: what turns `gripPoint`'s pivot into the sole), and per clip how far the lowest sole moves from its
 * rest height across the clip's frames (mean, lowest, highest): a walk that never puts a foot down floats.
 *
 * Inputs are read-only downloads from the public talking-models bucket (the live manifests: `v1/ark/manifest.json`,
 * `ark-rig/v2/manifest.json`, `ark-rig/v1/manifest.json`), cached in `--cache` (nothing is ever uploaded):
 *
 *   node scripts/ark-grounding-bases.mjs --cache <dir>           fetch what is missing, (re)write the json
 *   node scripts/ark-grounding-bases.mjs --cache <dir> --check   exit 1 if the json is out of date with the bucket
 *   node scripts/ark-grounding-bases.mjs --cache <dir> --only a,b print those models' numbers, write nothing
 *
 * Writes `src/ark-scene/grounding/model-base.json` (bundled: `grounding/base.ts`) and, with `--detail <file>`, every
 * number per model for the audit.
 */

import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nm = path.join(root, "node_modules");
const THREE = await import(pathToFileURL(path.join(nm, "three/build/three.module.js")).href);
const {GLTFLoader} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/loaders/GLTFLoader.js")).href);
const {MeshoptDecoder} = await import(pathToFileURL(path.join(nm, "three/examples/jsm/libs/meshopt_decoder.module.js")).href);
const {Matrix4, Vector3} = THREE;

/** Bump when the method changes (it is part of the source hash). */
const GENERATOR = 1;
const BUCKET = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models";
const OUT = path.join(root, "src/ark-scene/grounding/model-base.json");
/** As `map/grip.ts` GRIP_BONE: a foot, a hand, a paw, a claw, a toe (never a wing's "hand" or a fin). */
const GRIP_BONE = /^(?!.*(?:wing|fin|flipper)).*(?:foot|hand|paw|claw|toe|wrist|ankle)/i;
/** The contact points' margin round the middle: this share of the body's larger side across the ground. */
const MARGIN = 0.06;
/** A base is never more than this share of the height above the lowest point (past it the model has no clear support). */
const MAX_LIFT = 0.3;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const cache = value("--cache") ?? process.env.ARK_GROUNDING_CACHE;
if (!cache) throw new Error("usage: ark-grounding-bases.mjs --cache <dir> [--check] [--only slug,slug] [--detail file]");
const only = value("--only") ? new Set(value("--only").split(",")) : null;

async function fetchTo(url, file) {
    if (existsSync(file)) return file;
    mkdirSync(path.dirname(file), {recursive: true});
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const part = `${file}.${process.pid}.part`;
                writeFileSync(part, Buffer.from(await response.arrayBuffer()));
                renameSync(part, file);
                return file;
            }
            if (response.status === 404) return null;
        } catch {
            // (A dropped connection: try again.)
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
    return existsSync(file) ? file : null;
}

async function manifest(name, url) {
    // The manifests are read fresh each run (they say which files are live), into the cache for the record.
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const text = await response.text();
    writeFileSync(path.join(cache, name), text);
    return JSON.parse(text);
}

mkdirSync(cache, {recursive: true});
const arkManifest = await manifest("ark-manifest.json", `${BUCKET}/v1/ark/manifest.json`);
const rigV2 = await manifest("rig-v2-manifest.json", `${BUCKET}/ark-rig/v2/manifest.json`);
const rigV1 = await manifest("rig-v1-manifest.json", `${BUCKET}/ark-rig/v1/manifest.json`);
const models = arkManifest.models;
const rigOf = (slug) => (rigV2.species?.[slug] ? {set: 2, version: rigV2.species[slug]} : rigV1.species?.[slug] ? {set: 1, version: rigV1.species[slug]} : null);

/** The inputs' hash: the generator and every file's version (each a content hash in its own set). */
function sourceHash() {
    const hash = createHash("sha256");
    hash.update(`generator ${GENERATOR}\n`);
    for (const slug of Object.keys(models).sort()) {
        const rig = rigOf(slug);
        hash.update(`${slug} ${models[slug]} ${rig ? `${rig.set}/${rig.version}` : "-"}\n`);
    }
    return hash.digest("hex").slice(0, 32);
}

if (flag("--check")) {
    const current = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).source : null;
    const want = sourceHash();
    console.log(current === want ? "model-base.json is up to date with the bucket" : `model-base.json is stale (${current} != ${want}): run node scripts/ark-grounding-bases.mjs --cache <dir>`);
    process.exit(current === want ? 0 : 1);
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

/** A GLB without its images (node has no image decoder; only the geometry and the rig's extras are read). */
function stripped(buffer) {
    const jsonLength = buffer.readUInt32LE(12);
    const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
    delete json.images;
    delete json.textures;
    delete json.samplers;
    for (const material of json.materials ?? []) {
        if (material.pbrMetallicRoughness) {
            delete material.pbrMetallicRoughness.baseColorTexture;
            delete material.pbrMetallicRoughness.metallicRoughnessTexture;
        }
        delete material.normalTexture;
        delete material.emissiveTexture;
        delete material.occlusionTexture;
    }
    const rest = buffer.subarray(20 + jsonLength);
    let head = Buffer.from(JSON.stringify(json), "utf8");
    head = Buffer.concat([head, Buffer.alloc((4 - (head.length % 4)) % 4, 0x20)]);
    const out = Buffer.alloc(20 + head.length + rest.length);
    out.writeUInt32LE(0x46546c67, 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(out.length, 8);
    out.writeUInt32LE(head.length, 12);
    out.writeUInt32LE(0x4e4f534a, 16);
    head.copy(out, 20);
    rest.copy(out, 20 + head.length);
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

async function parse(file) {
    const gltf = await loader.parseAsync(stripped(readFileSync(file)), "");
    gltf.scene.updateMatrixWorld(true);
    return gltf;
}

/** A level's vertices in the model's space (the node's transform baked in, as `models.ts` plainGeometry) and triangles. */
async function levelMesh(file) {
    const gltf = await parse(file);
    let mesh = null;
    gltf.scene.traverse((object) => {
        if (!mesh && object.isMesh) mesh = object;
    });
    if (!mesh) return null;
    const position = mesh.geometry.getAttribute("position");
    const points = new Float64Array(position.count * 3);
    const v = new Vector3();
    for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        points[i * 3] = v.x;
        points[i * 3 + 1] = v.y;
        points[i * 3 + 2] = v.z;
    }
    const index = mesh.geometry.getIndex();
    const tris = index ? Array.from(index.array) : Array.from({length: position.count}, (_, i) => i);
    return {points, tris};
}

/** The middle of the surface, area-weighted (x, z): a stand-in for the centre of mass seen from above. */
function surfaceMiddle(points, tris) {
    let area = 0;
    let x = 0;
    let z = 0;
    for (let t = 0; t + 2 < tris.length; t += 3) {
        const a = tris[t] * 3;
        const b = tris[t + 1] * 3;
        const c = tris[t + 2] * 3;
        const ux = points[b] - points[a];
        const uy = points[b + 1] - points[a + 1];
        const uz = points[b + 2] - points[a + 2];
        const vx = points[c] - points[a];
        const vy = points[c + 1] - points[a + 1];
        const vz = points[c + 2] - points[a + 2];
        const s = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
        area += s;
        x += s * (points[a] + points[b] + points[c]) / 3;
        z += s * (points[a + 2] + points[b + 2] + points[c + 2]) / 3;
    }
    return area > 0 ? {x: x / area, z: z / area} : {x: 0, z: 0};
}

/** Andrew's monotone chain: the convex hull of (x, z) pairs, counter-clockwise. */
function hull(pts) {
    if (pts.length < 3) return pts.slice();
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of p) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
        lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
        upper.push(q);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

/** How far a point is outside a convex polygon (0 inside); a 1- or 2-point "polygon" is its point or segment. */
function outside(poly, x, z) {
    if (!poly.length) return Infinity;
    const segment = (a, b) => {
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const l = dx * dx + dz * dz;
        const t = l > 0 ? Math.min(Math.max(((x - a[0]) * dx + (z - a[1]) * dz) / l, 0), 1) : 0;
        return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    };
    if (poly.length === 1) return Math.hypot(x - poly[0][0], z - poly[0][1]);
    if (poly.length === 2) return segment(poly[0], poly[1]);
    let inside = true;
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) inside = false;
        best = Math.min(best, segment(a, b));
    }
    return inside ? 0 : best;
}

const r4 = (v) => Math.round(v * 10000) / 10000;
const r3 = (v) => Math.round(v * 1000) / 1000;
/** The clips the scene stands on its feet (`grounding/base.ts` STANDING): only their real offsets are kept. */
const STANDING = new Set(["idle", "walk", "run", "trot", "gallop", "graze", "browse", "scan", "call", "display", "groom", "dig", "strike", "fight", "clash", "shake_off", "perch", "stalk", "sniff", "drink"]);

/**
 * A mesh's base: the lowest height h whose points at or below h, seen from above, surround the middle within the
 * margin. Binary search over h (the hull only grows with h).
 */
function support(points, tris) {
    const n = points.length / 3;
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
        minX = Math.min(minX, points[i * 3]);
        maxX = Math.max(maxX, points[i * 3]);
        minY = Math.min(minY, points[i * 3 + 1]);
        maxY = Math.max(maxY, points[i * 3 + 1]);
        minZ = Math.min(minZ, points[i * 3 + 2]);
        maxZ = Math.max(maxZ, points[i * 3 + 2]);
    }
    const height = maxY - minY;
    const middle = surfaceMiddle(points, tris);
    const margin = MARGIN * Math.max(maxX - minX, maxZ - minZ);
    const order = Array.from({length: n}, (_, i) => i).sort((a, b) => points[a * 3 + 1] - points[b * 3 + 1]);
    const below = (h) => {
        const pts = [];
        for (const i of order) {
            if (points[i * 3 + 1] > h) break;
            pts.push([points[i * 3], points[i * 3 + 2]]);
        }
        return pts;
    };
    const holds = (h) => outside(hull(below(h)), middle.x, middle.z) <= margin;
    let lo = minY;
    let hi = minY + MAX_LIFT * height;
    let clear = true;
    if (!holds(hi)) {
        clear = false;
        lo = hi = minY;
    } else {
        for (let k = 0; k < 18; k++) {
            const mid = (lo + hi) / 2;
            if (holds(mid)) hi = mid;
            else lo = mid;
        }
    }
    const base = clear ? hi : minY;
    // The contact points: within 2% of the height above the base.
    const touch = below(base + 0.02 * height);
    let fx0 = Infinity;
    let fx1 = -Infinity;
    let fz0 = Infinity;
    let fz1 = -Infinity;
    for (const [x, z] of touch) {
        fx0 = Math.min(fx0, x);
        fx1 = Math.max(fx1, x);
        fz0 = Math.min(fz0, z);
        fz1 = Math.max(fz1, z);
    }
    return {base, minY, maxY, height, clear, middle, footprint: [fx0, fx1, fz0, fz1], extent: [minX, maxX, minZ, maxZ]};
}

function half(h) {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    if (e === 0) return s * 2 ** -14 * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * 2 ** (e - 15) * (1 + f / 1024);
}

/**
 * A rig's feet: its rest mesh in the model's space (as `rig-player.ts` restGeometry), each grip bone's vertices (the
 * bone carrying most of their weight), their lowest point at rest and per clip frame.
 */
async function rigFeet(file) {
    const gltf = await parse(file);
    const extras = gltf.parser.json.extras?.ark_rig;
    if (!extras || !Array.isArray(extras.bones)) return null;
    let mesh = null;
    gltf.scene.traverse((object) => {
        if (!mesh && object.isSkinnedMesh) mesh = object;
    });
    if (!mesh) return null;
    const source = mesh.geometry;
    const position = source.getAttribute("position");
    const skinIndex = source.getAttribute("skinIndex");
    const skinWeight = source.getAttribute("skinWeight");
    const bones = mesh.skeleton.bones;
    const remap = bones.map((bone) => Math.max(extras.bones.indexOf(bone.name), 0));
    const jointMatrices = bones.map((bone, i) => new Matrix4().multiplyMatrices(bone.matrixWorld, mesh.skeleton.boneInverses[i]));
    const toWorld = new Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse);
    const blended = new Matrix4();
    const v = new Vector3();
    const count = position.count;
    const rest = new Float64Array(count * 3);
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
            const e = jointMatrices[j].elements;
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
        rest[i * 3] = v.x;
        rest[i * 3 + 1] = v.y;
        rest[i * 3 + 2] = v.z;
    }
    // Grip bones (texture indices) and their rest pivots.
    const grips = [];
    const at = new Vector3();
    for (const bone of bones) {
        const index = extras.bones.indexOf(bone.name);
        if (index < 0 || !GRIP_BONE.test(bone.name)) continue;
        bone.getWorldPosition(at);
        grips.push({bone: index, name: bone.name, pivot: [at.x, at.y, at.z], vertices: []});
    }
    const byBone = new Map(grips.map((g) => [g.bone, g]));
    for (let i = 0; i < count; i++) {
        let best = -1;
        let weight = 0;
        for (let k = 0; k < 4; k++) {
            if (weights[i * 4 + k] > weight) {
                weight = weights[i * 4 + k];
                best = joints[i * 4 + k];
            }
        }
        const grip = byBone.get(best);
        if (grip && weight >= 0.5) grip.vertices.push(i);
    }
    const feet = grips.filter((g) => g.vertices.length);
    let restSole = Infinity;
    for (const g of feet) {
        g.sole = Math.min(...g.vertices.map((i) => rest[i * 3 + 1]));
        g.drop = g.pivot[1] - g.sole;
        restSole = Math.min(restSole, g.sole);
    }
    let restMin = Infinity;
    for (let i = 0; i < count; i++) restMin = Math.min(restMin, rest[i * 3 + 1]);
    // The bone matrices: per row, per bone, 3×4 floats (half), rest (model space) → that frame.
    const view = await gltf.parser.getDependency("bufferView", extras.bufferView);
    const data = new Uint16Array(view);
    const B = extras.bones.length;
    const M = (row, bone, e) => half(data[row * B * 12 + bone * 12 + e]);
    const skinnedY = (row, i) => {
        let y = 0;
        for (let k = 0; k < 4; k++) {
            const w = weights[i * 4 + k];
            if (w <= 0) continue;
            const j = joints[i * 4 + k];
            y += w * (M(row, j, 4) * rest[i * 3] + M(row, j, 5) * rest[i * 3 + 1] + M(row, j, 6) * rest[i * 3 + 2] + M(row, j, 7));
        }
        return y;
    };
    const footVertices = feet.flatMap((g) => g.vertices);
    // Every 3rd vertex for the body's lowest point (enough for a lying or sitting clip's belly).
    const bodyVertices = [];
    for (let i = 0; i < count; i += 3) bodyVertices.push(i);
    const entry = extras.rig ?? {};
    const clips = {};
    const listed = entry.clips && typeof entry.clips === "object" && !Array.isArray(entry.clips) ? entry.clips : {};
    for (const [name, clip] of Object.entries(listed)) {
        const row = Number(clip.row);
        const rows = Number(clip.rows);
        if (!Number.isInteger(row) || !Number.isInteger(rows) || rows < 2 || row + rows > extras.rows) continue;
        const sole = [];
        const body = [];
        for (let r = row; r < row + rows; r++) {
            if (footVertices.length) {
                let low = Infinity;
                for (const i of footVertices) low = Math.min(low, skinnedY(r, i));
                sole.push(low - restSole);
            }
            let lowBody = Infinity;
            for (const i of bodyVertices) lowBody = Math.min(lowBody, skinnedY(r, i));
            body.push(lowBody - restMin);
        }
        const stats = (list) => (list.length ? [list.reduce((a, b) => a + b, 0) / list.length, Math.min(...list), Math.max(...list)] : null);
        clips[name] = {sole: stats(sole), body: stats(body)};
    }
    return {restSole: Number.isFinite(restSole) ? restSole : null, restMin, feet: feet.map((g) => ({bone: g.bone, name: g.name, drop: g.drop, sole: g.sole})), clips, gripBones: grips.length};
}

const slugs = Object.keys(models).sort().filter((slug) => !only || only.has(slug));
const out = {};
const rigs = {};
const detail = {};
let done = 0;
let failed = 0;
const started = Date.now();
const work = slugs.map((slug) => async () => {
    const version = models[slug];
    try {
        const near = await fetchTo(`${BUCKET}/v1/ark/${slug}/${version}.near.glb`, path.join(cache, "v1-ark", slug, `${version}.near.glb`));
        const far = await fetchTo(`${BUCKET}/v1/ark/${slug}/${version}.far.glb`, path.join(cache, "v1-ark", slug, `${version}.far.glb`));
        const arkJson = await fetchTo(`${BUCKET}/v1/ark/${slug}/${version}.ark.json`, path.join(cache, "v1-ark", slug, `${version}.ark.json`));
        const plan = arkJson ? JSON.parse(readFileSync(arkJson, "utf8"))?.behaviour?.plan ?? null : null;
        const nearMesh = near ? await levelMesh(near) : null;
        const farMesh = far ? await levelMesh(far) : null;
        const n = nearMesh ? support(nearMesh.points, nearMesh.tris) : null;
        const f = farMesh ? support(farMesh.points, farMesh.tris) : null;
        if (!n && !f) throw new Error("no level");
        const s = n ?? f;
        // [near base, near minY, far base, far minY, footprint x0 x1 z0 z1 (near), clear (1/0), plan]
        // [..., clear (1/0), the near mesh's size x y z, plan]
        const size = [s.extent[1] - s.extent[0], s.maxY - s.minY, s.extent[3] - s.extent[2]];
        out[slug] = [r4(n ? n.base : f.base), r4(n ? n.minY : f.minY), r4(f ? f.base : n.base), r4(f ? f.minY : n.minY), ...s.footprint.map(r3), s.clear ? 1 : 0, ...size.map(r3), typeof plan === "string" ? plan : ""];
        const rig = rigOf(slug);
        let feet = null;
        if (rig) {
            const file = await fetchTo(`${BUCKET}/ark-rig/v${rig.set}/${slug}/${rig.version}.rig.glb`, path.join(cache, `ark-rig-v${rig.set}`, slug, `${rig.version}.rig.glb`));
            feet = file ? await rigFeet(file) : null;
            if (feet && feet.restSole !== null) {
                // [set, sole, mean grip drop, {standing clip: its mean sole offset}] (only offsets of half a percent and up).
                const clipRows = {};
                for (const [name, c] of Object.entries(feet.clips)) if (c.sole && STANDING.has(name) && Math.abs(c.sole[0]) >= 0.005) clipRows[name] = r4(c.sole[0]);
                const drops = feet.feet.map((g) => g.drop);
                rigs[slug] = [rig.set, r4(feet.restSole), r4(drops.reduce((a, b) => a + b, 0) / Math.max(drops.length, 1)), ...(Object.keys(clipRows).length ? [clipRows] : [])];
            }
        }
        detail[slug] = {near: n && {...n, middle: undefined}, far: f && {...f, middle: undefined}, rig: feet};
    } catch (error) {
        failed++;
        console.warn(`${slug}: ${error instanceof Error ? error.message : error}`);
    }
    done++;
    if (done % 100 === 0) console.log(`${done}/${slugs.length} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
});
// A few at a time (downloads overlap the parsing).
const queue = work.slice();
await Promise.all(Array.from({length: 6}, async () => {
    while (queue.length) await queue.shift()();
}));

if (only) {
    for (const slug of slugs) console.log(slug, JSON.stringify(out[slug]), JSON.stringify(rigs[slug] ?? null));
    process.exit(0);
}
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const json = {
    about: "Generated by scripts/ark-grounding-bases.mjs from the live talking-models bucket (v1/ark near and far, ark-rig v2 else v1). Model units (scaled with the drawn size). models: [near base, near minY, far base, far minY, footprint x0, x1, z0, z1 (at the base, near), 1 when the contacts surround the middle, the near mesh's size x, y, z, the ark.json behaviour plan]. rigs: [the rig set measured, sole (the lowest grip-bone point at rest), drop (the grip bones' pivots' mean height over their soles), {standing clip: the lowest sole's mean offset from rest across its frames, where half a percent or more}].",
    generator: GENERATOR,
    source: sourceHash(),
    models: sorted(out),
    rigs: sorted(rigs)
};
mkdirSync(path.dirname(OUT), {recursive: true});
writeFileSync(OUT, JSON.stringify(json).replace(/\],"/g, '],\n"').replace(/\}\],"/g, '}],\n"') + "\n");
if (value("--detail")) writeFileSync(value("--detail"), JSON.stringify(detail));
console.log(`wrote ${Object.keys(out).length} models, ${Object.keys(rigs).length} rigs (${failed} failed) in ${((Date.now() - started) / 1000).toFixed(0)} s`);
