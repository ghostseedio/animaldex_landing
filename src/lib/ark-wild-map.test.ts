/**
 * The Ark map and the behaviour world on the bigger wild island (Part C, P4 and P5; docs/ark/wild-island.md §8): with
 * the world switch on v2, the map's sampler and the behaviour world's are the wild island's (its square for the walk
 * grid, its fresh water above the sea), every zone key the server assigns has its site, big land walkers stand on
 * their zone's ranges and whales in their reserved deep water (decisions 53 and 54), and the spawn validator places
 * every species at 0 failures. With v1 (the default) the places are today's, byte for byte.
 *
 * (The live check, the wild island's real animals in islands mode, is `scripts/ark-map-live-validate.mts`: local only.)
 */

import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {arkWorld, LAKE, sampleGround, setArkWorld, TERRAIN_HALF, ZONE_SITES} from "@/ark-scene/world";
import {setNoHamlet} from "@/ark-scene/no-hamlet";
import {ARK_ZONES, type ArkAnimal} from "@/ark-scene/types";
import {placeAnimals} from "@/ark-scene/placement";
import {mapPoints} from "@/ark-scene/map/place";
import {worldSampler as mapWorldSampler} from "@/ark-scene/map/world-sampler";
import {validateMap, validatorAnimals, failuresBySpecies} from "@/ark-scene/map/validate";
import {mapSpecies} from "@/ark-scene/map/species";
import {maskWalkable, setWalkMaskEnabled, WALK_MASK_V2_VERSION} from "@/ark-scene/map/walk-mask";
import {MAX_SLOPE, MOUNTAIN_SLOPE, navGrid} from "@/ark-scene/behaviour-nav";
import {worldSampler as behaviourWorldSampler} from "@/ark-scene/world-sampler";
import {arkBody} from "@/ark-scene/stats";
import {displayLength} from "@/ark-scene/sizes";
import {bigRanges, inRange, RANGE_CLEAR, whaleCells, WHALE_CLEAR} from "@/ark-scene/islands/wild/reserves";
import {sampleWildGround, wildZoneAt} from "@/ark-scene/islands/wild/ground";
import {takesRange, wildWaterDepth} from "@/ark-scene/islands/wild/map-v2";

const hash = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex");
/** A slice of the validator's animals (every 9th species), for the cheaper checks. */
const some = (): ArkAnimal[] => validatorAnimals().filter((_, i) => Math.floor(i / 2) % 9 === 0);

test("v1 stays today's: places switched to v2 and back are the same, byte for byte", () => {
    assert.equal(arkWorld(), "v1");
    const animals = some();
    const before = hash(Array.from(placeAnimals(animals).entries()));
    assert.equal(mapWorldSampler().id, "world-stub-1");
    setArkWorld("v2");
    assert.equal(mapWorldSampler().id, "wild-island-1");
    assert.notEqual(hash(Array.from(placeAnimals(animals).entries())), before);
    setArkWorld("v1");
    setNoHamlet(false);
    assert.equal(hash(Array.from(placeAnimals(animals).entries())), before);
});

test("v2: the map's sampler and the behaviour world are the wild island's: its square, its walk grid, its fresh water", () => {
    setArkWorld("v2");
    assert.equal(mapPoints().sampler.id, "wild-island-1");
    const sampler = behaviourWorldSampler();
    assert.equal(sampler.half, TERRAIN_HALF);
    assert.equal(TERRAIN_HALF, 264);
    assert.deepEqual(sampler.centre, {x: 0, z: 0});
    assert.match(sampler.version, /^v2:/);
    const grid = navGrid(sampler);
    assert.equal(grid.cells.size, 264, "2 m cells over the 528 m square");
    // The lake stands above the sea at its own level: its open water is water to the walk grid, never a walk cell.
    assert.ok(sampleGround(LAKE.x, LAKE.z).height > 0, "the lake's bed is above the sea");
    assert.ok(sampler.isWater(LAKE.x, LAKE.z));
    assert.ok(grid.depthAt(LAKE.x, LAKE.z) > 1, `lake depth ${grid.depthAt(LAKE.x, LAKE.z)}`);
    assert.equal(grid.walkable(LAKE.x, LAKE.z, MAX_SLOPE), false);
    let lakeWalk = 0;
    let lakeCells = 0;
    // (At the walk grid's own cells' middles: a cell is water where its middle is.)
    const cell = (v: number) => Math.floor((v + TERRAIN_HALF) / 2) * 2 - TERRAIN_HALF + 1;
    for (let x = cell(LAKE.x - LAKE.r); x <= LAKE.x + LAKE.r; x += 2) {
        for (let z = cell(LAKE.z - LAKE.r); z <= LAKE.z + LAKE.r; z += 2) {
            if (wildWaterDepth(x, z) <= 0) continue;
            lakeCells++;
            if (grid.walkable(x, z, MAX_SLOPE)) lakeWalk++;
        }
    }
    assert.ok(lakeCells > 100, `${lakeCells} cells of fresh water`);
    assert.equal(lakeWalk, 0, "no walk cell in the lake or the river");
    // Drinking spots round the lake and along both reaches of the river, on dry ground beside the water.
    const edges = sampler.attachPoints("water_edge");
    assert.ok(edges.length > 80, `${edges.length} water edges`);
    for (const p of edges) assert.ok(wildWaterDepth(p.x, p.z) <= 0, `water edge in the water at ${p.x},${p.z}`);
});

