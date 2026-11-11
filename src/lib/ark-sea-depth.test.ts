import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/ark-scene/fixtures/snapshot.json";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourState} from "@/ark-scene/behaviour-state";
import {placeAnimals} from "@/ark-scene/placement";
import {
    breathAt,
    depthSeed,
    depthTable,
    FLOAT_SINK,
    FLOOR_CLEAR,
    fitInWater,
    safeLoopRadius,
    speciesDepth,
    SURFACE_CLEAR,
    swimRange,
    waterLoopRadius,
    waterMotion,
    waterSpec,
    type SpeciesDepth
} from "@/ark-scene/sea-depth";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkBody} from "@/ark-scene/stats";
import type {ArkAnimal, ArkZone} from "@/ark-scene/types";
import {heightAt, LAKE, sampleGround, ZONE_SITES} from "@/ark-scene/world";

/**
 * The sea-depth fix (`sea-depth.ts`): every water species has a depth band
 * from stored data, stays in it through a day (its whole body under the
 * surface, an air-breather excepted while it breathes), the bottom-dwellers
 * on the floor, fresh water in the lake and salt water in the sea.
 */

const BANDS = new Set(["surface", "upper", "mid", "seabed", "reef", "deep", "pond_surface", "pond_mid", "pond_bed"]);
const table = depthTable();
const slugs = Object.keys(table);

/** A zone for a species' own home: the reef's for a reef band, the open ocean's for the rest at sea, the shore's for a coast one, the lake's for fresh water. */
function homeZone(depth: SpeciesDepth): ArkZone {
    if (depth.water === "fresh") return "river_lake";
    if (depth.home === "coast") return "seashore";
    return depth.band === "reef" ? "coral_reef" : "open_ocean";
}

function animalOf(slug: string, zone: ArkZone, index = 0, slot = 0, rank = 0): ArkAnimal {
    return {
        id: `00000000-0000-4000-b000-${String(index).padStart(12, "0")}`,
        species_profile_id: `depth-${slug}`,
        name: slug,
        scientific_name: null,
        model_slug: slug,
        zone,
        arrived_at: "2026-11-01T12:00:00Z",
        brought_by: {label: "Voyager 1", named: false},
        mine: false,
        slot,
        slot_rank: rank
    } as ArkAnimal;
}

/** Every water species, each alone in its home zone (its slot its index among its zone's, so none share a spot). */
const placed = (() => {
    const perZone = new Map<ArkZone, number>();
    const animals = slugs.map((slug, index) => {
        const zone = homeZone(table[slug]);
        const slot = perZone.get(zone) ?? 0;
        perZone.set(zone, slot + 1);
        return animalOf(slug, zone, index, slot);
    });
    return {animals, places: placeAnimals(animals)};
})();

test("every water species in the catalogue has a band, a water and a reason", () => {
    assert.ok(slugs.length > 400, `${slugs.length} water species`);
    for (const slug of slugs) {
        const depth = table[slug];
        assert.ok(BANDS.has(depth.band), `${slug}: ${depth.band}`);
        assert.ok(depth.water === "salt" || depth.water === "fresh", slug);
        assert.ok(depth.reason.length > 4, `${slug} has no reason`);
        // Fresh bands for fresh water, salt bands for the sea.
        assert.equal(depth.band.startsWith("pond_"), depth.water === "fresh", `${slug}: ${depth.band} in ${depth.water} water`);
    }
    // The bands the owner named are all in use.
    for (const band of Array.from(BANDS)) assert.ok(slugs.some((slug) => table[slug].band === band), band);
    // Every sea animal of the fixtures has its own row (not the fallback).
    for (const raw of [fixture, fixtureV2]) {
        for (const animal of decodeArkSnapshot(raw)!.animals) {
            if (ZONE_SITES[animal.zone].kind !== "sea") continue;
            assert.notEqual(speciesDepth(animal.model_slug, animal.zone)?.source, undefined, animal.model_slug);
            assert.ok(table[animal.model_slug], `${animal.model_slug} has no depth row`);
        }
    }
});

