/**
 * SIG4: the town's solid scenery as invisible prisms for the seat pass (`islands/town/render/solid-proxies.ts`). The
 * town's drawn meshes let their vertex arrays go once on the GPU, so the seat pass (`seat/solids.ts` DrawnSolids) read
 * nothing there; these prisms are made from the town's colliders and must stand for every solid the colliders know (the
 * colliders' ids are matched by prefix, so a new kind of solid id is caught here), be read as built solids, closed and
 * wound outward, and never be drawn.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {Camera, Scene} from "three";
import {townColliderList} from "@/ark-scene/islands/town/colliders";
import {townSolids} from "@/ark-scene/islands/town/solids";
import {launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {ZOO_HOUSE_TYPES} from "@/ark-scene/islands/town/tanks";
import {buildSolidProxies, proxied, SOLID_PROXY_LAYER} from "@/ark-scene/islands/town/render/solid-proxies";
import {DrawnSolids, ALL, HARD, ROCK, solidClass, solidLabel, type SolidHit} from "@/ark-scene/seat/solids";

const open = launchEnclosures();
const origin = {x: 480, z: -320};
const colliders = townColliderList(open, origin);
const chosen = colliders.filter(proxied);

test("a proxy for every town solid whose drawn arrays are let go, none for the zoo batch's own", () => {
    const halls = zooLayout(open).enclosures.filter((e) => ZOO_HOUSE_TYPES.has(e.type)).map((e) => `zoo:${e.id}/`);
    const expected = townSolids(open).filter((s) => {
        if (s.gap > 0 || s.kind === "pond" || (s.kind === "rock") || !(s.top > s.base + 0.02)) return false;
        if (!s.id.startsWith("zoo:")) return true;
        // (An open enclosure's are the zoo's solid batch, kept: only its library logs and climbing trees; a hall's all.)
        return halls.some((h) => s.id.startsWith(h)) || s.kind === "log" && s.id.includes("/log-") || s.kind === "trunk" && s.id.includes("/trunk-");
    });
    assert.ok(expected.length > 100, `${expected.length} solids`);
    assert.deepEqual(new Set(chosen.map((c) => c.id)), new Set(expected.map((s) => `town:${s.id}`)));
    assert.equal(chosen.length, expected.length);
    // (Never a fence, a house or a habitat item: those are other things' colliders; never one a small body goes into.)
    assert.ok(chosen.every((c) => c.gap === 0 && c.kind !== "fence" && !c.id.startsWith("town:habitat:")));
});

test("the zoo's solid batch keeps its positions for the seat pass (the rest of its arrays let go)", async () => {
    const {TownBatch} = await import("@/ark-scene/islands/town/render/batches");
    const {BufferAttribute, BufferGeometry, MeshBasicMaterial} = await import("three");
    const part = new BufferGeometry();
    part.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
    part.setAttribute("color", new BufferAttribute(new Float32Array(9), 3));
    const batch = new TownBatch([{chunk: 0, geometry: part}], new MeshBasicMaterial(), "zoo:solid", {castShadow: false, receiveShadow: false, release: true, keepPositions: true});
    const geometry = batch.mesh.geometry;
    // (What the renderer does once each is on the GPU.)
    for (const name of Object.keys(geometry.attributes)) (geometry.attributes[name] as unknown as {onUploadCallback: () => void}).onUploadCallback.call(geometry.attributes[name]);
    assert.ok(geometry.getAttribute("position").array.length >= 9);
    assert.equal(geometry.getAttribute("color").array.length, 0);
});

test("a ground-cover patch (and a grass tuft) drawn in the zoo's solids is ground to the seat pass, not a closed solid", async () => {
    const {TownBatch} = await import("@/ark-scene/islands/town/render/batches");
    const {Geo} = await import("@/ark-scene/islands/town/render/kit");
    const {patch} = await import("@/ark-scene/islands/town/render/zoo-habitat");
    const {TriGrid} = await import("@/ark-scene/seat/trigrid");
    const {MeshBasicMaterial} = await import("three");
    const plot = {p: (x: number, z: number, lift = 0) => [x, lift, z] as [number, number, number]} as unknown as Parameters<typeof patch>[1];
    // A box under a patch, in one Geo as the zoo draws them: the box is a solid, the patch (12 cm up) ground.
    const geo = new Geo();
    geo.sheets = [];
    geo.box({x: 10, y: 0, z: 0, rot: 0}, 0, 0, 0, 1, 1, 1, [1, 1, 1]);
    const boxTris = geo.triangles;
    patch(geo, plot, 0, 0, 1.5, [0.5, 0.4, 0.3], 7, 0.12);
    assert.deepEqual(geo.sheets, [boxTris, geo.triangles]);
    // (A tuft's grass blades are open sheets too.)
    const {tuft} = await import("@/ark-scene/islands/town/render/zoo-habitat");
    const blades = new Geo();
    blades.sheets = [];
    tuft(blades, plot, 0, 0, 0.5, [0.3, 0.5, 0.2], 3);
    assert.deepEqual(blades.sheets, [0, blades.triangles]);
    const other = new Geo();
    other.box({x: -10, y: 0, z: 0, rot: 0}, 0, 0, 0, 1, 1, 1, [1, 1, 1]);
    const part0 = other.toGeometry();
    const part1 = geo.toGeometry();
    part1.userData.seatGround = Uint32Array.from(geo.sheets);
    const batch = new TownBatch([{chunk: 0, geometry: part0}, {chunk: 1, geometry: part1}], new MeshBasicMaterial(), "zoo:solid", {castShadow: false, receiveShadow: false, release: true, keepPositions: true});
    const grid = new TriGrid(batch.mesh.geometry);
    while (!grid.step(1e6));
    const down = (x: number) => {
        const out: Array<{t: number}> = [];
        grid.cast(x, 5, 0, 0, -10, 0, out as never);
        return out.length;
    };
    assert.equal(down(0), 0, "the patch is not in the solids' grid");
    assert.equal(down(10), 2, "the box beside it is");
    assert.equal(down(-10), 2, "and the other chunk's box");
});

test("the proxies are never drawn and are read as built solids", () => {
    const proxies = buildSolidProxies(colliders, origin);
    assert.equal(proxies.solids, chosen.length);
    assert.ok(proxies.group.children.length > 1, "chunked");
    const camera = new Camera();
    for (const mesh of proxies.group.children as Array<import("three").Mesh>) {
        assert.equal(mesh.layers.test(camera.layers), false, "not on the camera's layers");
        assert.equal(mesh.layers.isEnabled(SOLID_PROXY_LAYER), true);
        assert.equal((mesh.material as import("three").Material).visible, false);
        assert.equal(mesh.castShadow, false);
        assert.equal(mesh.userData.solidProxy, true);
        assert.equal(solidClass(solidLabel(mesh)), HARD);
    }
    // Under 10k triangles for the launch zoo and the town: about 100 KB.
    assert.ok(proxies.triangles < 10000, `${proxies.triangles} triangles`);
    proxies.dispose();
});

test("each proxy is closed and wound outward: a drop meets its top facing up and its bottom facing down", () => {
    const proxies = buildSolidProxies(colliders, origin);
    const scene = new Scene();
    proxies.group.position.set(origin.x, 0, origin.z);
    scene.add(proxies.group);
    scene.updateMatrixWorld(true);
    const solids = new DrawnSolids(scene);
    solids.force = true;
    solids.begin(0);
    let checked = 0;
    for (const c of chosen) {
        const x = c.shape === "segment" ? (c.ax + c.bx) / 2 : c.cx;
        const z = c.shape === "segment" ? (c.az + c.bz) / 2 : c.cz;
        const hits: SolidHit[] = [];
        assert.ok(solids.cast(x, c.y1 + 5, z, 0, -(c.y1 - c.y0 + 10), 0, ALL, hits));
        const own = hits.filter((h) => h.y >= c.y0 - 1e-3 && h.y <= c.y1 + 1e-3).sort((a, b) => b.y - a.y);
        assert.ok(own.length >= 2, `${c.id}: ${own.length} faces`);
        assert.ok(own[0].ny > 0.5, `${c.id}: its top faces up`);
        assert.ok(own[own.length - 1].ny < -0.5, `${c.id}: its bottom faces down`);
        assert.equal(own[0].double, false);
        // (A box's and a post's top is the collider's top; a log's is its own round top, at most the collider's.)
        if (c.shape !== "segment") assert.ok(Math.abs(own[0].y - c.y1) < 1e-3, `${c.id}: top ${own[0].y} vs ${c.y1}`);
        // From inside, straight up: the top seen from inside (its normal along the cast), what the seat's rockExit reads.
        const up: SolidHit[] = [];
        const mid = c.shape === "segment" ? own[own.length - 1].y + (own[0].y - own[own.length - 1].y) / 2 : (c.y0 + c.y1) / 2;
        solids.cast(x, mid, z, 0, c.y1 - mid + 1, 0, ALL, up);
        assert.ok(up.some((h) => h.ny > 0.5), `${c.id}: the top seen from inside`);
        checked++;
    }
    assert.equal(checked, chosen.length);
    proxies.dispose();
});

test("lane SEAT: each building's proxy holds all its walls and roof, reads them only when asked, and is never drawn", async () => {
    // (The house wren, the swift and the jackdaw of the seat audit: in a wall or a roof the town's solid batch had let
    // go of, so the seat pass saw none of it.)
    const {townPlan} = await import("@/ark-scene/islands/town/plan");
    const {buildingSolid} = await import("@/ark-scene/islands/town/roof-perch");
    const {buildingProxy} = await import("@/ark-scene/islands/town/render/solid-proxies");
    const buildings = townPlan().buildings;
    assert.ok(buildings.length > 50, `${buildings.length} buildings`);
    const camera = new Camera();
    const step = Math.max(1, Math.floor(buildings.length / 80));
    let checked = 0;
    for (let i = 0; i < buildings.length; i += step) {
        const mesh = buildingProxy(buildings[i], i);
        assert.equal(mesh.geometry.getAttribute("position").count, 0, "nothing held until asked");
        assert.equal(mesh.layers.test(camera.layers), false);
        assert.equal((mesh.material as import("three").Material).visible, false);
        assert.equal(mesh.userData.solidProxy, true);
        assert.equal(solidClass(solidLabel(mesh)), HARD);
        const box = mesh.geometry.boundingBox!;
        const read = await (mesh.geometry.userData.seatArrays as () => Promise<import("three").BufferGeometry>)();
        const pos = read.getAttribute("position");
        const own = buildingSolid(buildings[i]);
        assert.equal(pos.count * 3, own.length);
        for (let k = 0; k < own.length; k += 3) {
            const [x, y, z] = [own[k], own[k + 1], own[k + 2]];
            assert.ok(x >= box.min.x - 1e-3 && x <= box.max.x + 1e-3 && y >= box.min.y - 1e-3 && y <= box.max.y + 1e-3 && z >= box.min.z - 1e-3 && z <= box.max.z + 1e-3, `building ${i}: (${x}, ${y}, ${z}) outside its proxy's box`);
        }
        checked++;
    }
    assert.ok(checked > 50);
});

test("lane SEAT: the millpond's edge stones are proxied in their chunks; the seat audit's gull's spot is in one", async () => {
    const {buildScenery} = await import("@/ark-scene/islands/town/render/scenery");
    const {triangleProxy} = await import("@/ark-scene/islands/town/render/solid-proxies");
    const {townChunkOf} = await import("@/ark-scene/islands/town/chunks");
    const scenery = buildScenery();
    const stones = scenery.stones!;
    assert.ok(stones && stones.size >= 1);
    // (The yellow-legged gull of the seat audit, town 11 h: resting 27 cm deep in a stone at the pond's edge, town frame.)
    const gull = {x: -38.1, z: -73.47};
    const geo = stones.get(townChunkOf(gull.x, gull.z));
    assert.ok(geo && geo.triangles > 0, "the gull's chunk has its stones");
    const mesh = triangleProxy(geo!.pos, "town:solid-proxy:stones:test");
    assert.equal(mesh.userData.solidProxy, true);
    // (Read as rock: anything stands on it, nothing is inside it.)
    assert.equal(solidClass(solidLabel(mesh)), ROCK);
    assert.equal(mesh.layers.test(new Camera().layers), false);
    const scene = new Scene();
    scene.add(mesh);
    scene.updateMatrixWorld(true);
    const solids = new DrawnSolids(scene);
    solids.force = true;
    solids.begin(0);
    const hits: SolidHit[] = [];
    assert.ok(solids.cast(gull.x, 3, gull.z, 0, -3, 0, ALL, hits), "a stone under the gull's spot");
    const top = Math.max(...hits.map((h) => h.y));
    assert.ok(top > 1.45 && top < 1.65, `its top ${top}`);
});
