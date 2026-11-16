import assert from "node:assert/strict";
import test from "node:test";
import {InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Scene, Vector3} from "three";
import {sampleGround, setArkWorld} from "@/ark-scene/world";
import {freshFrom, freshLevelFrom, setIslandWater} from "@/ark-scene/water-level";
import {mirrorY, pickReflections, REFLECT_PER_MESH, REFLECT_TIERS, reflectedOnPlane, reflectPlane, reflectStrength, stillWaterAt, type ReflectCandidate, type StillWater} from "@/ark-scene/water-reflect";
import {WaterReflections} from "@/ark-scene/water-reflect-render";
import {REFLECT_FRAGMENT, REFLECT_VERTEX} from "@/ark-scene/water-reflect-shader";
import {townStillWater, townWaterSurface} from "@/ark-scene/islands/town/drawn-ground";
import {CANAL_LEVEL, HARBOUR_BASIN, MILLPOND, TOWN_HALF} from "@/ark-scene/islands/town/plan";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";

/**
 * p3 (reflect): the owner's "animal reflections in water where it's more realistic". A reflected animal is always
 * mirrored about its own water's surface height, and is never drawn where there is no still water under it.
 */

setArkWorld("v2");

const out = (): StillWater => ({level: 0, tint: 0});

test("the town's still water: the canal, the millpond and the farm pond at their level, the harbour at the sea's, no open sea or dry land", () => {
    assert.ok(Math.abs(townStillWater(MILLPOND.x, MILLPOND.z)! - CANAL_LEVEL) < 1e-5);
    assert.ok(Number.isNaN(townStillWater(HARBOUR_BASIN.x, HARBOUR_BASIN.z)!), "the harbour basin: the sea's level now");
    assert.equal(townStillWater(TOWN_HALF - 1, TOWN_HALF - 1), null, "the open sea at the square's corner");
    let fresh = 0;
    let dry = 0;
    // (At the water grid's cell centres: the town's water is known per metre cell.)
    for (let x = -TOWN_HALF + 2.5; x < TOWN_HALF; x += 4) {
        for (let z = -TOWN_HALF + 2.5; z < TOWN_HALF; z += 3) {
            const still = townStillWater(x, z);
            const surface = townWaterSurface(x, z);
            if (still !== null && !Number.isNaN(still)) {
                fresh++;
                // Still fresh water only where the town's fresh water is drawn, at its level.
                assert.ok(surface !== null && Math.abs(still - surface) < 1e-5, `(${x}, ${z})`);
            }
            const ground = sampleTownGround(x, z);
            if (ground.surface !== "water" && ground.surface !== "sea" && ground.height > 0.05) {
                dry++;
                assert.equal(still, null, `dry ground at (${x}, ${z}) has no reflection`);
            }
        }
    }
    assert.ok(fresh > 20 && dry > 1000, `${fresh} fresh, ${dry} dry`);
});

test("stillWaterAt: the island's answer inside it (the harbour at the sea's level now), the wild island's fresh water outside", () => {
    setIslandWater({level: () => null, surface: () => null, still: (x) => (x < 0 ? undefined : x < 10 ? 1.15 : x < 20 ? Number.NaN : null)});
    try {
        assert.deepEqual(stillWaterAt(5, 0, 0.3, out()), {level: 1.15, tint: 0});
        assert.deepEqual(stillWaterAt(15, 0, 0.3, out()), {level: 0.3, tint: 2});
        assert.equal(stillWaterAt(25, 0, 0.3, out()), null);
    } finally {
        setIslandWater(null);
    }
});

