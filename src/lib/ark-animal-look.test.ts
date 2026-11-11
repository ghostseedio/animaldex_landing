import assert from "node:assert/strict";
import test from "node:test";
import {BoxGeometry, BufferGeometry, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Scene} from "three";
import lookTable from "@/ark-scene/animal-look.json";
import {aquatic, chooseLook, dusty, LOOK_CLASSES, LOOK_FLAG, semiAquatic} from "@/ark-scene/animal-look-rules";
import {coatWetness, groundDryness, shellLevel, speciesLook, swimWetness, weatherDust} from "@/ark-scene/animal-look";
import {LOOK_PARAMS} from "@/ark-scene/animal-look-shader";
import {FurShells, SHELL_ANIMALS, SHELL_LAYERS} from "@/ark-scene/fur-shells";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

const rows = (lookTable as {species: Record<string, number[]>}).species;

test("animal look: the class settles it where it can, the photo where it can't, a default only from the body plan", () => {
    assert.equal(chooseLook({className: "Aves", covering: "fur"}).look, "feathers");
    assert.equal(chooseLook({className: "Amphibia", family: "Ranidae", covering: "skin"}).look, "slimy");
    assert.equal(chooseLook({className: "Amphibia", family: "Bufonidae", covering: "skin"}).look, "skin");
    assert.equal(chooseLook({className: "Mammalia", family: "Elephantidae", covering: "skin"}).look, "skin");
    assert.equal(chooseLook({className: "Mammalia", order: "Cetacea", covering: "scales"}).look, "skin");
    assert.equal(chooseLook({className: "Mammalia", covering: "scales"}).look, "scales", "a pangolin, from its photo");
    assert.equal(chooseLook({className: "Mammalia", covering: null}).look, "fur");
    assert.equal(chooseLook({className: "Elasmobranchii", covering: "scales"}).look, "skin");
    assert.equal(chooseLook({className: "Gastropoda", covering: "shell"}).look, "shell");
    assert.equal(chooseLook({className: "Gastropoda", covering: "skin"}).look, "slimy");
    assert.equal(chooseLook({className: "Insecta", order: "Coleoptera", covering: "scales"}).look, "shell");
    assert.equal(chooseLook({className: "Insecta", order: "Lepidoptera", covering: "scales"}).look, "fur");
    assert.equal(chooseLook({className: "Arachnida", covering: "fur"}).look, "fur", "a hairy tarantula");
    assert.equal(chooseLook({className: "Testudines", covering: "scales"}).look, "shell");
    assert.equal(chooseLook({className: null, covering: "scales", plan: "fish"}).source, "photo");
    const fallback = chooseLook({plan: "flying_bird"});
    assert.deepEqual([fallback.look, fallback.defaulted], ["feathers", true]);
    assert.equal(chooseLook({}).defaulted, true);
});

test("animal look: realms give who is wet from a swim, who lives in water, who gets dusty", () => {
    assert.equal(semiAquatic(["air", "fresh"]), true);
    assert.equal(semiAquatic(["sea"]), false);
    assert.equal(aquatic(["sea"]), true);
    assert.equal(aquatic(["land"], "fish"), true);
    assert.equal(aquatic(["land", "sea"]), false);
    assert.equal(dusty("quadruped", "fur", ["land"]), true);
    assert.equal(dusty("amphibian", "slimy", ["land", "fresh"]), false);
    assert.equal(dusty("flying_bird", "feathers", ["air", "land"]), false);
});

test("animal look: every row of the table is whole, and the fixture's species have their expected class", () => {
    const species = Object.entries(rows);
    assert.ok(species.length > 2500);
    for (const [slug, row] of species) {
        assert.equal(row.length, 6, slug);
        assert.ok(row[0] >= 0 && row[0] < LOOK_CLASSES.length, slug);
        assert.ok(row[5] >= 0, slug);
    }
    const expect: Record<string, string> = {
        "red-fox": "fur",
        "atlantic-puffin": "feathers",
        "komodo-dragon": "scales",
        "green-sea-turtle": "shell",
        "american-bullfrog": "slimy",
        "african-bush-elephant": "skin",
        "great-white-shark": "skin",
        "house-cricket": "shell"
    };
    for (const [slug, look] of Object.entries(expect)) assert.equal(LOOK_CLASSES[rows[slug][0]], look, slug);
    assert.ok(rows.mallard[1] & LOOK_FLAG.semiAquatic, "a duck is wet after a swim");
    for (const animal of (fixture as {animals: Array<{model_slug: string}>}).animals) assert.ok(rows[animal.model_slug], animal.model_slug);
});

