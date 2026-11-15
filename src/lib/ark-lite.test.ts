import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {ARK_LITE_CPU_MS, ARK_LITE_ENGLISH, ARK_LITE_KINDS, arkChooseView, arkLiteModel, arkLiteWords, arkReadView} from "./ark-lite";

function animal(id: string, over: Partial<ArkAnimal> = {}): ArkAnimal {
    return {
        id,
        species_profile_id: over.species_profile_id ?? `sp-${id}`,
        name: over.name ?? `Animal ${id}`,
        scientific_name: null,
        model_slug: over.model_slug ?? `slug-${id}`,
        zone: over.zone ?? "grassland",
        arrived_at: over.arrived_at ?? "2026-11-01T00:00:00Z",
        brought_by: {label: "Voyager 1", named: false},
        mine: over.mine ?? false,
        ...over
    } as ArkAnimal;
}

function snapshot(animals: ArkAnimal[]): ArkSnapshot {
    return {
        voyage: {slug: "v", name: "V", started_at: "2026-11-01T00:00:00Z"},
        counts: {animals: animals.length, species: new Set(animals.map((a) => a.species_profile_id)).size, founders: 1},
        zones: [],
        animals,
        as_of: "2026-11-15T00:00:00Z"
    };
}

test("arkChooseView: asked, then stored, then the device", () => {
    assert.deepEqual(arkChooseView({asked: "3d", stored: "lite", memoryGB: 1}), {view: "3d", why: "asked"});
    assert.deepEqual(arkChooseView({asked: "nonsense", stored: "lite", memoryGB: 8}), {view: "lite", why: "stored"});
    assert.deepEqual(arkChooseView({stored: "3d", memoryGB: 2}), {view: "3d", why: "stored"});
    // The Galaxy A02s: Chromium says 2 GB.
    assert.deepEqual(arkChooseView({memoryGB: 2}), {view: "lite", why: "memory"});
    assert.deepEqual(arkChooseView({memoryGB: 0.5}), {view: "lite", why: "memory"});
    assert.deepEqual(arkChooseView({memoryGB: 4}), {view: "3d", why: "default"});
    assert.deepEqual(arkChooseView({memoryGB: 4, cpuMs: ARK_LITE_CPU_MS + 1}), {view: "lite", why: "cpu"});
    assert.deepEqual(arkChooseView({memoryGB: null, cpuMs: 5}), {view: "3d", why: "default"});
    assert.deepEqual(arkChooseView({}), {view: "3d", why: "default"});
    assert.equal(arkReadView("lite"), "lite");
    assert.equal(arkReadView("LITE"), null);
});

test("arkLiteModel: the reader's own animals newest first, regions with their biggest kinds, the reader's first", () => {
    const animals = [
        animal("a1", {species_profile_id: "lion", name: "Lion", model_slug: "lion", zone: "grassland", arrived_at: "2026-11-02T00:00:00Z"}),
        animal("a2", {species_profile_id: "lion", name: "Lion", model_slug: "lion", zone: "grassland"}),
        animal("a3", {species_profile_id: "zebra", name: "Zebra", model_slug: "zebra", zone: "grassland", mine: true, arrived_at: "2026-11-03T00:00:00Z"}),
        animal("a4", {species_profile_id: "cod", name: "Cod", model_slug: "cod", zone: "open_ocean", mine: true, arrived_at: "2026-11-05T00:00:00Z", origin: "born"}),
        animal("a5", {species_profile_id: "ghost", name: "Ghost", model_slug: "placeholder--ghost", placeholder: true, zone: "open_ocean"})
    ];
    const model = arkLiteModel(snapshot(animals), {a4: 2});
    assert.equal(model.animals, 5);
    assert.deepEqual(model.mine.map((m) => m.id), ["a4", "a3"]);
    assert.equal(model.mine[0].origin, "born");
    assert.equal(model.mine[0].hearts, 2);
    assert.equal(model.mine[1].hearts, null);
    assert.equal(model.mine[1].placeholder, false);
    const open = model.regions.find((r) => r.kinds.some((k) => k.key === "zebra"));
    assert.ok(open);
    // The reader's Zebra first, ahead of the bigger Lion.
    assert.equal(open.kinds[0].key, "zebra");
    assert.equal(open.mine, 1);
    assert.ok(model.regions.every((r) => r.share > 0 && r.share <= 1 && r.kinds.length <= ARK_LITE_KINDS));
    // The region each of the reader's animals is in.
    assert.equal(model.mine[1].region, open.region);
});

test("arkLiteModel: nothing read yet", () => {
    assert.deepEqual(arkLiteModel(null), {animals: 0, species: 0, mine: [], regions: []});
});

test("arkLiteWords: a language's words, English where one is missing", () => {
    const words = arkLiteWords({title: "Ark Lite", open3d: "Abrir", where: "  "});
    assert.equal(words.open3d, "Abrir");
    assert.equal(words.where, ARK_LITE_ENGLISH.where);
    assert.deepEqual(arkLiteWords(null), ARK_LITE_ENGLISH);
});

test("every language has Ark Lite's words, English the same as ARK_LITE_ENGLISH", () => {
    const root = path.join(process.cwd(), "src/data/locales");
    const english = JSON.parse(readFileSync(path.join(root, "en.json"), "utf8")).ark.liteView;
    assert.deepEqual(english, ARK_LITE_ENGLISH);
    const files = ["id.json", ...readdirSync(path.join(root, "ark")).filter((f) => f.endsWith(".json")).map((f) => `ark/${f}`)];
    assert.ok(files.length >= 44);
    for (const file of files) {
        const lite = JSON.parse(readFileSync(path.join(root, file), "utf8")).ark.liteView;
        assert.ok(lite, file);
        for (const key of Object.keys(ARK_LITE_ENGLISH)) assert.ok(typeof lite[key] === "string" && lite[key].trim(), `${file} ${key}`);
        assert.ok(lite.kindsMore.includes("{count}"), `${file} kindsMore`);
    }
});
