import assert from "node:assert/strict";
import test from "node:test";
import population from "@/ark-scene/fixtures/hamlet-population.json";
import slots from "@/ark-scene/map/hamlet-slots.json";
import {DOOR_SECONDS, HAMLET_STEP_SECONDS, HOUSE_SPOT_COUNT, MAX_HOUSES, MAX_SMALLHOLDINGS, SMALLHOLDING_SPOT_COUNT, hamletState, homePlots, houseCount, outKind, outShare, planHamletSlots, planWithReport, plotFootprint, plotOf, plotSpots, reservedAt, reservedPlots, smallholdingCount, spotSize, type HamletResident} from "@/ark-scene/map/hamlet";
import {cottageStyle, onHomeKeepOut, plotFrame} from "@/ark-scene/props/home-layout";
import {cropAt} from "@/ark-scene/fields";
import {COTTAGE, GARDEN_POND} from "@/ark-scene/micro-decor";
import {laneDistance, LANE_WIDTH, riverDistance, sampleGround} from "@/ark-scene/world";
import {validateCapacity, validatePlots, validatePopulation, CROWD_MAX} from "@/ark-scene/map/validate-hamlet";
import {validateMap} from "@/ark-scene/map/validate";
import {defaultHomePlots} from "@/ark-scene/props/home-layout";
import {placeAnimals} from "@/ark-scene/placement";
import {arkBody} from "@/ark-scene/stats";
import type {ArkAnimal} from "@/ark-scene/types";

/**
 * The hamlet (owner decision D10; AnimalDex docs/ark/captures-backfill-dry-run.md §5): plots that grow append-only on
 * reserved land, residents in their plots, a realistic share out of doors on the shared clock, and no crowding, tested
 * with the dry run's house and farm residents at 1× and 3× (`fixtures/hamlet-population.json`, `scripts/ark-map-scale.mts`
 * runs the whole population).
 */

const ROWS = (population as unknown as {residents: Array<[string, "house" | "farm", string | null, number]>}).residents;
const DAY = Date.UTC(2026, 10, 12) / 1000;
const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