test("the wild island: still water exactly where its fresh water is drawn, at its own level", () => {
    let wet = 0;
    for (let x = -600; x <= 600; x += 9) {
        for (let z = -600; z <= 600; z += 9) {
            const sample = sampleGround(x, z);
            const still = stillWaterAt(x, z, 0, out());
            if (freshFrom(sample, x, z) < 0.5) {
                assert.equal(still, null, `no fresh water at (${x}, ${z})`);
                continue;
            }
            if (!still) continue;
            wet++;
            assert.equal(still.level, freshLevelFrom(sample));
            assert.ok(sample.height <= still.level + 0.05, "its bed under its surface");
        }
    }
    assert.ok(wet > 20, `${wet} points of the lake and the river`);
});

test("reflectPlane: the water under its middle, else under its head or tail end; none without still water", () => {
    const pond = (x: number, z: number): StillWater | null => (Math.hypot(x - 10, z) < 4 ? {level: 2.5, tint: 1} : null);
    assert.equal(reflectPlane(10, 0, 1, 0, 0.6, pond)?.level, 2.5);
    // A deer on the bank, its muzzle over the water.
    assert.equal(reflectPlane(5.6, 0, 1, 0, 0.8, pond)?.level, 2.5);
    assert.equal(reflectPlane(5.6, 0, 0, 1, 0.8, pond), null, "side-on to the water, nothing under it");
    assert.equal(reflectPlane(-20, 0, 1, 0, 0.8, pond), null);
});

test("the mirror: about the water's own surface, and drawn on that plane along the camera's ray", () => {
    for (const h of [0, 1.15, 6.2, -0.3]) {
        for (const y of [h + 0.01, h + 0.8, h + 5]) {
            const m = mirrorY(y, h);
            assert.ok(Math.abs((y + m) / 2 - h) < 1e-9, "the surface halfway between the point and its mirror");
            const camera = {x: 3, y: h + 9, z: -12};
            const point = {x: 1, y: m, z: 4};
            const q = reflectedOnPlane(camera, point, h);
            assert.ok(Math.abs(q.y - h) < 1e-9, "drawn on the water's plane");
            // On the camera's ray through the mirrored point: the same place on screen.
            const a = new Vector3(point.x - camera.x, point.y - camera.y, point.z - camera.z).normalize();
            const b = new Vector3(q.x - camera.x, q.y - camera.y, q.z - camera.z).normalize();
            assert.ok(a.distanceTo(b) < 1e-9);
        }
    }
    assert.match(REFLECT_VERTEX, /2\.0 \* arkH - arkW\.y/);
    assert.match(REFLECT_FRAGMENT, /if \(vArkReflectAbove < 0\.0\) discard;/);
});

test("reflectStrength: none under the water, too high over it or out of reach; fades with distance and height", () => {
    assert.equal(reflectStrength(-1, -0.2, 0, 5, 25), 0, "all under the surface (a fish)");
    assert.equal(reflectStrength(9, 10, 0, 5, 25), 0, "high over the water");
    assert.equal(reflectStrength(0, 1, 0, 25, 25), 0, "past the tier's reach");
    assert.ok(reflectStrength(-0.1, 0.4, 0, 5, 25) > 0.99, "a duck afloat close by");
    assert.ok(reflectStrength(-0.1, 0.4, 0, 22, 25) < reflectStrength(-0.1, 0.4, 0, 10, 25));
    assert.ok(reflectStrength(4, 4.5, 0, 5, 25) < reflectStrength(0.5, 1, 0, 5, 25));
});

