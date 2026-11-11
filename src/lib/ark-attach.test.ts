/**
 * The scenery's attach points on the asset trees (graphics pass, the leaf shot): every leaf point lies on a drawn
 * leaf of its placed tree, every bark and branch point on its wood, they move with the tree's wind as the shader
 * moves the surface under them, and the rest of the island's points stay where they were.
 */

import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {Matrix4, Quaternion, Ray, Triangle, Vector3, type BufferAttribute, type BufferGeometry, type Mesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import manifest from "@/ark-scene/assets-manifest.json";
import attachData from "@/ark-scene/tree-attach.json";
import {forestFill, rockSquash, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {COTTAGE, DECOR_SINK} from "@/ark-scene/micro-decor";
import {roofHeight} from "@/ark-scene/micro";
import {rock} from "@/ark-scene/vegetation";
import {CAVE_SITE, EVERY_TIER_FILL, allAttachPoints, attachPointAt, attachSway, place, surfaceAt, yawFor, type AttachPoint} from "@/ark-scene/sampler";
import {sampleGround} from "@/ark-scene/world";
import {TREE_CLOSE, assetAttachRows, assetTreePlacement, treeAssetFor, treeLodDistance} from "@/ark-scene/tree-assets";

const root = process.cwd();
const base = path.join(root, "public", (manifest as {base: string}).base);
const assets = (manifest as unknown as {assets: Record<string, {lods: Array<{level: string; file: string}>}>}).assets;
const data = attachData as unknown as {generator: number; source: string; assets: Record<string, unknown[]>};

type Tri = {tri: Triangle; ids: [number, number, number]; leafy: boolean; min: Vector3; max: Vector3};
type Tree = {tris: Tri[]; wind: BufferAttribute; position: BufferAttribute};

async function loadTree(id: string): Promise<Tree> {
    const lod = assets[id].lods.find((l) => l.level === "lod0")!;
    const buf = readFileSync(path.join(base, lod.file));
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise<{scene: {traverse: (f: (o: unknown) => void) => void}}>((resolve, reject) =>
        loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "", resolve as never, reject));
    let geometry: BufferGeometry | null = null;
    gltf.scene.traverse((object) => {
        if (!geometry && (object as Mesh).isMesh) geometry = (object as Mesh).geometry as BufferGeometry;
    });
    const g = geometry as unknown as BufferGeometry;
    const P = g.getAttribute("position") as BufferAttribute;
    const W = g.getAttribute("color_1") as BufferAttribute;
    const index = g.index!;
    const v = (i: number) => new Vector3(P.getX(i), P.getY(i), P.getZ(i));
    const tris: Tri[] = [];
    for (let t = 0; t < index.count / 3; t++) {
        const ids: [number, number, number] = [index.getX(3 * t), index.getX(3 * t + 1), index.getX(3 * t + 2)];
        const tri = new Triangle(v(ids[0]), v(ids[1]), v(ids[2]));
        const min = tri.a.clone().min(tri.b).min(tri.c);
        const max = tri.a.clone().max(tri.b).max(tri.c);
        // Leaves flutter (COLOR_1 z, or a leaf phase in w); wood has neither.
        const leafy = ids.some((i) => W.getZ(i) > 0.002 || W.getW(i) > 0.002);
        tris.push({tri, ids, leafy, min, max});
    }
    return {tris, wind: W, position: P};
}

function nearest(tree: Tree, p: Vector3, leafy: boolean): {d: number; t: Tri; point: Vector3} {
    let best: {d: number; t: Tri; point: Vector3} | null = null;
    const q = new Vector3();
    for (const t of tree.tris) {
        if (t.leafy !== leafy) continue;
        // Skip a triangle whose box is further off than the best so far.
        const dx = Math.max(t.min.x - p.x, 0, p.x - t.max.x);
        const dy = Math.max(t.min.y - p.y, 0, p.y - t.max.y);
        const dz = Math.max(t.min.z - p.z, 0, p.z - t.max.z);
        if (best && Math.hypot(dx, dy, dz) > best.d) continue;
        t.tri.closestPointToPoint(p, q);
        const d = q.distanceTo(p);
        if (!best || d < best.d) best = {d, t, point: q.clone()};
    }
    return best!;
}

/** The asset-tree vertex shader's wind, transcribed line for line (asset-trees.ts windMaterial), in asset space. */
function shaderSway(local: Vector3, w: [number, number, number, number], rootAt: Vector3, time: number, wind: {x: number; y: number}): Vector3 {
    const gust = Math.hypot(wind.x, wind.y);
    const along = {x: wind.x / Math.max(gust, 1e-3), y: wind.y / Math.max(gust, 1e-3)};
    const phase = w[1] * 6.2831853;
    const wave = Math.sin(time * 1.25 + phase + rootAt.x * 0.19 + rootAt.z * 0.15) + 0.4 * Math.sin(time * 2.6 + phase * 1.7 + rootAt.x * 0.4);
    const bend = w[0] * (0.25 + 0.06 * Math.max(local.y, 0));
    const out = new Vector3(along.x, 0, along.y).multiplyScalar((0.35 + 0.65 * wave) * bend * 0.09 * gust);
    const leaf = w[3] * 6.2831853;
    out.add(new Vector3(Math.sin(time * 7.1 + leaf), 0.6 * Math.sin(time * 6.3 + leaf * 1.3), Math.cos(time * 6.7 + leaf)).multiplyScalar(w[2] * 0.025 * (0.4 + gust)));
    return out;
}

const hostItem = (host: string): DecorItem & {rank?: number} => (host.startsWith("decor") ? worldDecor()[Number(host.slice(5))] : forestFill()[Number(host.slice(4))]);
const treePoints = () => allAttachPoints().filter((point) => point.wind);

test("attach: tree-attach.json is built from today's attach.json and lod0 trees (else run node scripts/ark-tree-attach.mjs)", () => {
    const hash = createHash("sha256");
    hash.update(`generator ${data.generator}\n`);
    const attachFile = path.join(base, "trees", "attach.json");
    hash.update(readFileSync(attachFile));
    const attach = JSON.parse(readFileSync(attachFile, "utf8")) as Record<string, unknown>;
    for (const id of Object.keys(attach).sort()) {
        const lod = assets[id]?.lods.find((l) => l.level === "lod0");
        if (lod) hash.update(readFileSync(path.join(base, lod.file)));
    }
    assert.equal(data.source, hash.digest("hex").slice(0, 32), "tree-attach.json is stale: run node scripts/ark-tree-attach.mjs");
});

test("attach: the trees' points sit on the trees as the renderer places them, only on trees every tier draws", () => {
    const points = treePoints();
    assert.ok(points.length > 4000, `${points.length} tree points`);
    const byTag: Record<string, number> = {};
    for (const point of points) byTag[point.tag] = (byTag[point.tag] ?? 0) + 1;
    assert.ok(byTag.leaf > 1500 && byTag.bark > 1000 && byTag.branch > 1000, JSON.stringify(byTag));
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    for (const point of points) {
        const item = hostItem(point.host);
        // Every tier draws it: a decor tree, or forest fill within the low tier's share.
        if (item.rank !== undefined) assert.ok(item.rank <= EVERY_TIER_FILL, `${point.id} on fill the low tier leaves out`);
        const asset = treeAssetFor(item)!;
        assert.equal(point.asset, asset.id, point.id);
        // asset-trees.ts's own instance matrix, composed here from the decor item.
        const matrix = new Matrix4().compose(position.set(item.x, item.y - DECOR_SINK, item.z), rotation.setFromAxisAngle(new Vector3(0, 1, 0), item.rotation), scale.setScalar(asset.scale));
        const w = point.wind!;
        const world = new Vector3(w.local.x, w.local.y, w.local.z).applyMatrix4(matrix);
        assert.ok(world.distanceTo(new Vector3(point.position.x, point.position.y, point.position.z)) < 1e-6, `${point.id} placed off its tree`);
        // And its id names one of the asset's own points.
        const n = Number(point.id.split(":")[2]);
        const rows = assetAttachRows(asset.id).filter((row) => row[0] === point.tag);
        const row = rows[n];
        assert.ok(row && Math.abs(row[1] - w.local.x) < 1e-9 && Math.abs(row[2] - w.local.y) < 1e-9 && Math.abs(row[3] - w.local.z) < 1e-9, point.id);
    }
    // index.ts draws the fill up to TIER_SETTINGS.low.fill on the low tier: the same share.
    const index = readFileSync(path.join(root, "src/ark-scene/index.ts"), "utf8");
    const low = /low:\s*\{[^}]*fill:\s*([\d.]+)/.exec(index);
    assert.equal(Number(low?.[1]), EVERY_TIER_FILL);
});

test("attach: every leaf point lies on a drawn leaf, every bark and branch point on the tree's wood (lod0, within 4 mm)", async () => {
    for (const id of Object.keys(data.assets).sort()) {
        const rows = assetAttachRows(id);
        if (!rows.length) continue;
        const tree = await loadTree(id);
        for (const row of rows) {
            const [tag, px, py, pz, nx, ny, nz] = row;
            // Hollows are the mouth of a hole, not a surface: their own test below.
            if (tag === "tree_hollow") continue;
            const p = new Vector3(px, py, pz);
            const on = nearest(tree, p, tag === "leaf");
            assert.ok(on.d < 0.004, `${id} ${tag} ${on.d.toFixed(4)} m off its ${tag === "leaf" ? "leaf" : "wood"}`);
            const normal = new Vector3(nx, ny, nz);
            assert.ok(Math.abs(normal.length() - 1) < 0.01, `${id} ${tag} normal`);
            // The surface under it faces the way its up does (either side of a sheet leaf).
            const face = on.t.tri.getNormal(new Vector3());
            assert.ok(Math.abs(face.dot(normal)) > (tag === "leaf" ? 0.5 : 0.2), `${id} ${tag} sits across its surface (${face.dot(normal).toFixed(2)})`);
            if (tag === "leaf" || tag === "branch") assert.ok(ny >= 0.45, `${id} ${tag} faces the sky`);
            // Its forward runs along the surface.
            const forward = new Vector3(row[7], row[8], row[9]);
            assert.ok(Math.abs(forward.dot(normal)) < 0.02, `${id} ${tag} forward leaves the surface`);
            // The wind weights are the drawn surface's own, there.
            const bary = on.t.tri.getBarycoord(on.point, new Vector3())!;
            const w = [0, 1, 2, 3].map((k) => {
                const get = (i: number) => [tree.wind.getX(i), tree.wind.getY(i), tree.wind.getZ(i), tree.wind.getW(i)][k];
                return bary.x * get(on.t.ids[0]) + bary.y * get(on.t.ids[1]) + bary.z * get(on.t.ids[2]);
            });
            for (let k = 0; k < 4; k++) assert.ok(Math.abs(w[k] - (row[12 + k] as number)) < 0.02, `${id} ${tag} wind weight ${k}: ${w[k].toFixed(3)} vs ${row[12 + k]}`);
        }
    }
});

test("attach: an animal on a leaf moves with the leaf (the CPU sway is the shader's, at the surface under it)", async () => {
    const points = treePoints().filter((point) => point.tag === "leaf" || point.tag === "bark");
    const sample = points.filter((_, i) => i % 23 === 0);
    assert.ok(sample.length > 50);
    const trees = new Map<string, Tree>();
    const winds = [{x: 0.6, y: 0.3}, {x: -1.9, y: 2.4}, {x: 0, y: 0}];
    let biggest = 0;
    for (const point of sample) {
        const id = point.asset!;
        if (!trees.has(id)) trees.set(id, await loadTree(id));
        const tree = trees.get(id)!;
        const w = point.wind!;
        const local = new Vector3(w.local.x, w.local.y, w.local.z);
        const on = nearest(tree, local, point.tag === "leaf");
        const bary = on.t.tri.getBarycoord(on.point, new Vector3())!;
        const rootAt = new Vector3(w.root.x, w.root.y, w.root.z);
        for (const time of [0, 3.7, 41.2]) {
            for (const wind of winds) {
                // The shader moves each of the triangle's corners; the surface under the animal moves by their mix.
                const moved = new Vector3();
                on.t.ids.forEach((vi, k) => {
                    const corner = new Vector3(tree.position.getX(vi), tree.position.getY(vi), tree.position.getZ(vi));
                    const weights: [number, number, number, number] = [tree.wind.getX(vi), tree.wind.getY(vi), tree.wind.getZ(vi), tree.wind.getW(vi)];
                    moved.addScaledVector(shaderSway(corner, weights, rootAt, time, wind), [bary.x, bary.y, bary.z][k]);
                });
                // Into the world: the instance's turn and scale.
                moved.applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), w.rotation)).multiplyScalar(w.scale);
                const sway = attachSway(point, time, wind);
                const at = attachPointAt(point, time, wind);
                biggest = Math.max(biggest, moved.length());
                assert.ok(moved.distanceTo(new Vector3(sway.x, sway.y, sway.z)) < 0.002, `${point.id} t=${time}: ${moved.toArray()} vs ${JSON.stringify(sway)}`);
                assert.ok(Math.abs(at.x - point.position.x - sway.x) < 1e-9 && Math.abs(at.y - point.position.y - sway.y) < 1e-9);
            }
        }
    }
    // A storm's sway is centimetres, more than a small animal's own length: it must follow.
    assert.ok(biggest > 0.02, `largest sway ${biggest}`);
    // The transcription above is of these lines: if the shader changes, update treeSway (tree-assets.ts) with it.
    const shader = readFileSync(path.join(root, "src/ark-scene/asset-trees.ts"), "utf8");
    for (const line of [
        "float wave = sin(arkTime * 1.25 + phase + root.x * 0.19 + root.z * 0.15) + 0.4 * sin(arkTime * 2.6 + phase * 1.7 + root.x * 0.4);",
        "float bend = color_1.x * (0.25 + 0.06 * max(transformed.y, 0.0));",
        "transformed.xz += along * (0.35 + 0.65 * wave) * bend * 0.09 * gust;",
        "float leaf = color_1.w * 6.2831853;",
        "transformed += vec3(sin(arkTime * 7.1 + leaf), 0.6 * sin(arkTime * 6.3 + leaf * 1.3), cos(arkTime * 6.7 + leaf)) * color_1.z * 0.025 * (0.4 + gust);"
    ]) assert.ok(shader.includes(line), `asset-trees.ts wind changed: ${line}`);
    // Still hosts hold still.
    const rock = allAttachPoints().find((point) => point.tag === "rock_face")!;
    assert.deepEqual(attachSway(rock, 3, {x: 1, y: 1}), {x: 0, y: 0, z: 0});
});

