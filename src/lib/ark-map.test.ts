import assert from "node:assert/strict";
import test from "node:test";
import holds from "@/ark-scene/map/validator-holds.json";
import table from "@/ark-scene/map/species.json";
import {mapHabitatAt, mapPlace, mapPoints, onSchedule, scheduleRoost, setArkMapSampler} from "@/ark-scene/map/place";
import {bodyOf} from "@/ark-scene/map/species";
import fixture from "@/ark-scene/fixtures/snapshot.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {groupSpread, rangeReach, scheduleWorld, spaceHomes} from "@/ark-scene/behaviour-schedule";
import {eats} from "@/ark-scene/food-links";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {displayLength} from "@/ark-scene/sizes";
import {sceneSampler} from "@/ark-scene/world-sampler";
import {reefLandmarks} from "@/ark-scene/reef";
import {inCoral, onFloor} from "@/ark-scene/map/water";
import {depthSeed, fitInWater, speciesDepth, SURFACE_CLEAR, waterSpec} from "@/ark-scene/sea-depth";
import {shoreOf} from "@/ark-scene/map/place";
import {place as scenePlace} from "@/ark-scene/sampler";
import {mapHolds, mapSlugs, mapSpecies} from "@/ark-scene/map/species";
import {MAP_AREAS, MAP_TAGS, TAG_AREA} from "@/ark-scene/map/tags";
import {failuresBySpecies, offLimb, validateMap, validatorAnimals} from "@/ark-scene/map/validate";
import {canopyPoint, canopyTrees} from "@/ark-scene/layers";
import {arkBody} from "@/ark-scene/stats";
import {validateGrips} from "@/ark-scene/map/validate-grips";
import {worldSampler} from "@/ark-scene/map/world-sampler";
import type {ArkMapSampler} from "@/ark-scene/map/sampler";
import type {ArkAnimal} from "@/ark-scene/types";
import {placeAnimals} from "@/ark-scene/placement";
import {drawnRocks, inRock, ROCK_CELL, touchesRock} from "@/ark-scene/map/rocks";

const TABLE = table as unknown as {points: Record<string, Record<string, number>>; species: Record<string, unknown[]>};
const REVIEWED = holds as unknown as {species: Record<string, string>; grips: Record<string, string>};
/** The validator's run, once for the file (it places every species: a few seconds). */
let run: ReturnType<typeof validateMap> | null = null;
const validated = () => (run ??= validateMap());

test("map B3: the species table (spawn tags, holds, colonies, partners) and about 480 launch points, at least 8 an area", () => {
    const slugs = mapSlugs();
    assert.ok(slugs.length > 2400, `${slugs.length} species placed`);
    for (const slug of slugs) {
        const species = mapSpecies(slug, "farm_garden");
        if (!species) continue;
        assert.ok(species.allowed.has(species.spawn), `${slug}: its spawn tag is one of its own`);
        assert.notEqual(species.spawn, "forest_general", `${slug}: forest resolved to canopy or floor`);
    }
    // Decision 2: the Antarctic ones (and the head louse, its host absent) are held, never placed.
    const {decision} = mapHolds();
    for (const slug of ["emperor-penguin", "adelie-penguin", "weddell-seal", "leopard-seal", "crocodile-icefish", "snow-petrel", "antarctic-petrel", "snowy-sheathbill", "king-penguin", "gentoo-penguin", "macaroni-penguin", "southern-rockhopper-penguin", "head-louse"]) {
        assert.ok(decision.includes(slug), slug);
        assert.equal(mapSpecies(slug, "polar"), null, `${slug} not placed`);
    }
    // Polar bears and Arctic foxes stay, in the cold cove's tags.
    assert.ok(mapSpecies("polar-bear", "polar"));
    // Decision 3: colonies (one animal, one colony) at their nest; decision 4: the partners from their phrases.
    const colonies = slugs.filter((slug) => mapSpecies(slug, "farm_garden")?.colony);
    assert.ok(colonies.length >= 35 && colonies.length <= 42, `${colonies.length} colonies`);
    assert.equal(mapSpecies("mound-building-termite", "grassland")!.spawn, "termite_ant_mounds");
    assert.equal(mapSpecies("western-honey-bee", "farm_garden")!.spawn, "trunks_bark");
    assert.equal(mapSpecies("red-billed-oxpecker", "grassland")!.role, "rider");
    assert.equal(mapSpecies("live-sharksucker", "open_ocean")!.role, "rider");
    assert.equal(mapSpecies("cattle-egret", "wetland")!.role, "beside");
    assert.equal(mapSpecies("ocellaris-clownfish", "coral_reef")!.spawn, "anemone");
    assert.equal(mapSpecies("bluestreak-cleaner-wrasse", "coral_reef")!.spawn, "cleaner_station");
    assert.equal(mapSpecies("cat-flea", "farm_garden")!.role, "parasite");
    // Decision 6: about 480 launch points, every area at least 8.
    const perArea = new Map<string, number>();
    for (const [tag, zones] of Object.entries(TABLE.points)) {
        const area = TAG_AREA[tag as (typeof MAP_TAGS)[number]];
        perArea.set(area, (perArea.get(area) ?? 0) + Object.values(zones).reduce((a, b) => a + b, 0));
    }
    const total = Array.from(perArea.values()).reduce((a, b) => a + b, 0);
    assert.ok(total >= 460 && total <= 500, `${total} launch points`);
    for (const area of MAP_AREAS) assert.ok((perArea.get(area) ?? 0) >= 8, `${area}: ${perArea.get(area)}`);
});

