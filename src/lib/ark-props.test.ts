import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals} from "@/ark-scene/placement";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {sampleGround} from "@/ark-scene/world";
import {breedingSeason, headNoun, presenceKey, propsPresence, speciesGroups} from "@/ark-scene/props/presence";
import {nestProfile} from "@/ark-scene/props/nest-kinds";
import {conditionsFromArkWeather, dawnBell, dewOf, stubConditions, withOverride} from "@/ark-scene/props/conditions";
import {caveSite, propsPoints} from "@/ark-scene/props/sampler";
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
    assert.equal(nestProfile(animal("house-sparrow", "farm_garden")).site, "eaves");
    assert.equal(nestProfile(animal("mallard", "river_lake")).site, "ground");
    assert.equal(nestProfile(animal("scarlet-macaw", "rainforest")).form, "hole");
    assert.equal(nestProfile(animal("golden-eagle", "mountains")).site, "cliff_ledge");
    assert.equal(nestProfile(animal("barn-owl", "farm_garden")).form, "barn");
    assert.equal(nestProfile(animal("emperor-penguin", "polar")).form, "none");
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
    assert.equal(mallard.profile.form, "down_bowl");
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

test("props sampler: the cave (the sampler's place) is flat, open, on land; ledges come from the sampler, up is up, forward out of the cliff", () => {
    const site = caveSite();
    assert.ok(site.y > 1, `cave at ${site.y.toFixed(1)} m`);
    for (let a = 0; a < 8; a++) assert.ok(site.y - sampleGround(site.x + Math.cos(a) * 4.5, site.z + Math.sin(a) * 4.5).height < 0.6, "flat round the outcrop");
    const near = [...worldDecor(), ...forestFill()].filter((item) => item.kind !== "flower" && item.kind !== "leaf" && Math.hypot(item.x - site.x, item.z - site.z) < 6.5);
    assert.deepEqual(near.map((item) => item.kind), []);
    const ledges = propsPoints("ledge");
    assert.ok(ledges.filter((point) => point.zone === "mountains").length > 8);
    for (const ledge of ledges.filter((point) => point.host === "ground")) {
        assert.ok(ledge.normal.y > 0.99, "a ledge's up is up");
        assert.ok(ledge.forward && Math.abs(Math.atan2(ledge.forward.x, ledge.forward.z) - ledge.yaw) < 1e-6, "its yaw faces forward, out of the cliff");
    }
    // Deterministic.
    assert.deepEqual(propsPoints("ledge").slice(0, 3), propsPoints("ledge").slice(0, 3));
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
    // The mallard's nest: under the mallard when it stands on dry land; when the map has it swimming, on the nearest
    // dry bank (never in the water), a few strides from it.
    const mallard = homes.nests.find((nest) => nest.form === "down_bowl" && nest.sitter);
    assert.ok(mallard, "the mallard has its nest");
    const sitter = places.get(mallard.sitter!)!;
    const onLand = !sitter.water && !sitter.micro && !sitter.canopy && surfaceAt(sitter.x, sitter.z).waterDepth === 0;
    if (onLand) assert.ok(sitter.x === mallard.x && sitter.z === mallard.z, "a ground nest under its sitter");
    else assert.ok(Math.hypot(sitter.x - mallard.x, sitter.z - mallard.z) < 30, "a ground nest on the bank near its swimming sitter");
    assert.equal(surfaceAt(mallard.x, mallard.z).waterDepth, 0, "on dry ground");
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

// MARK: - Nests by species, growing nests, sites, budget

import {eggLength, nestProfile as profileOf, nestRadius} from "@/ark-scene/props/nest-kinds";
import {nestSites, nestStage, registerNestSites, scheduledStage, seasonWindow, setNestStageSource, type NestSiteInfo} from "@/ark-scene/props/nest-growth";
import {eggGeometry, nestGeometry, STRAND_FORMS} from "@/ark-scene/props/nest-shapes";
import {buildCave} from "@/ark-scene/props/cave";
import {triangles} from "@/ark-scene/props/kit";
import {arkBody} from "@/ark-scene/stats";
import {allAttachPoints, place as namedPlace, surfaceAt} from "@/ark-scene/sampler";
import {COTTAGE} from "@/ark-scene/micro-decor";

test("props nests by species: the form, the site and the size follow the bird (a weaver's purse is not an eagle's eyrie)", () => {
    const weaver = profileOf(animal("village-weaver", "grassland"));
    const eagle = profileOf(animal("golden-eagle", "mountains"));
    assert.equal(weaver.form, "pendant");
    assert.equal(weaver.site, "branch_tip");
    assert.ok(weaver.colony > 1);
    assert.equal(eagle.form, "eyrie");
    assert.equal(eagle.site, "cliff_ledge");
    assert.ok(eagle.carriedOver > 0, "an eyrie is added to year after year");
    const size = (slug: string) => {
        const body = arkBody({model_slug: slug}, "bird");
        return nestRadius(profileOf(animal(slug, "grassland")), Math.max(body.metres * 1.35, body.display * 0.3));
    };
    assert.ok(size("golden-eagle") > 2.5 * size("village-weaver"), `eyrie ${size("golden-eagle").toFixed(2)} vs purse ${size("village-weaver").toFixed(2)}`);
    assert.ok(size("golden-eagle") > 0.7 && size("golden-eagle") < 1.6);
    const cases: Array<[string, ArkAnimal["zone"], string, string]> = [
        ["mallard", "river_lake", "down_bowl", "ground"],
        ["grey-heron", "wetland", "platform", "tree_top"],
        ["african-fish-eagle", "river_lake", "eyrie", "tree_top"],
        ["red-tailed-hawk", "woodland", "platform", "tree_top"],
        ["great-crested-grebe", "river_lake", "floating", "water_margin"],
        ["atlantic-puffin", "seashore", "burrow", "bank"],
        ["scarlet-macaw", "rainforest", "hole", "trunk_hole"],
        ["common-house-martin", "farm_garden", "mud_cup", "eaves"],
        ["barn-swallow", "farm_garden", "mud_cup", "eaves"],
        ["house-sparrow", "farm_garden", "ball", "eaves"],
        ["eurasian-wren", "woodland", "dome", "tree_fork"],
        ["american-flamingo", "wetland", "mound", "shore"],
        ["mute-swan", "river_lake", "mound", "water_margin"],
        ["herring-gull", "seashore", "scrape", "shore"],
        ["peregrine-falcon", "mountains", "scrape", "cliff_ledge"],
        ["common-guillemot", "seashore", "scrape", "cliff_ledge"],
        ["adelie-penguin", "polar", "pebbles", "ground"],
        ["ruby-throated-hummingbird", "woodland", "cup", "tree_fork"],
        ["australian-brush-turkey", "rainforest", "megapode", "ground"]
    ];
    for (const [slug, zone, form, site] of cases) {
        const profile = profileOf(animal(slug, zone));
        assert.equal(profile.form, form, slug);
        assert.equal(profile.site, site, slug);
    }
    assert.equal(profileOf(animal("common-cuckoo", "woodland")).form, "none");
    assert.equal(profileOf(animal("emperor-penguin", "polar")).form, "none");
    assert.equal(profileOf(animal("common-house-martin", "farm_garden")).closed, true);
    // An egg is about a tenth of its layer.
    assert.ok(eggLength(1) > 0.08 && eggLength(1) < 0.14);
});

test("props nest growth: nestStage(speciesId, siteId, t) is deterministic, grows through the season's start, is finished with eggs, and a recipe can drive it", () => {
    const site: NestSiteInfo = {speciesId: "heron", siteId: "leaf:decor1:0", slug: "grey-heron", zone: "wetland", form: "platform", position: {x: 0, y: 0, z: 0}, up: {x: 0, y: 1, z: 0}, radius: 0.6, sitter: null, eggs: 0, chicks: 0, buildDays: 5, carriedOver: 0};
    const [from, to] = seasonWindow("wetland");
    // Before the season: a finished nest if shown at all; in it before building starts: nothing yet.
    assert.equal(scheduledStage(site, from - 10), 1);
    assert.equal(scheduledStage(site, from + 0.001), 0);
    let previous = 0;
    let middle = false;
    for (let day = from; day <= from + 20; day += 0.25) {
        const stage = scheduledStage(site, day);
        assert.ok(stage >= previous - 1e-9, `never shrinks (day ${day})`);
        if (stage > 0.2 && stage < 0.8) middle = true;
        previous = stage;
    }
    assert.ok(middle, "it is seen half built");
    assert.equal(scheduledStage(site, from + 20), 1);
    assert.equal(scheduledStage(site, to - 1), 1);
    // A year later, the same day of the Ark's year: the same stage (the Ark year is 365 Ark days).
    assert.equal(scheduledStage(site, from + 3.3), scheduledStage(site, from + 3.3 + 365));
    // Eggs or chicks: finished. An eyrie starts from what is left of last year's.
    assert.equal(scheduledStage({...site, eggs: 3}, from + 0.5), 1);
    assert.ok(scheduledStage({...site, form: "eyrie", carriedOver: 0.65}, from + 0.001) >= 0.65);
    // Registered sites answer by ids; a recipe's source overrides, null falls back, eggs always win.
    registerNestSites([site, {...site, siteId: "leaf:decor2:0", eggs: 2}]);
    assert.equal(nestSites().length, 2);
    assert.equal(nestStage("heron", "leaf:decor1:0", from + 0.001), 0);
    try {
        setNestStageSource((speciesId, siteId, t) => (siteId === "leaf:decor1:0" ? Math.min((t - from) / 10, 1) : null));
        assert.equal(nestStage("heron", "leaf:decor1:0", from + 4), 0.4);
        assert.equal(nestStage("heron", "leaf:decor2:0", from + 4), 1);
        assert.equal(nestStage("unknown", "nowhere", from + 4), 1);
    } finally {
        setNestStageSource(null);
        registerNestSites([]);
    }
});

test("props nest shapes: every form carries its build order, grows base first, and stays within a phone's budget", () => {
    for (const form of STRAND_FORMS) {
        const geometry = nestGeometry(form, form === "down_bowl" ? "down" : "grass", {closed: form === "mud_cup"});
        const build = geometry.getAttribute("aBuild");
        assert.ok(build && build.count === geometry.getAttribute("position").count, form);
        let early = 0;
        let lowSum = 0;
        let lowCount = 0;
        let highSum = 0;
        let highCount = 0;
        for (let i = 0; i < build.count; i++) {
            const b = build.getX(i);
            assert.ok(b >= 0 && b <= 1, `${form} build ${b}`);
            if (b <= 0.5) early++;
            const y = geometry.getAttribute("position").getY(i);
            if (b < 0.3) {
                lowSum += y;
                lowCount++;
            } else if (b > 0.7) {
                highSum += y;
                highCount++;
            }
        }
        const share = early / build.count;
        assert.ok(share > 0.05 && share < 0.95, `${form}: ${(share * 100).toFixed(0)}% built by half way`);
        // Base first: what goes down early sits lower than what goes on last (a pendant hangs, so it is built from the top).
        if (lowCount && highCount && form !== "pendant" && form !== "ball" && form !== "dome" && form !== "floating" && form !== "scrape") assert.ok(lowSum / lowCount <= highSum / highCount + 0.05, `${form} grows from its base`);
        assert.ok(triangles(geometry) < 7000, `${form}: ${triangles(geometry)} triangles`);
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        assert.ok(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) < 1.8, `${form} stays about its radius`);
    }
    // Eggs are smooth (not faceted pebbles): a triangle's corners have different normals.
    const egg = eggGeometry(0.06);
    const normal = egg.getAttribute("normal");
    assert.ok(Math.abs(normal.getY(0) - normal.getY(1)) + Math.abs(normal.getX(0) - normal.getX(1)) > 1e-4);
});

test("props nest sites: through the scenery sampler, on the right ground, the same for every viewer", () => {
    const snapshot = propsFixture(decodeArkSnapshot(fixture)!);
    const places = placeAnimals(snapshot.animals);
    const presence = propsPresence(snapshot);
    const homes = buildHomes(presence, (id) => places.get(id) ?? null, PROPS_TIERS.high);
    const forms = new Set(homes.nests.map((nest) => nest.form));
    for (const form of ["down_bowl", "eyrie", "platform", "pendant", "mud_cup", "ball", "floating", "hole", "burrow", "barn"]) assert.ok(forms.has(form as never), `a ${form} is drawn`);
    // Every bird of the fixture that builds gets its nest.
    for (const plan of presence.nests) assert.ok(homes.nests.some((nest) => nest.key === plan.key), plan.slug);
    for (const nest of homes.nests) {
        const surface = surfaceAt(nest.x, nest.z);
        switch (nest.site) {
            case "tree_top":
            case "tree_fork":
            case "branch_tip":
                // On the scenery's own tree points (the graphics lane's sampler), never an offset of ours.
                assert.match(nest.siteId, /^(leaf|branch|canopy):/, nest.siteId);
                assert.ok(nest.y > surface.height + 1, `${nest.form} up a tree`);
                break;
            case "trunk_hole":
                assert.match(nest.siteId, /^(bark|tree_hollow):/);
                // A drawn tree hollow near the bird is taken first.
                if (allAttachPoints().some((point) => point.tag === "tree_hollow" && Math.hypot(point.position.x - nest.x, point.position.z - nest.z) < 80)) assert.match(nest.siteId, /^tree_hollow:/);
                break;
            case "ground":
            case "shore":
                assert.equal(surface.waterDepth, 0, `${nest.form} on dry ground`);
                assert.ok(Math.abs(nest.y - surface.height) < nest.radius + 0.1, `${nest.form} on the ground`);
                break;
            case "water_margin":
                assert.ok(surface.waterDepth > 0, `${nest.form} in the water`);
                break;
            case "cliff_ledge":
                assert.ok(Math.abs(nest.y - surface.height) < nest.radius, "seated on the shelf");
                assert.ok(surface.normal.y > 0.8, "a level shelf");
                break;
            case "eaves":
                assert.ok(Math.hypot(nest.x - COTTAGE.x, nest.z - COTTAGE.z) < Math.hypot(COTTAGE.width, COTTAGE.depth), "at the cottage");
                // Under the sampler's eave point (the drawn roof's underside: the slope on the long walls, the verge's peak on the gables).
                assert.ok(nest.y < COTTAGE.floor + COTTAGE.wall + COTTAGE.ridge, "under the roof");
                // Wholly under the drawn roof: its top under the roof's underside at the nest's front edge.
                {
                    const eave = allAttachPoints().find((point) => point.tag === "house_eave" && nest.siteId.startsWith(`${point.id}:`))!;
                    assert.ok(eave, nest.siteId);
                    const slope = Math.hypot(eave.normal.x, eave.normal.z) / Math.abs(eave.normal.y);
                    const out = COTTAGE.overhang * 0.6;
                    const front = nest.radius * (nest.form === "ball" ? 1.4 : 1.02);
                    const top = nest.y + nest.radius * (nest.form === "ball" ? 1.9 : 1.32);
                    assert.ok(top < eave.position.y + (out - front) * slope, `${nest.siteId}: top ${top.toFixed(3)} under the roof`);
                }
                break;
            case "bank":
                assert.match(nest.siteId, /^burrow:/);
                break;
        }
    }
    const again = buildHomes(presence, (id) => places.get(id) ?? null, PROPS_TIERS.high);
    assert.deepEqual(again.nests, homes.nests);
    // The turtles' nest is on dry sand above the water, not by the garden.
    const turtle = homes.marks.turtleNest;
    assert.ok(turtle && surfaceAt(turtle.x, turtle.z).waterDepth === 0 && surfaceAt(turtle.x, turtle.z).height > 0.8);
    assert.ok(Math.hypot(turtle.x - COTTAGE.x, turtle.z - COTTAGE.z) > 15);
    homes.dispose();
    again.dispose();
});

test("props budget: draw calls and triangles at each tier, at the busiest places (reported)", () => {
    const snapshot = propsFixture(decodeArkSnapshot(fixture)!);
    const places = placeAnimals(snapshot.animals);
    const presence = propsPresence(snapshot);
    const report: string[] = [];
    const worst: Record<string, {calls: number; tris: number}> = {};
    for (const tierName of ["high", "medium", "low"] as const) {
        const tier = PROPS_TIERS[tierName];
        const areas = buildAreas(tier);
        const cave = buildCave(tier);
        const homes = buildHomes(presence, (id) => places.get(id) ?? null, tier);
        homes.setNestStages(null);
        worst[tierName] = {calls: 0, tris: 0};
        for (const name of ["house", "fields", "mountain", "beach", "lake", "grassland", "woodland", "wetland", "island_middle"] as const) {
            const at = namedPlace(name);
            const eye = {x: at.x + 6, y: at.y + 4, z: at.z + 6};
            let calls = 0;
            let tris = 0;
            for (const batch of [...areas.batches, ...homes.batches]) {
                batch.setTier(tier);
                batch.update(eye.x, eye.y, eye.z);
                const drawn = batch.drawn();
                if (drawn.near) {
                    calls++;
                    tris += drawn.near * triangles(batch.near.geometry);
                }
                if (drawn.far && batch.far) {
                    calls++;
                    tris += drawn.far * triangles(batch.far.geometry);
                }
            }
            for (const piece of [...areas.pieces, ...cave.pieces]) {
                piece.setTier(tier);
                piece.update(eye.x, eye.y, eye.z);
                if (piece.near.visible) {
                    calls++;
                    tris += triangles(piece.near.geometry);
                } else if (piece.far?.visible) {
                    calls++;
                    tris += triangles(piece.far.geometry);
                }
            }
            if (calls > worst[tierName].calls) worst[tierName].calls = calls;
            if (tris > worst[tierName].tris) worst[tierName].tris = tris;
            report.push(`${tierName} ${name}: ${calls} calls, ${tris} tris`);
        }
        areas.dispose();
        cave.dispose();
        homes.dispose();
    }
    console.log(`props budget (worst per tier): ${JSON.stringify(worst)}\n${report.join("\n")}`);
    // The phone tiers (medium on a mid-range phone, low on battery saver): a small share of the scene's ~100–170 calls and 1–2 M triangles.
    assert.ok(worst.medium.calls <= 45 && worst.medium.tris <= 400_000, JSON.stringify(worst.medium));
    assert.ok(worst.low.calls <= 30 && worst.low.tris <= 200_000, JSON.stringify(worst.low));
});

// MARK: - Home plots and fence posts

import {readFileSync} from "node:fs";
import {defaultHomePlots, fencePostTops, PADDOCK_POST_TOP, paddockRect, paddockSegments, PICKET_POST_TOP, picketPosts, plotFrame, type HomePlot} from "@/ark-scene/props/home-layout";

test("props home layout: fence post tops for the sampler, from a pure module, the same posts the areas draw", () => {
    // Pure: no sampler (the sampler imports it), no three.js.
    const source = readFileSync("src/ark-scene/props/home-layout.ts", "utf8");
    assert.ok(!/from "@\/ark-scene\/sampler"/.test(source) && !/from "three"/.test(source));
    const plots = defaultHomePlots();
    assert.deepEqual(plots.map((plot) => plot.kind), ["house", "smallholding"]);
    const posts = fencePostTops(plots);
    const paddock = posts.filter((post) => post.fence === "paddock");
    const picket = posts.filter((post) => post.fence === "picket");
    assert.equal(paddock.length, paddockSegments(paddockRect(plots[1])).filter((segment) => !segment.gate).length);
    assert.equal(picket.length, picketPosts().length);
    assert.deepEqual(paddock.map((post) => post.n), paddock.map((_, i) => i));
    for (const post of posts) {
        const top = post.fence === "paddock" ? PADDOCK_POST_TOP : PICKET_POST_TOP;
        assert.ok(Math.abs(post.position.y - (sampleGround(post.position.x, post.position.z).height + top)) < 1e-6, "a post's top over its ground");
        assert.ok(Math.abs(Math.hypot(post.forward.x, post.forward.z) - 1) < 1e-6 && post.forward.y === 0, "forward along the fence, level");
    }
    assert.deepEqual(fencePostTops(plots), posts);
});

test("props home plots: every plot gets its own garden or yard, paddock, coop and fences, seeded by its id", () => {
    const base = defaultHomePlots();
    const house = base[0];
    const yard = base[1];
    // Two more plots of the hamlet, as the map lane would lay them (along the farm's side, turned).
    const extra: HomePlot[] = [
        {id: "house-1", kind: "house", x: house.x - 14, z: house.z + 4, rotation: 0.6},
        {id: "smallholding-1", kind: "smallholding", x: yard.x + 22, z: yard.z - 6, rotation: -0.4}
    ];
    const plots = [...base, ...extra];
    const areas = buildAreas(PROPS_TIERS.high, plots);
    const names = areas.pieces.map((piece) => piece.name);
    for (const id of ["house-0", "house-1"]) assert.ok(names.includes(`garden:${id}`), id);
    for (const id of ["smallholding-0", "smallholding-1"]) assert.ok(names.includes(`farm:${id}`) && names.includes(`trough-water:${id}`), id);
    assert.equal(areas.batches.find((batch) => batch.name === "coops")?.count, 2);
    assert.equal(areas.batches.find((batch) => batch.name === "troughs")?.count, 4);
    // Fences for every plot, numbered over the plots in order.
    const posts = fencePostTops(plots);
    assert.equal(new Set(posts.map((post) => post.plot)).size, 4);
    // A plot's frame: local +z of a turned plot points along its rotation.
    const frame = plotFrame(extra[0]);
    const ahead = frame.toWorld(0, 1);
    assert.ok(Math.abs(ahead.x - (extra[0].x + Math.sin(0.6))) < 1e-9 && Math.abs(ahead.z - (extra[0].z + Math.cos(0.6))) < 1e-9);
    // Deterministic per plot id: the same plots, the same layout; the cottage's own plot as before.
    const again = buildAreas(PROPS_TIERS.high, plots);
    assert.deepEqual(again.pieces.map((piece) => piece.near.geometry.getAttribute("position").count), areas.pieces.map((piece) => piece.near.geometry.getAttribute("position").count));
    const only = buildAreas(PROPS_TIERS.high, base);
    assert.equal(only.pieces.find((piece) => piece.name === "garden:house-0")!.near.geometry.getAttribute("position").count, areas.pieces.find((piece) => piece.name === "garden:house-0")!.near.geometry.getAttribute("position").count);
    areas.dispose();
    again.dispose();
    only.dispose();
});

// MARK: - The hamlet's buildings

import {createHash} from "node:crypto";
import type {BufferGeometry as Geometry} from "three";
import {COTTAGE_STYLE, cottageGeometry} from "@/ark-scene/micro-scene";
import {BARN_STYLE, barnGeometry} from "@/ark-scene/vegetation";
import {barnStyle, cottageStyle} from "@/ark-scene/props/home-layout";
import {hamletGeometry} from "@/ark-scene/props/hamlet-buildings";
import {homePlots} from "@/ark-scene/map/hamlet";

const geometryHash = (geometry: Geometry) => {
    const h = createHash("sha256");
    for (const name of Object.keys(geometry.attributes).sort()) {
        const array = geometry.getAttribute(name).array as Float32Array;
        h.update(name);
        h.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    }
    return h.digest("hex").slice(0, 16);
};

test("props hamlet: today's cottage and barn byte-identical from the shared builders; every other plot its own look; lit glass", () => {
    // The hashes of today's meshes, taken before the builders were factored out (micro-scene.ts, vegetation.ts).
    const cottage = cottageGeometry(COTTAGE_STYLE);
    assert.equal(geometryHash(cottage.house), "c764629f617cacde");
    assert.equal(geometryHash(cottage.glass), "c4460e6c3837436d");
    assert.equal(geometryHash(barnGeometry(BARN_STYLE)), "1c5c96232f09e8b1");
    assert.equal(geometryHash(barnGeometry()), "1c5c96232f09e8b1");
    // The first plots keep today's look; the hamlet at 1× (7 houses, 3 smallholdings) is not one building cloned.
    const plots = homePlots(7 * 130, 3 * 50);
    assert.equal(plots.filter((plot) => plot.kind === "house").length, 7);
    assert.equal(plots.filter((plot) => plot.kind === "smallholding").length, 3);
    assert.deepEqual({...cottageStyle(plots[0]), scale: 1}, {...COTTAGE_STYLE, scale: 1});
    const houses = plots.filter((plot) => plot.kind === "house" && plot.id !== "house-0").map((plot) => JSON.stringify(cottageStyle(plot)));
    assert.equal(new Set(houses).size, houses.length, "every new cottage its own look");
    for (const plot of plots.filter((p) => p.kind === "house")) assert.ok(cottageStyle(plot).scale >= 0.9 && cottageStyle(plot).scale <= 1);
    const farms = plots.filter((plot) => plot.kind === "smallholding" && plot.id !== "smallholding-0").map((plot) => JSON.stringify(barnStyle(plot)));
    assert.equal(new Set(farms).size, farms.length);
    // Two draw calls' worth: the buildings (6 cottages, 2 barns or sheds) and the windows' glass.
    const built = hamletGeometry(plots);
    assert.ok(built.buildings && built.glass);
    const tris = (geometry: Geometry) => geometry.getAttribute("position").count / 3;
    const one = tris(cottage.house);
    assert.ok(tris(built.buildings!) > one * 4 && tris(built.buildings!) < one * 6 + 3000, `${tris(built.buildings!)} triangles (one cottage ${one})`);
    assert.equal(tris(built.glass!), tris(cottage.glass) * 6);
    // Deterministic.
    assert.equal(geometryHash(hamletGeometry(plots).buildings!), geometryHash(built.buildings!));
});

// MARK: - The decor thinned on the hamlet's reserved plots

import {hamletLandAt, hamletLotAt, hamletLotsGlsl} from "@/ark-scene/props/hamlet-land";
import footprintTable from "@/ark-scene/props/hamlet-footprints.json";
import {plotFootprint, reservedPlots} from "@/ark-scene/map/hamlet";
import {cropAt, fieldsGlsl} from "@/ark-scene/fields";
import {grassTufts} from "@/ark-scene/decor";

test("props hamlet land: the baked footprints are still the map's; no crops on a reserved plot, no grass under its buildings, the decor's ids untouched", () => {
    const baked = (footprintTable as unknown as {footprints: Record<string, Array<[number, number]>>}).footprints;
    const slots = reservedPlots().slice(2);
    assert.equal(Object.keys(baked).length, slots.length);
    for (const plot of slots) {
        const live = plotFootprint(plot);
        baked[plot.id].forEach(([x, z], i) => assert.ok(Math.abs(x - live[i].x) < 0.002 && Math.abs(z - live[i].z) < 0.002, `${plot.id} corner ${i}`));
        assert.equal(hamletLandAt(plot.x, plot.z), "core", plot.id);
        assert.ok(hamletLotAt(plot.x, plot.z));
    }
    let lots = 0;
    for (let x = -100; x <= 100; x += 1.5) {
        for (let z = -100; z <= 100; z += 1.5) {
            if (!hamletLotAt(x, z)) continue;
            lots++;
            assert.equal(cropAt(x, z), null, `no crop at ${x}, ${z}`);
        }
    }
    assert.ok(lots > 300, `${lots} samples on the lots`);
    // The shader's twin is there (a test per footprint), and the field shader calls it.
    assert.equal((hamletLotsGlsl().match(/return true/g) ?? []).length, slots.length);
    assert.ok(fieldsGlsl().includes("arkHamletLot(p)"));
    const tufts = grassTufts(30000);
    assert.equal(tufts.filter((tuft) => hamletLandAt(tuft.x, tuft.z) === "core").length, 0);
    // The decor's own items are not moved or removed (their ids, `decor<n>`, stay).
    assert.equal(worldDecor().filter((item) => item.kind === "flower" && hamletLandAt(item.x, item.z)).length, 0);
});
