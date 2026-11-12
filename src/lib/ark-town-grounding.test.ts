/**
 * The town island's animals where they are drawn (lane TB: the owner's "aquariums: animals inside can't be seen",
 * "domestic animals not showing in people's homes", "animals sinking into the ground"): the town's drawn ground (its
 * tile, pavements, paths, fields, floors), the aquarium's tanks and the swim in them, the pets kept at home (garden
 * rooms, balconies, ponds), and the validator over every animal on the town: zero sinking, zero floating, none in a
 * wall, a tank's glass, a display's or a zoo house's walls.
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {TOWN_HALF, TOWN_SEGMENTS, townPlan} from "@/ark-scene/islands/town/plan";
import {groundGrid} from "@/ark-scene/islands/town/render/index";
import {setTownWalkSurfaces, townDrawnHeight, townTileHeight, townWaterSurface} from "@/ark-scene/islands/town/drawn-ground";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {aquariumTankOf, aquariumTanks, homeKeeping, tankBox, tankPose, zooHouseFrame} from "@/ark-scene/islands/town/tanks";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townSurfacesFor, validateTownAnimals} from "@/ark-scene/islands/town/validate-animals";
import {arkBody} from "@/ark-scene/stats";
import {modelBase} from "@/ark-scene/grounding/base";
import {inBox, toLocal} from "@/ark-scene/islands/town/geom";
import {streetEdgeDistance} from "@/ark-scene/islands/town/ground";

/** A town animal for the checks (deterministic ids; the fields placement and the scene read). */
function animal(i: number, slug: string, area: ArkAnimal["area"], zone: string, enclosure: string | null = null, extra: Partial<ArkAnimal> = {}): ArkAnimal {
    return {id: `tb-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area, island: "town", enclosure, ...extra} as ArkAnimal;
}

/** Every kind of town animal: pets of each keeping, farm stock, zoo residents of the houses, pools and paddocks, wildlife. */
function townPopulation(): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    let i = 0;
    const home = ["domestic-dog", "domestic-cat", "domestic-rabbit", "guinea-pig", "domestic-chicken", "domestic-duck", "domestic-goose", "domestic-pigeon", "greek-tortoise", "goldfish", "koi", "red-eared-slider", "guppy", "siamese-fighting-fish", "axolotl", "amano-shrimp", "asian-arowana", "budgerigar", "domestic-canary", "cockatiel", "golden-hamster", "central-bearded-dragon", "leopard-gecko", "corn-snake", "ball-python", "tarantula", "domestic-horse", "cow", "domestic-goat", "house-fly"];
    for (let k = 0; k < 4; k++) for (const slug of home) out.push(animal(i++, slug, "house", "farm_garden"));
    for (const slug of ["domestic-chicken", "domestic-horse", "cow", "domestic-sheep", "domestic-goat", "domestic-pig", "domestic-duck", "alpaca"]) for (let k = 0; k < 3; k++) out.push(animal(i++, slug, "farm", "farm_garden"));
    const zoo: Array<[string, string, string]> = [
        ["koi", "river_lake", "aquarium-1"], ["largetooth-sawfish", "coral_reef", "aquarium-1"], ["nurse-shark", "coral_reef", "aquarium-1"], ["dugong", "coral_reef", "aquarium-1"], ["green-sea-turtle", "coral_reef", "aquarium-1"],
        ["moon-jellyfish", "open_ocean", "aquarium-2"], ["ocellaris-clownfish", "coral_reef", "aquarium-2"], ["common-octopus", "coral_reef", "aquarium-2"], ["chocolate-chip-sea-star", "coral_reef", "aquarium-2"], ["arapaima", "river_lake", "aquarium-2"], ["guppy", "river_lake", "aquarium-2"],
        ["saltwater-crocodile", "wetland", "reptile_house-1"], ["reticulated-python", "rainforest", "reptile_house-1"], ["leopard-gecko", "desert", "reptile_house-2"], ["green-iguana", "rainforest", "reptile_house-2"],
        ["red-kneed-tarantula", "rainforest", "insect_house-1"], ["common-raccoon", "woodland", "nocturnal_house-1"], ["western-gorilla", "rainforest", "primate_house-1"], ["common-marmoset", "rainforest", "primate_house-1"],
        ["humboldt-penguin", "polar", "penguin_seal_pools-1"], ["african-lion", "grassland", "big_cats-1"], ["giraffe", "grassland", "savanna_paddocks-1"], ["domestic-donkey", "farm_garden", "childrens_farm-1"]
    ];
    for (const [slug, zone, enclosure] of zoo) for (let k = 0; k < 3; k++) out.push(animal(i++, slug, "zoo", zone, enclosure));
    for (const [slug, zone] of [["mallard", "river_lake"], ["brown-rat", "farm_garden"], ["red-fox", "woodland"], ["european-robin", "farm_garden"], ["peregrine-falcon", "mountains"], ["common-toad", "farm_garden"]] as const) for (let k = 0; k < 3; k++) out.push(animal(i++, slug, null, zone, null, {slot: k, slot_rank: k} as Partial<ArkAnimal>));
    return out;
}

test("the town's drawn ground is its tile's own triangles, vertex for vertex and between them", () => {
    setTownWalkSurfaces(null);
    const grid = groundGrid();
    const step = (TOWN_HALF * 2) / TOWN_SEGMENTS;
    let worst = 0;
    for (let k = 0; k < grid.heights.length; k += 997) {
        const row = Math.floor(k / grid.size);
        const column = k % grid.size;
        if (row >= TOWN_SEGMENTS || column >= TOWN_SEGMENTS) continue;
        worst = Math.max(worst, Math.abs(townTileHeight(-TOWN_HALF + column * step + 1e-9, -TOWN_HALF + row * step + 1e-9) - grid.heights[k]));
    }
    assert.ok(worst < 1e-3, `vertex heights differ by ${worst}`);
    // Inside a cell: the triangle a-d-b below the diagonal, b-d-e above (`groundTile`'s index), by barycentric weights.
    for (const [c, r, u, v] of [[100, 200, 0.2, 0.3], [250, 120, 0.7, 0.8], [300, 300, 0.45, 0.5]]) {
        const h = (cc: number, rr: number) => grid.heights[rr * grid.size + cc];
        const want = u + v <= 1 ? h(c, r) + (h(c + 1, r) - h(c, r)) * u + (h(c, r + 1) - h(c, r)) * v : h(c + 1, r + 1) + (h(c, r + 1) - h(c + 1, r + 1)) * (1 - u) + (h(c + 1, r) - h(c + 1, r + 1)) * (1 - v);
        assert.ok(Math.abs(townTileHeight(-TOWN_HALF + (c + u) * step, -TOWN_HALF + (r + v) * step) - want) < 1e-3);
    }
});

test("roads, pavements, paths, the zoo houses' floors and bridge decks are ground (the walk surfaces)", () => {
    const surfaces = townSurfacesFor(launchEnclosures(), []);
    const plan = townPlan();
    // A pavement: 16 cm over the tile; the carriageway 6 cm.
    // (A stretch of road on the flat town, away from bridges and the harbour: its tile at the town's level.)
    const street = plan.streets.find((s) => s.kind === "road" && s.pavement > 0 && s.line.some((p, k) => k > 0 && Math.abs(townHeight(p.x, p.z) - 2.6) < 0.01 && Math.abs(townHeight(s.line[k - 1].x, s.line[k - 1].z) - 2.6) < 0.01))!;
    const at = street.line.findIndex((p, k) => k > 0 && Math.abs(townHeight(p.x, p.z) - 2.6) < 0.01 && Math.abs(townHeight(street.line[k - 1].x, street.line[k - 1].z) - 2.6) < 0.01);
    const mid = {x: (street.line[at].x + street.line[at - 1].x) / 2, z: (street.line[at].z + street.line[at - 1].z) / 2};
    const next = street.line[at];
    const len = Math.hypot(next.x - mid.x, next.z - mid.z);
    const nx = -(next.z - mid.z) / len;
    const nz = (next.x - mid.x) / len;
    const road = townDrawnHeight(mid.x, mid.z, surfaces) - townTileHeight(mid.x, mid.z);
    const off = street.width / 2 + street.pavement / 2;
    const px = mid.x + nx * off;
    const pz = mid.z + nz * off;
    const pavement = townDrawnHeight(px, pz, surfaces) - townTileHeight(px, pz);
    assert.ok(Math.abs(road - 0.06) < 0.03, `the road ${road.toFixed(3)} m over the tile`);
    assert.ok(Math.abs(pavement - 0.16) < 0.04, `the pavement ${pavement.toFixed(3)} m over the tile`);
    assert.ok(streetEdgeDistance(px, pz) <= 0.01);
    // A zoo house's floor (0.25 m over the highest ground under it) inside its walls.
    const house = zooLayout(launchEnclosures(), plan).enclosures.find((e) => e.type === "aquarium")!;
    const f = zooHouseFrame(house);
    assert.ok(Math.abs(townDrawnHeight(f.inner.x, f.inner.z, surfaces) - f.floor) < 1e-3, "the aquarium's floor is ground");
    // A stacked floor: under the zoo house's floor (near the tile) the tile; the floor only for a body at it.
    assert.ok(townDrawnHeight(f.inner.x, f.inner.z, surfaces, townHeight(f.inner.x, f.inner.z) - 0.3) < f.floor - 0.05);
    // The canal held by the lock: its own level, not the sea's.
    const canal = plan.waters.find((w) => w.kind === "millpond")!;
    assert.equal(townWaterSurface(canal.poly[0].x * 0.5 + canal.poly[10].x * 0.5, canal.poly[0].z * 0.5 + canal.poly[10].z * 0.5), canal.level);
});

test("how a home's pet is kept: tanks, ponds, cages, vivaria, outdoors, livery", () => {
    const keep = (slug: string, length = arkBody({model_slug: slug}).display) => homeKeeping(slug, "farm_garden", length, modelBase(slug)?.plan ?? null);
    assert.equal(keep("domestic-dog"), "outdoors");
    assert.equal(keep("domestic-cat"), "outdoors");
    assert.equal(keep("domestic-rabbit"), "outdoors");
    assert.equal(keep("greek-tortoise"), "outdoors");
    assert.equal(keep("goldfish"), "pond");
    assert.equal(keep("koi"), "pond");
    assert.equal(keep("red-eared-slider"), "pond");
    assert.equal(keep("guppy"), "tank");
    assert.equal(keep("asian-arowana"), "tank");
    assert.equal(keep("amano-shrimp"), "tank");
    assert.equal(keep("budgerigar"), "cage");
    assert.equal(keep("golden-hamster"), "cage");
    assert.equal(keep("corn-snake"), "vivarium");
    assert.equal(keep("central-bearded-dragon"), "vivarium");
    assert.equal(keep("domestic-horse"), "livery");
    assert.equal(keep("cow"), "livery");
    assert.equal(keep("domestic-duck"), "outdoors");
});

test("the aquarium: every resident has a tank that holds it, and swims inside it all day", () => {
    const tanks = aquariumTanks(zooLayout(launchEnclosures()).enclosures.find((e) => e.type === "aquarium")!);
    assert.equal(tanks.length, 9);
    for (const slug of ["largetooth-sawfish", "dugong", "moon-jellyfish", "ocellaris-clownfish", "koi", "arapaima", "chocolate-chip-sea-star", "common-octopus"]) {
        const a = animal(1, slug, "zoo", "coral_reef", "aquarium-1");
        const body = arkBody(a, modelBase(slug)?.plan);
        const tank = aquariumTankOf(a, body.display, tanks)!;
        assert.ok(tank, `${slug} has a tank`);
        if (slug === "moon-jellyfish") assert.equal(tank.form, "jelly");
        if (body.display >= 0.95) assert.ok(tank.form === "ocean" || tank.form === "river", `${slug} (${body.display} m) in a big tank`);
        const size = modelBase(slug)?.size ?? {x: 0.3, y: 0.5, z: 1};
        const height = size.y * (body.display / Math.max(size.z, 0.05));
        for (let t = 0; t < 600; t += 7.3) {
            const p = tankPose(tank, a, body.display, height, modelBase(slug)?.plan ?? null, 1794441600 + t);
            // Its nose and its tail inside the glass.
            for (const end of [-1, 1]) {
                const l = toLocal(tankBox(tank), p.x + (Math.sin(p.yaw) * end * size.z * body.display) / Math.max(size.z, 0.05) / 2, p.z + (Math.cos(p.yaw) * end * size.z * body.display) / Math.max(size.z, 0.05) / 2);
                assert.ok(Math.abs(l.x) <= tank.w / 2 + 0.01 && Math.abs(l.z) <= tank.d / 2 + 0.01, `${slug} inside its tank`);
            }
            assert.ok(p.base >= tank.floor - 0.3 * height - 0.01 && p.base <= tank.top, `${slug} in the water's column`);
        }
    }
});

