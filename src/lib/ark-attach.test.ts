/**
 * The scenery's attach points on the asset trees (graphics pass, the leaf shot): every leaf point lies on a drawn
 * leaf of its placed tree, every bark and branch point on its wood, they move with the tree's wind as the shader
 * moves the surface under them, and the rest of the island's points stay where they were.
 */

import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {Matrix4, Quaternion, Ray, Triangle, Vector3, type BufferAttribute, type BufferGeometry, type Mesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import manifest from "@/ark-scene/assets-manifest.json";
import attachData from "@/ark-scene/tree-attach.json";
import {forestFill, rockSquash, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {COTTAGE, DECOR_SINK, GARDEN_POND, zoneLamp} from "@/ark-scene/micro-decor";
import {rockAssetFor, rockAttachPoints} from "@/ark-scene/rock-assets";
import {defaultHomePlots, fencePostTops as homeFencePosts} from "@/ark-scene/props/home-layout";
import {floorPlacements} from "@/ark-scene/floor-assets";
import {roofHeight, ROOF_THICKNESS} from "@/ark-scene/micro";
import {rock} from "@/ark-scene/vegetation";
import {CAVE_SITE, EVERY_TIER_FILL, drawnRockPoint, setAttachHomePlots, allAttachPoints, attachPointAt, attachSway, fencePostTops, limbLoad, place, prepareAttachPoints, resetAttachPoints, surfaceAt, yawFor, type AttachPoint} from "@/ark-scene/sampler";
import {canopyTree, limbAt} from "@/ark-scene/micro-decor";
import {LAKE, sampleGround, ZONE_SITES} from "@/ark-scene/world";
import {snowCover, snowLine} from "@/ark-scene/snow";
import {TREE_CLOSE, floorLogTops, assetAttachRows, assetTreePlacement, treeAssetFor, treeLodDistance} from "@/ark-scene/tree-assets";
import {fillDrawnOnEveryTier} from "@/ark-scene/tree-pick";

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
    const wave = Math.sin(time * 1.24617 + phase + rootAt.x * 0.19 + rootAt.z * 0.15) + 0.4 * Math.sin(time * 2.59705 + phase * 1.7 + rootAt.x * 0.4);
    const bend = w[0] * (0.25 + 0.06 * Math.max(local.y, 0));
    const out = new Vector3(along.x, 0, along.y).multiplyScalar((0.35 + 0.65 * wave) * bend * 0.09 * gust);
    const leaf = w[3] * 6.2831853;
    out.add(new Vector3(Math.sin(time * 7.1 + leaf), 0.6 * Math.sin(time * 6.30413 + leaf * 1.3), Math.cos(time * 6.70206 + leaf)).multiplyScalar(w[2] * 0.025 * (0.4 + gust)));
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
    // And the floor set's logs (their tops).
    const floorFile = path.join(base, "floor", "attach.json");
    hash.update(readFileSync(floorFile));
    const floor = JSON.parse(readFileSync(floorFile, "utf8")) as Record<string, Array<{tag: string}>>;
    for (const id of Object.keys(floor).filter((k) => k.startsWith("log-") && assets[k]?.lods.some((l) => l.level === "lod0") && floor[k].some((row) => row.tag === "log_top")).sort()) {
        hash.update(readFileSync(path.join(base, assets[id].lods.find((l) => l.level === "lod0")!.file)));
    }
    assert.equal(data.source, hash.digest("hex").slice(0, 32), "tree-attach.json is stale: run node scripts/ark-tree-attach.mjs");
});

