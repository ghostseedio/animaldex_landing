import assert from "node:assert/strict";
import test from "node:test";
import {abilitiesOf, controllable} from "@/ark-live/species";
import {DRAIN_PER_S, freshMeters, signals, stepMeters, regenPerS} from "@/ark-live/meters";
import {suitability} from "@/ark-live/habitat";
import {capFor, modesFor} from "@/ark-live/rules";
import {CELL, WATER_KIND, type TerrainCell} from "@/ark-live/terrain";

const near = (a: number, b: number, rel: number, what: string) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 0.02, `${what}: ${a.toFixed(3)} vs ${b} (±${rel * 100}%)`);

test("species caps match the design's table (§4.3) from the shipped data", () => {
    // [slug, walk, run, swim, fly]
    const table: Array<[string, number, number, number, number]> = [
        ["red-fox", 1.18, 3.6, 0, 0],
        ["golden-eagle", 1.39, 0, 0, 12.27],
        ["mallard", 0.72, 0, 2.01, 6.88],
        ["atlantic-salmon", 0, 0, 2.8, 0],
        ["spinner-dolphin", 0, 0, 4.25, 0],
        ["emperor-penguin", 0.24, 0.54, 2.59, 0],
        ["cheetah", 2.52, 7.83, 0, 0]
    ];
    for (const [slug, walk, run, swim, fly] of table) {
        const a = abilitiesOf(slug);
        near(a.walk, walk, 0.08, `${slug} walk`);
        near(a.run, run, 0.08, `${slug} run`);
        near(a.swim, swim, 0.08, `${slug} swim`);
        near(a.fly, fly, 0.08, `${slug} fly`);
        assert.ok(a.sprint <= 8 + 1e-9, `${slug} sprint under the scene's 8 m/s`);
    }
});

test("species: who has which modes (no fish on land, no flying fox, sessile never controlled)", () => {
    assert.deepEqual([...modesFor(abilitiesOf("atlantic-salmon"))].sort(), ["swim"]);
    assert.ok(abilitiesOf("atlantic-salmon").gills);
    const fox = modesFor(abilitiesOf("red-fox"));
    assert.ok(fox.has("ground") && fox.has("paddle") && !fox.has("air") && !fox.has("swim"), "a fox walks, wades and paddles a little, never flies or dives");
    const eagle = modesFor(abilitiesOf("golden-eagle"));
    assert.ok(eagle.has("air") && eagle.has("ground") && !eagle.has("swim"));
    assert.ok(abilitiesOf("golden-eagle").diver, "an eagle stoops");
    const duck = modesFor(abilitiesOf("mallard"));
    assert.ok(duck.has("air") && duck.has("paddle") && duck.has("swim") && duck.has("ground"));
    assert.ok(!abilitiesOf("african-bush-elephant").canBurrow, "the elephant's listed burrow is a data quirk (§4.1)");
    assert.equal(abilitiesOf("red-fox").fovClass, "hunter");
    assert.equal(abilitiesOf("red-fox").fov, 80);
    assert.equal(abilitiesOf("roe-deer").fovClass, "prey");
    assert.equal(abilitiesOf("roe-deer").fov, 115);
    assert.ok(controllable("red-fox") && controllable("atlantic-salmon"));
});

test("species: sessile animals are watch-only (D16)", async () => {
    const table = (await import("@/ark-scene/behaviours.json")).default as {species: Record<string, string>};
    const sessile = Object.entries(table.species).filter(([, row]) => row.split("|")[0] === "sessile").map(([slug]) => slug);
    assert.ok(sessile.length > 0);
    for (const slug of sessile) assert.equal(controllable(slug), false, slug);
});

test("meters: drains by mode and habitat, regeneration at rest, exposure times (§5.2)", () => {
    const step = (kind: keyof typeof DRAIN_PER_S, s: number, seconds: number, start = freshMeters()) => {
        let m = start;
        for (let i = 0; i < seconds * 10; i++) m = stepMeters(m, {kind, s, dt: 0.1, nowS: i / 10});
        return m;
    };
    near(1 - step("walk", 1, 100).stamina, 0.1, 0.02, "walk 100 s at home: 10 %");
    near(1 - step("walk", 0.3, 100).stamina, 0.24, 0.02, "walk 100 s at S 0.3: 24 %");
    near(1 - step("sprint", 1, 10).stamina, 0.2, 0.02, "sprint 10 s: 20 %");
    near(regenPerS(1), 0.01, 0.001, "1 %/s at home");
    near(regenPerS(0.3), 0.003, 0.001, "0.3 %/s at S 0.3");
    assert.equal(regenPerS(0.15), 0);
    // Exposure: to 1 after about 33 min at S 0.3, 22 min at S 0.15.
    let m = freshMeters();
    let t = 0;
    while (m.exposure < 1 && t < 4000) {
        m = stepMeters(m, {kind: "idle", s: 0.3, dt: 1, nowS: t});
        t++;
    }
    near(t, 2000, 0.02, "seconds to full exposure at S 0.3");
    m = freshMeters();
    t = 0;
    while (m.exposure < 1 && t < 4000) {
        m = stepMeters(m, {kind: "idle", s: 0.15, dt: 1, nowS: t});
        t++;
    }
    near(t, 1333, 0.02, "seconds to full exposure at S 0.15");
    // Back home it falls.
    const down = stepMeters({stamina: 1, exposure: 0.5, lyingUntil: 0}, {kind: "idle", s: 1, dt: 60, nowS: 0});
    near(down.exposure, 0.4, 0.01, "falls 1/600 a second");
});