test("every animal on the town island: zero sinking, zero floating, none in a wall, a tank's glass, a display's or a house's walls", () => {
    const animals = townPopulation();
    const check = validateTownAnimals(animals, {origin: {x: 601.2, z: -249}});
    assert.equal(check.counts.sinks, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("sinks")).slice(0, 5)));
    assert.equal(check.counts.floats, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("floats")).slice(0, 5)));
    assert.equal(check.counts.out_of_tank, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("out_of_tank")).slice(0, 5)));
    assert.equal(check.counts.out_of_display, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("out_of_display")).slice(0, 5)));
    assert.equal(check.counts.out_of_house, 0);
    const atPlace = check.problems.filter((p) => p.problems.includes("in_wall") && p.epoch === 0);
    assert.equal(atPlace.length, 0, JSON.stringify(atPlace.slice(0, 5)));
    // On the schedule, at rest: within the reviewed few (small wildlife by a block's wall; the scene's L5 colliders push them out).
    assert.ok(check.counts.in_wall <= Math.ceil(animals.length * 0.01), `${check.counts.in_wall} in a wall at rest`);
    assert.ok(check.kinds.tank > 0 && check.kinds.display > 0 && check.kinds.zoo_house > 0 && check.kinds.ground > 0);
    // Before lane TB the scene stood them on the wild island's drawn ground under the town: every ground animal sank.
    assert.ok(check.legacy.sinks > animals.length * 0.4, `legacy ${check.legacy.sinks}`);
    assert.ok(check.legacy.worstSink < -5);
});

