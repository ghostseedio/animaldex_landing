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
import {DrawnSolids, ALL, HARD, solidClass, solidLabel, type SolidHit} from "@/ark-scene/seat/solids";

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