test("meters: the thresholds the player sees, and lying down at zero stamina", () => {
    assert.ok(signals({stamina: 0.5, exposure: 0, lyingUntil: 0}, 0).breathless);
    const tired = signals({stamina: 0.3, exposure: 0, lyingUntil: 0}, 0);
    assert.ok(tired.exhausted && tired.noRun && tired.walkFactor === 0.6);
    // Distressed: stopped for 3 s of every 10.
    const held = [0, 1, 2, 3, 5, 9].map((s) => signals({stamina: 0.1, exposure: 0, lyingUntil: 0}, 100 + s).held);
    assert.deepEqual(held, [true, true, true, false, false, false]);
    assert.ok(signals({stamina: 1, exposure: 0.35, lyingUntil: 0}, 0).uncomfortable);
    assert.ok(signals({stamina: 1, exposure: 0.95, lyingUntil: 0}, 0).inDanger);
    const lying = stepMeters({stamina: 0.0001, exposure: 0, lyingUntil: 0}, {kind: "sprint", s: 1, dt: 0.1, nowS: 50});
    assert.ok(lying.lyingUntil >= 69.9 && signals(lying, 55).lying && signals(lying, 55).held);
    // A woken sleeper starts at half stamina (D3).
    assert.equal(freshMeters(true).stamina, 0.5);
    // Exposure past 0.6 doubles the drain.
    const calm = stepMeters({stamina: 1, exposure: 0.5, lyingUntil: 0}, {kind: "walk", s: 1, dt: 10, nowS: 0});
    const bad = stepMeters({stamina: 1, exposure: 0.7, lyingUntil: 0}, {kind: "walk", s: 1, dt: 10, nowS: 0});
    near(1 - bad.stamina, 2 * (1 - calm.stamina), 0.01, "double drain");
});

const cell = (zone: TerrainCell["zone"], depth = 0, water: number = WATER_KIND.NONE): TerrainCell => ({height: depth ? -depth : 0.5, flags: depth ? CELL.WATER : CELL.WALK, zone, depth, water: water as TerrainCell["water"], slope: 0, pen: 0, climbTop: 0});

test("habitat: S by zone, region, climate and water (§5.1)", () => {
    const camel = abilitiesOf("dromedary-camel");
    assert.equal(suitability(camel, {zone: "desert", area: null}, cell("desert")).s, 1);
    assert.equal(suitability(camel, {zone: "desert", area: null}, cell("grassland")).s, 0.6, "same region");
    const snow = suitability(camel, {zone: "desert", area: null}, cell("polar"));
    assert.equal(snow.s, 0.3, "a desert animal in the snow");
    assert.equal(snow.cause, "cold");
    const salmon = abilitiesOf("atlantic-salmon");
    assert.equal(suitability(salmon, {zone: "open_ocean", area: null}, cell("river_lake", 2, WATER_KIND.FRESH)).s, 0.15, "a sea fish in the lake");
    assert.equal(suitability(salmon, {zone: "open_ocean", area: null}, cell("open_ocean", 6, WATER_KIND.SALT)).s, 1);
    assert.equal(suitability(salmon, {zone: "open_ocean", area: null}, cell("open_ocean", 0.4, WATER_KIND.SALT)).s, 0.6, "out of its band");
    assert.equal(suitability(salmon, {zone: "open_ocean", area: null}, cell("grassland")).s, 0, "never out of water");
    const dog = abilitiesOf("domestic-dog");
    assert.equal(suitability(dog, {zone: "farm_garden", area: "house"}, cell("farm_garden")).s, 1, "a pet at home");
    assert.equal(suitability(dog, {zone: "farm_garden", area: "house"}, cell("woodland")).s, 0.6, "a pet out in the woods");
    const eagle = abilitiesOf("golden-eagle");
    assert.equal(suitability(eagle, {zone: "mountains", area: null}, null, {openSea: true}).s, 0.6, "a raptor over the open sea: another flyer (§12.2's table)");
    assert.equal(suitability(abilitiesOf("atlantic-puffin"), {zone: "seashore", area: null}, null, {openSea: true}).s, 1, "a seabird at home at sea");
    const kestrel = abilitiesOf("common-kestrel");
    assert.equal(suitability(kestrel, {zone: "grassland", area: null}, null, {openSea: true}).s, 0.6);
});

test("caps: the meters cut the run and hold the animal still", () => {
    const fox = abilitiesOf("red-fox");
    assert.ok(capFor(fox, "ground", "run", null) > capFor(fox, "ground", "walk", null) * 2);
    assert.equal(capFor(fox, "ground", "run", {walkFactor: 0.6, noRun: true, held: false}), fox.walk * 0.6, "exhausted: no running, walk × 0.6");
    assert.equal(capFor(fox, "ground", "walk", {walkFactor: 1, noRun: false, held: true}), 0);
    assert.equal(capFor(fox, "air", "flap", null), 0, "a fox never flies");
});