test("pets kept indoors are in their home's display, outdoor pets clear of houses, garden rooms and ponds; livery at a farm", () => {
    const animals = townPopulation().filter((a) => a.area === "house");
    const placed = placeTownAnimals(animals);
    const plan = townPlan();
    for (const a of animals) {
        const info = placed.town.get(a.id)!;
        const p = placed.places.get(a.id)!;
        if (info.keeping === "livery") assert.equal(info.area, "farm", `${a.model_slug} at a farm`);
        else if (info.display) assert.ok(inBox({x: info.display.x, z: info.display.z, w: info.display.w, d: info.display.d, rot: info.display.rot}, p.x, p.z, 0.01), `${a.model_slug} in its ${info.display.form}`);
        else if (info.where !== "balcony") for (const b of plan.buildings) assert.ok(!inBox(b.at, p.x, p.z, 0), `${a.model_slug} outdoors, not in ${b.id}`);
    }
    // Nobody moves when others arrive: the same animals' places with half the town added.
    const more = placeTownAnimals([...animals, ...townPopulation().filter((a) => a.area !== "house")]);
    for (const a of animals) {
        const p0 = placed.places.get(a.id)!;
        const p1 = more.places.get(a.id)!;
        assert.ok(Math.hypot(p0.x - p1.x, p0.z - p1.z) < 1e-9, `${a.model_slug} kept its place`);
    }
});

