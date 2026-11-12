import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {arkIslandsV3, arkIslandsWhere, withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkFocusAnimals} from "@/lib/ark-population";
import {arkEnclosureType, arkIslandCounts, arkIslandOf, arkIslandSnapshot, arkOpeningIsland, arkPlaceGroups, arkTwoIslands, arkWhereOf} from "@/lib/ark-islands";
import {mergeArkIslandsRouting, synthesiseArkIslands, T1_DESTINATIONS} from "@/lib/ark-islands-local";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {householdOf, farmOf, zooLayout} from "@/ark-scene/islands/town/areas";
import {inPoly} from "@/ark-scene/islands/town/geom";
import {ZOO_ENCLOSURE_TYPES} from "@/ark-scene/islands/town/zoo-types";
import type {ArkSnapshot} from "@/ark-scene/types";

/**
 * Part C on the web (islands plan §6, the T3 lane): the read's island fields, one island's slice shaped as
 * `voyage_public_v3`, the opening island (decision 26), "My animals" across both islands, and the town's placement
 * (homes, farms, zoo masks, niches): deterministic and never moved by who else is aboard.
 */

/** The fixture as the server answers it with islands on, decoded. */
function islandsFixture(): ArkSnapshot {
    return decodeArkSnapshot(withArkIslandsFixture(base))!;
}

test("islands off: one island, today's Ark unchanged", () => {
    const one = decodeArkSnapshot(base)!;
    assert.equal(arkTwoIslands(one), false);
    assert.equal(arkIslandSnapshot(one, "wild"), one, "the wild island is the read itself");
    assert.equal(arkIslandSnapshot(one, "town").animals.length, 0);
    assert.equal(arkOpeningIsland(one, {asked: "town"}), "wild");
    // A house animal in a one-island read stays on it (today's hamlet).
    assert.equal(arkIslandOf({area: "house"}, false), "wild");
});

test("the decoder reads island, enclosure and the islands counts (v3's shape)", () => {
    const raw = withArkIslandsFixture(base);
    const town = decodeArkSnapshot(arkIslandsV3(raw, "town"))!;
    const wild = decodeArkSnapshot(arkIslandsV3(raw, "wild"))!;
    assert.equal(town.island, "town");
    assert.equal(wild.island, "wild");
    assert.deepEqual(town.islands, wild.islands);
    assert.equal(town.islands!.wild + town.islands!.town, base.animals.length);
    assert.equal(town.animals.length + wild.animals.length, base.animals.length);
    assert.ok(town.animals.every((a) => a.island === "town"));
    assert.ok(wild.animals.every((a) => a.island === "wild" && a.area !== "zoo"));
    const zoo = town.animals.filter((a) => a.area === "zoo");
    assert.ok(zoo.length > 5, `the fixture has a zoo (${zoo.length})`);
    assert.ok(zoo.every((a) => arkEnclosureType(a.enclosure) !== null), "every zoo animal has its enclosure");
    assert.equal(town.islands!.zoo, zoo.length);
    assert.ok(arkTwoIslands(town) && arkTwoIslands(wild));
    // A slice of the whole read is the same as the server's one-island answer.
    const whole = islandsFixture();
    const sliced = arkIslandSnapshot(whole, "town");
    assert.deepEqual(sliced.animals.map((a) => a.id), town.animals.map((a) => a.id));
    assert.deepEqual(sliced.islands, town.islands);
    assert.deepEqual(arkIslandCounts(whole), town.islands);
});

test("the where read and ?focus=<animal>", () => {
    const raw = withArkIslandsFixture(base);
    const zooAnimal = (raw.animals as Array<Record<string, unknown>>).find((a) => a.area === "zoo")!;
    const where = arkWhereOf(arkIslandsWhere(raw, String(zooAnimal.id)));
    assert.ok(where);
    assert.equal(where!.island, "town");
    assert.equal(where!.area, "zoo");
    assert.equal(where!.enclosure, zooAnimal.enclosure);
    assert.equal(arkWhereOf({}), null);
    const whole = islandsFixture();
    assert.deepEqual(arkFocusAnimals(whole, String(zooAnimal.id)).map((a) => a.id), [zooAnimal.id]);
});