test("map B4 + section 7: the spawn validator places every catalogue species and fails none outside the reviewed hold list", () => {
    const {failures, species} = validated();
    assert.ok(species > 2400);
    const by = failuresBySpecies(failures);
    const report = Array.from(by.entries()).map(([slug, checks]) => `${slug}: ${Array.from(checks.entries()).map(([check, detail]) => `${check} (${detail})`).join("; ")}`);
    assert.deepEqual(report, [], report.slice(0, 20).join("\n"));
    // Every reviewed hold has its reason, and is held (waits at the landing, never on a habitat).
    for (const [slug, reason] of Object.entries(REVIEWED.species)) {
        assert.ok(reason.length > 40, slug);
        assert.equal(mapSpecies(slug, "farm_garden"), null, `${slug} held`);
    }
});

test("map: every small animal sits on an attach point its tags allow and its size fits; flyers never in holes", () => {
    const {placed} = validated();
    let small = 0;
    let onPoints = 0;
    for (const animal of validatorAnimals()) {
        const species = mapSpecies(animal.model_slug, animal.zone);
        const place = placed.get(animal.id);
        // (A water species is placed by its depth band, in the water: not on a point.)
        if (!species?.small || !place?.map || place.map.water) continue;
        small++;
        if (place.map.attach) onPoints++;
    }
    // (The rest: water, the sea floor, the floes, the air, and small flyers landed on their ground or water.)
    assert.ok(onPoints / small > 0.8, `${onPoints} of ${small} small on attach points`);
});

test("map: nobody moves when others leave, and the map follows the sampler (a new terrain re-places everyone)", () => {
    const animals = validatorAnimals().filter((_, i) => i % 7 === 0);
    const before = placeAnimals(animals);
    const after = placeAnimals(animals.filter((_, i) => i % 3 !== 0));
    after.forEach((place, id) => {
        // (A partner whose host left goes to the next host, or back to its own spot: section 6, by design.)
        const was = before.get(id)!;
        if (was.host && !after.has(was.host.id)) return;
        assert.deepEqual([place.x, place.z, place.ground], [was.x, was.z, was.ground], id);
    });
    // A flat stand-in terrain: grassland west of x = 0, a lake east of it. The same animal lands on the new terrain's own ground.
    const flat: ArkMapSampler = {
        id: "flat-test",
        half: 40,
        ground: (x) => (x < 0 ? {height: 1, water: null, depth: 0, zone: "grassland", tags: ["grassland", "on_grazers", "soil", "burrows", "open_sky"]} : {height: -2, water: "fresh", depth: 2, zone: "river_lake", tags: ["lake", "stream_river", "pond"]}),
        blocked: () => false,
        anchors: () => [],
        attachPoints: () => []
    };
    setArkMapSampler(flat);
    try {
        const zebra = {...animals[0], id: "flat-zebra", model_slug: "plains-zebra", zone: "grassland" as const, slot: 3, slot_rank: 0};
        const placed = mapPlace(zebra, "grassland", 3, 0, 2, 2.4)!;
        assert.ok(placed.x < 0 && placed.ground === 1 && placed.map.tag === "grassland");
        const carp = {...zebra, id: "flat-koi", model_slug: "koi", zone: "river_lake" as const};
        const swims = mapPlace(carp, "river_lake", 3, 0, 0.6, 0.6)!;
        assert.ok(swims.x >= 0 && swims.water, "the koi in the new lake");
    } finally {
        setArkMapSampler(worldSampler());
    }
    assert.equal(mapPoints().sampler.id, worldSampler().id);
});