test("animal look: a swim's wetness is the same for everyone at the same moment, and dries", () => {
    const at = Date.UTC(2026, 10, 11, 10, 7);
    assert.equal(swimWetness("seal-1", at), swimWetness("seal-1", at));
    let wet = 0;
    for (let i = 0; i < 400; i++) {
        const value = swimWetness(`animal-${i}`, at);
        assert.ok(value >= 0 && value <= 1);
        if (value > 0.2) wet++;
    }
    assert.ok(wet > 40 && wet < 300, `about a third to a half wet from a swim at any moment (${wet}/400)`);
    // Over an hour any one animal is wet at some times and dry at others.
    const values = Array.from({length: 60}, (_, minute) => swimWetness("otter-7", at + minute * 60_000));
    assert.ok(Math.max(...values) > 0.5 && Math.min(...values) < 0.2);
});

test("animal look: dust on bare dry ground only", () => {
    assert.ok(groundDryness({sand: 1}, 0) > 0.9);
    assert.ok(groundDryness({grass: 1}, 0) < 0.2);
    assert.equal(groundDryness({sand: 1}, 1), 0);
    assert.equal(groundDryness({forest_floor: 1}, 0), 0);
});

test("animal look: eyes turn with the file's facing turn and are dropped when they miss the skin", () => {
    const plain = speciesLook("red-fox", "mammal", 0, null)!;
    assert.ok(plain.eyes && plain.eyes.radius > 0);
    assert.equal(plain.shells, true);
    const turned = speciesLook("red-fox", "mammal", 90, null)!;
    // A quarter turn about up: (x, z) → (z, -x).
    assert.ok(Math.abs(turned.eyes!.left[0] - plain.eyes!.left[2]) < 1e-9);
    assert.ok(Math.abs(turned.eyes!.left[2] + plain.eyes!.left[0]) < 1e-9);
    const elsewhere = new BufferGeometry();
    elsewhere.setAttribute("position", new Float32BufferAttribute([5, 5, 5, 6, 5, 5, 5, 6, 5], 3));
    assert.equal(speciesLook("red-fox", "mammal", 0, elsewhere)!.eyes, null);
    assert.equal(speciesLook("atlantic-puffin", "bird", 0, null)!.shells, false, "shells only on furred mammals");
});

test("fur shells: at most the cap's animals, each in its layers, copying every per-animal attribute", () => {
    const scene = new Scene();
    const geometry = new BoxGeometry(1, 1, 1);
    const source = new InstancedMesh(geometry, new MeshStandardMaterial(), 8);
    geometry.setAttribute("arkInstance", new InstancedBufferAttribute(new Float32Array(8 * 3).map((_, i) => i), 3));
    scene.add(source);
    const shells = new FurShells(scene);
    shells.begin();
    for (let i = 0; i < 8; i++) shells.offer(source, i, 10 - i);
    shells.end(() => new MeshStandardMaterial());
    assert.equal(shells.drawn, SHELL_ANIMALS);
    const shell = scene.children.find((child) => child !== source) as InstancedMesh;
    assert.equal(shell.count, SHELL_ANIMALS * SHELL_LAYERS);
    // The nearest first (index 7 is 3 m away): its arkInstance copied into each of its layers.
    const copied = shell.geometry.getAttribute("arkInstance") as InstancedBufferAttribute;
    assert.deepEqual([copied.getX(0), copied.getY(0), copied.getZ(0)], [21, 22, 23]);
    const layer = shell.geometry.getAttribute("arkShellLayer") as InstancedBufferAttribute;
    assert.equal(layer.getX(SHELL_LAYERS - 1), 1);
    // The body's own buffers are shared, not copied.
    assert.equal(shell.geometry.getAttribute("position"), geometry.getAttribute("position"));
    shells.begin();
    shells.end(() => new MeshStandardMaterial());
    assert.equal(shell.visible, false);
    shells.dispose();
    assert.ok(geometry.getAttribute("position"), "the source keeps its buffers when the shells go");
});