test("attach: a model set on a point (up along its normal, turned by its yaw) faces along the leaf, trunk or branch", () => {
    const up = new Vector3(0, 1, 0);
    for (const point of treePoints()) {
        const n = new Vector3(point.normal.x, point.normal.y, point.normal.z);
        const q = new Quaternion().setFromUnitVectors(up, n).multiply(new Quaternion().setFromAxisAngle(up, point.yaw));
        const forward = new Vector3(0, 0, 1).applyQuaternion(q);
        const want = new Vector3(point.forward!.x, point.forward!.y, point.forward!.z).normalize();
        assert.ok(forward.distanceTo(want) < 0.01, `${point.id} faces ${forward.toArray()} not ${want.toArray()}`);
        assert.ok(new Vector3(0, 1, 0).applyQuaternion(q).distanceTo(n) < 1e-6);
    }
    // Straight down (three's half turn about z) and the plain cases.
    assert.ok(Math.abs(yawFor({x: 0, y: 1, z: 0}, {x: 1, y: 0, z: 0}) - Math.PI / 2) < 1e-9);
    const q = new Quaternion().setFromUnitVectors(up, new Vector3(0, -1, 0)).multiply(new Quaternion().setFromAxisAngle(up, yawFor({x: 0, y: -1, z: 0}, {x: 0.6, y: 0, z: 0.8})));
    assert.ok(new Vector3(0, 0, 1).applyQuaternion(q).distanceTo(new Vector3(0.6, 0, 0.8)) < 1e-6);
});