test("map: hangers, climbers and perchers grip their branch, trunk, ledge or wall with their rig's feet (where the rig files are here)", async () => {
    const {placed} = validated();
    const ids = new Map(validatorAnimals().map((a) => [a.id, a.model_slug]));
    const result = await validateGrips(placed, (id) => ids.get(id)!);
    if (result.skipped) return;
    assert.ok(result.checked > 100, `${result.checked} rigs checked`);
    const unreviewed = result.failures.filter((failure) => !REVIEWED.grips[failure.slug]);
    assert.deepEqual(unreviewed.map((f) => `${f.slug} (${f.clip}): ${f.detail}`), []);
});

test("map: a hanger hangs under its limb and a percher sits on top, on the drawn limb's surface (the sloth half a body length below fails)", () => {
    const {placed} = validated();
    let hangers = 0;
    for (const animal of validatorAnimals()) {
        const place = placed.get(animal.id);
        // A hanger under a limb of the real forest (the scenery's hang point, on the limb's drawn underside): its back down.
        if (place?.perch?.tag === "canopy_hang") {
            hangers++;
            assert.ok(place.perch.ny < -0.5, `${animal.model_slug} hangs with its back down`);
            assert.ok((place.map?.attach?.clearBelow ?? 0) >= arkBody(animal).metres, `${animal.model_slug} has the room to hang`);
            continue;
        }
        if (!place?.canopy || place.canopy.limb < 0) continue;
        const tree = canopyTrees(place.canopy.zone ?? animal.zone)[place.canopy.tree % canopyTrees(place.canopy.zone ?? animal.zone).length].item;
        const point = canopyPoint(animal.zone, place.canopy);
        assert.ok(offLimb(tree, place.canopy.limb, point) < 0.02, `${animal.model_slug} off its limb`);
        if (place.canopy.mode !== "hang") continue;
        hangers++;
        assert.ok(point.ny < -0.5, `${animal.model_slug} hangs with its back down`);
        // Half a body length below the limb (the bug): the check sees it.
        const half = arkBody(animal).metres / 2;
        assert.ok(offLimb(tree, place.canopy.limb, {...point, y: point.y - half}) > Math.min(half, 0.1) * 0.9, `${animal.model_slug}: a float would be caught`);
    }
    assert.ok(hangers >= 2, `${hangers} hangers checked`);
});