test("v2: every zone key the server assigns has a site on the island, on its own ground", () => {
    setArkWorld("v2");
    for (const zone of ARK_ZONES) {
        const site = ZONE_SITES[zone];
        assert.ok(site && Number.isFinite(site.x) && Number.isFinite(site.z), zone);
        assert.ok(Math.abs(site.x) < TERRAIN_HALF && Math.abs(site.z) < TERRAIN_HALF, zone);
        const s = sampleWildGround(site.x, site.z);
        if (site.kind === "sea") assert.ok(s.height < -1.4, `${zone}'s site at sea`);
        else if (site.kind === "land") assert.equal(wildZoneAt(s), zone === "farm_garden" ? "grassland" : zone, `${zone}'s site on its ground`);
    }
    // Farm and Garden (no farm or garden on the wild island): the grassland's meadow on the coast facing the town.
    assert.ok(ZONE_SITES.farm_garden.x > 60 && ZONE_SITES.farm_garden.z < 0, JSON.stringify(ZONE_SITES.farm_garden));
});

test("v2: placement never builds the behaviour world: the prebuilt walk mask is the live grid's answer, cell for cell", () => {
    setArkWorld("v2");
    const sampler = behaviourWorldSampler();
    const grid = navGrid(sampler);
    const {size} = grid.cells;
    const wrong: string[] = [];
    for (const slope of [MAX_SLOPE, MOUNTAIN_SLOPE]) {
        for (let j = 0; j < size; j++) {
            for (let i = 0; i < size; i++) {
                const x = -TERRAIN_HALF + (i + 0.5) * 2;
                const z = -TERRAIN_HALF + (j + 0.5) * 2;
                const masked = maskWalkable(x, z, slope);
                if (masked === null || masked !== grid.walkable(x, z, slope)) wrong.push(`${slope} ${x},${z}`);
            }
        }
    }
    assert.deepEqual(wrong.slice(0, 5), [], `${wrong.length} cells differ from the live grid (${sampler.version}; the mask is from ${WALK_MASK_V2_VERSION}): run ARK_WORLD=v2 npx tsx scripts/ark-map-walk-mask.mts`);
    // The places, with the mask and asking the grid itself: the same.
    const animals = some();
    setWalkMaskEnabled(false);
    const asked = placeAnimals(animals);
    setWalkMaskEnabled(true);
    const masked = placeAnimals(animals);
    for (const a of animals) assert.deepEqual(masked.get(a.id), asked.get(a.id), a.model_slug);
});

test("v2: the spawn validator places every species at 0 failures; big walkers on their ranges, whales in the deep, the rest off both", () => {
    setArkWorld("v2");
    const {failures, animals, species, placed} = validateMap();
    assert.ok(species > 2400 && animals === species * 2, `${species} species, ${animals} animals`);
    const by = failuresBySpecies(failures);
    assert.deepEqual(Array.from(by.entries()).slice(0, 8).map(([slug, checks]) => `${slug}: ${Array.from(checks.entries()).map(([c, d]) => `${c} ${d}`).join("; ")}`), [], `${failures.length} failures`);
    const ranges = bigRanges();
    const whales = whaleCells();
    let onRange = 0;
    let inWhaleWater = 0;
    for (const a of validatorAnimals()) {
        const place = placed.get(a.id);
        const sp = mapSpecies(a.model_slug, a.zone);
        if (!place?.map || place.map.held || !sp || place.host) continue;
        const length = arkBody(a).metres;
        const ground = !place.water && !place.perch && !place.micro && !place.canopy && !place.map.shore;
        if (ground && !sp.small && takesRange(sp.move, length) && (a.slot_rank ?? 0) === 0) {
            const near = ranges.some((r) => Math.hypot(r.x - place.x, r.z - place.z) <= 4.5);
            if (near) onRange++;
        } else if (ground && length < 2.5) {
            // (A smaller animal's ground spot is never in a range's clear disc: decision 54.)
            assert.ok(!inRange(place.x, place.z, -0.01), `${a.model_slug} in a range at ${place.x.toFixed(1)},${place.z.toFixed(1)} (${RANGE_CLEAR} m disc)`);
        }
        // (A whale by its drawn length, as `map/water.ts` reserves the deep water: 6 m and more.)
        const drawn = displayLength(a);
        if (place.water && place.sea && place.map.water && drawn >= 6 && ["deep", "surface", "upper", "mid"].includes(place.map.water) && (a.slot_rank ?? 0) === 0) {
            assert.ok(whales.some((w) => Math.hypot(w.x - place.x, w.z - place.z) < 9), `${a.model_slug} (${length.toFixed(1)} m) not on a whale cell at ${place.x.toFixed(0)},${place.z.toFixed(0)}`);
            inWhaleWater++;
        } else if (place.water && place.sea && place.map.water && drawn < 6 && (a.slot_rank ?? 0) === 0) {
            assert.ok(!whales.some((w) => Math.hypot(w.x - place.x, w.z - place.z) < WHALE_CLEAR - 2.5), `${a.model_slug} in a whale's water at ${place.x.toFixed(0)},${place.z.toFixed(0)}`);
        }
    }
    assert.ok(onRange > 20, `${onRange} big walkers on their ranges`);
    assert.ok(inWhaleWater > 4, `${inWhaleWater} whales in their deep water`);
});
