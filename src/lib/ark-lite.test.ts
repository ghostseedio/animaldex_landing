import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {ARK_LITE_CPU_MS, ARK_LITE_ENGLISH, ARK_LITE_KINDS, arkChooseView, arkLiteKindAnimals, arkLiteModel, arkLiteWords, arkReadView} from "./ark-lite";
import {ARK_LITE_FEED_FOLD_MS, arkLiteFeedFromEvents, arkLiteFeedLines, arkLiteFeedMerge, arkLiteFeedSeed} from "./ark-lite-feed";
import {decodeArkEvents} from "./ark-life";

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
    assert.ok(model.regions.every((r) => r.kinds.length + r.rest.length === r.species));
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

test("arkLiteKindAnimals: who brought each one, the reader's first, then named founders, never a Voyager label", () => {
    const animals = [
        animal("k1", {species_profile_id: "lion", name: "Lion", model_slug: "lion", arrived_at: "2026-11-02T00:00:00Z", brought_by: {label: "Voyager 4", named: false}}),
        animal("k2", {species_profile_id: "lion", name: "Lion", model_slug: "lion", arrived_at: "2026-11-03T00:00:00Z"}),
        animal("k3", {species_profile_id: "lion", name: "Lion", model_slug: "lion", arrived_at: "2026-11-01T00:00:00Z", mine: true}),
        animal("k4", {species_profile_id: "lion", name: "Lion", model_slug: "lion", arrived_at: "2026-11-04T00:00:00Z", origin: "born"})
    ];
    const snap = snapshot(animals);
    const region = arkLiteModel(snap).regions[0].region;
    const founders = {animals: {k1: {brought_by: {handle: "@czar"}}, k4: {brought_by: {handle: "ghost"}}}};
    const {animals: listed, more} = arkLiteKindAnimals(snap, founders, region, "lion");
    assert.equal(more, 0);
    assert.deepEqual(listed.map((a) => a.id), ["k3", "k1", "k4", "k2"]);
    assert.equal(listed[1].handle, "czar");
    // Born aboard: never a bringer; no founders read: no one named.
    assert.equal(listed[2].handle, null);
    assert.equal(listed[2].origin, "born");
    assert.equal(listed[3].handle, null);
    assert.ok(arkLiteKindAnimals(snap, null, region, "lion").animals.every((a) => a.handle === null));
    assert.deepEqual(arkLiteKindAnimals(snap, null, region, "nope"), {animals: [], more: 0});
});

test("Lite's feed: the snapshot's newest at once, the record's reading wins, neighbours fold", () => {
    const animals = [
        animal("f1", {species_profile_id: "duck", name: "Mallard", model_slug: "mallard", arrived_at: "2026-11-15T10:00:00Z", origin: "born"}),
        animal("f2", {species_profile_id: "duck", name: "Mallard", model_slug: "mallard", arrived_at: "2026-11-15T10:05:00Z", origin: "born"}),
        animal("f3", {species_profile_id: "fox", name: "Red Fox", model_slug: "red-fox", arrived_at: "2026-11-15T09:00:00Z"})
    ];
    const snap = snapshot(animals);
    const seed = arkLiteFeedSeed(snap);
    assert.deepEqual(seed.map((e) => e.item.focus.animalId), ["f2", "f1", "f3"]);
    const events = decodeArkEvents([{at: "2026-11-15T09:00:30Z", id: 77, kind: "arrival", animal: {id: "f3", name: "Red Fox", zone: "grassland", model_slug: "red-fox", species_profile_id: "fox"}}], snap);
    const fromRecord = arkLiteFeedFromEvents(events);
    assert.equal(fromRecord.length, 1);
    assert.equal(fromRecord[0].slug, "red-fox");
    const merged = arkLiteFeedMerge(seed, fromRecord);
    // The fox once, as the record has it.
    assert.equal(merged.filter((e) => e.item.focus.animalId === "f3").length, 1);
    assert.equal(merged.find((e) => e.item.focus.animalId === "f3")!.id, "77");
    const lines = arkLiteFeedLines(merged);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].item.count, 2);
    assert.deepEqual(lines[0].ids, ["new:f2", "new:f1"]);
    // Further apart than the fold window: two lines.
    const apart = arkLiteFeedSeed(snapshot([animals[0], {...animals[1], arrived_at: new Date(Date.parse(animals[0].arrived_at) + ARK_LITE_FEED_FOLD_MS + 60_000).toISOString()}]));
    assert.equal(arkLiteFeedLines(apart).length, 2);
    assert.equal(arkLiteFeedLines(merged, 1).length, 1);
});
