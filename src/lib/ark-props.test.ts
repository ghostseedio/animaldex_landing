import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals} from "@/ark-scene/placement";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {sampleGround} from "@/ark-scene/world";
import {breedingSeason, headNoun, nestStyle, presenceKey, propsPresence, speciesGroups} from "@/ark-scene/props/presence";
import {conditionsFromArkWeather, dawnBell, dewOf, stubConditions, withOverride} from "@/ark-scene/props/conditions";
import {CAVE_SITE, caveSite, propsPoints} from "@/ark-scene/props/sampler";
import {buildAreas} from "@/ark-scene/props/areas";
import {buildHomes, buildWebs} from "@/ark-scene/props/homes";
import {LodBatch, PROPS_TIERS} from "@/ark-scene/props/kit";
import {propsFixture} from "@/ark-scene/props/golden-props";
import {BoxGeometry, MeshBasicMaterial} from "three";
import type {ArkAnimal} from "@/ark-scene/types";

const animal = (slug: string, zone: ArkAnimal["zone"], name = slug): ArkAnimal => ({id: `${slug}-1`, species_profile_id: slug, name, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false});

test("props presence: a home only for a species of its kind, read from the head noun", () => {
    assert.equal(headNoun("asian-honey-bee"), "bee");
    assert.equal(headNoun("honey-badger"), "badger");
    assert.equal(headNoun("golden-silk-orb-weaver"), "orb-weaver");
    assert.deepEqual(speciesGroups(animal("asian-honey-bee", "farm_garden")), ["bees"]);
    assert.deepEqual(speciesGroups(animal("honey-badger", "grassland")), ["den"]);
    assert.deepEqual(speciesGroups(animal("african-bush-elephant", "grassland")), []);
    assert.deepEqual(speciesGroups(animal("black-ant", "woodland")), ["ants"]);
    assert.deepEqual(speciesGroups(animal("golden-silk-orb-weaver", "rainforest")), ["spiders"]);
    assert.deepEqual(speciesGroups(animal("leaf-sheep-sea-slug", "coral_reef")), []);
    assert.deepEqual(speciesGroups(animal("mountain-beaver", "woodland")), []);
    assert.deepEqual(speciesGroups(animal("north-american-beaver", "river_lake")), ["beavers"]);
    assert.deepEqual(speciesGroups(animal("green-sea-turtle", "coral_reef")), ["sea_turtles"]);
    assert.deepEqual(speciesGroups(animal("eastern-slow-worm", "woodland")), []);
    assert.deepEqual(speciesGroups(animal("house-sparrow", "farm_garden")), ["birds"]);
    // A bird the noun list misses is a bird once its rig's plan is in.
    assert.deepEqual(speciesGroups(animal("common-tailorbird", "rainforest")), []);
    assert.deepEqual(speciesGroups(animal("common-tailorbird", "rainforest"), "bird"), ["birds"]);
    assert.equal(nestStyle(animal("house-sparrow", "farm_garden")), "eaves");
    assert.equal(nestStyle(animal("mallard", "river_lake")), "ground");
    assert.equal(nestStyle(animal("scarlet-macaw", "rainforest")), "hole");
    assert.equal(nestStyle(animal("golden-eagle", "mountains")), "cliff");
    assert.equal(nestStyle(animal("barn-owl", "farm_garden")), "barn");
    assert.equal(nestStyle(animal("emperor-penguin", "polar")), "none");
});

test("props presence: nests in the breeding season or with a clutch; eggs only from the server's clutch", () => {
    const snapshot = decodeArkSnapshot(fixture)!;
    // The fixture's Ark day 286 is autumn: only the rainforest's (it breeds most of the year), no turtle nest.
    const autumn = propsPresence(snapshot);
    assert.deepEqual(autumn.nests.map((nest) => nest.zone), ["rainforest"]);
    assert.equal(autumn.turtleNests.length, 0);
    assert.ok(autumn.groups.has("birds") && autumn.groups.has("rabbits") && autumn.groups.has("den") && autumn.groups.has("lair") && autumn.groups.has("sea_turtles"));
    assert.ok(!autumn.groups.has("bees") && !autumn.groups.has("beavers") && !autumn.groups.has("bats") && !autumn.groups.has("snails"));
    const spring = propsFixture(snapshot);
    const presence = propsPresence(spring);
    assert.ok(presence.nests.length >= 6, `${presence.nests.length} nests`);
    const mallard = presence.nests.find((nest) => nest.slug === "mallard")!;
    assert.equal(mallard.eggs, 6);
    assert.equal(mallard.style, "ground");
    assert.ok(mallard.sitter);
    assert.equal(presence.nests.find((nest) => nest.slug === "house-sparrow")?.eggs, 0);
    assert.ok(!presence.nests.some((nest) => nest.slug === "emperor-penguin"));
    assert.equal(presence.turtleNests[0]?.eggs, 9);
    for (const group of ["ants", "bees", "wasps", "termites", "spiders", "moths", "worms", "bats", "beavers", "snails"] as const) assert.ok(presence.groups.has(group), group);
    // The same Ark gives the same key; the decoder keeps only egg rows in known zones.
    assert.equal(presenceKey(propsPresence(spring)), presenceKey(presence));
    const decoded = decodeArkSnapshot({...fixture, nests: [{species_profile_id: "x", zone: "wetland", status: "egg", eggs: 3}, {species_profile_id: "y", zone: "moon", status: "egg"}, {species_profile_id: "z", zone: "wetland", status: "hatched"}]});
    assert.deepEqual(decoded?.nests?.map((row) => row.species_profile_id), ["x"]);
    assert.equal(breedingSeason("woodland", 120) > 0.8, true);
    assert.equal(breedingSeason("woodland", 300), 0);
    assert.ok(breedingSeason("rainforest", 10) > 0);
});