test("map + behaviour spawn spacing: every predator at least 20 m from its prey at spawn, its moved home on (or within 5 m of) its own ground", () => {
    const world = scheduleWorld(sceneSampler());
    for (const raw of [fixture, fixtureV2]) {
        const snapshot = decodeArkSnapshot(raw)!;
        const places = placeAnimals(snapshot.animals);
        // As the scene wires it (index.ts wireSchedules): each group's leader, its reach with its group's spread round it.
        const sizes = new Map<string, number>();
        for (const a of snapshot.animals) {
            const lead = places.get(a.id)!.leader;
            if (lead && lead !== a.id) sizes.set(lead, (sizes.get(lead) ?? 1) + 1);
        }
        const leaders = snapshot.animals.filter((a) => !places.get(a.id)!.leader || places.get(a.id)!.leader === a.id);
        const items = leaders.map((a) => ({a, place: places.get(a.id)!, profile: behaviourProfile(a.model_slug)}));
        const reach = new Map(items.map((i) => [i.a.id, rangeReach(i.profile, {id: i.a.id, zone: i.a.zone, home: {x: i.place.x, y: i.place.ground, z: i.place.z}, length: displayLength(i.a), sea: false}) + (sizes.has(i.a.id) ? groupSpread(displayLength(i.a), sizes.get(i.a.id)!) : 0)]));
        const spaced = spaceHomes(
            // (As index.ts wireSchedules: a flyer's home any dry ground on its own, a walker's on the walk grid; either within 5 m of its ground.)
            items.map((i) => ({id: i.a.id, slug: i.a.model_slug, home: {x: i.place.x, z: i.place.z}, length: displayLength(i.a), walkable: (x: number, z: number) => (i.profile.move === "swim" || i.profile.seabed ? world.nav.swimmable(x, z, 0.5) : i.profile.move === "fly" ? world.sampler.heightAt(x, z) > 0.05 && mapHabitatAt(i.a, x, z, 5) : world.nav.walkable(x, z) && mapHabitatAt(i.a, x, z, 5))})),
            eats,
            (id) => reach.get(id) ?? 3
        );
        const home = (i: (typeof items)[number]) => spaced.get(i.a.id)?.home ?? {x: i.place.x, z: i.place.z};
        let predators = 0;
        for (const i of items) {
            const prey = items.filter((j) => j !== i && eats(i.a.model_slug, j.a.model_slug));
            if (!prey.length) continue;
            predators++;
            const nearest = Math.min(...prey.map((j) => Math.hypot(home(i).x - home(j).x, home(i).z - home(j).z)));
            assert.ok(nearest >= 20, `${i.a.model_slug} ${nearest.toFixed(1)} m from its prey`);
            assert.ok(mapHabitatAt(i.a, home(i).x, home(i).z, 5) || (home(i).x === i.place.x && home(i).z === i.place.z), `${i.a.model_slug} moved off its own ground`);
        }
        assert.ok(predators >= 15, `${predators} predators`);
    }
});

test("map + reef: no floor animal (a crab, a star, an octopus in its hole) stands inside one of the reef lane's coral heads", () => {
    const marks = reefLandmarks();
    assert.ok(marks.heads.length >= 3, `${marks.heads.length} coral heads`);
    // The check sees a head and the cleaning station's coral.
    assert.ok(inCoral(marks.heads[0].x, marks.heads[0].z, 0) && inCoral(marks.cleaning.x, marks.cleaning.z, 0));
    const {placed} = validated();
    let floor = 0;
    for (const animal of validatorAnimals()) {
        const place = placed.get(animal.id);
        const depth = speciesDepth(animal.model_slug, animal.zone);
        if (!place?.map?.water || !depth || !onFloor(depth) || place.map.water === "lake") continue;
        floor++;
        assert.ok(!inCoral(place.x, place.z, 0), `${animal.model_slug} in a coral head`);
    }
    assert.ok(floor > 80, `${floor} floor animals`);
});

test("map + behaviour: every bird, bat and grazer is on the behaviour schedule (only small invertebrates are micro); a perched one roosts on its perch", () => {
    const {placed} = validated();
    const off: string[] = [];
    let birds = 0;
    let grazers = 0;
    let perched = 0;
    for (const animal of validatorAnimals()) {
        const place = placed.get(animal.id);
        if (!place) continue;
        const body = bodyOf(animal.model_slug);
        // (A grazing grasshopper, termite or limpet is a small invertebrate: micro.)
        const grazer = (behaviourProfile(animal.model_slug).weights.graze ?? 0) > 0 && body !== "i";
        if (body === "b" || body === "t") birds++;
        if (grazer) grazers++;
        if ((body === "b" || body === "t" || grazer) && !onSchedule(place, animal.model_slug)) off.push(`${animal.model_slug} (${place.micro ? "micro" : "burrow"})`);
        // Micro means a small invertebrate, nothing else.
        if (place.micro) assert.equal(body ?? "i", "i", `${animal.model_slug} is micro`);
        if (place.perch) {
            perched++;
            const roost = scheduleRoost(place, animal.zone);
            assert.ok(roost, `${animal.model_slug} has a roost`);
            // Its own perch, or the roost its text names (sleep_pattern).
            if (!place.map?.roost) assert.deepEqual([roost.x, roost.y, roost.z], [place.perch.x, place.perch.y, place.perch.z], animal.model_slug);
        }
    }
    assert.deepEqual(off, [], `${off.length} off the schedule: ${off.slice(0, 12).join(", ")}`);
    assert.ok(birds > 1200 && grazers > 400 && perched > 800, `${birds} birds and bats, ${grazers} grazers, ${perched} perched`);
});