test("attach: a camera close on a leaf draws that tree at full detail, the level its points are on", () => {
    for (const point of treePoints().filter((p) => p.tag === "leaf")) {
        const placed = assetTreePlacement(hostItem(point.host))!;
        const camera = {x: point.position.x + point.normal.x * 0.9, y: point.position.y + point.normal.y * 0.9, z: point.position.z + point.normal.z * 0.9};
        assert.ok(treeLodDistance(placed, camera) < TREE_CLOSE, `${point.id}: lod distance ${treeLodDistance(placed, camera).toFixed(2)}`);
    }
});

test("attach: every hollow point is the mouth of a hole drawn in its tree's trunk, opening outward", async () => {
    const hollows = treePoints().filter((point) => point.tag === "tree_hollow");
    assert.ok(hollows.length >= 20, `${hollows.length} hollows`);
    const trees = new Map<string, Tree>();
    for (const id of Array.from(new Set(hollows.map((point) => point.asset!)))) trees.set(id, await loadTree(id));
    for (const point of hollows) {
        const tree = trees.get(point.asset!)!;
        const w = point.wind!;
        // In the asset's own frame: the normal turned back.
        const c = Math.cos(-w.rotation);
        const s = Math.sin(-w.rotation);
        const n = new Vector3(point.normal.x * c + point.normal.z * s, point.normal.y, -point.normal.x * s + point.normal.z * c);
        const mouth = new Vector3(w.local.x, w.local.y, w.local.z);
        // Into the hole: its dark inside (drawn wood) within its depth; out of it: nothing of the tree for 0.5 m.
        const inward = new Ray(mouth, n.clone().negate());
        const outward = new Ray(mouth.clone().addScaledVector(n, 0.01), n);
        const hit = new Vector3();
        let inside = Infinity;
        let blocked = false;
        for (const t of tree.tris) {
            if (!t.leafy && inward.intersectTriangle(t.tri.a, t.tri.b, t.tri.c, false, hit)) inside = Math.min(inside, hit.distanceTo(mouth));
            if (outward.intersectTriangle(t.tri.a, t.tri.b, t.tri.c, false, hit) && hit.distanceTo(mouth) < 0.5) blocked = true;
        }
        assert.ok(inside <= point.depth! / point.wind!.scale + 0.01, `${point.id}: no hole behind its mouth (${inside})`);
        assert.ok(!blocked, `${point.id}: its mouth opens into the tree`);
        assert.ok(point.depth! > 0.05 && point.size[1] > 0.05, point.id);
    }
});

