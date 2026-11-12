import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {coastNorm, landArea, TOWN_HALF, TOWN_SEGMENTS, townPlan, townPlanMisses} from "@/ark-scene/islands/town/plan";
import {sampleTownGround, townHeight} from "@/ark-scene/islands/town/ground";
import {TOWN_CHUNK_COUNT, TOWN_GRID, townChunkOf} from "@/ark-scene/islands/town/chunks";
import {binsOut, carAt, clockHands, collectionDay, marketDay, townClockAt, washingOut, weekday, windowLit, type TownClock} from "@/ark-scene/islands/town/people";
import {binSpots, carSpots, farmOf, householdOf, launchEnclosures, openZooSlots, TOWN_HABITATS_BY_ZONE, townAreas, townHouseholds, urbanNiche, zooLayout} from "@/ark-scene/islands/town/areas";
import {enclosuresOpen, launchResidents, ZOO_ENCLOSURE_TYPES, ZOO_LAUNCH_TOTAL, ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";
import {townObstacles, townObstaclesJSON} from "@/ark-scene/islands/town/obstacles";
import {validateTown} from "@/ark-scene/islands/town/validate";
import {ARK_ISLANDS, islandOfAnimal, openingIsland, toArchipelago} from "@/ark-scene/islands";
import {hashText, inPoly} from "@/ark-scene/islands/town/geom";

/**
 * The town, countryside and zoo island (Part C, docs/ark/town-island.md): the plan is whole and the same every time,
 * true to the islands plan's counts, on Part B's grid; the validator passes; the people-implied schedules are pure
 * functions of the island clock; the placement areas hold their animals and never move.
 */

/** The real snapshot, read in place for its house and farm counts only (never copied); skipped where it is not. */
const SNAPSHOT = process.env.ARK_REAL_SNAPSHOT ?? "/private/tmp/claude-501/-Users-lennybeadle-AnimalDex/7421b37c-3c90-44f1-9509-5a92e292d95d/scratchpad/wt-view/public/ark-local/real.json";

test("the plan is whole: every home, farm and enclosure placed", () => {
    assert.deepEqual(townPlanMisses(), []);
    const plan = townPlan();
    const homes = plan.buildings.filter((b) => b.kind === "house" || b.kind === "terrace" || b.kind === "flats");
    assert.equal(plan.buildings.reduce((sum, b) => sum + b.households, 0), 360, "360 households");
    assert.ok(homes.length >= 115 && homes.length <= 125, `about 120 home buildings (${homes.length})`);
    assert.equal(plan.buildings.filter((b) => b.kind === "house").length, 72);
    assert.equal(plan.farms.length, 10);
    assert.equal(plan.farms.filter((f) => f.kind === "farmstead").length, 2);
    // Every home has a garden, a yard or a courtyard.
    for (const p of plan.parcels) assert.ok(p.back || p.front, `${p.id} has a garden`);
    // An old town: a church with a tower, a town hall, shops, a pub, a mill; a canal with bridges; a harbour.
    for (const kind of ["church", "hall", "mill", "shop", "lighthouse", "fish_shed"]) assert.ok(plan.buildings.some((b) => b.kind === kind), kind);
    assert.ok(plan.buildings.filter((b) => b.shopfront).length >= 6, "shopfronts on the high street and the square");
    assert.ok(plan.streets.some((s) => s.id === "high_street"));
});

test("the plan is the same every time (a pure function of the code)", () => {
    const plan = townPlan();
    const fingerprint = (p: typeof plan) => hashText(JSON.stringify({b: p.buildings.map((b) => [b.id, b.at.x.toFixed(3), b.at.z.toFixed(3), b.at.rot.toFixed(4)]), s: p.zoo.slots.map((s) => [s.id, s.at.x.toFixed(3), s.at.z.toFixed(3)]), t: p.trees.length}));
    const first = fingerprint(plan);
    assert.equal(fingerprint(townPlan()), first);
    // Rebuilding from scratch (a fresh module instance would) gives the same: the plan reads no clock and no random.
    const source = readFileSync(path.join(process.cwd(), "src/ark-scene/islands/town/plan.ts"), "utf8");
    assert.ok(!/Math\.random|Date\.now|performance\.now/.test(source), "no randomness or clocks in the plan");
});

test("the zoo: 13 enclosure types, the plan's launch openings, slots as declared", () => {
    const plan = townPlan();
    assert.equal(ZOO_ENCLOSURE_TYPES.length, 13);
    assert.equal(ZOO_LAUNCH_TOTAL, 26);
    for (const type of ZOO_ENCLOSURE_TYPES) {
        const slots = plan.zoo.slots.filter((s) => s.type === type);
        assert.equal(slots.length, ZOO_TYPES[type].slots, type);
        assert.equal(enclosuresOpen(type, ZOO_TYPES[type].residents.today), ZOO_TYPES[type].launch, `${type} opens the plan's launch count`);
    }
    assert.equal(openZooSlots(launchResidents()).length, 26);
    // The server's names (`<type>-<n>`, n from 1) are the plan's slots; past a type's slots a spare, then sharing.
    const launch = zooLayout(launchEnclosures());
    assert.equal(launch.enclosures.length, 26);
    assert.equal(launch.closed.length, plan.zoo.slots.length - 26 + plan.zoo.spares.length);
    assert.ok(plan.zoo.slots.every((s) => s.id === `${s.type}-${s.rank + 1}`));
    const busy = zooLayout([...launchEnclosures(), "penguin_seal_pools-2", "small_mammals-4", "bears_wolves-4", "aviaries-9"]);
    const where = (id: string) => busy.enclosures.find((e) => e.id === id)!;
    assert.equal(where("penguin_seal_pools-2").place, "spare-1", "the lowest number first");
    assert.equal(where("small_mammals-4").place, "spare-2");
    assert.equal(where("bears_wolves-4").shared, true, "past the spares: shares its type's last slot");
    // An enclosure keeps its plot as others open after it.
    const more = zooLayout([...launchEnclosures(), "penguin_seal_pools-2", "small_mammals-4", "big_cats-3"]);
    assert.equal(more.enclosures.find((e) => e.id === "penguin_seal_pools-2")!.place, "spare-1");
    // Births never open one: opening depends only on arrived residents, capped at the slots.
    assert.equal(enclosuresOpen("aviaries", 10_000), ZOO_TYPES.aviaries.slots);
    assert.equal(enclosuresOpen("aviaries", 0), 0);
});

test("on Part B's grid: 9 × 9 chunks of 48 segments of 1.1 m", () => {
    assert.equal(TOWN_SEGMENTS, 432);
    assert.ok(Math.abs(TOWN_HALF - 237.6) < 1e-9);
    assert.ok(Math.abs(TOWN_GRID.size - 52.8) < 1e-9);
    assert.equal(TOWN_GRID.segments, 48);
    assert.equal(TOWN_CHUNK_COUNT, 81);
    assert.equal(townChunkOf(-TOWN_HALF + 1, -TOWN_HALF + 1), 0);
    assert.equal(townChunkOf(TOWN_HALF - 1, TOWN_HALF - 1), 80);
    assert.equal(townChunkOf(10_000, 0), townChunkOf(TOWN_HALF - 0.1, 0), "off the grid: the nearest edge chunk");
});

test("bounded land: about 12 ha, the sea all round inside the square", () => {
    const land = landArea(2);
    assert.ok(land > 110_000 && land < 135_000, `${(land / 10000).toFixed(2)} ha`);
    for (const [x, z] of [[-TOWN_HALF + 2, 0], [TOWN_HALF - 2, 0], [0, -TOWN_HALF + 2], [0, TOWN_HALF - 2]]) assert.ok(coastNorm(x, z) > 1, "the square's edge is sea");
    assert.ok(townHeight(TOWN_HALF - 2, 0) < -8, "deep water at the square's edge");
    assert.ok(Math.abs(townHeight(90, 20) - 2.6) < 0.4, "the town is flat at its level");
    assert.equal(sampleTownGround(4, 30).surface, "water", "the canal");
});

test("the validator passes with the real snapshot's house and farm counts", () => {
    let real: {house?: number; farm?: number} | undefined;
    if (existsSync(SNAPSHOT)) {
        const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as {animals: Array<{area?: string | null}>};
        real = {house: snapshot.animals.filter((a) => a.area === "house").length, farm: snapshot.animals.filter((a) => a.area === "farm").length};
    }
    const result = validateTown(undefined, real);
    assert.deepEqual(result.errors, []);
    assert.ok((result.metrics.houseOutdoorSpots as number) >= 800, "the plan's ~1,000 outdoor spots for the houses");
    assert.ok((result.metrics.tallPerches as number) >= 3, "tall buildings for peregrines");
});

test("people implied: lit windows follow the island's evening, not a random flicker", () => {
    const plan = townPlan();
    const homes = plan.buildings.filter((b) => b.households > 0).flatMap((b) => Array.from({length: b.households}, (_, h) => ({building: b.id, owner: "home" as const, household: h, floor: 0, seed: hashText(`${b.id}${h}`)})));
    const share = (clock: TownClock) => homes.filter((w) => windowLit(w, clock) > 0).length / homes.length;
    const day = 20406;
    assert.ok(share({hours: 13, day}) === 0, "no house lights at midday");
    assert.ok(share({hours: 21, day}) > 0.5, `most living rooms lit at 21:00 (${share({hours: 21, day})})`);
    assert.ok(share({hours: 3.5, day}) < 0.1, "few at 3:30");
    // Pure: the same moment gives the same answer.
    assert.equal(share({hours: 21, day}), share({hours: 21, day}));
});

test("people implied: cars, bins, washing, the market, the clock", () => {
    const spots = carSpots();
    assert.ok(spots.length > 150, `car spots (${spots.length})`);
    const parked = (clock: TownClock, kind: string) => spots.filter((s) => s.kind === kind && carAt(s, clock).parked).length / spots.filter((s) => s.kind === kind).length;
    const monday = 20406;
    assert.equal(weekday({hours: 0, day: monday}), 1);
    assert.ok(parked({hours: 12, day: monday}, "drive") < parked({hours: 23, day: monday}, "drive"), "drives emptier on a working day");
    // Kerbs change from day to day.
    const kerbs = spots.filter((s) => s.kind === "kerb");
    const taken = (day: number) => kerbs.filter((s) => carAt(s, {hours: 22, day}).parked).map((s) => s.id).join();
    assert.notEqual(taken(monday), taken(monday + 1));
    // Bins: out the evening before collection and that morning, in otherwise.
    const bin = binSpots()[0];
    const collect = collectionDay(bin.street);
    const dayOf = (wd: number) => monday + ((wd - 1 + 7) % 7);
    assert.equal(binsOut(bin.street, bin.id, {hours: 7, day: dayOf(collect)}), true);
    assert.equal(binsOut(bin.street, bin.id, {hours: 14, day: dayOf((collect + 3) % 7)}), false);
    assert.equal(marketDay({hours: 10, day: dayOf(6)}), true);
    assert.equal(marketDay({hours: 10, day: dayOf(1)}), false);
    const hands = clockHands({hours: 15, day: monday});
    assert.ok(Math.abs(hands.hour - Math.PI / 2) < 1e-9 && Math.abs(hands.minute) < 1e-9, "15:00: the hour hand at 3, the minute hand at 12");
    assert.equal(typeof washingOut("p", {hours: 11, day: monday}), "boolean");
    const clock = townClockAt(Date.UTC(2026, 10, 12, 21, 30));
    assert.ok(Math.abs(clock.hours - 21.5) < 1e-9);
    assert.equal(weekday(clock), 4, "2026-11-12 is a Thursday");
});

test("placement areas: households and farms hold still as the town fills; urban niches", () => {
    const households = townHouseholds();
    assert.equal(households.length, 360);
    const ids = Array.from({length: 300}, (_, i) => `animal-${i}`);
    const before = ids.map((id) => householdOf(id, false, households).id);
    // Nothing moves when more animals arrive: the assignment is per animal.
    const after = ids.map((id) => householdOf(id, false, households).id);
    assert.deepEqual(after, before);
    for (const id of ids) assert.notEqual(householdOf(id, false, households).kind, "flat", "dogs and cats live in houses and terraces");
    const farms = new Set(Array.from({length: 600}, (_, i) => farmOf(`calf-${i}`)));
    assert.equal(farms.size, 10, "every farm gets livestock");
    const areas = townAreas();
    for (const e of areas.enclosures) for (const s of areas.spots.filter((x) => x.place === e.slot.id)) assert.ok(inPoly(e.mask, s.x, s.z), `${e.slot.id} spot inside`);
    assert.deepEqual(urbanNiche("peregrine-falcon", "mountains").slice(0, 1), ["tall"]);
    assert.ok(urbanNiche("brown-rat", "farm_garden").includes("bin"));
    assert.ok(urbanNiche("herring-gull", "seashore").includes("quay"));
    assert.ok(urbanNiche("common-house-gecko", "farm_garden").includes("lamp_wall"));
    for (const zone of ["farm_garden", "woodland", "rainforest", "river_lake", "wetland", "seashore", "grassland", "desert", "mountains"]) assert.ok(TOWN_HABITATS_BY_ZONE[zone].length > 0, zone);
});

test("nav footprints: buildings closed, zoo fences hard, the canal water, bridges", () => {
    const obstacles = townObstacles();
    const buildings = obstacles.filter((o) => o.kind === "building");
    assert.equal(buildings.length, townPlan().buildings.length);
    const fences = obstacles.filter((o) => o.kind === "barrier" && (o.barrier === "zoo_fence" || o.barrier === "net"));
    assert.equal(fences.length, 26, "a hard fence round each enclosure open at launch (closed plots are lawn)");
    assert.equal(obstacles.filter((o) => o.kind === "enclosure").length, 26);
    for (const f of fences) assert.ok(f.kind === "barrier" && f.hard);
    assert.ok(obstacles.some((o) => o.kind === "water" && o.id === "canal"));
    const json = JSON.parse(townObstaclesJSON()) as {bridges: unknown[]; gates: unknown[]};
    assert.ok(json.bridges.length >= 4, `four bridges (${json.bridges.length})`);
    assert.ok(json.gates.length >= 72);
});

test("the islands: which island an animal lives on, where the page opens, the archipelago frame", () => {
    assert.equal(islandOfAnimal({island: "town"}), "town");
    assert.equal(islandOfAnimal({area: "house"}), "town");
    assert.equal(islandOfAnimal({area: "zoo"}), "town");
    assert.equal(islandOfAnimal({area: null}), "wild");
    assert.equal(openingIsland([]), "wild");
    assert.equal(openingIsland([{area: "house"}, {area: "house"}, {area: null}]), "town");
    // Decision 141: one world, the town across a 250 m strait of sea between the coasts (it was 1.5 km off, decision 69).
    const t = toArchipelago("town", 0, 0);
    assert.ok(Math.abs(Math.hypot(t.x, t.z) - (90.25 + 250 + 210.25)) < 0.2, "the town across the strait");
    assert.ok(t.x > 0 && t.z < 0, "east-north-east");
    assert.equal(ARK_ISLANDS.town.chunks, 9);
});
