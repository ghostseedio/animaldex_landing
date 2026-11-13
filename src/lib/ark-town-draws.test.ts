/**
 * The town performance lane (docs/ark/town-draws-2026-11.md): the town's chunk layers in band batches (every chunk's
 * geometry once, culled, streamed and lit per chunk as before), let in one at a time while the town joins; the batch
 * material's identity transform; empty car sets not drawn; the cars' models and the trees' nearer levels read only as
 * the camera comes near.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {BatchedMesh, BufferGeometry, Material, MeshStandardMaterial, Sphere} from "three";
import {launchEnclosures} from "@/ark-scene/islands/town/areas";
import {TOWN_CHUNK_COUNT} from "@/ark-scene/islands/town/chunks";

async function town() {
    const {buildTownIsland} = await import("@/ark-scene/islands/town/render/index");
    return buildTownIsland({tier: "low", zooOpen: launchEnclosures()});
}

function batchesOf(root: {traverse: (f: (o: unknown) => void) => void}): BatchedMesh[] {
    const found: BatchedMesh[] = [];
    root.traverse((o) => {
        const mesh = o as BatchedMesh;
        if (mesh.isBatchedMesh && mesh.name.startsWith("town:")) found.push(mesh);
    });
    return found;
}

test("the town's chunk layers: one batch per band and layer, every chunk's geometry once, the same triangles and bounds", async () => {
    const {townBuildData} = await import("@/ark-scene/islands/town/render/index");
    const {TOWN_BANDS} = await import("@/ark-scene/islands/town/render/batches");
    const built = await town();
    const batches = batchesOf(built.root);
    assert.ok(batches.length <= TOWN_BANDS * 6, `${batches.length} batches`);
    // (No room left over: the batch's arrays are exactly its chunks'.)
    for (const batch of batches) assert.equal(batch.unusedVertexCount, 0, batch.name);
    const grounds = batches.filter((b) => b.name.startsWith("town:ground:"));
    for (const ground of grounds) {
        assert.equal(ground.unusedIndexCount, 0, ground.name);
        assert.ok(ground.geometry.index!.array instanceof Uint16Array, `${ground.name}: 16-bit indices, as each tile's`);
    }
    // The same triangles per layer as the town's own build data, and each chunk's bounds as its own mesh's.
    const data = townBuildData(launchEnclosures());
    const expected: Record<string, number> = {ground: 0, decal: 0, solid: 0, foliage: 0, glass: 0, panes: 0};
    const solids = new Map<number, BufferGeometry>();
    for (let key = 0; key < TOWN_CHUNK_COUNT; key++) {
        const sc = data.scenery.chunks.get(key);
        const bc = data.perChunk.get(key);
        expected.decal += sc?.decal.triangles ?? 0;
        const solid = bc?.solid ?? sc?.solid;
        expected.solid += solid?.triangles ?? 0;
        if (solid?.triangles) solids.set(key, solid.toGeometry());
        expected.foliage += sc?.foliage?.triangles ?? 0;
        expected.glass += (bc?.glass ?? sc?.glass)?.triangles ?? 0;
        expected.panes += bc ? bc.panes.pos.length / 9 : 0;
    }
    const got: Record<string, number> = {ground: 0, decal: 0, solid: 0, foliage: 0, glass: 0, panes: 0};
    for (const batch of batches) {
        const layer = batch.name.split(":")[1];
        const index = batch.geometry.index;
        got[layer] += (index ? index.count : batch.geometry.getAttribute("position").count) / 3;
    }
    for (const layer of ["decal", "solid", "foliage", "glass", "panes"]) assert.equal(got[layer], expected[layer], layer);
    assert.ok(got.ground > 0);
    const sphere = new Sphere();
    for (const batch of batches.filter((b) => b.name.startsWith("town:solid:"))) {
        const chunks = batch.userData.chunks as number[];
        chunks.forEach((chunk, instance) => {
            const own = solids.get(chunk)!;
            own.computeBoundingSphere();
            batch.getBoundingSphereAt(instance, sphere);
            assert.ok(sphere.center.distanceTo(own.boundingSphere!.center) < 1e-4 && Math.abs(sphere.radius - own.boundingSphere!.radius) < 1e-4, `chunk ${chunk}: its own bounds`);
        });
    }
    built.dispose();
});

test("streaming and the join: a chunk not drawn is a hidden instance; the batches let in one a reveal step", async () => {
    const {townBatchEnabled, TOWN_BANDS} = await import("@/ark-scene/islands/town/render/batches");
    const built = await town();
    const batches = batchesOf(built.root).filter((b) => !b.name.startsWith("town:zoo"));
    built.setDrawn((chunk) => chunk % 2 === 0);
    for (const batch of batches) {
        (batch.userData.chunks as number[]).forEach((chunk, instance) => assert.equal(batch.getVisibleAt(instance), chunk % 2 === 0, `${batch.name} chunk ${chunk}`));
    }
    built.setDrawn(null);
    built.setRevealed(0);
    assert.ok(batches.every((b) => !b.visible), "nothing before the join shows its first chunks");
    built.setRevealed(TOWN_CHUNK_COUNT);
    assert.ok(batches.every((b) => b.visible), "all once the town is whole");
    // (At most one batch's first upload a frame: the reveal shows three chunks a frame.)
    let before = 0;
    for (let shown = 0; shown <= TOWN_CHUNK_COUNT; shown += 3) {
        let on = 0;
        for (let band = 0; band < TOWN_BANDS; band++) for (let order = 0; order < 6; order++) if (townBatchEnabled(band, order, shown)) on++;
        assert.ok(on - before <= 1, `${on - before} let in at ${shown}`);
        before = on;
    }
    assert.equal(before, TOWN_BANDS * 6);
    built.dispose();
});

test("window lighting: each chunk's windows lit in its band's batch, at their own vertices, as each chunk's own mesh had them", async () => {
    const {townBuildData} = await import("@/ark-scene/islands/town/render/index");
    const {windowState} = await import("@/ark-scene/islands/town/render/buildings");
    const built = await town();
    const clock = {day: 20406, hours: 21.5};
    built.update(clock);
    const stats = built.stats();
    assert.ok(stats.windows > 0 && stats.litWindows > 0, "lit windows at night");
    // Each panes batch's aLit as the chunks' own arrays would be, in instance order.
    const data = townBuildData(launchEnclosures());
    let checked = 0;
    for (const batch of batchesOf(built.root).filter((b) => b.name.startsWith("town:panes:"))) {
        const lit = batch.geometry.getAttribute("aLit").array as Float32Array;
        let offset = 0;
        for (const chunk of batch.userData.chunks as number[]) {
            const bc = data.perChunk.get(chunk)!;
            const own = new Float32Array(bc.panes.pos.length / 3);
            for (const w of bc.windows) {
                const state = windowState(w, clock);
                for (let v = w.start; v < w.start + w.count; v++) own[v] = state;
            }
            assert.deepEqual(Array.from(lit.subarray(offset, offset + own.length)), Array.from(own), `chunk ${chunk}`);
            offset += own.length;
            checked++;
        }
        assert.equal(offset, lit.length);
    }
    assert.ok(checked > 20, `${checked} chunks' panes`);
    built.dispose();
});

test("the batch material: the material's own patches and program key, the batching transform the identity, one per material", async () => {
    const {batchedVariant, batchedDepthMaterial} = await import("@/ark-scene/islands/town/render/batches");
    const {townWeather} = await import("@/ark-scene/islands/town/render/materials");
    const material = townWeather(new MeshStandardMaterial({vertexColors: true}), {soak: 0.2});
    const variant = batchedVariant(material);
    assert.equal(batchedVariant(material), variant, "one per material");
    assert.notEqual(variant, material as Material);
    assert.equal(variant.customProgramCacheKey(), `${material.customProgramCacheKey()}|town-batch-identity`);
    const shader = {vertexShader: "#include <common>\n#include <batching_vertex>\n#include <worldpos_vertex>\n", fragmentShader: "#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <lights_fragment_end>\n", uniforms: {}} as unknown as Parameters<Material["onBeforeCompile"]>[0];
    variant.onBeforeCompile(shader, null as never);
    assert.ok(!shader.vertexShader.includes("#include <batching_vertex>") && shader.vertexShader.includes("mat4 batchingMatrix = mat4( 1.0 );"), "no batching texture reads");
    assert.ok(shader.fragmentShader.includes("townCloudShade"), "the town's weather patch kept");
    const depth = batchedDepthMaterial();
    const depthShader = {vertexShader: "#include <batching_vertex>", fragmentShader: "", uniforms: {}} as unknown as Parameters<Material["onBeforeCompile"]>[0];
    depth.onBeforeCompile(depthShader, null as never);
    assert.ok(depthShader.vertexShader.includes("mat4( 1.0 )"));
});

test("cars: an empty set is not drawn; the models are read only near the town", async () => {
    const {TownVehicles, VEHICLE_TIERS} = await import("@/ark-scene/islands/town/render/vehicles");
    const {townPlan} = await import("@/ark-scene/islands/town/plan");
    const {townBoxDistance, VEHICLES_FROM} = await import("@/ark-scene/islands/town/render/index");
    const vehicles = new TownVehicles(townPlan(), "low");
    vehicles.budgetMs = Infinity;
    const meshes = () => vehicles.group.children.filter((o) => (o as {isInstancedMesh?: boolean}).isInstancedMesh) as Array<{visible: boolean; count: number}>;
    vehicles.eye.set(0, 900, 2000);
    vehicles.update({day: 20406, hours: 12}, 20406 * 86400 + 12 * 3600);
    assert.ok(meshes().every((m) => !m.visible && m.count === 0), "beyond the far distance: no car, no set drawn");
    vehicles.eye.set(0, 30, 0);
    vehicles.update({day: 20406, hours: 12.5}, 20406 * 86400 + 12.5 * 3600);
    assert.ok(meshes().some((m) => m.visible && m.count > 0), "in the town: the proxies drawn");
    assert.ok(meshes().every((m) => m.visible === m.count > 0), "drawn exactly when not empty");
    assert.ok(!vehicles.hasModels);
    // (The highest tier's middle distance, where the first car leaves its proxy, plus a lead.)
    assert.ok(VEHICLES_FROM >= Math.max(...Object.values(VEHICLE_TIERS).map((t) => t.mid)) + 100);
    assert.equal(townBoxDistance(0, 10, 0), 0);
    assert.ok(townBoxDistance(0, 400, 900) > VEHICLES_FROM, "from across the strait: not read");
    vehicles.dispose();
});

test("trees: only each asset's farthest level read at once; the nearer ones as the camera comes within reach", async () => {
    const {TownAssets, LEVEL_LEAD} = await import("@/ark-scene/islands/town/render/assets");
    const assets = new TownAssets([{asset: "oak-a", x: 0, y: 0, z: 0, rotation: 0, scale: 1}, {asset: "bush-hazel-a", x: 5, y: 0, z: 0, rotation: 0, scale: 1}], "/nowhere");
    assets.setTier(0.3, false);
    await assets.whenReady();
    assert.deepEqual(assets.levelsAsked().sort(), ["bush-hazel-a:lod2", "oak-a:card"], "the farthest levels only");
    assets.look(600, 300, 0);
    assert.deepEqual(assets.levelsAsked().sort(), ["bush-hazel-a:lod2", "oak-a:card"], "from across the strait: nothing more");
    assets.look(0, 20, 60 + LEVEL_LEAD / 2);
    const asked = assets.levelsAsked();
    assert.ok(asked.includes("oak-a:lod2") && asked.includes("oak-a:lod1"), `coming near: ${asked.join(", ")}`);
    assets.look(0, 3, 4);
    await assets.settled();
    assert.ok(assets.levelsAsked().includes("oak-a:lod0") && assets.levelsAsked().includes("bush-hazel-a:lod0"), "close up: the full levels");
    assets.dispose();
});