test("animal look: coats soak in the rain and dry before the ground; dust only when the ground is dry", () => {
    // Raining: a shower half wets a coat at once, heavy rain soaks it, before the ground has caught up.
    assert.ok(coatWetness({rain: 0.35, wetness: 0.1}) > 0.6);
    assert.equal(coatWetness({rain: 0.85, wetness: 0.2}), 1);
    // After the rain: the ground still wet, the coat much drier; dry weather, dry coat.
    assert.ok(coatWetness({rain: 0, wetness: 0.8}) < 0.8 * 0.6);
    assert.equal(coatWetness({rain: 0, wetness: 0}), 0);
    assert.equal(weatherDust({rain: 0, wetness: 0.8}), 0);
    assert.ok(weatherDust({rain: 0, wetness: 0, wind: 0.9}) > weatherDust({rain: 0, wetness: 0, wind: 0.1}));
    // Feathers shed water: a duck on the pond takes a third of the wet look; slime and fur all of it.
    assert.ok(LOOK_PARAMS.feathers.wetTake < 0.4);
    assert.equal(LOOK_PARAMS.fur.wetTake, 1);
    assert.equal(LOOK_PARAMS.slimy.wetTake, 1);
});

test("fur shells: all the layers close, fewer further, the coat shrinking to nothing at the range's edge", () => {
    const close = shellLevel(1, 9);
    assert.deepEqual(close, {layers: SHELL_LAYERS, reach: 1});
    const middle = shellLevel(5, 9);
    assert.ok(middle.layers < SHELL_LAYERS && middle.layers > 1 && middle.reach === 1);
    const edge = shellLevel(8.5, 9);
    assert.ok(edge.layers <= 2 && edge.reach > 0 && edge.reach < 0.2);
    assert.deepEqual(shellLevel(9, 9), {layers: 0, reach: 0});
    // It never grows as the animal goes away (no pop).
    let last = Infinity;
    for (let d = 0; d < 9; d += 0.25) {
        const level = shellLevel(d, 9);
        const amount = level.layers * level.reach;
        assert.ok(amount <= last + 1e-9, `at ${d} m`);
        last = amount;
    }
});

test("fur shells: each animal its own layers and reach; the drawn count is what was drawn", () => {
    const scene = new Scene();
    const geometry = new BoxGeometry(1, 1, 1);
    const source = new InstancedMesh(geometry, new MeshStandardMaterial(), 4);
    geometry.setAttribute("arkInstance", new InstancedBufferAttribute(new Float32Array(4 * 3), 3));
    scene.add(source);
    const shells = new FurShells(scene);
    shells.begin();
    shells.offer(source, 0, 2, 6, 1);
    shells.offer(source, 1, 8, 2, 0.3);
    shells.end(() => new MeshStandardMaterial(), 4);
    assert.equal(shells.drawn, 2);
    assert.equal(shells.layersDrawn, 8);
    const shell = scene.children.find((child) => child !== source) as InstancedMesh;
    const layer = shell.geometry.getAttribute("arkShellLayer") as InstancedBufferAttribute;
    assert.equal(layer.itemSize, 2);
    assert.deepEqual([layer.getX(5), layer.getY(5)], [1, 1]);
    assert.ok(Math.abs(layer.getX(6) - 0.5) < 1e-6 && Math.abs(layer.getY(6) - 0.3) < 1e-6);
    // No material (nothing to draw it with): nothing counted as drawn.
    const other = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial(), 2);
    scene.add(other);
    shells.begin();
    shells.offer(other, 0, 1);
    shells.end(() => null, 4);
    assert.equal(shells.drawn, 0);
    shells.dispose();
});