test("the opening island: asked, the focused animal's, else most of the viewer's (decision 26)", () => {
    const whole = islandsFixture();
    const mark = (ids: Set<string>): ArkSnapshot => ({...whole, animals: whole.animals.map((a) => ({...a, mine: ids.has(a.id)}))});
    const town = whole.animals.filter((a) => a.island === "town").map((a) => a.id);
    const wild = whole.animals.filter((a) => a.island === "wild").map((a) => a.id);
    assert.equal(arkOpeningIsland(mark(new Set())), "wild", "visitors without animals: the wild island");
    assert.equal(arkOpeningIsland(mark(new Set([town[0], town[1], wild[0]]))), "town");
    assert.equal(arkOpeningIsland(mark(new Set([town[0], wild[0]]))), "wild", "a tie: the wild island");
    assert.equal(arkOpeningIsland(mark(new Set([town[0], town[1]])), {asked: "wild"}), "wild");
    assert.equal(arkOpeningIsland(mark(new Set()), {focus: whole.animals.find((a) => a.island === "town")}), "town");
});

test("My animals across both islands, grouped by where they live", () => {
    const whole = islandsFixture();
    const groups = arkPlaceGroups(whole.animals, true);
    const keys = groups.map((g) => g.key);
    assert.equal(groups.reduce((n, g) => n + g.animals.length, 0), whole.animals.length);
    // The wild island's zones first, then home, farm, town wildlife, then the zoo by type.
    const firstTown = keys.findIndex((k) => k.startsWith("town:") || k.startsWith("zoo:"));
    assert.ok(keys.slice(0, firstTown).every((k) => k.startsWith("wild:")));
    const zooKeys = keys.filter((k) => k.startsWith("zoo:"));
    const order = zooKeys.map((k) => ZOO_ENCLOSURE_TYPES.indexOf(k.slice(4) as (typeof ZOO_ENCLOSURE_TYPES)[number]));
    assert.deepEqual(order, order.slice().sort((a, b) => a - b));
});

test("town placement: homes, farms, zoo masks and niches, deterministic and stable", () => {
    const town = arkIslandSnapshot(islandsFixture(), "town");
    const placed = placeTownAnimals(town.animals);
    assert.equal(placed.places.size, town.animals.length);
    const layout = zooLayout(placed.open);
    for (const animal of town.animals) {
        const place = placed.places.get(animal.id)!;
        const info = placed.town.get(animal.id)!;
        assert.ok(Number.isFinite(place.x) && Number.isFinite(place.z) && Number.isFinite(place.ground), animal.id);
        if (animal.area === "house") {
            assert.equal(info.area, "house");
            assert.ok(info.place === householdOf(animal.id, info.still) .id, `a pet lives with its household (${animal.model_slug})`);
        } else if (animal.area === "farm") {
            assert.equal(info.place, farmOf(animal.id));
        } else if (animal.area === "zoo") {
            const enclosure = layout.enclosures.find((e) => e.id === animal.enclosure);
            assert.ok(enclosure, `${animal.enclosure} is open`);
            assert.ok(info.enclosure && inPoly(info.enclosure.mask, place.x, place.z), `${animal.model_slug} inside ${animal.enclosure}'s mask`);
        } else {
            assert.ok(info.area === "garden_wildlife" || info.area === "urban_wildlife", `${animal.model_slug} as town wildlife`);
        }
    }
    // The same every time, and nobody moves when others leave.
    const again = placeTownAnimals(town.animals);
    for (const [id, p] of Array.from(placed.places)) assert.deepEqual(again.places.get(id), p);
    const fewer = town.animals.filter((_, i) => i % 4 !== 1);
    const after = placeTownAnimals(fewer);
    for (const animal of fewer) {
        const a = after.places.get(animal.id)!;
        const b = placed.places.get(animal.id)!;
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-9, `${animal.model_slug} kept its spot`);
    }
});

test("local preview: T1's routing merged by id at read time", () => {
    const raw = {snapshot: base, founders: {}};
    const routing = {animals: [{id: base.animals[0].id, island: "town", area: "zoo", enclosure: "aviaries-1"}]};
    const {merged, matched} = mergeArkIslandsRouting(raw, routing);
    assert.equal(matched, 1);
    const snapshot = decodeArkSnapshot((merged as {snapshot: unknown}).snapshot)!;
    const one = snapshot.animals.find((a) => a.id === base.animals[0].id)!;
    assert.equal(one.island, "town");
    assert.equal(one.enclosure, "aviaries-1");
    assert.equal(arkTwoIslands(snapshot), true);
    // The input is not changed.
    assert.equal((base.animals[0] as Record<string, unknown>).island, undefined);
});