test("attach: the trees' points sit on the trees as the renderer places them, only on trees every tier draws", () => {
    const points = treePoints();
    assert.ok(points.length > 4000, `${points.length} tree points`);
    const byTag: Record<string, number> = {};
    for (const point of points) byTag[point.tag] = (byTag[point.tag] ?? 0) + 1;
    assert.ok(byTag.leaf > 1500 && byTag.bark > 800 && byTag.branch > 1000, JSON.stringify(byTag));
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    for (const point of points) {
        const item = hostItem(point.host);
        // Every tier draws it: a decor tree, or forest fill within the low tier's share (the woods': WOODS_FILL, decision 33).
        if (item.rank !== undefined) assert.ok(fillDrawnOnEveryTier(item, EVERY_TIER_FILL), `${point.id} on fill the low tier leaves out`);
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
            // Hollows are the mouth of a hole, and limbs and hang points have their own tests below.
            if (tag === "tree_hollow" || tag === "limb" || tag === "canopy_hang") continue;
            const p = new Vector3(px, py, pz);
            const on = nearest(tree, p, tag === "leaf");
            assert.ok(on.d < 0.004, `${id} ${tag} ${on.d.toFixed(4)} m off its ${tag === "leaf" ? "leaf" : "wood"}`);
            const normal = new Vector3(nx, ny, nz);
            assert.ok(Math.abs(normal.length() - 1) < 0.01, `${id} ${tag} normal`);
            // The surface under it faces the way its up does (either side of a sheet leaf).
            const face = on.t.tri.getNormal(new Vector3());
            assert.ok(Math.abs(face.dot(normal)) > (tag === "leaf" ? 0.4 : 0.2), `${id} ${tag} sits across its surface (${face.dot(normal).toFixed(2)})`);
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
        "float wave = sin(arkTime * 1.24617 + phase + root.x * 0.19 + root.z * 0.15) + 0.4 * sin(arkTime * 2.59705 + phase * 1.7 + root.x * 0.4);",
        "float bend = color_1.x * (0.25 + 0.06 * max(transformed.y, 0.0));",
        "transformed.xz += along * (0.35 + 0.65 * wave) * bend * 0.09 * gust;",
        "float leaf = color_1.w * 6.2831853;",
        "transformed += vec3(sin(arkTime * 7.1 + leaf), 0.6 * sin(arkTime * 6.30413 + leaf * 1.3), cos(arkTime * 6.70206 + leaf)) * color_1.z * 0.025 * (0.4 + gust);"
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

test("attach: drawnRockPoint lies on the rock vegetation.ts draws (its flat faces, within 3 mm), facing out of it (the rock points where the rock set is missing)", () => {
    const meshes = [0, 1, 2].map((variant) => rock(variant).getAttribute("position") as BufferAttribute);
    const decor = worldDecor();
    const points: AttachPoint[] = [];
    decor.forEach((item, i) => {
        if (item.kind !== "rock") return;
        for (let k = 0; k < 4; k++) {
            const a = k * 1.9 + i;
            const up = 0.1 + 0.2 * k;
            const p = drawnRockPoint(item, Math.sin(a) * (1 - up), up, Math.cos(a) * (1 - up));
            points.push({id: `rock:${i}:${k}`, host: `decor${i}`, position: {x: p.x + p.nx * 0.002, y: p.y + p.ny * 0.002, z: p.z + p.nz * 0.002}, normal: {x: p.nx, y: p.ny, z: p.nz}} as AttachPoint);
        }
    });
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

/**
 * What each host's points are made from (the scenery generation): its decor or fill item, its asset (tree or rock,
 * with that asset's data), and the ground round it; the cottage's measures; a lamp's place; the pond and the lake;
 * for the ground's own points, the terrain itself. Each host draws from its own seeded stream (sampler.ts), so its
 * points depend on nothing else.
 */
function hostFingerprints(hosts: string[]): Map<string, string> {
    const sha = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
    const mm = (value: number) => Math.round(value * 1000);
    const patch = (x: number, z: number, reach: number) => {
        const heights: number[] = [];
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) heights.push(mm(sampleGround(x + (i * reach) / 2, z + (j * reach) / 2).height));
        return heights;
    };
    const decor = worldDecor();
    const fill = forestFill();
    const out = new Map<string, string>();
    let terrain: string | null = null;
    for (const host of hosts) {
        let key: unknown;
        const item = host.startsWith("decor") ? decor[Number(host.slice(5))] : host.startsWith("fill") ? fill[Number(host.slice(4))] : null;
        if (item) {
            const tree = assetTreePlacement(item);
            const rockAt = rockAssetFor(item);
            key = {item, tree, trees: tree ? assetAttachRows(tree.id) : null, rock: rockAt, rockRows: rockAt ? rockAttachPoints(rockAt) : null, ground: patch(item.x, item.z, Math.max(3 * item.scale, 2))};
        } else if (host === "house") key = COTTAGE;
        else if (host.startsWith("lamp-")) key = zoneLamp(host.slice(5) as never);
        else if (host === "garden-pond") key = GARDEN_POND;
        else if (host === "paddock" || host === "picket") key = homeFencePosts(defaultHomePlots()).filter((post) => post.fence === host);
        else if (host.startsWith("floor")) {
            const placed = floorPlacements()[Number(host.slice(5))];
            key = {placed, rows: placed ? floorLogTops(placed.id) : null};
        }
        else if (host === "lake") key = LAKE;
        else if (host === "ground") {
            if (!terrain) {
                const grid: unknown[] = [];
                for (let x = -110; x <= 110; x += 4) for (let z = -110; z <= 110; z += 4) {
                    const g = sampleGround(x, z);
                    grid.push([mm(g.height), Object.entries(g.weights).map(([k, v]) => [k, mm(v ?? 0)]), mm(g.cliff), mm(g.land), mm(g.river), mm(g.inland)]);
                }
                terrain = sha(grid);
            }
            key = terrain;
        } else key = host;
        out.set(host, sha(key));
    }
    return out;
}

/** Each host's points, as a hash of their ids, positions, normals and headings (to 0.1 mm). */
function hostPoints(): Map<string, string> {
    const by = new Map<string, string[]>();
    const r = (value: number) => (Math.round(value * 1e4) / 1e4).toFixed(4);
    for (const p of allAttachPoints()) {
        const list = by.get(p.host) ?? [];
        list.push(`${p.id} ${r(p.position.x)} ${r(p.position.y)} ${r(p.position.z)} ${r(p.normal.x)} ${r(p.normal.y)} ${r(p.normal.z)} ${r(p.yaw)}`);
        by.set(p.host, list);
    }
    const out = new Map<string, string>();
    by.forEach((list, host) => out.set(host, createHash("sha1").update(list.sort().join("\n")).digest("hex").slice(0, 16)));
    return out;
}

const BASELINE = path.join(root, "src/lib/ark-attach-baseline.json");

test("attach: no point moves unless the scenery it stands on changed (a baseline keyed to each host's scenery)", (t) => {
    const ids = allAttachPoints().map((point) => point.id);
    assert.equal(new Set(ids).size, ids.length, "ids are unique");
    const points = hostPoints();
    const prints = hostFingerprints(Array.from(points.keys()));
    // Re-record after a deliberate change to the points themselves: ARK_ATTACH_BASELINE=write npx tsx --test src/lib/ark-attach.test.ts
    // After a scenery change, record only the hosts whose scenery changed (and new ones), keeping every other host's
    // record as it was (and failing as usual if one of those moved): ARK_ATTACH_BASELINE=update.
    if (process.env.ARK_ATTACH_BASELINE === "update") {
        const old = JSON.parse(readFileSync(BASELINE, "utf8")) as {about: string; hosts: Record<string, [string, string]>};
        const stale = Object.entries(old.hosts).filter(([host, [print, hash]]) => points.has(host) && prints.get(host) === print && points.get(host) !== hash).map(([host]) => host);
        assert.deepEqual(stale.slice(0, 12), [], "these hosts moved though their scenery did not: not recorded");
        const hosts: Record<string, [string, string]> = {};
        Array.from(points.keys()).sort().forEach((host) => (hosts[host] = old.hosts[host] && old.hosts[host][0] === prints.get(host) ? old.hosts[host] : [prints.get(host)!, points.get(host)!]));
        writeFileSync(BASELINE, JSON.stringify({about: old.about, hosts}, null, 0).replace(/\],"/g, '],\n"') + "\n");
        return;
    }
    if (process.env.ARK_ATTACH_BASELINE === "write") {
        const hosts: Record<string, [string, string]> = {};
        Array.from(points.keys()).sort().forEach((host) => (hosts[host] = [prints.get(host)!, points.get(host)!]));
        writeFileSync(BASELINE, JSON.stringify({about: "src/lib/ark-attach.test.ts: per host, [what its points are made from, its points]. Re-record with ARK_ATTACH_BASELINE=write only after a deliberate change to the points.", hosts}, null, 0).replace(/\],"/g, '],\n"') + "\n");
        return;
    }
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as {hosts: Record<string, [string, string]>};
    let checked = 0;
    let rebuilt = 0;
    const moved: string[] = [];
    for (const [host, [print, hash]] of Object.entries(baseline.hosts)) {
        if (!points.has(host)) continue;
        // Its scenery changed (a rock reshaped, the ground under it raised): its points may move, by design.
        if (prints.get(host) !== print) {
            rebuilt++;
            continue;
        }
        checked++;
        if (points.get(host) !== hash) moved.push(host);
    }
    t.diagnostic(`${checked} hosts checked, ${rebuilt} with changed scenery skipped, ${points.size - checked - rebuilt} new`);
    assert.deepEqual(moved.slice(0, 12), [], `${moved.length} hosts' points moved though their scenery did not: a change to the sampler (re-record the baseline only if that was meant)`);
    assert.ok(checked > 100, "the baseline guards almost nothing: re-record it");
});

test("attach: limbs for large climbers lie on thick drawn wood, with the radius a chord through it gives, room, and load", async () => {
    const limbs = allAttachPoints().filter((point) => point.tag === "limb");
    assert.ok(limbs.length > 1000, `${limbs.length} limb points`);
    // Spread over the real forest, not 16 canopy trees.
    const forest = limbs.filter((point) => point.zone === "rainforest" || point.zone === "woodland");
    assert.ok(forest.length > 300 && new Set(forest.map((point) => point.host)).size > 60, `${forest.length} in the forests`);
    assert.ok(limbs.filter((point) => point.radius! >= 0.06).length > 150, "limbs for an orangutan");
    const trees = new Map<string, Tree>();
    for (const point of limbs) {
        assert.ok(!point.asset!.startsWith("palm"), `${point.id} on a palm`);
        assert.ok(point.radius! >= 0.03 && point.normal.y >= 0.6, point.id);
        assert.deepEqual(point.size, [0.15, Math.min(1.6, 24 * point.radius!)]);
        const w = point.wind!;
        assert.equal(point.load, limbLoad(point.radius!, Math.max(Math.hypot(point.position.x - w.root.x, point.position.z - w.root.z), 0.5)));
        assert.ok(point.clearBelow! <= point.position.y - sampleGround(point.position.x, point.position.z).height + 1e-9 && point.clearAbove! > 0, point.id);
    }
    // On the drawn wood, and a chord straight through it (along the normal) about twice the radius: in the asset's frame.
    for (const id of Object.keys(data.assets).sort()) {
        const rows = assetAttachRows(id).filter((row) => row[0] === "limb" || row[0] === "canopy_hang");
        if (!rows.length) continue;
        if (!trees.has(id)) trees.set(id, await loadTree(id));
        const tree = trees.get(id)!;
        for (const row of rows) {
            const [tag, px, py, pz, nx, ny, nz] = row;
            const radius = row[20] as number;
            const p = new Vector3(px, py, pz);
            const on = nearest(tree, p, false);
            assert.ok(on.d < 0.004, `${id} ${tag} ${on.d.toFixed(4)} m off the wood`);
            if (tag === "limb") {
                const n = new Vector3(nx, ny, nz);
                const ray = new Ray(p.clone().addScaledVector(n, -0.006), n.clone().negate());
                let through = Infinity;
                const hit = new Vector3();
                for (const t of tree.tris) if (!t.leafy && ray.intersectTriangle(t.tri.a, t.tri.b, t.tri.c, false, hit)) through = Math.min(through, hit.distanceTo(p));
                assert.ok(Math.abs(through - 2 * radius) < 0.015, `${id} limb chord ${through.toFixed(3)} for radius ${radius}`);
            } else {
                // Hanging under it: the wood just above, nothing of the tree below for its clear drop.
                assert.ok(ny < -0.99);
                const down = new Ray(p.clone().add(new Vector3(0, -0.003, 0)), new Vector3(0, -1, 0));
                const hit = new Vector3();
                for (const t of tree.tris) {
                    if (down.intersectTriangle(t.tri.a, t.tri.b, t.tri.c, false, hit)) assert.ok(hit.distanceTo(p) >= Math.min(row[22] as number, 6) - 0.01, `${id} hang: something ${hit.distanceTo(p).toFixed(2)} m below`);
                }
            }
        }
    }
});

test("attach: hang points are under thick limbs with a clear drop (bats), on the canopy trees and the asset trees", () => {
    const hangs = allAttachPoints().filter((point) => point.tag === "canopy_hang");
    assert.ok(hangs.length > 500, `${hangs.length} hang points`);
    const decor = worldDecor();
    for (const point of hangs) {
        assert.ok(point.normal.y < -0.99 && point.radius! >= 0.03, `${point.id} under a thick limb`);
        assert.ok(point.clearBelow! >= 1.2 && point.clearBelow! <= point.position.y - sampleGround(point.position.x, point.position.z).height + 1e-9, `${point.id} clear below ${point.clearBelow}`);
        if (point.wind) continue;
        // A canopy tree's: 2 mm under the drawn limb (vegetation.ts canopyShape, sunk DECOR_SINK), the perch 2 mm over it.
        const item = decor[Number(point.host.slice(5))];
        const tree = canopyTree(item.variant % 2);
        const k = Number(point.id.split(":")[2]);
        const at = limbAt(tree.limbs[k], tree.base, 0.75);
        const c = Math.cos(item.rotation);
        const sn = Math.sin(item.rotation);
        const axis = {x: item.x + (at.x * c + at.z * sn) * item.scale, y: item.y - DECOR_SINK + at.y * item.scale, z: item.z + (-at.x * sn + at.z * c) * item.scale};
        assert.ok(Math.abs(axis.y - point.radius! - 0.002 - point.position.y) < 1e-9 && Math.hypot(axis.x - point.position.x, axis.z - point.position.z) < 1e-9, point.id);
        // The drawn limb's radius there (its cylinder tapers base → tip over its whole length from the trunk's axis).
        const limb = tree.limbs[k];
        const drawn = (limb.base + (limb.tip - limb.base) * (tree.base * 0.8 + 0.75 * limb.length) / (limb.length + tree.base * 0.8)) * item.scale;
        assert.ok(Math.abs(drawn - point.radius!) < 0.004, `${point.id} radius ${point.radius} drawn ${drawn}`);
        const perch = allAttachPoints().find((other) => other.id === `canopy_perch:${point.host}:${k}`)!;
        assert.ok(Math.abs(perch.position.y - (axis.y + point.radius! + 0.002)) < 1e-9);
        assert.ok(point.clearBelow! > 2, `${point.id} clear below ${point.clearBelow}`);
    }
});

test("attach: fence posts and roof edges sit on what is drawn (fence posts, the cottage's ridge and eaves, the barn's)", () => {
    // Fence posts: vegetation.ts fence(), 0.1 m square posts 1 m tall at ±1.2 m along the segment.
    const veg = readFileSync(path.join(root, "src/ark-scene/vegetation.ts"), "utf8");
    for (const line of ["for (const x of [-1.2, 1.2]) {", "const post = new BoxGeometry(0.1, 1, 0.1);", "post.translate(x, 0.5, 0);"]) assert.ok(veg.includes(line), `fence changed: ${line}`);
    const item = {x: 3, y: 2, z: -1, scale: 1, rotation: 0.6};
    const tops = fencePostTops(item);
    const matrix = new Matrix4().compose(new Vector3(item.x, item.y - DECOR_SINK, item.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), item.rotation), new Vector3(1, 1, 1));
    [-1.2, 1.2].forEach((x, k) => assert.ok(new Vector3(x, 1.002, 0).applyMatrix4(matrix).distanceTo(new Vector3(tops[k].x, tops[k].y, tops[k].z)) < 1e-9));
    for (const point of allAttachPoints().filter((p) => p.tag === "fence_post")) assert.ok(point.normal.y === 1 && point.forward, point.id);
    // The props lane's fences (props/home-layout.ts): every post top it lists, 2 mm up, as fence_post:<fence>:<n>.
    const homeTops = homeFencePosts(defaultHomePlots());
    assert.ok(homeTops.some((post) => post.fence === "paddock") && homeTops.some((post) => post.fence === "picket"));
    for (const post of homeTops) {
        const point = allAttachPoints().find((p) => p.id === `fence_post:${post.fence}:${post.n}`)!;
        assert.ok(point, `fence_post:${post.fence}:${post.n}`);
        assert.ok(Math.abs(point.position.y - post.position.y - 0.002) < 1e-9 && point.position.x === post.position.x && point.position.z === post.position.z);
        assert.deepEqual(point.forward, post.forward);
    }
    // The map's plots in place of today's: the posts follow them (and go back).
    const moved = defaultHomePlots().map((plot) => (plot.kind === "smallholding" ? {...plot, x: plot.x + 5} : plot));
    setAttachHomePlots(moved);
    const paddock = allAttachPoints().filter((p) => p.id.startsWith("fence_post:paddock:"));
    assert.equal(paddock.length, homeFencePosts(moved).filter((post) => post.fence === "paddock").length);
    homeFencePosts(moved).filter((post) => post.fence === "paddock").forEach((post) => assert.ok(paddock.some((p) => p.id === `fence_post:paddock:${post.n}` && p.position.x === post.position.x)));
    setAttachHomePlots(null);
    assert.ok(allAttachPoints().some((p) => p.id === "fence_post:paddock:0" && p.position.x === homeTops.find((post) => post.fence === "paddock")!.position.x));
    // Roofs.
    assert.equal(ROOF_THICKNESS, 0.12);
    for (const line of ["const w = 3.5;", "const d = 2.55;", "const h = 1.9;", "const top = 3.15;"]) assert.ok(veg.includes(line), `barn changed: ${line}`);
    const edges = allAttachPoints().filter((point) => point.tag === "roof_edge");
    assert.equal(edges.filter((point) => point.host === "house").length, 13);
    assert.ok(edges.filter((point) => point.host !== "house").length >= 10, "the barn's");
    const c = COTTAGE;
    for (const point of edges.filter((p) => p.host === "house")) {
        const n = Number(point.id.split(":")[2]);
        const lz = point.position.z - c.z;
        const want = n < 10 ? c.floor + c.wall + c.ridge + ROOF_THICKNESS + 0.05 + 0.002 : c.floor + roofHeight(Math.abs(lz)) + ROOF_THICKNESS + 0.002;
        assert.ok(Math.abs(point.position.y - want) < 1e-9, point.id);
        assert.ok(Math.abs(point.position.x - c.x) <= c.width / 2 + c.overhang, point.id);
        if (n >= 10) assert.ok(Math.abs(Math.abs(lz) - (c.depth / 2 + c.overhang)) < 1e-9, point.id);
    }
});

test("attach: the sliced build gives exactly the synchronous build's points, and a synchronous call mid-way finishes it", async () => {
    const sync = JSON.stringify(allAttachPoints());
    resetAttachPoints();
    const sliced = await prepareAttachPoints(0);
    assert.equal(JSON.stringify(sliced), sync);
    assert.equal(allAttachPoints(), sliced);
    resetAttachPoints();
    const running = prepareAttachPoints(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const now = allAttachPoints();
    assert.equal(JSON.stringify(now), sync);
    assert.equal(await running, now);
});

test("attach: the ground is snow where the terrain shader draws snow, and only there (snow.ts, held to terrain.ts)", () => {
    // snow.ts is written from these lines of the shader: change one, change the other.
    const terrain = readFileSync(path.join(root, "src/ark-scene/terrain.ts"), "utf8");
    for (const line of [
        "const snow = polar * smoothstep(0.3, 1, sample.land);",
        "float snowLine = 27.0 - 12.0 * envSnow;",
        "float snowAt = world.y + 5.0 * (arkFbm(p * 0.05) - 0.5) + 1.2 * (arkNoise(p * 0.6) - 0.5);",
        "float alpine = smoothstep(snowLine - 4.0, snowLine + 2.5, snowAt);",
        "float high = smoothstep(snowLine + 2.0, snowLine + 11.0, snowAt + 6.0 * (0.5 - rib));",
        "float holdTo = mix(0.48, 0.7, high) + 0.16 * (arkNoise(p * 0.11 + 3.7) - 0.5);",
        "alpine *= 1.0 - smoothstep(holdTo, holdTo + 0.28, slopeHere + 0.14 * (arkNoise(p * 0.4) - 0.5));",
        "alpine *= mix(0.8, 1.0, streak) * smoothstep(0.0, 0.25, alpine);",
        "alpine *= 1.0 - smoothstep(0.6, 0.88, rib + 0.2 * (arkNoise(p * 0.35 - 2.1) - 0.5)) * smoothstep(0.36, 0.58, slopeHere) * (1.0 - 0.85 * high);",
        "float steep = smoothstep(0.22, 0.42, slope + (arkNoise(p * 0.5) - 0.5) * 0.12);",
        "float snow = snowW * (1.0 - steep * 0.5 * (1.0 - high));",
        "float snowCover = smoothstep(0.22, 0.6, snow);",
        // (The ledges' patchy snow, now weighted 0.5, is never counted as sure snow here.)
        "float snowW = max(max(vArkLayers.w, alpine), ledgeSnow * 0.5);",
        "float ribOnZ = arkFbm(vec2(world.z * 0.16, world.y * 0.035 + 5.0));",
        "float ribOnX = arkFbm(vec2(world.x * 0.16, world.y * 0.035 + 5.0));",
        "float rib = 1.0 - abs(2.0 * mix(ribOnX, ribOnZ, faceTurn) - 1.0);"
    ]) assert.ok(terrain.includes(line), `terrain.ts snow changed: ${line}`);
    assert.equal(snowLine(0), 27);
    assert.equal(snowLine(1), 15);
    // Over the mountain: snow is sure only well above the line's lowest wander, and none at all well under it.
    const site = ZONE_SITES.mountains;
    let sure = 0;
    let bare = 0;
    for (let x = site.x - 40; x <= site.x + 40; x += 1.5) {
        for (let z = site.z - 46; z <= site.z + 34; z += 1.5) {
            const s = surfaceAt(x, z);
            // (The ice's own snow layer reaches up the mountain's foot: that is drawn snow too.)
            if (s.zone === "polar" || (sampleGround(x, z).weights.polar ?? 0) > 0.02) continue;
            const slope = 1 - s.normal.y;
            if (s.surface === "snow") {
                sure++;
                assert.ok(s.height > snowLine(0) - 4 + 3.1 - 2.5 && slope < 0.98, `snow at ${s.height.toFixed(1)} m, slope ${slope.toFixed(2)}`);
                assert.ok(snowCover(s.height, slope, 0, 0).sure >= 0.5);
            }
            if (s.height < snowLine(0) - 4 - 3.1) {
                bare++;
                assert.ok(s.surface !== "snow" && (s.weights.snow ?? 0) < 0.03, `snow under the line at ${s.height.toFixed(1)} m`);
            }
        }
    }
    assert.ok(sure > 20 && bare > 200, `${sure} sure snow, ${bare} bare`);
    // Steep faces stand bare even up high; full snow cover brings the line 12 m down.
    assert.ok(snowCover(40, 0.95, 0, 0).sure < 0.5 && snowCover(40, 0.05, 0, 0).sure > 0.5);
    assert.ok(snowCover(20, 0.05, 0, 0).mean === 0 && snowCover(20, 0.05, 0, 1).sure > 0.5);
    // The ice is snow, on land.
    assert.ok(snowCover(1, 0.05, 1, 0).sure > 0.5);
});

test("attach: log points lie on top of the fallen logs the forest floor draws (lod0, within 5 mm), facing up and along the log", async () => {
    const logs = allAttachPoints().filter((point) => point.tag === "log");
    const placements = floorPlacements();
    const drawn = placements.filter((p) => p.id.startsWith("log-"));
    if (!drawn.length) return;
    assert.ok(logs.length >= drawn.length, `${logs.length} log points on ${drawn.length} logs`);
    const meshes = new Map<string, Tree>();
    const up = new Vector3(0, 1, 0);
    for (const point of logs) {
        const placed = placements[Number(point.host.slice(5))];
        if (!meshes.has(placed.id)) meshes.set(placed.id, await loadTree(placed.id));
        // asset-rocks.ts's own instance matrix for a floor piece.
        const rotation = new Quaternion().setFromUnitVectors(up, new Vector3(...placed.up)).multiply(new Quaternion().setFromAxisAngle(up, placed.yaw));
        const matrix = new Matrix4().compose(new Vector3(placed.x, placed.y, placed.z), rotation, new Vector3(placed.scale, placed.scale, placed.scale));
        const local = new Vector3(point.position.x, point.position.y, point.position.z).applyMatrix4(matrix.clone().invert());
        const tree = meshes.get(placed.id)!;
        let best = Infinity;
        const q = new Vector3();
        for (const t of tree.tris) {
            t.tri.closestPointToPoint(local, q);
            const d = q.distanceTo(local);
            // (A log's mesh has a few zero-area triangles: no closest point on those.)
            if (Number.isFinite(d)) best = Math.min(best, d);
        }
        assert.ok(best * placed.scale < 0.004, `${point.id} ${(best * placed.scale).toFixed(4)} m off its log`);
        assert.ok(point.normal.y > 0.7 && point.hostKind === "log", point.id);
        const f = point.forward!;
        assert.ok(Math.abs(f.x * point.normal.x + f.y * point.normal.y + f.z * point.normal.z) < 0.01, `${point.id} forward`);
    }
});