test("props conditions: dew at a still dawn, none at noon or in the wind; the clock's weather maps over", () => {
    assert.equal(dawnBell(12), 0);
    assert.ok(dawnBell(6.4) > 0.9);
    assert.ok(dewOf(6.4, 0.05, 0, 0) > 0.6);
    assert.equal(dewOf(6.4, 0.9, 0, 0), 0);
    assert.equal(stubConditions(13).dew, 0);
    const wet = conditionsFromArkWeather({rain: 0, wind: 0.1, windDirection: 1, fog: 0.4, wetness: 0.9, puddles: 0.7, cold: 0.3, mountainSnowCover: 0.2}, 6.5);
    assert.equal(wet.puddles, 0.7);
    assert.ok(wet.dew > 0.5);
    assert.equal(withOverride(wet, {wind: 1}).dew, 0);
});

test("props sampler: the cave's site still holds (flat, open, on land); forks, hollows and ledges exist", () => {
    const site = caveSite();
    assert.ok(site.y > 1, `cave at ${site.y.toFixed(1)} m`);
    for (let a = 0; a < 8; a++) assert.ok(site.y - sampleGround(CAVE_SITE.x + Math.cos(a) * 4.5, CAVE_SITE.z + Math.sin(a) * 4.5).height < 0.6, "flat round the outcrop");
    const near = [...worldDecor(), ...forestFill()].filter((item) => item.kind !== "flower" && item.kind !== "leaf" && Math.hypot(item.x - CAVE_SITE.x, item.z - CAVE_SITE.z) < 6.5);
    assert.deepEqual(near.map((item) => item.kind), []);
    assert.ok(propsPoints("fork").length > 30);
    assert.ok(propsPoints("hollow").length > 10);
    assert.ok(propsPoints("ledge").filter((point) => point.zone === "mountains").length > 8);
    // Deterministic.
    assert.deepEqual(propsPoints("fork").slice(0, 3), propsPoints("fork").slice(0, 3));
});

test("props build: the areas and every gated home build, the same for every viewer, capped per tier", () => {
    const areas = buildAreas(PROPS_TIERS.high);
    assert.ok(areas.batches.length > 8 && areas.pieces.length >= 3);
    const snapshot = propsFixture(decodeArkSnapshot(fixture)!);
    const places = placeAnimals(snapshot.animals);
    const presence = propsPresence(snapshot);
    const homes = buildHomes(presence, (id) => places.get(id) ?? null, PROPS_TIERS.high);
    for (const mark of ["ants", "beesHollow", "hiveBox", "turtleNest", "beaverLodge", "slimeWall", "warren", "web"]) assert.ok(homes.marks[mark], mark);
    assert.ok(homes.nests.length >= 5);
    // The mallard's nest is under the mallard that sits it.
    const mallard = homes.nests.find((nest) => nest.style === "ground" && nest.sitter?.includes("") && places.get(nest.sitter!)?.x === nest.x);
    assert.ok(mallard, "a ground nest under its sitter");
    const again = buildHomes(presence, (id) => places.get(id) ?? null, PROPS_TIERS.high);
    assert.deepEqual(again.nests, homes.nests);
    const webs = buildWebs(homes.webs);
    assert.ok(webs.beads.length > 30);
    // Caps: the low tier draws a fraction of the high tier's, and fine detail not at all.
    const items = Array.from({length: 500}, (_, i) => ({x: i * 0.01, y: 0, z: 0, turn: 0, scale: 1}));
    const batch = new LodBatch("t", items, new BoxGeometry(), null, new MeshBasicMaterial(), {cap: 200});
    batch.setTier(PROPS_TIERS.high);
    batch.update(0, 0, 0);
    assert.equal(batch.drawn().near, 200);
    batch.setTier(PROPS_TIERS.low);
    batch.update(0, 0, 0);
    assert.equal(batch.drawn().near, Math.round(200 * PROPS_TIERS.low.density));
    const fine = new LodBatch("f", items, new BoxGeometry(), null, new MeshBasicMaterial(), {cap: 200, fine: true});
    fine.setTier(PROPS_TIERS.low);
    fine.update(0, 0, 0);
    assert.equal(fine.drawn().near, 0);
    batch.update(1000, 0, 0);
    assert.equal(batch.drawn().near, 0);
    areas.dispose();
    homes.dispose();
    again.dispose();
});