/** The real Ark and T1's routing, read in place only (never copied); skipped where they are not. */
const LIVE = process.env.ARK_LIVE_SNAPSHOT ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/wt-view/public/ark-local/live.json";
const ROUTING = process.env.ARK_ISLANDS_ROUTING ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/real-ark/islands-routing.json";
const REAL = process.env.ARK_REAL_SNAPSHOT ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/wt-view/public/ark-local/real.json";
const SPECIES = process.env.ARK_ISLANDS_SPECIES ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/islands-species.json";

test("the real Ark on two islands: T1's routing merged, every town animal placed, the zoo inside its masks", {skip: !existsSync(LIVE) || !existsSync(ROUTING)}, () => {
    const routing = JSON.parse(readFileSync(ROUTING, "utf8")) as {animals: Array<{island: string; area: string | null}>; verify?: {living_by_destination?: Record<string, number>}};
    const {merged, matched} = mergeArkIslandsRouting(JSON.parse(readFileSync(LIVE, "utf8")), routing);
    const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
    assert.ok(matched >= whole.animals.length * 0.99, `ids match (${matched} of ${whole.animals.length})`);
    const counts = arkIslandCounts(whole);
    const town = arkIslandSnapshot(whole, "town");
    const wild = arkIslandSnapshot(whole, "wild");
    assert.equal(town.animals.length, counts.town);
    assert.equal(wild.animals.length, counts.wild);
    assert.ok(Math.abs(counts.wild - routing.animals.filter((a) => a.island === "wild").length) <= 5);
    const placed = placeTownAnimals(town.animals);
    let outside = 0;
    for (const animal of town.animals) {
        const info = placed.town.get(animal.id)!;
        const p = placed.places.get(animal.id)!;
        if (animal.area === "zoo" && !(info.enclosure && inPoly(info.enclosure.mask, p.x, p.z))) outside++;
    }
    assert.equal(outside, 0, "every zoo animal inside its enclosure's mask");
    assert.equal(placed.places.size, town.animals.length);
    console.log(`real Ark: wild ${counts.wild}, town ${counts.town} (zoo ${counts.zoo}), ${placed.open.length} enclosures open`);
});

test("the older local snapshot with islands synthesised near T1's counts", {skip: !existsSync(REAL) || !existsSync(SPECIES)}, () => {
    const {counts} = synthesiseArkIslands(JSON.parse(readFileSync(REAL, "utf8")), JSON.parse(readFileSync(SPECIES, "utf8")).species);
    for (const key of Object.keys(T1_DESTINATIONS) as Array<keyof typeof T1_DESTINATIONS>) {
        const want = T1_DESTINATIONS[key];
        assert.ok(Math.abs(counts[key] - want) <= Math.max(12, want * 0.08), `${key}: ${counts[key]} near ${want}`);
    }
});

test("the town's panel by place: homes, farms, the zoo's types, town wildlife by niche (decision T3-6)", async () => {
    const {arkTownGroupOf} = await import("@/lib/ark-islands");
    const {arkPopulation} = await import("@/lib/ark-population");
    const town = arkIslandSnapshot(islandsFixture(), "town");
    const grouping = (animal: (typeof town.animals)[number]) => {
        const g = arkTownGroupOf(animal);
        return {key: g.key, order: g.order, label: g.key};
    };
    const population = arkPopulation(town, grouping);
    const keys = population.regions.map((group) => group.place!.key);
    assert.ok(keys.every((key) => /^(homes|farms|zoo:[a-z_]+|gardens|water|roofs|walls|streets)$/.test(key)), keys.join(","));
    assert.equal(population.regions.reduce((n, g) => n + g.animals, 0), town.animals.length);
    // No zoo animal is listed under a wild zone, and the zoo's groups come in its types' order after homes and farms.
    for (const group of population.regions) for (const row of group.species) for (const a of row.animals) assert.equal(a.area === "zoo", group.place!.key.startsWith("zoo:"));
    assert.equal(arkTownGroupOf({area: null, enclosure: null, model_slug: "mallard", zone: "river_lake"}).group, "water");
    assert.equal(arkTownGroupOf({area: null, enclosure: null, model_slug: "peregrine-falcon", zone: "mountains"}).group, "roofs");
    assert.equal(arkTownGroupOf({area: null, enclosure: null, model_slug: "brown-rat", zone: "farm_garden"}).group, "streets");
    assert.equal(arkTownGroupOf({area: "zoo", enclosure: "aquarium-2", model_slug: "blue-tang", zone: "coral_reef"}).key, "zoo:aquarium");
});