test("attach: ledges are steep cliff, mountain and ice ground or the flat tops of big rocks, facing out; the cave's place", () => {
    const ledges = allAttachPoints().filter((point) => point.tag === "ledge");
    const ground = ledges.filter((point) => point.host === "ground");
    const rocks = ledges.filter((point) => point.host !== "ground");
    assert.equal(ground.length, 90);
    assert.ok(rocks.length >= 10, `${rocks.length} rock shelves`);
    for (const point of ledges) {
        assert.equal(point.spot, "rocks");
        assert.ok(point.zone === "seashore" || point.zone === "mountains" || point.zone === "polar", `${point.id} in ${point.zone}`);
        assert.ok(point.normal.y > 0.8, `${point.id} stands on a shelf`);
        const f = point.forward!;
        assert.ok(Math.abs(f.x * point.normal.x + f.y * point.normal.y + f.z * point.normal.z) < 1e-6, point.id);
        assert.ok(Math.abs(yawFor(point.normal, f) - point.yaw) < 1e-6 || Math.abs(Math.abs(yawFor(point.normal, f) - point.yaw) - 2 * Math.PI) < 1e-6, `${point.id} yaw`);
    }
    for (const point of ground) {
        // A sea cliff, or steep ground on the mountain or the ice, facing out of the slope (downhill).
        const surface = surfaceAt(point.position.x, point.position.z);
        const sample = sampleGround(point.position.x, point.position.z);
        assert.ok(Math.abs(point.position.y - sample.height) < 1e-9);
        assert.ok(sample.cliff > 0.45 || 1 - surface.normal.y > 0.1, `${point.id} neither cliff nor steep`);
        assert.ok(point.forward!.x * surface.normal.x + point.forward!.z * surface.normal.z > 0, `${point.id} faces out`);
    }
    // The cave: flat open ground (within 0.3 m over 4.5 m round it), nothing of the decor or the fill within 6.5 m.
    const cave = place("cave");
    assert.equal(cave.x, CAVE_SITE.x);
    assert.ok(cave.facing !== undefined && Math.abs(cave.facing - Math.atan2(-cave.x, -cave.z)) < 1e-9);
    const heights: number[] = [];
    for (let a = 0; a < 12; a++) for (const r of [0, 2.5, 4.5]) heights.push(sampleGround(cave.x + Math.cos(a * 0.5236) * r, cave.z + Math.sin(a * 0.5236) * r).height);
    assert.ok(Math.max(...heights) - Math.min(...heights) <= 0.3, `cave ground spans ${(Math.max(...heights) - Math.min(...heights)).toFixed(2)} m`);
    assert.ok(Math.abs(cave.y - Math.max(...heights) - 0.04) < 1e-9);
    const crowded = [...worldDecor(), ...forestFill()].filter((item) => Math.hypot(item.x - cave.x, item.z - cave.z) < 6.5);
    assert.equal(crowded.length, 0, `decor at the cave: ${crowded.map((item) => item.kind).join(", ")}`);
});