test("map: penguins and seals stand on their shore (the polar penguins on the cold cove's ice, the warm-water ones on their warm rocks and beach), held Antarctic ones too; in the water they swim under it", () => {
    const sampler = mapPoints().sampler;
    const cove = scenePlace("cold_cove");
    const penguins = ["african-penguin", "humboldt-penguin", "magellanic-penguin", "galapagos-penguin", "emperor-penguin", "adelie-penguin", "king-penguin", "gentoo-penguin", "macaroni-penguin", "southern-rockhopper-penguin"];
    const seals = ["harbor-seal", "grey-seal", "ringed-seal", "bearded-seal", "hooded-seal", "walrus", "california-sea-lion", "weddell-seal", "leopard-seal"];
    const animals: ArkAnimal[] = [...penguins, ...seals].flatMap((slug, i) => [0, 1, 2].map((rank) => ({id: `dive-${slug}-${rank}`, species_profile_id: `dive-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: (/emperor|adelie|king|gentoo|macaroni|rockhopper|ringed|bearded|hooded|walrus|weddell|leopard/.test(slug) ? "polar" : "seashore") as ArkAnimal["zone"], arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "Voyager 1", named: false}, mine: false, slot: 40 + i, slot_rank: rank} as ArkAnimal)));
    const placed = placeAnimals(animals);
    for (const animal of animals) {
        const place = placed.get(animal.id)!;
        const g = sampler.ground(place.x, place.z);
        assert.ok(!place.water && g.water === null, `${animal.model_slug} in the water`);
        assert.ok(place.map?.shore, `${animal.model_slug} on a shore`);
        let sea = false;
        for (let k = 0; k < 16 && !sea; k++) for (let r = 1; r <= 9 && !sea; r++) sea = sampler.ground(place.x + Math.sin(k * Math.PI / 8) * r, place.z + Math.cos(k * Math.PI / 8) * r).water === "sea";
        assert.ok(sea, `${animal.model_slug} by the sea`);
        // The Antarctic and sub-Antarctic penguins on the cold cove; the warm-water ones on their own warm shore, far from the ice.
        const warm = ["african-penguin", "humboldt-penguin", "magellanic-penguin", "galapagos-penguin"].includes(animal.model_slug);
        if (penguins.includes(animal.model_slug)) {
            if (warm) assert.ok(place.map!.shore === "coast" && Math.hypot(place.x - cove.x, place.z - cove.z) > 40 && g.tags.some((t) => ["rocky_shore", "sandy_beach", "sea_cliffs", "rocks_boulders"].includes(t)), `${animal.model_slug} on its warm shore`);
            else assert.ok(place.map!.shore === "cove" && Math.hypot(place.x - cove.x, place.z - cove.z) < 36, `${animal.model_slug} on the cold cove`);
        }
        assert.equal(shoreOf(animal.model_slug, animal.zone) === "cove", place.map!.shore === "cove");
        // In the water (when its schedule takes it swimming): under the surface in the upper water, up only to breathe.
        const depth = speciesDepth(animal.model_slug, animal.zone)!;
        assert.ok(depth && depth.breathes && depth.band === "upper", `${animal.model_slug} swims`);
        const {base} = fitInWater(waterSpec(depth, -6, depthSeed(animal.id), 1000, 0), 0.6);
        assert.ok(base + 0.6 <= -SURFACE_CLEAR + 1e-9, `${animal.model_slug} floats`);
    }
    // A colony stands close, one spot each.
    for (const slug of penguins) {
        const spots = [0, 1, 2].map((rank) => placed.get(`dive-${slug}-${rank}`)!);
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
            const d = Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z);
            assert.ok(d > 0.9 && d < 4, `${slug} ${i} and ${j} ${d.toFixed(2)} m apart`);
        }
    }
});

test("inRock finds a rock just over a cell edge: a body at the edge of a cell next to a rock listed only in the next", () => {
    // The index lists each rock in the cells its own reach covers; a body with a radius reaches past them. For every rock,
    // a body of 0.4 m just across each edge of its listed cells, 0.1-0.3 m off its footprint, and a body at random near
    // it: inRock agrees with every rock checked one by one.
    const rocks = drawnRocks();
    assert.ok(rocks.length > 20, `${rocks.length} drawn rocks`);
    const brute = (x: number, z: number, radius: number) => rocks.some((rock) => touchesRock(rock, x, z, radius));
    const listed = (rock: (typeof rocks)[number], x: number, z: number) => {
        const i = Math.floor(x / ROCK_CELL);
        const j = Math.floor(z / ROCK_CELL);
        return i >= Math.floor((rock.x - rock.reach) / ROCK_CELL) && i <= Math.floor((rock.x + rock.reach) / ROCK_CELL) && j >= Math.floor((rock.z - rock.reach) / ROCK_CELL) && j <= Math.floor((rock.z + rock.reach) / ROCK_CELL);
    };
    let edgeCases = 0;
    const wrong: string[] = [];
    for (const rock of rocks) {
        // Its footprint's farthest extent along each world axis (the box's corners, turned).
        const corners = [[rock.hx0, rock.hz0], [rock.hx0, rock.hz1], [rock.hx1, rock.hz0], [rock.hx1, rock.hz1]].map(([lx, lz]) => ({x: rock.x + lx * rock.cos + lz * rock.sin, z: rock.z - lx * rock.sin + lz * rock.cos}));
        const east = Math.max(...corners.map((c) => c.x));
        const west = Math.min(...corners.map((c) => c.x));
        const north = Math.max(...corners.map((c) => c.z));
        const south = Math.min(...corners.map((c) => c.z));
        const along = [
            {x: (Math.floor((rock.x + rock.reach) / ROCK_CELL) + 1) * ROCK_CELL + 0.01, z: rock.z, edge: east},
            {x: Math.floor((rock.x - rock.reach) / ROCK_CELL) * ROCK_CELL - 0.01, z: rock.z, edge: west},
            {x: rock.x, z: (Math.floor((rock.z + rock.reach) / ROCK_CELL) + 1) * ROCK_CELL + 0.01, edge: north},
            {x: rock.x, z: Math.floor((rock.z - rock.reach) / ROCK_CELL) * ROCK_CELL - 0.01, edge: south}
        ];
        for (let k = 0; k < along.length; k++) {
            const at = along[k];
            // The body's radius: from the footprint's edge to just past the cell edge, plus a little (at least 0.4 m).
            const gap = k === 0 ? at.x - at.edge : k === 1 ? at.edge - at.x : k === 2 ? at.z - at.edge : at.edge - at.z;
            const radius = Math.max(gap + 0.1 + 0.2 * ((k + rocks.indexOf(rock)) % 2), 0.4);
            if (!listed(rock, at.x, at.z) && touchesRock(rock, at.x, at.z, radius)) edgeCases++;
            if (inRock(at.x, at.z, radius) !== brute(at.x, at.z, radius)) wrong.push(`rock at ${rock.x.toFixed(1)},${rock.z.toFixed(1)} side ${k}: body r ${radius.toFixed(2)} at ${at.x.toFixed(2)},${at.z.toFixed(2)}`);
        }
        for (let n = 0; n < 12; n++) {
            const a = (n / 12) * Math.PI * 2 + rock.x;
            const d = rock.reach + 0.2 + (n % 4) * 0.35;
            const x = rock.x + Math.cos(a) * d;
            const z = rock.z + Math.sin(a) * d;
            const radius = 0.3 + (n % 3) * 0.4;
            if (inRock(x, z, radius) !== brute(x, z, radius)) wrong.push(`rock at ${rock.x.toFixed(1)},${rock.z.toFixed(1)}: body r ${radius.toFixed(2)} at ${x.toFixed(2)},${z.toFixed(2)}`);
        }
    }
    // The case the old lookup missed is really tested: bodies touching a rock from a cell it is not listed in.
    assert.ok(edgeCases > 20, `${edgeCases} bodies touch a rock from a cell it is not listed in`);
    assert.deepEqual(wrong.slice(0, 10), [], `${wrong.length} bodies where inRock disagrees with the rocks checked one by one`);
});
