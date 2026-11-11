import assert from "node:assert/strict";
import test from "node:test";
import population from "@/ark-scene/fixtures/hamlet-population.json";
import slots from "@/ark-scene/map/hamlet-slots.json";
import {DOOR_SECONDS, HAMLET_STEP_SECONDS, hamletState, homePlots, houseCount, outKind, outShare, planHamletSlots, plotOf, plotSpots, reservedAt, reservedPlots, smallholdingCount, spotSize, type HamletResident} from "@/ark-scene/map/hamlet";
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
    const all = reservedPlots();
    assert.ok(all.filter((p) => p.kind === "house").length >= 7 && all.filter((p) => p.kind === "smallholding").length >= 4, `${all.length} plots`);
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
        assert.ok(!reservedAt(place.x, place.z), `${id} on a reserved plot`);
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