test("the town on the behaviour schedule in the one world: its own walk grid at its origin, zoo trips inside the enclosure", async () => {
    const {townWorldSampler} = await import("@/ark-scene/islands/town/sampler");
    const {scheduleWorld, tripAt, poseOnTrip} = await import("@/ark-scene/behaviour-schedule");
    const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
    const {townWorldOrigin} = await import("@/ark-scene/islands");
    const origin = townWorldOrigin();
    const town = arkIslandSnapshot(islandsFixture(), "town");
    const placed = placeTownAnimals(town.animals);
    const sampler = townWorldSampler(placed.open, origin);
    const world = scheduleWorld(sampler);
    // The grid covers the town at its world origin: walkable land there, its ground the town's.
    let walkable = 0;
    for (let i = -100; i <= 100; i += 10) for (let j = -100; j <= 100; j += 10) if (world.nav.walkable(origin.x + i, origin.z + j)) walkable++;
    assert.ok(walkable > 150, `the town's middle is walkable on its own grid (${walkable} of 441)`);
    assert.equal(sampler.heightAt(origin.x, origin.z), (await import("@/ark-scene/islands/town/ground")).townHeight(0, 0));
    assert.ok(sampler.attachPoints("grass", {x: origin.x, z: origin.z, r: 60}).length > 20, "places near the middle, in the world frame");
    // Zoo animals' trips stay in (or within a step of) their enclosure; the same every time.
    const hours = (epoch: number) => ((epoch / 3600) % 24 + 24) % 24;
    let checked = 0;
    let far = 0;
    for (const animal of town.animals.filter((a) => a.area === "zoo").slice(0, 12)) {
        const info = placed.town.get(animal.id)!;
        if (info.still) continue;
        const p = placed.places.get(animal.id)!;
        const home = {x: p.x + origin.x, y: p.ground, z: p.z + origin.z};
        const sched = {id: animal.id, zone: animal.zone, home, length: 1, sea: false, range: Math.max(info.range, 0.6) * 1.5};
        const profile = behaviourProfile(animal.model_slug);
        for (let t = 1_763_000_000; t < 1_763_000_000 + 1200; t += 97) {
            const trip = tripAt(world, profile, sched, t, hours);
            const at = poseOnTrip(world, trip, t);
            const again = poseOnTrip(world, tripAt(world, profile, sched, t, hours), t);
            assert.deepEqual({x: at.x, z: at.z}, {x: again.x, z: again.z});
            const mask = info.enclosure!.mask;
            if (!inPoly(mask, at.x - origin.x, at.z - origin.z) && !at.aloft) far++;
            checked++;
        }
    }
    assert.ok(checked > 50);
    assert.ok(far / checked < 0.2, `zoo poses outside the mask before the scene's hard bound: ${far} of ${checked}`);
});

test("the zoo's day: feeding times on the island clock, the weekly and fast days, the station as home while fed", async () => {
    const {zooFeedingAt, feedingHome, WEEKLY_FEED_DAY, FAST_DAY, FEED_HOURS} = await import("@/ark-scene/islands/town/zoo-life");
    const {zooEnclosures} = await import("@/ark-scene/islands/town/areas");
    const clock = (hours: number, weekday: number) => ({hours, day: 7 * 3000 + weekday});
    assert.equal(zooFeedingAt("penguin_seal_pools", clock(11.1, 2))?.food, "fish");
    assert.equal(zooFeedingAt("penguin_seal_pools", clock(11 + FEED_HOURS + 0.01, 2)), null);
    assert.ok(Math.abs(zooFeedingAt("primate_house", clock(14.25, 1))!.eaten - 0.5) < 1e-9);
    assert.equal(zooFeedingAt("reptile_house", clock(12.1, (WEEKLY_FEED_DAY + 1) % 7)), null, "snakes and crocodiles once a week");
    assert.ok(zooFeedingAt("reptile_house", clock(12.1, WEEKLY_FEED_DAY)));
    assert.equal(zooFeedingAt("big_cats", clock(16.1, FAST_DAY)), null, "the big cats' fast day");
    assert.ok(zooFeedingAt("big_cats", clock(16.1, (FAST_DAY + 2) % 7)));
    for (const e of zooEnclosures()) {
        if (e.shared) continue;
        const home = feedingHome(e, () => 0);
        assert.ok(inPoly(e.mask, home.x, home.z) || inPoly(e.mask, (home.x + e.slot.at.x) / 2, (home.z + e.slot.at.z) / 2), `${e.id}: the station by its mask`);
        assert.ok(home.range >= 2 && home.range <= 5);
    }
});