test("through 24 hours each water species stays in its band, under the surface but for its breaths", () => {
    const DAY = 24 * 3600;
    const START = Date.UTC(2026, 10, 11) / 1000;
    let samples = 0;
    for (const animal of placed.animals) {
        const depth = table[animal.model_slug];
        const place = placed.places.get(animal.id)!;
        if (place.micro) continue;
        const motion = waterMotion(depth);
        const seed = depthSeed(animal.id);
        const body = arkBody(animal);
        let surfaced = false;
        for (let t = 0; t < DAY; t += 7 * 60 + 13) {
            const clock = START + t;
            // Its loop about its spot, as the scene swims it (kept in the lake's open water there).
            const angle = seed * Math.PI * 2 + t * 0.07;
            const radius = safeLoopRadius(place.x, place.z, waterLoopRadius(motion, seed, body.display));
            const x = place.x + Math.cos(angle) * radius;
            const z = place.z + Math.sin(angle) * radius;
            const floorY = heightAt(x, z);
            assert.ok(floorY < -0.5, `${animal.model_slug} swam out of its water at ${x.toFixed(1)}, ${z.toFixed(1)}`);
            // Its breath comes through its behaviour state (awake here; asleep the cycle is only slower).
            const state = behaviourState({activity: "any", elevation: 30, flyer: false, breather: depth.breathes && motion !== "float" ? {seed, clock} : null});
            const breath = state.breathing ? breathAt(seed, clock) : 0;
            assert.equal(state.breathing, breath > 0);
            if (state.breathing) assert.ok(depth.breathes, `${animal.model_slug} breathes but is not an air-breather`);
            const spec = waterSpec(depth, floorY, seed, clock, breath);
            // At its true drawn height and at the far view's 2.3 times.
            for (const height of [body.display * 0.4, body.display * 0.4 * 2.3]) {
                const {base, middle} = fitInWater(spec, height);
                const top = base + height;
                samples++;
                if (motion === "float") {
                    assert.ok(Math.abs(base + FLOAT_SINK * height) < 1e-9, `${animal.model_slug} floats`);
                    continue;
                }
                if (breath > 0) {
                    surfaced ||= breath === 1 && top > 0;
                    continue;
                }
                if (motion === "walk") {
                    assert.ok(Math.abs(base - floorY) < 1e-9, `${animal.model_slug} on the floor`);
                    continue;
                }
                if (motion === "hole") {
                    assert.ok(base < floorY && top > floorY, `${animal.model_slug} in its hole`);
                    continue;
                }
                // A swimmer: wholly under the surface, always.
                assert.ok(top <= -SURFACE_CLEAR + 1e-9, `${animal.model_slug} breaks the surface (top ${top.toFixed(2)}) at ${t}s`);
                const waterDepth = -floorY;
                const room = waterDepth >= height + SURFACE_CLEAR + FLOOR_CLEAR;
                if (!room) continue;
                assert.ok(base >= floorY + FLOOR_CLEAR - 1e-9, `${animal.model_slug} in the floor`);
                // In its band, or at the edge it was fitted to.
                const range = swimRange(depth.band, waterDepth);
                const lo = range.aboveFloor ? floorY + FLOOR_CLEAR + height / 2 + range.from : -range.to;
                const hi = range.aboveFloor ? floorY + FLOOR_CLEAR + height / 2 + range.to : -range.from;
                const fittedLow = floorY + FLOOR_CLEAR + height / 2;
                const fittedHigh = -SURFACE_CLEAR - height / 2;
                const inBand = middle >= lo - 1e-9 && middle <= hi + 1e-9;
                const atEdge = Math.abs(middle - fittedLow) < 1e-9 || Math.abs(middle - fittedHigh) < 1e-9;
                assert.ok(inBand || atEdge, `${animal.model_slug} (${depth.band}) at ${middle.toFixed(2)} outside ${lo.toFixed(2)}…${hi.toFixed(2)}`);
            }
        }
        // An air-breather comes up for air within its cycle (at most 140 s awake): its back breaks the surface.
        if (depth.breathes && motion !== "float") {
            for (let t = 0; t < 300 && !surfaced; t += 0.5) {
                const breath = breathAt(seed, START + t);
                const {base} = fitInWater(waterSpec(depth, place.ground, seed, START + t, breath), 1);
                surfaced = breath === 1 && base + 1 > 0;
            }
            assert.ok(surfaced, `${animal.model_slug} never came up to breathe`);
        }
    }
    assert.ok(samples > 100000, `${samples} samples`);
});

test("the seabed's animals sit at the seabed's height", () => {
    let checked = 0;
    for (const animal of placed.animals) {
        const depth = table[animal.model_slug];
        const place = placed.places.get(animal.id)!;
        if (waterMotion(depth) !== "walk" || place.micro) continue;
        const floorY = sampleGround(place.x, place.z).height;
        assert.ok(floorY < -0.3, `${animal.model_slug} not over water`);
        const {base} = fitInWater(waterSpec(depth, floorY, depthSeed(animal.id), 0, 0), 0.3);
        assert.equal(base, floorY, animal.model_slug);
        checked++;
    }
    assert.ok(checked > 80, `${checked} on the floor`);
});

test("fresh-water species are never in the sea, salt-water species never in the lake", () => {
    // Each in its own zone, and each also in the other kind's zones (as the catalogue sometimes puts it).
    const zones: ArkZone[] = ["river_lake", "open_ocean", "coral_reef", "seashore", "polar", "farm_garden", "wetland"];
    const animals = slugs.flatMap((slug, index) => zones.map((zone, k) => animalOf(slug, zone, index * zones.length + k, index, 0)));
    const places = placeAnimals(animals);
    let checked = 0;
    for (const animal of animals) {
        const depth = table[animal.model_slug];
        const place = places.get(animal.id)!;
        const ground = sampleGround(place.x, place.z);
        const inLake = Math.hypot(place.x - LAKE.x, place.z - LAKE.z) < LAKE.r + 1.5;
        if (place.micro) {
            // A small one at its microhabitat: a pond's surface is fresh water.
            if (place.micro.surface === "water") assert.equal(depth.water, "fresh", `${animal.model_slug} (salt) on a pond`);
            continue;
        }
        if (depth.water === "fresh") {
            assert.ok(inLake && ground.height < -0.3, `${animal.model_slug} (fresh, ${animal.zone}) not in the lake`);
        } else {
            assert.ok(!inLake && ground.inland < 0 && ground.height < -1, `${animal.model_slug} (salt, ${animal.zone}) not in the sea`);
        }
        checked++;
    }
    assert.ok(checked > slugs.length * zones.length * 0.9, `${checked} checked`);
});