test("attach: the eave points hang just under the roof the cottage draws (micro-scene.ts), on all four sides", () => {
    const c = COTTAGE;
    const eaves = allAttachPoints().filter((point) => point.tag === "house_eave");
    assert.equal(eaves.length, 4);
    for (const point of eaves) {
        const lx = point.position.x - c.x;
        const lz = point.position.z - c.z;
        // Under the roof: inside its overhang.
        assert.ok(Math.abs(lx) <= c.width / 2 + c.overhang && Math.abs(lz) <= c.depth / 2 + c.overhang, point.id);
        // Out past the walls.
        assert.ok(Math.abs(lx) > c.width / 2 || Math.abs(lz) > c.depth / 2, `${point.id} is inside the house`);
        // The roof's underside right above it (the slabs fall from the ridge: micro.ts roofHeight), 4 mm up.
        const underside = c.floor + roofHeight(Math.abs(lz));
        assert.ok(underside - point.position.y > 0.001 && underside - point.position.y < 0.01, `${point.id}: ${(underside - point.position.y).toFixed(3)} m under the roof`);
        assert.ok(point.normal.y < -0.7, `${point.id} hangs`);
    }
});

test("attach: every rock point lies on the rock vegetation.ts draws (its flat faces, within 3 mm), facing out of it", () => {
    const meshes = [0, 1, 2].map((variant) => rock(variant).getAttribute("position") as BufferAttribute);
    const decor = worldDecor();
    const points = allAttachPoints().filter((point) => point.tag === "rock_face");
    assert.ok(points.length > 500);
    let worst = 0;
    for (const point of points) {
        const item = decor[Number(point.host.slice(5))];
        // vegetation.ts's own instance matrix for a rock.
        const matrix = new Matrix4().compose(new Vector3(item.x, item.y - DECOR_SINK, item.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), item.rotation), new Vector3(item.scale, item.scale * rockSquash(item), item.scale));
        const P = meshes[item.variant % 3];
        const p = new Vector3(point.position.x, point.position.y, point.position.z);
        let best = Infinity;
        let face = new Vector3();
        const q = new Vector3();
        for (let i = 0; i < P.count; i += 3) {
            const tri = new Triangle(new Vector3().fromBufferAttribute(P, i).applyMatrix4(matrix), new Vector3().fromBufferAttribute(P, i + 1).applyMatrix4(matrix), new Vector3().fromBufferAttribute(P, i + 2).applyMatrix4(matrix));
            tri.closestPointToPoint(p, q);
            const d = q.distanceTo(p);
            if (d < best) {
                best = d;
                face = tri.getNormal(new Vector3());
            }
        }
        worst = Math.max(worst, best);
        assert.ok(best < 0.003, `${point.id} is ${best.toFixed(4)} m off its rock`);
        assert.ok(Math.abs(face.dot(new Vector3(point.normal.x, point.normal.y, point.normal.z))) > 0.95, `${point.id} normal`);
        // Out of the rock: away from its middle.
        const middle = new Vector3(item.x, item.y - DECOR_SINK + 0.18 * item.scale * rockSquash(item), item.z);
        assert.ok(p.clone().sub(middle).dot(new Vector3(point.normal.x, point.normal.y, point.normal.z)) > 0, `${point.id} faces into its rock`);
    }
    assert.ok(worst > 0.0015, "points sit just off the face (2 mm)");
});

test("attach: every other point on the island is where it was before the asset trees (ids and positions)", () => {
    const at = (id: string) => allAttachPoints().find((point) => point.id === id) as AttachPoint;
    const close = (point: AttachPoint, x: number, y: number, z: number) => Math.hypot(point.position.x - x, point.position.y - y, point.position.z - z) < 1e-9;
    assert.ok(close(at("house_wall:house:22"), 13.61, 2.682718591185397, 52.698830182105304));
    // (Rock points moved by millimetres to centimetres onto the drawn faces; their ids stay.)
    assert.ok(Math.hypot(at("rock_face:decor261:3").position.x + 47.75783732649006, at("rock_face:decor261:3").position.z - 64.09430146821144) < 0.05);
    assert.ok(close(at("leaf_litter:ground:0"), -45.331413857638836, 9.989909153851938, 4.594026831910014));
    assert.ok(close(at("canopy_perch:decor682:0"), -34.58297404572754, 10.50234125028666, 29.229413565007295));
    const ids = allAttachPoints().map((point) => point.id);
    assert.equal(new Set(ids).size, ids.length, "ids are unique");
});