test("pickReflections: the nearest within the tier's count, at most a mesh's slots each", () => {
    const list: ReflectCandidate[] = [];
    for (let i = 0; i < 40; i++) list.push({source: i % 2, index: i, distance: 40 - i, level: 0, tint: 0, strength: 1});
    const kept = pickReflections(list, list.length, REFLECT_TIERS.medium!.count, new Map());
    assert.equal(kept, 12);
    assert.deepEqual(list.slice(0, kept).map((c) => c.distance), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const one = list.map((c) => ({...c, source: 0}));
    assert.equal(pickReflections(one, one.length, 32, new Map()), REFLECT_PER_MESH);
    assert.equal(REFLECT_TIERS.low, null, "off on the low tier");
});

/** A species mesh as the scene draws one: instance matrices and per-instance attributes, the material's options. */
function speciesMesh(at: Array<[number, number, number]>): InstancedMesh {
    const geometry = new PlaneGeometry(1, 1);
    const instance = new InstancedBufferAttribute(new Float32Array(at.length * 4), 4);
    geometry.setAttribute("arkInstance", instance);
    const material = new MeshStandardMaterial();
    material.userData.arkOptions = {minY: 0, maxY: 0.5, behaviour: null};
    const mesh = new InstancedMesh(geometry, material, at.length);
    const m = new Matrix4();
    at.forEach(([x, y, z], i) => {
        mesh.setMatrixAt(i, m.compose(new Vector3(x, y, z), new Quaternion(), new Vector3(1, 1, 1)));
        instance.setXYZW(i, i + 0.5, 0, 0, 0);
    });
    mesh.count = at.length;
    return mesh;
}

test("WaterReflections: each reflected animal mirrored about its own water's surface, none over dry land or on the low tier", () => {
    // Two ponds at their own levels, dry land between.
    const ponds = [{x: 0, z: 0, level: 1.15}, {x: 12, z: 0, level: 6}];
    setIslandWater({level: () => null, surface: () => null, still: (x, z) => ponds.find((p) => Math.hypot(x - p.x, z - p.z) < 3)?.level ?? null});
    try {
        const scene = new Scene();
        const source = speciesMesh([[0, 1.1, 0], [6, 1.5, 0], [12, 5.95, 0.5], [0.5, 3, 0.5], [12, 4, 0]]);
        scene.add(source);
        const made: MeshStandardMaterial[] = [];
        const reflections = new WaterReflections(scene, () => {
            const material = new MeshStandardMaterial();
            made.push(material);
            return material;
        });
        reflections.setTier("medium", false);
        reflections.update([source], new Vector3(6, 8, 14), 0, 1, 1);
        const mirror = scene.children.find((o) => o.name === "ark:reflection") as InstancedMesh;
        assert.ok(mirror, "a reflection mesh");
        // Reflected: the duck on the first pond, the goose on the second, the low bird over the first. Not the deer
        // between them (dry land) nor the fish under the second pond's surface.
        assert.equal(mirror.count, 3);
        assert.equal(made.length, 2, "its depth pass and its colour pass");
        const uniforms = (reflections as unknown as {mirrors: Map<InstancedMesh, {uniforms: {arkReflect: {value: Array<{x: number}>}}}>}).mirrors.get(source)!.uniforms.arkReflect.value;
        const copied = mirror.geometry.getAttribute("arkInstance") as InstancedBufferAttribute;
        const matrices = mirror.instanceMatrix.array as Float32Array;
        for (let k = 0; k < mirror.count; k++) {
            const x = matrices[k * 16 + 12];
            const z = matrices[k * 16 + 14];
            const pond = ponds.find((p) => Math.hypot(x - p.x, z - p.z) < 3);
            assert.ok(pond, `reflection ${k} over water`);
            assert.equal(uniforms[k].x, pond.level, "mirrored about its own pond's surface");
            // The same instance: its own per-instance data copied with it.
            const index = copied.getX(k) - 0.5;
            assert.equal(matrices[k * 16 + 13], (source.instanceMatrix.array as Float32Array)[index * 16 + 13]);
        }
        reflections.setTier("low", false);
        reflections.update([source], new Vector3(6, 8, 14), 0, 2, 2);
        assert.equal(mirror.count, 0, "off on the low tier");
        assert.equal(mirror.visible, false);
        reflections.dispose();
        assert.equal(scene.children.filter((o) => o.name.startsWith("ark:reflection")).length, 0);
        assert.ok(source.geometry.getAttribute("position"), "the source's own buffers untouched");
    } finally {
        setIslandWater(null);
    }
});