test("a breed is drawn at its own stored length, else its parent species'", () => {
    const parent = arkBody({model_slug: "domestic-dog"});
    const breed = arkBody({model_slug: "domestic-dog", length_m: 0.25});
    assert.equal(breed.metres, 0.25);
    assert.ok(breed.display < parent.display * 0.5, "a small breed drawn small");
    assert.equal(arkBody({model_slug: "domestic-dog", length_m: null}).metres, parent.metres, "no stored length: the parent's");
});

/** The real Ark and T1's routing, read in place only (never copied); skipped where they are not. */
const LIVE = process.env.ARK_LIVE_SNAPSHOT ?? "public/ark-local/live.json";
const ROUTING = process.env.ARK_ISLANDS_ROUTING ?? "public/ark-local/islands-routing.json";

test("the real Ark's town (development only, read in place): zero sinking or floating, nobody in a tank's glass or a wall at its place", {skip: !existsSync(LIVE) || !existsSync(ROUTING)}, async () => {
    const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
    const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
    const {arkIslandSnapshot} = await import("@/lib/ark-islands");
    const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(LIVE, "utf8")), JSON.parse(readFileSync(ROUTING, "utf8")));
    const town = arkIslandSnapshot(decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!, "town");
    const check = validateTownAnimals(town.animals, {schedule: false});
    assert.equal(check.counts.sinks + check.counts.floats + check.counts.out_of_tank + check.counts.out_of_display + check.counts.out_of_house + check.counts.in_wall, 0, JSON.stringify(check.problems.slice(0, 5)));
    console.log(`real town: ${town.animals.length} animals; ${JSON.stringify(check.kinds)}; legacy sinks ${check.legacy.sinks} (worst ${check.legacy.worstSink.toFixed(1)} m)`);
});