function residents(scale: number): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    for (const [slug, area, activity, n] of ROWS) {
        for (let i = 0; i < n * scale; i++) {
            out.push({id: `r${scale}-${slug}-${area}-${i}`, species_profile_id: `kind-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: "farm_garden", area, arrived_at: "2026-11-11T00:00:00Z", brought_by: {label: "Voyager 3", named: false}, mine: false, activity: activity as ArkAnimal["activity"]} as ArkAnimal);
        }
    }
    return out;
}

test("hamlet: plots by the dry run's rule, today's cottage and barn first, append-only, capped by the reserved land", () => {
    assert.equal(houseCount(0), 1);
    assert.equal(houseCount(1053), 9);
    assert.equal(houseCount(3159), 16);
    assert.equal(smallholdingCount(145), 3);
    assert.equal(smallholdingCount(435), 6);
    // The first two are the props' defaults, exactly.
    assert.deepEqual(homePlots(0, 0), defaultHomePlots());
    assert.deepEqual(homePlots(500, 80).slice(0, 2), defaultHomePlots());
    // Append-only: more residents only add plots at the end of each kind's list.
    for (let h = 0; h < 2200; h += 130) {
        const now = homePlots(h, 100);
        const more = homePlots(h + 130, 160);
        for (const plot of now) assert.deepEqual(more.find((p) => p.id === plot.id), plot, plot.id);
    }
    // Home growth (2026-11-11): the reserved land holds the full cap, 16 houses and 6 smallholdings.
    const all = reservedPlots();
    assert.equal(all.filter((p) => p.kind === "house").length, MAX_HOUSES);
    assert.equal(all.filter((p) => p.kind === "smallholding").length, MAX_SMALLHOLDINGS);
    assert.deepEqual(homePlots(3159, 435), all.slice(0, 2).concat(all.slice(2).filter((p) => p.kind === "house"), all.slice(2).filter((p) => p.kind === "smallholding")));
    assert.deepEqual(planWithReport().misses, [], "every entry of the hamlet's plan has its plot");
});

test("hamlet: the reserved slots are fresh for this terrain, apart, their houses and barns clear, on dry land", () => {
    const fresh = planHamletSlots().map((plot) => ({...plot, x: Math.round(plot.x * 1000) / 1000, z: Math.round(plot.z * 1000) / 1000}));
    assert.deepEqual(fresh, (slots as unknown as {plots: unknown[]}).plots, "run scripts/ark-map-hamlet.mts");
    assert.deepEqual(validatePlots().map((f) => f.detail), []);
});

test("hamlet: no wild animal on a reserved plot (the spawn validator's population), and nobody wild moves when a plot opens", () => {
    const {placed} = validateMap();
    placed.forEach((place, id) => {
        if (place.micro || place.canopy || place.water || place.hamlet || place.map?.held) return;
        // (A partner stands a step aside from its host, which is what keeps off: a tick by a grazer at a plot's hedge.)
        const host = place.host ? placed.get(place.host.id) : null;
        assert.ok(!reservedAt(host?.x ?? place.x, host?.z ?? place.z), `${id} on a reserved plot`);
    });
});

test("hamlet: residents go to their area's plots by a stable hash; a new plot takes only its own share", () => {
    const animals = residents(1);
    const few = homePlots(1053, 145);
    const more = homePlots(1053 + 130, 145 + 50);
    let moved = 0;
    for (const animal of animals) {
        const plot = plotOf(animal, few)!;
        assert.equal(plot.kind, animal.area === "house" ? "house" : "smallholding");
        const after = plotOf(animal, more)!;
        if (after.id !== plot.id) {
            moved++;
            // Only into a new plot.
            assert.ok(!few.some((p) => p.id === after.id), `${animal.id} moved between old plots`);
        }
    }
    assert.ok(moved < animals.length * 0.3, `${moved} moved`);
});

test("hamlet: a realistic share out of doors by kind and hour, never more than a plot's spots, each on a spot of its plot its body may use; door beats from the door", () => {
    assert.equal(outKind("domestic-dog"), "dog");
    assert.equal(outKind("domestic-cat"), "cat");
    assert.equal(outKind("domestic-chicken"), "poultry");
    assert.equal(outKind("cow"), "livestock");
    assert.equal(outKind("goldfish"), "indoor");
    assert.equal(outShare("cat", 23), 0.45);
    assert.equal(outShare("poultry", 2), 0);
    for (const scale of [1, 3]) {
        const animals = residents(scale);
        const placed = placeAnimals(animals);
        const list: HamletResident[] = animals.map((a) => ({id: a.id, slug: a.model_slug, length: arkBody(a).metres, plot: placed.get(a.id)!.hamlet!.plot}));
        const report = validateCapacity(list, hours, DAY);
        assert.deepEqual(report.failures.map((f) => f.detail), [], `${scale}x`);
        const spots = new Set(list.map((r) => r.plot.id));
        const capacity = Array.from(spots).reduce((sum, id) => sum + plotSpots(list.find((r) => r.plot.id === id)!.plot).spots.length, 0);
        assert.ok(report.most <= capacity && report.most > 30, `${scale}x: at most ${report.most} out of ${capacity} spots`);
        // At 2 a.m. every hen is in its coop (livestock may be out at night, a few).
        const night = hamletState(list, DAY + 2 * 3600, hours);
        night.out.forEach((_out, id) => assert.ok(!/chicken/.test(id), `${id} out at night`));
        // Door beats: an animal coming out starts at its door and ends on its spot.
        let beats = 0;
        for (let step = 0; step < 12; step++) {
            const t = DAY + 9 * 3600 + step * HAMLET_STEP_SECONDS;
            const start = hamletState(list, t, hours);
            const later = hamletState(list, t + DOOR_SECONDS + 1, hours);
            start.beats.forEach((beat, id) => {
                beats++;
                assert.equal(beat.t, 0);
                if (beat.kind === "out") assert.deepEqual(later.out.get(id)!.at, beat.to);
                else assert.ok(!later.out.has(id));
            });
            assert.equal(later.beats.size, 0);
        }
        assert.ok(beats > 0, "some go in and out");
        // Every size on a spot it may use.
        hamletState(list, DAY + 12 * 3600, hours).out.forEach((out, id) => {
            const r = list.find((x) => x.id === id)!;
            assert.ok(plotSpots(out.plot).spots[out.spot].sizes.includes(spotSize(r.length)));
        });
    }
});

test(`hamlet + map: no more than ${CROWD_MAX} cat-sized animals in a 1 m cube at the dry run's 1x (residents and the validator's wild population)`, () => {
    const report = validatePopulation(residents(1), hours, DAY);
    assert.deepEqual(report.failures.map((f) => `${f.check}: ${f.detail}`), []);
    assert.ok(report.mostPerCell <= CROWD_MAX && report.residents === 1198, `${report.mostPerCell} in a cell, ${report.residents} residents`);
});

test("hamlet: reservedAt holds on every slot (its origin, its footprint's middle; either winding of its corners), nowhere else", () => {
    for (const plot of reservedPlots().slice(2)) {
        const c = plotFootprint(plot);
        const mid = {x: c.reduce((sum, p) => sum + p.x, 0) / 4, z: c.reduce((sum, p) => sum + p.z, 0) / 4};
        assert.ok(reservedAt(plot.x, plot.z), `${plot.id} origin`);
        assert.ok(reservedAt(mid.x, mid.z), `${plot.id} middle`);
        // Just outside each corner, away from the middle: not reserved by this plot (the gap between plots).
        for (const corner of c) {
            const ox = corner.x + (corner.x - mid.x) * 0.08;
            const oz = corner.z + (corner.z - mid.z) * 0.08;
            assert.ok(!reservedAt(ox, oz) || reservedPlots().slice(2).some((other) => other.id !== plot.id && Math.hypot(other.x - ox, other.z - oz) < 20), `${plot.id} outside a corner`);
        }
    }
    assert.ok(!reservedAt(-4, -4) && !reservedAt(-40, -26), "the lake, the woodland");
});

test("hamlet: every resident spot is free (off the props' beds, compost, butts, hay, troughs and coop houses, off crops and lanes), and the plots have their spots", () => {
    const plots = reservedPlots();
    for (const plot of plots) {
        const spots = plotSpots(plot);
        if (plot.kind === "house") assert.equal(spots.spots.length, HOUSE_SPOT_COUNT, plot.id);
        else assert.equal(spots.spots.length, SMALLHOLDING_SPOT_COUNT.paddock + SMALLHOLDING_SPOT_COUNT.yard + SMALLHOLDING_SPOT_COUNT.run, plot.id);
        for (const spot of spots.spots) {
            const out = onHomeKeepOut(spot.x, spot.z, plots, 0.25);
            assert.equal(out, null, `${plot.id} ${spot.where} spot on ${out?.what}`);
            assert.equal(cropAt(spot.x, spot.z), null, `${plot.id} ${spot.where} spot on a crop`);
            assert.ok(laneDistance(spot.x, spot.z) > LANE_WIDTH / 2, `${plot.id} ${spot.where} spot on a lane`);
        }
        // Spots at least a body apart: no two in one place.
        for (let i = 0; i < spots.spots.length; i++) for (let j = i + 1; j < spots.spots.length; j++) assert.ok(Math.hypot(spots.spots[i].x - spots.spots[j].x, spots.spots[i].z - spots.spots[j].z) > 1.2, `${plot.id} spots ${i} and ${j}`);
    }
});

test("hamlet: a house's door and window follow its cottage's size", () => {
    for (const plot of reservedPlots().filter((p) => p.kind === "house")) {
        const k = cottageStyle(plot).scale;
        const local = plotFrame(plot).toLocal(plotSpots(plot).door.x, plotSpots(plot).door.z);
        assert.ok(Math.abs(local.z - ((COTTAGE.depth / 2) * k + 0.3)) < 1e-6 && Math.abs(local.x) < 1e-6, plot.id);
        const window = plotFrame(plot).toLocal(plotSpots(plot).window!.x, plotSpots(plot).window!.z);
        assert.ok(Math.abs(window.x - 1.6 * k) < 1e-6, plot.id);
    }
});

test("hamlet: no resident spot (nor a door) in a pond or at its stones, nor in the river or the sea", () => {
    for (const plot of reservedPlots()) {
        const spots = plotSpots(plot);
        for (const spot of [...spots.spots, spots.door, ...(spots.coopDoor ? [spots.coopDoor] : [])]) {
            // A dog's half-length clear of the pond's ring of stones (the pond's radius and 0.3 m of stones).
            assert.ok(Math.hypot(spot.x - GARDEN_POND.x, spot.z - GARDEN_POND.z) > GARDEN_POND.radius + 0.3 + 0.5, `${plot.id} spot in the garden pond`);
            assert.ok(sampleGround(spot.x, spot.z).height >= 0.3 && riverDistance(spot.x, spot.z) >= 3, `${plot.id} spot in water`);
        }
    }
});

test("hamlet: who is out is the same whoever asked first: never another rotation's, clock's or resident list's answer", () => {
    // (Visual CI determinism check, 2026-11-11: the step's answer was remembered by the step, the list's length and its
    // first and last ids only, so a page that asked with another rotation first, or a list changed in its middle, got
    // that answer.)
    const animals = residents(1);
    const placed = placeAnimals(animals);
    const list: HamletResident[] = animals.map((a) => ({id: a.id, slug: a.model_slug, length: arkBody(a).metres, plot: placed.get(a.id)!.hamlet!.plot}));
    const t = DAY + 10 * 3600 + 17;
    const fresh = (outside?: Parameters<typeof hamletState>[3], l = list, h = hours) => JSON.stringify(Array.from(hamletState(l, t, h, outside).out.entries()).map(([id, out]) => [id, out.plot.id, out.spot]));
    const ring = fresh();
    // Another rotation (everyone it may take, in reverse), asked at the same step after the ring: its own answer.
    const everyone = (candidates: ReadonlyArray<{id: string; group: string}>, budget: number) => new Set(candidates.slice().reverse().slice(0, budget).map((c) => c.id));
    const other = fresh(everyone);
    assert.notEqual(other, ring, "another rotation gives another answer");
    assert.equal(fresh(), ring, "the ring's again");
    // The same rotation asked first the other way round, in a fresh order: the same answers.
    const otherClock = (epoch: number) => hours(epoch);
    assert.equal(fresh(everyone, list, otherClock), other);
    assert.equal(fresh(undefined, list, otherClock), ring);
    // A list changed in its middle (same length, same first and last): worked out for that list.
    const swapped = list.slice();
    const middle = Math.floor(list.length / 2);
    const moved = list.findIndex((r, i) => i !== middle && i > 0 && i < list.length - 1 && r.plot.id !== list[middle].plot.id);
    swapped[middle] = {...list[middle], plot: list[moved].plot};
    const direct = JSON.stringify(Array.from(hamletState(swapped.slice(), t, (e: number) => hours(e)).out.entries()).map(([id, out]) => [id, out.plot.id, out.spot]));
    assert.equal(fresh(undefined, swapped), direct, "a list changed in its middle gets its own answer");
});
